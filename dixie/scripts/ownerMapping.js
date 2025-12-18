const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_gvwSales tbody tr";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl01_mSection .module-content";

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
  "association",
  "associates",
  "partners",
  "lp",
  "llp",
  "plc",
  "company",
  "holdings",
  "properties",
  "property",
  "management",
];

const PERSON_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);
const COMMON_FIRST_NAMES = new Set([
  "JAMES",
  "JOHN",
  "ROBERT",
  "MICHAEL",
  "WILLIAM",
  "DAVID",
  "RICHARD",
  "CHARLES",
  "JOSEPH",
  "THOMAS",
  "CHRISTOPHER",
  "DANIEL",
  "PAUL",
  "MARK",
  "DONALD",
  "GEORGE",
  "KENNETH",
  "STEVEN",
  "EDWARD",
  "BRIAN",
  "RONALD",
  "ANTHONY",
  "KEVIN",
  "JASON",
  "MATTHEW",
  "GARY",
  "TIMOTHY",
  "LARRY",
  "JEFFREY",
  "FRANK",
  "SCOTT",
  "ERIC",
  "STEPHEN",
  "ANDREW",
  "RAYMOND",
  "GREGORY",
  "JOSHUA",
  "JERRY",
  "DENNIS",
  "PATRICK",
  "PETER",
  "HAROLD",
  "DOUGLAS",
  "HENRY",
  "CARL",
  "ARTHUR",
  "RYAN",
  "ROGER",
  "JACOB",
  "BILLY",
  "GREG",
  "GLEN",
  "GLENN",
  "MARY",
  "PATRICIA",
  "LINDA",
  "BARBARA",
  "ELIZABETH",
  "JENNIFER",
  "MARIA",
  "SUSAN",
  "MARGARET",
  "DOROTHY",
  "LISA",
  "NANCY",
  "KAREN",
  "BETTY",
  "HELEN",
  "SANDRA",
  "DONNA",
  "CAROL",
  "RUTH",
  "SHARON",
  "MICHELLE",
  "LAURA",
  "SARAH",
  "KIMBERLY",
  "DEBORAH",
  "JESSICA",
  "CYNTHIA",
  "ANGELA",
  "MELISSA",
  "BRENDA",
  "AMY",
  "ANNA",
  "REBECCA",
  "KATHLEEN",
  "PAMELA",
  "MARTHA",
  "DEBRA",
  "AMANDA",
  "STEPHANIE",
  "CAROLYN",
  "CHRISTINE",
  "MARIE",
  "JANET",
  "CATHERINE",
  "FRANCES",
  "ANN",
  "JOYCE",
  "DIANE",
  "ALICE",
  "JULIE",
  "HEATHER",
  "TERESA",
  "LORI",
  "GLORIA",
  "RACHEL",
  "DEBBIE",
  "DEBORA",
  "DEBRAH",
]);

function isInitial(token) {
  return /^[A-Z]$/i.test(token || "");
}

function isLikelySuffix(token) {
  if (!token) return false;
  const clean = token.replace(/\./g, "").toUpperCase();
  return PERSON_SUFFIXES.has(clean);
}

function isCommonFirstName(token) {
  if (!token) return false;
  return COMMON_FIRST_NAMES.has(token.replace(/\./g, "").toUpperCase());
}


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
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  const rawHasComma = /,/.test(raw || "");

  const workingTokens = [...tokens];
  while (workingTokens.length > 2 && isLikelySuffix(workingTokens[workingTokens.length - 1])) {
    workingTokens.pop();
  }

  if (workingTokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  const buildCandidate = (useLastFirst) => {
    if (useLastFirst && workingTokens.length < 2) return null;
    let firstRaw;
    let lastRaw;
    let middleTokens;
    if (useLastFirst) {
      lastRaw = workingTokens[0];
      firstRaw = workingTokens[1];
      middleTokens = workingTokens.slice(2);
    } else {
      firstRaw = workingTokens[0];
      lastRaw = workingTokens[workingTokens.length - 1];
      middleTokens = workingTokens.slice(1, -1);
    }
    const firstClean = cleanInvalidCharsFromName(firstRaw);
    const lastClean = cleanInvalidCharsFromName(lastRaw);
    const middleCleanRaw = cleanInvalidCharsFromName(middleTokens.join(" ").trim());
    const middleFormatted = middleCleanRaw
      ? formatMiddleNameForSchema(middleCleanRaw) || middleCleanRaw
      : null;
    if (!firstClean || !lastClean) return null;
    const firstFormatted = formatNameForSchema(firstClean) || firstClean;
    const lastFormatted = formatNameForSchema(lastClean) || lastClean;
    return {
      type: "person",
      first_name: firstFormatted,
      last_name: lastFormatted,
      middle_name: middleFormatted,
    };
  };

  const candidateFirstLast = buildCandidate(false);
  const candidateLastFirst = buildCandidate(true);

  const lastTokenOriginal = workingTokens[workingTokens.length - 1];
  const secondTokenOriginal = workingTokens[1] || "";
  const lastTokenIsInitial = isInitial(lastTokenOriginal);
  const secondTokenIsInitial = isInitial(secondTokenOriginal);

  const scoreCandidate = (candidate, orientation) => {
    if (!candidate) return -Infinity;
    const { first_name, last_name } = candidate;
    if (!first_name || !last_name) return -Infinity;
    let score = 0;
    if (first_name.length > 1) score += 1;
    if (last_name.length > 1) score += 2;
    if (candidate.middle_name) score += 0.5;
    if (orientation === "lastFirst") {
      if (rawHasComma) score += 4;
      if (lastTokenIsInitial) score += 2;
      if (secondTokenIsInitial) score += 1;
      if (isCommonFirstName(secondTokenOriginal)) score += 1.5;
    } else {
      if (candidate.last_name.length <= 1) score -= 3;
    }
    if (candidate.last_name.length <= 1) score -= 1;
    return score;
  };

  const scoreFirst = scoreCandidate(candidateFirstLast, "firstLast");
  const scoreLast = scoreCandidate(candidateLastFirst, "lastFirst");

  let chosen = candidateFirstLast;
  if (scoreLast > scoreFirst) {
    chosen = candidateLastFirst;
  } else if (scoreLast === scoreFirst && rawHasComma) {
    chosen = candidateLastFirst;
  }

  if (chosen) {
    return { valid: true, owner: chosen };
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
  const section = $(CURRENT_OWNER_SELECTOR);
  if (!section.length) return owners;

  section
    .find("[id*='sprOwnerName'], [id*='lblOwnerName']")
    .each((_, el) => {
      const name = txt($(el).text());
      if (name) owners.push(name);
    });

  return owners;
}

function parseSaleDate(raw) {
  const dm = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!dm) return null;
  const mm = dm[1].padStart(2, "0");
  const dd = dm[2].padStart(2, "0");
  const yyyy = dm[3];
  return `${yyyy}-${mm}-${dd}`;
}

function extractGrantorOwnershipByDate($) {
  const sales = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length === 0) return;
    const saleDateRaw = txt($tr.find("th").first().text());
    if (!saleDateRaw) return;
    const saleDate = parseSaleDate(saleDateRaw);
    if (!saleDate) return;
    const grantor = txt(tds.eq(2).text());
    if (!grantor || /^UNKNOWN\b/i.test(grantor)) return;
    sales.push({
      saleDate,
      grantor,
    });
  });

  if (sales.length === 0) {
    return { map: {}, latestSaleDate: null };
  }

  sales.sort((a, b) => (a.saleDate > b.saleDate ? -1 : a.saleDate < b.saleDate ? 1 : 0));

  const map = {};
  for (let i = 0; i < sales.length; i += 1) {
    const current = sales[i];
    const previous = sales[i + 1];
    if (!previous) continue;
    if (!current.grantor) continue;
    if (!map[previous.saleDate]) map[previous.saleDate] = [];
    map[previous.saleDate].push(current.grantor);
  }

  const latestSaleDate = sales[0].saleDate || null;

  return { map, latestSaleDate };
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
const { map: salesMap, latestSaleDate } = extractGrantorOwnershipByDate($);

const invalid_owners = [];
const dates = Object.keys(salesMap).sort();
const owners_by_date = {};
for (const d of dates) {
  const owners = resolveOwnersFromRawStrings(salesMap[d], invalid_owners);
  if (owners.length > 0) {
    owners_by_date[d] = owners;
  }
}

const currentOwnersStructured = resolveOwnersFromRawStrings(
  currentOwnerRaw,
  invalid_owners,
);
if (currentOwnersStructured.length > 0) {
  if (latestSaleDate) {
    const existing = owners_by_date[latestSaleDate] || [];
    owners_by_date[latestSaleDate] = dedupeOwners([
      ...existing,
      ...currentOwnersStructured,
    ]);
  }
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

if (require.main === module) {
  console.log(JSON.stringify(output));
} else {
  module.exports = output;
}
