// Transform input.html into owners/owner_data.json using cheerio only for HTML parsing
// The script focuses solely on transformation logic without validation/error handling/logging.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read input file
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utilities
const trimMulti = (s) => (s || "").replace(/\s+/g, " ").trim();
const decodeHtml = (s) =>
  trimMulti(
    cheerio
      .load(`<div>${s || ""}</div>`)("div")
      .text(),
  );

function splitLinesFromHtml(htmlFrag) {
  const raw = (htmlFrag || "")
    .replace(/<br\s*\/?>(\s*\n)*/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return raw
    .split(/\n+/)
    .map((t) => decodeHtml(t))
    .map((t) => trimMulti(t))
    .filter((t) => t.length > 0);
}

// Property ID extraction heuristics
function extractPropertyId($) {
  // 1) Look for a parcel-like H1 (e.g., 00005-001-00)
  let id = null;
  $("h1, h2, h3").each((i, el) => {
    const t = $(el).text().trim();
    if (!id && /\b\d{3,}-\d{3}-\d{2}\b/.test(t)) {
      id = t.match(/\b\d{3,}-\d{3}-\d{2}\b/)[0];
    }
  });
  // 2) Look for label "Prime Key: <id>"
  if (!id) {
    $("*").each((i, el) => {
      const t = $(el).text();
      if (!id && /Prime Key\s*:\s*([A-Za-z0-9\-]+)/i.test(t)) {
        const m = t.match(/Prime Key\s*:\s*([A-Za-z0-9\-]+)/i);
        if (m) id = m[1];
      }
    });
  }
  // 3) Look for generic labels
  if (!id) {
    const labels = [
      "Property ID",
      "PropertyID",
      "propId",
      "Prop ID",
      "Parcel",
      "Parcel ID",
      "Account",
    ];
    $("*").each((i, el) => {
      const t = $(el).text();
      if (id) return;
      for (const lab of labels) {
        const re = new RegExp(`${lab}\\s*:\\s*([A-Za-z0-9\-]+)`, "i");
        const m = t.match(re);
        if (m) {
          id = m[1];
          break;
        }
      }
    });
  }
  return id || "unknown_id";
}

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
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

// Owner classification heuristics
const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "services",
  "trust",
  "tr",
];

function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`, "i").test(n),
  );
}

function normalizeOwner(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return trimMulti((owner.name || "").toLowerCase());
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .filter((x) => x && String(x).trim().length > 0)
    .map((x) => String(x).trim().toLowerCase());
  return parts.join(" ");
}

function classifyOwner(rawName) {
  const raw = trimMulti(rawName || "");
  if (!raw) return { invalid: { raw, reason: "empty" } };

  // Remove extraneous commas/periods at ends
  const cleaned = raw.replace(/[\s,;]+$/g, "").replace(/^c\/?o\s+/i, "");

  // Company check
  if (isCompanyName(cleaned)) {
    return { owner: { type: "company", name: cleaned } };
  }

  // Ampersand rule
  if (cleaned.includes("&")) {
    const joined = cleaned.replace(/&/g, " ").replace(/\s+/g, " ").trim();
    const tokens = joined.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
      const first = cleanInvalidCharsFromName(tokens[0]);
      const last = cleanInvalidCharsFromName(tokens[tokens.length - 1]);
      const middle = cleanInvalidCharsFromName(tokens.slice(1, -1).join(" ").trim()) || null;
      if (first && last) {
        return {
          owner: {
            type: "person",
            first_name: first,
            last_name: last,
            middle_name: middle || null,
          },
        };
      }
    }
    return {
      invalid: { raw: cleaned, reason: "unable_to_split_ampersand_name" },
    };
  }

  // Person assumption: needs at least two tokens
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const first = cleanInvalidCharsFromName(tokens[0]);
    const last = cleanInvalidCharsFromName(tokens[tokens.length - 1]);
    const middle = cleanInvalidCharsFromName(tokens.slice(1, -1).join(" ").trim()) || null;
    if (first && last) {
      return {
        owner: {
          type: "person",
          first_name: first,
          last_name: last,
          middle_name: middle || null,
        },
      };
    }
  }

  return {
    invalid: { raw: cleaned, reason: "ambiguous_non_company_single_token" },
  };
}

// Extract plausible owner names
function extractOwnerCandidates($) {
  const candidates = [];

  // Prefer the Property Information section
  const infoAnchor = $("a")
    .filter(
      (i, el) =>
        trimMulti($(el).text()).toLowerCase() === "property information",
    )
    .first();
  if (infoAnchor.length) {
    const center = infoAnchor.closest("center");
    const table = center.nextAll("table").first();
    const firstTd = table.find("td").first();
    if (firstTd.length) {
      const lines = splitLinesFromHtml(firstTd.html());
      if (lines.length > 0) {
        candidates.push(lines[0]);
      }
    }
  }

  // As a fallback, search for labels like Owner, Owner Name, Owner(s)
  if (candidates.length === 0) {
    const ownerLabelRegex = /\bowner(?:\(s\))?:?\b|owner name:?/i;
    $("td, th, div, span, p, li").each((i, el) => {
      const text = trimMulti($(el).text());
      if (ownerLabelRegex.test(text)) {
        // Try to get the next text node or sibling cell's text
        const next = $(el).next();
        if (next && next.length) {
          const firstLine = splitLinesFromHtml(next.html() || next.text())[0];
          if (firstLine) candidates.push(firstLine);
        }
      }
    });
  }

  // Filter obviously non-owner generic headers
  const banned = [
    "office hours",
    "location",
    "google map",
    "contact us",
    "mailing address",
    "copyright",
    "telephone",
    "fax",
    "email",
    "permit search",
    "property record card",
    "map it+",
  ];
  const filtered = candidates.filter((c) => {
    const lc = (c || "").toLowerCase();
    if (!lc || lc.length < 2) return false;
    if (banned.some((b) => lc.includes(b))) return false;
    return true;
  });

  return filtered;
}

// Build owners map
const propertyId = extractPropertyId($);
const ownerCandidates = extractOwnerCandidates($);

const validOwners = [];
const invalidOwners = [];
const seen = new Set();

ownerCandidates.forEach((cand) => {
  const out = classifyOwner(cand);
  if (out.owner) {
    const norm = normalizeOwner(out.owner);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      validOwners.push(out.owner);
    }
  } else if (out.invalid) {
    invalidOwners.push(out.invalid);
  }
});

// Owners by date: no explicit historical owners detected in this document; set current
const ownersByDate = {};
ownersByDate["current"] = validOwners;

// Ensure chronological keys (none in this case besides current)
const ordered = {};
const datedKeys = Object.keys(ownersByDate).filter((k) =>
  /^\d{4}-\d{2}-\d{2}$/.test(k),
);
datedKeys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
datedKeys.forEach((k) => {
  ordered[k] = ownersByDate[k];
});
Object.keys(ownersByDate)
  .filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k) && k !== "current")
  .forEach((k) => {
    ordered[k] = ownersByDate[k];
  });
if (ownersByDate["current"]) ordered["current"] = ownersByDate["current"];

const result = { [`property_${propertyId}`]: { owners_by_date: ordered } };
if (invalidOwners.length > 0) {
  result[`property_${propertyId}`].invalid_owners = invalidOwners;
}

// Save to owners/owner_data.json and print
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(JSON.stringify(result, null, 2));
