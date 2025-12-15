const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Utility: text normalization helpers
const cleanText = (t) =>
  (t || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
const titleCase = (s) =>
  s.replace(
    /\w\S*/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );

// Extract property ID with preference: Prop ID -> Property ID -> Parcel ID -> unknown
function extractPropertyId($) {
  let id = null;
  const candidates = [];
  $("th").each((i, el) => {
    const label = cleanText($(el).text()).toLowerCase();
    const value = cleanText($(el).next("td").text());
    if (!value) return;
    if (/(^|\b)prop\s*id(\b|:)/i.test(label) || label === "prop id") {
      candidates.push({ key: "prop_id", value });
    } else if (/(^|\b)property\s*id(\b|:)/i.test(label)) {
      candidates.push({ key: "property_id", value });
    } else if (/(^|\b)parcel\s*id(\b|:)/i.test(label)) {
      candidates.push({ key: "parcel_id", value });
    }
  });
  const pref = ["prop_id", "property_id", "parcel_id"];
  for (const p of pref) {
    const found = candidates.find((c) => c.key === p);
    if (found) {
      id = found.value;
      break;
    }
  }
  if (!id) {
    // Fallback: try to parse from page title like "Report: 00017-010-008"
    const title = cleanText($("title").text());
    const m = title.match(/Report:\s*([A-Za-z0-9\-_.]+)/i);
    if (m) id = m[1];
  }
  return id ? cleanText(id) : "unknown_id";
}

// Owner classification heuristics
const COMPANY_KEYWORDS =
  /(\b|\s)(inc\.?|l\.l\.c\.|llc|ltd\.?|foundation|alliance|solutions|corp\.?|co\.?|services|trust\b|trustee\b|trustees\b|tr\b|associates|partners|partnership|investment|investments|lp\b|llp\b|bank\b|n\.a\.|na\b|pllc\b|company|enterprises|properties|holdings|estate)(\b|\s)/i;
const SUFFIXES_IGNORE =
  /^(jr|sr|ii|iii|iv|v|vi|vii|viii|ix|x|md|phd|esq|esquire)$/i;

function normalizeOwnerKey(owner) {
  if (!owner) return null;
  if (owner.type === "company") {
    return cleanText(owner.name).toLowerCase();
  } else if (owner.type === "person") {
    const f = (owner.first_name || "").toLowerCase();
    const m = (owner.middle_name || "").toLowerCase();
    const l = (owner.last_name || "").toLowerCase();
    return [f, m, l].filter(Boolean).join(" ").trim();
  }
  return null;
}

function isCompanyName(txt) {
  return COMPANY_KEYWORDS.test(txt);
}

function tokenizeNamePart(part) {
  return cleanText(part)
    .replace(/^\*+/, "")
    .replace(/[^A-Za-z&'\-\s\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isInitials(token) {
  // Detect if a token looks like initials (e.g., "M.A.", "J.R.", "MA", "J")
  if (!token) return false;
  const cleaned = token.replace(/\./g, "").trim();
  // Initials are typically 1-3 uppercase letters
  return /^[A-Z]{1,3}$/.test(cleaned) && cleaned.length <= 3;
}

function normalizeNameForPattern(name) {
  // Ensure name matches pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  // If name contains initials with periods, try to format properly
  if (!name) return null;

  // If it's pure initials (like "M.A."), we can't use it as first_name
  if (isInitials(name)) {
    return null;
  }

  // Otherwise, return title-cased version
  return titleCase(name);
}

function buildPersonFromTokens(tokens, fallbackLastName) {
  // Assume format is LAST FIRST [MIDDLE]
  if (!tokens || tokens.length === 0) return null;
  if (tokens.length === 1) {
    // Only one token: cannot confidently classify
    return null;
  }
  let last = tokens[0];
  let first = tokens[1] || null;
  let middle = tokens.length > 2 ? tokens.slice(2).join(" ") : null;

  // If part likely lacks last name (e.g., 'CONSTANCE E'), and a fallback last is provided
  if (
    fallbackLastName &&
    tokens.length <= 2 &&
    tokens[0] &&
    tokens[0] === tokens[0].toUpperCase() &&
    tokens[1]
  ) {
    // Interpret as FIRST [MIDDLE] with fallback last name
    first = tokens[0];
    middle = tokens[1] || null;
    last = fallbackLastName;
  }

  // Clean ignored suffixes
  if (middle) {
    const mids = middle.split(" ").filter((t) => !SUFFIXES_IGNORE.test(t));
    middle = mids.join(" ") || null;
  }

  // If first name is initials, try to handle it
  if (first && isInitials(first)) {
    // If we have middle name, try shifting
    if (middle) {
      const middleParts = middle.split(" ").filter(Boolean);
      if (middleParts.length > 0 && !isInitials(middleParts[0])) {
        // Move middle to first, move first to middle
        const newFirst = middleParts[0];
        const newMiddle = [first, ...middleParts.slice(1)].join(" ").trim() || null;
        first = newFirst;
        middle = newMiddle;
      } else {
        // All names are initials or problematic, skip this person
        return null;
      }
    } else {
      // Only have last and first (initials), cannot create valid person
      return null;
    }
  }

  // Normalize names to match pattern
  const normalizedFirst = normalizeNameForPattern(first);
  const normalizedLast = normalizeNameForPattern(last);

  if (!normalizedFirst || !normalizedLast) {
    // Cannot create person without valid first and last name
    return null;
  }

  return {
    type: "person",
    first_name: normalizedFirst,
    last_name: normalizedLast,
    middle_name: middle ? titleCase(middle) : null,
  };
}

function splitMultiplePersonsWithSharedLast(tokens) {
  // tokens format: [LAST, FIRST1, (MIDDLE1?), FIRST2, (MIDDLE2?), ...]
  const owners = [];
  if (!tokens || tokens.length < 4) return owners;
  const lastTok = tokens[0];
  const rem = tokens.slice(1);
  for (let i = 0; i < rem.length; ) {
    const first = rem[i];
    const possibleMiddle = rem[i + 1] || null;
    // If there are at least 2 remaining tokens, create [LAST, FIRST, MIDDLE]
    if (possibleMiddle) {
      const p = buildPersonFromTokens([lastTok, first, possibleMiddle], null);
      if (p) owners.push(p);
      i += 2;
    } else {
      // Only one token left => [LAST, FIRST]
      const p = buildPersonFromTokens([lastTok, first], null);
      if (p) owners.push(p);
      i += 1;
    }
  }
  return owners;
}

function parseOwnersFromText(rawText) {
  const invalids = [];
  const owners = [];
  if (!rawText) return { owners, invalids };
  let text = cleanText(rawText)
    .replace(/^\*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Split into segments by commas first, then by ampersands/AND
  const commaSegments = text.split(/\s*,\s*/).filter(Boolean);
  let lastSurname = null;

  const pushOwnerOrInvalid = (segment) => {
    const seg = cleanText(segment).replace(/^\*/, "").trim();
    if (!seg) return;

    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: titleCase(seg) });
      return;
    }

    // Split by '&' or ' AND '
    const andParts = seg.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
    let localLastSurname = null;

    andParts.forEach((part, idx) => {
      const tokens = tokenizeNamePart(part);
      if (!tokens.length) return;

      // If there is only one part (no &), and many tokens, try split into multiple persons
      if (andParts.length === 1 && tokens.length >= 4) {
        const multi = splitMultiplePersonsWithSharedLast(tokens);
        if (multi.length >= 2) {
          multi.forEach((p) => owners.push(p));
          lastSurname = tokens[0].toUpperCase();
          return; // handled this part
        }
      }

      // Infer surname propagation: If first part likely contains surname at first token
      if (idx === 0) {
        localLastSurname = tokens[0];
      }

      let person = buildPersonFromTokens(
        tokens,
        idx > 0 ? localLastSurname || lastSurname : null,
      );

      // If still ambiguous and many tokens (suggest two people mashed together), attempt heuristic split
      if (!person && tokens.length >= 4) {
        const lastTok = tokens[0];
        const first1 = tokens[1];
        const mid1 = tokens[2];
        const rem = tokens.slice(3);
        const p1 = buildPersonFromTokens([lastTok, first1, mid1], null);
        const p2 = buildPersonFromTokens(rem, lastTok);
        if (p1 && p2) {
          owners.push(p1);
          owners.push(p2);
          if (lastTok) lastSurname = lastTok.toUpperCase();
          return;
        }
      }

      if (person) {
        owners.push(person);
        if (person.last_name) {
          lastSurname = person.last_name.toUpperCase();
        }
      } else {
        invalids.push({
          raw: part,
          reason: "ambiguous_or_incomplete_person_name",
        });
      }
    });
  };

  commaSegments.forEach((seg) => pushOwnerOrInvalid(seg));

  // Deduplicate by normalized key
  const seen = new Set();
  const deduped = [];
  owners.forEach((o) => {
    const key = normalizeOwnerKey(o);
    if (!key || seen.has(key)) return;
    seen.add(key);
    // Nullify empty middle_name
    if (o.type === "person" && (!o.middle_name || !o.middle_name.trim())) {
      o.middle_name = null;
    }
    deduped.push(o);
  });

  return { owners: deduped, invalids };
}

function findOwnerSection($) {
  let target = null;
  $("section").each((i, el) => {
    const title = cleanText(
      $(el).find("div.title").first().text(),
    ).toLowerCase();
    if (!title) return;
    if (title.includes("owner")) {
      target = $(el);
      return false;
    }
  });
  return target;
}

function extractCurrentOwners($) {
  const sec = findOwnerSection($);
  const namePieces = [];
  if (sec && sec.length) {
    sec.find("span[id*='sprDeedName']").each((i, el) => {
      const txt = cleanText($(el).text());
      if (txt) namePieces.push(txt);
    });

    if (!namePieces.length) {
      sec
        .find("a, span")
        .each((i, el) => {
          const id = (el.attribs && el.attribs.id) || "";
          const t = cleanText($(el).text());
          if (!t) return;
          const lowered = id.toLowerCase();
          if (lowered.includes("address")) return;
          if (/\d{3,}/.test(t)) return;
          if (/[a-z]/i.test(t) && t.length >= 3) {
            namePieces.push(t);
          }
        });
    }
  }
  const uniquePieces = [];
  const seenPieces = new Set();
  namePieces.forEach((piece) => {
    const key = piece.toLowerCase();
    if (!seenPieces.has(key)) {
      seenPieces.add(key);
      uniquePieces.push(piece);
    }
  });

  const aggregate = { owners: [], invalids: [] };
  uniquePieces.forEach((piece) => {
    const parsed = parseOwnersFromText(piece);
    if (parsed.owners && parsed.owners.length) {
      aggregate.owners.push(...parsed.owners);
    }
    if (parsed.invalids && parsed.invalids.length) {
      aggregate.invalids.push(...parsed.invalids);
    }
  });

  if (!aggregate.owners.length && uniquePieces.length) {
    const fallback = parseOwnersFromText(uniquePieces.join(" & "));
    aggregate.owners = fallback.owners;
    aggregate.invalids = fallback.invalids;
  }

  return aggregate;
}

function extractSalesHistory($) {
  const results = [];
  // Locate Sales section table rows
  let salesSection = null;
  $("section").each((i, el) => {
    const title = cleanText(
      $(el).find("div.title").first().text(),
    ).toLowerCase();
    if (/^sales$/.test(title)) {
      salesSection = $(el);
      return false;
    }
  });
  if (!salesSection) return results;
  salesSection.find("table tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const headerCell = $tr.find("th").first();
    let dateText = cleanText(headerCell.text());
    if (!dateText) {
      dateText = cleanText($tr.find("td").first().text());
    }
    let normDate = null;
    const mdym = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdym) {
      const mm = mdym[1].padStart(2, "0");
      const dd = mdym[2].padStart(2, "0");
      const yyyy = mdym[3];
      normDate = `${yyyy}-${mm}-${dd}`;
    }
    // Grantee cell contains span id *sprGrantee*
    let granteeText = "";
    const granteeSpan = $tr.find('span[id*="sprGrantee"]');
    if (granteeSpan.length) {
      const html = granteeSpan.html() || "";
      if (/<br\s*\/?>/i.test(html)) {
        granteeText = html
          .split(/<br\s*\/?>/i)
          .map((piece) => cleanText(piece))
          .filter(Boolean)
          .join(" & ");
      } else {
        granteeText = cleanText(granteeSpan.text());
      }
    } else {
      // fallback by 9th column (index 8)
      const tds = $tr.find("td");
      if (tds.length >= 9) granteeText = cleanText($(tds.get(8)).text());
    }
    if (normDate && granteeText) {
      const parsed = parseOwnersFromText(granteeText);
      results.push({
        date: normDate,
        owners: parsed.owners,
        invalids: parsed.invalids,
      });
    }
  });
  return results;
}

// Build owners_by_date map
const propertyId = extractPropertyId($) || "unknown_id";
const currentParsed = extractCurrentOwners($);
const salesHistory = extractSalesHistory($);

// Aggregate invalid owners
const invalid_owners = [];
currentParsed.invalids.forEach((inv) => invalid_owners.push(inv));
salesHistory.forEach((h) =>
  h.invalids.forEach((inv) => invalid_owners.push(inv)),
);

// Build ordered dates (ascending)
const dateMap = new Map();
salesHistory.forEach(({ date, owners }) => {
  if (!date) return;
  // Dedup within date
  const seen = new Set();
  const dedup = [];
  owners.forEach((o) => {
    const k = normalizeOwnerKey(o);
    if (!k || seen.has(k)) return;
    seen.add(k);
    dedup.push(o);
  });
  dateMap.set(date, dedup);
});

// Sort dates
const sortedDates = Array.from(dateMap.keys()).sort((a, b) =>
  a.localeCompare(b),
);

const owners_by_date = {};
sortedDates.forEach((d) => {
  owners_by_date[d] = dateMap.get(d);
});

// Current owners
const currentOwnersDedup = [];
(() => {
  const seen = new Set();
  currentParsed.owners.forEach((o) => {
    const k = normalizeOwnerKey(o);
    if (!k || seen.has(k)) return;
    seen.add(k);
    currentOwnersDedup.push(o);
  });
})();
owners_by_date["current"] = currentOwnersDedup;

const output = {};
output[`property_${propertyId}`] = {
  owners_by_date,
  invalid_owners,
};

// Ensure output directory and write file
fs.mkdirSync(path.dirname("owners/owner_data.json"), { recursive: true });
fs.writeFileSync(
  "owners/owner_data.json",
  JSON.stringify(output, null, 2),
  "utf8",
);

// Print to stdout
console.log(JSON.stringify(output, null, 2));
