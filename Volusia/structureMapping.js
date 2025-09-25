// Structure mapping script
// Reads input.html, extracts structural attributes using cheerio, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getTextAfterStrong($, label) {
  const el = $("strong").filter((i, e) => $(e).text().trim() === label);
  if (el.length) {
    const val = el.first().parent().next().text().trim();
    return val.replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

function parseNumber(str) {
  if (str == null) return null;
  const m = String(str).match(/[-+]?[0-9]*\.?[0-9]+/);
  return m ? Number(m[0]) : null;
}

function main() {
  const inputPath = "input.html";
  const html = readHtml(inputPath);
  const $ = cheerio.load(html);

  const altkey = ($("#altkey").attr("value") || "").trim();
  const propertyId = `property_${altkey || "unknown"}`;

  // Defaults per schema (nulls allowed in schema for most fields)
  const data = {
    architectural_style_type: null,
    attachment_type: null,
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
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
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
    number_of_stories: null,
    primary_framing_material: null,
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
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // Extract style -> architectural_style_type
  const style = getTextAfterStrong($, "Style:");
  if (style && /RANCH/i.test(style)) {
    data.architectural_style_type = "Ranch";
  }

  // Attachment type: Single Family typically Detached
  const propertyUse = $('div.col-sm-5:contains("Property Use:")')
    .next()
    .text()
    .trim();
  if (/SINGLE\s*FAMILY/i.test(propertyUse)) {
    data.attachment_type = "Detached";
  }

  // Stories
  const stories = getTextAfterStrong($, "# Stories:");
  const storiesNum = parseNumber(stories);
  if (storiesNum != null) data.number_of_stories = storiesNum;

  // Interior wall surface (Drywall)
  const wallType = getTextAfterStrong($, "Wall Type:");
  if (wallType && /DRYWALL/i.test(wallType)) {
    data.interior_wall_surface_material_primary = "Drywall";
  }

  // Exterior wall material - text is ambiguous ("COMPOSITION WITH SHEATHING"). Leave null to avoid wrong enum mapping.
  const exteriorWall = getTextAfterStrong($, "Exterior Wall:");
  if (exteriorWall) {
    // no safe mapping; keep nulls
  }

  // Foundation
  const foundation = getTextAfterStrong($, "Foundation:");
  if (foundation && /SLAB/i.test(foundation)) {
    data.foundation_type = "Slab on Grade";
    data.subfloor_material = "Concrete Slab";
    data.foundation_material = "Poured Concrete";
  }

  // Roof covering and design
  const roofCover = getTextAfterStrong($, "Roof Cover:");
  if (roofCover && /ASPHALT\s+SHINGLE/i.test(roofCover)) {
    // Default to 3-Tab when specific not provided
    data.roof_covering_material = "3-Tab Asphalt Shingle";
    data.roof_material_type = "Shingle";
  }
  const roofType = getTextAfterStrong($, "Roof Type:");
  if (roofType && /HIP/i.test(roofType)) {
    data.roof_design_type = "Hip";
  }

  // Flooring - not specified (combination). Keep nulls to respect schema.

  // Windows/doors/gutters/ceilings - not provided.

  // Primary framing likely wood in this region/era, but not explicit; leave null.

  // Build JSON wrapper
  const output = {};
  output[propertyId] = data;

  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Structure data written to ${outPath} for ${propertyId}`);
}

main();
