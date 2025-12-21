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

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function writeRelationship(fileName, fromPath, toPath) {
  writeJson(path.join("data", fileName), {
    from: { "/": fromPath },
    to: { "/": toPath },
  });
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

function parseNumberFromText(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function toNullableNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  return parseNumberFromText(value);
}

function hasMeaningfulValue(obj) {
  if (obj == null) return false;
  if (Array.isArray(obj)) {
    return obj.some((item) => hasMeaningfulValue(item));
  }
  if (typeof obj === "object") {
    return Object.entries(obj).some(([key, value]) => {
      if (key === "source_http_request" || key === "request_identifier") return false;
      return hasMeaningfulValue(value);
    });
  }
  if (typeof obj === "string") return obj.trim() !== "";
  if (typeof obj === "number") return !Number.isNaN(obj);
  if (typeof obj === "boolean") return true;
  return false;
}

const DEFAULT_LAYOUT_SPACE_TYPE = "Building";

function mapLayoutSpaceType(description) {
  if (!description) return DEFAULT_LAYOUT_SPACE_TYPE;
  const upper = description.toUpperCase().replace(/[.\-]/g, " ");
  const normalized = upper.replace(/\s+/g, " ").trim();
  const contains = (token) => normalized.includes(token);
  const equalsAny = (...values) =>
    values.some((val) => normalized === val || normalized === val.replace(/\s+/g, " "));

  if (equalsAny("LR", "LIV", "LIV RM", "LIVING RM", "LIVING ROOM", "LIVINGROOM"))
    return "Living Room";
  if (equalsAny("FR", "FAM RM", "FAMILY RM", "FAMILY ROOM", "FAMILYROOM"))
    return "Family Room";
  if (equalsAny("GR", "GREAT RM", "GREAT ROOM")) return "Great Room";
  if (equalsAny("DR", "DIN RM", "DINING RM", "DINING ROOM")) return "Dining Room";
  if (equalsAny("K", "KIT", "KIT RM", "KITCHEN", "KITCHEN ROOM")) return "Kitchen";
  if (equalsAny("BR", "BDRM", "BED RM", "BEDROOM", "BED ROOM")) return "Bedroom";
  if (equalsAny("MBR", "MASTER BR", "PRIMARY BR", "PRIMARY BEDROOM")) return "Primary Bedroom";
  if (equalsAny("SBR", "SEC BR", "SECONDARY BR", "SECONDARY BEDROOM"))
    return "Secondary Bedroom";
  if (equalsAny("PR", "PDR", "POWDER RM", "HALF BATH", "HALF BATHROOM"))
    return "Half Bathroom / Powder Room";
  if (equalsAny("BA", "BATH", "BATH RM", "FULL BATH", "FULL BATHROOM"))
    return "Full Bathroom";
  if (contains("PRIMARY") && contains("BED")) return "Primary Bedroom";
  if ((contains("GUEST") || contains("SECONDARY") || contains("SEC")) && contains("BED"))
    return "Secondary Bedroom";
  if (contains("BED")) return "Bedroom";
  if (contains("EN SUITE") && contains("BATH")) return "En-Suite Bathroom";
  if (contains("BATH")) {
    if (contains("HALF")) return "Half Bathroom / Powder Room";
    return "Full Bathroom";
  }
  if (contains("KITCH")) return "Kitchen";
  if (contains("DINING")) return "Dining Room";
  if (contains("LIVING")) return "Living Room";
  if (contains("FAMILY")) return "Family Room";
  if (contains("OFFICE")) return "Office Room";
  if (contains("LIBRARY")) return "Library";
  if (contains("STUDY") || contains("DEN")) return "Den";
  if (contains("MEDIA") || contains("THEATER")) return "Media Room / Home Theater";
  if (contains("GAME")) return "Game Room";
  if (contains("GYM")) return "Home Gym";
  if (contains("MUSIC")) return "Music Room";
  if (contains("CRAFT") || contains("HOBBY")) return "Craft Room / Hobby Room";
  if (contains("PRAYER") || contains("MEDITATION")) return "Prayer Room / Meditation Room";
  if (contains("SAFE") || contains("PANIC")) return "Safe Room / Panic Room";
  if (contains("WINE")) return "Wine Cellar";
  if (contains("BAR") && contains("AREA")) return "Bar Area";
  if (contains("GREENHOUSE")) return "Greenhouse";
  if (contains("PORCH") && contains("SCREEN")) return "Screened Porch";
  if (contains("PORCH")) return "Open Porch";
  if (contains("SUNROOM") || contains("SUN ROOM")) return "Sunroom";
  if (contains("DECK")) return "Deck";
  if (contains("PATIO")) return "Patio";
  if (contains("BALCONY")) return "Balcony";
  if (contains("TERRACE")) return "Terrace";
  if (contains("GAZEBO")) return "Gazebo";
  if (contains("POOL HOUSE")) return "Pool House";
  if (contains("OUTDOOR KITCHEN")) return "Outdoor Kitchen";
  if (contains("LOBBY")) return "Lobby / Entry Hall";
  if (contains("COMMON ROOM")) return "Common Room";
  if (contains("UTILITY") && contains("CLOSET")) return "Utility Closet";
  if (contains("UTILITY")) return "Utility Closet";
  if (contains("ELEVATOR") && contains("LOBBY")) return "Elevator Lobby";
  if (contains("MAIL ROOM")) return "Mail Room";
  if (contains("JANITOR")) return "Janitor’s Closet";
  if (contains("POOL AREA")) return "Pool Area";
  if (contains("INDOOR POOL")) return "Indoor Pool";
  if (contains("OUTDOOR POOL")) return "Outdoor Pool";
  if (contains("HOT TUB") || contains("SPA AREA")) return "Hot Tub / Spa Area";
  if (contains("SHED")) return "Shed";
  if (contains("LANAI")) return "Lanai";
  if (contains("CABANA")) return "Enclosed Cabana";
  if (contains("GARAGE")) {
    if (contains("DETACHED")) return "Detached Garage";
    if (contains("LOWER")) return "Lower Garage";
    return "Attached Garage";
  }
  if (contains("CARPORT")) {
    if (contains("DETACHED")) return "Detached Carport";
    if (contains("ATTACHED")) return "Attached Carport";
    return "Carport";
  }
  if (contains("WORKSHOP")) return "Workshop";
  if (contains("STORAGE") && contains("LOFT")) return "Storage Loft";
  if (contains("STORAGE")) return "Storage Room";
  if (contains("CLOSET") && contains("WALK")) return "Walk-in Closet";
  if (contains("CLOSET")) return "Closet";
  if (contains("MECHANICAL")) return "Mechanical Room";
  if (contains("LAUNDRY")) return "Laundry Room";
  if (contains("MUD")) return "Mudroom";
  if (contains("LOBBY") && contains("ENTRY")) return "Lobby / Entry Hall";
  if (contains("MAIL")) return "Mail Room";
  if (contains("JANITOR")) return "Janitor’s Closet";
  if (contains("POOL") && contains("AREA")) return "Pool Area";
  if (contains("ATTIC")) return "Attic";
  if (contains("BASEMENT")) return "Basement";
  if (contains("COURTYARD") && contains("OPEN")) return "Open Courtyard";
  if (contains("COURTYARD")) return "Courtyard";
  return DEFAULT_LAYOUT_SPACE_TYPE;
}

function raiseEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.split(' ').map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
}

function mapPrefixName(name) {
  const prefixes = {
    'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
    'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
    'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
    'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
    'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
  };
  return prefixes[name?.toUpperCase()] || null;
}

function mapSuffixName(name) {
  const suffixes = {
    'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
    'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
    'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
    'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
  };
  return suffixes[name?.toUpperCase()] || null;
}

function extractOwnerMailingAddress($) {
  const ownerLabelTd = $('td:contains("Owner")')
    .filter((_, el) => $(el).text().trim() === "Owner")
    .first();
  if (!ownerLabelTd.length) return null;
  const valueTd = ownerLabelTd.next("td").clone();
  valueTd.find("br").replaceWith("\n");
  const lines = valueTd
    .text()
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim().replace(/,+$/, ""))
    .filter(Boolean);
  if (!lines.length) return null;
  let startIndex = lines.findIndex((line) => /\d/.test(line) || /\bP\.?O\.?\s*BOX\b/i.test(line));
  if (startIndex === -1) {
    if (lines.length > 1) startIndex = 1;
    else return null;
  }
  const addressParts = lines.slice(startIndex);
  if (!addressParts.length) return null;
  if (
    addressParts.length >= 2 &&
    /\d/.test(addressParts[0]) &&
    !/,/.test(addressParts[0]) &&
    !/\d/.test(addressParts[1])
  ) {
    addressParts[0] = `${addressParts[0]} ${addressParts[1]}`.replace(/\s+/g, " ").trim();
    addressParts.splice(1, 1);
  }
  return addressParts.map((part) => part.replace(/\s+/g, " ").trim()).join(", ");
}

const PROPERTY_TYPE_ENUM = new Set(["LandParcel", "Building", "Unit", "ManufacturedHome"]);
const BUILD_STATUS_ENUM = new Set(["VacantLand", "Improved", "UnderConstruction"]);
const STRUCTURE_FORM_ENUM = new Set([
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
]);
const OWNERSHIP_ESTATE_ENUM = new Set([
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
]);
const PROPERTY_USAGE_TYPE_ENUM = new Set([
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
]);

const PROPERTY_USE_CODE_MAP = {
  "000000": {
    description: "VACANT",
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
  },
  "000100": {
    description: "SINGLE FAMILY",
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  },
  "000200": {
    description: "MOBILE HOME",
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    structure_form: "MobileHome",
  },
  "000300": {
    description: "MULTI-FAM",
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10",
  },
  "000400": {
    description: "CONDOMINIA",
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Condominium",
  },
  "000500": {
    description: "COOPERATIVES",
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Cooperative",
  },
  "000600": {
    description: "RETIREMENT HOMES",
    property_type: "Building",
    property_usage_type: "Retirement",
    structure_form: "MultiFamilyMoreThan10",
  },
  "000700": {
    description: "MISC IMPROVED",
    property_type: "Building",
    property_usage_type: "Residential",
  },
  "001000": {
    description: "VACANT COMMERCIAL",
    property_type: "LandParcel",
    property_usage_type: "Commercial",
    build_status: "VacantLand",
  },
  "001100": {
    description: "STORES/1 STORY",
    property_type: "Building",
    property_usage_type: "RetailStore",
  },
  "001126": {
    description: "CONV STORE/GAS",
    property_type: "Building",
    property_usage_type: "ServiceStation",
  },
  "001200": {
    description: "MXD RES/OFF/STO",
    property_type: "Building",
    property_usage_type: "Commercial",
  },
  "001300": {
    description: "DEPARTMNT STORE",
    property_type: "Building",
    property_usage_type: "DepartmentStore",
  },
  "001400": {
    description: "SUPERMARKET",
    property_type: "Building",
    property_usage_type: "Supermarket",
  },
  "001500": {
    description: "REGIONAL SHOPPING",
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
  },
  "001600": {
    description: "COMMUNITY SHOPPING",
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
  },
  "001700": {
    description: "OFFICE BLD 1STY",
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  },
  "001800": {
    description: "OFFCE BLD M/STY",
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  },
  "001900": {
    description: "PROFESS OFF/BLD",
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  },
  "002000": {
    description: "TRANSIT TERMINL",
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
  },
  "002100": {
    description: "RESTAURANT/CAFE",
    property_type: "Building",
    property_usage_type: "Restaurant",
  },
  "002200": {
    description: "DRIVE-IN REST.",
    property_type: "Building",
    property_usage_type: "Restaurant",
  },
  "002300": {
    description: "FINANCIAL BLDG",
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
  },
  "002400": {
    description: "INSURANCE COMP",
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
  },
  "002500": {
    description: "REPAIR SERVICE",
    property_type: "Building",
    property_usage_type: "Commercial",
  },
  "002525": {
    description: "BEAUTY PARLOR",
    property_type: "Building",
    property_usage_type: "Commercial",
  },
  "002600": {
    description: "SERVICE STATION",
    property_type: "Building",
    property_usage_type: "ServiceStation",
  },
  "002700": {
    description: "VEH SALE/REPAIR",
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
  },
  "002800": {
    description: "RV/MH PK ,PK/LOT",
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
    structure_form: "ManufacturedHomeInPark",
    build_status: "Improved",
  },
  "002900": {
    description: "WHOLESALE OUTLET",
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
  },
  "003000": {
    description: "FLORIST/GREENHOUSE",
    property_type: "Building",
    property_usage_type: "NurseryGreenhouse",
  },
  "003100": {
    description: "DRIVE-IN/OPEN STAD",
    property_type: "Building",
    property_usage_type: "Entertainment",
  },
  "003200": {
    description: "THEATER/AUDITORIUM",
    property_type: "Building",
    property_usage_type: "Theater",
  },
  "003300": {
    description: "NIGHTCLUB/BARS",
    property_type: "Building",
    property_usage_type: "Entertainment",
  },
  "003400": {
    description: "BOWL,RINKS,POOL",
    property_type: "Building",
    property_usage_type: "Entertainment",
  },
  "003500": {
    description: "TOURIST ATTRACTION",
    property_type: "Building",
    property_usage_type: "Entertainment",
  },
  "003600": {
    description: "CAMPS",
    property_type: "Building",
    property_usage_type: "Recreational",
  },
  "003700": {
    description: "RACE TRACKS,ALL",
    property_type: "Building",
    property_usage_type: "RaceTrack",
  },
  "003800": {
    description: "GOLF COURSES",
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
    build_status: "Improved",
  },
  "003900": {
    description: "HOTELS/MOTELS",
    property_type: "Building",
    property_usage_type: "Hotel",
  },
  "004000": {
    description: "VACANT INDUSTRIAL",
    property_type: "LandParcel",
    property_usage_type: "Industrial",
    build_status: "VacantLand",
  },
  "004100": {
    description: "LIGHT MANUFACTURE",
    property_type: "Building",
    property_usage_type: "LightManufacturing",
  },
  "004200": {
    description: "HEAVY INDUSTRL",
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
  },
  "004300": {
    description: "LUMBER YARD",
    property_type: "Building",
    property_usage_type: "LumberYard",
  },
  "004400": {
    description: "PACKING PLANTS",
    property_type: "Building",
    property_usage_type: "PackingPlant",
  },
  "004500": {
    description: "CANNERIES/BOTTLERS",
    property_type: "Building",
    property_usage_type: "Cannery",
  },
  "004600": {
    description: "OTHER FOOD PROCESS",
    property_type: "Building",
    property_usage_type: "AgriculturalPackingFacility",
  },
  "004700": {
    description: "MINERAL PROCESSING",
    property_type: "Building",
    property_usage_type: "MineralProcessing",
  },
  "004800": {
    description: "WAREHOSE/DISTRB",
    property_type: "Building",
    property_usage_type: "Warehouse",
  },
  "004900": {
    description: "OPEN STORAGE",
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    build_status: "Improved",
  },
  "005000": {
    description: "IMPROVED AG",
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    build_status: "Improved",
  },
  "005100": {
    description: "CROPLAND",
    property_type: "LandParcel",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
  },
  "005400": {
    description: "TIMBERLAND",
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
  },
  "005900": {
    description: "TIMBERLAND NON-CLASS",
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
  },
  "006000": {
    description: "PASTURELAND",
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
  },
  "006600": {
    description: "GROVES,ORCHRD",
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
    build_status: "VacantLand",
  },
  "006700": {
    description: "POULT,BEES,FISH, ETC",
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
  },
  "006800": {
    description: "DAIRIES,FEEDLOTS",
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
  },
  "006900": {
    description: "MISC AG",
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    build_status: "VacantLand",
  },
  "007000": {
    description: "VAC INSTITUTIONAL",
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
  },
  "007100": {
    description: "CHURCHES",
    property_type: "Building",
    property_usage_type: "Church",
  },
  "007200": {
    description: "PRVT SCHL/DAY CARE",
    property_type: "Building",
    property_usage_type: "PrivateSchool",
  },
  "007300": {
    description: "PRIVATE HOSPITALS",
    property_type: "Building",
    property_usage_type: "PrivateHospital",
  },
  "007400": {
    description: "HOMES FOR THE AGED",
    property_type: "Building",
    property_usage_type: "HomesForAged",
  },
  "007500": {
    description: "NON-PROFIT / ORPHANA",
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
  },
  "007600": {
    description: "MORTUARY/CEMETARY",
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
    build_status: "VacantLand",
  },
  "007700": {
    description: "CLUBS/LODGES/HALLS",
    property_type: "Building",
    property_usage_type: "ClubsLodges",
  },
  "007800": {
    description: "REST HOMES",
    property_type: "Building",
    property_usage_type: "SanitariumConvalescentHome",
  },
  "007900": {
    description: "CULTERAL GROUPS",
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
  },
  "008100": {
    description: "MILITARY",
    property_type: "Building",
    property_usage_type: "Military",
  },
  "008200": {
    description: "FOREST, PARKS, REC",
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "VacantLand",
  },
  "008300": {
    description: "PUBLIC SCHOOLS",
    property_type: "Building",
    property_usage_type: "PublicSchool",
  },
  "008400": {
    description: "COLLEGES",
    property_type: "Building",
    property_usage_type: "PublicSchool",
  },
  "008500": {
    description: "HOSPITALS",
    property_type: "Building",
    property_usage_type: "PublicHospital",
  },
  "008600": {
    description: "COUNTY",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "008628": {
    description: "COUNTY RV PARK",
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    build_status: "Improved",
  },
  "008700": {
    description: "STATE",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "008701": {
    description: "WATER MG DIST",
    property_type: "Building",
    property_usage_type: "Utility",
  },
  "008702": {
    description: "SPECIAL TAXING",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "008703": {
    description: "O U A",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "008704": {
    description: "TIITF%/SFWMD%",
    property_type: "LandParcel",
    property_usage_type: "Conservation",
    build_status: "VacantLand",
  },
  "008800": {
    description: "FEDERAL",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "008900": {
    description: "MUNICIPAL",
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
  },
  "009000": {
    description: "LEASEHOLD INTEREST",
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "Leasehold",
  },
  "009100": {
    description: "UTILITIES",
    property_type: "Building",
    property_usage_type: "Utility",
  },
  "009200": {
    description: "MINING",
    property_type: "LandParcel",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
  },
  "009300": {
    description: "SUBSURFACE RGHT",
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
  },
  "009400": {
    description: "RIGHTS-OF-WAY",
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
  },
  "009500": {
    description: "RIVERS AND LAKES",
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    build_status: "VacantLand",
  },
  "009600": {
    description: "WASTELAND/DUMPS",
    property_type: "LandParcel",
    property_usage_type: "SewageDisposal",
    build_status: "VacantLand",
  },
  "009700": {
    description: "REC AND PARK LAND",
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    build_status: "VacantLand",
  },
  "009800": {
    description: "CENTRALLY ASSED",
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    build_status: "VacantLand",
  },
  "009900": {
    description: "NON AG ACREAGE",
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
  },
};

function parsePropertyUseCode(raw) {
  if (!raw) return { code: null, description: null };
  const normalized = String(raw).replace(/\s+/g, " ").trim();
  let code = null;
  const match = normalized.match(/\b(\d{6})\b/);
  if (match) {
    code = match[1];
  } else {
    const shortMatch = normalized.match(/\b(\d{3,5})\b/);
    if (shortMatch) {
      code = shortMatch[1].padStart(6, "0");
    }
  }
  let description = null;
  if (code) {
    const descCandidate = normalized.replace(/\(.*?\)/g, "").trim();
    description = descCandidate || null;
  }
  return { code, description };
}

function getPropertyUseMapping(raw) {
  const { code, description } = parsePropertyUseCode(raw);
  if (!code) {
    throw {
      type: "error",
      message: `Unable to parse property use code from value: ${raw}`,
      path: "property.property_type",
    };
  }
  const mapping = PROPERTY_USE_CODE_MAP[code];
  if (!mapping) {
    const descSuffix = description ? ` (${description})` : "";
    throw {
      type: "error",
      message: `No mapping configured for property use code ${code}${descSuffix}.`,
      path: "property.property_type",
    };
  }
  return { code, description, mapping };
}

function assertEnumValue(value, allowedSet, pathStr) {
  if (value === undefined) {
    raiseEnumError(value, pathStr);
    throw {
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: pathStr,
    };
  }
  if (value === null) return;
  if (!allowedSet.has(value)) {
    raiseEnumError(value, pathStr);
    throw {
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: pathStr,
    };
  }
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

  const ownerMailingAddress = extractOwnerMailingAddress($);
  const ownerSourceHttpRequest = {
    method: propertySeed?.source_http_request?.method || "GET",
    url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis",
  };
  const defaultSourceHttpRequest = {
    method:
      propertySeed?.source_http_request?.method ||
      propertySeed?.entry_http_request?.method ||
      "GET",
    url:
      propertySeed?.source_http_request?.url ||
      propertySeed?.entry_http_request?.url ||
      "https://www.bradfordappraiser.com/gis",
  };

  // 1) OWNERS
  if (ownerData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const ownersScope = key && ownerData[key] ? ownerData[key] : null;
    if (
      ownersScope &&
      ownersScope.owners_by_date &&
      Array.isArray(ownersScope.owners_by_date.current)
    ) {
      const currentOwners = ownersScope.owners_by_date.current;
      let companyIndex = 0;
      let personIndex = 0;
      const companyFiles = [];
      const personFiles = [];
      const mailingAddressFilePath = path.join("data", "mailing_address.json");
      const mailingAddressRelPath = "./mailing_address.json";
      let mailingAddressWritten = false;
      for (const ow of currentOwners) {
        if (!mailingAddressWritten) {
          writeJson(mailingAddressFilePath, {
            unnormalized_address: ownerMailingAddress || null,
            latitude: null,
            longitude: null,
            source_http_request: ownerSourceHttpRequest,
            request_identifier: hyphenParcel,
          });
          mailingAddressWritten = true;
        }
        if (ow.type === "company") {
          companyIndex += 1;
          const company = { name: ow.name || null };
          writeJson(path.join("data", `company_${companyIndex}.json`), company);
          companyFiles.push(`./company_${companyIndex}.json`);
          writeRelationship(
            `relationship_company_${companyIndex}_has_mailing_address.json`,
            `./company_${companyIndex}.json`,
            mailingAddressRelPath,
          );
        } else if (ow.type === "person") {
          personIndex += 1;
          const person = {
            source_http_request: ownerSourceHttpRequest,
            request_identifier: hyphenParcel,
            birth_date: null,
            first_name: formatNameToPattern(ow.first_name),
            last_name: formatNameToPattern(ow.last_name),
            middle_name: ow.middle_name ? formatNameToPattern(ow.middle_name) : null,
            prefix_name: mapPrefixName(ow.prefix_name),
            suffix_name: mapSuffixName(ow.suffix_name),
            us_citizenship_status: null,
            veteran_status: null,
          };
          writeJson(path.join("data", `person_${personIndex}.json`), person);
          personFiles.push(`./person_${personIndex}.json`);
          writeRelationship(
            `relationship_person_${personIndex}_has_mailing_address.json`,
            `./person_${personIndex}.json`,
            mailingAddressRelPath,
          );
        }
      }
      globalThis.__ownerCompanyFiles = companyFiles;
      globalThis.__ownerPersonFiles = personFiles;
    }
  }

  // 2) UTILITIES
  let utilityRelPath = null;
  if (utilitiesData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const utilScope = key && utilitiesData[key] ? utilitiesData[key] : null;
    if (utilScope && hasMeaningfulValue(utilScope)) {
      writeJson(path.join("data", "utility.json"), utilScope);
      utilityRelPath = "./utility.json";
    }
  }

  let structureRelPath = null;
  if (structureData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const structScope =
      key && structureData[key] ? structureData[key] : null;
    if (structScope && hasMeaningfulValue(structScope)) {
      writeJson(path.join("data", "structure.json"), structScope);
      structureRelPath = "./structure.json";
    }
  }

  // Gather building characteristics for layouts and property data
  let livable = null,
    effYear = null;
  const buildingLayoutsFromTable = [];
  const bldgTable = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable",
  ).first();
  if (bldgTable && bldgTable.length) {
    bldgTable.find("tr").each((idx, row) => {
      if (idx === 0) return;
      const tds = $(row).find("td");
      if (tds.length >= 5) {
        const desc = tds.eq(2).text().trim();
        const baseSFText = tds.eq(4).text().trim();
        const baseSFNum = parseNumberFromText(baseSFText);
        if (idx === 1) {
          if (baseSFText && livable == null) livable = baseSFText;
          const y = tds.eq(3).text().trim();
          if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
        }
        if (desc || baseSFNum != null) {
          buildingLayoutsFromTable.push({
            description: desc || null,
            size: baseSFNum,
          });
        }
      }
    });
  }

  // 3) LAYOUT
  let layoutsFromFile = null;
  if (layoutData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    layoutsFromFile =
      key && layoutData[key] && Array.isArray(layoutData[key].layouts)
        ? layoutData[key].layouts
        : null;
  }

  const layoutEntries = [];
  const layoutFilePaths = [];
  function createLayoutRecord(sourceLayout, idx) {
    const record = {
      source_http_request:
        sourceLayout.source_http_request ?? defaultSourceHttpRequest,
      request_identifier:
        sourceLayout.request_identifier ?? hyphenParcel,
      space_type: mapLayoutSpaceType(
        sourceLayout.space_type ?? sourceLayout.description ?? null,
      ),
      space_type_index: String(
        sourceLayout.space_type_index ?? idx + 1,
      ),
      flooring_material_type: sourceLayout.flooring_material_type ?? null,
      size_square_feet: toNullableNumber(sourceLayout.size_square_feet),
      has_windows:
        sourceLayout.has_windows ?? null,
      window_design_type: sourceLayout.window_design_type ?? null,
      window_material_type: sourceLayout.window_material_type ?? null,
      window_treatment_type: sourceLayout.window_treatment_type ?? null,
      is_finished:
        typeof sourceLayout.is_finished === "boolean"
          ? sourceLayout.is_finished
          : true,
      furnished: sourceLayout.furnished ?? null,
      paint_condition: sourceLayout.paint_condition ?? null,
      flooring_wear: sourceLayout.flooring_wear ?? null,
      clutter_level: sourceLayout.clutter_level ?? null,
      visible_damage: sourceLayout.visible_damage ?? null,
      countertop_material: sourceLayout.countertop_material ?? null,
      cabinet_style: sourceLayout.cabinet_style ?? null,
      fixture_finish_quality: sourceLayout.fixture_finish_quality ?? null,
      design_style: sourceLayout.design_style ?? null,
      natural_light_quality: sourceLayout.natural_light_quality ?? null,
      decor_elements: sourceLayout.decor_elements ?? null,
      pool_type: sourceLayout.pool_type ?? null,
      pool_equipment: sourceLayout.pool_equipment ?? null,
      spa_type: sourceLayout.spa_type ?? null,
      safety_features: sourceLayout.safety_features ?? null,
      view_type: sourceLayout.view_type ?? null,
      lighting_features: sourceLayout.lighting_features ?? null,
      condition_issues: sourceLayout.condition_issues ?? null,
      is_exterior:
        typeof sourceLayout.is_exterior === "boolean"
          ? sourceLayout.is_exterior
          : false,
      pool_condition: sourceLayout.pool_condition ?? null,
      pool_surface_type: sourceLayout.pool_surface_type ?? null,
      pool_water_quality: sourceLayout.pool_water_quality ?? null,
    };
    const numericFields = [
      "area_under_air_sq_ft",
      "heated_area_sq_ft",
      "livable_area_sq_ft",
      "adjustable_area_sq_ft",
      "total_area_sq_ft",
    ];
    numericFields.forEach((field) => {
      if (sourceLayout[field] !== undefined) {
        record[field] = toNullableNumber(sourceLayout[field]);
      }
    });
    const passthroughFields = [
      "built_year",
      "floor_level",
      "story_type",
      "building_number",
      "installation_date",
      "kitchen_renovation_date",
      "bathroom_renovation_date",
      "flooring_installation_date",
      "pool_installation_date",
      "spa_installation_date",
    ];
    passthroughFields.forEach((field) => {
      if (sourceLayout[field] !== undefined) {
        record[field] = sourceLayout[field];
      }
    });
    return record;
  }

  if (layoutsFromFile) {
    layoutsFromFile.forEach((layout, idx) => {
      const sizeSqFt =
        layout.size_square_feet ??
        layout.livable_area_sq_ft ??
        layout.area_under_air_sq_ft ??
        layout.heated_area_sq_ft ??
        null;
      const rawSpaceType =
        layout.space_type ||
        layout.description ||
        null;
      if (!rawSpaceType && sizeSqFt == null) return;
      layoutEntries.push(
        createLayoutRecord(
          {
            space_type: rawSpaceType,
            description: layout.description ?? layout.space_type ?? null,
            space_type_index:
              layout.space_type_index ??
              layout.space_index ??
              layout.spaceIndex ??
              idx + 1,
            size_square_feet: sizeSqFt,
            flooring_material_type: layout.flooring_material_type ?? null,
            flooring_wear: layout.flooring_wear ?? null,
            has_windows: layout.has_windows ?? null,
            window_design_type: layout.window_design_type ?? null,
            window_material_type: layout.window_material_type ?? null,
            window_treatment_type: layout.window_treatment_type ?? null,
            is_finished: layout.is_finished,
            furnished: layout.furnished ?? null,
            paint_condition: layout.paint_condition ?? null,
            clutter_level: layout.clutter_level ?? null,
            visible_damage: layout.visible_damage ?? null,
            countertop_material: layout.countertop_material ?? null,
            cabinet_style: layout.cabinet_style ?? null,
            fixture_finish_quality: layout.fixture_finish_quality ?? null,
            design_style: layout.design_style ?? null,
            natural_light_quality: layout.natural_light_quality ?? null,
            decor_elements: layout.decor_elements ?? null,
            pool_type: layout.pool_type ?? null,
            pool_equipment: layout.pool_equipment ?? null,
            spa_type: layout.spa_type ?? null,
            safety_features: layout.safety_features ?? null,
            view_type: layout.view_type ?? null,
            lighting_features: layout.lighting_features ?? null,
            condition_issues: layout.condition_issues ?? null,
            is_exterior: layout.is_exterior,
            pool_condition: layout.pool_condition ?? null,
            pool_surface_type: layout.pool_surface_type ?? null,
            pool_water_quality: layout.pool_water_quality ?? null,
            area_under_air_sq_ft: layout.area_under_air_sq_ft ?? null,
            heated_area_sq_ft: layout.heated_area_sq_ft ?? null,
            livable_area_sq_ft: layout.livable_area_sq_ft ?? null,
            adjustable_area_sq_ft: layout.adjustable_area_sq_ft ?? null,
            total_area_sq_ft: layout.total_area_sq_ft ?? null,
            built_year: layout.built_year ?? null,
            floor_level: layout.floor_level ?? null,
            story_type: layout.story_type ?? null,
            building_number: layout.building_number ?? null,
              installation_date: layout.installation_date ?? null,
              kitchen_renovation_date: layout.kitchen_renovation_date ?? null,
              bathroom_renovation_date: layout.bathroom_renovation_date ?? null,
              flooring_installation_date: layout.flooring_installation_date ?? null,
              pool_installation_date: layout.pool_installation_date ?? null,
              spa_installation_date: layout.spa_installation_date ?? null,
              source_http_request: layout.source_http_request ?? null,
              request_identifier: layout.request_identifier ?? null,
            },
            layoutEntries.length,
          ),
        );
      });
  }

  if (!layoutEntries.length && buildingLayoutsFromTable.length > 0) {
    buildingLayoutsFromTable
      .filter((item) => item.description || item.size != null)
      .forEach((item, idx) => {
        if (!item.description && item.size == null) return;
        layoutEntries.push(
          createLayoutRecord(
            {
              space_type: item.description || null,
              description: item.description || null,
              space_type_index: idx + 1,
              size_square_feet: item.size ?? null,
              area_under_air_sq_ft: item.size ?? null,
              heated_area_sq_ft: item.size ?? null,
              livable_area_sq_ft: item.size ?? null,
              built_year: effYear ?? null,
              is_finished: true,
              is_exterior: false,
            },
            layoutEntries.length,
          ),
        );
      });
  }

  layoutEntries.forEach((layout, idx) => {
    const normalizedLayout = createLayoutRecord(layout, idx);
    const layoutFileName = `layout_${idx + 1}.json`;
    writeJson(path.join("data", layoutFileName), normalizedLayout);
    layoutFilePaths.push(`./${layoutFileName}`);
  });

  layoutFilePaths.forEach((layoutPath, idx) => {
    if (utilityRelPath) {
      writeRelationship(
        `relationship_layout_${idx + 1}_has_utility.json`,
        layoutPath,
        utilityRelPath,
      );
    }
    if (structureRelPath) {
      writeRelationship(
        `relationship_layout_${idx + 1}_has_structure.json`,
        layoutPath,
        structureRelPath,
      );
    }
  });

  // 4) SALES + DEEDS + FILES
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
    "Trustee Deed": "Trustee's Deed",
    "PRD": "Personal Representative Deed",
    "Pers Rep Deed": "Personal Representative Deed",
    "CD": "Correction Deed",
    "Corr Deed": "Correction Deed",
    "DIL": "Deed in Lieu of Foreclosure",
    "DILF": "Deed in Lieu of Foreclosure",
    "LED": "Life Estate Deed",
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
    "LC": "Land Contract",
    "MTG": "Mortgage",
    "LIS": "Lis Pendens",
    "EASE": "Easement",
    "AGMT": "Agreement",
    "AFF": "Affidavit",
    "ORD": "Order",
    "CERT": "Certificate",
    "RES": "Resolution",
    "DECL": "Declaration",
    "COV": "Covenant",
    "SUB": "Subordination",
    "MOD": "Modification",
    "REL": "Release",
    "ASSG": "Assignment",
    "LEAS": "Lease",
    "TR": "Trust",
    "WILL": "Will",
    "PROB": "Probate",
    "JUDG": "Judgment",
    "LIEN": "Lien",
    "SAT": "Satisfaction",
    "PART": "Partition",
    "EXCH": "Exchange",
    "CONV": "Conveyance",
    "OTH": "Other"
  };

const fileDocTypeMap = {
  WD: "Title",
  WTY: "Title",
  SWD: "Title",
  SW: "Title",
    "Spec WD": "Title",
    QCD: "Title",
    QC: "Title",
    Quitclaim: "Title",
    GD: "Title",
    BSD: "Title",
    LBD: "Title",
    TOD: "Title",
    TODD: "Title",
    SD: "Title",
    "Shrf's Deed": "Title",
    TD: "Title",
    TrD: "Title",
    "Trustee Deed": "Title",
    PRD: "Title",
    "Pers Rep Deed": "Title",
    CD: "Title",
    "Corr Deed": "Title",
    DIL: "Title",
    DILF: "Title",
    LED: "Title",
    JTD: "Title",
    TIC: "Title",
    CPD: "Title",
    "Gift Deed": "Title",
    ITD: "Title",
    "Wild D": "Title",
    SMD: "Title",
    COD: "Title",
    CFD: "Title",
    QTD: "Title",
    AD: "Title",
    "GD (Guardian)": "Title",
    RD: "Title",
    ROW: "Title",
    VPD: "Title",
    AOC: "Assignment",
    ASSG: "Assignment",
  JUDG: "AbstractOfJudgment",
};

const deedAbbreviationMap = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  TD: "Tax Deed",
  TAXD: "Tax Deed",
  QC: "Quitclaim Deed",
  QCD: "Quitclaim Deed",
  QCL: "Quitclaim Deed",
  LBD: "Lady Bird Deed",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  GIFT: "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  SMD: "Special Master's Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  PRD: "Personal Representative Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ASSG: "Assignment",
  DC: "Correction Deed",
  LC: "Land Contract",
  MTG: "Mortgage",
  LIS: "Lis Pendens",
  EASE: "Easement",
  AGMT: "Agreement",
  AFF: "Affidavit",
  ORD: "Order",
  CERT: "Certificate",
  RES: "Resolution",
  DECL: "Declaration",
  COV: "Covenant",
  SUB: "Subordination",
  MOD: "Modification",
  REL: "Release",
  LEAS: "Lease",
  TR: "Trust",
  WILL: "Will",
  PROB: "Probate",
  JUDG: "Judgment",
  LIEN: "Lien",
  SAT: "Satisfaction",
  PART: "Partition",
  EXCH: "Exchange",
  CONV: "Conveyance",
};

function normalizeDeedType(code) {
  if (!code) return null;
  const upper = code.toUpperCase().replace(/\s+/g, " ").trim();
  if (deedAbbreviationMap[upper]) return deedAbbreviationMap[upper];
  if (deedCodeMap[upper]) return deedCodeMap[upper];
  if (deedCodeMap[code]) return deedCodeMap[code];
  return code;
}

  const salesHistoryRecords = [];
  let saleIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;
  for (const row of salesRows) {
    saleIndex += 1;
    const ownershipTransferDate = parseDateToISO(row.dateTxt);
    const purchasePriceAmount = parseCurrencyToNumber(row.priceTxt);
    const bookPageRaw = row.clerkRef || row.bookPageTxt || null;
    let book = null;
    let page = null;
    if (bookPageRaw) {
      const m = bookPageRaw.replace(/\s+/g, "").match(/^(\d+)\/(\d+)$/);
      if (m) {
        book = m[1];
        page = m[2];
      }
    }
    const normalizedDeedType = normalizeDeedType(row.deedCode);
    const saleHistory = {
      source_http_request: defaultSourceHttpRequest,
      request_identifier: hyphenParcel,
      ownership_transfer_date: ownershipTransferDate,
      purchase_price_amount: purchasePriceAmount,
    };
    const saleHistoryFile = `sales_history_${saleIndex}.json`;
    writeJson(path.join("data", saleHistoryFile), saleHistory);

    const record = {
      index: saleIndex,
      filePath: `./${saleHistoryFile}`,
      saleDate: ownershipTransferDate,
      deedPath: null,
      deedCode: row.deedCode || null,
      deedBook: book,
      deedPage: page,
      deedType: normalizedDeedType,
      documentReference: bookPageRaw,
    };

    if (row.deedCode) {
      deedIndex += 1;
      const deed = {
        source_http_request: defaultSourceHttpRequest,
        request_identifier: hyphenParcel,
        deed_type: normalizedDeedType,
      };
      if (book) deed.book = book;
      if (page) deed.page = page;
      const deedFileName = `deed_${deedIndex}.json`;
      writeJson(path.join("data", deedFileName), deed);
      record.deedPath = `./${deedFileName}`;

      writeRelationship(
        `relationship_sales_history_${saleIndex}_has_deed_${deedIndex}.json`,
        record.filePath,
        `./${deedFileName}`,
      );

      fileIndex += 1;
      const originalUrl =
        book && page
          ? `https://www.lafayettepa.com/gis/linkClerk/?ClerkBook=${encodeURIComponent(
              book,
            )}&ClerkPage=${encodeURIComponent(page)}&autoSubmit=1`
          : null;
      const fileRec = {
        document_type: fileDocTypeMap[row.deedCode] || null,
        file_format: null,
        name: bookPageRaw ? `Official Records ${bookPageRaw}` : null,
        original_url: originalUrl,
        ipfs_url: null,
        request_identifier: hyphenParcel,
        source_http_request: defaultSourceHttpRequest,
      };
      const fileName = `file_${fileIndex}.json`;
      writeJson(path.join("data", fileName), fileRec);
      writeRelationship(
        `relationship_deed_${deedIndex}_has_file_${fileIndex}.json`,
        `./${deedFileName}`,
        `./${fileName}`,
      );
    }

    salesHistoryRecords.push(record);
  }

  if (salesHistoryRecords.length > 0) {
    let latestRecord = salesHistoryRecords[0];
    for (const record of salesHistoryRecords) {
      if (!record.saleDate) continue;
      if (!latestRecord.saleDate || record.saleDate > latestRecord.saleDate) {
        latestRecord = record;
      }
    }
    const salePath = latestRecord.filePath;
    const companies = globalThis.__ownerCompanyFiles || [];
    const persons = globalThis.__ownerPersonFiles || [];
    companies.forEach((companyPath, idx) => {
      writeRelationship(
        `relationship_sales_history_${latestRecord.index}_has_company_${idx + 1}.json`,
        salePath,
        companyPath,
      );
    });
    persons.forEach((personPath, idx) => {
      writeRelationship(
        `relationship_sales_history_${latestRecord.index}_has_person_${idx + 1}.json`,
        salePath,
        personPath,
      );
    });
  }

  // 5) TAX
  function extractTaxRecords() {
    const recordsByYear = new Map();
    $("table.parcelDetails_insideTable").each((i, el) => {
      const table = $(el);
      const head = table.find("tr").first().text().replace(/\s+/g, " ").trim();
      const match = head.match(/(\d{4})\s+(Certified|Working)\s+Values/i);
      if (!match) return;
      const year = Number(match[1]);
      const type = match[2].toLowerCase(); // certified or working
      const findRow = (label) => {
        let out = null;
        table.find("tr").each((_, row) => {
          const tds = $(row).find("td");
          if (tds.length >= 2) {
            const text = $(tds[0]).text().trim();
            if (text.startsWith(label)) {
              out = $(tds[1]).text().trim();
              return false;
            }
          }
          return true;
        });
        return out;
      };
      const land = findRow("Mkt Land");
      const building = findRow("Building");
      const marketValue = findRow("Market");
      const assessed = findRow("Assessed");
      let taxable = null;
      table.find("tr").each((_, row) => {
        const tds = $(row).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim();
          if (label.startsWith("Total")) {
            const htmlContent = $(tds[1]).html() || "";
            const m = htmlContent
              .replace(/\n/g, " ")
              .match(/county:\s*\$([0-9,\.]+)/i);
            if (m) taxable = m[1];
            else {
              const text = $(tds[1]).text();
              const m2 = text.match(/\$[0-9,\.]+/);
              if (m2) taxable = m2[0];
            }
          }
        }
      });
      if (!land || !building || !marketValue || !assessed || !taxable) return;
      const record = {
        tax_year: year,
        property_assessed_value_amount: parseCurrencyToNumber(assessed),
        property_market_value_amount: parseCurrencyToNumber(marketValue),
        property_building_amount: parseCurrencyToNumber(building),
        property_land_amount: parseCurrencyToNumber(land),
        property_taxable_value_amount: parseCurrencyToNumber(taxable),
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
        yearly_tax_amount: null,
        source_http_request: defaultSourceHttpRequest,
        request_identifier: hyphenParcel,
      };
      if (!recordsByYear.has(year)) {
        recordsByYear.set(year, record);
      }
    });
    return Array.from(recordsByYear.values());
  }

  const taxRecords = extractTaxRecords();
  taxRecords.forEach((record) => {
    const fileName = `tax_${record.tax_year}.json`;
    writeJson(path.join("data", fileName), record);
  });


  // 6) PROPERTY
  const parcelIdentifier =
    propertySeed && propertySeed.parcel_id
      ? propertySeed.parcel_id
      : hyphenParcel || null; // Use hyphenParcel if propertySeed is not available

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

  // Extract Area and convert to square feet
  let totalAreaSqft = null;
  // Updated selector for Land Area
  const landAreaTd = $('td:contains("Land Area")').first();
  if (landAreaTd.length) {
    const areaText = landAreaTd.next('td').text().trim();
    const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
    }
  }


  // Extract Use Code and map to normalized property attributes
  const useCodeVal = $('td')
    .filter((i, el) => $(el).text().trim().startsWith('Use'))
    .next()
    .text()
    .trim();

  const { mapping: propertyUseMapping } = getPropertyUseMapping(useCodeVal);
  const property_type_mapped = propertyUseMapping.property_type;
  const build_status_mapped =
    propertyUseMapping.build_status ??
    (property_type_mapped === "LandParcel" ? "VacantLand" : "Improved");
  const property_usage_type_mapped = propertyUseMapping.property_usage_type ?? null;
  const structure_form_mapped = propertyUseMapping.structure_form ?? null;
  const ownership_estate_type_mapped =
    propertyUseMapping.ownership_estate_type ?? "FeeSimple";

  if (property_type_mapped == null) {
    throw {
      type: "error",
      message: `No property_type mapping found for property use code value: ${useCodeVal}.`,
      path: "property.property_type",
    };
  }

  assertEnumValue(property_type_mapped, PROPERTY_TYPE_ENUM, "property.property_type");
  assertEnumValue(build_status_mapped, BUILD_STATUS_ENUM, "property.build_status");
  assertEnumValue(structure_form_mapped, STRUCTURE_FORM_ENUM, "property.structure_form");
  assertEnumValue(
    ownership_estate_type_mapped,
    OWNERSHIP_ESTATE_ENUM,
    "property.ownership_estate_type"
  );
  assertEnumValue(
    property_usage_type_mapped,
    PROPERTY_USAGE_TYPE_ENUM,
    "property.property_usage_type"
  );

  const prop = {
    source_http_request: {
      method: "GET",
      url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
    },
    request_identifier: hyphenParcel,
    livable_floor_area: livable ? String(livable) : null,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: legal || null,
    property_structure_built_year: effYear || null,
    property_effective_built_year: effYear || null,
    property_type: property_type_mapped,
    property_usage_type: property_usage_type_mapped,
    build_status: build_status_mapped,
    structure_form: structure_form_mapped,
    ownership_estate_type: ownership_estate_type_mapped,
    area_under_air: livable ? String(livable) : null,
    historic_designation: false,
    number_of_units: null, // This is an integer, not the enum type
    number_of_units_type: null,
    subdivision: null,
    total_area: totalAreaSqft,
    zoning: null,
  };
  writeJson(path.join("data", "property.json"), prop);


  // 7) LOT
  try {
    // Updated selector for land table
    // The land breakdown table is the one with "Year Blt", "Desc", "Units", "Value" headers
    // The HTML has multiple tables with class "parcelDetails_insideTable".
    // We need to find the one that contains the land breakdown data.
    // Based on the HTML, the land breakdown table is the one under "Land Breakdown" section.
    // The first row of this table has headers, so we look at the second row for data.
    const landBreakdownTable = $('#parcelDetails_LandTable table.parcelDetails_insideTable');
    let lotAreaSqft = null,
      lotSizeAcre = null;

    // The "Land Area" is found in the "Owner & Property Info" section, not the "Land Breakdown" table.
    // We already extracted this above for totalAreaSqft.
    // Re-using totalAreaSqft for lotAreaSqft if it's available and represents the primary lot area.
    if (totalAreaSqft) {
        lotAreaSqft = parseInt(totalAreaSqft, 10);
        // If totalAreaSqft was derived from acres, we can also derive lotSizeAcre
        const landAreaText = $('td:contains("Land Area")').first().next('td').text().trim();
        const acreMatch = landAreaText.match(/([0-9.]+)\s*AC/i);
        if (acreMatch) {
            lotSizeAcre = parseFloat(acreMatch[1]);
        }
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

  // 8) ADDRESS & GEOMETRY
  try {
    const siteAddress = (() => {
      const fallback =
        typeof unnormalizedAddress?.full_address === "string"
          ? unnormalizedAddress.full_address.trim()
          : null;
      if (fallback) return fallback;
      const siteLabelTd = $('td:contains("Site")')
        .filter((_, el) => $(el).text().trim() === "Site")
        .first();
      if (siteLabelTd.length) {
        const valueTd = siteLabelTd.next("td").clone();
        valueTd.find("br").replaceWith("\n");
        const lines = valueTd
          .text()
          .split(/\n+/)
          .map((line) => line.replace(/\s+/g, " ").trim().replace(/,+$/, ""))
          .filter(Boolean);
        if (lines.length) {
          if (lines.length >= 2 && /^\d/.test(lines[0]) && !/\d/.test(lines[1])) {
            lines.splice(0, 2, `${lines[0]} ${lines[1]}`);
          }
          return lines.join(", ");
        }
      }
      return null;
    })();

    let section = null;
    let township = null;
    let range = null;
    const strTxt = $('td:contains("S/T/R")')
      .filter((_, el) => $(el).text().trim().startsWith("S/T/R"))
      .first()
      .next()
      .text()
      .trim();
    if (strTxt && /\d{1,2}-[0-9A-Z]{1,3}-\d{1,2}/.test(strTxt)) {
      const parts2 = strTxt.split("-");
      if (parts2.length >= 3) {
        section = parts2[0] || null;
        township = parts2[1] || null;
        range = parts2[2] || null;
      }
    }

    const countyName = (() => {
      const title = $(".mainTitle").first().text().trim();
      const m = title.match(/([\w\s]+?)\s+County\s+Property\s+Appraiser/i);
      if (m && m[1]) return m[1].trim();
      return "Lafayette";
    })();

    const sourceHttpRequest = {
      method: propertySeed?.source_http_request?.method || "GET",
      url:
        propertySeed?.source_http_request?.url ||
        propertySeed?.entry_http_request?.url ||
        "https://www.lafayettepa.com/gis",
    };

    const requestIdentifier =
      hyphenParcel ||
      propertySeed?.parcel_id ||
      propertySeed?.request_identifier ||
      null;

    const addressPayload = {
      unnormalized_address: siteAddress,
      section: section || null,
      township: township || null,
      range: range || null,
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      county_name: countyName || null,
      country_code: "US",
    };
    writeJson(path.join("data", "address.json"), addressPayload);
    const latitude =
      typeof unnormalizedAddress?.latitude === "number"
        ? unnormalizedAddress.latitude
        : null;
    const longitude =
      typeof unnormalizedAddress?.longitude === "number"
        ? unnormalizedAddress.longitude
        : null;

    const geometryPayload = {
      latitude,
      longitude,
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
    };
    writeJson(path.join("data", "geometry.json"), geometryPayload);

    writeRelationship(
      "relationship_address_has_geometry.json",
      "./address.json",
      "./geometry.json",
    );
  } catch (e) {
    console.error("Error processing address and geometry data:", e);
  }
}

main();
