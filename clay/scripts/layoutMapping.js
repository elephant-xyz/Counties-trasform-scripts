// Layout data extractor using cheerio
// Reads input.html and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadInput() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getValueFromSection($, sectionSelector, label) {
  let val = null;
  const $section =
    typeof sectionSelector === "string" ? $(sectionSelector) : sectionSelector;
  $section.find("tr").each((_, tr) => {
    const th = $(tr).find("th strong").first().text().trim();
    if (th === label) {
      const tdText = $(tr)
        .find("td")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (tdText) val = tdText;
    }
  });
  return val;
}

function extractParcelId($) {
  let pid = getValueFromSection($, "#ctlBodyPane_ctl00_mSection", "Parcel ID");
  if (pid) pid = pid.replace(/\s+/g, "").trim();
  return pid || "unknown_id";
}

function parseIntSafe(val) {
  if (val == null) return 0;
  const m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function createBaseLayout(space_type, space_index, flooring) {
  return {
    space_type,
    space_index,
    flooring_material_type: flooring,
    size_square_feet: null,
    floor_level: null,
    has_windows: space_type === "Bedroom" ? true : null,
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

function extractLayouts($) {
  const sectionSel = "#ctlBodyPane_ctl05_mSection";
  const beds = parseIntSafe(getValueFromSection($, sectionSel, "Bedrooms"));
  const fullBaths = parseIntSafe(
    getValueFromSection($, sectionSel, "Full Bathrooms"),
  );
  const halfBaths = parseIntSafe(
    getValueFromSection($, sectionSel, "Half Bathrooms"),
  );

  const layouts = [];
  let idx = 1;

  for (let i = 0; i < beds; i++) {
    layouts.push(createBaseLayout("Bedroom", idx++, "Carpet"));
  }
  for (let i = 0; i < fullBaths; i++) {
    layouts.push(createBaseLayout("Full Bathroom", idx++, "Tile"));
  }
  for (let i = 0; i < halfBaths; i++) {
    layouts.push(
      createBaseLayout("Half Bathroom / Powder Room", idx++, "Tile"),
    );
  }

  return layouts;
}

(function main() {
  const $ = loadInput();
  const parcelId = extractParcelId($);
  const layouts = extractLayouts($);

  const data = {};
  data[`property_${parcelId}`] = { layouts };

  fs.mkdirSync(path.dirname("owners/layout_data.json"), { recursive: true });
  fs.writeFileSync("owners/layout_data.json", JSON.stringify(data, null, 2));
  console.log("Wrote owners/layout_data.json for", `property_${parcelId}`);
})();
