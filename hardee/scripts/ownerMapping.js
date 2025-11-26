const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl03_mSection .sdw1-owners-container";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl11_ctl01_grdSales tbody tr";

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
  s = s.replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
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

function normalizeAffixToken(token) {
  return (token || "").replace(/[.,-]/g, "").trim().toUpperCase();
}

function toTitleCase(token) {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (/^(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|JR|SR|ESQ|CPA|MD|DDS|DMD|DO|PHARMD|MBA|PHD|EDD|DVM)$/.test(upper)) {
    return upper.replace(/JR|SR/, (m) => (m === "JR" ? "Jr." : "Sr."));
  }
  return trimmed
    .toLowerCase()
    .split(/([-'\s])/)
    .map((part) => {
      if (/^[-'\s]$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("")
    .replace(/\bMc([a-z])/g, (_, c) => `Mc${c.toUpperCase()}`)
    .replace(/\bMac([a-z])/g, (_, c) => `Mac${c.toUpperCase()}`);
}

const NAME_PREFIXES = new Map(
  [
    ["MR", "Mr"],
    ["MRS", "Mrs"],
    ["MS", "Ms"],
    ["MISS", "Miss"],
    ["DR", "Dr"],
    ["REV", "Rev"],
    ["REVEREND", "Rev"],
    ["HON", "Hon"],
    ["ATTY", "Atty"],
    ["ATT", "Att"],
    ["JUDGE", "Judge"],
    ["PASTOR", "Pastor"],
    ["FATHER", "Father"],
    ["SISTER", "Sister"],
  ],
);

// Valid suffix_name values per Elephant schema
const VALID_SCHEMA_SUFFIXES = new Set([
  "Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM",
  "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."
]);

const NAME_SUFFIXES = new Map(
  [
    ["JR", "Jr."],
    ["SR", "Sr."],
    ["II", "II"],
    ["III", "III"],
    ["IV", "IV"],
    ["CPA", "CPA"],
    ["ESQ", "Esq."],
    ["ESQUIRE", "Esq."],
    ["MD", "MD"],
    ["DDS", "DDS"],
    ["DVM", "DVM"],
    ["JD", "JD"],
    ["PHD", "PhD"],
    ["RN", "RN"],
    ["PE", "PE"],
    ["PMP", "PMP"],
    ["MBA", "MBA"],
    ["LLM", "LLM"],
    ["CFA", "CFA"],
    ["EMERITUS", "Emeritus"],
    ["RET", "Ret."],
  ],
);

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
];

const COMPANY_KEYWORD_PATTERN = new RegExp(
  `\\b(${COMPANY_KEYWORDS.map((kw) => kw.replace(/\./g, "\\.")).join("|")})\\b`,
  "i",
);

const COMPANY_ADDITIONAL_PATTERNS = [
  /\btrust\b/i,
  /\bestate\b/i,
  /\bestates\b/i,
  /\bhospital\b/i,
  /\bministries\b/i,
  /\bministry\b/i,
  /\bproperties\b/i,
  /\bproperty\b/i,
  /\bdevelopment\b/i,
  /\bmanagement\b/i,
  /\bcounty\b/i,
  /\bcity\b/i,
  /\bstate\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bboard\b/i,
  /\bdepartment\b/i,
  /\bchamber\b/i,
  /\bclub\b/i,
  /\bcooperative\b/i,
];

const PERSON_NOISE_TOKENS = new Set([
  "AS",
  "AKA",
  "FKA",
  "NKA",
  "FORMERLY",
  "AKA.",
  "FKA.",
  "NKA.",
  "WIFE",
  "HUSBAND",
  "SPOUSE",
  "JT",
  "JTWROS",
  "TTEE",
  "TTEES",
  "TRUSTEE",
  "TRUSTEES",
  "SUCTR",
  "SUCTEE",
  "COTTEE",
  "COTTEES",
  "UND",
  "INT",
  "ESTATE",
  "DECEASED",
  "DESCENDANT",
  "HEIRS",
  "LIVING",
  "REVOCABLE",
]);


function isCompanyName(name) {
  if (!name) return false;
  if (COMPANY_KEYWORD_PATTERN.test(name)) return true;
  if (/\b(l\.?l\.?c\.?|inc\.?|ltd\.?|corp\.?|co\.?|company|pllc|lp|llp|pc|p\.c\.)\b/i.test(name)) {
    return true;
  }
  if (/\b(estate of|estate)\b/i.test(name) && !/\b[A-Z]\b/.test(name)) {
    return true;
  }
  if (/\b(church|ministries|school|academy)\b/i.test(name)) return true;
  if (/\b(city of|county of|state of|united states|usa)\b/i.test(name)) return true;
  if (/\b(department|board|authority|association|assn|trust)\b/i.test(name)) return true;
  return COMPANY_ADDITIONAL_PATTERNS.some((pattern) => pattern.test(name));
}

function splitCompositeNames(name) {
  const cleaned = cleanRawName(name);
  if (!cleaned) return [];
  if (isCompanyName(cleaned)) return [cleaned];
  const rawParts = cleaned
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const parts = [];
  rawParts.forEach((part) => {
    const tokens = part.split(/\s+/).filter(Boolean);
    const allNoise =
      tokens.length > 0 &&
      tokens.every((tok) => {
        const norm = normalizeAffixToken(tok);
        return !norm || PERSON_NOISE_TOKENS.has(norm);
      });
    if (parts.length && allNoise) {
      parts[parts.length - 1] = `${parts[parts.length - 1]} ${part}`.trim();
    } else {
      parts.push(part);
    }
  });
  return parts;
}

function removeParenthetical(str) {
  return (str || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
}

function extractPrefixSuffixTokens(tokens) {
  const working = [...tokens];
  let prefix = null;
  while (working.length) {
    const normalized = normalizeAffixToken(working[0]);
    if (NAME_PREFIXES.has(normalized)) {
      prefix = NAME_PREFIXES.get(normalized);
      working.shift();
    } else {
      break;
    }
  }
  const suffixParts = [];
  while (working.length) {
    const normalized = normalizeAffixToken(working[working.length - 1]);
    if (NAME_SUFFIXES.has(normalized)) {
      suffixParts.unshift(NAME_SUFFIXES.get(normalized));
      working.pop();
    } else {
      break;
    }
  }
  return { prefix, suffixParts, tokens: working };
}

function buildPerson({ first, middle, last, prefix, suffix }) {
  if (!first || !last) return null;
  const person = {
    type: "person",
    first_name: toTitleCase(cleanInvalidCharsFromName(first)),
    last_name: toTitleCase(cleanInvalidCharsFromName(last)),
  };
  if (middle) {
    const cleanedMiddle = cleanInvalidCharsFromName(middle);
    const normalizedMiddle = cleanedMiddle
      .split(/\s+/)
      .map((m) => toTitleCase(m))
      .filter(Boolean)
      .join(" ");
    if (normalizedMiddle) person.middle_name = normalizedMiddle;
  }
  if (prefix) person.prefix_name = prefix;
  if (suffix && suffix.length) {
    // Only use the first suffix that is valid per the schema
    const validSuffix = suffix.find(s => VALID_SCHEMA_SUFFIXES.has(s));
    if (validSuffix) {
      person.suffix_name = validSuffix;
    }
  }
  return person;
}

function scorePersonCandidate(candidate, fallbackLast) {
  if (!candidate) return { score: -Infinity, person: null };
  const person = buildPerson(candidate);
  if (!person) return { score: -Infinity, person: null };
  let score = 0;
  if (person.first_name && person.first_name.length > 1) score += 2;
  if (person.last_name && person.last_name.length > 1) score += 2;
  if (fallbackLast) {
    if (
      person.last_name &&
      person.last_name.toLowerCase() === fallbackLast.toLowerCase()
    )
      score += 1.5;
  }
  if (candidate.orientation === "last_first") score += 0.5;
  if (person.first_name && /^[A-Z]$/.test(person.first_name)) score -= 2;
  if (person.last_name && /^[A-Z]$/.test(person.last_name)) score -= 1;

  // Heavily penalize if first_name is a known suffix or prefix
  if (person.first_name) {
    const normalizedFirst = normalizeAffixToken(person.first_name);
    if (NAME_SUFFIXES.has(normalizedFirst) || NAME_PREFIXES.has(normalizedFirst)) {
      score -= 10;
    }
  }

  // Penalize if last_name is a known suffix or prefix
  if (person.last_name) {
    const normalizedLast = normalizeAffixToken(person.last_name);
    if (NAME_SUFFIXES.has(normalizedLast) || NAME_PREFIXES.has(normalizedLast)) {
      score -= 10;
    }
  }

  return { score, person };
}

function createPersonCandidateFromTokens(
  tokens,
  orientation,
  { prefix, suffixParts },
) {
  if (!tokens || tokens.length === 0) return null;
  if (orientation === "first_last") {
    if (tokens.length < 2) return null;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middleTokens = tokens.slice(1, -1);
    return {
      first,
      last,
      middle: middleTokens.join(" ") || null,
      prefix,
      suffix: suffixParts,
      orientation,
    };
  }
  // default orientation is last_first
  if (tokens.length < 2) return null;
  const last = tokens[0];
  const first = tokens[1];
  const middleTokens = tokens.slice(2);
  return {
    first,
    last,
    middle: middleTokens.join(" ") || null,
    prefix,
    suffix: suffixParts,
    orientation,
  };
}

function classifyOwner(raw, fallbackLastName = null) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  const base = removeParenthetical(cleaned);
  if (!base) {
    return { valid: false, reason: "empty_after_parenthesis_removal", raw };
  }
  if (isCompanyName(base)) {
    return { valid: true, owner: { type: "company", name: base } };
  }

  const commaParts = base.split(",");
  if (commaParts.length > 1) {
    const lastPart = commaParts[0].trim();
    const rightPart = commaParts.slice(1).join(" ").trim();
    const tokens = rightPart.split(/\s+/).filter(Boolean);
    const { prefix, suffixParts, tokens: remaining } =
      extractPrefixSuffixTokens(tokens);
    if (remaining.length === 0) {
      return {
        valid: false,
        reason: "insufficient_tokens_after_comma",
        raw: base,
      };
    }
    const first = remaining[0];
    const middleTokens = remaining.slice(1);
    const candidate = {
      first,
      middle: middleTokens.join(" ") || null,
      last: lastPart,
      prefix,
      suffix: suffixParts,
    };
    const built = buildPerson(candidate);
    if (built) return { valid: true, owner: built };
  }

  let tokens = base.split(/\s+/).filter(Boolean);
  tokens = tokens.filter(
    (token) => !PERSON_NOISE_TOKENS.has(normalizeAffixToken(token)),
  );

  // Check if position 2 (index 1) is a suffix in patterns like "LAST SR FIRST MIDDLE"
  let extractedSuffix = [];
  if (tokens.length >= 3) {
    const secondToken = normalizeAffixToken(tokens[1]);
    if (NAME_SUFFIXES.has(secondToken)) {
      extractedSuffix.push(NAME_SUFFIXES.get(secondToken));
      tokens = [tokens[0], ...tokens.slice(2)];
    }
  }

  const { prefix, suffixParts, tokens: remainingTokens } =
    extractPrefixSuffixTokens(tokens);

  // Combine extracted middle suffix with any trailing suffixes
  const allSuffixes = [...extractedSuffix, ...suffixParts];

  if (remainingTokens.length === 0) {
    return { valid: false, reason: "empty_after_affix_removal", raw: base };
  }

  if (remainingTokens.length === 1) {
    if (!fallbackLastName) {
      return { valid: false, reason: "single_token_no_fallback", raw: base };
    }
    const person = buildPerson({
      first: remainingTokens[0],
      middle: null,
      last: fallbackLastName,
      prefix,
      suffix: allSuffixes,
    });
    if (person) return { valid: true, owner: person };
    return { valid: false, reason: "single_token_parse_failed", raw: base };
  }

  const candidateA = createPersonCandidateFromTokens(remainingTokens, "first_last", {
    prefix,
    suffixParts: allSuffixes,
  });
  const candidateB = createPersonCandidateFromTokens(remainingTokens, "last_first", {
    prefix,
    suffixParts: allSuffixes,
  });

  const scoredA = scorePersonCandidate(candidateA, fallbackLastName);
  const scoredB = scorePersonCandidate(candidateB, fallbackLastName);

  const chosen = scoredA.score >= scoredB.score ? scoredA.person : scoredB.person;
  if (chosen) {
    if (fallbackLastName) {
      const fallback = toTitleCase(fallbackLastName);
      if (!chosen.last_name || !chosen.last_name.trim()) {
        chosen.last_name = fallback;
      } else if (
        chosen.last_name.length === 1 &&
        fallback &&
        chosen.last_name[0].toUpperCase() === fallback[0].toUpperCase()
      ) {
        const middle = chosen.middle_name ? `${chosen.middle_name} ${chosen.last_name}` : chosen.last_name;
        chosen.middle_name = middle.trim();
        chosen.last_name = fallback;
      }
    }
    return { valid: true, owner: chosen };
  }

  if (fallbackLastName) {
    const fallbackPerson = buildPerson({
      first: remainingTokens[0],
      middle: remainingTokens.slice(1).join(" ") || null,
      last: fallbackLastName,
      prefix,
      suffix: allSuffixes,
    });
    if (fallbackPerson) return { valid: true, owner: fallbackPerson };
  }

  return { valid: false, reason: "unable_to_classify_person", raw: base };
}

function buildOwnerKey(owner) {
  if (!owner) return null;
  if (owner.type === "company") {
    const name = normalizeWhitespace(owner.name || "").toUpperCase();
    return name ? `COMPANY:${name}` : null;
  }
  const first = normalizeWhitespace(owner.first_name || "").toUpperCase();
  const middle = normalizeWhitespace(owner.middle_name || "").toUpperCase();
  const last = normalizeWhitespace(owner.last_name || "").toUpperCase();
  if (!first || !last) return null;
  return `PERSON:${first}|${middle}|${last}`;
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    const key = buildOwnerKey(o);
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
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
    const addressSpan = $(el).find("span[id$='lblOwnerAddress']");
    let mailingAddress = null;
    if (addressSpan.length) {
      let html = addressSpan.html() || "";
      html = html.replace(/<br\s*\/?>/gi, ", ");
      html = html.replace(/&nbsp;/gi, " ");
      mailingAddress = normalizeWhitespace(html.replace(/&amp;/gi, "&"))
        .replace(/\s*,\s*/g, ", ")
        .replace(/,\s*$/, "");
      if (mailingAddress === "") mailingAddress = null;
    }
    $(el)
      .find("a[id*='sprOwnerName'], span[id*='sprOwnerName']")
      .each((_, node) => {
        const text = txt($(node).text());
        if (text && !/primary/i.test(text)) {
          owners.push({ name: text, mailingAddress: mailingAddress || null });
        }
      });
  });
  return owners;
}

function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tdate = $tr.find("td").first();
    const tds = $tr.find("td");
    const saleDateRaw = txt(tdate.text());
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

function resolveOwnersFromRawStrings(rawStrings, invalidCollector, options = {}) {
  const { addressLookup, assignmentMap } = options;
  const owners = [];
  for (const raw of rawStrings) {
    const parts = splitCompositeNames(raw);
    if (parts.length === 0) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      continue;
    }
    let sharedLastName = null;
    for (const part of parts) {
      const res = classifyOwner(part, sharedLastName);
      if (res.valid) {
        owners.push(res.owner);
        if (res.owner.type === "person" && res.owner.last_name) {
          sharedLastName = res.owner.last_name;
        }
        if (assignmentMap) {
          const cleanedPart = cleanRawName(part);
          const address =
            addressLookup &&
            (addressLookup.get(cleanedPart) ??
              addressLookup.get(part) ??
              null);
          if (address && address.trim()) {
            const key = buildOwnerKey(res.owner);
            if (key && !assignmentMap.has(key)) {
              assignmentMap.set(key, {
                type: res.owner.type,
                unnormalized_address: address.trim(),
              });
            }
          }
        }
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
const currentOwnerEntries = extractCurrentOwners($);
const currentOwnerRaw = currentOwnerEntries.map((entry) => entry.name);
const ownerAddressLookup = new Map();
currentOwnerEntries.forEach((entry) => {
  if (!entry) return;
  const address = entry.mailingAddress || null;
  if (address) {
    ownerAddressLookup.set(entry.name, address);
    ownerAddressLookup.set(cleanRawName(entry.name), address);
  }
});
const { map: salesMap } = extractSalesOwnersByDate($);

const invalid_owners = [];
const dates = Object.keys(salesMap).sort();
const owners_by_date = {};
for (const d of dates) {
  const owners = resolveOwnersFromRawStrings(salesMap[d], invalid_owners);
  if (owners.length > 0) {
    owners_by_date[d] = owners;
  }
}

// Prior owners are not appended when they do not match known grantee sets.

const mailingAssignments = new Map();
const currentOwnersStructured = resolveOwnersFromRawStrings(
  currentOwnerRaw,
  invalid_owners,
  { addressLookup: ownerAddressLookup, assignmentMap: mailingAssignments },
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
const mailingAddresses = Array.from(mailingAssignments.entries())
  .filter(
    ([, data]) =>
      data &&
      typeof data.unnormalized_address === "string" &&
      data.unnormalized_address.trim(),
  )
  .map(([owner_key, data]) => ({
    owner_key,
    type: data.type,
    unnormalized_address: data.unnormalized_address,
  }));
output[propKey] = {
  owners_by_date: orderedOwnersByDate,
  mailing_addresses: mailingAddresses,
};

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
