const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf-8");
const $ = cheerio.load(html);

// Utilities
const text = (el) => $(el).text().trim();
const normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const cleanWhitespace = (s) =>
  (s || "")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Property ID extraction with fallbacks
function getPropertyId() {
  let id = $('span[id*="PARCEL_KEYLabel"]').first().text().trim();
  if (!id) {
    id = $("input#hidParcelKey").attr("value") || "";
  }
  if (!id) {
    // try to find in details table near text 'Parcel Key:'
    $("table").each((i, tbl) => {
      const html = $(tbl).html() || "";
      if (html.includes("Parcel Key")) {
        const span = $(tbl).find("span").first();
        if (span.length) {
          id = span.text().trim();
        }
      }
    });
  }
  return id || "unknown_id";
}

// Company detection
function isCompanyName(name) {
  const n = name.toLowerCase();
  const patterns = [
    " inc",
    "inc.",
    " llc",
    "l.l.c",
    " ltd",
    " co ",
    " co.",
    " company",
    " corp",
    "corp.",
    "corporation",
    " foundation",
    " alliance",
    " solutions",
    " services",
    " trust",
    " trustees",
    " bank",
    " national",
    " holdings",
    " properties",
    " group",
    " llp",
    " lp ",
    " pllc",
    " plc",
    " pc ",
    " association",
    " church",
    " ministries",
  ];
  return patterns.some((p) => n.includes(p));
}

// Remove legal/suffix/qualifiers from a personal name string
function stripQualifiers(raw) {
  let s = " " + raw + " ";
  const removeList = [
    " ET UX",
    " ET VIR",
    " ET ALIA",
    " ET AL",
    " ETAL",
    " ET ",
    " TRS",
    " TR",
    " TTEE",
    " TRUSTEES",
    " TRUSTEE",
    " JR",
    " SR",
    " II",
    " III",
    " IV",
    " V",
    " VI",
    " VII",
    " MD",
    " PHD",
    " ESQ",
    " ESQUIRE",
  ];
  removeList.forEach((r) => {
    const re = new RegExp(r.replace(/\s+/g, "\\s+"), "ig");
    s = s.replace(re, " ");
  });
  return s.replace(/\s+/g, " ").trim();
}

// Parse date MM/DD/YYYY to YYYY-MM-DD; return null if invalid
function toISODate(mdY) {
  const s = (mdY || "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// Name classification
function classifyOwner(raw, invalid_owners) {
  const original = cleanWhitespace(raw);
  if (!original) return null;
  const cleaned = original.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

  // Company
  if (isCompanyName(" " + cleaned + " ")) {
    return { type: "company", name: cleaned };
  }

  // Split couples connected with '&' or ' and '
  if (/[&]/.test(cleaned) || /\band\b/i.test(cleaned)) {
    // When multiple people listed together without clear last names for each,
    // attempt to split and parse each sub-name separately. If ambiguous, record invalid.
    const parts = cleaned
      .split(/\s*&\s*|\s+and\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1) {
      // fall through to single person parsing
    } else {
      // Try to infer last name from the final token of the last part if missing
      const lastTokens = parts[parts.length - 1].split(/\s+/);
      const inferredLast = lastTokens[lastTokens.length - 1];
      const persons = [];
      parts.forEach((p) => {
        const noQual = stripQualifiers(p);
        const tokens = noQual.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          // Assume LAST FIRST format if looks like LAST FIRST
          const last = tokens[0];
          const first = tokens[1];
          const middle = tokens.slice(2).join(" ") || null;
          persons.push({
            type: "person",
            first_name: cap(first),
            last_name: cap(last),
            middle_name: middle ? cap(middle) : null,
          });
        } else if (tokens.length === 1) {
          // Single token; attach inferred last name
          persons.push({
            type: "person",
            first_name: cap(tokens[0]),
            last_name: cap(inferredLast),
            middle_name: null,
          });
        }
      });
      if (persons.length) return persons; // caller must handle array result
      invalid_owners.push({
        raw: original,
        reason: "ambiguous_multi_person_name",
      });
      return null;
    }
  }

  // Single person path
  const noQual = stripQualifiers(cleaned);
  const tokens = noQual.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    invalid_owners.push({
      raw: original,
      reason: "insufficient_tokens_for_person",
    });
    return null;
  }

  // Detect patterns: if contains a comma, treat as LAST, FIRST MIDDLE
  if (noQual.includes(",")) {
    const [lastPart, rest] = noQual.split(",").map((s) => s.trim());
    const restTokens = (rest || "").split(/\s+/).filter(Boolean);
    const first = restTokens[0] || null;
    const middle = restTokens.slice(1).join(" ") || null;
    if (!first) {
      invalid_owners.push({
        raw: original,
        reason: "missing_first_name_after_comma",
      });
      return null;
    }
    return {
      type: "person",
      first_name: cap(first),
      last_name: cap(lastPart),
      middle_name: middle ? cap(middle) : null,
    };
  }

  // Default heuristic: assume format LAST FIRST [MIDDLE ...]
  const last = tokens[0];
  const first = tokens[1];
  const middle = tokens.slice(2).join(" ") || null;
  return {
    type: "person",
    first_name: cap(first),
    last_name: cap(last),
    middle_name: middle ? cap(middle) : null,
  };
}

function cap(s) {
  if (!s) return s;
  return s
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  owners.forEach((o) => {
    if (!o) return;
    const key =
      o.type === "company"
        ? `company:${normalize(o.name)}`
        : `person:${normalize(o.first_name)}:${normalize(o.middle_name || "")}:${normalize(o.last_name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(o);
  });
  return out;
}

// Extract current owners
function getCurrentOwners(invalid_owners) {
  let owners = [];
  // Direct spans in Owner Information
  const spans = $('span[id*="OWNER_NAMELabel"]')
    .map((i, el) => $(el).text().trim())
    .get();
  if (spans.length) {
    owners = spans;
  } else {
    // Fallback: Search results Owner Name cell
    const cell = $("#MainContent_gvParcelResults tr").eq(1).find("td").eq(2);
    if (cell && cell.length) {
      const raw = cell.text().trim();
      const parts = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      owners = parts.length ? parts : raw ? [raw] : [];
    }
  }

  const parsed = [];
  owners.forEach((n) => {
    const classified = classifyOwner(n, invalid_owners);
    if (Array.isArray(classified)) {
      parsed.push(...classified);
    } else if (classified) {
      parsed.push(classified);
    }
  });
  return dedupeOwners(parsed);
}

// Extract historical owners from Sales table (Grantee by Sale Date)
function getHistoricalOwnersByDate(invalid_owners) {
  const rows = $("#MainContent_frmParcelDetail_gvSales tr").slice(1);
  const groups = {};
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const dateStr = text(tds.eq(0));
    const iso = toISODate(dateStr);
    const granteeCell = tds.last();
    const granteeRaw = text(granteeCell);
    if (!granteeRaw) return;
    const key =
      iso ||
      `unknown_date_${Object.keys(groups).filter((k) => k.startsWith("unknown_date_")).length + 1}`;

    const splitParts = granteeRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const nameParts = splitParts.length ? splitParts : [granteeRaw];

    const owners = groups[key] || [];
    nameParts.forEach((g) => {
      const classified = classifyOwner(g, invalid_owners);
      if (Array.isArray(classified)) {
        owners.push(...classified);
      } else if (classified) {
        owners.push(classified);
      }
    });
    groups[key] = dedupeOwners(owners);
  });

  // Sort keys chronologically (unknown placeholders come first based on numbering)
  const dated = Object.keys(groups)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  const unknowns = Object.keys(groups)
    .filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D+/g, "")) || 0;
      const nb = parseInt(b.replace(/\D+/g, "")) || 0;
      return na - nb;
    });
  const ordered = [...dated, ...unknowns];
  const orderedMap = {};
  ordered.forEach((k) => {
    orderedMap[k] = groups[k];
  });
  return orderedMap;
}

// Build final structure
const invalid_owners = [];
const propertyId = getPropertyId();
const currentOwners = getCurrentOwners(invalid_owners);
const historical = getHistoricalOwnersByDate(invalid_owners);

// Assemble owners_by_date with chronological dates first, then current
const owners_by_date = {};
Object.keys(historical).forEach((k) => {
  owners_by_date[k] = historical[k];
});
owners_by_date["current"] = currentOwners;

const result = {
  [`property_${propertyId}`]: {
    owners_by_date,
    invalid_owners: invalid_owners,
  },
};

// Save and print
fs.mkdirSync(path.dirname("owners/owner_data.json"), { recursive: true });
fs.writeFileSync(
  "owners/owner_data.json",
  JSON.stringify(result, null, 2),
  "utf-8",
);
console.log(JSON.stringify(result, null, 2));
