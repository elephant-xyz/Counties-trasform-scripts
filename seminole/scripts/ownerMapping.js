// Transformation script: Parse input.html with cheerio, extract owners, classify, and output JSON per schema
// Usage: node scripts/ownerMapping.js
// Requirements: Only cheerio for HTML parsing; vanilla JS for processing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Paths
const INPUT_PATH = path.join(process.cwd(), "input.html");
const OUTPUT_DIR = path.join(process.cwd(), "owners");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "owner_data.json");

// Load HTML and extract JSON from <pre>
const html = fs.readFileSync(INPUT_PATH, "utf8");
const $ = cheerio.load(html);
const preText = $("pre").first().text().trim();
const data = JSON.parse(preText);

// Helpers
function normWS(s) {
  return String(s || "")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

const COMPANY_REGEX = new RegExp(
  [
    "inc",
    "l\\.?l\\.?c",
    "l\\.?l\\.?l\\.?p",
    "ltd",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "\\bco\\b",
    "company",
    "services",
    "trust",
    "\\btr\\b",
    "assn",
    "association",
    "partners",
    "\\blp\\b",
    "\\bllp\\b",
    "\\blllp\\b",
    "\\bpllc\\b",
    "\\bpc\\b",
    "bank",
    "credit union",
    "mortgage",
    "holdings",
    "properties",
    "management",
    "realty",
    "hoa",
    "condo",
    "church",
    "ministries",
    "university",
    "school",
    "dept",
    "department",
  ].join("|"),
  "i",
);

function isLikelyCompany(name) {
  const s = normWS(name);
  if (!s) return false;
  return COMPANY_REGEX.test(s);
}

function ownerDedupKey(owner) {
  if (!owner) return null;
  if (owner.type === "company")
    return `company:${normWS(owner.name).toLowerCase()}`;
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .filter(Boolean)
    .map((x) => normWS(x).toLowerCase());
  return `person:${parts.join(" ")}`;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanNameString(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;

  // Remove digits and any characters that are not letters or allowed separators (space, hyphen, apostrophe, comma, period)
  const cleaned = str.replace(/[^a-zA-Z\s\-',.]/g, '');

  // Remove multiple consecutive separators
  const normalized = cleaned.replace(/[\s\-',.]+/g, (match) => {
    // Keep only the first separator character
    return match.charAt(0);
  });

  const trimmed = normalized.trim();
  return trimmed || null;
}

function isValidName(s) {
  if (!s) return false;
  const str = String(s).trim();
  if (!str) return false;
  // Pattern: must start with uppercase letter, followed by letters, spaces, hyphens, apostrophes, commas, or periods
  const namePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  return namePattern.test(str);
}

function isValidFirstOrLastName(s) {
  if (!s) return false;
  const str = String(s).trim();
  if (!str) return false;
  // Pattern from Elephant schema: must start with uppercase letter, followed by lowercase letters, then optional (separator + letter + lowercase letters)
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  return namePattern.test(str);
}

function properCaseName(s) {
  if (!s) return s;

  // Convert to string and trim whitespace
  const str = String(s).trim();
  if (!str) return str;

  // Normalize whitespace (replace multiple spaces with single space)
  const normalized = str.replace(/\s+/g, ' ');

  // Split on word boundaries (spaces, hyphens, apostrophes) while preserving separators
  const words = normalized.split(/(\s+|[-',.])/);

  // Capitalize each word segment (non-separator parts)
  const result = words.map((word, index) => {
    // If it's a separator or empty, keep as-is
    if (!word || /^[\s\-',.]$/.test(word)) {
      return word;
    }

    // Capitalize first letter, lowercase the rest
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');

  // Remove trailing separators (apostrophes, hyphens, commas, periods) and trim
  return result.replace(/[\s\-',.]+$/, '').trim();
}

function normalizeSuffix(suffix) {
  if (!suffix) return null;
  const s = String(suffix).trim().toUpperCase();
  if (!s) return null;

  // Mapping of common variations to allowed enum values
  const suffixMap = {
    "JR": "Jr.",
    "JR.": "Jr.",
    "JUNIOR": "Jr.",
    "SR": "Sr.",
    "SR.": "Sr.",
    "SENIOR": "Sr.",
    "II": "II",
    "2ND": "II",
    "SECOND": "II",
    "III": "III",
    "3RD": "III",
    "THIRD": "III",
    "IV": "IV",
    "4TH": "IV",
    "FOURTH": "IV",
    "PHD": "PhD",
    "PH.D.": "PhD",
    "PH.D": "PhD",
    "MD": "MD",
    "M.D.": "MD",
    "M.D": "MD",
    "ESQ": "Esq.",
    "ESQ.": "Esq.",
    "ESQUIRE": "Esq.",
    "JD": "JD",
    "J.D.": "JD",
    "J.D": "JD",
    "LLM": "LLM",
    "LL.M.": "LLM",
    "LL.M": "LLM",
    "MBA": "MBA",
    "M.B.A.": "MBA",
    "M.B.A": "MBA",
    "RN": "RN",
    "R.N.": "RN",
    "R.N": "RN",
    "DDS": "DDS",
    "D.D.S.": "DDS",
    "D.D.S": "DDS",
    "DVM": "DVM",
    "D.V.M.": "DVM",
    "D.V.M": "DVM",
    "CFA": "CFA",
    "C.F.A.": "CFA",
    "C.F.A": "CFA",
    "CPA": "CPA",
    "C.P.A.": "CPA",
    "C.P.A": "CPA",
    "PE": "PE",
    "P.E.": "PE",
    "P.E": "PE",
    "PMP": "PMP",
    "P.M.P.": "PMP",
    "P.M.P": "PMP",
    "EMERITUS": "Emeritus",
    "RET": "Ret.",
    "RET.": "Ret.",
    "RETIRED": "Ret.",
  };

  const mapped = suffixMap[s];
  if (mapped) return mapped;

  // If already in correct format, return as-is
  const allowedValues = [
    "Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM",
    "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."
  ];

  for (const allowed of allowedValues) {
    if (allowed.toUpperCase() === s) return allowed;
  }

  // Return null if no match found - validation will catch this
  return null;
}

function parsePersonName(raw, inferredLastName) {
  const s = normWS(raw);
  if (!s) return null;

  // Helper to validate that a name starts with a letter
  const isValidName = (name) => {
    if (!name) return false;
    const trimmed = normWS(name);
    // Must start with a letter (not number or special char)
    return /^[a-zA-Z]/.test(trimmed);
  };

  if (s.includes(",")) {
    const [lastPart, rest] = s.split(",").map(normWS);
    if (!rest) return null;
    const tokens = rest.split(" ").map(normWS).filter(Boolean);
    if (!tokens.length) return null;
    const first = tokens.shift();

    // Extract suffix and clean up extraneous text
    let suffix = null;
    let middleTokens = [];
    for (const token of tokens) {
      const tokenUpper = token.toUpperCase().replace(/\./g, '');
      // Check if it's a recognized suffix
      if (/^(JR|SR|II|III|IV|V|PHD|MD|ESQ|JD|LLM|MBA|RN|DDS|DVM|CFA|CPA|PE|PMP|EMERITUS|RET)$/i.test(tokenUpper)) {
        suffix = token;
        break; // Stop processing after finding suffix
      }
      // Skip common non-name labels
      if (/^(ENH|LIFE|EST|ESTATE|TRUST|TR|TRUSTEE|REV|REVOCABLE)$/i.test(tokenUpper)) {
        break; // Stop processing when we hit these labels
      }
      middleTokens.push(token);
    }
    let middle = middleTokens.length ? middleTokens.join(" ") : null;
    const middleValid = middle && isValidName(middle) ? normWS(middle) : null;

    let middle = middleTokens.length ? middleTokens.join(" ") : null;
    const middleValid = middle && isValidName(middle) ? normWS(middle) : null;

    // Validate first and last names
    if (!isValidName(first) || !isValidName(lastPart)) {
      return null;
    }

    // Clean names to remove invalid characters (like digits)
    const firstCleaned = cleanNameString(first);
    const lastCleaned = cleanNameString(lastPart);
    const middleCleaned = middleValid ? cleanNameString(middleValid) : null;

    if (!firstCleaned || !lastCleaned) {
      return null;
    }

    const firstProper = properCaseName(firstCleaned);
    const lastProper = properCaseName(lastCleaned);
    const middleProper = middleCleaned ? properCaseName(middleCleaned) : null;

    // Validate with strict pattern
    if (!isValidFirstOrLastName(firstProper) || !isValidFirstOrLastName(lastProper)) {
      return null;
    }

    const person = {
      type: "person",
      first_name: firstProper,
      last_name: lastProper,
      middle_name: middleProper,
    };

    // Normalize and add suffix if found
    if (suffix) {
      const normalizedSuffix = normalizeSuffix(suffix);
      if (normalizedSuffix) {
        person.suffix_name = normalizedSuffix;
      }
    }

    return person;
  }

  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    if (inferredLastName && isValidName(tokens[0]) && isValidName(inferredLastName)) {
      const firstCleaned = cleanNameString(tokens[0]);
      const lastCleaned = cleanNameString(inferredLastName);

      if (!firstCleaned || !lastCleaned) {
        return null;
      }

      const firstProper = properCaseName(firstCleaned);
      const lastProper = properCaseName(lastCleaned);

      if (!isValidFirstOrLastName(firstProper) || !isValidFirstOrLastName(lastProper)) {
        return null;
      }

      return {
        type: "person",
        first_name: firstProper,
        last_name: lastProper,
        middle_name: null,
      };
    }
    return null;
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middleTokens = tokens.slice(1, -1);
  const middle = middleTokens.length ? middleTokens.join(" ") : null;
  const middleValid =
    middle && isValidName(middle) ? normWS(middle) : null;

  // Validate first and last names
  if (!isValidName(first) || !isValidName(last)) {
    return null;
  }

  // Clean names to remove invalid characters
  const firstCleaned = cleanNameString(first);
  const lastCleaned = cleanNameString(last);
  const middleCleaned = middleValid ? cleanNameString(middleValid) : null;

  if (!firstCleaned || !lastCleaned) {
    return null;
  }

  const firstProper = properCaseName(firstCleaned);
  const lastProper = properCaseName(lastCleaned);
  const middleProper = middleCleaned ? properCaseName(middleCleaned) : null;

  // Validate with strict pattern
  if (!isValidFirstOrLastName(firstProper) || !isValidFirstOrLastName(lastProper)) {
    return null;
  }

  return {
    type: "person",
    first_name: firstProper,
    last_name: lastProper,
    middle_name: middleProper,
  };
}

function processOwnerString(raw) {
  const result = { owners: [], invalids: [] };
  let s = normWS(raw);
  if (!s) {
    result.invalids.push({ raw: String(raw), reason: "empty_or_null" });
    return result;
  }

  if (isLikelyCompany(s)) {
    result.owners.push({ type: "company", name: s });
    return result;
  }

  if (s.includes("&")) {
    const parts = s.split("&").map((p) => normWS(p));
    let sharedLast = null;
    for (const p of parts) {
      if (p.includes(",")) {
        const beforeComma = normWS(p.split(",")[0]);
        if (beforeComma) sharedLast = beforeComma;
      } else {
        const toks = p.split(" ").filter(Boolean);
        if (toks.length >= 2) sharedLast = toks[toks.length - 1];
      }
    }
    for (const p of parts) {
      const person = parsePersonName(p, sharedLast);
      if (!person)
        result.invalids.push({
          raw: p,
          reason: "unparsable_person_with_ampersand",
        });
      else result.owners.push(person);
    }
    return result;
  }

  const person = parsePersonName(s, null);
  if (person) {
    result.owners.push(person);
    return result;
  }

  result.invalids.push({ raw: s, reason: "unclassified_owner" });
  return result;
}

function processOwnerObject(obj, options = {}) {
  const result = { owners: [], invalids: [] };
  const o = obj || {};
  const first = o.firstName || o.first || o.given || null;
  const last = o.lastName || o.last || o.surname || null;
  const middle = o.mi || o.middle || o.middleName || null;
  const entityName = o.entityName || o.name || null;
  const suffix = o.nameSuffix || o.suffix || null;
  const ownershipPercentage = toNumber(o.ownershipPercentage);
  const ownershipCode =
    o.ownershipCodeDescription || o.ownershipCodePrint || o.ownershipCode || null;
  const requestIdentifier = options.requestIdentifier || null;

  if (entityName && isLikelyCompany(entityName)) {
    const company = { type: "company", name: normWS(entityName) };
    if (ownershipPercentage !== null)
      company.ownership_percentage = ownershipPercentage;
    if (ownershipCode)
      company.ownership_type_description = normWS(ownershipCode);
    if (requestIdentifier) company.request_identifier = requestIdentifier;
    result.owners.push(company);
    return result;
  }

  if (first && last) {
    // Clean names to remove invalid characters
    const firstCleaned = cleanNameString(first);
    const lastCleaned = cleanNameString(last);

    if (!firstCleaned || !lastCleaned) {
      result.invalids.push({
        raw: JSON.stringify(o),
        reason: "invalid_names_after_cleaning",
      });
      return result;
    }

    const firstProper = properCaseName(firstCleaned);
    const lastProper = properCaseName(lastCleaned);

    // Validate with strict pattern
    if (!isValidFirstOrLastName(firstProper) || !isValidFirstOrLastName(lastProper)) {
      result.invalids.push({
        raw: JSON.stringify(o),
        reason: "names_do_not_match_pattern",
      });
      return result;
    }

    const middleNormalized = middle ? normWS(middle) : null;
    const middleValid = middleNormalized && isValidName(middleNormalized) ? middleNormalized : null;
    const middleCleaned = middleValid ? cleanNameString(middleValid) : null;
    const middleProper = middleCleaned ? properCaseName(middleCleaned) : null;

    const person = {
      type: "person",
      first_name: firstProper,
      last_name: lastProper,
      middle_name: middleProper,
    };
    // Normalize suffix to match allowed enum values
    const normalizedSuffix = suffix ? normalizeSuffix(suffix) : null;
    if (normalizedSuffix) person.suffix_name = normalizedSuffix;
    if (ownershipPercentage !== null)
      person.ownership_percentage = ownershipPercentage;
    if (ownershipCode)
      person.ownership_type_description = normWS(ownershipCode);
    if (requestIdentifier) person.request_identifier = requestIdentifier;
    result.owners.push(person);
    return result;
  }

  if (entityName) {
    const processed = processOwnerString(entityName);
    result.owners.push(...processed.owners);
    result.invalids.push(...processed.invalids);
    return result;
  }

  result.invalids.push({
    raw: JSON.stringify(o),
    reason: "unrecognized_owner_object",
  });
  return result;
}

function isOwnerishKey(lk) {
  if (!lk) return false;
  if (/ownership/.test(lk)) return false; // exclude ownership meta fields
  return /(\bowners?\b|ownername|owner_name|owner\d+|co[-_]?owner|primaryowner|secondaryowner|grantee|grantor|deed.*(holder|grantee|grantor)|titleholder|beneficiary)/i.test(
    lk,
  );
}

function collectOwnerCandidates(root) {
  const rawCandidates = [];

  function helper(node, inOwnerCtx = false) {
    if (node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) helper(item, inOwnerCtx);
      return;
    }

    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        const lk = String(k).toLowerCase();
        const nextOwnerCtx = inOwnerCtx || isOwnerishKey(lk);

        if (typeof v === "string") {
          if (isOwnerishKey(lk)) rawCandidates.push(v);
        } else if (Array.isArray(v)) {
          // traverse but do not push arrays as candidates
          helper(v, nextOwnerCtx);
        } else if (v && typeof v === "object") {
          if (isOwnerishKey(lk)) rawCandidates.push(v); // push only objects, not arrays
          helper(v, nextOwnerCtx);
        }
      }
      return;
    }
  }

  helper(root);
  return rawCandidates;
}

function getPropertyId(obj) {
  const candidates = [
    "property_id",
    "propertyId",
    "propId",
    "prop_id",
    "parcelNumber",
    "parcel",
    "parcelNumberFormatted",
    "apprId",
    "masterId",
    "id",
  ];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== null && val !== undefined && String(val).trim() !== "")
        return String(val).trim();
    }
  }
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === "object") {
      for (const [k, v] of Object.entries(cur)) {
        if (
          [
            "property_id",
            "propertyId",
            "propId",
            "prop_id",
            "parcelNumber",
            "parcelNumberFormatted",
            "apprId",
            "masterId",
            "parcel",
            "id",
          ].includes(k)
        ) {
          if (v !== null && v !== undefined && String(v).trim() !== "")
            return String(v).trim();
        }
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return "unknown_id";
}

const invalidOwners = [];
let rawOwnerCandidates = [];

if (Array.isArray(data.owners)) rawOwnerCandidates.push(...data.owners);
if (Array.isArray(data.ownerDetails))
  rawOwnerCandidates.push(...data.ownerDetails);
rawOwnerCandidates.push(...collectOwnerCandidates(data));

const ownerMap = new Map();

for (const candidate of rawOwnerCandidates) {
  if (candidate == null) continue;

  if (typeof candidate === "string") {
    const processed = processOwnerString(candidate);
    for (const o of processed.owners) {
      const key = ownerDedupKey(o);
      if (key && !ownerMap.has(key)) ownerMap.set(key, o);
    }
    for (const inv of processed.invalids) invalidOwners.push(inv);
  } else if (typeof candidate === "object") {
    const processed = processOwnerObject(candidate);
    for (const o of processed.owners) {
      const key = ownerDedupKey(o);
      if (key && !ownerMap.has(key)) ownerMap.set(key, o);
    }
    for (const inv of processed.invalids) invalidOwners.push(inv);
  }
}

const propId = getPropertyId(data);
const requestIdentifier = propId;
const ownerAttributes = {};

if (Array.isArray(data.ownerDetails)) {
  for (const detail of data.ownerDetails) {
    const processed = processOwnerObject(detail, { requestIdentifier });
    for (const inv of processed.invalids) invalidOwners.push(inv);
    for (const owner of processed.owners) {
      const key = ownerDedupKey(owner);
      if (!key) continue;
      const existing = ownerMap.get(key);
      if (existing) {
        if (owner.suffix_name && !existing.suffix_name)
          existing.suffix_name = owner.suffix_name;
        if (
          owner.ownership_percentage !== undefined &&
          owner.ownership_percentage !== null
        )
          existing.ownership_percentage = owner.ownership_percentage;
        if (
          owner.ownership_type_description &&
          !existing.ownership_type_description
        )
          existing.ownership_type_description =
            owner.ownership_type_description;
        if (owner.request_identifier && !existing.request_identifier)
          existing.request_identifier = owner.request_identifier;
      } else {
        ownerMap.set(key, owner);
      }
      ownerAttributes[key] = {
        ownership_percentage:
          owner.ownership_percentage ?? toNumber(detail.ownershipPercentage),
        ownership_code:
          detail.ownershipCodeDescription ||
          detail.ownershipCodePrint ||
          detail.ownershipCode ||
          null,
        request_identifier: requestIdentifier,
      };
    }
  }
}

const validOwners = Array.from(ownerMap.values());

const ownersByDate = {};

function findDateOwnerGroups(obj) {
  const groups = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      const keys = Object.keys(node);
      const lk = keys.map((k) => k.toLowerCase());
      const hasOwnerish = lk.some((k) => isOwnerishKey(k));
      const dateKey = keys.find((k) => /date/i.test(k));
      if (hasOwnerish && dateKey) {
        const dateVal = node[dateKey];
        const dateStr = normWS(String(dateVal || ""));
        if (dateStr) groups.push({ date: dateStr, node });
      }
      for (const v of Object.values(node)) walk(v);
    }
  }
  walk(obj);
  return groups;
}

function normalizeDate(dateStr) {
  const s = normWS(dateStr);
  if (!s) return null;
  const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
  const mUs = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mUs) {
    const mm = mUs[1].padStart(2, "0");
    const dd = mUs[2].padStart(2, "0");
    const yyyy = mUs[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const mYear = s.match(/^(\d{4})$/);
  if (mYear) return `${mYear[1]}-01-01`;
  return null;
}

const grouped = findDateOwnerGroups(data);
let unknownCounter = 0;
const datedOwners = [];

for (const g of grouped) {
  const dateKey = normalizeDate(g.date) || `unknown_date_${++unknownCounter}`;
  const groupCandidates = collectOwnerCandidates(g.node);
  const groupMap = new Map();
  for (const c of groupCandidates) {
    if (typeof c === "string") {
      const processed = processOwnerString(c);
      for (const o of processed.owners) {
        const key = ownerDedupKey(o);
        if (key && !groupMap.has(key)) groupMap.set(key, o);
      }
    } else if (typeof c === "object") {
      const processed = processOwnerObject(c);
      for (const o of processed.owners) {
        const key = ownerDedupKey(o);
        if (key && !groupMap.has(key)) groupMap.set(key, o);
      }
    }
  }
  const arr = Array.from(groupMap.values());
  if (arr.length) datedOwners.push({ key: dateKey, owners: arr });
}

datedOwners.sort((a, b) => {
  const aReal = /^\d{4}-\d{2}-\d{2}$/.test(a.key);
  const bReal = /^\d{4}-\d{2}-\d{2}$/.test(b.key);
  if (aReal && bReal) return a.key.localeCompare(b.key);
  if (aReal && !bReal) return -1;
  if (!aReal && bReal) return 1;
  return 0;
});

for (const g of datedOwners) {
  ownersByDate[g.key] = g.owners;
}

ownersByDate["current"] = validOwners;

const topKey = `property_${propId}`;

const result = {};
result[topKey] = {
  request_identifier: requestIdentifier,
  owners_by_date: ownersByDate,
  owner_attributes: ownerAttributes,
  invalid_owners: invalidOwners,
};

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result));
