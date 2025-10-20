const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: recursively walk any JS object and collect key/value pairs
function walkObject(obj, cb, pathKeys = []) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      cb(v, i, pathKeys);
      if (v && typeof v === "object")
        walkObject(v, cb, pathKeys.concat(String(i)));
    }
  } else if (obj && typeof obj === "object") {
    const keys = Object.keys(obj);
    for (const k of keys) {
      const v = obj[k];
      cb(v, k, pathKeys);
      if (v && typeof v === "object") walkObject(v, cb, pathKeys.concat(k));
    }
  }
}

// Normalize a string for deduplication
function normalizeName(str) {
  return String(str || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Title-case a phrase: capitalize first letter of each word, handling hyphens and apostrophes
function titleCasePhrase(str) {
  const s = String(str || "").trim();
  if (!s) return s;
  const shouldTitle = s === s.toUpperCase() || s === s.toLowerCase();
  if (!shouldTitle) return s; // preserve existing mixed case
  let lower = s.toLowerCase();
  lower = lower.replace(/\b([a-z])/g, (m) => m.toUpperCase());
  return lower;
}

// Detect whether a raw owner string is a company
function isCompany(raw) {
  const s = String(raw || "").toLowerCase();
  const companyHints = [
    " inc",
    "inc.",
    " llc",
    "l.l.c",
    " ltd",
    " co",
    "co.",
    " corp",
    "corp.",
    " company",
    " services",
    " solutions",
    " foundation",
    " alliance",
    " trust",
    " tr",
    " trustees",
    " holdings",
    " partners",
    " association",
    " assn",
    " pllc",
    " pc",
    " lp",
    " llp",
    " group",
    " bank",
    " n.a",
    " plc",
    " investments",
    " properties",
    " reit",
    " church",
    " ministries",
    " university",
    " school",
    " hospital",
    " club",
    " hoa",
    " homeowners",
    " management",
    " realty",
    " estate",
    " enterprises",
    " ventures",
    " capital",
    " international",
    " intl",
    " corporation",
    " office",
    " dept",
    " department",
  ];
  const sPad = " " + s.replace(/\s+/g, " ") + " ";
  return (
    companyHints.some((h) => sPad.includes(h + " ")) || /\b(tr|trust)\b/.test(s)
  );
}

// Parse a person name string into parts
function parsePersonName(raw) {
  let name = String(raw || "")
  .replace(/\s+/g, " ") // Normalize whitespace
  .split("&")[0]        // Remove anything after '&'
  .trim();

  if (!name) return null;

  // If contains a comma, assume LAST, FIRST MIDDLE
  if (name.includes(",")) {
    const [lastPartRaw, restPartRaw] = name.split(",");
    const lastPart = (lastPartRaw || "").trim();
    const restPart = (restPartRaw || "").trim();
    if (!lastPart || !restPart) return null;
    const tokens = restPart.split(/\s+/).filter(Boolean);
    const firstName = tokens[0] || null;
    const middleName =
      tokens.length > 2
        ? tokens.slice(1).join(" ")
        : tokens.length === 2
          ? tokens[1]
          : null;
    const last = titleCasePhrase(lastPart);
    const first = titleCasePhrase(firstName);
    // Exclude middle name if it contains "/" symbol (e.g., "H/E" is not a valid middle name)
    const middle = middleName && !middleName.includes("/") ? titleCasePhrase(middleName) : null;
    if (!first || !last) return null;
    // Skip person if first_name or last_name is "H/E" (incomplete information)
    if (first === "H/E" || last === "H/E" || first === "H/e" || last === "H/e") {
      console.log(`Skipping person with H/E as name: first="${first}", last="${last}"`);
      return null;
    }
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle || null,
    };
  }

  // Otherwise assume FIRST MIDDLE LAST
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return null;
  const first = titleCasePhrase(tokens[0]);
  const last = titleCasePhrase(tokens[tokens.length - 1]);
  const middleTokens = tokens.slice(1, -1);
  const middleStr = middleTokens.length ? middleTokens.join(" ") : null;
  // Exclude middle name if it contains "/" symbol (e.g., "H/E" is not a valid middle name)
  const middle = middleStr && !middleStr.includes("/")
    ? titleCasePhrase(middleStr)
    : null;
  if (!first || !last) return null;
  // Skip person if first_name or last_name is "H/E" (incomplete information)
  if (first === "H/E" || last === "H/E" || first === "H/e" || last === "H/e") {
    console.log(`Skipping person with H/E as name: first="${first}", last="${last}"`);
    return null;
  }
  return {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle || null,
  };
}

// Build canonical string for deduplication
function canonicalOwner(owner) {
  if (!owner) return "";
  if (owner.type === "company") return "company:" + normalizeName(owner.name);
  const fn = normalizeName(owner.first_name || "");
  const mn = normalizeName(owner.middle_name || "");
  const ln = normalizeName(owner.last_name || "");
  return `person:${fn}:${mn}:${ln}`;
}

// Extract potential date strings in format MM/DD/YYYY and convert to YYYY-MM-DD
function toISODate(mdy) {
  const m = String(mdy || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Attempt to split joint names separated by '&' into multiple person owners
function splitAmpersandOwners(raw) {
  const parts = String(raw)
    .split(/\s*&\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return null;
  const owners = [];
  for (const p of parts) {
    const person = parsePersonName(p);
    if (person) owners.push(person);
  }
  return owners.length ? owners : null;
}

// Main execution: read input.json, parse, transform, write output
const inputPath = path.join(process.cwd(), "input.json");
const rawHtml = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(rawHtml);
const pageText = $.root().text();

// Attempt to parse JSON content if present
let parsed = null;
if (pageText.trim().startsWith("{")) {
  parsed = JSON.parse(pageText);
}

// Collect owner name candidates and property id from parsed object if available
const ownerCandidates = [];
const invalidOwners = [];
let propertyId = null;
const idKeyCandidates = [
  "folioNumber",
  "property_id",
  "propertyId",
  "propId",
  "parcel",
  "parcel_id",
  "accountnumber",
  "account_num",
  "account",
  "folio",
];

if (parsed) {
  walkObject(parsed, (value, key) => {
    const k = String(key || "").toLowerCase();
    if (
      k &&
      idKeyCandidates.map((x) => x.toLowerCase()).includes(k) &&
      typeof value === "string" &&
      value.trim()
    ) {
      if (!propertyId) propertyId = value.trim();
    }
    if (k && /owner/.test(k) && typeof value === "string" && value.trim()) {
      ownerCandidates.push(value.trim());
    }
  });
}

// Fallback: regex-based extraction from text for IDs and owners
if (!propertyId) {
  const idMatch = pageText.match(
    /"(?:folioNumber|property_id|propertyId|propId|parcel|parcel_id|accountnumber|account|folio)"\s*:\s*"([^"]+)"/i,
  );
  if (idMatch) propertyId = idMatch[1].trim();
}

if (ownerCandidates.length === 0) {
  const ownerRegex = /"([^"]*owner[^"]*)"\s*:\s*"([^"]+)"/gi;
  let m;
  while ((m = ownerRegex.exec(pageText)) !== null) {
    const val = m[2].trim();
    if (val) ownerCandidates.push(val);
  }
}

// As a last resort, scan for Owner labels in plain text (HTML scenarios)
if (ownerCandidates.length === 0) {
  const labelNodes = $('*:contains("Owner"):not(script):not(style)');
  labelNodes.each((i, el) => {
    const txt = $(el).text();
    if (/owner/i.test(txt)) {
      const after = txt.split(/owner[^:]*[:\-]/i)[1] || "";
      const maybe = after.split(/[\n\r]/)[0] || "";
      const cleaned = maybe.replace(/\s+/g, " ").trim();
      if (cleaned) ownerCandidates.push(cleaned);
    }
  });
}

// Check if any owner candidate contains company markers
// If so, treat all candidates as a single multi-line company name (unless there's "&")
const hasCompanyMarker = ownerCandidates.some(raw => isCompany(raw));
const combinedOwnerText = ownerCandidates.join(" ").replace(/\s+/g, " ").trim();

// If there's a company marker and "&" separator, split by "&"
// Otherwise, if there's a company marker, treat the whole thing as one entity
let processedOwners = [];
if (hasCompanyMarker && combinedOwnerText.includes("&")) {
  // Split by & to handle multiple companies/persons
  processedOwners = combinedOwnerText.split("&").map(s => s.trim()).filter(Boolean);
} else if (hasCompanyMarker) {
  // Single company (possibly multi-line)
  processedOwners = [combinedOwnerText];
} else {
  // No company markers, process individually (likely persons)
  processedOwners = ownerCandidates.map(s => s.trim()).filter(Boolean);
}

// Deduplicate processed owner strings by normalized name string
const seenRaw = new Set();
const uniqueRawOwners = [];
for (const raw of processedOwners) {
  const norm = normalizeName(raw);
  if (!norm) continue;
  if (seenRaw.has(norm)) continue;
  seenRaw.add(norm);
  uniqueRawOwners.push(raw);
}

// Classify and structure owners
const structuredOwners = [];
for (const raw of uniqueRawOwners) {
  const trimmed = raw.trim();
  if (!trimmed) continue;

  // Handle joint names with '&' (only if not a company)
  if (trimmed.includes("&") && !isCompany(trimmed)) {
    const splitOwners = splitAmpersandOwners(trimmed);
    if (splitOwners && splitOwners.length) {
      for (const o of splitOwners) {
        const cano = canonicalOwner(o);
        if (!structuredOwners.some((x) => canonicalOwner(x) === cano))
          structuredOwners.push(o);
      }
      continue;
    }
  }

  if (isCompany(trimmed)) {
    const company = { type: "company", name: titleCasePhrase(trimmed) };
    const cano = canonicalOwner(company);
    if (!structuredOwners.some((o) => canonicalOwner(o) === cano))
      structuredOwners.push(company);
    continue;
  }

  const person = parsePersonName(trimmed);
  if (person) {
    const cano = canonicalOwner(person);
    if (!structuredOwners.some((o) => canonicalOwner(o) === cano))
      structuredOwners.push(person);
  } else {
    invalidOwners.push({
      raw: trimmed,
      reason: "unclassified_or_insufficient_info",
    });
  }
}

// Group by dates (heuristic). Without explicit mapping, place in current.
const ownersByDate = {};
ownersByDate["current"] = structuredOwners;

// Attempt to find any sale or deed dates; ensure chronological uniqueness if we ever use them.
const dateMatches = [];
const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g;
let md;
while ((md = dateRegex.exec(pageText)) !== null) {
  const iso = toISODate(md[1]);
  if (iso) dateMatches.push(iso);
}
const chronological = Array.from(new Set(dateMatches)).sort();
// Not associating owners to historic dates due to lack of proximity mapping in this input structure

// Determine property id or fallback
const idOut = propertyId ? String(propertyId).trim() : "unknown_id";
const topKey = `property_${idOut}`;

const output = {};
output[topKey] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print to stdout only the JSON
console.log(JSON.stringify(output, null, 2));
