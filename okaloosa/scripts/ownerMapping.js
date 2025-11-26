const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const INPUT_PATH = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(INPUT_PATH, "utf8");
const $ = cheerio.load(html);

function getText(el) {
  return $(el).text().replace(/\s+/g, " ").trim();
}

function stripParens(str) {
  return (str || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyAddress(str) {
  const s = str.toUpperCase();
  if (
    /\d{3,}/.test(s) &&
    /(RD|ST|AVE|AV|AVE\.|DR|LN|BLVD|HWY|PKWY|PL|CT|CIR|WAY|TRL)\b/.test(s)
  )
    return true;
  if (
    /\b(AK|AL|AR|AZ|CA|CO|CT|DC|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV)\b/.test(
      s,
    )
  )
    return true;
  if (/\bFL\b\s*\d{5}(?:-\d{4})?\b/.test(s)) return true;
  return false;
}

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
  " tr ",
  " tr$",
  "tr ",
  "association",
  "assn",
  "partners",
  "lp",
  "llp",
  "pllc",
  "plc",
  "company",
];

function isCompanyName(name) {
  if (!name) return false;
  const s = ` ${name.toLowerCase()} `;
  return COMPANY_KEYWORDS.some((k) => s.includes(k));
}

const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

function normalizeSpaces(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

function toProperToken(word) {
  return word
    .toLowerCase()
    .split("-")
    .map((part) =>
      part
        .split("'")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join("'"),
    )
    .join("-");
}

function properCaseFull(str) {
  return (str || "").split(/\s+/).map(toProperToken).join(" ").trim();
}

function removeSuffix(tokens) {
  if (!tokens || !tokens.length) return { tokens, suffix: null };
  const last = tokens[tokens.length - 1].toUpperCase().replace(/\./g, "");
  if (SUFFIXES.has(last)) {
    return { tokens: tokens.slice(0, -1), suffix: last };
  }
  return { tokens, suffix: null };
}

function parsePerson_LastFirst(raw) {
  const original = raw;
  let cleaned = stripParens(raw);
  cleaned = normalizeSpaces(cleaned);
  if (!cleaned)
    return { invalid: { raw: original, reason: "empty_after_clean" } };

  // If comma format: Last, First Middle
  if (/,/.test(cleaned)) {
    const [lastPart, rest] = cleaned
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lastPart || !rest)
      return { invalid: { raw: original, reason: "comma_format_incomplete" } };
    const nameTokens = rest.split(/\s+/).filter(Boolean);
    if (!nameTokens.length)
      return { invalid: { raw: original, reason: "no_first_name" } };
    const first = nameTokens[0];
    const middle = nameTokens.slice(1).join(" ") || null;
    const last = lastPart;
    return {
      owner: {
        type: "person",
        first_name: properCaseFull(first),
        last_name: properCaseFull(last),
        middle_name: middle ? properCaseFull(middle) : null,
      },
    };
  }

  let tokens = cleaned.split(/\s+/).filter(Boolean);
  const rem = removeSuffix(tokens);
  tokens = rem.tokens;
  if (tokens.length < 2)
    return {
      invalid: { raw: original, reason: "insufficient_tokens_last_first" },
    };
  const last = tokens[0];
  const first = tokens[1];
  const middle = tokens.slice(2).join(" ") || null;
  return {
    owner: {
      type: "person",
      first_name: properCaseFull(first),
      last_name: properCaseFull(last),
      middle_name: middle ? properCaseFull(middle) : null,
    },
  };
}

function parsePerson_FirstMiddleWithContext(raw, contextLastName) {
  const original = raw;
  let cleaned = stripParens(raw);
  cleaned = normalizeSpaces(cleaned);
  if (!cleaned)
    return { invalid: { raw: original, reason: "empty_after_clean" } };
  let tokens = cleaned.split(/\s+/).filter(Boolean);
  const rem = removeSuffix(tokens);
  tokens = rem.tokens;
  if (!tokens.length)
    return { invalid: { raw: original, reason: "no_first_name" } };
  const first = tokens[0];
  const middle = tokens.slice(1).join(" ") || null;
  const last = contextLastName || null;
  if (!last)
    return { invalid: { raw: original, reason: "missing_context_last_name" } };
  return {
    owner: {
      type: "person",
      first_name: properCaseFull(first),
      last_name: properCaseFull(last),
      middle_name: middle ? properCaseFull(middle) : null,
    },
  };
}

function splitOwners(rawName) {
  const withoutParens = stripParens(rawName);
  return withoutParens
    .split(/\s*&\s*/)
    .map((p) => normalizeSpaces(p))
    .filter(Boolean);
}

function classifyAndParseOwners(rawName) {
  const results = [];
  const invalids = [];
  const parts = splitOwners(rawName);
  let contextLastName = null;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (isCompanyName(part)) {
      results.push({ type: "company", name: properCaseFull(part) });
      contextLastName = null; // reset group context on company
      continue;
    }
    let parsed;
    if (i === 0 || !contextLastName) {
      parsed = parsePerson_LastFirst(part);
    } else {
      parsed = parsePerson_FirstMiddleWithContext(part, contextLastName);
    }
    if (parsed.owner) {
      results.push(parsed.owner);
      contextLastName = parsed.owner.last_name || contextLastName;
    } else if (parsed.invalid) {
      invalids.push(parsed.invalid);
    }
  }
  return { owners: results, invalids };
}

function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return `company::${(owner.name || "").toLowerCase().trim()}`;
  const fn = (owner.first_name || "").toLowerCase().trim();
  const mn = (owner.middle_name || "").toLowerCase().trim();
  const ln = (owner.last_name || "").toLowerCase().trim();
  return `person::${fn}|${mn}|${ln}`;
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    const key = normalizeOwnerKey(o);
    if (!key || seen.has(key)) continue;
    if (o.type === "person" && (!o.middle_name || !o.middle_name.trim())) {
      o.middle_name = null;
    }
    out.push(o);
    seen.add(key);
  }
  return out;
}

function parseDateToISO(mdY) {
  if (!mdY) return null;
  const m = mdY.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function extractPropertyId($) {
  let id = null;
  $("tr").each((i, tr) => {
    const thText = getText($(tr).find("th").first());
    if (/parcel id/i.test(thText)) {
      const tdText = getText($(tr).find("td").first());
      if (tdText) {
        id = tdText;
        return false;
      }
    }
  });
  if (!id) {
    const title = $("title").text() || "";
    const m = title.match(/Report:\s*([^\s<]+)/i);
    if (m) id = m[1];
  }
  if (!id) {
    const bodyText = $("body").text();
    const m2 = bodyText.match(/\b[0-9A-Za-z]{2,}-(?:[0-9A-Za-z]{1,}-?)+\b/);
    if (m2) id = m2[0];
  }
  if (!id) id = "unknown_id";
  return id;
}

function findSectionByTitle(titleRegex) {
  let found = null;
  $("section").each((i, sec) => {
    const titleEl = $(sec).find("header .title").first();
    const txt = getText(titleEl);
    if (titleRegex.test(txt)) {
      found = $(sec);
      return false;
    }
  });
  return found;
}

function extractCurrentOwners($) {
  const currentOwners = [];
  const invalids = [];
  const section = findSectionByTitle(/owner information/i);
  if (section && section.length) {
    const nameSpans = section.find(
      'span[id*="OwnerName" i], span[id*="sprOwnerName" i], span[id*="lblSearch" i]',
    );
    const collected = new Set();
    nameSpans.each((i, el) => {
      const t = getText(el);
      if (t && !isLikelyAddress(t)) collected.add(t);
    });

    if (collected.size === 0) {
      section.find("*").each((i, el) => {
        const t = getText(el);
        if (!t) return;
        if (isLikelyAddress(t)) return;
        if (
          /[A-Z]{2,}/.test(t) &&
          /[A-Z]/.test(t) &&
          t.split(" ").length <= 6
        ) {
          collected.add(t);
        }
      });
    }

    for (const raw of collected) {
      const { owners, invalids: inv } = classifyAndParseOwners(raw);
      owners.forEach((o) => currentOwners.push(o));
      invalids.push(...inv);
    }
  }
  return { owners: dedupeOwners(currentOwners), invalids };
}

function extractSalesOwnersByDate($) {
  const byDate = {};
  const invalids = [];
  const section = findSectionByTitle(/sales/i);
  if (!section || !section.length) return { byDate, invalids };
  let table = section
    .find("table")
    .filter((i, el) => {
      const headers = $(el)
        .find("thead th, thead td")
        .map((_, th) => getText(th))
        .get();
      return headers.some((h) => /sale date/i.test(h));
    })
    .first();
  if (!table || !table.length) return { byDate, invalids };

  table.find("tbody > tr").each((i, tr) => {
    const $tr = $(tr);
    const dateText = getText($tr.find("th").first());
    const iso = parseDateToISO(dateText);
    if (!iso) return;
    const tds = $tr.find("td");
    if (!tds || tds.length < 9) return;
    const granteeText = getText(tds.eq(8));
    if (!granteeText) return;
    const { owners, invalids: inv } = classifyAndParseOwners(granteeText);
    if (owners.length) {
      if (!byDate[iso]) byDate[iso] = [];
      byDate[iso].push(...owners);
    }
    if (inv.length) invalids.push(...inv);
  });

  for (const d of Object.keys(byDate)) {
    byDate[d] = dedupeOwners(byDate[d]);
  }
  return { byDate, invalids };
}

// Main extraction
const propertyId = extractPropertyId($);
const { owners: currentOwners, invalids: invalidCurrent } =
  extractCurrentOwners($);
const { byDate: historicalByDate, invalids: invalidSales } =
  extractSalesOwnersByDate($);

const dateKeys = Object.keys(historicalByDate).filter((k) =>
  /^\d{4}-\d{2}-\d{2}$/.test(k),
);
const sortedDates = dateKeys.sort((a, b) => a.localeCompare(b));
const ownersByDate = {};
for (const d of sortedDates) {
  ownersByDate[d] = historicalByDate[d];
}
ownersByDate["current"] = dedupeOwners(currentOwners);

const invalidOwners = [...invalidCurrent, ...invalidSales].map(
  ({ raw, reason }) => ({ raw, reason }),
);

const outputKey = `property_${propertyId || "unknown_id"}`;
const output = {};
output[outputKey] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

const OUT_DIR = path.join(process.cwd(), "owners");
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_PATH = path.join(OUT_DIR, "owner_data.json");
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");

console.log(JSON.stringify(output, null, 2));
