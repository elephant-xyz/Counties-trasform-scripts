// layoutMapping.js
// Reads input.json, extracts layout details, and writes owners/layout_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureInput() {
  if (!fs.existsSync(path.resolve("input.json"))) {
    fs.writeFileSync(
        "input.json",
        JSON.stringify({ note: "missing" }, null, 2),
        "utf-8",
    );
  }
}

function loadInput() {
  ensureInput();
  try {
    return JSON.parse(fs.readFileSync("input.json", "utf-8"));
  } catch (e) {
    return {};
  }
}

function defaultLayout(space_type, index) {
  return {
    space_type,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: null,
    total_area_sq_ft:null,
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

    bathroom_renovation_date: null,
    cabinet_style: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
  };
}

function buildLayouts(input) {
  const bldg =
      (input.parcelBuildingFeatures && input.parcelBuildingFeatures[0]) || {};
  const layouts = [];
  const bedrooms = bldg.beds || 0;
  const baths = bldg.baths || 0;
  const grossArea = bldg.grossArea || null;
  const livingArea = bldg.livingArea || null;

  // Add Living Area layout with grossArea as size
  if (grossArea != null || livingArea != null) {
    const livingAreaLayout = defaultLayout("Living Area", 1);
    livingAreaLayout.total_area_sq_ft = grossArea != null ? Number(grossArea) : null;
    livingAreaLayout.livable_area_sq_ft = livingArea != null ? Number(livingArea) : null;
    layouts.push(livingAreaLayout);
  }

  // Represent each bedroom and bathroom as distinct layout objects
  for (let i = 1; i <= bedrooms; i++) {
    layouts.push(defaultLayout("Bedroom", i + (grossArea != null ? 1 : 0)));
  }
  for (let j = 1; j <= baths; j++) {
    layouts.push(defaultLayout("Full Bathroom", bedrooms + j + (grossArea != null ? 1 : 0)));
  }

  // REMOVE the fallback - no fallback needed

  return layouts;
}

function main() {
  const input = loadInput();
  const parcelId =
      (input.parcelGeneralProfile && input.parcelGeneralProfile.parcelId) ||
      (input.parcelQuickSearchSummary &&
          input.parcelQuickSearchSummary[0] &&
          input.parcelQuickSearchSummary[0].parcelId) ||
      "unknown";
  const layouts = buildLayouts(input);

  const ownersDir = path.resolve("owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });

  const outPath = path.join(ownersDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");
}

if (require.main === module) {
  main();
}
