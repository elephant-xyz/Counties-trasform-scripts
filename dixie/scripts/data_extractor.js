// scripts/data_extractor.js
// Extraction script per instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - All others from input.html

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const BUILDING_SECTION_TITLE = "Buildings";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_mSection .module-content .tabular-data-two-column tbody tr";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_gvwSales tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl02_ctl01_grdValuation";
const OWNER_SECTION_SELECTOR = "#ctlBodyPane_ctl01_mSection .module-content";

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function writeHasRelationship(fromRef, toRef) {
  const normalize = (ref) => {
    const cleaned = ref.replace(/^\.\//, "");
    return path.basename(cleaned, ".json");
  };
  const fromName = normalize(fromRef);
  const toName = normalize(toRef);
  const relFileName = `relationship_${fromName}_has_${toName}.json`;
  const relObj = {
    from: { "/": fromRef },
    to: { "/": toRef },
  };
  writeJSON(path.join("data", relFileName), relObj);
  return relFileName;
}

function buildSourceHttpRequest(parcelId) {
  return {
    method: "GET",
    url: "https://qpublic.schneidercorp.com/application.aspx",
    multiValueQueryString: {
      AppID: ["1207"],
      LayerID: ["36374"],
      PageTypeID: ["4"],
      PageID: ["13872"],
      Q: ["47389550"],
      KeyValue: [parcelId],
    },
  };
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    const mm2 = mm.padStart(2, "0");
    const dd2 = dd.padStart(2, "0");
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function textOf($el) {
  if (!$el || $el.length === 0) return null;
  return $el.text().trim();
}

function loadHTML() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function extractLegalDescription($) {
  let desc = "";
  let foundLegal = false;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const th = textOf($(tr).find("th"));
    if ((th || "").toLowerCase().includes("legal description")) {
      desc += textTrim($(tr).find("td").text());
      foundLegal = true;
    } else if (foundLegal && !th) {
      // Continue capturing text from rows without th (continuation rows)
      const tdText = textTrim($(tr).find("td").text());
      if (tdText) desc += " " + tdText;
    } else if (foundLegal && th) {
      // Stop when we hit a new section
      return false;
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th"));
    if ((th || "").toLowerCase().includes("land use")) {
      code = textOf($(tr).find("td span"));
    }
  });
  return code || null;
}

function extractAcreage($) {
  let acreage = null;
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th"));
    if ((th || "").toLowerCase().includes("acres")) {
      const value = textOf($(tr).find("td span"));
      if (value) {
        acreage = parseFloat(value);
      }
    }
  });
  return acreage;
}

function convertAcresToSqFt(acres) {
  if (!acres || acres <= 0) return null;
  return Math.round(acres * 43560); // 1 acre = 43,560 sq ft
}

function normalizeUseCode(code) {
  if (!code) return null;
  return code.replace(/\s+/g, " ").trim().toUpperCase();
}

const PROPERTY_USE_CODE_MAPPINGS = {};

function definePropertyUseMapping(codes, config) {
  codes.forEach((code) => {
    const key = normalizeUseCode(code);
    if (!key) return;
    PROPERTY_USE_CODE_MAPPINGS[key] = { ...config };
  });
}

definePropertyUseMapping(
  [
    "#1 PINE NO LEASE",
    "#3 PINE NO LEASE",
    "HARDWOOD SITE > 50",
    "HARDWOOD SITE > 60",
    "HARDWOOD SITE > 70",
    "HARDWOOD SITE > 80",
    "HARDWOOD SITE > 90",
    "HARDWOOD SWAMP",
    "MATURE HARDWOOD",
    "TIMBERLAND"
  ],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TimberLand"
  }
);

definePropertyUseMapping(
  ["CROPLAND"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "DrylandCropland"
  }
);

definePropertyUseMapping(
  ["IRRIGATED CROPLAND 2"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "CroplandClass2"
  }
);

definePropertyUseMapping(
  ["IRRIGATED CROPLAND 3"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "CroplandClass3"
  }
);

definePropertyUseMapping(
  ["GRAZING LAN"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "GrazingLand"
  }
);

definePropertyUseMapping(
  ["IMPROVE AGR"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "Agricultural"
  }
);

definePropertyUseMapping(
  ["NON PROD WASTE", "WASTE LANDS"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Conservation"
  }
);

definePropertyUseMapping(
  [
    "CANAL LOT",
    "HOMESITE ACRE",
    "RIVERFRONT",
    "RURAL ACREAGE 2-4 ACRES",
    "RURAL ACREAGE 4-7 ACRES",
    "RURAL ACREAGE LESS THAN 2 ACRES",
    "VAC RES"
  ],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Residential"
  }
);

definePropertyUseMapping(
  ["MRLT VAL", "NOT GOV ACR", "UNKNOWN", "VACANT INS"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Unknown"
  }
);

definePropertyUseMapping(
  ["VAC COMM"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Commercial"
  }
);

definePropertyUseMapping(
  ["VAC INDUST"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "Industrial"
  }
);

definePropertyUseMapping(
  ["HORSESHOE WET WORKING WATERFRONT"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "Commercial"
  }
);

definePropertyUseMapping(
  ["RIVER FRONT AG HOMESITE"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached"
  }
);

definePropertyUseMapping(
  ["SIN RES"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached"
  }
);

definePropertyUseMapping(
  ["HOME AGED"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "HomesForAged",
    structure_form: "MultiFamilyMoreThan10"
  }
);

definePropertyUseMapping(
  ["MUL FAM"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10"
  }
);

definePropertyUseMapping(
  ["MANUFACTURED HOUSING"],
  {
    property_type: "ManufacturedHome",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "ManufacturedHousing"
  }
);

definePropertyUseMapping(
  ["MOB PARK"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "MobileHomePark",
    structure_form: "ManufacturedHomeInPark"
  }
);

definePropertyUseMapping(
  ["CONDO"],
  {
    property_type: "Unit",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Condominium"
  }
);

definePropertyUseMapping(
  ["COOPTVE"],
  {
    property_type: "Unit",
    build_status: "Improved",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Cooperative"
  }
);

definePropertyUseMapping(
  ["AIR/MARINA"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "TransportationTerminal"
  }
);

definePropertyUseMapping(
  ["AUTO SALES/REPAIR", "AUTO/RV SALES"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "AutoSalesRepair"
  }
);

definePropertyUseMapping(
  ["CAMP"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "Recreational"
  }
);

definePropertyUseMapping(
  ["CELL TOWER SITE"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "TelecommunicationsFacility"
  }
);

definePropertyUseMapping(
  ["CHURCHES"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Church"
  }
);

definePropertyUseMapping(
  ["CLUBS LODGE"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "ClubsLodges"
  }
);

definePropertyUseMapping(
  ["COUNTY", "MUNICIPAL", "STATE OTHER"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "GovernmentProperty"
  }
);

definePropertyUseMapping(
  ["DEP STORES"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "DepartmentStore"
  }
);

definePropertyUseMapping(
  ["DRIVE IN RE", "RES CAFETER"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Restaurant"
  }
);

definePropertyUseMapping(
  ["FINANCI INS"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "FinancialInstitution"
  }
);

definePropertyUseMapping(
  ["FLORIST"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "NurseryGreenhouse"
  }
);

definePropertyUseMapping(
  ["HOTEL MOTL", "MOTEL, LOW-RISE"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Hotel"
  }
);

definePropertyUseMapping(
  ["LIGHT MANUF"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "LightManufacturing"
  }
);

definePropertyUseMapping(
  ["LUMBER YARD"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "LumberYard"
  }
);

definePropertyUseMapping(
  ["MINI WAREHOUSE", "WAREHOUSEIN"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Warehouse"
  }
);

definePropertyUseMapping(
  ["MORTUARIES"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "MortuaryCemetery"
  }
);

definePropertyUseMapping(
  ["NIGHT CLUB"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Entertainment"
  }
);

definePropertyUseMapping(
  ["OFFICE BLD", "PROFES BLD", "PROFESSIONAL OFFICE BUILDING"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "OfficeBuilding"
  }
);

definePropertyUseMapping(
  ["OLD COMMERCIAL HYWAY FRONT", "SERVICE SHP", "STORE OFF", "STORES 1"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "RetailStore"
  }
);

definePropertyUseMapping(
  ["OPEN STORAG"],
  {
    property_type: "LandParcel",
    build_status: "Improved",
    property_usage_type: "OpenStorage"
  }
);

definePropertyUseMapping(
  ["PETROLEUM", "SER STATION"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "ServiceStation"
  }
);

definePropertyUseMapping(
  ["SHOP CENTE"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "ShoppingCenterCommunity"
  }
);

definePropertyUseMapping(
  ["SCHOOL PRIV"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "PrivateSchool"
  }
);

definePropertyUseMapping(
  ["SCHOOLS PUB"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "PublicSchool"
  }
);

definePropertyUseMapping(
  ["SUP MARKET"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Supermarket"
  }
);

definePropertyUseMapping(
  ["THEATER DR"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Theater"
  }
);

definePropertyUseMapping(
  ["UTILITY"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "Utility"
  }
);

definePropertyUseMapping(
  ["WHOLESA OUT"],
  {
    property_type: "Building",
    build_status: "Improved",
    property_usage_type: "WholesaleOutlet"
  }
);

definePropertyUseMapping(
  ["RIGHT OF"],
  {
    property_type: "LandParcel",
    build_status: "VacantLand",
    property_usage_type: "TransportationTerminal",
    ownership_estate_type: "RightOfWay"
  }
);

function mapPropertyAttributesFromUseCode(code) {
  const normalized = normalizeUseCode(code);
  if (!normalized) return null;
  const mapping = PROPERTY_USE_CODE_MAPPINGS[normalized];
  if (!mapping) return null;
  return {
    ownership_estate_type: mapping.ownership_estate_type ?? "FeeSimple",
    build_status: mapping.build_status,
    structure_form: mapping.structure_form ?? null,
    property_usage_type: mapping.property_usage_type,
    property_type: mapping.property_type,
  };
}




function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE || textTrim($(s).find(".title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();

  if (!section.length) return buildings;
  
  $(section).find(".block-row").each((_, blockRow) => {
    const building = {};
    
    $(blockRow).find(".two-column-blocks").each((__, columnBlock) => {
      $(columnBlock).find("table tbody tr").each((___, tr) => {
        const label = textTrim($(tr).find("th strong").first().text()) || textTrim($(tr).find("td strong").first().text());
        const value = textTrim($(tr).find("td span").first().text());
        if (label) building[label] = value;
      });
    });
    
    if (Object.keys(building).length) buildings.push(building);
  });
  // console.log("BUildings>>",buildings);
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function formatNameForSchema(name) {
  if (!name) return null;
  const formatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  return pattern.test(formatted) ? formatted : null;
}

function formatMiddleNameForSchema(name) {
  if (!name) return null;
  const formatted = name.charAt(0).toUpperCase() + name.slice(1);
  const pattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  return pattern.test(formatted) ? formatted : null;
}

function validateAndFilterPeople(people) {
  return people.filter(person => {
    // Schema requires first_name and last_name to be non-null strings
    if (!person.first_name || !person.last_name) {
      return false;
    }
    const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
    if (!namePattern.test(person.first_name) || !namePattern.test(person.last_name)) {
      return false;
    }
    if (person.middle_name) {
      const middlePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
      if (!middlePattern.test(person.middle_name)) {
        person.middle_name = null;
      }
    }
    return true;
  });
}

const NAME_COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "company",
  "services",
  "trust",
  "tr",
  "association",
  "associates",
  "partners",
  "lp",
  "llp",
  "plc",
  "holdings",
  "properties",
  "property",
  "management",
  "bank",
  "authority",
  "group",
  "clerk",
  "court",
];

const NAME_PERSON_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

const COMMON_FIRST_NAMES_SET = new Set([
  "JAMES",
  "JOHN",
  "ROBERT",
  "MICHAEL",
  "WILLIAM",
  "DAVID",
  "RICHARD",
  "CHARLES",
  "JOSEPH",
  "THOMAS",
  "CHRISTOPHER",
  "DANIEL",
  "PAUL",
  "MARK",
  "DONALD",
  "GEORGE",
  "KENNETH",
  "STEVEN",
  "EDWARD",
  "BRIAN",
  "RONALD",
  "ANTHONY",
  "KEVIN",
  "JASON",
  "MATTHEW",
  "GARY",
  "TIMOTHY",
  "LARRY",
  "JEFFREY",
  "FRANK",
  "SCOTT",
  "ERIC",
  "STEPHEN",
  "ANDREW",
  "RAYMOND",
  "GREGORY",
  "JOSHUA",
  "JERRY",
  "DENNIS",
  "PATRICK",
  "PETER",
  "HAROLD",
  "DOUGLAS",
  "HENRY",
  "CARL",
  "ARTHUR",
  "RYAN",
  "ROGER",
  "JACOB",
  "BILLY",
  "GREG",
  "GLEN",
  "GLENN",
  "MARY",
  "PATRICIA",
  "LINDA",
  "BARBARA",
  "ELIZABETH",
  "JENNIFER",
  "MARIA",
  "SUSAN",
  "MARGARET",
  "DOROTHY",
  "LISA",
  "NANCY",
  "KAREN",
  "BETTY",
  "HELEN",
  "SANDRA",
  "DONNA",
  "CAROL",
  "RUTH",
  "SHARON",
  "MICHELLE",
  "LAURA",
  "SARAH",
  "KIMBERLY",
  "DEBORAH",
  "JESSICA",
  "CYNTHIA",
  "ANGELA",
  "MELISSA",
  "BRENDA",
  "AMY",
  "ANNA",
  "REBECCA",
  "KATHLEEN",
  "PAMELA",
  "MARTHA",
  "DEBRA",
  "AMANDA",
  "STEPHANIE",
  "CAROLYN",
  "CHRISTINE",
  "MARIE",
  "JANET",
  "CATHERINE",
  "FRANCES",
  "ANN",
  "JOYCE",
  "DIANE",
  "ALICE",
  "JULIE",
  "HEATHER",
  "TERESA",
  "LORI",
  "GLORIA",
  "RACHEL",
  "DEBBIE",
  "DEBORA",
  "DEBRAH",
]);

function cleanGrantorRawName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const noisePatterns = [
    /\bET\s*AL\b/gi,
    /\bETAL\b/gi,
    /\bET\s*UX\b/gi,
    /\bET\s*VIR\b/gi,
    /\bET\s+UXOR\b/gi,
    /\bTRUSTEE[S]?\b/gi,
    /\bTTEE[S]?\b/gi,
    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bAKA\b/gi,
    /\bA\/K\/A\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\b%\s*INTEREST\b/gi,
    /\b\d{1,3}%\b/gi,
    /\b\d{1,3}%\s*INTEREST\b/gi,
    /\bJR\.?\b/gi,
    /\bSR\.?\b/gi,
  ];
  noisePatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  s = s.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(&|and)\s+/i, "")
    .replace(/\s+(&|and)$/i, "")
    .trim();
  const companySuffix = "(?:LLC|L\\.L\\.C|INC|CORP|CO|COMPANY|LTD|TRUST|LP|LLP|PLC|PLLC)";
  const trailingNumAfterCo = new RegExp(`^(.*?\\b${companySuffix}\\b)\\s+\\d{1,3}$`, "i");
  const m = s.match(trailingNumAfterCo);
  if (m) {
    s = m[1].trim();
  }
  return s;
}

function splitGrantorComposite(name) {
  const cleaned = cleanGrantorRawName(name);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isGrantorCompanyName(name) {
  const n = name.toLowerCase();
  return NAME_COMPANY_KEYWORDS.some((kw) => new RegExp(`(^|\\b)${kw}(\\b|\\.$)`, "i").test(n));
}

function isGrantorInitial(token) {
  return /^[A-Z]$/i.test(token || "");
}

function isGrantorSuffix(token) {
  if (!token) return false;
  const clean = token.replace(/\./g, "").toUpperCase();
  return NAME_PERSON_SUFFIXES.has(clean);
}

function isGrantorCommonFirstName(token) {
  if (!token) return false;
  return COMMON_FIRST_NAMES_SET.has(token.replace(/\./g, "").toUpperCase());
}

function classifyGrantor(raw) {
  const cleaned = cleanGrantorRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (cleaned.toUpperCase() === "UNKNOWN") {
    return { valid: false, reason: "unknown_name", raw };
  }
  if (isGrantorCompanyName(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  const tokens = cleaned.split(/\s+/).map((p) => p.trim()).filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }
  const rawHasComma = /,/.test(raw || "");
  const workingTokens = [...tokens];
  while (workingTokens.length > 2 && isGrantorSuffix(workingTokens[workingTokens.length - 1])) {
    workingTokens.pop();
  }
  if (workingTokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  const buildCandidate = (useLastFirst) => {
    if (useLastFirst && workingTokens.length < 2) return null;
    let firstRaw;
    let lastRaw;
    let middleTokens;
    if (useLastFirst) {
      lastRaw = workingTokens[0];
      firstRaw = workingTokens[1];
      middleTokens = workingTokens.slice(2);
    } else {
      firstRaw = workingTokens[0];
      lastRaw = workingTokens[workingTokens.length - 1];
      middleTokens = workingTokens.slice(1, -1);
    }
    const firstClean = cleanGrantorRawName(firstRaw);
    const lastClean = cleanGrantorRawName(lastRaw);
    const middleCleanRaw = cleanGrantorRawName(middleTokens.join(" ").trim());
    const middleFormatted = middleCleanRaw ? formatMiddleNameForSchema(middleCleanRaw) || middleCleanRaw : null;
    if (!firstClean || !lastClean) return null;
    const firstFormatted = formatNameForSchema(firstClean) || firstClean;
    const lastFormatted = formatNameForSchema(lastClean) || lastClean;
    return {
      type: "person",
      first_name: firstFormatted,
      last_name: lastFormatted,
      middle_name: middleFormatted,
    };
  };

  const candidateFirstLast = buildCandidate(false);
  const candidateLastFirst = buildCandidate(true);

  const lastTokenOriginal = workingTokens[workingTokens.length - 1];
  const secondTokenOriginal = workingTokens[1] || "";
  const lastTokenIsInitial = isGrantorInitial(lastTokenOriginal);
  const secondTokenIsInitial = isGrantorInitial(secondTokenOriginal);

  const scoreCandidate = (candidate, orientation) => {
    if (!candidate) return -Infinity;
    const { first_name, last_name } = candidate;
    if (!first_name || !last_name) return -Infinity;
    let score = 0;
    if (first_name.length > 1) score += 1;
    if (last_name.length > 1) score += 2;
    if (candidate.middle_name) score += 0.5;
    if (orientation === "lastFirst") {
      if (rawHasComma) score += 4;
      if (lastTokenIsInitial) score += 2;
      if (secondTokenIsInitial) score += 1;
      if (isGrantorCommonFirstName(secondTokenOriginal)) score += 1.5;
    } else {
      if (candidate.last_name.length <= 1) score -= 3;
    }
    if (candidate.last_name.length <= 1) score -= 1;
    return score;
  };

  const scoreFirst = scoreCandidate(candidateFirstLast, "firstLast");
  const scoreLast = scoreCandidate(candidateLastFirst, "lastFirst");

  let chosen = candidateFirstLast;
  if (scoreLast > scoreFirst) {
    chosen = candidateLastFirst;
  } else if (scoreLast === scoreFirst && rawHasComma) {
    chosen = candidateLastFirst;
  }

  if (chosen) {
    return { valid: true, owner: chosen };
  }
  return { valid: false, reason: "person_missing_first_or_last", raw: cleaned };
}

function parseGrantorNames(raw) {
  if (!raw) return [];
  const parts = splitGrantorComposite(raw);
  const out = [];
  parts.forEach((part) => {
    const res = classifyGrantor(part);
    if (res.valid) out.push(res.owner);
  });
  return out;
}

function extractBuildingYears($) {
  const buildings = collectBuildings($);
  const yearsActual = [];
  const yearsEffective = [];
   buildings.forEach((b) => {
    yearsActual.push(toInt(b["Year Built"]));
    yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: yearsEffective.length ? Math.min(...yearsEffective) : null,
  };
}



function extractAreas($) {
  let total = 0;
  let grossArea = 0;
  let finishedArea = 0;
  const buildings = collectBuildings($);
  buildings.forEach((b) => {
    grossArea += toInt(b["Total Area"]);
  });
  return {
    total: grossArea
  };
}

function extractNumberOfUnits($) {
  const buildings = collectBuildings($);
  let totalUnits = 0;
  buildings.forEach((b) => {
    const type = b["Type"] || "";
    const match = type.match(/(\d+)-?PLEX|QUDPLEX/);
    if (match) {
      if (type.includes("QUDPLEX")) totalUnits += 4;
      else totalUnits += parseInt(match[1]) || 0;
    }
  });
  return totalUnits > 0 ? totalUnits : null;
}

function getNumberOfUnitsType(numberOfUnits) {
  if (!numberOfUnits || numberOfUnits <= 0) return null;
  if (numberOfUnits === 1) return "One";
  if (numberOfUnits === 2) return "Two";
  if (numberOfUnits === 3) return "Three";
  if (numberOfUnits === 4) return "Four";
  if (numberOfUnits >= 2 && numberOfUnits <= 4) return "TwoToFour";
  if (numberOfUnits >= 1 && numberOfUnits <= 4) return "OneToFour";
  return null;
}


function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const $tr = $(tr);
    const th = $tr.find("th");
    const tds = $tr.find("td");
    
    if (th.length === 0 && tds.length === 0) return; // Skip empty rows
    
    const saleDate = textOf(th.length ? th : $(tds[0])); // Sale Date from th or first td
    const salePrice = textOf($(tds[0])); // Sale Price column
    const legalReference = textOf($(tds[1])); // Legal Reference column
    const grantor = textOf($(tds[2])); // Grantor column
    const lucAtSale = textOf($(tds[3])); // LUC at Sale column
    const deedType = textOf($(tds[4])); // Deed Type column
    const nalCode = textOf($(tds[5])); // N.A.L. Code column
    const legalParsed = parseLegalReference(legalReference);
    
    out.push({
      saleDate,
      salePrice,
      legalReference,
      grantor,
      lucAtSale,
      deedType,
      nalCode,
      deedBook: legalParsed.book,
      deedPage: legalParsed.page,
      deedVolume: legalParsed.volume,
      instrumentNumber: legalParsed.instrument_number,
    });
  });
  return out;
}

function extractMailingAddress($) {
  const section = $(OWNER_SECTION_SELECTOR);
  if (!section.length) return null;
  const addressSpan = section.find("[id*='lblOwnerAddress']").first();
  if (!addressSpan || !addressSpan.length) return null;
  const lines = [];
  addressSpan.find("div").each((_, div) => {
    const line = textTrim($(div).text());
    if (line) lines.push(line);
  });
  return lines.length ? lines.join(", ") : null;
}

function mapDeedType(deedType) {
  if (!deedType) return null;
  const u = deedType.trim().toUpperCase();
  if (u.includes("WARRANTY DEED") || u === "WD") return "Warranty Deed";
  if (u.includes("SPECIAL WARRANTY")) return "Special Warranty Deed";
  if (u.includes("QUIT") || u.includes("QC")) return "Quitclaim Deed";
  if (u.includes("GRANT DEED") || u === "GD") return "Grant Deed";
  if (u.includes("BARGAIN") || u.includes("SALE DEED")) return "Bargain and Sale Deed";
  if (u.includes("LADY BIRD")) return "Lady Bird Deed";
  if (u.includes("TRANSFER ON DEATH") || u.includes("TOD")) return "Transfer on Death Deed";
  if (u.includes("SHERIFF")) return "Sheriff's Deed";
  if (u.includes("TAX DEED") || u === "TD" || u.includes("TX")) return "Tax Deed";
  if (u.includes("TRUSTEE")) return "Trustee's Deed";
  if (u.includes("PERSONAL REPRESENTATIVE") || u.includes("PRD")) return "Personal Representative Deed";
  if (u.includes("CORRECTION")) return "Correction Deed";
  if (u.includes("DEED IN LIEU")) return "Deed in Lieu of Foreclosure";
  if (u.includes("LIFE ESTATE") || u.includes("LED")) return "Life Estate Deed";
  if (u.includes("JOINT TENANCY") || u.includes("JTD")) return "Joint Tenancy Deed";
  if (u.includes("TENANCY IN COMMON") || u.includes("TCD")) return "Tenancy in Common Deed";
  if (u.includes("COMMUNITY PROPERTY") || u.includes("CPD")) return "Community Property Deed";
  if (u.includes("GIFT")) return "Gift Deed";
  if (u.includes("INTERSPOUSAL") || u.includes("ITD")) return "Interspousal Transfer Deed";
  if (u.includes("WILD")) return "Wild Deed";
  if (u.includes("SPECIAL MASTER")) return "Special Master\u2019s Deed";
  if (u.includes("COURT ORDER") || u.includes("COD")) return "Court Order Deed";
  if (u.includes("CONTRACT FOR DEED") || u.includes("CFD")) return "Contract for Deed";
  if (u.includes("QUIET TITLE") || u.includes("QTD")) return "Quiet Title Deed";
  if (u.includes("ADMINISTRATOR")) return "Administrator's Deed";
  if (u.includes("GUARDIAN")) return "Guardian's Deed";
  if (u.includes("RECEIVER")) return "Receiver's Deed";
  if (u.includes("RIGHT OF WAY") || u.includes("ROW")) return "Right of Way Deed";
  if (u.includes("VACATION OF PLAT") || u.includes("VPD")) return "Vacation of Plat Deed";
  if (u.includes("ASSIGNMENT OF CONTRACT") || u.includes("AOC")) return "Assignment of Contract";
  if (u.includes("RELEASE OF CONTRACT") || u.includes("ROC")) return "Release of Contract";
  return "Miscellaneous";
}

function parseLegalReference(legalReference) {
  if (!legalReference) {
    return { book: null, page: null, volume: null, instrument_number: null };
  }
  const digits = legalReference.match(/(\d+)/g) || [];
  const book = digits[0] || null;
  const page = digits[1] || null;
  return { book, page, volume: null, instrument_number: null };
}


function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  const headerThs = table.find("thead tr th.value-column");
  headerThs.each((idx, th) => {
    const txt = $(th).text().trim();
    const match = txt.match(/(\d{4})/);
    if (match) years.push({ year: parseInt(match[1]), idx });
  });
  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    const label = textOf($tr.find("th"));
    const tds = $tr.find("td.value-column");
    const vals = [];
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    if (label) dataMap[label] = vals;
  });
  return years.map(({ year, idx }) => {
    const get = (label) => {
      const arr = dataMap[label] || [];
      return arr[idx] || null;
    };
    return {
      year,
      building: get("Building Value"),
      land: get("Land Value Market Value"),
      market: get("Total Just or Market Value"),
      assessed: get("Classified Use or Assessed Value"),
      taxable: get("Total Non School Taxable Value"),
    };
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  // console.log(legal);
  const useCode = extractUseCode($);
  const propertyAttributes = mapPropertyAttributesFromUseCode(useCode);
  const normalizedUseCode = normalizeUseCode(useCode);
  if (!propertyAttributes) {
    throw {
      type: "error",
      message: `Unsupported property use code "${normalizedUseCode ?? useCode ?? ""}".`,
      path: "property.property_usage_type",
    };
  }
  const years = extractBuildingYears($);
  const areas = extractAreas($);
  const acreage = extractAcreage($);
  const totalAreaSqFt = convertAcresToSqFt(acreage);
  const numberOfUnits = extractNumberOfUnits($);
  const numberOfUnitsType = getNumberOfUnitsType(numberOfUnits);


  const property = {
    parcel_identifier: parcelId || "",
    property_usage_type: propertyAttributes.property_usage_type,
    property_legal_description_text: legal || null,
    ownership_estate_type: propertyAttributes.ownership_estate_type,
    build_status: propertyAttributes.build_status,
    structure_form: propertyAttributes.structure_form,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    property_type: propertyAttributes.property_type,
    livable_floor_area: areas.livable_floor_area >= 10 ? String(areas.livable_floor_area) : null,
    total_area: totalAreaSqFt ? String(totalAreaSqFt) : null,
    number_of_units_type: numberOfUnitsType,
    area_under_air: areas.area_under_air >= 10 ? String(areas.area_under_air) : null,
    number_of_units: numberOfUnits,
    subdivision: null,
    zoning: null,
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["1207"],
        LayerID: ["36374"],
        PageTypeID: ["4"],
        PageID: ["13872"],
        Q: ["47389550"],
        KeyValue: [parcelId]
      }
    },
    request_identifier: parcelId,
    historic_designation: false
  };
  writeJSON(path.join("data", "property.json"), property);
  return propertyAttributes;
}

function writeSalesHistoryArtifacts($, parcelId) {
  const sales = extractSales($);
  const salesRecords = [];
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^(sales_|sales_history_|deed_|file_)/.test(f) ||
        /^relationship_(?:deed_file|sales_deed|sales_history_)/.test(f) ||
        /^relationship_property_has_sales_history_/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  sales.forEach((s, i) => {
    const idx = i + 1;
    const isoDate = parseDateToISO(s.saleDate);
    const purchasePrice = parseCurrencyToNumber(s.salePrice);
    const saleRequestId = parcelId ? `${parcelId}_sale_${idx}` : `sale_${idx}`;
    const deedRequestId = parcelId ? `${parcelId}_deed_${idx}` : `deed_${idx}`;
    const grantorEntities = parseGrantorNames(s.grantor);

    const saleObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: purchasePrice,
      request_identifier: saleRequestId,
      source_http_request: buildSourceHttpRequest(parcelId),
    };
    if (s.saleType) {
      saleObj.sale_type = s.saleType;
    }
    writeJSON(path.join("data", `sales_history_${idx}.json`), saleObj);

    const deed = {
      deed_type: mapDeedType(s.deedType),
      request_identifier: deedRequestId,
      source_http_request: buildSourceHttpRequest(parcelId),
    };
    if (s.deedBook) deed.book = String(s.deedBook);
    if (s.deedPage) deed.page = String(s.deedPage);
    if (s.deedVolume) deed.volume = String(s.deedVolume);
    if (s.instrumentNumber) deed.instrument_number = String(s.instrumentNumber);
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    const file = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: s.legalReference ? `Deed ${s.legalReference}` : "Deed Document",
      original_url: null,
      request_identifier: `${deedRequestId}_file`,
    };
    writeJSON(path.join("data", `file_${idx}.json`), file);

    writeHasRelationship(`./deed_${idx}.json`, `./file_${idx}.json`);
    writeHasRelationship(`./sales_history_${idx}.json`, `./deed_${idx}.json`);
    writeHasRelationship("./property.json", `./sales_history_${idx}.json`);

    salesRecords.push({
      index: idx,
      isoDate,
      grantor: s.grantor,
      grantors: grantorEntities,
      grantorRaw: s.grantor,
      saleFile: `./sales_history_${idx}.json`,
    });
  });

  return salesRecords;
}

function findPersonIndexByName(peopleMap, first, last) {
  const tf = titleCaseName(first);
  const tl = titleCaseName(last);
  const key = `${(tf || "").toUpperCase()}|${(tl || "").toUpperCase()}`;
  if (peopleMap.has(key)) return peopleMap.get(key);
  return null;
}

function findCompanyIndexByName(companyMap, name) {
  const tn = (name || "").trim().toUpperCase();
  if (companyMap.has(tn)) return companyMap.get(tn);
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writePersonCompaniesSalesRelationships($, parcelId, salesRecords) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;

  const personCanonical = new Map();
  const companySet = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const normKey = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (!personCanonical.has(normKey)) {
          personCanonical.set(normKey, {
            first_name: o.first_name || null,
            middle_name: o.middle_name || null,
            last_name: o.last_name || null,
          });
        } else {
          const existing = personCanonical.get(normKey);
          if (!existing.middle_name && o.middle_name) existing.middle_name = o.middle_name;
        }
      } else if (o.type === "company" && (o.name || "").trim()) {
        companySet.add((o.name || "").trim());
      }
    });
  });

  const personEntries = Array.from(personCanonical.entries()).map(([normKey, person]) => ({
    normKey,
    data: {
      source_http_request: buildSourceHttpRequest(parcelId),
      request_identifier: parcelId,
      birth_date: null,
      first_name: person.first_name ? formatNameForSchema(person.first_name) : null,
      middle_name: person.middle_name ? formatMiddleNameForSchema(person.middle_name) : null,
      last_name: person.last_name ? formatNameForSchema(person.last_name) : null,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    },
  }));

  const preparedPeople = personEntries.map((entry) => ({ ...entry.data }));
  const validPeople = validateAndFilterPeople(preparedPeople);
  const personIndexMap = new Map();
  validPeople.forEach((person, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), person);
    const keyNorm = `${titleCaseName(person.first_name).toUpperCase()}|${titleCaseName(person.last_name).toUpperCase()}`;
    personIndexMap.set(keyNorm, idx + 1);
  });

  const companyIndexMap = new Map();
  Array.from(companySet).forEach((name, idx) => {
    const companyObj = {
      name,
      request_identifier: parcelId,
      source_http_request: buildSourceHttpRequest(parcelId),
    };
    writeJSON(path.join("data", `company_${idx + 1}.json`), companyObj);
    companyIndexMap.set(name.trim().toUpperCase(), idx + 1);
  });

  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^relationship_sales_history_\d+_has_person_\d+\.json$/.test(f) ||
        /^relationship_sales_history_\d+_has_company_\d+\.json$/.test(f) ||
        /^relationship_person_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f) ||
        /^relationship_company_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f) ||
        /^relationship_sales_history_person_\d+\.json$/.test(f) ||
        /^relationship_sales_history_company_\d+\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  const latestSaleIso = salesRecords.reduce((latest, rec) => {
    if (!rec.isoDate) return latest;
    if (!latest) return rec.isoDate;
    return latest > rec.isoDate ? latest : rec.isoDate;
  }, null);

  salesRecords.forEach((rec) => {
    const ownersOnDate = [];
    if (rec.isoDate && Array.isArray(ownersByDate[rec.isoDate])) {
      ownersOnDate.push(...ownersByDate[rec.isoDate]);
    }
    if (latestSaleIso && rec.isoDate === latestSaleIso && Array.isArray(ownersByDate.current)) {
      ownersOnDate.push(...ownersByDate.current);
    }
    const seenPersons = new Set();
    const seenCompanies = new Set();
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const idx = findPersonIndexByName(personIndexMap, o.first_name, o.last_name);
        if (idx && !seenPersons.has(idx)) {
          seenPersons.add(idx);
          writeHasRelationship(rec.saleFile, `./person_${idx}.json`);
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const idx = findCompanyIndexByName(companyIndexMap, o.name);
        if (idx && !seenCompanies.has(idx)) {
          seenCompanies.add(idx);
          writeHasRelationship(rec.saleFile, `./company_${idx}.json`);
        }
      });
  });

  const mailingAddress = extractMailingAddress($);
  if (mailingAddress) {
    const mailingPath = path.join("data", "mailing_address_1.json");
    writeJSON(mailingPath, {
      unnormalized_address: mailingAddress,
      latitude: null,
      longitude: null,
      source_http_request: buildSourceHttpRequest(parcelId),
      request_identifier: parcelId,
    });

    const ownersForMailing = Array.isArray(ownersByDate.current) && ownersByDate.current.length
      ? ownersByDate.current
      : (latestSaleIso && Array.isArray(ownersByDate[latestSaleIso]) ? ownersByDate[latestSaleIso] : []);

    const processedPerson = new Set();
    const processedCompany = new Set();

    ownersForMailing
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const idx = findPersonIndexByName(personIndexMap, o.first_name, o.last_name);
        if (idx && !processedPerson.has(idx)) {
          processedPerson.add(idx);
          writeHasRelationship(`./person_${idx}.json`, "./mailing_address_1.json");
        }
      });

    ownersForMailing
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const idx = findCompanyIndexByName(companyIndexMap, o.name);
        if (idx && !processedCompany.has(idx)) {
          processedCompany.add(idx);
          writeHasRelationship(`./company_${idx}.json`, "./mailing_address_1.json");
        }
      });
  } else {
    const mailingPath = path.join("data", "mailing_address_1.json");
    if (fs.existsSync(mailingPath)) {
      fs.unlinkSync(mailingPath);
    }
  }
}

function writeTaxes($, parcelId) {
  const vals = extractValuation($);
  vals.forEach((v) => {
    const taxObj = {
      source_http_request: {
        method: "GET",
        url: "https://qpublic.schneidercorp.com/application.aspx",
        multiValueQueryString: {
          AppID: ["1207"],
          LayerID: ["36374"],
          PageTypeID: ["4"],
          PageID: ["13872"],
          Q: ["47389550"],
          KeyValue: [parcelId]
        }
      },
      request_identifier: parcelId,
      tax_year: v.year || null,
      property_assessed_value_amount: parseCurrencyToNumber(v.assessed) ?? 0,
      property_market_value_amount: parseCurrencyToNumber(v.market) ?? 0,
      property_building_amount: parseCurrencyToNumber(v.building) ?? null,
      property_land_amount: parseCurrencyToNumber(v.land) ?? null,
      property_taxable_value_amount: parseCurrencyToNumber(v.taxable) ?? 0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null
    };
    writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
  });
}

function sanitizeObject(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  });
  return obj;
}

function mergeDefined(base, overlay) {
  const result = { ...base };
  if (!overlay || typeof overlay !== "object") return result;
  Object.keys(overlay).forEach((key) => {
    const val = overlay[key];
    if (val !== undefined && val !== null) {
      result[key] = val;
    }
  });
  return result;
}

function valueOrNull(value) {
  if (value == null) return null;
  const trimmed = textTrim(String(value));
  return trimmed ? trimmed : null;
}

function formatBuildingRequestIdentifier(parcelId, kind, idx) {
  if (!parcelId) return null;
  const suffix = String(idx + 1).padStart(2, "0");
  return `${parcelId}_${kind}_${suffix}`;
}

function parseYesNo(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (["Y", "YES", "TRUE"].includes(upper)) return true;
  if (["N", "NO", "FALSE"].includes(upper)) return false;
  return null;
}

function parseIntegerOrNull(value) {
  if (value == null) return null;
  const trimmed = String(value).replace(/[,]/g, "").trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function pickBuildingValue(building, keys) {
  for (const key of keys) {
    if (key in building) {
      const val = valueOrNull(building[key]);
      if (val !== null) return val;
    }
  }
  return null;
}

function mapCoolingSystem(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("CENTRAL") || v.includes("DUCTED") || (!Number.isNaN(Number(v)) && Number(v) > 1)) {
    return "CentralAir";
  }
  if (v.includes("WINDOW")) return "WindowAirConditioner";
  if (v.includes("DUCTLESS") || v.includes("MINI SPLIT")) return "Ductless";
  if (v.includes("ELECTRIC") && !v.includes("CENTRAL")) return "Electric";
  if (v.includes("CEILING FAN")) return "CeilingFan";
  if (v.includes("WHOLE HOUSE FAN")) return "WholeHouseFan";
  if (v.includes("GEOTHERMAL")) return "GeothermalCooling";
  if (v.includes("HYBRID")) return "Hybrid";
  if (v.includes("ZONED")) return "Zoned";
  if (v.includes("NONE") || v === "") return null;
  return null;
}

function mapHeatingSystem(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("ELECTRIC FURNACE")) return "ElectricFurnace";
  if (v.includes("GAS FURNACE")) return "GasFurnace";
  if (v.includes("HEAT PUMP")) return "HeatPump";
  if (v.includes("AIR DUCTED") || v.includes("CENTRAL")) return "Central";
  if (v.includes("CONVECTION")) return "Electric";
  if (v.includes("DUCTLESS")) return "Ductless";
  if (v.includes("RADIANT")) return "Radiant";
  if (v.includes("SOLAR")) return "Solar";
  if (v.includes("BASEBOARD")) return "Baseboard";
  if (v.includes("ELECTRIC") && !v.includes("FURNACE")) return "Electric";
  if (v.includes("GAS") && !v.includes("FURNACE")) return "Gas";
  return null;
}

function mapHeatingFuel(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("ELECTRIC")) return "Electric";
  if (v.includes("NATURAL GAS") || v.includes("GAS")) return "NaturalGas";
  if (v.includes("PROPANE")) return "Propane";
  if (v.includes("OIL")) return "Oil";
  if (v.includes("KEROSENE")) return "Kerosene";
  if (v.includes("WOOD PELLET")) return "WoodPellet";
  if (v.includes("WOOD")) return "Wood";
  if (v.includes("GEOTHERMAL")) return "Geothermal";
  if (v.includes("SOLAR")) return "Solar";
  if (v.includes("DISTRICT STEAM")) return "DistrictSteam";
  return null;
}

function mapSewerType(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("SEPTIC")) return "Septic";
  if (v.includes("PUBLIC") || v.includes("MUNICIPAL")) return "Public";
  if (v.includes("SANITARY")) return "Sanitary";
  if (v.includes("COMBINED")) return "Combined";
  return null;
}

function mapWaterSource(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("WELL")) return "Well";
  if (v.includes("AQUIFER")) return "Aquifer";
  if (v.includes("PUBLIC") || v.includes("MUNICIPAL")) return "Public";
  return null;
}

function mapPlumbingSystem(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("COPPER")) return "Copper";
  if (v.includes("PEX")) return "PEX";
  if (v.includes("PVC")) return "PVC";
  if (v.includes("GALVANIZED")) return "GalvanizedSteel";
  if (v.includes("CAST IRON")) return "CastIron";
  return null;
}

function mapElectricalWiring(value) {
  if (value == null) return null;
  const v = String(value).toUpperCase();
  if (v.includes("COPPER")) return "Copper";
  if (v.includes("ALUMINUM")) return "Aluminum";
  if (v.includes("KNOB") && v.includes("TUBE")) return "KnobAndTube";
  if (v.includes("TYPICAL")) return "Copper";
  return null;
}

function mapFoundationType(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("SLAB")) return "Slab on Grade";
  if (upper.includes("CRAWL")) return "Crawl Space";
  if (upper.includes("WALKOUT")) return "Basement with Walkout";
  if (upper.includes("BASEMENT") && upper.includes("PART")) return "Partial Basement";
  if (upper.includes("BASEMENT")) return "Full Basement";
  if (upper.includes("STEM")) return "Stem Wall";
  if (upper.includes("PIER") || upper.includes("PILING") || upper.includes("PILE")) return "Pier and Beam";
  if (upper.includes("BEAM")) return "Pier and Beam";
  if (upper.includes("CONCRETE")) return "Slab on Grade";
  return null;
}

function mapFoundationMaterial(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("INSULATED") && upper.includes("CONCRETE")) return "Insulated Concrete Forms";
  if (upper.includes("PRECAST") && upper.includes("CONCRETE")) return "Precast Concrete";
  if (upper.includes("CONCRETE") && upper.includes("BLOCK")) return "Concrete Block";
  if (upper.includes("POURED") && upper.includes("CONCRETE")) return "Poured Concrete";
  if (upper.includes("CONCRETE")) return "Poured Concrete";
  if (upper.includes("MASONRY")) return "Masonry";
  if (upper.includes("STONE")) return "Stone";
  if (upper.includes("BRICK")) return "Brick";
  if (upper.includes("STEEL")) return "Steel Piers";
  if (upper.includes("WOOD")) return "Treated Wood Posts";
  return null;
}

function mapPrimaryFramingMaterial(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("ENGINEERED")) return "Engineered Lumber";
  if (upper.includes("POST") && upper.includes("BEAM")) return "Post and Beam";
  if (upper.includes("STEEL")) return "Steel Frame";
  if (upper.includes("CONCRETE") && upper.includes("BLOCK")) return "Concrete Block";
  if (upper.includes("CONCRETE")) return "Poured Concrete";
  if (upper.includes("MASONRY")) return "Masonry";
  if (upper.includes("LOG")) return "Log Construction";
  if (upper.includes("WOOD")) return "Wood Frame";
  return null;
}

function mapRoofDesignType(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  const matches = [];
  if (upper.includes("GABLE")) matches.push("Gable");
  if (upper.includes("HIP")) matches.push("Hip");
  if (upper.includes("FLAT")) matches.push("Flat");
  if (upper.includes("MANSARD")) matches.push("Mansard");
  if (upper.includes("GAMBREL")) matches.push("Gambrel");
  if (upper.includes("SHED")) matches.push("Shed");
  if (upper.includes("SALTBOX")) matches.push("Saltbox");
  if (upper.includes("BUTTERFLY")) matches.push("Butterfly");
  if (upper.includes("BONNET")) matches.push("Bonnet");
  if (upper.includes("CLERESTORY")) matches.push("Clerestory");
  if (upper.includes("DOME")) matches.push("Dome");
  if (upper.includes("BARREL")) matches.push("Barrel");
  if (matches.length > 1) return "Combination";
  return matches[0] || null;
}

function mapRoofCoveringMaterial(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("3") && upper.includes("TAB") && upper.includes("SH")) return "3-Tab Asphalt Shingle";
  if (upper.includes("ARCHITECTURAL") && upper.includes("SHING")) return "Architectural Asphalt Shingle";
  if (upper.includes("ASPHALT") || upper.includes("COMP")) return "Architectural Asphalt Shingle";
  if (upper.includes("STANDING") && upper.includes("SEAM")) return "Metal Standing Seam";
  if (upper.includes("GALV") || (upper.includes("METAL") && upper.includes("RIB"))) return "Metal Corrugated";
  if (upper.includes("CLAY") && upper.includes("TILE")) return "Clay Tile";
  if (upper.includes("CONCRETE") && upper.includes("TILE")) return "Concrete Tile";
  if (upper.includes("SLATE")) return "Natural Slate";
  if (upper.includes("SYNTHETIC") && upper.includes("SLATE")) return "Synthetic Slate";
  if (upper.includes("WOOD") && upper.includes("SHAKE")) return "Wood Shake";
  if (upper.includes("WOOD") && upper.includes("SHINGLE")) return "Wood Shingle";
  if (upper.includes("TPO")) return "TPO Membrane";
  if (upper.includes("EPDM")) return "EPDM Membrane";
  if (upper.includes("MODIFIED") && upper.includes("BITUMEN")) return "Modified Bitumen";
  if (upper.includes("BUILT") && upper.includes("UP")) return "Built-Up Roof";
  if (upper.includes("GREEN") && upper.includes("ROOF")) return "Green Roof System";
  if (upper.includes("SOLAR") && upper.includes("TILE")) return "Solar Integrated Tiles";
  return null;
}

function mapExteriorWallMaterial(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("BRICK")) return "Brick";
  if (upper.includes("MANUFACTURED") && upper.includes("STONE")) return "Manufactured Stone";
  if (upper.includes("STONE")) return "Natural Stone";
  if (upper.includes("STUCCO")) return "Stucco";
  if (upper.includes("VINYL")) return "Vinyl Siding";
  if (upper.includes("WOOD") || upper.includes("PLYWOOD") || upper.includes("T-111") || upper.includes("BOARD")) {
    return "Wood Siding";
  }
  if (upper.includes("FIBER") && upper.includes("CEMENT")) return "Fiber Cement Siding";
  if (upper.includes("METAL") || upper.includes("ALUMINUM")) return "Metal Siding";
  if (upper.includes("CONCRETE") && upper.includes("BLOCK")) return "Concrete Block";
  if (upper.includes("EIFS")) return "EIFS";
  if (upper.includes("LOG")) return "Log";
  if (upper.includes("ADOBE")) return "Adobe";
  if (upper.includes("PRECAST") && upper.includes("CONCRETE")) return "Precast Concrete";
  if (upper.includes("CURTAIN") && upper.includes("WALL")) return "Curtain Wall";
  return null;
}

function mapInteriorWallMaterial(value) {
  const v = valueOrNull(value);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("DRYWALL") || upper.includes("SHEETROCK")) return "Drywall";
  if (upper.includes("PLASTER")) return "Plaster";
  if (upper.includes("WOOD") && upper.includes("PANEL")) return "Wood Paneling";
  if (upper.includes("WOOD") && !upper.includes("PANEL")) return "Wood Paneling";
  if (upper.includes("BRICK")) return "Exposed Brick";
  if (upper.includes("BLOCK")) return "Exposed Block";
  if (upper.includes("WAINSCOT")) return "Wainscoting";
  if (upper.includes("SHIPLAP")) return "Shiplap";
  if (upper.includes("BOARD") && upper.includes("BATTEN")) return "Board and Batten";
  if (upper.includes("TILE")) return "Tile";
  if (upper.includes("STONE")) return "Stone Veneer";
  if (upper.includes("METAL")) return "Metal Panels";
  if (upper.includes("GLASS")) return "Glass Panels";
  if (upper.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapFlooringMaterialPrimary(material) {
  const v = valueOrNull(material);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("SOLID") && upper.includes("HARDWOOD")) return "Solid Hardwood";
  if (upper.includes("ENGINEERED") && upper.includes("HARDWOOD")) return "Engineered Hardwood";
  if (upper.includes("HARDWOOD")) return "Solid Hardwood";
  if (upper.includes("LAMINATE")) return "Laminate";
  if (upper.includes("LUXURY") && upper.includes("VINYL")) return "Luxury Vinyl Plank";
  if (upper.includes("VINYL") && upper.includes("PLANK")) return "Luxury Vinyl Plank";
  if (upper.includes("VINYL")) return "Sheet Vinyl";
  if (upper.includes("CERAMIC") && upper.includes("TILE")) return "Ceramic Tile";
  if (upper.includes("PORCELAIN") && upper.includes("TILE")) return "Porcelain Tile";
  if (upper.includes("STONE") && upper.includes("TILE")) return "Natural Stone Tile";
  if (upper.includes("CARPET")) return "Carpet";
  if (upper.includes("RUG")) return "Area Rugs";
  if (upper.includes("POLISHED") && upper.includes("CONCRETE")) return "Polished Concrete";
  if (upper.includes("BAMBOO")) return "Bamboo";
  if (upper.includes("CORK")) return "Cork";
  if (upper.includes("LINOLEUM")) return "Linoleum";
  if (upper.includes("TERRAZZO")) return "Terrazzo";
  if (upper.includes("EPOXY")) return "Epoxy Coating";
  return null;
}

function mapFlooringMaterialSecondary(material) {
  const v = valueOrNull(material);
  if (!v) return null;
  const upper = v.toUpperCase();
  if (upper.includes("SOLID") && upper.includes("HARDWOOD")) return "Solid Hardwood";
  if (upper.includes("ENGINEERED") && upper.includes("HARDWOOD")) return "Engineered Hardwood";
  if (upper.includes("LAMINATE")) return "Laminate";
  if (upper.includes("LUXURY") && upper.includes("VINYL")) return "Luxury Vinyl Plank";
  if (upper.includes("VINYL")) return null;
  if (upper.includes("CERAMIC") && upper.includes("TILE")) return "Ceramic Tile";
  if (upper.includes("CARPET")) return "Carpet";
  if (upper.includes("AREA") && upper.includes("RUG")) return "Area Rugs";
  if (upper.includes("TRANSITION")) return "Transition Strips";
  return null;
}

function createStructureTemplate(parcelId, requestIdentifier) {
  return {
    request_identifier: requestIdentifier ?? parcelId ?? null,
    source_http_request: buildSourceHttpRequest(parcelId),
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
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
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
}

function writeUtilities(parcelId, buildings) {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^utility(_\d+)?\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  const key = `property_${parcelId}`;
  let entries = [];
  if (utils) {
    const record = utils[key];
    if (Array.isArray(record)) entries = record;
    else if (record && Array.isArray(record.utilities)) entries = record.utilities;
    else if (record && typeof record === "object") entries = [record];
  }
  const buildingCount = buildings ? buildings.length : 0;
  if (entries.length === 1 && buildingCount > 1) {
    const template = entries[0];
    entries = Array.from({ length: buildingCount }, () => ({ ...template }));
  }
  const derivedUtilities = (buildings || []).map((building, idx) =>
    buildUtilityFromBuilding(building, parcelId, idx),
  );
  const sourceEntries = entries.length ? entries : derivedUtilities;
  const mergedEntries = sourceEntries.map((raw, idx) => {
    const derived = derivedUtilities[idx] || {};
    const utility = mergeDefined(derived, raw);
    utility.request_identifier =
      utility.request_identifier || formatBuildingRequestIdentifier(parcelId, "utility", idx);
    utility.source_http_request = buildSourceHttpRequest(parcelId);
    sanitizeObject(utility);
    const fileName = `utility_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), utility);
    return { index: idx, fileName, ref: `./${fileName}` };
  });
  if (derivedUtilities.length > mergedEntries.length) {
    derivedUtilities.slice(mergedEntries.length).forEach((utility, idx) => {
      const index = mergedEntries.length + idx;
      const finalUtility = { ...utility };
      finalUtility.request_identifier =
        finalUtility.request_identifier ||
        formatBuildingRequestIdentifier(parcelId, "utility", index);
      finalUtility.source_http_request = buildSourceHttpRequest(parcelId);
      sanitizeObject(finalUtility);
      const fileName = `utility_${index + 1}.json`;
      writeJSON(path.join("data", fileName), finalUtility);
      mergedEntries.push({ index, fileName, ref: `./${fileName}` });
    });
  }
  return mergedEntries;
}

function buildStructureFromBuilding(building, parcelId, idx) {
  const requestIdentifier = formatBuildingRequestIdentifier(parcelId, "structure", idx);
  const finishedArea = toInt(building["Finished Area"]);
  const totalArea = toInt(building["Total Area"]);
  const structure = createStructureTemplate(parcelId, requestIdentifier);

  const foundationRaw = pickBuildingValue(building, ["Foundation"]);
  structure.foundation_type = mapFoundationType(foundationRaw);
  structure.foundation_material = mapFoundationMaterial(foundationRaw);
  structure.primary_framing_material = mapPrimaryFramingMaterial(building["Frame"]);
  structure.roof_design_type = mapRoofDesignType(building["Roof Structure"]);
  structure.roof_covering_material = mapRoofCoveringMaterial(building["Roof Material"]);
  structure.exterior_wall_material_primary = mapExteriorWallMaterial(
    building["Primary Exterior Wall"],
  );
  structure.exterior_wall_material_secondary = mapExteriorWallMaterial(
    building["Second Exterior Wall"],
  );
  structure.interior_wall_surface_material_primary = mapInteriorWallMaterial(
    building["Primary Interior Wall"],
  );
  structure.interior_wall_surface_material_secondary = mapInteriorWallMaterial(
    building["Second Interior Wall"],
  );
  structure.flooring_material_primary = mapFlooringMaterialPrimary(
    building["Primary Floor Cover"],
  );
  structure.flooring_material_secondary = mapFlooringMaterialSecondary(
    building["Second Floor Cover"],
  );
  structure.number_of_stories = parseIntegerOrNull(building["Story Height"]);
  structure.finished_base_area = finishedArea || null;
  structure.unfinished_base_area =
    totalArea && finishedArea != null ? Math.max(totalArea - finishedArea, 0) : null;

  return structure;
}

function writeStructures(parcelId, buildings) {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^structure(_\d+)?\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
  const structuresData = readJSON(path.join("owners", "structure_data.json"));
  const key = `property_${parcelId}`;
  let entries = [];
  if (structuresData) {
    const record = structuresData[key];
    if (Array.isArray(record)) entries = record;
    else if (record && Array.isArray(record.structures)) entries = record.structures;
    else if (record && typeof record === "object") entries = [record];
  }
  const buildingCount = buildings ? buildings.length : 0;
  if (entries.length === 1 && buildingCount > 1) {
    const template = entries[0];
    entries = Array.from({ length: buildingCount }, () => ({ ...template }));
  }
  if (!entries.length && buildings && buildings.length) {
    entries = buildings.map((building, idx) =>
      buildStructureFromBuilding(building, parcelId, idx),
    );
  }
  const derivedStructures = (buildings || []).map((building, idx) =>
    buildStructureFromBuilding(building, parcelId, idx),
  );
  const sourceEntries = entries.length ? entries : derivedStructures;
  const mergedEntries = sourceEntries.map((raw, idx) => {
    const derived = derivedStructures[idx] || {};
    const structure = mergeDefined(derived, raw);
    structure.request_identifier =
      structure.request_identifier || formatBuildingRequestIdentifier(parcelId, "structure", idx);
    structure.source_http_request = buildSourceHttpRequest(parcelId);
    sanitizeObject(structure);
    const fileName = `structure_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), structure);
    return { index: idx, fileName, ref: `./${fileName}` };
  });
  if (derivedStructures.length > mergedEntries.length) {
    derivedStructures.slice(mergedEntries.length).forEach((structure, idx) => {
      const index = mergedEntries.length + idx;
      const finalStructure = { ...structure };
      finalStructure.request_identifier =
        finalStructure.request_identifier ||
        formatBuildingRequestIdentifier(parcelId, "structure", index);
      finalStructure.source_http_request = buildSourceHttpRequest(parcelId);
      sanitizeObject(finalStructure);
      const fileName = `structure_${index + 1}.json`;
      writeJSON(path.join("data", fileName), finalStructure);
      mergedEntries.push({ index, fileName, ref: `./${fileName}` });
    });
  }
  return mergedEntries;
}

function buildUtilityFromBuilding(building, parcelId, idx) {
  const requestIdentifier = formatBuildingRequestIdentifier(parcelId, "utility", idx);
  const coolingCandidate = pickBuildingValue(building, [
    "Cooling Type",
    "Cooling",
    "Air Conditioning",
    "AC Type",
    "Percent Air Conditioned",
    "% Air Conditioned",
  ]);
  const heatingTypeValue = pickBuildingValue(building, ["Heat Type", "Heating Type"]);
  const heatingFuelValue = pickBuildingValue(building, ["Heat Fuel", "Heating Fuel"]);
  const sewerValue = pickBuildingValue(building, ["Sewer", "Sewer Type", "Sewer System"]);
  const waterValue = pickBuildingValue(building, ["Water", "Water Type", "Water Source"]);
  const plumbingValue = pickBuildingValue(building, ["Plumbing", "Interior Plumbing"]);
  const electricalValue = pickBuildingValue(building, [
    "Electric",
    "Electrical",
    "Electrical Type",
    "Electrical Service",
  ]);
  const percentAirConditioned = parseIntegerOrNull(
    pickBuildingValue(building, ["Percent Air Conditioned", "% Air Conditioned"]),
  );
  let coolingSystemType = mapCoolingSystem(coolingCandidate);
  if (!coolingSystemType && percentAirConditioned != null && percentAirConditioned > 0) {
    coolingSystemType = "CentralAir";
  }
  const heatingSystemType = mapHeatingSystem(heatingTypeValue);
  const heatingFuelType = mapHeatingFuel(heatingFuelValue);
  const hvacCondensingUnitPresent =
    percentAirConditioned != null ? (percentAirConditioned > 0 ? "Yes" : "No") : null;
  const solarHotWater = pickBuildingValue(building, [
    "Solar Hot Water",
    "Solar",
    "Solar Panels",
  ]);
  const solarPanelPresent = parseYesNo(solarHotWater);

  const utility = {
    request_identifier: requestIdentifier,
    source_http_request: buildSourceHttpRequest(parcelId),
    cooling_system_type: coolingSystemType,
    heating_system_type: heatingSystemType,
    heating_fuel_type: heatingFuelType,
    public_utility_type: null,
    sewer_type: mapSewerType(sewerValue),
    water_source_type: mapWaterSource(waterValue),
    plumbing_system_type: mapPlumbingSystem(plumbingValue),
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: mapElectricalWiring(electricalValue),
    hvac_condensing_unit_present: hvacCondensingUnitPresent,
    electrical_wiring_type_other_description: null,
    solar_panel_present: solarPanelPresent,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    hvac_unit_condition: null,
    solar_inverter_visible: solarPanelPresent === true,
    hvac_unit_issues: null,
  };
  sanitizeObject(utility);
  return utility;
}

function assignEntitiesToLayouts(buildingLayouts, entities, assignedSet) {
  if (!entities.length) return;
  if (!buildingLayouts.length) return;
  if (entities.length === 1 && buildingLayouts.length > 1) {
    writeHasRelationship("./property.json", entities[0].ref);
    assignedSet.add(entities[0].index);
    return;
  }
  const minCount = Math.min(entities.length, buildingLayouts.length);
  for (let i = 0; i < minCount; i += 1) {
    writeHasRelationship(buildingLayouts[i].ref, entities[i].ref);
    assignedSet.add(entities[i].index);
  }
  if (entities.length > buildingLayouts.length) {
    for (let i = buildingLayouts.length; i < entities.length; i += 1) {
      writeHasRelationship("./property.json", entities[i].ref);
      assignedSet.add(entities[i].index);
    }
  }
}

function writeLayouts($, parcelId, propertyType, buildings, utilities, structures) {
  const ensureLayoutDefaults = (layout) => {
    if (!("space_type" in layout) || layout.space_type == null) {
      layout.space_type = "Living Area";
    }
    const requiredKeys = [
      "flooring_material_type",
      "has_windows",
      "window_design_type",
      "window_material_type",
      "window_treatment_type",
      "is_finished",
      "furnished",
      "paint_condition",
      "flooring_wear",
      "clutter_level",
      "visible_damage",
      "countertop_material",
      "cabinet_style",
      "fixture_finish_quality",
      "design_style",
      "natural_light_quality",
      "decor_elements",
      "pool_type",
      "pool_equipment",
      "spa_type",
      "safety_features",
      "view_type",
      "lighting_features",
      "condition_issues",
      "pool_condition",
      "pool_surface_type",
      "pool_water_quality",
    ];
    requiredKeys.forEach((key) => {
      if (!(key in layout) || layout[key] === undefined) layout[key] = null;
    });
    if (!("is_finished" in layout) || layout.is_finished === null) {
      layout.is_finished = false;
    }
    if (!("is_exterior" in layout) || layout.is_exterior === null) {
      layout.is_exterior = false;
    }
    if (!("has_windows" in layout) || layout.has_windows === null) {
      layout.has_windows = false;
    }
  };
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^layout_\d+\.json$/.test(f) || /^relationship_layout_.*_has_.*\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
  if (propertyType === "LandParcel" || !buildings.length) {
    return {
      buildingLayouts: [],
      assignedUtilityIndices: new Set(),
      assignedStructureIndices: new Set(),
    };
  }

  const buildingLayouts = [];
  let layoutCounter = 0;
  const roomMappings = [
    { key: "Full Bath", spaceType: "Full Bathroom", isFinished: true, isExterior: false },
    { key: "Addl Bath", spaceType: "Full Bathroom", isFinished: true, isExterior: false },
    { key: "Three Qtr Bath", spaceType: "Three-Quarter Bathroom", isFinished: true, isExterior: false },
    { key: "Addl Three Qtr Bath", spaceType: "Three-Quarter Bathroom", isFinished: true, isExterior: false },
    { key: "Half Bath", spaceType: "Half Bathroom / Powder Room", isFinished: true, isExterior: false },
    { key: "Addl Half Bath", spaceType: "Half Bathroom / Powder Room", isFinished: true, isExterior: false },
    { key: "Other Fixtures", spaceType: "Utility Closet", isFinished: false, isExterior: false },
    { key: "# Basement Garages", spaceType: "Lower Garage", isFinished: false, isExterior: false },
  ];
  buildings.forEach((building, idx) => {
    layoutCounter += 1;
    const totalArea = toInt(building["Total Area"]);
    const finishedArea = toInt(building["Finished Area"]);
    const buildingLayout = {
      space_type: "Building",
      building_number: idx + 1,
      space_type_index: `${idx + 1}`,
      request_identifier: `${parcelId}_layout_building_${idx + 1}`,
      source_http_request: buildSourceHttpRequest(parcelId),
    };
    if (totalArea) {
      buildingLayout.size_square_feet = totalArea;
      buildingLayout.total_area_sq_ft = totalArea;
    }
    if (finishedArea) {
      buildingLayout.livable_area_sq_ft = finishedArea;
      buildingLayout.area_under_air_sq_ft = finishedArea;
    }
    ensureLayoutDefaults(buildingLayout);
    const layoutFileName = `layout_${layoutCounter}.json`;
    writeJSON(path.join("data", layoutFileName), buildingLayout);
    const layoutRef = `./${layoutFileName}`;
    writeHasRelationship("./property.json", layoutRef);
    const buildingRecord = {
      index: idx,
      ref: layoutRef,
      childCounter: 1,
    };
    buildingLayouts.push(buildingRecord);

    roomMappings.forEach((mapping) => {
      const count = toInt(building[mapping.key]);
      if (!count || count <= 0) return;
      for (let c = 0; c < count; c += 1) {
        layoutCounter += 1;
        const childIndex = `${idx + 1}.${buildingRecord.childCounter}`;
        buildingRecord.childCounter += 1;
        const childLayout = {
          space_type: mapping.spaceType,
          space_type_index: childIndex,
          request_identifier: `${parcelId}_layout_${mapping.spaceType.replace(/[^A-Za-z0-9]+/g, "_").toLowerCase()}_${idx + 1}_${c + 1}`,
          source_http_request: buildSourceHttpRequest(parcelId),
          is_finished: mapping.isFinished,
          is_exterior: mapping.isExterior,
          has_windows: false,
        };
        if (mapping.defaultSizeKey) {
          const sourceValue = parseFloat(mapping.defaultSizeKey(building));
          if (!Number.isNaN(sourceValue) && sourceValue > 0) {
            childLayout.size_square_feet = sourceValue;
          }
        }
        if (!childLayout.size_square_feet) {
          childLayout.size_square_feet = 0;
        }
        ensureLayoutDefaults(childLayout);
        const childFileName = `layout_${layoutCounter}.json`;
        const childRef = `./${childFileName}`;
        writeJSON(path.join("data", childFileName), childLayout);
        writeHasRelationship(layoutRef, childRef);
      }
    });
  });

  const assignedUtilityIndices = new Set();
  const assignedStructureIndices = new Set();
  assignEntitiesToLayouts(buildingLayouts, utilities, assignedUtilityIndices);
  assignEntitiesToLayouts(buildingLayouts, structures, assignedStructureIndices);

  return {
    buildingLayouts,
    assignedUtilityIndices,
    assignedStructureIndices,
  };
}

function extractSecTwpRng($) {
  let value = null;
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th"));
    if ((th || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($(tr).find("td span"));
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}


function normalizeNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function writeGeometryFromUnnormalized(unnorm, parcelId) {
  const latitude = normalizeNumeric(unnorm && unnorm.latitude);
  const longitude = normalizeNumeric(unnorm && unnorm.longitude);
  const geometry = {
    latitude,
    longitude,
    source_http_request: buildSourceHttpRequest(parcelId),
    request_identifier: parcelId || null,
  };
  writeJSON(path.join("data", "geometry.json"), geometry);
}

function attemptWriteAddress(unnorm, secTwpRng, parcelId) {
  const full =
    (unnorm && (unnorm.full_address || unnorm.address || unnorm.mail_address)) ||
    null;
  if (!full) return;

  const county_name = unnorm && unnorm.county_jurisdiction
    ? unnorm.county_jurisdiction.trim() || null
    : null;

  const address = {
    unnormalized_address: full.trim(),
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    county_name,
    country_code: "US",
    source_http_request: buildSourceHttpRequest(parcelId),
    request_identifier: parcelId || null,
  };
  writeJSON(path.join("data", "address.json"), address);
  writeGeometryFromUnnormalized(unnorm, parcelId);
}

function main() {
  ensureDir("data");
  const $ = loadHTML();
  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }
  // const propertySeed = readJSON("property_seed.json");

  

  let propertyMeta = null;
  if (parcelId) propertyMeta = writeProperty($, parcelId);

  const salesRecords = writeSalesHistoryArtifacts($, parcelId);

  writeTaxes($, parcelId);

  const buildings = collectBuildings($);
  const utilities = parcelId ? writeUtilities(parcelId, buildings) : [];
  const structures = parcelId ? writeStructures(parcelId, buildings) : [];
  const layoutInfo = parcelId
    ? writeLayouts(
        $,
        parcelId,
        propertyMeta ? propertyMeta.property_type : null,
        buildings,
        utilities,
        structures,
      )
    : { buildingLayouts: [], assignedUtilityIndices: new Set(), assignedStructureIndices: new Set() };

  if (parcelId) {
    writePersonCompaniesSalesRelationships($, parcelId, salesRecords);
  }

  const assignedUtilityIndices = layoutInfo.assignedUtilityIndices || new Set();
  utilities.forEach((utility) => {
    if (!assignedUtilityIndices.has(utility.index)) {
      writeHasRelationship("./property.json", utility.ref);
    }
  });

  const assignedStructureIndices = layoutInfo.assignedStructureIndices || new Set();
  structures.forEach((structure) => {
    if (!assignedStructureIndices.has(structure.index)) {
      writeHasRelationship("./property.json", structure.ref);
    }
  });

  // Address last
  const secTwpRng = extractSecTwpRng($);
  attemptWriteAddress(unnormalized, secTwpRng, parcelId);

  // Create relationships only if target files exist
  const dataDir = "data";
  const addressExists = fs.existsSync(path.join(dataDir, "address.json"));
  const geometryExists = fs.existsSync(path.join(dataDir, "geometry.json"));

  if (addressExists) {
    writeHasRelationship("./property.json", "./address.json");
  }

  if (addressExists && geometryExists) {
    writeHasRelationship("./address.json", "./geometry.json");
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      writeJSON(path.join("data", "error.json"), e);
      console.error("Extraction error:", e);
      process.exit(1);
    } else {
      console.error("Unexpected error:", e);
      process.exit(1);
    }
  }
}
