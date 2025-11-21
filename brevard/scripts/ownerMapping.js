const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const inputPath = path.resolve("input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utilities
const companyIndicators = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corporation",
  "co",
  "company",
  "services",
  "trust",
  " tr",
  " bank",
  "association",
  "assn",
  "hoa",
  "church",
  "ministries",
  "ministry",
  "univ",
  "university",
  "college",
  "partners",
  "partner",
  "lp",
  "llp",
  "pllc",
  "holdings",
  "group",
];

const PREFIX_ENUMS = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];

const PREFIX_SYNONYMS = {
  mister: "Mr.",
  missus: "Mrs.",
  misses: "Mrs.",
  madam: "Mrs.",
  madame: "Mrs.",
  mistress: "Mrs.",
  doctor: "Dr.",
  professor: "Prof.",
  reverend: "Rev.",
  father: "Fr.",
  sister: "Sr.",
  brother: "Br.",
  captain: "Capt.",
  colonel: "Col.",
  major: "Maj.",
  lieutenant: "Lt.",
  sergeant: "Sgt.",
  honorable: "Hon.",
  honourable: "Hon.",
  sheik: "Sheikh",
};

const SUFFIX_ENUMS = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

const SUFFIX_SYNONYMS = {
  junior: "Jr.",
  senior: "Sr.",
  second: "II",
  "2nd": "II",
  third: "III",
  "3rd": "III",
  fourth: "IV",
  "4th": "IV",
  esquire: "Esq.",
  retired: "Ret.",
};

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(
      /\b([A-Za-z][A-Za-z'\-]*)/g,
      (m) => m.charAt(0).toUpperCase() + m.slice(1),
    );
}

function normalizeAffixKey(value) {
  return value ? value.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
}

function buildAffixMap(values, aliases = {}) {
  const map = {};
  const assign = (token, canonical) => {
    const key = normalizeAffixKey(token);
    if (key) map[key] = canonical;
  };
  for (const value of values) {
    if (!value) continue;
    const canonical = value;
    assign(canonical, canonical);
    if (canonical.endsWith(".")) {
      assign(canonical.slice(0, -1), canonical);
    }
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    assign(alias, canonical);
  }
  return map;
}

const PREFIX_MAPPING = buildAffixMap(PREFIX_ENUMS, PREFIX_SYNONYMS);
const SUFFIX_MAPPING = buildAffixMap(SUFFIX_ENUMS, SUFFIX_SYNONYMS);

function normalizeAffixToken(token) {
  return normalizeAffixKey(token);
}

function normalizeSpace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function isCompany(nameRaw) {
  const n = " " + nameRaw.toLowerCase() + " ";
  return companyIndicators.some((ind) => n.includes(" " + ind + " "));
}

function isAllCaps(str) {
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  const caps = letters.replace(/[^A-Z]/g, "").length;
  return caps / letters.length > 0.9;
}

function splitCompoundAndNames(segment) {
  // Handles patterns like "John & Jane Smith" => ["John Smith", "Jane Smith"]
  const seg = normalizeSpace(segment);
  if (!seg) return [];
  // If comma present, treat as separate owner entry; return as-is
  if (seg.includes(",")) return [seg];
  // If contains ampersand, try to expand
  if (seg.includes("&")) {
    const parts = seg.split("&").map((p) => normalizeSpace(p));
    const lastToken = parts[parts.length - 1].split(" ").filter(Boolean);
    const lastName =
      lastToken.length > 1 ? lastToken[lastToken.length - 1] : "";
    const results = [];
    if (lastName) {
      // Attach lastName to any first-only tokens
      for (let i = 0; i < parts.length; i++) {
        const tokens = parts[i].split(" ").filter(Boolean);
        if (tokens.length === 1) {
          results.push(tokens[0] + " " + lastName);
        } else {
          results.push(parts[i]);
        }
      }
      return results.map(normalizeSpace);
    }
    return parts.map(normalizeSpace);
  }
  return [seg];
}

function classifyPersonName(name) {
  const raw = normalizeSpace(name).replace(/&/g, " ");
  if (!raw) return null;

  let prefix_name = null;
  let suffix_name = null;
  let first = "";
  let middle = "";
  let last = "";

  const commaParts = raw
    .split(",")
    .map((part) => normalizeSpace(part))
    .filter(Boolean);

  if (commaParts.length > 1) {
    last = commaParts[0];
    let remainder = commaParts.slice(1).join(" ");
    let tokens = remainder.split(" ").filter(Boolean);
    if (!tokens.length) return null;

    const lastToken = tokens[tokens.length - 1];
    const suffixCandidate = SUFFIX_MAPPING[normalizeAffixToken(lastToken)];
    if (suffixCandidate) {
      suffix_name = suffixCandidate;
      tokens.pop();
    }

    if (!tokens.length) return null;

    const firstToken = tokens[0];
    const prefixCandidate = PREFIX_MAPPING[normalizeAffixToken(firstToken)];
    if (prefixCandidate) {
      prefix_name = prefixCandidate;
      tokens.shift();
    }

    if (!tokens.length) return null;

    first = tokens.shift() || "";
    middle = tokens.join(" ");

    const lastTokens = last.split(" ").filter(Boolean);
    if (lastTokens.length) {
      const lastSuffixCandidate =
        SUFFIX_MAPPING[normalizeAffixToken(lastTokens[lastTokens.length - 1])];
      if (lastSuffixCandidate) {
        suffix_name = suffix_name || lastSuffixCandidate;
        lastTokens.pop();
        last = lastTokens.join(" ");
      }
    }
  } else {
    let tokens = raw.split(" ").filter(Boolean);
    if (tokens.length < 2) return null;

    const firstToken = tokens[0];
    const prefixCandidate = PREFIX_MAPPING[normalizeAffixToken(firstToken)];
    if (prefixCandidate) {
      prefix_name = prefixCandidate;
      tokens.shift();
    }

    if (!tokens.length) return null;

    const lastToken = tokens[tokens.length - 1];
    const suffixCandidate = SUFFIX_MAPPING[normalizeAffixToken(lastToken)];
    if (suffixCandidate) {
      suffix_name = suffixCandidate;
      tokens.pop();
    }

    if (tokens.length < 2) return null;

    const coreString = tokens.join(" ");
    if (isAllCaps(coreString)) {
      last = tokens[0] || "";
      first = tokens[1] || "";
      middle = tokens.slice(2).join(" ");
    } else {
      first = tokens[0] || "";
      last = tokens[tokens.length - 1] || "";
      middle = tokens.slice(1, -1).join(" ");
    }
  }

  first = normalizeSpace(first);
  last = normalizeSpace(last);
  middle = normalizeSpace(middle);

  if (!first || !last) return null;

  return {
    type: "person",
    first_name: toTitleCase(first),
    last_name: toTitleCase(last),
    middle_name: middle ? toTitleCase(middle) : null,
    prefix_name,
    suffix_name,
  };
}

function classifyOwner(name) {
  const raw = normalizeSpace(name);
  if (!raw) return { owner: null, invalidReason: "empty" };
  if (isCompany(raw)) {
    return { owner: { type: "company", name: toTitleCase(raw) } };
  }
  const person = classifyPersonName(raw);
  if (person) return { owner: person };
  return { owner: null, invalidReason: "unclassifiable" };
}

function extractPropertyId($) {
  let id = (
    $("#hfAccount").attr("value") ||
    $("#hfAccount").val() ||
    ""
  ).trim();
  if (!id) {
    const t = normalizeSpace($("#divPropertySearch_Details_Account").text());
    const m = t.match(/Account:\s*(\d{4,})/i);
    if (m) id = m[1];
  }
  return id || "unknown_id";
}

function extractOwnerStrings($) {
  const texts = [];
  // Primary, most reliable source
  $('[data-bind="text: publicOwners"]').each((i, el) => {
    const t = normalizeSpace($(el).text());
    if (t) texts.push(t);
  });
  if (texts.length > 0) {
    const seen = new Set();
    const unique = [];
    texts.forEach((t) => {
      const k = t.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(t);
      }
    });
    return unique;
  }
  // Fallback: based on label. Remove notice nodes inside the cell before reading text.
  $(".cssDetails_Top_Row").each((i, row) => {
    const label = normalizeSpace(
      $(row).find(".cssDetails_Top_Cell_Label").text(),
    ).toLowerCase();
    if (label.includes("owner")) {
      const cell = $(row).find(".cssDetails_Top_Cell_Data").first().clone();
      cell.find(".cssDetails_Top_Notice").remove();
      const data = normalizeSpace(cell.text());
      if (data) texts.push(data);
    }
  });
  const seen = new Set();
  const unique = [];
  texts.forEach((t) => {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(t);
    }
  });
  return unique;
}

function explodeOwnersFromText(raw) {
  const parts = raw
    .replace(/\band\b/gi, " & ")
    .replace(/\s+/g, " ")
    .split(/;|\n|\r|\||<br\s*\/?>/i)
    .map(normalizeSpace)
    .filter(Boolean);
  // Further split ampersand compounds
  const expanded = [];
  parts.forEach((p) => {
    const sub = splitCompoundAndNames(p);
    sub.forEach((s) => expanded.push(s));
  });
  return expanded.filter(Boolean);
}

function extractCurrentOwners($) {
  const ownerTexts = extractOwnerStrings($);
  const nameCandidates = [];
  ownerTexts.forEach((t) => {
    explodeOwnersFromText(t).forEach((n) => nameCandidates.push(n));
  });
  // Deduplicate by normalized name, then classify
  const dedup = [];
  const seen = new Set();
  const invalid = [];
  nameCandidates.forEach((n) => {
    const key = n.toLowerCase().trim();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    const { owner, invalidReason } = classifyOwner(n);
    if (owner) {
      // Build normalized identity for dedup across person/company objects
      let okey;
      if (owner.type === "person") {
        const full =
          `${owner.first_name} ${owner.middle_name ? owner.middle_name + " " : ""}${owner.last_name}`
            .toLowerCase()
            .trim();
        okey = `person|${full}`;
      } else {
        okey = `company|${owner.name.toLowerCase().trim()}`;
      }
      if (!dedup.some((o) => o.__key === okey)) {
        owner.__key = okey; // temp key for internal dedup
        dedup.push(owner);
      }
    } else {
      invalid.push({ raw: n, reason: invalidReason || "unknown" });
    }
  });
  // Remove temp keys
  dedup.forEach((o) => {
    delete o.__key;
  });
  return { owners: dedup, invalid };
}

function extractSaleDates($) {
  const dates = [];
  $("#divSearchDetails_Sales table tbody tr").each((i, tr) => {
    const td = $(tr).find("td").first();
    const t = normalizeSpace(td.text());
    if (t && /\d{2}\/\d{2}\/\d{4}/.test(t)) {
      const m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        const mm = m[1],
          dd = m[2],
          yyyy = m[3];
        dates.push(`${yyyy}-${mm}-${dd}`);
      }
    }
  });
  // Unique and sort chronologically
  const unique = Array.from(new Set(dates));
  unique.sort();
  return unique;
}

// Main build
const propertyId = extractPropertyId($);
const { owners: currentOwners, invalid: invalidOwners } =
  extractCurrentOwners($);
const saleDates = extractSaleDates($);

// Build owners_by_date
const ownersByDate = {};
// If there are sale dates, assume the most recent sale date corresponds to the current owners
if (saleDates.length > 0) {
  const latest = saleDates[saleDates.length - 1];
  ownersByDate[latest] = currentOwners;
}
ownersByDate["current"] = currentOwners;

const output = {};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and write file
const outDir = path.resolve("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON to stdout
console.log(JSON.stringify(output, null, 2));
