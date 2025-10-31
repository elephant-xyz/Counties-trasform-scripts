// ownerMapping.js
// Transform input.html into structured owners JSON using cheerio only for HTML parsing.
// No input validation, error handling, or logging beyond emitting JSON.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML
const html = fs.readFileSync(path.join(process.cwd(), "input.html"), "utf8");
const $ = cheerio.load(html);

// Helpers
const toTitle = (s) =>
  s.replace(
    /\S+/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
const normalizeSpaces = (s) => s.replace(/\s+/g, " ").trim();
const stripPunct = (s) => s.replace(/[\.,]+$/g, "").replace(/^\W+|\W+$/g, "");

// Detect company by keyword list (case-insensitive)
const companyIndicators = [
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
  "service",
  "trust",
  "tr",
  "associates",
  "association",
  "hoa",
  "pllc",
  "pc",
  "lp",
  "llp",
  "partners",
  "partnership",
  "bank",
  "church",
  "ministries",
  "university",
  "school",
  "club",
  "holdings",
  "properties",
  "property",
  "management",
  "group",
  "enterprises",
  "investment",
  "investments",
];

const isCompany = (name) => {
  const n = name.toLowerCase();
  return companyIndicators.some((kw) =>
    new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`, "i").test(n),
  );
};

// Remove trailing ownership/suffix tokens not part of a personal name
const removeTrailingOwnershipTokens = (name) => {
  let n = normalizeSpaces(name.replace(/&amp;/gi, "&"));
  // tokens to strip if they appear as trailing separate words
  const trailingTokens = [
    "L/E",
    "LE",
    "ET AL",
    "ETAL",
    "JTROS",
    "JT ROS",
    "H/W",
    "H & W",
    "H/W",
    "C/O",
    "AKA",
    "FKA",
    "NKA",
  ];
  let parts = n.split(" ");
  while (parts.length > 0) {
    const lastTwo = parts.slice(-2).join(" ").toUpperCase();
    const lastOne = parts[parts.length - 1].toUpperCase();
    if (trailingTokens.includes(lastTwo)) {
      parts = parts.slice(0, -2);
      continue;
    }
    if (trailingTokens.includes(lastOne)) {
      parts = parts.slice(0, -1);
      continue;
    }
    break;
  }
  return normalizeSpaces(parts.join(" "));
};

// Build person object from a single-person raw name segment
const buildPerson = (raw) => {
  const cleaned = stripPunct(removeTrailingOwnershipTokens(raw));
  if (!cleaned) return null;

  // If comma format: LAST, FIRST [MIDDLE...]
  if (/,/.test(cleaned)) {
    const [lastPart, restPart] = cleaned
      .split(",")
      .map((s) => normalizeSpaces(s));
    const restTokens = restPart.split(" ").filter(Boolean);
    const first = restTokens[0] || "";
    const middle = restTokens.slice(1).join(" ");
    if (!first || !lastPart) return null;
    const obj = {
      type: "person",
      first_name: toTitle(first),
      last_name: toTitle(lastPart.replace(/\./g, "")),
    };
    if (normalizeSpaces(middle)) obj.middle_name = toTitle(middle);
    return obj;
  }

  // Assume common property appraiser format: LAST FIRST [MIDDLE...]
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    // Single token insufficient to confidently split
    return null;
  }

  const last = tokens[0];
  const first = tokens[1];
  const middle = tokens.slice(2).join(" ");
  if (!first || !last) return null;
  const person = {
    type: "person",
    first_name: toTitle(first.replace(/\./g, "")),
    last_name: toTitle(last.replace(/\./g, "")),
  };
  if (normalizeSpaces(middle))
    person.middle_name = toTitle(middle.replace(/\./g, ""));
  return person;
};

// Parse owner line into zero or more owners, with invalids captured
const parseOwnersFromString = (raw) => {
  const owners = [];
  const invalids = [];

  let s = normalizeSpaces(raw.replace(/\u00A0/g, " ").replace(/&amp;/gi, "&"));
  if (!s) return { owners, invalids };

  // Split by clear separators indicating multiple owners
  const segments = s
    .split(/\s*&\s*|\s+AND\s+/i)
    .map(normalizeSpaces)
    .filter(Boolean);

  segments.forEach((seg) => {
    const segment = normalizeSpaces(seg);
    if (!segment) return;

    // Company detection first
    if (isCompany(segment)) {
      owners.push({ type: "company", name: normalizeSpaces(segment) });
      return;
    }

    const person = buildPerson(segment);
    if (person) {
      owners.push(person);
    } else {
      invalids.push({ raw: segment, reason: "unable_to_classify_or_split" });
    }
  });

  return { owners, invalids };
};

// Extract property id
const extractPropertyId = () => {
  let id = null;
  $("h1, h2, h3, td, div, span, p").each((_, el) => {
    const t = $(el).text();
    const m = t.match(
      /Property\s+Record\s+Information\s+for\s+([A-Za-z0-9_-]+)/i,
    );
    if (m && m[1]) {
      id = m[1];
      return false;
    }
  });

  if (!id) {
    // try common labels
    const text = $("body").text();
    const m2 = text.match(
      /\b(Property\s*ID|Account|Parcel|Property\s*Number)\s*[:#]?\s*([A-Za-z0-9_-]{6,})/i,
    );
    if (m2 && m2[2]) id = m2[2];
  }

  return id || "unknown_id";
};

// Extract current owner candidate strings from the DOM
const extractOwnerStrings = () => {
  const results = [];
  // Primary heuristic: find the Owner section header and grab the first line of the following bordered box
  $("h2").each((_, h) => {
    const ht = $(h).text().trim().toLowerCase();
    if (ht.includes("owner")) {
      // find the first block-level container after header
      const box = $(h).nextAll("div").first();
      if (box && box.length) {
        // Convert <br> to newline and split, take first line
        const rawHtml = box.html() || "";
        const withNewlines = rawHtml
          .replace(/<br\s*\/?\s*>/gi, "\n")
          .replace(/&nbsp;/gi, " ");
        const lines = withNewlines
          .split(/\n/)
          .map((t) => normalizeSpaces(t))
          .filter(Boolean);
        if (lines.length > 0) {
          results.push(lines[0]);
        } else {
          const txt = normalizeSpaces(box.text());
          if (txt) {
            const firstLine = normalizeSpaces(txt.split(/\n|\r/)[0]);
            if (firstLine) results.push(firstLine);
          }
        }
      }
    }
  });

  // Secondary heuristic: any strong label that includes Owner then the sibling text
  $("strong").each((_, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.startsWith("owner")) {
      const parent = $(el).closest("div");
      const txt = normalizeSpaces(parent.text());
      if (txt) {
        const afterLabel = normalizeSpaces(txt.replace(/^owner\s*:?/i, ""));
        if (afterLabel && afterLabel.length < 200) results.push(afterLabel);
      }
    }
  });

  // Deduplicate raw strings by normalized value
  const seen = new Set();
  const deduped = [];
  for (const r of results) {
    const k = normalizeSpaces(r).toLowerCase();
    if (!seen.has(k) && k) {
      seen.add(k);
      deduped.push(r);
    }
  }
  return deduped;
};

// Build owners_by_date structure
const ownersByDate = {};
const invalidOwners = [];

const ownerStrings = extractOwnerStrings();
const currentOwners = [];
const currentSeen = new Set();

ownerStrings.forEach((s) => {
  const { owners, invalids } = parseOwnersFromString(s);
  // Deduplicate within current by normalized printable name
  owners.forEach((o) => {
    const key =
      o.type === "company"
        ? normalizeSpaces(o.name).toLowerCase()
        : normalizeSpaces(
            [o.first_name, o.middle_name, o.last_name]
              .filter(Boolean)
              .join(" "),
          ).toLowerCase();
    if (!currentSeen.has(key)) {
      currentSeen.add(key);
      currentOwners.push(o);
    }
  });
  invalids.forEach((inv) => invalidOwners.push(inv));
});

if (currentOwners.length > 0) {
  ownersByDate["current"] = currentOwners;
}

// Compose final output
const propertyId = extractPropertyId();
const out = {};
out[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and write file
fs.mkdirSync(path.join(process.cwd(), "owners"), { recursive: true });
fs.writeFileSync(
  path.join(process.cwd(), "owners", "owner_data.json"),
  JSON.stringify(out, null, 2),
  "utf8",
);

// Print JSON
console.log(JSON.stringify(out, null, 2));
