// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textNorm(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

function parseIntSafe(s) {
  const n = parseInt((s || "").toString().replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatSafe(s) {
  const n = parseFloat((s || "").toString().replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getKV($, tableSelector, headingText) {
  let val = null;
  $(tableSelector)
    .find("tr")
    .each((i, tr) => {
      const th = textNorm($(tr).find("td.DataletSideHeading").first().text());
      if (th === headingText) {
        val = textNorm($(tr).find("td.DataletData").first().text());
      }
    });
  return val;
}

function extractPropertyId($) {
  const hdPin = $("input#hdPin").attr("value") || $("input#hdPin").val();
  if (hdPin) return textNorm(hdPin);
  // Fallback: try Altkey line in header
  let id = null;
  $("#datalet_header_row")
    .find("td")
    .each((i, td) => {
      const t = $(td).text();
      const m = t.match(/Altkey:\s*(\d+)/i);
      if (m) id = m[1];
    });
  return id || "unknown";
}

function mapExteriorWallToMaterial(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("CONCRETE BLOCK")) return "Concrete Block";
  if (t.includes("BRICK")) return "Brick";
  if (t.includes("STUCCO")) return "Stucco";
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("WOOD")) return "Wood Siding";
  if (t.includes("FIBER CEMENT")) return "Fiber Cement Siding";
  if (t.includes("STONE")) return "Natural Stone";
  return null;
}

function mapFoundationType(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("STEM")) return "Stem Wall";
  if (t.includes("SLAB")) return "Slab on Grade";
  if (t.includes("CRAWL")) return "Crawl Space";
  if (t.includes("BASEMENT")) return "Full Basement";
  return null;
}

function mapFoundationMaterial(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("CONCRETE BLOCK") || t.includes("BLOCK"))
    return "Concrete Block";
  if (t.includes("POURED CONCRETE") || t.includes("CONC"))
    return "Poured Concrete";
  if (t.includes("STONE")) return "Stone";
  if (t.includes("BRICK")) return "Brick";
  return null;
}

function mapSubfloor(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("SLAB")) return "Concrete Slab";
  if (t.includes("PLYWOOD")) return "Plywood";
  if (t.includes("OSB")) return "OSB";
  return null;
}

function mapRoofDesign(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("GABLE")) return "Gable";
  if (t.includes("HIP")) return "Hip";
  if (t.includes("FLAT")) return "Flat";
  if (t.includes("GAMBREL")) return "Gambrel";
  if (t.includes("MANSARD")) return "Mansard";
  if (t.includes("SHED")) return "Shed";
  return null;
}

function mapRoofMaterialTypeFromCover(text) {
  const t = (text || "").toUpperCase();
  if (t.includes("METAL")) return "Metal";
  if (t.includes("SHINGLE")) return "Shingle";
  if (t.includes("TILE")) return "Tile";
  if (t.includes("SLATE")) return "Stone";
  if (t.includes("CONCRETE")) return "PouredConcrete";
  return null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const propId = extractPropertyId($);

  // Core sources
  const residentialTable = "table#Residential";
  const profileTable =
    "table#Citrus\\ County\\ Property\\ Appraiser\\,\\ Cregg\\ E\\.\\ Dalton";

  const exteriorWallRaw = getKV($, residentialTable, "Exterior Wall");
  const foundationRaw = getKV($, residentialTable, "Foundation");
  const floorSystemRaw = getKV($, residentialTable, "Floor System");
  const roofFrameRaw = getKV($, residentialTable, "Roof Frame");
  const roofCoverRaw = getKV($, residentialTable, "Roof Cover");
  const storiesRaw = getKV($, residentialTable, "Stories");
  const bldgCountsRaw = (function () {
    let v = null;
    $(profileTable)
      .find("tr")
      .each((i, tr) => {
        const th = textNorm($(tr).find("td.DataletSideHeading").first().text());
        if (th === "Bldg Counts")
          v = textNorm($(tr).find("td.DataletData").first().text());
      });
    return v;
  })();

  // Derivations
  const numberOfBuildings = (function () {
    const m = (bldgCountsRaw || "").match(/Res\s+(\d+)/i);
    return m ? parseIntSafe(m[1]) : null;
  })();
  const numberOfStories = parseFloatSafe(storiesRaw);

  const exteriorMaterial = mapExteriorWallToMaterial(exteriorWallRaw);
  const foundationType = mapFoundationType(foundationRaw);
  const foundationMaterial = mapFoundationMaterial(foundationRaw);
  const subfloor = mapSubfloor(floorSystemRaw);
  const roofDesign = mapRoofDesign(roofFrameRaw);
  const roofMaterialType = mapRoofMaterialTypeFromCover(roofCoverRaw);

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
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
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: exteriorMaterial,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: foundationMaterial,
    foundation_repair_date: null,
    foundation_type: foundationType,
    foundation_waterproofing: "Unknown",
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
    number_of_buildings: numberOfBuildings,
    number_of_stories: numberOfStories,
    primary_framing_material:
      exteriorMaterial === "Concrete Block" ? "Concrete Block" : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: roofDesign,
    roof_material_type: roofMaterialType || null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: subfloor,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // Ensure required fields exist per schema (they do) and enums respected via null defaults.

  const out = {};
  out[`property_${propId}`] = structure;

  ensureDirSync(path.join(process.cwd(), "owners"));
  fs.writeFileSync(
    path.join("owners", "structure_data.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("Wrote owners/structure_data.json for property_" + propId);
}

try {
  main();
} catch (err) {
  console.error("Error generating structure data:", err.message);
  process.exit(1);
}
