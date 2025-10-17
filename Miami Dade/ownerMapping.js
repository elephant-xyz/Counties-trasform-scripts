// ownerMapping.js
// Single-file Node.js script to transform a property's HTML (or raw text) into structured JSON
// Uses only cheerio for HTML parsing; employs regex/vanilla JS for extraction and processing.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read the input file as raw text (expected HTML, may contain JSON-like content)
const inputPath = path.join(process.cwd(), "input.json");
const raw = fs.readFileSync(inputPath, "utf8");

// Load with cheerio; for non-HTML text (e.g., JSON), we still get a root text node to work with
const $ = cheerio.load(raw);
const pageText = $.root().text();

// Utility: normalize whitespace
function normWS(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

// Extract a property id using multiple heuristics on the pageText
function extractPropertyId(text) {
  const patterns = [
    /"FolioNumber"\s*:\s*"([^"]+)"/i,
    /\bproperty[_\s-]?id\b["\s:]*"?([A-Za-z0-9_.\-]+)"?/i,
    /\bprop(?:erty)?Id\b["\s:]*"?([A-Za-z0-9_.\-]+)"?/i,
    /\bProperty ID\b\s*[:#-]?\s*([A-Za-z0-9_.\-]+)/i,
    /\bfolio\b\s*[:#-]?\s*([A-Za-z0-9_.\-]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return normWS(m[1]);
  }
  return "unknown_id";
}

// Extract potential owner raw strings using multiple heuristics
function extractPotentialOwnerStrings(text) {
  const candidates = [];

  // 1) JSON-like fields commonly used
  const jsonNameRe = /"Name"\s*:\s*"([^"]+)"/g; // e.g., OwnerInfos.Name
  let m;
  while ((m = jsonNameRe.exec(text)) !== null) {
    candidates.push(m[1]);
  }

  // 2) Generic owner field names
  const ownerFieldRe = /"owner(?:name\d*|_name\d*|name|)"\s*:\s*"([^"]+)"/gi;
  while ((m = ownerFieldRe.exec(text)) !== null) {
    candidates.push(m[1]);
  }

  // 3) Labeled patterns (Owner:, Owner Name: etc.)
  const labelRe =
    /\b(Owner(?:\s*Name)?|Grantee(?:\s*Name\d*)?|Grantor(?:\s*Name\d*)?)\b\s*[:\-]?\s*([A-Za-z0-9&.,'\-\s]{2,})/g;
  while ((m = labelRe.exec(text)) !== null) {
    // stop at end-of-line like behavior for safety
    const val = m[2].split(/[\r\n\t]/)[0];
    candidates.push(val);
  }

  // 4) De-duplicate raw candidates by normalized string
  const seen = new Set();
  const cleaned = [];
  for (const c of candidates) {
    const t = normWS(c)
      .replace(/^\s*[:\-]+\s*/, "")
      .replace(/&amp;/gi, "&")
      .replace(/\s*,\s*$/, "")
      .trim();
    const key = t.toLowerCase();
    if (t && !seen.has(key)) {
      seen.add(key);
      cleaned.push(t);
    }
  }
  return cleaned;
}

// Company detection
const COMPANY_TERMS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "co",
  "corp",
  "corporation",
  "company",
  "foundation",
  "alliance",
  "solutions",
  "services",
  "trust",
  "tr",
  "association",
  "assn",
  "partners",
  "partner",
  "lp",
  "llp",
  "bank",
  "na",
  "pc",
  "pllc",
  "group",
  "holdings",
  "management",
  "mgmt",
];
const companyRegex = new RegExp(
  `\\b(${COMPANY_TERMS.map((t) => t.replace(/\./g, "\\.")).join("|")})\\b`,
  "i",
);

function isCompany(name) {
  return companyRegex.test(name);
}

// Person splitting per rules; also handle names with '&'
function toPerson(name) {
  const noAmp = name.replace(/\s*&\s*/g, " ");
  const tokens = noAmp.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  
  let first = tokens[0];
  let last = tokens[tokens.length - 1];
  let middle = tokens.slice(1, -1).join(" ") || null;
  
  // Clean names: remove special characters except letters, spaces, hyphens, apostrophes
  first = first.replace(/[^A-Za-z\-']/g, "").trim();
  last = last.replace(/[^A-Za-z\-']/g, "").trim();
  if (middle) {
    middle = middle.replace(/[^A-Za-z\-']/g, "").trim();
  }
  
  // Reject names that are empty, start with numbers, or contain only special characters
  if (!first || !last || /^\d+$/.test(first) || /^\d+$/.test(last) || 
      /^[^A-Za-z]+$/.test(first) || /^[^A-Za-z]+$/.test(last)) {
    return null;
  }
  
  // Reject if middle name is empty or only special characters
  if (middle && (!middle || /^[^A-Za-z]+$/.test(middle))) {
    middle = null;
  }
  
  return {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle,
  };
}

function classifyOwner(rawName) {
  let name = normWS(rawName).replace(/\s{2,}/g, " ");
  if (!name) return { owner: null, reason: "empty" };

  // Remove content in parentheses but keep the rest of the name
  name = name.replace(/\s*\([^)]*\)\s*/g, " ").trim();

  // Check for specific company patterns
  if (name.includes("JEWISH OUTREACH") || name.includes("CHABAD") || name.includes("PROGRAM")) {
    return { owner: { type: "company", name: name }, reason: null };
  }

  if (isCompany(name)) {
    return { owner: { type: "company", name: name }, reason: null };
  }

  // If name contains '&', per instruction, treat as person with '&' removed and split
  if (name.includes("&")) {
    const p = toPerson(name);
    if (!p) return { owner: null, reason: "ambiguous_name_with_ampersand" };
    return { owner: p, reason: null };
  }

  // Standard person
  const p = toPerson(name);
  if (!p) return { owner: null, reason: "insufficient_person_tokens" };
  return { owner: p, reason: null };
}

function normalizeOwnerKey(o) {
  if (!o) return "";
  if (o.type === "company")
    return `company:${o.name}`.toLowerCase().replace(/\s+/g, " ").trim();
  return `person:${[o.first_name, o.middle_name, o.last_name].filter(Boolean).join(" ")}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Build owners_by_date mapping
function buildOwnersByDate(validOwners, text) {
  // Attempt to associate dates; when uncertain, place in current.
  const owners_by_date = {};
  owners_by_date["current"] = validOwners.slice();

  // Attempt basic historical extraction if grantor/grantee names appear with DateOfSale
  // Since names may be absent, this may remain only 'current'. Placeholders not added unless owners are found for them.
  return owners_by_date;
}

// MAIN extraction
const propertyId = extractPropertyId(pageText);

// Owner candidates
const rawOwnerStrings = extractPotentialOwnerStrings(pageText);

// Classify and deduplicate owners
const validOwners = [];
const invalidOwners = [];
const seenOwners = new Set();
for (const rawName of rawOwnerStrings) {
  const { owner, reason } = classifyOwner(rawName);
  if (!owner) {
    invalidOwners.push({ raw: rawName, reason: reason || "unclassified" });
    continue;
  }
  const key = normalizeOwnerKey(owner);
  if (!seenOwners.has(key)) {
    seenOwners.add(key);
    validOwners.push(owner);
  }
}

// Build owners_by_date
const ownersByDate = buildOwnersByDate(validOwners, pageText);

// Compose output
const topKey = `property_${propertyId || "unknown_id"}`;
const result = {};
result[topKey] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and save
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

// Print to stdout
console.log(JSON.stringify(result, null, 2));
