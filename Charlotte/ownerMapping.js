const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility helpers
const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const toTitle = (s) => s; // preserve original casing as presented

function getPropertyId($) {
  let id = null;
  const h1 = $("h1").first().text();
  const m =
    h1 &&
    h1.match(/Property\s+Record\s+Information\s+for\s+([A-Za-z0-9_\-]+)/i);
  if (m) id = normSpace(m[1]);
  if (!id) {
    $("a[href]").each((i, el) => {
      if (id) return;
      const href = $(el).attr("href") || "";
      let m2 =
        href.match(/[?&]acct=([^&#]+)/i) ||
        href.match(/[?&]defAccount=([^&#]+)/i) ||
        href.match(/property[_-]?id=([^&#]+)/i);
      if (m2) id = normSpace(decodeURIComponent(m2[1]));
    });
  }
  if (!id) id = "unknown_id";
  return id;
}

function splitByBr($node) {
  const html = $node.html() || "";
  const rawParts = html.split(/<br\s*\/?>(?:\s*)/i);
  const parts = rawParts
    .map((frag) => {
      const $$ = cheerio.load(`<div>${frag}</div>`);
      return normSpace($$("div").text());
    })
    .filter((t) => t.length > 0);
  return parts;
}

function extractOwnerCandidates($) {
  const candidates = [];
  // Primary heuristic: find an H2 containing "Owner" and grab the first line in the adjacent bordered box
  $("h2").each((i, el) => {
    const t = ($(el).text() || "").toLowerCase();
    if (t.includes("owner")) {
      // Find the next bordered div near this header
      let box = $(el)
        .nextAll("div")
        .filter((j, d) => $(d).hasClass("w3-border"))
        .first();
      if (!box || box.length === 0) {
        // fallback: search within the same row/container
        box = $(el).parent().find("div.w3-border").first();
      }
      if (box && box.length > 0) {
        const lines = splitByBr(box);
        if (lines.length > 0) {
          candidates.push(lines[0]);
        }
      }
    }
  });
  // Additional heuristic: look for strong label 'Owner' followed by a text node/next cell
  $("strong").each((i, el) => {
    const s = ($(el).text() || "").toLowerCase();
    if (s.includes("owner")) {
      const container = $(el).closest("div, td");
      if (container && container.length) {
        const txt = normSpace(container.text());
        if (txt) {
          const lines = txt.split(/\n|\r/).map(normSpace).filter(Boolean);
          // often label then value; try to pick a line after the label
          if (lines.length >= 2) {
            candidates.push(lines[1]);
          }
        }
      }
    }
  });
  // Deduplicate raw candidates
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const n = c.toLowerCase();
    if (!seen.has(n)) {
      seen.add(n);
      out.push(c);
    }
  }
  return out;
}

// Role/title suffixes to trim from person names
const roleSuffixes = [
  "trustee",
  "ttee",
  "trs",
  "trstee",
  "trste",
  "tr",
  "et al",
  "etal",
  "jr",
  "sr",
  "iii",
  "iv",
  "ii",
];
function stripRoleSuffixes(name) {
  let n = name.replace(/\./g, " ").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of roleSuffixes) {
      const re = new RegExp(`(?:,?\s+|\s+)?${suf}$`, "i");
      if (re.test(n)) {
        n = n.replace(re, "").trim();
        changed = true;
      }
    }
  }
  return normSpace(n);
}

// Company classification tokens (case-insensitive). Match whole tokens only.
const companyTokens = new Set([
  "inc",
  "incorporated",
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
  "company",
  "services",
  "service",
  "trust",
  "tr",
  "associates",
  "association",
  "assn",
  "bank",
  "group",
  "partners",
  "holdings",
  "realty",
  "properties",
  "management",
  "mgmt",
  "mortgage",
  "investment",
  "investments",
  "enterprise",
  "enterprises",
  "plc",
  "lp",
  "llp",
  "pc",
  "pllc",
  "pa",
  "hoa",
]);
function isCompanyName(raw) {
  const l = (raw || "").toLowerCase();
  // tokenize by non-alphanumeric
  const tokens = l.split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (companyTokens.has(t)) return true;
  }
  return false;
}

function expandAmpersand(raw) {
  if (!raw) return [];
  // Split on '&' as multi-owner indicator
  if (raw.includes("&")) {
    return raw.split("&").map(normSpace).filter(Boolean);
  }
  return [raw];
}

function parsePersonName(name) {
  // If comma is present, assume LAST, FIRST MIDDLE
  let n = normSpace(name);
  if (n.includes(",")) {
    const parts = n.split(",").map(normSpace).filter(Boolean);
    const last = parts[0] || "";
    const rest = parts.slice(1).join(" ");
    const t = rest.split(/\s+/).filter(Boolean);
    const first = t[0] || "";
    const middle = t.slice(1).join(" ") || null;
    return {
      type: "person",
      first_name: toTitle(first),
      last_name: toTitle(last),
      middle_name: middle ? toTitle(middle) : null,
    };
  } else {
    // Many assessor formats: LAST FIRST MIDDLE (all caps). Assume first token is last.
    const t = n.split(/\s+/).filter(Boolean);
    const last = t[0] || "";
    const first = t[1] || "";
    const middle = t.slice(2).join(" ") || null;
    return {
      type: "person",
      first_name: toTitle(first),
      last_name: toTitle(last),
      middle_name: middle ? toTitle(middle) : null,
    };
  }
}

function classifyOwnerNames(rawNames) {
  const validOwners = [];
  const invalidOwners = [];
  const seen = new Set(); // dedupe by normalized raw name

  for (const raw of rawNames) {
    const pieces = expandAmpersand(raw);
    for (let piece of pieces) {
      let cleaned = stripRoleSuffixes(piece);
      cleaned = normSpace(cleaned);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      // Classify
      if (isCompanyName(cleaned)) {
        validOwners.push({ type: "company", name: toTitle(cleaned) });
      } else {
        const person = parsePersonName(cleaned);
        // require first and last names
        if (!person.first_name || !person.last_name) {
          invalidOwners.push({
            raw: raw,
            reason: "missing first or last name after parsing",
          });
        } else {
          validOwners.push(person);
        }
      }
    }
  }
  return { validOwners, invalidOwners };
}

// Main extraction
const propId = getPropertyId($);
const ownerCandidates = extractOwnerCandidates($);
const { validOwners, invalidOwners } = classifyOwnerNames(ownerCandidates);

// Build owners_by_date map. Only current owners are reliably present in this document.
const ownersByDate = {};
ownersByDate["current"] = validOwners;

// Assemble final JSON
const propertyObject = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};
const result = {};
result[`property_${propId}`] = propertyObject;

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

// Print JSON to stdout
console.log(JSON.stringify(result, null, 2));
