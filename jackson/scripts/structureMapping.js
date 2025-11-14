// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE || textTrim($(s).find(".title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();

  if (!section.length) return buildings;
  
  $(section).find(".block-row").each((_, blockRow) => {
    const building = {};
    
    $(blockRow).find(".two-column-blocks").each((__, columnBlock) => {
      $(columnBlock).find("table tbody tr").each((___, tr) => {
        const label = textTrim($(tr).find("th strong").first().text()) || textTrim($(tr).find("td strong").first().text());
        const value = textTrim($(tr).find("td span").first().text());
        if (label) building[label] = value;
      });
    });
    
    if (Object.keys(building).length) buildings.push(building);
  });
  
  return buildings;
}

function mapExteriorPrimary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick";
  if (t.includes("STONE")) return "Natural Stone";
  if (t.includes("STUC")) return "Stucco";
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("CEDAR") || t.includes("WOOD")) return "Wood Siding";
  if (t.includes("FIBER") && t.includes("CEMENT")) return "Fiber Cement Siding";
  if (t.includes("METAL")) return "Metal Siding";
  if (t.includes("BLOCK") || t.includes("CONCRETE")) return "Concrete Block";
  if (t.includes("EIFS")) return "EIFS";
  if (t.includes("LOG")) return "Log";
  if (t.includes("ADOBE")) return "Adobe";
  return null;
}

function mapExteriorSecondary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick Accent";
  if (t.includes("STONE")) return "Stone Accent";
  if (t.includes("STUC")) return "Stucco Accent";
  if (t.includes("VINYL")) return "Vinyl Accent";
  if (t.includes("CEDAR") || t.includes("WOOD")) return "Wood Trim";
  if (t.includes("METAL")) return "Metal Trim";
  if (t.includes("BLOCK") || t.includes("CONCRETE")) return "Decorative Block";
  return null;
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("DRYWALL")) out.push("Drywall");
    if (t.includes("PLASTER")) out.push("Plaster");
    if (t.includes("WOOD")) out.push("Wood Paneling");
    if (t.includes("BRICK")) out.push("Exposed Brick");
    if (t.includes("BLOCK")) out.push("Exposed Block");
    if (t.includes("WAINSCOT")) out.push("Wainscoting");
    if (t.includes("SHIPLAP")) out.push("Shiplap");
    if (t.includes("BOARD") && t.includes("BATTEN")) out.push("Board and Batten");
    if (t.includes("TILE")) out.push("Tile");
    if (t.includes("STONE")) out.push("Stone Veneer");
    if (t.includes("METAL")) out.push("Metal Panels");
    if (t.includes("GLASS")) out.push("Glass Panels");
    if (t.includes("CONCRETE")) out.push("Concrete");
    if (t.includes("MINIMUM")) out.push("Drywall");
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("HARDWOOD") && t.includes("SOLID")) out.push("Solid Hardwood");
    if (t.includes("HARDWOOD") && t.includes("ENGINEERED")) out.push("Engineered Hardwood");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) out.push("Luxury Vinyl Plank");
    if (t.includes("VINYL") && !t.includes("LUXURY")) out.push("Sheet Vinyl");
    if (t.includes("CERAMIC")) out.push("Ceramic Tile");
    if (t.includes("PORCELAIN")) out.push("Porcelain Tile");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("CONCRETE") && t.includes("POLISHED")) out.push("Polished Concrete");
    if (t.includes("BAMBOO")) out.push("Bamboo");
    if (t.includes("CORK")) out.push("Cork");
    if (t.includes("LINOLEUM")) out.push("Linoleum");
    if (t.includes("TERRAZZO")) out.push("Terrazzo");
    if (t.includes("V C TILE")) out.push("Sheet Vinyl");
  });
  return out;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function determineAttachmentType(typeText) {
  if (!typeText) return null;
  const text = typeText.toUpperCase();
  if (text.includes("DUPLEX") || text.includes("SEMI DET")) return "SemiDetached";
  if (
    text.includes("ROW") ||
    text.includes("TOWN") ||
    text.includes("M/FAM") ||
    text.includes("MULTI") ||
    text.includes("APT") ||
    text.includes("CONDO")
  ) {
    return "Attached";
  }
  if (
    text.includes("SFR") ||
    text.includes("SINGLE") ||
    text.includes("DETACHED") ||
    text.includes("MF DET")
  ) {
    return "Detached";
  }
  return null;
}

function createStructureBase(parcelId) {
  return {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["1207"],
        LayerID: ["36374"],
        PageTypeID: ["4"],
        PageID: ["13872"],
        Q: ["47389550"],
        KeyValue: [parcelId]
      }
    },
    request_identifier: parcelId,
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
    building_number: null,
    structure_index: null
  };
}

function applyRoofDetails(structure, roofTokens) {
  if (!roofTokens.length) return;
  const u = roofTokens.join(" ").toUpperCase();
  if (u.includes("3-TAB") && u.includes("SHINGLE")) structure.roof_covering_material = "3-Tab Asphalt Shingle";
  else if (u.includes("SHINGLE")) structure.roof_covering_material = "Architectural Asphalt Shingle";
  if (u.includes("METAL") && (u.includes("STANDING") || u.includes("RIB"))) structure.roof_covering_material = "Metal Standing Seam";
  else if (u.includes("METAL") && u.includes("CORRUGATED")) structure.roof_covering_material = "Metal Corrugated";
  if (u.includes("CLAY") && u.includes("TILE")) structure.roof_covering_material = "Clay Tile";
  if (u.includes("CONCRETE") && u.includes("TILE")) structure.roof_covering_material = "Concrete Tile";
  if (u.includes("SLATE")) structure.roof_covering_material = "Natural Slate";
  if (u.includes("WOOD") && u.includes("SHAKE")) structure.roof_covering_material = "Wood Shake";
  if (u.includes("WOOD") && u.includes("SHINGLE")) structure.roof_covering_material = "Wood Shingle";
  if (u.includes("TPO")) structure.roof_covering_material = "TPO Membrane";
  if (u.includes("EPDM")) structure.roof_covering_material = "EPDM Membrane";

  if (u.includes("WOOD TRUSS")) structure.roof_structure_material = "Wood Truss";
  if (u.includes("WOOD RAFTER")) structure.roof_structure_material = "Wood Rafter";
  if (u.includes("STEEL TRUSS")) structure.roof_structure_material = "Steel Truss";
  if (u.includes("CONCRETE BEAM")) structure.roof_structure_material = "Concrete Beam";

  if (u.includes("GABLE")) structure.roof_design_type = "Gable";
  if (u.includes("HIP")) structure.roof_design_type = "Hip";
  if (u.includes("FLAT")) structure.roof_design_type = "Flat";
  if (u.includes("MANSARD")) structure.roof_design_type = "Mansard";
  if (u.includes("GAMBREL")) structure.roof_design_type = "Gambrel";
  if (u.includes("SHED")) structure.roof_design_type = "Shed";
}

function applyFramingDetails(structure, frameTokens) {
  if (!frameTokens.length) return;
  const frameStr = frameTokens.join(" ").toUpperCase();
  if (frameStr.includes("WOOD")) {
    structure.primary_framing_material = "Wood Frame";
    structure.interior_wall_structure_material = "Wood Frame";
    structure.interior_wall_structure_material_primary = "Wood Frame";
  }
  if (frameStr.includes("STEEL")) {
    structure.primary_framing_material = "Steel Frame";
    structure.interior_wall_structure_material = "Steel Frame";
    structure.interior_wall_structure_material_primary = "Steel Frame";
  }
  if (frameStr.includes("MASONRY")) {
    structure.primary_framing_material = "Masonry";
    structure.interior_wall_structure_material = "Concrete Block";
    structure.interior_wall_structure_material_primary = "Concrete Block";
  }
  if (frameStr.includes("CONCRETE")) {
    structure.primary_framing_material = "Poured Concrete";
    structure.interior_wall_structure_material = "Concrete Block";
    structure.interior_wall_structure_material_primary = "Concrete Block";
  }
}

function buildStructureFromBuilding(building, parcelId, buildingNumber, structureIndex) {
  const structure = createStructureBase(parcelId);
  structure.building_number = buildingNumber;
  structure.structure_index = structureIndex;
  structure.attachment_type = determineAttachmentType(building["Type"]);

  const extTokens = building["Exterior Walls"]
    ? building["Exterior Walls"].split(";").map((s) => s.trim())
    : [];
  if (extTokens.length) {
    structure.exterior_wall_material_primary = mapExteriorPrimary(extTokens[0]);
    if (extTokens.length > 1) structure.exterior_wall_material_secondary = mapExteriorSecondary(extTokens[1]);
  }

  const intWallTokens = building["Interior Walls"]
    ? building["Interior Walls"].split(";").map((s) => s.trim())
    : [];
  const intMaterials = mapInteriorSurface(intWallTokens);
  if (intMaterials.length) {
    structure.interior_wall_surface_material_primary = intMaterials[0];
    if (intMaterials.length > 1) structure.interior_wall_surface_material_secondary = intMaterials[1];
  }

  const floorTokens = building["Floor Cover"]
    ? building["Floor Cover"].split(";").map((s) => s.trim())
    : [];
  const floorMaterials = mapFlooring(floorTokens);
  if (floorMaterials.length) {
    structure.flooring_material_primary = floorMaterials[0];
    if (floorMaterials.length > 1) structure.flooring_material_secondary = floorMaterials[1];
  }

  const roofTokens = [];
  if (building["Roof Cover"]) roofTokens.push(building["Roof Cover"]);
  if (building["Roof Type"]) roofTokens.push(building["Roof Type"]);
  applyRoofDetails(structure, roofTokens);

  const frameTokens = building["Frame Type"] ? [building["Frame Type"]] : [];
  applyFramingDetails(structure, frameTokens);

  const stories = parseNumber(building["Stories"]);
  if (stories != null) structure.number_of_stories = stories;

  const heatedArea = parseNumber(building["Heated Area"]);
  const totalArea = parseNumber(building["Total Area"]);
  structure.finished_base_area = heatedArea || totalArea || null;

  return structure;
}

function buildStructuresFromBuildings(buildings, parcelId) {
  if (!buildings.length) {
    const structure = createStructureBase(parcelId);
    structure.structure_index = 1;
    structure.building_number = 1;
    return [structure];
  }

  const structures = [];
  buildings.forEach((building, idx) => {
    structures.push(
      buildStructureFromBuilding(building, parcelId, idx + 1, idx + 1),
    );
  });
  return structures;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($);
  const structures = buildStructuresFromBuildings(buildings, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { structures };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${structures.length} structures`);
}

if (require.main === module) {
  main();
}
