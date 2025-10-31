// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseNumber(val) {
  if (!val) return null;
  const num = String(val).replace(/[^0-9.\-]/g, "");
  if (!num) return null;
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  const h1 = $("section.title h1").first().text().trim();
  // Expect format: "Parcel 00-00-30-..."
  const m = h1.match(/Parcel\s+([0-9\-]+)/i);
  if (m) return m[1];
  // Fallback from title tag
  const title = $("title").text();
  const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
  if (m2) return m2[1];
  return "unknown";
}

function mapExteriorWallMaterial(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("STUC")) return "Stucco";
  if (d.includes("BRICK")) return "Brick";
  if (d.includes("STONE")) return "Natural Stone";
  if (d.includes("VINYL")) return "Vinyl Siding";
  if (d.includes("WD") || d.includes("WOOD")) return "Wood Siding";
  return null;
}

function mapFlooringPrimarySecondary(flooringDetails) {
  // Determine primary and secondary among observed flooring
  const types = new Set();
  for (const det of flooringDetails) {
    const d = (det || "").toUpperCase();
    if (d.includes("CARPET")) types.add("Carpet");
    if (d.includes("CLAY TILE") || d.includes("CERAMIC") || d.includes("TILE"))
      types.add("Ceramic Tile");
    if (d.includes("WOOD")) types.add("Solid Hardwood");
    if (d.includes("LAMINATE")) types.add("Laminate");
    if (d.includes("VINYL")) types.add("Luxury Vinyl Plank");
  }
  const ordered = Array.from(types);
  return {
    primary: ordered[0] || null,
    secondary: ordered[1] || null,
  };
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const propId = extractPropertyId($);

  // Gather structural elements table rows
  const seRows = [];
  $("div.se table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const type = $(tds[1]).text().trim();
    const details = $(tds[3]).text().trim();
    seRows.push({ type, details });
  });

  const findDetail = (label) => {
    const row = seRows.find(
      (r) => r.type.toLowerCase() === label.toLowerCase(),
    );
    return row ? row.details : null;
  };

  const exteriorWallDetail = findDetail("Exterior Wall");
  const interiorWallDetail = findDetail("Interior Wall");
  const frameDetail = findDetail("Frame");
  const storiesDetail = findDetail("Stories");
  const acDetail = findDetail("Air Conditioning");
  const heatDetail = findDetail("Heating Type");

  // Flooring details (could be multiple rows)
  const flooringDetails = seRows
    .filter((r) => r.type.toLowerCase() === "interior flooring")
    .map((r) => r.details);
  const { primary: flooring_primary, secondary: flooring_secondary } =
    mapFlooringPrimarySecondary(flooringDetails);

  // Roof fields
  const roofStructDetail =
    seRows.find((r) => r.type.toLowerCase() === "roof structure")?.details ||
    null;
  const roofCoverDetail =
    seRows.find((r) => r.type.toLowerCase() === "roof cover")?.details || null;

  // Base area from Sub Areas BAS row
  let finished_base_area = null;
  $("div.subareas table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const code = $(tds[0]).text().trim();
    if (code.includes("BAS")) {
      const gross = $(tds[1]).text().trim();
      finished_base_area = parseNumber(gross);
    }
  });

  // Stories
  let number_of_stories = null;
  if (storiesDetail) {
    const n = parseNumber(storiesDetail);
    number_of_stories = n || null;
  }

  // Map to schema fields
  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached", // Single family assumption
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
    exterior_wall_material_primary: mapExteriorWallMaterial(exteriorWallDetail),
    exterior_wall_material_secondary: null,
    finished_base_area: Number.isInteger(finished_base_area)
      ? finished_base_area
      : finished_base_area
        ? Math.round(finished_base_area)
        : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooring_primary || null,
    flooring_material_secondary: flooring_secondary || null,
    foundation_condition: "Unknown",
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
    interior_wall_structure_material:
      frameDetail && frameDetail.toUpperCase().includes("WOOD")
        ? "Wood Frame"
        : null,
    interior_wall_structure_material_primary:
      frameDetail && frameDetail.toUpperCase().includes("WOOD")
        ? "Wood Frame"
        : null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary:
      interiorWallDetail && interiorWallDetail.toUpperCase().includes("DRYWALL")
        ? "Drywall"
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: number_of_stories,
    primary_framing_material:
      frameDetail && frameDetail.toUpperCase().includes("WOOD")
        ? "Wood Frame"
        : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material:
      roofCoverDetail && roofCoverDetail.toUpperCase().includes("COMP")
        ? "3-Tab Asphalt Shingle"
        : null,
    roof_date: null,
    roof_design_type:
      roofStructDetail && roofStructDetail.toUpperCase().includes("IRREGULAR")
        ? "Combination"
        : null,
    roof_material_type:
      roofCoverDetail && roofCoverDetail.toUpperCase().includes("COMP")
        ? "Composition"
        : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: "Concrete Slab",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  const outObj = {};
  outObj[`property_${propId}`] = structure;

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/structure_data.json"),
    JSON.stringify(outObj, null, 2),
  );

  console.log("Wrote owners/structure_data.json for", propId);
}

run();
