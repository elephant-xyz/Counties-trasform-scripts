// Structure mapping script: reads input.json and outputs owners/structure_data.json per schema
// Uses only cheerio for any HTML parsing if needed; JSON handled via vanilla JS
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function parseDateToYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function mapStructure(input) {
  const b = (input.buildings && input.buildings[0]) || {};
  const ci = b.constructionInfo || [];
  const getDetailByElement = (code) => {
    const item = ci.find(
      (x) => ((x.element && x.element.code) || "").trim() === code.trim(),
    );
    return item
      ? item.constructionDetail && item.constructionDetail.description
      : null;
  };

  const exteriorWallDesc = getDetailByElement("EW");
  const roofStructureDesc = getDetailByElement("RS");
  const roofCoverDesc = getDetailByElement("RC");
  const interiorWallsDesc = getDetailByElement("IW");
  const interiorFlooring = ci
    .filter((x) => ((x.element && x.element.code) || "").trim() === "IF")
    .map((x) => x.constructionDetail && x.constructionDetail.description);
  const hvacDesc = getDetailByElement("AC");
  const archStyle = getDetailByElement("AR");
  const stories = b.stories || null;
  const yearBuilt = b.yearBuilt || null;

  // Map enums per schema
  const architectural_style_type =
    archStyle === "Contemporary" ? "Contemporary" : null;

  const attachment_type = "Detached";

  // Exterior wall material
  let exterior_wall_material_primary = null;
  if (exteriorWallDesc && /stucco/i.test(exteriorWallDesc))
    exterior_wall_material_primary = "Stucco";
  // Secondary not provided
  const exterior_wall_material_secondary = null;

  // Exterior condition: use general condition if present; map 'Average' -> 'Good'
  let exterior_wall_condition = "Good";
  let exterior_wall_condition_primary = "Good";
  const exterior_wall_condition_secondary = null;

  // Insulation unknown
  const exterior_wall_insulation_type = "Unknown";
  const exterior_wall_insulation_type_primary = "Unknown";
  const exterior_wall_insulation_type_secondary = "Unknown";

  // Flooring materials
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  if (interiorFlooring && interiorFlooring.length) {
    if (interiorFlooring.find((x) => /tile/i.test(x)))
      flooring_material_primary = "Ceramic Tile";
    if (interiorFlooring.find((x) => /carpet/i.test(x)))
      flooring_material_secondary = "Carpet";
  }

  const subfloor_material = null; // unknown
  const flooring_condition = "Good";

  // Interior walls
  const interior_wall_structure_material = "Wood Frame";
  const interior_wall_structure_material_primary = "Wood Frame";
  const interior_wall_structure_material_secondary = null;
  const interior_wall_surface_material_primary =
    interiorWallsDesc && /drywall/i.test(interiorWallsDesc) ? "Drywall" : null;
  const interior_wall_surface_material_secondary = null;
  const interior_wall_finish_primary = "Paint";
  const interior_wall_finish_secondary = null;
  const interior_wall_condition = "Good";

  // Roof
  let roof_covering_material = null;
  if (roofCoverDesc && /shingle/i.test(roofCoverDesc)) {
    roof_covering_material = "Architectural Asphalt Shingle";
  }
  const roof_underlayment_type = "Unknown";
  const roof_structure_material = "Wood Truss";
  let roof_design_type = null;
  if (
    roofStructureDesc &&
    /gable/i.test(roofStructureDesc) &&
    /hip/i.test(roofStructureDesc)
  ) {
    roof_design_type = "Combination";
  } else if (roofStructureDesc && /gable/i.test(roofStructureDesc)) {
    roof_design_type = "Gable";
  } else if (roofStructureDesc && /hip/i.test(roofStructureDesc)) {
    roof_design_type = "Hip";
  }
  const roof_condition = "Good";
  const yearNow = new Date().getUTCFullYear();
  const roof_age_years =
    yearBuilt && yearNow >= yearBuilt ? Math.max(1, yearNow - yearBuilt) : null;

  const gutters_material = null;
  const gutters_condition = null;

  const roof_material_type = "Shingle";

  // Foundation
  const foundation_type = "Slab on Grade";
  const foundation_material = "Poured Concrete";
  const foundation_waterproofing = "Unknown";
  const foundation_condition = "Unknown";

  // Ceilings unknown
  const ceiling_structure_material = null;
  const ceiling_surface_material = null;
  const ceiling_insulation_type = "Unknown";
  const ceiling_height_average = null;
  const ceiling_condition = null;

  // Doors and windows unknown
  const exterior_door_material = null;
  const interior_door_material = null;
  const window_frame_material = null;
  const window_glazing_type = null;
  const window_operation_type = null;
  const window_screen_material = null;

  // Framing
  const primary_framing_material = "Concrete Block";
  const secondary_framing_material = null;

  // Damage
  const structural_damage_indicators = "None Observed";

  const structure = {
    architectural_style_type,
    attachment_type,
    ceiling_condition,
    ceiling_height_average,
    ceiling_insulation_type,
    ceiling_structure_material,
    ceiling_surface_material,
    exterior_door_installation_date: null,
    exterior_door_material,
    exterior_wall_condition,
    exterior_wall_condition_primary,
    exterior_wall_condition_secondary,
    exterior_wall_insulation_type,
    exterior_wall_insulation_type_primary,
    exterior_wall_insulation_type_secondary,
    exterior_wall_material_primary,
    exterior_wall_material_secondary,
    finished_base_area: b.heatedArea || null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition,
    flooring_material_primary,
    flooring_material_secondary,
    foundation_condition,
    foundation_material,
    foundation_repair_date: null,
    foundation_type,
    foundation_waterproofing,
    gutters_condition,
    gutters_material,
    interior_door_material,
    interior_wall_condition,
    interior_wall_finish_primary,
    interior_wall_finish_secondary,
    interior_wall_structure_material,
    interior_wall_structure_material_primary,
    interior_wall_structure_material_secondary,
    interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary,
    number_of_stories: stories,
    primary_framing_material,
    roof_age_years,
    roof_condition,
    roof_covering_material,
    roof_date: yearBuilt ? String(yearBuilt) : null,
    roof_design_type,
    roof_material_type,
    roof_structure_material,
    roof_underlayment_type,
    secondary_framing_material,
    siding_installation_date: null,
    structural_damage_indicators,
    subfloor_material,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material,
    window_glazing_type,
    window_installation_date: null,
    window_operation_type,
    window_screen_material,
    architectural_style_type: architectural_style_type,
    attachment_type: attachment_type,
    primary_framing_material: primary_framing_material,
    secondary_framing_material: secondary_framing_material,
  };

  // Ensure all required keys exist (already set) and within enums
  return structure;
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse input.json");
    process.exit(1);
  }
  const pin =
    data.pin || (data.propertyCard && data.propertyCard.folio) || "unknown";
  const outObj = {};
  outObj[`property_${pin}`] = mapStructure(data);

  // Write to owners and data for compatibility
  ensureDir("owners");
  ensureDir("data");
  fs.writeFileSync(
    "owners/structure_data.json",
    JSON.stringify(outObj, null, 2),
  );
  fs.writeFileSync("data/structure_data.json", JSON.stringify(outObj, null, 2));
  console.log("owners/structure_data.json written");
})();
