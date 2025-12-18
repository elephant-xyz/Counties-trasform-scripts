const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl01_mSection .sdw1-owners-container";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales_grdFlat tbody tr";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function normalizeComparisonToken(token) {
  return (token || "").toLowerCase().replace(/[^a-z]/g, "");
}

function escapeRegex(str) {
  return (str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NAME_PREFIXES = new Set(
  [
    "mr",
    "mrs",
    "ms",
    "miss",
    "dr",
    "doctor",
    "rev",
    "reverend",
    "father",
    "pastor",
    "sir",
    "madam",
    "lady",
    "lord",
    "judge",
    "justice",
    "hon",
    "honorable",
    "prof",
    "professor",
    "capt",
    "captain",
    "cpt",
    "sgt",
    "sergeant",
    "lt",
    "lieutenant",
    "col",
    "colonel",
    "maj",
    "major",
    "cmdr",
    "commander",
    "ofc",
    "officer",
    "imam",
    "rabbi",
    "bishop",
    "elder",
    "pastora",
  ].map(normalizeComparisonToken),
);

const NAME_SUFFIXES = new Set(
  [
    "jr",
    "sr",
    "ii",
    "iii",
    "iv",
    "v",
    "vi",
    "vii",
    "esq",
    "esquire",
    "md",
    "phd",
    "dds",
    "dmd",
    "do",
    "od",
    "jd",
    "mba",
    "rn",
    "cpa",
    "pe",
    "dvm",
    "ret",
    "retired",
  ].map(normalizeComparisonToken),
);

const SURNAME_PREFIXES = new Set(
  [
    "de",
    "del",
    "de la",
    "de las",
    "de los",
    "di",
    "da",
    "dos",
    "du",
    "le",
    "la",
    "los",
    "las",
    "van",
    "von",
    "der",
    "den",
    "ter",
    "ten",
    "mac",
    "mc",
    "st",
    "st.",
    "saint",
    "san",
    "santa",
    "bin",
    "al",
    "ibn",
    "abu",
    "ben",
  ].map(normalizeComparisonToken),
);

function cleanInvalidCharsFromName(raw) {
  let parsedName = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Za-z\-', .]/g, "")
    .trim();
  while (/^[\-', .]/i.test(parsedName)) {
    parsedName = parsedName.slice(1);
  }
  while (/[\-', .]$/i.test(parsedName)) {
    parsedName = parsedName.slice(0, parsedName.length - 1);
  }
  return parsedName;
}

function cleanCompanyString(raw) {
  let s = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/\s+,/g, ",").replace(/,\s+/g, ", ");
  s = s.replace(/[,;]+$/g, "").trim();
  return s;
}

function cleanRawName(raw) {
  let s = normalizeWhitespace(raw);
  if (!s) return "";
  s = s.replace(/\([^)]*\)/g, " ");
  const dropTrailingPatterns = [
    /\b(?:FKA|F\/K\/A|AKA|A\/K\/A|NKA|N\/K\/A)\b.*$/gi,
  ];
  dropTrailingPatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  const noisePatterns = [
    /\bET\s*AL\b/gi,
    /\bETAL\b/gi,
    /\bET\s*UX\b/gi,
    /\bET\s*VIR\b/gi,
    /\bET\s+UXOR\b/gi,
    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\bH\s*&\s*W\b/gi,
    /\bH\/W\b/gi,
    /\bHUSBAND\b/gi,
    /\bWIFE\b/gi,
    /\bINT(?:ER(?:EST)?)?\b/gi,
    /\bCOMMUNITY\s+PROPERTY\b/gi,
    /\bJT\s+TEN\b/gi,
    /\bTENANTS?\s+BY\s+THE\s+ENTIRETY\b/gi,
    /\bTENANTS?\s+IN\s+COMMON\b/gi,
    /\bMAR(?:RIED|\.?)\b/gi,
    /\bA\/W\b/gi,
    /\bS\/H\b/gi,
    /\bD\/B\/A\b/gi,
  ];
  noisePatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  s = s.replace(/\d{1,3}%/gi, " ");
  s = s.replace(/\b\d{1,3}%\s*INT(?:ER(?:EST)?)?\b/gi, " ");
  s = s.replace(/\b\d+(?:\.\d+)?\s*PCT\b/gi, " ");
  s = s.replace(/\d+(?:\.\d+)?%?/gi, (match) =>
    match.includes("%") ? " " : match,
  );
  s = s.replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(&|and)\s+/i, "")
    .replace(/\s+(&|and)$/i, "")
    .trim();
  return s;
}

function tokenizeNameSection(segment) {
  const normalized = normalizeWhitespace(
    segment
      .replace(/[\u2019]/g, "'")
      .replace(/\./g, " ")
      .replace(/[^A-Za-z0-9'&\- ]+/g, " "),
  );
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function stripLeadingPrefixes(tokens) {
  const out = [...tokens];
  while (out.length > 0) {
    const norm = normalizeComparisonToken(out[0]);
    if (norm && NAME_PREFIXES.has(norm)) {
      out.shift();
    } else {
      break;
    }
  }
  return out;
}

function stripTrailingSuffixes(tokens) {
  const out = [...tokens];
  while (out.length > 0) {
    const norm = normalizeComparisonToken(out[out.length - 1]);
    if (norm && NAME_SUFFIXES.has(norm)) {
      out.pop();
    } else {
      break;
    }
  }
  return out;
}

function formatLastNameTokens(tokens) {
  if (!tokens || tokens.length === 0) return "";
  let surname = tokens.join(" ").trim();
  surname = surname.replace(/\bMC\s+(?=[A-Z])/gi, (m) =>
    m.replace(/\s+/, ""),
  );
  surname = surname.replace(/\bMAC\s+(?=[A-Z])/gi, (m) =>
    m.replace(/\s+/, ""),
  );
  surname = surname.replace(/\bO'\s+(?=[A-Z])/gi, "O'");
  return cleanInvalidCharsFromName(surname);
}

function extractLastNameTokens(tokens) {
  if (!tokens.length) return [];
  const result = [tokens[tokens.length - 1]];
  for (let i = tokens.length - 2; i >= 0; i -= 1) {
    const candidate = tokens[i];
    const norm = normalizeComparisonToken(candidate);
    if (norm && SURNAME_PREFIXES.has(norm)) {
      result.unshift(candidate);
    } else {
      break;
    }
  }
  return result;
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
  "company",
  "services",
  "trust",
  "tr",
  "trustee",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "lp",
  "llp",
  "plc",
  "pllc",
  "bank",
  "church",
  "school",
  "university",
  "authority",
  "properties",
  "realty",
  "management",
  "investments",
  "fund",
  "estate",
];


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\\.|$)`, "i").test(n),
  );
}

const COMPOSITE_SPLIT_REGEX =
  /(?:\s+\band\b\s+|\s*&\s*|\s*\/\s*|\s*;\s*|\s*\+\s*)/i;

function splitCompositeNames(raw) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) return [];
  const compositeHasComma = /,/.test(cleaned);
  if (isCompanyName(cleaned)) {
    return [
      {
        raw: cleaned,
        hasComma: compositeHasComma,
        index: 0,
        compositeHasComma,
        inheritedLastName: null,
      },
    ];
  }
  const protectedAmpersand = cleaned.replace(/(\S)&(\S)/g, "$1@@AMP@@$2");
  const parts = protectedAmpersand
    .split(COMPOSITE_SPLIT_REGEX)
    .map((segment) =>
      normalizeWhitespace(segment.replace(/@@AMP@@/g, "&")),
    )
    .filter(Boolean)
    .map((segment, idx) => ({
      raw: segment,
      hasComma: segment.includes(","),
      index: idx,
      compositeHasComma,
    }));
  let inheritedLastName = null;
  return parts.map((part) => {
    const result = { ...part, inheritedLastName: null };
    if (part.hasComma) {
      const candidate = extractCandidateLastName(part.raw);
      if (candidate) {
        inheritedLastName = candidate;
      }
    } else if (inheritedLastName) {
      const pattern = new RegExp(`\\b${escapeRegex(inheritedLastName)}\\b`, "i");
      if (!pattern.test(part.raw)) {
        result.inheritedLastName = inheritedLastName;
      }
    }
    return result;
  });
}

function extractCandidateLastName(partText) {
  if (!partText) return null;
  if (partText.includes(",")) {
    const [lastSegment] = partText.split(",");
    const lastTokens = stripTrailingSuffixes(tokenizeNameSection(lastSegment));
    const surname = formatLastNameTokens(
      lastTokens.length ? lastTokens : tokenizeNameSection(lastSegment),
    );
    if (surname && normalizeComparisonToken(surname).length > 1) {
      return surname;
    }
  }
  let tokens = tokenizeNameSection(partText);
  if (!tokens.length) return null;
  tokens = stripLeadingPrefixes(tokens);
  tokens = stripTrailingSuffixes(tokens);
  if (!tokens.length) return null;
  const surnameTokens = extractLastNameTokens(tokens);
  const surname = formatLastNameTokens(surnameTokens);
  if (surname && normalizeComparisonToken(surname).length > 1) {
    return surname;
  }
  return null;
}

function collectCandidateLastNames(parts) {
  const seen = new Set();
  const candidates = [];
  for (const part of parts) {
    const candidate = extractCandidateLastName(part.raw);
    if (!candidate) continue;
    const norm = normalizeName(candidate);
    if (!seen.has(norm) && norm.length > 1) {
      seen.add(norm);
      candidates.push(candidate);
    }
  }
  return candidates;
}

function pickFallbackLastName(candidateLastNames, currentLastName) {
  if (!candidateLastNames || candidateLastNames.length === 0) return null;
  const currentNorm = normalizeComparisonToken(currentLastName || "");
  for (const candidate of candidateLastNames) {
    if (!candidate) continue;
    const norm = normalizeComparisonToken(candidate);
    if (!norm || norm.length <= 1) continue;
    if (currentNorm && norm === currentNorm && currentNorm.length > 1) {
      return cleanInvalidCharsFromName(candidate);
    }
    if (!currentNorm || norm !== currentNorm) {
      return cleanInvalidCharsFromName(candidate);
    }
  }
  return null;
}

function classifyOwner(part, candidateLastNames) {
  const cleaned = normalizeWhitespace(part.raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw: part.raw };
  }
  if (isCompanyName(cleaned)) {
    return {
      valid: true,
      owner: {
        type: "company",
        name: cleanCompanyString(cleaned),
      },
    };
  }

  const fallbackLastNames = candidateLastNames || [];
  const fallbackNorms = new Set(
    fallbackLastNames
      .map((ln) => normalizeComparisonToken(ln))
      .filter((norm) => norm && norm.length > 1),
  );
  const hasComma = part.hasComma || cleaned.includes(",");

  if (hasComma) {
    const sections = cleaned.split(",");
    const lastSegment = sections.shift();
    const restSegment = sections.join(" ");
    let lastTokens = stripTrailingSuffixes(tokenizeNameSection(lastSegment));
    if (!lastTokens.length) {
      lastTokens = tokenizeNameSection(lastSegment);
    }
    const lastTokensSnapshot = [...lastTokens];
    let givenTokens = tokenizeNameSection(restSegment);
    givenTokens = stripLeadingPrefixes(givenTokens);
    givenTokens = stripTrailingSuffixes(givenTokens);
    if (!givenTokens.length) {
      givenTokens = tokenizeNameSection(restSegment);
    }
    if (!givenTokens.length) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
    const firstRaw = givenTokens.shift();
    const firstName = cleanInvalidCharsFromName(firstRaw);
    const middleTokens = givenTokens
      .map(cleanInvalidCharsFromName)
      .filter(Boolean);
    let lastName = formatLastNameTokens(lastTokens);
    let fallbackApplied = false;
    if (!lastName || normalizeComparisonToken(lastName).length <= 1) {
      const fallback = pickFallbackLastName(fallbackLastNames, lastName);
      if (fallback) {
        lastName = fallback;
        fallbackApplied = true;
      }
    }
    if (!lastName || normalizeComparisonToken(lastName).length <= 1) {
      return {
        valid: false,
        reason: "person_missing_last_name",
        raw: cleaned,
      };
    }
    if (!firstName) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
    let middleNameValue = middleTokens.length
      ? cleanInvalidCharsFromName(middleTokens.join(" "))
      : null;
    if (fallbackApplied && lastTokensSnapshot.length) {
      const fallbackMiddleRaw = cleanInvalidCharsFromName(
        lastTokensSnapshot.join(" "),
      );
      const fallbackMiddleNorm = normalizeComparisonToken(fallbackMiddleRaw);
      if (fallbackMiddleNorm) {
        if (middleNameValue) {
          if (normalizeComparisonToken(middleNameValue) !== fallbackMiddleNorm) {
            middleNameValue = `${middleNameValue} ${fallbackMiddleRaw}`.trim();
          }
        } else {
          middleNameValue = fallbackMiddleRaw;
        }
      }
    }
    return {
      valid: true,
      owner: {
        type: "person",
        first_name: firstName,
        last_name: lastName,
        middle_name: middleNameValue ? middleNameValue : null,
      },
    };
  }

  let tokens = tokenizeNameSection(cleaned);
  if (!tokens.length) {
    return { valid: false, reason: "unparseable_or_empty", raw: cleaned };
  }
  tokens = stripLeadingPrefixes(tokens);
  tokens = stripTrailingSuffixes(tokens);
  if (!tokens.length) {
    tokens = tokenizeNameSection(cleaned);
  }
  const tokenCount = tokens.length;
  if (tokenCount === 0) {
    return { valid: false, reason: "unparseable_or_empty", raw: cleaned };
  }
  if (tokenCount === 1) {
    const firstName = cleanInvalidCharsFromName(tokens[0]);
    let lastNameCandidate = null;
    if (part.inheritedLastName) {
      lastNameCandidate = cleanInvalidCharsFromName(part.inheritedLastName);
    }
    if (!lastNameCandidate) {
      lastNameCandidate = pickFallbackLastName(fallbackLastNames);
    }
    if (lastNameCandidate) {
      return {
        valid: true,
        owner: {
          type: "person",
          first_name: firstName,
          last_name: lastNameCandidate,
          middle_name: null,
        },
      };
    }
    return {
      valid: false,
      reason: "person_missing_last_name",
      raw: cleaned,
    };
  }

  const surnameTokens = extractLastNameTokens(tokens);
  const surnameTokensSnapshot = [...surnameTokens];
  const remainingTokens = tokens.slice(0, tokenCount - surnameTokens.length);
  if (!remainingTokens.length) {
    return {
      valid: false,
      reason: "person_missing_first_name",
      raw: cleaned,
    };
  }
  const firstName = cleanInvalidCharsFromName(remainingTokens.shift());
  const middleTokens = remainingTokens
    .map(cleanInvalidCharsFromName)
    .filter(Boolean);
  let lastName = formatLastNameTokens(surnameTokens);
  let fallbackApplied = false;
  let updatedLastNorm = normalizeComparisonToken(lastName);
  const inheritedNorm = normalizeComparisonToken(part.inheritedLastName);
  if (
    part.inheritedLastName &&
    inheritedNorm &&
    (!updatedLastNorm || updatedLastNorm !== inheritedNorm) &&
    (tokenCount <= 2 ||
      !new RegExp(`\\b${escapeRegex(part.inheritedLastName)}\\b`, "i").test(
        part.raw,
      ))
  ) {
    lastName = cleanInvalidCharsFromName(part.inheritedLastName);
    fallbackApplied = true;
    updatedLastNorm = normalizeComparisonToken(lastName);
  }
  if (!lastName || !updatedLastNorm || updatedLastNorm.length <= 1) {
    const fallback = pickFallbackLastName(fallbackLastNames, lastName);
    if (fallback) {
      lastName = fallback;
      fallbackApplied = true;
      updatedLastNorm = normalizeComparisonToken(lastName);
    }
  }
  if (
    !fallbackApplied &&
    tokenCount <= 2 &&
    fallbackNorms.size >= 1 &&
    (!updatedLastNorm || !fallbackNorms.has(updatedLastNorm)) &&
    part.compositeHasComma
  ) {
    const fallback = pickFallbackLastName(fallbackLastNames, lastName);
    if (fallback) {
      lastName = fallback;
      fallbackApplied = true;
      updatedLastNorm = normalizeComparisonToken(lastName);
    }
  }
  if (!lastName || !updatedLastNorm || updatedLastNorm.length <= 1) {
    return {
      valid: false,
      reason: "person_missing_last_name",
      raw: cleaned,
    };
  }
  if (!firstName) {
    return {
      valid: false,
      reason: "person_missing_first_name",
      raw: cleaned,
    };
  }

  let middleNameValue = middleTokens.length
    ? cleanInvalidCharsFromName(middleTokens.join(" "))
    : null;
  if (fallbackApplied && surnameTokensSnapshot.length) {
    const fallbackMiddleRaw = cleanInvalidCharsFromName(
      surnameTokensSnapshot.join(" "),
    );
    const fallbackMiddleNorm = normalizeComparisonToken(fallbackMiddleRaw);
    if (fallbackMiddleNorm) {
      if (middleNameValue) {
        if (normalizeComparisonToken(middleNameValue) !== fallbackMiddleNorm) {
          middleNameValue = `${middleNameValue} ${fallbackMiddleRaw}`.trim();
        }
      } else {
        middleNameValue = fallbackMiddleRaw;
      }
    }
  }

  return {
    valid: true,
    owner: {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleNameValue ? middleNameValue : null,
    },
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
  $(CURRENT_OWNER_SELECTOR).each((i, el) => {
    const owner_text_split = $(el).text().split('\n');
    for (const owner of owner_text_split) {
      if (owner.trim()) {
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
    if (grantee) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }
    const grantor = txt(tds.eq(tds.length - 2).text());
    if (grantor) priorOwners.push(grantor);
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawEntries, invalidCollector) {
  const owners = [];
  for (const entry of rawEntries) {
    let parts;
    if (
      entry &&
      typeof entry === "object" &&
      Object.prototype.hasOwnProperty.call(entry, "raw")
    ) {
      parts = [entry];
    } else {
      const raw = entry;
      parts = splitCompositeNames(raw);
      if (parts.length === 0) {
        invalidCollector.push({ raw, reason: "unparseable_or_empty" });
        continue;
      }
    }
    const candidateLastNames = collectCandidateLastNames(parts);
    for (const part of parts) {
      const res = classifyOwner(part, candidateLastNames);
      if (res.valid) {
        owners.push(res.owner);
      } else {
        invalidCollector.push({
          raw: part.raw,
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
    if (parts.length === 0) {
      invalid_owners.push({ raw: p, reason: "unparseable_or_empty" });
      continue;
    }
    const candidateLastNames = collectCandidateLastNames(parts);
    for (const part of parts) {
      const res = classifyOwner(part, candidateLastNames);
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
          raw: part.raw,
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
