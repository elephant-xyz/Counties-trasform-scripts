const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input
const input = JSON.parse(fs.readFileSync("input.json", "utf8"));

// Helpers
const toISODate = (s) => {
  if (!s) return null;
  const m = s.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const y = parseInt(yyyy, 10);
  const month = String(parseInt(mm, 10)).padStart(2, "0");
  const day = String(parseInt(dd, 10)).padStart(2, "0");
  if (y < 1901) return null; // treat placeholder 1900 dates as unknown
  return `${yyyy}-${month}-${day}`;
};

const normalize = (s) => (s || "").replace(/\s+/g, " ").trim();

const normalizeOwnerNameLine = (line) => {
  if (!line) return "";
  let normalized = line.replace(/\u00a0/g, " ");
  normalized = normalized.replace(/[﹠＆]/g, "&");
  normalized = normalized.replace(/[’‘‛`]/g, "'");
  normalized = normalized.replace(/\bAND\/OR\b/gi, " & ");
  normalized = normalized.replace(/\bAND\b/gi, " & ");
  normalized = normalized.replace(/\bY\b/gi, " & ");
  normalized = normalized.replace(/\bET\b/gi, " & ");
  normalized = normalized.replace(/\s[-–—]{1,2}\s/g, " & ");
  normalized = normalized.replace(
    /([A-Za-z0-9])([+＋/\\|•·∙‧*])([A-Za-z0-9])/g,
    "$1 & $3",
  );
  normalized = normalized.replace(/[+＋/\\|•·∙‧*]/g, " & ");
  normalized = normalized.replace(/[,;:(){}\[\]<>]/g, " ");
  normalized = normalized.replace(/\s*&\s*/g, " & ");
  normalized = normalized.replace(/\s+/g, " ");
  return normalize(normalized);
};

const cleanPersonToken = (token) => {
  if (!token) return "";
  return token
    .replace(/[’‘‛`]/g, "'")
    .replace(/^[^0-9A-Za-z'\\-]+/, "")
    .replace(/[^0-9A-Za-z'\\-]+$/, "");
};

const sanitizeOutputName = (value) => {
  if (!value) return "";
  const cleaned = value.replace(/[^0-9A-Za-z]+/g, " ");
  return normalize(cleaned);
};

const isLikelyAddressLine = (line) => {
  const s = line.toUpperCase();
  // Check for company indicators first - if it's a company name, it's not an address
  if (companyIndicators.some((ind) => {
    const pattern = new RegExp(`(^|[^A-Z])${ind}([^A-Z]|$)`);
    return pattern.test(s);
  })) {
    return false;
  }
  // Street address patterns (number followed by street name)
  if (/^\d+\s+[A-Z]/.test(s)) return true;
  // PO Box
  if (/P\.?O\.?\s*BOX/i.test(s)) return true;
  // City, State ZIP pattern
  if (/,\s*(TX|TEXAS)\s*\d{5}/i.test(s)) return true;
  if (s.includes(",") && /(TEXAS|TX)/.test(s)) return true;
  // Just a ZIP code
  if (/^\d{5}(-\d{4})?$/.test(s.trim())) return true;
  return false;
};

const companyIndicators = [
  "INC",
  "LLC",
  "L.L.C",
  "LTD",
  "LIMITED",
  "FOUNDATION",
  "ALLIANCE",
  "SOLUTIONS",
  "CORP",
  "CO",
  "COMPANY",
  "SERVICES",
  "SERVICE",
  "TRUST",
  "TTEE",
  "TR",
  "ASSN",
  "ASSOCIATION",
  "PARTNERS",
  "PARTNERSHIP",
  "LP",
  "LLP",
  "PLLC",
  "PC",
  "P.C.",
  "HOLDINGS",
  "HOLDING",
  "GROUP",
  // Organizations and institutions
  "UNIVERSITY",
  "COLLEGE",
  "SCHOOL",
  "DISTRICT",
  "BOARD",
  "CHURCH",
  "HOSPITAL",
  "COUNTY",
  "CITY OF",
  "STATE OF",
  "BANK",
  "CREDIT UNION",
  "GOVERNMENT",
  "AUTHORITY",
  "COMMISSION",
  "DEPARTMENT",
  "MINISTRY",
  "INSTITUTE",
  "INSTITUTION",
  "COUNCIL",
  "COMMITTEE",
  "AGENCY",
  "BUREAU",
  "ADMINISTRATION",
  "FUND",
  "ESTATE OF",
  "TRUSTEES",
];

const isCompany = (raw) => {
  const s = (raw || "").toUpperCase();
  return companyIndicators.some((ind) => {
    const pattern = new RegExp(`(^|[^A-Z])${ind}([^A-Z]|$)`);
    return pattern.test(s);
  });
};

const buildPerson = (last, first, middle) => {
  const obj = {
    type: "person",
    first_name: sanitizeOutputName(first),
    last_name: sanitizeOutputName(last),
  };
  const mid = sanitizeOutputName(middle || "");
  if (mid) obj.middle_name = mid;
  return obj;
};

// Parse a single person-like owner name in LAST FIRST [MIDDLE] ordering
const parsePersonName = (raw, inferredLast) => {
  const cleaned = normalize(
    raw.replace(/\s*&\s*$/, "").replace(/\s*&\s*/g, " "),
  );
  const parts = cleaned
    .split(/\s+/)
    .map((part) => cleanPersonToken(part))
    .filter(Boolean);
  if (parts.length === 1) {
    if (inferredLast) return buildPerson(inferredLast, parts[0], null);
    return null;
  }
  if (inferredLast && parts.length <= 2) {
    const [first, middle] = parts;
    return buildPerson(inferredLast, first, middle || null);
  }
  const last = parts[0];
  const first = parts[1] || "";
  const middle = parts.slice(2).join(" ") || null;
  if (!first || !last) return null;
  return buildPerson(last, first, middle);
};

const makeCompany = (name) => ({
  type: "company",
  name: sanitizeOutputName(name.replace(/\s*&\s*$/, "")),
});

// Given HTML that contains owner lines with <br>, extract name lines (exclude address)
const extractNameLinesFromHtml = (html) => {
  const tmp = cheerio.load(`<div class="x">${html}</div>`);
  tmp("br").replaceWith("\n");
  const text = tmp(".x").text();
  const allLines = text
    .split(/\n|\r/)
    .map((l) => normalize(l))
    .filter((l) => l);
  const nameLines = [];
  for (let i = 0; i < allLines.length; i++) {
    const ln = allLines[i];
    if (isLikelyAddressLine(ln)) break;
    nameLines.push(ln);
  }
  return nameLines;
};

// Convert name lines array into array of owner objects or raw strings when invalid
const parseOwnersFromNameLines = (nameLines) => {
  const owners = [];
  const invalid = [];

  if (nameLines.length === 0) return { owners, invalid };

  const lines = nameLines
    .map((line) => normalizeOwnerNameLine(line))
    .filter((line) => line);

  if (lines.length >= 2 && /&\s*$/.test(lines[0])) {
    const left = normalize(lines[0].replace(/&\s*$/, ""));
    const right = lines[1];
    if (isCompany(left)) {
      owners.push(makeCompany(left));
    } else {
      const p1 = parsePersonName(left, null);
      if (p1) owners.push(p1);
      else
        invalid.push({
          raw: left,
          reason: "unable_to_parse_person_from_ampersand_line",
        });
    }
    if (isCompany(right)) {
      owners.push(makeCompany(right));
    } else {
      const p2 = parsePersonName(right, null);
      if (p2) owners.push(p2);
      else
        invalid.push({
          raw: right,
          reason: "unable_to_parse_person_from_second_line",
        });
    }
    for (let i = 2; i < lines.length; i++) {
      const extra = lines[i];
      if (isCompany(extra)) {
        owners.push(makeCompany(extra));
      } else {
        const p = parsePersonName(extra, null);
        if (p) owners.push(p);
        else
          invalid.push({
            raw: extra,
            reason: "unable_to_parse_additional_line",
          });
      }
    }
    return { owners, invalid };
  }

  if (lines.length === 1 && lines[0].includes("&")) {
    const parts = lines[0]
      .split("&")
      .map((s) => normalize(s))
      .filter(Boolean);
    if (parts.length >= 2) {
      const left = parts[0];
      const right = parts[1];
      const leftIsCompany = isCompany(left);
      const rightIsCompany = isCompany(right);
      if (leftIsCompany) owners.push(makeCompany(left));
      if (rightIsCompany) owners.push(makeCompany(right));
      if (!leftIsCompany) {
        const pLeft = parsePersonName(left, null);
        if (pLeft) owners.push(pLeft);
        else invalid.push({ raw: left, reason: "unable_to_parse_left_person" });
      }
      if (!rightIsCompany) {
        const leftTokens = left.split(/\s+/);
        const inferredLast = leftTokens[0] || null;
        const pRight = parsePersonName(right, inferredLast);
        if (pRight) owners.push(pRight);
        else
          invalid.push({ raw: right, reason: "unable_to_parse_right_person" });
      }
      return { owners, invalid };
    }
  }

  if (lines.length > 1) {
    for (const l of lines) {
      if (isCompany(l)) {
        owners.push(makeCompany(l));
      } else {
        const p = parsePersonName(l, null);
        if (p) owners.push(p);
        else invalid.push({ raw: l, reason: "unable_to_classify_line" });
      }
    }
    return { owners, invalid };
  }

  const single = lines[0];
  if (isCompany(single)) {
    owners.push(makeCompany(single));
  } else {
    const p = parsePersonName(single, null);
    if (p) owners.push(p);
    else invalid.push({ raw: single, reason: "unable_to_parse_single_line" });
  }
  return { owners, invalid };
};

const normalizeOwnerKey = (owner) => {
  if (!owner) return "";
  if (owner.type === "company") return `company:${owner.name}`.toLowerCase();
  const mid = owner.middle_name ? ` ${owner.middle_name}` : "";
  return `person:${owner.first_name}${mid} ${owner.last_name}`.toLowerCase();
};

const dedupeOwners = (owners) => {
  const map = new Map();
  for (const o of owners) {
    const key = normalizeOwnerKey(o);
    if (key && !map.has(key)) map.set(key, o);
  }
  return Array.from(map.values());
};

// Extract current owners from main page using DOM sibling traversal
const mainHtml =
  input.OwnersAndGeneralInformation &&
  input.OwnersAndGeneralInformation.response
    ? input.OwnersAndGeneralInformation.response
    : "";
const $main = cheerio.load(mainHtml);

const extractFollowingTextLines = ($, el, maxLines = 8) => {
  const lines = [];
  let buf = "";
  let node = el.nextSibling;
  while (node && lines.length < maxLines) {
    if (node.type === "tag") {
      const name = node.name ? node.name.toLowerCase() : "";
      if (name === "br") {
        const text = normalize(buf);
        if (text) lines.push(text);
        buf = "";
      } else if (name === "a") {
        break;
      } else if (name === "span" && $(node).hasClass("DtlSectionHdr")) {
        break;
      } else if (name === "table") {
        break;
      } else {
        buf += $(node).text();
      }
    } else if (node.type === "text" && node.data) {
      buf += node.data;
    }
    node = node.nextSibling;
  }
  const tail = normalize(buf);
  if (tail) lines.push(tail);
  const nameLines = [];
  const addressLines = [];
  let foundAddressStart = false;
  for (const ln of lines.map((l) => normalize(l)).filter(Boolean)) {
    if (isLikelyAddressLine(ln)) {
      foundAddressStart = true;
      addressLines.push(ln);
    } else if (!foundAddressStart) {
      nameLines.push(ln);
    } else {
      addressLines.push(ln);
    }
  }
  return { nameLines, addressLines };
};

// Property ID extraction
const extractPropertyId = () => {
  const body =
    (input.OwnersAndGeneralInformation &&
      input.OwnersAndGeneralInformation.source_http_request &&
      input.OwnersAndGeneralInformation.source_http_request.body) ||
    "";
  const m1 = body.match(/parid=([0-9A-Za-z]+)/i);
  if (m1) return m1[1];
  const mvqs =
    (input.OwnersAndGeneralInformation &&
      input.OwnersAndGeneralInformation.source_http_request &&
      input.OwnersAndGeneralInformation.source_http_request
        .multiValueQueryString &&
      input.OwnersAndGeneralInformation.source_http_request
        .multiValueQueryString.ID) ||
    null;
  if (mvqs && mvqs[0]) return mvqs[0];
  const titleSpan = $main("#lblPageTitle").text() || "";
  const m2 = titleSpan.match(/#\s*([0-9A-Za-z]+)/);
  if (m2) return m2[1];
  const mvqs2 =
    (input.History &&
      input.History.source_http_request &&
      input.History.source_http_request.multiValueQueryString &&
      input.History.source_http_request.multiValueQueryString.ID) ||
    null;
  if (mvqs2 && mvqs2[0]) return mvqs2[0];
  return "unknown_id";
};

const propertyId = extractPropertyId();

let currentNameLines = [];
let mailingAddressLines = [];
let invalidOwnersOverall = [];

$main("#lblOwner").each((i, el) => {
  if (currentNameLines.length) return;
  const result = extractFollowingTextLines($main, el, 8);
  currentNameLines = result.nameLines;
  mailingAddressLines = result.addressLines;
});

const { owners: currentOwnersRaw, invalid: invalidCurrent } =
  parseOwnersFromNameLines(currentNameLines);
const currentOwners = dedupeOwners(currentOwnersRaw.filter(Boolean));
invalidOwnersOverall = [...invalidCurrent];

// Build mailing address string from address lines
const mailingAddress = mailingAddressLines.length > 0 ? mailingAddressLines.join(", ") : null;

// Parse history page owner/date groups
const histHtml =
  input.History && input.History.response ? input.History.response : "";
const $hist = cheerio.load(histHtml);

const $historyTable = $hist("#pnlOwnHist table").first();

const dateGroups = new Map(); // dateKey => { owners: [], years: [] }
const unknownGroups = new Map(); // signature => { owners: [], years: [] }

if ($historyTable && $historyTable.length) {
  $historyTable.find("th").each((_, th) => {
    const yearText = normalize($hist(th).text());
    if (!/^\d{4}$/.test(yearText)) return;
    const year = parseInt(yearText, 10);
    const ownerTd = $hist(th).next("td");
    const legalTd = ownerTd.next("td");
    if (ownerTd && ownerTd.length) {
      const ownerHtml = ownerTd.html() || "";
      const lines = extractNameLinesFromHtml(ownerHtml);
      const { owners, invalid } = parseOwnersFromNameLines(lines);
      if (invalid && invalid.length) invalidOwnersOverall.push(...invalid);
      const ownersDeduped = dedupeOwners(owners);
      let dateKey = null;
      if (legalTd && legalTd.length) {
        const legalHtml = legalTd.html() || "";
        const mdate = legalHtml.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (mdate) dateKey = toISODate(mdate[1]);
      }
      if (ownersDeduped.length) {
        if (dateKey) {
          if (!dateGroups.has(dateKey))
            dateGroups.set(dateKey, { owners: [], years: [] });
          const entry = dateGroups.get(dateKey);
          entry.owners = dedupeOwners([...entry.owners, ...ownersDeduped]);
          entry.years.push(year);
        } else {
          const sig = ownersDeduped
            .map((o) => normalizeOwnerKey(o))
            .sort()
            .join("|");
          if (!unknownGroups.has(sig))
            unknownGroups.set(sig, { owners: ownersDeduped, years: [] });
          const entry = unknownGroups.get(sig);
          entry.years.push(year);
        }
      }
    }
  });
}

// Build chronological map
const ownersByDate = {};

const unknownList = Array.from(unknownGroups.values()).map((g) => ({
  owners: g.owners,
  minYear: Math.min(...g.years),
}));
unknownList.sort((a, b) => a.minYear - b.minYear);

const knownList = Array.from(dateGroups.entries()).map(([dateKey, g]) => ({
  dateKey,
  owners: g.owners,
  minYear: Math.min(...g.years),
}));
knownList.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

let placeholderCounter = 1;
const combined = [];
let iUnknown = 0;
let iKnown = 0;

while (iUnknown < unknownList.length || iKnown < knownList.length) {
  if (iUnknown >= unknownList.length) {
    combined.push({
      key: knownList[iKnown].dateKey,
      owners: knownList[iKnown].owners,
    });
    iKnown++;
  } else if (iKnown >= knownList.length) {
    const key = `unknown_date_${placeholderCounter++}`;
    combined.push({ key, owners: unknownList[iUnknown].owners });
    iUnknown++;
  } else {
    const unk = unknownList[iUnknown];
    const kn = knownList[iKnown];
    if (unk.minYear <= kn.minYear) {
      const key = `unknown_date_${placeholderCounter++}`;
      combined.push({ key, owners: unk.owners });
      iUnknown++;
    } else {
      combined.push({ key: kn.dateKey, owners: kn.owners });
      iKnown++;
    }
  }
}

for (const entry of combined) {
  ownersByDate[entry.key] = dedupeOwners(entry.owners);
}

ownersByDate["current"] = currentOwners;

const result = {};
result[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwnersOverall,
  mailing_address: mailingAddress,
};

const outDir = path.join("owners");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(JSON.stringify(result));
