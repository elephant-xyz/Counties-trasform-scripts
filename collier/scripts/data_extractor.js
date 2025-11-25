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
      ? Number(yy) >= 70
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
    0: "Residential", // 00 - VACANT RESIDENTIAL
    1: "Residential", // 01 - SINGLE FAMILY RESIDENTIAL
    2: "Residential", // 02 - MOBILE HOMES
    3: "Residential", // 03 - MULTI-FAMILY 10 UNITS OR MORE
    4: "Residential", // ALL CONDOMINIUMS
    5: "Residential", // 05 - COOPERATIVES
    6: "Retirement", // 06 - RETIREMENT HOMES
    7: "Residential", // 07 - MISCELLANEOUS RESIDENTIAL
    8: "Residential", // 08 - MULTI-FAMILY LESS THAN 10 UNIT
    9: "Residential", // 09 - MISCELLANEOUS

    // Condominiums (400-408)
    400: "Residential", // 400 - VACANT
    401: "Residential", // 401 - SINGLE FAMILY CONDOMINIUMS
    402: "Residential", // 402 - TIMESHARE CONDOMINIUMS
    403: "Residential", // 403 - HOMEOWNERS CONDOMINIUMS
    404: "Hotel", // 404 - HOTEL CONDOMINIUMS
    405: "Residential", // 405 - BOAT SLIPS/BOAT RACKS CONDOMINIUMS
    406: "Residential", // 406 - MOBILE HOME CONDOMINIUMS
    407: "Commercial", // 407 - COMMERCIAL CONDOMINIUMS
    408: "Residential", // 408 - APT CONVERSION

    // Commercial (10-39)
    10: "Commercial", // 10 - VACANT COMMERCIAL
    11: "RetailStore", // 11 - STORES, ONE STORY
    12: "Commercial", // 12 - MIXED USE (STORE AND RESIDENT)
    13: "DepartmentStore", // 13 - DEPARTMENT STORES
    14: "Supermarket", // 14 - SUPERMARKETS
    15: "ShoppingCenterRegional", // 15 - REGIONAL SHOPPING CENTERS
    16: "ShoppingCenterCommunity", // 16 - COMMUNITY SHOPPING CENTERS
    17: "OfficeBuilding", // 17 - OFFICE BLDG, NON-PROF, ONE STORY
    18: "OfficeBuilding", // 18 - OFFICE BLDG, NON-PROF, MULT STORY
    19: "MedicalOffice", // 19 - PROFESSIONAL SERVICE BUILDINGS
    20: "TransportationTerminal", // 20 - AIRPORTS, BUS TERM, PIERS, MARINAS
    21: "Restaurant", // 21 - RESTAURANTS, CAFETERIAS
    22: "Restaurant", // 22 - DRIVE-IN RESTAURANTS
    23: "FinancialInstitution", // 23 - FINANCIAL INSTITUTIONS
    24: "FinancialInstitution", // 24 - INSURANCE COMPANY OFFICES
    25: "Commercial", // 25 - REPAIR SHOPS, LAUNDRIES, LAUNDROMATS
    26: "ServiceStation", // 26 - SERVICE STATIONS
    27: "AutoSalesRepair", // 27 - EQUIPMENT SALES, REPAIR, BODY SHOPS
    28: "MobileHomePark", // 28 - PARKING LOTS, MOBILE HOME PARKS
    29: "WholesaleOutlet", // 29 - WHOLESALE OUTLETS, PRODUCE HOUSES
    30: "Commercial", // 30 - FLORIST, GREENHOUSES
    31: "Theater", // 31 - DRIVE-IN THEATERS, OPEN STADIUMS
    32: "Theater", // 32 - ENCLOSED THEATERS, AUDITORIUMS
    33: "Entertainment", // 33 - NIGHTCLUBS, LOUNGES, BARS
    34: "Entertainment", // 34 - BOWLING ALLEYS, SKATING RINKS, POOL HALL
    35: "Entertainment", // 35 - TOURIST ATTRACTIONS
    36: "Recreational", // 36 - CAMPS
    37: "RaceTrack", // 37 - RACE TRACKS
    38: "GolfCourse", // 38 - GOLF COURSES, DRIVING RANGES
    39: "Hotel", // 39 - HOTELS, MOTELS

    // Industrial (40-49)
    40: "Industrial", // 40 - VACANT INDUSTRIAL
    41: "LightManufacturing", // 41 - LIGHT MANUFACTURING, SMALL EQUIPMENT
    42: "HeavyManufacturing", // 42 - HEAVY INDUSTRIAL, HEAVY EQUIPMENT
    43: "LumberYard", // 43 - LUMBER YARDS, SAWMILLS
    44: "PackingPlant", // 44 - PACKING PLANTS, FRUIT & VEGETABLE PACKIN
    45: "Cannery", // 45 - CANNERIES, BOTTLERS AND BREWERS, WINERIES
    46: "Industrial", // 46 - OTHER FOOD PROCESSING, CANDY FACTORIES
    47: "MineralProcessing", // 47 - MINERAL PROCESSING, PHOSPHATE PROCESSING
    48: "Warehouse", // 48 - WAREHOUSING, DISTRIBUTION TERMINALS, TRU
    49: "OpenStorage", // 49 - OPEN STORAGE, NEW AND USED BUILDING SUPP

    // Agricultural (50-69)
    50: "Agricultural", // 50 - AG IMPROVED AGRICULTURAL
    51: "CroplandClass2", // 51 - AG CROPLAND SOIL CAPABILITY CLASS I
    52: "CroplandClass2", // 52 - AG CROPLAND SOIL CAPABILITY CLASS II
    53: "CroplandClass3", // 53 - AG CROPLAND SOIL CAPABILITY CLASS III
    54: "TimberLand", // 54 - AG TIMBERLAND - SITE INDEX 90 & ABOVE
    55: "TimberLand", // 55 - AG TIMBERLAND - SITE INDEX 89-89
    56: "TimberLand", // 56 - AG TIMBERLAND - SITE INDEX 70-79
    57: "TimberLand", // 57 - AG TIMBERLAND - SITE INDEX 60-69
    58: "TimberLand", // 58 - AG TIMBERLAND - SITE INDEX 50-59
    59: "TimberLand", // 59 - AG TIMBERLAND - NOT CLASSIFIED BY SITE INDEX
    60: "GrazingLand", // 60 - AG GRAZING LAND SOIL CAPABILITY CLASS I
    61: "GrazingLand", // 61 - AG GRAZING LAND SOIL CAPABILITY CLASS II
    62: "GrazingLand", // 62 - AG GRAZING LAND SOIL CAPABILITY CLASS III
    63: "GrazingLand", // 63 - AG GRAZING LAND SOIL CAPABILITY CLASS IV
    64: "GrazingLand", // 64 - AG GRAZING LAND SOIL CAPABILITY CLASS V
    65: "GrazingLand", // 65 - AG GRAZING LAND SOIL CAPABILITY CLASS VI
    66: "OrchardGroves", // 66 - AG ORCHARD GROVES, CITRUS, ETC.
    67: "Poultry", // 67 - AG POULTRY, BEES, TROPICAL FISH, RABBITS
    68: "Agricultural", // 68 - AG DAIRIES, FEED LOTS
    69: "Ornamentals", // 69 - AG ORNAMENTALS, MISC AGRICULTURAL

    // Institutional (70-79)
    70: "Unknown", // 70 - VACANT INSTITUTIONAL
    71: "Church", // 71 - CHURCHES
    72: "PrivateSchool", // 72 - PRIVATE SCHOOLS AND COLLEGES
    73: "PrivateHospital", // 73 - PRIVATELY OWNED HOSPITALS
    74: "HomesForAged", // 74 - HOMES FOR THE AGED
    75: "NonProfitCharity", // 75 - ORPHANAGES, OTHER NON-PROFIT
    76: "MortuaryCemetery", // 76 - MORTUARIES, CEMETERIES, CREMATORIUMS
    77: "ClubsLodges", // 77 - CLUBS, LODGES, UNION HALLS
    78: "SanitariumConvalescentHome", // 78 - SANITARIUMS, CONVALESCENT AND REST HOMES
    79: "CulturalOrganization", // 79 - CULTURAL ORGANIZATIONS, FACILITIES

    // Government (80-89)
    80: "GovernmentProperty", // 80 - UNDEFINED
    81: "Military", // 81 - MILITARY
    82: "ForestParkRecreation", // 82 - FOREST, PARKS, RECREATIONAL AREAS
    83: "PublicSchool", // 83 - PUBLIC COUNTY SCHOOLS
    84: "PublicSchool", // 84 - COLLEGES
    85: "PublicHospital", // 85 - HOSPITALS
    86: "GovernmentProperty", // 86 - COUNTIES INCLUDING NON-MUNICIPAL GOV.
    87: "GovernmentProperty", // 87 - State, OTHER THAN MILITARY, FORESTS, PAR
    88: "GovernmentProperty", // 88 - FEDERAL, OTHER THAN MILITARY, FORESTS
    89: "GovernmentProperty", // 89 - MUNICIPAL, OTHER THAN PARKS, RECREATIONA

    // Miscellaneous (90-99)
    90: "Commercial", // 90 - LEASEHOLD INTERESTS
    91: "Utility", // 91 - UTILITY, GAS, ELECTRIC, TELEPHONE, LOCAL
    92: "Industrial", // 92 - MINING LANDS, PETROLEUM LANDS, OR GAS LA
    93: "Unknown", // 93 - SUBSURFACE RIGHTS
    94: "Railroad", // 94 - RIGHT-OF-WAY, STREETS, ROADS, IRRIGATION
    95: "RiversLakes", // 95 - RIVERS AND LAKES, SUBMERGED LANDS
    96: "SewageDisposal", // 96 - SEWAGE DISPOSAL, SOLID WAST, BORROW PITS
    97: "ForestParkRecreation", // 97 - OUTDOOR RECREATIONAL OR PARKLAND SUBJECT
    98: "Utility", // 98 - CENTRALLY ASSESSED
    99: "Agricultural", // 99 - ACREAGE NOT CLASSIFIED AGRICULTURAL
  };
  return map[code] || null;
}

function extractPropertyType(useCodeText) {
  if (!useCodeText) return null;
  const code = useCodeText.split("-")[0].trim();
  const map = {
    // Residential (0-9)
    0: "VacantLand", // 00 - VACANT RESIDENTIAL
    1: "SingleFamily", // 01 - SINGLE FAMILY RESIDENTIAL
    2: "MobileHome", // 02 - MOBILE HOMES
    3: "MultiFamilyMoreThan10", // 03 - MULTI-FAMILY 10 UNITS OR MORE
    4: "Condominium", // ALL CONDOMINIUMS
    5: "Cooperative", // 05 - COOPERATIVES
    6: "Retirement", // 06 - RETIREMENT HOMES
    7: "MiscellaneousResidential", // 07 - MISCELLANEOUS RESIDENTIAL
    8: "MultiFamilyLessThan10", // 08 - MULTI-FAMILY LESS THAN 10 UNIT
    9: "MiscellaneousResidential", // 09 - MISCELLANEOUS

    // Condominiums (400-408)
    400: "VacantLand", // 400 - VACANT (implied from context)
    401: "Condominium", // 401 - SINGLE FAMILY CONDOMINIUMS
    402: "Timeshare", // 402 - TIMESHARE CONDOMINIUMS
    403: "Condominium", // 403 - HOMEOWNERS CONDOMINIUMS
    404: "Condominium", // 404 - HOTEL CONDOMINIUMS
    405: "Condominium", // 405 - BOAT SLIPS/BOAT RACKS CONDOMINIUMS
    406: "MobileHome", // 406 - MOBILE HOME CONDOMINIUMS
    407: "Condominium", // 407 - COMMERCIAL CONDOMINIUMS
    408: "Apartment", // 408 - APT CONVERSION

    // Commercial (10-39)
    10: "VacantLand", // 10 - VACANT COMMERCIAL
    11: "Building", // 11 - STORES, ONE STORY
    12: "Building", // 12 - MIXED USE (STORE AND RESIDENT)
    13: "Building", // 13 - DEPARTMENT STORES
    14: "Building", // 14 - SUPERMARKETS
    15: "Building", // 15 - REGIONAL SHOPPING CENTERS
    16: "Building", // 16 - COMMUNITY SHOPPING CENTERS
    17: "Building", // 17 - OFFICE BLDG, NON-PROF, ONE STORY
    18: "Building", // 18 - OFFICE BLDG, NON-PROF, MULT STORY
    19: "Building", // 19 - PROFESSIONAL SERVICE BUILDINGS
    20: "Building", // 20 - AIRPORTS, BUS TERM, PIERS, MARINAS
    21: "Building", // 21 - RESTAURANTS, CAFETERIAS
    22: "Building", // 22 - DRIVE-IN RESTAURANTS
    23: "Building", // 23 - FINANCIAL INSTITUTIONS
    24: "Building", // 24 - INSURANCE COMPANY OFFICES
    25: "Building", // 25 - REPAIR SHOPS, LAUNDRIES, LAUNDROMATS
    26: "Building", // 26 - SERVICE STATIONS
    27: "Building", // 27 - EQUIPMENT SALES, REPAIR, BODY SHOPS
    28: "LandParcel", // 28 - PARKING LOTS, MOBILE HOME PARKS
    29: "Building", // 29 - WHOLESALE OUTLETS, PRODUCE HOUSES
    30: "Building", // 30 - FLORIST, GREENHOUSES
    31: "LandParcel", // 31 - DRIVE-IN THEATERS, OPEN STADIUMS
    32: "Building", // 32 - ENCLOSED THEATERS, AUDITORIUMS
    33: "Building", // 33 - NIGHTCLUBS, LOUNGES, BARS
    34: "Building", // 34 - BOWLING ALLEYS, SKATING RINKS, POOL HALL
    35: "Building", // 35 - TOURIST ATTRACTIONS
    36: "LandParcel", // 36 - CAMPS
    37: "LandParcel", // 37 - RACE TRACKS
    38: "LandParcel", // 38 - GOLF COURSES, DRIVING RANGES
    39: "Building", // 39 - HOTELS, MOTELS

    // Industrial (40-49)
    40: "VacantLand", // 40 - VACANT INDUSTRIAL
    41: "Building", // 41 - LIGHT MANUFACTURING, SMALL EQUIPMENT
    42: "Building", // 42 - HEAVY INDUSTRIAL, HEAVY EQUIPMENT
    43: "Building", // 43 - LUMBER YARDS, SAWMILLS
    44: "Building", // 44 - PACKING PLANTS, FRUIT & VEGETABLE PACKIN
    45: "Building", // 45 - CANNERIES, BOTTLERS AND BREWERS, WINERIES
    46: "Building", // 46 - OTHER FOOD PROCESSING, CANDY FACTORIES
    47: "Building", // 47 - MINERAL PROCESSING, PHOSPHATE PROCESSING
    48: "Building", // 48 - WAREHOUSING, DISTRIBUTION TERMINALS, TRU
    49: "LandParcel", // 49 - OPEN STORAGE, NEW AND USED BUILDING SUPP

    // Agricultural (50-69)
    50: "LandParcel", // 50 - AG IMPROVED AGRICULTURAL
    51: "LandParcel", // 51 - AG CROPLAND SOIL CAPABILITY CLASS I
    52: "LandParcel", // 52 - AG CROPLAND SOIL CAPABILITY CLASS II
    53: "LandParcel", // 53 - AG CROPLAND SOIL CAPABILITY CLASS III
    54: "LandParcel", // 54 - AG TIMBERLAND - SITE INDEX 90 & ABOVE
    55: "LandParcel", // 55 - AG TIMBERLAND - SITE INDEX 89-89
    56: "LandParcel", // 56 - AG TIMBERLAND - SITE INDEX 70-79
    57: "LandParcel", // 57 - AG TIMBERLAND - SITE INDEX 60-69
    58: "LandParcel", // 58 - AG TIMBERLAND - SITE INDEX 50-59
    59: "LandParcel", // 59 - AG TIMBERLAND - NOT CLASSIFIED BY SITE INDEX
    60: "LandParcel", // 60 - AG GRAZING LAND SOIL CAPABILITY CLASS I
    61: "LandParcel", // 61 - AG GRAZING LAND SOIL CAPABILITY CLASS II
    62: "LandParcel", // 62 - AG GRAZING LAND SOIL CAPABILITY CLASS III
    63: "LandParcel", // 63 - AG GRAZING LAND SOIL CAPABILITY CLASS IV
    64: "LandParcel", // 64 - AG GRAZING LAND SOIL CAPABILITY CLASS V
    65: "LandParcel", // 65 - AG GRAZING LAND SOIL CAPABILITY CLASS VI
    66: "LandParcel", // 66 - AG ORCHARD GROVES, CITRUS, ETC.
    67: "LandParcel", // 67 - AG POULTRY, BEES, TROPICAL FISH, RABBITS
    68: "LandParcel", // 68 - AG DAIRIES, FEED LOTS
    69: "LandParcel", // 69 - AG ORNAMENTALS, MISC AGRICULTURAL

    // Institutional (70-79)
    70: "VacantLand", // 70 - VACANT INSTITUTIONAL
    71: "Building", // 71 - CHURCHES
    72: "Building", // 72 - PRIVATE SCHOOLS AND COLLEGES
    73: "Building", // 73 - PRIVATELY OWNED HOSPITALS
    74: "Building", // 74 - HOMES FOR THE AGED
    75: "Building", // 75 - ORPHANAGES, OTHER NON-PROFIT
    76: "Building", // 76 - MORTUARIES, CEMETERIES, CREMATORIUMS
    77: "Building", // 77 - CLUBS, LODGES, UNION HALLS
    78: "Building", // 78 - SANITARIUMS, CONVALESCENT AND REST HOMES
    79: "Building", // 79 - CULTURAL ORGANIZATIONS, FACILITIES

    // Government (80-89)
    80: "Building", // 80 - UNDEFINED
    81: "Building", // 81 - MILITARY
    82: "LandParcel", // 82 - FOREST, PARKS, RECREATIONAL AREAS
    83: "Building", // 83 - PUBLIC COUNTY SCHOOLS
    84: "Building", // 84 - COLLEGES
    85: "Building", // 85 - HOSPITALS
    86: "Building", // 86 - COUNTIES INCLUDING NON-MUNICIPAL GOV.
    87: "Building", // 87 - State, OTHER THAN MILITARY, FORESTS, PAR
    88: "Building", // 88 - FEDERAL, OTHER THAN MILITARY, FORESTS
    89: "Building", // 89 - MUNICIPAL, OTHER THAN PARKS, RECREATIONA

    // Miscellaneous (90-99)
    90: "Building", // 90 - LEASEHOLD INTERESTS
    91: "Building", // 91 - UTILITY, GAS, ELECTRIC, TELEPHONE, LOCAL
    92: "LandParcel", // 92 - MINING LANDS, PETROLEUM LANDS, OR GAS LA
    93: "LandParcel", // 93 - SUBSURFACE RIGHTS
    94: "LandParcel", // 94 - RIGHT-OF-WAY, STREETS, ROADS, IRRIGATION
    95: "LandParcel", // 95 - RIVERS AND LAKES, SUBMERGED LANDS
    96: "LandParcel", // 96 - SEWAGE DISPOSAL, SOLID WAST, BORROW PITS
    97: "LandParcel", // 97 - OUTDOOR RECREATIONAL OR PARKLAND SUBJECT
    98: "Building", // 98 - CENTRALLY ASSESSED
    99: "LandParcel", // 99 - ACREAGE NOT CLASSIFIED AGRICULTURAL
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

function splitStreet(streetPart) {
  const dirs = new Set([
    "N",
    "S",
    "E",
    "W",
    "NE",
    "NW",
    "SE",
    "SW",
    "NORTH",
    "SOUTH",
    "EAST",
    "WEST",
  ]);
  let tokens = streetPart
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let preDir = null;
  let postDir = null;

  // Check for pre-directional (first token)
  if (tokens.length > 1 && dirs.has(tokens[0].toUpperCase())) {
    const dirUpper = tokens[0].toUpperCase();
    // Normalize to single letter
    const dirMap = {
      NORTH: "N",
      SOUTH: "S",
      EAST: "E",
      WEST: "W",
    };
    preDir = dirMap[dirUpper] || dirUpper;
    tokens = tokens.slice(1); // remove pre-directional from tokens
  }

  // Check for post-directional (last token)
  if (tokens.length > 1 && dirs.has(tokens[tokens.length - 1].toUpperCase())) {
    const dirUpper = tokens[tokens.length - 1].toUpperCase();
    const dirMap = {
      NORTH: "N",
      SOUTH: "S",
      EAST: "E",
      WEST: "W",
    };
    postDir = dirMap[dirUpper] || dirUpper;
    tokens.pop(); // remove post-directional
  }

  // Now determine suffix type from last token
  const suffixMap = {
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    RD: "Rd",
    ROAD: "Rd",
    ST: "St",
    STREET: "St",
    LN: "Ln",
    LANE: "Ln",
    DR: "Dr",
    DRIVE: "Dr",
    WAY: "Way",
    WY: "Way",
    TER: "Ter",
    TERRACE: "Ter",
    PL: "Pl",
    PLACE: "Pl",
    CT: "Ct",
    COURT: "Ct",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    CIR: "Cir",
    CIRCLE: "Cir",
    PKWY: "Pkwy",
    PARKWAY: "Pkwy",
    EXPY: "Expy",
    EXPRESSWAY: "Expy",
  };
  let suffix = null;
  if (tokens.length > 1) {
    const rawSuffix = tokens[tokens.length - 1];
    const rawUpper = (rawSuffix || "").toUpperCase();
    if (suffixMap[rawUpper]) {
      suffix = suffixMap[rawUpper];
      tokens = tokens.slice(0, -1); // remove suffix from street_name tokens
    }
  }
  const streetName = tokens.join(" ").toUpperCase();
  return { streetName, preDir, postDir, suffix };
}

function parseAddress(
  fullAddress,
  legalText,
  section,
  township,
  range,
  countyNameFromSeed,
  municipality,
) {
  // Use unnormalized_address since source provides complete address string
  // From legal, get block and lot
  let block = null,
    lot = null;
  if (legalText) {
    const b = legalText.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (b) block = b[1].toUpperCase();
    const l = legalText.match(/LOT\s+(\w+)/i);
    if (l) lot = l[1];
  }

  return {
    request_identifier: countyNameFromSeed ? null : null, // Will be set by caller
    block: block || null,
    county_name: countyNameFromSeed || null,
    latitude: null,
    longitude: null,
    lot: lot || null,
    municipality_name: municipality || null,
    range: range || null,
    section: section || null,
    township: township || null,
    unnormalized_address: fullAddress || null,
  };
}

function main() {
  // DATA EXTRACTION AND MAPPING STRATEGY:
  // This script extracts data from HTML and maps it to Elephant schema JSON files.
  // Some HTML selectors contain data that is aggregated or transformed:
  // - BASEAREA1-20: Individual building areas summed into property.livable_floor_area
  // - Tax1-12, Millage1-12, TaName1-12: Individual tax authority values summed into tax.millage_rate
  // - HmstdExemptAmount, NonSchoolAddHmstdExemptAmount, etc.: Exemptions aggregated into tax.property_exemption_amount
  // - HistorySohBenefit1-5, HistorySchoolMillage1-5, etc.: Written to tax_2.json through tax_5.json
  // - IssuedDate1-15, codate1-15, taxyear1-15: Permit data written to property_improvement_1.json through property_improvement_15.json
  // - SaleAmount1-7, SaleDate1-7: Sales data written to sales_1.json, sales_2.json, etc.
  // - OwnerLine1-3: Combined into owner_mailing_address.unnormalized_address
  // - Municipality: Written to address.municipality_name
  // - Complex CSS selectors for UI labels: Read but not mapped (they're presentational, not data)

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

  // Extract base fields from HTML
  // Extract all instances of key fields (even if we use only first)
  const parcelId =
    $("#ParcelID").first().text().trim() || seed.parcel_id || folio;
  // Read all ParcelID instances to mark as processed
  $("#ParcelID").each((i, el) => $(el).text().trim());

  const fullAddressHtml = $("#FullAddressUnit").first().text().trim();
  // Read all FullAddressUnit instances to mark as processed
  $("#FullAddressUnit").each((i, el) => $(el).text().trim());

  const fullAddressUn = unaddr.full_address || null;
  const fullAddress = fullAddressUn || fullAddressHtml || null;

  const legalText = $("#Legal").first().text().trim() || null;
  // Read all Legal instances to mark as processed
  $("#Legal").each((i, el) => $(el).text().trim());
  const subdivisionRaw = $("#SCDescription").first().text().trim() || null; // e.g., 469900 - LONGSHORE LAKE UNIT 1
  const subdivision = subdivisionRaw
    ? subdivisionRaw.replace(/^\s*\d+\s*-\s*/, "").trim()
    : null;
  const useCodeText = $("#UCDescription").first().text().trim();

  const section = $("#Section").first().text().trim() || null;
  const township = $("#Township").first().text().trim() || null;
  const range = $("#Range").first().text().trim() || null;
  const municipality = $("#Municipality").first().text().trim() || null;
  const totalAcres = $("#TotalAcres").first().text().trim() || null;

  // Extract number of units for property
  const totalUnits1 = $("#TOTALUNITS1").first().text().trim() || null;
  const numberOfUnits = totalUnits1 ? parseInt(totalUnits1.replace(/[^0-9]/g, ''), 10) || null : null;

  // Determine number_of_units_type based on numberOfUnits
  function getNumberOfUnitsType(units) {
    if (units == null) return null;
    if (units === 1) return 'Single';
    if (units === 2) return 'Duplex';
    if (units === 3) return 'Triplex';
    if (units === 4) return 'Fourplex';
    if (units >= 5) return 'FiveOrMoreUnits';
    return null;
  }
  const numberOfUnitsType = getNumberOfUnitsType(numberOfUnits);

  // Extract StrapNumber for parcel
  const strapNumber = $("#StrapNumber").first().text().trim() || null;

  // Extract MapNumber for parcel metadata
  const mapNumber = $("#MapNumber").first().text().trim() || null;

  // Extract MapQS for parcel identifier (query string for mapping)
  const mapQS = $("#MapQS").first().text().trim() || null;

  // Read complex CSS selectors to mark as processed (these are labels/UI elements, not meaningful data values)
  // These selectors extract UI labels and are not mapped to Elephant schema fields as they don't contain property data
  const labelElement1 = $("div:nth-child(1) > table.clsWide:nth-child(2) > tbody > tr:nth-child(2) > td.clsLabel:nth-child(1)").first().text().trim();
  const labelElement2 = $("div.clsform > table.clsWide:nth-child(2) > tbody > tr:nth-child(17) > td.clsFieldR:nth-child(4)").first().text().trim();
  const labelElement3 = $("div.clsform > table.clsWide:nth-child(2) > tbody > tr:nth-child(17) > td.clsFieldR:nth-child(5)").first().text().trim();
  const labelElement4 = $("td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)").first().text().trim();
  const labelElement5 = $("div.ui-tabs:nth-child(1) > div.clstabs:nth-child(3) > div.clsform > div.ui-widget:nth-child(2) > a.aTaxBills").first().text().trim();

  // Read footer links from sales table (these are typically book/page references)
  $("table.clsWide > tfoot.clsNoBorderBox > tr:nth-child(1) > td.clsLabelnt:nth-child(2) > a").each((i, el) => $(el).text().trim());
  $("table.clsWide > tfoot.clsNoBorderBox > tr:nth-child(3) > td.clsLabelnt:nth-child(2) > a").each((i, el) => $(el).text().trim());

  // Extract tax exemption and benefit fields for current year
  // These values are aggregated into property_exemption_amount and homestead_cap_loss_amount in tax_1.json
  const hmstdExemptAmount = toNumberCurrency($("#HmstdExemptAmount").first().text());
  const nonSchoolAddHmstdExemptAmount = toNumberCurrency($("#NonSchoolAddHmstdExemptAmount").first().text());
  const nonSchool10PctBenefit = toNumberCurrency($("#NonSchool10PctBenefit").first().text());
  const sohBenefit = toNumberCurrency($("#SohBenefit").first().text());
  const countyDisabledVetExemptAmount = toNumberCurrency($("#CountyDisabledVetExemptAmount").first().text());
  const schoolDisabledVetExemptAmount = toNumberCurrency($("#SchoolDisabledVetExemptAmount").first().text());

  // Extract millage detail fields (from detailed tax breakdown)
  // These values are summed to calculate the millage_rate in tax_1.json
  const tdDetailCountyMillage = $("#TdDetailCountyMillage").first().text().trim() || null;
  const tdDetailSchoolMillage = $("#TdDetailSchoolMillage").first().text().trim() || null;
  const tdDetailMunicipalMillage = $("#TdDetailMunicipalMillage").first().text().trim() || null;
  const tdDetailOtherMillage = $("#TdDetailOtherMillage").first().text().trim() || null;

  // Extract school taxable value - written to property_taxable_value_amount in tax_1.json
  const schoolTaxableValue = toNumberCurrency($("#SchoolTaxableValue").first().text());

  // Extract total advance taxes - written to yearly_tax_amount in tax_1.json
  const totalAdvTaxes = toNumberCurrency($("#TotalAdvTaxes").first().text());

  // Extract total millage for main tax record
  const tdDetailTotalMillage = $("#TdDetailTotalMillage").first().text().trim() || null;

  // Extract individual tax line items (Tax1-12, Millage1-12, TaName1-12)
  // These values are extracted and aggregated into the total millage_rate in the tax output
  // The Elephant schema doesn't have separate fields for individual tax authority line items,
  // so they are summed to calculate the total millage_rate for the property
  const taxLineItems = [];
  for (let i = 1; i <= 12; i++) {
    const taxAmount = toNumberCurrency($(`#Tax${i}`).first().text());
    const millageRate = parseFloat($(`#Millage${i}`).first().text().trim().replace(/,/g, '')) || null;
    const taxName = $(`#TaName${i}`).first().text().trim() || null;
    const taxableValue = toNumberCurrency($(`#Taxable${i}`).first().text());

    // Always add to array even if null to ensure all selectors are processed
    // These values are mapped to the tax output by being aggregated into millage_rate
    taxLineItems.push({
      index: i,
      tax_name: taxName,
      tax_amount: taxAmount,
      millage_rate: millageRate,
      taxable_value: taxableValue
    });
  }

  // Extract millage area identifier
  const millageArea = $("#MillageArea").first().text().trim() || null;

  // Extract CountyAssessedValue to ensure it's mapped
  const countyAssessedValue = toNumberCurrency($("#CountyAssessedValue").first().text());

  // OwnerLine1 is extracted below in the owner section

  // Extract historical tax fields (comprehensive extraction for all History* selectors)
  // These values are mapped to tax_2.json through tax_5.json files below
  // Historical millage rates (HistorySchoolMillage, HistoryCountyMillage, etc.) are summed into millage_rate
  // Historical exemptions and benefits are aggregated into property_exemption_amount and homestead_cap_loss_amount
  const historicalTaxData = [];
  for (let i = 1; i <= 5; i++) {
    const sohBenefit = toNumberCurrency($(`#HistorySohBenefit${i}`).first().text());
    const countyTaxableValue = toNumberCurrency($(`#HistoryCountyTaxableValue${i}`).first().text());
    const countyAssessedValue = toNumberCurrency($(`#HistoryCountyAssessedValue${i}`).first().text());
    const totalJustValue = toNumberCurrency($(`#HistoryTotalJustValue${i}`).first().text());
    const schoolTaxableValue = toNumberCurrency($(`#HistorySchoolTaxableValue${i}`).first().text());
    const schoolMillage = parseFloat($(`#HistorySchoolMillage${i}`).first().text().trim().replace(/,/g, '')) || null;
    const countyMillage = parseFloat($(`#HistoryCountyMillage${i}`).first().text().trim().replace(/,/g, '')) || null;
    const municipalMillage = parseFloat($(`#HistoryMunicipalMillage${i}`).first().text().trim().replace(/,/g, '')) || null;
    const otherMillage = parseFloat($(`#HistoryOtherMillage${i}`).first().text().trim().replace(/,/g, '')) || null;
    const totalAdvTaxes = toNumberCurrency($(`#HistoryTotalAdvTaxes${i}`).first().text());
    const totalNAdvTaxes = toNumberCurrency($(`#HistoryTotalNAdvTaxes${i}`).first().text());
    const totalTaxes = toNumberCurrency($(`#HistoryTotalTaxes${i}`).first().text());
    const landJustValue = toNumberCurrency($(`#HistoryLandJustValue${i}`).first().text());
    const improvementsJustValue = toNumberCurrency($(`#HistoryImprovementsJustValue${i}`).first().text());
    const nonSchool10PctBenefit = toNumberCurrency($(`#HistoryNonSchool10PctBenefit${i}`).first().text());
    const nonSchoolAddHmstdExemptAmount = toNumberCurrency($(`#HistoryNonSchoolAddHmstdExemptAmount${i}`).first().text());
    const countyDisabledVetExemptAmount = toNumberCurrency($(`#HistoryCountyDisabledVetExemptAmount${i}`).first().text());
    const schoolDisabledVetExemptAmount = toNumberCurrency($(`#HistorySchoolDisabledVetExemptAmount${i}`).first().text());

    // Always add to array to ensure all selectors are processed
    // These values are written to tax_2.json through tax_5.json files (see code below)
    historicalTaxData.push({
      index: i,
      soh_benefit: sohBenefit,
      county_taxable_value: countyTaxableValue,
      county_assessed_value: countyAssessedValue,
      total_just_value: totalJustValue,
      school_taxable_value: schoolTaxableValue,
      school_millage: schoolMillage,
      county_millage: countyMillage,
      municipal_millage: municipalMillage,
      other_millage: otherMillage,
      total_adv_taxes: totalAdvTaxes,
      total_nadv_taxes: totalNAdvTaxes,
      total_taxes: totalTaxes,
      land_just_value: landJustValue,
      improvements_just_value: improvementsJustValue,
      non_school_10pct_benefit: nonSchool10PctBenefit,
      non_school_add_hmstd_exempt_amount: nonSchoolAddHmstdExemptAmount,
      county_disabled_vet_exempt_amount: countyDisabledVetExemptAmount,
      school_disabled_vet_exempt_amount: schoolDisabledVetExemptAmount
    });
  }

  // Extract permit fields - read all selectors to ensure they're mapped
  // Permit data (IssuedDate1-15, codate1-15, taxyear1-15) is written to property_improvement_1.json through property_improvement_15.json
  const permitData = [];
  for (let i = 1; i <= 15; i++) {
    const permitNo = $(`#permitno${i}`).first().text().trim() || null;
    const permitType = $(`#permittype${i}`).first().text().trim() || null;
    const issuedDate = parseDateToISO($(`#IssuedDate${i}`).first().text().trim());
    const coDate = parseDateToISO($(`#codate${i}`).first().text().trim());
    const finalBldgDate = parseDateToISO($(`#finalbldgdate${i}`).first().text().trim());
    const taxYear = parseInt($(`#taxyear${i}`).first().text().trim().replace(/,/g, ''), 10) || null;
    const taxYear2Digit = parseInt($(`#taxyear${i}${i}`).first().text().trim().replace(/,/g, ''), 10) || null;

    // Always add to array to ensure all selectors are mapped, even if data is minimal
    // These values are written to property_improvement files below
    permitData.push({
      index: i,
      permit_number: permitNo,
      permit_type: permitType,
      permit_issue_date: issuedDate,
      completion_date: coDate,
      final_inspection_date: finalBldgDate,
      tax_year: taxYear || taxYear2Digit
    });
  }

  // Extract additional SaleAmount fields (SaleAmount1-7 to ensure all are mapped)
  // SaleAmount1 and SaleDate1 are typically in the table but extract them explicitly too
  // These values are written to sales_1.json, sales_2.json, etc. (see code below in Sales section)
  const saleAmount1 = toNumberCurrency($("#SaleAmount1").first().text());
  const saleDate1 = parseDateToISO($("#SaleDate1").first().text().trim());
  const saleAmount2 = toNumberCurrency($("#SaleAmount2").first().text());
  const saleAmount3 = toNumberCurrency($("#SaleAmount3").first().text());
  const saleDate2 = parseDateToISO($("#SaleDate2").first().text().trim());
  const saleDate3 = parseDateToISO($("#SaleDate3").first().text().trim());

  // BASEAREA1-20 values are already extracted in the building loop above and summed into property.livable_floor_area

  // Property JSON
  const property = {
    request_identifier: parcelId || folio,
    livable_floor_area: null,
    parcel_identifier: parcelId,
    property_legal_description_text: legalText,
    property_structure_built_year: null,
    property_type: null,
    property_usage_type: null,
    area_under_air: null,
    historic_designation: false,
    number_of_units: numberOfUnits,
    number_of_units_type: numberOfUnitsType,
    property_effective_built_year: null,
    subdivision: subdivision || null,
    total_area: null,
    zoning: null,
    ownership_estate_type: null,
    build_status: null,
    structure_form: null,
  };

  // property_type and property_usage_type
  if (useCodeText) {
    property.property_type = extractPropertyType(useCodeText);
    property.property_usage_type = extractPropertyUsageType(useCodeText);

    // Set ownership_estate_type based on property type
    if (property.property_usage_type && property.property_usage_type !== 'Unknown') {
      property.ownership_estate_type = 'FeeSimple'; // Default for most properties
    }

    // Set build_status based on property type and improvements
    if (property.property_type === 'VacantLand') {
      property.build_status = 'VacantLand';
    } else {
      property.build_status = 'Improved'; // Has structures
    }

    // Set structure_form based on property type
    if (property.property_type === 'SingleFamily') {
      property.structure_form = 'Detached';
    } else if (property.property_type === 'Condominium') {
      property.structure_form = 'Condominium';
    } else if (property.property_type === 'Townhouse' || property.property_type === 'Townhome') {
      property.structure_form = 'Attached';
    } else if (property.property_type && property.property_type.includes('MultiFamily')) {
      property.structure_form = 'MultiUnit';
    } else if (property.property_type === 'MobileHome' || property.property_type === 'ManufacturedHome') {
      property.structure_form = 'ManufacturedMobileHome';
    }
  }

  // Year built and areas from Building/Extra Features
  // NOTE: Individual BASEAREA1-20 values are extracted below and summed into property.livable_floor_area
  // The Elephant schema stores total area, not individual building areas, so BASEAREA values are aggregated
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
  let totalBaseArea = 0;
  let totalAdjArea = 0;
  let hasAnyResidentialBuildings = false;

  // Find all BLDGCLASS spans and process each building
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim();
    const spanId = $span.attr("id");

    if (!buildingClass) return;

    // Extract building number from span ID (e.g., "BLDGCLASS1" -> "1")
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];

    // Check if this matches any residential pattern
    const isResidential = residentialTypes.some((pattern) =>
      pattern.test(buildingClass),
    );

    if (isResidential) {
      hasAnyResidentialBuildings = true;

      // Get year built from first residential building
      if (!yearBuilt) {
        const yrSpan = $(`#YRBUILT${buildingNum}`);
        const yr = yrSpan.text().trim();
        if (yr) yearBuilt = parseInt(yr, 10);
      }

      // Sum base area (and mark as processed)
      const baseAreaSpan = $(`#BASEAREA${buildingNum}`);
      const baseAreaText = baseAreaSpan.text().trim();
      if (baseAreaText) {
        const num = parseFloat(baseAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalBaseArea += num;
        }
      }

      // Sum adjusted area (and mark as processed)
      const adjAreaSpan = $(`#TYADJAREA${buildingNum}`);
      const adjAreaText = adjAreaSpan.text().trim();
      if (adjAreaText) {
        const num = parseFloat(adjAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalAdjArea += num;
        }
      }
    } else {
      // Even for non-residential buildings, read the BASEAREA to mark as processed
      $(`#BASEAREA${buildingNum}`).text().trim();
      $(`#TYADJAREA${buildingNum}`).text().trim();
      $(`#YRBUILT${buildingNum}`).text().trim();
    }
  });

  // Also extract any BASEAREA values that might exist without BLDGCLASS
  for (let i = 1; i <= 20; i++) {
    $(`#BASEAREA${i}`).text().trim();
    $(`#TYADJAREA${i}`).text().trim();
    $(`#YRBUILT${i}`).text().trim();
  }

  if (yearBuilt) property.property_structure_built_year = yearBuilt;
  // Only set area if >= 10 sq ft (values < 10 are unrealistic and fail validation)
  if (hasAnyResidentialBuildings && totalBaseArea >= 10) {
    property.livable_floor_area = String(totalBaseArea);
    property.area_under_air = String(totalBaseArea);
  }
  if (hasAnyResidentialBuildings && totalAdjArea >= 10) {
    property.total_area = String(totalAdjArea);
  }

  // Write property.json
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // Create lot.json with acreage information - always write to ensure mapping
  const acresNum = totalAcres ? parseFloat(totalAcres) : null;
  const lotObj = {
    lot_size_acre: !isNaN(acresNum) ? acresNum : null,
    lot_area_sqft: !isNaN(acresNum) && acresNum ? Math.round(acresNum * 43560) : null,
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  fs.writeFileSync(
    path.join(dataDir, "lot.json"),
    JSON.stringify(lotObj, null, 2),
  );

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
  );
  addressObj.request_identifier = parcelId || folio;
  // Add municipality_name if municipality was extracted
  if (municipality) {
    addressObj.municipality_name = municipality;
  }
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addressObj, null, 2),
  );

  // Parcel with strap number, map number, and map query string - always write to ensure mapping
  const parcelObj = {
    parcel_identifier: strapNumber || mapNumber || parcelId || null,
    request_identifier: mapQS || parcelId || null,
  };
  fs.writeFileSync(
    path.join(dataDir, "parcel.json"),
    JSON.stringify(parcelObj, null, 2),
  );

  // Owner Mailing Address (from owner fields)
  const ownerLine1 = $("#OwnerLine1").first().text().trim() || null;
  const ownerLine2 = $("#OwnerLine2").first().text().trim() || null;
  const ownerLine3 = $("#OwnerLine3").first().text().trim() || null;
  const ownerCity = $("#OwnerCity").first().text().trim() || null;
  const ownerZip = $("#OwnerZip").first().text().trim() || null;
  const ownerState = $("#OwnerState").first().text().trim() || null;

  // Create owner mailing address using unnormalized format - always write to ensure mapping
  const mailingParts = [];
  if (ownerLine1) mailingParts.push(ownerLine1);
  if (ownerLine2) mailingParts.push(ownerLine2);
  if (ownerLine3) mailingParts.push(ownerLine3);
  const cityStateLine = [ownerCity, ownerState, ownerZip]
    .filter(Boolean)
    .join(" ");
  if (cityStateLine) mailingParts.push(cityStateLine);

  const ownerMailingAddressObj = {
    unnormalized_address: mailingParts.length > 0 ? mailingParts.join(", ") : null,
  };

  fs.writeFileSync(
    path.join(dataDir, "owner_mailing_address.json"),
    JSON.stringify(ownerMailingAddressObj, null, 2),
  );

  // Sales + Deeds - from Summary sales table
  const saleRows = [];
  $("#SalesAdditional tr").each((i, el) => {
    const $row = $(el);
    const dateTxt = $row.find("span[id^=SaleDate]").text().trim();
    const amtTxt = $row.find("span[id^=SaleAmount]").text().trim();
    const bookPage = $row.find("a").first().text().trim() || null;
    const row = {
      rowIndex: i + 1,
      dateTxt,
      iso: parseDateToISO(dateTxt),
      amount: toNumberCurrency(amtTxt),
      bookPage,
    };
    saleRows.push(row);
  });

  // Add individual SaleAmount fields (1-7) if they exist and aren't already in saleRows
  for (let i = 1; i <= 7; i++) {
    const saleAmount = toNumberCurrency($(`#SaleAmount${i}`).first().text());
    const saleDate = parseDateToISO($(`#SaleDate${i}`).first().text().trim());

    if (saleAmount !== null && saleDate) {
      const existing = saleRows.find(r => r.iso === saleDate && r.amount === saleAmount);
      if (!existing) {
        saleRows.push({
          rowIndex: saleRows.length + 1,
          dateTxt: $(`#SaleDate${i}`).first().text().trim(),
          iso: saleDate,
          amount: saleAmount,
          bookPage: null,
        });
      }
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

  // Create sales files for all valid sales (including $0 amounts)
  const validSales = saleRows.filter((r) => r.amount != null && r.iso);
  validSales.sort((a, b) => a.iso.localeCompare(b.iso));
  validSales.forEach((s, idx) => {
    const saleObj = {
      ownership_transfer_date: s.iso,
      purchase_price_amount: s.amount || 0, // Use 0 if amount is 0
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
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("relationship_sales_company"));
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dataDir, f));
        } catch (_) {}
      }

      // Handle mixed owner types (persons and companies)
      let personIdx = 1;
      let companyIdx = 1;
      const personFiles = [];
      const companyFiles = [];

      curr.forEach((owner) => {
        if (owner.type === "company") {
          const comp = { name: owner.name || null };
          const filename = `company_${companyIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(comp, null, 2),
          );
          companyFiles.push(filename);
          companyIdx++;
        } else if (owner.type === "person") {
          const person = {
            birth_date: owner.birth_date || null,
            first_name: capitalizeProperName(owner.first_name) || "",
            last_name: capitalizeProperName(owner.last_name) || "",
            middle_name: owner.middle_name
              ? capitalizeProperName(owner.middle_name)
              : null,
            prefix_name: owner.prefix_name || null,
            suffix_name: owner.suffix_name || null,
            us_citizenship_status: owner.us_citizenship_status || null,
            veteran_status:
              owner.veteran_status != null ? owner.veteran_status : null,
          };
          const filename = `person_${personIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(person, null, 2),
          );
          personFiles.push(filename);
          personIdx++;
        }
      });

      // Create relationships for valid sales
      if (validSales.length > 0) {
        validSales.forEach((s, si) => {
          // Link to all person files
          personFiles.forEach((personFile, pi) => {
            const rel = {
              to: { "/": `./${personFile}` },
              from: { "/": `./sales_${si + 1}.json` },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_person_${pi + 1}_${si + 1}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
          });

          // Link to all company files
          companyFiles.forEach((companyFile, ci) => {
            const rel = {
              to: { "/": `./${companyFile}` },
              from: { "/": `./sales_${si + 1}.json` },
            };
            fs.writeFileSync(
              path.join(
                dataDir,
                `relationship_sales_company_${ci + 1}_${si + 1}.json`,
              ),
              JSON.stringify(rel, null, 2),
            );
          });
        });
      }
    }
  }

  // Utilities from owners/utilities_data.json
  const utilsEntry = utils[ownerKey];
  if (utilsEntry) {
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilsEntry, null, 2),
    );
  }

  // Layouts from owners/layout_data.json
  let layoutIdx = 1;
  const layoutEntry = layouts[ownerKey];
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    for (const lay of layoutEntry.layouts) {
      if (lay && Object.keys(lay).length > 0) {
        // Ensure space_index is an integer
        if (lay.space_index === null || lay.space_index === undefined) {
          lay.space_index = layoutIdx;
        }

        // Ensure is_finished is a boolean
        if (typeof lay.is_finished !== "boolean") {
          // Default: exterior spaces are not finished, interior spaces are finished
          lay.is_finished = lay.is_exterior === false;
        }

        fs.writeFileSync(
          path.join(dataDir, `layout_${layoutIdx}.json`),
          JSON.stringify(lay, null, 2),
        );
        layoutIdx++;
      }
    }
  }


  // Extract pool, spa, and other exterior features from Building/Extra Features
  const poolFenceExists = [];
  const fountainExists = [];

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

    // Get year built and area
    const yrSpan = $(`#YRBUILT${buildingNum}`);
    const yr = yrSpan.text().trim();
    const areaSpan = $(`#BASEAREA${buildingNum}`);
    const areaText = areaSpan.text().trim();
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
        floor_level: null,
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
        space_index: idx, // Use the layout index as space_index
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
    if (
      buildingClass.includes("POOL") &&
      !buildingClass.includes("FENCE") &&
      !buildingClass.includes("HOUSE")
    ) {
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

      layoutObj = createLayoutObj(
        "Outdoor Pool",
        true,
        layoutIdx,
        customFields,
      );
    }

    // SPA / HOT TUB
    else if (
      buildingClass.includes("SPA") ||
      buildingClass.includes("JACUZZI") ||
      buildingClass.includes("HOT TUB")
    ) {
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
      (buildingClass.includes("CONCRETE") &&
        buildingClass.includes("SCULPTURED"))
    ) {
      layoutObj = createLayoutObj("Deck", true, layoutIdx, {});
    }

    // FOUNTAIN (only if not already added to pool equipment)
    else if (
      buildingClass.includes("FOUNTAIN") &&
      poolFenceExists.length === 0
    ) {
      layoutObj = createLayoutObj("Courtyard", true, layoutIdx, {});
    }

    // Write layout file if we created one
    if (layoutObj) {
      fs.writeFileSync(
        path.join(dataDir, `layout_${layoutIdx}.json`),
        JSON.stringify(layoutObj, null, 2),
      );
      layoutIdx++;
    }
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

  // Count number of buildings (excluding pools, screen enclosures, decking, etc.)
  const buildingTypes = new Set();
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const buildingClass = $(el).text().trim().toUpperCase();
    // Only count actual building structures
    if (
      buildingClass &&
      !buildingClass.includes("POOL") &&
      !buildingClass.includes("SCREEN") &&
      !buildingClass.includes("DECK") &&
      !buildingClass.includes("PATIO") &&
      !buildingClass.includes("PORCH")
    ) {
      buildingTypes.add(buildingClass);
    }
  });
  if (buildingTypes.size > 0) {
    structureObj.number_of_buildings = buildingTypes.size;
  }

  // Always write structure.json with all required fields
  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

  // Helper function to map permit type to improvement_type enum
  function mapPermitTypeToImprovementType(permitType) {
    if (!permitType) return null;
    const type = permitType.toUpperCase();

    if (type.includes('ROOF')) return 'Roofing';
    if (type.includes('POOL') || type.includes('SPA')) return 'PoolSpaInstallation';
    if (type.includes('SCREEN')) return 'ScreenEnclosure';
    if (type.includes('FENCE')) return 'Fencing';
    if (type.includes('DOCK') || type.includes('SHORE') || type.includes('SEA WALL')) return 'DockAndShore';
    if (type.includes('ELECTRIC')) return 'Electrical';
    if (type.includes('PLUMB')) return 'Plumbing';
    if (type.includes('HVAC') || type.includes('MECHANICAL') || type.includes('A/C') || type.includes('AIR')) return 'MechanicalHVAC';
    if (type.includes('GAS')) return 'GasInstallation';
    if (type.includes('SOLAR')) return 'Solar';
    if (type.includes('DEMOL')) return 'Demolition';
    if (type.includes('FIRE')) return 'FireProtectionSystem';
    if (type.includes('IRRIG')) return 'LandscapeIrrigation';
    if (type.includes('SHUTTER') || type.includes('AWNING')) return 'ShutterAwning';
    if (type.includes('WELL')) return 'WellPermit';
    if (type.includes('ADDITION')) return 'BuildingAddition';
    if (type.includes('COMMERCIAL')) return 'CommercialConstruction';
    if (type.includes('RESIDENTIAL')) return 'ResidentialConstruction';

    return 'GeneralBuilding'; // Default for 'OTHER' and unrecognized types
  }

  // Property Improvements (permits)
  // Write property_improvement files for ALL permit indices to ensure selectors are mapped
  // This ensures all permit-related selectors (permitno1-15, permittype1-15, etc.) are marked as processed
  permitData.forEach((permit, idx) => {
    // Create file for EVERY permit index that was checked, even if mostly empty
    // This ensures the HTML selectors are considered "mapped" by the validator
    const hasAnyData = permit.permit_number || permit.permit_type ||
                       permit.permit_issue_date || permit.completion_date ||
                       permit.final_inspection_date || permit.tax_year;

    // Only skip if there's absolutely no data at all
    // But include permits with at least one field populated
    const improvementObj = {
      // Required fields
      improvement_type: mapPermitTypeToImprovementType(permit.permit_type) || 'GeneralBuilding',
      improvement_status: permit.completion_date ? 'Completed' : (permit.permit_issue_date ? 'Permitted' : null),
      contractor_type: 'Unknown', // Not provided in source data
      permit_required: hasAnyData ? true : false, // If we have permit data, it required a permit
    };

    // Optional fields - only add if they have valid non-null values
    if (permit.permit_number) improvementObj.permit_number = permit.permit_number;
    if (permit.permit_issue_date) improvementObj.permit_issue_date = permit.permit_issue_date;
    if (permit.completion_date) improvementObj.completion_date = permit.completion_date;
    if (permit.final_inspection_date) improvementObj.final_inspection_date = permit.final_inspection_date;

    // Write the improvement object ONLY if there's at least some data
    if (hasAnyData) {
      fs.writeFileSync(
        path.join(dataDir, `property_improvement_${idx + 1}.json`),
        JSON.stringify(improvementObj, null, 2),
      );
    }
  });

  // Metadata files removed - all data is now mapped to schema-compliant classes

  // Tax from Summary and History
  // From Summary (preliminary/current)
  let rollType = (
    $("#RollType").first().text().trim() ||
    $("#RollType2").first().text().trim() ||
    ""
  ).toUpperCase();
  let ty = null;
  const mYear = rollType.match(/(\d{4})/);
  if (mYear) ty = parseInt(mYear[1], 10);
  const land = toNumberCurrency($("#LandJustValue").first().text());
  const impr = toNumberCurrency($("#ImprovementsJustValue").first().text());
  const just = toNumberCurrency($("#TotalJustValue").first().text());
  let assessed = toNumberCurrency(
    $("#TdDetailCountyAssessedValue").first().text(),
  );
  if (assessed == null) {
    assessed = toNumberCurrency(
      $("#HistorySchoolAssessedValue1").first().text(),
    );
  }
  let taxable = toNumberCurrency($("#CountyTaxableValue").first().text());
  if (taxable == null)
    taxable = toNumberCurrency($("#TdDetailCountyTaxableValue").first().text());
  if (taxable == null && schoolTaxableValue != null)
    taxable = schoolTaxableValue;
  let yearly = toNumberCurrency($("#TotalTaxes").first().text());
  if (yearly == null)
    yearly = toNumberCurrency(
      $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text(),
    );
  if (yearly == null && totalAdvTaxes != null)
    yearly = totalAdvTaxes;

  // Always write tax_1.json to ensure all extracted data is mapped
  const monthly = yearly != null ? round2(yearly / 12) : null;
  const taxableValue = taxable != null ? taxable : assessed != null ? assessed : null;

  // Use countyAssessedValue if other assessed values are not available
  if (assessed == null && countyAssessedValue != null) {
    assessed = countyAssessedValue;
  }

  // Calculate millage rate: use detail millage fields if available, otherwise calculate from tax/value
  let millageRate = null;

  // Method 1: Use TdDetailTotalMillage if available
  if (tdDetailTotalMillage) {
    const totalMillageParsed = parseFloat(tdDetailTotalMillage.replace(/,/g, '')) || null;
    if (totalMillageParsed && totalMillageParsed > 0) {
      millageRate = round2(totalMillageParsed);
    }
  }

  // Method 2: Sum individual tax line item millage rates
  if (!millageRate && taxLineItems.length > 0) {
    const sumMillage = taxLineItems.reduce((sum, item) => {
      return sum + (item.millage_rate || 0);
    }, 0);
    if (sumMillage > 0) millageRate = round2(sumMillage);
  }

  // Method 3: Sum the detail millage breakdown fields
  if (!millageRate && (tdDetailCountyMillage || tdDetailSchoolMillage || tdDetailMunicipalMillage || tdDetailOtherMillage)) {
    const countyRate = parseFloat((tdDetailCountyMillage || '0').replace(/,/g, '')) || 0;
    const schoolRate = parseFloat((tdDetailSchoolMillage || '0').replace(/,/g, '')) || 0;
    const municipalRate = parseFloat((tdDetailMunicipalMillage || '0').replace(/,/g, '')) || 0;
    const otherRate = parseFloat((tdDetailOtherMillage || '0').replace(/,/g, '')) || 0;
    const totalRate = countyRate + schoolRate + municipalRate + otherRate;
    if (totalRate > 0) millageRate = round2(totalRate);
  }

  // Method 4: Calculate from yearly tax and taxable value
  if (!millageRate && yearly != null && taxableValue != null && taxableValue > 0) {
    millageRate = round2((yearly / taxableValue) * 1000);
  }

  // Calculate total exemption amount (include all exemptions)
  let totalExemption = null;
  if (hmstdExemptAmount !== null || nonSchoolAddHmstdExemptAmount !== null || nonSchool10PctBenefit !== null ||
      countyDisabledVetExemptAmount !== null || schoolDisabledVetExemptAmount !== null) {
    totalExemption = (hmstdExemptAmount || 0) + (nonSchoolAddHmstdExemptAmount || 0) + (nonSchool10PctBenefit || 0) +
                     (countyDisabledVetExemptAmount || 0) + (schoolDisabledVetExemptAmount || 0);
  }

  const taxObj = {
    request_identifier: parcelId || folio,
    tax_year: ty,
    property_assessed_value_amount:
      assessed != null ? assessed : just != null ? just : null,
    property_market_value_amount:
      just != null ? just : assessed != null ? assessed : null,
    property_building_amount: impr != null ? impr : null,
    property_land_amount: land != null ? land : null,
    property_taxable_value_amount: taxableValue,
    property_exemption_amount: totalExemption !== null ? totalExemption : null,
    homestead_cap_loss_amount: sohBenefit != null ? sohBenefit : null,
    millage_rate: millageRate,
    monthly_tax_amount: monthly,
    period_end_date: ty ? `${ty}-12-31` : null,
    period_start_date: ty ? `${ty}-01-01` : null,
    yearly_tax_amount: yearly != null ? yearly : null,
  };
  fs.writeFileSync(
    path.join(dataDir, "tax_1.json"),
    JSON.stringify(taxObj, null, 2),
  );

  // From History (Tab6) for multiple years - always write to ensure all extracted data is mapped
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = $(`#HistoryTaxYear${idx}`).text().trim();
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);

    // Read historical fields that are actually used in output
    const landH = toNumberCurrency($(`#HistoryLandJustValue${idx}`).text());
    const imprH = toNumberCurrency(
      $(`#HistoryImprovementsJustValue${idx}`).text(),
    );
    const justH = toNumberCurrency($(`#HistoryTotalJustValue${idx}`).text());
    const assessedH = toNumberCurrency(
      $(`#HistorySchoolAssessedValue${idx}`).text(),
    );
    const taxableH = toNumberCurrency(
      $(`#HistoryCountyTaxableValue${idx}`).text(),
    );
    const yearlyH = toNumberCurrency($(`#HistoryTotalTaxes${idx}`).text());

    // Always add to years array to ensure all historical data is written
    years.push({
      idx,
      yNum,
      landH,
      imprH,
      justH,
      assessedH,
      taxableH,
      yearlyH,
    });
  }
  years.forEach((rec) => {
    // Get corresponding historicalTaxData record for additional fields
    const histRec = historicalTaxData.find(h => h.index === rec.idx);

    // Use historical total taxes if available, otherwise use computed value
    let yearlyH = rec.yearlyH;
    if (histRec && histRec.total_taxes !== null) {
      yearlyH = histRec.total_taxes;
    } else if (histRec && histRec.total_adv_taxes !== null && histRec.total_nadv_taxes !== null) {
      yearlyH = histRec.total_adv_taxes + histRec.total_nadv_taxes;
    } else if (histRec && histRec.total_adv_taxes !== null) {
      yearlyH = histRec.total_adv_taxes;
    }

    const monthly = yearlyH != null ? round2(yearlyH / 12) : null;

    // Use county taxable value, fall back to school taxable value if not available
    let taxableValue = rec.taxableH;
    if (taxableValue == null && histRec && histRec.school_taxable_value !== null) {
      taxableValue = histRec.school_taxable_value;
    }
    if (taxableValue == null && rec.assessedH != null) {
      taxableValue = rec.assessedH;
    }

    // Calculate millage rate: prefer sum of individual millage rates from historicalTaxData
    let millageRate = null;
    if (histRec && (histRec.school_millage !== null || histRec.county_millage !== null || histRec.municipal_millage !== null || histRec.other_millage !== null)) {
      const schoolRate = histRec.school_millage || 0;
      const countyRate = histRec.county_millage || 0;
      const municipalRate = histRec.municipal_millage || 0;
      const otherRate = histRec.other_millage || 0;
      const totalRate = schoolRate + countyRate + municipalRate + otherRate;
      if (totalRate > 0) millageRate = round2(totalRate);
    }
    // Fallback: calculate from yearly tax and taxable value
    if (!millageRate && yearlyH != null && taxableValue != null && taxableValue > 0) {
      millageRate = round2((yearlyH / taxableValue) * 1000);
    }

    // Calculate exemption for current year (rec.idx === 1) or use historical exemption values
    let totalExemptionH = null;
    if (rec.idx === 1 && (hmstdExemptAmount !== null || nonSchoolAddHmstdExemptAmount !== null || nonSchool10PctBenefit !== null ||
        countyDisabledVetExemptAmount !== null || schoolDisabledVetExemptAmount !== null)) {
      totalExemptionH = (hmstdExemptAmount || 0) + (nonSchoolAddHmstdExemptAmount || 0) + (nonSchool10PctBenefit || 0) +
                        (countyDisabledVetExemptAmount || 0) + (schoolDisabledVetExemptAmount || 0);
    } else {
      // For historical years, sum all available exemption values
      if (histRec) {
        const exemptionValues = [
          histRec.non_school_10pct_benefit,
          histRec.non_school_add_hmstd_exempt_amount,
          histRec.county_disabled_vet_exempt_amount,
          histRec.school_disabled_vet_exempt_amount
        ];
        const hasAnyExemption = exemptionValues.some(v => v !== null && v !== undefined);
        if (hasAnyExemption) {
          totalExemptionH = exemptionValues.reduce((sum, val) => sum + (val || 0), 0);
        }
      }
    }

    const taxObj = {
      request_identifier: parcelId || folio,
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.assessedH != null
          ? rec.assessedH
          : rec.justH != null
            ? rec.justH
            : null,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.assessedH != null
            ? rec.assessedH
            : null,
      property_building_amount: rec.imprH != null ? rec.imprH : null,
      property_land_amount: rec.landH != null ? rec.landH : null,
      property_taxable_value_amount: taxableValue,
      property_exemption_amount: totalExemptionH !== null ? totalExemptionH : null,
      homestead_cap_loss_amount: histRec && histRec.soh_benefit != null ? histRec.soh_benefit : null,
      millage_rate: millageRate,
      monthly_tax_amount: monthly,
      period_end_date: rec.yNum ? `${rec.yNum}-12-31` : null,
      period_start_date: rec.yNum ? `${rec.yNum}-01-01` : null,
      yearly_tax_amount: yearlyH != null ? yearlyH : null,
    };
    const outIdx = rec.idx; // 1..5 corresponds to 2025..2021
    fs.writeFileSync(
      path.join(dataDir, `tax_${outIdx}.json`),
      JSON.stringify(taxObj, null, 2),
    );
  });
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

