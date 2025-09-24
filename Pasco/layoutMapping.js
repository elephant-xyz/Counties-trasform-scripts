// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function parseIntSafe(str) {
  if (!str) return null;
  const s = String(str).replace(/[^0-9]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";

  const layouts = [];

  // Create at least a generic Living Room and Kitchen if living area exists
  let livingArea = null;
  $("#tblSubLines tr").each((i, el) => {
    if (i === 0) return; // header
    const tds = $(el).find("td");
    const desc = $(tds[2]).text().trim().toUpperCase();
    if (desc === "LIVING AREA") {
      livingArea = parseIntSafe($(tds[3]).text());
    }
  });

  // Baths extraction: e.g., 1.5 means 1 Full Bathroom and 1 Half Bathroom
  const bathsText = safeText($, "#lblBuildingBaths");
  let fullBaths = 0;
  let halfBaths = 0;
  if (bathsText) {
    const num = parseFloat(bathsText);
    if (!Number.isNaN(num)) {
      fullBaths = Math.floor(num);
      halfBaths = Math.round((num - fullBaths) * 2); // 0.5 -> 1 half
    }
  }

  let spaceIndex = 1;
  if (livingArea) {
    layouts.push({
      space_type: "Living Room",
      space_index: spaceIndex++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: "1st Floor",
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

    layouts.push({
      space_type: "Kitchen",
      space_index: spaceIndex++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: "1st Floor",
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
      floor_level: "1st Floor",
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
      floor_level: "1st Floor",
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
  out[`property_${parcelId}`] = { layouts };

  const ownersDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const outPath = path.join(ownersDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
