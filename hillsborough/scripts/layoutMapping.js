// Layout mapping script: reads input.json and outputs owners/layout_data.json per schema
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function defaultLayout(space_type, index, size, floor) {
  return {
    space_type,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: size,
    floor_level: floor,
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
    size_square_feet: size,
  };
}

function mapLayouts(input) {
  const b = (input.buildings && input.buildings[0]) || {};
  const layouts = [];
  const floor = "1st Floor";

  // Bedrooms: represent each bedroom as a layout object
  const bedCount = Math.round(b.bedrooms || 0);
  for (let i = 1; i <= bedCount; i++) {
    layouts.push(defaultLayout("Bedroom", i, null, floor));
  }

  // Bathrooms: full bathrooms count -> Full Bathroom objects
  const bathCount = Math.round(b.bathrooms || 0);
  for (let i = 1; i <= bathCount; i++) {
    layouts.push(defaultLayout("Full Bathroom", bedCount + i, null, floor));
  }

  // Pool area if extraFeatures indicates pool or spa
  const hasPool = (input.extraFeatures || []).some((x) =>
    /POOL/i.test(x.description || ""),
  );
  if (hasPool) {
    const poolLayout = defaultLayout(
      "Outdoor Pool",
      bedCount + bathCount + 1,
      null,
      null,
    );
    poolLayout.is_exterior = true;
    poolLayout.is_finished = true;
    poolLayout.pool_type = "BuiltIn";
    poolLayout.pool_condition = null;
    poolLayout.pool_surface_type = null;
    poolLayout.pool_water_quality = null;
    layouts.push(poolLayout);
  }

  // Living room default
  layouts.push(defaultLayout("Living Room", layouts.length + 1, null, floor));
  // Kitchen default
  layouts.push(defaultLayout("Kitchen", layouts.length + 1, null, floor));

  return layouts;
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse input.json");
    process.exit(1);
  }
  const pin =
    data.pin || (data.propertyCard && data.propertyCard.folio) || "unknown";
  const outObj = {};
  outObj[`property_${pin}`] = { layouts: mapLayouts(data) };
  ensureDir("owners");
  ensureDir("data");
  fs.writeFileSync("owners/layout_data.json", JSON.stringify(outObj, null, 2));
  fs.writeFileSync("data/layout_data.json", JSON.stringify(outObj, null, 2));
  console.log("owners/layout_data.json written");
})();
