const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const INPUT_PATH = "input.html";
const OUTPUT_DIR = path.join("owners");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "owner_data.json");

const html = fs.readFileSync(INPUT_PATH, "utf8");
const $ = cheerio.load(html);

function textNormalize(str) {
  return (str || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function likelyAddress(line) {
  const s = line.trim();
  if (!s) return false;
  // Contains a number and either a comma or a state-like token
  const hasDigit = /\d/.test(s);
  const hasComma = /,/.test(s);
  const hasState =
    /\b(A[LKSZRAEP]|C[AOT]|D[CE]|F[LM]|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[AWR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b/.test(
      s,
    );
  const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(s);
  return hasDigit && (hasComma || hasState || hasZip);
}

function cleanOwnerLine(line) {
  return textNormalize(line)
    .replace(/^owners?:?\s*/i, "")
    .replace(/^owner name:?\s*/i, "")
    .replace(/^mailing address:?\s*/i, "")
    .replace(/^care of:?\s*/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/^[-:•\s]+/, "")
    .replace(/[\s,]+$/, "")
    .trim();
}

function gatherAfterLabel($labelEl) {
  const lines = [];
  let node = $labelEl[0].nextSibling;
  let buffer = "";
  const pushBuffer = () => {
    const val = cleanOwnerLine(buffer);
    if (val) lines.push(val);
    buffer = "";
  };
  while (node) {
    if (
      node.type === "tag" &&
      (node.name === "b" ||
        node.name === "strong" ||
        node.name === "h3" ||
        node.name === "hr")
    ) {
      break;
    }
    if (node.type === "tag" && node.name === "br") {
      pushBuffer();
    } else {
      const seg = $(node).text();
      if (seg && seg.trim()) buffer += (buffer ? " " : "") + seg;
    }
    node = node.nextSibling;
  }
  pushBuffer();
  return lines.filter(Boolean);
}

function extractOwnerCandidates($) {
  const candidates = [];
  // 1) From explicit labels like "Owners", "Owner", "Owner Name"
  $("b, strong").each((i, el) => {
    const label = textNormalize($(el).text());
    if (!label) return;
    if (
      /^owners?:?$/i.test(label) ||
      /^owner\s*name:?(\s*\d+)?$/i.test(label) ||
      /ownership/i.test(label)
    ) {
      const lines = gatherAfterLabel($(el))
        .map((l) => cleanOwnerLine(l))
        .filter((l) => l && !/^mailing address/i.test(l) && !likelyAddress(l));
      for (const l of lines) {
        if (l) candidates.push(l);
      }
    }
  });

  // 2) Fallback: look for a paragraph near a label containing Owners
  if (candidates.length === 0) {
    $('*:contains("Owners:")').each((i, el) => {
      const txt = $(el).text();
      if (/Owners:/i.test(txt)) {
        const after = txt.split(/Owners:/i)[1] || "";
        const parts = after
          .split(/\n|\r|\t|\s\s+/)
          .map(cleanOwnerLine)
          .filter(Boolean);
        for (const p of parts) {
          if (p && !likelyAddress(p)) candidates.push(p);
        }
      }
    });
  }

  // 3) Deduplicate raw candidate lines
  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const key = c
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(c);
    }
  }
  return uniq;
}

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
  "company",
  "services",
  "trust",
  " tr",
  "associates",
  "partners",
  "holdings",
  "bank",
  "ministries",
  "ministry",
  "church",
  "lp",
  "llp",
  "pllc",
];

function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((k) => n.includes(k));
}

function normalizeForDedup(ownerObj) {
  if (!ownerObj) return null;
  if (ownerObj.type === "company") {
    return (
      "company:" +
      (ownerObj.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    );
  }
  if (ownerObj.type === "person") {
    const parts = [
      ownerObj.first_name,
      ownerObj.middle_name || "",
      ownerObj.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return "person:" + parts;
  }
  return null;
}

function parsePersonName(raw) {
  let s = raw.trim();
  // Remove common suffixes
  s = s.replace(/\b(jr|sr|ii|iii|iv|v)\.?$/i, "").trim();
  // Remove extra punctuation
  s = s.replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length < 2) return null;
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(" ");
  const obj = {
    type: "person",
    first_name: first,
    last_name: last,
  };
  if (middle && middle.trim()) obj.middle_name = middle.trim();
  return obj;
}

function classifyOwner(raw, invalid_owners) {
  const trimmed = cleanOwnerLine(raw);
  if (!trimmed) return [];

  // Handle multiple parties joined by & or and
  if (/[&]/.test(trimmed)) {
    const segments = trimmed
      .split(/&/)
      .map((s) => s.trim())
      .filter(Boolean);
    const result = [];
    for (const seg of segments) {
      if (isCompanyName(seg)) {
        result.push({ type: "company", name: seg });
      } else {
        const person = parsePersonName(seg);
        if (person) result.push(person);
        else
          invalid_owners.push({
            raw: seg,
            reason: "ambiguous_name_with_ampersand",
          });
      }
    }
    if (result.length) return result;
    return [];
  }

  if (isCompanyName(trimmed)) {
    return [{ type: "company", name: trimmed }];
  }

  const person = parsePersonName(trimmed);
  if (person) return [person];
  invalid_owners.push({ raw: trimmed, reason: "unable_to_classify" });
  return [];
}

function extractPropertyId($) {
  // 1) From H2 starting with Parcel
  let id = null;
  $("h1,h2,h3").each((i, el) => {
    const t = textNormalize($(el).text());
    const m = t.match(/\bParcel\s+([A-Za-z0-9\-]+)\b/);
    if (m && m[1] && !id) id = m[1];
  });
  // 2) From <title>
  if (!id) {
    const t = textNormalize($("title").text());
    const m = t.match(/^([A-Za-z0-9\-]+)/);
    if (m && m[1]) id = m[1];
  }
  // 3) From embedded script variable GLOBAL_Strap
  if (!id) {
    const full = $.root().text();
    const m = full.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
    if (m && m[1]) id = m[1];
  }
  // 4) Fallback
  if (!id) id = "unknown_id";
  return id;
}

function buildOwnersByDate($) {
  const invalid_owners = [];
  const candidates = extractOwnerCandidates($);
  const validOwners = [];
  const seen = new Set();

  for (const raw of candidates) {
    const classified = classifyOwner(raw, invalid_owners);
    for (const owner of classified) {
      const key = normalizeForDedup(owner);
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      validOwners.push(owner);
    }
  }

  const map = {};
  if (validOwners.length) {
    map.current = validOwners;
  } else {
    map.current = [];
  }
  return { owners_by_date: map, invalid_owners };
}

const id = extractPropertyId($);
const propertyKey = `property_${id}`;
const payload = {};
const { owners_by_date, invalid_owners } = buildOwnersByDate($);
payload[propertyKey] = { owners_by_date, invalid_owners };

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

console.log(JSON.stringify(payload, null, 2));
