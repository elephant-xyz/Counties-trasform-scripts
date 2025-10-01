// owners/scripts/ownerMapping.js
// Single-file Node.js script that parses input.html with cheerio
// and outputs JSON matching the required schema, saving to owners/owner_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML from input.html in working directory
const INPUT_PATH = path.join(process.cwd(), "input.html");
const OUTPUT_DIR = path.join(process.cwd(), "owners");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "owner_data.json");

const html = fs.readFileSync(INPUT_PATH, "utf8");
const $ = cheerio.load(html);

// Utility: trim and single-space
function cleanText(t) {
  return (t || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Utility: convert dates like M/D/YYYY or MM/DD/YYYY to YYYY-MM-DD
function toISODate(mdY) {
  if (!mdY) return null;
  const s = mdY.trim();
  // Accept formats like 2/1/2004 or 02/01/2004
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = String(parseInt(m[1], 10)).padStart(2, "0");
  const dd = String(parseInt(m[2], 10)).padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Company detection (case-insensitive)
const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "co",
  "company",
  "corp",
  "corporation",
  "foundation",
  "alliance",
  "solutions",
  "services",
  "trust",
  " tr ",
  " tr.",
  " ttee",
  " trustee",
  "bank",
  "n.a",
  "na",
  "hoa",
  "association",
  "assn",
  "pllc",
  "pc",
  "lp",
  "llp",
  "ministries",
  "church",
  "holdings",
  "properties",
  "realty",
  "partners",
  "group",
];

function isCompanyName(name) {
  const n = ` ${name.toLowerCase()} `;
  return (
    COMPANY_KEYWORDS.some((kw) => n.includes(` ${kw} `)) ||
    /\btrust\b/i.test(name) ||
    /\btr\b\.?/i.test(name)
  );
}

// Strip common non-name markers
function stripNameNoise(raw) {
  let s = raw || "";
  s = s.replace(/^\*/g, ""); // leading asterisk
  s = s.replace(/\bH\s*&\s*W\b/gi, "");
  s = s.replace(/\bH\/W\b/gi, "");
  s = s.replace(/\bET\s*AL\b/gi, "");
  s = s.replace(/\bETAL\b/gi, "");
  s = s.replace(/\bC\/?O\b/gi, "");
  s = s.replace(/\bAS\s*TTEE\b/gi, "");
  s = s.replace(/\bTTEE\b/gi, "");
  s = s.replace(/\bTR U\/A\b/gi, "");
  s = s.replace(/\band\b/gi, "");
  s = s.replace(/\s{2,}/g, " ");
  s = s.trim();
  // remove dangling ampersand at end or beginning
  s = s.replace(/^&+|&+$/g, "").trim();
  return s;
}

// Determine if a string looks like an address (to avoid picking addresses as names)
function looksLikeAddress(s) {
  const t = s.toUpperCase();
  if (
    /\d/.test(t) &&
    /(\bAVE\b|\bAVENUE\b|\bST\b|\bSTREET\b|\bRD\b|\bROAD\b|\bLN\b|\bLANE\b|\bDR\b|\bDRIVE\b|\bBLVD\b|\bCOURT\b|\bCT\b)/.test(
      t,
    )
  )
    return true;
  if (/\bFL\b\s*\d{5}/.test(t)) return true; // state + ZIP
  if (/\d{5}(-\d{4})?$/.test(t)) return true; // ZIP
  return false;
}

// Normalize a name string for deduplication
function normalizeNameKey(s) {
  return cleanText(s).toLowerCase();
}

// Parse a person name from a raw string. Returns {first_name,last_name,middle_name?} or null if not confident
function parsePersonName(raw) {
  if (!raw) return null;
  let s = stripNameNoise(raw);
  // If still contains an ampersand joining another party and not obvious second name, just remove ampersand
  s = s.replace(/\s*&\s*/g, " ").trim();

  // If contains comma: LAST, FIRST MIDDLE
  if (s.includes(",")) {
    const [lastPart, restPart] = s.split(",", 2).map(cleanText);
    if (!lastPart || !restPart) return null;
    const restTokens = restPart.split(/\s+/);
    if (restTokens.length < 1) return null;
    const first = restTokens[0];
    const middle = restTokens.slice(1).join(" ") || null;
    const obj = {
      type: "person",
      first_name: capitalizeWord(first),
      last_name: capitalizeWord(lastPart),
    };
    if (middle) obj.middle_name = capitalizeName(middle);
    return obj;
  }

  // No comma: assume LAST FIRST MIDDLE (common in assessor data)
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const last = tokens[0];
  const first = tokens[1];
  const rest = tokens.slice(2).join(" ").trim();

  const obj = {
    type: "person",
    first_name: capitalizeWord(first),
    last_name: capitalizeWord(last),
  };
  if (rest) obj.middle_name = capitalizeName(rest);
  return obj;
}

function capitalizeWord(w) {
  if (!w) return w;
  const lower = w.toLowerCase();
  // handle suffix-like tokens (JR, SR, III) by uppercasing fully
  if (/^(jr|sr|ii|iii|iv|v)$/i.test(w)) return w.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function capitalizeName(s) {
  return s.split(/\s+/).map(capitalizeWord).join(" ");
}

// Classify raw name into person/company JSON or invalid
function classifyOwner(raw) {
  const cleaned = stripNameNoise(cleanText(raw));
  if (!cleaned) return { valid: false, reason: "empty_after_clean", raw };

  // Common non-owners to exclude
  const upper = cleaned.toUpperCase();
  if (
    upper.includes("UNKNOWN SELLER") ||
    upper === "UNKNOWN" ||
    upper.includes("CONVERSION")
  ) {
    return { valid: false, reason: "non_owner_placeholder", raw: cleaned };
  }

  if (isCompanyName(cleaned)) {
    // company
    return { valid: true, owner: { type: "company", name: cleaned } };
  }

  // Attempt person parse
  const person = parsePersonName(cleaned);
  if (person && person.first_name && person.last_name) {
    return { valid: true, owner: person };
  }

  return { valid: false, reason: "unclassified_name", raw: cleaned };
}

// Extract property ID (prefer explicit Prop ID/Property ID)
function extractPropertyId($root) {
  let id = null;
  // Look for two-column tables where left cell contains Prop ID or Property ID
  $("table").each((_, tbl) => {
    const $tbl = $(tbl);
    $tbl.find("tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = cleanText($(tds[0]).text()).toLowerCase();
        const value = cleanText($(tds[1]).text());
        if (
          !id &&
          (/\bprop id\b/.test(label) ||
            /\bproperty id\b/.test(label) ||
            /\bpropid\b/.test(label))
        ) {
          if (value) id = value;
        }
      }
    });
  });

  // Fallback to parcel id if needed
  if (!id) {
    let parcel = null;
    $("table").each((_, tbl) => {
      const $tbl = $(tbl);
      $tbl.find("tr").each((__, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = cleanText($(tds[0]).text()).toLowerCase();
          const value = cleanText($(tds[1]).text());
          if (!parcel && /\bparcel id\b/.test(label)) parcel = value;
        }
      });
    });
    id = parcel ? parcel : "unknown_id";
  }

  return id;
}

// Helper to split lines inside the Owner Information section using <br> boundaries
function extractOwnerLinesFromSection(ownerSection) {
  const $sec = $(ownerSection);
  const $content = $sec.find(".module-content").first();
  const html = $content.html() || "";
  let s = html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ") // strip tags
    .replace(/&amp;/g, "&");
  // Normalize whitespace and keep intentional newlines
  s = s.replace(/\r/g, "").replace(/\t/g, " ");
  // Collapse multiple spaces but preserve newlines
  s = s
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean)
    .join("\n");
  const lines = s
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean);
  return lines;
}

// Extract current owners from Owner Information section
function extractCurrentOwners($root) {
  const owners = [];
  const invalids = [];

  // Find the section header with text Owner Information
  let ownerSection = null;
  $("section").each((_, sec) => {
    const title = cleanText($(sec).find("header .title").first().text());
    if (/^owner information$/i.test(title)) ownerSection = sec;
  });

  const considered = new Set();

  if (ownerSection) {
    const lines = extractOwnerLinesFromSection(ownerSection);
    // Identify the index of the label "Primary Owner" if present
    let startIdx = 0;
    const idx = lines.findIndex((l) => /^primary owner$/i.test(l));
    if (idx >= 0) startIdx = idx + 1;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // Stop collecting when address lines begin
      if (looksLikeAddress(line)) break;
      // Skip UI labels
      if (/^view map$/i.test(line)) continue;
      if (/^owner information$/i.test(line)) continue;

      const cleaned = stripNameNoise(line);
      if (!cleaned) continue;
      const norm = normalizeNameKey(cleaned);
      if (considered.has(norm)) continue;
      considered.add(norm);

      const classification = classifyOwner(cleaned);
      if (classification.valid) {
        owners.push(classification.owner);
      } else {
        invalids.push({
          raw: classification.raw || cleaned,
          reason: classification.reason,
        });
      }
    }
  }

  // Fallback heuristic if no owners found due to unusual layout
  if (owners.length === 0 && ownerSection) {
    const texts = [];
    $(ownerSection)
      .find("*")
      .each((_, el) => {
        const t = cleanText($(el).text());
        if (t) texts.push(t);
      });
    const candidateLines = [];
    texts.forEach((t) => {
      const u = t.toUpperCase();
      if (u === "OWNER INFORMATION" || u === "PRIMARY OWNER") return;
      if (looksLikeAddress(t)) return;
      if (/\bFL\b/.test(u)) return;
      if (/^VIEW MAP$/i.test(t)) return;
      if (t.length > 60) return;
      if (/[A-Za-z]/.test(t)) candidateLines.push(t);
    });
    const seen = new Set();
    candidateLines.forEach((line) => {
      const cleaned = stripNameNoise(line);
      if (!cleaned) return;
      const norm = normalizeNameKey(cleaned.replace(/&/g, " "));
      if (seen.has(norm)) return;
      seen.add(norm);
      const classification = classifyOwner(cleaned);
      if (classification.valid) owners.push(classification.owner);
      else
        invalids.push({
          raw: classification.raw || cleaned,
          reason: classification.reason,
        });
    });
  }

  // Deduplicate by normalized string within current owners
  const unique = [];
  const nameSet = new Set();
  owners.forEach((o) => {
    let key = "";
    if (o.type === "company") key = normalizeNameKey(o.name);
    else
      key = normalizeNameKey(
        `${o.first_name} ${o.middle_name ? o.middle_name + " " : ""}${o.last_name}`,
      );
    if (!nameSet.has(key) && key) {
      nameSet.add(key);
      unique.push(o);
    }
  });

  return { owners: unique, invalids };
}

// Extract historical owners from Sales table (using Grantor and Sale Date)
function extractHistoricalOwners($root) {
  const byDate = new Map(); // date => array of owners
  const invalids = [];

  // Find Sales section table rows
  $("#ctlBodyPane_ctl15_ctl01_grdSales tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("th, td");
    if (tds.length < 8) return; // expect at least sale date and grantor
    const saleDateStr = cleanText($(tds[0]).text());
    const isoDate = toISODate(saleDateStr);
    const grantorCell = $(tds[7]);
    const grantorText = cleanText(grantorCell.text());
    if (!grantorText) return;

    const classification = classifyOwner(grantorText);
    if (classification.valid) {
      const owner = classification.owner;
      const key = isoDate || null;
      const mapKey = key || "__UNKNOWN__";
      if (!byDate.has(mapKey)) byDate.set(mapKey, []);
      // dedupe within date
      const arr = byDate.get(mapKey);
      const arrKey =
        owner.type === "company"
          ? normalizeNameKey(owner.name)
          : normalizeNameKey(
              `${owner.first_name} ${owner.middle_name ? owner.middle_name + " " : ""}${owner.last_name}`,
            );
      const exists = arr.some((o) => {
        if (o.type === "company" && owner.type === "company")
          return normalizeNameKey(o.name) === arrKey;
        if (o.type === "person" && owner.type === "person")
          return (
            normalizeNameKey(
              `${o.first_name} ${o.middle_name ? o.middle_name + " " : ""}${o.last_name}`,
            ) === arrKey
          );
        return false;
      });
      if (!exists) arr.push(owner);
    } else {
      invalids.push({
        raw: classification.raw || grantorText,
        reason: classification.reason,
      });
    }
  });

  return { byDate, invalids };
}

// Build final structure
const propertyIdRaw = extractPropertyId($);
const propertyId =
  propertyIdRaw && propertyIdRaw !== "unknown_id"
    ? propertyIdRaw
    : "unknown_id";

const { owners: currentOwners, invalids: invalidCurrent } =
  extractCurrentOwners($);
const { byDate: historicalByDate, invalids: invalidHistorical } =
  extractHistoricalOwners($);

// Convert Map to ordered object with YYYY-MM-DD keys ascending and unknown_date placeholders
const dateKeys = [];
const unknownGroups = [];
for (const [k, v] of historicalByDate.entries()) {
  if (k === "__UNKNOWN__") unknownGroups.push(v);
  else dateKeys.push(k);
}

// sort dates ascending chronologically
const validDateKeys = dateKeys
  .filter((d) => /\d{4}-\d{2}-\d{2}/.test(d))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const ownersByDate = {};
validDateKeys.forEach((d) => {
  ownersByDate[d] = historicalByDate.get(d) || [];
});

// Assign unknown date placeholders
let unkCounter = 1;
unknownGroups.forEach((arr) => {
  const key = `unknown_date_${unkCounter++}`;
  ownersByDate[key] = arr;
});

// Add current owners as final key
ownersByDate["current"] = currentOwners;

// Assemble invalid owners list
const invalid_owners = [...invalidCurrent, ...invalidHistorical];

const result = {};
const topKey = `property_${propertyId}`;
result[topKey] = {
  owners_by_date: ownersByDate,
  invalid_owners,
};

// Ensure output directory
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");

// Print to stdout
console.log(JSON.stringify(result, null, 2));
