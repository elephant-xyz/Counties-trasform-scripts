// Structure data extractor using cheerio
// Reads input.html and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadInput() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getValueFromSection($, sectionSelector, label) {
  let val = null;
  const $section =
    typeof sectionSelector === "string" ? $(sectionSelector) : sectionSelector;
  $section.find("tr").each((_, tr) => {
    const th = $(tr).find("th strong").first().text().trim();
    if (th === label) {
      const tdText = $(tr)
        .find("td")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (tdText) val = tdText;
    }
  });
  return val;
}

function parseStories(str) {
  if (!str) return null;
  const m = str.match(/([\d.]+)/);
  if (m) return Number(m[1]);
  return null;
}

function mapRoofDesign(val) {
  if (!val) return null;
  const s = val.toLowerCase();
  if (s.includes("gable") && s.includes("hip")) return "Combination";
  if (s.includes("gable")) return "Gable";
  if (s.includes("hip")) return "Hip";
  if (s.includes("flat")) return "Flat";
  return "Combination";
}

function mapExteriorWallMaterialPrimary(val) {
  if (!val) return null;
  const s = val.toLowerCase();
  if (s.includes("stucco")) return "Stucco";
  if (s.includes("brick")) return "Brick";
  if (s.includes("stone")) return "Natural Stone";
  if (s.includes("vinyl")) return "Vinyl Siding";
  if (s.includes("fiber") || s.includes("hardie")) return "Fiber Cement Siding";
  if (s.includes("wood") && s.includes("siding")) return "Wood Siding";
  if (s.includes("block")) return "Concrete Block";
  return null;
}

function mapPrimaryFraming(val) {
  if (!val) return null;
  const s = val.toLowerCase();
  if (s.includes("wood frame") || (s.includes("wood") && s.includes("frame")))
    return "Wood Frame";
  if (s.includes("frame")) return "Wood Frame";
  if (s.includes("block")) return "Concrete Block";
  if (s.includes("concrete")) return "Poured Concrete";
  return null;
}

function mapFlooringTypes(val) {
  // Returns {primary, secondary}
  if (!val) return { primary: null, secondary: null };
  const s = val.toLowerCase();
  let primary = null;
  let secondary = null;
  if (s.includes("carpet")) primary = "Carpet";
  if (s.includes("tile")) {
    if (!primary) primary = "Ceramic Tile";
    else secondary = "Ceramic Tile";
  }
  return { primary, secondary };
}

function extractParcelId($) {
  let pid = getValueFromSection($, "#ctlBodyPane_ctl00_mSection", "Parcel ID");
  if (pid) pid = pid.replace(/\s+/g, "").trim();
  return pid || "unknown_id";
}

function extractStructure($) {
  const sectionSel = "#ctlBodyPane_ctl05_mSection";
  const extWalls = getValueFromSection($, sectionSel, "Exterior Walls");
  const interiorWalls = getValueFromSection($, sectionSel, "Interior Walls");
  const roofType = getValueFromSection($, sectionSel, "Roof Type");
  const roofCoverage = getValueFromSection($, sectionSel, "Roof Coverage");
  const flooringType = getValueFromSection($, sectionSel, "Flooring Type");
  const stories = getValueFromSection($, sectionSel, "Stories");

  const { primary, secondary } = mapFlooringTypes(flooringType);

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",

    exterior_wall_material_primary: mapExteriorWallMaterialPrimary(extWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: "Unknown",

    flooring_material_primary: primary,
    flooring_material_secondary: secondary,
    subfloor_material: null,
    flooring_condition: null,

    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      interiorWalls && interiorWalls.toLowerCase().includes("drywall")
        ? "Drywall"
        : null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,

    roof_covering_material: null,
    roof_underlayment_type: "Unknown",
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofType),
    roof_condition: null,
    roof_age_years: null,

    gutters_material: null,
    gutters_condition: null,

    roof_material_type:
      roofCoverage && roofCoverage.toLowerCase().includes("shingle")
        ? "Shingle"
        : null,

    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: "Unknown",
    foundation_condition: null,

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

    primary_framing_material: mapPrimaryFraming(extWalls) || "Wood Frame",
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };

  const storyNum = parseStories(stories);
  if (typeof storyNum === "number") structure.number_of_stories = storyNum;

  return structure;
}

(function main() {
  const $ = loadInput();
  const parcelId = extractParcelId($);
  const structure = extractStructure($);

  const data = {};
  data[`property_${parcelId}`] = structure;

  fs.mkdirSync(path.dirname("owners/structure_data.json"), { recursive: true });
  fs.writeFileSync("owners/structure_data.json", JSON.stringify(data, null, 2));
  console.log("Wrote owners/structure_data.json for", `property_${parcelId}`);
})();
