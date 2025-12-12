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

function parseAccountNumber($) {
  const heading = $('h1')
    .filter((_, el) => /property record information for/i.test($(el).text()))
    .first();
  if (!heading.length) {
    return null;
  }
  const text = cleanText(heading.text());
  const match = text.match(/for\s+([A-Za-z0-9-]+)/i);
  return match ? match[1] : null;
}

function parseOwnerInformation($) {
  const defaultOwner = {
    name: null,
    addressLines: [],
    formattedAddress: null,
    footnote: null,
  };

  const heading = findHeadingByText($, 'Owner:');
  if (!heading.length) {
    return defaultOwner;
  }

  const container = heading.closest('.w3-cell');
  const addressBlock = container.find('.w3-border').first();
  const lines = extractLines(addressBlock);
  const footnote = cleanText(container.find('.prcfootnote').first().text());

  return {
    name: lines[0] || null,
    addressLines: lines.slice(1),
    formattedAddress: lines.length ? lines.join(', ') : null,
    footnote: footnote || null,
  };
}

function findHeadingByText($, headingText) {
  if (!headingText) {
    return $();
  }
  const target = headingText.trim().toLowerCase();
  return $('h2')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === target)
    .first();
}

function extractLines(element) {
  if (!element || !element.length) {
    return [];
  }

  const clone = element.clone();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function cleanText(text) {
  if (!text) {
    return '';
  }
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

// Collect candidate owner name containers around labels like "Owner"
function extractOwnerTextBlocks($) {
  const ownerInfromation = parseOwnerInformation($);
  return ownerInfromation.name
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
const propertyId = parseAccountNumber($);
const ownerName = extractOwnerTextBlocks($);
let rawNames = [];
rawNames.push(...splitNamesFromHtml(ownerName));

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
