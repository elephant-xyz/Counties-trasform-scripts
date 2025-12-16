// Data extractor script
// Reads input.html, unnormalized_address.json, property_seed.json and owners JSON sources.
// Writes outputs to ./data

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

function parseCurrency(val) {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[$,\s]/g, "");
  if (s === "" || s.toUpperCase() === "N/A") return null;
  const n = Number.parseFloat(s);
  if (Number.isNaN(n)) return null;
  // Round to 2 decimals
  return Math.round(n * 100) / 100;
}

function toISODate(mdY) {
  if (!mdY) return null;
  // expect MM/DD/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdY.trim());
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractTextAfterColonRow($, tableIdOrTitle, rowHeading) {
  // Find row with DataletSideHeading == rowHeading and return next cell text
  let val = null;
  $(`#${CSSescape(tableIdOrTitle)} tr`).each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length >= 2) {
      const head = $tds.eq(0).text().trim();
      if (head === rowHeading) {
        val = $tds.eq(1).text().trim();
        return false;
      }
    }
  });
  return val;
}

function CSSescape(id) {
  // basic escape for id with special chars
  return String(id).replace(/([ #;?%&,.+*~\':\"!^$\[\]()=>|\/@])/g, "\\$1");
}

function raiseEnumError(value, pathStr) {
  const errObj = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(errObj));
  process.exit(1);
}

const propertyTypeMapping = [
  {
    citrus_property_type: "0000: VACANT",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Residential",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "0100: SINGLE FAMILY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "SingleFamilyDetached",
    property_usage_type: "Residential",
    property_type: "SingleFamily",
  },
  {
    citrus_property_type: "0200: MOBILE HOME",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "MobileHome",
    property_usage_type: "Residential",
    property_type: "MobileHome",
  },
  {
    citrus_property_type: "0300: MULTIFAMILY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "MultiFamily5Plus",
    property_usage_type: "Residential",
    property_type: "MultipleFamily",
  },
  {
    citrus_property_type: "0400: CONDOMINIUM",
    ownership_estate_type: "Condominium",
    build_status: "Improved",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
    property_type: "Condominium",
  },
  {
    citrus_property_type: "0410: TOWNHOUSE/VILLA",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "TownhouseRowhouse",
    property_usage_type: "Residential",
    property_type: "Townhouse",
  },
  {
    citrus_property_type: "0420: TIMESHARE",
    ownership_estate_type: "Timeshare",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    property_type: "Timeshare",
  },
  {
    citrus_property_type: "0430: ZERO LOT LINE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "SingleFamilyDetached",
    property_usage_type: "Residential",
    property_type: "SingleFamily",
  },
  {
    citrus_property_type: "0500: MHT COOP",
    ownership_estate_type: "Cooperative",
    build_status: "Improved",
    structure_form: "ManufacturedHomeInPark",
    property_usage_type: "Residential",
    property_type: "Cooperative",
  },
  {
    citrus_property_type: "0510: COOPERATIVE",
    ownership_estate_type: "Cooperative",
    build_status: "Improved",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
    property_type: "Cooperative",
  },
  {
    citrus_property_type: "0600: RETIREMENT",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Retirement",
    property_type: "Retirement",
  },
  {
    citrus_property_type: "0620: LIFE CARE HX",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Retirement",
    property_type: "Retirement",
  },
  {
    citrus_property_type: "0700: MISC. RESIDENCE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Residential",
    property_type: "MiscellaneousResidential",
  },
  {
    citrus_property_type: "0800: MFR <10 UNITS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
    property_type: "MultiFamilyLessThan10",
  },
  {
    citrus_property_type: "0900: INTERVAL OWNER",
    ownership_estate_type: "Timeshare",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    property_type: "Timeshare",
  },
  {
    citrus_property_type: "1000: VACANT COMM",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Commercial",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "1100: STORES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "RetailStore",
    property_type: "Building",
  },
  {
    citrus_property_type: "1200: STORE/OFF/RES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Commercial",
    property_type: "Building",
  },
  {
    citrus_property_type: "1300: DEPT STORE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "DepartmentStore",
    property_type: "Building",
  },
  {
    citrus_property_type: "1400: SPRMKT/DRUG STR",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Supermarket",
    property_type: "Building",
  },
  {
    citrus_property_type: "1500: SH CTR REGIONAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ShoppingCenterRegional",
    property_type: "Building",
  },
  {
    citrus_property_type: "1600: SH CTR CMMITY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ShoppingCenterCommunity",
    property_type: "Building",
  },
  {
    citrus_property_type: "1700: OFFICE 1 STORY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    property_type: "Building",
  },
  {
    citrus_property_type: "1800: OFF MULTISTORY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    property_type: "Building",
  },
  {
    citrus_property_type: "1900: PROF OFFICES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    property_type: "Building",
  },
  {
    citrus_property_type: "2000: AIRPORT/MARINA",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "TransportationTerminal",
    property_type: "Building",
  },
  {
    citrus_property_type: "2100: RESTAURANT",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Restaurant",
    property_type: "Building",
  },
  {
    citrus_property_type: "2200: REST, DRIVE-IN",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Restaurant",
    property_type: "Building",
  },
  {
    citrus_property_type: "2300: FINANCIAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "FinancialInstitution",
    property_type: "Building",
  },
  {
    citrus_property_type: "2400: INSURANCE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "FinancialInstitution",
    property_type: "Building",
  },
  {
    citrus_property_type: "2500: SERVICE SHOPS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Commercial",
    property_type: "Building",
  },
  {
    citrus_property_type: "2600: SERV STATIONS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ServiceStation",
    property_type: "Building",
  },
  {
    citrus_property_type: "2700: AUTO SALES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "AutoSalesRepair",
    property_type: "Building",
  },
  {
    citrus_property_type: "2800: PKG LT / MH PK",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MobileHomePark",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "2900: WHOLESALER",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "WholesaleOutlet",
    property_type: "Building",
  },
  {
    citrus_property_type: "3000: FLORIST",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Ornamentals",
    property_type: "Building",
  },
  {
    citrus_property_type: "3100: DRV-IN THEATER",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Theater",
    property_type: "Building",
  },
  {
    citrus_property_type: "3200: THTR/AUD/CLBHS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Theater",
    property_type: "Building",
  },
  {
    citrus_property_type: "3300: NIGHT CLUBS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    property_type: "Building",
  },
  {
    citrus_property_type: "3400: BOWLING ALLEY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    property_type: "Building",
  },
  {
    citrus_property_type: "3500: TOURIST ATTRAC",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    property_type: "Building",
  },
  {
    citrus_property_type: "3600: CAMPS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    property_type: "Building",
  },
  {
    citrus_property_type: "3700: RACETRACK",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    property_type: "Building",
  },
  {
    citrus_property_type: "3800: GOLF COURSE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GolfCourse",
    property_type: "Building",
  },
  {
    citrus_property_type: "3900: MOTEL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Hotel",
    property_type: "Building",
  },
  {
    citrus_property_type: "4000: VACANT INDUS",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Industrial",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "4100: LIGHT MFG",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LightManufacturing",
    property_type: "Building",
  },
  {
    citrus_property_type: "4200: HEAVY MFG",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "HeavyManufacturing",
    property_type: "Building",
  },
  {
    citrus_property_type: "4300: LUMBER YD/MILL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LumberYard",
    property_type: "Building",
  },
  {
    citrus_property_type: "4400: PACKING",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PackingPlant",
    property_type: "Building",
  },
  {
    citrus_property_type: "4500: BOTTLER",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Cannery",
    property_type: "Building",
  },
  {
    citrus_property_type: "4600: FOOD PROCESSING",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LightManufacturing",
    property_type: "Building",
  },
  {
    citrus_property_type: "4700: MIN PROCESSING",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MineralProcessing",
    property_type: "Building",
  },
  {
    citrus_property_type: "4800: WAREH/DIST TERM",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Warehouse",
    property_type: "Building",
  },
  {
    citrus_property_type: "4900: OPEN STORAGE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OpenStorage",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "5000: IMPROVED AGRI",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Agricultural",
    property_type: "Building",
  },
  {
    citrus_property_type: "5100: CROPSOIL CLASS1",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "DrylandCropland",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5200: CROPSOIL CLASS2",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "CroplandClass2",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5300: CROPSOIL CLASS3",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "CroplandClass3",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5400: TMBR SI 90+",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5500: TMBR SI 80-89",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5600: TMBR SI 70-79",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5700: TMBR SI 60-69",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5800: TMBR SI 50-59",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "5900: TMBR NOT CLSSFD",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TimberLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6000: GRZGSOIL CLASS1",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6100: GRZGSOIL CLASS2",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6200: GRZGSOIL CLASS3",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6300: GRZGSOIL CLASS4",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6400: GRZGSOIL CLASS5",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6500: GRZGSOIL CLASS6",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GrazingLand",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6600: ORCHARD GROVES",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "OrchardGroves",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6700: POUL/BEES/FISH",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Poultry",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6800: DAIRIES/FEEDLTS",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Agricultural",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "6900: ORN/MISC AGRI",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Ornamentals",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "7000: VACANT INSTIT",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "7100: CHURCHES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Church",
    property_type: "Building",
  },
  {
    citrus_property_type: "7200: PRV SCHL/COLL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PrivateSchool",
    property_type: "Building",
  },
  {
    citrus_property_type: "7300: PRV HOSPITAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PrivateHospital",
    property_type: "Building",
  },
  {
    citrus_property_type: "7400: NURSING HOME",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "HomesForAged",
    property_type: "Building",
  },
  {
    citrus_property_type: "7500: ORPHNG/NON-PROF",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "NonProfitCharity",
    property_type: "Building",
  },
  {
    citrus_property_type: "7600: MORT/CEMETERY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MortuaryCemetery",
    property_type: "Building",
  },
  {
    citrus_property_type: "7700: CLB/LDG/UN HALL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ClubsLodges",
    property_type: "Building",
  },
  {
    citrus_property_type: "7800: SANI/ REST HOME",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "SanitariumConvalescentHome",
    property_type: "Building",
  },
  {
    citrus_property_type: "7900: CULTURAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "CulturalOrganization",
    property_type: "Building",
  },
  {
    citrus_property_type: "8000: DISTRICTS",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "8100: MILITARY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Military",
    property_type: "Building",
  },
  {
    citrus_property_type: "8200: FOREST/PK/REC",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ForestParkRecreation",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "8300: PUB CTY SCHOOL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PublicSchool",
    property_type: "Building",
  },
  {
    citrus_property_type: "8400: COLLEGE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "CulturalOrganization",
    property_type: "Building",
  },
  {
    citrus_property_type: "8500: HOSPITAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PublicHospital",
    property_type: "Building",
  },
  {
    citrus_property_type: "8600: CTY INC NONMUNI",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "Building",
  },
  {
    citrus_property_type: "8700: STATE",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "Building",
  },
  {
    citrus_property_type: "8800: FEDERAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "Building",
  },
  {
    citrus_property_type: "8900: MUNICIPAL",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    property_type: "Building",
  },
  {
    citrus_property_type: "9000: LEASEHOLD INT",
    ownership_estate_type: "Leasehold",
    build_status: null,
    structure_form: null,
    property_usage_type: "Unknown",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9100: UTILITY",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Utility",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9200: MING/PET/GASLND",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MineralProcessing",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9300: SUBSURF RIGHTS",
    ownership_estate_type: "SubsurfaceRights",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Unknown",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "9400: R/W - BUFFER",
    ownership_estate_type: "RightOfWay",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Unknown",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "9500: RIVERS/LAKES",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "RiversLakes",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9600: SEWG/WASTE LAND",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "SewageDisposal",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9700: OUTDR REC/PK LD",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9800: CENTRALLY ASSD",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Utility",
    property_type: "LandParcel",
  },
  {
    citrus_property_type: "9900: NON AG",
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TransitionalProperty",
    property_type: "VacantLand",
  },
  {
    citrus_property_type: "9999: EXEMPT",
    ownership_estate_type: "FeeSimple",
    build_status: null,
    structure_form: null,
    property_usage_type: "Unknown",
    property_type: "LandParcel",
  },
];

function mapPropertyDetailsFromPcCode(pcCode) {
  if (!pcCode) return {};
  const mapping = propertyTypeMapping.find((m) =>
    pcCode.toUpperCase().includes(m.citrus_property_type.split(":")[1].trim().toUpperCase())
  );

  if (mapping) {
    return {
      property_type: mapping.property_type,
      property_usage_type: mapping.property_usage_type,
      ownership_estate_type: mapping.ownership_estate_type,
      build_status: mapping.build_status,
      structure_form: mapping.structure_form,
    };
  }
  return {};
}

function mapDeedType(instr) {
  if (!instr) return null;
  const u = instr.toUpperCase();
  if (u.includes("WARRANTY DEED")) return "Warranty Deed";
  if (u.includes("QUIT") && u.includes("DEED")) return "Quitclaim Deed";
  if (u.includes("SPECIAL") && u.includes("WARRANTY"))
    return "Special Warranty Deed";
  if (u.includes("BARGAIN") && u.includes("SALE"))
    return "Bargain and Sale Deed";
  if (u.includes("GRANT DEED")) return "Grant Deed";
  if (u.includes("CONTRACT") || u.includes("AGREEMENT"))
    return "Contract for Deed";
  if (u.includes("TRUSTEE")) return "Trustee's Deed";
  if (u.includes("TAX DEED")) return "Tax Deed";
  if (u.includes("PERSONAL REPRESENTATIVE"))
    return "Personal Representative Deed";
  if (u.includes("COURT ORDER")) return "Court Order Deed";
  if (u.includes("LADY BIRD")) return "Lady Bird Deed";
  // same family or other non-specific types
  if (u.includes("SAME FAMILY") || u.includes("DEED FOL"))
    return "Miscellaneous";
  return null;
}

function mapFileDocumentTypeFromDeedType(deedType) {
  if (!deedType) return null;
  switch (deedType) {
    case "Warranty Deed":
      return "ConveyanceDeedWarrantyDeed";
    case "Quitclaim Deed":
      return "ConveyanceDeedQuitClaimDeed";
    case "Bargain and Sale Deed":
      return "ConveyanceDeedBargainAndSaleDeed";
    default:
      return "ConveyanceDeed";
  }
}

function removeFilesByPrefix(dir, prefix) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach((f) => {
      if (f.startsWith(prefix) && f.endsWith(".json")) {
        fs.unlinkSync(path.join(dir, f));
      }
    });
  } catch (_) {}
}

function extract() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  // Inputs
  const inputHtml = readText("input.html");
  const unnormalized = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners and related JSON
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersObj = fs.existsSync(ownersPath) ? readJSON(ownersPath) : {};
  const utilitiesObj = fs.existsSync(utilitiesPath) ? readJSON(utilitiesPath) : {};
  const layoutsObj = fs.existsSync(layoutPath) ? readJSON(layoutPath) : {};

  const $ = cheerio.load(inputHtml);

  // Extract header info
  // Parcel ID
  let parcelIdentifier = null;
  $("#datalet_header_row")
    .find("td")
    .each((i, td) => {
      const t = $(td).text();
      const m = /Parcel ID:\s*([^\n\r]+)/.exec(t);
      if (m) {
        parcelIdentifier = m[1].trim();
      }
    });
  if (!parcelIdentifier && seed && seed.parcel_id)
    parcelIdentifier = seed.parcel_id;

  // Property core
  const yearBuiltStr = extractTextAfterColonRow($, "Residential", "Year Built");
  const totalFLA = extractTextAfterColonRow($, "Residential", "Total FLA");
  const totalUnderRoof = extractTextAfterColonRow(
    $,
    "Residential",
    "Total Under Roof",
  );

  // From PARCEL table
  const legal = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "Short Legal",
  );
  const subdivision = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "Subdivision",
  );
  const pcCode = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "PC Code",
  );

  // Zoning from Land & Agricultural (anchor text)
  let zoning = null;
  $("#" + CSSescape("Land & Agricultural") + " tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length > 0) {
      const lab = $tds.eq(9);
      const a = lab.find("a");
      if (a && a.text().trim()) {
        zoning = a.text().trim();
        return false;
      }
    }
  });

  // Build status from Bldg Counts
  const bldgCounts = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "Bldg Counts",
  );
  let buildStatus = null;
  if (bldgCounts) {
    const m = /Res\s*(\d+)/i.exec(bldgCounts);
    if (m && Number(m[1]) > 0) buildStatus = "Improved";
  }

  // Property type mapping
  const mappedPropertyDetails = mapPropertyDetailsFromPcCode(pcCode);
  const propertyType = mappedPropertyDetails.property_type || null;
  const propertyUsageType = mappedPropertyDetails.property_usage_type || null;
  const ownershipEstateType = mappedPropertyDetails.ownership_estate_type || null;
  const structureForm = mappedPropertyDetails.structure_form || null;
  const finalBuildStatus = mappedPropertyDetails.build_status || buildStatus; // Prioritize mapped build_status

  if (!propertyType) {
    if (pcCode) {
      raiseEnumError(pcCode, "property.property_type");
      return;
    }
  }

  // Function to determine number_of_units_type based on property_type
  function getNumberOfUnitsType(propertyType) {
    switch (propertyType) {
      case "SingleFamily":
      case "Condominium":
      case "DetachedCondominium":
      case "NonWarrantableCondo":
      case "Townhouse":
      case "MobileHome":
      case "ManufacturedHousingSingleWide":
      case "ManufacturedHousingMultiWide":
      case "ManufacturedHousing":
      case "Apartment":
      case "Cooperative":
      case "Modular":
      case "Pud":
      case "Timeshare":
      case "Retirement":
      case "MiscellaneousResidential":
      case "ResidentialCommonElementsAreas":
        return "One";
      case "Duplex":
      case "TwoUnit":
        return "Two";
      case "ThreeUnit":
        return "Three";
      case "FourUnit":
        return "Four";
      case "MultiFamilyLessThan10":
      case "MultiFamilyMoreThan10":
        return "OneToFour";
      default:
        return null;
    }
  }

  const number_of_units_type_mapped = getNumberOfUnitsType(propertyType);

  const property = {
    parcel_identifier: parcelIdentifier || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr.trim(), 10)
      : null,
    livable_floor_area: totalFLA ? totalFLA.trim() : null,
    area_under_air: totalFLA ? totalFLA.trim() : null,
    total_area: totalUnderRoof ? totalUnderRoof.trim() : null,
    subdivision: subdivision || null,
    zoning: zoning || null,
    build_status: finalBuildStatus,
    property_type: propertyType,
    property_usage_type: propertyUsageType,
    ownership_estate_type: ownershipEstateType,
    structure_form: structureForm,
    number_of_units: null, // This is an integer, not the enum type
    number_of_units_type: number_of_units_type_mapped, // Added this required field
    historic_designation: false, // Defaulting as not found in HTML
    property_effective_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr.trim(), 10)
      : null,
    source_http_request: {
      method: "GET",
      url: seed?.source_http_request?.url || "https://www.citruspa.org/_web/search/commonsearch.aspx?mode=realprop", // Placeholder URL
    },
    request_identifier: seed.request_identifier || null,
  };

  // Address extraction logic - Prioritize HTML, then JSON
  let fullAddressFromHtml = null;
  // Look for the address in the header row, specifically the last td
  $("#datalet_header_row")
    .find("td")
    .each((i, td) => {
      // Check if it's the last td and contains an address pattern
      if (i === 3) { // Assuming the address is in the fourth td (index 3) based on the provided HTML
        const text = $(td).text().trim();
        // A simple regex to check if it looks like an address (e.g., contains numbers and street names)
        if (/\d+\s+[A-Z0-9\s,]+/.test(text)) {
          fullAddressFromHtml = text;
          return false; // Stop iterating
        }
      }
    });

  let sourceFullAddress = null;
  if (fullAddressFromHtml) {
    sourceFullAddress = fullAddressFromHtml;
  } else if (unnormalized && unnormalized.full_address) {
    sourceFullAddress = unnormalized.full_address;
  }

  const address = {
    source_http_request: {
      method: "GET",
      url: seed?.source_http_request?.url || "https://www.citruspa.org/_web/search/commonsearch.aspx?mode=realprop", // Placeholder URL
    },
    request_identifier: seed.request_identifier || null,
    county_name: seed.county_name || "Citrus",
    latitude: seed.latitude || null,
    longitude: seed.longitude || null
  };

  // Attempt to parse structured address from the determined sourceFullAddress
  if (sourceFullAddress) {
    const full = sourceFullAddress.trim();
    let street_number = null,
      pre = null,
      street_name = null,
      suffix = null,
      city = null,
      state = null,
      zip = null,
      plus4 = null;

    // Example parsing logic (can be refined based on actual address formats)
    const parts = full.split(",");
    if (parts.length >= 2) { // Changed from 3 to 2 because HTML address might not have state/zip in separate part
      const streetPart = parts[0].trim();
      
      // Extract street number, pre-directional, street name, and suffix
      const streetMatch = streetPart.match(/^(\d+)\s+([NESW]{1,2})?\s*(.+?)\s+(?:(AVE|BLVD|CIR|CT|DR|HWY|LN|PKWY|PL|RD|RTE|ST|TER|TRL|WAY|AVENUE|BOULEVARD|CIRCLE|COURT|DRIVE|HIGHWAY|LANE|PARKWAY|PLACE|ROAD|ROUTE|STREET|TERRACE|TRAIL))?$/i);
      if (streetMatch) {
        street_number = streetMatch[1];
        pre = streetMatch[2] ? streetMatch[2].toUpperCase() : null;
        street_name = streetMatch[3].trim();
        suffix = streetMatch[4] ? streetMatch[4].toUpperCase() : null;
      } else {
        // Fallback for simpler street names without directional or suffix
        const simpleStreetMatch = streetPart.match(/^(\d+)\s+(.+)$/);
        if (simpleStreetMatch) {
          street_number = simpleStreetMatch[1];
          street_name = simpleStreetMatch[2].trim();
        }
      }

      // Handle city, state, zip from the remaining parts
      if (parts.length >= 2) {
        const cityStateZipPart = parts[1].trim();
        const cityStateZipMatch = cityStateZipPart.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/);
        if (cityStateZipMatch) {
          city = cityStateZipMatch[1].trim().toUpperCase();
          state = cityStateZipMatch[2];
          zip = cityStateZipMatch[3];
          plus4 = cityStateZipMatch[4] || null;
        } else {
          // If no state/zip, assume the rest is city
          city = cityStateZipPart.toUpperCase();
        }
      }
    } else if (parts.length === 1) { // If only one part, assume it's a street address without city/state/zip
        const streetPart = parts[0].trim();
        const streetMatch = streetPart.match(/^(\d+)\s+([NESW]{1,2})?\s*(.+?)\s+(?:(AVE|BLVD|CIR|CT|DR|HWY|LN|PKWY|PL|RD|RTE|ST|TER|TRL|WAY|AVENUE|BOULEVARD|CIRCLE|COURT|DRIVE|HIGHWAY|LANE|PARKWAY|PLACE|ROAD|ROUTE|STREET|TERRACE|TRAIL))?$/i);
        if (streetMatch) {
            street_number = streetMatch[1];
            pre = streetMatch[2] ? streetMatch[2].toUpperCase() : null;
            street_name = streetMatch[3].trim();
            suffix = streetMatch[4] ? streetMatch[4].toUpperCase() : null;
        } else {
            const simpleStreetMatch = streetPart.match(/^(\d+)\s+(.+)$/);
            if (simpleStreetMatch) {
                street_number = simpleStreetMatch[1];
                street_name = simpleStreetMatch[2].trim();
            }
        }
    }


    const suffixMap = {
      RD: "Rd", ROAD: "Rd", ST: "St", STREET: "St", AVE: "Ave", AVENUE: "Ave",
      BLVD: "Blvd", BOULEVARD: "Blvd", DR: "Dr", DRIVE: "Dr", LN: "Ln", LANE: "Ln",
      CT: "Ct", COURT: "Ct", TER: "Ter", TERRACE: "Ter", HWY: "Hwy", HIGHWAY: "Hwy",
      PKWY: "Pkwy", PARKWAY: "Pkwy", PL: "Pl", PLACE: "Pl", WAY: "Way", CIR: "Cir",
      CIRCLE: "Cir", PLZ: "Plz", TRL: "Trl", TRAIL: "Trl", RTE: "Rte", ROUTE: "Rte",
    };
    const street_suffix_type = suffix
      ? suffixMap[suffix.toUpperCase()] || null
      : null;

    // Extract S/T/R from HTML if available
    let section = null,
      township = null,
      range = null;
    const strTxt = $('td:contains("S/T/R")')
      .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
      .first()
      .next()
      .text()
      .trim();
    if (strTxt && /\d{1,2}-\d{1,2}[A-Z]-\d{1,2}/.test(strTxt)) {
      const parts2 = strTxt.split("-");
      section = parts2[0];
      township = parts2[1];
      range = parts2[2];
    }

    // Check if street_name contains directional abbreviations and adjust if necessary
    let final_street_name = street_name ? street_name.toUpperCase() : null;
    if (final_street_name && (/\bE\b|\bN\b|\bNE\b|\bNW\b|\bS\b|\bSE\b|\bSW\b|\bW\b/.test(final_street_name))) {
      const streetNameParts = final_street_name.split(' ');
      const directional = streetNameParts.find(part => ['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W'].includes(part));
      if (directional) {
        pre = directional;
        final_street_name = streetNameParts.filter(part => part !== directional).join(' ');
      }
    }

    Object.assign(address, {
      street_number: street_number || null,
      street_pre_directional_text: pre || null,
      street_name: final_street_name,
      street_suffix_type: street_suffix_type || null,
      street_post_directional_text: null, // Not extracted from this source
      unit_identifier: null, // Not extracted from this source
      city_name: city || null,
      state_code: state || null,
      postal_code: zip || null,
      plus_four_postal_code: plus4 || null,
      country_code: "US", // Assuming US for now
      route_number: null, // Not extracted from this source
      township: township || null,
      range: range || null,
      section: section || null,
      lot: null, // Not extracted from this source
      block: null, // Not extracted from this source
      municipality_name: null, // Not extracted from this source
    });
  }

  // Lot
  const estSqft = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "Est. Parcel Sqft",
  );
  const estAcres = extractTextAfterColonRow(
    $,
    "Citrus County Property Appraiser, Cregg E. Dalton",
    "Est. Parcel Acres",
  );
  // From Land & Agricultural: Frontage, Depth, Land Use for view
  let frontage = null,
    depth = null,
    landUse = null;
  $("#" + CSSescape("Land & Agricultural") + " tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length >= 10 && !landUse) {
      if (
        $tds.eq(1).attr("class") &&
        $tds.eq(1).attr("class").includes("DataletData")
      ) {
        landUse = $tds.eq(1).text().trim();
        frontage = $tds.eq(4).text().trim();
        depth = $tds.eq(5).text().trim();
      }
    }
  });
  const lot = {
    lot_type: (() => {
      const acres = estAcres ? parseFloat(estAcres.replace(/,/g, "")) : null;
      if (acres != null && !Number.isNaN(acres)) {
        return acres > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
      }
      return null;
    })(),
    lot_length_feet: frontage
      ? parseInt(String(frontage).replace(/[^0-9.]/g, ""), 10)
      : null,
    lot_width_feet: depth
      ? parseInt(String(depth).replace(/[^0-9.]/g, ""), 10)
      : null,
    lot_area_sqft: estSqft
      ? parseInt(String(estSqft).replace(/[^0-9]/g, ""), 10)
      : null,
    lot_size_acre: estAcres
      ? parseFloat(String(estAcres).replace(/[^0-9.]/g, ""))
      : null,
    landscaping_features: null,
    view: landUse && /RIVER FRONT/i.test(landUse) ? "Waterfront" : null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };

  // Structure from HTML
  const storiesStr = extractTextAfterColonRow($, "Residential", "Stories");
  const extWall = extractTextAfterColonRow($, "Residential", "Exterior Wall");
  const foundation = extractTextAfterColonRow($, "Residential", "Foundation");
  const floorSystem = extractTextAfterColonRow(
    $,
    "Residential",
    "Floor System",
  );
  const roofFrame = extractTextAfterColonRow($, "Residential", "Roof Frame");
  const roofCover = extractTextAfterColonRow($, "Residential", "Roof Cover");

  // number of buildings
  let numBldgs = null;
  if (bldgCounts) {
    const m = /Res\s*(\d+)/i.exec(bldgCounts);
    if (m) numBldgs = parseInt(m[1], 10);
  }

  function mapExtWallMaterial(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("CONCRETE BLOCK")) return "Concrete Block";
    if (u.includes("BRICK")) return "Brick";
    if (u.includes("STUCCO")) return "Stucco";
    return null;
  }
  function mapFoundationType(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("STEM")) return "Stem Wall";
    if (u.includes("SLAB")) return "Slab on Grade";
    if (u.includes("CRAWL")) return "Crawl Space";
    return null;
  }
  function mapFoundationMaterial(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("CONCRETE BLOCK")) return "Concrete Block";
    if (u.includes("POURED")) return "Poured Concrete";
    if (u.includes("STONE")) return "Stone";
    if (u.includes("BRICK")) return "Brick";
    return null;
  }
  function mapRoofDesign(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("GABLE")) return "Gable";
    if (u.includes("HIP")) return "Hip";
    if (u.includes("FLAT")) return "Flat";
    return null;
  }
  function mapRoofMaterialType(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("METAL")) return "Metal";
    if (u.includes("SHINGLE")) return "Shingle";
    if (u.includes("TILE")) return "Tile";
    return null;
  }
  function mapSubfloor(txt) {
    if (!txt) return null;
    const u = txt.toUpperCase();
    if (u.includes("SLAB")) return "Concrete Slab";
    return null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: mapExtWallMaterial(extWall),
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: mapFoundationMaterial(foundation),
    foundation_repair_date: null,
    foundation_type: mapFoundationType(foundation),
    foundation_waterproofing: "Unknown",
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
    number_of_buildings: numBldgs,
    number_of_stories: storiesStr ? parseFloat(storiesStr) : null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: mapRoofDesign(roofFrame),
    roof_material_type: mapRoofMaterialType(roofCover),
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: mapSubfloor(floorSystem),
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // Utilities from owners/utilities_data.json
  const utilityKey = `property_${seed.request_identifier}`;
  const utilRaw = (utilitiesObj || {})[utilityKey] || {};
  const util = {
    cooling_system_type: utilRaw.cooling_system_type ?? null,
    heating_system_type: utilRaw.heating_system_type ?? null,
    public_utility_type: utilRaw.public_utility_type ?? null,
    sewer_type: utilRaw.sewer_type ?? null,
    water_source_type: utilRaw.water_source_type ?? null,
    plumbing_system_type: utilRaw.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      utilRaw.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: utilRaw.electrical_panel_capacity ?? null,
    electrical_wiring_type: utilRaw.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: utilRaw.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      utilRaw.electrical_wiring_type_other_description ?? null,
    solar_panel_present: utilRaw.solar_panel_present ?? false,
    solar_panel_type: utilRaw.solar_panel_type ?? null,
    solar_panel_type_other_description:
      utilRaw.solar_panel_type_other_description ?? null,
    smart_home_features: utilRaw.smart_home_features ?? null,
    smart_home_features_other_description:
      utilRaw.smart_home_features_other_description ?? null,
    hvac_unit_condition: utilRaw.hvac_unit_condition ?? null,
    solar_inverter_visible: utilRaw.solar_inverter_visible ?? false,
    hvac_unit_issues: utilRaw.hvac_unit_issues ?? null,

    // Optional passthroughs
    electrical_panel_installation_date:
      utilRaw.electrical_panel_installation_date ?? null,
    electrical_rewire_date: utilRaw.electrical_rewire_date ?? null,
    heating_fuel_type: utilRaw.heating_fuel_type ?? null,
    hvac_capacity_kw: utilRaw.hvac_capacity_kw ?? null,
    hvac_capacity_tons: utilRaw.hvac_capacity_tons ?? null,
    hvac_equipment_component: utilRaw.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: utilRaw.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: utilRaw.hvac_equipment_model ?? null,
    hvac_installation_date: utilRaw.hvac_installation_date ?? null,
    hvac_seer_rating: utilRaw.hvac_seer_rating ?? null,
    hvac_system_configuration: utilRaw.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      utilRaw.plumbing_system_installation_date ?? null,
    sewer_connection_date: utilRaw.sewer_connection_date ?? null,
    solar_installation_date: utilRaw.solar_installation_date ?? null,
    solar_inverter_installation_date:
      utilRaw.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: utilRaw.solar_inverter_manufacturer ?? null,
    solar_inverter_model: utilRaw.solar_inverter_model ?? null,
    water_connection_date: utilRaw.water_connection_date ?? null,
    water_heater_installation_date:
      utilRaw.water_heater_installation_date ?? null,
    water_heater_manufacturer: utilRaw.water_heater_manufacturer ?? null,
    water_heater_model: utilRaw.water_heater_model ?? null,
    well_installation_date: utilRaw.well_installation_date ?? null,
  };

  // Layouts from owners/layout_data.json
  const layoutsRaw = ((layoutsObj || {})[utilityKey] || {}).layouts || [];

  // Taxes from Value History and Tax Amount
  const taxes = [];
  $("#" + CSSescape("Value History and Tax Amount") + " tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length >= 10 && $tds.eq(0).hasClass("DataletData")) {
      const year = parseInt($tds.eq(0).text().trim(), 10);
      const landV = parseCurrency($tds.eq(1).text());
      const imprV = parseCurrency($tds.eq(2).text());
      const justV = parseCurrency($tds.eq(3).text());
      const assessed = parseCurrency($tds.eq(4).text());
      const taxable = parseCurrency($tds.eq(6).text());
      const taxEstimate = parseCurrency($tds.eq(8).text());
      taxes.push({
        tax_year: year,
        property_land_amount: landV,
        property_building_amount: imprV,
        property_market_value_amount: justV,
        property_assessed_value_amount: assessed,
        property_taxable_value_amount: taxable,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        yearly_tax_amount: taxEstimate,
      });
    }
  });

  // Sales and deed/file info from Sales table
  const sales = [];
  const deeds = [];
  const files = [];
  $("#" + CSSescape("Sales") + " tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length >= 5 && $tds.eq(0).hasClass("DataletData")) {
      const saleDate = toISODate($tds.eq(0).text().trim());
      const price = parseCurrency($tds.eq(1).text());
      if (saleDate && price != null) {
        sales.push({
          ownership_transfer_date: saleDate,
          purchase_price_amount: price,
        });
      }
      // Deed type and file
      const bookPageAnchor = $tds.eq(2).find("a");
      const href =
        bookPageAnchor && bookPageAnchor.attr("href")
          ? bookPageAnchor.attr("href")
          : null;
      const name =
        bookPageAnchor && bookPageAnchor.text()
          ? bookPageAnchor.text().trim()
          : null;
      const instr = $tds.eq(3).text().trim();
      const deedType = mapDeedType(instr);
      const deedObj = {};
      if (deedType) deedObj.deed_type = deedType;
      deeds.push(deedObj);
      // File
      const docType = mapFileDocumentTypeFromDeedType(deedType);
      files.push({
        document_type: docType ?? null,
        file_format: null,
        ipfs_url: null,
        name: name || null,
        original_url: href || null,
      });
    }
  });

  // Owners from owners/owner_data.json
  const ownersRaw = ((ownersObj || {})[utilityKey] || {}).owners_by_date || {};
  const currentOwners = ownersRaw.current || [];
  const persons = currentOwners.filter((o) => o.type === "person");

  // Write outputs
  // property.json
  writeJSON(path.join(dataDir, "property.json"), property);
  // address.json (unnormalized)
  writeJSON(path.join(dataDir, "address.json"), address);
  // lot.json
  writeJSON(path.join(dataDir, "lot.json"), lot);
  // structure.json
  writeJSON(path.join(dataDir, "structure.json"), structure);
  // utility.json
  writeJSON(path.join(dataDir, "utility.json"), util);
  // layout_*.json
  layoutsRaw.forEach((lay, idx) => {
    const out = {
      space_type: lay.space_type ?? null,
      space_index: lay.space_index ?? idx + 1,
      flooring_material_type: lay.flooring_material_type ?? null,
      size_square_feet: lay.size_square_feet ?? null,
      floor_level: lay.floor_level ?? null,
      has_windows: lay.has_windows ?? null,
      window_design_type: lay.window_design_type ?? null,
      window_material_type: lay.window_material_type ?? null,
      window_treatment_type: lay.window_treatment_type ?? null,
      is_finished:
        typeof lay.is_finished === "boolean" ? lay.is_finished : null,
      furnished: lay.furnished ?? null,
      paint_condition: lay.paint_condition ?? null,
      flooring_wear: lay.flooring_wear ?? null,
      clutter_level: lay.clutter_level ?? null,
      visible_damage: lay.visible_damage ?? null,
      countertop_material: lay.countertop_material ?? null,
      cabinet_style: lay.cabinet_style ?? null,
      fixture_finish_quality: lay.fixture_finish_quality ?? null,
      design_style: lay.design_style ?? null,
      natural_light_quality: lay.natural_light_quality ?? null,
      decor_elements: lay.decor_elements ?? null,
      pool_type: lay.pool_type ?? null,
      pool_equipment: lay.pool_equipment ?? null,
      spa_type: lay.spa_type ?? null,
      safety_features: lay.safety_features ?? null,
      view_type: lay.view_type ?? null,
      lighting_features: lay.lighting_features ?? null,
      condition_issues: lay.condition_issues ?? null,
      is_exterior:
        typeof lay.is_exterior === "boolean" ? lay.is_exterior : false,
      pool_condition: lay.pool_condition ?? null,
      pool_surface_type: lay.pool_surface_type ?? null,
      pool_water_quality: lay.pool_water_quality ?? null,
    };
    writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), out);
  });

  // tax files
  taxes.forEach((t) => {
    writeJSON(path.join(dataDir, `tax_${t.tax_year}.json`), t);
  });

  // sales files
  sales.forEach((s, idx) => {
    writeJSON(path.join(dataDir, `sales_${idx + 1}.json`), s);
  });

  // deed and file outputs (align with sales order)
  deeds.forEach((d, idx) => {
    writeJSON(path.join(dataDir, `deed_${idx + 1}.json`), d);
  });
  files.forEach((f, idx) => {
    writeJSON(path.join(dataDir, `file_${idx + 1}.json`), f);
  });

  // person files
  persons.forEach((p, idx) => {
    const person = {
      birth_date: null,
      first_name: titleCaseName(p.first_name || ""),
      last_name: titleCaseName(p.last_name || ""),
      middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    writeJSON(path.join(dataDir, `person_${idx + 1}.json`), person);
  });

  // Buyer relationships: only link current owners to the most recent sale (sales_1.json)
  // First, remove any previously generated buyer relationship files to avoid unsupported links
  removeFilesByPrefix(dataDir, "relationship_sales_person_");
  if (persons.length > 0 && sales.length > 0) {
    persons.forEach((_, idx) => {
      const rel = {
        to: { "/": `./person_${idx + 1}.json` },
        from: { "/": `./sales_1.json` },
      };
      writeJSON(
        path.join(dataDir, `relationship_sales_person_${idx + 1}.json`),
        rel,
      );
    });
  }

  // relationships: deed-file and sales-deed for all entries
  if (deeds.length > 0 && files.length > 0) {
    const relDF = {
      from: { "/": "./deed_1.json" },
      to: { "/": "./file_1.json" },
    };
    writeJSON(path.join(dataDir, "relationship_deed_file.json"), relDF);
    for (let i = 2; i <= Math.min(deeds.length, files.length); i++) {
      const rel = {
        from: { "/": `./deed_${i}.json` },
        to: { "/": `./file_${i}.json` },
      };
      writeJSON(path.join(dataDir, `relationship_deed_file_${i}.json`), rel);
    }
  }
  if (sales.length > 0 && deeds.length > 0) {
    const relSD = {
      from: { "/": "./sales_1.json" },
      to: { "/": "./deed_1.json" },
    };
    writeJSON(path.join(dataDir, "relationship_sales_deed.json"), relSD);
    for (let i = 2; i <= Math.min(sales.length, deeds.length); i++) {
      const rel = {
        from: { "/": `./sales_${i}.json` },
        to: { "/": `./deed_${i}.json` },
      };
      writeJSON(path.join(dataDir, `relationship_sales_deed_${i}.json`), rel);
    }
  }

  // property fallback relationships to structure/utility when layout links are absent
  const relationshipFiles = fs
    .readdirSync(dataDir)
    .filter((name) => name.startsWith("relationship_"));
  const hasLayoutStructureRel = relationshipFiles.some(
    (name) => name.includes("layout") && name.includes("structure"),
  );
  const hasLayoutUtilityRel = relationshipFiles.some(
    (name) => name.includes("layout") && name.includes("utility"),
  );
  const propertyPath = "./property.json";
  const structurePath = "./structure.json";
  const utilityPath = "./utility.json";

  if (!hasLayoutStructureRel && fs.existsSync(path.join(dataDir, "structure.json"))) {
    removeFilesByPrefix(dataDir, "relationship_property_structure");
    const relPropertyStructure = {
      from: { "/": propertyPath },
      to: { "/": structurePath },
    };
    writeJSON(
      path.join(dataDir, "relationship_property_structure.json"),
      relPropertyStructure,
    );
  }

  if (!hasLayoutUtilityRel && fs.existsSync(path.join(dataDir, "utility.json"))) {
    removeFilesByPrefix(dataDir, "relationship_property_utility");
    const relPropertyUtility = {
      from: { "/": propertyPath },
      to: { "/": utilityPath },
    };
    writeJSON(
      path.join(dataDir, "relationship_property_utility.json"),
      relPropertyUtility,
    );
  }
}

try {
  extract();
  console.log("Script executed successfully.");
} catch (e) {
  console.error((e && e.stack) || String(e));
  process.exit(1);
}
