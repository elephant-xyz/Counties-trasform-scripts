// Structure mapping script
// Reads input.json and writes owners/structure_data.json keyed by property_[folio]

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function extractFromInput(inputObj) {
  // The provided input is JSON; handle case if wrapped/HTML by attempting cheerio when needed
  let data = inputObj;
  if (!data || typeof data !== "object") {
    return null;
  }
  const root = data.d || data;
  const parcelArr = root.parcelInfok__BackingField || [];
  const parcel = parcelArr[0] || {};

  const folio = parcel.folioNumber || parcel.folio || "unknown";
  const useCode = parcel.useCode || "";

  // Determine attachment type based on use code
  let attachment = null;
  if (/single\s*family/i.test(useCode) && !/attached/i.test(useCode)) {
    attachment = "Detached";
  } else if (/attached|townhouse|townhome/i.test(useCode)) {
    attachment = "Attached";
  } else if (/duplex|triplex|quad/i.test(useCode)) {
    attachment = "SemiDetached";
  }

  // Map structure fields with conservative nulls where unknown. Use condo heuristics minimally.
  const structure = {
    architectural_style_type: null,
    attachment_type: attachment,
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

    // Optional, non-required fields
    number_of_stories: null,
    finished_base_area: null,
    finished_upper_story_area: null,
    finished_basement_area: null,
    unfinished_base_area: null,
    unfinished_upper_story_area: null,
    unfinished_basement_area: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
  };

  // Attempt to derive some dimensions when present
  const underAir = parcel.bldgUnderAirFootage || parcel.bldgSqFT;
  if (underAir && !isNaN(Number(underAir))) {
    const sqft = parseInt(underAir, 10);
    structure.finished_base_area = sqft;
  }

  // Try to derive number of stories from use code description or other hints
  // For now, default to 1 for single family homes with data
  if (structure.finished_base_area && /single\s*family/i.test(useCode)) {
    structure.number_of_stories = 1;
  }

  return { folio, structure };
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");

  // If input is HTML, try to extract text and then JSON
  let parsed = safeParseJSON(raw);
  if (!parsed) {
    const $ = cheerio.load(raw || "");
    const text = $("body").text().trim();
    parsed = safeParseJSON(text);
  }

  if (!parsed) {
    throw new Error("Unable to parse input.json as JSON");
  }

  const result = extractFromInput(parsed);
  if (!result) {
    throw new Error("Failed to extract structure data");
  }

  const { folio, structure } = result;
  const outObj = {};
  outObj[`property_${folio}`] = structure;

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
})();
