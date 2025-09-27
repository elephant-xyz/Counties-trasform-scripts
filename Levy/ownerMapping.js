const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Utility helpers
const getText = (node) => $(node).text().replace(/\s+/g, " ").trim();
const cleanStr = (s) =>
  (s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();

// Company detection
const companyRegex =
  /(\binc\b|\binc\.|\bllc\b|l\.l\.c\.|\bltd\b|\bltd\.|foundation|alliance|solutions|\bcorp\b|\bcorp\.|\bco\b|\bco\.|services|trust\b|\btr\b|company|associates?|holdings?|partners?|\blp\b|\bllp\b|\bplc\b|\bbank\b|national association|\bna\b|properties|investments?)/i;

// Suffixes to ignore for person parsing
const suffixes = ["JR", "SR", "II", "III", "IV", "V"];

function isCompany(name) {
  return companyRegex.test(name);
}

function stripSuffixTokens(tokens) {
  while (
    tokens.length &&
    suffixes.includes(
      tokens[tokens.length - 1].replace(/\.$/, "").toUpperCase(),
    )
  ) {
    tokens.pop();
  }
  return tokens;
}

function parseDateToISO(mdy) {
  const t = cleanStr(mdy);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mm, dd, yyyy] = m;
  if (yyyy.length === 2) yyyy = (parseInt(yyyy, 10) > 50 ? "19" : "20") + yyyy;
  const y = parseInt(yyyy, 10);
  const mo = String(parseInt(mm, 10)).padStart(2, "0");
  const da = String(parseInt(dd, 10)).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function makePerson(first, last, middle) {
  const obj = {
    type: "person",
    first_name: cleanStr(first),
    last_name: cleanStr(last),
  };
  const mid = cleanStr(middle || "");
  if (mid) obj.middle_name = mid;
  else obj.middle_name = null;
  return obj;
}

function makeCompany(name) {
  return { type: "company", name: cleanStr(name) };
}

function personNormalizeKey(p) {
  return `person|${(p.first_name || "").toLowerCase()}|${(p.middle_name || "").toLowerCase()}|${(p.last_name || "").toLowerCase()}`;
}

function companyNormalizeKey(c) {
  return `company|${(c.name || "").toLowerCase()}`;
}

function parsePersonName(raw, lastNameHint) {
  const original = cleanStr(raw);
  if (!original) return null;
  // If contains a comma, assume Last, First Middle
  if (original.includes(",")) {
    const [lastPart, restPart] = original.split(",");
    const last = cleanStr(lastPart);
    let rest = cleanStr(restPart);
    let tokens = stripSuffixTokens(rest.split(/\s+/).filter(Boolean));
    if (tokens.length === 0) return null;
    const first = tokens[0];
    const middle = tokens.slice(1).join(" ");
    return makePerson(first, last, middle);
  }
  // No comma
  let tokens = original.split(/\s+/).filter(Boolean);
  tokens = stripSuffixTokens(tokens);
  if (tokens.length === 1) {
    if (lastNameHint) return makePerson(tokens[0], lastNameHint, null);
    return null;
  }
  if (tokens.length === 2) {
    const [last, first] = tokens; // Assume Assessor style LAST FIRST
    if (lastNameHint) {
      return makePerson(tokens[0], lastNameHint, tokens[1]);
    }
    return makePerson(first, last, null);
  }
  const last = tokens[0];
  const first = tokens[1];
  const middle = tokens.slice(2).join(" ");
  return makePerson(first, last, middle);
}

function parseOwnerStringToEntities(raw, invalids) {
  const nameStr = cleanStr(raw).replace(/\s+/g, " ");
  if (!nameStr) return [];

  if (nameStr.includes("&")) {
    const parts = nameStr.split(/\s*&\s*/).filter(Boolean);
    const entities = [];

    // Determine first part last name if person
    let firstPartLastName = null;
    if (parts.length > 0) {
      const p0 = cleanStr(parts[0]);
      if (!isCompany(p0)) {
        const tokens0 = stripSuffixTokens(p0.split(/\s+/).filter(Boolean));
        if (tokens0.length >= 2) firstPartLastName = tokens0[0];
      }
    }

    for (let i = 0; i < parts.length; i++) {
      const part = cleanStr(parts[i]);
      if (!part) continue;
      if (isCompany(part)) {
        entities.push(makeCompany(part));
        continue;
      }
      const hint = i > 0 ? firstPartLastName : null;
      const person = parsePersonName(part, hint);
      if (person) entities.push(person);
      else
        invalids.push({
          raw: part,
          reason: "Unable to parse person name in compound owners",
        });
    }
    return entities;
  }

  if (isCompany(nameStr)) {
    return [makeCompany(nameStr)];
  }
  const person = parsePersonName(nameStr, null);
  if (person) return [person];
  invalids.push({
    raw: nameStr,
    reason: "Unclassified owner (neither company nor parseable person)",
  });
  return [];
}

function dedupeOwners(list) {
  const seen = new Set();
  const out = [];
  for (const o of list) {
    if (!o) continue;
    const key =
      o.type === "company" ? companyNormalizeKey(o) : personNormalizeKey(o);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

// Extract Property ID
function extractPropertyId() {
  let id = null;
  $("tr").each((i, tr) => {
    const th = $(tr).find("th,td").first();
    if (cleanStr(getText(th)).toLowerCase().includes("parcel id")) {
      const td = $(tr).find("td").last();
      const val = cleanStr(getText(td));
      if (val) id = val;
    }
  });
  if (!id) {
    const title = cleanStr($("title").text());
    const m = title.match(/Report:\s*(\S+)/i);
    if (m) id = m[1];
  }
  if (!id) id = "unknown_id";
  return id;
}

// Extract current owners (prefer Owner module and spans with PrimaryOwnerName)
function extractCurrentOwnerNames() {
  const names = [];
  const seen = new Set();

  // Prefer Owner section
  const ownerSection = $("#ctlBodyPane_ctl03_mSection");
  ownerSection.find("span[id*='PrimaryOwnerName']").each((i, el) => {
    const t = cleanStr($(el).text());
    if (t && !seen.has(t)) {
      seen.add(t);
      names.push(t);
    }
  });

  if (names.length) return names;

  // Fallback: find any row labeled Owner Name and collect spans except percent labels
  $("tr").each((i, tr) => {
    const thText = cleanStr($(tr).find("th").first().text()).toLowerCase();
    if (thText.includes("owner name")) {
      $(tr)
        .find("td")
        .first()
        .find("span")
        .each((j, sp) => {
          const id = $(sp).attr("id") || "";
          if (/pctowner/i.test(id)) return; // skip percentages
          const t = cleanStr($(sp).text());
          if (t && !/\d+%/.test(t) && !seen.has(t)) {
            seen.add(t);
            names.push(t);
          }
        });
    }
  });
  return names;
}

// Extract historical owners from Sales table
function extractSalesHistory() {
  const history = []; // {date: 'YYYY-MM-DD', name: 'raw grantee name'}
  const table = $("#ctlBodyPane_ctl11_ctl01_grdSales");
  if (table.length) {
    table.find("tbody > tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;
      const saleDate = cleanStr($(tds.get(0)).text());
      const iso = parseDateToISO(saleDate);
      const grantee = cleanStr($(tds.get(tds.length - 1)).text());
      if (iso && grantee) {
        history.push({ date: iso, grantee });
      }
    });
  }
  return history;
}

// Main transformation
const propertyId = extractPropertyId();
const invalid_owners = [];

// Current owners
const currentOwnerNames = extractCurrentOwnerNames();
let currentOwners = [];
for (const raw of currentOwnerNames) {
  const parsed = parseOwnerStringToEntities(raw, invalid_owners);
  currentOwners.push(...parsed);
}
currentOwners = dedupeOwners(currentOwners);

// Historical owners by date from sales (use Grantee)
const sales = extractSalesHistory();
const ownersByDateEntries = [];
for (const rec of sales) {
  const owners = dedupeOwners(
    parseOwnerStringToEntities(rec.grantee, invalid_owners),
  );
  if (owners.length) ownersByDateEntries.push({ date: rec.date, owners });
}
// Sort by date ascending, and group by unique date
ownersByDateEntries.sort((a, b) => a.date.localeCompare(b.date));
const owners_by_date = {};
for (const entry of ownersByDateEntries) {
  if (!owners_by_date[entry.date]) {
    owners_by_date[entry.date] = entry.owners;
  } else {
    owners_by_date[entry.date] = dedupeOwners(
      owners_by_date[entry.date].concat(entry.owners),
    );
  }
}
// Append current owners as final key
owners_by_date["current"] = currentOwners;

const output = {};
output[`property_${propertyId}`] = { owners_by_date };
output.invalid_owners = invalid_owners;

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print to stdout only the JSON
console.log(JSON.stringify(output, null, 2));
