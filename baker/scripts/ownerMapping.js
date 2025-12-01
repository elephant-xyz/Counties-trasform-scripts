const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.resolve("input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility: normalize name for deduplication
function normalizeName(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\.,]+$/g, "")
    .trim()
    .toLowerCase();
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

// Extract property ID using multiple heuristics
function extractPropertyId($) {
  // 1) Specific structure: span.colorparcel within an element that contains "Parcel ID"
  let id = null;
  $("*").each((_, el) => {
    const t = $(el).text().trim();
    if (!id && /parcel\s*id\s*:?/i.test(t)) {
      const span = $(el).find(".colorparcel").first();
      if (span.length) {
        id = span.text().trim();
      } else {
        // Attempt to parse ID from text following label
        const m = t.match(/parcel\s*id\s*:?\s*(.+)$/i);
        if (m) id = m[1].trim();
      }
    }
  });

  // 2) Fallback: any element with class parcel_num or id detailsnum
  if (!id) {
    const el = $(".parcel_num, #detailsnum").first();
    if (el.length) {
      const t = el.text();
      const m = t.match(/parcel\s*id\s*:?\s*([\w\-]+)/i);
      if (m) id = m[1].trim();
    }
  }

  // 3) Fallback: Find something that looks like a long alphanumeric ID in links with query param parcel=...
  if (!id) {
    $('a[href*="parcel="]').each((_, a) => {
      if (id) return;
      const href = $(a).attr("href") || "";
      const m = href.match(/parcel=([A-Za-z0-9\-]+)/);
      if (m) id = m[1];
    });
  }

  return id || "unknown_id";
}

// Collect candidate owner name containers around labels like "Owner"
function extractOwnerTextBlocks($) {
  const texts = [];

  // Heuristic 1: Find label elements containing the word Owner and capture sibling/nearby content
  $('*:contains("Owner")').each((_, el) => {
    const text = $(el).text().trim();
    if (!/owner/i.test(text)) return;

    // Skip menu/footer occurrences by preferring label-like small spans
    const isLabelish = $(el).hasClass("subhead") || /owner\s*:?/i.test(text);
    if (!isLabelish) return;

    const container = $(el)
      .closest(".mailingadd, .cell, .row, .col, #ownerinfo")
      .first();
    if (container.length) {
      // Look for a sibling/descendant with names
      let target = container.find(".namespan, .mailwrapper").first();
      if (!target.length) {
        // Try next siblings
        target = container.nextAll(".mailwrapper, .namespan").first();
      }
      if (target.length) {
        const html = target.html() || "";
        if (html) texts.push(html);
      }
    }
  });

  // Heuristic 2: Specific known structure
  if (texts.length === 0) {
    const h = $("#ownerinfo .namespan").first().html();
    if (h) texts.push(h);
  }

  return texts;
}

// Split a names HTML block into raw name strings
function splitNamesFromHtml(html) {
  // Replace <br> with newlines, strip tags
  let tmp = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  // Split into lines; also split by semicolons
  let parts = tmp
    .split(/\n|;+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // Some lines may contain slashes or pipes
  let expanded = [];
  parts.forEach((p) => {
    const subs = p
      .split(/\s*\|\s*|\s*\/\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    expanded.push(...subs);
  });
  return expanded;
}

// Classification helpers
function isCompanyName(name) {
  const n = name.trim();
  const re =
    /\b(inc|l\.l\.c\.?|llc|ltd|limited|foundation|alliance|solutions?|corp(?:oration)?|co\.?\b|services?|service\b|trust\b|tr\b|holding(?:s)?\b|partner(?:s|ship)?\b|associates?\b|lp\b|pllc\b|pc\b|bank\b|n\.?a\.?\b|credit\s*union\b|association\b|church\b|minist(?:ry|ries)\b|university\b|college\b|hospital\b|group\b|industries\b|properties\b|enterprises\b|management\b|realty\b|investment(?:s)?\b)/i;
  return re.test(n);
}

function cleanOwnerRaw(name) {
  return (
    name
      // Remove explicit care-of prefixes only when clearly marked (e.g., "c/o" or "c.o.")
      .replace(/^(?:c\s*\/\s*o\.?|c\.\s*o\.|care\s*of)\s*/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[\u00A0]/g, " ")
      .trim()
  );
}

function splitAmpersandNames(name) {
  // Split on & or ' and '
  const parts = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return null;

  // If last segment contains a surname, use it for preceding first names
  const lastSeg = parts[parts.length - 1];
  const tokens = lastSeg.split(/\s+/);
  let lastName = tokens.slice(-1).join(" ");
  // Handle comma style in last segment
  if (lastSeg.includes(",")) {
    // "Last, First Middle" style
    const [last, rest] = lastSeg.split(",").map((s) => s.trim());
    if (last) lastName = last;
  }

  const individuals = [];
  parts.forEach((seg, idx) => {
    if (seg.includes(",")) {
      // Already "Last, First" style; parse directly
      const [last, rest] = seg.split(",").map((s) => s.trim());
      const nameTokens = (rest || "").split(/\s+/).filter(Boolean);
      if (nameTokens.length >= 1) {
        const first = nameTokens[0];
        const middle = nameTokens.slice(1).join(" ") || null;
        if (cleanInvalidCharsFromName(first) && cleanInvalidCharsFromName(last)) {
          individuals.push({
            type: "person",
            first_name: cleanInvalidCharsFromName(first),
            last_name: cleanInvalidCharsFromName(last),
            middle_name: cleanInvalidCharsFromName(middle) || null,
          });
        }
      }
    } else {
      const toks = seg.split(/\s+/).filter(Boolean);
      if (toks.length === 1 && idx < parts.length - 1) {
        // Likely just a first name, use shared last name
        if (cleanInvalidCharsFromName(toks[0]) && cleanInvalidCharsFromName(lastName)) {
          individuals.push({
            type: "person",
            first_name: cleanInvalidCharsFromName(toks[0]),
            last_name: cleanInvalidCharsFromName(lastName),
            middle_name: null,
          });
        }
      } else if (toks.length >= 2) {
        const first = toks[0];
        const last = toks.slice(1).join(" ");
        if (cleanInvalidCharsFromName(first) && cleanInvalidCharsFromName(last)) {
          individuals.push({
            type: "person",
            first_name: cleanInvalidCharsFromName(first),
            last_name: cleanInvalidCharsFromName(last),
            middle_name: null,
          });
        }
      }
    }
  });
  return individuals;
}

function parsePersonName(raw) {
  let name = raw.trim();

  // Remove honorifics/suffixes common
  name = name
    .replace(
      /\b(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?|Rev\.?|Hon\.?|Sr\.?|Jr\.?|II|III|IV)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  // Handle comma style: Last, First Middle
  if (/,/.test(name)) {
    const [last, rest] = name.split(",").map((s) => s.trim());
    const toks = (rest || "").split(/\s+/).filter(Boolean);
    if (last && toks.length >= 1) {
      const first = toks[0];
      const middle = toks.slice(1).join(" ") || null;
      
      if (cleanInvalidCharsFromName(first) && cleanInvalidCharsFromName(last)) {
        return {
          type: "person",
          first_name: cleanInvalidCharsFromName(first),
          last_name: cleanInvalidCharsFromName(last),
          middle_name: cleanInvalidCharsFromName(middle) || null,
        };
      }
    }
  }

  // Standard First Middle Last
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const first = tokens[0];
    const last = tokens.slice(1).join(" ");
    // Try to detect middle name when there are 3+ tokens
    let middle = null;
    if (tokens.length >= 3) {
      middle = tokens.slice(1, -1).join(" ");
      // Reassign last as last token only
      
      if (cleanInvalidCharsFromName(tokens[0]) && cleanInvalidCharsFromName(tokens[tokens.length - 1])) {
        return {
          type: "person",
          first_name: cleanInvalidCharsFromName(tokens[0]),
          last_name: cleanInvalidCharsFromName(tokens[tokens.length - 1]),
          middle_name: cleanInvalidCharsFromName(middle) || null,
        };
      }
    }
    if (cleanInvalidCharsFromName(first) && cleanInvalidCharsFromName(last)) {
      return {
        type: "person",
        first_name: cleanInvalidCharsFromName(first),
        last_name: cleanInvalidCharsFromName(last),
        middle_name: null,
      };
    }
  }
  return null;
}

function classifyOwnersFromRaw(rawNames) {
  const valid = [];
  const invalid = [];

  rawNames.forEach((raw0) => {
    let raw = cleanOwnerRaw(raw0);
    if (!raw) return;

    // Ignore lines that look like addresses or pure numbers
    if (
      /\d{2,}/.test(raw) &&
      /\b(st|ave|rd|dr|blvd|ln|ct|hwy|suite|floor|fl)\b/i.test(raw)
    )
      return;

    // Company check
    if (isCompanyName(raw)) {
      valid.push({ type: "company", name: raw });
      return;
    }

    // Handle ampersand or 'and' combined names
    if (/[&]|\band\b/i.test(raw)) {
      const people = splitAmpersandNames(raw);
      if (people && people.length) {
        valid.push(...people);
        return;
      }
    }

    // Try person parsing
    const person = parsePersonName(raw);
    if (person) {
      valid.push(person);
    } else {
      invalid.push({
        raw: raw0,
        reason: "Unclassifiable or insufficient tokens",
      });
    }
  });

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  valid.forEach((v) => {
    let key;
    if (v.type === "company") {
      key = "company:" + normalizeName(v.name);
    } else {
      key =
        "person:" +
        normalizeName(`${v.first_name} ${v.middle_name || ""} ${v.last_name}`);
    }
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(v);
  });

  // Remove empty names
  const filtered = deduped.filter((v) => {
    if (v.type === "company") return !!v.name && v.name.trim().length > 0;
    return !!v.first_name && !!v.last_name;
  });

  return { valid: filtered, invalid };
}

// Extract potential date strings near historical sections (heuristic; may be unused if none)
function extractHistoricalDateGroups($) {
  const groups = [];
  $("table").each((_, table) => {
    const headers = $(table).find("tr").first().text().toLowerCase();
    if (/date\s*of\s*sale/.test(headers) || /sale\s*date/.test(headers)) {
      $(table)
        .find("tr")
        .slice(1)
        .each((__, tr) => {
          const tds = $(tr).find("td");
          if (tds.length) {
            const dateText = $(tds).eq(1).text().trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
              groups.push({ date: dateText, contextEl: tr });
            }
          }
        });
    }
  });
  return groups;
}

// Main extraction
const propertyId = extractPropertyId($);
const ownerBlocks = extractOwnerTextBlocks($);
let rawNames = [];
ownerBlocks.forEach((html) => {
  rawNames.push(...splitNamesFromHtml(html));
});
// If nothing captured, try a generic fallback from visible text near #ownerinfo
if (rawNames.length === 0) {
  const t = $("#ownerinfo").text();
  if (t) {
    // Attempt to isolate between 'Owner' and next label
    const m = t.match(
      /owner\s*:?(.*?)(mailing address|site address|property use|taxing district|land size|exemptions|map number|brief legal description)/i,
    );
    if (m) {
      const names = m[1]
        .split(/\n|;|\|/)
        .map((s) => s.trim())
        .filter(Boolean);
      rawNames.push(...names);
    }
  }
}

const { valid: validOwners, invalid: invalidOwners } =
  classifyOwnersFromRaw(rawNames);

// Group owners by date - current only by default
const ownersByDate = {};
ownersByDate["current"] = validOwners;

// Attempt to detect historical dates and associate owners near them (heuristic)
// Since owners are not listed in the provided HTML for those dates, we won't attach owners to historical dates.

const output = {};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

const jsonStr = JSON.stringify(output, null, 2);

// Ensure output directory and write file
const outDir = path.resolve("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, jsonStr, "utf8");

// Print JSON to stdout
console.log(jsonStr);
