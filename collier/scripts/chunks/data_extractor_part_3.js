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
