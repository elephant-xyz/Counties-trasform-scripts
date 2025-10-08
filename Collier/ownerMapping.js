const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

// Normalize strings: trim, collapse spaces
function norm(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

// Title case for names: first letter uppercase, rest lowercase
function titleCase(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Determine if text looks like an address or non-name noise
function isLikelyAddress(text) {
  const t = norm(text).toUpperCase();
  if (!t) return true;
  // Exclude pure zip/state/city-style tokens
  if (/^\d{5}(-\d{4})?$/.test(t)) return true;
  if (/^\d+[ -]?\d*$/.test(t)) return true; // mostly numbers
  // Common address tokens
  const addrTokens = [
    " ST ",
    " STREET ",
    " AVE ",
    " AVENUE ",
    " BLVD ",
    " WAY ",
    " RD ",
    " ROAD ",
    " DR ",
    " DRIVE ",
    " CT ",
    " COURT ",
    " LN ",
    " LANE ",
    " HWY ",
    " PKWY ",
    " PARKWAY ",
    " PL ",
    " PLACE ",
    " TRL ",
    " TRAIL ",
    " CIR ",
    " CIRCLE ",
    " UNIT ",
    " APT ",
    " SUITE ",
    " STE ",
    " P.O. ",
    " PO BOX ",
  ];
  const padded = " " + t + " ";
  for (const token of addrTokens) {
    if (padded.includes(token)) return true;
  }
  // Heuristic: contains a lot of digits
  const digitCount = (t.match(/\d/g) || []).length;
  if (digitCount >= 3) return true;
  // Single short token like city/state
  if (t.length <= 3) return true;
  return false;
}

// Company keyword detection (case-insensitive)
const companyKeywords = [
  "INC",
  "LLC",
  "L.L.C",
  "LTD",
  "L.T.D",
  "FOUNDATION",
  "ALLIANCE",
  "SOLUTIONS",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "SERVICES",
  "SERVICE",
  "TRUST",
  "TR",
  "LP",
  "LLP",
  "PLC",
  "HOLDINGS",
  "BANK",
  "N.A.",
  "NATIONAL ASSOCIATION",
  "ASSOCIATION",
  "ASSOC",
  "REALTY",
  "PROPERTIES",
  "PARTNERS",
  "INVESTMENTS",
  "GROUP",
  "ENTERPRISES",
  "HOLDING",
];

function looksLikeCompany(name) {
  const t = norm(name).toUpperCase();
  return companyKeywords.some((k) => {
    const kw = k.toUpperCase();
    const re = new RegExp(`(^|[^A-Z])${kw}([^A-Z]|$)`);
    return re.test(t);
  });
}

// Known suffix values
const knownSuffixes = new Set([
  "JR", "JR.", "JUNIOR",
  "SR", "SR.", "SENIOR",
  "II", "III", "IV", "V",
  "ESQ", "ESQ.",
  "CFA", "CPA", "DDS", "DVM", "MBA", "MD", "PE", "PHD", "PMP", "RN", "LLM",
  "EMERITUS",
  "RET", "RET.",
]);

// Normalize suffix to standard format
function normalizeSuffix(suffix) {
  const upper = suffix.toUpperCase().replace(/\./g, "");
  const map = {
    "JR": "Jr.",
    "JUNIOR": "Jr.",
    "SR": "Sr.",
    "SENIOR": "Sr.",
    "II": "II",
    "III": "III",
    "IV": "IV",
    "V": "V",
    "ESQ": "Esq.",
    "RET": "Ret.",
  };
  return map[upper] || suffix;
}

// Classify a raw owner name string into schema owner or invalid
function classifyOwner(raw) {
  const original = norm(raw);
  const text = original.replace(/[\r\n]+/g, " ").trim();
  if (!text) return { valid: false, reason: "empty" };

  // Basic noise/address filtering
  if (isLikelyAddress(text))
    return { valid: false, reason: "address_or_noise" };

  // Check if it looks like a company using keywords - THIS IS THE ONLY WAY TO DETECT COMPANIES
  if (looksLikeCompany(text)) {
    return { valid: true, owner: { type: "company", name: text } };
  }

  // At this point, it's a person (not a company)
  // Two formats are possible:
  // 1. "LAST SUFFIX, FIRST MIDDLE" (e.g., "CARLUCCI JR, CARL PETER")
  // 2. "FIRST MIDDLE LAST" (e.g., "PATRICIA S CARLUCCI")

  if (text.includes(",")) {
    // Format: "LAST SUFFIX, FIRST MIDDLE" or "LAST, FIRST=& FIRST2" (multiple people with same last name)
    const parts = text.split(",").map(s => s.trim());
    if (parts.length < 2) {
      return { valid: false, reason: "comma_but_insufficient_parts", raw: text };
    }

    // Parse left side (last name + optional suffix)
    const leftTokens = parts[0].split(/\s+/).filter(Boolean);
    if (leftTokens.length === 0) {
      return { valid: false, reason: "no_last_name", raw: text };
    }

    let lastName = null;
    let suffixName = null;

    // Check if last token is a suffix
    if (leftTokens.length > 1 && knownSuffixes.has(leftTokens[leftTokens.length - 1].toUpperCase().replace(/\./g, ""))) {
      suffixName = normalizeSuffix(leftTokens.pop());
    }

    lastName = leftTokens.map(titleCase).join(" ");

    // Parse right side (first + middle names)
    const firstMiddle = parts[1].trim();

    // Check if there's "=&" separator indicating multiple people with same last name
    if (firstMiddle.includes("=&")) {
      const names = firstMiddle.split("=&").map(s => s.trim()).filter(Boolean);
      const persons = [];

      for (const name of names) {
        const tokens = name.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) continue;

        const firstName = titleCase(tokens[0]);
        const middleName = tokens.length > 1
          ? tokens.slice(1).map(titleCase).join(" ")
          : null;

        persons.push({
          type: "person",
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
          suffix_name: suffixName,
        });
      }

      // Return multiple owners
      return { valid: true, owners: persons };
    }

    const firstMiddleTokens = firstMiddle.split(/\s+/).filter(Boolean);

    if (firstMiddleTokens.length === 0) {
      return { valid: false, reason: "no_first_name", raw: text };
    }

    const firstName = titleCase(firstMiddleTokens[0]);
    const middleName = firstMiddleTokens.length > 1
      ? firstMiddleTokens.slice(1).map(titleCase).join(" ")
      : null;

    const person = {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      suffix_name: suffixName,
    };
    return { valid: true, owner: person };
  } else {
    // Format: "FIRST MIDDLE LAST" (no comma)
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      return { valid: false, reason: "insufficient_name_parts", raw: text };
    }

    // Last token is the last name
    const lastName = titleCase(tokens[tokens.length - 1]);

    // First token is the first name
    const firstName = titleCase(tokens[0]);

    // Everything in between is middle name
    const middleName = tokens.length > 2
      ? tokens.slice(1, -1).map(titleCase).join(" ")
      : null;

    const person = {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      suffix_name: null,
    };
    return { valid: true, owner: person };
  }
}

// Extract parcel/property id
function extractPropertyId($) {
  // 1) By element id hints
  const idCandidates = [];
  $("[id]").each((_, el) => {
    const idAttr = el.attribs && el.attribs.id ? el.attribs.id : "";
    if (/parcelid|folio|property.*id|prop.*id|gisflnnum/i.test(idAttr)) {
      const txt = norm($(el).text());
      if (txt) idCandidates.push(txt);
    }
  });
  // 2) By label next to value
  $("td, th, span, div, label").each((_, el) => {
    const txt = norm($(el).text());
    if (/^parcel id$/i.test(txt)) {
      const nextText = norm(
        $(el).parent().find("span, div").not(el).first().text(),
      );
      if (nextText) idCandidates.push(nextText);
    }
  });
  // Prefer numeric long id
  let best = null;
  for (const cand of idCandidates) {
    const m = cand.match(/\d{6,}/);
    if (m) {
      best = m[0];
      break;
    }
  }
  if (!best && idCandidates.length) best = idCandidates[0];
  return best ? best : "unknown_id";
}

// Extract all plausible owner name strings from variable structures
function extractOwnerNameStrings($) {
  // Extract only from OwnerLine1, OwnerLine2, OwnerLine3, etc.
  // The last OwnerLine is always the address, so we skip it
  const ownerLines = [];

  // Find all OwnerLine spans
  for (let i = 1; i <= 10; i++) {
    const txt = norm($(`#OwnerLine${i}`).text());
    if (txt) {
      ownerLines.push(txt);
    } else {
      // Stop when we hit an empty line
      break;
    }
  }

  // Remove the last line (it's always the address/city)
  if (ownerLines.length > 0) {
    ownerLines.pop();
  }

  // Filter out any remaining address-like entries
  return ownerLines.filter(line => !isLikelyAddress(line));
}

// Deduplicate owners by normalized key
function normalizeKeyForDedup(owner) {
  if (owner.type === "company")
    return owner.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return parts;
}

// Build owners_by_date map
function buildOwnersByDate(validOwners) {
  const map = {};
  // For this dataset, we do not have explicit historical owner groupings near dates.
  // Place all current owners under the 'current' key.
  map["current"] = validOwners;
  return map;
}

// Main processing
(function main() {
  const propertyId = extractPropertyId($);

  const rawOwnerStrings = extractOwnerNameStrings($);
  const validOwners = [];
  const invalidOwners = [];

  // Classify and collect
  for (const raw of rawOwnerStrings) {
    const res = classifyOwner(raw);
    if (res.valid) {
      // Handle case where classifyOwner returns multiple owners (e.g., "LAST, FIRST=& FIRST2")
      if (res.owners && Array.isArray(res.owners)) {
        res.owners.forEach(owner => validOwners.push(owner));
      } else if (res.owner) {
        validOwners.push(res.owner);
      }
    } else {
      invalidOwners.push({ raw: norm(raw), reason: res.reason || "unknown" });
    }
  }

  // Deduplicate valid owners
  const seen = new Set();
  const deduped = [];
  for (const o of validOwners) {
    const key = normalizeKeyForDedup(o);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(o);
  }

  const ownersByDate = buildOwnersByDate(deduped);

  // Build final object
  const result = {};
  const propertyKey = `property_${propertyId || "unknown_id"}`;
  result[propertyKey] = {
    owners_by_date: ownersByDate,
    invalid_owners: invalidOwners,
  };

  // Persist file and print JSON
  const outDir = path.join(process.cwd(), "owners");
  const outPath = path.join(outDir, "owner_data.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result));
})();
