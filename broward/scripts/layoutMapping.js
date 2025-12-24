// Layout mapping script
// Reads input.json and writes owners/layout_data.json keyed by property_[folio] with layouts array

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function coerceNumber(val) {
  if (val == null) return null;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function coerceInteger(val) {
  if (val == null) return null;
  const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

const DEFAULT_LAYOUT_FIELDS = {
  adjustable_area_sq_ft: null,
  area_under_air_sq_ft: null,
  bathroom_renovation_date: null,
  building_number: null,
  built_year: null,
  cabinet_style: null,
  clutter_level: null,
  condition_issues: null,
  countertop_material: null,
  decor_elements: null,
  design_style: null,
  fixture_finish_quality: null,
  floor_level: null,
  flooring_installation_date: null,
  flooring_material_type: null,
  flooring_wear: null,
  furnished: null,
  has_windows: null,
  heated_area_sq_ft: null,
  installation_date: null,
  is_exterior: false,
  is_finished: true,
  kitchen_renovation_date: null,
  lighting_features: null,
  livable_area_sq_ft: null,
  natural_light_quality: null,
  paint_condition: null,
  pool_condition: null,
  pool_equipment: null,
  pool_installation_date: null,
  pool_surface_type: null,
  pool_type: null,
  pool_water_quality: null,
  safety_features: null,
  size_square_feet: null,
  spa_installation_date: null,
  spa_type: null,
  story_type: null,
  total_area_sq_ft: null,
  view_type: null,
  visible_damage: null,
  window_design_type: null,
  window_material_type: null,
  window_treatment_type: null,
};

function createLayout(spaceType, spaceTypeIndex, overrides = {}) {
  return {
    space_type: spaceType,
    space_type_index: spaceTypeIndex != null ? String(spaceTypeIndex) : null,
    ...DEFAULT_LAYOUT_FIELDS,
    ...overrides,
  };
}

function createBedroomLayouts(count) {
  const layouts = [];
  for (let i = 1; i <= count; i++) {
    layouts.push(
      createLayout("Bedroom", i),
    );
  }
  return layouts;
}

function computeBathroomCounts(bathValue) {
  if (bathValue == null || isNaN(bathValue) || bathValue < 0) {
    return { full: 0, half: 0 };
  }
  const full = Math.floor(bathValue);
  const fractional = bathValue - full;
  const hasHalf = fractional > 0 ? 1 : 0;
  return { full, half: hasHalf };
}

function createBathroomLayouts(counts) {
  const layouts = [];

  for (let i = 1; i <= counts.full; i++) {
    layouts.push(
      createLayout("Full Bathroom", i),
    );
  }

  for (let i = 1; i <= counts.half; i++) {
    layouts.push(
      createLayout("Half Bathroom / Powder Room", i),
    );
  }

  return layouts;
}

function extractFromInput(inputObj) {
  const root = inputObj.d || inputObj;
  const parcelArr = root.parcelInfok__BackingField || [];
  const parcel = parcelArr[0] || {};
  const folio = parcel.folioNumber || parcel.folio || "unknown";

  const beds = coerceInteger(parcel.beds) || 0;
  const baths = coerceNumber(parcel.baths) || 0;

  const layouts = [];

  if (beds > 0) {
    const bedroomLayouts = createBedroomLayouts(beds);
    layouts.push(...bedroomLayouts);
  }

  const bathCounts = computeBathroomCounts(baths);
  if (bathCounts.full > 0 || bathCounts.half > 0) {
    const bathroomLayouts = createBathroomLayouts(bathCounts);
    layouts.push(...bathroomLayouts);
  }

  return { folio, layouts };
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  let parsed = safeParseJSON(raw);
  if (!parsed) {
    const $ = cheerio.load(raw || "");
    const text = $("body").text().trim();
    parsed = safeParseJSON(text);
  }
  if (!parsed) throw new Error("Unable to parse input.json");

  const { folio, layouts } = extractFromInput(parsed);

  const outObj = {};
  outObj[`property_${folio}`] = { layouts };

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
})();
