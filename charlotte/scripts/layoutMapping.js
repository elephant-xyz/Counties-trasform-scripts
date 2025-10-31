// Layout mapping script
// Reads input.html, extracts layout/space data using cheerio, and writes owners/layout_data.json and data/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getText($el) {
  if (!$el || $el.length === 0) return "";
  return $el.text().replace(/\s+/g, " ").trim();
}

function parsePropertyId($) {
  const h1 = $("h1")
    .filter((i, el) => /Property Record Information for/i.test($(el).text()))
    .first();
  const m = getText(h1).match(/for\s+(\d{6,})/i);
  return m ? m[1] : "unknown";
}

function findBuildingInfoRow($) {
  const table = $("caption.blockcaption")
    .filter((i, el) => /Building Information/i.test($(el).text()))
    .closest("table");
  const rows = table.find("tbody > tr");
  let dataRow = null;
  rows.each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length > 0 && !dataRow) dataRow = $(el);
  });
  if (!dataRow) return null;
  const tds = dataRow.find("td");
  const txt = (idx) => getText($(tds[idx]));
  return {
    floors: txt(6),
    bedrooms: txt(8),
    acArea: txt(11),
    totalArea: txt(12),
  };
}

function intOrNull(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function buildLayouts($) {
  const b = findBuildingInfoRow($) || {};
  const floors = intOrNull(b.floors) || 1;
  const bedrooms = intOrNull(b.bedrooms) || 0;

  const layouts = [];
  let index = 1;

  // Create bedroom entries per instruction
  for (let i = 0; i < bedrooms; i++) {
    layouts.push(makeDefaultLayout("Bedroom", index++, floors));
  }

  // Create a generic Living Area layout if any area exists
  const area = intOrNull(b.acArea) || intOrNull(b.totalArea) || null;
  if (area) {
    const base = makeDefaultLayout("Living Area", index++, floors);
    base.size_square_feet = area;
    layouts.push(base);
  }

  return layouts;
}

function makeDefaultLayout(space_type, space_index, floors) {
  // Fill all required fields with nulls or safe defaults per schema types
  return {
    space_type: space_type,
    space_index: space_index,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: floors > 1 ? "1st Floor" : "1st Floor",
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
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    heated_area_sq_ft: null,
    installation_date: null,
    livable_area_sq_ft: null,
    natural_light_quality: null,
    paint_condition: null,
    pool_installation_date: null,
    pool_type: null,
    view_type: null,
    window_design_type: null,
    story_type: null,
    total_area_sq_ft: null,
    window_treatment_type: null,
    window_material_type: null,
    window_design_type: null,
  };
}

function main() {
  const inputPath = path.join("input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const pid = parsePropertyId($);
  const layouts = buildLayouts($);
  const payload = {};
  payload[`property_${pid}`] = { layouts };

  ensureDir(path.join("owners"));
  ensureDir(path.join("data"));
  fs.writeFileSync(
    path.join("owners", "layout_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join("data", "layout_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

if (require.main === module) {
  try {
    main();
    console.log("Layout mapping completed.");
  } catch (e) {
    console.error("Layout mapping failed:", e.message);
    process.exit(1);
  }
}
