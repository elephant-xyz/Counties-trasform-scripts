const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: normalize whitespace
function norm(str) {
  return String(str || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractParcelId(input) {
  // Try Owners HTML first
  try {
    const html = input?.OwnersAndGeneralInformation?.response || "";
    if (cheerio && html) {
      const $ = cheerio.load(html);
      const text = $.text();
      const m = text.match(/\b(\d{9,12})\b/);
      if (m) return m[1];
      const ta = $("textarea").first().text().trim();
      if (/^\d{9,12}$/.test(ta)) return ta;
    }
  } catch {}
  try {
    const qs = input?.Sales?.source_http_request?.multiValueQueryString?.parid;
    if (Array.isArray(qs) && qs[0]) return String(qs[0]);
  } catch {}
  const err = {
      type: "error",
      message: "Parcel ID not found",
      path: "",
    };
  throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
}

// Helper: decide if string looks like a plausible owner name
function cleanOwnerCandidate(s) {
  if (!s) return "";
  let v = norm(s);
  // Remove extra artifacts like tooltips or bracketed notes
  v = v
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Remove HTML leftovers like multiple semicolons
  v = v.replace(/;+\s*/g, "; ").trim();
  // Remove trailing commas
  v = v.replace(/,+$/g, "").trim();
  return v;
}

// Classification helpers
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
  "assn",
  "association",
  "company",
  "partners",
  "lp",
  "llp",
  "pllc",
  "pc",
  "bank",
  "church",
  "ministries",
  "university",
  "college",
  "hospital",
  "group",
  "holdings",
  "properties",
  "property",
  "management",
  "developers",
  "development",
  "homes",
  "realty",
  "estate",
  "hoa",
  "homeowners",
  "apt",
  "apartments",
  "fund",
  "capital",
  "investments",
];
const COMPANY_TOKEN_REGEX = new RegExp(
  `\\b(${COMPANY_KEYWORDS.map((k) => k.replace(/\\./g, "\\\.")).join("|")})\\b`,
  "i",
);

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

function isCompany(name) {
  const v = norm(name);
  if (!v) return false;
  // Token-based match anywhere in the string
  console.log(v);
  if (COMPANY_TOKEN_REGEX.test(v)) return true;
  // Extra heuristic: names that are all caps and contain numbers are likely entities
  if (/^[A-Z0-9\s,&\-\.]+$/.test(v) && /\b\d{2,}\b/.test(v)) return true;
  return false;
}

function parsePerson(name) {
  let v = norm(name);
  if (!v) return null;
  // If contains '&', remove it per spec and split into first/last around it
  if (v.includes("&")) {
    const parts = v
      .split("&")
      .map((s) => norm(s))
      .filter(Boolean);
    if (parts.length >= 2) {
      const first = cleanInvalidCharsFromName(parts[0]);
      const last = cleanInvalidCharsFromName(parts.slice(1).join(" "));
      return {
        type: "person",
        first_name: first || null,
        last_name: last || null,
        middle_name: null,
      };
    }
  }
  // Handle comma separated Last, First Middle
  if (v.includes(",")) {
    const segs = v
      .split(",")
      .map((s) => norm(s))
      .filter(Boolean);
    if (segs.length >= 2) {
      const last = cleanInvalidCharsFromName(segs[0]);
      const rest = segs.slice(1).join(" ");
      const tokens = rest.split(/\s+/).filter(Boolean);
      const first = cleanInvalidCharsFromName(tokens.shift()) || "";
      const middle = cleanInvalidCharsFromName(tokens.join(" ")) || null;
      return {
        type: "person",
        first_name: first || null,
        last_name: last || null,
        middle_name: middle && middle.length ? middle : null,
      };
    }
  }
  // Default: split by spaces, last token = last_name
  const tokens = v.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const first = cleanInvalidCharsFromName(tokens.shift());
    const last = cleanInvalidCharsFromName(tokens.pop());
    const middle = cleanInvalidCharsFromName(tokens.join(" ")) || null;
    return {
      type: "person",
      first_name: first || null,
      last_name: last || null,
      middle_name: middle && middle.length ? middle : null,
    };
  }
  return null;
}

function classifyOwner(raw) {
  const name = cleanOwnerCandidate(raw);
  if (!name) return { valid: false, reason: "empty", raw: raw };
  if (isCompany(name)) {
    return { valid: true, owner: { type: "company", name } };
  }
  const person = parsePerson(name);
  if (person && person.first_name && person.last_name) {
    return { valid: true, owner: person };
  }
  return { valid: false, reason: "unclassified", raw: name };
}

function normalizeKeyForDedup(owner) {
  if (!owner) return "";
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .filter(Boolean)
    .map((s) => norm(s).toLowerCase());
  return parts.join(" ").trim();
}

function dedupOwners(owners) {
  const map = new Map();
  const out = [];
  for (const o of owners) {
    const key = normalizeKeyForDedup(o);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, true);
      out.push(o);
    }
  }
  return out;
}

function extractOwnersFromHTML($) {
  const candidates = [];
  // Extract from labeled rows (Owner/Ownership)
  $(".row.no-gutters").each((i, row) => {
    const $row = $(row);
    const labelDiv = $row.children("div").first();
    const valueDiv = labelDiv.next();
    const labelText = norm(labelDiv.text());
    const valueText = norm(valueDiv.text());
    if (!labelText || !valueText) return;
    // Ownership or Owner Name fields
    if (
      /\bownership\b|\bowner\b/i.test(labelText) &&
      !/owner\s*type/i.test(labelText)
    ) {
      candidates.push(valueText);
    }
    // Mailing Address may start with owner name
    if (/mailing\s*address/i.test(labelText)) {
      const beforeComma = valueText.split(",")[0];
      if (beforeComma && beforeComma.length > 1) candidates.push(beforeComma);
    }
  });
  return candidates.map(cleanOwnerCandidate).filter(Boolean);
}

function splitPotentialMultiOwner(str) {
  const v = cleanOwnerCandidate(str);
  if (!v) return [];
  // Split on semicolons or pipes when clearly separating entities, but keep '&' intact per special rule
  const parts = v
    .split(/[;\|]/)
    .map((s) => norm(s))
    .filter(Boolean);
  return parts.length ? parts : [v];
}

function ownersFromCandidates(candidates, invalidCollector) {
  const owners = [];
  for (const c of candidates) {
    const parts = splitPotentialMultiOwner(c);
    for (const p of parts) {
      const res = classifyOwner(p);
      if (res.valid) owners.push(res.owner);
      else
        invalidCollector.push({
          raw: cleanOwnerCandidate(p),
          reason: res.reason,
        });
    }
  }
  return dedupOwners(owners);
}

function extractOwnersByDate(input) {
  const html =
    (input &&
      input.OwnersAndGeneralInformation &&
      input.OwnersAndGeneralInformation.response) ||
    "";
  const $ = cheerio.load(html || "");

  // Property ID
  // const bodyFallback =
  //   (input &&
  //     input.OwnersAndGeneralInformation &&
  //     input.OwnersAndGeneralInformation.source_http_request &&
  //     input.OwnersAndGeneralInformation.source_http_request.body) ||
  //   "";
  const propId = extractParcelId(input);

  // Collect invalid owners here
  const invalid_owners = [];

  // Current owners from HTML
  const htmlCandidates = extractOwnersFromHTML($);
  const currentOwners = ownersFromCandidates(htmlCandidates, invalid_owners);

  // Historical owners/dates from Sales grantee
  const sales =
    (input &&
      input.Sales &&
      input.Sales.response &&
      input.Sales.response.rows) ||
    [];
  const dated = {};
  for (const row of sales) {
    // Expect columns: [Sale Date, BOOK, PAGE, Instrument Type, Vacant/Improved, Qualification Code, Sale Price, Grantee, ...]
    const saleDateRaw = row && row[0] ? String(row[0]) : "";
    const granteeRaw = row && row[7] ? String(row[7]) : "";
    const dateKey = norm(saleDateRaw).slice(0, 10); // YYYY-MM-DD
    if (!dateKey) continue;
    const parts = splitPotentialMultiOwner(granteeRaw);
    const owners = ownersFromCandidates(parts, invalid_owners);
    if (owners.length) {
      dated[dateKey] = dedupOwners(owners);
    }
  }

  // Sort dates chronologically
  const sortedDates = Object.keys(dated).filter(Boolean).sort();
  const owners_by_date = {};
  for (const d of sortedDates) {
    owners_by_date[d] = dated[d];
  }

  // Determine current owners: prefer HTML extraction, else latest sales grantee
  let finalCurrent = currentOwners;
  if (!finalCurrent || !finalCurrent.length) {
    const latest = sortedDates[sortedDates.length - 1];
    if (latest) finalCurrent = dated[latest] || [];
  }
  owners_by_date["current"] = dedupOwners(finalCurrent || []);

  const topKey = `property_${propId}`;
  const result = {};
  result[topKey] = { owners_by_date };
  // Root-level invalid owners per spec
  result.invalid_owners = dedupInvalids(invalid_owners);

  return result;
}

function dedupInvalids(invalids) {
  const seen = new Set();
  const out = [];
  for (const inv of invalids) {
    const key = (norm(inv.raw) + "|" + norm(inv.reason)).toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push({ raw: norm(inv.raw), reason: norm(inv.reason) });
    }
  }
  return out;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const inputStr = fs.readFileSync(inputPath, "utf8");
  const input = JSON.parse(inputStr);
  const result = extractOwnersByDate(input);
  const outStr = JSON.stringify(result, null, 2);

  // Save to owners/owner_data.json
  const outDir = path.join(process.cwd(), "owners");
  const outFile = path.join(outDir, "owner_data.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, outStr, "utf8");

  // Output to stdout
  console.log(outStr);
})();
