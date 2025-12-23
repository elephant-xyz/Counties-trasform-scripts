// Structure mapping script
// Reads input.json, parses DCAD HTML with cheerio, and outputs owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, selector) {
  const el = $(selector);
  return el && el.length ? el.first().text().trim() : "";
}

function parseIntSafe(val) {
  if (val == null) return null;
  const num = String(val).replace(/[^0-9.]/g, "");
  if (!num) return null;
  const n = parseFloat(num);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function mapRoofType(txt) {
  if (!txt) return null;
  txt = txt.toUpperCase();
  if (txt.includes("GABLE")) return "Gable";
  if (txt.includes("HIP")) return "Hip";
  if (txt.includes("FLAT")) return "Flat";
  if (txt.includes("MANSARD")) return "Mansard";
  if (txt.includes("GAMBREL")) return "Gambrel";
  if (txt.includes("SHED")) return "Shed";
  return null;
}

function mapRoofCovering(txt) {
  if (!txt) return null;
  txt = txt.toUpperCase();
  // DCAD uses COMP SHINGLES for composition asphalt shingles
  if (txt.includes("COMP") || txt.includes("SHINGLE"))
    return "3-Tab Asphalt Shingle";
  if (txt.includes("METAL")) return "Metal Standing Seam";
  if (txt.includes("SLATE")) return "Natural Slate";
  if (txt.includes("TPO")) return "TPO Membrane";
  if (txt.includes("EPDM")) return "EPDM Membrane";
  if (txt.includes("BITUMEN")) return "Modified Bitumen";
  if (txt.includes("BUILT")) return "Built-Up Roof";
  if (txt.includes("TILE")) return "Clay Tile";
  return null;
}

function mapExtWall(txt) {
  if (!txt) return null;
  txt = txt.toUpperCase();
  if (txt.includes("BRICK")) return "Brick";
  if (txt.includes("STONE")) return "Natural Stone";
  if (txt.includes("STUCCO")) return "Stucco";
  if (txt.includes("VINYL")) return "Vinyl Siding";
  if (txt.includes("WOOD")) return "Wood Siding";
  if (txt.includes("FIBER") || txt.includes("HARDIE"))
    return "Fiber Cement Siding";
  if (txt.includes("METAL")) return "Metal Siding";
  if (txt.includes("BLOCK")) return "Concrete Block";
  return null;
}

function mapFoundation(txt) {
  if (!txt) return null;
  txt = txt.toUpperCase();
  if (txt.includes("SLAB")) return "Slab on Grade";
  if (txt.includes("CRAWL")) return "Crawl Space";
  if (txt.includes("FULL BASEMENT")) return "Full Basement";
  if (txt.includes("PARTIAL BASEMENT")) return "Partial Basement";
  if (txt.includes("PIER") || txt.includes("BEAM")) return "Pier and Beam";
  if (txt.includes("WALKOUT")) return "Basement with Walkout";
  if (txt.includes("STEM")) return "Stem Wall";
  return null;
}

function mapStories(txt) {
  if (!txt) return null;
  const t = txt.toUpperCase();
  if (t.includes("ONE")) return 1;
  if (t.includes("TWO")) return 2;
  if (t.includes("THREE")) return 3;
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getPropertyId(input, $) {
  // Try from OwnersAndGeneralInformation.source_http_request.multiValueQueryString.ID[0]
  const id1 =
    input?.OwnersAndGeneralInformation?.source_http_request
      ?.multiValueQueryString?.ID?.[0];
  if (id1) return id1;
  // Try from page title
  const title = $("span#lblPageTitle").text() || $("span.PageTitle").text();
  const m = title.match(/#([0-9]{8,})/);
  if (m) return m[1];
  // Try hidden input
  const hid = $("input#txtAccountNumber").val();
  if (hid) return hid.trim();
  return "unknown";
}

function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error("Failed to read input.json:", e.message);
    raw = "{}";
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in input.json, proceeding with empty object");
    input = {};
  }

  const html = input?.OwnersAndGeneralInformation?.response || "";
  const $ = cheerio.load(html || "<html></html>");

  const propertyId = getPropertyId(input, $);

  const constrType = safeText($, "#MainImpRes1_lblConstrType");
  const extWall = safeText($, "#MainImpRes1_lblExtWall");
  const roofType = safeText($, "#MainImpRes1_lblRoofType");
  const roofMat = safeText($, "#MainImpRes1_lblRoofMat");
  const foundType = safeText($, "#MainImpRes1_lblFoundType");
  const livingAreaTxt = safeText($, "#MainImpRes1_lblLivingArea");
  const totalAreaTxt = safeText($, "#MainImpRes1_lblTotalArea");
  const storiesTxt = safeText($, "#MainImpRes1_lblNumStories");

  const livingArea = parseIntSafe(livingAreaTxt);
  const totalArea = parseIntSafe(totalAreaTxt) || livingArea;
  const numStories = mapStories(storiesTxt);

  const data = {
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
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: mapExtWall(extWall),
    exterior_wall_material_secondary: null,
    finished_base_area: livingArea && numStories === 1 ? livingArea : null,
    finished_basement_area: null,
    finished_upper_story_area:
      livingArea && numStories && numStories > 1
        ? (livingArea - livingArea / numStories) | 0
        : null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: mapFoundation(foundType),
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material:
      constrType && constrType.toUpperCase().includes("FRAME")
        ? "Wood Frame"
        : null,
    interior_wall_structure_material_primary:
      constrType && constrType.toUpperCase().includes("FRAME")
        ? "Wood Frame"
        : null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: null,
    number_of_stories: numStories,
    primary_framing_material:
      constrType && constrType.toUpperCase().includes("FRAME")
        ? "Wood Frame"
        : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCovering(roofMat),
    roof_date: null,
    roof_design_type: mapRoofType(roofType),
    roof_material_type:
      roofMat && roofMat.toUpperCase().includes("SHING") ? "Shingle" : null,
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

  // Ensure required fields exist and are within enums/null as per schema. Already set above.

  const out = {};
  out[`property_${propertyId}`] = data;

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Structure data written to", outPath);
}

if (require.main === module) {
  main();
}
