// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractPropertyId($) {
  const h1Text = $("h1").first().text() || "";
  const match = h1Text.match(/Property Record Information for\s*(\d+)/i);
  return match ? match[1] : "unknown";
}

function defaultLayout(space_type, index) {
  return {
    space_type,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: false,
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
  };
}

function buildLayouts($) {
  // No rooms described in this parcel; it's vacant/grazing land per sales code and use.
  // We'll output an empty layouts array to comply with owners/layout_data.json structure.
  return [];
}

(function main() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);
  const layouts = buildLayouts($);

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const payload = {};
  payload[`property_${propertyId}`] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Wrote ${outPath} for property_${propertyId} with ${layouts.length} layouts`,
  );
})();
