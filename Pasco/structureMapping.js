// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function parseNumber(str) {
  if (str == null) return null;
  const s = String(str).replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "." || s === "-") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const s = String(str).replace(/[^0-9\-]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function mapExteriorWallPrimary(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("concrete block")) return "Concrete Block";
  if (t.includes("stucco")) return "Stucco";
  if (t.includes("brick")) return "Brick";
  if (t.includes("vinyl")) return "Vinyl Siding";
  if (t.includes("wood")) return "Wood Siding";
  if (t.includes("fiber cement")) return "Fiber Cement Siding";
  if (t.includes("metal")) return "Metal Siding";
  return null;
}

function mapExteriorWallSecondary(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("stucco")) return "Stucco Accent";
  if (t.includes("brick")) return "Brick Accent";
  if (t.includes("stone")) return "Stone Accent";
  if (t.includes("wood")) return "Wood Trim";
  if (t.includes("vinyl")) return "Vinyl Accent";
  return null;
}

function mapRoofDesign(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("gable") && t.includes("hip")) return "Combination";
  if (t.includes("hip")) return "Hip";
  if (t.includes("gable")) return "Gable";
  if (t.includes("flat")) return "Flat";
  if (t.includes("shed")) return "Shed";
  return "Combination";
}

function mapRoofMaterialType(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("shingle")) return "Shingle";
  if (t.includes("metal")) return "Metal";
  if (t.includes("tile")) return "Tile";
  if (t.includes("concrete")) return "Concrete";
  if (t.includes("slate")) return "Stone";
  return null;
}

function mapInteriorWallSurface(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("plaster")) return "Plaster";
  if (t.includes("drywall") || t.includes("gypsum")) return "Drywall";
  if (t.includes("panel")) return "Wood Paneling";
  return null;
}

function mapFlooring(text) {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("carpet")) return "Carpet";
  if (t.includes("tile") && t.includes("ceramic")) return "Ceramic Tile";
  if (t.includes("tile")) return "Ceramic Tile";
  if (t.includes("vinyl plank") || t.includes("lvp"))
    return "Luxury Vinyl Plank";
  if (t.includes("vinyl")) return "Sheet Vinyl";
  if (t.includes("hardwood")) return "Solid Hardwood";
  if (t.includes("laminate")) return "Laminate";
  if (t.includes("concrete")) return "Polished Concrete";
  return null;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";

  const stories = parseNumber(safeText($, "#lblBuildingStories"));
  const ext1 = safeText($, "#lblBuildingExteriorWall1");
  const ext2 = safeText($, "#lblBuildingExteriorWall2");
  const roofStruct = safeText($, "#lblBuildingRoofStructure");
  const roofCover = safeText($, "#lblBuildingRoofCover");
  const intWall1 = safeText($, "#lblBuildingInteriorWall1");
  const floor1 = safeText($, "#lblBuildingFlooring1");
  const floor2 = safeText($, "#lblBuildingFlooring2");

  // Living area from sublines table
  let livingArea = null;
  $("#tblSubLines tr").each((i, el) => {
    if (i === 0) return; // header
    const tds = $(el).find("td");
    const desc = $(tds[2]).text().trim().toUpperCase();
    if (desc === "LIVING AREA") {
      livingArea = parseIntSafe($(tds[3]).text());
    }
  });

  const exteriorPrimary = mapExteriorWallPrimary(ext1) || null;
  // If text includes both concrete block and stucco, set secondary as Stucco Accent
  const exteriorSecondary =
    mapExteriorWallSecondary(ext1) ||
    (ext2 && ext2.toLowerCase() !== "none"
      ? mapExteriorWallSecondary(ext2)
      : null);

  const roofDesign = mapRoofDesign(roofStruct);
  const roofMaterialType = mapRoofMaterialType(roofCover);
  const interiorSurfacePrimary = mapInteriorWallSurface(intWall1);
  const flooringPrimary = mapFlooring(floor1);
  const flooringSecondary =
    floor2 && floor2.toLowerCase() !== "none" ? mapFlooring(floor2) : null;

  // Primary framing from exterior wall hint
  const primaryFraming =
    exteriorPrimary === "Concrete Block" ? "Concrete Block" : null;

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: exteriorSecondary,
    finished_base_area: livingArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooringPrimary,
    flooring_material_secondary: flooringSecondary,
    foundation_condition: null,
    foundation_material: null,
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
    interior_wall_surface_material_primary: interiorSurfacePrimary,
    interior_wall_surface_material_secondary: null,
    number_of_stories: stories ?? null,
    primary_framing_material: primaryFraming,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null, // too ambiguous in source; leave null per schema
    roof_date: null,
    roof_design_type: roofDesign,
    roof_material_type: roofMaterialType,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  const out = {};
  out[`property_${parcelId}`] = structure;

  const ownersDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const outPath = path.join(ownersDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
