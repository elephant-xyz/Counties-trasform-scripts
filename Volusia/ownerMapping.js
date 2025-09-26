const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

// Helpers
const toTitleCase = (s) => {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/([\s'-]+)/) // keep delimiters like space, hyphen, apostrophe
    .map((part) => {
      if (/^[\s'-]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeName = (s) => (s || "").replace(/\s+/g, " ").trim();

const isCompany = (name) => {
  const kw = [
    "inc",
    "llc",
    "ltd",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "co",
    "company",
    "services",
    "trust",
    " tr ",
    " tr$",
    "associates",
    "partners",
    "holdings",
  ];
  const lower = ` ${name.toLowerCase()} `; // pad to catch boundaries
  return kw.some((k) => {
    if (k.endsWith("$")) return new RegExp(k, "i").test(lower.trim());
    return lower.indexOf(k) !== -1;
  });
};

const makeCompany = (name) => ({ type: "company", name: normalizeName(name) });

const makePersonFromTokens = (tokens) => {
  const tks = tokens.filter(Boolean);
  if (tks.length < 2) return null;
  // Heuristic: many appraiser sites format as LAST FIRST MIDDLE
  // If comma present, prefer "LAST, FIRST M" parsing
  const joined = tks.join(" ");
  if (joined.includes(",")) {
    const [lastPart, firstPart] = joined
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!firstPart || !lastPart) return null;
    const fTokens = firstPart.split(/\s+/).filter(Boolean);
    const first = fTokens[0];
    const middle = fTokens.slice(1).join(" ") || null;
    return {
      type: "person",
      first_name: toTitleCase(first),
      last_name: toTitleCase(lastPart),
      middle_name: middle ? toTitleCase(middle) : null,
    };
  }
  // Assume LAST FIRST M...
  const last = tks[0];
  const first = tks[1];
  const middle = tks.slice(2).join(" ") || null;
  return {
    type: "person",
    first_name: toTitleCase(first),
    last_name: toTitleCase(last),
    middle_name: middle ? toTitleCase(middle) : null,
  };
};

const splitAmpersandNames = (raw) => {
  // Attempt to parse patterns like "JOHN & JANE DOE" => two persons JOHN DOE and JANE DOE
  const str = normalizeName(raw);
  const parts = str
    .split("&")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return [str];
  const rightTokens = parts[1].split(/\s+/).filter(Boolean);
  if (rightTokens.length === 1) {
    // e.g., "JOHN & JANE DOE" where parts[1] is "JANE DOE" (2 tokens), not 1; if 1, we can't infer
    return [str];
  }
  const lastName = rightTokens[rightTokens.length - 1];
  const leftSide = parts[0];
  const leftTokens = leftSide.split(/\s+/).filter(Boolean);
  const leftFirsts = leftTokens; // likely first/middle only
  const rightFirsts = rightTokens.slice(0, -1); // first/middle on right
  const leftName = `${lastName} ${leftFirsts.join(" ")}`
    .replace(/\s+/g, " ")
    .trim(); // LAST FIRST [M]
  const rightName = `${lastName} ${rightFirsts.join(" ")}`
    .replace(/\s+/g, " ")
    .trim();
  return [leftName, rightName];
};

// Extract property id (prefer Alternate Key hidden input)
let propId = null;
const altkeyInput = $("input#altkey");
if (altkeyInput.length) {
  propId = normalizeName(altkeyInput.attr("value")) || null;
}
if (!propId) {
  // Fallback: try to find a breadcrumb or label with the number
  const bc = $(".breadcrumb-item.active").text().trim();
  const m = bc.match(/(\d{6,})/);
  if (m) propId = m[1];
}
if (!propId) propId = "unknown_id";

// Extract owner strings from likely locations
const ownerStrings = [];

// 1) Strong label Owner/Owner(s) with sibling holding values (common pattern)
$("strong").each((i, el) => {
  const label = $(el).text().trim().toLowerCase();
  if (label.includes("owner")) {
    const container = $(el).closest("div");
    const sibling = container.next();
    if (sibling && sibling.length) {
      const htmlFrag = sibling.html() || "";
      const lines = htmlFrag
        .replace(/<br\s*\/?>(\s*\n)?/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter((s) => s);
      lines.forEach((ln) => ownerStrings.push(ln));
    }
  }
});

// 2) Elements whose id/class suggests owners
$('[id*="owner" i], [class*="owner" i]').each((i, el) => {
  const txt = $(el).text().trim();
  if (txt && txt.length > 0) ownerStrings.push(txt);
});

// Normalize and isolate name parts on each line (before dashes and extra annotations)
const rawCandidates = [];
ownerStrings.forEach((s) => {
  const clean = s.split(" - ")[0].split(" — ")[0].split("|")[0];
  const cleaned = normalizeName(clean).replace(/\s{2,}/g, " ");
  if (cleaned) rawCandidates.push(cleaned);
});

// Deduplicate raw candidates by normalized text
const seenRaw = new Set();
const uniqueRaw = rawCandidates.filter((r) => {
  const key = r.toLowerCase();
  if (seenRaw.has(key)) return false;
  seenRaw.add(key);
  return true;
});

// Classify owners
const validOwners = [];
const invalidOwners = [];

const addPerson = (p, raw) => {
  if (!p || !p.first_name || !p.last_name) {
    invalidOwners.push({ raw, reason: "could_not_parse_person_name" });
    return;
  }
  validOwners.push(p);
};

const addCompany = (name) => {
  const nm = normalizeName(name);
  if (!nm) return;
  validOwners.push(makeCompany(nm));
};

uniqueRaw.forEach((raw) => {
  if (!raw || raw.length === 0) return;
  // If contains ampersand and not a company, try to expand into two people
  if (raw.includes("&") && !isCompany(raw)) {
    const expanded = splitAmpersandNames(raw);
    expanded.forEach((nm) => {
      if (!nm) return;
      const tokens = nm.split(/\s+/).filter(Boolean);
      const person = makePersonFromTokens(tokens);
      if (person) addPerson(person, nm);
      else invalidOwners.push({ raw: nm, reason: "ampersand_name_unparsable" });
    });
    return;
  }

  // Company detection
  if (isCompany(raw)) {
    addCompany(raw);
    return;
  }

  // Person heuristic
  const tokens = raw.split(/\s+/).filter(Boolean);
  const person = makePersonFromTokens(tokens);
  if (person) addPerson(person, raw);
  else invalidOwners.push({ raw, reason: "unrecognized_owner_format" });
});

// Deduplicate valid owners by normalized representation
const ownerKey = (o) => {
  if (!o) return null;
  if (o.type === "company") return `company:${o.name.toLowerCase().trim()}`;
  const mid = o.middle_name ? ` ${o.middle_name.toLowerCase().trim()}` : "";
  return `person:${(o.first_name || "").toLowerCase().trim()} ${(o.last_name || "").toLowerCase().trim()}${mid}`;
};

const seenOwners = new Set();
const dedupedOwners = [];
validOwners.forEach((o) => {
  const k = ownerKey(o);
  if (!k) return;
  if (seenOwners.has(k)) return;
  seenOwners.add(k);
  dedupedOwners.push(o);
});

// Build owners_by_date mapping; only current owners are reliable here
const ownersByDate = {};
ownersByDate["current"] = dedupedOwners;

const output = {};
output[`property_${propId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Console output (only JSON)
console.log(JSON.stringify(output));
