// ownerMapping.js
// Transform input.html into owners/owner_data.json using cheerio only for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: normalize a string's whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

const PAREN_QUALIFIER_SET = new Set([
  "DEC",
  "DECD",
  "DECEASED",
  "EST",
  "ESTATE",
  "HRS",
  "HEIRS",
  "DEV",
  "DEVISEES",
  "SUCC",
  "SUCCESSORS",
  "SURV",
  "SURVIVING",
]);

const TRAILING_QUALIFIER_PATTERNS = [
  "ET\\s+AL",
  "ET\\s+UX",
  "ET\\s+VIR",
  "ET\\s+CON",
  "JT\\s+TEN",
  "TEN\\s+COM",
  "TEN\\s+ENT",
  "HRS",
  "HEIRS",
  "DEV",
  "DEVISEES",
  "SUCC",
  "SUCCESSORS",
  "SURV",
  "SURVIVING",
  "EST",
  "ESTATE",
  "PERS\\s+REP",
  "PERSONAL\\s+REPRESENTATIVE",
  "ADMIN",
  "ADMINISTRATOR",
  "EXEC",
  "EXECUTOR",
  "ATTY",
];

const BREAK_TERMS = ["AKA", "FKA", "DBA"];

function stripOwnerQualifiers(name) {
  if (!name) return "";
  let cleaned = name;

  cleaned = cleaned.replace(/\b(?:C\/O|CARE OF)\b.*$/i, "");

  BREAK_TERMS.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b.*$`, "i");
    cleaned = cleaned.replace(regex, "");
  });

  cleaned = cleaned.replace(/\(([^)]+)\)/g, (match, inner) => {
    const normalized = inner.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (PAREN_QUALIFIER_SET.has(normalized)) {
      return " ";
    }
    return match;
  });

  let trimmed = norm(cleaned);
  if (!trimmed) return "";

  let updated = true;
  while (updated && trimmed) {
    updated = false;
    for (const pattern of TRAILING_QUALIFIER_PATTERNS) {
      const regex = new RegExp(`(?:,\\s*)?${pattern}(?:\\.?)$`, "i");
      if (regex.test(trimmed)) {
        trimmed = trimmed.replace(regex, "").trim();
        updated = true;
      }
    }
  }

  trimmed = trimmed.replace(/[,\-\/]+$/g, "").trim();

  return norm(trimmed);
}

// Helper: extract visible text including <br> as newlines
function textWithBreaks($el) {
  const parts = [];
  $el.contents().each((_, node) => {
    if (node.type === "text") parts.push(node.data);
    else if (node.name === "br") parts.push("\n");
    else if (node.type === "tag") parts.push(textWithBreaks($(node)));
  });
  return parts.join("");
}

// Heuristic: find parcel/property ID
function extractPropertyId($) {
  // 1) explicit hidden inputs commonly used
  const formatPIN = $('input[name="formatPIN"]').attr("value");
  if (formatPIN && norm(formatPIN)) return norm(formatPIN);

  const pin = $('input[name="PIN"]').attr("value");
  if (pin && norm(pin)) return norm(pin);

  const parcelIdBuffer = $('input[name="PARCELID_Buffer"]').attr("value");
  if (parcelIdBuffer && norm(parcelIdBuffer)) return norm(parcelIdBuffer);

  // 2) Text near "Parcel:" label
  let idFromParcel = null;
  // Updated selector to directly target the bold text within the parcelIDtable
  const boldParcelText = $(".parcelIDtable b").first().text().trim();
  if (boldParcelText) {
    // e.g., 23-4S-16-03099-117 (14877)
    const m = boldParcelText.match(/^([^\s(]+)/);
    if (m) idFromParcel = m[1];
  }
  if (idFromParcel) return idFromParcel;

  // 3) Fallback unknown
  return "unknown_id";
}

// Heuristic: detect company names
function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  // direct boundary checks for common suffixes/patterns
  if (
    /\b(inc|inc\.|corp|corp\.|co|co\.|ltd|ltd\.|llc|l\.l\.c\.|plc|plc\.|pc|p\.c\.|pllc|trust|tr|n\.?a\.?|bank|foundation|alliance|solutions|services|associates|association|holdings|partners|properties|enterprises|management|investments|group|development)\b\.?/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

// Normalize for deduplication
function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") {
    return norm(stripOwnerQualifiers(owner.name)).toLowerCase();
  }
  const first = stripOwnerQualifiers(owner.first_name);
  const middle = stripOwnerQualifiers(owner.middle_name || "");
  const last = stripOwnerQualifiers(owner.last_name);
  const parts = [first, middle, last]
    .filter(Boolean)
    .join(" ");
  return norm(parts).toLowerCase();
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.split(' ').map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
}

// Build owner object(s) from a raw string
function buildOwnersFromRaw(raw) {
  const owners = [];
  const s = norm(raw);
  if (!s) return owners;

  // Exclude lines that clearly are not owner names
  if (/^(c\/o|care of)\b/i.test(s)) return owners; // ignore care-of lines entirely
  if (/^(po box|p\.?o\.? box)/i.test(s)) return owners;

  const cleaned = stripOwnerQualifiers(s);
  if (!cleaned) return owners;

  // If name contains company indicators -> company
  if (isCompanyName(cleaned)) {
    owners.push({ type: "company", name: cleaned });
    return owners;
  }

  // Handle multiple names separated by newlines or specific patterns
  // Split by common separators that indicate multiple people
  const nameLines = cleaned
    .split(/\n|\s*&\s*/)
    .map((line) => stripOwnerQualifiers(norm(line)))
    .filter(Boolean);

  nameLines.forEach(nameLine => {
    if (isCompanyName(nameLine)) {
      owners.push({ type: "company", name: nameLine });
    } else {
      owners.push(...buildPersonFromSingleName(nameLine));
    }
  });

  return owners;
}

function buildPersonFromSingleName(s) {
  const out = [];
  const stripped = stripOwnerQualifiers(s);
  if (!stripped) return out;
  const cleaned = stripped.replace(/\s{2,}/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    // Single word cannot be confidently parsed as person -> treat as company fallback
    out.push({ type: "company", name: cleaned });
    return out;
  }

  // Handle LAST, FIRST M style
  if (/,/.test(cleaned)) {
    const [last, rest] = cleaned.split(",", 2).map((x) => norm(x));
    const restParts = (rest || "").split(/\s+/).filter(Boolean);
    const first = restParts.shift() || "";
    const middle = restParts.length ? norm(restParts.join(" ")) : null;
    out.push({
      type: "person",
      first_name: formatNameToPattern(first),
      last_name: formatNameToPattern(last),
      ...(middle ? { middle_name: formatNameToPattern(middle) } : {}),
    });
    return out;
  }

  // Handle "LASTNAME FIRSTNAME" pattern (common in property records)
  if (parts.length === 2) {
    // Check if first part looks like a last name (all caps typically)
    const [part1, part2] = parts;
    if (part1 === part1.toUpperCase() && part2 === part2.toUpperCase()) {
      // Both are uppercase, assume LASTNAME FIRSTNAME
      out.push({
        type: "person",
        first_name: formatNameToPattern(part2),
        last_name: formatNameToPattern(part1),
      });
    } else {
      // Normal FIRSTNAME LASTNAME
      out.push({
        type: "person",
        first_name: formatNameToPattern(part1),
        last_name: formatNameToPattern(part2),
      });
    }
    return out;
  }

  // Handle multiple parts - assume first is first name, last is last name, middle are middle names
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middleParts = parts.slice(1, -1).filter(Boolean);
  const middle = middleParts.length ? norm(middleParts.join(" ")) : null;

  out.push({
    type: "person",
    first_name: formatNameToPattern(first),
    last_name: formatNameToPattern(last),
    ...(middle ? { middle_name: formatNameToPattern(middle) } : {}),
  });
  return out;
}

// Extract owner name candidates from the document
function extractOwnerCandidates($) {
  const cand = [];

  // Prioritize strOwner hidden input as it often contains cleaner data
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner && norm(strOwner)) {
    // Parse HTML entities like <br> and extract names
    const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, '\n');
    const ownerLines = cleanOwner.split(/\n/).map(line => norm(line)).filter(Boolean);
    ownerLines.forEach(line => {
      // Filter out address lines (contains zip code, common street suffixes, or starts with a number)
      if (!/\b(\d{5})(?:-\d{4})?$/.test(line) &&
          !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
          !/^\d+\s/.test(line)) {
        cand.push(line);
      }
    });
  }

  // Fallback to DOM extraction if strOwner is not available or empty
  if (cand.length === 0) {
    // Updated selector to target the owner name within the parcelDetails_insideTable
    const ownerTd = $(".parcelDetails_insideTable td:contains('Owner')").next("td");
    if (ownerTd && ownerTd.length) {
      const boldEl = ownerTd.find("b").first();
      if (boldEl && boldEl.length) {
        const rawHtml = boldEl.html() || "";
        const segments = rawHtml
          .split(/<br\s*\/?>/i)
          .map((segment) => norm(segment.replace(/<[^>]+>/g, "")))
          .filter(Boolean);
        const ownerLines =
          segments.length > 0 ? segments : [norm(boldEl.text())].filter(Boolean);
        ownerLines.forEach((line) => {
          if (!line) return;
          const looksLikeCompany = isCompanyName(line);
          if (
            /\b(\d{5})(?:-\d{4})?$/.test(line) ||
            (/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) && !looksLikeCompany) ||
            (/^\d+\s/.test(line) && !looksLikeCompany)
          ) {
            return;
          }
          cand.push(line);
        });
      }
    }
  }

  // Deduplicate raw candidates by normalized text
  const seen = new Set();
  const uniq = [];
  cand.forEach((c) => {
    const key = norm(c).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniq.push(c);
  });
  return uniq;
}

// Attempt to extract historical dates near owners (fallback to Sales History if clearly associated). Here, no owner names are near dates.
function extractHistoricalDates($) {
  const dates = [];
  // Parse Sales History dates as potential ownership change markers
  // Updated selector to target the sales history table more specifically
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const dateText = norm($(tds.eq(0)).text());
      // Detect date formats like 9/30/2009
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateText)) {
        const [m, d, y] = dateText.split("/").map((x) => parseInt(x, 10));
        const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        dates.push(iso);
      }
    }
  });
  // unique and sorted
  const uniq = Array.from(new Set(dates));
  uniq.sort();
  return uniq;
}

// Main assembly
const propertyId = extractPropertyId($);
let rawCandidates = extractOwnerCandidates($);

// Classify and deduplicate structured owners
const owners = [];
const ownerSeen = new Set();
const invalidOwners = [];
rawCandidates.forEach((raw) => {
  const built = buildOwnersFromRaw(raw);
  if (!built || !built.length) {
    invalidOwners.push({ raw: raw, reason: "no_owner_extracted" });
    return;
  }
  built.forEach((o) => {
    if (!o) return;
    if (o.type === "person") {
      if (!o.first_name || !o.last_name) {
        invalidOwners.push({ raw: raw, reason: "person_missing_name_parts" });
        return;
      }
      if (!("middle_name" in o)) o.middle_name = null;
    } else if (o.type === "company") {
      if (!o.name) {
        invalidOwners.push({ raw: raw, reason: "company_missing_name" });
        return;
      }
    } else {
      invalidOwners.push({ raw: raw, reason: "unrecognized_type" });
      return;
    }
    const key = normalizeOwnerKey(o);
    if (!key) {
      invalidOwners.push({ raw: raw, reason: "empty_normalized_key" });
      return;
    }
    if (ownerSeen.has(key)) return;
    ownerSeen.add(key);
    owners.push(o);
  });
});

// Owners by date: assign current owners; add historical date keys if confidently associated (not in this document)
const ownersByDate = {};
ownersByDate["current"] = owners;

// Build final object
const output = {
  invalid_owners: invalidOwners,
};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
};

// Ensure target directory exists and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON result
console.log(JSON.stringify(output, null, 2));
