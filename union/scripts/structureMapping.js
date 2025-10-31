// Structure mapping script
// Reads input.html, parses with cheerio, outputs owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function parseIntSafe(txt) {
  const num = parseInt(String(txt || "").replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

function extractBuildingMetrics($) {
  // Locate the Building Characteristics table and extract Year Blt, Htd Base SF, Actual SF
  let heatedBaseSum = 0;
  const years = new Set();

  const tableDiv = $("#parcelDetails_BldgTable");
  const tables = tableDiv.find("table.parcelDetails_insideTable");
  if (tables.length === 0)
    return null;

  // Use the first inside table that contains the headers
  const table = tables.first();
  const rows = table.find("tr");
  let headerIdx = -1;
  let idxYear = -1,
    idxHtd = -1,
    idxActual = -1;

  rows.each((rIdx, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return; // skip non-data rows

    const headerTexts = tds.map((i, td) => $(td).text().trim()).get();

    if (idxYear === -1 && headerTexts.some((t) => /Year Blt/i.test(t))) {
      idxYear = headerTexts.findIndex((t) => /Year Blt/i.test(t));
      idxHtd = headerTexts.findIndex((t) => /Htd Base SF/i.test(t));
      idxActual = headerTexts.findIndex((t) => /Actual SF/i.test(t));
      headerIdx = rIdx;
      return; // continue to next row for data
    }

    // After header row parsed, treat following rows as data until footer/notice row
    if (idxYear !== -1 && rIdx > headerIdx) {
      const yearTxt = headerTexts[idxYear] || "";
      const htdTxt = headerTexts[idxHtd] || "";
      const actTxt = headerTexts[idxActual] || "";

      // Skip footers or non-numeric rows
      if (
        !/(\d{4})/.test(yearTxt) &&
        parseIntSafe(htdTxt) === 0 &&
        parseIntSafe(actTxt) === 0
      ) {
        return;
      }

      const htd = parseIntSafe(htdTxt);

      if (htd > 0) heatedBaseSum += htd;
    }
  });

  return heatedBaseSum === 0 ? null : heatedBaseSum;
}

function buildStructure($) {
  // Extract aggregated metrics from Building Characteristics
  const heatedBaseSum = extractBuildingMetrics($);

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
    finished_base_area: heatedBaseSum,
    finished_upper_story_area: null,
    roof_date: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    finished_basement_area: null,
    foundation_repair_date: null,
    siding_installation_date: null,
    exterior_door_installation_date: null,
    window_installation_date: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: null,
  };

  return structure;
}

function main() {
  const $ = loadHtml();
  const parcelId = extractParcelId($);

  const structure = buildStructure($);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = structure;

  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating structure data:", e.message);
    process.exit(1);
  }
}
