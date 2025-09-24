const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML from input.html
const html = fs.readFileSync(path.resolve("input.html"), "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Utility: Title Case a token (keep all-caps if input is all-caps)
function titleCaseToken(tok) {
  if (!tok) return tok;
  if (tok.toUpperCase() === tok && tok.toLowerCase() !== tok) {
    // Looks like ALL CAPS alpha; title-case
    return tok.charAt(0) + tok.slice(1).toLowerCase();
  }
  return tok; // leave as-is
}

// Company detection (case-insensitive)
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
  "service",
  "trust",
  "tr",
  "association",
  "assn",
  "bank",
  "partners",
  "lp",
  "pllc",
  "pc",
  "p.c",
  "plc",
];
function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  return COMPANY_KEYWORDS.some((k) =>
    new RegExp(`(^|[^a-z])${k}([^a-z]|$)`).test(n),
  );
}

// Parse a single person-like segment that may be formatted as "LAST FIRST M [SUFFIX]" or "FIRST M LAST"
function parsePersonFromSegment(seg, contextLastName) {
  const raw = norm(seg);
  if (!raw) return null;
  const parts = raw.split(" ").filter(Boolean);
  const isAllCaps = (t) => /[A-Z]/.test(t) && t === t.toUpperCase();
  const tokensAllCaps = parts.every(isAllCaps);

  if (parts.length === 1) {
    if (!contextLastName) return null;
    return {
      type: "person",
      first_name: titleCaseToken(parts[0]),
      last_name: titleCaseToken(contextLastName),
      middle_name: null,
    };
  }

  let first = null,
    middle = null,
    last = null;

  if (tokensAllCaps) {
    if (parts.length >= 3) {
      // Assume LAST FIRST [MIDDLE...]
      last = parts[0];
      first = parts[1] || null;
      const remaining = parts.slice(2);
      if (remaining.length) middle = remaining.join(" ");
    } else if (parts.length === 2) {
      // Ambiguous: could be LAST FIRST or FIRST M. If context last name exists, prefer FIRST [MIDDLE] with context last.
      if (contextLastName) {
        first = parts[0];
        middle = parts[1];
        last = contextLastName;
      } else {
        // Fallback to LAST FIRST
        last = parts[0];
        first = parts[1];
      }
    }
  } else {
    // Assume FIRST [MIDDLE] LAST
    first = parts[0];
    last = parts[parts.length - 1];
    if (parts.length > 2) {
      middle = parts.slice(1, -1).join(" ");
    }
  }

  const toName = (t) => titleCaseToken(norm(t));
  const person = {
    type: "person",
    first_name: toName(first),
    last_name: toName(last || contextLastName || ""),
    middle_name: middle ? toName(middle) : null,
  };

  if (!person.first_name || !person.last_name) return null;
  return person;
}

// Parse a line that may contain multiple owners separated by '&'
function parseOwnerLine(line) {
  const owners = [];
  const invalids = [];
  const raw = norm(line || "");
  if (!raw) return { owners, invalids };

  // Split by & while preserving non-empty segments
  const segments = raw
    .split("&")
    .map((s) => norm(s))
    .filter((s) => s.length > 0);

  // If raw had trailing '&' leading to drop of a second empty segment
  const hadTrailingAmp = /&\s*$/.test(line || "");

  // Determine a shared last name if present in first segment and not in later segments
  let sharedLast = null;
  if (segments.length > 0) {
    const firstSegParts = norm(segments[0]).split(" ").filter(Boolean);
    if (firstSegParts.length >= 2) {
      if (firstSegParts[0] === firstSegParts[0].toUpperCase()) {
        sharedLast = firstSegParts[0];
      } else {
        sharedLast = firstSegParts[firstSegParts.length - 1];
      }
    }
  }

  segments.forEach((seg, idx) => {
    if (!seg) return;
    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: norm(seg) });
      return;
    }
    const person = parsePersonFromSegment(
      seg,
      idx > 0 ? sharedLast : undefined,
    );
    if (person) {
      owners.push(person);
    } else {
      invalids.push({ raw: seg, reason: "Unparseable owner segment" });
    }
  });

  if (hadTrailingAmp) {
    invalids.push({ raw, reason: "Trailing ampersand suggests missing owner" });
  }

  return { owners, invalids };
}

// Deduplicate owners by normalized key
function ownerKey(o) {
  if (!o) return "";
  if (o.type === "company") return `company:${norm(o.name).toLowerCase()}`;
  const fn = norm(o.first_name || "").toLowerCase();
  const mn = norm(o.middle_name || "").toLowerCase();
  const ln = norm(o.last_name || "").toLowerCase();
  return `person:${fn}|${mn}|${ln}`;
}
function dedupeOwners(arr) {
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const k = ownerKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

// Extract property ID
function extractPropertyId($) {
  let id = norm($("#lblParcelID").text());
  if (!id) {
    $("*").each((i, el) => {
      if (!id && $(el).text && norm($(el).text()) === "Parcel ID") {
        const sib = $(el).parent().find("span").first().text();
        if (sib) id = norm(sib);
      }
    });
  }
  return id || "unknown_id";
}

// Extract current owners from mailing address first line
function extractCurrentOwners($) {
  const invalids = [];
  let line = "";
  const mailHtml = $("#lblMailingAddress").html();
  if (mailHtml) {
    const parts = mailHtml
      .split(/<br\s*\/?>/i)
      .map((p) => norm(cheerio.load(`<div>${p}</div>`)("div").text()))
      .filter(Boolean);
    if (parts.length > 0) line = parts[0];
  } else {
    const cand = $("*")
      .filter((i, el) => {
        const t = norm($(el).text());
        return /\b[A-Z]{2,}\b/.test(t) && t.includes("&");
      })
      .first()
      .text();
    line = norm(cand);
  }
  const { owners, invalids: inv } = parseOwnerLine(line);
  return { owners: dedupeOwners(owners), invalids: invalids.concat(inv) };
}

// Extract previous/historical owners
function extractHistoricalOwners($) {
  const groups = [];
  const prevRaw = norm($("#lblPreviousOwnerName").text());
  if (prevRaw) {
    const { owners, invalids } = parseOwnerLine(prevRaw);
    const rows = $("#tblSaleLines tr").slice(1);
    let dateStr = "";
    if (rows.length >= 2) {
      dateStr = norm($(rows.get(1)).find("td").first().text());
    } else if (rows.length >= 1) {
      dateStr = norm($(rows.get(0)).find("td").first().text());
    }
    const dateKey =
      toISOFromMonthYear(dateStr) || uniqueUnknownDate(groups.length + 1);
    groups.push({ dateKey, owners: dedupeOwners(owners), invalids });
  }
  return groups;
}

function toISOFromMonthYear(mmyyyy) {
  const m = (mmyyyy || "").match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const yyyy = m[2];
  return `${yyyy}-${mm}-01`;
}
function uniqueUnknownDate(idx) {
  return `unknown_date_${idx}`;
}

// Build owners_by_date with chronological keys ending with 'current'
function buildOwnersByDate(currentOwners, historicalGroups) {
  const map = {};
  const sortable = historicalGroups
    .map((g) => ({
      key: g.dateKey,
      owners: g.owners,
      invalids: g.invalids || [],
      sortKey: /^\d{4}-\d{2}-\d{2}$/.test(g.dateKey)
        ? g.dateKey
        : `9999-99-99-${g.dateKey}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  for (const g of sortable) {
    if (g.owners && g.owners.length > 0) {
      map[g.key] = g.owners;
    }
  }
  map["current"] = currentOwners;
  return map;
}

// Main extraction
const propertyId = extractPropertyId($);
const { owners: currentOwners, invalids: invalidCurrent } =
  extractCurrentOwners($);
const histGroups = extractHistoricalOwners($);

let invalid_owners = [];
invalid_owners = invalid_owners.concat(invalidCurrent);
for (const g of histGroups)
  invalid_owners = invalid_owners.concat(g.invalids || []);
const seenInv = new Set();
invalid_owners = invalid_owners.filter((iv) => {
  const key = `${norm(iv.raw).toLowerCase()}|${norm(iv.reason).toLowerCase()}`;
  if (seenInv.has(key)) return false;
  seenInv.add(key);
  return norm(iv.raw).length > 0;
});

const owners_by_date = buildOwnersByDate(currentOwners, histGroups);

const output = {};
output[`property_${propertyId || "unknown_id"}`] = {
  owners_by_date,
  invalid_owners,
};

const outDir = path.resolve("owners");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log(JSON.stringify(output, null, 2));
