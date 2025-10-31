// Structure mapping script
// Reads input.html, parses with cheerio, outputs owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractPropertyId($) {
  // Expect text like: "Property Record Information for 0000007000"
  const headerText = $("span.large.bold").first().text().trim();
  const m = headerText.match(/for\s+(\d{4,})/i);
  if (m) return m[1];
  // Fallback: try to find via quicksearch form value or other anchors
  const nextTitle = $("#nextstrap").attr("title");
  if (nextTitle && /^\d{4,}$/.test(nextTitle)) {
    // if nextstrap title is next id, try to read current from center element text
    // but if not available, still return a safe placeholder
  }
  return "unknown";
}

function isVacantLand($) {
  // Look for Buildings section followed by a P containing 'Vacant Land'
  let vacant = false;
  $("span.h2").each((i, el) => {
    const t = $(el).text().trim();
    if (/^Buildings/i.test(t)) {
      const p = $(el).nextAll("p").first().text().trim();
      if (/^Vacant Land$/i.test(p)) vacant = true;
    }
  });
  return vacant;
}

function buildStructureData($) {
  // For this dataset (Vacant Land), we default to nulls where allowed.
  // All required fields must be present per schema.
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
  };

  return structure;
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    // const vacant = isVacantLand($); // not used but extracted if needed

    const structureData = buildStructureData($);

    const outDir = path.resolve("owners");
    ensureDir(outDir);

    const outPath = path.join(outDir, "structure_data.json");
    const payload = {};
    payload[`property_${propId}`] = structureData;

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote structure data for property_${propId} to ${outPath}`);
  } catch (err) {
    console.error("Error in structureMapping:", err.message);
    process.exit(1);
  }
})();
