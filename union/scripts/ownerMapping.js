const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility helpers
const collapseWs = (s) => (s || "").replace(/\s+/g, " ").trim();
const lower = (s) => collapseWs(s).toLowerCase();

const looksLikeCompany = (raw) => {
  const s = lower(raw);
  const keywords = [
    "inc",
    "llc",
    "l.l.c",
    "ltd",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "co",
    "services",
    "trust",
    "tr",
    "associates",
    "holdings",
    "properties",
    "management",
    "group",
    "partners",
    "lp",
    "llp",
    "plc",
    "bank",
    "association",
    "church",
    "university",
    "college",
    "hospital",
    "authority",
    "company",
    "enterprises",
    "industries",
    "limited",
    "pc",
    "pllc",
    "pl",
    "pa",
  ];
  return keywords.some((k) =>
    new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, "i").test(s),
  );
};

const titleCase = (s) =>
  s
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");

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

function parsePersonNameBasic(name) {
  const raw = collapseWs(name).replace(/\./g, "").trim();
  if (!raw) return null;

  // Handle comma style: LAST, FIRST MIDDLE
  if (raw.includes(",")) {
    const [lastPart, rest] = raw.split(",").map(collapseWs);
    const restParts = (rest || "").split(/\s+/).filter(Boolean);
    if (!lastPart || restParts.length === 0) return null;
    const first = restParts[0];
    const middle = restParts.slice(1).join(" ") || null;
    return {
      type: "person",
      first_name: titleCase(cleanInvalidCharsFromName(first)),
      last_name: titleCase(cleanInvalidCharsFromName(lastPart)),
      middle_name: middle ? titleCase(cleanInvalidCharsFromName(middle)) : null,
    };
  }

  // Handle normal order: FIRST MIDDLE LAST
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.slice(1, parts.length - 1).join(" ") || null;
  return {
    type: "person",
    first_name: titleCase(cleanInvalidCharsFromName(first)),
    last_name: titleCase(cleanInvalidCharsFromName(last)),
    middle_name: middle ? titleCase(cleanInvalidCharsFromName(middle)) : null,
  };
}

function parseAmpersandNames(raw) {
  // Attempt to split two persons joined by & and share last name when missing
  const s = collapseWs(raw);
  if (!s.includes("&")) return [];
  const parts = s.split("&").map(collapseWs).filter(Boolean);
  if (parts.length !== 2) return [];

  const left = parts[0];
  const right = parts[1];

  const rightTokens = right.split(/\s+/).filter(Boolean);
  const leftTokens = left.split(/\s+/).filter(Boolean);
  let leftFirstMid = null;
  let leftLast = null;
  let rightFirstMid = null;
  let rightLast = null;
  if (rightTokens.length === 1 && leftTokens.length == 1) {
    // Not enough info to determine last name for the right person
    return [];
  }
  if (rightTokens.length === 1) {
    leftFirstMid = leftTokens.slice(0, -1).join(" ");
    leftLast = leftTokens[leftTokens.length - 1];
    rightFirstMid = leftTokens[0];
    rightLast = leftLast;
  }
  else {
    rightLast = rightTokens[rightTokens.length - 1];
    rightFirstMid = rightTokens.slice(0, -1).join(" ");
    if (leftTokens.length === 1) {
      leftFirstMid = leftTokens[0];
      leftLast = rightLast;
    } else {
      leftFirstMid = leftTokens.slice(0, -1).join(" ");
      leftLast = leftTokens[leftTokens.length - 1];
    }
  }
  const p1 = parsePersonNameBasic(`${leftFirstMid} ${leftLast}`);
  const p2 = parsePersonNameBasic(`${rightFirstMid} ${rightLast}`);
  return p1 && p2 ? [p1, p2] : [];
}

function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return lower(owner.name);
  if (owner.type === "person") {
    return lower(
      [owner.first_name, owner.middle_name || "", owner.last_name]
        .join(" ")
        .replace(/\s+/g, " "),
    );
  }
  return "";
}

function extractOwnerCandidates($) {
  const candidates = [];

  // 1) From explicit Owner label cells
  $("td").each((i, el) => {
    const txt = collapseWs($(el).text()).toLowerCase();
    if (txt === "owner") {
      const valTd = $(el).next("td");
      if (valTd && valTd.length) {
        // Prefer bold text within the value cell for owner name
        const boldText = collapseWs(valTd.find("b").first().text());
        const rawCellText = collapseWs(valTd.text());
        if (boldText) {
          candidates.push(boldText);
        } else if (rawCellText) {
          // Take first line before address numbers
          const firstLine =
            rawCellText.split(/\n|<br\s*\/?>/i)[0] || rawCellText;
          const m = firstLine.match(/^([^0-9,]+)/);
          if (m && m[1]) candidates.push(collapseWs(m[1]));
        }
      }
    }
  });
  console.log(candidates);

  // 2) Hidden field: strOwner
  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner) candidates.push(collapseWs(strOwner));
  console.log(candidates);

  // 3) Hidden field: PARCEL_Buffer_Label contains HTML snippet with owner and address
  // const pbl = $('input[name="PARCEL_Buffer_Label"]').attr("value");
  // if (pbl) {
  //   const $frag = cheerio.load(`<div>${pbl}</div>`);
  //   const lines = [];
  //   $frag("div")
  //     .contents()
  //     .each((i, node) => {
  //       if (node.type === "text") {
  //         const t = collapseWs(node.data || "");
  //         if (t) lines.push(t);
  //       } else if (node.name === "br") {
  //         lines.push("\n");
  //       }
  //     });
  //   const afterBreak = pbl.split(/<br\s*\/?>/i).pop() || "";
  //   const m2 = collapseWs(
  //     cheerio.load(`<div>${afterBreak}</div>`)("div").text(),
  //   ).match(/^([^0-9,]+)/);
  //   if (m2 && m2[1]) candidates.push(collapseWs(m2[1]));
  // }
  // De-duplicate raw candidates
  const seen = new Set();
  const uniq = [];
  for (const c of candidates) {
    const norm = lower(c);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      uniq.push(collapseWs(c));
    }
  }
  return uniq;
}

function classifyOwners(rawNames) {
  const validOwners = [];
  const invalidOwners = [];

  for (const raw of rawNames) {
    const s = collapseWs(raw);
    if (!s) continue;

    if (s.includes("&") && !looksLikeCompany(s)) {
      const people = parseAmpersandNames(s);
      if (people.length) {
        for (const p of people) validOwners.push(p);
      } else {
        invalidOwners.push({
          raw: s,
          reason: "ambiguous_ampersand_person_names",
        });
      }
      continue;
    }

    if (looksLikeCompany(s)) {
      validOwners.push({ type: "company", name: collapseWs(s) });
      continue;
    }

    const person = parsePersonNameBasic(s);
    if (person) {
      validOwners.push(person);
    } else {
      invalidOwners.push({ raw: s, reason: "unclassifiable_owner" });
    }
  }

  // Deduplicate by normalized key
  const seenKeys = new Set();
  const deduped = [];
  for (const o of validOwners) {
    const key = normalizeOwnerKey(o);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(o);
    }
  }

  return { owners: deduped, invalid: invalidOwners };
}

function extractPropertyId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

// Build owners_by_date structure
const rawOwnerNames = extractOwnerCandidates($);
const { owners: currentOwners, invalid: invalidOwners } =
  classifyOwners(rawOwnerNames);

// Attempt to find historical owner groups (by labels like Owner History, Previous Owner, etc.)
// This document does not surface explicit historical owner names; we therefore only include current owners.
const owners_by_date = {};
owners_by_date["current"] = currentOwners;

// Compose final object
const propId = extractPropertyId($);
const topKey = `property_${propId || "unknown_id"}`;
const output = {};
output[topKey] = { owners_by_date };
output[topKey].invalid_owners = invalidOwners; // store invalids per property scope

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print JSON result
console.log(JSON.stringify(output, null, 2));
