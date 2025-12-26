#!/usr/bin/env node
const fsp = require("fs").promises;
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function listFiles(p) {
  try {
    return await fsp.readdir(p);
  } catch {
    return [];
  }
}

async function removeIfMatch(dir, regex) {
  const files = await listFiles(dir);
  await Promise.all(
    files
      .filter((f) => regex.test(f))
      .map((f) => fsp.unlink(path.join(dir, f)).catch(() => {})),
  );
}

function cleanText(t) {
  if (t == null) return null;
  return String(t).replace(/\s+/g, " ").trim();
}

function parseCurrency(str) {
  if (!str) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  const num = parseFloat(s);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function toISODate(mdy) {
  if (!mdy) return null;
  const m = mdy.trim();
  if (!m) return null;
  const parts = m.split("/");
  if (parts.length !== 3) return null;
  let [mm, dd, yyyy] = parts;
  const pad = (n) => String(n).padStart(2, "0");
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

function titleCaseName(s) {
  if (!s) return null;
  s = s.toLowerCase();
  return s.replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
}

function mapPropertyType(text) {
  if (!text) return null;
  const t = text.toUpperCase().trim();
  // Check for vacant lots/tracts first (even if designated SFR)
  if (t.includes("VACANT LOTS") || t.includes("VACANT LAND") || t.includes("TRACTS")) return "VacantLand";
  if (t.includes("SINGLE FAMILY") || t.includes("SFR")) return "SingleFamily";
  if (t.includes("DUPLEX")) return "Duplex";
  if (t.includes("COMMERCIAL")) return "MiscellaneousResidential";
  const err = {
    type: "error",
    message: `Unknown enum value ${text}.`,
    path: "property.property_type",
  };
  console.log(JSON.stringify(err, null, 2));
  process.exit(1);
}

function mapRoofDesignType(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("GABLE")) return "Gable";
  if (t.includes("HIP")) return "Hip";
  if (t.includes("FLAT")) return "Flat";
  if (t.includes("MANSARD")) return "Mansard";
  if (t.includes("GAMBREL")) return "Gambrel";
  if (t.includes("SHED")) return "Shed";
  return null;
}

function mapRoofCovering(text) {
  if (!text) return { roof_covering_material: null, roof_material_type: null };
  const t = text.toUpperCase();
  // DCAD often shows COMP SHINGLES for composite shingles
  if (t.includes("COMP") && t.includes("SHING")) {
    return {
      roof_covering_material: "3-Tab Asphalt Shingle",
      roof_material_type: "Shingle",
    };
  }
  if (t.includes("ARCH") && t.includes("SHING")) {
    return {
      roof_covering_material: "Architectural Asphalt Shingle",
      roof_material_type: "Shingle",
    };
  }
  // Check for generic shingles (fallback)
  if (t.includes("SHING")) {
    return {
      roof_covering_material: "3-Tab Asphalt Shingle",
      roof_material_type: "Shingle",
    };
  }
  if (t.includes("METAL")) {
    return {
      roof_covering_material: "Metal Standing Seam",
      roof_material_type: "Metal",
    };
  }
  if (t.includes("SLATE")) {
    return {
      roof_covering_material: "Natural Slate",
      roof_material_type: "Slate",
    };
  }
  if (t.includes("TPO")) {
    return {
      roof_covering_material: "TPO Membrane",
      roof_material_type: "Membrane",
    };
  }
  if (t.includes("EPDM")) {
    return {
      roof_covering_material: "EPDM Membrane",
      roof_material_type: "Membrane",
    };
  }
  if (t.includes("BITUMEN")) {
    return {
      roof_covering_material: "Modified Bitumen",
      roof_material_type: "Modified Bitumen",
    };
  }
  if (t.includes("BUILT")) {
    return {
      roof_covering_material: "Built-Up Roof",
      roof_material_type: "Built-Up",
    };
  }
  if (t.includes("TILE")) {
    return { roof_covering_material: "Clay Tile", roof_material_type: "Tile" };
  }
  return { roof_covering_material: null, roof_material_type: null };
}

function mapFoundationType(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("SLAB")) return "Slab on Grade";
  if (t.includes("CRAWL")) return "Crawl Space";
  if (t.includes("FULL BASEMENT")) return "Full Basement";
  if (t.includes("PARTIAL BASEMENT")) return "Partial Basement";
  if (t.includes("PIER") || t.includes("BEAM")) return "Pier and Beam";
  if (t.includes("WALKOUT")) return "Basement with Walkout";
  if (t.includes("STEM")) return "Stem Wall";
  if (t.includes("BASEMENT")) return "Full Basement";
  return null;
}

function mapExteriorWall(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("BRICK")) return "Brick";
  if (t.includes("STONE")) return "Natural Stone";
  if (t.includes("STUCCO")) return "Stucco";
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("WOOD")) return "Wood Siding";
  if (t.includes("FIBER") || t.includes("HARDIE")) return "Fiber Cement Siding";
  if (t.includes("METAL")) return "Metal Siding";
  if (t.includes("CONCRETE BLOCK") || t.includes("C.BLOCK") || t === "BLOCK")
    return "Concrete Block";
  return null;
}

function mapFraming(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("FRAME")) return "Wood Frame";
  if (t.includes("MASONRY")) return "Masonry";
  if (t.includes("STEEL")) return "Steel Frame";
  if (t.includes("CONCRETE")) return "Poured Concrete";
  return null;
}

function mapFence(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("WOOD")) return "Wood";
  if (t.includes("CHAIN")) return "Chain Link";
  if (t.includes("VINYL")) return "Vinyl";
  if (t.includes("ALUM")) return "Aluminum";
  if (t.includes("WROUGHT")) return "Wrought Iron";
  return null;
}

function mapExemptionType(text) {
  if (!text) return null;
  const t = text.toUpperCase().trim();
  if (t.includes("HOMESTEAD")) return "Homestead";
  // Check for REG DISABILITY before general DISABILITY
  if (t.includes("REG DISABILITY") || t.includes("REG. DISABILITY")) return "Wid/Vet/Dis";
  if (t.includes("DISABILITY") || t.includes("DISABLED")) return "Disability";
  if (t.includes("VETERAN") || t.includes("VET ")) return "Veteran";
  if (t.includes("SENIOR") || t.includes("OVER 65") || t.includes("AGE 65")) return "Senior";
  if (t.includes("OTHER")) return "Wid/Vet/Dis";
  if (t.includes("AGRICULTURAL") || t.includes("AG USE")) return "Agricultural";
  return "Wid/Vet/Dis";
}

function parseIntLoose(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
}

function extractInstrumentNumber(text) {
  if (!text) return null;
  const upper = String(text).toUpperCase();
  const intMatch = upper.match(/(INT\d{6,})/);
  if (intMatch) return intMatch[1];
  const instrMatch = upper.match(/INSTR(?:UMENT)?\s*#?\s*([0-9A-Z-]+)/);
  if (instrMatch) {
    const cleaned = instrMatch[1].replace(/[^0-9A-Z-]/g, "").trim();
    return cleaned || null;
  }
  return null;
}

const STATE_NAME_TO_CODE = Object.fromEntries([
  ["ALABAMA", "AL"],
  ["ALASKA", "AK"],
  ["ARIZONA", "AZ"],
  ["ARKANSAS", "AR"],
  ["CALIFORNIA", "CA"],
  ["COLORADO", "CO"],
  ["CONNECTICUT", "CT"],
  ["DELAWARE", "DE"],
  ["FLORIDA", "FL"],
  ["GEORGIA", "GA"],
  ["HAWAII", "HI"],
  ["IDAHO", "ID"],
  ["ILLINOIS", "IL"],
  ["INDIANA", "IN"],
  ["IOWA", "IA"],
  ["KANSAS", "KS"],
  ["KENTUCKY", "KY"],
  ["LOUISIANA", "LA"],
  ["MAINE", "ME"],
  ["MARYLAND", "MD"],
  ["MASSACHUSETTS", "MA"],
  ["MICHIGAN", "MI"],
  ["MINNESOTA", "MN"],
  ["MISSISSIPPI", "MS"],
  ["MISSOURI", "MO"],
  ["MONTANA", "MT"],
  ["NEBRASKA", "NE"],
  ["NEVADA", "NV"],
  ["NEW HAMPSHIRE", "NH"],
  ["NEW JERSEY", "NJ"],
  ["NEW MEXICO", "NM"],
  ["NEW YORK", "NY"],
  ["NORTH CAROLINA", "NC"],
  ["NORTH DAKOTA", "ND"],
  ["OHIO", "OH"],
  ["OKLAHOMA", "OK"],
  ["OREGON", "OR"],
  ["PENNSYLVANIA", "PA"],
  ["RHODE ISLAND", "RI"],
  ["SOUTH CAROLINA", "SC"],
  ["SOUTH DAKOTA", "SD"],
  ["TENNESSEE", "TN"],
  ["TEXAS", "TX"],
  ["UTAH", "UT"],
  ["VERMONT", "VT"],
  ["VIRGINIA", "VA"],
  ["WASHINGTON", "WA"],
  ["WEST VIRGINIA", "WV"],
  ["WISCONSIN", "WI"],
  ["WYOMING", "WY"],
  ["DISTRICT OF COLUMBIA", "DC"],
  ["WASHINGTON DC", "DC"],
]);

const DIRECTION_SET = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
const STREET_SUFFIX_MAP = Object.fromEntries([
  ["ST", "St"],
  ["STREET", "St"],
  ["AVE", "Ave"],
  ["AVENUE", "Ave"],
  ["RD", "Rd"],
  ["ROAD", "Rd"],
  ["DR", "Dr"],
  ["DRIVE", "Dr"],
  ["LN", "Ln"],
  ["LANE", "Ln"],
  ["BLVD", "Blvd"],
  ["BOULEVARD", "Blvd"],
  ["CIR", "Cir"],
  ["CIRCLE", "Cir"],
  ["CT", "Ct"],
  ["COURT", "Ct"],
  ["HWY", "Hwy"],
  ["HIGHWAY", "Hwy"],
  ["PKWY", "Pkwy"],
  ["PARKWAY", "Pkwy"],
  ["WAY", "Way"],
  ["PL", "Pl"],
  ["PLACE", "Pl"],
  ["TRL", "Trl"],
  ["TRAIL", "Trl"],
  ["TER", "Ter"],
  ["TERRACE", "Ter"],
  ["EXPY", "Expy"],
  ["EXPRESSWAY", "Expy"],
  ["ALY", "Aly"],
  ["ALLY", "Aly"],
]);

function normalizeStateCode(val) {
  if (!val) return null;
  const upper = val.trim().toUpperCase();
  if (STATE_NAME_TO_CODE[upper]) return STATE_NAME_TO_CODE[upper];
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return null;
}

function normalizeAddressLine(text) {
  if (!text) return null;
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function splitStreetComponents(line) {
  if (!line) return { number: null, name: null };
  const match = line.match(/^(\d+)\s+(.*)$/);
  if (match) return { number: match[1], name: match[2] };
  return { number: null, name: line };
}

function parseStreetNameDetails(name) {
  if (!name) {
    return {
      base: null,
      suffix: null,
      preDirectional: null,
      postDirectional: null,
    };
  }
  const tokens = name.replace(/\s+/g, " ").trim().toUpperCase().split(" ");
  let preDirectional = null;
  let postDirectional = null;
  let suffix = null;
  if (tokens.length && DIRECTION_SET.has(tokens[0])) {
    preDirectional = tokens.shift();
  }
  if (tokens.length > 1 && DIRECTION_SET.has(tokens[tokens.length - 1])) {
    postDirectional = tokens.pop();
  }
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1].replace(/\./g, "");
    if (STREET_SUFFIX_MAP[last]) {
      suffix = STREET_SUFFIX_MAP[last];
      tokens.pop();
    }
  }
  const base = tokens.join(" ").trim() || null;
  return { base, suffix, preDirectional, postDirectional };
}

function parseFullAddress(line) {
  if (!line) return {};
  const cleaned = line.replace(/\s+/g, " ").trim();
  const match = cleaned.match(
    /^(.*?),\s*([A-Za-z.\s]+),\s*([A-Za-z.\s]+)\s+(\d{5}(?:-\d{4})?|\d{9})$/,
  );
  if (!match) {
    return { street: cleaned };
  }
  const [, street, city, stateRaw, postalRaw] = match;
  const digits = postalRaw.replace(/\D/g, "");
  const postal = digits.slice(0, 5) || null;
  const plus4 =
    digits.length > 5 ? digits.slice(5, Math.min(9, digits.length)) : null;
  return {
    street: street.trim(),
    city: city.trim(),
    stateRaw: stateRaw.trim(),
    stateCode: normalizeStateCode(stateRaw),
    postal,
    plus4,
    postalRaw: postalRaw.trim(),
  };
}

function extractBlockLot(segments) {
  if (!segments || !segments.length) return { block: null, lot: null };
  const joined = segments.filter(Boolean).join(" ").toUpperCase();
  let block = null;
  let lot = null;
  const blockMatch = joined.match(/(?:BLK|BLOCK)\s*([A-Z0-9\/-]+)/);
  if (blockMatch) block = blockMatch[1];
  const lotMatch = joined.match(/(?:LOT|LT)\s*([A-Z0-9\/-]+)/);
  if (lotMatch) lot = lotMatch[1];
  return { block, lot };
}

function mapImprovementToLayout(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (!t) return null;
  if (t.includes("GARAGE")) {
    return {
      spaceType: t.includes("DET") ? "Detached Garage" : "Attached Garage",
      isExterior: false,
    };
  }
  if (t.includes("CARPORT")) {
    return { spaceType: "Carport", isExterior: true };
  }
  if (t.includes("PATIO")) {
    return { spaceType: "Patio", isExterior: true };
  }
  if (t.includes("DECK")) {
    return { spaceType: "Deck", isExterior: true };
  }
  if (t.includes("POOL")) {
    return { spaceType: "Outdoor Pool", isExterior: true };
  }
  if (t.includes("SPA") || t.includes("HOT TUB")) {
    return { spaceType: "Spa", isExterior: false };
  }
  if (t.includes("SHED") || t.includes("STORAGE")) {
    return { spaceType: "Storage Room", isExterior: true };
  }
  if (t.includes("GAZEBO")) {
    return { spaceType: "Gazebo", isExterior: true };
  }
  if (t.includes("BARN")) {
    return { spaceType: "Barn", isExterior: true };
  }
  return { spaceType: "Outbuilding", isExterior: true };
}

function normalizeParcelId(val) {
  if (val == null) return null;
  const cleaned = String(val).trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/[^0-9A-Za-z]/g, "");
  return normalized || null;
}

function extractIdFromRequest(req) {
  if (!req || typeof req !== "object") return null;
  if (typeof req.body === "string") {
    const match = req.body.match(/parid=([0-9A-Za-z]+)/i);
    if (match) return match[1];
  }
  const mvqs = req.multiValueQueryString || {};
  const idLists = mvqs.ID || mvqs.Id || mvqs.id;
  if (Array.isArray(idLists) && idLists[0]) return idLists[0];
  const singleId = mvqs.ID || mvqs.Id || mvqs.id;
  if (typeof singleId === "string" && singleId) return singleId;
  return null;
}

function extractIdFromHtml($doc) {
  if (!$doc) return null;
  const title =
    $doc("span#lblPageTitle").text() || $doc("span.PageTitle").text();
  if (title) {
    const m = title.match(/#\s*([0-9A-Za-z]+)/);
    if (m) return m[1];
  }
  const hidden = $doc("input#txtAccountNumber").val();
  if (hidden) return hidden.trim();
  return null;
}

function hasMeaningfulValues(obj, excludeKeys = []) {
  if (!obj || typeof obj !== "object") return false;
  return Object.entries(obj).some(([key, val]) => {
    if (excludeKeys.includes(key)) return false;
    if (Array.isArray(val)) return val.length > 0;
    // Treat false, "Unknown", and null/undefined as non-meaningful
    if (val === false || val === "Unknown" || val === null || val === undefined || val === "") return false;
    return true;
  });
}

async function readJson(p) {
  const txt = await fsp.readFile(p, "utf8");
  return JSON.parse(txt);
}

async function main() {
  const dataDir = path.join(".", "data");
  await ensureDir(dataDir);
  await Promise.all([
    removeIfMatch(dataDir, /^tax_class_\d+\.json$/),
    removeIfMatch(dataDir, /^tax_jurisdiction_.*\.json$/),
    removeIfMatch(dataDir, /^tax_exemption_\d+_.*\.json$/),
    removeIfMatch(dataDir, /^sales_\d+\.json$/),
    removeIfMatch(dataDir, /^deed_\d+\.json$/),
    removeIfMatch(dataDir, /^layout_\d+\.json$/),
    removeIfMatch(dataDir, /^person_\d+\.json$/),
    removeIfMatch(dataDir, /^company_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_sales_person_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_sales_company_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_sales_deed_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_property_(address|lot)\.json$/),
    removeIfMatch(dataDir, /^relationship_property_sales_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_property_tax_class_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_tax_class_\d+_jurisdiction_.*\.json$/),
    removeIfMatch(dataDir, /^relationship_jurisdiction_.*_exemption_\d+\.json$/),
    removeIfMatch(dataDir, /^relationship_person_\d+_mailing_address\.json$/),
    removeIfMatch(dataDir, /^relationship_company_\d+_mailing_address\.json$/),
    fsp.unlink(path.join(dataDir, "mailing_address.json")).catch(() => {}),
  ]);

  const inputPath = path.join(".", "input.json");
  const addressPath = path.join(".", "address.json");
  const unnormalizedAddressPath = path.join(".", "unnormalized_address.json");
  const parcelPath = path.join(".", "parcel.json");
  const ownersPath = path.join(".", "owners", "owner_data.json");
  const utilitiesPath = path.join(".", "owners", "utilities_data.json");
  const layoutPath = path.join(".", "owners", "layout_data.json");

  const input = fs.existsSync(inputPath) ? await readJson(inputPath) : {};
  const addressData = fs.existsSync(addressPath) ? await readJson(addressPath) : {};
  const unnormalizedAddress = fs.existsSync(unnormalizedAddressPath) ? await readJson(unnormalizedAddressPath) : {};
  const address = { ...addressData, ...unnormalizedAddress };
  const parcel = fs.existsSync(parcelPath) ? await readJson(parcelPath) : {};
  const ownersData = fs.existsSync(ownersPath)
    ? await readJson(ownersPath)
    : {};
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? await readJson(utilitiesPath)
    : {};
  const layoutData = fs.existsSync(layoutPath)
    ? await readJson(layoutPath)
    : {};

  const isMulti = (obj) =>
    obj &&
    typeof obj === "object" &&
    "source_http_request" in obj &&
    "response" in obj;

  const ownersAndGen = input.OwnersAndGeneralInformation || {};
  const history = input.History || {};

  const ownersAndGenSource = ownersAndGen.source_http_request || null;
  const historySource = history.source_http_request || null;

  const ownersAndGenHtml = isMulti(ownersAndGen) ? ownersAndGen.response : null;
  const historyHtml = isMulti(history) ? history.response : null;

  const $own = ownersAndGenHtml ? cheerio.load(ownersAndGenHtml) : null;
  const $hist = historyHtml ? cheerio.load(historyHtml) : null;

  const parcelCandidates = [
    parcel?.parcel_id,
    address?.parcel_identifier,
    extractIdFromRequest(ownersAndGenSource),
    extractIdFromRequest(historySource),
    extractIdFromHtml($own),
    extractIdFromHtml($hist),
  ];
  const parcelId =
    parcelCandidates.map((val) => normalizeParcelId(val)).find(Boolean) ||
    "unknown_id";
  const propertyKey = `property_${parcelId}`;
  const ownersForProp = ownersData[propertyKey] || {};
  const ownersByDate = ownersForProp.owners_by_date || {};
  const mailingAddressRaw = ownersForProp.mailing_address || null;
  const utilitiesForProperty = utilitiesData[propertyKey] || {};
  const layoutEntry = layoutData[propertyKey] || {};
  const layoutList =
    layoutEntry && Array.isArray(layoutEntry.layouts)
      ? layoutEntry.layouts
      : [];
  const layouts = [...layoutList];
  const layoutCounts = new Map();
  const reserveLayoutIndex = (spaceType) => {
    const key = spaceType || "Unspecified";
    const next = (layoutCounts.get(key) || 0) + 1;
    layoutCounts.set(key, next);
    return next;
  };
  for (const entry of layouts) {
    const type = entry.space_type || "Unspecified";
    const existing = layoutCounts.get(type) || 0;
    const idx =
      entry.space_type_index && !Number.isNaN(parseInt(entry.space_type_index, 10))
        ? parseInt(entry.space_type_index, 10)
        : null;
    if (Number.isFinite(idx)) {
      layoutCounts.set(type, Math.max(existing, idx));
    } else {
      layoutCounts.set(type, existing + 1);
      entry.space_type_index = String(existing + 1);
    }
    if (typeof entry.is_exterior !== "boolean") {
      entry.is_exterior = false;
    }
    if (typeof entry.is_finished !== "boolean") {
      entry.is_finished = true;
    }
  }

  if ($own && $own("#ResImp1_dgImp").length) {
    const rows = $own("#ResImp1_dgImp tr");
    rows.each((rowIdx, row) => {
      if (rowIdx === 0) return;
      const cells = $own(row).find("td");
      if (!cells || cells.length < 2) return;
      const typeText = cleanText($own(cells[1]).text());
      if (!typeText || /NO ADDITIONAL IMPROVEMENTS/i.test(typeText)) return;
      const mapped = mapImprovementToLayout(typeText);
      if (!mapped || !mapped.spaceType) return;
      const areaText = cells[5] ? cleanText($own(cells[5]).text()) : null;
      const areaSqft = parseIntLoose(areaText);
      const constructionText = cells[2] ? cleanText($own(cells[2]).text()) : "";
      const extraText = [typeText, constructionText]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();
      const isIncomplete = /(UNFIN|INCOMP)/.test(extraText);
      const nextIndex = reserveLayoutIndex(mapped.spaceType);
      layouts.push({
        space_type: mapped.spaceType,
        space_type_index: String(nextIndex),
        size_square_feet: areaSqft != null ? areaSqft : null,
        is_exterior:
          typeof mapped.isExterior === "boolean" ? mapped.isExterior : false,
        is_finished: isIncomplete ? false : true,
      });
    });
  }

  const kitchenCount = $own
    ? parseIntLoose(cleanText($own("#MainImpRes1_lblKitchen").text()))
    : null;
  if (kitchenCount && kitchenCount > 0) {
    for (let i = 0; i < kitchenCount; i++) {
      const nextIndex = reserveLayoutIndex("Kitchen");
      layouts.push({
        space_type: "Kitchen",
        space_type_index: String(nextIndex),
        size_square_feet: null,
        is_exterior: false,
        is_finished: true,
      });
    }
  }

  const fireplaceCount = $own
    ? parseIntLoose(cleanText($own("#MainImpRes1_lblFP").text()))
    : null;
  if (fireplaceCount && fireplaceCount > 0) {
    for (let i = 0; i < fireplaceCount; i++) {
      const nextIndex = reserveLayoutIndex("Building");
      layouts.push({
        space_type: "Building",
        space_type_index: String(nextIndex),
        size_square_feet: null,
        is_exterior: false,
        is_finished: true,
      });
    }
  }

  let legalParts = [];
  let subdivision = null;
  let zoning = null;
  let yearBuilt = null;
  let landStateCode = null;
  let legalInstrumentNumber = null;
  let parsedBlockLot = { block: null, lot: null };

  if ($own) {
    const l1 = cleanText($own("#LegalDesc1_lblLegal1").text());
    const l2 = cleanText($own("#LegalDesc1_lblLegal2").text());
    const l3 = cleanText($own("#LegalDesc1_lblLegal3").text());
    const l4 = cleanText($own("#LegalDesc1_lblLegal4").text());
    const l5 = cleanText($own("#LegalDesc1_lblLegal5").text());
    [l1, l2, l3, l4, l5].forEach((v) => {
      if (v) {
        legalParts.push(v);
        if (!legalInstrumentNumber) {
          const maybeInst = extractInstrumentNumber(v);
          if (maybeInst) legalInstrumentNumber = maybeInst;
        }
      }
    });
    subdivision = l1 || null;
    parsedBlockLot = extractBlockLot([l1, l2, l3, l4, l5]);

    try {
      const landRow = $own("#Land1_dgLand tr").eq(1);
      const tds = landRow.find("td");
      landStateCode = cleanText($own(tds.eq(1)).text());
      zoning = cleanText($own(tds.eq(2)).text());
    } catch (e) {
      /* ignore */
    }

    const yb = cleanText($own("#MainImpRes1_lblYearBuilt").text());
    if (yb && /^\d{4}$/.test(yb)) yearBuilt = parseInt(yb, 10);
  }

  const legalText = legalParts.length ? legalParts.join("; ") : null;
  const livingAreaText = $own
    ? cleanText($own("#MainImpRes1_lblLivingArea").text())
    : null;
  const hasLivingAreaData = !!(livingAreaText && /\d/.test(livingAreaText));
  const hasLayoutSignals = layouts.length > 0;
  const hasUtilitySignals = hasMeaningfulValues(utilitiesForProperty, ['source_http_request', 'request_identifier']);
  const landCodeUpper = landStateCode ? landStateCode.toUpperCase() : "";

  // Determine property type from landStateCode or infer from data
  let propType = landStateCode ? mapPropertyType(landStateCode) : null;

  // If property type is null, infer from available data
  if (!propType) {
    if (yearBuilt || hasLayoutSignals || hasUtilitySignals || hasLivingAreaData) {
      // Has improvement indicators - default to SingleFamily as most common residential
      propType = "SingleFamily";
    } else {
      // No improvement indicators - likely vacant land
      propType = "VacantLand";
    }
  }

  // Determine build_status based on property type
  let buildStatus = null;
  if (propType === "VacantLand") {
    buildStatus = "VacantLand";
  } else if (landCodeUpper.includes("CONST")) {
    buildStatus = "UnderConstruction";
  } else if (
    (propType && propType !== "VacantLand") ||
    yearBuilt ||
    hasLayoutSignals ||
    hasUtilitySignals ||
    hasLivingAreaData
  ) {
    buildStatus = "Improved";
  } else {
    buildStatus = "VacantLand";
  }

  const propertyOut = {
    source_http_request: ownersAndGenSource,
    parcel_identifier: parcelId || null,
    property_legal_description_text: legalText,
    property_type: propType,
    property_structure_built_year: yearBuilt || null,
    subdivision: subdivision || null,
    zoning: zoning || null,
    build_status: buildStatus,
    number_of_units: null,
    ownership_estate_type: null,
    property_usage_type: null,
    structure_form: null,
  };
  await fsp.writeFile(
    path.join(dataDir, "property.json"),
    JSON.stringify(propertyOut, null, 2),
  );

  const streetFromHtml = $own
    ? normalizeAddressLine($own("#PropAddr1_lblPropAddr").text())
    : null;
  const mailingParsed = parseFullAddress(
    mailingAddressRaw ||
      address.unnormalized_address ||
      address.full_address ||
      null,
  );
  const streetLine = streetFromHtml || mailingParsed.street || null;
  const streetParts = splitStreetComponents(streetLine);
  const nameDetails = parseStreetNameDetails(streetParts.name);
  const resolvedCityRaw =
    address.city_name ||
    (mailingParsed.city && mailingParsed.city.length
      ? mailingParsed.city
      : null);
  const resolvedCity =
    resolvedCityRaw && resolvedCityRaw.trim().length
      ? resolvedCityRaw
      : "DALLAS";
  const stateCode =
    normalizeStateCode(address.state_code || mailingParsed.stateCode || "TX") ||
    "TX";
  const postalDigits =
    (address.postal_code && address.postal_code.replace(/\D/g, "")) ||
    (mailingParsed.postal && mailingParsed.postal.replace(/\D/g, "")) ||
    null;
  const postalCode =
    postalDigits && postalDigits.length >= 5
      ? postalDigits.slice(0, 5)
      : null;
  const plusFour =
    address.plus_four_postal_code ||
    mailingParsed.plus4 ||
    (postalDigits && postalDigits.length > 5
      ? postalDigits.slice(5, Math.min(postalDigits.length, 9))
      : null);
  const countyName =
    address.county_name && address.county_name.trim().length
      ? address.county_name
      : "Dallas";
  const streetNumber = address.street_number || streetParts.number || null;
  const streetNameBase =
    address.street_name ||
    (nameDetails.base ? nameDetails.base : streetParts.name || null);
  const streetSuffixType =
    address.street_suffix_type || nameDetails.suffix || null;
  const streetPreDir =
    address.street_pre_directional_text || nameDetails.preDirectional || null;
  const streetPostDir =
    address.street_post_directional_text || nameDetails.postDirectional || null;
  const countryCode =
    (address.country_code && address.country_code.toUpperCase()) || "US";
  const routeNumber = address.route_number || null;
  const townshipVal = address.township || null;
  const rangeVal = address.range || null;
  const sectionVal = address.section || null;
  const unitIdentifier = address.unit_identifier || null;
  const blockVal = address.block || parsedBlockLot.block || null;
  const lotVal = address.lot || parsedBlockLot.lot || null;
  const ensureCityFormat = (val) =>
    val ? val.replace(/\s+/g, " ").trim().toUpperCase() : null;
  const cityFormatted = ensureCityFormat(resolvedCity);
  const unnormalizedAddr =
    address.unnormalized_address ||
    address.full_address ||
    null;

  // Use normalized address format with street-level fields IF we have sufficient data
  // Otherwise use unnormalized format
  const hasNormalizedData = streetNumber && streetNameBase;

  const addrOut = hasNormalizedData ? {
    source_http_request: address.source_http_request || null,
    request_identifier: address.request_identifier || null,
    unnormalized_address: null,
    street_number: streetNumber,
    street_name: streetNameBase,
    street_suffix_type: streetSuffixType,
    street_pre_directional_text: streetPreDir,
    street_post_directional_text: streetPostDir,
    unit_identifier: unitIdentifier,
    route_number: routeNumber,
    township: townshipVal,
    range: rangeVal,
    section: sectionVal,
    city_name: cityFormatted,
    state_code: stateCode,
    postal_code: postalCode,
    plus_four_postal_code: plusFour,
    county_name: countyName,
    country_code: countryCode,
    block: blockVal,
    lot: lotVal,
  } : {
    source_http_request: address.source_http_request || null,
    request_identifier: address.request_identifier || null,
    unnormalized_address: unnormalizedAddr,
    county_name: countyName,
    country_code: countryCode,
  };
  await fsp.writeFile(
    path.join(dataDir, "address.json"),
    JSON.stringify(addrOut, null, 2),
  );

  // MAILING ADDRESS (unnormalized format - oneOf schema)
  if (mailingAddressRaw) {
    const mailingParsed = parseFullAddress(mailingAddressRaw);

    const mailingCityRaw = mailingParsed.city || null;
    const mailingCity = mailingCityRaw && mailingCityRaw.trim().length ? mailingCityRaw : null;
    const mailingStateCode = normalizeStateCode(mailingParsed.stateCode || null);
    const mailingPostalDigits = (mailingParsed.postal && mailingParsed.postal.replace(/\D/g, "")) || null;
    const mailingPostalCode = mailingPostalDigits && mailingPostalDigits.length >= 5 ? mailingPostalDigits.slice(0, 5) : null;
    const mailingPlusFour = mailingParsed.plus4 || (mailingPostalDigits && mailingPostalDigits.length > 5 ? mailingPostalDigits.slice(5, Math.min(mailingPostalDigits.length, 9)) : null);

    const ensureCityFormatMailing = (val) => val ? val.replace(/\s+/g, " ").trim().toUpperCase() : null;
    const mailingCityFormatted = ensureCityFormatMailing(mailingCity);

    const mailingAddrOut = {
      source_http_request: ownersAndGenSource,
      request_identifier: parcelId || null,
      unnormalized_address: mailingAddressRaw,
      county_name: "Dallas",
      country_code: "US",
    };
    await fsp.writeFile(
      path.join(dataDir, "mailing_address.json"),
      JSON.stringify(mailingAddrOut, null, 2),
    );
  }

  // LOT
  let lot_length = null;
  let lot_width = null;
  let fenceType = null;
  if ($own) {
    try {
      const landRow = $own("#Land1_dgLand tr").eq(1);
      const tds = landRow.find("td");
      const frontage = cleanText($own(tds.eq(3)).text());
      const depth = cleanText($own(tds.eq(4)).text());
    lot_length = frontage ? parseInt(frontage, 10) : null;
    lot_width = depth ? parseInt(depth, 10) : null;
  } catch (e) {
    /* ignore */
  }
  const fenceTxt = cleanText($own("#MainImpRes1_lblFence").text());
  fenceType = mapFence(fenceTxt);
  }

  const lotOut = {
    source_http_request: ownersAndGenSource,
    lot_type: null,
    lot_length_feet: Number.isFinite(lot_length)
      ? lot_length === 0
        ? null
        : lot_length
      : null,
    lot_width_feet: Number.isFinite(lot_width)
      ? lot_width === 0
        ? null
        : lot_width
      : null,
    lot_area_sqft: null,
    landscaping_features: null,
    view: null,
    fencing_type: fenceType ?? null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    paving_area_sqft: null,
    paving_installation_date: null,
    paving_type: "None",
    site_lighting_fixture_count: null,
    site_lighting_installation_date: null,
    site_lighting_type: "None",
  };
  await fsp.writeFile(
    path.join(dataDir, "lot.json"),
    JSON.stringify(lotOut, null, 2),
  );

  // TAX HISTORY WITH HIERARCHICAL STRUCTURE
  // Entity 1: Tax Class (root record per year)
  // Entity 2: Tax Jurisdiction (one per jurisdiction type)
  // Entity 3: Tax Exemption (one per year per jurisdiction)
  const marketByYear = {};
  const taxByYearCity = {};

  // Extract jurisdiction and exemption information by year from History page
  const jurisdictions = [];
  const exemptionsByYearAndJurisdiction = {}; // { 2025: { city: {...}, school: {...}, ... } }
  const taxableValuesByYearAndJurisdiction = {}; // { 2025: { city: 617584, ... } }
  const taxRatesByYearAndJurisdiction = {}; // { 2025: { city: 0.025, ... } }

  if ($hist) {
    // Find the exemptions/taxable values table in History page
    $hist("table").each((ti, tbl) => {
      const $t = $hist(tbl);
      const tableText = $t.text();

      // Process tables with jurisdiction information (may or may not have exemptions for all years)
      if (tableText.includes("Taxing Jurisdiction") && (tableText.includes("Taxable Value") || tableText.includes("HOMESTEAD EXEMPTION"))) {
        const rows = $t.find("tr");
        let currentYear = null;
        // Map internal types to valid enum values
        const jurisTypes = ["City", "School", "County", "College", "Hospital", "Special District"];
        const jurisTypeEnumMap = {
          "City": "Municipal",
          "School": "Independent School District",
          "County": "County",
          "College": "Community College District",
          "Hospital": "Hospital District",
          "Special District": "Special District"
        };

        rows.each((ri, row) => {
          const $row = $hist(row);
          const cells = $row.find("th, td");
          const rowText = cleanText($row.text());

          // Check if this row starts with a year (e.g., "2025" or "1999")
          const yearMatch = rowText.match(/^((?:19|20)\d{2})\b/);
          if (yearMatch) {
            currentYear = parseInt(yearMatch[1], 10);
          }

          // Look for jurisdiction names row - check first cell/th for "Taxing Jurisdiction"
          if (currentYear && jurisdictions.length === 0) {
            const firstCell = $row.find("th, td").first();
            const firstCellText = cleanText($hist(firstCell).text());
            if (firstCellText === "Taxing Jurisdiction") {
              const jurisCells = $row.find("td");
              if (jurisCells.length >= 6) {
                // Extract jurisdiction names from each cell, create all 6 jurisdictions
                for (let i = 0; i < Math.min(jurisCells.length, jurisTypes.length); i++) {
                  let jurisName = cleanText($hist(jurisCells.eq(i)).text());
                  const jurisType = jurisTypes[i];
                  const slug = jurisType.toLowerCase().replace(/\s+/g, "_");
                  // If jurisdiction is UNASSIGNED or N/A, use a default name based on type
                  if (!jurisName || jurisName === "UNASSIGNED" || jurisName === "N/A") {
                    jurisName = `Unassigned ${jurisType}`;
                  }
                  jurisdictions.push({
                    type: jurisTypeEnumMap[jurisType] || jurisType,
                    name: jurisName,
                    slug: slug
                  });
                }
              }
            }
          }

          // Look for exemption amounts row - check first cell for any EXEMPTION type
          if (currentYear) {
            const firstCell = $row.find("th, td").first();
            const firstCellText = cleanText($hist(firstCell).text());
            if (firstCellText && firstCellText.toUpperCase().includes("EXEMPTION")) {
              const exemptCells = $row.find("td");
              if (exemptCells.length >= 6) {
                if (!exemptionsByYearAndJurisdiction[currentYear]) {
                  exemptionsByYearAndJurisdiction[currentYear] = {};
                }
                const exemptionType = mapExemptionType(firstCellText);
                for (let i = 0; i < Math.min(exemptCells.length, jurisTypes.length); i++) {
                  const slug = jurisTypes[i].toLowerCase().replace(/\s+/g, "_");
                  const exemptAmount = parseCurrency($hist(exemptCells.eq(i)).text());
                  if (!exemptionsByYearAndJurisdiction[currentYear][slug]) {
                    exemptionsByYearAndJurisdiction[currentYear][slug] = [];
                  }
                  // Store as array of exemptions per jurisdiction
                  exemptionsByYearAndJurisdiction[currentYear][slug].push({
                    exemption_type: exemptionType,
                    exemption_value: exemptAmount
                  });
                }
              }
            }
          }

          // Look for taxable value row - check first cell for "Taxable Value"
          if (currentYear) {
            const firstCell = $row.find("th, td").first();
            const firstCellText = cleanText($hist(firstCell).text());
            if (firstCellText === "Taxable Value") {
              const taxableCells = $row.find("td");
              if (taxableCells.length >= 6) {
                if (!taxableValuesByYearAndJurisdiction[currentYear]) {
                  taxableValuesByYearAndJurisdiction[currentYear] = {};
                }
                for (let i = 0; i < Math.min(taxableCells.length, jurisTypes.length); i++) {
                  const slug = jurisTypes[i].toLowerCase().replace(/\s+/g, "_");
                  const taxableValue = parseCurrency($hist(taxableCells.eq(i)).text());
                  taxableValuesByYearAndJurisdiction[currentYear][slug] = taxableValue;
                }
              }
            }
          }
        });
      }
    });
  }

  if ($hist) {
    const $mvRows = $hist("#MarketHistory1_dgMarketHist tr");
    $mvRows.each((i, el) => {
      if (i === 0) return;
      const tds = $hist(el).find("td");
      if (tds.length >= 5) {
        const year = parseInt(cleanText($hist(tds.eq(0)).text()), 10);
        if (Number.isNaN(year)) return;
        const imp = parseCurrency($hist(tds.eq(1)).text());
        const land = parseCurrency($hist(tds.eq(2)).text());
        const total = parseCurrency($hist(tds.eq(3)).text());
        const cappedRaw = cleanText($hist(tds.eq(4)).text());
        const capped = parseCurrency(cappedRaw);
        marketByYear[year] = { imp, land, total, cappedRaw, capped };
      }
    });
    const $txRows = $hist("#TaxHistory1_dgTaxHistory tr");
    $txRows.each((i, el) => {
      if (i === 0) return;
      const tds = $hist(el).find("td");
      if (tds.length >= 7) {
        const year = parseInt(cleanText($hist(tds.eq(0)).text()), 10);
        if (Number.isNaN(year)) return;

        // Extract all 6 jurisdiction taxable values from Tax History table
        // Columns: Year, City, ISD, County, College, Hospital, Special District
        if (!taxableValuesByYearAndJurisdiction[year]) {
          taxableValuesByYearAndJurisdiction[year] = {};
        }
        taxableValuesByYearAndJurisdiction[year].city = parseCurrency($hist(tds.eq(1)).text());
        taxableValuesByYearAndJurisdiction[year].school = parseCurrency($hist(tds.eq(2)).text());
        taxableValuesByYearAndJurisdiction[year].county = parseCurrency($hist(tds.eq(3)).text());
        taxableValuesByYearAndJurisdiction[year].college = parseCurrency($hist(tds.eq(4)).text());
        taxableValuesByYearAndJurisdiction[year].hospital = parseCurrency($hist(tds.eq(5)).text());
        taxableValuesByYearAndJurisdiction[year].special_district = parseCurrency($hist(tds.eq(6)).text());

        // Keep backward compatibility with taxByYearCity
        taxByYearCity[year] = taxableValuesByYearAndJurisdiction[year].city;
      }
    });

    const years = Object.keys(marketByYear)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);

    // STEP 1: Create Tax Jurisdiction entities (one per jurisdiction type)
    for (const juris of jurisdictions) {
      const taxJurisdictionOut = {
        source_http_request: historySource,
        request_identifier: parcelId,
        jurisdiction_name: juris.name,
        jurisdiction_type: juris.type,
      };
      await fsp.writeFile(
        path.join(dataDir, `tax_jurisdiction_${juris.slug}.json`),
        JSON.stringify(taxJurisdictionOut, null, 2),
      );
    }

    // STEP 2: Create Tax Class and Tax Exemption entities for each year
    for (const year of years) {
      const m = marketByYear[year];

      // Calculate aggregate values for Tax Class
      const yearExemptions = exemptionsByYearAndJurisdiction[year] || {};
      const yearTaxableValues = taxableValuesByYearAndJurisdiction[year] || {};

      // Aggregate taxable values by jurisdiction type (use 0 instead of null for required number fields)
      const cityTaxable = yearTaxableValues.city || 0;
      const countyTaxable = yearTaxableValues.county || 0;
      const collegeTaxable = yearTaxableValues.college || 0;
      const hospitalTaxable = yearTaxableValues.hospital || 0;
      const schoolTaxable = yearTaxableValues.school || 0;
      const specialDistrictTaxable = yearTaxableValues.special_district || 0;

      // Aggregate exemption values
      const cityExemption = yearExemptions.city?.exemption_value || null;
      const countyExemption = yearExemptions.county?.exemption_value || null;
      const collegeExemption = yearExemptions.college?.exemption_value || null;
      const hospitalExemption = yearExemptions.hospital?.exemption_value || null;
      const schoolExemption = yearExemptions.school?.exemption_value || null;
      const specialDistrictExemption = yearExemptions.special_district?.exemption_value || null;

      // Set property_exemption_amount to 0 (no separate field in website)
      const totalExemption = 0;

      // Create Tax Class entity (root record for the year)
      const taxClassOut = {
        source_http_request: historySource,
        tax_year: year,
        property_assessed_value_amount: 0, // Not present in Dallas County (Texas is non-assessment state)
        property_market_value_amount: m.total || 0,
        property_building_amount: m.imp || 0,
        property_land_amount: m.land || 0,
        property_exemption_amount: totalExemption,
        property_taxable_value_amount: 0, // Not present as single value (only jurisdiction-specific values exist)
        city_taxable_value_amount: cityTaxable,
        county_taxable_value_amount: countyTaxable,
        college_taxable_value_amount: collegeTaxable,
        hospital_taxable_value_amount: hospitalTaxable,
        school_taxable_value_amount: schoolTaxable,
        special_district_taxable_value_amount: specialDistrictTaxable,
        agricultural_valuation_amount: 0,
        homestead_cap_loss_amount: 0,
        building_replacement_cost_amount: 0,
        building_depreciated_value_amount: 0,
        millage_rate: 0,
        monthly_tax_amount: 0,
        yearly_tax_amount: 0,
        period_end_date: null,
        period_start_date: null,
        first_year_on_tax_roll: null,
        first_year_building_on_tax_roll: null,
      };
      await fsp.writeFile(
        path.join(dataDir, `tax_class_${year}.json`),
        JSON.stringify(taxClassOut, null, 2),
      );

      // STEP 3: Create Tax Exemption entities for each jurisdiction and exemption type
      for (const juris of jurisdictions) {
        const exemptionsArray = yearExemptions[juris.slug] || [];
        const taxableValue = yearTaxableValues[juris.slug] || 0;

        if (exemptionsArray.length === 0) {
          // No exemptions for this jurisdiction in this year - create a placeholder with null type
          const taxExemptionOut = {
            source_http_request: historySource,
            request_identifier: parcelId,
            tax_year: year,
            tax_rate: 0,
            exemption_type: null,
            exemption_value: 0,
            taxable_value_amount: taxableValue,
          };
          await fsp.writeFile(
            path.join(dataDir, `tax_exemption_${year}_${juris.slug}.json`),
            JSON.stringify(taxExemptionOut, null, 2),
          );
        } else {
          // Create separate exemption file for each exemption type
          for (let exemptIdx = 0; exemptIdx < exemptionsArray.length; exemptIdx++) {
            const exemptData = exemptionsArray[exemptIdx];
            const taxExemptionOut = {
              source_http_request: historySource,
              request_identifier: parcelId,
              tax_year: year,
              tax_rate: 0,
              exemption_type: exemptData.exemption_type || null,
              exemption_value: exemptData.exemption_value || 0,
              taxable_value_amount: taxableValue,
            };
            // Use exemption type in filename to make it unique
            const exemptTypeSlug = (exemptData.exemption_type || 'none').toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
            await fsp.writeFile(
              path.join(dataDir, `tax_exemption_${year}_${juris.slug}_${exemptTypeSlug}.json`),
              JSON.stringify(taxExemptionOut, null, 2),
            );
          }
        }
      }

      // STEP 4: Create relationships: Tax Class -> Tax Jurisdiction
      for (const juris of jurisdictions) {
        const relOut = {
          from: { "/": `./tax_class_${year}.json` },
          to: { "/": `./tax_jurisdiction_${juris.slug}.json` },
        };
        await fsp.writeFile(
          path.join(dataDir, `relationship_tax_class_${year}_jurisdiction_${juris.slug}.json`),
          JSON.stringify(relOut, null, 2),
        );
      }

      // STEP 5: Create relationships: Tax Jurisdiction -> Tax Exemption (for all exemption types)
      for (const juris of jurisdictions) {
        const exemptionsArray = yearExemptions[juris.slug] || [];

        if (exemptionsArray.length === 0) {
          // No exemptions - create relationship to the placeholder exemption file
          const relOut = {
            from: { "/": `./tax_jurisdiction_${juris.slug}.json` },
            to: { "/": `./tax_exemption_${year}_${juris.slug}.json` },
          };
          await fsp.writeFile(
            path.join(dataDir, `relationship_jurisdiction_${juris.slug}_exemption_${year}.json`),
            JSON.stringify(relOut, null, 2),
          );
        } else {
          // Create relationship for each exemption type
          for (let exemptIdx = 0; exemptIdx < exemptionsArray.length; exemptIdx++) {
            const exemptData = exemptionsArray[exemptIdx];
            const exemptTypeSlug = (exemptData.exemption_type || 'none').toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
            const relOut = {
              from: { "/": `./tax_jurisdiction_${juris.slug}.json` },
              to: { "/": `./tax_exemption_${year}_${juris.slug}_${exemptTypeSlug}.json` },
            };
            await fsp.writeFile(
              path.join(dataDir, `relationship_jurisdiction_${juris.slug}_exemption_${year}_${exemptTypeSlug}.json`),
              JSON.stringify(relOut, null, 2),
            );
          }
        }
      }
    }
  }

  // SALES
  const sales = [];
  if ($hist) {
    $hist('span:contains("Deed Transfer Date:")').each((i, el) => {
      const $row = $hist(el).parent();
      const dateSpan = $row.find("span").last();
      const iso = toISODate(cleanText($hist(dateSpan).text()));
      if (iso) {
        sales.push({ date: iso, source: historySource });
      }
    });
  }
  const uniq = Array.from(new Set(sales.map((s) => s.date))).sort();
  const salesList = uniq.map((d) => ({ date: d, source: historySource }));

  if ($own) {
    const iso = toISODate(cleanText($own("#LegalDesc1_lblSaleDate").text()));
    if (iso && !salesList.find((s) => s.date === iso)) {
      salesList.push({ date: iso, source: ownersAndGenSource });
    }
  }
  salesList.sort((a, b) => a.date.localeCompare(b.date));

  // Check if we need to add an initial sales record for original ownership
  // If tax records exist before the earliest deed transfer, create initial sale
  const years = Object.keys(marketByYear).map((y) => parseInt(y, 10)).sort((a, b) => a - b);
  if (years.length > 0 && salesList.length > 0) {
    const earliestTaxYear = years[0];
    const earliestSaleYear = parseInt(salesList[0].date.substring(0, 4), 10);
    if (earliestTaxYear < earliestSaleYear) {
      // Add initial sales record for original ownership
      const initialSaleDate = `${earliestTaxYear}-01-01`;
      salesList.unshift({ date: initialSaleDate, source: historySource });
    }
  } else if (years.length > 0 && salesList.length === 0) {
    // No deed transfers found, but tax records exist - create initial sale
    const initialSaleDate = `${years[0]}-01-01`;
    salesList.push({ date: initialSaleDate, source: historySource });
  }

  for (let i = 0; i < salesList.length; i++) {
    const s = salesList[i];
    const saleOut = {
      source_http_request: s.source || null,
      request_identifier: parcelId,
      ownership_transfer_date: s.date,
    };
    await fsp.writeFile(
      path.join(dataDir, `sales_${i + 1}.json`),
      JSON.stringify(saleOut, null, 2),
    );
  }

  // DEEDS
  const deedMapByDate = new Map();
  if ($hist) {
    $hist("table").each((ti, tbl) => {
      const $t = $hist(tbl);
      const dateSpan = $t.find('span[id$="_lblSaleDate"]').first();
      const dateIso = toISODate(cleanText($hist(dateSpan).text()));
      if (dateIso) {
        const textConcat = cleanText($t.text());
        const inst = extractInstrumentNumber(textConcat);
        deedMapByDate.set(dateIso, {
          instrument_number: inst,
          source: historySource,
        });
      }
    });
  }
  if ($own) {
    const legal4 = cleanText($own("#LegalDesc1_lblLegal4").text());
    const dateIso = toISODate(
      cleanText($own("#LegalDesc1_lblSaleDate").text()),
    );
    if (dateIso) {
      const inst = extractInstrumentNumber(legal4);
      deedMapByDate.set(dateIso, {
        instrument_number: inst,
        source: ownersAndGenSource,
      });
    }
  }

  for (let i = 0; i < salesList.length; i++) {
    const s = salesList[i];
    const d = deedMapByDate.get(s.date) || {
      source: s.source,
    };
    const deedOut = {
      source_http_request: d.source || null,
      request_identifier: parcelId,
    };
    const instrumentNumber = d.instrument_number || null;
    if (instrumentNumber) {
      deedOut.instrument_number = instrumentNumber;
    }
    await fsp.writeFile(
      path.join(dataDir, `deed_${i + 1}.json`),
      JSON.stringify(deedOut, null, 2),
    );
  }

  // STRUCTURE (enhanced mappings)
  let stories = null;
  let roofDesign = null;
  let roofCovering = null;
  let roofMaterialType = null;
  let foundationType = null;
  let exteriorPrimary = null;
  let primaryFrame = null;
  if ($own) {
    const st = (
      cleanText($own("#MainImpRes1_lblNumStories").text()) || ""
    ).toUpperCase();
    if (st.includes("ONE")) stories = 1;
    else if (st.includes("TWO")) stories = 2;
    roofDesign = mapRoofDesignType(
      cleanText($own("#MainImpRes1_lblRoofType").text()),
    );
    const roofMatTxt = cleanText($own("#MainImpRes1_lblRoofMat").text());
    const rc = mapRoofCovering(roofMatTxt);
    roofCovering = rc.roof_covering_material;
    roofMaterialType = rc.roof_material_type;
    foundationType = mapFoundationType(
      cleanText($own("#MainImpRes1_lblFoundType").text()),
    );
    exteriorPrimary = mapExteriorWall(
      cleanText($own("#MainImpRes1_lblExtWall").text()),
    );
    primaryFrame = mapFraming(
      cleanText($own("#MainImpRes1_lblConstrType").text()),
    );
  }
  const structureOut = {
    source_http_request: ownersAndGenSource,
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exteriorPrimary ?? null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: roofCovering ?? null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: roofDesign ?? null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roofMaterialType ?? null,
    foundation_type: foundationType ?? null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: primaryFrame ?? null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: stories,
  };
  // Only write structure.json if there's meaningful structure data
  if (hasMeaningfulValues(structureOut, ['source_http_request', 'request_identifier'])) {
    await fsp.writeFile(
      path.join(dataDir, "structure.json"),
      JSON.stringify(structureOut, null, 2),
    );
  }

  // UTILITIES
  const utilSrc = utilitiesForProperty;
  const utilityOut = {
    cooling_system_type: utilSrc.cooling_system_type ?? null,
    heating_system_type: utilSrc.heating_system_type ?? null,
    public_utility_type: utilSrc.public_utility_type ?? null,
    sewer_type: utilSrc.sewer_type ?? null,
    water_source_type: utilSrc.water_source_type ?? null,
    plumbing_system_type: utilSrc.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      utilSrc.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: utilSrc.electrical_panel_capacity ?? null,
    electrical_wiring_type: utilSrc.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: utilSrc.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      utilSrc.electrical_wiring_type_other_description ?? null,
    solar_panel_present: utilSrc.solar_panel_present ?? null,
    solar_panel_type: utilSrc.solar_panel_type ?? null,
    solar_panel_type_other_description:
      utilSrc.solar_panel_type_other_description ?? null,
    smart_home_features: utilSrc.smart_home_features ?? null,
    smart_home_features_other_description:
      utilSrc.smart_home_features_other_description ?? null,
    hvac_unit_condition: utilSrc.hvac_unit_condition ?? null,
    solar_inverter_visible: utilSrc.solar_inverter_visible ?? null,
    hvac_unit_issues: utilSrc.hvac_unit_issues ?? null,
    electrical_panel_installation_date:
      utilSrc.electrical_panel_installation_date ?? null,
    electrical_rewire_date: utilSrc.electrical_rewire_date ?? null,
    heating_fuel_type: utilSrc.heating_fuel_type ?? null,
    hvac_capacity_kw: utilSrc.hvac_capacity_kw ?? null,
    hvac_capacity_tons: utilSrc.hvac_capacity_tons ?? null,
    hvac_equipment_component: utilSrc.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: utilSrc.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: utilSrc.hvac_equipment_model ?? null,
    hvac_installation_date: utilSrc.hvac_installation_date ?? null,
    hvac_seer_rating: utilSrc.hvac_seer_rating ?? null,
    hvac_system_configuration: utilSrc.hvac_system_configuration ?? null,
    plumbing_fixture_count: utilSrc.plumbing_fixture_count ?? null,
    plumbing_fixture_quality: utilSrc.plumbing_fixture_quality ?? null,
    plumbing_fixture_type_primary:
      utilSrc.plumbing_fixture_type_primary ?? null,
    plumbing_system_installation_date:
      utilSrc.plumbing_system_installation_date ?? null,
    sewer_connection_date: utilSrc.sewer_connection_date ?? null,
    solar_installation_date: utilSrc.solar_installation_date ?? null,
    solar_inverter_installation_date:
      utilSrc.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: utilSrc.solar_inverter_manufacturer ?? null,
    solar_inverter_model: utilSrc.solar_inverter_model ?? null,
    water_connection_date: utilSrc.water_connection_date ?? null,
    water_heater_installation_date:
      utilSrc.water_heater_installation_date ?? null,
    water_heater_manufacturer: utilSrc.water_heater_manufacturer ?? null,
    water_heater_model: utilSrc.water_heater_model ?? null,
    well_installation_date: utilSrc.well_installation_date ?? null,
  };
  // Only write utility.json if there's meaningful utility data
  if (hasMeaningfulValues(utilityOut)) {
    await fsp.writeFile(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilityOut, null, 2),
    );
  }

  // LAYOUTS
  const buildingLayoutIndices = []; // Track Building layout indices
  for (let i = 0; i < layouts.length; i++) {
    const L = layouts[i];
    const resolvedExterior =
      typeof L.is_exterior === "boolean" ? L.is_exterior : false;
    const resolvedFinished =
      typeof L.is_finished === "boolean"
        ? L.is_finished
        : resolvedExterior
          ? false
          : true;
    const layoutOut = {
      space_type: L.space_type ?? null,
      space_type_index: L.space_type_index ?? null,
      flooring_material_type: L.flooring_material_type ?? null,
      size_square_feet: L.size_square_feet ?? null,
      has_windows: L.has_windows ?? null,
      window_design_type: L.window_design_type ?? null,
      window_material_type: L.window_material_type ?? null,
      window_treatment_type: L.window_treatment_type ?? null,
      is_finished: resolvedFinished,
      furnished: L.furnished ?? null,
      paint_condition: L.paint_condition ?? null,
      flooring_wear: L.flooring_wear ?? null,
      clutter_level: L.clutter_level ?? null,
      visible_damage: L.visible_damage ?? null,
      countertop_material: L.countertop_material ?? null,
      cabinet_style: L.cabinet_style ?? null,
      fixture_finish_quality: L.fixture_finish_quality ?? null,
      design_style: L.design_style ?? null,
      natural_light_quality: L.natural_light_quality ?? null,
      decor_elements: L.decor_elements ?? null,
      pool_type: L.pool_type ?? null,
      pool_equipment: L.pool_equipment ?? null,
      spa_type: L.spa_type ?? null,
      safety_features: L.safety_features ?? null,
      view_type: L.view_type ?? null,
      lighting_features: L.lighting_features ?? null,
      condition_issues: L.condition_issues ?? null,
      is_exterior: resolvedExterior,
      pool_condition: L.pool_condition ?? null,
      pool_surface_type: L.pool_surface_type ?? null,
      pool_water_quality: L.pool_water_quality ?? null,
    };
    await fsp.writeFile(
      path.join(dataDir, `layout_${i + 1}.json`),
      JSON.stringify(layoutOut, null, 2),
    );

    // Track Building layouts for relationships
    if (L.space_type === "Building") {
      buildingLayoutIndices.push(i + 1);
    }
  }

  // Create layout_has_utility and layout_has_structure relationships ONLY for Building layouts
  const utilityExists = fs.existsSync(path.join(dataDir, "utility.json"));
  const structureExists = fs.existsSync(path.join(dataDir, "structure.json"));

  for (const layoutIdx of buildingLayoutIndices) {
    // layout → utility relationship
    if (utilityExists) {
      const relOut = {
        from: { "/": `./layout_${layoutIdx}.json` },
        to: { "/": `./utility.json` },
      };
      await fsp.writeFile(
        path.join(dataDir, `relationship_layout_${layoutIdx}_utility.json`),
        JSON.stringify(relOut, null, 2),
      );
    }

    // layout → structure relationship
    if (structureExists) {
      const relOut = {
        from: { "/": `./layout_${layoutIdx}.json` },
        to: { "/": `./structure.json` },
      };
      await fsp.writeFile(
        path.join(dataDir, `relationship_layout_${layoutIdx}_structure.json`),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // OWNERS (persons and companies)
  const salesFiles = (await listFiles(dataDir))
    .filter((f) => /^sales_\d+\.json$/.test(f))
    .sort();
  const salesIdxByDate = {};
  for (const f of salesFiles) {
    const sObj = await readJson(path.join(dataDir, f));
    if (sObj.ownership_transfer_date) {
      const idx = parseInt(f.match(/sales_(\d+)\.json/)[1], 10);
      salesIdxByDate[sObj.ownership_transfer_date] = idx;
    }
  }

  const people = new Map();
  const companies = new Map();
  const personRelations = [];
  const companyRelations = [];
  const ownersWithoutTransferDate = { persons: [], companies: [] };
  const currentPersonKeys = new Set(); // Track current person owners
  const currentCompanyNames = new Set(); // Track current company owners

  for (const [date, arr] of Object.entries(ownersByDate)) {
    if (!Array.isArray(arr)) continue;
    const iso = /\d{4}-\d{2}-\d{2}/.test(date) ? date : null;
    const isCurrent = date === "current";
    const isUnknownDate = date.startsWith("unknown_date_");

    for (const o of arr) {
      if (o.type === "person") {
        const first = titleCaseName(o.first_name);
        const last = titleCaseName(o.last_name);
        const middle = o.middle_name ? o.middle_name.toUpperCase() : null;
        const key = `${first}|${middle || ""}|${last}`;
        if (!people.has(key)) {
          people.set(key, {
            birth_date: null,
            first_name: first,
            last_name: last,
            middle_name: middle,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
        }
        if (isCurrent) {
          currentPersonKeys.add(key); // Mark as current owner
        }
        if (iso && salesIdxByDate[iso]) {
          personRelations.push({ key, idx: salesIdxByDate[iso] });
        } else if (isCurrent) {
          // Current owners go to the most recent sales record
          if (!ownersWithoutTransferDate.persons.some(p => p.key === key && p.isCurrent)) {
            ownersWithoutTransferDate.persons.push({ key, date, isCurrent: true });
          }
        } else if (isUnknownDate) {
          // Historical owners without dates go to earliest sales record
          if (!ownersWithoutTransferDate.persons.some(p => p.key === key)) {
            ownersWithoutTransferDate.persons.push({ key, date, isCurrent: false });
          }
        }
      } else if (o.type === "company") {
        const name = cleanText(o.name);
        if (name && !companies.has(name)) {
          companies.set(name, { name });
        }
        if (isCurrent && name) {
          currentCompanyNames.add(name); // Mark as current owner
        }
        if (name && iso && salesIdxByDate[iso]) {
          companyRelations.push({ name, idx: salesIdxByDate[iso] });
        } else if (isCurrent) {
          // Current owners go to the most recent sales record
          if (!ownersWithoutTransferDate.companies.some(c => c.name === name && c.isCurrent)) {
            ownersWithoutTransferDate.companies.push({ name, date, isCurrent: true });
          }
        } else if (name && isUnknownDate) {
          // Historical owners without dates go to earliest sales record
          if (!ownersWithoutTransferDate.companies.some(c => c.name === name)) {
            ownersWithoutTransferDate.companies.push({ name, date, isCurrent: false });
          }
        }
      }
    }
  }

  // Link owners without transfer dates to appropriate sales records
  if (salesList.length > 0) {
    const earliestSalesIdx = 1; // sales_1.json is the earliest (for historical owners)
    const latestSalesIdx = salesList.length; // Last sales file (for current owners)

    for (const p of ownersWithoutTransferDate.persons) {
      const targetIdx = p.isCurrent ? latestSalesIdx : earliestSalesIdx;
      personRelations.push({ key: p.key, idx: targetIdx });
    }
    for (const c of ownersWithoutTransferDate.companies) {
      const targetIdx = c.isCurrent ? latestSalesIdx : earliestSalesIdx;
      companyRelations.push({ name: c.name, idx: targetIdx });
    }
  }

  const personIndexMap = new Map();
  let personCounter = 0;
  for (const [key, person] of people.entries()) {
    personCounter++;
    const out = {
      birth_date: person.birth_date,
      first_name: person.first_name,
      last_name: person.last_name,
      middle_name: person.middle_name || null,
      prefix_name: person.prefix_name,
      suffix_name: person.suffix_name,
      us_citizenship_status: person.us_citizenship_status,
      veteran_status: person.veteran_status,
    };
    await fsp.writeFile(
      path.join(dataDir, `person_${personCounter}.json`),
      JSON.stringify(out, null, 2),
    );
    personIndexMap.set(key, personCounter);
  }

  const companyIndexMap = new Map();
  let companyCounter = 0;
  for (const [name, comp] of companies.entries()) {
    companyCounter++;
    const out = { name: comp.name };
    await fsp.writeFile(
      path.join(dataDir, `company_${companyCounter}.json`),
      JSON.stringify(out, null, 2),
    );
    companyIndexMap.set(name, companyCounter);
  }

  for (const rel of personRelations) {
    const pIdx = personIndexMap.get(rel.key);
    const sIdx = rel.idx;
    if (!pIdx || !sIdx) continue;
    const relOut = {
      from: { "/": `./sales_${sIdx}.json` },
      to: { "/": `./person_${pIdx}.json` },
    };
    await fsp.writeFile(
      path.join(dataDir, `relationship_sales_${sIdx}_person_${pIdx}.json`),
      JSON.stringify(relOut, null, 2),
    );
  }

  for (const rel of companyRelations) {
    const cIdx = companyIndexMap.get(rel.name);
    const sIdx = rel.idx;
    if (!cIdx || !sIdx) continue;
    const relOut = {
      from: { "/": `./sales_${sIdx}.json` },
      to: { "/": `./company_${cIdx}.json` },
    };
    await fsp.writeFile(
      path.join(dataDir, `relationship_sales_${sIdx}_company_${cIdx}.json`),
      JSON.stringify(relOut, null, 2),
    );
  }

  // Check if property and address files exist
  const propertyExists = fs.existsSync(path.join(dataDir, "property.json"));
  const addressExists = fs.existsSync(path.join(dataDir, "address.json"));

  // If no Building layouts exist, relate structure/utility directly to property
  const noBuildingLayouts = buildingLayoutIndices.length === 0;
  if (propertyExists && noBuildingLayouts) {
    if (structureExists) {
      const relOut = {
        from: { "/": "./property.json" },
        to: { "/": "./structure.json" },
      };
      await fsp.writeFile(
        path.join(dataDir, "relationship_property_structure.json"),
        JSON.stringify(relOut, null, 2),
      );
    }
    if (utilityExists) {
      const relOut = {
        from: { "/": "./property.json" },
        to: { "/": "./utility.json" },
      };
      await fsp.writeFile(
        path.join(dataDir, "relationship_property_utility.json"),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // person/company → mailing_address relationships (ONLY for current owners)
  const mailingAddressExists = fs.existsSync(path.join(dataDir, "mailing_address.json"));
  if (mailingAddressExists) {
    // Only create relationships for current person owners
    for (const [key, pIdx] of personIndexMap.entries()) {
      if (currentPersonKeys.has(key)) {
        const relOut = {
          from: { "/": `./person_${pIdx}.json` },
          to: { "/": `./mailing_address.json` },
        };
        await fsp.writeFile(
          path.join(dataDir, `relationship_person_${pIdx}_mailing_address.json`),
          JSON.stringify(relOut, null, 2),
        );
      }
    }

    // Only create relationships for current company owners
    for (const [name, cIdx] of companyIndexMap.entries()) {
      if (currentCompanyNames.has(name)) {
        const relOut = {
          from: { "/": `./company_${cIdx}.json` },
          to: { "/": `./mailing_address.json` },
        };
        await fsp.writeFile(
          path.join(dataDir, `relationship_company_${cIdx}_mailing_address.json`),
          JSON.stringify(relOut, null, 2),
        );
      }
    }

    // property → mailing_address relationship (FROM property TO mailing_address)
    if (propertyExists) {
      const relOut = {
        from: { "/": `./property.json` },
        to: { "/": `./mailing_address.json` },
      };
      await fsp.writeFile(
        path.join(dataDir, `relationship_property_mailing_address.json`),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // property → address relationship (FROM property TO address)
  if (propertyExists && addressExists) {
    const relOut = {
      from: { "/": `./property.json` },
      to: { "/": `./address.json` },
    };
    await fsp.writeFile(
      path.join(dataDir, `relationship_property_address.json`),
      JSON.stringify(relOut, null, 2),
    );
  }

  // property → lot relationship (FROM property TO lot)
  const lotExists = fs.existsSync(path.join(dataDir, "lot.json"));
  if (propertyExists && lotExists) {
    const relOut = {
      from: { "/": `./property.json` },
      to: { "/": `./lot.json` },
    };
    await fsp.writeFile(
      path.join(dataDir, `relationship_property_lot.json`),
      JSON.stringify(relOut, null, 2),
    );
  }

  // property → sales relationships (FROM property TO sales)
  const propSalesFiles = (await listFiles(dataDir))
    .filter((f) => /^sales_\d+\.json$/.test(f))
    .sort();
  for (const sf of propSalesFiles) {
    const idx = parseInt(sf.match(/sales_(\d+)\.json/)[1], 10);
    if (propertyExists) {
      const relOut = {
        from: { "/": `./property.json` },
        to: { "/": `./sales_${idx}.json` },
      };
      await fsp.writeFile(
        path.join(dataDir, `relationship_property_sales_${idx}.json`),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // property → tax_class relationships (FROM property TO tax_class)
  const taxClassFiles = (await listFiles(dataDir))
    .filter((f) => /^tax_class_\d+\.json$/.test(f))
    .sort();
  for (const tf of taxClassFiles) {
    if (propertyExists) {
      // Extract year from filename (e.g., tax_class_2025.json)
      const fileNameWithoutExt = tf.replace('.json', '');
      const relOut = {
        from: { "/": `./property.json` },
        to: { "/": `./${tf}` },
      };
      await fsp.writeFile(
        path.join(dataDir, `relationship_property_${fileNameWithoutExt}.json`),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // sales → deed relationships (FROM sales TO deed)
  const deedFiles = (await listFiles(dataDir))
    .filter((f) => /^deed_\d+\.json$/.test(f))
    .sort();
  for (const df of deedFiles) {
    const idx = parseInt(df.match(/deed_(\d+)\.json/)[1], 10);
    const relOut = {
      from: { "/": `./sales_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    await fsp.writeFile(
      path.join(dataDir, `relationship_sales_deed_${idx}.json`),
      JSON.stringify(relOut, null, 2),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
