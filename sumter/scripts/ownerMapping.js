const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
// const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl01_mSection .sdw1-owners-container";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales tbody tr";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

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

    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bAKA\b/gi,
    /\bA\/K\/A\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\b%\s*INTEREST\b/gi,
    /\b\d{1,3}%\b/gi,
    /\b\d{1,3}%\s*INTEREST\b/gi,
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

const PREFIX_MAP = {
  mr: "Mr.",
  "mr.": "Mr.",
  mrs: "Mrs.",
  "mrs.": "Mrs.",
  ms: "Ms.",
  "ms.": "Ms.",
  miss: "Miss",
  mx: "Mx.",
  "mx.": "Mx.",
  dr: "Dr.",
  "dr.": "Dr.",
  prof: "Prof.",
  "prof.": "Prof.",
  rev: "Rev.",
  "rev.": "Rev.",
  fr: "Fr.",
  "fr.": "Fr.",
  sr: "Sr.",
  "sr.": "Sr.",
  br: "Br.",
  "br.": "Br.",
  capt: "Capt.",
  "capt.": "Capt.",
  col: "Col.",
  "col.": "Col.",
  maj: "Maj.",
  "maj.": "Maj.",
  lt: "Lt.",
  "lt.": "Lt.",
  sgt: "Sgt.",
  "sgt.": "Sgt.",
  hon: "Hon.",
  "hon.": "Hon.",
  judge: "Judge",
  rabbi: "Rabbi",
  imam: "Imam",
  sheikh: "Sheikh",
  sir: "Sir",
  dame: "Dame",
};

const SUFFIX_MAP = {
  jr: "Jr.",
  "jr.": "Jr.",
  sr: "Sr.",
  "sr.": "Sr.",
  ii: "II",
  iii: "III",
  iv: "IV",
  phd: "PhD",
  "ph.d": "PhD",
  md: "MD",
  "m.d": "MD",
  esq: "Esq.",
  "esq.": "Esq.",
  jd: "JD",
  llm: "LLM",
  mba: "MBA",
  rn: "RN",
  dds: "DDS",
  dvm: "DVM",
  cfa: "CFA",
  cpa: "CPA",
  pe: "PE",
  pmp: "PMP",
  emeritus: "Emeritus",
  ret: "Ret.",
  "ret.": "Ret.",
};

function normalizePrefixToken(token) {
  return token.replace(/[^A-Za-z.]/g, "").toLowerCase();
}

function normalizeSuffixToken(token) {
  return token.replace(/[^A-Za-z0-9.]/g, "").toLowerCase();
}

function extractPrefixAndSuffix(tokens) {
  const working = [...tokens];
  let prefix = null;
  let suffix = null;

  if (working.length) {
    const firstToken = normalizePrefixToken(working[0]);
    if (PREFIX_MAP[firstToken]) {
      prefix = PREFIX_MAP[firstToken];
      working.shift();
    }
  }

  if (working.length) {
    const lastToken = normalizeSuffixToken(working[working.length - 1]);
    if (SUFFIX_MAP[lastToken]) {
      suffix = SUFFIX_MAP[lastToken];
      working.pop();
    }
  }

  return { tokens: working, prefix_name: prefix, suffix_name: suffix };
}

const COMPANY_KEYWORDS = [
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c",
  "limited liability company",
  "ltd",
  "ltd.",
  "limited",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "company",
  "companies",
  "services",
  "service",
  "trust",
  "trustee",
  "trustees",
  "tr",
  "associates",
  "association",
  "assoc",
  "assn",
  "holdings",
  "holding",
  "group",
  "partners",
  "partnership",
  "lp",
  "l.p",
  "limited partnership",
  "llp",
  "l.l.p",
  "limited liability partnership",
  "plc",
  "p.l.c",
  "pllc",
  "p.l.l.c",
  "professional limited liability company",
  "pc",
  "p.c",
  "professional corporation",
  "pa",
  "p.a",
  "professional association",
  "bank",
  "banks",
  "church",
  "ministries",
  "school",
  "schools",
  "university",
  "authority",
  "authority.",
  "board",
  "dept",
  "department",
  "ministries",
  "club",
  "clubs",
  "hoa",
  "homeowners association",
  "village",
  "villages",
  "ttee",
];


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\.$)`, "i").test(n),
  );
}

function splitCompositeNames(name) {
  const cleaned = cleanRawName(name);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

function classifyOwner(raw) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  const tokens = cleaned.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  const { tokens: coreTokens, prefix_name, suffix_name } = extractPrefixAndSuffix(tokens);
  if (coreTokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }
  const first = cleanInvalidCharsFromName(coreTokens[0]);
  const last = cleanInvalidCharsFromName(coreTokens[coreTokens.length - 1]);
  const middleTokens = coreTokens.slice(1, -1);
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
  const selector = '#ctlBodyPane_ctl02_ctl01_rptOwner_ctl00_sprOwnerName1_lnkUpmSearchLinkSuppressed_lblSearch';
  const ownerText = $(selector).text().trim();
  if (ownerText) {
    owners.push(ownerText);
  }
  return owners;
}

function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    const th = $tr.find("th").first();
    const tds = $tr.find("td");
    const saleDateRaw = txt(th.text());
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const grantee = txt(tds.last().text());
    // console.log("grantee",grantee)
    if (grantee) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }
    // const grantor = txt(tds.eq(tds.length - 2).text());
    // if (grantor) priorOwners.push(grantor);
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  for (const raw of rawStrings) {
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
console.log("currentOwnerRaw",currentOwnerRaw)
const { map: salesMap, priorOwners } = extractSalesOwnersByDate($);
console.log("salesMap",salesMap)
console.log("priorOwners",priorOwners)


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
