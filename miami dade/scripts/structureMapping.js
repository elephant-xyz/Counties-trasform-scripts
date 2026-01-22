// Structure mapping script
// Reads input.json, extracts structure-related fields, and writes owners/structure_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadInput() {
  const jsonFilePath = path.join(process.cwd(), 'input.json');
  const htmlFilePath = path.join(process.cwd(), 'input.html');

  try {
    // 1. Try to read input.json synchronously
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    return JSON.parse(jsonData);
  } catch (jsonError) {
    // If input.json doesn't exist or is unreadable, try input.html
    if (jsonError.code === 'ENOENT' || jsonError instanceof SyntaxError) {
      console.warn(`Could not read or parse input.json: ${jsonError.message}. Attempting to read from input.html.`);
      try {
        // 2. Read input.html synchronously
        const htmlData = fs.readFileSync(htmlFilePath, 'utf8');

        // Parse the HTML using Cheerio
        const $ = cheerio.load(htmlData);
        const preTagContent = $('pre').text(); // Get the text content of the <pre> tag

        if (preTagContent) {
          return JSON.parse(preTagContent);
        } else {
          throw new Error('No <pre> tag found or <pre> tag is empty in input.html');
        }
      } catch (htmlError) {
        throw new Error(`Failed to read or parse JSON from input.html: ${htmlError.message}`);
      }
    } else {
      // Re-throw other errors from input.json
      throw new Error(`An unexpected error occurred while processing input.json: ${jsonError.message}`);
    }
  }
}

function mapStructure(data) {
  const pi = (data && data.PropertyInfo) || {};
  const stories = typeof pi.FloorCount === "number" ? pi.FloorCount : null;
  // Infer attachment_type conservatively as null; single-family often Detached but we avoid assumption
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    // Optional numeric areas
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: stories,
  };

  // If it's explicitly single family, we may infer Detached cautiously
  const dor = (pi.DORDescription || "").toLowerCase();
  if (dor.includes("single family")) {
    structure.attachment_type = "Detached";
  }

  return structure;
}

function run() {
  const data = loadInput();
  const structure = mapStructure(data);
  const id =
    (data && data.PropertyInfo && data.PropertyInfo.FolioNumber) || "unknown";
  const output = {};
  output[`property_${id}`] = structure;

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

run();
