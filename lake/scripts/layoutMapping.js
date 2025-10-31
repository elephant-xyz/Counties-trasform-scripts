// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.join(process.cwd(), "input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function textNormalize(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function toInt(val) {
  if (val == null) return null;
  const n = parseInt(String(val).replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function buildLayout(spaceType, index) {
  return {
    building_number: null,
    total_area_sq_ft: null,
    built_year: null,
    adjustable_area_sq_ft: null,
    livable_area_sq_ft: null,
    heated_area_sq_ft: null,
    area_under_air_sq_ft: null,
    story_type: null,
    //ceiling_height_average: null,
    source_http_request: null,
    request_identifier: null,
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: null,
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
  };
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  const altKeyCell = $('td.property_field:contains("Alternate Key:")').first();
  const altKey =
    textNormalize(altKeyCell.next("td.property_item").text()) || null;
  const propKey = altKey ? `property_${altKey}` : "property_unknown";

  const layouts = [];

  // Extract counts
  const summaryTable = $(".property_building_summary").first();
  let bedrooms = 0,
    fullBaths = 0,
    halfBaths = 0;

  summaryTable.find("td").each((i, el) => {
    const tx = textNormalize($(el).text());
    if (/Bedrooms:/i.test(tx)) bedrooms = toInt(tx) || 0;
    if (/Full Bathrooms:/i.test(tx)) fullBaths = toInt(tx) || 0;
    if (/Half Bathrooms:/i.test(tx)) halfBaths = toInt(tx) || 0;
  });

  // Create bedrooms
  for (let i = 1; i <= bedrooms; i++) {
    layouts.push(buildLayout("Bedroom", i));
  }

  // Create full bathrooms
  for (let i = 1; i <= fullBaths; i++) {
    layouts.push(buildLayout("Full Bathroom", i));
  }

  // Create half bathrooms
  for (let i = 1; i <= halfBaths; i++) {
    layouts.push(buildLayout("Half Bathroom / Powder Room", i));
  }

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const payload = {};
  payload[propKey] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath} for ${propKey} with ${layouts.length} layouts`);
}

try {
  main();
} catch (err) {
  console.error("Error in layoutMapping:", err.message);
  process.exit(1);
}
