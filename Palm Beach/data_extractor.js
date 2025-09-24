const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function extractBetween(html, regex, idx = 1) {
  const m = html.match(regex);
  return m ? (m[idx] || "").trim() : null;
}

function toISODate(mdy) {
  if (!mdy) return null;
  const m = String(mdy).trim();
  const parts = m.split("/");
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts.map((x) => x.trim());
  if (!yyyy || !mm || !dd) return null;
  const MM = mm.padStart(2, "0");
  const DD = dd.padStart(2, "0");
  return `${yyyy}-${MM}-${DD}`;
}

function safeNullIfEmpty(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function parseModelJSONFromHTML(html) {
  const re = /var\s+model\s*=\s*(\{[\s\S]*?\});/m;
  const m = html.match(re);
  if (!m) return null;
  const jsonText = m[1];
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    try {
      return JSON.parse(jsonText.replace(/\n/g, ""));
    } catch (e2) {
      return null;
    }
  }
}

function mapDeedTypeEnum(s) {
  // Only return values that exactly map to the allowed enum list; else null.
  if (!s) return null;
  const t = s.toUpperCase().trim();
  if (t.includes("WARRANTY DEED")) return "Warranty Deed";
  if (t.includes("SPECIAL WARRANTY")) return "Special Warranty Deed";
  if (t.includes("QUIT")) return "Quitclaim Deed";
  if (t.includes("GRANT DEED")) return "Grant Deed";
  if (t.includes("BARGAIN AND SALE")) return "Bargain and Sale Deed";
  if (t.includes("LADY BIRD")) return "Lady Bird Deed";
  if (t.includes("TRANSFER ON DEATH")) return "Transfer on Death Deed";
  if (t.includes("SHERIFF'S DEED")) return "Sheriff's Deed";
  if (t.includes("TAX DEED")) return "Tax Deed";
  if (t.includes("TRUSTEE")) return "Trustee's Deed";
  if (t.includes("PERSONAL REPRESENTATIVE"))
    return "Personal Representative Deed";
  if (t.includes("CORRECTION")) return "Correction Deed";
  if (t.includes("LIEU")) return "Deed in Lieu of Foreclosure";
  if (t.includes("LIFE ESTATE")) return "Life Estate Deed";
  if (t.includes("JOINT TENANCY")) return "Joint Tenancy Deed";
  if (t.includes("TENANCY IN COMMON")) return "Tenancy in Common Deed";
  if (t.includes("COMMUNITY PROPERTY")) return "Community Property Deed";
  if (t.includes("GIFT DEED")) return "Gift Deed";
  if (t.includes("INTERSPOUSAL")) return "Interspousal Transfer Deed";
  if (t.includes("WILD DEED")) return "Wild Deed";
  return null;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const inputHTML = readText("input.html");
  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Input owners/utilities/layout
  let ownersData = {};
  let utilitiesData = {};
  let layoutData = {};
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch (e) {}
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch (e) {}
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) {}

  const parcelId = seed && seed.parcel_id ? String(seed.parcel_id) : null;
  const ownersKey = parcelId ? `property_${parcelId}` : null;

  // Parse embedded model first (robust source inside HTML)
  const model = parseModelJSONFromHTML(inputHTML);

  // Extract property core fields from HTML (supplement)
  const locAddr = extractBetween(
    inputHTML,
    /<span id="MainContent_lblLocation">([\s\S]*?)<\/span>/i,
  );
  const municipality = extractBetween(
    inputHTML,
    /"AddressLine3":"([\w\s]+?)\s[A-Z]{2}\s\d{5}/i,
  );
  const pcnHyphen = extractBetween(
    inputHTML,
    /<span id="MainContent_lblPCN">([\s\S]*?)<\/span>/i,
  );
  const subdivision = extractBetween(
    inputHTML,
    /<span id="MainContent_lblSubdiv">([\s\S]*?)<\/span>/i,
  );
  const legalDesc = extractBetween(
    inputHTML,
    /<span id="MainContent_lblLegalDesc">([\s\S]*?)<\/span>/i,
  );

  // Property metrics from model.structuralDetails if available
  let areaUnderAir = null;
  let totalSquareFootage = null;
  let numberOfUnitsStr = null;
  let yearBuiltStr = null;
  let zoning = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Area Under Air/i.test(name)) areaUnderAir = val;
      if (/Total Square Footage/i.test(name)) totalSquareFootage = val;
      if (/Number of Units/i.test(name)) numberOfUnitsStr = val;
      if (/Year Built/i.test(name)) yearBuiltStr = val;
    }
  }
  // Zoning from model.propertyDetail if present
  if (model && model.propertyDetail) {
    const zc = model.propertyDetail.Zoning || null;
    const zd = model.propertyDetail.ZoningDesc || null;
    const zcitydesc = model.propertyDetail.ZoningCityDesc || null;
    if (zc && zd && zcitydesc) {
      zoning = `${zc}—${zd} (${zcitydesc})`;
    }
  }
  // Fallback to regex if missing
  if (!areaUnderAir) {
    const mA = inputHTML.match(
      /Area Under Air[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mA) areaUnderAir = mA[1];
  }
  if (!totalSquareFootage) {
    const mT = inputHTML.match(
      /Total Square Footage[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mT) totalSquareFootage = mT[1];
  }
  if (!numberOfUnitsStr) {
    const mN = inputHTML.match(
      /Number of Units[\s\S]*?<td class=\"value\">\s*(\d+)\s*<\/td>/i,
    );
    if (mN) numberOfUnitsStr = mN[1];
  }
  if (!yearBuiltStr) {
    const mY = inputHTML.match(
      /Year Built[\s\S]*?<td class=\"value\">\s*(\d{4})\s*<\/td>/i,
    );
    if (mY) yearBuiltStr = mY[1];
  }
  if (!zoning) {
    const mZ = inputHTML.match(
      /<td class=\"label\">\s*Zoning\s*<\/td>\s*<td class=\"value\">\s*([\s\S]*?)<\/td>/i,
    );
    if (mZ) zoning = mZ[1].replace(/\s+/g, " ").trim();
  }

  // Build property.json
  // Cooperative, Condominium, Modular, ManufacturedHousingMultiWide, Pud, Timeshare, 2Units, DetachedCondominium, Duplex, SingleFamily, TwoToFourFamily, MultipleFamily, 3Units, ManufacturedHousing, ManufacturedHousingSingleWide, 4Units, Townhouse, NonWarrantableCondo, VacantLand, Retirement, MiscellaneousResidential, ResidentialCommonElementsAreas, MobileHome

  function propertyType(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("COOPERATIVE")) return "Cooperative";
    if (s.includes("CONDOMINIUM")) return "Condominium";
    if (s.includes("MODULAR")) return "Modular";
    if (s.includes("TOWNHOUSE")) return "Townhouse";
    if (s.includes("TIMESHARE")) return "Timeshare";
    if (s.includes("SINGLE FAMILY")) return "SingleFamily";
    if (s.includes("MULTIFAMILY")) return "MultipleFamily";
    if (s.includes("VACANT")) return "VacantLand";
    if (s.includes("RETIREMENT")) return "Retirement";
    if (s.includes("MOBILE HOME")) return "MobileHome";
    if (s.includes("MHT COOP")) return "ManufacturedHousing";
    if (s.includes("MOBILE HOME/MANUFACTURED HOME")) return "ManufacturedHousing";
    if (s.includes("MULTIFAMILY < 5 UNITS")) return "MultiFamilyLessThan10";
    if (s.includes("STATE")) return "VacantLand";
    if (s.includes("CITY INC NONMUNI")) return "VacantLand";
    return null;
  }

  function unitsType(v) {
    switch (v) {
      case "1": return "One";
      case "2": return "Two";
      case "3": return "Three";
      case "4": return "Four";
      default: return null;
    }
  }

  const property = {
    parcel_identifier:
      parcelId ||
      safeNullIfEmpty(pcnHyphen ? pcnHyphen.replace(/-/g, "") : null),
    property_structure_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr, 10)
      : null,
    property_legal_description_text: safeNullIfEmpty(
      legalDesc ? legalDesc.replace(/\s+/g, " ").trim() : null,
    ),
    property_type: propertyType(extractBetween(
      inputHTML,
      /<td[^>]*class="label"[^>]*>\s*Property Use Code\s*<\/td>\s*<td[^>]*class="value"[^>]*>\s*\d+—([A-Z\s]+)\s*<\/td>/i
    )),
    livable_floor_area: safeNullIfEmpty(areaUnderAir),
    number_of_units_type: safeNullIfEmpty(unitsType(numberOfUnitsStr)),
    area_under_air: safeNullIfEmpty(areaUnderAir),
    total_area: safeNullIfEmpty(totalSquareFootage),
    number_of_units: numberOfUnitsStr ? parseInt(numberOfUnitsStr, 10) : null,
    subdivision: safeNullIfEmpty(subdivision),
    zoning: safeNullIfEmpty(zoning),
    property_effective_built_year: null,
    historic_designation: false,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Build address.json using unnormalized_address and HTML
  const fullAddr = unAddr && unAddr.full_address ? unAddr.full_address : null;
  let postalCode = null,
    plus4 = null,
    stateCode = null,
    cityFromFull = null;
  if (fullAddr) {
    const zipMatch = fullAddr.match(/\b(\d{5})(?:-(\d{4}))?\b/);
    if (zipMatch) {
      postalCode = zipMatch[1];
      plus4 = zipMatch[2] || null;
    }
    const stateMatch = fullAddr.match(/,\s*([A-Z]{2})\s+\d{5}/);
    if (stateMatch) stateCode = stateMatch[1];
    const parts = fullAddr.split(",");
    if (parts.length >= 2) {
      cityFromFull = parts[1].trim().toUpperCase();
    }
  }
  // Street components from Location Address
  let streetNumber = null,
    streetName = null,
    streetSuffix = null;
  if (locAddr) {
    const parts = locAddr.trim().split(/\s+/);
    if (parts.length >= 2) {
      streetNumber = parts[0];
      const last = parts[parts.length - 1].toUpperCase();
      if (last === "WAY") {
        streetSuffix = "Way";
        streetName = parts.slice(1, parts.length - 1).join(" ");
      } else {
        streetName = parts.slice(1).join(" ");
      }
      if (streetName) streetName = streetName.toUpperCase();
    }
  }

  // Lot.json - with allowed nulls and lot_size_acre
  let lotSizeAcre = null;
  // Prefer embedded model.propertyDetail.Acres
  if (
    model &&
    model.propertyDetail &&
    model.propertyDetail.Acres != null &&
    String(model.propertyDetail.Acres).trim() !== ""
  ) {
    const v = parseFloat(
      String(model.propertyDetail.Acres).replace(/[^0-9.]/g, ""),
    );
    if (!isNaN(v)) lotSizeAcre = v;
  }
  if (lotSizeAcre == null) {
    const acresMatch = inputHTML.match(
      /<td class=\"label\">\s*Acres[\s\S]*?<td class=\"value\">\s*([\d]*\.?\d+)\s*<\/td>/i,
    );
    if (acresMatch) {
      const v = parseFloat(acresMatch[1]);
      if (!isNaN(v)) lotSizeAcre = v;
    }
  }

  // Lot and block from legal description if present
  let lotNo = null,
    block = null;
  if (legalDesc) {
    const lotM =
      legalDesc.match(/\bLT\s*(\d+)/i) || legalDesc.match(/\bLOT\s*(\d+)/i);
    if (lotM) lotNo = lotM[1];
    const blkM =
      legalDesc.match(/\bBLK\s*(\w+)/i) || legalDesc.match(/\bBLOCK\s*(\w+)/i);
    if (blkM) block = blkM[1];
  }

  const countyName =
    unAddr && unAddr.county_jurisdiction ? unAddr.county_jurisdiction : null;

    function cardinalStreetName(v) {
      if (!v) return null;
      const s = v.toUpperCase().trim();
      const regex = /^(N|S|E|W|NE|NW|SE|SW)\s+|\s+(N|S|E|W|NE|NW|SE|SW)$/g;
      const cleaned = s.replace(regex, '').trim();
      return cleaned;
    }

    function directionPrefix(v) {
      const s = v.toUpperCase();
      const regex = /^(N|S|E|W|NE|NW|SE|SW)\b/;
      const match = s.match(regex);
      return match ? match[1] : null;
    }

    function directionSuffix(v) {
      const s = v.toUpperCase();
      const regex = /\b(N|S|E|W|NE|NW|SE|SW)\b$/;
      const match = s.match(regex);
      return match ? match[1] : null;
    }

  const address = {
    street_number: safeNullIfEmpty(streetNumber),
    street_name: safeNullIfEmpty(cardinalStreetName(streetName)),
    street_suffix_type: safeNullIfEmpty(streetSuffix),
    street_pre_directional_text: safeNullIfEmpty(directionPrefix(streetName)),
    street_post_directional_text: safeNullIfEmpty(directionSuffix(streetName)),
    unit_identifier: null,
    city_name: safeNullIfEmpty(
      cityFromFull,
    ),
    postal_code: safeNullIfEmpty(postalCode),
    plus_four_postal_code: safeNullIfEmpty(plus4),
    state_code: safeNullIfEmpty(stateCode),
    country_code: "US",
    county_name: countyName || null,
    latitude: null,
    longitude: null,
    municipality_name: safeNullIfEmpty(municipality),
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: safeNullIfEmpty(block),
    lot: safeNullIfEmpty(lotNo),
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // Structure values primarily from model.structuralDetails
  let roofStructureVal = null,
    roofCoverVal = null,
    extWall1Val = null,
    extWall2Val = null,
    intWall1Val = null,
    intWall2Val = null,
    floorType1Val = null,
    floorType2Val = null,
    storiesVal = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Roof Structure/i.test(name)) roofStructureVal = val;
      if (/Roof Cover/i.test(name)) roofCoverVal = val;
      if (/Exterior Wall 1/i.test(name)) extWall1Val = val;
      if (/Exterior Wall 2/i.test(name)) extWall2Val = val;
      if (/Interior Wall 1/i.test(name)) intWall1Val = val;
      if (/Interior Wall 2/i.test(name)) intWall2Val = val;
      if (/Floor Type 1/i.test(name)) floorType1Val = val;
      if (/Floor Type 2/i.test(name)) floorType2Val = val;
      if (/Stories/i.test(name)) storiesVal = val;
    }
  }
  // Fallback to regex when needed
  if (!roofStructureVal)
    roofStructureVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Structure\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!roofCoverVal)
    roofCoverVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Cover\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall1Val)
    extWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall2Val)
    extWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall1Val)
    intWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall2Val)
    intWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType1Val)
    floorType1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType2Val)
    floorType2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!storiesVal)
    storiesVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Stories\s*<\/td>\s*<td class="value">\s*(\d+)\s*<\/td>/i,
    );

  function mapRoofDesign(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("GABLE") && s.includes("HIP")) return "Combination";
    if (s.includes("GABLE")) return "Gable";
    if (s.includes("HIP")) return "Hip";
    if (s.includes("FLAT")) return "Flat";
    return null;
  }
  function mapRoofCover(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("ASPHALT")) return "3-Tab Asphalt Shingle";
    if (s.includes("METAL")) return "Metal Standing Seam";
    if (s.includes("TILE")) return "Clay Tile";
    return null;
  }
  function mapExteriorWall(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("STUCCO")) return "Stucco";
    if (s.includes("BRICK")) return "Brick";
    if (s.includes("CONCRETE")) return "Concrete Block";
    return "Stucco";
  }
  function mapFlooring(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("CARPET")) return "Carpet";
    if (s.includes("TILE")) return "Ceramic Tile";
    if (s.includes("VINYL")) return "Sheet Vinyl";
    if (s.includes("WOOD")) return "Solid Hardwood";
    return null;
  }
  function mapInteriorWallSurface(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("DRYWALL")) return "Drywall";
    if (s.includes("PLASTER")) return "Plaster";
    return null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: extWall1Val
      ? mapExteriorWall(extWall1Val) === "Concrete Block"
        ? "Concrete Block"
        : "Stucco"
      : null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: mapFlooring(floorType1Val),
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: mapInteriorWallSurface(intWall1Val),
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: mapRoofCover(roofCoverVal),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofStructureVal),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: storiesVal ? parseInt(storiesVal, 10) : null,
    finished_base_area: areaUnderAir ? parseInt(areaUnderAir, 10) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utilities from owners/utilities_data.json
  let utilityOut = null;
  if (utilitiesData && ownersKey && utilitiesData[ownersKey]) {
    utilityOut = utilitiesData[ownersKey];
  } else {
    utilityOut = {
      cooling_system_type: null,
      heating_system_type: null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
    };
  }
  writeJSON(path.join(dataDir, "utility.json"), utilityOut);

  // Layouts from owners/layout_data.json
  if (
    layoutData &&
    ownersKey &&
    layoutData[ownersKey] &&
    Array.isArray(layoutData[ownersKey].layouts)
  ) {
    let idx = 1;
    for (const layout of layoutData[ownersKey].layouts) {
      writeJSON(path.join(dataDir, `layout_${idx}.json`), layout);
      idx++;
    }
  }

  const lotOut = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    lot_size_acre: lotSizeAcre != null ? lotSizeAcre : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lotOut);

  // Sales
  const salesFiles = [];
  if (model && Array.isArray(model.salesInfo)) {
    let sIdx = 1;
    for (const s of model.salesInfo) {
      const sale = {
        ownership_transfer_date: toISODate(s.SaleDate),
        purchase_price_amount: s.Price != null ? Number(s.Price) : null,
      };
      const p = path.join(dataDir, `sales_${sIdx}.json`);
      writeJSON(p, sale);
      salesFiles.push({
        index: sIdx,
        date: sale.ownership_transfer_date,
        rawDate: s.SaleDate,
        saleType: s.SaleType,
        Book: s.Book,
        Page: s.Page,
      });
      sIdx++;
    }
  }

  // Files for deed document references (from book/page data)
  const fileIndexBySale = new Map();
  let fileIdx = 1;
  function mapFileDocType(s) {
    if (!s) return "ConveyanceDeed";
    const t = s.toUpperCase();
    if (t.includes("WARRANTY DEED")) return "ConveyanceDeedWarrantyDeed";
    return "ConveyanceDeed";
  }
  for (const s of salesFiles) {
    if (s.Book && s.Page) {
      const book = String(s.Book).trim();
      const page = String(s.Page).trim();
      const url = `https://erec.mypalmbeachclerk.com/Search/DocumentAndInfoByBookPage?Key=Assessor&booktype=O&booknumber=${encodeURIComponent(book)}&pagenumber=${encodeURIComponent(page)}`;
      const fileObj = {
        file_format: "txt",
        name: `OR Book ${book} Page ${page}`,
        original_url: url,
        ipfs_url: null,
        document_type: mapFileDocType(s.saleType),
      };
      writeJSON(path.join(dataDir, `file_${fileIdx}.json`), fileObj);
      fileIndexBySale.set(s.index, fileIdx);
      fileIdx++;
    }
  }

  // Deeds: create a deed file for each sale; deed_type only when enum-mappable
  const deedMap = new Map(); // map sales index -> deed index
  let deedIdx = 1;
  for (const s of salesFiles) {
    const dt = mapDeedTypeEnum(s.saleType);
    const deed = {};
    if (dt) deed.deed_type = dt;
    writeJSON(path.join(dataDir, `deed_${deedIdx}.json`), deed);
    deedMap.set(s.index, deedIdx);
    deedIdx++;
  }

  // relationship_deed_file (deed → file)
  let rdfIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    const fIndex = fileIndexBySale.get(sIndex);
    if (!fIndex) continue;
    const rel = {
      to: { "/": `./deed_${dIndex}.json` },
      from: { "/": `./file_${fIndex}.json` },
    };
    writeJSON(path.join(dataDir, `relationship_deed_file_${rdfIdx}.json`), rel);
    rdfIdx++;
  }

  // relationship_sales_deed (sales → deed)
  let relSDIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    const rel = {
      to: { "/": `./sales_${sIndex}.json` },
      from: { "/": `./deed_${dIndex}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_deed_${relSDIdx}.json`),
      rel,
    );
    relSDIdx++;
  }

  // Owners: create person files and relationships using owners/owner_data.json
  const peopleIndex = new Map(); // key: first|middle|last -> personIndex
  let personIdx = 1;
  function personKey(o) {
    return [o.first_name || "", o.middle_name || "", o.last_name || ""]
      .map((x) => x.toLowerCase())
      .join("|");
  }
  function ensurePerson(o) {
    const key = personKey(o);
    if (!peopleIndex.has(key)) {
      const person = {
        birth_date: null,
        first_name: o.first_name,
        last_name: o.last_name,
        middle_name: safeNullIfEmpty(o.middle_name || null),
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);
      peopleIndex.set(key, personIdx);
      personIdx++;
    }
    return peopleIndex.get(key);
  }

  const ownerByDate =
    ownersData &&
    ownersKey &&
    ownersData[ownersKey] &&
    ownersData[ownersKey].owners_by_date
      ? ownersData[ownersKey].owners_by_date
      : null;
  if (ownerByDate) {
    const dateToPersons = new Map();
    for (const [date, arr] of Object.entries(ownerByDate)) {
      if (String(date).toLowerCase() === "current") continue;
      if (!Array.isArray(arr)) continue;
      for (const o of arr) {
        if (o.type === "person") {
          const idx = ensurePerson(o);
          if (!dateToPersons.has(date)) dateToPersons.set(date, []);
          dateToPersons.get(date).push(idx);
        }
      }
    }
    // Create relationships for matching sales
    let relIdx = 1;
    for (const s of salesFiles) {
      if (!s.date) continue;
      const ownersForDate = dateToPersons.get(s.date);
      if (ownersForDate && ownersForDate.length) {
        for (const pi of ownersForDate) {
          const rel = {
            to: { "/": `./person_${pi}.json` },
            from: { "/": `./sales_${s.index}.json` },
          };
          writeJSON(
            path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
            rel,
          );
          relIdx++;
        }
      }
    }
  }

  // Taxes
  if (model) {
    const assessByYear = new Map();
    const appraiseByYear = new Map();
    const taxByYear = new Map();
    if (Array.isArray(model.assessmentInfo)) {
      for (const a of model.assessmentInfo)
        assessByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.appraisalInfo)) {
      for (const a of model.appraisalInfo)
        appraiseByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.taxInfo)) {
      for (const a of model.taxInfo) taxByYear.set(String(a.TaxYear), a);
    }
    const years = new Set([
      ...assessByYear.keys(),
      ...appraiseByYear.keys(),
      ...taxByYear.keys(),
    ]);
    for (const y of Array.from(years).sort()) {
      const ass = assessByYear.get(y) || {};
      const appr = appraiseByYear.get(y) || {};
      const tax = taxByYear.get(y) || {};
      const landVal = appr.LandValue != null ? Number(appr.LandValue) : null;
      const bldVal =
        appr.ImprovementValue != null ? Number(appr.ImprovementValue) : null;
      const assessed =
        ass.AssessedValue != null ? Number(ass.AssessedValue) : null;
      const market =
        appr.TotalMarketValue != null ? Number(appr.TotalMarketValue) : null;
      const taxable =
        ass.TaxableValue != null ? Number(ass.TaxableValue) : null;
      const yearly =
        tax.TotalTaxValue != null ? Number(tax.TotalTaxValue) : null;
      const taxObj = {
        tax_year: y ? parseInt(y, 10) : null,
        property_assessed_value_amount: assessed,
        property_market_value_amount: market,
        property_building_amount: bldVal,
        property_land_amount: landVal && landVal > 0 ? landVal : null,
        property_taxable_value_amount: taxable,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: yearly,
      };
      writeJSON(path.join(dataDir, `tax_${y}.json`), taxObj);
    }
  }
}

main();
