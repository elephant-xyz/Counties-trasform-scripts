const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listDirSafe(p) {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

function readJSON(p) {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function readInputHtml() {
  const html = fs.readFileSync("input.html", "utf-8");
  const $ = cheerio.load(html);
  const pre = $("pre").first().text();
  return JSON.parse(pre);
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).slice(0, 10);
  return /\d{4}-\d{2}-\d{2}/.test(m) ? m : null;
}

function toCurrencyNumber(n) {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

function properCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeLookupString(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function pickFirstString(source, keys) {
  if (!source || !keys || !keys.length) return null;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const raw = source[key];
    if (raw === null || raw === undefined) continue;
    const str = String(raw).trim();
    if (str) return str;
  }
  return null;
}

const DEED_TYPE_EXACT_MAP = new Map([
  ["WARRANTY DEED", "Warranty Deed"],
  ["GENERAL WARRANTY DEED", "Warranty Deed"],
  ["LIMITED WARRANTY DEED", "Warranty Deed"],
  ["SPECIAL WARRANTY DEED", "Special Warranty Deed"],
  ["QUIT CLAIM DEED", "Quitclaim Deed"],
  ["QUITCLAIM DEED", "Quitclaim Deed"],
  ["GRANT DEED", "Grant Deed"],
  ["BARGAIN AND SALE DEED", "Bargain and Sale Deed"],
  ["LADY BIRD DEED", "Lady Bird Deed"],
  ["ENHANCED LIFE ESTATE DEED", "Lady Bird Deed"],
  ["TRANSFER ON DEATH DEED", "Transfer on Death Deed"],
  ["SHERIFF'S DEED", "Sheriff's Deed"],
  ["SHERIFFS DEED", "Sheriff's Deed"],
  ["TAX DEED", "Tax Deed"],
  ["TRUSTEE DEED", "Trustee's Deed"],
  ["TRUSTEE'S DEED", "Trustee's Deed"],
  ["PERSONAL REPRESENTATIVE DEED", "Personal Representative Deed"],
  ["CORRECTIVE DEED", "Correction Deed"],
  ["CORRECTION DEED", "Correction Deed"],
  ["DEED IN LIEU OF FORECLOSURE", "Deed in Lieu of Foreclosure"],
  ["LIFE ESTATE DEED", "Life Estate Deed"],
  ["JOINT TENANCY DEED", "Joint Tenancy Deed"],
  ["TENANCY IN COMMON DEED", "Tenancy in Common Deed"],
  ["COMMUNITY PROPERTY DEED", "Community Property Deed"],
  ["GIFT DEED", "Gift Deed"],
  ["INTERSPOUSAL TRANSFER DEED", "Interspousal Transfer Deed"],
  ["WILD DEED", "Wild Deed"],
  ["SPECIAL MASTER'S DEED", "Special Master’s Deed"],
  ["SPECIAL MASTERS DEED", "Special Master’s Deed"],
  ["COURT ORDER DEED", "Court Order Deed"],
  ["CONTRACT FOR DEED", "Contract for Deed"],
  ["QUIET TITLE DEED", "Quiet Title Deed"],
  ["ADMINISTRATOR'S DEED", "Administrator's Deed"],
  ["ADMINISTRATOR DEED", "Administrator's Deed"],
  ["ADMINISTRATIVE DEED", "Administrator's Deed"],
  ["GUARDIAN'S DEED", "Guardian's Deed"],
  ["GUARDIAN DEED", "Guardian's Deed"],
  ["RECEIVER'S DEED", "Receiver's Deed"],
  ["RECEIVER DEED", "Receiver's Deed"],
  ["RIGHT OF WAY DEED", "Right of Way Deed"],
  ["VACATION OF PLAT DEED", "Vacation of Plat Deed"],
  ["ASSIGNMENT OF CONTRACT", "Assignment of Contract"],
  ["RELEASE OF CONTRACT", "Release of Contract"],
  ["PROBATE RECORDS", "Personal Representative Deed"],
  ["MISCELLANEOUS", "Miscellaneous"],
]);

const DEED_TYPE_CODE_MAP = new Map([
  ["WD", "Warranty Deed"],
  ["GWD", "Warranty Deed"],
  ["LWD", "Warranty Deed"],
  ["SWD", "Special Warranty Deed"],
  ["QD", "Quitclaim Deed"],
  ["QCD", "Quitclaim Deed"],
  ["GD", "Grant Deed"],
  ["BSD", "Bargain and Sale Deed"],
  ["BASD", "Bargain and Sale Deed"],
  ["LBD", "Lady Bird Deed"],
  ["TOD", "Transfer on Death Deed"],
  ["TODD", "Transfer on Death Deed"],
  ["SD", "Sheriff's Deed"],
  ["TD", "Trustee's Deed"],
  ["TRD", "Trustee's Deed"],
  ["PRD", "Personal Representative Deed"],
  ["CD", "Correction Deed"],
  ["COR", "Correction Deed"],
  ["DIL", "Deed in Lieu of Foreclosure"],
  ["LED", "Life Estate Deed"],
  ["JTD", "Joint Tenancy Deed"],
  ["TIC", "Tenancy in Common Deed"],
  ["CPD", "Community Property Deed"],
  ["GFT", "Gift Deed"],
  ["ITD", "Interspousal Transfer Deed"],
  ["WLD", "Wild Deed"],
  ["SMD", "Special Master’s Deed"],
  ["COD", "Court Order Deed"],
  ["CFD", "Contract for Deed"],
  ["QTD", "Quiet Title Deed"],
  ["ADM", "Administrator's Deed"],
  ["GUD", "Guardian's Deed"],
  ["RCD", "Receiver's Deed"],
  ["RWD", "Right of Way Deed"],
  ["VPD", "Vacation of Plat Deed"],
  ["AOC", "Assignment of Contract"],
  ["ROC", "Release of Contract"],
]);

const DEED_TYPE_REGEX_PATTERNS = [
  { regex: /QUIT[\s-]*CLAIM/, value: "Quitclaim Deed" },
  { regex: /SPECIAL\s+WARRANTY/, value: "Special Warranty Deed" },
  { regex: /WARRANTY/, value: "Warranty Deed" },
  { regex: /GRANT/, value: "Grant Deed" },
  { regex: /BARGAIN\s+AND\s+SALE/, value: "Bargain and Sale Deed" },
  { regex: /LADY\s+BIRD|ENHANCED\s+LIFE\s+ESTATE/, value: "Lady Bird Deed" },
  { regex: /TRANSFER\s+ON\s+DEATH/, value: "Transfer on Death Deed" },
  { regex: /SHERIFF/, value: "Sheriff's Deed" },
  { regex: /TAX\s+DEED/, value: "Tax Deed" },
  { regex: /TRUSTEE/, value: "Trustee's Deed" },
  { regex: /PERSONAL\s+REPRESENTATIVE/, value: "Personal Representative Deed" },
  { regex: /CORRECT(IVE|ION)/, value: "Correction Deed" },
  { regex: /LIFE\s+ESTATE/, value: "Life Estate Deed" },
  { regex: /JOINT\s+TENANCY/, value: "Joint Tenancy Deed" },
  { regex: /TENANCY\s+IN\s+COMMON/, value: "Tenancy in Common Deed" },
  { regex: /COMMUNITY\s+PROPERTY/, value: "Community Property Deed" },
  { regex: /GIFT/, value: "Gift Deed" },
  { regex: /INTERSPOUSAL/, value: "Interspousal Transfer Deed" },
  { regex: /WILD/, value: "Wild Deed" },
  { regex: /SPECIAL\s+MASTER/, value: "Special Master’s Deed" },
  { regex: /COURT\s+ORDER/, value: "Court Order Deed" },
  { regex: /CONTRACT\s+FOR\s+DEED/, value: "Contract for Deed" },
  { regex: /QUIET\s+TITLE/, value: "Quiet Title Deed" },
  { regex: /ADMIN(ISTRATOR|ISTRATIVE)/, value: "Administrator's Deed" },
  { regex: /GUARDIAN/, value: "Guardian's Deed" },
  { regex: /RECEIVER/, value: "Receiver's Deed" },
  { regex: /RIGHT\s+OF\s+WAY/, value: "Right of Way Deed" },
  { regex: /VACATION\s+OF\s+PLAT/, value: "Vacation of Plat Deed" },
  { regex: /ASSIGNMENT\s+OF\s+CONTRACT/, value: "Assignment of Contract" },
  { regex: /RELEASE\s+OF\s+CONTRACT/, value: "Release of Contract" },
];

function mapDeedType(input) {
  if (!input) return null;

  let description = input;
  let code = null;

  if (typeof input === "object") {
    description =
      input.deedDescription ||
      input.deed_description ||
      input.deedTypeDescription ||
      input.deed_type_description ||
      null;
    code =
      input.deedType ||
      input.deed_type ||
      input.deedTypeCode ||
      input.deed_code ||
      null;
  }

  const normalized = description ? normalizeLookupString(description) : "";
  if (normalized && DEED_TYPE_EXACT_MAP.has(normalized)) {
    return DEED_TYPE_EXACT_MAP.get(normalized);
  }

  if (normalized) {
    for (const { regex, value } of DEED_TYPE_REGEX_PATTERNS) {
      if (regex.test(normalized)) return value;
    }
  }

  const codeNormalized = code ? normalizeLookupString(code) : "";
  if (codeNormalized && DEED_TYPE_CODE_MAP.has(codeNormalized)) {
    return DEED_TYPE_CODE_MAP.get(codeNormalized);
  }

  if (normalized && normalized.includes("DEED")) {
    return "Miscellaneous";
  }

  return null;
}

const FILE_DOCUMENT_TYPE_ENUM_VALUES = [
  "Title",
  "ConveyanceDeedQuitClaimDeed",
  "ConveyanceDeedBargainAndSaleDeed",
  "ConveyanceDeedWarrantyDeed",
  "ConveyanceDeed",
  "AssignmentAssignmentOfDeedOfTrust",
  "AssignmentAssignmentOfMortgage",
  "AssignmentAssignmentOfRents",
  "Assignment",
  "AssignmentAssignmentOfTrade",
  "AssignmentBlanketAssignment",
  "AssignmentCooperativeAssignmentOfProprietaryLease",
  "AffidavitOfDeath",
  "AbstractOfJudgment",
  "AttorneyInFactAffidavit",
  "ArticlesOfIncorporation",
  "BuildingPermit",
  "ComplianceInspectionReport",
  "ConditionalCommitment",
  "CounselingCertification",
  "AirportNoisePollutionAgreement",
  "BreachNotice",
  "BrokerPriceOpinion",
  "AmendatoryClause",
  "AssuranceOfCompletion",
  "Bid",
  "BuildersCertificationBuilderCertificationOfPlansAndSpecifications",
  "BuildersCertificationBuildersCertificate",
  "BuildersCertificationPropertyInspection",
  "BuildersCertificationTermiteTreatment",
  "PropertyImage",
];

const FILE_DOCUMENT_TYPE_ENUM_SET = new Set(FILE_DOCUMENT_TYPE_ENUM_VALUES);

const FILE_DOCUMENT_TYPE_EXACT_MAP = new Map([
  ["QUIT CLAIM DEED", "ConveyanceDeedQuitClaimDeed"],
  ["QUITCLAIM DEED", "ConveyanceDeedQuitClaimDeed"],
  ["WARRANTY DEED", "ConveyanceDeedWarrantyDeed"],
  ["GENERAL WARRANTY DEED", "ConveyanceDeedWarrantyDeed"],
  ["SPECIAL WARRANTY DEED", "ConveyanceDeedWarrantyDeed"],
  ["BARGAIN AND SALE DEED", "ConveyanceDeedBargainAndSaleDeed"],
  ["CONVEYANCE DEED", "ConveyanceDeed"],
  ["DEED", "ConveyanceDeed"],
  ["ASSIGNMENT OF DEED OF TRUST", "AssignmentAssignmentOfDeedOfTrust"],
  ["ASSIGNMENT OF MORTGAGE", "AssignmentAssignmentOfMortgage"],
  ["ASSIGNMENT OF RENTS", "AssignmentAssignmentOfRents"],
  ["ASSIGNMENT", "Assignment"],
  ["ASSIGNMENT OF TRADE", "AssignmentAssignmentOfTrade"],
  ["BLANKET ASSIGNMENT", "AssignmentBlanketAssignment"],
  [
    "COOPERATIVE ASSIGNMENT OF PROPRIETARY LEASE",
    "AssignmentCooperativeAssignmentOfProprietaryLease",
  ],
  ["AFFIDAVIT OF DEATH", "AffidavitOfDeath"],
  ["ABSTRACT OF JUDGMENT", "AbstractOfJudgment"],
  ["ATTORNEY IN FACT AFFIDAVIT", "AttorneyInFactAffidavit"],
  ["ARTICLES OF INCORPORATION", "ArticlesOfIncorporation"],
  ["BUILDING PERMIT", "BuildingPermit"],
  ["COMPLIANCE INSPECTION REPORT", "ComplianceInspectionReport"],
  ["CONDITIONAL COMMITMENT", "ConditionalCommitment"],
  ["COUNSELING CERTIFICATION", "CounselingCertification"],
  ["AIRPORT NOISE POLLUTION AGREEMENT", "AirportNoisePollutionAgreement"],
  ["BREACH NOTICE", "BreachNotice"],
  ["BROKER PRICE OPINION", "BrokerPriceOpinion"],
  ["AMENDATORY CLAUSE", "AmendatoryClause"],
  ["ASSURANCE OF COMPLETION", "AssuranceOfCompletion"],
  ["BID", "Bid"],
  [
    "BUILDER'S CERTIFICATION OF PLANS AND SPECIFICATIONS",
    "BuildersCertificationBuilderCertificationOfPlansAndSpecifications",
  ],
  ["BUILDERS CERTIFICATE", "BuildersCertificationBuildersCertificate"],
  [
    "BUILDER'S CERTIFICATE",
    "BuildersCertificationBuildersCertificate",
  ],
  ["BUILDER'S PROPERTY INSPECTION", "BuildersCertificationPropertyInspection"],
  ["PROPERTY INSPECTION", "BuildersCertificationPropertyInspection"],
  ["TERMITE TREATMENT", "BuildersCertificationTermiteTreatment"],
  ["PROPERTY IMAGE", "PropertyImage"],
  ["PROPERTY PHOTO", "PropertyImage"],
  ["PHOTO", "PropertyImage"],
  ["IMAGE", "PropertyImage"],
  ["CERTIFICATE OF TITLE", "Title"],
  ["TITLE", "Title"],
]);

const FILE_DOCUMENT_TYPE_REGEX_PATTERNS = [
  { regex: /QUIT[\s-]*CLAIM/, value: "ConveyanceDeedQuitClaimDeed" },
  { regex: /BARGAIN\s+AND\s+SALE/, value: "ConveyanceDeedBargainAndSaleDeed" },
  { regex: /SPECIAL\s+WARRANTY/, value: "ConveyanceDeedWarrantyDeed" },
  { regex: /WARRANTY/, value: "ConveyanceDeedWarrantyDeed" },
  { regex: /\bDEED\b/, value: "ConveyanceDeed" },
  { regex: /ASSIGNMENT\s+OF\s+DEED\s+OF\s+TRUST/, value: "AssignmentAssignmentOfDeedOfTrust" },
  { regex: /ASSIGNMENT\s+OF\s+MORTGAGE/, value: "AssignmentAssignmentOfMortgage" },
  { regex: /ASSIGNMENT\s+OF\s+RENTS/, value: "AssignmentAssignmentOfRents" },
  { regex: /ASSIGNMENT\s+OF\s+TRADE/, value: "AssignmentAssignmentOfTrade" },
  { regex: /BLANKET\s+ASSIGNMENT/, value: "AssignmentBlanketAssignment" },
  {
    regex: /COOPERATIVE.*ASSIGNMENT.*PROPRIETARY\s+LEASE/,
    value: "AssignmentCooperativeAssignmentOfProprietaryLease",
  },
  { regex: /\bASSIGNMENT\b/, value: "Assignment" },
  { regex: /AFFIDAVIT\s+OF\s+DEATH/, value: "AffidavitOfDeath" },
  { regex: /ABSTRACT\s+OF\s+JUDGMENT/, value: "AbstractOfJudgment" },
  { regex: /ATTORNEY\s+IN\s+FACT\s+AFFIDAVIT/, value: "AttorneyInFactAffidavit" },
  { regex: /ARTICLES\s+OF\s+INCORPORATION/, value: "ArticlesOfIncorporation" },
  { regex: /BUILDING\s+PERMIT/, value: "BuildingPermit" },
  { regex: /COMPLIANCE\s+INSPECTION\s+REPORT/, value: "ComplianceInspectionReport" },
  { regex: /CONDITIONAL\s+COMMITMENT/, value: "ConditionalCommitment" },
  { regex: /COUNSELING\s+CERTIFICATION/, value: "CounselingCertification" },
  { regex: /AIRPORT\s+NOISE|NOISE\s+POLLUTION/, value: "AirportNoisePollutionAgreement" },
  { regex: /BREACH\s+NOTICE/, value: "BreachNotice" },
  { regex: /BROKER\s+PRICE\s+OPINION/, value: "BrokerPriceOpinion" },
  { regex: /AMENDATORY\s+CLAUSE/, value: "AmendatoryClause" },
  { regex: /ASSURANCE\s+OF\s+COMPLETION/, value: "AssuranceOfCompletion" },
  { regex: /\bBID\b/, value: "Bid" },
  {
    regex: /BUILDER'?S\s+CERTIFICATION\s+OF\s+PLANS\s+AND\s+SPECIFICATIONS/,
    value: "BuildersCertificationBuilderCertificationOfPlansAndSpecifications",
  },
  { regex: /BUILDER'?S?\s+CERTIFIC(ATE|ATION)/, value: "BuildersCertificationBuildersCertificate" },
  { regex: /PROPERTY\s+INSPECTION/, value: "BuildersCertificationPropertyInspection" },
  { regex: /TERMITE/, value: "BuildersCertificationTermiteTreatment" },
  { regex: /\bTITLE\b/, value: "Title" },
  { regex: /PHOTO|IMAGE/, value: "PropertyImage" },
];

function mapFileDocumentType(input) {
  if (!input) return null;
  if (typeof input === "string" && FILE_DOCUMENT_TYPE_ENUM_SET.has(input)) {
    return input;
  }

  const normalized = normalizeLookupString(input);
  if (!normalized) return null;

  if (FILE_DOCUMENT_TYPE_EXACT_MAP.has(normalized)) {
    return FILE_DOCUMENT_TYPE_EXACT_MAP.get(normalized);
  }

  for (const { regex, value } of FILE_DOCUMENT_TYPE_REGEX_PATTERNS) {
    if (regex.test(normalized)) {
      return value;
    }
  }

  return null;
}

// MODIFIED: mapSaleType to match new enum values
function mapSaleType(code) {
  const t = String(code || "").trim().toUpperCase();
  if (!t) return null;

  switch (t) {
    case "SQ":
      return "TypicallyMotivated"; // Assuming "Qualified" maps to "TypicallyMotivated"
    case "UQ":
      return null; // "Unqualified" doesn't have a direct match, setting to null
    case "FD":
      return "ReoPostForeclosureSale"; // Assuming "Foreclosure" maps to "ReoPostForeclosureSale"
    case "PROBATE SALE":
      return "ProbateSale";
    case "SHORT SALE":
      return "ShortSale";
    case "COURT ORDERED NON-FORECLOSURE SALE":
      return "CourtOrderedNonForeclosureSale";
    case "REO POST-FORECLOSURE SALE":
      return "ReoPostForeclosureSale";
    case "TRUSTEE NON-JUDICIAL FORECLOSURE SALE":
      return "TrusteeNonJudicialForeclosureSale";
    case "RELOCATION SALE":
      return "RelocationSale";
    case "TRUSTEE JUDICIAL FORECLOSURE SALE":
      return "TrusteeJudicialForeclosureSale";
    case "TYPICALLY MOTIVATED":
      return "TypicallyMotivated";
    default:
      return "TypicallyMotivated"; // Default to null if no match
  }
}

// NEW FUNCTION: mapPublicUtilityType
function mapPublicUtilityType(src) {
  if (!src) return null;
  const t = String(src).trim().toUpperCase();
  if (t.includes("WATER")) return "WaterAvailable";
  if (t.includes("ELECTRICITY") || t.includes("POWER")) return "ElectricityAvailable";
  if (t.includes("SEWER")) return "SewerAvailable";
  if (t.includes("NATURAL GAS") || t.includes("GAS")) return "NaturalGasAvailable";
  if (t.includes("CABLE")) return "CableAvailable";
  if (t.includes("UNDERGROUND UTILITIES")) return "UndergroundUtilities";
  return null;
}

// NEW FUNCTION: mapLotType
function mapLotType(src, lotAcre) {
  // The enum values are: GreaterThanOneQuarterAcre, PavedRoad, LessThanOrEqualToOneQuarterAcre
  // This mapping is highly dependent on the actual content of primaryLand.method
  // and how it relates to these specific enum values.
  // Assuming 'src' (primaryLand.method) might contain descriptive text.

  // Prioritize based on lotAcre if available and relevant
  if (typeof lotAcre === 'number') {
    if (lotAcre > 0.25) return "GreaterThanOneQuarterAcre";
    if (lotAcre <= 0.25) return "LessThanOrEqualToOneQuarterAcre";
  }

  if (!src) return null;
  const t = String(src).trim().toUpperCase();

  // Fallback to method description for other types
  if (t.includes("PAVED ROAD")) return "PavedRoad";
  // Add more specific mappings if primaryLand.method has other relevant values
  return null;
}

const FLOOR_LEVEL_ENUM = new Set(["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"]);

const FLOOR_LEVEL_ALIAS_MAP = new Map([
  ["first floor", "1st Floor"],
  ["second floor", "2nd Floor"],
  ["third floor", "3rd Floor"],
  ["fourth floor", "4th Floor"],
]);

const SPACE_TYPE_ENUM = new Set([
  "Attached Garage",
  "Bedroom",
  "Building",
  "Carport",
  "Enclosed Porch",
  "Floor",
  "Full Bathroom",
  "Half Bathroom / Powder Room",
  "Kitchen",
  "Living Room",
  "Patio",
  "Porch",
  "Storage Room",
  "Utility Closet",
]);

const SPACE_TYPE_ALIAS_MAP = new Map([
  ["attached garage", "Attached Garage"],
  ["bedroom", "Bedroom"],
  ["building", "Building"],
  ["carport", "Carport"],
  ["enclosed porch", "Enclosed Porch"],
  ["floor", "Floor"],
  ["full bathroom", "Full Bathroom"],
  ["garage", "Attached Garage"],
  ["half bathroom", "Half Bathroom / Powder Room"],
  ["half bathroom / powder room", "Half Bathroom / Powder Room"],
  ["kitchen", "Kitchen"],
  ["living room", "Living Room"],
  ["patio", "Patio"],
  ["porch", "Porch"],
  ["storage room", "Storage Room"],
  ["utility closet", "Utility Closet"],
  ["utility room", "Utility Closet"],
]);

const EXTERIOR_WALL_SECONDARY_ENUM = new Set([
  "Brick Accent",
  "Decorative Block",
  "Metal Trim",
  "Stone Accent",
  "Stucco Accent",
  "Vinyl Accent",
  "Wood Trim",
]);

function coerceBoolean(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function normalizeFloorLevel(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded >= 1 && rounded <= 4) {
      return ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"][rounded - 1];
    }
    return null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (FLOOR_LEVEL_ENUM.has(raw)) return raw;
  const alias = FLOOR_LEVEL_ALIAS_MAP.get(raw.toLowerCase());
  if (alias) return alias;
  const upper = raw.toUpperCase();
  const ordinalMatch = upper.match(/^(\d)(?:ST|ND|RD|TH)?\s*FLOOR$/);
  if (ordinalMatch) {
    return normalizeFloorLevel(Number(ordinalMatch[1]));
  }
  const levelMatch = upper.match(/^LEVEL\s*(\d)$/);
  if (levelMatch) {
    return normalizeFloorLevel(Number(levelMatch[1]));
  }
  return null;
}

function normalizeSpaceType(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const alias = SPACE_TYPE_ALIAS_MAP.get(raw.toLowerCase()) ?? raw;
  return SPACE_TYPE_ENUM.has(alias) ? alias : null;
}

function sanitizeStructureRecord(record) {
  if (!record || typeof record !== "object") return record;
  if (!EXTERIOR_WALL_SECONDARY_ENUM.has(record.exterior_wall_material_secondary)) {
    record.exterior_wall_material_secondary = null;
  }
  return record;
}

function mapImprovementType(description, code) {
  const desc = String(description || "").toUpperCase();
  if (desc) {
    if (desc.includes("REROOF") || desc.includes("ROOF")) return "Roofing";
    if (desc.includes("POOL") || desc.includes("SPA")) return "PoolSpaInstallation";
    if (desc.includes("SCREEN")) return "ScreenEnclosure";
    if (desc.includes("IRRIG")) return "LandscapeIrrigation";
    if (desc.includes("FENCE")) return "Fencing";
    if (desc.includes("SHUTTER") || desc.includes("AWNING")) return "ShutterAwning";
    if (desc.includes("WINDOW") || desc.includes("DOOR")) return "ExteriorOpeningsAndFinishes";
    if (desc.includes("HVAC") || desc.includes("A/C") || desc.includes("AIR CONDITIONER") || desc.includes("MECHANICAL"))
      return "MechanicalHVAC";
    if (desc.includes("ELECT")) return "Electrical";
    if (desc.includes("PLUMB")) return "Plumbing";
    if (desc.includes("GAS")) return "GasInstallation";
    if (desc.includes("DEMOL")) return "Demolition";
    if (desc.includes("ADDITION") || desc.includes("ADD-ON")) return "BuildingAddition";
    if (desc.includes("SINGLE FAMILY") || desc.includes("DWELLING") || desc.includes("RESIDENTIAL") || desc.includes("NEW HOME"))
      return "ResidentialConstruction";
    if (desc.includes("COMMERCIAL")) return "CommercialConstruction";
    if (desc.includes("DRIVEWAY") || desc.includes("PAVER") || desc.includes("SITE"))
      return "SiteDevelopment";
  }

  const codeKey = String(code || "").trim().toUpperCase();
  if (!desc) {
    if (codeKey === "A") return "ResidentialConstruction";
  }
  return null;
}

function mapImprovementStatus(statusCode) {
  const code = String(statusCode || "").trim();
  if (!code) return null;
  if (code === "07") return "Completed";
  return null;
}

function mapImprovementAction(description) {
  const desc = String(description || "").toUpperCase();
  if (!desc) return null;
  if (/\bNEW\b/.test(desc) || desc.includes("SINGLE FAMILY") || desc.includes("NEW HOME") || desc.includes("DWELLING"))
    return "New";
  if (desc.includes("REROOF") || desc.includes("RE-ROOF") || desc.includes("REPLACE") || desc.includes("REPLACEMENT"))
    return "Replacement";
  if (desc.includes("REPAIR")) return "Repair";
  if (desc.includes("ADDITION") || desc.includes("ADD-ON")) return "Addition";
  if (desc.includes("DEMOL") || desc.includes("REMOVE")) return "Remove";
  return null;
}

function extractBuildingNumber(source, fallback = null) {
  if (!source || typeof source !== "object") return fallback;
  const candidates = [
    "building_number",
    "buildingNumber",
    "building_no",
    "buildingNo",
    "building_index",
    "buildingIndex",
    "bldg_number",
    "bldgNumber",
    "bldg_no",
    "structure_number",
    "structureNumber",
  ];
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const raw = source[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
      if (typeof raw === "string") {
        const match = raw.match(/\d+/);
        if (match) {
          const parsed = Number(match[0]);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    }
  }
  return fallback;
}


function inferFileFormatFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const base = u.pathname.toLowerCase();
    if (base.endsWith(".jpg") || base.endsWith(".jpeg")) return "jpeg";
    if (base.endsWith(".png")) return "png";
    if (base.endsWith(".txt")) return "txt";
    return null;
  } catch {
    return null;
  }
}

function basenameFromUrl(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/");
    return segs[segs.length - 1] || url;
  } catch {
    return String(url);
  }
}

function cleanupGeneratedFiles(patterns) {
  const files = listDirSafe("data");
  files.forEach((fn) => {
    if (patterns.some((re) => re.test(fn))) {
      try {
        fs.unlinkSync(path.join("data", fn));
      } catch {}
    }
  });
}

function cleanupLegacyArtifacts() {
  cleanupGeneratedFiles([
    /^relationship_sales_person/i,
    /^relationship_sales_company/i,
    /^relationship_sales_history_has_person/i,
    /^relationship_sales_history_has_company/i,
    /^relationship_sales_deed/i,
    /^relationship_sales_history_has_deed/i,
    /^relationship_property_has_sales_history/i,
    /^relationship_layout_has_layout_/i,
    /^relationship_layout_has_structure_/i,
    /^relationship_layout_has_utility_/i,
    /^relationship_person_has_address_/i,
    /^relationship_company_has_address_/i,
    /^relationship_property_has_address\.json$/i,
    /^person_\d+\.json$/i,
    /^company_\d+\.json$/i,
    /^layout_\d+\.json$/i,
    /^mailing_address\.json$/i,
    /^property_improvement_\d+\.json$/i,
    /^relationship_property_has_property_improvement_/i,
    // Add new patterns for utility_*.json and structure_*.json if they were previously named differently
    /^utility_\d+\.json$/i,
    /^utility\.json$/i,
    /^structure_\d+\.json$/i,
    /^structure\.json$/i,
    /^relationship_property_has_utility_\d+\.json$/i,
    /^relationship_property_has_structure_\d+\.json$/i,
    // Clean up relationship files that might have had an index incorrectly
    /^relationship_property_has_address_\d+\.json$/i,
    /^relationship_property_has_lot_\d+\.json$/i,
    /^relationship_property_has_flood_storm_information_\d+\.json$/i,
    /^relationship_sales_history_\d+_has_deed_\d+\.json$/i, // Specific for sales history to deed
    // New cleanup for the strict naming convention
    /^relationship_.*_has_.*_\d+\.json$/i, // Catch any relationship file with an index
  ]);
}

function shouldLinkSaleToCurrentOwners(s) {
  const vacImp = String(s.vacImp || "").toUpperCase();
  const vacImpDesc = String(s.vacImpDesc || "").toUpperCase();
  const qual = String(s.qualificationCode || "").trim();
  const deedDesc = String(s.deedDescription || "").toUpperCase();
  if (vacImp === "V" || vacImpDesc === "VACANT") return false;
  if (qual === "18") return false;
  return true;
}

function parseYearTokens(raw) {
  const str = String(raw || "").trim();
  if (!str) return { built: null, effective: null };
  const matches = str.match(/\d{4}/g);
  if (!matches) return { built: null, effective: null };
  const built = Number.parseInt(matches[0], 10);
  const effective =
    matches.length > 1 ? Number.parseInt(matches[1], 10) : null;
  return {
    built: Number.isFinite(built) ? built : null,
    effective: Number.isFinite(effective) ? effective : null,
  };
}

function normalizeAddressString(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\r?\n/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ", ")
    .replace(/,\s*$/, "")
    .trim();
}

const USPS_SUFFIX_MAP = {
  ALLEY: "Aly", ALY: "Aly", ANEX: "Anx", ANNEX: "Anx", ANX: "Anx", ARCADE: "Arc", ARC: "Arc", AVENUE: "Ave", AV: "Ave", AVE: "Ave", BAYOU: "Byu", BYU: "Byu", BEACH: "Bch", BCH: "Bch", BEND: "Bnd", BND: "Bnd", BLUFF: "Blf", BLF: "Blf", BLUFFS: "Blfs", BLFS: "Blfs", BOTTOM: "Btm", BTM: "Btm", BOULEVARD: "Blvd", BLVD: "Blvd", BRANCH: "Br", BR: "Br", BRIDGE: "Brg", BRG: "Brg", BROOK: "Brk", BRK: "Brk", BROOKS: "Brks", BRKS: "Brks", BURG: "Bg", BG: "Bg", BYPASS: "Byp", BYP: "Byp", CAMP: "Cp", CP: "Cp", CANYON: "Cyn", CYN: "Cyn", CAPE: "Cpe", CPE: "Cpe", CAUSEWAY: "Cswy", CSWY: "Cswy", CENTER: "Ctr", CTR: "Ctr", CENTERS: "Ctrs", CTRS: "Ctrs", CIRCLE: "Cir", CIR: "Cir", CIRCLES: "Cirs", CIRS: "Cirs", CLIFF: "Clf", CLF: "Clf", CLIFFS: "Clfs", CLFS: "Clfs", CLUB: "Clb", CLB: "Clb", COMMON: "Cmn", CMN: "Cmn", COMMONS: "Cmns", CMNS: "Cmns", CORNER: "Cor", COR: "Cor", CORNERS: "Cors", CORS: "Cors", COURSE: "Crse", CRSE: "Crse", COURT: "Ct", CT: "Ct", COURTS: "Cts", CTS: "Cts", COVE: "Cv", CV: "Cv", COVES: "Cvs", CVS: "Cvs", CREEK: "Crk", CRK: "Crk", CRESCENT: "Cres", CRES: "Cres", CREST: "Crst", CRST: "Crst", CROSSING: "Xing", XING: "Xing", CROSSROAD: "Xrd", XRD: "Xrd", CROSSROADS: "Xrds", XRDS: "Xrds", CURVE: "Curv", CURV: "Curv", DALE: "Dl", DL: "Dl", DAM: "Dm", DM: "Dm", DIVIDE: "Dv", DV: "Dv", DRIVE: "Dr", DR: "Dr", DRIVES: "Drs", DRS: "Drs", ESTATE: "Est", EST: "Est", ESTATES: "Ests", ESTS: "Ests", EXPRESSWAY: "Expy", EXPY: "Expy", EXTENSION: "Ext", EXT: "Ext", EXTENSIONS: "Exts", EXTS: "Exts", FALL: "Fall", FALL: "Fall", FALLS: "Fls", FLS: "Fls", FERRY: "Fry", FRY: "Fry", FIELD: "Fld", FLD: "Fld", FIELDS: "Flds", FLDS: "Flds", FLAT: "Flt", FLT: "Flt", FLATS: "Flts", FLTS: "Flts", FORD: "Frd", FRD: "Frd", FORDS: "Frds", FRDS: "Frds", FOREST: "Frst", FRST: "Frst", FORGE: "Frg", FRG: "Frg", FORGES: "Frgs", FRGS: "Frgs", FORK: "Frk", FRK: "Frk", FORKS: "Frks", FRKS: "Frks", FORT: "Ft", FT: "Ft", FREEWAY: "Fwy", FWY: "Fwy", GARDEN: "Gdn", GDN: "Gdn", GARDENS: "Gdns", GDNS: "Gdns", GATEWAY: "Gtwy", GTWY: "Gtwy", GLEN: "Gln", GLN: "Gln", GLENS: "Glns", GLNS: "Glns", GREEN: "Grn", GRN: "Grn", GREENS: "Grns", GRNS: "Grns", GROVE: "Grv", GRV: "Grv", GROVES: "Grvs", GRVS: "Grvs", HARBOR: "Hbr", HBR: "Hbr", HARBORS: "Hbrs", HBRS: "Hbrs", HAVEN: "Hvn", HVN: "Hvn", HEIGHTS: "Hts", HTS: "Hts", HIGHWAY: "Hwy", HWY: "Hwy", HILL: "Hl", HL: "Hl", HILLS: "Hls", HLS: "Hls", HOLLOW: "Holw", HOLW: "Holw", INLET: "Inlt", INLT: "Inlt", ISLAND: "Is", IS: "Is", ISLANDS: "Iss", ISS: "Iss", ISLE: "Isle", ISLE: "Isle", JUNCTION: "Jct", JCT: "Jct", JUNCTIONS: "Jcts", JCTS: "Jcts", KEY: "Ky", KY: "Ky", KEYS: "Kys", KYS: "Kys", KNOLL: "Knl", KNL: "Knl", KNOLLS: "Knls", KNLS: "Knls", LAKE: "Lk", LK: "Lk", LAKES: "Lks", LKS: "Lks", LAND: "Land", LAND: "Land", LANDING: "Lndg", LNDG: "Lndg", LANE: "Ln", LN: "Ln", LIGHT: "Lgt", LGT: "Lgt", LIGHTS: "Lgts", LGTS: "Lgts", LOCK: "Lck", LCK: "Lck", LOCKS: "Lcks", LCKS: "Lcks", LODGE: "Ldg", LDG: "Ldg", LOOP: "Loop", LOOP: "Loop", MALL: "Mall", MALL: "Mall", MANOR: "Mnr", MNR: "Mnr", MANORS: "Mnrs", MNRS: "Mnrs", MEADOW: "Mdw", MDW: "Mdw", MEADOWS: "Mdws", MDWS: "Mdws", MEWS: "Mews", MEWS: "Mews", MILL: "Ml", ML: "Ml", MILLS: "Mls", MLS: "Mls", MISSION: "Msn", MSN: "Msn", MOTORWAY: "Mtwy", MTWY: "Mtwy", MOUNT: "Mt", MT: "Mt", MOUNTAIN: "Mtn", MTN: "Mtn", MOUNTAINS: "Mtns", MTNS: "Mtns", NECK: "Nck", NCK: "Nck", ORCHARD: "Orch", ORCH: "Orch", OVAL: "Oval", OVAL: "Oval", OVERPASS: "Opas", OPAS: "Opas", PARK: "Park", PARK: "Park", PARKS: "Prk", PRK: "Prk", PARKWAY: "Pkwy", PKWY: "Pkwy", PASS: "Pass", PASS: "Pass", PASSAGE: "Psge", PSGE: "Psge", PATH: "Path", PATH: "Path", PIKE: "Pike", PIKE: "Pike", PINE: "Pne", PNE: "Pne", PINES: "Pnes", PNES: "Pnes", PLACE: "Pl", PL: "Pl", PLAIN: "Pln", PLN: "Pln", PLAINS: "Plns", PLNS: "Plns", PLAZA: "Plz", PLZ: "Plz", POINT: "Pt", PT: "Pt", POINTS: "Pts", PTS: "Pts", PORT: "Prt", PRT: "Prt", PORTS: "Prts", PRTS: "Prts", PRAIRIE: "Pr", PR: "Pr", RADIAL: "Radl", RADL: "Radl", RAMP: "Ramp", RAMP: "Ramp", RANCH: "Rnch", RNCH: "Rnch", RAPID: "Rpd", RPD: "Rpd", RAPIDS: "Rpds", RPDS: "Rpds", REST: "Rst", RST: "Rst", RIDGE: "Rdg", RDG: "Rdg", RIDGES: "Rdgs", RDGS: "Rdgs", RIVER: "Riv", RIV: "Riv", ROAD: "Rd", RD: "Rd", ROADS: "Rds", RDS: "Rds", ROUTE: "Rte", RTE: "Rte", ROW: "Row", ROW: "Row", RUE: "Rue", RUE: "Rue", RUN: "Run", RUN: "Run", SHOAL: "Shl", SHL: "Shl", SHOALS: "Shls", SHLS: "Shls", SHORE: "Shr", SHR: "Shr", SHORES: "Shrs", SHRS: "Shrs", SKYWAY: "Skwy", SKWY: "Skwy", SPRING: "Spg", SPG: "Spg", SPRINGS: "Spgs", SPGS: "Spgs", SPUR: "Spur", SPUR: "Spur", SQUARE: "Sq", SQ: "Sq", SQUARES: "Sqs", SQS: "Sqs", STATION: "Sta", STA: "Sta", STRAVENUE: "Stra", STRA: "Stra", STREAM: "Strm", STRM: "Strm", STREET: "St", ST: "St", STREETS: "Sts", STS: "Sts", SUMMIT: "Smt", SMT: "Smt", TERRACE: "Ter", TER: "Ter", THROUGHWAY: "Trwy", TRWY: "Trwy", TRACE: "Trce", TRCE: "Trce", TRACK: "Trak", TRAK: "Trak", TRAFFICWAY: "Trfy", TRFY: "Trfy", TRAIL: "Trl", TRL: "Trl", TRAILER: "Trlr", TRLR: "Trlr", TUNNEL: "Tunl", TUNL: "Tunl", TURNPIKE: "Tpke", TPKE: "Tpke", UNDERPASS: "Upas", UPAS: "Upas", UNION: "Un", UN: "Un", UNIONS: "Uns", UNS: "Uns", VALLEY: "Vly", VLY: "Vly", VALLEYS: "Vlys", VLYS: "VLYS", VIADUCT: "Via", VIA: "Via", VIEW: "Vw", VW: "Vw", VIEWS: "Vws", VWS: "Vws", VILLAGE: "Vlg", VLG: "Vlg", VILLAGES: "Vlgs", VLGS: "Vlgs", VILLE: "Vl", VL: "Vl", VISTA: "Vis", VIS: "Vis", WALK: "Walk", WALK: "Walk", WALL: "Wall", WALL: "Wall", WAY: "Way", WAY: "Way", WAYS: "Ways", WAYS: "Ways", WELL: "Wl", WL: "Wl", WELLS: "Wls", WLS: "Wls",
};

function parseAddressComponents(fullAddr, plus4Source) {
  const normalized = normalizeAddressString(fullAddr);
  if (!normalized) return null;

  let streetNumber = null;
  let streetName = null;
  let streetPreDirectional = null;
  let streetPostDirectional = null;
  let suffix = null;
  let city = null;
  let state = null;
  let zip = null;
  let plus4 = null;

  try {
    const parts = normalized.split(",").map((p) => p.trim()).filter(Boolean);
    const line1 = parts[0] || "";
    let restCity = parts.length >= 2 ? parts[1] : "";
    let restStateZip = parts.length >= 3 ? parts.slice(2).join(" ") : "";

    if (!restStateZip && restCity) {
      const cityStateZipMatch = restCity.match(
        /^(.*)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
      );
      if (cityStateZipMatch) {
        restCity = cityStateZipMatch[1];
        restStateZip = `${cityStateZipMatch[2]} ${cityStateZipMatch[3]}`;
      }
    }

    const addressRegex =
      /^((\d+)\s+)?((N|S|E|W|NE|NW|SE|SW)\s+)?(.+?)\s+(ALLEY|ALY|ANEX|ANNEX|ANX|ARCADE|ARC|AVENUE|AV|AVE|BAYOU|BYU|BEACH|BCH|BEND|BND|BLUFF|BLF|BLUFFS|BLFS|BOTTOM|BTM|BOULEVARD|BLVD|BRANCH|BR|BRIDGE|BRG|BROOK|BRK|BROOKS|BRKS|BURG|BG|BYPASS|BYP|CAMP|CP|CANYON|CYN|CAPE|CPE|CAUSEWAY|CSWY|CENTER|CTR|CENTERS|CTRS|CIRCLE|CIR|CIRCLES|CIRS|CLIFF|CLF|CLIFFS|CLFS|CLUB|CLB|COMMON|CMN|COMMONS|CMNS|CORNER|COR|CORNERS|CORS|COURSE|CRSE|COURT|Ct|COURTS|CTS|COVE|Cv|COVES|CVS|CREEK|Crk|CRESCENT|Cres|CREST|Crst|CROSSING|Xing|CROSSROAD|Xrd|CROSSROADS|Xrds|CURVE|Curv|DALE|Dl|DAM|Dm|DIVIDE|Dv|DRIVE|Dr|DRIVES|Drs|ESTATE|Est|ESTATES|Ests|EXPRESSWAY|Expy|EXTENSION|Ext|EXTENSIONS|Exts|FALL|Fall|FALLS|Fls|FERRY|Fry|FIELD|Fld|FIELDS|Flds|FLAT|Flt|FLATS|Flts|FORD|Frd|FORDS|Frds|FOREST|Frst|FORGE|Frg|FORGES|Frgs|FORK|Frk|FORKS|Frks|FORT|Ft|FREEWAY|Fwy|GARDEN|Gdn|GARDENS|Gdns|GATEWAY|Gtwy|GLEN|Gln|GLENS|Glns|GREEN|Grn|GREENS|Grns|GROVE|Grv|GROVES|Grvs|HARBOR|Hbr|HARBORS|Hbrs|HAVEN|Hvn|HEIGHTS|Hts|HIGHWAY|Hwy|HILL|Hl|HILLS|Hls|HOLLOW|Holw|INLET|Inlt|ISLAND|Is|ISLANDS|Iss|ISLE|Junction|Jct|JUNCTIONS|Jcts|KEY|Ky|KEYS|Kys|KNOLL|Knl|KNOLLS|Knls|LAKE|Lk|LAKES|Lks|LAND|LANDING|Lndg|LANE|Ln|LIGHT|Lgt|LIGHTS|Lgts|LOCK|Lck|LOCKS|Lcks|LODGE|Ldg|LOOP|MALL|MANOR|Mnr|MANORS|Mnrs|MEADOW|Mdw|MEADOWS|Mdws|MEWS|MILL|Ml|MILLS|Mls|MISSION|Msn|MOTORWAY|Mtwy|MOUNT|Mt|MOUNTAIN|Mtn|MOUNTAINS|Mtns|NECK|Nck|ORCHARD|Orch|OVAL|OVERPASS|Opas|PARK|PARKS|Prk|PARKWAY|Pkwy|PASS|PASSAGE|Psge|PATH|PIKE|PINE|Pne|PINES|Pnes|PLACE|Pl|PLAIN|Pln|PLAINS|Plns|PLAZA|Plz|POINT|Pt|POINTS|Pts|PORT|Prt|PORTS|Prts|PRAIRIE|Pr|RADIAL|Radl|RAMP|Ranch|Rnch|RAPID|Rpd|RAPIDS|Rpds|REST|Rst|RIDGE|Rdg|RIDGES|Rdgs|RIVER|Riv|ROAD|Rd|ROADS|Rds|ROUTE|Rte|ROW|RUE|RUN|SHOAL|Shl|SHOALS|Shls|SHORE|Shr|SHORES|Shrs|SKYWAY|Skwy|SPRING|Spg|SPRINGS|Spgs|SPUR|SQUARE|Sq|SQUARES|Sqs|STATION|Sta|STRAVENUE|Stra|STREAM|Strm|STREET|St|STREETS|Sts|SUMMIT|Smt|TERRACE|Ter|THROUGHWAY|Trwy|TRACE|Trce|TRACK|Trak|TRAFFICWAY|Trfy|TRAIL|Trl|TRAILER|Trlr|TUNNEL|Tunl|TURNPIKE|Tpke|UNDERPASS|Upas|UNION|Un|UNIONS|Uns|VALLEY|Vly|VALLEYS|Vlys|VIADUCT|Via|VIEW|Vw|VIEWS|Vws|VILLAGE|Vlg|VILLAGES|Vlgs|VILLE|Vl|VISTA|Vis|WALK|WALL|WAY|WAYS|WELL|Wl|WELLS|Wls)\s*((N|S|E|W|NE|NW|SE|SW)\s*)?$/i;

    const match = line1.match(addressRegex);

    if (match) {
      streetNumber = match[2] || null;
      streetPreDirectional = (match[4] || "").toUpperCase() || null;
      streetName = match[5] || null;
      suffix = (match[6] || "").toUpperCase() || null;
      streetPostDirectional = (match[8] || "").toUpperCase() || null;

      if (streetName) {
        streetName = streetName.replace(/\b(N|S|E|W|NE|NW|SE|SW)\b/gi, "").trim();
      }
    } else {
      const line1Tokens = line1.split(/\s+/);
      if (line1Tokens.length >= 2) {
        streetNumber = line1Tokens[0];
        const lastToken = line1Tokens[line1Tokens.length - 1].toUpperCase();
        const secondLastToken =
          line1Tokens.length > 1
            ? line1Tokens[line1Tokens.length - 2].toUpperCase()
            : null;

        const directionals = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
        if (directionals.includes(lastToken)) {
          streetPostDirectional = lastToken;
          suffix = secondLastToken;
          streetName = line1Tokens.slice(1, -2).join(" ");
        } else {
          suffix = lastToken;
          streetName = line1Tokens.slice(1, -1).join(" ");
        }

        const firstStreetNameToken = String(streetName || "")
          .split(/\s+/)[0]
          .toUpperCase();
        if (directionals.includes(firstStreetNameToken)) {
          streetPreDirectional = firstStreetNameToken;
          streetName = String(streetName || "")
            .substring(firstStreetNameToken.length)
            .trim();
        }
      } else if (line1Tokens.length === 1) {
        streetName = line1Tokens[0];
      }
    }

    city = restCity ? restCity.toUpperCase() : null;
    if (restStateZip) {
      const stZip = restStateZip.split(/\s+/).filter(Boolean);
      state = stZip[0] || null;
      zip = stZip[1] || null;
      if (!zip && stZip.length > 1) {
        zip = stZip.slice(1).join("").replace(/[^\d-]/g, "") || null;
      }
    }

    const sourceForZip = plus4Source || normalized;
    const plus4Match = String(sourceForZip).match(/\b(\d{5})-(\d{4})\b/);
    if (plus4Match) {
      plus4 = plus4Match[2];
      if (!zip) zip = plus4Match[1];
    } else if (!zip) {
      const zipMatch = normalized.match(/\b(\d{5})(?:-(\d{4}))?\b/);
      if (zipMatch) {
        zip = zipMatch[1];
        if (zipMatch[2]) plus4 = zipMatch[2];
      }
    }
  } catch (e) {
    // fall through with whatever values were set
  }

  if (zip) {
    const basicZipMatch = String(zip).match(/^(\d{5})(?:-(\d{4}))?$/);
    if (basicZipMatch) {
      zip = basicZipMatch[1];
      if (!plus4 && basicZipMatch[2]) plus4 = basicZipMatch[2];
    }
  }

  const suffixEnum = suffix
    ? USPS_SUFFIX_MAP[String(suffix).toUpperCase()] || null
    : null;

  return {
    streetNumber: streetNumber || null,
    streetPreDirectional: streetPreDirectional || null,
    streetName: streetName ? streetName.trim() || null : null,
    streetSuffix: suffixEnum,
    streetPostDirectional: streetPostDirectional || null,
    city: city || null,
    state: state || null,
    postal_code: zip || null, // Changed from zip to postal_code for consistency with output
    plus4: plus4 || null,
    normalized,
  };
}


// Property mapping data - UPDATED TO USE NUMERIC DOR
const propertyMapping = [
  // RESIDENTIAL
  {
    "dor_code": "00",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "0030", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialWaterfront",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "0003", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "TownhouseRowhouse", // Assuming vacant townhome implies future townhouse
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "0004", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit", // Assuming vacant condominium implies future unit
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "0005", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand", // PUD under development is still vacant land until built
    "structure_form": null,
    "property_usage_type": "PlannedUnitDevelopment",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "0011", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved", // Sign site/Cell Tower implies improvement
    "structure_form": null,
    "property_usage_type": "Residential", // Context implies it's on residential land
    "property_type": "Other" // Or "Structure" if that's an option
  },
  {
    "dor_code": "0040", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "01",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0102", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0103", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0107", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0108", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0112", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0130", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "ResidentialWaterfront",
    "property_type": "Building"
  },
  {
    "dor_code": "0135", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "ResidentialWaterfront", // Assuming waterview is a type of waterfront
    "property_type": "Building"
  },
  {
    "dor_code": "0140", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0150", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "AgriculturalResidential",
    "property_type": "Building"
  },
  {
    "dor_code": "0160", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "ResidentialGolfCourse",
    "property_type": "Building"
  },
  {
    "dor_code": "0161", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "ResidentialGolfCourse",
    "property_type": "Building"
  },
  {
    "dor_code": "02",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "dor_code": "0230", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "ResidentialWaterfront",
    "property_type": "ManufacturedHome"
  },
  {
    "dor_code": "0250", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "AgriculturalResidential",
    "property_type": "ManufacturedHome"
  },
  {
    "dor_code": "03",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10", // "10 or more" implies 10+
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0304", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10", // Apartment Condo Conversion
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "04",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "dor_code": "0403", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "dor_code": "05",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "dor_code": "06",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null, // Could be various forms
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "dor_code": "07",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null, // "Miscellaneous Residential (Typically used for barns)"
    "property_usage_type": "Residential", // Or "Agricultural" if barn is primary
    "property_type": "Building" // Or "OtherStructure"
  },
  {
    "dor_code": "0730", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialWaterfront",
    "property_type": "Building"
  },
  {
    "dor_code": "0740", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0802", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0803", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0804", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0805", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0806", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0807", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0808", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "0809", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "dor_code": "09",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved", // Common elements can be improved (e.g., clubhouses, pools)
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel" // Or "Building" if it's a clubhouse
  },

  // COMMERCIAL
  {
    "dor_code": "10",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1001", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Office",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1002", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1003", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1004", // New
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Office",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1005", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1010", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MultiFamily",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1011", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Other"
  },
  {
    "dor_code": "1012", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Other"
  },
  {
    "dor_code": "1013", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand", // "with site improvements" still vacant land for building
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1015", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PlannedUnitDevelopment",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "1020", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "11",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1100", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1101", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1102", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1103", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ConvenienceStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1104", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ConvenienceStoreWithGas",
    "property_type": "Building"
  },
  {
    "dor_code": "1105", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "dor_code": "12",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial", // "Residential Structure on Comm Land"
    "property_type": "Building"
  },
  {
    "dor_code": "13",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1301", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "dor_code": "1302", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DiscountStore",
    "property_type": "Building"
  },
  {
    "dor_code": "14",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "dor_code": "15",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "dor_code": "1501", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "dor_code": "16",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity", // Anchored
    "property_type": "Building"
  },
  {
    "dor_code": "1601", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity", // Unanchored
    "property_type": "Building"
  },
  {
    "dor_code": "1602", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterPower",
    "property_type": "Building"
  },
  {
    "dor_code": "1603", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterTown",
    "property_type": "Building"
  },
  {
    "dor_code": "1612", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MixedUse",
    "property_type": "Building"
  },
  {
    "dor_code": "17",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1701", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1702", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FlexSpace",
    "property_type": "Building"
  },
  {
    "dor_code": "18",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1802", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1803", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1804", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1805", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1806", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "1807", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "dor_code": "19",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice", // "Professional services building"
    "property_type": "Building"
  },
  {
    "dor_code": "1900", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "dor_code": "1901", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "dor_code": "1902", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "VeterinaryClinic",
    "property_type": "Building"
  },
  {
    "dor_code": "1903", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CommunicationFacility",
    "property_type": "Building"
  },
  {
    "dor_code": "1905", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Office",
    "property_type": "Unit"
  },
  {
    "dor_code": "1906", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Office",
    "property_type": "Unit"
  },
  {
    "dor_code": "20",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "dor_code": "21",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "dor_code": "2101", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "dor_code": "22",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FastFoodRestaurant",
    "property_type": "Building"
  },
  {
    "dor_code": "23",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "dor_code": "2301", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "dor_code": "24",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "dor_code": "25",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RepairServiceShop",
    "property_type": "Building"
  },
  {
    "dor_code": "2502", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DryCleanerLaundromat",
    "property_type": "Building"
  },
  {
    "dor_code": "26",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "dor_code": "2601", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ConvenienceStoreWithGas",
    "property_type": "Building"
  },
  {
    "dor_code": "2602", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoService",
    "property_type": "Building"
  },
  {
    "dor_code": "2603", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CarWash",
    "property_type": "Building"
  },
  {
    "dor_code": "2605", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CarWash",
    "property_type": "Building"
  },
  {
    "dor_code": "27",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "dor_code": "2701", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "dor_code": "2702", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoDealership",
    "property_type": "Building"
  },
  {
    "dor_code": "2703", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MarineSalesRepair",
    "property_type": "Building"
  },
  {
    "dor_code": "2704", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "VehicleSales",
    "property_type": "Building"
  },
  {
    "dor_code": "2705", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "VehicleRental",
    "property_type": "Building"
  },
  {
    "dor_code": "28",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved", // Mobile home parks are improved land
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "2801", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ParkingLot",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "29",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "dor_code": "30",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "dor_code": "3005", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "dor_code": "31",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater", // Drive-in
    "property_type": "Building"
  },
  {
    "dor_code": "32",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater", // Enclosed
    "property_type": "Building"
  },
  {
    "dor_code": "33",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NightclubBar",
    "property_type": "Building"
  },
  {
    "dor_code": "3301", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NightclubBar",
    "property_type": "Building"
  },
  {
    "dor_code": "34",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RecreationalFacility",
    "property_type": "Building"
  },
  {
    "dor_code": "3401", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HealthFitnessClub",
    "property_type": "Building"
  },
  {
    "dor_code": "35",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "dor_code": "36",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Camp",
    "property_type": "Building"
  },
  {
    "dor_code": "37",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "dor_code": "38",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "dor_code": "3801", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "dor_code": "39",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel", // General
    "property_type": "Building"
  },
  {
    "dor_code": "3901", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Motel",
    "property_type": "Building"
  },
  {
    "dor_code": "3902", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "dor_code": "3903", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LuxuryHotel",
    "property_type": "Building"
  },
  {
    "dor_code": "3905", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ExtendedStayHotel",
    "property_type": "Building"
  },
  {
    "dor_code": "3910", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "BedAndBreakfast",
    "property_type": "Building"
  },

  // INDUSTRIAL
  {
    "dor_code": "40",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "4001", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "4005", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "4011", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Other"
  },
  {
    "dor_code": "4012", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Other"
  },
  {
    "dor_code": "4013", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "4020", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "41",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "dor_code": "4102", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "dor_code": "4105", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Unit"
  },
  {
    "dor_code": "42",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "dor_code": "43",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "dor_code": "44",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "dor_code": "45",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "dor_code": "46",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FoodProcessing",
    "property_type": "Building"
  },
  {
    "dor_code": "47",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "dor_code": "48",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "dor_code": "4802", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MiniWarehouse",
    "property_type": "Building"
  },
  {
    "dor_code": "4805", // New
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "dor_code": "49",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved", // Open storage implies some improvement (fencing, paving)
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },

  // AGRICULTURAL
  {
    "dor_code": "50",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel" // Or "Building" if it's a farm building
  },
  {
    "dor_code": "5001", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "51",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5101", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "52",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5201", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "53",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5301", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "54",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5401", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "55",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5501", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "56",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5601", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "57",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5701", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "58",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5801", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "5901", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "60",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6001", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6010", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved", // Horse breeding/boarding implies improvements
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6011", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6020", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6021", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6030", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6031", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HorseFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "61",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6101", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "62",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6201", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "63",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6301", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "64",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6401", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "65",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6501", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "66",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6601", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "67",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry", // Misc. Ag - poultry, bees, fish, rabbits
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6701", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "68",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DairyFarm", // Dairies, feed lots
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6801", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DairyFarm",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6901", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "6902", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },

  // INSTITUTIONAL
  {
    "dor_code": "70",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Institutional",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "71",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "dor_code": "72",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "dor_code": "7201", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DaycarePreschool",
    "property_type": "Building"
  },
  {
    "dor_code": "73",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "dor_code": "74",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement", // Homes for the aged/ALF
    "property_type": "Building"
  },
  {
    "dor_code": "7401", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GroupHome",
    "property_type": "Building"
  },
  {
    "dor_code": "7402", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "dor_code": "75",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "dor_code": "7502", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RehabilitationFacility",
    "property_type": "Building"
  },
  {
    "dor_code": "76",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "dor_code": "7605", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cemetery",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "77",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubLodge",
    "property_type": "Building"
  },
  {
    "dor_code": "78",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "VolunteerFireDepartment",
    "property_type": "Building"
  },
  {
    "dor_code": "79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },

  // GOVERNMENT
  {
    "dor_code": "80",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "8001", // New
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "8002", // New
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "81",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "dor_code": "82",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "8201", // New
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "83",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "dor_code": "84",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicCollege",
    "property_type": "Building"
  },
  {
    "dor_code": "85",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "dor_code": "86",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty", // Counties
    "property_type": "Building"
  },
  {
    "dor_code": "8605", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Other"
  },
  {
    "dor_code": "87",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty", // State
    "property_type": "Building"
  },
  {
    "dor_code": "8705", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Other"
  },
  {
    "dor_code": "88",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty", // Federal
    "property_type": "Building"
  },
  {
    "dor_code": "8805", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Other"
  },
  {
    "dor_code": "89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty", // Municipal
    "property_type": "Building"
  },
  {
    "dor_code": "8901", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Airport",
    "property_type": "Building"
  },
  {
    "dor_code": "8905", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Other"
  },
  {
    "dor_code": "90",
    "ownership_estate_type": "Leasehold",
    "build_status": null, // Can be vacant or improved
    "structure_form": null,
    "property_usage_type": "GovernmentProperty", // Government/Leasehold interest
    "property_type": "LandParcel"
  },
  {
    "dor_code": "91",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel" // Or "Building" if it's a utility building
  },
  {
    "dor_code": "9105", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Other"
  },
  {
    "dor_code": "92",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing", // Mining lands, petroleum lands, or gas lands
    "property_type": "LandParcel" // Or "Building" if there are structures
  },
  {
    "dor_code": "93",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown", // Subsurface rights don't imply a surface usage
    "property_type": "LandParcel"
  },
  {
    "dor_code": "94",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal", // Right of way for streets, roads, etc.
    "property_type": "LandParcel"
  },
  {
    "dor_code": "95",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand", // Submerged lands are typically vacant
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "96",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand", // Sewage disposal, solid waste, etc. are often land parcels
    "structure_form": null,
    "property_usage_type": "WasteManagement", // More specific than "TransitionalProperty"
    "property_type": "LandParcel"
  },
  {
    "dor_code": "97",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand", // Parks/Classified Use Assessment
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },

  // CENTRALLY ASSESSED
  {
    "dor_code": "98",
    "ownership_estate_type": "FeeSimple", // Assuming FeeSimple for centrally assessed unless specified
    "build_status": null, // Can be vacant or improved
    "structure_form": null,
    "property_usage_type": "CentrallyAssessed",
    "property_type": "Other" // Or "LandParcel", "Building" depending on context
  },

  // NON-AGRICULTURAL ACREAGE
  {
    "dor_code": "99",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown", // "Acreage not agricultural" is broad
    "property_type": "LandParcel"
  },
  {
    "dor_code": "9911", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Other"
  },
  {
    "dor_code": "9950", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PlannedUnitDevelopment",
    "property_type": "LandParcel"
  },
  {
    "dor_code": "9999", // New
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  }
];

const propertyMappingMap = new Map(
  propertyMapping.map((item) => [item.dor_code, item]),
);

// Function to get property mapping based on DOR code
function getPropertyMapping(dorCode) {
  if (dorCode === null || dorCode === undefined) return null;

  const normalized = String(dorCode).trim();
  if (!normalized) return null;

  const digitsOnly = normalized.replace(/\D/g, "");
  if (!digitsOnly) return null;

  for (let length = digitsOnly.length; length >= 2; length--) {
    const candidate = digitsOnly.slice(0, length).padStart(2, "0");
    if (propertyMappingMap.has(candidate)) {
      return propertyMappingMap.get(candidate);
    }
  }

  if (digitsOnly.length === 1) {
    const candidate = digitsOnly.padStart(2, "0");
    if (propertyMappingMap.has(candidate)) {
      return propertyMappingMap.get(candidate);
    }
  }

  return null;
}

// Helper function to create relationship file names
// This function now strictly adheres to the format relationship_fromFileName_has_toFileName.json
function createRelationshipFileName(fromFileName, toFileName) { // Removed index parameter
  const fromName = fromFileName.replace(/\.json$/, '');
  const toName = toFileName.replace(/\.json$/, '');
  return `relationship_${fromName}_has_${toName}.json`;
}

function main() {
  ensureDir("data");

  cleanupLegacyArtifacts();

  const input = readInputHtml();
  const unaddr = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

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

  const parcelNumber = propSeed.parcel_id;
  const requestIdentifier =
    (propSeed && propSeed.request_identifier) ||
    (parcelNumber && String(parcelNumber).trim()) ||
    (input.apprId && String(input.apprId)) ||
    (input.masterId && String(input.masterId)) ||
    "unknown";

  const bldg =
    Array.isArray(input.buildingDetails) && input.buildingDetails.length > 0
      ? input.buildingDetails[0]
      : null;
  const livableRaw =
    (bldg && (bldg.livingArea || bldg.baseArea)) ||
    input.livingAreaCalc ||
    null;
  const livable =
    livableRaw !== null && livableRaw !== undefined
      ? Number(livableRaw)
      : null;
  const grossRaw = (bldg && bldg.grossArea) || input.grossAreaCalc || null;
  const gross =
    grossRaw !== null && grossRaw !== undefined ? Number(grossRaw) : null;
  const legal = input.legal || null;
  const yearTokens = parseYearTokens(bldg ? bldg.yearBlt : null);
  const builtYear = yearTokens.built;
  const effectiveBuiltYear = yearTokens.effective;

  // Apply property mapping using input.dor
  const mappedProperty = getPropertyMapping(input.dor);

  const propertyFileName = "property.json";
  const propertyObj = {
    parcel_identifier: parcelNumber,
    property_legal_description_text: legal,
    property_structure_built_year: Number.isFinite(builtYear) ? builtYear : null,
    property_effective_built_year: Number.isFinite(effectiveBuiltYear)
      ? effectiveBuiltYear
      : null,
    // MODIFIED: Convert numeric area fields to string
    livable_floor_area: Number.isFinite(livable) ? String(livable) : null,
    area_under_air: Number.isFinite(livable) ? String(livable) : null,
    total_area: Number.isFinite(gross) ? String(gross) : null,
    property_type: mappedProperty ? mappedProperty.property_type : null,
    number_of_units_type: "One", // Default, can be updated based on more specific logic if needed
    ownership_estate_type: mappedProperty
      ? mappedProperty.ownership_estate_type
      : null,
    build_status: mappedProperty ? mappedProperty.build_status : null,
    structure_form: mappedProperty ? mappedProperty.structure_form : null,
    property_usage_type: mappedProperty
      ? mappedProperty.property_usage_type
      : null,
    zoning: input.zoning || null,
    subdivision: input.subName || input.platName || null,
    number_of_units: 1,
    request_identifier: requestIdentifier,
  };
  if (!Number.isFinite(propertyObj.number_of_units))
    propertyObj.number_of_units = 1;

  fs.writeFileSync(
    path.join("data", propertyFileName),
    JSON.stringify(propertyObj, null, 2),
  );

  const permits = Array.isArray(input.permitDetails)
    ? input.permitDetails.filter(Boolean)
    : [];
  permits.forEach((permit, idx) => {
    const index = idx + 1;
    const improvementFileName = `property_improvement_${index}.json`;
    const permitNumberSource =
      permit.permitKey || permit.permitNo || permit.permitId;
    const permitNumber =
      permitNumberSource !== undefined && permitNumberSource !== null
        ? String(permitNumberSource).trim() || null
        : null;
    const improvementRecord = {
      application_received_date: toISODate(permit.dateAdded),
      completion_date: toISODate(permit.coDate),
      contractor_type: null,
      final_inspection_date: null,
      improvement_action: mapImprovementAction(permit.permitDesc),
      improvement_status: mapImprovementStatus(permit.statusCode),
      improvement_type: mapImprovementType(permit.permitDesc, permit.permitCode),
      is_disaster_recovery: null,
      is_owner_builder: null,
      permit_close_date: toISODate(permit.coDate),
      permit_issue_date: toISODate(permit.permitDate),
      permit_number: permitNumber,
      permit_required: true,
      private_provider_inspections: null,
      private_provider_plan_review: null,
      request_identifier:
        (permit.permitKey && String(permit.permitKey).trim()) ||
        `${requestIdentifier}-permit-${index}`,
    };
    fs.writeFileSync(
      path.join("data", improvementFileName),
      JSON.stringify(improvementRecord, null, 2),
    );

    const relationship = {
      from: { "/": `./${propertyFileName}` },
      to: { "/": `./${improvementFileName}` },
    };
    // NOTE: If there are multiple property_improvement_X.json files,
    // and they all relate to property.json, this will create multiple
    // relationship files like relationship_property_has_property_improvement_1.json,
    // relationship_property_has_property_improvement_2.json, etc.
    // This is the correct behavior for multiple distinct relationships.
    
  });

  const situsAddressRaw = unaddr.full_address || input.situsAddress || "";
  const situsAddress = parseAddressComponents(
    situsAddressRaw,
    input.mailingAddress || "",
  );
  const addressFileName = "address.json";
  const addressObj = {
    street_number: situsAddress ? situsAddress.streetNumber : null,
    street_pre_directional_text: situsAddress
      ? situsAddress.streetPreDirectional
      : null,
    street_name: situsAddress ? situsAddress.streetName : null,
    street_suffix_type: situsAddress ? situsAddress.streetSuffix : null,
    street_post_directional_text: situsAddress
      ? situsAddress.streetPostDirectional
      : null,
    unit_identifier: null,
    city_name: situsAddress ? situsAddress.city : null,
    municipality_name: null,
    state_code: situsAddress ? situsAddress.state : null,
    postal_code: situsAddress ? situsAddress.postal_code : null, // Use postal_code from parsed object
    plus_four_postal_code: situsAddress ? situsAddress.plus4 : null,
    county_name: "Seminole",
    country_code: "US",
    latitude: typeof unaddr.latitude === "number" ? unaddr.latitude : null,
    longitude: typeof unaddr.longitude === "number" ? unaddr.longitude : null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    // unnormalized_address: normalizeAddressString(situsAddressRaw) || null,
    request_identifier: requestIdentifier,
  };
  fs.writeFileSync(
    path.join("data", addressFileName),
    JSON.stringify(addressObj, null, 2),
  );


  let mailingAddressFile = null;
  const mailingAddressRaw = input.mailingAddress || "";
  const mailingAddressParsed = parseAddressComponents(
    mailingAddressRaw,
    mailingAddressRaw,
  );
  if (
    mailingAddressParsed &&
    (mailingAddressParsed.streetNumber ||
      mailingAddressParsed.streetName ||
      mailingAddressParsed.city ||
      mailingAddressParsed.state ||
      mailingAddressParsed.postal_code) // Use postal_code here
  ) {
    mailingAddressFile = "mailing_address.json";
    const mailingAddressObj = {
      unnormalized_address: normalizeAddressString(mailingAddressRaw) || null,
      request_identifier: requestIdentifier,
      latitude : null,
      longitude : null,
    };
    fs.writeFileSync(
      path.join("data", mailingAddressFile),
      JSON.stringify(mailingAddressObj, null, 2),
    );
  }
  const primaryLand =
    Array.isArray(input.landDetails) && input.landDetails.length
      ? input.landDetails[0]
      : null;
  const lotAcre =
    typeof input.gisAcres === "number" ? input.gisAcres : null;
  const lotAreaSqft = Number.isFinite(input.parcelSquareFt)
    ? Number(input.parcelSquareFt)
    : lotAcre !== null
      ? Math.round(lotAcre * 43560)
      : null;

  const lotFileName = "lot.json";
  const lotObj = {
    // MODIFIED: Use mapLotType
    lot_type: mapLotType(primaryLand && primaryLand.method, lotAcre),
    lot_length_feet:
      primaryLand && Number.isFinite(primaryLand.landDepth)
        ? Number(primaryLand.landDepth)
        : null,
    lot_width_feet:
      primaryLand && Number.isFinite(primaryLand.landFrontage)
        ? Number(primaryLand.landFrontage)
        : null,
    lot_area_sqft: lotAreaSqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotAcre,
    request_identifier: requestIdentifier,
  };

  fs.writeFileSync(
    path.join("data", lotFileName),
    JSON.stringify(lotObj, null, 2),
  );



  if (Array.isArray(input.parcelValueHistory)) {
    input.parcelValueHistory.forEach((row, idx) => {
      const year = row.taxYear;
      const assessed =
        Number(row.taxableValue || 0) + Number(row.exemptValue || 0);
      const taxFileName = Number.isFinite(year)
        ? `tax_${year}.json`
        : `tax_${idx + 1}.json`;
      const taxObj = {
        tax_year: Number.isFinite(year) ? year : null,
        property_assessed_value_amount: toCurrencyNumber(assessed),
        property_market_value_amount: toCurrencyNumber(row.totalJustValue),
        property_building_amount: toCurrencyNumber(row.apprBldg),
        property_land_amount: toCurrencyNumber(row.apprLand),
        property_taxable_value_amount: toCurrencyNumber(row.taxableValue),
        monthly_tax_amount: null,
        yearly_tax_amount: toCurrencyNumber(row.taxBillAmt),
        period_start_date: null,
        period_end_date: null,
        request_identifier: requestIdentifier,
      };
      fs.writeFileSync(
        path.join("data", taxFileName),
        JSON.stringify(taxObj, null, 2),
      );

    });
  }

  let sales = Array.isArray(input.saleDetails) ? input.saleDetails.slice() : [];
  sales.sort((a, b) => new Date(a.saleDate) - new Date(b.saleDate));

  const saleEntries = [];
  sales.forEach((s, idx) => {
    const sequence = idx + 1;
    const saleFileName = `sales_history_${sequence}.json`;
    const saleRequestId =
      (s.saleKeyId && String(s.saleKeyId)) ||
      `${requestIdentifier}-sale-${sequence}`;
    const saleObj = {
      ownership_transfer_date: toISODate(s.saleDate),
      purchase_price_amount: toCurrencyNumber(s.saleAmt),
      sale_type: mapSaleType(s.saleCode), // MODIFIED: Use mapSaleType
      request_identifier: saleRequestId,
    };
    fs.writeFileSync(
      path.join("data", saleFileName),
      JSON.stringify(saleObj, null, 2),
    );

    const deedType = mapDeedType(s);
    const deedFileName = `deed_${sequence}.json`;
    const deedObj = {
      request_identifier: saleRequestId,
    };
    if (deedType) {
      deedObj.deed_type = deedType;
    }
    const deedBook = pickFirstString(s, [
      "book",
      "deedBook",
      "recordBook",
      "documentBook",
      "platBook",
    ]);
    const deedPage = pickFirstString(s, [
      "page",
      "deedPage",
      "recordPage",
      "documentPage",
      "platPage",
    ]);
    const deedVolume = pickFirstString(s, [
      "volume",
      "deedVolume",
      "recordVolume",
      "documentVolume",
    ]);
    const deedInstrument = pickFirstString(s, [
      "instrumentNumber",
      "instrumentNo",
      "instrument",
      "recordingNumber",
      "recordingNo",
      "recordNumber",
      "docNumber",
      "documentNumber",
    ]);
    if (deedBook) deedObj.book = deedBook;
    if (deedPage) deedObj.page = deedPage;
    if (deedVolume) deedObj.volume = deedVolume;
    if (deedInstrument) deedObj.instrument_number = deedInstrument;

    fs.writeFileSync(
      path.join("data", deedFileName),
      JSON.stringify(deedObj, null, 2),
    );

    fs.writeFileSync(
      path.join("data", createRelationshipFileName(saleFileName, deedFileName)),
      JSON.stringify(
        {
          from: { "/": `./${saleFileName}` },
          to: { "/": `./${deedFileName}` },
        },
        null,
        2,
      ),
    );



    saleEntries.push({
      file: saleFileName,
      deedFile: deedFileName,
      sale: s,
      sequence,
    });
  });

  const personEntries = [];
  const companyEntries = [];
  if (ownersData) {
    const ownersKey = `property_${parcelNumber}`;
    const ownersForProperty = ownersData[ownersKey];
    if (
      ownersForProperty &&
      ownersForProperty.owners_by_date &&
      Array.isArray(ownersForProperty.owners_by_date.current)
    ) {
      const currOwners = ownersForProperty.owners_by_date.current;
      let personIndex = 0;
      let companyIndex = 0;

      for (const owner of currOwners) {
        if (owner.type === "person") {
          personIndex += 1;
          const personFileName = `person_${personIndex}.json`;
          const personRecord = {
            birth_date: null,
            first_name: properCaseName(owner.first_name || null),
            last_name: properCaseName(owner.last_name || null),
            middle_name: owner.middle_name || null,
            prefix_name: null,
            suffix_name: owner.suffix_name || null,
            us_citizenship_status: null,
            veteran_status: null,
            request_identifier: requestIdentifier,
          };
          fs.writeFileSync(
            path.join("data", personFileName),
            JSON.stringify(personRecord, null, 2),
          );
          personEntries.push({ file: personFileName, owner });
        } else if (owner.type === "company") {
          companyIndex += 1;
          const companyFileName = `company_${companyIndex}.json`;
          const companyRecord = {
            name: owner.name || null,
            request_identifier: requestIdentifier,
          };
          fs.writeFileSync(
            path.join("data", companyFileName),
            JSON.stringify(companyRecord, null, 2),
          );
          companyEntries.push({ file: companyFileName, owner });
        }
      }

      let saleForCurrentOwners = null;
      for (let idx = saleEntries.length - 1; idx >= 0; idx -= 1) {
        if (shouldLinkSaleToCurrentOwners(saleEntries[idx].sale)) {
          saleForCurrentOwners = saleEntries[idx];
          break;
        }
      }
      if (!saleForCurrentOwners && saleEntries.length) {
        saleForCurrentOwners = saleEntries[saleEntries.length - 1];
      }

      if (saleForCurrentOwners) {
        personEntries.forEach((entry) => {
          const rel = {
            from: { "/": `./${saleForCurrentOwners.file}` },
            to: { "/": `./${entry.file}` },
          };
          fs.writeFileSync(
            path.join(
              "data",
              createRelationshipFileName(saleForCurrentOwners.file, entry.file), // No index here, as entry.file already has one
            ),
            JSON.stringify(rel, null, 2),
          );
        });

        companyEntries.forEach((entry) => {
          const rel = {
            from: { "/": `./${saleForCurrentOwners.file}` },
            to: { "/": `./${entry.file}` },
          };
          fs.writeFileSync(
            path.join(
              "data",
              createRelationshipFileName(saleForCurrentOwners.file, entry.file), // No index here, as entry.file already has one
            ),
            JSON.stringify(rel, null, 2),
          );
        });
      }

      if (mailingAddressFile) {
        personEntries.forEach((entry) => {
          const rel = {
            from: { "/": `./${entry.file}` },
            to: { "/": `./${mailingAddressFile}` },
          };
          fs.writeFileSync(
            path.join(
              "data",
              createRelationshipFileName(entry.file, mailingAddressFile), // No index here
            ),
            JSON.stringify(rel, null, 2),
          );
        });

        companyEntries.forEach((entry) => {
          const rel = {
            from: { "/": `./${entry.file}` },
            to: { "/": `./${mailingAddressFile}` },
          };
          fs.writeFileSync(
            path.join(
              "data",
              createRelationshipFileName(entry.file, mailingAddressFile), // No index here
            ),
            JSON.stringify(rel, null, 2),
          );
        });
      }
    }
  }

  const utilityOutputs = [];
  if (utilitiesData) {
    const utilityKeyCandidates = [
      `property_${input.apprId}`,
      `property_${parcelNumber}`,
      `property_${propSeed.parcel_id}`,
    ];
    let utilitySource = null;
    for (const key of utilityKeyCandidates) {
      if (key && utilitiesData[key]) {
        utilitySource = utilitiesData[key];
        break;
      }
    }
    const utilityCandidates = [];
    const collectUtilityCandidate = (candidate) => {
      if (candidate && typeof candidate === "object") {
        utilityCandidates.push(candidate);
      }
    };
    if (Array.isArray(utilitySource)) {
      utilitySource.forEach(collectUtilityCandidate);
    } else if (utilitySource && Array.isArray(utilitySource.utilities)) {
      utilitySource.utilities.forEach(collectUtilityCandidate);
    } else if (utilitySource) {
      collectUtilityCandidate(utilitySource);
    }
    utilityCandidates.forEach((u, idx) => {
      const fileName = `utility_${idx + 1}.json`;
      const utilObj = {
        cooling_system_type: u.cooling_system_type ?? null,
        heating_system_type: u.heating_system_type ?? null,
        public_utility_type: mapPublicUtilityType(u.public_utility_type),
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
        solar_panel_present: u.solar_panel_present === true,
        solar_panel_type: u.solar_panel_type ?? null,
        solar_panel_type_other_description:
          u.solar_panel_type_other_description ?? null,
        smart_home_features: u.smart_home_features ?? null,
        smart_home_features_other_description:
          u.smart_home_features_other_description ?? null,
        hvac_unit_condition: u.hvac_unit_condition ?? null,
        solar_inverter_visible: u.solar_inverter_visible === true,
        hvac_unit_issues: u.hvac_unit_issues ?? null,
        electrical_panel_installation_date:
          u.electrical_panel_installation_date ?? null,
        electrical_rewire_date: u.electrical_rewire_date ?? null,
        hvac_capacity_kw: u.hvac_capacity_kw ?? null,
        hvac_capacity_tons: u.hvac_capacity_tons ?? null,
        hvac_equipment_component: u.hvac_equipment_component ?? null,
        hvac_equipment_manufacturer: u.hvac_equipment_manufacturer ?? null,
        hvac_equipment_model: u.hvac_equipment_model ?? null,
        hvac_installation_date: u.hvac_installation_date ?? null,
        hvac_seer_rating: u.hvac_seer_rating ?? null,
        hvac_system_configuration: u.hvac_system_configuration ?? null,
        plumbing_system_installation_date:
          u.plumbing_system_installation_date ?? null,
        sewer_connection_date: u.sewer_connection_date ?? null,
        solar_installation_date: u.solar_installation_date ?? null,
        solar_inverter_installation_date:
          u.solar_inverter_installation_date ?? null,
        solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
        solar_inverter_model: u.solar_inverter_model ?? null,
        water_connection_date: u.water_connection_date ?? null,
        water_heater_installation_date:
          u.water_heater_installation_date ?? null,
        water_heater_manufacturer: u.water_heater_manufacturer ?? null,
        water_heater_model: u.water_heater_model ?? null,
        well_installation_date: u.well_installation_date ?? null,
        request_identifier: u.request_identifier || requestIdentifier,
      };
      fs.writeFileSync(
        path.join("data", fileName),
        JSON.stringify(utilObj, null, 2),
      );
      utilityOutputs.push({
        fileName,
        buildingNumber: extractBuildingNumber(u, null),
      });
    });
  }

  const structureOutputs = [];
  const structureKeyCandidates = [
    `property_${input.apprId}`,
    `property_${parcelNumber}`,
    `property_${propSeed.parcel_id}`,
  ];
  let structureSource = null;
  if (structureData) {
    for (const key of structureKeyCandidates) {
      if (key && structureData[key]) {
        structureSource = structureData[key];
        break;
      }
    }
  }
  const structureCandidates = [];
  const collectStructureCandidate = (candidate) => {
    if (candidate && typeof candidate === "object") {
      structureCandidates.push({
        data: { ...candidate },
        buildingNumber: extractBuildingNumber(candidate, null),
      });
    }
  };
  if (Array.isArray(structureSource)) {
    structureSource.forEach(collectStructureCandidate);
  } else if (structureSource && Array.isArray(structureSource.structures)) {
    structureSource.structures.forEach(collectStructureCandidate);
  } else if (structureSource) {
    collectStructureCandidate(structureSource);
  }
  const buildingDetails = Array.isArray(input.buildingDetails)
    ? input.buildingDetails.filter(Boolean)
    : [];
  if (structureCandidates.length === 0) {
    const detailsToProcess = buildingDetails.length ? buildingDetails : [null];
    detailsToProcess.forEach((detail, idx) => {
      const fallbackBuildingNumber = extractBuildingNumber(detail, detailsToProcess.length > 1 ? idx + 1 : null);
      let attachment_type = null;
      if (detail && typeof detail.bldgType === "string") {
        const bt = detail.bldgType.toUpperCase();
        if (bt.includes("SINGLE FAMILY")) attachment_type = "Detached";
      }
      const extWall =
        detail && detail.extWall ? String(detail.extWall).toUpperCase() : "";
      let exterior_wall_material_primary = null;
      if (extWall.includes("STUCCO")) exterior_wall_material_primary = "Stucco";
      if (extWall.includes("CONCRETE BLOCK") || extWall.includes("CB"))
        exterior_wall_material_primary = "Concrete Block";
      let primary_framing_material = null;
      if (extWall.includes("CB") || extWall.includes("CONCRETE BLOCK"))
        primary_framing_material = "Concrete Block";

      const finishedBaseArea =
        detail && typeof detail.livingArea === "number"
          ? detail.livingArea
          : typeof detail?.baseArea === "number"
            ? detail.baseArea
            : typeof input.livingAreaCalc === "number"
              ? input.livingAreaCalc
              : null;
      const grossAreaValue =
        detail && typeof detail.grossArea === "number"
          ? detail.grossArea
          : typeof input.grossAreaCalc === "number"
            ? input.grossAreaCalc
            : null;
      const unfinishedBaseArea =
        finishedBaseArea && grossAreaValue
          ? Math.max(grossAreaValue - finishedBaseArea, 0)
          : null;

      structureCandidates.push({
        data: {
          architectural_style_type: null,
          attachment_type,
          exterior_wall_material_primary,
          exterior_wall_material_secondary: null,
          exterior_wall_condition: null,
          exterior_wall_insulation_type: "Unknown",
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
          roof_covering_material: null,
          roof_underlayment_type: "Unknown",
          roof_structure_material: null,
          roof_design_type: null,
          roof_condition: null,
          roof_age_years: null,
          gutters_material: null,
          gutters_condition: null,
          roof_material_type: null,
          foundation_type: null,
          foundation_material: null,
          foundation_waterproofing: "Unknown",
          foundation_condition: "Unknown",
          ceiling_structure_material: null,
          ceiling_surface_material: null,
          ceiling_insulation_type: "Unknown",
          ceiling_height_average: null,
          ceiling_condition: null,
          exterior_door_material: null,
          interior_door_material: null,
          window_frame_material: null,
          window_glazing_type: null,
          window_operation_type: null,
          window_screen_material: null,
          primary_framing_material,
          secondary_framing_material: null,
          structural_damage_indicators: null,
          number_of_stories:
            detail && typeof detail.baseFloors === "number"
              ? detail.baseFloors
              : null,
          finished_base_area: finishedBaseArea,
          finished_basement_area: null,
          finished_upper_story_area: null,
          unfinished_base_area: unfinishedBaseArea,
          unfinished_basement_area: null,
          unfinished_upper_story_area: null,
          exterior_wall_condition_primary: null,
          exterior_wall_condition_secondary: null,
          exterior_wall_insulation_type_primary: "Unknown",
          exterior_wall_insulation_type_secondary: "Unknown",
          siding_installation_date: null,
          roof_date: null,
          window_installation_date: null,
          exterior_door_installation_date: null,
          foundation_repair_date: null,
        },
        buildingNumber: fallbackBuildingNumber,
      });
    });
  }
  structureCandidates.forEach((entry, idx) => {
    const fileName = `structure_${idx + 1}.json`;
    const structureRecord = { ...entry.data };
    sanitizeStructureRecord(structureRecord);
    structureRecord.request_identifier =
      structureRecord.request_identifier || requestIdentifier;
    fs.writeFileSync(
      path.join("data", fileName),
      JSON.stringify(structureRecord, null, 2),
    );
    structureOutputs.push({
      fileName,
      buildingNumber:
        entry.buildingNumber !== null && entry.buildingNumber !== undefined
          ? entry.buildingNumber
          : extractBuildingNumber(structureRecord, null),
    });
  });

  const usedStructureIndexes = new Set();

  if (layoutData) {
    const layoutKeyCandidates = [
      `property_${input.apprId}`,
      `property_${parcelNumber}`,
      `property_${propSeed.parcel_id}`,
    ];
    let layoutBundle = null;
    for (const key of layoutKeyCandidates) {
      if (key && layoutData[key]) {
        layoutBundle = layoutData[key];
        break;
      }
    }
    if (layoutBundle && Array.isArray(layoutBundle.layouts)) {
      const idToFile = new Map();
      const layoutBuildingNumbers = new Map();
      layoutBundle.layouts.forEach((node, idx) => {
        if (!node) return;
        const { id, ...rest } = node;
        const layoutFileName = `layout_${idx + 1}.json`;
        const layoutRecord = { ...rest };
        layoutRecord.space_type = normalizeSpaceType(layoutRecord.space_type);
        layoutRecord.floor_level = normalizeFloorLevel(layoutRecord.floor_level);
        layoutRecord.is_exterior = coerceBoolean(layoutRecord.is_exterior, false);
        layoutRecord.is_finished = coerceBoolean(layoutRecord.is_finished, false);
        layoutRecord.request_identifier =
          layoutRecord.request_identifier || requestIdentifier;
        fs.writeFileSync(
          path.join("data", layoutFileName),
          JSON.stringify(layoutRecord, null, 2),
        );
        idToFile.set(id, layoutFileName);
        layoutBuildingNumbers.set(
          id,
          extractBuildingNumber(node, extractBuildingNumber(rest, null)),
        );
      });

      const layoutRelationships = Array.isArray(
        layoutBundle.layout_relationships,
      )
        ? layoutBundle.layout_relationships
        : [];
      layoutRelationships.forEach((rel) => {
        if (!rel) return;
        const fromFile = idToFile.get(rel.from);
        const toFile = idToFile.get(rel.to);
        if (!fromFile || !toFile) return;
        const relObj = {
          from: { "/": `./${fromFile}` },
          to: { "/": `./${toFile}` },
        };
        const relationshipFileName = createRelationshipFileName(fromFile, toFile);
        fs.writeFileSync(
          path.join("data", relationshipFileName),
          JSON.stringify(relObj, null, 2),
        );
      });

      const structureLinks = Array.isArray(
        layoutBundle.layout_structure_links,
      )
        ? layoutBundle.layout_structure_links
        : [];
      structureLinks.forEach((link) => {
        if (!link || !structureOutputs.length) return;
        const fromFile = idToFile.get(link.layout_id);
        if (!fromFile) return;
        const layoutBuildingNumber = layoutBuildingNumbers.get(link.layout_id);
        let structureIndex = -1;
        if (layoutBuildingNumber !== null && layoutBuildingNumber !== undefined) {
          structureIndex = structureOutputs.findIndex(
            (entry, idx) =>
              !usedStructureIndexes.has(idx) &&
              entry.buildingNumber !== null &&
              entry.buildingNumber !== undefined &&
              Number(entry.buildingNumber) === Number(layoutBuildingNumber),
          );
        }
        if (structureIndex === -1) {
          structureIndex = structureOutputs.findIndex(
            (entry, idx) => !usedStructureIndexes.has(idx),
          );
        }
        if (structureIndex === -1) return;
        usedStructureIndexes.add(structureIndex);
        const structureFileName = structureOutputs[structureIndex].fileName;
        const relObj = {
          from: { "/": `./${fromFile}` },
          to: { "/": `./${structureFileName}` },
        };
        const relationshipFileName = createRelationshipFileName(
          fromFile,
          structureFileName,
        );
        fs.writeFileSync(
          path.join("data", relationshipFileName),
          JSON.stringify(relObj, null, 2),
        );
      });

      const utilityLinks = Array.isArray(
        layoutBundle.layout_utility_links,
      )
        ? layoutBundle.layout_utility_links
        : [];
      const usedUtilityIndexes = new Set();
      utilityLinks.forEach((link) => {
        if (!link || !utilityOutputs.length) return;
        const fromFile = idToFile.get(link.layout_id);
        if (!fromFile) return;
        const layoutBuildingNumber = layoutBuildingNumbers.get(link.layout_id);
        let utilityIndex = -1;
        if (layoutBuildingNumber !== null && layoutBuildingNumber !== undefined) {
          utilityIndex = utilityOutputs.findIndex(
            (entry, idx) =>
              !usedUtilityIndexes.has(idx) &&
              entry.buildingNumber !== null &&
              entry.buildingNumber !== undefined &&
              Number(entry.buildingNumber) === Number(layoutBuildingNumber),
          );
        }
        if (utilityIndex === -1) {
          utilityIndex = utilityOutputs.findIndex(
            (entry, idx) => !usedUtilityIndexes.has(idx),
          );
        }
        if (utilityIndex === -1) return;
        usedUtilityIndexes.add(utilityIndex);
        const utilityFileName = utilityOutputs[utilityIndex].fileName;
        const relObj = {
          from: { "/": `./${fromFile}` },
          to: { "/": `./${utilityFileName}` },
        };
        const relationshipFileName = createRelationshipFileName(
          fromFile,
          utilityFileName,
        );
        fs.writeFileSync(
          path.join("data", relationshipFileName),
          JSON.stringify(relObj, null, 2),
        );
      });
    }
  }

  structureOutputs.forEach((entry, idx) => {
    if (usedStructureIndexes.has(idx)) return;
    const relObj = {
      from: { "/": "./property.json" },
      to: { "/": `./${entry.fileName}` },
    };
    const relationshipFileName = createRelationshipFileName(
      "property.json",
      entry.fileName,
    );
    fs.writeFileSync(
      path.join("data", relationshipFileName),
      JSON.stringify(relObj, null, 2),
    );
  });

  const floodZoneRaw = String(input.floodZone || "").trim();
  let floodInsuranceRequired = null;
  if (floodZoneRaw) {
    const normalizedZone = floodZoneRaw.toUpperCase();
    if (normalizedZone === "NO" || normalizedZone === "NONE" || normalizedZone === "X") {
      floodInsuranceRequired = false;
    } else {
      floodInsuranceRequired = true;
    }
  }

  const floodFileName = "flood_storm_information.json";
  const floodObj = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: floodZoneRaw || null,
    flood_insurance_required: floodInsuranceRequired,
    fema_search_url: null,
    request_identifier: requestIdentifier,
  };
  fs.writeFileSync(
    path.join("data", floodFileName),
    JSON.stringify(floodObj, null, 2),
  );



  let fileIdx = 0;
  const fileCandidates = [];
  if (Array.isArray(input.footPrintImages)) {
    input.footPrintImages.forEach((fp) => {
      if (fp && fp.downloadURL) {
        fileCandidates.push({ url: fp.downloadURL, docType: "PropertyImage" });
      }
    });
  }
  if (input.primaryParcelImageUrl) {
    fileCandidates.push({
      url: input.primaryParcelImageUrl,
      docType: "PropertyImage",
    });
  }
  if (input.mapImageUrl) {
    fileCandidates.push({ url: input.mapImageUrl, docType: "PropertyImage" });
  }

  fileCandidates.forEach((fc) => {
    fileIdx += 1;
    const fmt = inferFileFormatFromUrl(fc.url);
    const name = basenameFromUrl(fc.url);
    const fileFileName = `file_${fileIdx}.json`;
    const documentType = mapFileDocumentType(
      fc.docType !== undefined ? fc.docType : fc.document_type,
    );
    const fileObj = {
      document_type: documentType ?? null,
      file_format: fmt,
      ipfs_url: null,
      name: name,
      original_url: fc.url,
      request_identifier: requestIdentifier,
    };
    fs.writeFileSync(
      path.join("data", fileFileName),
      JSON.stringify(fileObj, null, 2),
    );


  });
}

try {
  main();
  console.log("Extraction completed.");
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
}
