/*
  Data extraction script per evaluator spec.
  - Reads: input.html, unnormalized_address.json, property_seed.json
  - Owners from owners/owner_data.json
  - Utilities from owners/utilities_data.json
  - Layout from owners/layout_data.json
  - All other data from input.html
  - Outputs JSON files to ./data

  Notes:
  - No schema validation, but adhere to schemas as much as possible.
  - Enums: If mapped value unknown, throw error in specified JSON format.
*/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const DATA_DIR = path.join(".", "data");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJSON(filePath) {
  return JSON.parse(readFile(filePath));
}

function writeJSON(filename, obj) {
  ensureDir(DATA_DIR);
  const full = path.join(DATA_DIR, filename);
  fs.writeFileSync(full, JSON.stringify(obj, null, 2), "utf8");
}

function writeRelationshipFile(fromFile, toFile, explicitName) {
  ensureDir(DATA_DIR);
  const fromBase = path.basename(fromFile, ".json");
  const toBase = path.basename(toFile, ".json");
  const relFile =
    explicitName || `relationship_${fromBase}_has_${toBase}.json`;
  writeJSON(relFile, {
    from: { "/": `./${fromFile}` },
    to: { "/": `./${toFile}` },
  });
}

function purgeDataFiles(patterns) {
  if (!fs.existsSync(DATA_DIR)) return;
  const entries = fs.readdirSync(DATA_DIR);
  for (const entry of entries) {
    if (patterns.some((regex) => regex.test(entry))) {
      const full = path.join(DATA_DIR, entry);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
  }
}

function throwEnumError(value, className, propName) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: `${className}.${propName}`,
  };
  throw new Error(JSON.stringify(err));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const clean = String(txt).replace(/[$,\s]/g, "");
  if (clean === "") return null;
  const n = Number(clean);
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * @typedef {Object} SalesRow
 * @property {string} monthYear Raw month/year string as shown in the sales table (e.g., "2/2023").
 * @property {string | null} deedUrl Absolute URL for the deed document when present; otherwise null.
 * @property {string} deedTypeTxt Normalized deed type string taken from the sales table.
 * @property {string | null} bookPageTxt Visible book/page text shown inside the deed hyperlink (e.g., "9038 / 0245").
 * @property {number | null} amount Parsed currency amount for the sale; null when extraction fails.
 */

/**
 * Parse a month/year cell value (e.g., "2/2023") into an ISO-8601 calendar date string.
 * When parsing succeeds the date represents the first day of the month in UTC (YYYY-MM-01).
 *
 * @param {string | null | undefined} value Raw text extracted from the PASCO sales table month/year column.
 * @returns {string | null} ISO date string on success; null when parsing fails validation.
 */
function parseMonthYearToIsoDate(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (candidate === "") return null;
  const match = candidate.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 1000) return null;
  const isoMonth = String(month).padStart(2, "0");
  return `${year}-${isoMonth}-01`;
}

function parseBookAndPage(text) {
  if (typeof text !== "string") {
    return { book: null, page: null };
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized === "") {
    return { book: null, page: null };
  }
  const parts = normalized.split("/");
  if (parts.length < 2) {
    return { book: null, page: null };
  }
  const book = parts[0].trim() || null;
  const page = parts[1].trim() || null;
  return { book, page };
}

function extractInstrumentNumber(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/[?&]instrument=([^&#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function textOrNull(el) {
  if (!el || el.length === 0) return null;
  const t = el.text().trim();
  return t === "" ? null : t;
}

function normalizeSpace(s) {
  return s ? s.replace(/\s+/g, " ").trim() : s;
}

function parsePhysicalAddress(addrRaw) {
  if (!addrRaw) return null;
  let a = addrRaw.replace(/\u00A0/g, " "); // nbsp
  a = a
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  // Expect format: "3310 WINDFIELD DRIVE, HOLIDAY, FL 34691"
  const parts = a
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const streetPart = parts[0];
  const city = parts[1].toUpperCase();
  const stateZip = parts[2].split(/\s+/);
  const state = stateZip[0].toUpperCase();
  const zip = (stateZip[1] || "").replace(/[^0-9]/g, "");

  const streetTokens = streetPart.split(/\s+/);
  const streetNumber = streetTokens.shift();
  const suffixWord =
    streetTokens.length > 0
      ? streetTokens[streetTokens.length - 1].toUpperCase()
      : null;
  let nameTokens = streetTokens.slice(0, -1);

  // If we cannot detect suffix word (e.g., unnormalized has no suffix), try to keep name intact
  let suffix = null;
  const suffixMap = {
    ST: "St",
    STREET: "St",
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    RD: "Rd",
    ROAD: "Rd",
    LN: "Ln",
    LANE: "Ln",
    DR: "Dr",
    DRIVE: "Dr",
    CT: "Ct",
    COURT: "Ct",
    PL: "Pl",
    PLACE: "Pl",
    TER: "Ter",
    TERRACE: "Ter",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    PKWY: "Pkwy",
    PARKWAY: "Pkwy",
    CIR: "Cir",
    CIRCLE: "Cir",
    WAY: "Way",
    LOOP: "Loop",
  };
  if (suffixWord && suffixMap[suffixWord]) {
    suffix = suffixMap[suffixWord];
  } else {
    // No recognizable suffix; all tokens are name
    nameTokens = streetTokens;
  }

  const streetName =
    nameTokens && nameTokens.length > 0 ? nameTokens.join(" ") : null;

  return {
    street_number: streetNumber || null,
    street_name: streetName || null,
    street_suffix_type: suffix || null,
    city_name: city || null,
    state_code: state || null,
    postal_code: zip || null,
  };
}

/**
 * @typedef {"LandParcel"|"Building"|"Unit"|"ManufacturedHome"} PropertyTypeEnum
 */

/**
 * @typedef {"Residential"|"Commercial"|"Industrial"|"Agricultural"|"Recreational"|"Conservation"|"Retirement"|"ResidentialCommonElementsAreas"|"DrylandCropland"|"HayMeadow"|"CroplandClass2"|"CroplandClass3"|"TimberLand"|"GrazingLand"|"OrchardGroves"|"Poultry"|"Ornamentals"|"Church"|"PrivateSchool"|"PrivateHospital"|"HomesForAged"|"NonProfitCharity"|"MortuaryCemetery"|"ClubsLodges"|"SanitariumConvalescentHome"|"CulturalOrganization"|"Military"|"ForestParkRecreation"|"PublicSchool"|"PublicHospital"|"GovernmentProperty"|"RetailStore"|"DepartmentStore"|"Supermarket"|"ShoppingCenterRegional"|"ShoppingCenterCommunity"|"OfficeBuilding"|"MedicalOffice"|"TransportationTerminal"|"Restaurant"|"FinancialInstitution"|"ServiceStation"|"AutoSalesRepair"|"MobileHomePark"|"WholesaleOutlet"|"NurseryGreenhouse"|"AgriculturalPackingFacility"|"LivestockFacility"|"Aquaculture"|"Theater"|"Entertainment"|"Hotel"|"RaceTrack"|"GolfCourse"|"LightManufacturing"|"HeavyManufacturing"|"LumberYard"|"PackingPlant"|"Cannery"|"MineralProcessing"|"Warehouse"|"OpenStorage"|"Utility"|"RiversLakes"|"SewageDisposal"|"Railroad"|"TransitionalProperty"|"ReferenceParcel"|"VineyardWinery"|"DataCenter"|"TelecommunicationsFacility"|"SolarFarm"|"WindFarm"|"NativePasture"|"ImprovedPasture"|"Rangeland"|"PastureWithTimber"|"Unknown"} PropertyUsageTypeEnum
 */

/**
 * @typedef {"Condominium"|"Cooperative"|"LifeEstate"|"Timeshare"|"OtherEstate"|"FeeSimple"|"Leasehold"|"RightOfWay"|"NonWarrantableCondo"|"SubsurfaceRights"|null} OwnershipEstateTypeEnum
 */

/**
 * @typedef {"SingleFamilyDetached"|"SingleFamilySemiDetached"|"TownhouseRowhouse"|"Duplex"|"Triplex"|"Quadplex"|"MultiFamily5Plus"|"ApartmentUnit"|"Loft"|"ManufacturedHomeOnLand"|"ManufacturedHomeInPark"|"MultiFamilyMoreThan10"|"MultiFamilyLessThan10"|"MobileHome"|"ManufacturedHousingMultiWide"|"ManufacturedHousing"|"ManufacturedHousingSingleWide"|"Modular"|null} StructureFormEnum
 */

/**
 * @typedef {"VacantLand"|"Improved"|"UnderConstruction"|null} BuildStatusEnum
 */

/**
 * @typedef {Object} PropertyLexiconMapping
 * @property {PropertyTypeEnum|null} property_type
 * @property {PropertyUsageTypeEnum|null} property_usage_type
 * @property {OwnershipEstateTypeEnum} ownership_estate_type
 * @property {StructureFormEnum} structure_form
 * @property {BuildStatusEnum} build_status
 */

/**
 * Normalizes a classification label or code into a lookup key.
 * @param {string} value
 * @returns {string}
 */
function normalizeClassificationKey(value) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") return "";
  return trimmed.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Registers one or more lookup keys to the supplied lexicon mapping.
 * @param {string|null} code
 * @param {string[]} labels
 * @param {PropertyLexiconMapping} mapping
 */
function registerPropertyTypeMapping(code, labels, mapping) {
  /** @type {Set<string>} */
  const candidateKeys = new Set();
  if (code) {
    const digits = code.replace(/\D/g, "");
    if (digits) {
      const trimmed = digits.replace(/^0+/, "") || "0";
      const baseTwo = trimmed.length >= 2 ? trimmed.slice(-2) : trimmed.padStart(2, "0");
      candidateKeys.add(baseTwo);
      candidateKeys.add(trimmed);
      candidateKeys.add(digits);
      candidateKeys.add(digits.padStart(5, "0"));
    }
  }
  labels.forEach((label) => {
    if (!label) return;
    candidateKeys.add(label);
    candidateKeys.add(label.replace(/^\s*\d+\s*/, ""));
  });
  candidateKeys.forEach((rawKey) => {
    const normalized = normalizeClassificationKey(rawKey);
    if (normalized) {
      PROPERTY_TYPE_MAPPINGS.set(normalized, mapping);
    }
  });
}

/** @type {Map<string, PropertyLexiconMapping>} */
const PROPERTY_TYPE_MAPPINGS = new Map();

registerPropertyTypeMapping(
  "00",
  ["00 Vacant Residential", "Vacant Residential", "00000-Vacant Residential"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "01",
  ["01 Single Family", "Single Family", "00100-Single Family"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "02",
  ["02 Mobile Homes", "Mobile Homes", "00200-Mobile Home"],
  Object.freeze({
    property_type: "MobileHome",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: "MobileHome",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "03",
  [
    "03 Multi-Family -10 units or more",
    "Multi-Family -10 units or more",
    "00300-Multifamily",
    "Multi Family More Than 10 Units",
    "Multifamily More Than 10 Units",
  ],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyMoreThan10",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "04",
  ["04 Condominium", "Condominium"],
  Object.freeze({
    property_type: "Unit",
    property_usage_type: "Residential",
    ownership_estate_type: "Condominium",
    structure_form: "ApartmentUnit",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "05",
  ["05 Cooperatives", "Cooperatives", "Cooperative"],
  Object.freeze({
    property_type: "Unit",
    property_usage_type: "Residential",
    ownership_estate_type: "Cooperative",
    structure_form: "ApartmentUnit",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "06",
  ["06 Retirement Homes not eligible for exemption", "Retirement Homes not eligible for exemption", "Retirement Homes"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Retirement",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamily5Plus",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "07",
  ["07 Miscellaneous Residential(migrant-boarding homes)fna Villa Homes", "Miscellaneous Residential", "Villa Homes"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamily5Plus",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "08",
  ["08 Multi-Family -fewer than 10 units", "Multi-Family fewer than 10 units", "Multi-Family <10 Units"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Residential",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyLessThan10",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "09",
  ["09 Residential Common Elements/Areas", "Residential Common Elements", "Residential Common Areas"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "ResidentialCommonElementsAreas",
    ownership_estate_type: "Condominium",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "10",
  ["10 Vacant Commercial", "Vacant Commercial"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Commercial",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "11",
  ["11 Retail Stores, One Story", "Retail Stores One Story", "Retail Store"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "RetailStore",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "12",
  ["12 Stores, Office, SFR -mixed use", "Stores Office SFR mixed use", "Mixed Use"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "RetailStore",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "13",
  ["13 Department Stores", "Department Stores"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "14",
  ["14 Supermarkets", "Supermarkets"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Supermarket",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "15",
  ["15 Shopping Centers Regional", "Shopping Centers Regional", "Regional Shopping Center"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "16",
  ["16 Shopping Centers Community", "Shopping Centers Community", "Community Shopping Center"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "17",
  ["17 1 Story Office", "1 Story Office"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "18",
  ["18 Multi-Story Office", "Multi-Story Office"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "19",
  ["19 Professional Service Buildings", "Professional Service Buildings"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "20",
  ["20 Airports, bus terminals, piers marinas", "Airports bus terminals piers marinas"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "21",
  ["21 Restaurants, cafeterias", "Restaurants cafeterias", "Restaurant"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Restaurant",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "22",
  ["22 Drive-In Restaurants", "Drive-In Restaurants"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Restaurant",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "23",
  [
    "23 Financial Institutions (banks,saving & loan,mortgage,credit co)",
    "Financial Institutions",
    "Banks Savings Loan Mortgage Credit",
  ],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "24",
  ["24 Insurance Company Offices", "Insurance Company Offices"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "25",
  ["25 Service Shops Non-Automotive", "Service Shops Non-Automotive"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "RetailStore",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "26",
  ["26 Service Stations", "Service Stations"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "ServiceStation",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "27",
  ["27 Auto Sales, Service, etc.", "Auto Sales Service"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "28",
  ["28 Rental MH/RV Parks, parking lots (commercial or patron)", "Rental MH RV Parks", "Mobile Home Parks"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "MobileHomePark",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "29",
  ["29 Wholesale manufacturing outlets, produce houses", "Wholesale manufacturing outlets", "Produce Houses"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "30",
  ["30 Florist, Greenhouses", "Florist Greenhouses", "Florist and Greenhouses"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "NurseryGreenhouse",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "31",
  ["31 Theaters Drive-In, open stadiums", "Theaters Drive-In", "Open Stadiums"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Theater",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "32",
  ["32 Theaters auditoriums enclosed", "Theaters auditoriums enclosed", "Enclosed Theaters"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Theater",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "33",
  ["33 Night Clubs, Bars, lounges", "Night Clubs Bars Lounges"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "34",
  ["34 Bowling Alleys, skating rinks, pool halls, enclosed arenas", "Bowling Alleys", "Skating Rinks", "Enclosed Arenas"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "35",
  ["35 Tourist Attractions, fairgrounds (privately owned)", "Tourist Attractions", "Fairgrounds"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Entertainment",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "36",
  ["36 Camps", "Camps"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "37",
  ["37 Race Tracks", "Race Tracks"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "RaceTrack",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "38",
  ["38 Golf Courses, driving ranges", "Golf Courses", "Driving Ranges"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "39",
  ["39 Hotels, Motels", "Hotels", "Motels"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Hotel",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "40",
  ["40 Vacant Industrial", "Vacant Industrial"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Industrial",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "41",
  ["41 Light Manufacturing", "Light Manufacturing"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "42",
  ["42 Heavy Industrial", "Heavy Industrial"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "43",
  ["43 Lumber Yards, sawmills", "Lumber Yards", "Sawmills"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "LumberYard",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "44",
  ["44 Packing Plants", "Packing Plants"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PackingPlant",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "45",
  ["45 Breweries, Wineries, distilleries, canneries", "Breweries", "Wineries", "Distilleries", "Canneries"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "VineyardWinery",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "46",
  ["46 Food Processing", "Food Processing"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Cannery",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "47",
  ["47 Mineral Processing", "Mineral Processing"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "48",
  ["48 Warehousing (Block or Metal)", "Warehousing", "Warehouse"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Warehouse",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "49",
  ["49 Open Storage, junk yards, fuel storage", "Open Storage", "Junk Yards", "Fuel Storage"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "50",
  ["50 Improved agricultural rural homesite", "Improved agricultural rural homesite"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Agricultural",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "51",
  ["51 Cropland Class I", "Cropland Class I"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "DrylandCropland",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "52",
  ["52 Cropland Class II", "Cropland Class II"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "CroplandClass2",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "53",
  ["53 Cropland Class III", "Cropland Class III"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "CroplandClass3",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "54",
  ["54 Timber - Site Index I", "Timber Site Index I"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "55",
  ["55 Timber - Site Index II", "Timber Site Index II"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "56",
  ["56 Timber - Site Index III", "Timber Site Index III"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "57",
  ["57 Timber - Site Index IV", "Timber Site Index IV"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "58",
  ["58 Timber - Site Index V", "Timber Site Index V"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "59",
  ["59 Timber - Not Classified by site index to Pines", "Timber Not Classified", "Timberland"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "60",
  ["60 Grazing Land Class I", "Grazing Land Class I"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "ImprovedPasture",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "61",
  ["61 Grazing Land Class II", "Grazing Land Class II"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "ImprovedPasture",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "62",
  ["62 Grazing Land Class III", "Grazing Land Class III"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "NativePasture",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "63",
  ["63 Grazing Land Class IV", "Grazing Land Class IV"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "NativePasture",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "64",
  ["64 Grazing Land Class V", "Grazing Land Class V"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Rangeland",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "65",
  ["65 Grazing Land Class VI", "Grazing Land Class VI"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Rangeland",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "66",
  ["66 Orchard Groves", "Orchard Groves"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "67",
  ["67 Poultry, Bees, etc.", "Poultry Bees"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Poultry",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "68",
  ["68 Dairies, Feed Lots", "Dairies Feed Lots"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "69",
  ["69 Ornamentals", "Ornamentals"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Ornamentals",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "70",
  ["70 Vacant Institutional", "Vacant Institutional"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "71",
  ["71 Churches", "Churches"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Church",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "72",
  ["72 Schools, Colleges, Private", "Private Schools Colleges"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "73",
  ["73 Hospitals, Private", "Private Hospitals"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "74",
  ["74 Homes for the Aged", "Homes for the Aged"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "HomesForAged",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "75",
  ["75 Orphanages, other non-profit or charitable services", "Orphanages", "Non Profit Charitable Services"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "76",
  ["76 Mortuaries, Cemeteries, crematoriums", "Mortuaries", "Cemeteries", "Crematoriums"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "77",
  ["77 Clubs, Lodges, Union Halls", "Clubs", "Lodges", "Union Halls"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "78",
  ["78 Out Patient Clinics, Sanitariums, convalescent, rest homes", "Out Patient Clinics", "Sanitariums", "Convalescent Homes"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "SanitariumConvalescentHome",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "79",
  ["79 Cultural organizations, facilities", "Cultural organizations", "Cultural facilities"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "80",
  ["80 Vacant Governmental (municipal,counties,state,federal,dot,swfwmd)", "Vacant Governmental"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "81",
  ["81 Military", "Military"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Military",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "82",
  ["82 Forests, Parks, recreational areas", "Forests Parks recreational areas"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "83",
  ["83 Schools, Public", "Public Schools"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PublicSchool",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "84",
  ["84 Colleges Public", "Public Colleges"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PublicSchool",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "85",
  ["85 Hospitals Public", "Public Hospitals"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "PublicHospital",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "86",
  ["86 Other County", "Other County"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "87",
  ["87 Other State", "Other State"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "88",
  ["88 Other Federal", "Other Federal"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "89",
  ["89 Other Municipal", "Other Municipal"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "90",
  ["90 Leasehold Interests (government owned non government lessee)", "Leasehold Interests"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "Leasehold",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "91",
  ["91 Utilities", "Utilities"],
  Object.freeze({
    property_type: "Building",
    property_usage_type: "Utility",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "92",
  ["92 Mining lands, petroleum or gas lands", "Mining lands", "Petroleum or gas lands"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "MineralProcessing",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "93",
  ["93 Subsurface rights", "Subsurface rights"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    ownership_estate_type: "SubsurfaceRights",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "94",
  ["94 Right-of-Way, Streets, Ditch", "Right-of-Way", "Streets", "Ditch"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "95",
  ["95 Rivers and Lakes, Submerged Lands", "Rivers and Lakes", "Submerged Lands"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "96",
  ["96 Sewage Disposal, Waste Lands, Swamp", "Sewage Disposal", "Waste Lands", "Swamp"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "SewageDisposal",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "97",
  ["97 Outdoor Rec./Parkland, High-Water Recharge", "Outdoor Recreation Parkland", "High-Water Recharge"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

registerPropertyTypeMapping(
  "98",
  ["98 Centrally Assessed Railroad", "Centrally Assessed Railroad"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "Railroad",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "Improved",
  }),
);

registerPropertyTypeMapping(
  "99",
  ["99 Non-AG (Over 20 Acres)", "Non-AG Over 20 Acres"],
  Object.freeze({
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
    build_status: "VacantLand",
  }),
);

/**
 * Builds a sequence of normalized lookup keys for a raw classification value.
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
function buildClassificationLookupKeys(raw) {
  if (raw == null) return [];
  const trimmed = String(raw).trim();
  if (trimmed === "") return [];
  /** @type {Set<string>} */
  const keys = new Set();
  keys.add(trimmed);
  const digitsMatch = trimmed.match(/\d+/);
  if (digitsMatch) {
    const digits = digitsMatch[0];
    const trimmedDigits = digits.replace(/^0+/, "") || "0";
    const twoDigit = trimmedDigits.length >= 2 ? trimmedDigits.slice(0, 2) : trimmedDigits.padStart(2, "0");
    keys.add(twoDigit);
    keys.add(trimmedDigits);
    keys.add(digits);
    keys.add(digits.padStart(5, "0"));
  }
  trimmed
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => keys.add(part));
  const withoutLeadingDigits = trimmed.replace(/^\s*\d+[^\w]*/, "").trim();
  if (withoutLeadingDigits) keys.add(withoutLeadingDigits);
  return Array.from(keys)
    .map(normalizeClassificationKey)
    .filter(Boolean);
}

/**
 * Resolves the lexicon mapping for a given property classification string.
 * @param {string|null|undefined} rawClassification
 * @returns {PropertyLexiconMapping|null}
 */
function resolvePropertyLexiconMapping(rawClassification) {
  const keys = buildClassificationLookupKeys(rawClassification);
  for (const key of keys) {
    const mapping = PROPERTY_TYPE_MAPPINGS.get(key);
    if (mapping) return mapping;
  }
  return null;
}

/**
 * Determines number_of_units_type based on the resolved structure form.
 * @param {StructureFormEnum} structureForm
 * @returns {"One"|"Two"|"Three"|"Four"|"TwoToFour"|"OneToFour"|null}
 */
function deriveNumberOfUnitsType(structureForm) {
  switch (structureForm) {
    case "SingleFamilyDetached":
    case "SingleFamilySemiDetached":
    case "TownhouseRowhouse":
    case "ManufacturedHomeOnLand":
    case "ManufacturedHomeInPark":
    case "ManufacturedHousing":
    case "ManufacturedHousingSingleWide":
    case "ManufacturedHousingMultiWide":
    case "MobileHome":
    case "Modular":
      return "One";
    case "Duplex":
      return "Two";
    case "Triplex":
      return "Three";
    case "Quadplex":
      return "Four";
    case "MultiFamilyLessThan10":
      return "TwoToFour";
    case "MultiFamilyMoreThan10":
    case "MultiFamily5Plus":
    case "ApartmentUnit":
    case "Loft":
      return null;
    default:
      return null;
  }
}

/**
 * Converts the number_of_units_type to a numeric value when possible.
 * @param {"One"|"Two"|"Three"|"Four"|"TwoToFour"|"OneToFour"|null} unitsType
 * @returns {number|null}
 */
function deriveNumberOfUnits(unitsType) {
  switch (unitsType) {
    case "One":
      return 1;
    case "Two":
      return 2;
    case "Three":
      return 3;
    case "Four":
      return 4;
    default:
      return null;
  }
}

function extractSubdivision(legalDesc) {
  if (!legalDesc) return null;
  const pbIdx = legalDesc.indexOf(" PB ");
  if (pbIdx > 0) return legalDesc.substring(0, pbIdx).trim();
  const pbIdx2 = legalDesc.indexOf(" PLAT BOOK ");
  if (pbIdx2 > 0) return legalDesc.substring(0, pbIdx2).trim();
  return null;
}

function toIntOrNull(s) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toNumOrNull(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function upperFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeMiddleName(m) {
  if (m == null) return null;
  let s = m.toString().trim();
  if (s === "") return null;
  s = s.replace(/\s+/g, " ").toUpperCase();
  // If it doesn't match allowed pattern, attempt to salvage by removing leading non-letters
  if (!/^[A-Z][a-zA-Z\s\-',.]*$/.test(s)) {
    const s2 = s.replace(/^[^A-Z]+/, "");
    if (s2 && /^[A-Z][a-zA-Z\s\-',.]*$/.test(s2)) return s2;
    return null;
  }
  return s;
}

function main() {
  ensureDir(DATA_DIR);

  const html = readFile("input.html");
  const $ = cheerio.load(html);
  const addrSeed = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

  const currentCardText = textOrNull($("#lblCurrentCard"));
  const totalCardsText = textOrNull($("#lblTotalCards"));
  const currentCardNum =
    currentCardText != null ? Number(currentCardText.replace(/[^0-9]/g, "")) : null;
  const totalCardsNum =
    totalCardsText != null ? Number(totalCardsText.replace(/[^0-9]/g, "")) : null;
  if (
    currentCardNum != null &&
    totalCardsNum != null &&
    currentCardNum !== totalCardsNum
  ) {
    throw new Error(
      JSON.stringify({
        type: "error",
        message: `Expected to process the last card but current card (${currentCardNum}) != total cards (${totalCardsNum}).`,
        path: "Property.building_card",
      }),
    );
  }

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");

  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;
  const structureData = fs.existsSync(structurePath)
    ? readJSON(structurePath)
    : null;

  const parcelId = textOrNull($("#lblParcelID"));
  if (!parcelId) {
    // throw new Error("Parcel ID not found in input.html");
  }

  const ownersKey = `property_${parcelId}`;
  const structureFiles = [];
  const utilityFiles = [];
  const layoutFileEntries = [];
  let mailingAddressFile = null;
  const sharedRequestIdentifier =
    (propSeed && propSeed.request_identifier) ||
    (addrSeed && addrSeed.request_identifier) ||
      parcelId ||
      null;

  // PROPERTY
  const classification =
    textOrNull($("#lblDORClass")) || textOrNull($("#lblBuildingUse"));
  const propertyMapping = resolvePropertyLexiconMapping(classification);
  if (classification && !propertyMapping) {
    throwEnumError(classification, "Property", "property_usage_type");
  }
  const property_type =
    (propertyMapping && propertyMapping.property_type) ||
    propSeed.property_type ||
    null;
  const property_usage_type =
    (propertyMapping && propertyMapping.property_usage_type) ||
    propSeed.property_usage_type ||
    null;
  const ownership_estate_type =
    (propertyMapping && propertyMapping.ownership_estate_type) ||
    propSeed.ownership_estate_type ||
    null;
  const structure_form =
    (propertyMapping && propertyMapping.structure_form) ||
    propSeed.structure_form ||
    null;
  const build_status =
    (propertyMapping && propertyMapping.build_status) ||
    propSeed.build_status ||
    null;

  const number_of_units_type =
    deriveNumberOfUnitsType(structure_form) ||
    propSeed.number_of_units_type ||
    null;
  const number_of_units =
    deriveNumberOfUnits(number_of_units_type) ||
    (propSeed.number_of_units || null);

  const yearBuilt = toIntOrNull(textOrNull($("#lblBuildingYearBuilt")));

  // Livable floor area: find LIVING AREA row in #tblSubLines
  let livableSqft = null;
  $("#tblSubLines tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 5) {
      const desc = $(tds[2]).text().trim().toUpperCase();
      if (desc.includes("LIVING AREA")) {
        livableSqft = $(tds[3]).text().trim();
      }
    }
  });
  if (livableSqft) livableSqft = livableSqft.replace(/[^0-9]/g, "");

  const legalDesc = textOrNull($("#lblLegalDescription"));
  const subdivision = extractSubdivision(legalDesc || undefined);

  // Zoning from Land Detail first row, 5th column
  let zoning = null;
  const landFirstRow = $("#tblLandLines tr").eq(1);
  if (landFirstRow && landFirstRow.length) {
    const tds = landFirstRow.find("td");
    if (tds.length >= 5) zoning = $(tds[4]).text().trim() || null;
  }

  const property = {
    parcel_identifier: parcelId,
    property_type,
    property_usage_type,
    ownership_estate_type,
    structure_form,
    build_status,
    property_structure_built_year: yearBuilt || null,
    number_of_units_type,
    livable_floor_area: livableSqft ? String(livableSqft) : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
    zoning: zoning || null,
    number_of_units,
    area_under_air: null,
    property_effective_built_year: null,
    total_area: null,
    historic_designation: undefined, // omit
  };
  writeJSON("property.json", property);

  // ADDRESS
  const physicalAddrRaw = textOrNull($("#lblPhysicalAddress"));
  const parsedAddr =
    parsePhysicalAddress(
      physicalAddrRaw || null,
    ) || {};

  // county from seed if present
  const county =
    addrSeed && addrSeed.county_jurisdiction
      ? addrSeed.county_jurisdiction
      : null;

  // Validate suffix enum if provided; if not mappable, leave null (allowed)
  const street_suffix_type = parsedAddr.street_suffix_type || null;
  if (street_suffix_type) {
    const allowed = new Set([
      "Rds",
      "Blvd",
      "Lk",
      "Pike",
      "Ky",
      "Vw",
      "Curv",
      "Psge",
      "Ldg",
      "Mt",
      "Un",
      "Mdw",
      "Via",
      "Cor",
      "Kys",
      "Vl",
      "Pr",
      "Cv",
      "Isle",
      "Lgt",
      "Hbr",
      "Btm",
      "Hl",
      "Mews",
      "Hls",
      "Pnes",
      "Lgts",
      "Strm",
      "Hwy",
      "Trwy",
      "Skwy",
      "Is",
      "Est",
      "Vws",
      "Ave",
      "Exts",
      "Cvs",
      "Row",
      "Rte",
      "Fall",
      "Gtwy",
      "Wls",
      "Clb",
      "Frk",
      "Cpe",
      "Fwy",
      "Knls",
      "Rdg",
      "Jct",
      "Rst",
      "Spgs",
      "Cir",
      "Crst",
      "Expy",
      "Smt",
      "Trfy",
      "Cors",
      "Land",
      "Uns",
      "Jcts",
      "Ways",
      "Trl",
      "Way",
      "Trlr",
      "Aly",
      "Spg",
      "Pkwy",
      "Cmn",
      "Dr",
      "Grns",
      "Oval",
      "Cirs",
      "Pt",
      "Shls",
      "Vly",
      "Hts",
      "Clf",
      "Flt",
      "Mall",
      "Frds",
      "Cyn",
      "Lndg",
      "Mdws",
      "Rd",
      "Xrds",
      "Ter",
      "Prt",
      "Radl",
      "Grvs",
      "Rdgs",
      "Inlt",
      "Trak",
      "Byu",
      "Vlgs",
      "Ctr",
      "Ml",
      "Cts",
      "Arc",
      "Bnd",
      "Riv",
      "Flds",
      "Mtwy",
      "Msn",
      "Shrs",
      "Rue",
      "Crse",
      "Cres",
      "Anx",
      "Drs",
      "Sts",
      "Holw",
      "Vlg",
      "Prts",
      "Sta",
      "Fld",
      "Xrd",
      "Wall",
      "Tpke",
      "Ft",
      "Bg",
      "Knl",
      "Plz",
      "St",
      "Cswy",
      "Bgs",
      "Rnch",
      "Frks",
      "Ln",
      "Mtn",
      "Ctrs",
      "Orch",
      "Iss",
      "Brks",
      "Br",
      "Fls",
      "Trce",
      "Park",
      "Gdns",
      "Rpds",
      "Shl",
      "Lf",
      "Rpd",
      "Lcks",
      "Gln",
      "Pl",
      "Path",
      "Vis",
      "Lks",
      "Run",
      "Frg",
      "Brg",
      "Sqs",
      "Xing",
      "Pln",
      "Glns",
      "Blfs",
      "Plns",
      "Dl",
      "Clfs",
      "Ext",
      "Pass",
      "Gdn",
      "Brk",
      "Grn",
      "Mnr",
      "Cp",
      "Pne",
      "Spur",
      "Opas",
      "Upas",
      "Tunl",
      "Sq",
      "Lck",
      "Ests",
      "Shr",
      "Dm",
      "Mls",
      "Wl",
      "Mnrs",
      "Stra",
      "Frgs",
      "Frst",
      "Flts",
      "Ct",
      "Mtns",
      "Frd",
      "Nck",
      "Ramp",
      "Vlys",
      "Pts",
      "Bch",
      "Loop",
      "Byp",
      "Cmns",
      "Fry",
      "Walk",
      "Hbrs",
      "Dv",
      "Hvn",
      "Blf",
      "Grv",
      "Crk",
      null,
    ]);
    if (!allowed.has(street_suffix_type)) {
      // throwEnumError(street_suffix_type, "address", "street_suffix_type");
    }
  }

  /**
   * Removes unit-related suffixes from a city name and normalizes whitespace.
   * @param {string|null|undefined} cityInput
   * @returns {string|null}
   */
  function cleanCityName(cityInput) {
    if (cityInput == null) return null;
    const normalizedCity = String(cityInput)
      .replace(
        /\b(?:UNIT|SUITE|STE|APT|APARTMENT|BLDG|BUILDING|ROOM|FL|FLOOR)\s*[A-Z0-9\-]*\b/gi,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();
    return normalizedCity === "" ? null : normalizedCity;
  }

  /**
   * Returns the first five characters of a postal code when available.
   * @param {string|null|undefined} codeInput
   * @returns {string|null}
   */
  function getZip5(codeInput) {
    if (codeInput == null) return null;
    const trimmedCode = String(codeInput).trim();
    if (trimmedCode === "") return null;
    return trimmedCode.substring(0, 5) || null;
  }

  /**
   * @typedef {Object} StreetDirectionParts
   * @property {string|null} street_name
   * @property {string|null} street_pre_directional_text
   * @property {string|null} street_post_directional_text
   */

  /**
   * Parses a street name to identify pre/post directional components.
   * @param {string|null|undefined} streetNameInput
   * @returns {StreetDirectionParts}
   */
  function parseStreetDirection(streetNameInput) {
    /** @type {StreetDirectionParts} */
    const emptyResult = {
      street_name: null,
      street_pre_directional_text: null,
      street_post_directional_text: null,
    };
    if (streetNameInput == null) return emptyResult;
    const trimmedName = String(streetNameInput).trim();
    if (trimmedName === "") return emptyResult;

    const directions = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
    const parts = trimmedName.split(/\s+/);

    let street_pre_directional_text = null;
    let street_post_directional_text = null;

    if (parts.length > 0 && directions.includes(parts[0].toUpperCase())) {
      street_pre_directional_text = parts[0].toUpperCase();
      parts.shift();
    }

    if (
      parts.length > 0 &&
      directions.includes(parts[parts.length - 1].toUpperCase())
    ) {
      street_post_directional_text = parts[parts.length - 1].toUpperCase();
      parts.pop();
    }

    for (let i = 1; i < parts.length - 1; i += 1) {
      if (directions.includes(parts[i].toUpperCase())) {
        street_post_directional_text = parts[i].toUpperCase();
        parts.splice(i, 1);
        break;
      }
    }

    let street_name = parts.join(" ");
    if (/^hill-?n-?dale$/i.test(street_name)) {
      street_name = "HILL-AND-DALE";
    }

    return {
      street_name: street_name === "" ? null : street_name,
      street_pre_directional_text,
      street_post_directional_text,
    };
  }

  const fallbackUnnormalized =
    normalizeSpace(physicalAddrRaw) ||
    normalizeSpace(addrSeed && addrSeed.full_address) ||
    null;
  const address = {
    unnormalized_address: fallbackUnnormalized,
    latitude:
      addrSeed && typeof addrSeed.latitude === "number"
        ? addrSeed.latitude
        : null,
    longitude:
      addrSeed && typeof addrSeed.longitude === "number"
        ? addrSeed.longitude
        : null,
    county_name: county || null,
    request_identifier: sharedRequestIdentifier,
  };
  writeJSON("address.json", address);

  // MAILING ADDRESS
  const mailingAddressEl = $("#lblMailingAddress");
  if (mailingAddressEl && mailingAddressEl.length) {
    const rawHtml = mailingAddressEl.html() || "";
    const lines = rawHtml
      .split(/<br\s*\/?>/i)
      .map((segment) => {
        const text = cheerio
          .load(`<span>${segment}</span>`)
          .text()
          .replace(/\u00A0/g, " ");
        return normalizeSpace(text);
      })
      .filter((line) => line && line.length > 0);
    if (lines.length > 0) {
      const addressParts = lines.length > 1 ? lines.slice(1) : lines;
      const unnormalizedMailing =
        addressParts.length > 0 ? addressParts.join(", ") : null;
      if (unnormalizedMailing) {
        const mailingAddress = {
          source_http_request:
            (propSeed && propSeed.source_http_request) ||
            (addrSeed && addrSeed.source_http_request) ||
            null,
          request_identifier: sharedRequestIdentifier,
          unnormalized_address: unnormalizedMailing,
          latitude: null,
          longitude: null,
        };
        writeJSON("mailing_address.json", mailingAddress);
        mailingAddressFile = "mailing_address.json";
      }
    }
  }

  // LOT
  let lot_area_sqft = null;
  let lot_unitsType = null;
  if (landFirstRow && landFirstRow.length) {
    const tds = landFirstRow.find("td");
    if (tds.length >= 10) {
      const units = $(tds[5]).text().trim();
      lot_area_sqft = toIntOrNull(units);
      lot_unitsType = $(tds[6]).text().trim();
    }
  }
  const acres = toNumOrNull(textOrNull($("#lblAcres")));
  let lot_type = null;
  if (typeof acres === "number") {
    lot_type =
      acres <= 0.25
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  // Extra Features table to infer driveway material and fence type
  let driveway_material = null;
  let fencing_type = null;
  $("#tblXFLines tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const desc = $(tds[2]).text().trim().toUpperCase();
      if (desc.includes("DRVWAY") || desc.includes("SIDEWALK")) {
        driveway_material = "Concrete";
      }
      if (desc.includes("CHAIN LINK FENCE")) {
        fencing_type = "ChainLink";
      }
    }
  });

  const lot = {
    lot_type: lot_type || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft || null,
    lot_size_acre: acres || null,
    landscaping_features: null,
    view: null,
    fencing_type: fencing_type || null,
    fence_height: null,
    fence_length: null,
    driveway_material: driveway_material || null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON("lot.json", lot);

  // TAX (single year 2025)
  const valueJust = parseCurrencyToNumber($("#lblValueJust").text());
  const valueLand = parseCurrencyToNumber($("#lblValueLand").text());
  const valueBuilding = parseCurrencyToNumber($("#lblValueBuilding").text());
  const valueCountyAssessed = parseCurrencyToNumber(
    $("#lblCountyValueAssessed").text(),
  );
  const valueCountyTaxable = parseCurrencyToNumber(
    $("#lblValueCountyTaxable").text(),
  );
  // Determine tax year from the header note
  let taxYear = null;
  const valuesHeaderTxt = $("#parcelValueTable tr").first().text();
  const yearMatch =
    valuesHeaderTxt && valuesHeaderTxt.match(/for the\s+(\d{4})\s+tax year/i);
  if (yearMatch) taxYear = parseInt(yearMatch[1], 10);

  if (taxYear != null) {
    const tax = {
      tax_year: taxYear,
      property_assessed_value_amount:
        valueCountyAssessed != null ? valueCountyAssessed : null,
      property_market_value_amount: valueJust != null ? valueJust : null,
      property_building_amount: valueBuilding != null ? valueBuilding : null,
      property_land_amount: valueLand != null ? valueLand : null,
      property_taxable_value_amount:
        valueCountyTaxable != null ? valueCountyTaxable : null,
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(`tax_${taxYear}.json`, tax);
  }

    // STRUCTURE
  purgeDataFiles([/^structure_\d+\.json$/, /^structure\.json$/]);
  if (structureData && structureData[ownersKey]) {
    const structuresRaw = Array.isArray(structureData[ownersKey])
      ? structureData[ownersKey]
      : [structureData[ownersKey]];
    let structureIndex = 1;
    for (const entry of structuresRaw) {
      if (!entry || typeof entry !== "object") continue;
      const structureFile = `structure_${structureIndex}.json`;
      writeJSON(structureFile, entry);
      structureFiles.push(structureFile);
      structureIndex += 1;
    }
  }

  // UTILITIES from owners/utilities_data.json
  purgeDataFiles([/^utility_\d+\.json$/, /^utility\.json$/]);
  if (utilitiesData && utilitiesData[ownersKey]) {
    const utilitiesRaw = Array.isArray(utilitiesData[ownersKey])
      ? utilitiesData[ownersKey]
      : [utilitiesData[ownersKey]];
    let utilityIndex = 1;
    for (const entry of utilitiesRaw) {
      if (!entry || typeof entry !== "object") continue;
      const utilityFile = `utility_${utilityIndex}.json`;
      writeJSON(utilityFile, entry);
      utilityFiles.push(utilityFile);
      utilityIndex += 1;
    }
  }

  // LAYOUT from owners/layout_data.json
  purgeDataFiles([/^layout_\d+\.json$/, /^relationship_property_has_layout_\d+\.json$/, /^relationship_layout_\d+_has_layout_\d+\.json$/, /^relationship_layout_\d+_has_structure_\d+\.json$/, /^relationship_layout_\d+_has_utility_\d+\.json$/]);
  if (
    layoutData &&
    layoutData[ownersKey] &&
    Array.isArray(layoutData[ownersKey].layouts)
  ) {
    const layoutEntriesRaw = layoutData[ownersKey].layouts;
    let layoutIndex = 1;
    for (const entry of layoutEntriesRaw) {
      if (!entry || typeof entry !== "object") continue;
      const layoutFile = entry.file || `layout_${layoutIndex}.json`;
      const layoutPayload = entry.data || entry;
      writeJSON(layoutFile, layoutPayload);
      layoutFileEntries.push({ file: layoutFile, parent: entry.parent || null });
      if (entry.parent) {
        writeRelationshipFile(entry.parent, layoutFile);
      }
      layoutIndex += 1;
    }
  }

  const propertyFileName = "property.json";
  const buildingTargets = layoutFileEntries
    .filter((entry) => !entry.parent)
    .map((entry) => entry.file);

  if (structureFiles.length > 0) {
    if (buildingTargets.length === 0) {
      for (const structureFile of structureFiles) {
        writeRelationshipFile(propertyFileName, structureFile);
      }
    } else if (buildingTargets.length === 1) {
      const target = buildingTargets[0];
      for (const structureFile of structureFiles) {
        writeRelationshipFile(target, structureFile);
      }
    } else if (structureFiles.length === buildingTargets.length) {
      for (let i = 0; i < buildingTargets.length; i += 1) {
        writeRelationshipFile(buildingTargets[i], structureFiles[i]);
      }
    } else if (structureFiles.length === 1) {
      writeRelationshipFile(propertyFileName, structureFiles[0]);
    } else {
      const pairs = Math.min(structureFiles.length, buildingTargets.length);
      for (let i = 0; i < pairs; i += 1) {
        writeRelationshipFile(buildingTargets[i], structureFiles[i]);
      }
      for (let i = pairs; i < structureFiles.length; i += 1) {
        writeRelationshipFile(propertyFileName, structureFiles[i]);
      }
    }
  }

  if (utilityFiles.length > 0) {
    if (buildingTargets.length === 0) {
      for (const utilityFile of utilityFiles) {
        writeRelationshipFile(propertyFileName, utilityFile);
      }
    } else if (buildingTargets.length === 1) {
      const target = buildingTargets[0];
      for (const utilityFile of utilityFiles) {
        writeRelationshipFile(target, utilityFile);
      }
    } else if (utilityFiles.length === buildingTargets.length) {
      for (let i = 0; i < buildingTargets.length; i += 1) {
        writeRelationshipFile(buildingTargets[i], utilityFiles[i]);
      }
    } else if (utilityFiles.length === 1) {
      writeRelationshipFile(propertyFileName, utilityFiles[0]);
    } else {
      const pairs = Math.min(utilityFiles.length, buildingTargets.length);
      for (let i = 0; i < pairs; i += 1) {
        writeRelationshipFile(buildingTargets[i], utilityFiles[i]);
      }
      for (let i = pairs; i < utilityFiles.length; i += 1) {
        writeRelationshipFile(propertyFileName, utilityFiles[i]);
      }
    }
  }
  // OWNERS (persons and companies). Build owner files & relationships.
  const persons = [];
  const companies = [];
  const relationshipsSalesPersons = [];
  if (ownersData && ownersData[ownersKey]) {
    const ownersByDate = ownersData[ownersKey].owners_by_date || {};
    const currentOwners = Array.isArray(ownersByDate.current)
      ? ownersByDate.current
      : [];
    const historicalKeys = Object.keys(ownersByDate).filter(
      (k) => k !== "current",
    );

    // Build person objects
    let personIndex = 1;
    let companyIndex = 1;
    function addPerson(owner) {
      const name_regex = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
      const p = {
        birth_date: null,
        first_name: owner.first_name ? upperFirst(owner.first_name) : null,
        last_name: owner.last_name ? upperFirst(owner.last_name) : null,
        middle_name: normalizeMiddleName(owner.middle_name || null),
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      if (!name_regex.test(p.first_name) || !name_regex.test(p.last_name)) {
        personIndex++;
        return null
      }

      const fname = `person_${personIndex}.json`;
      writeJSON(fname, p);
      persons.push({ file: fname, data: p });
      personIndex++;
      return fname;
    }

    function addCompany(owner) {
      const name = normalizeSpace(owner.name || "");
      if (!name) {
        companyIndex += 1;
        return null;
      }
      const company = {
        name,
      };
      const fname = `company_${companyIndex}.json`;
      writeJSON(fname, company);
      companies.push({ file: fname, data: company });
      companyIndex += 1;
      return fname;
    }

    const personFileByOwner = new Map();
    const companyFileByOwner = new Map();
    for (const o of currentOwners) {
      if (o.type === "person") {
        const fname = addPerson(o);
        if (!fname) {
          continue
        }
        personFileByOwner.set(o, fname);
      } else if (o.type === "company") {
        const fname = addCompany(o);
        if (fname) {
          companyFileByOwner.set(o, fname);
        }
      }
    }
    for (const d of historicalKeys) {
      const ownersArr = ownersByDate[d] || [];
      for (const o of ownersArr) {
        if (o.type === "person") {
          const fname = addPerson(o);
          if (fname) personFileByOwner.set(o, fname);
        } else if (o.type === "company") {
          const fname = addCompany(o);
          if (fname) companyFileByOwner.set(o, fname);
        }
      }
    }

    const mailingAddressFileName =
      mailingAddressFile ||
      (fs.existsSync(path.join(DATA_DIR, "mailing_address.json"))
        ? "mailing_address.json"
        : null);
    if (mailingAddressFileName) {
      for (const owner of currentOwners) {
        if (owner.type === "person") {
          const fname = personFileByOwner.get(owner);
          if (fname) {
            writeRelationshipFile(fname, mailingAddressFileName);
          }
        } else if (owner.type === "company") {
          const fname = companyFileByOwner.get(owner);
          if (fname) {
            writeRelationshipFile(fname, mailingAddressFileName);
          }
        }
      }
    }

      // SALES extraction to construct relationships later
    /** @type {SalesRow[]} */
    const salesRows = [];
    const saleFileByYear = new Map();
    $("#tblSaleLines tr").each((i, tr) => {
      if (i === 0) return; // Skip header row
      const tds = $(tr).find("td");
      if (tds.length >= 6) {
        const monthYear = $(tds[0]).text().trim();
        const linkEl = $(tds[1]).find("a");
        const deedUrl =
          linkEl && linkEl.attr("href") ? linkEl.attr("href") : null;
        const bookPageTxtRaw = linkEl ? linkEl.text().trim() : "";
        const bookPageTxt =
          bookPageTxtRaw && bookPageTxtRaw !== "" ? bookPageTxtRaw : null;
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount, bookPageTxt });
      }
    });

    let saleIdx = 1;
    let deedIdx = 1;
    let fileIdx = 1;
    for (const row of salesRows) {
      // Determine deed type based on the text
      let deedType = null;
      const dtype = row.deedTypeTxt ? row.deedTypeTxt.toLowerCase() : "";
      if (dtype.includes("warranty deed")) deedType = "Warranty Deed";
      else if (dtype.includes("quit")) deedType = "Quitclaim Deed";
      else if (dtype.includes("personal representative"))
        deedType = "Personal Representative Deed";
      else if (dtype.includes("grant deed")) deedType = "Grant Deed";

      // Parse book, page, and instrument number
      const { book, page } = parseBookAndPage(row.bookPageTxt);
      const instrumentNumber = extractInstrumentNumber(row.deedUrl);

      // Create deed JSON with the new schema
      let deedFileName = null;
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        const deedObj = {
          deed_type: deedType,
          request_identifier: sharedRequestIdentifier || null,
        };
        if (book) deedObj.book = book;
        if (page) deedObj.page = page;
        if (instrumentNumber) deedObj.instrument_number = instrumentNumber;
        if (row.deedUrl) {
          deedObj.source_http_request =propSeed.source_http_request;
        }
        writeJSON(deedFileName, deedObj);
        deedIdx++;
      }

      // Create file record if we have a deed URL
      if (deedType && row.deedUrl) {
        let document_type = null;
        if (deedType === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deedType === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else document_type = "ConveyanceDeed";

        const fileObj = {
          document_type,
          file_format: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };

        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);

        // Create relationship between deed and file
        if (deedFileName) {
          writeRelationshipFile(
            deedFileName,
            fileName,
            `relationship_deed_has_file_${fileIdx}.json`,
          );
        }
        fileIdx++;
      }

      // SALES: only create sales when amount is a positive currency (>0)
      if (typeof row.amount === "number" && row.amount > 0) {
        const ownershipTransferDate = parseMonthYearToIsoDate(row.monthYear);
        if (!ownershipTransferDate) {
          throw new Error(
            `Unable to parse ownership transfer month/year "${row.monthYear}".`,
          );
        }
        const sale = {
          ownership_transfer_date: ownershipTransferDate,
          purchase_price_amount: row.amount,
          request_identifier: sharedRequestIdentifier || null,
        };
        const saleName = `sales_history_${saleIdx}.json`;
        writeJSON(saleName, sale);
        // link sales -> deed if we created a deed for this row
        // if (deedFileName) {
        //   writeJSON(`relationship_sales_history_deed_${saleIdx}.json`, {
        //     to: { "/": `./${saleName}` },
        //     from: { "/": `./${deedFileName}` },
        //   });
        // }
        // Save by year for relationships to owners_by_date
        const yMatch =
          row.monthYear && row.monthYear.match(/(\d{1,2})\/(\d{4})/);
        if (yMatch) {
          const yr = yMatch[2];
          const key = `${yr}`;
          if (!saleFileByYear.has(key)) saleFileByYear.set(key, []);
          saleFileByYear.get(key).push(saleName);
        }
        saleIdx++;
      }
    }

    // Relationships: map current owners -> latest sale year (2020 pref if exists)
    function salesForYear(y) {
      return saleFileByYear.get(String(y)) || [];
    }

    // Current owners: assume they correspond to the most recent sale year present
    let availableYears = Array.from(saleFileByYear.keys())
      .map((s) => parseInt(s, 10))
      .sort((a, b) => b - a);
    if (currentOwners.length > 0 && availableYears.length > 0) {
      const latestYear = availableYears[0];
      const latestSales = salesForYear(latestYear);
      // link each current person to each sale in that year
      // Typically one sale, link both owners to that sale
      const targetSale = latestSales[0];
      if (targetSale) {
        let relIdx = 1;
        for (const o of currentOwners) {
          if (o.type === "person") {
            const pf = persons.find(
              (pp) =>
                pp.data.first_name === upperFirst(o.first_name) &&
                pp.data.last_name === upperFirst(o.last_name),
            );
            if (pf) {
              writeJSON(
                `relationship_sales_history_person_${relationshipsSalesPersons.length + 1}.json`,
                {
                  to: { "/": `./${pf.file}` },
                  from: { "/": `./${targetSale}` },
                },
              );
              relationshipsSalesPersons.push(1);
              relIdx++;
            }
          }
        }
      }
    }

    // Historical mapping for 2018 example
    for (const d of historicalKeys) {
      const year = d.split("-")[0];
      const salesInYear = salesForYear(year);
      if (salesInYear.length > 0) {
        const targetSale = salesInYear[0];
        const ownersArr = ownersByDate[d] || [];
        for (const o of ownersArr) {
          if (o.type === "person") {
            const pf = persons.find(
              (pp) =>
                pp.data.first_name === upperFirst(o.first_name) &&
                pp.data.last_name === upperFirst(o.last_name),
            );
            if (pf) {
              writeJSON(
                `relationship_sales_history_person_${relationshipsSalesPersons.length + 1}.json`,
                {
                  to: { "/": `./${pf.file}` },
                  from: { "/": `./${targetSale}` },
                },
              );
              relationshipsSalesPersons.push(1);
            }
          }
        }
      }
    }
  }

  // SALES without owner relationships already handled above. If no ownersData, still produce sales/deeds/files
  if (!(ownersData && ownersData[ownersKey])) {
    // Build sales basic if not already: extract and write
    /** @type {SalesRow[]} */
    const salesRows = [];
    $("#tblSaleLines tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length >= 6) {
        const monthYear = $(tds[0]).text().trim();
        const linkEl = $(tds[1]).find("a");
        const deedUrl =
          linkEl && linkEl.attr("href") ? linkEl.attr("href") : null;
        const bookPageTxtRaw = linkEl ? linkEl.text().trim() : "";
        const bookPageTxt =
          bookPageTxtRaw && bookPageTxtRaw !== "" ? bookPageTxtRaw : null;
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount, bookPageTxt });
      }
    });

    let saleIdx = 1;
    let deedIdx = 1;
    let fileIdx = 1;
    for (const row of salesRows) {
      let deedType = null;
      const dtype = row.deedTypeTxt ? row.deedTypeTxt.toLowerCase() : "";
      if (dtype.includes("warranty deed")) deedType = "Warranty Deed";
      else if (dtype.includes("quit")) deedType = "Quitclaim Deed";
      else if (dtype.includes("personal representative"))
        deedType = "Personal Representative Deed";
      else if (dtype.includes("grant deed")) deedType = "Grant Deed";
      let deedFileName = null;
      const { book, page } = parseBookAndPage(row.bookPageTxt);
      const instrumentNumber = extractInstrumentNumber(row.deedUrl);
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        const deedObj = {
          deed_type: deedType,
          request_identifier: sharedRequestIdentifier || null,
        };
        if (book) deedObj.book = book;
        if (page) deedObj.page = page;
        if (instrumentNumber) deedObj.instrument_number = instrumentNumber;
        if (row.deedUrl) {
          deedObj.source_http_request = {
            method: "GET",
            url: row.deedUrl,
          };
        }
        writeJSON(deedFileName, deedObj);
        deedIdx++;
      }
      if (deedType && row.deedUrl) {
        let document_type = null;
        if (deedType === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deedType === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else document_type = "ConveyanceDeed";
        const fileObj = {
          document_type,
          file_format: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };
        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);
        if (deedFileName) {
          writeRelationshipFile(
            deedFileName,
            fileName,
            `relationship_deed_has_file_${fileIdx}.json`,
          );
        }
        fileIdx++;
      }
      if (typeof row.amount === "number" && row.amount > 0) {
        const ownershipTransferDate = parseMonthYearToIsoDate(row.monthYear) || null;
        const sale = {
          ownership_transfer_date: ownershipTransferDate,
          purchase_price_amount: row.amount,
          request_identifier: sharedRequestIdentifier || null,
        };
        const saleName = `sales_history_${saleIdx}.json`;
        writeJSON(saleName, sale);
        if (deedFileName) {
          writeJSON(`relationship_sales_history_${saleIdx}_deed_${saleIdx}.json`, {
            from: { "/": `./${saleName}` },
            to: { "/": `./${deedFileName}` },
          });
        }
        saleIdx++;
      }
    }
  }
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  console.error(e.message || e.toString());
  process.exit(1);
}
