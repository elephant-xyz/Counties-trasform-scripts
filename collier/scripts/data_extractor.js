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
  const trimmed = String(str).trim();
  if (!trimmed || /^[-–—]+$/.test(trimmed)) return null;

  const isAccountingNegative = /^\(.*\)$/.test(trimmed);
  let cleaned = trimmed.replace(/[$,\s()]/g, "");
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();
  if (upper === "N/A" || upper === "NA") return null;

  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return isAccountingNegative ? -num : num;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseDateToISO(mdyy) {
  if (!mdyy) return null;
  // Accept MM/DD/YY or MM/DD/YYYY
  const m = mdyy.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  mm = mm.padStart(2, "0");
  dd = dd.padStart(2, "0");

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

function getCellText($, selector) {
  const el = $(selector).first();
  if (!el || el.length === 0) return null;
  const raw = el.text();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function getRawSelectorText($, selector) {
  const nodes = $(selector);
  if (!nodes || nodes.length === 0) return null;
  for (const el of nodes.toArray()) {
    const raw = $(el).text();
    if (raw == null) continue;
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  const fallback = nodes.first().text();
  return fallback != null && fallback.length > 0 ? fallback.trim() : null;
}

function addSelectorSource(sourceFields, selectors, value) {
  if (!sourceFields) return;
  if (value == null) return;
  const normalizedValue =
    typeof value === "string" ? value.trim() : value;
  if (normalizedValue === "" || normalizedValue == null) return;
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const selector of list) {
    if (!selector) continue;
    sourceFields[selector] = normalizedValue;
  }
}

function removeFilesByPattern(dirPath, regex) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    if (regex.test(entry)) {
      try {
        fs.unlinkSync(path.join(dirPath, entry));
      } catch (_) {}
    }
  }
}

function mergeTaxRecords(primary, secondary) {
  const result = { ...primary };
  for (const [key, value] of Object.entries(secondary)) {
    if (key === "source_fields" && value && typeof value === "object") {
      const merged = { ...(result.source_fields || {}) };
      for (const [fieldKey, fieldValue] of Object.entries(value)) {
        if (fieldValue == null || fieldValue === "") continue;
        const current = merged[fieldKey];
        if (
          current == null ||
          current === "" ||
          String(fieldValue).length > String(current).length
        ) {
          merged[fieldKey] = fieldValue;
        }
      }
      result.source_fields = merged;
      continue;
    }
    if ((result[key] === null || result[key] === undefined) && value != null) {
      result[key] = value;
    } else if (!(key in result) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
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


function splitStreet(streetPart) {
  const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "NORTH", "SOUTH", "EAST", "WEST"]);
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
      "NORTH": "N",
      "SOUTH": "S",
      "EAST": "E",
      "WEST": "W",
    };
    preDir = dirMap[dirUpper] || dirUpper;
    tokens = tokens.slice(1); // remove pre-directional from tokens
  }

  // Check for post-directional (last token)
  if (tokens.length > 1 && dirs.has(tokens[tokens.length - 1].toUpperCase())) {
    const dirUpper = tokens[tokens.length - 1].toUpperCase();
    const dirMap = {
      "NORTH": "N",
      "SOUTH": "S",
      "EAST": "E",
      "WEST": "W",
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
  // Example fullAddress: 280 S COLLIER BLVD # 2306, MARCO ISLAND 34145
  const normalizedFullAddress = fullAddress
    ? fullAddress.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()
    : null;
  let streetNumber = null;
  let streetName = null;
  let postDir = null;
  let preDir = null;
  let suffixType = null;
  let city = null;
  let state = null;
  let zip = null;
  let unitId = null;

  if (fullAddress) {
    const addr = fullAddress.replace(/\s+,/g, ",").trim();

    // First, extract unit identifier if present (# 2306, APT 2306, UNIT 2306, etc.)
    let streetPartRaw = addr;
    const unitMatch = addr.match(/(#|APT|UNIT|STE|SUITE)\s*([A-Z0-9-]+)/i);
    if (unitMatch) {
      unitId = unitMatch[2];
      // Remove unit from address for further parsing
      streetPartRaw = addr.replace(/(#|APT|UNIT|STE|SUITE)\s*[A-Z0-9-]+/i, "").trim();
    }

    // Prefer pattern: <num> <street words> [<postDir>], <CITY>, <STATE> <ZIP>
    let m = streetPartRaw.match(
      /^(\d+)\s+([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/,
    );
    if (m) {
      streetNumber = m[1];
      const streetPart = m[2].trim();
      city = m[3].trim().toUpperCase();
      state = m[4];
      zip = m[5];
      const parsed = splitStreet(streetPart);
      streetName = parsed.streetName;
      preDir = parsed.preDir;
      postDir = parsed.postDir;
      suffixType = parsed.suffix;
    } else {
      // Fallback pattern without explicit state: <num> <street words> [<postDir>], <CITY> <ZIP>
      m = streetPartRaw.match(/^(\d+)\s+([^,]+),\s*([A-Z\s]+)\s*(\d{5})(?:-\d{4})?$/);
      if (m) {
        streetNumber = m[1];
        const streetPart = m[2].trim();
        city = m[3].trim().toUpperCase();
        zip = m[4];
        const parsed = splitStreet(streetPart);
        streetName = parsed.streetName;
        preDir = parsed.preDir;
        postDir = parsed.postDir;
        suffixType = parsed.suffix;
      }
    }
  }

  // From legal, get block and lot
  let block = null,
    lot = null;
  if (legalText) {
    const b = legalText.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (b) block = b[1].toUpperCase();
    const l = legalText.match(/LOT\s+(\w+)/i);
    if (l) lot = l[1];
  }

  const base = {
    block: block || null,
    county_name: countyNameFromSeed || null,
    country_code: null,
    latitude: null,
    longitude: null,
    lot: lot || null,
    municipality_name: municipality || null,
    range: range || null,
    section: section || null,
    township: township || null,
  };

  const hasNormalized =
    streetNumber &&
    streetName &&
    city &&
    (state || countyNameFromSeed || municipality);

  if (hasNormalized) {
    base.normalized_address = {
      street_number: streetNumber,
      street_name: streetName,
      street_suffix_type: suffixType || null,
      street_pre_directional_text: preDir || null,
      street_post_directional_text: postDir || null,
      unit_identifier: unitId || null,
      city_name: city || null,
      state_code: state || "FL",
      postal_code: zip || null,
      plus_four_postal_code: null,
      route_number: null,
    };
  } else if (normalizedFullAddress) {
    base.unnormalized_address = normalizedFullAddress;
  }

  if (!hasNormalized) {
    base.postal_code = zip || null;
    base.state_code = state || (countyNameFromSeed ? "FL" : null);
  }

  return base;
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
  removeFilesByPattern(dataDir, /^file_\d+\.json$/);
  removeFilesByPattern(dataDir, /^relationship_deed_file_\d+\.json$/);
  removeFilesByPattern(dataDir, /^relationship_sales_.*\.json$/);
  removeFilesByPattern(dataDir, /^sale_\d+\.json$/);
  removeFilesByPattern(dataDir, /^sales_\d+\.json$/);

  const folio = seed.request_identifier || seed.parcel_id;

  // Extract base fields from HTML
  const parcelId =
    $("#ParcelID").first().text().trim() || seed.parcel_id || folio;
  const fullAddressHtml = $("#FullAddressUnit").first().text().trim();
  const fullAddressUn = unaddr.full_address || null;
  const fullAddress = fullAddressUn || fullAddressHtml || null;
  const legalText = $("#Legal").first().text().trim() || null;
  const subdivisionRaw = $("#SCDescription").first().text().trim() || null; // e.g., 469900 - LONGSHORE LAKE UNIT 1
  const subdivision = subdivisionRaw
    ? subdivisionRaw.replace(/^\s*\d+\s*-\s*/, "").trim()
    : null;
  const useCodeText = $("#UCDescription").first().text().trim();

  const section = getCellText($, "#Section");
  const township = getCellText($, "#Township");
  const range = getCellText($, "#Range");
  const municipality = getCellText($, "#Municipality");
  const totalAcresText = getCellText($, "#TotalAcres");
  const totalAcres = totalAcresText ? toNumberCurrency(totalAcresText) : null;
  const totalLandSquareFeetText = getCellText($, "#TOTALUNITS1");
  const totalLandSquareFeet = totalLandSquareFeetText
    ? toNumberCurrency(totalLandSquareFeetText)
    : null;

  const propertySourceFields = {};
  const baseAreaRawByBuilding = {};
  const adjAreaRawByBuilding = {};

  // Property JSON
  const property = {
    livable_floor_area: null,
    parcel_identifier: parcelId,
    property_legal_description_text: legalText,
    property_structure_built_year: null,
    property_type: null,
    property_usage_type: null,
    area_under_air: null,
    historic_designation: undefined,
    number_of_units: null,
    number_of_units_type: null,
    property_effective_built_year: null,
    subdivision: subdivision || null,
    total_area: null,
    building_adjusted_area: null,
    lot_size_square_feet: null,
    lot_size_acres: null,
    municipality_name: null,
    zoning: null,
  };

  // property_type and property_usage_type
  if (useCodeText) {
    property.property_type = extractPropertyType(useCodeText);
    property.property_usage_type = extractPropertyUsageType(useCodeText);
  }
  if (municipality) {
    property.municipality_name = municipality;
    propertySourceFields.municipality_name_text = municipality;
    addSelectorSource(propertySourceFields, "#Municipality", municipality);
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
    const isResidential = residentialTypes.some(pattern => pattern.test(buildingClass));

    if (isResidential) {
      hasAnyResidentialBuildings = true;

      // Get year built from first residential building
      if (!yearBuilt) {
        const yrSpan = $(`#YRBUILT${buildingNum}`);
        const yr = yrSpan.text().trim();
        if (yr) yearBuilt = parseInt(yr, 10);
      }

      // Sum base area
      const baseAreaSpan = $(`#BASEAREA${buildingNum}`);
      const baseAreaText = baseAreaSpan.text().trim();
      if (baseAreaText) {
        baseAreaRawByBuilding[buildingNum] = baseAreaText;
        const num = parseFloat(baseAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalBaseArea += num;
        }
        addSelectorSource(
          propertySourceFields,
          `#BASEAREA${buildingNum}`,
          baseAreaText,
        );
      }

      // Sum adjusted area
      const adjAreaSpan = $(`#TYADJAREA${buildingNum}`);
      const adjAreaText = adjAreaSpan.text().trim();
      if (adjAreaText) {
        adjAreaRawByBuilding[buildingNum] = adjAreaText;
        const num = parseFloat(adjAreaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          totalAdjArea += num;
        }
        addSelectorSource(
          propertySourceFields,
          `#TYADJAREA${buildingNum}`,
          adjAreaText,
        );
      }
    }
  });

  if (yearBuilt) property.property_structure_built_year = yearBuilt;
  // Only set area if >= 10 sq ft (values < 10 are unrealistic and fail validation)
  if (hasAnyResidentialBuildings && totalBaseArea >= 10) {
    property.livable_floor_area = totalBaseArea;
    property.area_under_air = totalBaseArea;
  }
  if (hasAnyResidentialBuildings && totalAdjArea >= 10) {
    property.total_area = totalAdjArea;
    property.building_adjusted_area = totalAdjArea;
  }

  if (totalLandSquareFeet != null && totalLandSquareFeet > 0) {
    property.lot_size_square_feet = totalLandSquareFeet;
  }
  if (totalAcres != null && totalAcres > 0) {
    property.lot_size_acres = totalAcres;
  }

  Object.entries(baseAreaRawByBuilding).forEach(([buildingNum, raw]) => {
    if (raw) {
      propertySourceFields[`base_area_building_${buildingNum}_text`] = raw;
    }
  });
  Object.entries(adjAreaRawByBuilding).forEach(([buildingNum, raw]) => {
    if (raw) {
      propertySourceFields[`adjusted_area_building_${buildingNum}_text`] = raw;
    }
  });
  if (totalLandSquareFeetText) {
    propertySourceFields.lot_size_square_feet_text = totalLandSquareFeetText;
    addSelectorSource(
      propertySourceFields,
      "#TOTALUNITS1",
      totalLandSquareFeetText,
    );
  }
  if (totalAcresText) {
    propertySourceFields.lot_size_acres_text = totalAcresText;
    addSelectorSource(propertySourceFields, "#TotalAcres", totalAcresText);
  }
  if (Object.keys(propertySourceFields).length > 0) {
    property.source_fields = propertySourceFields;
  }

  // Write property.json
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
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
  addressObj.parcel_identifier = parcelId;
  const addressSourceFields = {};
  if (municipality) {
    addressSourceFields.municipality_name_text = municipality;
    addSelectorSource(addressSourceFields, "#Municipality", municipality);
  }
  if (section) {
    addressSourceFields.section_text = section;
    addSelectorSource(addressSourceFields, "#Section", section);
  }
  if (township) {
    addressSourceFields.township_text = township;
    addSelectorSource(addressSourceFields, "#Township", township);
  }
  if (range) {
    addressSourceFields.range_text = range;
    addSelectorSource(addressSourceFields, "#Range", range);
  }
  if (fullAddressHtml) {
    addressSourceFields.unnormalized_address_text = fullAddressHtml;
    addSelectorSource(
      addressSourceFields,
      "#FullAddressUnit",
      fullAddressHtml,
    );
  }
  if (Object.keys(addressSourceFields).length > 0) {
    addressObj.source_fields = {
      ...(addressObj.source_fields || {}),
      ...addressSourceFields,
    };
  }
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addressObj, null, 2),
  );

  // Sales + Deeds - from Summary sales table
  const saleRows = [];
  for (let idx = 1; idx <= 25; idx++) {
    const dateTxt = getCellText($, `#SaleDate${idx}`);
    const dateRaw =
      getRawSelectorText($, `#SaleDate${idx}`) || dateTxt || null;
    const amountTxt = getCellText($, `#SaleAmount${idx}`);
    const amountRaw =
      getRawSelectorText($, `#SaleAmount${idx}`) || amountTxt || null;
    const bookPagePrimarySelector = `table.clsWide > tfoot.clsNoBorderBox > tr:nth-child(${idx}) > td.clsLabelnt:nth-child(2) > a`;
    const bookPagePrimary = getCellText($, bookPagePrimarySelector);
    const bookPagePrimaryRaw =
      getRawSelectorText($, bookPagePrimarySelector) || bookPagePrimary || null;
    const bookPageFallback = getCellText($, `#TrSale${idx} td:nth-child(2) a`);
    const bookPageFallbackRaw =
      getRawSelectorText($, `#TrSale${idx} td:nth-child(2) a`) ||
      bookPageFallback ||
      null;
    const bookPage = bookPagePrimary || bookPageFallback || null;
    const bookPageRaw =
      bookPagePrimaryRaw || bookPageFallbackRaw || bookPage || null;

    if (!dateTxt && !amountTxt && !bookPage) {
      continue;
    }

    saleRows.push({
      rowIndex: idx,
      dateTxt: dateTxt || null,
      dateRaw,
      iso: parseDateToISO(dateTxt || dateRaw),
      amount: toNumberCurrency(amountTxt || amountRaw),
      amountText: amountTxt || null,
      amountRaw,
      bookPage,
      bookPageRaw,
      bookPagePrimarySelector,
    });
  }

  const parseBookAndPage = (value) => {
    if (!value) {
      return { bookNumber: null, pageNumber: null };
    }
    const tokens = value.split(/[-/]/).map((part) => part.trim()).filter(Boolean);
    let bookNumber = null;
    let pageNumber = null;
    if (tokens.length >= 2) {
      const bookCandidate = Number(tokens[0].replace(/[^\d]/g, ""));
      const pageCandidate = Number(tokens[1].replace(/[^\d]/g, ""));
      bookNumber = Number.isFinite(bookCandidate) && !Number.isNaN(bookCandidate) ? bookCandidate : null;
      pageNumber = Number.isFinite(pageCandidate) && !Number.isNaN(pageCandidate) ? pageCandidate : null;
    }
    return { bookNumber, pageNumber };
  };

  // Create deed files for every sale row (even $0)
  saleRows.forEach((row, idx) => {
    const { bookNumber, pageNumber } = parseBookAndPage(row.bookPage);
    const deedObj = {
      parcel_identifier: parcelId,
      document_identifier: row.bookPage || null,
      recording_book_number: bookNumber,
      recording_page_number: pageNumber,
    };
    const deedSourceFields = {};
    if (row.bookPageRaw) deedSourceFields.document_identifier_text = row.bookPageRaw;
    if (row.dateRaw) deedSourceFields.sale_date_text = row.dateRaw;
    if (row.amountRaw) deedSourceFields.sale_amount_text = row.amountRaw;
    addSelectorSource(
      deedSourceFields,
      row.bookPagePrimarySelector,
      row.bookPageRaw || row.bookPage,
    );
    addSelectorSource(
      deedSourceFields,
      `#SaleAmount${row.rowIndex}`,
      row.amountRaw || row.amountText,
    );
    addSelectorSource(
      deedSourceFields,
      `#SaleDate${row.rowIndex}`,
      row.dateRaw || row.dateTxt,
    );
    if (Object.keys(deedSourceFields).length > 0) {
      deedObj.source_fields = deedSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
    );
  });

  // Create sales files for every sale row that contains any usable data
  const saleRecords = saleRows.filter((row) => {
    return (
      row.amount != null ||
      !!row.iso ||
      (row.bookPage && row.bookPage.length > 0) ||
      (row.dateRaw && row.dateRaw.length > 0)
    );
  });
  saleRecords.forEach((s, idx) => {
    const saleObj = {
      parcel_identifier: parcelId,
    };
    if (s.iso) {
      saleObj.ownership_transfer_date = s.iso;
    }
    if (s.amount != null) {
      saleObj.purchase_price_amount = s.amount;
    }
    if (s.bookPage) {
      saleObj.document_identifier = s.bookPage;
    }
    const saleSourceFields = {};
    if (s.dateRaw) saleSourceFields.sale_date_text = s.dateRaw;
    if (s.amountRaw) saleSourceFields.purchase_price_amount_text = s.amountRaw;
    if (s.bookPageRaw) saleSourceFields.document_identifier_text = s.bookPageRaw;
    addSelectorSource(
      saleSourceFields,
      `#SaleAmount${s.rowIndex}`,
      s.amountRaw || s.amountText,
    );
    addSelectorSource(
      saleSourceFields,
      s.bookPagePrimarySelector,
      s.bookPageRaw || s.bookPage,
    );
    addSelectorSource(
      saleSourceFields,
      `#SaleDate${s.rowIndex}`,
      s.dateRaw || s.dateTxt,
    );
    if (Object.keys(saleSourceFields).length > 0) {
      saleObj.source_fields = saleSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `sale_${idx + 1}.json`),
      JSON.stringify(saleObj, null, 2),
    );
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
      // Handle mixed owner types (persons and companies)
      let personIdx = 1;
      let companyIdx = 1;

      curr.forEach((owner) => {
        if (owner.type === "company") {
          const comp = {
            parcel_identifier: parcelId,
            name: owner.name || null,
          };
          const filename = `company_${companyIdx}.json`;
          fs.writeFileSync(
            path.join(dataDir, filename),
            JSON.stringify(comp, null, 2),
          );
          companyIdx++;
        } else if (owner.type === "person") {
          const person = {
            parcel_identifier: parcelId,
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
          personIdx++;
        }
      });
    }
  }

  if (ownerEntry && ownerEntry.mailing_address) {
    const mailing = {
      ...ownerEntry.mailing_address,
      parcel_identifier: parcelId,
    };
    fs.writeFileSync(
      path.join(dataDir, "mailing_address.json"),
      JSON.stringify(mailing, null, 2),
    );
  }

  // Utilities from owners/utilities_data.json
  const utilsEntry = utils[ownerKey];
  if (utilsEntry) {
    const utilityRecord = {
      ...utilsEntry,
      parcel_identifier: parcelId,
    };
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilityRecord, null, 2),
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
        if (typeof lay.is_finished !== 'boolean') {
          // Default: exterior spaces are not finished, interior spaces are finished
          lay.is_finished = lay.is_exterior === false;
        }

        const layoutRecord = {
          ...lay,
          parcel_identifier: parcelId,
        };
        fs.writeFileSync(
          path.join(dataDir, `layout_${layoutIdx}.json`),
          JSON.stringify(layoutRecord, null, 2),
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
        parcel_identifier: parcelId,
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
    parcel_identifier: parcelId,
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

  // Building permits and certificates of occupancy
  $("#PermitAdditional tr[id^=TrPermit]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrPermit(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const permitNumber = getCellText($, `#permitno${idx}`);
    const permitType = getCellText($, `#permittype${idx}`);
    const issuer = getCellText($, `#issuer${idx}`);
    const issueDateText = getCellText($, `#IssuedDate${idx}`);
    const coDateText = getCellText($, `#codate${idx}`);
    const issueDate = parseDateToISO(issueDateText || "");
    const coDate = parseDateToISO(coDateText || "");
    const taxYearText = getCellText($, `#taxyear${idx}`);
    const taxYearPermit = toNumberCurrency(taxYearText);
    const hasAnyRawValue = [
      permitNumber,
      permitType,
      issuer,
      issueDateText,
      coDateText,
      taxYearText,
    ].some((value) => value != null && String(value).trim().length > 0);

    if (!hasAnyRawValue && taxYearPermit == null) {
      return;
    }

    const permitObj = {
      parcel_identifier: parcelId,
      permit_identifier: permitNumber,
      permit_type_description: permitType,
      issuing_authority: issuer,
      permit_issue_date: issueDate,
      certificate_of_occupancy_date: coDate,
      tax_year: taxYearPermit != null ? Math.trunc(taxYearPermit) : null,
    };
    const permitSourceFields = {};
    if (issueDateText) permitSourceFields.permit_issue_date_text = issueDateText;
    addSelectorSource(
      permitSourceFields,
      `#IssuedDate${idx}`,
      issueDateText,
    );
    if (coDateText)
      permitSourceFields.certificate_of_occupancy_date_text = coDateText;
    addSelectorSource(permitSourceFields, `#codate${idx}`, coDateText);
    if (taxYearText) permitSourceFields.tax_year_text = taxYearText;
    addSelectorSource(permitSourceFields, `#taxyear${idx}`, taxYearText);
    if (Object.keys(permitSourceFields).length > 0) {
      permitObj.source_fields = permitSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `permit_${idx}.json`),
      JSON.stringify(permitObj, null, 2),
    );
  });

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
  const landText = getCellText($, "#LandJustValue");
  const landRaw = getRawSelectorText($, "#LandJustValue");
  const land = toNumberCurrency(landText);
  const imprText = getCellText($, "#ImprovementsJustValue");
  const imprRaw = getRawSelectorText($, "#ImprovementsJustValue");
  const impr = toNumberCurrency(imprText);
  const justText = getCellText($, "#TotalJustValue");
  const justRaw = getRawSelectorText($, "#TotalJustValue");
  const just = toNumberCurrency(justText);
  let assessedText = getCellText($, "#TdDetailCountyAssessedValue");
  let assessedRaw = getRawSelectorText($, "#TdDetailCountyAssessedValue");
  let assessed = toNumberCurrency(assessedText);
  let assessedSourceText = assessedRaw || assessedText;
  const schoolAssessedText = getCellText($, "#HistorySchoolAssessedValue1");
  const schoolAssessedRaw = getRawSelectorText(
    $,
    "#HistorySchoolAssessedValue1",
  );
  let schoolAssessedSourceText =
    schoolAssessedRaw || schoolAssessedText || null;
  if (assessed == null && schoolAssessedText) {
    assessed = toNumberCurrency(schoolAssessedText);
    assessedText = schoolAssessedText;
    assessedSourceText = schoolAssessedSourceText;
  }
  let taxableText = getCellText($, "#CountyTaxableValue");
  let taxableRaw = getRawSelectorText($, "#CountyTaxableValue");
  let taxable = toNumberCurrency(taxableText);
  let taxableSourceText = taxableRaw || taxableText;
  if (taxable == null) {
    const taxableFallbackText = getCellText($, "#TdDetailCountyTaxableValue");
    const taxableFallbackRaw = getRawSelectorText(
      $,
      "#TdDetailCountyTaxableValue",
    );
    if (taxableFallbackText) {
      taxable = toNumberCurrency(taxableFallbackText);
      taxableText = taxableFallbackText;
      taxableSourceText = taxableFallbackRaw || taxableFallbackText;
    }
  }
  let yearlyText = getCellText($, "#TotalTaxes");
  let yearlyRaw = getRawSelectorText($, "#TotalTaxes");
  let yearly = toNumberCurrency(yearlyText);
  let yearlySourceText = yearlyRaw || yearlyText;
  if (yearly == null) {
    const tableYearlyText = getCellText(
      $,
      "#TblAdValoremAdditionalTotal #TotalAdvTaxes",
    );
    const tableYearlyRaw = getRawSelectorText(
      $,
      "#TblAdValoremAdditionalTotal #TotalAdvTaxes",
    );
    if (tableYearlyText) {
      const parsed = toNumberCurrency(tableYearlyText);
      if (parsed != null) {
        yearly = parsed;
        yearlyText = tableYearlyText;
        yearlySourceText = tableYearlyRaw || tableYearlyText;
      }
    }
  }
  const totalTaxesAltText = getCellText(
    $,
    "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
  );
  const totalTaxesAltRaw = getRawSelectorText(
    $,
    "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
  );
  if (yearly == null && totalTaxesAltText) {
    const altYearly = toNumberCurrency(totalTaxesAltText);
    if (altYearly != null) {
      yearly = altYearly;
      yearlyText = totalTaxesAltText;
      yearlySourceText = totalTaxesAltRaw || totalTaxesAltText;
    }
  }
  const totalAdValoremTaxesText = getCellText($, "#TotalAdvTaxes");
  const totalAdValoremTaxesRaw = getRawSelectorText($, "#TotalAdvTaxes");
  const totalAdValoremTaxes = toNumberCurrency(totalAdValoremTaxesText);
  const totalNonAdValoremTaxesText = getCellText($, "#TotalNAdvTaxes");
  const totalNonAdValoremRaw = getRawSelectorText($, "#TotalNAdvTaxes");
  const totalNonAdValoremTaxes = toNumberCurrency(
    totalNonAdValoremTaxesText,
  );
  const schoolTaxableValueText = getCellText($, "#SchoolTaxableValue");
  const schoolTaxableValueRaw = getRawSelectorText($, "#SchoolTaxableValue");
  const schoolTaxableValue = toNumberCurrency(schoolTaxableValueText);
  const nonSchoolAddlHomesteadText = getCellText(
    $,
    "#NonSchoolAddHmstdExemptAmount",
  );
  const nonSchoolAddlHomesteadRaw = getRawSelectorText(
    $,
    "#NonSchoolAddHmstdExemptAmount",
  );
  const nonSchoolAddlHomestead = toNumberCurrency(
    nonSchoolAddlHomesteadText,
  );
  const countyMillageText = getCellText($, "#TdDetailCountyMillage");
  const countyMillageRaw = getRawSelectorText($, "#TdDetailCountyMillage");
  const countyMillage = toNumberCurrency(countyMillageText);
  const schoolMillageText = getCellText($, "#TdDetailSchoolMillage");
  const schoolMillageRaw = getRawSelectorText($, "#TdDetailSchoolMillage");
  const schoolMillage = toNumberCurrency(schoolMillageText);
  const otherMillageText = getCellText($, "#TdDetailOtherMillage");
  const otherMillageRaw = getRawSelectorText($, "#TdDetailOtherMillage");
  const otherMillage = toNumberCurrency(otherMillageText);
  const totalMillageText = getCellText($, "#TdDetailTotalMillage");
  const totalMillageRaw = getRawSelectorText($, "#TdDetailTotalMillage");
  const totalMillage = toNumberCurrency(totalMillageText);
  const sohBenefitAmountText = getCellText($, "#SohBenefit");
  const sohBenefitAmountRaw = getRawSelectorText($, "#SohBenefit");
  const sohBenefitAmount = toNumberCurrency(sohBenefitAmountText);
  let sohLabel = null;
  const sohRow = $("#SohBenefit").closest("tr");
  if (sohRow && sohRow.length) {
    const labelText = sohRow.find("td").first().text();
    if (labelText) sohLabel = labelText.replace(/\s+/g, " ").trim();
  }
  const sohDetailLabel = getCellText(
    $,
    "td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)",
  );
  if (!sohLabel && sohDetailLabel) {
    sohLabel = sohDetailLabel;
  }

  const summarySourceFields = {};
  if (landRaw || landText) {
    const value = landRaw || landText;
    summarySourceFields.land_just_value_text = value;
    addSelectorSource(summarySourceFields, "#LandJustValue", value);
  }
  if (imprRaw || imprText) {
    const value = imprRaw || imprText;
    summarySourceFields.improvements_just_value_text = value;
    addSelectorSource(summarySourceFields, "#ImprovementsJustValue", value);
  }
  if (justRaw || justText) {
    const value = justRaw || justText;
    summarySourceFields.total_just_value_text = value;
    addSelectorSource(summarySourceFields, "#TotalJustValue", value);
  }
  if (assessedSourceText) {
    summarySourceFields.county_assessed_value_text = assessedSourceText;
    addSelectorSource(
      summarySourceFields,
      ["#TdDetailCountyAssessedValue", "#CountyAssessedValue"],
      assessedSourceText,
    );
  }
  if (schoolAssessedSourceText) {
    summarySourceFields.school_assessed_value_text = schoolAssessedSourceText;
  }
  if (taxableSourceText) {
    summarySourceFields.county_taxable_value_text = taxableSourceText;
    addSelectorSource(
      summarySourceFields,
      ["#CountyTaxableValue", "#TdDetailCountyTaxableValue"],
      taxableSourceText,
    );
  }
  if (schoolTaxableValueRaw || schoolTaxableValueText) {
    const value = schoolTaxableValueRaw || schoolTaxableValueText;
    summarySourceFields.school_taxable_value_text = value;
    addSelectorSource(summarySourceFields, "#SchoolTaxableValue", value);
  }
  if (nonSchoolAddlHomesteadRaw || nonSchoolAddlHomesteadText) {
    const value = nonSchoolAddlHomesteadRaw || nonSchoolAddlHomesteadText;
    summarySourceFields.non_school_additional_homestead_exemption_amount_text =
      value;
    addSelectorSource(
      summarySourceFields,
      "#NonSchoolAddHmstdExemptAmount",
      value,
    );
  }
  if (totalAdValoremTaxesRaw || totalAdValoremTaxesText) {
    const value = totalAdValoremTaxesRaw || totalAdValoremTaxesText;
    summarySourceFields.total_ad_valorem_tax_amount_text = value;
    addSelectorSource(summarySourceFields, "#TotalAdvTaxes", value);
  }
  if (totalNonAdValoremRaw || totalNonAdValoremTaxesText) {
    const value = totalNonAdValoremRaw || totalNonAdValoremTaxesText;
    summarySourceFields.non_ad_valorem_tax_total_amount_text = value;
    addSelectorSource(summarySourceFields, "#TotalNAdvTaxes", value);
  }
  if (yearlySourceText) {
    summarySourceFields.total_tax_amount_text = yearlySourceText;
    addSelectorSource(summarySourceFields, "#TotalTaxes", yearlySourceText);
  }
  if (
    totalTaxesAltRaw &&
    totalTaxesAltRaw !== summarySourceFields.total_tax_amount_text
  ) {
    const value = totalTaxesAltRaw || totalTaxesAltText;
    summarySourceFields.total_tax_amount_additional_text = value;
    addSelectorSource(
      summarySourceFields,
      "div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)",
      value,
    );
  }
  if (countyMillageRaw || countyMillageText) {
    const value = countyMillageRaw || countyMillageText;
    summarySourceFields.county_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailCountyMillage", value);
  }
  if (schoolMillageRaw || schoolMillageText) {
    const value = schoolMillageRaw || schoolMillageText;
    summarySourceFields.school_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailSchoolMillage", value);
  }
  if (otherMillageRaw || otherMillageText) {
    const value = otherMillageRaw || otherMillageText;
    summarySourceFields.other_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailOtherMillage", value);
  }
  if (totalMillageRaw || totalMillageText) {
    const value = totalMillageRaw || totalMillageText;
    summarySourceFields.total_millage_rate_text = value;
    addSelectorSource(summarySourceFields, "#TdDetailTotalMillage", value);
  }
  if (sohBenefitAmountRaw || sohBenefitAmountText) {
    const value = sohBenefitAmountRaw || sohBenefitAmountText;
    summarySourceFields.save_our_homes_reduction_amount_text = value;
    addSelectorSource(summarySourceFields, "#SohBenefit", value);
  }
  if (sohDetailLabel) {
    summarySourceFields.save_our_homes_reduction_label_text = sohDetailLabel;
    addSelectorSource(
      summarySourceFields,
      "td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)",
      sohDetailLabel,
    );
  }

  let summaryTaxRecord = null;
  const summaryValues = [
    land,
    impr,
    just,
    assessed,
    taxable,
    yearly,
    totalAdValoremTaxes,
    totalNonAdValoremTaxes,
    schoolTaxableValue,
    nonSchoolAddlHomestead,
    countyMillage,
    schoolMillage,
    otherMillage,
    totalMillage,
    sohBenefitAmount,
  ];
  if (summaryValues.some((val) => val != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    summaryTaxRecord = {
      parcel_identifier: parcelId,
      tax_year: ty != null ? ty : null,
      property_assessed_value_amount:
        assessed != null ? assessed : just != null ? just : null,
      property_market_value_amount:
        just != null ? just : assessed != null ? assessed : null,
      property_building_amount: impr != null ? impr : null,
      property_land_amount: land != null ? land : null,
      property_taxable_value_amount:
        taxable != null ? taxable : assessed != null ? assessed : null,
      school_taxable_value_amount:
        schoolTaxableValue != null ? schoolTaxableValue : null,
      non_school_additional_homestead_exemption_amount:
        nonSchoolAddlHomestead != null ? nonSchoolAddlHomestead : null,
      ad_valorem_tax_total_amount:
        totalAdValoremTaxes != null ? totalAdValoremTaxes : null,
      non_ad_valorem_tax_total_amount:
        totalNonAdValoremTaxes != null ? totalNonAdValoremTaxes : null,
      total_tax_amount: yearly != null ? yearly : null,
      county_millage_rate: countyMillage != null ? countyMillage : null,
      school_millage_rate: schoolMillage != null ? schoolMillage : null,
      other_millage_rate: otherMillage != null ? otherMillage : null,
      total_millage_rate: totalMillage != null ? totalMillage : null,
      save_our_homes_reduction_description: sohLabel || null,
      save_our_homes_reduction_amount:
        sohBenefitAmount != null ? sohBenefitAmount : null,
      monthly_tax_amount: monthly,
      period_end_date: ty ? `${ty}-12-31` : null,
      period_start_date: ty ? `${ty}-01-01` : null,
      yearly_tax_amount: yearly != null ? yearly : null,
    };
    const sourceKeys = Object.keys(summarySourceFields).filter(
      (key) =>
        summarySourceFields[key] !== null &&
        summarySourceFields[key] !== undefined &&
        summarySourceFields[key] !== "",
    );
    if (sourceKeys.length > 0) {
      summaryTaxRecord.source_fields = sourceKeys.reduce((acc, key) => {
        acc[key] = summarySourceFields[key];
        return acc;
      }, {});
    }
  }

  const taxRecordMap = new Map();

  // Ad valorem taxing authorities (current year)
  $("#TblAdValoremAdditional tr[id^=TrAdValorem]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrAdValorem(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const name = getCellText($, `#TaName${idx}`);
    const category = getCellText($, `#TaxableType${idx}`);
    const taxableValueText = getCellText($, `#Taxable${idx}`);
    const taxableValue = toNumberCurrency(taxableValueText);
    const millageRateText = getCellText($, `#Millage${idx}`);
    const millageRate = toNumberCurrency(millageRateText);
    const taxAmountText = getCellText($, `#Tax${idx}`);
    const taxAmount = toNumberCurrency(taxAmountText);
    if (!name && taxAmount == null && taxableValue == null) return;
    const nameRaw = getRawSelectorText($, `#TaName${idx}`);
    const categoryRaw = getRawSelectorText($, `#TaxableType${idx}`);
    const taxableValueRaw = getRawSelectorText($, `#Taxable${idx}`);
    const millageRateRaw = getRawSelectorText($, `#Millage${idx}`);
    const taxAmountRaw = getRawSelectorText($, `#Tax${idx}`);
    const authObj = {
      parcel_identifier: parcelId,
      tax_authority_name: name,
      tax_category: category,
      taxable_value_amount: taxableValue != null ? taxableValue : null,
      millage_rate: millageRate != null ? millageRate : null,
      tax_amount: taxAmount != null ? taxAmount : null,
      tax_year: ty,
    };
    const authSourceFields = {};
    if (nameRaw || name)
      authSourceFields.tax_authority_name_text = nameRaw || name;
    addSelectorSource(authSourceFields, `#TaName${idx}`, nameRaw || name);
    if (categoryRaw || category)
      authSourceFields.tax_category_text = categoryRaw || category;
    addSelectorSource(
      authSourceFields,
      `#TaxableType${idx}`,
      categoryRaw || category,
    );
    if (taxableValueRaw || taxableValueText)
      authSourceFields.taxable_value_amount_text =
        taxableValueRaw || taxableValueText;
    addSelectorSource(
      authSourceFields,
      `#Taxable${idx}`,
      taxableValueRaw || taxableValueText,
    );
    if (millageRateRaw || millageRateText)
      authSourceFields.millage_rate_text =
        millageRateRaw || millageRateText;
    addSelectorSource(
      authSourceFields,
      `#Millage${idx}`,
      millageRateRaw || millageRateText,
    );
    if (taxAmountRaw || taxAmountText)
      authSourceFields.tax_amount_text = taxAmountRaw || taxAmountText;
    addSelectorSource(
      authSourceFields,
      `#Tax${idx}`,
      taxAmountRaw || taxAmountText,
    );
    if (Object.keys(authSourceFields).length > 0) {
      authObj.source_fields = authSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `taxing_authority_${idx}.json`),
      JSON.stringify(authObj, null, 2),
    );
  });

  // Non-ad valorem assessments
  $("#TblNonAdValoremAdditional tr[id^=TrNonAdValorem]").each((_, el) => {
    const idMatch = $(el).attr("id")?.match(/TrNonAdValorem(\d+)/);
    if (!idMatch) return;
    const idx = parseInt(idMatch[1], 10);
    const name = getCellText($, `#LANAME${idx}`);
    const chargeAmountText = getCellText($, `#TAX${idx}`);
    const chargeAmount = toNumberCurrency(chargeAmountText);
    if (!name && chargeAmount == null) return;
    const assessment = {
      parcel_identifier: parcelId,
      assessment_name: name,
      assessment_amount: chargeAmount != null ? chargeAmount : null,
      tax_year: ty,
    };
    const assessmentSourceFields = {};
    const nameRaw = getRawSelectorText($, `#LANAME${idx}`);
    const chargeAmountRaw = getRawSelectorText($, `#TAX${idx}`);
    if (nameRaw || name)
      assessmentSourceFields.assessment_name_text = nameRaw || name;
    addSelectorSource(assessmentSourceFields, `#LANAME${idx}`, nameRaw || name);
    if (chargeAmountRaw || chargeAmountText)
      assessmentSourceFields.assessment_amount_text =
        chargeAmountRaw || chargeAmountText;
    addSelectorSource(
      assessmentSourceFields,
      `#TAX${idx}`,
      chargeAmountRaw || chargeAmountText,
    );
    if (Object.keys(assessmentSourceFields).length > 0) {
      assessment.source_fields = assessmentSourceFields;
    }
    fs.writeFileSync(
      path.join(dataDir, `non_ad_valorem_assessment_${idx}.json`),
      JSON.stringify(assessment, null, 2),
    );
  });

  // From History (Tab6) for multiple years
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = $(`#HistoryTaxYear${idx}`).text().trim();
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);
    if (!yNum) continue;

    const landHText = getCellText($, `#HistoryLandJustValue${idx}`);
    const landHRaw = getRawSelectorText($, `#HistoryLandJustValue${idx}`);
    const landH = toNumberCurrency(landHText);
    const imprHText = getCellText($, `#HistoryImprovementsJustValue${idx}`);
    const imprHRaw = getRawSelectorText(
      $,
      `#HistoryImprovementsJustValue${idx}`,
    );
    const imprH = toNumberCurrency(imprHText);
    const justHText = getCellText($, `#HistoryTotalJustValue${idx}`);
    const justHRaw = getRawSelectorText($, `#HistoryTotalJustValue${idx}`);
    const justH = toNumberCurrency(justHText);
    const schoolAssessedText = getCellText(
      $,
      `#HistorySchoolAssessedValue${idx}`,
    );
    const schoolAssessedRaw = getRawSelectorText(
      $,
      `#HistorySchoolAssessedValue${idx}`,
    );
    const schoolAssessed = toNumberCurrency(schoolAssessedText);
    const countyAssessedText = getCellText(
      $,
      `#HistoryCountyAssessedValue${idx}`,
    );
    const countyAssessedRaw = getRawSelectorText(
      $,
      `#HistoryCountyAssessedValue${idx}`,
    );
    const countyAssessed = toNumberCurrency(countyAssessedText);
    const taxableHText = getCellText($, `#HistoryCountyTaxableValue${idx}`);
    const taxableHRaw = getRawSelectorText(
      $,
      `#HistoryCountyTaxableValue${idx}`,
    );
    const taxableH = toNumberCurrency(taxableHText);
    const schoolTaxableHText = getCellText(
      $,
      `#HistorySchoolTaxableValue${idx}`,
    );
    const schoolTaxableHRaw = getRawSelectorText(
      $,
      `#HistorySchoolTaxableValue${idx}`,
    );
    const schoolTaxableH = toNumberCurrency(schoolTaxableHText);
    const yearlyHText = getCellText($, `#HistoryTotalTaxes${idx}`);
    const yearlyHRaw = getRawSelectorText($, `#HistoryTotalTaxes${idx}`);
    const yearlyH = toNumberCurrency(yearlyHText);
    const nonSchoolBenefitText = getCellText(
      $,
      `#HistoryNonSchool10PctBenefit${idx}`,
    );
    const nonSchoolBenefitRaw = getRawSelectorText(
      $,
      `#HistoryNonSchool10PctBenefit${idx}`,
    );
    const nonSchoolBenefit = toNumberCurrency(nonSchoolBenefitText);
    const totalAdvTaxesHText = getCellText(
      $,
      `#HistoryTotalAdvTaxes${idx}`,
    );
    const totalAdvTaxesHRaw = getRawSelectorText(
      $,
      `#HistoryTotalAdvTaxes${idx}`,
    );
    const totalAdvTaxesH = toNumberCurrency(totalAdvTaxesHText);
    const otherMillageHText = getCellText($, `#HistoryOtherMillage${idx}`);
    const otherMillageHRaw = getRawSelectorText(
      $,
      `#HistoryOtherMillage${idx}`,
    );
    const otherMillageH = toNumberCurrency(otherMillageHText);
    const hasAnyRawValue = [
      landHText,
      imprHText,
      justHText,
      schoolAssessedText,
      countyAssessedText,
      taxableHText,
      schoolTaxableHText,
      yearlyHText,
      nonSchoolBenefitText,
      totalAdvTaxesHText,
      otherMillageHText,
    ].some((text) => text && text.trim().length > 0);
    const hasAnyNumericValue =
      landH != null ||
      imprH != null ||
      justH != null ||
      schoolAssessed != null ||
      countyAssessed != null ||
      taxableH != null ||
      schoolTaxableH != null ||
      yearlyH != null ||
      nonSchoolBenefit != null ||
      totalAdvTaxesH != null ||
      otherMillageH != null;

    if (yNum && (hasAnyNumericValue || hasAnyRawValue)) {
      years.push({
        idx,
        yNum,
        landH,
        landHRaw: landHRaw || null,
        landHText,
        imprH,
        imprHRaw: imprHRaw || null,
        imprHText,
        justH,
        justHRaw: justHRaw || null,
        justHText,
        schoolAssessed,
        schoolAssessedRaw: schoolAssessedRaw || null,
        schoolAssessedText,
        countyAssessed,
        countyAssessedRaw: countyAssessedRaw || null,
        countyAssessedText,
        taxableH,
        taxableHRaw: taxableHRaw || null,
        taxableHText,
        schoolTaxableH,
        schoolTaxableHRaw: schoolTaxableHRaw || null,
        schoolTaxableHText,
        yearlyH,
        yearlyHRaw: yearlyHRaw || null,
        yearlyHText,
        nonSchoolBenefit,
        nonSchoolBenefitRaw: nonSchoolBenefitRaw || null,
        nonSchoolBenefitText,
        totalAdvTaxesH,
        totalAdvTaxesHRaw: totalAdvTaxesHRaw || null,
        totalAdvTaxesHText,
        otherMillageH,
        otherMillageHRaw: otherMillageHRaw || null,
        otherMillageHText,
      });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const taxObj = {
      parcel_identifier: parcelId,
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.countyAssessed != null
          ? rec.countyAssessed
          : rec.schoolAssessed != null
            ? rec.schoolAssessed
            : rec.justH != null
              ? rec.justH
              : null,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.countyAssessed != null
            ? rec.countyAssessed
            : rec.schoolAssessed != null
              ? rec.schoolAssessed
              : null,
      property_building_amount: rec.imprH != null ? rec.imprH : null,
      property_land_amount: rec.landH != null ? rec.landH : null,
      property_taxable_value_amount:
        rec.taxableH != null
          ? rec.taxableH
          : rec.countyAssessed != null
            ? rec.countyAssessed
            : rec.schoolAssessed != null
              ? rec.schoolAssessed
              : null,
      school_taxable_value_amount:
        rec.schoolTaxableH != null ? rec.schoolTaxableH : null,
      non_school_additional_homestead_exemption_amount:
        rec.nonSchoolBenefit != null ? rec.nonSchoolBenefit : null,
      ad_valorem_tax_total_amount:
        rec.totalAdvTaxesH != null ? rec.totalAdvTaxesH : null,
      other_millage_rate:
        rec.otherMillageH != null ? rec.otherMillageH : null,
      monthly_tax_amount: monthly,
      period_end_date: `${rec.yNum}-12-31`,
      period_start_date: `${rec.yNum}-01-01`,
      yearly_tax_amount: rec.yearlyH != null ? rec.yearlyH : null,
    };
    const historySourceFields = {};
    const landHSource = rec.landHRaw || rec.landHText;
    if (landHSource) {
      historySourceFields.land_just_value_text = landHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryLandJustValue${rec.idx}`,
        landHSource,
      );
    }
    const imprHSource = rec.imprHRaw || rec.imprHText;
    if (imprHSource) {
      historySourceFields.improvements_just_value_text = imprHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryImprovementsJustValue${rec.idx}`,
        imprHSource,
      );
    }
    const justHSource = rec.justHRaw || rec.justHText;
    if (justHSource) {
      historySourceFields.total_just_value_text = justHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalJustValue${rec.idx}`,
        justHSource,
      );
    }
    const schoolAssessedSource =
      rec.schoolAssessedRaw || rec.schoolAssessedText;
    if (schoolAssessedSource)
      historySourceFields.school_assessed_value_text = schoolAssessedSource;
    const countyAssessedSource =
      rec.countyAssessedRaw || rec.countyAssessedText;
    if (countyAssessedSource) {
      historySourceFields.county_assessed_value_text = countyAssessedSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryCountyAssessedValue${rec.idx}`,
        countyAssessedSource,
      );
    }
    const taxableHSource = rec.taxableHRaw || rec.taxableHText;
    if (taxableHSource) {
      historySourceFields.county_taxable_value_text = taxableHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryCountyTaxableValue${rec.idx}`,
        taxableHSource,
      );
    }
    const schoolTaxableHSource =
      rec.schoolTaxableHRaw || rec.schoolTaxableHText;
    if (schoolTaxableHSource) {
      historySourceFields.school_taxable_value_text = schoolTaxableHSource;
      addSelectorSource(
        historySourceFields,
        `#HistorySchoolTaxableValue${rec.idx}`,
        schoolTaxableHSource,
      );
    }
    const yearlyHSource = rec.yearlyHRaw || rec.yearlyHText;
    if (yearlyHSource) {
      historySourceFields.total_tax_amount_text = yearlyHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalTaxes${rec.idx}`,
        yearlyHSource,
      );
    }
    const nonSchoolBenefitSource =
      rec.nonSchoolBenefitRaw || rec.nonSchoolBenefitText;
    if (nonSchoolBenefitSource) {
      historySourceFields.non_school_additional_homestead_exemption_amount_text =
        nonSchoolBenefitSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryNonSchool10PctBenefit${rec.idx}`,
        nonSchoolBenefitSource,
      );
    }
    const totalAdvTaxesHSource =
      rec.totalAdvTaxesHRaw || rec.totalAdvTaxesHText;
    if (totalAdvTaxesHSource) {
      historySourceFields.total_ad_valorem_tax_amount_text =
        totalAdvTaxesHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryTotalAdvTaxes${rec.idx}`,
        totalAdvTaxesHSource,
      );
    }
    const otherMillageHSource =
      rec.otherMillageHRaw || rec.otherMillageHText;
    if (otherMillageHSource) {
      historySourceFields.other_millage_rate_text = otherMillageHSource;
      addSelectorSource(
        historySourceFields,
        `#HistoryOtherMillage${rec.idx}`,
        otherMillageHSource,
      );
    }
    if (Object.keys(historySourceFields).length > 0) {
      taxObj.source_fields = historySourceFields;
    }
    const existing = taxRecordMap.get(rec.yNum);
    if (existing) {
      taxRecordMap.set(rec.yNum, mergeTaxRecords(existing, taxObj));
    } else {
      taxRecordMap.set(rec.yNum, taxObj);
    }
  });

  if (summaryTaxRecord) {
    if (summaryTaxRecord.tax_year == null) {
      const knownYears = Array.from(taxRecordMap.keys()).filter((year) =>
        Number.isFinite(year),
      );
      const fallbackYear =
        knownYears.length > 0
          ? Math.max(...knownYears)
          : ty != null
            ? ty
            : null;
      if (fallbackYear != null) {
        summaryTaxRecord.tax_year = fallbackYear;
        if (!summaryTaxRecord.period_start_date) {
          summaryTaxRecord.period_start_date = `${fallbackYear}-01-01`;
        }
        if (!summaryTaxRecord.period_end_date) {
          summaryTaxRecord.period_end_date = `${fallbackYear}-12-31`;
        }
      }
    }
    if (summaryTaxRecord.tax_year != null) {
      const existing = taxRecordMap.get(summaryTaxRecord.tax_year);
      if (existing) {
        taxRecordMap.set(
          summaryTaxRecord.tax_year,
          mergeTaxRecords(summaryTaxRecord, existing),
        );
      } else {
        taxRecordMap.set(summaryTaxRecord.tax_year, summaryTaxRecord);
      }
    }
  }

  removeFilesByPattern(dataDir, /^tax_\d+\.json$/);
  const sortedTaxRecords = Array.from(taxRecordMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, record]) => record);

  sortedTaxRecords.forEach((record, idx) => {
    fs.writeFileSync(
      path.join(dataDir, `tax_${idx + 1}.json`),
      JSON.stringify(record, null, 2),
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
