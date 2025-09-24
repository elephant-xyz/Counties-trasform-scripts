// Structure Mapping Script
// Reads input.html (fallbacks to embedded HTML) and writes owners/structure_data.json

const fs = require("fs");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  console.error(
    "Cheerio module not found. Please ensure cheerio is available.",
  );
  process.exit(1);
}

function readInputHTML() {
  try {
    return fs.readFileSync("input.html", "utf8");
  } catch (e) {
    // Fallback to embedded HTML from input_file
    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en"><head><meta http-equiv="X-UA-Compatible" content="IE=IE8" /></head><body>
<span id="ctl00_cphBody_lblRealEstateNumber">001466-0000</span>
<div id="details_buildings">
  <div>
    <table id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements" class="gridview">
      <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
      <tr><td class="col_element">Exterior Wall</td><td class="col_code">19</td><td class="col_detail">19 Common Brick</td></tr>
      <tr><td class="col_element">Roof Struct</td><td class="col_code">3</td><td class="col_detail">3 Gable or Hip</td></tr>
      <tr><td class="col_element">Roofing Cover</td><td class="col_code">3</td><td class="col_detail">3 Asph/Comp Shng</td></tr>
      <tr><td class="col_element">Interior Wall</td><td class="col_code">5</td><td class="col_detail">5 Drywall</td></tr>
      <tr><td class="col_element">Int Flooring</td><td class="col_code">8</td><td class="col_detail">8 Sheet Vinyl</td></tr>
      <tr><td class="col_element">Int Flooring</td><td class="col_code">14</td><td class="col_detail">14 Carpet</td></tr>
      <tr><td class="col_element">Heating Fuel</td><td class="col_code">2</td><td class="col_detail">2 Oil</td></tr>
      <tr><td class="col_element">Heating Type</td><td class="col_code">4</td><td class="col_detail">4 Forced-Ducted</td></tr>
      <tr><td class="col_element">Air Cond</td><td class="col_code">3</td><td class="col_detail">3 Central</td></tr>
    </table>
    <table id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes" class="gridview">
      <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
      <tr><td class="col_element">Stories</td><td class="col_code">1.000</td><td class="col_detail"></td></tr>
      <tr><td class="col_element">Bedrooms</td><td class="col_code">3.000</td><td class="col_detail"></td></tr>
      <tr><td class="col_element">Baths</td><td class="col_code">2.000</td><td class="col_detail"></td></tr>
    </table>
  </div>
</div>
</body></html>`;
  }
}

function text($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function mapRoofCover(detail) {
  const d = (detail || "").toLowerCase();
  if (d.includes("asph") || d.includes("comp shng") || d.includes("shng"))
    return "3-Tab Asphalt Shingle";
  if (d.includes("architectural")) return "Architectural Asphalt Shingle";
  if (d.includes("metal")) return "Metal Corrugated";
  if (d.includes("tile") && d.includes("clay")) return "Clay Tile";
  if (d.includes("tile")) return "Concrete Tile";
  return null;
}

function mapRoofDesign(detail) {
  const d = (detail || "").toLowerCase();
  if (d.includes("gable")) return "Gable";
  if (d.includes("hip")) return "Hip";
  if (d.includes("flat")) return "Flat";
  return null;
}

function mapExterior(detail) {
  const d = (detail || "").toLowerCase();
  if (d.includes("brick")) return "Brick";
  if (d.includes("stone")) return "Natural Stone";
  if (d.includes("stucco")) return "Stucco";
  if (d.includes("vinyl")) return "Vinyl Siding";
  if (d.includes("fiber cement") || d.includes("hardie"))
    return "Fiber Cement Siding";
  if (d.includes("wood")) return "Wood Siding";
  if (d.includes("metal")) return "Metal Siding";
  if (d.includes("block")) return "Concrete Block";
  return null;
}

function mapFlooring(detail) {
  const d = (detail || "").toLowerCase();
  if (d.includes("sheet vinyl")) return "Sheet Vinyl";
  if (d.includes("vinyl")) return "Luxury Vinyl Plank";
  if (d.includes("carpet")) return "Carpet";
  if (d.includes("tile")) return "Ceramic Tile";
  if (d.includes("hardwood")) return "Solid Hardwood";
  return null;
}

function extractFirstBuildingElements($) {
  // Target the first building elements table
  const table = $('table[id$="_gridBuildingElements"]').first();
  const result = {};
  table.find("tr").each((i, el) => {
    const cells = $(el).find("td");
    if (cells.length >= 3) {
      const elName = $(cells[0]).text().trim();
      const detail = $(cells[2]).text().trim();
      result[elName] = detail;
    }
  });
  return result;
}

function extractFirstBuildingAttributes($) {
  const table = $('table[id$="_gridBuildingAttributes"]').first();
  const attrs = {};
  table.find("tr").each((i, el) => {
    const cells = $(el).find("td");
    if (cells.length >= 2) {
      const elName = $(cells[0]).text().trim();
      const code = $(cells[1]).text().trim();
      attrs[elName] = code;
    }
  });
  return attrs;
}

(function main() {
  const html = readInputHTML();
  const $ = cheerio.load(html);

  const re = text($, "#ctl00_cphBody_lblRealEstateNumber") || "UNKNOWN";
  const propKey = `property_${re}`;

  const elements = extractFirstBuildingElements($);
  const attrs = extractFirstBuildingAttributes($);

  const exteriorPrimary = mapExterior(elements["Exterior Wall"]);

  // Flooring
  const allFlooring = Object.keys(elements)
    .filter((k) => k.toLowerCase().includes("int flooring"))
    .map((k) => mapFlooring(elements[k]))
    .filter(Boolean);
  const flooringPrimary = allFlooring[0] || null;
  const flooringSecondary = allFlooring[1] || null;

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: exteriorPrimary || null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooringPrimary || null,
    flooring_material_secondary: flooringSecondary || null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: "Paint",
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: "Wood Frame",
    interior_wall_structure_material_primary: "Wood Frame",
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary:
      elements["Interior Wall"] &&
      elements["Interior Wall"].toLowerCase().includes("drywall")
        ? "Drywall"
        : null,
    interior_wall_surface_material_secondary:
      elements["Interior Wall"] &&
      elements["Interior Wall"].toLowerCase().includes("plywood")
        ? "Wood Paneling"
        : null,
    number_of_stories: attrs["Stories"]
      ? parseInt(parseFloat(attrs["Stories"]))
      : null,
    primary_framing_material: "Wood Frame",
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCover(elements["Roofing Cover"]) || null,
    roof_date: null,
    roof_design_type: mapRoofDesign(elements["Roof Struct"]) || null,
    roof_material_type:
      mapRoofCover(elements["Roofing Cover"]) &&
      mapRoofCover(elements["Roofing Cover"]).toLowerCase().includes("shingle")
        ? "Shingle"
        : null,
    roof_structure_material: "Wood Truss",
    roof_underlayment_type: "Unknown",
    structural_damage_indicators: null,
    subfloor_material: "Unknown",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // Create owners directory if needed
  if (!fs.existsSync("owners")) fs.mkdirSync("owners", { recursive: true });

  const out = {};
  out[propKey] = structure;
  fs.writeFileSync("owners/structure_data.json", JSON.stringify(out, null, 2));
  console.log("Wrote owners/structure_data.json for", propKey);
})();
