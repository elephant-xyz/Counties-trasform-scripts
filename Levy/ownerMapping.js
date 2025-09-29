const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Utility: trim and collapse spaces
const collapse = (s) => (s || "").replace(/\s+/g, " ").trim();

// Extract Property ID with multiple fallback heuristics
function extractPropertyId($) {
  let id = collapse($("#ctlBodyPane_ctl02_ctl01_lblParcelID").text());
  if (!id) {
    const title = collapse($("title").text());
    const m = title.match(/Report:\s*(\d{4,})/i);
    if (m) id = m[1];
  }
  if (!id) {
    // Look for a cell header containing Parcel ID
    $("th,td").each((i, el) => {
      const t = collapse($(el).text());
      if (!id && /parcel id/i.test(t)) {
        const val = collapse($(el).next("td").text());
        if (val) id = val;
      }
    });
  }
  if (!id) {
    // Try to read from any link param: Account or KeyValue
    const href =
      $('a[href*="Account="] , a[href*="KeyValue="]').first().attr("href") ||
      "";
    const m2 = href.match(/(?:Account|KeyValue)=(\d{4,})/i);
    if (m2) id = m2[1];
  }
  return id || "unknown_id";
}

const propertyId = extractPropertyId($);

// Company detection (case-insensitive, word boundaries where appropriate)
const companyRegex =
  /\b(inc|l\.l\.c\.|llc|ltd|foundation|alliance|solutions|corp|co|services|trust|tr|company|associates|partners|lp|llp|pllc|pc|bank|na)\b/i;
function isCompanyName(name) {
  const n = collapse(name).replace(/[,\.]/g, " ");
  return companyRegex.test(n);
}

// Normalize key for deduplication
function ownerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return collapse(owner.name).toLowerCase();
  const f = collapse(owner.first_name).toLowerCase();
  const m = owner.middle_name ? collapse(owner.middle_name).toLowerCase() : "";
  const l = collapse(owner.last_name).toLowerCase();
  return [l, f, m].join("|");
}

// Parse a single person segment into {type:'person', first_name, last_name, middle_name?}
function parsePersonSegment(raw, fallbackLastName) {
  const cleaned = collapse(raw).replace(/\s{2,}/g, " ");
  if (!cleaned) return { invalid: { raw: raw, reason: "empty name" } };

  // If comma format: Last, First Middle...
  if (/,/.test(cleaned)) {
    const parts = cleaned.split(",").map(collapse).filter(Boolean);
    const last = parts[0] || fallbackLastName || "";
    const rest = (parts[1] || "").split(" ").map(collapse).filter(Boolean);
    const first = rest[0] || "";
    const middle = rest.slice(1).join(" ") || null;
    if (!first || !last)
      return {
        invalid: { raw: raw, reason: "insufficient tokens (comma format)" },
      };
    return {
      owner: {
        type: "person",
        first_name: first,
        last_name: last,
        middle_name: middle,
      },
    };
  }

  // Space-separated tokens; default to typical property roll format: LAST FIRST [MIDDLE]
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    // Possibly only first name; attempt to use fallback last name
    if (fallbackLastName) {
      return {
        owner: {
          type: "person",
          first_name: tokens[0],
          last_name: fallbackLastName,
          middle_name: null,
        },
      };
    }
    return {
      invalid: { raw: raw, reason: "single token without last name context" },
    };
  }

  if (fallbackLastName && tokens.length <= 2) {
    // Heuristic: When following an explicit LAST FIRST entry, a short segment is FIRST [MIDDLE] with implied last
    const first = tokens[0];
    const middle = tokens[1] ? tokens[1] : null;
    return {
      owner: {
        type: "person",
        first_name: first,
        last_name: fallbackLastName,
        middle_name: middle,
      },
    };
  }

  const last = tokens[0];
  const first = tokens[1] || "";
  const middle = tokens.slice(2).join(" ") || null;
  if (!first || !last)
    return { invalid: { raw: raw, reason: "insufficient tokens" } };
  return {
    owner: {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
    },
  };
}

// Split a possibly multi-owner string (couples with &). Returns {owners:[], invalid:[]}
function parseOwnerString(raw) {
  const invalid = [];
  const owners = [];
  let s = collapse(raw)
    .replace(/\s*&amp;\s*/gi, " & ")
    .replace(/\s+and\s+/gi, " & ")
    .replace(/\s{2,}/g, " ");
  if (!s) return { owners, invalid };

  // If it's a company, treat whole string as a single company owner
  if (isCompanyName(s)) {
    owners.push({ type: "company", name: s });
    return { owners, invalid };
  }

  let segments;
  if (s.includes("&")) segments = s.split("&").map(collapse).filter(Boolean);
  else segments = [s];

  let impliedLast = null;
  segments.forEach((seg, idx) => {
    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: seg });
      impliedLast = null;
      return;
    }
    const parsed = parsePersonSegment(seg, idx > 0 ? impliedLast : null);
    if (parsed.owner) {
      owners.push(parsed.owner);
      impliedLast = parsed.owner.last_name || impliedLast;
    } else if (parsed.invalid) {
      invalid.push(parsed.invalid);
    }
  });

  return { owners, invalid };
}

// Collect current owners from an Owner module if present
function extractCurrentOwners($) {
  const current = [];
  const invalid = [];

  // Strategy 1: Specific selector used on many Beacon/qPublic sites
  const spans = $(
    '#ctlBodyPane_ctl03_mSection span[id*="lblPrimaryOwnerName"]',
  );
  if (spans.length) {
    spans.each((i, el) => {
      const t = collapse($(el).text());
      const { owners, invalid: inv } = parseOwnerString(t);
      owners.forEach((o) => current.push(o));
      inv.forEach((x) => invalid.push(x));
    });
  } else {
    // Strategy 2: Find a header cell with Owner Name and read the adjacent cell content, split by <br>
    $("section .module-content table").each((i, tbl) => {
      $(tbl)
        .find("tr")
        .each((j, tr) => {
          const th = collapse($(tr).find("th").first().text());
          if (/^owner\s*name$/i.test(th)) {
            const html = $(tr).find("td").first().html() || "";
            const parts = html
              .replace(/<br\s*\/?>(?=.)/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .split(/\n/)
              .map((s) => collapse(s))
              .filter(Boolean);
            parts.forEach((p) => {
              const { owners, invalid: inv } = parseOwnerString(p);
              owners.forEach((o) => current.push(o));
              inv.forEach((x) => invalid.push(x));
            });
          }
        });
    });
  }

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  current.forEach((o) => {
    const k = ownerKey(o);
    if (k && !seen.has(k)) {
      seen.add(k);
      // Normalize empty middle_name to null only when present
      if (
        o.type === "person" &&
        (o.middle_name === "" || o.middle_name === undefined)
      )
        o.middle_name = null;
      deduped.push(o);
    }
  });

  return { owners: deduped, invalid };
}

// Extract historical owners by date using Sales table (use Grantee column)
function extractHistoricalOwnersByDate($) {
  const rows = $("#ctlBodyPane_ctl11_ctl01_grdSales tbody tr");
  const byDate = {};
  const invalid = [];

  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const saleDateText = collapse($(tds.get(0)).text());
    const granteeCell = $(tds.get(tds.length - 1));
    const granteeText = collapse(granteeCell.text());

    if (!saleDateText) return;
    const dateKey = toISODate(saleDateText) || null;
    if (!dateKey) return;

    if (!byDate[dateKey]) byDate[dateKey] = [];
    if (!granteeText) return; // skip empty grantee

    const { owners, invalid: inv } = parseOwnerString(granteeText);
    inv.forEach((x) => invalid.push(x));

    // Dedup within a date
    const seen = new Set(byDate[dateKey].map(ownerKey));
    owners.forEach((o) => {
      const k = ownerKey(o);
      if (k && !seen.has(k)) {
        seen.add(k);
        if (
          o.type === "person" &&
          (o.middle_name === "" || o.middle_name === undefined)
        )
          o.middle_name = null;
        byDate[dateKey].push(o);
      }
    });
  });

  return { byDate, invalid };
}

// Convert M/D/YYYY or MM/DD/YYYY to YYYY-MM-DD
function toISODate(s) {
  const str = collapse(s);
  if (!str) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Build final structure
const invalid_owners = [];

const { owners: currentOwners, invalid: invCurrent } = extractCurrentOwners($);
invalid_owners.push(...invCurrent);

const { byDate: historicalByDate, invalid: invHist } =
  extractHistoricalOwnersByDate($);
invalid_owners.push(...invHist);

// Sort historical dates chronologically and ensure arrays are deduped and cleaned
const sortedDateKeys = Object.keys(historicalByDate)
  .filter(Boolean)
  .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// Assemble owners_by_date map
const owners_by_date = {};
sortedDateKeys.forEach((k) => {
  // Dedupe again in case of cross-row duplicates on same date
  const seen = new Set();
  const arr = [];
  (historicalByDate[k] || []).forEach((o) => {
    const key = ownerKey(o);
    if (key && !seen.has(key)) {
      seen.add(key);
      arr.push(o);
    }
  });
  owners_by_date[k] = arr;
});

// Add current owners last
const seenCurrent = new Set();
const finalCurrent = [];
currentOwners.forEach((o) => {
  const k = ownerKey(o);
  if (k && !seenCurrent.has(k)) {
    seenCurrent.add(k);
    finalCurrent.push(o);
  }
});
owners_by_date["current"] = finalCurrent;

// Filter invalid_owners to exclude empties
const filteredInvalid = invalid_owners.filter((x) => collapse(x.raw));

const output = {};
output[`property_${propertyId}`] = {
  owners_by_date,
  invalid_owners: filteredInvalid,
};

// Ensure output directory then write file and print JSON
fs.mkdirSync(path.dirname("owners/owner_data.json"), { recursive: true });
fs.writeFileSync(
  "owners/owner_data.json",
  JSON.stringify(output, null, 2),
  "utf8",
);
console.log(JSON.stringify(output));
