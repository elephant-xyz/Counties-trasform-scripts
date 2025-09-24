// Layout Mapping Script
// Reads input.html and writes owners/layout_data.json

const fs = require("fs");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  console.error(
    "Cheerio module not found. Please ensure cheerio is available.",
  );
  process.exit(1);
}

function readInputHTML() {
  try {
    return fs.readFileSync("input.html", "utf8");
  } catch (_) {
    return "";
  }
}

function text($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function parseCount(valStr) {
  if (!valStr) return 0;
  const s = String(valStr).trim();
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  // Values are like 3.000, 2.000; use Math.round for safety
  return Math.round(num);
}

(function main() {
  const html = readInputHTML();
  const $ = cheerio.load(html);
  const re = text($, "#ctl00_cphBody_lblRealEstateNumber") || "UNKNOWN";
  const propKey = `property_${re}`;

  // Sum bedrooms and baths across all buildings
  let totalBedrooms = 0;
  let totalBaths = 0;
  let anyStoriesOver1 = false;
  let anyHeatedArea = false;

  $('table[id$="_gridBuildingAttributes"]').each((i, tbl) => {
    const $tbl = $(tbl);
    const stories =
      parseFloat($tbl.find('tr:contains("Stories") td.col_code').text()) || 0;
    if (stories > 1) anyStoriesOver1 = true;
    const bedsStr = $tbl.find('tr:contains("Bedrooms") td.col_code').text();
    const bathsStr = $tbl.find('tr:contains("Baths") td.col_code').text();
    totalBedrooms += parseCount(bedsStr);
    totalBaths += parseCount(bathsStr);
  });

  // Detect heated area from any building area table
  $('table[id$="_gridBuildingArea"]').each((i, tbl) => {
    $(tbl)
      .find("tr")
      .each((ri, tr) => {
        const tds = $(tr).find("td");
        if (
          tds.length >= 4 &&
          $(tds[0]).text().trim().toLowerCase() === "total"
        ) {
          const heatedStr = $(tds[2]).text().trim();
          const heated = parseFloat(heatedStr.replace(/[^0-9.]/g, ""));
          if (!isNaN(heated) && heated > 0) anyHeatedArea = true;
        }
      });
  });

  const floor_level = anyStoriesOver1 ? "1st Floor" : "1st Floor";

  const layouts = [];

  // Bedrooms
  if (totalBedrooms > 0) {
    for (let i = 1; i <= totalBedrooms; i++) {
      layouts.push({
        space_type: "Bedroom",
        space_index: i,
        flooring_material_type: null,
        size_square_feet: null,
        floor_level,
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
  }

  // Full Bathrooms
  if (totalBaths > 0) {
    for (let i = 1; i <= totalBaths; i++) {
      layouts.push({
        space_type: "Full Bathroom",
        space_index: (totalBedrooms || 0) + i,
        flooring_material_type: null,
        size_square_feet: null,
        floor_level,
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
  }

  // Add a generic Living Room and Kitchen if any heated area exists
  if (anyHeatedArea) {
    layouts.push({
      space_type: "Living Room",
      space_index: layouts.length + 1,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level,
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
      space_index: layouts.length + 1,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level,
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

  if (!fs.existsSync("owners")) fs.mkdirSync("owners", { recursive: true });
  const out = {};
  out[propKey] = { layouts };
  fs.writeFileSync("owners/layout_data.json", JSON.stringify(out, null, 2));
  console.log(
    "Wrote owners/layout_data.json for",
    propKey,
    "with",
    layouts.length,
    "layouts",
  );
})();
