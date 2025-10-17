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

function normalizeMiddleName(s) {
  const t = safeNullIfEmpty(s);
  if (t == null) return null;
  const tt = t.trim();
  if (/^N\.?M\.?I\.?$/i.test(tt)) return null;
  const cap = tt.charAt(0).toUpperCase() + tt.slice(1);
  return /^[A-Z][a-zA-Z\s\-',.]*$/.test(cap) ? cap : null;
}

function toTitleCase(str) {
  if (!str || str.trim() === "") return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  } catch (e) { }
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch (e) { }
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) { }

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
  let effectiveYearStr = null;
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
      if (/Dwelling Units/i.test(name)) numberOfUnitsStr = val;
      if (/Year Built/i.test(name)) yearBuiltStr = val;
      if (/Effective Year/i.test(name)) effectiveYearStr = val;
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
  // Also try DWELLING UNITS pattern from building details
  if (!numberOfUnitsStr) {
    const mDU = inputHTML.match(
      /<b>DWELLING UNITS<\/b>-<i>(\d+)<\/i>/i,
    );
    if (mDU) numberOfUnitsStr = mDU[1];
  }
  if (!yearBuiltStr) {
    const mY = inputHTML.match(
      /Year Built[\s\S]*?<td class=\"value\">\s*(\d{4})\s*<\/td>/i,
    );
    if (mY) yearBuiltStr = mY[1];
  }
  // Also try Year Built from building header
  if (!yearBuiltStr) {
    const mYB = inputHTML.match(/Year Built:\s*(\d{4})/i);
    if (mYB) yearBuiltStr = mYB[1];
  }
  if (!effectiveYearStr) {
    const mEY = inputHTML.match(/Effective Year:\s*(\d{4})/i);
    if (mEY) effectiveYearStr = mEY[1];
  }
  if (!zoning) {
    const mZ = inputHTML.match(
      /<td class=\"label\">\s*Zoning\s*<\/td>\s*<td class=\"value\">\s*([\s\S]*?)<\/td>/i,
    );
    if (mZ) zoning = mZ[1].replace(/\s+/g, " ").trim();
  }

  // Helper function to clean and validate livable floor area
  function cleanLivableFloorArea(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^\d]/g, ''); // Remove all non-digits
    // Must have at least 2 consecutive digits to match schema pattern .*\d{2,}.*
    return cleaned.length >= 2 ? cleaned : null;
  }

  // Build property.json
  // property_type enum: LandParcel, Building, Unit, ManufacturedHome

  function propertyType(v) {
    if (!v) return null;
    const s = v.toUpperCase();

    // ManufacturedHome - mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("MHT COOP") || s.includes("MODULAR")) return "ManufacturedHome";

    // Unit - individual units within larger structures
    if (s.includes("CONDO") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("CO-OP") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") ||
        s.includes("BOAT UNITS") || s.includes("BOAT SLIPS") ||
        s.includes("LEASE INTEREST") || s.includes("NO LAND INTEREST")) return "Unit";

    // LandParcel - vacant land or land-focused properties
    if (s.includes("VACANT") || s.includes("ACREAGE") ||
        s.includes("AGRICULTURAL") || s.includes("PASTURE") ||
        s.includes("GROVE") || s.includes("TIMBER") || s.includes("FARM") ||
        s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("WETLANDS") || s.includes("PRESERVE") ||
        s.includes("CONSERVATION") || s.includes("RIGHT OF WAY")) return "LandParcel";

    // Building - default for structures (residential, commercial, industrial, institutional)
    return "Building";
  }

  function unitsType(v) {
    switch (v) {
      case "1":
        return "One";
      case "2":
        return "Two";
      case "3":
        return "Three";
      case "4":
        return "Four";
      default:
        return null;
    }
  }

  // Extract property type from HTML model
  let mappedPropertyType = null;
  let useCode = null;
  let units = null;

  const modelMatch = inputHTML.match(/var model = ({.*?});/s);
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (modelData.propertyDetail) {
        useCode =
          modelData.propertyDetail.UseCodeDesc ||
          modelData.propertyDetail.UseCode ||
          modelData.propertyDetail.PropertyUseCode ||
          modelData.propertyDetail.PropertyUseDescription ||
          null;
        mappedPropertyType = mapPropertyUseCodeToType(useCode);
        units = parseInt(modelData.propertyDetail.Units) || 0;
      }
    } catch (e) {
      console.log("Error parsing property type from model:", e.message);
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
    property_type: mappedPropertyType,
    property_usage_type: mapPropertyUsageType(useCode),
    livable_floor_area: cleanLivableFloorArea(areaUnderAir),
    number_of_units_type: null,
    number_of_units: units || (numberOfUnitsStr ? parseInt(numberOfUnitsStr, 10) : null),
    subdivision: safeNullIfEmpty(subdivision),
    zoning: safeNullIfEmpty(zoning),
    property_effective_built_year: effectiveYearStr
      ? parseInt(effectiveYearStr, 10)
      : null,
    historic_designation: false,
    source_http_request: {
      url: "https://pbcpao.gov/Property/Details",
      method: "GET",
      multiValueQueryString: { parcelId: [parcelId || "unknown"] },
    },
    request_identifier: parcelId || "unknown",
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

  // Parse Section, Township, Range from Section Map Id (e.g., "05-1S-29-2")
  let section = null,
    township = null,
    range = null;
  const sectionMapMatch = inputHTML.match(
    /<b>Section Map Id:<\/b>[\s\S]*?<a[^>]*>(\d{2}-\d+[NS]-\d+(?:-\d+)?)<\/a>/i
  );
  if (sectionMapMatch) {
    const parts = sectionMapMatch[1].split("-");
    if (parts.length >= 3) {
      section = parts[0]; // "05"
      township = parts[1]; // "1S"
      range = parts[2]; // "29"
    }
  }

  const countyName =
    unAddr && unAddr.county_jurisdiction ? unAddr.county_jurisdiction : null;

  function cardinalStreetName(v) {
    if (!v) return null;
    const s = v.toUpperCase().trim();
    const regex = /^(N|S|E|W|NE|NW|SE|SW)\s+|\s+(N|S|E|W|NE|NW|SE|SW)$/g;
    const cleaned = s.replace(regex, "").trim();
    return cleaned;
  }

  function directionPrefix(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    const regex = /^(N|S|E|W|NE|NW|SE|SW)\b/;
    const match = s.match(regex);
    return match ? match[1] : null;
  }

  function directionSuffix(v) {
    if (!v) return null;
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
    city_name: safeNullIfEmpty(cityFromFull),
    postal_code: safeNullIfEmpty(postalCode),
    plus_four_postal_code: safeNullIfEmpty(plus4),
    state_code: safeNullIfEmpty(stateCode),
    country_code: "US",
    county_name: countyName || null,
    latitude: null,
    longitude: null,
    municipality_name: safeNullIfEmpty(municipality),
    route_number: null,
    township: safeNullIfEmpty(township),
    range: safeNullIfEmpty(range),
    section: safeNullIfEmpty(section),
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
    storiesVal = null,
    foundationVal = null,
    structuralFrameVal = null,
    heatAirVal = null;

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
      if (/Foundation/i.test(name)) foundationVal = val;
      if (/Structural Frame/i.test(name)) structuralFrameVal = val;
      if (/Heat\/Air/i.test(name)) heatAirVal = val;
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
  // Also try from building details patterns
  if (!foundationVal) {
    const mF = inputHTML.match(/<b>FOUNDATION<\/b>-<i>(.*?)<\/i>/i);
    if (mF) foundationVal = mF[1];
  }
  if (!structuralFrameVal) {
    const mSF = inputHTML.match(/<b>STRUCTURAL FRAME<\/b>-<i>(.*?)<\/i>/i);
    if (mSF) structuralFrameVal = mSF[1];
  }
  if (!storiesVal) {
    const mSt = inputHTML.match(/<b>NO\. STORIES<\/b>-<i>(\d+)<\/i>/i);
    if (mSt) storiesVal = mSt[1];
  }
  if (!heatAirVal) {
    const mHA = inputHTML.match(/<b>HEAT\/AIR<\/b>-<i>(.*?)<\/i>/i);
    if (mHA) heatAirVal = mHA[1];
  }

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
  function mapFoundationType(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("SLAB")) return "Slab";
    if (s.includes("CRAWL")) return "Crawl Space";
    if (s.includes("BASEMENT")) return "Full Basement";
    if (s.includes("PIER")) return "Pier and Beam";
    if (s.includes("PILING")) return "Piling";
    return null;
  }
  function mapFramingMaterial(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("WOOD")) return "Wood";
    if (s.includes("STEEL")) return "Steel";
    if (s.includes("CONCRETE")) return "Concrete";
    if (s.includes("MASONRY")) return "Masonry";
    return null;
  }
  function mapHVACSystem(heatAirValue) {
    // Parse HEAT/AIR field like "WALL/FLOOR FURN" to extract heating and cooling
    if (!heatAirValue) return { heating: null, cooling: null };
    const s = heatAirValue.toUpperCase();

    let heating = null;
    let cooling = null;

    // Heating system mappings
    if (s.includes("CENTRAL") && s.includes("GAS")) heating = "Forced Air";
    else if (s.includes("CENTRAL") || s.includes("FORCED AIR")) heating = "Forced Air";
    else if (s.includes("HEAT PUMP")) heating = "Heat Pump";
    else if (s.includes("ELECTRIC")) heating = "Electric";
    else if (s.includes("WALL") || s.includes("FLOOR") || s.includes("FURN")) heating = "Wall Furnace";
    else if (s.includes("BASEBOARD")) heating = "Electric Baseboard";
    else if (s.includes("RADIANT")) heating = "Radiant";
    else if (s.includes("NONE") || s.includes("NO HEAT")) heating = null;

    // Cooling system mappings
    if (s.includes("CENTRAL") && (s.includes("AIR") || s.includes("A/C") || s.includes("AC"))) cooling = "Central Air";
    else if (s.includes("HEAT PUMP")) cooling = "Heat Pump";
    else if (s.includes("WINDOW") || s.includes("WALL UNIT")) cooling = "Window Unit";
    else if (s.includes("NONE") || s.includes("NO A/C") || s.includes("NO AIR")) cooling = null;
    // If it mentions FURN (furnace) without AC, assume basic heating only
    else if (s.includes("FURN") && !s.includes("AIR") && !s.includes("A/C")) cooling = null;

    return { heating, cooling };
  }

  function mapElementNameToSpaceType(elementName) {
    if (!elementName) return null;
    const name = elementName.toUpperCase();

    // Skip summary elements that shouldn't be individual spaces
    if (
      name.includes("TOTAL SQUARE FOOTAGE") ||
      name.includes("AREA UNDER AIR")
    ) {
      return null; // Don't create layout items for these summary elements
    }

    if (name.includes("FOP") || name.includes("FINISHED OPEN PORCH"))
      return "Open Porch";
    if (name.includes("BAS") || name.includes("BASE AREA"))
      return "Living Area";
    if (name.includes("FGR") || name.includes("FINISHED GARAGE"))
      return "Attached Garage";
    if (name.includes("GARAGE")) return "Attached Garage";
    if (name.includes("PORCH")) return "Open Porch";
    if (name.includes("DECK")) return "Deck";
    if (name.includes("PATIO")) return "Patio";
    if (name.includes("BALCONY")) return "Balcony";
    if (name.includes("LIVING")) return "Living Area";
    if (name.includes("BEDROOM")) return "Bedroom";
    if (name.includes("BATH")) return "Bathroom";
    if (name.includes("KITCHEN")) return "Kitchen";
    if (name.includes("DINING")) return "Dining Room";
    if (name.includes("FAMILY")) return "Family Room";
    if (name.includes("LAUNDRY")) return "Laundry Room";
    if (name.includes("STORAGE")) return "Storage";
    if (name.includes("CLOSET")) return "Closet";
    if (name.includes("UTILITY")) return "Utility Room";
    if (name.includes("MECHANICAL")) return "Mechanical Room";
    if (name.includes("ELECTRICAL")) return "Electrical Room";
    if (name.includes("PLUMBING")) return "Plumbing Room";
    if (name.includes("HVAC")) return "HVAC Room";
    if (name.includes("HEATING")) return "Heating Room";
    if (name.includes("WATER")) return "Water Heater Room";
    if (name.includes("SEWER")) return "Sewer Room";
    if (name.includes("GAS")) return "Gas Room";
    if (name.includes("OTHER")) return "Other";

    return "Other"; // Default fallback
  }

  /**
   * Map Palm Beach Property Use Code to property_usage_type enum.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property usage type from Elephant schema enum
   */
  function mapPropertyUsageType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // RESIDENTIAL (0000-0900)
    if (s.includes("SINGLE FAMILY") || s.includes("DUPLEX") || s.includes("TRIPLEX") ||
        s.includes("MULTI-FAMILY") || s.includes("MOBILE HOME") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("APARTMENT") || s.includes("VACANT RESIDENTIAL") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") || s.includes("MISC RES"))
      return "Residential";

    // RETIREMENT
    if (s.includes("RETIREMENT HOME") || s.includes("HOME FOR THE AGED") || s.includes("NURSING HOME"))
      return "Retirement";

    // RESIDENTIAL COMMON ELEMENTS
    if (s.includes("RESIDENTIAL COMMON AREA") || s.includes("RESIDENTIAL COMMON AREA/ELEMENT"))
      return "ResidentialCommonElementsAreas";

    // COMMERCIAL - Retail
    if (s.includes("STORE") || s.includes("SUPERMARKET") || s.includes("CONVENIENCE STORE"))
      return "RetailStore";
    if (s.includes("DEPARTMENT STORE")) return "DepartmentStore";
    if (s.includes("SHOPPING CENTER, REGIONAL")) return "ShoppingCenterRegional";
    if (s.includes("SHOPPING CENTER, COMMUNITY") || s.includes("SHOPPING CENTER, NEIGHBORHOOD"))
      return "ShoppingCenterCommunity";

    // COMMERCIAL - Office
    if (s.includes("OFFICE BUILDING")) return "OfficeBuilding";
    if (s.includes("MEDICAL OFFICE")) return "MedicalOffice";

    // COMMERCIAL - Transportation
    if (s.includes("AIRPORT") || s.includes("BUS TERMINAL") || s.includes("MARINA"))
      return "TransportationTerminal";

    // COMMERCIAL - Food & Lodging
    if (s.includes("RESTAURANT")) return "Restaurant";
    if (s.includes("HOTEL") || s.includes("MOTEL")) return "Hotel";

    // COMMERCIAL - Financial
    if (s.includes("FINANCIAL INSTITUTION") || s.includes("INSURANCE COMPANY"))
      return "FinancialInstitution";

    // COMMERCIAL - Automotive
    if (s.includes("SERVICE STATION") || s.includes("VEHICLE LUBE")) return "ServiceStation";
    if (s.includes("AUTO SALES") || s.includes("GARAGE, REPAIR")) return "AutoSalesRepair";

    // COMMERCIAL - Entertainment
    if (s.includes("THEATRE") || s.includes("AUDITORIUM") || s.includes("NIGHT CLUB") ||
        s.includes("BAR") || s.includes("BOWLING ALLEY") || s.includes("SKATING") ||
        s.includes("TOURIST ATTRACTION") || s.includes("CAMPS"))
      return "Entertainment";
    if (s.includes("RACE TRACK")) return "RaceTrack";
    if (s.includes("GOLF COURSE")) return "GolfCourse";

    // COMMERCIAL - Other
    if (s.includes("MOBILE HOME PARK")) return "MobileHomePark";
    if (s.includes("WHOLESALER") || s.includes("PRODUCE HOUSE")) return "WholesaleOutlet";
    if (s.includes("PARKING LOT") || s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT"))
      return "Commercial";

    // INDUSTRIAL
    if (s.includes("LIGHT MANUFACTURING")) return "LightManufacturing";
    if (s.includes("HEAVY MANUFACTURING") || s.includes("EXCEPTIONAL INDUSTRIAL"))
      return "HeavyManufacturing";
    if (s.includes("LUMBER YARD")) return "LumberYard";
    if (s.includes("PACKING PLANT")) return "PackingPlant";
    if (s.includes("BOTTLER") || s.includes("FOOD PROCESSING")) return "Cannery";
    if (s.includes("MINERAL PROCESSING")) return "MineralProcessing";
    if (s.includes("WAREHOUSING")) return "Warehouse";
    if (s.includes("OPEN STORAGE") || s.includes("INDUSTRIAL, VACANT")) return "OpenStorage";

    // AGRICULTURAL
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("HAY"))
      return "DrylandCropland";
    if (s.includes("PASTURE")) return "GrazingLand";
    if (s.includes("TIMBER")) return "TimberLand";
    if (s.includes("GROVE") || s.includes("CITRUS") || s.includes("GRAPES")) return "OrchardGroves";
    if (s.includes("FOWL") || s.includes("BEES")) return "Poultry";
    if (s.includes("NURSERY") || s.includes("ORNAMENTAL")) return "Ornamentals";
    if (s.includes("HORSES") || s.includes("SWINE") || s.includes("GOATS") ||
        s.includes("AQUACULTURE") || s.includes("FISH") || s.includes("MISCELLANEOUS AG"))
      return "Agricultural";

    // INSTITUTIONAL - Church & Education
    if (s.includes("CHURCH")) return "Church";
    if (s.includes("SCHOOL, PRIVATE") || s.includes("DAY CARE") || s.includes("DORMITORY"))
      return "PrivateSchool";

    // INSTITUTIONAL - Healthcare
    if (s.includes("HOSPITAL, PRIVATE")) return "PrivateHospital";
    if (s.includes("SANITARIUM")) return "SanitariumConvalescentHome";

    // INSTITUTIONAL - Other
    if (s.includes("ORPHANAGE") || s.includes("MISC") && s.includes("INSTITUTIONAL"))
      return "NonProfitCharity";
    if (s.includes("MORTUARY") || s.includes("FUNERAL HOME") || s.includes("CEMETERY"))
      return "MortuaryCemetery";
    if (s.includes("LODGES") || s.includes("CLUBS") || s.includes("UNION HALLS") ||
        s.includes("YACHTING CLUBS") || s.includes("COUNTRY CLUBS"))
      return "ClubsLodges";
    if (s.includes("CULTURAL FACILITIES") || s.includes("PERFORMING ARTS"))
      return "CulturalOrganization";

    // GOVERNMENTAL
    if (s.includes("MILITARY FACILITY")) return "Military";
    if (s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR"))
      return "ForestParkRecreation";
    if (s.includes("GOVERNMENT OWNED, PUBLIC SCHOOL")) return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, COLLEGE") || s.includes("GOVERNMENT OWNED, UNIVERSITY"))
      return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, HOSPITAL")) return "PublicHospital";
    if (s.includes("COUNTY OWNED") || s.includes("STATE OWNED") ||
        s.includes("FEDERALLY OWNED") || s.includes("MUNICIPALLY OWNED") ||
        s.includes("VACANT GOVERNMENTAL"))
      return "GovernmentProperty";

    // UTILITIES & OTHER
    if (s.includes("UTILITIES") || s.includes("WATERWORKS") || s.includes("CENTRALLY ASSESSED"))
      return "Utility";
    if (s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("BAY BOTTOM"))
      return "RiversLakes";
    if (s.includes("SEWER DISP") || s.includes("SOLID WASTE") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("HAZARDOUS WASTE"))
      return "SewageDisposal";
    if (s.includes("RIGHT OF WAY") || s.includes("RAILROAD")) return "Railroad";

    // CONSERVATION & RECREATIONAL
    if (s.includes("CONSERVATION EASEMENT") || s.includes("MARKET VALUE CONSERVATION") ||
        s.includes("WETLANDS") || s.includes("PRESERVE") || s.includes("RESOURCE PROTECT") ||
        s.includes("ENDANGERED SPECIES") || s.includes("MANGROVE") || s.includes("MARSH LANDS") ||
        s.includes("SWAMP") || s.includes("CYPRESS HEAD"))
      return "Conservation";
    if (s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS"))
      return "Recreational";

    // Generic fallbacks
    if (s.includes("VACANT")) return "TransitionalProperty";

    return null;
  }

  /**
   * Map Palm Beach Property Use Code/description text to property_type.
   * New simplified enum: LandParcel, Building, Unit, ManufacturedHome
   * Handles residential, commercial, industrial, agricultural, institutional, and governmental properties.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property type from Elephant schema enum (LandParcel, Building, Unit, ManufacturedHome)
   */
  function mapPropertyUseCodeToType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // MANUFACTURED HOMES - Mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("RECREATIONAL VEHICLE PARK")) return "ManufacturedHome";

    // UNITS - Individual units within larger structures, condos, co-ops, timeshares, boat slips
    if (s.includes("CONDOMINIUM") || s.includes("CONDO") ||
        s.includes("CO-OPERATIVE") || s.includes("INTERVAL OWNERSHIP") ||
        s.includes("TIME SHARE") || s.includes("BOAT UNITS") ||
        s.includes("BOAT SLIPS") || s.includes("LEASE INTEREST") ||
        s.includes("NO LAND INTEREST")) return "Unit";

    // LAND PARCELS - Vacant land, agricultural, conservation, parking, water bodies, etc.
    if (s.includes("VACANT RESIDENTIAL") || s.includes("VACANT") ||
        s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT") ||
        s.includes("INDUSTRIAL, VACANT") || s.includes("VACANT INSTITUTIONAL") ||
        s.includes("VACANT GOVERNMENTAL")) return "LandParcel";

    // Agricultural land
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("POTATOES") ||
        s.includes("MISCELLANEOUS AG LAND") || s.includes("SOD") ||
        s.includes("TIMBER") || s.includes("PASTURE") || s.includes("GROVE") ||
        s.includes("GRAPES") || s.includes("CITRUS NURSERY") || s.includes("BEES") ||
        s.includes("FOWL") || s.includes("FISH") || s.includes("HORSES") ||
        s.includes("SWINE") || s.includes("GOATS") || s.includes("NURSERY") ||
        s.includes("AQUACULTURE") || s.includes("ACREAGE") ||
        s.includes("MARKET VALUE AGRICULTURAL")) return "LandParcel";

    // Open land and natural features
    if (s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("MINING") || s.includes("PETROLEUM") || s.includes("PHOSPHATE") ||
        s.includes("BOAT RAMPS") || s.includes("RIGHT OF WAY") ||
        s.includes("SUBMERGED") || s.includes("LOW LOT") || s.includes("LAKE") ||
        s.includes("POND") || s.includes("BAY BOTTOM") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("SEWER DISP") ||
        s.includes("SOLID WASTE") || s.includes("HISTORICAL") ||
        s.includes("SLOUGH") || s.includes("INDIAN MOUND") ||
        s.includes("MARSH LANDS") || s.includes("ISLAND") || s.includes("SWAMP") ||
        s.includes("SPOILS EASEMENTS") || s.includes("ENDANGERED SPECIES") ||
        s.includes("MANGROVE") || s.includes("UNBUILDABLE") ||
        s.includes("RESOURCE PROTECT") || s.includes("WETLANDS") ||
        s.includes("PRESERVE") || s.includes("CYPRESS HEAD") ||
        s.includes("HAZARDOUS WASTE") || s.includes("MINERAL RIGHTS") ||
        s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS") ||
        s.includes("MARKET VALUE CONSERVATION") || s.includes("CONSERVATION EASEMENT") ||
        s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR")) return "LandParcel";

    // BUILDINGS - All other structures (residential, commercial, industrial, institutional, governmental)
    // This is the default for most property types with structures
    return "Building";
  }

  // Extract number of buildings from HTML model
  let numberOfBuildings = 1; // Default to 1 building

  // Parse the JavaScript model from HTML to get building count
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (
        modelData.structuralDetails &&
        modelData.structuralDetails.BuildingNumbers &&
        Array.isArray(modelData.structuralDetails.BuildingNumbers)
      ) {
        numberOfBuildings = modelData.structuralDetails.BuildingNumbers.length;
        console.log("Number of buildings extracted:", numberOfBuildings);
      }
    } catch (e) {
      console.log("Error parsing model data for building count:", e.message);
    }
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
    foundation_type: mapFoundationType(foundationVal),
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
    primary_framing_material: mapFramingMaterial(structuralFrameVal),
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: storiesVal ? parseInt(storiesVal, 10) : null,
    number_of_buildings: numberOfBuildings,
    finished_base_area: areaUnderAir ? parseInt(areaUnderAir, 10) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utilities from owners/utilities_data.json or extracted from HTML
  const hvacSystems = mapHVACSystem(heatAirVal);
  let utilityOut = null;
  if (utilitiesData && ownersKey && utilitiesData[ownersKey]) {
    utilityOut = utilitiesData[ownersKey];
    // Override with extracted HVAC data if available
    if (hvacSystems.heating) utilityOut.heating_system_type = hvacSystems.heating;
    if (hvacSystems.cooling) utilityOut.cooling_system_type = hvacSystems.cooling;
  } else {
    utilityOut = {
      cooling_system_type: hvacSystems.cooling,
      heating_system_type: hvacSystems.heating,
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

  // Generate layouts from extracted building data or fallback to owners/layout_data.json
  let layoutIdx = 1;

  // First, use extracted building data if available
  // Layout files are now created by the layout mapping script

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

  // Extract person and company names using improved classification
  let personIdx = 1;
  let companyIdx = 1;
  let relIdx = 1;
  const processedNames = new Set(); // Track processed names to avoid duplicates

  // Company detection keywords (case-insensitive)
  const companyRegex =
    /(\binc\b|\binc\.|\bllc\b|l\.l\.c\.|\bltd\b|\bltd\.\b|\bfoundation\b|\balliance\b|\bsolutions\b|\bcorp\b|\bcorp\.\b|\bco\b|\bco\.\b|\bcompany\b|\bservices\b|\btrust\b|\btr\b|\bassociates\b|\bpartners\b|\bholdings\b|\bgroup\b|\blp\b|\bpllc\b|\bpc\b|\bbank\b|\bna\b|n\.a\.)/i;

  function classifyRawToOwners(raw) {
    const normalized = raw.replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();

    if (!normalized || !/[a-zA-Z]/.test(normalized)) {
      return { owners: [], invalids: [{ raw, reason: "non_name" }] };
    }

    // Company classification: treat entire string as a single company
    if (companyRegex.test(normalized)) {
      return { owners: [{ type: "company", name: normalized }], invalids: [] };
    }

    // Multi-person split on '&'
    if (normalized.includes("&")) {
      const segments = normalized
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean);
      const owners = [];
      const invalids = [];

      for (const seg of segments) {
        const tokens = seg.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) {
          invalids.push({ raw: seg, reason: "insufficient_parts" });
          continue;
        }
        const first = tokens[0];
        const last = tokens[tokens.length - 1];
        const middle = tokens.slice(1, -1).join(" ").trim();
        const person = { type: "person", first_name: first, last_name: last };
        if (middle) person.middle_name = middle;
        owners.push(person);
      }
      return { owners, invalids };
    }

    // Single person path
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length < 2) {
      return {
        owners: [],
        invalids: [{ raw: normalized, reason: "insufficient_parts" }],
      };
    }
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(" ").trim();
    const person = { type: "person", first_name: first, last_name: last };
    if (middle) person.middle_name = middle;
    return { owners: [person], invalids: [] };
  }

  // Extract from sales history
  if (model && Array.isArray(model.salesInfo)) {
    for (let i = 0; i < model.salesInfo.length; i++) {
      const sale = model.salesInfo[i];
      if (sale.OwnerName) {
        const ownerName = sale.OwnerName.trim();
        if (ownerName && !processedNames.has(ownerName)) {
          processedNames.add(ownerName);

          const { owners, invalids } = classifyRawToOwners(ownerName);

          for (const owner of owners) {
            if (owner.type === "company") {
              // Create company record
              const company = {
                name: toTitleCase(owner.name),
                request_identifier: `company_${companyIdx}`,
                source_http_request: {
                  url: "https://pbcpao.gov/Property/Details",
                  method: "GET",
                  multiValueQueryString: { parcelId: [parcelId] },
                },
              };

              writeJSON(
                path.join(dataDir, `company_${companyIdx}.json`),
                company,
              );

              // Create relationship to sales record
              const rel = {
                to: { "/": `./company_${companyIdx}.json` },
                from: { "/": `./sales_${i + 1}.json` },
              };
              writeJSON(
                path.join(dataDir, `relationship_sales_company_${relIdx}.json`),
                rel,
              );

              companyIdx++;
              relIdx++;
            } else {
              // Create person record
              const person = {
                birth_date: null,
                first_name: toTitleCase(owner.first_name),
                last_name: toTitleCase(owner.last_name),
                middle_name: toTitleCase(owner.middle_name) || "None",
                prefix_name: null,
                suffix_name: null,
                us_citizenship_status: null,
                veteran_status: null,
                request_identifier: `person_${personIdx}`,
                source_http_request: {
                  url: "https://pbcpao.gov/Property/Details",
                  method: "GET",
                  multiValueQueryString: { parcelId: [parcelId] },
                },
              };

              writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

              // Create relationship to sales record
              const rel = {
                to: { "/": `./person_${personIdx}.json` },
                from: { "/": `./sales_${i + 1}.json` },
              };
              writeJSON(
                path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
                rel,
              );

              personIdx++;
              relIdx++;
            }
          }
        }
      }
    }
  }

  // Also extract from current owner info if available
  if (model && Array.isArray(model.ownerInfo)) {
    for (const ownerName of model.ownerInfo) {
      if (ownerName && !processedNames.has(ownerName)) {
        processedNames.add(ownerName);

        const { owners, invalids } = classifyRawToOwners(ownerName);

        for (const owner of owners) {
          if (owner.type === "company") {
            // Create company record
            const company = {
              name: toTitleCase(owner.name),
              request_identifier: `company_${companyIdx}`,
              source_http_request: {
                url: "https://pbcpao.gov/Property/Details",
                method: "GET",
                multiValueQueryString: { parcelId: [parcelId] },
              },
            };

            writeJSON(
              path.join(dataDir, `company_${companyIdx}.json`),
              company,
            );

            // Create relationship from property to company
            const propRel = {
              to: { "/": `./company_${companyIdx}.json` },
              from: { "/": `./property.json` },
            };
            writeJSON(
              path.join(
                dataDir,
                `relationship_company_${companyIdx}_property.json`,
              ),
              propRel,
            );

            companyIdx++;
          } else {
            // Create person record
            const person = {
              birth_date: null,
              first_name: toTitleCase(owner.first_name),
              last_name: toTitleCase(owner.last_name),
              middle_name: toTitleCase(owner.middle_name) || "None",
              prefix_name: null,
              suffix_name: null,
              us_citizenship_status: null,
              veteran_status: null,
              request_identifier: `person_${personIdx}`,
              source_http_request: {
                url: "https://pbcpao.gov/Property/Details",
                method: "GET",
                multiValueQueryString: { parcelId: [parcelId] },
              },
            };

            writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

            // Create relationship from property to person
            const propRel = {
              to: { "/": `./person_${personIdx}.json` },
              from: { "/": `./property.json` },
            };
            writeJSON(
              path.join(
                dataDir,
                `relationship_person_${personIdx}_property.json`,
              ),
              propRel,
            );

            personIdx++;
          }
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

  // Run mapping scripts to generate additional data files
  console.log("Running owner mapping...");
  require("./ownerMapping.js");

  console.log("Running layout mapping...");
  require("./layoutMapping.js");

  console.log("Running structure mapping...");
  require("./structureMapping.js");

  console.log("Running utility mapping...");
  require("./utilityMapping.js");

  console.log("All mapping scripts completed successfully");
}

main();
