const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Title case utility that handles spaces and hyphens
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(/([\s-]+)/)
    .map((part) =>
      /^[\s-]+$/.test(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
}

function loadInputHTML() {
  const inputPath = path.join(process.cwd(), "input.json");
  const html = fs.readFileSync(inputPath, "utf8");
  return html;
}

function extractTextFromHTML(htmlStr) {
  const $ = cheerio.load(htmlStr);
  // For pure JSON input, this returns the raw JSON as text
  return $.root().text();
}

function tryParseJSONFromText(text) {
  // Try direct parse first
  try {
    const obj = JSON.parse(text);
    return obj;
  } catch (e) {}
  // Attempt to find the largest JSON object within the text
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const obj = JSON.parse(candidate);
      return obj;
    } catch (e) {}
  }
  return null;
}

function collectValuesByKeyPattern(obj, regex, results = []) {
  if (obj && typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) collectValuesByKeyPattern(item, regex, results);
    } else {
      for (const [k, v] of Object.entries(obj)) {
        if (regex.test(k)) {
          results.push(v);
        }
        collectValuesByKeyPattern(v, regex, results);
      }
    }
  }
  return results;
}

function flattenToStrings(values) {
  const out = [];
  const stack = Array.isArray(values) ? [...values] : [values];
  while (stack.length) {
    const v = stack.pop();
    if (v == null) continue;
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) stack.push(...v);
    else if (typeof v === "object") {
      // If object has a 'name' field, consider it
      if (typeof v.name === "string") out.push(v.name);
      // Also push any string primitives inside
      for (const val of Object.values(v)) {
        if (typeof val === "string") out.push(val);
        else if (Array.isArray(val) || (val && typeof val === "object"))
          stack.push(val);
      }
    }
  }
  return out;
}

const COMPANY_RE =
  /\b(inc\.?|llc\.?|l\.l\.c\.?|ltd\.?|foundation|alliance|solutions|corp\.?|co\.?\b|company|services|trust\b|tr\b|assn\.?|association|partners\b|holdings\b|group\b|bank\b|church\b|ministries\b|management\b|properties\b)\b/i;
const SUFFIX_RE = /^(jr\.?|sr\.?|ii|iii|iv|v|vi)$/i;

function cleanName(raw) {
  let s = (raw || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\t]+/g, " ")
    .trim();
  // Remove leading/trailing punctuation
  s = s.replace(/^[;:,]+|[;:,]+$/g, "").trim();
  return s;
}

function splitCandidates(rawStr) {
  let s = cleanName(rawStr);
  // Common delimiters between multiple owners: semicolons, newlines, pipes
  let parts = s
    .split(/[;\n\r\|]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  // If nothing split and '&' exists, keep as single entry to handle separately later
  return parts.length ? parts : s ? [s] : [];
}

function isAllCaps(str) {
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const caps = letters.replace(/[^A-Z]/g, "").length;
  return caps / letters.length > 0.9;
}

function parsePerson(name) {
  let s = cleanName(name);
  // Remove ampersands inside a single candidate (treat as whitespace per spec instruction to remove '&')
  s = s.replace(/&/g, " ");
  // Normalize spaces
  s = s.replace(/\s+/g, " ").trim();

  // Remove suffix tokens at end
  let tokens = s.split(" ").filter(Boolean);
  while (tokens.length && SUFFIX_RE.test(tokens[tokens.length - 1]))
    tokens.pop();

  if (tokens.length < 2) {
    return null;
  }

  let first = "";
  let middle = "";
  let last = "";

  if (s.includes(",")) {
    // LAST, FIRST MIDDLE
    const [left, right] = s.split(",", 2).map((t) => t.trim());
    const rightTokens = right.split(" ").filter(Boolean);
    last = left;
    first = rightTokens.shift() || "";
    middle = rightTokens.join(" ");
  } else if (isAllCaps(s)) {
    // Assume LAST FIRST [MIDDLE...]
    last = tokens[0] || "";
    first = tokens[1] || "";
    middle = tokens.slice(2).join(" ");
  } else {
    // Assume FIRST [MIDDLE...] LAST
    first = tokens[0] || "";
    last = tokens[tokens.length - 1] || "";
    middle = tokens.slice(1, -1).join(" ");
  }

  first = first.trim();
  last = last.trim();
  middle = middle.trim();

  if (!first || !last) return null;

  return {
    type: "person",
    first_name: toTitleCase(first),
    last_name: toTitleCase(last),
    ...(middle ? { middle_name: toTitleCase(middle) } : {}),
  };
}

function classifyOwner(raw) {
  const s = cleanName(raw);
  if (!s) return { invalid: { raw, reason: "empty_string" } };

  if (COMPANY_RE.test(s)) {
    return { owner: { type: "company", name: s.trim() } };
  }

  // If name contains '&', it might denote multiple owners. We'll split and return multiple.
  if (s.includes("&")) {
    const parts = s
      .split("&")
      .map((p) => p.trim())
      .filter(Boolean);
    const owners = [];
    const invalids = [];
    for (const p of parts) {
      const person = parsePerson(p);
      if (person) owners.push(person);
      else
        invalids.push({ raw: p, reason: "unparseable_person_with_ampersand" });
    }
    if (owners.length) return { owners, invalids };
    return { invalid: { raw: s, reason: "unparseable_ampersand_name" } };
  }

  const person = parsePerson(s);
  if (person) return { owner: person };

  return { invalid: { raw: s, reason: "unclassified_name" } };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let key = "";
    if (o.type === "company")
      key = `c:${o.name.toLowerCase().replace(/\s+/g, " ").trim()}`;
    else {
      const middle = o.middle_name ? ` ${o.middle_name.toLowerCase()}` : "";
      key =
        `p:${(o.first_name || "").toLowerCase()}${middle} ${(o.last_name || "").toLowerCase()}`
          .replace(/\s+/g, " ")
          .trim();
    }
    if (!seen.has(key) && key) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

function extractPropertyId(obj, text) {
  const candidates = [];
  const idKeys = [
    "property_id",
    "propertyId",
    "propId",
    "prop_id",
    "parcel_id",
    "parcelId",
    "parcel",
    "pin",
    "folio",
    "displayFolio",
    "displayStrap",
    "strap",
    "account",
    "accountNumber",
    "account_no",
  ];

  function scan(o) {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      const lk = k.toLowerCase();
      if (idKeys.includes(k) || idKeys.includes(lk)) {
        if (typeof v === "string" || typeof v === "number")
          candidates.push(String(v));
      }
      if (v && typeof v === "object") scan(v);
    }
  }
  scan(obj);

  if (candidates.length) return candidates[0];

  // Fallback: regex in text for patterns like Property ID: XXXX, PIN: XXXX
  const m = text.match(
    /\b(?:property\s*id|prop(?:erty)?id|pin|folio|strap)\s*[:#]?\s*([A-Za-z0-9_.\-\/]+)\b/i,
  );
  if (m) return m[1];

  return "unknown_id";
}

function main() {
  const html = loadInputHTML();
  const text = extractTextFromHTML(html);
  const dataObj = tryParseJSONFromText(text) || {};

  // Gather owner-related values from JSON structure
  const ownerValues = collectValuesByKeyPattern(dataObj, /owner/i);
  const ownerStrings = flattenToStrings(ownerValues)
    .map(cleanName)
    .filter(Boolean);

  // Also pull potential owner strings from raw text if none found
  if (ownerStrings.length === 0) {
    const labelMatches = [];
    const ownerLabelRe = /(owner[^:]*):?\s*([^\n\r]+)/gi;
    let m;
    while ((m = ownerLabelRe.exec(text)) !== null) {
      labelMatches.push(m[2].trim());
    }
    ownerStrings.push(...labelMatches);
  }

  // Expand concatenated strings into candidates
  let candidates = [];
  for (const s of ownerStrings) {
    const parts = splitCandidates(s);
    for (const p of parts) {
      if (p) candidates.push(p);
    }
  }

  // Classify candidates
  const validOwners = [];
  const invalidOwners = [];
  for (const c of candidates) {
    const res = classifyOwner(c);
    if (res.owner) validOwners.push(res.owner);
    else if (res.owners) validOwners.push(...res.owners);
    if (res.invalid) invalidOwners.push(res.invalid);
    if (res.invalids) invalidOwners.push(...res.invalids);
  }

  const deduped = dedupeOwners(validOwners);

  // Determine property ID
  const propertyIdRaw = extractPropertyId(dataObj, text);
  const propertyIdSafe = String(propertyIdRaw || "unknown_id").replace(
    /[^A-Za-z0-9_\-\.]/g,
    "_",
  );

  // Build owners_by_date. Attempt to detect historical groups (not available in many cases)
  const ownersByDate = { current: deduped };

  const output = {
    [`property_${propertyIdSafe}`]: {
      owners_by_date: ownersByDate,
      invalid_owners: invalidOwners,
    },
  };

  // Persist to owners/owner_data.json and print to stdout
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "owner_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify(output));
}

main();
