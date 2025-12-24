const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_lblParcelID";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl02_ctl01_lstOwners";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl05_ctl01_grdSalesHist tbody tr";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

function cleanRawName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const noisePatterns = [
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

const PREFIX_NORMALIZATION_MAP = {
  mr: "Mr.",
  mister: "Mr.",
  mrs: "Mrs.",
  missus: "Mrs.",
  ms: "Ms.",
  miss: "Miss",
  mx: "Mx.",
  mxx: "Mx.",
  dr: "Dr.",
  doctor: "Dr.",
  prof: "Prof.",
  professor: "Prof.",
  rev: "Rev.",
  reverend: "Rev.",
  fr: "Fr.",
  father: "Fr.",
  sr: "Sr.",
  br: "Br.",
  brother: "Br.",
  capt: "Capt.",
  captain: "Capt.",
  col: "Col.",
  colonel: "Col.",
  maj: "Maj.",
  major: "Maj.",
  lt: "Lt.",
  lieutenant: "Lt.",
  sgt: "Sgt.",
  sergeant: "Sgt.",
  hon: "Hon.",
  honorable: "Hon.",
  judge: "Judge",
  rabbi: "Rabbi",
  imam: "Imam",
  sheikh: "Sheikh",
  shaikh: "Sheikh",
  sir: "Sir",
  dame: "Dame",
};

const SUFFIX_NORMALIZATION_MAP = {
  jr: "Jr.",
  junior: "Jr.",
  sr: "Sr.",
  senior: "Sr.",
  ii: "II",
  "2nd": "II",
  iii: "III",
  "3rd": "III",
  iv: "IV",
  "4th": "IV",
  phd: "PhD",
  "ph.d": "PhD",
  md: "MD",
  "m.d": "MD",
  esq: "Esq.",
  esquire: "Esq.",
  jd: "JD",
  "j.d": "JD",
  llm: "LLM",
  "ll.m": "LLM",
  mba: "MBA",
  rn: "RN",
  dds: "DDS",
  dvm: "DVM",
  cfa: "CFA",
  cpa: "CPA",
  pe: "PE",
  "p.e": "PE",
  pmp: "PMP",
  emeritus: "Emeritus",
  ret: "Ret.",
  retired: "Ret.",
};

function normalizeAffixToken(token) {
  return (token || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
}

function extractPrefixAndSuffix(tokens) {
  const remaining = [...tokens];
  let prefix_name = null;
  let suffix_name = null;

  if (remaining.length > 0) {
    const mappedPrefix =
      PREFIX_NORMALIZATION_MAP[normalizeAffixToken(remaining[0])];
    if (mappedPrefix) {
      prefix_name = mappedPrefix;
      remaining.shift();
    }
  }

  if (remaining.length > 0) {
    const mappedSuffix =
      SUFFIX_NORMALIZATION_MAP[
        normalizeAffixToken(remaining[remaining.length - 1])
      ];
    if (mappedSuffix) {
      suffix_name = mappedSuffix;
      remaining.pop();
    }
  }

  return { prefix_name, suffix_name, tokens: remaining };
}

const COMPANY_KEYWORDS = [
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c",
  "lc",
  "l.c",
  "ltd",
  "ltd.",
  "limited",
  "limited company",
  "limited co",
  "limited liability company",
  "limited liability co",
  "limited liability corporation",
  "limited liability corp",
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
  "trust",
  "tr",
  "trustees",
  "associates",
  "assoc",
  "assn",
  "association",
  "partnership",
  "partner",
  "holdings",
  "group",
  "partners",
  "lp",
  "l.p",
  "llp",
  "l.l.p",
  "lllp",
  "l.l.l.p",
  "limited partnership",
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
  "church",
  "school",
  "university",
  "authority",
];


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) => {
    const kwPattern = kw.replace(/\./g, "\\.").replace(/\s+/g, "\\s+");
    return new RegExp(`(^|\\b)${kwPattern}(\\b|\\.?$)`, "i").test(n);
  });
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
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }
  const { prefix_name, suffix_name, tokens: coreTokens } =
    extractPrefixAndSuffix(tokens);
  if (coreTokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }
  const first = cleanInvalidCharsFromName(coreTokens[0]);
  const last = cleanInvalidCharsFromName(coreTokens[coreTokens.length - 1]);
  const middleTokens = coreTokens.slice(1, -1);
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
      const prefix = o.prefix_name ? normalizeName(o.prefix_name) : "";
      const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
      norm = `person:${prefix}|${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`;
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
  $('#ctlBodyPane_ctl02_ctl01_lstOwners tbody tr td span[id*="lblOwnerFirstName"]').each((i, el) => {
    const ownerText = $(el).text().trim();
    if (ownerText) {
      owners.push(ownerText);
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
    const tdate = $tr.find("th").first();
    // const tds = $tr.find("td");
    const saleDateRaw = txt(tdate.text());
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;
    // const grantee = txt(tds.last().text());
    // if (grantee) {
    if (!map[dateStr]) map[dateStr] = [""];
    // map[dateStr].push("");
    // }
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
const { map: salesMap, priorOwners } = extractSalesOwnersByDate($);

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
      else {
        const prefix = o.prefix_name ? normalizeName(o.prefix_name) : "";
        const middle = o.middle_name ? normalizeName(o.middle_name) : "";
        const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
        granteeNamesNorm.add(
          `person:${prefix}|${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`,
        );
      }
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
        else {
          const prefix = o.prefix_name ? normalizeName(o.prefix_name) : "";
          const middle = o.middle_name ? normalizeName(o.middle_name) : "";
          const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
          key = `person:${prefix}|${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`;
        }
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
