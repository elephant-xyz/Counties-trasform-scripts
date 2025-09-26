// Layout mapping script
// Reads input.html, extracts layout entries (rooms) using cheerio, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getTextAfterStrong($, label) {
  const el = $("strong").filter((i, e) => $(e).text().trim() === label);
  if (el.length) {
    const val = el.first().parent().next().text().trim();
    return val.replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

function parseIntSafe(val) {
  const m = String(val || "").match(/[-+]?[0-9]+/);
  return m ? parseInt(m[0], 10) : 0;
}

function buildDefaultLayout(space_type, space_index, floor_level) {
  return {
    space_type,
    space_index,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: floor_level || null,
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
  const inputPath = "input.html";
  const html = readHtml(inputPath);
  const $ = cheerio.load(html);

  const altkey = ($("#altkey").attr("value") || "").trim();
  const propertyId = `property_${altkey || "unknown"}`;

  // Extract counts
  const bedrooms = parseIntSafe(getTextAfterStrong($, "# Bedrooms:"));
  const baths3 = parseIntSafe(getTextAfterStrong($, "3 Fixture Baths:"));
  const baths2 = parseIntSafe(getTextAfterStrong($, "2 Fixture Baths:"));
  const baths4 = parseIntSafe(getTextAfterStrong($, "4 Fixture Baths:"));
  // Approximate: treat 3-fixture as Full Bathroom; others as additional not represented due to schema options
  const fullBaths = baths3 + baths4 + baths2; // fallback include all fixtures categories as bathrooms

  const layouts = [];
  let idx = 1;
  const floor = "1st Floor";

  // Bedrooms
  for (let i = 0; i < bedrooms; i++) {
    const l = buildDefaultLayout("Bedroom", idx++, floor);
    layouts.push(l);
  }

  // Bathrooms
  for (let i = 0; i < fullBaths; i++) {
    const l = buildDefaultLayout("Full Bathroom", idx++, floor);
    layouts.push(l);
  }

  // Kitchen and Living Room (assumed in single-family home)
  layouts.push(buildDefaultLayout("Kitchen", idx++, floor));
  layouts.push(buildDefaultLayout("Living Room", idx++, floor));

  // Pool area if pool present in improvements
  const hasPool =
    $('div:contains("RSP-POOL, RESIDENTIAL SWIMMING")').length > 0;
  if (hasPool) {
    const poolLayout = buildDefaultLayout("Outdoor Pool", idx++, null);
    poolLayout.is_exterior = true;
    layouts.push(poolLayout);
  }

  const output = {};
  output[propertyId] = { layouts };

  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `Layout data written to ${outPath} for ${propertyId}. Count: ${layouts.length}`,
  );
}

main();
