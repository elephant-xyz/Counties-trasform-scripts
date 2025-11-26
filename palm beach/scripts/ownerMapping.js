const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Utility: clean text
function clean(str) {
  return (str || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s*&\s*$/, "") // drop trailing ampersand like "NAME &"
    .replace(/\s+/g, " ")
    .trim();
}

// Name normalization helpers for person parsing
const PERSON_NAME_PATTERN = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
const MIDDLE_PLACEHOLDERS = new Set([
  "nmi",
  "n m i",
  "nm",
  "n m",
  "no",
  "none",
  "no middle",
  "no middle name",
  "no middle initial",
  "none recorded",
  "unknown",
  "na",
  "n/a",
  "no mn",
]);

function formatNamePart(part) {
  if (!part) return null;
  const cleaned = clean(part)
    .replace(/[^A-Za-z\s\-',.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const normalized = cleaned
    .toLowerCase()
    .replace(/(^|[ \-',.])([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
    .replace(/\s+/g, " ")
    .trim();
  return PERSON_NAME_PATTERN.test(normalized) ? normalized : null;
}

function normalizeMiddleName(middle) {
  if (!middle) return null;
  const cleaned = clean(middle)
    .replace(/[^A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const canonical = cleaned.toLowerCase();
  if (!canonical || MIDDLE_PLACEHOLDERS.has(canonical)) return null;
  return formatNamePart(cleaned);
}

// Detect company tokens
const companyRegex =
  /(\b(?:inc|l\.?l\.?c|llc|ltd|co\.?|company|corp\.?|corporation|foundation|alliance|solutions|services|trust\b|\btr\b|associates|association|partners|holdings|group|bank|mortgage|investment|investments|lp|llp|plc)\b)/i;

// Normalize owner key for dedup
function normalizeOwner(owner) {
  if (!owner) return "";
  if (owner.type === "company") {
    return clean(owner.name).toLowerCase();
  }
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .filter(Boolean)
    .map((x) => clean(String(x)).toLowerCase());
  return parts.join(" ").trim();
}

// Split a raw owner string into possible multiple owners using common delimiters
function splitRawOwners(raw) {
  const s = clean(raw);
  if (!s) return [];
  // Replace common joiners with a delimiter
  const replaced = s.replace(/\s+(?:and|&)\s+/gi, " | ");
  return replaced
    .split("|")
    .map((x) => clean(x))
    .filter(Boolean);
}

// Parse a person name from assessor-style strings (often LAST FIRST MIDDLE or LAST, FIRST MIDDLE)
function parsePersonName(raw, carryLastName, isContinuation) {
  const s = clean(raw).replace(/\./g, "");
  if (!s) return null;

  // Remove common suffixes
  const suffixes = ["JR", "SR", "II", "III", "IV", "V"];

  // If continuation after a joiner and we have carry-last-name, parse as FIRST [MIDDLE] with carried LAST
  const carriedLast = formatNamePart(carryLastName);

  if (isContinuation && carriedLast) {
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 1) {
      const first = formatNamePart(parts[0]);
      if (!first) return null;
      const rawMiddle = parts.length >= 2 ? parts.slice(1).join(" ") : null;
      return {
        type: "person",
        first_name: first,
        last_name: carriedLast,
        middle_name: normalizeMiddleName(rawMiddle),
      };
    }
  }

  let tokens = s.split(/\s*,\s*/);
  let last = null,
    first = null,
    middle = null;

  if (tokens.length > 1) {
    // Format: LAST, FIRST MIDDLE
    last = clean(tokens[0]);
    const rest = clean(tokens.slice(1).join(" "));
    const restParts = rest.split(/\s+/).filter(Boolean);
    if (restParts.length >= 1) first = restParts[0];
    if (restParts.length >= 2) middle = restParts.slice(1).join(" ");
  } else {
    // Likely LAST FIRST MIDDLE
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      last = parts[0];
      first = parts[1];
      if (parts.length >= 3) middle = parts.slice(2).join(" ");
    } else if (parts.length === 1) {
      // Only one token provided; if we have a carryLastName, assume this is FIRST
      if (carriedLast) {
        first = parts[0];
        last = carriedLast;
      } else {
        return null;
      }
    }
  }

  // Strip suffixes if present in middle
  if (middle) {
    const midParts = middle.split(/\s+/).filter(Boolean);
    const filtered = midParts.filter(
      (p) =>
        !suffixes.includes(
          p
            .replace(/[^A-Za-z]/g, "")
            .toUpperCase(),
        ),
    );
    middle = filtered.join(" ") || null;
  }

  const firstFormatted = formatNamePart(first);
  const lastFormatted = formatNamePart(last);
  if (!firstFormatted || !lastFormatted) return null;

  const middleFormatted = normalizeMiddleName(middle);

  return {
    type: "person",
    first_name: firstFormatted,
    last_name: lastFormatted,
    middle_name: middleFormatted,
  };
}

// Classify a single raw owner string into person/company, or null if invalid
function classifyOwner(raw, carryLastName, isContinuation) {
  const s = clean(raw);
  if (!s) return null;
  if (companyRegex.test(s)) {
    return { type: "company", name: clean(s) };
  }
  const person = parsePersonName(s, carryLastName, isContinuation);
  if (person) return person;
  return null;
}

// Convert MM/DD/YYYY to YYYY-MM-DD
function toISODate(mdy) {
  const s = clean(mdy);
  if (!s) return "";
  const parts = s.split("/").map((x) => x.trim());
  if (parts.length !== 3) return "";
  const mm = parts[0].padStart(2, "0");
  const dd = parts[1].padStart(2, "0");
  const yyyy =
    parts[2].length === 2
      ? Number(parts[2]) < 50
        ? "20" + parts[2]
        : "19" + parts[2]
      : parts[2];
  return `${yyyy}-${mm}-${dd}`;
}

// Read and parse input
const html = fs.readFileSync(path.join(process.cwd(), "input.html"), "utf-8");
const $ = cheerio.load(html);

// Extract property ID (Parcel Control Number)
let propertyId = null;
const pcnSpan = $("#MainContent_lblPCN").first();
if (pcnSpan && pcnSpan.text()) {
  propertyId = clean(pcnSpan.text()).replace(/\D/g, "");
}
if (!propertyId) {
  $("td.label").each((i, el) => {
    const label = clean($(el).text());
    if (/parcel control number/i.test(label)) {
      const val = clean($(el).next("td.value").text());
      if (val) propertyId = val.replace(/\D/g, "");
    }
  });
}
if (!propertyId) propertyId = "unknown_id";

// Extract current owner candidates from Owner INFORMATION section
function extractCurrentOwners() {
  const owners = [];
  $("h2").each((i, el) => {
    const title = clean($(el).text());
    if (/^owner\s+information$/i.test(title)) {
      const container = $(el).closest(".has-accordion");
      const table = container.find("table").first();
      table.find("tbody > tr").each((ri, tr) => {
        const th = $(tr).find("th");
        if (th.length) return; // skip header
        const tds = $(tr).find("td");
        if (!tds.length) return;
        const ownerCell = tds.eq(0);
        const raw = clean(ownerCell.text());
        if (raw) owners.push(raw);
      });
    }
  });
  if (owners.length === 0) {
    $("td.label").each((i, el) => {
      const t = clean($(el).text());
      if (/^owner name$/i.test(t)) {
        const v = clean($(el).next("td.value").text());
        if (v) owners.push(v);
      }
    });
  }
  return owners;
}

// Extract sales history owners by date from Sales INFORMATION
function extractSalesHistory() {
  const sales = [];
  $("h2").each((i, el) => {
    const title = clean($(el).text());
    if (/^sales\s+information$/i.test(title)) {
      const container = $(el).closest(".has-accordion");
      const table = container.find("table").first();
      table.find("tbody > tr").each((ri, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 2) return;
        const dateText = clean(tds.eq(0).text());
        const ownerText = clean(tds.eq(tds.length - 1).text());
        if (dateText) {
          sales.push({ date: toISODate(dateText), ownerRaw: ownerText });
        }
      });
    }
  });
  return sales;
}

const currentOwnerRaws = extractCurrentOwners();
const sales = extractSalesHistory();

// Build owners_by_date
const ownersByDate = {};
const invalidOwners = [];

// Process sales into grouped by date
const dateMap = new Map();
sales.forEach(({ date, ownerRaw }) => {
  if (!date) return;
  const rawPieces = splitRawOwners(ownerRaw);

  const owners = [];
  let carryLast = null;
  rawPieces.forEach((piece, idx) => {
    const isCont = idx > 0;
    // For the first piece, attempt to derive carryLast using assessor format
    if (!isCont) {
      const tokens = clean(piece).split(/\s+/).filter(Boolean);
      if (tokens.length >= 1) carryLast = tokens[0];
    }

    const classified = classifyOwner(piece, carryLast, isCont);
    if (classified) {
      owners.push(classified);
      if (!isCont && classified.type === "person" && classified.last_name)
        carryLast = classified.last_name;
    } else {
      if (clean(piece))
        invalidOwners.push({ raw: piece, reason: "unclassified_owner" });
    }
  });

  if (!dateMap.has(date)) dateMap.set(date, []);
  dateMap.get(date).push(...owners);
});

// Deduplicate owners per date
function dedupOwners(list) {
  const seen = new Set();
  const out = [];
  list.forEach((o) => {
    const key = normalizeOwner(o);
    if (!key) return;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  });
  return out;
}

// Sort dates ascending and place into ownersByDate
const sortedDates = Array.from(dateMap.keys())
  .filter(Boolean)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
sortedDates.forEach((d) => {
  const list = dedupOwners(dateMap.get(d));
  if (list.length) ownersByDate[d] = list;
});

// Process current owners
const currentOwners = [];
let carryLastCurrent = null;
currentOwnerRaws.forEach((raw) => {
  const pieces = splitRawOwners(raw);
  pieces.forEach((piece, idx) => {
    const isCont = idx > 0;
    if (!isCont) {
      const tokens = clean(piece).split(/\s+/).filter(Boolean);
      if (tokens.length >= 1) carryLastCurrent = tokens[0];
    }
    const classified = classifyOwner(piece, carryLastCurrent, isCont);
    if (classified) {
      currentOwners.push(classified);
      if (!isCont && classified.type === "person" && classified.last_name)
        carryLastCurrent = classified.last_name;
    } else {
      if (clean(piece))
        invalidOwners.push({ raw: piece, reason: "unclassified_owner" });
    }
  });
});

const currentDeduped = dedupOwners(currentOwners);
ownersByDate["current"] = currentDeduped;

// Compose final JSON structure
const topKey = `property_${propertyId || "unknown_id"}`;
const result = {};
result[topKey] = { owners_by_date: ownersByDate };
result.invalid_owners = invalidOwners;

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

// Print to console
console.log(JSON.stringify(result));
