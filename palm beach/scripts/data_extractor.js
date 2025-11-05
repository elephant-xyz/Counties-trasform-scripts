const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function extractBetween(html, regex, idx = 1) {
  const m = html.match(regex);
  return m ? (m[idx] || "").trim() : null;
}

function toISODate(mdy) {
  if (!mdy) return null;
  const m = String(mdy).trim();
  const parts = m.split("/");
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts.map((x) => x.trim());
  if (!yyyy || !mm || !dd) return null;
  const MM = mm.padStart(2, "0");
  const DD = dd.padStart(2, "0");
  return `${yyyy}-${MM}-${DD}`;
}

function safeNullIfEmpty(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function normalizeWhitespace(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function padGridValue(value, length) {
  const cleaned = safeNullIfEmpty(value);
  if (!cleaned) return null;
  const alphanumeric = cleaned.replace(/\s+/g, "");
  if (!alphanumeric) return null;
  if (/^[0-9]+$/.test(alphanumeric)) {
    return alphanumeric.padStart(length, "0");
  }
  return alphanumeric;
}

function extractUnitIdentifierFromAddressLines(lines = []) {
  for (const raw of lines) {
    const candidate = safeNullIfEmpty(raw);
    if (!candidate) continue;
    const match =
      candidate.match(/(?:APT|APARTMENT|STE|SUITE|UNIT|BLDG|BUILDING|LOT|SPACE|SPC|TRLR|#)\s*([A-Z0-9-]+)/i);
    if (match && match[1]) {
      return match[1].trim().toUpperCase();
    }
  }
  return null;
}

function cleanStreetCandidate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  let candidate = normalized;
  if (/\bP\.?\s*O\.?\s*BOX\b/i.test(candidate) || /\bPOST OFFICE BOX\b/i.test(candidate)) {
    return null;
  }
  if (candidate.includes(",")) {
    const firstSegment = candidate.split(",")[0].trim();
    if (firstSegment) candidate = firstSegment;
  }

  if (/C\/O/i.test(candidate)) {
    const parts = candidate.split(/C\/O/i);
    const after = parts[parts.length - 1].trim();
    if (after) candidate = after;
  }

  return candidate || null;
}

function combineAddressLines(lines = []) {
  const seen = new Set();
  const filtered = [];
  for (const line of lines) {
    const cleaned = safeNullIfEmpty(line);
    if (!cleaned) continue;
    const key = cleaned.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(cleaned);
  }
  if (!filtered.length) return null;
  return filtered.join(", ");
}

function composeUnnormalizedAddress(address) {
  if (!address) return null;

  const streetPieces = [];
  const number = safeNullIfEmpty(address.street_number);
  if (number) streetPieces.push(number);

  const nameSegments = [
    safeNullIfEmpty(address.street_pre_directional_text),
    safeNullIfEmpty(address.street_name),
    safeNullIfEmpty(address.street_suffix_type),
    safeNullIfEmpty(address.street_post_directional_text),
  ].filter(Boolean);
  if (nameSegments.length) {
    streetPieces.push(nameSegments.join(" "));
  }

  const route = safeNullIfEmpty(address.route_number);
  if (route) streetPieces.push(route);

  let streetLine = streetPieces.join(" ").replace(/\s+/g, " ").trim();
  const unit = safeNullIfEmpty(address.unit_identifier);
  if (unit) {
    streetLine = streetLine ? `${streetLine}, UNIT ${unit}` : `UNIT ${unit}`;
  }

  const localityPieces = [];
  const city = safeNullIfEmpty(address.city_name);
  if (city) localityPieces.push(city);

  const state = safeNullIfEmpty(address.state_code);
  const postal = safeNullIfEmpty(address.postal_code);
  if (state || postal) {
    const statePostal = [state, postal].filter(Boolean).join(" ");
    if (statePostal) {
      const plus4 = safeNullIfEmpty(address.plus_four_postal_code);
      localityPieces.push(plus4 ? `${statePostal}-${plus4}` : statePostal);
    }
  }

  const localityLine = localityPieces.join(", ").replace(/\s+/g, " ").trim();

  const segments = [streetLine, localityLine]
    .map((segment) => (segment || "").trim())
    .filter((segment) => segment.length);

  if (!segments.length) return null;

  const county = safeNullIfEmpty(address.county_name);
  if (county) {
    const countyUpper = county.toUpperCase();
    const alreadyHasCounty = segments.some((segment) =>
      segment.toUpperCase().includes(countyUpper),
    );
    if (!alreadyHasCounty) {
      segments.push(county);
    }
  }

  return segments.join(", ");
}

function titleCaseCounty(county) {
  if (!county) return null;
  const lc = String(county).toLowerCase();
  const map = {
    "miami dade": "Miami Dade",
    broward: "Broward",
    "palm beach": "Palm Beach",
    lee: "Lee",
    hillsborough: "Hillsborough",
    orange: "Orange",
    pinellas: "Pinellas",
    polk: "Polk",
    duval: "Duval",
    brevard: "Brevard",
    pasco: "Pasco",
    volusia: "Volusia",
    sarasota: "Sarasota",
    collier: "Collier",
    marion: "Marion",
    manatee: "Manatee",
    charlotte: "Charlotte",
    lake: "Lake",
    osceola: "Osceola",
    "st. lucie": "St. Lucie",
    seminole: "Seminole",
    escambia: "Escambia",
    "st. johns": "St. Johns",
    citrus: "Citrus",
    bay: "Bay",
    "santa rosa": "Santa Rosa",
    hernando: "Hernando",
    okaloosa: "Okaloosa",
    highlands: "Highlands",
    leon: "Leon",
    alachua: "Alachua",
    clay: "Clay",
    sumter: "Sumter",
    putnam: "Putnam",
    martin: "Martin",
    "indian river": "Indian River",
    walton: "Walton",
    monroe: "Monroe",
    flagler: "Flagler",
    nassau: "Nassau",
    levy: "Levy",
    washington: "Washington",
    jackson: "Jackson",
    suwannee: "Suwannee",
    columbia: "Columbia",
    hendry: "Hendry",
    okeechobee: "Okeechobee",
    gadsden: "Gadsden",
    wakulla: "Wakulla",
    desoto: "DeSoto",
    gulf: "Gulf",
    taylor: "Taylor",
    franklin: "Franklin",
    dixie: "Dixie",
    madison: "Madison",
    bradford: "Bradford",
    hardee: "Hardee",
    gilchrist: "Gilchrist",
    holmes: "Holmes",
    calhoun: "Calhoun",
    hamilton: "Hamilton",
    baker: "Baker",
    jefferson: "Jefferson",
    glades: "Glades",
    lafayette: "Lafayette",
    union: "Union",
    liberty: "Liberty",
  };
  return map[lc] || toTitleCase(county);
}

const STREET_DIRECTIONS = new Set([
  "N",
  "S",
  "E",
  "W",
  "NE",
  "NW",
  "SE",
  "SW",
]);

const STREET_SUFFIX_ENUM = [
  "Rds",
  "Blvd",
  "Lk",
  "Pike",
  "Ky",
  "Vw",
  "Curv",
  "Psge",
  "Ldg",
  "Mt",
  "Un",
  "Mdw",
  "Via",
  "Cor",
  "Kys",
  "Vl",
  "Pr",
  "Cv",
  "Isle",
  "Lgt",
  "Hbr",
  "Btm",
  "Hl",
  "Mews",
  "Hls",
  "Pnes",
  "Lgts",
  "Strm",
  "Hwy",
  "Trwy",
  "Skwy",
  "Is",
  "Est",
  "Vws",
  "Ave",
  "Exts",
  "Cvs",
  "Row",
  "Rte",
  "Fall",
  "Gtwy",
  "Wls",
  "Clb",
  "Frk",
  "Cpe",
  "Fwy",
  "Knls",
  "Rdg",
  "Jct",
  "Rst",
  "Spgs",
  "Cir",
  "Crst",
  "Expy",
  "Smt",
  "Trfy",
  "Cors",
  "Land",
  "Uns",
  "Jcts",
  "Ways",
  "Trl",
  "Way",
  "Trlr",
  "Aly",
  "Spg",
  "Pkwy",
  "Cmn",
  "Dr",
  "Grns",
  "Oval",
  "Cirs",
  "Pt",
  "Shls",
  "Vly",
  "Hts",
  "Clf",
  "Flt",
  "Mall",
  "Frds",
  "Cyn",
  "Lndg",
  "Mdws",
  "Rd",
  "Xrds",
  "Ter",
  "Prt",
  "Radl",
  "Grvs",
  "Rdgs",
  "Inlt",
  "Trak",
  "Byu",
  "Vlgs",
  "Ctr",
  "Ml",
  "Cts",
  "Arc",
  "Bnd",
  "Riv",
  "Flds",
  "Mtwy",
  "Msn",
  "Shrs",
  "Rue",
  "Crse",
  "Cres",
  "Anx",
  "Drs",
  "Sts",
  "Holw",
  "Vlg",
  "Prts",
  "Sta",
  "Fld",
  "Xrd",
  "Wall",
  "Tpke",
  "Ft",
  "Bg",
  "Knl",
  "Plz",
  "St",
  "Cswy",
  "Bgs",
  "Rnch",
  "Frks",
  "Ln",
  "Mtn",
  "Ctrs",
  "Orch",
  "Iss",
  "Brks",
  "Br",
  "Fls",
  "Trce",
  "Park",
  "Gdns",
  "Rpds",
  "Shl",
  "Lf",
  "Rpd",
  "Lcks",
  "Gln",
  "Pl",
  "Path",
  "Vis",
  "Lks",
  "Run",
  "Frg",
  "Brg",
  "Sqs",
  "Xing",
  "Pln",
  "Glns",
  "Blfs",
  "Plns",
  "Dl",
  "Clfs",
  "Ext",
  "Pass",
  "Gdn",
  "Brk",
  "Grn",
  "Mnr",
  "Cp",
  "Pne",
  "Spur",
  "Opas",
  "Upas",
  "Tunl",
  "Sq",
  "Lck",
  "Ests",
  "Shr",
  "Dm",
  "Mls",
  "Wl",
  "Mnrs",
  "Stra",
  "Frgs",
  "Frst",
  "Flts",
  "Ct",
  "Mtns",
  "Frd",
  "Nck",
  "Ramp",
  "Vlys",
  "Pts",
  "Bch",
  "Loop",
  "Byp",
  "Cmns",
  "Fry",
  "Walk",
  "Hbrs",
  "Dv",
  "Hvn",
  "Blf",
  "Grv",
  "Crk",
];

const ADDRESS_SCHEMA_FIELDS = [
  "latitude",
  "longitude",
  "city_name",
  "country_code",
  "plus_four_postal_code",
  "postal_code",
  "state_code",
  "street_name",
  "street_post_directional_text",
  "street_pre_directional_text",
  "street_number",
  "street_suffix_type",
  "unit_identifier",
  "route_number",
  "township",
  "range",
  "section",
  "block",
  "lot",
  "county_name",
  "municipality_name",
  "unnormalized_address",
];

const ADDRESS_REQUIRED_COORDINATE_FIELDS = ["latitude", "longitude"];

const COORDINATE_ADDRESS_REQUIRED_NUMBERS = ["latitude", "longitude"];

const NORMALIZED_ADDRESS_FIELDS = [
  "latitude",
  "longitude",
  "city_name",
  "country_code",
  "plus_four_postal_code",
  "postal_code",
  "state_code",
  "street_name",
  "street_post_directional_text",
  "street_pre_directional_text",
  "street_number",
  "street_suffix_type",
  "unit_identifier",
  "route_number",
  "township",
  "range",
  "section",
  "block",
  "lot",
  "county_name",
  "municipality_name",
];

const RAW_ADDRESS_FIELDS = ADDRESS_SCHEMA_FIELDS.filter(
  (field) => field !== "unnormalized_address",
);

const NORMALIZED_ADDRESS_REQUIRED_STRING_FIELDS = [
  "street_number",
  "street_name",
  "street_suffix_type",
  "city_name",
  "state_code",
  "postal_code",
  "country_code",
];

function hasCompleteNormalizedAddress(address) {
  if (!address || typeof address !== "object") return false;
  for (const field of NORMALIZED_ADDRESS_REQUIRED_STRING_FIELDS) {
    const value = address[field];
    if (typeof value !== "string" || value.trim().length === 0) {
      return false;
    }
  }
  return true;
}

// Utility helper that builds an object containing only the requested fields from the source.
// When preserveNulls is true the returned object explicitly includes null-valued fields so
// consumers can satisfy schema branches that require property presence.
function collectAddressFields(source, fields, options = {}) {
  const { preserveNulls = false } = options;
  const result = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      if (preserveNulls) result[field] = null;
      continue;
    }
    const value = source[field];
    if (value == null) {
      if (preserveNulls) result[field] = null;
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        result[field] = value;
      } else if (preserveNulls) {
        result[field] = null;
      }
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length) {
        result[field] = trimmed;
      } else if (preserveNulls) {
        result[field] = null;
      }
      continue;
    }
    result[field] = value;
  }
  return result;
}

function buildRawAddressPayload(address, unnormalizedValue) {
  if (!unnormalizedValue) return null;

  // Preserve explicit nulls so the oneOf branch that expects these keys is satisfied.
  const rawAddress = collectAddressFields(address, RAW_ADDRESS_FIELDS, {
    preserveNulls: true,
  });

  return {
    ...rawAddress,
    unnormalized_address: unnormalizedValue,
  };
}

const STREET_SUFFIX_SYNONYMS = {
  RD: "Rd",
  ROAD: "Rd",
  DRIVE: "Dr",
  DR: "Dr",
  STREET: "St",
  ST: "St",
  AVE: "Ave",
  AVENUE: "Ave",
  HIGHWAY: "Hwy",
  HWY: "Hwy",
  LANE: "Ln",
  LN: "Ln",
  COURT: "Ct",
  CT: "Ct",
  CIRCLE: "Cir",
  CIR: "Cir",
  PARKWAY: "Pkwy",
  PKWY: "Pkwy",
  TERRACE: "Ter",
  TER: "Ter",
  PLACE: "Pl",
  PL: "Pl",
  BOULEVARD: "Blvd",
  BLVD: "Blvd",
  DRIVEWAY: "Dr",
  TRL: "Trl",
  TRAIL: "Trl",
  WAY: "Way",
};

const STREET_SUFFIX_LOOKUP = new Map(
  STREET_SUFFIX_ENUM.map((value) => [value.toUpperCase(), value]),
);

for (const [key, value] of Object.entries(STREET_SUFFIX_SYNONYMS)) {
  if (!STREET_SUFFIX_LOOKUP.has(key)) {
    STREET_SUFFIX_LOOKUP.set(key, value);
  }
}

function mapStreetSuffixType(token) {
  if (!token) return null;
  const cleaned = token.replace(/\./g, "").toUpperCase();
  if (STREET_SUFFIX_LOOKUP.has(cleaned)) {
    return STREET_SUFFIX_LOOKUP.get(cleaned);
  }
  return null;
}

function parseCityStatePostal(raw) {
  const parsed = {
    city: null,
    state: null,
    postal: null,
    plus4: null,
  };
  const normalized = normalizeWhitespace(raw);
  if (!normalized) return parsed;

  const cleaned = normalized.replace(/,/g, "").toUpperCase();
  const cityStateZipMatch = cleaned.match(
    /^(.+?)\s+([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?$/,
  );
  if (cityStateZipMatch) {
    parsed.city = cityStateZipMatch[1].trim();
    parsed.state = cityStateZipMatch[2].trim();
    parsed.postal = cityStateZipMatch[3];
    parsed.plus4 = cityStateZipMatch[4] || null;
    return parsed;
  }

  const stateZipMatch = cleaned.match(/([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?/);
  if (stateZipMatch) {
    parsed.state = stateZipMatch[1].trim();
    parsed.postal = stateZipMatch[2];
    parsed.plus4 = stateZipMatch[3] || null;
    const cityCandidate = cleaned.slice(0, stateZipMatch.index).trim();
    if (cityCandidate && !/\d/.test(cityCandidate)) {
      parsed.city = cityCandidate;
    }
    return parsed;
  }

  const postalMatch = cleaned.match(/\b(\d{5})(?:\s+(\d{4}))?\b/);
  if (postalMatch) {
    parsed.postal = postalMatch[1];
    parsed.plus4 = postalMatch[2] || null;
  }
  return parsed;
}

function parseLocationAddress(raw) {
  const result = {
    streetNumber: null,
    streetName: null,
    streetPreDirectional: null,
    streetPostDirectional: null,
    streetSuffix: null,
    unitIdentifier: null,
    routeNumber: null,
  };

  const normalized = normalizeWhitespace(raw);
  if (!normalized) return result;

  const tokens = normalized
    .toUpperCase()
    .split(/\s+/)
    .map((token) => token.replace(/[.,/]/g, ""));
  if (!tokens.length) return result;

  const numberPattern = /^\d+[A-Z]?$/i;
  let numberIndex = numberPattern.test(tokens[0]) ? 0 : tokens.findIndex((token) => numberPattern.test(token));

  if (numberIndex > 0) {
    const leadingTokens = tokens.slice(0, numberIndex);
    if (!result.unitIdentifier && leadingTokens.length) {
      const leadingUnitMatch = leadingTokens.join(" ").match(
        /(?:APT|UNIT|SUITE|STE|BLDG|BUILDING|FL|FLOOR|LOT|TRLR|TRAILER|SPC|SPACE|#)\s*([A-Z0-9-]+)/i,
      );
      if (leadingUnitMatch && leadingUnitMatch[1]) {
        result.unitIdentifier = leadingUnitMatch[1].replace(/^#/, "");
      }
    }
    tokens.splice(0, numberIndex);
  } else if (numberIndex === -1) {
    numberIndex = 0;
  }

  const first = tokens[0];
  if (numberPattern.test(first)) {
    result.streetNumber = first;
    tokens.shift();
  }

  if (!tokens.length) return result;

  const consumePostDirectional = () => {
    if (!tokens.length) return;
    const candidate = tokens[tokens.length - 1].toUpperCase();
    if (STREET_DIRECTIONS.has(candidate)) {
      result.streetPostDirectional = candidate;
      tokens.pop();
    }
  };

  const maybePre = tokens[0].toUpperCase();
  if (STREET_DIRECTIONS.has(maybePre)) {
    result.streetPreDirectional = maybePre;
    tokens.shift();
  }

  if (!tokens.length) return result;

  consumePostDirectional();
  if (!tokens.length) return result;

  // Handle explicit unit keywords (UNIT 5, APT B, STE 2, etc.)
  if (tokens.length >= 2) {
    const keyword = tokens[tokens.length - 2].toUpperCase();
    if (/^(APT|UNIT|STE|SUITE|BLDG|BUILDING|FL|FLOOR|LOT|RM|ROOM|TRLR|SPC|SPACE)$/.test(keyword)) {
      if (!result.unitIdentifier) {
        result.unitIdentifier = tokens[tokens.length - 1];
      }
      tokens.pop();
      tokens.pop();
    }
  }

  if (!tokens.length) return result;

  const removeTrailingUnitToken = () => {
    if (!tokens.length) return false;
    const lastToken = tokens[tokens.length - 1];
    if (!lastToken) return false;
    const normalizedLast = lastToken.toUpperCase();
    if (STREET_DIRECTIONS.has(normalizedLast)) return false;
    if (mapStreetSuffixType(lastToken)) return false;

    const ordinalRegex = /^\d+(ST|ND|RD|TH)$/;
    const hasHashPrefix = lastToken.startsWith("#");
    const hasDigits = /\d/.test(lastToken);
    const looksOrdinal = ordinalRegex.test(lastToken);
    const isCompactToken = /^[#A-Z0-9-]+$/.test(lastToken) && lastToken.length <= 6;

    if (isCompactToken && (hasHashPrefix || (hasDigits && !looksOrdinal))) {
      if (!result.unitIdentifier) {
        result.unitIdentifier = lastToken.replace(/^#/, "");
      }
      tokens.pop();
      return true;
    }
    return false;
  };

  removeTrailingUnitToken();
  consumePostDirectional();

  if (!tokens.length) return result;

  const suffixToken = tokens[tokens.length - 1];
  const suffix = mapStreetSuffixType(suffixToken);
  if (suffix) {
    result.streetSuffix = suffix;
    tokens.pop();
  }

  if (!tokens.length) return result;

  consumePostDirectional();
  if (!tokens.length) return result;

  const remaining = tokens.join(" ").trim();
  if (!remaining) return result;

  const routePatterns = [
    { regex: /^(?:US|U\.S\.)\s+(?:HWY|HIGHWAY)\s+([A-Z0-9-]+)$/, name: "US Highway" },
    { regex: /^(?:US|U\.S\.)\s+([A-Z0-9-]+)$/, name: "US Highway" },
    { regex: /^(?:STATE\s+(?:ROAD|RD)|SR)\s+([A-Z0-9-]+)$/, name: "State Road" },
    { regex: /^(?:COUNTY\s+(?:ROAD|RD)|CR)\s+([A-Z0-9-]+)$/, name: "County Road" },
    { regex: /^(?:HWY|HIGHWAY)\s+([A-Z0-9-]+)$/, name: "Highway" },
    { regex: /^(?:ROUTE|RTE)\s+([A-Z0-9-]+)$/, name: "Route" },
  ];

  for (const pattern of routePatterns) {
    const match = remaining.match(pattern.regex);
    if (match) {
      result.routeNumber = match[1];
      result.streetName = pattern.name.toUpperCase();
      return result;
    }
  }

  result.streetName = remaining;
  return result;
}

function sanitizePostalCode(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\D/g, "");
  if (cleaned.length >= 5) return cleaned.slice(0, 5);
  return null;
}

function sanitizePlus4(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\D/g, "");
  if (cleaned.length >= 4) return cleaned.slice(0, 4);
  return null;
}

function deriveGridPartsFromPcn(rawPcn) {
  if (!rawPcn) return {};
  const normalized = normalizeWhitespace(String(rawPcn));
  if (!normalized) return {};
  const tokens = normalized
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);
  const grid = {};
  if (tokens.length >= 4) {
    grid.township = tokens[1] || null;
    grid.range = tokens[2] || null;
    grid.section = tokens[3] || null;
  }
  if (tokens.length >= 6) grid.block = tokens[5] || null;
  if (tokens.length >= 7) grid.lot = tokens[6] || null;
  return grid;
}

function fillAddressStreetComponents(address, streetCandidates) {
  const seen = new Set();
  for (const candidate of streetCandidates) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const parsed = parseLocationAddress(normalized);

    if (parsed.streetNumber && !address.street_number) {
      address.street_number = safeNullIfEmpty(parsed.streetNumber);
    }
    if (parsed.streetPreDirectional && !address.street_pre_directional_text) {
      address.street_pre_directional_text = parsed.streetPreDirectional.toUpperCase();
    }
    if (parsed.streetPostDirectional && !address.street_post_directional_text) {
      address.street_post_directional_text = parsed.streetPostDirectional.toUpperCase();
    }
    if (parsed.streetSuffix && !address.street_suffix_type) {
      address.street_suffix_type = safeNullIfEmpty(parsed.streetSuffix);
    }
    if (parsed.streetName && !address.street_name) {
      const formatted = safeNullIfEmpty(formatStreetNameCase(parsed.streetName));
      address.street_name = formatted ? formatted.toUpperCase() : null;
    }
    if (parsed.unitIdentifier && !address.unit_identifier) {
      address.unit_identifier = safeNullIfEmpty(parsed.unitIdentifier);
    }
    if (parsed.routeNumber && !address.route_number) {
      address.route_number = safeNullIfEmpty(parsed.routeNumber);
    }
  }

  if (address.street_number && address.street_name && address.street_suffix_type) {
    return;
  }

  for (const candidate of streetCandidates) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized) continue;
    const parts = normalized
      .replace(/[.,]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) continue;

    let idxStart = 0;
    let idxEnd = parts.length;

    if (!address.street_number) {
      const numberIdx = parts.findIndex((part) => /^\d+[A-Z]?$/i.test(part));
      if (numberIdx !== -1) {
        address.street_number = parts[numberIdx];
        idxStart = numberIdx + 1;
      }
    }

    if (!address.street_pre_directional_text && idxStart < idxEnd) {
      const maybePre = parts[idxStart].toUpperCase();
      if (STREET_DIRECTIONS.has(maybePre)) {
        address.street_pre_directional_text = maybePre;
        idxStart += 1;
      }
    }

    if (!address.street_post_directional_text && idxStart < idxEnd) {
      const maybePost = parts[idxEnd - 1].toUpperCase();
      if (STREET_DIRECTIONS.has(maybePost)) {
        address.street_post_directional_text = maybePost;
        idxEnd -= 1;
      }
    }

    if (!address.street_suffix_type && idxStart < idxEnd) {
      const maybeSuffix = parts[idxEnd - 1];
      const mappedSuffix = mapStreetSuffixType(maybeSuffix);
      if (mappedSuffix) {
        address.street_suffix_type = mappedSuffix;
        idxEnd -= 1;
      }
    }

    if (!address.street_name && idxEnd > idxStart) {
      const nameTokens = parts.slice(idxStart, idxEnd);
      if (nameTokens.length) {
        const formatted = safeNullIfEmpty(formatStreetNameCase(nameTokens.join(" ")));
        address.street_name = formatted ? formatted.toUpperCase() : null;
      }
    }

    if (
      address.street_number &&
      address.street_name &&
      address.street_suffix_type
    ) {
      break;
    }
  }
}

function applyAddressFallbacks(address, options = {}) {
  const {
    streetCandidates = [],
    fallbackCity = null,
    fallbackState = null,
    fallbackPostal = null,
    fallbackPlus4 = null,
    municipality = null,
    county = null,
    formattedPcn = null,
    legalDescription = null,
  } = options;

  if (!address.city_name && fallbackCity) {
    const fallbackCityUpper = fallbackCity.toUpperCase();
    if (!/\d/.test(fallbackCityUpper)) {
      address.city_name = fallbackCityUpper;
    }
  }
  if (!address.state_code && fallbackState) {
    address.state_code = fallbackState.toUpperCase();
  }
  address.postal_code = sanitizePostalCode(address.postal_code || fallbackPostal);
  address.plus_four_postal_code =
    sanitizePlus4(address.plus_four_postal_code || fallbackPlus4);

  if (!address.country_code && (address.state_code || address.postal_code)) {
    address.country_code = "US";
  }

  if (!address.municipality_name && municipality) {
    address.municipality_name = toTitleCase(municipality);
  }
  if (!address.city_name && address.municipality_name) {
    const municipalityUpper = address.municipality_name.toUpperCase();
    if (!/\d/.test(municipalityUpper)) {
      address.city_name = municipalityUpper;
    }
  }

  if (!address.county_name && county) {
    address.county_name = toTitleCase(county);
  }

  fillAddressStreetComponents(address, streetCandidates);

  address.street_pre_directional_text = address.street_pre_directional_text
    ? address.street_pre_directional_text.toUpperCase()
    : null;
  address.street_post_directional_text = address.street_post_directional_text
    ? address.street_post_directional_text.toUpperCase()
    : null;
  address.street_name = address.street_name ? address.street_name.toUpperCase() : null;

  if (formattedPcn) {
    const parts = deriveGridPartsFromPcn(formattedPcn);
    for (const key of ["section", "township", "range", "block", "lot"]) {
      if (!address[key] && parts[key]) {
        address[key] = parts[key];
      }
    }
  }

  if (legalDescription) {
    const normalized = legalDescription.toUpperCase();
    if (!address.lot) {
      const lotMatch =
        normalized.match(/\bLOT\s+([A-Z0-9-]+)/) ||
        normalized.match(/\bLT\s+([A-Z0-9-]+)/);
      if (lotMatch) address.lot = lotMatch[1];
    }
    if (!address.block) {
      const blockMatch =
        normalized.match(/\bBLOCK\s+([A-Z0-9-]+)/) ||
        normalized.match(/\bBLK\s+([A-Z0-9-]+)/);
      if (blockMatch) address.block = blockMatch[1];
    }
  }
}

function formatStreetNameCase(value) {
  if (!value) return null;
  const tokens = String(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (upper === "US" || upper === "SR" || upper === "CR") return upper;
      if (word.length === 1) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  return tokens.length ? tokens.join(" ") : null;
}

function parseCoordinate(value) {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const match = stringValue.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

const MIDDLE_NAME_PLACEHOLDERS = new Set([
  "nmi",
  "n m i",
  "nm",
  "n m",
  "no",
  "none",
  "no middle",
  "no middle name",
  "no middle initial",
  "none recorded",
  "unknown",
  "na",
  "n/a",
  "no mn",
  "no mi",
]);

function parseModelJSONFromHTML(html) {
  const re = /var\s+model\s*=\s*(\{[\s\S]*?\});/m;
  const m = html.match(re);
  if (!m) return null;
  const jsonText = m[1];
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    try {
      return JSON.parse(jsonText.replace(/\n/g, ""));
    } catch (e2) {
      return null;
    }
  }
}

function mapDeedTypeEnum(s) {
  // Only return values that exactly map to the allowed enum list; else null.
  if (!s) return null;
  const t = s.toUpperCase().trim();
  if (t.includes("WARRANTY DEED")) return "Warranty Deed";
  if (t.includes("SPECIAL WARRANTY")) return "Special Warranty Deed";
  if (t.includes("QUIT")) return "Quitclaim Deed";
  if (t.includes("GRANT DEED")) return "Grant Deed";
  if (t.includes("BARGAIN AND SALE")) return "Bargain and Sale Deed";
  if (t.includes("LADY BIRD")) return "Lady Bird Deed";
  if (t.includes("TRANSFER ON DEATH")) return "Transfer on Death Deed";
  if (t.includes("SHERIFF'S DEED")) return "Sheriff's Deed";
  if (t.includes("TAX DEED")) return "Tax Deed";
  if (t.includes("TRUSTEE")) return "Trustee's Deed";
  if (t.includes("PERSONAL REPRESENTATIVE"))
    return "Personal Representative Deed";
  if (t.includes("CORRECTION")) return "Correction Deed";
  if (t.includes("LIEU")) return "Deed in Lieu of Foreclosure";
  if (t.includes("LIFE ESTATE")) return "Life Estate Deed";
  if (t.includes("JOINT TENANCY")) return "Joint Tenancy Deed";
  if (t.includes("TENANCY IN COMMON")) return "Tenancy in Common Deed";
  if (t.includes("COMMUNITY PROPERTY")) return "Community Property Deed";
  if (t.includes("GIFT DEED")) return "Gift Deed";
  if (t.includes("INTERSPOUSAL")) return "Interspousal Transfer Deed";
  if (t.includes("WILD DEED")) return "Wild Deed";
  return null;
}

function normalizeMiddleName(s) {
  const t = safeNullIfEmpty(s);
  if (t == null) return null;
  const cleaned = String(t)
    .replace(/[^A-Za-z\s\-',.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const canonical = cleaned
    .replace(/[',.]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (MIDDLE_NAME_PLACEHOLDERS.has(canonical)) return null;
  return formatNamePart(cleaned);
}

function toTitleCase(str) {
  if (!str || str.trim() === "") return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const PERSON_NAME_PATTERN = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

function formatNamePart(part) {
  if (!part) return null;
  let cleaned = String(part).trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/[^A-Za-z\s\-']/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  cleaned = cleaned
    .toLowerCase()
    .replace(/(^|[ \-'])([a-z])/g, (match, prefix, char) => `${prefix}${char.toUpperCase()}`);
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return PERSON_NAME_PATTERN.test(cleaned) ? cleaned : null;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const inputHTML = readText("input.html");
  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Input owners/utilities/layout
  let ownersData = {};
  let utilitiesData = {};
  let layoutData = {};
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch (e) { }
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch (e) { }
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) { }

  const parcelId = seed && seed.parcel_id ? String(seed.parcel_id) : null;
  const ownersKey = parcelId ? `property_${parcelId}` : null;

  // Parse embedded model first (robust source inside HTML)
  const model = parseModelJSONFromHTML(inputHTML);

  const modelDetail = model && model.propertyDetail ? model.propertyDetail : null;

  // Extract property core fields from HTML (supplement) with fallbacks to embedded model
  const addressLine1 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine1);
  const addressLine2 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine2);
  const addressLine3 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine3);

  const rawLocAddr = extractBetween(
    inputHTML,
    /<span id="MainContent_lblLocation">([\s\S]*?)<\/span>/i,
  );
  const siteLocationLine =
    safeNullIfEmpty(rawLocAddr) ||
    safeNullIfEmpty(modelDetail && modelDetail.Location) ||
    null;
  let municipality =
    safeNullIfEmpty(modelDetail && modelDetail.Municipality) ||
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /"AddressLine3":"([\w\s]+?)\s[A-Z]{2}\s\d{5}/i,
      ),
    );
  const pcnHyphen = safeNullIfEmpty(
    extractBetween(
      inputHTML,
      /<span id="MainContent_lblPCN">([\s\S]*?)<\/span>/i,
    ),
  );
  const subdivision =
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /<span id="MainContent_lblSubdiv">([\s\S]*?)<\/span>/i,
      ),
    ) || safeNullIfEmpty(modelDetail && modelDetail.Subdivision);
  const legalDesc =
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /<span id="MainContent_lblLegalDesc">([\s\S]*?)<\/span>/i,
      ),
    ) || safeNullIfEmpty(modelDetail && modelDetail.LegalDesc);

  // Property metrics from model.structuralDetails if available
  let areaUnderAir = null;
  let totalSquareFootage = null;
  let numberOfUnitsStr = null;
  let yearBuiltStr = null;
  let effectiveYearStr = null;
  let zoning = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Area Under Air/i.test(name)) areaUnderAir = val;
      if (/Total Square Footage/i.test(name)) totalSquareFootage = val;
      if (/Number of Units/i.test(name)) numberOfUnitsStr = val;
      if (/Dwelling Units/i.test(name)) numberOfUnitsStr = val;
      if (/Year Built/i.test(name)) yearBuiltStr = val;
      if (/Effective Year/i.test(name)) effectiveYearStr = val;
    }
  }
  // Zoning from model.propertyDetail if present
  if (model && model.propertyDetail) {
    const zc = model.propertyDetail.Zoning || null;
    const zd = model.propertyDetail.ZoningDesc || null;
    const zcitydesc = model.propertyDetail.ZoningCityDesc || null;
    if (zc && zd && zcitydesc) {
      zoning = `${zc}—${zd} (${zcitydesc})`;
    }
  }
  // Fallback to regex if missing
  if (!areaUnderAir) {
    const mA = inputHTML.match(
      /Area Under Air[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mA) areaUnderAir = mA[1];
  }
  if (!totalSquareFootage) {
    const mT = inputHTML.match(
      /Total Square Footage[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mT) totalSquareFootage = mT[1];
  }
  if (!numberOfUnitsStr) {
    const mN = inputHTML.match(
      /Number of Units[\s\S]*?<td class=\"value\">\s*(\d+)\s*<\/td>/i,
    );
    if (mN) numberOfUnitsStr = mN[1];
  }
  // Also try DWELLING UNITS pattern from building details
  if (!numberOfUnitsStr) {
    const mDU = inputHTML.match(
      /<b>DWELLING UNITS<\/b>-<i>(\d+)<\/i>/i,
    );
    if (mDU) numberOfUnitsStr = mDU[1];
  }
  if (!yearBuiltStr) {
    const mY = inputHTML.match(
      /Year Built[\s\S]*?<td class=\"value\">\s*(\d{4})\s*<\/td>/i,
    );
    if (mY) yearBuiltStr = mY[1];
  }
  // Also try Year Built from building header
  if (!yearBuiltStr) {
    const mYB = inputHTML.match(/Year Built:\s*(\d{4})/i);
    if (mYB) yearBuiltStr = mYB[1];
  }
  if (!effectiveYearStr) {
    const mEY = inputHTML.match(/Effective Year:\s*(\d{4})/i);
    if (mEY) effectiveYearStr = mEY[1];
  }
  if (!zoning) {
    const mZ = inputHTML.match(
      /<td class=\"label\">\s*Zoning\s*<\/td>\s*<td class=\"value\">\s*([\s\S]*?)<\/td>/i,
    );
    if (mZ) zoning = mZ[1].replace(/\s+/g, " ").trim();
  }

  // Helper function to clean and validate livable floor area
  function cleanLivableFloorArea(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^\d]/g, ''); // Remove all non-digits
    // Must have at least 2 consecutive digits to match schema pattern .*\d{2,}.*
    return cleaned.length >= 2 ? cleaned : null;
  }

  // Build property.json
  // property_type enum: LandParcel, Building, Unit, ManufacturedHome

  function propertyType(v) {
    if (!v) return null;
    const s = v.toUpperCase();

    // ManufacturedHome - mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("MHT COOP") || s.includes("MODULAR")) return "ManufacturedHome";

    // Unit - individual units within larger structures
    if (s.includes("CONDO") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("CO-OP") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") ||
        s.includes("BOAT UNITS") || s.includes("BOAT SLIPS") ||
        s.includes("LEASE INTEREST") || s.includes("NO LAND INTEREST")) return "Unit";

    // LandParcel - vacant land or land-focused properties
    if (s.includes("VACANT") || s.includes("ACREAGE") ||
        s.includes("AGRICULTURAL") || s.includes("PASTURE") ||
        s.includes("GROVE") || s.includes("TIMBER") || s.includes("FARM") ||
        s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("WETLANDS") || s.includes("PRESERVE") ||
        s.includes("CONSERVATION") || s.includes("RIGHT OF WAY")) return "LandParcel";

    // Building - default for structures (residential, commercial, industrial, institutional)
    return "Building";
  }

  function unitsType(v) {
    switch (v) {
      case "1":
        return "One";
      case "2":
        return "Two";
      case "3":
        return "Three";
      case "4":
        return "Four";
      default:
        return null;
    }
  }

  // Extract property type from HTML model
  let mappedPropertyType = null;
  let useCode = null;
  let units = null;

  const modelMatch = inputHTML.match(/var model = ({.*?});/s);
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (modelData.propertyDetail) {
        useCode =
          modelData.propertyDetail.UseCodeDesc ||
          modelData.propertyDetail.UseCode ||
          modelData.propertyDetail.PropertyUseCode ||
          modelData.propertyDetail.PropertyUseDescription ||
          null;
        mappedPropertyType = mapPropertyUseCodeToType(useCode);
        units = parseInt(modelData.propertyDetail.Units) || 0;
      }
    } catch (e) {
      console.log("Error parsing property type from model:", e.message);
    }
  }

  const property = {
    parcel_identifier:
      parcelId ||
      safeNullIfEmpty(pcnHyphen ? pcnHyphen.replace(/-/g, "") : null),
    property_structure_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr, 10)
      : null,
    property_legal_description_text: safeNullIfEmpty(
      legalDesc ? legalDesc.replace(/\s+/g, " ").trim() : null,
    ),
    property_type: mappedPropertyType,
    property_usage_type: mapPropertyUsageType(useCode),
    livable_floor_area: cleanLivableFloorArea(areaUnderAir),
    number_of_units_type: null,
    number_of_units: units || (numberOfUnitsStr ? parseInt(numberOfUnitsStr, 10) : null),
    subdivision: safeNullIfEmpty(subdivision),
    zoning: safeNullIfEmpty(zoning),
    property_effective_built_year: effectiveYearStr
      ? parseInt(effectiveYearStr, 10)
      : null,
    historic_designation: false,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Lot.json - with allowed nulls and lot_size_acre
  let lotSizeAcre = null;
  // Prefer embedded model.propertyDetail.Acres
  if (
    model &&
    model.propertyDetail &&
    model.propertyDetail.Acres != null &&
    String(model.propertyDetail.Acres).trim() !== ""
  ) {
    const v = parseFloat(
      String(model.propertyDetail.Acres).replace(/[^0-9.]/g, ""),
    );
    if (!isNaN(v)) lotSizeAcre = v;
  }
  if (lotSizeAcre == null) {
    const acresMatch = inputHTML.match(
      /<td class=\"label\">\s*Acres[\s\S]*?<td class=\"value\">\s*([\d]*\.?\d+)\s*<\/td>/i,
    );
    if (acresMatch) {
      const v = parseFloat(acresMatch[1]);
      if (!isNaN(v)) lotSizeAcre = v;
    }
  }

  // Lot and block from legal description if present
  let lotNo = null,
    block = null;
  if (legalDesc) {
    const lotM =
      legalDesc.match(/\bLT\s*(\d+)/i) || legalDesc.match(/\bLOT\s*(\d+)/i);
    if (lotM) lotNo = lotM[1];
    const blkM =
      legalDesc.match(/\bBLK\s*(\w+)/i) || legalDesc.match(/\bBLOCK\s*(\w+)/i);
    if (blkM) block = blkM[1];
  }

  // Parse Section, Township, Range from Section Map Id (e.g., "05-1S-29-2")
  let section = null,
    township = null,
    range = null;
  const sectionMapMatch = inputHTML.match(
    /<b>Section Map Id:<\/b>[\s\S]*?<a[^>]*>(\d{2}-\d+[NS]-\d+(?:-\d+)?)<\/a>/i
  );
  if (sectionMapMatch) {
    const parts = sectionMapMatch[1].split("-");
    if (parts.length >= 3) {
      section = parts[0]; // "05"
      township = parts[1]; // "1S"
      range = parts[2]; // "29"
    }
  }

  if (
    (!section || !township || !range || !block || !lotNo) &&
    modelDetail &&
    modelDetail.FormattedPCN
  ) {
    const formatted = String(modelDetail.FormattedPCN).trim();
    if (formatted) {
      const parcelParts = formatted.split("-").map((part) => part.trim());
      if (parcelParts.length >= 4) {
        if (!township && parcelParts[1]) township = parcelParts[1];
        if (!range && parcelParts[2]) range = parcelParts[2];
        if (!section && parcelParts[3]) section = parcelParts[3];
      }
      if (!block && parcelParts.length >= 6 && parcelParts[5]) {
        block = parcelParts[5];
      }
      if (!lotNo && parcelParts.length >= 7 && parcelParts[6]) {
        lotNo = parcelParts[6];
      }
    }
  }

  const fullAddrInput = safeNullIfEmpty(unAddr && unAddr.full_address);
  const modelAddressLines = [addressLine1, addressLine2, addressLine3].filter(Boolean);
  const combinedModelAddress = combineAddressLines(modelAddressLines);

  const hasMeaningfulFullAddress = (value) =>
    !!value && /[A-Z]/i.test(value) && /\d/.test(value);

  const locationFullAddressCandidates = [
    safeNullIfEmpty(siteLocationLine),
    safeNullIfEmpty(modelDetail && modelDetail.Location),
    combinedModelAddress,
    fullAddrInput,
  ].filter(Boolean);

  const fullAddr =
    locationFullAddressCandidates.find((candidate) =>
      hasMeaningfulFullAddress(candidate),
    ) || locationFullAddressCandidates[0] || null;

  const unnormalizedAddressCandidate = (() => {
    const prioritized = [
      fullAddrInput,
      locationFullAddressCandidates.find((candidate) =>
        hasMeaningfulFullAddress(candidate),
      ),
      combinedModelAddress,
      siteLocationLine,
      fullAddr,
    ];
    for (const candidate of prioritized) {
      const normalizedCandidate = normalizeWhitespace(candidate);
      if (normalizedCandidate) return normalizedCandidate;
    }
    return null;
  })();

  const tailSegments = [
    fullAddr && fullAddr.includes(",")
      ? fullAddr.split(",").slice(-1).join(" ")
      : fullAddr,
    siteLocationLine,
    combinedModelAddress,
    addressLine3,
    addressLine2,
    addressLine1,
    fullAddrInput,
  ].filter(Boolean);

  const cityStateCandidates = tailSegments.map((segment) =>
    parseCityStatePostal(segment),
  );

  const resolveField = (getter) => {
    for (const candidate of cityStateCandidates) {
      const value = getter(candidate);
      if (value) return value;
    }
    return null;
  };

  const resolvedCity = resolveField((c) => c.city);
  const resolvedState = resolveField((c) => c.state);
  const postalCode = resolveField((c) => c.postal);
  const plus4 = resolveField((c) => c.plus4);

  const countyName = safeNullIfEmpty(
    unAddr && unAddr.county_jurisdiction ? unAddr.county_jurisdiction : null,
  );
  const formattedCountyName = countyName ? titleCaseCounty(countyName) : null;
  const countyInferredStateCode = formattedCountyName ? "FL" : null; // Palm Beach data always targets Florida parcels
  const normalizedMunicipality = municipality
    ? municipality.replace(/\s+/g, " ").trim()
    : null;
  const normalizedCity = (() => {
    if (normalizedMunicipality) {
      const municipalityUpper = normalizedMunicipality.toUpperCase();
      if (!/\d/.test(municipalityUpper)) {
        return municipalityUpper;
      }
      const parsedMunicipality = parseCityStatePostal(normalizedMunicipality);
      if (parsedMunicipality.city) {
        const parsedUpper = parsedMunicipality.city.toUpperCase();
        if (!/\d/.test(parsedUpper)) {
          return parsedUpper;
        }
      }
    }
    if (resolvedCity) {
      const resolvedUpper = resolvedCity.toUpperCase();
      if (!/\d/.test(resolvedUpper)) {
        return resolvedUpper;
      }
    }
    return null;
  })();

  const rawStreetCandidates = [
    siteLocationLine,
    modelDetail && modelDetail.Location,
    addressLine1,
    addressLine2,
    combinedModelAddress,
    fullAddr,
    fullAddrInput,
  ];

  const splitStreetSegments = [];
  for (const candidate of rawStreetCandidates) {
    const cleaned = cleanStreetCandidate(candidate);
    if (cleaned) splitStreetSegments.push(cleaned);
    const raw = safeNullIfEmpty(candidate);
    if (raw && raw.includes(",")) {
      const first = raw.split(",")[0];
      const furtherClean = cleanStreetCandidate(first);
      if (furtherClean) splitStreetSegments.push(furtherClean);
    }
  }

  const streetCandidates = [];
  const seenStreet = new Set();
  for (const candidate of splitStreetSegments) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized) continue;
    const key = normalized.toUpperCase();
    if (
      (normalizedMunicipality &&
        key === normalizedMunicipality.toUpperCase()) ||
      (normalizedCity && key === normalizedCity)
    ) {
      continue;
    }
    if (seenStreet.has(key)) continue;
    seenStreet.add(key);
    streetCandidates.push(normalized);
  }

  const isLikelyStreetLine = (line) => {
    if (!line) return false;
    if (/\d/.test(line)) return true;
    return /\bLOT\b|\bBLK\b|\bBLOCK\b/i.test(line);
  };

  let locationLine = streetCandidates.find((candidate) =>
    isLikelyStreetLine(candidate),
  );
  if (!locationLine && streetCandidates.length) {
    locationLine = streetCandidates[0];
  }

  if (locationLine || normalizedCity || resolvedState || postalCode) {
    const locationLineForParsing = (() => {
      if (!locationLine) return locationLine;
      const firstSegment = locationLine.split(",")[0].trim();
      return firstSegment || locationLine;
    })();
    const parsedAddress = parseLocationAddress(locationLineForParsing);
    const resolvedStateUpper = resolvedState ? resolvedState.toUpperCase() : null;
    const inferredStateCode = countyInferredStateCode || resolvedStateUpper || null;
    const sanitizedPostalCode = sanitizePostalCode(postalCode);
    const sanitizedPlus4 = sanitizePlus4(plus4);
    const stateMismatch =
      countyInferredStateCode &&
      resolvedStateUpper &&
      resolvedStateUpper !== countyInferredStateCode;

    const address = ADDRESS_SCHEMA_FIELDS.reduce((acc, key) => {
      acc[key] = null;
      return acc;
    }, {});

    address.city_name = normalizedCity ? normalizedCity.toUpperCase() : null;
    if (address.city_name && /\d/.test(address.city_name)) {
      address.city_name = null;
    }
    address.county_name = safeNullIfEmpty(formattedCountyName);
    address.latitude = parseCoordinate(unAddr && unAddr.latitude);
    address.longitude = parseCoordinate(unAddr && unAddr.longitude);
    address.plus_four_postal_code = stateMismatch ? null : sanitizedPlus4;
    address.postal_code = stateMismatch ? null : sanitizedPostalCode;
    address.state_code = inferredStateCode;
    address.street_name = (() => {
      if (!parsedAddress.streetName) return null;
      const formatted = safeNullIfEmpty(formatStreetNameCase(parsedAddress.streetName));
      return formatted ? formatted.toUpperCase() : null;
    })();
    address.street_post_directional_text = safeNullIfEmpty(parsedAddress.streetPostDirectional);
    address.street_pre_directional_text = safeNullIfEmpty(parsedAddress.streetPreDirectional);
    address.street_number = safeNullIfEmpty(parsedAddress.streetNumber);
    address.street_suffix_type = safeNullIfEmpty(parsedAddress.streetSuffix);
    address.unit_identifier = safeNullIfEmpty(parsedAddress.unitIdentifier);
    address.route_number = safeNullIfEmpty(parsedAddress.routeNumber);
    if (!address.unit_identifier) {
      const unitFallback = extractUnitIdentifierFromAddressLines([
        addressLine1,
        addressLine2,
        locationLine,
      ]);
      if (unitFallback) address.unit_identifier = unitFallback;
    }
    address.township = safeNullIfEmpty(township);
    address.range = safeNullIfEmpty(range);
    address.section = safeNullIfEmpty(section);
    address.block = safeNullIfEmpty(block);
    address.lot = safeNullIfEmpty(lotNo);
    address.municipality_name = normalizedMunicipality
      ? toTitleCase(normalizedMunicipality)
      : null;
    const baseStreetCandidates = [
      locationLine,
      ...streetCandidates.filter((candidate) => candidate !== locationLine),
    ];
    const streetCandidatesForFallback = baseStreetCandidates
      .map((candidate) => safeNullIfEmpty(candidate))
      .filter(Boolean)
      .map((candidate) => {
        if (candidate.includes(",")) {
          const firstSegment = safeNullIfEmpty(candidate.split(",")[0]);
          return firstSegment || candidate.trim();
        }
        return candidate.trim();
      })
      .filter(
        (candidate, index, self) =>
          candidate && self.indexOf(candidate) === index,
      )
      .filter((candidate) => {
        const parsed = parseLocationAddress(candidate);
        return !!parsed.streetNumber;
      });

    const fallbackPcnSource =
      (modelDetail && modelDetail.FormattedPCN) || pcnHyphen || null;
    const fallbackPostalValue = stateMismatch ? null : sanitizedPostalCode;
    const fallbackPlus4Value = stateMismatch ? null : sanitizedPlus4;

    applyAddressFallbacks(address, {
      streetCandidates: streetCandidatesForFallback,
      fallbackCity: normalizedCity,
      fallbackState: inferredStateCode,
      fallbackPostal: fallbackPostalValue,
      fallbackPlus4: fallbackPlus4Value,
      municipality: normalizedMunicipality,
      county: formattedCountyName,
      formattedPcn: fallbackPcnSource,
      legalDescription: legalDesc,
    });

    const normalizedSnapshot = { ...address };
    const fallbackUnnormalizedValue =
      unnormalizedAddressCandidate || composeUnnormalizedAddress(normalizedSnapshot);

    // Ensure every property is either a trimmed string or null
    for (const key of Object.keys(address)) {
      const value = address[key];
      if (value == null) {
        address[key] = null;
        continue;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        address[key] = trimmed.length ? trimmed : null;
      }
    }

    if (
      !address.country_code &&
      (address.state_code ||
        address.postal_code ||
        (formattedCountyName && formattedCountyName.length))
    ) {
      address.country_code = "US";
    }

    const GRID_FIELD_LENGTHS = {
      section: 2,
      township: 2,
      range: 2,
      block: 3,
      lot: 4,
    };
    for (const [field, length] of Object.entries(GRID_FIELD_LENGTHS)) {
      if (address[field]) {
        address[field] = padGridValue(address[field], length);
      }
    }

    const addressFilePath = path.join(dataDir, "address.json");
    const addressRelationshipPath = path.join(
      dataDir,
      "relationship_property_has_address.json",
    );
    const factSheetRelationshipPath = path.join(
      dataDir,
      "relationship_address_has_fact_sheet.json",
    );

    for (const coordinateField of ADDRESS_REQUIRED_COORDINATE_FIELDS) {
      if (!Number.isFinite(address[coordinateField])) {
        address[coordinateField] = null;
      }
    }

    const trimmedUnnormalized =
      typeof fallbackUnnormalizedValue === "string"
        ? fallbackUnnormalizedValue.trim()
        : "";
    const hasUnnormalizedAddress = trimmedUnnormalized.length > 0;
    const normalizedAddressIsComplete = hasCompleteNormalizedAddress(address);
    const hasNormalizedCoordinates = COORDINATE_ADDRESS_REQUIRED_NUMBERS.every((field) =>
      Number.isFinite(address[field]),
    );

    let finalAddress = null;

    if (normalizedAddressIsComplete) {
      const normalizedAddress = collectAddressFields(
        address,
        NORMALIZED_ADDRESS_FIELDS,
      );
      finalAddress = normalizedAddress;
    } else if (hasUnnormalizedAddress) {
      const rawAddress = buildRawAddressPayload(address, trimmedUnnormalized);
      if (rawAddress && Object.keys(rawAddress).length >= 1) {
        finalAddress = rawAddress;
      }
    } else if (hasNormalizedCoordinates) {
      const coordinateAddress = collectAddressFields(
        address,
        COORDINATE_ADDRESS_REQUIRED_NUMBERS,
      );
      finalAddress = coordinateAddress;
    }

    const propertyFilePath = path.join(dataDir, "property.json");
    const factSheetFilePath = path.join(dataDir, "fact_sheet.json");

    if (finalAddress && Object.keys(finalAddress).length) {
      writeJSON(addressFilePath, finalAddress);

      if (fs.existsSync(propertyFilePath)) {
        writeJSON(addressRelationshipPath, {
          from: null,
          to: null,
        });
      } else if (fs.existsSync(addressRelationshipPath)) {
        fs.unlinkSync(addressRelationshipPath);
      }

      if (fs.existsSync(factSheetFilePath)) {
        writeJSON(factSheetRelationshipPath, {
          from: null,
          to: null,
        });
      } else if (fs.existsSync(factSheetRelationshipPath)) {
        fs.unlinkSync(factSheetRelationshipPath);
      }
    } else {
      // No usable address content, ensure previous outputs are removed
      if (fs.existsSync(addressFilePath)) {
        fs.unlinkSync(addressFilePath);
      }
      if (fs.existsSync(addressRelationshipPath)) {
        fs.unlinkSync(addressRelationshipPath);
      }
      if (fs.existsSync(factSheetRelationshipPath)) {
        fs.unlinkSync(factSheetRelationshipPath);
      }
    }
  }


  // Structure values primarily from model.structuralDetails
  let roofStructureVal = null,
    roofCoverVal = null,
    extWall1Val = null,
    extWall2Val = null,
    intWall1Val = null,
    intWall2Val = null,
    floorType1Val = null,
    floorType2Val = null,
    storiesVal = null,
    foundationVal = null,
    structuralFrameVal = null,
    heatAirVal = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Roof Structure/i.test(name)) roofStructureVal = val;
      if (/Roof Cover/i.test(name)) roofCoverVal = val;
      if (/Exterior Wall 1/i.test(name)) extWall1Val = val;
      if (/Exterior Wall 2/i.test(name)) extWall2Val = val;
      if (/Interior Wall 1/i.test(name)) intWall1Val = val;
      if (/Interior Wall 2/i.test(name)) intWall2Val = val;
      if (/Floor Type 1/i.test(name)) floorType1Val = val;
      if (/Floor Type 2/i.test(name)) floorType2Val = val;
      if (/Stories/i.test(name)) storiesVal = val;
      if (/Foundation/i.test(name)) foundationVal = val;
      if (/Structural Frame/i.test(name)) structuralFrameVal = val;
      if (/Heat\/Air/i.test(name)) heatAirVal = val;
    }
  }
  // Fallback to regex when needed
  if (!roofStructureVal)
    roofStructureVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Structure\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!roofCoverVal)
    roofCoverVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Cover\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall1Val)
    extWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall2Val)
    extWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall1Val)
    intWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall2Val)
    intWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType1Val)
    floorType1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType2Val)
    floorType2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!storiesVal)
    storiesVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Stories\s*<\/td>\s*<td class="value">\s*(\d+)\s*<\/td>/i,
    );
  // Also try from building details patterns
  if (!foundationVal) {
    const mF = inputHTML.match(/<b>FOUNDATION<\/b>-<i>(.*?)<\/i>/i);
    if (mF) foundationVal = mF[1];
  }
  if (!structuralFrameVal) {
    const mSF = inputHTML.match(/<b>STRUCTURAL FRAME<\/b>-<i>(.*?)<\/i>/i);
    if (mSF) structuralFrameVal = mSF[1];
  }
  if (!storiesVal) {
    const mSt = inputHTML.match(/<b>NO\. STORIES<\/b>-<i>(\d+)<\/i>/i);
    if (mSt) storiesVal = mSt[1];
  }
  if (!heatAirVal) {
    const mHA = inputHTML.match(/<b>HEAT\/AIR<\/b>-<i>(.*?)<\/i>/i);
    if (mHA) heatAirVal = mHA[1];
  }

  function mapRoofDesign(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("GABLE") && s.includes("HIP")) return "Combination";
    if (s.includes("GABLE")) return "Gable";
    if (s.includes("HIP")) return "Hip";
    if (s.includes("FLAT")) return "Flat";
    return null;
  }
  function mapRoofCover(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("ASPHALT")) return "3-Tab Asphalt Shingle";
    if (s.includes("METAL")) return "Metal Standing Seam";
    if (s.includes("TILE")) return "Clay Tile";
    return null;
  }
  function mapExteriorWall(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("STUCCO")) return "Stucco";
    if (s.includes("BRICK")) return "Brick";
    if (s.includes("CONCRETE")) return "Concrete Block";
    return "Stucco";
  }
  function mapFlooring(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("CARPET")) return "Carpet";
    if (s.includes("TILE")) return "Ceramic Tile";
    if (s.includes("VINYL")) return "Sheet Vinyl";
    if (s.includes("WOOD")) return "Solid Hardwood";
    return null;
  }
  function mapInteriorWallSurface(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("DRYWALL")) return "Drywall";
    if (s.includes("PLASTER")) return "Plaster";
    return null;
  }
  function mapFoundationType(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("SLAB")) return "Slab";
    if (s.includes("CRAWL")) return "Crawl Space";
    if (s.includes("BASEMENT")) return "Full Basement";
    if (s.includes("PIER")) return "Pier and Beam";
    if (s.includes("PILING")) return "Piling";
    return null;
  }
  function mapFramingMaterial(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("WOOD")) return "Wood";
    if (s.includes("STEEL")) return "Steel";
    if (s.includes("CONCRETE")) return "Concrete";
    if (s.includes("MASONRY")) return "Masonry";
    return null;
  }
  function mapHVACSystem(heatAirValue) {
    // Parse HEAT/AIR field like "WALL/FLOOR FURN" to extract heating and cooling
    if (!heatAirValue) return { heating: null, cooling: null };
    const s = heatAirValue.toUpperCase();

    let heating = null;
    let cooling = null;

    // Heating system mappings
    if (s.includes("CENTRAL") && s.includes("GAS")) heating = "Forced Air";
    else if (s.includes("CENTRAL") || s.includes("FORCED AIR")) heating = "Forced Air";
    else if (s.includes("HEAT PUMP")) heating = "Heat Pump";
    else if (s.includes("ELECTRIC")) heating = "Electric";
    else if (s.includes("WALL") || s.includes("FLOOR") || s.includes("FURN")) heating = "Wall Furnace";
    else if (s.includes("BASEBOARD")) heating = "Electric Baseboard";
    else if (s.includes("RADIANT")) heating = "Radiant";
    else if (s.includes("NONE") || s.includes("NO HEAT")) heating = null;

    // Cooling system mappings
    if (s.includes("CENTRAL") && (s.includes("AIR") || s.includes("A/C") || s.includes("AC"))) cooling = "Central Air";
    else if (s.includes("HEAT PUMP")) cooling = "Heat Pump";
    else if (s.includes("WINDOW") || s.includes("WALL UNIT")) cooling = "Window Unit";
    else if (s.includes("NONE") || s.includes("NO A/C") || s.includes("NO AIR")) cooling = null;
    // If it mentions FURN (furnace) without AC, assume basic heating only
    else if (s.includes("FURN") && !s.includes("AIR") && !s.includes("A/C")) cooling = null;

    return { heating, cooling };
  }

  function mapElementNameToSpaceType(elementName) {
    if (!elementName) return null;
    const name = elementName.toUpperCase();

    // Skip summary elements that shouldn't be individual spaces
    if (
      name.includes("TOTAL SQUARE FOOTAGE") ||
      name.includes("AREA UNDER AIR")
    ) {
      return null; // Don't create layout items for these summary elements
    }

    if (name.includes("FOP") || name.includes("FINISHED OPEN PORCH"))
      return "Open Porch";
    if (name.includes("BAS") || name.includes("BASE AREA"))
      return "Living Area";
    if (name.includes("FGR") || name.includes("FINISHED GARAGE"))
      return "Attached Garage";
    if (name.includes("GARAGE")) return "Attached Garage";
    if (name.includes("PORCH")) return "Open Porch";
    if (name.includes("DECK")) return "Deck";
    if (name.includes("PATIO")) return "Patio";
    if (name.includes("BALCONY")) return "Balcony";
    if (name.includes("LIVING")) return "Living Area";
    if (name.includes("BEDROOM")) return "Bedroom";
    if (name.includes("BATH")) return "Bathroom";
    if (name.includes("KITCHEN")) return "Kitchen";
    if (name.includes("DINING")) return "Dining Room";
    if (name.includes("FAMILY")) return "Family Room";
    if (name.includes("LAUNDRY")) return "Laundry Room";
    if (name.includes("STORAGE")) return "Storage";
    if (name.includes("CLOSET")) return "Closet";
    if (name.includes("UTILITY")) return "Utility Room";
    if (name.includes("MECHANICAL")) return "Mechanical Room";
    if (name.includes("ELECTRICAL")) return "Electrical Room";
    if (name.includes("PLUMBING")) return "Plumbing Room";
    if (name.includes("HVAC")) return "HVAC Room";
    if (name.includes("HEATING")) return "Heating Room";
    if (name.includes("WATER")) return "Water Heater Room";
    if (name.includes("SEWER")) return "Sewer Room";
    if (name.includes("GAS")) return "Gas Room";
    if (name.includes("OTHER")) return "Other";

    return "Other"; // Default fallback
  }

  /**
   * Map Palm Beach Property Use Code to property_usage_type enum.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property usage type from Elephant schema enum
   */
  function mapPropertyUsageType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // RESIDENTIAL (0000-0900)
    if (s.includes("SINGLE FAMILY") || s.includes("DUPLEX") || s.includes("TRIPLEX") ||
        s.includes("MULTI-FAMILY") || s.includes("MOBILE HOME") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("APARTMENT") || s.includes("VACANT RESIDENTIAL") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") || s.includes("MISC RES"))
      return "Residential";

    // RETIREMENT
    if (s.includes("RETIREMENT HOME") || s.includes("HOME FOR THE AGED") || s.includes("NURSING HOME"))
      return "Retirement";

    // RESIDENTIAL COMMON ELEMENTS
    if (s.includes("RESIDENTIAL COMMON AREA") || s.includes("RESIDENTIAL COMMON AREA/ELEMENT"))
      return "ResidentialCommonElementsAreas";

    // COMMERCIAL - Retail
    if (s.includes("STORE") || s.includes("SUPERMARKET") || s.includes("CONVENIENCE STORE"))
      return "RetailStore";
    if (s.includes("DEPARTMENT STORE")) return "DepartmentStore";
    if (s.includes("SHOPPING CENTER, REGIONAL")) return "ShoppingCenterRegional";
    if (s.includes("SHOPPING CENTER, COMMUNITY") || s.includes("SHOPPING CENTER, NEIGHBORHOOD"))
      return "ShoppingCenterCommunity";

    // COMMERCIAL - Office
    if (s.includes("OFFICE BUILDING")) return "OfficeBuilding";
    if (s.includes("MEDICAL OFFICE")) return "MedicalOffice";

    // COMMERCIAL - Transportation
    if (s.includes("AIRPORT") || s.includes("BUS TERMINAL") || s.includes("MARINA"))
      return "TransportationTerminal";

    // COMMERCIAL - Food & Lodging
    if (s.includes("RESTAURANT")) return "Restaurant";
    if (s.includes("HOTEL") || s.includes("MOTEL")) return "Hotel";

    // COMMERCIAL - Financial
    if (s.includes("FINANCIAL INSTITUTION") || s.includes("INSURANCE COMPANY"))
      return "FinancialInstitution";

    // COMMERCIAL - Automotive
    if (s.includes("SERVICE STATION") || s.includes("VEHICLE LUBE")) return "ServiceStation";
    if (s.includes("AUTO SALES") || s.includes("GARAGE, REPAIR")) return "AutoSalesRepair";

    // COMMERCIAL - Entertainment
    if (s.includes("THEATRE") || s.includes("AUDITORIUM") || s.includes("NIGHT CLUB") ||
        s.includes("BAR") || s.includes("BOWLING ALLEY") || s.includes("SKATING") ||
        s.includes("TOURIST ATTRACTION") || s.includes("CAMPS"))
      return "Entertainment";
    if (s.includes("RACE TRACK")) return "RaceTrack";
    if (s.includes("GOLF COURSE")) return "GolfCourse";

    // COMMERCIAL - Other
    if (s.includes("MOBILE HOME PARK")) return "MobileHomePark";
    if (s.includes("WHOLESALER") || s.includes("PRODUCE HOUSE")) return "WholesaleOutlet";
    if (s.includes("PARKING LOT") || s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT"))
      return "Commercial";

    // INDUSTRIAL
    if (s.includes("LIGHT MANUFACTURING")) return "LightManufacturing";
    if (s.includes("HEAVY MANUFACTURING") || s.includes("EXCEPTIONAL INDUSTRIAL"))
      return "HeavyManufacturing";
    if (s.includes("LUMBER YARD")) return "LumberYard";
    if (s.includes("PACKING PLANT")) return "PackingPlant";
    if (s.includes("BOTTLER") || s.includes("FOOD PROCESSING")) return "Cannery";
    if (s.includes("MINERAL PROCESSING")) return "MineralProcessing";
    if (s.includes("WAREHOUSING")) return "Warehouse";
    if (s.includes("OPEN STORAGE") || s.includes("INDUSTRIAL, VACANT")) return "OpenStorage";

    // AGRICULTURAL
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("HAY"))
      return "DrylandCropland";
    if (s.includes("PASTURE")) return "GrazingLand";
    if (s.includes("TIMBER")) return "TimberLand";
    if (s.includes("GROVE") || s.includes("CITRUS") || s.includes("GRAPES")) return "OrchardGroves";
    if (s.includes("FOWL") || s.includes("BEES")) return "Poultry";
    if (s.includes("NURSERY") || s.includes("ORNAMENTAL")) return "Ornamentals";
    if (s.includes("HORSES") || s.includes("SWINE") || s.includes("GOATS") ||
        s.includes("AQUACULTURE") || s.includes("FISH") || s.includes("MISCELLANEOUS AG"))
      return "Agricultural";

    // INSTITUTIONAL - Church & Education
    if (s.includes("CHURCH")) return "Church";
    if (s.includes("SCHOOL, PRIVATE") || s.includes("DAY CARE") || s.includes("DORMITORY"))
      return "PrivateSchool";

    // INSTITUTIONAL - Healthcare
    if (s.includes("HOSPITAL, PRIVATE")) return "PrivateHospital";
    if (s.includes("SANITARIUM")) return "SanitariumConvalescentHome";

    // INSTITUTIONAL - Other
    if (s.includes("ORPHANAGE") || s.includes("MISC") && s.includes("INSTITUTIONAL"))
      return "NonProfitCharity";
    if (s.includes("MORTUARY") || s.includes("FUNERAL HOME") || s.includes("CEMETERY"))
      return "MortuaryCemetery";
    if (s.includes("LODGES") || s.includes("CLUBS") || s.includes("UNION HALLS") ||
        s.includes("YACHTING CLUBS") || s.includes("COUNTRY CLUBS"))
      return "ClubsLodges";
    if (s.includes("CULTURAL FACILITIES") || s.includes("PERFORMING ARTS"))
      return "CulturalOrganization";

    // GOVERNMENTAL
    if (s.includes("MILITARY FACILITY")) return "Military";
    if (s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR"))
      return "ForestParkRecreation";
    if (s.includes("GOVERNMENT OWNED, PUBLIC SCHOOL")) return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, COLLEGE") || s.includes("GOVERNMENT OWNED, UNIVERSITY"))
      return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, HOSPITAL")) return "PublicHospital";
    if (s.includes("COUNTY OWNED") || s.includes("STATE OWNED") ||
        s.includes("FEDERALLY OWNED") || s.includes("MUNICIPALLY OWNED") ||
        s.includes("VACANT GOVERNMENTAL"))
      return "GovernmentProperty";

    // UTILITIES & OTHER
    if (s.includes("UTILITIES") || s.includes("WATERWORKS") || s.includes("CENTRALLY ASSESSED"))
      return "Utility";
    if (s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("BAY BOTTOM"))
      return "RiversLakes";
    if (s.includes("SEWER DISP") || s.includes("SOLID WASTE") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("HAZARDOUS WASTE"))
      return "SewageDisposal";
    if (s.includes("RIGHT OF WAY") || s.includes("RAILROAD")) return "Railroad";

    // CONSERVATION & RECREATIONAL
    if (s.includes("CONSERVATION EASEMENT") || s.includes("MARKET VALUE CONSERVATION") ||
        s.includes("WETLANDS") || s.includes("PRESERVE") || s.includes("RESOURCE PROTECT") ||
        s.includes("ENDANGERED SPECIES") || s.includes("MANGROVE") || s.includes("MARSH LANDS") ||
        s.includes("SWAMP") || s.includes("CYPRESS HEAD"))
      return "Conservation";
    if (s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS"))
      return "Recreational";

    // Generic fallbacks
    if (s.includes("VACANT")) return "TransitionalProperty";

    return null;
  }

  /**
   * Map Palm Beach Property Use Code/description text to property_type.
   * New simplified enum: LandParcel, Building, Unit, ManufacturedHome
   * Handles residential, commercial, industrial, agricultural, institutional, and governmental properties.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property type from Elephant schema enum (LandParcel, Building, Unit, ManufacturedHome)
   */
  function mapPropertyUseCodeToType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // MANUFACTURED HOMES - Mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("RECREATIONAL VEHICLE PARK")) return "ManufacturedHome";

    // UNITS - Individual units within larger structures, condos, co-ops, timeshares, boat slips
    if (s.includes("CONDOMINIUM") || s.includes("CONDO") ||
        s.includes("CO-OPERATIVE") || s.includes("INTERVAL OWNERSHIP") ||
        s.includes("TIME SHARE") || s.includes("BOAT UNITS") ||
        s.includes("BOAT SLIPS") || s.includes("LEASE INTEREST") ||
        s.includes("NO LAND INTEREST")) return "Unit";

    // LAND PARCELS - Vacant land, agricultural, conservation, parking, water bodies, etc.
    if (s.includes("VACANT RESIDENTIAL") || s.includes("VACANT") ||
        s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT") ||
        s.includes("INDUSTRIAL, VACANT") || s.includes("VACANT INSTITUTIONAL") ||
        s.includes("VACANT GOVERNMENTAL")) return "LandParcel";

    // Agricultural land
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("POTATOES") ||
        s.includes("MISCELLANEOUS AG LAND") || s.includes("SOD") ||
        s.includes("TIMBER") || s.includes("PASTURE") || s.includes("GROVE") ||
        s.includes("GRAPES") || s.includes("CITRUS NURSERY") || s.includes("BEES") ||
        s.includes("FOWL") || s.includes("FISH") || s.includes("HORSES") ||
        s.includes("SWINE") || s.includes("GOATS") || s.includes("NURSERY") ||
        s.includes("AQUACULTURE") || s.includes("ACREAGE") ||
        s.includes("MARKET VALUE AGRICULTURAL")) return "LandParcel";

    // Open land and natural features
    if (s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("MINING") || s.includes("PETROLEUM") || s.includes("PHOSPHATE") ||
        s.includes("BOAT RAMPS") || s.includes("RIGHT OF WAY") ||
        s.includes("SUBMERGED") || s.includes("LOW LOT") || s.includes("LAKE") ||
        s.includes("POND") || s.includes("BAY BOTTOM") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("SEWER DISP") ||
        s.includes("SOLID WASTE") || s.includes("HISTORICAL") ||
        s.includes("SLOUGH") || s.includes("INDIAN MOUND") ||
        s.includes("MARSH LANDS") || s.includes("ISLAND") || s.includes("SWAMP") ||
        s.includes("SPOILS EASEMENTS") || s.includes("ENDANGERED SPECIES") ||
        s.includes("MANGROVE") || s.includes("UNBUILDABLE") ||
        s.includes("RESOURCE PROTECT") || s.includes("WETLANDS") ||
        s.includes("PRESERVE") || s.includes("CYPRESS HEAD") ||
        s.includes("HAZARDOUS WASTE") || s.includes("MINERAL RIGHTS") ||
        s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS") ||
        s.includes("MARKET VALUE CONSERVATION") || s.includes("CONSERVATION EASEMENT") ||
        s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR")) return "LandParcel";

    // BUILDINGS - All other structures (residential, commercial, industrial, institutional, governmental)
    // This is the default for most property types with structures
    return "Building";
  }

  // Extract number of buildings from HTML model
  let numberOfBuildings = 1; // Default to 1 building

  // Parse the JavaScript model from HTML to get building count
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (
        modelData.structuralDetails &&
        modelData.structuralDetails.BuildingNumbers &&
        Array.isArray(modelData.structuralDetails.BuildingNumbers)
      ) {
        numberOfBuildings = modelData.structuralDetails.BuildingNumbers.length;
        console.log("Number of buildings extracted:", numberOfBuildings);
      }
    } catch (e) {
      console.log("Error parsing model data for building count:", e.message);
    }
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: extWall1Val
      ? mapExteriorWall(extWall1Val) === "Concrete Block"
        ? "Concrete Block"
        : "Stucco"
      : null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: mapFlooring(floorType1Val),
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: mapInteriorWallSurface(intWall1Val),
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: mapRoofCover(roofCoverVal),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofStructureVal),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: mapFoundationType(foundationVal),
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
    primary_framing_material: mapFramingMaterial(structuralFrameVal),
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: storiesVal ? parseInt(storiesVal, 10) : null,
    number_of_buildings: numberOfBuildings,
    finished_base_area: areaUnderAir ? parseInt(areaUnderAir, 10) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utilities from owners/utilities_data.json or extracted from HTML
  const hvacSystems = mapHVACSystem(heatAirVal);
  let utilityOut = null;
  if (utilitiesData && ownersKey && utilitiesData[ownersKey]) {
    utilityOut = utilitiesData[ownersKey];
    // Override with extracted HVAC data if available
    if (hvacSystems.heating) utilityOut.heating_system_type = hvacSystems.heating;
    if (hvacSystems.cooling) utilityOut.cooling_system_type = hvacSystems.cooling;
  } else {
    utilityOut = {
      cooling_system_type: hvacSystems.cooling,
      heating_system_type: hvacSystems.heating,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
    };
  }
  writeJSON(path.join(dataDir, "utility.json"), utilityOut);

  // Generate layouts from extracted building data or fallback to owners/layout_data.json
  let layoutIdx = 1;

  // First, use extracted building data if available
  // Layout files are now created by the layout mapping script

  const lotOut = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    lot_size_acre: lotSizeAcre != null ? lotSizeAcre : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lotOut);

  // Sales
  const salesFiles = [];
  if (model && Array.isArray(model.salesInfo)) {
    let sIdx = 1;
    for (const s of model.salesInfo) {
      const sale = {
        ownership_transfer_date: toISODate(s.SaleDate),
        purchase_price_amount: s.Price != null ? Number(s.Price) : null,
      };
      const p = path.join(dataDir, `sales_${sIdx}.json`);
      writeJSON(p, sale);
      salesFiles.push({
        index: sIdx,
        date: sale.ownership_transfer_date,
        rawDate: s.SaleDate,
        saleType: s.SaleType,
        Book: s.Book,
        Page: s.Page,
      });
      sIdx++;
    }
  }

  // Files for deed document references (from book/page data)
  const fileIndexBySale = new Map();
  let fileIdx = 1;
  function mapFileDocType(s) {
    if (!s) return "ConveyanceDeed";
    const t = s.toUpperCase();
    if (t.includes("WARRANTY DEED")) return "ConveyanceDeedWarrantyDeed";
    return "ConveyanceDeed";
  }
  for (const s of salesFiles) {
    if (s.Book && s.Page) {
      const book = String(s.Book).trim();
      const page = String(s.Page).trim();
      const fileObj = {
        file_format: "txt",
        name: `OR Book ${book} Page ${page}`,
        document_type: mapFileDocType(s.saleType),
      };
      writeJSON(path.join(dataDir, `file_${fileIdx}.json`), fileObj);
      fileIndexBySale.set(s.index, fileIdx);
      fileIdx++;
    }
  }

  // Deeds: create a deed file for each sale; deed_type only when enum-mappable
  const deedMap = new Map(); // map sales index -> deed index
  let deedIdx = 1;
  for (const s of salesFiles) {
    const dt = mapDeedTypeEnum(s.saleType);
    const deed = {};
    if (dt) deed.deed_type = dt;
    writeJSON(path.join(dataDir, `deed_${deedIdx}.json`), deed);
    deedMap.set(s.index, deedIdx);
    deedIdx++;
  }

  // relationship_deed_file (deed → file)
  let rdfIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    const fIndex = fileIndexBySale.get(sIndex);
    if (!fIndex) continue;
    const rel = {
      from: null,
      to: null,
    };
    writeJSON(path.join(dataDir, `relationship_deed_file_${rdfIdx}.json`), rel);
    rdfIdx++;
  }

  // relationship_sales_deed (sales → deed)
  let relSDIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    const rel = {
      from: null,
      to: null,
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_deed_${relSDIdx}.json`),
      rel,
    );
    relSDIdx++;
  }

  // Extract person and company names using improved classification
  let personIdx = 1;
  let companyIdx = 1;
  let relIdx = 1;
  const processedNames = new Set(); // Track processed names to avoid duplicates

  // Company detection keywords (case-insensitive)
  const companyRegex =
    /(\binc\b|\binc\.|\bllc\b|l\.l\.c\.|\bltd\b|\bltd\.\b|\bfoundation\b|\balliance\b|\bsolutions\b|\bcorp\b|\bcorp\.\b|\bco\b|\bco\.\b|\bcompany\b|\bservices\b|\btrust\b|\btr\b|\bassociates\b|\bpartners\b|\bholdings\b|\bgroup\b|\blp\b|\bpllc\b|\bpc\b|\bbank\b|\bna\b|n\.a\.)/i;

  function parseRawPersonName(raw) {
    const normalized = raw.replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized || !/[a-zA-Z]/.test(normalized)) return null;

    if (normalized.includes(",")) {
      const [lastPart, restPart] = normalized.split(",", 2);
      const restTokens = (restPart || "")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!lastPart || restTokens.length === 0) return null;
      const first = restTokens.shift();
      const middle = restTokens.length ? restTokens.join(" ") : null;
      return { first, last: lastPart, middle };
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;
    const allUpper = tokens.every((t) => t === t.toUpperCase());
    const treatAsLastFirst =
      allUpper ||
      (tokens.slice(0, 2).every((t) => /^[A-Z]+$/.test(t)) &&
        tokens.some((t) => t === t.toUpperCase()));

    if (treatAsLastFirst) {
      const [last, first, ...middleParts] = tokens;
      const middle = middleParts.length ? middleParts.join(" ") : null;
      return { first, last, middle };
    }

    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(" ") || null;
    return { first, last, middle };
  }

  function buildPersonFromRaw(raw) {
    const parsed = parseRawPersonName(raw);
    if (!parsed) return null;
    const firstName = formatNamePart(parsed.first);
    const lastName = formatNamePart(parsed.last);
    if (!firstName || !lastName) return null;
    const middleFormatted = normalizeMiddleName(parsed.middle);
    return {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleFormatted ?? null,
    };
  }

  function classifyRawToOwners(raw) {
    const normalized = raw.replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();

    if (!normalized || !/[a-zA-Z]/.test(normalized)) {
      return { owners: [], invalids: [{ raw, reason: "non_name" }] };
    }

    // Company classification: treat entire string as a single company
    if (companyRegex.test(normalized)) {
      return { owners: [{ type: "company", name: normalized }], invalids: [] };
    }

    // Multi-person split on '&'
    if (normalized.includes("&")) {
      const segments = normalized
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean);
      const owners = [];
      const invalids = [];

      for (const seg of segments) {
        const person = buildPersonFromRaw(seg);
        if (!person) {
          invalids.push({ raw: seg, reason: "unparsed_person" });
          continue;
        }
        owners.push(person);
      }
      return { owners, invalids };
    }

    // Single person path
    const person = buildPersonFromRaw(normalized);
    if (!person) {
      return {
        owners: [],
        invalids: [{ raw: normalized, reason: "unparsed_person" }],
      };
    }
    return { owners: [person], invalids: [] };
  }

  // Extract from sales history
  if (model && Array.isArray(model.salesInfo)) {
    for (let i = 0; i < model.salesInfo.length; i++) {
      const sale = model.salesInfo[i];
      if (sale.OwnerName) {
        const ownerName = sale.OwnerName.trim();
        if (ownerName && !processedNames.has(ownerName)) {
          processedNames.add(ownerName);

          const { owners, invalids } = classifyRawToOwners(ownerName);

          for (const owner of owners) {
            if (owner.type === "company") {
              // Create company record
              const company = {
                name: toTitleCase(owner.name),
              };

              writeJSON(
                path.join(dataDir, `company_${companyIdx}.json`),
                company,
              );

              // Create relationship to sales record
              const rel = {
                to: null,
                from: null,
              };
              writeJSON(
                path.join(dataDir, `relationship_sales_company_${relIdx}.json`),
                rel,
              );
              relIdx++;
              companyIdx++;
            } else {
              // Create person record
              const firstName = formatNamePart(owner.first_name);
              const lastName = formatNamePart(owner.last_name);
              if (!firstName || !lastName) {
                continue;
              }
              const middleName = normalizeMiddleName(owner.middle_name);
              const resolvedMiddleName = middleName ?? null;
              const person = {
                birth_date: null,
                first_name: firstName,
                last_name: lastName,
                middle_name: resolvedMiddleName,
                prefix_name: null,
                suffix_name: null,
                us_citizenship_status: null,
                veteran_status: null,
              };

              writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

              // Create relationship to sales record
              const rel = {
                to: null,
                from: null,
              };
              writeJSON(
                path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
                rel,
              );
              relIdx++;
              personIdx++;
            }
          }
        }
      }
    }
  }

  // Also extract from current owner info if available
  if (model && Array.isArray(model.ownerInfo)) {
    for (const ownerName of model.ownerInfo) {
      if (ownerName && !processedNames.has(ownerName)) {
        processedNames.add(ownerName);

        const { owners, invalids } = classifyRawToOwners(ownerName);

        for (const owner of owners) {
          if (owner.type === "company") {
            // Create company record
            const company = {
              name: toTitleCase(owner.name),
            };

            writeJSON(
              path.join(dataDir, `company_${companyIdx}.json`),
              company,
            );

            // Create relationship from property to company
            const propRel = {
              to: null,
              from: null,
            };
            writeJSON(
              path.join(
                dataDir,
                `relationship_company_${companyIdx}_property.json`,
              ),
              propRel,
            );
            companyIdx++;
          } else {
            // Create person record
            const firstName = formatNamePart(owner.first_name);
            const lastName = formatNamePart(owner.last_name);
            if (!firstName || !lastName) {
              continue;
            }
            const middleName = normalizeMiddleName(owner.middle_name);
            const resolvedMiddleName = middleName ?? null;
            const person = {
              birth_date: null,
              first_name: firstName,
              last_name: lastName,
              middle_name: resolvedMiddleName,
              prefix_name: null,
              suffix_name: null,
              us_citizenship_status: null,
              veteran_status: null,
            };

            writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

            // Create relationship from property to person
            const propRel = {
              to: null,
              from: null,
            };
            writeJSON(
              path.join(
                dataDir,
                `relationship_person_${personIdx}_property.json`,
              ),
              propRel,
            );
            personIdx++;
          }
        }
      }
    }
  }

  // Taxes
  if (model) {
    const assessByYear = new Map();
    const appraiseByYear = new Map();
    const taxByYear = new Map();
    if (Array.isArray(model.assessmentInfo)) {
      for (const a of model.assessmentInfo)
        assessByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.appraisalInfo)) {
      for (const a of model.appraisalInfo)
        appraiseByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.taxInfo)) {
      for (const a of model.taxInfo) taxByYear.set(String(a.TaxYear), a);
    }
    const years = new Set([
      ...assessByYear.keys(),
      ...appraiseByYear.keys(),
      ...taxByYear.keys(),
    ]);
    for (const y of Array.from(years).sort()) {
      const ass = assessByYear.get(y) || {};
      const appr = appraiseByYear.get(y) || {};
      const tax = taxByYear.get(y) || {};
      const landVal = appr.LandValue != null ? Number(appr.LandValue) : null;
      const bldVal =
        appr.ImprovementValue != null ? Number(appr.ImprovementValue) : null;
      const assessed =
        ass.AssessedValue != null ? Number(ass.AssessedValue) : null;
      const market =
        appr.TotalMarketValue != null ? Number(appr.TotalMarketValue) : null;
      const taxable =
        ass.TaxableValue != null ? Number(ass.TaxableValue) : null;
      const yearly =
        tax.TotalTaxValue != null ? Number(tax.TotalTaxValue) : null;
      const taxObj = {
        tax_year: y ? parseInt(y, 10) : null,
        property_assessed_value_amount: assessed,
        property_market_value_amount: market,
        property_building_amount: bldVal,
        property_land_amount: landVal && landVal > 0 ? landVal : null,
        property_taxable_value_amount: taxable,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: yearly,
      };
      writeJSON(path.join(dataDir, `tax_${y}.json`), taxObj);
    }
  }

  // Run mapping scripts to generate additional data files
  console.log("Running owner mapping...");
  require("./ownerMapping.js");

  console.log("Running layout mapping...");
  require("./layoutMapping.js");

  console.log("Running structure mapping...");
  require("./structureMapping.js");

  console.log("Running utility mapping...");
  require("./utilityMapping.js");

  console.log("All mapping scripts completed successfully");
}

main();
