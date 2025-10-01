// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getAltKey($) {
  let altkey = $("input#altkey").val();
  if (!altkey) {
    $("div.col-sm-5").each((i, el) => {
      const t = $(el).text().trim();
      if (/Alternate Key/i.test(t)) {
        const v = $(el).next().text().trim();
        if (v) altkey = v.replace(/[^0-9]/g, "");
      }
    });
  }
  return altkey;
}

function findValueByLabel($, label) {
  let val = null;
  $("div.row.parcel-content").each((i, row) => {
    const strongs = $(row).find("strong");
    strongs.each((j, s) => {
      const t = $(s).text().trim().replace(/:$/, "");
      if (t.toLowerCase() === label.toLowerCase()) {
        const v = $(s).parent().next().text().trim();
        if (v && !val) val = v;
      }
    });
  });
  return val;
}

function parseIntSafe(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function buildRoomLayouts($) {
  const layouts = [];
  const sflaText = findValueByLabel($, "Total SFLA") || "";
  const sfla = parseIntSafe(sflaText);
  const bedrooms = parseIntSafe(findValueByLabel($, "# Bedrooms")) || 0;

  // Bathrooms: parse 3-fixture and 4-fixture counts
  const threeFix = parseIntSafe(findValueByLabel($, "3 Fixture Baths")) || 0;
  const fourFix = parseIntSafe(findValueByLabel($, "4 Fixture Baths")) || 0;
  const totalBaths = threeFix + fourFix; // treat each as a separate bathroom layout

  let index = 1;

  // Living room (basic)
  layouts.push({
    space_type: "Living Room",
    space_index: index++,
    flooring_material_type: null,
    size_square_feet: sfla ? Math.round(sfla * 0.25) : null,
    floor_level: "1st Floor",
    has_windows: true,
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
  });

  // Bedrooms
  for (let i = 0; i < bedrooms; i++) {
    layouts.push({
      space_type: "Bedroom",
      space_index: index++,
      flooring_material_type: null,
      size_square_feet: sfla ? Math.round(sfla * 0.12) : null,
      floor_level: "1st Floor",
      has_windows: true,
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
    });
  }

  // Bathrooms: assume full bathrooms for 4-fixture and three-quarter for 3-fixture
  for (let i = 0; i < fourFix; i++) {
    layouts.push({
      space_type: "Full Bathroom",
      space_index: index++,
      flooring_material_type: null,
      size_square_feet: 50,
      floor_level: "1st Floor",
      has_windows: false,
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
    });
  }
  for (let i = 0; i < threeFix; i++) {
    layouts.push({
      space_type: "Three-Quarter Bathroom",
      space_index: index++,
      flooring_material_type: null,
      size_square_feet: 45,
      floor_level: "1st Floor",
      has_windows: false,
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
    });
  }

  // Kitchen
  layouts.push({
    space_type: "Kitchen",
    space_index: index++,
    flooring_material_type: null,
    size_square_feet: sfla ? Math.round(sfla * 0.1) : null,
    floor_level: "1st Floor",
    has_windows: true,
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
  });

  return layouts;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const altkey = getAltKey($);
  if (!altkey) throw new Error("Alternate Key not found");

  const layouts = buildRoomLayouts($);

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const payload = {};
  payload[`property_${altkey}`] = { layouts };
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
