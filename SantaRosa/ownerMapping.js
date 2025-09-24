// Owner Mapping Transformation Script
// Parses input.html using cheerio to extract property ID and owners (current and historical)
// Builds JSON per required schema and writes to owners/owner_data.json, then prints JSON to stdout.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// Utilities
const readHTML = () => fs.readFileSync(path.resolve("input.html"), "utf8");

function extractPropertyId($) {
  // Try common places
  let id = $('[data-cell="Parcel Number"]').first().text().trim();
  if (!id) {
    $("h1, h2, th, td, span, div").each((_, el) => {
      if (id) return;
      const t = $(el).text().trim();
      if (/parcel/i.test(t)) {
        const m = t.match(/[A-Za-z0-9]{2}[-A-Za-z0-9]+/);
        if (m) id = m[0];
      }
    });
  }
  if (!id) id = "unknown_id";
  return id;
}

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function toISODate(mmddyyyy) {
  const s = normalizeWhitespace(mmddyyyy);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "limited",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corporation",
  "co",
  "co.",
  "company",
  "services",
  "service",
  "trust",
  "tr",
  "tr.",
  "bank",
  "na",
  "n.a.",
  "assn",
  "association",
  "dept",
  "department",
  "authority",
  "agency",
  "estate",
  "university",
  "church",
  "ministries",
  "ministry",
  "school",
  "county",
  "city",
  "clerk",
  "court",
  "courts",
  "federal",
  "state",
  "lp",
  "llp",
  "plc",
  "pc",
  "p.a",
  "p.a.",
  "credit union",
];

function isCompanyName(raw) {
  const name = normalizeWhitespace(raw).toLowerCase();
  if (!name) return false;
  return COMPANY_KEYWORDS.some((k) => name.includes(k));
}

function cleanName(raw) {
  return normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
    .replace(/\./g, "")
    .replace(/\*/g, "")
    .replace(/,+/g, " ")
    .replace(/\s{2,}/g, " ")
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

function splitByDelimiters(raw) {
  // Split on & and / which frequently separate multiple owners
  let parts = cleanName(raw)
    .split(/\s*[&\/]+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 && cleanName(raw)) parts = [cleanName(raw)];
  return parts;
}

function parsePersonName(raw, inferredLastName = null) {
  const name = cleanName(raw);
  if (!name) return null;

  // Handle comma format: LAST, FIRST MIDDLE
  if (name.includes(",")) {
    const [lastPart, restPart] = name.split(",").map((s) => s.trim());
    if (!restPart) return null;
    const restTokens = restPart.split(/\s+/).filter(Boolean);
    const first = restTokens[0] || null;
    const middle = restTokens.slice(1).join(" ") || null;
    if (!first || !lastPart) return null;
    return {
      type: "person",
      first_name: cleanInvalidCharsFromName(first),
      last_name: cleanInvalidCharsFromName(lastPart),
      middle_name: cleanInvalidCharsFromName(middle) || null,
    };
  }

  // If inferred last name is provided and current segment doesn't appear to contain a surname, prepend it
  const tokens = name.split(/\s+/).filter(Boolean);

  // Heuristic: SRC PA format often is LAST FIRST [MIDDLE]
  if (tokens.length === 1 && inferredLastName) {
    // Single token probably a given name; use inferred last name
    return {
      type: "person",
      first_name: cleanInvalidCharsFromName(tokens[0]),
      last_name: cleanInvalidCharsFromName(inferredLastName),
      middle_name: null,
    };
  }

  if (tokens.length >= 2) {
    // Decide ordering. On these pages names are typically in ALL CAPS as LAST FIRST MIDDLE
    const firstToken = tokens[0];
    const secondToken = tokens[1];

    // If inferred last name is present and tokens do not include it, assume format FIRST [MIDDLE] and apply inferred last name
    if (
      inferredLastName &&
      tokens[0] !== inferredLastName &&
      tokens[tokens.length - 1] !== inferredLastName
    ) {
      const first = tokens[0];
      const middle = tokens.slice(1).join(" ") || null;
      return {
        type: "person",
        first_name: cleanInvalidCharsFromName(first),
        last_name: cleanInvalidCharsFromName(inferredLastName),
        middle_name: cleanInvalidCharsFromName(middle) || null,
      };
    }

    // Default: LAST FIRST [MIDDLE]
    const last = firstToken;
    const first = secondToken || null;
    const middle = tokens.slice(2).join(" ") || null;
    if (!first || !last) return null;
    return {
      type: "person",
      first_name: cleanInvalidCharsFromName(first),
      last_name: cleanInvalidCharsFromName(last),
      middle_name: cleanInvalidCharsFromName(middle) || null,
    };
  }

  return null;
}

function classifyAndSplitOwners(raw) {
  const original = normalizeWhitespace(raw);
  if (!original) return { valid: [], invalid: [] };

  const parts = splitByDelimiters(original);

  // Infer shared surname if group begins with a clear surname then '&' segments follow without surname.
  let inferredLastName = null;
  if (parts.length >= 1) {
    const headTokens = cleanName(parts[0]).split(/\s+/).filter(Boolean);
    if (headTokens.length >= 2) {
      // Assume first token is last name in SRC format
      inferredLastName = headTokens[0];
    }
  }

  const valid = [];
  const invalid = [];

  parts.forEach((segment, idx) => {
    const seg = cleanName(segment);
    if (!seg) return;

    if (isCompanyName(seg)) {
      valid.push({ type: "company", name: seg });
      return;
    }

    // Some segments may already include the shared surname
    let person = parsePersonName(seg, idx === 0 ? null : inferredLastName);
    if (!person || !person.first_name || !person.last_name) {
      invalid.push({ raw: seg, reason: "unparsable_person" });
      return;
    }

    valid.push(person);
  });

  return { valid, invalid };
}

function normalizeOwnerKey(owner) {
  if (!owner) return null;
  if (owner.type === "company")
    return `company::${owner.name}`.toLowerCase().trim();
  const fn = (owner.first_name || "").toLowerCase().trim();
  const ln = (owner.last_name || "").toLowerCase().trim();
  const mn = (owner.middle_name || "").toLowerCase().trim();
  return `person::${ln}|${fn}|${mn}`;
}

function dedupeOwners(owners) {
  const map = new Map();
  owners.forEach((o) => {
    const key = normalizeOwnerKey(o);
    if (!key) return;
    if (!map.has(key)) map.set(key, o);
  });
  return Array.from(map.values());
}

function extractCurrentOwners($) {
  // Prefer explicit Owner Information table cell
  let ownerText = "";
  const ownerCells = $(
    'td[data-cell="Owner"], [data-cell="Primary Owner"], td:contains("Owner").text-start',
  );
  if (ownerCells.length) {
    ownerText = $(ownerCells.get(0)).text();
    ownerText = normalizeWhitespace(ownerText);
  }
  let additionalOwnerText = "";
  const additionalOwnerCells = $(
    'td[data-cell="Additional"], [data-cell="Additional"], td:contains("Additional").text-start',
  );
  if (additionalOwnerCells.length) {
    additionalOwnerText = $(additionalOwnerCells.get(0)).text();
    additionalOwnerText = normalizeWhitespace(additionalOwnerText);
  }
  return ownerText + " & " + additionalOwnerText;
}

function extractSales($) {
  const rows = [];
  $("div#salesContainer table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const date = normalizeWhitespace(
      $tr.find('[data-cell="Sale Date"]').text(),
    );
    const grantee = normalizeWhitespace(
      $tr.find('[data-cell="Grantee"]').text(),
    );
    const grantor = normalizeWhitespace(
      $tr.find('[data-cell="Grantor"]').text(),
    );
    if (!date && !grantee && !grantor) return; // header or irrelevant row
    rows.push({ date, grantee, grantor });
  });
  return rows;
}

(function main() {
  const html = readHTML();
  const $ = cheerio.load(html);

  
  const propertySeed = readJSON("property_seed.json");
  const propertyId = propertySeed["parcel_id"];

  const ownersByDate = {};
  const invalidOwners = [];

  // Current owners
  const currentOwnerRaw = extractCurrentOwners($);
  if (currentOwnerRaw) {
    const { valid, invalid } = classifyAndSplitOwners(currentOwnerRaw);
    invalid.forEach((inv) => invalidOwners.push(inv));
    ownersByDate["current"] = dedupeOwners(valid);
  } else {
    ownersByDate["current"] = [];
  }

  // Historical from Sales (use Grantee as owners at that sale date)
  const salesRows = extractSales($);
  let unknownCounter = 0;
  salesRows.forEach((row) => {
    // Prefer Grantee; if missing, skip
    const hasGrantee = !!row.grantee && row.grantee.replace(/\s+/g, "") !== "";
    const dateISO = toISODate(row.date);
    let key = dateISO;
    if (!dateISO) {
      if (!hasGrantee) return; // nothing to map
      unknownCounter += 1;
      key = `unknown_date_${unknownCounter}`;
    }
    if (!hasGrantee) return;
    const { valid, invalid } = classifyAndSplitOwners(row.grantee);
    invalid.forEach((inv) => invalidOwners.push(inv));
    const deduped = dedupeOwners(valid);
    if (deduped.length === 0) return;
    if (!ownersByDate[key]) ownersByDate[key] = [];
    ownersByDate[key] = dedupeOwners([
      ...(ownersByDate[key] || []),
      ...deduped,
    ]);
  });

  // Ensure chronological order for date keys and append current last
  const dateEntries = Object.entries(ownersByDate)
    .filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const unknownEntries = Object.entries(ownersByDate)
    .filter(([k]) => /^unknown_date_\d+$/.test(k))
    .sort(([a], [b]) => {
      const na = parseInt(a.split("_").pop(), 10);
      const nb = parseInt(b.split("_").pop(), 10);
      return na - nb;
    });

  const resultOrdered = {};
  dateEntries.forEach(([k, v]) => {
    resultOrdered[k] = v;
  });
  unknownEntries.forEach(([k, v]) => {
    resultOrdered[k] = v;
  });
  resultOrdered["current"] = ownersByDate["current"] || [];

  const rootKey = `property_${propertyId || "unknown_id"}`;
  const output = {};
  output[rootKey] = {
    owners_by_date: resultOrdered,
    invalid_owners: invalidOwners,
  };

  // Write to owners/owner_data.json
  const outDir = path.resolve("owners");
  const outPath = path.join(outDir, "owner_data.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  // Print to stdout
  console.log(JSON.stringify(output, null, 2));
})();
