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

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl03_ctl01_grdValuation";
const OWNER_SECTION_SELECTOR = "#ctlBodyPane_ctl01_mSection";
const OWNER_ADDRESS_SELECTOR =
  'span[id$="_lblPrimaryOwnerAddress"], span[id$="_lblOwnerAddress"]';

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

function relationshipFileName(fromFile, toFile) {
  const normalize = (name) => {
    if (!name) return "";
    const cleaned = String(name).replace(/^\.\/+/, "");
    const base = cleaned.endsWith(".json")
      ? cleaned.slice(0, -5)
      : cleaned;
    return base.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  };
  const fromPart = normalize(fromFile);
  const toPart = normalize(toFile);
  return `relationship_${fromPart}_${toPart}.json`;
}

const PERSON_SUFFIX_MAP = new Map([
  ["SR", "Sr."],
  ["JR", "Jr."],
  ["II", "II"],
  ["III", "III"],
  ["IV", "IV"],
  ["PHD", "PhD"],
  ["MD", "MD"],
  ["ESQ", "Esq."],
  ["JD", "JD"],
  ["LLM", "LLM"],
  ["MBA", "MBA"],
  ["RN", "RN"],
  ["DDS", "DDS"],
  ["DVM", "DVM"],
  ["CFA", "CFA"],
  ["CPA", "CPA"],
  ["PE", "PE"],
  ["PMP", "PMP"],
  ["EMERITUS", "Emeritus"],
  ["RET", "Ret."],
]);

const LAYOUT_REQUIRED_DEFAULTS = Object.freeze({
  flooring_material_type: null,
  has_windows: null,
  window_design_type: null,
  window_material_type: null,
  window_treatment_type: null,
  is_finished: false,
  furnished: null,
  paint_condition: null,
  flooring_wear: null,
  clutter_level: null,
  visible_damage: null,
  countertop_material: null,
  cabinet_style: null,
  fixture_finish_quality: null,
  design_style: null,
  natural_light_quality: null,
  decor_elements: null,
  pool_type: null,
  pool_equipment: null,
  spa_type: null,
  safety_features: null,
  view_type: null,
  lighting_features: null,
  condition_issues: null,
  pool_condition: null,
  pool_surface_type: null,
  pool_water_quality: null,
  is_exterior: false,
});

function applyLayoutDefaults(layoutObj) {
  const updated = { ...layoutObj };
  Object.keys(LAYOUT_REQUIRED_DEFAULTS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updated, key)) {
      updated[key] = LAYOUT_REQUIRED_DEFAULTS[key];
    }
  });
  return updated;
}

function collapseWhitespace(str) {
  if (str == null) return "";
  return String(str).replace(/\s+/g, " ").trim();
}

function normalizeCompanyKey(name) {
  return collapseWhitespace(name).toLowerCase();
}

function isAllCapsString(str) {
  if (!str) return false;
  const alpha = str.replace(/[^A-Za-z]/g, "");
  if (!alpha) return str === str.toUpperCase();
  return alpha === alpha.toUpperCase();
}

function choosePreferredCompanyName(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;
  if (isAllCapsString(existing) && !isAllCapsString(candidate)) return candidate;
  if (
    isAllCapsString(existing) &&
    isAllCapsString(candidate) &&
    candidate.length > existing.length
  )
    return candidate;
  return existing;
}

function sanitizeCompanyName(name) {
  return collapseWhitespace(name);
}

function normalizePersonSuffix(value) {
  if (!value) return null;
  const key = collapseWhitespace(value).replace(/\./g, "").toUpperCase();
  if (!key) return null;
  if (PERSON_SUFFIX_MAP.has(key)) return PERSON_SUFFIX_MAP.get(key);
  return null;
}

function canonicalizePersonKey(person) {
  if (!person) return "";
  const parts = [
    collapseWhitespace(person.first_name || "").toLowerCase(),
    collapseWhitespace(person.last_name || "").toLowerCase(),
    collapseWhitespace(person.suffix_name || "").toLowerCase(),
  ];
  return parts.join("|");
}

function choosePreferredPersonValue(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;
  if (isAllCapsString(existing) && !isAllCapsString(candidate)) return candidate;
  if (!isAllCapsString(existing) && isAllCapsString(candidate)) return existing;
  if (candidate.length > existing.length && isAllCapsString(existing)) return candidate;
  return existing;
}

function choosePreferredPersonRecord(existing, candidate) {
  if (!existing) return { ...candidate };
  const result = { ...existing };
  const fields = ["prefix_name", "first_name", "middle_name", "last_name"];
  fields.forEach((field) => {
    const candidateVal = candidate[field];
    if (!candidateVal) return;
    const existingVal = result[field];
    result[field] = choosePreferredPersonValue(existingVal, candidateVal);
  });
  if (!result.suffix_name && candidate.suffix_name)
    result.suffix_name = candidate.suffix_name;
  return result;
}

const STRUCTURE_REQUIRED_DEFAULTS = Object.freeze({
  architectural_style_type: null,
  attachment_type: "Detached",
  exterior_wall_material_primary: null,
  exterior_wall_material_secondary: null,
  exterior_wall_condition: null,
  exterior_wall_condition_primary: null,
  exterior_wall_condition_secondary: null,
  exterior_wall_insulation_type: null,
  exterior_wall_insulation_type_primary: null,
  exterior_wall_insulation_type_secondary: null,
  flooring_material_primary: null,
  flooring_material_secondary: null,
  subfloor_material: null,
  flooring_condition: null,
  interior_wall_structure_material: null,
  interior_wall_structure_material_primary: null,
  interior_wall_structure_material_secondary: null,
  interior_wall_surface_material_primary: null,
  interior_wall_surface_material_secondary: null,
  interior_wall_finish_primary: null,
  interior_wall_finish_secondary: null,
  interior_wall_condition: null,
  roof_covering_material: null,
  roof_underlayment_type: null,
  roof_structure_material: null,
  roof_design_type: null,
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
});

function applyStructureDefaults(structureObj) {
  const updated = { ...structureObj };
  Object.keys(STRUCTURE_REQUIRED_DEFAULTS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updated, key)) {
      updated[key] = STRUCTURE_REQUIRED_DEFAULTS[key];
    }
  });
  return updated;
}

const UTILITY_REQUIRED_DEFAULTS = Object.freeze({
  cooling_system_type: null,
  heating_system_type: null,
  public_utility_type: null,
  sewer_type: null,
  water_source_type: null,
  plumbing_system_type: null,
  plumbing_system_type_other_description: null,
  electrical_panel_capacity: null,
  electrical_wiring_type: null,
  electrical_wiring_type_other_description: null,
  hvac_condensing_unit_present: null,
  solar_panel_present: false,
  solar_panel_type: null,
  solar_panel_type_other_description: null,
  smart_home_features: null,
  smart_home_features_other_description: null,
  hvac_unit_condition: null,
  solar_inverter_visible: false,
  hvac_unit_issues: null,
});

function applyUtilityDefaults(utilityObj) {
  const updated = { ...utilityObj };
  Object.keys(UTILITY_REQUIRED_DEFAULTS).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(updated, key)) {
      updated[key] = UTILITY_REQUIRED_DEFAULTS[key];
    }
  });
  return updated;
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

function extractLegalDescription($) {
  let desc = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("description")) {
      desc = textOf($(tr).find("td span"));
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("property use")) {
      code = textOf($(tr).find("td span"));
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

function createPropertyUseCodeMapping() {
  const map = Object.create(null);
  const assign = (codes, overrides) => {
    codes.forEach((code) => {
      map[code] = Object.freeze({ ...overrides });
    });
  };

  assign([""], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Unknown",
    ownership_estate_type: null,
  });
  assign(["BARNS"], { property_usage_type: "LivestockFacility" });
  assign(["BEES"], {
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
  });
  assign(["CAMPS"], {
    property_type: "LandParcel",
    property_usage_type: "Recreational",
  });
  assign(["CAR WASH-SELF"], { property_usage_type: "ServiceStation" });
  assign(["CENTRALLY ASSESSED"], { property_usage_type: "Utility" });
  assign(["CHURCHES", "RELIGIOUS"], { property_usage_type: "Church" });
  assign(["CLUBS/LODGES/HALLS"], { property_usage_type: "ClubsLodges" });
  assign(["COMM TOWER"], {
    property_usage_type: "TelecommunicationsFacility",
  });
  assign(["COMMERCIAL RURAL"], { property_usage_type: "Commercial" });
  assign(["COMMON AREA", "RES COMMON AREA"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "ResidentialCommonElementsAreas",
  });
  assign(["COMMUNITY SHOPPING"], {
    property_usage_type: "ShoppingCenterCommunity",
  });
  assign(["CONSERVATION"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Conservation",
  });
  assign(["CONTAINER NURSERIES", "NURSERY CROPS"], {
    property_type: "LandParcel",
    property_usage_type: "NurseryGreenhouse",
  });
  assign(["CONVENIENCE W/ FUEL"], { property_usage_type: "ServiceStation" });
  assign(["CONVENIENCE W/O FUEL"], { property_usage_type: "RetailStore" });
  assign(["COUNTY", "FEDERAL", "STATE", "MUNICIPAL"], {
    property_usage_type: "GovernmentProperty",
  });
  assign(["STATE TIITF"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "GovernmentProperty",
  });
  assign(["CROPLAND CLASS 2"], {
    property_type: "LandParcel",
    property_usage_type: "CroplandClass2",
  });
  assign(["CROPLAND CLASS 3"], {
    property_type: "LandParcel",
    property_usage_type: "CroplandClass3",
  });
  assign(["DAYCARE"], { property_usage_type: "Commercial" });
  assign(["DRIVE-IN REST"], { property_usage_type: "Restaurant" });
  assign(["DUPLEX"], {
    property_usage_type: "Residential",
    structure_form: "Duplex",
  });
  assign(["FINANCIAL BLDG"], {
    property_usage_type: "FinancialInstitution",
  });
  assign(["FOREST, PARKS, REC"], {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
  });
  assign(["FUEL STORAGE"], { property_usage_type: "Utility" });
  assign(["GARAGE"], { property_usage_type: "OpenStorage" });
  assign(["GO CART TRACK", "TOURIST ATTRACTION", "NIGHTCLUB/BARS"], {
    property_usage_type: "Entertainment",
  });
  assign(["GOLF COURSES"], {
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
  });
  assign(["HLOA-HANGR LOTS", "LLOYD INTRCHG PLUS", "PARKING LOT"], {
    property_type: "LandParcel",
    property_usage_type: "TransportationTerminal",
  });
  assign(["HOMES FOR THE AGED", "REST HOMES"], {
    property_usage_type: "HomesForAged",
    structure_form: "MultiFamily5Plus",
  });
  assign(["HOTELS AND MOTELS"], { property_usage_type: "Hotel" });
  assign(["IMP AG COMM", "NO AG ACREAGE", "IMPR AG XFOB"], {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
  });
  assign(["IMPR AG MH"], {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    structure_form: "ManufacturedHousing",
  });
  assign(["IMPR AG MULTI"], {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    structure_form: "MultiFamilyLessThan10",
  });
  assign(["IMPR AG SFR"], {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    structure_form: "SingleFamilyDetached",
  });
  assign(["IMPR AG TAG"], {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    structure_form: "ManufacturedHousing",
    ownership_estate_type: "OtherEstate",
  });
  assign(["IMPROVD-CONSERVATION"], {
    property_type: "LandParcel",
    property_usage_type: "Conservation",
  });
  assign(["LAUNDROMAT", "STORE/OFFICE/RESID", "STORES, 1 STORY"], {
    property_usage_type: "RetailStore",
  });
  assign(["LIGHT MANUFACTURE"], {
    property_usage_type: "LightManufacturing",
  });
  assign(["LUMBER YARD"], { property_usage_type: "LumberYard" });
  assign(["MH W/TAG"], {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHomeInPark",
    ownership_estate_type: "OtherEstate",
  });
  assign(["MISCELLANEOUS"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Unknown",
  });
  assign(["MIXED PINE/HDWD", "NATURAL PINES", "PLANTED PINES"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TimberLand",
  });
  assign(["MOBILE HOME"], {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHomeOnLand",
  });
  assign(["MODULAR"], {
    property_usage_type: "Residential",
    structure_form: "Modular",
  });
  assign(["MORTUARY/CEMETE"], {
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
  });
  assign(["MULTI STORY OFFICE", "OFFICE BUILDINGS", "PROFESSIONAL BLDG"], {
    property_usage_type: "OfficeBuilding",
  });
  assign(["MULTI-FAMILY"], {
    property_usage_type: "Residential",
    structure_form: "MultiFamily5Plus",
  });
  assign(["NON-PRODUCTIVE"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TransitionalProperty",
  });
  assign(["NON-PROFIT SERVICE"], { property_usage_type: "NonProfitCharity" });
  assign(["ORCHARDS, GROVES", "PECANS"], {
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
  });
  assign(["ORNAMENTALS,MISC"], {
    property_type: "LandParcel",
    property_usage_type: "Ornamentals",
  });
  assign(["PACKING PLANTS"], { property_usage_type: "PackingPlant" });
  assign(["PASTURELAND 2"], {
    property_type: "LandParcel",
    property_usage_type: "ImprovedPasture",
  });
  assign(["PASTURELAND 3"], {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
  });
  assign(["PHYSICAL FITNESS CTR"], { property_usage_type: "Recreational" });
  assign(["PONDS"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "RiversLakes",
  });
  assign(["POULTRY,BEES,FISH"], {
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
  });
  assign(["PRIVATE SCHOOLS"], { property_usage_type: "PrivateSchool" });
  assign(["PUBLIC SCHOOLS"], { property_usage_type: "PublicSchool" });
  assign(["RACE TRACKS"], {
    property_type: "LandParcel",
    property_usage_type: "RaceTrack",
  });
  assign(["REPAIR SERVICE", "VEH SALE/REPAIR"], {
    property_usage_type: "AutoSalesRepair",
  });
  assign(["RESTAURANTS/CAF"], { property_usage_type: "Restaurant" });
  assign(["RETENTION POND"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "SewageDisposal",
  });
  assign(["RIGHTS-OF-WAY", "ROADS EASMNTS ETC"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TransportationTerminal",
    ownership_estate_type: "RightOfWay",
  });
  assign(["RIVERS AND LAKES"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "RiversLakes",
  });
  assign(["SFR MANUFAC"], {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHousing",
  });
  assign(["SINGLE FAMILY"], {
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  });
  assign(["SUB-SURFACE RIGHTS"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Unknown",
    ownership_estate_type: "SubsurfaceRights",
  });
  assign(["SUPERMARKET"], { property_usage_type: "Supermarket" });
  assign(["THEATER/AUDITORIUM"], { property_usage_type: "Theater" });
  assign(
    [
      "TIMBER SWAMP",
      "TIMBERLAND 60-69",
      "TIMBERLAND 70-79",
      "TIMBERLAND 80-89",
      "TIMBERLAND 90+",
      "TIMBERLAND UNCLASS",
    ],
    {
      property_type: "LandParcel",
      build_status: "VacantLand",
      property_usage_type: "TimberLand",
    },
  );
  assign(["TRALR PARK"], {
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
  });
  assign(["UTILITIES", "WATER MANAGEMENT"], { property_usage_type: "Utility" });
  assign(["VACANT"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Unknown",
  });
  assign(["VACANT COMMERCIAL", "VACANT COMMERCIAL W/XFOB"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Commercial",
  });
  assign(["VACANT INDUSTRIAL", "VACANT INDUSTRIAL W/XFOB"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Industrial",
  });
  assign(["VACANT W/ XFOB"], {
    property_type: "LandParcel",
    property_usage_type: "Unknown",
  });
  assign(["WAREHOUSE-STORAGE"], { property_usage_type: "Warehouse" });
  assign(["WASTELAND/DUMPS"], {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TransitionalProperty",
  });
  assign(["WHOLESALE OUTLET"], { property_usage_type: "WholesaleOutlet" });

  return Object.freeze(map);
}

const PROPERTY_USE_CODE_MAPPING = createPropertyUseCodeMapping();

function extractMailingAddresses($) {
  const addresses = new Set();
  $(OWNER_SECTION_SELECTOR)
    .find(OWNER_ADDRESS_SELECTOR)
    .each((_, el) => {
      const html = $(el).html() || "";
      const normalized = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .split(/\n+/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(", ");
      if (normalized) addresses.add(normalized);
    });
  return Array.from(addresses);
}

function normalizePropertyUseCode(raw) {
  if (raw == null) return "";
  return raw
    .replace(/\([^)]*\)/g, "")
    .replace(/\./g, "")
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
  const mapping = PROPERTY_USE_CODE_MAPPING[normalized];
  if (!mapping) {
    throw {
      type: "error",
      message: `Unknown Property Use Code mapping for: ${normalized || "(blank code)"}.`,
      path: "property.property_type",
    };
  }
  const merged = {
    ...PROPERTY_ATTRIBUTE_DEFAULTS,
    ...mapping,
  };
  const property_type = ensureEnumValue("property_type", merged.property_type);
  if (!property_type) {
    throw {
      type: "error",
      message: `Property type could not be resolved for code: ${normalized || "(blank code)"}.`,
      path: "property.property_type",
    };
  }
  return {
    property_type,
    build_status: ensureEnumValue("build_status", merged.build_status),
    structure_form: ensureEnumValue("structure_form", merged.structure_form),
    property_usage_type: ensureEnumValue(
      "property_usage_type",
      merged.property_usage_type,
    ),
    ownership_estate_type: ensureEnumValue(
      "ownership_estate_type",
      merged.ownership_estate_type,
    ),
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
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
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
  const yearsEffective = [];
   buildings.forEach((b) => {
    yearsActual.push(toInt(b["Actual Year Built"]));
    // yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: yearsEffective.length ? Math.min(...yearsEffective) : null,
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
   buildings.forEach((b) => {
    total += toInt(b["Total Area"]);
  });
  return total;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("th, td");
    const saleDate = textOf($(tds[0]));
    const salePrice = textOf($(tds[1]));
    const instrument = textOf($(tds[2]));
    const bookPageCell = $(tds[3]).clone();
    bookPageCell.find(".sr-only").remove();
    const bookPage = textTrim(bookPageCell.text());
    const link = $(tds[3]).find("a").last().attr("href") || null;
    const qualification = textOf($(tds[4]));
    const vacantImproved = textOf($(tds[5]));
    const grantor = textOf($(tds[6]));
    const grantee = textOf($(tds[7]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage,
      link,
      qualification,
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
  if (/WARR/.test(u) || /^WD\b/.test(u)) return "Warranty Deed";
  if (/SPECIAL/.test(u) || /^SW\b/.test(u)) return "Special Warranty Deed";
  if (/QUIT/.test(u) || /\bQCD?\b/.test(u)) return "Quitclaim Deed";
  if (/GRANT/.test(u) || /^GD\b/.test(u)) return "Grant Deed";
  if (/BARGAIN/.test(u) || /SALE/.test(u)) return "Bargain and Sale Deed";
  if (/LADY\s*BIRD/.test(u)) return "Lady Bird Deed";
  if (/TRANSFER\s*ON\s*DEATH/.test(u) || /\bTOD\b/.test(u))
    return "Transfer on Death Deed";
  if (/SHERIFF/.test(u) || /^SD\b/.test(u)) return "Sheriff's Deed";
  if (/TAX/.test(u) || /^TD\b/.test(u)) return "Tax Deed";
  if (/TRUSTEE/.test(u) || /^TR\b/.test(u)) return "Trustee's Deed";
  if (/PERSONAL\s+REP/.test(u) || /^PRD?\b/.test(u))
    return "Personal Representative Deed";
  if (/CORRECTION/.test(u) || /^CD\b/.test(u)) return "Correction Deed";
  if (/DEED\s+IN\s+LIEU/.test(u) || /\bDIL\b/.test(u))
    return "Deed in Lieu of Foreclosure";
  if (/LIFE\s+ESTATE/.test(u) || /\bLED\b/.test(u)) return "Life Estate Deed";
  if (/JOINT\s+TENANC/.test(u) || /\bJTDEED\b/.test(u))
    return "Joint Tenancy Deed";
  if (/TENANCY\s+IN\s+COMMON/.test(u)) return "Tenancy in Common Deed";
  if (/COMMUNITY\s+PROPERTY/.test(u)) return "Community Property Deed";
  if (/GIFT/.test(u)) return "Gift Deed";
  if (/INTERSPOUSAL/.test(u)) return "Interspousal Transfer Deed";
  if (/QUIET\s+TITLE/.test(u)) return "Quiet Title Deed";
  if (/ADMINISTRATOR/.test(u)) return "Administrator's Deed";
  if (/GUARDIAN/.test(u)) return "Guardian's Deed";
  if (/RECEIVER/.test(u)) return "Receiver's Deed";
  if (/RIGHT\s*OF\s*WAY/.test(u) || /\bROW\b/.test(u))
    return "Right of Way Deed";
  if (/VACATION\s+OF\s+PLAT/.test(u)) return "Vacation of Plat Deed";
  if (/ASSIGN/.test(u)) return "Assignment of Contract";
  if (/RELEASE/.test(u)) return "Release of Contract";
  return "Miscellaneous";
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  const headerThs = table.find("thead tr th").toArray();
  headerThs.forEach((th, idx) => {
    const txt = $(th).text().trim();
    const m = txt.match(/(\d{4})/);
    if (m && m.length > 1) {
      let y = parseInt(m[1], 10);
      if (!isNaN(y)) {
        years.push({ year: y, idx });
      }
    }
  });
  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
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
      land: get("Land Value"),
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
  const {
    property_type,
    build_status,
    structure_form,
    property_usage_type,
    ownership_estate_type,
  } = propertyAttributes;
  const years = extractBuildingYears($);
  const totalArea = extractAreas($);

  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    ownership_estate_type,
    build_status,
    structure_form,
    property_usage_type,
    property_type,
    livable_floor_area: null,
    total_area: totalArea >= 10 ? String(totalArea) : null,
    number_of_units_type: null,
    area_under_air: null,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  writeJSON(path.join("data", "property.json"), property);
}

function cleanupOldSalesArtifacts() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^sales_\d+\.json$/.test(f) ||
        /^sales_history_\d+\.json$/.test(f) ||
        /^relationship_sales_/.test(f) ||
        /^relationship_property_has_sales_history_\d+\.json$/.test(f) ||
        /^relationship_sales_history_/.test(f) ||
        /^deed_\d+\.json$/.test(f) ||
        /^file(_deed)?_\d+\.json$/.test(f) ||
        /^relationship_deed_file_\d+\.json$/.test(f) ||
        /^relationship_deed_\d+_file_\d+\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function parseBookPageInfo(raw) {
  if (!raw) return { book: null, page: null, volume: null };
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return { book: null, page: null, volume: null };
  let book = null;
  let page = null;
  let volume = null;
  const slashMatch = cleaned.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    book = slashMatch[1];
    page = slashMatch[2];
  }
  const bookMatch = cleaned.match(/\bBOOK\s*(\d+)\b/i);
  if (bookMatch && !book) book = bookMatch[1];
  const pageMatch = cleaned.match(/\bPAGE\s*(\d+)\b/i);
  if (pageMatch && !page) page = pageMatch[1];
  const volMatch = cleaned.match(/\bVOL(?:UME)?\s*(\d+)\b/i);
  if (volMatch) volume = volMatch[1];
  return { book, page, volume };
}

function parseInstrumentNumber(instr) {
  if (!instr) return null;
  const cleaned = instr.trim();
  if (!cleaned) return null;
  const hyphenMatch = cleaned.match(/\b(\d{4}-\d{3,})\b/);
  if (hyphenMatch) return hyphenMatch[1];
  const numericMatch = cleaned.match(/\b\d{6,}\b/);
  if (numericMatch) return numericMatch[0];
  return null;
}

function mapSaleType(raw) {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("unqualified")) return null;
  if (normalized.includes("qualified") || normalized.includes("arms length")) {
    return "TypicallyMotivated";
  }
  return null;
}

function writeSalesHistoryDeedsAndFiles(parcelId, sales) {
  cleanupOldSalesArtifacts();
  const saleHistoryMeta = [];

  sales.forEach((s, i) => {
    const idx = i + 1;
    const dateISO = parseDateToISO(s.saleDate);
    const saleHistoryFile = `sales_history_${idx}.json`;
    const saleHistory = {
      ownership_transfer_date: dateISO,
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
      request_identifier: parcelId,
    };
    const mappedSaleType = mapSaleType(s.qualification);
    if (mappedSaleType) saleHistory.sale_type = mappedSaleType;
    writeJSON(path.join("data", saleHistoryFile), saleHistory);

    let deedFileName = null;
    let fileFileName = null;
    const hasDeedInfo =
      (s.instrument && s.instrument.trim()) ||
      (s.bookPage && s.bookPage.trim()) ||
      (s.link && s.link.trim());
    if (hasDeedInfo) {
      const deedType = mapInstrumentToDeedType(s.instrument) || "Miscellaneous";
      const { book, page, volume } = parseBookPageInfo(s.bookPage);
      const deedObj = {
        deed_type: deedType,
        request_identifier: parcelId,
      };
      if (book) deedObj.book = String(book);
      if (page) deedObj.page = String(page);
      const volumeStr = volume != null ? String(volume) : null;
      if (volumeStr) deedObj.volume = volumeStr;
      const instrumentNumber = parseInstrumentNumber(s.instrument);
      if (instrumentNumber) deedObj.instrument_number = String(instrumentNumber);
      deedFileName = `deed_${idx}.json`;
      writeJSON(path.join("data", deedFileName), deedObj);

      fileFileName = `file_${idx}.json`;
      const name =
        (s.bookPage && s.bookPage.replace(/\s+/g, " ").trim()) ||
        (deedType ? `${deedType} Document` : "Deed Document");
      const file = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name,
        original_url: s.link || null,
      };
      writeJSON(path.join("data", fileFileName), file);

      writeJSON(
        path.join(
          "data",
          relationshipFileName(deedFileName, fileFileName),
        ),
        {
          from: { "/": `./${deedFileName}` },
          to: { "/": `./${fileFileName}` },
        },
      );

      writeJSON(
        path.join(
          "data",
          relationshipFileName(saleHistoryFile, deedFileName),
        ),
        {
          from: { "/": `./${saleHistoryFile}` },
          to: { "/": `./${deedFileName}` },
        },
      );
    }

    saleHistoryMeta.push({
      index: idx,
      dateISO,
      saleHistoryFile,
      deedFileName,
      fileFileName,
    });
  });

  return saleHistoryMeta;
}
let people = [];
let personKeyToIndex = new Map();
let companies = [];
let companyKeyToIndex = new Map();

function findPersonIndex(owner) {
  if (!owner) return null;
  const candidate = {
    prefix_name: owner.prefix_name || null,
    first_name: owner.first_name || null,
    middle_name: owner.middle_name || null,
    last_name: owner.last_name || null,
    suffix_name: normalizePersonSuffix(owner.suffix_name),
  };
  const canonicalKey = canonicalizePersonKey(candidate);
  if (personKeyToIndex.has(canonicalKey)) return personKeyToIndex.get(canonicalKey);
  const tf = titleCaseName(owner.first_name);
  const tl = titleCaseName(owner.last_name);
  for (let i = 0; i < people.length; i++) {
    if (people[i].first_name === tf && people[i].last_name === tl) return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  const key = normalizeCompanyKey(name);
  if (!key) return null;
  if (companyKeyToIndex.has(key)) return companyKeyToIndex.get(key);
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

function cleanNameField(s) {
  if (!s) return s;
  // Remove trailing punctuation that would violate the name pattern
  // Pattern allows punctuation only when followed by more letters
  return s.replace(/[,.\-'\s]+$/, '').trim();
}

function validateNameField(s) {
  // Validates that name field matches pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  // Returns the string if valid, null otherwise
  if (!s || typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  // Check if matches the required pattern from Elephant schema
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (!namePattern.test(trimmed)) return null;
  return trimmed;
}

function writePersonCompaniesSalesRelationships(
  parcelId,
  sales,
  mailingAddresses,
  mailingSource,
  saleHistoryMeta,
) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;

  // Build sale dates set to filter historical owners
  const saleDatesSet = new Set();
  (saleHistoryMeta || []).forEach((meta) => {
    if (meta.dateISO) saleDatesSet.add(meta.dateISO);
  });

  const orderedOwnerArrays = [];
  if (Array.isArray(ownersByDate.current))
    orderedOwnerArrays.push(ownersByDate.current);

  // Only include historical owners that have matching sales dates
  Object.keys(ownersByDate)
    .filter((ownerKey) => {
      if (ownerKey === "current") return false;
      if (/^unknown_date_/.test(ownerKey)) return false;
      // Only include if this date has a corresponding sale
      return saleDatesSet.has(ownerKey);
    })
    .sort()
    .forEach((ownerKey) => {
      const ownersForKey = ownersByDate[ownerKey];
      if (Array.isArray(ownersForKey) && ownersForKey.length)
        orderedOwnerArrays.push(ownersForKey);
    });
  const personMap = new Map();
  const companyMap = new Map();
  orderedOwnerArrays.forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const candidate = {
          prefix_name: o.prefix_name || null,
          first_name: o.first_name || null,
          middle_name: o.middle_name || null,
          last_name: o.last_name || null,
          suffix_name: normalizePersonSuffix(o.suffix_name),
        };
        const canonicalKey = canonicalizePersonKey(candidate);
        const existing = personMap.get(canonicalKey);
        const merged = choosePreferredPersonRecord(existing, candidate);
        personMap.set(canonicalKey, merged);
      } else if (o.type === "company") {
        const cleanedName = sanitizeCompanyName(o.name || "");
        if (!cleanedName) return;
        const normalizedKey = o.normalized_name
          ? normalizeCompanyKey(o.normalized_name)
          : normalizeCompanyKey(cleanedName);
        if (!normalizedKey) return;
        const preferred = choosePreferredCompanyName(
          companyMap.get(normalizedKey),
          cleanedName,
        );
        companyMap.set(normalizedKey, preferred);
      }
    });
  });
  people = Array.from(personMap.values()).map((p) => ({
    first_name: validateNameField(p.first_name ? cleanNameField(titleCaseName(p.first_name)) : null),
    middle_name: validateNameField(p.middle_name ? cleanNameField(titleCaseName(p.middle_name)) : null),
    last_name: validateNameField(p.last_name ? cleanNameField(titleCaseName(p.last_name)) : null),
    prefix_name: validateNameField(p.prefix_name ? cleanNameField(titleCaseName(p.prefix_name)) : null),
    suffix_name: p.suffix_name || null,
    birth_date: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  })).filter((p) => p.first_name !== null && p.last_name !== null);
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  personKeyToIndex = new Map();
  people.forEach((p, idx) => {
    const index = idx + 1;
    const canonical = canonicalizePersonKey(p);
    if (canonical) personKeyToIndex.set(canonical, index);
    const fallback = canonicalizePersonKey({
      prefix_name: null,
      first_name: p.first_name,
      middle_name: p.middle_name,
      last_name: p.last_name,
      suffix_name: p.suffix_name,
    });
    if (fallback && !personKeyToIndex.has(fallback))
      personKeyToIndex.set(fallback, index);
  });
  const companyEntries = Array.from(companyMap.entries());
  companies = companyEntries.map(([, name]) => ({
    name,
    request_identifier: parcelId,
  }));
  companyKeyToIndex = new Map();
  companyEntries.forEach(([normKey, name], idx) => {
    const index = idx + 1;
    if (normKey) companyKeyToIndex.set(normKey, index);
    const fallbackKey = normalizeCompanyKey(name);
    if (fallbackKey) companyKeyToIndex.set(fallbackKey, index);
  });
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  const mailingRecords = (Array.isArray(mailingAddresses)
    ? mailingAddresses.filter(Boolean)
    : []
  ).map((addr, idx) => {
    const record = {
      unnormalized_address: addr,
      latitude: null,
      longitude: null,
      source_http_request:
        mailingSource && mailingSource.source_http_request
          ? mailingSource.source_http_request
          : null,
      request_identifier:
        (mailingSource && mailingSource.request_identifier) || parcelId,
    };
    const fileName = `mailing_address_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), record);
    return { fileName, address: addr };
  });
  if (mailingRecords.length) {
    const currentOwners = ownersByDate.current || [];
    const usedMailingKeys = new Set();
    currentOwners.forEach((owner, idx) => {
      const target = mailingRecords[idx % mailingRecords.length];
      if (!target) return;
      if (owner.type === "person") {
        const pIdx = findPersonIndex(owner);
        if (!pIdx) return;
        const key = `person_${pIdx}`;
        if (usedMailingKeys.has(key)) return;
        usedMailingKeys.add(key);
        const relFile = relationshipFileName(
          `person_${pIdx}.json`,
          target.fileName,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./person_${pIdx}.json` },
          to: { "/": `./${target.fileName}` },
        });
      } else if (owner.type === "company") {
        const cIdx = findCompanyIndexByName(owner.name);
        if (!cIdx) return;
        const key = `company_${cIdx}`;
        if (usedMailingKeys.has(key)) return;
        usedMailingKeys.add(key);
        const relFile = relationshipFileName(
          `company_${cIdx}.json`,
          target.fileName,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./company_${cIdx}.json` },
          to: { "/": `./${target.fileName}` },
        });
      }
    });
  }
  const saleHistoryByDate = new Map();
  const saleHistoryByIndex = new Map();
  (saleHistoryMeta || []).forEach((meta) => {
    saleHistoryByIndex.set(meta.index, meta);
    if (meta.dateISO && !saleHistoryByDate.has(meta.dateISO)) {
      saleHistoryByDate.set(meta.dateISO, meta);
    }
  });

  const saleRelationshipKeys = new Set();

  sales.forEach((rec, idx) => {
    const dateISO = parseDateToISO(rec.saleDate);
    let meta = null;
    if (dateISO && saleHistoryByDate.has(dateISO)) {
      meta = saleHistoryByDate.get(dateISO);
    } else if (saleHistoryByIndex.has(idx + 1)) {
      meta = saleHistoryByIndex.get(idx + 1);
    }
    if (!meta) return;
    const ownersOnDate = (dateISO && ownersByDate[dateISO]) || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndex(o);
        if (!pIdx) return;
        const key = `person_${meta.index}_${pIdx}`;
        if (saleRelationshipKeys.has(key)) return;
        saleRelationshipKeys.add(key);
        const relFile = relationshipFileName(
          meta.saleHistoryFile,
          `person_${pIdx}.json`,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./${meta.saleHistoryFile}` },
          to: { "/": `./person_${pIdx}.json` },
        });
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (!cIdx) return;
        const key = `company_${meta.index}_${cIdx}`;
        if (saleRelationshipKeys.has(key)) return;
        saleRelationshipKeys.add(key);
        const relFile = relationshipFileName(
          meta.saleHistoryFile,
          `company_${cIdx}.json`,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./${meta.saleHistoryFile}` },
          to: { "/": `./company_${cIdx}.json` },
        });
      });
  });

  const latestSaleMeta = (saleHistoryMeta || [])
    .filter((meta) => meta.dateISO)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0] ||
    (saleHistoryMeta || [])[0] ||
    null;

  if (latestSaleMeta) {
    const currentOwners = ownersByDate.current || [];
    const latestKeys = new Set();
    currentOwners.forEach((owner) => {
      if (owner.type === "person") {
        const pIdx = findPersonIndex(owner);
        if (!pIdx) return;
        const key = `latest_person_${pIdx}`;
        if (latestKeys.has(key)) return;
        latestKeys.add(key);
        const relFile = relationshipFileName(
          latestSaleMeta.saleHistoryFile,
          `person_${pIdx}.json`,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./${latestSaleMeta.saleHistoryFile}` },
          to: { "/": `./person_${pIdx}.json` },
        });
      } else if (owner.type === "company") {
        const cIdx = findCompanyIndexByName(owner.name);
        if (!cIdx) return;
        const key = `latest_company_${cIdx}`;
        if (latestKeys.has(key)) return;
        latestKeys.add(key);
        const relFile = relationshipFileName(
          latestSaleMeta.saleHistoryFile,
          `company_${cIdx}.json`,
        );
        writeJSON(path.join("data", relFile), {
          from: { "/": `./${latestSaleMeta.saleHistoryFile}` },
          to: { "/": `./company_${cIdx}.json` },
        });
      }
    });
  }

  // Ensure all persons have at least one relationship (fallback for unused persons)
  const usedPersonIndices = new Set();

  // Collect all person indices that have relationships
  if (fs.existsSync("data")) {
    const dataFiles = fs.readdirSync("data");
    dataFiles.forEach((file) => {
      if (file.startsWith("relationship_") && file.endsWith(".json")) {
        try {
          const relContent = readJSON(path.join("data", file));
          if (relContent && relContent.from && relContent.from["/"]){
            const fromMatch = relContent.from["/"].match(/person_(\d+)\.json/);
            if (fromMatch) usedPersonIndices.add(parseInt(fromMatch[1], 10));
          }
          if (relContent && relContent.to && relContent.to["/"]){
            const toMatch = relContent.to["/"].match(/person_(\d+)\.json/);
            if (toMatch) usedPersonIndices.add(parseInt(toMatch[1], 10));
          }
        } catch (e) {
          // Ignore read errors for individual files
        }
      }
    });
  }

  // Create fallback relationships for unused persons
  people.forEach((person, idx) => {
    const personIndex = idx + 1;
    if (usedPersonIndices.has(personIndex)) {
      return; // Person already has relationships
    }

    // Link unused person to the latest sale history (if available)
    if (latestSaleMeta && latestSaleMeta.saleHistoryFile) {
      const relFile = relationshipFileName(
        latestSaleMeta.saleHistoryFile,
        `person_${personIndex}.json`,
      );
      writeJSON(path.join("data", relFile), {
        from: { "/": `./${latestSaleMeta.saleHistoryFile}` },
        to: { "/": `./person_${personIndex}.json` },
      });
    } else if (saleHistoryMeta && saleHistoryMeta.length > 0) {
      // If no latest sale, use the first sale
      const firstSale = saleHistoryMeta[0];
      const relFile = relationshipFileName(
        firstSale.saleHistoryFile,
        `person_${personIndex}.json`,
      );
      writeJSON(path.join("data", relFile), {
        from: { "/": `./${firstSale.saleHistoryFile}` },
        to: { "/": `./person_${personIndex}.json` },
      });
    }
  });

  // Ensure all companies have at least one relationship (fallback for unused companies)
  const usedCompanyIndices = new Set();

  // Collect all company indices that have relationships
  if (fs.existsSync("data")) {
    const dataFiles = fs.readdirSync("data");
    dataFiles.forEach((file) => {
      if (file.startsWith("relationship_") && file.endsWith(".json")) {
        try {
          const relContent = readJSON(path.join("data", file));
          if (relContent && relContent.from && relContent.from["/"]){
            const fromMatch = relContent.from["/"].match(/company_(\d+)\.json/);
            if (fromMatch) usedCompanyIndices.add(parseInt(fromMatch[1], 10));
          }
          if (relContent && relContent.to && relContent.to["/"]){
            const toMatch = relContent.to["/"].match(/company_(\d+)\.json/);
            if (toMatch) usedCompanyIndices.add(parseInt(toMatch[1], 10));
          }
        } catch (e) {
          // Ignore read errors for individual files
        }
      }
    });
  }

  // Create fallback relationships for unused companies
  companies.forEach((company, idx) => {
    const companyIndex = idx + 1;
    if (usedCompanyIndices.has(companyIndex)) {
      return; // Company already has relationships
    }

    // Link unused company to the latest sale history (if available)
    if (latestSaleMeta && latestSaleMeta.saleHistoryFile) {
      const relFile = relationshipFileName(
        latestSaleMeta.saleHistoryFile,
        `company_${companyIndex}.json`,
      );
      writeJSON(path.join("data", relFile), {
        from: { "/": `./${latestSaleMeta.saleHistoryFile}` },
        to: { "/": `./company_${companyIndex}.json` },
      });
    } else if (saleHistoryMeta && saleHistoryMeta.length > 0) {
      // If no latest sale, use the first sale
      const firstSale = saleHistoryMeta[0];
      const relFile = relationshipFileName(
        firstSale.saleHistoryFile,
        `company_${companyIndex}.json`,
      );
      writeJSON(path.join("data", relFile), {
        from: { "/": `./${firstSale.saleHistoryFile}` },
        to: { "/": `./company_${companyIndex}.json` },
      });
    }
  });
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

function cleanupUtilityArtifacts() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        f === "utility.json" ||
        /^utility(_\d+)?\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      } else if (
        /^relationship_layout_.*_has_utility_.*\.json$/i.test(f) ||
        /^relationship_layout_.*_utility_.*\.json$/i.test(f) ||
        /^relationship_property\.json_has_utility_.*\.json$/i.test(f) ||
        /^relationship_property_.*_utility_.*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function cleanupStructureArtifacts() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        f === "structure.json" ||
        /^structure(_\d+)?\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      } else if (
        /^relationship_layout_.*_has_structure_.*\.json$/i.test(f) ||
        /^relationship_layout_.*_structure_.*\.json$/i.test(f) ||
        /^relationship_property\.json_has_structure_.*\.json$/i.test(f) ||
        /^relationship_property_.*_structure_.*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function cleanupLayoutArtifacts() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^layout_\d+\.json$/i.test(f)) {
        fs.unlinkSync(path.join("data", f));
      } else if (/^relationship_layout_.*\.json$/i.test(f)) {
        fs.unlinkSync(path.join("data", f));
      } else if (
        /^relationship_property_has_layout_\d+\.json$/i.test(f) ||
        /^relationship_property\.json_has_layout_.*\.json$/i.test(f) ||
        /^relationship_property_.*_layout_.*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeUtility(parcelId) {
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  if (!utils) return [];
  const key = `property_${parcelId}`;
  const record = utils[key];
  if (!record) return [];
  let buildingEntries = [];
  if (Array.isArray(record.buildings) && record.buildings.length) {
    buildingEntries = record.buildings;
  } else if (record && typeof record === "object" && Object.keys(record).length) {
    const {
      buildings: _ignoredUtilityBuildings,
      extra_features: _ignoredUtilityExtras,
      ...utilityFields
    } = record;
    buildingEntries = [
      { building_id: "building_1", utility: utilityFields },
    ];
  }
  if (!buildingEntries.length) {
    cleanupUtilityArtifacts();
    return [];
  }
  cleanupUtilityArtifacts();
  const meta = [];
  buildingEntries.forEach((entry, idx) => {
    const buildingId = entry.building_id || `building_${idx + 1}`;
    const utilityObj = applyUtilityDefaults({ ...(entry.utility || {}) });
    utilityObj.request_identifier = parcelId;
    const fileName = `utility_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), utilityObj);
    meta.push({
      building_id: buildingId,
      fileName,
      index: idx + 1,
      is_extra: !!entry.is_extra,
    });
  });
  return meta;
}

function writeStructure(parcelId) {
  const structures = readJSON(path.join("owners", "structure_data.json"));
  if (!structures) return [];
  const key = `property_${parcelId}`;
  const record = structures[key];
  if (!record) return [];
  let buildingEntries = [];
  if (Array.isArray(record.buildings) && record.buildings.length) {
    buildingEntries = record.buildings;
  } else if (record && typeof record === "object" && Object.keys(record).length) {
    const {
      buildings: _ignoredStructureBuildings,
      extra_features: _ignoredStructureExtras,
      ...structureFields
    } = record;
    buildingEntries = [
      { building_id: "building_1", structure: structureFields },
    ];
  }
  if (!buildingEntries.length) {
    cleanupStructureArtifacts();
    return [];
  }
  cleanupStructureArtifacts();
  const meta = [];
  buildingEntries.forEach((entry, idx) => {
    const buildingId = entry.building_id || `building_${idx + 1}`;
    const structureObj = applyStructureDefaults({ ...(entry.structure || {}) });
    structureObj.request_identifier = parcelId;
    const fileName = `structure_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), structureObj);
    meta.push({
      building_id: buildingId,
      fileName,
      index: idx + 1,
      is_extra: !!entry.is_extra,
    });
  });
  return meta;
}

function writeLayout(parcelId, utilityMeta, structureMeta) {
  const layouts = readJSON(path.join("owners", "layout_data.json"));
  if (!layouts) return;
  const key = `property_${parcelId}`;
  const record = layouts[key] || {};
  const buildingEntries = Array.isArray(record.buildings) ? record.buildings : [];
  const extraFeatures = Array.isArray(record.extra_features)
    ? record.extra_features
    : [];
  const hasReferencedBuildings =
    (utilityMeta || []).some((entry) => entry && entry.building_id) ||
    (structureMeta || []).some((entry) => entry && entry.building_id);
  if (!buildingEntries.length && !hasReferencedBuildings && !extraFeatures.length) {
    cleanupLayoutArtifacts();
    return;
  }
  cleanupLayoutArtifacts();

  let layoutCounter = 0;
  const relationshipsWritten = new Set();
  const writeRelationshipLink = (fromFile, toFile) => {
    const relFile = relationshipFileName(fromFile, toFile);
    if (relationshipsWritten.has(relFile)) return;
    relationshipsWritten.add(relFile);
    writeJSON(path.join("data", relFile), {
      from: { "/": `./${fromFile}` },
      to: { "/": `./${toFile}` },
    });
  };
  const createLayout = (layoutObj, meta = {}) => {
    layoutCounter += 1;
    const fileName = `layout_${layoutCounter}.json`;
    const layoutToWrite = applyLayoutDefaults({ ...layoutObj });
    layoutToWrite.request_identifier = parcelId;
    if (
      layoutToWrite.space_type_index !== null &&
      layoutToWrite.space_type_index !== undefined
    ) {
      layoutToWrite.space_type_index = String(layoutToWrite.space_type_index);
    }
    if (
      layoutToWrite.building_number !== null &&
      layoutToWrite.building_number !== undefined &&
      layoutToWrite.building_number !== ""
    ) {
      const numericBuildingNumber = Number(layoutToWrite.building_number);
      if (Number.isFinite(numericBuildingNumber))
        layoutToWrite.building_number = numericBuildingNumber;
    }
    writeJSON(path.join("data", fileName), layoutToWrite);
    return {
      fileName,
      layoutId: layoutCounter,
      space_type: layoutToWrite.space_type || null,
      space_type_index: layoutToWrite.space_type_index || null,
      ...meta,
    };
  };

  const buildingLayoutsMeta = [];
  const layoutByBuildingId = new Map();
  buildingEntries.forEach((building, idx) => {
    const buildingId = building.building_id || `building_${idx + 1}`;
    const spaceIndexBase = String(idx + 1);
    const buildingSpaceIndex = building.space_type_index
      ? String(building.space_type_index)
      : spaceIndexBase;
    const buildingLayout = createLayout(
      {
        space_type: "Building",
        space_type_index: buildingSpaceIndex,
        total_area_sq_ft: building.total_area_sq_ft ?? null,
        livable_area_sq_ft: building.livable_area_sq_ft ?? null,
        size_square_feet: building.total_area_sq_ft ?? null,
        heated_area_sq_ft: building.livable_area_sq_ft ?? null,
        building_number: idx + 1,
      },
      {
        building_id: buildingId,
        is_extra: !!building.is_extra,
      },
    );
    buildingLayout.childCounter = 0;
    buildingLayoutsMeta.push(buildingLayout);
    layoutByBuildingId.set(buildingId, buildingLayout);
    writeRelationshipLink("property.json", buildingLayout.fileName);

    const floors = Array.isArray(building.floors) ? building.floors : [];
    const rooms = Array.isArray(building.rooms) ? building.rooms : [];

    if (floors.length) {
      floors.forEach((floor) => {
        const floorChildIndex = `${buildingLayout.space_type_index}.${buildingLayout.childCounter + 1}`;
        buildingLayout.childCounter += 1;
        const floorLayout = createLayout({
          space_type: floor.space_type || "Floor",
          space_type_index: floorChildIndex,
          size_square_feet: floor.total_area_sq_ft ?? null,
          floor_level: floor.floor_number ?? null,
        });
        floorLayout.childCounter = 0;
        writeRelationshipLink(buildingLayout.fileName, floorLayout.fileName);
        const floorRooms = Array.isArray(floor.rooms) ? floor.rooms : [];
        floorRooms.forEach((room) => {
          const count = parseInt(room.count, 10) || 0;
          for (let i = 0; i < count; i += 1) {
            const roomIndex = `${floorLayout.space_type_index}.${floorLayout.childCounter + 1}`;
            floorLayout.childCounter += 1;
            const roomLayout = createLayout({
              space_type: room.space_type || "Room",
              space_type_index: roomIndex,
              size_square_feet: room.size_square_feet ?? null,
              floor_level: floor.floor_number ?? null,
            });
            writeRelationshipLink(floorLayout.fileName, roomLayout.fileName);
          }
        });
      });
    } else {
      rooms.forEach((room) => {
        const count = parseInt(room.count, 10) || 0;
        for (let i = 0; i < count; i += 1) {
          const roomIndex = `${buildingLayout.space_type_index}.${buildingLayout.childCounter + 1}`;
          buildingLayout.childCounter += 1;
          const roomLayout = createLayout({
            space_type: room.space_type || "Room",
            space_type_index: roomIndex,
            size_square_feet: room.size_square_feet ?? null,
          });
          writeRelationshipLink(buildingLayout.fileName, roomLayout.fileName);
        }
      });
    }
  });

  const referencedBuildingIds = new Set();
  (utilityMeta || []).forEach((entry) => {
    if (entry && entry.building_id) referencedBuildingIds.add(entry.building_id);
  });
  (structureMeta || []).forEach((entry) => {
    if (entry && entry.building_id) referencedBuildingIds.add(entry.building_id);
  });

  referencedBuildingIds.forEach((buildingId) => {
    if (layoutByBuildingId.has(buildingId)) return;
    const numberMatch = String(buildingId).match(/(\d+)/);
    const buildingNumber = numberMatch ? numberMatch[1] : String(buildingLayoutsMeta.length + 1);
    const placeholder = createLayout(
      {
        space_type: "Building",
        space_type_index: buildingNumber,
        total_area_sq_ft: null,
        livable_area_sq_ft: null,
        size_square_feet: null,
        heated_area_sq_ft: null,
        building_number: Number(buildingNumber),
      },
      { building_id: buildingId, is_extra: false, is_placeholder: true },
    );
    placeholder.childCounter = 0;
    buildingLayoutsMeta.push(placeholder);
    layoutByBuildingId.set(buildingId, placeholder);
    writeRelationshipLink("property.json", placeholder.fileName);
  });

  const multiBuilding = buildingLayoutsMeta.length > 1;
  const propertyUtilityOnly =
    multiBuilding && (utilityMeta || []).length === 1;
  const propertyStructureOnly =
    multiBuilding && (structureMeta || []).length === 1;

  const attachAncillary = (layoutMeta) => {
    const targetId = layoutMeta.building_id;
    if (!targetId) return;
    if (!propertyUtilityOnly && (!multiBuilding || !layoutMeta.is_extra)) {
      const utilitiesForBuilding = (utilityMeta || []).filter(
        (entry) =>
          !entry.mapped &&
          entry.building_id === targetId &&
          (!layoutMeta.is_extra || !entry.is_extra),
      );
      utilitiesForBuilding.forEach((entry) => {
        writeRelationshipLink(layoutMeta.fileName, entry.fileName);
        entry.mapped = true;
      });
    }
    if (!propertyStructureOnly && (!multiBuilding || !layoutMeta.is_extra)) {
      const structuresForBuilding = (structureMeta || []).filter(
        (entry) =>
          !entry.mapped &&
          entry.building_id === targetId &&
          (!layoutMeta.is_extra || !entry.is_extra),
      );
      structuresForBuilding.forEach((entry) => {
        writeRelationshipLink(layoutMeta.fileName, entry.fileName);
        entry.mapped = true;
      });
    }
  };

  buildingLayoutsMeta.forEach(attachAncillary);

  let propertyFeatureCounter = 0;

  extraFeatures.forEach((feature) => {
    const hint = feature && feature.layout_hint ? feature.layout_hint : null;
    if (!hint || !hint.space_type) return;
    const spaceType = hint.space_type;
    const sizeSqFt = Number.isFinite(hint.size_square_feet)
      ? hint.size_square_feet
      : null;
    let parentMeta = null;
    let spaceTypeIndex = null;
    if (buildingLayoutsMeta.length === 1) {
      parentMeta = buildingLayoutsMeta[0];
      spaceTypeIndex = `${parentMeta.space_type_index}.${parentMeta.childCounter + 1}`;
      parentMeta.childCounter += 1;
    } else {
      propertyFeatureCounter += 1;
      spaceTypeIndex = `0.${propertyFeatureCounter}`;
    }
    const featureLayoutObj = {
      space_type: spaceType,
      space_type_index: spaceTypeIndex,
      size_square_feet: sizeSqFt,
      total_area_sq_ft: sizeSqFt,
      built_year: feature && feature.year_built ? feature.year_built : null,
    };
    if (typeof hint.is_exterior === "boolean")
      featureLayoutObj.is_exterior = hint.is_exterior;
    const featureLayout = createLayout(featureLayoutObj);
    if (parentMeta) {
      writeRelationshipLink(parentMeta.fileName, featureLayout.fileName);
    } else {
      writeRelationshipLink("property.json", featureLayout.fileName);
    }
  });

  const remainingUtilities = (utilityMeta || []).filter(
    (entry) => !entry.mapped,
  );
  if (remainingUtilities.length) {
    if (buildingLayoutsMeta.length === 1) {
      const targetLayout = buildingLayoutsMeta[0];
      remainingUtilities.forEach((entry) => {
        writeRelationshipLink(targetLayout.fileName, entry.fileName);
        entry.mapped = true;
      });
    } else {
      remainingUtilities.forEach((entry) => {
        writeRelationshipLink("property.json", entry.fileName);
        entry.mapped = true;
      });
    }
  }

  const remainingStructures = (structureMeta || []).filter(
    (entry) => !entry.mapped,
  );
  if (remainingStructures.length) {
    if (buildingLayoutsMeta.length === 1) {
      const targetLayout = buildingLayoutsMeta[0];
      remainingStructures.forEach((entry) => {
        writeRelationshipLink(targetLayout.fileName, entry.fileName);
        entry.mapped = true;
      });
    } else {
      remainingStructures.forEach((entry) => {
        writeRelationshipLink("property.json", entry.fileName);
        entry.mapped = true;
      });
    }
  }
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($(tr).find("td span"));
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function normalizeSuffix(s) {
  if (!s) return null;
  const map = {
    ALY: "Aly",
    AVE: "Ave",
    AV: "Ave",
    BLVD: "Blvd",
    BND: "Bnd",
    CIR: "Cir",
    CIRS: "Cirs",
    CRK: "Crk",
    CT: "Ct",
    CTR: "Ctr",
    CTRS: "Ctrs",
    CV: "Cv",
    CYN: "Cyn",
    DR: "Dr",
    DRS: "Drs",
    EXPY: "Expy",
    FWY: "Fwy",
    GRN: "Grn",
    GRNS: "Grns",
    GRV: "Grv",
    GRVS: "Grvs",
    HWY: "Hwy",
    HL: "Hl",
    HLS: "Hls",
    HOLW: "Holw",
    JCT: "Jct",
    JCTS: "Jcts",
    LN: "Ln",
    LOOP: "Loop",
    MALL: "Mall",
    MDW: "Mdw",
    MDWS: "Mdws",
    MEWS: "Mews",
    ML: "Ml",
    MNRS: "Mnrs",
    MT: "Mt",
    MTN: "Mtn",
    MTNS: "Mtns",
    OPAS: "Opas",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PATH: "Path",
    PIKE: "Pike",
    PL: "Pl",
    PLN: "Pln",
    PLNS: "Plns",
    PLZ: "Plz",
    PT: "Pt",
    PTS: "Pts",
    PNE: "Pne",
    PNES: "Pnes",
    RADL: "Radl",
    RD: "Rd",
    RDG: "Rdg",
    RDGS: "Rdgs",
    RIV: "Riv",
    ROW: "Row",
    RTE: "Rte",
    RUN: "Run",
    SHL: "Shl",
    SHLS: "Shls",
    SHR: "Shr",
    SHRS: "Shrs",
    SMT: "Smt",
    SQ: "Sq",
    SQS: "Sqs",
    ST: "St",
    STA: "Sta",
    STRA: "Stra",
    STRM: "Strm",
    TER: "Ter",
    TPKE: "Tpke",
    TRL: "Trl",
    TRCE: "Trce",
    UN: "Un",
    VIS: "Vis",
    VLY: "Vly",
    VLYS: "Vlys",
    VIA: "Via",
    VL: "Vl",
    VLGS: "Vlgs",
    VWS: "Vws",
    WALK: "Walk",
    WALL: "Wall",
    WAY: "Way",
  };
  const key = s.toUpperCase().trim();
  if (map[key]) return map[key];
  return null;
}

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function attemptWriteAddress(unnorm, secTwpRng) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return;
  const countyName = (unnorm && unnorm.county_jurisdiction
    ? unnorm.county_jurisdiction.trim()
    : "") || null;

  const address = {
    unnormalized_address: full,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    source_http_request:
      (unnorm && unnorm.source_http_request) || null,
    request_identifier:
      (unnorm && unnorm.request_identifier) || null,
    county_name: countyName,
    country_code: "US",
  };
  writeJSON(path.join("data", "address.json"), address);

  const latValue =
    unnorm && unnorm.latitude != null ? Number(unnorm.latitude) : null;
  const lonValue =
    unnorm && unnorm.longitude != null ? Number(unnorm.longitude) : null;
  const geometry = {
    latitude:
      Number.isFinite(latValue) ? latValue : null,
    longitude:
      Number.isFinite(lonValue) ? lonValue : null,
    source_http_request:
      (unnorm && unnorm.source_http_request) || null,
    request_identifier:
      (unnorm && unnorm.request_identifier) || null,
  };
  writeJSON(path.join("data", "geometry.json"), geometry);

  const addressGeometryRel = relationshipFileName(
    "address.json",
    "geometry.json",
  );
  writeJSON(path.join("data", addressGeometryRel), {
    from: { "/": "./address.json" },
    to: { "/": "./geometry.json" },
  });
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");
  const mailingAddresses = extractMailingAddresses($);

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message:" Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }
  if (parcelId) writeProperty($, parcelId);

  const sales = extractSales($);
  const saleHistoryMeta = writeSalesHistoryDeedsAndFiles(
    parcelId || (propertySeed && propertySeed.request_identifier) || null,
    sales,
  );

  writeTaxes($);

  if (parcelId) {
    const mailingSource = {
      source_http_request:
        (propertySeed && propertySeed.source_http_request) ||
        (unnormalized && unnormalized.source_http_request) ||
        null,
      request_identifier:
        (propertySeed && propertySeed.request_identifier) ||
        (unnormalized && unnormalized.request_identifier) ||
        parcelId,
    };
    const utilityMeta = writeUtility(parcelId);
    const structureMeta = writeStructure(parcelId);
    writePersonCompaniesSalesRelationships(
      parcelId,
      sales,
      mailingAddresses,
      mailingSource,
      saleHistoryMeta,
    );
    // writeOwnersCurrentAndRelationships(parcelId);
    // writeHistoricalBuyerPersonsAndRelationships(parcelId, sales);
    writeLayout(parcelId, utilityMeta, structureMeta);
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
