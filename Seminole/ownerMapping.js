const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Paths
const INPUT_PATH = path.join(process.cwd(), "input.json");
const OUTPUT_DIR = path.join(process.cwd(), "owners");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "owner_data.json");

// Load input text (may be HTML or JSON); for this task, input.json holds the content
const inputText = fs.readFileSync(INPUT_PATH, "utf8");
const $ = cheerio.load(inputText);

// Parse JSON content
const data = JSON.parse(inputText);

// Helpers
const COMPANY_KEYWORDS = [
  "inc",
  "l.l.c",
  "llc",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "services",
  "trust",
  " tr ",
  " tr.",
  "tr#",
  "associates",
  "partners",
  "lp",
  "pllc",
  "pc",
  "company",
  "bank",
  "church",
  "university",
  "capital",
  "holdings",
  "management",
];

function normalizeSpaces(str) {
  return String(str || "")
    .replace(/[\u00A0\t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCompanyKeyword(name) {
  const lc = ` ${String(name || "").toLowerCase()} `;
  return COMPANY_KEYWORDS.some((k) => lc.includes(k));
}

function cleanOwnerRaw(raw) {
  let s = String(raw || "");
  s = s.replace(/[\u00A0\t\r\n]+/g, " ");
  s = s.replace(/[()]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function parsePersonNameWithAmpersand(raw) {
  const s = cleanOwnerRaw(raw);
  if (!s || !s.includes("&")) return null;
  const parts = s.split("&").map((x) => normalizeSpaces(x));
  if (parts.length === 2 && parts[0] && parts[1]) {
    const person = {
      type: "person",
      first_name: parts[0],
      last_name: parts[1],
    };
    return person;
  }
  return null;
}

function parsePersonName(raw) {
  const s = cleanOwnerRaw(raw);
  if (!s) return null;

  // Prefer special handling when '&' is present
  if (s.includes("&")) {
    const amp = parsePersonNameWithAmpersand(s);
    if (amp) return amp;
  }

  // Handle formats like: LAST, FIRST MIDDLE
  if (s.includes(",")) {
    const parts = s.split(",");
    const last = normalizeSpaces(parts[0]);
    const rightTokens = normalizeSpaces(parts.slice(1).join(","))
      .split(/\s+/)
      .filter(Boolean);
    const first = rightTokens[0] || "";
    const middle = rightTokens.slice(1).join(" ");
    if (!first || !last) return null;
    const person = { type: "person", first_name: first, last_name: last };
    if (middle) person.middle_name = middle;
    return person;
  }

  // Handle FIRST MIDDLE LAST
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(" ");
  if (!first || !last) return null;
  const person = { type: "person", first_name: first, last_name: last };
  if (middle) person.middle_name = middle;
  return person;
}

function classifyOwnerFromString(raw) {
  const s = cleanOwnerRaw(raw);
  if (!s)
    return { invalid: { raw: String(raw || ""), reason: "empty_or_blank" } };

  if (hasCompanyKeyword(s)) {
    return { owner: { type: "company", name: s } };
  }

  const asPerson = parsePersonName(s);
  if (asPerson) return { owner: asPerson };

  return { invalid: { raw: s, reason: "unclassified_name" } };
}

function canonicalKey(owner) {
  if (!owner) return null;
  if (owner.type === "company") {
    return `company|${normalizeSpaces(owner.name).toLowerCase()}`;
  }
  const first = normalizeSpaces(owner.first_name || "").toLowerCase();
  const last = normalizeSpaces(owner.last_name || "").toLowerCase();
  const middle = normalizeSpaces(owner.middle_name || "").toLowerCase();
  return `person|${first}|${middle}|${last}`;
}

function dedupeOwners(owners) {
  const map = new Map();
  for (const o of owners) {
    const key = canonicalKey(o);
    if (!key) continue;
    if (!map.has(key)) map.set(key, o);
  }
  return Array.from(map.values());
}

function extractStructuredOwners(obj) {
  const owners = [];
  const invalids = [];

  // From ownerDetails if present
  if (obj && Array.isArray(obj.ownerDetails)) {
    for (const od of obj.ownerDetails) {
      const entityName = normalizeSpaces(od.entityName);
      const first = normalizeSpaces(od.firstName);
      const mi = normalizeSpaces(od.mi);
      const last = normalizeSpaces(od.lastName);

      if (entityName) {
        if (hasCompanyKeyword(entityName)) {
          owners.push({ type: "company", name: entityName });
        } else {
          const parsed = parsePersonName(entityName);
          if (parsed) owners.push(parsed);
          else
            invalids.push({
              raw: entityName,
              reason: "entityName_unclassified",
            });
        }
        continue;
      }

      if (first || last) {
        const person = { type: "person" };
        if (first) person.first_name = first;
        else
          invalids.push({
            raw: JSON.stringify(od),
            reason: "missing_first_name",
          });
        if (last) person.last_name = last;
        else
          invalids.push({
            raw: JSON.stringify(od),
            reason: "missing_last_name",
          });
        if (mi) person.middle_name = mi;
        if (person.first_name && person.last_name) owners.push(person);
        continue;
      }

      invalids.push({
        raw: JSON.stringify(od),
        reason: "ownerDetails_no_identifiable_name",
      });
    }
  }

  // From generic owners array of strings
  if (obj && Array.isArray(obj.owners)) {
    for (const raw of obj.owners) {
      const classified = classifyOwnerFromString(raw);
      if (classified.owner) owners.push(classified.owner);
      else invalids.push(classified.invalid);
    }
  }

  return { owners, invalids };
}

function getPropertyId(obj, $root) {
  let id = null;
  const candidates = [
    "property_id",
    "propId",
    "propID",
    "propertyId",
    "parcelNumber",
    "parcelNumberFormatted",
    "apprId",
    "masterId",
  ];
  for (const k of candidates) {
    if (obj && obj[k]) {
      id = String(obj[k]).trim();
      break;
    }
  }

  if (!id) {
    const txt = normalizeSpaces($root.text());
    const m = txt.match(
      /(?:property\s*id|parcel(?:\s*number)?|prop(?:erty)?\s*id)\s*[:#-]?\s*([A-Za-z0-9\-]+)/i,
    );
    if (m) id = m[1].trim();
  }

  if (!id) id = "unknown_id";
  return id;
}

function buildOwnersByDate(obj, extractedOwners) {
  const owners_by_date = {};
  const deduped = dedupeOwners(extractedOwners);
  owners_by_date["current"] = deduped;
  return owners_by_date;
}

// Extract owners primarily from structured JSON fields
const structured = extractStructuredOwners(data);
const combinedOwners = dedupeOwners(structured.owners);
const invalids = structured.invalids.filter((x) => x && x.raw && x.reason);

const propertyId = getPropertyId(data, $("body"));
const owners_by_date = buildOwnersByDate(data, combinedOwners);

const result = {};
result[`property_${propertyId}`] = {
  owners_by_date,
  invalid_owners: invalids,
};

// Write output
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");

// Print result JSON
console.log(JSON.stringify(result, null, 2));
