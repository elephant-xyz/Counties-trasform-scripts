const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Helpers
const normalizeSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeNameKey = (s) => normalizeSpace(s).toLowerCase();

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

// Extract current owners from the visible Owner(s) field
function extractCurrentOwners($) {
  let names = [];
  let valueDiv = null;
  $("label").each((i, el) => {
    const txt = $(el).text();
    if (/Owner\(s\):/i.test(txt)) {
      // try to find the immediate sibling div containing values
      const parent = $(el).closest(".mb-1");
      if (parent.length) valueDiv = parent.find("> div").first();
      if (!valueDiv || !valueDiv.length)
        valueDiv = $(el).nextAll("div").first();
    }
  });
  if (valueDiv && valueDiv.length) {
    const clone = valueDiv.clone();
    // Remove links and modals which include extra texts
    clone.find("a, .modal, script, style").remove();
    // Split by <br/> boundaries
    const htmlFrag = clone.html() || "";
    const parts = htmlFrag
      .split(/<br\s*\/?\s*>/i)
      .map((s) => s.replace(/<[^>]*>/g, ""))
      .map((s) => normalizeSpace(s))
      .filter(Boolean);
    names = parts;
  }
  return names;
}

// Extract all owners from modal or other owner-related areas
function extractAllOwners($) {
  const names = [];
  // Owners modal structured list
  $("#ownersModal .modal-body .col-md-3").each((i, el) => {
    const t = normalizeSpace($(el).text());
    if (t) names.push(t);
  });

  // Fallback: scan for any elements with text that look like owner names near labels containing Owner
  if (names.length === 0) {
    $("label").each((i, el) => {
      const t = $(el).text();
      if (/Owner/i.test(t)) {
        const val = $(el).closest("div").find("> div").first();
        if (val && val.length) {
          const clone = val.clone();
          clone.find("a, .modal, script, style").remove();
          const htmlFrag = clone.html() || "";
          const parts = htmlFrag
            .split(/<br\s*\/?\s*>/i)
            .map((s) => s.replace(/<[^>]*>/g, ""))
            .map((s) => normalizeSpace(s))
            .filter(Boolean);
          parts.forEach((p) => names.push(p));
        }
      }
    });
  }

  // Deduplicate by normalized key
  const seen = new Set();
  const dedup = [];
  for (const n of names) {
    const k = normalizeNameKey(n);
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      dedup.push(n);
    }
  }
  return dedup;
}

// Company detection keywords (case-insensitive)
const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "l l c",
  "ltd",
  "limited",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corporation",
  "co",
  "company",
  "services",
  "trust",
  "tr",
  "tr.",
  "trustees",
  "partnership",
  "partners",
  "lp",
  "llp",
  "holdings",
  "assoc",
  "association",
  "bank",
  "realty",
  "real estate",
];

function looksLikeCompany(name) {
  const n = normalizeNameKey(name);
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\$)`, "i").test(n),
  );
}

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function cleanInvalidCharsFromName(raw) {
  let parsedName = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
    .replace(/[^A-Za-z\-', .]/g, "") // Only keep valid characters
    .trim();
  while (/^[\-', .]/i.test(parsedName)) { // Cannot start or end with special characters
    parsedName = parsedName.slice(1);
  }
  while (/[\-', .]$/i.test(parsedName)) { // Cannot start or end with special characters
    parsedName = parsedName.slice(0, parsedName.length - 1);
  }
  return parsedName;
}

// Person parsing: assume common property appraiser format: LAST FIRST [MIDDLE...]
function parsePersonName(raw) {
  const cleaned = normalizeSpace(raw)
    .replace(/\bet\.?\s*al\.?$/i, "")
    .replace(/\b(joint\s+account|acct)\b/i, "")
    .trim();

  if (!cleaned || /&/g.test(cleaned)) return null; // ambiguous multi-party
  if (/[0-9]/.test(cleaned)) return null; // unlikely a person
  if (looksLikeCompany(cleaned)) return null;

  const tokens = cleaned.split(/\s+/);
  if (tokens.length < 2) return null;

  // If comma present we could be in First Last, but our sample isn't. Remove commas.
  const toks = tokens.map((t) => t.replace(/,/g, ""));

  // Heuristic: many assessor sites use LAST FIRST MIDDLE pattern
  const last = toks[0];
  const first = toks[1];
  const middle = toks.slice(2).join(" ").trim() || null;

  if (!first || !last) return null;

  return {
    type: "person",
    first_name: cleanInvalidCharsFromName(first),
    last_name: cleanInvalidCharsFromName(last),
    middle_name: cleanInvalidCharsFromName(middle) || null,
  };
}

function classifyOwner(raw) {
  const name = normalizeSpace(raw).replace(/\s+/g, " ");
  if (!name) return { valid: false, reason: "empty", raw };
  if (name.includes("&")) {
    // Ambiguous multi-party owner string
    return { valid: false, reason: "ambiguous_ampersand", raw: name };
  }
  if (looksLikeCompany(name)) {
    return { valid: true, owner: { type: "company", name } };
  }
  const person = parsePersonName(name);
  if (person) return { valid: true, owner: person };
  return { valid: false, reason: "unclassified", raw: name };
}

// Extract sale dates for potential mapping (may remain unused if no reliable association)
// function extractSaleDates($) {
//   const dates = [];
//   $("table.table.table-striped.details thead th").each((i, el) => {
//     const h = $(el).text().trim();
//     if (/^Sale Date$/i.test(h)) {
//       const table = $(el).closest("table");
//       table.find("tbody tr").each((ri, row) => {
//         const td = $(row).find("td").first();
//         const d = normalizeSpace(td.text());
//         if (d) dates.push(d);
//       });
//     }
//   });

//   // Normalize to YYYY-MM-DD
//   const norm = dates
//     .map((d) => {
//       // supports M/D/YYYY or MM/DD/YYYY
//       const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
//       if (!m) return null;
//       const [_, mm, dd, yyyy] = m;
//       const pad = (x) => x.toString().padStart(2, "0");
//       return `${yyyy}-${pad(mm)}-${pad(dd)}`;
//     })
//     .filter(Boolean);

//   // chronological ascending
//   norm.sort();
//   return norm;
// }

// Main extraction flow
const propertyId = getParcelId();
const allOwnersRaw = extractAllOwners($);
// const currentOwnersRaw = extractCurrentOwners($);

// Determine historical owners as those in allOwnersRaw but not in currentOwnersRaw
// const currentSet = new Set(currentOwnersRaw.map(normalizeNameKey));
// const historicalRaw = allOwnersRaw.filter(
//   (n) => !currentSet.has(normalizeNameKey(n)),
// );

// Classify and dedupe owners
function classifyAndDedup(rawList) {
  const result = [];
  const invalid = [];
  const seen = new Set();
  for (const raw of rawList) {
    const key = normalizeNameKey(raw);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = classifyOwner(raw);
    if (c.valid) {
      result.push(c.owner);
    } else {
      invalid.push({ raw: c.raw, reason: c.reason });
    }
  }
  return { validOwners: result, invalid };
}

const { validOwners: currentOwners, invalid: invalidCurrent } =
  classifyAndDedup(allOwnersRaw);
// const { validOwners: historicalOwners, invalid: invalidHistorical } =
//   classifyAndDedup(historicalRaw);

// Combine invalid owners
// const invalid_owners = [...invalidCurrent, ...invalidHistorical];

// Attempt to associate historical owners to dates; if not reliable, place under unknown_date_1
// const saleDates = extractSaleDates($); // extracted but not used to pair names due to lack of association in DOM

const owners_by_date = {};

// If we can reliably map (we cannot here), we'd create date keys; we'll use a single unknown group for historical
// if (historicalOwners.length > 0) {
//   owners_by_date["unknown_date_1"] = historicalOwners;
// }
// Always include current owners
owners_by_date["current"] = currentOwners;

const output = {};
output[`property_${propertyId}`] = { owners_by_date };
output["invalid_owners"] = invalidCurrent;

const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
// Save to file and print
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output, null, 2));
