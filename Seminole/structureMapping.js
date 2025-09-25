// structureMapping.js
// Reads input.json and produces owners/structure_data.json matching the structure schema.
const fs = require("fs");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toInt(val) {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function mapExteriorWallMaterial(extWall) {
  if (!extWall) return { primary: null, secondary: null };
  const s = String(extWall).toUpperCase();
  // Common county abbreviations: CB = Concrete Block, STUCCO FINISH present
  if (s.includes("CB")) {
    return { primary: "Concrete Block", secondary: null };
  }
  if (s.includes("BRICK")) return { primary: "Brick", secondary: null };
  if (s.includes("STUCCO")) return { primary: "Stucco", secondary: null };
  if (s.includes("VINYL")) return { primary: "Vinyl Siding", secondary: null };
  if (s.includes("WOOD")) return { primary: "Wood Siding", secondary: null };
  return { primary: null, secondary: null };
}

try {
  const input = JSON.parse(fs.readFileSync("input.json", "utf-8"));
  const propId = input.apprId || input.parcelNumber || "unknown";
  const b = (input.buildingDetails && input.buildingDetails[0]) || {};

  const { primary: exteriorPrimary, secondary: exteriorSecondary } =
    mapExteriorWallMaterial(b.extWall);

  const numberOfStories =
    input.baseFloors != null
      ? Number(input.baseFloors)
      : b.baseFloors != null
        ? Number(b.baseFloors)
        : null;

  const footprintFinished = toInt(b.baseArea);
  // Try to locate any unfinished ground-level area from sub-areas (e.g., UTU)
  let unfinishedBaseArea = null;
  if (Array.isArray(b.buildingSubAreas)) {
    const sumUnfinished = b.buildingSubAreas
      .filter(
        (sa) =>
          typeof sa.areaDescription === "string" &&
          sa.areaDescription.toUpperCase().includes("UNFINISHED"),
      )
      .reduce((acc, sa) => acc + (Number(sa.apdgActualArea) || 0), 0);
    unfinishedBaseArea = sumUnfinished > 0 ? Math.round(sumUnfinished) : null;
  }

  // Attachment type: DOR indicates townhome; assume attached unless evidence otherwise
  let attachmentType = null;
  const dorDesc = (input.dorDescription || "").toUpperCase();
  if (dorDesc.includes("TOWNHOME") || dorDesc.includes("TOWNHOUSE")) {
    attachmentType = "Attached";
  }

  // Primary framing material inferred from exterior wall
  let primaryFramingMaterial = null;
  if (exteriorPrimary === "Concrete Block")
    primaryFramingMaterial = "Concrete Block";

  const out = {
    [`property_${propId}`]: {
      architectural_style_type: null,
      attachment_type: attachmentType,
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
      exterior_wall_material_primary: exteriorPrimary,
      exterior_wall_material_secondary: exteriorSecondary,
      finished_base_area: footprintFinished,
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
      number_of_stories: numberOfStories,
      primary_framing_material: primaryFramingMaterial,
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
      unfinished_base_area: unfinishedBaseArea,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      window_frame_material: null,
      window_glazing_type: null,
      window_installation_date: null,
      window_operation_type: null,
      window_screen_material: null,
    },
  };

  ensureDir("owners");
  fs.writeFileSync("owners/structure_data.json", JSON.stringify(out, null, 2));
  console.log("Wrote owners/structure_data.json for", `property_${propId}`);
} catch (e) {
  console.error("Error creating structure mapping:", e.message);
  process.exit(1);
}
