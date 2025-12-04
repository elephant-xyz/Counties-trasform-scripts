const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const MATERIAL_ENUMS = {
  flooring: {
    matches: [
      { regex: /terraz/i, value: "Terazzo" },
      { regex: /brick/i, value: "Brick" },
      { regex: /polished?\s*concrete|concrete/i, value: "Concrete" },
      { regex: /hardwood|wood/i, value: "Wood" },
      { regex: /laminate/i, value: "Laminate" },
      { regex: /carpet/i, value: "Carpet" },
      { regex: /marble/i, value: "Marble" },
      { regex: /stone/i, value: "Stone" },
      { regex: /quarry|tile/i, value: "Tile" },
      { regex: /ceramic/i, value: "CeramicTile" },
      { regex: /linoleum/i, value: "Linoleum" },
      { regex: /vinyl/i, value: "Vinyl" },
      { regex: /poured/i, value: "PouredConcrete" },
      { regex: /metal/i, value: "Metal" },
      { regex: /glass/i, value: "Glass" },
      { regex: /manufactured/i, value: "Manufactured" },
    ],
  },
  exteriorWall: {
    map: new Map([
      [/stucco/i, "Stucco"],
      [/concrete\s*block|block/i, "Concrete Block"],
      [/stone/i, "Natural Stone"],
      [/manufactured stone|synthetic masonry/i, "Manufactured Stone"],
      [/vinyl/i, "Vinyl Siding"],
      [/wood siding|clapboard|log/i, "Wood Siding"],
      [/fiber\s*cemen/i, "Fiber Cement Siding"],
      [/metal/i, "Metal Siding"],
      [/brick/i, "Brick"],
      [/curtain/i, "Curtain Wall"],
      [/precast/i, "Precast Concrete"],
      [/eifs/i, "EIFS"],
      [/adobe/i, "Adobe"],
      [/log/i, "Log"],
    ]),
  },
  roofCover: {
    map: new Map([
      [/metal\s*stand/i, "Metal Standing Seam"],
      [/metal\s*corr|corrugated/i, "Metal Corrugated"],
      [/metal/i, "Metal Standing Seam"],
      [/cement\s*tile|concrete\s*tile/i, "Concrete Tile"],
      [/clay\s*tile/i, "Clay Tile"],
      [/slate/i, "Natural Slate"],
      [/synthetic\s*slate/i, "Synthetic Slate"],
      [/shake/i, "Wood Shake"],
      [/(architect|comp\s*sh\s*240|comp\s*sh\s*heavy)/i, "Architectural Asphalt Shingle"],
      [/(asphalt\s*shingle|comp\s*sh\s*to\s*235|composition\s*shingle)/i, "3-Tab Asphalt Shingle"],
      [/shingle/i, "Architectural Asphalt Shingle"],
      [/(built[-\s]?up|composition\s*roll)/i, "Built-Up Roof"],
      [/tpo/i, "TPO Membrane"],
      [/epdm/i, "EPDM Membrane"],
      [/modified/i, "Modified Bitumen"],
      [/green/i, "Green Roof System"],
      [/solar/i, "Solar Integrated Tiles"],
    ]),
  },
};

const LAYOUT_FIELDS = [
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
  "is_exterior",
  "is_finished",
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
  "request_identifier",
  "safety_features",
  "size_square_feet",
  "spa_installation_date",
  "spa_type",
  "space_type",
  "space_type_index",
  "story_type",
  "total_area_sq_ft",
  "view_type",
  "visible_damage",
  "window_design_type",
  "window_material_type",
  "window_treatment_type",
];

const STRUCTURE_FIELDS = [
  "architectural_style_type",
  "attachment_type",
  "ceiling_condition",
  "ceiling_height_average",
  "ceiling_insulation_type",
  "ceiling_structure_material",
  "ceiling_surface_material",
  "exterior_door_installation_date",
  "exterior_door_material",
  "exterior_wall_condition",
  "exterior_wall_condition_primary",
  "exterior_wall_condition_secondary",
  "exterior_wall_insulation_type",
  "exterior_wall_insulation_type_primary",
  "exterior_wall_insulation_type_secondary",
  "exterior_wall_material_primary",
  "exterior_wall_material_secondary",
  "finished_base_area",
  "finished_basement_area",
  "finished_upper_story_area",
  "flooring_condition",
  "flooring_material_primary",
  "flooring_material_secondary",
  "foundation_condition",
  "foundation_material",
  "foundation_repair_date",
  "foundation_type",
  "foundation_waterproofing",
  "gutters_condition",
  "gutters_material",
  "interior_door_material",
  "interior_wall_condition",
  "interior_wall_finish_primary",
  "interior_wall_finish_secondary",
  "interior_wall_structure_material",
  "interior_wall_structure_material_primary",
  "interior_wall_structure_material_secondary",
  "interior_wall_surface_material_primary",
  "interior_wall_surface_material_secondary",
  "number_of_buildings",
  "number_of_stories",
  "primary_framing_material",
  "roof_age_years",
  "roof_condition",
  "roof_covering_material",
  "roof_date",
  "roof_design_type",
  "roof_material_type",
  "roof_structure_material",
  "roof_underlayment_type",
  "secondary_framing_material",
  "siding_installation_date",
  "structural_damage_indicators",
  "subfloor_material",
  "unfinished_base_area",
  "unfinished_basement_area",
  "unfinished_upper_story_area",
  "window_frame_material",
  "window_glazing_type",
  "window_installation_date",
  "window_operation_type",
  "window_screen_material",
];

const UTILITY_FIELDS = [
  "cooling_system_type",
  "electrical_panel_capacity",
  "electrical_panel_installation_date",
  "electrical_rewire_date",
  "electrical_wiring_type",
  "electrical_wiring_type_other_description",
  "heating_fuel_type",
  "heating_system_type",
  "hvac_capacity_kw",
  "hvac_capacity_tons",
  "hvac_condensing_unit_present",
  "hvac_equipment_component",
  "hvac_equipment_manufacturer",
  "hvac_equipment_model",
  "hvac_installation_date",
  "hvac_seer_rating",
  "hvac_system_configuration",
  "hvac_unit_condition",
  "hvac_unit_issues",
  "plumbing_fixture_count",
  "plumbing_fixture_quality",
  "plumbing_fixture_type_primary",
  "plumbing_system_installation_date",
  "plumbing_system_type",
  "plumbing_system_type_other_description",
  "public_utility_type",
  "sewer_connection_date",
  "sewer_type",
  "smart_home_features",
  "smart_home_features_other_description",
  "solar_installation_date",
  "solar_inverter_installation_date",
  "solar_inverter_manufacturer",
  "solar_inverter_model",
  "solar_inverter_visible",
  "solar_panel_present",
  "solar_panel_type",
  "solar_panel_type_other_description",
  "water_connection_date",
  "water_heater_installation_date",
  "water_heater_manufacturer",
  "water_heater_model",
  "water_source_type",
  "well_installation_date",
];

const PROPERTY_IMPROVEMENT_FIELDS = [
  "application_received_date",
  "completion_date",
  "contractor_type",
  "fee",
  "final_inspection_date",
  "improvement_action",
  "improvement_status",
  "improvement_type",
  "is_disaster_recovery",
  "is_owner_builder",
  "permit_close_date",
  "permit_issue_date",
  "permit_number",
  "permit_required",
  "private_provider_inspections",
  "private_provider_plan_review",
  "request_identifier",
];

function createEmptyObject(fields) {
  return fields.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createEmptyLayout() {
  const obj = createEmptyObject(LAYOUT_FIELDS);
  obj.is_exterior = null;
  obj.is_finished = null;
  obj.space_type = null;
  obj.space_type_index = null;
  return obj;
}

function createEmptyStructure() {
  return createEmptyObject(STRUCTURE_FIELDS);
}

function createEmptyUtility() {
  const obj = createEmptyObject(UTILITY_FIELDS);
  obj.solar_panel_present = false;
  obj.solar_inverter_visible = false;
  return obj;
}

function createEmptyPropertyImprovement() {
  return createEmptyObject(PROPERTY_IMPROVEMENT_FIELDS);
}

function normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

function applyRegexMap(value, mapEntries) {
  if (!value) return null;
  const raw = normalize(value);
  for (const [pattern, mapped] of mapEntries) {
    if (pattern.test(raw)) return mapped;
  }
  return null;
}

function mapFlooringMaterial(value) {
  if (!value) return null;
  const raw = normalize(value);
  for (const rule of MATERIAL_ENUMS.flooring.matches) {
    if (rule.regex.test(raw)) return rule.value;
  }
  return null;
}

function mapExteriorWallMaterial(value) {
  if (!value) return null;
  return applyRegexMap(value, MATERIAL_ENUMS.exteriorWall.map);
}

function mapExteriorWallAccent(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("brick")) return "Brick Accent";
  if (raw.includes("stone") || raw.includes("veneer")) return "Stone Accent";
  if (raw.includes("manufactured stone") || raw.includes("synthetic")) {
    return "Stone Accent";
  }
  if (raw.includes("wood")) return "Wood Trim";
  if (raw.includes("metal") || raw.includes("aluminum")) return "Metal Trim";
  if (raw.includes("stucco")) return "Stucco Accent";
  if (raw.includes("vinyl")) return "Vinyl Accent";
  if (raw.includes("block")) return "Decorative Block";
  return null;
}

function mapRoofCovering(value) {
  if (!value) return null;
  return applyRegexMap(value, MATERIAL_ENUMS.roofCover.map);
}

function mapRoofMaterialTypeFromCovering(coveringEnum) {
  if (!coveringEnum) return null;
  const mapping = {
    "3-Tab Asphalt Shingle": "Shingle",
    "Architectural Asphalt Shingle": "Shingle",
    "Metal Standing Seam": "Metal",
    "Metal Corrugated": "Metal",
    "Clay Tile": "Tile",
    "Concrete Tile": "Tile",
    "Natural Slate": "Stone",
    "Synthetic Slate": "Stone",
    "Wood Shake": "Wood",
    "Wood Shingle": "Wood",
    "TPO Membrane": "Composition",
    "EPDM Membrane": "Composition",
    "Modified Bitumen": "Composition",
    "Built-Up Roof": "Composition",
    "Green Roof System": "Shingle",
    "Solar Integrated Tiles": "Tile",
  };
  return mapping[coveringEnum] || null;
}

function mapAttachmentType(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("attached")) return "Attached";
  if (raw.includes("semi") || raw.includes("duplex")) return "SemiDetached";
  if (raw.includes("detached") || raw.includes("stand alone")) return "Detached";
  return null;
}

function mapPrimaryFramingMaterial(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("concrete block") || raw.includes("block")) return "Concrete Block";
  if (raw.includes("poured")) return "Poured Concrete";
  if (raw.includes("masonry")) return "Masonry";
  if (raw.includes("steel")) return "Steel Frame";
  if (raw.includes("engineered")) return "Engineered Lumber";
  if (raw.includes("post") || raw.includes("beam")) return "Post and Beam";
  if (raw.includes("log")) return "Log Construction";
  if (raw.includes("wood") || raw.includes("stud")) return "Wood Frame";
  return null;
}

function mapImprovementType(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("roof")) return "Roofing";
  if (raw.includes("pool") || raw.includes("spa")) return "PoolSpaInstallation";
  if (raw.includes("electric")) return "Electrical";
  if (raw.includes("mechanical") || raw.includes("hvac")) return "MechanicalHVAC";
  if (raw.includes("gas")) return "GasInstallation";
  if (raw.includes("plumb")) return "Plumbing";
  if (raw.includes("fence")) return "Fencing";
  if (raw.includes("dock") || raw.includes("seawall") || raw.includes("pier"))
    return "DockAndShore";
  if (raw.includes("window") || raw.includes("door") || raw.includes("opening") || raw.includes("stucco") || raw.includes("siding"))
    return "ExteriorOpeningsAndFinishes";
  if (raw.includes("landscap") || raw.includes("irrig")) return "LandscapeIrrigation";
  if (raw.includes("screen")) return "ScreenEnclosure";
  if (raw.includes("shutter") || raw.includes("awning")) return "ShutterAwning";
  if (raw.includes("demo") || raw.includes("demol")) return "Demolition";
  if (raw.includes("addition") || raw.includes("addtn")) return "BuildingAddition";
  if (raw.includes("remodel") || raw.includes("renov") || raw.includes("tenant")) return "CommercialConstruction";
  if (raw.includes("commercial")) return "CommercialConstruction";
  if (raw.includes("residential") || raw.includes("single family") || raw.includes("duplex"))
    return "ResidentialConstruction";
  if (raw.includes("mobile home") || raw.includes("manufactured home"))
    return "MobileHomeRV";
  if (raw.includes("solar")) return "Solar";
  if (raw.includes("site") || raw.includes("grading")) return "SiteDevelopment";
  if (raw.includes("general") || raw.includes("building")) return "GeneralBuilding";
  return null;
}

function mapImprovementStatus(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("complete") || raw.includes("closed") || raw.includes("final"))
    return "Completed";
  if (raw.includes("issue") || raw.includes("approved")) return "Permitted";
  if (raw.includes("progress") || raw.includes("active") || raw.includes("review") || raw.includes("under"))
    return "InProgress";
  if (raw.includes("plan") || raw.includes("applied") || raw.includes("application"))
    return "Planned";
  if (raw.includes("hold")) return "OnHold";
  if (raw.includes("cancel")) return "Cancelled";
  return null;
}

function mapImprovementAction(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("new") || raw.includes("construct") || raw.includes("build") || raw.includes("install"))
    return "New";
  if (raw.includes("re-roof") || raw.includes("reroof") || raw.includes("replace"))
    return "Replacement";
  if (raw.includes("repair")) return "Repair";
  if (raw.includes("alter") || raw.includes("renov") || raw.includes("remodel") || raw.includes("improv"))
    return "Alteration";
  if (raw.includes("addition") || raw.includes("expand")) return "Addition";
  if (raw.includes("demo") || raw.includes("remove") || raw.includes("tear"))
    return "Remove";
  return null;
}

function mapContractorType(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("owner")) return "DIY";
  if (raw.includes("manager")) return "PropertyManager";
  if (raw.includes("builder")) return "Builder";
  if (raw.includes("handyman")) return "HandymanService";
  if (raw.includes("contractor")) return "GeneralContractor";
  if (
    raw.includes("hvac") ||
    raw.includes("mechanic") ||
    raw.includes("electric") ||
    raw.includes("plumb") ||
    raw.includes("roof") ||
    raw.includes("pool")
  ) {
    return "Specialist";
  }
  return "Unknown";
}

const LAYOUT_FIELD_SET = new Set(LAYOUT_FIELDS);
const UTILITY_FIELD_SET = new Set(UTILITY_FIELDS);

function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function readJson(p) {
  return JSON.parse(readText(p));
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toISODate(mdY) {
  if (!mdY) return null;
  const parts = mdY
    .trim()
    .split(/[\/\-]/)
    .map((s) => s.trim());
  if (parts.length < 3) return null;
  let [m, d, y] = parts;
  m = parseInt(m, 10);
  d = parseInt(d, 10);
  y = parseInt(y, 10);
  if (y < 100) {
    y = y >= 50 ? 1900 + y : 2000 + y;
  }
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseCurrencyToNumber(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

const COMPANY_HINTS = [
  " LLC",
  " L.L.C",
  " INC",
  " CORPORATION",
  " CORP",
  " COMPANY",
  " CO ",
  " CO.",
  " TRUST",
  " TR ",
  " FOUNDATION",
  " ASSOCIATES",
  " ASSOCIATION",
  " GROUP",
  " HOLDINGS",
  " PARTNERS",
  " PARTNERSHIP",
  " LP",
  " LLP",
  " LLLP",
  " PLLC",
  " PLC",
  " PC ",
  " BANK",
  " FUND",
  " INVESTMENTS",
  " ENTERPRISE",
  " ENTERPRISES",
  " ESTATE",
  " EST ",
  " MINISTRIES",
  " CLUB",
  " UNIVERSITY",
  " COLLEGE",
  " SCHOOL",
  " HOSPITAL",
  " CHURCH",
  " MORTGAGE",
  " MGT",
  " MGMT",
  " CAPITAL",
  " REALTY",
  " PROPERTIES",
  " HOMEOWNERS ASSOCIATION",
  " HOA",
  " CONDOMINIUM ASSOCIATION",
  " COMMUNITY DEVELOPMENT",
];

function normalizePartyName(raw) {
  return raw ? String(raw).replace(/\s+/g, " ").replace(/\s*\(.*?\)\s*/g, " ").trim() : "";
}

function isCompanyName(raw) {
  const normalized = normalizePartyName(raw).toUpperCase();
  if (!normalized) return false;
  return COMPANY_HINTS.some((hint) => normalized.includes(hint.trim().toUpperCase()));
}

function parsePersonNameComponents(raw) {
  const cleaned = normalizePartyName(raw);
  if (!cleaned) return null;
  if (/seller\s*\-\s*see file/i.test(cleaned)) return null;
  let first = null;
  let last = null;
  let middle = null;
  if (cleaned.includes(",")) {
    const [lastPart, restPart] = cleaned.split(",", 2).map((p) => p.trim());
    const tokens = (restPart || "").split(/\s+/).filter(Boolean);
    first = tokens.shift() || null;
    if (tokens.length) middle = tokens.join(" ");
    last = lastPart || null;
  } else {
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      last = tokens[0];
      first = tokens[1];
      if (tokens.length > 2) middle = tokens.slice(2).join(" ");
    }
  }
  if (!first || !last) return null;
  return {
    first_name: first,
    last_name: last,
    middle_name: middle || null,
  };
}

function classifyParty(raw) {
  const cleaned = normalizePartyName(raw);
  if (!cleaned) return null;
  if (isCompanyName(cleaned)) {
    return { type: "company", name: cleaned };
  }
  const person = parsePersonNameComponents(cleaned);
  if (person) {
    return { type: "person", ...person };
  }
  if (cleaned.length > 0) {
    return { type: "company", name: cleaned };
  }
  return null;
}

function extractDeedReference(bookPageText, href) {
  let book = null;
  let page = null;
  let volume = null;
  const text = (bookPageText || "").replace(/\s+/g, " ").trim();
  if (text) {
    const parts = text.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      book = parts[0];
      page = parts[1];
    }
  }
  if (href) {
    try {
      const url = new URL(href);
      const params = url.searchParams;
      const bookNumber = params.get("booknumber");
      const pageNumber = params.get("pagenumber");
      const bookType = params.get("booktype");
      if (bookNumber) book = bookNumber;
      if (pageNumber) page = pageNumber;
      if (bookType) volume = bookType;
    } catch (error) {
      // ignore parse issues for malformed URLs
    }
  }
  return { book: book || null, page: page || null, volume: volume || null };
}

function dedupeRelationships(list) {
  const seen = new Set();
  const out = [];
  list.forEach((rel) => {
    const from = rel?.from?.["/"] || "";
    const to = rel?.to?.["/"] || "";
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rel);
  });
  return out;
}

function getIndexFromRelPath(relPath, prefix) {
  if (!relPath) return null;
  const clean = String(relPath).replace(/^\.\/+/, "");
  const regex = new RegExp(`^${prefix}(\\d+)\\.json$`, "i");
  const match = clean.match(regex);
  return match ? match[1] : null;
}

function writeRelationshipFiles(relations, buildFileName) {
  const uniq = dedupeRelationships(relations);
  uniq.forEach((rel) => {
    const fileName = buildFileName(rel);
    if (!fileName) return;
    writeJson(path.join("data", fileName), rel);
  });
}

const buildDefaultRelationshipFileName = (rel) => {
  const fromPath = rel?.from?.["/"];
  const toPath = rel?.to?.["/"];
  if (!fromPath || !toPath) return null;
  const fromBase = path.basename(fromPath).replace(/\.json$/i, "");
  const toBase = path.basename(toPath).replace(/\.json$/i, "");
  if (!fromBase || !toBase) return null;
  return `relationship_${fromBase}_has_${toBase}.json`;
};

function titleCaseName(s) {
  if (s == null) return null;
  s = String(s).toLowerCase();
  return s.replace(
    /(^|[\s\-\'])([a-z])/g,
    (m, p1, p2) => p1 + p2.toUpperCase(),
  );
}

function getValueByStrong($, label) {
  let out = null;
  $("td > strong").each((i, el) => {
    const t = $(el).text().trim();
    if (t.toLowerCase() === String(label).toLowerCase()) {
      const td = $(el).parent();
      const clone = td.clone();
      clone.children("strong").remove();
      let text = clone.text().replace(/\s+/g, " ").trim();
      out = text;
      return false;
    }
  });
  return out;
}

function errorUnknownEnum(value, cls, prop) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: `${cls}.${prop}`,
  };
  throw new Error(JSON.stringify(err));
}

const PROPERTY_USE_CODE_MAP = {};

function setPropertyUseMapping(codes, mapping) {
  const list = Array.isArray(codes) ? codes : [codes];
  list.forEach((code) => {
    PROPERTY_USE_CODE_MAP[code] = {
      property_type: mapping.property_type,
      property_usage_type: mapping.property_usage_type,
      build_status: mapping.build_status,
      ownership_estate_type: mapping.ownership_estate_type ?? "FeeSimple",
      structure_form: mapping.structure_form ?? null,
    };
  });
}

setPropertyUseMapping("0000", {
  property_type: "LandParcel",
  property_usage_type: "Residential",
  build_status: "VacantLand",
});

setPropertyUseMapping("0004", {
  property_type: "LandParcel",
  property_usage_type: "Residential",
  build_status: "VacantLand",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("0100", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "SingleFamilyDetached",
});

setPropertyUseMapping("0110", {
  property_type: "Building",
  property_usage_type: "TransitionalProperty",
  build_status: "Improved",
  structure_form: "SingleFamilyDetached",
});

setPropertyUseMapping("0200", {
  property_type: "ManufacturedHome",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "ManufacturedHomeOnLand",
});

setPropertyUseMapping("0300", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "MultiFamilyMoreThan10",
});

setPropertyUseMapping("0400", {
  property_type: "ManufacturedHome",
  property_usage_type: "Residential",
  build_status: "Improved",
  ownership_estate_type: "Condominium",
  structure_form: "ManufacturedHomeInPark",
});

setPropertyUseMapping("0403", {
  property_type: "Unit",
  property_usage_type: "Residential",
  build_status: "Improved",
  ownership_estate_type: "Timeshare",
  structure_form: "ApartmentUnit",
});

setPropertyUseMapping("0482", {
  property_type: "LandParcel",
  property_usage_type: "ResidentialCommonElementsAreas",
  build_status: "Improved",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("0500", {
  property_type: "Unit",
  property_usage_type: "Residential",
  build_status: "Improved",
  ownership_estate_type: "Cooperative",
  structure_form: "ApartmentUnit",
});

setPropertyUseMapping("0600", {
  property_type: "Building",
  property_usage_type: "Retirement",
  build_status: "Improved",
  structure_form: "MultiFamily5Plus",
});

setPropertyUseMapping("0700", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "MultiFamily5Plus",
});

setPropertyUseMapping("0800", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "Duplex",
});

setPropertyUseMapping("0803", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "Triplex",
});

setPropertyUseMapping("0804", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "Quadplex",
});

setPropertyUseMapping("0812", {
  property_type: "Building",
  property_usage_type: "Residential",
  build_status: "Improved",
  structure_form: "MultiFamilyLessThan10",
});

setPropertyUseMapping("1000", {
  property_type: "LandParcel",
  property_usage_type: "Commercial",
  build_status: "VacantLand",
});

setPropertyUseMapping("1001", {
  property_type: "LandParcel",
  property_usage_type: "TransitionalProperty",
  build_status: "VacantLand",
});

setPropertyUseMapping("1100", {
  property_type: "Building",
  property_usage_type: "RetailStore",
  build_status: "Improved",
});

setPropertyUseMapping("1200", {
  property_type: "Building",
  property_usage_type: "Commercial",
  build_status: "Improved",
});

setPropertyUseMapping("1204", {
  property_type: "Unit",
  property_usage_type: "Commercial",
  build_status: "Improved",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("1300", {
  property_type: "Building",
  property_usage_type: "DepartmentStore",
  build_status: "Improved",
});

setPropertyUseMapping("1400", {
  property_type: "Building",
  property_usage_type: "Supermarket",
  build_status: "Improved",
});

setPropertyUseMapping("1500", {
  property_type: "Building",
  property_usage_type: "ShoppingCenterRegional",
  build_status: "Improved",
});

setPropertyUseMapping("1600", {
  property_type: "Building",
  property_usage_type: "ShoppingCenterCommunity",
  build_status: "Improved",
});

setPropertyUseMapping("1700", {
  property_type: "Building",
  property_usage_type: "OfficeBuilding",
  build_status: "Improved",
});

setPropertyUseMapping("1800", {
  property_type: "Building",
  property_usage_type: "OfficeBuilding",
  build_status: "Improved",
});

setPropertyUseMapping("1900", {
  property_type: "Building",
  property_usage_type: "MedicalOffice",
  build_status: "Improved",
});

setPropertyUseMapping("2000", {
  property_type: "Building",
  property_usage_type: "TransportationTerminal",
  build_status: "Improved",
});

setPropertyUseMapping("2100", {
  property_type: "Building",
  property_usage_type: "Restaurant",
  build_status: "Improved",
});

setPropertyUseMapping("2200", {
  property_type: "Building",
  property_usage_type: "Restaurant",
  build_status: "Improved",
});

setPropertyUseMapping("2300", {
  property_type: "Building",
  property_usage_type: "FinancialInstitution",
  build_status: "Improved",
});

setPropertyUseMapping("2500", {
  property_type: "Building",
  property_usage_type: "Commercial",
  build_status: "Improved",
});

setPropertyUseMapping("2600", {
  property_type: "Building",
  property_usage_type: "ServiceStation",
  build_status: "Improved",
});

setPropertyUseMapping("2700", {
  property_type: "Building",
  property_usage_type: "AutoSalesRepair",
  build_status: "Improved",
});

setPropertyUseMapping("2800", {
  property_type: "LandParcel",
  property_usage_type: "MobileHomePark",
  build_status: "Improved",
});

setPropertyUseMapping("2900", {
  property_type: "Building",
  property_usage_type: "WholesaleOutlet",
  build_status: "Improved",
});

setPropertyUseMapping("3000", {
  property_type: "Building",
  property_usage_type: "NurseryGreenhouse",
  build_status: "Improved",
});

setPropertyUseMapping("3200", {
  property_type: "Building",
  property_usage_type: "Theater",
  build_status: "Improved",
});

setPropertyUseMapping("3300", {
  property_type: "Building",
  property_usage_type: "Entertainment",
  build_status: "Improved",
});

setPropertyUseMapping("3400", {
  property_type: "Building",
  property_usage_type: "Entertainment",
  build_status: "Improved",
});

setPropertyUseMapping("3500", {
  property_type: "Building",
  property_usage_type: "Entertainment",
  build_status: "Improved",
});

setPropertyUseMapping("3800", {
  property_type: "LandParcel",
  property_usage_type: "GolfCourse",
  build_status: "Improved",
});

setPropertyUseMapping("3900", {
  property_type: "Building",
  property_usage_type: "Hotel",
  build_status: "Improved",
});

setPropertyUseMapping("4000", {
  property_type: "LandParcel",
  property_usage_type: "Industrial",
  build_status: "VacantLand",
});

setPropertyUseMapping("4100", {
  property_type: "Building",
  property_usage_type: "LightManufacturing",
  build_status: "Improved",
});

setPropertyUseMapping("4200", {
  property_type: "Building",
  property_usage_type: "HeavyManufacturing",
  build_status: "Improved",
});

setPropertyUseMapping("4300", {
  property_type: "Building",
  property_usage_type: "LumberYard",
  build_status: "Improved",
});

setPropertyUseMapping("4600", {
  property_type: "Building",
  property_usage_type: "PackingPlant",
  build_status: "Improved",
});

setPropertyUseMapping("4700", {
  property_type: "Building",
  property_usage_type: "MineralProcessing",
  build_status: "Improved",
});

setPropertyUseMapping("4800", {
  property_type: "Building",
  property_usage_type: "Warehouse",
  build_status: "Improved",
});

setPropertyUseMapping("4804", {
  property_type: "Unit",
  property_usage_type: "Warehouse",
  build_status: "Improved",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("4900", {
  property_type: "LandParcel",
  property_usage_type: "OpenStorage",
  build_status: "Improved",
});

setPropertyUseMapping("5000", {
  property_type: "LandParcel",
  property_usage_type: "LivestockFacility",
  build_status: "Improved",
});

setPropertyUseMapping("5200", {
  property_type: "LandParcel",
  property_usage_type: "CroplandClass2",
  build_status: "Improved",
});

setPropertyUseMapping("5300", {
  property_type: "LandParcel",
  property_usage_type: "CroplandClass3",
  build_status: "Improved",
});

setPropertyUseMapping("5700", {
  property_type: "LandParcel",
  property_usage_type: "TimberLand",
  build_status: "VacantLand",
});

setPropertyUseMapping(["6300", "6400", "6500"], {
  property_type: "LandParcel",
  property_usage_type: "GrazingLand",
  build_status: "Improved",
});

setPropertyUseMapping("6600", {
  property_type: "LandParcel",
  property_usage_type: "OrchardGroves",
  build_status: "Improved",
});

setPropertyUseMapping("6700", {
  property_type: "LandParcel",
  property_usage_type: "Poultry",
  build_status: "Improved",
});

setPropertyUseMapping("6900", {
  property_type: "LandParcel",
  property_usage_type: "Ornamentals",
  build_status: "Improved",
});

setPropertyUseMapping("7000", {
  property_type: "LandParcel",
  property_usage_type: "GovernmentProperty",
  build_status: "VacantLand",
});

setPropertyUseMapping("7100", {
  property_type: "Building",
  property_usage_type: "Church",
  build_status: "Improved",
});

setPropertyUseMapping("7200", {
  property_type: "Building",
  property_usage_type: "PrivateSchool",
  build_status: "Improved",
});

setPropertyUseMapping("7300", {
  property_type: "Building",
  property_usage_type: "PrivateHospital",
  build_status: "Improved",
});

setPropertyUseMapping("7400", {
  property_type: "Building",
  property_usage_type: "HomesForAged",
  build_status: "Improved",
  structure_form: "MultiFamily5Plus",
});

setPropertyUseMapping("7500", {
  property_type: "Building",
  property_usage_type: "NonProfitCharity",
  build_status: "Improved",
});

setPropertyUseMapping("7600", {
  property_type: "LandParcel",
  property_usage_type: "MortuaryCemetery",
  build_status: "Improved",
});

setPropertyUseMapping("7700", {
  property_type: "Building",
  property_usage_type: "ClubsLodges",
  build_status: "Improved",
});

setPropertyUseMapping("7800", {
  property_type: "Building",
  property_usage_type: "SanitariumConvalescentHome",
  build_status: "Improved",
});

setPropertyUseMapping("8300", {
  property_type: "Building",
  property_usage_type: "PublicSchool",
  build_status: "Improved",
});

setPropertyUseMapping("8500", {
  property_type: "Building",
  property_usage_type: "PublicHospital",
  build_status: "Improved",
});

setPropertyUseMapping(["8600", "8700", "8800", "8900"], {
  property_type: "LandParcel",
  property_usage_type: "GovernmentProperty",
  build_status: "Improved",
});

setPropertyUseMapping("9100", {
  property_type: "Building",
  property_usage_type: "Utility",
  build_status: "Improved",
});

setPropertyUseMapping("9109", {
  property_type: "LandParcel",
  property_usage_type: "Utility",
  build_status: "VacantLand",
});

setPropertyUseMapping("9149", {
  property_type: "LandParcel",
  property_usage_type: "Utility",
  build_status: "VacantLand",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("9300", {
  property_type: "LandParcel",
  property_usage_type: "Unknown",
  build_status: "VacantLand",
  ownership_estate_type: "SubsurfaceRights",
});

setPropertyUseMapping(["9400", "9409", "9449", "9499"], {
  property_type: "LandParcel",
  property_usage_type: "ReferenceParcel",
  build_status: "VacantLand",
  ownership_estate_type: "RightOfWay",
});

setPropertyUseMapping("9500", {
  property_type: "LandParcel",
  property_usage_type: "RiversLakes",
  build_status: "VacantLand",
});

setPropertyUseMapping("9509", {
  property_type: "LandParcel",
  property_usage_type: "RiversLakes",
  build_status: "VacantLand",
});

setPropertyUseMapping("9549", {
  property_type: "LandParcel",
  property_usage_type: "RiversLakes",
  build_status: "VacantLand",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("9599", {
  property_type: "LandParcel",
  property_usage_type: "RiversLakes",
  build_status: "VacantLand",
});

setPropertyUseMapping("9700", {
  property_type: "LandParcel",
  property_usage_type: "ForestParkRecreation",
  build_status: "VacantLand",
});

setPropertyUseMapping("9709", {
  property_type: "LandParcel",
  property_usage_type: "ForestParkRecreation",
  build_status: "VacantLand",
});

setPropertyUseMapping("9749", {
  property_type: "LandParcel",
  property_usage_type: "ForestParkRecreation",
  build_status: "VacantLand",
  ownership_estate_type: "Condominium",
});

setPropertyUseMapping("9800", {
  property_type: "LandParcel",
  property_usage_type: "Railroad",
  build_status: "Improved",
});

setPropertyUseMapping("9900", {
  property_type: "LandParcel",
  property_usage_type: "Agricultural",
  build_status: "VacantLand",
});

setPropertyUseMapping("9901", {
  property_type: "LandParcel",
  property_usage_type: "Agricultural",
  build_status: "Improved",
});

function parsePropertyUseCode(raw) {
  if (!raw) return null;
  const match = String(raw).match(/(\d{3,4})/);
  return match ? match[1] : null;
}

function lookupPropertyUseClassification(...candidates) {
  for (const raw of candidates) {
    const code = parsePropertyUseCode(raw);
    if (!code) continue;
    const mapping = PROPERTY_USE_CODE_MAP[code];
    if (mapping) {
      return { code, mapping };
    }
  }
  return null;
}

function mapUnitsType(units) {
  if (units == null) return null;
  const u = parseInt(units, 10);
  if (u === 1) return "One";
  if (u === 2) return "Two";
  if (u === 3) return "Three";
  if (u === 4) return "Four";
  return null;
}

function mapStreetSuffixType(suf) {
  if (!suf) return null;
  const m = {
    ALLEY: "Aly",
    ALY: "Aly",
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    CIR: "Cir",
    CIRCLE: "Cir",
    COURT: "Ct",
    CT: "Ct",
    DR: "Dr",
    DRIVE: "Dr",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    LN: "Ln",
    LANE: "Ln",
    PKWY: "Pkwy",
    RD: "Rd",
    ROAD: "Rd",
    RDS: "Rds",
    ST: "St",
    STREET: "St",
    TER: "Ter",
    TERRACE: "Ter",
    WAY: "Way",
    PL: "Pl",
    PLAZA: "Plz",
    PLZ: "Plz",
    TRCE: "Trce",
    TRL: "Trl",
    TRAIL: "Trl",
    XING: "Xing",
    KY: "Ky",
    VW: "Vw",
    RUN: "Run",
    MALL: "Mall",
    PASS: "Pass",
    ROW: "Row",
    LOOP: "Loop",
    WALK: "Walk",
    PT: "Pt",
    PINES: "Pnes",
    PTS: "Pts",
  };
  const key = String(suf).trim().toUpperCase();
  const v = m[key] || null;
  if (!v) {
    errorUnknownEnum(suf, "address", "street_suffix_type");
  }
  return v;
}

function mapDeedType(raw) {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t.includes("special warranty")) return "Special Warranty Deed";
  if (t.includes("warranty")) return "Warranty Deed";
  if (t.includes("quit") && t.includes("claim")) return "Quitclaim Deed";
  if (t.includes("grant deed")) return "Grant Deed";
  if (t.includes("bargain") && t.includes("sale")) return "Bargain and Sale Deed";
  if (t.includes("lady bird")) return "Lady Bird Deed";
  if (t.includes("transfer on death")) return "Transfer on Death Deed";
  if (t.includes("sheriff")) return "Sheriff's Deed";
  if (t.includes("tax deed")) return "Tax Deed";
  if (t.includes("trustee")) return "Trustee's Deed";
  if (t.includes("personal representative")) return "Personal Representative Deed";
  if (t.includes("correction")) return "Correction Deed";
  if (t.includes("foreclosure")) return "Deed in Lieu of Foreclosure";
  if (t.includes("life estate")) return "Life Estate Deed";
  if (t.includes("joint tenancy")) return "Joint Tenancy Deed";
  if (t.includes("tenancy in common")) return "Tenancy in Common Deed";
  if (t.includes("community property")) return "Community Property Deed";
  if (t.includes("gift")) return "Gift Deed";
  if (t.includes("interspousal")) return "Interspousal Transfer Deed";
  if (t.includes("quiet title")) return "Quiet Title Deed";
  if (t.includes("administrator")) return "Administrator's Deed";
  if (t.includes("guardian")) return "Guardian's Deed";
  if (t.includes("receiver")) return "Receiver's Deed";
  if (t.includes("right of way")) return "Right of Way Deed";
  if (t.includes("vacation of plat")) return "Vacation of Plat Deed";
  if (t.includes("assignment")) return "Assignment of Contract";
  if (t.includes("release")) return "Release of Contract";
  if (t.includes("certificate of title")) return "Miscellaneous";
  if (t.includes("court order")) return "Court Order Deed";
  if (t.includes("special master")) return "Special Master’s Deed";
  if (t.includes("contract for deed")) return "Contract for Deed";
  if (t.includes("wild deed")) return "Wild Deed";
  return null;
}

function mapDocumentTypeForFile(rawType) {
  const t = rawType ? rawType.toLowerCase() : "";
  if (t.includes("title")) return "Title";
  if (t.includes("deed")) return "Title";
  return "Title";
}

function cleanNum(text) {
  if (text == null) return null;
  const only = String(text).replace(/[^0-9]/g, "");
  if (only === "") return null;
  return parseInt(only, 10);
}

function parseSquareFeetValue(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function main() {
  const inputHtmlPath = "input.html";
  const addrPath = "unnormalized_address.json";
  const seedPath = "property_seed.json";
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = readText(inputHtmlPath);
  const $ = cheerio.load(html);
  const addr = readJson(addrPath);
  const seed = readJson(seedPath);
  const ownersData = readJson(ownersPath);
  const utilitiesData = readJson(utilsPath);
  const layoutData = readJson(layoutPath);

  ensureDir("data");
  const dataDir = path.resolve("data");
  try {
    const cleanupPatterns = [
      /^property_improvement_\d+\.json$/i,
      /^relationship_property_has_property_improvement_\d+\.json$/i,
    ];
    fs.readdirSync(dataDir).forEach((file) => {
      if (cleanupPatterns.some((regex) => regex.test(file))) {
        fs.unlinkSync(path.join(dataDir, file));
      }
    });
  } catch (cleanupErr) {
    // Ignore cleanup errors; directory may not exist yet.
  }

  // Address
  const fullAddressEntry =
    (addr && (addr.full_address || addr.unnormalized_address)) ||
    getValueByStrong($, "Situs Address") ||
    null;
  const unnormalizedAddress = fullAddressEntry
    ? fullAddressEntry.replace(/\s+/g, " ").trim()
    : null;

  let latitude =
    addr && typeof addr.latitude === "number" ? addr.latitude : null;
  let longitude =
    addr && typeof addr.longitude === "number" ? addr.longitude : null;
  const gmHref = $("a.property-google-maps").attr("href");
  if ((latitude == null || longitude == null) && gmHref) {
    const mm = gmHref.match(/viewpoint=([-0-9\.]+),([-0-9\.]+)/);
    if (mm) {
      latitude = parseFloat(mm[1]);
      longitude = parseFloat(mm[2]);
    }
  }
  const addressOut = {
    unnormalized_address: unnormalizedAddress || null,
    county_name:
      addr && addr.county_jurisdiction
        ? addr.county_jurisdiction
        : seed && seed.county_name
          ? seed.county_name
          : 'Martin',
    country_code:
      (addr && addr.country_code) ||
      (seed && seed.country_code) ||
      "US",
  };
  writeJson(path.join("data", "address.json"), addressOut);

  const mailingAddressText =
    getValueByStrong($, "Mailing Address") ||
    (addr && addr.mailing_address) ||
    null;
  const mailingAddressNormalized = mailingAddressText
    ? mailingAddressText.replace(/\s+/g, " ").trim()
    : null;
  const mailingAddressOut = {
    unnormalized_address: mailingAddressNormalized || null,
    latitude: null,
    longitude: null,
    request_identifier:
      (addr && addr.request_identifier) ||
      (seed && seed.request_identifier) ||
      null,
    source_http_request:
      (addr && addr.source_http_request) ||
      (seed && seed.source_http_request) ||
      null,
  };
  const mailingAddressFile = "mailing_address.json";
  writeJson(path.join("data", mailingAddressFile), mailingAddressOut);

  const geometryOut = {
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    request_identifier:
      (addr && addr.request_identifier) ||
      (seed && seed.request_identifier) ||
      null,
    source_http_request:
      (addr && addr.source_http_request) ||
      (seed && seed.source_http_request) ||
      null,
  };
  writeJson(path.join("data", "geometry.json"), geometryOut);

  const relAddressGeometry = [
    {
      from: { "/": "./address.json" },
      to: { "/": "./geometry.json" },
    },
  ];
  writeJson(
    path.join("data", "relationship_address_geometry.json"),
    relAddressGeometry,
  );

  // Property
  const parcelId =
    getValueByStrong($, "Parcel ID") ||
    seed.parcel_id ||
    seed.parcelIdentifier ||
    null;
  const propertyUseCandidates = [
    getValueByStrong($, "Use Code/Property Class") || "",
    getValueByStrong($, "Property Use Code") || "",
    addr && addr.property_use_code,
    seed && seed.property_use_code,
  ];
  const primaryPropertyUseText =
    propertyUseCandidates.find((v) => v && String(v).trim()) || "";
  const propertyClassification = lookupPropertyUseClassification(
    ...propertyUseCandidates,
  );
  if (!propertyClassification) {
    const raw =
      propertyUseCandidates.filter(Boolean).join(" | ") || "Unspecified";
    errorUnknownEnum(raw, "property", "property_use_code");
  }
  const { mapping: propertyCodeMapping } = propertyClassification;

  let livable =
    getValueByStrong($, "Total Finished Area") ||
    getValueByStrong($, "Finished Area") ||
    null;
  const yearBuiltText = getValueByStrong($, "Year Built");
  const yearBuilt = yearBuiltText
    ? parseInt(yearBuiltText.replace(/[^0-9]/g, ""), 10)
    : null;
  const numUnitsText = getValueByStrong($, "Number of Units");
  const numUnits = numUnitsText
    ? parseInt(numUnitsText.replace(/[^0-9]/g, ""), 10)
    : null;
  const unitsType = mapUnitsType(numUnits);
  if (unitsType == null) {
    errorUnknownEnum(
      String(numUnitsText || ""),
      "property",
      "number_of_units_type",
    );
  }

  // Full legal description without disclaimer
  let legalFull = null;
  const legalTd = $("div.table-section.full-legal-description td").first();
  if (legalTd && legalTd.length) {
    const clone = legalTd.clone();
    clone.find(".legal-disclaimer").remove();
    legalFull = clone.text().replace(/\s+/g, " ").trim();
  } else {
    const legalShort = getValueByStrong($, "Legal Description");
    legalFull = legalShort || null;
  }

  const neighborhood = getValueByStrong($, "Neighborhood");

  const propertyOut = {
    parcel_identifier: parcelId,
    property_type: propertyCodeMapping.property_type,
    property_usage_type: propertyCodeMapping.property_usage_type,
    build_status: propertyCodeMapping.build_status,
    ownership_estate_type: propertyCodeMapping.ownership_estate_type,
    structure_form: propertyCodeMapping.structure_form ?? null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: null,
    livable_floor_area: livable || null,
    area_under_air: livable || null,
    total_area: null,
    number_of_units: numUnits || null,
    number_of_units_type: unitsType,
    property_legal_description_text: legalFull || null,
    subdivision: neighborhood || null,
    zoning: null,
    historic_designation: undefined,
  };
  Object.keys(propertyOut).forEach((k) => {
    if (propertyOut[k] === undefined) delete propertyOut[k];
  });
  writeJson(path.join("data", "property.json"), propertyOut);

  // Lot
  const legalAcresText = getValueByStrong($, "Legal Acres");
  let lotSizeAcre = legalAcresText
    ? parseFloat(legalAcresText.replace(/[^0-9.]/g, ""))
    : null;
  if (isNaN(lotSizeAcre)) lotSizeAcre = null;
  let lotAreaSqft = null;
  if (lotSizeAcre != null) {
    lotAreaSqft = Math.round(lotSizeAcre * 43560);
  }
  let lotType = null;
  if (lotSizeAcre != null) {
    lotType =
      lotSizeAcre <= 0.25
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  const lotOut = {
    lot_type: lotType || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotAreaSqft || null,
    lot_size_acre: lotSizeAcre || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJson(path.join("data", "lot.json"), lotOut);

  // Taxes
  const taxes = [];
  const currentValueBlock = $("div.table-section.current-value");
  if (currentValueBlock.length) {
    const tds = currentValueBlock.find("td");
    const row = {};
    tds.each((i, td) => {
      const strong = $(td).find("strong").text().trim();
      const text = $(td).text().replace(strong, "").trim();
      if (strong) row[strong] = text;
    });
    const year = parseInt(row["Year"], 10);
    if (!isNaN(year)) {
      taxes.push({
        tax_year: year,
        property_land_amount: parseCurrencyToNumber(row["Land Value"]),
        property_building_amount: parseCurrencyToNumber(
          row["Improvement Value"],
        ),
        property_market_value_amount: parseCurrencyToNumber(
          row["Market Value"],
        ),
        property_assessed_value_amount: parseCurrencyToNumber(
          row["Assessed Value"],
        ),
        property_taxable_value_amount: parseCurrencyToNumber(
          row["County Taxable Value"],
        ),
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: null,
      });
    }
  }
  $("div.value-history-table table tr").each((i, tr) => {
    if (i === 0) return;
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length >= 8) {
      const year = parseInt($(tds[0]).text().trim(), 10);
      if (!isNaN(year)) {
        taxes.push({
          tax_year: year,
          property_land_amount: parseCurrencyToNumber($(tds[1]).text()),
          property_building_amount: parseCurrencyToNumber($(tds[2]).text()),
          property_market_value_amount: parseCurrencyToNumber($(tds[3]).text()),
          property_assessed_value_amount: parseCurrencyToNumber(
            $(tds[5]).text(),
          ),
          property_taxable_value_amount: parseCurrencyToNumber(
            $(tds[7]).text(),
          ),
          monthly_tax_amount: null,
          period_start_date: null,
          period_end_date: null,
          yearly_tax_amount: null,
        });
      }
    }
  });
  const seenYears = new Set();
  taxes.forEach((t) => {
    if (seenYears.has(t.tax_year)) return;
    seenYears.add(t.tax_year);
    writeJson(path.join("data", `tax_${t.tax_year}.json`), t);
  });

  // Party catalogs for owners and sales participants
  const personMap = new Map();
  const persons = [];
  function personKey(p) {
    return [p.first_name || "", p.middle_name || "", p.last_name || ""]
      .join("|")
      .toLowerCase();
  }
  function addPerson(p) {
    if (!p || !p.first_name || !p.last_name) return null;
    const k = personKey(p);
    if (personMap.has(k)) return personMap.get(k);
    const idx = persons.length + 1;
    const first = titleCaseName(p.first_name);
    const last = titleCaseName(p.last_name);
    const middle = p.middle_name ? titleCaseName(p.middle_name) : null;
    const personObj = {
      birth_date: null,
      first_name: first,
      last_name: last,
      middle_name: middle,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const file = `person_${idx}.json`;
    persons.push({ file, data: personObj, k });
    personMap.set(k, file);
    return file;
  }

  const companies = [];
  const companyMap = new Map();
  function companyKey(name) {
    return (name || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function ensureCompany(name) {
    const normalized = (name || "").replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    const key = companyKey(normalized);
    if (companyMap.has(key)) return companyMap.get(key);
    const idx = companies.length + 1;
    const companyObj = { name: normalized };
    const file = `company_${idx}.json`;
    companies.push({ file, data: companyObj, key });
    companyMap.set(key, file);
    return file;
  }

  // Sales / Deeds / Files
  const salesRows = [];
  $("div.sale-history-table table tr").each((i, tr) => {
    if (i === 0) return;
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length >= 6) {
      const saleDate = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const grantor = $(tds[2]).text().trim();
      const deedTypeRaw = $(tds[3]).text().trim();
      const docNum = $(tds[4]).text().trim();
      const linkA = $(tds[5]).find("a");
      const bookPageText = linkA.text().trim();
      const link = linkA.attr("href") || null;
      salesRows.push({
        saleDate,
        priceTxt,
        grantor,
        deedTypeRaw,
        docNum,
        bookPageText,
        link,
      });
    }
  });

  const salesHistoryOut = [];
  const deedsOut = [];
  const filesOut = [];
  const relSalesHistoryDeed = [];
  const relDeedFile = [];
  const relSalesPersons = [];
  const relSalesCompanies = [];
  const saleGrantorPersons = [];
  const saleGrantorCompanies = [];

  salesRows.forEach((row) => {
    const isoDate = toISODate(row.saleDate);
    const price = parseCurrencyToNumber(row.priceTxt);
    const deedType = row.deedTypeRaw ? mapDeedType(row.deedTypeRaw) : null;

    const saleIndex = salesHistoryOut.length + 1;
    const saleFile = `sales_history_${saleIndex}.json`;
    const saleObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: price ?? null,
    };
    salesHistoryOut.push({ file: saleFile, data: saleObj });

    const { book, page, volume } = extractDeedReference(
      row.bookPageText,
      row.link,
    );
    const deedIndex = deedsOut.length + 1;
    const deedFile = `deed_${deedIndex}.json`;
    const deedObj = {};
    if (deedType !== null && deedType !== undefined) {
      deedObj.deed_type = deedType;
    }
    if (book) deedObj.book = book;
    if (page) deedObj.page = page;
    if (volume) deedObj.volume = volume;
    if (row.docNum) deedObj.instrument_number = String(row.docNum).trim();
    deedsOut.push({ file: deedFile, data: deedObj });

    relSalesHistoryDeed.push({
      from: { "/": `./${saleFile}` },
      to: { "/": `./${deedFile}` },
    });

    if (row.link) {
      const fileIndex = filesOut.length + 1;
      const docType = mapDocumentTypeForFile(row.deedTypeRaw || "");
      const name = row.bookPageText
        ? `Book ${row.bookPageText.replace(/\s+/g, " ").trim().replace(" ", " Page ")}`
        : `Recorded Document ${saleIndex}`;
      const fileObj = {
        document_type: docType,
        file_format: null,
        ipfs_url: null,
        name: name,
        original_url: row.link,
      };
      filesOut.push({ file: `file_${fileIndex}.json`, data: fileObj });
      relDeedFile.push({
        from: { "/": `./${deedFile}` },
        to: { "/": `./file_${fileIndex}.json` },
      });
    }

    const party = classifyParty(row.grantor);
    if (party) {
      if (party.type === "person") {
        const file = addPerson(party);
        if (file) {
          saleGrantorPersons.push({ saleIndex, file });
        }
      } else if (party.type === "company") {
        const file = ensureCompany(party.name);
        if (file) {
          saleGrantorCompanies.push({ saleIndex, file });
        }
      }
    }
  });

  salesHistoryOut.forEach((s) => writeJson(path.join("data", s.file), s.data));
  deedsOut.forEach((d) => writeJson(path.join("data", d.file), d.data));
  filesOut.forEach((f) => writeJson(path.join("data", f.file), f.data));

  // Owners and relationships
  const parcelKey = `property_${seed.parcel_id || seed.request_identifier || ""}`;
  const acctKey = `property_${seed.request_identifier}`;
  const ownersRoot =
    ownersData[parcelKey] ||
    ownersData[acctKey] ||
    ownersData[Object.keys(ownersData)[0]];
  const ownersByDate =
    ownersRoot && ownersRoot.owners_by_date ? ownersRoot.owners_by_date : {};

  Object.keys(ownersByDate).forEach((dateKey) => {
    (ownersByDate[dateKey] || []).forEach((o) => {
      if (o.type === "person") addPerson(o);
      if (o.type === "company" && o.name) ensureCompany(o.name);
    });
  });
  const currentOwners = ownersByDate["current"] || [];
  const currentOwnerPersonFiles = [];
  const currentOwnerCompanyFiles = [];
  currentOwners.forEach((o) => {
    if (o.type === "person") {
      const file = addPerson(o);
      if (file) currentOwnerPersonFiles.push(file);
    } else if (o.type === "company" && o.name) {
      const file = ensureCompany(o.name);
      if (file) currentOwnerCompanyFiles.push(file);
    }
  });

  const mailingPersonRelationships = [];
  const mailingCompanyRelationships = [];
  Array.from(new Set(currentOwnerPersonFiles)).forEach((file) => {
    mailingPersonRelationships.push({
      from: { "/": `./${file}` },
      to: { "/": `./${mailingAddressFile}` },
    });
  });
  Array.from(new Set(currentOwnerCompanyFiles)).forEach((file) => {
    mailingCompanyRelationships.push({
      from: { "/": `./${file}` },
      to: { "/": `./${mailingAddressFile}` },
    });
  });

  // Relationships
  const saleFileByIndex = new Map();
  salesHistoryOut.forEach((sObj, idx) => {
    saleFileByIndex.set(idx + 1, sObj.file);
  });

  saleGrantorPersons.forEach(({ saleIndex, file }) => {
    const prevSaleFile = saleFileByIndex.get(saleIndex + 1);
    if (!prevSaleFile) return;
    relSalesPersons.push({
      to: { "/": `./${file}` },
      from: { "/": `./${prevSaleFile}` },
    });
  });

  saleGrantorCompanies.forEach(({ saleIndex, file }) => {
    const prevSaleFile = saleFileByIndex.get(saleIndex + 1);
    if (!prevSaleFile) return;
    relSalesCompanies.push({
      to: { "/": `./${file}` },
      from: { "/": `./${prevSaleFile}` },
    });
  });

  // Link latest sale to current owners (prefer company if present)
  const parseISO = (s) => (s ? new Date(s).getTime() : 0);
  let latestIdx = -1,
    latestTs = -1;
  salesHistoryOut.forEach((sObj, i) => {
    const ts = parseISO(sObj.data.ownership_transfer_date);
    if (ts > latestTs) {
      latestTs = ts;
      latestIdx = i;
    }
  });
  if (latestIdx >= 0) {
    const sObj = salesHistoryOut[latestIdx];
    const companiesHere = currentOwners.filter((o) => o.type === "company");
    if (companiesHere.length) {
      companiesHere.forEach((c) => {
        const cFile = companyMap.get(companyKey(c.name));
        if (cFile) {
          relSalesCompanies.push({
            to: { "/": `./${cFile}` },
            from: { "/": `./${sObj.file}` },
          });
        }
      });
    } else {
      currentOwners
        .filter((o) => o.type === "person")
        .forEach((o) => {
          const file = personMap.get(personKey(o));
          if (file) {
            relSalesPersons.push({
              to: { "/": `./${file}` },
              from: { "/": `./${sObj.file}` },
            });
          }
        });
    }
  }

  // Chain-based buyers: for each non-latest sale, link to next sale's sellers (owners_by_date at next sale date), but avoid linking when next seller equals current seller (no transfer)
  const combined = salesHistoryOut
    .map((sObj, idx) => ({
      file: sObj.file,
      iso: sObj.data.ownership_transfer_date,
      seller: (salesRows[idx] && salesRows[idx].grantor
        ? salesRows[idx].grantor
        : ""
      )
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((x) => x.iso);
  combined.sort((a, b) => new Date(a.iso) - new Date(b.iso));
  for (let i = 0; i < combined.length - 1; i++) {
    const curr = combined[i];
    const next = combined[i + 1];
    if (!next.iso) continue;
    if (next.seller && curr.seller && next.seller === curr.seller) continue; // same seller -> ambiguous, skip
    const buyers = ownersByDate[next.iso] || [];
    const personsHere = buyers.filter((o) => o.type === "person");
    personsHere.forEach((p) => {
      const pFile = personMap.get(personKey(p));
      if (pFile) {
        relSalesPersons.push({
          to: { "/": `./${pFile}` },
          from: { "/": `./${curr.file}` },
        });
      }
    });
  }

  persons.forEach((p) => writeJson(path.join("data", p.file), p.data));
  companies.forEach((c) => writeJson(path.join("data", c.file), c.data));

  writeRelationshipFiles(relSalesHistoryDeed, (rel) => {
    const fromPath = rel?.from?.["/"];
    const toPath = rel?.to?.["/"];
    const saleIdx = getIndexFromRelPath(fromPath, "sales_history_");
    const deedIdx = getIndexFromRelPath(toPath, "deed_");
    if (!saleIdx || !deedIdx) return null;
    return `relationship_sales_history_${saleIdx}_deed_${deedIdx}.json`;
  });

  writeRelationshipFiles(relDeedFile, (rel) => {
    const fromPath = rel?.from?.["/"];
    const toPath = rel?.to?.["/"];
    const deedIdx = getIndexFromRelPath(fromPath, "deed_");
    const fileIdx = getIndexFromRelPath(toPath, "file_");
    if (!deedIdx || !fileIdx) return null;
    return `relationship_deed_${deedIdx}_file_${fileIdx}.json`;
  });

  writeRelationshipFiles(relSalesPersons, (rel) => {
    const toPath = rel?.to?.["/"];
    const fromPath = rel?.from?.["/"];
    const personIdx = getIndexFromRelPath(toPath, "person_");
    const saleIdx = getIndexFromRelPath(fromPath, "sales_history_");
    if (!personIdx || !saleIdx) return null;
    return `relationship_sales_history_${saleIdx}_person_${personIdx}.json`;
  });

  writeRelationshipFiles(relSalesCompanies, (rel) => {
    const toPath = rel?.to?.["/"];
    const fromPath = rel?.from?.["/"];
    const companyIdx = getIndexFromRelPath(toPath, "company_");
    const saleIdx = getIndexFromRelPath(fromPath, "sales_history_");
    if (!companyIdx || !saleIdx) return null;
    return `relationship_sales_history_${saleIdx}_company_${companyIdx}.json`;
  });

  writeRelationshipFiles(mailingPersonRelationships, (rel) => {
    const toPath = rel?.to?.["/"];
    const personIdx = getIndexFromRelPath(toPath, "person_");
    if (!personIdx) return null;
    return `relationship_person_${personIdx}_has_mailing_address.json`;
  });

  writeRelationshipFiles(mailingCompanyRelationships, (rel) => {
    const toPath = rel?.to?.["/"];
    const companyIdx = getIndexFromRelPath(toPath, "company_");
    if (!companyIdx) return null;
    return `relationship_company_${companyIdx}_has_mailing_address.json`;
  });

  // Utilities
  const utilsRoot =
    utilitiesData[acctKey] ||
    utilitiesData[parcelKey] ||
    utilitiesData[Object.keys(utilitiesData)[0]] ||
    {};
  const utilityOut = createEmptyUtility();
  Object.entries(utilsRoot).forEach(([key, value]) => {
    if (!UTILITY_FIELD_SET.has(key)) return;
    if (value !== undefined && value !== null) {
      utilityOut[key] = value;
    }
  });
  if (!utilityOut.public_utility_type && utilsRoot.public_ility_type) {
    utilityOut.public_utility_type = utilsRoot.public_ility_type;
  }
  const utilityTemplate = utilityOut;

  // Layouts
  const layoutRoot =
    layoutData[acctKey] ||
    layoutData[parcelKey] ||
    layoutData[Object.keys(layoutData)[0]] ||
    {};
  const sourceLayouts = Array.isArray(layoutRoot.layouts)
    ? layoutRoot.layouts
    : [];

const layoutFilesOut = [];
  const layoutHasLayoutRels = [];
  const layoutHasUtilityRels = [];
  const layoutHasStructureRels = [];
  const propertyHasUtilityRels = [];
  const propertyHasStructureRels = [];
  const utilityFiles = [];
  const structureFiles = [];

  let layoutCounter = 0;
  function nextLayoutFileName() {
    layoutCounter += 1;
    return `layout_${layoutCounter}.json`;
  }

  function recordLayout(data, meta = {}) {
    const file = nextLayoutFileName();
    layoutFilesOut.push({ file, data, meta: { ...meta, file } });
    return file;
  }

  function addLayoutRelationship(fromFile, toFile) {
    layoutHasLayoutRels.push({
      from: { "/": `./${fromFile}` },
      to: { "/": `./${toFile}` },
    });
  }

  const propertyIsLand =
    propertyCodeMapping &&
    propertyCodeMapping.property_type === "LandParcel";

  const buildingEntries = [];

  const EXTERIOR_SPACE_TYPES = new Set([
    "Attached Garage",
    "Detached Garage",
    "Carport",
    "Attached Carport",
    "Detached Carport",
    "Porch",
    "Screened Porch",
    "Open Porch",
    "Deck",
    "Balcony",
    "Patio",
    "Pergola",
    "Lanai",
    "Gazebo",
    "Outdoor Kitchen",
    "Outdoor Pool",
    "Indoor Pool",
    "Hot Tub / Spa Area",
    "Pool Area",
    "Pool House",
    "Tiki Hut",
    "Shed",
    "Barn",
    "Greenhouse",
    "Courtyard",
    "Terrace",
  ]);

  const EXCLUDED_LAYOUT_COPY_FIELDS = new Set([
    "space_type",
    "space_type_index",
    "is_exterior",
    "is_finished",
    "size_square_feet",
    "total_area_sq_ft",
    "livable_area_sq_ft",
    "area_under_air_sq_ft",
    "heated_area_sq_ft",
    "flooring_material_type",
    "building_number",
  ]);

  function copyLayoutFields(target, source) {
    if (!source) return;
    Object.entries(source).forEach(([key, value]) => {
      if (!LAYOUT_FIELD_SET.has(key) || EXCLUDED_LAYOUT_COPY_FIELDS.has(key)) {
        return;
      }
      if (value !== undefined && value !== null) {
        target[key] = value;
      }
    });
  }

  function normalizeBuildingNumber(value, fallback = 1) {
    if (value == null) return fallback;
    const str = String(value).trim();
    if (!str) return fallback;
    const digits = str.replace(/[^0-9\-]/g, "");
    const parsed = Number.parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function getSpaceTypePriorityValue(type) {
    const normalized = String(type || "").toLowerCase();
    if (!normalized) return 50;
    if (normalized.includes("living") || normalized.includes("great room") || normalized.includes("family")) return 0;
    if (normalized.includes("primary bedroom")) return 1;
    if (normalized.includes("bedroom")) return 2;
    if (normalized.includes("primary bath")) return 3;
    if (normalized.includes("bath")) return 4;
    if (normalized.includes("kitchen")) return 5;
    if (normalized.includes("dining") || normalized.includes("nook")) return 6;
    if (normalized.includes("office") || normalized.includes("study") || normalized.includes("den")) return 7;
    if (normalized.includes("laundry") || normalized.includes("mudroom")) return 8;
    if (normalized.includes("closet") || normalized.includes("storage") || normalized.includes("utility")) return 9;
    if (normalized.includes("garage")) return 20;
    if (
      normalized.includes("porch") ||
      normalized.includes("patio") ||
      normalized.includes("deck") ||
      normalized.includes("balcony") ||
      normalized.includes("terrace") ||
      normalized.includes("gazebo") ||
      normalized.includes("lanai")
    ) {
      return 30;
    }
    if (normalized.includes("pool")) return 40;
    if (
      normalized.includes("spa") ||
      normalized.includes("jacuzzi") ||
      normalized.includes("hot tub")
    ) {
      return 41;
    }
    return 60;
  }

  function layoutPriority(entry) {
    const data = entry?.data || {};
    const isExterior = data.is_exterior === true ? 1 : 0;
    const basePriority = getSpaceTypePriorityValue(data.space_type);
    const originalOrder = entry?.meta?.originalOrder ?? 0;
    return [isExterior, basePriority, originalOrder];
  }

  function compareLayoutEntries(a, b) {
    const aKey = layoutPriority(a);
    const bKey = layoutPriority(b);
    for (let i = 0; i < aKey.length; i += 1) {
      if (aKey[i] < bKey[i]) return -1;
      if (aKey[i] > bKey[i]) return 1;
    }
    return 0;
  }

  function reindexLayoutSpaceTypeIndexes(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const meta = entry.meta || {};
      const buildingIndex =
        meta.buildingIndex != null ? meta.buildingIndex : 1;
      if (!groups.has(buildingIndex)) {
        groups.set(buildingIndex, {
          buildingIndex,
          buildingEntry: null,
          children: [],
        });
      }
      const group = groups.get(buildingIndex);
      if (meta.isBuilding) {
        group.buildingEntry = entry;
      } else {
        group.children.push(entry);
      }
    });

    groups.forEach((group) => {
      const buildingIdx = group.buildingIndex;
      if (group.buildingEntry) {
        group.buildingEntry.data.space_type_index = String(buildingIdx);
      }
      group.children.sort(compareLayoutEntries);
      const typeCounters = new Map();
      group.children.forEach((entry) => {
        const typeKey = String(entry?.data?.space_type || "").toLowerCase();
        const current = typeCounters.get(typeKey) || 0;
        const next = current + 1;
        typeCounters.set(typeKey, next);
        entry.data.space_type_index = `${buildingIdx}.${next}`;
      });
    });
  }

  function buildLayoutDataFromSource(src = {}, overrides = {}) {
    const layout = createEmptyLayout();

    copyLayoutFields(layout, src);
    copyLayoutFields(layout, overrides);

    const resolvedSpaceType =
      overrides.space_type ?? src.space_type ?? null;
    layout.space_type = resolvedSpaceType;

    const explicitExterior =
      overrides.is_exterior ?? src.is_exterior;
    const resolvedExterior =
      typeof explicitExterior === "boolean"
        ? explicitExterior
        : resolvedSpaceType
          ? EXTERIOR_SPACE_TYPES.has(resolvedSpaceType)
          : null;
    layout.is_exterior =
      resolvedExterior === null ? null : Boolean(resolvedExterior);

    const explicitFinished =
      overrides.is_finished ?? src.is_finished;
    layout.is_finished =
      typeof explicitFinished === "boolean"
        ? explicitFinished
        : layout.is_exterior === true
          ? false
          : layout.is_exterior === false
            ? true
            : null;

    let spaceTypeIndex =
      overrides.space_type_index ?? src.space_type_index ?? null;
    if (spaceTypeIndex != null) {
      spaceTypeIndex = String(spaceTypeIndex);
    }
    layout.space_type_index = spaceTypeIndex;
    layout.building_number =
      overrides.building_number ?? src.building_number ?? null;

    const sizeSqft = parseSquareFeetValue(
      overrides.size_square_feet ??
        src.size_square_feet ??
        layout.size_square_feet,
    );
    const totalAreaSqft = parseSquareFeetValue(
      overrides.total_area_sq_ft ??
        src.total_area_sq_ft ??
        layout.total_area_sq_ft,
    );
    const livableAreaSqft = parseSquareFeetValue(
      overrides.livable_area_sq_ft ??
        src.livable_area_sq_ft ??
        layout.livable_area_sq_ft,
    );
    const areaUnderAirSqft = parseSquareFeetValue(
      overrides.area_under_air_sq_ft ??
        src.area_under_air_sq_ft ??
        layout.area_under_air_sq_ft,
    );

    layout.size_square_feet = sizeSqft ?? null;
    layout.total_area_sq_ft = totalAreaSqft ?? sizeSqft ?? null;

    const interiorLivable =
      layout.is_exterior === false ? livableAreaSqft ?? sizeSqft : null;
    layout.livable_area_sq_ft =
      layout.is_exterior === false ? interiorLivable : null;

    const areaUnderAir =
      layout.is_exterior === false
        ? areaUnderAirSqft ?? layout.livable_area_sq_ft
        : null;
    layout.area_under_air_sq_ft = areaUnderAir;
    layout.heated_area_sq_ft = areaUnderAir;

    const flooringValue =
      overrides.flooring_material_type ?? src.flooring_material_type;
    layout.flooring_material_type =
      mapFlooringMaterial(flooringValue) ?? null;

    return layout;
  }

  if (!propertyIsLand) {
    const layoutGroups = new Map();
    sourceLayouts.forEach((room, idx) => {
      const rawBuilding =
        room.building_number ??
        room.buildingNumber ??
        room.building_index ??
        room.buildingIndex ??
        null;
      const buildingNumber = normalizeBuildingNumber(rawBuilding, 1);
      if (!layoutGroups.has(buildingNumber)) {
        layoutGroups.set(buildingNumber, []);
      }
      layoutGroups.get(buildingNumber).push({ layout: room, originalIndex: idx });
    });

    const orderedGroups = Array.from(layoutGroups.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    const livableSqftProperty =
      parseSquareFeetValue(propertyOut.livable_floor_area);
    const totalSqftProperty =
      parseSquareFeetValue(propertyOut.total_area) ||
      parseSquareFeetValue(layoutRoot.total_area) ||
      parseSquareFeetValue(
        (sourceLayouts.find((l) => parseFloat(l.size_square_feet)) || {})
          .size_square_feet,
      ) ||
      livableSqftProperty;

    const effectiveGroups =
      orderedGroups.length > 0 ? orderedGroups : [[1, []]];

    effectiveGroups.forEach(([buildingNumber, rooms], idx) => {
      const buildingIndex = idx + 1;
      const buildingLayout = createEmptyLayout();
      buildingLayout.space_type = "Building";
      buildingLayout.building_number = buildingNumber;
      buildingLayout.is_exterior = false;
      buildingLayout.is_finished = true;
      if (idx === 0) {
        buildingLayout.size_square_feet = totalSqftProperty ?? null;
        buildingLayout.total_area_sq_ft = totalSqftProperty ?? null;
        buildingLayout.livable_area_sq_ft = livableSqftProperty ?? null;
        buildingLayout.area_under_air_sq_ft = livableSqftProperty ?? null;
        buildingLayout.heated_area_sq_ft = livableSqftProperty ?? null;
      }

      const buildingFile = recordLayout(buildingLayout, {
        buildingIndex,
        buildingNumber,
        isBuilding: true,
        parentFile: null,
        originalOrder: idx,
      });

      buildingEntries.push({
        file: buildingFile,
        index: buildingIndex,
        buildingNumber,
        data: buildingLayout,
        rooms,
        childEntries: [],
      });
    });

    buildingEntries.forEach((entry) => {
      entry.rooms.forEach(({ layout: room, originalIndex }) => {
        const roomLayout = buildLayoutDataFromSource(room, {
          building_number: entry.buildingNumber,
        });
        const roomFile = recordLayout(roomLayout, {
          buildingIndex: entry.index,
          buildingNumber: entry.buildingNumber,
          isBuilding: false,
          parentFile: entry.file,
          originalOrder: originalIndex,
        });
        addLayoutRelationship(entry.file, roomFile);
        entry.childEntries.push({ file: roomFile, data: roomLayout });
      });
    });

    buildingEntries.forEach((entry, idx) => {
      let totalArea = 0;
      let livableArea = 0;
      entry.childEntries.forEach(({ data }) => {
        const area = data.size_square_feet || 0;
        if (!data.is_exterior && area) {
          totalArea += area;
          const livableValue =
            data.livable_area_sq_ft ??
            data.area_under_air_sq_ft ??
            area;
          if (livableValue) livableArea += livableValue;
        }
      });

      if (totalArea === 0 && idx === 0 && totalSqftProperty) {
        totalArea = totalSqftProperty;
      }
      if (livableArea === 0 && idx === 0 && livableSqftProperty) {
        livableArea = livableSqftProperty;
      }

      const finalTotal = totalArea || null;
      const finalLivable = livableArea || null;

      entry.data.size_square_feet = finalTotal;
      entry.data.total_area_sq_ft = finalTotal;
      entry.data.livable_area_sq_ft = finalLivable;
      entry.data.area_under_air_sq_ft = finalLivable;
      entry.data.heated_area_sq_ft = finalLivable;
    });
  } else {
    // Land-only properties: preserve original layout entries without hierarchy
    let landOrder = 0;
    sourceLayouts.forEach((layout) => {
      landOrder += 1;
      const layoutData = buildLayoutDataFromSource(layout, {
        space_type_index: layout.space_type_index ?? null,
      });
      recordLayout(layoutData, {
        buildingIndex: 1,
        buildingNumber: null,
        isBuilding: false,
        parentFile: null,
        originalOrder: landOrder,
      });
    });
  }

  reindexLayoutSpaceTypeIndexes(layoutFilesOut);

  layoutFilesOut.forEach((entry) =>
    writeJson(path.join("data", entry.file), entry.data),
  );

  if (!propertyIsLand && buildingEntries.length) {
    if (fs.existsSync("data")) {
      fs.readdirSync("data")
        .filter((name) => /^utility_\d+\.json$/i.test(name))
        .forEach((name) => {
          fs.unlinkSync(path.join("data", name));
        });
      fs.readdirSync("data")
        .filter((name) =>
          /^relationship_layout_\d+_has_utility.*\.json$/i.test(name),
        )
        .forEach((name) => {
          fs.unlinkSync(path.join("data", name));
        });
    }
    buildingEntries.forEach((entry) => {
      const utilityFileName = `utility_${entry.index}.json`;
      const utilityData = JSON.parse(JSON.stringify(utilityTemplate));
      const utilityPath = path.join("data", utilityFileName);
      writeJson(utilityPath, utilityData);
      utilityFiles.push({
        file: utilityFileName,
        buildingIndex: entry.index,
        data: utilityData,
      });
    });
    const legacyUtilityPath = path.join("data", "utility.json");
    if (fs.existsSync(legacyUtilityPath)) {
      fs.unlinkSync(legacyUtilityPath);
    }
  } else {
    const utilityFileName = "utility.json";
    const utilityData = JSON.parse(JSON.stringify(utilityTemplate));
    writeJson(path.join("data", utilityFileName), utilityData);
    utilityFiles.push({ file: utilityFileName, buildingIndex: null, data: utilityData });
  }

  // Structure
  const wallText = getValueByStrong($, "Wall");
  const exteriorCover = getValueByStrong($, "Exterior Cover");
  const roofCover = getValueByStrong($, "Roof Cover");
  const maxStories = getValueByStrong($, "Max Stories");
  const finishedArea =
    getValueByStrong($, "Total Finished Area") ||
    getValueByStrong($, "Finished Area");

  const structureTemplate = createEmptyStructure();
  const attachmentSource =
    propertyUseCandidates.find((v) => v && String(v).trim()) ||
    primaryPropertyUseText ||
    "";
  structureTemplate.attachment_type = mapAttachmentType(attachmentSource);
  structureTemplate.exterior_wall_material_primary =
    mapExteriorWallMaterial(wallText) || null;
  structureTemplate.exterior_wall_material_secondary =
    mapExteriorWallAccent(exteriorCover) || null;
  structureTemplate.primary_framing_material =
    mapPrimaryFramingMaterial(wallText) || null;
  structureTemplate.roof_covering_material = mapRoofCovering(roofCover) || null;
  structureTemplate.roof_material_type = mapRoofMaterialTypeFromCovering(
    structureTemplate.roof_covering_material,
  );
  structureTemplate.finished_base_area = finishedArea ? cleanNum(finishedArea) : null;
  structureTemplate.number_of_stories = maxStories
    ? parseFloat(maxStories)
    : structureTemplate.number_of_stories;

  if (!propertyIsLand && buildingEntries.length) {
    if (fs.existsSync("data")) {
      fs.readdirSync("data")
        .filter((name) => /^structure_\d+\.json$/i.test(name))
        .forEach((name) => {
          fs.unlinkSync(path.join("data", name));
        });
      fs.readdirSync("data")
        .filter((name) =>
          /^relationship_layout_\d+_has_structure.*\.json$/i.test(name),
        )
        .forEach((name) => {
          fs.unlinkSync(path.join("data", name));
        });
    }
    buildingEntries.forEach((entry) => {
      const structureFileName = `structure_${entry.index}.json`;
      const structureData = JSON.parse(JSON.stringify(structureTemplate));
      const derivedFinished =
        entry.data.total_area_sq_ft ?? structureData.finished_base_area;
      structureData.finished_base_area = derivedFinished ?? null;
      const structurePath = path.join("data", structureFileName);
      writeJson(structurePath, structureData);
      structureFiles.push({
        file: structureFileName,
        buildingIndex: entry.index,
        data: structureData,
      });
    });
    const legacyStructurePath = path.join("data", "structure.json");
    if (fs.existsSync(legacyStructurePath)) {
      fs.unlinkSync(legacyStructurePath);
    }
  } else if (!propertyIsLand) {
    const structureFileName = "structure_1.json";
    const structureData = JSON.parse(JSON.stringify(structureTemplate));
    writeJson(path.join("data", structureFileName), structureData);
    structureFiles.push({ file: structureFileName, buildingIndex: 1, data: structureData });
  }

  const propertyImprovementRecords = [];
  const permitSections = [];
  $("div.table-section").each((_, section) => {
    const heading = $(section).find("h2.table-heading").first().text().trim();
    if (/permit/i.test(heading)) permitSections.push(section);
  });

  const seenPermitNumbers = new Set();
  permitSections.forEach((section) => {
    const $section = $(section);
    $section.find("table").each((_, table) => {
      const $table = $(table);
      const headerCells = $table.find("tr").first().find("th,td");
      if (!headerCells.length) return;
      const headers = headerCells
        .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get();
      if (!headers.some((h) => /permit/i.test(h))) return;
      const normalizedHeaders = headers.map((h) => h.toLowerCase());
      $table
        .find("tr")
        .slice(1)
        .each((__, row) => {
          const cells = $(row).find("td");
          if (!cells.length) return;
          const values = cells
            .map((idx, cell) =>
              $(cell).text().replace(/\s+/g, " ").trim(),
            )
            .get();
          const findValue = (...patterns) => {
            for (const pattern of patterns) {
              const regex =
                pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
              for (let i = 0; i < normalizedHeaders.length; i += 1) {
                if (!regex.test(normalizedHeaders[i])) continue;
                const val = values[i];
                if (val && val !== "-" && val.toLowerCase() !== "n/a") {
                  return val;
                }
              }
            }
            return null;
          };

          const permitNumber =
            findValue(/permit\s*(no\.?|number|#)/, /^permit$/) || null;
          const permitType =
            findValue(/permit\s*type/, /permit\s*category/) || null;
          const workType =
            findValue(/work\s*(class|type)/, /^work$/) ||
            findValue(/^type$/) ||
            null;
          const statusText = findValue(/status/) || null;
          const appliedText =
            findValue(/applied/, /application/, /received/) || null;
          const issuedText = findValue(/issued/, /issue/) || null;
          const finalText = findValue(/final/) || null;
          const completionText =
            findValue(/complete/, /completion/) || null;
          const closeText = findValue(/close/) || null;
          const contractorText =
            findValue(/contractor/, /applicant/, /builder/) || null;
          const valueText =
            findValue(/value/, /valuation/, /fee/, /cost/) || null;
          const descriptionText =
            findValue(
              /description/,
              /scope/,
              /remarks/,
              /work\s*description/,
            ) || null;

          const hasContent =
            (permitNumber && permitNumber.length) ||
            (permitType && permitType.length) ||
            (descriptionText && descriptionText.length);
          if (!hasContent) return;

          if (permitNumber) {
            const normalizedPermit = permitNumber.toLowerCase();
            if (seenPermitNumbers.has(normalizedPermit)) return;
            seenPermitNumbers.add(normalizedPermit);
          }

          const improvement = createEmptyPropertyImprovement();
          if (permitNumber) improvement.permit_number = permitNumber;
          improvement.application_received_date =
            toISODate(appliedText) || null;
          improvement.permit_issue_date = toISODate(issuedText) || null;
          improvement.final_inspection_date = toISODate(finalText) || null;
          improvement.completion_date = toISODate(completionText) || null;
          improvement.permit_close_date = toISODate(closeText) || null;
          improvement.fee = parseCurrencyToNumber(valueText);

          const typeForMapping = permitType || workType || descriptionText;
          improvement.improvement_type =
            mapImprovementType(typeForMapping) || null;

          improvement.improvement_status =
            mapImprovementStatus(statusText) || null;

          const actionSource = workType || descriptionText || permitType;
          improvement.improvement_action =
            mapImprovementAction(actionSource) || null;

          if (contractorText) {
            improvement.contractor_type =
              mapContractorType(contractorText) || "Unknown";
          }

          propertyImprovementRecords.push(improvement);
        });
    });
  });

  const propertyImprovementFiles = [];
  propertyImprovementRecords.forEach((record, idx) => {
    const fileName = `property_improvement_${idx + 1}.json`;
    writeJson(path.join("data", fileName), record);
    propertyImprovementFiles.push(fileName);
  });

  const propertyFileName = "property.json";

  propertyImprovementFiles.forEach((file, idx) => {
    const relFile = `relationship_property_has_property_improvement_${idx + 1}.json`;
    writeJson(path.join("data", relFile), {
      from: { "/": `./${propertyFileName}` },
      to: { "/": `./${file}` },
    });
  });

  if (utilityFiles.length) {
    utilityFiles.forEach(({ file, buildingIndex }) => {
      const target = { "/": `./${file}` };
      if (buildingIndex != null) {
        const buildingEntry = buildingEntries.find(
          (entry) => entry.index === buildingIndex,
        );
        if (buildingEntry) {
          layoutHasUtilityRels.push({
            from: { "/": `./${buildingEntry.file}` },
            to: target,
          });
          return;
        }
      }
      propertyHasUtilityRels.push({
        from: { "/": `./${propertyFileName}` },
        to: target,
      });
    });
  }

  if (structureFiles.length) {
    structureFiles.forEach(({ file, buildingIndex }) => {
      const target = { "/": `./${file}` };
      if (buildingIndex != null) {
        const buildingEntry = buildingEntries.find(
          (entry) => entry.index === buildingIndex,
        );
        if (buildingEntry) {
          layoutHasStructureRels.push({
            from: { "/": `./${buildingEntry.file}` },
            to: target,
          });
          return;
        }
      }
      propertyHasStructureRels.push({
        from: { "/": `./${propertyFileName}` },
        to: target,
      });
    });
  }

  writeRelationshipFiles(
    layoutHasLayoutRels,
    buildDefaultRelationshipFileName,
  );
  writeRelationshipFiles(
    layoutHasUtilityRels,
    buildDefaultRelationshipFileName,
  );
  writeRelationshipFiles(
    layoutHasStructureRels,
    buildDefaultRelationshipFileName,
  );
  writeRelationshipFiles(
    propertyHasUtilityRels,
    buildDefaultRelationshipFileName,
  );
  writeRelationshipFiles(
    propertyHasStructureRels,
    buildDefaultRelationshipFileName,
  );
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  try {
    const obj = JSON.parse(e.message);
    console.error(JSON.stringify(obj));
  } catch (_) {
    console.error(e.stack || String(e));
  }
  process.exit(1);
}
