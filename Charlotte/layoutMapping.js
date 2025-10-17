// Layout data extractor using Cheerio
// Reads: input.html
// Writes: owners/layout_data.json and data/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textClean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function safeInt(val) {
  const n = parseInt(String(val || "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function extractPropertyId($) {
  const h1 = $("h1").first().text();
  const m = h1.match(/Property Record Information for\s+(\d+)/i);
  return m ? m[1] : "unknown";
}

function findTableByCaption($, captionText) {
  let target = null;
  $("table").each((_, t) => {
    const cap = $(t).find("caption").first().text();
    if (cap && cap.toLowerCase().includes(captionText.toLowerCase())) {
      target = t;
      return false;
    }
  });
  return target;
}

function parseBuildingInfo($) {
  const tbl = findTableByCaption($, "Building Information");
  if (!tbl) return null;
  const rows = $(tbl).find("tbody tr");
  const row = rows.eq(1).length ? rows.eq(1) : $(tbl).find("tr").eq(1);
  if (!row || row.length === 0) return null;
  const cells = row.find("td");
  return {
    floors: safeInt($(cells).eq(6).text()),
    rooms: safeInt($(cells).eq(7).text()),
    bedrooms: safeInt($(cells).eq(8).text()),
    plumbingFixtures: safeInt($(cells).eq(9).text()),
    acArea: safeInt($(cells).eq(11).text()),
    totalArea: safeInt($(cells).eq(12).text()),
    yearBuilt: safeInt($(cells).eq(4).text()),
  };
}

function buildLayoutsFromInfo(info) {
  const layouts = [];
  let idx = 1;
  // Represent each bedroom as a distinct layout object
  const bedCount = info.bedrooms || 0;
  for (let i = 0; i < bedCount; i++) {
    layouts.push(baseLayout("Bedroom", idx++));
  }
  // Bathrooms estimation: using plumbing fixtures approx (not exact)
  const fixtures = info.plumbingFixtures || 0;
  let bathCount = 0;
  if (fixtures >= 7) bathCount = 2;
  else if (fixtures >= 4) bathCount = 1;
  else if (fixtures > 0) bathCount = 1;
  for (let i = 0; i < bathCount; i++) {
    layouts.push(baseLayout("Full Bathroom", idx++));
  }
  // Add Living Area
  layouts.push(baseLayout("Living Area", idx++));
  // Add Kitchen
  layouts.push(baseLayout("Kitchen", idx++));
  return layouts;
}

function baseLayout(spaceType, index) {
  return {
    space_type: mapSpaceType(spaceType),
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

    // Optional additional fields
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
    heated_area_sq_ft: null,
    kitchen_renovation_date: null,
    livable_area_sq_ft: null,
    story_type: null,
    total_area_sq_ft: null,
  };
}

function mapSpaceType(label) {
  const norm = (label || "").toLowerCase();
  if (norm.includes("bedroom")) return "Bedroom";
  if (norm.includes("bath")) return "Full Bathroom";
  if (norm.includes("kitchen")) return "Kitchen";
  if (norm.includes("living")) return "Living Room";
  return "Living Area";
}

function mapToLayouts($) {
  const pid = extractPropertyId($);
  const info = parseBuildingInfo($) || {};
  const layouts = buildLayoutsFromInfo(info);

  const data = {};
  data[`property_${pid}`] = { layouts };
  return data;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const result = mapToLayouts($);

  ensureDir(path.join(process.cwd(), "owners"));
  ensureDir(path.join(process.cwd(), "data"));
  fs.writeFileSync(
    path.join("owners", "layout_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join("data", "layout_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  console.log(
    "Layout mapping complete for keys:",
    Object.keys(result).join(","),
  );
}

if (require.main === module) {
  main();
}
