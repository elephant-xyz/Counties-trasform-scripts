const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlFiles = fs.readdirSync(".").filter(f => f.endsWith(".html"));
const htmlFile = htmlFiles.length > 0 ? htmlFiles[0] : "input.html";
const html = fs.readFileSync(htmlFile, "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
function normalizeSpace(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

// Utility: title-case words conservatively according to pattern ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
function titleCase(str) {
  if (!str || str.trim() === "") return "";

  // Remove any characters that don't match the allowed pattern
  const cleaned = str.trim().replace(/[^a-zA-Z\s\-',.]/g, "");
  if (!cleaned || cleaned.length === 0) return "";

  // Normalize spacing: collapse multiple spaces into one
  const normalizedSpacing = cleaned.replace(/\s+/g, " ").trim();
  if (!normalizedSpacing) return "";

  const normalized = normalizedSpacing.toLowerCase();
  let result = "";
  let capitalizeNext = true;
  let lastWasSpecial = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (/[a-z]/.test(char)) {
      // It's a letter
      if (capitalizeNext) {
        result += char.toUpperCase();
        capitalizeNext = false;
      } else {
        result += char;
      }
      lastWasSpecial = false;
    } else if (/[ \-',.]/.test(char)) {
      // It's a special character allowed in names
      // Only add if the previous character was not a special character
      // and if there's a next character that is a letter
      if (!lastWasSpecial && i + 1 < normalized.length && /[a-z]/.test(normalized[i + 1])) {
        result += char;
        // Next letter should be capitalized
        capitalizeNext = true;
        lastWasSpecial = true;
      }
    }
  }

  // If the result is empty or doesn't start with a letter, return empty string
  if (!result || result.length === 0 || !/^[A-Z]/.test(result)) return "";

  // Validate result matches the pattern, return empty string if not
  if (!/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(result)) {
    return "";
  }

  return result;
}

// Utility: format middle name according to pattern ^[A-Z][a-zA-Z\s\-',.]*$
// Middle names allow mixed case throughout (not just after separators)
function formatMiddleName(str) {
  if (!str || str.trim() === "") return "";

  // Remove any characters that don't match the allowed pattern
  const cleaned = str.trim().replace(/[^a-zA-Z\s\-',.]/g, "");
  if (!cleaned || cleaned.length === 0) return "";

  // Remove leading special characters to ensure it starts with a letter
  const startsWithLetter = cleaned.replace(/^[\s\-',.]+/, "");
  if (!startsWithLetter || startsWithLetter.length === 0) return "";

  // Normalize spacing: collapse multiple spaces into one
  const normalizedSpacing = startsWithLetter.replace(/\s+/g, " ").trim();
  if (!normalizedSpacing) return "";

  // Title case each word: capitalize first letter of each word, lowercase the rest
  // This ensures multi-word middle names like "MARY WELLS" become "Mary Wells"
  // and single-word names like "WELLS" become "Wells"
  const result = normalizedSpacing
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Find the first letter in the word and capitalize it
      const firstLetterIndex = word.search(/[a-z]/);
      if (firstLetterIndex === -1) return ""; // No letters found, skip this word

      // Skip leading special characters and capitalize first letter
      const letterPart = word.substring(firstLetterIndex);
      return letterPart.charAt(0).toUpperCase() + letterPart.slice(1);
    })
    .filter(Boolean) // Remove empty strings
    .join(" ");

  // Remove any trailing special characters that might have been left
  const finalResult = result.replace(/[\s\-',.]+$/, "").trim();

  if (!finalResult || finalResult.length === 0) return "";

  // Validate against the middle name pattern ^[A-Z][a-zA-Z\s\-',.]*$
  if (!/^[A-Z][a-zA-Z\s\-',.]*$/.test(finalResult)) {
    return "";
  }

  return finalResult;
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
    "\\bplc\\b", "\\bpc\\b", "\\bp\\.c\\.\\b", "\\bpllc\\b", "\\blllp\\b", "\\bllp\\b", "\\blp\\b", "\\bco\\b",
    "\\btrust\\b", "\\btr\\b", "\\bfoundation\\b", "\\bfund\\b", "\\bpartnership\\b",
    "\\bholdings\\b", "\\bholding\\b", "\\bassociation\\b", "\\bassociates\\b",
    "\\bbank\\b", "\\bn\\.a\\.\\b", "\\bna\\b", "\\bchurch\\b", "\\bschool\\b", "\\bdistrict\\b",
    "\\bstate\\b", "\\bcounty\\b", "\\bcity\\b", "\\bgovernment\\b", "\\bfederal\\b",
    "\\bpublic\\b", "\\bmunicipal\\b", "\\bauthority\\b", "\\bcommission\\b",
    "\\bagency\\b", "\\bdepartment\\b", "\\bboard\\b", "\\blands\\b"
  ];
  
  // Check for strict keyword matches
  for (const pattern of strictKeywords) {
    if (new RegExp(pattern, 'i').test(n)) return true;
  }
  
  // Only return true for obvious company patterns, not person names
  return false;
}

// Parse possible multiple owners joined by '&' or ' and '
function splitJointOwners(raw) {
  const s = normalizeSpace(raw).replace(/&amp;/g, '&').replace(/\s*\([^)]*\)\s*/g, ' ');
  if (!s) return [];
  // Split on & or ' and ' while preserving meaningful tokens
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
  const firstFormatted = titleCase(first);
  const lastFormatted = titleCase(last);
  const middleFormatted = middle ? formatMiddleName(middle) : null;

  return {
    type: "person",
    first_name: firstFormatted || null,
    last_name: lastFormatted || null,
    middle_name: middleFormatted || null,
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

  let first, last, middle;

  if (upper) {
    // For uppercase names, we need to be smart about 2-token names
    if (tokens.length === 2) {
      // Check if either token is a single letter
      const firstIsSingleLetter = tokens[0].length === 1;
      const secondIsSingleLetter = tokens[1].length === 1;

      if (secondIsSingleLetter && !firstIsSingleLetter) {
        // Pattern like "MARY A" -> treat as FIRST MIDDLE (reject due to missing last name)
        console.log(`Debug: Rejecting '${name}' - appears to be FIRST MIDDLE without last name`);
        return null;
      } else if (firstIsSingleLetter && !secondIsSingleLetter) {
        // Pattern like "A MARY" -> treat as MIDDLE FIRST (reject due to missing last name)
        console.log(`Debug: Rejecting '${name}' - appears to be MIDDLE FIRST without last name`);
        return null;
      } else if (firstIsSingleLetter && secondIsSingleLetter) {
        // Both single letters -> reject
        console.log(`Debug: Rejecting '${name}' - both tokens are single letters`);
        return null;
      }
      // Otherwise, treat as LAST FIRST
      last = tokens[0];
      first = tokens[1];
      middle = null;
    } else {
      // 3+ tokens: Assume LAST FIRST [MIDDLE] for uppercase names
      last = tokens[0];
      first = tokens[1];
      middle = tokens.length >= 3 ? tokens.slice(2).join(" ") : null;
    }

    if (!first || !last) return null;

    // Reject if first or last name is a single letter
    if (first.length === 1 || last.length === 1) {
      console.log(`Debug: Rejecting '${name}' - first or last name is a single letter after parsing`);
      return null;
    }

    return buildPerson(first, last, middle, prefix, suffix);
  } else {
    // Assume FIRST [MIDDLE] LAST for mixed case names
    first = tokens[0];
    last = tokens[tokens.length - 1];
    middle = tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null;

    if (!first || !last) return null;

    // Reject if first or last name is a single letter
    if (first.length === 1 || last.length === 1) {
      console.log(`Debug: Rejecting '${name}' - first or last name is a single letter after parsing`);
      return null;
    }

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
    clone.find("p").remove(); // Remove address paragraphs
    const htmlContent = clone.html() || "";

    // Split by <br> tags to get individual owner lines
    const ownerLines = htmlContent
      .split(/<br\s*\/?>/i)
      .map(line => {
        // Remove HTML tags and normalize whitespace
        return normalizeSpace(line.replace(/<[^>]*>/g, '').trim());
      })
      .filter(line => line.length > 0);

    owners.push(...ownerLines);
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
    // Check if the ORIGINAL grantee string contains company keywords before splitting
    // This prevents splitting company names like "E3 LAND & MINERALS LLC" into person names
    const cleanedGrantee = normalizeSpace(
      grantee
        .replace(/\.$/, "")
        .replace(/\s*\([^)]*\)\s*/g, " ") // Remove ALL parenthetical content like (GUARDIAN), (TRUSTEE), etc.
        .replace(/\b(AS\s+(?:TRUSTEE|BISHOP|GUARDIAN|ADMINISTRATOR|EXECUTOR|EXECUTRIX|AGENT|ATTORNEY|REPRESENTATIVE|CONSERVATOR|CUSTODIAN))\b.*$/i, "")
        .replace(/\b(L\/E|JT\/RS|JTWROS|JT\s+W\/RS|M\/C|H&W|TENANTS?\s+IN\s+COMMON|TIC|ET\s+AL|TTEE|TRUSTEE|CUSTODIAN)\b.*$/i, "")
        .replace(/\s+/g, ' ') // Normalize multiple spaces
    ).trim();

    // If the original string is clearly a company (has LLC, INC, etc.), don't split it
    let parts;
    if (isCompanyName(cleanedGrantee) || /\b(revocable|living)\b\s*\btrust\b/i.test(cleanedGrantee)) {
      parts = [cleanedGrantee];
    } else {
      parts = splitJointOwners(cleanedGrantee);
    }

    const owners = [];

    // Parse each owner independently, but track the first person's last name for joint ownership
    let sharedLastName = null;

    for (let idx = 0; idx < parts.length; idx++) {
      const raw = parts[idx];

      // Detect and skip corrupted names with semicolons or other suspicious patterns
      if (/[;]/.test(raw)) {
        console.log(`Debug: Skipping corrupted name with semicolon: '${raw}'`);
        invalid.push({ raw, reason: "corrupted_name_with_semicolon" });
        continue;
      }

      // Remove legal designations and parenthetical content
      const clean = normalizeSpace(
        raw
          .replace(/\.$/, "")
          .replace(/\s*\([^)]*\)\s*/g, " ") // Remove ALL parenthetical content like (GUARDIAN), (TRUSTEE), etc.
          .replace(/\b(AS\s+(?:TRUSTEE|BISHOP|GUARDIAN|ADMINISTRATOR|EXECUTOR|EXECUTRIX|AGENT|ATTORNEY|REPRESENTATIVE|CONSERVATOR|CUSTODIAN))\b.*$/i, "")
          .replace(/\b(L\/E|JT\/RS|JTWROS|JT\s+W\/RS|M\/C|H&W|TENANTS?\s+IN\s+COMMON|TIC|ET\s+AL|TTEE|TRUSTEE|CUSTODIAN)\b.*$/i, "")
          .replace(/\s+/g, ' ') // Normalize multiple spaces
      ).trim();

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
          // Track the first person's last name for joint ownership scenarios
          if (idx === 0 && person.last_name && parts.length > 1) {
            sharedLastName = person.last_name;
          }
        } else {
          // If parsing failed and we have a shared last name, try appending it
          if (sharedLastName && parts.length > 1 && idx > 0) {
            const nameWithLast = `${clean} ${sharedLastName}`;
            const personWithLast = parsePerson(nameWithLast);
            if (personWithLast) {
              owners.push(personWithLast);
              continue;
            }
          }
          invalid.push({ raw: clean, reason: "could_not_parse_person" });
        }
        continue;
      }

      // Debug: Check if it's a person name that failed looksLikePerson
      console.log(`Debug: '${clean}' failed looksLikePerson check`);

      if (/\b(trust|revocable|estate)\b/i.test(clean)) {
        owners.push({ type: "company", name: clean });
      } else {
        // Try parsing as person even if looksLikePerson failed
        const person = parsePerson(clean);
        if (person) {
          owners.push(person);
          // Track the first person's last name for joint ownership scenarios
          if (idx === 0 && person.last_name && parts.length > 1) {
            sharedLastName = person.last_name;
          }
        } else {
          // If parsing failed and we have a shared last name, try appending it
          if (sharedLastName && parts.length > 1 && idx > 0) {
            const nameWithLast = `${clean} ${sharedLastName}`;
            const personWithLast = parsePerson(nameWithLast);
            if (personWithLast) {
              owners.push(personWithLast);
              continue;
            }
          }
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
      .replace(/\s*\([^)]*\)\s*/g, " ") // Remove parenthetical content
      .replace(/\b(OF\s+(?:DIOCESE|THE\s+ESTATE|THE\s+TRUST|THE|ESTATE))\b.*$/i, "")
      .replace(/\b(AS\s+(?:TRUSTEE|BISHOP|GUARDIAN|ADMINISTRATOR|EXECUTOR|EXECUTRIX|AGENT|ATTORNEY|REPRESENTATIVE|CONSERVATOR|CUSTODIAN))\b.*$/i, "")
      .replace(
        /\b(L\/E|TRUSTEE|ET\s+AL|CUSTODIAN|TTEE)\b.*$/i,
        "",
      )
      .replace(/\s+/g, ' ') // Normalize multiple spaces
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
