const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl01_mSection > div";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales tbody tr";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

const PERSON_PREFIXES = new Map([
  ["MR", "Mr"],
  ["MRS", "Mrs"],
  ["MS", "Ms"],
  ["MISS", "Miss"],
  ["DR", "Dr"],
  ["DOCTOR", "Dr"],
  ["REV", "Rev"],
  ["REVEREND", "Rev"],
  ["HON", "Hon"],
  ["HONORABLE", "Hon"],
  ["ATTY", "Atty"],
  ["ATTORNEY", "Attorney"],
  ["PROF", "Prof"],
  ["PROFESSOR", "Prof"],
  ["CAPT", "Capt"],
  ["CAPTAIN", "Capt"],
  ["SGT", "Sgt"],
  ["SERGEANT", "Sgt"],
  ["LT", "Lt"],
  ["LIEUTENANT", "Lt"],
  ["COL", "Col"],
  ["COLONEL", "Col"],
]);

const PERSON_SUFFIXES = new Map([
  ["JR", "Jr"],
  ["SR", "Sr"],
  ["II", "II"],
  ["III", "III"],
  ["IV", "IV"],
  ["V", "V"],
  ["VI", "VI"],
  ["ESQ", "Esq"],
  ["ESQUIRE", "Esq"],
  ["MD", "MD"],
  ["DDS", "DDS"],
  ["DMD", "DMD"],
  ["DO", "DO"],
  ["DVM", "DVM"],
  ["CPA", "CPA"],
  ["JD", "JD"],
  ["LLM", "LLM"],
  ["PHD", "PhD"],
  ["PH.D", "PhD"],
  ["RN", "RN"],
]);

const OWNERSHIP_DESIGNATOR_TOKENS = new Set([
  "ET",
  "AL",
  "ETAL",
  "ET-AL",
  "ETUX",
  "ET-UX",
  "ETVIR",
  "ET-VIR",
  "ETUXOR",
  "JTROS",
  "JTRS",
  "JTWROS",
  "JT",
  "JTEN",
  "TENENT",
  "TENENTS",
  "TENANT",
  "TENANTS",
  "TEN",
  "TENANTSS",
  "TENCOMM",
  "TENCOM",
  "TENINCOMMON",
  "COMMUNITY",
  "PROPERTY",
  "JTWRS",
  "TIC",
  "H/W",
  "H& W",
  "H&W",
  "HUSBAND",
  "WIFE",
  "SPOUSES",
  "SPOUSE",
  "TRS",
  "TRUSTEES",
  "TRUSTEE",
  "TTEE",
  "TTEES",
  "REVOCABLE",
  "LIVING",
  "TRUST",
  "FBO",
  "C/O",
  "PERCENT",
  "%",
  "MINOR",
  "HEIRS",
  "ESTATE",
  "EST",
  "L/E",
  "LE",
  "LIFEESTATE",
  "UNKNOWNBUYER",
  "UNKNOWN",
  "BUYER",
]);

const PLACEHOLDER_PATTERNS = [
  /^\*{0,2}\s*multiple\s+buyers\s*\*{0,2}$/i,
  /^\*{0,2}\s*multiple\s+owners\s*\*{0,2}$/i,
  /^\*{0,2}\s*multiple\s+sellers\s*\*{0,2}$/i,
  /^\*{0,2}\s*unknown\s+buyer\s*\*{0,2}$/i,
  /^\*{0,2}\s*unknown\s+seller\s*\*{0,2}$/i,
  /^\*{0,2}\s*unknown\s+owner\s*\*{0,2}$/i,
  /^\*{0,2}\s*none\s*\*{0,2}$/i,
];

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function stripPunctuation(token) {
  return (token || "").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

function normalizeTokenForMatch(token) {
  return stripPunctuation(token || "").replace(/\./g, "").toUpperCase();
}

function formatNameValue(value) {
  if (!value) return null;
  return value
    .split(/\s+/)
    .map((token) => {
      if (!token) return "";
      const cleaned = token.replace(/\./g, "");
      if (/^[A-Z]$/i.test(cleaned)) {
        return cleaned.toUpperCase();
      }
      return cleaned
        .split("-")
        .map((part) => {
          if (!part) return "";
          const lower = part.toLowerCase();
          return lower.replace(/\b([a-z])/g, (m) => m.toUpperCase());
        })
        .filter(Boolean)
        .join("-");
    })
    .filter(Boolean)
    .join(" ");
}

function sanitizeOwnerText(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/&amp;/gi, "&")
    .replace(/\u2019/g, "'")
    .replace(/\*/g, " ")
    .replace(/\bn\/a\b/gi, "")
    .replace(/\([^)]*\)/g, " ");
  s = s.replace(/%/g, " % ");
  s = normalizeWhitespace(s);
  return s;
}

function isPlaceholderOwner(value) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

function shouldSplitOnComma(segment) {
  if (!segment || !segment.includes(",")) return false;
  const idx = segment.indexOf(",");
  if (idx === -1) return false;
  const before = segment.slice(0, idx).trim();
  if (!before || !before.includes(" ")) return false;
  const beforeTokens = before.split(/\s+/);
  const lastToken = normalizeTokenForMatch(
    beforeTokens[beforeTokens.length - 1],
  );
  if (PERSON_SUFFIXES.has(lastToken)) return false;
  return true;
}

function analyzeSegment(rawSegment) {
  const segment = normalizeWhitespace(rawSegment);
  if (!segment) return null;
  const upper = segment.toUpperCase();
  const hasComma = segment.includes(",");
  const beforeFirstComma = hasComma
    ? segment.slice(0, segment.indexOf(",")).trim()
    : null;
  const preferLastFirst =
    hasComma && beforeFirstComma && !beforeFirstComma.includes(" ");
  const preferFirstFirst = !preferLastFirst && segment === upper;
  return {
    raw: segment,
    hasComma,
    preferLastFirst,
    preferFirstFirst,
    isAllCaps: segment === upper,
  };
}

function splitCompositeSegments(raw) {
  const sanitized = sanitizeOwnerText(raw);
  if (!sanitized || isPlaceholderOwner(sanitized)) return [];
  const normalizedConjunctions = sanitized
    .replace(/\s+AND\/OR\s+/gi, " & ")
    .replace(/\s+AND\s+/gi, " & ")
    .replace(/\s+WITH\s+/gi, " & ")
    .replace(/\s*\/\s*/g, " & ")
    .replace(/\s*\+\s*/g, " & ");

  const parts = normalizedConjunctions
    .split(/\s*&\s*/i)
    .map((part) => part.replace(/,+/g, ",").trim())
    .filter(Boolean);

  const segments = [];
  for (const part of parts) {
    if (shouldSplitOnComma(part)) {
      part.split(/\s*,\s*/).forEach((piece) => {
        const seg = analyzeSegment(piece);
        if (seg) segments.push(seg);
      });
    } else {
      const seg = analyzeSegment(part);
      if (seg) segments.push(seg);
    }
  }
  return segments;
}

function inferLastNameFromSegments(segments) {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (!segment || !segment.raw) continue;
    const cleaned = sanitizeOwnerText(segment.raw);
    if (!cleaned || isPlaceholderOwner(cleaned)) continue;
    if (isCompanyName(cleaned)) continue;
    let tokens = cleaned.split(/\s+/).filter(Boolean);
    tokens = tokens.filter((token) => {
      const norm = normalizeTokenForMatch(token);
      if (!norm) return false;
      if (OWNERSHIP_DESIGNATOR_TOKENS.has(norm)) return false;
      if (PERSON_PREFIXES.has(norm)) return false;
      if (PERSON_SUFFIXES.has(norm)) return false;
      return true;
    });
    if (!tokens.length) continue;
    let candidate = null;
    const firstTokenNorm = normalizeTokenForMatch(tokens[0]);
    const lastTokenNorm = normalizeTokenForMatch(tokens[tokens.length - 1]);
    const likelyLastFirst =
      segment.preferLastFirst || (!segment.preferFirstFirst && !segment.isAllCaps);
    if (likelyLastFirst && tokens.length >= 1) {
      candidate = tokens[0];
    } else if (
      tokens.length >= 3 &&
      lastTokenNorm.length === 1 &&
      firstTokenNorm.length > 1
    ) {
      candidate = tokens[0];
    } else if (tokens.length >= 1) {
      candidate = tokens[tokens.length - 1];
    }
    if (!candidate) continue;
    const normalizedCandidate = normalizeTokenForMatch(candidate);
    if (!normalizedCandidate || normalizedCandidate.length <= 1) continue;
    if (PERSON_SUFFIXES.has(normalizedCandidate)) continue;
    if (OWNERSHIP_DESIGNATOR_TOKENS.has(normalizedCandidate)) continue;
    return formatNameValue(candidate);
  }
  return null;
}

const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "llc.",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "company",
  "services",
  "trust",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "partnership",
  "lp",
  "llp",
  "lllp",
  "plc",
  "pllc",
  "pc",
  "p.c",
  "pa",
  "p.a",
  "bank",
  "church",
  "school",
  "university",
  "authority",
  "ministries",
  "properties",
  "investments",
  "management",
  "development",
  "enterprise",
  "enterprises",
  "club",
  "corporation",
  "federal",
  "state",
  "county",
  "city",
  "department",
  "trustees",
  "trustee",
  "mutual",
  "credit",
  "union",
  "capital",
  "condominium",
  "hoa",
  "homeowners",
  "limited",
  "incorporated",
];

function isCompanyName(name) {
  if (!name) return false;
  const normalized = sanitizeOwnerText(name).toLowerCase();
  if (!normalized) return false;
  if (
    /\b(trust|ministries|church|temple|synagogue|bank|association|authority|department|credit union|homeowners|condominium)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b(corp\.?|co\.?|company|inc\.?|l\.?l\.?c\.?|ltd\.?|lp|llp|lllp|plc|pllc|pc|p\.c\.|pa|p\.a\.)\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\b(holdings|group|partners?|properties|management|development|enterprises?)\b/i.test(normalized)) {
    return true;
  }
  if (/\b(association|assn|assoc)\b/i.test(normalized)) return true;
  if (/\b(trustee|ttee|tstee)\b/i.test(normalized)) return true;
  if (
    /\b(united\s+states|u\.?\s*s\.?\s*a\.?|us\s+government|state\s+of\s+[a-z]+|city\s+of\s+[a-z]+|county\s+of\s+[a-z]+|town\s+of\s+[a-z]+|village\s+of\s+[a-z]+|department\s+of\s+[a-z]+|board\s+of\s+[a-z]+|nature\s+conservancy|conservancy)\b/i.test(
      normalized,
    )
  )
    return true;
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\\.$)`, "i").test(normalized),
  );
}

function splitCompositeNames(name) {
  return splitCompositeSegments(name);
}

function classifyOwner(segment, context = {}) {
  if (!segment || !segment.raw) {
    return { valid: false, reason: "unparseable_or_empty", raw: segment ? segment.raw : "" };
  }

  const cleaned = sanitizeOwnerText(segment.raw);
  if (!cleaned) {
    return { valid: false, reason: "unparseable_or_empty", raw: segment.raw };
  }
  if (isPlaceholderOwner(cleaned)) {
    return { valid: false, reason: "placeholder_entry", raw: cleaned };
  }
  if (isCompanyName(cleaned)) {
    return {
      valid: true,
      owner: {
        type: "company",
        name: cleaned,
        normalized_name: normalizeName(cleaned),
      },
    };
  }

  let tokens = cleaned.split(/\s+/).filter(Boolean);
  tokens = tokens.filter((token) => {
    const normalized = normalizeTokenForMatch(token);
    if (!normalized) return false;
    if (normalized === "&") return false;
    if (OWNERSHIP_DESIGNATOR_TOKENS.has(normalized)) return false;
    return true;
  });

  const prefixes = [];
  while (tokens.length) {
    const normalized = normalizeTokenForMatch(tokens[0]);
    if (PERSON_PREFIXES.has(normalized)) {
      prefixes.push(PERSON_PREFIXES.get(normalized));
      tokens.shift();
    } else {
      break;
    }
  }

  const suffixes = [];
  while (tokens.length) {
    const normalized = normalizeTokenForMatch(tokens[tokens.length - 1]);
    if (PERSON_SUFFIXES.has(normalized)) {
      suffixes.unshift(PERSON_SUFFIXES.get(normalized));
      tokens.pop();
    } else {
      break;
    }
  }

  tokens = tokens.filter(Boolean);
  if (!tokens.length) {
    return { valid: false, reason: "person_missing_first_or_last", raw: cleaned };
  }

  const fallbackLast =
    context && context.lastNameFallback ? context.lastNameFallback : null;

  let order = null;
  if (segment.preferFirstFirst) order = "firstLast";
  else if (segment.preferLastFirst) order = "lastFirst";
  const firstTokenNorm = normalizeTokenForMatch(tokens[0]);
  const lastTokenNorm = normalizeTokenForMatch(tokens[tokens.length - 1]);
  if (!order && segment.isAllCaps) order = "firstLast";
  if (!order && context && context.assumedLastFirst) order = "lastFirst";
  if (
    order === "firstLast" &&
    tokens.length >= 3 &&
    lastTokenNorm.length === 1 &&
    firstTokenNorm.length > 1
  ) {
    order = "lastFirst";
  }
  if (
    !order &&
    segment.preferFirstFirst &&
    tokens.length >= 3 &&
    lastTokenNorm.length === 1 &&
    firstTokenNorm.length > 1
  ) {
    order = "lastFirst";
  }

  if (!order) {
    if (tokens.length === 1 && fallbackLast) {
      order = "firstLast";
    } else if (
      fallbackLast &&
      tokens.length >= 2 &&
      normalizeTokenForMatch(tokens[tokens.length - 1]) ===
        normalizeTokenForMatch(fallbackLast)
    ) {
      order = "firstLast";
    }
  }

  if (!order) order = "lastFirst";

  let firstName = null;
  let middleName = null;
  let lastName = null;

  if (order === "firstLast") {
    if (tokens.length === 1) {
      if (fallbackLast) {
        firstName = tokens[0];
        lastName = fallbackLast;
      } else {
        return {
          valid: false,
          reason: "person_missing_last_name",
          raw: cleaned,
        };
      }
    } else {
      firstName = tokens[0];
      lastName = tokens[tokens.length - 1];
      if (tokens.length > 2) {
        middleName = tokens.slice(1, -1).join(" ");
      }
    }
    if (
      lastName &&
      normalizeTokenForMatch(lastName).length === 1 &&
      fallbackLast
    ) {
      lastName = fallbackLast;
    }
  } else {
    if (tokens.length === 1) {
      if (fallbackLast) {
        firstName = tokens[0];
        lastName = fallbackLast;
        order = "firstLast";
      } else {
        return {
          valid: false,
          reason: "person_missing_first_or_last",
          raw: cleaned,
        };
      }
    } else {
      lastName = tokens[0];
      firstName = tokens[1];
      if (tokens.length > 2) {
        middleName = tokens.slice(2).join(" ");
      }
    }
  }

  if (!lastName) {
    if (fallbackLast) lastName = fallbackLast;
    else
      return {
        valid: false,
        reason: "person_missing_last_name",
        raw: cleaned,
      };
  }

  if (!firstName) {
    return {
      valid: false,
      reason: "person_missing_first_or_last",
      raw: cleaned,
    };
  }

  const owner = {
    type: "person",
    prefix_name: prefixes.length ? prefixes.join(" ") : null,
    first_name: formatNameValue(firstName),
    middle_name: middleName ? formatNameValue(middleName) : null,
    last_name: formatNameValue(lastName),
    suffix_name: suffixes.length ? suffixes.join(" ") : null,
  };

  return {
    valid: true,
    owner,
    lastNameForContext: owner.last_name,
  };
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
  $(CURRENT_OWNER_SELECTOR).each((i, el) => {
    const owner_text_split = $(el).text().split('\n');
    for (const owner of owner_text_split) {
      if (owner.trim() && !owner.toLowerCase().includes("primary")) {
        const t = txt(owner.trim());
        owners.push(t);
        break;
      }
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
    const tds = $tr.find("td");
    const saleDateRaw = txt(tdate.text());
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const grantee = txt(tds.eq(tds.length - 2).text());
    if (grantee) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }
    const grantor = txt(tds.eq(tds.length - 3).text());
    if (grantor) priorOwners.push(grantor);
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  for (const raw of rawStrings) {
    const segments = splitCompositeNames(raw);
    if (!segments.length) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      continue;
    }
    let lastNameFallback = inferLastNameFromSegments(segments);
    const assumedLastFirst = true;
    for (const segment of segments) {
      const res = classifyOwner(segment, {
        lastNameFallback,
        assumedLastFirst,
      });
      if (res.valid) {
        owners.push(res.owner);
        if (
          res.owner.type === "person" &&
          res.owner.last_name &&
          res.owner.last_name.trim()
        ) {
          lastNameFallback = res.owner.last_name;
        }
      } else {
        invalidCollector.push({
          raw: segment.raw || raw,
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
    let runningFallback = inferLastNameFromSegments(parts);
    for (const part of parts) {
      const res = classifyOwner(part, {
        lastNameFallback: runningFallback,
        assumedLastFirst: true,
      });
      if (res.valid) {
        const o = res.owner;
        let key;
        if (o.type === "company") key = `company:${normalizeName(o.name)}`;
        else
          key = `person:${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}`;
        if (!granteeNamesNorm.has(key)) {
          placeholderRaw.push(part.raw || part);
        }
        if (
          o.type === "person" &&
          o.last_name &&
          o.last_name.trim()
        ) {
          runningFallback = o.last_name;
        }
      } else {
        invalid_owners.push({
          raw: part.raw || part,
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
