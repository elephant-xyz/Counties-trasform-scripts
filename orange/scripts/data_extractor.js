const fs = require("fs");
const path = require("path");

function readJSON(p) {
  const full = path.resolve(p);
  const raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw);
}

function ensureDir(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
}

function writeData(filename, obj) {
  const full = path.resolve("data", filename);
  fs.writeFileSync(full, JSON.stringify(obj, null, 2), "utf8");
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  // handles 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS'
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function roundCurrency(n) {
  if (n == null || isNaN(Number(n))) return null;
  return Number(Number(n).toFixed(2));
}

function throwEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  // Print to stdout and exit with non-zero to stop processing
  console.error(JSON.stringify(err));
  process.exit(1);
}

function mapPropertyType(bldgDorCode, descBldg) {
  // Primary: try to map from building DOR code
  if (bldgDorCode) {
    const code = String(bldgDorCode).trim();
    const mapped = mapBuildingDorCode(code);
    if (mapped) return mapped;
  }

  // Fallback: try description-based mapping
  if (descBldg) {
    const desc = String(descBldg).toUpperCase();
    if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
    if (desc.includes("MANUFACTURED HOME") || desc.includes("MOBILE HOME")) {
      return "ManufacturedHousing";
    }
    if (desc.includes("CONDOMINIUM")) return "Condominium";
    if (desc.includes("TOWNHOUSE")) return "Townhouse";
  }

  // If no mapping found, return null
  return null;
}

function mapBuildingDorCode(code) {
  const mappings = {
    // Manufactured/Mobile Homes
    '0200': 'ManufacturedHousing',
    '0201': 'MobileHome',
    '0202': 'ManufacturedHousing',
    '0203': 'Modular',
    '0210': 'ManufacturedHousing',
    '0450': 'ManufacturedHousing', // Condominium-Manufactured Home
    '0550': 'ManufacturedHousing', // Cooperatives Manufactured Home

    // Single Family
    '0100': 'SingleFamily',
    '0101': 'SingleFamily',
    '0102': 'SingleFamily',
    '0103': 'SingleFamily',
    '0104': 'SingleFamily',
    '0105': 'SingleFamily',
    '0106': 'SingleFamily',
    '0108': 'Modular', // Single Family Modular Home
    '0130': 'SingleFamily',
    '0131': 'SingleFamily',
    '0135': 'SingleFamily',
    '0140': 'SingleFamily',
    '0150': 'SingleFamily',
    '0194': 'SingleFamily',
    '0195': 'SingleFamily',
    '0196': 'SingleFamily',
    '0197': 'SingleFamily',

    // Townhouse
    '0120': 'Townhouse',
    '0121': 'Townhouse',
    '0122': 'Townhouse',
    '0123': 'Townhouse',
    '0151': 'Townhouse',
    '0154': 'Townhouse',

    // Multi-Family
    '0181': 'Duplex', // 1 Unit Of Duplex
    '0182': 'Duplex',
    '0812': 'Duplex',
    '0822': 'Duplex',
    '0813': '3Units', // Triplex
    '0823': '3Units',
    '0814': '4Units', // Quadraplex
    '0824': '4Units',
    '0801': 'SingleFamily', // Multi-Family 1 Unit (essentially single family)
    '0802': '2Units',
    '0803': '3Units',
    '0804': '4Units',
    '0805': 'MultiFamilyLessThan10',
    '0806': 'MultiFamilyLessThan10',
    '0800': 'MultiFamilyLessThan10',

    // Multi-Family Large
    '0300': 'MultiFamilyMoreThan10',
    '0301': 'MultiFamilyMoreThan10',
    '0303': 'MultiFamilyMoreThan10',
    '0310': 'MultiFamilyMoreThan10',
    '0311': 'MultiFamilyMoreThan10',
    '0314': 'MultiFamilyMoreThan10',
    '0315': 'MultiFamilyMoreThan10',
    '0321': 'MultiFamilyMoreThan10',
    '0349': 'MultiFamilyMoreThan10',

    // Condominium
    '0400': 'Condominium',
    '0401': 'Condominium',
    '0403': 'Condominium',
    '0471': 'Condominium',
    '0472': 'Condominium',
    '0473': 'Condominium',
    '0474': 'Condominium',
    '0475': 'Condominium',

    // Cooperative
    '0500': 'Cooperative',

    // Retirement
    '0600': 'Retirement',
    '0610': 'Retirement',
    '7400': 'Retirement',
    '7401': 'Retirement',

    // Timeshare
    '0430': 'Timeshare',
    '0940': 'Timeshare',
    '3906': 'Timeshare',
    '3999': 'Timeshare',

    // Common Areas
    '0900': 'ResidentialCommonElementsAreas',
    '0119': 'ResidentialCommonElementsAreas',
    '0019': 'ResidentialCommonElementsAreas',
    '0499': 'ResidentialCommonElementsAreas',

    // Vacant Land
    '0000': 'VacantLand',
    '0001': 'VacantLand',
    '0004': 'VacantLand',
    '0030': 'VacantLand',
    '0031': 'VacantLand',
    '0035': 'VacantLand',
    '0040': 'VacantLand',
    '1000': 'VacantLand',

    // Miscellaneous Residential
    '0175': 'MiscellaneousResidential', // Rooming House
    '0700': 'MiscellaneousResidential',
  };

  return mappings[code] || null;
}

function mapDeedType(deedDesc) {
  if (!deedDesc) return null;

  const desc = String(deedDesc).toUpperCase().trim();

  // Direct code matching (Orange County codes)
  const codeMap = {
    'WD': 'Warranty Deed',
    'WM': 'Warranty Deed',
    'QC': 'Quitclaim Deed',
    'QM': 'Quitclaim Deed',
    'SW': 'Special Warranty Deed',
    'SM': 'Special Warranty Deed',
    'SD': "Sheriff's Deed",
    'SDM': "Sheriff's Deed",
    'TD': 'Tax Deed',
    'TR': "Trustee's Deed",
    'TM': "Trustee's Deed",
    'PR': 'Personal Representative Deed',
    'PM': 'Personal Representative Deed',
    'EX': 'Personal Representative Deed',
    'EM': 'Personal Representative Deed',
    'AM': "Administrator's Deed",
    'GD': "Guardian's Deed",
    'RD': "Receiver's Deed",
    'CD': 'Correction Deed',
    'CT': 'Court Order Deed',
    'CM': 'Court Order Deed',
    'CO': 'Contract for Deed',
    'AG': 'Contract for Deed',
    'JD': 'Court Order Deed',
    'OT': 'Court Order Deed',
    'FS': 'Warranty Deed',
    'FM': 'Warranty Deed',
    'RM': 'Right of Way Deed',
    'RW': 'Right of Way Deed',
    'VA': 'Vacation of Plat Deed',
    'AA': 'Assignment of Contract',
    'RA': 'Release of Contract',
  };

  // Try direct code match
  for (const [code, deed] of Object.entries(codeMap)) {
    if (desc === code) return deed;
  }

  // Description fallbacks
  if (desc.includes('WARRANTY DEED') && !desc.includes('SPECIAL')) return 'Warranty Deed';
  if (desc.includes('SPECIAL WARRANTY')) return 'Special Warranty Deed';
  if (desc.includes('QUIT CLAIM') || desc.includes('QUITCLAIM')) return 'Quitclaim Deed';
  if (desc.includes('SHERIFF')) return "Sheriff's Deed";
  if (desc.includes('TAX DEED')) return 'Tax Deed';
  if (desc.includes('TRUSTEE')) return "Trustee's Deed";
  if (desc.includes('PERSONAL REP') || desc.includes('EXECUTOR') || desc.includes('EXECUTRIX')) {
    return 'Personal Representative Deed';
  }
  if (desc.includes('ADMINISTRATOR')) return "Administrator's Deed";
  if (desc.includes('GUARDIAN')) return "Guardian's Deed";
  if (desc.includes('RECEIVER')) return "Receiver's Deed";
  if (desc.includes('CORRECTIVE')) return 'Correction Deed';
  if (desc.includes('CERTIFICATE OF TITLE') || desc.includes('JUDGEMENT') || desc.includes('ORDER OF TAKING')) {
    return 'Court Order Deed';
  }
  if (desc.includes('CONTRACT FOR DEED') || desc.includes('AGREEMENT FOR DEED')) return 'Contract for Deed';
  if (desc.includes('FEE SIMPLE')) return 'Warranty Deed';
  if (desc.includes('RIGHT OF WAY')) return 'Right of Way Deed';
  if (desc.includes('VACATION OF PLAT')) return 'Vacation of Plat Deed';
  if (desc.includes('ASSIGNMENT')) return 'Assignment of Contract';
  if (desc.includes('RELEASE')) return 'Release of Contract';
  if (desc.includes('MISCELLANEOUS')) return 'Miscellaneous';

  // Cannot map - throw error for manual review (DM, MM, MS, GM)
  throwEnumError(deedDesc, "deed.deed_type");
}

function parseStreetSuffixFromAddress(addr) {
  if (!addr) return null;
  const parts = String(addr).trim().split(/\s+/);
  let suf = parts[parts.length - 1];
  suf = suf.replace(/[^A-Za-z]/g, "").toUpperCase();
  const map = {
    STREET: "St",
    ST: "St",
    AVENUE: "Ave",
    AVE: "Ave",
    BOULEVARD: "Blvd",
    BLVD: "Blvd",
    ROAD: "Rd",
    RD: "Rd",
    LANE: "Ln",
    LN: "Ln",
    DRIVE: "Dr",
    DR: "Dr",
    COURT: "Ct",
    CT: "Ct",
    PLACE: "Pl",
    PL: "Pl",
    TERRACE: "Ter",
    TER: "Ter",
    CIRCLE: "Cir",
    CIR: "Cir",
    WAY: "Way",
    LOOP: "Loop",
    PARKWAY: "Pkwy",
    PKWY: "Pkwy",
    PLAZA: "Plz",
    PLZ: "Plz",
    TRAIL: "Trl",
    TRL: "Trl",
    BEND: "Bnd",
    BND: "Bnd",
    CRESCENT: "Cres",
    CRES: "Cres",
    MANOR: "Mnr",
    MNR: "Mnr",
    SQUARE: "Sq",
    SQ: "Sq",
    CROSSING: "Xing",
    XING: "Xing",
    PATH: "Path",
    RUN: "Run",
    WALK: "Walk",
    ROW: "Row",
    ALLEY: "Aly",
    ALY: "Aly",
    BEACH: "Bch",
    BCH: "Bch",
    BRIDGE: "Br",
    BRG: "Br",
    BROOK: "Brk",
    BRK: "Brk",
    BROOKS: "Brks",
    BRKS: "Brks",
    BUG: "Bg",
    BG: "Bg",
    BUGS: "Bgs",
    BGS: "Bgs",
    CLUB: "Clb",
    CLB: "Clb",
    CLIFF: "Clf",
    CLF: "Clf",
    CLIFFS: "Clfs",
    CLFS: "Clfs",
    COMMON: "Cmn",
    CMN: "Cmn",
    COMMONS: "Cmns",
    CMNS: "Cmns",
    CORNER: "Cor",
    COR: "Cor",
    CORNERS: "Cors",
    CORS: "Cors",
    CREEK: "Crk",
    CRK: "Crk",
    COURSE: "Crse",
    CRSE: "Crse",
    CREST: "Crst",
    CRST: "Crst",
    CAUSEWAY: "Cswy",
    CSWY: "Cswy",
    COVE: "Cv",
    CV: "Cv",
    CANYON: "Cyn",
    CYN: "Cyn",
    DALE: "Dl",
    DL: "Dl",
    DAM: "Dm",
    DM: "Dm",
    DRIVES: "Drs",
    DRS: "Drs",
    DIVIDE: "Dv",
    DV: "Dv",
    ESTATE: "Est",
    EST: "Est",
    ESTATES: "Ests",
    ESTS: "Ests",
    EXPRESSWAY: "Expy",
    EXPY: "Expy",
    EXTENSION: "Ext",
    EXT: "Ext",
    EXTENSIONS: "Exts",
    EXTS: "Exts",
    FALL: "Fall",
    FALL: "Fall",
    FALLS: "Fls",
    FLS: "Fls",
    FLAT: "Flt",
    FLT: "Flt",
    FLATS: "Flts",
    FLTS: "Flts",
    FORD: "Frd",
    FRD: "Frd",
    FORDS: "Frds",
    FRDS: "Frds",
    FORGE: "Frg",
    FRG: "Frg",
    FORGES: "Frgs",
    FRGS: "Frgs",
    FORK: "Frk",
    FRK: "Frk",
    FORKS: "Frks",
    FRKS: "Frks",
    FOREST: "Frst",
    FRST: "Frst",
    FREEWAY: "Fwy",
    FWY: "Fwy",
    FIELD: "Fld",
    FLD: "Fld",
    FIELDS: "Flds",
    FLDS: "Flds",
    GARDEN: "Gdn",
    GDN: "Gdn",
    GARDENS: "Gdns",
    GDNS: "Gdns",
    GLEN: "Gln",
    GLN: "Gln",
    GLENS: "Glns",
    GLNS: "Glns",
    GREEN: "Grn",
    GRN: "Grn",
    GREENS: "Grns",
    GRNS: "Grns",
    GROVE: "Grv",
    GRV: "Grv",
    GROVES: "Grvs",
    GRVS: "Grvs",
    GATEWAY: "Gtwy",
    GTWY: "Gtwy",
    HARBOR: "Hbr",
    HBR: "Hbr",
    HARBORS: "Hbrs",
    HBRS: "Hbrs",
    HILL: "Hl",
    HL: "Hl",
    HILLS: "Hls",
    HLS: "Hls",
    HOLLOW: "Holw",
    HOLW: "Holw",
    HEIGHTS: "Hts",
    HTS: "Hts",
    HAVEN: "Hvn",
    HVN: "Hvn",
    HIGHWAY: "Hwy",
    HWY: "Hwy",
    INLET: "Inlt",
    INLT: "Inlt",
    ISLAND: "Is",
    IS: "Is",
    ISLANDS: "Iss",
    ISS: "Iss",
    ISLE: "Isle",
    SPUR: "Spur",
    JUNCTION: "Jct",
    JCT: "Jct",
    JUNCTIONS: "Jcts",
    JCTS: "Jcts",
    KNOLL: "Knl",
    KNL: "Knl",
    KNOLLS: "Knls",
    KNLS: "Knls",
    LOCK: "Lck",
    LCK: "Lck",
    LOCKS: "Lcks",
    LCKS: "Lcks",
    LODGE: "Ldg",
    LDG: "Ldg",
    LIGHT: "Lgt",
    LGT: "Lgt",
    LIGHTS: "Lgts",
    LGTS: "Lgts",
    LAKE: "Lk",
    LK: "Lk",
    LAKES: "Lks",
    LKS: "Lks",
    LANDING: "Lndg",
    LNDG: "Lndg",
    MALL: "Mall",
    MEWS: "Mews",
    MEADOW: "Mdw",
    MDW: "Mdw",
    MEADOWS: "Mdws",
    MDWS: "Mdws",
    MILL: "Ml",
    ML: "Ml",
    MILLS: "Mls",
    MLS: "Mls",
    MANORS: "Mnrs",
    MNRS: "Mnrs",
    MOUNT: "Mt",
    MT: "Mt",
    MOUNTAIN: "Mtn",
    MTN: "Mtn",
    MOUNTAINS: "Mtns",
    MTNS: "Mtns",
    OVERPASS: "Opas",
    OPAS: "Opas",
    ORCHARD: "Orch",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PIKE: "Pike",
    PLAIN: "Pln",
    PLN: "Pln",
    PLAINS: "Plns",
    PLNS: "Plns",
    PINE: "Pne",
    PNE: "Pne",
    PINES: "Pnes",
    PNES: "Pnes",
    PRAIRIE: "Pr",
    PR: "Pr",
    PORT: "Prt",
    PRT: "Prt",
    PORTS: "Prts",
    PRTS: "Prts",
    PASSAGE: "Psge",
    PSGE: "Psge",
    POINT: "Pt",
    PT: "Pt",
    POINTS: "Pts",
    PTS: "Pts",
    RADIAL: "Radl",
    RADL: "Radl",
    RAMP: "Ramp",
    REST: "Rst",
    RIDGE: "Rdg",
    RDG: "Rdg",
    RIDGES: "Rdgs",
    RDGS: "Rdgs",
    ROADS: "Rds",
    RDS: "Rds",
    RANCH: "Rnch",
    RNCH: "Rnch",
    RAPID: "Rpd",
    RPD: "Rpd",
    RAPIDS: "Rpds",
    RPDS: "Rpds",
    ROUTE: "Rte",
    RTE: "Rte",
    SHOAL: "Shl",
    SHL: "Shl",
    SHOALS: "Shls",
    SHLS: "Shls",
    SHORE: "Shr",
    SHR: "Shr",
    SHORES: "Shrs",
    SHRS: "Shrs",
    SKYWAY: "Skwy",
    SKWY: "Skwy",
    SUMMIT: "Smt",
    SMT: "Smt",
    SPRING: "Spg",
    SPG: "Spg",
    SPRINGS: "Spgs",
    SPGS: "Spgs",
    SQUARES: "Sqs",
    SQS: "Sqs",
    STATION: "Sta",
    STA: "Sta",
    STRAVENUE: "Stra",
    STRA: "Stra",
    STREAM: "Strm",
    STRM: "Strm",
    STREETS: "Sts",
    STS: "Sts",
    THROUGHWAY: "Trwy",
    TRWY: "Trwy",
    TRACE: "Trce",
    TRCE: "Trce",
    TRAFFICWAY: "Trfy",
    TRFY: "Trfy",
    TRAILER: "Trlr",
    TRLR: "Trlr",
    TUNNEL: "Tunl",
    TUNL: "Tunl",
    UNION: "Un",
    UN: "Un",
    UNIONS: "Uns",
    UNS: "Uns",
    UNDERPASS: "Upas",
    UPAS: "Upas",
    VIEW: "Vw",
    VIEWS: "Vws",
    VILLAGE: "Vlg",
    VLG: "Vlg",
    VILLAGES: "Vlgs",
    VLGS: "Vlgs",
    VALLEY: "Vl",
    VLY: "Vl",
    VALLEYS: "Vlys",
    VLYS: "Vlys",
    WAYS: "Ways",
    VIA: "Via",
    WELL: "Wl",
    WL: "Wl",
    WELLS: "Wls",
    WLS: "Wls",
    CROSSROAD: "Xrd",
    XRD: "Xrd",
    CROSSROADS: "Xrds",
    XRDS: "Xrds",
  }
  return map[suf] || null; // If not found, leave null as allowed by schema
}

function main() {
  ensureDir("data");

  // Read inputs
  const input = readJSON("input.json");
  const addrSeed = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");
  const owners = readJSON(path.join("owners", "owner_data.json"));
  const utilities = readJSON(path.join("owners", "utilities_data.json"));
  const layouts = readJSON(path.join("owners", "layout_data.json"));

  // Resolve the active parcel id from input.json
  const pg = input.parcelGeneralProfile || {};
  const pqArr = Array.isArray(input.parcelQuickSearchSummary)
      ? input.parcelQuickSearchSummary
      : [];
  const parcelId =
      pg.parcelId || (pqArr[0] && pqArr[0].parcelId) || seed.parcel_id || null;

  // ---------------- Property ----------------
  const propertyObj = {};
  propertyObj.parcel_identifier = parcelId;

  // Extract property type from building features
  let propertyType = null;
  if (Array.isArray(input.parcelBuildingFeatures) && input.parcelBuildingFeatures.length > 0) {
    const bldg = input.parcelBuildingFeatures[0];
    propertyType = mapPropertyType(bldg.bldgDorCode, bldg.descBldg);
  }

  // Fallback to land features if building features don't provide type
  if (!propertyType && Array.isArray(input.parcelLandFeatures) && input.parcelLandFeatures.length > 0) {
    propertyType = mapPropertyType(
        input.parcelLandFeatures[0].landDorCode,
        input.parcelLandFeatures[0].descShort
    );
  }

  propertyObj.property_type = propertyType;
  // Built year from first building feature
  // Built year from first building feature
  if (
      Array.isArray(input.parcelBuildingFeatures) &&
      input.parcelBuildingFeatures.length > 0
  ) {
    const bldg = input.parcelBuildingFeatures[0];
    const d = toISODate(bldg.dateBuilt);
    propertyObj.property_structure_built_year = d
        ? Number(d.slice(0, 4))
        : null;
    // total area from grossArea if present
    if (bldg.grossArea != null) {
      propertyObj.total_area = String(bldg.grossArea);
    }
    // livable area from livingArea if present
    if (bldg.livingArea != null) {
      propertyObj.livable_floor_area = String(bldg.livingArea);
    } else {
      propertyObj.livable_floor_area = null;
    }
  } else {
    propertyObj.property_structure_built_year = null;
    propertyObj.livable_floor_area = null;
  }
  // number of units and type unknown
  propertyObj.number_of_units = null;
  propertyObj.number_of_units_type = null;
  // zoning
  if (
      Array.isArray(input.parcelLandFeatures) &&
      input.parcelLandFeatures.length > 0
  ) {
    propertyObj.zoning = input.parcelLandFeatures[0].zoning || null;
  } else {
    propertyObj.zoning = null;
  }
  // legal description
  propertyObj.property_legal_description_text =
      (input.parcelLegalDescription &&
          input.parcelLegalDescription.propertyDescription) ||
      null;
  propertyObj.property_effective_built_year = null;
  propertyObj.area_under_air = null;
  propertyObj.subdivision = null;
  // Write property.json
  writeData("property.json", propertyObj);

  // ---------------- Address ----------------
  const addressObj = {};
  addressObj.city_name =
      (
          pg.propertyCity ||
          (addrSeed.full_address && String(addrSeed.full_address).split(",")[1]) ||
          ""
      )
          .toString()
          .trim()
          .toUpperCase() || null;
  addressObj.country_code = null;
  // County name is from unnormalized_address
  addressObj.county_name = addrSeed.county_jurisdiction || null;
  addressObj.latitude =
      addrSeed.latitude != null ? Number(addrSeed.latitude) : null;
  addressObj.longitude =
      addrSeed.longitude != null ? Number(addrSeed.longitude) : null;
  addressObj.lot = null;
  addressObj.municipality_name = null;
  addressObj.plus_four_postal_code = null; // not available
  addressObj.postal_code =
      pg.propertyZip ||
      (addrSeed.full_address &&
      String(addrSeed.full_address).match(/\b(\d{5})(?:-\d{4})?$/)
          ? String(addrSeed.full_address).match(/\b(\d{5})(?:-\d{4})?$/)[1]
          : null);
  addressObj.range = null;
  addressObj.route_number = null;
  addressObj.section = null;
  addressObj.state_code =
      pg.propertyState ||
      (addrSeed.full_address &&
      String(addrSeed.full_address).match(/,\s*\w{2}\s*(\d{5})/)
          ? String(addrSeed.full_address).match(/,\s*(\w{2})\s*\d{5}/)[1]
          : null);
  addressObj.street_name = pg.streetName != null ? String(pg.streetName) : null;
  addressObj.street_number =
      pg.streetNumber != null ? String(pg.streetNumber) : null;
  addressObj.street_post_directional_text = null;
  addressObj.street_pre_directional_text = null;
  addressObj.street_suffix_type =
      parseStreetSuffixFromAddress(pg.propertyAddress) || null;
  addressObj.unit_identifier = null;
  addressObj.township = null;
  addressObj.block = null;
  // Write address.json
  writeData("address.json", addressObj);

  // ---------------- Lot ----------------
  const lotArea = input.parcelLandAreaSummary || {};
  const lotObj = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotArea.sqft != null ? Number(lotArea.sqft) : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotArea.acreage != null ? Number(lotArea.acreage) : null,
  };
  writeData("lot.json", lotObj);

  // ---------------- Utilities ----------------
  const utilKey = `property_${parcelId}`;
  const utilSource = utilities[utilKey];
  if (utilSource) {
    // Ensure required fields exist even if null
    const utilityObj = {
      cooling_system_type: utilSource.cooling_system_type ?? null,
      heating_system_type: utilSource.heating_system_type ?? null,
      public_utility_type: utilSource.public_utility_type ?? null,
      sewer_type: utilSource.sewer_type ?? null,
      water_source_type: utilSource.water_source_type ?? null,
      plumbing_system_type: utilSource.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
          utilSource.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utilSource.electrical_panel_capacity ?? null,
      electrical_wiring_type: utilSource.electrical_wiring_type ?? null,
      hvac_condensing_unit_present:
          utilSource.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
          utilSource.electrical_wiring_type_other_description ?? null,
      solar_panel_present: utilSource.solar_panel_present ?? null,
      solar_panel_type: utilSource.solar_panel_type ?? null,
      solar_panel_type_other_description:
          utilSource.solar_panel_type_other_description ?? null,
      smart_home_features: utilSource.smart_home_features ?? null,
      smart_home_features_other_description:
          utilSource.smart_home_features_other_description ?? null,
      hvac_unit_condition: utilSource.hvac_unit_condition ?? null,
      solar_inverter_visible: utilSource.solar_inverter_visible ?? null,
      hvac_unit_issues: utilSource.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
          utilSource.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilSource.electrical_rewire_date ?? null,
      hvac_capacity_kw: utilSource.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilSource.hvac_capacity_tons ?? null,
      hvac_equipment_component: utilSource.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer:
          utilSource.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilSource.hvac_equipment_model ?? null,
      hvac_installation_date: utilSource.hvac_installation_date ?? null,
      hvac_seer_rating: utilSource.hvac_seer_rating ?? null,
      hvac_system_configuration: utilSource.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
          utilSource.plumbing_system_installation_date ?? null,
      sewer_connection_date: utilSource.sewer_connection_date ?? null,
      solar_installation_date: utilSource.solar_installation_date ?? null,
      solar_inverter_installation_date:
          utilSource.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer:
          utilSource.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilSource.solar_inverter_model ?? null,
      water_connection_date: utilSource.water_connection_date ?? null,
      water_heater_installation_date:
          utilSource.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilSource.water_heater_manufacturer ?? null,
      water_heater_model: utilSource.water_heater_model ?? null,
      well_installation_date: utilSource.well_installation_date ?? null,
    };
    writeData("utility.json", utilityObj);
  }

  // ---------------- Layouts ----------------
  const layoutSource = layouts[utilKey];
  if (layoutSource && Array.isArray(layoutSource.layouts)) {
    layoutSource.layouts.forEach((ly, idx) => {
      const layoutObj = {
        space_type: ly.space_type ?? null,
        space_index: ly.space_index,
        flooring_material_type: ly.flooring_material_type ?? null,
        size_square_feet: ly.size_square_feet ?? null,
        floor_level: ly.floor_level ?? null,
        has_windows: ly.has_windows ?? null,
        window_design_type: ly.window_design_type ?? null,
        window_material_type: ly.window_material_type ?? null,
        window_treatment_type: ly.window_treatment_type ?? null,
        is_finished: ly.is_finished,
        furnished: ly.furnished ?? null,
        paint_condition: ly.paint_condition ?? null,
        flooring_wear: ly.flooring_wear ?? null,
        clutter_level: ly.clutter_level ?? null,
        visible_damage: ly.visible_damage ?? null,
        countertop_material: ly.countertop_material ?? null,
        cabinet_style: ly.cabinet_style ?? null,
        fixture_finish_quality: ly.fixture_finish_quality ?? null,
        design_style: ly.design_style ?? null,
        natural_light_quality: ly.natural_light_quality ?? null,
        decor_elements: ly.decor_elements ?? null,
        pool_type: ly.pool_type ?? null,
        pool_equipment: ly.pool_equipment ?? null,
        spa_type: ly.spa_type ?? null,
        safety_features: ly.safety_features ?? null,
        view_type: ly.view_type ?? null,
        lighting_features: ly.lighting_features ?? null,
        condition_issues: ly.condition_issues ?? null,
        is_exterior: ly.is_exterior,
        pool_condition: ly.pool_condition ?? null,
        pool_surface_type: ly.pool_surface_type ?? null,
        pool_water_quality: ly.pool_water_quality ?? null,
        bathroom_renovation_date: ly.bathroom_renovation_date ?? null,
        kitchen_renovation_date: ly.kitchen_renovation_date ?? null,
        flooring_installation_date: ly.flooring_installation_date ?? null,
      };
      writeData(`layout_${idx + 1}.json`, layoutObj);
    });
  }

  // ---------------- Structure ----------------
  const bld =
      Array.isArray(input.parcelBuildingFeatures) &&
      input.parcelBuildingFeatures.length > 0
          ? input.parcelBuildingFeatures[0]
          : {};
  const structureObj = {
    architectural_style_type: null,
    attachment_type: null,
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
    number_of_stories: bld && bld.floors != null ? Number(bld.floors) : null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    exterior_door_installation_date: null,
    foundation_repair_date: null,
    siding_installation_date: null,
    roof_date: null,
    window_installation_date: null,
  };
  writeData("structure.json", structureObj);

  // ---------------- Tax ----------------
  const taxesSummary = Array.isArray(input.parcelTotalTaxesSummary)
      ? input.parcelTotalTaxesSummary
      : [];
  const valuesByYear = Array.isArray(input.parcelPropertyValuesByYear)
      ? input.parcelPropertyValuesByYear
      : [];
  const valuesMap = new Map();
  valuesByYear.forEach((v) => {
    valuesMap.set(v.taxYear, v);
  });

  taxesSummary.forEach((ts) => {
    const yr = ts.taxYear;
    const v = valuesMap.get(yr);

    // Skip if tax year not found in parcelPropertyValuesByYear
    if (!v) return;

    const assessed = v.assessedValue ?? null;
    const market = v.marketValue ?? null;
    const land = v.landValue ?? null;
    const building = v.buildingValue ?? null;
    const exemptions =
        (v.originalHx || 0) +
        (v.additionalHx || 0) +
        (v.otherExemptions || 0) +
        (v.lis || 0);
    const taxable =
        v.assessedValue != null ? v.assessedValue - exemptions : null;
    const yearly = ts.grossTaxes != null ? Number(ts.grossTaxes) : null;
    const monthly = yearly != null ? roundCurrency(yearly / 12) : null;

    const taxObj = {
      tax_year: yr,
      property_assessed_value_amount: assessed,
      property_market_value_amount: market,
      property_building_amount: building,
      property_land_amount: land,
      property_taxable_value_amount: taxable,
      monthly_tax_amount: monthly,
      yearly_tax_amount: yearly != null ? roundCurrency(yearly) : null,
      period_start_date: `${yr}-01-01`,
      period_end_date: `${yr}-12-31`,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
    };
    writeData(`tax_${yr}.json`, taxObj);
  });

  // ---------------- Sales and Deeds ----------------
  const sales = Array.isArray(input.parcelSalesHistory)
      ? input.parcelSalesHistory
      : [];
  // sort by date asc
  sales.sort((a, b) => new Date(a.saleDate) - new Date(b.saleDate));
  const includedSales = [];
  sales.forEach((s) => {
    if (s.saleAmt == null) return;
    includedSales.push(s); // include zero-amount transfers as well
  });

  includedSales.forEach((s, idx) => {
    const isoDate = toISODate(s.saleDate);
    const saleObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: roundCurrency(Number(s.saleAmt)),
    };
    const saleName = `sales_${idx + 1}.json`;
    writeData(saleName, saleObj);

    // deed file for this sale
    const deedType = mapDeedType(s.deedDesc);
    const deedObj = { deed_type: deedType };
    const deedName = `deed_${idx + 1}.json`;
    writeData(deedName, deedObj);

    // relationship sales -> deed
    const relSD = {
      to: { "/": `./${saleName}` },
      from: { "/": `./${deedName}` },
    };
    writeData(`relationship_sales_deed_${idx + 1}.json`, relSD);
  });

  // ---------------- Owners (companies only) and relationships ----------------
  // Owners from owners/owner_data.json only
  const ownersByDate =
      (owners[`property_${parcelId}`] &&
          owners[`property_${parcelId}`].owners_by_date) ||
      {};

  // Collect unique companies
  const companyNameToFile = new Map();
  const companyList = [];
  const addCompany = (name) => {
    if (!name) return;
    const trimmed = String(name).trim().replace(/,+$/, "");
    if (!companyNameToFile.has(trimmed)) {
      companyList.push(trimmed);
      const fname = `company_${companyList.length}.json`;
      companyNameToFile.set(trimmed, fname);
      writeData(fname, { name: trimmed });
    }
  };

  // Pre-add all from owners_by_date (including current)
  Object.keys(ownersByDate).forEach((key) => {
    const arr = ownersByDate[key] || [];
    arr.forEach((entry) => {
      if (entry.type === "company") addCompany(entry.name);
    });
  });

  // Build relationships matching sales dates
  includedSales.forEach((s, idx) => {
    const isoDate = toISODate(s.saleDate);
    const ownersForDate = ownersByDate[isoDate] || [];
    ownersForDate.forEach((own, j) => {
      if (own.type !== "company") return; // ensure only company relationships
      const cName = String(own.name).trim().replace(/,+$/, "");
      const cFile = companyNameToFile.get(cName);
      if (!cFile) return;
      const rel = {
        to: { "/": `./${cFile}` },
        from: { "/": `./sales_${idx + 1}.json` },
      };
      writeData(`relationship_sales_company_${idx + 1}_${j + 1}.json`, rel);
    });
  });

  // Done
}

try {
  main();
  console.log("Extraction completed");
} catch (e) {
  // If we threw a structured enum error, it is already printed; otherwise print generic
  if (e && e.type === "error") {
    console.error(JSON.stringify(e));
  } else {
    console.error(e && e.stack ? e.stack : String(e));
  }
  process.exit(1);
}
