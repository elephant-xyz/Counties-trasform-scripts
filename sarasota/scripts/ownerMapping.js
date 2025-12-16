const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const html = fs.readFileSync("input.html", "utf-8");
const $ = cheerio.load(html);

const COMPANY_KEYWORDS = [
  'LLC',
  'INC',
  'LTD',
  'CO',
  'COMPANY',
  'CORP',
  'CORPORATION',
  'BANK',
  'FUND',
  'TRUST',
  'PARTNERSHIP',
  'PARTNERS',
  'ASSOCIATES',
  'LP',
  'LLP',
  'LLLP',
  'PLC',
  'GROUP',
  'HOLDINGS',
  'INVESTMENTS',
  'PROPERTIES',
  'DEVELOPMENT',
];

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


function parseSalesOwners($) {
  const propertyId = extractPropertyId($);
  const salesTable = findTableByHeading($, 'Sales & Transfers');

  if (!propertyId || !salesTable.length) {
    return {};
  }

  const ownersByDate = {};

  const bodyRows = salesTable.find('tbody tr');
  const rows = bodyRows.length ? bodyRows : salesTable.find('tr').slice(1);

  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) {
      return;
    }

    const rawDate = cells.eq(0).text().trim();
    const isoDate = toIsoDate(rawDate);
    if (!isoDate) {
      return;
    }

    const grantorText = cells.eq(4).text().replace(/\s+/g, ' ').trim();
    const owners = deduplicateOwners(parseGrantorOwners(grantorText));
    if (!owners.length) {
      return;
    }

    ownersByDate[isoDate] = owners;
  });

  const latestDate = Object.keys(ownersByDate).sort().pop();
  if (latestDate) {
    ownersByDate.current = ownersByDate[latestDate].map((owner) => ({ ...owner }));
  }

  return {
    [`property_${propertyId}`]: {
      owners_by_date: ownersByDate,
    },
  };
}

function findTableByHeading($, headingText) {
  return $('span.h2')
    .filter((_, el) => $(el).text().trim().startsWith(headingText))
    .first()
    .nextAll('table')
    .first();
}

function extractPropertyId($) {
  const label = $('.large.bold').first().text();
  const match = label.match(/(\d{6,})$/);
  return match ? match[1] : null;
}

function toIsoDate(rawDate) {
  if (!rawDate) {
    return null;
  }

  const match = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseGrantorOwners(grantorText) {
  if (!grantorText) {
    return [];
  }

  const segments = splitOwnerSegments(grantorText);
  return segments
    .map((segment) => {
      const cleaned = cleanOwnerText(segment);
      if (!cleaned) {
        return null;
      }
      if (isCompany(cleaned)) {
        return { type: 'company', name: cleaned };
      }
      const person = parsePersonName(cleaned);
      return person ? { type: 'person', ...person } : null;
    })
    .filter(Boolean);
}

function deduplicateOwners(owners) {
  if (!Array.isArray(owners) || owners.length <= 1) {
    return owners || [];
  }

  const seen = new Set();
  const unique = [];

  owners.forEach((owner) => {
    const key = ownerKey(owner);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(owner);
  });

  return unique;
}

function ownerKey(owner) {
  if (!owner || typeof owner !== 'object') {
    return null;
  }
  if (owner.type === 'company') {
    return `company:${(owner.name || '').toUpperCase()}`;
  }
  if (owner.type === 'person') {
    return [
      'person',
      (owner.first_name || '').toUpperCase(),
      (owner.middle_name || '').toUpperCase(),
      (owner.last_name || '').toUpperCase(),
      (owner.suffix || '').toUpperCase(),
    ].join(':');
  }
  return null;
}

function splitOwnerSegments(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?:\s+(?:&|AND|\+)\s+|\/|;)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanOwnerText(text) {
  if (!text) {
    return '';
  }
  let cleaned = text.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\s+\d+(?:\.\d+)?%$/, '');
  cleaned = cleaned.replace(/[,\-]+$/, '').trim();
  return cleaned;
}

function isCompany(text) {
  if (!text) {
    return false;
  }
  const upper = text.toUpperCase();

  if (/[0-9]/.test(upper)) {
    return true;
  }

  return COMPANY_KEYWORDS.some((keyword) => {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    return pattern.test(upper);
  });
}

function parsePersonName(text) {
  if (!text) {
    return null;
  }

  const cleaned = text.replace(/\./g, '').trim();
  const commaParts = cleaned.split(',');

  if (commaParts.length === 2) {
    const last = commaParts[0].trim();
    const restTokens = commaParts[1].trim().split(/\s+/).filter(Boolean);
    if (!restTokens.length) {
      return null;
    }
    return buildPersonFields(last, restTokens);
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return null;
  }

  const [lastName, ...remaining] = tokens;
  return buildPersonFields(lastName, remaining);
}

function buildPersonFields(lastName, restTokens) {
  if (!restTokens.length) {
    return null;
  }

  const firstName = restTokens.shift();
  if (!firstName) {
    return null;
  }

  const middle = restTokens.map(TitleCase).join(' ');

  const result = {
    first_name: TitleCase(cleanInvalidCharsFromName(firstName)),
    last_name: TitleCase(cleanInvalidCharsFromName(lastName)),
  };

  if (middle && TitleCase(cleanInvalidCharsFromName(middle))) {
    result.middle_name = TitleCase(cleanInvalidCharsFromName(middle));
  }
  if (result.first_name && result.last_name) {
    return result
  }
  return null;
}

function TitleCase(value) {
  if (!value) {
    return value;
  }
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// output[`property_${propertyId}`] = { owners_by_date: finalOwnersByDate };
// output["invalid_owners"] = invalid_owners;

// Ensure output directory and write file
const output = parseSalesOwners($);
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

// Print JSON to stdout
console.log(JSON.stringify(output, null, 2));
