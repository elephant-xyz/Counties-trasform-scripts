const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf-8");
const $ = cheerio.load(html);

// Utilities
const text = (el) => $(el).text().trim();
const normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const cleanWhitespace = (s) =>
  (s || "")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const PERSONAL_PREFIXES = new Set([
  "ADM",
  "ADMIRAL",
  "ATTY",
  "ATTORNEY",
  "CAPT",
  "CAPTAIN",
  "CHIEF",
  "COL",
  "COLONEL",
  "CPT",
  "DOCTOR",
  "DR",
  "FATHER",
  "FR",
  "GEN",
  "GENERAL",
  "HON",
  "HONORABLE",
  "JUDGE",
  "LADY",
  "LIEUTENANT",
  "LT",
  "MAJ",
  "MAJOR",
  "MISS",
  "MISTER",
  "MR",
  "MRS",
  "MS",
  "MX",
  "PASTOR",
  "PROF",
  "PROFESSOR",
  "REV",
  "REVEREND",
  "SIR",
  "SISTER",
]);

const QUALIFIER_TOKENS = new Set([
  "ET",
  "UX",
  "VIR",
  "AL",
  "ALIA",
  "ALIAS",
  "JR",
  "SR",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "MD",
  "PHD",
  "ESQ",
  "ESQUIRE",
  "TR",
  "TRS",
  "TRUST",
  "TRUSTEE",
  "TRUSTEES",
  "TTEE",
  "FBO",
  "CUST",
  "CUSTODIAN",
  "EST",
  "ESTATE",
  "DECEASED",
]);

function normalizeToken(token) {
  return (token || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

function scrubPersonalName(raw) {
  const tokens = (raw || "")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const cleaned = [];
  let removedPrefix = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const normalized = normalizeToken(token);
    if (!normalized) continue;

    if (!cleaned.length && PERSONAL_PREFIXES.has(normalized)) {
      removedPrefix = true;
      continue;
    }

    if (!cleaned.length && (normalized === "AND" || normalized === "OR")) {
      continue;
    }

    if (normalized === "ET") {
      const next = normalizeToken(tokens[i + 1]);
      const nextNext = normalizeToken(tokens[i + 2]);
      if (next === "UX" || next === "VIR") {
        i += 1;
        continue;
      }
      if (next === "AL" && nextNext === "IA") {
        i += 2;
        continue;
      }
      if (next === "ALIA" || next === "ALIAS") {
        i += 1;
        continue;
      }
    }

    if (QUALIFIER_TOKENS.has(normalized)) {
      continue;
    }

    cleaned.push(token);
  }

  return {
    value: cleaned.join(" ").trim(),
    removedPrefix,
  };
}

function splitOwnerSegments(raw) {
  if (!raw) return [];
  const replacedNewlines = raw.replace(/<br\s*\/?>/gi, "|").replace(/[\r\n]+/g, "|");
  const textOnly = cleanWhitespace(cheerio.load(`<span>${replacedNewlines}</span>`).text());
  if (!textOnly) return [];

  const primary = textOnly
    .split(/\s*\|\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const expanded = [];
  primary.forEach((segment) => {
    const andSplit = segment
      .replace(/\s+and\s+/gi, "|")
      .replace(/\s+&\s+/g, "|")
      .split(/\s*\|\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (andSplit.length) {
      expanded.push(...andSplit);
    } else {
      expanded.push(segment);
    }
  });

  return expanded;
}

function parsePersonFromTokens(tokens, options) {
  const { original, invalid_owners, fallbackLast, removedPrefix } = options;
  const working = [...tokens];
  const fallbackNorm = fallbackLast ? fallbackLast.toLowerCase() : null;

  if (working.length === 0) {
    invalid_owners.push({
      raw: original,
      reason: "name_empty_after_scrub",
    });
    return null;
  }

  if (working.length === 1) {
    if (fallbackNorm) {
      return {
        type: "person",
        first_name: cap(working[0]),
        last_name: cap(fallbackLast),
        middle_name: null,
      };
    }
    invalid_owners.push({
      raw: original,
      reason: "insufficient_tokens_for_person",
    });
    return null;
  }

  let first = null;
  let last = null;
  let middle = null;

  if (
    fallbackNorm &&
    working[working.length - 1].toLowerCase() === fallbackNorm &&
    working.length >= 2
  ) {
    last = working.pop();
    first = working.shift();
    middle = working.length ? working.join(" ") : null;
  } else if (removedPrefix) {
    first = working.shift();
    last = working.pop();
    middle = working.length ? working.join(" ") : null;
  } else {
    last = working.shift();
    first = working.shift();
    middle = working.length ? working.join(" ") : null;
  }

  if (!first || !last) {
    invalid_owners.push({
      raw: original,
      reason: "unable_to_parse_person_name",
    });
    return null;
  }

  return {
    type: "person",
    first_name: cap(first),
    last_name: cap(last),
    middle_name: middle ? cap(middle) : null,
  };
}

// Property ID extraction with fallbacks
function getPropertyId() {
  let id = $('span[id*="PARCEL_KEYLabel"]').first().text().trim();
  if (!id) {
    id = $("#parcelKey").text().trim();
  }
  if (!id) {
    id = $("input#hidParcelKey").attr("value") || "";
  }
  if (!id) {
    $(".value-pair").each((i, pair) => {
      const label = cleanWhitespace($(pair).find(".parcel-label").text());
      if (/parcel\s*key/i.test(label)) {
        id = cleanWhitespace($(pair).find(".parcel-value").text());
        return false;
      }
      return undefined;
    });
  }
  if (!id) {
    // try to find in details table near text 'Parcel Key:'
    $("table").each((i, tbl) => {
      const html = $(tbl).html() || "";
      if (html.includes("Parcel Key")) {
        const span = $(tbl).find("span").first();
        if (span.length) {
          id = span.text().trim();
        }
      }
    });
  }
  return id || "unknown_id";
}

// Company detection
function isCompanyName(name) {
  const n = name.toLowerCase();
  const patterns = [
    " inc",
    "inc.",
    " llc",
    "l.l.c",
    " ltd",
    " co ",
    " co.",
    " company",
    " corp",
    "corp.",
    "corporation",
    " foundation",
    " alliance",
    " solutions",
    " services",
    " trust",
    " trustees",
    " bank",
    " national",
    " holdings",
    " properties",
    " group",
    " llp",
    " lp ",
    " pllc",
    " plc",
    " pc ",
    " association",
    " church",
    " ministries",
  ];
  return patterns.some((p) => n.includes(p));
}

// Parse date MM/DD/YYYY to YYYY-MM-DD; return null if invalid
function toISODate(input) {
  const s = (input || "").trim();
  if (!s) return null;
  const slash = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) {
    const [_, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm}-${dd}`;
  }
  const dash = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dash) {
    const [_, yyyy, mm, dd] = dash;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

// Name classification
function classifyOwner(raw, invalid_owners, options = {}) {
  const { allowSplit = true, fallbackLast = null } = options;
  const original = cleanWhitespace(raw);
  if (!original) return null;

  const normalizedName = original.replace(/\s+/g, " ").trim();
  if (isCompanyName(" " + normalizedName + " ")) {
    return { type: "company", name: normalizedName };
  }

  if (allowSplit) {
    const segments = splitOwnerSegments(raw);
    if (segments.length > 1) {
      const entities = [];
      let rollingLast = fallbackLast;
      segments.forEach((segment) => {
        const classified = classifyOwner(segment, invalid_owners, {
          allowSplit: false,
          fallbackLast: rollingLast,
        });
        if (!classified) return;
        if (Array.isArray(classified)) {
          classified.forEach((entry) => {
            entities.push(entry);
            if (entry.type === "person" && entry.last_name) {
              rollingLast = entry.last_name;
            } else if (entry.type === "company") {
              rollingLast = null;
            }
          });
        } else {
          entities.push(classified);
          if (classified.type === "person" && classified.last_name) {
            rollingLast = classified.last_name;
          } else if (classified.type === "company") {
            rollingLast = null;
          }
        }
      });
      if (entities.length) return entities;
    }
  }

  if (allowSplit && /,/.test(original)) {
    const commaParts = original
      .split(/\s*,\s*/)
      .map((part) => cleanWhitespace(part))
      .filter(Boolean);
    if (commaParts.length > 1) {
      const trialInvalid = [];
      const trialResults = [];
      let rollingLast = fallbackLast;
      let success = true;
      for (let i = 0; i < commaParts.length; i += 1) {
        const part = commaParts[i];
        const result = classifyOwner(part, trialInvalid, {
          allowSplit: false,
          fallbackLast: rollingLast,
        });
        if (!result || Array.isArray(result)) {
          success = false;
          break;
        }
        trialResults.push(result);
        if (result.type === "person" && result.last_name) {
          rollingLast = result.last_name;
        } else if (result.type === "company") {
          rollingLast = null;
        }
      }
      if (success && trialResults.length > 1) {
        trialInvalid.forEach((entry) => invalid_owners.push(entry));
        return trialResults;
      }
    }
  }

  const cleaned = original.replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const { value: noQual, removedPrefix } = scrubPersonalName(cleaned);
  const tokens = noQual.split(/\s+/).filter(Boolean);

  const person = parsePersonFromTokens(tokens, {
    original,
    invalid_owners,
    fallbackLast,
    removedPrefix,
  });

  return person;
}

function cap(s) {
  if (!s) return s;
  return s
    .split(/\s+/)
    .map((w) =>
      w
        .split(/([-'])/)
        .map((part) =>
          part === "-" || part === "'"
            ? part
            : part.length
            ? part[0].toUpperCase() + part.slice(1).toLowerCase()
            : part,
        )
        .join(""),
    )
    .join(" ");
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  owners.forEach((o) => {
    if (!o) return;
    const key =
      o.type === "company"
        ? `company:${normalize(o.name)}`
        : `person:${normalize(o.first_name)}:${normalize(o.middle_name || "")}:${normalize(o.last_name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(o);
  });
  return out;
}

// Extract current owners
function getCurrentOwners(invalid_owners) {
  const ownerStrings = [];

  const legacySpans = $('span[id*="OWNER_NAMELabel"]')
    .map((i, el) => cleanWhitespace($(el).text()))
    .get()
    .filter(Boolean);
  if (legacySpans.length) {
    ownerStrings.push(...legacySpans);
  }

  if (!ownerStrings.length) {
    const ownerSpan = $("#ownerName");
    if (ownerSpan.length) {
      const ownerHtml = ownerSpan.html() || "";
      if (/<br\s*\/?>/i.test(ownerHtml)) {
        ownerHtml
          .split(/<br\s*\/?>/i)
          .map((fragment) => cleanWhitespace(cheerio.load(`<span>${fragment}</span>`).text()))
          .filter(Boolean)
          .forEach((value) => ownerStrings.push(value));
      } else {
        const ownerText = cleanWhitespace(ownerSpan.text());
        if (ownerText) ownerStrings.push(ownerText);
      }
    }
  }

  if (!ownerStrings.length) {
    const cell = $("#MainContent_gvParcelResults tr").eq(1).find("td").eq(2);
    if (cell && cell.length) {
      const raw = cleanWhitespace(cell.text());
      if (raw) {
        const parts = raw
          .split(/\s*,\s*/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) {
          ownerStrings.push(...parts);
        } else {
          ownerStrings.push(raw);
        }
      }
    }
  }

  const parsed = [];
  ownerStrings.forEach((name) => {
    const classified = classifyOwner(name, invalid_owners);
    if (Array.isArray(classified)) {
      parsed.push(...classified);
    } else if (classified) {
      parsed.push(classified);
    }
  });
  return dedupeOwners(parsed);
}

// Extract historical owners from Sales table (Grantee by Sale Date)
function getHistoricalOwnersByDate(invalid_owners) {
  let rows = $("#MainContent_frmParcelDetail_gvSales tr").slice(1);
  let dateIdx = 0;
  let granteeIdx = -1;

  if (rows.length) {
    const headerCells = $("#MainContent_frmParcelDetail_gvSales tr").first().find("th");
    if (headerCells.length) {
      const headers = headerCells
        .map((i, el) => cleanWhitespace($(el).text()).toLowerCase())
        .get();
      dateIdx = headers.findIndex((h) => /date/.test(h));
      granteeIdx = headers.findIndex((h) => /(grantee|buyer|purchaser|owner)/.test(h));
    }
    if (dateIdx < 0) dateIdx = 0;
  }

  if (!rows.length) {
    rows = $("#salesTable tbody tr");
    if (rows.length) {
      const headerCells = $("#salesTable thead tr").first().find("th");
      const headers = headerCells
        .map((i, el) => cleanWhitespace($(el).text()).toLowerCase())
        .get();
      dateIdx = headers.findIndex((h) => /date/.test(h));
      granteeIdx = headers.findIndex((h) => /(grantee|buyer|purchaser|owner)/.test(h));
      if (dateIdx < 0) dateIdx = 0;
    }
  }

  if (!rows.length || granteeIdx === -1) {
    return {};
  }

  const groups = {};
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;
    if (dateIdx >= tds.length || granteeIdx >= tds.length) return;
    const dateStr = text(tds.eq(dateIdx));
    const iso = toISODate(dateStr);
    const granteeCell = tds.eq(granteeIdx);
    const granteeHtml = granteeCell.html() || "";
    const granteeRaw = text(granteeCell);
    if (!granteeRaw) return;
    const key =
      iso ||
      `unknown_date_${Object.keys(groups).filter((k) => k.startsWith("unknown_date_")).length + 1}`;

    const segmented = splitOwnerSegments(
      granteeHtml || granteeRaw,
    );
    const nameParts = segmented.length ? segmented : [granteeRaw];

    const owners = groups[key] || [];
    nameParts.forEach((g) => {
      const classified = classifyOwner(g, invalid_owners);
      if (Array.isArray(classified)) {
        owners.push(...classified);
      } else if (classified) {
        owners.push(classified);
      }
    });
    groups[key] = dedupeOwners(owners);
  });

  // Sort keys chronologically (unknown placeholders come first based on numbering)
  const dated = Object.keys(groups)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  const unknowns = Object.keys(groups)
    .filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D+/g, "")) || 0;
      const nb = parseInt(b.replace(/\D+/g, "")) || 0;
      return na - nb;
    });
  const ordered = [...dated, ...unknowns];
  const orderedMap = {};
  ordered.forEach((k) => {
    orderedMap[k] = groups[k];
  });
  return orderedMap;
}

// Build final structure
const invalid_owners = [];
const propertyId = getPropertyId();
const currentOwners = getCurrentOwners(invalid_owners);
const historical = getHistoricalOwnersByDate(invalid_owners);

// Assemble owners_by_date with chronological dates first, then current
const owners_by_date = {};
Object.keys(historical).forEach((k) => {
  owners_by_date[k] = historical[k];
});
owners_by_date["current"] = currentOwners;

const result = {
  [`property_${propertyId}`]: {
    owners_by_date,
    invalid_owners: invalid_owners,
  },
};

// Save and print
fs.mkdirSync(path.dirname("owners/owner_data.json"), { recursive: true });
fs.writeFileSync(
  "owners/owner_data.json",
  JSON.stringify(result, null, 2),
  "utf-8",
);
console.log(JSON.stringify(result, null, 2));
