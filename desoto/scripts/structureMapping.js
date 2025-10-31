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
  // Updated selector based on the provided HTML
  const rows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr[bgcolor]",
  );
  let mainBaseSF = null;
  let mainActualSF = null;
  let buildingCount = 0;

  rows.each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      buildingCount += 1;
      const desc = $(tds[1]).text().trim();
      const base = parseIntSafe($(tds[3]).text());
      const actual = parseIntSafe($(tds[4]).text());

      // Changed from OFFICE to SINGLE FAM as per the provided HTML
      if (mainBaseSF === null && /SINGLE FAM/i.test(desc)) {
        mainBaseSF = base;
        mainActualSF = actual;
      }
      // Fallback: if no explicit SINGLE FAM match, use the first row as main
      if (mainBaseSF === null && i === 0) {
        mainBaseSF = base;
        mainActualSF = actual;
      }
    }
  });

  return { mainBaseSF, mainActualSF, buildingCount };
}

function buildStructureObject(parsed) {
  const {
    mainBaseSF = null,
    mainActualSF = null,
    buildingCount = null,
  } = parsed || {};

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