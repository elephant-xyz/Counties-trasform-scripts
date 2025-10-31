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
  $("table.parcelIDtable td").each((_, td) => {
    const t = norm($(td).text());
    if (/^Parcel:?$/i.test(t)) {
      const next = $(td).nextAll("td").eq(1); // the bold id cell appears after the << button cell
      const raw = norm(next.text());
      if (raw) {
        // e.g., 1-10-37-35-0A00-00014-0000 (19330)
        const m = raw.match(/([A-Za-z0-9\-]+(?:\-[A-Za-z0-9]+)*)/);
        if (m) idFromParcel = m[1];
      }
    }
  });
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
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .filter(Boolean)
    .join(" ");
  return norm(parts).toLowerCase();
}

// Build owner object(s) from a raw string
function buildOwnersFromRaw(raw) {
  const owners = [];
  const s = norm(raw);
  if (!s) return owners;

  // Exclude lines that clearly are not owner names
  if (/^(c\/o|care of)\b/i.test(s)) return owners; // ignore care-of lines entirely
  if (/^(po box|p\.?o\.? box)/i.test(s)) return owners;

  // If name contains company indicators -> company
  if (isCompanyName(s)) {
    owners.push({ type: "company", name: s });
    return owners;
  }

  // Handle multiple names separated by newlines or specific patterns
  // Split by common separators that indicate multiple people
  const nameLines = s.split(/\n|\s*&\s*/).map(line => norm(line)).filter(Boolean);
  
  nameLines.forEach(nameLine => {
    if (isCompanyName(nameLine)) {
      owners.push({ type: "company", name: nameLine });
    } else {
      owners.push(...buildPersonFromSingleName(nameLine));
    }
  });

  return owners;
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.split(' ').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
}

function buildPersonFromSingleName(s) {
  const out = [];
  const cleaned = s.replace(/\s{2,}/g, " ");
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

  // 1) Owner & Property Info block: extract from the bold text in owner cell
  $("td").each((_, td) => {
    const label = norm($(td).text());
    if (/^Owner$/i.test(label)) {
      const valueTd = $(td).next("td");
      if (valueTd && valueTd.length) {
        const boldText = valueTd.find("b").text();
        if (boldText) {
          // Split by <br> tags to get individual owner names
          const ownerLines = boldText.split(/\n/).map(line => norm(line)).filter(Boolean);
          ownerLines.forEach(line => {
            // Skip address lines
            if (!/\b(\d{5})(?:-\d{4})?$/.test(line) && 
                !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
                !/^\d+\s/.test(line)) {
              cand.push(line);
            }
          });
        }
      }
    }
  });

  // 2) Hidden strOwner fallback - parse HTML entities
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner && norm(strOwner)) {
    // Parse HTML entities like <br> and extract names
    const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, '\n');
    const ownerLines = cleanOwner.split(/\n/).map(line => norm(line)).filter(Boolean);
    ownerLines.forEach(line => {
      if (!/\b(\d{5})(?:-\d{4})?$/.test(line) && 
          !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
          !/^\d+\s/.test(line) &&
          !cand.includes(line)) {
        cand.push(line);
      }
    });
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
  $("table.parcelDetails_insideTable tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const headerLike = norm($(tds.eq(0)).text());
      // Detect date formats like 2/7/2022
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(headerLike)) {
        const [m, d, y] = headerLike.split("/").map((x) => parseInt(x, 10));
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
// First try to get owner names from the strOwner hidden input which has the clean data
let rawCandidates = [];
const strOwner = $('input[name="strOwner"]').attr("value");
if (strOwner) {
  const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, '\n');
  const ownerLines = cleanOwner.split(/\n/).map(line => norm(line)).filter(Boolean);
  // Filter out address lines
  ownerLines.forEach(line => {
    if (!/\b(\d{5})(?:-\d{4})?$/.test(line) && 
        !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
        !/^\d+\s/.test(line)) {
      rawCandidates.push(line);
    }
  });
}

// If no candidates from strOwner, fall back to extracting from DOM
if (rawCandidates.length === 0) {
  rawCandidates = extractOwnerCandidates($);
}

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
