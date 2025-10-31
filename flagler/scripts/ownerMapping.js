const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
function cleanText(t) {
  return (t || "")
    .replace(/\u00A0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(s) {
  return (s || "")
    .toLowerCase()
    .replace(/(^|\s|[-'])[a-z]/g, (c) => c.toUpperCase());
}

// Extract property id
function extractPropertyId($) {
  let id = null;
  // Scan two-column summary tables for a label matching Prop/Property ID
  $("table.tabular-data-two-column tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = cleanText($(tds[0]).text());
      const value = cleanText($(tds[1]).text());
      if (/^(prop(?:erty)?\s*id|propid)$/i.test(label) && value) {
        id = value;
        return false;
      }
    }
  });
  // Fallback: look for common patterns anywhere
  if (!id) {
    const allText = $("body").text();
    const m = allText.match(
      /(?:Prop(?:erty)?\s*ID\s*[:#]?\s*)([A-Za-z0-9\-]+)/i,
    );
    if (m) id = cleanText(m[1]);
  }
  if (!id) id = "unknown_id";
  return id;
}

// Extract the Owner Information section module-content element
function findOwnerModule($) {
  let ownerSection = null;
  $("section").each((i, sec) => {
    const title = cleanText($(sec).find("> header .title").first().text());
    if (/^owner\s*information$/i.test(title)) {
      ownerSection = sec;
      return false;
    }
  });
  return ownerSection ? $(ownerSection).find(".module-content").first() : null;
}

function linesFromHtmlFragment($frag) {
  let html = $frag.html() || "";
  html = html.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  const $tmp = cheerio.load("<div>" + html + "</div>");
  const raw = $tmp("div").text();
  return raw
    .split("\n")
    .map((s) => cleanText(s))
    .filter(Boolean);
}

// Heuristics to decide if a line is a likely person/company name (not address)
function isLikelyNameLine(line) {
  if (!line) return false;
  const t = line.trim();
  if (!/[A-Za-z]/.test(t)) return false;
  // Must have at least two words/tokens
  const tokenCount = t.split(/\s+/).filter(Boolean).length;
  if (tokenCount < 2) return false;
  // Exclude lines with many digits or typical address markers
  if (/(\d{2,}|#\d+)/.test(t)) return false;
  if (
    /(Ave|Ave\.|St|St\.|Rd|Rd\.|Blvd|Blvd\.|Ln|Lane|Dr|Drive|Ct|Court|FL|USA|United States|Zip)/i.test(
      t,
    )
  )
    return false;
  if (/^Primary\s*Owner$/i.test(t)) return false;
  return true;
}

function extractCurrentOwnerCandidates($) {
  const mod = findOwnerModule($);
  let candidates = [];
  if (mod) {
    const lines = linesFromHtmlFragment(mod);
    candidates = lines.filter(isLikelyNameLine);
  } else {
    // Fallback: look for elements with ids hinting to primary owner
    $('[id*="PrimaryOwner" i],[id*="OwnerName" i]').each((i, el) => {
      const t = cleanText($(el).text());
      if (isLikelyNameLine(t)) candidates.push(t);
    });
  }
  // Remove obvious duplicates
  const seen = new Set();
  candidates = candidates.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return candidates;
}

// Historical owners from Sales table (Grantor column)
function extractSalesGrantorsByDate($) {
  const result = [];
  // Find the sales table by header title 'Sales'
  let tbl = null;
  $("section").each((i, sec) => {
    const title = cleanText($(sec).find("> header .title").first().text());
    if (/^sales$/i.test(title)) {
      tbl = $(sec).find("table").first();
      return false;
    }
  });
  if (!tbl || tbl.length === 0) return result;

  // Map header indices
  const headers = [];
  tbl
    .find("thead tr")
    .first()
    .children()
    .each((i, cell) => {
      headers.push(cleanText($(cell).text()));
    });
  const grantorIdx = headers.findIndex((h) => /^grantor$/i.test(h));
  const dateIdx = headers.findIndex((h) => /sale\s*date/i.test(h));

  if (grantorIdx === -1 || dateIdx === -1) return result;

  tbl.find("tbody tr").each((i, tr) => {
    const arr = [];
    $(tr)
      .children("th,td")
      .each((j, c) => arr.push(c));
    const dateCell = arr[dateIdx];
    const grantorCell = arr[grantorIdx];
    const dateText = cleanText($(dateCell).text());
    const grantorText = cleanText($(grantorCell).text());
    if (dateText && grantorText) {
      result.push({ date: dateText, grantor: grantorText });
    }
  });
  return result;
}

const COMPANY_KEYWORDS = [
  "llc",
  "inc",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "services",
  "trust",
  "tr",
  "company",
  "associates",
  "holdings",
  "properties",
  "investments",
  "bank",
  "n.a",
  "na",
  "lp",
  "llp",
  "pc",
  "pllc",
  "pa",
  "partners",
  "enterprise",
  "enterprises",
  "group",
  "construction",
];

const IGNORE_TOKENS = new Set([
  "&",
  "and",
  "h&w",
  "h/w",
  "et",
  "al",
  "etal",
  "et al",
  "etux",
  "et ux",
  "etvir",
  "et vir",
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
]);

function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((k) =>
    new RegExp(`(^|[^a-z])${k}($|[^a-z])`).test(n),
  );
}

function cleanOwnerRawName(s) {
  let t = (s || "")
    .replace(/^\*/, "")
    .replace(/\*/g, "")
    // Remove explicit H&W and H/W markers
    .replace(/\bH\s*&\s*W\b/gi, "")
    .replace(/\bH\s*\/\s*W\b/gi, "")
    .replace(/\s*&\s*/g, " ")
    .replace(/[,.;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Remove trailing connectors like '&' if any remain
  t = t.replace(/\s*&+\s*$/, "").trim();
  return t;
}

function tokenizeName(t) {
  const raw = t
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  // Remove known ignore tokens and symbols
  const tokens = raw.filter((tok) => !IGNORE_TOKENS.has(tok.toLowerCase()));
  return tokens;
}

function classifyOwner(raw) {
  const cleaned = cleanOwnerRawName(raw);
  if (!cleaned) return { invalid: { raw, reason: "empty" } };

  // Exclusion phrases
  if (
    /unknown\s*seller/i.test(cleaned) ||
    /^conversion$/i.test(cleaned) ||
    /^unknown$/i.test(cleaned)
  ) {
    return { invalid: { raw, reason: "ambiguous or non-owner label" } };
  }

  if (isCompanyName(cleaned)) {
    return { owner: { type: "company", name: cleaned } };
  }

  const tokens = tokenizeName(cleaned);
  if (tokens.length < 2) {
    return { invalid: { raw, reason: "insufficient tokens for person" } };
  }

  const last = toTitleCase(tokens[0]);
  const first = toTitleCase(tokens[1]);
  const middleTokens = tokens.slice(2);
  const middle = middleTokens.length
    ? toTitleCase(middleTokens.join(" "))
    : null;
  return {
    owner: {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
    },
  };
}

function ownerKeyForDedup(o) {
  if (!o) return "";
  if (o.type === "company")
    return "company:" + (o.name || "").toLowerCase().trim();
  return (
    "person:" +
    [o.first_name, o.middle_name || "", o.last_name]
      .map((x) => (x || "").toLowerCase().trim())
      .join("|")
  );
}

function dedupeOwners(arr) {
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const k = ownerKeyForDedup(o);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

function toISODate(mdY) {
  // Expect M/D/YYYY or MM/DD/YYYY
  const m = mdY.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Build current owners
const currentOwnerStrings = extractCurrentOwnerCandidates($);
const currentOwners = [];
const invalidOwners = [];
for (const s of currentOwnerStrings) {
  const res = classifyOwner(s);
  if (res.owner) currentOwners.push(res.owner);
  else invalidOwners.push(res.invalid);
}

// Build historical owners from sales grantors
const grantors = extractSalesGrantorsByDate($);
const ownersByDateMap = new Map(); // dateKey -> array of owners
for (const { date, grantor } of grantors) {
  const iso = toISODate(date);
  const dateKey = iso || null;
  const res = classifyOwner(grantor);
  if (res.owner) {
    const key = dateKey || `unknown_date_${ownersByDateMap.size + 1}`;
    if (!ownersByDateMap.has(key)) ownersByDateMap.set(key, []);
    ownersByDateMap.get(key).push(res.owner);
  } else {
    invalidOwners.push(res.invalid);
  }
}

// Dedupe owners per date key
for (const [k, list] of ownersByDateMap.entries()) {
  ownersByDateMap.set(k, dedupeOwners(list));
}

// Sort date keys chronologically; put unknown_date_* after dated keys; 'current' last
const datedKeys = Array.from(ownersByDateMap.keys())
  .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  .sort((a, b) => a.localeCompare(b));
const unknownKeys = Array.from(ownersByDateMap.keys())
  .filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k))
  .sort();

const owners_by_date = {};
for (const k of datedKeys) owners_by_date[k] = ownersByDateMap.get(k);
for (const k of unknownKeys) owners_by_date[k] = ownersByDateMap.get(k);
owners_by_date["current"] = dedupeOwners(currentOwners);

const propertyId = extractPropertyId($);
const propertyKey = `property_${propertyId}`;
const output = {};
output[propertyKey] = {
  owners_by_date,
  invalid_owners: invalidOwners,
};

// Ensure output dir and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print to stdout
process.stdout.write(JSON.stringify(output, null, 2));
