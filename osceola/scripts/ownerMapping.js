// ownerMapping.js
// Transform a single property's HTML (or provided structured content) into the required JSON schema.
// Focus exclusively on transformation; no validation, logging, or CLI. Use only cheerio for HTML parsing tasks.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: normalize whitespace and trim
function cleanText(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*\band\b\s*/gi, " and ")
    .trim()
    .replace(/,+$/, "")
    .trim();
}

// Helper: split a raw owner string into candidate names
function splitOwners(raw) {
  const s = cleanText(raw);
  if (!s) return [];
  // split by common delimiters, keep ampersand-separated items as separate owners if likely separate parties
  // First split by semicolons or line breaks
  const primaryParts = s.split(/[;\n\r]+/);
  const out = [];
  for (const p of primaryParts) {
    const part = cleanText(p);
    if (!part) continue;
    // If contains ' and ' split
    const andSplit = part.split(/\s+and\s+/i);
    if (andSplit.length > 1) {
      for (const a of andSplit) {
        out.push(...a.split(/\s*&\s*/));
      }
      continue;
    }
    // Split by commas when it looks like a list
    const commaParts = part.split(/\s*,\s*/).filter(Boolean);
    if (commaParts.length > 1) {
      for (const c of commaParts) {
        out.push(...c.split(/\s*&\s*/));
      }
    } else {
      out.push(...part.split(/\s*&\s*/));
    }
  }
  return out.map(cleanText).filter(Boolean);
}

// Helper: classify a single owner string
function classifyOwner(raw) {
  const s = cleanText(raw);
  if (!s) return { valid: false, reason: "empty", raw };
  const companyRegex =
    /(\b(inc|\bl\.?l\.?c\.?\b|ltd|foundation|alliance|solutions|corp|corporation|co\b|company|services|trust|\btr\b|assoc|association|condo|condominium|lp\b|llp\b|pllc\b|pc\b|partners?\b|group\b|holdings?\b|properties?\b|enterprises?\b)\b)/i;
  const hasCompany = companyRegex.test(s);

  if (hasCompany) {
    return { valid: true, owner: { type: "company", name: s } };
  }

  if (s.includes("&")) {
    const noAmp = s.replace(/&/g, " ").replace(/\s+/g, " ").trim();
    const tokens = noAmp.split(" ").filter(Boolean);
    if (tokens.length >= 2) {
      const first = cleanInvalidCharsFromName(tokens[0]);
      const last = cleanInvalidCharsFromName(tokens[tokens.length - 1]);
      const middle = cleanInvalidCharsFromName(tokens.slice(1, -1).join(" "));
      if (!first || !last) {
        return { valid: false, reason: "insufficient_tokens_ampersand", raw: s };
      }
      const obj = { type: "person", first_name: first, last_name: last };
      if (middle) obj.middle_name = middle;
      else obj.middle_name = null;
      return { valid: true, owner: obj };
    }
    return { valid: false, reason: "insufficient_tokens_ampersand", raw: s };
  }

  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "insufficient_tokens", raw: s };
  }
  const first = cleanInvalidCharsFromName(tokens[0]);
  const last = cleanInvalidCharsFromName(tokens[tokens.length - 1]);
  const middle = cleanInvalidCharsFromName(tokens.slice(1, -1).join(" "));
  if (!first || !last) {
    return { valid: false, reason: "insufficient_tokens", raw: s };
  }
  const obj = { type: "person", first_name: first, last_name: last };
  if (middle) obj.middle_name = middle;
  else obj.middle_name = null;
  return { valid: true, owner: obj };
}

// Helper: normalize key for deduplication
function normOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return `company|${owner.name.toLowerCase().trim()}`;
  const mid = owner.middle_name ? owner.middle_name.toLowerCase().trim() : "";
  return `person|${owner.first_name.toLowerCase().trim()}|${mid}|${owner.last_name.toLowerCase().trim()}`;
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

// Extract property ID with fallbacks
function extractPropertyId(data) {
  let id = null;
  const pi =
    data &&
    data.ParcelInformation &&
    data.ParcelInformation.response &&
    data.ParcelInformation.response.value &&
    data.ParcelInformation.response.value[0];
  if (pi) {
    if (pi.dsp_strap) id = String(pi.dsp_strap).trim();
    else if (pi.strap) id = String(pi.strap).trim();
  }
  if (!id) id = "unknown_id";
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Build owners array from a raw string using heuristics
function buildOwnersFromRaw(raw, invalidCollector) {
  const parts = splitOwners(raw);
  const owners = [];
  const seen = new Set();
  for (const p of parts) {
    const result = classifyOwner(p);
    if (result.valid) {
      const key = normOwnerKey(result.owner);
      if (key && !seen.has(key)) {
        owners.push(result.owner);
        seen.add(key);
      }
    } else {
      invalidCollector.push({
        raw: p,
        reason: result.reason || "unclassified",
      });
    }
  }
  return owners;
}

(function main() {
  const inputPath = path.resolve("input.json");
  const content = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(content || "");

  let data = null;
  try {
    data = JSON.parse(content);
  } catch (_) {
    const text = $("body").text();
    data = { __raw_html_text: text };
  }

  const propertyId = extractPropertyId(data);
  const invalid_owners = [];
  const owners_by_date = {};

  const sales =
    (data.SalesHistory &&
      data.SalesHistory.response &&
      data.SalesHistory.response.value) ||
    [];
  const salesSorted = sales
    .slice()
    .sort((a, b) => new Date(a.dos) - new Date(b.dos));

  for (const sale of salesSorted) {
    const dateIso = sale && sale.dos ? String(sale.dos).slice(0, 10) : null;
    const key = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : null;
    const rawNames = sale && (sale.grantees || sale.all_grantees || "");
    const owners = buildOwnersFromRaw(rawNames, invalid_owners);
    if (owners.length === 0) continue;
    const k =
      key ||
      `unknown_date_${Object.keys(owners_by_date).filter((x) => x.startsWith("unknown_date_")).length + 1}`;
    owners_by_date[k] = owners;
  }

  const pi =
    data.ParcelInformation &&
    data.ParcelInformation.response &&
    data.ParcelInformation.response.value &&
    data.ParcelInformation.response.value[0];
  let currentOwnersRaw = (pi && pi.Owners) || "";
  if (!currentOwnersRaw && data.__raw_html_text) {
    const text = data.__raw_html_text;
    const match = text.match(/owners?\s*[:\-]\s*(.+)/i);
    if (match) currentOwnersRaw = match[1];
  }
  const currentOwners = buildOwnersFromRaw(currentOwnersRaw, invalid_owners);
  owners_by_date["current"] = currentOwners;

  const dateKeys = Object.keys(owners_by_date).filter((k) => k !== "current");
  const validDate = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);
  dateKeys.sort((a, b) => {
    const av = validDate(a) ? new Date(a).getTime() : Infinity;
    const bv = validDate(b) ? new Date(b).getTime() : Infinity;
    if (av !== bv) return av - bv;
    return a.localeCompare(b);
  });
  const ordered = {};
  for (const k of dateKeys) ordered[k] = owners_by_date[k];
  if (dateKeys.length > 0) {
    ordered["current"] = owners_by_date[dateKeys[dateKeys.length - 1]] || [];
  } else {
    ordered["current"] = owners_by_date["current"] || [];
  }
  const result = {};
  result[`property_${propertyId}`] = {
    owners_by_date: ordered,
    invalid_owners,
  };

  const outDir = path.resolve("owners");
  const outPath = path.join(outDir, "owner_data.json");
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (_) {}
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
})();
