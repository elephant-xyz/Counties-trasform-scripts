// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Buildings";

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

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function tokenize(value) {
  if (!value) return [];
  return String(value)
    .split(/[;,/&]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("STONE")) out.push("Natural Stone");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("FIBER") && t.includes("CEMENT")) out.push("Fiber Cement Siding");
    if (t.includes("METAL")) out.push("Metal Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
    if (t.includes("EIFS")) out.push("EIFS");
    if (t.includes("LOG")) out.push("Log");
    if (t.includes("ADOBE")) out.push("Adobe");
    if (t.includes("BD/BATTEN") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("CONC BLOCK")) out.push("Concrete Block");
  });
  return uniqueValues(out);
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
  return uniqueValues(out);
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
  return uniqueValues(out);
}

function mapExteriorWallMaterialPrimary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick";
  if (t.includes("STONE") && !t.includes("MANUFACTURED")) return "Natural Stone";
  if (t.includes("MANUFACTURED") && t.includes("STONE")) return "Manufactured Stone";
  if (t.includes("STUC")) return "Stucco";
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("CEDAR") || t.includes("WOOD")) return "Wood Siding";
  if (t.includes("FIBER") && t.includes("CEMENT")) return "Fiber Cement Siding";
  if (t.includes("METAL")) return "Metal Siding";
  if (t.includes("BLOCK") || t.includes("CONCRETE")) return "Concrete Block";
  if (t.includes("EIFS")) return "EIFS";
  if (t.includes("LOG")) return "Log";
  if (t.includes("ADOBE")) return "Adobe";
  if (t.includes("PRECAST") && t.includes("CONCRETE")) return "Precast Concrete";
  if (t.includes("CURTAIN") && t.includes("WALL")) return "Curtain Wall";
  return null;
}

function mapExteriorWallMaterialSecondary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("BRICK") && t.includes("ACCENT")) return "Brick Accent";
  if (t.includes("STONE") && t.includes("ACCENT")) return "Stone Accent";
  if (t.includes("WOOD") && t.includes("TRIM")) return "Wood Trim";
  if (t.includes("METAL") && t.includes("TRIM")) return "Metal Trim";
  if (t.includes("STUCCO") && t.includes("ACCENT")) return "Stucco Accent";
  if (t.includes("VINYL") && t.includes("ACCENT")) return "Vinyl Accent";
  if (t.includes("DECORATIVE") && t.includes("BLOCK")) return "Decorative Block";
  return null;
}

function mapInteriorWallSurfaceMaterialPrimary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("DRYWALL")) return "Drywall";
  if (t.includes("PLASTER")) return "Plaster";
  if (t.includes("WOOD")) return "Wood Paneling";
  if (t.includes("BRICK")) return "Exposed Brick";
  if (t.includes("BLOCK")) return "Exposed Block";
  if (t.includes("WAINSCOT")) return "Wainscoting";
  if (t.includes("SHIPLAP")) return "Shiplap";
  if (t.includes("BOARD") && t.includes("BATTEN")) return "Board and Batten";
  if (t.includes("TILE")) return "Tile";
  if (t.includes("STONE")) return "Stone Veneer";
  if (t.includes("METAL")) return "Metal Panels";
  if (t.includes("GLASS")) return "Glass Panels";
  if (t.includes("CONCRETE")) return "Concrete";
  if (t.includes("MINIMUM")) return "Drywall";
  return null;
}

function mapInteriorWallSurfaceMaterialSecondary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("WAINSCOTING")) return "Wainscoting";
  if (t.includes("CHAIR") && t.includes("RAIL")) return "Chair Rail";
  if (t.includes("CROWN") && t.includes("MOLDING")) return "Crown Molding";
  if (t.includes("BASEBOARDS")) return "Baseboards";
  if (t.includes("WOOD") && t.includes("TRIM")) return "Wood Trim";
  if (t.includes("STONE") && t.includes("ACCENT")) return "Stone Accent";
  if (t.includes("TILE") && t.includes("ACCENT")) return "Tile Accent";
  if (t.includes("METAL") && t.includes("ACCENT")) return "Metal Accent";
  if (t.includes("GLASS") && t.includes("INSERT")) return "Glass Insert";
  if (t.includes("DECORATIVE") && t.includes("PANELS")) return "Decorative Panels";
  if (t.includes("FEATURE") && t.includes("WALL")) return "Feature Wall Material";
  return null;
}

function mapFlooringMaterialPrimary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("HARDWOOD") && t.includes("SOLID")) return "Solid Hardwood";
  if (t.includes("HARDWOOD") && t.includes("ENGINEERED")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) return "Luxury Vinyl Plank";
  if (t.includes("VINYL") && !t.includes("LUXURY")) return "Sheet Vinyl";
  if (t.includes("CERAMIC")) return "Ceramic Tile";
  if (t.includes("PORCELAIN")) return "Porcelain Tile";
  if (t.includes("STONE")) return "Natural Stone Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUGS")) return "Area Rugs";
  if (t.includes("CONCRETE") && t.includes("POLISHED")) return "Polished Concrete";
  if (t.includes("BAMBOO")) return "Bamboo";
  if (t.includes("CORK")) return "Cork";
  if (t.includes("LINOLEUM")) return "Linoleum";
  if (t.includes("TERRAZZO")) return "Terrazzo";
  if (t.includes("EPOXY") && t.includes("COATING")) return "Epoxy Coating";
  if (t.includes("V C TILE")) return "Sheet Vinyl";
  return null;
}

function mapFlooringMaterialSecondary(token) {
  const t = token.toUpperCase().trim();
  if (t.includes("HARDWOOD") && t.includes("SOLID")) return "Solid Hardwood";
  if (t.includes("HARDWOOD") && t.includes("ENGINEERED")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) return "Luxury Vinyl Plank";
  if (t.includes("CERAMIC")) return "Ceramic Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUGS")) return "Area Rugs";
  if (t.includes("TRANSITION") && t.includes("STRIPS")) return "Transition Strips";
  return null;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function defaultStructure(parcelId) {
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
    number_of_buildings: null,
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
  };
}

function applyRoofDetails(structure, roofCover, roofType) {
  const combined = [roofCover, roofType].filter(Boolean).join(" ").toUpperCase();
  if (!combined) return;

  if (combined.includes("3-TAB") && combined.includes("SHINGLE")) structure.roof_covering_material = "3-Tab Asphalt Shingle";
  else if (combined.includes("SHINGLE")) structure.roof_covering_material = "Architectural Asphalt Shingle";
  if (combined.includes("METAL") && (combined.includes("STANDING") || combined.includes("RIB"))) structure.roof_covering_material = "Metal Standing Seam";
  else if (combined.includes("METAL") && combined.includes("CORRUGATED")) structure.roof_covering_material = "Metal Corrugated";
  if (combined.includes("CLAY") && combined.includes("TILE")) structure.roof_covering_material = "Clay Tile";
  if (combined.includes("CONCRETE") && combined.includes("TILE")) structure.roof_covering_material = "Concrete Tile";
  if (combined.includes("SLATE") && combined.includes("NATURAL")) structure.roof_covering_material = "Natural Slate";
  else if (combined.includes("SLATE") && combined.includes("SYNTHETIC")) structure.roof_covering_material = "Synthetic Slate";
  else if (combined.includes("SLATE")) structure.roof_covering_material = "Natural Slate";
  if (combined.includes("WOOD") && combined.includes("SHAKE")) structure.roof_covering_material = "Wood Shake";
  if (combined.includes("WOOD") && combined.includes("SHINGLE")) structure.roof_covering_material = "Wood Shingle";
  if (combined.includes("TPO")) structure.roof_covering_material = "TPO Membrane";
  if (combined.includes("EPDM")) structure.roof_covering_material = "EPDM Membrane";
  if (combined.includes("MODIFIED") && combined.includes("BITUMEN")) structure.roof_covering_material = "Modified Bitumen";
  if (combined.includes("BUILT") && combined.includes("UP")) structure.roof_covering_material = "Built-Up Roof";
  if (combined.includes("GREEN") && combined.includes("ROOF")) structure.roof_covering_material = "Green Roof System";
  if (combined.includes("SOLAR") && combined.includes("INTEGRATED")) structure.roof_covering_material = "Solar Integrated Tiles";

  if (combined.includes("WOOD TRUSS")) structure.roof_structure_material = "Wood Truss";
  if (combined.includes("WOOD RAFTER")) structure.roof_structure_material = "Wood Rafter";
  if (combined.includes("STEEL TRUSS")) structure.roof_structure_material = "Steel Truss";
  if (combined.includes("CONCRETE BEAM")) structure.roof_structure_material = "Concrete Beam";
  if (combined.includes("ENGINEERED LUMBER") || combined.includes("ENGINEERED WOOD")) structure.roof_structure_material = "Engineered Lumber";

  if (combined.includes("GABLE")) structure.roof_design_type = "Gable";
  if (combined.includes("HIP")) structure.roof_design_type = "Hip";
  if (combined.includes("FLAT")) structure.roof_design_type = "Flat";
  if (combined.includes("MANSARD")) structure.roof_design_type = "Mansard";
  if (combined.includes("GAMBREL")) structure.roof_design_type = "Gambrel";
  if (combined.includes("SHED")) structure.roof_design_type = "Shed";
  if (combined.includes("SALTBOX")) structure.roof_design_type = "Saltbox";
  if (combined.includes("BUTTERFLY")) structure.roof_design_type = "Butterfly";
  if (combined.includes("BONNET")) structure.roof_design_type = "Bonnet";
  if (combined.includes("CLERESTORY")) structure.roof_design_type = "Clerestory";
  if (combined.includes("DOME")) structure.roof_design_type = "Dome";
  if (combined.includes("BARREL")) structure.roof_design_type = "Barrel";
  if (combined.includes("COMBINATION")) structure.roof_design_type = "Combination";
}

function applyFramingDetails(structure, frameValue) {
  const frameStr = (frameValue || "").toUpperCase();
  if (!frameStr) return;

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

function buildStructureForBuilding(building, parcelId, index, totalBuildings) {
  const structure = defaultStructure(parcelId);
  structure.request_identifier = `${parcelId}_structure_${index + 1}`;
  structure.number_of_buildings = null;
  structure.building_number = index + 1;

  const totalArea = parseNumber(building["Total Area"]);
  const heatedArea = parseNumber(building["Heated Area"]);
  structure.finished_base_area = totalArea;
  if (heatedArea != null && totalArea != null && heatedArea > totalArea) {
    structure.finished_upper_story_area = heatedArea - totalArea;
  }

  const stories = parseNumber(building["Stories"]);
  if (stories != null) {
    structure.number_of_stories = stories;
  }

  const exteriorTokens = tokenize(building["Exterior Walls"]);
  if (exteriorTokens.length) {
    structure.exterior_wall_material_primary = mapExteriorWallMaterialPrimary(exteriorTokens[0]) || null;
    if (exteriorTokens.length > 1) {
      structure.exterior_wall_material_secondary = mapExteriorWallMaterialSecondary(exteriorTokens[1]) || null;
    }
  }

  const interiorTokens = tokenize(building["Interior Walls"]);
  if (interiorTokens.length) {
    structure.interior_wall_surface_material_primary = mapInteriorWallSurfaceMaterialPrimary(interiorTokens[0]) || null;
    if (interiorTokens.length > 1) {
      structure.interior_wall_surface_material_secondary = mapInteriorWallSurfaceMaterialSecondary(interiorTokens[1]) || null;
    }
  }

  const flooringTokens = tokenize(building["Floor Cover"]);
  if (flooringTokens.length) {
    structure.flooring_material_primary = mapFlooringMaterialPrimary(flooringTokens[0]) || null;
    if (flooringTokens.length > 1) {
      structure.flooring_material_secondary = mapFlooringMaterialSecondary(flooringTokens[1]) || null;
    }
  }

  applyRoofDetails(structure, building["Roof Cover"], building["Roof Type"]);
  applyFramingDetails(structure, building["Frame Type"]);

  return structure;
}

function buildStructuresFromBuildings(buildings, parcelId) {
  const totalBuildings = buildings.length;
  const structures = buildings.map((building, index) =>
    buildStructureForBuilding(building, parcelId, index, totalBuildings),
  );

  return structures;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  // if (!parcelId) {
  //   throw new Error("Parcel ID not found");
  // }
  const buildings = collectBuildings($);
  const structures = buildStructuresFromBuildings(buildings, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { structures };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${structures.length} structures to ${outPath}`);
}

if (require.main === module) {
  main();
}
