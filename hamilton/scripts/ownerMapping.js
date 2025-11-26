const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl13_ctl01_grdSales tbody tr";
const CURRENT_OWNER_SELECTOR = ".module-content .sdw1-owners-container";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

const PERSON_PREFIX_MAP = {
  MR: "Mr.",
  MRS: "Mrs.",
  MS: "Ms.",
  MISS: "Miss",
  MX: "Mx.",
  DR: "Dr.",
  PROF: "Prof.",
  REV: "Rev.",
  FR: "Fr.",
  SR: "Sr.",
  BR: "Br.",
  CAPT: "Capt.",
  CAPTAIN: "Capt.",
  COL: "Col.",
  COLONEL: "Col.",
  MAJ: "Maj.",
  MAJOR: "Maj.",
  LT: "Lt.",
  LIEUTENANT: "Lt.",
  SGT: "Sgt.",
  SERGEANT: "Sgt.",
  HON: "Hon.",
  HONORABLE: "Hon.",
  JUDGE: "Judge",
  RABBI: "Rabbi",
  IMAM: "Imam",
  SHEIKH: "Sheikh",
  SIR: "Sir",
  DAME: "Dame",
};

const PERSON_SUFFIX_MAP = {
  JR: "Jr.",
  SR: "Sr.",
  II: "II",
  2: "II",
  III: "III",
  3: "III",
  IV: "IV",
  4: "IV",
  PHD: "PhD",
  MD: "MD",
  ESQ: "Esq.",
  JD: "JD",
  LLM: "LLM",
  MBA: "MBA",
  RN: "RN",
  DDS: "DDS",
  DVM: "DVM",
  CFA: "CFA",
  CPA: "CPA",
  PE: "PE",
  PMP: "PMP",
  EMERITUS: "Emeritus",
  RET: "Ret.",
};

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

function normalizeAffixToken(token) {
  return (token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function mapPrefixToken(token) {
  const norm = normalizeAffixToken(token);
  if (!norm) return null;
  return PERSON_PREFIX_MAP[norm] || null;
}

function mapSuffixToken(token) {
  const norm = normalizeAffixToken(token);
  if (!norm) return null;
  return PERSON_SUFFIX_MAP[norm] || null;
}

function extractNameAffixes(tokens) {
  const remaining = [...tokens];
  let prefix = null;
  let suffix = null;

  if (remaining.length) {
    const maybePrefix = mapPrefixToken(remaining[0]);
    if (maybePrefix) {
      prefix = maybePrefix;
      remaining.shift();
    }
  }

  if (remaining.length) {
    const maybeSuffix = mapSuffixToken(remaining[remaining.length - 1]);
    if (maybeSuffix) {
      suffix = maybeSuffix;
      remaining.pop();
    }
  }

  return { tokens: remaining, prefix_name: prefix, suffix_name: suffix };
}

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

const COMPANY_KEYWORDS = [
  // Corporation indicators
  "inc", "incorporated",
  "corp", "corporation",
  "co", "company",
  
  // Limited Liability Company indicators
  "llc", "l.l.c", "l.l.c.",
  "limited liability company",
  
  // Limited Company indicators
  "ltd", "limited",
  "ltda", "limitada",
  
  // Partnership indicators
  "lp", "limited partnership",
  "llp", "limited liability partnership",
  "l.l.p", "l.l.p.",
  "gp", "general partnership",
  "partners", "partnership",
  
  // Professional entities
  "plc", "public limited company",
  "pllc", "professional limited liability company",
  "p.l.l.c", "p.l.l.c.",
  "pc", "professional corporation",
  "p.c", "p.c.",
  "pa", "professional association",
  "p.a", "p.a.",
  
  // Trust and estate indicators
  "trust", "tr", "trustee",
  "estate", "est",
  "foundation", "fdn",
  
  // Business structure indicators
  "associates", "assoc",
  "association", "assn",
  "holdings", "holding",
  "group", "grp",
  "enterprise", "enterprises",
  "ventures", "venture",
  "solutions", "sol",
  "services", "svc", "svcs",
  "systems", "sys",
  "technologies", "tech",
  "consulting", "consultants",
  "management", "mgmt",
  "development", "dev",
  "investments", "inv",
  "properties", "prop",
  "realty", "real estate",
  "construction", "const",
  "manufacturing", "mfg",
  "alliance", "all",
  
  // Financial institutions
  "bank", "banking",
  "credit union", "cu",
  "savings", "s&l",
  "financial", "fin",
  "insurance", "ins",
  
  // Non-profit and institutional
  "church", "parish",
  "school", "academy",
  "university", "univ", "college",
  "hospital", "medical center",
  "clinic", "healthcare",
  "authority", "auth",
  "commission", "comm",
  "board", "brd",
  "department", "dept",
  "division", "div",
  "bureau", "bur",
  "agency", "agcy",
  "administration", "admin",
  "district", "dist",
  "municipality", "muni",
  "county", "co",
  "city", "town",
  "state", "federal",
  "government", "govt",
  "public", "municipal",
  
  // Legal and court related
  "clerk", "court",
  "legal", "law",
  "attorney", "atty",
  "counsel",
  
  // International indicators
  "sa", "sociedad anonima",
  "srl", "sociedad de responsabilidad limitada",
  "gmbh", "gesellschaft mit beschränkter haftung",
  "ag", "aktiengesellschaft",
  "bv", "besloten vennootschap",
  "nv", "naamloze vennootschap",
  "spa", "società per azioni",
  "srl", "società a responsabilità limitata",
  "sarl", "société à responsabilité limitée",
  "sas", "société par actions simplifiée",
  "pty", "proprietary",
  "pvt", "private",
  
  // Other common indicators
  "organization", "org",
  "institute", "inst",
  "center", "centre", "ctr",
  "society", "soc",
  "union", "local",
  "cooperative", "coop",
  "mutual", "mut"
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
  let tokens = cleaned.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  const { tokens: baseTokens, prefix_name, suffix_name } = extractNameAffixes(tokens);
  tokens = baseTokens;
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
  
  // Try the specific selector first
  const specificOwner = $('#ctlBodyPane_ctl03_ctl01_rptOwner_ctl00_sprOwnerName1_lnkUpmSearchLinkSuppressed_lblSearch').text().trim();
  if (specificOwner) {
    owners.push(txt(specificOwner));
  }
  
  // Fallback to original selector
  if (owners.length === 0) {
    $(CURRENT_OWNER_SELECTOR).find('a').each((i, el) => {
      const ownerText = $(el).text().trim();
      if (ownerText) {
        const t = txt(ownerText);
        owners.push(t);
      }
    });
  }
  
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
          `person:${o.prefix_name ? normalizeName(o.prefix_name) : ""}|${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`,
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
          key = `person:${o.prefix_name ? normalizeName(o.prefix_name) : ""}|${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`;
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
