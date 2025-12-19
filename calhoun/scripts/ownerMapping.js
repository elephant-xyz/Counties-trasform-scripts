const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

// UPDATED: Selector for Parcel ID
const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
// UPDATED: Selector for the current owner's name span
const CURRENT_OWNER_SELECTOR = "#ctlBodyPane_ctl02_ctl01_rptOwner_ctl00_sprOwnerName1_lnkUpmSearchLinkSuppressed_lblSearch";
// UPDATED: Selector for the sales table body rows
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl06_ctl01_grdSales tbody tr";

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
  "ministries",
  "properties",
  "realty",
  "management",
  "investments",
  "mortgage",
  "county",
  "city",
  "clerk",
  "board",
  "department",
  "club",
  "estate",
];

const PREFIX_MAP = {
  MR: "Mr",
  MRS: "Mrs",
  MS: "Ms",
  MISS: "Miss",
  DR: "Dr",
  REV: "Rev",
  REVEREND: "Rev",
  FATHER: "Fr",
  FR: "Fr",
  SISTER: "Sr",
  BROTHER: "Bro",
  HON: "Hon",
  JUDGE: "Judge",
  ATTY: "Atty",
  ATTORNEY: "Atty",
  CAPT: "Capt",
  CAPTAIN: "Capt",
  SGT: "Sgt",
  SERGEANT: "Sgt",
  LT: "Lt",
  "LT COL": "Lt Col",
};

const SUFFIX_MAP = {
  JR: "Jr",
  "JR.": "Jr",
  SR: "Sr",
  "SR.": "Sr",
  II: "II",
  III: "III",
  IV: "IV",
  V: "V",
  VI: "VI",
  VII: "VII",
  VIII: "VIII",
  IX: "IX",
  X: "X",
  MD: "MD",
  DDS: "DDS",
  CPA: "CPA",
  ESQ: "Esq",
  PHD: "PhD",
  JD: "JD",
  DVM: "DVM",
  RN: "RN",
};

function normalizeAffixToken(token) {
  return (token || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function extractPrefix(tokens) {
  const captured = [];
  while (tokens.length > 0) {
    const normalized = normalizeAffixToken(tokens[0]);
    if (PREFIX_MAP[normalized]) {
      captured.push(PREFIX_MAP[normalized]);
      tokens.shift();
    } else break;
  }
  return captured.length ? captured.join(" ") : null;
}

function extractSuffix(tokens) {
  const captured = [];
  while (tokens.length > 0) {
    const normalized = normalizeAffixToken(tokens[tokens.length - 1]);
    if (SUFFIX_MAP[normalized]) {
      captured.unshift(SUFFIX_MAP[normalized]);
      tokens.pop();
    } else break;
  }
  return captured.length ? captured.join(" ") : null;
}

function parsePersonName(raw, options = {}) {
  const fallbackLastName = options.fallbackLastName || null;
  const cleaned = cleanInvalidCharsFromName(raw);
  if (!cleaned) return null;
  let working = cleaned.replace(/\s+/g, " ").trim();
  if (!working) return null;

  const tokens = working.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const prefix = extractPrefix(tokens);
  const suffix = extractSuffix(tokens);

  if (tokens.length === 0) return null;

  let lastName = null;
  let firstName = null;
  let middleName = null;

  if (tokens.length >= 3) {
    lastName = tokens[0];
    firstName = tokens[1];
    const middleTokens = tokens.slice(2);
    middleName = middleTokens.length ? middleTokens.join(" ") : null;
  } else if (tokens.length === 2) {
    if (fallbackLastName && tokens[1].length <= 2) {
      firstName = tokens[0];
      middleName = tokens[1] ? tokens[1] : null;
      lastName = fallbackLastName;
    } else {
      lastName = tokens[0];
      firstName = tokens[1];
    }
  } else if (tokens.length === 1) {
    if (fallbackLastName) {
      firstName = tokens[0];
      lastName = fallbackLastName;
    } else {
      return null;
    }
  }

  if (!firstName || !lastName) return null;

  const person = {
    type: "person",
    first_name: cleanInvalidCharsFromName(firstName),
    last_name: cleanInvalidCharsFromName(lastName),
    middle_name: middleName ? cleanInvalidCharsFromName(middleName) : null,
    prefix_name: prefix,
    suffix_name: suffix,
  };
  if (person.middle_name === "") person.middle_name = null;
  return person;
}


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
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

function classifyOwner(raw, options = {}) {
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned) || /\d/.test(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  const person = parsePersonName(cleaned, options);
  if (person) {
    return { valid: true, owner: person };
  }
  return { valid: false, reason: "person_unparsed", raw: cleaned };
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    let norm;
    if (o.type === "company") {
      norm = `company:${normalizeName(o.name)}`;
    } else {
      const middle = o.middle_name ? normalizeName(o.middle_name) : "";
      const suffix = o.suffix_name ? normalizeName(o.suffix_name) : "";
      norm = `person:${normalizeName(o.first_name)}|${middle}|${normalizeName(o.last_name)}|${suffix}`;
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
  const out = [];
  $(".sdw1-owners-container > div").each((_, div) => {
    const $div = $(div);
    const ownerTypeText = txt(
      $div.find('[id$="_lblOwnerType"]').first().text() || "",
    ).toLowerCase();
    if (!ownerTypeText.includes("primary owner")) return;
    const names = new Set();
    $div
      .find('[id*="sprOwnerName"]')
      .each((__, el) => {
        const txtVal = txt($(el).text() || "");
        if (!txtVal) return;
        const cleaned = txtVal.replace(/\s*&\s*$/g, "").trim();
        if (cleaned) names.add(cleaned);
      });
    names.forEach((name) => out.push(name));
  });
  return out;
}

function extractSalesOwnersByDate($) {
  const map = {};
  const priorOwners = [];
  const rows = $(SALES_TABLE_SELECTOR);
  rows.each((i, tr) => {
    const $tr = $(tr);
    // The sales table structure is:
    // <th>Multi Parcel</th> <td>Sale Date</td> <td>Sale Price</td> <td>Instrument</td> <td>Book/Page</td> <td>Qualification</td> <td>Reason</td> <td>Vacant/Improved</td> <td>Grantor</td> <td>Grantee</td>
    // So, Sale Date is the 2nd column (index 1), Grantor is 9th (index 8), Grantee is 10th (index 9)
    const saleDateRaw = txt($tr.find("td").eq(0).text()); // Sale Date is the first td after the th
    if (!saleDateRaw) return;
    const dm = saleDateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dm) return;
    const mm = dm[1].padStart(2, "0");
    const dd = dm[2].padStart(2, "0");
    const yyyy = dm[3];
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // Grantee is the last td
    const grantee = txt($tr.find("td").eq(8).text()); // Grantee is the 9th td (index 8)
    if (grantee) {
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(grantee);
    }

    // Grantor is the second to last td
    const grantor = txt($tr.find("td").eq(7).text()); // Grantor is the 8th td (index 7)
    if (grantor) priorOwners.push(grantor);
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
    let lastKnownLastName = null;
    for (const part of parts) {
      const res = classifyOwner(part, { fallbackLastName: lastKnownLastName });
      if (res.valid) {
        owners.push(res.owner);
        if (res.owner.type === "person" && res.owner.last_name) {
          lastKnownLastName = res.owner.last_name;
        } else if (res.owner.type === "company") {
          lastKnownLastName = null;
        }
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
          `person:${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`,
        );
    });
  });
  const placeholderRaw = [];
  for (const p of priorOwners) {
    const parts = splitCompositeNames(p);
    let lastKnownLastName = null;
    for (const part of parts) {
      const res = classifyOwner(part, { fallbackLastName: lastKnownLastName });
      if (res.valid) {
        const o = res.owner;
        let key;
        if (o.type === "company") {
          key = `company:${normalizeName(o.name)}`;
          lastKnownLastName = null;
        } else {
          key = `person:${normalizeName(o.first_name)}|${o.middle_name ? normalizeName(o.middle_name) : ""}|${normalizeName(o.last_name)}|${o.suffix_name ? normalizeName(o.suffix_name) : ""}`;
          if (o.last_name) lastKnownLastName = o.last_name;
        }
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
