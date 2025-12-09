const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl08_ctl01_grdSales tbody tr";
const CURRENT_OWNER_SELECTOR = ".module-content .sdw1-owners-container";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

const PERSON_PREFIX_VALUES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];

const PERSON_SUFFIX_VALUES = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

const normalizeAffixToken = (token) =>
  (token || "").replace(/[^A-Za-z]/g, "").toUpperCase();

function buildAffixLookup(values, aliases = {}) {
  const map = new Map();
  values
    .filter(Boolean)
    .forEach((value) => {
      const norm = normalizeAffixToken(value);
      if (norm) map.set(norm, value);
    });
  Object.entries(aliases).forEach(([key, canonicalValue]) => {
    const norm = normalizeAffixToken(key);
    if (norm && canonicalValue) {
      map.set(norm, canonicalValue);
    }
  });
  return map;
}

const PREFIX_LOOKUP = buildAffixLookup(PERSON_PREFIX_VALUES, {
  CAPTAIN: "Capt.",
  CAPT: "Capt.",
  COLONEL: "Col.",
  MAJOR: "Maj.",
  LIEUTENANT: "Lt.",
  SERGEANT: "Sgt.",
  DOCTOR: "Dr.",
  PROFESSOR: "Prof.",
  FATHER: "Fr.",
  BROTHER: "Br.",
  HONORABLE: "Hon.",
  HONOR: "Hon.",
  SHEIK: "Sheikh",
});

const SUFFIX_LOOKUP = buildAffixLookup(PERSON_SUFFIX_VALUES, {
  JUNIOR: "Jr.",
  JNR: "Jr.",
  SENIOR: "Sr.",
  SNR: "Sr.",
  ESQUIRE: "Esq.",
  RETIRED: "Ret.",
});

function formatNameForSchema(name) {
  if (!name) return null;
  const formatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  return pattern.test(formatted) ? formatted : null;
}

function formatMiddleNameForSchema(name) {
  if (!name) return null;
  const formatted = name.charAt(0).toUpperCase() + name.slice(1);
  const pattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  return pattern.test(formatted) ? formatted : null;
}

function cleanRawName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const noisePatterns = [
    /\bET\s*AL\b/gi,
    /\bETAL\b/gi,
    /\bET\s*UX\b/gi,
    /\bET\s*VIR\b/gi,
    /\bET\s+UXOR\b/gi,
    /\bTRUSTEE[S]?\b/gi,
    /\bTTEE[S]?\b/gi,
    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bAKA\b/gi,
    /\bA\/K\/A\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\b%\s*INTEREST\b/gi,
    /\b\d{1,3}%\b/gi,
    /\b\d{1,3}%\s*INTEREST\b/gi,
    /\bJR\.?\b/gi,
    /\bSR\.?\b/gi,
  ];
  noisePatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  s = s.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(&|and)\s+/i, "")
    .replace(/\s+(&|and)$/i, "")
    .trim();
  // If a trailing bare number remains right after a company suffix, drop it
  const companySuffix =
    "(?:LLC|L\\.L\\.C|INC|CORP|CO|COMPANY|LTD|TRUST|LP|LLP|PLC|PLLC)";
  const trailingNumAfterCo = new RegExp(
    `^(.*?\\b${companySuffix}\\b)\\s+\\d{1,3}$`,
    "i",
  );
  const m = s.match(trailingNumAfterCo);
  if (m) {
    s = m[1].trim();
  }
  return s;
}

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function cleanInvalidCharsFromName(raw) {
  let parsedName = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
    .replace(/[^A-Za-z\-', .]/g, "") // Only keep valid characters
    .trim();
  while (/^[\-', .]/i.test(parsedName)) { // Cannot start or end with special characters
    parsedName = parsedName.slice(1);
  }
  while (/[\-', .]$/i.test(parsedName)) { // Cannot start or end with special characters
    parsedName = parsedName.slice(0, parsedName.length - 1);
  }
  return parsedName;
}

function extractPrefixSuffix(rawName) {
  const tokens = normalizeWhitespace(rawName)
    .replace(/[,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) {
    return { prefix_name: null, suffix_name: null, name_without_affixes: "" };
  }
  let prefix = null;
  if (tokens.length) {
    const firstNorm = normalizeAffixToken(tokens[0]);
    if (firstNorm && PREFIX_LOOKUP.has(firstNorm)) {
      prefix = PREFIX_LOOKUP.get(firstNorm);
      tokens.shift();
    }
  }
  let suffix = null;
  while (tokens.length) {
    const lastNorm = normalizeAffixToken(tokens[tokens.length - 1]);
    if (lastNorm && SUFFIX_LOOKUP.has(lastNorm)) {
      suffix = SUFFIX_LOOKUP.get(lastNorm);
      tokens.pop();
      break;
    }
    break;
  }
  return {
    prefix_name: prefix,
    suffix_name: suffix,
    name_without_affixes: tokens.join(" "),
  };
}

const COMPANY_KEYWORDS = [
  // Business entity types - short forms
  "inc", "corp", "co", "llc", "l.l.c", "ltd", "lp", "llp", "plc", "pllc", "pc", "pa", "pllp", "lllp", "rlp", "rllp",
  // Business entity types - long forms
  "incorporated", "corporation", "company", "limited", "partnership", "professional",
  // Trusts and estates
  "trust", "tr", "estate", "foundation", "fund", "endowment", "charity", "charitable",
  // Financial institutions
  "bank", "banking", "credit", "union", "financial", "finance", "investment", "investments",
  "insurance", "mutual", "savings", "loan", "mortgage", "capital", "ventures", "venture",
  // Business structures
  "holdings", "holding", "group", "partners", "associates", "association", "alliance",
  "consortium", "syndicate", "cooperative", "coop", "collective", "joint", "venture",
  // Service companies
  "solutions", "services", "consulting", "management", "development", "enterprises",
  "systems", "technologies", "tech", "software", "hardware", "networks", "communications",
  // Industry specific
  "construction", "builders", "contractors", "realty", "real estate", "properties",
  "manufacturing", "industries", "industrial", "productions", "operations", "logistics",
  "transportation", "shipping", "freight", "delivery", "warehouse", "distribution",
  // Institutions
  "church", "chapel", "cathedral", "parish", "ministry", "ministries", "mission",
  "school", "college", "university", "institute", "academy", "education", "learning",
  "hospital", "medical", "health", "healthcare", "clinic", "center", "centre",
  // Government
  "government", "federal", "state", "county", "city", "municipal", "authority", "agency",
  "department", "bureau", "commission", "board", "district", "administration", "clerk", "court",
  // Organizations
  "club", "society", "organization", "org", "league", "union", "federation", "council",
  // Commercial
  "retail", "wholesale", "trading", "imports", "exports", "sales", "marketing",
  "energy", "oil", "gas", "electric", "power", "utilities", "water", "sewer",
  "media", "broadcasting", "publishing", "entertainment", "studios", "productions",
  // Professional services
  "law", "legal", "attorneys", "lawyers", "accounting", "cpa", "engineering", "architects"
];


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\.$)`, "i").test(n),
  );
}

function splitCompositeNames(name) {
  const normalized = normalizeWhitespace(name);
  if (!normalized) return [];
  return normalized
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function classifyOwner(raw) {
  const { prefix_name, suffix_name, name_without_affixes } = extractPrefixSuffix(raw);
  const cleaned = cleanRawName(name_without_affixes);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  const tokens = cleaned.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }
  const first = cleanInvalidCharsFromName(tokens[0]);
  const last = cleanInvalidCharsFromName(tokens[tokens.length - 1]);
  const middleTokens = tokens.slice(1, -1);
  // if (/^[A-Za-z]$/.test(last)) {
  //   return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  // }
  const middle = cleanInvalidCharsFromName(middleTokens.join(" ").trim());
  if (first && last) {
    const person = {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle ? middle : null,
      prefix_name: prefix_name || null,
      suffix_name: suffix_name || null,
    };
    return { valid: true, owner: person };
  }
  return { valid: false, reason: "person_missing_first_or_last", raw: cleaned };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let norm;
    if (o.type === "company") {
      norm = `company:${normalizeName(o.name)}`;
    } else {
      const middle = o.middle_name ? normalizeName(o.middle_name) : "";
      norm = `person:${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}`;
    }
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(o);
    }
  }
  return out;
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function extractCurrentOwners($) {
  const owners = [];
  // Handle multiple owner rows with flexible selector
  $("[id*='rptOwner'][id*='lnkUpmSearchLinkSuppressed_lblSearch']").each((i, el) => {
    const ownerText = $(el).text().trim();
    if (ownerText) {
      owners.push(txt(ownerText));
    }
  });
  return owners;
}

function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length < 8) return;
    const saleDateRaw = txt(tds.eq(0).text());
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const grantee = txt(tds.eq(8).text());
    const grantor = txt(tds.eq(7).text());
    if (grantee) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }
    if (grantor) priorOwners.push(grantor);
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  const propertyStatusTerms = ['improved', 'vacant', 'unimproved', 'residential', 'commercial', 'industrial'];
  
  for (const raw of rawStrings) {
    // Skip property status terms
    if (propertyStatusTerms.includes(raw.toLowerCase().trim())) {
      continue;
    }
    
    const parts = splitCompositeNames(raw);
    if (parts.length === 0) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      continue;
    }
    for (const part of parts) {
      const res = classifyOwner(part);
      if (res.valid) {
        owners.push(res.owner);
      } else {
        invalidCollector.push({
          raw: part,
          reason: res.reason || "invalid_owner",
        });
      }
    }
  }
  return dedupeOwners(owners);
}

const parcelId = getParcelId($);
const currentOwnerRaw = extractCurrentOwners($);
console.log("currentOwnerRaw",currentOwnerRaw);
const { map: salesMap, priorOwners } = extractSalesOwnersByDate($);

console.log("salesMap", salesMap);
console.log("PriorOwners",priorOwners);

const invalid_owners = [];
const dates = Object.keys(salesMap).sort();
const owners_by_date = {};
for (const d of dates) {
  const owners = resolveOwnersFromRawStrings(salesMap[d], invalid_owners);
  if (owners.length > 0) {
    owners_by_date[d] = owners;
  }
}

if (priorOwners && priorOwners.length > 0) {
  const granteeNamesNorm = new Set();
  Object.values(owners_by_date).forEach((arr) => {
    arr.forEach((o) => {
      if (o.type === "company")
        granteeNamesNorm.add(`company:${normalizeName(o.name)}`);
      else
        granteeNamesNorm.add(
          `person:${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}`,
        );
    });
  });
  const placeholderRaw = [];
  for (const p of priorOwners) {
    const parts = splitCompositeNames(p);
    for (const part of parts) {
      const res = classifyOwner(part);
      if (res.valid) {
        const o = res.owner;
        let key;
        if (o.type === "company") key = `company:${normalizeName(o.name)}`;
        else
          key = `person:${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}`;
        if (!granteeNamesNorm.has(key)) {
          placeholderRaw.push(part);
        }
      } else {
        invalid_owners.push({
          raw: part,
          reason: res.reason || "invalid_owner",
        });
      }
    }
  }
  if (placeholderRaw.length > 0) {
    const unknownOwners = resolveOwnersFromRawStrings(
      placeholderRaw,
      invalid_owners,
    );
    if (unknownOwners.length > 0) {
      let idx = 1;
      let unknownKey = `unknown_date_${idx}`;
      while (Object.prototype.hasOwnProperty.call(owners_by_date, unknownKey)) {
        idx += 1;
        unknownKey = `unknown_date_${idx}`;
      }
      owners_by_date[unknownKey] = unknownOwners;
    }
  }
}

const currentOwnersStructured = resolveOwnersFromRawStrings(
  currentOwnerRaw,
  invalid_owners,
);
if (currentOwnersStructured.length > 0) {
  owners_by_date["current"] = currentOwnersStructured;
} else {
  owners_by_date["current"] = [];
}

const orderedOwnersByDate = {};
const dateKeys = Object.keys(owners_by_date)
  .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  .sort();
for (const dk of dateKeys) orderedOwnersByDate[dk] = owners_by_date[dk];
Object.keys(owners_by_date)
  .filter((k) => /^unknown_date_\d+$/.test(k))
  .forEach((k) => {
    orderedOwnersByDate[k] = owners_by_date[k];
  });
if (Object.prototype.hasOwnProperty.call(owners_by_date, "current")) {
  orderedOwnersByDate["current"] = owners_by_date["current"];
}

const propKey = `property_${parcelId || "unknown_id"}`;
const output = {};
output[propKey] = { owners_by_date: orderedOwnersByDate };

function dedupeInvalidOwners(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = `${normalizeName(item.raw)}|${item.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ raw: item.raw, reason: item.reason });
    }
  }
  return out;
}

output.invalid_owners = dedupeInvalidOwners(invalid_owners);

const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log(JSON.stringify(output));
