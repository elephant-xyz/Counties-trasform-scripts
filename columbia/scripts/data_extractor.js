// Data extraction script per evaluator instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - Sales/Tax/Deed from input.html
// - Writes outputs to ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function removeFiles(dir, predicate) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (predicate(entry)) {
      fs.unlinkSync(path.join(dir, entry));
    }
  }
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeUseCodeDescription(value) {
  if (!value) return null;
  return String(value)
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&LT;/g, "<")
    .replace(/&GT;/g, ">")
    .replace(/</g, "LT")
    .replace(/>/g, "GT")
    .replace(/[^A-Z0-9]/g, "");
}

const propertyUseCodeMap = {
  ANY: {
    property_type: "LandParcel",
    build_status: null,
    structure_form: null,
    property_usage_type: "Unknown",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  VACANT: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SINGLEFAMILY: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "SingleFamilyDetached",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: "One",
  },
  MOBILEHOME: {
    property_type: "ManufacturedHome",
    build_status: "Improved",
    structure_form: "MobileHome",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: "One",
  },
  MULTIFAM: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MULTIFAMLT10: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: "OneToFour",
  },
  MULTIFAMGT10: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CONDOMINIA: {
    property_type: "Unit",
    build_status: "Improved",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
    ownership_estate_type: "Condominium",
    number_of_units_type: "One",
  },
  COOPERATIVES: {
    property_type: "Unit",
    build_status: "Improved",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
    ownership_estate_type: "Cooperative",
    number_of_units_type: "One",
  },
  RETIREMENTHOMES: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Retirement",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MISCIMPROVED: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  VACANTCOMMERCIAL: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Commercial",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  STORES1STORY: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "RetailStore",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CONVSTOREGAS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ServiceStation",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MXDRESOFFSTO: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Commercial",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  DEPARTMNTSTORE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "DepartmentStore",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SUPERMARKET: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Supermarket",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  REGIONALSHOPPING: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ShoppingCenterRegional",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  COMMUNITYSHOPPING: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ShoppingCenterCommunity",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  OFFICEBLD1STY: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  OFFCEBLDMSTY: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PROFESSOFFBLD: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  TRANSITTERMINL: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "TransportationTerminal",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  RESTAURANTCAFE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Restaurant",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  DRIVEINREST: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Restaurant",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  FINANCIALBLDG: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "FinancialInstitution",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  INSURANCECOMP: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "FinancialInstitution",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  REPAIRSERVICE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Commercial",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  BEAUTYPARLOR: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Commercial",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SERVICESTATION: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ServiceStation",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  VEHSALEREPAIR: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "AutoSalesRepair",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  RVMHPARKS: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MobileHomePark",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  WHOLESALEOUTLET: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "WholesaleOutlet",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  FLORISTGREENHOUSE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "NurseryGreenhouse",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  DRIVEINOPENSTAD: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  THEATERAUDITORIUM: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Theater",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  NIGHTCLUBBARS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  BOWLRINKSPOOL: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  TOURISTATTRACTION: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CAMPS: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  RACETRACKSALL: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "RaceTrack",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  GOLFCOURSES: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GolfCourse",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  HOTELSMOTELS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Hotel",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  VACANTINDUSTRIAL: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Industrial",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  LIGHTMANUFACTURE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LightManufacturing",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  HEAVYINDUSTRL: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "HeavyManufacturing",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  LUMBERYARD: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LumberYard",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PACKINGPLANTS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PackingPlant",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CANNERIESBOTTLERS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Cannery",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  OTHERFOODPROCESS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LightManufacturing",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MINERALPROCESSING: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MineralProcessing",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  WAREHOSEDISTRB: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Warehouse",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  OPENSTORAGE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OpenStorage",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  IMPROVEDAG: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Agricultural",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CROPLAND: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "DrylandCropland",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  TIMBERLAND: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  IMPPASTURE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ImprovedPasture",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SIMPPASTURE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PastureWithTimber",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  NATPASTURE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "NativePasture",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  LOWPASTURE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Rangeland",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PASTURECLS6: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GrazingLand",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  GROVESORCHRD: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "OrchardGroves",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  POULTBEESFISHETC: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LivestockFacility",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  DAIRIESFEEDLOTS: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "LivestockFacility",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MISCAG: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Agricultural",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  VACINSTITUTIONAL: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CHURCHES: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Church",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PRVTSCHLDAYCARE: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PrivateSchool",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PRIVATEHOSPITALS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PrivateHospital",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  HOMESFORTHEAGED: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "HomesForAged",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  NONPROFITORPHANA: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "NonProfitCharity",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MORTUARYCEMETARY: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MortuaryCemetery",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CLUBSLODGESHALLS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ClubsLodges",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  RESTHOMES: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "SanitariumConvalescentHome",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CULTERALGROUPS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "CulturalOrganization",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MILITARY: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Military",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  FORESTPARKSREC: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "ForestParkRecreation",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  PUBLICSCHOOLS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PublicSchool",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  COLLEGES: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PublicSchool",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  HOSPITALS: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "PublicHospital",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  COUNTY: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  COUNTYRVPARK: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  STATE: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  WATERMGDIST: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SPECIALTAXING: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  OUA: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  TIITFSFWMD: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  FEDERAL: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MUNICIPAL: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  LEASEHOLDINTEREST: {
    property_type: "LandParcel",
    build_status: null,
    structure_form: null,
    property_usage_type: "Commercial",
    ownership_estate_type: "Leasehold",
    number_of_units_type: null,
  },
  UTILITIES: {
    property_type: "Building",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Utility",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  MINING: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "MineralProcessing",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  SUBSURFACERGHT: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "Unknown",
    ownership_estate_type: "SubsurfaceRights",
    number_of_units_type: null,
  },
  RIGHTSOFWAY: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TransitionalProperty",
    ownership_estate_type: "RightOfWay",
    number_of_units_type: null,
  },
  RIVERSANDLAKES: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "RiversLakes",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  WASTELANDDUMPS: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "SewageDisposal",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  RECANDPARKLAND: {
    property_type: "LandParcel",
    build_status: "Improved",
    structure_form: null,
    property_usage_type: "Recreational",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  CENTRALLYASSED: {
    property_type: "LandParcel",
    build_status: null,
    structure_form: null,
    property_usage_type: "ReferenceParcel",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
  NONAGACREAGE: {
    property_type: "LandParcel",
    build_status: "VacantLand",
    structure_form: null,
    property_usage_type: "TransitionalProperty",
    ownership_estate_type: "FeeSimple",
    number_of_units_type: null,
  },
};

const propertyUseCodeAliases = {
  MULTIFAM10: "MULTIFAM",
};

function findUseCodeKeyBySubstring(haystack, keys, skip = new Set()) {
  if (!haystack) return null;
  let bestKey = null;
  for (const key of keys) {
    if (skip.has(key)) continue;
    if (haystack.includes(key)) {
      if (!bestKey || key.length > bestKey.length) {
        bestKey = key;
      }
    }
  }
  return bestKey;
}

function getPropertyUseAttributes(rawValue) {
  const normalized = normalizeUseCodeDescription(rawValue);
  if (!normalized) return null;
  const direct = propertyUseCodeMap[normalized];
  if (direct) return direct;
  const aliasKey = propertyUseCodeAliases[normalized];
  if (aliasKey) return propertyUseCodeMap[aliasKey];
  const haystacks = new Set();
  haystacks.add(normalized);
  if (rawValue != null) {
    const collapsed = String(rawValue)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (collapsed) haystacks.add(collapsed);
  }
  const mapKeys = Object.keys(propertyUseCodeMap);
  const aliasKeys = Object.keys(propertyUseCodeAliases);
  const skipKeys = new Set(["ANY"]);
  for (const hay of haystacks) {
    const matchKey = findUseCodeKeyBySubstring(hay, mapKeys, skipKeys);
    if (matchKey) return propertyUseCodeMap[matchKey];
    const aliasMatch = findUseCodeKeyBySubstring(hay, aliasKeys);
    if (aliasMatch) return propertyUseCodeMap[propertyUseCodeAliases[aliasMatch]];
  }
  return null;
}


(function verifyPropertyUseMapping() {
  try {
    const codesPath = path.resolve(__dirname, "..", "property_use_code.txt");
    const raw = fs.readFileSync(codesPath, "utf8");
    const codes = JSON.parse(raw);
    const missing = codes
      .map((code) => ({ code, mapped: getPropertyUseAttributes(code) }))
      .filter(({ mapped }) => !mapped)
      .map(({ code }) => normalizeUseCodeDescription(code))
      .filter(Boolean);
    if (missing.length) {
      console.warn(`Missing property use code mappings for: ${missing.join(", ")}`);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("Property use code verification failed:", err.message);
    }
  }
})();
function formatNameToPattern(name) {
  if (!name) return null;
  // Replace common digit-to-letter substitutions that appear in data entry errors
  let cleaned = name.trim()
    .replace(/0/g, "O")  // Zero to letter O
    .replace(/1/g, "I")  // One to letter I
    .replace(/3/g, "E")  // Three to letter E
    .replace(/5/g, "S")  // Five to letter S
    .replace(/8/g, "B"); // Eight to letter B

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove any remaining non-letter, non-special-character symbols
  cleaned = cleaned.replace(/[^A-Za-z \-',.]/g, "");

  // Split by special characters while preserving them
  const parts = cleaned.split(/([ \-',.])/);

  // Filter out empty strings and format each part
  const formatted = parts
    .map((part) => {
      if (!part) return "";
      if (part.match(/[ \-',.]/)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join("");

  // Trim the result to remove any leading/trailing whitespace
  let result = formatted.trim();

  // Remove leading non-letter characters to ensure pattern compliance
  // Pattern requires: ^[A-Z][a-zA-Z\s\-',.]*$
  result = result.replace(/^[^A-Za-z]+/, "");

  // Ensure first character is uppercase
  if (result && result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  // Return null if result is empty or doesn't match the required pattern
  if (!result || !/^[A-Z][a-zA-Z\s\-',.]*$/.test(result)) {
    return null;
  }

  return result;
}

function mapPrefixName(name) {
  if (!name) return null;
  const prefixes = {
    'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
    'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
    'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
    'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
    'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
  };
  // Remove dots before looking up to match ownerMapping.js behavior
  const key = name.replace(/\./g, "").toUpperCase();
  return prefixes[key] || null;
}

function mapSuffixName(name) {
  if (!name) return null;
  const suffixes = {
    'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
    'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
    'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
    'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
  };
  // Remove dots before looking up to match ownerMapping.js behavior
  const key = name.replace(/\./g, "").toUpperCase();
  return suffixes[key] || null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
const layoutDataPath = path.join("owners", "layout_data.json");
const structureDataPath = path.join("owners", "structure_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJson(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJson(utilitiesDataPath)
    : null;
const layoutData = fs.existsSync(layoutDataPath)
    ? readJson(layoutDataPath)
    : null;
  const structureData = fs.existsSync(structureDataPath)
    ? readJson(structureDataPath)
    : null;

  const propertySeed = fs.existsSync("property_seed.json")
    ? readJson("property_seed.json")
    : null;
  const unnormalizedAddress = fs.existsSync("unnormalized_address.json")
    ? readJson("unnormalized_address.json")
    : null;

  // Determine hyphenated parcel id from HTML
  let hyphenParcel = null;
  // Updated selector for parcel ID
  const parcelText = $("table.parcelIDtable b").first().text().trim();
  const mParcel = parcelText.match(/^([^\s(]+)/); // Matches "23-4S-16-03099-117" from "23-4S-16-03099-117 (14877)"
  if (mParcel) hyphenParcel = mParcel[1];
  if (!hyphenParcel) {
    const fmt = $('input[name="formatPIN"]').attr("value");
    if (fmt) hyphenParcel = fmt.trim();
  }
  const parcelIdentifierFromHtml = (() => {
    const display = parcelText ? parcelText.replace(/\s*\(.*$/, "").trim() : null;
    if (display) return display;
    const buffer = $('input[name="PARCELID_Buffer"]').attr("value");
    if (buffer && String(buffer).trim()) return String(buffer).trim();
    const zoomMatch = (html.match(/zoomParcel\([^)]*'([0-9A-Z-]+)'\)/i) || [])[1];
    return zoomMatch || null;
  })();

  const propertyKey = hyphenParcel ? `property_${hyphenParcel}` : null;

  let utilitiesScope = null;
  if (utilitiesData && propertyKey && utilitiesData[propertyKey]) {
    utilitiesScope = utilitiesData[propertyKey];
  }

  let layoutScope = null;
  if (layoutData && propertyKey && layoutData[propertyKey]) {
    layoutScope = layoutData[propertyKey];
  }

  let structureScope = null;
  if (structureData && propertyKey && structureData[propertyKey]) {
    structureScope = structureData[propertyKey];
  }

  // Helper to clone source http request metadata
  const cloneSourceHttp = () =>
    (propertySeed && propertySeed.source_http_request
      ? JSON.parse(JSON.stringify(propertySeed.source_http_request))
      : null) ||
    (unnormalizedAddress && unnormalizedAddress.source_http_request
      ? JSON.parse(JSON.stringify(unnormalizedAddress.source_http_request))
      : null) || {
      method: "GET",
      url: "https://columbia.floridapa.com/gis",
    };

  // 1) OWNERS
  const ownerRecordMap = new Map();
  const normalizeOwnerText = (s) =>
    s == null ? "" : String(s).replace(/\s+/g, " ").trim();
  const saleBuyersByDate = {};
  let currentOwnerRecords = [];
  let personIndex = 0;
  let companyIndex = 0;
  const personRecords = [];
  const companyRecords = [];
  const mailingAddressRelPath = "./mailing_address.json";
  let mailingAddressCreated = false;
  let mailingAddressValue = null;
  const mailingRelationshipWritten = new Set();

  function ownerKey(owner) {
    if (!owner || !owner.type) return null;
    if (owner.type === "company") {
      return normalizeOwnerText(owner.name || "")
        .toLowerCase()
        .replace(/[.,']/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    const parts = [
      owner.prefix_name || "",
      owner.first_name || "",
      owner.middle_name || "",
      owner.last_name || "",
      owner.suffix_name || "",
    ];
    return normalizeOwnerText(parts.join(" ")).toLowerCase();
  }

  function ensureMailingAddressFile(addressText) {
    const candidate =
      addressText && String(addressText).trim()
        ? String(addressText).trim()
        : null;
    const shouldRewrite =
      !mailingAddressCreated ||
      (mailingAddressCreated && mailingAddressValue == null && candidate);
    if (!shouldRewrite) return;
    if (candidate != null) mailingAddressValue = candidate;
    const filePath = path.join("data", "mailing_address.json");
    writeJson(filePath, {
      unnormalized_address: mailingAddressValue,
      latitude: null,
      longitude: null,
      source_http_request: cloneSourceHttp(),
      request_identifier: hyphenParcel,
    });
    mailingAddressCreated = true;
  }

  function writeMailingRelationship(ownerRecord) {
    if (!ownerRecord) return;
    const key = `${ownerRecord.type}-${ownerRecord.index}`;
    if (mailingRelationshipWritten.has(key)) return;
    const relName =
      ownerRecord.type === "company"
        ? `relationship_company_${ownerRecord.index}_has_mailing_address.json`
        : `relationship_person_${ownerRecord.index}_has_mailing_address.json`;
    writeJson(path.join("data", relName), {
      from: { "/": ownerRecord.relPath },
      to: { "/": mailingAddressRelPath },
    });
    mailingRelationshipWritten.add(key);
  }

  function ensureOwnerRecord(owner) {
    if (!owner || !owner.type) return null;
    const key = ownerKey(owner);
    if (!key) return null;
    if (ownerRecordMap.has(key)) return ownerRecordMap.get(key);

    let record = null;
    if (owner.type === "company") {
      companyIndex += 1;
      const fileName = `company_${companyIndex}.json`;
      const filePath = path.join("data", fileName);
      writeJson(filePath, { name: owner.name || null });
      record = {
        type: "company",
        relPath: `./${fileName}`,
        index: companyIndex,
      };
      companyRecords.push(record);
    } else if (owner.type === "person") {
      personIndex += 1;
      const fileName = `person_${personIndex}.json`;
      const filePath = path.join("data", fileName);
      const person = {
        source_http_request: cloneSourceHttp(),
        request_identifier: hyphenParcel,
        birth_date: null,
        first_name: owner.first_name
          ? formatNameToPattern(owner.first_name)
          : null,
        last_name: owner.last_name
          ? formatNameToPattern(owner.last_name)
          : null,
        middle_name: owner.middle_name
          ? formatNameToPattern(owner.middle_name)
          : null,
        prefix_name: mapPrefixName(owner.prefix_name),
        suffix_name: mapSuffixName(owner.suffix_name),
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJson(filePath, person);
      record = {
        type: "person",
        relPath: `./${fileName}`,
        index: personIndex,
      };
      personRecords.push(record);
    } else {
      return null;
    }

    ownerRecordMap.set(key, record);
    return record;
  }

  if (ownerData) {
    const ownerKeyPath = hyphenParcel ? `property_${hyphenParcel}` : null;
    const ownersScope =
      ownerKeyPath && ownerData[ownerKeyPath] ? ownerData[ownerKeyPath] : null;
    if (ownersScope && ownersScope.owners_by_date) {
      for (const [dateKey, ownerList] of Object.entries(
        ownersScope.owners_by_date,
      )) {
        if (!Array.isArray(ownerList) || ownerList.length === 0) continue;
        const records = [];
        for (const owner of ownerList) {
          const record = ensureOwnerRecord(owner);
          if (record) {
            ensureMailingAddressFile(owner.mailing_address || null);
            writeMailingRelationship(record);
            records.push(record);
          }
        }
        if (!records.length) continue;
        const deduped = Array.from(
          new Map(records.map((r) => [r.relPath, r])).values(),
        );
        if (dateKey === "current") currentOwnerRecords = deduped;
        else saleBuyersByDate[dateKey] = deduped;
      }
    }
  }

  globalThis.__ownerPersonRecords = personRecords;
  globalThis.__ownerCompanyRecords = companyRecords;
  globalThis.__currentOwnerRecords = currentOwnerRecords;
  globalThis.__saleBuyersByDate = saleBuyersByDate;

  // 2) SALES + DEEDS + FILES
  const salesRows = [];
  // Updated selector for sales table
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
    (idx, el) => {
      if (idx === 0) return; // Skip header row
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const dateTxt = $(tds[0]).text().trim();
        const priceTxt = $(tds[1]).text().trim();
        const bookPageTxt = $(tds[2]).text().trim();
        const deedCode = $(tds[3]).text().trim();
        const viTxt = tds.length > 4 ? $(tds[4]).text().trim() : null;
        const qualificationTxt = tds.length > 5 ? $(tds[5]).text().trim() : null;
        const rcodeTxt = tds.length > 6 ? $(tds[6]).text().trim() : null;
        if (dateTxt && /\d/.test(dateTxt)) {
          const linkEl = $(tds[2]).find("a");
          let clerkRef = null;
          const href = linkEl.attr("href") || "";
          const onClick = linkEl.attr("onclick") || "";
          const js = href || onClick;
          // Extract book and page from ClerkLink('book','page')
          const m1 = js.match(/ClerkLink\('([^']+)'\s*,\s*'([^']+)'\)/);
          if (m1) clerkRef = `${m1[1]}/${m1[2]}`; // Format as "book/page"
          salesRows.push({
            dateTxt,
            priceTxt,
            deedCode,
            bookPageTxt,
            clerkRef,
            viTxt: viTxt || null,
            qualificationTxt: qualificationTxt || null,
            rcodeTxt: rcodeTxt || null,
          });
        }
      }
    },
  );

  const deedCodeMap = {
    "WD": "Warranty Deed",
    "WTY": "Warranty Deed",
    "SWD": "Special Warranty Deed",
    "SW": "Special Warranty Deed",
    "Spec WD": "Special Warranty Deed",
    "QCD": "Quitclaim Deed",
    "QC": "Quitclaim Deed",
    "Quitclaim": "Quitclaim Deed",
    "GD": "Grant Deed",
    "BSD": "Bargain and Sale Deed",
    "LBD": "Lady Bird Deed",
    "TOD": "Transfer on Death Deed",
    "TODD": "Transfer on Death Deed",
    "SD": "Sheriff's Deed",
    "Shrf's Deed": "Sheriff's Deed",
    "TD": "Tax Deed",
    "TrD": "Trustee's Deed",
    "TR": "Trustee's Deed",
    "Trustee Deed": "Trustee's Deed",
    "PRD": "Personal Representative Deed",
    "Pers Rep Deed": "Personal Representative Deed",
    "CD": "Correction Deed",
    "Corr Deed": "Correction Deed",
    "DIL": "Deed in Lieu of Foreclosure",
    "DILF": "Deed in Lieu of Foreclosure",
    "LED": "Life Estate Deed",
    "LE": "Life Estate Deed",
    "JTD": "Joint Tenancy Deed",
    "TIC": "Tenancy in Common Deed",
    "CPD": "Community Property Deed",
    "Gift Deed": "Gift Deed",
    "ITD": "Interspousal Transfer Deed",
    "Wild D": "Wild Deed",
    "SMD": "Special Master's Deed",
    "COD": "Court Order Deed",
    "CFD": "Contract for Deed",
    "QTD": "Quiet Title Deed",
    "AD": "Administrator's Deed",
    "GD (Guardian)": "Guardian's Deed",
    "RD": "Receiver's Deed",
    "ROW": "Right of Way Deed",
    "VPD": "Vacation of Plat Deed",
    "AOC": "Assignment of Contract",
    "ROC": "Release of Contract",
    "LC": "Contract for Deed",
    "CONV": "Miscellaneous",
    "OTH": "Miscellaneous"
  };

  const titleDocumentCodes = new Set(
    [
      "WD",
      "WTY",
      "SWD",
      "SW",
      "SPEC WD",
      "QCD",
      "QC",
      "QUITCLAIM",
      "GD",
      "BSD",
      "LBD",
      "TOD",
      "TODD",
      "SD",
      "SHRF'S DEED",
      "TD",
      "TRD",
      "TR",
      "TRUSTEE DEED",
      "PRD",
      "PERS REP DEED",
      "CD",
      "CORR DEED",
      "DIL",
      "DILF",
      "LED",
      "LE",
      "JTD",
      "TIC",
      "CPD",
      "GIFT DEED",
      "ITD",
      "WILD D",
      "SMD",
      "COD",
      "CFD",
      "QTD",
      "AD",
      "GD (GUARDIAN)",
      "RD",
      "ROW",
      "VPD",
      "CONV",
      "DEED",
    ].map((code) => code.toUpperCase()),
  );

const specificDocumentTypeMap = {
  ASSG: "Assignment",
  JUDG: "AbstractOfJudgment",
};

  function normalizeDeedCode(code) {
    return code == null
      ? ""
      : String(code).replace(/\s+/g, " ").trim().toUpperCase();
  }

  function mapFileDocumentType(code) {
    const normalized = normalizeDeedCode(code);
    if (!normalized) return null;
    if (titleDocumentCodes.has(normalized)) return "Title";
    if (specificDocumentTypeMap[normalized]) {
      return specificDocumentTypeMap[normalized];
    }
    return null;
  }

  const toSafeString = (val, fallback = "") => {
    if (val == null) return fallback;
    const str = String(val).trim();
    return str.length ? str : fallback;
  };

  const saleHistoryMeta = [];
  let saleIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;

  const parseBookPage = (txt) => {
    if (!txt) return { book: null, page: null };
    const m = String(txt).match(/(\d+)\s*\/\s*(\d+)/);
    if (m) return { book: m[1], page: m[2] };
    return { book: null, page: null };
  };

  const mapSaleQualification = (value) => {
    if (!value) return null;
    const token = String(value).trim();
    if (!token) return null;
    const upper = token.toUpperCase();
    if (upper === "Q" || upper === "QUAL" || upper === "QUALIFIED") {
      return "TypicallyMotivated";
    }
    if (upper === "U" || upper.startsWith("UNQUAL")) return null;
    if (upper.includes("PROBATE")) return "ProbateSale";
    if (upper.includes("SHORT")) return "ShortSale";
    if (upper.includes("COURT")) return "CourtOrderedNonForeclosureSale";
    if (upper.includes("REO") || upper.includes("POST FORECLOSURE"))
      return "ReoPostForeclosureSale";
    if (upper.includes("RELOCATION")) return "RelocationSale";
    if (upper.includes("TRUSTEE") && upper.includes("JUD"))
      return "TrusteeJudicialForeclosureSale";
    if (upper.includes("TRUSTEE")) return "TrusteeNonJudicialForeclosureSale";
    return null;
  };

  for (const row of salesRows) {
    saleIndex += 1;
    const saleFileName = `sales_history_${saleIndex}.json`;
    const saleFilePath = path.join("data", saleFileName);
    const saleDateISO = parseDateToISO(row.dateTxt);
    const mappedSaleType =
      mapSaleQualification(row.qualificationTxt) ||
      mapSaleQualification(row.viTxt);
    const saleType = mappedSaleType || "TypicallyMotivated";
    const sale = {
      source_http_request: cloneSourceHttp(),
      request_identifier: hyphenParcel,
      ownership_transfer_date: saleDateISO,
      purchase_price_amount: parseCurrencyToNumber(row.priceTxt),
      sale_type: saleType,
    };
    writeJson(saleFilePath, sale);
    const saleMeta = {
      index: saleIndex,
      relPath: `./${saleFileName}`,
      dateISO: saleDateISO,
    };
    saleHistoryMeta.push(saleMeta);

    deedIndex += 1;
    const deedFileName = `deed_${deedIndex}.json`;
    const deedFilePath = path.join("data", deedFileName);
    const { book, page } = parseBookPage(row.bookPageTxt);
    const instrumentNumber = toSafeString(
      row.rcodeTxt || row.clerkRef || row.bookPageTxt,
      "",
    );
    const volume = toSafeString(book, "");
    const deedTypeValue = deedCodeMap[row.deedCode] || null;
    const deed = {
      source_http_request: cloneSourceHttp(),
      request_identifier: hyphenParcel,
      book: book || null,
      page: page || null,
      volume,
      instrument_number: instrumentNumber,
    };
    if (deedTypeValue != null) {
      deed.deed_type = deedTypeValue;
    }
    writeJson(deedFilePath, deed);
    saleMeta.deed = { index: deedIndex, relPath: `./${deedFileName}` };

    writeJson(
      path.join(
        "data",
        `relationship_sales_history_${saleIndex}_has_deed_${deedIndex}.json`,
      ),
      {
        from: { "/": saleMeta.relPath },
        to: { "/": saleMeta.deed.relPath },
      },
    );

    fileIndex += 1;
    const fileName = `file_${fileIndex}.json`;
    const filePath = path.join("data", fileName);
    const fileRec = {
      document_type: mapFileDocumentType(row.deedCode),
      file_format: null,
      name: row.clerkRef
        ? `Official Records ${row.clerkRef}`
        : row.bookPageTxt
          ? `Book/Page ${row.bookPageTxt}`
          : null,
      original_url: null,
      ipfs_url: null,
      request_identifier: hyphenParcel,
      source_http_request: cloneSourceHttp(),
    };
    writeJson(filePath, fileRec);
    writeJson(
      path.join(
        "data",
        `relationship_deed_${deedIndex}_has_file_${fileIndex}.json`,
      ),
      {
        from: { "/": saleMeta.deed.relPath },
        to: { "/": `./${fileName}` },
      },
    );
  }

  const saleBuyersByDateMap = globalThis.__saleBuyersByDate || {};
  const currentOwnerRecordsForSales =
    globalThis.__currentOwnerRecords || [];

  let latestSaleIndex = null;
  let latestSaleDate = null;
  for (const sale of saleHistoryMeta) {
    if (sale.dateISO) {
      if (!latestSaleDate || sale.dateISO > latestSaleDate) {
        latestSaleDate = sale.dateISO;
        latestSaleIndex = sale.index;
      }
    } else if (latestSaleIndex == null) {
      latestSaleIndex = sale.index;
    }
  }

  for (const sale of saleHistoryMeta) {
    const buyers = [];
    if (sale.dateISO && saleBuyersByDateMap[sale.dateISO]) {
      buyers.push(...saleBuyersByDateMap[sale.dateISO]);
    }
    if (sale.index === latestSaleIndex && currentOwnerRecordsForSales.length) {
      buyers.push(...currentOwnerRecordsForSales);
    }
    const dedup = new Map();
    buyers.forEach((record) => {
      if (record && record.relPath && !dedup.has(record.relPath)) {
        dedup.set(record.relPath, record);
      }
    });
    for (const record of dedup.values()) {
      const relFileName = `relationship_sales_history_${sale.index}_has_${record.type}_${record.index}.json`;
      writeJson(path.join("data", relFileName), {
        from: { "/": sale.relPath },
        to: { "/": record.relPath },
      });
    }
  }

  // 3) TAX
  function buildTaxFromSection(sectionTitleContains, taxYear) {
    let table = null;
    // Updated selector for tax tables
    $("table.parcelDetails_insideTable").each((i, el) => {
      const head = $(el).find("tr").first().text();
      // Trim and normalize whitespace for a more robust match
      if (head && head.trim().replace(/\s+/g, ' ').includes(sectionTitleContains)) {
        table = $(el);
        return false;
      }
      return true;
    });
    if (!table) return null;
    function findRow(label) {
      let out = null;
      table.find("tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 2) {
          const lab = $(tds[0]).text().trim();
          if (lab.startsWith(label)) {
            out = $(tds[1]).text().trim();
            return false;
          }
        }
        return true;
      });
      return out;
    }
    const land = findRow("Mkt Land");
    const bldg = findRow("Building");
    const just = findRow("Just"); // This was "Market" in the previous example, but "Just" is present in some HTMLs
    const assessed = findRow("Assessed");
    let taxable = null;
    table.find("tr").each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (label.startsWith("Total")) {
          const htmlContent = $(tds[1]).html() || "";
          // Look for "county:$" pattern first
          const m = htmlContent.replace(/\n/g, " ").match(/county:\s*\$([0-9,\.]+)/i);
          if (m) taxable = m[1];
          else {
            // Fallback to general currency regex if "county:" not found
            const text = $(tds[1]).text();
            const m2 = text.match(/\$[0-9,\.]+/);
            if (m2) taxable = m2[0];
          }
        }
      }
    });
    if (!land || !bldg || !just || !assessed || !taxable) return null;
    return {
      tax_year: taxYear,
      property_assessed_value_amount: parseCurrencyToNumber(assessed),
      property_market_value_amount: parseCurrencyToNumber(just),
      property_building_amount: parseCurrencyToNumber(bldg),
      property_land_amount: parseCurrencyToNumber(land),
      property_taxable_value_amount: parseCurrencyToNumber(taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
  }
  const tax2025 = buildTaxFromSection("2025 Certified Values", 2025); // Updated section title to match sample HTML
  if (tax2025) writeJson(path.join("data", "tax_2025.json"), tax2025);
  const tax2026 = buildTaxFromSection("2026 Working Values", 2026); // Added 2026 tax data from sample HTML
  if (tax2026) writeJson(path.join("data", "tax_2026.json"), tax2026);

  // 4) PROPERTY
  const parcelIdentifier =
    parcelIdentifierFromHtml ||
    (propertySeed && propertySeed.parcel_id
      ? propertySeed.parcel_id
      : hyphenParcel || null); // Prefer HTML buffer, then seed, finally hyphenated id

  // Clean full legal text without UI anchor artifacts
  let legal = null;
  // Updated selectors for legal description
  if ($("#Flegal").length) {
    const f = $("#Flegal").clone();
    f.find("a").remove();
    legal = f.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
  } else if ($("#Blegal").length) {
    const b = $("#Blegal").clone();
    b.find("a").remove();
    legal = b.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
  }

  // livable and effective year
  let livable = null,
    effYear = null;
  // Updated selector for building table
  const bldgTable = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable",
  ).first();
  if (bldgTable && bldgTable.length) {
    const firstRow = bldgTable.find("tr").eq(1); // Assuming the first data row is the main building
    const tds = firstRow.find("td");
    if (tds.length >= 6) {
      const actualSF = tds.eq(4).text().trim(); // Actual SF is at index 4
      if (actualSF) livable = actualSF;
      const y = tds.eq(2).text().trim(); // Year Blt is at index 2
      if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
    }
  }

  // Extract Area and convert to square feet
  let totalAreaSqft = null;
  // Updated selector for Land Area
  const landAreaTd = $('td:contains("Area")').first();
  if (landAreaTd.length) {
    const areaText = landAreaTd.next('td').text().trim();
    const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
    }
  }


  // Extract Use Code and map property attributes
  const useCodeVal = $('td')
    .filter((i, el) => $(el).text().trim().startsWith("Use"))
    .next()
    .text()
    .trim();

  const propertyUseAttributes = getPropertyUseAttributes(useCodeVal) || propertyUseCodeMap.ANY;

  function getNumberOfUnitsTypeFromStructure(structureForm) {
    switch (structureForm) {
      case "SingleFamilyDetached":
      case "SingleFamilySemiDetached":
      case "TownhouseRowhouse":
      case "ManufacturedHomeOnLand":
      case "ManufacturedHomeInPark":
      case "ManufacturedHousing":
      case "ManufacturedHousingMultiWide":
      case "ManufacturedHousingSingleWide":
      case "MobileHome":
      case "Modular":
      case "ApartmentUnit":
      case "Loft":
        return "One";
      case "Duplex":
        return "Two";
      case "Triplex":
        return "Three";
      case "Quadplex":
        return "Four";
      case "MultiFamilyLessThan10":
        return "OneToFour";
      default:
        return null;
    }
  }

  const {
    property_type: property_type_mapped,
    property_usage_type: property_usage_type_mapped,
    structure_form: structure_form_mapped,
    build_status: build_status_mapped,
    ownership_estate_type: ownership_estate_type_mapped,
    number_of_units_type: number_of_units_type_from_map,
  } = propertyUseAttributes;

  const number_of_units_type_mapped =
    number_of_units_type_from_map ??
    getNumberOfUnitsTypeFromStructure(structure_form_mapped);

  const prop = {
    source_http_request: {
      method: "GET",
      url: propertySeed?.source_http_request?.url || "https://columbia.floridapa.com/gis"
    },
    request_identifier: hyphenParcel,
    livable_floor_area: livable ? String(livable) : null,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: legal || null,
    property_structure_built_year: effYear || null,
    property_effective_built_year: effYear || null,
    ownership_estate_type: ownership_estate_type_mapped ?? null,
    build_status: build_status_mapped ?? null,
    property_usage_type: property_usage_type_mapped ?? null,
    structure_form: structure_form_mapped ?? null,
    property_type: property_type_mapped ?? null,
    area_under_air: livable ? String(livable) : null,
    historic_designation: false,
    number_of_units: null, // This is an integer, not the enum type
    number_of_units_type: number_of_units_type_mapped, // Added this required field
    subdivision: null,
    total_area: totalAreaSqft,
    zoning: null,
  };
  writeJson(path.join("data", "property.json"), prop);

  const normalizeHttpRequest = (req, fallbackUrl) => {
    const out = req ? JSON.parse(JSON.stringify(req)) : {};
    out.url = out.url || fallbackUrl;
    out.method = out.method || "GET";
    if (
      out.multiValueQueryString == null ||
      typeof out.multiValueQueryString !== "object"
    ) {
      out.multiValueQueryString = {};
    }
    return out;
  };

  const defaultUrl = "https://columbia.floridapa.com/gis";
  const sourceHttpNormalized = normalizeHttpRequest(
    propertySeed?.source_http_request || cloneSourceHttp(),
    defaultUrl,
  );
  const entryHttpNormalized = normalizeHttpRequest(
    propertySeed?.entry_http_request || propertySeed?.source_http_request,
    sourceHttpNormalized.url,
  );
  const sourceHttpForParcel = {
    url: sourceHttpNormalized.url,
    method: sourceHttpNormalized.method,
    multiValueQueryString: sourceHttpNormalized.multiValueQueryString,
  };
  const entryHttpForParcel = {
    url: entryHttpNormalized.url,
    method: entryHttpNormalized.method,
    multiValueQueryString: entryHttpNormalized.multiValueQueryString,
  };

  writeJson(path.join("data", "parcel.json"), {
    source_http_request: sourceHttpForParcel,
    request_identifier: hyphenParcel,
    parcel_identifier: parcelIdentifier,
    entry_http_request: entryHttpForParcel,
  });

  // 5) LAYOUTS, UTILITIES, AND STRUCTURES
  (function processLayoutStructureUtility() {
    const isLandProperty = property_type_mapped === "LandParcel";

    const toNumber = (val) => {
      if (val == null || val === "") return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const normalizeBoolean = (value) =>
      value === true ? true : value === false ? false : undefined;

    const LAYOUT_REQUIRED_DEFAULTS = {
      space_type: null,
      space_type_index: null,
      size_square_feet: null,
      total_area_sq_ft: null,
      livable_area_sq_ft: null,
      area_under_air_sq_ft: null,
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
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
    };

    const STRUCTURE_REQUIRED_DEFAULTS = {
      architectural_style_type: null,
      attachment_type: null,
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
      // number_of_buildings: null,
      number_of_stories: null,
      finished_base_area: null,
      finished_upper_story_area: null,
      finished_basement_area: null,
      unfinished_basement_area: null,
      unfinished_base_area: null,
      unfinished_upper_story_area: null,
      roof_date: null,
    };

    const STRUCTURE_ALLOWED_KEYS = new Set([
      ...Object.keys(STRUCTURE_REQUIRED_DEFAULTS),
      "roof_age_years",
      "gutters_material",
      "gutters_condition",
      "foundation_waterproofing",
      "finished_basement_area",
      "unfinished_basement_area",
      "unfinished_base_area",
      "unfinished_upper_story_area",
      "request_identifier",
    ]);

    const UTILITY_REQUIRED_DEFAULTS = {
      cooling_system_type: null,
      heating_system_type: null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      plumbing_fixture_count: null,
      plumbing_fixture_quality: null,
      plumbing_fixture_type_primary: null,
      plumbing_system_installation_date: null,
      electrical_panel_capacity: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      heating_fuel_type: null,
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
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
    };

    const UTILITY_ALLOWED_KEYS = new Set([
      ...Object.keys(UTILITY_REQUIRED_DEFAULTS),
      "request_identifier",
    ]);

    const hasNonDefaultValues = (payload, defaults) =>
      Object.keys(defaults).some((key) => {
        const value = payload[key];
        const defaultValue = defaults[key];
        if (value === undefined) return false;
        if (value === defaultValue) return false;
        if (value === null && defaultValue === null) return false;
        if (
          typeof value === "string" &&
          value.trim() === "" &&
          (defaultValue === null || defaultValue === "")
        )
          return false;
        if (
          Array.isArray(value) &&
          value.length === 0 &&
          (defaultValue == null ||
            (Array.isArray(defaultValue) && defaultValue.length === 0))
        )
          return false;
        return true;
      });

    const LAYOUT_ALLOWED_KEYS = new Set([
      ...Object.keys(LAYOUT_REQUIRED_DEFAULTS),
      "building_number",
      "floor_level",
      "floor_number",
    ]);

    const sanitizeLayoutPayload = (partial) => {
      const payload = { ...LAYOUT_REQUIRED_DEFAULTS };
      if (partial && typeof partial === "object") {
        Object.entries(partial).forEach(([key, value]) => {
          if (LAYOUT_ALLOWED_KEYS.has(key)) payload[key] = value;
        });
      }
      if (payload.space_type == null) payload.space_type = null;
      if (payload.space_type_index == null) payload.space_type_index = "0";
      else payload.space_type_index = String(payload.space_type_index);
      if (payload.has_windows !== null && payload.has_windows !== undefined) {
        payload.has_windows =
          payload.has_windows === null ? null : Boolean(payload.has_windows);
      } else {
        payload.has_windows = null;
      }
      payload.is_finished =
        payload.is_finished === undefined || payload.is_finished === null
          ? false
          : Boolean(payload.is_finished);
      payload.is_exterior =
        payload.is_exterior === undefined || payload.is_exterior === null
          ? false
          : Boolean(payload.is_exterior);
      return payload;
    };

    const sanitizeStructurePayload = (partial) => ({
      ...STRUCTURE_REQUIRED_DEFAULTS,
      ...(partial && typeof partial === "object"
        ? Object.entries(partial).reduce((acc, [key, value]) => {
            if (STRUCTURE_ALLOWED_KEYS.has(key)) acc[key] = value;
            return acc;
          }, {})
        : {}),
    });

    const sanitizeUtilityPayload = (partial) => ({
      ...UTILITY_REQUIRED_DEFAULTS,
      ...(partial && typeof partial === "object"
        ? Object.entries(partial).reduce((acc, [key, value]) => {
            if (UTILITY_ALLOWED_KEYS.has(key)) acc[key] = value;
            return acc;
          }, {})
        : {}),
    });

    removeFiles("data", (file) =>
      /^layout_\d+\.json$/i.test(file) ||
      /^relationship_layout_.*\.json$/i.test(file) ||
      /^structure_\d+\.json$/i.test(file) ||
      /^relationship_.*structure.*\.json$/i.test(file) ||
      /^utility_\d+\.json$/i.test(file) ||
      /^relationship_.*utility.*\.json$/i.test(file),
    );

    const preparedBuildings = (() => {
      if (!layoutScope && isLandProperty) return [];
      let buildingsArray = [];
      if (layoutScope && Array.isArray(layoutScope.buildings)) {
        buildingsArray = layoutScope.buildings.slice();
      }
      const fallbackArea =
        toNumber(totalAreaSqft) ??
        toNumber(livable);
      if (!buildingsArray.length && !isLandProperty) {
        buildingsArray = [
          {
            building_number: 1,
            total_area_sq_ft: fallbackArea,
            livable_area_sq_ft: fallbackArea,
            area_under_air_sq_ft: fallbackArea,
            floors: [],
            rooms: [],
          },
        ];
      }
      return buildingsArray.map((building, idx) => {
        const clone = { ...building };
        clone.building_number = clone.building_number || idx + 1;
        clone.total_area_sq_ft =
          toNumber(clone.total_area_sq_ft) ??
          toNumber(clone.total_area) ??
          fallbackArea;
        clone.livable_area_sq_ft =
          toNumber(clone.livable_area_sq_ft) ??
          clone.total_area_sq_ft;
        clone.area_under_air_sq_ft =
          toNumber(clone.area_under_air_sq_ft) ??
          clone.livable_area_sq_ft;

        const floors = Array.isArray(clone.floors) ? clone.floors : [];
        const rooms = Array.isArray(clone.rooms) ? clone.rooms : [];

        clone.floors = floors.map((floor, floorIdx) => {
          const floorClone = { ...floor };
          floorClone.floor_number =
            floorClone.floor_number != null
              ? floorClone.floor_number
              : floorIdx + 1;
          floorClone.rooms = Array.isArray(floor.rooms)
            ? floor.rooms.map((room) => ({
                ...room,
                size_square_feet: toNumber(room.size_square_feet),
                is_finished: normalizeBoolean(room.is_finished),
                is_exterior: normalizeBoolean(room.is_exterior),
              }))
            : [];
          return floorClone;
        });

        clone.rooms = rooms.map((room) => ({
          ...room,
          size_square_feet: toNumber(room.size_square_feet),
          is_finished: normalizeBoolean(room.is_finished),
          is_exterior: normalizeBoolean(room.is_exterior),
        }));

        return clone;
      });
    })();

    const normalizePrimaryEntries = (scope, primaryKey) => {
      if (!scope) return [];
      if (Array.isArray(scope)) return scope.filter(Boolean);
      if (primaryKey && Array.isArray(scope[primaryKey])) {
        return scope[primaryKey].filter(Boolean);
      }
      if (primaryKey && scope[primaryKey]) {
        return [scope[primaryKey]];
      }
      if (
        typeof scope === "object" &&
        scope != null &&
        Object.keys(scope).length &&
        !primaryKey
      ) {
        return [scope];
      }
      return [];
    };

    const utilitiesArr = normalizePrimaryEntries(
      utilitiesScope,
      "utilities",
    ).map((util) => ({ ...util }));
    const extraUtilitiesArr = normalizePrimaryEntries(
      utilitiesScope,
      "extra_utilities",
    ).map((util) => ({ ...util }));

    const structuresArr = normalizePrimaryEntries(
      structureScope,
      "structures",
    ).map((struct) => ({ ...struct }));
    const extraStructuresArr = normalizePrimaryEntries(
      structureScope,
      "extra_structures",
    ).map((struct) => ({ ...struct }));
    const siteFeaturesArr = normalizePrimaryEntries(
      layoutScope,
      "site_features",
    ).map((feature) => ({ ...feature }));

    const layoutRecords = [];
    const buildingLayoutRecords = [];
    let layoutCounter = 0;

    const addLayout = (data, parentIndex) => {
      layoutCounter += 1;
      const fileName = `layout_${layoutCounter}.json`;
      const sanitized = sanitizeLayoutPayload(data);
      const payload = {
        ...sanitized,
        request_identifier: hyphenParcel,
        source_http_request: cloneSourceHttp(),
      };
      writeJson(path.join("data", fileName), payload);
      layoutRecords.push({ index: layoutCounter, parentIndex });
      return layoutCounter;
    };

    if (preparedBuildings.length) {
      preparedBuildings.forEach((building, buildingIdx) => {
        const buildingOrder = buildingIdx + 1;
        const buildingSpaceIndex = String(buildingOrder);
        const buildingLayoutIndex = addLayout(
          {
            space_type: "Building",
            space_type_index: buildingSpaceIndex,
            total_area_sq_ft: building.total_area_sq_ft ?? null,
            livable_area_sq_ft: building.livable_area_sq_ft ?? null,
            area_under_air_sq_ft: building.area_under_air_sq_ft ?? null,
            size_square_feet: building.total_area_sq_ft ?? null,
            building_number: building.building_number ?? buildingOrder,
          },
          null,
        );
        buildingLayoutRecords.push({
          index: buildingLayoutIndex,
          building_order: buildingOrder,
          space_type_index: buildingSpaceIndex,
        });

        const floors = Array.isArray(building.floors)
          ? building.floors
          : [];
        const rooms = Array.isArray(building.rooms) ? building.rooms : [];

        floors.forEach((floor, floorIdx) => {
          const floorOrder = floorIdx + 1;
          const floorSpaceIndex = `${buildingSpaceIndex}.${floorOrder}`;
          const floorLayoutIndex = addLayout(
            {
              space_type: floor.space_type || "Floor",
              space_type_index: floorSpaceIndex,
              size_square_feet: toNumber(floor.size_square_feet),
              floor_level:
                floor.floor_level != null ? floor.floor_level : null,
              floor_number:
                floor.floor_number != null
                  ? floor.floor_number
                  : floorOrder,
            },
            buildingLayoutIndex,
          );

          const floorRooms = Array.isArray(floor.rooms)
            ? floor.rooms
            : [];
          floorRooms.forEach((room, roomIdx) => {
            const roomOrder = roomIdx + 1;
            const roomSpaceIndex = `${floorSpaceIndex}.${roomOrder}`;
            addLayout(
              {
                space_type: room.space_type ?? null,
                space_type_index: roomSpaceIndex,
                size_square_feet: toNumber(room.size_square_feet),
                is_finished: normalizeBoolean(room.is_finished),
                is_exterior: normalizeBoolean(room.is_exterior),
              },
              floorLayoutIndex,
            );
          });
        });

        if (!floors.length) {
          rooms.forEach((room, roomIdx) => {
            const roomOrder = roomIdx + 1;
            const roomSpaceIndex = `${buildingSpaceIndex}.${roomOrder}`;
            addLayout(
              {
                space_type: room.space_type ?? null,
                space_type_index: roomSpaceIndex,
                size_square_feet: toNumber(room.size_square_feet),
                is_finished: normalizeBoolean(room.is_finished),
                is_exterior: normalizeBoolean(room.is_exterior),
              },
              buildingLayoutIndex,
            );
          });
        }
      });
    }

    // Create property-to-layout relationships for all building layouts
    buildingLayoutRecords.forEach((buildingRecord) => {
      const relName = `relationship_property_has_layout_${buildingRecord.index}.json`;
      writeJson(path.join("data", relName), {
        from: { "/": "./property.json" },
        to: { "/": `./layout_${buildingRecord.index}.json` },
      });
    });

    if (siteFeaturesArr.length) {
      siteFeaturesArr.forEach((feature, featureIdx) => {
        const sizeSqFt =
          toNumber(feature.size_square_feet) ??
          toNumber(feature.total_area_sq_ft);
        const payload = {
          space_type: feature.space_type || "Courtyard",
          space_type_index:
            feature.space_type_index != null
              ? String(feature.space_type_index)
              : String(featureIdx + 1),
          size_square_feet: sizeSqFt,
          total_area_sq_ft:
            toNumber(feature.total_area_sq_ft) ?? sizeSqFt,
          livable_area_sq_ft:
            toNumber(feature.livable_area_sq_ft) ?? null,
          area_under_air_sq_ft:
            toNumber(feature.area_under_air_sq_ft) ?? null,
          is_exterior:
            feature.is_exterior === undefined ||
            feature.is_exterior === null
              ? true
              : Boolean(feature.is_exterior),
          condition_issues:
            feature.condition_issues && String(feature.condition_issues).trim()
              ? String(feature.condition_issues).trim()
              : null,
        };
        addLayout(payload, null);
      });
    }

    const createLayoutToLayoutRelationship = (parentIdx, childIdx) => {
      const relName = `relationship_layout_${parentIdx}_has_layout_${childIdx}.json`;
      writeJson(path.join("data", relName), {
        from: { "/": `./layout_${parentIdx}.json` },
        to: { "/": `./layout_${childIdx}.json` },
      });
    };

    const singleBuildingLayoutIndex =
      buildingLayoutRecords.length === 1
        ? buildingLayoutRecords[0].index
        : null;

    layoutRecords.forEach(({ index, parentIndex }) => {
      const effectiveParent =
        parentIndex != null
          ? parentIndex
          : singleBuildingLayoutIndex && index !== singleBuildingLayoutIndex
            ? singleBuildingLayoutIndex
            : null;
      if (effectiveParent == null) return;
      createLayoutToLayoutRelationship(effectiveParent, index);
    });

    let utilityCounter = 0;
    const utilityRecords = [];
    const propertyUtilityRecords = [];

    const addUtility = (utility, assignToProperty = false) => {
      const sanitized = sanitizeUtilityPayload(utility);
      if (!hasNonDefaultValues(sanitized, UTILITY_REQUIRED_DEFAULTS)) return null;
      utilityCounter += 1;
      const fileName = `utility_${utilityCounter}.json`;
      const payload = {
        ...sanitized,
        request_identifier: hyphenParcel,
        source_http_request: cloneSourceHttp(),
      };
      writeJson(path.join("data", fileName), payload);
      const record = {
        index: utilityCounter,
        relPath: `./${fileName}`,
      };
      if (assignToProperty) propertyUtilityRecords.push(record);
      else utilityRecords.push(record);
      return record;
    };

    utilitiesArr.forEach((utility) => addUtility(utility, false));
    extraUtilitiesArr.forEach((utility) => addUtility(utility, true));

    let structureCounter = 0;
    const structureRecords = [];
    const propertyStructureRecords = [];

    const addStructure = (structure, assignToProperty = false) => {
      const sanitized = sanitizeStructurePayload(structure);
      if (!hasNonDefaultValues(sanitized, STRUCTURE_REQUIRED_DEFAULTS))
        return null;
      structureCounter += 1;
      const fileName = `structure_${structureCounter}.json`;
      const payload = {
        ...sanitized,
        request_identifier: hyphenParcel,
        source_http_request: cloneSourceHttp(),
      };
      writeJson(path.join("data", fileName), payload);
      const record = {
        index: structureCounter,
        relPath: `./${fileName}`,
      };
      if (assignToProperty) propertyStructureRecords.push(record);
      else structureRecords.push(record);
      return record;
    };

    // Do not create structure entities when they only contain area measurements
    // Area data is already captured in layout entities
    // structuresArr.forEach((structure) => addStructure(structure, false));
    // Create structure entities for extra features (carports, barns, etc.) and link them via relationships
    extraStructuresArr.forEach((structure) => addStructure(structure, true));

    const createLayoutToUtilityRelationship = (layoutIdx, utilityIdx) => {
      const relName = `relationship_layout_${layoutIdx}_has_utility_${utilityIdx}.json`;
      writeJson(path.join("data", relName), {
        from: { "/": `./layout_${layoutIdx}.json` },
        to: { "/": `./utility_${utilityIdx}.json` },
      });
    };

    const createLayoutToStructureRelationship = (layoutIdx, structureIdx) => {
      const relName = `relationship_layout_${layoutIdx}_has_structure_${structureIdx}.json`;
      writeJson(path.join("data", relName), {
        from: { "/": `./layout_${layoutIdx}.json` },
        to: { "/": `./structure_${structureIdx}.json` },
      });
    };

    const createPropertyRelationship = (type, idx) => {
      const relName = `relationship_property_has_${type}_${idx}.json`;
      writeJson(path.join("data", relName), {
        from: { "/": "./property.json" },
        to: { "/": `./${type}_${idx}.json` },
      });
    };

    const assignUtilities = () => {
      if (utilityRecords.length) {
        if (!buildingLayoutRecords.length) {
          // Create a default building layout for utilities if none exist
          // Utilities must be connected to layouts, not directly to property
          const defaultLayoutIndex = addLayout(
            {
              space_type: "Building",
              space_type_index: "1",
              total_area_sq_ft: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
              livable_area_sq_ft: toNumber(livable) ?? null,
              area_under_air_sq_ft: toNumber(livable) ?? null,
              size_square_feet: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
              building_number: 1,
            },
            null,
          );
          buildingLayoutRecords.push({
            index: defaultLayoutIndex,
            building_order: 1,
            space_type_index: "1",
          });
          // Create property to layout relationship
          const relName = `relationship_property_has_layout_${defaultLayoutIndex}.json`;
          writeJson(path.join("data", relName), {
            from: { "/": "./property.json" },
            to: { "/": `./layout_${defaultLayoutIndex}.json` },
          });
          // Connect utilities to the default layout
          utilityRecords.forEach((record) =>
            createLayoutToUtilityRelationship(defaultLayoutIndex, record.index),
          );
        } else if (buildingLayoutRecords.length === 1) {
          const layoutIdx = buildingLayoutRecords[0].index;
          utilityRecords.forEach((record) =>
            createLayoutToUtilityRelationship(layoutIdx, record.index),
          );
        } else {
          if (utilityRecords.length === 1) {
            const layoutIdx = buildingLayoutRecords[0].index;
            createLayoutToUtilityRelationship(layoutIdx, utilityRecords[0].index);
          } else {
            const assignCount = Math.min(
              buildingLayoutRecords.length,
              utilityRecords.length,
            );
            for (let i = 0; i < assignCount; i += 1) {
              createLayoutToUtilityRelationship(
                buildingLayoutRecords[i].index,
                utilityRecords[i].index,
              );
            }
            for (let i = assignCount; i < utilityRecords.length; i += 1) {
              const layoutIdx = buildingLayoutRecords[buildingLayoutRecords.length - 1].index;
              createLayoutToUtilityRelationship(layoutIdx, utilityRecords[i].index);
            }
          }
        }
      }
      // Handle propertyUtilityRecords - ensure they have a layout to connect to
      if (propertyUtilityRecords.length) {
        // If no building layouts exist, create a default one for propertyUtilityRecords
        if (!buildingLayoutRecords.length && !singleBuildingLayoutIndex) {
          const defaultLayoutIndex = addLayout(
            {
              space_type: "Building",
              space_type_index: "1",
              total_area_sq_ft: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
              livable_area_sq_ft: toNumber(livable) ?? null,
              area_under_air_sq_ft: toNumber(livable) ?? null,
              size_square_feet: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
              building_number: 1,
            },
            null,
          );
          buildingLayoutRecords.push({
            index: defaultLayoutIndex,
            building_order: 1,
            space_type_index: "1",
          });
          // Create property to layout relationship
          const relName = `relationship_property_has_layout_${defaultLayoutIndex}.json`;
          writeJson(path.join("data", relName), {
            from: { "/": "./property.json" },
            to: { "/": `./layout_${defaultLayoutIndex}.json` },
          });
        }

        propertyUtilityRecords.forEach((record) => {
          if (singleBuildingLayoutIndex) {
            createLayoutToUtilityRelationship(
              singleBuildingLayoutIndex,
              record.index,
            );
          } else if (buildingLayoutRecords.length) {
            const layoutIdx = buildingLayoutRecords[0].index;
            createLayoutToUtilityRelationship(layoutIdx, record.index);
          }
        });
      }
    };

    const assignStructures = () => {
      if (!structureRecords.length) {
        propertyStructureRecords.forEach((record) => {
          if (singleBuildingLayoutIndex) {
            createLayoutToStructureRelationship(
              singleBuildingLayoutIndex,
              record.index,
            );
          } else if (buildingLayoutRecords.length) {
            const layoutIdx = buildingLayoutRecords[0].index;
            createLayoutToStructureRelationship(layoutIdx, record.index);
          }
        });
        return;
      }
      if (!buildingLayoutRecords.length) {
        // Create a default building layout for structures if none exist
        // Structures must be connected to layouts, not directly to property
        const defaultLayoutIndex = addLayout(
          {
            space_type: "Building",
            space_type_index: "1",
            total_area_sq_ft: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
            livable_area_sq_ft: toNumber(livable) ?? null,
            area_under_air_sq_ft: toNumber(livable) ?? null,
            size_square_feet: toNumber(totalAreaSqft) ?? toNumber(livable) ?? null,
            building_number: 1,
          },
          null,
        );
        buildingLayoutRecords.push({
          index: defaultLayoutIndex,
          building_order: 1,
          space_type_index: "1",
        });
        // Create property to layout relationship
        const relName = `relationship_property_has_layout_${defaultLayoutIndex}.json`;
        writeJson(path.join("data", relName), {
          from: { "/": "./property.json" },
          to: { "/": `./layout_${defaultLayoutIndex}.json` },
        });
        // Connect structures to the default layout
        structureRecords.forEach((record) =>
          createLayoutToStructureRelationship(defaultLayoutIndex, record.index),
        );
      } else if (buildingLayoutRecords.length === 1) {
        const layoutIdx = buildingLayoutRecords[0].index;
        structureRecords.forEach((record) =>
          createLayoutToStructureRelationship(layoutIdx, record.index),
        );
      } else {
        if (structureRecords.length === 1) {
          const layoutIdx = buildingLayoutRecords[0].index;
          createLayoutToStructureRelationship(layoutIdx, structureRecords[0].index);
        } else {
          const assignCount = Math.min(
            buildingLayoutRecords.length,
            structureRecords.length,
          );
          for (let i = 0; i < assignCount; i += 1) {
            createLayoutToStructureRelationship(
              buildingLayoutRecords[i].index,
              structureRecords[i].index,
            );
          }
          for (let i = assignCount; i < structureRecords.length; i += 1) {
            const layoutIdx = buildingLayoutRecords[buildingLayoutRecords.length - 1].index;
            createLayoutToStructureRelationship(layoutIdx, structureRecords[i].index);
          }
        }
      }
      propertyStructureRecords.forEach((record) => {
        if (singleBuildingLayoutIndex) {
          createLayoutToStructureRelationship(
            singleBuildingLayoutIndex,
            record.index,
          );
        } else if (buildingLayoutRecords.length) {
          const layoutIdx = buildingLayoutRecords[0].index;
          createLayoutToStructureRelationship(layoutIdx, record.index);
        }
      });
    };

    assignUtilities();
    assignStructures();
  })();


  // 6) LOT
  try {
    // Updated selector for land table
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable",
    ).eq(1); // Assuming the first data row in Land Breakdown
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 6) {
      const unitsTxt = tds.eq(2).text(); // e.g., "1.070 AC"
      const mSf = unitsTxt.match(/([0-9,.]+)\s*SF/i);
      const mAc = unitsTxt.match(/([0-9,.]+)\s*AC/i); // Changed regex to directly capture AC value
      if (mSf) lotAreaSqft = Math.round(parseFloat(mSf[1].replace(/[,]/g, "")));
      if (mAc) lotSizeAcre = parseFloat(mAc[1].replace(/[,]/g, ""));
    }
    let lot_type = null;
    if (typeof lotSizeAcre === "number")
      lot_type =
        lotSizeAcre > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
    writeJson(path.join("data", "lot.json"), {
      lot_type: lot_type || null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_area_sqft: lotAreaSqft || null,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null,
      lot_size_acre: lotSizeAcre || null,
    });
  } catch (e) {
    console.error("Error processing lot data:", e);
  }

  // 7) ADDRESS
  try {
    if (unnormalizedAddress && unnormalizedAddress.full_address) {
      const full = unnormalizedAddress.full_address.trim();
      let section = null,
        township = null,
        range = null;
      // Updated selector for S/T/R
      const strTxt = $('td:contains("S/T/R")')
        .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
        .first()
        .next()
        .text()
        .trim(); // "10-5S-16"
      if (strTxt && /\d{1,2}-\d{1,2}[A-Z]?-\d{1,2}/.test(strTxt)) { // Updated regex for "10-5S-16" or "10-5-16"
        const parts2 = strTxt.split("-");
        section = parts2[0];
        township = parts2[1]; // e.g., "5S"
        range = parts2[2]; // e.g., "16"
      }

      const sourceHttp =
        (propertySeed && propertySeed.source_http_request
          ? JSON.parse(JSON.stringify(propertySeed.source_http_request))
          : null) ||
        (unnormalizedAddress && unnormalizedAddress.source_http_request
          ? JSON.parse(JSON.stringify(unnormalizedAddress.source_http_request))
          : null) || {
          method: "GET",
          url: "https://columbia.floridapa.com/gis",
        };

      const requestIdentifier =
        hyphenParcel ||
        (propertySeed && propertySeed.parcel_id) ||
        (unnormalizedAddress ? unnormalizedAddress.request_identifier : null) ||
        null;

      writeJson(path.join("data", "address.json"), {
        unit_identifier: null,
        city_name: null,
        state_code: null,
        postal_code: null,
        plus_four_postal_code: null,
        county_name: "Columbia",
        country_code: "US",
        route_number: null,
        township: township || null,
        range: range || null,
        section: section || null,
        lot: null,
        block: null,
        municipality_name: null,
        unnormalized_address: full || null,
        source_http_request: sourceHttp,
        request_identifier: requestIdentifier,
      });

      const latitude =
        typeof unnormalizedAddress.latitude === "number"
          ? unnormalizedAddress.latitude
          : null;
      const longitude =
        typeof unnormalizedAddress.longitude === "number"
          ? unnormalizedAddress.longitude
          : null;

      if (latitude !== null && longitude !== null) {
        writeJson(path.join("data", "geometry.json"), {
          latitude,
          longitude,
          source_http_request: sourceHttp,
          request_identifier: requestIdentifier,
        });
        writeJson(
          path.join("data", "relationship_address_geometry.json"),
          {
            from: { "/": "./address.json" },
            to: { "/": "./geometry.json" },
          },
        );
      }
    }
  } catch (e) {
    console.error("Error processing address data:", e);
  }
}

main();
