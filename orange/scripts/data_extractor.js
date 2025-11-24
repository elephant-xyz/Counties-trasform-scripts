const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

let INPUT_JSON = null;

// --- Start of original owner_data.js content ---

function normSpace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function extractPropertyId($) {
  let id = null;

  if (INPUT_JSON) {
    const candidates = [];
    const generalProfile = INPUT_JSON.parcelGeneralProfile || {};
    const quickSummary = Array.isArray(INPUT_JSON.parcelQuickSearchSummary)
      ? INPUT_JSON.parcelQuickSearchSummary
      : [];

    if (generalProfile.parcelId) {
      candidates.push(String(generalProfile.parcelId));
    }
    if (generalProfile.altKey) {
      candidates.push(String(generalProfile.altKey));
    }
    quickSummary.forEach((entry) => {
      if (entry && entry.parcelId) {
        candidates.push(String(entry.parcelId));
      }
    });

    for (const candidate of candidates) {
      const trimmed = normSpace(candidate);
      if (trimmed) {
        id = trimmed;
        break;
      }
    }
  }

  if (!id && $) {
    $("tr").each((_, tr) => {
      if (id) return;
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = normSpace($(tds[0]).text());
        if (/^parcel\s*id\s*:$/i.test(label) || /^parcel\s*id\b/i.test(label)) {
          const candidate = normSpace($(tds[1]).text());
          if (candidate) id = candidate;
        }
      }
    });
  }

  if (!id && $) {
    const el = $('*:contains("Parcel ID")')
      .filter((_, e) => /parcel\s*id/i.test($(e).text()))
      .first();
    if (el && el.length) {
      const sib = el.next();
      const candidate = normSpace(sib.text());
      if (candidate) id = candidate;
    }
  }

  if (!id && $) {
    const parcelNumberCell = $(
      'td.property_field:contains("Parcel Number:")',
    ).next("td.property_item");
    if (parcelNumberCell.length) {
      id = normSpace(parcelNumberCell.text());
    }
  }

  if (!id) return "unknown_id";
  id = String(id).replace(/[^A-Za-z0-9_-]+/g, "");
  return id || "unknown_id";
}

// --- UPDATED HELPER FUNCTION ---
const LEGAL_DESIGNATIONS_REGEX = new RegExp(
  "\\b(?:LIFE\\s*EST(?:ATE)?|EST(?:ATE)?|TRUST(?:EE)?|TR(?:USTEE)?|TTEE|REVOCABLE|IRREVOCABLE|EXECUTOR|EXR|ADMINISTRATOR|ADMR|PERSONAL\\s*REPRESENTATIVE|PR|HEIR|HEIRS|DECEASED|DEC'D|DEC|ET\\s*AL|ETAL|JTWROS|TENANTS?\\s*IN\\s*COMMON|TIC|TENANCY\\s*BY\\s*THE\\s*ENTIRETY|TBE|JOINT\\s*TENANTS?|JT|SURVIVOR|SURVIVORS?|AS\\s*TENANTS?\\s*IN\\s*COMMON|AS\\s*JOINT\\s*TENANTS?|AS\\s*COMMUNITY\\s*PROPERTY|AS\\s*SOLE\\s*AND\\s*SEPARATE\\s*PROPERTY|AS\\s*HUSBAND\\s*AND\\s*WIFE|AS\\s*COMMUNITY\\s*PROPERTY\\s*WITH\\s*RIGHT\\s*OF\\s*SURVIVORSHIP|A\\s*SINGLE\\s*MAN|A\\s*SINGLE\\s*WOMAN|A\\s*MARRIED\\s*MAN|A\\s*MARRIED\\s*WOMAN|A\\s*WIDOW|A\\s*WIDOWER|A\\s*PARTNERSHIP|A\\s*CORPORATION|A\\s*LIMITED\\s*LIABILITY\\s*COMPANY|A\\s*TRUST|A\\s*TRUSTEE|A\\s*FIDUCIARY|A\\s*BENEFICIARY|A\\s*GRANTOR|A\\s*GRANTEE|A\\s*DONOR|A\\s*DONEE|A\\s*SETTLOR|A\\s*SETTLEE|A\\s*DEVISEE|A\\s*LEGATEE|A\\s*ASSIGNEE|A\\s*ASSIGNOR|A\\s*MORTGAGEE|A\\s*MORTGAGOR|A\\s*LIENOR|A\\s*LIENEE|A\\s*GRANTOR\\s*TRUST|A\\s*NON-GRANTOR\\s*TRUST|A\\s*QUALIFIED\\s*PERSONAL\\s*RESIDENCE\\s*TRUST|QPRT|A\\s*CHARITABLE\\s*REMAINDER\\s*TRUST|CRT|A\\s*CHARITABLE\\s*LEAD\\s*TRUST|CLT|A\\s*SPECIAL\\s*NEEDS\\s*TRUST|SNT|A\\s*SUPPLEMENTAL\\s*NEEDS\\s*TRUST|SNT|A\\s*BLIND\\s*TRUST|A\\s*SPENDTHRIFT\\s*TRUST|A\\s*GENERATION-SKIPPING\\s*TRUST|GST|A\\s*LAND\\s*TRUST|A\\s*BUSINESS\\s*TRUST|A\\s*REAL\\s*ESTATE\\s*INVESTMENT\\s*TRUST|REIT|A\\s*FAMILY\\s*LIMITED\\s*PARTNERSHIP|FLP|A\\s*LIMITED\\s*LIABILITY\\s*PARTNERSHIP|LLP|A\\s*PROFESSIONAL\\s*CORPORATION|PC|A\\s*PROFESSIONAL\\s*LIMITED\\s*LIABILITY\\s*COMPANY|PLLC|A\\s*NON-PROFIT\\s*CORPORATION|A\\s*RELIGIOUS\\s*CORPORATION|A\\s*EDUCATIONAL\\s*CORPORATION|A\\s*CHARITABLE\\s*CORPORATION|A\\s*PUBLIC\\s*BENEFIT\\s*CORPORATION|A\\s*PRIVATE\\s*FOUNDATION|A\\s*PUBLIC\\s*CHARITY|A\\s*GOVERNMENTAL\\s*ENTITY|A\\s*MUNICIPALITY|A\\s*COUNTY|A\\s*STATE|THE\\s*UNITED\\s*STATES\\s*OF\\s*AMERICA|THE\\s*STATE\\s*OF|THE\\s*COUNTY\\s*OF|THE\\s*CITY\\s*OF|THE\\s*TOWN\\s*OF|THE\\s*VILLAGE\\s*OF|THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*STATE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COUNTY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*CITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*TOWN\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*VILLAGE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR|\\bFBO\\b|\\bIRA\\b\\s*#?\\s*\\d+\\b|\\bSEP\\s*IRA\\b|\\bROTH\\s*IRA\\b|\\b401K\\b|\\b403B\\b|\\bKEOGH\\b|\\bPENSION\\s*PLAN\\b|\\bPROFIT\\s*SHARING\\s*PLAN\\b|\\bRETIREMENT\\s*PLAN\\b)\\b",
  "gi"
);

function stripLegalDesignations(name) {
  let cleanedName = name;
  const removedDesignations = [];
  let match;

  // Create a local, mutable copy of the regex to reset lastIndex
  const localRegex = new RegExp(LEGAL_DESIGNATIONS_REGEX.source, "gi");

  // Use a loop to remove all occurrences and capture them
  while ((match = localRegex.exec(cleanedName)) !== null) {
    removedDesignations.push(match[0].trim());
    cleanedName = cleanedName.replace(match[0], " ").trim();
    localRegex.lastIndex = 0; // Reset for next iteration on the potentially modified string
  }

  // Remove any remaining commas or extra spaces after removal
  cleanedName = cleanedName.replace(/,+/g, " ").replace(/\s{2,}/g, " ").trim();

  return {
    cleanedName: cleanedName,
    removedDesignations: removedDesignations.length > 0 ? removedDesignations : null,
  };
}

const COMPANY_NAME_PREFIXES = [
  "city of",
  "county of",
  "town of",
  "village of",
  "township of",
  "borough of",
  "state of",
  "the city of",
  "the county of",
  "the town of",
  "the village of",
  "the township of",
  "the borough of",
  "the state of",
  "estate of",
  "the estate of",
  "estate of the",
  "trust of",
  "the trust of",
  "board of",
  "board of trustees of",
  "department of",
  "dept of",
  "school district of",
  "the school district of",
  "university of",
  "the university of",
  "college of",
  "church of",
  "temple of",
  "congregation of",
  "diocese of",
  "society of",
  "association of",
];

const COMPANY_NAME_KEYWORD_PATTERNS = [
  ["academy"],
  ["agency"],
  ["alliance"],
  ["association"],
  ["assn"],
  ["ass'n"],
  ["associates"],
  ["associatn"],
  ["authority"],
  ["bank"],
  ["board"],
  ["capital"],
  ["center"],
  ["centre"],
  ["church"],
  ["club"],
  ["commission"],
  ["committee"],
  ["community"],
  ["company"],
  ["companies"],
  ["conservancy"],
  ["cooperative"],
  ["co-op"],
  ["coop"],
  ["corp"],
  ["corporation"],
  ["council"],
  ["credit", "union"],
  ["development"],
  ["district"],
  ["enterprises"],
  ["enterprise"],
  ["estate"],
  ["fbo"],
  ["federal"],
  ["foundation"],
  ["fund"],
  ["government"],
  ["group"],
  ["holdings"],
  ["hospital"],
  ["housing"],
  ["industries"],
  ["institution"],
  ["insurance"],
  ["investments"],
  ["ira"],
  ["joint", "venture"],
  ["laboratories"],
  ["library"],
  ["llc"],
  ["l.l.c"],
  ["llp"],
  ["l.l.p"],
  ["lp"],
  ["l.p"],
  ["ltd"],
  ["limited"],
  ["management"],
  ["medical"],
  ["ministries"],
  ["museum"],
  ["partners"],
  ["partnership"],
  ["park"],
  ["pc"],
  ["p.c"],
  ["plc"],
  ["professional", "corporation"],
  ["properties"],
  ["property"],
  ["realty"],
  ["realtors"],
  ["restoration"],
  ["revocable"],
  ["school"],
  ["services"],
  ["solutions"],
  ["supply"],
  ["survivors"],
  ["ttee"],
  ["trust"],
  ["trustee"],
  ["union"],
  ["university"],
  ["usa"],
];

const ADDRESS_TYPE_KEYWORDS = new Set([
  "road",
  "rd",
  "street",
  "st",
  "avenue",
  "ave",
  "boulevard",
  "blvd",
  "drive",
  "dr",
  "lane",
  "ln",
  "trail",
  "trl",
  "court",
  "ct",
  "circle",
  "cir",
  "highway",
  "hwy",
  "route",
  "rte",
  "way",
  "parkway",
  "pkwy",
  "place",
  "pl",
  "terrace",
  "ter",
  "loop",
  "square",
  "sq",
  "plaza",
  "plz",
]);

const COMPANY_NAME_SUFFIXES = [
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c",
  "llp",
  "l.l.p",
  "lp",
  "l.p",
  "ltd",
  "ltd.",
  "limited",
  "company",
  "companies",
  "co",
  "co.",
  "corp",
  "corp.",
  "corporation",
  "pc",
  "p.c",
  "pllc",
  "plc",
  "partners",
  "partnership",
  "properties",
  "realty",
  "group",
  "holdings",
  "associates",
  "association",
  "trust",
  "trustee",
  "foundation",
  "fund",
  "ministries",
  "church",
  "bank",
  "credit union",
  "federal credit union",
  "authority",
  "agency",
  "board",
  "district",
  "department",
  "development",
  "investments",
  "management",
  "solutions",
  "services",
  "ventures",
  "enterprises",
  "estate",
  "university",
  "college",
  "academy",
  "hospital",
  "medical center",
  "medical centre",
  "clinic",
  "laboratories",
  "library",
  "museum",
  "park",
  "conservancy",
  "council",
];

const COMPANY_SUFFIX_PATTERNS = COMPANY_NAME_SUFFIXES.map((suffix) =>
  suffix
    .split(/\s+/)
    .map((part) => part.replace(/[.,]/g, "").toLowerCase()),
);

const COMPANY_PREFIX_PATTERNS = COMPANY_NAME_PREFIXES.map((prefix) =>
  prefix
    .split(/\s+/)
    .map((part) => part.replace(/[.,]/g, "").toLowerCase()),
);

const COMPANY_KEYWORD_PATTERNS_NORMALIZED = COMPANY_NAME_KEYWORD_PATTERNS.map(
  (pattern) => pattern.map((part) => part.replace(/[.,]/g, "").toLowerCase()),
);

function normalizeCompanyToken(token) {
  return token.replace(/[.,]/g, "").toLowerCase();
}

function tokensStartWithPattern(tokens, pattern) {
  if (pattern.length === 0 || tokens.length < pattern.length) return false;
  for (let i = 0; i < pattern.length; i += 1) {
    if (tokens[i] !== pattern[i]) return false;
  }
  return true;
}

function tokensEndWithPattern(tokens, pattern) {
  if (pattern.length === 0 || tokens.length < pattern.length) return false;
  const startIdx = tokens.length - pattern.length;
  for (let i = 0; i < pattern.length; i += 1) {
    if (tokens[startIdx + i] !== pattern[i]) return false;
  }
  return true;
}

function tokensContainPattern(tokens, pattern) {
  if (pattern.length === 0 || tokens.length < pattern.length) return false;
  for (let i = 0; i <= tokens.length - pattern.length; i += 1) {
    let matches = true;
    for (let j = 0; j < pattern.length; j += 1) {
      if (tokens[i + j] !== pattern[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function isCompanyName(name) {
  const n = (name || "").toLowerCase();

  // Explicit checks for common trust/estate patterns
  if (/\btrustee\s+for\b/i.test(n)) return true;
  if (/\btrust\b/i.test(n) && /\btrustee\b/i.test(n)) return true;
  if (/\b\w+\s+trust\s*$/i.test(n)) return true;
  if (/\bestate\s+of\b/i.test(n)) return true; // e.g., "Estate of John Doe"
  // Added specific check for FBO (For the Benefit Of) as it often indicates a trust or account
  if (/\bfbo\b/i.test(n)) return true;
  // Added specific check for IRA as it's an account type, not a person's name
  if (/\bira\b/i.test(n)) return true;


  const normalizedTokens = n
    .split(/\s+/)
    .map((token) => normalizeCompanyToken(token))
    .filter(Boolean);

  if (normalizedTokens.length === 0) return false;

  const firstToken = normalizedTokens[0] || "";
  if (/^\d+$/.test(firstToken)) return true;

  const hasPoBox =
    normalizedTokens.length >= 2 &&
    normalizedTokens[0] === "po" &&
    normalizedTokens[1] === "box";
  if (hasPoBox) return true;

  const hasAddressType = normalizedTokens.some((token) =>
    ADDRESS_TYPE_KEYWORDS.has(token),
  );
  if (hasAddressType && /\d/.test(n)) return true;

  if (
    COMPANY_PREFIX_PATTERNS.some((pattern) =>
      tokensStartWithPattern(normalizedTokens, pattern),
    )
  ) {
    return true;
  }

  if (
    COMPANY_SUFFIX_PATTERNS.some((pattern) =>
      tokensEndWithPattern(normalizedTokens, pattern),
    )
  ) {
    return true;
  }

  if (
    COMPANY_KEYWORD_PATTERNS_NORMALIZED.some((pattern) =>
      tokensContainPattern(normalizedTokens, pattern),
    )
  ) {
    return true;
  }

  return false;
}

const ALLOWED_PREFIXES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];

const ALLOWED_SUFFIXES = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

function normalizeTokenForLookup(token) {
  return (token || "").replace(/[^A-Za-z]/g, "").toLowerCase();
}

const prefixLookup = new Map(
  ALLOWED_PREFIXES.map((p) => [normalizeTokenForLookup(p), p]),
);
const suffixLookup = new Map(
  ALLOWED_SUFFIXES.map((s) => [normalizeTokenForLookup(s), s]),
);

function toIsoDate(s) {
  if (!s) return null;
  const strRaw = s.trim();
  const str = strRaw.includes("T") ? strRaw.split("T")[0] : strRaw;
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const rxMonth = new RegExp(
    `^(${months.join("|")})\\s+(?:([0-9]{1,2}),\\s*)?([0-9]{4})$`,
    "i",
  );
  m = str.match(rxMonth);
  if (m) {
    const idx = months.findIndex((x) => x === m[1].toLowerCase()) + 1;
    const mm = String(idx).padStart(2, "0");
    const dd = m[2] ? String(parseInt(m[2], 10)).padStart(2, "0") : "01";
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function splitOwnerCandidates(text) {
  const cleaned = (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[|;]+/g, "\n")
    .replace(/\s*\n+\s*/g, "\n")
    .trim();
  const parts = cleaned.split(/\n+/).filter(Boolean);
  const out = [];
  parts.forEach((p) => {
    p.split(/\s+(?:and|AND|And)\s+|\s*&\s*/).forEach((x) => {
      const z = normSpace(x);
      if (z) out.push(z);
    });
  });
  return out;
}

function extractInterestInfo(raw) {
  if (!raw) return null;
  const interestRegex =
    /(\d+)\s*\/\s*(\d+)\s*(?:IN(?:T|TEREST)?\.?)?/i;
  const match = raw.match(interestRegex);
  if (!match) return null;
  const numerator = parseInt(match[1], 10);
  const denominator = parseInt(match[2], 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
    return null;
  const fraction = numerator / denominator;
  const fractionString = `${numerator}/${denominator}`;
  const cleaned = normSpace(raw.replace(match[0], " "));
  return {
    numerator,
    denominator,
    fraction,
    fractionString,
    cleaned,
  };
}

function parsePersonName(raw, contextHint) {
  const original = normSpace(raw);
  if (!original) return null;

  // --- NEW: Strip legal designations before parsing person name ---
  const { cleanedName: nameWithoutDesignations, removedDesignations } = stripLegalDesignations(original);
  const workingName = normSpace(nameWithoutDesignations);
  if (!workingName) return null; // If only designations were present

  const letterRegex = /\p{L}/u;
  const digitRegex = /[0-9]/;
  const isLikelyPersonToken = (token) =>
    letterRegex.test(token || "") && !digitRegex.test(token || "");

  const tryApplyPrefixSuffix = (tokens) => {
    let prefix = null;
    let suffix = null;
    if (tokens.length >= 1) {
      const firstToken = tokens[0];
      const pref = prefixLookup.get(normalizeTokenForLookup(firstToken));
      if (pref) {
        prefix = pref;
        tokens = tokens.slice(1);
      }
    }
    if (tokens.length >= 1) {
      const lastToken = tokens[tokens.length - 1];
      const suff = suffixLookup.get(normalizeTokenForLookup(lastToken));
      if (suff) {
        suffix = suff;
        tokens = tokens.slice(0, -1);
      }
    }
    return { tokens, prefix, suffix };
  };

  if (/,/.test(workingName)) {
    const [last, rest] = workingName.split(",");
    const tokens = normSpace(rest || "")
      .split(/\s+/)
      .filter(Boolean);
    let processed = tryApplyPrefixSuffix(tokens);
    const first = processed.tokens[0] || "";
    const middle = processed.tokens.slice(1).join(" ") || null;
    const normalizedLast = normSpace(last);
    if (first && normalizedLast && isLikelyPersonToken(first) && isLikelyPersonToken(normalizedLast))
      return {
        type: "person",
        first_name: first,
        last_name: normalizedLast,
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        // Store removed designations if any, for debugging or further processing
        _removed_designations: removedDesignations,
      };
    return null;
  }
  const cleaned = workingName
    .replace(/[.,]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const isUpper = cleaned === cleaned.toUpperCase();
  const inOwnerContext = contextHint && /owner/i.test(contextHint);
  if (isUpper && inOwnerContext) {
    let processed = tryApplyPrefixSuffix(tokens);
    if (processed.tokens.length < 2) processed = { ...processed, tokens };
    const last = processed.tokens[0];
    const first = processed.tokens[1] || "";
    const middle = processed.tokens.slice(2).join(" ") || null;
    if (first && last && isLikelyPersonToken(first) && isLikelyPersonToken(last))
      return {
        type: "person",
        first_name: first,
        last_name: last,
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        _removed_designations: removedDesignations,
      };
  }
  let processed = tryApplyPrefixSuffix(tokens);
  if (processed.tokens.length < 2) {
    processed = { ...processed, tokens };
  }
  const first = processed.tokens[0];
  const last = processed.tokens[processed.tokens.length - 1];
  const middle = processed.tokens.slice(1, -1).join(" ") || null;
  if (
    first &&
    last &&
    isLikelyPersonToken(first) &&
    isLikelyPersonToken(last)
  )
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
      prefix_name: processed.prefix || null,
      suffix_name: processed.suffix || null,
      _removed_designations: removedDesignations,
    };
  return null;
}

function ownerNormKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return `company:${normSpace(owner.name || "").toLowerCase()}`;
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .map((x) => normSpace(x || "").toLowerCase())
    .filter(Boolean);
  return `person:${parts.join(" ")}`;
}

function extractOwnerGroups($) {
  const groups = [];
  const seen = new Set();

  const pushGroup = (context, valueText, date = null, isCurrent = false) => {
    if (!valueText) return;
    const normalizedValue = valueText
      .split("\n")
      .map((line) => normSpace(line))
      .filter(Boolean)
      .join("\n");
    if (!normalizedValue) return;
    const key = `${context || ""}::${normalizedValue}::${date || ""}::${isCurrent}`;
    if (seen.has(key)) return;
    seen.add(key);
    groups.push({
      context: context || "Owner",
      valueText: normalizedValue,
      date,
      isCurrent,
    });
  };

  if (INPUT_JSON) {
    const generalProfile = INPUT_JSON.parcelGeneralProfile || {};
    const quickSummary = Array.isArray(INPUT_JSON.parcelQuickSearchSummary)
      ? INPUT_JSON.parcelQuickSearchSummary
      : [];
    const ownerStrings = new Set();

    if (generalProfile.ownerName) {
      ownerStrings.add(normSpace(generalProfile.ownerName));
    }
    if (generalProfile.ownerName2) {
      ownerStrings.add(normSpace(generalProfile.ownerName2));
    }
    quickSummary.forEach((entry) => {
      if (entry && entry.ownerName) {
        ownerStrings.add(normSpace(entry.ownerName));
      }
    });

    if (ownerStrings.size > 0) {
      pushGroup(
        "Current Owner",
        Array.from(ownerStrings).filter(Boolean).join("\n"),
        null,
        true,
      );
    }

    const salesHistory = Array.isArray(INPUT_JSON.parcelSalesHistory)
      ? INPUT_JSON.parcelSalesHistory
      : [];
    salesHistory.forEach((sale, index) => {
      const buyer = sale && sale.buyer ? normSpace(sale.buyer) : "";
      if (!buyer) return;
      const contextParts = ["Buyer"];
      if (sale.deedDesc) contextParts.push(normSpace(sale.deedDesc));
      const context = contextParts.join(" - ");
      const saleDate = sale && sale.saleDate ? toIsoDate(sale.saleDate) : null;
      pushGroup(context, buyer, saleDate, index === 0 && !ownerStrings.size);
    });
  }

  if ($) {
    const labelRx =
      /^(owner\(s\)|owners?|owner\s*name\s*\d*|co-?owner|primary\s*owner|name)\s*:*/i;

    $("tr").each((_, tr) => {
      const tds = $(tr).find("td,th");
      if (tds.length < 2) return;
      const label = normSpace($(tds[0]).text());
      if (!labelRx.test(label)) return;

      const htmlValue = $(tds[1]).html() || "";
      const rawValue = htmlValue
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\u00A0/g, " ");
      const valueText = rawValue.replace(/\s*\n+\s*/g, "\n").trim();
      if (!valueText) return;

      let dateCandidate = null;
      const dateRx =
        /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i;
      const rowText = normSpace($(tr).text());
      let m = rowText.match(dateRx);
      if (m) dateCandidate = toIsoDate(m[1]);
      if (!dateCandidate) {
        const nextRow = $(tr).next("tr");
        if (nextRow && nextRow.length) {
          const rowText2 = normSpace(nextRow.text());
          const m2 = rowText2.match(dateRx);
          if (m2) dateCandidate = toIsoDate(m2[1]);
        }
      }

      pushGroup(label, valueText, dateCandidate, true);
    });

    if (groups.length === 0) {
      $('td:contains("Owners")').each((_, el) => {
        const $el = $(el);
        const label = normSpace($el.text());
        if (!/owners?/i.test(label)) return;
        const tr = $el.closest("tr");
        if (!tr.length) return;
        const tds = tr.find("td");
        if (tds.length >= 2) {
          const valueText = normSpace($(tds[1]).text());
          if (valueText) pushGroup("Owners", valueText, null, true);
        }
      });
    }
  }

  return groups;
}

function parseOwnersFromGroup(valueText, contextHint) {
  const candidates = splitOwnerCandidates(valueText);
  const owners = [];
  const invalid = [];
  let pendingInterest = null;
  let pendingGroupId = null;
  let interestGroupCounter = 0;

  candidates.forEach((raw) => {
    if (!raw || /^none$/i.test(raw)) return;

    const interestInfo = extractInterestInfo(raw);
    let workingText = interestInfo ? interestInfo.cleaned : raw;
    workingText = workingText
      .replace(/\bINT\b\.?/gi, "")
      .replace(/:+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    let owner = null;
    // --- NEW: Check for company name *before* stripping legal designations for person name ---
    // This ensures "JOHN DOE TRUSTEE" is correctly identified as a company/trust if 'TRUSTEE' is a company keyword
    // but "JOHN DOE LIFE EST" is processed as a person "JOHN DOE" with "LIFE EST" stripped.
    if (isCompanyName(workingText)) {
      owner = { type: "company", name: workingText.trim() };
    } else {
      // If not a company, try parsing as a person, which now includes stripping legal designations
      const person = parsePersonName(workingText, contextHint || "");
      if (person && person.first_name && person.last_name) owner = person;
    }

    if (!owner) {
      invalid.push({ raw, reason: "unclassified_or_insufficient_info" });
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    owners.push(owner);

    const lastOwner = owners[owners.length - 1];
    if (!lastOwner) {
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    if (interestInfo) {
      interestGroupCounter += 1;
      pendingInterest = interestInfo;
      pendingGroupId = `group_${interestGroupCounter}`;
      lastOwner.ownership_interest_fraction = interestInfo.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        interestInfo.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (interestInfo.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
    } else if (pendingInterest) {
      lastOwner.ownership_interest_fraction = pendingInterest.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        pendingInterest.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (pendingInterest.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
      pendingInterest = null;
      pendingGroupId = null;
    }
  });

  const uniq = [];
  const seen = new Set();
  for (const o of owners) {
    const key = ownerNormKey(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (o.middle_name === "") o.middle_name = null;
    uniq.push(o);
  }

  return { owners: uniq, invalid };
}

function buildOwnersByDate(groups) {
  const buckets = [];
  let placeholderIdx = 1;
  const globalInvalid = [];

  groups.forEach((g) => {
    const { owners, invalid } = parseOwnersFromGroup(g.valueText, g.context);
    invalid.forEach((inv) => globalInvalid.push(inv));
    if (owners.length === 0) return;
    let key = g.date ? g.date : `unknown_date_${placeholderIdx++}`;
    buckets.push({ key, owners, isCurrent: g.isCurrent });
  });

  // If nothing parsed, return empty skeleton
  if (buckets.length === 0) {
    return { owners_by_date: { current: [] }, invalid_owners: [] };
  }

  // Choose a current bucket (prefer a group marked current, else last)
  let currentOwners = [];
  const currentMarked = buckets.filter((b) => b.isCurrent);
  currentOwners = (
    currentMarked.length
      ? currentMarked[currentMarked.length - 1]
      : buckets[buckets.length - 1]
  ).owners;

  const dated = [];
  buckets.forEach((b) => {
    if (b.owners === currentOwners && !/^\d{4}-\d{2}-\d{2}$/.test(b.key))
      return; // avoid duplicating current unknown
    dated.push({ key: b.key, owners: b.owners });
  });

  const knownDates = dated.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.key));
  const unknowns = dated.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.key));
  knownDates.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const owners_by_date = {};
  unknowns.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  knownDates.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  owners_by_date.current = currentOwners;

  return { owners_by_date, invalid_owners: globalInvalid };
}

// --- End of original owner_data.js content ---
// --- Start of DOR Code Mapping ---
const DOR_CODE_MAP = {
  "00": {
    property_type: "VacantLand",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0003": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: "TownhouseRowhouse",
  },
  "0004": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: "ApartmentUnit",
  },
  "0005": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0011": {
    property_type: "Other",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0040": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "01": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
  },
  "0102": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
  },
  "0103": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "TownhouseRowhouse",
  },
  "02": {
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "ManufacturedHomeOnLand",
  },
  "03": {
    property_type: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyMoreThan10",
  },
  "04": {
    property_type: "Condominium",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Condominium",
    structure_form: "ApartmentUnit",
  },
  "0415": {
    property_type: "Condominium",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Condominium",
    structure_form: "ApartmentUnit",
  },
  "05": {
    property_type: "Cooperative",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Cooperative",
    structure_form: "ApartmentUnit",
  },
  "0500": {
    property_type: "Cooperative",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Cooperative",
    structure_form: "ApartmentUnit",
  },
  "06": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "07": {
    property_type: "MiscellaneousResidential",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "08": {
    property_type: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyLessThan10",
  },
  "09": {
    property_type: "ResidentialCommonElementsAreas",
    property_usage_type: "ResidentialCommonElementsAreas",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "10": {
    property_type: "VacantLand",
    property_usage_type: "Commercial",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "11": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "12": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "13": {
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "14": {
    property_type: "Building",
    property_usage_type: "Supermarket",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "15": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "16": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "17": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "18": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "19": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "20": {
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "21": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "22": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "23": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "24": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "25": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "26": {
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "27": {
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "28": {
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "29": {
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "30": {
    property_type: "Building",
    property_usage_type: "Ornamentals",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "31": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "32": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "33": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "34": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "35": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "36": {
    property_type: "Building",
    property_usage_type: "Recreational",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "37": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "38": {
    property_type: "Building",
    property_usage_type: "GolfCourse",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "39": {
    property_type: "Building",
    property_usage_type: "Hotel",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "40": {
    property_type: "VacantLand",
    property_usage_type: "Industrial",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "41": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "42": {
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "43": {
    property_type: "Building",
    property_usage_type: "LumberYard",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "44": {
    property_type: "Building",
    property_usage_type: "PackingPlant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "45": {
    property_type: "Building",
    property_usage_type: "Cannery",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "46": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "47": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "48": {
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "49": {
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "50": {
    property_type: "Building",
    property_usage_type: "Agricultural",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "51": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "52": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "53": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "54": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "55": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "56": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "57": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "58": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "59": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "60": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "61": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "62": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "63": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "64": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "65": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "66": {
    property_type: "VacantLand",
    property_usage_type: "OrchardGroves",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "67": {
    property_type: "VacantLand",
    property_usage_type: "Poultry",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "68": {
    property_type: "VacantLand",
    property_usage_type: "Agricultural",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "69": {
    property_type: "VacantLand",
    property_usage_type: "Ornamentals",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "70": {
    property_type: "VacantLand",
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "71": {
    property_type: "Building",
    property_usage_type: "Church",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "72": {
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "73": {
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "74": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "75": {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "76": {
    property_type: "Building",
    property_usage_type: "MortuaryCemetery",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "77": {
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "78": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "79": {
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "80": {
    property_type: "VacantLand",
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "81": {
    property_type: "Building",
    property_usage_type: "Military",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "82": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "83": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "84": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "85": {
    property_type: "Building",
    property_usage_type: "PublicHospital",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "86": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "87": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "88": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "89": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "90": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "Leasehold",
    structure_form: null,
  },
  "91": {
    property_type: "LandParcel",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "92": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "93": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
    structure_form: null,
  },
  "94": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
  },
  "95": {
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "96": {
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "97": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9800": {
    property_type: "Other",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9801": {
    property_type: "Building",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9802": {
    property_type: "VacantLand",
    property_usage_type: "TransportationTerminal",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
  },
  "9810": {
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9894": {
    property_type: "LandParcel",
    property_usage_type: "Railroad",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
  },
  "99": {
    property_type: "VacantLand",
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
};

function mapDorCodeToEnums(rawCode) {
  if (!rawCode) return null;
  const digits = String(rawCode).replace(/[^\d]/g, "");
  if (!digits) return null;

  const attempts = [];
  for (let len = digits.length; len >= 2; len--) {
    attempts.push(digits.slice(0, len));
  }
  if (digits.length >= 2) {
    attempts.push(digits.slice(0, 2));
  }

  for (const key of attempts) {
    if (DOR_CODE_MAP[key]) return DOR_CODE_MAP[key];
  }

  return null;
}
// --- End of DOR Code Mapping ---


// --- Start of original main.js content ---

const missingDorCodes = new Set();

const PROPERTY_TYPE_ENUM = new Set([
  "Cooperative",
  "Condominium",
  "Modular",
  "ManufacturedHousingMultiWide",
  "Pud",
  "Timeshare",
  "2Units",
  "DetachedCondominium",
  "Duplex",
  "SingleFamily",
  "MultipleFamily",
  "3Units",
  "ManufacturedHousing",
  "ManufacturedHousingSingleWide",
  "4Units",
  "Townhouse",
  "NonWarrantableCondo",
  "VacantLand",
  "Retirement",
  "MiscellaneousResidential",
  "ResidentialCommonElementsAreas",
  "MobileHome",
  "Apartment",
  "MultiFamilyMoreThan10",
  "MultiFamilyLessThan10",
  "LandParcel",
  "Building",
  "Unit",
  "ManufacturedHome",
]);
const PROPERTY_TYPE_ALIASES = {
  LandParcel: "LandParcel",
  VacantLand: "VacantLand",
  ManufacturedHome: "ManufacturedHome",
  ManufacturedHousing: "ManufacturedHousing",
  ManufacturedHousingMultiWide: "ManufacturedHousingMultiWide",
  ManufacturedHousingSingleWide: "ManufacturedHousingSingleWide",
  ManufacturedHomeOnLand: "ManufacturedHome",
  ManufacturedHomeInPark: "ManufacturedHome",
  ManufacturedHousingOnLand: "ManufacturedHome",
  ManufacturedHousingInPark: "ManufacturedHome",
  MobileHome: "MobileHome",
  Apartment: "Apartment",
  Building: "Building",
  Unit: "Unit",
  SingleFamily: "SingleFamily",
  MultiFamilyMoreThan10: "MultiFamilyMoreThan10",
  MultiFamilyLessThan10: "MultiFamilyLessThan10",
  MultipleFamily: "MultipleFamily",
  "2Units": "2Units",
  Duplex: "Duplex",
  "3Units": "3Units",
  "4Units": "4Units",
  DetachedCondominium: "DetachedCondominium",
  Condominium: "Condominium",
  NonWarrantableCondo: "NonWarrantableCondo",
  Townhouse: "Townhouse",
  Cooperative: "Cooperative",
  Modular: "Modular",
  Pud: "Pud",
  Timeshare: "Timeshare",
  Retirement: "Retirement",
  MiscellaneousResidential: "MiscellaneousResidential",
  MiscResidential: "MiscellaneousResidential",
  ResidentialCommonElementsAreas: "ResidentialCommonElementsAreas",
  ResidentialCommonElements: "ResidentialCommonElementsAreas",
  MobileHomePark: "MobileHome",
  ManufacturedHousingMultiwide: "ManufacturedHousingMultiWide",
  ManufacturedHousingSinglewide: "ManufacturedHousingSingleWide",
  Other: "Building",
  GeneralBuilding: "Building",
};
const PROPERTY_USAGE_VALUES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Agricultural",
  "Recreational",
  "Conservation",
  "Retirement",
  "ResidentialCommonElementsAreas",
  "DrylandCropland",
  "HayMeadow",
  "CroplandClass2",
  "CroplandClass3",
  "TimberLand",
  "GrazingLand",
  "OrchardGroves",
  "Poultry",
  "Ornamentals",
  "Church",
  "PrivateSchool",
  "PrivateHospital",
  "HomesForAged",
  "NonProfitCharity",
  "MortuaryCemetery",
  "ClubsLodges",
  "SanitariumConvalescentHome",
  "CulturalOrganization",
  "Military",
  "ForestParkRecreation",
  "PublicSchool",
  "PublicHospital",
  "GovernmentProperty",
  "RetailStore",
  "DepartmentStore",
  "Supermarket",
  "ShoppingCenterRegional",
  "ShoppingCenterCommunity",
  "OfficeBuilding",
  "MedicalOffice",
  "TransportationTerminal",
  "Restaurant",
  "FinancialInstitution",
  "ServiceStation",
  "AutoSalesRepair",
  "MobileHomePark",
  "WholesaleOutlet",
  "Theater",
  "Entertainment",
  "Hotel",
  "RaceTrack",
  "GolfCourse",
  "LightManufacturing",
  "HeavyManufacturing",
  "LumberYard",
  "PackingPlant",
  "Cannery",
  "MineralProcessing",
  "Warehouse",
  "OpenStorage",
  "Utility",
  "RiversLakes",
  "SewageDisposal",
  "Railroad",
  "TransitionalProperty",
  "ReferenceParcel",
  "NurseryGreenhouse",
  "AgriculturalPackingFacility",
  "LivestockFacility",
  "Aquaculture",
  "VineyardWinery",
  "DataCenter",
  "TelecommunicationsFacility",
  "SolarFarm",
  "WindFarm",
  "NativePasture",
  "ImprovedPasture",
  "Rangeland",
  "PastureWithTimber",
  "Unknown",
];
const PROPERTY_USAGE_ENUM = new Set(PROPERTY_USAGE_VALUES);
const PROPERTY_USAGE_ALIASES = {
  PlannedUnitDevelopment: "Residential",
  MiscellaneousResidential: "Residential",
  CollegeUniversity: "PublicSchool",
};
const STRUCTURE_FORM_ENUM = new Set([
  "SingleFamilyDetached",
  "SingleFamilySemiDetached",
  "TownhouseRowhouse",
  "Duplex",
  "Triplex",
  "Quadplex",
  "MultiFamily5Plus",
  "ApartmentUnit",
  "Loft",
  "ManufacturedHomeOnLand",
  "ManufacturedHomeInPark",
  "MultiFamilyMoreThan10",
  "MultiFamilyLessThan10",
  "MobileHome",
  "ManufacturedHousingMultiWide",
  "ManufacturedHousing",
  "ManufacturedHousingSingleWide",
  "Modular",
]);
const OWNERSHIP_ESTATE_ENUM = new Set([
  "Condominium",
  "Cooperative",
  "LifeEstate",
  "Timeshare",
  "OtherEstate",
  "FeeSimple",
  "Leasehold",
  "RightOfWay",
  "NonWarrantableCondo",
  "SubsurfaceRights",
]);
const BUILD_STATUS_ENUM = new Set(["VacantLand", "Improved", "UnderConstruction"]);
const NUMBER_OF_UNITS_TYPE_ENUM = new Set([
  "One",
  "Two",
  "Three",
  "Four",
  "OneToFour",
  "TwoToFour",
]);
const EXTERIOR_WALL_MATERIAL_ENUM = new Set([
  "Brick",
  "Natural Stone",
  "Manufactured Stone",
  "Stucco",
  "Vinyl Siding",
  "Wood Siding",
  "Fiber Cement Siding",
  "Metal Siding",
  "Concrete Block",
  "EIFS",
  "Log",
  "Adobe",
  "Precast Concrete",
  "Curtain Wall",
]);
const PRIMARY_FRAMING_MATERIAL_ENUM = new Set([
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
  "Poured Concrete",
  "Masonry",
  "Engineered Lumber",
  "Post and Beam",
  "Log Construction",
]);
const FILE_DOCUMENT_TYPE_ENUM = new Set([
  "Title",
  "ConveyanceDeedQuitClaimDeed",
  "ConveyanceDeedBargainAndSaleDeed",
  "ConveyanceDeedWarrantyDeed",
  "ConveyanceDeed",
  "AssignmentAssignmentOfDeedOfTrust",
  "AssignmentAssignmentOfMortgage",
  "AssignmentAssignmentOfRents",
  "Assignment",
  "AssignmentAssignmentOfTrade",
  "AssignmentBlanketAssignment",
  "AssignmentCooperativeAssignmentOfProprietaryLease",
  "AffidavitOfDeath",
  "AbstractOfJudgment",
  "AttorneyInFactAffidavit",
  "ArticlesOfIncorporation",
  "BuildingPermit",
  "ComplianceInspectionReport",
  "ConditionalCommitment",
  "CounselingCertification",
  "AirportNoisePollutionAgreement",
  "BreachNotice",
  "BrokerPriceOpinion",
  "AmendatoryClause",
  "AssuranceOfCompletion",
  "Bid",
  "BuildersCertificationBuilderCertificationOfPlansAndSpecifications",
  "BuildersCertificationBuildersCertificate",
  "BuildersCertificationPropertyInspection",
  "BuildersCertificationTermiteTreatment",
  "PropertyImage",
]);
const DEED_TYPE_ENUM = new Set([
  "Warranty Deed",
  "Special Warranty Deed",
  "Quitclaim Deed",
  "Grant Deed",
  "Bargain and Sale Deed",
  "Lady Bird Deed",
  "Transfer on Death Deed",
  "Sheriff's Deed",
  "Tax Deed",
  "Trustee's Deed",
  "Personal Representative Deed",
  "Correction Deed",
  "Deed in Lieu of Foreclosure",
  "Life Estate Deed",
  "Joint Tenancy Deed",
  "Tenancy in Common Deed",
  "Community Property Deed",
  "Gift Deed",
  "Interspousal Transfer Deed",
  "Wild Deed",
  "Special Master’s Deed",
  "Court Order Deed",
  "Contract for Deed",
  "Quiet Title Deed",
  "Administrator's Deed",
  "Guardian's Deed",
  "Receiver's Deed",
  "Right of Way Deed",
  "Vacation of Plat Deed",
  "Assignment of Contract",
  "Release of Contract",
  "Miscellaneous",
]);
const PROPERTY_IMPROVEMENT_TYPE_ENUM = new Set([
  "GeneralBuilding",
  "ResidentialConstruction",
  "CommercialConstruction",
  "BuildingAddition",
  "StructureMove",
  "Demolition",
  "PoolSpaInstallation",
  "Electrical",
  "MechanicalHVAC",
  "GasInstallation",
  "Roofing",
  "Fencing",
  "DockAndShore",
  "FireProtectionSystem",
  "Plumbing",
  "ExteriorOpeningsAndFinishes",
  "MobileHomeRV",
  "LandscapeIrrigation",
  "ScreenEnclosure",
  "ShutterAwning",
  "SiteDevelopment",
  "CodeViolation",
  "Complaint",
  "ContractorLicense",
  "Sponsorship",
  "StateLicenseRegistration",
  "AdministrativeApproval",
  "AdministrativeAppeal",
  "BlueSheetHearing",
  "PlannedDevelopment",
  "DevelopmentOfRegionalImpact",
  "Rezoning",
  "SpecialExceptionZoning",
  "Variance",
  "ZoningExtension",
  "ZoningVerificationLetter",
  "RequestForRelief",
  "WaiverRequest",
  "InformalMeeting",
  "EnvironmentalMonitoring",
  "Vacation",
  "VegetationRemoval",
  "ComprehensivePlanAmendment",
  "MinimumUseDetermination",
  "TransferDevelopmentRightsDetermination",
  "MapBoundaryDetermination",
  "TransferDevelopmentRightsCertificate",
  "UniformCommunityDevelopment",
  "SpecialCertificateOfAppropriateness",
  "CertificateToDig",
  "HistoricDesignation",
  "PlanningAdministrativeAppeal",
  "WellPermit",
  "TestBoring",
  "ExistingWellInspection",
  "NaturalResourcesComplaint",
  "NaturalResourcesViolation",
  "LetterWaterSewer",
  "UtilitiesConnection",
  "DrivewayPermit",
  "RightOfWayPermit",
]);
const IMPROVEMENT_ALIAS_MAP = {
  Pool: "PoolSpaInstallation",
  PoolDeck: "PoolSpaInstallation",
  PoolHeater: "PoolSpaInstallation",
  ScreenEnclosure: "ScreenEnclosure",
  BoatHouse: "DockAndShore",
  Dock: "DockAndShore",
  Seawall: "DockAndShore",
  Paving: "SiteDevelopment",
  Fence: "Fencing",
  HotTub: "PoolSpaInstallation",
  HVAC: "MechanicalHVAC",
  Carport: "BuildingAddition",
  DetachedGarage: "BuildingAddition",
  Garage: "BuildingAddition",
  Deck: "BuildingAddition",
  Porch: "BuildingAddition",
  Patio: "SiteDevelopment",
  Canopy: "ExteriorOpeningsAndFinishes",
  Wall: "SiteDevelopment",
  Barn: "GeneralBuilding",
  Shed: "GeneralBuilding",
  Greenhouse: "GeneralBuilding",
  ParkingLotLighting: "SiteDevelopment",
  FuelPump: "MechanicalHVAC",
  Elevator: "GeneralBuilding",
  RetainingWall: "SiteDevelopment",
  RecreationCourt: "SiteDevelopment",
  TennisCourt: "SiteDevelopment",
  StorageTank: "SiteDevelopment",
  Silo: "GeneralBuilding",
  Tower: "GeneralBuilding",
};
const PROPERTY_USAGE_UNKNOWN = "Unknown";

function ensureEnum(value, allowedSet) {
  if (value == null) return null;
  return allowedSet.has(value) ? value : null;
}

function coercePropertyType(value, context = {}) {
  const { buildStatus = null, units = null, structureForm = null } = context;
  if (value) {
    const normalized = PROPERTY_TYPE_ALIASES[value] || value;
    if (PROPERTY_TYPE_ENUM.has(normalized)) return normalized;
  }
  if (buildStatus === "VacantLand") return "VacantLand";
  if (structureForm) {
    if (
      structureForm === "ManufacturedHousingMultiWide" ||
      structureForm === "ManufacturedHousingSingleWide" ||
      structureForm === "ManufacturedHousing"
    ) {
      return structureForm;
    }
    if (
      structureForm === "ManufacturedHomeOnLand" ||
      structureForm === "ManufacturedHomeInPark"
    ) {
      return "ManufacturedHome";
    }
  }
  if (Number.isFinite(units) && units > 0) return "Building";
  if (buildStatus === "Improved") return "Building";
  return null;
}

function coercePropertyUsageType(value) {
  if (value == null) return null;
  const alias = PROPERTY_USAGE_ALIASES[value] || value;
  if (PROPERTY_USAGE_ENUM.has(alias)) return alias;
  return PROPERTY_USAGE_ENUM.has(PROPERTY_USAGE_UNKNOWN)
    ? PROPERTY_USAGE_UNKNOWN
    : null;
}

function coerceStructureForm(value) {
  return ensureEnum(value, STRUCTURE_FORM_ENUM);
}

function coerceOwnershipEstateType(value) {
  return ensureEnum(value, OWNERSHIP_ESTATE_ENUM);
}

function coerceBuildStatus(value) {
  return ensureEnum(value, BUILD_STATUS_ENUM);
}

function coerceNumberOfUnitsType(value) {
  if (value == null) return null;
  return NUMBER_OF_UNITS_TYPE_ENUM.has(value) ? value : null;
}

function coerceExteriorWallMaterial(value) {
  return ensureEnum(value, EXTERIOR_WALL_MATERIAL_ENUM);
}

function coercePrimaryFramingMaterial(value) {
  return ensureEnum(value, PRIMARY_FRAMING_MATERIAL_ENUM);
}

function coerceDeedType(value) {
  if (value == null) return null;
  if (DEED_TYPE_ENUM.has(value)) return value;
  return "Miscellaneous";
}

function coerceImprovementType(label) {
  if (!label) return null;
  if (PROPERTY_IMPROVEMENT_TYPE_ENUM.has(label)) return label;
  const mapped = IMPROVEMENT_ALIAS_MAP[label] || null;
  if (mapped && PROPERTY_IMPROVEMENT_TYPE_ENUM.has(mapped)) return mapped;
  return null;
}

function coerceImprovementStatus(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const upper = cleaned.toUpperCase();
  const directMap = {
    COMPLETED: "Completed",
    COMPLETE: "Completed",
    "FINAL APPROVED": "Completed",
    FINAL: "Completed",
    CLOSED: "Completed",
    ISSUED: "Permitted",
    PERMITTED: "Permitted",
    "PERMIT ISSUED": "Permitted",
    APPROVED: "Permitted",
    ACTIVE: "InProgress",
    "IN PROGRESS": "InProgress",
    OPEN: "InProgress",
    STARTED: "InProgress",
    APPLIED: "Planned",
    "APPLICATION RECEIVED": "Planned",
    "UNDER REVIEW": "Planned",
    PENDING: "Planned",
    REVIEW: "Planned",
    HOLD: "OnHold",
    "ON HOLD": "OnHold",
    STOPPED: "OnHold",
    CANCELLED: "Cancelled",
    CANCELED: "Cancelled",
    VOID: "Cancelled",
    WITHDRAWN: "Cancelled",
    DENIED: "Cancelled",
    EXPIRED: "Cancelled",
  };
  if (directMap[upper]) return directMap[upper];

  const contains = (kw) => upper.includes(kw);
  if (contains("COMPLETE") || contains("FINAL") || contains("CLOSE")) {
    return "Completed";
  }
  if (contains("ISSUE") || contains("PERMIT") || contains("APPROVED")) {
    return "Permitted";
  }
  if (contains("PROGRESS") || contains("ACTIVE") || contains("OPEN")) {
    return "InProgress";
  }
  if (contains("PENDING") || contains("APPLY") || contains("REVIEW") || contains("PLAN")) {
    return "Planned";
  }
  if (contains("HOLD") || contains("STOP")) {
    return "OnHold";
  }
  if (contains("VOID") || contains("CANCEL") || contains("WITHDRAW") || contains("DENY") || contains("EXPIRE")) {
    return "Cancelled";
  }
  return null;
}

function coerceFileDocumentType(value) {
  if (value && FILE_DOCUMENT_TYPE_ENUM.has(value)) return value;
  return "Title";
}

function mapFileDocumentType(raw) {
  const value = (raw || "").trim();
  if (!value) return "Title";
  const upper = value.toUpperCase();

  const contains = (needle) => upper.includes(needle.toUpperCase());

  if (contains("QUIT")) return "ConveyanceDeedQuitClaimDeed";
  if (contains("BARGAIN") || contains("SALE DEED"))
    return "ConveyanceDeedBargainAndSaleDeed";
  if (contains("WARRANTY")) return "ConveyanceDeedWarrantyDeed";
  if (contains("DEED")) return "ConveyanceDeed";

  if (contains("ASSIGN")) {
    if (contains("DEED OF TRUST"))
      return "AssignmentAssignmentOfDeedOfTrust";
    if (contains("MORTGAGE")) return "AssignmentAssignmentOfMortgage";
    if (contains("RENTS")) return "AssignmentAssignmentOfRents";
    if (contains("TRADE")) return "AssignmentAssignmentOfTrade";
    if (contains("BLANKET")) return "AssignmentBlanketAssignment";
    if (contains("PROPRIETARY LEASE") || contains("CO-OP"))
      return "AssignmentCooperativeAssignmentOfProprietaryLease";
    return "Assignment";
  }

  if (contains("AFFIDAVIT OF DEATH")) return "AffidavitOfDeath";
  if (contains("ABSTRACT OF JUDGMENT")) return "AbstractOfJudgment";
  if (contains("ATTORNEY IN FACT")) return "AttorneyInFactAffidavit";
  if (contains("ARTICLES OF INCORPORATION")) return "ArticlesOfIncorporation";
  if (contains("BUILDING PERMIT")) return "BuildingPermit";
  if (contains("COMPLIANCE INSPECTION"))
    return "ComplianceInspectionReport";
  if (contains("CONDITIONAL COMMITMENT")) return "ConditionalCommitment";
  if (contains("COUNSELING CERTIFICATION"))
    return "CounselingCertification";
  if (contains("AIRPORT NOISE") || contains("POLLUTION AGREEMENT"))
    return "AirportNoisePollutionAgreement";
  if (contains("BREACH NOTICE")) return "BreachNotice";
  if (contains("BROKER PRICE")) return "BrokerPriceOpinion";
  if (contains("AMENDATORY CLAUSE")) return "AmendatoryClause";
  if (contains("ASSURANCE OF COMPLETION")) return "AssuranceOfCompletion";
  if (contains("BID")) return "Bid";
  if (
    contains("BUILDER") &&
    contains("CERTIFICATION") &&
    contains("PLANS")
  )
    return "BuildersCertificationBuilderCertificationOfPlansAndSpecifications";
  if (
    contains("BUILDER") &&
    contains("CERTIFICATE") &&
    !contains("PLANS")
  )
    return "BuildersCertificationBuildersCertificate";
  if (contains("PROPERTY INSPECTION"))
    return "BuildersCertificationPropertyInspection";
  if (contains("TERMITE")) return "BuildersCertificationTermiteTreatment";
  if (contains("IMAGE")) return "PropertyImage";

  return "Title";
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) fs.unlinkSync(path.join(p, f));
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function textNormalize(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value == null) return null;
  const clean = String(value).replace(/[^0-9.\-]/g, "");
  if (!clean) return null;
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

function toInt(value) {
  const num = toNumber(value);
  if (num == null) return null;
  const intVal = Math.round(num);
  return Number.isFinite(intVal) ? intVal : null;
}

function parseCurrency(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? Number(n.toFixed(2)) : null;
}
function toISODate(mdY) {
  if (!mdY) return null;
  const trimmed = String(mdY).trim();
  let match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    let [, mm, dd, yyyy] = match;
    mm = mm.padStart(2, "0");
    dd = dd.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    let [, mm, dd, yy] = match;
    const year = parseInt(yy, 10);
    const yyyy = year >= 70 ? 1900 + year : 2000 + year;
    mm = mm.padStart(2, "0");
    dd = dd.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}
function properCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mapLandUseToPropertyType(landUseDescription) {
  if (!landUseDescription) return null;

  const desc = landUseDescription.toUpperCase();

  // Map Lake County land use descriptions to property types (fallback)
  if (desc.includes("VACANT")) return "VacantLand";
  if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
  if (desc.includes("MANUFACTURED HOME")) return "ManufacturedHome";
  if (
    desc.includes("MULTI FAMILY >9") ||
    desc.includes("MULTI FAMILY >=10") ||
    desc.includes("MULTI FAMILY 10")
  )
    return "MultiFamilyMoreThan10";
  if (
    desc.includes("MULTI FAMILY <5") ||
    desc.includes("MULTI FAMILY >4 AND <10") ||
    desc.includes("MULTI FAMILY <=9")
  )
    return "MultiFamilyLessThan10";
  if (desc.includes("CONDOMINIUM") || desc.includes("CONDO"))
    return "Condominium";
  if (desc.includes("CO-OP")) return "Cooperative";
  if (desc.includes("RETIREMENT")) return "Retirement";
  if (desc.includes("MISC RESIDENTIAL") || desc.includes("MIGRANT"))
    return "MiscellaneousResidential";
  if (
    desc.includes("RESIDENTIAL COMMON ELEMENTS") ||
    desc.includes("COMMON ELEMENTS")
  )
    return "ResidentialCommonElementsAreas";

  // Default to null for non-residential or unrecognized codes
  return null;
}

function normalizeDeedType(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  const upper = value.toUpperCase();
  const patterns = [
    { regex: /DEED\s+IN\s+LIEU/i, type: "Deed in Lieu of Foreclosure" },
    { regex: /SPECIAL\s+MASTER/i, type: "Special Master’s Deed" },
    { regex: /SPECIAL\s+WARRANTY/i, type: "Special Warranty Deed" },
    { regex: /QUIT/i, type: "Quitclaim Deed" },
    { regex: /\bGRANT\b/i, type: "Grant Deed" },
    { regex: /WARRANTY/i, type: "Warranty Deed" },
    { regex: /LADY\s*BIRD/i, type: "Lady Bird Deed" },
    { regex: /TRANSFER\s+ON\s+DEATH|TOD\s+DEED/i, type: "Transfer on Death Deed" },
    { regex: /SHERIFF/i, type: "Sheriff's Deed" },
    { regex: /\bTAX\b/i, type: "Tax Deed" },
    { regex: /TRUSTEE/i, type: "Trustee's Deed" },
    {
      regex: /PERSONAL\s+REPRESENTATIVE/i,
      type: "Personal Representative Deed",
    },
    { regex: /ADMINISTRATOR/i, type: "Administrator's Deed" },
    { regex: /GUARDIAN/i, type: "Guardian's Deed" },
    { regex: /RECEIVER/i, type: "Receiver's Deed" },
    { regex: /COURT/i, type: "Court Order Deed" },
    { regex: /BARGAIN/i, type: "Bargain and Sale Deed" },
    { regex: /LIFE\s+ESTATE/i, type: "Life Estate Deed" },
    { regex: /JOINT\s+TENANCY/i, type: "Joint Tenancy Deed" },
    { regex: /TENANCY\s+IN\s+COMMON/i, type: "Tenancy in Common Deed" },
    { regex: /COMMUNITY\s+PROPERTY/i, type: "Community Property Deed" },
    { regex: /\bGIFT\b/i, type: "Gift Deed" },
    { regex: /INTERSPOUSAL/i, type: "Interspousal Transfer Deed" },
    { regex: /\bWILD\b/i, type: "Wild Deed" },
    { regex: /CONTRACT\s+FOR\s+DEED|AGREEMENT\s+FOR\s+DEED/i, type: "Contract for Deed" },
    { regex: /QUIET\s+TITLE/i, type: "Quiet Title Deed" },
    { regex: /RIGHT\s+OF\s+WAY/i, type: "Right of Way Deed" },
    { regex: /VACATION\s+OF\s+PLAT/i, type: "Vacation of Plat Deed" },
    { regex: /ASSIGNMENT.*CONTRACT/i, type: "Assignment of Contract" },
    { regex: /RELEASE.*CONTRACT/i, type: "Release of Contract" },
    { regex: /CORRECT/i, type: "Correction Deed" },
  ];

  for (const { regex, type } of patterns) {
    if (regex.test(upper)) {
      return coerceDeedType(type);
    }
  }

  return coerceDeedType(value);
}

function mapMiscImprovementType(code, description) {
  const baseCode = (code || "").replace(/[^A-Z]/g, "");
  const descUpper = (description || "").toUpperCase();
  const keywordMatch = (kw) => descUpper.includes(kw);
  const candidates = [];

  const push = (label) => {
    if (label) candidates.push(label);
  };

  switch (baseCode) {
    case "POL":
      push("Pool");
      break;
    case "PLD":
      push("PoolDeck");
      break;
    case "PLH":
      push("PoolHeater");
      break;
    case "SEN":
      push("ScreenEnclosure");
      break;
    case "BHS":
      push("BoatHouse");
      break;
    case "DOC":
      push("Dock");
      break;
    case "SEW":
      push("Seawall");
      break;
    case "PAV":
      push("Paving");
      break;
    case "FEN":
      push("Fence");
      break;
    case "HTB":
      push("HotTub");
      break;
    case "HAC":
    case "AIR":
      push("HVAC");
      break;
    case "UCP":
    case "CPU":
    case "CPF":
      push("Carport");
      break;
    case "DGF":
      push("DetachedGarage");
      break;
    case "GRH":
      push("Greenhouse");
      break;
    case "PFL":
      push("ParkingLotLighting");
      break;
    case "PIL":
      push("FuelPump");
      break;
    case "REL":
      push("Elevator");
      break;
    case "RTN":
      push("RetainingWall");
      break;
    case "SBC":
      push("RecreationCourt");
      break;
    case "SLO":
      push("Silo");
      break;
    case "TCT":
      push("TennisCourt");
      break;
    case "TKS":
    case "TNK":
      push("StorageTank");
      break;
    case "TWR":
    case "TVT":
      push("Tower");
      break;
    case "CPT":
    case "CPT2":
      push("Carport");
      break;
    case "FPL":
    case "FPL2":
    case "FPL3":
      push("Fireplace");
      break;
    case "PT":
    case "PT1":
    case "PT2":
      push("Patio");
      break;
    case "PL":
    case "PL2":
      push("Pool");
      break;
    case "WLDC":
      push("Deck");
      break;
    case "GRNH":
      push("Greenhouse");
      break;
    default:
      break;
  }

  if (keywordMatch("POOL") && keywordMatch("SCREEN")) push("ScreenEnclosure");
  else if (keywordMatch("POOL")) push("Pool");
  if (keywordMatch("DECK")) push("Deck");
  if (keywordMatch("PORCH")) push("Porch");
  if (keywordMatch("FENCE")) push("Fence");
  if (keywordMatch("DOCK")) push("Dock");
  if (keywordMatch("BOAT")) push("BoatHouse");
  if (keywordMatch("SEAWALL")) push("Seawall");
  if (keywordMatch("BARN")) push("Barn");
  if (keywordMatch("SHED")) push("Shed");
  if (keywordMatch("CANOPY")) push("Canopy");
  if (keywordMatch("PATIO")) push("Patio");
  if (keywordMatch("WALL")) push("Wall");

  const cleaned = (description || baseCode || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (cleaned) {
    const cleanedLabel = cleaned
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
    push(cleanedLabel);
  }

  for (const label of candidates) {
    const mapped = coerceImprovementType(label);
    if (mapped) return mapped;
  }

  if (candidates.length > 0) {
    const fallback = coerceImprovementType("GeneralBuilding");
    if (fallback) return fallback;
  }

  return null;
}

function interpretExteriorMaterials(rawText) {
  if (!rawText) {
    return { primary: null, secondary: null, framing: null };
  }
  const text = normSpace(String(rawText)).toUpperCase();
  const has = (kw) => text.indexOf(kw) !== -1;
  let primary = null;
  let secondary = null;
  let framing = null;

  if (has("CBS") || has("CONCRETE") || has("C.B.") || has("BLOCK") || has("CONC")) {
    framing = "Concrete Block";
  }

  if (has("STUCCO")) primary = "Stucco";
  if (!primary && has("VINYL") && has("SIDING")) primary = "Vinyl Siding";
  if (!primary && has("WOOD") && has("SIDING")) primary = "Wood Siding";
  if (!primary && has("FIBER") && has("CEMENT")) primary = "Fiber Cement Siding";
  if (!primary && has("BRICK")) primary = "Brick";
  if (!primary && (has("BLOCK") || has("CONCRETE") || has("CBS")))
    primary = "Concrete Block";

  if (has("BRICK") && primary !== "Brick") secondary = "Brick Accent";
  if (
    !secondary &&
    (has("BLOCK") || has("CONCRETE") || has("CBS")) &&
    primary !== "Concrete Block"
  ) {
    secondary = "Decorative Block";
  }
  if (!secondary && has("STUCCO") && primary !== "Stucco") {
    secondary = "Stucco Accent";
  }

  return {
    primary,
    secondary: secondary || null,
    framing: framing || null,
  };
}

function getUnitsType(units) {
  if (!units || units === 1) return "One";
  if (units === 2) return "Two";
  if (units === 3) return "Three";
  if (units === 4) return "Four";
  if (units >= 2 && units <= 4) return "TwoToFour";
  if (units >= 1 && units <= 4) return "OneToFour";
  return null;
}

function extractHtmlString(value, visited = new Set()) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      if (/<html[^>]*>/i.test(trimmed)) return trimmed;
      if (/<body[^>]*>/i.test(trimmed)) return `<html>${trimmed}</html>`;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  if (visited.has(value)) return null;
  visited.add(value);

  const priorityKeys = [
    "html",
    "inputHtml",
    "input_html",
    "propertyHtml",
    "property_html",
    "pageHtml",
    "page_html",
    "rawHtml",
    "raw_html",
    "sourceHtml",
    "source_html",
  ];

  if (!Array.isArray(value)) {
    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const res = extractHtmlString(value[key], visited);
        if (res) return res;
      }
    }
    for (const val of Object.values(value)) {
      const res = extractHtmlString(val, visited);
      if (res) return res;
    }
  } else {
    for (const item of value) {
      const res = extractHtmlString(item, visited);
      if (res) return res;
    }
  }
  return null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  clearDir(dataDir);

  // Inputs
  let inputHtml = "";
  const htmlPath = "input.html";
  const jsonPath = "input.json";

  if (fs.existsSync(jsonPath)) {
    try {
      const parsed = readJSON(jsonPath);
      INPUT_JSON = parsed;
      const htmlFromJson = extractHtmlString(parsed);
      if (typeof htmlFromJson === "string" && htmlFromJson.trim()) {
        inputHtml = htmlFromJson;
      }
    } catch (err) {
      console.warn(
        "Unable to parse input.json, proceeding without JSON:",
        err.message || err,
      );
      INPUT_JSON = null;
    }
  }

  if (!inputHtml && fs.existsSync(htmlPath)) {
    inputHtml = readText(htmlPath);
  }

  if (!inputHtml || typeof inputHtml !== "string") {
    inputHtml = "<html></html>";
  }

  if (!INPUT_JSON) {
    console.warn(
      "No input.json found or unreadable; falling back to HTML parsing only.",
    );
  }

  const addrSeed = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

  // Owner-related JSON sources
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  // --- owner_data.js specific logic to generate owner_data.json ---
  const $forOwners = cheerio.load(inputHtml);
  const propertyIdRaw = extractPropertyId($forOwners);
  const altKey =
    (propSeed &&
      propSeed.source_http_request &&
      propSeed.source_http_request.multiValueQueryString &&
      propSeed.source_http_request.multiValueQueryString.AltKey &&
      propSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    (addrSeed &&
      addrSeed.source_http_request &&
      addrSeed.source_http_request.multiValueQueryString &&
      addrSeed.source_http_request.multiValueQueryString.AltKey &&
      addrSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    null;
  let propertyKey = `property_${propertyIdRaw}`;
  if (
    (!propertyIdRaw || propertyIdRaw === "unknown_id") &&
    altKey &&
    String(altKey).trim()
  ) {
    propertyKey = `property_${String(altKey).trim()}`;
  }

  console.log("Property Key derived from input.html:", propertyKey); // DEBUG LOG

  const groups = extractOwnerGroups($forOwners);
  console.log("Extracted owner groups from input.html:", JSON.stringify(groups, null, 2)); // DEBUG LOG

  const { owners_by_date, invalid_owners } = buildOwnersByDate(groups);
  console.log("Owners by date generated from input.html:", JSON.stringify(owners_by_date, null, 2)); // DEBUG LOG

  const ownerResult = {};
  ownerResult[propertyKey] = {
    owners_by_date,
    invalid_owners: invalid_owners || [],
  };

  const outDirOwners = path.join(process.cwd(), "owners");
  const outFileOwners = path.join(outDirOwners, "owner_data.json");
  if (!fs.existsSync(outDirOwners)) fs.mkdirSync(outDirOwners, { recursive: true });
  fs.writeFileSync(outFileOwners, JSON.stringify(ownerResult, null, 2), "utf8");
  console.log("Generated owners/owner_data.json with content:", JSON.stringify(ownerResult, null, 2)); // DEBUG LOG
  // --- End of owner_data.js specific logic ---


  let ownerData = fs.existsSync(ownerPath) ? readJSON(ownerPath) : ownerResult;
  console.log("OwnerData used for processing:", JSON.stringify(ownerData, null, 2)); // DEBUG LOG

  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const resolveRecordForKey = (dataMap, desiredKey) => {
    if (!dataMap || typeof dataMap !== "object") return null;
    if (desiredKey && dataMap[desiredKey]) return dataMap[desiredKey];
    const keys = Object.keys(dataMap);
    if (keys.length === 1) return dataMap[keys[0]];
    if (desiredKey && dataMap.property_unknown) return dataMap.property_unknown;
    if (desiredKey) {
      const normalizeKey = (k) => (k || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const matchedKey = keys.find((key) => normalizeKey(key) === normalizeKey(desiredKey));
      if (matchedKey) return dataMap[matchedKey];
    }
    return null;
  };

  // HTML parsing
  let $ = null;
  // if (cheerio) { // Cheerio is always available now
    $ = cheerio.load(inputHtml);
  // }

  // Helper: find cell by label in General Information table
  function extractGeneral() {
    const result = {};

    if (INPUT_JSON) {
      const generalProfile = INPUT_JSON.parcelGeneralProfile || {};
      if (generalProfile.parcelId) {
        result.parcelNumber = String(generalProfile.parcelId).trim();
      }
      const streetNumber =
        generalProfile.streetNumber &&
        Number(generalProfile.streetNumber) !== 0
          ? String(generalProfile.streetNumber).trim()
          : "";
      const propertyAddress = normSpace(
        generalProfile.propertyAddress || generalProfile.streetName || "",
      );
      let locationLine = propertyAddress;
      if (streetNumber) {
        locationLine = `${streetNumber} ${propertyAddress}`.trim();
      }
      if (!locationLine && generalProfile.streetName) {
        locationLine = normSpace(generalProfile.streetName);
      }
      const city = normSpace(generalProfile.propertyCity || "");
      const state = normSpace(generalProfile.propertyState || "");
      const zip = normSpace(generalProfile.propertyZip || "");
      const locationParts = [];
      if (locationLine) locationParts.push(locationLine);
      const cityState = [city, state].filter(Boolean).join(", ");
      if (cityState) locationParts.push(cityState);
      if (zip) locationParts.push(zip);
      if (locationParts.length) {
        result.propertyLocationRaw = locationParts.join(", ");
      }

      // const mailingLines = [];
      // const mailingLine1 = normSpace(generalProfile.mailAddress || "");
      // const mailingCity = normSpace(generalProfile.mailCity || "");
      // const mailingState = normSpace(generalProfile.mailState || "");
      // const mailingZip = normSpace(generalProfile.mailZip || "");
      // if (mailingLine1) mailingLines.push(mailingLine1);
      // const mailingLine2Parts = [];
      // if (mailingCity) mailingLine2Parts.push(mailingCity);
      // if (mailingState) mailingLine2Parts.push(mailingState);
      // let mailingLine2 = mailingLine2Parts.join(", ");
      // if (mailingZip) {
      //   mailingLine2 = mailingLine2
      //     ? `${mailingLine2} ${mailingZip}`
      //     : mailingZip;
      // }
      // if (mailingLine2) mailingLines.push(mailingLine2);
      // if (mailingLines.length) {
      //   result.mailingAddressLines = mailingLines;
      // }

      if (
        INPUT_JSON.parcelLegalDescription &&
        INPUT_JSON.parcelLegalDescription.propertyDescription
      ) {
        result.legalDescription = normSpace(
          INPUT_JSON.parcelLegalDescription.propertyDescription,
        );
      } else if (generalProfile.propertyDescription) {
        result.legalDescription = normSpace(generalProfile.propertyDescription);
      }
    }

    if ($ && (!result.parcelNumber || !result.propertyLocationRaw)) {
      const rows = $("table.property_head").first().find("tr");
      rows.each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 4) {
          const label = $(tds[2]).text().trim();
          const val = $(tds[3]).text().trim();
          if (!result.parcelNumber && /Parcel Number/i.test(label)) {
            result.parcelNumber = val || result.parcelNumber || null;
          }
        }
      });

      rows.each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim();
          if (!result.mailingAddressLines && /Mailing Address:?/i.test(label)) {
            const cellHtml = $(tds[1]).html() || "";
            const cleanedHtml = cellHtml.replace(
              /<span[^>]*>[\s\S]*?<\/span>/gi,
              "",
            );
            const lines = cleanedHtml
              .split(/<br\s*\/?>/i)
              .map((line) =>
                line
                  .replace(/<[^>]+>/g, "")
                  .replace(/\s+/g, " ")
                  .trim(),
              )
              .filter(
                (line) =>
                  line &&
                  !/update mailing address/i.test(line) &&
                  line !== "/>",
              );
            if (lines.length) result.mailingAddressLines = lines;
          }
        }
      });

      rows.each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 4 && !result.propertyLocationRaw) {
          const label = $(tds[0]).text().trim();
          if (/Property Location:/i.test(label)) {
            const addrHtml = $(tds[1]).html() || "";
            const addrText = addrHtml
              .replace(/<br\s*\/?>(?=\s*|$)/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .trim();
            if (addrText) result.propertyLocationRaw = addrText;
          }
        }
      });

      rows.each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2 && !result.legalDescription) {
          const label = $(tds[0]).text().trim();
          if (/Property Description:/i.test(label)) {
            result.legalDescription = $(tds[1]).text().trim() || null;
          }
        }
      });
    }

    return result;
  }

  function extractPropertyTypeFromLandData() {
    let landUseDescription = null;
    let units = null;
    const landUseCodes = new Set();

    if (INPUT_JSON) {
      const generalProfile = INPUT_JSON.parcelGeneralProfile || {};
      if (generalProfile.dorCode) {
        landUseCodes.add(String(generalProfile.dorCode));
      }
      if (generalProfile.dorDescription) {
        landUseDescription = normSpace(generalProfile.dorDescription);
      }

      const landFeatures = Array.isArray(INPUT_JSON.parcelLandFeatures)
        ? INPUT_JSON.parcelLandFeatures
        : [];
      landFeatures.forEach((feature) => {
        if (!feature) return;
        if (feature.landDorCode) {
          landUseCodes.add(String(feature.landDorCode));
        }
        if (!landUseDescription && feature.descShort) {
          landUseDescription = normSpace(feature.descShort);
        }
        if (
          units == null &&
          feature.landQtyCode &&
          /unit/i.test(String(feature.landQtyCode))
        ) {
          const parsedUnits = parseFloat(String(feature.landQty).replace(/,/g, ""));
          if (!Number.isNaN(parsedUnits)) {
            units = parsedUnits % 1 === 0 ? parsedUnits : null;
          }
        }
      });

      const buildingFeatures = Array.isArray(INPUT_JSON.parcelBuildingFeatures)
        ? INPUT_JSON.parcelBuildingFeatures
        : [];
      buildingFeatures.forEach((feature) => {
        if (feature && feature.bldgDorCode) {
          landUseCodes.add(String(feature.bldgDorCode));
        }
        if (feature && feature.units && units == null) {
          const parsedUnits = parseFloat(String(feature.units).replace(/,/g, ""));
          if (!Number.isNaN(parsedUnits)) {
            units = parsedUnits % 1 === 0 ? parsedUnits : null;
          }
        }
      });
    }

    if ($) {
      $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const landUseText = $(tds[1]).text().trim();
          if (landUseText) {
            landUseDescription = landUseDescription || landUseText.toUpperCase();
            const codeMatch = landUseText.match(/\((\d{2,6})\)/);
            if (codeMatch) {
              const code = codeMatch[1];
              if (code) landUseCodes.add(code);
            }
          }
        }
        if (tds.length >= 7 && units == null) {
          const typeText = $(tds[6]).text().trim().toUpperCase();
          if (!/UNIT/.test(typeText)) return;
          const unitText = $(tds[5]).text().trim();
          const parsedUnits = parseFloat(unitText.replace(/,/g, ""));
          if (!Number.isNaN(parsedUnits)) {
            units = parsedUnits % 1 === 0 ? parsedUnits : null;
          }
        }
      });

      $("table.property_building_summary td").each((i, td) => {
        if (units != null) return;
        const text = $(td).text().trim();
        const unitMatch = text.match(/Units:\s*(\d+)/i);
        if (unitMatch) {
          units = parseInt(unitMatch[1], 10);
        }
      });
    }

    const propertyType = mapLandUseToPropertyType(landUseDescription);

    return {
      propertyType,
      units,
      landUseCodes: Array.from(landUseCodes),
      landUseDescription,
    };
  }

  // Extract Living Area, Year Built, Building/Land Values, Sales, and derive structure hints
  function extractBuildingAndValues() {
    const out = {
      yearBuilt: null,
      livingArea: null,
      buildingValue: null,
      landValue: null,
      assessedValue: null,
      taxableValue: null,
      marketValue: null,
      taxYear: null,
      sales: [],
      structure: {
        number_of_stories: null,
        exterior_wall_material_primary: null,
        exterior_wall_material_secondary: null,
        primary_framing_material: null,
      },
    };

    if (INPUT_JSON) {
      const buildingFeatures = Array.isArray(INPUT_JSON.parcelBuildingFeatures)
        ? INPUT_JSON.parcelBuildingFeatures
        : [];
      const primaryBuilding = buildingFeatures.find(Boolean) || null;
      if (primaryBuilding) {
        if (primaryBuilding.dateBuilt) {
          const rawBuilt = String(primaryBuilding.dateBuilt);
          const builtDate = rawBuilt.includes("T")
            ? rawBuilt.split("T")[0]
            : rawBuilt;
          const normalizedBuilt = toIsoDate(builtDate);
          if (normalizedBuilt) {
            const year = parseInt(normalizedBuilt.slice(0, 4), 10);
            if (Number.isFinite(year)) out.yearBuilt = year;
          }
        }
        const livingAreaNum = parseFloat(primaryBuilding.livingArea);
        if (Number.isFinite(livingAreaNum) && livingAreaNum > 0) {
          out.livingArea = livingAreaNum;
        }
        if (
          primaryBuilding.bldgValue != null &&
          Number(primaryBuilding.bldgValue) >= 0
        ) {
          out.buildingValue = parseCurrency(primaryBuilding.bldgValue);
        }
        if (primaryBuilding.floors != null) {
          const floors = parseFloat(primaryBuilding.floors);
          if (Number.isFinite(floors)) {
            out.structure.number_of_stories = Math.round(floors);
          }
        }
        if (primaryBuilding.extWall) {
          const inferred = interpretExteriorMaterials(primaryBuilding.extWall);
          if (inferred) {
            if (
              inferred.primary &&
              !out.structure.exterior_wall_material_primary
            ) {
              out.structure.exterior_wall_material_primary = inferred.primary;
            }
            if (
              inferred.secondary &&
              !out.structure.exterior_wall_material_secondary
            ) {
              out.structure.exterior_wall_material_secondary =
                inferred.secondary;
            }
            if (
              inferred.framing &&
              !out.structure.primary_framing_material
            ) {
              out.structure.primary_framing_material = inferred.framing;
            }
          }
        }
      }

      const valuationRows = Array.isArray(INPUT_JSON.parcelPropertyValuesByYear)
        ? INPUT_JSON.parcelPropertyValuesByYear.filter(Boolean)
        : [];
      valuationRows.sort((a, b) => {
        const ta = a && a.taxYear ? Number(a.taxYear) : 0;
        const tb = b && b.taxYear ? Number(b.taxYear) : 0;
        return tb - ta;
      });
      const currentValuation =
        valuationRows.find((row) => row && row.showFlag === 1) ||
        valuationRows.find((row) => row && row.isCertified) ||
        valuationRows[0] ||
        null;
      if (currentValuation) {
        if (currentValuation.taxYear && !out.taxYear) {
          const taxYear = Number(currentValuation.taxYear);
          if (Number.isFinite(taxYear)) out.taxYear = taxYear;
        }
        if (currentValuation.marketValue != null && out.marketValue == null) {
          out.marketValue = parseCurrency(currentValuation.marketValue);
        }
        if (currentValuation.assessedValue != null && out.assessedValue == null) {
          out.assessedValue = parseCurrency(currentValuation.assessedValue);
        }
        if (currentValuation.landValue != null && out.landValue == null) {
          out.landValue = parseCurrency(currentValuation.landValue);
        }
        if (
          currentValuation.buildingValue != null &&
          out.buildingValue == null
        ) {
          const bVal = parseCurrency(currentValuation.buildingValue);
          if (bVal != null) out.buildingValue = bVal;
        }
        if (currentValuation.taxValue != null && out.taxableValue == null) {
          out.taxableValue = parseCurrency(currentValuation.taxValue);
        } else if (
          out.taxableValue == null &&
          currentValuation.assessedValue != null
        ) {
          out.taxableValue = parseCurrency(currentValuation.assessedValue);
        }
      }

      const valuationStats = INPUT_JSON.parcelValuationStats || {};
      if (valuationStats.taxYear && !out.taxYear) {
        const taxYear = Number(valuationStats.taxYear);
        if (Number.isFinite(taxYear)) out.taxYear = taxYear;
      }
      if (valuationStats.assessedValue != null && out.assessedValue == null) {
        out.assessedValue = parseCurrency(valuationStats.assessedValue);
        if (out.taxableValue == null) {
          out.taxableValue = parseCurrency(valuationStats.assessedValue);
        }
      }
      if (valuationStats.marketValue != null && out.marketValue == null) {
        out.marketValue = parseCurrency(valuationStats.marketValue);
      }

      const totalTaxes = Array.isArray(INPUT_JSON.parcelTotalTaxesSummary)
        ? INPUT_JSON.parcelTotalTaxesSummary
        : [];
      if (!out.taxYear && totalTaxes.length) {
        const taxYear = totalTaxes[0] && totalTaxes[0].taxYear;
        if (taxYear) {
          const yr = Number(taxYear);
          if (Number.isFinite(yr)) out.taxYear = yr;
        }
      }
    }

    // Summary table with Year Built and Total Living Area
    $("table.property_building_summary td").each((i, td) => {
      const t = $(td).text().replace(/\s+/g, " ").trim();
      let m;
      if (out.yearBuilt == null) {
        m = t.match(/Year Built:\s*(\d{4})/i);
        if (m) out.yearBuilt = parseInt(m[1], 10);
      }
      if (out.livingArea == null) {
        m = t.match(/Total Living Area:\s*([0-9,\.]+)/i);
        if (m) out.livingArea = parseFloat(m[1].replace(/[,]/g, "").trim());
      }
    });

    // Building Value
    $("div.property_building table")
      .first()
      .find("tr")
      .first()
      .find("td")
      .each((i, td) => {
        if (out.buildingValue != null) return;
        const text = $(td).text();
        const m = text.match(/Building Value:\s*\$([0-9,\.]+)/i);
        if (m) out.buildingValue = parseCurrency(m[1]);
      });

    // Land Value (from Land Data table)
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 9 && out.landValue == null) {
        const lv = $(tds[8]).text();
        const parsed = parseCurrency(lv);
        if (parsed != null) out.landValue = parsed;
      }
    });

    // Tax values
    const estRows = $("#cphMain_gvEstTax tr").toArray();
    if (estRows.length > 1) {
      // First data row after header
      const tds = $(estRows[1]).find("td");
      if (tds.length >= 6) {
        if (out.marketValue == null) {
          const market = $(tds[1]).text();
          out.marketValue = parseCurrency(market);
        }
        if (out.assessedValue == null) {
          const assessed = $(tds[2]).text();
          out.assessedValue = parseCurrency(assessed);
        }
        if (out.taxableValue == null) {
          const taxable = $(tds[3]).text();
          out.taxableValue = parseCurrency(taxable);
        }
      }
    }

    // Tax year from the red note text or globally from HTML
    if (!out.taxYear) {
      let noteText = "";
      $("div.red").each((i, el) => {
        noteText += $(el).text() + " ";
      });
      let mYear = noteText.match(
        /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
      );
      if (!mYear)
        mYear = inputHtml.match(
          /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
        );
      if (mYear) out.taxYear = parseInt(mYear[1], 10);
    }

    // Enhanced Sales History: capture book/page, instrument, qualification, and pricing
    // Prioritize sales data from INPUT_JSON if available
    if (
      INPUT_JSON &&
      Array.isArray(INPUT_JSON.parcelSalesHistory) &&
      INPUT_JSON.parcelSalesHistory.length
    ) {
      INPUT_JSON.parcelSalesHistory.forEach((sale) => {
        if (!sale) return;
        const saleDateISO = toIsoDate(String(sale.saleDate || ""));
        const saleRecord = {
          sale_date: saleDateISO,
          ownership_transfer_date: saleDateISO,
          sale_price: parseCurrency(sale.saleAmt),
          instrument: sale.deedDesc || null,
          qualified: null, // Not directly available in this JSON structure
          improvement_status: sale.vacImpCode || null,
          book: sale.book || null,
          page: sale.page || null,
          volume: null, // Not directly available in this JSON structure
          instrument_number: sale.instrNum || null,
          document_url: null, // Not directly available in this JSON structure
          document_name: null, // Can be constructed if needed
          buyer: sale.buyer ? normSpace(sale.buyer) : null, // Add buyer information
          seller: sale.seller ? normSpace(sale.seller) : null, // Add seller information for future use
        };
        const hasMeaningfulData =
          saleRecord.sale_date ||
          (saleRecord.sale_price != null && !Number.isNaN(saleRecord.sale_price)) ||
          saleRecord.instrument ||
          saleRecord.book ||
          saleRecord.page ||
          saleRecord.buyer;
        if (hasMeaningfulData) {
          out.sales.push(saleRecord);
        }
      });
    } else {
      // Fallback to HTML parsing if no JSON sales data
      const salesTables = [];
      $("table").each((_, table) => {
        const $table = $(table);
        const rows = $table.find("tr");
        if (!rows.length) return;
        let headerInfo = null;
        rows.each((rowIdx, tr) => {
          if (headerInfo) return false;
          const cells = $(tr).find("th,td");
          if (!cells.length) return;
          const headers = cells
            .map((__, cell) =>
              $(cell).text().replace(/\s+/g, " ").trim().toLowerCase(),
            )
            .get();
          if (
            headers.some((h) => /sale\s*date/.test(h)) &&
            headers.some((h) => /sale\s*price|price/.test(h))
          ) {
            headerInfo = { headers, rowIndex: rowIdx };
          }
        });
        if (!headerInfo) return;
        const dataRowCount = rows.length - (headerInfo.rowIndex + 1);
        if (dataRowCount <= 0) return;
        salesTables.push({
          table: $table,
          headerInfo,
        });
      });

      const prioritizedSelectors = [
        "#cphMain_gvSalesHistory",
        "#sales_history",
        "table.property_sales",
      ];

      let salesTableInfo = null;
      for (const selector of prioritizedSelectors) {
        const match = salesTables.find((entry) => entry.table.is(selector));
        if (match) {
          salesTableInfo = match;
          break;
        }
      }
      if (!salesTableInfo && salesTables.length > 0) {
        salesTableInfo = salesTables[0];
      }

      if (salesTableInfo) {
        const { table, headerInfo } = salesTableInfo;
        const headerRowIndex = headerInfo.rowIndex;
        const headers = headerInfo.headers;
        const headerIndex = (patterns) => {
          for (let i = 0; i < headers.length; i += 1) {
            const h = headers[i];
            if (patterns.some((pattern) => h.includes(pattern))) return i;
          }
          return -1;
        };
        const idxBookPage = headerIndex([
          "book",
          "official",
          "instrument",
          "document",
        ]);
        const idxSaleDate = headerIndex(["sale date"]);
        const idxInstrument = headerIndex(["instrument", "deed"]);
        const idxQualified = headerIndex(["qualified"]);
        const idxVacantImproved = headerIndex(["improved", "vacant"]);
        const idxSalePrice = headerIndex(["sale price", "price"]);
        const idxInstrumentNumber = headerIndex([
          "instrument number",
          "document number",
          "doc #",
          "doc#",
        ]);
        const idxBuyer = headerIndex(["grantee", "buyer"]); // Added buyer index
        const idxSeller = headerIndex(["grantor", "seller"]); // Added seller index

        table
          .find("tr")
          .slice(headerRowIndex + 1)
          .each((_, tr) => {
            const cells = $(tr).find("td");
            if (!cells.length) return;
            const getCellText = (idx) =>
              idx >= 0 && idx < cells.length
                ? $(cells[idx]).text().replace(/\s+/g, " ").trim()
                : "";
            const getCell = (idx) =>
              idx >= 0 && idx < cells.length ? $(cells[idx]) : null;

            const bookPageCell = getCell(idxBookPage) || getCell(0);
            const bookPageText = bookPageCell
              ? bookPageCell.text().replace(/\s+/g, " ").trim()
              : "";
            const docLink =
              bookPageCell && bookPageCell.find("a").length
                ? bookPageCell.find("a").first()
                : $(tr).find("a").first();
            const docUrl =
              docLink && docLink.length ? docLink.attr("href") || null : null;

            const saleDateRaw = getCellText(idxSaleDate);
            const instrument = getCellText(idxInstrument);
            const qualifiedText = getCellText(idxQualified);
            const vacantImprovedText = getCellText(idxVacantImproved);
            const salePriceRaw = getCellText(idxSalePrice);
            const instrumentNumberText = getCellText(idxInstrumentNumber);
            const buyerText = getCellText(idxBuyer); // Extracted buyer text
            const sellerText = getCellText(idxSeller); // Extracted seller text

            let book = null;
            let page = null;
            if (bookPageText && bookPageText.includes("/")) {
              const parts = bookPageText.split("/");
              if (parts.length >= 2) {
                book = parts[0].trim() || null;
                page = parts[1].trim() || null;
              }
            }

            let volume = null;
            if (docUrl) {
              try {
                const urlObj = new URL(
                  docUrl,
                  "https://www.lakecopropappr.com",
                );
                const pathParts = urlObj.pathname.split("/").filter(Boolean);
                const idx = pathParts.findIndex(
                  (part) => part.toLowerCase() === "getdocumentbybookpage",
                );
                if (idx !== -1) {
                  volume = pathParts[idx + 1] || volume;
                  book = pathParts[idx + 2] || book;
                  page = pathParts[idx + 3] || page;
                } else if (urlObj.searchParams) {
                  const bookParam = urlObj.searchParams.get("booknumber");
                  const pageParam = urlObj.searchParams.get("pagenumber");
                  if (bookParam) book = bookParam;
                  if (pageParam) page = pageParam;
                }
              } catch (err) {
                // ignore malformed URLs
              }
            }

            const saleDateISO = toISODate(saleDateRaw);
            const saleRecord = {
              sale_date: saleDateISO,
              ownership_transfer_date: saleDateISO,
              sale_price: parseCurrency(salePriceRaw),
              instrument: instrument || null,
              qualified: qualifiedText || null,
              improvement_status: vacantImprovedText || null,
              book: book || null,
              page: page || null,
              volume: volume || null,
              instrument_number: instrumentNumberText || null,
              document_url: docUrl || null,
              document_name: bookPageText
                ? `Official Records ${bookPageText}`
                : null,
              buyer: buyerText || null, // Added buyer to saleRecord
              seller: sellerText || null, // Added seller to saleRecord
            };

            const hasMeaningfulData =
              saleRecord.sale_date ||
              (saleRecord.sale_price != null &&
                !Number.isNaN(saleRecord.sale_price)) ||
              saleRecord.instrument ||
              saleRecord.book ||
              saleRecord.page ||
              saleRecord.buyer; // Check buyer for meaningful data
            if (hasMeaningfulData) {
              out.sales.push(saleRecord);
            }
          });
      }
    }


    // Residential Building Characteristics (Sections) for stories and exterior wall types
    const secTable = $("table#cphMain_repResidential_gvBuildingSections_0");
    if (secTable && secTable.length) {
      const firstDataRow = secTable
        .find("tr")
        .not(".property_table_head")
        .first();
      const tds = firstDataRow.find("td");
      if (tds.length >= 4) {
        const extText = (tds.eq(1).text() || "").trim();
        const storiesText = (tds.eq(2).text() || "").trim();
        if (storiesText) {
          const sNum = parseFloat(storiesText);
          if (!isNaN(sNum)) out.structure.number_of_stories = Math.round(sNum);
        }
        if (extText) {
          const inferred = interpretExteriorMaterials(extText);
          if (
            inferred.primary &&
            !out.structure.exterior_wall_material_primary
          ) {
            out.structure.exterior_wall_material_primary = inferred.primary;
          }
          if (
            inferred.secondary &&
            !out.structure.exterior_wall_material_secondary
          ) {
            out.structure.exterior_wall_material_secondary =
              inferred.secondary;
          }
          if (
            inferred.framing &&
            !out.structure.primary_framing_material
          ) {
            out.structure.primary_framing_material = inferred.framing;
          }
        }
      }
    }

    return out;
  }
function buildPropertyJson() {
    const propertyInfo = extractPropertyTypeFromLandData();
    const dorMappings = propertyInfo.landUseCodes.map((code) => ({
      code,
      mapping: mapDorCodeToEnums(code),
    }));
    const firstValidMapping =
      dorMappings.find((entry) => entry.mapping != null)?.mapping || null;

    dorMappings.forEach((entry) => {
      if (!entry.mapping && entry.code) {
        missingDorCodes.add(entry.code);
      }
    });

    const units =
      propertyInfo.units != null && Number.isFinite(propertyInfo.units)
        ? Math.round(Number(propertyInfo.units))
        : null;
    const numberOfUnitsTypeRaw = units != null ? getUnitsType(units) : null;
    const numberOfUnitsType = coerceNumberOfUnitsType(numberOfUnitsTypeRaw);

    const ownershipEstate = coerceOwnershipEstateType(
      firstValidMapping ? firstValidMapping.ownership_estate_type : null,
    );
    const buildStatus = coerceBuildStatus(
      firstValidMapping ? firstValidMapping.build_status : null,
    );
    const structureForm = coerceStructureForm(
      firstValidMapping ? firstValidMapping.structure_form : null,
    );

    let propertyUsageType = coercePropertyUsageType(
      firstValidMapping ? firstValidMapping.property_usage_type : null,
    );
    if (!propertyUsageType && propertyInfo.propertyType) {
      propertyUsageType = coercePropertyUsageType(propertyInfo.propertyType);
    }
    if (!propertyUsageType && propertyInfo.landUseDescription) {
      const desc = propertyInfo.landUseDescription;
      let inferred = null;
      if (desc.includes("RESIDENT")) inferred = "Residential";
      else if (desc.includes("COMMERCIAL")) inferred = "Commercial";
      else if (desc.includes("INDUSTR")) inferred = "Industrial";
      else if (desc.includes("AGRICULT") || desc.includes("FARM"))
        inferred = "Agricultural";
      else if (desc.includes("GOV")) inferred = "GovernmentProperty";
      else if (desc.includes("MOBILE HOME PARK"))
        inferred = "MobileHomePark";
      propertyUsageType = coercePropertyUsageType(inferred);
    }

    const propertyType = coercePropertyType(
      (firstValidMapping && firstValidMapping.property_type) ||
        propertyInfo.propertyType ||
        null,
      { buildStatus, units, structureForm },
    );
    let resolvedBuildStatus = buildStatus || null;
    const landUseText = propertyInfo.landUseDescription || "";
    if (!resolvedBuildStatus) {
      if (propertyType === "LandParcel") {
        resolvedBuildStatus = "VacantLand";
      } else if (landUseText.includes("VACANT") || landUseText.includes("VAC")) {
        resolvedBuildStatus = "VacantLand";
      } else if (Number.isFinite(units) && units > 0) {
        resolvedBuildStatus = "Improved";
      } else if (structureForm) {
        resolvedBuildStatus = "Improved";
      }
    }
    if (!resolvedBuildStatus && propertyType) {
      resolvedBuildStatus = "Improved";
    }
    if (!resolvedBuildStatus) {
      resolvedBuildStatus = "Improved";
    }
    const normalizedBuildStatus = coerceBuildStatus(resolvedBuildStatus);
    const finalBuildStatus =
      normalizedBuildStatus ||
      (propertyType === "LandParcel" || propertyType === "VacantLand"
        ? "VacantLand"
        : "Improved");
    let resolvedPropertyType = propertyType;
    if (!resolvedPropertyType && finalBuildStatus === "VacantLand") {
      resolvedPropertyType = "VacantLand";
    }
    if (!resolvedPropertyType && Number.isFinite(units)) {
      if (units === 1) resolvedPropertyType = "SingleFamily";
      else if (units === 2) resolvedPropertyType = "2Units";
      else if (units === 3) resolvedPropertyType = "3Units";
      else if (units === 4) resolvedPropertyType = "4Units";
      else if (units >= 5 && units <= 9) {
        resolvedPropertyType = "MultiFamilyLessThan10";
      } else if (units >= 10) {
        resolvedPropertyType = "MultiFamilyMoreThan10";
      }
    }
    if (!resolvedPropertyType && structureForm) {
      const sf = String(structureForm).toLowerCase();
      if (sf.includes("manufactured")) {
        if (sf.includes("single")) {
          resolvedPropertyType = "ManufacturedHousingSingleWide";
        } else if (sf.includes("multi")) {
          resolvedPropertyType = "ManufacturedHousingMultiWide";
        } else {
          resolvedPropertyType = "ManufacturedHousing";
        }
      } else if (sf.includes("town")) {
        resolvedPropertyType = "Townhouse";
      } else if (sf.includes("duplex") || sf.includes("2 unit")) {
        resolvedPropertyType = "Duplex";
      }
    }
    if (!resolvedPropertyType && propertyInfo.propertyType) {
      const alias = PROPERTY_TYPE_ALIASES[propertyInfo.propertyType];
      if (alias && PROPERTY_TYPE_ENUM.has(alias)) {
        resolvedPropertyType = alias;
      } else if (PROPERTY_TYPE_ENUM.has(propertyInfo.propertyType)) {
        resolvedPropertyType = propertyInfo.propertyType;
      }
    }
    if (!resolvedPropertyType) {
      resolvedPropertyType =
        finalBuildStatus === "VacantLand" ? "VacantLand" : "Building";
    }
    const aliasForResolved =
      PROPERTY_TYPE_ALIASES[resolvedPropertyType] || resolvedPropertyType;
    if (PROPERTY_TYPE_ENUM.has(aliasForResolved)) {
      resolvedPropertyType = aliasForResolved;
    } else {
      resolvedPropertyType = "Building";
    }

    const property = {
      parcel_identifier: general.parcelNumber || propSeed.parcel_id || null,
      property_structure_built_year: bx.yearBuilt || null,
      livable_floor_area: bx.livingArea ? String(bx.livingArea) : null,
      property_legal_description_text: general.legalDescription || null,
      ownership_estate_type: ownershipEstate,
      build_status: finalBuildStatus,
      structure_form: structureForm ?? null,
      property_usage_type: propertyUsageType ?? null,
      property_type: resolvedPropertyType ?? null,
      number_of_units_type: numberOfUnitsType,
      number_of_units: units,
      area_under_air: null,
      property_effective_built_year: null,
      subdivision: null,
      total_area: null,
      zoning: null,
    };

    Object.keys(property).forEach((k) => {
      if (property[k] === undefined) delete property[k];
    });

    return property;
  }

  // Execute extractions in proper order
  const general = extractGeneral();
  const bx = extractBuildingAndValues();
  const structureFiles = [];
  const utilityFiles = [];
  const buildingLayoutFiles = [];
  const allLayoutFiles = [];
  const topLevelLayoutFiles = [];

  // Address parsing
  function parseAddress() {
    let raw = (general.propertyLocationRaw || addrSeed.full_address || "")
      .replace(/\r/g, "")
      .trim();
    raw = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();

    let street_number = null,
      street_name = null,
      street_suffix_type = null,
      city_name = null,
      state_code = null,
      postal_code = null;

    const m =
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+)\s*,\s*([A-Z\s\-']+)\s*,?\s*([A-Z]{2})\s*,?\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*,\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*([A-Z]{2})\s*,\s*(\d{5})(?:-?(\d{4}))?$/i,
      );

    if (m) {
      street_number = m[1];
      street_name = (m[2] || "").trim().replace(/\s+/g, " ").toUpperCase();
      street_suffix_type = (m[3] || "").trim();
      city_name = (m[4] || "").trim().toUpperCase();
      state_code = (m[5] || "").trim().toUpperCase();
      postal_code = (m[6] || "").trim();
    } else {
      const fa = (addrSeed.full_address || "").trim();
      const parts = fa.split(",");
      if (parts.length >= 3) {
        const street = parts[0].trim();
        const city = parts[1].trim();
        const stZip = parts[2].trim();
        const st = stZip.match(/([A-Z]{2})/)?.[1] || null;
        const zip = stZip.match(/(\d{5})/)?.[1] || null;
        const streetParts = street.split(/\s+/);
        street_number = streetParts.shift();
        street_suffix_type = streetParts.pop() || null;
        street_name = streetParts.join(" ").toUpperCase();
        city_name = city.toUpperCase();
        state_code = st;
        postal_code = zip;
      }
    }

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
    if (street_suffix_type) {
      const key = street_suffix_type.toUpperCase();
      if (suffixMap[key]) street_suffix_type = suffixMap[key];
    }

    const countyName = addrSeed.county_jurisdiction || null;

    return {
      street_number: street_number || null,
      street_name: street_name || null,
      street_suffix_type: street_suffix_type || null,
      street_pre_directional_text: null,
      street_post_directional_text: null,
      city_name: city_name || null,
      municipality_name: null,
      state_code: state_code || null,
      postal_code: postal_code || null,
      plus_four_postal_code: null,
      country_code: "US",
      county_name: countyName || null,
      unit_identifier: null,
      latitude: null,
      longitude: null,
      route_number: null,
      township: null,
      range: null,
      section: null,
      block: null,
      lot: null,
    };
  }

  const addr = parseAddress();
  const rawPropertyAddress = (general.propertyLocationRaw ||
    addrSeed.full_address ||
    "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  // addr.unnormalized_address = rawPropertyAddress || null;
  // Extract latitude and longitude from addrSeed if available
  addr.latitude = addrSeed.latitude || null;
  addr.longitude = addrSeed.longitude || null;

  const propertyAddressKeys = new Set([
    "street_number",
    "street_pre_directional_text",
    "street_name",
    "street_suffix_type",
    "street_post_directional_text",
    "unit_identifier",
    "city_name",
    "municipality_name",
    "state_code",
    "postal_code",
    "plus_four_postal_code",
    "country_code",
    "county_name",
    "latitude",
    "longitude",
    "request_identifier",
    "source_http_request",
    "route_number",
    "township",
    "range",
    "section",
    "block",
    "lot",
  ]);
  Object.keys(addr).forEach((key) => {
    if (!propertyAddressKeys.has(key)) {
      addr[key] = null;
    }
  });
  addr.country_code = rawPropertyAddress ? "US" : addr.country_code || "US";
  addr.county_name = addrSeed.county_jurisdiction || null;
  addr.request_identifier = propSeed.request_identifier || null;
  addr.source_http_request = propSeed.source_http_request || null;

  function buildMailingAddress(lines) {
    if (!Array.isArray(lines) || !lines.length) return null;
    const normalizedLines = lines
      .map((line) => (line || "").replace(/\s+/g, " ").trim())
      .filter((line) => line && line !== "/>");
    if (!normalizedLines.length) return null;

    const raw = normalizedLines.join(", ");

    let cityLineIndex = -1;
    for (let i = normalizedLines.length - 1; i >= 0; i -= 1) {
      if (/\d{5}/.test(normalizedLines[i]) || /[A-Z]{2}\b/.test(normalizedLines[i])) {
        cityLineIndex = i;
        break;
      }
    }

    let cityLine = cityLineIndex >= 0 ? normalizedLines[cityLineIndex] : null;
    const addressSegments =
      cityLineIndex >= 0
        ? normalizedLines.slice(0, cityLineIndex)
        : normalizedLines.slice();
    const trailingSegments =
      cityLineIndex >= 0 ? normalizedLines.slice(cityLineIndex + 1) : [];

    let cityName = null;
    let stateCode = null;
    let postalCode = null;
    let plusFour = null;

    if (cityLine) {
      const zipMatch = cityLine.match(/(\d{5})(?:-?(\d{4}))?/);
      if (zipMatch) {
        postalCode = zipMatch[1];
        plusFour = zipMatch[2] || null;
        cityLine = cityLine.slice(0, zipMatch.index).trim();
      }

      const parts = cityLine
        .replace(/,+/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      if (parts.length) {
        const possibleState = parts[parts.length - 1];
        if (/^[A-Z]{2}$/i.test(possibleState)) {
          stateCode = possibleState.toUpperCase();
          parts.pop();
        }
        if (parts.length) {
          cityName = parts.join(" ").toUpperCase();
        }
      }
    }

    const streetRaw = addressSegments.concat(trailingSegments).join(", ");
    let streetNumber = null;
    let streetName = null;
    let streetSuffix = null;
    if (streetRaw) {
      const normalizedStreet = streetRaw.replace(/\s+/g, " ").trim();
      const streetMatch = normalizedStreet.match(/^(\d+)\s+(.*)$/);
      if (streetMatch) {
        streetNumber = streetMatch[1];
        let remainder = streetMatch[2].trim();
        const parts = remainder.split(/\s+/);
        if (parts.length > 1) {
          const suffixCandidate = parts[parts.length - 1].replace(/\./g, "").toUpperCase();
          const suffixAlias = {
            AVENUE: "Ave",
            AVE: "Ave",
            STREET: "St",
            ST: "St",
            ROAD: "Rd",
            RD: "Rd",
            DRIVE: "Dr",
            DR: "Dr",
            COURT: "Ct",
            CT: "Ct",
            LANE: "Ln",
            LN: "Ln",
            CIRCLE: "Cir",
            CIR: "Cir",
            BOULEVARD: "Blvd",
            BLVD: "Blvd",
            WAY: "Way",
            TERRACE: "Ter",
            TER: "Ter",
            PLACE: "Pl",
            PL: "Pl",
            HIGHWAY: "Hwy",
            HWY: "Hwy",
            PARKWAY: "Pkwy",
            PKWY: "Pkwy",
            TRAIL: "Trl",
            TRL: "Trl",
            LOOP: "Loop",
            POINT: "Pt",
            PT: "Pt",
            SQUARE: "Sq",
            SQ: "Sq",
            COVE: "Cv",
            CV: "Cv",
            RUN: "Run",
            BEND: "Bnd",
            BND: "Bnd",
          };
          const mappedSuffix =
            suffixAlias[suffixCandidate] ||
            (suffixCandidate.length
              ? suffixCandidate[0] +
                suffixCandidate.slice(1).toLowerCase()
              : null);
          if (mappedSuffix && parts.length > 1) {
            parts.pop();
            streetSuffix = mappedSuffix;
          }
          remainder = parts.join(" ");
        }
        streetName = remainder.toUpperCase();
      } else {
        streetName = normalizedStreet.toUpperCase();
      }
    }

    return {
      street_number: streetNumber || null,
      street_pre_directional_text: null,
      street_name: streetName || null,
      street_suffix_type: streetSuffix || null,
      street_post_directional_text: null,
      unit_identifier: null,
      city_name: cityName || null,
      municipality_name: null,
      state_code: stateCode || null,
      postal_code: postalCode || null,
      plus_four_postal_code: plusFour || null,
      county_name: addrSeed.county_jurisdiction || null,
      country_code: "US",
      latitude: null,
      longitude: null,
      route_number: null,
      township: null,
      range: null,
      section: null,
      block: null,
      lot: null,
      unnormalized_address: raw,
      request_identifier: propSeed.request_identifier || null,
      source_http_request: propSeed.source_http_request || null,
    };
  }

  const mailingAddress = buildMailingAddress(
    general.mailingAddressLines || null,
  );
  const mailingAddressFile = mailingAddress ? "mailing_address.json" : null;
  if (mailingAddress) {
    const rawMailing = (general.mailingAddressLines || [])
      .map((line) => (line || "").replace(/\s+/g, " ").trim())
      .filter((line) => line)
      .join(", ")
      .trim();
    mailingAddress.unnormalized_address = rawMailing || null;
    // Extract latitude and longitude from addrSeed for mailing address if available
    mailingAddress.latitude =  null;
    mailingAddress.longitude =  null;

    const mailingAddressKeys = new Set([
      "unnormalized_address",
      "latitude",
      "longitude",
      "request_identifier",
      "source_http_request",
    ]);
    // Object.keys(mailingAddress).forEach((key) => {
    //   if (!mailingAddressKeys.has(key)) {
    //     mailingAddress[key] = null;
    //   }
    // });
    mailingAddress.request_identifier = propSeed.request_identifier || null;
    mailingAddress.source_http_request = propSeed.source_http_request || null;
  }

  function createRelationshipFileName(fromFile, toFile, suffix = null) {
    const fromBase = fromFile.replace(/\.json$/i, "");
    const toBase = toFile.replace(/\.json$/i, "");
    const base = `relationship_${fromBase}_has_${toBase}`;
    return suffix ? `${base}_${suffix}.json` : `${base}.json`;
  }

  // Write address.json
  writeJSON(path.join(dataDir, "address.json"), addr);
  if (mailingAddressFile) {
    writeJSON(path.join(dataDir, mailingAddressFile), mailingAddress);
  }

  // property.json
  const property = buildPropertyJson();
  Object.keys(property).forEach((k) => {
    if (property[k] === undefined) delete property[k];
  });
  writeJSON(path.join(dataDir, "property.json"), property);
  const propertyTypeValue = property.property_type || null;
  const isLandProperty =
    propertyTypeValue === "LandParcel" ||
    propertyTypeValue === "VacantLand" ||
    property.build_status === "VacantLand";

  // lot.json
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
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // tax_*.json
  if (
    bx.taxYear ||
    bx.marketValue ||
    bx.assessedValue ||
    bx.taxableValue ||
    bx.buildingValue ||
    bx.landValue
  ) {
    const targetTaxYear = 2025;
    const tax = {
      tax_year: targetTaxYear,
      property_assessed_value_amount:
        bx.assessedValue != null ? bx.assessedValue : null,
      property_market_value_amount:
        bx.marketValue != null ? bx.marketValue : null,
      property_building_amount:
        bx.buildingValue != null ? bx.buildingValue : null,
      property_land_amount: bx.landValue != null ? bx.landValue : null,
      property_taxable_value_amount:
        bx.taxableValue != null ? bx.taxableValue : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    const taxName = `tax_${tax.tax_year}.json`;
    writeJSON(path.join(dataDir, taxName), tax);
    if (tax.tax_year && fs.existsSync(path.join(dataDir, "tax_1.json"))) {
      try {
        fs.unlinkSync(path.join(dataDir, "tax_1.json"));
      } catch (e) {}
    }
  }
// structure.json — include parsed stories and exterior wall mapping
  const livingAreaNumber =
    bx.livingArea != null
      ? parseFloat(String(bx.livingArea).replace(/,/g, ""))
      : null;

  const exteriorWallPrimary = coerceExteriorWallMaterial(
    bx.structure.exterior_wall_material_primary || null,
  );
  const exteriorWallSecondary = coerceExteriorWallMaterial(
    bx.structure.exterior_wall_material_secondary || null,
  );
  const primaryFramingMaterial = coercePrimaryFramingMaterial(
    bx.structure.primary_framing_material || null,
  );

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exteriorWallPrimary,
    exterior_wall_material_secondary: exteriorWallSecondary,
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
    primary_framing_material: primaryFramingMaterial,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: bx.structure.number_of_stories || null,
    finished_base_area:
      livingAreaNumber != null && !Number.isNaN(livingAreaNumber)
        ? livingAreaNumber
        : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    roof_date: bx.yearBuilt ? String(bx.yearBuilt) : null,
  };
  const structureFileName = "structure_1.json";
  writeJSON(path.join(dataDir, structureFileName), structure);
  structureFiles.push(structureFileName);

  const inferredBuildingTotalArea =
    structure.finished_base_area ??
    structure.finished_upper_story_area ??
    structure.unfinished_base_area ??
    structure.unfinished_upper_story_area ??
    structure.finished_basement_area ??
    (bx.livingArea != null ? toNumber(bx.livingArea) : null);
  const inferredBuildingLivableArea =
    structure.finished_base_area ??
    (bx.livingArea != null ? toNumber(bx.livingArea) : null) ??
    inferredBuildingTotalArea ??
    null;

  // utility.json from utilities_data
  const resolvedUtilityRecord = resolveRecordForKey(utilitiesData, propertyKey);
  if (resolvedUtilityRecord) {
    const utilityFileName = "utility_1.json";
    writeJSON(path.join(dataDir, utilityFileName), resolvedUtilityRecord);
    utilityFiles.push(utilityFileName);
  }

  // layout_*.json from layout_data
  let layoutRecord = null;
  if (layoutData && typeof layoutData === "object") {
    layoutRecord = resolveRecordForKey(layoutData, propertyKey);
  }

  const layoutIdToFile = new Map();
  const endpointMetaByFile = new Map();
  const layoutParentLinks = [];
  const REQUIRED_LAYOUT_FIELDS = [
    "flooring_material_type",
    "has_windows",
    "window_design_type",
    "window_material_type",
    "window_treatment_type",
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
    "pool_condition",
    "pool_surface_type",
    "pool_water_quality",
    "size_square_feet",
  ];
  const STORY_TYPE_ALLOWED = new Set([
    "Full",
    "Half Story",
    "Three-Quarter Story",
  ]);
  const FLOOR_LEVEL_BY_NUMBER = {
    1: "1st Floor",
    2: "2nd Floor",
    3: "3rd Floor",
    4: "4th Floor",
  };
  const FLOOR_LEVEL_ALIASES = new Map(
    Object.entries({
      "1": "1st Floor",
      first: "1st Floor",
      "first floor": "1st Floor",
      "1st": "1st Floor",
      "1st floor": "1st Floor",
      "floor 1": "1st Floor",
      "floor1": "1st Floor",
      "2": "2nd Floor",
      second: "2nd Floor",
      "second floor": "2nd Floor",
      "2nd": "2nd Floor",
      "2nd floor": "2nd Floor",
      "floor 2": "2nd Floor",
      "floor2": "2nd Floor",
      "3": "3rd Floor",
      third: "3rd Floor",
      "third floor": "3rd Floor",
      "3rd": "3rd Floor",
      "3rd floor": "3rd Floor",
      "floor 3": "3rd Floor",
      "floor3": "3rd Floor",
      "4": "4th Floor",
      fourth: "4th Floor",
      "4th": "4th Floor",
      "4th floor": "4th Floor",
      "fourth floor": "4th Floor",
      "floor 4": "4th Floor",
      "floor4": "4th Floor",
    }),
  );
  const FLOOR_LEVEL_ALLOWED = new Set(Object.values(FLOOR_LEVEL_BY_NUMBER));
  const LAYOUT_SPACE_TYPE_ALLOWED = new Set([
    "Building",
    "Living Room",
    "Family Room",
    "Great Room",
    "Dining Room",
    "Office Room",
    "Conference Room",
    "Class Room",
    "Plant Floor",
    "Kitchen",
    "Breakfast Nook",
    "Pantry",
    "Primary Bedroom",
    "Secondary Bedroom",
    "Guest Bedroom",
    "Children’s Bedroom",
    "Nursery",
    "Full Bathroom",
    "Three-Quarter Bathroom",
    "Half Bathroom / Powder Room",
    "En-Suite Bathroom",
    "Jack-and-Jill Bathroom",
    "Primary Bathroom",
    "Laundry Room",
    "Mudroom",
    "Closet",
    "Bedroom",
    "Walk-in Closet",
    "Mechanical Room",
    "Storage Room",
    "Server/IT Closet",
    "Home Office",
    "Library",
    "Den",
    "Study",
    "Media Room / Home Theater",
    "Game Room",
    "Home Gym",
    "Music Room",
    "Craft Room / Hobby Room",
    "Prayer Room / Meditation Room",
    "Safe Room / Panic Room",
    "Wine Cellar",
    "Bar Area",
    "Greenhouse",
    "Attached Garage",
    "Detached Garage",
    "Carport",
    "Workshop",
    "Storage Loft",
    "Porch",
    "Screened Porch",
    "Sunroom",
    "Deck",
    "Patio",
    "Pergola",
    "Balcony",
    "Terrace",
    "Gazebo",
    "Pool House",
    "Outdoor Kitchen",
    "Lobby / Entry Hall",
    "Common Room",
    "Utility Closet",
    "Elevator Lobby",
    "Mail Room",
    "Janitor’s Closet",
    "Pool Area",
    "Indoor Pool",
    "Outdoor Pool",
    "Hot Tub / Spa Area",
    "Shed",
    "Lanai",
    "Open Porch",
    "Enclosed Porch",
    "Attic",
    "Enclosed Cabana",
    "Attached Carport",
    "Detached Carport",
    "Detached Utility Closet",
    "Jacuzzi",
    "Courtyard",
    "Open Courtyard",
    "Screen Porch (1-Story)",
    "Screen Enclosure (2-Story)",
    "Screen Enclosure (3-Story)",
    "Screen Enclosure (Custom)",
    "Lower Garage",
    "Lower Screened Porch",
    "Stoop",
    "First Floor",
    "Second Floor",
    "Third Floor",
    "Fourth Floor",
    "Floor",
    "Basement",
    "Sub-Basement",
    "Living Area",
  ]);
  const LAYOUT_SPACE_TYPE_ALIASES = new Map([
    ["garage", "Attached Garage"],
    ["attached garage", "Attached Garage"],
    ["detached garage", "Detached Garage"],
    ["car garage", "Attached Garage"],
    ["carport", "Carport"],
    ["attached carport", "Attached Carport"],
    ["detached carport", "Detached Carport"],
    ["porch", "Porch"],
    ["open porch", "Open Porch"],
    ["enclosed porch", "Enclosed Porch"],
    ["screen porch", "Screened Porch"],
    ["screened porch", "Screened Porch"],
    ["screen porch (1-story)", "Screen Porch (1-Story)"],
    ["deck", "Deck"],
    ["patio", "Patio"],
    ["balcony", "Balcony"],
    ["terrace", "Terrace"],
    ["gazebo", "Gazebo"],
    ["pool", "Pool Area"],
    ["pool area", "Pool Area"],
    ["outdoor pool", "Outdoor Pool"],
    ["indoor pool", "Indoor Pool"],
    ["spa", "Hot Tub / Spa Area"],
    ["hot tub", "Hot Tub / Spa Area"],
    ["jacuzzi", "Jacuzzi"],
    ["greenhouse", "Greenhouse"],
    ["shed", "Shed"],
    ["storage", "Storage Room"],
    ["storage room", "Storage Room"],
    ["storage loft", "Storage Loft"],
    ["living area", "Living Area"],
    ["living room", "Living Room"],
    ["family room", "Family Room"],
    ["dining room", "Dining Room"],
    ["kitchen", "Kitchen"],
    ["pantry", "Pantry"],
    ["bedroom", "Bedroom"],
    ["primary bedroom", "Primary Bedroom"],
    ["secondary bedroom", "Secondary Bedroom"],
    ["guest bedroom", "Guest Bedroom"],
    ["closet", "Closet"],
    ["walk-in closet", "Walk-in Closet"],
    ["laundry", "Laundry Room"],
    ["laundry room", "Laundry Room"],
    ["mud room", "Mudroom"],
    ["mudroom", "Mudroom"],
    ["basement", "Basement"],
    ["attic", "Attic"],
    ["floor", "Floor"],
    ["first floor", "First Floor"],
    ["second floor", "Second Floor"],
    ["third floor", "Third Floor"],
    ["fourth floor", "Fourth Floor"],
    ["home office", "Home Office"],
    ["office", "Office Room"],
    ["office room", "Office Room"],
    ["den", "Den"],
    ["study", "Study"],
    ["library", "Library"],
    ["media room", "Media Room / Home Theater"],
    ["game room", "Game Room"],
    ["home gym", "Home Gym"],
    ["music room", "Music Room"],
    ["craft room", "Craft Room / Hobby Room"],
    ["hobby room", "Craft Room / Hobby Room"],
    ["wine cellar", "Wine Cellar"],
    ["bar", "Bar Area"],
    ["outdoor kitchen", "Outdoor Kitchen"],
    ["pool house", "Pool House"],
    ["utility closet", "Utility Closet"],
    ["mechanical room", "Mechanical Room"],
    ["storage shed", "Shed"],
    ["courtyard", "Courtyard"],
    ["open courtyard", "Open Courtyard"],
    ["lanai", "Lanai"],
    ["sunroom", "Sunroom"],
    ["common room", "Common Room"],
    ["entry hall", "Lobby / Entry Hall"],
    ["entry", "Lobby / Entry Hall"],
    ["floor 1", "First Floor"],
    ["floor 2", "Second Floor"],
    ["floor 3", "Third Floor"],
    ["floor 4", "Fourth Floor"],
  ]);

  const isBuildingLayout = (layout) =>
    (layout?.space_type || "").toLowerCase() === "building";
  const isFloorLayout = (layout) => {
    const st = (layout?.space_type || "").toLowerCase();
    return /\bfloor\b/.test(st) || /\blevel\b/.test(st);
  };
  const normalizeBuildingNumber = (layout) => {
    if (!layout) return null;
    if (
      layout.building_number !== undefined &&
      layout.building_number !== null &&
      layout.building_number !== ""
    ) {
      return String(layout.building_number).trim();
    }
    if (layout.building_name) return String(layout.building_name).trim();
    if (layout.building_label) return String(layout.building_label).trim();
    return null;
  };

  const rawLayouts = Array.isArray(layoutRecord?.layouts)
    ? layoutRecord.layouts
    : [];
  const shouldProcessLayouts = rawLayouts.length > 0 || !isLandProperty;

  if (shouldProcessLayouts) {
    const layoutNodes = [];
    const layoutIdMap = new Map();
    let generatedLocalIdCounter = 1;

    rawLayouts.forEach((layoutObj, idx) => {
      const candidateId =
        layoutObj && layoutObj.local_id != null
          ? String(layoutObj.local_id)
          : null;
      let localId =
        candidateId || `layout_local_${generatedLocalIdCounter++}`;
      while (layoutIdMap.has(localId)) {
        localId = `${localId}_${generatedLocalIdCounter++}`;
      }
      const parentLocalId =
        layoutObj && layoutObj.parent_local_id != null
          ? String(layoutObj.parent_local_id)
          : null;
      const node = {
        originalIndex: idx,
        localId,
        parentLocalId,
        layout: { ...layoutObj },
        children: [],
        outputFileName: `layout_${idx + 1}.json`,
      };
      layoutNodes.push(node);
      layoutIdMap.set(localId, node);
    });

    const getSortedBuildingNodes = () =>
      layoutNodes
        .filter((node) => isBuildingLayout(node.layout))
        .sort((a, b) => a.originalIndex - b.originalIndex);

    const reassignOrphansToBuilding = (buildingCandidates) => {
      if (!buildingCandidates || buildingCandidates.length === 0) return;
      const buildingSet = new Set(buildingCandidates);
      const buildingLookup = buildingCandidates
        .map((node) => ({
          node,
          number: normalizeBuildingNumber(node.layout),
        }))
        .filter((entry) => entry.number);
      const defaultBuilding = buildingCandidates[0];
      layoutNodes.forEach((node) => {
        if (buildingSet.has(node)) return;
        if (node.parentLocalId && layoutIdMap.has(node.parentLocalId)) return;
        const layoutNumber = normalizeBuildingNumber(node.layout);
        let target = null;
        if (layoutNumber) {
          const match = buildingLookup.find(
            (entry) => entry.number === layoutNumber,
          );
          if (match) target = match.node;
        }
        if (!target) target = defaultBuilding;
        if (target) {
          node.parentLocalId = target.localId;
        }
      });
    };

    let buildingNodes = getSortedBuildingNodes();
    if (buildingNodes.length > 0) {
      reassignOrphansToBuilding(buildingNodes);
    }

    if (buildingNodes.length === 0 && !isLandProperty) {
      const autoNode = {
        originalIndex: -1,
        localId: "__auto_building__",
        parentLocalId: null,
        layout: {
          space_type: "Building",
          space_index: 1,
          space_type_index: "1",
          size_square_feet:
            inferredBuildingTotalArea != null
              ? inferredBuildingTotalArea
              : inferredBuildingLivableArea,
          total_area_sq_ft:
            inferredBuildingTotalArea != null ? inferredBuildingTotalArea : null,
          livable_area_sq_ft:
            inferredBuildingLivableArea != null
              ? inferredBuildingLivableArea
              : null,
          is_exterior: false,
          is_finished: true,
          building_number: 1,
        },
        children: [],
        outputFileName: "layout_autogen_building.json",
      };
      layoutNodes.push(autoNode);
      layoutIdMap.set(autoNode.localId, autoNode);
      buildingNodes = getSortedBuildingNodes();
      reassignOrphansToBuilding(buildingNodes);
    }

    if (layoutNodes.length > 0) {
      layoutNodes.forEach((node) => {
        node.children = [];
      });

      const roots = [];
      layoutNodes.forEach((node) => {
        if (node.parentLocalId && layoutIdMap.has(node.parentLocalId)) {
          layoutIdMap.get(node.parentLocalId).children.push(node);
        } else {
          roots.push(node);
        }
      });

      const sortChildrenForParent = (parentNode) => {
        if (!parentNode) return (a, b) => a.originalIndex - b.originalIndex;
        if (isBuildingLayout(parentNode.layout)) {
          return (a, b) => {
            const aIsFloor = isFloorLayout(a.layout);
            const bIsFloor = isFloorLayout(b.layout);
            if (aIsFloor !== bIsFloor) return aIsFloor ? -1 : 1;
            return a.originalIndex - b.originalIndex;
          };
        }
        return (a, b) => a.originalIndex - b.originalIndex;
      };

      const candidateRoots =
        roots.length > 0
          ? roots.slice()
          : layoutNodes.filter((node) => !node.parentLocalId);
      const rootOrder = candidateRoots.sort((a, b) => {
        const aIsBuilding = isBuildingLayout(a.layout);
        const bIsBuilding = isBuildingLayout(b.layout);
        if (aIsBuilding !== bIsBuilding) return aIsBuilding ? -1 : 1;
        if (a.originalIndex === b.originalIndex) return 0;
        return a.originalIndex - b.originalIndex;
      });

      const childTypeCounters = new Map();
      const rootTypeCounters = new Map();
      let nextBuildingIndex = 1;

      const assignIndexer = (node, parent) => {
        const targetLayout = node.layout || (node.layout = {});
        const nextSegmentFor = (parentNode, layoutObj) => {
          const typeKey =
            (layoutObj.space_type || layoutObj.space_category || "unknown")
              .toString()
              .toLowerCase()
              .trim() || "unknown";
          if (!parentNode) {
            const current = rootTypeCounters.get(typeKey) || 0;
            const next = current + 1;
            rootTypeCounters.set(typeKey, next);
            return next;
          }
          let perType = childTypeCounters.get(parentNode);
          if (!perType) {
            perType = new Map();
            childTypeCounters.set(parentNode, perType);
          }
          const current = perType.get(typeKey) || 0;
          const next = current + 1;
          perType.set(typeKey, next);
          return next;
        };

        if (!parent) {
          if (isBuildingLayout(targetLayout)) {
            targetLayout.space_type_indexer = String(nextBuildingIndex++);
            const parsed = parseInt(targetLayout.space_type_indexer, 10);
            if (!Number.isNaN(parsed)) {
              targetLayout.building_number = parsed;
            }
          } else {
            const segment = nextSegmentFor(null, targetLayout);
            targetLayout.space_type_indexer = `1.${segment}`;
            targetLayout.space_index = segment;
          }
        } else {
          const parentIndexer =
            parent.layout?.space_type_indexer ||
            parent.layout?.space_type_index ||
            "1";
          const segment = nextSegmentFor(parent, targetLayout);
          targetLayout.space_type_indexer = `${parentIndexer}.${segment}`;
          targetLayout.space_index = segment;
        }

        targetLayout.space_type_index = targetLayout.space_type_indexer;
        const spaceIndexParts = String(targetLayout.space_type_indexer).split(".");
        const lastSegment = parseInt(
          spaceIndexParts[spaceIndexParts.length - 1],
          10,
        );
        if (!Number.isNaN(lastSegment)) {
          targetLayout.space_index = lastSegment;
        }

        const orderedChildren = node.children
          .slice()
          .sort(sortChildrenForParent(node));
        orderedChildren.forEach((child) => assignIndexer(child, node));
      };

      rootOrder.forEach((node) => assignIndexer(node, null));

      const nodesForWriting = layoutNodes
        .slice()
        .sort((a, b) => {
          const aAuto = a.originalIndex === -1;
          const bAuto = b.originalIndex === -1;
          if (aAuto !== bAuto) return aAuto ? -1 : 1;
          const aIsBuilding = isBuildingLayout(a.layout);
          const bIsBuilding = isBuildingLayout(b.layout);
          if (aIsBuilding !== bIsBuilding) return aIsBuilding ? -1 : 1;
          if (a.originalIndex === b.originalIndex) return 0;
          return a.originalIndex - b.originalIndex;
        });

      const usedLayoutFileNames = new Set();
      const getUniqueLayoutFileName = (baseName) => {
        const base = baseName || `layout_${allLayoutFiles.length + 1}.json`;
        let candidate = base;
        let counter = 2;
        const extIndex = base.lastIndexOf(".json");
        const prefix = extIndex !== -1 ? base.slice(0, extIndex) : base;
        const suffix = extIndex !== -1 ? base.slice(extIndex) : "";
        while (usedLayoutFileNames.has(candidate)) {
          candidate = `${prefix}_${counter}${suffix}`;
          counter += 1;
        }
        usedLayoutFileNames.add(candidate);
        return candidate;
      };

      nodesForWriting.forEach((node) => {
        const layoutContent = { ...node.layout };
        delete layoutContent.local_id;
        delete layoutContent.parent_local_id;
        const spaceTypeIndexerValue =
          layoutContent.space_type_indexer !== undefined
            ? layoutContent.space_type_indexer
            : null;
        if (
          layoutContent.space_type_index === undefined &&
          spaceTypeIndexerValue !== null
        ) {
          layoutContent.space_type_index = spaceTypeIndexerValue;
        }

        if (isBuildingLayout(layoutContent)) {
          if (
            layoutContent.total_area_sq_ft == null &&
            inferredBuildingTotalArea != null
          ) {
            layoutContent.total_area_sq_ft = inferredBuildingTotalArea;
          }
          if (
            layoutContent.livable_area_sq_ft == null &&
            inferredBuildingLivableArea != null
          ) {
            layoutContent.livable_area_sq_ft = inferredBuildingLivableArea;
          }
          if (
            layoutContent.size_square_feet == null &&
            layoutContent.total_area_sq_ft != null
          ) {
            layoutContent.size_square_feet = layoutContent.total_area_sq_ft;
          }
          layoutContent.is_exterior =
            layoutContent.is_exterior !== undefined
              ? layoutContent.is_exterior
              : false;
          layoutContent.is_finished =
            layoutContent.is_finished !== undefined
              ? layoutContent.is_finished
              : true;
        }

        if (layoutContent.floor_level !== undefined) {
          const rawFloor = layoutContent.floor_level;
          let normalizedFloor = null;
          if (typeof rawFloor === "number" && Number.isFinite(rawFloor)) {
            const rounded = Math.round(rawFloor);
            normalizedFloor = FLOOR_LEVEL_BY_NUMBER[rounded] || null;
          } else if (typeof rawFloor === "string") {
            const trimmed = rawFloor.trim();
            if (FLOOR_LEVEL_ALLOWED.has(trimmed)) {
              normalizedFloor = trimmed;
            } else {
              const alias = FLOOR_LEVEL_ALIASES.get(trimmed.toLowerCase());
              normalizedFloor = alias || FLOOR_LEVEL_BY_NUMBER[Number(trimmed)] || null;
            }
          }
          layoutContent.floor_level =
            normalizedFloor === undefined ? null : normalizedFloor ?? null;
        }

        if (
          layoutContent.story_type !== undefined &&
          layoutContent.story_type !== null &&
          !STORY_TYPE_ALLOWED.has(layoutContent.story_type)
        ) {
          layoutContent.story_type = null;
        }

        if (layoutContent.space_type !== undefined) {
          const rawSpaceType =
            layoutContent.space_type === null
              ? null
              : String(layoutContent.space_type).trim();
          let normalizedSpaceType = rawSpaceType;
          if (rawSpaceType) {
            if (!LAYOUT_SPACE_TYPE_ALLOWED.has(rawSpaceType)) {
              const alias = LAYOUT_SPACE_TYPE_ALIASES.get(rawSpaceType.toLowerCase());
              if (alias && LAYOUT_SPACE_TYPE_ALLOWED.has(alias)) {
                normalizedSpaceType = alias;
              } else {
                normalizedSpaceType = null;
              }
            }
          }
          layoutContent.space_type = normalizedSpaceType;
        }

        REQUIRED_LAYOUT_FIELDS.forEach((field) => {
          if (layoutContent[field] === undefined) {
            layoutContent[field] = null;
          }
        });
delete layoutContent.space_type_indexer;

        const preferredName =
          node.outputFileName || `layout_${node.originalIndex + 1}.json`;
        const fileName = getUniqueLayoutFileName(preferredName);
        node.assignedFileName = fileName;
        writeJSON(path.join(dataDir, fileName), layoutContent);
        allLayoutFiles.push(fileName);
        layoutIdToFile.set(node.localId, fileName);
        endpointMetaByFile.set(fileName, {
          space_type_index:
            layoutContent.space_type_index !== undefined
              ? layoutContent.space_type_index
              : spaceTypeIndexerValue,
          space_type_indexer: spaceTypeIndexerValue,
        });
        if (!node.parentLocalId) topLevelLayoutFiles.push(fileName);
        if (isBuildingLayout(layoutContent)) {
          buildingLayoutFiles.push(fileName);
        }
      });

      layoutNodes.forEach((node) => {
        if (!node.parentLocalId) return;
        const parentFile = layoutIdToFile.get(node.parentLocalId);
        const childFile = layoutIdToFile.get(node.localId);
        if (!parentFile || !childFile) return;
        layoutParentLinks.push({ parentFile, childFile });
      });
    }
  }

  const buildRelEndpoint = (fileName) => {
    return { "/": `./${fileName}` };
  };

  layoutParentLinks.forEach((link) => {
    const rel = {
      from: buildRelEndpoint(link.parentFile),
      to: buildRelEndpoint(link.childFile),
    };
    const relFile = createRelationshipFileName(
      link.parentFile,
      link.childFile,
    );
    writeJSON(path.join(dataDir, relFile), rel);
  });

  const propertyFileName = "property.json";
  buildingLayoutFiles.sort();
  structureFiles.sort();
  utilityFiles.sort();
  const writeRelationshipFile = (fromFile, toFile, suffix = null) => {
    const rel = {
      from: endpointMetaByFile.has(fromFile)
        ? buildRelEndpoint(fromFile)
        : { "/": `./${fromFile}` },
      to: endpointMetaByFile.has(toFile)
        ? buildRelEndpoint(toFile)
        : { "/": `./${toFile}` },
    };
    const relFile = createRelationshipFileName(fromFile, toFile, suffix);
    writeJSON(path.join(dataDir, relFile), rel);
  };

  const propertyLayoutTargets =
    buildingLayoutFiles.length > 0
      ? buildingLayoutFiles.slice()
      : topLevelLayoutFiles.slice();

  if (propertyLayoutTargets.length > 0) {
    propertyLayoutTargets.forEach((layoutFile, idx) => {
      const suffix =
        propertyLayoutTargets.length === 1 ? null : idx + 1;
      writeRelationshipFile(propertyFileName, layoutFile, suffix);
    });
  }

  if (structureFiles.length > 0) {
    if (buildingLayoutFiles.length === 0) {
      structureFiles.forEach((structureFile, index) => {
        const suffix = structureFiles.length === 1 ? null : index + 1;
        writeRelationshipFile(propertyFileName, structureFile, suffix);
      });
    } else if (buildingLayoutFiles.length === 1) {
      const layoutFile = buildingLayoutFiles[0];
      structureFiles.forEach((structureFile) => {
        writeRelationshipFile(layoutFile, structureFile, null);
      });
    } else {
      if (structureFiles.length === 1) {
        writeRelationshipFile(propertyFileName, structureFiles[0], null);
      } else {
        const pairCount = Math.min(
          structureFiles.length,
          buildingLayoutFiles.length,
        );
        for (let i = 0; i < pairCount; i += 1) {
          writeRelationshipFile(
            buildingLayoutFiles[i],
            structureFiles[i],
            null,
          );
        }
        const leftoverCount = structureFiles.length - pairCount;
        if (leftoverCount > 0) {
          for (let i = pairCount; i < structureFiles.length; i += 1) {
            const suffix =
              leftoverCount === 1 ? null : i - pairCount + 1;
            writeRelationshipFile(
              propertyFileName,
              structureFiles[i],
              suffix,
            );
          }
        }
      }
    }
  }

  if (utilityFiles.length > 0) {
    if (buildingLayoutFiles.length === 0) {
      utilityFiles.forEach((utilityFile, index) => {
        const suffix = utilityFiles.length === 1 ? null : index + 1;
        writeRelationshipFile(propertyFileName, utilityFile, suffix);
      });
    } else if (buildingLayoutFiles.length === 1) {
      const layoutFile = buildingLayoutFiles[0];
      utilityFiles.forEach((utilityFile) => {
        writeRelationshipFile(layoutFile, utilityFile, null);
      });
    } else {
      if (utilityFiles.length === 1) {
        writeRelationshipFile(propertyFileName, utilityFiles[0], null);
      } else {
        const pairCount = Math.min(
          utilityFiles.length,
          buildingLayoutFiles.length,
        );
        for (let i = 0; i < pairCount; i += 1) {
          writeRelationshipFile(
            buildingLayoutFiles[i],
            utilityFiles[i],
            null,
          );
        }
        const leftoverCount = utilityFiles.length - pairCount;
        if (leftoverCount > 0) {
          for (let i = pairCount; i < utilityFiles.length; i += 1) {
            const suffix =
              leftoverCount === 1 ? null : i - pairCount + 1;
            writeRelationshipFile(
              propertyFileName,
              utilityFiles[i],
              suffix,
            );
          }
        }
      }
    }
  }

  // Owners: person_*.json or company_*.json
  const personFiles = [];
  const companyFiles = [];
  const ownerKeysByDate = new Map();
  const ownerKeyToFile = new Map();
  const resolvedOwnerRecord = resolveRecordForKey(ownerData, propertyKey);
  console.log("Resolved Owner Record for processing:", JSON.stringify(resolvedOwnerRecord, null, 2)); // DEBUG LOG

  // Make sure seenOwners is declared before sales processing
  const seenOwners = new Map();

  if (resolvedOwnerRecord && resolvedOwnerRecord.owners_by_date) {
    const ownersByDate = resolvedOwnerRecord.owners_by_date;
    console.log("OwnersByDate for iteration:", JSON.stringify(ownersByDate, null, 2)); // DEBUG LOG

    const registerOwnerForDate = (dateKey, ownerKey) => {
      if (!ownerKey) return;
      const normalizedKey =
        dateKey && typeof dateKey === "string" ? dateKey : "unknown";
      if (!ownerKeysByDate.has(normalizedKey)) {
        ownerKeysByDate.set(normalizedKey, new Set());
      }
      ownerKeysByDate.get(normalizedKey).add(ownerKey);
    };
    const pushOwner = (owner) => {
      if (!owner) return;
      const ownerType = (owner.type || "").toString().toLowerCase();
      if (ownerType === "person") {
        const first = properCaseName(owner.first_name || null);
        const last = properCaseName(owner.last_name || null);
        if (!first || !last) return;
        const middle = owner.middle_name ? owner.middle_name : null;
        const prefixName = owner.prefix_name ? owner.prefix_name : null;
        const suffixName = owner.suffix_name ? owner.suffix_name : null;
        const key = `person:${[first, middle, last, prefixName, suffixName]
          .map((part) => (part || "").trim().toLowerCase())
          .filter(Boolean) // Filter out empty parts for a cleaner key
          .join("|")}`;
        if (seenOwners.has(key)) return;
        seenOwners.set(key, {
          type: "person",
          payload: {
            birth_date: null,
            first_name: first,
            last_name: last,
            middle_name: middle,
            prefix_name: prefixName,
            suffix_name: suffixName,
            us_citizenship_status: null,
            veteran_status: null,
          },
        });
        console.log("Pushed person owner to seenOwners:", key, seenOwners.get(key)); // DEBUG LOG
        return key;
      } else if (ownerType === "company") {
        const rawName = owner.name || owner.company_name || owner.organization_name;
        if (!rawName) return;
        const normalized = rawName.replace(/\s+/g, " ").trim();
        if (!normalized) return;
        const key = `company:${normalized.toLowerCase()}`;
        if (seenOwners.has(key)) return;
        seenOwners.set(key, {
          type: "company",
          payload: { name: normalized },
        });
        console.log("Pushed company owner to seenOwners:", key, seenOwners.get(key)); // DEBUG LOG
        return key;
      }
    };

    Object.entries(ownersByDate).forEach(([dateKey, entry]) => {
      console.log(`Iterating ownersByDate: dateKey='${dateKey}', entry type='${Array.isArray(entry) ? 'array' : typeof entry}'`); // DEBUG LOG
      const ownersArray = Array.isArray(entry)
        ? entry
        : entry && typeof entry === "object" && entry.type
        ? [entry]
        : [];
      ownersArray.forEach((owner) => {
        const ownerKey = pushOwner(owner);
        if (ownerKey) registerOwnerForDate(dateKey, ownerKey);
      });
    });
  }

  // sales_history_*.json, deed_*.json, file_*.json + relationships + buyer processing
  const salesHistoryFiles = [];
  const salesHistoryMeta = [];
  const deedFiles = [];
  const fileFiles = [];
  const salesBuyerFiles = []; // Track buyer files for each sale
  const allBuyerOwnerKeys = new Set(); // Track all buyer keys globally

  (bx.sales || []).forEach((sale, index) => {
    const saleFileName = `sales_history_${index + 1}.json`;
    const ownershipTransferDate =
      sale.ownership_transfer_date || sale.sale_date || null;
    const saleObj = {
      ownership_transfer_date: ownershipTransferDate,
    };
    if (sale.sale_price != null) {
      saleObj.purchase_price_amount = sale.sale_price;
    }
    writeJSON(path.join(dataDir, saleFileName), saleObj);
    salesHistoryFiles.push(saleFileName);

    // Process buyers for this specific sale
    const saleBuyerKeys = new Set();
    if (sale.buyer) {
      const buyerCandidates = splitOwnerCandidates(sale.buyer);
      buyerCandidates.forEach((buyerRaw) => {
        if (!buyerRaw || /^none$/i.test(buyerRaw)) return;

        // Process buyer similar to owner processing
        let buyer = null;
        if (isCompanyName(buyerRaw)) {
          buyer = { type: "company", name: buyerRaw.trim() };
        } else {
          const person = parsePersonName(buyerRaw, "buyer");
          if (person && person.first_name && person.last_name) {
            buyer = person;
          }
        }

        if (buyer) {
          // Create buyer key similar to owner key creation
          let buyerKey = null;
          if (buyer.type === "company") {
            const normalized = buyer.name.replace(/\s+/g, " ").trim();
            buyerKey = `company:${normalized.toLowerCase()}`;
          } else {
            const parts = [buyer.first_name, buyer.middle_name, buyer.last_name]
              .map((part) => (part || "").trim().toLowerCase())
              .filter(Boolean);
            buyerKey = `person:${parts.join(" ")}`;
          }

          if (buyerKey) {
            saleBuyerKeys.add(buyerKey);
            allBuyerOwnerKeys.add(buyerKey);

            // Add to global owner tracking for file creation
            if (!seenOwners.has(buyerKey)) {
              if (buyer.type === "company") {
                seenOwners.set(buyerKey, {
                  type: "company",
                  payload: { name: buyer.name },
                });
              } else {
                const first = properCaseName(buyer.first_name || null);
                const last = properCaseName(buyer.last_name || null);
                const middle = buyer.middle_name ? buyer.middle_name : null;
                const prefixName = buyer.prefix_name ? buyer.prefix_name : null;
                const suffixName = buyer.suffix_name ? buyer.suffix_name : null;

                seenOwners.set(buyerKey, {
                  type: "person",
                  payload: {
                    birth_date: null,
                    first_name: first,
                    last_name: last,
                    middle_name: middle,
                    prefix_name: prefixName,
                    suffix_name: suffixName,
                    us_citizenship_status: null,
                    veteran_status: null,
                  },
                });
              }
            }
          }
        }
      });
    }

    salesHistoryMeta.push({
      file: saleFileName,
      ownership_transfer_date: saleObj.ownership_transfer_date,
      buyer_keys: Array.from(saleBuyerKeys),
      index,
    });

    // Store buyer files for this sale (will be populated after file creation)
    salesBuyerFiles.push({
      saleFile: saleFileName,
      buyerKeys: Array.from(saleBuyerKeys),
      buyerFiles: [] // Will be populated later
    });

    // Create deed and file objects as before
    const deedFileName = `deed_${index + 1}.json`;
    const deedObj = {
      deed_type: normalizeDeedType(sale.instrument),
    };
    const bookVal = sale.book != null && String(sale.book).trim() ? String(sale.book).trim() : null;
    const pageVal = sale.page != null && String(sale.page).trim() ? String(sale.page).trim() : null;
    const volumeVal = sale.volume != null && String(sale.volume).trim() ? String(sale.volume).trim() : null;
    const instrumentNumberRaw = sale.instrument_number != null ? String(sale.instrument_number).trim() : "";
    if (bookVal) deedObj.book = bookVal;
    if (pageVal) deedObj.page = pageVal;
    if (volumeVal) deedObj.volume = volumeVal;
    if (instrumentNumberRaw) deedObj.instrument_number = instrumentNumberRaw;
    writeJSON(path.join(dataDir, deedFileName), deedObj);
    deedFiles.push(deedFileName);

    const fileFileName = `file_${index + 1}.json`;
    const documentType = coerceFileDocumentType(mapFileDocumentType(sale.instrument));
    const fileObj = {
      document_type: documentType,
      file_format: null,
      ipfs_url: null,
      name: sale.document_name || null,
      original_url: sale.document_url || null,
    };
    writeJSON(path.join(dataDir, fileFileName), fileObj);
    fileFiles.push(fileFileName);
  });

  // Now that all owners (including buyers from sales) are collected in seenOwners, create their files
  let personIndex = 1;
  let companyIndex = 1;
  const ownerEntries = [];
  seenOwners.forEach((info, key) => {
    ownerEntries.push([key, info]);
  });

  ownerEntries.forEach(([key, info]) => {
    if (info.type === "person") {
      const file = `person_${personIndex}.json`;
      writeJSON(path.join(dataDir, file), info.payload);
      personFiles.push(file);
      ownerKeyToFile.set(key, file);
      personIndex += 1;
      console.log("Created person file:", file, info.payload); // DEBUG LOG
    } else if (info.type === "company") {
      const file = `company_${companyIndex}.json`;
      writeJSON(path.join(dataDir, file), info.payload);
      companyFiles.push(file);
      ownerKeyToFile.set(key, file);
      companyIndex += 1;
      console.log("Created company file:", file, info.payload); // DEBUG LOG
    }
  });

  console.log("All person files created:", personFiles); // DEBUG LOG
  console.log("All company files created:", companyFiles); // DEBUG LOG

  // Update salesBuyerFiles with actual file names after owner files are created
  salesBuyerFiles.forEach((saleInfo) => {
    saleInfo.buyerKeys.forEach((buyerKey) => {
      const buyerFile = ownerKeyToFile.get(buyerKey);
      if (buyerFile) {
        saleInfo.buyerFiles.push(buyerFile);
      }
    });
  });

  if (mailingAddressFile) {
    personFiles.forEach((pf) => {
      const rel = {
        from: { "/": `./${pf}` },
        to: { "/": `./${mailingAddressFile}` },
      };
      const relFile = createRelationshipFileName(pf, mailingAddressFile);
      writeJSON(path.join(dataDir, relFile), rel);
    });
    companyFiles.forEach((cf) => {
      const rel = {
        from: { "/": `./${cf}` },
        to: { "/": `./${mailingAddressFile}` },
      };
      const relFile = createRelationshipFileName(cf, mailingAddressFile);
      writeJSON(path.join(dataDir, relFile), rel);
    });
  }

  // relationship_deed_file_*.json (file → deed)
  for (let i = 0; i < Math.min(deedFiles.length, fileFiles.length); i++) {
    writeRelationshipFile(fileFiles[i], deedFiles[i]);
  }

  // relationship_sales_history_deed_*.json (sales_history → deed)
  for (let i = 0; i < Math.min(salesHistoryFiles.length, deedFiles.length); i++) {
    writeRelationshipFile(salesHistoryFiles[i], deedFiles[i]);
  }

  // Create relationships between sales and their specific buyers
  salesBuyerFiles.forEach((saleInfo) => {
    if (saleInfo.buyerFiles.length > 0) {
      saleInfo.buyerFiles.forEach((buyerFile, idx) => {
        const suffix = saleInfo.buyerFiles.length === 1 ? null : `buyer_${idx + 1}`;
        writeRelationshipFile(saleInfo.saleFile, buyerFile, suffix);
      });
    }
  });

  // Property Improvements / Permits
  const propertyImprovementFiles = [];
  let improvementsFromJson = false;
  if (
    INPUT_JSON &&
    Array.isArray(INPUT_JSON.parcelExtraFeatures) &&
    INPUT_JSON.parcelExtraFeatures.length
  ) {
    let improvementIndex = 1;
    INPUT_JSON.parcelExtraFeatures.forEach((feature) => {
      if (!feature) return;
      const improvementType = mapMiscImprovementType(
        feature.xfobCode || null,
        feature.descShort || "",
      );
      if (!improvementType) return;
      const improvement = {
        improvement_type: improvementType,
        improvement_status: null,
        completion_date: null,
        contractor_type: null,
        permit_required: false,
      };
      const fileName = `property_improvement_${improvementIndex}.json`;
      writeJSON(path.join(dataDir, fileName), improvement);
      propertyImprovementFiles.push(fileName);
      improvementIndex += 1;
    });
    if (propertyImprovementFiles.length) improvementsFromJson = true;
  }

  if (!improvementsFromJson) {
    const improvementSelectors = [
      "#cphMain_gvImprovements",
      "#cphMain_gvPermits",
      "#cphMain_gvPermit",
      "#cphMain_gvBuildingPermits",
    ];
    const improvementRows = [];
    const seenImprovementRows = new Set();

  const buildPermitHeaderMap = ($headerCells) => {
    const map = {
      raw: [],
      permitNumber: null,
      type: null,
      description: null,
      status: null,
      issueDate: null,
      finalDate: null,
      applicationDate: null,
      closeDate: null,
      action: null,
    };
    $headerCells.each((idx, th) => {
      const label = textNormalize($(th).text());
      if (!label) return;
      const lower = label.toLowerCase();
      map.raw[idx] = lower;
      if (
        map.permitNumber == null &&
        /(permit|application)\s*(#|number|no)/.test(lower)
      ) {
        map.permitNumber = idx;
      }
      if (map.type == null && /\btype\b/.test(lower)) {
        map.type = idx;
      }
      if (map.description == null && /description/.test(lower)) {
        map.description = idx;
      }
      if (map.status == null && /status/.test(lower)) {
        map.status = idx;
      }
      if (map.issueDate == null && /(issue|issued)/.test(lower)) {
        map.issueDate = idx;
      }
      if (
        map.finalDate == null &&
        /(final|complete|completion)/.test(lower)
      ) {
        map.finalDate = idx;
      }
      if (
        map.applicationDate == null &&
        /(appl|application|received)/.test(lower)
      ) {
        map.applicationDate = idx;
      }
      if (map.closeDate == null && /close/.test(lower)) {
        map.closeDate = idx;
      }
      if (
        map.action == null &&
        /(work|scope|description|improvement)/.test(lower)
      ) {
        map.action = idx;
      }
    });
    if (map.action == null && map.description != null) {
      map.action = map.description;
    }
    return map;
  };

  const collectImprovementRows = ($table) => {
    if (!$table || !$table.length) return 0;
    let headerMap = null;
    let added = 0;
    $table.find("tr").each((_, tr) => {
      if (seenImprovementRows.has(tr)) return;
      const $tr = $(tr);
      const headerCells = $tr.find("th");
      if (headerCells.length > 0) {
        headerMap = buildPermitHeaderMap(headerCells);
        return;
      }
      const tds = $tr.find("td");
      if (tds.length === 0) return;
      const cells = [];
      tds.each((idx, td) => {
        cells.push(textNormalize($(td).text()));
      });
      const hasContent = cells.some((value) => value && value.length > 0);
      if (!hasContent) return;
      seenImprovementRows.add(tr);
      improvementRows.push({
        cells,
        headerMap,
      });
      added += 1;
    });
    return added;
  };

    improvementSelectors.forEach((selector) => {
      const table = $(selector);
      if (!table || table.length === 0) return;
      collectImprovementRows(table);
    });

    if (improvementRows.length === 0) {
      $("table").each((_, tbl) => {
        const $tbl = $(tbl);
        const headerText = textNormalize($tbl.find("th").first().text() || "");
        if (!/permit/i.test(headerText)) return;
        collectImprovementRows($tbl);
      });
    }

    const normalizePermitDate = (value) => {
      if (!value) return null;
      const text = String(value).trim();
      if (!text || text === "--") return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const match = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (!match) return null;
      let candidate = match[1];
      const twoDigit = candidate.match(/(\d{1,2}\/\d{1,2})\/(\d{2})$/);
      if (twoDigit) {
        const yearNum = parseInt(twoDigit[2], 10);
        const fullYear = yearNum >= 70 ? `19${twoDigit[2]}` : `20${twoDigit[2]}`;
        candidate = `${twoDigit[1]}/${fullYear}`;
      }
      return toISODate(candidate);
    };

    if (improvementRows.length > 0) {
      let improvementIndex = 1;
      improvementRows.forEach((rowInfo) => {
        const header = rowInfo.headerMap || {};
        const cells = rowInfo.cells || [];
        if (!cells.length) return;

        const getCell = (idx) =>
          idx != null && idx >= 0 && idx < cells.length ? cells[idx] : null;

        let permitNumber = getCell(header.permitNumber);
        if (!permitNumber && cells.length > 0) {
          permitNumber = cells[0];
        }
        if (permitNumber) {
          permitNumber = permitNumber.replace(/^#/, "").trim();
          if (!permitNumber) permitNumber = null;
        }

        const typeText =
          getCell(header.type) ||
          getCell(header.description) ||
          getCell(header.action) ||
          (cells.length > 1 ? cells[1] : cells[0] || "");
        const actionText =
          getCell(header.action) ||
          getCell(header.description) ||
          (typeText || "");

        const statusText = getCell(header.status);
        const issueDateRaw = getCell(header.issueDate);
        const finalDateRaw = getCell(header.finalDate);
        const closeDateRaw = getCell(header.closeDate);
        const applicationDateRaw = getCell(header.applicationDate);

        const typeTextClean = typeText || "";
        const codeMatch = typeTextClean.match(/\(([^)]+)\)/);
        const rawCode = codeMatch ? codeMatch[1].trim().toUpperCase() : null;
        const baseCode = rawCode ? rawCode.replace(/[^A-Z]/g, "") : null;
        const description = typeTextClean.replace(/\([^)]*\)/g, "").trim();
        const improvementType = mapMiscImprovementType(
          baseCode,
          description || actionText || typeTextClean,
        );
        if (!improvementType) return;

        const permitIssueDate = normalizePermitDate(issueDateRaw);
        const completionDate =
          normalizePermitDate(finalDateRaw) || normalizePermitDate(closeDateRaw);
        const permitCloseDate = normalizePermitDate(closeDateRaw);
        const applicationDate = normalizePermitDate(applicationDateRaw);

        let improvementStatus = coerceImprovementStatus(statusText);
        if (!improvementStatus) {
          if (completionDate) improvementStatus = "Completed";
          else if (permitIssueDate) improvementStatus = "Permitted";
        }

        const improvementAction = description || actionText || null;

        const improvement = {
          improvement_type: improvementType,
          improvement_status: improvementStatus,
          improvement_action: improvementAction || null,
          permit_number: permitNumber || null,
          permit_issue_date: permitIssueDate || null,
          completion_date: completionDate || null,
          permit_close_date: permitCloseDate || null,
          application_received_date: applicationDate || null,
        };
        if (permitNumber) {
          improvement.permit_required = true;
        }

        Object.keys(improvement).forEach((key) => {
          const value = improvement[key];
          if (value === undefined) {
            delete improvement[key];
          } else if (typeof value === "string") {
            const trimmed = value.trim();
            improvement[key] = trimmed ? trimmed : null;
          }
        });

        const fileName = `property_improvement_${improvementIndex}.json`;
        writeJSON(path.join(dataDir, fileName), improvement);
        propertyImprovementFiles.push(fileName);
        improvementIndex += 1;
      });
    }
  }

  propertyImprovementFiles.forEach((fileName) => {
    writeRelationshipFile(propertyFileName, fileName);
  });

  if (missingDorCodes.size > 0) {
    console.warn(
      `Unmapped DOR codes encountered: ${Array.from(missingDorCodes).join(", ")}`,
    );
  }
}

main();
