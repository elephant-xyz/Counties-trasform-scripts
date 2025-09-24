const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Helper: normalize whitespace
function normalizeSpace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

// Helper: Title Case words (keeps roman numerals upper)
function toTitleCase(str) {
  return (str || "")
    .toLowerCase()
    .split(" ")
    .map((w) => {
      if (!w) return w;
      if (/^(ii|iii|iv|vi|vii|viii|ix|x)$/.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

// Detect if a name is a company by keywords
function isCompanyName(name) {
  const kw = [
    "inc",
    "llc",
    "l.l.c",
    "ltd",
    "limited",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "co",
    "company",
    "services",
    "trust",
    "tr",
    "associates",
    "partners",
    "holdings",
    "properties",
    "property",
    "group",
    "management",
  ];
  const n = (name || "").toLowerCase();
  return kw.some((k) => new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, "i").test(n));
}

// Remove common trailing indicators like ET AL
function stripEtAl(str) {
  return normalizeSpace((str || "").replace(/\bET\s*AL\b/gi, ""));
}

// Split compound owners separated by & and ' and '
function splitByAnd(name) {
  const cleaned = name.replace(/[\u2019']/g, "'");
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+/i)
    .map((s) => normalizeSpace(s))
    .filter(Boolean);
  return parts.length > 0 ? parts : [normalizeSpace(name)];
}

// Parse a personal name, attempting LAST FIRST MIDDLE [SUFFIX]
function parsePersonName(raw) {
  let s = normalizeSpace(raw);
  if (!s) return null;
  if (s.includes(",")) {
    const [lastPart, rest] = s.split(",").map((t) => normalizeSpace(t));
    if (!rest) return null;
    const tokens = rest.split(" ").filter(Boolean);
    const first = tokens.shift() || "";
    const suffixSet = new Set(["JR", "SR", "II", "III", "IV", "V", "VI"]);
    const middles = [];
    const suffixes = [];
    tokens.forEach((t) => {
      const T = t.replace(/\./g, "").toUpperCase();
      if (suffixSet.has(T)) suffixes.push(T);
      else middles.push(t);
    });
    const last = normalizeSpace(
      [lastPart, suffixes.join(" ")].filter(Boolean).join(" "),
    );
    const firstName = toTitleCase(first);
    const lastName = toTitleCase(last);
    const middleName = middles.length ? toTitleCase(middles.join(" ")) : null;
    if (!firstName || !lastName) return null;
    return {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
    };
  }
  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length < 2) return null;
  const lastToken = tokens[0];
  const firstToken = tokens[1];
  const rest = tokens.slice(2);
  const suffixSet = new Set(["JR", "SR", "II", "III", "IV", "V", "VI"]);
  const middles = [];
  const suffixes = [];
  rest.forEach((t) => {
    const T = t.replace(/\./g, "").toUpperCase();
    if (suffixSet.has(T)) suffixes.push(T);
    else middles.push(t);
  });
  const firstName = toTitleCase(firstToken);
  const lastName = toTitleCase(
    normalizeSpace([lastToken, suffixes.join(" ")].filter(Boolean).join(" ")),
  );
  const middleName = middles.length ? toTitleCase(middles.join(" ")) : null;
  if (!firstName || !lastName) return null;
  return {
    type: "person",
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
  };
}

// Classify an owner string into person or company objects (may return multiple if separated by &)
function classifyOwners(raw) {
  const candidates = [];
  const reasons = [];
  const base = stripEtAl(normalizeSpace(raw));
  if (!base)
    return {
      owners: [],
      invalids: [{ raw: normalizeSpace(raw), reason: "empty_after_strip" }],
    };
  const parts = splitByAnd(base);
  parts.forEach((p) => {
    const name = normalizeSpace(p);
    if (!name) {
      reasons.push({ raw: p, reason: "empty" });
      return;
    }
    if (isCompanyName(name)) {
      candidates.push({ type: "company", name: normalizeSpace(name) });
      return;
    }
    const person = parsePersonName(name);
    if (person) {
      candidates.push(person);
    } else {
      reasons.push({ raw: name, reason: "unclassified" });
    }
  });
  return { owners: candidates, invalids: reasons };
}

// Deduplicate owners by normalized identifier
function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  owners.forEach((o) => {
    let key;
    if (o.type === "person") {
      key = `person:${(o.first_name || "").toLowerCase()}|${(o.middle_name || "").toLowerCase()}|${(o.last_name || "").toLowerCase()}`;
    } else if (o.type === "company") {
      key = `company:${(o.name || "").toLowerCase().trim()}`;
    } else {
      return;
    }
    if (!seen.has(key) && key.replace(/person:|company:|\|/g, "").trim()) {
      seen.add(key);
      out.push(o);
    }
  });
  return out;
}

// Parse a date like M/D/YYYY or MM/DD/YYYY into YYYY-MM-DD
function toISODate(s) {
  const m = normalizeSpace(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Extract potential owner name strings using heuristics (strict to owner labels)
function extractOwnerNameStrings($) {
  const set = new Set();
  // Only capture spans that are labeled as owner name fields
  $("#ownerName h2 > span").each((i, el) => {
    const id = ($(el).attr("id") || "").toLowerCase();
    const title = ($(el).attr("title") || "").toLowerCase();
    if (
      id.includes("lblownername") ||
      title.includes("owner's name") ||
      title.includes("owner’s name")
    ) {
      const t = normalizeSpace($(el).text());
      if (t) set.add(t);
    }
  });
  return Array.from(set);
}

// Extract property id
function extractPropertyId($, html) {
  let id = normalizeSpace($("#ctl00_cphBody_lblRealEstateNumber").text());
  if (!id) {
    const reMatch = (html || "").match(/RE=([0-9A-Z-]+)/i);
    if (reMatch) id = reMatch[1];
  }
  if (!id) id = "unknown_id";
  return id.replace(/\s+/g, "");
}

// Extract sales dates
function extractSalesDates($) {
  const dates = [];
  $("#ctl00_cphBody_gridSalesHistory tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    const dateText = normalizeSpace($(tds.get(1)).text());
    const iso = toISODate(dateText);
    if (iso) dates.push(iso);
  });
  return Array.from(new Set(dates)).sort();
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const propIdRaw = extractPropertyId($, html);
  const propKey = `property_${propIdRaw}`;

  const rawOwnerStrings = extractOwnerNameStrings($);

  let validOwners = [];
  let invalidOwners = [];

  rawOwnerStrings.forEach((s) => {
    const { owners, invalids } = classifyOwners(s);
    validOwners = validOwners.concat(owners);
    invalidOwners = invalidOwners.concat(invalids);
  });

  validOwners = dedupeOwners(validOwners);

  const salesDates = extractSalesDates($);

  const ownersByDate = {};
  if (salesDates.length) {
    salesDates.forEach((d) => {
      ownersByDate[d] = validOwners;
    });
  }
  ownersByDate["current"] = validOwners;

  const output = {};
  output[propKey] = {
    owners_by_date: ownersByDate,
    invalid_owners: invalidOwners,
  };

  const outDir = path.join(process.cwd(), "owners");
  const outFile = path.join(outDir, "owner_data.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), "utf8");

  console.log(JSON.stringify(output, null, 2));
})();
