// ownerMapping.js
// Transform input.html into owners/owner_data.json using cheerio only for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: normalize a string's whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Helper: extract visible text including <br> as newlines
function textWithBreaks($el) {
  const parts = [];
  $el.contents().each((_, node) => {
    if (node.type === "text") parts.push(node.data);
    else if (node.name === "br") parts.push("\n");
    else if (node.type === "tag") parts.push(textWithBreaks($(node)));
  });
  return parts.join("");
}

// Heuristic: find parcel/property ID
function extractPropertyId($) {
  // 1) explicit hidden inputs commonly used
  const formatPIN = $('input[name="formatPIN"]').attr("value");
  if (formatPIN && norm(formatPIN)) return norm(formatPIN);

  const pin = $('input[name="PIN"]').attr("value");
  if (pin && norm(pin)) return norm(pin);

  const parcelIdBuffer = $('input[name="PARCELID_Buffer"]').attr("value");
  if (parcelIdBuffer && norm(parcelIdBuffer)) return norm(parcelIdBuffer);

  // 2) Text near "Parcel:" label
  let idFromParcel = null;
  // Updated selector to directly target the bold text within the parcelIDtable
  const boldParcelText = $(".parcelIDtable b").first().text().trim();
  if (boldParcelText) {
    // e.g., 23-4S-16-03099-117 (14877)
    const m = boldParcelText.match(/^([^\s(]+)/);
    if (m) idFromParcel = m[1];
  }
  if (idFromParcel) return idFromParcel;

  // 3) Fallback unknown
  return "unknown_id";
}

// Heuristic: detect company names
function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  // direct boundary checks for common suffixes/patterns
  if (
    /\b(incorporated|inc|inc\.|corp|corporation|corp\.|co|co\.|ltd|limited|ltd\.|llc|l\.l\.c\.|plc|plc\.|pc|p\.c\.|pllc|trust|tr|n\.?a\.?|bank|foundation|alliance|solutions|services|associates|association|holdings|partners|properties|enterprises|management|investments|group|development)\b\.?/.test(
      n,
    )
  ) {
    return true;
  }
  return false;
}

// Normalize for deduplication
function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") {
    return norm(owner.name)
      .toLowerCase()
      .replace(/[.,']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  const parts = [
    owner.prefix_name || "",
    owner.first_name,
    owner.middle_name || "",
    owner.last_name,
    owner.suffix_name || "",
  ]
    .filter(Boolean)
    .join(" ");
  return norm(parts).toLowerCase();
}

function formatNameToPattern(name) {
  if (!name) return null;
  // Replace common digit-to-letter substitutions that appear in data entry errors
  let cleaned = name.trim()
    .replace(/0/g, "O")  // Zero to letter O
    .replace(/1/g, "I")  // One to letter I
    .replace(/3/g, "E")  // Three to letter E
    .replace(/5/g, "S")  // Five to letter S
    .replace(/8/g, "B"); // Eight to letter B

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove any remaining non-letter, non-special-character symbols
  cleaned = cleaned.replace(/[^A-Za-z \-',.]/g, "");

  // Split by special characters while preserving them
  const parts = cleaned.split(/([ \-',.])/);

  // Filter out empty strings and format each part
  const formatted = parts
    .map((part) => {
      if (!part) return "";
      if (part.match(/[ \-',.]/)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join("");

  // Trim the result to remove any leading/trailing whitespace
  let result = formatted.trim();

  // Remove leading non-letter characters to ensure pattern compliance
  // Pattern requires: ^[A-Z][a-zA-Z\s\-',.]*$
  result = result.replace(/^[^A-Za-z]+/, "");

  // Ensure first character is uppercase
  if (result && result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  // Return null if result is empty or doesn't match the required pattern
  if (!result || !/^[A-Z][a-zA-Z\s\-',.]*$/.test(result)) {
    return null;
  }

  return result;
}

function mapPrefixName(token) {
  if (!token) return null;
  const prefixes = {
    MR: "Mr.",
    MRS: "Mrs.",
    MS: "Ms.",
    MISS: "Miss",
    MX: "Mx.",
    DR: "Dr.",
    PROF: "Prof.",
    REV: "Rev.",
    FR: "Fr.",
    SR: "Sr.",
    BR: "Br.",
    CAPT: "Capt.",
    COL: "Col.",
    MAJ: "Maj.",
    LT: "Lt.",
    SGT: "Sgt.",
    HON: "Hon.",
    JUDGE: "Judge",
    RABBI: "Rabbi",
    IMAM: "Imam",
    SHEIKH: "Sheikh",
    SIR: "Sir",
    DAME: "Dame",
  };
  const key = token.replace(/\./g, "").toUpperCase();
  return prefixes[key] || null;
}

function mapSuffixName(token) {
  if (!token) return null;
  const suffixes = {
    JR: "Jr.",
    SR: "Sr.",
    II: "II",
    III: "III",
    IV: "IV",
    PHD: "PhD",
    MD: "MD",
    ESQ: "Esq.",
    JD: "JD",
    LLM: "LLM",
    MBA: "MBA",
    RN: "RN",
    DDS: "DDS",
    DVM: "DVM",
    CFA: "CFA",
    CPA: "CPA",
    PE: "PE",
    PMP: "PMP",
    EMERITUS: "Emeritus",
    RET: "Ret.",
  };
  const key = token.replace(/\./g, "").toUpperCase();
  return suffixes[key] || null;
}

function pushOwner(owner, seenSet, target, invalidOwners, rawSource) {
  if (!owner) return;
  if (owner.type === "person") {
    if (!owner.first_name || !owner.last_name) {
      invalidOwners.push({
        raw: rawSource,
        reason: "person_missing_name_parts",
      });
      return;
    }
    if (!("middle_name" in owner)) owner.middle_name = null;
    if (!("prefix_name" in owner)) owner.prefix_name = null;
    if (!("suffix_name" in owner)) owner.suffix_name = null;
  } else if (owner.type === "company") {
    if (!owner.name) {
      invalidOwners.push({
        raw: rawSource,
        reason: "company_missing_name",
      });
      return;
    }
  } else {
    invalidOwners.push({ raw: rawSource, reason: "unrecognized_type" });
    return;
  }

  const key = normalizeOwnerKey(owner);
  if (!key) {
    invalidOwners.push({ raw: rawSource, reason: "empty_normalized_key" });
    return;
  }
  if (seenSet.has(key)) return;
  seenSet.add(key);
  target.push(owner);
}

// Build owner object(s) from a raw string
function buildOwnersFromRaw(raw) {
  const owners = [];
  const s = norm(raw);
  if (!s) return owners;

  // Exclude lines that clearly are not owner names
  if (/^(c\/o|care of)\b/i.test(s)) return owners; // ignore care-of lines entirely
  if (/^(po box|p\.?o\.? box)/i.test(s)) return owners;

  // If name contains company indicators -> company
  if (isCompanyName(s)) {
    owners.push({ type: "company", name: s });
    return owners;
  }

  // Handle multiple names separated by newlines or specific patterns
  // Split by common separators that indicate multiple people
  const normalizedForNames = s
    .replace(/\s*&\s*/gi, "\n")
    .replace(/\s+\bAND\b\s+/gi, "\n");
  const nameLines = normalizedForNames
    .split(/\n/)
    .map((line) => norm(line))
    .filter(Boolean);

  nameLines.forEach(nameLine => {
    if (isCompanyName(nameLine)) {
      owners.push({ type: "company", name: nameLine });
    } else {
      owners.push(...buildPersonFromSingleName(nameLine));
    }
  });

  return owners;
}

function buildPersonFromSingleName(s) {
  const out = [];
  const cleaned = norm(s.replace(/\s{2,}/g, " "));
  if (!cleaned) return out;

  const lowerClean = cleaned.toLowerCase();
  if (/\bet\s+al\b/.test(lowerClean)) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const commaIndex = cleaned.indexOf(",");

  const tokenize = (value) =>
    value
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const stripPrefix = (tokens) => {
    const prefixes = [];
    while (tokens.length > 0) {
      const mapped = mapPrefixName(tokens[0]);
      if (!mapped) break;
      prefixes.push(mapped);
      tokens.shift();
    }
    return prefixes;
  };

  const stripSuffix = (tokens) => {
    const suffixes = [];
    while (tokens.length > 0) {
      const mapped = mapSuffixName(tokens[tokens.length - 1]);
      if (!mapped) break;
      suffixes.unshift(mapped);
      tokens.pop();
    }
    return suffixes;
  };

  const assemblePerson = ({
    first,
    middle,
    last,
    prefix,
    suffix,
  }) => {
    if (!first || !last) {
      out.push({ type: "company", name: cleaned });
      return;
    }
    const person = {
      type: "person",
      first_name: formatNameToPattern(first),
      last_name: formatNameToPattern(last),
      middle_name: middle ? formatNameToPattern(middle) : null,
      prefix_name: prefix || null,
      suffix_name: suffix || null,
    };
    out.push(person);
  };

  if (commaIndex !== -1) {
    const lastPart = cleaned.slice(0, commaIndex);
    const restPart = cleaned.slice(commaIndex + 1);

    let lastTokens = tokenize(lastPart);
    let restTokens = tokenize(restPart);

    const suffixesFromLast = stripSuffix(lastTokens);
    const prefixesFromRest = stripPrefix(restTokens);
    const suffixesFromRest = stripSuffix(restTokens);

    const first = restTokens.shift();
    const middle = restTokens.length ? restTokens.join(" ") : null;
    const last = lastTokens.join(" ");

    const prefix = prefixesFromRest.length ? prefixesFromRest[0] : null;
    const suffix =
      suffixesFromRest.length
        ? suffixesFromRest[suffixesFromRest.length - 1]
        : suffixesFromLast.length
          ? suffixesFromLast[suffixesFromLast.length - 1]
          : null;

    assemblePerson({ first, middle, last, prefix, suffix });
    return out;
  }

  let tokens = tokenize(cleaned);
  if (tokens.length < 2) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const prefixes = stripPrefix(tokens);
  const suffixes = stripSuffix(tokens);

  if (tokens.length < 2) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const isAllUpper = tokens.every(
    (token) => token === token.toUpperCase(),
  );

  let first = null;
  let last = null;
  let middle = null;

  if (isAllUpper && tokens.length >= 2) {
    last = tokens[0];
    first = tokens[1];
    middle = tokens.slice(2).join(" ") || null;
  } else if (tokens.length === 2) {
    const [firstToken, secondToken] = tokens;
    if (
      firstToken === firstToken.toUpperCase() &&
      secondToken === secondToken.toUpperCase()
    ) {
      last = firstToken;
      first = secondToken;
    } else {
      first = firstToken;
      last = secondToken;
    }
  } else {
    first = tokens[0];
    last = tokens[tokens.length - 1];
    middle = tokens.slice(1, -1).join(" ") || null;
  }

  const prefix = prefixes.length ? prefixes[0] : null;
  const suffix = suffixes.length ? suffixes[suffixes.length - 1] : null;
  assemblePerson({ first, middle, last, prefix, suffix });
  return out;
}

function parseDateToISO(dateText) {
  if (!dateText) return null;
  const m = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = m[1].padStart(2, "0");
  const day = m[2].padStart(2, "0");
  const year = m[3];
  return `${year}-${month}-${day}`;
}

// Extract owner name candidates from the document
function extractOwnerCandidates($) {
  const candidateMap = new Map();

  function addCandidate(raw, mailingAddress) {
    const key = norm(raw).toLowerCase();
    if (!key) return;
    const existing = candidateMap.get(key);
    if (existing) {
      if (!existing.mailingAddress && mailingAddress) {
        existing.mailingAddress = mailingAddress;
      }
      return;
    }
    candidateMap.set(key, {
      raw,
      mailingAddress: mailingAddress || null,
    });
  }

  function classifyOwnerLines(lines) {
    const nameLines = [];
    const addressLines = [];
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      const looksLikeAddress =
        /\b(\d{5})(?:-\d{4})?\b/.test(line) ||
        /\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box|unit|apt)\b/i.test(
          line,
        ) ||
        /^\d+\s/.test(line) ||
        /\bpo box\b/i.test(lower);
      if (looksLikeAddress) addressLines.push(line);
      else nameLines.push(line);
    });
    const mailingAddress =
      addressLines.length > 0 ? addressLines.join(", ") : null;
    nameLines.forEach((line) => {
      if (!line) return;
      addCandidate(line, mailingAddress);
    });
  }

  let ownerValueCell = null;
  $("td").each((_, td) => {
    const label = norm($(td).text());
    if (/^Owner$/i.test(label)) {
      ownerValueCell = $(td).next("td");
      return false;
    }
    return undefined;
  });

  let mailingAddressFromDom = null;
  if (ownerValueCell && ownerValueCell.length) {
    const addressLines = [];
    let capture = false;
    let currentLine = [];
    ownerValueCell.contents().each((_, node) => {
      if (node.type === "tag" && node.name === "b") {
        return;
      }
      if (node.type === "tag" && node.name === "br") {
        if (!capture) {
          capture = true;
        } else {
          const line = norm(currentLine.join(" "));
          if (line) addressLines.push(line);
          currentLine = [];
        }
        return;
      }
      if (!capture) return;
      let text = "";
      if (node.type === "text") text = node.data;
      else if (node.type === "tag") text = $(node).text();
      text = norm(text);
      if (text) currentLine.push(text);
    });
    if (capture) {
      const line = norm(currentLine.join(" "));
      if (line) addressLines.push(line);
    }
    if (addressLines.length) {
      mailingAddressFromDom = addressLines.join(", ");
    }
  }

  // Prioritize strOwner hidden input as it often contains cleaner data
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner && norm(strOwner)) {
    const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, "\n");
    const ownerLines = cleanOwner
      .split(/\n/)
      .map((line) => norm(line))
      .filter(Boolean);
    if (ownerLines.length) classifyOwnerLines(ownerLines);
  }

  if (candidateMap.size === 0 && ownerValueCell && ownerValueCell.length) {
    const nameBlock = ownerValueCell.find("b").first();
    if (nameBlock && nameBlock.length) {
      const nameLines = textWithBreaks(nameBlock)
        .split(/\n/)
        .map((line) => norm(line))
        .filter(Boolean);
      if (nameLines.length) {
        classifyOwnerLines(nameLines);
      }
    }
  }

  if (mailingAddressFromDom) {
    candidateMap.forEach((candidate) => {
      if (!candidate.mailingAddress) {
        candidate.mailingAddress = mailingAddressFromDom;
      }
    });
  }

  return Array.from(candidateMap.values());
}

// Attempt to extract historical dates near owners (fallback to Sales History if clearly associated). Here, no owner names are near dates.
function extractHistoricalDates($) {
  const dates = [];
  // Parse Sales History dates as potential ownership change markers
  // Updated selector to target the sales history table more specifically
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const dateText = norm($(tds.eq(0)).text());
      // Detect date formats like 9/30/2009
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateText)) {
        const [m, d, y] = dateText.split("/").map((x) => parseInt(x, 10));
        const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        dates.push(iso);
      }
    }
  });
  // unique and sorted
  const uniq = Array.from(new Set(dates));
  uniq.sort();
  return uniq;
}

function extractGranteesFromSales($) {
  const result = {};
  const salesTable = $("#parcelDetails_SalesTable table.parcelDetails_insideTable").first();
  if (!salesTable.length) return result;

  let currentSaleKey = null;
  salesTable.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (!tds.length) return;

    const firstCell = norm($(tds[0]).text());
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(firstCell)) {
      const iso = parseDateToISO(firstCell);
      currentSaleKey = iso || null;
      if (currentSaleKey && !result[currentSaleKey]) {
        result[currentSaleKey] = [];
      }
      return;
    }

    if (!currentSaleKey) return;

    if (tds.length === 2) {
      const label = norm($(tds.eq(0)).text()).toLowerCase();
      if (label.startsWith("grantee")) {
        const rawNames = textWithBreaks($(tds.eq(1)))
          .split(/\n|;|&/)
          .map((name) => norm(name))
          .filter(Boolean);
        if (rawNames.length) result[currentSaleKey].push(...rawNames);
      }
      return;
    }

    const rowText = norm($tr.text());
    if (/grantee/i.test(rowText)) {
      const lines = textWithBreaks($tr)
        .split(/\n/)
        .map((line) => norm(line))
        .filter(Boolean);
      lines.forEach((line) => {
        if (!/^grantee\b/i.test(line)) return;
        const [, namesPart] = line.split(/[:\-]/, 2);
        if (!namesPart) return;
        const rawNames = namesPart
          .split(/,|&|\band\b/i)
          .map((name) => norm(name))
          .filter(Boolean);
        if (rawNames.length) result[currentSaleKey].push(...rawNames);
      });
    }
  });

  return result;
}

// Main assembly
const propertyId = extractPropertyId($);
let rawCandidates = extractOwnerCandidates($);

// Classify and deduplicate structured owners
const owners = [];
const ownerSeen = new Set();
const invalidOwners = [];
rawCandidates.forEach(({ raw, mailingAddress }) => {
  const built = buildOwnersFromRaw(raw);
  if (!built || !built.length) {
    invalidOwners.push({ raw: raw, reason: "no_owner_extracted" });
    return;
  }
  built.forEach((o) => {
    const enrichedOwner = {
      ...o,
      mailing_address: mailingAddress || null,
    };
    pushOwner(enrichedOwner, ownerSeen, owners, invalidOwners, raw);
  });
});

// Owners by date: assign current owners; add historical date keys if confidently associated (not in this document)
const ownersByDate = {};
ownersByDate["current"] = owners;

const granteesByDate = extractGranteesFromSales($);
Object.entries(granteesByDate).forEach(([isoDate, rawNames]) => {
  if (!rawNames || !rawNames.length) return;
  const saleOwners = [];
  const saleSeen = new Set();
  rawNames.forEach((raw) => {
    const built = buildOwnersFromRaw(raw);
    if (!built || !built.length) {
      invalidOwners.push({ raw, reason: "no_owner_extracted_grantee" });
      return;
    }
    built.forEach((o) =>
      pushOwner(
        { ...o, mailing_address: null },
        saleSeen,
        saleOwners,
        invalidOwners,
        raw,
      ),
    );
  });
  if (saleOwners.length) ownersByDate[isoDate] = saleOwners;
});

// Build final object
const output = {
  invalid_owners: invalidOwners,
};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
};

// Ensure target directory exists and write file
const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON result
console.log(JSON.stringify(output, null, 2));
