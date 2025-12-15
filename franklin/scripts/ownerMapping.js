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

// Utility: title-case words conservatively (keep all-caps acronyms)
function titleCase(str) {
  if (!str) return null;
  // Remove any characters that are not letters, spaces, hyphens, apostrophes, commas, or periods
  let cleaned = str.trim().replace(/[^a-zA-Z\s\-',.]/g, "");
  if (!cleaned) return null;

  // Convert to lowercase first
  cleaned = cleaned.toLowerCase();

  // Normalize spacing - replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove ". " patterns (e.g., "Jr. Smith" -> "Jr Smith")
  cleaned = cleaned.replace(/\.\s+/g, " ");

  // Remove all remaining periods
  cleaned = cleaned.replace(/\./g, "");

  // Remove multiple consecutive special characters (not spaces)
  cleaned = cleaned.replace(/[\-',]{2,}/g, " ");

  // Remove leading/trailing special characters
  cleaned = cleaned.replace(/^[\s\-',.]+|[\s\-',.]+$/g, "");

  if (!cleaned || cleaned.length === 0) return null;

  // Split into tokens, keeping track of positions
  const result = [];
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    // If it's a letter, start collecting a word
    if (/[a-z]/.test(char)) {
      let word = char;
      i++;

      // Collect rest of word (lowercase letters only)
      while (i < cleaned.length && /[a-z]/.test(cleaned[i])) {
        word += cleaned[i];
        i++;
      }

      // Capitalize first letter of word
      word = word.charAt(0).toUpperCase() + word.slice(1);
      result.push(word);
    }
    // If it's a special character (space, hyphen, apostrophe, comma)
    else if (/[ \-',]/.test(char)) {
      result.push(char);
      i++;
    }
    else {
      // Skip any other characters
      i++;
    }
  }

  const finalResult = result.join('');

  // Final cleanup: remove trailing special characters
  const trimmed = finalResult.replace(/[\s\-',.]+$/, '').trim();

  if (!trimmed || trimmed.length === 0) return null;

  // Validate against the strict Elephant schema pattern
  // Pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (!pattern.test(trimmed)) {
    console.log(`titleCase: Invalid name after formatting: "${trimmed}"`);
    return null;
  }

  return trimmed;
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
    "\\bbank\\b", "\\bn\\.a\\.\\b", "\\bna\\b", "\\bchurch\\b", "\\bschool\\b", "\\bdistrict\\b",
    "\\bdept\\b", "\\bdep\\b", "\\bdepartment\\b", "\\bgov\\b", "\\bgovernment\\b",
    "\\bcounty\\b", "\\bcity\\b", "\\bstate\\b", "\\bfederal\\b", "\\bdivision\\b",
    "\\bauthority\\b", "\\bcommission\\b", "\\bboard\\b", "\\bagency\\b"
  ];

  // Check for strict keyword matches
  for (const pattern of strictKeywords) {
    if (new RegExp(pattern, 'i').test(n)) return true;
  }

  // Check for patterns that indicate company/government entities:
  // - Acronyms with slash: TIITF/MARINE
  // - Slash followed by acronyms: /DEP
  // - Dash followed by acronyms: -DEP
  // Fixed to limit acronym pattern to 2-5 letters only (e.g., FBI, DEP) to avoid matching normal all-caps names
  const companyPatterns = [
    /^[A-Z]{2,5}\//,       // Starts with acronym (2-5 letters) followed by slash
    /\/[A-Z]{2,5}\b/,      // Slash followed by acronym (2-5 letters)
  ];

  for (const pattern of companyPatterns) {
    if (pattern.test(name)) return true;
  }

  // Only return true for obvious company patterns, not person names
  return false;
}

// Parse possible multiple owners joined by '&', ' and ', or '/'
function splitJointOwners(raw) {
  const s = normalizeSpace(raw).replace(/&amp;/g, '&').replace(/\s*\([^)]*\)\s*/g, ' ');
  if (!s) return [];
  // Split on &, ' and ', or / while preserving meaningful tokens
  const parts = s
    .split(/\s*(?:&|\band\b|\/)\s*/i)
    .map((p) => normalizeSpace(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

// Clean name artifacts like F/K/A, AKA, etc.
function cleanNameArtifacts(name) {
  if (!name) return name;
  // Handle "F/K/A" (formerly known as) by keeping only the FIRST part (current name)
  // Example: "GRACE F/K/A RUSH" → "GRACE"
  const fkaMatch = name.match(/^([^]+?)\s+(F\/K\/A|FKA|F\s*\/\s*K\s*\/\s*A|A\/K\/A|AKA|A\s*K\s*A)\b/i);
  if (fkaMatch) {
    return normalizeSpace(fkaMatch[1]);
  }
  // Remove "F/K/A", "FKA", "AKA", "A/K/A" and similar patterns if in middle or end
  let cleaned = name.replace(/\s+(F\/K\/A|FKA|F\s*\/\s*K\s*\/\s*A|A\/K\/A|AKA|A\s*K\s*A)\b.*$/gi, '');
  // Remove extra spaces
  cleaned = normalizeSpace(cleaned);
  return cleaned;
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
  return {
    type: "person",
    first_name: titleCase(first),
    last_name: titleCase(last),
    middle_name: middle ? titleCase(middle) : null,
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
    const $el = $(el);
    // Get all text content, then split by <br> to get individual lines
    const html = $el.html();
    if (!html) return;

    // Split by <br> tags and <p> tags to get lines
    const lines = html
      .split(/<br\s*\/?>/i)
      .map(line => {
        // Remove <p> and </p> tags but keep the content
        return line.replace(/<\/?p[^>]*>/gi, '');
      })
      .map(line => normalizeSpace(line.replace(/<[^>]*>/g, '')))
      .filter(Boolean);

    if (!lines.length) return;

    // The owner name is typically the first 1-2 lines before the address
    // Address lines usually contain patterns like "PO BOX", street numbers, zip codes, etc.
    const ownerLines = [];
    for (const line of lines) {
      // Stop when we hit address-like content
      if (/\b(PO\s+BOX|\d{5}(-\d{4})?$|\d+\s+[A-Z]+\s+(ST|AVE|RD|DR|LN|WAY|BLVD|CT|PL|PKWY))/i.test(line)) {
        break;
      }
      ownerLines.push(line);
    }

    if (ownerLines.length > 0) {
      const raw = ownerLines.join(" ");
      owners.push(raw);
    }
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
    let sharedLastName = null;

    // Parse each owner independently

    for (let idx = 0; idx < parts.length; idx++) {
      const raw = parts[idx];
      let clean = normalizeSpace(raw.replace(/\.$/, "").replace(/\s*\([^)]*\)\s*$/, ""));
      // Clean name artifacts like F/K/A, AKA, etc.
      clean = cleanNameArtifacts(clean);

      if (!clean) continue;

      if (
        isCompanyName(clean) ||
        /\b(revocable|living)\b\s*\btrust\b/i.test(clean)
      ) {
        owners.push({ type: "company", name: clean });
        sharedLastName = null; // Reset shared last name for companies
        continue;
      }

      if (looksLikePerson(clean)) {
        const person = parsePerson(clean);
        if (person && person.first_name && person.last_name) {
          owners.push(person);
          sharedLastName = person.last_name; // Save last name for next person
        } else {
          invalid.push({ raw: clean, reason: "could_not_parse_person" });
        }
        continue;
      }

      // Debug: Check if it's a person name that failed looksLikePerson
      console.log(`Debug: '${clean}' failed looksLikePerson check`);

      if (/\b(trust|revocable|estate)\b/i.test(clean)) {
        owners.push({ type: "company", name: clean });
        sharedLastName = null; // Reset shared last name for companies
      } else {
        // Check if this is a single-token name that could share a last name
        const tokens = clean.split(/\s+/).filter(Boolean);
        if (tokens.length === 1 && sharedLastName) {
          // Use shared last name from previous person
          const person = buildPerson(clean, sharedLastName, null, null, null);
          if (person && person.first_name && person.last_name) {
            owners.push(person);
            // Keep the same shared last name
          } else {
            invalid.push({ raw: clean, reason: "invalid_shared_last_name" });
          }
        } else {
          // Try parsing as person even if looksLikePerson failed
          const person = parsePerson(clean);
          if (person && person.first_name && person.last_name) {
            owners.push(person);
            sharedLastName = person.last_name;
          } else {
            invalid.push({ raw: clean, reason: "unrecognized_owner_format" });
          }
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
