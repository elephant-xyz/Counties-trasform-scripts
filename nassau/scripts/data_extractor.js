const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  const s = fs.readFileSync(p, "utf8");
  return JSON.parse(s);
}

function writeJSON(p, data) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function throwEnumError(value, pathStr) {
  throw new Error(
    JSON.stringify({
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: pathStr,
    }),
  );
}

function main() {
  // Clean output directory for idempotency
  try {
    fs.rmSync("data", { recursive: true, force: true });
  } catch (e) {}

  const inputHtmlPath = path.join("input.html");
  const unAddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutsPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(unAddrPath);
  const seed = readJSON(seedPath);

  // Optional data sets
  let ownersData = null;
  let utilitiesData = null;
  let layoutsData = null;
  try {
    ownersData = readJSON(ownersPath);
  } catch (e) {}
  try {
    utilitiesData = readJSON(utilitiesPath);
  } catch (e) {}
  try {
    layoutsData = readJSON(layoutsPath);
  } catch (e) {}

  // Identify parcel identifier from HTML

  const parcelHeader = $("section.title h1").first().text().trim();
  // console.log("parcelHeader>>>",parcelHeader)

  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);  // Capture everything after "Parcel"
  // console.log("m>>>", m);

  if (m) parcelIdentifier = m[1];

  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  console.log("Final parcelIdentifier>>>", parcelIdentifier);


  // const parcelHeader = $("section.title h1").first().text().trim();
  // let parcelIdentifier = null;
  // const m = parcelHeader.match(/Parcel\s+([0-9\-]+)/i);
  // if (m) parcelIdentifier = m[1];
  // // Fallback: title
  // if (!parcelIdentifier) {
  //   const title = $("title").text();
  //   const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
  //   if (m2) parcelIdentifier = m2[1];
  // }

  // Property extraction
  const summaryRows = $("section.parcel-info table.grid.grid-1d tr");
  let useCodeText = null;
  let situsAddress = null;
  let subdivisionText = null;
  let sectionText = null,
    townshipText = null,
    rangeText = null;
  let acreageText = null;
  summaryRows.each((i, tr) => {
    const th = $(tr).find("th").text().trim();
    const td = $(tr).find("td").first().text().trim();
    if (/Situs Address/i.test(th)) situsAddress = td;
    if (/Use Code/i.test(th)) useCodeText = td;
    if (/Subdivision/i.test(th)) subdivisionText = td;
    if (/Section/i.test(th)) sectionText = td;
    if (/Township/i.test(th)) townshipText = td;
    if (/Range/i.test(th)) rangeText = td;
    if (/Acreage/i.test(th)) acreageText = td;
  });

  function mapPropertyType(useCode) {
    if (!useCode) return "SingleFamily";
    const uc = useCode.toUpperCase();
    if (uc.includes("MULTI-FAMILY") || uc.includes("0300")) return "MultipleFamily";
    if (uc.includes("SINGLE FAMILY")) return "SingleFamily";
    if (uc.includes("CONDO")) return "Condominium";
    if (uc.includes("VACANT")) return "VacantLand";
    if (uc.includes("DUPLEX")) return "Duplex";
    if (uc.includes("TOWNHOUSE")) return "Townhouse";
    if (uc.includes("APARTMENT")) return "Apartment";
    if (uc.includes("MOBILE")) return "MobileHome";
    return "SingleFamily";
  }


  const property_type = mapPropertyType(useCodeText || "");

  // Buildings: Sum all heated sq ft and get earliest year built
  let totalHeatedSqft = 0;
  let yearBuilt = null;
  let unitCount = 0;
  $("section.buildings .building-data table.grid2 tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const sqft = parseInt(tds.eq(0).text().replace(/[,]/g, "").trim() || "0", 10);
    const yb = tds.eq(1).text().trim();
    if (sqft > 0) {
      totalHeatedSqft += sqft;
      unitCount++;
    }
    if (/^\d{4}$/.test(yb)) {
      const year = parseInt(yb, 10);
      if (!yearBuilt || year < yearBuilt) yearBuilt = year;
    }
  });
  const heatedSqft = totalHeatedSqft > 0 ? totalHeatedSqft.toString() : null;
  
  // Count actual buildings in HTML
  const actualBuildingCount = $("section.buildings .building-data").length;
  const buildingsToCreate = Math.max(actualBuildingCount, 1); // At least 1

  // Legal Description
  let property_legal_description_text = null;
  let lotNumber = null;
  const legalSec = $("section.legal");
  if (legalSec.length) {
    const rawText = legalSec.text();
    const tx = rawText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    property_legal_description_text = tx
      .filter((l) => !/^Short Legal/i.test(l))
      .join(" ");
    // Parse lot number from any line like LOT 25
    for (const line of tx) {
      const mm = line.match(/\bLOT\s+(\w+)/i);
      if (mm) {
        lotNumber = mm[1];
        break;
      }
    }
  }

  const property = {
    source_http_request: {
      method: "GET",
      url: seed.source_url || "https://example.com/property-data"
    },
    request_identifier: parcelIdentifier || seed.parcel_id || null,
    parcel_identifier: parcelIdentifier || seed.parcel_id || "",
    property_type,
    livable_floor_area: heatedSqft ? String(heatedSqft) : null,
    area_under_air: heatedSqft ? String(heatedSqft) : null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: null,
    number_of_units_type: unitCount <= 1 ? "One" : unitCount === 2 ? "Two" : unitCount === 3 ? "Three" : unitCount === 4 ? "Four" : "TwoToFour",
    number_of_units: unitCount || 1,
    property_legal_description_text: property_legal_description_text || null,
    subdivision: subdivisionText || null,
    total_area: null,
    zoning: null,
    historic_designation: false
  };
  writeJSON(path.join("data", "property.json"), property);

  // Address extraction
  const fullAddress = unAddr.full_address || "";
  const cityPart = (unAddr.full_address || "").split(",")[1]?.trim() || "";
  const cityUpper = cityPart.toUpperCase();
  const postalMatch = fullAddress.match(/(\d{5})(?:-(\d{4}))?$/);
  const postal_code = postalMatch ? postalMatch[1] : null;
  const plus_four_postal_code = postalMatch ? postalMatch[2] || null : null;

  // parse street components from situsAddress if available, else from full_address prefix
  const situs = situsAddress || (fullAddress.split(",")[0] || "").trim();
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    pre_dir = null,
    post_dir = null;
  if (situs) {
    const parts = situs.split(/\s+/);
    if (parts.length >= 2) {
      street_number = parts.shift();
      const last = parts.pop();
      street_suffix_type = last || null;
      street_name = parts.join(" ").toUpperCase() || null;
      const dirs = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
      const nameTokens = street_name ? street_name.split(" ") : [];
      if (nameTokens.length > 1 && dirs.includes(nameTokens[0])) {
        pre_dir = nameTokens.shift();
      }
      if (
        nameTokens.length > 1 &&
        dirs.includes(nameTokens[nameTokens.length - 1])
      ) {
        post_dir = nameTokens.pop();
      }
      street_name = nameTokens.join(" ");
      if (street_suffix_type) {
        const up = street_suffix_type.toUpperCase();
        const validSuffixes = {
          ALLEY: "Aly", ALY: "Aly",
          ANNEX: "Anx", ANX: "Anx",
          ARCADE: "Arc", ARC: "Arc",
          AVENUE: "Ave", AVE: "Ave",
          BAYOU: "Byu", BYU: "Byu",
          BEACH: "Bch", BCH: "Bch",
          BEND: "Bnd", BND: "Bnd",
          BLUFF: "Blf", BLF: "Blf",
          BLUFFS: "Blfs", BLFS: "Blfs",
          BOTTOM: "Btm", BTM: "Btm",
          BOULEVARD: "Blvd", BLVD: "Blvd",
          BRANCH: "Br", BR: "Br",
          BRIDGE: "Brg", BRG: "Brg",
          BROOK: "Brk", BRK: "Brk",
          BROOKS: "Brks", BRKS: "Brks",
          BURG: "Bg", BG: "Bg",
          BURGS: "Bgs", BGS: "Bgs",
          BYPASS: "Byp", BYP: "Byp",
          CAMP: "Cp", CP: "Cp",
          CANYON: "Cyn", CYN: "Cyn",
          CAPE: "Cpe", CPE: "Cpe",
          CAUSEWAY: "Cswy", CSWY: "Cswy",
          CENTER: "Ctr", CTR: "Ctr",
          CENTERS: "Ctrs", CTRS: "Ctrs",
          CIRCLE: "Cir", CIR: "Cir",
          CIRCLES: "Cirs", CIRS: "Cirs",
          CLIFF: "Clf", CLF: "Clf",
          CLIFFS: "Clfs", CLFS: "Clfs",
          CLUB: "Clb", CLB: "Clb",
          COMMON: "Cmn", CMN: "Cmn",
          COMMONS: "Cmns", CMNS: "Cmns",
          CORNER: "Cor", COR: "Cor",
          CORNERS: "Cors", CORS: "Cors",
          COURSE: "Crse", CRSE: "Crse",
          COURT: "Ct", CT: "Ct",
          COURTS: "Cts", CTS: "Cts",
          COVE: "Cv", CV: "Cv",
          COVES: "Cvs", CVS: "Cvs",
          CREEK: "Crk", CRK: "Crk",
          CRESCENT: "Cres", CRES: "Cres",
          CREST: "Crst", CRST: "Crst",
          CROSSING: "Xing", XING: "Xing",
          CROSSROAD: "Xrd", XRD: "Xrd",
          CROSSROADS: "Xrds", XRDS: "Xrds",
          CURVE: "Curv", CURV: "Curv",
          DALE: "Dl", DL: "Dl",
          DAM: "Dm", DM: "Dm",
          DIVIDE: "Dv", DV: "Dv",
          DRIVE: "Dr", DR: "Dr",
          DRIVES: "Drs", DRS: "Drs",
          ESTATE: "Est", EST: "Est",
          ESTATES: "Ests", ESTS: "Ests",
          EXPRESSWAY: "Expy", EXPY: "Expy",
          EXTENSION: "Ext", EXT: "Ext",
          EXTENSIONS: "Exts", EXTS: "Exts",
          FALL: "Fall", FALL: "Fall",
          FALLS: "Fls", FLS: "Fls",
          FERRY: "Fry", FRY: "Fry",
          FIELD: "Fld", FLD: "Fld",
          FIELDS: "Flds", FLDS: "Flds",
          FLAT: "Flt", FLT: "Flt",
          FLATS: "Flts", FLTS: "Flts",
          FORD: "Frd", FRD: "Frd",
          FORDS: "Frds", FRDS: "Frds",
          FOREST: "Frst", FRST: "Frst",
          FORGE: "Frg", FRG: "Frg",
          FORGES: "Frgs", FRGS: "Frgs",
          FORK: "Frk", FRK: "Frk",
          FORKS: "Frks", FRKS: "Frks",
          FORT: "Ft", FT: "Ft",
          FREEWAY: "Fwy", FWY: "Fwy",
          GARDEN: "Gdn", GDN: "Gdn",
          GARDENS: "Gdns", GDNS: "Gdns",
          GATEWAY: "Gtwy", GTWY: "Gtwy",
          GLEN: "Gln", GLN: "Gln",
          GLENS: "Glns", GLNS: "Glns",
          GREEN: "Grn", GRN: "Grn",
          GREENS: "Grns", GRNS: "Grns",
          GROVE: "Grv", GRV: "Grv",
          GROVES: "Grvs", GRVS: "Grvs",
          HARBOR: "Hbr", HBR: "Hbr",
          HARBORS: "Hbrs", HBRS: "Hbrs",
          HAVEN: "Hvn", HVN: "Hvn",
          HEIGHTS: "Hts", HTS: "Hts",
          HIGHWAY: "Hwy", HWY: "Hwy",
          HILL: "Hl", HL: "Hl",
          HILLS: "Hls", HLS: "Hls",
          HOLLOW: "Holw", HOLW: "Holw",
          INLET: "Inlt", INLT: "Inlt",
          ISLAND: "Is", IS: "Is",
          ISLANDS: "Iss", ISS: "Iss",
          ISLE: "Isle", ISLE: "Isle",
          JUNCTION: "Jct", JCT: "Jct",
          JUNCTIONS: "Jcts", JCTS: "Jcts",
          KEY: "Ky", KY: "Ky",
          KEYS: "Kys", KYS: "Kys",
          KNOLL: "Knl", KNL: "Knl",
          KNOLLS: "Knls", KNLS: "Knls",
          LAKE: "Lk", LK: "Lk",
          LAKES: "Lks", LKS: "Lks",
          LAND: "Land", LAND: "Land",
          LANDING: "Lndg", LNDG: "Lndg",
          LANE: "Ln", LN: "Ln",
          LIGHT: "Lgt", LGT: "Lgt",
          LIGHTS: "Lgts", LGTS: "Lgts",
          LOAF: "Lf", LF: "Lf",
          LOCK: "Lck", LCK: "Lck",
          LOCKS: "Lcks", LCKS: "Lcks",
          LODGE: "Ldg", LDG: "Ldg",
          LOOP: "Loop", LOOP: "Loop",
          MALL: "Mall", MALL: "Mall",
          MANOR: "Mnr", MNR: "Mnr",
          MANORS: "Mnrs", MNRS: "Mnrs",
          MEADOW: "Mdw", MDW: "Mdw",
          MEADOWS: "Mdws", MDWS: "Mdws",
          MEWS: "Mews", MEWS: "Mews",
          MILL: "Ml", ML: "Ml",
          MILLS: "Mls", MLS: "Mls",
          MISSION: "Msn", MSN: "Msn",
          MOTORWAY: "Mtwy", MTWY: "Mtwy",
          MOUNT: "Mt", MT: "Mt",
          MOUNTAIN: "Mtn", MTN: "Mtn",
          MOUNTAINS: "Mtns", MTNS: "Mtns",
          NECK: "Nck", NCK: "Nck",
          ORCHARD: "Orch", ORCH: "Orch",
          OVAL: "Oval", OVAL: "Oval",
          OVERPASS: "Opas", OPAS: "Opas",
          PARK: "Park", PARK: "Park",
          PARKWAY: "Pkwy", PKWY: "Pkwy",
          PASS: "Pass", PASS: "Pass",
          PASSAGE: "Psge", PSGE: "Psge",
          PATH: "Path", PATH: "Path",
          PIKE: "Pike", PIKE: "Pike",
          PINE: "Pne", PNE: "Pne",
          PINES: "Pnes", PNES: "Pnes",
          PLACE: "Pl", PL: "Pl",
          PLAIN: "Pln", PLN: "Pln",
          PLAINS: "Plns", PLNS: "Plns",
          PLAZA: "Plz", PLZ: "Plz",
          POINT: "Pt", PT: "Pt",
          POINTS: "Pts", PTS: "Pts",
          PORT: "Prt", PRT: "Prt",
          PORTS: "Prts", PRTS: "Prts",
          PRAIRIE: "Pr", PR: "Pr",
          RADIAL: "Radl", RADL: "Radl",
          RAMP: "Ramp", RAMP: "Ramp",
          RANCH: "Rnch", RNCH: "Rnch",
          RAPID: "Rpd", RPD: "Rpd",
          RAPIDS: "Rpds", RPDS: "Rpds",
          REST: "Rst", RST: "Rst",
          RIDGE: "Rdg", RDG: "Rdg",
          RIDGES: "Rdgs", RDGS: "Rdgs",
          RIVER: "Riv", RIV: "Riv",
          ROAD: "Rd", RD: "Rd",
          ROADS: "Rds", RDS: "Rds",
          ROUTE: "Rte", RTE: "Rte",
          ROW: "Row", ROW: "Row",
          RUE: "Rue", RUE: "Rue",
          RUN: "Run", RUN: "Run",
          SHOAL: "Shl", SHL: "Shl",
          SHOALS: "Shls", SHLS: "Shls",
          SHORE: "Shr", SHR: "Shr",
          SHORES: "Shrs", SHRS: "Shrs",
          SKYWAY: "Skwy", SKWY: "Skwy",
          SPRING: "Spg", SPG: "Spg",
          SPRINGS: "Spgs", SPGS: "Spgs",
          SPUR: "Spur", SPUR: "Spur",
          SQUARE: "Sq", SQ: "Sq",
          SQUARES: "Sqs", SQS: "Sqs",
          STATION: "Sta", STA: "Sta",
          STRAVENUE: "Stra", STRA: "Stra",
          STREAM: "Strm", STRM: "Strm",
          STREET: "St", ST: "St",
          STREETS: "Sts", STS: "Sts",
          SUMMIT: "Smt", SMT: "Smt",
          TERRACE: "Ter", TER: "Ter",
          THROUGHWAY: "Trwy", TRWY: "Trwy",
          TRACE: "Trce", TRCE: "Trce",
          TRACK: "Trak", TRAK: "Trak",
          TRAFFICWAY: "Trfy", TRFY: "Trfy",
          TRAIL: "Trl", TRL: "Trl",
          TRAILER: "Trlr", TRLR: "Trlr",
          TUNNEL: "Tunl", TUNL: "Tunl",
          TURNPIKE: "Tpke", TPKE: "Tpke",
          UNDERPASS: "Upas", UPAS: "Upas",
          UNION: "Un", UN: "Un",
          UNIONS: "Uns", UNS: "Uns",
          VALLEY: "Vly", VLY: "Vly",
          VALLEYS: "Vlys", VLYS: "Vlys",
          VIA: "Via", VIA: "Via",
          VIADUCT: "Vl", VL: "Vl",
          VIEW: "Vw", VW: "Vw",
          VIEWS: "Vws", VWS: "Vws",
          VILLAGE: "Vlg", VLG: "Vlg",
          VILLAGES: "Vlgs", VLGS: "Vlgs",
          VILLE: "Vl", VL: "Vl",
          VISTA: "Vis", VIS: "Vis",
          WALK: "Walk", WALK: "Walk",
          WALL: "Wall", WALL: "Wall",
          WAY: "Way", WAY: "Way",
          WAYS: "Ways", WAYS: "Ways",
          WELL: "Wl", WL: "Wl",
          WELLS: "Wls", WLS: "Wls"
        };
        street_suffix_type = validSuffixes[up] || null;
      }
    }
  }

  const address = {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: pre_dir || null,
    street_post_directional_text: post_dir || null,
    unit_identifier: null,
    city_name: (cityUpper || "").toUpperCase() || null,
    state_code: "FL",
    postal_code: postal_code || null,
    plus_four_postal_code: plus_four_postal_code || null,
    country_code: "US",
    county_name: "Nassau",
    latitude: unAddr.latitude ?? null,
    longitude: unAddr.longitude ?? null,
    route_number: null,
    township: townshipText || null,
    range: rangeText || null,
    section: sectionText || null,
    block: null,
    lot: lotNumber || null,
    municipality_name: null,
  };
  writeJSON(path.join("data", "address.json"), address);

  // Lot: add lot_size_acre from Acreage
  let lotSizeAcre = null;
  if (acreageText != null) {
    const cleaned = String(acreageText).replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isNaN(n)) lotSizeAcre = n;
  }
  const lot = {
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
    lot_size_acre: lotSizeAcre,
  };
  writeJSON(path.join("data", "lot.json"), lot);

  // Tax values from Values table
  const valuesTable = $("div.values table.grid-transposed");
  let tax2025 = null,
    tax2024 = null;
  if (valuesTable.length) {
    const rows = valuesTable.find("tbody > tr");
    const getVal = (idx) =>
      rows
        .eq(idx)
        .find("td")
        .map((i, td) => $(td).text().trim())
        .get();
    const land = getVal(0);
    const improved = getVal(1);
    const market = getVal(2);
    const assessed = getVal(4);
    const countyTaxable = getVal(6);
    if (land.length >= 2) {
      tax2025 = {
        tax_year: 2025,
        property_land_amount: parseCurrencyToNumber(land[0]),
        property_building_amount: parseCurrencyToNumber(improved[0]),
        property_market_value_amount: parseCurrencyToNumber(market[0]),
        property_assessed_value_amount: parseCurrencyToNumber(assessed[0]),
        property_taxable_value_amount: parseCurrencyToNumber(countyTaxable[0]),
        monthly_tax_amount: null,
        yearly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
      };
      tax2024 = {
        tax_year: 2024,
        property_land_amount: parseCurrencyToNumber(land[1]),
        property_building_amount: parseCurrencyToNumber(improved[1]),
        property_market_value_amount: parseCurrencyToNumber(market[1]),
        property_assessed_value_amount: parseCurrencyToNumber(assessed[1]),
        property_taxable_value_amount: parseCurrencyToNumber(countyTaxable[1]),
        monthly_tax_amount: null,
        yearly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
      };
    }
  }
  if (tax2025) writeJSON(path.join("data", "tax_2025.json"), tax2025);
  if (tax2024) writeJSON(path.join("data", "tax_2024.json"), tax2024);

  // Sales/Deeds/Files
  const salesRows = $("section.sale table.grid2 tbody tr");
  const deedTypeMap = { 
    WD: "Warranty Deed",
    QC: "Quit Claim Deed", 
    SW: "Special Warranty Deed"
  };

  let salesIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;
  const salesFileRefs = [];

  salesRows.each((i, tr) => {
    const tds = $(tr).find("td");
    const instCell = tds.eq(0);
    const instAbbr = instCell.find("abbr").first().text().trim();
    const deedUrl = instCell.find("a").attr("href") || null;
    const bookPage = instCell.find("a").text().trim();
    const dateStr = tds.eq(1).text().trim();
    const priceStr = tds.eq(4).text().trim();
    const deedType = deedTypeMap[instAbbr] || "Warranty Deed";

    const purchase_price_amount = parseCurrencyToNumber(priceStr);

    salesIndex += 1;
    deedIndex += 1;
    fileIndex += 1;

    const salesObj = {
      ownership_transfer_date: dateStr || null,
      purchase_price_amount,
    };
    const salesFileName = `sales_${salesIndex}.json`;
    writeJSON(path.join("data", salesFileName), salesObj);

    const deedObj = { deed_type: deedType };
    const deedFileName = `deed_${deedIndex}.json`;
    writeJSON(path.join("data", deedFileName), deedObj);

    const fileObj = {
      file_format: null,
      name: (instAbbr ? instAbbr + " " : "") + (bookPage || ""),
      original_url: deedUrl,
      ipfs_url: null,
      document_type: "ConveyanceDeedWarrantyDeed",
    };
    const fileFileName = `file_${fileIndex}.json`;
    writeJSON(path.join("data", fileFileName), fileObj);

    const relDeedFile = {
      to: { "/": `./${deedFileName}` },
      from: { "/": `./${fileFileName}` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${deedIndex}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      to: { "/": `./${salesFileName}` },
      from: { "/": `./${deedFileName}` },
    };
    writeJSON(
      path.join("data", `relationship_sales_deed_${salesIndex}.json`),
      relSalesDeed,
    );

    salesFileRefs.push({ date: dateStr, salesFileName, index: salesIndex });
  });

  // Owners from owners/owner_data.json: create both person and company as needed, and link by sale date
  if (ownersData && parcelIdentifier) {
    const propertyKey = `property_${parcelIdentifier}`;
    const ownersByDate = ownersData[propertyKey]?.owners_by_date || {};

    let personCounter = 0;
    let companyCounter = 0;
    const personIndexByKey = new Map();
    const companyIndexByKey = new Map();

    function ensurePerson(owner) {
      const key = `${owner.first_name}|${owner.middle_name || ""}|${owner.last_name}`;
      if (!personIndexByKey.has(key)) {
        personCounter += 1;
        const personObj = {
          source_http_request: {
            method: "GET",
            url: seed.source_url || "https://example.com/person-data"
          },
          request_identifier: `${owner.first_name}_${owner.last_name}_${personCounter}`,
          birth_date: null,
          first_name: owner.first_name || "Unknown",
          last_name: owner.last_name || "Unknown",
          middle_name: owner.middle_name || null,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null
        };
        const fileName = `person_${personCounter}.json`;
        writeJSON(path.join("data", fileName), personObj);
        personIndexByKey.set(key, fileName);
      }
      return personIndexByKey.get(key);
    }

    function ensureCompany(owner) {
      const key = owner.name;
      if (!companyIndexByKey.has(key)) {
        companyCounter += 1;
        const companyObj = { name: owner.name };
        const fileName = `company_${companyCounter}.json`;
        writeJSON(path.join("data", fileName), companyObj);
        companyIndexByKey.set(key, fileName);
      }
      return companyIndexByKey.get(key);
    }

    // Create relationships for each sale date
    salesFileRefs.forEach((sref) => {
      const ownersForDate = ownersByDate[sref.date] || [];
      ownersForDate.forEach((owner, j) => {
        if (owner.type === "person") {
          const personFile = ensurePerson(owner);
          const rel = {
            to: { "/": `./${personFile}` },
            from: { "/": `./${sref.salesFileName}` },
          };
          writeJSON(
            path.join(
              "data",
              `relationship_sales_person_${sref.index}_${j + 1}.json`,
            ),
            rel,
          );
        } else if (owner.type === "company") {
          const companyFile = ensureCompany(owner);
          const rel = {
            to: { "/": `./${companyFile}` },
            from: { "/": `./${sref.salesFileName}` },
          };
          writeJSON(
            path.join(
              "data",
              `relationship_sales_company_${sref.index}_${j + 1}.json`,
            ),
            rel,
          );
        }
      });
    });
  }

  // Structure (best-effort mapping)
  const seRows = $("div.se table.grid2 tbody tr");
  let exteriorWall = null;
  let roofStructure = null;
  let roofCover = null;
  let interiorWall = null;
  let interiorFloorings = [];
  let frameDesc = null;
  let storiesDesc = null;
  let attachmentTypeDesc = null;
  let subfloorDesc = null;
  seRows.each((i, tr) => {
    const tds = $(tr).find("td");
    const desc = tds.eq(1).text().trim();
    const details = tds.eq(3).text().trim();
    if (/Exterior Wall/i.test(desc)) exteriorWall = details;
    if (/Roof Structure/i.test(desc)) roofStructure = details;
    if (/Roof Cover/i.test(desc)) roofCover = details;
    if (/Interior Wall/i.test(desc)) interiorWall = details;
    if (/Interior Flooring/i.test(desc)) interiorFloorings.push(details);
    if (/Frame/i.test(desc)) frameDesc = details;
    if (/Stories/i.test(desc)) storiesDesc = details;
    if (/Attachment/i.test(desc)) attachmentTypeDesc = details;
    if (/Subfloor|Foundation/i.test(desc)) subfloorDesc = details;
  });

  function mapExteriorWall(details) {
    if (!details) return null;
    const u = details.toUpperCase();
    if (u.includes("STUC")) return "Stucco";
    if (u.includes("BRK")) return "Brick";
    return null;
  }
  function mapInteriorWallSurface(details) {
    if (!details) return null;
    const u = details.toUpperCase();
    if (u.includes("DRYWALL")) return "Drywall";
    if (u.includes("PLASTER")) return "Plaster";
    return null;
  }
  function mapFlooring(s) {
    const u = (s || "").toUpperCase();
    if (u.includes("CARPET")) return "Carpet";
    if (u.includes("CLAY TILE") || u.includes("CERAMIC")) return "Ceramic Tile";
    if (u.includes("WOOD")) return "Solid Hardwood";
    return null;
  }
  function mapRoofCover(s) {
    const u = (s || "").toUpperCase();
    if (u.includes("COMP SHNGL") || u.includes("COMPOSITION"))
      return "3-Tab Asphalt Shingle";
    if (u.includes("ARCH SHNGL")) return "Architectural Asphalt Shingle";
    if (u.includes("METAL")) return "Metal Standing Seam";
    return null;
  }
  function mapRoofDesign(s) {
    const u = (s || "").toUpperCase();
    if (u.includes("IRREGULAR")) return "Combination";
    return null;
  }
  function mapFrame(s) {
    const u = (s || "").toUpperCase();
    if (u.includes("WOOD FRAME")) return "Wood Frame";
    if (u.includes("CONC")) return "Concrete Block";
    return null;
  }
  function parseStories(s) {
    if (!s) return null;
    const m = s.match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }
  function mapAttachmentType(s) {
    if (!s) return null;
    const u = s.toUpperCase();
    if (u.includes("DETACHED")) return "Detached";
    if (u.includes("ATTACHED")) return "Attached";
    if (u.includes("SEMI")) return "SemiDetached";
    return null;
  }
  function mapSubfloorMaterial(s) {
    if (!s) return null;
    const u = s.toUpperCase();
    if (u.includes("CONCRETE") || u.includes("SLAB")) return "Concrete Slab";
    if (u.includes("WOOD") || u.includes("PLYWOOD")) return "Plywood";
    if (u.includes("CRAWL")) return "Crawl Space";
    return null;
  }

  const flooringPrimary = interiorFloorings.length
    ? mapFlooring(interiorFloorings[0])
    : null;
  const flooringSecondary =
    interiorFloorings.length > 1 ? mapFlooring(interiorFloorings[1]) : null;

  // Create structure for each building
  let buildingIndex = 0;
  if (actualBuildingCount > 0) {
    $("section.buildings .building-data").each((i, buildingData) => {
    buildingIndex++;
    const buildingRows = $(buildingData).find(".se table.grid2 tbody tr");
    let buildingExteriorWall = null, buildingRoofCover = null, buildingInteriorWall = null;
    let buildingFrame = null, buildingStories = null;
    
    buildingRows.each((j, tr) => {
      const tds = $(tr).find("td");
      const desc = tds.eq(1).text().trim();
      const details = tds.eq(3).text().trim();
      if (/Exterior Wall/i.test(desc)) buildingExteriorWall = details;
      if (/Roof Cover/i.test(desc)) buildingRoofCover = details;
      if (/Interior Wall/i.test(desc)) buildingInteriorWall = details;
      if (/Frame/i.test(desc)) buildingFrame = details;
      if (/Stories/i.test(desc)) buildingStories = details;
    });
    
    const buildingSqft = $(buildingData).find("table.grid2 tbody tr td").first().text().replace(/[,]/g, "").trim();
    
    const structure = {
      source_http_request: {
        method: "GET",
        url: seed.source_url || "https://example.com/structure-data"
      },
      request_identifier: `${parcelIdentifier}_building_${buildingIndex}`,
      architectural_style_type: null,
      attachment_type: mapAttachmentType(attachmentTypeDesc),
      exterior_wall_material_primary: mapExteriorWall(buildingExteriorWall || exteriorWall),
      exterior_wall_material_secondary: null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: null,
      flooring_material_primary: flooringPrimary,
      flooring_material_secondary: flooringSecondary,
      subfloor_material: mapSubfloorMaterial(subfloorDesc),
      flooring_condition: null,
      interior_wall_structure_material: mapFrame(buildingFrame || frameDesc),
      interior_wall_surface_material_primary: mapInteriorWallSurface(buildingInteriorWall || interiorWall),
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: mapRoofCover(buildingRoofCover || roofCover),
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: mapRoofDesign(roofStructure),
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: (buildingRoofCover || roofCover) && (buildingRoofCover || roofCover).toUpperCase().includes("COMP") ? "Composition" : null,
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
      primary_framing_material: mapFrame(buildingFrame || frameDesc),
      secondary_framing_material: null,
      structural_damage_indicators: null,
      finished_base_area: buildingSqft ? Number(buildingSqft) : null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      number_of_stories: parseStories(buildingStories || storiesDesc),
      roof_date: null,
      siding_installation_date: null,
      exterior_door_installation_date: null,
      foundation_repair_date: null,
      window_installation_date: null
    };
    writeJSON(path.join("data", `structure_${buildingIndex}.json`), structure);
    });
  } else {
    // Create at least one structure if no buildings found
    const structure = {
      source_http_request: {
        method: "GET",
        url: seed.source_url || "https://example.com/structure-data"
      },
      request_identifier: `${parcelIdentifier}_building_1`,
      architectural_style_type: null,
      attachment_type: mapAttachmentType(attachmentTypeDesc),
      exterior_wall_material_primary: mapExteriorWall(exteriorWall),
      exterior_wall_material_secondary: null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: null,
      flooring_material_primary: flooringPrimary,
      flooring_material_secondary: flooringSecondary,
      subfloor_material: mapSubfloorMaterial(subfloorDesc),
      flooring_condition: null,
      interior_wall_structure_material: mapFrame(frameDesc),
      interior_wall_surface_material_primary: mapInteriorWallSurface(interiorWall),
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: mapRoofCover(roofCover),
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: mapRoofDesign(roofStructure),
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: roofCover && roofCover.toUpperCase().includes("COMP") ? "Composition" : null,
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
      primary_framing_material: mapFrame(frameDesc),
      secondary_framing_material: null,
      structural_damage_indicators: null,
      finished_base_area: heatedSqft ? Number(heatedSqft) : null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      number_of_stories: parseStories(storiesDesc),
      roof_date: null,
      siding_installation_date: null,
      exterior_door_installation_date: null,
      foundation_repair_date: null,
      window_installation_date: null
    };
    writeJSON(path.join("data", "structure_1.json"), structure);
  }

  // Create utilities for each building
  for (let i = 1; i <= buildingsToCreate; i++) {
    let util = null;
    if (utilitiesData && parcelIdentifier) {
      const key = `property_${parcelIdentifier}`;
      util = utilitiesData[key];
    }
    
    const utilityOut = {
      source_http_request: {
        method: "GET",
        url: seed.source_url || "https://example.com/utility-data"
      },
      request_identifier: `${parcelIdentifier}_utility_${i}`,
      cooling_system_type: util?.cooling_system_type ?? null,
      heating_system_type: util?.heating_system_type ?? null,
      public_utility_type: util?.public_utility_type ?? null,
      sewer_type: util?.sewer_type ?? null,
      water_source_type: util?.water_source_type ?? null,
      plumbing_system_type: util?.plumbing_system_type ?? null,
      plumbing_system_type_other_description: util?.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: util?.electrical_panel_capacity ?? null,
      electrical_wiring_type: util?.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: util?.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description: util?.electrical_wiring_type_other_description ?? null,
      solar_panel_present: util?.solar_panel_present ? true : false,
      solar_panel_type: util?.solar_panel_type ?? null,
      solar_panel_type_other_description: util?.solar_panel_type_other_description ?? null,
      smart_home_features: util?.smart_home_features ?? null,
      smart_home_features_other_description: util?.smart_home_features_other_description ?? null,
      hvac_unit_condition: util?.hvac_unit_condition ?? null,
      solar_inverter_visible: util?.solar_inverter_visible ? true : false,
      hvac_unit_issues: util?.hvac_unit_issues ?? null,
      electrical_panel_installation_date: util?.electrical_panel_installation_date ?? null,
      electrical_rewire_date: util?.electrical_rewire_date ?? null,
      hvac_capacity_kw: util?.hvac_capacity_kw ?? null,
      hvac_capacity_tons: util?.hvac_capacity_tons ?? null,
      hvac_equipment_component: util?.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: util?.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: util?.hvac_equipment_model ?? null,
      hvac_installation_date: util?.hvac_installation_date ?? null,
      hvac_seer_rating: util?.hvac_seer_rating ?? null,
      hvac_system_configuration: util?.hvac_system_configuration ?? null,
      plumbing_system_installation_date: util?.plumbing_system_installation_date ?? null,
      sewer_connection_date: util?.sewer_connection_date ?? null,
      solar_installation_date: util?.solar_installation_date ?? null,
      solar_inverter_installation_date: util?.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: util?.solar_inverter_manufacturer ?? null,
      solar_inverter_model: util?.solar_inverter_model ?? null,
      water_connection_date: util?.water_connection_date ?? null,
      water_heater_installation_date: util?.water_heater_installation_date ?? null,
      water_heater_manufacturer: util?.water_heater_manufacturer ?? null,
      water_heater_model: util?.water_heater_model ?? null,
      well_installation_date: util?.well_installation_date ?? null
    };
    writeJSON(path.join("data", `utility_${i}.json`), utilityOut);
  }

  // Layouts from owners/layout_data.json or create basic layouts for each building
  if (layoutsData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const layouts = layoutsData[key]?.layouts || [];
    layouts.forEach((layout, idx) => {
      const out = {
        source_http_request: {
          method: "GET",
          url: seed.source_url || "https://example.com/layout-data"
        },
        request_identifier: `${parcelIdentifier}_layout_${idx + 1}`,
        space_type: layout.space_type ?? null,
        space_index: layout.space_index || (idx + 1),
        flooring_material_type: layout.flooring_material_type ?? null,
        size_square_feet: layout.size_square_feet ?? null,
        floor_level: layout.floor_level ?? null,
        has_windows: layout.has_windows ?? null,
        window_design_type: layout.window_design_type ?? null,
        window_material_type: layout.window_material_type ?? null,
        window_treatment_type: layout.window_treatment_type ?? null,
        is_finished: !!layout.is_finished,
        furnished: layout.furnished ?? null,
        paint_condition: layout.paint_condition ?? null,
        flooring_wear: layout.flooring_wear ?? null,
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
        is_exterior: !!layout.is_exterior,
        pool_condition: layout.pool_condition ?? null,
        pool_surface_type: layout.pool_surface_type ?? null,
        pool_water_quality: layout.pool_water_quality ?? null,
        bathroom_renovation_date: layout.bathroom_renovation_date ?? null,
        kitchen_renovation_date: layout.kitchen_renovation_date ?? null,
        flooring_installation_date: layout.flooring_installation_date ?? null
      };
      writeJSON(path.join("data", `layout_${idx + 1}.json`), out);
    });
  } else {
    // Create basic layout for each building if no layout data available
    for (let i = 1; i <= buildingsToCreate; i++) {
      const basicLayout = {
        source_http_request: {
          method: "GET",
          url: seed.source_url || "https://example.com/layout-data"
        },
        request_identifier: `${parcelIdentifier}_layout_${i}`,
        space_type: null,
        space_index: i,
        flooring_material_type: null,
        size_square_feet: null,
        floor_level: null,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        is_finished: true,
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
        bathroom_renovation_date: null,
        kitchen_renovation_date: null,
        flooring_installation_date: null
      };
      writeJSON(path.join("data", `layout_${i}.json`), basicLayout);
    }
  }
}

try {
  main();
  console.log("Script executed successfully");
} catch (e) {
  if (e && e.message) {
    console.error(e.message);
  } else {
    console.error(e);
  }
  process.exit(1);
}
