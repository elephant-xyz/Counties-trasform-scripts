// Structure data extractor and mapper
// Reads input.html, parses JSON within <pre>, maps to structure schema, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseInput() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  const preText = $("pre").first().text().trim();
  if (!preText) throw new Error("No JSON found in <pre> tag.");
  return JSON.parse(preText);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function deriveExteriorMaterials(extWallRaw) {
  const primaryMap = new Map([
    ["STUCCO", "Stucco"],
    ["BRICK", "Brick"],
    ["BRK", "Brick"],
    ["STONE", "Natural Stone"],
    ["VINYL", "Vinyl Siding"],
    ["WOOD", "Wood Siding"],
    ["WD", "Wood Siding"],
    ["EIFS", "EIFS"],
    ["CONCRETE BLOCK", "Concrete Block"],
    ["CONCRETE", "Concrete"],
    ["CB", "Concrete Block"],
  ]);
  const value = String(extWallRaw || "").toUpperCase();
  if (!value) return { primary: null, secondary: null };

  const tokens = value
    .replace(/[^A-Z0-9/ ]+/g, " ")
    .split(/[\/,|-]/)
    .map((token) => token.trim())
    .filter(Boolean);

  const resolved = tokens
    .map((token) => {
      for (const [key, mapped] of primaryMap.entries()) {
        if (token.includes(key)) return mapped;
      }
      return null;
    })
    .filter(Boolean);

  const unique = Array.from(new Set(resolved));
  return {
    primary: unique[0] || null,
    secondary: unique[1] || null,
  };
}

function deriveFramingMaterial(extWallRaw) {
  const value = String(extWallRaw || "").toUpperCase();
  if (!value) return null;
  if (value.includes("CB") || value.includes("CONCRETE BLOCK"))
    return "Concrete Block";
  if (value.includes("MASONRY")) return "Masonry";
  if (value.includes("STEEL")) return "Steel Frame";
  if (value.includes("WOOD") || value.includes("WD")) return "Wood Frame";
  return null;
}

function getRequestIdentifier(src) {
  return (
    String(
      src.parcelNumber ||
        src.apprId ||
        src.masterId ||
        (src.parcelNumberFormatted || ""),
    ) || "unknown"
  );
}

function getNumberOfBuildings(src) {
  if (Array.isArray(src.buildingDetails) && src.buildingDetails.length) {
    return src.buildingDetails.length;
  }
  if (Array.isArray(src.valueSummary)) {
    const summary = src.valueSummary.find((row) =>
      row && String(row.valueType || "").toLowerCase().includes("number of buildings"),
    );
    const parsed = summary ? toNumber(summary.currVal) : null;
    if (parsed) return parsed;
  }
  return null;
}

function buildStructureRecord(src) {
  const requestIdentifier = getRequestIdentifier(src);
  const primaryBuilding =
    Array.isArray(src.buildingDetails) && src.buildingDetails.length
      ? src.buildingDetails[0]
      : null;

  const extWall = primaryBuilding ? primaryBuilding.extWall : null;
  const materials = deriveExteriorMaterials(extWall);
  const framing = deriveFramingMaterial(extWall);

  const baseArea =
    (primaryBuilding && toNumber(primaryBuilding.baseArea)) ||
    toNumber(src.livingAreaCalc);
  const livingArea =
    (primaryBuilding && toNumber(primaryBuilding.livingArea)) ||
    toNumber(src.livingAreaCalc);
  const grossArea =
    (primaryBuilding && toNumber(primaryBuilding.grossArea)) ||
    toNumber(src.grossAreaCalc);

  const unfinishedBaseArea =
    grossArea && livingArea ? Math.max(grossArea - livingArea, 0) : null;

  const numberOfStories =
    (primaryBuilding && toNumber(primaryBuilding.baseFloors)) ||
    toNumber(src.baseFloors) ||
    null;

  return {
    architectural_style_type: null,
    attachment_type: "Detached",
    exterior_wall_material_primary: materials.primary,
    exterior_wall_material_secondary: materials.secondary,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: "Unknown",
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
    roof_underlayment_type: "Unknown",
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: "Unknown",
    foundation_condition: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: "Unknown",
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: framing,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_buildings: getNumberOfBuildings(src),
    number_of_stories: numberOfStories,
    finished_base_area: baseArea ? Math.round(baseArea) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: unfinishedBaseArea
      ? Math.round(unfinishedBaseArea)
      : null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    siding_installation_date: null,
    roof_date: null,
    window_installation_date: null,
    exterior_door_installation_date: null,
    foundation_repair_date: null,
    request_identifier: requestIdentifier,
  };
}

function main() {
  const src = parseInput();
  const id = src && src.apprId ? String(src.apprId) : "unknown";
  const record = buildStructureRecord(src);

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const ownersOut = path.join(ownersDir, "structure_data.json");
  const dataOut = path.join(dataDir, "structure_data.json");
  const outJson = JSON.stringify({ [`property_${id}`]: record }, null, 2);
  fs.writeFileSync(ownersOut, outJson, "utf8");
  fs.writeFileSync(dataOut, outJson, "utf8");
  console.log("Structure mapping complete:", ownersOut);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in structureMapping:", err.message);
    process.exit(1);
  }
}
