const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

// Updated CSS Selectors
const PARCEL_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl01_mSection .sdw1-owners-container > div";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl14_ctl01_grdSales tbody tr";

// Utility helpers
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

function cleanRawName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const noisePatterns = [
    /\bET\s*AL\b/gi,
    /\bETAL\b/gi,
    /\bET\s*UX\b/gi,
    /\bET\s*VIR\b/gi,
    /\bET\s+UXOR\b/gi,
    /\bTRUSTEE[S]?\b/gi,
    /\bTTEE[S]?\b/gi,
    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bAKA\b/gi,
    /\bA\/K\/A\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\bAS\s+PER\b/gi,
    /\b%\s*INTEREST\b/gi,
    /\b\d{1,3}%\b/gi,
    /\b\d{1,3}%\s*INTEREST\b/gi,
  ];
  noisePatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  s = s.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(&|and)\s+/i, "")
    .replace(/\s+(&|and)$/i, "")
    .trim();
  // If a trailing bare number remains right after a company suffix, drop it
  const companySuffix =
    "(?:LLC|L\\.L\\.C|INC|CORP|CO|COMPANY|LTD|TRUST|LP|LLP|PLC|PLLC)";
  const trailingNumAfterCo = new RegExp(
    `^(.*?\\b${companySuffix}\\b)\\s+\\d{1,3}$`,
    "i",
  );
  const m = s.match(trailingNumAfterCo);
  if (m) {
    s = m[1].trim();
  }
  return s;
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

const PREFIX_TOKEN_MAP = new Map([
  ["MR", "Mr"],
  ["MRS", "Mrs"],
  ["MS", "Ms"],
  ["MISS", "Miss"],
  ["DR", "Dr"],
  ["REV", "Rev"],
  ["REVEREND", "Rev"],
  ["HON", "Hon"],
  ["HONORABLE", "Hon"],
  ["PROF", "Prof"],
  ["PROFESSOR", "Prof"],
  ["CAPT", "Capt"],
  ["CAPTAIN", "Capt"],
  ["LT", "Lt"],
  ["LTCOL", "Lt Col"],
  ["LT COL", "Lt Col"],
  ["LT.COL", "Lt Col"],
  ["COL", "Col"],
  ["PASTOR", "Pastor"],
]);

const SUFFIX_TOKEN_MAP = new Map([
  ["JR", "Jr."],
  ["JR.", "Jr."],
  ["SR", "Sr."],
  ["SR.", "Sr."],
  ["II", "II"],
  ["III", "III"],
  ["IV", "IV"],
  ["V", null],
  ["ESQ", "Esq."],
  ["ESQ.", "Esq."],
  ["ESQUIRE", "Esq."],
  ["MD", "MD"],
  ["M.D", "MD"],
  ["M.D.", "MD"],
  ["DDS", "DDS"],
  ["CPA", "CPA"],
  ["PH.D", "PhD"],
  ["PH.D.", "PhD"],
  ["PHD", "PhD"],
  ["JD", "JD"],
  ["J.D", "JD"],
  ["J.D.", "JD"],
  ["LLM", "LLM"],
  ["MBA", "MBA"],
  ["M.B.A", "MBA"],
  ["M.B.A.", "MBA"],
  ["RN", "RN"],
  ["R.N", "RN"],
  ["R.N.", "RN"],
  ["DVM", "DVM"],
  ["D.V.M", "DVM"],
  ["D.V.M.", "DVM"],
  ["CFA", "CFA"],
  ["PE", "PE"],
  ["P.E", "PE"],
  ["P.E.", "PE"],
  ["PMP", "PMP"],
  ["EMERITUS", "Emeritus"],
  ["RET", "Ret."],
  ["RET.", "Ret."],
  ["RETIRED", "Ret."],
]);

const LAST_NAME_PREFIXES = new Set([
  "MC",
  "MAC",
  "O",
  "ST",
  "ST.",
  "SAN",
  "SANTA",
  "DE",
  "DEL",
  "DELA",
  "DE LAS",
  "DELOS",
  "DE LOS",
  "DE LA",
  "DI",
  "DA",
  "DOS",
  "DU",
  "VAN",
  "VON",
  "LA",
  "LE",
  "EL",
  "LOS",
  "LAS",
]);

function normalizeTokenForLookup(token) {
  return (token || "").replace(/\./g, "").replace(/'/g, "").toUpperCase();
}

function titleCaseName(value) {
  if (!value) return value;
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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
  "trust",
  "tr",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "lp",
  "llp",
  "plc",
  "pllc",
  "bank",
  "church",
  "school",
  "university",
  "authority",
];


function isCompanyName(name) {
  const n = name.toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\.$)`, "i").test(n),
  );
}

function splitCompositeNames(name) {
  const cleaned = cleanRawName(name);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+|\s*\n+\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

function extractNamesFromCell($cell) {
  if (!$cell || $cell.length === 0) return [];
  const htmlContent = $cell.html();
  if (!htmlContent) {
    const textOnly = txt($cell.text());
    return textOnly ? [textOnly] : [];
  }
  return htmlContent
    .split(/<br\s*\/?>/i)
    .map((fragment) => {
      const wrapped = cheerio.load(`<div>${fragment}</div>`);
      return txt(wrapped.text());
    })
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function classifyOwner(raw) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned)) {
    return {
      valid: true,
      owner: { type: "company", name: cleaned },
    };
  }
  const originalTokens = cleaned.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  if (originalTokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  const tokens = [...originalTokens];
  let prefixName = null;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[0]);
    if (PREFIX_TOKEN_MAP.has(lookup)) {
      prefixName = PREFIX_TOKEN_MAP.get(lookup);
      tokens.shift();
    } else {
      break;
    }
  }

  let suffixName = null;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[tokens.length - 1]);
    if (SUFFIX_TOKEN_MAP.has(lookup)) {
      suffixName = SUFFIX_TOKEN_MAP.get(lookup);
      tokens.pop();
    } else {
      break;
    }
  }

  const sanitizedTokens = tokens
    .map((tok) => cleanInvalidCharsFromName(tok))
    .filter(Boolean);

  if (sanitizedTokens.length < 2) {
    return { valid: false, reason: "person_missing_first_or_last", raw: cleaned };
  }

  const assumeLastFirst =
    cleaned === cleaned.toUpperCase() ||
    /^[A-Z\s'.-]+$/.test(cleaned);

  const parseLastFirst = (tokensArr) => {
    if (tokensArr.length < 2) return null;
    const n = tokensArr.length;
    let firstIndex = n - 1;
    if (n > 2) {
      const lastTokenCandidate = tokensArr[n - 1];
      if (/^[A-Z]$/.test(lastTokenCandidate) || /^[A-Z]\.$/.test(lastTokenCandidate)) {
        firstIndex = n - 2;
      }
    }
    if (firstIndex <= 0) return null;
    const lastTokens = tokensArr.slice(0, firstIndex);
    const firstToken = tokensArr[firstIndex];
    const middleTokens = tokensArr.slice(firstIndex + 1);
    if (!lastTokens.length) return null;
    return {
      firstName: titleCaseName(firstToken),
      middleName: middleTokens.length ? titleCaseName(middleTokens.join(" ")) : null,
      lastName: titleCaseName(lastTokens.join(" ")),
    };
  };

  const parseFirstLast = (tokensArr) => {
    if (tokensArr.length < 2) return null;
    const tokensCopy = [...tokensArr];
    const lastTokens = [];
    lastTokens.unshift(tokensCopy.pop());
    while (tokensCopy.length > 0) {
      const prevKey = normalizeTokenForLookup(tokensCopy[tokensCopy.length - 1]);
      if (LAST_NAME_PREFIXES.has(prevKey)) {
        lastTokens.unshift(tokensCopy.pop());
      } else {
        break;
      }
    }
    const firstToken = tokensCopy.shift();
    const middleTokens = tokensCopy;
    if (!firstToken || !lastTokens.length) return null;
    return {
      firstName: titleCaseName(firstToken),
      middleName: middleTokens.length ? titleCaseName(middleTokens.join(" ")) : null,
      lastName: titleCaseName(lastTokens.join(" ")),
    };
  };

  let parsed =
    (assumeLastFirst && parseLastFirst(sanitizedTokens)) ||
    parseFirstLast(sanitizedTokens) ||
    parseLastFirst(sanitizedTokens);

  if (!parsed || !parsed.firstName || !parsed.lastName) {
    return { valid: false, reason: "person_missing_first_or_last", raw: cleaned };
  }

  const person = {
    type: "person",
    first_name: parsed.firstName,
    last_name: parsed.lastName,
    middle_name: parsed.middleName,
    prefix_name: prefixName ? titleCaseName(prefixName) : null,
    suffix_name: suffixName ? titleCaseName(suffixName) : null,
  };
  return { valid: true, owner: person };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let norm;
    if (o.type === "company") {
      norm = `company:${normalizeName(o.name)}`;
    } else {
      const prefix = o.prefix_name ? normalizeName(o.prefix_name) : "";
      const middle = o.middle_name ? normalizeName(o.middle_name) : "";
      const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
      norm = `person:${prefix}|${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`;
    }
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(o);
    }
  }
  return out;
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function extractCurrentOwners($) {
  const owners = [];
  $(CURRENT_OWNER_SELECTOR).each((i, el) => {
    // Get all direct text nodes and text from <a> tags within the owner container
    const ownerTextNodes = $(el).contents().filter(function() {
      return this.nodeType === 3 && txt($(this).text()); // Text nodes
    }).map(function() {
      return txt($(this).text());
    }).get();

    const ownerLinkTexts = $(el).find('a').map(function() {
      return txt($(this).text());
    }).get();

    const ownerSpanTexts = $(el).find('span').map(function() {
      return txt($(this).text());
    }).get();

    const allOwnerTexts = [...ownerTextNodes, ...ownerLinkTexts, ...ownerSpanTexts].filter(Boolean);

    // Combine and process the extracted text
    if (allOwnerTexts.length > 0) {
      // For this specific HTML, the owner name is often in the first <div> or <a> within the container
      // We'll take the first non-empty string that looks like a name
      for (const text of allOwnerTexts) {
        if (text && !text.toLowerCase().includes('primary owner') && !text.toLowerCase().includes('click to search by name')) {
          owners.push(text);
          break; // Assuming only one primary owner name per container
        }
      }
    }
  });
  return owners;
}


function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td"); // Changed from th to td for sale date
    const saleDateRaw = txt(tds.eq(0).text()); // Sale Date is the first td
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const granteeCell = $(tds.last());
    const granteeNames = extractNamesFromCell(granteeCell);
    if (granteeNames.length) {
      if (!map[dateStr]) map[dateStr] = [];
      granteeNames.forEach((name) => map[dateStr].push(name));
    }

    const grantorCell = $(tds.eq(tds.length - 2));
    const grantorNames = extractNamesFromCell(grantorCell);
    grantorNames.forEach((name) => priorOwners.push(name));
  });
  return { map, priorOwners };
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  for (const raw of rawStrings) {
    const parts = splitCompositeNames(raw);
    if (parts.length === 0) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      continue;
    }
    for (const part of parts) {
      const res = classifyOwner(part);
      if (res.valid) {
        owners.push(res.owner);
      } else {
        invalidCollector.push({
          raw: part,
          reason: res.reason || "invalid_owner",
        });
      }
    }
  }
  return dedupeOwners(owners);
}

function extractMailingAddress($) {
  const addresses = [];
  $(
    "#ctlBodyPane_ctl01_mSection span[id$='lblOwnerAddress']",
  ).each((_, el) => {
    const htmlContent = $(el).html() || "";
    const parts = htmlContent
      .split(/<br\s*\/?>/i)
      .map((fragment) => {
        const wrapped = cheerio.load(`<div>${fragment}</div>`);
        return txt(wrapped.text());
      })
      .map((segment) => segment.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const joined = parts.join(", ");
    if (joined) addresses.push(joined);
  });
  if (!addresses.length) return null;
  const unique = Array.from(
    new Set(addresses.map((addr) => addr.replace(/\s+/g, " ").trim())),
  );
  return unique[0] || null;
}

const parcelId = getParcelId($);
const currentOwnerRaw = extractCurrentOwners($);
const { map: salesMap, priorOwners } = extractSalesOwnersByDate($);

const invalid_owners = [];
const dates = Object.keys(salesMap).sort();
const owners_by_date = {};
for (const d of dates) {
  const owners = resolveOwnersFromRawStrings(salesMap[d], invalid_owners);
  if (owners.length > 0) {
    owners_by_date[d] = owners;
  }
}

if (priorOwners && priorOwners.length > 0) {
  const granteeNamesNorm = new Set();
  Object.values(owners_by_date).forEach((arr) => {
    arr.forEach((o) => {
      if (o.type === "company")
        granteeNamesNorm.add(`company:${normalizeName(o.name)}`);
      else
        granteeNamesNorm.add(
          `person:${o.prefix_name ? normalizeName(o.prefix_name) : ""}|${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`,
        );
    });
  });
  const placeholderRaw = [];
  for (const p of priorOwners) {
    const parts = splitCompositeNames(p);
    for (const part of parts) {
      const res = classifyOwner(part);
      if (res.valid) {
        const o = res.owner;
        let key;
        if (o.type === "company") key = `company:${normalizeName(o.name)}`;
        else
          key = `person:${o.prefix_name ? normalizeName(o.prefix_name) : ""}|${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`;
        if (!granteeNamesNorm.has(key)) {
          placeholderRaw.push(part);
        }
      } else {
        invalid_owners.push({
          raw: part,
          reason: res.reason || "invalid_owner",
        });
      }
    }
  }
  if (placeholderRaw.length > 0) {
    const unknownOwners = resolveOwnersFromRawStrings(
      placeholderRaw,
      invalid_owners,
    );
    if (unknownOwners.length > 0) {
      let idx = 1;
      let unknownKey = `unknown_date_${idx}`;
      while (Object.prototype.hasOwnProperty.call(owners_by_date, unknownKey)) {
        idx += 1;
        unknownKey = `unknown_date_${idx}`;
      }
      owners_by_date[unknownKey] = unknownOwners;
    }
  }
}

const currentOwnersStructured = resolveOwnersFromRawStrings(
  currentOwnerRaw,
  invalid_owners,
);
if (currentOwnersStructured.length > 0) {
  owners_by_date["current"] = currentOwnersStructured;
} else {
  owners_by_date["current"] = [];
}

const orderedOwnersByDate = {};
const dateKeys = Object.keys(owners_by_date)
  .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  .sort();
for (const dk of dateKeys) orderedOwnersByDate[dk] = owners_by_date[dk];
Object.keys(owners_by_date)
  .filter((k) => /^unknown_date_\d+$/.test(k))
  .forEach((k) => {
    orderedOwnersByDate[k] = owners_by_date[k];
  });
if (Object.prototype.hasOwnProperty.call(owners_by_date, "current")) {
  orderedOwnersByDate["current"] = owners_by_date["current"];
}

const propKey = `property_${parcelId || "unknown_id"}`;
const output = {};
output[propKey] = { owners_by_date: orderedOwnersByDate };

const mailingAddress = extractMailingAddress($);
if (mailingAddress) {
  output[propKey].mailing_address = mailingAddress;
}

function dedupeInvalidOwners(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = `${normalizeName(item.raw)}|${item.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ raw: item.raw, reason: item.reason });
    }
  }
  return out;
}

output.invalid_owners = dedupeInvalidOwners(invalid_owners);

const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log(JSON.stringify(output));
