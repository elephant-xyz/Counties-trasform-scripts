// Layout mapping script
// Reads input.json, parses DCAD HTML with cheerio, and outputs owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, selector) {
  const el = $(selector);
  return el && el.length ? el.first().text().trim() : "";
}

function parseIntSafe(val) {
  if (val == null) return null;
  const num = String(val).replace(/[^0-9.]/g, "");
  if (!num) return null;
  const n = parseFloat(num);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function getPropertyId(input, $) {
  const id1 =
    input?.OwnersAndGeneralInformation?.source_http_request
      ?.multiValueQueryString?.ID?.[0];
  if (id1) return id1;
  const title = $("span#lblPageTitle").text() || $("span.PageTitle").text();
  const m = title.match(/#([0-9]{8,})/);
  if (m) return m[1];
  const hid = $("input#txtAccountNumber").val();
  if (hid) return hid.trim();
  return "unknown";
}

function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error("Failed to read input.json:", e.message);
    raw = "{}";
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in input.json, proceeding with empty object");
    input = {};
  }

  const html = input?.OwnersAndGeneralInformation?.response || "";
  const $ = cheerio.load(html || "<html></html>");
  const propertyId = getPropertyId(input, $);

  const bedsTxt = safeText($, "#MainImpRes1_lblBedRoom");
  const fullTxt = safeText($, "#MainImpRes1_lblFullBath");
  const halfTxt = safeText($, "#MainImpRes1_lblHalfBath");
  const livingAreaTxt = safeText($, "#MainImpRes1_lblLivingArea");
  const livingArea = parseIntSafe(livingAreaTxt);

  const beds = parseIntSafe(bedsTxt) || 0;
  const fullBaths = parseIntSafe(fullTxt) || 0;
  const halfBaths = parseIntSafe(halfTxt) || 0;

  const layouts = [];
  // Add each bedroom
  for (let i = 1; i <= beds; i++) {
    layouts.push({
      space_type: "Bedroom",
      space_type_index: `1.${i}`,
      flooring_material_type: null,
      size_square_feet: null,
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
  // Add full bathrooms
  for (let i = 1; i <= fullBaths; i++) {
    layouts.push({
      space_type: "Full Bathroom",
      space_type_index: `2.${i}`,
      flooring_material_type: null,
      size_square_feet: null,
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
  // Add half bathrooms
  for (let i = 1; i <= halfBaths; i++) {
    layouts.push({
      space_type: "Half Bathroom / Powder Room",
      space_type_index: `3.${i}`,
      flooring_material_type: null,
      size_square_feet: null,
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
  out[`property_${propertyId}`] = { layouts };

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(
    "Layout data written to",
    outPath,
    "with",
    layouts.length,
    "layouts",
  );
}

if (require.main === module) {
  main();
}
