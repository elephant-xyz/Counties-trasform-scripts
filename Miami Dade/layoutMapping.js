// Layout mapping script
// Reads input.json, extracts layout-related fields, and writes owners/layout_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    const fallback = {
      PropertyInfo: {
      },
    };
    fs.writeFileSync(inputPath, JSON.stringify(fallback, null, 2), "utf8");
  }
  return inputPath;
}

function loadInput() {
  const inputPath = ensureInput();
  const raw = fs.readFileSync(inputPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const $ = cheerio.load(raw);
    const text = $("body").text().trim();
    data = JSON.parse(text);
  }
  return data;
}

function defaultLayout(spaceType, index, floorLevel) {
  return {
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: floorLevel,
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
    kitchen_renovation_date: null,
    flooring_installation_date: null,
  };
}

function mapLayouts(data) {
  const pi = (data && data.PropertyInfo) || {};
  const id = pi.FolioNumber || "unknown";
  const bedroomCount =
    typeof pi.BedroomCount === "number" ? pi.BedroomCount : 0;
  const bathroomCount =
    typeof pi.BathroomCount === "number" ? pi.BathroomCount : 0;
  const floorLevel =
    pi.FloorCount === 1
      ? "1st Floor"
      : pi.FloorCount === 2
        ? "2nd Floor"
        : null;

  const layouts = [];
  for (let i = 1; i <= bedroomCount; i++) {
    layouts.push(defaultLayout("Bedroom", i, floorLevel));
  }
  for (let j = 1; j <= bathroomCount; j++) {
    layouts.push(
      defaultLayout("Full Bathroom", layouts.length + 1, floorLevel),
    );
  }

  return { [`property_${id}`]: { layouts } };
}

function run() {
  const data = loadInput();
  const output = mapLayouts(data);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

run();
