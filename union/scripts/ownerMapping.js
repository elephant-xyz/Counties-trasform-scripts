const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility helpers
const collapseWs = (s) => (s || "").replace(/\s+/g, " ").trim();
const lower = (s) => collapseWs(s).toLowerCase();

const NAME_PREFIXES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "doctor",
  "rev",
  "reverend",
  "pastor",
  "bishop",
  "prof",
  "professor",
  "hon",
  "judge",
  "sir",
  "madam",
  "capt",
  "captain",
  "sgt",
  "sergeant",
  "lt",
  "lieutenant",
  "col",
  "colonel",
  "maj",
  "major",
  "gen",
  "general",
]);

const NAME_SUFFIXES = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  // Note: v, vi, vii, viii, ix, x will be recognized but mapped to null - not valid in Elephant schema
  "esq",
  "esquire",
  "md",
  "phd",
  "dds",
  "dmd",
  "do",
  "jd",
  "llm",
  "cpa",
  "pa",
  "dea",
  "et al",
  "etal",
]);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PREFIX_PATTERN = new RegExp(
  `^(${Array.from(NAME_PREFIXES)
    .map(escapeRegex)
    .join("|")})\\.?\\s+`,
  "i",
);

const SUFFIX_PATTERN = new RegExp(
  `\\s+(${Array.from(NAME_SUFFIXES)
    .map((value) =>
      value
        .trim()
        .split(/\s+/)
        .map((segment) => escapeRegex(segment))
        .join("\\s+"),
    )
    .join("|")})\\.?$`,
  "i",
);

function toIsoDate(mdy) {
  if (!mdy) return null;
  const parts = String(mdy)
    .trim()
    .split(/[\/\-]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length !== 3) return null;
  let [m, d, y] = parts;
  if (y.length === 2) {
    const yr = Number(y);
    y = (yr > 50 ? "19" : "20") + y;
  }
  const month = String(Number(m) || 0).padStart(2, "0");
  const day = String(Number(d) || 0).padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12) return null;
  if (Number(day) < 1 || Number(day) > 31) return null;
  return `${y}-${month}-${day}`;
}

function formatToken(token) {
  if (!token) return "";

  // Handle single-letter abbreviations like "V." - remove the period
  // Pattern: single uppercase letter followed by period
  if (/^[A-Z]\.$/.test(token)) {
    return token.replace(/\.$/, "");
  }

  // Handle abbreviations like "L.A." - preserve uppercase letters followed by periods
  // Pattern: single uppercase letter followed by period, repeated
  if (/^([A-Z]\.)+$/.test(token)) {
    // Remove trailing period to match schema pattern: "L.A." -> "L.A"
    return token.replace(/\.$/, "");
  }

  return token
    .split(/([-'])/)
    .map((segment) => {
      if (segment === "-" || segment === "'") return segment;
      if (!segment) return "";
      return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
    })
    .join("");
}

function formatNameValue(value) {
  if (!value) return null;
  let formatted = value
    .split(/\s+/)
    .filter(Boolean)
    .map(formatToken)
    .join(" ")
    .trim();

  // Remove leading special characters to match schema pattern ^[A-Z]
  while (formatted && /^[\-', .]/.test(formatted)) {
    formatted = formatted.slice(1).trim();
  }

  // Remove trailing special characters
  while (formatted && /[\-', .]$/.test(formatted)) {
    formatted = formatted.slice(0, -1).trim();
  }

  return formatted || null;
}

function formatSuffixValue(value) {
  if (!value) return null;
  const trimmed = value.replace(/\./g, "").replace(/,/g, "").trim();
  if (!trimmed) return null;

  // Check for "et al" variations - these are not valid suffixes
  if (/^et\s*al$/i.test(trimmed)) {
    return null;
  }

  // Map suffixes to Elephant schema enum values
  // Only include suffixes that are allowed by the Elephant schema
  const suffixMap = {
    'JR': 'Jr.',
    'Jr': 'Jr.',
    'jr': 'Jr.',
    'SR': 'Sr.',
    'Sr': 'Sr.',
    'sr': 'Sr.',
    'II': 'II',
    'III': 'III',
    'IV': 'IV',
    // Note: V, VI, VII, VIII, IX, X are NOT in the Elephant schema, so they are omitted
    'PHD': 'PhD',
    'PhD': 'PhD',
    'phd': 'PhD',
    'MD': 'MD',
    'Md': 'MD',
    'md': 'MD',
    'ESQ': 'Esq.',
    'Esq': 'Esq.',
    'esq': 'Esq.',
    'ESQUIRE': 'Esq.',
    'Esquire': 'Esq.',
    'esquire': 'Esq.',
    'JD': 'JD',
    'Jd': 'JD',
    'jd': 'JD',
    'LLM': 'LLM',
    'Llm': 'LLM',
    'llm': 'LLM',
    'MBA': 'MBA',
    'Mba': 'MBA',
    'mba': 'MBA',
    'RN': 'RN',
    'Rn': 'RN',
    'rn': 'RN',
    'DDS': 'DDS',
    'Dds': 'DDS',
    'dds': 'DDS',
    'DVM': 'DVM',
    'Dvm': 'DVM',
    'dvm': 'DVM',
    'DMD': 'DDS',
    'Dmd': 'DDS',
    'dmd': 'DDS',
    'DO': 'MD',
    'Do': 'MD',
    'do': 'MD',
    'CFA': 'CFA',
    'Cfa': 'CFA',
    'cfa': 'CFA',
    'CPA': 'CPA',
    'Cpa': 'CPA',
    'cpa': 'CPA',
    'PA': 'CPA',
    'Pa': 'CPA',
    'pa': 'CPA',
    'PE': 'PE',
    'Pe': 'PE',
    'pe': 'PE',
    'PMP': 'PMP',
    'Pmp': 'PMP',
    'pmp': 'PMP',
    'EMERITUS': 'Emeritus',
    'Emeritus': 'Emeritus',
    'emeritus': 'Emeritus',
    'RET': 'Ret.',
    'Ret': 'Ret.',
    'ret': 'Ret.',
    'RETIRED': 'Ret.',
    'Retired': 'Ret.',
    'retired': 'Ret.',
  };

  const upper = trimmed.toUpperCase();

  // Check if it's in the suffix map with uppercase first
  if (suffixMap[upper]) {
    return suffixMap[upper];
  }

  // Check with original case as fallback
  if (suffixMap[trimmed]) {
    return suffixMap[trimmed];
  }

  // Additional safety check: if the value is literally "Jr" without period, return "Jr."
  // This should never happen due to the mappings above, but acts as a failsafe
  if (trimmed === 'Jr') return 'Jr.';
  if (trimmed === 'Sr') return 'Sr.';

  // If not in map, return null (unknown suffix)
  return null;
}

function formatPrefixValue(value) {
  if (!value) return null;
  const trimmed = value.replace(/\./g, "").replace(/,/g, "").trim();
  if (!trimmed) return null;

  // Map prefixes to Elephant schema enum values
  // Only include prefixes that are allowed by the Elephant schema
  const prefixMap = {
    'MR': 'Mr.',
    'Mr': 'Mr.',
    'mr': 'Mr.',
    'MRS': 'Mrs.',
    'Mrs': 'Mrs.',
    'mrs': 'Mrs.',
    'MS': 'Ms.',
    'Ms': 'Ms.',
    'ms': 'Ms.',
    'MISS': 'Miss',
    'Miss': 'Miss',
    'miss': 'Miss',
    'MX': 'Mx.',
    'Mx': 'Mx.',
    'mx': 'Mx.',
    'DR': 'Dr.',
    'Dr': 'Dr.',
    'dr': 'Dr.',
    'DOCTOR': 'Dr.',
    'Doctor': 'Dr.',
    'doctor': 'Dr.',
    'PROF': 'Prof.',
    'Prof': 'Prof.',
    'prof': 'Prof.',
    'PROFESSOR': 'Prof.',
    'Professor': 'Prof.',
    'professor': 'Prof.',
    'REV': 'Rev.',
    'Rev': 'Rev.',
    'rev': 'Rev.',
    'REVEREND': 'Rev.',
    'Reverend': 'Rev.',
    'reverend': 'Rev.',
    'FR': 'Fr.',
    'Fr': 'Fr.',
    'fr': 'Fr.',
    'FATHER': 'Fr.',
    'Father': 'Fr.',
    'father': 'Fr.',
    'SR': 'Sr.',
    'SISTER': 'Sr.',
    'Sister': 'Sr.',
    'sister': 'Sr.',
    'BR': 'Br.',
    'Br': 'Br.',
    'br': 'Br.',
    'BROTHER': 'Br.',
    'Brother': 'Br.',
    'brother': 'Br.',
    'CAPT': 'Capt.',
    'Capt': 'Capt.',
    'capt': 'Capt.',
    'CAPTAIN': 'Capt.',
    'Captain': 'Capt.',
    'captain': 'Capt.',
    'COL': 'Col.',
    'Col': 'Col.',
    'col': 'Col.',
    'COLONEL': 'Col.',
    'Colonel': 'Col.',
    'colonel': 'Col.',
    'MAJ': 'Maj.',
    'Maj': 'Maj.',
    'maj': 'Maj.',
    'MAJOR': 'Maj.',
    'Major': 'Maj.',
    'major': 'Maj.',
    'LT': 'Lt.',
    'Lt': 'Lt.',
    'lt': 'Lt.',
    'LIEUTENANT': 'Lt.',
    'Lieutenant': 'Lt.',
    'lieutenant': 'Lt.',
    'SGT': 'Sgt.',
    'Sgt': 'Sgt.',
    'sgt': 'Sgt.',
    'SERGEANT': 'Sgt.',
    'Sergeant': 'Sgt.',
    'sergeant': 'Sgt.',
    'HON': 'Hon.',
    'Hon': 'Hon.',
    'hon': 'Hon.',
    'HONORABLE': 'Hon.',
    'Honorable': 'Hon.',
    'honorable': 'Hon.',
    'JUDGE': 'Judge',
    'Judge': 'Judge',
    'judge': 'Judge',
    'RABBI': 'Rabbi',
    'Rabbi': 'Rabbi',
    'rabbi': 'Rabbi',
    'IMAM': 'Imam',
    'Imam': 'Imam',
    'imam': 'Imam',
    'SHEIKH': 'Sheikh',
    'Sheikh': 'Sheikh',
    'sheikh': 'Sheikh',
    'SIR': 'Sir',
    'Sir': 'Sir',
    'sir': 'Sir',
    'DAME': 'Dame',
    'Dame': 'Dame',
    'dame': 'Dame',
  };

  const upper = trimmed.toUpperCase();

  // Check if it's in the prefix map with uppercase first
  if (prefixMap[upper]) {
    return prefixMap[upper];
  }

  // Check with original case as fallback
  if (prefixMap[trimmed]) {
    return prefixMap[trimmed];
  }

  // If not in map, return null (unknown prefix like "Bishop")
  return null;
}

function stripNameAffixes(name) {
  let working = collapseWs(name);
  let prefix = null;
  let suffix = null;

  while (true) {
    const match = working.match(PREFIX_PATTERN);
    if (!match) break;
    prefix = prefix || match[1];
    working = working.slice(match[0].length).trim();
  }

  while (true) {
    const match = working.match(SUFFIX_PATTERN);
    if (!match) break;
    suffix = suffix ? `${match[1]} ${suffix}` : match[1];
    working = working
      .slice(0, working.length - match[0].length)
      .trim()
      .replace(/,+$/, "")
      .trim();
  }

  return { core: working, prefix, suffix };
}

const looksLikeCompany = (raw) => {
  const s = lower(raw);
  const keywords = [
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
    "estate",
    "associates",
    "holdings",
    "properties",
    "management",
    "group",
    "partners",
    "lp",
    "llp",
    "plc",
    "bank",
    "association",
    "church",
    "university",
    "college",
    "hospital",
    "authority",
    "company",
    "enterprises",
    "industries",
    "limited",
    "ministries",
    "pc",
    "pllc",
    "pl",
    "pa",
  ];
  return keywords.some((k) =>
    new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, "i").test(s),
  );
};

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

function parsePersonNameBasic(name) {
  const cleaned = cleanInvalidCharsFromName(name);
  if (!cleaned) return null;

  const { core, prefix, suffix } = stripNameAffixes(cleaned);
  if (!core) return null;

  const normalized = core.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  let firstName = null;
  let lastName = null;
  let middleName = null;

  if (normalized.includes(",")) {
    const [lastSegment, restSegment] = normalized.split(",", 2).map(collapseWs);
    if (!lastSegment || !restSegment) return null;
    const restTokens = restSegment.split(/\s+/).filter(Boolean).map(token => {
      let cleaned = token;
      while (cleaned && /^[\-', .#0-9]/.test(cleaned)) {
        cleaned = cleaned.slice(1);
      }
      while (cleaned && /[\-', .]$/.test(cleaned)) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    }).filter(Boolean);
    if (restTokens.length === 0) return null;

    // Check if lastSegment has multiple words - if so, only the first word is the last name
    const lastTokens = lastSegment.split(/\s+/).filter(Boolean).map(token => {
      let cleaned = token;
      while (cleaned && /^[\-', .#0-9]/.test(cleaned)) {
        cleaned = cleaned.slice(1);
      }
      while (cleaned && /[\-', .]$/.test(cleaned)) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    }).filter(Boolean);
    if (lastTokens.length > 1) {
      // Format like "TUCKER LOIS G., VINCENT" where TUCKER is last name, LOIS G. are first/middle
      lastName = lastTokens[0];
      firstName = lastTokens[1];
      // Combine remaining tokens from lastSegment with restSegment if needed
      const remainingFromLast = lastTokens.slice(2);
      if (remainingFromLast.length > 0) {
        middleName = remainingFromLast.join(" ");
      } else {
        middleName = null;
      }
      // Note: restSegment (VINCENT) represents another person, not part of this person
      // So we ignore it here and let the ampersand parser handle it
      // But if this is being called from a non-ampersand context, we need to use restSegment as firstName
      // Check if this looks like a multi-person format by seeing if restSegment is a simple first name
      if (restTokens.length === 1 && remainingFromLast.length === 0) {
        // Simple format: "Last, First" - use restSegment
        firstName = restTokens[0];
        middleName = null;
      }
    } else {
      // Standard "Last, First Middle" format
      firstName = restTokens[0];
      middleName = restTokens.slice(1).join(" ") || null;
      lastName = lastSegment;
    }
  } else {
    const tokens = normalized.split(/\s+/).filter(Boolean).map(token => {
      // Remove leading and trailing special characters from each token
      let cleaned = token;
      while (cleaned && /^[\-', .#0-9]/.test(cleaned)) {
        cleaned = cleaned.slice(1);
      }
      while (cleaned && /[\-', .]$/.test(cleaned)) {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    }).filter(Boolean);
    if (tokens.length < 2) return null;
    const allUpper = tokens.every((token) => token === token.toUpperCase());
    if (allUpper) {
      lastName = tokens[0];
      firstName = tokens[1];
      middleName = tokens.slice(2).join(" ") || null;
    } else {
      firstName = tokens[0];
      lastName = tokens[tokens.length - 1];
      middleName = tokens.slice(1, -1).join(" ") || null;
    }
  }

  if (!firstName || !lastName) return null;

  const formattedFirst = formatNameValue(firstName);
  const formattedLast = formatNameValue(lastName);
  const formattedMiddle = middleName ? formatNameValue(middleName) : null;

  if (!formattedFirst || !formattedLast) return null;

  return {
    type: "person",
    first_name: formattedFirst,
    last_name: formattedLast,
    middle_name: formattedMiddle || null,
    prefix_name: prefix ? formatPrefixValue(prefix) : null,
    suffix_name: suffix ? formatSuffixValue(suffix) : null,
  };
}

function parseAmpersandNames(raw, mailingAddress) {
  const normalized = collapseWs(raw);
  if (!normalized) return [];
  if (!/(?:\s&\s|\sand\s|\/)/i.test(normalized)) return [];

  const unified = normalized
    .replace(/\s+AND\s+/gi, " & ")
    .replace(/\s*\/\s*/g, " & ");
  const parts = unified.split("&").map(collapseWs).filter(Boolean);
  if (parts.length !== 2) return [];

  const [leftPart, rightPart] = parts;
  const leftTokens = leftPart.split(/\s+/).filter(Boolean);
  const rightTokens = rightPart.split(/\s+/).filter(Boolean);
  if (leftTokens.length === 0 || rightTokens.length === 0) return [];

  let left = parsePersonNameBasic(leftPart);
  let right = parsePersonNameBasic(rightPart);

  if (left && right) return [left, right];

  if ((!left || !left.last_name) && rightTokens.length > 0) {
    const assumedLast = rightTokens[rightTokens.length - 1];
    left = parsePersonNameBasic(`${leftPart} ${assumedLast}`);
  }
  if ((!right || !right.last_name) && leftTokens.length > 0) {
    const assumedLast = leftTokens[leftTokens.length - 1];
    right = parsePersonNameBasic(`${rightPart} ${assumedLast}`);
  }

  if (left && right) {
    left.mailing_address =
      mailingAddress != null ? collapseWs(mailingAddress) : null;
    right.mailing_address =
      mailingAddress != null ? collapseWs(mailingAddress) : null;
    return [left, right];
  }
  return [];
}

function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return lower(owner.name);
  if (owner.type === "person") {
    return lower(
      [
        owner.prefix_name || "",
        owner.first_name,
        owner.middle_name || "",
        owner.last_name,
        owner.suffix_name || "",
      ]
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  return "";
}

function extractOwnerCandidates($) {
  const candidates = [];

  function pushCandidate(rawName, mailingAddress) {
    const name = collapseWs(rawName);
    if (!name) return;
    candidates.push({
      rawName: name,
      mailingAddress: mailingAddress ? collapseWs(mailingAddress) : null,
    });
  }

  // 1) From explicit Owner label cells
  $("td").each((i, el) => {
    const txt = collapseWs($(el).text()).toLowerCase();
    if (txt === "owner") {
      const valTd = $(el).next("td");
      if (valTd && valTd.length) {
        const rawHtml = valTd.html() || "";
        const parts = rawHtml
          .split(/<br\s*\/?>/i)
          .map((part) =>
            collapseWs(
              cheerio.load(`<div>${part}</div>`)("div").text() ||
                cheerio.load(`<span>${part}</span>`)("span").text(),
            ),
          )
          .filter(Boolean);
        if (parts.length > 0) {
          const name = parts[0];
          const mailingAddress =
            parts.length > 1 ? parts.slice(1).join(", ") : null;
          pushCandidate(name, mailingAddress);
        } else {
          const rawCellText = collapseWs(valTd.text());
          if (rawCellText) pushCandidate(rawCellText, null);
        }
      }
    }
  });

  // 2) Hidden field: strOwner
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner) pushCandidate(strOwner, null);

  // De-duplicate by lowercased name, preferring entries with mailing addresses
  const uniq = new Map();
  for (const candidate of candidates) {
    const key = lower(candidate.rawName);
    if (!key) continue;
    if (!uniq.has(key)) {
      uniq.set(key, candidate);
    } else {
      const existing = uniq.get(key);
      if (!existing.mailingAddress && candidate.mailingAddress) {
        uniq.set(key, candidate);
      }
    }
  }
  return Array.from(uniq.values());
}

function classifyOwners(entries) {
  const validOwners = [];
  const invalidOwners = [];

  for (const entry of entries) {
    const raw = entry.rawName;
    const mailingAddress =
      entry.mailingAddress != null ? collapseWs(entry.mailingAddress) : null;
    const s = collapseWs(raw);
    if (!s) continue;

    // Check for "et al" variations including "ET. AL." with periods
    const hasEtAl = /\bet\.?\s*al\.?\b/i.test(s);

    // If contains "et al", mark as invalid and skip parsing
    if (hasEtAl) {
      invalidOwners.push({
        raw: s,
        reason: "contains_et_al",
      });
      continue;
    }

    if (!looksLikeCompany(s) && /(?:\s&\s|\sand\s|\/)/i.test(s)) {
      const people = parseAmpersandNames(s, mailingAddress);
      if (people.length) {
        for (const p of people) validOwners.push(p);
      } else {
        invalidOwners.push({
          raw: s,
          reason: "ambiguous_joint_owner_string",
        });
      }
      continue;
    }

    if (looksLikeCompany(s)) {
      validOwners.push({
        type: "company",
        name: collapseWs(s),
        mailing_address: mailingAddress,
      });
      continue;
    }

    const person = parsePersonNameBasic(s);
    if (person) {
      person.mailing_address = mailingAddress;
      validOwners.push(person);
    } else {
      invalidOwners.push({ raw: s, reason: "unclassifiable_owner" });
    }
  }

  // Deduplicate by normalized key, preserving richer mailing data
  const dedupedMap = new Map();
  for (const o of validOwners) {
    const key = normalizeOwnerKey(o);
    if (!key) continue;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, o);
    } else {
      const existing = dedupedMap.get(key);
      if (!existing.mailing_address && o.mailing_address) {
        existing.mailing_address = o.mailing_address;
      }
      if (!existing.prefix_name && o.prefix_name) {
        existing.prefix_name = formatPrefixValue(o.prefix_name);
      }
      if (!existing.suffix_name && o.suffix_name) {
        existing.suffix_name = formatSuffixValue(o.suffix_name);
      }
      if (!existing.middle_name && o.middle_name) {
        existing.middle_name = o.middle_name;
      }
    }
  }
  const deduped = Array.from(dedupedMap.values());

  return { owners: deduped, invalid: invalidOwners };
}

function cloneOwners(list) {
  return (list || []).map((owner) => ({ ...owner }));
}

function extractLatestSaleDate($) {
  const salesTable = $(
    "#parcelDetails_SalesTable table.parcelDetails_insideTable",
  ).first();
  if (!salesTable || salesTable.length === 0) return null;
  const rows = salesTable.find("tr").slice(1);
  for (let i = 0; i < rows.length; i += 1) {
    const cells = $(rows[i]).find("td");
    if (cells.length === 0) continue;
    const dateText = collapseWs($(cells[0]).text());
    if (!dateText) continue;
    const iso = toIsoDate(dateText);
    if (iso) return iso;
  }
  return null;
}

function extractPropertyId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

// Build owners_by_date structure
const rawOwnerNames = extractOwnerCandidates($);
const { owners: currentOwners, invalid: invalidOwners } =
  classifyOwners(rawOwnerNames);

const owners_by_date = {};
const currentOwnersClone = cloneOwners(currentOwners);
owners_by_date.current = currentOwnersClone;

const latestSaleIso = extractLatestSaleDate($);
if (latestSaleIso && currentOwners.length > 0) {
  owners_by_date[latestSaleIso] = cloneOwners(currentOwners);
}

// Compose final object
const propId = extractPropertyId($);
const topKey = `property_${propId || "unknown_id"}`;
const output = {};
output[topKey] = { owners_by_date };
output[topKey].invalid_owners = invalidOwners; // store invalids per property scope

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON result
console.log(JSON.stringify(output, null, 2));
