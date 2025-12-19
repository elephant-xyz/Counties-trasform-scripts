const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Utility: normalize whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Utility: strip tags/comments and decode HTML entities
function cleanCandidateString(raw) {
  if (!raw) return "";
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, " ").replace(/<!---->/g, " ");
  const withoutTags = withoutComments.replace(/<[^>]+>/g, " ");
  // Load cheerio locally for this utility function to avoid global dependency
  const $temp = cheerio.load(`<div>${withoutTags}</div>`);
  const decoded = $temp.text();
  return norm(decoded);
}

// Utility: detect if a string looks like an address line (contains digits or zip or comma + state)
const looksLikeAddress = (s) => {
  const str = (s || "").toLowerCase();
  if (!str) return false;
  if (/\d/.test(str)) return true; // numbers typical for addresses
  if (/\b(po\s*box|p\.?\s*o\.?\s*box)\b/.test(str)) return true; // PO Box without digits fallback
  if (/,/.test(str) &&
      /\b(fl|ca|ny|tx|wa|ga|il|oh|pa|nc|va|az|nj|ma|mi|co|tn|in|mo|md|wi|mn|al|sc|la|ky|or|ok|ct|ia|ut|ms|ar|nv|nm|ne|wv|id|hi|nh|me|mt|ri|de|sd|nd|vt)\b/.test(str)
  ) {
    return true; // City, STATE pattern
  }
  return false;
};

// --- SCHEMA-DRIVEN PREFIXES AND SUFFIXES ---
const ALLOWED_PREFIXES = [
  "Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof.", "Rev.", "Fr.", "Sr.", "Br.",
  "Capt.", "Col.", "Maj.", "Lt.", "Sgt.", "Hon.", "Judge", "Rabbi", "Imam", "Sheikh",
  "Sir", "Dame"
];

const ALLOWED_SUFFIXES = [
  "Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM", "MBA", "RN",
  "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."
];

const prefixLookup = new Set(ALLOWED_PREFIXES.map(p => p.replace(/\./g, "").toLowerCase()));
const suffixLookup = new Set(ALLOWED_SUFFIXES.map(s => s.replace(/\./g, "").toLowerCase()));

function getMatchingPrefix(token) {
  const normalizedToken = token.replace(/\./g, "").toLowerCase();
  for (const prefix of ALLOWED_PREFIXES) {
    if (prefix.replace(/\./g, "").toLowerCase() === normalizedToken) {
      return prefix;
    }
  }
  return null;
}

function getMatchingSuffix(token) {
  const normalizedToken = token.replace(/\./g, "").toLowerCase();
  for (const suffix of ALLOWED_SUFFIXES) {
    if (suffix.replace(/\./g, "").toLowerCase() === normalizedToken) {
      return suffix;
    }
  }
  return null;
}

// --- LEGAL DESIGNATIONS ---
// Expanded to include more terms that are often legal designations rather than part of a name
const LEGAL_DESIGNATIONS_REGEX = new RegExp(
  "\\b(?:LIFE\\s*EST(?:ATE)?|EST(?:ATE)?|TRUST(?:EE)?|TR(?:USTEE)?|TTEE|REVOCABLE|IRREVOCABLE|EXECUTOR|EXR|ADMINISTRATOR|ADMR|PERSONAL\\s*REPRESENTATIVE|PR|HEIR|HEIRS|DECEASED|DEC'D|DEC|ET\\s*AL|ETAL|JTWROS|TENANTS?\\s*IN\\s*COMMON|TIC|TENANCY\\s*BY\\s*THE\\s*ENTIRETY|TBE|JOINT\\s*TENANTS?|JT|SURVIVOR|SURVIVORS?|AS\\s*TENANTS?\\s*IN\\s*COMMON|AS\\s*JOINT\\s*TENANTS?|AS\\s*COMMUNITY\\s*PROPERTY|AS\\s*SOLE\\s*AND\\s*SEPARATE\\s*PROPERTY|AS\\s*HUSBAND\\s*AND\\s*WIFE|AS\\s*COMMUNITY\\s*PROPERTY\\s*WITH\\s*RIGHT\\s*OF\\s*SURVIVORSHIP|A\\s*SINGLE\\s*MAN|A\\s*SINGLE\\s*WOMAN|A\\s*MARRIED\\s*MAN|A\\s*MARRIED\\s*WOMAN|A\\s*WIDOW|A\\s*WIDOWER|A\\s*PARTNERSHIP|A\\s*CORPORATION|A\\s*LIMITED\\s*LIABILITY\\s*COMPANY|A\\s*TRUST|A\\s*TRUSTEE|A\\s*FIDUCIARY|A\\s*BENEFICIARY|A\\s*GRANTOR|A\\s*GRANTEE|A\\s*DONOR|A\\s*DONEE|A\\s*SETTLOR|A\\s*SETTLEE|A\\s*DEVISEE|A\\s*LEGATEE|A\\s*ASSIGNEE|A\\s*ASSIGNOR|A\\s*MORTGAGEE|A\\s*MORTGAGOR|A\\s*LIENOR|A\\s*LIENEE|A\\s*GRANTOR\\s*TRUST|A\\s*NON-GRANTOR\\s*TRUST|A\\s*QUALIFIED\\s*PERSONAL\\s*RESIDENCE\\s*TRUST|QPRT|A\\s*CHARITABLE\\s*REMAINDER\\s*TRUST|CRT|A\\s*CHARITABLE\\s*LEAD\\s*TRUST|CLT|A\\s*SPECIAL\\s*NEEDS\\s*TRUST|SNT|A\\s*SUPPLEMENTAL\\s*NEEDS\\s*TRUST|SNT|A\\s*BLIND\\s*TRUST|A\\s*SPENDTHRIFT\\s*TRUST|A\\s*GENERATION-SKIPPING\\s*TRUST|GST|A\\s*LAND\\s*TRUST|A\\s*BUSINESS\\s*TRUST|A\\s*REAL\\s*ESTATE\\s*INVESTMENT\\s*TRUST|REIT|A\\s*FAMILY\\s*LIMITED\\s*PARTNERSHIP|FLP|A\\s*LIMITED\\s*LIABILITY\\s*PARTNERSHIP|LLP|A\\s*PROFESSIONAL\\s*CORPORATION|PC|A\\s*PROFESSIONAL\\s*LIMITED\\s*LIABILITY\\s*COMPANY|PLLC|A\\s*NON-PROFIT\\s*CORPORATION|A\\s*RELIGIOUS\\s*CORPORATION|A\\s*EDUCATIONAL\\s*CORPORATION|A\\s*CHARITABLE\\s*CORPORATION|A\\s*PUBLIC\\s*BENEFIT\\s*CORPORATION|A\\s*PRIVATE\\s*FOUNDATION|A\\s*PUBLIC\\s*CHARITY|A\\s*GOVERNMENTAL\\s*ENTITY|A\\s*MUNICIPALITY|A\\s*COUNTY|A\\s*STATE|THE\\s*UNITED\\s*STATES\\s*OF\\s*AMERICA|THE\\s*STATE\\s*OF|THE\\s*COUNTY\\s*OF|THE\\s*CITY\\s*OF|THE\\s*TOWN\\s*OF|THE\\s*VILLAGE\\s*OF|THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR)\\b",
  "gi"
);

function stripLegalDesignations(name) {
  let cleanedName = name;
  let match;
  const removedDesignations = [];

  // Use a loop to remove all occurrences and capture them
  // Reset lastIndex for each new string to ensure correct behavior with global regex
  LEGAL_DESIGNATIONS_REGEX.lastIndex = 0;
  while ((match = LEGAL_DESIGNATIONS_REGEX.exec(cleanedName)) !== null) {
    removedDesignations.push(match[0].trim());
    cleanedName = cleanedName.replace(match[0], " ").trim();
    // Reset lastIndex to avoid infinite loops with global regex and replace
    LEGAL_DESIGNATIONS_REGEX.lastIndex = 0;
  }

  // Remove any remaining commas or extra spaces after removal
  cleanedName = cleanedName.replace(/,+/g, " ").replace(/\s{2,}/g, " ").trim();

  return {
    cleanedName: cleanedName,
    removedDesignations: removedDesignations.length > 0 ? removedDesignations : null,
  };
}

// Company detection tokens (case-insensitive, word boundaries where possible)
// Refined to focus on actual business entity indicators, less on legal designations
const COMPANY_TOKENS = [
  "inc", "inc.", "incorporated", "corp", "corp.", "corporation", "co", "co.", "company",
  "llc", "l.l.c", "ltd", "limited", "lp", "l.p.", "limited partnership",
  "llp", "l.l.p.", "limited liability partnership", "pllc", "p.l.l.c.",
  "pc", "p.c.", "professional corporation", "plc", "p.l.c.",
  "foundation", "alliance", "solutions", "services", "associates", "partners",
  "holdings", "group", "management", "properties", "realty", "capital",
  "church", "ministries", "association", "club", "society", "institute", "center",
  "community", "development", "fund", "bank", "credit union",
  "federal", "state", "county", "city", "town", "district", "authority", "board",
  "commission", "agency", "hospital", "medical", "school", "university", "college",
  "library", "museum", "park", "conservancy", "government", "municipal",
  "syndicate", "venture", "enterprise", "investments", "realty", "development",
  "management", "properties", "holdings", "group", "capital", "asset", "management",
  "trust", // Keep 'trust' here as it can be part of a company name (e.g., "ABC Trust Co.")
  "estate", // Keep 'estate' here as it can be part of a company name (e.g., "XYZ Estate Management")
];

const isCompany = (name) => {
  const n = (name || "").toLowerCase();

  // Explicit checks for common trust/estate patterns that are definitely companies/entities
  if (/\btrustee\s+for\b/i.test(n)) return true;
  if (/\btrust\b/i.test(n) && /\bcompany\b/i.test(n)) return true; // e.g., "ABC Trust Company"
  if (/\bestate\s+of\b/i.test(n)) return true; // e.g., "Estate of John Doe" is an entity, not a person

  return COMPANY_TOKENS.some((tok) =>
    new RegExp(`(^|[^a-z])${tok}([^a-z]|$)`, "i").test(n),
  );
};

/**
 * Normalize a person name component to match Elephant schema pattern:
 * ^[A-Z][a-zA-Z\s\-',.]*$
 *
 * This means:
 * - First letter uppercase, rest lowercase
 * - After separators (space, hyphen, apostrophe, comma, period),
 *   capitalize the next letter and lowercase the rest
 */
function normalizePersonNameComponent(name) {
  if (!name || typeof name !== 'string') return null;

  let trimmed = name.trim();
  if (!trimmed) return null;

  // Remove any content in parentheses (often legal/estate terms, OCR errors, etc.)
  // Use a loop to ensure all parenthetical content is removed
  let previousLength;
  do {
    previousLength = trimmed.length;
    trimmed = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  } while (trimmed.length < previousLength && trimmed.length > 0);

  if (!trimmed) return null;

  // Remove any remaining parentheses that might be unmatched
  trimmed = trimmed.replace(/[()]/g, '').trim();
  if (!trimmed) return null;

  // First, filter out any characters that are not letters or allowed separators
  // Allowed: letters (a-zA-Z) and separators (space, hyphen, apostrophe, comma, period)
  const filtered = trimmed.replace(/[^a-zA-Z \-',.]/g, '').trim();
  if (!filtered) return null;

  // Split by separators while keeping them
  const separators = /[ \-',.]/;
  const parts = [];
  let currentPart = '';

  for (let i = 0; i < filtered.length; i++) {
    const char = filtered[i];
    if (separators.test(char)) {
      if (currentPart) {
        parts.push(currentPart);
      }
      parts.push(char);
      currentPart = '';
    } else {
      currentPart += char;
    }
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  // Normalize each part: capitalize first letter, lowercase the rest
  const normalized = parts.map((part, index) => {
    if (separators.test(part)) {
      return part; // Keep separators as-is
    }
    if (!part) return part;

    // Capitalize first letter, lowercase the rest
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join('');

  return normalized || null;
}

// Helper to create a default person object adhering to the schema
function defaultPerson(propertyId) {
  return {
    first_name: null,
    last_name: null,
    middle_name: null,
    prefix_name: null,
    suffix_name: null,
    birth_date: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: propertyId,
    source_http_request: null, // Assuming no specific HTTP request for person data
  };
}

// Parse person name from a string, now handling prefixes and suffixes
function parsePersonName(raw, propertyId) {
  const original = norm(raw);
  if (!original) return null;

  // 1. Remove any content in parentheses (often legal/estate terms, OCR errors, etc.)
  // This handles cases like "(lf Est)", "(EST)", "(TR)", etc.
  const withoutParens = original.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (!withoutParens) return null; // If only parentheses content was present

  // 2. Strip legal designations
  const { cleanedName: nameWithoutDesignations, removedDesignations } = stripLegalDesignations(withoutParens);
  const workingName = norm(nameWithoutDesignations);
  if (!workingName) return null; // If only designations were present

  let prefix = null;
  let suffix = null;
  let nameTokens = workingName.split(/\s+/).filter(Boolean);

  // 3. Extract Prefix (if present at the beginning)
  if (nameTokens.length > 1) {
    const firstToken = nameTokens[0];
    const matchedPrefix = getMatchingPrefix(firstToken);
    if (matchedPrefix) {
      prefix = matchedPrefix;
      nameTokens = nameTokens.slice(1);
    }
  }

  // 4. Extract Suffix (if present at the end)
  if (nameTokens.length > 1) {
    const lastToken = nameTokens[nameTokens.length - 1];
    const matchedSuffix = getMatchingSuffix(lastToken);
    if (matchedSuffix) {
      suffix = matchedSuffix;
      nameTokens = nameTokens.slice(0, -1);
    }
  }

  // 5. Parse the remaining name tokens
  let first = null;
  let last = null;
  let middle = null;

  // Handle "Last, First Middle" format
  if (workingName.includes(',')) {
    const parts = workingName.split(',').map(s => norm(s));
    if (parts.length >= 2) {
      last = parts[0];
      const rest = parts.slice(1).join(' ');
      const restTokens = rest.split(/\s+/).filter(Boolean);
      if (restTokens.length > 0) {
        first = restTokens[0];
        middle = restTokens.slice(1).join(' ') || null;
      }
    }
  } else { // Handle "First Middle Last" format
    if (nameTokens.length >= 2) {
      first = nameTokens[0];
      last = nameTokens[nameTokens.length - 1];
      middle = nameTokens.slice(1, -1).join(' ') || null;
    } else if (nameTokens.length === 1) {
      // If only one token remains, it's ambiguous. Can't reliably parse.
      return null;
    }
  }

  if (!first || !last) return null; // Must have at least first and last name

  const person = defaultPerson(propertyId);
  person.first_name = normalizePersonNameComponent(first);
  person.last_name = normalizePersonNameComponent(last);
  person.middle_name = normalizePersonNameComponent(middle);
  person.prefix_name = prefix;
  person.suffix_name = suffix;
  person._removed_designations = removedDesignations; // For debugging/auditing

  return person;
}

// Normalize owner for deduplication
function normalizeOwnerForKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .map((x) => norm(x || "").toLowerCase())
    .filter(Boolean);
  return `person:${parts.join(" ")}`;
}

// Extract property id with tight heuristics around table rows
function extractPropertyId($doc, htmlContent) { // Pass htmlContent here
  // Strategy 1: Find the table row with a header containing Parcel ID / Property ID
  let id = null;
  $doc("tr").each((i, tr) => {
    const th = $doc(tr).find("th").first();
    const label = norm(th.text()).toLowerCase();
    if (!label) return;
    if (/(parcel\s*id|property\s*id|prop\s*id)/i.test(label)) {
      const td = $doc(tr).find("td").first();
      if (td.length) {
        const bold = td.find("b").first();
        const candidate = bold.length ? norm(bold.text()) : norm(td.text());
        if (candidate) {
          id = candidate;
          return false; // Stop .each loop
        }
      }
    }
  });

  // Strategy 2: Regex fallback for typical parcel formats
  if (!id) {
    const m = htmlContent.match(/\b\d{3,}-\d{3}-\d{4}-\d{3}-\d\b/); // Example: 123-456-7890-123-4
    if (m) id = m[0];
  }

  return id ? id : "unknown_id";
}

// Extract plausible owner name strings from the document
function extractOwnerNameStrings($doc) {
  const candidates = [];

  // Strategy A: Ownership section first line (e.g., from a specific div/section)
  const ownP = $doc("#ownership .bottom-text p").first();
  if (ownP.length) {
    const htmlFrag = ownP.html() || "";
    const lines = htmlFrag
      .replace(/<br[^>]*>/gi, "\n")
      .split("\n")
      .map((s) => cleanCandidateString(s))
      .filter(Boolean);
    if (lines.length) {
      for (const line of lines) {
        if (looksLikeAddress(line)) break; // Stop if we hit an address line
        candidates.push(line);
      }
    }
  }

  // Strategy B: Any table label containing Owner -> adjacent cell text
  $doc("tr").each((i, tr) => {
    const th = $doc(tr).find("th").first();
    const td = $doc(tr).find("td").first();
    const label = norm(th.text()).toLowerCase();
    if (label && /owner|grantee/.test(label)) {
      const rawVal = td.html() || td.text();
      const val = cleanCandidateString(rawVal);
      if (val) candidates.push(val);
    }
  });

  // Strategy C: Elements whose preceding sibling heading includes Owner/Ownership
  $doc("h1,h2,h3,h4,h5").each((i, h) => {
    const txt = norm($doc(h).text()).toLowerCase();
    if (/\bowner(ship)?\b/.test(txt)) {
      const container = $doc(h).parent();
      const p = container.find("p").first(); // Look for a paragraph directly under the heading
      const raw = p.html() || p.text();
      const t = cleanCandidateString(raw);
      if (t) {
        const maybe =
          t
            .split(/\n|\r/)
            .map((s) => norm(s))
            .filter(Boolean)[0] || t; // Take the first non-empty line
        candidates.push(maybe);
      }
    }
  });

  // Deduplicate raw candidate strings by normalized text
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = norm(c).toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// Classify and structure owners
function classifyOwners(rawNames, propertyId) {
  const owners = [];
  const invalid = [];
  const seen = new Set();

  for (const raw of rawNames) {
    const nameCandidate = norm(raw).replace(/^owner:?\s*/i, "");
    if (!nameCandidate) continue;

    // 1. Strip legal designations first
    const { cleanedName, removedDesignations } = stripLegalDesignations(nameCandidate);
    const nameForClassification = norm(cleanedName);

    if (!nameForClassification) {
      // If only legal designations were present, it's not a valid owner name
      invalid.push({ raw: raw, reason: "only_legal_designations_present", removed: removedDesignations });
      continue;
    }

    let owner = null;
    // 2. Check if it's a company
    if (isCompany(nameForClassification)) {
      owner = { type: "company", name: nameForClassification };
    } else {
      // 3. If not a company, try parsing as a person
      const person = parsePersonName(nameForClassification, propertyId);
      if (person) {
        owner = person;
      }
    }

    if (owner) {
      const key = normalizeOwnerForKey(owner);
      if (key && !seen.has(key)) {
        seen.add(key);
        // Add removed designations to the owner object for context
        if (removedDesignations) {
          owner._removed_designations = removedDesignations;
        }
        owners.push(owner);
      }
    } else {
      invalid.push({ raw: raw, reason: "unclassified_or_insufficient_info" });
    }
  }

  return { owners, invalid };
}

// Associate owners with dates if available (heuristic placeholder)
function buildOwnersByDate(owners) {
  const map = {};
  map["current"] = owners;
  return map;
}

// Main execution function
function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const htmlContent = fs.readFileSync(inputPath, "utf8"); // Read HTML content inside main
  const $ = cheerio.load(htmlContent); // Load Cheerio inside main

  const propertyId = extractPropertyId($, htmlContent); // Pass htmlContent to extractPropertyId
  const rawOwnerNames = extractOwnerNameStrings($);
  const { owners, invalid } = classifyOwners(rawOwnerNames, propertyId);
  const ownersByDate = buildOwnersByDate(owners);

  const result = {};
  result[`property_${propertyId}`] = {
    owners_by_date: ownersByDate,
    invalid_owners: invalid,
  };

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, "owner_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  console.log(JSON.stringify(result, null, 2));
}

// Call the main function to start execution
main();