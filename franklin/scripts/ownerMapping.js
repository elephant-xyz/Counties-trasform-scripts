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
  return (str || "")
    .toLowerCase()
    .replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
}

// Extract property id
function extractPropertyId($) {
  const candidates = [];
  const titleText = $("title").text() || "";
  candidates.push(titleText);
  candidates.push($(".title h1").text());
  candidates.push($('.nav a[href*="pin="]').attr("href") || "");
  const text = candidates.join(" ");
  const match = text.match(/\b\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4}\b/);
  if (match) return match[0];
  return "unknown_id";
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
  return COMPANY_KEYWORDS.some((k) => n.includes(k));
}

// Parse possible multiple owners joined by '&' or ' and '
function splitJointOwners(raw) {
  const s = normalizeSpace(raw);
  if (!s) return [];
  // Split on & or ' and ' while preserving meaningful tokens
  const parts = s
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((p) => normalizeSpace(p))
    .filter(Boolean);
  return parts.length ? parts : [s];
}

// Detect if a string looks like a person name in LAST FIRST [MIDDLE] format (common on PA sites)
function looksLikePerson(name) {
  const s = normalizeSpace(name);
  if (!s) return false;
  if (isCompanyName(s)) return false;
  // Discard obvious non-names (has digits)
  if (/\d/.test(s)) return false;
  const tokens = s.split(" ");
  // Typical person patterns: 2-4 tokens, usually last-first-middle or first-middle-last
  return tokens.length >= 2 && tokens.length <= 4;
}

// Build a person object using inferred pattern
function buildPerson(first, last, middle) {
  return {
    type: "person",
    first_name: titleCase(first),
    last_name: titleCase(last),
    middle_name: middle ? titleCase(middle) : null,
  };
}

// Build person object from a tokenized name. Prefer LAST FIRST [MIDDLE] if all uppercase without comma
function parsePerson(name, fallbackLastName, idxInGroup) {
  const s = normalizeSpace(name).replace(/\s+,\s+/g, ", ");
  const upper = s === s.toUpperCase();
  const tokens = s.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  // If this is a secondary joint owner in uppercase with no obvious last name, use FIRST [MIDDLE] + fallback last
  if (upper && idxInGroup > 0 && fallbackLastName) {
    const first = tokens[0];
    const middle = tokens.slice(1).join(" ") || null;
    return buildPerson(first, fallbackLastName, middle);
  }

  if (upper) {
    // Assume LAST FIRST [MIDDLE]
    const last = tokens[0];
    const first = tokens[1] || null;
    const middle = tokens.length >= 3 ? tokens.slice(2).join(" ") : null;
    if (!first || !last) return null;
    return buildPerson(first, last, middle);
  } else {
    // Assume FIRST [MIDDLE] LAST
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null;
    if (!first || !last) return null;
    return buildPerson(first, last, middle);
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

    // Determine fallback last name from first part tokens if uppercase and looks like LAST FIRST
    let fallbackLast = null;
    if (parts.length >= 1) {
      const firstPart = normalizeSpace(parts[0]);
      const firstPartTokens = firstPart
        .replace(/,/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      if (
        firstPartTokens.length >= 2 &&
        firstPart === firstPart.toUpperCase()
      ) {
        fallbackLast = firstPartTokens[0];
      }
    }

    for (let idx = 0; idx < parts.length; idx++) {
      const raw = parts[idx];
      const clean = normalizeSpace(raw.replace(/\.$/, ""));

      if (!clean) continue;

      if (
        isCompanyName(clean) ||
        /\b(revocable|living)\b\s*\btrust\b/i.test(clean)
      ) {
        owners.push({ type: "company", name: clean });
        continue;
      }

      if (looksLikePerson(clean)) {
        const person = parsePerson(clean, fallbackLast, idx);
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
        invalid.push({ raw: clean, reason: "unrecognized_owner_format" });
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
