const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read input JSON (treated as the source data for a single property)
const inputPath = path.join(process.cwd(), "input.json");
const raw = fs.readFileSync(inputPath, "utf-8");
const data = JSON.parse(raw);

// Utility: recursive search for the first value whose key matches a regex
function findFirstValueByKeyRegex(obj, regex) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const res = findFirstValueByKeyRegex(item, regex);
      if (res !== undefined) return res;
    }
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (regex.test(k)) return v;
      const res = findFirstValueByKeyRegex(v, regex);
      if (res !== undefined) return res;
    }
  }
  return undefined;
}

// Utility: collect all string values for keys that match regex
function collectAllStringsByKeyRegex(obj, regex) {
  const results = [];
  (function walk(o) {
    if (o === null || o === undefined) return;
    if (Array.isArray(o)) {
      for (const it of o) walk(it);
    } else if (typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (regex.test(k) && typeof v === "string") {
          results.push(v);
        }
        walk(v);
      }
    }
  })(obj);
  return results;
}

// Normalization helpers
function normalizeWhitespace(str) {
  return String(str || "")
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
}

function stripPunctuation(str) {
  return str.replace(/^[,;\-\s]+|[,;\-\s]+$/g, "").trim();
}

function cleanName(rawName) {
  return stripPunctuation(normalizeWhitespace(rawName)).replace(/\s{2,}/g, " ");
}

// Company detection (case-insensitive)
const companyRegex = new RegExp(
  // includes many common company/organization indicators, including Trust/TR as requested
  "(?:\\binc\\b|\\bincorporated\\b|\\bllc\\b|\\bl\\.?l\\.?c\\.?\\b|\\bltd\\b|\\blimited\\b|\\bfoundation\\b|\\balliance\\b|\\bsolutions\\b|\\bcorp\\b|\\bcorporation\\b|\\bco\\b|\\bcompany\\b|\\bservices\\b|\\btrust\\b|\\btr\\b|\\bassociates\\b|\\bholdings\\b|\\bpartners?\\b|\\blp\\b|\\bllp\\b|\\bpllc\\b|\\bplc\\b|\\bproperties\\b|\\brealty\\b|\\bhomes?\\b|\\bapartments?\\b|\\bestates?\\b|\\bbank\\b|\\bcredit union\\b|\\bministr(y|ies)\\b|\\bchurch\\b|\\bcounty\\b|\\bstate\\b|\\bcity\\b|\\btown\\b|\\bvillage\\b|\\bgovernment\\b|\\bauthority\\b|\\bdistrict\\b|\\bdepartment\\b|\\bagency\\b|\\bbcc\\b|\\bboard\\b)",
  "i",
);

const personSuffixes = new Set(["JR", "SR", "III", "IV", "II"]);

function isCompany(name) {
  return companyRegex.test(name);
}

function parsePersonName(name) {
  const original = name;
  let n = cleanName(name);
  // If there is an ampersand, follow instruction: remove it and split into first_name and last_name
  if (n.includes("&")) {
    const noAmp = n
      .replace(/&/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const parts = noAmp.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      const first_name = parts.slice(0, parts.length - 1).join(" ");
      const last_name = parts[parts.length - 1];
      return { type: "person", first_name, last_name, middle_name: null };
    }
  }

  // Remove trailing commas or trustee markers when parsing people (though classification should filter non-companies)
  n = n
    .replace(/\bTRUSTEE\b\.?,?$/i, "")
    .replace(/\bTR\b\.?,?$/i, "")
    .trim();

  const commaParts = n
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let first_name = null,
    last_name = null,
    middle_name = null;

  if (commaParts.length === 2) {
    // Format: Last, First [Middle]
    last_name = commaParts[0];
    const rem = commaParts[1].split(" ").filter(Boolean);
    if (rem.length >= 1) first_name = rem[0];
    if (rem.length >= 2) {
      const mid = rem.slice(1).join(" ");
      if (mid && !personSuffixes.has(mid.toUpperCase())) middle_name = mid;
    }
  } else {
    const parts = n.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      // Heuristic for deed records often "LAST FIRST M" -> infer first as second token, last as first token
      last_name = parts[0];
      first_name = parts[1];
      if (parts.length >= 3) {
        const maybeMid = parts[2];
        if (!personSuffixes.has(maybeMid.toUpperCase())) {
          middle_name = maybeMid;
        }
      }
    }
  }

  if (!first_name || !last_name) return null;
  return {
    type: "person",
    first_name,
    last_name,
    middle_name: middle_name || null,
  };
}

function ownerFromRaw(rawName) {
  const cleaned = cleanName(rawName);
  if (!cleaned) return { invalid: { raw: rawName, reason: "empty" } };
  if (isCompany(cleaned)) {
    return { owner: { type: "company", name: cleaned } };
  }
  const person = parsePersonName(cleaned);
  if (person) return { owner: person };
  return { invalid: { raw: rawName, reason: "unclassified" } };
}

function splitCandidateNames(str) {
  if (!str) return [];
  // Use cheerio to load text as HTML fragment to adhere to HTML parsing rule (even if input is plain text)
  const $ = cheerio.load('<div id="root"></div>');
  $("#root").text(String(str));
  const text = $("#root").text();
  // Primary splitting by commas; keep phrases together otherwise.
  const parts = text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

function normalizeOwnerKey(obj) {
  if (!obj) return "";
  if (obj.type === "company") return obj.name.toLowerCase();
  const fn = (obj.first_name || "").toLowerCase();
  const mn = (obj.middle_name || "").toLowerCase();
  const ln = (obj.last_name || "").toLowerCase();
  return [fn, mn, ln].filter(Boolean).join(" ").trim();
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    const key = normalizeOwnerKey(o);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

// Extract property ID
let propertyId = undefined;
propertyId = findFirstValueByKeyRegex(
  data,
  /^(property[_]?id|propid|parcelid|id)$/i,
);
if (
  !propertyId ||
  (typeof propertyId !== "string" && typeof propertyId !== "number")
) {
  propertyId = "unknown_id";
}
const propertyKey = `property_${propertyId}`;

// Current owners: gather all plausible owner fields
const ownerFieldStrings = collectAllStringsByKeyRegex(data, /owner/i);
let currentOwners = [];
let invalidOwners = [];
for (const s of ownerFieldStrings) {
  const parts = splitCandidateNames(s);
  for (const p of parts) {
    const res = ownerFromRaw(p);
    if (res.owner) currentOwners.push(res.owner);
    if (res.invalid) invalidOwners.push(res.invalid);
  }
}
currentOwners = dedupeOwners(currentOwners);

// Historical owners from sales history (buyers at saleDate)
const ownersByDateMap = new Map(); // dateKey -> array of owners
let unknownCounter = 0;

const sales = Array.isArray(data.parcelSalesHistory)
  ? data.parcelSalesHistory.slice()
  : [];
sales.sort((a, b) => {
  const ad = a && a.saleDate ? String(a.saleDate) : "";
  const bd = b && b.saleDate ? String(b.saleDate) : "";
  return ad.localeCompare(bd);
});

for (const rec of sales) {
  let dateKey = (rec && rec.saleDate ? String(rec.saleDate) : "").split("T")[0];
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    unknownCounter += 1;
    dateKey = `unknown_date_${unknownCounter}`;
  }
  const buyerRaw = rec && typeof rec.buyer === "string" ? rec.buyer : "";
  const buyerParts = splitCandidateNames(buyerRaw);
  const dateOwners = [];
  for (const bp of buyerParts) {
    const res = ownerFromRaw(bp);
    if (res.owner) dateOwners.push(res.owner);
    if (res.invalid) invalidOwners.push(res.invalid);
  }
  const deduped = dedupeOwners(dateOwners);
  if (deduped.length > 0) {
    ownersByDateMap.set(dateKey, deduped);
  }
}

// Build chronological owners_by_date ending with current
const dateKeys = Array.from(ownersByDateMap.keys())
  .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) || /^unknown_date_\d+$/.test(k))
  .sort((a, b) => {
    const isUnknownA = /^unknown_date_\d+$/.test(a);
    const isUnknownB = /^unknown_date_\d+$/.test(b);
    if (isUnknownA && isUnknownB) {
      const na = parseInt(a.replace(/[^\d]/g, ""), 10);
      const nb = parseInt(b.replace(/[^\d]/g, ""), 10);
      return na - nb;
    }
    if (isUnknownA) return -1;
    if (isUnknownB) return 1;
    return a.localeCompare(b);
  });

const owners_by_date = {};
for (const dk of dateKeys) {
  owners_by_date[dk] = ownersByDateMap.get(dk) || [];
}
owners_by_date["current"] = currentOwners;

const output = {};
output[propertyKey] = { owners_by_date };
output["invalid_owners"] = invalidOwners.filter((v, idx, arr) => {
  const key = (v.raw || "").toLowerCase().trim() + "|" + (v.reason || "");
  const firstIdx = arr.findIndex(
    (x) => (x.raw || "").toLowerCase().trim() + "|" + (x.reason || "") === key,
  );
  return firstIdx === idx;
});

const outStr = JSON.stringify(output, null, 2);
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "owner_data.json"), outStr, "utf-8");
console.log(outStr);
