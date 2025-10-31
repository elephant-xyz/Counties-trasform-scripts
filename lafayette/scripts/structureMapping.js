// structureMapping.js
// Reads input.html, parses with cheerio, extracts structure data, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function parseIntSafe(str) {
  if (!str) return null;
  const m = String(str).replace(/[,\s]/g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function extractParcelId($) {
  // Updated selector based on the provided HTML
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function extractBuildingData($) {
  // Select the main building characteristics table
  const bldgTable = $("#parcelDetails_BldgTable table.parcelDetails_insideTable").first();

  let mainBaseSF = null;
  let mainActualSF = null; // Will be set to mainBaseSF if no actual SF is found
  let buildingCount = 0;

  if (bldgTable.length) {
    // Select all data rows (excluding the header row)
    // The header row contains <th> or <td> with specific text like "Bldg Sketch"
    // Data rows have bgcolor="#FFFFFF" or are simply the subsequent <tr> elements.
    // We'll iterate through all rows and skip the header.
    bldgTable.find("tr").each((i, el) => {
      // Skip the first row which is the header
      if (i === 0) return;

      const tds = $(el).find("td");
      // Check if this is a data row (e.g., not the explanatory text row at the bottom)
      // A data row should have at least 5 <td> elements for our target data.
      if (tds.length >= 5) {
        const bldgSketchLink = $(tds[0]).find('a').text().trim();
        // If the first td contains "Sketch", it's a building entry
        if (bldgSketchLink === "Sketch") {
          buildingCount += 1;
          const desc = $(tds[2]).text().trim(); // Bldg Desc is at index 2
          const base = parseIntSafe($(tds[4]).text()); // Base SF is at index 4

          // For the sample HTML, there's no explicit "Actual SF" column.
          // We'll assume Base SF is the primary livable area.
          const actual = base; // Use base as actual

          // Identify the main building. In this case, "SINGLE FAMILY" is the main one.
          if (mainBaseSF === null && /SINGLE FAMILY/i.test(desc)) {
            mainBaseSF = base;
            mainActualSF = actual;
          }
          // Fallback: if no explicit "SINGLE FAMILY" match, use the first encountered building as main
          if (mainBaseSF === null && buildingCount === 1) {
            mainBaseSF = base;
            mainActualSF = actual;
          }
        }
      }
    });
  }

  return { mainBaseSF, mainActualSF, buildingCount };
}

function buildStructureObject(parsed) {
  const {
    mainBaseSF = null,
    mainActualSF = null,
    buildingCount = null,
  } = parsed || {};

  // In the absence of explicit finished_upper_story_area, and if mainActualSF is derived from mainBaseSF,
  // this will likely be null. This is correct given the input HTML.
  const finished_upper_story_area =
    mainBaseSF != null && mainActualSF != null && mainActualSF > mainBaseSF
      ? mainActualSF - mainBaseSF
      : null;

  const structure = {
    // Optional/top-level helpful fields
    number_of_buildings: buildingCount || null,
    finished_base_area: mainBaseSF || null,
    finished_upper_story_area: finished_upper_story_area,

    // Required by schema (allow nulls per schema definitions)
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
  };

  return structure;
}

function main() {
  const html = readInputHtml();
  if (!html) {
    process.exit(0);
  }
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const bldg = extractBuildingData($);
  const structure = buildStructureObject(bldg);

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "structure_data.json");

  const out = {};
  out[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}