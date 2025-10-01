// Node.js script to transform a single-property HTML file into a JSON object per the specified schema
// Parsing exclusively with cheerio; JSON processing with vanilla JS.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Utilities
const readHtml = () =>
  fs.readFileSync(path.join(process.cwd(), "input.html"), "utf8");

const titleCase = (s) => {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ")
    .trim();
};

const normalize = (s) => (s || "").replace(/\s+/g, " ").trim();

const commonFirstNames = new Set([
  "james",
  "john",
  "robert",
  "michael",
  "william",
  "david",
  "richard",
  "joseph",
  "thomas",
  "charles",
  "christopher",
  "daniel",
  "matthew",
  "anthony",
  "mark",
  "donald",
  "steven",
  "paul",
  "andrew",
  "joshua",
  "kenneth",
  "kevin",
  "brian",
  "george",
  "edward",
  "ronald",
  "timothy",
  "jason",
  "jeffrey",
  "ryan",
  "jacob",
  "gary",
  "nicholas",
  "eric",
  "stephen",
  "larry",
  "justin",
  "scott",
  "brandon",
  "benjamin",
  "adam",
  "samuel",
  "gregory",
  "alexander",
  "patrick",
  "frank",
  "tyler",
  "raymond",
  "jack",
  "dennis",
  "jerry",
  "mary",
  "patricia",
  "jennifer",
  "linda",
  "elizabeth",
  "barbara",
  "susan",
  "jessica",
  "sarah",
  "karen",
  "nancy",
  "lisa",
  "margaret",
  "betty",
  "sandra",
  "ashley",
  "dorothy",
  "kim",
  "emily",
  "donna",
  "michelle",
  "carol",
  "amanda",
  "melissa",
  "deborah",
  "stephanie",
  "rebecca",
  "laura",
  "helen",
  "sharon",
  "cynthia",
  "kathleen",
  "amy",
  "angela",
  "shirley",
  "anna",
  "brenda",
  "pamela",
  "nicole",
  "ruth",
  "katherine",
  "samantha",
  "christine",
  "emma",
  "catherine",
  "debra",
  "virginia",
  "rachel",
  "carolyn",
  "janet",
  "maria",
  "megan",
  "june",
  "sherrie",
  "jessica",
  "meghan",
  "meaghan",
  "meagan",
  "jenny",
  "jennyfer",
  "alison",
  "allison",
  "alyson",
  "alyssa",
  "miriam",
  "miryam",
  "jason",
  "mark",
  "sherry",
  "shari",
  "sheri",
]);

const companyIndicators = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "co",
  "corp",
  "corporation",
  "company",
  "foundation",
  "alliance",
  "solutions",
  "services",
  "trust",
  " tr ",
  " tr.",
  "bank",
  "associates",
  "association",
  "partners",
  "holdings",
  "group",
  "properties",
  "property",
  "realty",
  "management",
  "mortgage",
  "finance",
  "plc",
  "lp",
  "llp",
  "pc",
  "p.c",
  "na",
  "n.a",
  "hoa",
];

const containsCompanyIndicator = (name) => {
  const lc = ` ${name.toLowerCase()} `;
  return companyIndicators.some(
    (kw) =>
      lc.includes(` ${kw} `) ||
      lc.includes(` ${kw}. `) ||
      lc.endsWith(` ${kw}`) ||
      lc.startsWith(`${kw} `) ||
      lc.includes(` ${kw}.`),
  );
};

const looksLikeCompany = (name) => {
  const cleaned = normalize(name);
  if (!cleaned) return false;
  if (containsCompanyIndicator(cleaned)) return true;
  // All caps and multi-word often indicates company names
  const words = cleaned.split(" ");
  const manyWords = words.length >= 3;
  const hasOf = /\bof\b/i.test(cleaned);
  const isAllCaps = cleaned === cleaned.toUpperCase();
  const hasComma = cleaned.includes(",");
  return (manyWords && (isAllCaps || hasOf)) || hasComma;
};

const parseDateToYMD = (s) => {
  if (!s) return null;
  const str = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Expect US format M/D/YYYY or MM/DD/YYYY
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
};

// Person parsing heuristics
const stripSuffixes = (tokens) => {
  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
  return tokens.filter((t) => !suffixes.has(t.toLowerCase()));
};

const tokensToPerson = (tokens) => {
  const t = stripSuffixes(
    tokens
      .filter(Boolean)
      .map((x) => x.trim())
      .filter(Boolean),
  );
  if (t.length === 0) return null;
  // If comma present case handled before; here we assume no commas
  if (t.length === 1) {
    // Not enough to form first/last reliably
    return null;
  }
  if (t.length === 2) {
    const a = t[0];
    const b = t[1];
    const aIsFirst = commonFirstNames.has(a.toLowerCase());
    const bIsFirst = commonFirstNames.has(b.toLowerCase());
    if (aIsFirst && !bIsFirst) {
      return {
        first_name: titleCase(a),
        middle_name: null,
        last_name: titleCase(b),
      };
    }
    if (bIsFirst && !aIsFirst) {
      return {
        first_name: titleCase(b),
        middle_name: null,
        last_name: titleCase(a),
      };
    }
    // If uncertain, prefer First Last ordering
    return {
      first_name: titleCase(a),
      middle_name: null,
      last_name: titleCase(b),
    };
  }
  // 3+ tokens: try Last, First Middle or First Middle Last
  // If second token looks like first name and last token does not, assume [Last, First, Middle*]
  const a = t[0];
  const b = t[1];
  const last = t[t.length - 1];
  const mids = t.slice(2, t.length - 1);
  const aIsFirst = commonFirstNames.has(a.toLowerCase());
  const bIsFirst = commonFirstNames.has(b.toLowerCase());
  if (!aIsFirst && bIsFirst) {
    return {
      first_name: titleCase(b),
      middle_name: mids.length ? titleCase(mids.join(" ")) : null,
      last_name: titleCase(a),
    };
  }
  // Otherwise assume [First, Middle*, Last]
  return {
    first_name: titleCase(a),
    middle_name:
      t.length > 2 ? titleCase(t.slice(1, t.length - 1).join(" ")) : null,
    last_name: titleCase(last),
  };
};

const parsePersonName = (raw) => {
  const cleaned = normalize(raw)
    .replace(/\.+/g, "")
    .replace(/\s*&\s*/g, " & ");
  if (!cleaned) return null;
  if (cleaned.includes(",")) {
    // Last, First Middle
    const parts = cleaned.split(",");
    const last = parts[0];
    const rest = normalize(parts.slice(1).join(" "));
    const rtokens = rest.split(/\s+/).filter(Boolean);
    const first = rtokens[0] || "";
    const middle = rtokens.slice(1).join(" ");
    if (!first || !last) return null;
    return {
      first_name: titleCase(first),
      middle_name: middle ? titleCase(middle) : null,
      last_name: titleCase(last),
    };
  }
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const p = tokensToPerson(tokens);
  return p;
};

const splitAmpersandNames = (name) =>
  normalize(name)
    .split(/\s*&\s*/)
    .map((s) => normalize(s))
    .filter(Boolean);

const ownerKeyForDedup = (owner) => {
  if (!owner) return null;
  if (owner.type === "company")
    return `company:${normalize(owner.name).toLowerCase()}`;
  const mid = owner.middle_name
    ? ` ${normalize(owner.middle_name).toLowerCase()}`
    : "";
  return `person:${normalize(owner.first_name).toLowerCase()}${mid} ${normalize(owner.last_name).toLowerCase()}`;
};

// Extraction functions
const extractPropertyId = ($) => {
  let id = null;
  $("tr").each((_, tr) => {
    const th = $(tr).find("th").first();
    const label = normalize(th.text());
    if (/parcel\s*id/i.test(label)) {
      const val = normalize($(tr).find("td").first().text());
      if (val) id = val;
    }
  });
  if (!id) {
    const t = normalize($("title").text());
    const m = t.match(/Report:\s*([^\s]+)$/i);
    if (m) id = m[1];
  }
  return id || "unknown_id";
};

const findSectionByTitle = ($, titleFragment) => {
  let found = null;
  $("section").each((_, sec) => {
    const title = normalize($(sec).find("header .title").first().text());
    if (title.toLowerCase().includes(titleFragment.toLowerCase())) {
      found = sec;
      return false;
    }
  });
  return found;
};

const extractCurrentOwnerCandidates = ($) => {
  const sec = findSectionByTitle($, "Owner Information");
  const names = [];
  if (sec) {
    // Prefer obvious owner name anchors, fallback to any strong candidates
    $(sec)
      .find("a")
      .each((_, a) => {
        const id = $(a).attr("id") || "";
        const text = normalize($(a).text());
        if (!text) return;
        // Try to only pick owner name anchors, not links like address or sharing
        if (/sprDeedName|lnkUpmSearch|lstDeed/i.test(id)) {
          names.push(text);
        }
      });
    if (names.length === 0) {
      // Fallback: first bold-like line inside module-content
      const possible = normalize($(sec).find(".module-content").first().text());
      if (possible) {
        // Heuristic: take first line
        const firstLine = possible.split(/\n|<br\s*\/?>/i)[0];
        if (firstLine) names.push(normalize(firstLine));
      }
    }
  }
  return names;
};

const extractSalesGrantees = ($) => {
  const sec = findSectionByTitle($, "Sales");
  const sales = [];
  if (!sec) return sales;
  $(sec)
    .find("table tbody tr")
    .each((_, tr) => {
      const dateText = normalize($(tr).find('th[scope="row"]').first().text());
      const dateYMD = parseDateToYMD(dateText);
      if (!dateYMD) return;
      // Grantee is typically the last column
      const tds = $(tr).find("td");
      let granteeText = "";
      if (tds.length) {
        granteeText = normalize($(tds[tds.length - 1]).text());
      }
      if (granteeText) {
        sales.push({ date: dateYMD, grantee: granteeText });
      }
    });
  return sales;
};

// Classification
const classifyAndExpandOwners = (raw, invalid) => {
  const cleaned = normalize(raw).replace(/\u00A0/g, " ");
  if (!cleaned) return [];

  // If the string contains an ampersand, prioritize splitting into potential multiple owners
  if (cleaned.includes("&")) {
    const parts = splitAmpersandNames(cleaned);
    const owners = [];
    parts.forEach((p) => {
      if (!p) return;
      if (looksLikeCompany(p)) {
        owners.push({ type: "company", name: p });
      } else {
        const person = parsePersonName(p);
        if (person && person.first_name && person.last_name) {
          owners.push({
            type: "person",
            first_name: person.first_name,
            last_name: person.last_name,
            middle_name: person.middle_name || null,
          });
        } else {
          invalid.push({
            raw: p,
            reason: "Ambiguous ampersand name could not be parsed as person",
          });
        }
      }
    });
    return owners;
  }

  // If it clearly looks like a company
  if (looksLikeCompany(cleaned)) {
    return [{ type: "company", name: cleaned }];
  }

  // Person fallback
  const person = parsePersonName(cleaned);
  if (person && person.first_name && person.last_name) {
    return [
      {
        type: "person",
        first_name: person.first_name,
        last_name: person.last_name,
        middle_name: person.middle_name || null,
      },
    ];
  }

  // If neither person nor company confidently parsed, mark invalid
  invalid.push({
    raw: cleaned,
    reason: "Unable to confidently classify owner",
  });
  return [];
};

const dedupeOwners = (owners) => {
  const seen = new Set();
  const out = [];
  owners.forEach((o) => {
    const key = ownerKeyForDedup(o);
    if (key && !seen.has(key)) {
      seen.add(key);
      // Ensure person.middle_name is null when empty
      if (
        o.type === "person" &&
        (!o.middle_name || !normalize(o.middle_name))
      ) {
        out.push({
          type: "person",
          first_name: o.first_name,
          last_name: o.last_name,
          middle_name: null,
        });
      } else {
        out.push(o);
      }
    }
  });
  return out;
};

// Main transform
const html = readHtml();
const $ = cheerio.load(html);

const propertyId = extractPropertyId($);

const invalidOwners = [];

// Current owners
const currentOwnerStrings = extractCurrentOwnerCandidates($);
let currentOwners = [];
currentOwnerStrings.forEach((raw) => {
  const parsed = classifyAndExpandOwners(raw, invalidOwners);
  currentOwners = currentOwners.concat(parsed);
});
currentOwners = dedupeOwners(currentOwners);

// Historical from Sales (grantees)
const sales = extractSalesGrantees($);
// Build date -> owners
const ownersByDateMap = new Map();

sales.forEach(({ date, grantee }) => {
  const owners = classifyAndExpandOwners(grantee, invalidOwners);
  const valid = dedupeOwners(owners);
  if (valid.length) {
    const key = date; // already YYYY-MM-DD
    ownersByDateMap.set(key, valid);
  }
});

// Ensure chronological order and append 'current'
const dateKeys = Array.from(ownersByDateMap.keys()).sort();
const owners_by_date = {};

dateKeys.forEach((k) => {
  owners_by_date[k] = ownersByDateMap.get(k);
});

// Current: if we found explicit current owners, use them; otherwise use latest grantee
if (currentOwners.length) {
  owners_by_date["current"] = currentOwners;
} else if (dateKeys.length) {
  owners_by_date["current"] = ownersByDateMap.get(
    dateKeys[dateKeys.length - 1],
  );
} else {
  owners_by_date["current"] = [];
}

const result = {};
const topKey = `property_${propertyId}`;
result[topKey] = {
  owners_by_date: owners_by_date,
  invalid_owners: invalidOwners,
};

const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(JSON.stringify(result, null, 2));
