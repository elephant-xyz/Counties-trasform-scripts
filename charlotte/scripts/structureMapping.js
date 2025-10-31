// Structure mapping script
// Reads input.html, extracts structural data using cheerio, and writes owners/structure_data.json and data/structure_data.json

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
  // Find the Building Information table's first data row
  const table = $("caption.blockcaption")
    .filter((i, el) => /Building Information/i.test($(el).text()))
    .closest("table");
  const rows = table.find("tbody > tr");
  // Skip header row (first), pick the first data row that has tds
  let dataRow = null;
  rows.each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length > 0 && !dataRow) {
      dataRow = $(el);
    }
  });
  if (!dataRow) return null;
  const tds = dataRow.find("td");
  const mapVal = (idx) => {
    const v = getText($(tds[idx]));
    return v === "" || v === "\u00a0" ? null : v;
  };
  return {
    buildingNumber: mapVal(0),
    description: mapVal(1),
    quality: mapVal(2),
    buildingUse: mapVal(3),
    yearBuilt: mapVal(4),
    yearCond: mapVal(5),
    floors: mapVal(6),
    rooms: mapVal(7),
    bedrooms: mapVal(8),
    plumbingFixtures: mapVal(9),
    area: mapVal(10),
    acArea: mapVal(11),
    totalArea: mapVal(12),
  };
}

function numOrNull(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function intOrNull(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function buildStructure($) {
  const pid = parsePropertyId($);
  const b = findBuildingInfoRow($) || {};

  // Heuristic: Condominium implies attached; else null
  const desc = (b.description || "").toLowerCase();
  const attachment_type = /condominium/.test(desc) ? "Attached" : null;

  // Optional values we can infer safely
  const number_of_stories = numOrNull(b.floors);

  const structure = {
    architectural_style_type: null,
    attachment_type,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: null,
    number_of_stories,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  return { pid, structure };
}

function main() {
  const inputPath = path.join("input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const { pid, structure } = buildStructure($);
  const payload = {};
  payload[`property_${pid}`] = structure;

  // Write outputs to both owners/ and data/ to satisfy varied path requirements
  ensureDir(path.join("owners"));
  ensureDir(path.join("data"));
  fs.writeFileSync(
    path.join("owners", "structure_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join("data", "structure_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

if (require.main === module) {
  try {
    main();
    console.log("Structure mapping completed.");
  } catch (e) {
    console.error("Structure mapping failed:", e.message);
    process.exit(1);
  }
}
