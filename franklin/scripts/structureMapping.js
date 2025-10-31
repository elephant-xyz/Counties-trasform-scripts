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
  if (d.includes("BRICK") || d.includes("BRK") ) return "Brick";
  if (d.includes("NATURAL STONE")) return "Natural Stone";
  if (d.includes("MANUFACTURED STONE")) return "Manufactured Stone";
  if (d.includes("STUC")) return "Stucco";
  if (d.includes("VINYL")) return "Vinyl Siding";
  if (d.includes("WD") || d.includes("WOOD")) return "Wood Siding";
  if (d.includes("FIBER CEMENT")) return "Fiber Cement Siding";
  if (d.includes("METAL")) return "Metal Siding";
  if (d.includes("CONCRETE BLOCK")) return "Concrete Block";
  if (d.includes("EIFS")) return "EIFS";
  if (d.includes("LOG")) return "Log";
  if (d.includes("ADOBE")) return "Adobe";
  if (d.includes("PRECAST CONCRETE")) return "Precast Concrete";
  if (d.includes("CURTAIN WALL")) return "Curtain Wall";
  return null;
}

function mapRoofCoveringMaterial(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("3-TAB") || d.includes("3 TAB")) return "3-Tab Asphalt Shingle";
  if (d.includes("ARCHITECTURAL")) return "Architectural Asphalt Shingle";
  if (d.includes("METAL STANDING SEAM")) return "Metal Standing Seam";
  if (d.includes("METAL CORRUGATED")) return "Metal Corrugated";
  if (d.includes("CLAY TILE")) return "Clay Tile";
  if (d.includes("CONCRETE TILE")) return "Concrete Tile";
  if (d.includes("NATURAL SLATE")) return "Natural Slate";
  if (d.includes("SYNTHETIC SLATE")) return "Synthetic Slate";
  if (d.includes("WOOD SHAKE")) return "Wood Shake";
  if (d.includes("WOOD SHINGLE")) return "Wood Shingle";
  if (d.includes("TPO")) return "TPO Membrane";
  if (d.includes("EPDM")) return "EPDM Membrane";
  if (d.includes("MODIFIED BITUMEN")) return "Modified Bitumen";
  if (d.includes("BUILT-UP") || d.includes("BUILT UP")) return "Built-Up Roof";
  if (d.includes("GREEN ROOF")) return "Green Roof System";
  if (d.includes("SOLAR INTEGRATED")) return "Solar Integrated Tiles";
  if (d.includes("COMP")) return "3-Tab Asphalt Shingle";
  return null;
}

function mapRoofDesignType(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("GABLE")) return "Gable";
  if (d.includes("HIP")) return "Hip";
  if (d.includes("FLAT")) return "Flat";
  if (d.includes("MANSARD")) return "Mansard";
  if (d.includes("GAMBREL")) return "Gambrel";
  if (d.includes("SHED")) return "Shed";
  if (d.includes("SALTBOX")) return "Saltbox";
  if (d.includes("BUTTERFLY")) return "Butterfly";
  if (d.includes("BONNET")) return "Bonnet";
  if (d.includes("CLERESTORY")) return "Clerestory";
  if (d.includes("DOME")) return "Dome";
  if (d.includes("BARREL")) return "Barrel";
  if (d.includes("IRREGULAR") || d.includes("COMBINATION")) return "Combination";
  return null;
}

function mapInteriorWallSurfaceMaterial(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("DRYWALL")) return "Drywall";
  if (d.includes("PLASTER")) return "Plaster";
  if (d.includes("WOOD PANELING")) return "Wood Paneling";
  if (d.includes("EXPOSED BRICK")) return "Exposed Brick";
  if (d.includes("EXPOSED BLOCK")) return "Exposed Block";
  if (d.includes("WAINSCOTING")) return "Wainscoting";
  if (d.includes("SHIPLAP")) return "Shiplap";
  if (d.includes("BOARD AND BATTEN")) return "Board and Batten";
  if (d.includes("TILE")) return "Tile";
  if (d.includes("STONE VENEER")) return "Stone Veneer";
  if (d.includes("METAL PANELS")) return "Metal Panels";
  if (d.includes("GLASS PANELS")) return "Glass Panels";
  if (d.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapFlooringMaterialPrimary(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("SOLID HARDWOOD")) return "Solid Hardwood";
  if (d.includes("ENGINEERED HARDWOOD")) return "Engineered Hardwood";
  if (d.includes("LAMINATE")) return "Laminate";
  if (d.includes("LUXURY VINYL PLANK")) return "Luxury Vinyl Plank";
  if (d.includes("SHEET VINYL")) return "Sheet Vinyl";
  if (d.includes("CERAMIC TILE") || d.includes("CERAMIC")) return "Ceramic Tile";
  if (d.includes("PORCELAIN TILE")) return "Porcelain Tile";
  if (d.includes("NATURAL STONE TILE")) return "Natural Stone Tile";
  if (d.includes("CARPET")) return "Carpet";
  if (d.includes("AREA RUGS")) return "Area Rugs";
  if (d.includes("POLISHED CONCRETE")) return "Polished Concrete";
  if (d.includes("BAMBOO")) return "Bamboo";
  if (d.includes("CORK")) return "Cork";
  if (d.includes("LINOLEUM")) return "Linoleum";
  if (d.includes("TERRAZZO")) return "Terrazzo";
  if (d.includes("EPOXY COATING")) return "Epoxy Coating";
  if (d.includes("WOOD")) return "Solid Hardwood";
  if (d.includes("TILE")) return "Ceramic Tile";
  if (d.includes("VINYL")) return "Luxury Vinyl Plank";
  return null;
}

function mapFlooringMaterialSecondary(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("SOLID HARDWOOD")) return "Solid Hardwood";
  if (d.includes("ENGINEERED HARDWOOD")) return "Engineered Hardwood";
  if (d.includes("LAMINATE")) return "Laminate";
  if (d.includes("LUXURY VINYL PLANK")) return "Luxury Vinyl Plank";
  if (d.includes("CERAMIC TILE") || d.includes("CERAMIC")) return "Ceramic Tile";
  if (d.includes("CARPET")) return "Carpet";
  if (d.includes("AREA RUGS")) return "Area Rugs";
  if (d.includes("TRANSITION STRIPS")) return "Transition Strips";
  if (d.includes("WOOD")) return "Solid Hardwood";
  if (d.includes("TILE")) return "Ceramic Tile";
  if (d.includes("VINYL")) return "Luxury Vinyl Plank";
  return null;
}

function mapInteriorWallStructureMaterial(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("WOOD FRAME") || d.includes("WOOD")) return "Wood Frame";
  if (d.includes("STEEL FRAME") || d.includes("STEEL")) return "Steel Frame";
  if (d.includes("CONCRETE BLOCK")) return "Concrete Block";
  if (d.includes("BRICK")) return "Brick";
  if (d.includes("LOAD BEARING")) return "Load Bearing";
  if (d.includes("NON-LOAD BEARING") || d.includes("NON LOAD BEARING")) return "Non-Load Bearing";
  return null;
}

function mapRoofMaterialType(detail) {
  if (!detail) return null;
  const d = detail.toUpperCase();
  if (d.includes("SHINGLE")) return "Shingle";
  if (d.includes("COMPOSITION") || d.includes("COMP")) return "Composition";
  if (d.includes("METAL")) return "Metal";
  if (d.includes("TILE")) return "Tile";
  if (d.includes("CERAMIC")) return "CeramicTile";
  if (d.includes("CONCRETE")) return "Concrete";
  if (d.includes("WOOD")) return "Wood";
  if (d.includes("STONE")) return "Stone";
  if (d.includes("BRICK")) return "Brick";
  if (d.includes("GLASS")) return "Glass";
  if (d.includes("VINYL")) return "Vinyl";
  if (d.includes("LAMINATE")) return "Laminate";
  if (d.includes("MARBLE")) return "Marble";
  if (d.includes("TERAZZO")) return "Terazzo";
  if (d.includes("MANUFACTURED")) return "Manufactured";
  if (d.includes("ENGINEERED")) return "EngineeredWood";
  return null;
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
  const flooring_primary = mapFlooringMaterialPrimary(flooringDetails[0]);
  const flooring_secondary = mapFlooringMaterialSecondary(flooringDetails[1]);

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
    attachment_type: null, // Single family assumption
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
    flooring_material_primary: flooring_primary,
    flooring_material_secondary: flooring_secondary,
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
    interior_wall_structure_material: mapInteriorWallStructureMaterial(frameDetail),
    interior_wall_structure_material_primary:
      frameDetail && frameDetail.toUpperCase().includes("WOOD")
        ? "Wood Frame"
        : null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: mapInteriorWallSurfaceMaterial(interiorWallDetail),
    interior_wall_surface_material_secondary: null,
    number_of_stories: number_of_stories,
    primary_framing_material:
      frameDetail && frameDetail.toUpperCase().includes("WOOD")
        ? "Wood Frame"
        : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCoveringMaterial(roofCoverDetail),
    roof_date: null,
    roof_design_type: mapRoofDesignType(roofStructDetail),
    roof_material_type: mapRoofMaterialType(roofCoverDetail),
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
