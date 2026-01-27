const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input
const input = JSON.parse(fs.readFileSync("input.json", "utf8"));

// Helpers
const toISODate = (s) => {
  if (!s) return null;
  const m = s.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const y = parseInt(yyyy, 10);
  const month = String(parseInt(mm, 10)).padStart(2, "0");
  const day = String(parseInt(dd, 10)).padStart(2, "0");
  if (y < 1901) return null; // treat placeholder 1900 dates as unknown
  return `${yyyy}-${month}-${day}`;
};

const normalize = (s) => (s || "").replace(/\s+/g, " ").trim();

const normalizeOwnerNameLine = (line) => {
  if (!line) return "";
  let normalized = line.replace(/\u00a0/g, " ");
  normalized = normalized.replace(/[﹠＆]/g, "&");
  normalized = normalized.replace(/[''‛`]/g, "'");
  normalized = normalized.replace(/\bAND\/OR\b/gi, " & ");
  normalized = normalized.replace(/\bAND\b/gi, " & ");
  normalized = normalized.replace(/\bY\b/gi, " & ");
  normalized = normalized.replace(/\bET\b/gi, " & ");
  normalized = normalized.replace(/\s[-–—]{1,2}\s/g, " & ");
  normalized = normalized.replace(
    /([A-Za-z0-9])([+＋/\\|•·∙‧*])([A-Za-z0-9])/g,
    "$1 & $3",
  );
  normalized = normalized.replace(/[+＋/\\|•·∙‧*]/g, " & ");
  normalized = normalized.replace(/[,;:(){}\[\]<>]/g, " ");
  normalized = normalized.replace(/\s*&\s*/g, " & ");
  normalized = normalized.replace(/\s+/g, " ");
  return normalize(normalized);
};

const cleanPersonToken = (token) => {
  if (!token) return "";
  return token
    .replace(/[''‛`]/g, "'")
    .replace(/^[^0-9A-Za-z'\\-]+/, "")
    .replace(/[^0-9A-Za-z'\\-]+$/, "");
};

const sanitizeOutputName = (value) => {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9A-Za-z]+/g, " ");
  return normalize(cleaned);
};

// ============================================================================
// COMPREHENSIVE ADDRESS LINE DETECTION
// ============================================================================

// Unit/suite designators that appear BEFORE a number (e.g., "STE 400", "APT 5B")
const unitPrefixes = [
  "STE", "SUITE", "SUITES",
  "APT", "APARTMENT", "APARTMENTS",
  "UNIT", "UNITS",
  "NO", "NUMBER", "#",
  "BLDG", "BUILDING", "BLD",
  "FL", "FLR", "FLOOR",
  "RM", "ROOM",
  "SP", "SPACE", "SPC",
  "LOT", "LOTS",
  "TRLR", "TRAILER",
  "SLIP", "PIER", "DOCK", "BERTH",
  "HNGR", "HANGAR",
  "LBBY", "LOBBY",
  "LOWR", "LOWER",
  "UPPR", "UPPER",
  "REAR", "FRONT", "SIDE",
  "BSMT", "BASEMENT",
  "DEPT", "DEPARTMENT",
  "OFC", "OFFICE",
  "PH", "PENTHOUSE",
  "STOP",
];

// Street type suffixes (abbreviated and full)
const streetSuffixes = [
  "ST", "STREET", "STR",
  "AVE", "AVENUE", "AV",
  "BLVD", "BOULEVARD",
  "RD", "ROAD",
  "DR", "DRIVE", "DRV",
  "LN", "LANE",
  "CT", "COURT", "CRT",
  "CIR", "CIRCLE",
  "WAY",
  "PL", "PLACE",
  "TRL", "TRAIL",
  "PKWY", "PARKWAY", "PKY",
  "HWY", "HIGHWAY", "HIWAY",
  "FWY", "FREEWAY", "FRWY",
  "EXPY", "EXPRESSWAY", "EXPWY",
  "TER", "TERRACE", "TERR",
  "LOOP",
  "PATH",
  "PASS",
  "ALY", "ALLEY",
  "WALK", "WK",
  "SQ", "SQUARE",
  "PLZ", "PLAZA",
  "RUN",
  "CV", "COVE",
  "PT", "POINT", "PNT",
  "XING", "CROSSING",
  "VW", "VIEW",
  "CRST", "CREST",
  "HL", "HILL",
  "HLS", "HILLS",
  "VLY", "VALLEY",
  "GLN", "GLEN",
  "GRV", "GROVE",
  "MDW", "MEADOW", "MDWS", "MEADOWS",
  "PARK", "PRK",
  "RIDGE", "RDG",
  "SPRING", "SPG", "SPGS", "SPRINGS",
  "CREEK", "CRK",
  "LAKE", "LK",
  "RIVER", "RVR",
  "BEND", "BND",
  "ISLE", "IS",
  "KNOLL", "KNL",
  "LANDING", "LNDG",
  "MOUNT", "MT",
  "RANCH", "RNCH",
  "TRACE", "TRCE",
  "COMMONS", "CMN",
  "ESTATE", "EST", "ESTS", "ESTATES",
  "GARDEN", "GDN", "GARDENS", "GDNS",
  "GATEWAY", "GTWY",
  "GREEN", "GRN",
  "HARBOR", "HBR",
  "HEIGHTS", "HTS",
  "HOLLOW", "HOLW",
  "ISLAND", "ISLND",
  "JUNCTION", "JCT",
  "LAKE", "LK",
  "MANOR", "MNR",
  "MILL", "ML", "MILLS", "MLS",
  "MISSION", "MSN",
  "ORCHARD", "ORCH",
  "OVAL", "OVL",
  "PIKE", "PK",
  "PINE", "PINES", "PNES",
  "PORT", "PRT",
  "PRAIRIE", "PR",
  "RADIAL", "RADL",
  "RAMP",
  "REST", "RST",
  "ROW",
  "SHORE", "SHR", "SHORES", "SHRS",
  "SKYWAY", "SKWY",
  "SPUR",
  "STATION", "STA",
  "STRAVENUE", "STRA",
  "STREAM", "STRM",
  "SUMMIT", "SMT",
  "TURNPIKE", "TPKE",
  "UNDERPASS", "UPAS",
  "UNION", "UN",
  "VIADUCT", "VIA",
  "VILLAGE", "VLG",
  "VILLE", "VL",
  "VISTA", "VIS",
  "WAYS",
  "WELL", "WL", "WELLS", "WLS",
];

// Directional prefixes/suffixes
const directionals = [
  "N", "NORTH",
  "S", "SOUTH",
  "E", "EAST",
  "W", "WEST",
  "NE", "NORTHEAST",
  "NW", "NORTHWEST",
  "SE", "SOUTHEAST",
  "SW", "SOUTHWEST",
];

// US State abbreviations and names
const usStates = [
  "AL", "ALABAMA", "AK", "ALASKA", "AZ", "ARIZONA", "AR", "ARKANSAS",
  "CA", "CALIFORNIA", "CO", "COLORADO", "CT", "CONNECTICUT",
  "DE", "DELAWARE", "FL", "FLORIDA", "GA", "GEORGIA",
  "HI", "HAWAII", "ID", "IDAHO", "IL", "ILLINOIS", "IN", "INDIANA",
  "IA", "IOWA", "KS", "KANSAS", "KY", "KENTUCKY",
  "LA", "LOUISIANA", "ME", "MAINE", "MD", "MARYLAND",
  "MA", "MASSACHUSETTS", "MI", "MICHIGAN", "MN", "MINNESOTA",
  "MS", "MISSISSIPPI", "MO", "MISSOURI", "MT", "MONTANA",
  "NE", "NEBRASKA", "NV", "NEVADA", "NH", "NEW HAMPSHIRE",
  "NJ", "NEW JERSEY", "NM", "NEW MEXICO", "NY", "NEW YORK",
  "NC", "NORTH CAROLINA", "ND", "NORTH DAKOTA",
  "OH", "OHIO", "OK", "OKLAHOMA", "OR", "OREGON",
  "PA", "PENNSYLVANIA", "RI", "RHODE ISLAND",
  "SC", "SOUTH CAROLINA", "SD", "SOUTH DAKOTA",
  "TN", "TENNESSEE", "TX", "TEXAS", "UT", "UTAH",
  "VT", "VERMONT", "VA", "VIRGINIA", "WA", "WASHINGTON",
  "WV", "WEST VIRGINIA", "WI", "WISCONSIN", "WY", "WYOMING",
  "DC", "DISTRICT OF COLUMBIA", "PR", "PUERTO RICO",
  "VI", "VIRGIN ISLANDS", "GU", "GUAM", "AS", "AMERICAN SAMOA",
  "MP", "NORTHERN MARIANA ISLANDS",
];

// Care-of and attention indicators
const careOfIndicators = [
  "C/O", "CO", "CARE OF",
  "ATTN", "ATTENTION",
  "FAO", "FOR ATTENTION OF",
  "IN CARE OF", "ICO",
];

// Rural and special delivery patterns
const ruralPatterns = [
  "RR", "RURAL ROUTE", "RURAL RTE",
  "HC", "HIGHWAY CONTRACT",
  "RFD", "RURAL FREE DELIVERY",
  "STAR ROUTE", "STAR RTE",
  "GEN DEL", "GENERAL DELIVERY",
  "PSC", // Military postal service center
  "CMR", // Community mail room (military)
  "UNIT", // Military unit address
];

const isLikelyAddressLine = (line) => {
  if (!line) return false;
  const s = line.toUpperCase().trim();

  // Empty or very short lines
  if (s.length < 2) return false;

  // Check for company indicators first - if it's a company name, it's not an address
  if (companyIndicators.some((ind) => {
    const pattern = new RegExp(`(^|[^A-Z])${ind}([^A-Z]|$)`);
    return pattern.test(s);
  })) {
    return false;
  }

  // ========== UNIT/SUITE DESIGNATORS ==========
  // Match patterns like "STE 400", "APT 5B", "UNIT 100", "# 205", "FLOOR 3"
  const unitPrefixPattern = unitPrefixes.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const unitRegex = new RegExp(`^(${unitPrefixPattern})[\\s.-]*[A-Z0-9]+`, 'i');
  if (unitRegex.test(s)) return true;

  // Match patterns with # symbol: "#100", "# 100"
  if (/^#\s*[A-Z0-9]+$/i.test(s)) return true;

  // ========== STREET ADDRESS PATTERNS ==========
  // Standard: number followed by street name (e.g., "123 MAIN ST", "5930 LYNDON B JOHNSON FWY")
  if (/^\d+[A-Z]?\s+[A-Z]/.test(s)) return true;

  // With directional prefix: "N 123 MAIN ST"
  const dirPattern = directionals.join('|');
  const streetDirRegex = new RegExp(`^(${dirPattern})\\.?\\s+\\d+\\s+[A-Z]`, 'i');
  if (streetDirRegex.test(s)) return true;

  // Ends with street suffix (e.g., "MAIN STREET", "OAK LANE")
  const suffixPattern = streetSuffixes.map(sf => `\\b${sf}\\.?$`).join('|');
  const streetSuffixRegex = new RegExp(`(${suffixPattern})`, 'i');
  if (streetSuffixRegex.test(s) && /\d/.test(s)) return true;

  // ========== PO BOX AND SPECIAL ==========
  // PO Box variations
  if (/P\.?\s*O\.?\s*BOX\s*\d*/i.test(s)) return true;
  if (/POST\s*OFFICE\s*BOX/i.test(s)) return true;
  if (/^BOX\s+\d+/i.test(s)) return true;

  // Private mailbox (PMB)
  if (/PMB\s*\d+/i.test(s)) return true;

  // ========== RURAL AND MILITARY ==========
  // Rural routes, highway contracts
  for (const rp of ruralPatterns) {
    const rpRegex = new RegExp(`^${rp.replace(/\s+/g, '\\s*')}[\\s#]*\\d*`, 'i');
    if (rpRegex.test(s)) return true;
  }

  // ========== CARE-OF / ATTENTION ==========
  for (const co of careOfIndicators) {
    if (s.startsWith(co.toUpperCase()) || s.startsWith(co.toUpperCase() + " ")) {
      return true;
    }
  }
  if (/^C\s*\/\s*O\b/i.test(s)) return true;

  // ========== CITY, STATE, ZIP PATTERNS ==========
  // Standard US format: "CITY, STATE ZIP" or "CITY, STATE"
  const statePattern = usStates.filter(st => st.length <= 2).join('|');
  const cityStateZipRegex = new RegExp(`[A-Z]+[,\\s]+(${statePattern})\\s*\\d{5}`, 'i');
  if (cityStateZipRegex.test(s)) return true;

  // State name with ZIP
  if (/,\s*(TEXAS|CALIFORNIA|FLORIDA|NEW YORK|ILLINOIS|OHIO|GEORGIA|PENNSYLVANIA|NORTH CAROLINA|MICHIGAN|ARIZONA|COLORADO|WASHINGTON|VIRGINIA|MASSACHUSETTS|INDIANA|TENNESSEE|MISSOURI|MARYLAND|WISCONSIN|MINNESOTA|ALABAMA|LOUISIANA|KENTUCKY|OREGON|OKLAHOMA|CONNECTICUT|IOWA|UTAH|NEVADA|ARKANSAS|MISSISSIPPI|KANSAS|NEW MEXICO|NEBRASKA|WEST VIRGINIA|IDAHO|HAWAII|NEW HAMPSHIRE|MAINE|MONTANA|RHODE ISLAND|DELAWARE|SOUTH DAKOTA|NORTH DAKOTA|ALASKA|VERMONT|WYOMING)\s*\d{5}/i.test(s)) return true;

  // Just state and ZIP or state name
  if (s.includes(",") && new RegExp(`\\b(${statePattern})\\b`, 'i').test(s)) return true;

  // ========== ZIP CODE ONLY ==========
  // Just a ZIP code (5 or 9 digit)
  if (/^\d{5}(-\d{4})?$/.test(s.trim())) return true;

  // ========== PURELY NUMERIC (likely a unit/floor number) ==========
  // Single numbers often are floor/suite numbers: "400", "100"
  if (/^\d+[A-Z]?$/.test(s) && s.length <= 5) return true;

  // ========== COMMON ADDRESS-ONLY WORDS ==========
  // Lines that are just directionals or floor indicators
  if (/^(FLOOR|FLR|FL)\s*\d+$/i.test(s)) return true;
  if (/^(LEVEL|LVL)\s*\d+$/i.test(s)) return true;
  if (/^\d+(ST|ND|RD|TH)\s*(FLOOR|FLR|FL)$/i.test(s)) return true;

  return false;
};

// ============================================================================
// PERSON NAME VALIDATION
// ============================================================================

// Common name prefixes (titles)
const namePrefixes = [
  "MR", "MRS", "MS", "MISS", "DR", "PROF", "REV", "FR", "SR", "JR",
  "HON", "JUDGE", "JUSTICE", "SIR", "DAME", "LORD", "LADY",
  "CAPT", "CPT", "COL", "GEN", "MAJ", "LT", "SGT", "ADM",
];

// Common name suffixes
const nameSuffixes = [
  "JR", "SR", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "ESQ", "ESQUIRE", "PHD", "MD", "DDS", "DVM", "DO", "JD", "MBA", "CPA",
  "RN", "LPN", "PA", "NP",
];

// Validate that a string looks like a valid person name token
const isValidNameToken = (token) => {
  if (!token) return false;
  const t = token.toUpperCase().trim();

  // Must have at least one letter
  if (!/[A-Z]/.test(t)) return false;

  // Cannot be purely numeric
  if (/^\d+$/.test(t)) return false;

  // Cannot start with a number (unless it's a suffix like "2ND")
  if (/^\d/.test(t) && !/^\d+(ST|ND|RD|TH)$/i.test(t)) return false;

  // Cannot be an address component
  if (unitPrefixes.includes(t)) return false;
  if (streetSuffixes.includes(t)) return false;
  if (directionals.includes(t) && t.length <= 2) return false; // Allow "North" as name but not "N"

  // Cannot be a state abbreviation on its own (2 letters)
  if (t.length === 2 && usStates.includes(t)) return false;

  return true;
};

// Validate a complete parsed person name
const isValidPersonName = (first, last, middle) => {
  // First and last names are required
  if (!first || !last) return false;

  const firstName = first.toUpperCase().trim();
  const lastName = last.toUpperCase().trim();

  // Both must be valid name tokens
  if (!isValidNameToken(firstName)) return false;
  if (!isValidNameToken(lastName)) return false;

  // First name specific checks
  // Cannot be purely numeric
  if (/^\d+$/.test(firstName)) return false;

  // Cannot be a unit prefix (STE, APT, etc.)
  if (unitPrefixes.includes(firstName)) return false;

  // Last name specific checks
  if (/^\d+$/.test(lastName)) return false;
  if (unitPrefixes.includes(lastName)) return false;

  // Check if the combination looks like an address fragment
  // e.g., "400 STE" parsed as first="400", last="STE"
  const combined = `${firstName} ${lastName}`;
  if (isLikelyAddressLine(combined)) return false;

  // Middle name validation (if present)
  if (middle) {
    const middleName = middle.toUpperCase().trim();
    // Middle can be an initial (single letter) or a full name
    if (middleName.length > 1 && !isValidNameToken(middleName)) return false;
  }

  return true;
};

// ============================================================================
// COMPANY INDICATORS
// ============================================================================

const companyIndicators = [
  "INC",
  "LLC",
  "L.L.C",
  "LTD",
  "LIMITED",
  "FOUNDATION",
  "ALLIANCE",
  "SOLUTIONS",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "SERVICES",
  "SERVICE",
  "TRUST",
  "TTEE",
  "TR",
  "ASSN",
  "ASSOCIATION",
  "PARTNERS",
  "PARTNERSHIP",
  "LP",
  "LLP",
  "PLLC",
  "PC",
  "P.C.",
  "HOLDINGS",
  "HOLDING",
  "GROUP",
  "ENTERPRISES",
  "ENTERPRISE",
  "INVESTMENTS",
  "INVESTMENT",
  "PROPERTIES",
  "PROPERTY",
  "REALTY",
  "REAL ESTATE",
  "DEVELOPMENT",
  "DEVELOPERS",
  "MANAGEMENT",
  "MGMT",
  "CONSULTING",
  "CONSULTANTS",
  "ADVISORS",
  "ADVISORY",
  // Organizations and institutions
  "UNIVERSITY",
  "COLLEGE",
  "SCHOOL",
  "DISTRICT",
  "BOARD",
  "CHURCH",
  "HOSPITAL",
  "COUNTY",
  "CITY OF",
  "STATE OF",
  "TOWN OF",
  "VILLAGE OF",
  "TOWNSHIP",
  "MUNICIPALITY",
  "BANK",
  "CREDIT UNION",
  "SAVINGS",
  "FINANCIAL",
  "INSURANCE",
  "GOVERNMENT",
  "AUTHORITY",
  "COMMISSION",
  "DEPARTMENT",
  "MINISTRY",
  "INSTITUTE",
  "INSTITUTION",
  "COUNCIL",
  "COMMITTEE",
  "AGENCY",
  "BUREAU",
  "ADMINISTRATION",
  "FUND",
  "ESTATE OF",
  "ESTATES OF",
  "TRUSTEES",
  "TRUSTEE",
  "EXECUTOR",
  "EXECUTRIX",
  "GUARDIAN",
  "CONSERVATOR",
  "RECEIVER",
  "LIQUIDATOR",
  // Non-profit
  "NONPROFIT",
  "NON-PROFIT",
  "CHARITY",
  "CHARITABLE",
  "MINISTRY",
  "MINISTRIES",
  "FELLOWSHIP",
  "CONGREGATION",
  "DIOCESE",
  "PARISH",
  "TEMPLE",
  "MOSQUE",
  "SYNAGOGUE",
  // Housing
  "HOA",
  "HOMEOWNERS",
  "CONDOMINIUM",
  "CONDO",
  "COOPERATIVE",
  "CO-OP",
];

const isCompany = (raw) => {
  const s = (raw || "").toUpperCase();
  return companyIndicators.some((ind) => {
    const pattern = new RegExp(`(^|[^A-Z])${ind}([^A-Z]|$)`);
    return pattern.test(s);
  });
};

// ============================================================================
// PERSON PARSING
// ============================================================================

const buildPerson = (last, first, middle) => {
  const obj = {
    type: "person",
    first_name: sanitizeOutputName(first),
    last_name: sanitizeOutputName(last),
  };
  const mid = sanitizeOutputName(middle || "");
  if (mid) obj.middle_name = mid;
  return obj;
};

// Parse a single person-like owner name in LAST FIRST [MIDDLE] ordering
const parsePersonName = (raw, inferredLast) => {
  const cleaned = normalize(
    raw.replace(/\s*&\s*$/, "").replace(/\s*&\s*/g, " "),
  );

  // Quick check: if the whole string looks like an address, reject it
  if (isLikelyAddressLine(cleaned)) {
    return null;
  }

  const parts = cleaned
    .split(/\s+/)
    .map((part) => cleanPersonToken(part))
    .filter(Boolean);

  if (parts.length === 0) return null;

  if (parts.length === 1) {
    if (inferredLast) {
      // Validate before returning
      if (!isValidPersonName(parts[0], inferredLast, null)) return null;
      return buildPerson(inferredLast, parts[0], null);
    }
    return null;
  }

  if (inferredLast && parts.length <= 2) {
    const [first, middle] = parts;
    // Validate before returning
    if (!isValidPersonName(first, inferredLast, middle || null)) return null;
    return buildPerson(inferredLast, first, middle || null);
  }

  const last = parts[0];
  const first = parts[1] || "";
  const middle = parts.slice(2).join(" ") || null;

  if (!first || !last) return null;

  // Validate the parsed name
  if (!isValidPersonName(first, last, middle)) {
    return null;
  }

  return buildPerson(last, first, middle);
};

const makeCompany = (name) => ({
  type: "company",
  name: sanitizeOutputName(name.replace(/\s*&\s*$/, "")),
});

// Given HTML that contains owner lines with <br>, extract name lines (exclude address)
const extractNameLinesFromHtml = (html) => {
  const tmp = cheerio.load(`<div class="x">${html}</div>`);
  tmp("br").replaceWith("\n");
  const text = tmp(".x").text();
  const allLines = text
    .split(/\n|\r/)
    .map((l) => normalize(l))
    .filter((l) => l);
  const nameLines = [];
  for (let i = 0; i < allLines.length; i++) {
    const ln = allLines[i];
    if (isLikelyAddressLine(ln)) break;
    nameLines.push(ln);
  }
  return nameLines;
};

// Convert name lines array into array of owner objects or raw strings when invalid
const parseOwnersFromNameLines = (nameLines) => {
  const owners = [];
  const invalid = [];

  if (nameLines.length === 0) return { owners, invalid };

  // Filter out any lines that look like addresses (double-check)
  const filteredLines = nameLines.filter(line => !isLikelyAddressLine(line));

  const lines = filteredLines
    .map((line) => normalizeOwnerNameLine(line))
    .filter((line) => line);

  if (lines.length === 0) return { owners, invalid };

  if (lines.length >= 2 && /&\s*$/.test(lines[0])) {
    const left = normalize(lines[0].replace(/&\s*$/, ""));
    const right = lines[1];
    if (isCompany(left)) {
      owners.push(makeCompany(left));
    } else if (!isLikelyAddressLine(left)) {
      const p1 = parsePersonName(left, null);
      if (p1) owners.push(p1);
      else
        invalid.push({
          raw: left,
          reason: "unable_to_parse_person_from_ampersand_line",
        });
    }
    if (isCompany(right)) {
      owners.push(makeCompany(right));
    } else if (!isLikelyAddressLine(right)) {
      const p2 = parsePersonName(right, null);
      if (p2) owners.push(p2);
      else
        invalid.push({
          raw: right,
          reason: "unable_to_parse_person_from_second_line",
        });
    }
    for (let i = 2; i < lines.length; i++) {
      const extra = lines[i];
      if (isLikelyAddressLine(extra)) continue; // Skip address lines
      if (isCompany(extra)) {
        owners.push(makeCompany(extra));
      } else {
        const p = parsePersonName(extra, null);
        if (p) owners.push(p);
        else
          invalid.push({
            raw: extra,
            reason: "unable_to_parse_additional_line",
          });
      }
    }
    return { owners, invalid };
  }

  if (lines.length === 1 && lines[0].includes("&")) {
    const parts = lines[0]
      .split("&")
      .map((s) => normalize(s))
      .filter(Boolean);
    if (parts.length >= 2) {
      const left = parts[0];
      const right = parts[1];
      const leftIsCompany = isCompany(left);
      const rightIsCompany = isCompany(right);
      const leftIsAddress = isLikelyAddressLine(left);
      const rightIsAddress = isLikelyAddressLine(right);

      if (leftIsCompany) owners.push(makeCompany(left));
      if (rightIsCompany) owners.push(makeCompany(right));
      if (!leftIsCompany && !leftIsAddress) {
        const pLeft = parsePersonName(left, null);
        if (pLeft) owners.push(pLeft);
        else invalid.push({ raw: left, reason: "unable_to_parse_left_person" });
      }
      if (!rightIsCompany && !rightIsAddress) {
        const leftTokens = left.split(/\s+/);
        const inferredLast = leftTokens[0] || null;
        const pRight = parsePersonName(right, inferredLast);
        if (pRight) owners.push(pRight);
        else
          invalid.push({ raw: right, reason: "unable_to_parse_right_person" });
      }
      return { owners, invalid };
    }
  }

  if (lines.length > 1) {
    for (const l of lines) {
      if (isLikelyAddressLine(l)) continue; // Skip address lines
      if (isCompany(l)) {
        owners.push(makeCompany(l));
      } else {
        const p = parsePersonName(l, null);
        if (p) owners.push(p);
        else invalid.push({ raw: l, reason: "unable_to_classify_line" });
      }
    }
    return { owners, invalid };
  }

  const single = lines[0];
  if (isLikelyAddressLine(single)) {
    return { owners, invalid }; // Address line, no owners
  }
  if (isCompany(single)) {
    owners.push(makeCompany(single));
  } else {
    const p = parsePersonName(single, null);
    if (p) owners.push(p);
    else invalid.push({ raw: single, reason: "unable_to_parse_single_line" });
  }
  return { owners, invalid };
};

const normalizeOwnerKey = (owner) => {
  if (!owner) return "";
  if (owner.type === "company") return `company:${owner.name}`.toLowerCase();
  const mid = owner.middle_name ? ` ${owner.middle_name}` : "";
  return `person:${owner.first_name}${mid} ${owner.last_name}`.toLowerCase();
};

const dedupeOwners = (owners) => {
  const map = new Map();
  for (const o of owners) {
    const key = normalizeOwnerKey(o);
    if (key && !map.has(key)) map.set(key, o);
  }
  return Array.from(map.values());
};

// Extract current owners from main page using DOM sibling traversal
const mainHtml =
  input.OwnersAndGeneralInformation &&
  input.OwnersAndGeneralInformation.response
    ? input.OwnersAndGeneralInformation.response
    : "";
const $main = cheerio.load(mainHtml);

const extractFollowingTextLines = ($, el, maxLines = 8) => {
  const lines = [];
  let buf = "";
  let node = el.nextSibling;
  while (node && lines.length < maxLines) {
    if (node.type === "tag") {
      const name = node.name ? node.name.toLowerCase() : "";
      if (name === "br") {
        const text = normalize(buf);
        if (text) lines.push(text);
        buf = "";
      } else if (name === "a") {
        break;
      } else if (name === "span" && $(node).hasClass("DtlSectionHdr")) {
        break;
      } else if (name === "table") {
        break;
      } else {
        buf += $(node).text();
      }
    } else if (node.type === "text" && node.data) {
      buf += node.data;
    }
    node = node.nextSibling;
  }
  const tail = normalize(buf);
  if (tail) lines.push(tail);
  const nameLines = [];
  const addressLines = [];
  let foundAddressStart = false;
  for (const ln of lines.map((l) => normalize(l)).filter(Boolean)) {
    if (isLikelyAddressLine(ln)) {
      foundAddressStart = true;
      addressLines.push(ln);
    } else if (!foundAddressStart) {
      nameLines.push(ln);
    } else {
      addressLines.push(ln);
    }
  }
  return { nameLines, addressLines };
};

// Property ID extraction
const extractPropertyId = () => {
  const body =
    (input.OwnersAndGeneralInformation &&
      input.OwnersAndGeneralInformation.source_http_request &&
      input.OwnersAndGeneralInformation.source_http_request.body) ||
    "";
  const m1 = body.match(/parid=([0-9A-Za-z]+)/i);
  if (m1) return m1[1];
  const mvqs =
    (input.OwnersAndGeneralInformation &&
      input.OwnersAndGeneralInformation.source_http_request &&
      input.OwnersAndGeneralInformation.source_http_request
        .multiValueQueryString &&
      input.OwnersAndGeneralInformation.source_http_request
        .multiValueQueryString.ID) ||
    null;
  if (mvqs && mvqs[0]) return mvqs[0];
  const titleSpan = $main("#lblPageTitle").text() || "";
  const m2 = titleSpan.match(/#\s*([0-9A-Za-z]+)/);
  if (m2) return m2[1];
  const mvqs2 =
    (input.History &&
      input.History.source_http_request &&
      input.History.source_http_request.multiValueQueryString &&
      input.History.source_http_request.multiValueQueryString.ID) ||
    null;
  if (mvqs2 && mvqs2[0]) return mvqs2[0];
  return "unknown_id";
};

const propertyId = extractPropertyId();

let currentNameLines = [];
let mailingAddressLines = [];
let invalidOwnersOverall = [];

$main("#lblOwner").each((i, el) => {
  if (currentNameLines.length) return;
  const result = extractFollowingTextLines($main, el, 8);
  currentNameLines = result.nameLines;
  mailingAddressLines = result.addressLines;
});

const { owners: currentOwnersRaw, invalid: invalidCurrent } =
  parseOwnersFromNameLines(currentNameLines);
const currentOwners = dedupeOwners(currentOwnersRaw.filter(Boolean));
invalidOwnersOverall = [...invalidCurrent];

// Build mailing address string from address lines
const mailingAddress = mailingAddressLines.length > 0 ? mailingAddressLines.join(", ") : null;

// Parse history page owner/date groups
const histHtml =
  input.History && input.History.response ? input.History.response : "";
const $hist = cheerio.load(histHtml);

const $historyTable = $hist("#pnlOwnHist table").first();

const dateGroups = new Map(); // dateKey => { owners: [], years: [] }
const unknownGroups = new Map(); // signature => { owners: [], years: [] }

if ($historyTable && $historyTable.length) {
  $historyTable.find("th").each((_, th) => {
    const yearText = normalize($hist(th).text());
    if (!/^\d{4}$/.test(yearText)) return;
    const year = parseInt(yearText, 10);
    const ownerTd = $hist(th).next("td");
    const legalTd = ownerTd.next("td");
    if (ownerTd && ownerTd.length) {
      const ownerHtml = ownerTd.html() || "";
      const lines = extractNameLinesFromHtml(ownerHtml);
      const { owners, invalid } = parseOwnersFromNameLines(lines);
      if (invalid && invalid.length) invalidOwnersOverall.push(...invalid);
      const ownersDeduped = dedupeOwners(owners);
      let dateKey = null;
      if (legalTd && legalTd.length) {
        const legalHtml = legalTd.html() || "";
        const mdate = legalHtml.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (mdate) dateKey = toISODate(mdate[1]);
      }
      if (ownersDeduped.length) {
        if (dateKey) {
          if (!dateGroups.has(dateKey))
            dateGroups.set(dateKey, { owners: [], years: [] });
          const entry = dateGroups.get(dateKey);
          entry.owners = dedupeOwners([...entry.owners, ...ownersDeduped]);
          entry.years.push(year);
        } else {
          const sig = ownersDeduped
            .map((o) => normalizeOwnerKey(o))
            .sort()
            .join("|");
          if (!unknownGroups.has(sig))
            unknownGroups.set(sig, { owners: ownersDeduped, years: [] });
          const entry = unknownGroups.get(sig);
          entry.years.push(year);
        }
      }
    }
  });
}

// Build chronological map
const ownersByDate = {};

const unknownList = Array.from(unknownGroups.values()).map((g) => ({
  owners: g.owners,
  minYear: Math.min(...g.years),
}));
unknownList.sort((a, b) => a.minYear - b.minYear);

const knownList = Array.from(dateGroups.entries()).map(([dateKey, g]) => ({
  dateKey,
  owners: g.owners,
  minYear: Math.min(...g.years),
}));
knownList.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

let placeholderCounter = 1;
const combined = [];
let iUnknown = 0;
let iKnown = 0;

while (iUnknown < unknownList.length || iKnown < knownList.length) {
  if (iUnknown >= unknownList.length) {
    combined.push({
      key: knownList[iKnown].dateKey,
      owners: knownList[iKnown].owners,
    });
    iKnown++;
  } else if (iKnown >= knownList.length) {
    const key = `unknown_date_${placeholderCounter++}`;
    combined.push({ key, owners: unknownList[iUnknown].owners });
    iUnknown++;
  } else {
    const unk = unknownList[iUnknown];
    const kn = knownList[iKnown];
    if (unk.minYear <= kn.minYear) {
      const key = `unknown_date_${placeholderCounter++}`;
      combined.push({ key, owners: unk.owners });
      iUnknown++;
    } else {
      combined.push({ key: kn.dateKey, owners: kn.owners });
      iKnown++;
    }
  }
}

for (const entry of combined) {
  ownersByDate[entry.key] = dedupeOwners(entry.owners);
}

ownersByDate["current"] = currentOwners;

const result = {};
result[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwnersOverall,
  mailing_address: mailingAddress,
};

const outDir = path.join("owners");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(JSON.stringify(result));
