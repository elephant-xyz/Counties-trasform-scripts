const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function toTitleCase(str) {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function parseCurrency(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseIntSafe(str) {
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function validateEnum(value, allowedValues, className, propertyName) {
  if (value !== null && !allowedValues.includes(value)) {
    throw {
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: `${className}.${propertyName}`,
    };
  }
  return value;
}

function isoDateFromMDY(mdy) {
  if (!mdy) return null;
  const m = mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const m2 = mm.padStart(2, "0");
  const d2 = dd.padStart(2, "0");
  return `${yyyy}-${m2}-${d2}`;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  // Inputs
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const unnormalized = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners, utilities, layout
  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJSON(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJSON(utilitiesDataPath)
    : null;
  const layoutData = fs.existsSync(layoutDataPath)
    ? readJSON(layoutDataPath)
    : null;

  const parcelId =
    seed.parcel_id ||
    seed.parcelId ||
    seed.parcel ||
    (function () {
      let pid = null;
      $('th:contains("General Information")')
        .closest("table")
        .find("tr")
        .each((i, el) => {
          const tds = $(el).find("td");
          if (tds.length >= 2) {
            const label = $(tds.get(0)).text().trim();
            const val = $(tds.get(1)).text().trim();
            if (/Parcel ID/i.test(label)) pid = val;
          }
        });
      return pid;
    })();

  // ---------------- Property ----------------
  let legalDesc = null;
  const legalTable = $('th:contains("Legal Description")').closest("table");
  if (legalTable && legalTable.length) {
    const td = legalTable.find("td").first();
    if (td && td.length) legalDesc = td.text().trim();
  }

  // Buildings header row
  let yearBuilt = null;
  let effYear = null;
  let finishedBaseArea = null;
  let areasTotal = null;
  let baseArea = null;
  let carportFin = null;
  let utilityUnf = null;
  let numberOfStories = null;
  let structMap = {};

  const bHeader = $('th:contains("Improvement Type:")').first();
  if (bHeader && bHeader.length) {
    const text = bHeader.text();
    const mYB = text.match(/Year Built:\s*(\d{4})/i);
    const mEY = text.match(/Effective Year:\s*(\d{4})/i);
    yearBuilt = mYB ? parseInt(mYB[1], 10) : null;
    effYear = mEY ? parseInt(mEY[1], 10) : null;
  }

  // Structural Elements and Areas
  const structCell = $('span:contains("Structural Elements"):first').parent();
  if (structCell && structCell.length) {
    const text = structCell.text();
    const extract = (label) => {
      const re = new RegExp(label + "\\s*-\\s*([^\\n]+)", "i");
      const m = text.match(re);
      return m ? m[1].trim() : null;
    };
    structMap.exteriorWall = extract("EXTERIOR WALL");
    structMap.floorCover = extract("FLOOR COVER");
    structMap.foundation = extract("FOUNDATION");
    structMap.heatAir = extract("HEAT/AIR");
    structMap.interiorWall = extract("INTERIOR WALL");
    structMap.stories = extract("NO\.?\s*STORIES");
    structMap.roofCover = extract("ROOF COVER");
    structMap.roofFraming = extract("ROOF FRAMING");
    structMap.storyHeight = extract("STORY HEIGHT");
    structMap.structuralFrame = extract("STRUCTURAL FRAME");

    // Fallbacks: parse via HTML tag proximity
    if (!structMap.stories) {
      const bStories = structCell
        .find("b")
        .filter((i, el) =>
          $(el).text().trim().toUpperCase().includes("NO. STORIES"),
        )
        .first();
      const iVal = bStories.length ? bStories.next("i").text().trim() : null;
      if (iVal) structMap.stories = iVal;
    }
    if (!structMap.exteriorWall) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("EXTERIOR WALL"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.exteriorWall = iVal;
    }
    if (!structMap.floorCover) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("FLOOR COVER"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.floorCover = iVal;
    }
    if (!structMap.foundation) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("FOUNDATION"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.foundation = iVal;
    }
    if (!structMap.interiorWall) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("INTERIOR WALL"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.interiorWall = iVal;
    }
    if (!structMap.roofCover) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("ROOF COVER"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.roofCover = iVal;
    }
    if (!structMap.roofFraming) {
      const bEl = structCell
        .find("b")
        .filter((i, el) => $(el).text().toUpperCase().includes("ROOF FRAMING"))
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.roofFraming = iVal;
    }
    if (!structMap.structuralFrame) {
      const bEl = structCell
        .find("b")
        .filter((i, el) =>
          $(el).text().toUpperCase().includes("STRUCTURAL FRAME"),
        )
        .first();
      const iVal = bEl.length ? bEl.next("i").text().trim() : null;
      if (iVal) structMap.structuralFrame = iVal;
    }
  }

  const areasCell = $('span:contains("Areas -")').parent();
  if (areasCell && areasCell.length) {
    const headerText = areasCell.find("span").first().text();
    const mt = headerText.match(/Areas\s*-\s*(\d+)\s*Total\s*SF/i);
    areasTotal = mt ? parseInt(mt[1], 10) : null;
    const txt = areasCell.text();
    const mb = txt.match(/BASE AREA\s*-\s*(\d+)/i);
    baseArea = mb ? parseInt(mb[1], 10) : null;
    const mc = txt.match(/CARPORT FIN\s*-\s*(\d+)/i);
    carportFin = mc ? parseInt(mc[1], 10) : null;
    const mu = txt.match(/UTILITY UNF\s*-\s*(\d+)/i);
    utilityUnf = mu ? parseInt(mu[1], 10) : null;
  }

  if (structMap.stories) {
    numberOfStories = parseIntSafe(structMap.stories);
  }
  finishedBaseArea = baseArea || null;

  // Zoning, acreage, section map id (use inner HTML to avoid concatenation)
  let zoning = null;
  let acreage = null;
  let sectionMapId = null;
  const statsHtml = $("#ctl00_MasterPlaceHolder_MapBodyStats").html() || "";
  if (statsHtml) {
    const mz = statsHtml.match(
      /Zoned:[\s\S]*?<br\s*\/?>\s*([A-Za-z0-9\-]+)\s*<br/i,
    );
    if (mz) zoning = mz[1].trim();
    const txtStats = cheerio.load(`<div>${statsHtml}</div>`)("div").text();
    const ma = txtStats.match(/Approx\.\s*Acreage:\s*([0-9.]+)/i);
    if (ma) acreage = parseFloat(ma[1]);
    const ms = txtStats.match(/Section Map Id:\s*([0-9A-Za-z\-]+)/i);
    if (ms) sectionMapId = ms[1].trim();
  }
  let section = null,
    township = null,
    range = null;
  if (sectionMapId) {
    const parts = sectionMapId.split("-");
    if (parts.length >= 3) {
      section = parts[0];
      township = parts[1];
      range = parts[2];
    }
  }

  // Subdivision, lot and block from legal description
  let subdivision = null,
    lot = null,
    block = null;
  if (legalDesc) {
    const mLot = legalDesc.match(/LT\s+(\w+)/i);
    if (mLot) lot = mLot[1];
    const mBlk = legalDesc.match(/BLK\s+(\w+)/i);
    if (mBlk) block = mBlk[1];
    const mSub = legalDesc.match(/BLK\s+\w+\s+(.+?)\s+PB/i);
    if (mSub) subdivision = mSub[1].trim();
  }

  function mapPropertyType($) {
    // Extract use code from the "Use Code:" row in General Information table
    let useCodeDescription = null;
    let units = null;

    $("table")
      .find("tr")
      .each((i, tr) => {
        const cells = $(tr).find("td");
        if (cells.length >= 2) {
          const label = $(cells.get(0)).text().trim();

          if (/Use Code:/i.test(label)) {
            const fullText = $(cells.get(1)).text().trim();
            // Extract description part (remove HTML tags)
            useCodeDescription = fullText
              .replace(/<[^>]*>/g, "")
              .trim()
              .toUpperCase();
          }

          if (/Units:/i.test(label)) {
            const unitText = $(cells.get(1)).text().trim();
            const unitNum = parseInt(unitText.replace(/[^\d]/g, ""), 10); // Remove non-digits
            if (!isNaN(unitNum) && unitNum > 0) {
              units = unitNum;
            }
          }
        }
      });

    const propertyType = useCodeDescription
      ? mapUseCodeToPropertyType(useCodeDescription)
      : null;

    return { propertyType, units };
  }

  const ALLOWED_PROPERTY_TYPES = [
    "VacantLand",
    "SingleFamily",
    "MobileHome",
    "MultipleFamily",
    "TwoToFourFamily",
    "Condominium",
    "Cooperative",
    "Retirement",
    "MiscellaneousResidential",
  ];

  function mapUseCodeToPropertyType(useCodeDescription) {
    if (!useCodeDescription) return null;

    const desc = useCodeDescription.toUpperCase();

    // Map DOR codes to property types
    if (desc.includes("VACANT RESIDENTIAL"))
      return validateEnum(
        "VacantLand",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("SINGLE FAMILY"))
      return validateEnum(
        "SingleFamily",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("MOBILE HOME"))
      return validateEnum(
        "MobileHome",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("MULTI-FAMILY >=10"))
      return validateEnum(
        "MultipleFamily",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("MULTI-FAMILY <=9"))
      return validateEnum(
        "TwoToFourFamily",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("CONDOMINIUM"))
      return validateEnum(
        "Condominium",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("COOPERATIVE"))
      return validateEnum(
        "Cooperative",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("RETIREMENT HOME"))
      return validateEnum(
        "Retirement",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );
    if (desc.includes("MISC. RESIDENTIAL"))
      return validateEnum(
        "MiscellaneousResidential",
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      );

    // Throw error for unknown property types
    throw {
      type: "error",
      message: `Unknown enum value ${useCodeDescription}.`,
      path: "Property.property_type",
    };
  }
  const ALLOWED_UNITS_TYPES = ["One", "Two", "Three", "Four"];

  function getUnitsType(units) {
    if (units === 1)
      return validateEnum(
        "One",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 2)
      return validateEnum(
        "Two",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 3)
      return validateEnum(
        "Three",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 4)
      return validateEnum(
        "Four",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === null || units === undefined) return null;

    // Throw error for unknown units
    throw {
      type: "error",
      message: `Unknown enum value ${units}.`,
      path: "Property.number_of_units_type",
    };
  }

  const propertyInfo = mapPropertyType($);

  const property = {
    parcel_identifier: parcelId || null,
    property_type: propertyInfo.propertyType,
    number_of_units_type: getUnitsType(propertyInfo.units),
    number_of_units: propertyInfo.units || null,
    livable_floor_area: baseArea != null ? `${baseArea} SF` : null,
    area_under_air: baseArea != null ? `${baseArea} SF` : null,
    total_area: areasTotal != null ? `${areasTotal} SF` : null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: effYear || null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
    zoning: zoning || null,
  };
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // ---------------- Address ----------------
  // Accepts optional pre/post directionals like "N", "SW", etc.
  const dir = "(N|S|E|W|NE|NW|SE|SW)";
  const validDirectionals = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];

  const fullAddr = unnormalized.full_address || "";
  const cleanAddr = fullAddr
    .replace(/\s+BLK\s+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const suffixMap = {
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
  };

  const addrMatch = cleanAddr.match(
    new RegExp(
      // 1: street number
      // 2: pre-directional (optional)
      // 3: street name
      // 4: street suffix
      // 5: unit identifier (optional - everything after suffix before comma)
      // 6: city
      // 7: state
      // 8: ZIP5
      // 9: ZIP+4
      `^(\\d+)\\s+(?:(${validDirectionals.join("|")})\\s+)?(.+?)(?:\\s+([A-Za-z\\.]+))?(?:\\s+([^,]+?))?(?:\\s+(${validDirectionals.join("|")}))?\\s*,\\s*([A-Z\\s\\-']+),\\s*([A-Z]{2})\\s*(\\d{5})(?:-(\\d{4}))?$`,
      "i",
    ),
  );

  let street_number = null,
    street_predirectional = null,
    street_name = null,
    street_suffix_type = null,
    street_postdirectional = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    unit_id = null,
    plus4 = null;

  if (addrMatch) {
    street_number = addrMatch[1];
    street_predirectional = addrMatch[2] ? addrMatch[2].toUpperCase() : null;

    // Check if we captured a suffix - if so, split street name and suffix
    let rawStreetName = addrMatch[3].trim();
    let capturedSuffix = addrMatch[4];

    if (capturedSuffix && suffixMap[capturedSuffix.toUpperCase()]) {
      // We have a valid suffix
      street_name = rawStreetName;
      street_suffix_type = suffixMap[capturedSuffix.toUpperCase()];
    } else {
      // No valid suffix captured, entire string is street name
      street_name = rawStreetName;
      street_suffix_type = null;
    }

    unit_id = addrMatch[5] ? addrMatch[5].trim() : null;
    street_postdirectional = addrMatch[6] ? addrMatch[6].toUpperCase() : null;
    city_name = addrMatch[7].trim();
    state_code = addrMatch[8].toUpperCase();
    postal_code = addrMatch[9];
    plus4 = addrMatch[10] || null;
  }

  const validateDirectional = (dir) => {
    if (!dir) return null;
    const upper = dir.toUpperCase();
    return validDirectionals.includes(upper) ? upper : null;
  };
  street_predirectional = validateDirectional(street_predirectional);
  street_postdirectional = validateDirectional(street_postdirectional);

  if (street_suffix_type && suffixMap[street_suffix_type.toUpperCase()]) {
    street_suffix_type = suffixMap[street_suffix_type.toUpperCase()];
  }

  const address = {
    street_number: street_number || null,
    street_name: street_name ? street_name.replace(/\s+DR$/i, "").trim() : null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: street_predirectional || null,
    street_post_directional_text: street_postdirectional || null,
    city_name: city_name || null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: plus4 || null,
    country_code: "US",
    county_name: "Escambia",
    municipality_name: null,
    latitude: null,
    longitude: null,
    unit_identifier: unit_id || null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    lot: lot || null,
    block: block || null,
  };
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(address, null, 2),
  );

  // Define allowed enum values for Lot
  const ALLOWED_LOT_TYPES = [
    "LessThanOrEqualToOneQuarterAcre",
    "GreaterThanOneQuarterAcre",
  ];

  // ---------------- Lot ----------------
  let lot_area_sqft = null;
  if (typeof acreage === "number") {
    lot_area_sqft = Math.round(acreage * 43560);
  }
  const lotJson = {
    lot_type:
      typeof acreage === "number"
        ? acreage <= 0.25
          ? validateEnum(
              "LessThanOrEqualToOneQuarterAcre",
              ALLOWED_LOT_TYPES,
              "Lot",
              "lot_type",
            )
          : validateEnum(
              "GreaterThanOneQuarterAcre",
              ALLOWED_LOT_TYPES,
              "Lot",
              "lot_type",
            )
        : null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft || null,
    lot_size_acre: typeof acreage === "number" ? acreage : null,
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
    JSON.stringify(lotJson, null, 2),
  );

  // ---------------- Tax (all rows) ----------------
  const taxRows = [];
  $('th:contains("Assessments")')
    .closest("table")
    .find("tr[align=right]")
    .each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 5) {
        const year = parseInt($(tds.get(0)).text().trim(), 10);
        const land = parseCurrency($(tds.get(1)).text());
        const imprv = parseCurrency($(tds.get(2)).text());
        const total = parseCurrency($(tds.get(3)).text());
        const capVal = parseCurrency($(tds.get(4)).text());
        taxRows.push({ year, land, imprv, total, capVal });
      }
    });
  taxRows.forEach((r) => {
    const tax = {
      tax_year: r.year,
      property_assessed_value_amount: r.capVal != null ? r.capVal : null,
      property_market_value_amount: r.total != null ? r.total : null,
      property_building_amount: r.imprv != null ? r.imprv : null,
      property_land_amount: r.land != null ? r.land : null,
      property_taxable_value_amount: r.capVal != null ? r.capVal : null,
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    };
    fs.writeFileSync(
      path.join(dataDir, `tax_${r.year}.json`),
      JSON.stringify(tax, null, 2),
    );
  });

  // Define allowed enum values for Structure
  const ALLOWED_ATTACHMENT_TYPES = ["Detached", "Attached", "SemiDetached"];
  const ALLOWED_EXTERIOR_WALL_MATERIALS = [
    "Wood Siding",
    "Brick",
    "Stucco",
    "Vinyl Siding",
    "Aluminum Siding",
  ];
  const ALLOWED_FLOORING_MATERIALS = [
    "Carpet",
    "Hardwood",
    "Tile",
    "Laminate",
    "Vinyl",
  ];
  const ALLOWED_SUBFLOOR_MATERIALS = ["Concrete Slab", "Wood", "Plywood"];
  const ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS = [
    "Wood Frame",
    "Steel Frame",
    "Concrete Block",
  ];
  const ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS = [
    "Drywall",
    "Plaster",
    "Paneling",
  ];
  const ALLOWED_ROOF_COVERING_MATERIALS = [
    "Architectural Asphalt Shingle",
    "Asphalt Shingle",
    "Metal",
    "Tile",
    "Wood Shake",
  ];
  const ALLOWED_ROOF_DESIGN_TYPES = [
    "Gable",
    "Hip",
    "Mansard",
    "Flat",
    "Gambrel",
  ];
  const ALLOWED_ROOF_MATERIAL_TYPES = ["Shingle", "Tile", "Metal", "Wood"];
  const ALLOWED_FOUNDATION_TYPES = [
    "Slab on Grade",
    "Crawl Space",
    "Basement",
    "Pier and Beam",
  ];
  const ALLOWED_FRAMING_MATERIALS = ["Wood Frame", "Steel Frame", "Concrete"];

  // ---------------- Structure ----------------
  const structure = {
    architectural_style_type: null,
    attachment_type: validateEnum(
      "Detached",
      ALLOWED_ATTACHMENT_TYPES,
      "Structure",
      "attachment_type",
    ),
    exterior_wall_material_primary: /SIDING/i.test(structMap.exteriorWall || "")
      ? validateEnum(
          "Wood Siding",
          ALLOWED_EXTERIOR_WALL_MATERIALS,
          "Structure",
          "exterior_wall_material_primary",
        )
      : null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: /CARPET/i.test(structMap.floorCover || "")
      ? validateEnum(
          "Carpet",
          ALLOWED_FLOORING_MATERIALS,
          "Structure",
          "flooring_material_primary",
        )
      : null,
    flooring_material_secondary: null,
    subfloor_material: /SLAB/i.test(structMap.foundation || "")
      ? validateEnum(
          "Concrete Slab",
          ALLOWED_SUBFLOOR_MATERIALS,
          "Structure",
          "subfloor_material",
        )
      : null,
    flooring_condition: null,
    interior_wall_structure_material: /WOOD FRAME/i.test(
      structMap.structuralFrame || "",
    )
      ? validateEnum(
          "Wood Frame",
          ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS,
          "Structure",
          "interior_wall_structure_material",
        )
      : null,
    interior_wall_surface_material_primary: /DRYWALL|PLASTER/i.test(
      structMap.interiorWall || "",
    )
      ? validateEnum(
          "Drywall",
          ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS,
          "Structure",
          "interior_wall_surface_material_primary",
        )
      : null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: /ARCH|DIMEN/i.test(structMap.roofCover || "")
      ? validateEnum(
          "Architectural Asphalt Shingle",
          ALLOWED_ROOF_COVERING_MATERIALS,
          "Structure",
          "roof_covering_material",
        )
      : null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: /GABLE/i.test(structMap.roofFraming || "")
      ? validateEnum(
          "Gable",
          ALLOWED_ROOF_DESIGN_TYPES,
          "Structure",
          "roof_design_type",
        )
      : null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: validateEnum(
      "Shingle",
      ALLOWED_ROOF_MATERIAL_TYPES,
      "Structure",
      "roof_material_type",
    ),
    foundation_type: /SLAB/i.test(structMap.foundation || "")
      ? validateEnum(
          "Slab on Grade",
          ALLOWED_FOUNDATION_TYPES,
          "Structure",
          "foundation_type",
        )
      : null,
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
    primary_framing_material: /WOOD FRAME/i.test(
      structMap.structuralFrame || "",
    )
      ? validateEnum(
          "Wood Frame",
          ALLOWED_FRAMING_MATERIALS,
          "Structure",
          "primary_framing_material",
        )
      : null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    finished_base_area: finishedBaseArea != null ? finishedBaseArea : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: numberOfStories != null ? numberOfStories : null,
  };
  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structure, null, 2),
  );

  // ---------------- Utilities ----------------
  if (utilitiesData && utilitiesData[`property_${parcelId}`]) {
    const u = utilitiesData[`property_${parcelId}`];
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(u, null, 2),
    );
  }

  // ---------------- Layouts ----------------
  if (
    layoutData &&
    layoutData[`property_${parcelId}`] &&
    Array.isArray(layoutData[`property_${parcelId}`].layouts)
  ) {
    const layouts = layoutData[`property_${parcelId}`].layouts;
    layouts.forEach((lay, idx) => {
      fs.writeFileSync(
        path.join(dataDir, `layout_${idx + 1}.json`),
        JSON.stringify(lay, null, 2),
      );
    });
  }

  // ---------------- Sales, Deeds, Files ----------------
  const salesRows = [];
  const salesTable = $('th:contains("Sales Data")').closest("table");
  salesTable.find("tr").each((i, el) => {
    const tds = $(el).find("td");
    if (
      tds.length === 7 &&
      $(tds.get(0)).text().trim() &&
      $(tds.get(0)).text().trim() !== "Sale Date"
    ) {
      const saleDateRaw = $(tds.get(0)).text().trim();
      const book = $(tds.get(1)).text().trim();
      const page = $(tds.get(2)).text().trim();
      const value = parseCurrency($(tds.get(3)).text());
      const typeCd = $(tds.get(4)).text().trim();
      const linkEl = $(tds.get(6)).find("a").first();
      const href =
        linkEl && linkEl.attr("href") ? linkEl.attr("href").trim() : null;

      const saleDate = isoDateFromMDY(saleDateRaw); // may be null if not full date

      salesRows.push({
        saleDateRaw,
        saleDate,
        book,
        page,
        value,
        typeCd,
        href,
      });
    }
  });

  // Define allowed enum values for Deed
  const ALLOWED_DEED_TYPES = [
    "Personal Representative Deed",
    "Quiet Title Deed",
    "Court Order Deed",
    "Transfer on Death Deed",
    "Quitclaim Deed",
    "Bargain and Sale Deed",
    "Special Master's Deed",
    "Tax Deed",
    "Trustee's Deed",
    "Warranty Deed",
  ];

  // Define allowed enum values for File
  const ALLOWED_DOCUMENT_TYPES = [
    "ConveyanceDeedWarrantyDeed",
    "ConveyanceDeedQuitclaimDeed",
    "ConveyanceDeedBargainAndSaleDeed",
    "TaxDeed",
    "TrustDeed",
  ];

  // Map deed type by sale code when determinable
  function mapDeedType(code) {
    if (!code) return null;
    const c = code.toUpperCase();
    if (c === "CJ")
      return validateEnum(
        "Personal Representative Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "CT")
      return validateEnum(
        "Quiet Title Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "OJ")
      return validateEnum(
        "Court Order Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "OT")
      return validateEnum(
        "Transfer on Death Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "QC")
      return validateEnum(
        "Quitclaim Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "SC")
      return validateEnum(
        "Bargain and Sale Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "SM")
      return validateEnum(
        "Special Master's Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "TD")
      return validateEnum("Tax Deed", ALLOWED_DEED_TYPES, "Deed", "deed_type");
    if (c === "TR")
      return validateEnum(
        "Trustee's Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );
    if (c === "WD")
      return validateEnum(
        "Warranty Deed",
        ALLOWED_DEED_TYPES,
        "Deed",
        "deed_type",
      );

    // Throw error for unknown deed types
    throw {
      type: "error",
      message: `Unknown enum value ${code}.`,
      path: "Deed.deed_type",
    };
  }

  salesRows.forEach((row, idx) => {
    const sIdx = idx + 1;
    const sales = {
      ownership_transfer_date: row.saleDate || null,
      purchase_price_amount: row.value != null ? row.value : null,
    };
    fs.writeFileSync(
      path.join(dataDir, `sales_${sIdx}.json`),
      JSON.stringify(sales, null, 2),
    );

    const deedObj = {};
    const dType = mapDeedType(row.typeCd);
    if (dType) deedObj.deed_type = dType;
    fs.writeFileSync(
      path.join(dataDir, `deed_${sIdx}.json`),
      JSON.stringify(deedObj, null, 2),
    );

    const fileObj = {
      file_format: null,
      name:
        row.book && row.page
          ? `Instrument OR Book ${row.book} Page ${row.page}`
          : null,
      original_url: row.href || null,
      ipfs_url: null,
      document_type: /^WD$/i.test(row.typeCd)
        ? validateEnum(
            "ConveyanceDeedWarrantyDeed",
            ALLOWED_DOCUMENT_TYPES,
            "File",
            "document_type",
          )
        : null,
    };
    fs.writeFileSync(
      path.join(dataDir, `file_${sIdx}.json`),
      JSON.stringify(fileObj, null, 2),
    );
  });

  // ---------------- Owners ----------------
  if (
    ownerData &&
    ownerData[`property_${parcelId}`] &&
    ownerData[`property_${parcelId}`].owners_by_date &&
    Array.isArray(ownerData[`property_${parcelId}`].owners_by_date.current)
  ) {
    const currentOwners =
      ownerData[`property_${parcelId}`].owners_by_date.current;
    let personCount = 0;
    let companyCount = 0;
    currentOwners.forEach((o) => {
      if (o.type === "person") {
        personCount += 1;
        const first = toTitleCase(o.first_name || "");
        const last = toTitleCase(o.last_name || "");
        const middle = o.middle_name ? toTitleCase(o.middle_name) : null;
        const person = {
          birth_date: null,
          first_name: first,
          last_name: last,
          middle_name: middle,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        fs.writeFileSync(
          path.join(dataDir, `person_${personCount}.json`),
          JSON.stringify(person, null, 2),
        );
      } else if (o.type === "company") {
        companyCount += 1;
        const company = { name: o.name || null };
        fs.writeFileSync(
          path.join(dataDir, `company_${companyCount}.json`),
          JSON.stringify(company, null, 2),
        );
      }
    });

    // Relationship between most recent sale and owners
    if (salesRows.length > 0) {
      const relSalesIdx = 1;
      if (personCount > 0) {
        const rel = {
          to: { "/": `./person_1.json` },
          from: { "/": `./sales_${relSalesIdx}.json` },
        };
        fs.writeFileSync(
          path.join(dataDir, "relationship_sales_person.json"),
          JSON.stringify(rel, null, 2),
        );
      } else if (companyCount > 0) {
        const rel = {
          to: { "/": `./company_1.json` },
          from: { "/": `./sales_${relSalesIdx}.json` },
        };
        fs.writeFileSync(
          path.join(dataDir, "relationship_sales_company.json"),
          JSON.stringify(rel, null, 2),
        );
      }
    }
  }

  // ---------------- Relationships for deed-file and sales-deed for all rows ----------------
  if (salesRows.length > 0) {
    const relDFAll = salesRows.map((_, i) => ({
      to: { "/": `./deed_${i + 1}.json` },
      from: { "/": `./file_${i + 1}.json` },
    }));
    fs.writeFileSync(
      path.join(dataDir, "relationship_deed_file.json"),
      JSON.stringify(relDFAll, null, 2),
    );

    const relSDAll = salesRows.map((_, i) => ({
      to: { "/": `./sales_${i + 1}.json` },
      from: { "/": `./deed_${i + 1}.json` },
    }));
    fs.writeFileSync(
      path.join(dataDir, "relationship_sales_deed.json"),
      JSON.stringify(relSDAll, null, 2),
    );
  }
}

if (require.main === module) {
  main();
}
