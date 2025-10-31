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

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const parcelId = textOrNull($("#lblParcelID"));
  if (!parcelId) {
    // throw new Error("Parcel ID not found in input.html");
  }

  const ownersKey = `property_${parcelId}`;

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

  const parsed_streetname = parseStreetDirection(parsedAddr.street_name);
  const address = {
    street_number: parsedAddr.street_number || null,
    street_name: parsed_streetname.street_name || null,
    street_suffix_type: street_suffix_type,
    street_pre_directional_text: parsed_streetname.street_pre_directional_text || null,
    street_post_directional_text: parsed_streetname.street_post_directional_text || null,
    unit_identifier: null,
    city_name: cleanCityName(parsedAddr.city_name) || null,
    state_code: parsedAddr.state_code || null,
    postal_code: getZip5(parsedAddr.postal_code) || null,
    plus_four_postal_code: null,
    latitude: addrSeed.latitude || null,
    longitude: addrSeed.longitude || null,
    country_code: null,
    county_name: county || null,
    municipality_name: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
  };
  writeJSON("address.json", address);

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
  const stories = toNumOrNull(textOrNull($("#lblBuildingStories")));
  const ext1 = textOrNull($("#lblBuildingExteriorWall1"));
  const ext2 = textOrNull($("#lblBuildingExteriorWall2"));
  const roofStruct = textOrNull($("#lblBuildingRoofStructure"));
  const roofCover = textOrNull($("#lblBuildingRoofCover"));
  const intWall1 = textOrNull($("#lblBuildingInteriorWall1"));
  const floor1 = textOrNull($("#lblBuildingFlooring1"));

  let exterior_wall_material_primary = null;
  let exterior_wall_material_secondary = null;
  if (ext1) {
    const e = ext1.toLowerCase();
    if (e.includes("concrete block"))
      exterior_wall_material_primary = "Concrete Block";
    if (e.includes("stucco"))
      exterior_wall_material_secondary = "Stucco Accent";
    if (!exterior_wall_material_primary && e.includes("stucco"))
      exterior_wall_material_primary = "Stucco";
  }
  if (ext2 && ext2.toLowerCase() !== "none") {
    const e2 = ext2.toLowerCase();
    if (e2.includes("brick")) exterior_wall_material_secondary = "Brick Accent";
    if (e2.includes("stucco"))
      exterior_wall_material_secondary = "Stucco Accent";
    if (e2.includes("vinyl")) exterior_wall_material_secondary = "Vinyl Accent";
    if (e2.includes("wood")) exterior_wall_material_secondary = "Wood Trim";
    if (e2.includes("metal")) exterior_wall_material_secondary = "Metal Trim";
  }

  let interior_wall_surface_material_primary = null;
  if (intWall1) {
    const iw = intWall1.toLowerCase();
    if (iw.includes("plaster"))
      interior_wall_surface_material_primary = "Plaster";
    else if (iw.includes("drywall"))
      interior_wall_surface_material_primary = "Drywall";
  }

  let flooring_material_primary = null;
  if (floor1) {
    const f = floor1.toLowerCase();
    if (f.includes("carpet")) flooring_material_primary = "Carpet";
    else if (f.includes("tile")) flooring_material_primary = "Ceramic Tile";
    else if (f.includes("vinyl")) flooring_material_primary = "Sheet Vinyl";
    else if (f.includes("hardwood"))
      flooring_material_primary = "Solid Hardwood";
  }

  let roof_design_type = null;
  if (roofStruct) {
    const r = roofStruct.toLowerCase();
    if (r.includes("gable") && r.includes("hip"))
      roof_design_type = "Combination";
    else if (r.includes("gable")) roof_design_type = "Gable";
    else if (r.includes("hip")) roof_design_type = "Hip";
  }

  let roof_material_type = null;
  if (roofCover) {
    const rc = roofCover.toLowerCase();
    if (rc.includes("shingle")) roof_material_type = "Shingle";
    else if (rc.includes("metal")) roof_material_type = "Metal";
    else if (rc.includes("tile")) roof_material_type = "Tile";
  }

  let roof_covering_material = null; // unknown specificity

  const finished_base_area = livableSqft ? toIntOrNull(livableSqft) : null;

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exterior_wall_material_primary || null,
    exterior_wall_material_secondary: exterior_wall_material_secondary || null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: flooring_material_primary || null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary || null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: roof_covering_material,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: roof_design_type || null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roof_material_type || null,
    foundation_type: null,
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
    primary_framing_material:
      exterior_wall_material_primary === "Concrete Block"
        ? "Concrete Block"
        : null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: stories || null,
    finished_base_area: finished_base_area || null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON("structure.json", structure);

  // UTILITIES from owners/utilities_data.json
  if (utilitiesData && utilitiesData[ownersKey]) {
    const u = utilitiesData[ownersKey];
    const utility = {
      cooling_system_type: u.cooling_system_type ?? null,
      heating_system_type: u.heating_system_type ?? null,
      public_utility_type: u.public_utility_type ?? null,
      sewer_type: u.sewer_type ?? null,
      water_source_type: u.water_source_type ?? null,
      plumbing_system_type: u.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        u.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: u.electrical_panel_capacity ?? null,
      electrical_wiring_type: u.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: u.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        u.electrical_wiring_type_other_description ?? null,
      solar_panel_present:
        typeof u.solar_panel_present === "boolean"
          ? u.solar_panel_present
          : null,
      solar_panel_type: u.solar_panel_type ?? null,
      solar_panel_type_other_description: u.solar_panel_type_other_description ?? null,
      smart_home_features: u.smart_home_features ?? null,
      smart_home_features_other_description:
        u.smart_home_features_other_description ?? null,
      hvac_unit_condition: u.hvac_unit_condition ?? null,
      solar_inverter_visible:
        typeof u.solar_inverter_visible === "boolean"
          ? u.solar_inverter_visible
          : null,
      hvac_unit_issues: u.hvac_unit_issues ?? null,
    };
    writeJSON("utility.json", utility);
  }

  // LAYOUT from owners/layout_data.json
  if (
    layoutData &&
    layoutData[ownersKey] &&
    Array.isArray(layoutData[ownersKey].layouts)
  ) {
    let li = 1;
    for (const lay of layoutData[ownersKey].layouts) {
      const layout = {
        space_type: lay.space_type ?? null,
        space_index: lay.space_index ?? null,
        flooring_material_type: lay.flooring_material_type ?? null,
        size_square_feet: lay.size_square_feet ?? null,
        floor_level: lay.floor_level ?? null,
        has_windows: lay.has_windows ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
        is_finished:
          typeof lay.is_finished === "boolean" ? lay.is_finished : null,
        furnished: lay.furnished ?? null,
        paint_condition: lay.paint_condition ?? null,
        flooring_wear: lay.flooring_wear ?? null,
        clutter_level: lay.clutter_level ?? null,
        visible_damage: lay.visible_damage ?? null,
        countertop_material: lay.countertop_material ?? null,
        cabinet_style: lay.cabinet_style ?? null,
        fixture_finish_quality: lay.fixture_finish_quality ?? null,
        design_style: lay.design_style ?? null,
        natural_light_quality: lay.natural_light_quality ?? null,
        decor_elements: lay.decor_elements ?? null,
        pool_type: lay.pool_type ?? null,
        pool_equipment: lay.pool_equipment ?? null,
        spa_type: lay.spa_type ?? null,
        safety_features: lay.safety_features ?? null,
        view_type: lay.view_type ?? null,
        lighting_features: lay.lighting_features ?? null,
        condition_issues: lay.condition_issues ?? null,
        is_exterior:
          typeof lay.is_exterior === "boolean" ? lay.is_exterior : null,
        pool_condition: lay.pool_condition ?? null,
        pool_surface_type: lay.pool_surface_type ?? null,
        pool_water_quality: lay.pool_water_quality ?? null,
      };
      writeJSON(`layout_${li}.json`, layout);
      li++;
    }
  }

  // OWNERS (persons only in this dataset). Build person files & relationships.
  const persons = [];
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

    const personFileByOwner = new Map();
    for (const o of currentOwners) {
      if (o.type === "person") {
        const fname = addPerson(o);
        if (!fname) {
          continue
        }
        personFileByOwner.set(o, fname);
      }
    }
    for (const d of historicalKeys) {
      const ownersArr = ownersByDate[d] || [];
      for (const o of ownersArr) {
        if (o.type === "person") {
          personFileByOwner.set(o, addPerson(o));
        }
      }
    }

    // SALES extraction to construct relationships later
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
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount });
      }
    });

    // Build sales, deed, file, and relationships
    let saleIdx = 1;
    let deedIdx = 1;
    let fileIdx = 1;

    const saleFileByYear = new Map();

    for (const row of salesRows) {
      // Create deed + file for any recognizable deed types
      let deedType = null;
      const dtype = row.deedTypeTxt ? row.deedTypeTxt.toLowerCase() : "";
      if (dtype.includes("warranty deed")) deedType = "Warranty Deed";
      else if (dtype.includes("quit")) deedType = "Quitclaim Deed";
      else if (dtype.includes("personal representative"))
        deedType = "Personal Representative Deed";
      else if (dtype.includes("grant deed")) deedType = "Grant Deed";
      // Build deed if we recognized the type
      let deedFileName = null;
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        writeJSON(deedFileName, { deed_type: deedType });
        deedIdx++;
      }

      // File reference
      if (deedType && row.deedUrl) {
        // Map document type enum for file
        let document_type = null;
        if (deedType === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deedType === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else document_type = "ConveyanceDeed";

        const fileObj = {
          document_type,
          file_format: null,
          name: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };
        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);
        // relationship: deed <- file
        if (deedFileName) {
          writeJSON(`relationship_deed_file_${fileIdx}.json`, {
            to: { "/": `./${deedFileName}` },
            from: { "/": `./${fileName}` },
          });
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
        };
        const saleName = `sales_${saleIdx}.json`;
        writeJSON(saleName, sale);
        // link sales -> deed if we created a deed for this row
        if (deedFileName) {
          writeJSON(`relationship_sales_deed_${saleIdx}.json`, {
            to: { "/": `./${saleName}` },
            from: { "/": `./${deedFileName}` },
          });
        }
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
                `relationship_sales_person_${relationshipsSalesPersons.length + 1}.json`,
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
                `relationship_sales_person_${relationshipsSalesPersons.length + 1}.json`,
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
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount });
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
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        writeJSON(deedFileName, { deed_type: deedType });
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
          name: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };
        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);
        if (deedFileName) {
          writeJSON(`relationship_deed_file_${fileIdx}.json`, {
            to: { "/": `./${deedFileName}` },
            from: { "/": `./${fileName}` },
          });
        }
        fileIdx++;
      }
      if (typeof row.amount === "number" && row.amount > 0) {
        const ownershipTransferDate = parseMonthYearToIsoDate(row.monthYear) || null;
        const sale = {
          ownership_transfer_date: ownershipTransferDate,
          purchase_price_amount: row.amount,
        };
        const saleName = `sales_${saleIdx}.json`;
        writeJSON(saleName, sale);
        if (deedFileName) {
          writeJSON(`relationship_sales_deed_${saleIdx}.json`, {
            to: { "/": `./${saleName}` },
            from: { "/": `./${deedFileName}` },
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
