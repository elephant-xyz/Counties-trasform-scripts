// Structure data extractor using Cheerio
// Reads input.html, extracts property details, maps to structure schema, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getText($, el) {
  if (!el || el.length === 0) return "";
  return $(el).text().replace(/\s+/g, " ").trim();
}

function parseNumber(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractPropertyId($) {
  // Try table: th "Property ID:" then adjacent td
  let pid = getText($, $('th:contains("Property ID:")').first().next("td"));
  if (!pid) {
    // Try page title occurrences
    const title = getText($, $(".page-title h3").first());
    const m = title.match(/Property ID:\s*(\d+)/i);
    if (m) pid = m[1];
  }
  return pid || "unknown";
}

function extractLivingArea($) {
  // From the Property Improvement - Building panel info span "Living Area: 1268.0 sqft"
  let sqft = null;
  $('.panel .panel-heading:contains("Property Improvement - Building")').each(
    (_, heading) => {
      const panel = $(heading).closest(".panel");
      $(panel)
        .find(".panel-table-info span,strong")
        .each((__, node) => {
          const t = getText($, node);
          const m = t.match(/Living Area:\s*([0-9,.]+)\s*sqft/i);
          if (m) {
            const n = parseNumber(m[1]);
            if (Number.isFinite(n)) sqft = n;
          }
        });
    },
  );
  return sqft;
}

function mapStructure($) {
  const propertyId = extractPropertyId($);
  const livingArea = extractLivingArea($);

  // Defaults: set all required schema fields to null unless we can infer safely
  const structure = {
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
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
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
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,

    // Optional fields we may populate when possible
    number_of_stories: null,
    finished_base_area: null,
    finished_upper_story_area: null,
    finished_basement_area: null,
    unfinished_base_area: null,
    unfinished_upper_story_area: null,
    unfinished_basement_area: null,

    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,

    roof_date: null,
    siding_installation_date: null,
    foundation_repair_date: null,
    exterior_door_installation_date: null,
    window_installation_date: null,
  };

  // Conservative mapping: if we have total living area, we don't equate to base footprint; keep optional
  if (Number.isFinite(livingArea)) {
    // Do not assign to finished_base_area due to lack of clarity; leave as null
  }

  return { key: `property_${propertyId}`, data: structure };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const { key, data } = mapStructure($);

  const outDir = path.join(process.cwd(), "owners");
  ensureDir(outDir);
  const outPath = path.join(outDir, "structure_data.json");

  const output = {};
  output[key] = data;

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for ${key} -> ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error generating structure data:", err.message);
    process.exit(1);
  }
}
