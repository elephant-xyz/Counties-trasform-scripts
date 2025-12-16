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

const PREFIX_MAP = new Map(
  [
    ["MR", "Mr."],
    ["MRS", "Mrs."],
    ["MS", "Ms."],
    ["MISS", "Miss"],
    ["DR", "Dr."],
    ["DOCTOR", "Dr."],
    ["REV", "Rev."],
    ["REVEREND", "Rev."],
    ["HON", "Hon."],
    ["ATTY", "Atty."],
    ["ATTORNEY", "Attorney"],
    ["PROF", "Prof."],
    ["SIR", "Sir"],
    ["LADY", "Lady"],
    ["FR", "Fr."],
    ["FATHER", "Father"],
    ["PASTOR", "Pastor"],
    ["BRO", "Bro."],
    ["SISTER", "Sister"],
  ],
);

const SUFFIX_MAP = new Map(
  [
    ["JR", "Jr."],
    ["SR", "Sr."],
    ["II", "II"],
    ["III", "III"],
    ["IV", "IV"],
    ["V", "V"],
    ["VI", "VI"],
    ["VII", "VII"],
    ["MD", "MD"],
    ["DDS", "DDS"],
    ["DVM", "DVM"],
    ["DO", "DO"],
    ["PHD", "PhD"],
    ["ESQ", "Esq."],
    ["ESQUIRE", "Esq."],
    ["CPA", "CPA"],
    ["CFP", "CFP"],
    ["CLU", "CLU"],
    ["AFM", "AFM"],
  ],
);

const SURNAME_PARTICLES = new Set([
  "AL",
  "DA",
  "DAL",
  "DE",
  "DEL",
  "DELA",
  "DELOS",
  "DER",
  "DES",
  "DI",
  "DOS",
  "DU",
  "EL",
  "LA",
  "LAS",
  "LE",
  "LES",
  "LO",
  "LOS",
  "MAC",
  "MC",
  "O",
  "SAN",
  "SANTA",
  "SANTOS",
  "SAINT",
  "ST",
  "VAN",
  "VON",
]);

const SURNAME_FORCE_NEXT = new Set(["MC", "MAC", "O", "ST", "SAINT"]);

function normalizeToken(token) {
  return token ? token.replace(/[^A-Za-z]/g, "").toUpperCase() : "";
}

function formatNameComponent(token) {
  if (!token) return null;
  const cleaned = token.replace(/[^A-Za-z'\-]/g, "");
  if (!cleaned) return null;
  return cleaned
    .split(/([-'])/)
    .map((chunk) => {
      if (!chunk) return "";
      if (chunk === "-" || chunk === "'") return chunk;
      return chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase();
    })
    .join("");
}

function formatNameTokens(tokens) {
  const parts = tokens
    .map((t) => formatNameComponent(t))
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function stripOwnerNoise(val) {
  return val
    .replace(/\bET\s+AL\.?\b/gi, "")
    .replace(/\bET\s+UX\b/gi, "")
    .replace(/\bET\s+VIR\b/gi, "")
    .replace(/\bTRS?\b/gi, "")
    .replace(/\bTRUSTEES?\b/gi, "")
    .replace(/[+,&]+$/g, "")
    .replace(/\/+$/g, "")
    .trim();
}

function parsePersonName(rawName, inheritLastName) {
  const cleaned = stripOwnerNoise(rawName);
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");

  let tokens = cleaned
    .replace(/[,]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!tokens.length) return null;

  let prefixName = null;
  while (tokens.length) {
    const mapped = PREFIX_MAP.get(normalizeToken(tokens[0]));
    if (mapped) {
      prefixName = mapped;
      tokens.shift();
      continue;
    }
    break;
  }

  const suffixParts = [];
  while (tokens.length) {
    const mapped = SUFFIX_MAP.get(normalizeToken(tokens[tokens.length - 1]));
    if (mapped) {
      suffixParts.unshift(mapped);
      tokens.pop();
      continue;
    }
    break;
  }

  if (!tokens.length) return null;

  if (tokens.length === 1 && inheritLastName) {
    const firstSingle = formatNameComponent(tokens[0]);
    const lastFromCarry = formatNameComponent(inheritLastName);
    if (!firstSingle || !lastFromCarry) return null;
    const singlePerson = {
      type: "person",
      first_name: firstSingle,
      last_name: lastFromCarry,
    };
    if (prefixName) singlePerson.prefix_name = prefixName;
    if (suffixParts.length) singlePerson.suffix_name = suffixParts.join(" ");
    return singlePerson;
  }

  if (tokens.length < 2) return null;

  if (
    inheritLastName &&
    tokens.length === 2 &&
    tokens[0].length > 1 &&
    tokens[1].length <= 2
  ) {
    const firstName = formatNameComponent(tokens[0]);
    const middleName = formatNameComponent(tokens[1]);
    const lastName = formatNameComponent(inheritLastName);
    if (firstName && lastName) {
      const inferredPerson = {
        type: "person",
        first_name: firstName,
        last_name: lastName,
      };
      if (middleName) inferredPerson.middle_name = middleName;
      if (prefixName) inferredPerson.prefix_name = prefixName;
      if (suffixParts.length) inferredPerson.suffix_name = suffixParts.join(" ");
      return inferredPerson;
    }
  }

  const tryLastFirst = () => {
    let idx = 0;
    const lastTokens = [tokens[idx]];
    const firstTokenNorm = normalizeToken(tokens[idx]);
    idx += 1;

    if (
      SURNAME_FORCE_NEXT.has(firstTokenNorm) &&
      idx < tokens.length - 1
    ) {
      lastTokens.push(tokens[idx]);
      idx += 1;
    }

    while (idx < tokens.length - 1) {
      const nextNorm = normalizeToken(tokens[idx]);
      if (SURNAME_PARTICLES.has(nextNorm)) {
        lastTokens.push(tokens[idx]);
        idx += 1;
        if (SURNAME_FORCE_NEXT.has(nextNorm) && idx < tokens.length - 1) {
          lastTokens.push(tokens[idx]);
          idx += 1;
        }
        continue;
      }
      break;
    }

    if (idx >= tokens.length) return null;

    const firstToken = tokens[idx];
    const middleTokens = tokens.slice(idx + 1);

    const firstName = formatNameComponent(firstToken);
    const lastName = formatNameTokens(lastTokens);
    if (!firstName || !lastName) return null;

    const person = {
      type: "person",
      first_name: firstName,
      last_name: lastName,
    };
    const middleFormatted = formatNameTokens(middleTokens);
    if (middleFormatted) person.middle_name = middleFormatted;
    if (prefixName) person.prefix_name = prefixName;
    if (suffixParts.length) person.suffix_name = suffixParts.join(" ");
    return person;
  };

  const tryFirstLast = () => {
    const firstTokens = [tokens[0]];
    const lastTokens = [tokens[tokens.length - 1]];
    const middleTokens = tokens.slice(1, -1);

    const firstName = formatNameTokens(firstTokens);
    const lastName = formatNameTokens(lastTokens);
    if (!firstName || !lastName) return null;

    const person = {
      type: "person",
      first_name: firstName,
      last_name: lastName,
    };
    const middleFormatted = formatNameTokens(middleTokens);
    if (middleFormatted) person.middle_name = middleFormatted;
    if (prefixName) person.prefix_name = prefixName;
    if (suffixParts.length) person.suffix_name = suffixParts.join(" ");
    return person;
  };

  let personCandidate = tryLastFirst();
  if (!personCandidate && hasComma) {
    personCandidate = tryFirstLast();
  }
  if (!personCandidate) {
    personCandidate = tryFirstLast();
  }
  if (!personCandidate && inheritLastName) {
    const fallbackFirst = formatNameComponent(tokens[0]);
    const fallbackLast = formatNameComponent(inheritLastName);
    if (fallbackFirst && fallbackLast) {
      personCandidate = {
        type: "person",
        first_name: fallbackFirst,
        last_name: fallbackLast,
      };
      const middleFormatted = formatNameTokens(tokens.slice(1));
      if (middleFormatted) personCandidate.middle_name = middleFormatted;
      if (prefixName) personCandidate.prefix_name = prefixName;
      if (suffixParts.length) personCandidate.suffix_name = suffixParts.join(" ");
    }
  }

  return personCandidate || null;
}

function classifyOwner(raw, inheritLastName) {
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

  const name = stripOwnerNoise(cleaned);
  if (!name) return { valid: false, reason: "empty_after_cleanup", raw: cleaned };

  if (looksLikeCompany(name)) {
    return { valid: true, owner: { type: "company", name } };
  }

  const person = parsePersonName(name, inheritLastName);
  if (person) return { valid: true, owner: person };

  return { valid: false, reason: "unable_to_parse_person", raw: name };
}

function expandOwnerLines(lines) {
  const candidates = [];
  let carryLastAcrossLines = null;

  for (const rawLine of lines) {
    if (!rawLine) continue;
    const normalizedLine = normWS(rawLine);
    if (!normalizedLine) continue;

    const lineForSplit = normalizedLine.replace(/\s&\s/g, " + ");
    const endsWithPlus = /\+\s*$/.test(lineForSplit);
    const segments = lineForSplit.split(/\s*\+\s*/);

    let lineCarry = carryLastAcrossLines;
    for (const segment of segments) {
      const trimmedSegment = stripOwnerNoise(normWS(segment));
      if (!trimmedSegment) continue;
      if (UI_NOISE.test(trimmedSegment)) continue;
      if (/^mailing\s*address/i.test(trimmedSegment)) continue;
      if (/\b[A-Z]{2}\b\s*\d{5}/.test(trimmedSegment)) continue;
      if (/\d{5}(?:-\d{4})?$/.test(trimmedSegment)) continue;

      const tokens = trimmedSegment
        .replace(/[,]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

      const candidate = { raw: trimmedSegment };
      const isCompany = looksLikeCompany(trimmedSegment);

      if (
        lineCarry &&
        !isCompany &&
        tokens.length &&
        (tokens.length <= 2 || tokens.every((t) => t.length <= 3))
      ) {
        candidate.inheritLastName = lineCarry;
      }

      candidates.push(candidate);

      if (isCompany) {
        lineCarry = null;
        continue;
      }

      const firstToken = tokens[0];
      const secondToken = tokens[1];
      const hasExplicitLast =
        tokens.length >= 3 ||
        /\b[A-Z]{2,},/.test(segment) ||
        (tokens.length === 2 && secondToken && secondToken.length > 1);

      if (hasExplicitLast && firstToken) {
        lineCarry = firstToken;
      }
    }

    carryLastAcrossLines = endsWithPlus ? lineCarry : null;
  }

  return candidates;
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
  let owners = [];
  $root("b").each((_, bel) => {
    const labelText = normWS($root(bel).text());
    if (/^owners?\s*:/i.test(labelText)) {
      const lines = extractLinesAfterLabelNode($root, bel);
      owners = owners.concat(expandOwnerLines(lines));
    }
  });
  return owners;
}

// Fallback: Extract owners from generic labeled sections if present
function extractOwnersFromLabeledSections($root) {
  let results = [];
  $root("*").each((_, el) => {
    const $el = $root(el);
    const text = normWS($el.text());
    if (/^owners?\s*:/i.test(text)) {
      const lines = extractLinesAfterLabelNode($root, el);
      results = results.concat(expandOwnerLines(lines));
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
  return Array.from(matches).map((raw) => ({ raw: stripOwnerNoise(raw) }));
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
      if (ntext && ntext.length > 1 && !UI_NOISE.test(ntext)) {
        rawOwners = rawOwners.concat(expandOwnerLines([ntext]));
      }
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
  .filter(
    (entry) => {
      if (!entry || !entry.raw) return false;
      const key = entry.raw.toLowerCase();
      if (seenRaw.has(key)) return false;
      seenRaw.add(key);
      return true;
    },
  );

// Classify and deduplicate valid owners; collect invalids
const validOwners = [];
const invalidOwners = [];
const seenKeys = new Set();
for (const candidate of rawOwners) {
  const res = classifyOwner(candidate.raw, candidate.inheritLastName);
  if (!res.valid) {
    invalidOwners.push({
      raw: candidate.raw,
      reason: res.reason || "unclassified",
    });
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
