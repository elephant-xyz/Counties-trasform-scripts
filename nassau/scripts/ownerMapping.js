const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
function normalizeSpace(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

// Utility: clean name by removing legal designations and invalid characters
function cleanNameString(name) {
  if (!name) return null;

  // Remove common legal designations that may contain invalid characters
  let cleaned = name.trim();
  const original = cleaned;

  // First pass: Remove slashes and common legal designation patterns
  // Replace forward slashes with spaces first (e.g., "B L/E" becomes "B L E")
  cleaned = cleaned.replace(/\//g, ' ');

  const legalDesignations = [
    /\bL\s*E\b/gi,          // Life Estate (now without slash: "L E" or "LE")
    /\bLE\b/gi,             // Life Estate abbreviation
    /\bP\s*R\b/gi,          // Personal Representative (now without slash: "P R" or "PR")
    /\bPR\b/gi,             // Personal Representative abbreviation
    /\bF\s*B\s*O\b/gi,      // For Benefit Of (now without slashes)
    /\bFBO\b/gi,            // For Benefit Of abbreviation
    /\bET\s+AL\b/gi,        // Et Al
    /\bETAL\b/gi,           // Etal
    /\bLIFE\s+ESTATE\b/gi,  // Life Estate
    /\bTRUSTEE\b/gi,        // Trustee
    /\bTTE\b/gi,            // Trustee abbreviation
  ];

  legalDesignations.forEach(pattern => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  // Remove any content within parentheses first
  // First remove properly closed parentheses
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');  // Remove content in properly closed parentheses
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');  // Remove content in properly closed square brackets
  cleaned = cleaned.replace(/\{[^}]*\}/g, ' ');   // Remove content in properly closed curly braces

  // Then remove any unclosed parentheses and everything after them until a space or end
  cleaned = cleaned.replace(/\([^\s)]*(?:\s|$)/g, ' ');  // Remove unclosed opening parens and content
  cleaned = cleaned.replace(/\[[^\s\]]*(?:\s|$)/g, ' ');  // Remove unclosed opening brackets and content
  cleaned = cleaned.replace(/\{[^\s}]*(?:\s|$)/g, ' ');   // Remove unclosed opening braces and content

  // Then explicitly remove any remaining parentheses and other common unwanted characters
  // Remove all types of parentheses: (), [], {}, and any Unicode variants
  cleaned = cleaned.replace(/[()[\]{}]/g, '');

  // Remove any remaining characters that don't match the person name pattern
  // Allow: letters, spaces, hyphens, apostrophes, commas, periods
  cleaned = cleaned.replace(/[^a-zA-Z\s\-',.]/g, '');

  // Remove trailing punctuation (hyphens, apostrophes, commas, periods at the end)
  // The Elephant schema requires that separators must be followed by letters
  cleaned = cleaned.replace(/[\-',.]+$/g, '');

  // Also remove leading punctuation
  cleaned = cleaned.replace(/^[\-',.]+/g, '');

  return cleaned.trim().replace(/\s+/g, ' ');
}

// Utility: title-case words conservatively (keep all-caps acronyms)
function titleCase(str) {
  // First clean the string
  const cleaned = cleanNameString(str);
  return (cleaned || "")
    .toLowerCase()
    .replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
}

// Extract property id
function extractPropertyId($) {
  // Identify parcel identifier from HTML

  const parcelHeader = $("section.title h1").first().text().trim();
  // console.log("parcelHeader>>>",parcelHeader)

  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);  // Capture everything after "Parcel"
  // console.log("m>>>", m);

  if (m) parcelIdentifier = m[1];

  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  // console.log("Final parcelIdentifier>>>", parcelIdentifier);
  return parcelIdentifier;
}
const propId = extractPropertyId($);

// Corporate/company detection keywords (broad). Note: exclude 'trustee' to avoid false positives like 'TRUSTEE OF THE'.
const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "co",
  "company",
  "corp",
  "corporation",
  "plc",
  "pc",
  "p.c.",
  "pllc",
  "llp",
  "lp",
  "trust",
  "tr",
  "foundation",
  "fund",
  "partners",
  "partnership",
  "holdings",
  "holding",
  "association",
  "associates",
  "properties",
  "property",
  "realty",
  "investments",
  "investment",
  "bank",
  "n.a.",
  "na",
  "solutions",
  "services",
  "ministries",
  "church",
  "school",
  "district",
  "builders",
  "construction",
  "contractors",
  "developments",
  "development",
  "dev",
  "enterprises",
  "enterprise",
  "management",
  "mgmt",
  "group",
  "alliance",
];

function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  // More strict matching - require word boundaries for most keywords
  const strictKeywords = [
    "\\binc\\b", "\\bllc\\b", "\\bl\\.l\\.c\\b", "\\bltd\\b", "\\bcorp\\b", "\\bcorporation\\b",
    "\\bplc\\b", "\\bpc\\b", "\\bp\\.c\\.\\b", "\\bpllc\\b", "\\bllp\\b", "\\blp\\b", "\\bco\\b",
    "\\btrust\\b", "\\btr\\b", "\\bfoundation\\b", "\\bfund\\b", "\\bpartnership\\b",
    "\\bholdings\\b", "\\bholding\\b", "\\bassociation\\b", "\\bassociates\\b",
    "\\bbank\\b", "\\bn\\.a\\.\\b", "\\bna\\b", "\\bchurch\\b", "\\bschool\\b", "\\bdistrict\\b"
  ];
  
  // Check for strict keyword matches
  for (const pattern of strictKeywords) {
    if (new RegExp(pattern, 'i').test(n)) return true;
  }
  
  // Only return true for obvious company patterns, not person names
  return false;
}

// Parse possible multiple owners joined by '&', ' and ', or '/'
function splitJointOwners(raw) {
  let s = normalizeSpace(raw).replace(/&amp;/g, '&').replace(/\s*\([^)]*\)\s*/g, ' ');
  if (!s) return [];

  // Remove legal designations that contain "/" before splitting
  // This prevents "L/E" from being treated as a delimiter
  s = s.replace(/\s+L\/E\s*$/gi, '');  // Life Estate at end
  s = s.replace(/\s+L\/E\s+/gi, ' ');  // Life Estate in middle
  s = s.replace(/^L\/E\s+/gi, '');     // Life Estate at start

  // Filter out property/condo references that contain slashes
  // Pattern: name/PROPERTY NAME (e.g., "MARILYN/KETCH COURTYARD I")
  // These are property references, not person names
  s = s.replace(/\b[A-Z]+\/[A-Z]+(?:\s+[A-Z]+)*(?:\s+[IVX]+)?\b/g, '');

  // Replace "/" with space when it appears between name parts (compound surnames like "BAEZ/DELGADO")
  // Only do this for simple two-word patterns that look like surnames
  // Pattern: Single word / Single word (not followed by more uppercase words)
  s = s.replace(/\b([A-Z][a-z]+)\s*\/\s*([A-Z][a-z]+)(?!\s+[A-Z])/g, '$1 $2');

  // Split on &, ' and ' while preserving meaningful tokens
  // Note: We removed "/" from the split pattern since we now treat it as part of compound names
  const parts = s
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((p) => normalizeSpace(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

// Detect if a string looks like a person name
function looksLikePerson(name) {
  const s = normalizeSpace(name);
  if (!s) return false;
  if (isCompanyName(s)) return false;
  // Discard obvious non-names (has digits, except for suffixes like "III")
  if (/\d/.test(s) && !/\b(II|III|IV|V|JR|SR)\b/i.test(s)) return false;
  const tokens = s.split(" ");
  // Typical person patterns: 2-4 tokens for names like "SMITH JOHN" or "JOHN SMITH" or "SMITH JOHN M"
  if (tokens.length < 2 || tokens.length > 5) return false;
  
  // All tokens should look like name parts (alphabetic, possibly with common name punctuation)
  return tokens.every(token => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
}

// Validate prefix/suffix against schema
function validatePrefix(prefix) {
  const validPrefixes = ["Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof.", "Rev.", "Fr.", "Sr.", "Br.", "Capt.", "Col.", "Maj.", "Lt.", "Sgt.", "Hon.", "Judge", "Rabbi", "Imam", "Sheikh", "Sir", "Dame"];
  return validPrefixes.find(p => p.toLowerCase() === prefix.toLowerCase()) || null;
}

function validateSuffix(suffix) {
  const validSuffixes = ["Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM", "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."];
  return validSuffixes.find(s => s.toLowerCase() === suffix.toLowerCase()) || null;
}

// Build a person object using inferred pattern
function buildPerson(first, last, middle, prefix, suffix) {
  // Clean and validate each name component
  const cleanFirst = cleanNameString(first);
  const cleanLast = cleanNameString(last);
  const cleanMiddle = middle ? cleanNameString(middle) : null;

  // If cleaning removed all content, return null for that field
  if (!cleanFirst || !cleanLast) return null;

  // Title case the names
  const titleFirst = titleCase(cleanFirst);
  const titleLast = titleCase(cleanLast);
  let titleMiddle = cleanMiddle ? titleCase(cleanMiddle) : null;

  // Validate middle name against Elephant schema pattern - if invalid, set to null
  if (titleMiddle) {
    const elephantNamePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
    if (!elephantNamePattern.test(titleMiddle)) {
      titleMiddle = null;
    }

    // Additional check: reject middle names that are legal designations or contain slashes
    // Even after cleaning, ensure no "/" remains (in case cleaning didn't catch it)
    if (titleMiddle && /\//.test(titleMiddle)) {
      titleMiddle = null;
    }

    // Reject if it matches common legal designation patterns
    if (titleMiddle && /^(L\s*E|P\s*R|F\s*B\s*O|ET\s*AL|ETAL)$/i.test(titleMiddle.trim())) {
      titleMiddle = null;
    }

    // Reject single-letter middle names (likely remnants of legal designations like "L" from "L/E")
    if (titleMiddle && titleMiddle.trim().length === 1) {
      titleMiddle = null;
    }
  }

  return {
    type: "person",
    first_name: titleFirst,
    last_name: titleLast,
    middle_name: titleMiddle,
    prefix_name: prefix ? validatePrefix(prefix) : null,
    suffix_name: suffix ? validateSuffix(suffix) : null,
  };
}

// Build person object from a tokenized name. Each name is parsed independently
function parsePerson(name) {
  const s = normalizeSpace(name).replace(/\s+,\s+/g, ", ");
  const upper = s === s.toUpperCase();
  let tokens = s.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  // Extract prefix (schema-compliant values)
  const prefixes = ["Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof.", "Rev.", "Fr.", "Sr.", "Br.", "Capt.", "Col.", "Maj.", "Lt.", "Sgt.", "Hon.", "Judge", "Rabbi", "Imam", "Sheikh", "Sir", "Dame"];
  let prefix = null;
  if (tokens.length > 0) {
    const foundPrefix = prefixes.find(p => tokens[0].toLowerCase() === p.toLowerCase());
    if (foundPrefix) {
      prefix = foundPrefix;
      tokens.shift();
    }
  }

  // Extract suffix (schema-compliant values, check all positions)
  const suffixes = ["Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM", "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."];
  let suffix = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const foundSuffix = suffixes.find(s => tokens[i].toLowerCase() === s.toLowerCase() || (s === "Jr." && tokens[i].toLowerCase() === "jr") || (s === "Sr." && tokens[i].toLowerCase() === "sr"));
    if (foundSuffix) {
      suffix = foundSuffix;
      tokens.splice(i, 1);
      break;
    }
  }

  if (tokens.length < 2) return null;

  if (upper) {
    // Assume LAST FIRST [MIDDLE] for uppercase names
    const last = tokens[0];
    const first = tokens[1] || null;
    const middle = tokens.length >= 3 ? tokens.slice(2).join(" ") : null;
    if (!first || !last) return null;
    return buildPerson(first, last, middle, prefix, suffix);
  } else {
    // Assume FIRST [MIDDLE] LAST for mixed case names
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null;
    if (!first || !last) return null;
    return buildPerson(first, last, middle, prefix, suffix);
  }
}

// Deduplicate owners by normalized name
function ownerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return "company|" + normalizeSpace(owner.name).toLowerCase();
  const mid = owner.middle_name ? " " + owner.middle_name : "";
  return (
    "person|" +
    [owner.first_name, owner.last_name, mid]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}

function dedupeOwners(arr) {
  const out = [];
  const seen = new Set();
  for (const o of arr) {
    const k = ownerKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

// Extract current owner candidates from the Owners section
function extractCurrentOwnerCandidates($) {
  const owners = [];
  $(".parcel-info .parcel-detail .ownership > div").each((i, el) => {
    const clone = $(el).clone();
    clone.find("p").remove();
    const raw = normalizeSpace(
      clone
        .text()
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    );
    if (raw) owners.push(raw);
  });
  return owners;
}

// Extract sales history entries (date -> grantee string)
function extractSalesHistory($) {
  const rows = [];
  $("section.sale table tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (!tds.length) return;
    // Date is typically the 2nd td
    let date = normalizeSpace($(tds[1]).text());
    const dateMatch = date.match(/\b\d{4}-\d{2}-\d{2}\b/);
    date = dateMatch ? dateMatch[0] : null;
    // Ownership is last td
    const ownershipCell = normalizeSpace($(tds[tds.length - 1]).text());
    let grantee = null;
    const m = ownershipCell.match(/Grantee:\s*([^]+)$/i);
    if (m) {
      grantee = normalizeSpace(m[1]);
    } else {
      // Fallback: parse entire row text
      const rowText = normalizeSpace($tr.text());
      const m2 = rowText.match(/Grantee:\s*([^]+)$/i);
      if (m2) grantee = normalizeSpace(m2[1]);
    }
    if (date && grantee) {
      rows.push({ date, grantee });
    }
  });
  return rows;
}

// Build owners_by_date with classification and invalids
function buildOwnersByDate($) {
  const invalid = [];
  const byDate = {};

  const sales = extractSalesHistory($);

  for (const { date, grantee } of sales) {
    const parts = splitJointOwners(grantee);
    const owners = [];

    // Parse each owner independently

    for (let idx = 0; idx < parts.length; idx++) {
      const raw = parts[idx];
      const clean = normalizeSpace(raw.replace(/\.$/, "").replace(/\s*\([^)]*\)\s*$/, ""));

      if (!clean) continue;

      if (
        isCompanyName(clean) ||
        /\b(revocable|living)\b\s*\btrust\b/i.test(clean)
      ) {
        owners.push({ type: "company", name: clean });
        continue;
      }

      if (looksLikePerson(clean)) {
        const person = parsePerson(clean);
        if (person) {
          owners.push(person);
        } else {
          invalid.push({ raw: clean, reason: "could_not_parse_person" });
        }
        continue;
      }

      if (/\b(trust|revocable|estate)\b/i.test(clean)) {
        owners.push({ type: "company", name: clean });
      } else {
        // Try parsing as person even if looksLikePerson failed
        const person = parsePerson(clean);
        if (person) {
          owners.push(person);
        } else {
          invalid.push({ raw: clean, reason: "unrecognized_owner_format" });
        }
      }
    }

    byDate[date] = dedupeOwners(owners);
  }

  // Current owners: use either Owners section or most recent sales grantee
  const currentCandidates = extractCurrentOwnerCandidates($);
  let currentOwners = [];

  const candidateOwners = [];
  for (const cand of currentCandidates) {
    if (!cand) continue;

    // If it contains 'trustee' but no 'trust', it's likely truncated and unreliable
    if (/\btrustee\b/i.test(cand) && !/\btrust\b/i.test(cand)) {
      invalid.push({ raw: cand, reason: "truncated_trust_designation" });
      continue;
    }

    if (isCompanyName(cand)) {
      candidateOwners.push({ type: "company", name: cand });
      continue;
    }

    const personLike = cand
      .replace(
        /\b(TRUSTEE|ET\s+AL|CUSTODIAN|AS\s+TRUSTEE|TTEE|AS\s+TTEE)\b.*$/i,
        "",
      )
      .trim();
    if (looksLikePerson(personLike)) {
      const p = parsePerson(personLike, null, 0);
      if (p) candidateOwners.push(p);
      else
        invalid.push({
          raw: cand,
          reason: "could_not_parse_current_candidate",
        });
    }
  }

  const latest = sales.length
    ? [...sales].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0]
    : null;

  if (candidateOwners.length === 0) {
    if (latest) {
      const parts = splitJointOwners(latest.grantee);
      const owners = [];
      let fallbackLast = null;
      if (parts.length >= 1) {
        const firstPartTokens = parts[0]
          .replace(/,/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        if (
          firstPartTokens.length >= 2 &&
          parts[0] === parts[0].toUpperCase()
        ) {
          fallbackLast = firstPartTokens[0];
        }
      }
      for (let idx = 0; idx < parts.length; idx++) {
        const raw = normalizeSpace(parts[idx]);
        if (
          isCompanyName(raw) ||
          /\b(revocable|living)\b\s*\btrust\b/i.test(raw)
        ) {
          owners.push({ type: "company", name: raw });
        } else if (looksLikePerson(raw)) {
          const p = parsePerson(raw, fallbackLast, idx);
          if (p) owners.push(p);
          else invalid.push({ raw, reason: "could_not_parse_person" });
        } else if (/\b(trust|revocable|estate)\b/i.test(raw)) {
          owners.push({ type: "company", name: raw });
        } else {
          invalid.push({ raw, reason: "unrecognized_owner_format" });
        }
      }
      currentOwners = dedupeOwners(owners);
    }
  } else {
    currentOwners = dedupeOwners(candidateOwners);
  }

  // Prefer the latest grantee if it is a trust/company
  if (latest) {
    const latestGrantee = normalizeSpace(latest.grantee);
    if (isCompanyName(latestGrantee)) {
      currentOwners = [{ type: "company", name: latestGrantee }];
    }
  }

  // Assemble owners_by_date in chronological order
  const sortedDates = Object.keys(byDate).sort((a, b) => a.localeCompare(b));
  const ownersByDate = {};
  for (const d of sortedDates) {
    ownersByDate[d] = byDate[d];
  }

  ownersByDate["current"] = currentOwners;

  return { ownersByDate, invalid };
}

const { ownersByDate, invalid } = buildOwnersByDate($);

const output = {};
output[`property_${propId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalid,
};

// Ensure output directory exists and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print only the JSON result
console.log(JSON.stringify(output, null, 2));
