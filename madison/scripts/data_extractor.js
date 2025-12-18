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

// Updated CSS Selectors
const PARCEL_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_divSummary table tbody tr";
// The HTML provided does not have a section explicitly titled "Buildings".
// The original `collectBuildings` function will return an empty array for this HTML.
// If building data is present in other sections, `collectBuildings` needs to be adapted.
const BUILDING_SECTION_TITLE = "Buildings"; // Not directly used for extraction in this HTML
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl14_ctl01_grdSales tbody tr"; // Updated for sales table
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl09_ctl01_grdValuation"; // Updated for valuation table
const PERMITS_TABLE_SELECTOR = "#ctlBodyPane_ctl13_ctl01_grdPermits tbody tr";


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

const DEFAULT_PROPERTY_MAPPING = Object.freeze({
  property_type: "LandParcel",
  property_usage_type: "Unknown",
  build_status: null,
  structure_form: null,
  ownership_estate_type: null,
});

const FEE_SIMPLE = "FeeSimple";

function normalizeUseCodeKey(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toUpperCase();
  const replacements = {
    "<": "LT",
    ">": "GT",
    "+": "PLUS",
    "&": "AND",
    "@": "AT",
    "%": "PCT",
    "$": "USD",
  };
  Object.entries(replacements).forEach(([from, to]) => {
    if (s.includes(from)) s = s.split(from).join(to);
  });
  s = s.replace(/[^A-Z0-9]/g, "");
  return s || null;
}

function createMapping(overrides) {
  return Object.freeze({ ...DEFAULT_PROPERTY_MAPPING, ...overrides });
}

const PROPERTY_USE_MAPPINGS = Object.freeze({
  [normalizeUseCodeKey("APIARY, BEEYARD")]: createMapping({
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("AUTO SALES/REPAIR")]: createMapping({
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CAMPS")]: createMapping({
    property_type: "Building",
    property_usage_type: "Recreational",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CANNERIES/BOTTLERS")]: createMapping({
    property_type: "Building",
    property_usage_type: "Cannery",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CAR WASH")]: createMapping({
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CENTRALLY ASSED")]: createMapping({
    property_usage_type: "Unknown",
  }),
  [normalizeUseCodeKey("CHURCHES")]: createMapping({
    property_type: "Building",
    property_usage_type: "Church",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CLUBS/LODGES/HALLS")]: createMapping({
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("COMMUNITY SHOPPING")]: createMapping({
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CONSERVATION EASEMENT")]: createMapping({
    property_usage_type: "Conservation",
    build_status: "VacantLand",
    ownership_estate_type: "OtherEstate",
  }),
  [normalizeUseCodeKey("COUNTY")]: createMapping({
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CROP III")]: createMapping({
    property_usage_type: "CroplandClass3",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("CROPLAND CLS2")]: createMapping({
    property_usage_type: "CroplandClass2",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("DAY CARE")]: createMapping({
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("DEPARTMNT STORE")]: createMapping({
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("DRIVE-IN REST.")]: createMapping({
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("ENC ARENAS")]: createMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("EXCEPT INDUST")]: createMapping({
    property_type: "Building",
    property_usage_type: "Industrial",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("FEDERAL IMP")]: createMapping({
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("FINANCIAL BLDG")]: createMapping({
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("FORESTRY NURSERY")]: createMapping({
    property_usage_type: "NurseryGreenhouse",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("GOVT VAC")]: createMapping({
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("GROVES,ORCHRD")]: createMapping({
    property_usage_type: "OrchardGroves",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("HAY/SILAGE")]: createMapping({
    property_usage_type: "HayMeadow",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("HEAVY INDUSTRL")]: createMapping({
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("HOMES FOR THE AGED")]: createMapping({
    property_type: "Building",
    property_usage_type: "HomesForAged",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("HOSPITAL")]: createMapping({
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("HOTELS/MOTELS")]: createMapping({
    property_type: "Building",
    property_usage_type: "Hotel",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("INSURANCE COMP")]: createMapping({
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("LIGHT MANUFACTURE")]: createMapping({
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("LOADING DOCK")]: createMapping({
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("LUMBER YARD")]: createMapping({
    property_type: "Building",
    property_usage_type: "LumberYard",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MINI STORAGE")]: createMapping({
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MISC IMPROVED")]: createMapping({
    property_type: "Building",
    property_usage_type: "Unknown",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MOBILE HOME")]: createMapping({
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "ManufacturedHousing",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MOM & POP RESTAURANT")]: createMapping({
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MORTUARY/CEMETARY")]: createMapping({
    property_usage_type: "MortuaryCemetery",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MULTI-FAM <10")]: createMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "MultiFamilyLessThan10",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MULTI-FAM 10+")]: createMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MUNICIPAL IMP")]: createMapping({
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("MXD RES/OFF/STO")]: createMapping({
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("NIGHTCLUB/LOUNGES/BARS")]: createMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("NON AG ACREAGE")]: createMapping({
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("NON-PROFIT / ORPHANA")]: createMapping({
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("OFFCE BLD M/STY")]: createMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("OFFICE BLD 1STY")]: createMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("OFFICE BUILDING 2")]: createMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("OTHER FOOD PROCESS")]: createMapping({
    property_type: "Building",
    property_usage_type: "AgriculturalPackingFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PACKING PLANTS")]: createMapping({
    property_type: "Building",
    property_usage_type: "PackingPlant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PASTURE AVER 7")]: createMapping({
    property_usage_type: "ImprovedPasture",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PECAN TREES")]: createMapping({
    property_usage_type: "OrchardGroves",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("POST OFFICE")]: createMapping({
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("POULT,BEES,FISH, ETC")]: createMapping({
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PROFESS SVC/BLD")]: createMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PRVT SCHL/DAY CARE")]: createMapping({
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("PUB SCHL IMP")]: createMapping({
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("REC AND PARK LAND")]: createMapping({
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("REPAIR SERVICE")]: createMapping({
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("REST HOMES")]: createMapping({
    property_type: "Building",
    property_usage_type: "HomesForAged",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("RESTAURANT/CAFE")]: createMapping({
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("RIGHTS-OF-WAY")]: createMapping({
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
  }),
  [normalizeUseCodeKey("RIVERS, STREAMS")]: createMapping({
    property_usage_type: "RiversLakes",
    build_status: "VacantLand",
    ownership_estate_type: "OtherEstate",
  }),
  [normalizeUseCodeKey("ROADS,ESMTS R/W")]: createMapping({
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
  }),
  [normalizeUseCodeKey("RV/MH,PK LOT")]: createMapping({
    property_usage_type: "MobileHomePark",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("SERVICE STATION")]: createMapping({
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("SINGLE FAMILY")]: createMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "SingleFamilyDetached",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STATE")]: createMapping({
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STATE TIITF")]: createMapping({
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STORE, METAL PRE-FAB")]: createMapping({
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STORE, NBHD, CONVEN.")]: createMapping({
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STORE,NBHD,CONVENIEN")]: createMapping({
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("STORES/1 STORY")]: createMapping({
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("SUPERMARKET")]: createMapping({
    property_type: "Building",
    property_usage_type: "Supermarket",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("SWAMP PRODUCTIVE")]: createMapping({
    property_usage_type: "Conservation",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND 50-59")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND 60-69")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND 80-89")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND MIXED")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND NATURAL")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TIMBERLAND PLANTED")]: createMapping({
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TOURIST ATTRACTION")]: createMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("TRUCK STOP")]: createMapping({
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("UTILITIES")]: createMapping({
    property_type: "Building",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("VAC INSTITUTIONAL")]: createMapping({
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("VACANT")]: createMapping({
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("VACANT COMMERCIAL")]: createMapping({
    property_usage_type: "Commercial",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("VACANT INDUSTRIAL")]: createMapping({
    property_usage_type: "Industrial",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("VEH SALE/REPAIR")]: createMapping({
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("WAREHOSE/DISTRB")]: createMapping({
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  }),
  [normalizeUseCodeKey("WASTE NON-PRODUCTIVE")]: createMapping({
    property_usage_type: "SewageDisposal",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  }),
});

function parseUseCode(raw) {
  const str = String(raw || "").trim();
  const match = str.match(/^(.*?)(?:\(([^)]+)\))?$/);
  const label = match ? match[1].trim() : str;
  const code = match && match[2] ? match[2].trim() : null;
  return { label, code };
}

function mapPropertyFromUseCode(useCodeRaw) {
  if (!useCodeRaw) return DEFAULT_PROPERTY_MAPPING;
  const { label, code } = parseUseCode(useCodeRaw);
  const labelKey = normalizeUseCodeKey(label);
  if (labelKey && PROPERTY_USE_MAPPINGS[labelKey]) {
    return PROPERTY_USE_MAPPINGS[labelKey];
  }
  if (code) {
    const codeKey = normalizeUseCodeKey(code);
    if (codeKey && PROPERTY_USE_MAPPINGS[codeKey]) {
      return PROPERTY_USE_MAPPINGS[codeKey];
    }
  }
  console.warn(`Unknown property use code encountered: ${useCodeRaw}`);
  return DEFAULT_PROPERTY_MAPPING;
}

function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function removeMatchingDataFiles(patterns) {
  let files = [];
  try {
    files = fs.readdirSync("data");
  } catch (e) {
    return;
  }
  files.forEach((file) => {
    if (patterns.some((regex) => regex.test(file))) {
      try {
        fs.unlinkSync(path.join("data", file));
      } catch (e) {}
    }
  });
}

function baseName(fileName) {
  return fileName.replace(/\.json$/i, "");
}

function writeRelationship(fromFile, toFile) {
  const fromBase = baseName(fromFile);
  const toBase = baseName(toFile);
  const relFile = `relationship_${fromBase}_has_${toBase}.json`;
  const relationship = {
    from: { "/": `./${fromFile}` },
    to: { "/": `./${toFile}` },
  };
  writeJSON(path.join("data", relFile), relationship);
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

// --- NEW HELPER FUNCTION FOR FLEXIBLE LABEL EXTRACTION ---
function getFlexibleLabelText($row) {
  let label = textOf($row.find("th strong")); // Try th strong first
  if (!label) {
    label = textOf($row.find("td strong")); // Then try td strong
  }
  if (!label) {
    label = textOf($row.find("th:first-child")); // Then try th directly
  }
  if (!label) {
    label = textOf($row.find("td:first-child")); // Finally try td directly
  }
  return label;
}
// --- END NEW HELPER FUNCTION ---


function extractLegalDescription($) {
  let desc = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getFlexibleLabelText($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("brief tax description")) { // Updated label
      desc = textOf($tr.find("td div span")); // Legal description is in a span inside a div
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
    const label = getFlexibleLabelText($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("property use code")) {
      code = textOf($tr.find("td div span")); // Use code is in a span inside a div
      return false; // Stop iterating once found
    }
  });
  return code || null;
}

function collectBuildings($) {
  const buildings = [];
  // The provided HTML does not have a "Buildings" section with the structure
  // that the original `collectBuildings` function expects.
  // For this HTML, we'll extract "Year Built" from the "Extra Features" section
  // and "Building Value" from the "Valuation" section as a proxy for building data.

  // Extract "Year Built" from "Extra Features"
  const extraFeaturesSection = $("#ctlBodyPane_ctl12_mSection");
  if (extraFeaturesSection.length) {
    const extraFeaturesTable = extraFeaturesSection.find("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
    extraFeaturesTable.find("tr").each((_, tr) => {
      const cells = $(tr).find("th, td");
      const yearBuilt = textTrim(cells.eq(4).text()); // Year Built is the 5th column (index 4)
      if (yearBuilt) {
        buildings.push({ "Actual Year Built": yearBuilt });
      }
    });
  }

  // Extract "Building Value" from "Valuation"
  const valuationSection = $("#ctlBodyPane_ctl09_mSection");
  if (valuationSection.length) {
    const valuationTable = valuationSection.find("#ctlBodyPane_ctl09_ctl01_grdValuation tbody");
    valuationTable.find("tr").each((_, tr) => {
      const label = textTrim($(tr).find("th").first().text()); // Valuation table labels are typically <th>
      if (label === "Building Value") {
        const value = textTrim($(tr).find("td.value-column").first().text()); // Get the first value column (2025 Working Values)
        if (value) {
          // If we already have a building entry, add this info. Otherwise, create one.
          if (buildings.length > 0) {
            buildings[0]["Building Value"] = value;
          } else {
            buildings.push({ "Building Value": value });
          }
        }
      }
    });
  }

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
  // For this HTML, "Actual Year Built" is extracted from "Extra Features"
  buildings.forEach((b) => {
    if (b["Actual Year Built"]) {
      yearsActual.push(toInt(b["Actual Year Built"]));
    }
  });
  // "Effective Year Built" is not available in the provided HTML
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: null, // Not available in this HTML
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
function extractNamesFromHtmlCell($cell) {
  if (!$cell || $cell.length === 0) return [];
  const htmlContent = $cell.html();
  if (htmlContent && /<br\s*\/?>/i.test(htmlContent)) {
    return htmlContent
      .split(/<br\s*\/?>/i)
      .map((fragment) => {
        const wrapped = cheerio.load(`<div>${fragment}</div>`);
        return textTrim(wrapped.text());
      })
      .filter(Boolean);
  }
  const text = textTrim($cell.text());
  return text ? [text] : [];
}

function extractAnchorDisplayText($anchor) {
  if (!$anchor || !$anchor.length) return null;
  const clone = $anchor.clone();
  clone.find("span").remove();
  const txt = textTrim(clone.text());
  return txt || null;
}

function parseBookPage(raw) {
  if (!raw) return { book: null, page: null, volume: null };
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (match) {
    return { book: match[1], page: match[2], volume: null };
  }
  const alt = cleaned.match(/^BOOK\s*(\d+)\s+PAGE\s*(\d+)$/i);
  if (alt) {
    return { book: alt[1], page: alt[2], volume: null };
  }
  return { book: null, page: null, volume: null };
}

function mapSaleQualificationToSaleType(qualification, reason) {
  const q = (qualification || "").toLowerCase();
  const r = (reason || "").toLowerCase();
  if (q.includes("qual")) return "TypicallyMotivated";
  if (r.includes("probate")) return "ProbateSale";
  if (r.includes("relocation")) return "RelocationSale";
  if (r.includes("trustee") && r.includes("foreclosure"))
    return "TrusteeNonJudicialForeclosureSale";
  if (r.includes("foreclosure"))
    return "TrusteeJudicialForeclosureSale";
  return null;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("th, td");
    if (tds.length < 11) return;
    const saleDate = textOf($(tds[1]));
    const salePrice = textOf($(tds[2]));
    const instrument = textOf($(tds[3]));
    const bookPageCell = $(tds[4]);
    const anchorWithHref = bookPageCell.find("a[href]").first();
    const bookPageText =
      extractAnchorDisplayText(anchorWithHref) ||
      extractAnchorDisplayText(bookPageCell.find("a").first()) ||
      textTrim(bookPageCell.text()) ||
      null;
    const link = anchorWithHref.length ? anchorWithHref.attr("href") : null;
    const instrumentNumber = textOf($(tds[5]));
    const qualification = textOf($(tds[6]));
    const reason = textOf($(tds[7]));
    const vacantImproved = textOf($(tds[8]));
    const grantorNames = extractNamesFromHtmlCell($(tds[9]));
    const granteeNames = extractNamesFromHtmlCell($(tds[10]));
    const { book, page, volume } = parseBookPage(bookPageText);
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage: bookPageText || null,
      book,
      page,
      volume,
      instrumentNumber: instrumentNumber || null,
      qualification: qualification || null,
      reason: reason || null,
      vacantImproved: vacantImproved || null,
      link,
      grantorNames,
      granteeNames,
      saleType: mapSaleQualificationToSaleType(qualification, reason),
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const u = instr.trim().toUpperCase();
  const map = {
    WD: "Warranty Deed",
    GWD: "Warranty Deed",
    SW: "Special Warranty Deed",
    SWD: "Special Warranty Deed",
    QD: "Quitclaim Deed",
    QC: "Quitclaim Deed",
    QCD: "Quitclaim Deed",
    GD: "Grant Deed",
    TD: "Tax Deed",
    PR: "Personal Representative Deed",
    TR: "Trustee's Deed",
    DT: "Trustee's Deed",
    SA: "Sheriff's Deed",
    SD: "Sheriff's Deed",
    CD: "Correction Deed",
    LD: "Lady Bird Deed",
    JD: "Joint Tenancy Deed",
    JT: "Joint Tenancy Deed",
    TOD: "Transfer on Death Deed",
  };
  if (map[u]) return map[u];
  return "Miscellaneous";
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  // The header has a "2025 Working Values", "2025 Certified Values", etc.
  // We need to extract the year from these headers.
  const headerThs = table.find("thead tr th").toArray().slice(1); // Skip the first td (toggle column)
  headerThs.forEach((th, idx) => {
    const txt = $(th).text().trim();
    const match = txt.match(/(\d{4})/);
    if (match) {
      const y = parseInt(match[1], 10);
      if (!isNaN(y)) years.push({ year: y, idx });
    }
  });

  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    const label = textOf($tr.find("th")); // Valuation table labels are typically <th>
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

function mapImprovementType(description, code) {
  const desc = String(description || "").toUpperCase();
  if (desc.includes("ROOF")) return "Roofing";
  if (desc.includes("GENERATOR") || desc.includes("ELECT"))
    return "Electrical";
  if (desc.includes("HVAC") || desc.includes("A/C") || desc.includes("MECHANICAL"))
    return "MechanicalHVAC";
  if (desc.includes("PLUMB")) return "Plumbing";
  if (desc.includes("WINDOW") || desc.includes("DOOR"))
    return "ExteriorOpeningsAndFinishes";
  if (desc.includes("POOL")) return "PoolSpaInstallation";
  if (desc.includes("SCREEN")) return "ScreenEnclosure";
  if (desc.includes("FENCE")) return "Fencing";
  if (desc.includes("IRRIG")) return "LandscapeIrrigation";
  if (desc.includes("DECK")) return "SiteDevelopment";
  if (desc.includes("BATH")) return "GeneralBuilding";
  if (desc.includes("DEMOL")) return "Demolition";
  if (desc.includes("ADDITION") || desc.includes("ADD-ON"))
    return "BuildingAddition";
  if (
    desc.includes("SINGLE FAMILY") ||
    desc.includes("DWELLING") ||
    desc.includes("RESIDENTIAL") ||
    desc.includes("NEW HOME")
  )
    return "ResidentialConstruction";
  if (desc.includes("COMMERCIAL")) return "CommercialConstruction";

  const codeKey = String(code || "").trim();
  const codeMap = {
    "003": "Roofing",
    "006": "Electrical",
    "014": "Plumbing",
    "005": "GeneralBuilding",
  };
  if (codeKey && codeMap[codeKey]) return codeMap[codeKey];
  return "GeneralBuilding";
}

function mapImprovementAction(description) {
  const desc = String(description || "").toUpperCase();
  if (!desc) return null;
  if (desc.includes("GENERATOR")) return "New";
  if (desc.includes("ADDITION") || desc.includes("ADD-ON")) return "Addition";
  if (desc.includes("NEW") || desc.includes("INSTALL") || desc.includes("SET"))
    return "New";
  if (desc.includes("REROOF") || desc.includes("ROOF") || desc.includes("REPLACE"))
    return "Replacement";
  if (desc.includes("REPAIR")) return "Repair";
  if (desc.includes("DEMOL") || desc.includes("REMOVE")) return "Remove";
  return "Other";
}

function mapImprovementStatus(issueDate) {
  return issueDate ? "Permitted" : null;
}

function extractPermits($) {
  const permits = [];
  $(PERMITS_TABLE_SELECTOR).each((_, tr) => {
    const $tr = $(tr);
    const permitNumber = textTrim(
      $tr.find("span[id*='sprPermitNumberLabel']").text(),
    );
    if (!permitNumber) return;
    const cells = $tr.find("td");
    const typeCode = textTrim(cells.eq(1).text());
    const description = textTrim(cells.eq(2).text());
    const issuedRaw = textTrim(cells.eq(3).text());
    const amountRaw = textTrim(cells.eq(4).text());
    permits.push({
      permitNumber,
      typeCode,
      description,
      issueDateRaw: issuedRaw || null,
      issueDate: parseDateToISO(issuedRaw),
      amount: parseCurrencyToNumber(amountRaw),
    });
  });
  return permits;
}

function writePropertyImprovements($, parcelId) {
  removeMatchingDataFiles([
    /^property_improvement_\d+\.json$/i,
    /^relationship_property_has_property_improvement_\d+\.json$/i,
  ]);

  const permits = extractPermits($);
  if (!permits.length) return;

  permits.forEach((permit, idx) => {
    const fileName = `property_improvement_${idx + 1}.json`;
    const requestIdentifierParts = [];
    if (parcelId) requestIdentifierParts.push(parcelId);
    if (permit.permitNumber) {
      requestIdentifierParts.push(permit.permitNumber);
    } else {
      requestIdentifierParts.push(`permit-${idx + 1}`);
    }
    const requestIdentifier = requestIdentifierParts.join("-");

    const improvement = {
      application_received_date: null,
      completion_date: null,
      contractor_type: "Unknown",
      final_inspection_date: null,
      improvement_action: mapImprovementAction(permit.description),
      improvement_status: mapImprovementStatus(permit.issueDate),
      improvement_type: mapImprovementType(
        permit.description,
        permit.typeCode,
      ),
      is_disaster_recovery: null,
      is_owner_builder: null,
      permit_close_date: null,
      permit_issue_date: permit.issueDate,
      permit_number: permit.permitNumber || null,
      permit_required: true,
      private_provider_inspections: null,
      private_provider_plan_review: null,
      request_identifier: requestIdentifier || null,
    };
    if (permit.amount !== null) improvement.fee = permit.amount;

    writeJSON(path.join("data", fileName), improvement);
    writeRelationship("property.json", fileName);
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyAttributes = mapPropertyFromUseCode(useCode);
  const years = extractBuildingYears($);
  const totalArea = extractAreas($); // This is acreage for this HTML

  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    ownership_estate_type: propertyAttributes.ownership_estate_type,
    build_status: propertyAttributes.build_status,
    structure_form: propertyAttributes.structure_form,
    property_usage_type: propertyAttributes.property_usage_type,
    property_type: propertyAttributes.property_type,
    livable_floor_area: null, // Not available in this HTML
    total_area: totalArea > 0 ? String(totalArea) : null, // Ensure it matches the pattern ".*\d{2,}.*"
    number_of_units_type: null, // Not available in this HTML
    area_under_air: null, // Not available in this HTML
    number_of_units: null, // Not available in this HTML
    subdivision: null, // Not available in this HTML
    zoning: null, // Not available in this HTML
  };
  writeJSON(path.join("data", "property.json"), property);
  return {
    propertyAttributes,
    propertyType: propertyAttributes.property_type || null,
  };
}

function mapFileDocumentTypeForDeed() {
  return "Title";
}

function clearExistingSalesArtifacts() {
  let dataFiles = [];
  try {
    dataFiles = fs.readdirSync("data");
  } catch (e) {
    return;
  }
  dataFiles.forEach((f) => {
    if (
      /^(sales_\d+|sales_history_\d+|deed_\d+|file_\d+)\.json$/i.test(f) ||
      /^relationship_(deed_file|sales_deed|sales_person|sales_company|sales_history_deed|sales_history_person|sales_history_company)_\d+\.json$/i.test(
        f,
      )
    ) {
      try {
        fs.unlinkSync(path.join("data", f));
      } catch (e) {}
    }
  });
}

function writeSalesHistoryDeedsAndFiles($, parcelId) {
  const sales = extractSales($);
  clearExistingSalesArtifacts();
  const results = [];
  sales.forEach((s, i) => {
    const idx = i + 1;
    const isoDate = parseDateToISO(s.saleDate);
    const salesHistoryFile = `sales_history_${idx}.json`;
    const deedFile = `deed_${idx}.json`;
    const fileFile = `file_${idx}.json`;

    const salesHistoryObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
      sale_type: s.saleType || null,
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", salesHistoryFile), salesHistoryObj);

    const deedObj = {
      deed_type: mapInstrumentToDeedType(s.instrument),
      request_identifier: parcelId,
    };
    if (s.book) deedObj.book = String(s.book);
    if (s.page) deedObj.page = String(s.page);
    if (s.volume) deedObj.volume = String(s.volume);
    if (s.instrumentNumber) deedObj.instrument_number = String(s.instrumentNumber);
    writeJSON(path.join("data", deedFile), deedObj);

    const fileObj = {
      document_type: mapFileDocumentTypeForDeed(),
      file_format: null,
      ipfs_url: null,
      name: s.bookPage || "Deed Document",
      original_url: s.link || null,
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", fileFile), fileObj);

    const relDeedFile = {
      to: { "/": `./${fileFile}` },
      from: { "/": `./${deedFile}` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${idx}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      to: { "/": `./${deedFile}` },
      from: { "/": `./${salesHistoryFile}` },
    };
    writeJSON(
      path.join("data", `relationship_sales_history_deed_${idx}.json`),
      relSalesDeed,
    );

    results.push({
      index: idx,
      isoDate,
      salesHistoryRef: `./${salesHistoryFile}`,
      deedRef: `./${deedFile}`,
      granteeNames: s.granteeNames || [],
    });
  });
  return results;
}
let people = [];
let companies = [];
let personIndexByKey = new Map();
let companyIndexByKey = new Map();

function normalizePersonKey(owner) {
  if (!owner) return null;
  const prefix = owner.prefix_name ? titleCaseName(owner.prefix_name) : null;
  const first = owner.first_name ? titleCaseName(owner.first_name) : null;
  const middle = owner.middle_name ? titleCaseName(owner.middle_name) : null;
  const last = owner.last_name ? titleCaseName(owner.last_name) : null;
  const suffix = owner.suffix_name
    ? String(owner.suffix_name).trim()
    : null;
  if (!first || !last) return null;
  return [
    prefix ? prefix.toUpperCase() : "",
    first.toUpperCase(),
    middle ? middle.toUpperCase() : "",
    last.toUpperCase(),
    suffix ? suffix.toUpperCase() : "",
  ].join("|");
}

function normalizeCompanyKey(name) {
  if (!name) return null;
  return String(name).replace(/\s+/g, " ").trim().toUpperCase();
}

function buildPersonRecord(owner, parcelId) {
  const first = owner.first_name ? titleCaseName(owner.first_name) : null;
  const last = owner.last_name ? titleCaseName(owner.last_name) : null;
  if (!first || !last) return null;
  return {
    first_name: first,
    middle_name: owner.middle_name ? titleCaseName(owner.middle_name) : null,
    last_name: last,
    birth_date: null,
    prefix_name: owner.prefix_name ? titleCaseName(owner.prefix_name) : null,
    suffix_name: owner.suffix_name ? titleCaseName(owner.suffix_name) : null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  };
}

function registerPerson(owner, parcelId) {
  const record = buildPersonRecord(owner, parcelId);
  if (!record) return null;
  const key = normalizePersonKey(record);
  if (!key) return null;
  if (personIndexByKey.has(key)) return personIndexByKey.get(key);
  people.push(record);
  const idx = people.length;
  personIndexByKey.set(key, idx);
  writeJSON(path.join("data", `person_${idx}.json`), record);
  return idx;
}

function registerCompany(name, parcelId) {
  const key = normalizeCompanyKey(name);
  if (!key) return null;
  if (companyIndexByKey.has(key)) return companyIndexByKey.get(key);
  const record = {
    name: name,
    request_identifier: parcelId,
  };
  companies.push(record);
  const idx = companies.length;
  companyIndexByKey.set(key, idx);
  writeJSON(path.join("data", `company_${idx}.json`), record);
  return idx;
}

function findPersonIndex(owner) {
  const key = normalizePersonKey(owner);
  if (!key) return null;
  return personIndexByKey.get(key) || null;
}

function findCompanyIndexByName(name) {
  const key = normalizeCompanyKey(name);
  if (!key) return null;
  return companyIndexByKey.get(key) || null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writePersonCompaniesSalesRelationships(parcelId, salesRecords, propertySeed) {
  removeMatchingDataFiles([
    /^person_\d+\.json$/i,
    /^company_\d+\.json$/i,
    /^relationship_sales_history_person_\d+\.json$/i,
    /^relationship_sales_history_company_\d+\.json$/i,
    /^relationship_sales_person_\d+\.json$/i,
    /^relationship_sales_company_\d+\.json$/i,
  ]);
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const mailingAddressRaw = record.mailing_address || null;
  const normalizedSalesRecords = Array.isArray(salesRecords)
    ? salesRecords
    : [];

  // Initialize empty maps - persons and companies will be created on-demand
  // Only when they are actually referenced by relationships
  personIndexByKey = new Map();
  people = [];
  companyIndexByKey = new Map();
  companies = [];
  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  const personLinks = new Set();
  const companyLinks = new Set();

  normalizedSalesRecords.forEach((rec) => {
    if (!rec.isoDate) return;
    const ownersOnDate = ownersByDate[rec.isoDate] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        let pIdx = findPersonIndex(o);
        if (!pIdx) pIdx = registerPerson(o, parcelId);
        if (pIdx) {
          const relKey = `${rec.salesHistoryRef}|person|${pIdx}`;
          if (personLinks.has(relKey)) return;
          personLinks.add(relKey);
          relPersonCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_history_person_${relPersonCounter}.json`,
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": rec.salesHistoryRef },
            },
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        let cIdx = findCompanyIndexByName(o.name);
        if (!cIdx) cIdx = registerCompany(o.name, parcelId);
        if (cIdx) {
          const relKey = `${rec.salesHistoryRef}|company|${cIdx}`;
          if (companyLinks.has(relKey)) return;
          companyLinks.add(relKey);
          relCompanyCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_history_company_${relCompanyCounter}.json`,
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": rec.salesHistoryRef },
            },
          );
        }
      });
  });

  const currentOwners = ownersByDate.current || [];
  if (normalizedSalesRecords.length && currentOwners.length) {
    const latestSale = normalizedSalesRecords
      .filter((rec) => rec.isoDate)
      .sort((a, b) => (a.isoDate > b.isoDate ? -1 : a.isoDate < b.isoDate ? 1 : 0))[0];
    if (latestSale) {
      currentOwners.forEach((o) => {
        if (o.type === "person") {
          let pIdx = findPersonIndex(o);
          if (!pIdx) pIdx = registerPerson(o, parcelId);
          if (pIdx) {
            const relKey = `${latestSale.salesHistoryRef}|person|${pIdx}`;
            if (!personLinks.has(relKey)) {
              personLinks.add(relKey);
              relPersonCounter++;
              writeJSON(
                path.join(
                  "data",
                  `relationship_sales_history_person_${relPersonCounter}.json`,
                ),
                {
                  to: { "/": `./person_${pIdx}.json` },
                  from: { "/": latestSale.salesHistoryRef },
                },
              );
            }
          }
        } else if (o.type === "company") {
          let cIdx = findCompanyIndexByName(o.name);
          if (!cIdx) cIdx = registerCompany(o.name, parcelId);
          if (cIdx) {
            const relKey = `${latestSale.salesHistoryRef}|company|${cIdx}`;
            if (!companyLinks.has(relKey)) {
              companyLinks.add(relKey);
              relCompanyCounter++;
              writeJSON(
                path.join(
                  "data",
                  `relationship_sales_history_company_${relCompanyCounter}.json`,
                ),
                {
                  to: { "/": `./company_${cIdx}.json` },
                  from: { "/": latestSale.salesHistoryRef },
                },
              );
            }
          }
        }
      });
    }
  }

  let existingMailingRelFiles = [];
  try {
    existingMailingRelFiles = fs.readdirSync("data");
  } catch (e) {}
  existingMailingRelFiles
    .filter((file) =>
      /^relationship_(person|company)_\d+_has_mailing_address\.json$/.test(
        file,
      ),
    )
    .forEach((file) => {
      try {
        fs.unlinkSync(path.join("data", file));
      } catch (e) {}
    });

  const mailingAddressPath = path.join("data", "mailing_address.json");
  const trimmedMailingAddress = mailingAddressRaw
    ? mailingAddressRaw.replace(/\s+/g, " ").trim()
    : null;
  if (trimmedMailingAddress) {
    const mailingAddress = {
      unnormalized_address: trimmedMailingAddress,
      latitude: null,
      longitude: null,
      source_http_request:
        (propertySeed && propertySeed.source_http_request) || null,
      request_identifier: parcelId,
    };
    writeJSON(mailingAddressPath, mailingAddress);

    const currentPersonIndexes = new Set();
    const currentCompanyIndexes = new Set();
    (currentOwners || []).forEach((owner) => {
      if (owner.type === "person") {
        let idx = findPersonIndex(owner);
        if (!idx) idx = registerPerson(owner, parcelId);
        if (idx) currentPersonIndexes.add(idx);
      } else if (owner.type === "company") {
        let idx = findCompanyIndexByName(owner.name);
        if (!idx) idx = registerCompany(owner.name, parcelId);
        if (idx) currentCompanyIndexes.add(idx);
      }
    });

    Array.from(currentPersonIndexes)
      .sort((a, b) => a - b)
      .forEach((personIdx) => {
        const relPath = path.join(
          "data",
          `relationship_person_${personIdx}_has_mailing_address.json`,
        );
        writeJSON(relPath, {
          to: { "/": "./mailing_address.json" },
          from: { "/": `./person_${personIdx}.json` },
        });
      });

    Array.from(currentCompanyIndexes)
      .sort((a, b) => a - b)
      .forEach((companyIdx) => {
        const relPath = path.join(
          "data",
          `relationship_company_${companyIdx}_has_mailing_address.json`,
        );
        writeJSON(relPath, {
          to: { "/": "./mailing_address.json" },
          from: { "/": `./company_${companyIdx}.json` },
        });
      });
  } else {
    try {
      if (fs.existsSync(mailingAddressPath)) fs.unlinkSync(mailingAddressPath);
    } catch (e) {}
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

function writeUtility(parcelId, propertyInfo, layoutContext) {
  const utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  const key = `property_${parcelId}`;
  const record = utilitiesData && utilitiesData[key];
  const utilities = record && Array.isArray(record.utilities)
    ? record.utilities
    : [];

  removeMatchingDataFiles([
    /^utility(?:_\d+)?\.json$/i,
    /^relationship_layout_\d+_has_utility_\d+\.json$/i,
    /^relationship_property_has_utility_\d+\.json$/i,
  ]);

  if (!utilities.length) {
    return { utilityFiles: [] };
  }

  const buildingCount = layoutContext.buildingLayouts.size;
  const buildingEntries = [...layoutContext.buildingLayouts.values()];
  const mapToPropertyByDefault = utilities.length === 1 && buildingCount > 1;
  const results = [];

  utilities.forEach((utility, idx) => {
    const fileName = `utility_${idx + 1}.json`;
    const payload = {
      cooling_system_type: utility.cooling_system_type ?? null,
      heating_system_type: utility.heating_system_type ?? null,
      public_utility_type: utility.public_utility_type ?? null,
      sewer_type: utility.sewer_type ?? null,
      water_source_type: utility.water_source_type ?? null,
      plumbing_system_type: utility.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utility.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utility.electrical_panel_capacity ?? null,
      electrical_wiring_type: utility.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: utility.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        utility.electrical_wiring_type_other_description ?? null,
      solar_panel_present: false,
      solar_panel_type: utility.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utility.solar_panel_type_other_description ?? null,
      smart_home_features: utility.smart_home_features ?? null,
      smart_home_features_other_description:
        utility.smart_home_features_other_description ?? null,
      hvac_unit_condition: utility.hvac_unit_condition ?? null,
      solar_inverter_visible: false,
      hvac_unit_issues: utility.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        utility.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utility.electrical_rewire_date ?? null,
      hvac_capacity_kw: utility.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utility.hvac_capacity_tons ?? null,
      hvac_equipment_component: utility.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer:
        utility.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utility.hvac_equipment_model ?? null,
      hvac_installation_date: utility.hvac_installation_date ?? null,
      hvac_seer_rating: utility.hvac_seer_rating ?? null,
      hvac_system_configuration: utility.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
        utility.plumbing_system_installation_date ?? null,
      sewer_connection_date: utility.sewer_connection_date ?? null,
      solar_installation_date: utility.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utility.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer:
        utility.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utility.solar_inverter_model ?? null,
      water_connection_date: utility.water_connection_date ?? null,
      water_heater_installation_date:
        utility.water_heater_installation_date ?? null,
      water_heater_manufacturer: utility.water_heater_manufacturer ?? null,
      water_heater_model: utility.water_heater_model ?? null,
      well_installation_date: utility.well_installation_date ?? null,
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", fileName), payload);

    let targetLayout = null;
    let shouldMapToProperty = mapToPropertyByDefault;
    if (!shouldMapToProperty) {
      const explicitBuilding = utility.building_index;
      if (
        explicitBuilding != null &&
        layoutContext.buildingLayouts.has(explicitBuilding)
      ) {
        targetLayout = layoutContext.buildingLayouts.get(explicitBuilding);
      } else if (buildingCount === 1) {
        targetLayout = buildingEntries[0];
      } else if (
        utility.source === "extra_feature" &&
        buildingCount > 1
      ) {
        shouldMapToProperty = true;
      } else if (buildingCount > 1) {
        const sequentialIndex =
          idx < buildingEntries.length ? buildingEntries[idx] : null;
        if (sequentialIndex) {
          targetLayout = sequentialIndex;
        } else {
          shouldMapToProperty = true;
        }
      }
    }

    if (targetLayout && !shouldMapToProperty) {
      writeRelationship(targetLayout.fileName, fileName);
    } else {
      writeRelationship("property.json", fileName);
    }

    results.push({
      fileName,
      targetLayout,
      mappedToProperty: shouldMapToProperty || !targetLayout,
    });
  });

  return { utilityFiles: results };
}

function writeStructure(parcelId, propertyInfo, layoutContext) {
  const structuresData = readJSON(path.join("owners", "structure_data.json"));
  const key = `property_${parcelId}`;
  const record = structuresData && structuresData[key];
  const structures = record && Array.isArray(record.structures)
    ? record.structures
    : [];

  removeMatchingDataFiles([
    /^structure_\d+\.json$/i,
    /^relationship_layout_\d+_has_structure_\d+\.json$/i,
    /^relationship_property_has_structure_\d+\.json$/i,
  ]);

  if (!structures.length) {
    return { structureFiles: [] };
  }

  const buildingEntries = [...layoutContext.buildingLayouts.values()];
  const buildingCount = buildingEntries.length;
  const mapToPropertyByDefault =
    structures.length === 1 && buildingCount > 1;

  const structureObjects = structures.map((structure, idx) => ({
    index: idx + 1,
    ...structure,
    target: null,
    mapToProperty: false,
  }));

  const usedBuildingFiles = new Set();
  structureObjects.forEach((structure) => {
    if (
      structure.building_index != null &&
      layoutContext.buildingLayouts.has(structure.building_index)
    ) {
      structure.target = layoutContext.buildingLayouts.get(
        structure.building_index,
      );
      usedBuildingFiles.add(structure.target.fileName);
    }
  });

  let availableBuildingIdx = 0;
  const availableBuildings = buildingEntries.filter(
    (entry) => !usedBuildingFiles.has(entry.fileName),
  );

  structureObjects.forEach((structure) => {
    if (
      structure.target ||
      structure.source === "extra_feature" ||
      mapToPropertyByDefault
    ) {
      return;
    }
    if (availableBuildings[availableBuildingIdx]) {
      structure.target = availableBuildings[availableBuildingIdx];
      availableBuildingIdx += 1;
    }
  });

  const singleBuildingState = buildingEntries[0] || null;
  structureObjects.forEach((structure) => {
    if (structure.target) return;
    if (mapToPropertyByDefault) {
      structure.mapToProperty = true;
      return;
    }
    if (structure.source === "extra_feature" && buildingCount > 1) {
      structure.mapToProperty = true;
      return;
    }
    if (buildingCount === 1 && singleBuildingState) {
      structure.target = singleBuildingState;
      return;
    }
    structure.mapToProperty = true;
  });

  const results = [];
  structureObjects.forEach((structure) => {
    const fileName = `structure_${structure.index}.json`;
    const payload = {
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
      exterior_wall_material_primary:
        structure.exterior_wall_material_primary ?? null,
      exterior_wall_material_secondary: null,
      finished_base_area: structure.finished_base_area ?? null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      flooring_condition: null,
      flooring_material_primary: structure.flooring_material_primary ?? null,
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
      interior_wall_surface_material_primary:
        structure.interior_wall_surface_material_primary ?? null,
      interior_wall_surface_material_secondary: null,
      number_of_stories: structure.number_of_stories ?? null,
      primary_framing_material: structure.primary_framing_material ?? null,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: structure.roof_covering_material ?? null,
      roof_date: structure.actual_year_built
        ? String(structure.actual_year_built)
        : null,
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
    writeJSON(path.join("data", fileName), payload);

    if (structure.target && !structure.mapToProperty) {
      writeRelationship(structure.target.fileName, fileName);
      results.push({
        fileName,
        targetLayout: structure.target,
        mappedToProperty: false,
      });
    } else {
      writeRelationship("property.json", fileName);
      results.push({
        fileName,
        targetLayout: null,
        mappedToProperty: true,
      });
    }
  });

  return { structureFiles: results };
}

function createBaseLayout() {
  return {
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
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
    is_exterior: null,
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
    space_type: null,
    space_type_index: null,
    story_type: null,
    total_area_sq_ft: null,
    view_type: null,
    visible_damage: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
  };
}

function writeLayout(parcelId, propertyInfo) {
  const layoutsData = readJSON(path.join("owners", "layout_data.json"));
  const key = `property_${parcelId}`;
  const record = (layoutsData && layoutsData[key]) || {};
  const buildings = Array.isArray(record.buildings) ? record.buildings : [];
  const extraLayouts = Array.isArray(record.extra_layouts)
    ? record.extra_layouts
    : [];
  const propertyType = propertyInfo?.propertyAttributes?.property_type || null;
  const shouldCreateBuilding = propertyType !== "LandParcel";

  removeMatchingDataFiles([
    /^layout_\d+\.json$/i,
    /^relationship_layout_\d+_has_layout_\d+\.json$/i,
    /^relationship_property_has_layout_\d+\.json$/i,
  ]);

  const buildingRecords = shouldCreateBuilding
    ? buildings.length
      ? buildings
      : [
          {
            building_index: 1,
            total_area_sq_ft: null,
            livable_area_sq_ft: null,
            rooms: [],
          },
        ]
    : [];

  const context = {
    layoutFiles: [],
    buildingLayouts: new Map(),
    propertyLayouts: new Set(),
    layoutHasLayoutRels: [],
  };

  const propertySpaceCounters = new Map();

  let nextLayoutId = 1;

  function addLayout(data, meta = {}) {
    const fileName = `layout_${nextLayoutId}.json`;
    nextLayoutId += 1;
    const payload = {
      ...createBaseLayout(),
      ...data,
      request_identifier: parcelId,
    };
    context.layoutFiles.push({ fileName, data: payload, meta });
    return { fileName, data: payload, meta };
  }

  function nextBuildingSpaceIndex(state, spaceType) {
    const key = (spaceType || "Unknown").toLowerCase();
    const current = state.perTypeCounters.get(key) || 0;
    const next = current + 1;
    state.perTypeCounters.set(key, next);
    return `${state.buildingOrder}.${next}`;
  }

  function nextPropertySpaceIndex(spaceType) {
    const key = (spaceType || "Additional Space").toLowerCase();
    const current = propertySpaceCounters.get(key) || 0;
    const next = current + 1;
    propertySpaceCounters.set(key, next);
    return `P${next}`;
  }

  buildingRecords.forEach((building, idx) => {
    const buildingOrder = idx + 1;
    const buildingNumber =
      building.building_index != null ? building.building_index : buildingOrder;
    const layoutData = {
      space_type: "Building",
      space_type_index: String(buildingOrder),
      total_area_sq_ft:
        building.total_area_sq_ft != null ? building.total_area_sq_ft : null,
      livable_area_sq_ft:
        building.livable_area_sq_ft != null
          ? building.livable_area_sq_ft
          : null,
      heated_area_sq_ft:
        building.livable_area_sq_ft != null
          ? building.livable_area_sq_ft
          : null,
      area_under_air_sq_ft:
        building.livable_area_sq_ft != null
          ? building.livable_area_sq_ft
          : null,
      size_square_feet:
        building.total_area_sq_ft != null ? building.total_area_sq_ft : null,
      story_type: null,
      is_exterior: false,
      is_finished: true,
      building_number: Number(buildingNumber),
      flooring_material_type: building.flooring_material_primary ?? null,
      built_year: building.actual_year_built ?? null,
    };
    const buildingLayout = addLayout(layoutData, {
      type: "building",
      building_index: buildingNumber,
      building_order: buildingOrder,
    });
    context.propertyLayouts.add(buildingLayout.fileName);
    context.buildingLayouts.set(buildingNumber, {
      fileName: buildingLayout.fileName,
      buildingOrder,
      buildingIndex: buildingNumber,
      perTypeCounters: new Map(),
    });

    const rooms = Array.isArray(building.rooms) ? building.rooms : [];
    rooms.forEach((roomGroup) => {
      const count = Number(roomGroup.count) || 0;
      const spaceType = roomGroup.space_type || "Room";
      for (let r = 0; r < count; r += 1) {
        const state = context.buildingLayouts.get(buildingNumber);
        const roomIndex = nextBuildingSpaceIndex(state, spaceType);
        const roomLayout = addLayout(
          {
            space_type: spaceType,
            space_type_index: roomIndex,
            is_exterior: false,
            is_finished: true,
          },
          { type: "room", building_index: buildingNumber },
        );
        context.layoutHasLayoutRels.push({
          from: buildingLayout.fileName,
          to: roomLayout.fileName,
        });
      }
    });
  });

  const buildingCount = context.buildingLayouts.size;
  let propertyExtraCounter = 1;
  extraLayouts.forEach((layout) => {
    const source = layout.source || "extra_feature";
    const stateEntries = [...context.buildingLayouts.values()];
    let targetState = null;
    if (layout.building_index && context.buildingLayouts.has(layout.building_index)) {
      targetState = context.buildingLayouts.get(layout.building_index);
    } else if (buildingCount === 1) {
      targetState = stateEntries[0];
    } else if (buildingCount > 1 && source !== "extra_feature") {
      targetState = stateEntries[0];
    }

    const layoutData = {
      space_type: layout.space_type || "Additional Space",
      size_square_feet:
        layout.area_sq_ft != null ? layout.area_sq_ft : null,
      is_exterior: true,
      is_finished: true,
      built_year: layout.year_built ?? null,
    };

    if (
      targetState &&
      !(source === "extra_feature" && buildingCount > 1)
    ) {
      const roomIndex = nextBuildingSpaceIndex(
        targetState,
        layoutData.space_type,
      );
      layoutData.space_type_index = roomIndex;
      const entry = addLayout(layoutData, {
        type: "extra",
        building_index: targetState.buildingIndex,
      });
      context.layoutHasLayoutRels.push({
        from: targetState.fileName,
        to: entry.fileName,
      });
    } else {
      const propertyIndex =
        layoutData.space_type != null
          ? nextPropertySpaceIndex(layoutData.space_type)
          : `P${propertyExtraCounter++}`;
      layoutData.space_type_index = propertyIndex;
      const entry = addLayout(layoutData, { type: "extra_property" });
      context.propertyLayouts.add(entry.fileName);
    }
  });

  context.layoutFiles.forEach(({ fileName, data }) => {
    writeJSON(path.join("data", fileName), data);
  });

  context.layoutHasLayoutRels.forEach((rel) => {
    writeRelationship(rel.from, rel.to);
  });

  context.propertyLayouts.forEach((fileName) => {
    writeRelationship("property.json", fileName);
  });

  return {
    buildingLayouts: context.buildingLayouts,
    propertyLayouts: Array.from(context.propertyLayouts),
    layoutFiles: context.layoutFiles,
    buildingCount: buildingCount,
  };
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getFlexibleLabelText($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($tr.find("td div span")); // Sec/Twp/Rng is in a span inside a div
      return false; // Stop iterating once found
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function writeGeometryRecord(unnorm, propertySeed, requestIdentifier) {
  const latitude =
    unnorm && typeof unnorm.latitude === "number" ? unnorm.latitude : null;
  const longitude =
    unnorm && typeof unnorm.longitude === "number" ? unnorm.longitude : null;
  const sourceHttp =
    (unnorm && unnorm.source_http_request) ||
    (propertySeed && propertySeed.source_http_request) ||
    null;

  const geometry = {
    latitude,
    longitude,
    source_http_request: sourceHttp,
    request_identifier: requestIdentifier || null,
  };

  writeJSON(path.join("data", "geometry.json"), geometry);

  const relationship = {
    to: { "/": "./geometry.json" },
    from: { "/": "./address.json" },
  };
  writeJSON(
    path.join("data", "relationship_address_has_geometry.json"),
    relationship,
  );
}

function attemptWriteAddress(unnorm, secTwpRng, propertySeed, parcelId) {
  const fullAddress =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  const sourceHttp =
    (unnorm && unnorm.source_http_request) ||
    (propertySeed && propertySeed.source_http_request) ||
    null;
  const requestIdentifier =
    (unnorm && unnorm.request_identifier) ||
    (propertySeed && propertySeed.request_identifier) ||
    parcelId ||
    null;
  const countyName =
    (unnorm && (unnorm.county_jurisdiction || unnorm.county_name)) || "Madison";

  const address = {
    unnormalized_address: fullAddress,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    source_http_request: sourceHttp,
    request_identifier: requestIdentifier,
    county_name: countyName || null,
    country_code: "US",
  };

  writeJSON(path.join("data", "address.json"), address);
  writeGeometryRecord(unnorm, propertySeed, requestIdentifier);
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
  let propertyInfo = null;
  if (parcelId) propertyInfo = writeProperty($, parcelId);
  if (parcelId) writePropertyImprovements($, parcelId);

  const salesRecords = writeSalesHistoryDeedsAndFiles($, parcelId);

  writeTaxes($);

  if (parcelId) {
    const layoutContext =
      writeLayout(parcelId, propertyInfo) || {
        buildingLayouts: new Map(),
        propertyLayouts: [],
        layoutFiles: [],
        buildingCount: 0,
      };
    // Seed data group does not include utility, structure, person, company, or sales_history classes
    // writeUtility(parcelId, propertyInfo, layoutContext);
    // writeStructure(parcelId, propertyInfo, layoutContext);
    // writePersonCompaniesSalesRelationships(
    //   parcelId,
    //   salesRecords,
    //   propertySeed,
    // );
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  attemptWriteAddress(unnormalized, secTwpRng, propertySeed, parcelId);
}

module.exports = {
  mapPropertyFromUseCode,
  normalizeUseCodeKey,
  PROPERTY_USE_MAPPINGS,
  DEFAULT_PROPERTY_MAPPING,
};

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
