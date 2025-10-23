const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: trim and collapse whitespace
const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

// Helper: parse date formats like 21-May-2001 to YYYY-MM-DD
function toISODate(dstr) {
  const s = clean(dstr);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const mon = m[2].toLowerCase();
  const yr = m[3];
  const map = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    sept: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const mm = map[mon];
  if (!mm) return null;
  return `${yr}-${mm}-${day}`;
}

// Helper: detect if a name is likely a company
function isCompany(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return false;
  // Tokenize on non-letters to find whole-word markers
  const tokens = s.split(/[^a-z0-9&]+/).filter(Boolean);
  const hasToken = (t) => tokens.includes(t);
  const contains = (re) => re.test(s);
  const markers = [
    /\binc\.?\b/i,
    /\bllc\b|\bl\.l\.c\b/i,
    /\bltd\.?\b/i,
    /\bcorp\.?\b|\bcorporation\b/i,
    /\bcompany\b|\bco\.?\b/i,
    /\bfoundation\b/i,
    /\balliance\b/i,
    /\bsolutions\b/i,
    /\bservices?\b/i,
    /\btrust\b/i,
    /\bhoa\b|\bhomeowners\b|\bassn\b|\bassociation\b/i,
    /\bassociates?\b/i,
    /\bpartners?\b|\bholdings?\b/i,
    /\blp\b|\bllp\b|\bplc\b/i,
    /\bbank\b/i,
    /\buniversity\b|\bcollege\b/i,
    /\bministry\b|\bministries\b/i,
    /\bchurch\b/i,
    /\bauthority\b|\bdepartment\b/i,
    /\bcity of\b|\bcounty of\b|\btown of\b/i,
  ];
  // Special: standalone TR token (common for Trust)
  if (hasToken("tr")) return true;
  return markers.some(contains);
}

// Helper: split multiple parties separated by '&' or ' and '
function splitParties(raw) {
  const s = clean(raw);
  if (!s) return [];
  // Normalize common separators
  const parts = s
    .replace(/\sand\s/gi, " & ")
    .split(/\s*&\s*/)
    .map((p) => clean(p))
    .filter(Boolean);
  return parts;
}

// Helper: Map raw suffix to schema enum
function mapSuffixToSchema(rawSuffix) {
  const s = (rawSuffix || "").toUpperCase().replace(/\./g, "");
  switch (s) {
    case "JR":
      return "Jr.";
    case "SR":
      return "Sr.";
    case "II":
      return "II";
    case "III":
      return "III";
    case "IV":
      return "IV";
    // Add other suffixes from your schema enum if needed
    default:
      return null;
  }
}

// Helper: classify and structure a single name string
function parseOwnerName(raw, requestIdentifier, sourceHttpRequest) {
  const s = clean(raw);
  if (!s) return { valid: false, reason: "empty", raw };

  if (isCompany(s)) {
    return {
      valid: true,
      owner: {
        type: "company",
        name: s,
        request_identifier: requestIdentifier,
        source_http_request: sourceHttpRequest,
      },
    };
  }

  // Define suffixes to look for and remove from name parts
  const SUFFIXES_TO_EXTRACT = ["JR", "SR", "II", "III", "IV", "V"];

  let last = null,
    first = null,
    middle = null,
    suffix = null;

  // Function to extract suffix from a list of tokens
  const extractSuffix = (tokens) => {
    let extractedSuffix = null;
    let filteredTokens = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i].toUpperCase().replace(/\./g, "");
      if (SUFFIXES_TO_EXTRACT.includes(token)) {
        extractedSuffix = mapSuffixToSchema(token);
      } else {
        filteredTokens.unshift(tokens[i]); // Add to beginning if not a suffix
      }
    }
    return { extractedSuffix, filteredTokens };
  };

  if (s.includes(",")) {
    // Format: LAST, FIRST [MIDDLE] [SUFFIX]
    const [left, rightRaw] = s.split(",");
    last = clean(left);
    const rightTokens = clean(rightRaw).split(/\s+/).filter(Boolean);

    const { extractedSuffix, filteredTokens } = extractSuffix(rightTokens);
    suffix = extractedSuffix;

    if (filteredTokens.length >= 1) {
      first = filteredTokens[0];
      if (filteredTokens.length > 1) middle = filteredTokens.slice(1).join(" ");
    }
  } else {
    // Heuristic: FIRST [MIDDLE] LAST [SUFFIX] or LAST FIRST [MIDDLE] (less common for formal records)
    // Given the HTML example "POLYPACK LTD PARTNERSHIP", it's likely company.
    // For persons, "SMITH, DWIGHT R JR" is common.
    // Let's assume if no comma, it's FIRST MIDDLE LAST, or FIRST LAST.
    const toks = s.split(/\s+/).filter(Boolean);
    const { extractedSuffix, filteredTokens } = extractSuffix(toks);
    suffix = extractedSuffix;

    if (filteredTokens.length >= 2) {
      // Assume LAST is the last token if no comma, and FIRST is the first.
      // This is a common pattern for informal names or when comma is omitted.
      first = filteredTokens[0];
      last = filteredTokens[filteredTokens.length - 1];
      if (filteredTokens.length > 2) {
        middle = filteredTokens.slice(1, filteredTokens.length - 1).join(" ");
      }
    } else if (filteredTokens.length === 1) {
      // Only one name part after suffix extraction, likely an error or single name.
      // For now, assign to last name.
      last = filteredTokens[0];
    }
  }

  // Format names to match schema patterns
  const formatName = (name) => {
    if (!name) return null;
    return name.replace(/([a-zA-Z]+)/g, (match) => 
      match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
    );
  };

  const formatMiddleName = (name) => {
    if (!name) return null;
    return name.replace(/([a-zA-Z]+)/g, (match) => 
      match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
    );
  };

  // Validate required fields - first_name and last_name must have minimum length 1
  const formattedFirst = formatName(first);
  const formattedLast = formatName(last);
  
  if (!formattedFirst || formattedFirst.length < 1 || !formattedLast || formattedLast.length < 1) {
    return { valid: false, reason: "missing_required_name_fields", raw: s };
  }

  const person = {
    source_http_request: sourceHttpRequest,
    request_identifier: requestIdentifier,
    birth_date: null,
    first_name: formattedFirst,
    last_name: formattedLast,
    middle_name: formatMiddleName(middle),
    prefix_name: null,
    suffix_name: suffix,
    us_citizenship_status: null,
    veteran_status: null,
  };
  return { valid: true, owner: person };
}

// Helper: turn any raw string possibly with multiple parties into owners[]; record invalids
function ownersFromRaw(raw, invalids, requestIdentifier, sourceHttpRequest) {
  const parties = splitParties(raw);
  const out = [];
  for (const p of parties) {
    const parsed = parseOwnerName(p, requestIdentifier, sourceHttpRequest);
    if (parsed.valid) out.push(parsed.owner);
    else invalids.push({ raw: p, reason: parsed.reason });
  }
  return out;
}

// Helper: normalize for dedupe
function normalizeOwner(o) {
  if (o.type === "company") return `company:${clean(o.name).toLowerCase()}`;
  const f = clean(o.first_name || "").toLowerCase();
  const l = clean(o.last_name || "").toLowerCase();
  const m = o.middle_name ? clean(o.middle_name).toLowerCase() : "";
  const s = o.suffix_name ? clean(o.suffix_name).toLowerCase() : "";
  return `person:${f}|${m}|${l}|${s}`;
}

function dedupeOwners(arr) {
  const seen = new Set();
  const out = [];
  for (const o of arr) {
    const key = normalizeOwner(o);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

// --- Main Extraction Logic ---
try {
  // Extract Property ID
  let propertyId = clean($("#pacel_no").text());
  if (!propertyId) {
    // Try other hints like g_strap from scripts or input name="pn"
    const scriptsText = $("script")
      .map((i, el) => $(el).html() || "")
      .get()
      .join("\n");
    const m = scriptsText.match(/var\s+g_strap\s*=\s*"(\d+)"/);
    if (m) propertyId = m[1];
    else {
      const strapInput = clean($('#frmTaxEstimator input[name="pn"]').val());
      if (strapInput) propertyId = strapInput;
      else propertyId = "unknown_id"; // Fallback if no ID found
    }
  }

  // Define request_identifier and source_http_request (placeholders)
  // In a real scenario, these would be passed from the calling context
  const requestIdentifier = propertyId; // Using propertyId as request_identifier
  const sourceHttpRequest = {
    method: "GET",
    url: `https://www.pcpao.gov/property-details?s=${propertyId}`, // Example URL
  };

  // Collect owners
  const invalid_owners = [];

  // Current owners
  let currentOwnerText = "";
  // The HTML structure for owner names is a bit tricky with <br/> and multiple spans.
  // Let's get the combined text content and then split by potential owner separators.
  const ownerDetailsDiv = $("#owner_details");
  // Remove the "More" button if it exists, to avoid its text interfering
  ownerDetailsDiv.find(".ownermoreBtn").remove();
  // Get all text nodes and combine, or use .text() and then split by common delimiters
  const rawCurrentOwnerText = ownerDetailsDiv.text().trim();

  let currentOwners = [];
  // Assuming multiple owners are separated by " and " or "&" or new lines in the raw text
  currentOwners = ownersFromRaw(
    rawCurrentOwnerText,
    invalid_owners,
    requestIdentifier,
    sourceHttpRequest,
  );
  currentOwners = dedupeOwners(currentOwners);

  // Historical owners by date via Sales History (use Grantee at sale date)
  const ownersByDate = {};

  $("#tblSalesHistory tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const dateStr = clean($(tds[0]).text());
      const granteeRaw = clean($(tds[5]).text());
      const iso = toISODate(dateStr);
      if (iso && granteeRaw) {
        const owners = ownersFromRaw(
          granteeRaw,
          invalid_owners,
          requestIdentifier,
          sourceHttpRequest,
        );
        if (owners.length) {
          if (!ownersByDate[iso]) ownersByDate[iso] = [];
          ownersByDate[iso] = dedupeOwners(ownersByDate[iso].concat(owners));
        }
      } else if (!iso && granteeRaw) {
        // Unknown date bucket
        let idx = 1;
        let key = `unknown_date_${idx}`;
        while (ownersByDate[key]) {
          idx += 1;
          key = `unknown_date_${idx}`;
        }
        const owners = ownersFromRaw(
          granteeRaw,
          invalid_owners,
          requestIdentifier,
          sourceHttpRequest,
        );
        if (owners.length)
          ownersByDate[key] = dedupeOwners(
            (ownersByDate[key] || []).concat(owners),
          );
      }
    }
  });

  // Add current owners at the end under 'current'
  ownersByDate["current"] = currentOwners;

  // Sort chronological keys (ISO dates), keep unknown_date_* in insertion order, current last
  const dateKeys = Object.keys(ownersByDate)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  const unknownKeys = Object.keys(ownersByDate).filter((k) =>
    /^unknown_date_\d+$/.test(k),
  );
  const finalMap = {};
  for (const k of dateKeys) finalMap[k] = ownersByDate[k];
  for (const k of unknownKeys) finalMap[k] = ownersByDate[k];
  finalMap["current"] = ownersByDate["current"];

  // Build final JSON structure
  const out = {};
  out[`property_${propertyId}`] = { owners_by_date: finalMap, invalid_owners };

  // Ensure output directory and write file
  fs.mkdirSync(path.dirname("owners/owner_data.json"), { recursive: true });
  fs.writeFileSync(
    "owners/owner_data.json",
    JSON.stringify(out, null, 2),
    "utf8",
  );

  // Print JSON to stdout
  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  console.error("An error occurred during owner extraction:", error);
  process.exit(1); // Exit with an error code
}
