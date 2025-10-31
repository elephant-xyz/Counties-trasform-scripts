const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf-8");
const $ = cheerio.load(html);

// Helpers
const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const hasLetters = (s) => /[A-Za-z]/.test(s || "");
const normalizeNameKey = (s) => normSpace(s).toLowerCase();

// Property ID extraction
function extractPropertyId($) {
  // Try hidden input hdPin
  let id = normSpace($("#hdPin").attr("value"));
  if (id) return id;
  // Try hidden input hdXPin
  id = normSpace($("#hdXPin").attr("value"));
  if (id) return id;
  // Try matching Altkey in page text
  const bodyText = $("body").text();
  const m = bodyText.match(/Altkey:\s*(\d+)/i);
  if (m && m[1]) return m[1];
  return "unknown_id";
}

// Detect company by keywords (case-insensitive)
function isCompanyName(name) {
  const n = " " + name.toLowerCase() + " ";
  const keywords = [
    " inc ",
    " incorporated ",
    " llc ",
    " l.l.c ",
    " ltd ",
    " limited ",
    " foundation ",
    " alliance ",
    " solutions ",
    " corp ",
    " corporation ",
    " co ",
    " company ",
    " services ",
    " service ",
    " trust ",
    " tr ",
    " trustee ",
    " assn ",
    " association ",
    " partners ",
    " holdings ",
    " enterprise ",
    " enterprises ",
    " bank ",
    " national ",
    " properties ",
    " property ",
    " investment ",
    " investments ",
    " church ",
    " school ",
    " university ",
    " lp ",
    " llp ",
    " plc ",
    " pllc ",
    " pc ",
    " group ",
    " club ",
    " hoa ",
    " condo ",
    " ministry ",
    " ministries ",
    " mortgage ",
    " federal ",
  ];
  return keywords.some((k) => n.includes(k));
}

// Parse a person name into {first_name, middle_name, last_name}
function parsePersonName(raw, sourceHint) {
  let cleaned = normSpace(raw.replace(/&/g, " "));
  // Remove extraneous commas except as separator
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (!cleaned) return null;

  // If comma present, assume Last, First Middle...
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    const last = normSpace(parts[0]);
    const rest = normSpace(parts.slice(1).join(" "));
    const restTokens = rest.split(/\s+/).filter(Boolean);
    if (restTokens.length === 0 || !last) return null;
    const first = restTokens[0] || "";
    const middle = restTokens.slice(1).join(" ") || null;
    if (!first || !last) return null;
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle || null,
    };
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  // Heuristic: Citrus PA tends to show LAST FIRST MIDDLE in many places; bias to last-first for our sources
  const preferLastFirst = ["all_owners", "header", "mailing_name"].includes(
    sourceHint,
  );

  if (preferLastFirst) {
    const last = tokens[0];
    const first = tokens[1] || "";
    const middle = tokens.slice(2).join(" ") || null;
    if (!first || !last) return null;
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle || null,
    };
  } else {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(" ") || null;
    if (!first || !last) return null;
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle || null,
    };
  }
}

// Owner candidate extraction from various sections, retaining source hints
function extractOwnerCandidates($) {
  const candidates = [];

  // 1) All Owners table
  const allOwnersTable = $('table[id="All Owners"]');
  if (allOwnersTable.length) {
    allOwnersTable.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (!tds.length) return;
      const label = normSpace($(tds[0]).text());
      if (!label || label.toLowerCase() === "name") return;
      candidates.push({ raw: label, source: "all_owners" });
    });
  }

  // 2) Mailing Address -> Name field
  const mailingTable = $('table[id="Mailing Address"]');
  if (mailingTable.length) {
    mailingTable.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const heading = normSpace($(tds[0]).text()).toLowerCase();
        if (heading === "name") {
          const nameVal = normSpace($(tds[1]).text());
          if (nameVal)
            candidates.push({ raw: nameVal, source: "mailing_name" });
        }
      }
    });
  }

  // 3) Header area: tr.DataletHeaderBottom first cell often holds primary owner name
  $("tr.DataletHeaderBottom").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length) {
      const leftText = normSpace($(tds[0]).text());
      // Exclude rows that are clearly not names
      if (!leftText) return;
      if (/^altkey:/i.test(leftText)) return;
      if (/^parcel id:/i.test(leftText)) return;
      if (leftText.length > 0 && hasLetters(leftText)) {
        candidates.push({ raw: leftText, source: "header" });
      }
    }
  });

  return candidates;
}

// Classify and structure owners
function classifyOwners(candidates) {
  const validOwners = [];
  const invalidOwners = [];
  const seen = new Set();
  const ownerKey = (o) => {
    if (o.type === "company") return "company:" + normalizeNameKey(o.name);
    const middle = o.middle_name
      ? " " + o.middle_name.toLowerCase().trim()
      : "";
    return (
      "person:" +
      (o.first_name.toLowerCase().trim() +
        middle +
        " " +
        o.last_name.toLowerCase().trim())
    );
  };

  candidates.forEach(({ raw, source }) => {
    const text = normSpace(raw);
    if (!text) return;
    // Basic plausibility filters
    if (/\d/.test(text)) {
      // Names rarely contain digits in this dataset; skip such cases
      return;
    }
    if (text.length < 2) return;

    // Dedup on raw normalized text first
    const rawKey = "raw:" + normalizeNameKey(text);
    if (seen.has(rawKey)) return;
    seen.add(rawKey);

    // Company vs person
    if (isCompanyName(text)) {
      const company = { type: "company", name: text };
      const k = ownerKey(company);
      if (!seen.has(k)) {
        seen.add(k);
        validOwners.push(company);
      }
      return;
    }

    const person = parsePersonName(text, source);
    if (!person) {
      invalidOwners.push({ raw: text, reason: "unparsable_or_ambiguous" });
      return;
    }

    // Remove empty middle_name keys by normalizing to null
    if (person.middle_name && !normSpace(person.middle_name)) {
      person.middle_name = null;
    }

    const k = ownerKey(person);
    if (!seen.has(k)) {
      seen.add(k);
      validOwners.push(person);
    }
  });

  return { validOwners, invalidOwners };
}

// Build owners_by_date map; here we only have current owners
function buildOwnersByDate(validOwners) {
  const ownersByDate = {};
  ownersByDate["current"] = validOwners;
  return ownersByDate;
}

// Main transform
const propertyId = extractPropertyId($);
const candidates = extractOwnerCandidates($);
const { validOwners, invalidOwners } = classifyOwners(candidates);
const ownersByDate = buildOwnersByDate(validOwners);

const outObj = {};
outObj[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");

// Print JSON only
console.log(JSON.stringify(outObj));
