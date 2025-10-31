// scripts/data_extractor.js
// Extraction script per evaluator workflow
// Reads: input.html, unnormalized_address.json, property_seed.json, owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// Writes: JSON outputs to ./data

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(text) {
  if (!text) return null;
  // Remove all non-digit and non-decimal point characters.
  // Crucially, the '-' is removed from the allowed characters.
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Take the absolute value to ensure it's non-negative,
  // then round to at most 2 decimal places.
  return parseFloat(Math.abs(n).toFixed(2));
}

// CORRECTED HELPER FUNCTION: Extracts only digits (removing commas) and returns as a string
function extractNumberAsString(text) {
  if (!text) return null;
  // Remove all non-digit characters (including commas, spaces, letters)
  const cleaned = String(text).replace(/\D/g, '');
  return cleaned || null; // Return null if no digits are found after cleaning
}

// Helper function to capitalize the first letter of each word
function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Define the street suffix normalization map outside the function,
// ideally at the top of your data_extractor.js file, along with other constants.
const STREET_SUFFIX_NORMALIZATION = {
  "ST": "St", "STREET": "St",
  "RD": "Rd", "ROAD": "Rd",
  "AVE": "Ave", "AVENUE": "Ave",
  "BLVD": "Blvd", "BOULEVARD": "Blvd",
  "LN": "Ln", "LANE": "Ln",
  "DR": "Dr", "DRIVE": "Dr",
  "CT": "Ct", "COURT": "Ct",
  "PL": "Pl", "PLACE": "Pl",
  "WAY": "Way",
  "HWY": "Hwy", "HIGHWAY": "Hwy",
  "TRL": "Trl", "TRAIL": "Trl",
  "CIR": "Cir", "CIRCLE": "Cir",
  "SQ": "Sq", "SQUARE": "Sq",
  "TER": "Ter", "TERRACE": "Ter",
  "PKWY": "Pkwy", "PARKWAY": "Pkwy",
  "EXPY": "Expy", "EXPRESSWAY": "Expy",
  "FWY": "Fwy", "FREEWAY": "Fwy",
  "JCT": "Jct", "JUNCTION": "Jct",
  "LOOP": "Loop",
  "RAMP": "Ramp",
  "RUN": "Run",
  "SPG": "Spg", "SPRING": "Spg",
  "SPGS": "Spgs", "SPRINGS": "Spgs",
  "STA": "Sta", "STATION": "Sta",
  "TPKE": "Tpke", "TURNPIKE": "Tpke",
  "XING": "Xing", "CROSSING": "Xing",
  "ALY": "Aly", "ALLEY": "Aly",
  "BCH": "Bch", "BEACH": "Bch",
  "BLF": "Blf", "BLUFF": "Blf",
  "BLFS": "Blfs", "BLUFFS": "Blfs",
  "BR": "Br", "BRANCH": "Br",
  "BRG": "Brg", "BRIDGE": "Brg",
  "BRK": "Brk", "BROOK": "Brk",
  "BRKS": "Brks", "BROOKS": "Brks",
  "BYU": "Byu", "BAYOU": "Byu",
  "CANYON": "Cyn", "CYN": "Cyn",
  "CLF": "Clf", "CLIFF": "Clf",
  "CLFS": "Clfs", "CLIFFS": "Clfs",
  "CMN": "Cmn", "COMMON": "Cmn",
  "CMNS": "Cmns", "COMMONS": "Cmns",
  "COR": "Cor", "CORNER": "Cor",
  "CORS": "Cors", "CORNERS": "Cors",
  "CRK": "Crk", "CREEK": "Crk",
  "CRST": "Crst", "CREST": "Crst",
  "CSWY": "Cswy", "CAUSEWAY": "Cswy",
  "CTR": "Ctr", "CENTER": "Ctr",
  "CTRS": "Ctrs", "CENTERS": "Ctrs",
  "CURV": "Curv", "CURVE": "Curv",
  "DM": "Dm", "DAM": "Dm",
  "DV": "Dv", "DIVIDE": "Dv",
  "EST": "Est", "ESTATE": "Est",
  "ESTS": "Ests", "ESTATES": "Ests",
  "EXT": "Ext", "EXTENSION": "Ext",
  "EXTS": "Exts", "EXTENSIONS": "Exts",
  "FALL": "Fall",
  "FLS": "Fls", "FALLS": "Fls",
  "FLD": "Fld", "FIELD": "Fld",
  "FLDS": "Flds", "FIELDS": "Flds",
  "FLT": "Flt", "FLAT": "Flt",
  "FLTS": "Flts", "FLATS": "Flats",
  "FRD": "Frd", "FORD": "Frd",
  "FRGS": "Frgs", "FORGES": "Frgs",
  "FRK": "Frk", "FORK": "Frk",
  "FRKS": "Frks", "FORKS": "Frks",
  "FRST": "Frst", "FOREST": "Frst",
  "FRY": "Fry", "FERRY": "Fry",
  "FT": "Ft", "FORT": "Ft",
  "GDN": "Gdn", "GARDEN": "Gdn",
  "GDNS": "Gdns", "GARDENS": "Gdns",
  "GLN": "Gln", "GLEN": "Gln",
  "GLNS": "Glns", "GLENS": "Glns",
  "GRN": "Grn", "GREEN": "Grn",
  "GRNS": "Grns", "GREENS": "Grns",
  "GRV": "Grv", "GROVE": "Grv",
  "GRVS": "Grvs", "GROVES": "Grvs",
  "GTWY": "Gtwy", "GATEWAY": "Gtwy",
  "HBR": "Hbr", "HARBOR": "Hbr",
  "HBRS": "Hbrs", "HARBORS": "Hbrs",
  "HL": "Hl", "HILL": "Hl",
  "HLS": "Hls", "HILLS": "Hls",
  "HOLW": "Holw", "HOLLOW": "Holw",
  "HTS": "Hts", "HEIGHTS": "Hts",
  "HVN": "Hvn", "HAVEN": "Hvn",
  "INLT": "Inlt", "INLET": "Inlt",
  "IS": "Is", "ISLAND": "Is",
  "ISS": "Iss", "ISLANDS": "Iss",
  "KY": "Ky", "KEY": "Ky",
  "KYS": "Kys", "KEYS": "Kys",
  "LAKE": "Lk", "LK": "Lk",
  "LKS": "Lks", "LAKES": "Lks",
  "LNDG": "Lndg", "LANDING": "Lndg",
  "LF": "Lf", "LOAF": "Lf",
  "LGT": "Lgt", "LIGHT": "Lgt",
  "LGTS": "Lgts", "LIGHTS": "Lgts",
  "LCK": "Lck", "LOCK": "Lck",
  "LCKS": "Lcks", "LOCKS": "Lcks",
  "MDW": "Mdw", "MEADOW": "Mdw",
  "MDWS": "Mdws", "MEADOWS": "Mdws",
  "ML": "Ml", "MILL": "Ml",
  "MLS": "Mls", "MILLS": "Mls",
  "MNR": "Mnr", "MANOR": "Mnr",
  "MNRS": "Mnrs", "MANORS": "Mnrs",
  "MT": "Mt", "MOUNT": "Mt",
  "MTN": "Mtn", "MOUNTAIN": "Mtn",
  "MTNS": "Mtns", "MOUNTAINS": "Mtns",
  "NCK": "Nck", "NECK": "Nck",
  "ORCH": "Orch", "ORCHARD": "Orch",
  "PASS": "Pass",
  "PSGE": "Psge", "PASSAGE": "Psge",
  "PIKE": "Pike",
  "PLN": "Pln", "PLAIN": "Pln",
  "PLNS": "Plns", "PLAINS": "Plns",
  "PLZ": "Plz", "PLAZA": "Plz",
  "PNE": "Pne", "PINE": "Pne",
  "PNES": "Pnes", "PINES": "Pnes",
  "PR": "Pr", "PRAIRIE": "Pr",
  "PRT": "Prt", "PORT": "Prt",
  "PRTS": "Prts", "PORTS": "Prts",
  "PT": "Pt", "POINT": "Pt",
  "PTS": "Pts", "POINTS": "Pts",
  "RADL": "Radl", "RADIAL": "Radl",
  "RMP": "Rmp", "RAMP": "Rmp",
  "RCH": "Rch", "RANCH": "Rch",
  "RNCH": "Rnch", "RANCH": "Rnch",
  "RDG": "Rdg", "RIDGE": "Rdg",
  "RDGS": "Rdgs", "RIDGES": "Rdgs",
  "RPD": "Rpd", "RAPID": "Rpd",
  "RPDS": "Rpds", "RAPIDS": "Rpds",
  "RST": "Rst", "REST": "Rst",
  "RTE": "Rte", "ROUTE": "Rte",
  "SHL": "Shl", "SHOAL": "Shl",
  "SHLS": "Shls", "SHOALS": "Shls",
  "SHR": "Shr", "SHORE": "Shr",
  "SHRS": "Shrs", "SHORES": "Shrs",
  "SKWY": "Skwy", "SKYWAY": "Skwy",
  "SMT": "Smt", "SUMMIT": "Smt",
  "SPUR": "Spur",
  "SQS": "Sqs", "SQUARES": "Sqs",
  "STRA": "Stra", "STRAVENUE": "Stra",
  "STRM": "Strm", "STREAM": "Strm",
  "TRCE": "Trce", "TRACE": "Trce",
  "TRFY": "Trfy", "TRAFFICWAY": "Trfy",
  "TRWY": "Trwy", "THROUGHWAY": "Trwy",
  "TUNL": "Tunl", "TUNNEL": "Tunl",
  "UN": "Un", "UNION": "Un",
  "UNS": "Uns", "UNIONS": "Uns",
  "VIA": "Via",
  "VLG": "Vlg", "VILLAGE": "Vlg",
  "VLGS": "Vlgs", "VILLAGES": "Vlgs",
  "VLY": "Vly", "VALLEY": "Vly",
  "VLYS": "Vlys", "VALLEYS": "Vlys",
  "VW": "Vw", "VIEW": "Vw",
  "VWS": "Vws", "VIEWS": "Vws",
  "WLS": "Wls", "WELLS": "Wls",
  "XRD": "Xrd", "CROSSROAD": "Xrd",
  "XRDS": "Xrds", "CROSSROADS": "Xrds",
  "WALK": "Walk",
  "WALL": "Wall",
  "WLS": "Wls", "WELLS": "Wls",
  "CP": "Cp", "CAMP": "Cp",
  "DM": "Dm", "DAM": "Dm",
  "FRGS": "Frgs", "FORGES": "Frgs",
  "ISLE": "Isle",
  "KY": "Ky", "KEY": "Ky",
  "LGT": "Lgt", "LIGHT": "Lgt",
  "LNDG": "Lndg", "LANDING": "Lndg",
  "ML": "Ml", "MILL": "Ml",
  "MT": "Mt", "MOUNT": "Mt",
  "Nck": "Nck", "NECK": "Nck",
  "OPAS": "Opas",
  "OVRPS": "Ovrps", "OVERPASS": "Ovrps",
  "PR": "Pr", "PRAIRIE": "Pr",
  "RCH": "Rch", "RANCH": "Rch",
  "RTE": "Rte", "ROUTE": "Rte",
  "SHL": "Shl", "SHOAL": "Shl",
  "SPG": "Spg", "SPRING": "Spg",
  "STA": "Sta", "STATION": "Sta",
  "TRWY": "Trwy", "THROUGHWAY": "Trwy",
  "UN": "Un", "UNION": "Un",
  "UPAS": "Upas",
  "VLY": "Vly", "VALLEY": "Vly",
  "VW": "Vw", "VIEW": "Vw",
  "WALK": "Walk",
  "WALL": "Wall",
  "WLS": "Wls", "WELLS": "Wls",
  "ANX": "Anx", "ANNEX": "Anx",
  "ARC": "Arc", "ARCADE": "Arc",
  "BGS": "Bgs", "BURG": "Bgs",
  "BND": "Bnd", "BEND": "Bnd",
  "BTM": "Btm", "BOTTOM": "Btm",
  "BYP": "Byp", "BYPASS": "Byp",
  "CLB": "Clb", "CLUB": "Clb",
  "CPE": "Cpe", "CAPE": "Cpe",
  "CRSE": "Crse", "COURSE": "Crse",
  "CRES": "Cres", "CRESCENT": "Cres",
  "DL": "Dl", "DALE": "Dl",
  "DRS": "Drs", "DIVERSION": "Drs",
  "FLD": "Fld", "FIELD": "Fld",
  "FRDS": "Frds", "FORD": "Frds",
  "FRGS": "Frgs", "FORGE": "Frgs",
  "FRK": "Frk", "FORK": "Frk",
  "FRST": "Frst", "FOREST": "Frst",
  "FRY": "Fry", "FERRY": "Fry",
  "GARDEN": "Gdn", "GDN": "Gdn",
  "GLN": "Gln", "GLEN": "Gln",
  "GRN": "Grn", "GREEN": "Grn",
  "GRV": "Grv", "GROVE": "Grv",
  "HBR": "Hbr", "HARBOR": "Hbr",
  "HL": "Hl", "HILL": "Hl",
  "HOLW": "Holw", "HOLLOW": "Holw",
  "HTS": "Hts", "HEIGHTS": "Hts",
  "HVN": "Hvn", "HAVEN": "Hvn",
  "IS": "Is", "ISLAND": "Is",
  "JCT": "Jct", "JUNCTION": "Jct",
  "KNL": "Knl", "KNOLL": "Knl",
  "KNLS": "Knls", "KNOLLS": "Knls",
  "LAKE": "Lk", "LK": "Lk",
  "LNDG": "Lndg", "LANDING": "Lndg",
  "LOOP": "Loop",
  "MALL": "Mall",
  "MDW": "Mdw", "MEADOW": "Mdw",
  "MEWS": "Mews",
  "ML": "Ml", "MILL": "Ml",
  "MNR": "Mnr", "MANOR": "Mnr",
  "MSN": "Msn", "MISSION": "Msn",
  "MT": "Mt", "MOUNT": "Mt",
  "MTN": "Mtn", "MOUNTAIN": "Mtn",
  "MTWY": "Mtwy", "MOTORWAY": "Mtwy",
  "Nck": "Nck", "NECK": "Nck",
  "ORCH": "Orch", "ORCHARD": "Orch",
  "PASS": "Pass",
  "PIKE": "Pike",
  "PLN": "Pln", "PLAIN": "Pln",
  "PLZ": "Plz", "PLAZA": "Plz",
  "PNE": "Pne", "PINE": "Pne",
  "PNES": "Pnes", "PINES": "Pnes",
  "PR": "Pr", "PRAIRIE": "Pr",
  "PRT": "Prt", "PORT": "Prt",
  "PSGE": "Psge", "PASSAGE": "Psge",
  "PT": "Pt", "POINT": "Pt",
  "RADL": "Radl", "RADIAL": "Radl",
  "RCH": "Rch", "RANCH": "Rch",
  "RDG": "Rdg", "RIDGE": "Rdg",
  "RIV": "Riv", "RIVER": "Riv",
  "RMP": "Rmp", "RAMP": "Rmp",
  "ROW": "Row",
  "RUE": "Rue",
  "RUN": "Run",
  "SHL": "Shl", "SHOAL": "Shl",
  "SHR": "Shr", "SHORE": "Shr",
  "SKWY": "Skwy", "SKYWAY": "Skwy",
  "SMT": "Smt", "SUMMIT": "Smt",
  "SPUR": "Spur",
  "SQ": "Sq", "SQUARE": "Sq",
  "STA": "Sta", "STATION": "Sta",
  "STRM": "Strm", "STREAM": "Strm",
  "TER": "Ter", "TERRACE": "Ter",
  "TPKE": "Tpke", "TURNPIKE": "Tpke",
  "TRCE": "Trce", "TRACE": "Trce",
  "TRFY": "Trfy", "TRAFFICWAY": "Trfy",
  "TRL": "Trl", "TRAIL": "Trl",
  "TRLR": "Trlr", "TRAILER": "Trlr",
  "TUNL": "Tunl", "TUNNEL": "Tunl",
  "UN": "Un", "UNION": "Un",
  "VIA": "Via",
  "VLG": "Vlg", "VILLAGE": "Vlg",
  "VLY": "Vly", "VALLEY": "Vly",
  "VW": "Vw", "VIEW": "Vw",
  "WALK": "Walk",
  "WALL": "Wall",
  "WAY": "Way",
  "XING": "Xing", "CROSSING": "Xing",
};

function extractProperty($, seed) {
  let property_type = null; // Default to null

  // ATTEMPT 1: Map from "Property (DOR) Use Code" using the provided PDF logic
  let dorUseCode = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.eq(0).text().trim().toLowerCase().includes("property (dor) use code")) {
        const dorText = tds.eq(1).text().trim();
        const match = dorText.match(/\(Code:\s*(\d{4})\)/);
        if (match) {
          dorUseCode = parseInt(match[1], 10);
          return false; // Exit .each loop
        }
      }
    });

  if (dorUseCode !== null) {
    // RESIDENTIAL CATEGORIES
    if (dorUseCode >= 1 && dorUseCode <= 88) { // RES 00 VACANT RESIDENTIAL
      property_type = "VacantLand";
    } else if (dorUseCode >= 100 && dorUseCode <= 188) { // RES 01 SINGLE FAMILY RESIDENTIAL
      property_type = "SingleFamily";
    } else if (dorUseCode >= 200 && dorUseCode <= 288) { // RES 02 MOBILE HOMES
      property_type = "MobileHome";
    } else if (dorUseCode >= 301 && dorUseCode <= 360) { // RES 03 MULTI-FAMILY (10 UNITS OR MORE)
      property_type = "MultipleFamily";
    } else if (dorUseCode >= 400 && dorUseCode <= 441) { // RES 04 CONDOMINIA
      property_type = "Condominium";
    } else if (dorUseCode >= 500 && dorUseCode <= 502) { // RES 05 COOPERATIVES
      property_type = "Cooperative";
    } else if (dorUseCode >= 650 && dorUseCode <= 653) { // RES 06 RETIREMENT HMS (NON-EX)
      property_type = "Retirement";
    } else if (dorUseCode >= 801 && dorUseCode <= 860) { // RES 08 MULTI-FAMILY(UNDER 10 UNITS)
      if (dorUseCode === 810) property_type = "Duplex";
      else if (dorUseCode === 820) property_type = "TwoToFourFamily"; // Triplexes & Quad
      else property_type = "MultipleFamily"; // For other multi-family under 10 units
    } else if (dorUseCode >= 900 && dorUseCode <= 989) { // RES 09 RESIDENTIAL COMMON ELEMENTS/AREAS
      property_type = "ResidentialCommonElementsAreas";
    }
    // COMMERCIAL, INDUSTRIAL, AGRICULTURAL, INSTITUTIONAL, MISCELLANEOUS
    // For these, if they are vacant, they are VacantLand. Otherwise, they fall under MiscellaneousResidential
    // as per the schema's limited enums for non-residential types.
    else if (dorUseCode >= 1000 && dorUseCode <= 1064) { // COM 10 VACANT COMMERCIAL
      property_type = "COMMERCIAL";
    } else if (dorUseCode >= 4001 && dorUseCode <= 4064) { // IND 40 VACANT INDUSTRIAL
      property_type = "INDUSTRIAL";
    } else if (dorUseCode >= 7000 && dorUseCode <= 7079) { // INST 70 VACANT INSTITUTIONAL
      property_type = "INSTITUTIONAL";
    } else if (dorUseCode >= 8050 && dorUseCode <= 8095) { // GOV 80 VACANT GOVERNMENTAL
      property_type = "GOVERNMENTAL";
    } else if (dorUseCode === 9910) { // MISC 99 Inaccessible tracts
      property_type = "VacantLand";
    } else if (dorUseCode >= 1100 && dorUseCode <= 9980) { // All other non-residential codes
      property_type = null;
    }
  }

  // Year built(s)
  let years = [];
  $('h4:contains("Building Characteristics")').each((i, el) => {
    const section = $(el).parent();
    const text = section.text();
    const m = text.match(/Actual\s+Year\s+Built:\s*(\d{4})/i);
    if (m) years.push(parseInt(m[1], 10));
  });
  let property_structure_built_year = years.length ? Math.max(...years) : null;

  // Subdivision
  let subdivision = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.eq(0).text().trim().toLowerCase().includes("subdivision")) {
        const val = tds.eq(1).text().trim();
        subdivision = val || null;
      }
    });

  // Extract total living and total under roof for each building cleanly from subarea summary tables
  const livingAreas = [];
  const underRoofAreas = [];
  $("table.center tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const rowLabel = tds.eq(0).text().trim().toUpperCase();
      const lastCell = tds.last().text().trim();
      if (/^TOTAL\s+LIVING\s+AREA$/i.test(rowLabel)) {
        livingAreas.push(lastCell.toUpperCase());
      }
      if (/^TOTAL\s+UNDER\s+ROOF$/i.test(rowLabel)) {
        underRoofAreas.push(lastCell.toUpperCase());
      }
    }
  });

  // Apply the corrected helper function here
  const livable_floor_area = livingAreas.length
    ? extractNumberAsString(livingAreas[0]) // Assuming only one total living area is relevant
    : null;
  const total_area = underRoofAreas.length
    ? extractNumberAsString(underRoofAreas[0]) // Assuming only one total under roof is relevant
    : null;


  // Determine unit count from distinct BUILDING headings (deduplicate by number)
  const buildingNumbers = new Set();
  $("h4").each((i, el) => {
    const tx = $(el).text();
    const m = tx.match(/BUILDING\s+(\d+)/i);
    if (m) buildingNumbers.add(m[1]);
  });
  let unitCount = buildingNumbers.size;
  if (!unitCount) {
    // fallback to UNITS rows
    $("table").each((i, tbl) => {
      const trs = $(tbl).find("tr");
      trs.each((j, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const label = tds.eq(0).text().trim().toUpperCase();
          const val = tds.eq(2).text().trim().toUpperCase();
          if (label === "UNITS" && /\b1\s*UNIT\b/.test(val)) {
            unitCount += 1;
          }
        }
      });
    });
  }
  let number_of_units_type = null;
  if (unitCount === 1) number_of_units_type = "One";
  else if (unitCount === 2) number_of_units_type = "Two";
  else if (unitCount === 3) number_of_units_type = "Three";
  else if (unitCount === 4) number_of_units_type = "Four";
  // else if (unitCount > 1 && unitCount <= 4) number_of_units_type = "TwoToFour";

  // Parcel identifier
  const parcel_identifier =
    seed && (seed.parcel_id || seed.request_identifier)
      ? String(seed.parcel_id || seed.request_identifier)
      : null;

  return {
    livable_floor_area,
    number_of_units_type,
    parcel_identifier,
    property_legal_description_text: null,
    property_structure_built_year,
    property_type,
    subdivision: subdivision || "",
    area_under_air: null,
    total_area,
    zoning: "", // Changed from null to empty string
  };
}

function extractAddress($, unaddr) {
  const full = unaddr && unaddr.full_address ? unaddr.full_address : "";

  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    street_post_directional_text = null,
    street_pre_directional_text = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    route_number = null;

  // PRIMARY ATTEMPT: Parse from unnormalized_address.json's full_address string
  // This regex is designed to parse addresses that start with a number,
  // followed by an optional pre-directional, a street name, an optional street suffix,
  // an optional post-directional, then city, state, and zip.
  // The street_name capture group is specifically designed to NOT include directionals.
  const primaryMatch = full.match(
    /^(\d+)\s+(N|S|E|W|NE|NW|SE|SW)?\s*([A-Z\s]+?)(?: (ST|AVE|RD|BLVD|LN|DR|CT|PL|WAY|HWY|TRL|CIR|SQ|TER|PKWY|EXPY|FWY|GRN|HTS|IS|JCT|KY|LK|MDWS|MTN|OVRPS|PRK|PT|RCH|RTE|SHLS|SPG|STA|TPKE|UN|VLG|VLY|XING))?\s*(N|S|E|W|NE|NW|SE|SW)?\s*,\s*([A-Z\s\-']+)\s*,\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/i
  );

  if (primaryMatch) {
    street_number = primaryMatch[1];
    street_pre_directional_text = primaryMatch[2] ? primaryMatch[2].toUpperCase() : null;
    let base_street_name_candidate = primaryMatch[3].trim();
    let suffix_from_primary = primaryMatch[4] ? primaryMatch[4].trim() : null;
    street_post_directional_text = primaryMatch[5] ? primaryMatch[5].toUpperCase() : null;
    city_name = (primaryMatch[6] || "").trim().toUpperCase();
    state_code = (primaryMatch[7] || "").trim().toUpperCase();
    postal_code = (primaryMatch[8] || "").trim();

    // Normalize suffix from primary extraction
    if (suffix_from_primary) {
      street_suffix_type = STREET_SUFFIX_NORMALIZATION[suffix_from_primary.toUpperCase()] || suffix_from_primary;
      // Remove the suffix from the base_street_name_candidate if it was part of it
      const suffixRegex = new RegExp(`\\s+${suffix_from_primary}$`, 'i');
      base_street_name_candidate = base_street_name_candidate.replace(suffixRegex, '').trim();
    }
    street_name = base_street_name_candidate; // Assign the cleaned street name
  }

  // FALLBACK ATTEMPT: Extract from HTML's "Physical Street Address" section
  // This fallback will only run if street_number, street_name, or street_suffix_type
  // were NOT successfully extracted by the primary regex.
  // This also serves as a fallback for addresses that don't start with a number.
  if (!street_number || !street_name || !street_suffix_type) {
    const physicalAddressRow = $("h4:contains('Physical Street Address')")
      .next("table")
      .find("tr.tr1") // Target the specific row with the address line
      .find("td")
      .last()
      .text()
      .trim();

    // Regex for HTML physical address: (Optional Number) (Optional Pre-Directional) (Street Name) (Optional Suffix) (Optional Post-Directional)
    // The street_name capture group is specifically designed to NOT include directionals.
    const htmlMatch = physicalAddressRow.match(
      /^(\d+)?\s*(N|S|E|W|NE|NW|SE|SW)?\s*([A-Z\s]+?)(?: (ST|AVE|RD|BLVD|LN|DR|CT|PL|WAY|HWY|TRL|CIR|SQ|TER|PKWY|EXPY|FWY|GRN|HTS|IS|JCT|KY|LK|MDWS|MTN|OVRPS|PRK|PT|RCH|RTE|SHLS|SPG|STA|TPKE|UN|VLG|VLY|XING))?\s*(N|S|E|W|NE|NW|SE|SW)?$/i
    );

    if (htmlMatch) {
      // Only update if the primary extraction failed for these specific fields
      street_number = street_number || htmlMatch[1];
      street_pre_directional_text = street_pre_directional_text || (htmlMatch[2] ? htmlMatch[2].toUpperCase() : null);
      let base_street_name_candidate_html = htmlMatch[3].trim();
      let suffix_from_html = htmlMatch[4] ? htmlMatch[4].trim() : null;
      let post_directional_html = htmlMatch[5] ? htmlMatch[5].toUpperCase() : null;

      // Normalize suffix from HTML fallback
      if (suffix_from_html) {
        suffix_from_html = STREET_SUFFIX_NORMALIZATION[suffix_from_html.toUpperCase()] || suffix_from_html;
        // Remove the suffix from the base_street_name_candidate_html if it was part of it
        const suffixRegex = new RegExp(`\\s+${suffix_from_html}$`, 'i');
        base_street_name_candidate_html = base_street_name_candidate_html.replace(suffixRegex, '').trim();
      }

      // Only update if the primary extraction failed
      street_suffix_type = street_suffix_type || suffix_from_html;
      street_post_directional_text = street_post_directional_text || post_directional_html;

      // Construct street_name from HTML parts if primary failed
      if (!street_name) {
        street_name = base_street_name_candidate_html;
      }
    }
  }

  // Handle route number if present (original logic, checks full_address string)
  // This remains separate as it's a specific type of street identification.
  if (!route_number) {
    const rn2 = (full || "").match(/HWY\s+(\d{1,5})/i);
    if (rn2 && rn2[1]) route_number = rn2[1];
  }

  // Fallback for city, state, and postal code from HTML (original logic)
  // This part remains the same as it's already a fallback for city/state/zip
  if (!city_name || !state_code || !postal_code) {
    const postalRow = $("h4:contains('Postal City and Zip')")
      .next("table")
      .find("tr")
      .first()
      .find("td")
      .last()
      .text()
      .trim();
    const mx = postalRow.match(/([A-Z\s\-']+)\s+([A-Z]{2})\s+(\d{5})/);
    if (mx) {
      city_name = city_name || mx[1].trim().toUpperCase();
      state_code = state_code || mx[2].trim().toUpperCase();
      postal_code = postal_code || mx[3].trim();
    }
  }

  // County name is hardcoded as per the original script's design for Polk County.
  const county_name = "Polk";

  // Return the structured address object.
  // Fields that are not extracted by the current logic remain null.
  return {
    block: null, // Not extracted by this script
    city_name: city_name || null,
    country_code: null, // Not extracted by this script
    county_name,
    latitude: null, // Not extracted by this script
    longitude: null, // Not extracted by this script
    plus_four_postal_code: null, // Not extracted by this script
    postal_code: postal_code || null,
    range: null, // Not extracted by this script
    route_number: route_number || null,
    section: null, // Not extracted by this script
    state_code: state_code || null,
    street_name: street_name || null,
    street_number: street_number || null,
    street_post_directional_text: street_post_directional_text || null,
    street_pre_directional_text: street_pre_directional_text || null, // Ensure this is set
    street_suffix_type: street_suffix_type || null,
    unit_identifier: null, // Not extracted by this script
    township: null, // Not extracted by this script
  };
}
function extractTaxCurrent($) {
  // Current year from Value Summary header
  const yearMatch = $("#valueSummary h3")
    .text()
    .match(/\((\d{4})\)/);
  const tax_year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let property_market_value_amount = 0; // Initialize to 0
  let property_assessed_value_amount = 0; // Initialize to 0
  let property_taxable_value_amount = 0; // Initialize to 0
  let property_building_amount = 0; // Initialize to 0
  let property_land_amount = 0; // Initialize to 0

  $("#valueSummary table tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = tds.eq(0).text().trim().toUpperCase();
      const valueText = tds.eq(1).text().trim();
      if (label === "JUST MARKET VALUE")
        property_market_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "ASSESSED VALUE")
        property_assessed_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label.includes("TAXABLE VALUE") && label.includes("(COUNTY)"))
        property_taxable_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "BUILDING VALUE")
        property_building_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "LAND VALUE")
        property_land_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
    }
  });

  return {
    tax_year,
    property_assessed_value_amount,
    property_market_value_amount,
    property_building_amount,
    property_land_amount,
    property_taxable_value_amount,
    monthly_tax_amount: null, // Default to null as not extracted
    period_end_date: null, // Default to null as not extracted
    period_start_date: null, // Default to null as not extracted
  };
}

function extractTaxPriorYears($) {
  const results = [];
  const table = $("#priorValues table.left");
  if (table.length === 0) return results;

  // header row contains DESCRIPTION | 2024 | 2023 | 2022 | 2021
  const headerTds = table.find("tr").first().find("td");
  const yearCols = [];
  headerTds.each((i, td) => {
    const txt = $(td).text().trim();
    if (/^\d{4}$/.test(txt)) {
      yearCols.push({ year: parseInt(txt, 10), index: i });
    }
  });

  if (yearCols.length === 0) return results;

  // Build maps per year
  const dataByYear = new Map();
  yearCols.forEach((yc) =>
    dataByYear.set(yc.year, {
      tax_year: yc.year,
      property_assessed_value_amount: 0, // Initialize to 0
      property_market_value_amount: 0, // Initialize to 0
      property_building_amount: 0, // Initialize to 0
      property_land_amount: 0, // Initialize to 0
      property_taxable_value_amount: 0, // Initialize to 0
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    }),
  );

  // iterate rows
  table
    .find("tr")
    .slice(1)
    .each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;
      const desc = tds.eq(0).text().trim().toUpperCase();
      yearCols.forEach((yc) => {
        const valText = tds.eq(yc.index).text().trim();
        const num = parseCurrencyToNumber(valText);
        // Ensure num is a number, not null, to satisfy schema
        // If parsing fails, default to 0 for schema compliance
        const value = num ?? 0;

        const obj = dataByYear.get(yc.year);
        switch (desc) {
          case "JUST MARKET VALUE":
            obj.property_market_value_amount = value;
            break;
          case "ASSESSED VALUE":
            obj.property_assessed_value_amount = value;
            break;
          case "LAND VALUE":
            obj.property_land_amount = value;
            break;
          case "BUILDING VALUE":
            obj.property_building_amount = value;
            break;
          case "TAXABLE VALUE (COUNTY)":
            obj.property_taxable_value_amount = value;
            break;
          default:
            break;
        }
      });
    });

  dataByYear.forEach((v) => results.push(v));
  return results;
}

function extractSales($) {
  const sales = [];
  const rows = $("#saleHist table.center tr");
  rows.each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const dateText = tds.eq(1).text().trim(); // e.g., 11/2021
      const grantee = tds.eq(4).text().trim();
      const priceText = tds.eq(5).text().trim();
      const price = parseCurrencyToNumber(priceText);
      let isoDate = null;
      const dm = dateText.match(/^(\d{1,2})\/(\d{4})$/);
      if (dm) {
        const mm = dm[1].padStart(2, "0");
        const yyyy = dm[2];
        isoDate = `${yyyy}-${mm}-01`;
      }
      if (price !== null || grantee || dateText) {
        sales.push({
          grantee,
          dateText,
          ownership_transfer_date: isoDate,
          purchase_price_amount: price,
        });
      }
    }
  });
  return sales;
}

function buildPersonsAndCompanies(ownerJSON, parcelId) {
  const res = {
    persons: [],
    companies: [],
    personIndexByKey: new Map(),
    companyIndexByName: new Map(),
  };
  if (!ownerJSON) return res;
  const key = `property_${parcelId}`;
  const obj = ownerJSON[key];
  if (!obj || !obj.owners_by_date) return res;

  // Current owners first
  const current = obj.owners_by_date["current"] || [];
  current.forEach((o) => {
    if (o.type === "person") {
      const firstName = toTitleCase(o.first_name); // Apply title case
      const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
      const lastName = toTitleCase(o.last_name); // Apply title case
      const personKey = `${firstName}|${middleName || ""}|${lastName}`;
      if (!res.personIndexByKey.has(personKey)) {
        res.persons.push({
          birth_date: null,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        });
        res.personIndexByKey.set(personKey, res.persons.length); // 1-based
      }
    }
  });

  // Historical owners
  Object.entries(obj.owners_by_date).forEach(([dt, owners]) => {
    if (dt === "current") return;
    (owners || []).forEach((o) => {
      if (o.type === "person") {
        const firstName = toTitleCase(o.first_name); // Apply title case
        const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
        const lastName = toTitleCase(o.last_name); // Apply title case
        const personKey = `${firstName}|${middleName || ""}|${lastName}`;
        if (!res.personIndexByKey.has(personKey)) {
          res.persons.push({
            birth_date: null,
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
          res.personIndexByKey.set(personKey, res.persons.length);
        }
      } else if (o.type === "company") {
        const name = (o.name || "").trim();
        if (name && !res.companyIndexByName.has(name)) {
          res.companies.push({ name });
          res.companyIndexByName.set(name, res.companies.length);
        }
      }
    });
  });

  return res;
}

function normalizeNameForMatch(str) {
  return (str || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function extractStructure($) {
  // Prefer values from Building 2 subareas when present
  let finished_base_area = null;
  let finished_upper_story_area = null;

  $('h4:contains("BUILDING 2")').each((i, h) => {
    const container = $(h).closest("table").parent();
    $(container)
      .find("table.center tr")
      .each((j, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const label = tds.eq(0).text().trim().toUpperCase();
          const valText = tds.eq(2).text().trim().replace(/,/g, "");
          if (label.startsWith("BASE AREA")) {
            const n = parseInt(valText, 10);
            if (Number.isFinite(n)) finished_base_area = n;
          }
          if (label.startsWith("TWO") || label.includes("TWO STORY")) {
            const n2 = parseInt(valText, 10);
            if (Number.isFinite(n2)) finished_upper_story_area = n2;
          }
        }
      });
  });

  // Detect categorical fields from text
  let roof_design_type = null;
  let roof_material_type = null;
  let foundation_type = null;
  let primary_framing_material = null;

  const allText = $.text().toUpperCase();
  if (allText.includes("ROOF STRUCTURE") && allText.includes("GABLE"))
    roof_design_type = "Gable";
  if (allText.includes("ROOF STRUCTURE") && allText.includes("METAL"))
    roof_material_type = "Metal";
  if (allText.includes("SUBSTRUCT") && allText.includes("CONTINUOUS WALL"))
    foundation_type = "Stem Wall";
  if (
    allText.includes("FRAME / CONST TYPE") &&
    allText.includes("MASONRY/BLOCK")
  )
    primary_framing_material = "Concrete Block";

  return {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: finished_base_area ?? null,
    finished_basement_area: null,
    finished_upper_story_area: finished_upper_story_area ?? null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: foundation_type ?? null,
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
    primary_framing_material: primary_framing_material ?? null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_design_type: roof_design_type ?? null,
    roof_material_type: roof_material_type ?? null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };
}

function extractLot($) {
  let acreage = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      const key = tds.eq(0).text().trim().toUpperCase();
      if (key === "ACREAGE") {
        const val = tds.eq(1).text().trim();
        const n = Number(val.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n)) acreage = n;
      }
    });
  let lot_type = null;
  if (acreage != null && acreage > 0.25) lot_type = "GreaterThanOneQuarterAcre";

  return {
    lot_type: lot_type ?? null,
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
  };
}

function main() {
  const inputHtmlPath = path.join("input.html");
  const unaddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unaddr = readJSON(unaddrPath) || {};
  const seed = readJSON(seedPath) || {};
  const ownerJSON = readJSON(ownerPath) || {};
  const utilitiesJSON = readJSON(utilitiesPath) || {};
  const layoutJSON = readJSON(layoutPath) || {};

  const parcelId =
    seed.request_identifier ||
    seed.parcel_id ||
    unaddr.request_identifier ||
    "";

  ensureDir("data");

  // Property
  const property = extractProperty($, seed);
  writeJSON(path.join("data", "property.json"), property);

  // Address
  const address = extractAddress($, unaddr);
  // Add source_http_request and request_identifier to address object
  address.source_http_request = {
    method: "GET",
    url: `http://www.polkpa.org/CamaDisplay.aspx?OutputMode=Display&SearchType=RealEstate&ParcelID=${parcelId}`
  };
  address.request_identifier = parcelId;
  writeJSON(path.join("data", "address.json"), address);

  // Lot
  const lot = extractLot($);
  writeJSON(path.join("data", "lot.json"), lot);

  // Tax current year (from Value Summary)
  const taxCurrent = extractTaxCurrent($);
  if (taxCurrent.tax_year) {
    // Add required fields for tax schema
    taxCurrent.source_http_request = {
      method: "GET",
      url: `http://www.polkpa.org/CamaDisplay.aspx?OutputMode=Display&SearchType=RealEstate&ParcelID=${parcelId}`
    };
    taxCurrent.request_identifier = parcelId;
    // monthly_tax_amount, period_end_date, period_start_date are already defaulted to null in extractTaxCurrent
    // property_assessed_value_amount, property_market_value_amount, property_building_amount, property_land_amount, property_taxable_value_amount are already defaulted to 0 in extractTaxCurrent

    writeJSON(path.join("data", `tax_${taxCurrent.tax_year}.json`), taxCurrent);
  }

  // Tax prior years (from Prior Year Final Values)
  const taxPrior = extractTaxPriorYears($);
  taxPrior.forEach((t) => {
    if (t.tax_year) {
      // Add required fields for tax schema
      t.source_http_request = {
        method: "GET",
        url: `http://www.polkpa.org/CamaDisplay.aspx?OutputMode=Display&SearchType=RealEstate&ParcelID=${parcelId}`
      };
      t.request_identifier = parcelId;
      // monthly_tax_amount, period_end_date, period_start_date are already defaulted to null in extractTaxPriorYears
      // property_assessed_value_amount, property_market_value_amount, property_building_amount, property_land_amount, property_taxable_value_amount are already defaulted to 0 in extractTaxPriorYears

      writeJSON(path.join("data", `tax_${t.tax_year}.json`), t);
    }
  });

  // Sales
  const sales = extractSales($);
  sales.forEach((s, idx) => {
    const saleOut = {
      ownership_transfer_date: s.ownership_transfer_date || null,
      purchase_price_amount: s.purchase_price_amount ?? null,
    };
    writeJSON(path.join("data", `sales_${idx + 1}.json`), saleOut);
  });

  // Owners (persons/companies)
  const pc = buildPersonsAndCompanies(ownerJSON, parcelId);
  pc.persons.forEach((p, i) =>
    writeJSON(path.join("data", `person_${i + 1}.json`), p),
  );
  pc.companies.forEach((c, i) =>
    writeJSON(path.join("data", `company_${i + 1}.json`), c),
  );

  // Utilities
  const utilsKey = `property_${parcelId}`;
  let util =
    utilitiesJSON && utilitiesJSON[utilsKey] ? utilitiesJSON[utilsKey] : null;
  if (util) {
    const requiredKeys = [
      "cooling_system_type",
      "heating_system_type",
      "public_utility_type",
      "sewer_type",
      "water_source_type",
      "plumbing_system_type",
      "plumbing_system_type_other_description",
      "electrical_panel_capacity",
      "electrical_wiring_type",
      "hvac_condensing_unit_present",
      "electrical_wiring_type_other_description",
      "solar_panel_present",
      "solar_panel_type",
      "solar_panel_type_other_description",
      "smart_home_features",
      "smart_home_features_other_description",
      "hvac_unit_condition",
      "solar_inverter_visible",
      "hvac_unit_issues",
    ];
    const out = {};
    requiredKeys.forEach((k) => {
      out[k] = Object.prototype.hasOwnProperty.call(util, k) ? util[k] : null;
    });
    writeJSON(path.join("data", "utility.json"), out);
  }

  // Layouts
  const layoutsBlock =
    layoutJSON && layoutJSON[utilsKey] && layoutJSON[utilsKey].layouts
      ? layoutJSON[utilsKey].layouts
      : [];
  layoutsBlock.forEach((lay, i) => {
    const requiredKeys = [
      "space_type",
      "space_index",
      "flooring_material_type",
      "size_square_feet",
      "floor_level",
      "has_windows",
      "window_design_type",
      "window_material_type",
      "window_treatment_type",
      "is_finished",
      "furnished",
      "paint_condition",
      "flooring_wear",
      "clutter_level",
      "visible_damage",
      "countertop_material",
      "cabinet_style",
      "fixture_finish_quality",
      "design_style",
      "natural_light_quality",
      "decor_elements",
      "pool_type",
      "pool_equipment",
      "spa_type",
      "safety_features",
      "view_type",
      "lighting_features",
      "condition_issues",
      "is_exterior",
      "pool_condition",
      "pool_surface_type",
      "pool_water_quality",
    ];
    const out = {};
    requiredKeys.forEach((k) => {
      out[k] = Object.prototype.hasOwnProperty.call(lay, k) ? lay[k] : null;
    });
    writeJSON(path.join("data", `layout_${i + 1}.json`), out);
  });

  // Structure
  const structure = extractStructure($);
  writeJSON(path.join("data", "structure.json"), structure);

  // Relationships person/company -> sales
  const personNameToPath = new Map();
  pc.persons.forEach((p, i) => {
    const nameVariants = [];
    const f = (p.first_name || "").trim();
    const m = (p.middle_name || "").trim();
    const l = (p.last_name || "").trim();
    if (f && l) {
      // Use the capitalized names for matching
      nameVariants.push(`${l} ${f}${m ? " " + m : ""}`.toUpperCase());
      nameVariants.push(`${f} ${m ? m + " " : ""}${l}`.toUpperCase());
      nameVariants.push(`${l} ${f}`.toUpperCase());
    }
    const pth = `./person_${i + 1}.json`;
    nameVariants.forEach((v) => personNameToPath.set(v, pth));
  });
  const companyNameToPath = new Map();
  pc.companies.forEach((c, i) => {
    const nm = (c.name || "").trim().toUpperCase();
    if (nm) companyNameToPath.set(nm, `./company_${i + 1}.json`);
  });

  sales.forEach((s, idx) => {
    const g = normalizeNameForMatch(s.grantee);
    if (!g) return;
    if (companyNameToPath.has(g)) {
      const rel = {
        to: { "/": companyNameToPath.get(g) },
        from: { "/": `./sales_${idx + 1}.json` },
      };
      writeJSON(
        path.join("data", `relationship_sales_company_${idx + 1}.json`),
        rel,
      );
    } else {
      // try direct or swapped person match
      let toPath = null;
      if (personNameToPath.has(g)) {
        toPath = personNameToPath.get(g);
      } else {
        const parts = g.split(/\s+/);
        if (parts.length >= 2) {
          const swapped = `${parts.slice(1).join(" ")} ${parts[0]}`
            .toUpperCase()
            .trim();
          if (personNameToPath.has(swapped))
            toPath = personNameToPath.get(swapped);
        }
      }
      if (toPath) {
        const rel = {
          to: { "/": toPath },
          from: { "/": `./sales_${idx + 1}.json` },
        };
        writeJSON(
          path.join("data", `relationship_sales_person_${idx + 1}.json`),
          rel,
        );
      }
    }
  });

  // Relationship: property_has_address
  // Added 'type' field as a common fix for 'anyOf' schema validation issues in relationships
  const propertyHasAddressRel = {
    type: "PropertyHasAddress", // Assuming this type name, adjust if schema specifies otherwise
    to: { "/": "./address.json" },
    from: { "/": "./property.json" },
  };
  writeJSON(path.join("data", "relationship_property_has_address.json"), propertyHasAddressRel);

  // Relationship: address_has_fact_sheet
  // Added 'type' field as a common fix for 'anyOf' schema validation issues in relationships
  const addressHasFactSheetRel = {
    type: "AddressHasFactSheet", // Assuming this type name, adjust if schema specifies otherwise
    to: { "/": "./address.json" },
    from: { "/": "./property.json" }, // Assuming property.json is the fact sheet source
  };
  writeJSON(path.join("data", "relationship_address_has_fact_sheet.json"), addressHasFactSheetRel);

  // Relationship: property_has_tax
  taxPrior.forEach((t, idx) => {
    const propertyHasTaxRel = {
      type: "PropertyHasTax", // Assuming this type name, adjust if schema specifies otherwise
      to: { "/": `./tax_${t.tax_year}.json` },
      from: { "/": "./property.json" },
    };
    writeJSON(path.join("data", `relationship_property_has_tax_${idx + 1}.json`), propertyHasTaxRel);
  });
  if (taxCurrent.tax_year) {
    const propertyHasTaxRel = {
      type: "PropertyHasTax", // Assuming this type name, adjust if schema specifies otherwise
      to: { "/": `./tax_${taxCurrent.tax_year}.json` },
      from: { "/": "./property.json" },
    };
    writeJSON(path.join("data", `relationship_property_has_tax_current.json`), propertyHasTaxRel);
  }
}

if (require.main === module) {
  main();
}