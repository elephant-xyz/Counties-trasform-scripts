// Data extraction script per evaluator instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - Sales/Tax/Deed from input.html
// - Writes outputs to ./data/ 


const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function parseIntegerFromText(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[^0-9-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "--") return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

function raiseEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.split(' ').map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
}

function mapPrefixName(name) {
  const prefixes = {
    'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
    'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
    'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
    'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
    'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
  };
  return prefixes[name?.toUpperCase()] || null;
}

function mapSuffixName(name) {
  const suffixes = {
    'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
    'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
    'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
    'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
  };
  return suffixes[name?.toUpperCase()] || null;
}

function makePropertyUseMapping({
  property_type,
  property_usage_type,
  build_status = "Improved",
  structure_form = null,
  ownership_estate_type = "FeeSimple",
}) {
  return {
    property_type,
    property_usage_type: property_usage_type ?? null,
    build_status: build_status ?? null,
    structure_form: structure_form ?? null,
    ownership_estate_type: ownership_estate_type ?? null,
  };
}

const PROPERTY_USE_DEFINITIONS = new Map([
  ["ANY", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: null,
    ownership_estate_type: null,
  })],
  ["VACANT", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
  })],
  ["SINGLE FAMILY", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  })],
  ["MOBILE HOME", makePropertyUseMapping({
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    structure_form: "MobileHome",
  })],
  ["MULTI-FAM", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10",
  })],
  ["MULTI-FAM 10+", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10",
  })],
  ["CONDOMINIA", makePropertyUseMapping({
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Condominium",
  })],
  ["COOPERATIVES", makePropertyUseMapping({
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Cooperative",
  })],
  ["RETIREMENT HOMES", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "HomesForAged",
    structure_form: "MultiFamilyMoreThan10",
  })],
  ["MISC IMPROVED", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "TransitionalProperty",
  })],
  ["VACANT COMMERCIAL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Commercial",
    build_status: "VacantLand",
  })],
  ["STORES/1 STORY", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "RetailStore",
  })],
  ["CONV STORE/GAS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "ServiceStation",
  })],
  ["MXD RES/OFF/STO", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Commercial",
  })],
  ["DEPARTMNT STORE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "DepartmentStore",
  })],
  ["SUPERMARKET", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Supermarket",
  })],
  ["REGIONAL SHOPPING", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
  })],
  ["COMMUNITY SHOPPING", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
  })],
  ["OFFICE BLD 1STY", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  })],
  ["OFFCE BLD M/STY", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  })],
  ["PROFESS OFF/BLD", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  })],
  ["TRANSIT TERMINL", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
  })],
  ["RESTAURANT/CAFE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Restaurant",
  })],
  ["DRIVE-IN REST.", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Restaurant",
  })],
  ["FINANCIAL BLDG", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
  })],
  ["INSURANCE COMP", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
  })],
  ["REPAIR SERVICE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Commercial",
  })],
  ["BEAUTY PARLOR", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Commercial",
  })],
  ["SERVICE STATION", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "ServiceStation",
  })],
  ["VEH SALE/REPAIR", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
  })],
  ["RV/MH PK ,PK/LOT", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
  })],
  ["WHOLESALE OUTLET", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
  })],
  ["FLORIST/GREENHOUSE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "NurseryGreenhouse",
  })],
  ["DRIVE-IN/OPEN STAD", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
  })],
  ["THEATER/AUDITORIUM", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Theater",
  })],
  ["NIGHTCLUB/BARS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
  })],
  ["BOWL,RINKS,POOL", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
  })],
  ["TOURIST ATTRACTION", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Entertainment",
  })],
  ["CAMPS", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Recreational",
  })],
  ["RACE TRACKS,ALL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "RaceTrack",
  })],
  ["GOLF COURSES", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
  })],
  ["HOTELS/MOTELS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Hotel",
  })],
  ["VACANT INDUSTRIAL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Industrial",
    build_status: "VacantLand",
  })],
  ["LIGHT MANUFACTURE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "LightManufacturing",
  })],
  ["HEAVY INDUSTRL", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
  })],
  ["LUMBER YARD", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "LumberYard",
  })],
  ["PACKING PLANTS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PackingPlant",
  })],
  ["CANNERIES/BOTTLERS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Cannery",
  })],
  ["OTHER FOOD PROCESS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PackingPlant",
  })],
  ["MINERAL PROCESSING", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "MineralProcessing",
  })],
  ["WAREHOSE/DISTRB", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Warehouse",
  })],
  ["OPEN STORAGE", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
  })],
  ["IMPROVED AG", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
  })],
  ["CROPLAND", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "DrylandCropland",
  })],
  ["TIMBERLAND", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
  })],
  ["PASTURELAND", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "ImprovedPasture",
  })],
  ["GROVES,ORCHRD", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
  })],
  ["POULT,BEES,FISH, ETC", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
  })],
  ["DAIRIES,FEEDLOTS", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
  })],
  ["MISC AG", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
  })],
  ["VAC INSTITUTIONAL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: null,
  })],
  ["CHURCHES", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Church",
    ownership_estate_type: null,
  })],
  ["PRVT SCHL/DAY CARE", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    ownership_estate_type: null,
  })],
  ["PRIVATE HOSPITALS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    ownership_estate_type: null,
  })],
  ["HOMES FOR THE AGED", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "HomesForAged",
    ownership_estate_type: null,
  })],
  ["NON-PROFIT / ORPHANA", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    ownership_estate_type: null,
  })],
  ["MORTUARY/CEMETARY", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
    ownership_estate_type: null,
  })],
  ["CLUBS/LODGES/HALLS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    ownership_estate_type: null,
  })],
  ["REST HOMES", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "SanitariumConvalescentHome",
    ownership_estate_type: null,
  })],
  ["CULTERAL GROUPS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    ownership_estate_type: null,
  })],
  ["MILITARY", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Military",
    ownership_estate_type: null,
  })],
  ["FOREST, PARKS, REC", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    ownership_estate_type: null,
  })],
  ["PUBLIC SCHOOLS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PublicSchool",
    ownership_estate_type: null,
  })],
  ["COLLEGES", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PublicSchool",
    ownership_estate_type: null,
  })],
  ["HOSPITALS", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "PublicHospital",
    ownership_estate_type: null,
  })],
  ["COUNTY", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["COUNTY RV PARK", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    ownership_estate_type: null,
  })],
  ["STATE", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["WATER MG DIST", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Utility",
    ownership_estate_type: null,
  })],
  ["SPECIAL TAXING", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["O U A", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: null,
    ownership_estate_type: null,
  })],
  ["TIITF%/SFWMD%", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["FEDERAL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["MUNICIPAL", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    ownership_estate_type: null,
  })],
  ["LEASEHOLD INTEREST", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: null,
    ownership_estate_type: "Leasehold",
  })],
  ["UTILITIES", makePropertyUseMapping({
    property_type: "Building",
    property_usage_type: "Utility",
  })],
  ["MINING", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "MineralProcessing",
  })],
  ["SUBSURFACE RGHT", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
  })],
  ["RIGHTS-OF-WAY", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
  })],
  ["RIVERS AND LAKES", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    build_status: "VacantLand",
    ownership_estate_type: null,
  })],
  ["WASTELAND/DUMPS", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "SewageDisposal",
    build_status: "VacantLand",
    ownership_estate_type: null,
  })],
  ["REC AND PARK LAND", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    ownership_estate_type: null,
  })],
  ["CENTRALLY ASSED", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "Utility",
    ownership_estate_type: null,
  })],
  ["NON AG ACREAGE", makePropertyUseMapping({
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
  })],
]);

function canonicalizeUseLabel(label) {
  if (!label) return null;
  let normalized = label.toUpperCase();
  normalized = normalized.replace(/&/g, " AND ");
  normalized = normalized.replace(/%/g, " PERCENT ");
  normalized = normalized.replace(/\bFAM\b/g, "FAMILY");
  normalized = normalized.replace(/\bCONDOMINIUMS?\b/g, "CONDOMINIA");
  normalized = normalized.replace(/\s+/g, " ");
  return normalized.replace(/[^A-Z0-9]+/g, "");
}

const PROPERTY_USE_LOOKUP = (() => {
  const map = new Map();
  for (const [label, mapping] of PROPERTY_USE_DEFINITIONS) {
    const key = canonicalizeUseLabel(label);
    if (!key) continue;
    if (map.has(key)) {
      throw new Error(
        `Duplicate property use canonical key detected for labels "${map.get(key).label}" and "${label}".`,
      );
    }
    map.set(key, { label, ...mapping });
  }
  return map;
})();

function resolvePropertyUseMapping(rawLabel) {
  if (!rawLabel) return null;
  const key = canonicalizeUseLabel(rawLabel);
  if (!key) return null;
  if (PROPERTY_USE_LOOKUP.has(key)) return PROPERTY_USE_LOOKUP.get(key);
  return null;
}

function ensureAllPropertyCodesHandled() {
  const codesPath = path.resolve(__dirname, "..", "property_use_code.txt");
  if (!fs.existsSync(codesPath)) return;
  const missing = [];
  const lines = fs
    .readFileSync(codesPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const line of lines) {
    const codeText = line.replace(/^-+\s*/, "").trim();
    if (!codeText) continue;
    const key = canonicalizeUseLabel(codeText);
    if (!PROPERTY_USE_LOOKUP.has(key)) {
      missing.push(codeText);
    }
  }
  if (missing.length) {
    throw new Error(
      `Missing property use mapping for codes: ${missing.join(", ")}`,
    );
  }
}

ensureAllPropertyCodesHandled();

const LAYOUT_NULLABLE_FIELDS = [
  "adjustable_area_sq_ft",
  "area_under_air_sq_ft",
  "bathroom_renovation_date",
  "building_number",
  "built_year",
  "cabinet_style",
  "clutter_level",
  "condition_issues",
  "countertop_material",
  "decor_elements",
  "design_style",
  "fixture_finish_quality",
  "flooring_installation_date",
  "flooring_material_type",
  "flooring_wear",
  "furnished",
  "has_windows",
  "heated_area_sq_ft",
  "installation_date",
  "kitchen_renovation_date",
  "lighting_features",
  "livable_area_sq_ft",
  "natural_light_quality",
  "paint_condition",
  "pool_condition",
  "pool_equipment",
  "pool_installation_date",
  "pool_surface_type",
  "pool_type",
  "pool_water_quality",
  "safety_features",
  "size_square_feet",
  "spa_installation_date",
  "spa_type",
  "story_type",
  "total_area_sq_ft",
  "view_type",
  "visible_damage",
  "window_design_type",
  "window_material_type",
  "window_treatment_type",
];

function applyLayoutDefaults(record, { defaultIsFinished = true } = {}) {
  const out = { ...record };
  if (out.is_finished == null) out.is_finished = defaultIsFinished;
  if (out.is_exterior == null) out.is_exterior = false;
  if (!("has_windows" in out)) out.has_windows = null;
  LAYOUT_NULLABLE_FIELDS.forEach((field) => {
    if (!(field in out)) {
      out[field] = null;
    }
  });
  return out;
}

function relationshipFileName(fromPath, toPath) {
  const normalize = (p) =>
    path.basename(String(p || "").replace(/^\.\//, "")).replace(/\.json$/i, "");
  const fromName = normalize(fromPath);
  const toName = normalize(toPath);
  return `relationship_${fromName}_has_${toName}.json`;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(value) {
  if (!value) return "";
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanOwnerString(value) {
  return decodeHtmlEntities(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOwnerMailingEntries($) {
  const entries = [];
  const ownerRows = $(".parcelDetails_insideTable tr").filter((_, tr) => {
    const firstTd = $(tr).find("td").first();
    if (!firstTd.length) return false;
    const label = cleanOwnerString(firstTd.text());
    return label.toLowerCase() === "owner";
  });

  ownerRows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const valueTd = tds.eq(1);
    const boldElements = valueTd.find("b");

    if (!boldElements.length) {
      const fallbackName = cleanOwnerString(valueTd.text());
      if (fallbackName) {
        entries.push({ name: fallbackName, address: null });
      }
      return;
    }

    boldElements.each((__, bEl) => {
      const name = cleanOwnerString($(bEl).text());
      if (!name) return;
      const segments = [];
      let node = bEl.nextSibling;
      const pushSegment = (segment) => {
        if (segment === "\n") {
          segments.push("\n");
          return;
        }
        const cleaned = cleanOwnerString(segment);
        if (cleaned) segments.push(cleaned);
      };
      while (node) {
        if (node.type === "tag" && node.name === "b") break;
        if (node.type === "tag" && node.name === "br") {
          segments.push("\n");
        } else if (node.type === "text") {
          pushSegment(node.data);
        } else if (node.type === "tag") {
          pushSegment($(node).text());
        }
        node = node.nextSibling;
      }
      const address =
        segments
          .join("")
          .split(/\n+/)
          .map((line) => cleanOwnerString(line))
          .filter(Boolean)
          .join(", ") || null;
      entries.push({ name, address });
    });
  });

  return entries;
}

function parseFloatFromText(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function computeAreaFromDimensions(dimText) {
  if (!dimText) return null;
  const m = String(dimText)
    .replace(/\u00a0/g, " ")
    .match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const width = parseFloat(m[1]);
  const length = parseFloat(m[2]);
  if (Number.isNaN(width) || Number.isNaN(length)) return null;
  return Math.round(width * length * 100) / 100;
}

function extractExtraFeatures($) {
  const features = [];
  const table = $("#parcelDetails_XFOBTable table.parcelDetails_insideTable").first();
  if (!table || !table.length) return features;
  const rows = table.find("tr").slice(1);
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 6) return;
    const code = cleanOwnerString($(tds[0]).text());
    const description = cleanOwnerString($(tds[1]).text());
    if (!description) return;
    const yearBuilt = parseIntegerFromText($(tds[2]).text());
    const valueAmount = parseCurrencyToNumber($(tds[3]).text());
    const units = parseFloatFromText($(tds[4]).text());
    const dimensions = cleanOwnerString($(tds[5]).text());
    features.push({
      code: code || null,
      description,
      yearBuilt: yearBuilt || null,
      valueAmount: valueAmount || null,
      units: units,
      dimensions: dimensions || null,
    });
  });
  return features;
}

function mapExtraFeatureSpaceType(description) {
  if (!description) return null;
  const desc = description.toUpperCase();
  const hasWord = (word) => new RegExp(`\\b${word}\\b`).test(desc);

  if (hasWord("CARPORT")) {
    if (/DET(ACHED)?/.test(desc)) return "Detached Carport";
    if (/ATT(ACHED)?/.test(desc)) return "Attached Carport";
    return "Carport";
  }

  if (hasWord("BARN")) return "Barn";
  if (hasWord("SHED")) return "Shed";
  if (hasWord("WORKSHOP")) return "Workshop";
  if (hasWord("GREENHOUSE")) return "Greenhouse";
  if (hasWord("GAZEBO")) return "Gazebo";
  if (hasWord("CABANA")) return "Enclosed Cabana";

  if (/\bOUTDOOR\s+KITCHEN\b/.test(desc) || /\bSUMMER\s+KITCHEN\b/.test(desc)) {
    return "Outdoor Kitchen";
  }

  if (hasWord("LANAI")) return "Lanai";
  if (hasWord("BALCONY")) return "Balcony";
  if (hasWord("TERRACE")) return "Terrace";
  if (hasWord("DECK")) return "Deck";

  if (hasWord("PORCH")) {
    if (desc.includes("SCREEN")) return "Screened Porch";
    return "Porch";
  }

  if (hasWord("PATIO")) return "Patio";

  if (hasWord("POOL")) {
    if (desc.includes("INDOOR")) return "Indoor Pool";
    return "Outdoor Pool";
  }

  if (/\bHOT\s*TUB\b/.test(desc) || hasWord("SPA") || hasWord("JACUZZI")) {
    return "Hot Tub / Spa Area";
  }

  if (hasWord("COURTYARD")) return "Courtyard";

  return null;
}

function extractParcelIdentifierFromHtml(html, $) {
  const candidates = [];
  const seen = new Set();
  const recordCandidate = (value) => {
    if (value == null) return;
    const normalized = decodeHtmlEntities(String(value))
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  const parcelTable = $("table.parcelIDtable").first();
  if (parcelTable && parcelTable.length) {
    recordCandidate(parcelTable.text());
    parcelTable.find("b, td, span, div").each((_, el) => {
      recordCandidate($(el).text());
    });
  }

  $("td, th, span, div").each((_, el) => {
    const text = $(el).text();
    if (!text) return;
    const trimmed = text.replace(/\u00a0/g, " ").trim();
    if (/^parcel\s*:?\s*$/i.test(trimmed)) {
      const nextCells = $(el).nextAll("td, th, span, div");
      nextCells.each((idx, sibling) => {
        const siblingText = $(sibling).text();
        if (siblingText) recordCandidate(siblingText);
        if (idx >= 1) return false;
        return true;
      });
    }
  });

  [
    $('input[name="formatPIN"]').attr("value"),
    $('input[name="Parcel_ID"]').attr("value"),
    $('input[name="ParcelID"]').attr("value"),
    $('input[name="ParcelNo"]').attr("value"),
    $('input[name="Parcel_No"]').attr("value"),
    $('input[name="PIN"]').attr("value"),
  ].forEach(recordCandidate);

  const hyphenPattern = /\b[0-9A-Z]{1,8}(?:-[0-9A-Z]{1,8}){2,5}\b/g;
  const htmlMatches = html.match(hyphenPattern);
  if (htmlMatches) {
    htmlMatches.forEach(recordCandidate);
  }

  for (const candidate of candidates) {
    const withoutParen = candidate.replace(/\(.*$/, "").trim();
    const match = withoutParen.match(/\b[0-9A-Z]{1,8}(?:-[0-9A-Z]{1,8}){2,5}\b/);
    if (match) return match[0];
  }

  return null;
}

function extractPropertyUseDetails(html, $) {
  const landUseCodeRaw = $('input[name="Land_Use"]').attr("value");
  const landUseCode = typeof landUseCodeRaw === "string" ? landUseCodeRaw.trim() : null;
  let label = null;

  if (landUseCode) {
    const escapedCode = escapeRegExp(landUseCode);
    const pattern = new RegExp(`>\\s*([^<>]*?)\\s*\\(${escapedCode}\\)`, "gi");
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const candidate = decodeHtmlEntities(match[1] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!candidate) continue;
      if (candidate === landUseCode) continue;
      if (/^[0-9A-Z-]+$/.test(candidate) && /\d/.test(candidate) && candidate.includes("-")) continue;
      label = candidate;
      break;
    }
  }

  if (!label) {
    const buildingDesc = $("#parcelDetails_BldgTable table.parcelDetails_insideTable tr")
      .eq(1)
      .find("td")
      .eq(1)
      .text()
      .trim();
    if (buildingDesc) {
      label = decodeHtmlEntities(buildingDesc).replace(/\(\s*\d{4}\s*\)\s*$/, "").trim();
    }
  }

  if (!label) {
    const tdText = $('td:contains("Use Code")').first().next().text().trim();
    if (tdText) label = tdText;
  }

  if (!label && landUseCode) {
    label = landUseCode;
  }

  return {
    code: landUseCode,
    label: label ? label.replace(/\s+/g, " ").trim() : null,
  };
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");
  const structureDataPath = path.join("owners", "structure_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJson(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJson(utilitiesDataPath)
    : null;
  const layoutData = fs.existsSync(layoutDataPath)
    ? readJson(layoutDataPath)
    : null;
  const structureData = fs.existsSync(structureDataPath)
    ? readJson(structureDataPath)
    : null;

  const propertySeed = fs.existsSync("property_seed.json")
    ? readJson("property_seed.json")
    : null;
  const unnormalizedAddress = fs.existsSync("unnormalized_address.json")
    ? readJson("unnormalized_address.json")
    : null;

  // Determine hyphenated parcel id from HTML
  let hyphenParcel = extractParcelIdentifierFromHtml(html, $);
  if (!hyphenParcel) {
    const parcelText = $("table.parcelIDtable b").first().text().trim();
    const mParcel = parcelText.match(/^([^\s(]+)/); // Matches "23-4S-16-03099-117" from "23-4S-16-03099-117 (14877)"
    if (mParcel) hyphenParcel = mParcel[1];
  }
  if (!hyphenParcel) {
    const fmt = $('input[name="formatPIN"]').attr("value");
    if (fmt) hyphenParcel = fmt.trim();
  }

  const requestIdentifier =
    propertySeed?.request_identifier ||
    propertySeed?.parcel_id ||
    hyphenParcel ||
    null;

  const sourceHttpRequest =
    propertySeed?.source_http_request ||
    propertySeed?.entry_http_request || {
      method: "GET",
      url:
        propertySeed?.source_http_request?.url ||
        propertySeed?.entry_http_request?.url ||
        "https://www.bradfordappraiser.com/gis",
    };

  const key = hyphenParcel ? `property_${hyphenParcel}` : null;

  let buildingRowsData = [];
  let propertyLivableAreaSqFt = null;
  let propertyTotalAreaSqFt = null;
  let propertyTypeValue = null;

  // Cache layout source data for later hierarchy creation
  let layoutSourceLayouts = [];
  if (layoutData) {
    const layScope = key && layoutData[key] ? layoutData[key] : null;
    if (layScope && Array.isArray(layScope.layouts)) {
      layoutSourceLayouts = layScope.layouts;
    }
  }

  const extraFeatures = extractExtraFeatures($);

  const ownerMailingEntries = extractOwnerMailingEntries($);
  const primaryMailingEntry =
    ownerMailingEntries.find((entry) => entry.address) ||
    ownerMailingEntries[0] ||
    null;
  const mailingAddressRecord = {
    source_http_request: sourceHttpRequest,
    request_identifier: requestIdentifier,
    unnormalized_address: primaryMailingEntry?.address || null,
    latitude: null,
    longitude: null,
  };
  const mailingAddressFilePath = path.join("data", "mailing_address.json");
  const mailingAddressPathRef = "./mailing_address.json";
  let mailingAddressWritten = false;

  // 1) OWNERS
  if (ownerData) {
    const ownersScope = key && ownerData[key] ? ownerData[key] : null;
    if (
      ownersScope &&
      ownersScope.owners_by_date &&
      Array.isArray(ownersScope.owners_by_date.current)
    ) {
      const currentOwners = ownersScope.owners_by_date.current;
      let companyIndex = 0;
      let personIndex = 0;
      const companyFiles = [];
      const personFiles = [];
      for (const ow of currentOwners) {
        if (ow.type === "company") {
          companyIndex += 1;
          const company = {
            name: ow.name || null,
            request_identifier: requestIdentifier,
            source_http_request: sourceHttpRequest,
          };
          writeJson(path.join("data", `company_${companyIndex}.json`), company);
          companyFiles.push(`./company_${companyIndex}.json`);
          if (!mailingAddressWritten) {
            writeJson(mailingAddressFilePath, mailingAddressRecord);
            mailingAddressWritten = true;
          }
          const mailingRelationshipName = relationshipFileName(
            `./company_${companyIndex}.json`,
            mailingAddressPathRef,
          );
          writeJson(path.join("data", mailingRelationshipName), {
            from: { "/": `./company_${companyIndex}.json` },
            to: { "/": mailingAddressPathRef },
          });
        } else if (ow.type === "person") {
          personIndex += 1;
          const person = {
            source_http_request: sourceHttpRequest,
            request_identifier: requestIdentifier,
            birth_date: null,
            first_name: formatNameToPattern(ow.first_name),
            last_name: formatNameToPattern(ow.last_name),
            middle_name: ow.middle_name ? formatNameToPattern(ow.middle_name) : null,
            prefix_name: mapPrefixName(ow.prefix_name),
            suffix_name: mapSuffixName(ow.suffix_name),
            us_citizenship_status: null,
            veteran_status: null,
          };
          writeJson(path.join("data", `person_${personIndex}.json`), person);
          personFiles.push(`./person_${personIndex}.json`);
          if (!mailingAddressWritten) {
            writeJson(mailingAddressFilePath, mailingAddressRecord);
            mailingAddressWritten = true;
          }
          const mailingRelationshipName = relationshipFileName(
            `./person_${personIndex}.json`,
            mailingAddressPathRef,
          );
          writeJson(path.join("data", mailingRelationshipName), {
            from: { "/": `./person_${personIndex}.json` },
            to: { "/": mailingAddressPathRef },
          });
        }
      }
      globalThis.__ownerCompanyFiles = companyFiles;
      globalThis.__ownerPersonFiles = personFiles;
      companyFiles.forEach((companyPath) => {
        const relName = relationshipFileName("./property.json", companyPath);
        writeJson(path.join("data", relName), {
          from: { "/": "./property.json" },
          to: { "/": companyPath },
        });
      });
      personFiles.forEach((personPath) => {
        const relName = relationshipFileName("./property.json", personPath);
        writeJson(path.join("data", relName), {
          from: { "/": "./property.json" },
          to: { "/": personPath },
        });
      });
    }
  }

  // 2) UTILITIES
  let utilScope = null;
  if (utilitiesData) {
    utilScope = key && utilitiesData[key] ? utilitiesData[key] : null;
    if (utilScope) {
      const utilityRecord = {
        ...utilScope,
        request_identifier: requestIdentifier,
        source_http_request: sourceHttpRequest,
      };
      writeJson(path.join("data", "utility.json"), utilityRecord);
    }
  }

  // 3) SALES + DEEDS + FILES
  const salesRows = [];
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
    (idx, el) => {
      if (idx === 0) return; // Skip header row
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const dateTxt = $(tds[0]).text().trim();
        const priceTxt = $(tds[1]).text().trim();
        const bookPageTxt = $(tds[2]).text().trim();
        const deedCode = $(tds[3]).text().trim();
        if (dateTxt && /\d/.test(dateTxt)) {
          const linkEl = $(tds[2]).find("a");
          let clerkRef = null;
          const href = linkEl.attr("href") || "";
          const onClick = linkEl.attr("onclick") || "";
          const js = href || onClick;
          // Extract book and page from ClerkLink('book','page')
          const m1 = js.match(/ClerkLink\('([^']+)'\s*,\s*'([^']+)'\)/);
          if (m1) clerkRef = `${m1[1]}/${m1[2]}`; // Format as "book/page"
          salesRows.push({
            dateTxt,
            priceTxt,
            deedCode,
            bookPageTxt,
            clerkRef,
            validity: $(tds[4]).text().trim() || null,
            qualification: tds.length >= 6 ? $(tds[5]).text().trim() || null : null,
            rcode: tds.length >= 7 ? $(tds[6]).text().trim() || null : null,
          });
        }
      }
    },
  );

  function mapDeedType(code) {
    const normalized = (code || "").toUpperCase();
    const deedTypes = {
      WD: "Warranty Deed",
      WTY: "Warranty Deed",
      SWD: "Special Warranty Deed",
      SW: "Special Warranty Deed",
      "SPEC WD": "Special Warranty Deed",
      QCD: "Quitclaim Deed",
      QC: "Quitclaim Deed",
      QUITCLAIM: "Quitclaim Deed",
      GD: "Grant Deed",
      BSD: "Bargain and Sale Deed",
      LBD: "Lady Bird Deed",
      TOD: "Transfer on Death Deed",
      TODD: "Transfer on Death Deed",
      SD: "Sheriff's Deed",
      "SHRF'S DEED": "Sheriff's Deed",
      TD: "Tax Deed",
      TRD: "Trustee's Deed",
      "TRUSTEE DEED": "Trustee's Deed",
      PRD: "Personal Representative Deed",
      "PERS REP DEED": "Personal Representative Deed",
      CD: "Correction Deed",
      "CORR DEED": "Correction Deed",
      DIL: "Deed in Lieu of Foreclosure",
      DILF: "Deed in Lieu of Foreclosure",
      LED: "Life Estate Deed",
      JTD: "Joint Tenancy Deed",
      TIC: "Tenancy in Common Deed",
      CPD: "Community Property Deed",
      "GIFT DEED": "Gift Deed",
      ITD: "Interspousal Transfer Deed",
      "WILD D": "Wild Deed",
      SMD: "Special Master's Deed",
      COD: "Court Order Deed",
      CFD: "Contract for Deed",
      QTD: "Quiet Title Deed",
      AD: "Administrator's Deed",
      "GD (GUARDIAN)": "Guardian's Deed",
      RD: "Receiver's Deed",
      ROW: "Right of Way Deed",
      VPD: "Vacation of Plat Deed",
    };
    return deedTypes[normalized] || null;
  }

  function determineFileDocumentType(code) {
    if (!code) return null;
    const normalized = code.toUpperCase();
    const titleCodes = new Set([
      "WD",
      "WTY",
      "SWD",
      "SW",
      "SPEC WD",
      "QCD",
      "QC",
      "QUITCLAIM",
      "GD",
      "BSD",
      "LBD",
      "TOD",
      "TODD",
      "SD",
      "SHRF'S DEED",
      "TD",
      "TRD",
      "TRUSTEE DEED",
      "PRD",
      "PERS REP DEED",
      "CD",
      "CORR DEED",
      "DIL",
      "DILF",
      "LED",
      "JTD",
      "TIC",
      "CPD",
      "GIFT DEED",
      "ITD",
      "WILD D",
      "SMD",
      "COD",
      "CFD",
      "QTD",
      "AD",
      "GD (GUARDIAN)",
      "RD",
      "ROW",
      "VPD",
    ]);
    return titleCodes.has(normalized) ? "Title" : null;
  }

  function parseRecordingReference(row) {
    const ref = row.bookPageTxt || row.clerkRef || "";
    const m = ref.match(/(\d+)\s*\/\s*(\d+)/);
    const book = m ? m[1] : null;
    const page = m ? m[2] : null;
    const instrumentMatch = ref.match(/instrument\s*#?\s*(\w+)/i);
    return {
      book: book || null,
      page: page || null,
      volume: null,
      instrument_number: instrumentMatch ? instrumentMatch[1] : null,
    };
  }

  const saleHistoryEntries = [];
  let saleIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;

  for (const row of salesRows) {
    saleIndex += 1;
    const saleFileName = `sales_history_${saleIndex}.json`;
    const salePath = `./${saleFileName}`;
    const sale = {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      ownership_transfer_date: parseDateToISO(row.dateTxt),
      purchase_price_amount: parseCurrencyToNumber(row.priceTxt),
      sale_type: "TypicallyMotivated",
    };
    writeJson(path.join("data", saleFileName), sale);
    const propertySaleRel = relationshipFileName("./property.json", salePath);
    writeJson(path.join("data", propertySaleRel), {
      from: { "/": "./property.json" },
      to: { "/": salePath },
    });

    const recording = parseRecordingReference(row);
    const deedType = mapDeedType(row.deedCode) || "Miscellaneous";
    deedIndex += 1;
    const deedFileName = `deed_${deedIndex}.json`;
    const deed = {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      deed_type: deedType,
    };
    if (recording.book) deed.book = recording.book;
    if (recording.page) deed.page = recording.page;
    if (recording.volume) deed.volume = recording.volume;
    if (recording.instrument_number) deed.instrument_number = recording.instrument_number;
    writeJson(path.join("data", deedFileName), deed);

    const saleDeedRel = relationshipFileName(salePath, `./${deedFileName}`);
    writeJson(path.join("data", saleDeedRel), {
      from: { "/": salePath },
      to: { "/": `./${deedFileName}` },
    });

    fileIndex += 1;
    const fileName = `file_${fileIndex}.json`;
    const fileRec = {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      document_type: determineFileDocumentType(row.deedCode),
      file_format: null,
      name: row.clerkRef
        ? `Official Records ${row.clerkRef}`
        : row.bookPageTxt
          ? `Book/Page ${row.bookPageTxt}`
          : null,
      original_url: null,
      ipfs_url: null,
    };
    writeJson(path.join("data", fileName), fileRec);
    const deedFileRel = relationshipFileName(
      `./${deedFileName}`,
      `./${fileName}`,
    );
    writeJson(path.join("data", deedFileRel), {
      from: { "/": `./${deedFileName}` },
      to: { "/": `./${fileName}` },
    });

    saleHistoryEntries.push({
      path: salePath,
      isoDate: sale.ownership_transfer_date,
      index: saleIndex,
    });
  }

  if (saleHistoryEntries.length > 0) {
    const buyerPaths = [
      ...(globalThis.__ownerCompanyFiles || []),
      ...(globalThis.__ownerPersonFiles || []),
    ];
    if (buyerPaths.length > 0) {
      const latest = saleHistoryEntries.reduce((prev, curr) => {
        if (!prev) return curr;
        if (!prev.isoDate) return curr;
        if (!curr.isoDate) return prev;
        return curr.isoDate > prev.isoDate ? curr : prev;
      }, null);
      if (latest) {
        buyerPaths.forEach((buyerPath) => {
          const relName = relationshipFileName(latest.path, buyerPath);
          writeJson(path.join("data", relName), {
            from: { "/": latest.path },
            to: { "/": buyerPath },
          });
        });
      }
    }
  }

  // 5) TAX
  function buildTaxFromSection(sectionTitleContains, taxYear) {
    let table = null;
    $("table.parcelDetails_insideTable").each((i, el) => {
      const head = $(el).find("tr").first().text();
      if (head && head.includes(sectionTitleContains)) {
        table = $(el);
        return false;
      }
      return true;
    });
    if (!table) return null;
    function findRow(label) {
      let out = null;
      table.find("tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 2) {
          const lab = $(tds[0]).text().trim();
          if (lab.startsWith(label)) {
            out = $(tds[1]).text().trim();
            return false;
          }
        }
        return true;
      });
      return out;
    }
    const land = findRow("Mkt Land");
    const bldg = findRow("Building");
    const just = findRow("Just");
    const assessed = findRow("Assessed");
    let taxable = null;
    table.find("tr").each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (label.startsWith("Total")) {
          const htmlContent = $(tds[1]).html() || "";
          // Look for "county:$" pattern first
          const m = htmlContent.replace(/\n/g, " ").match(/county:\s*\$([0-9,\.]+)/i);
          if (m) taxable = m[1];
          else {
            // Fallback to general currency regex if "county:" not found
            const text = $(tds[1]).text();
            const m2 = text.match(/\$[0-9,\.]+/);
            if (m2) taxable = m2[0];
          }
        }
      }
    });
    if (!land || !bldg || !just || !assessed || !taxable) return null;
    return {
      tax_year: taxYear,
      property_assessed_value_amount: parseCurrencyToNumber(assessed),
      property_market_value_amount: parseCurrencyToNumber(just),
      property_building_amount: parseCurrencyToNumber(bldg),
      property_land_amount: parseCurrencyToNumber(land),
      property_taxable_value_amount: parseCurrencyToNumber(taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
  }
  const tax2025 = buildTaxFromSection("2025 Preliminary Values", 2025); // Updated year and section title
  if (tax2025) writeJson(path.join("data", "tax_2025.json"), tax2025);
  const tax2024 = buildTaxFromSection("2024 Certified Values", 2024); // Added 2024 tax data
  if (tax2024) writeJson(path.join("data", "tax_2024.json"), tax2024);

  // 6) PROPERTY
  try {
    const parcelIdentifier =
      hyphenParcel || (propertySeed && propertySeed.parcel_id) || null;

    // Clean full legal text without UI anchor artifacts
    let legal = null;
    if ($("#Flegal").length) {
      const f = $("#Flegal").clone();
      f.find("a").remove();
      legal = f.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
    } else if ($("#Blegal").length) {
      const b = $("#Blegal").clone();
      b.find("a").remove();
      legal = b.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
    }

    // livable and effective year
    let livable = null;
    let effYear = null;
    const bldgTable = $(
      "#parcelDetails_BldgTable table.parcelDetails_insideTable",
    ).first();
    if (bldgTable && bldgTable.length) {
      const tempBuildingRows = [];
      bldgTable.find("tr").each((idx, row) => {
        if (idx === 0) return;
        const cells = $(row).find("td");
        if (cells.length >= 6) {
          const description = cells.eq(1).text().trim() || null;
          const yearBuilt = parseIntegerFromText(cells.eq(2).text().trim());
          const baseSqFt = parseIntegerFromText(cells.eq(3).text().trim());
          const actualSqFt = parseIntegerFromText(cells.eq(4).text().trim());
          if (yearBuilt != null && effYear == null) effYear = yearBuilt;
          tempBuildingRows.push({
            description,
            yearBuilt,
            baseSqFt,
            actualSqFt,
          });
        }
      });
      if (tempBuildingRows.length) {
        buildingRowsData = tempBuildingRows;
        const primaryRow =
          tempBuildingRows.find((row) => row.actualSqFt != null) ||
          tempBuildingRows[0];
        if (primaryRow) {
          if (primaryRow.actualSqFt != null) livable = primaryRow.actualSqFt;
          if (effYear == null && primaryRow.yearBuilt != null) {
            effYear = primaryRow.yearBuilt;
          }
        }
      }
    }
    if (livable == null && bldgTable && bldgTable.length) {
      const firstRow = bldgTable.find("tr").eq(1);
      const tds = firstRow.find("td");
      if (tds.length >= 6) {
        const actualSF = parseIntegerFromText(tds.eq(4).text().trim());
        if (actualSF != null) livable = actualSF;
        const y = parseIntegerFromText(tds.eq(2).text().trim());
        if (y != null) effYear = y;
      }
    }

    // Extract Area and convert to square feet
    let totalAreaSqft = null;
    const landAreaTd = $('td:contains("Land Area")').first();
    if (landAreaTd.length) {
      const areaText = landAreaTd.next('td').text().trim();
      const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
      if (acreMatch) {
        const acres = parseFloat(acreMatch[1]);
        const totalSqFt = Math.round(acres * 43560);
        totalAreaSqft = totalSqFt.toString(); // 1 acre = 43,560 sq ft
        propertyTotalAreaSqFt = totalSqFt;
      }
    }

    const { code: landUseCode, label: propertyUseLabel } = extractPropertyUseDetails(html, $);
    const propertyUseMapping = propertyUseLabel
      ? resolvePropertyUseMapping(propertyUseLabel)
      : null;
    if (!propertyUseMapping) {
      throw {
        type: "error",
        message: `Missing property use mapping for label "${propertyUseLabel || "Unknown"}" (code: ${landUseCode || "N/A"}).`,
        path: "property.property_type",
      };
    }

    const {
      property_type: mappedPropertyType,
      build_status: buildStatusValue,
      property_usage_type: propertyUsageTypeValue,
      structure_form: structureFormValue,
      ownership_estate_type: ownershipEstateTypeValue,
      label: propertyUseCanonicalLabel,
    } = propertyUseMapping;

    if (!mappedPropertyType) {
      throw {
        type: "error",
        message: `Property use mapping for "${propertyUseCanonicalLabel}" does not include a property_type.`,
        path: "property.property_type",
      };
    }
    propertyTypeValue = mappedPropertyType;
    if (typeof livable === "number") {
      propertyLivableAreaSqFt = livable;
    } else if (livable != null) {
      const parsedLivable = parseIntegerFromText(livable);
      propertyLivableAreaSqFt = parsedLivable;
      livable = parsedLivable;
    }

    const prop = {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      livable_floor_area: livable ? String(livable) : null,
      parcel_identifier: parcelIdentifier,
      property_legal_description_text: legal || null,
      property_structure_built_year: effYear || null,
      property_effective_built_year: effYear || null,
      property_type: propertyTypeValue,
      build_status: buildStatusValue ?? null,
      property_usage_type: propertyUsageTypeValue ?? null,
      structure_form: structureFormValue ?? null,
      ownership_estate_type: ownershipEstateTypeValue ?? null,
      area_under_air: livable ? String(livable) : null,
      historic_designation: false,
      number_of_units: null,
      subdivision: null,
      total_area: totalAreaSqft,
      zoning: null,
    };
    writeJson(path.join("data", "property.json"), prop);
  } catch (e) {
    console.error("Error processing property data:", e);
  }

  // 7) LAYOUT, STRUCTURE, AND UTILITY HIERARCHY
  try {
    const structureScopeRaw =
      structureData && key && structureData[key] ? structureData[key] : null;
    const structureFiles = [];
    if (structureScopeRaw) {
      let structureArray = [];
      if (Array.isArray(structureScopeRaw)) {
        structureArray = structureScopeRaw;
      } else if (Array.isArray(structureScopeRaw.structures)) {
        structureArray = structureScopeRaw.structures;
      } else {
        structureArray = [structureScopeRaw];
      }
      structureArray.forEach((structureItem) => {
        if (!structureItem || typeof structureItem !== "object") return;
        const structureIndex = structureFiles.length + 1;
        const structureRecord = {
          ...structureItem,
          request_identifier: requestIdentifier,
          source_http_request: sourceHttpRequest,
        };
        const structureFileName = `structure_${structureIndex}.json`;
        writeJson(path.join("data", structureFileName), structureRecord);
        structureFiles.push({
          index: structureIndex,
          path: `./${structureFileName}`,
        });
      });
    }

    const buildingLayoutsMeta = [];
    let layoutFileCounter = 0;
    const nextLayoutFileInfo = () => {
      layoutFileCounter += 1;
      const name = `layout_${layoutFileCounter}.json`;
      return { name, path: `./${name}` };
    };
    const buildingLayoutsRequired =
      propertyTypeValue && propertyTypeValue !== "LandParcel";

    if (buildingLayoutsRequired) {
      let determinedBuildingCount = buildingRowsData.length;
      const numberOfBuildingsFromStructure =
        structureScopeRaw && typeof structureScopeRaw.number_of_buildings === "number"
          ? structureScopeRaw.number_of_buildings
          : null;
      if (!determinedBuildingCount && numberOfBuildingsFromStructure) {
        determinedBuildingCount = numberOfBuildingsFromStructure;
      }
      if (!determinedBuildingCount || determinedBuildingCount < 1) {
        determinedBuildingCount = 1;
      }

      const propertyPath = "./property.json";

      for (let i = 0; i < determinedBuildingCount; i += 1) {
        const buildingIndex = i + 1;
        const buildingRow = buildingRowsData[i] || buildingRowsData[0] || null;
        const totalAreaSqFt =
          buildingRow?.actualSqFt ??
          propertyLivableAreaSqFt ??
          propertyTotalAreaSqFt ??
          null;
        const livableAreaSqFt =
          buildingRow?.actualSqFt ?? propertyLivableAreaSqFt ?? null;

        const buildingLayoutInfo = nextLayoutFileInfo();
        const buildingLayoutRecord = {
          source_http_request: sourceHttpRequest,
          request_identifier: requestIdentifier,
          space_type: "Building",
          space_type_index: `${buildingIndex}`,
          total_area_sq_ft: totalAreaSqFt,
          livable_area_sq_ft: livableAreaSqFt,
          size_square_feet: totalAreaSqFt,
          area_under_air_sq_ft: livableAreaSqFt,
          heated_area_sq_ft: livableAreaSqFt,
          built_year: buildingRow?.yearBuilt ?? null,
        };
        const finalizedBuildingLayout = applyLayoutDefaults(
          buildingLayoutRecord,
          { defaultIsFinished: true },
        );
        writeJson(
          path.join("data", buildingLayoutInfo.name),
          finalizedBuildingLayout,
        );
        buildingLayoutsMeta.push({
          index: buildingIndex,
          path: buildingLayoutInfo.path,
        });
        const buildingLayoutRelationshipName = relationshipFileName(
          propertyPath,
          buildingLayoutInfo.path,
        );
        writeJson(path.join("data", buildingLayoutRelationshipName), {
          from: { "/": propertyPath },
          to: { "/": buildingLayoutInfo.path },
        });

        let roomSources = [];
        if (layoutSourceLayouts.length > 0) {
          if (determinedBuildingCount === 1) {
            roomSources = layoutSourceLayouts;
          } else if (layoutSourceLayouts.length >= determinedBuildingCount) {
            const candidate = layoutSourceLayouts[i];
            if (candidate) roomSources = [candidate];
          } else if (i === 0) {
            roomSources = layoutSourceLayouts;
          }
        }

        if (roomSources && roomSources.length > 0) {
          let localRoomCounter = 0;
          roomSources.forEach((roomSource) => {
            localRoomCounter += 1;
            const roomLayoutInfo = nextLayoutFileInfo();
            const roomIndex = `${buildingIndex}.${localRoomCounter}`;
            const roomRecord = {
              ...roomSource,
              source_http_request: sourceHttpRequest,
              request_identifier: requestIdentifier,
              space_type_index: roomIndex,
            };
            if (!roomRecord.space_type) {
              roomRecord.space_type = roomSource.space_type || "Room";
            }
            if ("space_index" in roomRecord) {
              delete roomRecord.space_index;
            }
            const finalizedRoomLayout = applyLayoutDefaults(roomRecord, {
              defaultIsFinished:
                typeof roomSource?.is_finished === "boolean"
                  ? roomSource.is_finished
                  : true,
            });
            writeJson(
              path.join("data", roomLayoutInfo.name),
              finalizedRoomLayout,
            );
            const relationshipName = relationshipFileName(
              buildingLayoutInfo.path,
              roomLayoutInfo.path,
            );
            writeJson(path.join("data", relationshipName), {
              from: { "/": buildingLayoutInfo.path },
              to: { "/": roomLayoutInfo.path },
            });
          });
        }
      }

      if (utilScope) {
        if (buildingLayoutsMeta.length === 1) {
          const relName = relationshipFileName(
            buildingLayoutsMeta[0].path,
            "./utility.json",
          );
          writeJson(path.join("data", relName), {
            from: { "/": buildingLayoutsMeta[0].path },
            to: { "/": "./utility.json" },
          });
        } else if (buildingLayoutsMeta.length > 1) {
          const relName = relationshipFileName("./property.json", "./utility.json");
          writeJson(path.join("data", relName), {
            from: { "/": "./property.json" },
            to: { "/": "./utility.json" },
          });
        }
      }

      if (structureFiles.length > 0) {
        if (buildingLayoutsMeta.length === 1) {
          structureFiles.forEach((structure) => {
            const relName = relationshipFileName(
              buildingLayoutsMeta[0].path,
              structure.path,
            );
            writeJson(path.join("data", relName), {
              from: { "/": buildingLayoutsMeta[0].path },
              to: { "/": structure.path },
            });
          });
        } else if (
          structureFiles.length === buildingLayoutsMeta.length + 1
        ) {
          structureFiles.forEach((structure, idx) => {
            if (idx < buildingLayoutsMeta.length) {
              const buildingMeta = buildingLayoutsMeta[idx];
              const relName = relationshipFileName(
                buildingMeta.path,
                structure.path,
              );
              writeJson(path.join("data", relName), {
                from: { "/": buildingMeta.path },
                to: { "/": structure.path },
              });
            } else {
              const relName = relationshipFileName("./property.json", structure.path);
              writeJson(path.join("data", relName), {
                from: { "/": "./property.json" },
                to: { "/": structure.path },
              });
            }
          });
        } else if (structureFiles.length >= buildingLayoutsMeta.length) {
          structureFiles.forEach((structure, idx) => {
            if (idx < buildingLayoutsMeta.length) {
              const buildingMeta = buildingLayoutsMeta[idx];
              const relName = relationshipFileName(
                buildingMeta.path,
                structure.path,
              );
              writeJson(path.join("data", relName), {
                from: { "/": buildingMeta.path },
                to: { "/": structure.path },
              });
            } else {
              const relName = relationshipFileName("./property.json", structure.path);
              writeJson(path.join("data", relName), {
                from: { "/": "./property.json" },
                to: { "/": structure.path },
              });
            }
          });
        } else {
          // Fewer structures than buildings: map structures to the property per hierarchy guidance
          structureFiles.forEach((structure) => {
            const relName = relationshipFileName("./property.json", structure.path);
            writeJson(path.join("data", relName), {
              from: { "/": "./property.json" },
              to: { "/": structure.path },
            });
          });
        }
      }
    } else {
      if (structureFiles.length > 0) {
        structureFiles.forEach((structure) => {
          const relName = relationshipFileName("./property.json", structure.path);
          writeJson(path.join("data", relName), {
            from: { "/": "./property.json" },
            to: { "/": structure.path },
          });
        });
      }
      if (utilScope) {
        const relName = relationshipFileName("./property.json", "./utility.json");
        writeJson(path.join("data", relName), {
          from: { "/": "./property.json" },
          to: { "/": "./utility.json" },
        });
      }
    }

    if (extraFeatures.length > 0) {
      let featureLayoutCount = 0;
      extraFeatures.forEach((feature) => {
        const mappedSpaceType = mapExtraFeatureSpaceType(feature.description);
        if (!mappedSpaceType) return;
        const layoutInfo = nextLayoutFileInfo();
        const areaFromDim = computeAreaFromDimensions(feature.dimensions);
        let sizeSqFt =
          areaFromDim != null && areaFromDim > 0
            ? areaFromDim
            : feature.units != null && feature.units > 0
              ? feature.units
              : null;
        if (sizeSqFt != null && sizeSqFt <= 0) sizeSqFt = null;
        featureLayoutCount += 1;
        const spaceTypeIndex = String(
          buildingLayoutsMeta.length + featureLayoutCount,
        );
        const featureRecord = {
          source_http_request: sourceHttpRequest,
          request_identifier: requestIdentifier,
          space_type: mappedSpaceType,
          space_type_index: spaceTypeIndex,
          size_square_feet: sizeSqFt,
          total_area_sq_ft: sizeSqFt,
          livable_area_sq_ft: null,
          area_under_air_sq_ft: null,
          heated_area_sq_ft: null,
          built_year: feature.yearBuilt,
          is_finished: false,
          is_exterior: true,
        };
        const finalizedFeatureLayout = applyLayoutDefaults(featureRecord, {
          defaultIsFinished: false,
        });
        writeJson(path.join("data", layoutInfo.name), finalizedFeatureLayout);
        const relName = relationshipFileName("./property.json", layoutInfo.path);
        writeJson(path.join("data", relName), {
          from: { "/": "./property.json" },
          to: { "/": layoutInfo.path },
        });
      });
    }
  } catch (e) {
    console.error("Error processing layout hierarchy:", e);
  }

  // 8) LOT
  try {
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable",
    ).eq(1); // Assuming the first data row in Land Breakdown
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 6) {
      const unitsTxt = tds.eq(2).text(); // e.g., "1.000 LT  (0.540 AC)"
      const mSf = unitsTxt.match(/([0-9,.]+)\s*SF/i);
      const mAc = unitsTxt.match(/\(([^)]+)\s*AC\)/i);
      if (mSf) lotAreaSqft = Math.round(parseFloat(mSf[1].replace(/[,]/g, "")));
      if (mAc) lotSizeAcre = parseFloat(mAc[1].replace(/[,]/g, ""));
    }
    let lot_type = null;
    if (typeof lotSizeAcre === "number")
      lot_type =
        lotSizeAcre > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
    writeJson(path.join("data", "lot.json"), {
      lot_type: lot_type || null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_area_sqft: lotAreaSqft || null,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null,
      lot_size_acre: lotSizeAcre || null,
    });
  } catch (e) {
    console.error("Error processing lot data:", e);
  }

  // 9) ADDRESS
  try {
    let section = null,
      township = null,
      range = null;
    const strHeader = $('td:contains("S/T/R"), td:contains("S-T-R")')
      .filter((i, el) => {
        const txt = $(el).text().trim().toUpperCase();
        return txt === "S/T/R" || txt === "S-T-R" || txt.startsWith("S/T/R");
      })
      .first();
    if (strHeader.length) {
      const strCell = strHeader.next();
      const strText = strCell.text().trim();
      if (strText && strText.includes("-")) {
        const parts = strText.split("-");
        if (parts.length === 3) {
          [section, township, range] = parts;
        }
      }
      if ((!section || !township || !range) && strCell.html()) {
        const snippets = (strCell.html() || "")
          .split("<br>")
          .map((snippet) => $(snippet).text().trim())
          .filter(Boolean);
        if (snippets.length) {
          const parts = snippets[0].split("-");
          if (parts.length === 3) {
            section = section || parts[0];
            township = township || parts[1];
            range = range || parts[2];
          }
        }
      }
    }

    let fullAddress = null;
    if (typeof unnormalizedAddress?.full_address === "string") {
      fullAddress = unnormalizedAddress.full_address.trim();
    } else {
      const situsHeader = $('td:contains("Situs Address")')
        .filter((i, el) => $(el).text().trim() === "Situs Address")
        .first();
      if (situsHeader.length) {
        const addrCell = situsHeader.next();
        const snippets = (addrCell.html() || "")
          .split("<br>")
          .map((snippet) => $(snippet).text().trim())
          .filter(Boolean);
        if (snippets.length) fullAddress = snippets.join(", ");
      }
    }

    writeJson(path.join("data", "address.json"), {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      county_name: "Bradford",
      country_code: "US",
      unnormalized_address: fullAddress || null,
      section: section || null,
      township: township || null,
      range: range || null,
    });

    const latitude =
      typeof unnormalizedAddress?.latitude === "number"
        ? unnormalizedAddress.latitude
        : null;
    const longitude =
      typeof unnormalizedAddress?.longitude === "number"
        ? unnormalizedAddress.longitude
        : null;

    writeJson(path.join("data", "geometry.json"), {
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      latitude,
      longitude,
    });

    const addressGeometryRelationship = relationshipFileName(
      "./address.json",
      "./geometry.json",
    );
    writeJson(path.join("data", addressGeometryRelationship), {
      from: { "/": "./address.json" },
      to: { "/": "./geometry.json" },
    });
  } catch (e) {
    console.error("Error processing address data:", e);
  }
}

main();
