// Structure extractor script
// Reads input.html, parses building info with cheerio, and writes owners/structure_data.json following the structure schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function textNorm(s) {
  if (!s) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function getParcelId($) {
  // Look inside Parcel Summary section
  const section = $("#ctlBodyPane_ctl01_mSection");
  let parcelId = null;
  section.find("table.tabular-data-two-column tbody tr").each((i, el) => {
    const label = textNorm($(el).find("th strong").text());
    const value = textNorm($(el).find("td span").text());
    if (label.toLowerCase() === "parcel id") {
      parcelId = value;
    }
  });
  // Fallback: try to find any span that matches pattern
  if (!parcelId) {
    const m = $("span")
      .filter((i, el) => /\b\d{5}-\d{3}[A-Z]?\b/.test($(el).text()))
      .first()
      .text();
    parcelId = textNorm(m) || "UNKNOWN_ID";
  }
  return parcelId;
}

function collectBuildingFacts($) {
  const facts = {};
  const section = $("#ctlBodyPane_ctl04_mSection");
  // Iterate all two-column tables under Building Information and record first non-empty value per label
  section.find("table.tabular-data-two-column tbody tr").each((i, el) => {
    const label = textNorm($(el).find("th strong").text());
    const value = textNorm($(el).find("td").text());
    if (label && value && !(label in facts)) {
      facts[label] = value;
    }
  });
  return facts;
}

function mapExteriorWalls(raw) {
  if (!raw) return { primary: null, secondary: null };
  const parts = raw.split(";").map((p) => textNorm(p).toUpperCase());
  // Map tokens to schema options
  let materials = parts
    .map((p) => {
      if (p.includes("BRK") || p.includes("BRICK")) return "Brick";
      if (p.includes("VINYL")) return "Vinyl Siding";
      if (p.includes("STUCCO")) return "Stucco";
      if (p.includes("STONE")) return "Natural Stone";
      return null;
    })
    .filter(Boolean);
  // Deduplicate
  materials = [...new Set(materials)];
  let primary = materials[0] || null;
  let secondary = null;
  if (materials.length > 1) {
    // Secondary must be from secondary enum; approximate mapping
    const m2 = materials[1];
    if (m2 === "Vinyl Siding") secondary = "Vinyl Accent";
    else if (m2 === "Brick") secondary = "Brick Accent";
    else if (m2 === "Natural Stone") secondary = "Stone Accent";
    else secondary = null;
  }
  return { primary, secondary };
}

function mapRoofCover(raw) {
  if (!raw) return null;
  const v = raw.toUpperCase();
  if (v.includes("COMP") || v.includes("SHNGL") || v.includes("SHING")) {
    return "3-Tab Asphalt Shingle";
  }
  if (v.includes("METAL")) return "Metal Standing Seam";
  if (v.includes("TPO")) return "TPO Membrane";
  if (v.includes("EPDM")) return "EPDM Membrane";
  if (v.includes("SLATE")) return "Natural Slate";
  return null;
}

function buildStructureObject(facts) {
  const walls = mapExteriorWalls(facts["Exterior Walls"]);
  const roofCover = mapRoofCover(facts["Roof Cover"]);
  const interiorWalls = facts["Interior Walls"] ? "Drywall" : null;
  const frameType = facts["Frame Type"] ? "Wood Frame" : null;
  const floorCover = facts["Floor Cover"] ? "Carpet" : null;

  const obj = {
    architectural_style_type: null,
    attachment_type: "Attached",
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
    exterior_wall_material_primary: walls.primary || null,
    exterior_wall_material_secondary: walls.secondary || null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: floorCover,
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
    interior_wall_structure_material: frameType,
    interior_wall_structure_material_primary: frameType,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: interiorWalls,
    interior_wall_surface_material_secondary: null,
    number_of_stories: null,
    primary_framing_material: frameType,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roofCover,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: roofCover ? "Shingle" : null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
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
  return obj;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  const facts = collectBuildingFacts($);
  const structure = buildStructureObject(facts);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote structure data for ${parcelId} -> ${outPath}`);
}

if (require.main === module) {
  main();
}
