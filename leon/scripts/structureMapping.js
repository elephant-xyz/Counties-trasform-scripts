// Structure mapping script
// Reads input.html, parses with cheerio, extracts structure info, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
}

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

function extractFirstBuildingDetails($) {
  // Try the inline details first
  let $table = $("#single-building #building-details table.details");
  if ($table.length === 0) {
    // Fallback: any building details table under buildings card
    $table = $("div#building-details table.details").first();
  }
  const details = {};
  $table.find("tr").each((_, tr) => {
    const th = safeText($(tr).find("th").first().text());
    const td = safeText($(tr).find("td").first().text());
    if (th) details[th] = td || null;
  });
  return details;
}

function mapRoofDesignType(roofFrameStr) {
  if (!roofFrameStr) return null;
  const s = roofFrameStr.toLowerCase();
  const hasGable = s.includes("gable");
  const hasHip = s.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (s.includes("flat")) return "Flat";
  return null;
}

function mapRoofMaterialType(roofCoverStr) {
  if (!roofCoverStr) return null;
  const s = roofCoverStr.toLowerCase();
  // Source shows "Composition Shingle"
  if (s.includes("composition")) return "Composition";
  if (s.includes("shingle")) return "Shingle";
  if (s.includes("metal")) return "Metal";
  if (s.includes("tile")) return "Tile";
  if (s.includes("concrete")) return "Concrete";
  if (s.includes("slate")) return "Stone";
  return null;
}

function mapFraming(detailsFrame) {
  // "Wood Beam & Col." -> primary wood frame, secondary wood beams
  if (!detailsFrame) return { primary: null, secondary: null };
  const s = detailsFrame.toLowerCase();
  let primary = null;
  let secondary = null;
  if (s.includes("wood")) primary = "Wood Frame";
  return { primary, secondary };
}

function extractNumberOfBuildings($) {
  const count = $("tbody.building-table tr").length;
  return Number.isFinite(count) && count > 0 ? count : null;
}

function buildStructureObject($) {
  const details = extractFirstBuildingDetails($);
  const roofDesignType = mapRoofDesignType(details["Roof Frame"]);
  const roofMaterialType = mapRoofMaterialType(details["Roof Cover / Deck"]);
  const framing = mapFraming(details["Frame"]);
  const numberOfBuildings = extractNumberOfBuildings($);

  // Construct object with all required fields per schema, defaulting to null when unknown
  const o = {
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
    roof_design_type: roofDesignType,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roofMaterialType,
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
    primary_framing_material: framing.primary,
    secondary_framing_material: framing.secondary,
    structural_damage_indicators: null,

    // Optional/extra fields from schema
    exterior_door_installation_date: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    foundation_repair_date: null,
    number_of_buildings: numberOfBuildings,
    number_of_stories: null,
    roof_date: null,
    siding_installation_date: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_installation_date: null,
  };

  // Attempt a minimal mapping for exterior wall material if explicitly recognizable
  const extWall = (details["Exterior Wall"] || "").toLowerCase();
  if (extWall) {
    if (extWall.includes("brick")) o.exterior_wall_material_primary = "Brick";
    else if (extWall.includes("stucco"))
      o.exterior_wall_material_primary = "Stucco";
    else if (extWall.includes("vinyl"))
      o.exterior_wall_material_primary = "Vinyl Siding";
    else if (extWall.includes("wood"))
      o.exterior_wall_material_primary = "Wood Siding";
    else if (extWall.includes("siding"))
      o.exterior_wall_material_primary = null; // ambiguous
  }

  return o;
}

function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) {
    throw new Error("ParcelId not found in input.html");
  }

  const structure = buildStructureObject($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: structure };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
