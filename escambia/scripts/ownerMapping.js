const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function normSpace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function extractPropertyId($) {
  // Prefer explicit table row label "Parcel ID:"
  let id = null;
  $("tr").each((_, tr) => {
    if (id) return;
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = normSpace($(tds[0]).text());
      if (/^parcel\s*id\s*:$/i.test(label) || /^parcel\s*id\b/i.test(label)) {
        const candidate = normSpace($(tds[1]).text());
        if (candidate) id = candidate;
      }
    }
  });
  // Fallbacks if not found exactly
  if (!id) {
    const el = $('*:contains("Parcel ID")')
      .filter((_, e) => /parcel\s*id/i.test($(e).text()))
      .first();
    if (el && el.length) {
      // Try next sibling text
      const sib = el.next();
      const candidate = normSpace(sib.text());
      if (candidate) id = candidate;
    }
  }
  if (!id) return "unknown_id";
  // Clean ID
  id = id.replace(/[^A-Za-z0-9_-]+/g, "");
  return id || "unknown_id";
}

// --- NEW HELPER FUNCTION ---
const LEGAL_DESIGNATIONS_REGEX = new RegExp(
  "\\b(?:LIFE\\s*EST(?:ATE)?|EST(?:ATE)?|TRUST(?:EE)?|TR(?:USTEE)?|TTEE|REVOCABLE|IRREVOCABLE|EXECUTOR|EXR|ADMINISTRATOR|ADMR|PERSONAL\\s*REPRESENTATIVE|PR|HEIR|HEIRS|DECEASED|DEC'D|DEC|ET\\s*AL|ETAL|JTWROS|TENANTS?\\s*IN\\s*COMMON|TIC|TENANCY\\s*BY\\s*THE\\s*ENTIRETY|TBE|JOINT\\s*TENANTS?|JT|SURVIVOR|SURVIVORS?|AS\\s*TENANTS?\\s*IN\\s*COMMON|AS\\s*JOINT\\s*TENANTS?|AS\\s*COMMUNITY\\s*PROPERTY|AS\\s*SOLE\\s*AND\\s*SEPARATE\\s*PROPERTY|AS\\s*HUSBAND\\s*AND\\s*WIFE|AS\\s*COMMUNITY\\s*PROPERTY\\s*WITH\\s*RIGHT\\s*OF\\s*SURVIVORSHIP|A\\s*SINGLE\\s*MAN|A\\s*SINGLE\\s*WOMAN|A\\s*MARRIED\\s*MAN|A\\s*MARRIED\\s*WOMAN|A\\s*WIDOW|A\\s*WIDOWER|A\\s*PARTNERSHIP|A\\s*CORPORATION|A\\s*LIMITED\\s*LIABILITY\\s*COMPANY|A\\s*TRUST|A\\s*TRUSTEE|A\\s*FIDUCIARY|A\\s*BENEFICIARY|A\\s*GRANTOR|A\\s*GRANTEE|A\\s*DONOR|A\\s*DONEE|A\\s*SETTLOR|A\\s*SETTLEE|A\\s*DEVISEE|A\\s*LEGATEE|A\\s*ASSIGNEE|A\\s*ASSIGNOR|A\\s*MORTGAGEE|A\\s*MORTGAGOR|A\\s*LIENOR|A\\s*LIENEE|A\\s*GRANTOR\\s*TRUST|A\\s*NON-GRANTOR\\s*TRUST|A\\s*QUALIFIED\\s*PERSONAL\\s*RESIDENCE\\s*TRUST|QPRT|A\\s*CHARITABLE\\s*REMAINDER\\s*TRUST|CRT|A\\s*CHARITABLE\\s*LEAD\\s*TRUST|CLT|A\\s*SPECIAL\\s*NEEDS\\s*TRUST|SNT|A\\s*SUPPLEMENTAL\\s*NEEDS\\s*TRUST|SNT|A\\s*BLIND\\s*TRUST|A\\s*SPENDTHRIFT\\s*TRUST|A\\s*GENERATION-SKIPPING\\s*TRUST|GST|A\\s*LAND\\s*TRUST|A\\s*BUSINESS\\s*TRUST|A\\s*REAL\\s*ESTATE\\s*INVESTMENT\\s*TRUST|REIT|A\\s*FAMILY\\s*LIMITED\\s*PARTNERSHIP|FLP|A\\s*LIMITED\\s*LIABILITY\\s*PARTNERSHIP|LLP|A\\s*PROFESSIONAL\\s*CORPORATION|PC|A\\s*PROFESSIONAL\\s*LIMITED\\s*LIABILITY\\s*COMPANY|PLLC|A\\s*NON-PROFIT\\s*CORPORATION|A\\s*RELIGIOUS\\s*CORPORATION|A\\s*EDUCATIONAL\\s*CORPORATION|A\\s*CHARITABLE\\s*CORPORATION|A\\s*PUBLIC\\s*BENEFIT\\s*CORPORATION|A\\s*PRIVATE\\s*FOUNDATION|A\\s*PUBLIC\\s*CHARITY|A\\s*GOVERNMENTAL\\s*ENTITY|A\\s*MUNICIPALITY|A\\s*COUNTY|A\\s*STATE|THE\\s*UNITED\\s*STATES\\s*OF\\s*AMERICA|THE\\s*STATE\\s*OF|THE\\s*COUNTY\\s*OF|THE\\s*CITY\\s*OF|THE\\s*TOWN\\s*OF|THE\\s*VILLAGE\\s*OF|THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*STATE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COUNTY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*CITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*TOWN\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*VILLAGE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR)\\b",
  "gi"
);

function stripLegalDesignations(name) {
  let cleanedName = name;
  let match;
  const removedDesignations = [];

  // Use a loop to remove all occurrences and capture them
  while ((match = LEGAL_DESIGNATIONS_REGEX.exec(cleanedName)) !== null) {
    removedDesignations.push(match[0].trim());
    cleanedName = cleanedName.replace(match[0], " ").trim();
    // Reset lastIndex to avoid infinite loops with global regex and replace
    LEGAL_DESIGNATIONS_REGEX.lastIndex = 0;
  }

  // Remove any remaining commas or extra spaces after removal
  cleanedName = cleanedName.replace(/,+/g, " ").replace(/\s{2,}/g, " ").trim();

  return {
    cleanedName: cleanedName,
    removedDesignations: removedDesignations.length > 0 ? removedDesignations : null,
  };
}

function isCompanyName(name) {
  const n = (name || "").toLowerCase();

  // Explicit checks for common trust/estate patterns
  if (/\btrustee\s+for\b/i.test(n)) return true;
  if (/\btrust\b/i.test(n) && /\btrustee\b/i.test(n)) return true;
  if (/\b\w+\s+trust\s*$/i.test(n)) return true;
  if (/\bestate\s+of\b/i.test(n)) return true; // e.g., "Estate of John Doe"

  const kws = [
    "inc",
    "inc.",
    "llc",
    "l.l.c",
    "ltd",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "corp.",
    "co",
    "co.",
    "services",
    "trust", // Keep trust as a general keyword
    "trustee", // Keep trustee as a general keyword
    "tr",
    "ttee",
    "revocable",
    "irrevocable",
    "estate", // Keep estate as a general keyword
    "associates",
    "partners",
    "lp",
    "pllc",
    "pc",
    "company",
    "holdings",
    "group",
    "management",
    "properties",
    "realty",
    "capital",
    "church", // Added common non-profit/organizational terms
    "ministries",
    "association",
    "club",
    "society",
    "institute",
    "center",
    "community",
    "development",
    "fund",
    "bank",
    "credit union",
    "federal",
    "state",
    "county",
    "city",
    "town",
    "district",
    "authority",
    "board",
    "commission",
    "agency",
    "hospital",
    "medical",
    "school",
    "university",
    "college",
    "library",
    "museum",
    "park",
    "conservancy"
  ];
  return kws.some((kw) => new RegExp(`(^|\\b)${kw}(\\b|\\.|$)`, "i").test(n));
}

const ALLOWED_PREFIXES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];

const ALLOWED_SUFFIXES = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

const prefixLookup = new Map(
  ALLOWED_PREFIXES.map((p) => [p.replace(/\./g, "").toLowerCase(), p]),
);
const suffixLookup = new Map(
  ALLOWED_SUFFIXES.map((s) => [s.replace(/\./g, "").toLowerCase(), s]),
);

function normalizeTokenForLookup(token) {
  return token.replace(/\./g, "").toLowerCase();
}

function toIsoDate(s) {
  if (!s) return null;
  const str = s.trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const rxMonth = new RegExp(
    `^(${months.join("|")})\\s+(?:([0-9]{1,2}),\\s*)?([0-9]{4})$`,
    "i",
  );
  m = str.match(rxMonth);
  if (m) {
    const idx = months.findIndex((x) => x === m[1].toLowerCase()) + 1;
    const mm = String(idx).padStart(2, "0");
    const dd = m[2] ? String(parseInt(m[2], 10)).padStart(2, "0") : "01";
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function splitOwnerCandidates(text) {
  const cleaned = (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[|;]+/g, "\n")
    .replace(/\s*\n+\s*/g, "\n")
    .trim();
  const parts = cleaned.split(/\n+/).filter(Boolean);
  const out = [];
  parts.forEach((p) => {
    p.split(/\s+(?:and|AND|And)\s+|\s*&\s*/).forEach((x) => {
      const z = normSpace(x);
      if (z) out.push(z);
    });
  });
  return out;
}

function extractInterestInfo(raw) {
  if (!raw) return null;
  const interestRegex =
    /(\d+)\s*\/\s*(\d+)\s*(?:IN(?:T|TEREST)?\.?)?/i;
  const match = raw.match(interestRegex);
  if (!match) return null;
  const numerator = parseInt(match[1], 10);
  const denominator = parseInt(match[2], 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
    return null;
  const fraction = numerator / denominator;
  const fractionString = `${numerator}/${denominator}`;
  const cleaned = normSpace(raw.replace(match[0], " "));
  return {
    numerator,
    denominator,
    fraction,
    fractionString,
    cleaned,
  };
}

function parsePersonName(raw, contextHint) {
  const original = normSpace(raw);
  if (!original) return null;

  // --- NEW: Strip legal designations before parsing person name ---
  const { cleanedName: nameWithoutDesignations, removedDesignations } = stripLegalDesignations(original);
  const workingName = normSpace(nameWithoutDesignations);
  if (!workingName) return null; // If only designations were present

  const tryApplyPrefixSuffix = (tokens) => {
    let prefix = null;
    let suffix = null;
    if (tokens.length >= 1) {
      const firstToken = tokens[0];
      const pref = prefixLookup.get(normalizeTokenForLookup(firstToken));
      if (pref) {
        prefix = pref;
        tokens = tokens.slice(1);
      }
    }
    if (tokens.length >= 1) {
      const lastToken = tokens[tokens.length - 1];
      const suff = suffixLookup.get(normalizeTokenForLookup(lastToken));
      if (suff) {
        suffix = suff;
        tokens = tokens.slice(0, -1);
      }
    }
    return { tokens, prefix, suffix };
  };

  if (/,/.test(workingName)) {
    const [last, rest] = workingName.split(",");
    const tokens = normSpace(rest || "")
      .split(/\s+/)
      .filter(Boolean);
    let processed = tryApplyPrefixSuffix(tokens);
    const first = processed.tokens[0] || "";
    const middle = processed.tokens.slice(1).join(" ") || null;
    if (first && last)
      return {
        type: "person",
        first_name: first,
        last_name: normSpace(last),
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        // Store removed designations if any, for debugging or further processing
        _removed_designations: removedDesignations,
      };
    return null;
  }
  const cleaned = workingName
    .replace(/[.,]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const isUpper = cleaned === cleaned.toUpperCase();
  const inOwnerContext = contextHint && /owner/i.test(contextHint);
  if (isUpper && inOwnerContext) {
    let processed = tryApplyPrefixSuffix(tokens);
    if (processed.tokens.length < 2) processed = { ...processed, tokens };
    const last = processed.tokens[0];
    const first = processed.tokens[1] || "";
    const middle = processed.tokens.slice(2).join(" ") || null;
    if (first && last)
      return {
        type: "person",
        first_name: first,
        last_name: last,
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        _removed_designations: removedDesignations,
      };
  }
  let processed = tryApplyPrefixSuffix(tokens);
  if (processed.tokens.length < 2) {
    processed = { ...processed, tokens };
  }
  const first = processed.tokens[0];
  const last = processed.tokens[processed.tokens.length - 1];
  const middle = processed.tokens.slice(1, -1).join(" ") || null;
  if (first && last)
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
      prefix_name: processed.prefix || null,
      suffix_name: processed.suffix || null,
      _removed_designations: removedDesignations,
    };
  return null;
}

function ownerNormKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return `company:${normSpace(owner.name || "").toLowerCase()}`;
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .map((x) => normSpace(x || "").toLowerCase())
    .filter(Boolean);
  return `person:${parts.join(" ")}`;
}

function extractOwnerGroups($) {
  const groups = [];
  const labelRx =
    /^(owner\(s\)|owners?|owner\s*name\s*\d*|co-?owner|primary\s*owner)\s*:*/i;

  $("tr").each((_, tr) => {
    const tds = $(tr).find("td,th");
    if (tds.length < 2) return;
    const label = normSpace($(tds[0]).text());
    if (!labelRx.test(label)) return;

    const htmlValue = $(tds[1]).html() || "";
    const rawValue = htmlValue
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00A0/g, " ");
    const valueText = rawValue.replace(/\s*\n+\s*/g, "\n").trim();
    if (!valueText) return;

    // Find a date near this row (same or next row)
    let dateCandidate = null;
    const dateRx =
      /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i;
    const rowText = normSpace($(tr).text());
    let m = rowText.match(dateRx);
    if (m) dateCandidate = toIsoDate(m[1]);
    if (!dateCandidate) {
      const nextRow = $(tr).next("tr");
      if (nextRow && nextRow.length) {
        const rowText2 = normSpace(nextRow.text());
        const m2 = rowText2.match(dateRx);
        if (m2) dateCandidate = toIsoDate(m2[1]);
      }
    }

    groups.push({
      context: label,
      valueText,
      date: dateCandidate,
      isCurrent: true,
    }); // assume this is the current owner block
  });

  // If no direct owner label rows found, try generic spans/divs where the preceding sibling label contains Owners
  if (groups.length === 0) {
    $('td:contains("Owners")').each((_, el) => {
      const $el = $(el);
      const label = normSpace($el.text());
      if (!/owners?/i.test(label)) return;
      const tr = $el.closest("tr");
      if (!tr.length) return;
      const tds = tr.find("td");
      if (tds.length >= 2) {
        const valueText = normSpace($(tds[1]).text());
        if (valueText)
          groups.push({
            context: "Owners",
            valueText,
            date: null,
            isCurrent: true,
          });
      }
    });
  }

  // Deduplicate by valueText
  const out = [];
  const seen = new Set();
  groups.forEach((g) => {
    const key = `${g.context}::${g.valueText}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(g);
  });
  return out;
}

function parseOwnersFromGroup(valueText, contextHint) {
  const candidates = splitOwnerCandidates(valueText);
  const owners = [];
  const invalid = [];
  let pendingInterest = null;
  let pendingGroupId = null;
  let interestGroupCounter = 0;

  candidates.forEach((raw) => {
    if (!raw || /^none$/i.test(raw)) return;

    const interestInfo = extractInterestInfo(raw);
    let workingText = interestInfo ? interestInfo.cleaned : raw;
    workingText = workingText
      .replace(/\bINT\b\.?/gi, "")
      .replace(/:+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    let owner = null;
    // --- NEW: Check for company name *before* stripping legal designations for person name ---
    // This ensures "JOHN DOE TRUSTEE" is correctly identified as a company/trust if 'TRUSTEE' is a company keyword
    // but "JOHN DOE LIFE EST" is processed as a person "JOHN DOE" with "LIFE EST" stripped.
    if (isCompanyName(workingText)) {
      owner = { type: "company", name: workingText.trim() };
    } else {
      // If not a company, try parsing as a person, which now includes stripping legal designations
      const person = parsePersonName(workingText, contextHint || "");
      if (person && person.first_name && person.last_name) owner = person;
    }

    if (!owner) {
      invalid.push({ raw, reason: "unclassified_or_insufficient_info" });
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    owners.push(owner);

    const lastOwner = owners[owners.length - 1];
    if (!lastOwner) {
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    if (interestInfo) {
      interestGroupCounter += 1;
      pendingInterest = interestInfo;
      pendingGroupId = `group_${interestGroupCounter}`;
      lastOwner.ownership_interest_fraction = interestInfo.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        interestInfo.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (interestInfo.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
    } else if (pendingInterest) {
      lastOwner.ownership_interest_fraction = pendingInterest.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        pendingInterest.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (pendingInterest.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
      pendingInterest = null;
      pendingGroupId = null;
    }
  });

  const uniq = [];
  const seen = new Set();
  for (const o of owners) {
    const key = ownerNormKey(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (o.middle_name === "") o.middle_name = null;
    uniq.push(o);
  }

  return { owners: uniq, invalid };
}

function buildOwnersByDate(groups) {
  const buckets = [];
  let placeholderIdx = 1;
  const globalInvalid = [];

  groups.forEach((g) => {
    const { owners, invalid } = parseOwnersFromGroup(g.valueText, g.context);
    invalid.forEach((inv) => globalInvalid.push(inv));
    if (owners.length === 0) return;
    let key = g.date ? g.date : `unknown_date_${placeholderIdx++}`;
    buckets.push({ key, owners, isCurrent: g.isCurrent });
  });

  // If nothing parsed, return empty skeleton
  if (buckets.length === 0) {
    return { owners_by_date: { current: [] }, invalid_owners: [] };
  }

  // Choose a current bucket (prefer a group marked current, else last)
  let currentOwners = [];
  const currentMarked = buckets.filter((b) => b.isCurrent);
  currentOwners = (
    currentMarked.length
      ? currentMarked[currentMarked.length - 1]
      : buckets[buckets.length - 1]
  ).owners;

  const dated = [];
  buckets.forEach((b) => {
    if (b.owners === currentOwners && !/^\d{4}-\d{2}-\d{2}$/.test(b.key))
      return; // avoid duplicating current unknown
    dated.push({ key: b.key, owners: b.owners });
  });

  const knownDates = dated.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.key));
  const unknowns = dated.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.key));
  knownDates.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const owners_by_date = {};
  unknowns.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  knownDates.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  owners_by_date.current = currentOwners;

  return { owners_by_date, invalid_owners: globalInvalid };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const propertyIdRaw = extractPropertyId($);
  const propertyKey = `property_${propertyIdRaw}`;

  const groups = extractOwnerGroups($);
  const { owners_by_date, invalid_owners } = buildOwnersByDate(groups);

  const result = {};
  result[propertyKey] = {
    owners_by_date,
    invalid_owners: invalid_owners || [],
  };

  const outDir = path.join(process.cwd(), "owners");
  const outFile = path.join(outDir, "owner_data.json");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");

  console.log(JSON.stringify(result, null, 2));
}

main();