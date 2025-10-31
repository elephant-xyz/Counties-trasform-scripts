#!/usr/bin/env node
/*
  Data extractor for property package.
  - Reads: input.html, unnormalized_address.json, property_seed.json
           owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
  - Writes: JSON files in ./data per schemas (without performing schema validation)

  Notes:
  - Owners, utilities, and layout are sourced strictly from the owners/*.json inputs
  - All other data are parsed from input.html (with county assist from unnormalized_address)
  - Missing/unknown values are set to null where schema allows
  - Idempotent: clears ./data before writing
*/

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) fs.unlinkSync(path.join(p, f));
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrency(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? Number(n.toFixed(2)) : null;
}
function parseNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function parseCoordinate(val) {
  if (val == null) return null;
  const num =
    typeof val === "string" ? parseFloat(val) : Number(val);
  return Number.isFinite(num) ? Number(num) : null;
}
function toISODate(mdY) {
  if (!mdY) return null;
  const m = mdY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
function properCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const PROPERTY_TYPE_BY_CODE = Object.freeze({
  "0000": "VacantLand",
  "0002": "VacantLand",
  "0003": "VacantLand",
  "0038": "VacantLand",
  "0100": "SingleFamily",
  "0102": "SingleFamily",
  "0103": "SingleFamily",
  "0138": "SingleFamily",
  "0200": "ManufacturedHousing",
  "0202": "ManufacturedHousing",
  "0203": "ManufacturedHousing",
  "0210": "LandParcel",
  "0220": "LandParcel",
  "0225": "Cooperative",
  "0230": "ManufacturedHousing",
  "0232": "ManufacturedHousing",
  "0233": "ManufacturedHousing",
  "0238": "ManufacturedHousing",
  "0300": "MultiFamilyMoreThan10",
  "0400": "Condominium",
  "0403": "Condominium",
  "0421": "Timeshare",
  "0430": "Timeshare",
  "0500": "Cooperative",
  "0600": "Retirement",
  "0700": "MiscellaneousResidential",
  "0800": "MultiFamilyLessThan10",
  "0802": "MultipleFamily",
  "0803": "MultipleFamily",
  "1000": "VacantLand",
  "1100": "Building",
  "1200": "Building",
  "1300": "Building",
  "1400": "Building",
  "1500": "Building",
  "1600": "Building",
  "1700": "Building",
  "1800": "Building",
  "1900": "Building",
  "2000": "Building",
  "2002": "Building",
  "2100": "Building",
  "2200": "Building",
  "2300": "Building",
  "2400": "Building",
  "2500": "Building",
  "2600": "Building",
  "2700": "Building",
  "2701": "Building",
  "2800": "Building",
  "2810": "ManufacturedHousing",
  "2820": "LandParcel",
  "2823": "ManufacturedHousing",
  "2900": "Building",
  "3000": "Building",
  "3100": "Building",
  "3200": "Building",
  "3300": "Building",
  "3400": "Building",
  "3500": "Building",
  "3600": "LandParcel",
  "3700": "LandParcel",
  "3800": "LandParcel",
  "3900": "Building",
  "4000": "VacantLand",
  "4100": "LandParcel",
  "4200": "LandParcel",
  "4300": "Building",
  "4400": "Building",
  "4500": "Building",
  "4600": "LandParcel",
  "4700": "Building",
  "4800": "Building",
  "4900": "Building",
  "5000": "LandParcel",
  "5003": "LandParcel",
  "5100": "LandParcel",
  "5200": "LandParcel",
  "5201": "LandParcel",
  "5202": "LandParcel",
  "5300": "LandParcel",
  "5400": "LandParcel",
  "5500": "LandParcel",
  "5600": "LandParcel",
  "5700": "LandParcel",
  "6200": "LandParcel",
  "6300": "LandParcel",
  "6301": "LandParcel",
  "6400": "LandParcel",
  "6401": "LandParcel",
  "6500": "LandParcel",
  "6501": "LandParcel",
  "6600": "LandParcel",
  "6601": "LandParcel",
  "6602": "LandParcel",
  "6603": "LandParcel",
  "6604": "LandParcel",
  "6605": "LandParcel",
  "6606": "LandParcel",
  "6607": "LandParcel",
  "6608": "LandParcel",
  "6609": "LandParcel",
  "6610": "LandParcel",
  "6611": "LandParcel",
  "6612": "LandParcel",
  "6613": "LandParcel",
  "6614": "LandParcel",
  "6615": "LandParcel",
  "6616": "LandParcel",
  "6617": "LandParcel",
  "6618": "LandParcel",
  "6619": "LandParcel",
  "6620": "LandParcel",
  "6621": "LandParcel",
  "6622": "LandParcel",
  "6623": "LandParcel",
  "6624": "LandParcel",
  "6625": "LandParcel",
  "6626": "LandParcel",
  "6627": "LandParcel",
  "6628": "LandParcel",
  "6629": "LandParcel",
  "6630": "LandParcel",
  "6631": "LandParcel",
  "6632": "LandParcel",
  "6633": "LandParcel",
  "6634": "LandParcel",
  "6635": "LandParcel",
  "6636": "LandParcel",
  "6637": "LandParcel",
  "6638": "LandParcel",
  "6700": "LandParcel",
  "6800": "LandParcel",
  "6900": "LandParcel",
  "7000": "VacantLand",
  "7100": "Building",
  "7200": "Building",
  "7300": "Building",
  "7400": "Building",
  "7500": "Building",
  "7600": "Building",
  "7700": "Building",
  "7701": "Building",
  "7710": "Building",
  "7720": "Building",
  "7800": "Building",
  "7900": "Building",
  "8086": "VacantLand",
  "8087": "VacantLand",
  "8088": "VacantLand",
  "8089": "VacantLand",
  "8200": "LandParcel",
  "8300": "Building",
  "8400": "Building",
  "8500": "Building",
  "8600": "LandParcel",
  "8700": "LandParcel",
  "8800": "LandParcel",
  "8900": "LandParcel",
  "9000": "LandParcel",
  "9100": "LandParcel",
  "9200": "LandParcel",
  "9300": "LandParcel",
  "9400": "LandParcel",
  "9500": "LandParcel",
  "9600": "LandParcel",
  "9700": "LandParcel",
  "9800": "LandParcel",
  "9900": "LandParcel",
});

const STRUCTURE_FORM_LOOKUP = Object.freeze({
  SingleFamily: "SingleFamilyDetached",
  DetachedCondominium: "SingleFamilyDetached",
  Townhouse: "TownhouseRowhouse",
  Pud: "SingleFamilyDetached",
  Duplex: "Duplex",
  "2Units": "Duplex",
  "3Units": "Triplex",
  "4Units": "Quadplex",
  MultipleFamily: "MultiFamily5Plus",
  MultiFamilyLessThan10: "MultiFamilyLessThan10",
  MultiFamilyMoreThan10: "MultiFamilyMoreThan10",
  Apartment: "ApartmentUnit",
  Condominium: "ApartmentUnit",
  Cooperative: "ApartmentUnit",
  Timeshare: "ApartmentUnit",
  Retirement: "ApartmentUnit",
  ManufacturedHousing: "ManufacturedHousing",
  ManufacturedHousingSingleWide: "ManufacturedHousingSingleWide",
  ManufacturedHousingMultiWide: "ManufacturedHousingMultiWide",
  ManufacturedHome: "ManufacturedHome",
  Modular: "Modular",
  MobileHome: "MobileHome",
  Unit: "ApartmentUnit",
});

const CONDO_CLASSIFICATIONS = new Set([
  "Condominium",
  "Cooperative",
  "Apartment",
  "Timeshare",
  "Unit",
  "ApartmentUnit",
]);

const DEED_TYPE_MAP = Object.freeze({
  "warranty deed": "Warranty Deed",
  "special warranty deed": "Special Warranty Deed",
  "quit claim deed": "Quitclaim Deed",
  "quitclaim deed": "Quitclaim Deed",
  "grant deed": "Grant Deed",
  "bargain and sale deed": "Bargain and Sale Deed",
  "lady bird deed": "Lady Bird Deed",
  "transfer on death deed": "Transfer on Death Deed",
  "sheriff's deed": "Sheriff's Deed",
  "tax deed": "Tax Deed",
  "trustee's deed": "Trustee's Deed",
  "personal representative deed": "Personal Representative Deed",
  "correction deed": "Correction Deed",
  "deed in lieu of foreclosure": "Deed in Lieu of Foreclosure",
  "life estate deed": "Life Estate Deed",
  "joint tenancy deed": "Joint Tenancy Deed",
  "tenancy in common deed": "Tenancy in Common Deed",
  "community property deed": "Community Property Deed",
  "gift deed": "Gift Deed",
  "interspousal transfer deed": "Interspousal Transfer Deed",
  "wild deed": "Wild Deed",
  "special master’s deed": "Special Master’s Deed",
  "special master's deed": "Special Master’s Deed",
  "court order deed": "Court Order Deed",
  "contract for deed": "Contract for Deed",
  "quiet title deed": "Quiet Title Deed",
  "administrator's deed": "Administrator's Deed",
  "guardian's deed": "Guardian's Deed",
  "receiver's deed": "Receiver's Deed",
  "right of way deed": "Right of Way Deed",
  "vacation of plat deed": "Vacation of Plat Deed",
  "assignment of contract": "Assignment of Contract",
  "release of contract": "Release of Contract",
});

function normalizeDeedType(raw) {
  if (!raw) return "Miscellaneous";
  const cleaned = String(raw).trim();
  const normalizedKey = cleaned.toLowerCase();
  if (DEED_TYPE_MAP[normalizedKey]) return DEED_TYPE_MAP[normalizedKey];
  // handle abbreviations or partial matches
  if (/^wd\b/i.test(cleaned)) return "Warranty Deed";
  if (/^swd\b/i.test(cleaned)) return "Special Warranty Deed";
  if (/^qcd?\b/i.test(cleaned)) return "Quitclaim Deed";
  if (/grant\b/i.test(cleaned)) return "Grant Deed";
  if (/bargain/i.test(cleaned)) return "Bargain and Sale Deed";
  if (/lady\s*bird/i.test(cleaned)) return "Lady Bird Deed";
  if (/trustee/i.test(cleaned)) return "Trustee's Deed";
  if (/personal\s+representative/i.test(cleaned))
    return "Personal Representative Deed";
  if (/deed\s+in\s+lieu/i.test(cleaned)) return "Deed in Lieu of Foreclosure";
  if (/life\s+estate/i.test(cleaned)) return "Life Estate Deed";
  if (/joint\s+tenancy/i.test(cleaned)) return "Joint Tenancy Deed";
  if (/tenancy\s+in\s+common/i.test(cleaned)) return "Tenancy in Common Deed";
  if (/gift/i.test(cleaned)) return "Gift Deed";
  if (/guardian/i.test(cleaned)) return "Guardian's Deed";
  if (/receiver/i.test(cleaned)) return "Receiver's Deed";
  if (/right\s+of\s+way/i.test(cleaned)) return "Right of Way Deed";
  if (/release\s+of\s+contract/i.test(cleaned)) return "Release of Contract";
  if (/assignment\s+of\s+contract/i.test(cleaned))
    return "Assignment of Contract";
  if (/quiet\s+title/i.test(cleaned)) return "Quiet Title Deed";
  if (/administrator/i.test(cleaned)) return "Administrator's Deed";
  if (/vacation\s+of\s+plat/i.test(cleaned)) return "Vacation of Plat Deed";
  if (/contract\s+for\s+deed/i.test(cleaned)) return "Contract for Deed";
  if (/tax\s+deed/i.test(cleaned)) return "Tax Deed";
  return "Miscellaneous";
}

function mapClassificationToStructureForm(classification) {
  if (!classification) return null;
  return STRUCTURE_FORM_LOOKUP[classification] ?? null;
}

function derivePropertyTypeValue(classification, structureForm, hasStructure) {
  if (classification === "VacantLand" || classification === "LandParcel") {
    return "LandParcel";
  }
  if (
    classification &&
    (classification === "MobileHome" || classification === "ManufacturedHome")
  ) {
    return classification;
  }
  if (
    classification &&
    (classification === "ManufacturedHousing" ||
      classification === "ManufacturedHousingSingleWide" ||
      classification === "ManufacturedHousingMultiWide")
  ) {
    return "ManufacturedHousing";
  }
  if (
    classification &&
    CONDO_CLASSIFICATIONS.has(classification)
  ) {
    return "Unit";
  }
  if (!classification && !hasStructure) {
    return "LandParcel";
  }
  if (structureForm === "ApartmentUnit") {
    return "Unit";
  }
  return "Building";
}

const FLOOR_ENUM_VALUES = ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"];

function normalizeFloorLevelValue(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  if (FLOOR_ENUM_VALUES.includes(str)) return str;

  const lower = str.toLowerCase();
  const directMap = {
    "first floor": "1st Floor",
    "first": "1st Floor",
    "1st floor": "1st Floor",
    "1st": "1st Floor",
    "ground floor": "1st Floor",
    "ground": "1st Floor",
    "main floor": "1st Floor",
    "main": "1st Floor",
    "second floor": "2nd Floor",
    "second": "2nd Floor",
    "2nd floor": "2nd Floor",
    "2nd": "2nd Floor",
    "upper": "2nd Floor",
    "third floor": "3rd Floor",
    "third": "3rd Floor",
    "3rd floor": "3rd Floor",
    "3rd": "3rd Floor",
    "fourth floor": "4th Floor",
    "fourth": "4th Floor",
    "4th floor": "4th Floor",
    "4th": "4th Floor",
  };
  if (directMap[lower]) return directMap[lower];

  const numericMatch = lower.match(/^(\d+)/);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    if (num >= 1 && num <= 4) {
      return FLOOR_ENUM_VALUES[num - 1];
    }
  }

  return null;
}

function normalizeFloorLevel(value, fallback) {
  const normalizedPrimary = normalizeFloorLevelValue(value);
  if (normalizedPrimary) return normalizedPrimary;

  const normalizedFallback = normalizeFloorLevelValue(fallback);
  if (normalizedFallback) return normalizedFallback;

  return FLOOR_ENUM_VALUES[0];
}

function normalizeUrl(value, baseOrigin) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (baseOrigin && trimmed.startsWith("/")) {
    return `${baseOrigin}${trimmed}`;
  }
  try {
    const resolved = baseOrigin ? new URL(trimmed, baseOrigin) : new URL(trimmed);
    return resolved.toString();
  } catch (err) {
    return null;
  }
}

function mapLandUseToPropertyType(landUseDescription) {
  if (!landUseDescription) return null;

  const codeMatch = landUseDescription.match(/\((\d{3,4})\)/);
  if (codeMatch) {
    const code = codeMatch[1];
    if (PROPERTY_TYPE_BY_CODE[code]) return PROPERTY_TYPE_BY_CODE[code];
  }

  const desc = landUseDescription.toUpperCase();

  // Map Lake County land use codes to property types
  if (desc.includes("VACANT RESIDENTIAL")) return "VacantLand";
  if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
  if (
    desc.includes("MANUFACTURED HOME SUB") ||
    desc.includes("MANUFACTURED SUB")
  )
    return "ManufacturedHousing";
  if (desc.includes("MANUFACTURED HOME") && !desc.includes("SUB"))
    return "MobileHome";
  if (desc.includes("MULTI FAMILY >9") || desc.includes("MULTI FAMILY >=10"))
    return "MultiFamilyMoreThan10";
  if (
    desc.includes("MULTI FAMILY <5") ||
    desc.includes("MULTI FAMILY >4 AND <10") ||
    desc.includes("MULTI FAMILY <=9")
  )
    return "MultiFamilyLessThan10";
  if (desc.includes("MULTI FAMILY")) return "MultipleFamily";
  if (desc.includes("CONDOMINIUM") || desc.includes("CONDO"))
    return "Condominium";
  if (desc.includes("CO-OP")) return "Cooperative";
  if (desc.includes("RETIREMENT HOME")) return "Retirement";
  if (desc.includes("MISC RESIDENTIAL") || desc.includes("MIGRANT"))
    return "MiscellaneousResidential";
  if (desc.includes("TIMESHARE")) return "Timeshare";
  if (desc.includes("TOWNHOUSE")) return "Townhouse";
  if (desc.includes("DUPLEX")) return "Duplex";
  if (desc.includes("PUD")) return "Pud";
  if (desc.includes("MOBILE HOME")) return "MobileHome";
  if (
    desc.includes("RESIDENTIAL COMMON ELEMENTS") ||
    desc.includes("COMMON ELEMENTS")
  )
    return "ResidentialCommonElementsAreas";

  // Default to null for non-residential or unrecognized codes
  return null;
}

function getUnitsType(units) {
  if (!units || units === 1) return "One";
  if (units === 2) return "Two";
  if (units === 3) return "Three";
  if (units === 4) return "Four";
  if (units >= 2 && units <= 4) return "TwoToFour";
  if (units >= 1 && units <= 4) return "OneToFour";
  return null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  clearDir(dataDir);

  // Inputs
  const inputHtml = readText("input.html");
  const addrSeed = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");
  const addressSeed = fs.existsSync("address.json")
    ? readJSON("address.json")
    : null;

  // Owner-related JSON sources
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownerData = fs.existsSync(ownerPath) ? readJSON(ownerPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const altKey =
    (propSeed &&
      propSeed.source_http_request &&
      propSeed.source_http_request.multiValueQueryString &&
      propSeed.source_http_request.multiValueQueryString.AltKey &&
      propSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    (addrSeed &&
      addrSeed.source_http_request &&
      addrSeed.source_http_request.multiValueQueryString &&
      addrSeed.source_http_request.multiValueQueryString.AltKey &&
      addrSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    null;
  const ownerKey = altKey ? `property_${altKey}` : null;

  // HTML parsing
  let $ = null;
  if (cheerio) {
    $ = cheerio.load(inputHtml);
  }

  // Helper: find cell by label in General Information table
  function extractGeneral() {
    if (!$) return {};
    const result = {
      parcelNumber: null,
      propertyLocationRaw: null,
      mailingAddressRaw: null,
      legalDescription: null,
    };
    // Parcel Number
    const rows = $("table.property_head").first().find("tr");
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 4) {
        const label = $(tds[2]).text().trim();
        const val = $(tds[3]).text().trim();
        if (/Parcel Number/i.test(label)) result.parcelNumber = val || null;
      }
    });

    // Property Location block
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 4) {
        const label = $(tds[0]).text().trim();
        if (/Mailing Address:/i.test(label)) {
          const addrHtml = $(tds[1]).html() || "";
          const addrText = addrHtml
            .replace(/<br\s*\/?>(?=\s*|$)/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\u00A0/g, " ")
            .replace(/\s+\n/g, "\n")
            .trim();
          if (addrText) result.mailingAddressRaw = addrText;
        } else if (/Property Location:/i.test(label)) {
          const addrHtml = $(tds[1]).html() || "";
          const addrText = addrHtml
            .replace(/<br\s*\/?>(?=\s*|$)/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\u00A0/g, " ")
            .trim();
          result.propertyLocationRaw = addrText; // e.g., "31729 PARKDALE DR\nLEESBURG FL, 34748"
        }
      }
    });

    // Property Description
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (/Property Description:/i.test(label)) {
          result.legalDescription = $(tds[1]).text().trim() || null;
        }
      }
    });

    return result;
  }

  function extractPropertyTypeFromLandData() {
    if (!$) return { propertyType: null, units: null };

    let landUseDescription = null;
    let units = null;

    // Extract from Land Data table
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const landUseText = $(tds[1]).text().trim();
        if (landUseText) {
          landUseDescription = landUseText.toUpperCase();
        }
      }
    });

    // Also check for units in building summary if available
    $("table.property_building_summary td").each((i, td) => {
      const text = $(td).text().trim();
      const unitMatch = text.match(/Units:\s*(\d+)/i);
      if (unitMatch) {
        units = parseInt(unitMatch[1], 10);
      }
    });

    const propertyType = mapLandUseToPropertyType(landUseDescription);

    return { propertyType, units };
  }

  // Extract Living Area, Year Built, Building/Land Values, Sales, and derive structure hints
  function extractBuildingAndValues() {
    if (!$) return {};
  const out = {
    yearBuilt: null,
    livingArea: null,
    buildingValue: null,
    landValue: null,
    landRows: [],
    assessedValue: null,
      taxableValue: null,
      marketValue: null,
      taxYear: null,
      sales: [],
      deeds: [],
      files: [],
      structure: {
        number_of_stories: null,
        exterior_wall_material_primary: null,
        exterior_wall_material_secondary: null,
        primary_framing_material: null,
      },
    };

    // Summary table with Year Built and Total Living Area
    $("table.property_building_summary td").each((i, td) => {
      const t = $(td).text().replace(/\s+/g, " ").trim();
      let m;
      m = t.match(/Year Built:\s*(\d{4})/i);
      if (m) out.yearBuilt = parseInt(m[1], 10);
      m = t.match(/Total Living Area:\s*([0-9,\.]+)/i);
      if (m) out.livingArea = m[1].replace(/[,]/g, "").trim();
    });

    // Building Value
    $("div.property_building table")
      .first()
      .find("tr")
      .first()
      .find("td")
      .each((i, td) => {
        const text = $(td).text();
        const m = text.match(/Building Value:\s*\$([0-9,\.]+)/i);
        if (m) out.buildingValue = parseCurrency(m[0].split(":")[1]);
      });

    // Land Value (from Land Data table)
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 9) {
    const landUseText = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const frontage = parseNumber($(tds[2]).text());
    const depth = parseNumber($(tds[3]).text());
    const notes = $(tds[4]).text().replace(/\s+/g, " ").trim();
    const units = parseNumber($(tds[5]).text());
    const unitType = $(tds[6]).text().replace(/\s+/g, " ").trim();
    const classValue = parseCurrency($(tds[7]).text());
    const landValue = parseCurrency($(tds[8]).text());
    if (landValue != null) out.landValue = landValue;
    out.landRows.push({
      land_use: landUseText || null,
      frontage: Number.isFinite(frontage) ? frontage : null,
      depth: Number.isFinite(depth) ? depth : null,
      notes: notes || null,
      units: Number.isFinite(units) ? units : null,
      unit_type: unitType || null,
      class_value: classValue,
      land_value: landValue,
    });
  }
});

    // Tax values
    const estRows = $("#cphMain_gvEstTax tr").toArray();
    if (estRows.length > 1) {
      // First data row after header
      const tds = $(estRows[1]).find("td");
      if (tds.length >= 6) {
        const market = $(tds[1]).text();
        const assessed = $(tds[2]).text();
        const taxable = $(tds[3]).text();
        out.marketValue = parseCurrency(market);
        out.assessedValue = parseCurrency(assessed);
        out.taxableValue = parseCurrency(taxable);
      }
    }

    // Tax year from the red note text or globally from HTML
    let noteText = "";
    $("div.red").each((i, el) => {
      noteText += $(el).text() + " ";
    });
    let mYear = noteText.match(
      /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
    );
    if (!mYear)
      mYear = inputHtml.match(
        /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
      );
    if (!mYear) {
      mYear = noteText.match(/Values\s+shown\s+are\s+(\d{4})/i);
    }
    if (!mYear) {
      mYear = noteText.match(/\b(20\d{2})\b/);
    }
    if (mYear) out.taxYear = parseInt(mYear[1], 10);

    // Sales History: Book/Page, Sale Date, Instrument, Sale Price
    $("#cphMain_gvSalesHistory tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length < 6) return;
      const bookPageLink = $(tds[0]).find("a");
      const bookPageText = bookPageLink.text().trim(); // e.g., "3072 / 319"
      const docUrl = bookPageLink.attr("href") || null;
      const saleDateRaw = $(tds[1]).text().trim(); // mm/dd/yyyy
      const instrument = $(tds[2]).text().trim();
      const salePriceRaw = $(tds[5]).text().trim();

      const sale = {
        ownership_transfer_date: toISODate(saleDateRaw),
        purchase_price_amount: parseCurrency(salePriceRaw),
      };

      out.sales.push(sale);

      const deed = { deed_type: normalizeDeedType(instrument) };
      out.deeds.push(deed);

      const fileObj = {
        document_type: /Warranty Deed/i.test(instrument)
          ? "ConveyanceDeedWarrantyDeed"
          : null,
        file_format: null,
        ipfs_url: null,
        name: bookPageText ? `Official Records ${bookPageText}` : null,
        original_url: normalizeUrl(docUrl, baseOrigin),
      };
      out.files.push(fileObj);
    });

    // Residential Building Characteristics (Sections) for stories and exterior wall types
    const secTable = $("table#cphMain_repResidential_gvBuildingSections_0");
    if (secTable && secTable.length) {
      const firstDataRow = secTable
        .find("tr")
        .not(".property_table_head")
        .first();
      const tds = firstDataRow.find("td");
      if (tds.length >= 4) {
        const extText = (tds.eq(1).text() || "").trim();
        const storiesText = (tds.eq(2).text() || "").trim();
        if (storiesText) {
          const sNum = parseFloat(storiesText);
          if (!isNaN(sNum)) out.structure.number_of_stories = Math.round(sNum);
        }
        if (extText) {
          const U = extText.toUpperCase();
          let primary = null;
          let secondary = null;
          let framing = null;

          const has = (kw) => U.indexOf(kw) !== -1;
          if (has("BLOCK") || has("CONCRETE BLOCK")) framing = "Concrete Block";

          if (has("STUCCO")) primary = "Stucco";
          if (!primary && has("VINYL") && has("SIDING"))
            primary = "Vinyl Siding";
          if (!primary && has("WOOD") && has("SIDING")) primary = "Wood Siding";
          if (!primary && has("FIBER") && has("CEMENT"))
            primary = "Fiber Cement Siding";
          if (!primary && has("BRICK")) primary = "Brick";
          if (!primary && (has("BLOCK") || has("CONCRETE BLOCK")))
            primary = "Concrete Block";

          if (has("BRICK") && primary !== "Brick") secondary = "Brick Accent";
          if (
            !secondary &&
            (has("BLOCK") || has("CONCRETE BLOCK")) &&
            primary !== "Concrete Block"
          )
            secondary = "Decorative Block";
          if (!secondary && has("STUCCO") && primary !== "Stucco")
            secondary = "Stucco Accent";

          out.structure.exterior_wall_material_primary = primary;
          out.structure.exterior_wall_material_secondary = secondary || null;
          out.structure.primary_framing_material = framing || null;
        }
      }
    }

    return out;
  }

  function buildPropertyJson() {
    const propertyInfo = extractPropertyTypeFromLandData();
    const classification = propertyInfo.propertyType || null;
    const structureForm = mapClassificationToStructureForm(classification);
    const hasStructure =
      Boolean(
        bx.livingArea ||
          (bx.structure && bx.structure.number_of_stories) ||
          structureForm,
      );
    const propertyTypeValue = derivePropertyTypeValue(
      classification,
      structureForm,
      hasStructure,
    );

    const property = {
      parcel_identifier: general.parcelNumber || propSeed.parcel_id || null,
      property_structure_built_year: bx.yearBuilt || null,
      livable_floor_area: bx.livingArea ? String(bx.livingArea) : null,
      property_legal_description_text: general.legalDescription || null,
      property_type: propertyTypeValue,
      structure_form: structureForm,
      number_of_units_type: getUnitsType(propertyInfo.units), // Dynamic based on extracted units
      number_of_units:
        propertyInfo.units !== undefined && propertyInfo.units !== null
          ? propertyInfo.units
          : null,
      area_under_air: null,
      property_effective_built_year: null,
      subdivision: null,
      total_area: null,
      zoning: null,
    };

    // Remove undefined properties
    Object.keys(property).forEach((k) => {
      if (property[k] === undefined) delete property[k];
    });

    return property;
  }

  const canonicalSourceRequest =
    (propSeed && propSeed.source_http_request) ||
    (addressSeed && addressSeed.source_http_request) ||
    addrSeed.source_http_request ||
    null;

  const baseOrigin =
    (canonicalSourceRequest &&
      canonicalSourceRequest.url &&
      (() => {
        try {
          return new URL(canonicalSourceRequest.url).origin;
        } catch (err) {
          return null;
        }
      })()) ||
    null;

  // Execute extractions in proper order
  const general = extractGeneral();
  const bx = extractBuildingAndValues();

  const requestIdentifier =
    (propSeed && propSeed.request_identifier) ||
    (addressSeed && addressSeed.request_identifier) ||
    (addrSeed && addrSeed.request_identifier) ||
    propSeed?.parcel_id ||
    general.parcelNumber ||
    null;

  const cloneSourceRequest = () =>
    canonicalSourceRequest
      ? JSON.parse(JSON.stringify(canonicalSourceRequest))
      : null;

  const applySourceAndRequest = (target) => {
    if (!target) return target;
    if (!target.source_http_request) target.source_http_request = cloneSourceRequest();
    if (!target.request_identifier) target.request_identifier = requestIdentifier;
    return target;
  };

  const buildCommunication = (opts = {}) => {
    const comm = {
      email_address: opts.email || null,
      phone_number: opts.phone || null,
    };
    return applySourceAndRequest(comm);
  };

  const communicationFiles = [];
  const commRelationships = [];

  const enqueueRelationship = (type, fromFile, toFile) => {
    if (!fromFile || !toFile) return;
    commRelationships.push({ type, from: fromFile, to: toFile });
  };

  function buildAddressFromRawCandidates(rawCandidates, options = {}) {
    const {
      countyName = null,
      fallbackCity = null,
      fallbackState = null,
      fallbackPostal = null,
      fallbackCountry = null,
      latitude = null,
      longitude = null,
    } = options;

    const candidates = (rawCandidates || [])
      .map((value) =>
        (value || "")
          .replace(/\r/g, "")
          .replace(/\u00A0/g, " ")
          .trim(),
      )
      .filter(Boolean);

    if (candidates.length === 0 && !fallbackCity && !fallbackState && !fallbackPostal) {
      return null;
    }

    const normalizedForParsing = candidates.map((value) =>
      value.replace(/\n/g, ", ").replace(/\s+/g, " ").trim(),
    );

    let cityName = fallbackCity || null;
    let stateCode = fallbackState || null;
    let postalCode = fallbackPostal || null;
    let plusFour = null;

    const tryExtract = (value) => {
      if (!value) return;
      const match = value.match(/([A-Z]{2})[\s,]*(\d{5})(?:-?(\d{4}))?$/i);
      if (!match) return;

      const [, stateRaw, zip, plus] = match;
      if (!stateCode) stateCode = stateRaw.toUpperCase();
      if (!postalCode) postalCode = zip;
      if (!plusFour && plus) plusFour = plus;

      const beforeState = value.slice(0, match.index).trim();
      if (beforeState && !cityName) {
        const candidate = beforeState.split(",").pop()?.trim();
        if (candidate) {
          cityName = candidate.replace(/\s+/g, " ").toUpperCase();
        }
      }
    };

    normalizedForParsing.forEach(tryExtract);

    const unnormalizedAddress = (candidates[0] || "")
      .replace(/\n/g, ", ")
      .replace(/\s+,/g, ",")
      .replace(/,\s+/g, ", ")
      .replace(/\s+/g, " ")
      .trim();

    const base = {
      unnormalized_address: unnormalizedAddress || null,
      city_name: cityName || null,
      municipality_name: null,
      state_code: stateCode || null,
      postal_code: postalCode || null,
      plus_four_postal_code: plusFour || null,
      country_code:
        fallbackCountry || (stateCode ? "US" : null),
      county_name: countyName || null,
      unit_identifier: null,
      latitude,
      longitude,
      route_number: null,
      township: null,
      range: null,
      section: null,
      block: null,
      lot: null,
    };

    return applySourceAndRequest(base);
  }

  // Address parsing
  function parseAddress() {
    const countyName =
      addressSeed?.county_name || addrSeed.county_jurisdiction || null;

    const latitude =
      parseCoordinate(addressSeed?.latitude) ??
      parseCoordinate(addrSeed.latitude);
    const longitude =
      parseCoordinate(addressSeed?.longitude) ??
      parseCoordinate(addrSeed.longitude);

    return buildAddressFromRawCandidates(
      [
        general.propertyLocationRaw,
        addressSeed?.unnormalized_address,
        addrSeed.full_address,
      ],
      {
        countyName,
        fallbackCountry:
          addressSeed?.country_code || addrSeed?.country_code || null,
        latitude,
        longitude,
      },
    );
  }
  const addr = parseAddress();
  const mailingAddr = buildAddressFromRawCandidates(
    general.mailingAddressRaw ? [general.mailingAddressRaw] : [],
    {
      countyName:
        addressSeed?.county_name || addrSeed.county_jurisdiction || null,
      fallbackCity: addr?.city_name || null,
      fallbackState: addr?.state_code || null,
      fallbackPostal: addr?.postal_code || null,
      fallbackCountry:
        addr?.country_code ||
        addressSeed?.country_code ||
        addrSeed?.country_code ||
        null,
    },
  );

  // Write address.json
  writeJSON(path.join(dataDir, "address.json"), addr);

  let mailingAddressFile = null;
  let mailingCommFile = null;
  if (mailingAddr) {
    mailingAddressFile = "mailing_address.json";
    writeJSON(path.join(dataDir, mailingAddressFile), mailingAddr);

    const comm = buildCommunication();
    mailingCommFile = "communication_mailing.json";
    writeJSON(path.join(dataDir, mailingCommFile), comm);
    communicationFiles.push(mailingCommFile);
  }

  // property.json
  const property = buildPropertyJson();
  Object.keys(property).forEach((k) => {
    if (property[k] === undefined) delete property[k];
  });
  applySourceAndRequest(property);
  writeJSON(path.join(dataDir, "property.json"), property);

  if (mailingAddressFile) {
    writeJSON(path.join(dataDir, "relationship_property_mailing_address.json"), {
      from: { "/": "./property.json" },
      to: { "/": `./${mailingAddressFile}` },
    });
  }

  if (mailingCommFile) {
    writeJSON(path.join(dataDir, "relationship_property_communication_mailing.json"), {
      from: { "/": "./property.json" },
      to: { "/": `./${mailingCommFile}` },
    });
  }

  // lot.json
  const landRows = Array.isArray(bx.landRows) ? bx.landRows : [];
  const primaryLandRow =
    landRows.find((row) => row && row.unit_type) || landRows[0] || null;

  const normalizeFeet = (value) => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  };

  const lotLengthFeet = primaryLandRow
    ? normalizeFeet(primaryLandRow.frontage)
    : null;
  const lotWidthFeet = primaryLandRow
    ? normalizeFeet(primaryLandRow.depth)
    : null;

  const deriveLotAreaSqft = () => {
    if (primaryLandRow && Number.isFinite(primaryLandRow.units)) {
      const units = primaryLandRow.units;
      const unitType = (primaryLandRow.unit_type || "").toLowerCase();
      if (units > 0) {
        if (unitType.includes("acre")) return Math.round(units * 43560);
        if (
          unitType.includes("sq") ||
          unitType.includes("sf") ||
          unitType.includes("square")
        )
          return Math.round(units);
      }
    }
    if (lotLengthFeet && lotWidthFeet) {
      const computed = Math.round(lotLengthFeet * lotWidthFeet);
      if (computed > 0) return computed;
    }
    return null;
  };

  const lotAreaSqft = deriveLotAreaSqft();

  const determineLotType = () => {
    if (lotAreaSqft) {
      return lotAreaSqft > 10890
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre";
    }
    if (primaryLandRow) {
      const unitType = (primaryLandRow.unit_type || "").toLowerCase();
      if (unitType.includes("acre")) return "GreaterThanOneQuarterAcre";
      if (unitType.includes("lot")) return "LessThanOrEqualToOneQuarterAcre";
      const notes = (primaryLandRow.notes || "").toLowerCase();
      if (notes.includes("paved")) return "PavedRoad";
    }
    return null;
  };

  const lot = {
    lot_type: determineLotType(),
    lot_length_feet: lotLengthFeet,
    lot_width_feet: lotWidthFeet,
    lot_area_sqft: lotAreaSqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  applySourceAndRequest(lot);
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // tax_*.json
  if (
    bx.taxYear ||
    bx.marketValue ||
    bx.assessedValue ||
    bx.taxableValue ||
    bx.buildingValue ||
    bx.landValue
  ) {
    const tax = {
      tax_year: bx.taxYear || null,
      property_assessed_value_amount:
        bx.assessedValue != null ? bx.assessedValue : null,
      property_market_value_amount:
        bx.marketValue != null ? bx.marketValue : null,
      property_building_amount:
        bx.buildingValue != null ? bx.buildingValue : null,
      property_land_amount: bx.landValue != null ? bx.landValue : null,
      property_taxable_value_amount:
        bx.taxableValue != null ? bx.taxableValue : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    applySourceAndRequest(tax);
    const taxName = `tax_${tax.tax_year || "1"}.json`;
    writeJSON(path.join(dataDir, taxName), tax);
    if (tax.tax_year && fs.existsSync(path.join(dataDir, "tax_1.json"))) {
      try {
        fs.unlinkSync(path.join(dataDir, "tax_1.json"));
      } catch (e) {}
    }
  }

  // structure.json — include parsed stories and exterior wall mapping
  const structure = {
    architectural_style_type: null,
    attachment_type:
      property.property_type === "SingleFamily" ? "Detached" : null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary:
      bx.structure.exterior_wall_material_primary || null,
    exterior_wall_material_secondary:
      bx.structure.exterior_wall_material_secondary || null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: bx.structure.number_of_stories || null,
    primary_framing_material: bx.structure.primary_framing_material || null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  applySourceAndRequest(structure);
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // utility.json from utilities_data
  if (utilitiesData && ownerKey && utilitiesData[ownerKey]) {
    const utilityBase = {
      cooling_system_type: null,
      heating_system_type: null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: null,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: null,
      hvac_unit_issues: null,
    };
    const utility = {
      ...utilityBase,
      ...utilitiesData[ownerKey],
    };
    applySourceAndRequest(utility);
    writeJSON(path.join(dataDir, "utility.json"), utility);
  }

  // layout_*.json from layout_data with hierarchy support
  const layoutRecords = [];
  const layoutRelationships = [];
  const layoutCounters = new Map();
  const nextLayoutIndex = (spaceType) => {
    const key = spaceType || "Unspecified";
    const current = layoutCounters.get(key) || 0;
    const next = current + 1;
    layoutCounters.set(key, next);
    return next;
  };

  const createBaseLayout = (spaceType) => ({
    building_number: null,
    total_area_sq_ft: null,
    built_year: null,
    adjustable_area_sq_ft: null,
    livable_area_sq_ft: null,
    heated_area_sq_ft: null,
    area_under_air_sq_ft: null,
    story_type: null,
    //ceiling_height_average: null,
    source_http_request: cloneSourceRequest(),
    request_identifier: requestIdentifier,
    space_type: spaceType,
    space_index: null,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
  });

  const addLayoutRecord = (rawLayout, parentIndex = null) => {
    const spaceType =
      rawLayout?.space_type && typeof rawLayout.space_type === "string"
        ? rawLayout.space_type
        : "Living Area";
    const layout = createBaseLayout(spaceType);
    layout.space_index = nextLayoutIndex(spaceType);

    Object.entries(rawLayout || {}).forEach(([key, value]) => {
      if (
        key === "parent_id" ||
        key === "children" ||
        key === "internal_id" ||
        key === "id"
      )
        return;
      layout[key] = value;
    });

    layout.space_type = spaceType;
    layoutRecords.push({ layout, parentIndex });
    const currentRecord = layoutRecords[layoutRecords.length - 1];
    const parentRecord =
      parentIndex && parentIndex - 1 >= 0
        ? layoutRecords[parentIndex - 1]
        : null;
    currentRecord.layout.floor_level = normalizeFloorLevel(
      currentRecord.layout.floor_level,
      parentRecord ? parentRecord.layout.floor_level : null,
    );
    return layoutRecords.length;
  };

  const hasLayoutsFromOwners =
    layoutData &&
    ownerKey &&
    layoutData[ownerKey] &&
    Array.isArray(layoutData[ownerKey].layouts);

  const propertyType = property.property_type || null;
  const isLandProperty =
    propertyType &&
    typeof propertyType === "string" &&
    propertyType.toLowerCase().includes("land");

  let buildingLayoutIndex = null;
  if (!isLandProperty || hasLayoutsFromOwners) {
    buildingLayoutIndex = addLayoutRecord(
      {
        space_type: "Building",
        is_exterior: false,
        building_number: 1,
      },
      null,
    );
    if (buildingLayoutIndex) {
      const buildingRecord = layoutRecords[buildingLayoutIndex - 1];
      if (buildingRecord && buildingRecord.layout) {
        const livingAreaSqFt =
          parseNumber(bx.livingArea) ??
          parseNumber(property.livable_floor_area);
        if (
          livingAreaSqFt != null &&
          (buildingRecord.layout.livable_area_sq_ft == null ||
            buildingRecord.layout.livable_area_sq_ft === "")
        ) {
          buildingRecord.layout.livable_area_sq_ft = livingAreaSqFt;
        }
        if (
          buildingRecord.layout.total_area_sq_ft == null ||
          buildingRecord.layout.total_area_sq_ft === ""
        ) {
          if (livingAreaSqFt != null) {
            buildingRecord.layout.total_area_sq_ft = livingAreaSqFt;
          }
        }
      }
    }
  }

  const floorIndices = [];
  const storyCount = Number.isFinite(bx.structure.number_of_stories)
    ? bx.structure.number_of_stories
    : null;
  const FLOOR_LABELS = ["First Floor", "Second Floor", "Third Floor", "Fourth Floor"];

  if (buildingLayoutIndex) {
    if (storyCount && storyCount > 0) {
      const floorsToCreate = Math.min(storyCount, FLOOR_LABELS.length);
      for (let i = 0; i < floorsToCreate; i++) {
        const floorLayoutIndex = addLayoutRecord(
          {
            space_type: FLOOR_LABELS[i] || "Living Area",
            floor_level: FLOOR_LABELS[i] || null,
          },
          buildingLayoutIndex,
        );
        layoutRelationships.push({
          parentIndex: buildingLayoutIndex,
          childIndex: floorLayoutIndex,
        });
        floorIndices.push(floorLayoutIndex);
      }
    }
  }

  if (hasLayoutsFromOwners) {
    const ownerLayouts = layoutData[ownerKey].layouts;
    ownerLayouts.forEach((rawLayout) => {
      const parentIndex =
        rawLayout && typeof rawLayout.parent_index === "number"
          ? rawLayout.parent_index
          : floorIndices[0] || buildingLayoutIndex;
      const childIndex = addLayoutRecord(rawLayout, parentIndex || null);
      if (parentIndex) {
        layoutRelationships.push({
          parentIndex,
          childIndex,
        });
      } else if (floorIndices[0]) {
        layoutRelationships.push({
          parentIndex: floorIndices[0],
          childIndex,
        });
      }
    });
  }

  const layoutFiles = [];
  layoutRecords.forEach((record, idx) => {
    const fileName = `layout_${idx + 1}.json`;
    layoutFiles.push(fileName);
    writeJSON(path.join(dataDir, fileName), record.layout);
  });

  if (buildingLayoutIndex) {
    const topLevelLayouts = layoutRecords
      .map((record, idx) => ({ record, idx }))
      .filter(({ record }) => record.parentIndex == null);

    topLevelLayouts.forEach(({ idx }, relIdx) => {
      const relName = `relationship_property_has_layout_${relIdx + 1}.json`;
      const rel = {
        from: { "/": "./property.json" },
        to: { "/": `./${layoutFiles[idx]}` },
      };
      writeJSON(path.join(dataDir, relName), rel);
    });
  }

  if (layoutRelationships.length > 0) {
    layoutRelationships.forEach((rel, idx) => {
      const parentFile = layoutFiles[rel.parentIndex - 1];
      const childFile = layoutFiles[rel.childIndex - 1];
      if (!parentFile || !childFile) return;
      const relName = `relationship_layout_has_layout_${idx + 1}.json`;
      const payload = {
        from: { "/": `./${parentFile}` },
        to: { "/": `./${childFile}` },
      };
      writeJSON(path.join(dataDir, relName), payload);
    });
  }

  const buildingLayoutFile =
    buildingLayoutIndex && buildingLayoutIndex - 1 < layoutFiles.length
      ? layoutFiles[buildingLayoutIndex - 1]
      : null;

  if (buildingLayoutFile) {
    const structureFilePath = path.join(dataDir, "structure.json");
    if (fs.existsSync(structureFilePath)) {
      writeJSON(
        path.join(dataDir, "relationship_layout_has_structure.json"),
        {
          from: { "/": `./${buildingLayoutFile}` },
          to: { "/": "./structure.json" },
        },
      );
    }

    const utilityFilePath = path.join(dataDir, "utility.json");
    if (fs.existsSync(utilityFilePath)) {
      writeJSON(
        path.join(dataDir, "relationship_layout_has_utility.json"),
        {
          from: { "/": `./${buildingLayoutFile}` },
          to: { "/": "./utility.json" },
        },
      );
    }
  }

  // Owners: person_*.json or company_*.json
  let personFiles = [];
  let companyFiles = [];
  const personRecords = [];

  if (
    ownerData &&
    ownerKey &&
    ownerData[ownerKey] &&
    ownerData[ownerKey].owners_by_date &&
    Array.isArray(ownerData[ownerKey].owners_by_date.current)
  ) {
    const owners = ownerData[ownerKey].owners_by_date.current;
    let personIndex = 1;
    let companyIndex = 1;
    owners.forEach((o) => {
      if (!o || typeof o !== "object") return;
      if (o.type === "person") {
        const first = properCaseName(o.first_name || null);
        const last = properCaseName(o.last_name || null);
        const middle = o.middle_name ? o.middle_name : null;
        const person = {
          birth_date: null,
          first_name: first,
          last_name: last,
          middle_name: middle,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        applySourceAndRequest(person);
        const file = `person_${personIndex}.json`;
        writeJSON(path.join(dataDir, file), person);
        personFiles.push(file);
        personRecords.push({ file, record: person });

        enqueueRelationship("address", file, mailingAddressFile);
        enqueueRelationship("communication", file, mailingCommFile);

        personIndex++;
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        applySourceAndRequest(company);
        const file = `company_${companyIndex}.json`;
        writeJSON(path.join(dataDir, file), company);
        companyFiles.push(file);
        enqueueRelationship("address", file, mailingAddressFile);
        enqueueRelationship("communication", file, mailingCommFile);
        companyIndex++;
      }
    });
  }

  if (mailingAddressFile) {
    personFiles.forEach((pf, idx) => {
      const rel = {
        from: { "/": `./${pf}` },
        to: { "/": `./${mailingAddressFile}` },
      };
      const relName = `relationship_person_${idx + 1}_to_address.json`;
      writeJSON(path.join(dataDir, relName), rel);
    });
  }

  // sales_*.json, deed_*.json, file_*.json + relationships
  const salesFiles = [];
  const deedFiles = [];
  const fileFiles = [];
  bx.sales.forEach((s, i) => {
    const sName = `sales_${i + 1}.json`;
    const salesPayload = {
      ownership_transfer_date: s.ownership_transfer_date || null,
      purchase_price_amount:
        s.purchase_price_amount != null ? s.purchase_price_amount : null,
    };
    applySourceAndRequest(salesPayload);
    writeJSON(path.join(dataDir, sName), salesPayload);
    salesFiles.push(sName);
  });
  bx.deeds.forEach((d, i) => {
    const dName = `deed_${i + 1}.json`;
    const deedPayload = { deed_type: d.deed_type || null };
    applySourceAndRequest(deedPayload);
    writeJSON(path.join(dataDir, dName), deedPayload);
    deedFiles.push(dName);
  });
  bx.files.forEach((f, i) => {
    const fName = `file_${i + 1}.json`;
    const obj = applySourceAndRequest({ ...f });
    writeJSON(path.join(dataDir, fName), obj);
    fileFiles.push(fName);
  });

  // relationship_deed_has_file_*.json (deed -> file)
  for (let i = 0; i < Math.min(deedFiles.length, fileFiles.length); i++) {
    const rel = {
      from: { "/": `./${deedFiles[i]}` },
      to: { "/": `./${fileFiles[i]}` },
    };
    const relName = `relationship_deed_has_file_${i + 1}.json`;
    writeJSON(path.join(dataDir, relName), rel);
  }

  // relationship_sales_history_has_deed_*.json (sales history -> deed)
  for (let i = 0; i < Math.min(salesFiles.length, deedFiles.length); i++) {
    const rel = {
      from: { "/": `./${salesFiles[i]}` },
      to: { "/": `./${deedFiles[i]}` },
    };
    const relName = `relationship_sales_history_has_deed_${i + 1}.json`;
    writeJSON(path.join(dataDir, relName), rel);
  }

  // relationship_sales_history_has_person/company_*.json
  if (salesFiles.length > 0) {
    const recentSalesFile = salesFiles[0];
    personFiles.forEach((pf, idx) => {
      const rel = {
        from: { "/": `./${recentSalesFile}` },
        to: { "/": `./${pf}` },
      };
      const relName = `relationship_sales_history_has_person_${idx + 1}.json`;
      writeJSON(path.join(dataDir, relName), rel);
    });

    if (Array.isArray(companyFiles) && companyFiles.length > 0) {
      companyFiles.forEach((cf, idx) => {
        const rel = {
          from: { "/": `./${recentSalesFile}` },
          to: { "/": `./${cf}` },
        };
        const relName = `relationship_sales_history_has_company_${idx + 1}.json`;
        writeJSON(path.join(dataDir, relName), rel);
      });
    }
  }

  commRelationships.forEach((rel) => {
    if (rel.type === "address") {
      const relName = `relationship_${rel.from.replace(/\.json$/, "")}_to_address.json`;
      writeJSON(path.join(dataDir, relName), {
        from: { "/": `./${rel.from}` },
        to: { "/": `./${rel.to}` },
      });
    } else if (rel.type === "communication") {
      const relName = `relationship_${rel.from.replace(/\.json$/, "")}_to_communication.json`;
      writeJSON(path.join(dataDir, relName), {
        from: { "/": `./${rel.from}` },
        to: { "/": `./${rel.to}` },
      });
    }
  });
}

main();
