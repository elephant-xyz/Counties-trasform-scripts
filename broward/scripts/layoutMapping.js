// Layout mapping script
// Reads input.json and writes owners/layout_data.json keyed by property_[folio] with layouts array

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function coerceNumber(val) {
  if (val == null) return null;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function extractFromInput(inputObj) {
  const root = inputObj.d || inputObj;
  const parcelArr = root.parcelInfok__BackingField || [];
  const parcel = parcelArr[0] || {};
  const folio = parcel.folioNumber || parcel.folio || "unknown";

  const beds = parseInt(parcel.beds || "0", 10) || 0;
  const bathsStr = parcel.baths || "0";
  const baths = parseFloat(bathsStr);

  // Extract square footage data
  const bldgSqFT = coerceNumber(parcel.bldgSqFT);
  const bldgUnderAirFootage = coerceNumber(parcel.bldgUnderAirFootage);

  // Build layouts for bedrooms and bathrooms as required
  const layouts = [];
  let spaceIndex = 1;

  // ALWAYS add Living Area layout first with square footage data
  layouts.push({
    space_type: "Living Area",
    space_index: spaceIndex++,
    livable_area_sq_ft: bldgSqFT,
    area_under_air_sq_ft: bldgUnderAirFootage,
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
  });

  for (let i = 0; i < beds; i++) {
    layouts.push({
      space_type: i === 0 ? "Primary Bedroom" : "Secondary Bedroom",
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

  // Bathrooms: split baths into full + half based on decimal .5 logic
  let remainingBaths = isNaN(baths) ? 0 : baths;
  const fullBaths = Math.floor(remainingBaths);
  const hasHalf = Math.abs(remainingBaths - fullBaths - 0.5) < 0.01;

  for (let i = 0; i < fullBaths; i++) {
    layouts.push({
      space_type: i === 0 ? "Primary Bathroom" : "Full Bathroom",
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

  if (hasHalf) {
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

  // Add a generic Living Room and Kitchen if bedrooms exist
  if (beds > 0) {
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

  return { folio, layouts };
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  let parsed = safeParseJSON(raw);
  if (!parsed) {
    const $ = cheerio.load(raw || "");
    const text = $("body").text().trim();
    parsed = safeParseJSON(text);
  }
  if (!parsed) throw new Error("Unable to parse input.json");

  const { folio, layouts } = extractFromInput(parsed);

  const outObj = {};
  outObj[`property_${folio}`] = { layouts };

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
})();
