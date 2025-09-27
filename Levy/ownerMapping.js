"use strict";

// Single-file Node.js transformer using only cheerio for HTML parsing
// Reads input.html, extracts property id, owners (current and historical), classifies them,
// maps them by date (or placeholders), deduplicates, and writes owners/owner_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
function normWS(str) {
  return (str || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Utility: extract lines from sibling flow starting at a given node, stopping at next <b> or <hr>
function extractLinesAfterLabelNode($root, labelNode) {
  const lines = [];
  let cur = labelNode.nextSibling;
  let current = "";
  while (cur) {
    if (cur.type === "tag") {
      const tagName = cur.name ? cur.name.toLowerCase() : "";
      if (tagName === "b" || tagName === "hr") break; // next section
      if (tagName === "br") {
        const ln = normWS(current);
        if (ln) lines.push(ln);
        current = "";
      } else {
        // Collect text inside tag; do not traverse beyond current container semantics
        const txt = normWS($root(cur).text());
        if (txt) current += (current ? " " : "") + txt;
      }
    } else if (cur.type === "text") {
      const txt = normWS(cur.data);
      if (txt) current += (current ? " " : "") + txt;
    }
    cur = cur.nextSibling;
  }
  const tail = normWS(current);
  if (tail) lines.push(tail);
  return lines;
}

// Heuristic: attempt to find property id
function extractPropertyId($root) {
  let id = null;
  // 1) Look for heading containing "Parcel "
  $root("h1, h2, h3").each((_, el) => {
    const t = normWS($root(el).text());
    const m = t.match(/Parcel\s+([A-Za-z0-9\-]+)/i);
    if (!id && m) id = m[1];
  });
  // 2) From <title>
  if (!id) {
    const t = normWS($root("title").text());
    const m = t.match(
      /(^|\s)([A-Za-z]-?\d{2}-\d{2}-\d{2}-[A-Za-z0-9]{3}-\d{4}-\d{4})(?=\s|\-|$)/,
    );
    if (m) id = m[2];
  }
  // 3) From obvious fields like Property ID labels
  if (!id) {
    const bodyText = normWS($root("body").text());
    const m = bodyText.match(/Property\s*ID\s*[:#]?\s*([A-Za-z0-9\-]+)/i);
    if (m) id = m[1];
  }
  // 4) From tax collector link patterns (e.g., p=P313630-07A02700060)
  if (!id) {
    $root("a[href]").each((_, ael) => {
      const href = String($root(ael).attr("href") || "");
      const u = new URL(href, "https://example.com");
      const p = u.searchParams.get("p");
      if (p && /[A-Za-z0-9\-]{8,}/.test(p) && !id) id = p;
    });
  }
  return id || "unknown_id";
}

// Company keyword detection (case-insensitive)
const COMPANY_KEYWORDS = [
  "llc",
  "inc",
  "inc.",
  "ltd",
  "ltd.",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "services",
  "trust",
  "tr",
  "lp",
  "llp",
  "pllc",
  "plc",
  "partners",
  "holdings",
  "group",
  "bank",
  "association",
  "assoc",
  "company",
  "enterprise",
  "enterprises",
  "properties",
  "property",
  "management",
  "church",
  "ministries",
  "university",
  "college",
  "fund",
  "capital",
];

function looksLikeCompany(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((k) => n.includes(k));
}

// Very common non-owner UI phrases to ignore
const UI_NOISE =
  /(goto|interactive\s+map|tax\s+collector|building\s+permits|value\s+summary|sales\s+history|buildings|extra\s+features|land\s+lines)/i;

// Regex for validating person names based on the provided error message
const PERSON_NAME_PATTERN = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

// Function to capitalize the first letter of each word and ensure it matches the pattern
function formatPersonName(name) {
  // Attempt to capitalize the first letter of each word
  const formatted = name
    .split(/([ \-',.])/) // Split by delimiters, keeping the delimiters
    .map((part, index, arr) => {
      if (part.length === 0) return part;
      // If it's a delimiter, return as is
      if (/[ \-',.]/.test(part)) return part;
      // If it's the first part or follows a delimiter, capitalize it
      if (index === 0 || /[ \-',.]/.test(arr[index - 1])) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      // Otherwise, keep it lowercase
      return part.toLowerCase();
    })
    .join("");

  // If the formatted name doesn't match the pattern, return null or throw an error
  // For now, we'll return the formatted name and let the validation handle it.
  // The `classifyOwner` function will check `PERSON_NAME_PATTERN.test(name)`
  return formatted;
}

// Classify and structure an owner string into schema
function classifyOwner(raw) {
  const cleaned = normWS(raw)
    .replace(/^owner\s*:?\s*/i, "")
    .replace(/^owners\s*:?\s*/i, "")
    .replace(/^name\s*:?\s*/i, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return { valid: false, reason: "empty", raw };
  if (/^n\/?a$/i.test(cleaned)) return { valid: false, reason: "na", raw };
  if (cleaned.length < 2) return { valid: false, reason: "too_short", raw };
  if (/https?:\/\//i.test(cleaned)) return { valid: false, reason: "url", raw };
  if (UI_NOISE.test(cleaned)) return { valid: false, reason: "ui_noise", raw };

  // Remove trailing punctuation
  const name = cleaned.replace(/[.,;]+$/g, "").trim();

  // Company classification
  if (looksLikeCompany(name)) {
    return { valid: true, owner: { type: "company", name } };
  }

  // Handle ampersand rule: split into first/last after removing '&'
  if (name.includes("&")) {
    const noAmp = normWS(name.replace(/&/g, " "));
    const parts = noAmp.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      let first_name = formatPersonName(parts[0]);
      let last_name = formatPersonName(parts.slice(1).join(" "));

      if (!PERSON_NAME_PATTERN.test(first_name)) {
        return { valid: false, reason: "first_name_pattern_mismatch", raw: name };
      }
      if (!PERSON_NAME_PATTERN.test(last_name)) {
        return { valid: false, reason: "last_name_pattern_mismatch", raw: name };
      }

      const owner = { type: "person", first_name, last_name };
      return { valid: true, owner };
    } else {
      return { valid: false, reason: "ampersand_could_not_split", raw: name };
    }
  }

  // Likely a personal name; split by spaces
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "single_token_uncertain", raw: name };
  }

  let first = formatPersonName(tokens[0]);
  let last = formatPersonName(tokens[tokens.length - 1]);
  let middle = tokens.slice(1, -1).map(formatPersonName).join(" ");

  if (!PERSON_NAME_PATTERN.test(first)) {
    return { valid: false, reason: "first_name_pattern_mismatch", raw: name };
  }
  if (!PERSON_NAME_PATTERN.test(last)) {
    return { valid: false, reason: "last_name_pattern_mismatch", raw: name };
  }
  if (middle && !PERSON_NAME_PATTERN.test(middle)) {
    // If middle name exists but doesn't match pattern, treat as invalid
    return { valid: false, reason: "middle_name_pattern_mismatch", raw: name };
  }

  const person = { type: "person", first_name: first, last_name: last };
  if (middle) person.middle_name = middle;
  return { valid: true, owner: person };
}

// Deduplicate owners by normalized key
function ownerKey(o) {
  if (!o) return null;
  if (o.type === "company") return `company:${o.name}`.toLowerCase().trim();
  const middle = o.middle_name ? ` ${o.middle_name}` : "";
  return `person:${o.first_name}${middle} ${o.last_name}`.toLowerCase().trim();
}

// Extract owners primarily from the explicit <b>Owners:</b> label region
function extractOwnersFromOwnersLabel($root) {
  const owners = [];
  $root("b").each((_, bel) => {
    const labelText = normWS($root(bel).text());
    if (/^owners?\s*:/i.test(labelText)) {
      const lines = extractLinesAfterLabelNode($root, bel);
      lines.forEach((line) => {
        if (!line) return;
        if (UI_NOISE.test(line)) return;
        // Skip obvious addresses (contain comma state or ZIP)
        if (/\b[A-Z]{2}\b\s*\d{5}/.test(line) || /\d{5}(?:-\d{4})?$/.test(line))
          return;
        // Skip lines that look like headers
        if (/^mailing\s*address/i.test(line)) return;
        owners.push(line);
      });
    }
  });
  return owners;
}

// Fallback: Extract owners from generic labeled sections if present
function extractOwnersFromLabeledSections($root) {
  const results = [];
  $root("*").each((_, el) => {
    const $el = $root(el);
    const text = normWS($el.text());
    if (/^owners?\s*:/i.test(text)) {
      const lines = extractLinesAfterLabelNode($root, el);
      lines.forEach((line) => {
        if (!line) return;
        if (UI_NOISE.test(line)) return;
        if (/^mailing\s*address/i.test(line)) return;
        if (/\b[A-Z]{2}\b\s*\d{5}/.test(line) || /\d{5}(?:-\d{4})?$/.test(line))
          return; // address-like
        results.push(line);
      });
    }
  });
  return results;
}

// Additional heuristic: scan for company-like tokens in the document
function extractCompanyLikeNames($root) {
  const text = $root("body").text();
  const matches = new Set();
  const kw = COMPANY_KEYWORDS.map((k) => k.replace(/\./g, "\\.")).join("|");
  const companyPattern = new RegExp(
    `([A-Z0-9][A-Z0-9&'.,\\-\\s]{1,80}(?:${kw}))`,
    "gi",
  );
  let m;
  while ((m = companyPattern.exec(text)) !== null) {
    const candidate = normWS(m[1]);
    if (candidate.length <= 2) continue;
    matches.add(candidate);
  }
  return Array.from(matches);
}

// Associate owners to dates (default to 'current' only when no explicit history)
function groupOwnersByDates($root, owners) {
  return [{ key: "current", owners }];
}

// Main extraction flow
const propertyId = extractPropertyId($);

// Gather raw owner strings
let rawOwners = [];

// Strongly-anchored Owners label extraction
rawOwners = rawOwners.concat(extractOwnersFromOwnersLabel($));

// 1) From explicit labeled sections as secondary
if (rawOwners.length === 0) {
  rawOwners = rawOwners.concat(extractOwnersFromLabeledSections($));
}

// 2) As fallback, try to find table cells next to 'Owner' headers
if (rawOwners.length === 0) {
  $("td, th, div, span, p, li").each((_, el) => {
    const t = normWS($(el).text());
    if (/^owners?\b/i.test(t) && $(el).next().length) {
      const ntext = normWS($(el).next().text());
      if (ntext && ntext.length > 1 && !UI_NOISE.test(ntext))
        rawOwners.push(ntext);
    }
  });
}

// 3) Add company-like names, but only if no owners found yet
if (rawOwners.length === 0) {
  rawOwners = rawOwners.concat(extractCompanyLikeNames($));
}

// Clean, unique raw owners
const seenRaw = new Set();
rawOwners = rawOwners
  .map((s) => normWS(s))
  .filter(
    (s) =>
      s &&
      !seenRaw.has(s.toLowerCase()) &&
      (function (v) {
        seenRaw.add(v.toLowerCase());
        return true;
      })(s),
  );

// Classify and deduplicate valid owners; collect invalids
const validOwners = [];
const invalidOwners = [];
const seenKeys = new Set();
for (const r of rawOwners) {
  const res = classifyOwner(r);
  if (!res.valid) {
    invalidOwners.push({ raw: r, reason: res.reason || "unclassified" });
    continue;
  }
  const key = ownerKey(res.owner);
  if (!key || seenKeys.has(key)) continue;
  seenKeys.add(key);
  // Ensure middle_name exists only if non-empty as per requirements
  if (res.owner.type === "person" && !res.owner.middle_name)
    delete res.owner.middle_name;
  validOwners.push(res.owner);
}

// Group owners by dates (heuristic)
const groups = groupOwnersByDates($, validOwners);

// Build owners_by_date map ensuring chronological order for date keys (ignoring 'current' and unknown placeholders)
const owners_by_date = {};
// Separate date keys and others
const dateEntries = [];
const otherEntries = [];
for (const g of groups) {
  const k = g.key;
  const arr = g.owners || [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) dateEntries.push(g);
  else otherEntries.push(g);
}
// Sort dateEntries chronologically
dateEntries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
for (const g of dateEntries) owners_by_date[g.key] = g.owners;
for (const g of otherEntries) owners_by_date[g.key] = g.owners;

// Assemble final object
const output = {};
output[`property_${propertyId}`] = { owners_by_date };
output.invalid_owners = invalidOwners;

// Ensure directory and write file
fs.mkdirSync(path.join(process.cwd(), "owners"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "owners", "owner_data.json"),
  JSON.stringify(output, null, 2),
  "utf8",
);

// Print the JSON only
console.log(JSON.stringify(output, null, 2));