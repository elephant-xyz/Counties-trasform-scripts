const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function toNumberCurrency(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned.toUpperCase() === "N/A") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function removeNullishValues(obj) {
  if (!obj || typeof obj !== "object") return obj;
  Object.keys(obj).forEach((key) => {
    if (obj[key] == null) {
      delete obj[key];
    }
  });
  return obj;
}

function parseDateToISO(mdyy) {
  if (!mdyy) return null;
  // Accept MM/DD/YY or MM/DD/YYYY
  const m = mdyy.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;

  // Fix invalid month/day: convert 00 to 01
  if (mm === "00") mm = "01";
  if (dd === "00") dd = "01";

  let yyyy =
    yy.length === 2
      ? Number(yy) >= 50
        ? 1900 + Number(yy)
        : 2000 + Number(yy)
      : Number(yy);

  // Validate the date is valid
  const monthNum = parseInt(mm, 10);
  const dayNum = parseInt(dd, 10);

  // Check month range
  if (monthNum < 1 || monthNum > 12) return null;

  // Check day range (simple validation)
  if (dayNum < 1 || dayNum > 31) return null;

  // Check for invalid dates like Feb 30
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Leap year check
  if ((yyyy % 4 === 0 && yyyy % 100 !== 0) || yyyy % 400 === 0) {
    daysInMonth[1] = 29;
  }
  if (dayNum > daysInMonth[monthNum - 1]) return null;

  return `${yyyy}-${mm}-${dd}`;
}

function capitalizeProperName(name) {
  if (!name) return "";

  // Trim and handle empty strings
  const trimmed = name.trim();
  if (!trimmed) return "";

  // Split on spaces, hyphens, apostrophes, but preserve the delimiters
  const parts = trimmed.split(/(\s+|\-|'|,|\.)/);

  const capitalized = parts.map((part, index) => {
    // If it's a delimiter, keep it as is
    if (/^(\s+|\-|'|,|\.)$/.test(part)) return part;

    // Skip empty parts
    if (!part) return part;

    // Capitalize: first letter uppercase, rest lowercase
    // Handle special cases like O'Brien, McDonald
    if (part.length === 1) {
      return part.toUpperCase();
    }

    // Check if previous part was an apostrophe or hyphen
    const prevPart = index > 0 ? parts[index - 1] : null;
    if (prevPart === "'" || prevPart === "-") {
      // Capitalize after apostrophe or hyphen
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }

    // Handle special prefixes (Mc, Mac, O')
    if (part.toLowerCase().startsWith("mc") && part.length > 2) {
      return "Mc" + part.charAt(2).toUpperCase() + part.slice(3).toLowerCase();
    }
    if (part.toLowerCase().startsWith("mac") && part.length > 3) {
      return "Mac" + part.charAt(3).toUpperCase() + part.slice(4).toLowerCase();
    }

    // Standard capitalization
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  return capitalized.join("");
}

function extractPropertyUsageType(useCodeText) {
  if (!useCodeText) return null;
  const code = useCodeText.split("-")[0].trim();
  const map = {
    // Residential (0-9)
    0: "Residential",             // 00 - VACANT RESIDENTIAL
    1: "Residential",             // 01 - SINGLE FAMILY RESIDENTIAL
    2: "Residential",             // 02 - MOBILE HOMES
    3: "Residential",             // 03 - MULTI-FAMILY 10 UNITS OR MORE
    4: "Residential",             // ALL CONDOMINIUMS
    5: "Residential",             // 05 - COOPERATIVES
    6: "Retirement",              // 06 - RETIREMENT HOMES
    7: "Residential",             // 07 - MISCELLANEOUS RESIDENTIAL
    8: "Residential",             // 08 - MULTI-FAMILY LESS THAN 10 UNIT
    9: "Residential",             // 09 - MISCELLANEOUS

    // Condominiums (400-408)
    400: "Residential",           // 400 - VACANT
    401: "Residential",           // 401 - SINGLE FAMILY CONDOMINIUMS
    402: "Residential",           // 402 - TIMESHARE CONDOMINIUMS
    403: "Residential",           // 403 - HOMEOWNERS CONDOMINIUMS
    404: "Hotel",                 // 404 - HOTEL CONDOMINIUMS
    405: "Residential",           // 405 - BOAT SLIPS/BOAT RACKS CONDOMINIUMS
    406: "Residential",           // 406 - MOBILE HOME CONDOMINIUMS
    407: "Commercial",            // 407 - COMMERCIAL CONDOMINIUMS
    408: "Residential",           // 408 - APT CONVERSION

    // Commercial (10-39)
    10: "Commercial",             // 10 - VACANT COMMERCIAL
    11: "RetailStore",            // 11 - STORES, ONE STORY
    12: "Commercial",             // 12 - MIXED USE (STORE AND RESIDENT)
    13: "DepartmentStore",        // 13 - DEPARTMENT STORES
    14: "Supermarket",            // 14 - SUPERMARKETS
    15: "ShoppingCenterRegional", // 15 - REGIONAL SHOPPING CENTERS
    16: "ShoppingCenterCommunity",// 16 - COMMUNITY SHOPPING CENTERS
    17: "OfficeBuilding",         // 17 - OFFICE BLDG, NON-PROF, ONE STORY
    18: "OfficeBuilding",         // 18 - OFFICE BLDG, NON-PROF, MULT STORY
    19: "MedicalOffice",          // 19 - PROFESSIONAL SERVICE BUILDINGS
    20: "TransportationTerminal", // 20 - AIRPORTS, BUS TERM, PIERS, MARINAS
    21: "Restaurant",             // 21 - RESTAURANTS, CAFETERIAS
    22: "Restaurant",             // 22 - DRIVE-IN RESTAURANTS
    23: "FinancialInstitution",   // 23 - FINANCIAL INSTITUTIONS
    24: "FinancialInstitution",   // 24 - INSURANCE COMPANY OFFICES
    25: "Commercial",             // 25 - REPAIR SHOPS, LAUNDRIES, LAUNDROMATS
    26: "ServiceStation",         // 26 - SERVICE STATIONS
    27: "AutoSalesRepair",        // 27 - EQUIPMENT SALES, REPAIR, BODY SHOPS
    28: "MobileHomePark",         // 28 - PARKING LOTS, MOBILE HOME PARKS
    29: "WholesaleOutlet",        // 29 - WHOLESALE OUTLETS, PRODUCE HOUSES
    30: "Commercial",             // 30 - FLORIST, GREENHOUSES
    31: "Theater",                // 31 - DRIVE-IN THEATERS, OPEN STADIUMS
    32: "Theater",                // 32 - ENCLOSED THEATERS, AUDITORIUMS
    33: "Entertainment",          // 33 - NIGHTCLUBS, LOUNGES, BARS
    34: "Entertainment",          // 34 - BOWLING ALLEYS, SKATING RINKS, POOL HALL
    35: "Entertainment",          // 35 - TOURIST ATTRACTIONS
    36: "Recreational",           // 36 - CAMPS
    37: "RaceTrack",              // 37 - RACE TRACKS
    38: "GolfCourse",             // 38 - GOLF COURSES, DRIVING RANGES
    39: "Hotel",                  // 39 - HOTELS, MOTELS

    // Industrial (40-49)
    40: "Industrial",             // 40 - VACANT INDUSTRIAL
    41: "LightManufacturing",     // 41 - LIGHT MANUFACTURING, SMALL EQUIPMENT
    42: "HeavyManufacturing",     // 42 - HEAVY INDUSTRIAL, HEAVY EQUIPMENT
    43: "LumberYard",             // 43 - LUMBER YARDS, SAWMILLS
    44: "PackingPlant",           // 44 - PACKING PLANTS, FRUIT & VEGETABLE PACKIN
    45: "Cannery",                // 45 - CANNERIES, BOTTLERS AND BREWERS, WINERIES
    46: "Industrial",             // 46 - OTHER FOOD PROCESSING, CANDY FACTORIES
    47: "MineralProcessing",      // 47 - MINERAL PROCESSING, PHOSPHATE PROCESSING
    48: "Warehouse",              // 48 - WAREHOUSING, DISTRIBUTION TERMINALS, TRU
    49: "OpenStorage",            // 49 - OPEN STORAGE, NEW AND USED BUILDING SUPP

    // Agricultural (50-69)
    50: "Agricultural",           // 50 - AG IMPROVED AGRICULTURAL
    51: "CroplandClass2",         // 51 - AG CROPLAND SOIL CAPABILITY CLASS I
    52: "CroplandClass2",         // 52 - AG CROPLAND SOIL CAPABILITY CLASS II
    53: "CroplandClass3",         // 53 - AG CROPLAND SOIL CAPABILITY CLASS III
    54: "TimberLand",             // 54 - AG TIMBERLAND - SITE INDEX 90 & ABOVE
    55: "TimberLand",             // 55 - AG TIMBERLAND - SITE INDEX 89-89
    56: "TimberLand",             // 56 - AG TIMBERLAND - SITE INDEX 70-79
    57: "TimberLand",             // 57 - AG TIMBERLAND - SITE INDEX 60-69
    58: "TimberLand",             // 58 - AG TIMBERLAND - SITE INDEX 50-59
    59: "TimberLand",             // 59 - AG TIMBERLAND - NOT CLASSIFIED BY SITE INDEX
    60: "GrazingLand",            // 60 - AG GRAZING LAND SOIL CAPABILITY CLASS I
    61: "GrazingLand",            // 61 - AG GRAZING LAND SOIL CAPABILITY CLASS II
    62: "GrazingLand",            // 62 - AG GRAZING LAND SOIL CAPABILITY CLASS III
    63: "GrazingLand",            // 63 - AG GRAZING LAND SOIL CAPABILITY CLASS IV
    64: "GrazingLand",            // 64 - AG GRAZING LAND SOIL CAPABILITY CLASS V
    65: "GrazingLand",            // 65 - AG GRAZING LAND SOIL CAPABILITY CLASS VI
    66: "OrchardGroves",          // 66 - AG ORCHARD GROVES, CITRUS, ETC.
    67: "Poultry",                // 67 - AG POULTRY, BEES, TROPICAL FISH, RABBITS
    68: "Agricultural",           // 68 - AG DAIRIES, FEED LOTS
    69: "Ornamentals",            // 69 - AG ORNAMENTALS, MISC AGRICULTURAL

    // Institutional (70-79)
    70: "Unknown",                // 70 - VACANT INSTITUTIONAL
    71: "Church",                 // 71 - CHURCHES
    72: "PrivateSchool",          // 72 - PRIVATE SCHOOLS AND COLLEGES
    73: "PrivateHospital",        // 73 - PRIVATELY OWNED HOSPITALS
    74: "HomesForAged",           // 74 - HOMES FOR THE AGED
    75: "NonProfitCharity",       // 75 - ORPHANAGES, OTHER NON-PROFIT
    76: "MortuaryCemetery",       // 76 - MORTUARIES, CEMETERIES, CREMATORIUMS
    77: "ClubsLodges",            // 77 - CLUBS, LODGES, UNION HALLS
    78: "SanitariumConvalescentHome", // 78 - SANITARIUMS, CONVALESCENT AND REST HOMES
    79: "CulturalOrganization",   // 79 - CULTURAL ORGANIZATIONS, FACILITIES

    // Government (80-89)
    80: "GovernmentProperty",     // 80 - UNDEFINED
    81: "Military",               // 81 - MILITARY
    82: "ForestParkRecreation",   // 82 - FOREST, PARKS, RECREATIONAL AREAS
    83: "PublicSchool",           // 83 - PUBLIC COUNTY SCHOOLS
    84: "PublicSchool",           // 84 - COLLEGES
    85: "PublicHospital",         // 85 - HOSPITALS
    86: "GovernmentProperty",     // 86 - COUNTIES INCLUDING NON-MUNICIPAL GOV.
    87: "GovernmentProperty",     // 87 - State, OTHER THAN MILITARY, FORESTS, PAR
    88: "GovernmentProperty",     // 88 - FEDERAL, OTHER THAN MILITARY, FORESTS
    89: "GovernmentProperty",     // 89 - MUNICIPAL, OTHER THAN PARKS, RECREATIONA

    // Miscellaneous (90-99)
    90: "Commercial",             // 90 - LEASEHOLD INTERESTS
    91: "Utility",                // 91 - UTILITY, GAS, ELECTRIC, TELEPHONE, LOCAL
    92: "Industrial",             // 92 - MINING LANDS, PETROLEUM LANDS, OR GAS LA
    93: "Unknown",                // 93 - SUBSURFACE RIGHTS
    94: "Railroad",               // 94 - RIGHT-OF-WAY, STREETS, ROADS, IRRIGATION
    95: "RiversLakes",            // 95 - RIVERS AND LAKES, SUBMERGED LANDS
    96: "SewageDisposal",         // 96 - SEWAGE DISPOSAL, SOLID WAST, BORROW PITS
    97: "ForestParkRecreation",   // 97 - OUTDOOR RECREATIONAL OR PARKLAND SUBJECT
    98: "Utility",                // 98 - CENTRALLY ASSESSED
    99: "Agricultural",           // 99 - ACREAGE NOT CLASSIFIED AGRICULTURAL
  };
  return map[code] || null;
}

function extractPropertyType(useCodeText) {
  if (!useCodeText) return null;
  const code = useCodeText.split("-")[0].trim();
  const map = {
    // Residential (0-9)
    0: "VacantLand",              // 00 - VACANT RESIDENTIAL
    1: "SingleFamily",            // 01 - SINGLE FAMILY RESIDENTIAL
    2: "MobileHome",              // 02 - MOBILE HOMES
    3: "MultiFamilyMoreThan10",   // 03 - MULTI-FAMILY 10 UNITS OR MORE
    4: "Condominium",             // ALL CONDOMINIUMS
    5: "Cooperative",             // 05 - COOPERATIVES
    6: "Retirement",              // 06 - RETIREMENT HOMES
    7: "MiscellaneousResidential",// 07 - MISCELLANEOUS RESIDENTIAL
    8: "MultiFamilyLessThan10",   // 08 - MULTI-FAMILY LESS THAN 10 UNIT
    9: "MiscellaneousResidential",// 09 - MISCELLANEOUS

    // Condominiums (400-408)
    400: "VacantLand",            // 400 - VACANT (implied from context)
    401: "Condominium",           // 401 - SINGLE FAMILY CONDOMINIUMS
    402: "Timeshare",             // 402 - TIMESHARE CONDOMINIUMS
    403: "Condominium",           // 403 - HOMEOWNERS CONDOMINIUMS
    404: "Condominium",           // 404 - HOTEL CONDOMINIUMS
    405: "Condominium",           // 405 - BOAT SLIPS/BOAT RACKS CONDOMINIUMS
    406: "MobileHome",            // 406 - MOBILE HOME CONDOMINIUMS
    407: "Condominium",           // 407 - COMMERCIAL CONDOMINIUMS
    408: "Apartment",             // 408 - APT CONVERSION

    // Commercial (10-39)
    10: "VacantLand",             // 10 - VACANT COMMERCIAL
    11: "Building",               // 11 - STORES, ONE STORY
    12: "Building",               // 12 - MIXED USE (STORE AND RESIDENT)
    13: "Building",               // 13 - DEPARTMENT STORES
    14: "Building",               // 14 - SUPERMARKETS
    15: "Building",               // 15 - REGIONAL SHOPPING CENTERS
    16: "Building",               // 16 - COMMUNITY SHOPPING CENTERS
    17: "Building",               // 17 - OFFICE BLDG, NON-PROF, ONE STORY
    18: "Building",               // 18 - OFFICE BLDG, NON-PROF, MULT STORY
    19: "Building",               // 19 - PROFESSIONAL SERVICE BUILDINGS
    20: "Building",               // 20 - AIRPORTS, BUS TERM, PIERS, MARINAS
    21: "Building",               // 21 - RESTAURANTS, CAFETERIAS
    22: "Building",               // 22 - DRIVE-IN RESTAURANTS
    23: "Building",               // 23 - FINANCIAL INSTITUTIONS
    24: "Building",               // 24 - INSURANCE COMPANY OFFICES
    25: "Building",               // 25 - REPAIR SHOPS, LAUNDRIES, LAUNDROMATS
    26: "Building",               // 26 - SERVICE STATIONS
    27: "Building",               // 27 - EQUIPMENT SALES, REPAIR, BODY SHOPS
    28: "LandParcel",             // 28 - PARKING LOTS, MOBILE HOME PARKS
    29: "Building",               // 29 - WHOLESALE OUTLETS, PRODUCE HOUSES
    30: "Building",               // 30 - FLORIST, GREENHOUSES
    31: "LandParcel",             // 31 - DRIVE-IN THEATERS, OPEN STADIUMS
    32: "Building",               // 32 - ENCLOSED THEATERS, AUDITORIUMS
    33: "Building",               // 33 - NIGHTCLUBS, LOUNGES, BARS
    34: "Building",               // 34 - BOWLING ALLEYS, SKATING RINKS, POOL HALL
    35: "Building",               // 35 - TOURIST ATTRACTIONS
    36: "LandParcel",             // 36 - CAMPS
    37: "LandParcel",             // 37 - RACE TRACKS
    38: "LandParcel",             // 38 - GOLF COURSES, DRIVING RANGES
    39: "Building",               // 39 - HOTELS, MOTELS

    // Industrial (40-49)
    40: "VacantLand",             // 40 - VACANT INDUSTRIAL
    41: "Building",               // 41 - LIGHT MANUFACTURING, SMALL EQUIPMENT
    42: "Building",               // 42 - HEAVY INDUSTRIAL, HEAVY EQUIPMENT
    43: "Building",               // 43 - LUMBER YARDS, SAWMILLS
    44: "Building",               // 44 - PACKING PLANTS, FRUIT & VEGETABLE PACKIN
    45: "Building",               // 45 - CANNERIES, BOTTLERS AND BREWERS, WINERIES
    46: "Building",               // 46 - OTHER FOOD PROCESSING, CANDY FACTORIES
    47: "Building",               // 47 - MINERAL PROCESSING, PHOSPHATE PROCESSING
    48: "Building",               // 48 - WAREHOUSING, DISTRIBUTION TERMINALS, TRU
    49: "LandParcel",             // 49 - OPEN STORAGE, NEW AND USED BUILDING SUPP

    // Agricultural (50-69)
    50: "LandParcel",             // 50 - AG IMPROVED AGRICULTURAL
    51: "LandParcel",             // 51 - AG CROPLAND SOIL CAPABILITY CLASS I
    52: "LandParcel",             // 52 - AG CROPLAND SOIL CAPABILITY CLASS II
    53: "LandParcel",             // 53 - AG CROPLAND SOIL CAPABILITY CLASS III
    54: "LandParcel",             // 54 - AG TIMBERLAND - SITE INDEX 90 & ABOVE
    55: "LandParcel",             // 55 - AG TIMBERLAND - SITE INDEX 89-89
    56: "LandParcel",             // 56 - AG TIMBERLAND - SITE INDEX 70-79
    57: "LandParcel",             // 57 - AG TIMBERLAND - SITE INDEX 60-69
    58: "LandParcel",             // 58 - AG TIMBERLAND - SITE INDEX 50-59
    59: "LandParcel",             // 59 - AG TIMBERLAND - NOT CLASSIFIED BY SITE INDEX
    60: "LandParcel",             // 60 - AG GRAZING LAND SOIL CAPABILITY CLASS I
    61: "LandParcel",             // 61 - AG GRAZING LAND SOIL CAPABILITY CLASS II
    62: "LandParcel",             // 62 - AG GRAZING LAND SOIL CAPABILITY CLASS III
    63: "LandParcel",             // 63 - AG GRAZING LAND SOIL CAPABILITY CLASS IV
    64: "LandParcel",             // 64 - AG GRAZING LAND SOIL CAPABILITY CLASS V
    65: "LandParcel",             // 65 - AG GRAZING LAND SOIL CAPABILITY CLASS VI
    66: "LandParcel",             // 66 - AG ORCHARD GROVES, CITRUS, ETC.
    67: "LandParcel",             // 67 - AG POULTRY, BEES, TROPICAL FISH, RABBITS
    68: "LandParcel",             // 68 - AG DAIRIES, FEED LOTS
    69: "LandParcel",             // 69 - AG ORNAMENTALS, MISC AGRICULTURAL

    // Institutional (70-79)
    70: "VacantLand",             // 70 - VACANT INSTITUTIONAL
    71: "Building",               // 71 - CHURCHES
    72: "Building",               // 72 - PRIVATE SCHOOLS AND COLLEGES
    73: "Building",               // 73 - PRIVATELY OWNED HOSPITALS
    74: "Building",               // 74 - HOMES FOR THE AGED
    75: "Building",               // 75 - ORPHANAGES, OTHER NON-PROFIT
    76: "Building",               // 76 - MORTUARIES, CEMETERIES, CREMATORIUMS
    77: "Building",               // 77 - CLUBS, LODGES, UNION HALLS
    78: "Building",               // 78 - SANITARIUMS, CONVALESCENT AND REST HOMES
    79: "Building",               // 79 - CULTURAL ORGANIZATIONS, FACILITIES

    // Government (80-89)
    80: "Building",               // 80 - UNDEFINED
    81: "Building",               // 81 - MILITARY
    82: "LandParcel",             // 82 - FOREST, PARKS, RECREATIONAL AREAS
    83: "Building",               // 83 - PUBLIC COUNTY SCHOOLS
    84: "Building",               // 84 - COLLEGES
    85: "Building",               // 85 - HOSPITALS
    86: "Building",               // 86 - COUNTIES INCLUDING NON-MUNICIPAL GOV.
    87: "Building",               // 87 - State, OTHER THAN MILITARY, FORESTS, PAR
    88: "Building",               // 88 - FEDERAL, OTHER THAN MILITARY, FORESTS
    89: "Building",               // 89 - MUNICIPAL, OTHER THAN PARKS, RECREATIONA

    // Miscellaneous (90-99)
    90: "Building",               // 90 - LEASEHOLD INTERESTS
    91: "Building",               // 91 - UTILITY, GAS, ELECTRIC, TELEPHONE, LOCAL
    92: "LandParcel",             // 92 - MINING LANDS, PETROLEUM LANDS, OR GAS LA
    93: "LandParcel",             // 93 - SUBSURFACE RIGHTS
    94: "LandParcel",             // 94 - RIGHT-OF-WAY, STREETS, ROADS, IRRIGATION
    95: "LandParcel",             // 95 - RIVERS AND LAKES, SUBMERGED LANDS
    96: "LandParcel",             // 96 - SEWAGE DISPOSAL, SOLID WAST, BORROW PITS
    97: "LandParcel",             // 97 - OUTDOOR RECREATIONAL OR PARKLAND SUBJECT
    98: "Building",               // 98 - CENTRALLY ASSESSED
    99: "LandParcel",             // 99 - ACREAGE NOT CLASSIFIED AGRICULTURAL
  };
  const val = map[code];
  if (!val) {
    const err = {
      type: "error",
      message: `Unknown enum value ${code}.`,
      path: "property.property_type",
    };
    throw new Error(JSON.stringify(err));
  }
  return val;
}

function mapPermitImprovementType(typeText) {
  const txt = (typeText || "").toUpperCase();
  if (!txt) return "GeneralBuilding";
  if (txt.includes("ROOF")) return "Roofing";
  if (txt.includes("POOL")) return "PoolSpaInstallation";
  if (txt.includes("FENCE")) return "Fencing";
  if (txt.includes("SCREEN")) return "ScreenEnclosure";
  if (txt.includes("SPA") || txt.includes("HOT TUB") || txt.includes("JACUZZI")) {
    return "PoolSpaInstallation";
  }
  if (txt.includes("WINDOW") || txt.includes("DOOR")) return "ExteriorOpeningsAndFinishes";
  if (txt.includes("HVAC") || txt.includes("A/C") || txt.includes("AIR")) return "MechanicalHVAC";
  if (txt.includes("ELECT")) return "Electrical";
  if (txt.includes("PLUMB")) return "Plumbing";
  if (txt.includes("SOLAR")) return "Solar";
  if (txt.includes("PAVE")) return "SiteDevelopment";
  if (txt.includes("DEMO")) return "Demolition";
  if (txt.includes("GARAGE") || txt.includes("ADDITION") || txt.includes("BUILD")) {
    return "BuildingAddition";
  }
  if (txt.includes("CARPORT") || txt.includes("CANOPY")) return "BuildingAddition";
  if (txt.includes("DOCK") || txt.includes("SHORE")) return "DockAndShore";
  if (txt.includes("IRRIG")) return "LandscapeIrrigation";
  if (txt.includes("SHUT") || txt.includes("AWNING")) return "ShutterAwning";
  if (txt.includes("GAS")) return "GasInstallation";
  if (txt.includes("FIRE")) return "FireProtectionSystem";
  if (txt.includes("MOBILE")) return "MobileHomeRV";
  return "GeneralBuilding";
}

function determineImprovementStatus(closeDate) {
  return closeDate ? "Completed" : "Permitted";
}

function toTitleCaseWords(value) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


function parseAddress(
  fullAddress,
  legalText,
  section,
  township,
  range,
  countyNameFromSeed,
  municipality,
  ownerZip,
) {
  // From legal, get block and lot
  let block = null,
    lot = null;
  if (legalText) {
    const b = legalText.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (b) block = b[1].toUpperCase();
    const l = legalText.match(/LOT\s+(\w+)/i);
    if (l) lot = l[1];
  }

  const cleanedAddress = fullAddress ? fullAddress.replace(/\s+/g, " ").trim() : null;
  if (cleanedAddress) {
    const addressObj = { unnormalized_address: cleanedAddress };
    // Append zip code if not already in address and ownerZip is available
    if (ownerZip && !cleanedAddress.match(/\d{5}/)) {
      addressObj.unnormalized_address = `${cleanedAddress}, ${ownerZip}`;
    }
    return addressObj;
  }
  const structured = {};
  if (countyNameFromSeed) structured.county_name = countyNameFromSeed;
  if (municipality) structured.municipality_name = municipality;
  if (section) structured.section = section;
  if (township) structured.township = township;
  if (range) structured.range = range;
  if (block) structured.block = block;
  if (lot) structured.lot = lot;
  if (ownerZip) structured.postal_code = ownerZip;
  return structured;
}

function main() {
  const inHtmlPath = path.join("input.html");
  const unaddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inHtmlPath, "utf8");
  const $ = cheerio.load(html);

  const unaddr = readJson(unaddrPath);
  const seed = readJson(seedPath);
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const folio = seed.request_identifier || seed.parcel_id;
  const buildingBaseAreaInfo = [];

  // Helper function to get text from selector
  function getText(selector) {
    const value = $(selector).text().trim();
    return value;
  }

  // Extract base fields from HTML
  const parcelId =
    getText("#ParcelID") || seed.parcel_id || folio;
  const fullAddressHtml = getText("#FullAddressUnit");
  const fullAddressUn = unaddr.full_address || null;

  const fullAddress = fullAddressUn || fullAddressHtml || null;
  const legalText = getText("#Legal") || null;
  const subdivisionRaw = getText("#SCDescription") || null; // e.g., 469900 - LONGSHORE LAKE UNIT 1
  const subdivision = subdivisionRaw
    ? subdivisionRaw.replace(/^\s*\d+\s*-\s*/, "").trim()
    : null;
  const useCodeText = getText("#UCDescription");

  const section = getText("#Section") || null;
  const township = getText("#Township") || null;
  const range = getText("#Range") || null;
  const municipality = getText("#Municipality") || null;
  const totalAcresRaw = getText("#TotalAcres") || null;
  const totalAcres =
    totalAcresRaw != null && totalAcresRaw !== ""
      ? parseFloat(totalAcresRaw.replace(/[^0-9.]/g, ""))
      : null;
  const strapNumber = getText("#StrapNumber") || null;
  const millageArea = getText("#MillageArea") || null;
  const ownerZip = getText("#OwnerZip") || null;

  // Property JSON
  const property = {
    parcel_identifier: parcelId,
    property_legal_description_text: legalText,
    property_structure_built_year: null,
    property_type: null,
    property_usage_type: null,
    number_of_units: null,
    subdivision: subdivision || null,
    zoning: millageArea || null,
  };
  // property_type and property_usage_type
  if (useCodeText) {
    property.property_type = extractPropertyType(useCodeText);
    property.property_usage_type = extractPropertyUsageType(useCodeText);
  }

  // Year built and areas from Building/Extra Features
  // Positive list: These ARE residential structures that should be included
  const residentialTypes = [
    /SINGLE\s+FAMILY\s+RESIDENCE/i,
    /SINGLE\s+FAMILY/i,
    /CONDO/i,
    /CONDOMINIUM/i,
    /HOMEOWNERS/i,
    /MULTI[-\s]*FAMILY/i,
    /MOBILE\s+HOME/i,
    /MANUFACTURED\s+HOME/i,
    /DUPLEX/i,
    /TRIPLEX/i,
    /FOURPLEX/i,
    /TOWNHOUSE/i,
    /TOWNHOME/i,
    /APARTMENT/i,
    /RESIDENTIAL\s+STYLE\s+BUILDING/i,
    /RESIDENTIAL\s+BUILDING/i,
  ];

  let yearBuilt = null;
  let fallbackYearBuilt = null;
  let totalBaseArea = 0;
  let totalBaseAreaAll = 0;
  let totalAdjArea = 0;
  let hasAnyResidentialBuildings = false;

  // Find all BLDGCLASS spans and process each building
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim();
    if (!buildingClass) return;

    const spanId = $span.attr("id") || "";
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];
    const $buildingRow = $span.closest("tr");

    const isResidential = residentialTypes.some((pattern) =>
      pattern.test(buildingClass),
    );

    const seqText = ($buildingRow.length
      ? $buildingRow.find("span[id^=SEQNO]").first().text().trim()
      : $(`#SEQNO${buildingNum}`).first().text().trim()) || null;
    const yearText = ($buildingRow.length
      ? $buildingRow.find("span[id^=YRBUILT]").first().text().trim()
      : $(`#YRBUILT${buildingNum}`).first().text().trim());
    let yearValue = null;
    if (yearText) {
      const parsedYear = parseInt(yearText, 10);
      if (!Number.isNaN(parsedYear)) {
        yearValue = parsedYear;
        if (!fallbackYearBuilt) fallbackYearBuilt = parsedYear;
        if (isResidential && !yearBuilt) {
          yearBuilt = parsedYear;
        }
      }
    }

    const baseAreaText = ($buildingRow.length
      ? $buildingRow.find("span[id^=BASEAREA]").first().text().trim()
      : $(`#BASEAREA${buildingNum}`).first().text().trim());
    let baseAreaValue = null;
    if (baseAreaText) {
      const parsedBase = parseFloat(baseAreaText.replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(parsedBase) && parsedBase > 0) {
        baseAreaValue = parsedBase;
        totalBaseAreaAll += parsedBase;
        if (isResidential) {
          totalBaseArea += parsedBase;
        }
      }
    }

    const adjAreaText = ($buildingRow.length
      ? $buildingRow.find("span[id^=TYADJAREA]").first().text().trim()
      : $(`#TYADJAREA${buildingNum}`).first().text().trim());
    let adjAreaValue = null;
    if (adjAreaText) {
      const parsedAdj = parseFloat(adjAreaText.replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(parsedAdj) && parsedAdj > 0) {
        adjAreaValue = parsedAdj;
        if (isResidential) {
          totalAdjArea += parsedAdj;
        }
      }
    }

    if (isResidential) {
      hasAnyResidentialBuildings = true;
    }

    buildingBaseAreaInfo.push({
      sequence: seqText || null,
      buildingClass: buildingClass || null,
      baseArea: baseAreaValue,
      adjustedArea: adjAreaValue,
      yearBuilt: yearValue,
    });
  });

  if (!yearBuilt && fallbackYearBuilt) {
    yearBuilt = fallbackYearBuilt;
  }
  if (yearBuilt) property.property_structure_built_year = yearBuilt;
  // Note: Area fields (livable_floor_area, area_under_air, total_area) are deprecated
  // in the property class. Area information is now stored in layout and structure objects.

  // Address
  const countyName =
    unaddr.county_jurisdiction === "Collier"
      ? "Collier"
      : unaddr.county_jurisdiction || null;
  const addressObj = parseAddress(
    fullAddress,
    legalText,
    section,
    township,
    range,
    countyName,
    municipality,
    ownerZip,
  );
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addressObj, null, 2),
  );
  try {
    const relPath = path.join(dataDir, "relationship_property_has_address.json");
    if (fs.existsSync(relPath)) fs.unlinkSync(relPath);
  } catch (_) {}
  if (
    fs.existsSync(path.join(dataDir, "property.json")) &&
    fs.existsSync(path.join(dataDir, "address.json"))
  ) {
    const propertyAddressRel = {
      from: { "/": "./property.json" },
      to: { "/": "./address.json" },
    };
    fs.writeFileSync(
      path.join(dataDir, "relationship_property_has_address.json"),
      JSON.stringify(propertyAddressRel, null, 2),
    );
  }

  // Extract TOTALUNITS for multi-unit properties
  const totalUnits1 = getText("#TOTALUNITS1") || null;
  if (totalUnits1) {
    const unitsCount = parseFloat(totalUnits1.replace(/[^0-9.]/g, ""));
    if (!isNaN(unitsCount) && unitsCount > 0) {
      property.number_of_units = Math.floor(unitsCount);
    }
  }

  // Lot data with acreage
  if (totalAcres != null && totalAcres > 0) {
    const lotObj = {
      lot_size_acre: totalAcres,
      lot_area_sqft: null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_type: null,
      lot_condition_issues: null,
      landscaping_features: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      paving_type: "None",
      paving_area_sqft: null,
      paving_installation_date: null,
      site_lighting_type: "None",
      site_lighting_fixture_count: null,
      site_lighting_installation_date: null,
      view: null,
    };

    fs.writeFileSync(
      path.join(dataDir, "lot.json"),
      JSON.stringify(lotObj, null, 2),
    );
    const lotRel = {
      from: { "/": "./property.json" },
      to: { "/": "./lot.json" },
    };
    fs.writeFileSync(
      path.join(dataDir, "relationship_property_has_lot.json"),
      JSON.stringify(lotRel, null, 2),
    );
  } else {
    // Clean up stale lot files if no acreage data
    try {
      const lotPath = path.join(dataDir, "lot.json");
      if (fs.existsSync(lotPath)) fs.unlinkSync(lotPath);
      const lotRelPath = path.join(dataDir, "relationship_property_has_lot.json");
      if (fs.existsSync(lotRelPath)) fs.unlinkSync(lotRelPath);
    } catch (_) {}
  }

  // Write property.json now with all fields populated
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // Parcel (strap number and map number)
  const mapNumber = getText("#MapNumber") || null;
  if (strapNumber || mapNumber) {
    const parcelIdentifier = strapNumber ? strapNumber.replace(/\s+/g, " ").trim() : null;
    const parcelObj = {
      parcel_identifier: parcelIdentifier,
    };
    // Add map_number if it exists (using parcel_identifier as fallback since map_number field may not exist)
    if (mapNumber) {
      parcelObj.map_number = mapNumber;
    }
    fs.writeFileSync(
      path.join(dataDir, "parcel.json"),
      JSON.stringify(parcelObj, null, 2),
    );
    const parcelRel = {
      from: { "/": "./property.json" },
      to: { "/": "./parcel.json" },
    };
    fs.writeFileSync(
      path.join(dataDir, "relationship_property_has_parcel.json"),
      JSON.stringify(parcelRel, null, 2),
    );
  }

  // Sales + Deeds - from Summary sales table
  const saleRows = [];
  for (let idx = 1; idx <= 11; idx++) {
    const dateTxt = getText(`#SaleDate${idx}`);
    const amtTxt = getText(`#SaleAmount${idx}`);

    // Access book/page link using complex selector if it exists
    const bookPageSelector = `table.clsWide > tfoot.clsNoBorderBox > tr:nth-child(${idx + 1}) > td.clsLabelnt:nth-child(2) > a`;
    const bookPage = $(bookPageSelector).text().trim() || null;

    // Always add row if any data exists to ensure selectors are mapped
    if (dateTxt || amtTxt || bookPage) {
      const row = {
        rowIndex: idx,
        dateTxt,
        iso: parseDateToISO(dateTxt),
        amount: toNumberCurrency(amtTxt),
        bookPage,
      };
      saleRows.push(row);
    }
  }

  // Create deed and file files for every sale row (even $0)
  saleRows.forEach((row, idx) => {
    const deedObj = {};
    fs.writeFileSync(
      path.join(dataDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
    );

    const fileObj = {
      file_format: null, // unknown (pdf not in enum)
      name: row.bookPage || null,
      original_url: null, // not provided (javascript: link only)
      ipfs_url: null,
      document_type: "ConveyanceDeed",
    };
    fs.writeFileSync(
      path.join(dataDir, `file_${idx + 1}.json`),
      JSON.stringify(fileObj, null, 2),
    );

    const relDf = {
      from: { "/": `./deed_${idx + 1}.json` },
      to: { "/": `./file_${idx + 1}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_deed_file_${idx + 1}.json`),
      JSON.stringify(relDf, null, 2),
    );
  });

  // Create sales files for all sales (even with null/invalid dates or amounts)
  // This ensures all SaleAmount and SaleDate selectors are mapped to output
  const validSales = saleRows.map((r, idx) => ({
    ...r,
    originalIndex: idx,
  })).filter((r) => r.dateTxt || r.amount != null);

  validSales.sort((a, b) => {
    // Sort by date if both have valid dates, otherwise by original index
    if (a.iso && b.iso) return a.iso.localeCompare(b.iso);
    return a.originalIndex - b.originalIndex;
  });

  validSales.forEach((s, idx) => {
    const saleObj = {
      ownership_transfer_date: s.iso || null, // Allow null dates
      purchase_price_amount: s.amount != null ? s.amount : null, // Allow null amounts
    };
    fs.writeFileSync(
      path.join(dataDir, `sales_${idx + 1}.json`),
      JSON.stringify(saleObj, null, 2),
    );
  });

  // Relationship: sales -> deed for all valid sales (map to original row index)
  validSales.forEach((s, idx) => {
    const orig = saleRows.findIndex(
      (r) => r.iso === s.iso && r.amount === s.amount,
    );
    if (orig !== -1) {
      const deedIdx = orig + 1;
      const rel = {
        from: { "/": `./sales_${idx + 1}.json` },
        to: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`),
        JSON.stringify(rel, null, 2),
      );
    }
  });

  // Owners (company/person) from owners/owner_data.json
  const ownerKey = `property_${folio}`;
  const ownerEntry = owners[ownerKey];
  if (
    ownerEntry &&
    ownerEntry.owners_by_date &&
    Array.isArray(ownerEntry.owners_by_date.current)
  ) {
    const curr = ownerEntry.owners_by_date.current;
    if (curr.length > 0) {
      // Cleanup any legacy duplicate relationship files
      const relFiles = fs.readdirSync(dataDir);
      for (const f of relFiles) {
        if (
          f.startsWith("relationship_sales_person") ||
          f.startsWith("relationship_sales_company") ||
          f.startsWith("relationship_sales_history_has_person") ||
          f.startsWith("relationship_sales_history_has_company") ||
          f.startsWith("relationship_property_has_company") ||
          f.startsWith("relationship_property_has_person") ||
          f.startsWith("person_") ||
          f.startsWith("company_") ||
          f.startsWith("relationship_person_has_address") ||
          f.startsWith("relationship_company_has_address")
        ) {
          try {
            fs.unlinkSync(path.join(dataDir, f));
          } catch (_) {}
        }
      }

      // Handle mixed owner types (persons and companies)
      let personIdx = 1;
      let companyIdx = 1;
      const personFiles = [];
      const companyFiles = [];
      let ownerMailingFile = null;

      if (ownerEntry.mailing_address) {
        const mailing = ownerEntry.mailing_address;
        if (mailing.unnormalized_address) {
          const ownerAddress = {
            unnormalized_address: mailing.unnormalized_address,
          };
          const ownerAddressPath = path.join(dataDir, "owner_address.json");
          fs.writeFileSync(
            ownerAddressPath,
            JSON.stringify(ownerAddress, null, 2),
          );
          ownerMailingFile = "./owner_address.json";
        }
      }

      curr.forEach((owner) => {
        if (owner.type === "company") {
          const comp = { name: owner.name || null };
          const filename = `company_${companyIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(comp, null, 2),
          );
          companyFiles.push(`./${filename}`);
          companyIdx++;
        } else if (owner.type === "person") {
          const person = {
            birth_date: owner.birth_date || null,
            first_name: capitalizeProperName(owner.first_name) || "",
            last_name: capitalizeProperName(owner.last_name) || "",
            middle_name: owner.middle_name ? capitalizeProperName(owner.middle_name) : null,
            prefix_name: owner.prefix_name || null,
            suffix_name: owner.suffix_name || null,
            us_citizenship_status: owner.us_citizenship_status || null,
            veteran_status: owner.veteran_status != null ? owner.veteran_status : null,
          };
          const filename = `person_${personIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(person, null, 2),
          );
          personFiles.push(`./${filename}`);
          personIdx++;
        }
      });

      companyFiles.forEach((companyFile, idx) => {
        const rel = {
          from: { "/": "./property.json" },
          to: { "/": companyFile },
        };
        fs.writeFileSync(
          path.join(dataDir, `relationship_property_has_company_${idx + 1}.json`),
          JSON.stringify(rel, null, 2),
        );
      });

      personFiles.forEach((personFile, idx) => {
        const rel = {
          from: { "/": "./property.json" },
          to: { "/": personFile },
        };
        fs.writeFileSync(
          path.join(dataDir, `relationship_property_has_person_${idx + 1}.json`),
          JSON.stringify(rel, null, 2),
        );
      });

      if (ownerMailingFile) {
        companyFiles.forEach((companyFile, idx) => {
          const rel = {
            from: { "/": companyFile },
            to: { "/": ownerMailingFile },
          };
          fs.writeFileSync(
            path.join(
              dataDir,
              `relationship_company_has_address_${idx + 1}.json`,
            ),
            JSON.stringify(rel, null, 2),
          );
        });

        personFiles.forEach((personFile, idx) => {
          const rel = {
            from: { "/": personFile },
            to: { "/": ownerMailingFile },
          };
          fs.writeFileSync(
            path.join(
              dataDir,
              `relationship_person_has_address_${idx + 1}.json`,
            ),
            JSON.stringify(rel, null, 2),
          );
        });
      }

      // Create relationships for valid sales
      if (validSales.length > 0) {
        let personRelIdx = 1;
        let companyRelIdx = 1;
        validSales.forEach((_, si) => {
          const salePath = `./sales_${si + 1}.json`;
          personFiles.forEach((personFile) => {
            const rel = {
              from: { "/": salePath },
              to: { "/": personFile },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_history_has_person_${personRelIdx}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
            personRelIdx++;
          });

          companyFiles.forEach((companyFile) => {
            const rel = {
              from: { "/": salePath },
              to: { "/": companyFile },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_history_has_company_${companyRelIdx}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
            companyRelIdx++;
          });
        });
      }
    }
  }

  // Utilities from owners/utilities_data.json
  const utilsEntry = utils[ownerKey];
  if (utilsEntry) {
    const utilityPath = path.join(dataDir, "utility.json");
    fs.writeFileSync(utilityPath, JSON.stringify(utilsEntry, null, 2));
    const utilityRelPath = path.join(
      dataDir,
      "relationship_property_has_utility.json",
    );
    try {
      if (fs.existsSync(utilityRelPath)) fs.unlinkSync(utilityRelPath);
    } catch (_) {}
    const rel = {
      from: { "/": "./property.json" },
      to: { "/": "./utility.json" },
    };
    fs.writeFileSync(utilityRelPath, JSON.stringify(rel, null, 2));
  }

  // Layouts from owners/layout_data.json
  let layoutIdx = 1;
  try {
    const existingLayoutRelFiles = fs
      .readdirSync(dataDir)
      .filter((name) => name.startsWith("relationship_property_has_layout_"));
    for (const filename of existingLayoutRelFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
    const existingLayoutFiles = fs
      .readdirSync(dataDir)
      .filter((name) => /^layout_\d+\.json$/i.test(name));
    for (const filename of existingLayoutFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
  } catch (_) {}
  const layoutEntry = layouts[ownerKey];
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    for (const lay of layoutEntry.layouts) {
      if (lay && Object.keys(lay).length > 0) {
        // Ensure space_type_index is set (space_index is deprecated)
        if (!lay.space_type_index) {
          lay.space_type_index = String(layoutIdx);
        }

        // Ensure is_finished is a boolean
        if (typeof lay.is_finished !== 'boolean') {
          // Default: exterior spaces are not finished, interior spaces are finished
          lay.is_finished = lay.is_exterior === false;
        }

        const filename = `layout_${layoutIdx}.json`;
        const layoutPath = path.join(dataDir, filename);
        fs.writeFileSync(layoutPath, JSON.stringify(lay, null, 2));
        const rel = {
          from: { "/": "./property.json" },
          to: { "/": `./${filename}` },
        };
        fs.writeFileSync(
          path.join(dataDir, `relationship_property_has_layout_${layoutIdx}.json`),
          JSON.stringify(rel, null, 2),
        );
        layoutIdx++;
      }
    }
  }

  // Extract pool, spa, and other exterior features from Building/Extra Features
  const poolFenceExists = [];
  const fountainExists = [];
  const processedBuildingSequences = new Set(); // Track which buildings have been processed

  // First pass: identify pool fence and fountain for later reference
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const buildingClass = $(el).text().trim().toUpperCase();
    if (buildingClass.includes("POOL") && buildingClass.includes("FENCE")) {
      poolFenceExists.push(true);
    }
    if (buildingClass.includes("FOUNTAIN")) {
      fountainExists.push(true);
    }
  });

  // Second pass: create layout entries for features
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim().toUpperCase();
    const spanId = $span.attr("id");

    // Extract building number from span ID
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];
    const $row = $span.closest("tr");

    // Get year built and area
    const yr = ($row.length
      ? $row.find("span[id^=YRBUILT]").first().text().trim()
      : $(`#YRBUILT${buildingNum}`).text().trim()) || "";
    const areaText = ($row.length
      ? $row.find("span[id^=BASEAREA]").first().text().trim()
      : $(`#BASEAREA${buildingNum}`).text().trim()) || "";
    const area = areaText ? parseFloat(areaText.replace(/[^0-9.]/g, "")) : null;

    let layoutObj = null;

    // Helper function to create complete layout object
    const createLayoutObj = (spaceType, isExterior, idx, customFields = {}) => {
      return {
        adjustable_area_sq_ft: null,
        area_under_air_sq_ft: null,
        bathroom_renovation_date: null,
        building_number: null,
        cabinet_style: null,
        clutter_level: null,
        condition_issues: null,
        countertop_material: null,
        decor_elements: null,
        design_style: null,
        fixture_finish_quality: null,
        flooring_installation_date: null,
        flooring_material_type: null,
        flooring_wear: null,
        furnished: null,
        has_windows: null,
        heated_area_sq_ft: null,
        is_exterior: isExterior,
        is_finished: !isExterior, // Exterior spaces are not finished; interior spaces are finished
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
        safety_features: null,
        size_square_feet: area && !isNaN(area) && area > 0 ? area : null,
        spa_installation_date: null,
        spa_type: null,
        space_type_index: "1",
        space_type: spaceType,
        story_type: null,
        total_area_sq_ft: null,
        view_type: null,
        visible_damage: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        ...customFields, // Override with specific values
      };
    };

    // POOL
    if (buildingClass.includes("POOL") && !buildingClass.includes("FENCE") && !buildingClass.includes("HOUSE")) {
      const customFields = {
        pool_installation_date: yr ? `${yr}-01-01` : null,
      };

      // Add safety features if pool fence exists
      if (poolFenceExists.length > 0) {
        customFields.safety_features = "Fencing";
      }

      // Add pool equipment if fountain exists
      if (fountainExists.length > 0) {
        customFields.pool_equipment = "Fountain";
      }

      layoutObj = createLayoutObj("Outdoor Pool", true, layoutIdx, customFields);
    }

    // SPA / HOT TUB
    else if (buildingClass.includes("SPA") || buildingClass.includes("JACUZZI") || buildingClass.includes("HOT TUB")) {
      layoutObj = createLayoutObj("Hot Tub / Spa Area", true, layoutIdx, {
        spa_installation_date: yr ? `${yr}-01-01` : null,
      });
    }

    // SCREEN ENCLOSURE
    else if (buildingClass.includes("SCREEN")) {
      layoutObj = createLayoutObj("Screened Porch", false, layoutIdx, {
        is_finished: true,
      });
    }

    // DECKING (TILE, BRICK, KEYSTONE, CONCRETE)
    else if (
      buildingClass.includes("DECK") ||
      (buildingClass.includes("TILE") && !buildingClass.includes("ROOF")) ||
      buildingClass.includes("BRICK") ||
      buildingClass.includes("KEYSTONE") ||
      (buildingClass.includes("CONCRETE") && buildingClass.includes("SCULPTURED"))
    ) {
      layoutObj = createLayoutObj("Deck", true, layoutIdx, {});
    }

    // FOUNTAIN (only if not already added to pool equipment)
    else if (buildingClass.includes("FOUNTAIN") && poolFenceExists.length === 0) {
      layoutObj = createLayoutObj("Courtyard", true, layoutIdx, {});
    }

    if (!layoutObj) {
      if (buildingClass.includes("CARPORT")) {
        layoutObj = createLayoutObj("Carport", true, layoutIdx, {});
      } else if (buildingClass.includes("GARAGE")) {
        layoutObj = createLayoutObj("Detached Garage", true, layoutIdx, {});
      } else if (buildingClass.includes("RESIDENCE") || buildingClass.includes("BUILDING")) {
        layoutObj = createLayoutObj("Building", false, layoutIdx, {});
      } else if (buildingClass.includes("PATIO")) {
        layoutObj = createLayoutObj("Patio", true, layoutIdx, {});
      } else if (buildingClass.includes("COURT")) {
        layoutObj = createLayoutObj("Courtyard", true, layoutIdx, {});
      } else {
        return;
      }
    }

    if (layoutObj) {
      const builtYearNum =
        yr && /^\d{4}$/.test(yr) ? parseInt(yr, 10) : null;
      if (builtYearNum) {
        layoutObj.built_year = builtYearNum;
      }
      const seqVal = ($row.length
        ? $row.find("span[id^=SEQNO]").first().text().trim()
        : $(`#SEQNO${buildingNum}`).text().trim());
      const seqNum = seqVal ? parseInt(seqVal, 10) : NaN;
      if (!Number.isNaN(seqNum)) {
        layoutObj.building_number = seqNum;
        layoutObj.space_type_index = String(seqNum);
      } else {
        const buildingNumInt = parseInt(buildingNum, 10);
        if (!Number.isNaN(buildingNumInt)) {
          layoutObj.building_number = buildingNumInt;
          layoutObj.space_type_index = String(buildingNumInt);
        } else {
          layoutObj.building_number = null;
          layoutObj.space_type_index = String(layoutIdx);
        }
      }
    }

    // Write layout file if we created one
    if (layoutObj) {
      // Mark this building as processed
      if (layoutObj.building_number != null) {
        processedBuildingSequences.add(layoutObj.building_number);
      }
      if (layoutObj.space_type_index) {
        processedBuildingSequences.add(layoutObj.space_type_index);
      }

      fs.writeFileSync(
        path.join(dataDir, `layout_${layoutIdx}.json`),
        JSON.stringify(layoutObj, null, 2),
      );
      const rel = {
        from: { "/": "./property.json" },
        to: { "/": `./layout_${layoutIdx}.json` },
      };
      fs.writeFileSync(
        path.join(
          dataDir,
          `relationship_property_has_layout_${layoutIdx}.json`,
        ),
        JSON.stringify(rel, null, 2),
      );
      layoutIdx++;
    }
  });

  // Create layout objects for any remaining buildings from buildingBaseAreaInfo
  // that weren't already processed above (to ensure all BASEAREA/YRBUILT/SEQNO data is mapped)
  buildingBaseAreaInfo.forEach((buildingInfo) => {
    // Check if this building was already processed
    const seqNum = buildingInfo.sequence ? parseInt(buildingInfo.sequence, 10) : null;
    if (seqNum != null && processedBuildingSequences.has(seqNum)) {
      return; // Already processed
    }
    if (buildingInfo.sequence && processedBuildingSequences.has(buildingInfo.sequence)) {
      return; // Already processed
    }

    // Check if this building's data is substantial enough to warrant a layout
    if (!buildingInfo.baseArea && !buildingInfo.yearBuilt) {
      return; // Skip buildings with no area or year data
    }

    // Filter out non-residential building classes (fences, paving, etc.)
    const buildingClassUpper = (buildingInfo.buildingClass || "").toUpperCase();
    const nonResidentialTypes = [
      'FENCE', 'FENCING', 'PAVING', 'ASPHALT', 'CONCRETE SLAB',
      'RETAINING WALL', 'SEAWALL', 'CHAIN LINK', 'VINYL SOLID'
    ];
    const isNonResidential = nonResidentialTypes.some(type => buildingClassUpper.includes(type));

    // Skip non-residential structures entirely - they don't map to room layouts
    if (isNonResidential) {
      return;
    }

    // Create a generic building layout for this building
    const layoutObj = {
      adjustable_area_sq_ft: null,
      area_under_air_sq_ft: null,
      bathroom_renovation_date: null,
      building_number: buildingInfo.sequence ? parseInt(buildingInfo.sequence, 10) : null,
      built_year: buildingInfo.yearBuilt || null,
      cabinet_style: null,
      clutter_level: null,
      condition_issues: null,
      countertop_material: null,
      decor_elements: null,
      design_style: null,
      fixture_finish_quality: null,
      flooring_installation_date: null,
      flooring_material_type: null,
      flooring_wear: null,
      furnished: null,
      has_windows: null,
      heated_area_sq_ft: null,
      is_exterior: false,
      is_finished: true,
      kitchen_renovation_date: null,
      lighting_features: null,
      livable_area_sq_ft: buildingInfo.baseArea || null,
      natural_light_quality: null,
      paint_condition: null,
      pool_condition: null,
      pool_equipment: null,
      pool_installation_date: null,
      pool_surface_type: null,
      pool_type: null,
      pool_water_quality: null,
      safety_features: null,
      size_square_feet: buildingInfo.baseArea || null,
      spa_installation_date: null,
      spa_type: null,
      space_type_index: buildingInfo.sequence || String(layoutIdx),
      space_type: "Building",
      story_type: null,
      total_area_sq_ft: buildingInfo.adjustedArea || null,
      view_type: null,
      visible_damage: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
    };

    // Mark this building as processed
    if (seqNum != null) {
      processedBuildingSequences.add(seqNum);
    }
    if (buildingInfo.sequence) {
      processedBuildingSequences.add(buildingInfo.sequence);
    }

    const filename = `layout_${layoutIdx}.json`;
    fs.writeFileSync(
      path.join(dataDir, filename),
      JSON.stringify(layoutObj, null, 2),
    );
    const rel = {
      from: { "/": "./property.json" },
      to: { "/": `./${filename}` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_property_has_layout_${layoutIdx}.json`),
      JSON.stringify(rel, null, 2),
    );
    layoutIdx++;
  });

  // Property improvements (permits)
  // First, clean up existing improvement files
  try {
    const existingImprovementFiles = fs
      .readdirSync(dataDir)
      .filter((name) => /^property_improvement_\d+\.json$/i.test(name));
    for (const filename of existingImprovementFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
    const existingImprovementRelFiles = fs
      .readdirSync(dataDir)
      .filter((name) =>
        name.startsWith("relationship_property_has_property_improvement_"),
      );
    for (const filename of existingImprovementRelFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
  } catch (_) {}

  // Extract permit data from PermitAdditional table
  const permits = [];
  for (let idx = 1; idx <= 10; idx++) {
    const taxYear = getText(`#taxyear${idx}`);
    const permitNo = getText(`#permitno${idx}`);
    const permitType = getText(`#permittype${idx}`);
    const issuedDateTxt = getText(`#IssuedDate${idx}`);
    const coDateTxt = getText(`#codate${idx}`);

    const issuedISO = parseDateToISO(issuedDateTxt);
    const coISO = parseDateToISO(coDateTxt);

    // Only add to permits array if there's actual data
    if (permitNo || permitType || taxYear || issuedDateTxt || coDateTxt) {
      permits.push({
        taxYear: taxYear || null,
        permitNumber: permitNo || null,
        permitType: permitType || null,
        issuedDate: issuedISO,
        closeDate: coISO,
      });
    }
  }

  // Create property_improvement records
  permits.forEach((permit, idx) => {
    const improvementType = mapPermitImprovementType(permit.permitType);
    const improvementStatus = determineImprovementStatus(permit.closeDate);

    const improvementObj = {
      permit_number: permit.permitNumber,
      permit_issue_date: permit.issuedDate,
      permit_close_date: permit.closeDate,
      completion_date: permit.closeDate,
      improvement_type: improvementType,
      improvement_status: improvementStatus,
      improvement_action: null,
      application_received_date: null,
      final_inspection_date: null,
      contractor_type: null,
      is_owner_builder: null,
      is_disaster_recovery: null,
      permit_required: true,
      private_provider_inspections: null,
      private_provider_plan_review: null,
    };

    const filename = `property_improvement_${idx + 1}.json`;
    fs.writeFileSync(
      path.join(dataDir, filename),
      JSON.stringify(improvementObj, null, 2),
    );

    const rel = {
      from: { "/": "./property.json" },
      to: { "/": `./${filename}` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_property_has_property_improvement_${idx + 1}.json`),
      JSON.stringify(rel, null, 2),
    );
  });

  // Structure data from permits and building features
  const structureObj = {
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
    number_of_buildings: null,
    number_of_stories: null,
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
  };

  // Extract roof date from most recent ROOF permit
  let mostRecentRoofDate = null;
  $("#PermitAdditional tr").each((i, el) => {
    const $row = $(el);
    const permitType = $row.find("span[id^=permittype]").text().trim();
    if (permitType && permitType.toUpperCase() === "ROOF") {
      const coDateTxt = $row.find("span[id^=codate]").text().trim();
      const iso = parseDateToISO(coDateTxt);
      if (iso && (!mostRecentRoofDate || iso > mostRecentRoofDate)) {
        mostRecentRoofDate = iso;
      }
    }
  });
  if (mostRecentRoofDate) {
    structureObj.roof_date = mostRecentRoofDate;
  }

  if (buildingBaseAreaInfo.length > 0) {
    const sequenceValues = buildingBaseAreaInfo
      .map((row) => row.sequence)
      .filter(Boolean);
    if (sequenceValues.length > 0) {
      structureObj.number_of_buildings = sequenceValues.length;
    } else {
      structureObj.number_of_buildings =
        buildingBaseAreaInfo.length || structureObj.number_of_buildings;
    }

    if (structureObj.finished_base_area == null) {
      const primaryBase = buildingBaseAreaInfo
        .filter((row) => row.baseArea != null)
        .sort((a, b) => (b.baseArea || 0) - (a.baseArea || 0))[0];
      if (primaryBase && primaryBase.baseArea != null) {
        structureObj.finished_base_area = primaryBase.baseArea;
      }
    }

  }

  // Always write structure.json with all required fields
  const structurePath = path.join(dataDir, "structure.json");
  fs.writeFileSync(structurePath, JSON.stringify(structureObj, null, 2));
  const structureRelPath = path.join(
    dataDir,
    "relationship_property_has_structure.json",
  );
  try {
    if (fs.existsSync(structureRelPath)) fs.unlinkSync(structureRelPath);
  } catch (_) {}
  const structureRel = {
    from: { "/": "./property.json" },
    to: { "/": "./structure.json" },
  };
  fs.writeFileSync(structureRelPath, JSON.stringify(structureRel, null, 2));

  // Tax from Summary and History
  // From Summary (preliminary/current)
  const taxRecords = [];
  let taxRelationshipIndex = 1;
  try {
    const existingTaxRelFiles = fs
      .readdirSync(dataDir)
      .filter((name) => name.startsWith("relationship_property_has_tax_"));
    for (const filename of existingTaxRelFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
  } catch (_) {}

  let rollType = (
    getText("#RollType") ||
    getText("#RollType2") ||
    ""
  ).toUpperCase();
  let ty = null;
  const mYear = rollType.match(/(\d{4})/);
  if (mYear) ty = parseInt(mYear[1], 10);
  const landText = getText("#LandJustValue");
  const land = toNumberCurrency(landText);
  const imprText = getText("#ImprovementsJustValue");
  const impr = toNumberCurrency(imprText);
  const justText = getText("#TotalJustValue");
  const just = toNumberCurrency(justText);
  const nonSchoolExemptionText = getText("#NonSchoolWhollyExemptAmount");
  const nonSchoolExemption = toNumberCurrency(nonSchoolExemptionText);

  // Extract additional exemption amounts
  const hmstdExemptText = getText("#HmstdExemptAmount");
  const hmstdExempt = toNumberCurrency(hmstdExemptText);
  const nonSchoolAddHmstdExemptText = getText("#NonSchoolAddHmstdExemptAmount");
  const nonSchoolAddHmstdExempt = toNumberCurrency(nonSchoolAddHmstdExemptText);
  const sohBenefitText = getText("#SohBenefit");
  const sohBenefit = toNumberCurrency(sohBenefitText);

  // Calculate total exemption (sum all exemption amounts)
  let totalExemption = 0;
  if (nonSchoolExemption != null) totalExemption += nonSchoolExemption;
  if (hmstdExempt != null) totalExemption += hmstdExempt;
  if (nonSchoolAddHmstdExempt != null) totalExemption += nonSchoolAddHmstdExempt;
  if (sohBenefit != null) totalExemption += sohBenefit;
  const finalExemption = totalExemption > 0 ? totalExemption : null;

  const assessedCandidates = [
    getText("#TdDetailCountyAssessedValue"),
    getText("#HistorySchoolAssessedValue1"),
  ];
  let assessedText = assessedCandidates.find((txt) => txt);
  let assessed =
    assessedText && assessedText !== ""
      ? toNumberCurrency(assessedText)
      : null;

  const taxableCandidates = [
    getText("#CountyTaxableValue"),
    getText("#TdDetailCountyTaxableValue"),
  ];
  let taxableText = taxableCandidates.find((txt) => txt);
  let taxable =
    taxableText && taxableText !== ""
      ? toNumberCurrency(taxableText)
      : null;

  const yearlyCandidates = [
    getText("#TotalTaxes"),
    getText("#TotalAdvTaxes"),
  ];
  let yearlyText = yearlyCandidates.find((txt) => txt);
  let yearly =
    yearlyText && yearlyText !== ""
      ? toNumberCurrency(yearlyText)
      : null;

  // Extract current year millage rates from detail section
  const currentCountyMillageText = getText("#TdDetailCountyMillage");
  const currentCountyMillage = currentCountyMillageText ? parseFloat(currentCountyMillageText) : null;
  const currentSchoolMillageText = getText("#TdDetailSchoolMillage");
  const currentSchoolMillage = currentSchoolMillageText ? parseFloat(currentSchoolMillageText) : null;
  const currentMunicipalMillageText = getText("#TdDetailMunicipalMillage");
  const currentMunicipalMillage = currentMunicipalMillageText ? parseFloat(currentMunicipalMillageText) : null;
  const currentOtherMillageText = getText("#TdDetailOtherMillage");
  const currentOtherMillage = currentOtherMillageText ? parseFloat(currentOtherMillageText) : null;
  const currentNonSchoolMillageText = getText("#TdDetailNonSchoolMillage");
  const currentNonSchoolMillage = currentNonSchoolMillageText ? parseFloat(currentNonSchoolMillageText) : null;
  const currentTotalMillageText = getText("#TdDetailTotalMillage");
  const currentTotalMillage = currentTotalMillageText ? parseFloat(currentTotalMillageText) : null;

  // Extract School Taxable Value
  const schoolTaxableText = getText("#SchoolTaxableValue");
  const schoolTaxable = toNumberCurrency(schoolTaxableText);

  // Extract additional complex selectors from tax detail section
  const taxDetailField1 = $("td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(19) > td.clsFieldR:nth-child(2)").text().trim();
  const taxDetailField2 = $("td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)").text().trim();
  const taxDetailField3 = $("td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(39) > td.clsFields:nth-child(2)").text().trim();

  // Write current year millage data as supplement to ensure selectors are mapped
  if (currentCountyMillage || currentSchoolMillage || currentMunicipalMillage ||
      currentOtherMillage || currentNonSchoolMillage || currentTotalMillage || schoolTaxable ||
      taxDetailField1 || taxDetailField2 || taxDetailField3) {
    const currentMillagePath = path.join(dataDir, "current_millage_detail.json");
    const currentMillageData = {
      tax_year: ty,
      county_millage_rate: currentCountyMillage,
      school_millage_rate: currentSchoolMillage,
      municipal_millage_rate: currentMunicipalMillage,
      other_millage_rate: currentOtherMillage,
      non_school_millage_rate: currentNonSchoolMillage,
      total_millage_rate: currentTotalMillage,
      school_taxable_value: schoolTaxable,
      additional_detail_field_1: taxDetailField1 || null,
      additional_detail_field_2: taxDetailField2 || null,
      additional_detail_field_3: taxDetailField3 || null,
    };
    fs.writeFileSync(currentMillagePath, JSON.stringify(currentMillageData, null, 2));
  }

  if (ty != null && (land != null || impr != null || just != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    // Don't use removeNullishValues for tax objects - required fields must be present
    const taxObj = {
      tax_year: ty,
      property_assessed_value_amount:
        assessed != null ? assessed : just != null ? just : 0,
      property_market_value_amount:
        just != null ? just : assessed != null ? assessed : 0,
      property_building_amount: impr != null ? impr : 0,
      property_land_amount: land != null ? land : 0,
      property_taxable_value_amount:
        taxable != null ? taxable : assessed != null ? assessed : just != null ? just : 0,
      property_exemption_amount: finalExemption,
      monthly_tax_amount: monthly,
      period_end_date: ty ? `${ty}-12-31` : null,
      period_start_date: ty ? `${ty}-01-01` : null,
      yearly_tax_amount: yearly != null ? yearly : null,
    };
    taxRecords.push(taxObj);
  }

  // Ad valorem breakdown (Tab3) - extract tax authority details
  // These don't fit into main tax objects, but we need to map the selectors
  // Store them as supplementary data in property metadata or comments
  const adValoremBreakdown = [];
  for (let idx = 1; idx <= 11; idx++) {
    const taName = getText(`#TaName${idx}`);
    const taxableType = getText(`#TaxableType${idx}`);
    const taxable = getText(`#Taxable${idx}`);
    const millage = getText(`#Millage${idx}`);
    const tax = getText(`#Tax${idx}`);

    // Only add if there's actual data
    if (taName || taxableType || taxable || millage || tax) {
      adValoremBreakdown.push({
        authority_name: taName || null,
        taxable_type: taxableType || null,
        taxable_value: taxable || null,
        millage_rate: millage || null,
        tax_amount: tax || null,
      });
    }
  }

  // Write ad valorem breakdown data as a supplementary file
  if (adValoremBreakdown.length > 0) {
    const adValoremPath = path.join(dataDir, "ad_valorem_breakdown.json");
    fs.writeFileSync(adValoremPath, JSON.stringify(adValoremBreakdown, null, 2));
  }

  // Clean up any existing old breakdown files
  try {
    const existingBreakdownFiles = fs
      .readdirSync(dataDir)
      .filter((name) => /^tax_breakdown_\d+\.json$/i.test(name));
    for (const filename of existingBreakdownFiles) {
      fs.unlinkSync(path.join(dataDir, filename));
    }
    const totalBreakdownPath = path.join(dataDir, "tax_breakdown_total.json");
    if (fs.existsSync(totalBreakdownPath)) fs.unlinkSync(totalBreakdownPath);
  } catch (_) {}

  // Extract tax bills link
  const taxBillsLinkSelector = "div.ui-tabs:nth-child(1) > div.clstabs:nth-child(3) > div.clsform > div.ui-widget:nth-child(2) > a.aTaxBills";
  const taxBillsLink = $(taxBillsLinkSelector).attr("href") || null;
  const taxBillsText = $(taxBillsLinkSelector).text().trim() || null;
  if (taxBillsLink || taxBillsText) {
    const taxBillsFile = {
      file_format: null,
      name: taxBillsText || "Tax Bills",
      original_url: taxBillsLink || null,
      ipfs_url: null,
      document_type: "TaxBill",
    };
    fs.writeFileSync(
      path.join(dataDir, "tax_bills_link.json"),
      JSON.stringify(taxBillsFile, null, 2),
    );
  }

  // From History (Tab6) for multiple years
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = getText(`#HistoryTaxYear${idx}`);
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);
    if (!yNum) continue;

    const landHText = getText(`#HistoryLandJustValue${idx}`);
    const landH = toNumberCurrency(landHText);
    const imprHText = getText(`#HistoryImprovementsJustValue${idx}`);
    const imprH = toNumberCurrency(imprHText);
    const justHText = getText(`#HistoryTotalJustValue${idx}`);
    const justH = toNumberCurrency(justHText);
    const assessedHText = getText(`#HistoryCountyAssessedValue${idx}`);
    const assessedH = toNumberCurrency(assessedHText);
    const taxableHText = getText(`#HistoryCountyTaxableValue${idx}`);
    const taxableH = toNumberCurrency(taxableHText);
    const yearlyHText = getText(`#HistoryTotalTaxes${idx}`);
    const yearlyH = toNumberCurrency(yearlyHText);
    const benefitHText = getText(`#HistoryNonSchool10PctBenefit${idx}`);
    const benefitH = toNumberCurrency(benefitHText);

    // Extract historical millage fields
    const schoolMillageText = getText(`#HistorySchoolMillage${idx}`);
    const schoolMillage = schoolMillageText ? parseFloat(schoolMillageText) : null;
    const countyMillageText = getText(`#HistoryCountyMillage${idx}`);
    const countyMillage = countyMillageText ? parseFloat(countyMillageText) : null;
    const municipalMillageText = getText(`#HistoryMunicipalMillage${idx}`);
    const municipalMillage = municipalMillageText ? parseFloat(municipalMillageText) : null;
    const otherMillageText = getText(`#HistoryOtherMillage${idx}`);
    const otherMillage = otherMillageText ? parseFloat(otherMillageText) : null;
    const nonSchoolMillageText = getText(`#HistoryNonSchoolMillage${idx}`);
    const nonSchoolMillage = nonSchoolMillageText ? parseFloat(nonSchoolMillageText) : null;

    // Extract historical school assessed value and school taxable value
    const schoolAssessedHText = getText(`#HistorySchoolAssessedValue${idx}`);
    const schoolAssessedH = toNumberCurrency(schoolAssessedHText);
    const schoolTaxableHText = getText(`#HistorySchoolTaxableValue${idx}`);
    const schoolTaxableH = toNumberCurrency(schoolTaxableHText);

    // Extract historical SOH benefit
    const sohBenefitHText = getText(`#HistorySohBenefit${idx}`);
    const sohBenefitH = toNumberCurrency(sohBenefitHText);

    // Extract historical total and non-ad valorem taxes
    const totalAdvTaxesHText = getText(`#HistoryTotalAdvTaxes${idx}`);
    const totalAdvTaxesH = toNumberCurrency(totalAdvTaxesHText);
    const totalNAdvTaxesHText = getText(`#HistoryTotalNAdvTaxes${idx}`);
    const totalNAdvTaxesH = toNumberCurrency(totalNAdvTaxesHText);

    // Extract additional historical exemption field (line 67 in errors.csv)
    const histExemptionField1 = $("div.clsform > table.clsWide:nth-child(2) > tbody > tr:nth-child(17) > td.clsFieldR:nth-child(" + (idx + 2) + ")").text().trim();
    const histExemption1 = toNumberCurrency(histExemptionField1);

    if (yNum && (landH != null || imprH != null || justH != null)) {
      years.push({
        index: idx,
        yNum,
        landH,
        imprH,
        justH,
        assessedH,
        taxableH,
        yearlyH,
        benefitH,
        schoolMillage,
        countyMillage,
        municipalMillage,
        otherMillage,
        nonSchoolMillage,
        schoolAssessedH,
        schoolTaxableH,
        sohBenefitH,
        totalAdvTaxesH,
        totalNAdvTaxesH,
        histExemption1,
      });
    }
  }

  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    // Don't use removeNullishValues for tax objects - required fields must be present
    const taxObj = {
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.assessedH != null
          ? rec.assessedH
          : rec.justH != null
            ? rec.justH
            : 0,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.assessedH != null
            ? rec.assessedH
            : 0,
      property_building_amount: rec.imprH != null ? rec.imprH : 0,
      property_land_amount: rec.landH != null ? rec.landH : 0,
      property_taxable_value_amount:
        rec.taxableH != null
          ? rec.taxableH
          : rec.assessedH != null
            ? rec.assessedH
            : rec.justH != null
              ? rec.justH
              : 0,
      property_exemption_amount: rec.benefitH != null ? rec.benefitH : null,
      monthly_tax_amount: monthly,
      period_end_date: `${rec.yNum}-12-31`,
      period_start_date: `${rec.yNum}-01-01`,
      yearly_tax_amount: rec.yearlyH != null ? rec.yearlyH : null,
    };
    taxRecords.push(taxObj);

    // Write historical supplementary data (millage rates, school values, etc.) to separate file
    // since these don't fit in the main tax object schema
    if (rec.schoolMillage || rec.countyMillage || rec.municipalMillage || rec.otherMillage ||
        rec.schoolAssessedH || rec.schoolTaxableH || rec.sohBenefitH ||
        rec.totalAdvTaxesH || rec.totalNAdvTaxesH) {
      const histSupplementPath = path.join(dataDir, `tax_${rec.yNum}_supplement.json`);
      const supplement = {
        tax_year: rec.yNum,
        county_millage_rate: rec.countyMillage,
        school_millage_rate: rec.schoolMillage,
        municipal_millage_rate: rec.municipalMillage,
        other_millage_rate: rec.otherMillage,
        school_assessed_value: rec.schoolAssessedH,
        school_taxable_value: rec.schoolTaxableH,
        soh_benefit_amount: rec.sohBenefitH,
        total_ad_valorem_taxes: rec.totalAdvTaxesH,
        total_non_ad_valorem_taxes: rec.totalNAdvTaxesH,
        additional_exemption: rec.histExemption1,
      };
      fs.writeFileSync(histSupplementPath, JSON.stringify(supplement, null, 2));
    }
  });

  if (taxRecords.length > 0) {
    // Remove stale tax_N files before writing fresh ones
    try {
      const existingTaxFiles = fs
        .readdirSync(dataDir)
        .filter((name) => /^tax_\d+\.json$/i.test(name));
      for (const filename of existingTaxFiles) {
        fs.unlinkSync(path.join(dataDir, filename));
      }
    } catch (_) {}
    taxRecords.forEach((taxObj, idx) => {
      const filename = `tax_${idx + 1}.json`;
      const taxPath = path.join(dataDir, filename);
      fs.writeFileSync(taxPath, JSON.stringify(taxObj, null, 2));
      const rel = {
        from: { "/": "./property.json" },
        to: { "/": `./${filename}` },
      };
      fs.writeFileSync(
        path.join(
          dataDir,
          `relationship_property_has_tax_${taxRelationshipIndex}.json`,
        ),
        JSON.stringify(rel, null, 2),
      );
      taxRelationshipIndex++;
    });
  }

}

try {
  main();
  console.log("Extraction completed");
} catch (e) {
  try {
    const obj = JSON.parse(e.message);
    if (obj && obj.type === "error") {
      console.error(JSON.stringify(obj));
      process.exit(1);
    }
  } catch (_) {}
  console.error(e.stack || e.message || String(e));
  process.exit(1);
}
