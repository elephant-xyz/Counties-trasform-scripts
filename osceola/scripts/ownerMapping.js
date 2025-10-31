const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const htmlPath = path.resolve("input.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

// Helpers
function textClean(t) {
  if (!t) return "";
  return t
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
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

function getPropertyId($) {
  let id = $("#stu").attr("value") || $("#stu").val();
  if (id) return textClean(id);
  // Try to find any element containing 'Parcel ID:'
  let candidate = "";
  $("*").each((i, el) => {
    const t = $(el).text();
    if (t && t.includes("Parcel ID")) {
      const txt = textClean(t);
      if (txt.length > candidate.length) candidate = txt;
    }
  });
  if (candidate) {
    // Extract the longest digit sequence
    const matches = candidate.match(/\d+/g) || [];
    let longest = matches.sort((a, b) => b.length - a.length)[0];
    if (longest) return longest;
  }
  return "unknown_id";
}

const companyIndicators = [
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
  "holdings",
  "partners",
  "properties",
  "management",
  "realty",
  "investment",
  "investments",
  "association",
  "assn",
  "lp",
  "llp",
  "plc",
  "gmbh",
  "s.a.",
  "s.a",
  "sas",
  "pty",
  "bv",
  "nv",
  "company",
];
const companyRx = new RegExp(
  `\\b(?:${companyIndicators.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);

function splitMultiOwners(raw) {
  if (!raw) return [];
  const normalized = textClean(raw)
    .replace(/\(.*?\)/g, "") // remove parenthetical notes
    .replace(/c\/o\s+/gi, "") // remove C/O if present
    .replace(/\bet\.?\s*al\.?/gi, "") // remove et al
    .trim();
  if (!normalized) return [];
  // Split on & or ' and ' or line separators or ';' or '/'
  let parts = normalized
    .split(/\s*&\s*|\s+and\s+|;|\n|\r|\s*\/\s*/i)
    .map((p) => textClean(p))
    .filter((p) => p);
  // If nothing split, keep as single
  if (parts.length === 0) parts = [normalized];
  return parts;
}

function classifyOwner(name) {
  const raw = textClean(name);
  if (!raw) return { invalid: true, raw, reason: "empty" };
  // Company detection first
  if (companyRx.test(raw)) {
    return { type: "company", name: raw };
  }
  // Person detection: require at least two tokens
  let n = raw.replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  const parts = n.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const first_name = cleanInvalidCharsFromName(parts[0]);
    const last_name = cleanInvalidCharsFromName(parts[parts.length - 1]);
    const middleParts = parts.slice(1, -1).filter(Boolean);
    const middle_name = middleParts.length ? cleanInvalidCharsFromName(middleParts.join(" ")) : null;
    if (first_name && last_name) {
      return {
        type: "person",
        first_name,
        last_name,
        middle_name: middle_name || null,
      };
    }
  }
  // If looks like a single token but could still be a company without indicator; mark invalid
  return { invalid: true, raw, reason: "unclassified" };
}

function ownerKey(o) {
  if (!o) return "";
  if (o.type === "company") return o.name.toLowerCase().trim();
  if (o.type === "person") {
    return [o.first_name, o.middle_name || "", o.last_name]
      .join(" ")
      .toLowerCase()
      .trim();
  }
  return "";
}

function toISODate(d) {
  if (!d) return null;
  const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  let mm = m[1].padStart(2, "0");
  let dd = m[2].padStart(2, "0");
  let yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Extract property id
const propId = getPropertyId($);
const propKey = `property_${propId}`;

// Extract current owners from multiple plausible locations
const currentOwnerStrings = new Set();
// 1) Owner Information block
$(".ownr_Info_body .Grantors").each((i, el) => {
  const txt = textClean($(el).text()).replace(/^Owner\(s\):\s*/i, "");
  if (txt) currentOwnerStrings.add(txt);
});
// 2) Main results grid owner cell
$('#mainSearchResults td[data-transpose="Owner(s)"]').each((i, el) => {
  const txt = textClean($(el).text());
  if (txt) currentOwnerStrings.add(txt);
});

// Build current owners list
const invalidOwners = [];
function buildOwnerObjectsFromText(t) {
  const parts = splitMultiOwners(t);
  const owners = [];
  for (const p of parts) {
    const classified = classifyOwner(p);
    if (classified.invalid) {
      invalidOwners.push({ raw: textClean(p), reason: classified.reason });
    } else {
      owners.push(classified);
    }
  }
  // Deduplicate within this set
  const dedup = new Map();
  for (const o of owners) {
    const k = ownerKey(o);
    if (k && !dedup.has(k)) dedup.set(k, o);
  }
  return Array.from(dedup.values());
}

let currentOwners = [];
for (const s of currentOwnerStrings) {
  currentOwners = currentOwners.concat(buildOwnerObjectsFromText(s));
}
// Final dedupe for current owners
{
  const dedup = new Map();
  for (const o of currentOwners) {
    const k = ownerKey(o);
    if (k && !dedup.has(k)) dedup.set(k, o);
  }
  currentOwners = Array.from(dedup.values());
}

// Extract historical owners with dates from Parcel Sales History table
const ownersByDateRaw = [];
let unknownDateCounter = 1;
$("#shVals tbody tr").each((i, tr) => {
  const $tr = $(tr);
  // columns are known from header sequence
  let saleDateTxt = textClean(
    $tr.find('td[data-transpose="Sale Date"]').text(),
  );
  if (!saleDateTxt) saleDateTxt = textClean($tr.children().eq(0).text());
  const iso = toISODate(saleDateTxt) || `unknown_date_${unknownDateCounter++}`;
  let granteeTxt = textClean($tr.find('td[data-transpose^="Grantee"]').text());
  if (!granteeTxt) granteeTxt = textClean($tr.children().eq(4).text());
  if (granteeTxt) {
    const owners = buildOwnerObjectsFromText(granteeTxt);
    if (owners.length) {
      ownersByDateRaw.push({ date: iso, owners });
    } else {
      // if nothing valid, record invalid raw
      invalidOwners.push({
        raw: granteeTxt,
        reason: "no_valid_owner_from_sale",
      });
    }
  }
});

// Group by date with dedupe per date
const ownersByDateMap = new Map();
for (const rec of ownersByDateRaw) {
  if (!ownersByDateMap.has(rec.date)) ownersByDateMap.set(rec.date, new Map());
  const m = ownersByDateMap.get(rec.date);
  for (const o of rec.owners) {
    const k = ownerKey(o);
    if (k && !m.has(k)) m.set(k, o);
  }
}

// Sort dates: valid YYYY-MM-DD first ascending, then unknown_date_n by numeric order
const dateKeys = Array.from(ownersByDateMap.keys());
const validDates = dateKeys
  .filter((k) => /\d{4}-\d{2}-\d{2}/.test(k))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const unknownDates = dateKeys
  .filter((k) => !/\d{4}-\d{2}-\d{2}/.test(k))
  .sort((a, b) => {
    const na = parseInt((a.match(/unknown_date_(\d+)/) || [])[1] || "0", 10);
    const nb = parseInt((b.match(/unknown_date_(\d+)/) || [])[1] || "0", 10);
    return na - nb;
  });
const orderedDates = [...validDates, ...unknownDates];

// Build final owners_by_date object preserving order, then add current
const owners_by_date = {};
for (const d of orderedDates) {
  const arr = Array.from(ownersByDateMap.get(d).values());
  if (arr.length) owners_by_date[d] = arr;
}
owners_by_date["current"] = currentOwners;

const output = {
  [propKey]: {
    owners_by_date,
    invalid_owners: invalidOwners,
  },
};

// Ensure output directory and write file
const outDir = path.resolve("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print to stdout
console.log(JSON.stringify(output, null, 2));
