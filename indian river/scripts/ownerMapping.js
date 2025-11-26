const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read HTML input
const htmlPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(htmlPath, "utf-8");
const $ = cheerio.load(html);

// Read parcel id from property_seed.json
const seedPath = path.join(process.cwd(), "property_seed.json");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const CURRENT_OWNER_SELECTOR =
  "#ctlBodyPane_ctl03_ctl01_lstPrimaryOwner_ctl00_sprPrimaryOwnerLabel_lblSuppressed";
const SALES_TABLE_SELECTOR =
  "#ctlBodyPane_ctl12_ctl01_grdSales tbody tr";

const PERSON_PREFIXES = new Set([
  "MR",
  "MRS",
  "MS",
  "MISS",
  "DR",
  "REV",
  "FR",
  "PASTOR",
  "HON",
  "ATTY",
  "ATTORNEY",
  "JUDGE",
  "CAPT",
  "CAPTAIN",
  "SGT",
  "SERGEANT",
  "LT",
  "LIEUTENANT",
  "COL",
  "COLONEL",
  "MAJ",
  "MAJOR",
  "GEN",
  "GENERAL",
  "ADM",
  "ADMIRAL",
  "PROF",
  "PROFESSOR",
]);

const PERSON_SUFFIXES = new Set([
  "JR",
  "SR",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "ESQ",
  "ESQUIRE",
  "MD",
  "DO",
  "DDS",
  "DMD",
  "CPA",
  "PHD",
  "PHD.",
  "PH.D",
  "PH.D.",
  "RN",
  "LPN",
  "PA",
  "JD",
  "J.D",
  "J.D.",
  "LLM",
  "SRN",
]);

const COMPANY_KEYWORDS = [
  "llc",
  "l.l.c",
  "inc",
  "ltd",
  "co",
  "corp",
  "company",
  "trust",
  "bank",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "properties",
  "management",
  "development",
  "ventures",
  "venture",
  "investments",
  "investment",
  "foundation",
  "solutions",
  "services",
  "ministries",
  "church",
  "school",
  "university",
  "authority",
  "county",
  "city",
  "board",
  "district",
  "dept",
  "department",
  "club",
  "coop",
  "cooperative",
  "trustees",
  "estate",
  "properties",
  "assn",
];

const COMPANY_SUFFIXES = [
  "LLC",
  "INC",
  "CO",
  "CORP",
  "CORPORATION",
  "LTD",
  "LIMITED",
  "COMPANY",
  "LP",
  "LLP",
  "PLC",
  "PLLC",
  "TRUST",
  "BANK",
  "ASSOCIATES",
  "ASSOCIATION",
  "FOUNDATION",
  "HOLDINGS",
  "GROUP",
  "PARTNERS",
  "PROPERTIES",
  "SERVICES",
  "VENTURES",
  "VENTURE",
  "INVESTMENTS",
  "INVESTMENT",
  "DEVELOPMENT",
  "MANAGEMENT",
  "ENTERPRISES",
  "AUTHORITY",
  "MINISTRIES",
  "CHURCH",
  "SCHOOL",
  "UNIVERSITY",
];

const NOISE_TOKEN_SET = new Set([
  "ET",
  "AL",
  "ETAL",
  "ETUX",
  "ETVIR",
  "ETUXOR",
  "AKA",
  "A/K/A",
  "FBO",
  "C/O",
  "UA",
  "U/A",
  "UDT",
  "U/D/T",
  "TRUSTEE",
  "TRUSTEES",
  "TTEE",
  "TTEES",
  "POA",
  "AS",
  "THE",
  "%", // any lingering percent symbol
]);

const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const normalizeName = (s) => txt(s).toLowerCase();

function normalizeWhitespace(str) {
  return (str || "").replace(/[\u00A0\s]+/g, " ").trim();
}

function sanitizeRawOwner(raw) {
  if (!raw) return "";
  let s = raw;
  s = s.replace(/[\u00A0]/g, " ");
  s = s.replace(/\r|\n/g, " ");
  s = s.replace(/[(),]/g, " ");
  s = s.replace(/\*/g, " ");
  s = s.replace(/\./g, " ");
  s = s.replace(/%/g, " ");
  s = s.replace(/\bET\s+AL\b/gi, " ");
  s = s.replace(/\bETAL\b/gi, " ");
  s = s.replace(/\bET\s+UX\b/gi, " ");
  s = s.replace(/\bET\s+VIR\b/gi, " ");
  s = s.replace(/\bET\s+UXOR\b/gi, " ");
  s = s.replace(/\bA\/K\/A\b/gi, " ");
  s = s.replace(/\bAKA\b/gi, " ");
  s = s.replace(/\bU\/A\b/gi, " ");
  s = s.replace(/\bU\/D\/T\b/gi, " ");
  s = s.replace(/\bFBO\b/gi, " ");
  s = s.replace(/\bC\/O\b/gi, " ");
  s = s.replace(/\bTRUSTEE[S]?\b/gi, " ");
  s = s.replace(/\bTTEE[S]?\b/gi, " ");
  s = normalizeWhitespace(s);
  return s;
}

function tokenizeOwner(raw) {
  const sanitized = sanitizeRawOwner(raw);
  if (!sanitized) return [];
  return sanitized
    .split(/\s+/)
    .map((token) =>
      token.replace(/^[^A-Za-z0-9'-]+|[^A-Za-z0-9'-]+$/g, "").trim(),
    )
    .filter((token) => token && !NOISE_TOKEN_SET.has(token.toUpperCase()));
}

function isRomanNumeral(str) {
  return /^[IVXLCDM]+$/i.test(str || "");
}

function toNameCase(str) {
  if (!str) return "";
  const upper = str.toUpperCase();
  if (isRomanNumeral(upper)) return upper;
  const lower = str.toLowerCase();
  return lower.replace(/(^|[-'\s])([a-z])/g, (match, sep, chr) => sep + chr.toUpperCase());
}

function formatPrefix(value) {
  if (!value) return null;
  return toNameCase(value.replace(/[^A-Za-z]/g, ""));
}

function formatSuffix(value) {
  if (!value) return null;
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  if (isRomanNumeral(cleaned)) return cleaned.toUpperCase();
  const upper = cleaned.toUpperCase();
  if (PERSON_SUFFIXES.has(upper)) {
    if (upper.length <= 3) return upper.charAt(0) + upper.slice(1).toLowerCase();
    return upper;
  }
  return toNameCase(cleaned);
}

function hasCompanyIndicators(tokens, rawString) {
  if (!tokens || tokens.length === 0) return false;
  const lowerTokens = tokens.map((t) => t.toLowerCase());
  if (lowerTokens.some((tok) => COMPANY_KEYWORDS.includes(tok))) return true;
  if (lowerTokens.some((tok) => /\d/.test(tok))) return true;
  const lastToken = tokens[tokens.length - 1].toUpperCase();
  if (COMPANY_SUFFIXES.includes(lastToken)) return true;
  if (rawString && /[,]/.test(rawString)) return true;
  return false;
}

function formatCompanyName(raw) {
  return sanitizeRawOwner(raw);
}

function splitCompositeNames(raw) {
  const sanitized = sanitizeRawOwner(raw);
  if (!sanitized) return [];
  const connectors = /\s+(?:&|AND)\s+/i;
  if (!connectors.test(sanitized)) return [sanitized];
  const parts = sanitized
    .split(connectors)
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);
  if (parts.length <= 1) return [sanitized];
  return parts;
}

function classifyOwnerPart(rawPart, options = {}) {
  const rawTrimmed = rawPart ? rawPart.trim() : "";
  const tokens = tokenizeOwner(rawPart);
  if (!tokens.length) {
    return { valid: false, reason: "unparseable_or_empty", raw: rawPart };
  }
  if (hasCompanyIndicators(tokens, rawPart)) {
    return {
      valid: true,
      owner: { type: "company", name: formatCompanyName(rawPart) },
    };
  }
  const mutableTokens = [...tokens];
  let prefix = null;
  while (mutableTokens.length) {
    const candidate = mutableTokens[0].replace(/[^A-Za-z]/g, "").toUpperCase();
    if (PERSON_PREFIXES.has(candidate)) {
      prefix = formatPrefix(mutableTokens.shift());
    } else {
      break;
    }
  }
  let suffix = null;
  while (mutableTokens.length) {
    const lastCandidate = mutableTokens[
      mutableTokens.length - 1
    ].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (PERSON_SUFFIXES.has(lastCandidate) || isRomanNumeral(lastCandidate)) {
      suffix = formatSuffix(mutableTokens.pop());
    } else {
      break;
    }
  }
  const surnameFirst =
    options.surnameFirstHint ||
    /^\*/.test(rawTrimmed) ||
    /\*\s*$/.test(rawTrimmed || "");
  if (mutableTokens.length < 2) {
    return {
      valid: false,
      reason: "person_missing_first_or_last",
      raw: sanitizeRawOwner(rawPart),
    };
  }
  let first;
  let last;
  let middleTokens;
  if (surnameFirst) {
    last = toNameCase(mutableTokens.shift());
    first = toNameCase(mutableTokens.shift());
    middleTokens = mutableTokens.map((t) => toNameCase(t));
  } else {
    first = toNameCase(mutableTokens.shift());
    last = toNameCase(mutableTokens.pop());
    middleTokens = mutableTokens.map((t) => toNameCase(t));
  }
  const middle = middleTokens.length ? middleTokens.join(" ") : null;
  if (!first || !last) {
    return {
      valid: false,
      reason: "person_missing_first_or_last",
      raw: sanitizeRawOwner(rawPart),
    };
  }
  return {
    valid: true,
    owner: {
      type: "person",
      first_name: first,
      middle_name: middle,
      last_name: last,
      prefix_name: prefix,
      suffix_name: suffix,
    },
  };
}

function ownerSignature(owner) {
  if (!owner) return "";
  if (owner.type === "company") {
    return `company:${normalizeName(owner.name)}`;
  }
  return [
    "person",
    normalizeName(owner.first_name),
    normalizeName(owner.middle_name || ""),
    normalizeName(owner.last_name),
    normalizeName(owner.prefix_name || ""),
    normalizeName(owner.suffix_name || ""),
  ].join("|");
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  owners.forEach((owner) => {
    const sig = ownerSignature(owner);
    if (sig && !seen.has(sig)) {
      seen.add(sig);
      out.push(owner);
    }
  });
  return out;
}

function resolveOwnersFromRawStrings(rawStrings, invalidCollector) {
  const owners = [];
  rawStrings.forEach((raw) => {
    const parts = splitCompositeNames(raw);
    if (parts.length === 0) {
      invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      return;
    }
    const surnameFirstHint =
      /^\*/.test((raw || "").trim()) || /\*\s*$/.test((raw || "").trim());
    const parsedOwners = [];
    const partInvalids = [];
    parts.forEach((part) => {
      const result = classifyOwnerPart(part, { surnameFirstHint });
      if (result.valid) {
        parsedOwners.push(result.owner);
      } else {
        partInvalids.push({
          raw: result.raw || part,
          reason: result.reason || "invalid_owner",
        });
      }
    });
    if (parsedOwners.length === 0) {
      const fallbackTokens = tokenizeOwner(raw);
      if (
        fallbackTokens.length &&
        hasCompanyIndicators(fallbackTokens, raw)
      ) {
        parsedOwners.push({
          type: "company",
          name: formatCompanyName(raw),
        });
      }
    }
    if (parsedOwners.length === 0) {
      if (partInvalids.length) {
        partInvalids.forEach((item) => invalidCollector.push(item));
      } else {
        invalidCollector.push({ raw, reason: "unparseable_or_empty" });
      }
    } else {
      owners.push(...parsedOwners);
      partInvalids.forEach((item) => invalidCollector.push(item));
    }
  });
  return dedupeOwners(owners);
}

function parseOwnersFromEntries(entries, invalidCollector) {
  const ownerMap = new Map();
  entries.forEach(({ rawName, rawAddress }) => {
    if (!rawName) return;
    const parts = splitCompositeNames(rawName);
    if (parts.length === 0) {
      invalidCollector.push({ raw: rawName, reason: "unparseable_or_empty" });
      return;
    }
    const surnameFirstHint =
      /^\*/.test((rawName || "").trim()) || /\*\s*$/.test((rawName || "").trim());
    const parsedOwners = [];
    const partInvalids = [];
    parts.forEach((part) => {
      const result = classifyOwnerPart(part, { surnameFirstHint });
      if (result.valid) {
        parsedOwners.push(result.owner);
      } else {
        partInvalids.push({
          raw: result.raw || part,
          reason: result.reason || "invalid_owner",
        });
      }
    });
    if (!parsedOwners.length) {
      const fallbackTokens = tokenizeOwner(rawName);
      if (fallbackTokens.length && hasCompanyIndicators(fallbackTokens, rawName)) {
        parsedOwners.push({
          type: "company",
          name: formatCompanyName(rawName),
        });
      }
    }
    if (!parsedOwners.length) {
      if (partInvalids.length) {
        partInvalids.forEach((item) => invalidCollector.push(item));
      } else {
        invalidCollector.push({ raw: rawName, reason: "unparseable_or_empty" });
      }
      return;
    }
    partInvalids.forEach((item) => invalidCollector.push(item));
    parsedOwners.forEach((owner) => {
      const signature = ownerSignature(owner);
      if (!ownerMap.has(signature)) {
        const baseOwner =
          owner.type === "person"
            ? {
                type: "person",
                first_name: owner.first_name,
                middle_name: owner.middle_name,
                last_name: owner.last_name,
                prefix_name: owner.prefix_name,
                suffix_name: owner.suffix_name,
              }
            : {
                type: "company",
                name: owner.name,
              };
        ownerMap.set(signature, {
          owner: baseOwner,
          addresses: new Set(),
        });
      }
      const entry = ownerMap.get(signature);
      if (owner.type === "person") {
        if (!entry.owner.middle_name && owner.middle_name)
          entry.owner.middle_name = owner.middle_name;
        if (!entry.owner.prefix_name && owner.prefix_name)
          entry.owner.prefix_name = owner.prefix_name;
        if (!entry.owner.suffix_name && owner.suffix_name)
          entry.owner.suffix_name = owner.suffix_name;
      }
      if (owner.type === "company") {
        if (
          entry.owner.name &&
          owner.name &&
          entry.owner.name.length < owner.name.length
        ) {
          entry.owner.name = owner.name;
        }
      }
      if (rawAddress) {
        entry.addresses.add(rawAddress);
      }
    });
  });

  const owners = [];
  const mailingAddresses = [];
  ownerMap.forEach((value, signature) => {
    owners.push(value.owner);
    if (value.addresses.size) {
      if (value.owner.type === "person") {
        mailingAddresses.push({
          signature,
          type: "person",
          first_name: value.owner.first_name,
          middle_name: value.owner.middle_name,
          last_name: value.owner.last_name,
          prefix_name: value.owner.prefix_name,
          suffix_name: value.owner.suffix_name,
          addresses: Array.from(value.addresses),
        });
      } else {
        mailingAddresses.push({
          signature,
          type: "company",
          name: value.owner.name,
          addresses: Array.from(value.addresses),
        });
      }
    }
  });

  return {
    owners,
    mailingAddresses,
  };
}

function parseDateToISO(txtDate) {
  if (!txtDate) return null;
  const s = String(txtDate).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    const mm2 = mm.padStart(2, "0");
    const dd2 = dd.padStart(2, "0");
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function extractCurrentOwnerEntries($doc) {
  const entries = [];
  $doc(CURRENT_OWNER_SELECTOR).each((_, el) => {
    let nameHtml = $doc(el).html() || $doc(el).text() || "";
    nameHtml = nameHtml.replace(/<br\s*\/?>/gi, "\n");
    nameHtml = nameHtml.replace(/<\/?[^>]+>/g, "");
    const nameLines = nameHtml
      .split(/\n+/)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);
    if (!nameLines.length) return;
    const rawName = nameLines[0];
    const id = $doc(el).attr("id") || "";
    let rawAddress = null;
    if (id.includes("sprPrimaryOwnerLabel")) {
      const addressId = id.replace(
        "sprPrimaryOwnerLabel",
        "sprPrimaryOwnerAddress",
      );
      if (addressId) {
        const addrEl = $doc(`[id="${addressId}"]`);
        if (addrEl && addrEl.length) {
          let addrHtml = addrEl.html() || addrEl.text() || "";
          addrHtml = addrHtml.replace(/<br\s*\/?>/gi, "\n");
          addrHtml = addrHtml.replace(/<\/?[^>]+>/g, "");
          const addressLines = addrHtml
            .split(/\n+/)
            .map((part) => normalizeWhitespace(part))
            .filter(Boolean);
          if (addressLines.length) {
            rawAddress = addressLines.join("\n");
          }
        }
      }
    }
    entries.push({
      rawName,
      rawAddress,
    });
  });
  return entries;
}

function extractSalesHistory($doc, invalidCollector) {
  const sales = [];
  $doc(SALES_TABLE_SELECTOR).each((_, tr) => {
    const $tr = $doc(tr);
    const tds = $tr.find("td");
    if (tds.length < 8) return;
    const saleDateRaw = txt($doc(tds[0]).text());
    const saleDateISO = parseDateToISO(saleDateRaw);
    if (!saleDateISO) return;
    const grantorRaw = txt($doc(tds[7]).text());
    const grantors = grantorRaw
      ? resolveOwnersFromRawStrings([grantorRaw], invalidCollector)
      : [];
    sales.push({
      saleDateISO,
      saleDateRaw,
      grantors,
    });
  });
  return sales;
}

function mergeOwnersLists(target, additions) {
  const existing = target || [];
  const deduped = dedupeOwners([...existing, ...(additions || [])]);
  return deduped;
}

function isISODateKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function buildOwnersByDate(currentOwners, sales) {
  const ownersByDate = {};
  const latestSaleDate = sales.length > 0 ? sales[0].saleDateISO : null;

  if (currentOwners.length > 0) {
    if (latestSaleDate) {
      ownersByDate[latestSaleDate] = mergeOwnersLists(
        ownersByDate[latestSaleDate],
        currentOwners,
      );
    }
    ownersByDate.current = mergeOwnersLists(
      ownersByDate.current,
      currentOwners,
    );
  } else {
    ownersByDate.current = [];
  }

  sales.forEach((sale, idx) => {
    if (!sale.grantors || sale.grantors.length === 0) return;
    let previousDate = null;
    for (let j = idx + 1; j < sales.length; j += 1) {
      if (sales[j].saleDateISO !== sale.saleDateISO) {
        previousDate = sales[j].saleDateISO;
        break;
      }
    }
    const key = previousDate || `unknown_prior_sale_${idx + 1}`;
    ownersByDate[key] = mergeOwnersLists(ownersByDate[key], sale.grantors);
  });

  const ordered = {};
  Object.keys(ownersByDate)
    .filter((key) => isISODateKey(key))
    .sort()
    .forEach((key) => {
      ordered[key] = ownersByDate[key];
    });
  Object.keys(ownersByDate)
    .filter((key) => !isISODateKey(key) && key !== "current")
    .sort()
    .forEach((key) => {
      ordered[key] = ownersByDate[key];
    });
  if (Object.prototype.hasOwnProperty.call(ownersByDate, "current")) {
    ordered.current = ownersByDate.current;
  }
  return ordered;
}

function dedupeInvalidOwners(list) {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const key = `${normalizeName(item.raw)}|${item.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ raw: item.raw, reason: item.reason });
    }
  });
  return out;
}

const parcelId = seedData.parcel_id;
const currentOwnerEntries = extractCurrentOwnerEntries($);
const invalidOwners = [];
const currentOwnersResult = parseOwnersFromEntries(
  currentOwnerEntries,
  invalidOwners,
);
const currentOwnersStructured = currentOwnersResult.owners || [];
const ownerMailingAddresses = currentOwnersResult.mailingAddresses || [];
const salesHistory = extractSalesHistory($, invalidOwners);
const ownersByDate = buildOwnersByDate(currentOwnersStructured, salesHistory);

const propKey = `property_${parcelId || "unknown_id"}`;
const output = {};
output[propKey] = {
  owners_by_date: ownersByDate,
  owner_mailing_addresses: ownerMailingAddresses,
};
output.invalid_owners = dedupeInvalidOwners(invalidOwners);

const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

console.log(JSON.stringify(output));
