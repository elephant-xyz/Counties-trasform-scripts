// ownerMapping.js
// Transform input.html into owners/owner_data.json using cheerio only for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: normalize a string's whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Allowed prefix/suffix values per Elephant Person schema
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
  COL: "Col.",
  MAJ: "Maj.",
  LT: "Lt.",
  SGT: "Sgt.",
  HON: "Hon.",
  JUDGE: "Judge",
  RABBI: "Rabbi",
  IMAM: "Imam",
  SHEIKH: "Sheikh",
  SIR: "Sir",
  DAME: "Dame",
};

// Broad company indicators (short + long forms)
const COMPANY_INDICATOR_PATTERNS = [
  /\binc\b/i,
  /\binc\.\b/i,
  /\bincorporated\b/i,
  /\bcorp\b/i,
  /\bcorp\.\b/i,
  /\bcorporation\b/i,
  /\bco\b/i,
  /\bco\.\b/i,
  /\bcompany\b/i,
  /\bltd\b/i,
  /\bltd\.\b/i,
  /\blimited\b/i,
  /\bllc\b/i,
  /\bl\.l\.c\.?\b/i,
  /\blc\b/i,
  /\bl\.c\.?\b/i,
  /\blimited liability company\b/i,
  /\bplc\b/i,
  /\bp\.l\.c\.?\b/i,
  /\bpllc\b/i,
  /\bp\.l\.l\.c\.?\b/i,
  /\bprofessional limited liability company\b/i,
  /\blp\b/i,
  /\bl\.p\.?\b/i,
  /\blimited partnership\b/i,
  /\bllp\b/i,
  /\bl\.l\.p\.?\b/i,
  /\blimited liability partnership\b/i,
  /\blpa\b/i,
  /\bl\.p\.a\.?\b/i,
  /\bpa\b/i,
  /\bp\.a\.?\b/i,
  /\bprofessional association\b/i,
  /\bpc\b/i,
  /\bp\.c\.?\b/i,
  /\bprofessional corporation\b/i,
  /\bna\b/i,
  /\bn\.?a\.?\b/i,
  /\bnational association\b/i,
  /\bfsb\b/i,
  /\bf\.s\.b\.?\b/i,
  /\bfederal savings\b/i,
  /\bbank\b/i,
  /\bcredit union\b/i,
  /\btrust\b/i,
  /\btrustees?\b/i,
  /\btr\b/i,
  /\bfoundation\b/i,
  /\bministr(?:y|ies)\b/i,
  /\balliance\b/i,
  /\bsolutions?\b/i,
  /\bservices?\b/i,
  /\bassociates?\b/i,
  /\bassoc\b/i,
  /\bassn\b/i,
  /\bassociation\b/i,
  /\bholdings?\b/i,
  /\bpartners?\b/i,
  /\bpartnership\b/i,
  /\bproperties\b/i,
  /\bproperty\b/i,
  /\benterprises?\b/i,
  /\benterprise\b/i,
  /\bmanagement\b/i,
  /\bmgmt\b/i,
  /\binvestments?\b/i,
  /\bgroup\b/i,
  /\bdevelopment\b/i,
  /\bdevelopers?\b/i,
  /\brealty\b/i,
  /\bmortgage\b/i,
  /\bhomes\b/i,
  /\bapartments?\b/i,
  /\bcondominiums?\b/i,
  /\bhoa\b/i,
  /\bhomeowners association\b/i,
  /\butility\b/i,
  /\butilities\b/i,
];

const PERSON_SUFFIX_MAP = {
  JR: "Jr.",
  JRQ: "Jr.", // fallback for variants with extra chars stripped
  SR: "Sr.",
  II: "II",
  III: "III",
  IV: "IV",
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

const normalizeTokenForAffix = (token) =>
  (token || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

function mapPrefix(token) {
  const normTok = normalizeTokenForAffix(token);
  return PERSON_PREFIX_MAP[normTok] || null;
}

function mapSuffix(token) {
  const normTok = normalizeTokenForAffix(token);
  return PERSON_SUFFIX_MAP[normTok] || null;
}

// Separate function to pull prefix/suffix tokens from a token array
function extractAffixes(parts) {
  const tokens = [...parts];
  let prefix = null;
  if (tokens.length) {
    const maybe = mapPrefix(tokens[0]);
    if (maybe) {
      prefix = maybe;
      tokens.shift();
    }
  }
  let suffix = null;
  if (tokens.length) {
    const maybe = mapSuffix(tokens[tokens.length - 1]);
    if (maybe) {
      suffix = maybe;
      tokens.pop();
    }
  }
  return { prefix, suffix, coreParts: tokens };
}

// Helper: extract visible text including <br> as newlines
function textWithBreaks($el) {
  const parts = [];
  $el.contents().each((_, node) => {
    if (node.type === "text") parts.push(node.data);
    else if (node.name === "br") parts.push("\n");
    else if (node.type === "tag") parts.push(textWithBreaks($(node)));
  });
  return parts.join("");
}

// Heuristic: find parcel/property ID
function extractPropertyId($) {
  // 1) explicit hidden inputs commonly used
  const formatPIN = $('input[name="formatPIN"]').attr("value");
  if (formatPIN && norm(formatPIN)) return norm(formatPIN);

  const pin = $('input[name="PIN"]').attr("value");
  if (pin && norm(pin)) return norm(pin);

  const parcelIdBuffer = $('input[name="PARCELID_Buffer"]').attr("value");
  if (parcelIdBuffer && norm(parcelIdBuffer)) return norm(parcelIdBuffer);

  // 2) Text near "Parcel:" label
  let idFromParcel = null;
  $("table.parcelIDtable td").each((_, td) => {
    const t = norm($(td).text());
    if (/^Parcel:?$/i.test(t)) {
      const next = $(td).nextAll("td").eq(1); // the bold id cell appears after the << button cell
      const raw = norm(next.text());
      if (raw) {
        // e.g., 1-10-37-35-0A00-00014-0000 (19330)
        const m = raw.match(/([A-Za-z0-9\-]+(?:\-[A-Za-z0-9]+)*)/);
        if (m) idFromParcel = m[1];
      }
    }
  });
  if (idFromParcel) return idFromParcel;

  // 3) Fallback unknown
  return "unknown_id";
}

// Heuristic: detect company names
function isCompanyName(name) {
  const lowered = (name || "").toLowerCase();
  const compact = lowered.replace(/[.,]/g, " ");
  return COMPANY_INDICATOR_PATTERNS.some(
    (re) => re.test(lowered) || re.test(compact),
  );
}

// Normalize for deduplication
function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .filter(Boolean)
    .join(" ");
  return norm(parts).toLowerCase();
}

// Build owner object(s) from a raw string
function buildOwnersFromRaw(raw) {
  const owners = [];
  const s = norm(raw);
  if (!s) return owners;

  // Exclude lines that clearly are not owner names
  if (/^(c\/o|care of)\b/i.test(s)) return owners; // ignore care-of lines entirely
  if (/^(po box|p\.?o\.? box)/i.test(s)) return owners;

  // Exclude standalone estate designations (with or without parentheses)
  const cleanedForCheck = s.replace(/[\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(ESTATE|TRUST|TRUSTEE|DECEASED|DEC'D|DEC|ET AL|ETAL)$/i.test(cleanedForCheck)) {
    return owners; // ignore standalone estate designations
  }

  // If name contains company indicators -> company
  if (isCompanyName(s)) {
    owners.push({ type: "company", name: s });
    return owners;
  }

  // Handle multiple names separated by newlines or specific patterns
  // Split by common separators that indicate multiple people
  const nameLines = s.split(/\n|\s*&\s*/).map(line => norm(line)).filter(Boolean);
  
  nameLines.forEach(nameLine => {
    if (isCompanyName(nameLine)) {
      owners.push({ type: "company", name: nameLine });
    } else {
      owners.push(...buildPersonFromSingleName(nameLine));
    }
  });

  return owners;
}

function formatNameToPattern(name) {
  if (!name) return null;
  // Remove any remaining parentheses, brackets, or invalid characters
  let cleaned = name.trim().replace(/[\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  // Remove estate/trust designations
  cleaned = cleaned.replace(/\b(ESTATE|TRUST|TRUSTEE|DECEASED|DEC'D|DEC|ET AL|ETAL)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  // Format to proper case
  const formatted = cleaned.split(' ').map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
  // Validate against the required pattern
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (!namePattern.test(formatted)) {
    return null;
  }
  return formatted;
}

function buildPersonFromSingleName(s) {
  const out = [];
  // Remove estate designations and other parenthetical content
  let cleaned = s.replace(/\s{2,}/g, " ");
  // First remove any parenthetical content like (DEC), (DECEASED), (ESTATE), etc.
  cleaned = cleaned.replace(/\([^)]*\)/g, "").trim();
  // Then remove trailing designations like "ESTATE", "TRUST", "TRUSTEE", "DEC", etc.
  cleaned = cleaned.replace(/\b(ESTATE|TRUST|TRUSTEE|DECEASED|DEC'D|DEC|ET AL|ETAL)\s*$/i, "").trim();
  // Remove any remaining parentheses or brackets that might be standalone
  cleaned = cleaned.replace(/[\(\)\[\]\{\}]/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);

  const { prefix, suffix, coreParts } = extractAffixes(parts);
  const usableParts = coreParts;

  if (usableParts.length < 2) {
    // Single word cannot be confidently parsed as person -> treat as company fallback
    out.push({ type: "company", name: cleaned });
    return out;
  }
  
  // Handle LAST, FIRST M style
  if (/,/.test(cleaned)) {
    const [last, rest] = cleaned.split(",", 2).map((x) => norm(x));
    const restParts = (rest || "").split(/\s+/).filter(Boolean);
    let lastParts = last.split(/\s+/).filter(Boolean);
    const { suffix: suffixFromLast, coreParts: lastCoreParts } =
      extractAffixes(lastParts);
    lastParts = lastCoreParts;
    const detectedPrefix = restParts.length ? mapPrefix(restParts[0]) : null;
    if (detectedPrefix) restParts.shift();
    const first = restParts.shift() || "";
    const middle = restParts.length ? norm(restParts.join(" ")) : null;

    const formattedFirst = formatNameToPattern(first);
    const formattedLast = formatNameToPattern(lastParts.length ? lastParts.join(" ") : last);
    const formattedMiddle = middle ? formatNameToPattern(middle) : null;

    // Only create person if first_name and last_name are valid
    if (!formattedFirst || !formattedLast) {
      // If name parts are invalid, treat as company
      out.push({ type: "company", name: cleaned });
      return out;
    }

    out.push({
      type: "person",
      first_name: formattedFirst,
      last_name: formattedLast,
      ...(formattedMiddle ? { middle_name: formattedMiddle } : {}),
      prefix_name: detectedPrefix || prefix || null,
      suffix_name: suffixFromLast || suffix || null,
    });
    return out;
  }
  
  // Handle "LASTNAME FIRSTNAME" pattern (common in property records)
  if (usableParts.length === 2) {
    // Check if first part looks like a last name (all caps typically)
    const [part1, part2] = usableParts;
    let formattedFirst, formattedLast;

    if (part1 === part1.toUpperCase() && part2 === part2.toUpperCase()) {
      // Both are uppercase, assume LASTNAME FIRSTNAME
      formattedFirst = formatNameToPattern(part2);
      formattedLast = formatNameToPattern(part1);
    } else {
      // Normal FIRSTNAME LASTNAME
      formattedFirst = formatNameToPattern(part1);
      formattedLast = formatNameToPattern(part2);
    }

    // Only create person if first_name and last_name are valid
    if (!formattedFirst || !formattedLast) {
      // If name parts are invalid, treat as company
      out.push({ type: "company", name: cleaned });
      return out;
    }

    out.push({
      type: "person",
      first_name: formattedFirst,
      last_name: formattedLast,
      middle_name: null,
      prefix_name: prefix || null,
      suffix_name: suffix || null,
    });
    return out;
  }
  
  // Handle multiple parts - assume first is first name, last is last name, middle are middle names
  const first = usableParts[0];
  const last = usableParts[usableParts.length - 1];
  const middleParts = usableParts.slice(1, -1).filter(Boolean);
  const middle = middleParts.length ? norm(middleParts.join(" ")) : null;

  const formattedFirst = formatNameToPattern(first);
  const formattedLast = formatNameToPattern(last);
  const formattedMiddle = middle ? formatNameToPattern(middle) : null;

  // Only create person if first_name and last_name are valid
  if (!formattedFirst || !formattedLast) {
    // If name parts are invalid, treat as company
    out.push({ type: "company", name: cleaned });
    return out;
  }

  out.push({
    type: "person",
    first_name: formattedFirst,
    last_name: formattedLast,
    ...(formattedMiddle ? { middle_name: formattedMiddle } : {}),
    prefix_name: prefix || null,
    suffix_name: suffix || null,
  });
  return out;
}

// Extract owner name candidates from the document
function extractOwnerCandidates($) {
  const cand = [];

  // 1) Owner & Property Info block: extract from the bold text in owner cell
  $("td").each((_, td) => {
    const label = norm($(td).text());
    if (/^Owner$/i.test(label)) {
      const valueTd = $(td).next("td");
      if (valueTd && valueTd.length) {
        const boldText = valueTd.find("b").text();
        if (boldText) {
          // Normalize newlines to spaces - bold text may contain line breaks within a single owner name
          const normalizedText = norm(boldText.replace(/\n/g, ' '));
          if (normalizedText) {
            // Skip address lines
            if (!/\b(\d{5})(?:-\d{4})?$/.test(normalizedText) &&
                !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(normalizedText) &&
                !/^\d+\s/.test(normalizedText)) {
              cand.push(normalizedText);
            }
          }
        }
      }
    }
  });

  // 2) Hidden strOwner fallback - parse HTML entities
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner && norm(strOwner)) {
    // Parse HTML entities like <br> and extract names
    const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, '\n');
    const ownerLines = cleanOwner.split(/\n/).map(line => norm(line)).filter(Boolean);
    ownerLines.forEach(line => {
      if (!/\b(\d{5})(?:-\d{4})?$/.test(line) && 
          !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
          !/^\d+\s/.test(line) &&
          !cand.includes(line)) {
        cand.push(line);
      }
    });
  }

  // Deduplicate raw candidates by normalized text
  const seen = new Set();
  const uniq = [];
  cand.forEach((c) => {
    const key = norm(c).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniq.push(c);
  });
  return uniq;
}

// Attempt to extract historical dates near owners (fallback to Sales History if clearly associated). Here, no owner names are near dates.
function extractHistoricalDates($) {
  const dates = [];
  // Parse Sales History dates as potential ownership change markers
  $("table.parcelDetails_insideTable tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const headerLike = norm($(tds.eq(0)).text());
      // Detect date formats like 2/7/2022
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(headerLike)) {
        const [m, d, y] = headerLike.split("/").map((x) => parseInt(x, 10));
        const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        dates.push(iso);
      }
    }
  });
  // unique and sorted
  const uniq = Array.from(new Set(dates));
  uniq.sort();
  return uniq;
}

// Main assembly
const propertyId = extractPropertyId($);
// First try to get owner names from the strOwner hidden input which has the clean data
let rawCandidates = [];
const strOwner = $('input[name="strOwner"]').attr("value");
if (strOwner) {
  const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, '\n');
  const ownerLines = cleanOwner.split(/\n/).map(line => norm(line)).filter(Boolean);
  // Filter out address lines
  ownerLines.forEach(line => {
    if (!/\b(\d{5})(?:-\d{4})?$/.test(line) && 
        !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
        !/^\d+\s/.test(line)) {
      rawCandidates.push(line);
    }
  });
}

// If no candidates from strOwner, fall back to extracting from DOM
if (rawCandidates.length === 0) {
  rawCandidates = extractOwnerCandidates($);
}

// Classify and deduplicate structured owners
const owners = [];
const ownerSeen = new Set();
const invalidOwners = [];
rawCandidates.forEach((raw) => {
  const built = buildOwnersFromRaw(raw);
  if (!built || !built.length) {
    invalidOwners.push({ raw: raw, reason: "no_owner_extracted" });
    return;
  }
  built.forEach((o) => {
    if (!o) return;
    if (o.type === "person") {
      if (!o.first_name || !o.last_name) {
        invalidOwners.push({ raw: raw, reason: "person_missing_name_parts" });
        return;
      }
      if (!("middle_name" in o)) o.middle_name = null;
      if (!("prefix_name" in o)) o.prefix_name = null;
      if (!("suffix_name" in o)) o.suffix_name = null;
    } else if (o.type === "company") {
      if (!o.name) {
        invalidOwners.push({ raw: raw, reason: "company_missing_name" });
        return;
      }
    } else {
      invalidOwners.push({ raw: raw, reason: "unrecognized_type" });
      return;
    }
    const key = normalizeOwnerKey(o);
    if (!key) {
      invalidOwners.push({ raw: raw, reason: "empty_normalized_key" });
      return;
    }
    if (ownerSeen.has(key)) return;
    ownerSeen.add(key);
    owners.push(o);
  });
});

// Owners by date: assign current owners; add historical date keys if confidently associated (not in this document)
const ownersByDate = {};
ownersByDate["current"] = owners;

// Build final object
const output = {
  invalid_owners: invalidOwners,
};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
};

// Ensure target directory exists and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON result
console.log(JSON.stringify(output, null, 2));
