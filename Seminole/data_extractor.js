const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listDirSafe(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

function readJSON(p) {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function readInputHtml() {
  const html = fs.readFileSync("input.html", "utf-8");
  const $ = cheerio.load(html);
  const pre = $("pre").first().text();
  return JSON.parse(pre);
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).slice(0, 10);
  return /\d{4}-\d{2}-\d{2}/.test(m) ? m : null;
}

function toCurrencyNumber(n) {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

function properCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mapDeedType(src) {
  if (!src) return null;
  const t = String(src).trim().toUpperCase();
  if (t === "QUIT CLAIM DEED") return "Quitclaim Deed";
  if (t === "CORRECTIVE DEED") return "Correction Deed";
  if (t === "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  if (t === "WARRANTY DEED") return "Warranty Deed";
  if (t === "TRUSTEE DEED") return "Trustee's Deed";
  if (t === "PROBATE RECORDS") return "Personal Representative Deed";
  if (t === "TAX DEED") return "Tax Deed";
  if (t === "BARGAIN AND SALE DEED") return "Bargain and Sale Deed";
  if (t === "COMMUNITY PROPERTY DEED") return "Community Property Deed";
  if (t === "CONTRACT FOR DEED") return "Contract for Deed";
  if (t === "COURT ORDER DEED") return "Court Order Deed";

  if (t === "ADMINISTRATIVE DEED") return null;
  if (t === "CERTIFICATE FOR TITLE") return null;

  const err = {
    type: "error",
    message: `Unknown enum value ${src}.`,
    path: "deed.deed_type",
  };
  throw new Error(JSON.stringify(err));
}
function inferFileFormatFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const base = u.pathname.toLowerCase();
    if (base.endsWith(".jpg") || base.endsWith(".jpeg")) return "jpeg";
    if (base.endsWith(".png")) return "png";
    if (base.endsWith(".txt")) return "txt";
    return null;
  } catch {
    return null;
  }
}

function basenameFromUrl(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/");
    return segs[segs.length - 1] || url;
  } catch {
    return String(url);
  }
}

function cleanupOldPersonSaleRelationships() {
  const files = listDirSafe("data");
  files.forEach((fn) => {
    if (fn.startsWith("relationship_sales_person")) {
      try {
        fs.unlinkSync(path.join("data", fn));
      } catch {}
    }
  });
}

function shouldLinkSaleToCurrentOwners(s) {
  const vacImp = String(s.vacImp || "").toUpperCase();
  const vacImpDesc = String(s.vacImpDesc || "").toUpperCase();
  const qual = String(s.qualificationCode || "").trim();
  const deedDesc = String(s.deedDescription || "").toUpperCase();
  if (vacImp === "V" || vacImpDesc === "VACANT") return false;
  if (qual === "18") return false;
  return true;
}

function mapDorDescriptionToPropertyType(dorDescription) {
  if (!dorDescription) return null;
  const desc = String(dorDescription).toUpperCase();

  if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
  if (desc.includes("DUPLEX")) return "Duplex";
  if (desc.includes("TRI-PLEX") || desc.includes("TRIPLEX")) return "3Units";
  if (desc.includes("QUAD-PLEX") || desc.includes("QUADPLEX")) return "4Units";
  if (desc.includes("CONDOMINIUM") || desc.includes("CONDO")) return "Condominium";  
  if (desc.includes("TOWNHOUSE") || desc.includes("TOWNHOME")) return "Townhouse";
  if (desc.includes("MOBILE HOME") || desc.includes("MANUFACTURED HOUSING")) {
    if (desc.includes("SINGLE WIDE")) return "ManufacturedHousingSingleWide";
    if (desc.includes("MULTI WIDE")) return "ManufacturedHousingMultiWide";
    return "ManufacturedHousing";
  }
  if (desc.includes("MOBILE/MANUFACTURED HOME") || desc.includes("MOBILE HOME") || desc.includes("MOBILE HOUSE")) return "MobileHome"
  if (desc.includes("APARTMENT")) return "Apartment";
  if (desc.includes("VACANT LAND") || desc.includes("VACANT RESIDENTIAL")) return "VacantLand";
  return null;
}

function main() {
  ensureDir("data");

  cleanupOldPersonSaleRelationships();

  const input = readInputHtml();
  const unaddr = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const parcelNumber = input.parcelNumber || propSeed.parcel_id;

  const bldg =
    Array.isArray(input.buildingDetails) && input.buildingDetails.length > 0
      ? input.buildingDetails[0]
      : null;
  const livable =
    (bldg && (bldg.livingArea || bldg.baseArea)) ||
    input.livingAreaCalc ||
    null;
  const gross = (bldg && bldg.grossArea) || input.grossAreaCalc || null;
  const legal = input.legal || null;
  const builtYear = bldg && bldg.yearBlt ? parseInt(bldg.yearBlt, 10) : null;

  const propertyType = mapDorDescriptionToPropertyType(input.dorDescription);

  const propertyObj = {
    parcel_identifier: parcelNumber,
    property_legal_description_text: legal,
    property_structure_built_year: Number.isFinite(builtYear)
      ? builtYear
      : null,
    livable_floor_area: livable != null ? String(livable) : null,
    property_type: propertyType || null,
    number_of_units_type: "One",
  };
  if (gross != null) propertyObj.total_area = String(gross);
  if (input.zoning) propertyObj.zoning = input.zoning || null;
  if (input.platName || input.subName)
    propertyObj.subdivision = input.subName || input.platName || null;
  if (bldg && typeof bldg.baseFloors !== "undefined")
    propertyObj.number_of_units = 1;

  fs.writeFileSync(
    path.join("data", "property.json"),
    JSON.stringify(propertyObj, null, 2),
  );

  const fullAddr = unaddr.full_address || input.situsAddress || "";
  let streetNumber = null,
    streetName = null,
    streetPreDirectional = null,
    streetPostDirectional = null,
    suffix = null,
    city = null,
    state = null,
    zip = null,
    plus4 = null;

  try {
    const parts = fullAddr.split(",");
    const line1 = (parts[0] || "").trim();
    const restCity = (parts[1] || "").trim();
    const restStateZip = (parts[2] || "").trim();

    const addressRegex = /^((\d+)\s+)?((N|S|E|W|NE|NW|SE|SW)\s+)?(.+?)\s+(ALLEY|ALY|ANEX|ANNEX|ANX|ARCADE|ARC|AVENUE|AV|AVE|BAYOU|BYU|BEACH|BCH|BEND|BND|BLUFF|BLF|BLUFFS|BLFS|BOTTOM|BTM|BOULEVARD|BLVD|BRANCH|BR|BRIDGE|BRG|BROOK|BRK|BROOKS|BRKS|BURG|BG|BYPASS|BYP|CAMP|CP|CANYON|CYN|CAPE|CPE|CAUSEWAY|CSWY|CENTER|CTR|CENTERS|CTRS|CIRCLE|CIR|CIRCLES|CIRS|CLIFF|CLF|CLIFFS|CLFS|CLUB|CLB|COMMON|CMN|COMMONS|CMNS|CORNER|COR|CORNERS|CORS|COURSE|CRSE|COURT|CT|COURTS|CTS|COVE|CV|COVES|CVS|CREEK|CRK|CRESCENT|CRES|CREST|CRST|CROSSING|XING|CROSSROAD|XRD|CROSSROADS|XRDS|CURVE|CURV|DALE|DL|DAM|DM|DIVIDE|DV|DRIVE|DR|DRIVES|DRS|ESTATE|EST|ESTATES|ESTS|EXPRESSWAY|EXPY|EXTENSION|EXT|EXTENSIONS|EXTS|FALL|FALLS|FLS|FERRY|FRY|FIELD|FLD|FIELDS|FLDS|FLAT|FLT|FLATS|FLTS|FORD|FRD|FORDS|FRDS|FOREST|FRST|FORGE|FRG|FORGES|FRGS|FORK|FRK|FORKS|FRKS|FORT|FT|FREEWAY|FWY|GARDEN|GDN|GARDENS|GDNS|GATEWAY|GTWY|GLEN|GLN|GLENS|GLNS|GREEN|GRN|GREENS|GRNS|GROVE|GRV|GROVES|GRVS|HARBOR|HBR|HARBORS|HBRS|HAVEN|HVN|HEIGHTS|HTS|HIGHWAY|HWY|HILL|HL|HILLS|HLS|HOLLOW|HOLW|INLET|INLT|ISLAND|IS|ISLANDS|ISS|ISLE|JUNCTION|JCT|JUNCTIONS|JCTS|KEY|KY|KEYS|KYS|KNOLL|KNL|KNOLLS|KNLS|LAKE|LK|LAKES|LKS|LAND|LANDING|LNDG|LANE|LN|LIGHT|LGT|LIGHTS|LGTS|LOCK|LCK|LOCKS|LCKS|LODGE|LDG|LOOP|MALL|MANOR|MNR|MANORS|MNRS|MEADOW|MDW|MEADOWS|MDWS|MEWS|MILL|ML|MILLS|MLS|MISSION|MSN|MOTORWAY|MTWY|MOUNT|MT|MOUNTAIN|MTN|MOUNTAINS|MTNS|NECK|NCK|ORCHARD|ORCH|OVAL|OVERPASS|OPAS|PARK|PARKS|PRK|PARKWAY|PKWY|PASS|PASSAGE|PSGE|PATH|PIKE|PIKE|PINE|PNE|PINES|PNES|PLACE|PL|PLAIN|PLN|PLAINS|PLNS|PLAZA|PLZ|POINT|PT|POINTS|PTS|PORT|PRT|PORTS|PRTS|PRAIRIE|PR|RADIAL|RADL|RAMP|RANCH|RNCH|RAPID|RPD|RAPIDS|RPDS|REST|RST|RIDGE|RDG|RIDGES|RDGS|RIVER|RIV|ROAD|RD|ROADS|RDS|ROUTE|RTE|ROW|RUE|RUN|SHOAL|SHL|SHOALS|SHLS|SHORE|SHR|SHORES|SHRS|SKYWAY|SKWY|SPRING|SPG|SPRINGS|SPGS|SPUR|SQUARE|SQ|SQUARES|SQS|STATION|STA|STRAVENUE|STRA|STREAM|STRM|STREET|ST|STREETS|STS|SUMMIT|SMT|TERRACE|TER|THROUGHWAY|TRWY|TRACE|TRCE|TRACK|TRAK|TRAFFICWAY|TRFY|TRAIL|TRL|TRAILER|TRLR|TUNNEL|TUNL|TURNPIKE|TPKE|UNDERPASS|UPAS|UNION|UN|UNIONS|UNS|VALLEY|VLY|VALLEYS|VLYS|VIADUCT|VIA|VIEW|VW|VIEWS|VWS|VILLAGE|VLG|VILLAGES|VLGS|VILLE|VL|VISTA|VIS|WALK|WALL|WAY|WAYS|WELL|WL|WELLS|WLS)\s*((N|S|E|W|NE|NW|SE|SW)\s*)?$/i;

    const match = line1.match(addressRegex);

    if (match) {
      streetNumber = match[2] || null;
      streetPreDirectional = (match[4] || "").toUpperCase() || null;
      streetName = match[5] || null;
      suffix = (match[6] || "").toUpperCase() || null;
      streetPostDirectional = (match[8] || "").toUpperCase() || null;

      if (streetName) {
        streetName = streetName.replace(/\b(N|S|E|W|NE|NW|SE|SW)\b/gi, '').trim();
      }

    } else {
      const line1Tokens = line1.split(/\s+/);
      if (line1Tokens.length >= 2) {
        streetNumber = line1Tokens[0];
        const lastToken = line1Tokens[line1Tokens.length - 1].toUpperCase();
        const secondLastToken = line1Tokens.length > 1 ? line1Tokens[line1Tokens.length - 2].toUpperCase() : null;

        const directionals = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
        if (directionals.includes(lastToken)) {
          streetPostDirectional = lastToken;
          suffix = secondLastToken;
          streetName = line1Tokens.slice(1, -2).join(" ");
        } else {
          suffix = lastToken;
          streetName = line1Tokens.slice(1, -1).join(" ");
        }

        const firstStreetNameToken = streetName.split(/\s+/)[0];
        if (directionals.includes(firstStreetNameToken)) {
          streetPreDirectional = firstStreetNameToken;
          streetName = streetName.substring(firstStreetNameToken.length).trim();
        }
      } else if (line1Tokens.length === 1) {
        streetName = line1Tokens[0];
      }
    }

    city = restCity ? restCity.toUpperCase() : null;
    if (restStateZip) {
      const stZip = restStateZip.split(/\s+/);
      state = stZip[0] || null;
      zip = stZip[1] || null;
    }
    if (input.mailingAddress) {
      const m = String(input.mailingAddress).match(/\b(\d{5})-(\d{4})\b/);
      if (m) {
        plus4 = m[2];
        if (!zip) zip = m[1];
      }
    }
  } catch (e) {
    console.error("Error parsing address:", e);
  }

  const suffixMap = {
    ALLEY: "Aly", ALY: "Aly", ANEX: "Anx", ANNEX: "Anx", ANX: "Anx", ARCADE: "Arc", ARC: "Arc", AVENUE: "Ave", AV: "Ave", AVE: "Ave", BAYOU: "Byu", BYU: "Byu", BEACH: "Bch", BCH: "Bch", BEND: "Bnd", BND: "Bnd", BLUFF: "Blf", BLF: "Blf", BLUFFS: "Blfs", BLFS: "Blfs", BOTTOM: "Btm", BTM: "Btm", BOULEVARD: "Blvd", BLVD: "Blvd", BRANCH: "Br", BR: "Br", BRIDGE: "Brg", BRG: "Brg", BROOK: "Brk", BRK: "Brk", BROOKS: "Brks", BRKS: "Brks", BURG: "Bg", BG: "Bg", BYPASS: "Byp", BYP: "Byp", CAMP: "Cp", CP: "Cp", CANYON: "Cyn", CYN: "Cyn", CAPE: "Cpe", CPE: "Cpe", CAUSEWAY: "Cswy", CSWY: "Cswy", CENTER: "Ctr", CTR: "Ctr", CENTERS: "Ctrs", CTRS: "Ctrs", CIRCLE: "Cir", CIR: "Cir", CIRCLES: "Cirs", CIRS: "Cirs", CLIFF: "Clf", CLF: "Clf", CLIFFS: "Clfs", CLFS: "Clfs", CLUB: "Clb", CLB: "Clb", COMMON: "Cmn", CMN: "Cmn", COMMONS: "Cmns", CMNS: "Cmns", CORNER: "Cor", COR: "Cor", CORNERS: "Cors", CORS: "Cors", COURSE: "Crse", CRSE: "Crse", COURT: "Ct", CT: "Ct", COURTS: "Cts", CTS: "Cts", COVE: "Cv", CV: "Cv", COVES: "Cvs", CVS: "Cvs", CREEK: "Crk", CRK: "Crk", CRESCENT: "Cres", CRES: "Cres", CREST: "Crst", CRST: "Crst", CROSSING: "Xing", XING: "Xing", CROSSROAD: "Xrd", XRD: "Xrd", CROSSROADS: "Xrds", XRDS: "Xrds", CURVE: "Curv", CURV: "Curv", DALE: "Dl", DL: "Dl", DAM: "Dm", DM: "Dm", DIVIDE: "Dv", DV: "Dv", DRIVE: "Dr", DR: "Dr", DRIVES: "Drs", DRS: "Drs", ESTATE: "Est", EST: "Est", ESTATES: "Ests", ESTS: "Ests", EXPRESSWAY: "Expy", EXPY: "Expy", EXTENSION: "Ext", EXT: "Ext", EXTENSIONS: "Exts", EXTS: "Exts", FALL: "Fall", FALL: "Fall", FALLS: "Fls", FLS: "Fls", FERRY: "Fry", FRY: "Fry", FIELD: "Fld", FLD: "Fld", FIELDS: "Flds", FLDS: "Flds", FLAT: "Flt", FLT: "Flt", FLATS: "Flts", FLTS: "Flts", FORD: "Frd", FRD: "Frd", FORDS: "Frds", FRDS: "Frds", FOREST: "Frst", FRST: "Frst", FORGE: "Frg", FRG: "Frg", FORGES: "Frgs", FRGS: "Frgs", FORK: "Frk", FRK: "Frk", FORKS: "Frks", FRKS: "Frks", FORT: "Ft", FT: "Ft", FREEWAY: "Fwy", FWY: "Fwy", GARDEN: "Gdn", GDN: "Gdn", GARDENS: "Gdns", GDNS: "Gdns", GATEWAY: "Gtwy", GTWY: "Gtwy", GLEN: "Gln", GLN: "Gln", GLENS: "Glns", GLNS: "Glns", GREEN: "Grn", GRN: "Grn", GREENS: "Grns", GRNS: "Grns", GROVE: "Grv", GRV: "Grv", GROVES: "Grvs", GRVS: "Grvs", HARBOR: "Hbr", HBR: "Hbr", HARBORS: "Hbrs", HBRS: "Hbrs", HAVEN: "Hvn", HVN: "Hvn", HEIGHTS: "Hts", HTS: "Hts", HIGHWAY: "Hwy", HWY: "Hwy", HILL: "Hl", HL: "Hl", HILLS: "Hls", HLS: "Hls", HOLLOW: "Holw", HOLW: "Holw", INLET: "Inlt", INLT: "Inlt", ISLAND: "Is", IS: "Is", ISLANDS: "Iss", ISS: "Iss", ISLE: "Isle", ISLE: "Isle", JUNCTION: "Jct", JCT: "Jct", JUNCTIONS: "Jcts", JCTS: "Jcts", KEY: "Ky", KY: "Ky", KEYS: "Kys", KYS: "Kys", KNOLL: "Knl", KNL: "Knl", KNOLLS: "Knls", KNLS: "Knls", LAKE: "Lk", LK: "Lk", LAKES: "Lks", LKS: "Lks", LAND: "Land", LAND: "Land", LANDING: "Lndg", LNDG: "Lndg", LANE: "Ln", LN: "Ln", LIGHT: "Lgt", LGT: "Lgt", LIGHTS: "Lgts", LGTS: "Lgts", LOCK: "Lck", LCK: "Lck", LOCKS: "Lcks", LCKS: "Lcks", LODGE: "Ldg", LDG: "Ldg", LOOP: "Loop", LOOP: "Loop", MALL: "Mall", MALL: "Mall", MANOR: "Mnr", MNR: "Mnr", MANORS: "Mnrs", MNRS: "Mnrs", MEADOW: "Mdw", MDW: "Mdw", MEADOWS: "Mdws", MDWS: "Mdws", MEWS: "Mews", MEWS: "Mews", MILL: "Ml", ML: "Ml", MILLS: "Mls", MLS: "Mls", MISSION: "Msn", MSN: "Msn", MOTORWAY: "Mtwy", MTWY: "Mtwy", MOUNT: "Mt", MT: "Mt", MOUNTAIN: "Mtn", MTN: "Mtn", MOUNTAINS: "Mtns", MTNS: "Mtns", NECK: "Nck", NCK: "Nck", ORCHARD: "Orch", ORCH: "Orch", OVAL: "Oval", OVAL: "Oval", OVERPASS: "Opas", OPAS: "Opas", PARK: "Park", PARK: "Park", PARKS: "Prk", PRK: "Prk", PARKWAY: "Pkwy", PKWY: "Pkwy", PASS: "Pass", PASS: "Pass", PASSAGE: "Psge", PSGE: "Psge", PATH: "Path", PATH: "Path", PIKE: "Pike", PIKE: "Pike", PINE: "Pne", PNE: "Pne", PINES: "Pnes", PNES: "Pnes", PLACE: "Pl", PL: "Pl", PLAIN: "Pln", PLN: "Pln", PLAINS: "Plns", PLNS: "Plns", PLAZA: "Plz", PLZ: "Plz", POINT: "Pt", PT: "Pt", POINTS: "Pts", PTS: "Pts", PORT: "Prt", PRT: "Prt", PORTS: "Prts", PRTS: "Prts", PRAIRIE: "Pr", PR: "Pr", RADIAL: "Radl", RADL: "Radl", RAMP: "Ramp", RAMP: "Ramp", RANCH: "Rnch", RNCH: "Rnch", RAPID: "Rpd", RPD: "Rpd", RAPIDS: "Rpds", RPDS: "Rpds", REST: "Rst", RST: "Rst", RIDGE: "Rdg", RDG: "Rdg", RIDGES: "Rdgs", RDGS: "Rdgs", RIVER: "Riv", RIV: "Riv", ROAD: "Rd", RD: "Rd", ROADS: "Rds", RDS: "Rds", ROUTE: "Rte", RTE: "Rte", ROW: "Row", ROW: "Row", RUE: "Rue", RUE: "Rue", RUN: "Run", RUN: "Run", SHOAL: "Shl", SHL: "Shl", SHOALS: "Shls", SHLS: "Shls", SHORE: "Shr", SHR: "Shr", SHORES: "Shrs", SHRS: "Shrs", SKYWAY: "Skwy", SKWY: "Skwy", SPRING: "Spg", SPG: "Spg", SPRINGS: "Spgs", SPGS: "Spgs", SPUR: "Spur", SPUR: "Spur", SQUARE: "Sq", SQ: "Sq", SQUARES: "Sqs", SQS: "Sqs", STATION: "Sta", STA: "Sta", STRAVENUE: "Stra", STRA: "Stra", STREAM: "Strm", STRM: "Strm", STREET: "St", ST: "St", STREETS: "Sts", STS: "Sts", SUMMIT: "Smt", SMT: "Smt", TERRACE: "Ter", TER: "Ter", THROUGHWAY: "Trwy", TRWY: "Trwy", TRACE: "Trce", TRCE: "Trce", TRACK: "Trak", TRAK: "Trak", TRAFFICWAY: "Trfy", TRFY: "Trfy", TRAIL: "Trl", TRL: "Trl", TRAILER: "Trlr", TRLR: "Trlr", TUNNEL: "Tunl", TUNL: "Tunl", TURNPIKE: "Tpke", TPKE: "Tpke", UNDERPASS: "Upas", UPAS: "Upas", UNION: "Un", UN: "Un", UNIONS: "Uns", UNS: "Uns", VALLEY: "Vly", VLY: "Vly", VALLEYS: "Vlys", VLYS: "VLYS", VIADUCT: "Via", VIA: "Via", VIEW: "Vw", VW: "Vw", VIEWS: "Vws", VWS: "Vws", VILLAGE: "Vlg", VLG: "Vlg", VILLAGES: "Vlgs", VLGS: "Vlgs", VILLE: "Vl", VL: "Vl", VISTA: "Vis", VIS: "Vis", WALK: "Walk", WALK: "Walk", WALL: "Wall", WALL: "Wall", WAY: "Way", WAY: "Way", WAYS: "Ways", WAYS: "Ways", WELL: "Wl", WL: "Wl", WELLS: "Wls", WLS: "Wls",
  };

  const suffixEnum = suffix
    ? suffixMap[String(suffix).toUpperCase()] || null
    : null;

  const addressObj = {
    street_number: streetNumber || null,
    street_pre_directional_text: streetPreDirectional,
    street_name: streetName || null,
    street_suffix_type: suffixEnum,
    street_post_directional_text: streetPostDirectional,
    unit_identifier: null,
    city_name: city || null,
    municipality_name: null,
    state_code: state || null,
    postal_code: zip || null,
    plus_four_postal_code: plus4 || null,
    county_name: "Seminole",
    country_code: "US",
    latitude: typeof unaddr.latitude === "number" ? unaddr.latitude : null,
    longitude: typeof unaddr.longitude === "number" ? unaddr.longitude : null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
  };
  fs.writeFileSync(
    path.join("data", "address.json"),
    JSON.stringify(addressObj, null, 2),
  );

  const lotObj = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: typeof input.gisAcres === "number" ? input.gisAcres : null,
  };

  fs.writeFileSync(
    path.join("data", "lot.json"),
    JSON.stringify(lotObj, null, 2),
  );

  if (Array.isArray(input.parcelValueHistory)) {
    input.parcelValueHistory.forEach((row) => {
      const year = row.taxYear;
      const assessed =
        Number(row.taxableValue || 0) + Number(row.exemptValue || 0);
      const taxObj = {
        tax_year: Number.isFinite(year) ? year : null,
        property_assessed_value_amount: toCurrencyNumber(assessed),
        property_market_value_amount: toCurrencyNumber(row.totalJustValue),
        property_building_amount: toCurrencyNumber(row.apprBldg),
        property_land_amount: toCurrencyNumber(row.apprLand),
        property_taxable_value_amount: toCurrencyNumber(row.taxableValue),
        monthly_tax_amount: null,
        yearly_tax_amount: toCurrencyNumber(row.taxBillAmt),
        period_start_date: null,
        period_end_date: null,
      };
      fs.writeFileSync(
        path.join("data", `tax_${year}.json`),
        JSON.stringify(taxObj, null, 2),
      );
    });
  }

  let sales = Array.isArray(input.saleDetails) ? input.saleDetails.slice() : [];
  sales.sort((a, b) => new Date(a.saleDate) - new Date(b.saleDate));

  sales.forEach((s, idx) => {
    const i = idx + 1;
    const saleObj = {
      ownership_transfer_date: toISODate(s.saleDate),
      purchase_price_amount: toCurrencyNumber(s.saleAmt),
    };
    const saleFn = `sales_${i}.json`;
    fs.writeFileSync(
      path.join("data", saleFn),
      JSON.stringify(saleObj, null, 2),
    );

    const deedType = mapDeedType(s.deedDescription);
    const deedObj = { deed_type: deedType };
    const deedFn = `deed_${i}.json`;
    fs.writeFileSync(
      path.join("data", deedFn),
      JSON.stringify(deedObj, null, 2),
    );

    const relSD = { to: { "/": `./${saleFn}` }, from: { "/": `./${deedFn}` } };
    fs.writeFileSync(
      path.join("data", `relationship_sales_deed_${i}.json`),
      JSON.stringify(relSD, null, 2),
    );
  });

  const personFiles = [];
  if (ownersData) {
    const ownersKey = `property_${parcelNumber}`;
    const ownersForProperty = ownersData[ownersKey];
    if (
      ownersForProperty &&
      ownersForProperty.owners_by_date &&
      Array.isArray(ownersForProperty.owners_by_date.current)
    ) {
      const currOwners = ownersForProperty.owners_by_date.current;
      let personIndex = 0;
      for (const o of currOwners) {
        if (o.type === "person") {
          personIndex += 1;
          const pObj = {
            birth_date: null,
            first_name: properCaseName(o.first_name || null),
            last_name: properCaseName(o.last_name || null),
            middle_name: o.middle_name || null,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          };
          const pf = `person_${personIndex}.json`;
          fs.writeFileSync(
            path.join("data", pf),
            JSON.stringify(pObj, null, 2),
          );
          personFiles.push(pf);
        }
      }

      sales.forEach((s, sIdx) => {
        if (!shouldLinkSaleToCurrentOwners(s)) return;
        const saleFile = `sales_${sIdx + 1}.json`;
        personFiles.forEach((pf, pIdx) => {
          const rel = {
            to: { "/": `./${pf}` },
            from: { "/": `./${saleFile}` },
          };
          const fn = `relationship_sales_person_${sIdx + 1}_${pIdx + 1}.json`;
          fs.writeFileSync(path.join("data", fn), JSON.stringify(rel, null, 2));
        });
      });
    }
  }

  if (utilitiesData) {
    const key = `property_${input.apprId}`;
    const u = utilitiesData[key] || null;
    if (u) {
      const utilObj = {
        cooling_system_type: u.cooling_system_type ?? null,
        heating_system_type: u.heating_system_type ?? null,
        public_utility_type: u.public_utility_type ?? null,
        sewer_type: u.sewer_type ?? null,
        water_source_type: u.water_source_type ?? null,
        plumbing_system_type: u.plumbing_system_type ?? null,
        plumbing_system_type_other_description:
          u.plumbing_system_type_other_description ?? null,
        electrical_panel_capacity: u.electrical_panel_capacity ?? null,
        electrical_wiring_type: u.electrical_wiring_type ?? null,
        hvac_condensing_unit_present: u.hvac_condensing_unit_present ?? null,
        electrical_wiring_type_other_description:
          u.electrical_wiring_type_other_description ?? null,
        solar_panel_present: u.solar_panel_present === true,
        solar_panel_type: u.solar_panel_type ?? null,
        solar_panel_type_other_description:
          u.solar_panel_type_other_description ?? null,
        smart_home_features: u.smart_home_features ?? null,
        smart_home_features_other_description:
          u.smart_home_features_other_description ?? null,
        hvac_unit_condition: u.hvac_unit_condition ?? null,
        solar_inverter_visible: u.solar_inverter_visible === true,
        hvac_unit_issues: u.hvac_unit_issues ?? null,
        electrical_panel_installation_date:
          u.electrical_panel_installation_date ?? null,
        electrical_rewire_date: u.electrical_rewire_date ?? null,
        hvac_capacity_kw: u.hvac_capacity_kw ?? null,
        hvac_capacity_tons: u.hvac_capacity_tons ?? null,
        hvac_equipment_component: u.hvac_equipment_component ?? null,
        hvac_equipment_manufacturer: u.hvac_equipment_manufacturer ?? null,
        hvac_equipment_model: u.hvac_equipment_model ?? null,
        hvac_installation_date: u.hvac_installation_date ?? null,
        hvac_seer_rating: u.hvac_seer_rating ?? null,
        hvac_system_configuration: u.hvac_system_configuration ?? null,
        plumbing_system_installation_date:
          u.plumbing_system_installation_date ?? null,
        sewer_connection_date: u.sewer_connection_date ?? null,
        solar_installation_date: u.solar_installation_date ?? null,
        solar_inverter_installation_date:
          u.solar_inverter_installation_date ?? null,
        solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
        solar_inverter_model: u.solar_inverter_model ?? null,
        water_connection_date: u.water_connection_date ?? null,
        water_heater_installation_date:
          u.water_heater_installation_date ?? null,
        water_heater_manufacturer: u.water_heater_manufacturer ?? null,
        water_heater_model: u.water_heater_model ?? null,
        well_installation_date: u.well_installation_date ?? null,
      };
      fs.writeFileSync(
        path.join("data", "utility.json"),
        JSON.stringify(utilObj, null, 2),
      );
    }
  }

  if (layoutData) {
    const key = `property_${input.apprId}`;
    const l = layoutData[key] || null;
    if (l && Array.isArray(l.layouts)) {
      l.layouts.forEach((it, idx) => {
        const out = {
          space_type: it.space_type ?? null,
          space_index: it.space_index ?? null,
          flooring_material_type: it.flooring_material_type ?? null,
          size_square_feet: it.size_square_feet ?? null,
          floor_level: it.floor_level ?? null,
          has_windows: it.has_windows ?? null,
          window_design_type: it.window_design_type ?? null,
          window_material_type: it.window_material_type ?? null,
          window_treatment_type: it.window_treatment_type ?? null,
          is_finished: it.is_finished === true,
          furnished: it.furnished ?? null,
          paint_condition: it.paint_condition ?? null,
          flooring_wear: it.flooring_wear ?? null,
          clutter_level: it.clutter_level ?? null,
          visible_damage: it.visible_damage ?? null,
          countertop_material: it.countertop_material ?? null,
          cabinet_style: it.cabinet_style ?? null,
          fixture_finish_quality: it.fixture_finish_quality ?? null,
          design_style: it.design_style ?? null,
          natural_light_quality: it.natural_light_quality ?? null,
          decor_elements: it.decor_elements ?? null,
          pool_type: it.pool_type ?? null,
          pool_equipment: it.pool_equipment ?? null,
          spa_type: it.spa_type ?? null,
          safety_features: it.safety_features ?? null,
          view_type: it.view_type ?? null,
          lighting_features: it.lighting_features ?? null,
          condition_issues: it.condition_issues ?? null,
          is_exterior: it.is_exterior === true,
          pool_condition: it.pool_condition ?? null,
          pool_surface_type: it.pool_surface_type ?? null,
          pool_water_quality: it.pool_water_quality ?? null,
          flooring_installation_date: it.flooring_installation_date ?? null,
          kitchen_renovation_date: it.kitchen_renovation_date ?? null,
          bathroom_renovation_date: it.bathroom_renovation_date ?? null,
          pool_installation_date: it.pool_installation_date ?? null,
          spa_installation_date: it.spa_installation_date ?? null,
        };
        fs.writeFileSync(
          path.join("data", `layout_${idx + 1}.json`),
          JSON.stringify(out, null, 2),
        );
      });
    }
  }

  let attachment_type = null;
  if (bldg && typeof bldg.bldgType === "string") {
    const bt = bldg.bldgType.toUpperCase();
    if (bt.includes("SINGLE FAMILY")) attachment_type = "Detached";
  }
  const extWall =
    bldg && bldg.extWall ? String(bldg.extWall).toUpperCase() : "";
  let exterior_wall_material_primary = null;
  if (extWall.includes("STUCCO")) exterior_wall_material_primary = "Stucco";
  let primary_framing_material = null;
  if (extWall.includes("CB") || extWall.includes("CONCRETE BLOCK"))
    primary_framing_material = "Concrete Block";

  const structureObj = {
    architectural_style_type: null,
    attachment_type,
    exterior_wall_material_primary,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: "Unknown",
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
    roof_underlayment_type: "Unknown",
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: "Unknown",
    foundation_condition: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: "Unknown",
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories:
      bldg && typeof bldg.baseFloors === "number" ? bldg.baseFloors : null,
    finished_base_area:
      bldg && typeof bldg.livingArea === "number"
        ? bldg.livingArea
        : typeof input.livingAreaCalc === "number"
          ? input.livingAreaCalc
          : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    siding_installation_date: null,
    roof_date: null,
    window_installation_date: null,
    exterior_door_installation_date: null,
    foundation_repair_date: null,
  };
  fs.writeFileSync(
    path.join("data", "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

  const floodObj = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: input.floodZone || null,
    flood_insurance_required:
      String(input.floodZone || "").toUpperCase() === "NO" ? false : false,
    fema_search_url: null,
  };
  fs.writeFileSync(
    path.join("data", "flood_storm_information.json"),
    JSON.stringify(floodObj, null, 2),
  );

  let fileIdx = 0;
  const fileCandidates = [];
  if (Array.isArray(input.footPrintImages)) {
    input.footPrintImages.forEach((fp) => {
      if (fp && fp.downloadURL) {
        fileCandidates.push({ url: fp.downloadURL, docType: "PropertyImage" });
      }
    });
  }
  if (input.primaryParcelImageUrl) {
    fileCandidates.push({
      url: input.primaryParcelImageUrl,
      docType: "PropertyImage",
    });
  }
  if (input.mapImageUrl) {
    fileCandidates.push({ url: input.mapImageUrl, docType: "PropertyImage" });
  }

  fileCandidates.forEach((fc) => {
    fileIdx += 1;
    const fmt = inferFileFormatFromUrl(fc.url);
    const name = basenameFromUrl(fc.url);
    const fileObj = {
      document_type: fc.docType || null,
      file_format: fmt,
      ipfs_url: null,
      name: name,
      original_url: fc.url,
    };
    fs.writeFileSync(
      path.join("data", `file_${fileIdx}.json`),
      JSON.stringify(fileObj, null, 2),
    );
  });
}

try {
  main();
  console.log("Extraction completed.");
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}