const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl02_mSection .sdw1-owners-container";
const SALES_TABLE_SELECTOR = 'table[id$="_grdSales"] tbody tr';

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

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
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "cor",
  "co",
  "company",
  "services",
  "trust",
  "tr",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "partnership",
  "lp",
  "llp",
  "plc",
  "pllc",
  "bank",
  "church",
  "school",
  "university",
  "authority",
];

const NAME_PREFIX_MAP = new Map([
  ["mr", "Mr"],
  ["mister", "Mr"],
  ["mrs", "Mrs"],
  ["ms", "Ms"],
  ["miss", "Miss"],
  ["dr", "Dr"],
  ["doctor", "Dr"],
  ["prof", "Prof"],
  ["professor", "Prof"],
  ["rev", "Rev"],
  ["reverend", "Rev"],
  ["pastor", "Pastor"],
  ["hon", "Hon"],
  ["honorable", "Hon"],
  ["sir", "Sir"],
  ["madam", "Madam"],
  ["capt", "Capt"],
  ["captain", "Capt"],
  ["lt", "Lt"],
  ["lieutenant", "Lt"],
  ["sgt", "Sgt"],
  ["sergeant", "Sgt"],
  ["col", "Col"],
  ["colonel", "Col"],
  ["judge", "Judge"],
]);

const NAME_SUFFIX_MAP = new Map([
  ["jr", "Jr"],
  ["sr", "Sr"],
  ["ii", "II"],
  ["iii", "III"],
  ["iv", "IV"],
  ["v", "V"],
  ["vi", "VI"],
  ["md", "MD"],
  ["phd", "PhD"],
  ["dds", "DDS"],
  ["dvm", "DVM"],
  ["cpa", "CPA"],
  ["pe", "PE"],
  ["esq", "Esq"],
  ["esquire", "Esq"],
  ["ret", "Ret"],
]);

const SURNAME_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "del",
  "dela",
  "de la",
  "de las",
  "de los",
  "der",
  "di",
  "dos",
  "du",
  "la",
  "las",
  "le",
  "los",
  "mac",
  "mc",
  "san",
  "santa",
  "santo",
  "saint",
  "st",
  "st.",
  "van",
  "van der",
  "vander",
  "ver",
  "von",
  "von der",
]);

function normalizeTokenForLookup(token) {
  return (token || "").replace(/\./g, "").toLowerCase();
}

function aggregateParticles(tokens) {
  const out = [];
  while (tokens.length > 0) {
    const token = tokens[0];
    const norm = normalizeTokenForLookup(token);
    out.push(token);
    tokens.shift();
    if (!SURNAME_PARTICLES.has(norm)) {
      break;
    }
  }
  return out;
}

function aggregateSurnameFromEnd(tokens) {
  const out = [];
  let capturedBase = false;
  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1];
    const norm = normalizeTokenForLookup(token);
    if (!capturedBase) {
      out.unshift(token);
      tokens.pop();
      capturedBase = true;
      continue;
    }
    if (!SURNAME_PARTICLES.has(norm)) {
      break;
    }
    out.unshift(token);
    tokens.pop();
  }
  return out;
}


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\\.$|$)`, "i").test(n),
  );
}

function splitCompositeNames(name) {
  const cleaned = cleanRawName(name);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const norm = normalizeTokenForLookup(part);
    if (NAME_PREFIX_MAP.has(norm) && i + 1 < parts.length) {
      const nextPart = parts[i + 1];
      const firstToken = nextPart.split(/\s+/).find(Boolean) || "";
      const nextNorm = normalizeTokenForLookup(firstToken);
      if (!NAME_PREFIX_MAP.has(nextNorm)) {
        parts[i + 1] = `${part} ${parts[i + 1]}`;
      }
      continue;
    }
    merged.push(part);
  }
  return merged;
}

function classifyOwner(raw) {
  const hasComma = /,/.test(raw || "");
  const hasLowercase = /[a-z]/.test(raw || "");
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  let tokens = cleaned
    .split(/\s+/)
    .map((tok) => cleanInvalidCharsFromName(tok))
    .filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  let prefix = null;
  let hadPrefix = false;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[0]);
    const canonical = NAME_PREFIX_MAP.get(lookup);
    if (!canonical) break;
    prefix = prefix ? `${prefix} ${canonical}` : canonical;
    tokens.shift();
    hadPrefix = true;
  }

  let suffix = null;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[tokens.length - 1]);
    const canonical = NAME_SUFFIX_MAP.get(lookup);
    if (!canonical) break;
    suffix = suffix ? `${canonical} ${suffix}` : canonical;
    tokens.pop();
  }

  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  let useLastFirst = !(hadPrefix || hasComma || hasLowercase);
  let lastTokens;
  if (useLastFirst) {
    lastTokens = aggregateParticles(tokens);
    if (tokens.length < 1) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
  } else {
    lastTokens = aggregateSurnameFromEnd(tokens);
    if (tokens.length < 1) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
  }

  const first = tokens.shift();
  const middleTokens = tokens;

  const last = lastTokens.join(" ").trim();
  const middle = middleTokens.join(" ").trim();

  if (!first || !last) {
    return {
      valid: false,
      reason: "person_missing_first_or_last",
      raw: cleaned,
    };
  }

  const person = {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle ? middle : null,
    prefix_name: prefix || null,
    suffix_name: suffix || null,
  };
  return { valid: true, owner: person };
}

function dedupeOwners(owners) {
  const seen = new Map();
  const out = [];
  for (const o of owners) {
    let norm;
    if (o.type === "company") {
      norm = `company:${normalizeName(o.name)}`;
    } else {
      const middle = o.middle_name ? normalizeName(o.middle_name) : "";
      const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
      norm = `person:${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`;
    }
    if (!seen.has(norm)) {
      seen.set(norm, o);
      out.push(o);
    } else {
      const existing = seen.get(norm);
      if (
        (!existing.mailing_address || !existing.mailing_address.trim()) &&
        o.mailing_address
      ) {
        existing.mailing_address = o.mailing_address;
      }
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
  $(CURRENT_OWNER_SELECTOR).each((i, el) => {
    const lines = $(el)
      .text()
      .split("\n")
      .map((line) => txt(line))
      .filter((line) => line)
      .filter((line) => !/primary/i.test(line));
    if (!lines.length) return;
    const nameLine = lines[0];
    const addressLines = lines.slice(1);
    const mailingAddress = addressLines.length ? addressLines.join(", ") : null;
    owners.push({ raw: nameLine, mailing_address: mailingAddress });
  });
  return owners;
}

function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("th, td");
    if (!cells.length) return;
    const saleDateRaw = txt($(cells[0]).text());
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const granteeCell = cells[cells.length - 1];
    const grantee = granteeCell ? txt($(granteeCell).text()) : null;
    if (grantee && !/^\*+none\*+$/i.test(grantee)) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }
    const grantorCell = cells[cells.length - 2];
    const grantor = grantorCell ? txt($(grantorCell).text()) : null;
    if (grantor && !/^\*+none\*+$/i.test(grantor)) priorOwners.push(grantor);
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  for (const entry of rawStrings) {
    let mailingAddress = null;
    let raw = entry;
    if (entry && typeof entry === "object") {
      mailingAddress =
        entry.mailing_address !== undefined ? entry.mailing_address : null;
      raw =
        entry.raw !== undefined
          ? entry.raw
          : entry.name !== undefined
            ? entry.name
            : "";
    }
    const parts = splitCompositeNames(raw);
    if (parts.length === 0) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      continue;
    }
    for (const part of parts) {
      const res = classifyOwner(part);
      if (res.valid) {
        const owner = res.owner;
        if (mailingAddress && !owner.mailing_address)
          owner.mailing_address = mailingAddress;
        owners.push(owner);
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
