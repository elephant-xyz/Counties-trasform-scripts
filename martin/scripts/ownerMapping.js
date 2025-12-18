const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf-8");
const $ = cheerio.load(html);

// Utility: get label->value pairs by scanning <strong>Label</strong> value patterns
function extractLabeledValues($root) {
  const results = [];
  $root.find("strong").each((i, el) => {
    const label = $(el).text().trim();
    if (!label) return;
    const parent = $(el).parent();
    const clone = parent.clone();
    clone.children("strong").first().remove();
    const valueText = clone.text().replace(/\s+/g, " ").trim();
    const valueHtml = clone.html();
    results.push({ label, valueText, valueHtml });
  });
  return results;
}

// Attempt to find a property id
function getPropertyId() {
  const labeled = extractLabeledValues($("body"));
  let id = null;
  const tryLabels = [
    "Property ID",
    "property id",
    "property_id",
    "propId",
    "Parcel ID",
    "Parcel Id",
    "PIN",
    "AIN",
    "Account Number",
    "Account #",
  ];
  for (const lbl of tryLabels) {
    const item = labeled.find(
      (x) => x.label.toLowerCase() === lbl.toLowerCase(),
    );
    if (item && item.valueText) {
      id = item.valueText.split(/\s+/).join(" ").trim();
      break;
    }
  }
  if (!id) id = "unknown_id";
  return id;
}

// Normalize name text: collapse spaces and trim punctuation
function cleanName(str) {
  return (str || "")
    .replace(/[\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\/\s+/g, " / ")
    .trim();
}

// Company keyword detection
const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "services",
  "trust",
  "tr",
  "associates",
  "association",
  "partners",
  "holdings",
  "group",
  "company",
  "bank",
  "n.a",
  "na",
  "lp",
  "llp",
  "pllc",
  "pc",
  "p.c",
  "university",
  "church",
  "ministries",
  "committee",
  "club",
  "capital",
  "management",
  "enterprises",
  "properties",
  "realty",
];
const COMPANY_REGEX = new RegExp(`\\b(${COMPANY_KEYWORDS.join("|")})\\b`, "i");

// Parse string into possibly multiple raw owner strings (split by & and common separators)
function splitRawOwners(raw) {
  const s = cleanName(raw);
  if (!s) return [];
  const parts = s
    .split(/\s*&\s*|\s+AND\s+|;|\s*\+\s*/i)
    .map((p) => cleanName(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

// Remove role/suffix tokens from a name
function stripRoleTokens(s) {
  return s
    .replace(/\b(TRUSTEE|TTEE|ET AL|ETAL|ESTATE OF|EST OF|EST)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Heuristic to detect if looks like a person
function looksLikePerson(s) {
  if (/\b(revocable|trust|agreement)\b/i.test(s)) return false;
  if (COMPANY_REGEX.test(s)) return false;
  if (s.includes(",")) return true;
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens.length <= 4) return true;
  return false;
}

// Parse an individual person name into components {first_name, middle_name|null, last_name}
function parsePersonName(raw) {
  let s = stripRoleTokens(cleanName(raw));
  if (!s) return null;
  let first = null,
    middle = null,
    last = null;
  if (s.includes(",")) {
    const [lastPart, restPart] = s.split(",").map((t) => t.trim());
    last = lastPart || null;
    if (restPart) {
      const tokens = restPart.split(/\s+/).filter(Boolean);
      first = tokens.shift() || null;
      if (tokens.length) middle = tokens.join(" ");
    }
  } else {
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      last = tokens[0];
      first = tokens[1];
      if (tokens.length > 2) middle = tokens.slice(2).join(" ");
    } else {
      return null;
    }
  }
  if (!first || !last) return null;

  // Apply title casing and validation
  const firstTitled = titleCaseName(first);
  const lastTitled = titleCaseName(last);
  let middleTitled = middle ? cleanMiddleName(middle) : null;

  // Ensure first and last names are valid after title casing
  if (!firstTitled || !lastTitled) return null;
  // Middle name is already validated by cleanMiddleName (returns null if invalid)

  return {
    type: "person",
    first_name: firstTitled,
    last_name: lastTitled,
    middle_name: middleTitled,
  };
}

// Title case a name to match Elephant schema pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
function titleCaseName(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (!s) return null;

  // Remove any characters that don't match the allowed pattern: letters, spaces, hyphens, apostrophes, commas, periods
  s = s.replace(/[^a-zA-Z\s\-',.]/g, '');
  if (!s) return null;

  // Remove leading/trailing separators and collapse multiple spaces
  s = s.replace(/^[\s\-',.]+|[\s\-',.]+$/g, '').replace(/\s+/g, ' ');
  if (!s) return null;

  // Convert to lowercase for processing
  s = s.toLowerCase();

  // Split by separators while preserving them
  const parts = [];
  let currentWord = '';
  let lastWasSeparator = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (/[\s\-',.]/.test(char)) {
      if (currentWord) {
        parts.push({ type: 'word', value: currentWord });
        currentWord = '';
      }
      if (!lastWasSeparator) {
        parts.push({ type: 'sep', value: char });
        lastWasSeparator = true;
      }
    } else {
      currentWord += char;
      lastWasSeparator = false;
    }
  }
  if (currentWord) {
    parts.push({ type: 'word', value: currentWord });
  }

  // Build result with proper capitalization
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'word') {
      // Capitalize first letter, rest lowercase
      result += part.value.charAt(0).toUpperCase() + part.value.slice(1);
    } else {
      result += part.value;
    }
  }

  result = result.trim();

  // Ensure result matches the required Elephant schema pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  if (!result || !/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(result)) return null;
  return result;
}

// Clean and validate middle name using the more lenient pattern
function cleanMiddleName(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (!s) return null;

  // Remove any characters that don't match the allowed pattern: letters, spaces, hyphens, apostrophes, commas, periods
  s = s.replace(/[^a-zA-Z\s\-',.]/g, '');
  if (!s) return null;

  // Remove leading/trailing separators and collapse multiple spaces
  s = s.replace(/^[\s\-',.]+|[\s\-',.]+$/g, '').replace(/\s+/g, ' ');
  if (!s) return null;

  // For middle names, we use title case but preserve the more lenient pattern
  // Convert to lowercase for processing
  const lower = s.toLowerCase();

  // Split by separators while preserving them
  const parts = [];
  let currentWord = '';
  let lastWasSeparator = false;

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if (/[\s\-',.]/.test(char)) {
      if (currentWord) {
        parts.push({ type: 'word', value: currentWord });
        currentWord = '';
      }
      if (!lastWasSeparator) {
        parts.push({ type: 'sep', value: char });
        lastWasSeparator = true;
      }
    } else {
      currentWord += char;
      lastWasSeparator = false;
    }
  }
  if (currentWord) {
    parts.push({ type: 'word', value: currentWord });
  }

  // Build result with proper capitalization
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'word') {
      // Capitalize first letter, rest lowercase
      result += part.value.charAt(0).toUpperCase() + part.value.slice(1);
    } else {
      result += part.value;
    }
  }

  // Final cleanup: trim and ensure no consecutive spaces or trailing separators
  result = result.trim().replace(/\s+/g, ' ');

  // Remove trailing separators
  result = result.replace(/[\s\-',.]+$/g, '');

  // Remove leading separators
  result = result.replace(/^[\s\-',.]+/g, '');

  if (!result) return null;

  // Ensure result matches the middle name pattern: ^[A-Z][a-zA-Z\s\-',.]*$
  // This pattern is more lenient than first/last name pattern
  if (!/^[A-Z][a-zA-Z\s\-',.]*$/.test(result)) return null;

  // Additional validation: ensure the string only contains valid characters
  // and doesn't have any edge cases that might pass regex but fail validation
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    const code = char.charCodeAt(0);
    // Check if it's a letter (A-Z, a-z)
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    // Check if it's an allowed separator
    const isSeparator = char === ' ' || char === '-' || char === "'" || char === ',' || char === '.';
    if (!isLetter && !isSeparator) {
      // Invalid character found
      return null;
    }
  }

  return result;
}

const PERSON_FRAGMENT_BLOCKLIST = new Set([
  "sons",
  "heirs",
  "estate",
  "est",
  "trust",
  "trustee",
  "associates",
]);

function isLikelyPersonFragment(raw) {
  const cleaned = stripRoleTokens(cleanName(raw));
  if (!cleaned) return false;
  if (COMPANY_REGEX.test(cleaned)) return false;
  if (/\b(revocable|trust|agreement)\b/i.test(cleaned)) return false;
  if (/[^a-z\s\-',.]/i.test(cleaned)) return false;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.length > 3) return false;
  const normalized = tokens.map((t) => t.replace(/\.$/, "").toLowerCase());
  if (normalized.some((t) => PERSON_FRAGMENT_BLOCKLIST.has(t))) return false;
  return tokens.every((t) => /^[A-Za-z][A-Za-z'.-]*\.?$/.test(t));
}

function inferPersonWithFallback(raw, fallbackLast) {
  if (!fallbackLast) return null;
  if (!isLikelyPersonFragment(raw)) return null;
  const cleanedTokens = stripRoleTokens(cleanName(raw))
    .split(/\s+/)
    .filter(Boolean);
  if (!cleanedTokens.length) return null;
  const first = cleanedTokens[0];
  const middle = cleanedTokens.length > 1 ? cleanedTokens.slice(1).join(" ") : null;

  // Apply title casing and validation
  const firstTitled = titleCaseName(first);
  let middleTitled = middle ? cleanMiddleName(middle) : null;

  // Ensure first name is valid after title casing
  if (!firstTitled) return null;
  // Middle name is already validated by cleanMiddleName (returns null if invalid)
  // Note: fallbackLast should already be title-cased from the previous person

  return {
    type: "person",
    first_name: firstTitled,
    middle_name: middleTitled,
    last_name: fallbackLast,
  };
}

function classifySingleOwner(raw, fallbackLastName = null) {
  const s = cleanName(raw);
  if (!s) return { owners: [], invalid: { raw, reason: "empty name" } };

  const isCompany =
    COMPANY_REGEX.test(s) || /\b(revocable|trust|agreement)\b/i.test(s);
  if (isCompany) {
    return { owners: [{ type: "company", name: s }], invalid: null };
  }

  let person = looksLikePerson(s) ? parsePersonName(s) : null;
  if (!person) person = inferPersonWithFallback(s, fallbackLastName);

  if (person) return { owners: [person], invalid: null };

  return {
    owners: [],
    invalid: { raw: s, reason: "unclassifiable or ambiguous" },
  };
}

function classifyOwnerParts(parts) {
  const owners = [];
  const invalids = [];
  let fallbackLast = null;

  for (const part of parts) {
    const result = classifySingleOwner(part, fallbackLast);
    if (result.owners && result.owners.length) {
      owners.push(...result.owners);
      const lastPerson = [...result.owners]
        .reverse()
        .find((o) => o.type === "person" && o.last_name);
      if (lastPerson) fallbackLast = lastPerson.last_name;
    } else if (result.invalid) {
      invalids.push(result.invalid);
    }
  }

  return { owners, invalids };
}

// Parse an owner raw string into one or more structured owners (person/company)
function classifyOwner(raw) {
  const s = cleanName(raw);
  if (!s) return { owners: [], invalid: { raw, reason: "empty name" } };

  const parts = splitRawOwners(s);
  if (parts.length > 1) {
    const { owners, invalids } = classifyOwnerParts(parts);
    return { owners, invalid: invalids.length ? invalids[0] : null };
  }

  return classifySingleOwner(s);
}

// Normalize owner key for deduplication
function ownerKey(o) {
  if (!o) return "";
  if (o.type === "company")
    return `company:${(o.name || "").toLowerCase().trim()}`;
  const fn = (o.first_name || "").toLowerCase().trim();
  const mn = (o.middle_name || "").toLowerCase().trim();
  const ln = (o.last_name || "").toLowerCase().trim();
  return `person:${fn}|${mn}|${ln}`;
}

function dedupeOwners(arr) {
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const k = ownerKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

// Extract current owners from the General Information section
function getCurrentOwners() {
  const labeled = extractLabeledValues($("body"));
  const ownersField = labeled.find((x) =>
    x.label.toLowerCase().includes("property owners"),
  );
  const collected = [];
  const invalids = [];
  if (ownersField && ownersField.valueHtml) {
    const segments = ownersField.valueHtml
      .replace(/<\/?strong[^>]*>/gi, "")
      .replace(/<a[^>]*>.*?<\/a>/gi, "")
      .split(/<br\s*\/?\s*>/i)
      .map((seg) => cleanName(cheerio.load(`<div>${seg}</div>`)("div").text()))
      .filter(Boolean);

    for (const raw of segments.length
      ? segments
      : [
          cleanName(
            cheerio.load(`<div>${ownersField.valueHtml}</div>`)("div").text(),
          ),
        ]) {
      const { owners, invalid } = classifyOwner(raw);
      if (owners && owners.length) collected.push(...owners);
      if (invalid) invalids.push(invalid);
    }
  }
  return { owners: dedupeOwners(collected), invalids };
}

// Extract historical owners from Sales History table: use Grantor (Seller) as owner on that sale date
function getHistoricalOwners() {
  const results = [];
  const invalids = [];
  $("div.sale-history table, table").each((i, tbl) => {
    const headerCells = $(tbl).find("tr").first().find("th");
    if (headerCells.length >= 3) {
      const headers = headerCells
        .map((j, th) => $(th).text().trim().toLowerCase())
        .get();
      const hasSaleDate = headers.some((h) => h.includes("sale date"));
      const hasGrantor = headers.some((h) => h.includes("grantor"));
      if (hasSaleDate && hasGrantor) {
        $(tbl)
          .find("tr")
          .slice(1)
          .each((rIdx, tr) => {
            const tds = $(tr).find("td");
            if (tds.length === 0) return;
            const dateText = $(tds[0]).text().trim();
            const grantorText = $(tds[2]).text().trim();
            const dateIso = toISODate(dateText);
            const { owners, invalid } = classifyOwner(grantorText);
            const ownersClean = dedupeOwners(owners);
            let invalidLocal = invalid ? [invalid] : [];
            if (
              /^seller\s*-\s*see file for name$/i.test(cleanName(grantorText))
            ) {
              invalidLocal.push({
                raw: grantorText,
                reason: "placeholder seller name",
              });
            }
            results.push({
              date: dateIso || dateText || null,
              owners: ownersClean,
            });
            invalids.push(...invalidLocal);
          });
      }
    }
  });

  return { entries: results, invalids };
}

// Convert various date formats like M/D/YY to YYYY-MM-DD
function toISODate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mo, da, yr] = m;
  let year = parseInt(yr, 10);
  if (yr.length === 2) {
    year += year >= 50 ? 1900 : 2000;
  }
  const month = String(parseInt(mo, 10)).padStart(2, "0");
  const day = String(parseInt(da, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Build owners_by_date map sorted chronologically, plus current
function buildOwnersByDate() {
  const current = getCurrentOwners();
  return {
    owners_by_date: {
      current: current.owners,
    },
    invalid_owners: current.invalids,
  };
}

// Compose final object
const propId = getPropertyId();
const key = `property_${propId}`;
const built = buildOwnersByDate();
const result = {
  [key]: {
    owners_by_date: built.owners_by_date,
    invalid_owners: built.invalid_owners,
  },
};

// Ensure directory exists and save JSON
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

// Print result JSON only
console.log(JSON.stringify(result, null, 2));
