const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf8");
const $ = cheerio.load(html);

// Helpers
const textNormalize = (s) =>
  (s || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\t\n\r]+/g, " ")
    .trim();

const normalizeNameKey = (s) =>
  textNormalize(s)
    .toLowerCase()
    .replace(/[.,'`]/g, "")
    .replace(/\s*&\s*/g, " ")
    .replace(/\s+/g, " ");

const corpTokens = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "limited",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "corporation",
  "co",
  "company",
  "services",
  "service",
  "trust",
  "tr",
  "lp",
  "llp",
  "plc",
  "holdings",
  "partners",
  "properties",
  "property",
  "management",
  "group",
  "associates",
  "bank",
  "investments",
  "investment",
  "realty",
  "enterprises",
  "enterprise",
  "industries",
  "fund",
];

function isCompany(name) {
  const lc = name.toLowerCase();
  return corpTokens.some((tok) =>
    new RegExp(`(^|[^a-z])${tok}([^a-z]|$)`).test(lc),
  );
}

function parsePerson(name) {
  const raw = textNormalize(name);
  if (!raw) return null;
  // If contains '&', remove it and parse remaining tokens as person
  const ampStripped = raw.includes("&") ? raw.replace(/&/g, " ") : raw;
  // Handle LAST, FIRST M pattern
  if (ampStripped.includes(",")) {
    const [last, rest] = ampStripped.split(",").map((s) => textNormalize(s));
    const parts = rest.split(" ").filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0];
    const middle = parts.slice(1).join(" ") || null;
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
    };
  }
  const cleaned = ampStripped;
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const middleArr = parts.slice(1, parts.length - 1);
  const middle = middleArr.length ? middleArr.join(" ") : null;
  return {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle,
  };
}

function classifyOwner(name) {
  const raw = textNormalize(name);
  if (!raw) return { valid: false, reason: "empty_name" };
  // Filter out obvious non-names like addresses
  if (
    /\d/.test(raw) &&
    /(rd|st|ave|dr|ct|suite|ste|blvd|fl|florida|ga|tx|ny|zip)/i.test(raw)
  ) {
    return { valid: false, reason: "looks_like_address" };
  }
  if (isCompany(raw)) {
    return { valid: true, owner: { type: "company", name: raw } };
  }
  const person = parsePerson(raw);
  if (person) {
    return { valid: true, owner: person };
  }
  return { valid: false, reason: "unclassified" };
}

function formatDateToYMD(dstr) {
  const s = textNormalize(dstr);
  if (!s) return null;
  // Accept formats like M/D/YYYY or MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Extract property id
function extractPropertyId() {
  let id = null;
  $("th").each((_, th) => {
    const label = textNormalize($(th).text());
    if (
      /^(parcel id|property id|prop(?:erty)?[ _]?id|parcel number)$/i.test(
        label,
      )
    ) {
      const td = $(th).next("td");
      const tval = textNormalize(td.text());
      if (tval) id = tval;
    }
  });
  if (!id) {
    const title = textNormalize($("title").text());
    const m = title.match(/([A-Z0-9-]{5,})$/);
    if (m) id = m[1];
  }
  if (!id) id = "unknown_id";
  return id;
}

const propertyId = extractPropertyId();

// Extract current owner(s) from Owner Information section
function extractCurrentOwners() {
  const owners = [];
  let ownerSection = null;
  $("section").each((_, sec) => {
    const header = textNormalize($(sec).find("header .title").first().text());
    if (/^owner information$/i.test(header)) ownerSection = $(sec);
  });
  if (ownerSection) {
    ownerSection.find("span").each((_, sp) => {
      const idAttr = ($(sp).attr("id") || "").toLowerCase();
      const txt = textNormalize($(sp).text());
      if (!txt) return;
      if (txt.toLowerCase() === "primary owner") return; // skip label
      if (/lblowneraddress/i.test(idAttr)) return; // skip address block
      if (/(addr|address|city|state|zip)/i.test(idAttr)) return;
      // Accept primary name spans
      if (/sprownername/i.test(idAttr) || /lblsearch$/i.test(idAttr)) {
        owners.push(txt);
      }
    });
    if (owners.length === 0) {
      ownerSection.find(".sdw1-owners-container div span").each((_, sp) => {
        const txt = textNormalize($(sp).text());
        if (txt && !/\d{2,}/.test(txt) && !/^primary owner$/i.test(txt))
          owners.push(txt);
      });
    }
  }
  const seen = new Set();
  const deduped = [];
  owners.forEach((n) => {
    const key = normalizeNameKey(n);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(n);
  });
  return deduped;
}

// Extract sales history owners and dates
function extractSalesData() {
  const sales = [];
  const table = $("#ctlBodyPane_ctl06_ctl01_grdSales");
  table.find("tbody > tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 8) {
      const dateTxt = textNormalize($(tds[0]).text()); // first TD is date
      const ymd = formatDateToYMD(dateTxt);
      const grantor = textNormalize($(tds[6]).find("span").text());
      const grantee = textNormalize($(tds[7]).find("span").text());
      if (ymd || grantor || grantee) {
        sales.push({ date: ymd, grantor, grantee });
      }
    }
  });
  return sales;
}

const currentOwnerNames = extractCurrentOwners();
const sales = extractSalesData();

// Build owners_by_date
const ownersByDate = {};
const invalidOwners = [];

function addOwnerToDate(dateKey, name) {
  const cls = classifyOwner(name);
  if (!cls.valid) {
    invalidOwners.push({ raw: name, reason: cls.reason });
    return;
  }
  const ownerObj = cls.owner;
  const bucket = ownersByDate[dateKey] || [];
  const existingKeys = new Set(
    bucket.map((o) => {
      if (o.type === "company") return normalizeNameKey(o.name);
      const mid = o.middle_name ? ` ${o.middle_name}` : "";
      return normalizeNameKey(`${o.first_name}${mid} ${o.last_name}`);
    }),
  );
  const newKey =
    ownerObj.type === "company"
      ? normalizeNameKey(ownerObj.name)
      : normalizeNameKey(
          `${ownerObj.first_name}${ownerObj.middle_name ? " " + ownerObj.middle_name : ""} ${ownerObj.last_name}`,
        );
  if (!existingKeys.has(newKey)) {
    bucket.push(ownerObj);
  }
  ownersByDate[dateKey] = bucket;
}

// Map grantees by their sale date
sales.forEach((s) => {
  if (s.date && s.grantee) {
    addOwnerToDate(s.date, s.grantee);
  }
});

// Collect pre-owners (grantors) that do not have a corresponding dated grantee entry under unknown_date placeholders
const preOwnerNames = [];
const granteeKeys = new Set(
  sales.filter((s) => s.grantee).map((s) => normalizeNameKey(s.grantee)),
);

sales.forEach((s) => {
  if (s.grantor) {
    const key = normalizeNameKey(s.grantor);
    if (!granteeKeys.has(key)) {
      preOwnerNames.push(s.grantor);
    }
  }
});

// Ensure current owner exists under 'current'
currentOwnerNames.forEach((n) => addOwnerToDate("current", n));

// Add undated owners as a single placeholder group, deduped
if (preOwnerNames.length) {
  const seen = new Set();
  const dedup = [];
  preOwnerNames.forEach((n) => {
    const k = normalizeNameKey(n);
    if (!k || seen.has(k)) return;
    seen.add(k);
    dedup.push(n);
  });
  const placeholderKey = "unknown_date_1";
  dedup.forEach((n) => addOwnerToDate(placeholderKey, n));
}

// Build final ordered owners_by_date
const dateKeys = Object.keys(ownersByDate);
const dated = dateKeys.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
const unknowns = dateKeys
  .filter((k) => /^unknown_date_\d+$/.test(k))
  .sort((a, b) => {
    const na = parseInt(a.replace(/\D+/g, ""), 10) || 0;
    const nb = parseInt(b.replace(/\D+/g, ""), 10) || 0;
    return na - nb;
  });
const hasCurrent = dateKeys.includes("current");
const orderedKeys = [...dated, ...unknowns];
if (hasCurrent) orderedKeys.push("current");

const orderedOwnersByDate = {};
orderedKeys.forEach((k) => {
  orderedOwnersByDate[k] = ownersByDate[k];
});

// Deduplicate invalid_owners by raw
const invalidSeen = new Set();
const invalidOut = [];
invalidOwners.forEach((it) => {
  const key = normalizeNameKey(it.raw) + ":" + it.reason;
  if (!invalidSeen.has(key)) {
    invalidSeen.add(key);
    invalidOut.push({ raw: it.raw, reason: it.reason });
  }
});

// Construct output
const output = {};
const propKey = `property_${propertyId || "unknown_id"}`;
output[propKey] = {
  owners_by_date: orderedOwnersByDate,
  invalid_owners: invalidOut,
};

// Write file
const outDir = path.join(process.cwd(), "owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

// Print result JSON
console.log(JSON.stringify(output, null, 2));
