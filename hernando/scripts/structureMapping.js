// Structure mapping script
// Reads input.html, extracts property details, and writes owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseIntSafe(val) {
  try {
    if (val == null) return null;
    const n = parseInt(String(val).replace(/[^0-9.-]/g, ""), 10);
    return isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
}

function parseFloatSafe(val) {
  try {
    if (val == null) return null;
    const n = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
}

function extractPropertyId($) {
  const id = $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text().trim();
  if (id) return id;
  const resultsId = $(
    "#MainContent_gvParcelResults tr:nth-child(2) td:first-child",
  )
    .text()
    .trim();
  return resultsId || "unknown";
}

function extractBaseAux($) {
  // Look in Building Characteristics table for Area (Base/Aux) and Bed/Bath
  let base = null;
  let aux = null;
  let beds = null;
  let baths = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const areaText = $(tds[3]).text().trim();
      const bedbath = $(tds[4]).text().trim();
      if (areaText && /\d+\s*\/\s*\d+/.test(areaText)) {
        const parts = areaText.split("/");
        base = parseIntSafe(parts[0]);
        aux = parseIntSafe(parts[1]);
      }
      if (bedbath && /\d+\s*\/\s*\d+/.test(bedbath)) {
        const parts = bedbath.split("/");
        beds = parseIntSafe(parts[0]);
        baths = parseIntSafe(parts[1]);
      }
    }
  });
  return { base, aux, beds, baths };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const propertyId = extractPropertyId($);
  const { base } = extractBaseAux($);

  // Build structure object complying with schema; unknowns as null
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
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
    finished_base_area: base === null ? null : base,
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
    number_of_stories: null,
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

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = structure;
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

if (require.main === module) {
  main();
}
