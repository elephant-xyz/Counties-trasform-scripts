const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: read input
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Helper: trim and collapse whitespace
function cleanText(s) {
  return (s || "")
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/\s+/g, " ")
    .trim();
}

// Helper: Remove invalid chars
// function cleanPersonText(s) {
//   return (s || "")
//     .replace(/\u00A0/g, " ") // non-breaking space
//     .replace(/[^A-Za-z', .]/g, "") // Only keep valid characters
//     .trim();
// }
function cleanPersonText(s) {
  let cleaned = (s || "")
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/[^A-Za-z', .\-]/g, "") // Allow hyphen temporarily for processing
    .trim();

  // New logic: Remove trailing hyphens or other punctuation if not followed by a letter
  // This regex matches a hyphen, apostrophe, comma, or period at the end of the string
  // OR followed by a space and then the end of the string.
  // It ensures that if a punctuation mark is at the very end or only followed by spaces, it's removed.
  cleaned = cleaned.replace(/[-',.]+\s*$/, "");

  // Collapse multiple spaces and trim again
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

// Helper: Capitalize first letter of each word, lowercase rest
function toTitleCase(str) {
  if (!str) return "";
  // Split by allowed delimiters, keeping them in the result
  return str
    .split(/([ \-',.])/)
    .map((word, index) => {
      if (word.length === 0) return "";
      // If it's a delimiter, return as is
      if (index % 2 === 1) return word;
      // Otherwise, process the word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");
}

// Extract a likely property id (prefer 18-digit STRAP)
function extractPropertyId($) {
  const attrs = [];
  $("a, form, script, input, div, span").each((_, el) => {
    const attribs = el.attribs || {};
    for (const k in attribs) attrs.push(String(attribs[k] || ""));
  });
  // 1) strap=18digits in any attribute
  for (const v of attrs) {
    const m = v.match(/strap=(\d{18})/i);
    if (m) return m[1];
  }
  // 2) ParcelID=18digits
  for (const v of attrs) {
    const m = v.match(/ParcelID=(\d{18})/i);
    if (m) return m[1];
  }
  // 3) Look for text containing 18-digit blocks
  let found = null;
  $("*")
    .contents()
    .each((_, node) => {
      if (node.type === "text") {
        const t = String(node.data || "");
        const m = t.match(/(\d{18})/);
        if (m && !found) {
          found = m[1];
        }
      }
    });
  if (found) return found;
  return "unknown_id";
}

const propertyId = extractPropertyId($);

// Company detection keywords (case-insensitive)
const companyKeywords = [
  "inc", "llc", "ltd", "corp", "co", "lp", "pllc", "plc", "pc", // Common legal entities
  "foundation", "alliance", "solutions", "services", "trust", "associates",
  "association", "partners", "group", "holdings", "management", "properties",
  "realty", "development", "partnership", "syndicate", "capital", "investments",
  "enterprises", "ventures", "systems", "technologies", "global", "national",
  "international", "estate", "fund", "bank", "credit union", "church", "parish",
  "district", "county", "city", "town", "village", "board", "authority",
  "commission", "department", "agency", "bureau", "office", "school", "hospital",
  "medical center", "clinic", "charity", "non-profit", "club", "society",
  "fraternity", "sorority", "union", "guild", "coalition", "consortium",
  "network", "forum", "council", "committee",
  // Specific legal forms, often with periods
  "inc.", "llc.", "ltd.", "corp.", "co.", "lp.", "pllc.", "plc.", "pc.",
  "p.a.", "p.c.", "s.c.", "l.l.p.", "l.l.c.", "p.l.l.c.", "p.l.c.", "p.s.",
  // Common trust/estate indicators
  " tr ", "tr.", "trustee", "executor", "administrator", "guardian", "conservator",
  "receiver", "liquidator", "assignee", "successor", "nominee", "agent",
  "representative", "attorney", "law firm",
  // Other common company/entity terms
  "dba", "et al", // "Doing Business As", "and others"
];

function isCompany(nameRaw) {
  const name = ` ${nameRaw.toLowerCase()} `; // Pad with spaces for whole word matching

  // Check for common company suffixes/keywords
  if (companyKeywords.some(kw => {
      // Match whole words or common endings
      return name.includes(` ${kw} `) || // e.g., "ABC INC "
             name.endsWith(` ${kw}`) ||   // e.g., "ABC INC"
             name.includes(` ${kw}. `) || // e.g., "ABC INC. "
             name.endsWith(` ${kw}.`);    // e.g., "ABC INC."
  })) {
      return true;
  }

  // Additional heuristic: If the name contains "THE" followed by a common company term
  // e.g., "THE JOHN DOE TRUST"
  if (name.startsWith(" the ") && companyKeywords.some(kw => name.includes(` ${kw}`))) {
      return true;
  }

  // Heuristic: If the name contains "DBA" (Doing Business As)
  if (/\bdba\b/i.test(nameRaw)) {
      return true;
  }

  // Heuristic: If the name contains "ET AL" (and others) - often indicates multiple parties,
  // but in owner lists, it's often a company or a group treated as one entity.
  if (/\bet al\b/i.test(nameRaw)) {
      return true;
  }

  return false;
}

function splitAmpersand(name) {
  if (!name || name.indexOf("&") === -1) return [name];
  return name.split("&").map((p) => cleanText(p));
}

function normalizeNameKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") {
    return cleanText(owner.name).toLowerCase();
  }
  const parts = [
    owner.first_name,
    owner.middle_name || "",
    owner.last_name,
    owner.suffix_name || "", // Include suffix in key for better deduplication
  ]
    .filter(Boolean)
    .map((x) => cleanText(x).toLowerCase());
  return parts.join(" ").trim();
}

// Map for suffix formatting to match schema enum (e.g., "Jr" -> "Jr.")
const suffixFormatMap = {
  "Jr": "Jr.", "Sr": "Sr.", "II": "II", "III": "III", "IV": "IV", "V": "V",
  "PhD": "PhD", "MD": "MD", "Esq": "Esq.", "JD": "JD", "LLM": "LLM",
  "MBA": "MBA", "RN": "RN", "DDS": "DDS", "DVM": "DVM", "CFA": "CFA",
  "CPA": "CPA", "PE": "PE", "PMP": "PMP", "Emeritus": "Emeritus", "Ret": "Ret."
};

function parsePersonName(raw) {
  // Remove periods initially, we'll re-add if needed for suffixes or specific cases
  const s = cleanText(raw).replace(/\./g, "").replace(/\s+/g, " ");
  if (!s) return { invalid: true, reason: "empty" };

  // NEW CHECK: Invalidate if name contains digits
  if (/\d/.test(s)) {
    return { invalid: true, reason: "name contains digits" };
  }

  let firstName = null;
  let lastName = null;
  let middleName = null;
  let suffixName = null;

  // Common suffixes to check for (case-insensitive)
  const suffixes = ["JR", "SR", "II", "III", "IV", "ESQ", "MD", "PHD"];
  // Create a regex that matches whole words for suffixes
  const suffixRegex = new RegExp(`\\b(${suffixes.join("|")})\\b`, "i");

  // Check for and extract suffix first
  let nameWithoutSuffix = s;
  const suffixMatch = s.match(suffixRegex);
  if (suffixMatch) {
    const rawSuffix = toTitleCase(suffixMatch[1]);
    suffixName = suffixFormatMap[rawSuffix] || rawSuffix; // Apply formatting from map
    // Remove the matched suffix from the name string
    nameWithoutSuffix = s.replace(suffixMatch[0], "").trim();
  }

  // Handle comma-delimited: LAST, FIRST MIDDLE
  if (nameWithoutSuffix.includes(",")) {
    const parts = nameWithoutSuffix.split(",").map(cleanText);
    if (parts.length < 2)
      return { invalid: true, reason: "malformed comma-separated name" };

    lastName = toTitleCase(parts[0]);
    const restTokens = parts[1].split(" ").filter(Boolean);
    if (restTokens.length === 0)
      return { invalid: true, reason: "no first name after comma" };

    firstName = toTitleCase(restTokens[0]);
    middleName = restTokens.slice(1).map(toTitleCase).join(" ") || null;
  } else {
    // No comma, assume FIRST [MIDDLE] LAST or LAST FIRST [MIDDLE]
    const tokens = nameWithoutSuffix.split(" ").filter(Boolean);
    if (tokens.length < 2)
      return { invalid: true, reason: "not enough tokens" };

    // Heuristic: If all caps, assume LAST FIRST [MIDDLE]
    const isAllCaps = tokens.every((t) => t === t.toUpperCase());
    if (isAllCaps) {
      lastName = toTitleCase(tokens[0]);
      firstName = toTitleCase(tokens[1]);
      middleName = tokens.slice(2).map(toTitleCase).join(" ") || null;
    } else {
      // Default to FIRST [MIDDLE] LAST
      firstName = toTitleCase(tokens[0]);
      lastName = toTitleCase(tokens[tokens.length - 1]);
      middleName = tokens.slice(1, -1).map(toTitleCase).join(" ") || null;
    }
  }

  // Final check for empty names after processing
  if (!firstName || !lastName) {
    return { invalid: true, reason: "could not parse first or last name" };
  }

  // Ensure middle_name is null if empty string
  if (middleName === "") middleName = null;
  // Ensure suffix_name is null if empty string
  if (suffixName === "") suffixName = null;
  // Construct the person object with all required fields, including placeholders
  return {
    type: "person",
    first_name: cleanPersonText(firstName),
    last_name: cleanPersonText(lastName),
    middle_name: cleanPersonText(middleName),
    suffix_name: suffixName,
  };
}

function classifyOwner(rawName) {
  const name = cleanText(rawName);
  if (!name) return { invalid: true, reason: "empty" };

  // If contains ampersand, split into multiple owners
  const parts = splitAmpersand(name);
  const owners = [];
  const invalids = [];
  for (const p of parts) {
    if (!p) continue;
    if (isCompany(p)) {
      const n = cleanText(p).replace(/\s+/g, " ");
      if (n) {
        owners.push({
          type: "company",
          name: n,
        });
      } else invalids.push({ raw: p, reason: "empty after clean" });
    } else {
      const person = parsePersonName(p);
      if (person.invalid) invalids.push({ raw: p, reason: person.reason });
      else owners.push(person);
    }
  }
  return { owners, invalids };
}

// Extract current owners (Owners section)
function extractCurrentOwners($) {
  const owners = [];
  const invalids = [];
  $("h4").each((_, h) => {
    const txt = cleanText($(h).text());
    if (/^Owners\b/i.test(txt)) {
      const table = $(h).nextAll("table").first();
      table.find("tr").each((__, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 1) {
          const raw = cleanText($(tds[0]).text());
          const name = cleanText(raw.replace(/\s*\d+%\s*$/, ""));
          if (name) {
            const res = classifyOwner(name);
            if (res.owners && res.owners.length) owners.push(...res.owners);
            if (res.invalids && res.invalids.length)
              invalids.push(...res.invalids);
          }
        }
      });
    }
  });
  return { owners, invalids };
}

// Extract sales history owners by date
function toISODate(dateStr) {
  const s = cleanText(dateStr);
  // MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const yyyy = m[2];
    return `${yyyy}-${mm}-01`;
  }
  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function extractHistoricalOwners($) {
  const byDate = {};
  const invalids = [];
  const saleTables = $("#saleHist table");
  saleTables.each((_, tbl) => {
    $(tbl)
      .find("tr")
      .each((__, tr) => {
        const $tr = $(tr);
        if ($tr.hasClass("header")) return; // skip header rows
        const tds = $tr.find("td");
        if (tds.length >= 5) {
          const dateTxt = cleanText($(tds[1]).text());
          const grantee = cleanText($(tds[4]).text());
          if (!grantee || /^grantee$/i.test(grantee)) return;
          const iso = toISODate(dateTxt) || null;
          const key = iso || null;
          const res = classifyOwner(grantee);
          if (!key) {
            // If we cannot parse date, assign an unknown placeholder later
            if (res.owners && res.owners.length) {
              if (!byDate.__unknown) byDate.__unknown = [];
              byDate.__unknown.push(...res.owners);
            }
            if (res.invalids && res.invalids.length)
              invalids.push(...res.invalids);
            return;
          }
          if (!byDate[key]) byDate[key] = [];
          if (res.owners && res.owners.length) byDate[key].push(...res.owners);
          if (res.invalids && res.invalids.length)
            invalids.push(...res.invalids);
        }
      });
  });
  return { byDate, invalids };
}

// Extract any other plausible owners from hidden more-info blocks (as backup)
function extractMoreInfoOwners($) {
  const owners = [];
  const invalids = [];
  $("div.more-info").each((_, d) => {
    const txt = cleanText($(d).text());
    const m = txt.match(/Grantee Name:\s*(.+)$/i);
    if (m) {
      const name = cleanText(m[1]);
      if (name) {
        const res = classifyOwner(name);
        if (res.owners && res.owners.length) owners.push(...res.owners);
        if (res.invalids && res.invalids.length)
          invalids.push(...res.invalids);
      }
    }
  });
  return { owners, invalids };
}

// Deduplicate owners within an array
function dedupeOwners(list) {
  const seen = new Set();
  const out = [];
  for (const o of list) {
    const key = normalizeNameKey(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Ensure middle_name and suffix_name are null if present and empty string
    if (o.type === "person") {
      if (o.middle_name === "" || o.middle_name === undefined) {
        o.middle_name = null; // Set to null instead of deleting if schema requires it
      }
      if (o.suffix_name === "" || o.suffix_name === undefined) {
        o.suffix_name = null; // Set to null instead of deleting if schema requires it
      }
      // Other required fields (birth_date, prefix_name, us_citizenship_status, veteran_status)
      // are already initialized to null in parsePersonName, so no need to check here.
    }
    out.push(o);
  }
  return out;
}

// Build owners_by_date
const invalid_owners = [];

const currentRes = extractCurrentOwners($);
let currentOwners = dedupeOwners(currentRes.owners);
invalid_owners.push(...currentRes.invalids);

const histRes = extractHistoricalOwners($);
const histByDateRaw = histRes.byDate;
invalid_owners.push(...histRes.invalids);

const backupRes = extractMoreInfoOwners($);
invalid_owners.push(...backupRes.invalids);

// Merge backup owners without dates into unknown bucket if they are not already captured in dated groups
if (backupRes.owners && backupRes.owners.length) {
  const allDated = Object.values(histByDateRaw).flat();
  const datedKeys = new Set(allDated.map(normalizeNameKey));
  const unknowns = [];
  for (const o of backupRes.owners) {
    const key = normalizeNameKey(o);
    if (!datedKeys.has(key)) unknowns.push(o);
  }
  if (unknowns.length) {
    if (!histByDateRaw.__unknown) histByDateRaw.__unknown = [];
    histByDateRaw.__unknown.push(...unknowns);
  }
}

// Dedupe per date group
const owners_by_date = {};

// Sort dates ascending; ensure valid YYYY-MM-DD keys
const dateKeys = Object.keys(histByDateRaw).filter((k) => k !== "__unknown");
const validDate = /^\d{4}-\d{2}-\d{2}$/;
const sorted = dateKeys
  .filter((k) => validDate.test(k))
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

for (const k of sorted) {
  owners_by_date[k] = dedupeOwners(histByDateRaw[k] || []);
}

// Handle unknown date groups with unique placeholders
if (histByDateRaw.__unknown && histByDateRaw.__unknown.length) {
  const unk = dedupeOwners(histByDateRaw.__unknown);
  if (unk.length) {
    let idx = 1;
    let key;
    do {
      key = `unknown_date_${idx}`;
      idx += 1;
    } while (owners_by_date[key]);
    owners_by_date[key] = unk;
  }
}

// Append current owners last, as required
owners_by_date["current"] = currentOwners;

// Final object
const result = {};
result[`property_${propertyId}`] = {
  owners_by_date,
  invalid_owners: invalid_owners.map((x) => ({
    raw: x.raw || "",
    reason: x.reason || "invalid",
  })),
};

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(JSON.stringify(result, null, 2));