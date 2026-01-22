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

const SUMMARY_SELECTOR =
  "#ctlBodyPane_ctl02_ctl01_dynamicSummaryData_divSummary";

function findModuleByTitle($, titles) {
  const list = Array.isArray(titles) ? titles : [titles];
  const normalizedTargets = list
    .map((t) => (t ? String(t).toLowerCase().trim() : ""))
    .filter(Boolean);
  if (!normalizedTargets.length) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = cleanText(
      $section.find("> header .title, > header div.title").first().text(),
    ).toLowerCase();
    if (!headerTitle) return;
    if (
      normalizedTargets.some(
        (target) =>
          headerTitle === target ||
          headerTitle.includes(target) ||
          target.includes(headerTitle),
      )
    ) {
      found = $section;
    }
  });
  return found;
}

function extractCellText($cell) {
  if (!$cell || !$cell.length) return "";
  const clone = $cell.clone();
  clone.find("script, style").remove();
  clone.find("span").each((_, span) => {
    const txt = cleanText($(span).text());
    if (/^\d+%$/.test(txt)) {
      $(span).remove();
    }
  });
  clone.find("br").replaceWith(" | ");
  const raw = clone.text().replace(/\s+/g, " ").trim();
  if (!raw) return "";
  return cleanText(raw.replace(/\s*\|\s*/g, " & "));
}

// Extract property ID with preference: Prop ID -> Property ID -> Parcel ID -> Account -> fallback
function extractPropertyId($) {
  const prioritizedKeys = ["propid", "propertyid", "parcelid", "account"];
  const summaryRows = $(`${SUMMARY_SELECTOR} table tr`);
  const normalizeKey = (label) =>
    cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "");

  if (summaryRows.length) {
    const summaryMap = new Map();
    summaryRows.each((_, tr) => {
      const $tr = $(tr);
      const key = normalizeKey($tr.find("th").first().text());
      if (!key) return;
      const value = cleanText($tr.find("td").first().text());
      if (!value) return;
      summaryMap.set(key, value);
    });
    for (const key of prioritizedKeys) {
      if (summaryMap.has(key)) {
        return cleanText(summaryMap.get(key));
      }
    }
  }

  let fallback = null;
  $("table").each((_, table) => {
    if (fallback) return false;
    $(table)
      .find("tr")
      .each((__, tr) => {
        if (fallback) return false;
        const $tr = $(tr);
        const key = normalizeKey($tr.find("th").first().text());
        if (!key) return;
        const value = cleanText($tr.find("td").first().text());
        if (!value) return;
        if (prioritizedKeys.some((k) => key.includes(k))) {
          fallback = value;
          return false;
        }
        return undefined;
      });
  });
  if (fallback) return cleanText(fallback);

  const title = cleanText($("title").text());
  const match = title.match(/Report:\s*([A-Za-z0-9\-_.]+)/i);
  if (match) return match[1];
  return "unknown_id";
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

  return {
    type: "person",
    first_name: titleCase(first || ""),
    last_name: titleCase(last || ""),
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
  return findModuleByTitle($, ["Owner", "Owners"]);
}

function extractCurrentOwners($) {
  const section = findOwnerSection($);
  if (!section || !section.length) return { owners: [], invalids: [] };

  const table = section.find("table").first();
  let ownerNameText = "";

  if (table.length) {
    table.find("tbody tr").each((_, tr) => {
      const $tr = $(tr);
      const label = cleanText($tr.find("th").first().text()).toLowerCase();
      if (!label) return;
      if (label.includes("owner") && label.includes("name")) {
        const cellText = extractCellText($tr.find("td").first())
          .replace(/\s*&\s*$/, "")
          .trim();
        if (cellText) {
          ownerNameText = ownerNameText
            ? `${ownerNameText} & ${cellText}`
            : cellText;
        }
      }
    });
  }

  let parsed = parseOwnersFromText(ownerNameText);

  if (!parsed.owners.length) {
    const legacyPieces = [];
    section
      .find("span[id*='sprDeedName']")
      .each((_, el) => {
        const txt = cleanText($(el).text());
        if (txt) legacyPieces.push(txt);
      });

    if (!legacyPieces.length) {
      section
        .find("a, span")
        .each((_, el) => {
          const id = (el.attribs && el.attribs.id) || "";
          const txt = cleanText($(el).text());
          if (!txt) return;
          const lowered = id.toLowerCase();
          if (lowered.includes("address")) return;
          if (/\d{3,}/.test(txt)) return;
          if (txt.length >= 3) {
            legacyPieces.push(txt);
          }
        });
    }

    if (legacyPieces.length) {
      const combined = legacyPieces.join(" & ");
      parsed = parseOwnersFromText(combined);
    }
  }

  return parsed;
}

function extractSalesHistory($) {
  const salesSection = findModuleByTitle($, [
    "Recent Sales",
    "Sales History",
    "Sales",
  ]);
  if (!salesSection || !salesSection.length) return [];

  let salesTable = null;
  salesSection.find("table").each((_, table) => {
    if (salesTable) return false;
    const $table = $(table);
    if (!$table.find("tbody tr").length) return;
    const headers = $table
      .find("thead tr")
      .first()
      .children("th, td")
      .map((__, cell) => cleanText($(cell).text()).toLowerCase())
      .get();
    if (!headers.length) return;
    const hasDate = headers.some((h) => h.includes("date"));
    const hasOwner = headers.some((h) =>
      ["grantee", "buyer", "owner", "purchaser"].some((kw) => h.includes(kw)),
    );
    if (hasDate && hasOwner) {
      salesTable = $table;
      return false;
    }
    return undefined;
  });

  if (!salesTable || !salesTable.length) return [];

  const headerCells = salesTable
    .find("thead tr")
    .first()
    .children("th, td")
    .map((_, cell) => cleanText($(cell).text()).toLowerCase())
    .get();
  const dateIndex = headerCells.findIndex((h) => h.includes("date"));
  const ownerIndex = headerCells.findIndex((h) =>
    ["grantee", "buyer", "owner", "purchaser"].some((kw) => h.includes(kw)),
  );

  const normalizeSaleDate = (text) => {
    const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return null;
    const month = match[1].padStart(2, "0");
    const day = match[2].padStart(2, "0");
    return `${match[3]}-${month}-${day}`;
  };

  const results = [];
  salesTable.find("tbody tr").each((_, tr) => {
    const $rowCells = $(tr).children("th, td");
    if (!$rowCells.length) return;

    const dateCellIdx = dateIndex >= 0 ? dateIndex : 0;
    const dateCell = $rowCells.eq(dateCellIdx);
    const normDate = normalizeSaleDate(cleanText(dateCell.text()));
    if (!normDate) return;

    let granteeText = "";
    const granteeSpan = $rowCells.find('span[id*="sprGrantee"]').first();
    if (granteeSpan.length) {
      granteeText = extractCellText(granteeSpan.parent());
    }
    if (!granteeText && ownerIndex >= 0 && ownerIndex < $rowCells.length) {
      granteeText = extractCellText($rowCells.eq(ownerIndex));
    }
    if (!granteeText && $rowCells.length >= 2) {
      granteeText = extractCellText($rowCells.eq(1));
    }
    if (!granteeText) return;

    const parsed = parseOwnersFromText(granteeText);
    results.push({
      date: normDate,
      owners: parsed.owners,
      invalids: parsed.invalids,
    });
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
