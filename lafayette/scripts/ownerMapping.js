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
  // Updated selector to directly target the bold text within the parcelIDtable
  const boldParcelText = $(".parcelIDtable b").first().text().trim();
  if (boldParcelText) {
    // e.g., 12-05-11-0000-0000-02900 (HX HB)
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
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
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

  // If name contains company indicators -> company
  if (isCompanyName(s)) {
    owners.push({ type: "company", name: s });
    return owners;
  }

  // Handle multiple names separated by newlines or specific patterns
  // Split by common separators that indicate multiple people
  const nameLines = s.split(/\n|\s*&\s*| and /i).map(line => norm(line)).filter(Boolean); // Added ' and ' as separator

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

  // Handle "JOHNSON BERNICE HEIRS" type names
  // If "HEIRS" is present, treat it as a descriptor, not part of the last name.
  // Assume the last word before "HEIRS" is the last name.
  const heirsIndex = parts.findIndex(part => part.toUpperCase() === 'HEIRS');
  if (heirsIndex !== -1 && heirsIndex > 0) {
    const lastName = parts[heirsIndex - 1];
    const firstNameParts = parts.slice(0, heirsIndex - 1);
    const firstName = firstNameParts.shift() || '';
    const middleName = firstNameParts.length > 0 ? firstNameParts.join(' ') : null;

    out.push({
      type: "person",
      first_name: formatNameToPattern(firstName),
      last_name: formatNameToPattern(lastName),
      ...(middleName ? { middle_name: formatNameToPattern(middleName) } : {}),
    });
    return out;
  }


  // Handle "LASTNAME FIRSTNAME" pattern (common in property records)
  // This logic needs to be careful not to misinterpret "JOHNSON BERNICE" as "BERNICE JOHNSON"
  // if both are uppercase. The sample HTML has "JOHNSON BERNICE HEIRS" where only JOHNSON is fully uppercase.
  if (parts.length === 2) {
    const [part1, part2] = parts;
    // If both parts are all caps, assume LASTNAME FIRSTNAME
    if (part1 === part1.toUpperCase() && part2 === part2.toUpperCase()) {
      out.push({
        type: "person",
        first_name: formatNameToPattern(part2),
        last_name: formatNameToPattern(part1),
      });
    } else {
      // Otherwise, assume FIRSTNAME LASTNAME
      out.push({
        type: "person",
        first_name: formatNameToPattern(part1),
        last_name: formatNameToPattern(part2),
      });
    }
    return out;
  }

  // General case: First word is first name, last word is last name, middle words are middle names
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
    // Find the "Owner" label and its corresponding value cell
    const ownerLabelTd = $('td:contains("Owner")').filter(function() {
      return $(this).text().trim() === 'Owner';
    }).first();

    if (ownerLabelTd.length) {
      const valueTd = ownerLabelTd.next("td");
      if (valueTd.length) {
        // Get the text content, preserving line breaks from <br> tags
        const ownerContent = textWithBreaks(valueTd);
        const ownerLines = ownerContent.split('\n').map(line => norm(line)).filter(Boolean);

        ownerLines.forEach(line => {
          // Filter out address lines
          if (!/\b(\d{5})(?:-\d{4})?$/.test(line) &&
              !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
              !/^\d+\s/.test(line)) {
            cand.push(line);
          }
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
    // Skip header row
    if ($(tr).find('td[align="center"]:contains("Sale Date")').length > 0) {
      return;
    }
    // Skip "N O N E" row
    if ($(tr).find('td[colspan="7"]:contains("N O N E")').length > 0) {
      return;
    }

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