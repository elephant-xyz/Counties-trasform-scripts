const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Mapping of county property use codes to Elephant Lexicon enums.
const PROPERTY_USAGE_MAP = Object.freeze({
  "00": "Residential",
  "01": "Residential",
  "02": "MobileHomePark",
  "03": "Residential",
  "04": "Residential",
  "05": "Residential",
  "06": "Retirement",
  "07": "Residential",
  "08": "Residential",
  "09": "ResidentialCommonElementsAreas",
  "10": "Commercial",
  "11": "RetailStore",
  "12": "Commercial",
  "13": "DepartmentStore",
  "14": "Supermarket",
  "15": "ShoppingCenterRegional",
  "16": "ShoppingCenterCommunity",
  "17": "OfficeBuilding",
  "18": "OfficeBuilding",
  "19": "OfficeBuilding",
  "20": "TransportationTerminal",
  "21": "Restaurant",
  "22": "Restaurant",
  "23": "FinancialInstitution",
  "24": "OfficeBuilding",
  "25": "Commercial",
  "26": "ServiceStation",
  "27": "AutoSalesRepair",
  "28": "MobileHomePark",
  "29": "WholesaleOutlet",
  "30": "NurseryGreenhouse",
  "31": "Theater",
  "32": "Theater",
  "33": "Entertainment",
  "34": "Entertainment",
  "35": "Entertainment",
  "36": "Recreational",
  "37": "RaceTrack",
  "38": "GolfCourse",
  "39": "Hotel",
  "40": "Industrial",
  "41": "LightManufacturing",
  "42": "HeavyManufacturing",
  "43": "LumberYard",
  "44": "AgriculturalPackingFacility",
  "45": "Cannery",
  "46": "LightManufacturing",
  "47": "MineralProcessing",
  "48": "Warehouse",
  "49": "OpenStorage",
  "50": "Agricultural",
  "51": "DrylandCropland",
  "52": "CroplandClass2",
  "53": "CroplandClass3",
  "54": "TimberLand",
  "55": "TimberLand",
  "56": "TimberLand",
  "57": "TimberLand",
  "58": "TimberLand",
  "59": "PastureWithTimber",
  "60": "ImprovedPasture",
  "61": "GrazingLand",
  "62": "GrazingLand",
  "63": "GrazingLand",
  "64": "Rangeland",
  "65": "Rangeland",
  "66": "OrchardGroves",
  "67": "LivestockFacility",
  "68": "LivestockFacility",
  "69": "Ornamentals",
  "70": "GovernmentProperty",
  "71": "Church",
  "72": "PrivateSchool",
  "73": "PrivateHospital",
  "74": "HomesForAged",
  "75": "NonProfitCharity",
  "76": "MortuaryCemetery",
  "77": "ClubsLodges",
  "78": "SanitariumConvalescentHome",
  "79": "CulturalOrganization",
  "80": "GovernmentProperty",
  "81": "Military",
  "82": "ForestParkRecreation",
  "83": "PublicSchool",
  "84": "PublicSchool",
  "85": "PublicHospital",
  "86": "GovernmentProperty",
  "87": "GovernmentProperty",
  "88": "GovernmentProperty",
  "89": "GovernmentProperty",
  "90": "TransitionalProperty",
  "91": "Utility",
  "92": "Industrial",
  "93": "Utility",
  "94": "GovernmentProperty",
  "95": "RiversLakes",
  "96": "SewageDisposal",
  "97": "ForestParkRecreation",
  "98": "ReferenceParcel",
  "99": "Unknown",
});

const PROPERTY_TYPE_MAP = Object.freeze({
  "00": "LandParcel",
  "01": "Building",
  "02": "ManufacturedHome",
  "03": "Building",
  "04": "Unit",
  "05": "Unit",
  "06": "Building",
  "07": "Building",
  "08": "Building",
  "09": "LandParcel",
  "10": "LandParcel",
  "11": "Building",
  "12": "Building",
  "13": "Building",
  "14": "Building",
  "15": "Building",
  "16": "Building",
  "17": "Building",
  "18": "Building",
  "19": "Building",
  "20": "LandParcel",
  "21": "Building",
  "22": "Building",
  "23": "Building",
  "24": "Building",
  "25": "Building",
  "26": "Building",
  "27": "Building",
  "28": "LandParcel",
  "29": "Building",
  "30": "Building",
  "31": "Building",
  "32": "Building",
  "33": "Building",
  "34": "Building",
  "35": "Building",
  "36": "LandParcel",
  "37": "LandParcel",
  "38": "LandParcel",
  "39": "Building",
  "40": "LandParcel",
  "41": "Building",
  "42": "Building",
  "43": "LandParcel",
  "44": "Building",
  "45": "Building",
  "46": "Building",
  "47": "Building",
  "48": "Building",
  "49": "Building",
  "50": "LandParcel",
  "51": "LandParcel",
  "52": "LandParcel",
  "53": "LandParcel",
  "54": "LandParcel",
  "55": "LandParcel",
  "56": "LandParcel",
  "57": "LandParcel",
  "58": "LandParcel",
  "59": "LandParcel",
  "60": "LandParcel",
  "61": "LandParcel",
  "62": "LandParcel",
  "63": "LandParcel",
  "64": "LandParcel",
  "65": "LandParcel",
  "66": "LandParcel",
  "67": "LandParcel",
  "68": "LandParcel",
  "69": "LandParcel",
  "70": "LandParcel",
  "71": "Building",
  "72": "Building",
  "73": "Building",
  "74": "Building",
  "75": "Building",
  "76": "LandParcel",
  "77": "Building",
  "78": "Building",
  "79": "Building",
  "80": "Building",
  "81": "Building",
  "82": "LandParcel",
  "83": "Building",
  "84": "Building",
  "85": "Building",
  "86": "Building",
  "87": "Building",
  "88": "Building",
  "89": "Building",
  "90": "Building",
  "91": "LandParcel",
  "92": "LandParcel",
  "93": "LandParcel",
  "94": "LandParcel",
  "95": "LandParcel",
  "96": "LandParcel",
  "97": "LandParcel",
  "98": "LandParcel",
  "99": "LandParcel",
});

const STRUCTURE_FORM_MAP = Object.freeze({
  "01": "SingleFamilyDetached",
  "02": "MobileHome",
  "03": "MultiFamily5Plus",
  "04": "ApartmentUnit",
  "05": "ApartmentUnit",
  "06": "MultiFamily5Plus",
  "07": "MultiFamily5Plus",
  "08": "MultiFamilyLessThan10",
});

const OWNERSHIP_ESTATE_TYPE_MAP = Object.freeze({
  "04": "Condominium",
  "05": "Cooperative",
  "09": "Condominium",
  "90": "Leasehold",
  "93": "SubsurfaceRights",
  "94": "RightOfWay",
});

const NUMBER_OF_UNITS_TYPE_MAP = Object.freeze({
  "01": "One",
  "02": "One",
  "04": "One",
});

const DEFAULT_PROPERTY_TYPE = "Building";
const DEFAULT_OWNERSHIP_ESTATE_TYPE = "FeeSimple";

const VACANT_LAND_CODES = new Set(["00", "10", "40", "70", "95", "99"]);
const PROPERTY_CODE_MAP = Object.freeze(
  Object.fromEntries(
    Object.keys(PROPERTY_USAGE_MAP).map((code) => [
      code,
      {
        property_type: PROPERTY_TYPE_MAP[code] || DEFAULT_PROPERTY_TYPE,
        property_usage_type: PROPERTY_USAGE_MAP[code] || null,
        build_status: VACANT_LAND_CODES.has(code) ? "VacantLand" : "Improved",
        ownership_estate_type:
          OWNERSHIP_ESTATE_TYPE_MAP[code] || DEFAULT_OWNERSHIP_ESTATE_TYPE,
        structure_form: STRUCTURE_FORM_MAP[code] || null,
      },
    ]),
  ),
);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p))
    fs.rmSync(path.join(p, f), { recursive: true, force: true });
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function errEnum(value, cls, prop) {
  throw new Error(
    JSON.stringify({
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: `${cls}.${prop}`,
    }),
  );
}
function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const clean = String(txt)
    .replace(/[$,\s]/g, "")
    .replace(/,/g, "");
  if (clean === "") return null;
  const num = Number(clean);
  if (Number.isNaN(num)) return null;
  return num;
}
function toISODate(value) {
  if (!value) return null;
  const s = value.trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Name normalization helpers to ensure schema compliance for person names
function stripInvalidNameChars(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z \-',.]/g, "")
    .trim();
}
function toTitleCaseName(s) {
  if (!s) return "";
  const lower = s.toLowerCase();
  return lower.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}
function isSuffixToken(t) {
  const u = t.replace(/\./g, "").toUpperCase();
  return ["JR", "SR", "II", "III", "IV", "V", "VI"].includes(u);
}
function parseFullName(full) {
  let f = null,
    m = null,
    l = null,
    prefix = null,
    suffix = null;
  let s = stripInvalidNameChars(full || "");
  if (!s) return { first_name: null, middle_name: null, last_name: null, prefix_name: null, suffix_name: null };

  // Handle "LAST, FIRST MIDDLE SUFFIX"
  if (s.includes(",")) {
    const parts = s.split(",");
    const lastPart = stripInvalidNameChars(parts[0]);
    const rest = stripInvalidNameChars(parts.slice(1).join(" "));
    let tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      if (isSuffixToken(tokens[tokens.length - 1])) {
        suffix = tokens.pop();
      }
      if (tokens.length) {
        f = tokens[0];
        if (tokens.length > 2) m = tokens.slice(1, -1).join(" ");
        if (tokens.length >= 2) l = tokens[tokens.length - 1];
      }
    }
    if (!l && lastPart) l = lastPart;
    else if (lastPart) {
      // Prefer explicit last part for last name
      l = lastPart;
      if (tokens.length >= 2) {
        // If l replaced by lastPart, move previous l into middle
        const midTokens = [];
        if (tokens.length > 1) midTokens.push(tokens[tokens.length - 1]);
        if (m) midTokens.unshift(m);
        m = midTokens.length ? midTokens.join(" ") : null;
      }
    }
  } else {
    let tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      if (isSuffixToken(tokens[tokens.length - 1])) {
        suffix = tokens.pop();
      }
      if (tokens.length === 1) {
        f = tokens[0];
      } else if (tokens.length === 2) {
        f = tokens[0];
        l = tokens[1];
      } else {
        f = tokens[0];
        l = tokens[tokens.length - 1];
        m = tokens.slice(1, -1).join(" ");
      }
    }
  }

  // Cleanup and title case
  f = toTitleCaseName(stripInvalidNameChars(f || ""));
  m = toTitleCaseName(stripInvalidNameChars(m || ""));
  l = toTitleCaseName(stripInvalidNameChars(l || ""));
  if (l) l = l.replace(/[',.]+$/g, "");
  if (f) f = f.replace(/[',.]+$/g, "");
  if (m) m = m.replace(/[',.]+$/g, "");
  suffix = stripInvalidNameChars(suffix || "");
  suffix = suffix || null;

  // Ensure required last_name satisfies schema minLength/pattern
  if (!l) l = "Unknown";
  if (!f) f = "Unknown";

  return {
    first_name: f,
    middle_name: m || null,
    last_name: l,
    prefix_name: prefix || null,
    suffix_name: suffix,
  };
}
function normalizePersonFields(p) {
  const fromFields =
    (p && (p.first_name || p.last_name || p.middle_name)) ? {
      first_name: stripInvalidNameChars(p.first_name || ""),
      middle_name: stripInvalidNameChars(p.middle_name || ""),
      last_name: stripInvalidNameChars(p.last_name || ""),
      prefix_name: stripInvalidNameChars(p.prefix_name || ""),
      suffix_name: stripInvalidNameChars(p.suffix_name || ""),
    } : null;

  let result;
  if (fromFields && (fromFields.first_name || fromFields.last_name)) {
    // If one is missing, try to repair using combined name if available
    if ((!fromFields.first_name || !fromFields.last_name) && p && p.name) {
      result = parseFullName(p.name);
      // Prefer explicit field when present
      if (fromFields.first_name) result.first_name = toTitleCaseName(fromFields.first_name);
      if (fromFields.middle_name) result.middle_name = toTitleCaseName(fromFields.middle_name);
      if (fromFields.last_name) result.last_name = toTitleCaseName(fromFields.last_name.replace(/[',.]+$/g, ""));
      if (fromFields.suffix_name) result.suffix_name = toTitleCaseName(fromFields.suffix_name);
    } else {
      result = {
        first_name: toTitleCaseName(fromFields.first_name),
        middle_name: toTitleCaseName(fromFields.middle_name) || null,
        last_name: toTitleCaseName(fromFields.last_name.replace(/[',.]+$/g, "")),
        prefix_name: null,
        suffix_name: toTitleCaseName(fromFields.suffix_name) || null,
      };
    }
  } else if (p && p.name) {
    result = parseFullName(p.name);
  } else {
    result = { first_name: "Unknown", middle_name: null, last_name: "Unknown", prefix_name: null, suffix_name: null };
  }

  // Final guards for schema compliance
  if (!result.last_name || !/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(result.last_name)) {
    result.last_name = "Unknown";
  }
  if (!result.first_name) result.first_name = "Unknown";

  return result;
}

const DEED_TYPE_DESCRIPTION_MAP = Object.freeze({
  WD: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  TD: "Trust Deed",
  TR: "Trustee Deed",
  PR: "Personal Representative Deed",
  CD: "Corrective Deed",
  CORR: "Corrective Deed",
  QC: "Quit Claim Deed",
  QCD: "Quit Claim Deed",
  LD: "Lien Deed",
  SL: "Sheriff's Deed",
  SHD: "Sheriff's Deed",
  MTG: "Mortgage",
  DV: "Divorce Deed",
});

function describeDeedType(code) {
  if (!code) return null;
  const norm = code.replace(/[.\s]/g, "").toUpperCase();
  return DEED_TYPE_DESCRIPTION_MAP[norm] || null;
}

function parseBookPageParts(input) {
  const raw = (input || "").trim();
  if (!raw) return { book: null, page: null, volume: null };
  const cleaned = raw.replace(/^[A-Za-z]+\s+/g, "");
  const slash = cleaned.match(/(\d+)\s*\/\s*(\d+)/);
  if (slash) {
    return { book: slash[1], page: slash[2], volume: null };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return { book: parts[0], page: parts[1], volume: null };
  }
  return { book: null, page: null, volume: null };
}

function inferDocumentFormat(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return null;
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  if (lower.includes(".pdf")) return null;
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

function parseNumberFromText(text) {
  if (text == null) return null;
  const clean = String(text).replace(/[^0-9.-]/g, "");
  if (!clean) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

function extractModernBuildingRows($) {
  const rows = [];
  $("#bldgTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const firstCell = $(tds.get(0)).text().trim();
    if (/loading/i.test(firstCell)) return;
    const description = firstCell || null;
    const yearBuilt =
      tds.length > 1 ? parseNumberFromText($(tds.get(1)).text()) : null;
    const areaText = tds.length > 2 ? $(tds.get(2)).text().trim() : "";
    const bedBathText = tds.length > 3 ? $(tds.get(3)).text().trim() : "";

    let baseSqft = null;
    let auxSqft = null;
    if (areaText && areaText.includes("/")) {
      const parts = areaText.split("/");
      if (parts.length >= 2) {
        baseSqft = parseNumberFromText(parts[0]);
        auxSqft = parseNumberFromText(parts[1]);
      }
    }

    let beds = null;
    let baths = null;
    if (/\d+\s*\/\s*\d+/.test(bedBathText)) {
      const parts = bedBathText.split("/");
      beds = parseNumberFromText(parts[0]);
      baths = parseNumberFromText(parts[1]);
    }

    rows.push({
      description,
      yearBuilt,
      baseSqft,
      auxSqft,
      beds,
      baths,
    });
  });
  return rows;
}

function extractLegacyBuildingRows($) {
  const rows = [];
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      const description = $(tds.get(0)).text().trim() || null;
      const yearBuilt = parseNumberFromText($(tds.get(1)).text());
      const areaText = $(tds.get(3)).text().trim() || "";
      const bedBathText =
        tds.length >= 5 ? $(tds.get(4)).text().trim() : "";

      let baseSqft = null;
      let auxSqft = null;
      if (areaText && areaText.includes("/")) {
        const parts = areaText.split("/");
        if (parts.length >= 2) {
          baseSqft = parseNumberFromText(parts[0]);
          auxSqft = parseNumberFromText(parts[1]);
        }
      }

      let beds = null;
      let baths = null;
      if (/\d+\s*\/\s*\d+/.test(bedBathText)) {
        const parts = bedBathText.split("/");
        beds = parseNumberFromText(parts[0]);
        baths = parseNumberFromText(parts[1]);
      }

      rows.push({
        description,
        yearBuilt,
        baseSqft,
        auxSqft,
        beds,
        baths,
      });
    }
  });
  return rows;
}

function extractBuildingData($) {
  const modern = extractModernBuildingRows($);
  if (modern.length) return modern;
  return extractLegacyBuildingRows($);
}

function createDefaultUtilityRecord() {
  return {
    cooling_system_type: null,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_inverter_visible: false,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    water_source_type: null,
    well_installation_date: null,
  };
}

function createLayoutRecord({
  spaceType,
  index,
  sourceRequest,
  requestId,
}) {
  return {
    space_type: spaceType,
    space_type_index: index,
    flooring_material_type: null,
    has_windows: false,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: false,
    is_exterior: false,
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
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    size_square_feet: null,
    source_http_request: sourceRequest || null,
    request_identifier: requestId || null,
  };
}

function generateRooms(building, fallbackRooms) {
  const rooms = [];
  const addRoom = (type) => {
    rooms.push({
      space_type: normalizeLayoutSpaceType(type, "Living Room"),
    });
  };
  if (building && Number.isFinite(building.beds) && building.beds > 0) {
    for (let i = 0; i < building.beds; i += 1) addRoom("Bedroom");
  }
  if (building && Number.isFinite(building.baths) && building.baths > 0) {
    for (let i = 0; i < building.baths; i += 1) addRoom("Full Bathroom");
  }
  if (fallbackRooms && fallbackRooms.length) {
    fallbackRooms.forEach((room) => {
      const count = room.count && room.count > 0 ? room.count : 1;
      for (let i = 0; i < count; i += 1) addRoom(room.space_type);
    });
  }
  if (!rooms.length) addRoom("Living Room");
  return rooms;
}

function getStructureFiles(dataDir) {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => /^structure(_\d+)?\.json$/.test(f))
    .sort((a, b) => {
      const ma = a.match(/structure_(\d+)\.json/);
      const mb = b.match(/structure_(\d+)\.json/);
      if (ma && mb) return Number(ma[1]) - Number(mb[1]);
      if (ma) return -1;
      if (mb) return 1;
      return 0;
    });
}

function getUtilityFiles(dataDir) {
  if (!fs.existsSync(dataDir)) return [];
  return fs
    .readdirSync(dataDir)
    .filter((f) => /^utility(_\d+)?\.json$/.test(f))
    .sort((a, b) => {
      const ma = a.match(/utility_(\d+)\.json/);
      const mb = b.match(/utility_(\d+)\.json/);
      if (ma && mb) return Number(ma[1]) - Number(mb[1]);
      if (ma) return -1;
      if (mb) return 1;
      return 0;
    });
}

function baseNameFromFile(fileName) {
  if (!fileName) return "";
  return fileName.replace(".json", "");
}

function layoutIdFromFile(fileName) {
  const match = fileName.match(/layout_(\d+)\.json/);
  return match ? match[1] : fileName.replace(".json", "");
}

const DEED_TYPE_MAP = Object.freeze({
  WD: "Warranty Deed",
  WARRANTY_DEED: "Warranty Deed",
  WARRANTY: "Warranty Deed",
  WARRANTYDEED: "Warranty Deed",
  QD: "Quitclaim Deed",
  QUIT_CLAIM_DEED: "Quitclaim Deed",
  QUITCLAIM_DEED: "Quitclaim Deed",
  QUITCLAIMDEED: "Quitclaim Deed",
  SWD: "Special Warranty Deed",
  SPECIAL_WARRANTY_DEED: "Special Warranty Deed",
  SPECIALWARRANTYDEED: "Special Warranty Deed",
  PRD: "Personal Representative Deed",
  PERSONAL_REPRESENTATIVE_DEED: "Personal Representative Deed",
  PERSONALREPRESENTATIVEDEED: "Personal Representative Deed",
  TD: "Trustee's Deed",
  TRUST_DEED: "Trustee's Deed",
  TRUSTEES_DEED: "Trustee's Deed",
  TRUSTDEED: "Trustee's Deed",
  TRUSTEESDEED: "Trustee's Deed",
  SHD: "Sheriff's Deed",
  SHERIFF_DEED: "Sheriff's Deed",
  SHERIFFS_DEED: "Sheriff's Deed",
  SHERIFFDEED: "Sheriff's Deed",
  TAX: "Tax Deed",
  TAX_DEED: "Tax Deed",
  TAXDEED: "Tax Deed",
  GR: "Grant Deed",
  GRANT_DEED: "Grant Deed",
  GRANTDEED: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  BARGAIN_AND_SALE_DEED: "Bargain and Sale Deed",
  BARGAINANDSALEDEED: "Bargain and Sale Deed",
  LADY_BIRD: "Lady Bird Deed",
  LADYBIRD: "Lady Bird Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TRANSFER_ON_DEATH_DEED: "Transfer on Death Deed",
  TRANSFERONDEATHDEED: "Transfer on Death Deed",
  DEED_IN_LIEU: "Deed in Lieu of Foreclosure",
  DEEDINLIEU: "Deed in Lieu of Foreclosure",
  DIL: "Deed in Lieu of Foreclosure",
  LIFE_ESTATE_DEED: "Life Estate Deed",
  LIFEESTATEDEED: "Life Estate Deed",
  LED: "Life Estate Deed",
});

function mapDeedType(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/[\s\-]+/g, "_").replace(/[^\w]/g, "_").toUpperCase();
  if (DEED_TYPE_MAP[normalized]) return DEED_TYPE_MAP[normalized];
  const collapsed = raw.replace(/[^\w]/g, "").toUpperCase();
  if (DEED_TYPE_MAP[collapsed]) return DEED_TYPE_MAP[collapsed];
  return null;
}

const ALLOWED_LAYOUT_SPACE_TYPES = new Set([
  "Building",
  "Living Room",
  "Family Room",
  "Great Room",
  "Dining Room",
  "Office Room",
  "Conference Room",
  "Class Room",
  "Plant Floor",
  "Kitchen",
  "Breakfast Nook",
  "Pantry",
  "Primary Bedroom",
  "Secondary Bedroom",
  "Guest Bedroom",
  "Children’s Bedroom",
  "Children's Bedroom",
  "Nursery",
  "Full Bathroom",
  "Three-Quarter Bathroom",
  "Half Bathroom / Powder Room",
  "En-Suite Bathroom",
  "Jack-and-Jill Bathroom",
  "Primary Bathroom",
  "Laundry Room",
  "Mudroom",
  "Closet",
  "Walk-in Closet",
  "Mechanical Room",
  "Storage Room",
  "Server/IT Closet",
  "Home Office",
  "Library",
  "Den",
  "Study",
  "Media Room / Home Theater",
  "Game Room",
  "Home Gym",
  "Music Room",
  "Craft Room / Hobby Room",
  "Prayer Room / Meditation Room",
  "Safe Room / Panic Room",
  "Wine Cellar",
  "Bar Area",
  "Greenhouse",
  "Attached Garage",
  "Detached Garage",
  "Carport",
  "Workshop",
  "Storage Loft",
  "Porch",
  "Screened Porch",
  "Sunroom",
  "Deck",
  "Patio",
  "Pergola",
  "Balcony",
  "Terrace",
  "Gazebo",
  "Pool House",
  "Outdoor Kitchen",
  "Lobby / Entry Hall",
  "Common Room",
  "Utility Closet",
  "Elevator Lobby",
  "Mail Room",
  "Janitor’s Closet",
  "Pool Area",
  "Indoor Pool",
  "Outdoor Pool",
  "Hot Tub / Spa Area",
  "Shed",
  "Lanai",
  "Open Porch",
  "Enclosed Porch",
  "Attic",
  "Enclosed Cabana",
  "Detached Utility Closet",
  "Jacuzzi",
  "Courtyard",
  "Open Courtyard",
  "Screen Porch (1-Story)",
  "Screen Enclosure (2-Story)",
  "Screen Enclosure (3-Story)",
  "Screen Enclosure (Custom)",
  "Lower Garage",
  "Lower Screened Porch",
  "Stoop",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Fourth Floor",
  "Floor",
  "Basement",
  "Sub-Basement",
  "Living Area",
"Barn",
]);

function normalizeLayoutSpaceType(spaceType, fallback = "Living Room") {
  if (!spaceType) return fallback;
  if (ALLOWED_LAYOUT_SPACE_TYPES.has(spaceType)) return spaceType;
  const trimmed = String(spaceType).trim();
  if (ALLOWED_LAYOUT_SPACE_TYPES.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  if (upper === "BATHROOM") return "Full Bathroom";
  if (upper === "BEDROOM") return "Bedroom";
  if (upper === "LIVING AREA") return "Living Area";
  if (upper === "LIVING ROOM") return "Living Room";
  if (upper === "DINING ROOM") return "Dining Room";
  if (upper === "KITCHEN") return "Kitchen";
  return fallback;
}
function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  clearDir(dataDir);
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const seed = readJson("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const unnorm = readJson("unnormalized_address.json");
  const buildingData = extractBuildingData($);

  let ownersJson = null,
    utilsJson = null,
    layoutJson = null;
  if (fs.existsSync(ownersPath)) ownersJson = readJson(ownersPath);
  if (fs.existsSync(utilsPath)) utilsJson = readJson(utilsPath);
  if (fs.existsSync(layoutPath)) layoutJson = readJson(layoutPath);
  const parcelKey = (
    $("#hidParcelKey").val() ||
    $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text() ||
    $("#parcelKey").text() ||
    $("#parcelNumber").text() ||
    ""
  ).trim();
  const propertyKey = `property_${parcelKey}`;
  const existingFileIndices = fs
    .readdirSync(dataDir)
    .filter((f) => /^file_(\d+)\.json$/.test(f))
    .map((f) => Number(f.match(/(\d+)/)[1]));
  let nextFileIndex =
    existingFileIndices.length > 0
      ? Math.max(...existingFileIndices) + 1
      : 1;

  // PROPERTY
  const parcelId =
    seed && seed.parcel_id
      ? seed.parcel_id
      : (
          $("#MainContent_frmParcelDetail_PARCEL_NUMBERLabel").text() ||
          $("#parcelNumber").text() ||
          ""
        ).trim();
  const legalDesc = (function () {
    let txt = "";
    $("#MainContent_frmParcelDetail")
      .find("table.box-content")
      .first()
      .find("tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds.get(0)).text().trim();
          const val = $(tds.get(1)).text().trim();
          if (/^Description:/i.test(label)) txt = val;
        }
      });
    if (!txt) {
      const desc = $("#description").text().trim();
      if (desc) txt = desc;
    }
    return txt || null;
  })();
  const subdivision = (function () {
    const legacy = $("#MainContent_frmParcelDetail_SUBDIVISIONLabel")
      .text()
      .trim();
    if (legacy) return legacy;
    const modern = $("#subdivision").text().trim();
    return modern || null;
  })();
  const dorText = (function () {
    let out = null;
    $("#MainContent_frmParcelDetail")
      .find("table.box-content")
      .first()
      .find("tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds.get(0)).text().trim();
          const val = $(tds.get(1)).text().trim();
          if (/^DOR Code:/i.test(label)) out = val;
        }
      });
    if (!out) {
      const modern = $("#dorcode").text().trim();
      if (modern) out = modern;
    }
    return out;
  })();
  let property_type = null;
  let property_usage_type = null;
  let number_of_units_type = null;
  let build_status = null;
  let structure_form = null;
  let ownership_estate_type = null;
  if (dorText) {
    const rawDor = dorText.trim();
    const paren = rawDor.match(/\((\d{2})\)\s*(.*)/);
    let code = null;
    let text = null;
    if (paren) {
      code = paren[1];
      text = (paren[2] || "").toUpperCase();
    }
    if (!code) {
      const leading = rawDor.match(/^(\d{2})/);
      if (leading) code = leading[1];
    }
    if (!text) text = rawDor.toUpperCase();
    if (code) {
      const mapping = PROPERTY_CODE_MAP[code];
      if (!mapping || !mapping.property_usage_type) {
        errEnum(dorText, "property", "property_usage_type");
      }
      property_usage_type = mapping.property_usage_type;
      property_type = mapping.property_type || DEFAULT_PROPERTY_TYPE;
      build_status = mapping.build_status;
      structure_form = mapping.structure_form;
      ownership_estate_type = mapping.ownership_estate_type;
      if (Object.prototype.hasOwnProperty.call(NUMBER_OF_UNITS_TYPE_MAP, code)) {
        number_of_units_type = NUMBER_OF_UNITS_TYPE_MAP[code];
      } else {
        number_of_units_type = null;
      }
    }
  }
  let builtYear = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const y = $(tds.get(2)).text().trim();
      if (/^\d{4}$/.test(y)) {
        builtYear = Number(y);
        return false;
      }
    }
  });
  let livable_floor_area = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const area = $(tds.get(3)).text().trim();
      if (area) {
        const base = area.split("/")[0];
        if (base && /\d{2,}/.test(base)) livable_floor_area = base.trim();
        return false;
      }
    }
  });
  if (!parcelId) throw new Error("Missing parcel identifier");
  if (!property_type) throw new Error("Missing or unmapped DOR/property_type");
  if (!property_usage_type)
    throw new Error("Missing or unmapped property_usage_type");
  writeJson(path.join(dataDir, "property.json"), {
    parcel_identifier: parcelId,
    property_type,
    property_usage_type,
    build_status: build_status || null,
    structure_form: structure_form || null,
    ownership_estate_type: ownership_estate_type || null,
    property_structure_built_year: builtYear || null,
    number_of_units_type: number_of_units_type || null,
    livable_floor_area: livable_floor_area || null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
  });

  // ADDRESS & GEOMETRY
  const situsElement = $("#situsAddress");
  let situsAddress = null;
  if (situsElement.length) {
    const situsHtml = situsElement.html();
    if (situsHtml) {
      situsAddress = cheerio
        .load(`<span>${situsHtml}</span>`)
        .text()
        .replace(/\s+/g, " ")
        .trim();
    } else {
      const text = situsElement.text().replace(/\s+/g, " ").trim();
      situsAddress = text || null;
    }
  }
  const addressSource =
    (unnorm && unnorm.source_http_request) ||
    (seed && seed.source_http_request) ||
    null;
  const addressRequestId =
    (unnorm && unnorm.request_identifier) ||
    (seed && seed.request_identifier) ||
    null;
  const unnormalizedAddress =
    (unnorm && (unnorm.full_address || unnorm.unnormalized_address)) ||
    situsAddress ||
    null;
  const addressRecord = {
    source_http_request: addressSource,
    request_identifier: addressRequestId,
    county_name: "Hernando",
    country_code: "US",
    unnormalized_address: unnormalizedAddress,
  };
  writeJson(path.join(dataDir, "address.json"), addressRecord);

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  const geometryRecord = {
    source_http_request: addressSource,
    request_identifier: addressRequestId,
    latitude: toNumberOrNull(unnorm && unnorm.latitude),
    longitude: toNumberOrNull(unnorm && unnorm.longitude),
  };
  writeJson(path.join(dataDir, "geometry.json"), geometryRecord);
  writeJson(
    path.join(dataDir, "relationship_address_has_geometry.json"),
    {
      from: { "/": "./address.json" },
      to: { "/": "./geometry.json" },
    },
  );

  // TAX - current year
  const buildingVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_BUILDING_VALUELabel").text(),
  );
  const landVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_LAND_VALUELabel").text(),
  );
  const assessedVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_ASSESSED_VALUELabel0").text(),
  );
  const marketVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_JUST_MARKET_VALUELabel3").text(),
  );
  const taxableVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_TAXABLE_VALUELabel").text(),
  );
  const taxHeading = $("#MainContent_lblTaxHeading").text().trim();
  let taxYear = null;
  const tm = taxHeading.match(/(\d{4})/);
  if (tm) taxYear = Number(tm[1]);
  if (
    taxYear &&
    assessedVal != null &&
    marketVal != null &&
    taxableVal != null
  ) {
    writeJson(path.join(dataDir, `tax_${taxYear}.json`), {
      tax_year: taxYear,
      property_assessed_value_amount: assessedVal,
      property_market_value_amount: marketVal,
      property_building_amount: buildingVal != null ? buildingVal : null,
      property_land_amount: landVal != null ? landVal : null,
      property_taxable_value_amount: taxableVal,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    });
  }
  // TAX - prior years from Certified Tax Information: use yearly total for required assessed/market/taxable to satisfy schema
  const certHeader = $("h4")
    .filter((i, el) => $(el).text().trim() === "Certified Tax Information")
    .first();
  if (certHeader.length) {
    const certTable = certHeader
      .closest(".ui-widget-header")
      .nextAll(".box-content")
      .first()
      .find("table")
      .first();
    certTable.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 2) {
        const label = $(tds.get(0)).text().trim();
        const m = label.match(/^Total For\s+(\d{4}):/i);
        if (m) {
          const y = Number(m[1]);
          const total = parseCurrencyToNumber($(tds.get(1)).text().trim());
          if (total != null) {
            writeJson(path.join(dataDir, `tax_${y}.json`), {
              tax_year: y,
              property_assessed_value_amount: total,
              property_market_value_amount: total,
              property_building_amount: null,
              property_land_amount: null,
              property_taxable_value_amount: total,
              monthly_tax_amount: null,
              period_start_date: null,
              period_end_date: null,
              yearly_tax_amount: total,
              first_year_on_tax_roll: null,
              first_year_building_on_tax_roll: null,
            });
          }
        }
      }
    });
  }

  // SALES + DEEDS + FILES
  const salesRows = [];
  const saleRowKeys = new Set();
  const candidateSalesTables = [];
  const modernSalesTable = $("#salesTable");
  if (modernSalesTable.length) candidateSalesTables.push(modernSalesTable);
  const legacySalesTable = $("#MainContent_frmParcelDetail_gvSales");
  if (legacySalesTable.length) candidateSalesTables.push(legacySalesTable);
  function registerSaleRow(row) {
    if (!row || !row.date) return;
    const key = [
      row.date,
      row.price != null ? row.price : "",
      row.book || "",
      row.page || "",
      row.deedAbbr || "",
    ].join("|");
    if (saleRowKeys.has(key)) return;
    saleRowKeys.add(key);
    salesRows.push(row);
  }
  candidateSalesTables.forEach((table) => {
    if (!table || !table.length) return;
    let headerCells = table.find("thead tr").first().find("th");
    if (!headerCells.length) headerCells = table.find("tr").first().find("th");
    const headers = headerCells
      .map((i, th) => $(th).text().trim().toLowerCase())
      .get();
    function headerIndex(regex, fallback) {
      const idx = headers.findIndex((h) => regex.test(h));
      return idx >= 0 ? idx : fallback;
    }
    let bodyRows = table.find("tbody tr");
    if (!bodyRows.length) {
      const allRows = table.find("tr");
      if (allRows.length > 1) bodyRows = allRows.slice(1);
    }
    bodyRows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (!tds.length) return;
      const idxDate = headerIndex(/date/, 0);
      const idxBook = headerIndex(/book|page/, 1);
      const idxDeed = headerIndex(/deed/, 2);
      const idxVacant = headerIndex(/vacant|improved/, 3);
      const idxQual = headerIndex(/qual/, 4);
      const idxPrice = headerIndex(/price|amount/, tds.length - 1);
      const idxInstr = headerIndex(/instrument/, -1);
      const dateText =
        idxDate >= 0 && idxDate < tds.length
          ? $(tds.get(idxDate)).text().trim()
          : $(tds.get(0)).text().trim();
      const iso = toISODate(dateText);
      const priceText =
        idxPrice >= 0 && idxPrice < tds.length
          ? $(tds.get(idxPrice)).text().trim()
          : $(tds.get(tds.length - 1)).text().trim();
      const price = parseCurrencyToNumber(priceText);
      if (!iso || price == null) return;
      const bookCell =
        idxBook >= 0 && idxBook < tds.length ? $(tds.get(idxBook)) : null;
      const bookPageText = bookCell ? bookCell.text().trim() : null;
      const docUrl = bookCell ? bookCell.find("a").attr("href") || null : null;
      const { book, page, volume } = parseBookPageParts(bookPageText);
      const deedRaw =
        idxDeed >= 0 && idxDeed < tds.length
          ? $(tds.get(idxDeed)).text().trim()
          : null;
      const deedType = mapDeedType(deedRaw);
      const vacImproved =
        idxVacant >= 0 && idxVacant < tds.length
          ? $(tds.get(idxVacant)).text().trim() || null
          : null;
      const qualification =
        idxQual >= 0 && idxQual < tds.length
          ? $(tds.get(idxQual)).text().trim() || null
          : null;
      const instrument =
        idxInstr >= 0 && idxInstr < tds.length
          ? $(tds.get(idxInstr)).text().trim() || null
          : null;
        registerSaleRow({
          date: iso,
          price,
          deedType: deedType,
          bookPage: bookPageText || null,
          book: book || null,
          page: page || null,
          volume: volume || null,
        docUrl,
        qualification,
        vacantImproved: vacImproved,
        instrument,
      });
    });
  });
  salesRows.sort((a, b) => {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });
  const salesHistoryMeta = [];
  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    const saleFile = `sales_history_${saleIdx}.json`;
    const saleRecord = {
      ownership_transfer_date: row.date,
      purchase_price_amount: row.price,
    };
    writeJson(path.join(dataDir, saleFile), saleRecord);
    let deedFile = null;
    if (
      row.book ||
      row.page ||
      row.volume ||
      row.deedType ||
      row.docUrl ||
      row.instrument
    ) {
      deedFile = `deed_${saleIdx}.json`;
      const deedRecord = {};
      if (row.deedType) deedRecord.deed_type = row.deedType;
      if (row.book) deedRecord.book = String(row.book);
      if (row.page) deedRecord.page = String(row.page);
      if (row.volume) deedRecord.volume = String(row.volume);
      if (row.instrument) deedRecord.instrument_number = String(row.instrument);
      writeJson(path.join(dataDir, deedFile), deedRecord);
      writeJson(
        path.join(
          dataDir,
          `relationship_sales_history_${saleIdx}_has_deed_${saleIdx}.json`,
        ),
        {
          from: { "/": `./${saleFile}` },
          to: { "/": `./${deedFile}` },
        },
      );
      if (row.docUrl) {
        const fileIdx = nextFileIndex++;
        const fileName = `file_${fileIdx}.json`;
        const fileRecord = {
          document_type: "Title",
          name: row.bookPage
            ? `Deed Document ${row.bookPage}`
            : `Deed Document ${saleIdx}`,
          original_url: row.docUrl,
          ipfs_url: null,
        };
        const fileFormat = inferDocumentFormat(row.docUrl);
        if (fileFormat) fileRecord.file_format = fileFormat;
        writeJson(path.join(dataDir, fileName), fileRecord);
        writeJson(
          path.join(
            dataDir,
            `relationship_deed_${saleIdx}_has_file_${fileIdx}.json`,
          ),
          {
            from: { "/": `./${deedFile}` },
            to: { "/": `./${fileName}` },
          },
        );
      }
    }
    salesHistoryMeta.push({
      saleIdx,
      saleFile,
      deedFile,
      row,
    });
  });

  // UTILITIES / LAYOUTS
  const utilityRecord =
    (utilsJson && utilsJson[propertyKey]) || createDefaultUtilityRecord();
  writeJson(path.join(dataDir, "utility.json"), utilityRecord);

  // STRUCTURE
  const structureReq = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
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
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
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
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  let finishedBase = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const area = $(tds.get(3)).text().trim();
      if (area) {
        const base = area.split("/")[0];
        if (base && /\d+/.test(base)) finishedBase = Number(base);
      }
    }
  });
  writeJson(
    path.join(dataDir, "structure.json"),
    Object.assign({}, structureReq, {
      finished_base_area: finishedBase || null,
    }),
  );

  // LOT
  let lotSqft = null;
  $("#MainContent_frmParcelDetail_gvLands tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const unitsTxt = $(tds.get(1)).text().trim();
      const m =
        unitsTxt.match(/[\s>]([\d,.]+)\s+SQUARE\s+FEET/i) ||
        unitsTxt.match(/^([\d,.]+)\s+SQUARE\s+FEET/i);
      if (m) {
        lotSqft = Math.round(parseFloat(m[1].replace(/,/g, "")));
      }
    }
  });
  writeJson(path.join(dataDir, "lot.json"), {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotSqft || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotSqft ? lotSqft / 43560 : null,
  });

  // LAYOUT HIERARCHY (Building, Floors, Rooms)
  const layoutFallbackRooms =
    layoutJson &&
    layoutJson[propertyKey] &&
    Array.isArray(layoutJson[propertyKey].layouts)
      ? layoutJson[propertyKey].layouts.map((layout) => ({
          space_type:
            layout.space_type ||
            layout.type ||
            layout.layout_name ||
            "Living Room",
          count: layout.count != null ? Number(layout.count) || 1 : 1,
        }))
      : [];

  const isLandProperty =
    property_type === "LandParcel" || build_status === "VacantLand";
  const buildingLayoutsGenerated = [];
  const layoutRelationships = [];
  let layoutCounter = 0;

  if (!isLandProperty) {
    const buildings = buildingData.length ? buildingData : [null];
    buildings.forEach((building, idx) => {
      const buildingIndex = idx + 1;
      layoutCounter += 1;
      const buildingLayoutFile = `layout_${layoutCounter}.json`;
      const buildingLayout = createLayoutRecord({
        spaceType: "Building",
        index: `${buildingIndex}`,
        sourceRequest: addressSource,
        requestId: addressRequestId,
      });
      writeJson(path.join(dataDir, buildingLayoutFile), buildingLayout);
      buildingLayoutsGenerated.push({
        file: buildingLayoutFile,
        index: buildingIndex,
        info: building,
      });

      const rooms = generateRooms(building, layoutFallbackRooms);
      const typeCounters = new Map();
      rooms.forEach((room) => {
        const currentCount = (typeCounters.get(room.space_type) || 0) + 1;
        typeCounters.set(room.space_type, currentCount);
        layoutCounter += 1;
        const roomLayoutFile = `layout_${layoutCounter}.json`;
        const subIndex = `${buildingIndex}.${currentCount}`;
        const roomLayout = createLayoutRecord({
          spaceType: room.space_type,
          index: subIndex,
          sourceRequest: addressSource,
          requestId: addressRequestId,
        });
        writeJson(path.join(dataDir, roomLayoutFile), roomLayout);
        layoutRelationships.push({
          parent: buildingLayoutFile,
          child: roomLayoutFile,
        });
      });
    });

    layoutRelationships.forEach((rel) => {
      const parentId = layoutIdFromFile(rel.parent);
      const childId = layoutIdFromFile(rel.child);
      writeJson(
        path.join(
          dataDir,
          `relationship_layout_${parentId}_has_layout_${childId}.json`,
        ),
        {
          from: { "/": `./${rel.parent}` },
          to: { "/": `./${rel.child}` },
        },
      );
    });

    const structureFiles = getStructureFiles(dataDir);
    const utilityFiles = getUtilityFiles(dataDir);
    const propertyFilePath = "./property.json";

    if (structureFiles.length) {
      if (buildingLayoutsGenerated.length <= 1) {
        structureFiles.forEach((structureFile, sIdx) => {
          const targetLayout = buildingLayoutsGenerated[0];
          const layoutId = layoutIdFromFile(targetLayout.file);
          const structureBase = baseNameFromFile(structureFile);
          writeJson(
            path.join(
              dataDir,
              `relationship_layout_${layoutId}_has_${structureBase}.json`,
            ),
            {
              from: { "/": `./${targetLayout.file}` },
              to: { "/": `./${structureFile}` },
            },
          );
        });
      } else if (structureFiles.length === 1) {
        const structureBase = baseNameFromFile(structureFiles[0]);
        writeJson(
          path.join(
            dataDir,
            `relationship_property_has_${structureBase}.json`,
          ),
          {
            from: { "/": propertyFilePath },
            to: { "/": `./${structureFiles[0]}` },
          },
        );
      } else {
        const minCount = Math.min(
          buildingLayoutsGenerated.length,
          structureFiles.length,
        );
        for (let i = 0; i < minCount; i += 1) {
          const layout = buildingLayoutsGenerated[i];
          const layoutId = layoutIdFromFile(layout.file);
          const structureBase = baseNameFromFile(structureFiles[i]);
          writeJson(
            path.join(
              dataDir,
              `relationship_layout_${layoutId}_has_${structureBase}.json`,
            ),
            {
              from: { "/": `./${layout.file}` },
              to: { "/": `./${structureFiles[i]}` },
            },
          );
        }
        if (structureFiles.length > buildingLayoutsGenerated.length) {
          for (let i = buildingLayoutsGenerated.length; i < structureFiles.length; i += 1) {
            const structureBase = baseNameFromFile(structureFiles[i]);
            writeJson(
              path.join(
                dataDir,
                `relationship_property_has_${structureBase}.json`,
              ),
              {
                from: { "/": propertyFilePath },
                to: { "/": `./${structureFiles[i]}` },
              },
            );
          }
        }
      }
    }

    if (utilityFiles.length) {
      if (buildingLayoutsGenerated.length <= 1) {
        utilityFiles.forEach((utilityFile) => {
          const targetLayout = buildingLayoutsGenerated[0];
          const layoutId = layoutIdFromFile(targetLayout.file);
          const utilityBase = baseNameFromFile(utilityFile);
          writeJson(
            path.join(
              dataDir,
              `relationship_layout_${layoutId}_has_${utilityBase}.json`,
            ),
            {
              from: { "/": `./${targetLayout.file}` },
              to: { "/": `./${utilityFile}` },
            },
          );
        });
      } else if (utilityFiles.length === 1) {
        const utilityBase = baseNameFromFile(utilityFiles[0]);
        writeJson(
          path.join(
            dataDir,
            `relationship_property_has_${utilityBase}.json`,
          ),
          {
            from: { "/": propertyFilePath },
            to: { "/": `./${utilityFiles[0]}` },
          },
        );
      } else {
        const minCount = Math.min(
          buildingLayoutsGenerated.length,
          utilityFiles.length,
        );
        for (let i = 0; i < minCount; i += 1) {
          const layout = buildingLayoutsGenerated[i];
          const layoutId = layoutIdFromFile(layout.file);
          const utilityBase = baseNameFromFile(utilityFiles[i]);
          writeJson(
            path.join(
              dataDir,
              `relationship_layout_${layoutId}_has_${utilityBase}.json`,
            ),
            {
              from: { "/": `./${layout.file}` },
              to: { "/": `./${utilityFiles[i]}` },
            },
          );
        }
        if (utilityFiles.length > buildingLayoutsGenerated.length) {
          for (let i = buildingLayoutsGenerated.length; i < utilityFiles.length; i += 1) {
            const utilityBase = baseNameFromFile(utilityFiles[i]);
            writeJson(
              path.join(
                dataDir,
                `relationship_property_has_${utilityBase}.json`,
              ),
              {
                from: { "/": propertyFilePath },
                to: { "/": `./${utilityFiles[i]}` },
              },
            );
          }
        }
      }
    }
  }

  // OWNERS/BUYERS + RELS
  const personIndex = new Map();
  const companyIndex = new Map();
  let personCount = 0;
  let companyCount = 0;
  function ensurePerson(p) {
    const norm = normalizePersonFields(p || {});
    const key = JSON.stringify({
      first_name: norm.first_name,
      last_name: norm.last_name,
      middle_name: norm.middle_name || null,
      suffix_name: norm.suffix_name || null,
    });
    if (personIndex.has(key)) return personIndex.get(key);
    personCount += 1;
    const fname = `person_${personCount}.json`;
    writeJson(path.join(dataDir, fname), {
      first_name: norm.first_name,
      last_name: norm.last_name,
      middle_name: norm.middle_name || null,
      birth_date: null,
      prefix_name: norm.prefix_name || null,
      suffix_name: norm.suffix_name || null,
      us_citizenship_status: null,
      veteran_status: null,
    });
    personIndex.set(key, fname);
    return fname;
  }
  function ensureCompany(c) {
    const name = c.name;
    if (companyIndex.has(name)) return companyIndex.get(name);
    companyCount += 1;
    const fname = `company_${companyCount}.json`;
    writeJson(path.join(dataDir, fname), { name: name || null });
    companyIndex.set(name, fname);
    return fname;
  }
  const mailingOwnerRefs = [];
  const mailingOwnerSet = new Set();
  if (
    ownersJson &&
    ownersJson[propertyKey] &&
    ownersJson[propertyKey].owners_by_date
  ) {
    const ob = ownersJson[propertyKey].owners_by_date;
    const current = ob.current || [];
    current.forEach((o) => {
      if (o.type === "person") {
        const pFile = ensurePerson(o);
        if (!mailingOwnerSet.has(`person:${pFile}`)) {
          mailingOwnerSet.add(`person:${pFile}`);
          mailingOwnerRefs.push({ type: "person", file: pFile });
        }
      } else if (o.type === "company") {
        const cFile = ensureCompany(o);
        if (!mailingOwnerSet.has(`company:${cFile}`)) {
          mailingOwnerSet.add(`company:${cFile}`);
          mailingOwnerRefs.push({ type: "company", file: cFile });
        }
      }
    });
    const buyerRelKeys = new Set();
    salesHistoryMeta.forEach((meta, idx) => {
      let buyers = ob[meta.row.date] || [];
      if ((!buyers || !buyers.length) && idx === 0 && current.length) {
        buyers = current;
      }
      buyers.forEach((b) => {
        if (b.type === "person") {
          const pFile = ensurePerson(b);
          const personId = pFile.match(/(\d+)/)
            ? pFile.match(/(\d+)/)[1]
            : `${idx + 1}`;
          const relName = `relationship_sales_history_${meta.saleIdx}_has_person_${personId}.json`;
          if (buyerRelKeys.has(relName)) return;
          buyerRelKeys.add(relName);
          writeJson(
            path.join(dataDir, relName),
            {
              from: { "/": `./${meta.saleFile}` },
              to: { "/": `./${pFile}` },
            },
          );
        } else if (b.type === "company") {
          const cFile = ensureCompany(b);
          const companyId = cFile.match(/(\d+)/)
            ? cFile.match(/(\d+)/)[1]
            : `${idx + 1}`;
          const relName = `relationship_sales_history_${meta.saleIdx}_has_company_${companyId}.json`;
          if (buyerRelKeys.has(relName)) return;
          buyerRelKeys.add(relName);
          writeJson(
            path.join(dataDir, relName),
            {
              from: { "/": `./${meta.saleFile}` },
              to: { "/": `./${cFile}` },
            },
          );
        }
      });
    });
  }

  // Mailing address for owners
  const mailingSpan = $("#mailingAddress");
  let mailingAddressValue = null;
  if (mailingSpan.length) {
    const mailingHtml = mailingSpan.html();
    if (mailingHtml) {
      const normalizedHtml = mailingHtml
        .replace(/<br\s*\/?>/gi, ", ")
        .replace(/\r?\n/gi, ", ");
      mailingAddressValue = cheerio
        .load(`<span>${normalizedHtml}</span>`)
        .text()
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/,\s*,/g, ", ")
        .trim();
    } else {
      mailingAddressValue = mailingSpan.text().replace(/\s+/g, " ").trim();
    }
  }
  if (mailingAddressValue) {
    writeJson(path.join(dataDir, "mailing_address.json"), {
      unnormalized_address: mailingAddressValue,
      latitude: null,
      longitude: null,
      source_http_request: addressSource,
      request_identifier: addressRequestId,
    });
    const seenMailingRel = new Set();
    mailingOwnerRefs.forEach((ref) => {
      if (!ref || !ref.file) return;
      const idMatch = ref.file.match(/(\d+)/);
      if (!idMatch) return;
      const relName =
        ref.type === "person"
          ? `relationship_person_${idMatch[1]}_has_mailing_address.json`
          : `relationship_company_${idMatch[1]}_has_mailing_address.json`;
      if (seenMailingRel.has(relName)) return;
      seenMailingRel.add(relName);
      writeJson(path.join(dataDir, relName), {
        from: { "/": `./${ref.file}` },
        to: { "/": "./mailing_address.json" },
      });
    });
  }

  // PROPERTY IMPROVEMENTS / PERMITS
  const permitTables = [];
  const modernPermits = $("#permitsTable");
  if (modernPermits.length) permitTables.push(modernPermits);
  const legacyPermits = $("#MainContent_frmParcelDetail_gvPermits");
  if (legacyPermits.length) permitTables.push(legacyPermits);
  const propertyImprovements = [];
  permitTables.forEach((table) => {
    if (!table || !table.length) return;
    let headerCells = table.find("thead tr").first().find("th");
    if (!headerCells.length) headerCells = table.find("tr").first().find("th");
    const headers = headerCells
      .map((i, th) => $(th).text().trim().toLowerCase())
      .get();
    function permitHeaderIndex(regex, fallback) {
      const idx = headers.findIndex((h) => regex.test(h));
      return idx >= 0 ? idx : fallback;
    }
    let rows = table.find("tbody tr");
    if (!rows.length) {
      const allRows = table.find("tr");
      if (allRows.length > 1) rows = allRows.slice(1);
    }
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (!tds.length) return;
      const idxPermit = permitHeaderIndex(/permit|number/, 0);
      const idxType = permitHeaderIndex(/type/, 1);
      const idxDesc = permitHeaderIndex(/description/, 1);
      const idxStatus = permitHeaderIndex(/status/, 2);
      const idxValue = permitHeaderIndex(/value|cost|amount/, 3);
      const idxIssued = permitHeaderIndex(/issued|issue|date/, 4);
      const idxFinal = permitHeaderIndex(/final|complete/, 5);
      const permitNumber =
        idxPermit >= 0 && idxPermit < tds.length
          ? $(tds.get(idxPermit)).text().trim() || null
          : null;
      const typeText =
        idxType >= 0 && idxType < tds.length
          ? $(tds.get(idxType)).text().trim() || null
          : null;
      const description =
        idxDesc >= 0 && idxDesc < tds.length
          ? $(tds.get(idxDesc)).text().trim() || null
          : null;
      const status =
        idxStatus >= 0 && idxStatus < tds.length
          ? $(tds.get(idxStatus)).text().trim() || null
          : null;
      const valueStr =
        idxValue >= 0 && idxValue < tds.length
          ? $(tds.get(idxValue)).text().trim()
          : null;
      const issuedStr =
        idxIssued >= 0 && idxIssued < tds.length
          ? $(tds.get(idxIssued)).text().trim()
          : null;
      const finalStr =
        idxFinal >= 0 && idxFinal < tds.length
          ? $(tds.get(idxFinal)).text().trim()
          : null;
      if (
        !permitNumber &&
        !typeText &&
        !description &&
        !status &&
        !valueStr &&
        !issuedStr &&
        !finalStr
      )
        return;
      const improvementRecord = {
        permit_number: permitNumber,
        type: typeText || description || null,
        status: status || null,
        value: valueStr != null ? parseCurrencyToNumber(valueStr) : null,
        issued_date: issuedStr ? toISODate(issuedStr) || issuedStr : null,
        completed_date: finalStr ? toISODate(finalStr) || finalStr : null,
        description: description || null,
      };
      propertyImprovements.push(improvementRecord);
    });
  });
  propertyImprovements.forEach((imp, idx) => {
    writeJson(
      path.join(dataDir, `property_improvement_${idx + 1}.json`),
      imp,
    );
  });

  // Property Image
  const propImg = $("#carousel img#imgPic").attr("src");
  if (propImg) {
    const ext = (propImg.split(".").pop() || "").toLowerCase();
    const fmt = ext === "png" ? "png" : "jpeg";
    const fileIdx = nextFileIndex++;
    writeJson(path.join(dataDir, `file_${fileIdx}.json`), {
      document_type: "PropertyImage",
      file_format: fmt,
      name: "Property Image 1",
      original_url: propImg,
      ipfs_url: null,
    });
  }
}

try {
  main();
  console.log("Extraction completed.");
} catch (e) {
  console.error(e.message || String(e));
  process.exit(1);
}
