// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textOfNextSibling($, strongLabel) {
  // Find a <strong> with exact text (case-insensitive, ignoring punctuation) and return the following sibling column text
  let foundText = null;
  $("div.row.parcel-content").each((i, row) => {
    const strongs = $(row).find("strong");
    strongs.each((j, s) => {
      const t = $(s).text().trim();
      if (
        t.toLowerCase().replace(/\:$/, "") ===
        strongLabel.toLowerCase().replace(/\:$/, "")
      ) {
        // The value is typically in the next sibling column within the same row
        const val = $(s).parent().next().text().trim();
        if (val && !foundText) foundText = val;
      }
    });
  });
  return foundText;
}

function getHiddenInputValue($, id) {
  const el = $(`input#${id}`);
  if (el && el.length) return el.val();
  return null;
}

function parseIntSafe(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function sanitizeEnum(value, allowed) {
  if (value == null) return null;
  if (allowed.includes(value)) return value;
  return null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Property ID (Alternate Key)
  let altkey = getHiddenInputValue($, "altkey");
  if (!altkey) {
    // fallback: locate Alternate Key label
    $("div.col-sm-5").each((i, el) => {
      const t = $(el).text().trim();
      if (/Alternate Key/i.test(t)) {
        const v = $(el).next().text().trim();
        if (v) altkey = v.replace(/[^0-9]/g, "");
      }
    });
  }

  // Extract core building info
  const style = textOfNextSibling($, "Style") || "";
  const numStories = parseIntSafe(textOfNextSibling($, "# Stories"));
  const exteriorWall = textOfNextSibling($, "Exterior Wall") || "";
  const foundation = textOfNextSibling($, "Foundation") || "";
  const roofCover = textOfNextSibling($, "Roof Cover") || "";
  const roofType = textOfNextSibling($, "Roof Type") || "";
  const wallType = textOfNextSibling($, "Wall Type") || "";
  const floorType = textOfNextSibling($, "Floor Type") || "";
  const yearBuiltText = textOfNextSibling($, "Year Built") || "";
  const yearBuilt = parseIntSafe(yearBuiltText);
  const sflaText = textOfNextSibling($, "Total SFLA") || "";
  const sfla = parseIntSafe(sflaText);

  // Mappings
  // attachment_type
  let attachment_type = null;
  if (/TOWNHOUSE/i.test(style) || /ATCHD/i.test($("div.col-sm-7").text())) {
    attachment_type = "Attached";
  }

  // primary_framing_material from exterior wall
  let primary_framing_material = null;
  if (/CONCRETE\s*BLOCK/i.test(exteriorWall))
    primary_framing_material = "Concrete Block";

  // exterior wall materials
  let exterior_wall_material_primary = null;
  let exterior_wall_material_secondary = null;
  if (/CONCRETE\s*BLOCK/i.test(exteriorWall)) {
    exterior_wall_material_primary = "Concrete Block";
    if (/STUCCO/i.test(exteriorWall))
      exterior_wall_material_secondary = "Stucco Accent";
  } else if (/STUCCO/i.test(exteriorWall)) {
    exterior_wall_material_primary = "Stucco";
  }

  // foundation type
  let foundation_type = null;
  if (/SLAB/i.test(foundation)) foundation_type = "Slab on Grade";

  // roof covering
  let roof_covering_material = null;
  if (/ASPHALT\s*SHINGLE/i.test(roofCover)) {
    // Default modern assumption
    roof_covering_material = "Architectural Asphalt Shingle";
  }

  // roof design type
  let roof_design_type = null;
  if (/HIP/i.test(roofType)) roof_design_type = "Hip";

  // roof structure material (typical for 2020 CBS)
  let roof_structure_material = "Wood Truss";

  // roof underlayment type unknown
  let roof_underlayment_type = "Unknown";

  // roof material type general
  let roof_material_type = "Shingle";

  // roof age
  let roof_age_years = null;
  if (yearBuilt) {
    const now = new Date();
    const age = now.getFullYear() - yearBuilt;
    if (age >= 1) roof_age_years = age;
    else roof_age_years = 1;
  }

  // interior wall surface from Wall Type
  let interior_wall_surface_material_primary = null;
  if (/DRYWALL/i.test(wallType))
    interior_wall_surface_material_primary = "Drywall";

  // subfloor material based on slab
  let subfloor_material = null;
  if (foundation_type === "Slab on Grade") subfloor_material = "Concrete Slab";

  // number_of_stories
  let number_of_stories = numStories != null ? numStories : null;

  // Compose structure object per schema; default unknowns to null
  const structure = {
    architectural_style_type: null,
    attachment_type: attachment_type,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: "Truss System",
    ceiling_surface_material: "Drywall",
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: exterior_wall_material_secondary,
    finished_base_area: sfla || null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: foundation_type ? "Poured Concrete" : null, // best proxy for slab foundations
    foundation_repair_date: null,
    foundation_type: foundation_type,
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
      interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary: null,
    number_of_stories: number_of_stories,
    primary_framing_material: primary_framing_material,
    roof_age_years: roof_age_years,
    roof_condition: null,
    roof_covering_material: roof_covering_material,
    roof_date: yearBuilt ? String(yearBuilt) : null,
    roof_design_type: roof_design_type,
    roof_material_type: roof_material_type,
    roof_structure_material: roof_structure_material,
    roof_underlayment_type: roof_underlayment_type,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: subfloor_material,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // Ensure enums validity (only for ones we set) - keep nulls if not exact
  const structureOut = structure;

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {};
  payload[`property_${altkey}`] = structureOut;

  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
