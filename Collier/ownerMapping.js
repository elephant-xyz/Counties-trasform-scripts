const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

// Normalize strings: trim, collapse spaces
function norm(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

// Determine if text looks like an address or non-name noise
function isLikelyAddress(text) {
  const t = norm(text).toUpperCase();
  if (!t) return true;
  // Exclude pure zip/state/city-style tokens
  if (/^\d{5}(-\d{4})?$/.test(t)) return true;
  if (/^\d+[ -]?\d*$/.test(t)) return true; // mostly numbers
  // Common address tokens
  const addrTokens = [
    " ST ",
    " STREET ",
    " AVE ",
    " AVENUE ",
    " BLVD ",
    " WAY ",
    " RD ",
    " ROAD ",
    " DR ",
    " DRIVE ",
    " CT ",
    " COURT ",
    " LN ",
    " LANE ",
    " HWY ",
    " PKWY ",
    " PARKWAY ",
    " PL ",
    " PLACE ",
    " TRL ",
    " TRAIL ",
    " CIR ",
    " CIRCLE ",
    " UNIT ",
    " APT ",
    " SUITE ",
    " STE ",
    " P.O. ",
    " PO BOX ",
  ];
  const padded = " " + t + " ";
  for (const token of addrTokens) {
    if (padded.includes(token)) return true;
  }
  // Heuristic: contains a lot of digits
  const digitCount = (t.match(/\d/g) || []).length;
  if (digitCount >= 3) return true;
  // Single short token like city/state
  if (t.length <= 3) return true;
  return false;
}

// Company keyword detection (case-insensitive)
const companyKeywords = [
  "INC",
  "LLC",
  "L.L.C",
  "LTD",
  "L.T.D",
  "FOUNDATION",
  "ALLIANCE",
  "SOLUTIONS",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "SERVICES",
  "SERVICE",
  "TRUST",
  "TR",
  "LP",
  "LLP",
  "PLC",
  "HOLDINGS",
  "BANK",
  "N.A.",
  "NATIONAL ASSOCIATION",
  "ASSOCIATION",
  "ASSOC",
  "REALTY",
  "PROPERTIES",
  "PARTNERS",
  "INVESTMENTS",
  "GROUP",
  "ENTERPRISES",
  "HOLDING",
];

function looksLikeCompany(name) {
  const t = norm(name).toUpperCase();
  return companyKeywords.some((k) => {
    const kw = k.toUpperCase();
    const re = new RegExp(`(^|[^A-Z])${kw}([^A-Z]|$)`);
    return re.test(t);
  });
}

// Classify a raw owner name string into schema owner or invalid
function classifyOwner(raw) {
  const original = norm(raw);
  const text = original.replace(/[\r\n]+/g, " ").trim();
  if (!text) return { valid: false, reason: "empty" };

  // Basic noise/address filtering
  if (isLikelyAddress(text))
    return { valid: false, reason: "address_or_noise" };

  // Company check first
  if (looksLikeCompany(text)) {
    return { valid: true, owner: { type: "company", name: text } };
  }

  // Ampersand handling (e.g., John & Jane Smith)
  if (text.includes("&")) {
    const cleaned = norm(text.replace(/&/g, " "));
    const tokens = cleaned.split(" ").filter(Boolean);
    if (tokens.length < 2)
      return {
        valid: false,
        reason: "insufficient_name_parts_with_ampersand",
        raw: text,
      };
    const lastName = tokens[tokens.length - 1];
    const firstName = tokens.slice(0, -1).join(" ");
    return {
      valid: true,
      owner: {
        type: "person",
        first_name: firstName,
        last_name: lastName,
        middle_name: null,
      },
    };
  }

  // Person heuristic: require at least two tokens and no excessive punctuation
  const name = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2)
    return { valid: false, reason: "single_token_person", raw: text };

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleParts = parts.slice(1, -1).join(" ");
  const person = {
    type: "person",
    first_name: firstName,
    last_name: lastName,
    middle_name: middleParts ? middleParts : null,
  };
  return { valid: true, owner: person };
}

// Extract parcel/property id
function extractPropertyId($) {
  // 1) By element id hints
  const idCandidates = [];
  $("[id]").each((_, el) => {
    const idAttr = el.attribs && el.attribs.id ? el.attribs.id : "";
    if (/parcelid|folio|property.*id|prop.*id|gisflnnum/i.test(idAttr)) {
      const txt = norm($(el).text());
      if (txt) idCandidates.push(txt);
    }
  });
  // 2) By label next to value
  $("td, th, span, div, label").each((_, el) => {
    const txt = norm($(el).text());
    if (/^parcel id$/i.test(txt)) {
      const nextText = norm(
        $(el).parent().find("span, div").not(el).first().text(),
      );
      if (nextText) idCandidates.push(nextText);
    }
  });
  // Prefer numeric long id
  let best = null;
  for (const cand of idCandidates) {
    const m = cand.match(/\d{6,}/);
    if (m) {
      best = m[0];
      break;
    }
  }
  if (!best && idCandidates.length) best = idCandidates[0];
  return best ? best : "unknown_id";
}

// Extract all plausible owner name strings from variable structures
function extractOwnerNameStrings($) {
  const results = new Set();

  // 1) Any element whose id contains 'owner'
  $("[id]").each((_, el) => {
    const idAttr = el.attribs && el.attribs.id ? el.attribs.id : "";
    if (/owner/i.test(idAttr)) {
      const txt = norm($(el).text());
      if (txt) results.add(txt);
    }
  });

  // 2) Labels like 'Name / Address' with following sibling cell content
  $("td, th").each((_, el) => {
    const t = norm($(el).text());
    if (/^name\s*\/\s*address$/i.test(t) || /^owner(\s*name)?$/i.test(t)) {
      const row = $(el).closest("tr");
      const nextCells = row.nextAll("tr");
      const firstRowText = norm(row.find("span, div").not(el).first().text());
      if (firstRowText) results.add(firstRowText);
      nextCells.each((__, r) => {
        $(r)
          .find("span, div")
          .each((i2, s) => {
            const tx = norm($(s).text());
            if (tx) results.add(tx);
          });
      });
    }
  });

  // 3) Headings or spans commonly used
  $("[class], span, div").each((_, el) => {
    const cls = el.attribs && el.attribs.class ? el.attribs.class : "";
    if (/owner/i.test(cls)) {
      const tx = norm($(el).text());
      if (tx) results.add(tx);
    }
  });

  // Filter out noise/addressy entries aggressively; keep only likely names
  const filtered = [];
  for (const val of results) {
    // Ignore empty and very short tokens
    if (!val || val.length < 2) continue;
    // Exclude obvious address/geo lines
    if (isLikelyAddress(val)) continue;
    filtered.push(val);
  }

  // Additionally, try the canonical summary owner line if present (e.g., OwnerLine1)
  const ownerLine1 = norm($("#OwnerLine1").text());
  if (ownerLine1) {
    if (!isLikelyAddress(ownerLine1)) filtered.push(ownerLine1);
  }

  return filtered;
}

// Deduplicate owners by normalized key
function normalizeKeyForDedup(owner) {
  if (owner.type === "company")
    return owner.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return parts;
}

// Build owners_by_date map
function buildOwnersByDate(validOwners) {
  const map = {};
  // For this dataset, we do not have explicit historical owner groupings near dates.
  // Place all current owners under the 'current' key.
  map["current"] = validOwners;
  return map;
}

// Main processing
(function main() {
  const propertyId = extractPropertyId($);

  const rawOwnerStrings = extractOwnerNameStrings($);
  const validOwners = [];
  const invalidOwners = [];

  // Classify and collect
  for (const raw of rawOwnerStrings) {
    const res = classifyOwner(raw);
    if (res.valid) {
      validOwners.push(res.owner);
    } else {
      invalidOwners.push({ raw: norm(raw), reason: res.reason || "unknown" });
    }
  }

  // Deduplicate valid owners
  const seen = new Set();
  const deduped = [];
  for (const o of validOwners) {
    const key = normalizeKeyForDedup(o);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(o);
  }

  const ownersByDate = buildOwnersByDate(deduped);

  // Build final object
  const result = {};
  const propertyKey = `property_${propertyId || "unknown_id"}`;
  result[propertyKey] = {
    owners_by_date: ownersByDate,
    invalid_owners: invalidOwners,
  };

  // Persist file and print JSON
  const outDir = path.join(process.cwd(), "owners");
  const outPath = path.join(outDir, "owner_data.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result));
})();
