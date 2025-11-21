const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: trim and collapse spaces
const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();

// Extract Property ID with multiple fallbacks
function getPropertyId($) {
  let vid = null;
  $(".summary-card .row").each((i, row) => {
    const label = $(row).find(".col-4").first().text().trim();
    const val = $(row).find(".col-8").first().text().trim();
    if (label === "VID:") vid = val;
  });
  if (!vid) {
    const res = $(".result-card").attr("data-parcel-pid");
    if (res) vid = res.trim();
  }
  return vid || "unknown";
}

// Heuristic classification to detect companies
function isCompanyName(name) {
  const companyRegex =
    /(inc\.?|incorporated|l\.?l\.?c\.?|llc|ltd\.?|limited|foundation|alliance|solutions|corp\.?|corporation|co\.?|company|services|trust\b|\btr\b|associates|partners|holdings|properties|property|group|management|enterprise|enterprises|bank|church|ministr(?:y|ies)|llp|pllc)/i;
  return companyRegex.test(name);
}

// Heuristic: looks like address
function looksLikeAddress(s) {
  const addrWords =
    /(\b(st|street|ave|avenue|rd|road|dr|drive|blvd|lane|ln|hwy|suite|ste|apt|#)\b|\bFL\b|\bCA\b|\bGA\b|\bTX\b|\bNY\b|\b\d{5}(-\d{4})?\b)/i;
  const manyDigits = /\d{2,}/;
  return (
    addrWords.test(s) || (manyDigits.test(s) && /\b(\d+\s+[A-Za-z]+)/.test(s))
  );
}

// Heuristic: scrub candidate text
function cleanCandidate(t) {
  let s = normSpace(t);
  s = s.replace(/^owner\s*:?\s*/i, "");
  s = s.replace(/\s+\|\s+.*/, ""); // drop trailing pipe details
  return normSpace(s);
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

// Split full personal name into parts
function splitPersonName(name) {
  const cleaned = normSpace(name.replace(/&/g, " "));
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first_name = cleanInvalidCharsFromName(parts[0]);
  const last_name = cleanInvalidCharsFromName(parts[parts.length - 1]);
  const middle = cleanInvalidCharsFromName(parts.slice(1, -1).join(" "));
  return {
    type: "person",
    first_name: first_name || null,
    last_name: last_name || null,
    middle_name: middle ? middle : null,
  };
}

function classifyOwner(raw) {
  const name = normSpace(raw);
  if (!name) return { valid: false, reason: "empty" };
  if (/^please\b/i.test(name)) return { valid: false, reason: "ui_message" };
  if (looksLikeAddress(name))
    return { valid: false, reason: "looks_like_address" };
  // minimal alpha content
  if (!/[A-Za-z]/.test(name)) return { valid: false, reason: "no_letters" };

  if (isCompanyName(name)) {
    return { valid: true, owner: { type: "company", name } };
  }

  if (name.includes("&")) {
    const person = splitPersonName(name);
    if (person) return { valid: true, owner: person };
    return { valid: false, reason: "ampersand_unparsable" };
  }

  const person = splitPersonName(name);
  if (person) return { valid: true, owner: person };
  return { valid: false, reason: "unclassified" };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let key;
    if (o.type === "company")
      key = "company:" + normSpace(o.name).toLowerCase();
    else
      key =
        "person:" +
        [o.first_name, o.middle_name || "", o.last_name]
          .map((v) => (v || "").toLowerCase())
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

// Collect plausible owner name candidates from multiple DOM locations
function collectOwnerCandidates($) {
  const set = new Set();

  // 1) Explicit parcel owner field (details section)
  const parcelOwner = normSpace($(".parcelDetails .parcel_owner").text());
  if (parcelOwner) set.add(parcelOwner);

  // 2) Summary card row labeled "Owner:" within details section
  $(".parcelDetails .summary-card .row .col-4").each((i, el) => {
    const label = normSpace($(el).text());
    if (/^owner:?$/i.test(label)) {
      const value = normSpace($(el).siblings(".col-8").first().text());
      if (value) set.add(value);
    }
  });

  // 3) Results card header: second row is owner
  $(".results-section .result-card .result-card-header").each((i, hdr) => {
    const rows = $(hdr).find(".row .col-12");
    if (rows.length >= 2) {
      const ownerRow = normSpace($(rows.get(1)).text());
      if (ownerRow) set.add(ownerRow);
    }
  });

  // Exclude any text coming from search section or error elements
  const arr = Array.from(set)
    .map(cleanCandidate)
    .filter((s) => s && !/^please\b/i.test(s))
    .filter((s) => s.length <= 120);

  return arr;
}

// Attempt to associate dates (historical). In absence of explicit owner-by-date sections, we default to current only.
function extractHistoricalDates($) {
  // Sales table dates could be used, but owner names are not present near them in this HTML.
  // We'll return an empty array (no dated owner groups) and rely on current.
  return [];
}

const propertyId = getPropertyId($);
const candidates = collectOwnerCandidates($);

const validOwners = [];
const invalidOwners = [];

for (const raw of candidates) {
  const c = classifyOwner(raw);
  if (c.valid) validOwners.push(c.owner);
  else invalidOwners.push({ raw: raw, reason: c.reason });
}

const dedupedCurrent = dedupeOwners(validOwners);

// Owners by date structure
const owners_by_date = {};
owners_by_date["current"] = dedupedCurrent;

// If we had historical dated owners, we would add them here in chronological order.
const dated = extractHistoricalDates($);
for (const group of dated) {
  owners_by_date[group.key] = group.owners;
}

const out = {};
out[`property_${propertyId}`] = { owners_by_date };
out["invalid_owners"] = invalidOwners;

// Ensure output directory and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

// Print to stdout
console.log(JSON.stringify(out, null, 2));
