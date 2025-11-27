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

function mapExteriorMaterials(tokens) {
  const out = [];
  const add = (val) => {
    if (val && !out.includes(val)) out.push(val);
  };
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) add("Brick");
    if (t.includes("STONE")) add("Natural Stone");
    if (t.includes("STUC")) add("Stucco");
    if (t.includes("VINYL")) add("Vinyl Siding");
    if (t.includes("CEDAR") || t.includes("WOOD")) add("Wood Siding");
    if (t.includes("FIBER") && t.includes("CEMENT")) add("Fiber Cement Siding");
    if (t.includes("METAL")) add("Metal Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) add("Concrete Block");
    if (t.includes("EIFS")) add("EIFS");
    if (t.includes("LOG")) add("Log");
    if (t.includes("ADOBE")) add("Adobe");
    if (t.includes("BD/BATTEN")) add("Wood Siding");
    if (t.includes("CONC BLOCK")) add("Concrete Block");
  });
  return out;
}

function mapInteriorSurface(tokens) {
  const out = [];
  const add = (val) => {
    if (val && !out.includes(val)) out.push(val);
  };
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("DRYWALL") || t.includes("MINIMUM")) add("Drywall");
    if (t.includes("PLASTER")) add("Plaster");
    if (t.includes("WOOD")) add("Wood Paneling");
    if (t.includes("BRICK")) add("Exposed Brick");
    if (t.includes("BLOCK")) add("Exposed Block");
    if (t.includes("WAINSCOT")) add("Wainscoting");
    if (t.includes("SHIPLAP")) add("Shiplap");
    if (t.includes("BOARD") && t.includes("BATTEN")) add("Board and Batten");
    if (t.includes("TILE")) add("Tile");
    if (t.includes("STONE")) add("Stone Veneer");
    if (t.includes("METAL")) add("Metal Panels");
    if (t.includes("GLASS")) add("Glass Panels");
    if (t.includes("CONCRETE")) add("Concrete");
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  const add = (val) => {
    if (val && !out.includes(val)) out.push(val);
  };
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("HARDWOOD") && t.includes("SOLID")) add("Solid Hardwood");
    if (t.includes("HARDWOOD") && t.includes("ENGINEERED")) add("Engineered Hardwood");
    if (t.includes("LAMINATE")) add("Laminate");
    if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) add("Luxury Vinyl Plank");
    if (t.includes("VINYL") && !t.includes("LUXURY")) add("Sheet Vinyl");
    if (t.includes("CERAMIC")) add("Ceramic Tile");
    if (t.includes("PORCELAIN")) add("Porcelain Tile");
    if (t.includes("STONE")) add("Natural Stone Tile");
    if (t.includes("CARPET")) add("Carpet");
    if (t.includes("CONCRETE") && t.includes("POLISHED")) add("Polished Concrete");
    if (t.includes("BAMBOO")) add("Bamboo");
    if (t.includes("CORK")) add("Cork");
    if (t.includes("LINOLEUM")) add("Linoleum");
    if (t.includes("TERRAZZO")) add("Terrazzo");
    if (t.includes("V C TILE")) add("Sheet Vinyl");
  });
  return out;
}

function mapRoofCoveringMaterialFromText(text) {
  if (!text) return null;
  if (text.includes("3-TAB") && text.includes("SHINGLE")) return "3-Tab Asphalt Shingle";
  if (text.includes("ARCHITECT") && text.includes("SHINGLE")) return "Architectural Asphalt Shingle";
  if (text.includes("SHINGLE")) return "Architectural Asphalt Shingle";
  if (text.includes("STANDING") && text.includes("METAL")) return "Metal Standing Seam";
  if (text.includes("RIB") && text.includes("METAL")) return "Metal Standing Seam";
  if (text.includes("METAL") && text.includes("CORRUGATED")) return "Metal Corrugated";
  if (text.includes("METAL")) return "Metal Standing Seam";
  if (text.includes("CLAY") && text.includes("TILE")) return "Clay Tile";
  if (text.includes("CONCRETE") && text.includes("TILE")) return "Concrete Tile";
  if (text.includes("SLATE")) return "Natural Slate";
  if (text.includes("WOOD") && text.includes("SHAKE")) return "Wood Shake";
  if (text.includes("WOOD") && text.includes("SHINGLE")) return "Wood Shingle";
  if (text.includes("TPO")) return "TPO Membrane";
  if (text.includes("EPDM")) return "EPDM Membrane";
  if (text.includes("MODIFIED") && text.includes("BITUMEN")) return "Modified Bitumen";
  if (text.includes("BUILT") && text.includes("UP")) return "Built-Up Roof";
  return null;
}

function mapRoofStructureMaterialFromText(text) {
  if (!text) return null;
  if (text.includes("WOOD") && text.includes("TRUSS")) return "Wood Truss";
  if (text.includes("WOOD") && text.includes("RAFTER")) return "Wood Rafter";
  if (text.includes("STEEL") && text.includes("TRUSS")) return "Steel Truss";
  if (text.includes("CONCRETE") && text.includes("BEAM")) return "Concrete Beam";
  if (text.includes("ENGINEERED") && text.includes("LUMBER")) return "Engineered Lumber";
  if (text.includes("LVL") || text.includes("LAMINATED") || text.includes("GLULAM")) return "Engineered Lumber";
  return null;
}

function mapRoofDesignTypeFromText(text) {
  if (!text) return null;
  if (text.includes("GABLE")) return "Gable";
  if (text.includes("HIP")) return "Hip";
  if (text.includes("FLAT")) return "Flat";
  if (text.includes("MANSARD")) return "Mansard";
  if (text.includes("GAMBREL")) return "Gambrel";
  if (text.includes("SHED")) return "Shed";
  if (text.includes("SALTBOX")) return "Saltbox";
  if (text.includes("BUTTERFLY")) return "Butterfly";
  if (text.includes("BONNET")) return "Bonnet";
  if (text.includes("CLERESTORY")) return "Clerestory";
  if (text.includes("DOME")) return "Dome";
  if (text.includes("BARREL")) return "Barrel";
  return null;
}

function mapPrimaryFramingMaterialFromText(text) {
  if (!text) return null;
  if (text.includes("ENGINEERED") && text.includes("LUMBER")) return "Engineered Lumber";
  if (text.includes("LVL") || text.includes("LAMINATED") || text.includes("GLULAM")) return "Engineered Lumber";
  if (text.includes("POST") && text.includes("BEAM")) return "Post and Beam";
  if (text.includes("LOG")) return "Log Construction";
  if (text.includes("WOOD")) return "Wood Frame";
  if (text.includes("STEEL")) return "Steel Frame";
  if (text.includes("MASONRY")) return "Masonry";
  if (text.includes("CONCRETE") && text.includes("BLOCK")) return "Concrete Block";
  if (text.includes("CONCRETE")) return "Poured Concrete";
  return null;
}

function mapExteriorWallMaterialPrimary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("BRICK")) return "Brick";
  if (t.includes("STONE") && !t.includes("MANUFACTURED")) return "Natural Stone";
  if (t.includes("MANUFACTURED") && t.includes("STONE")) return "Manufactured Stone";
  if (t.includes("STUCCO")) return "Stucco";
  if (t.includes("VINYL") && t.includes("SIDING")) return "Vinyl Siding";
  if (t.includes("WOOD") && t.includes("SIDING")) return "Wood Siding";
  if (t.includes("FIBER") && t.includes("CEMENT")) return "Fiber Cement Siding";
  if (t.includes("METAL") && t.includes("SIDING")) return "Metal Siding";
  if (t.includes("CONCRETE") && t.includes("BLOCK")) return "Concrete Block";
  if (t.includes("EIFS")) return "EIFS";
  if (t.includes("LOG")) return "Log";
  if (t.includes("ADOBE")) return "Adobe";
  if (t.includes("PRECAST") && t.includes("CONCRETE")) return "Precast Concrete";
  if (t.includes("CURTAIN") && t.includes("WALL")) return "Curtain Wall";
  return null;
}

function mapExteriorWallMaterialSecondary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("BRICK") && t.includes("ACCENT")) return "Brick Accent";
  if (t.includes("STONE") && t.includes("ACCENT")) return "Stone Accent";
  if (t.includes("WOOD") && t.includes("TRIM")) return "Wood Trim";
  if (t.includes("METAL") && t.includes("TRIM")) return "Metal Trim";
  if (t.includes("STUCCO") && t.includes("ACCENT")) return "Stucco Accent";
  if (t.includes("VINYL") && t.includes("ACCENT")) return "Vinyl Accent";
  if (t.includes("DECORATIVE") && t.includes("BLOCK")) return "Decorative Block";
  return null;
}

function mapInteriorWallSurfaceMaterialPrimary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("DRYWALL")) return "Drywall";
  if (t.includes("PLASTER")) return "Plaster";
  if (t.includes("WOOD") && t.includes("PANELING")) return "Wood Paneling";
  if (t.includes("EXPOSED") && t.includes("BRICK")) return "Exposed Brick";
  if (t.includes("EXPOSED") && t.includes("BLOCK")) return "Exposed Block";
  if (t.includes("WAINSCOTING")) return "Wainscoting";
  if (t.includes("SHIPLAP")) return "Shiplap";
  if (t.includes("BOARD") && t.includes("BATTEN")) return "Board and Batten";
  if (t.includes("TILE")) return "Tile";
  if (t.includes("STONE") && t.includes("VENEER")) return "Stone Veneer";
  if (t.includes("METAL") && t.includes("PANELS")) return "Metal Panels";
  if (t.includes("GLASS") && t.includes("PANELS")) return "Glass Panels";
  if (t.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapInteriorWallSurfaceMaterialSecondary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
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

function mapFlooringMaterialPrimary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("SOLID") && t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("ENGINEERED") && t.includes("HARDWOOD")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LUXURY") && t.includes("VINYL") && t.includes("PLANK")) return "Luxury Vinyl Plank";
  if (t.includes("SHEET") && t.includes("VINYL")) return "Sheet Vinyl";
  if (t.includes("CERAMIC") && t.includes("TILE")) return "Ceramic Tile";
  if (t.includes("PORCELAIN") && t.includes("TILE")) return "Porcelain Tile";
  if (t.includes("NATURAL") && t.includes("STONE") && t.includes("TILE")) return "Natural Stone Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUGS")) return "Area Rugs";
  if (t.includes("POLISHED") && t.includes("CONCRETE")) return "Polished Concrete";
  if (t.includes("BAMBOO")) return "Bamboo";
  if (t.includes("CORK")) return "Cork";
  if (t.includes("LINOLEUM")) return "Linoleum";
  if (t.includes("TERRAZZO")) return "Terrazzo";
  if (t.includes("EPOXY") && t.includes("COATING")) return "Epoxy Coating";
  return null;
}

function mapFlooringMaterialSecondary(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("SOLID") && t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("ENGINEERED") && t.includes("HARDWOOD")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LUXURY") && t.includes("VINYL") && t.includes("PLANK")) return "Luxury Vinyl Plank";
  if (t.includes("CERAMIC") && t.includes("TILE")) return "Ceramic Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUGS")) return "Area Rugs";
  if (t.includes("TRANSITION") && t.includes("STRIPS")) return "Transition Strips";
  return null;
}

function mapInteriorStructureMaterialFromFrame(primaryMaterial) {
  if (!primaryMaterial) return null;
  if (primaryMaterial === "Wood Frame") return "Wood Frame";
  if (primaryMaterial === "Steel Frame") return "Steel Frame";
  if (primaryMaterial === "Concrete Block" || primaryMaterial === "Poured Concrete" || primaryMaterial === "Masonry")
    return "Concrete Block";
  if (primaryMaterial === "Log Construction") return "Wood Frame";
  if (primaryMaterial === "Post and Beam") return "Wood Frame";
  return null;
}

function splitTokens(value) {
  if (!value) return [];
  return String(value)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function createStructureBase(parcelId, buildingNumber, structureIndex) {
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
    building_number: buildingNumber,
    structure_index: structureIndex,
  };
}

function buildStructureRecords(buildings, parcelId) {
  const totalBuildings = buildings.length;
  const structures = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const rec = createStructureBase(parcelId, buildingNumber, buildingNumber);
    rec.number_of_buildings = totalBuildings || null;

    const extTokens = splitTokens(building["Exterior Walls"]);
    if (extTokens.length) {
      rec.exterior_wall_material_primary = mapExteriorWallMaterialPrimary(extTokens[0]) || null;
      if (extTokens.length > 1) {
        rec.exterior_wall_material_secondary = mapExteriorWallMaterialSecondary(extTokens[1]) || null;
      }
    }

    const intTokens = splitTokens(building["Interior Walls"]);
    if (intTokens.length) {
      rec.interior_wall_surface_material_primary = mapInteriorWallSurfaceMaterialPrimary(intTokens[0]) || null;
      if (intTokens.length > 1) {
        rec.interior_wall_surface_material_secondary = mapInteriorWallSurfaceMaterialSecondary(intTokens[1]) || null;
      }
    }

    const floorTokens = splitTokens(building["Floor Cover"]);
    if (floorTokens.length) {
      rec.flooring_material_primary = mapFlooringMaterialPrimary(floorTokens[0]) || null;
      if (floorTokens.length > 1) {
        rec.flooring_material_secondary = mapFlooringMaterialSecondary(floorTokens[1]) || null;
      }
    }

    const roofText = [building["Roof Cover"], building["Roof Type"]]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    if (roofText) {
      rec.roof_covering_material = mapRoofCoveringMaterialFromText(roofText);
      rec.roof_structure_material = mapRoofStructureMaterialFromText(roofText);
      rec.roof_design_type = mapRoofDesignTypeFromText(roofText);
    }

    const frameText = (building["Frame Type"] || "").toUpperCase();
    if (frameText) {
      const primaryFrame = mapPrimaryFramingMaterialFromText(frameText);
      if (primaryFrame) {
        rec.primary_framing_material = primaryFrame;
        const interiorStructure = mapInteriorStructureMaterialFromFrame(primaryFrame);
        if (interiorStructure) {
          rec.interior_wall_structure_material = interiorStructure;
          rec.interior_wall_structure_material_primary = interiorStructure;
        }
      }
    }

    const storyCount = parseNumber(building["Stories"]);
    if (storyCount != null) {
      rec.number_of_stories = storyCount;
    }

    const baseArea =
      parseNumber(building["Heated Area"]) ??
      parseNumber(building["Living Area"]) ??
      parseNumber(building["Total Living Area"]) ??
      parseNumber(building["Total Area"]);
    if (baseArea != null) {
      rec.finished_base_area = baseArea;
    }

    const finishedUpper = parseNumber(building["Upper Story Area"]) ?? parseNumber(building["Second Floor Area"]);
    if (finishedUpper != null) {
      rec.finished_upper_story_area = finishedUpper;
    }

    const unfinishedBase = parseNumber(building["Unfinished Area"]);
    if (unfinishedBase != null) {
      rec.unfinished_base_area = unfinishedBase;
    }

    structures.push(rec);
  });

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
  const structures = buildStructureRecords(buildings, parcelId);

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
