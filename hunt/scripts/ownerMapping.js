const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read input HTML
const html = fs.readFileSync(path.resolve("input.html"), "utf8");
const $ = cheerio.load(html);

// Helpers
const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const isAllCaps = (s) => !!s && s === s.toUpperCase();

const companyKeywords = [
  "inc",
  "llc",
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
  "partners",
  "holdings",
  "lp",
  "pllc",
  "pc",
  "bank",
  "association",
  "assn",
  "church",
  "group",
  "university",
  "school",
  "authority",
  "dept",
  "department",
  "ministries",
];
const companyRe = new RegExp(
  `(^|[^a-zA-Z])(${companyKeywords.join("|")})([^a-zA-Z]|$)`,
  "i",
);

function toISODate(mdyyyy) {
  const s = normSpace(mdyyyy);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function sanitizeMiddleName(middle) {
  if (!middle || typeof middle !== 'string') return null;
  const trimmed = middle.trim();
  if (trimmed === '') return null;

  // Remove parenthetical content like "(deceased)", "(trustee)", etc.
  const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
  if (withoutParens === '') return null;

  // Ensure middle name starts with uppercase letter and contains only valid characters
  // Pattern: ^[A-Z][a-zA-Z\s\-',.]*$
  if (!/^[A-Z][a-zA-Z\s\-',.]*$/.test(withoutParens)) {
    // Try to fix it by capitalizing first letter if it's lowercase
    if (/^[a-z]/.test(withoutParens)) {
      const fixed = withoutParens.charAt(0).toUpperCase() + withoutParens.slice(1);
      if (/^[A-Z][a-zA-Z\s\-',.]*$/.test(fixed)) {
        return fixed;
      }
    }
    // If it contains invalid characters or can't be fixed, return null
    return null;
  }

  return withoutParens;
}

function normalizePersonKey(p) {
  const parts = [p.last_name || "", p.first_name || "", p.middle_name || ""]
    .map((x) => normSpace(x).toLowerCase())
    .filter(Boolean);
  return `person:${parts.join("|")}`;
}

function normalizeCompanyKey(c) {
  return `company:${normSpace(c.name).toLowerCase()}`;
}

function looksLikeCompany(name) {
  return companyRe.test(name);
}

function splitTokens(raw) {
  return normSpace(raw).split(/\s+/).filter(Boolean);
}

function parsePersonSingle(raw) {
  const name = normSpace(raw).replace(/\.+/g, ".");
  if (!name) return { valid: false, reason: "empty" };

  // Handle comma style: LAST, FIRST MIDDLE
  if (name.includes(",")) {
    const [last, rest] = name.split(",");
    const tokens = splitTokens(rest || "");
    if (!normSpace(last) || tokens.length === 0)
      return { valid: false, reason: "insufficient tokens after comma" };
    const first = tokens[0];
    const middleStr = tokens.slice(1).join(" ").trim();
    const middle = sanitizeMiddleName(middleStr);
    return {
      valid: true,
      owner: {
        type: "person",
        first_name: first || null,
        last_name: normSpace(last) || null,
        middle_name: middle,
      },
    };
  }

  const tokens = splitTokens(name);
  if (tokens.length === 1) {
    // Single token is ambiguous for a person
    return { valid: false, reason: "single token ambiguous" };
  }

  if (isAllCaps(name)) {
    // CAD-style: LAST FIRST [MIDDLE...]
    const last = tokens[0];
    const first = tokens[1];
    const middleStr = tokens.slice(2).join(" ").trim();
    const middle = sanitizeMiddleName(middleStr);
    return {
      valid: true,
      owner: {
        type: "person",
        first_name: first || null,
        last_name: last || null,
        middle_name: middle,
      },
    };
  }

  // Default: FIRST [MIDDLE] LAST
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middleStr = tokens.slice(1, -1).join(" ").trim();
  const middle = sanitizeMiddleName(middleStr);
  return {
    valid: true,
    owner: {
      type: "person",
      first_name: first || null,
      last_name: last || null,
      middle_name: middle,
    },
  };
}

function parseAmpersandPersons(raw) {
  // Split on & into parts
  const parts = raw
    .split("&")
    .map((s) => normSpace(s))
    .filter(Boolean);
  if (parts.length < 2) return [];

  // Heuristic 1: UPPERCASE CAD style like "HUNTER LONDA & TED" => last name is first token of first part
  const isUpper = isAllCaps(raw.replace(/&/g, " ").trim());
  const p1Tokens = splitTokens(parts[0]);
  const p2Tokens = splitTokens(parts[1]);

  if (
    isUpper &&
    p1Tokens.length >= 2 &&
    p2Tokens.length >= 1 &&
    !(/,/.test(parts[0]) || /,/.test(parts[1]))
  ) {
    const sharedLast = p1Tokens[0];
    const first1 = p1Tokens.slice(1).join(" ");
    const first2 = p2Tokens.join(" ");
    const owners = [];
    if (first1)
      owners.push({
        type: "person",
        first_name: first1 || null,
        last_name: sharedLast || null,
        middle_name: null,
      });
    if (first2)
      owners.push({
        type: "person",
        first_name: first2 || null,
        last_name: sharedLast || null,
        middle_name: null,
      });
    return owners;
  }

  // Heuristic 2: Each part looks like its own full name; parse each separately using single-person logic
  const owners = [];
  parts.forEach((part) => {
    const parsed = parsePersonSingle(part);
    if (parsed.valid) {
      // Ensure middle_name is sanitized
      parsed.owner.middle_name = sanitizeMiddleName(parsed.owner.middle_name);
      owners.push(parsed.owner);
    }
  });
  return owners;
}

function classifyAndSplit(raw) {
  const s = normSpace(raw)
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s{2,}/g, " ");
  if (!s) return { owners: [], invalids: [{ raw, reason: "empty" }] };

  // Filter out obvious labels
  if (/^owner:?$/i.test(s)) return { owners: [], invalids: [] };

  // Company detection first
  if (looksLikeCompany(s)) {
    return { owners: [{ type: "company", name: s }], invalids: [] };
  }

  // Contains ampersand => multiple persons
  if (s.includes("&")) {
    const people = parseAmpersandPersons(s);
    if (people.length === 0)
      return {
        owners: [],
        invalids: [{ raw: s, reason: "could not parse ampersand persons" }],
      };
    people.forEach((p) => {
      p.middle_name = sanitizeMiddleName(p.middle_name);
    });
    return { owners: people, invalids: [] };
  }

  // Single person
  const parsed = parsePersonSingle(s);
  if (parsed.valid) {
    const o = parsed.owner;
    o.middle_name = sanitizeMiddleName(o.middle_name);
    return { owners: [o], invalids: [] };
  }

  // Fallback invalid
  return {
    owners: [],
    invalids: [{ raw: s, reason: parsed.reason || "unclassified" }],
  };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let key;
    if (o.type === "company") key = normalizeCompanyKey(o);
    else key = normalizePersonKey(o);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

// Extract Property ID
function extractPropertyId() {
  let id = null;
  const row = $("tr").filter((i, el) =>
    /Property\s*ID/i.test($(el).find("th").first().text()),
  );
  if (row.length) {
    const td = row.first().find("td").first().text();
    if (td) id = normSpace(td);
  }
  if (!id) {
    const bodyText = $("body").text();
    const m = bodyText.match(/Property\s*ID:\s*(\w+)/i);
    if (m) id = m[1];
  }
  return id || "unknown_id";
}

// Extract current owner candidates from labeled fields
function extractCurrentOwnerCandidates() {
  const candidates = [];

  // Owner section: row where th contains 'Name'
  $("tr").each((i, el) => {
    const th = $(el).find("th").first();
    if (/^\s*Name\s*:*/i.test(th.text())) {
      const tdText = normSpace($(el).find("td").first().text());
      if (tdText) candidates.push(tdText);
    }
  });

  // Any strong exactly 'Owner:' then take parent text without the strong label
  $("strong").each((i, el) => {
    const label = normSpace($(el).text());
    if (/^Owner:?$/i.test(label)) {
      const parent = $(el).parent();
      const text = normSpace(parent.clone().children("strong").remove().text());
      if (text) candidates.push(text);
    }
  });

  const unique = Array.from(new Set(candidates.map(normSpace)));
  return unique.filter((c) => !!c && !/^owner:?$/i.test(c));
}

// Extract deed history: map of date => array of raw grantee names
function extractDeedHistory() {
  const map = {};
  const deedTables = $("table").filter((i, el) => {
    const headers = $(el)
      .find("th")
      .map((j, h) => normSpace($(h).text()).toLowerCase())
      .get();
    return headers.includes("deed date") && headers.includes("grantee");
  });

  deedTables.each((i, tbl) => {
    $(tbl)
      .find("tr")
      .slice(1)
      .each((ri, row) => {
        const tds = $(row).find("td");
        if (tds.length === 0) return;
        const dateText = normSpace($(tds[0]).text());
        const iso = toISODate(dateText);
        if (!iso) return;
        const granteeText = normSpace($(tds[4]).text());
        if (!granteeText) return;
        if (!map[iso]) map[iso] = [];
        map[iso].push(granteeText);
      });
  });

  return map;
}

// Build owners_by_date
const propertyId = extractPropertyId();
const currentOwnerStrings = extractCurrentOwnerCandidates();
const deedMap = extractDeedHistory();

const invalidOwners = [];

function classifyMany(rawArr) {
  const owners = [];
  rawArr.forEach((raw) => {
    const { owners: os, invalids } = classifyAndSplit(raw);
    if (invalids && invalids.length) invalidOwners.push(...invalids);
    if (os && os.length) owners.push(...os);
  });
  return owners;
}

// Current owners
let currentOwners = dedupeOwners(classifyMany(currentOwnerStrings));

// Historical owners grouped by date (grantees only), chronological
const dateKeys = Object.keys(deedMap).filter(Boolean).sort();
const ownersByDateOrdered = {};
for (const d of dateKeys) {
  const owners = dedupeOwners(classifyMany(deedMap[d]));
  if (owners.length) ownersByDateOrdered[d] = owners;
}

// Always end with current
ownersByDateOrdered["current"] = currentOwners;

const output = {};
output[`property_${propertyId}`] = { owners_by_date: ownersByDateOrdered };
output["invalid_owners"] = invalidOwners;

// Ensure output directory and write file
const outDir = path.resolve("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON
console.log(JSON.stringify(output, null, 2));
