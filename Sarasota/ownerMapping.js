const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const html = fs.readFileSync("input.html", "utf-8");
const $ = cheerio.load(html);

// Utility helpers
const normalizeWs = (s) => (s || "").replace(/\s+/g, " ").trim();
const toLower = (s) => (s || "").toLowerCase();

const companyKeywords = [
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
  "company",
  "group",
  "holdings",
  "partners",
  "partnership",
  "lp",
  "llp",
  "plc",
  "pllc",
  "pc",
  "bank",
  "association",
  "hoa",
  "investment",
  "investments",
  "properties",
  "property",
  "associates",
  "enterprise",
  "enterprises",
];

const noiseWords = [
  "et",
  "al",
  "et al",
  "ttee",
  "trustee",
  "h/w",
  "h w",
  "ten",
  "jt",
  "joint",
  "tenants",
  "by",
  "entirety",
  "the",
  "revocable",
  "rev",
  "liv",
  "living",
  "deceased",
  "estate",
  "est",
  "c/o",
];

const suffixes = ["jr", "sr", "iii", "iv", "ii", "v"];

const looksLikeAddress = (text) => {
  const t = toLower(text);
  if (/\b\d{5}(?:-\d{4})?\b/.test(t)) return true; // zip
  if (/\b[a-z]{2}\b[, ]\s*\d{5}/i.test(text)) return true; // state + zip
  if (/^\s*\d+\b/.test(text)) return true; // starts with number
  if (
    /(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ct|court|ln|lane|hwy|highway|#)/i.test(
      text,
    )
  )
    return true;
  if (/change mailing address/i.test(text)) return true;
  return false;
};

const cleanOwnerRaw = (raw) => {
  let s = normalizeWs(raw);
  s = s.replace(/\s{2,}/g, " ").trim();
  // Remove repeated commas and trailing punctuation
  s = s
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/^[,\-\s]+|[,\-\s]+$/g, "");
  // Remove parenthetical notes
  s = s.replace(/\([^)]*\)/g, "").trim();
  return s;
};

const removeNoiseTokens = (tokens) =>
  tokens.filter((t) => !noiseWords.includes(toLower(t)));

const stripSuffixes = (tokens) =>
  tokens.filter((t) => !suffixes.includes(toLower(t).replace(/\./g, "")));

const isCompany = (name) => {
  const n = toLower(name);
  return companyKeywords.some((k) =>
    new RegExp(`(^|\\b)${k}(\\b|\n|\r|\s|\.|,|$)`, "i").test(name),
  );
};

const parsePersonName = (name) => {
  let s = normalizeWs(name);
  s = s.replace(/\s{2,}/g, " ");
  // Remove common noise phrases inside the name
  s = s
    .replace(
      /\b(ET\s+AL|ETAL|TTEE|TRUSTEE|H\/W|H\s+W|REVOCABLE|REV|LIV|LIVING|DECEASED|ESTATE|EST|C\/O)\b/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  // Capitalize names properly (first letter uppercase, rest lowercase)
  const capitalize = (str) => {
    if (!str) return null;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  
  // Handle comma format: LAST, FIRST M
  if (/,/.test(s)) {
    const parts = s.split(",").map((p) => normalizeWs(p));
    const last = parts[0];
    const rest = normalizeWs(parts.slice(1).join(" "));
    let tokens = rest.split(/\s+/);
    tokens = stripSuffixes(removeNoiseTokens(tokens));
    if (tokens.length === 0 || !last) return null;
    const first = tokens[0] || null;
    const middle = tokens.slice(1).join(" ") || null;
    if (!first || !last) return null;
    return {
      type: "person",
      first_name: capitalize(first),
      last_name: capitalize(last),
      middle_name: middle ? middle.split(" ").map(capitalize).join(" ") : null,
    };
  }
  // No comma: assume Last First [Middle ...]
  let tokens = s.split(/\s+/);
  tokens = stripSuffixes(removeNoiseTokens(tokens));
  if (tokens.length < 2) return null;
  const last = tokens[0];  // Last name comes first
  const first = tokens[1];  // First name comes second
  const middle = tokens.slice(2).join(" ") || null;  // Rest is middle name
  if (!first || !last) return null;
  
  return {
    type: "person",
    first_name: capitalize(first),
    last_name: capitalize(last),
    middle_name: middle ? middle.split(" ").map(capitalize).join(" ") : null,
  };
};

const splitAmpersandOwners = (raw) => {
  // Split on & or ' and '
  return raw
    .split(/\s*&\s*|\s+and\s+/i)
    .map((s) => normalizeWs(s))
    .filter(Boolean);
};

const normalizeOwnerKey = (owner) => {
  if (!owner) return null;
  if (owner.type === "company") return toLower(normalizeWs(owner.name));
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .filter(Boolean)
    .join(" ");
  return toLower(normalizeWs(parts));
};

const classifyOwner = (raw, invalidStore) => {
  const cleaned = cleanOwnerRaw(raw);
  if (!cleaned) return [];

  // If looks like address, skip
  if (looksLikeAddress(cleaned)) {
    invalidStore.push({ raw: cleaned, reason: "appears_to_be_address" });
    return [];
  }

  // Company?
  if (isCompany(cleaned)) {
    return [{ type: "company", name: cleaned }];
  }

  // Ampersand indicates multiple persons
  if (/[&]|\sand\s/i.test(cleaned)) {
    const parts = splitAmpersandOwners(cleaned);
    const results = [];
    for (const p of parts) {
      const person = parsePersonName(p);
      if (person) results.push(person);
      else invalidStore.push({ raw: p, reason: "unparsable_person_name" });
    }
    return results;
  }

  const person = parsePersonName(cleaned);
  if (person) return [person];
  invalidStore.push({ raw: cleaned, reason: "unable_to_classify" });
  return [];
};

const parseDateToIso = (s) => {
  const str = normalizeWs(s);
  // yyyy-mm-dd
  let m = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const [_, y, mo, d] = m;
    const mm = String(parseInt(mo, 10)).padStart(2, "0");
    const dd = String(parseInt(d, 10)).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  // mm/dd/yyyy or m/d/yy
  m = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    let [_, mo, d, y] = m;
    mo = String(parseInt(mo, 10)).padStart(2, "0");
    d = String(parseInt(d, 10)).padStart(2, "0");
    y = String(parseInt(y, 10));
    if (y.length === 2) y = parseInt(y, 10) >= 70 ? `19${y}` : `20${y}`;
    return `${y}-${mo}-${d}`;
  }
  // Month dd, yyyy
  m = str.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i,
  );
  if (m) {
    const months = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const mo = months[toLower(m[1])];
    const d = String(parseInt(m[2], 10)).padStart(2, "0");
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  return null;
};

// Extract property ID from multiple hints
const extractPropertyId = () => {
  let id = null;
  // 1) From explicit header text like "Property Record Information for X"
  $("*").each((i, el) => {
    if (id) return;
    const t = normalizeWs($(el).text());
    const m = t.match(
      /Property\s+Record\s+Information\s+for\s+([A-Za-z0-9_-]+)/i,
    );
    if (m) id = m[1];
  });
  // 2) From any link with strap=<id>
  if (!id) {
    $("a[href]").each((i, el) => {
      if (id) return;
      const href = $(el).attr("href") || "";
      const m = href.match(/[?&]strap=([0-9A-Za-z_-]+)/i);
      if (m) id = m[1];
    });
  }
  // 3) From any text containing a 10+ digit number
  if (!id) {
    const bodyText = normalizeWs($("body").text());
    const m = bodyText.match(/\b(\d{8,})\b/);
    if (m) id = m[1];
  }
  if (!id) id = "unknown_id";
  return id;
};

// Extract owners from the Ownership section and generically elsewhere
const extractOwnerCandidates = () => {
  const candidates = [];

  // Primary: UL with Ownership label
  $("ul").each((i, ul) => {
    const $ul = $(ul);
    const lis = $ul.find("> li");
    lis.each((j, li) => {
      const $li = $(li);
      const text = normalizeWs($li.text());
      if (/^Ownership\s*:$/i.test(text)) {
        // Collect following li elements until hitting another bold/section-like label
        for (let k = j + 1; k < lis.length; k++) {
          const $next = $(lis[k]);
          const txt = normalizeWs($next.text());
          if (/^\s*$/.test(txt)) continue;
          // stop if we hit a new section header-style
          const cls = ($next.attr("class") || "").toLowerCase();
          if (/\bmed\b/.test(cls) && /\bbold\b/.test(cls)) break;
          // push candidate and continue but also try to avoid address-like lines
          if (!looksLikeAddress(txt)) {
            candidates.push({ raw: txt, contextEl: $next });
          }
          // For typical page, only the first after Ownership is owner name; subsequent is address. We can break after the first non-address OR after two items.
          if (k >= j + 1) break;
        }
      }
    });
  });

  // Generic: any label containing Owner: <value>
  const labelRegex = /owner[^:]*:/i;
  $("*").each((i, el) => {
    const $el = $(el);
    const text = normalizeWs($el.text());
    if (labelRegex.test(text)) {
      // Try to find immediate next sibling text content as value
      let value = null;
      const next = $el.next();
      if (next && next.length) {
        const v = normalizeWs(next.text());
        if (v && !looksLikeAddress(v) && !/owner/i.test(v)) value = v;
      }
      if (!value) {
        // Try within the same element after colon
        const m = text.split(":");
        if (m.length > 1) {
          const v2 = normalizeWs(m.slice(1).join(":"));
          if (v2 && !looksLikeAddress(v2)) value = v2;
        }
      }
      if (value) candidates.push({ raw: value, contextEl: $el });
    }
  });

  // Deduplicate raw candidates by normalized text
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = toLower(cleanOwnerRaw(c.raw));
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
};

// Attempt to extract historical owner rows with dates (heuristic)
const extractHistoricalGroups = () => {
  const groups = [];
  // Look for tables near headers mentioning Sales, Transfers, Owner History
  const headerRegex =
    /(Sales\s*&\s*Transfers|Transfers|Owner\s*History|Ownership\s*History)/i;
  $("*").each((i, el) => {
    const $el = $(el);
    const text = normalizeWs($el.text());
    if (headerRegex.test(text)) {
      // find the following table siblings
      let $table = $el.nextAll("table").first();
      if (!$table || !$table.length) return;
      const rows = $table.find("tbody tr, tr");
      rows.each((ri, r) => {
        const $r = $(r);
        const cells = $r.find("td, th");
        if (!cells.length) return;
        let dateStr = null;
        let ownerStr = null;
        cells.each((ci, c) => {
          const txt = normalizeWs($(c).text());
          if (!dateStr) {
            const iso = parseDateToIso(txt);
            if (iso) dateStr = iso;
          }
          if (!ownerStr) {
            // favor cell with many letters and not numeric-heavy
            if (
              /^[A-Za-z ,.'&-]+$/.test(txt) &&
              txt.length >= 3 &&
              !/\b(no\s+sales|there are no)/i.test(txt)
            ) {
              ownerStr = txt;
            }
          }
        });
        if (ownerStr) groups.push({ date: dateStr, raw: ownerStr });
      });
    }
  });
  return groups;
};

// Main
const propertyId = extractPropertyId();

// Owner extraction
const invalid_owners = [];
const ownerCandidates = extractOwnerCandidates();

// Classify current owners first from Ownership section candidates
let currentOwners = [];
for (const c of ownerCandidates) {
  const owners = classifyOwner(c.raw, invalid_owners);
  currentOwners.push(...owners);
}

// Fallback: If none found at all, try to infer from first bold section near "Ownership:" in raw text
if (currentOwners.length === 0) {
  const bodyText = normalizeWs($("body").text());
  const m = bodyText.match(/Ownership\s*:\s*([^\n\r]+)/i);
  if (m) {
    const o = cleanOwnerRaw(m[1]);
    const owners = classifyOwner(o, invalid_owners);
    currentOwners.push(...owners);
  }
}

// Deduplicate current owners
const dedupeOwners = (owners) => {
  const out = [];
  const seen = new Set();
  for (const o of owners) {
    const key = normalizeOwnerKey(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // Ensure middle_name only if non-empty
    if (
      o.type === "person" &&
      (!o.middle_name || !normalizeWs(o.middle_name))
    ) {
      out.push({
        type: "person",
        first_name: o.first_name,
        last_name: o.last_name,
        middle_name: null,
      });
    } else if (o.type === "person") {
      out.push({
        type: "person",
        first_name: o.first_name,
        last_name: o.last_name,
        middle_name: normalizeWs(o.middle_name),
      });
    } else {
      out.push({ type: "company", name: o.name });
    }
  }
  return out;
};

currentOwners = dedupeOwners(currentOwners);

// Historical groups
const histGroups = extractHistoricalGroups();
const ownersByDate = {};
let unknownCounter = 1;

// Add historical owners
for (const g of histGroups) {
  const owners = classifyOwner(g.raw, invalid_owners);
  const validOwners = dedupeOwners(owners);
  if (validOwners.length === 0) continue;
  let key = g.date || `unknown_date_${unknownCounter++}`;
  if (!ownersByDate[key]) ownersByDate[key] = [];
  // merge into date bucket with dedupe
  const existing = ownersByDate[key];
  const seen = new Set(existing.map((o) => normalizeOwnerKey(o)));
  for (const o of validOwners) {
    const k = normalizeOwnerKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    existing.push(o);
  }
}

// Ensure current owners bucket
ownersByDate["current"] = dedupeOwners(currentOwners);

// Sort date keys chronologically and rebuild map ending with current
const sortDateKeys = (keys) => {
  const dateKeys = keys.filter(
    (k) => k !== "current" && !/^unknown_date_/i.test(k),
  );
  const unknownKeys = keys.filter((k) => /^unknown_date_/i.test(k));
  dateKeys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [...dateKeys, ...unknownKeys, "current"];
};

const finalOwnersByDate = {};
const orderedKeys = sortDateKeys(Object.keys(ownersByDate));
for (const k of orderedKeys) {
  finalOwnersByDate[k] = ownersByDate[k] || [];
}

const output = {};
output[`property_${propertyId}`] = { owners_by_date: finalOwnersByDate };
output["invalid_owners"] = invalid_owners;

// Ensure output directory and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

// Print JSON to stdout
console.log(JSON.stringify(output, null, 2));
