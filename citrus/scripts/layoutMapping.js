// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textNorm(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

function parseIntSafe(s) {
  const n = parseInt((s || "").toString().replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function extractPropertyId($) {
  const hdPin = $("input#hdPin").attr("value") || $("input#hdPin").val();
  if (hdPin) return textNorm(hdPin);
  let id = null;
  $("#datalet_header_row")
    .find("td")
    .each((i, td) => {
      const t = $(td).text();
      const m = t.match(/Altkey:\s*(\d+)/i);
      if (m) id = m[1];
    });
  return id || "unknown";
}

function getKV($, tableSelector, headingText) {
  let val = null;
  $(tableSelector)
    .find("tr")
    .each((i, tr) => {
      const th = textNorm($(tr).find("td.DataletSideHeading").first().text());
      if (th === headingText) {
        val = textNorm($(tr).find("td.DataletData").first().text());
      }
    });
  return val;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const propId = extractPropertyId($);

  const residentialTable = "table#Residential";
  const bfhRaw =
    getKV($, residentialTable, "Bedrooms/Full Baths/Half Baths") || "";
  // Format appears like "2/2/" meaning 2 beds, 2 full baths, 0 half baths
  const parts = bfhRaw.split("/");
  const beds = parseIntSafe(parts[0]) || 0;
  const fullBaths = parseIntSafe(parts[1]) || 0;
  const halfBaths = parseIntSafe(parts[2]) || 0;

  const storiesRaw = getKV($, residentialTable, "Stories");
  const story = textNorm(storiesRaw || "1");
  const floorLevelLabel = story === "1" ? "1st Floor" : "2nd Floor";

  const layouts = [];
  let spaceIndex = 1;

  for (let i = 0; i < beds; i++) {
    layouts.push({
      space_type: "Bedroom",
      space_index: spaceIndex++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: floorLevelLabel,
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
    });
  }

  for (let i = 0; i < fullBaths; i++) {
    layouts.push({
      space_type: "Full Bathroom",
      space_index: spaceIndex++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: floorLevelLabel,
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
    });
  }

  for (let i = 0; i < halfBaths; i++) {
    layouts.push({
      space_type: "Half Bathroom / Powder Room",
      space_index: spaceIndex++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: floorLevelLabel,
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
    });
  }

  const out = {};
  out[`property_${propId}`] = { layouts };

  ensureDirSync(path.join(process.cwd(), "owners"));
  fs.writeFileSync(
    path.join("owners", "layout_data.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("Wrote owners/layout_data.json for property_" + propId);
}

try {
  main();
} catch (err) {
  console.error("Error generating layout data:", err.message);
  process.exit(1);
}
