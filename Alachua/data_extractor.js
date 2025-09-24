// Data extraction script per instructions
// Reads: input.html, unnormalized_address.json, property_seed.json, owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// Writes: JSON outputs under ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf-8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function moneyToNumber(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "" || n === ".") return null;
  const v = Number(n);
  return isNaN(v) ? null : v;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9]/g, "");
  if (!n) return null;
  return parseInt(n, 10);
}

function textOf($, el) {
  return $(el).text().trim();
}

function findRowValueByTh($, moduleSelector, thTextStartsWith) {
  const rows = $(`${moduleSelector} table.tabular-data-two-column tbody tr`);
  for (let i = 0; i < rows.length; i++) {
    const th = $(rows[i]).find("th strong").first();
    const thTxt = textOf($, th);
    if (
      thTxt &&
      thTxt.toLowerCase().startsWith(thTextStartsWith.toLowerCase())
    ) {
      const valSpan = $(rows[i]).find("td div span").first();
      return textOf($, valSpan) || null;
    }
  }
  return null;
}

function parseLocationAddressFromHTML($) {
  const addrLine1 = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl02_pnlSingleValue span",
  )
    .text()
    .trim();
  const addrLine2 = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl03_pnlSingleValue span",
  )
    .text()
    .trim();
  return { addrLine1, addrLine2 };
}

function parseStreetLine(line) {
  // Parses a line like "20346 NW 262ND AVE" or "22982 NW COUNTY RD 236"
  let street_number = null,
    street_pre_directional_text = null,
    street_name = null,
    street_suffix_type = null;

  // Helper function to capitalize street suffix (first letter uppercase, rest lowercase)
  const capitalizeSuffix = (suffix) => {
    if (!suffix) return null;
    const cleaned = suffix.replace(".", "").replace(/\,/, "").replace(/\s+/g, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  if (line) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      street_number = parts[0];
      let startIdx = 1;

      // Check for directional prefix
      const dirToken = parts[1].toUpperCase();
      const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
      if (dirs.has(dirToken)) {
        street_pre_directional_text = dirToken;
        startIdx = 2;
      }

      // Check for special road types that include numbers (e.g., "COUNTY RD 236", "STATE ROAD 100")
      const remainingParts = parts.slice(startIdx);
      const joinedRemaining = remainingParts.join(" ").toUpperCase();

      // Pattern for County Road, State Road, Highway, etc. followed by a number
      if (joinedRemaining.match(/^(COUNTY\s+(RD|ROAD)|STATE\s+(RD|ROAD)|HIGHWAY|HWY|US|SR|CR)\s+\d+/i)) {
        // This is a special case - the entire thing is the street name, no suffix
        street_name = remainingParts.join(" ");
        street_suffix_type = null;
      } else if (remainingParts.length > 0) {
        // Standard parsing - last part is suffix
        const lastPart = remainingParts[remainingParts.length - 1];
        // Check if last part looks like a typical street suffix
        const suffixes = new Set(["ST", "STREET", "AVE", "AVENUE", "RD", "ROAD", "DR", "DRIVE",
                                 "CT", "COURT", "PL", "PLACE", "LN", "LANE", "BLVD", "BOULEVARD",
                                 "WAY", "TER", "TERRACE", "CIR", "CIRCLE", "TRL", "TRAIL", "PKWY", "PARKWAY"]);

        if (suffixes.has(lastPart.toUpperCase().replace(".", ""))) {
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        } else if (!isNaN(lastPart)) {
          // If last part is a number, it's likely part of the street name
          street_name = remainingParts.join(" ");
          street_suffix_type = null;
        } else {
          // Default behavior - treat last part as suffix
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        }
      }
    }
  }
  return {
    street_number,
    street_pre_directional_text,
    street_name,
    street_suffix_type,
  };
}

function parseCityStateZip(line) {
  // HIGH SPRINGS, FL 32643
  if (!line) return { city_name: null, state_code: null, postal_code: null };
  const m = line.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) {
    return {
      city_name: m[1].trim().toUpperCase(),
      state_code: m[2],
      postal_code: m[3],
    };
  }
  return { city_name: null, state_code: null, postal_code: null };
}

function parseSecTwpRng($) {
  const secTwpRng = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl09_pnlSingleValue span",
  )
    .text()
    .trim();
  if (!secTwpRng) return { section: null, township: null, range: null };
  const parts = secTwpRng.split("-").map((s) => s.trim());
  return {
    section: parts[0] || null,
    township: parts[1] || null,
    range: parts[2] || null,
  };
}

function parseAcres($) {
  const acresStr = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl11_pnlSingleValue span",
  )
    .text()
    .trim();
  const acres = Number(acresStr.replace(/[^0-9.]/g, ""));
  return isNaN(acres) ? null : acres;
}

function parseZoning($) {
  const zs = new Set();
  $("#ctlBodyPane_ctl09_ctl01_gvwLand tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const z = textOf($, tds.eq(6));
    if (z) zs.add(z);
  });
  if (zs.size > 0) return Array.from(zs)[0];
  return null;
}

function parseBuildingInfo($) {
  const baseSelectorLeft =
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary";
  const baseSelectorRight =
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary";

  const type = findRowValueByTh($, baseSelectorLeft, "Type") || null;
  const totalArea = findRowValueByTh($, baseSelectorLeft, "Total Area") || null;
  const heatedArea =
    findRowValueByTh($, baseSelectorLeft, "Heated Area") || null;
  const exteriorWalls =
    findRowValueByTh($, baseSelectorLeft, "Exterior Walls") || null;
  const interiorWalls =
    findRowValueByTh($, baseSelectorLeft, "Interior Walls") || null;
  const roofing = findRowValueByTh($, baseSelectorLeft, "Roofing") || null;
  const roofType = findRowValueByTh($, baseSelectorLeft, "Roof Type") || null;
  const floorCover =
    findRowValueByTh($, baseSelectorLeft, "Floor Cover") || null;

  const heat = findRowValueByTh($, baseSelectorRight, "Heat") || null;
  const hvac = findRowValueByTh($, baseSelectorRight, "HVAC") || null;
  const stories = findRowValueByTh($, baseSelectorRight, "Stories") || null;
  const actYear =
    findRowValueByTh($, baseSelectorRight, "Actual Year Built") || null;
  const effYear =
    findRowValueByTh($, baseSelectorRight, "Effective Year Built") || null;
  const bathrooms = findRowValueByTh($, baseSelectorRight, "Bathrooms") || null;
  const bedrooms = findRowValueByTh($, baseSelectorRight, "Bedrooms") || null;

  return {
    type,
    totalArea,
    heatedArea,
    exteriorWalls,
    interiorWalls,
    roofing,
    roofType,
    floorCover,
    heat,
    hvac,
    stories,
    actYear,
    effYear,
    bathrooms,
    bedrooms,
  };
}

function parseSales($) {
  const rows = $("#ctlBodyPane_ctl13_ctl01_grdSales tbody tr");
  const sales = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    const date = textOf($, tds.eq(0));
    const priceStr = textOf($, tds.eq(1));
    const instr = textOf($, tds.eq(2));
    const book = textOf($, tds.eq(3));
    const page = textOf($, tds.eq(4));
    let clerkUrl = null;
    const linkTd = tds.eq(9);
    if (linkTd && linkTd.find("input").length) {
      const onclick = linkTd.find("input").attr("onclick") || "";
      const m = onclick.match(/window\.open\('([^']+)'\)/);
      if (m) clerkUrl = m[1];
    }

    if (date && priceStr) {
      sales.push({
        date,
        price: moneyToNumber(priceStr),
        instrument: instr || null,
        book: book || null,
        page: page || null,
        clerkUrl: clerkUrl || null,
      });
    }
  });
  return sales;
}

function parseValuationsWorking($) {
  const rows = $("#ctlBodyPane_ctl06_ctl01_grdValuation tbody tr");
  const map = {};
  rows.each((i, tr) => {
    const th = $(tr).find("th").first();
    const label = textOf($, th);
    const td = $(tr).find("td").first();
    const val = textOf($, td);
    map[label] = val;
  });
  if (Object.keys(map).length === 0) return null;
  return {
    year: 2025,
    improvement: moneyToNumber(map["Improvement Value"]) || null,
    land: moneyToNumber(map["Land Value"]) || null,
    justMarket: moneyToNumber(map["Just (Market) Value"]) || null,
    assessed: moneyToNumber(map["Assessed Value"]) || null,
    taxable: moneyToNumber(map["Taxable Value"]) || null,
  };
}

function parseValuationsCertified($) {
  const table = $("#ctlBodyPane_ctl07_ctl01_grdValuation_grdYearData");
  if (!table || table.length === 0) return [];
  const years = [];
  table.find("thead th.value-column").each((i, th) => {
    const y = parseIntSafe($(th).text());
    if (y) years.push(y);
  });
  const rowMap = {}; // label -> array of column strings
  table.find("tbody tr").each((i, tr) => {
    const label = $(tr).find("th").first().text().trim();
    const vals = [];
    $(tr)
      .find("td.value-column")
      .each((j, td) => vals.push($(td).text().trim()));
    rowMap[label] = vals;
  });
  const labelFor = (primary, fallback) => {
    if (rowMap.hasOwnProperty(primary)) return primary;
    if (fallback && rowMap.hasOwnProperty(fallback)) return fallback;
    return null;
  };
  const lblJust = labelFor("Just Market Value");
  const lblLand = labelFor("Land Value");
  const lblImpr = labelFor("Improvement Value");
  const lblAssessed = labelFor(
    "School Assessed Value",
    "Non School Assessed Value",
  );
  const lblTaxable = labelFor(
    "School Taxable Value",
    "Non School Taxable Value",
  );

  const out = [];
  years.forEach((year, colIdx) => {
    const rec = {
      year,
      improvement: lblImpr
        ? moneyToNumber((rowMap[lblImpr] || [])[colIdx])
        : null,
      land: lblLand ? moneyToNumber((rowMap[lblLand] || [])[colIdx]) : null,
      justMarket: lblJust
        ? moneyToNumber((rowMap[lblJust] || [])[colIdx])
        : null,
      assessed: lblAssessed
        ? moneyToNumber((rowMap[lblAssessed] || [])[colIdx])
        : null,
      taxable: lblTaxable
        ? moneyToNumber((rowMap[lblTaxable] || [])[colIdx])
        : null,
    };
    out.push(rec);
  });
  return out;
}

function toISOFromMDY(mdy) {
  if (!mdy) return null;
  const m = mdy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Exterior Wall Material mapping
function mapExteriorWallMaterial(material) {
  if (!material) return null;

  const exteriorWallMap = {
    "ABOVE AVERAGE": "Wood Siding",
    "ALUMINUM SIDNG": "Metal Siding",
    "ASBESTOS": "Fiber Cement Siding",
    "AVERAGE": "Wood Siding",
    "BD AND BAT AAV": "Wood Siding",
    "BELOW AVERAGE": "Wood Siding",
    "BOARD & BATTEN": "Wood Siding",
    "CB STUCCO": "Stucco",
    "CEDAR/REDWOOD": "Wood Siding",
    "CEMENT BRICK": "Brick",
    "COMMON BRICK": "Brick",
    "CONCRETE BLOCK": "Concrete Block",
    "CORR ASBESTOS": "Fiber Cement Siding",
    "CORR METAL": "Metal Siding",
    "FACE BRICK": "Brick",
    "GLASS/THERMO.": "Curtain Wall",
    "HARDIBOARD": "Fiber Cement Siding",
    "MINIMUM": "Wood Siding",
    "MODULAR METAL": "Metal Siding",
    "N/A": "Wood Siding",
    "NONE": "Wood Siding",
    "PRECAST PANEL": "Precast Concrete",
    "PRE-FAB PANEL": "Precast Concrete",
    "PRE-FINSH METL": "Metal Siding",
    "REINF CONCRETE": "Precast Concrete",
    "SINGLE SIDING": "Wood Siding",
    "STONE": "Natural Stone",
    "TILE/WD STUCCO": "Stucco",
    "WALL BOARD": "EIFS",
    "WOOD SHEATH": "Wood Siding",
    "WOOD SHINGLE": "Wood Siding"
  };

  const upperMaterial = material.toUpperCase();
  return exteriorWallMap[upperMaterial] || null;
}

// Property Type mapping based on Building Type
function getPropertyType(buildingType) {
  if (!buildingType) {
    console.error(`ERROR: Building type is missing or null. Cannot determine property type.`);
    throw new Error(`Building type is required but was not provided`);
  }

  const propertyTypeMap = {
    "VACANT LAND": "VacantLand",
    "SINGLE FAMILY": "SingleFamily",
    "SFR - MFG": "ManufacturedHousing",
    "SFR - ZERO LOT": "SingleFamily",
    "CONDO": "Condominium",
    "MH PRE 1977": "MobileHome",
    "MH POST 1977": "ManufacturedHousing",
    "MFR LOW RISE": "MultipleFamily",
    "MFR HI RISE": "MultipleFamily",
    "MFR TOWN HOUSE": "Townhouse",
    "APARTMENT": "MultipleFamily",
    "DUPLEX": "Duplex",
    "TRI/QUADRAPLEX": "TwoToFourFamily",
    "NURS/CONV HOME": "Retirement",
    "ASSISTED LIVING": "Retirement"
  };

  const mappedType = propertyTypeMap[buildingType.toUpperCase()];

  if (!mappedType) {
    console.error(`ERROR: Building type "${buildingType}" is not supported by our Lexicon. Please add this mapping to the property type configuration.`);
    throw new Error(`Unsupported building type: ${buildingType}`);
  }

  return mappedType;
}

function normalizeOwner(owner, ownersByDate) {
  try {
    const current = ownersByDate && ownersByDate.current;
    if (!current || !Array.isArray(current)) return owner;
    const matches = current.filter(
      (c) =>
        c.type === "person" &&
        c.last_name &&
        owner.last_name &&
        c.last_name.toLowerCase() === owner.last_name.toLowerCase(),
    );
    for (const c of matches) {
      if (!owner.first_name) continue;
      if (
        c.first_name &&
        c.first_name.toLowerCase().startsWith(owner.first_name.toLowerCase())
      ) {
        return {
          ...owner,
          first_name: c.first_name || owner.first_name,
          middle_name:
            c.middle_name != null ? c.middle_name : owner.middle_name,
        };
      }
    }
  } catch {}
  return owner;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = readText("input.html");
  const $ = cheerio.load(html);

  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  let ownersData = null,
    utilsData = null,
    layoutData = null;
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch {}
  try {
    utilsData = readJSON(path.join("owners", "utilities_data.json"));
  } catch {}
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch {}

  const parcelId =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue span",
    )
      .text()
      .trim() ||
    (seed && seed.parcel_id) ||
    null;
  const propIdStr = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl01_pnlSingleValue span",
  )
    .text()
    .trim();
  const propId = parseIntSafe(propIdStr);

  const binfo = parseBuildingInfo($);
  const legalDesc =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl07_pnlSingleValue span",
    )
      .text()
      .trim() || null;
  const subdivision =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl06_pnlSingleValue span",
    )
      .text()
      .trim() || null;
  const zoning = parseZoning($);
  const acres = parseAcres($);

  // Property type is required - will throw error if unmappable
  const propertyType = getPropertyType(binfo.type);

  const property = {
    parcel_identifier: parcelId || "",
    property_type: propertyType,
    number_of_units_type: binfo.type === "DUPLEX" ? "Two" :
                          binfo.type === "TRI/QUADRAPLEX" ? "TwoToFour" : "One",
    property_structure_built_year: parseIntSafe(binfo.actYear),
    property_effective_built_year: parseIntSafe(binfo.effYear),
    livable_floor_area: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    total_area: binfo.totalArea ? `${parseIntSafe(binfo.totalArea).toLocaleString()} sq ft` : null,
    area_under_air: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision && subdivision.length ? subdivision : null,
    zoning: zoning || null,
    number_of_units: binfo.type === "DUPLEX" ? 2 :
                     binfo.type === "TRI/QUADRAPLEX" ? 3 : 1,
    historic_designation: false,
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/Application.aspx"
    },
    request_identifier: parcelId || null,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Structure from building information
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: mapExteriorWallMaterial(binfo.exteriorWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,  // Set to null as we don't have valid enum mappings
    flooring_material_secondary: null,  // Set to null as we don't have valid enum mappings
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: binfo.interiorWalls === "DRYWALL" ? "Drywall" : null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: binfo.roofing === "ASPHALT" ? "Architectural Asphalt Shingle" : null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: binfo.roofType === "GABLE/HIP" ? "Gable" : null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: binfo.roofing === "ASPHALT" ? "Shingle" : null,
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
    number_of_stories: parseFloat(binfo.stories) || null,
    finished_base_area: parseIntSafe(binfo.heatedArea),
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Layouts from owners/layout_data.json (if any)
  const ownersKey = `property_${parcelId}`;
  const layouts = layoutData && layoutData[ownersKey] && Array.isArray(layoutData[ownersKey].layouts)
    ? layoutData[ownersKey].layouts
    : [];

  if (layouts && layouts.length) {
    layouts.forEach((layout, idx) => {
      writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), layout);
    });
  }

  // Address: Prefer unnormalized_address.full_address
  const addrFromHTML = parseLocationAddressFromHTML($);
  let streetLine = null;
  let cityStateZipLine = null;
  if (unaddr && unaddr.full_address) {
    const parts = unaddr.full_address.split(",");
    streetLine = parts[0] ? parts[0].trim() : null;
    cityStateZipLine = parts.slice(1).join(",").trim(); // includes city, state, zip
    if (!cityStateZipLine) cityStateZipLine = addrFromHTML.addrLine2 || null;
  } else {
    streetLine = addrFromHTML.addrLine1 || null;
    cityStateZipLine = addrFromHTML.addrLine2 || null;
  }
  const streetParts = parseStreetLine(streetLine);
  const cityParts = parseCityStateZip(cityStateZipLine);
  const strSecTwpRng = parseSecTwpRng($);

  const address = {
    street_number: streetParts.street_number || null,
    street_name: streetParts.street_name || null,
    street_suffix_type: streetParts.street_suffix_type || null,
    street_pre_directional_text:
      streetParts.street_pre_directional_text || null,
    street_post_directional_text: null,
    city_name: cityParts.city_name || null,
    state_code: cityParts.state_code || null,
    postal_code: cityParts.postal_code || null,
    plus_four_postal_code: null,
    country_code: "US",
    county_name: (unaddr && unaddr.county_jurisdiction) || "Alachua",
    latitude: null,
    longitude: null,
    unit_identifier: null,
    route_number: null,
    township: strSecTwpRng.township,
    range: strSecTwpRng.range,
    section: strSecTwpRng.section,
    lot: null,
    block: null,
    municipality_name: null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  const lot = {
    lot_type:
      acres != null && acres > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre",
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: acres != null && acres > 0 ? Math.round(acres * 43560) : null,
    lot_size_acre: acres,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // Create property relationships
  writeJSON(path.join(dataDir, "relationship_property_address.json"), {
    from: "property",
    to: "address"
  });

  writeJSON(path.join(dataDir, "relationship_property_lot.json"), {
    from: "property",
    to: "lot"
  });

  writeJSON(path.join(dataDir, "relationship_property_structure.json"), {
    from: "property",
    to: "structure"
  });

  // Layout relationships
  if (layouts && layouts.length) {
    layouts.forEach((layout, idx) => {
      writeJSON(path.join(dataDir, `relationship_property_layout_${idx + 1}.json`), {
        from: "property",
        to: `layout_${idx + 1}`
      });
    });
  }

  const work = parseValuationsWorking($);
  if (work) {
    const tax = {
      tax_year: work.year,
      property_assessed_value_amount: work.assessed || null,
      property_market_value_amount: work.justMarket || null,
      property_building_amount: work.improvement || null,
      property_land_amount: work.land || null,
      property_taxable_value_amount: work.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${work.year}.json`), tax);
  }

  const certs = parseValuationsCertified($);
  certs.forEach((rec) => {
    const tax = {
      tax_year: rec.year,
      property_assessed_value_amount: rec.assessed || null,
      property_market_value_amount: rec.justMarket || null,
      property_building_amount: rec.improvement || null,
      property_land_amount: rec.land || null,
      property_taxable_value_amount: rec.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${rec.year}.json`), tax);
  });

  const sales = parseSales($);
  const salesSorted = sales.sort(
    (a, b) => new Date(toISOFromMDY(b.date)) - new Date(toISOFromMDY(a.date)),
  );

  const saleFileRefs = [];
  salesSorted.forEach((s, idx) => {
    const iso = toISOFromMDY(s.date) || null;
    const saleIdx = idx + 1;
    const saleObj = {
      ownership_transfer_date: iso,
      purchase_price_amount: s.price || 0,
    };
    writeJSON(path.join(dataDir, `sales_${saleIdx}.json`), saleObj);

    let deedType = null;
    if (s.instrument && s.instrument.toUpperCase() === "WD")
      deedType = "Warranty Deed";
    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    writeJSON(path.join(dataDir, `deed_${saleIdx}.json`), deedObj);

    if (s.clerkUrl) {
      const fileObj = {
        file_format: "txt",
        name: `${(iso || "").slice(0, 4)} Clerk Link`,
        original_url: s.clerkUrl,
        ipfs_url: null,
        document_type:
          deedType === "Warranty Deed"
            ? "ConveyanceDeedWarrantyDeed"
            : "ConveyanceDeed",
      };
      writeJSON(path.join(dataDir, `file_${saleIdx}.json`), fileObj);

      const relDF = {
        to: { "/": `./deed_${saleIdx}.json` },
        from: { "/": `./file_${saleIdx}.json` },
      };
      writeJSON(
        path.join(dataDir, `relationship_deed_file_${saleIdx}.json`),
        relDF,
      );
    }

    const relSD = {
      to: { "/": `./sales_${saleIdx}.json` },
      from: { "/": `./deed_${saleIdx}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_deed_${saleIdx}.json`),
      relSD,
    );

    if (iso) saleFileRefs.push({ saleIdx, dateISO: iso });
  });

  const personFiles = [];
  if (ownersData && propId && ownersData[`property_${propId}`]) {
    const ob = ownersData[`property_${propId}`].owners_by_date || {};
    const saleDatesISO = new Map(
      saleFileRefs.map((x) => [x.dateISO, x.saleIdx]),
    );
    Object.keys(ob).forEach((dateKey) => {
      const iso = dateKey; // dates in owners file are ISO format
      if (iso && saleDatesISO.has(iso)) {
        const saleIdx = saleDatesISO.get(iso);
        const ownersArr = ob[dateKey] || [];
        ownersArr.forEach((owner) => {
          if (owner.type === "person") {
            const normalized = normalizeOwner(owner, ob);
            const pIdx = personFiles.length + 1;
            const person = {
              birth_date: null,
              first_name: normalized.first_name || "",
              last_name: normalized.last_name || "",
              middle_name: normalized.middle_name || null,
              prefix_name: null,
              suffix_name: null,
              us_citizenship_status: null,
              veteran_status: null,
            };
            const pPath = path.join(dataDir, `person_${pIdx}.json`);
            writeJSON(pPath, person);
            personFiles.push({ path: `./person_${pIdx}.json`, saleIdx });
          }
        });
      }
    });
  }

  personFiles.forEach((pf, i) => {
    const rel = {
      to: { "/": pf.path },
      from: { "/": `./sales_${pf.saleIdx}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_person_${i + 1}.json`),
      rel,
    );
  });
}

main();
