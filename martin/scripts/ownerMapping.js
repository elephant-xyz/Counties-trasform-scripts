const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf-8");
const $ = cheerio.load(html);

// Utility: get label->value pairs by scanning <strong>Label</strong> value patterns
function extractLabeledValues($root) {
  const results = [];
  $root.find("strong").each((i, el) => {
    const label = $(el).text().trim();
    if (!label) return;
    const parent = $(el).parent();
    const clone = parent.clone();
    clone.children("strong").first().remove();
    const valueText = clone.text().replace(/\s+/g, " ").trim();
    const valueHtml = clone.html();
    results.push({ label, valueText, valueHtml });
  });
  return results;
}

// Attempt to find a property id
function getPropertyId() {
  const labeled = extractLabeledValues($("body"));
  let id = null;
  const tryLabels = [
    "Property ID",
    "property id",
    "property_id",
    "propId",
    "Parcel ID",
    "Parcel Id",
    "PIN",
    "AIN",
    "Account Number",
    "Account #",
  ];
  for (const lbl of tryLabels) {
    const item = labeled.find(
      (x) => x.label.toLowerCase() === lbl.toLowerCase(),
    );
    if (item && item.valueText) {
      id = item.valueText.split(/\s+/).join(" ").trim();
      break;
    }
  }
  if (!id) id = "unknown_id";
  return id;
}

// Normalize name text: collapse spaces and trim punctuation
function cleanName(str) {
  return (str || "")
    .replace(/[\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\/\s+/g, " / ")
    .trim();
}

// Company keyword detection
const COMPANY_KEYWORDS = [
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
  "associates",
  "association",
  "partners",
  "holdings",
  "group",
  "company",
  "bank",
  "n.a",
  "na",
  "lp",
  "llp",
  "pllc",
  "pc",
  "p.c",
  "university",
  "church",
  "ministries",
  "committee",
  "club",
  "capital",
  "management",
  "enterprises",
  "properties",
  "realty",
];
const COMPANY_REGEX = new RegExp(`\\b(${COMPANY_KEYWORDS.join("|")})\\b`, "i");

// Parse string into possibly multiple raw owner strings (split by & and common separators)
function splitRawOwners(raw) {
  const s = cleanName(raw);
  if (!s) return [];
  const parts = s
    .split(/\s*&\s*|\s+AND\s+|;|\s*\+\s*/i)
    .map((p) => cleanName(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

// Remove role/suffix tokens from a name
function stripRoleTokens(s) {
  return s
    .replace(/\b(TRUSTEE|TTEE|ET AL|ETAL|ESTATE OF|EST OF|EST)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Heuristic to detect if looks like a person
function looksLikePerson(s) {
  if (/\b(revocable|trust|agreement)\b/i.test(s)) return false;
  if (COMPANY_REGEX.test(s)) return false;
  if (s.includes(",")) return true;
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && tokens.length <= 4) return true;
  return false;
}

// Parse an individual person name into components {first_name, middle_name|null, last_name}
function parsePersonName(raw) {
  let s = stripRoleTokens(cleanName(raw));
  if (!s) return null;
  let first = null,
    middle = null,
    last = null;
  if (s.includes(",")) {
    const [lastPart, restPart] = s.split(",").map((t) => t.trim());
    last = lastPart || null;
    if (restPart) {
      const tokens = restPart.split(/\s+/).filter(Boolean);
      first = tokens.shift() || null;
      if (tokens.length) middle = tokens.join(" ");
    }
  } else {
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      last = tokens[0];
      first = tokens[1];
      if (tokens.length > 2) middle = tokens.slice(2).join(" ");
    } else {
      return null;
    }
  }
  if (!first || !last) return null;
  return {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle || null,
  };
}

// Parse an owner raw string into one or more structured owners (person/company)
function classifyOwner(raw) {
  const s = cleanName(raw);
  if (!s) return { owners: [], invalid: { raw, reason: "empty name" } };

  const parts = splitRawOwners(s);
  if (parts.length > 1) {
    const owners = [];
    const invalids = [];
    for (const p of parts) {
      const res = classifyOwner(p);
      owners.push(...res.owners);
      if (res.invalid) invalids.push(res.invalid);
    }
    return { owners, invalid: invalids.length ? invalids[0] : null };
  }

  const isCompany =
    COMPANY_REGEX.test(s) || /\b(revocable|trust|agreement)\b/i.test(s);
  if (isCompany) {
    return { owners: [{ type: "company", name: s }], invalid: null };
  }

  if (looksLikePerson(s)) {
    const person = parsePersonName(s);
    if (person) return { owners: [person], invalid: null };
  }

  return {
    owners: [],
    invalid: { raw: s, reason: "unclassifiable or ambiguous" },
  };
}

// Normalize owner key for deduplication
function ownerKey(o) {
  if (!o) return "";
  if (o.type === "company")
    return `company:${(o.name || "").toLowerCase().trim()}`;
  const fn = (o.first_name || "").toLowerCase().trim();
  const mn = (o.middle_name || "").toLowerCase().trim();
  const ln = (o.last_name || "").toLowerCase().trim();
  return `person:${fn}|${mn}|${ln}`;
}

function dedupeOwners(arr) {
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const k = ownerKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

// Extract current owners from the General Information section
function getCurrentOwners() {
  const labeled = extractLabeledValues($("body"));
  const ownersField = labeled.find((x) =>
    x.label.toLowerCase().includes("property owners"),
  );
  const collected = [];
  const invalids = [];
  if (ownersField && ownersField.valueHtml) {
    const segments = ownersField.valueHtml
      .replace(/<\/?strong[^>]*>/gi, "")
      .split(/<br\s*\/?\s*>/i)
      .map((seg) => cleanName(cheerio.load(`<div>${seg}</div>`)("div").text()))
      .filter(Boolean);

    for (const raw of segments.length
      ? segments
      : [
          cleanName(
            cheerio.load(`<div>${ownersField.valueHtml}</div>`)("div").text(),
          ),
        ]) {
      const { owners, invalid } = classifyOwner(raw);
      if (owners && owners.length) collected.push(...owners);
      if (invalid) invalids.push(invalid);
    }
  }
  return { owners: dedupeOwners(collected), invalids };
}

// Extract historical owners from Sales History table: use Grantor (Seller) as owner on that sale date
function getHistoricalOwners() {
  const results = [];
  const invalids = [];
  $("div.sale-history table, table").each((i, tbl) => {
    const headerCells = $(tbl).find("tr").first().find("th");
    if (headerCells.length >= 3) {
      const headers = headerCells
        .map((j, th) => $(th).text().trim().toLowerCase())
        .get();
      const hasSaleDate = headers.some((h) => h.includes("sale date"));
      const hasGrantor = headers.some((h) => h.includes("grantor"));
      if (hasSaleDate && hasGrantor) {
        $(tbl)
          .find("tr")
          .slice(1)
          .each((rIdx, tr) => {
            const tds = $(tr).find("td");
            if (tds.length === 0) return;
            const dateText = $(tds[0]).text().trim();
            const grantorText = $(tds[2]).text().trim();
            const dateIso = toISODate(dateText);
            const { owners, invalid } = classifyOwner(grantorText);
            const ownersClean = dedupeOwners(owners);
            let invalidLocal = invalid ? [invalid] : [];
            if (
              /^seller\s*-\s*see file for name$/i.test(cleanName(grantorText))
            ) {
              invalidLocal.push({
                raw: grantorText,
                reason: "placeholder seller name",
              });
            }
            results.push({
              date: dateIso || dateText || null,
              owners: ownersClean,
            });
            invalids.push(...invalidLocal);
          });
      }
    }
  });

  return { entries: results, invalids };
}

// Convert various date formats like M/D/YY to YYYY-MM-DD
function toISODate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mo, da, yr] = m;
  let year = parseInt(yr, 10);
  if (yr.length === 2) {
    year += year >= 50 ? 1900 : 2000;
  }
  const month = String(parseInt(mo, 10)).padStart(2, "0");
  const day = String(parseInt(da, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Build owners_by_date map sorted chronologically, plus current
function buildOwnersByDate() {
  const current = getCurrentOwners();
  return {
    owners_by_date: {
      current: current.owners,
    },
    invalid_owners: current.invalids,
  };
}

// Compose final object
const propId = getPropertyId();
const key = `property_${propId}`;
const built = buildOwnersByDate();
const result = {
  [key]: {
    owners_by_date: built.owners_by_date,
    invalid_owners: built.invalid_owners,
  },
};

// Ensure directory exists and save JSON
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

// Print result JSON only
console.log(JSON.stringify(result, null, 2));
