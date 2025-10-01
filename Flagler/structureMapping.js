// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCellValueByHeader($, table, headerText) {
  let val = null;
  $(table)
    .find("tr")
    .each((i, tr) => {
      const th = $(tr).find("td strong").first();
      const label = (th.text() || "").trim();
      if (label.toLowerCase() === (headerText || "").toLowerCase()) {
        const td = $(tr).find("td").eq(1);
        val = td.text().replace(/\s+/g, " ").trim();
      }
    });
  return val;
}

function parseIntSafe(s) {
  if (!s) return null;
  const num = parseInt(String(s).replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(num) ? num : null;
}

function extractPropertyId($) {
  // Prefer Prop ID from Parcel Summary table
  const summaryTable = $(
    "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table.tabular-data-two-column",
  );
  let propId = getCellValueByHeader($, summaryTable, "Prop ID");
  if (propId) return propId.trim();
  // Fallback: Parcel ID
  let parcelId = getCellValueByHeader($, summaryTable, "Parcel ID");
  if (parcelId) return parcelId.trim();
  // Last resort: from title
  const title = $("title").text();
  const m = title.match(/Card:\s*([\d\-]+)/);
  if (m) return m[1];
  return "unknown";
}

function extractResidentialLeftRightTables($) {
  const section = $("#ctlBodyPane_ctl10_mSection");
  const leftTable = section.find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary table",
  );
  const rightTable = section.find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary table",
  );
  return { leftTable, rightTable };
}

function getValueFromTwoColTable($, table, labelText) {
  let result = null;
  $(table)
    .find("tr")
    .each((_, tr) => {
      const label = $(tr).find("td strong").first().text().trim();
      if (label.toLowerCase() === labelText.toLowerCase()) {
        result = $(tr).find("td").eq(1).text().replace(/\s+/g, " ").trim();
      }
    });
  return result;
}

function extractBaseArea($) {
  // Building Area Types table
  const table = $(
    "#ctlBodyPane_ctl13_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail",
  );
  let base = null;
  table.find("tbody tr").each((_, tr) => {
    const code = $(tr).find("th").first().text().trim();
    const desc = $(tr).find("td").eq(0).text().trim();
    if (code === "BAS" || /BASE AREA/i.test(desc)) {
      const sqft = $(tr).find("td").eq(1).text().trim();
      base = parseIntSafe(sqft);
    }
  });
  return base;
}

function mapStructure($) {
  const { leftTable, rightTable } = extractResidentialLeftRightTables($);

  const type = getValueFromTwoColTable($, leftTable, "Type");
  const exteriorWalls = getValueFromTwoColTable($, leftTable, "Exterior Walls");
  const roofCover = getValueFromTwoColTable($, leftTable, "Roof Cover");
  const interiorWalls = getValueFromTwoColTable($, leftTable, "Interior Walls");
  const frameType = getValueFromTwoColTable($, leftTable, "Frame Type");
  const totalArea = getValueFromTwoColTable($, leftTable, "Total Area");
  const heatedArea = getValueFromTwoColTable($, leftTable, "Heated Area");

  const bedrooms = getValueFromTwoColTable($, rightTable, "Bedrooms");
  const bathrooms = getValueFromTwoColTable($, rightTable, "Bathrooms");

  // Derivations
  const attachment_type = /SINGLE/i.test(type || "") ? "Detached" : null;
  const exteriorPrimary = /STUCCO/i.test(exteriorWalls || "") ? "Stucco" : null;
  const roof_covering_material = /ASP|COM|SH/i.test(roofCover || "")
    ? "Architectural Asphalt Shingle"
    : null;
  const interior_surface_primary = /DRYWALL/i.test(interiorWalls || "")
    ? "Drywall"
    : null;
  const primary_framing_material = /MASONRY/i.test(frameType || "")
    ? "Masonry"
    : null;

  const finished_base_area = extractBaseArea($);

  // Build structure object following schema required fields with nulls where unknown
  const structure = {
    architectural_style_type: null,
    attachment_type: attachment_type,
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: /CARPET/i.test(String(totalArea))
      ? "Carpet"
      : null, // placeholder; we'll improve below
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: interior_surface_primary,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: roof_covering_material,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: /ASP|COM|SH/i.test(roofCover || "") ? "Shingle" : null,
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
    primary_framing_material: primary_framing_material,
    secondary_framing_material: null,
    structural_damage_indicators: null,

    // Optional fields not required but present in schema
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_door_installation_date: null,
    siding_installation_date: null,
    window_installation_date: null,
    roof_date: null,
    finished_base_area: finished_base_area,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    finished_basement_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: null,
    gutters_material_secondary: undefined, // not in schema; ensure no extra props
  };

  // Fix flooring primary/secondary based on explicit Floor Cover info from left/right tables text
  const floorCover = getValueFromTwoColTable(
    $,
    $(
      "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary table",
    ),
    "Floor Cover",
  );
  if (floorCover) {
    const hasCarpet = /CARPET/i.test(floorCover);
    const hasTile = /CERA|CERAM|CLAY|TILE/i.test(floorCover);
    if (hasCarpet) structure.flooring_material_primary = "Carpet";
    if (hasTile) structure.flooring_material_secondary = "Ceramic Tile";
  }

  return structure;
}

(function main() {
  try {
    const inputPath = path.join(process.cwd(), "input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    const structure = mapStructure($);

    const out = {};
    out[`property_${propId}`] = structure;

    ensureDir(path.join(process.cwd(), "owners"));
    const outPath = path.join(process.cwd(), "owners", "structure_data.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote structure data to", outPath);
  } catch (e) {
    console.error("Error in structureMapping:", e.message);
    process.exit(1);
  }
})();
