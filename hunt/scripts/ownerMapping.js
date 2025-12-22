const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helpers
const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const isAllCaps = (s) => !!s && s === s.toUpperCase();

const companyKeywords = [
  // Corporations & Business Entities
  "inc",
  "incorporated",
  "llc",
  "l.l.c",
  "llp",
  "l.l.p",
  "lllp",
  "pllc",
  "pc",
  "p.c",
  "pa",
  "p.a",
  "corp",
  "corporation",
  "ltd",
  "limited",
  "co",
  "company",
  "enterprises",
  "enterprise",
  "industries",
  "industry",
  "international",
  "services",
  "solutions",
  "consulting",
  "consultants",
  "management",
  "group",
  "groups",
  "partners",
  "partnership",
  "holdings",
  "ventures",
  "investments",
  "lp",
  "l.p",
  "professional",

  // Trusts & Estates
  "trust",
  "tr",
  "trustee",
  "trustees",
  "estate",
  "revocable",
  "irrevocable",

  // Real Estate
  "properties",
  "property",
  "realty",
  "real estate",
  "development",
  "developers",
  "land",

  // Financial Institutions
  "bank",
  "credit union",
  "savings",
  "loan",
  "mortgage",
  "financial",
  "finance",

  // Non-Profits & Foundations
  "foundation",
  "association",
  "assn",
  "society",
  "organization",
  "org",
  "charity",
  "charitable",
  "fund",
  "endowment",
  "council",
  "institute",

  // Religious Organizations
  "church",
  "chapel",
  "ministry",
  "ministries",
  "cathedral",
  "synagogue",
  "mosque",
  "temple",
  "parish",
  "diocese",
  "archdiocese",

  // Educational Institutions
  "school",
  "university",
  "college",
  "academy",
  "education",
  "educational",

  // Government & Public Entities
  "city",
  "county",
  "state",
  "federal",
  "government",
  "govt",
  "municipal",
  "municipality",
  "township",
  "village",
  "district",
  "authority",
  "commission",
  "board",
  "agency",
  "public",
  "dept",
  "department",

  // Healthcare
  "hospital",
  "clinic",
  "medical",
  "health",
  "healthcare",
  "wellness",

  // Utilities
  "utility",
  "utilities",
  "water",
  "electric",
  "power",
  "gas",
  "energy",
  "sewer",
  "telephone",
  "cable",

  // Transportation
  "railroad",
  "railway",
  "airport",
  "port",
  "transportation",
  "transit",

  // Cooperatives & Unions
  "cooperative",
  "coop",
  "co-op",
  "union",
  "labor",

  // Clubs & Associations
  "club",
  "lodge",
  "league",
  "fraternal",

  // Others
  "center",
  "centre",
  "network",
  "systems",
  "technologies",
  "tech",
  "alliance",
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

function titleCaseName(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed === '') return null;

  // Remove special separator characters (hyphens, slashes, pipes, plus signs) that might be used to separate multiple people
  // Keep legitimate name characters like apostrophes (O'Brien) and spaces
  const cleaned = trimmed.replace(/[-\/\|+]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned === '') return null;

  // Convert to title case: First letter uppercase, rest lowercase
  // Pattern for first/last names: ^[A-Z][a-z]*([ ',][A-Za-z][a-z]*)*$
  const titleCased = cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  // Validate against the required pattern (no hyphens, slashes, pipes, or plus signs allowed)
  if (!/^[A-Z][a-z]*([ ',][A-Za-z][a-z]*)*$/.test(titleCased)) {
    return null;
  }

  return titleCased;
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
        first_name: titleCaseName(first),
        last_name: titleCaseName(normSpace(last)),
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
        first_name: titleCaseName(first),
        last_name: titleCaseName(last),
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
      first_name: titleCaseName(first),
      last_name: titleCaseName(last),
      middle_name: middle,
    },
  };
}

function parseSpecialSeparatorPersons(raw, separator) {
  // Split on the separator into parts
  const separatorRegex = new RegExp(`\\s*${separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`);
  const parts = raw
    .split(separatorRegex)
    .map((s) => normSpace(s))
    .filter(Boolean);
  if (parts.length < 2) return [];

  // Similar logic to parseAmpersandPersons
  const isUpper = isAllCaps(raw.replace(separatorRegex, " ").trim());
  const p1Tokens = splitTokens(parts[0]);
  const p2Tokens = splitTokens(parts[1]);

  // Heuristic 1: UPPERCASE CAD style - shared last name
  if (
    isUpper &&
    p1Tokens.length >= 2 &&
    p2Tokens.length >= 1 &&
    !(/,/.test(parts[0]) || /,/.test(parts[1]))
  ) {
    const sharedLast = p1Tokens[0];
    const first1 = p1Tokens[1];
    const middle1Str = p1Tokens.slice(2).join(" ").trim();
    const middle1Raw = sanitizeMiddleName(middle1Str);
    const middle1 = middle1Raw ? titleCaseName(middle1Raw) : null;
    const first2 = p2Tokens[0];
    const middle2Str = p2Tokens.slice(1).join(" ").trim();
    const middle2Raw = sanitizeMiddleName(middle2Str);
    const middle2 = middle2Raw ? titleCaseName(middle2Raw) : null;
    const owners = [];
    if (first1)
      owners.push({
        type: "person",
        first_name: titleCaseName(first1),
        last_name: titleCaseName(sharedLast),
        middle_name: middle1,
      });
    if (first2)
      owners.push({
        type: "person",
        first_name: titleCaseName(first2),
        last_name: titleCaseName(sharedLast),
        middle_name: middle2,
      });
    return owners;
  }

  // Heuristic 2: Each part looks like its own full name
  const owners = [];
  parts.forEach((part) => {
    const parsed = parsePersonSingle(part);
    if (parsed.valid) {
      const middleRaw = sanitizeMiddleName(parsed.owner.middle_name);
      parsed.owner.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
      owners.push(parsed.owner);
    }
  });
  return owners;
}

function parseHyphenatedFirstNames(raw) {
  // Handle pattern like "allison-scott goldie j" => two persons: "allison j goldie" and "scott j goldie"
  // Only split when it's clearly two people, not a single hyphenated first name like "Mary-Anne"
  const normalized = normSpace(raw);
  const tokens = splitTokens(normalized);

  // Check if first token contains a hyphen
  if (tokens.length < 2 || !tokens[0].includes("-")) return [];

  const hyphenatedFirst = tokens[0];
  const firstNames = hyphenatedFirst.split("-").map(n => normSpace(n)).filter(Boolean);

  // Need at least 2 first names and a last name
  if (firstNames.length < 2) return [];

  // Only split if there's strong evidence this is two people, not one person with a hyphenated name
  // Heuristics:
  // 1. Must have a middle name/initial (e.g., "allison-scott goldie j")
  //    This suggests two people sharing the same last name and middle initial
  // 2. OR the entire name is lowercase (common CAD format for multiple persons)
  const hasMiddleNameOrInitial = tokens.length >= 3;
  const isAllLowercase = normalized === normalized.toLowerCase();

  if (!hasMiddleNameOrInitial && !isAllLowercase) {
    // Likely a single person with hyphenated first name like "Mary-Anne Smith"
    return [];
  }

  // Determine last name and middle name/initial
  // Pattern: firstname1-firstname2 lastname [middle/initial]
  const lastName = tokens[1];
  const middleStr = tokens.slice(2).join(" ").trim();
  const middle = sanitizeMiddleName(middleStr);

  // Create one person for each hyphenated first name
  const owners = [];
  firstNames.forEach((firstName) => {
    if (firstName) {
      owners.push({
        type: "person",
        first_name: titleCaseName(firstName),
        last_name: titleCaseName(lastName),
        middle_name: middle,
      });
    }
  });

  return owners;
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
    const first1 = p1Tokens[1];
    const middle1Str = p1Tokens.slice(2).join(" ").trim();
    const middle1Raw = sanitizeMiddleName(middle1Str);
    const middle1 = middle1Raw ? titleCaseName(middle1Raw) : null;
    const first2 = p2Tokens[0];
    const middle2Str = p2Tokens.slice(1).join(" ").trim();
    const middle2Raw = sanitizeMiddleName(middle2Str);
    const middle2 = middle2Raw ? titleCaseName(middle2Raw) : null;
    const owners = [];
    if (first1)
      owners.push({
        type: "person",
        first_name: titleCaseName(first1),
        last_name: titleCaseName(sharedLast),
        middle_name: middle1,
      });
    if (first2)
      owners.push({
        type: "person",
        first_name: titleCaseName(first2),
        last_name: titleCaseName(sharedLast),
        middle_name: middle2,
      });
    return owners;
  }

  // Heuristic 2: Each part looks like its own full name; parse each separately using single-person logic
  const owners = [];
  parts.forEach((part) => {
    const parsed = parsePersonSingle(part);
    if (parsed.valid) {
      // Ensure middle_name is sanitized and title-cased
      const middleRaw = sanitizeMiddleName(parsed.owner.middle_name);
      parsed.owner.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
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

  // Special handling for hyphenated names with spaces around hyphen
  // Pattern: "FIRSTNAME1 - FIRSTNAME2 LASTNAME MIDDLE" (e.g., "ALLISON - SCOTT GOLDIE J")
  // This should be normalized to "FIRSTNAME1-FIRSTNAME2 LASTNAME MIDDLE" for hyphenated name parsing
  // Only do this if the pattern looks like two first names sharing a last name (3+ tokens with hyphen in middle)
  if (/\s+-\s+/.test(s)) {
    const tokens = s.split(/\s+/);
    // Check if hyphen is early in the token list (position 1 or 2) and there are more tokens after
    // This suggests: "FIRST1 - FIRST2 LAST [MIDDLE]" pattern
    const hyphenIndex = tokens.indexOf('-');
    if (hyphenIndex >= 1 && hyphenIndex <= 2 && tokens.length >= 4) {
      // Normalize by removing spaces around the hyphen between the first two names
      // "ALLISON - SCOTT GOLDIE J" -> "ALLISON-SCOTT GOLDIE J"
      const normalized = s.replace(/\s+-\s+/, '-');
      const result = classifyAndSplit(normalized);
      if (result.owners.length > 0) {
        return result;
      }
      // If normalization didn't help, continue with original processing
    }
  }

  // Check for special character separators (other than &)
  // Patterns: " - ", " / ", " + ", " | "
  const specialSeparators = [
    { regex: /\s+-\s+/, char: '-' },
    { regex: /\s+\/\s+/, char: '/' },
    { regex: /\s+\+\s+/, char: '+' },
    { regex: /\s+\|\s+/, char: '|' }
  ];

  for (const sep of specialSeparators) {
    if (sep.regex.test(s)) {
      const people = parseSpecialSeparatorPersons(s, sep.char);
      if (people.length > 0) {
        people.forEach((p) => {
          const middleRaw = sanitizeMiddleName(p.middle_name);
          p.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
        });
        return { owners: people, invalids: [] };
      }
      // If parsing failed, clean the separator and treat as single person
      const cleaned = s.replace(sep.regex, " ").replace(/\s{2,}/g, " ").trim();
      const parsed = parsePersonSingle(cleaned);
      if (parsed.valid) {
        const o = parsed.owner;
        const middleRaw = sanitizeMiddleName(o.middle_name);
        o.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
        return { owners: [o], invalids: [] };
      }
      // If still can't parse, continue to next checks
      break;
    }
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
      const middleRaw = sanitizeMiddleName(p.middle_name);
      p.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
    });
    return { owners: people, invalids: [] };
  }

  // Check for hyphenated first names (e.g., "allison-scott goldie j")
  const tokens = splitTokens(s);
  if (tokens.length >= 2 && tokens[0].includes("-")) {
    const people = parseHyphenatedFirstNames(s);
    if (people.length >= 2) {
      people.forEach((p) => {
        const middleRaw = sanitizeMiddleName(p.middle_name);
        p.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
      });
      return { owners: people, invalids: [] };
    }
  }

  // Single person
  const parsed = parsePersonSingle(s);
  if (parsed.valid) {
    const o = parsed.owner;
    const middleRaw = sanitizeMiddleName(o.middle_name);
    o.middle_name = middleRaw ? titleCaseName(middleRaw) : null;
    return { owners: [o], invalids: [] };
  }

  // Fallback invalid
  return {
    owners: [],
    invalids: [{ raw: s, reason: parsed.reason || "unclassified" }],
  };
}

function parsePersonsFromString(raw) {
  const { owners } = classifyAndSplit(raw);
  return owners
    .filter((owner) => owner.type === "person")
    .map((owner) => ({
      first_name: owner.first_name || null,
      last_name: owner.last_name || null,
      middle_name: owner.middle_name || null,
      prefix_name: owner.prefix_name || null,
      suffix_name: owner.suffix_name || null,
      birth_date: null,
      us_citizenship_status: null,
      veteran_status: null,
    }));
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
function extractPropertyId($) {
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
function extractCurrentOwnerCandidates($) {
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
function extractDeedHistory($) {
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

function run() {
  const html = fs.readFileSync(path.resolve("input.html"), "utf8");
  const $ = cheerio.load(html);

  const propertyId = extractPropertyId($);
  const currentOwnerStrings = extractCurrentOwnerCandidates($);
  const deedMap = extractDeedHistory($);

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

  let currentOwners = dedupeOwners(classifyMany(currentOwnerStrings));

  const dateKeys = Object.keys(deedMap).filter(Boolean).sort();
  const ownersByDateOrdered = {};
  for (const d of dateKeys) {
    const owners = dedupeOwners(classifyMany(deedMap[d]));
    if (owners.length) ownersByDateOrdered[d] = owners;
  }

  ownersByDateOrdered["current"] = currentOwners;

  const output = {};
  output[`property_${propertyId}`] = { owners_by_date: ownersByDateOrdered };
  output["invalid_owners"] = invalidOwners;

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "owner_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log(JSON.stringify(output, null, 2));
  return output;
}

const parserExports = {
  normSpace,
  isAllCaps,
  sanitizeMiddleName,
  titleCaseName,
  splitTokens,
  parsePersonSingle,
  parseSpecialSeparatorPersons,
  parseHyphenatedFirstNames,
  parseAmpersandPersons,
  classifyAndSplit,
  looksLikeCompany,
  parsePersonsFromString,
};

module.exports = parserExports;

if (require.main === module) {
  run();
}
