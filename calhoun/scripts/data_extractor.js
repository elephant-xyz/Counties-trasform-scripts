// scripts/data_extractor.js
// Extraction script per instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - All others from input.html

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span"; // Corrected to target the span containing the Parcel ID
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_divSummary table.tabular-data-two-column tbody tr"; // Corrected selector for Parcel Summary table
const BUILDING_SECTION_TITLE = "Building Information"; // Corrected title from HTML
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl06_ctl01_grdSales tbody tr"; // Corrected selector for sales table
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl08_ctl01_grdValuation"; // Corrected selector for valuation table


function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function cleanupLayoutStructureUtilityArtifacts() {
  if (!fs.existsSync("data")) return;
  const legacyFiles = new Set(["utility.json"]);
  const patterns = [
    /^layout_\d+\.json$/i,
    /^structure_\d+\.json$/i,
    /^utility_\d+\.json$/i,
    /^relationship_.*_has_layout_.*\.json$/i,
    /^relationship_.*_has_structure_.*\.json$/i,
    /^relationship_.*_has_utility_.*\.json$/i,
  ];
  fs.readdirSync("data").forEach((file) => {
    const shouldRemove =
      legacyFiles.has(file) || patterns.some((pattern) => pattern.test(file));
    if (shouldRemove) {
      fs.unlinkSync(path.join("data", file));
    }
  });
}

function writeRelationshipFile(fromFileName, toFileName) {
  const fromBase = fromFileName.replace(/\.json$/i, "");
  const toBase = toFileName.replace(/\.json$/i, "");
  const relName = `relationship_${fromBase}_has_${toBase}.json`;
  const relPath = path.join("data", relName);
  const relationship = {
    from: {
      "/": `./${fromFileName}`,
    },
    to: {
      "/": `./${toFileName}`,
    },
  };
  writeJSON(relPath, relationship);
}

function extractMappedRecord(entry, nestedKey) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const nested =
    nestedKey && entry[nestedKey] && typeof entry[nestedKey] === "object"
      ? entry[nestedKey]
      : entry;
  const data = { ...nested };
  const buildingNumber =
    entry.building_number ?? entry.buildingNumber ?? null;
  return { data, buildingNumber };
}

function createDefaultLayoutRecord() {
  return {
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    built_year: null,
    cabinet_style: null,
    clutter_level: null,
    condition_issues: null,
    countertop_material: null,
    decor_elements: null,
    design_style: null,
    fixture_finish_quality: null,
    floor_level: null,
    flooring_installation_date: null,
    flooring_material_type: null,
    flooring_wear: null,
    furnished: null,
    has_windows: null,
    heated_area_sq_ft: null,
    installation_date: null,
    is_exterior: false,
    is_finished: null,
    kitchen_renovation_date: null,
    lighting_features: null,
    livable_area_sq_ft: null,
    natural_light_quality: null,
    paint_condition: null,
    pool_condition: null,
    pool_equipment: null,
    pool_installation_date: null,
    pool_surface_type: null,
    pool_type: null,
    pool_water_quality: null,
    request_identifier: null,
    safety_features: null,
    size_square_feet: null,
    spa_installation_date: null,
    spa_type: null,
    space_index: null,
    space_type: null,
    space_type_index: null,
    story_type: null,
    total_area_sq_ft: null,
    view_type: null,
    visible_damage: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    building_number: null,
  };
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    const mm2 = mm.padStart(2, "0");
    const dd2 = dd.padStart(2, "0");
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function textOf($el) {
  if (!$el || $el.length === 0) return null;
  return $el.text().trim();
}

function loadHTML() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

// Helper function to get label text, trying th then td
function getLabelText($row) {
  let label = textOf($row.find("th:first-child"));
  if (!label) {
    label = textOf($row.find("td:first-child"));
  }
  return label;
}

function extractLegalDescription($) {
  let desc = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("brief tax description")) { // Corrected label
      desc = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("property use code")) {
      code = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  return code || null;
}

const PROPERTY_ATTRIBUTE_DEFAULTS = Object.freeze({
  property_type: "Building",
  build_status: "Improved",
  structure_form: null,
  property_usage_type: "Unknown",
  ownership_estate_type: "FeeSimple",
});

const PROPERTY_ENUM_SETS = Object.freeze({
  property_type: new Set(["LandParcel", "Building", "Unit", "ManufacturedHome"]),
  build_status: new Set(["VacantLand", "Improved", "UnderConstruction"]),
  structure_form: new Set([
    "SingleFamilyDetached",
    "SingleFamilySemiDetached",
    "TownhouseRowhouse",
    "Duplex",
    "Triplex",
    "Quadplex",
    "MultiFamily5Plus",
    "ApartmentUnit",
    "Loft",
    "ManufacturedHomeOnLand",
    "ManufacturedHomeInPark",
    "MultiFamilyMoreThan10",
    "MultiFamilyLessThan10",
    "MobileHome",
    "ManufacturedHousingMultiWide",
    "ManufacturedHousing",
    "ManufacturedHousingSingleWide",
    "Modular",
    null,
  ]),
  property_usage_type: new Set([
    "Residential",
    "Commercial",
    "Industrial",
    "Agricultural",
    "Recreational",
    "Conservation",
    "Retirement",
    "ResidentialCommonElementsAreas",
    "DrylandCropland",
    "HayMeadow",
    "CroplandClass2",
    "CroplandClass3",
    "TimberLand",
    "GrazingLand",
    "OrchardGroves",
    "Poultry",
    "Ornamentals",
    "Church",
    "PrivateSchool",
    "PrivateHospital",
    "HomesForAged",
    "NonProfitCharity",
    "MortuaryCemetery",
    "ClubsLodges",
    "SanitariumConvalescentHome",
    "CulturalOrganization",
    "Military",
    "ForestParkRecreation",
    "PublicSchool",
    "PublicHospital",
    "GovernmentProperty",
    "RetailStore",
    "DepartmentStore",
    "Supermarket",
    "ShoppingCenterRegional",
    "ShoppingCenterCommunity",
    "OfficeBuilding",
    "MedicalOffice",
    "TransportationTerminal",
    "Restaurant",
    "FinancialInstitution",
    "ServiceStation",
    "AutoSalesRepair",
    "MobileHomePark",
    "WholesaleOutlet",
    "Theater",
    "Entertainment",
    "Hotel",
    "RaceTrack",
    "GolfCourse",
    "LightManufacturing",
    "HeavyManufacturing",
    "LumberYard",
    "PackingPlant",
    "Cannery",
    "MineralProcessing",
    "Warehouse",
    "OpenStorage",
    "Utility",
    "RiversLakes",
    "SewageDisposal",
    "Railroad",
    "TransitionalProperty",
    "ReferenceParcel",
    "NurseryGreenhouse",
    "AgriculturalPackingFacility",
    "LivestockFacility",
    "Aquaculture",
    "VineyardWinery",
    "DataCenter",
    "TelecommunicationsFacility",
    "SolarFarm",
    "WindFarm",
    "NativePasture",
    "ImprovedPasture",
    "Rangeland",
    "PastureWithTimber",
    "Unknown",
    null,
  ]),
  ownership_estate_type: new Set([
    "Condominium",
    "Cooperative",
    "LifeEstate",
    "Timeshare",
    "OtherEstate",
    "FeeSimple",
    "Leasehold",
    "RightOfWay",
    "NonWarrantableCondo",
    "SubsurfaceRights",
    null,
  ]),
});

const PROPERTY_USE_CODE_MAPPING = Object.freeze({
  "ARENA/BARN": { property_usage_type: "LivestockFacility" },
  CAMPS: { property_usage_type: "Recreational" },
  CHURCHES: { property_usage_type: "Church" },
  "CHURCHES, XF": { property_usage_type: "Church" },
  "CLUBS/LODGES/HALLS": { property_usage_type: "ClubsLodges" },
  "COMMUNITY SHOPPING": { property_usage_type: "ShoppingCenterCommunity" },
  COUNTY: { property_usage_type: "GovernmentProperty" },
  "COUNTY, VAC": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "COUNTY, XF": { property_usage_type: "GovernmentProperty" },
  "CROPLAND CLASS 1": {
    property_usage_type: "DrylandCropland",
    property_type: "LandParcel",
  },
  "CROPLAND CLASS 2": {
    property_usage_type: "CroplandClass2",
    property_type: "LandParcel",
  },
  "CROPLAND CLASS 3": {
    property_usage_type: "CroplandClass3",
    property_type: "LandParcel",
  },
  FEDERAL: { property_usage_type: "GovernmentProperty" },
  "FINANCIAL BLDG": { property_usage_type: "FinancialInstitution" },
  "FLORIST/GREENHOUSE": { property_usage_type: "NurseryGreenhouse" },
  "FOREST, PARKS, REC": {
    property_usage_type: "ForestParkRecreation",
    property_type: "LandParcel",
  },
  "HEAVY MANUFACTURE": { property_usage_type: "HeavyManufacturing" },
  "HOMES FOR THE AGED": { property_usage_type: "HomesForAged" },
  "HOTELS AND MOTELS": { property_usage_type: "Hotel" },
  "IMP AG MIXED USE": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
  },
  "IMPROVED AG": {
    property_usage_type: "ImprovedPasture",
    property_type: "LandParcel",
  },
  "INSURANCE COMPANY": { property_usage_type: "FinancialInstitution" },
  "LIGHT MANUFACTURE": { property_usage_type: "LightManufacturing" },
  "LIGHT MANUFCTR, XF": { property_usage_type: "LightManufacturing" },
  "LUMBER YARD": { property_usage_type: "LumberYard" },
  "MH TAG": {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHomeInPark",
    ownership_estate_type: "OtherEstate",
  },
  "MOBILE HOME": {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHomeOnLand",
  },
  "MORTUARY/CEMETARY": {
    property_usage_type: "MortuaryCemetery",
    property_type: "LandParcel",
  },
  "MULTI STORY OFFICE": { property_usage_type: "OfficeBuilding" },
  "MULTI-FAMILY": {
    property_usage_type: "Residential",
    structure_form: "MultiFamily5Plus",
  },
  MUNICIPAL: { property_usage_type: "GovernmentProperty" },
  "MUNICIPAL, VAC": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "MUNICIPAL, XF": { property_usage_type: "GovernmentProperty" },
  "NIGHTCLUB/BARS": { property_usage_type: "Entertainment" },
  "NO AG ACREAGE": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
  },
  "NO AG AC-XF": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
  },
  "NON-PROFIT SERVICE": { property_usage_type: "NonProfitCharity" },
  "OFFICE BLDGS, XF": { property_usage_type: "OfficeBuilding" },
  "OFFICE BUILDINGS": { property_usage_type: "OfficeBuilding" },
  "OPEN STORAGE": {
    property_usage_type: "OpenStorage",
    property_type: "LandParcel",
  },
  "ORNAMENTALS,MISC": {
    property_usage_type: "Ornamentals",
    property_type: "LandParcel",
  },
  "PACKING PLANTS": { property_usage_type: "PackingPlant" },
  "PARKING/MH LOT": {
    property_usage_type: "MobileHomePark",
    property_type: "LandParcel",
  },
  "PASTURELAND 1": {
    property_usage_type: "NativePasture",
    property_type: "LandParcel",
  },
  "PASTURELAND 2": {
    property_usage_type: "ImprovedPasture",
    property_type: "LandParcel",
  },
  "PASTURELAND 3": {
    property_usage_type: "GrazingLand",
    property_type: "LandParcel",
  },
  "PASTURELAND 4": {
    property_usage_type: "PastureWithTimber",
    property_type: "LandParcel",
  },
  "PASTURELAND 5": {
    property_usage_type: "PastureWithTimber",
    property_type: "LandParcel",
  },
  "POULTRY,BEES,FISH": {
    property_usage_type: "LivestockFacility",
    property_type: "LandParcel",
  },
  "PRIVATE HOSPITALS": { property_usage_type: "PrivateHospital" },
  "PRIVATE SCHOOLS": { property_usage_type: "PrivateSchool" },
  "PROFESSIONAL BLDG": { property_usage_type: "OfficeBuilding" },
  "PUBLIC SCHOOLS": { property_usage_type: "PublicSchool" },
  "PUBLIC SCHOOLS,XF": { property_usage_type: "PublicSchool" },
  "RACE TRACKS": {
    property_usage_type: "RaceTrack",
    property_type: "LandParcel",
  },
  "RACE TRACKS, XF": {
    property_usage_type: "RaceTrack",
    property_type: "LandParcel",
  },
  "REC AND PARK LAND": {
    property_usage_type: "ForestParkRecreation",
    property_type: "LandParcel",
  },
  "REPAIR SERVICE": { property_usage_type: "AutoSalesRepair" },
  "RESTAURANTS/CAFE": { property_usage_type: "Restaurant" },
  "RETIREMENT HOMES": { property_usage_type: "Retirement" },
  "RIGHTS-OF-WAY": {
    property_usage_type: "TransportationTerminal",
    property_type: "LandParcel",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
  },
  "RIVERS AND LAKES": {
    property_usage_type: "RiversLakes",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "SERVICE STATION": { property_usage_type: "ServiceStation" },
  "SERVICE STATION, XF": { property_usage_type: "ServiceStation" },
  "SINGLE FAMILY": {
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  },
  STATE: { property_usage_type: "GovernmentProperty" },
  "STATE TIITF": { property_usage_type: "GovernmentProperty" },
  "STATE, VAC": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "STORE, XF": { property_usage_type: "RetailStore" },
  "STORE/OFFICE/RESID": { property_usage_type: "RetailStore" },
  "STORES, 1 STORY": { property_usage_type: "RetailStore" },
  "SUB-SURFACE RIGHTS": {
    property_usage_type: "Unknown",
    property_type: "LandParcel",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
  },
  SUPERMARKET: { property_usage_type: "Supermarket" },
  "TIMBERLAND 50-59": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  "TIMBERLAND 60-69": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  "TIMBERLAND 70-79": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  "TIMBERLAND 80-89": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  "TIMBERLAND 90+": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  "TIMBERLAND UNCLASS": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
  },
  UTILITIES: { property_usage_type: "Utility" },
  "VAC XF": {
    property_usage_type: "Unknown",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  VACANT: {
    property_usage_type: "Unknown",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "VACANT COMM, XF": {
    property_usage_type: "Commercial",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "VACANT COMMERCIAL": {
    property_usage_type: "Commercial",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "VEH REPAIR, XF": { property_usage_type: "AutoSalesRepair" },
  "VEH SALE/REPAIR": { property_usage_type: "AutoSalesRepair" },
  WAREHOUSE: { property_usage_type: "Warehouse" },
  "WAREHOUSE, XF": { property_usage_type: "Warehouse" },
  "WASTELAND/DUMPS": {
    property_usage_type: "TransitionalProperty",
    property_type: "LandParcel",
    build_status: "VacantLand",
  },
  "WATER MANAGMENT": {
    property_usage_type: "Utility",
    property_type: "LandParcel",
  },
  "WHOLESALE OUTLET": { property_usage_type: "WholesaleOutlet" },
});

function normalizePropertyUseCode(raw) {
  if (!raw) return null;
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function ensureEnumValue(field, value) {
  if (value == null) return null;
  const allowed = PROPERTY_ENUM_SETS[field];
  if (!allowed || allowed.has(value)) return value;
  throw {
    type: "error",
    message: `Invalid value "${value}" for property field "${field}".`,
    path: `property.${field}`,
  };
}

function mapPropertyAttributesFromUseCode(code) {
  const normalized = normalizePropertyUseCode(code);
  if (!normalized) {
    throw {
      type: "error",
      message: "Property Use Code not found in the source HTML.",
      path: "property.property_type",
    };
  }
  const mapping = PROPERTY_USE_CODE_MAPPING[normalized];
  if (!mapping) {
    throw {
      type: "error",
      message: `Unknown Property Use Code mapping for: ${normalized}.`,
      path: "property.property_type",
    };
  }
  const merged = {
    ...PROPERTY_ATTRIBUTE_DEFAULTS,
    ...mapping,
  };
  const property_type = ensureEnumValue("property_type", merged.property_type);
  const build_status = ensureEnumValue("build_status", merged.build_status);
  const structure_form = ensureEnumValue("structure_form", merged.structure_form);
  const property_usage_type = ensureEnumValue(
    "property_usage_type",
    merged.property_usage_type,
  );
  const ownership_estate_type = ensureEnumValue(
    "ownership_estate_type",
    merged.ownership_estate_type,
  );
  if (!property_type) {
    throw {
      type: "error",
      message: `Property type could not be resolved for code: ${normalized}.`,
      path: "property.property_type",
    };
  }
  return {
    property_type,
    build_status,
    structure_form,
    property_usage_type,
    ownership_estate_type,
  };
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;

  // Helper to get label text from either th or td strong
  const getBuildingLabelText = ($row) => {
    let label = textTrim($row.find("th strong").first().text());
    if (!label) {
      label = textTrim($row.find("td strong").first().text());
    }
    return label;
  };

  // Find all building blocks within the section
  const buildingBlocks = section.find(".block-row");

  buildingBlocks.each((blockIndex, blockElement) => {
    const currentBuildingData = {};

    // Collect data from the left column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const $tr = $(tr);
            const label = getBuildingLabelText($tr);
            const value = textTrim($tr.find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    // Collect data from the right column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const $tr = $(tr);
            const label = getBuildingLabelText($tr);
            const value = textTrim($tr.find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    if (Object.keys(currentBuildingData).length) {
      buildings.push(currentBuildingData);
    }
  });
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function extractBuildingYears($) {
  const buildings = collectBuildings($);
  const yearsActual = [];
  // The HTML does not provide "Effective Year Built" directly in the building summary.
  // We will only extract "Actual Year Built".
  buildings.forEach((b) => {
    yearsActual.push(toInt(b["Actual Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: null, // Not available in the provided HTML
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
  buildings.forEach((b) => {
    // Use "Total Area" from the building information
    total += toInt(b["Total Area"]);
  });
  return total;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const $tr = $(tr);
    // The sales table structure is:
    // <th>Multi Parcel</th> <td>Sale Date</td> <td>Sale Price</td> <td>Instrument</td> <td>Book/Page</td> <td>Qualification</td> <td>Reason</td> <td>Vacant/Improved</td> <td>Grantor</td> <td>Grantee</td>
    // So, Sale Date is the 2nd column (index 1), Sale Price is 3rd (index 2), Instrument is 4th (index 3), Book/Page is 5th (index 4), Grantor is 9th (index 8), Grantee is 10th (index 9)
    const tds = $tr.find("td");
    const saleDate = textOf(tds.eq(0)); // Sale Date is the first td after the th
    const salePrice = textOf(tds.eq(1));
    const instrument = textOf(tds.eq(2));
    const bookPageLinkElement = tds.eq(3).find("a");
    const bookPageText = textOf(bookPageLinkElement);
    const link = bookPageLinkElement.attr("href") || null;
    const qualification = textOf(tds.eq(4));
    const reason = textOf(tds.eq(5));
    const vacantImproved = textOf(tds.eq(6));
    const grantor = textOf(tds.eq(7));
    const grantee = textOf(tds.eq(8));

    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage: bookPageText,
      link,
      qualification,
      reason,
      vacantImproved,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u === "TD") return "Tax Deed";
  if (u === "QC") return "Quitclaim Deed";
  if (u === "SW" || u === "SWD") return "Special Warranty Deed";
  if (u === "PR" || u === "PRD") return "Personal Representative Deed";
  if (u === "TR" || u === "TDG" || u === "TRD") return "Trustee's Deed";
  if (u === "SHD" || u === "SD") return "Sheriff's Deed";
  if (u === "GWD") return "Grant Deed";
  if (u === "B&S" || u === "BSD") return "Bargain and Sale Deed";
  // Add other deed types as needed based on data
  return null;
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  // The valuation table has a header row with year columns
  const headerRow = table.find("thead tr");
  headerRow.find("th.value-column").each((i, th) => {
    const yearText = textOf($(th));
    const yearMatch = yearText.match(/(\d{4})/);
    if (yearMatch) {
      years.push({ year: parseInt(yearMatch[1], 10), idx: i });
    }
  });

  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    // Valuation table labels are always <th>
    const label = textOf($tr.find("th"));
    const tds = $tr.find("td.value-column");
    const vals = [];
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    if (label) dataMap[label] = vals;
  });

  return years.map(({ year, idx }) => {
    const get = (label) => {
      const arr = dataMap[label] || [];
      return arr[idx] || null;
    };
    return {
      year,
      building: get("Building Value"),
      land: get("Land Value"), // Corrected label
      market: get("Just (Market) Value"),
      assessed: get("Assessed Value"),
      taxable: get("Taxable Value"),
    };
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyAttributes = mapPropertyAttributesFromUseCode(useCode);
  const years = extractBuildingYears($);
  const totalArea = extractAreas($);

  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    property_type: propertyAttributes.property_type,
    property_usage_type: propertyAttributes.property_usage_type,
    structure_form: propertyAttributes.structure_form,
    build_status: propertyAttributes.build_status,
    ownership_estate_type: propertyAttributes.ownership_estate_type,
    livable_floor_area: null, // Not directly available in the sample HTML
    total_area: totalArea > 0 ? String(totalArea) : null, // Ensure it matches the pattern ".*\d{2,}.*"
    number_of_units_type: null,
    area_under_air: null, // Not directly available in the sample HTML
    number_of_units: null, // Not directly available in the sample HTML
    subdivision: null, // Not directly available in the sample HTML
    zoning: null, // Not directly available in the sample HTML
  };
  writeJSON(path.join("data", "property.json"), property);
}

function mapDocumentTypeForDeed() {
  return "Title";
}

function mapSaleType(raw) {
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  if (!value.trim()) return null;
  if (value.includes("qual")) {
    if (value.includes("unqual")) return null;
    return "TypicallyMotivated";
  }
  if (value.includes("probate")) return "ProbateSale";
  if (value.includes("reo")) return "ReoPostForeclosureSale";
  if (value.includes("foreclosure"))
    return value.includes("non") || value.includes("court")
      ? "CourtOrderedNonForeclosureSale"
      : "TrusteeJudicialForeclosureSale";
  if (value.includes("relocation")) return "RelocationSale";
  if (value.includes("trustee")) return "TrusteeNonJudicialForeclosureSale";
  if (value.includes("short")) return "ShortSale";
  return null;
}

function buildRelationshipFilename(fromRef, toRef, suffix = null, reverse = false) {
  const clean = (ref) =>
    (ref || "")
      .replace(/^\.\//, "")
      .replace(/\.json$/, "")
      .replace(/\//g, "_");
  const first = reverse ? clean(toRef) : clean(fromRef);
  const second = reverse ? clean(fromRef) : clean(toRef);
  return suffix
    ? `relationship_${first}_${second}_${suffix}.json`
    : `relationship_${first}_${second}.json`;
}

function normalizeBookPageText(text) {
  if (!text) return null;
  return text.replace(/\s+/g, " ").replace(/\bopens in a new tab\b/gi, "").trim();
}

function parseBookPage(text) {
  const normalized = normalizeBookPageText(text);
  if (!normalized) return { book: null, page: null };
  const slashMatch = normalized.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return { book: slashMatch[1], page: slashMatch[2] };
  }
  const spaceMatch = normalized.match(/^(\d+)\s+(\d+)$/);
  if (spaceMatch) {
    return { book: spaceMatch[1], page: spaceMatch[2] };
  }
  return { book: normalized || null, page: null };
}

function writeSalesDeedsFilesAndRelationships($, propertySeed) {
  const sales = extractSales($);
  const requestIdentifier =
    (propertySeed &&
      (propertySeed.request_identifier || propertySeed.parcel_id)) ||
    null;

  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^sales_history_\d+\.json$/.test(f) ||
        /^sales_\d+\.json$/.test(f) ||
        /^deed_\d+\.json$/.test(f) ||
        /^file_\d+\.json$/.test(f) ||
        /^relationship_(?:deed_file)_\d+\.json$/.test(f) ||
        /^relationship_.*_sales_history_.*\.json$/.test(f) ||
        /^relationship_sales_deed_\d+\.json$/.test(f) ||
        /^relationship_sales_history_deed_\d+\.json$/.test(
          f,
        )
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  const salesRecords = [];

  sales.forEach((s, i) => {
    const idx = i + 1;
    const ownershipDate = parseDateToISO(s.saleDate);
    const saleHistory = {
      ownership_transfer_date: ownershipDate,
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
      request_identifier: requestIdentifier,
    };
    const saleType =
      mapSaleType(s.qualification) ?? mapSaleType(s.reason) ?? null;
    if (saleType) {
      saleHistory.sale_type = saleType;
    }
    writeJSON(path.join("data", `sales_history_${idx}.json`), saleHistory);

    const cleanedBookPage = normalizeBookPageText(s.bookPage);
    const { book, page } = parseBookPage(cleanedBookPage);
    const deedType = mapInstrumentToDeedType(s.instrument);
    const deed = {
      request_identifier: requestIdentifier,
    };
    if (book != null) deed.book = book;
    if (page != null) deed.page = page;
    if (deedType) deed.deed_type = deedType;
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    const file = {
      document_type: mapDocumentTypeForDeed(),
      file_format: null,
      ipfs_url: null,
      name: cleanedBookPage ? `Deed ${cleanedBookPage}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", `file_${idx}.json`), file);

    const relDeedFile = {
      to: { "/": `./deed_${idx}.json` },
      from: { "/": `./file_${idx}.json` },
    };
    writeJSON(
      path.join(
        "data",
        buildRelationshipFilename(
          relDeedFile.from["/"],
          relDeedFile.to["/"],
        ),
      ),
      relDeedFile,
    );

    const relSalesHistoryDeed = {
      from: { "/": `./sales_history_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join(
        "data",
        buildRelationshipFilename(
          relSalesHistoryDeed.from["/"],
          relSalesHistoryDeed.to["/"],
        ),
      ),
      relSalesHistoryDeed,
    );

    const parsedBuyers = [];

    salesRecords.push({
      index: idx,
      saleDateISO: ownershipDate,
      granteeRaw: s.grantee || null,
      parsedBuyers,
      historyPath: `./sales_history_${idx}.json`,
    });
  });

  return salesRecords;
}
let people = [];
let companies = [];

function findPersonIndexByName(first, last) {
  const tf = titleCaseName(first);
  const tl = titleCaseName(last);
  for (let i = 0; i < people.length; i++) {
    if (people[i].first_name === tf && people[i].last_name === tl)
      return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  const tn = (name || "").trim();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractOwnerMailingBlocks($) {
  const blocks = [];
  $(".sdw1-owners-container > div").each((_, div) => {
    const $div = $(div);
    const ownerTypeText = textTrim(
      $div.find('[id$="_lblOwnerType"]').first().text() || "",
    ).toLowerCase();
    if (!ownerTypeText || !ownerTypeText.includes("primary owner")) return;
    const addressEl = $div.find('[id$="_lblOwnerAddress"]').first();
    let address = null;
    if (addressEl && addressEl.length) {
      const html = addressEl.html() || "";
      const parts = html
        .split(/<br\s*\/?>/i)
        .map((part) =>
          textTrim(
            part
              .replace(/<[^>]+>/g, "")
              .replace(/&nbsp;/gi, " ")
              .replace(/\s+/g, " "),
          ),
        )
        .filter(Boolean);
      if (parts.length) address = parts.join(", ");
    }
    const names = [];
    $div
      .find('[id*="sprOwnerName"]')
      .each((__, el) => {
        const txtVal = textTrim($(el).text() || "");
        if (!txtVal) return;
        const cleaned = txtVal.replace(/\s*&\s*$/g, "").trim();
        if (cleaned) names.push(cleaned);
      });
    const uniqueNames = Array.from(new Set(names));
    if (address || uniqueNames.length) {
      blocks.push({
        address,
        names: uniqueNames,
      });
    }
  });
  return blocks;
}

function normalizeOwnerDisplayName(str) {
  return (str || "")
    .replace(/&/g, " ")
    .replace(/[^A-Z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildOwnerDisplayName(owner) {
  if (!owner) return null;
  if (owner.type === "company") {
    return normalizeOwnerDisplayName(owner.name || "");
  }
  const parts = [];
  if (owner.last_name) parts.push(owner.last_name);
  if (owner.first_name) parts.push(owner.first_name);
  if (owner.middle_name) parts.push(owner.middle_name);
  return normalizeOwnerDisplayName(parts.join(" "));
}

function cleanupExistingMailingAddressData() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^mailing_address_\d+\.json$/.test(f) ||
        /^relationship_(?:person|company)_\d+_has_mailing_address\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeMailingAddressesForOwners(
  $,
  currentOwners,
  propertySeed,
) {
  cleanupExistingMailingAddressData();
  const blocks = extractOwnerMailingBlocks($);
  const requestIdentifier =
    (propertySeed &&
      (propertySeed.request_identifier || propertySeed.parcel_id)) ||
    null;
  const sourceHttpRequest =
    (propertySeed && propertySeed.source_http_request) || null;

  if (!currentOwners || currentOwners.length === 0) {
    // If there are no current owners, don't create mailing address files
    // Mailing addresses should only exist when they can be linked to owners
    return;
  }

  const ownerDisplayNames = currentOwners.map(buildOwnerDisplayName);
  const assignments = new Array(currentOwners.length).fill(null);

  blocks.forEach((block) => {
    if (!block.address) return;
    let assignedViaName = false;
    const normalizedNames = block.names
      .map((n) => normalizeOwnerDisplayName(n))
      .filter(Boolean);
    normalizedNames.forEach((name) => {
      const idx = ownerDisplayNames.findIndex(
        (display, i) => display && display === name && assignments[i] === null,
      );
      if (idx !== -1) {
        assignments[idx] = block.address;
        assignedViaName = true;
      }
    });
    if (!assignedViaName) {
      const fallbackIdx = assignments.findIndex((val) => val === null);
      if (fallbackIdx !== -1) {
        assignments[fallbackIdx] = block.address;
      }
    }
  });

  const firstAddress =
    blocks.find((b) => b.address && b.address.trim())?.address || null;
  if (firstAddress) {
    for (let i = 0; i < assignments.length; i++) {
      if (!assignments[i]) assignments[i] = firstAddress;
    }
  }

  const addressIndexMap = new Map();
  let mailingCounter = 0;

  assignments.forEach((address) => {
    if (!address) return;
    if (!addressIndexMap.has(address)) {
      mailingCounter += 1;
      addressIndexMap.set(address, mailingCounter);
      const mailingObj = {
        unnormalized_address: address,
        latitude: null,
        longitude: null,
        source_http_request: sourceHttpRequest,
        request_identifier: requestIdentifier,
      };
      writeJSON(
        path.join("data", `mailing_address_${mailingCounter}.json`),
        mailingObj,
      );
    }
  });

  const mailingAddressesUsed = new Set();

  assignments.forEach((address, idx) => {
    if (!address) return;
    const mailingIdx = addressIndexMap.get(address);
    if (!mailingIdx) return;
    const mailingPath = `./mailing_address_${mailingIdx}.json`;
    const owner = currentOwners[idx];
    if (!owner) return;
    if (owner.type === "person") {
      const pIdx = findPersonIndexByName(owner.first_name, owner.last_name);
      if (!pIdx) return;
      mailingAddressesUsed.add(mailingIdx);
      writeJSON(
        path.join(
          "data",
          `relationship_person_${pIdx}_has_mailing_address.json`,
        ),
        {
          from: { "/": `./person_${pIdx}.json` },
          to: { "/": mailingPath },
        },
      );
    } else if (owner.type === "company") {
      const cIdx = findCompanyIndexByName(owner.name);
      if (!cIdx) return;
      mailingAddressesUsed.add(mailingIdx);
      writeJSON(
        path.join(
          "data",
          `relationship_company_${cIdx}_has_mailing_address.json`,
        ),
        {
          from: { "/": `./company_${cIdx}.json` },
          to: { "/": mailingPath },
        },
      );
    }
  });

  // Clean up any mailing address files that don't have relationships
  try {
    fs.readdirSync("data").forEach((f) => {
      const mailingMatch = f.match(/^mailing_address_(\d+)\.json$/);
      if (mailingMatch) {
        const idx = parseInt(mailingMatch[1]);
        if (!mailingAddressesUsed.has(idx)) {
          fs.unlinkSync(path.join("data", f));
        }
      }
    });
  } catch (e) {}
}

function writePersonCompaniesSalesRelationships(
  $,
  parcelId,
  salesRecords,
  propertySeed,
) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^relationship_.*_sales_history_.*\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
  // First pass: collect all person and company names that will actually be linked to sales records or mailing addresses
  const personMap = new Map();
  const companyNamesUsed = new Set();

  // Get valid sales dates to ensure we only process owners from actual sales records
  const validSalesDates = new Set(salesRecords.map(rec => rec.saleDateISO).filter(Boolean));

  // Get current owners who will get mailing addresses
  const currentOwners = ownersByDate["current"] || [];

  // Add persons from current owners (they will get mailing address relationships)
  currentOwners.forEach((o) => {
    if (o.type === "person") {
      const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
      if (!personMap.has(k))
        personMap.set(k, {
          first_name: o.first_name,
          middle_name: o.middle_name,
          last_name: o.last_name,
        });
      else {
        const existing = personMap.get(k);
        if (!existing.middle_name && o.middle_name)
          existing.middle_name = o.middle_name;
      }
    } else if (o.type === "company" && (o.name || "").trim()) {
      // Add companies from current owners (they will get mailing address relationships)
      companyNamesUsed.add((o.name || "").trim());
    }
  });

  // Add persons and companies from sales records (they will get sales_history relationships)
  // ONLY include owners whose date key matches a valid sales record date (excludes "unknown_date_X" entries that have no matching sales_history)
  salesRecords.forEach((rec) => {
    const ownersOnDate =
      (rec.saleDateISO && ownersByDate[rec.saleDateISO]) || [];

    // Add persons from owners on the sale date
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (!personMap.has(k))
          personMap.set(k, {
            first_name: o.first_name,
            middle_name: o.middle_name,
            last_name: o.last_name,
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && o.middle_name)
            existing.middle_name = o.middle_name;
        }
      });

    // Add companies from owners on the sale date
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        if ((o.name || "").trim()) {
          companyNamesUsed.add((o.name || "").trim());
        }
      });

    // Add persons and companies from parsed buyers
    (rec.parsedBuyers || []).forEach((buyer) => {
      if (buyer.type === "person") {
        const k = `${(buyer.first_name || "").trim().toUpperCase()}|${(buyer.last_name || "").trim().toUpperCase()}`;
        if (!personMap.has(k))
          personMap.set(k, {
            first_name: buyer.first_name,
            middle_name: buyer.middle_name,
            last_name: buyer.last_name,
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && buyer.middle_name)
            existing.middle_name = buyer.middle_name;
        }
      } else if (buyer.type === "company" && (buyer.name || "").trim()) {
        companyNamesUsed.add((buyer.name || "").trim());
      }
    });
  });

  // First, create temporary arrays with ALL persons and companies
  const allPersons = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));

  const allCompanies = Array.from(companyNamesUsed).map((n) => ({
    name: n,
    request_identifier: parcelId,
  }));

  // Track which persons and companies actually get relationships
  const personsUsed = new Set();
  const companiesUsed = new Set();

  // Check which persons from current owners will get mailing addresses
  currentOwners.forEach((o) => {
    if (o.type === "person") {
      const tf = titleCaseName(o.first_name);
      const tl = titleCaseName(o.last_name);
      for (let i = 0; i < allPersons.length; i++) {
        if (allPersons[i].first_name === tf && allPersons[i].last_name === tl) {
          personsUsed.add(i + 1);
          break;
        }
      }
    } else if (o.type === "company") {
      const tn = (o.name || "").trim();
      for (let i = 0; i < allCompanies.length; i++) {
        if ((allCompanies[i].name || "").trim() === tn) {
          companiesUsed.add(i + 1);
          break;
        }
      }
    }
  });

  // Check which persons and companies will get sales relationships
  salesRecords.forEach((rec) => {
    const ownersOnDate =
      (rec.saleDateISO && ownersByDate[rec.saleDateISO]) || [];

    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const tf = titleCaseName(o.first_name);
        const tl = titleCaseName(o.last_name);
        for (let i = 0; i < allPersons.length; i++) {
          if (allPersons[i].first_name === tf && allPersons[i].last_name === tl) {
            personsUsed.add(i + 1);
            break;
          }
        }
      });

    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const tn = (o.name || "").trim();
        for (let i = 0; i < allCompanies.length; i++) {
          if ((allCompanies[i].name || "").trim() === tn) {
            companiesUsed.add(i + 1);
            break;
          }
        }
      });

    (rec.parsedBuyers || []).forEach((buyer) => {
      if (buyer.type === "person") {
        const tf = titleCaseName(buyer.first_name);
        const tl = titleCaseName(buyer.last_name);
        for (let i = 0; i < allPersons.length; i++) {
          if (allPersons[i].first_name === tf && allPersons[i].last_name === tl) {
            personsUsed.add(i + 1);
            break;
          }
        }
      } else if (buyer.type === "company") {
        const tn = (buyer.name || "").trim();
        for (let i = 0; i < allCompanies.length; i++) {
          if ((allCompanies[i].name || "").trim() === tn) {
            companiesUsed.add(i + 1);
            break;
          }
        }
      }
    });
  });

  // Only create person and company files for those that will actually be used
  people = [];
  const personIndexMap = new Map(); // Maps old index to new index
  let newPersonIdx = 0;
  allPersons.forEach((p, oldIdx) => {
    if (personsUsed.has(oldIdx + 1)) {
      newPersonIdx++;
      people.push(p);
      personIndexMap.set(oldIdx + 1, newPersonIdx);
      writeJSON(path.join("data", `person_${newPersonIdx}.json`), p);
    }
  });

  companies = [];
  const companyIndexMap = new Map(); // Maps old index to new index
  let newCompanyIdx = 0;
  allCompanies.forEach((c, oldIdx) => {
    if (companiesUsed.has(oldIdx + 1)) {
      newCompanyIdx++;
      companies.push(c);
      companyIndexMap.set(oldIdx + 1, newCompanyIdx);
      writeJSON(path.join("data", `company_${newCompanyIdx}.json`), c);
    }
  });

  // Track which persons and companies actually get relationship files created
  const personsWithRelationships = new Set();
  const companiesWithRelationships = new Set();

  writeMailingAddressesForOwners($, currentOwners, propertySeed);

  // After mailing addresses are written, check which persons/companies have mailing address relationships
  try {
    fs.readdirSync("data").forEach((f) => {
      const personMailMatch = f.match(/^relationship_person_(\d+)_has_mailing_address\.json$/);
      const companyMailMatch = f.match(/^relationship_company_(\d+)_has_mailing_address\.json$/);
      if (personMailMatch) {
        personsWithRelationships.add(parseInt(personMailMatch[1]));
      } else if (companyMailMatch) {
        companiesWithRelationships.add(parseInt(companyMailMatch[1]));
      }
    });
  } catch (e) {}

  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  salesRecords.forEach((rec) => {
    const ownersOnDate =
      (rec.saleDateISO && ownersByDate[rec.saleDateISO]) || [];
    const linked = new Set();
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          linked.add(`person:${pIdx}`);
          personsWithRelationships.add(pIdx);
          writeJSON(
            path.join(
              "data",
              buildRelationshipFilename(
                `./person_${pIdx}.json`,
                rec.historyPath,
                null,
                true,
              ),
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": rec.historyPath },
            },
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx) {
          relCompanyCounter++;
          linked.add(`company:${cIdx}`);
          companiesWithRelationships.add(cIdx);
          writeJSON(
            path.join(
              "data",
              buildRelationshipFilename(
                `./company_${cIdx}.json`,
                rec.historyPath,
                null,
                true,
              ),
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": rec.historyPath },
            },
          );
        }
      });

    (rec.parsedBuyers || []).forEach((buyer) => {
      if (buyer.type === "person") {
        const pIdx = findPersonIndexByName(buyer.first_name, buyer.last_name);
        if (pIdx && !linked.has(`person:${pIdx}`)) {
          relPersonCounter++;
          linked.add(`person:${pIdx}`);
          personsWithRelationships.add(pIdx);
          writeJSON(
            path.join(
              "data",
              buildRelationshipFilename(
                `./person_${pIdx}.json`,
                rec.historyPath,
                null,
                true,
              ),
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": rec.historyPath },
            },
          );
        }
      } else if (buyer.type === "company") {
        const cIdx = findCompanyIndexByName(buyer.name);
        if (cIdx && !linked.has(`company:${cIdx}`)) {
          relCompanyCounter++;
          linked.add(`company:${cIdx}`);
          companiesWithRelationships.add(cIdx);
          writeJSON(
            path.join(
              "data",
              buildRelationshipFilename(
                `./company_${cIdx}.json`,
                rec.historyPath,
                null,
                true,
              ),
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": rec.historyPath },
            },
          );
        }
      }
    });
  });

  // Clean up any person/company files that don't have relationships
  try {
    const files = fs.readdirSync("data");
    for (const f of files) {
      try {
        const personMatch = f.match(/^person_(\d+)\.json$/);
        const companyMatch = f.match(/^company_(\d+)\.json$/);
        if (personMatch) {
          const idx = parseInt(personMatch[1]);
          if (!personsWithRelationships.has(idx)) {
            const filePath = path.join("data", f);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        } else if (companyMatch) {
          const idx = parseInt(companyMatch[1]);
          if (!companiesWithRelationships.has(idx)) {
            const filePath = path.join("data", f);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (fileError) {
        // Continue with next file even if one fails
        console.warn(`Warning: Failed to process/delete ${f}:`, fileError.message);
      }
    }
  } catch (e) {
    console.warn("Warning: Error during person/company cleanup:", e.message);
  }

}

function writeTaxes($) {
  const vals = extractValuation($);
  vals.forEach((v) => {
    const taxObj = {
      tax_year: v.year || null,
      property_assessed_value_amount: parseCurrencyToNumber(v.assessed),
      property_market_value_amount: parseCurrencyToNumber(v.market),
      property_building_amount: parseCurrencyToNumber(v.building),
      property_land_amount: parseCurrencyToNumber(v.land),
      property_taxable_value_amount: parseCurrencyToNumber(v.taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
  });
}

function writeUtilities(parcelId) {
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  if (!utils) return { utilities: [], nextUtilityIndex: 1 };
  const key = `property_${parcelId}`;
  const entries = utils[key];
  if (!Array.isArray(entries) || !entries.length)
    return { utilities: [], nextUtilityIndex: 1 };

  const utilities = [];
  entries.forEach((entry) => {
    const extracted = extractMappedRecord(entry, "utility");
    if (!extracted) return;
    const record = extracted.data;
    if (record.request_identifier == null) {
      record.request_identifier = parcelId;
    }
    const fileName = `utility_${utilities.length + 1}.json`;
    writeJSON(path.join("data", fileName), record);
    utilities.push({
      fileName,
      buildingNumber:
        extracted.buildingNumber != null
          ? String(extracted.buildingNumber)
          : null,
    });
  });

  return { utilities, nextUtilityIndex: utilities.length + 1 };
}

function writeStructures(parcelId) {
  const structures = readJSON(path.join("owners", "structure_data.json"));
  if (!structures) return { structures: [], nextStructureIndex: 1 };
  const key = `property_${parcelId}`;
  const entries = structures[key];
  if (!Array.isArray(entries) || !entries.length)
    return { structures: [], nextStructureIndex: 1 };

  const structureRecords = [];
  entries.forEach((entry) => {
    const extracted = extractMappedRecord(entry, "structure");
    if (!extracted) return;
    const record = extracted.data;
    if (record.request_identifier == null) {
      record.request_identifier = parcelId;
    }
    const fileName = `structure_${structureRecords.length + 1}.json`;
    writeJSON(path.join("data", fileName), record);
    structureRecords.push({
      fileName,
      buildingNumber:
        extracted.buildingNumber != null
          ? String(extracted.buildingNumber)
          : null,
    });
  });

  return {
    structures: structureRecords,
    nextStructureIndex: structureRecords.length + 1,
  };
}

function writeLayout(parcelId) {
  const layouts = readJSON(path.join("owners", "layout_data.json"));
  if (!layouts)
    return { buildingLayouts: [], nextLayoutIndex: 1, nextSpaceIndex: 1 };
  const key = `property_${parcelId}`;
  const propertyLayouts = layouts[key];
  if (!propertyLayouts || !Array.isArray(propertyLayouts.buildings)) {
    return { buildingLayouts: [], nextLayoutIndex: 1, nextSpaceIndex: 1 };
  }

  const buildings = propertyLayouts.buildings;
  if (!buildings.length) {
    return { buildingLayouts: [], nextLayoutIndex: 1, nextSpaceIndex: 1 };
  }

  let layoutFileCounter = 1;
  let spaceIndexCounter = 1;
  const buildingLayouts = [];

  buildings.forEach((building, idx) => {
    const buildingNumberRaw =
      building && Object.prototype.hasOwnProperty.call(building, "building_number")
        ? building.building_number
        : null;
    const buildingNumber = Number.isFinite(Number(buildingNumberRaw))
      ? Number(buildingNumberRaw)
      : idx + 1;
    const buildingNumberStr = String(buildingNumber);
    const fileName = `layout_${layoutFileCounter++}.json`;
    const totalArea =
      building && Object.prototype.hasOwnProperty.call(building, "total_area_sq_ft")
        ? building.total_area_sq_ft
        : null;
    const livableArea =
      building && Object.prototype.hasOwnProperty.call(building, "livable_area_sq_ft")
        ? building.livable_area_sq_ft
        : null;
    const builtYear =
      building && Object.prototype.hasOwnProperty.call(building, "built_year")
        ? building.built_year
        : null;

    const out = createDefaultLayoutRecord();
    out.space_type = "Building";
    out.space_index = spaceIndexCounter++;
    out.space_type_index = buildingNumberStr;
    out.total_area_sq_ft = totalArea ?? null;
    out.size_square_feet = totalArea ?? null;
    out.livable_area_sq_ft = livableArea ?? null;
    out.heated_area_sq_ft = livableArea ?? null;
    out.area_under_air_sq_ft = livableArea ?? null;
    out.built_year = builtYear ?? null;
    out.request_identifier = parcelId;
    out.building_number = buildingNumber;
    out.is_exterior = false;
    out.is_finished = true;

    writeJSON(path.join("data", fileName), out);

    const roomSpecs =
      building && Array.isArray(building.rooms) ? building.rooms : [];
    buildingLayouts.push({
      fileName,
      buildingNumber,
      buildingNumberStr,
      roomSpecs,
    });
  });

  buildingLayouts.forEach((layoutInfo) => {
    const buildingNumber = layoutInfo.buildingNumber;
    const buildingIndexStr = layoutInfo.buildingNumberStr;
    const typeCounters = new Map();
    layoutInfo.roomSpecs.forEach((roomSpec) => {
      if (
        !roomSpec ||
        typeof roomSpec !== "object" ||
        !roomSpec.space_type
      ) {
        return;
      }
      const count = Number(roomSpec.count) || 0;
      if (count <= 0) return;
      for (let i = 0; i < count; i++) {
        const fileName = `layout_${layoutFileCounter++}.json`;
        const roomLayout = createDefaultLayoutRecord();
        roomLayout.space_type = roomSpec.space_type;
        roomLayout.space_index = spaceIndexCounter++;
        const typeKey = roomSpec.space_type || "UNKNOWN";
        const prevCount = typeCounters.get(typeKey) || 0;
        const nextCount = prevCount + 1;
        typeCounters.set(typeKey, nextCount);
        roomLayout.space_type_index = `${buildingIndexStr}.${nextCount}`;
        roomLayout.request_identifier = parcelId;
        roomLayout.building_number = buildingNumber;
        roomLayout.is_exterior = false;
        roomLayout.is_finished = true;
        writeJSON(path.join("data", fileName), roomLayout);
        writeRelationshipFile(layoutInfo.fileName, fileName);
      }
    });
    // Remove roomSpecs reference to avoid leaking large arrays in context
    delete layoutInfo.roomSpecs;
  });

  return {
    buildingLayouts: buildingLayouts.map(
      ({ fileName, buildingNumber, buildingNumberStr }) => ({
        fileName,
        buildingNumber,
        buildingNumberStr,
      }),
    ),
    nextLayoutIndex: layoutFileCounter,
    nextSpaceIndex: spaceIndexCounter,
  };
}

function linkLayoutsToAssets(layoutCtx, structureCtx, utilityCtx) {
  if (
    !layoutCtx ||
    !Array.isArray(layoutCtx.buildingLayouts) ||
    !layoutCtx.buildingLayouts.length
  ) {
    return;
  }

  const buildingLayouts = layoutCtx.buildingLayouts;
  const buildingMap = new Map();
  buildingLayouts.forEach((layout) => {
    const key =
      layout.buildingNumberStr != null
        ? String(layout.buildingNumberStr)
        : String(layout.buildingNumber);
    buildingMap.set(key, layout);
  });

  const buildingCount = buildingLayouts.length;

  if (
    structureCtx &&
    Array.isArray(structureCtx.structures) &&
    structureCtx.structures.length
  ) {
    const structures = structureCtx.structures;
    if (structures.length === 1 && buildingCount > 1) {
      writeRelationshipFile("property.json", structures[0].fileName);
    } else {
      const assigned = new Set();
      structures.forEach((structure, idx) => {
        const bNum = structure.buildingNumber;
        let target = null;
        const key = bNum != null ? String(bNum) : null;
        if (key != null && buildingMap.has(key) && !assigned.has(key)) {
          target = buildingMap.get(key);
        } else if (idx < buildingCount) {
          const candidate = buildingLayouts[idx];
          if (candidate && !assigned.has(candidate.buildingNumber)) {
            target = candidate;
          }
        }
        if (target) {
          const assignKey =
            target.buildingNumberStr != null
              ? String(target.buildingNumberStr)
              : String(target.buildingNumber);
          assigned.add(assignKey);
          writeRelationshipFile(target.fileName, structure.fileName);
        } else {
          writeRelationshipFile("property.json", structure.fileName);
        }
      });
    }
  }

  if (
    utilityCtx &&
    Array.isArray(utilityCtx.utilities) &&
    utilityCtx.utilities.length
  ) {
    const utilities = utilityCtx.utilities;
    if (utilities.length === 1 && buildingCount > 1) {
      writeRelationshipFile("property.json", utilities[0].fileName);
    } else {
      const assigned = new Set();
      utilities.forEach((utility, idx) => {
        const bNum = utility.buildingNumber;
        let target = null;
        const key = bNum != null ? String(bNum) : null;
        if (key != null && buildingMap.has(key) && !assigned.has(key)) {
          target = buildingMap.get(key);
        } else if (idx < buildingCount) {
          const candidate = buildingLayouts[idx];
          if (candidate && !assigned.has(candidate.buildingNumber)) {
            target = candidate;
          }
        }
        if (target) {
          const assignKey =
            target.buildingNumberStr != null
              ? String(target.buildingNumberStr)
              : String(target.buildingNumber);
          assigned.add(assignKey);
          writeRelationshipFile(target.fileName, utility.fileName);
        } else {
          writeRelationshipFile("property.json", utility.fileName);
        }
      });
    }
  }
}

function extractExtraFeatures($) {
  const table = $("#ctlBodyPane_ctl05_ctl01_grdSales_grdFlat");
  const extras = [];
  if (!table.length) return extras;
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.children();
    if (!cells || !cells.length) return;
    const code = textTrim($(cells[0]).text());
    const description = textTrim($(cells[1]).text());
    const dimensions = textTrim($(cells[2]).text());
    const units = textTrim($(cells[3]).text());
    const year = textTrim($(cells[4]).text());
    extras.push({ code, description, dimensions, units, year });
  });
  return extras;
}

function parseFeatureDimensions(text) {
  if (!text) return { length: null, width: null, area: null };
  const matches = String(text)
    .match(/(\d+(?:\.\d+)?)/g);
  if (!matches || !matches.length) {
    return { length: null, width: null, area: null };
  }
  const length = Number(matches[0]);
  const width = matches.length > 1 ? Number(matches[1]) : null;
  const hasLength = Number.isFinite(length) && length > 0;
  const hasWidth = Number.isFinite(width) && width > 0;
  const area = hasLength && hasWidth ? Math.round(length * width) : null;
  return {
    length: hasLength ? length : null,
    width: hasWidth ? width : null,
    area,
  };
}

function parseIntegerOrNull(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function mapExtraFeatureToAsset(feature) {
  if (!feature) return null;
  const desc = (feature.description || "").toUpperCase();
  if (!desc) return null;
  const dims = parseFeatureDimensions(feature.dimensions);
  const builtYear = parseIntegerOrNull(feature.year);

  if (desc.includes("CARPORT")) {
    return {
      type: "layout",
      space_type: "Carport",
      built_year: builtYear,
      size_square_feet: dims.area,
      is_exterior: true,
      is_finished: false,
    };
  }

  if (desc.includes("SHED")) {
    const exterior =
      desc.includes("MTL") || desc.includes("METAL")
        ? "Metal Siding"
        : "Wood Siding";
    return {
      type: "structure",
      exterior_wall_material_primary: exterior,
      finished_base_area: dims.area,
    };
  }

  if (desc.includes("WELL")) {
    return {
      type: "utility",
      water_source_type: "Well",
    };
  }

  if (desc.includes("SEPTIC")) {
    return {
      type: "utility",
      sewer_type: "SepticSystem",
    };
  }

  return null;
}

function mapExtraFeatures(features) {
  const layouts = [];
  const structures = [];
  const utilities = [];
  features.forEach((feature) => {
    const mapped = mapExtraFeatureToAsset(feature);
    if (!mapped) return;
    if (mapped.type === "layout") {
      layouts.push(mapped);
    } else if (mapped.type === "structure") {
      structures.push(mapped);
    } else if (mapped.type === "utility") {
      utilities.push(mapped);
    }
  });
  return { layouts, structures, utilities };
}

function createDefaultStructureRecord(parcelId) {
  return {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: null,
    number_of_buildings: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
    request_identifier: parcelId,
  };
}

function createDefaultUtilityRecord(parcelId) {
  return {
    cooling_system_type: null,
    heating_system_type: null,
    heating_fuel_type: null,
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
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    plumbing_system_installation_date: null,
    sewer_connection_date: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    well_installation_date: null,
    request_identifier: parcelId,
  };
}

function writeExtraLayouts(parcelId, extraLayouts, startLayoutIndex, startSpaceIndex) {
  let layoutIndex = startLayoutIndex;
  let spaceIndex = startSpaceIndex;
  let extraCounter = 1;
  extraLayouts.forEach((info) => {
    const record = createDefaultLayoutRecord();
    record.space_type = info.space_type ?? null;
    record.space_index = spaceIndex++;
    record.space_type_index = `0.${extraCounter++}`;
    record.is_exterior = info.is_exterior ?? false;
    record.is_finished =
      info.is_finished !== undefined ? info.is_finished : null;
    record.request_identifier = parcelId;
    record.building_number = null;
    if (info.size_square_feet != null)
      record.size_square_feet = info.size_square_feet;
    if (info.built_year != null) record.built_year = info.built_year;
    const fileName = `layout_${layoutIndex++}.json`;
    writeJSON(path.join("data", fileName), record);
  });
  return {
    nextLayoutIndex: layoutIndex,
    nextSpaceIndex: spaceIndex,
  };
}

function writeExtraStructures(parcelId, extraStructures, startStructureIndex, primaryLayoutFileName) {
  let structureIndex = startStructureIndex;
  extraStructures.forEach((info) => {
    const record = createDefaultStructureRecord(parcelId);
    if (info.exterior_wall_material_primary) {
      record.exterior_wall_material_primary = info.exterior_wall_material_primary;
    }
    if (info.finished_base_area != null) {
      record.finished_base_area = info.finished_base_area;
    }
    const fileName = `structure_${structureIndex++}.json`;
    writeJSON(path.join("data", fileName), record);
    // Link extra structures to the primary building layout instead of property
    if (primaryLayoutFileName) {
      writeRelationshipFile(primaryLayoutFileName, fileName);
    } else {
      writeRelationshipFile("property.json", fileName);
    }
  });
  return { nextStructureIndex: structureIndex };
}

function writeExtraUtilities(parcelId, extraUtilities, startUtilityIndex) {
  let utilityIndex = startUtilityIndex;
  extraUtilities.forEach((info) => {
    const record = createDefaultUtilityRecord(parcelId);
    if (info.water_source_type) {
      record.water_source_type = info.water_source_type;
    }
    if (info.sewer_type) {
      record.sewer_type = info.sewer_type;
    }
    const fileName = `utility_${utilityIndex++}.json`;
    writeJSON(path.join("data", fileName), record);
    writeRelationshipFile("property.json", fileName);
  });
  return { nextUtilityIndex: utilityIndex };
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  if (!value) return { section: null, township: null, range: null };
  // Updated regex to be more flexible for township and range (can be alphanumeric)
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function attemptWriteAddress(unnorm, secTwpRng) {
  if (!unnorm) return;
  const unnormalizedAddress =
    unnorm.full_address && unnorm.full_address.trim()
      ? unnorm.full_address.trim()
      : null;
  const countyName =
    unnorm.county_jurisdiction && unnorm.county_jurisdiction.trim()
      ? unnorm.county_jurisdiction.trim()
      : null;
  const section = secTwpRng && secTwpRng.section ? secTwpRng.section : null;
  const township = secTwpRng && secTwpRng.township ? secTwpRng.township : null;
  const range = secTwpRng && secTwpRng.range ? secTwpRng.range : null;

  const address = {
    unnormalized_address: unnormalizedAddress,
    section,
    township,
    range,
    source_http_request: unnorm.source_http_request || null,
    request_identifier: unnorm.request_identifier || null,
    county_name: countyName,
    country_code: "US",
  };
  writeJSON(path.join("data", "address.json"), address);
  writeGeometryData(unnorm);
  writeAddressHasGeometryRelationship();
}

function writeGeometryData(unnorm) {
  if (!unnorm) return;
  const toNumberOrNull = (val) => {
    if (val == null || val === "") return null;
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  };
  const geometry = {
    latitude: toNumberOrNull(unnorm.latitude),
    longitude: toNumberOrNull(unnorm.longitude),
    source_http_request: unnorm.source_http_request || null,
    request_identifier: unnorm.request_identifier || null,
  };
  writeJSON(path.join("data", "geometry.json"), geometry);
}

function writeAddressHasGeometryRelationship() {
  const relationship = {
    from: { "/": "./address.json" },
    to: { "/": "./geometry.json" },
  };
  writeJSON(
    path.join("data", "relationship_address_has_geometry.json"),
    relationship,
  );
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;

  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }

  if (parcelId) writeProperty($, parcelId);

  const salesRecords = writeSalesDeedsFilesAndRelationships($, propertySeed);

  writeTaxes($);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(
      $,
      parcelId,
      salesRecords,
      propertySeed,
    );
    // writeOwnersCurrentAndRelationships(parcelId);
    // writeHistoricalBuyerPersonsAndRelationships(parcelId, sales);
    cleanupLayoutStructureUtilityArtifacts();
    const structureCtx = writeStructures(parcelId);
    const utilityCtx = writeUtilities(parcelId);
    const layoutCtx = writeLayout(parcelId);
    linkLayoutsToAssets(layoutCtx, structureCtx, utilityCtx);

    const extraFeatures = extractExtraFeatures($);
    // Deduplicate identical extra features (e.g., multiple identical sheds)
    const deduplicatedFeatures = [];
    const seen = new Set();
    extraFeatures.forEach((feature) => {
      const key = JSON.stringify({
        code: feature.code,
        description: feature.description,
        dimensions: feature.dimensions,
        year: feature.year
      });
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedFeatures.push(feature);
      }
    });
    const extraAssets = mapExtraFeatures(deduplicatedFeatures);

    let nextLayoutIndex = layoutCtx.nextLayoutIndex || 1;
    let nextSpaceIndex = layoutCtx.nextSpaceIndex || 1;
    if (extraAssets.layouts.length) {
      const layoutExtraCtx = writeExtraLayouts(
        parcelId,
        extraAssets.layouts,
        nextLayoutIndex,
        nextSpaceIndex,
      );
      nextLayoutIndex = layoutExtraCtx.nextLayoutIndex;
      nextSpaceIndex = layoutExtraCtx.nextSpaceIndex;
    }

    let nextStructureIndex = structureCtx.nextStructureIndex || 1;
    if (extraAssets.structures.length) {
      // Get the primary building layout filename (layout_1.json in most cases)
      const primaryLayoutFileName = layoutCtx && layoutCtx.buildingLayouts && layoutCtx.buildingLayouts.length > 0
        ? layoutCtx.buildingLayouts[0].fileName
        : null;
      const structureExtraCtx = writeExtraStructures(
        parcelId,
        extraAssets.structures,
        nextStructureIndex,
        primaryLayoutFileName,
      );
      nextStructureIndex = structureExtraCtx.nextStructureIndex;
    }

    let nextUtilityIndex = utilityCtx.nextUtilityIndex || 1;
    if (extraAssets.utilities.length) {
      const utilityExtraCtx = writeExtraUtilities(
        parcelId,
        extraAssets.utilities,
        nextUtilityIndex,
      );
      nextUtilityIndex = utilityExtraCtx.nextUtilityIndex;
    }
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  attemptWriteAddress(unnormalized, secTwpRng);
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      writeJSON(path.join("data", "error.json"), e);
      console.error("Extraction error:", e);
      process.exit(1);
    } else {
      console.error("Unexpected error:", e);
      process.exit(1);
    }
  }
}
