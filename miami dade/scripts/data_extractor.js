const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  const content = fs.readFileSync(p, "utf8");
  // Check if it's HTML (error page) instead of JSON
  if (content.trim().startsWith('<')) {
    return null; // Return null for HTML error pages
  }
  return JSON.parse(content);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toTitleCase(name) {
  if (name == null) return null;
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])[a-z]/g, (s) => s.toUpperCase());
}

function formatNameForValidation(name) {
  if (!name || typeof name !== "string") return null;
  
  // Clean the name: remove special characters except spaces, hyphens, apostrophes, periods, commas
  let cleaned = name.trim().replace(/[^A-Za-z\s\-',.]/g, "");
  
  // If empty after cleaning, return null
  if (!cleaned) return null;
  
  // Apply title case formatting
  cleaned = cleaned
    .toLowerCase()
    .replace(/(^|[\s\-'])[a-z]/g, (s) => s.toUpperCase());
  
  // Check if it matches the required pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (pattern.test(cleaned)) {
    return cleaned;
  }
  
  // If it doesn't match, try to fix common issues
  // Remove multiple spaces and ensure proper capitalization
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // If still doesn't match, return null to avoid validation errors
  if (!pattern.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

function parseISODate(mdy) {
  if (!mdy) return null;
  // supports MM/DD/YYYY or M/D/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function mapDorToPropertyType(dorCode, dorDescription) {
  if (!dorCode || typeof dorCode !== "string" || dorCode.length < 2)
    return null;
  
  // Check for invalid 0000 REFERENCE FOLIO case
  if (dorCode === "0000" && dorDescription === "REFERENCE FOLIO") {
    return { 
      error: true, 
      message: `Invalid 0000 REFERENCE FOLIO - skipping transformation`,
      value: dorCode 
    };
  }
  
  const prefix = dorCode.slice(0, 2);
  switch (prefix) {
    case "00":
      return "VacantLand"; // VACANT : TOWNHOUSE
    case "01":
      return "SingleFamily";
    case "02":
      return "MobileHome";
    case "03":
      return "MultiFamilyMoreThan10";
    case "04":
      return "Condominium";
    case "05":
      return "Cooperative";
    case "08":
      return "MultiFamilyLessThan10";
    case "09":
      return "ResidentialCommonElementsAreas";
    case "10":
      // Check for specific vacant land cases
      if (dorCode === "1066" || dorCode === "1081") {
        return "VacantLand"; // VACANT LAND
      }
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "11":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "12":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "13":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "14":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "15":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "20":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "21":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "22":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "23":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "24":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "25":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "26":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "27":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "28":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "29":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "30":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "31":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "32":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "33":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "34":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "35":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "36":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "37":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "38":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "39":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "40":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "41":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "42":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "43":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "44":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "45":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "46":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "47":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "48":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    case "49":
      return { error: true, message: `Unknown enum value ${dorCode}`, value: dorCode };
    default:
      return { error: true, message: `Unknown enum value ${prefix}`, value: prefix };
  }
}


function normalizeSuffix(suf) {
  if (!suf) return null;
  const map = {
    // Standard mappings
    ST: "St",
    STREET: "St",
    STS: "Sts",
    AVE: "Ave",
    AVENUE: "Ave",
    AVES: "Aves",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    BLVDS: "Blvds",
    RD: "Rd",
    ROAD: "Rd",
    RDS: "Rds",
    DR: "Dr",
    DRIVE: "Dr",
    DRIVES: "Drs",
    LN: "Ln",
    LANE: "Ln",
    LANES: "Lns",
    CT: "Ct",
    COURT: "Ct",
    COURTS: "Cts",
    PL: "Pl",
    PLACE: "Pl",
    PLACES: "Pls",
    TER: "Ter",
    TERRACE: "Ter",
    TERRACES: "Ters",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    HIGHWAYS: "Hwys",
    
    // Additional enum values from validation schema
    LK: "Lk",
    LAKE: "Lk",
    LAKES: "Lks",
    PIKE: "Pike",
    PIKES: "Pikes",
    KY: "Ky",
    KEY: "Ky",
    KEYS: "Kys",
    VW: "Vw",
    VIEW: "Vw",
    VIEWS: "Vws",
    CURV: "Curv",
    CURVE: "Curv",
    CURVES: "Curvs",
    PSGE: "Psge",
    PASSAGE: "Psge",
    PASSAGES: "Psges",
    LDG: "Ldg",
    LODGE: "Ldg",
    LODGES: "Ldgs",
    MT: "Mt",
    MOUNT: "Mt",
    MOUNTAIN: "Mt",
    MOUNTAINS: "Mts",
    UN: "Un",
    UNION: "Un",
    UNIONS: "Uns",
    MDW: "Mdw",
    MEADOW: "Mdw",
    MEADOWS: "Mdws",
    VIA: "Via",
    VIAS: "Vias",
    COR: "Cor",
    CORNER: "Cor",
    CORNERS: "Cors",
    KYS: "Kys",
    VL: "Vl",
    VALLEY: "Vl",
    VALLEYS: "Vlys",
    PR: "Pr",
    PRAIRIE: "Pr",
    PRAIRIES: "Prs",
    CV: "Cv",
    COVE: "Cv",
    COVES: "Cvs",
    ISLE: "Isle",
    ISLAND: "Isle",
    ISLANDS: "Isles",
    LGT: "Lgt",
    LIGHT: "Lgt",
    LIGHTS: "Lgts",
    HBR: "Hbr",
    HARBOR: "Hbr",
    HARBORS: "Hbrs",
    BTM: "Btm",
    BOTTOM: "Btm",
    BOTTOMS: "Btms",
    HL: "Hl",
    HILL: "Hl",
    HILLS: "Hls",
    MEWS: "Mews",
    HLS: "Hls",
    PNES: "Pnes",
    PINES: "Pnes",
    LGTS: "Lgts",
    STRM: "Strm",
    STREAM: "Strm",
    STREAMS: "Strms",
    TRWY: "Trwy",
    THRUWAY: "Trwy",
    THRUWAYS: "Trwys",
    SKWY: "Skwy",
    SKYWAY: "Skwy",
    SKYWAYS: "Skwys",
    IS: "Is",
    EST: "Est",
    ESTATE: "Est",
    ESTATES: "Ests",
    EXTS: "Exts",
    EXTENSION: "Exts",
    EXTENSIONS: "Exts",
    ROW: "Row",
    ROWS: "Rows",
    RTE: "Rte",
    ROUTE: "Rte",
    ROUTES: "Rtes",
    FALL: "Fall",
    FALLS: "Falls",
    GTWY: "Gtwy",
    GATEWAY: "Gtwy",
    GATEWAYS: "Gtwys",
    WLS: "Wls",
    WELLS: "Wls",
    CLB: "Clb",
    CLUB: "Clb",
    CLUBS: "Clbs",
    FRK: "Frk",
    FORK: "Frk",
    FORKS: "Frks",
    CPE: "Cpe",
    CAPE: "Cpe",
    CAPES: "Cpes",
    FWY: "Fwy",
    FREEWAY: "Fwy",
    FREEWAYS: "Fwys",
    KNLS: "Knls",
    KNOLLS: "Knls",
    RDG: "Rdg",
    RIDGE: "Rdg",
    RIDGES: "Rdgs",
    JCT: "Jct",
    JUNCTION: "Jct",
    JUNCTIONS: "Jcts",
    RST: "Rst",
    REST: "Rst",
    RESTS: "Rsts",
    SPGS: "Spgs",
    SPRINGS: "Spgs",
    CIR: "Cir",
    CIRCLE: "Cir",
    CIRCLES: "Cirs",
    CRST: "Crst",
    CREST: "Crst",
    CRESTS: "Crsts",
    EXPY: "Expy",
    EXPRESSWAY: "Expy",
    EXPRESSWAYS: "Expys",
    SMT: "Smt",
    SUMMIT: "Smt",
    SUMMITS: "Smts",
    TRFY: "Trfy",
    TRAFFICWAY: "Trfy",
    TRAFFICWAYS: "Trfys",
    LAND: "Land",
    LANDS: "Lands",
    WAYS: "Ways",
    TRL: "Trl",
    TRAIL: "Trl",
    TRAILS: "Trls",
    WAY: "Way",
    WAYS: "Ways",
    TRLR: "Trlr",
    TRAILER: "Trlr",
    TRAILERS: "Trlrs",
    ALY: "Aly",
    ALLEY: "Aly",
    ALLEYS: "Alys",
    SPG: "Spg",
    SPRING: "Spg",
    SPRINGS: "Spgs",
    PKWY: "Pkwy",
    PARKWAY: "Pkwy",
    PARKWAYS: "Pkwys",
    CMN: "Cmn",
    COMMON: "Cmn",
    COMMONS: "Cmns",
    GRNS: "Grns",
    GREEN: "Grn",
    GREENS: "Grns",
    OVAL: "Oval",
    OVALS: "Ovals",
    CIRS: "Cirs",
    PT: "Pt",
    POINT: "Pt",
    POINTS: "Pts",
    SHLS: "Shls",
    SHOALS: "Shls",
    VLY: "Vly",
    VALLEY: "Vly",
    VALLEYS: "Vlys",
    HTS: "Hts",
    HEIGHTS: "Hts",
    CLF: "Clf",
    CLIFF: "Clf",
    CLIFFS: "Clfs",
    FLT: "Flt",
    FLAT: "Flt",
    FLATS: "Flts",
    MALL: "Mall",
    MALLS: "Malls",
    FRDS: "Frds",
    FORDS: "Frds",
    CYN: "Cyn",
    CANYON: "Cyn",
    CANYONS: "Cyns",
    LNDG: "Lndg",
    LANDING: "Lndg",
    LANDINGS: "Lndgs",
    RDGS: "Rdgs",
    INLT: "Inlt",
    INLET: "Inlt",
    INLETS: "Inlts",
    TRAK: "Trak",
    TRACK: "Trak",
    TRACKS: "Traks",
    BYU: "Byu",
    BAYOU: "Byu",
    BAYOUS: "Byus",
    VLGS: "Vlgs",
    VILLAGE: "Vlg",
    VILLAGES: "Vlgs",
    CTR: "Ctr",
    CENTER: "Ctr",
    CENTERS: "Ctrs",
    ML: "Ml",
    MILL: "Ml",
    MILLS: "Mls",
    CTS: "Cts",
    ARC: "Arc",
    ARCADE: "Arc",
    ARCADES: "Arcs",
    BND: "Bnd",
    BEND: "Bnd",
    BENDS: "Bnds",
    RIV: "Riv",
    RIVER: "Riv",
    RIVERS: "Rivs",
    FLDS: "Flds",
    FIELDS: "Flds",
    MTWY: "Mtwy",
    MOTORWAY: "Mtwy",
    MOTORWAYS: "Mtwys",
    MSN: "Msn",
    MISSION: "Msn",
    MISSIONS: "Msns",
    SHRS: "Shrs",
    SHORES: "Shrs",
    RUE: "Rue",
    RUES: "Rues",
    CRSE: "Crse",
    COURSE: "Crse",
    COURSES: "Crses",
    CRES: "Cres",
    CRESCENT: "Cres",
    CRESCENTS: "Cres",
    ANX: "Anx",
    ANEX: "Anx",
    ANEXES: "Anxes",
    DRS: "Drs",
    STS: "Sts",
    HOLW: "Holw",
    HOLLOW: "Holw",
    HOLLOWS: "Holws",
    VLG: "Vlg",
    PRTS: "Prts",
    PORTS: "Prts",
    STA: "Sta",
    STATION: "Sta",
    STATIONS: "Stas",
    FLD: "Fld",
    FIELD: "Fld",
    FIELDS: "Flds",
    XRD: "Xrd",
    CROSSROAD: "Xrd",
    CROSSROADS: "Xrds",
    WALL: "Wall",
    WALLS: "Walls",
    TPKE: "Tpke",
    TURNPIKE: "Tpke",
    TURNPIKES: "Tpkes",
    FT: "Ft",
    FORT: "Ft",
    FORTS: "Fts",
    BG: "Bg",
    BURG: "Bg",
    BURGS: "Bgs",
    KNL: "Knl",
    KNOLL: "Knl",
    KNOLLS: "Knls",
    PLZ: "Plz",
    PLAZA: "Plz",
    PLAZAS: "Plzs",
    CSWY: "Cswy",
    CAUSEWAY: "Cswy",
    CAUSEWAYS: "Cswys",
    BGS: "Bgs",
    RNCH: "Rnch",
    RANCH: "Rnch",
    RANCHES: "Rnchs",
    FRKS: "Frks",
    MTN: "Mtn",
    MOUNTAIN: "Mtn",
    MOUNTAINS: "Mtns",
    CTRS: "Ctrs",
    ORCH: "Orch",
    ORCHARD: "Orch",
    ORCHARDS: "Orchs",
    ISS: "Iss",
    ISLANDS: "Iss",
    BRKS: "Brks",
    BROOKS: "Brks",
    BR: "Br",
    BRANCH: "Br",
    BRANCHES: "Brs",
    FLS: "Fls",
    FALLS: "Fls",
    TRCE: "Trce",
    TRACE: "Trce",
    TRACES: "Trces",
    PARK: "Park",
    PARKS: "Parks",
    GDNS: "Gdns",
    GARDENS: "Gdns",
    RPD: "Rpd",
    RAPID: "Rpd",
    RAPIDS: "Rpds",
    SHL: "Shl",
    SHOAL: "Shl",
    SHOALS: "Shls",
    LF: "Lf",
    LOAF: "Lf",
    LOAVES: "Lfs",
    RPD: "Rpd",
    LCKS: "Lcks",
    LOCKS: "Lcks",
    GLN: "Gln",
    GLEN: "Gln",
    GLENS: "Glns",
    PATH: "Path",
    PATHS: "Paths",
    VIS: "Vis",
    VISTA: "Vis",
    VISTAS: "Viss",
    LKS: "Lks",
    RUN: "Run",
    RUNS: "Runs",
    FRG: "Frg",
    FORGE: "Frg",
    FORGES: "Frgs",
    BRG: "Brg",
    BRIDGE: "Brg",
    BRIDGES: "Brgs",
    SQS: "Sqs",
    SQUARE: "Sq",
    SQUARES: "Sqs",
    XING: "Xing",
    CROSSING: "Xing",
    CROSSINGS: "Xings",
    PLN: "Pln",
    PLAIN: "Pln",
    PLAINS: "Plns",
    GLNS: "Glns",
    BLFS: "Blfs",
    BLUFFS: "Blfs",
    PLNS: "Plns",
    DL: "Dl",
    DALE: "Dl",
    DALES: "Dls",
    CLFS: "Clfs",
    EXT: "Ext",
    PASS: "Pass",
    PASSAGE: "Pass",
    PASSAGES: "Passes",
    GDN: "Gdn",
    GARDEN: "Gdn",
    GARDENS: "Gdns",
    BRK: "Brk",
    BROOK: "Brk",
    BROOKS: "Brks",
    GRN: "Grn",
    MNR: "Mnr",
    MANOR: "Mnr",
    MANORS: "Mnrs",
    CP: "Cp",
    CAMP: "Cp",
    CAMPS: "Cps",
    PNE: "Pne",
    PINE: "Pne",
    PINES: "Pnes",
    SPUR: "Spur",
    SPURS: "Spurs",
    OPAS: "Opas",
    OVERPASS: "Opas",
    OVERPASSES: "Opases",
    UPAS: "Upas",
    UNDERPASS: "Upas",
    UNDERPASSES: "Upases",
    TUNL: "Tunl",
    TUNNEL: "Tunl",
    TUNNELS: "Tunls",
    SQ: "Sq",
    LCK: "Lck",
    LOCK: "Lck",
    LOCKS: "Lcks",
    ESTS: "Ests",
    SHR: "Shr",
    SHORE: "Shr",
    SHORES: "Shrs",
    DM: "Dm",
    DAM: "Dm",
    DAMS: "Dms",
    MLS: "Mls",
    WL: "Wl",
    WELL: "Wl",
    WELLS: "Wls",
    MNRS: "Mnrs",
    STRA: "Stra",
    STRAND: "Stra",
    STRANDS: "Stras",
    FRGS: "Frgs",
    FRST: "Frst",
    FOREST: "Frst",
    FORESTS: "Frsts",
    FLTS: "Flts",
    CT: "Ct",
    MTNS: "Mtns",
    FRD: "Frd",
    FORD: "Frd",
    FORDS: "Frds",
    NCK: "Nck",
    NECK: "Nck",
    NECKS: "Ncks",
    RAMP: "Ramp",
    RAMPS: "Ramps",
    VLYS: "Vlys",
    PTS: "Pts",
    BCH: "Bch",
    BEACH: "Bch",
    BEACHES: "Bchs",
    LOOP: "Loop",
    LOOPS: "Loops",
    BYP: "Byp",
    BYPASS: "Byp",
    BYPASSES: "Byps",
    CMNS: "Cmns",
    FRY: "Fry",
    FERRY: "Fry",
    FERRIES: "Fries",
    WALK: "Walk",
    WALKS: "Walks",
    HBRS: "Hbrs",
    DV: "Dv",
    DIVIDE: "Dv",
    DIVIDES: "Dvs",
    HVN: "Hvn",
    HAVEN: "Hvn",
    HAVENS: "Hvns",
    BLF: "Blf",
    BLUFF: "Blf",
    BLUFFS: "Blfs",
    GRV: "Grv",
    GROVE: "Grv",
    GROVES: "Grvs",
    CRK: "Crk",
    CREEK: "Crk",
    CREEKS: "Crks"
  };
  const key = String(suf).toUpperCase();
  return map[key] || null; // Return null for unmapped values to avoid validation errors
}

function validateAreaUnderAir(area) {
  if (!area) return null;
  
  // Convert to string and clean
  const areaStr = String(area).trim();
  if (!areaStr) return null;
  
  // Remove commas and extra spaces
  const cleaned = areaStr.replace(/,/g, '').replace(/\s+/g, ' ').trim();
  
  // Check if it matches numeric pattern (digits with optional decimal)
  const numericPattern = /^\d+(\.\d+)?$/;
  if (numericPattern.test(cleaned)) {
    return cleaned;
  }
  
  // If it doesn't match the pattern, return null to avoid validation errors
  return null;
}

function extractLotSizeFromLegal(desc) {
  if (!desc) return { width: null, length: null };
  // Expect pattern like "LOT SIZE     50.000 X   150"
  const m = /LOT SIZE\s+([\d.]+)\s*X\s*([\d.]+)/i.exec(desc);
  if (!m) return { width: null, length: null };
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  if (isNaN(a) || isNaN(b)) return { width: null, length: null };
  // Convention: width along street (smaller), depth is larger
  const width = Math.round(Math.min(a, b));
  const length = Math.round(Math.max(a, b));
  return { width, length };
}

function lotTypeFromSqft(sf) {
  if (sf == null) return null;
  const acres = Number(sf) / 43560;
  if (!isFinite(acres)) return null;
  return acres <= 0.25
    ? "LessThanOrEqualToOneQuarterAcre"
    : "GreaterThanOneQuarterAcre";
}

// Returns null or a non-empty string representation
function nonEmptyStringOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" || s === "0" ? null : s;
}

// For fields requiring at least two digits in the string (e.g., property.total_area)
function areaStringOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  return /\d{2,}/.test(s) ? s : null;
}

function main() {
  const inputPath = path.join("input.json");
  const addrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const input = readJson(inputPath);
  const unAddr = readJson(addrPath);
  // seed not strictly needed for extraction by rules, but read to satisfy spec availability
  const seed = readJson(seedPath);
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  ensureDir("data");

  // Handle failed API request (HTML error page)
  if (!input) {
    console.error("No valid property data found - likely a failed API request");
    process.exit(1); // Exit with error code to prevent processing
  }

  // PROPERTY
  const pInfo = input.PropertyInfo || {};
  const legal = input.LegalDescription || {};
  const building = input.Building || {};
  const siteAddr =
    Array.isArray(input.SiteAddress) && input.SiteAddress.length
      ? input.SiteAddress[0]
      : {};

  const dorCode = pInfo.DORCode || null;
  const dorDescription = pInfo.DORDescription || null;
  
  const mappedType = mapDorToPropertyType(dorCode, dorDescription);
  if (mappedType && mappedType.error) {
    const err = {
      type: "error",
      message: mappedType.message,
      path: "property.property_type",
      dorCode: dorCode,
      dorDescription: dorDescription
    };
    console.error(JSON.stringify(err));
    process.exit(1);
  }

  // Determine built years from BuildingInfos
  let builtYear = null;
  let effYear = null;
  if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
    const mainSegs = input.Building.BuildingInfos.filter(
      (b) => b && b.BuildingNo === 1 && b.SegNo === 1,
    );
    if (mainSegs.length) {
      const actuals = mainSegs.map((x) => x.Actual).filter((x) => x);
      const effs = mainSegs.map((x) => x.Effective).filter((x) => x);
      if (actuals.length) builtYear = Math.min(...actuals);
      if (effs.length) effYear = Math.min(...effs);
    }
  }
  if (!builtYear) {
    const yearBuiltNum =
      typeof pInfo.YearBuilt === "string"
        ? parseInt(pInfo.YearBuilt, 10)
        : pInfo.YearBuilt;
    if (Number.isFinite(yearBuiltNum)) builtYear = yearBuiltNum;
  }


  const property = {
    parcel_identifier: pInfo.FolioNumber || null,
    property_legal_description_text: legal.Description || null,
    property_structure_built_year: builtYear || null,
    property_effective_built_year: effYear || null,
    property_type: mappedType || null,
    number_of_units: pInfo.UnitCount != null ? Number(pInfo.UnitCount) : null,
    livable_floor_area: areaStringOrNull(pInfo.BuildingHeatedArea),
    area_under_air: validateAreaUnderAir(pInfo.BuildingHeatedArea),
    total_area: areaStringOrNull(pInfo.BuildingGrossArea),
    subdivision: pInfo.SubdivisionDescription || null,
    zoning: pInfo.PrimaryZoneDescription || null,
  };

  writeJson(path.join("data", "property.json"), property);

  // ADDRESS
  const mailing = input.MailingAddress || {};
  let postal = null,
    plus4 = null;
  if (unAddr.full_address && /\d{5}-\d{4}/.test(unAddr.full_address)) {
    const m = /(\d{5})-(\d{4})/.exec(unAddr.full_address);
    if (m) {
      postal = m[1];
      plus4 = m[2];
    }
  } else if (siteAddr.Zip && siteAddr.Zip.includes("-")) {
    const parts = siteAddr.Zip.split("-");
    postal = parts[0];
    plus4 = parts[1];
  } else if (unAddr.full_address && /(\d{5})/.test(unAddr.full_address)) {
    postal = /(\d{5})/.exec(unAddr.full_address)[1];
  }

  const address = {
    street_number:
      siteAddr.StreetNumber != null ? String(siteAddr.StreetNumber) : null,
    street_pre_directional_text: siteAddr.StreetPrefix || null,
    street_name:
      siteAddr.StreetName != null && String(siteAddr.StreetName).trim().length > 0 
        ? String(siteAddr.StreetName).trim() 
        : null,
    street_suffix_type: normalizeSuffix(siteAddr.StreetSuffix) || null,
    street_post_directional_text: siteAddr.StreetSuffixDirection
      ? siteAddr.StreetSuffixDirection
      : null,
    unit_identifier: siteAddr.Unit ? String(siteAddr.Unit) : null,
    city_name:
      (
        siteAddr.City ||
        pInfo.Municipality ||
        (unAddr.full_address ? unAddr.full_address.split(",")[1] : null) ||
        ""
      )
        .toString()
        .trim()
        .toUpperCase() || null,
    state_code: mailing.State || "FL",
    postal_code: postal || null,
    plus_four_postal_code: plus4 || null,
    country_code: "US",
    county_name: unAddr.county_jurisdiction || "Miami Dade",
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    municipality_name: pInfo.Municipality || null,
  };

  // Check if street name is extractable - throw error if not
  if (!address.street_name || address.street_name.trim().length === 0) {
    const err = {
      type: "error",
      message: "Street name is not extractable from property data",
      path: "address.street_name",
      value: siteAddr.StreetName || "null",
      folio: pInfo.FolioNumber || "unknown"
    };
    console.error(JSON.stringify(err));
    process.exit(1);
  }

  writeJson(path.join("data", "address.json"), address);

  // LOT
  const lotSizeRaw = pInfo.LotSize;
  let lotSize = null;
  if (lotSizeRaw != null && String(lotSizeRaw).trim() !== "") {
    const n = Number(lotSizeRaw);
    // Preserve fractional square footage when provided
    lotSize = isFinite(n) && n > 0 ? n : null;
  }

  const { width: lotWidth, length: lotLength } = extractLotSizeFromLegal(
    legal.Description || "",
  );

  // Fencing detection
  let fencingType = null;
  let fenceLengthStr = null;
  let fenceHeight = null;
  if (
    input.ExtraFeature &&
    Array.isArray(input.ExtraFeature.ExtraFeatureInfos)
  ) {
    for (const ef of input.ExtraFeature.ExtraFeatureInfos) {
      if (
        ef &&
        typeof ef.Description === "string" &&
        /fence/i.test(ef.Description)
      ) {
        const desc = ef.Description.toLowerCase();
        if (/chain.?link/i.test(desc)) {
          fencingType = "ChainLink";
        } else if (/wood/i.test(desc)) {
          fencingType = "Wood";
        } else if (/vinyl/i.test(desc)) {
          fencingType = "Vinyl";
        } else if (/aluminum/i.test(desc)) {
          fencingType = "Aluminum";
        } else if (/wrought.?iron/i.test(desc)) {
          fencingType = "WroughtIron";
        } else if (/bamboo/i.test(desc)) {
          fencingType = "Bamboo";
        } else if (/composite/i.test(desc)) {
          fencingType = "Composite";
        } else if (/privacy/i.test(desc)) {
          fencingType = "Privacy";
        } else if (/picket/i.test(desc)) {
          fencingType = "Picket";
        } else if (/split.?rail/i.test(desc)) {
          fencingType = "SplitRail";
        } else if (/stockade/i.test(desc)) {
          fencingType = "Stockade";
        } else if (/board/i.test(desc)) {
          fencingType = "Board";
        } else if (/post.?and.?rail/i.test(desc)) {
          fencingType = "PostAndRail";
        } else if (/lattice/i.test(desc)) {
          fencingType = "Lattice";
        } else {
          fencingType = "Wood"; // Default to Wood
        }
        
        if (ef.Units != null) {
          const l = Math.round(Number(ef.Units));
          // Map to valid enum values
          if (l <= 25) fenceLengthStr = "25ft";
          else if (l <= 50) fenceLengthStr = "50ft";
          else if (l <= 75) fenceLengthStr = "75ft";
          else if (l <= 100) fenceLengthStr = "100ft";
          else if (l <= 150) fenceLengthStr = "150ft";
          else if (l <= 200) fenceLengthStr = "200ft";
          else if (l <= 300) fenceLengthStr = "300ft";
          else if (l <= 500) fenceLengthStr = "500ft";
          else if (l <= 1000) fenceLengthStr = "1000ft";
          else fenceLengthStr = "1000ft"; // Default to max
        }
        
        // Extract height from description (e.g., "4-5 ft high")
        const heightMatch = desc.match(/(\d+)-?(\d+)?\s*ft\s*high/i);
        if (heightMatch) {
          const height = parseInt(heightMatch[1]);
          // Map to valid enum values
          if (height <= 3) fenceHeight = "3ft";
          else if (height <= 4) fenceHeight = "4ft";
          else if (height <= 5) fenceHeight = "5ft";
          else if (height <= 6) fenceHeight = "6ft";
          else if (height <= 8) fenceHeight = "8ft";
          else if (height <= 10) fenceHeight = "10ft";
          else if (height <= 12) fenceHeight = "12ft";
          else fenceHeight = "6ft"; // Default
        }
        break;
      }
    }
  }

  const lot = {
    lot_type: lotTypeFromSqft(lotSize),
    lot_length_feet: lotLength != null ? lotLength : null,
    lot_width_feet: lotWidth != null ? lotWidth : null,
    lot_area_sqft: lotSize != null ? Math.round(lotSize) : null,
    landscaping_features: null,
    view: null,
    fencing_type: fencingType,
    fence_height: fenceHeight,
    fence_length: fenceLengthStr,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotSize != null ? lotSize / 43560 : null,
  };
  writeJson(path.join("data", "lot.json"), lot);

  // TAX
  if (input.Assessment && Array.isArray(input.Assessment.AssessmentInfos)) {
    const assessedByYear = new Map();
    for (const ai of input.Assessment.AssessmentInfos) {
      assessedByYear.set(ai.Year, ai);
    }
    const taxableByYear = new Map();
    if (input.Taxable && Array.isArray(input.Taxable.TaxableInfos)) {
      for (const ti of input.Taxable.TaxableInfos) {
        taxableByYear.set(ti.Year, ti);
      }
    }

    for (const [year, ai] of assessedByYear.entries()) {
      const ti = taxableByYear.get(year) || {};
      const tax = {
        tax_year: year != null ? Number(year) : null,
        property_assessed_value_amount:
          ai.AssessedValue != null ? Number(ai.AssessedValue) : null,
        property_market_value_amount:
          ai.TotalValue != null ? Number(ai.TotalValue) : null,
        property_building_amount:
          ai.BuildingOnlyValue != null ? Number(ai.BuildingOnlyValue) : null,
        property_land_amount:
          ai.LandValue != null ? Number(ai.LandValue) : null,
        property_taxable_value_amount:
          ti.SchoolTaxableValue != null ? Number(ti.SchoolTaxableValue) : null,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: null,
        first_year_on_tax_roll: null,
        first_year_building_on_tax_roll: null,
      };
      writeJson(path.join("data", `tax_${year}.json`), tax);
    }
  }

  // SALES + DEEDS + FILES (create one deed per sale; optionally create file per book/page or instrument)
  if (Array.isArray(input.SalesInfos) && input.SalesInfos.length) {
    let saleIndex = 1;
    /**
     * @typedef {Object} MiamiSaleMeta
     * @property {number} index
     * @property {string|null} date
     * @property {string|null} book
     * @property {string|null} page
     * @property {string|null} instrument
     * @property {string|null} saleType
     */
    /** @type {MiamiSaleMeta[]} */
    const salesFiles = [];

    /**
     * Extract a string value or null from an arbitrary field.
     * @param {unknown} v
     * @returns {string|null}
     */
    function asStringOrNull(v) {
      if (v == null) return null;
      const t = String(v).trim();
      return t === "" ? null : t;
    }

    /**
     * Map Miami-Dade SaleInstrument codes to Elephant Lexicon deed types.
     * @param {string|null} s
     * @returns {"Warranty Deed"|"Special Warranty Deed"|"Quitclaim Deed"|"Grant Deed"|"Bargain and Sale Deed"|"Lady Bird Deed"|"Transfer on Death Deed"|"Sheriff's Deed"|"Tax Deed"|"Trustee's Deed"|"Personal Representative Deed"|"Correction Deed"|"Deed in Lieu of Foreclosure"|"Life Estate Deed"|"Joint Tenancy Deed"|"Tenancy in Common Deed"|"Community Property Deed"|"Gift Deed"|"Interspousal Transfer Deed"|"Wild Deed"|"Special Master's Deed"|"Court Order Deed"|"Contract for Deed"|"Quiet Title Deed"|"Administrator's Deed"|"Guardian's Deed"|"Receiver's Deed"|"Right of Way Deed"|"Vacation of Plat Deed"|"Assignment of Contract"|"Release of Contract"}
     */
    function mapDeedType(s) {
      if (!s) return "Warranty Deed"; // Default to most common deed type
      const t = s.toUpperCase().trim();
      
      // Miami-Dade SaleInstrument code mappings
      switch (t) {
        case "QCD": return "Quitclaim Deed";
        case "DEE": return "Warranty Deed"; // General deed, assume warranty
        case "WDE": return "Warranty Deed";
        case "SWD": return "Special Warranty Deed";
        case "GRD": return "Grant Deed";
        case "BSD": return "Bargain and Sale Deed";
        case "LBD": return "Lady Bird Deed";
        case "TOD": return "Transfer on Death Deed";
        case "SHD": return "Sheriff's Deed";
        case "TXD": return "Tax Deed";
        case "TRD": return "Trustee's Deed";
        case "PRD": return "Personal Representative Deed";
        case "CRD": return "Correction Deed";
        case "DIL": return "Deed in Lieu of Foreclosure";
        case "LED": return "Life Estate Deed";
        case "JTD": return "Joint Tenancy Deed";
        case "TCD": return "Tenancy in Common Deed";
        case "CPD": return "Community Property Deed";
        case "GFT": return "Gift Deed";
        case "ITD": return "Interspousal Transfer Deed";
        case "WLD": return "Wild Deed";
        case "SMD": return "Special Master's Deed";
        case "COD": return "Court Order Deed";
        case "CFD": return "Contract for Deed";
        case "QTD": return "Quiet Title Deed";
        case "ADM": return "Administrator's Deed";
        case "GAD": return "Guardian's Deed";
        case "RCD": return "Receiver's Deed";
        case "RWD": return "Right of Way Deed";
        case "VPD": return "Vacation of Plat Deed";
        case "AOC": return "Assignment of Contract";
        case "ROC": return "Release of Contract";
        default: return "Warranty Deed"; // Default fallback
      }
    }

    /**
     * Map Miami-Dade SaleInstrument codes to Elephant Lexicon file document types.
     * @param {string|null} s
     * @returns {"ConveyanceDeedQuitClaimDeed"|"ConveyanceDeedBargainAndSaleDeed"|"ConveyanceDeedWarrantyDeed"|"ConveyanceDeed"|"AssignmentAssignmentOfDeedOfTrust"|"AssignmentAssignmentOfMortgage"|"AssignmentAssignmentOfRents"|"Assignment"|"AssignmentAssignmentOfTrade"|"AssignmentBlanketAssignment"|"AssignmentCooperativeAssignmentOfProprietaryLease"|"AffidavitOfDeath"|"AbstractOfJudgment"|"AttorneyInFactAffidavit"|"ArticlesOfIncorporation"|"BuildingPermit"|"ComplianceInspectionReport"|"ConditionalCommitment"|"CounselingCertification"|"AirportNoisePollutionAgreement"|"BreachNotice"|"BrokerPriceOpinion"|"AmendatoryClause"|"AssuranceOfCompletion"|"Bid"|"BuildersCertificationBuilderCertificationOfPlansAndSpecifications"|"BuildersCertificationBuildersCertificate"|"BuildersCertificationPropertyInspection"|"BuildersCertificationTermiteTreatment"|"PropertyImage"}
     */
    function mapFileDocType(s) {
      if (!s) return "ConveyanceDeedWarrantyDeed"; // Default to most common deed type
      const t = s.toUpperCase().trim();
      
      // Miami-Dade SaleInstrument code mappings to file document types
      switch (t) {
        case "QCD": return "ConveyanceDeedQuitClaimDeed";
        case "DEE": return "ConveyanceDeedWarrantyDeed"; // General deed, assume warranty
        case "WDE": return "ConveyanceDeedWarrantyDeed";
        case "SWD": return "ConveyanceDeedWarrantyDeed"; // Special warranty maps to warranty
        case "GRD": return "ConveyanceDeed";
        case "BSD": return "ConveyanceDeedBargainAndSaleDeed";
        case "LBD": return "ConveyanceDeed"; // Lady Bird Deed maps to general conveyance
        case "TOD": return "ConveyanceDeed"; // Transfer on Death maps to general conveyance
        case "SHD": return "ConveyanceDeed"; // Sheriff's Deed maps to general conveyance
        case "TXD": return "ConveyanceDeed"; // Tax Deed maps to general conveyance
        case "TRD": return "ConveyanceDeed"; // Trustee's Deed maps to general conveyance
        case "PRD": return "ConveyanceDeed"; // Personal Representative Deed maps to general conveyance
        case "CRD": return "ConveyanceDeed"; // Correction Deed maps to general conveyance
        case "DIL": return "ConveyanceDeed"; // Deed in Lieu of Foreclosure maps to general conveyance
        case "LED": return "ConveyanceDeed"; // Life Estate Deed maps to general conveyance
        case "JTD": return "ConveyanceDeed"; // Joint Tenancy Deed maps to general conveyance
        case "TCD": return "ConveyanceDeed"; // Tenancy in Common Deed maps to general conveyance
        case "CPD": return "ConveyanceDeed"; // Community Property Deed maps to general conveyance
        case "GFT": return "ConveyanceDeed"; // Gift Deed maps to general conveyance
        case "ITD": return "ConveyanceDeed"; // Interspousal Transfer Deed maps to general conveyance
        case "WLD": return "ConveyanceDeed"; // Wild Deed maps to general conveyance
        case "SMD": return "ConveyanceDeed"; // Special Master's Deed maps to general conveyance
        case "COD": return "ConveyanceDeed"; // Court Order Deed maps to general conveyance
        case "CFD": return "ConveyanceDeed"; // Contract for Deed maps to general conveyance
        case "QTD": return "ConveyanceDeed"; // Quiet Title Deed maps to general conveyance
        case "ADM": return "ConveyanceDeed"; // Administrator's Deed maps to general conveyance
        case "GAD": return "ConveyanceDeed"; // Guardian's Deed maps to general conveyance
        case "RCD": return "ConveyanceDeed"; // Receiver's Deed maps to general conveyance
        case "RWD": return "ConveyanceDeed"; // Right of Way Deed maps to general conveyance
        case "VPD": return "ConveyanceDeed"; // Vacation of Plat Deed maps to general conveyance
        case "AOC": return "AssignmentAssignmentOfContract";
        case "ROC": return "Assignment";
        default: return "ConveyanceDeedWarrantyDeed"; // Default fallback
      }
    }

    for (const s of input.SalesInfos) {
      const sales = {
        ownership_transfer_date: parseISODate(s.DateOfSale) || null,
        purchase_price_amount: s.SalePrice != null ? Number(s.SalePrice) : null,
      };
      writeJson(path.join("data", `sales_${saleIndex}.json`), sales);

      // Common Miami-Dade fields we might encounter
      const book =
        asStringOrNull(s.Book) ||
        asStringOrNull(s.OfficialRecordBook) ||
        asStringOrNull(s.DeedBook) ||
        null;
      const page =
        asStringOrNull(s.Page) ||
        asStringOrNull(s.OfficialRecordPage) ||
        asStringOrNull(s.DeedPage) ||
        null;
      const instrument =
        asStringOrNull(s.Instrument) ||
        asStringOrNull(s.InstrumentNumber) ||
        asStringOrNull(s.DocumentNumber) ||
        null;
      const saleType = asStringOrNull(s.SaleType) || asStringOrNull(s.DeedType) || asStringOrNull(s.SaleInstrument) || null;

      salesFiles.push({
        index: saleIndex,
        date: sales.ownership_transfer_date,
        book,
        page,
        instrument,
        saleType,
        EncodedRecordBookAndPage: s.EncodedRecordBookAndPage || null,
      });
      saleIndex++;
    }

    // Optional: create files when we have book/page or instrument
    /** @type {Map<number, number>} */
    const fileIndexBySale = new Map();
    let fileIdx = 1;
    for (const s of salesFiles) {
      if ((s.book && s.page) || s.instrument) {
        /** @type {{file_format:"txt",name:string,original_url:string|null,ipfs_url:null,document_type:ReturnType<typeof mapFileDocType>}} */
        const fileObj = {
          file_format: "txt",
          name: s.book && s.page
            ? `OR Book ${s.book} Page ${s.page}`
            : `Instrument ${s.instrument}`,
          // Construct Miami-Dade clerk URL using EncodedRecordBookAndPage
          original_url: s.EncodedRecordBookAndPage 
            ? `https://onlineservices.miamidadeclerk.gov/officialrecords/SearchResults?QS=${s.EncodedRecordBookAndPage}`
            : null,
          ipfs_url: null,
          document_type: mapFileDocType(s.saleType),
        };
        writeJson(path.join("data", `file_${fileIdx}.json`), fileObj);
        fileIndexBySale.set(s.index, fileIdx);
        fileIdx++;
      }
    }

    // Create deeds and map sale -> deed index
    /** @type {Map<number, number>} */
    const deedMap = new Map();
    let deedIdx = 1;
    for (const s of salesFiles) {
      const deed = {
        deed_type: mapDeedType(s.saleType),
        request_identifier: pInfo.FolioNumber || "unknown",
        source_http_request: {
          url: "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx",
          method: "GET",
          multiValueQueryString: {
            Operation: ["GetPropertySearchByFolio"],
            clientAppName: ["PropertySearch"],
            folioNumber: [pInfo.FolioNumber || "unknown"]
          }
        }
      };
      writeJson(path.join("data", `deed_${deedIdx}.json`), deed);
      deedMap.set(s.index, deedIdx);
      // relationship_property_deed (property → deed)
      const relPD = {
        to: { "/": `./deed_${deedIdx}.json` },
        from: { "/": "./property.json" },
      };
      writeJson(path.join("data", `relationship_property_deed_${deedIdx}.json`), relPD);
      deedIdx++;
    }

    // relationship_sales_deed (deed → sale)
    let relSDIdx = 1;
    for (const [sIndex, dIndex] of deedMap.entries()) {
      const relSD = {
        to: { "/": `./sales_${sIndex}.json` },
        from: { "/": `./deed_${dIndex}.json` },
      };
      writeJson(path.join("data", `relationship_sales_deed_${relSDIdx}.json`), relSD);
      relSDIdx++;
    }

    // relationship_deed_file (deed → file) when file exists for that sale
    let rdfIdx = 1;
    for (const [sIndex, dIndex] of deedMap.entries()) {
      const fIndex = fileIndexBySale.get(sIndex);
      if (!fIndex) continue;
      const relDF = {
        from: { "/": `./deed_${dIndex}.json` },
        to: { "/": `./file_${fIndex}.json` },
      };
      writeJson(path.join("data", `relationship_deed_file_${rdfIdx}.json`), relDF);
      rdfIdx++;
    }
  }

  // PERSON/COMPANY (owners)
  const ownersKey = `property_${(pInfo.FolioNumber || "").replace(/[^0-9\-]/g, "")}`; // expect 01-4103-033-0491
  const ownersPkg =
    owners[ownersKey] ||
    owners[
      `property_${(seed.parcel_id || "").replace(/(.{2})(.{4})(.{3})(.{4})/, "$1-$2-$3-$4")}`
    ] ||
    null;
  if (
    ownersPkg &&
    ownersPkg.owners_by_date &&
    Array.isArray(ownersPkg.owners_by_date.current)
  ) {
    const currentOwners = ownersPkg.owners_by_date.current;
    // choose person or company uniformly; here entries specify type
    let personCount = 0;
    let companyCount = 0;
    for (const o of currentOwners) {
      if (o.type === "person") personCount++;
      else if (o.type === "company") companyCount++;
    }

    let personIdx = 1;
    let companyIdx = 1;
    for (const o of currentOwners) {
      if (o.type === "person") {
        const person = {
          birth_date: null,
          first_name: formatNameForValidation(o.first_name),
          last_name: formatNameForValidation(o.last_name),
          middle_name: formatNameForValidation(o.middle_name),
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        writeJson(path.join("data", `person_${personIdx}.json`), person);
        personIdx++;
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        writeJson(path.join("data", `company_${companyIdx}.json`), company);
        companyIdx++;
      }
    }

    // relationships for sales → owners (use latest sales_1.json if exists)
    const salesFiles = fs
      .readdirSync("data")
      .filter((f) => /^sales_\d+\.json$/.test(f))
      .sort((a, b) => {
        const ai = parseInt(a.match(/(\d+)/)[1], 10);
        const bi = parseInt(b.match(/(\d+)/)[1], 10);
        return ai - bi;
      });
    if (salesFiles.length) {
      const lastSales = salesFiles[0]; // if only last is desired; spec does not define matching by date; link available sale
      let relIdx = 1;
      let p = 1;
      while (fs.existsSync(path.join("data", `person_${p}.json`))) {
        const rel = {
          to: { "/": `./person_${p}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_person${p > 1 ? `_${p}` : ""}.json`,
          ),
          rel,
        );
        p++;
        relIdx++;
      }
      let c = 1;
      while (fs.existsSync(path.join("data", `company_${c}.json`))) {
        const rel = {
          to: { "/": `./company_${c}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_company${c > 1 ? `_${c}` : ""}.json`,
          ),
          rel,
        );
        c++;
        relIdx++;
      }
    }
  }

  // UTILITY
  const utilsKey = ownersKey; // same pattern
  const utilPkg = utils[utilsKey] || null;
  if (utilPkg) {
    const utility = {
      cooling_system_type: utilPkg.cooling_system_type,
      heating_system_type: utilPkg.heating_system_type,
      public_utility_type: utilPkg.public_utility_type,
      sewer_type: utilPkg.sewer_type,
      water_source_type: utilPkg.water_source_type,
      plumbing_system_type: utilPkg.plumbing_system_type,
      plumbing_system_type_other_description:
        utilPkg.plumbing_system_type_other_description,
      electrical_panel_capacity: utilPkg.electrical_panel_capacity,
      electrical_wiring_type: utilPkg.electrical_wiring_type,
      hvac_condensing_unit_present: utilPkg.hvac_condensing_unit_present,
      electrical_wiring_type_other_description:
        utilPkg.electrical_wiring_type_other_description,
      solar_panel_present: utilPkg.solar_panel_present,
      solar_panel_type: utilPkg.solar_panel_type,
      solar_panel_type_other_description:
        utilPkg.solar_panel_type_other_description,
      smart_home_features: utilPkg.smart_home_features,
      smart_home_features_other_description:
        utilPkg.smart_home_features_other_description,
      hvac_unit_condition: utilPkg.hvac_unit_condition,
      solar_inverter_visible: utilPkg.solar_inverter_visible,
      hvac_unit_issues: utilPkg.hvac_unit_issues,
      electrical_panel_installation_date:
        utilPkg.electrical_panel_installation_date,
      electrical_rewire_date: utilPkg.electrical_rewire_date,
      hvac_capacity_kw: utilPkg.hvac_capacity_kw,
      hvac_capacity_tons: utilPkg.hvac_capacity_tons,
      hvac_equipment_component: utilPkg.hvac_equipment_component,
      hvac_equipment_manufacturer: utilPkg.hvac_equipment_manufacturer,
      hvac_equipment_model: utilPkg.hvac_equipment_model,
      hvac_installation_date: utilPkg.hvac_installation_date,
      hvac_seer_rating: utilPkg.hvac_seer_rating,
      hvac_system_configuration: utilPkg.hvac_system_configuration,
      plumbing_system_installation_date:
        utilPkg.plumbing_system_installation_date,
      sewer_connection_date: utilPkg.sewer_connection_date,
      solar_installation_date: utilPkg.solar_installation_date,
      solar_inverter_installation_date:
        utilPkg.solar_inverter_installation_date,
      solar_inverter_manufacturer: utilPkg.solar_inverter_manufacturer,
      solar_inverter_model: utilPkg.solar_inverter_model,
      water_connection_date: utilPkg.water_connection_date,
      water_heater_installation_date: utilPkg.water_heater_installation_date,
      water_heater_manufacturer: utilPkg.water_heater_manufacturer,
      water_heater_model: utilPkg.water_heater_model,
      well_installation_date: utilPkg.well_installation_date,
    };
    writeJson(path.join("data", "utility.json"), utility);
  }

  // LAYOUTS from owners/layout_data.json only (layout synthesis moved to layoutMapping.js)
  const layoutPkg = layouts[ownersKey] || null;
  if (layoutPkg && Array.isArray(layoutPkg.layouts)) {
    let idx = 1;
    for (const l of layoutPkg.layouts) {
      const layoutObj = {
        space_type: l.space_type ?? null,
        space_index: l.space_index ?? null,
        flooring_material_type: l.flooring_material_type ?? null,
        size_square_feet: l.size_square_feet ?? null,
        floor_level: l.floor_level ?? null,
        has_windows: l.has_windows ?? null,
        window_design_type: l.window_design_type ?? null,
        window_material_type: l.window_material_type ?? null,
        window_treatment_type: l.window_treatment_type ?? null,
        is_finished: l.is_finished ?? null,
        furnished: l.furnished ?? null,
        paint_condition: l.paint_condition ?? null,
        flooring_wear: l.flooring_wear ?? null,
        clutter_level: l.clutter_level ?? null,
        visible_damage: l.visible_damage ?? null,
        countertop_material: l.countertop_material ?? null,
        cabinet_style: l.cabinet_style ?? null,
        fixture_finish_quality: l.fixture_finish_quality ?? null,
        design_style: l.design_style ?? null,
        natural_light_quality: l.natural_light_quality ?? null,
        decor_elements: l.decor_elements ?? null,
        pool_type: l.pool_type ?? null,
        pool_equipment: l.pool_equipment ?? null,
        spa_type: l.spa_type ?? null,
        safety_features: l.safety_features ?? null,
        view_type: l.view_type ?? null,
        lighting_features: l.lighting_features ?? null,
        condition_issues: l.condition_issues ?? null,
        is_exterior: l.is_exterior ?? false,
        pool_condition: l.pool_condition ?? null,
        pool_surface_type: l.pool_surface_type ?? null,
        pool_water_quality: l.pool_water_quality ?? null,
        bathroom_renovation_date: l.bathroom_renovation_date ?? null,
        kitchen_renovation_date: l.kitchen_renovation_date ?? null,
        flooring_installation_date: l.flooring_installation_date ?? null,
        story_type: l.story_type ?? null,
        building_number: l.building_number ?? null,
        request_identifier: l.request_identifier ?? null,
        source_http_request: l.source_http_request ?? null,
        area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
        total_area_sq_ft: l.total_area_sq_ft ?? null,
        heated_area_sq_ft: l.heated_area_sq_ft ?? null,
        adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
      };
      writeJson(path.join("data", `layout_${idx}.json`), layoutObj);
      idx++;
    }
  }

  // STRUCTURE from input (set required to null where not provided)
  // Determine number of buildings from BuildingInfos
  let numberOfBuildings = null;
  if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
    const buildingNos = new Set();
    for (const b of input.Building.BuildingInfos) {
      if (b && b.BuildingNo != null) {
        const n = Number(b.BuildingNo);
        if (Number.isFinite(n)) buildingNos.add(n);
      }
    }
    if (buildingNos.size > 0) numberOfBuildings = buildingNos.size;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: pInfo && pInfo.UnitCount === 1 ? "Detached" : null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
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
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories:
      pInfo && pInfo.FloorCount != null ? Number(pInfo.FloorCount) : null,
    number_of_buildings: numberOfBuildings,
  };
  writeJson(path.join("data", "structure.json"), structure);
}

try {
  main();
  console.log("Extraction complete.");
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
}
