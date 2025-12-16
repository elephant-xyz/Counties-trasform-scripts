// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Data";

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
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function mapExteriorWallMaterialPrimary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick";
  if (t.includes("STONE") && t.includes("NAT")) return "Natural Stone";
  if (t.includes("STONE") && (t.includes("MAN") || t.includes("MANUF"))) return "Manufactured Stone";
  if (t.includes("STONE")) return "Natural Stone";
  if (t.includes("STUC")) return "Stucco";
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("CEDAR") || t.includes("WOOD")) return "Wood Siding";
  if (t.includes("FIBER") || t.includes("CEMENT")) return "Fiber Cement Siding";
  if (t.includes("METAL") || t.includes("STEEL") || t.includes("ALUMINUM")) return "Metal Siding";
  if (t.includes("BLOCK") || t.includes("CONCRETE")) return "Concrete Block";
  if (t.includes("EIFS")) return "EIFS";
  if (t.includes("LOG")) return "Log";
  if (t.includes("ADOBE")) return "Adobe";
  if (t.includes("PRECAST")) return "Precast Concrete";
  if (t.includes("CURTAIN")) return "Curtain Wall";
  return null;
}

function mapExteriorWallMaterialSecondary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick Accent";
  if (t.includes("STONE")) return "Stone Accent";
  if (t.includes("WOOD") || t.includes("TRIM")) return "Wood Trim";
  if (t.includes("METAL")) return "Metal Trim";
  if (t.includes("STUC")) return "Stucco Accent";
  if (t.includes("VINYL")) return "Vinyl Accent";
  if (t.includes("DECORATIVE") || t.includes("BLOCK")) return "Decorative Block";
  return null;
}

function mapInteriorWallSurfaceMaterialPrimary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("DRYWALL") || t.includes("SHEETROCK") || t.includes("GYPSUM")) return "Drywall";
  if (t.includes("PLASTER")) return "Plaster";
  if (t.includes("WOOD") && t.includes("PANEL")) return "Wood Paneling";
  if (t.includes("EXPOSED") && t.includes("BRICK")) return "Exposed Brick";
  if (t.includes("EXPOSED") && t.includes("BLOCK")) return "Exposed Block";
  if (t.includes("WAINSCOT")) return "Wainscoting";
  if (t.includes("SHIPLAP")) return "Shiplap";
  if (t.includes("BOARD") && t.includes("BATTEN")) return "Board and Batten";
  if (t.includes("TILE")) return "Tile";
  if (t.includes("STONE") && t.includes("VENEER")) return "Stone Veneer";
  if (t.includes("METAL") && t.includes("PANEL")) return "Metal Panels";
  if (t.includes("GLASS") && t.includes("PANEL")) return "Glass Panels";
  if (t.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapInteriorWallSurfaceMaterialSecondary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("WAINSCOT")) return "Wainscoting";
  if (t.includes("CHAIR") && t.includes("RAIL")) return "Chair Rail";
  if (t.includes("CROWN") && t.includes("MOLD")) return "Crown Molding";
  if (t.includes("BASEBOARD")) return "Baseboards";
  if (t.includes("WOOD") && t.includes("TRIM")) return "Wood Trim";
  if (t.includes("STONE") && t.includes("ACCENT")) return "Stone Accent";
  if (t.includes("TILE") && t.includes("ACCENT")) return "Tile Accent";
  if (t.includes("METAL") && t.includes("ACCENT")) return "Metal Accent";
  if (t.includes("GLASS") && t.includes("INSERT")) return "Glass Insert";
  if (t.includes("DECORATIVE") && t.includes("PANEL")) return "Decorative Panels";
  if (t.includes("FEATURE") && t.includes("WALL")) return "Feature Wall Material";
  return null;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("CERAMIC")) out.push("Ceramic Tile");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
  });
  return out;
}

function mapPrimaryFramingMaterial(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("WOOD")) return "Wood Frame";
  if (t.includes("STEEL")) return "Steel Frame";
  if (t.includes("CONCRETE") && t.includes("BLOCK")) return "Concrete Block";
  if (t.includes("POURED") && t.includes("CONCRETE")) return "Poured Concrete";
  if (t.includes("CONCRETE")) return "Poured Concrete";
  if (t.includes("MASONRY")) return "Masonry";
  if (t.includes("ENGINEERED") && t.includes("LUMBER")) return "Engineered Lumber";
  if (t.includes("POST") && t.includes("BEAM")) return "Post and Beam";
  if (t.includes("LOG")) return "Log Construction";
  return null;
}

function mapRoofCoveringMaterial(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("3-TAB") || t.includes("3 TAB")) return "3-Tab Asphalt Shingle";
  if (t.includes("ARCH") || t.includes("ARCHITECT") || t.includes("ENG SHINGL")) return "Architectural Asphalt Shingle";
  if (t.includes("SHINGLE") && !t.includes("WOOD")) return "Architectural Asphalt Shingle";
  if (t.includes("METAL") && t.includes("STANDING")) return "Metal Standing Seam";
  if (t.includes("METAL") && t.includes("CORRUGATED")) return "Metal Corrugated";
  if (t.includes("METAL")) return "Metal Standing Seam";
  if (t.includes("CLAY") && t.includes("TILE")) return "Clay Tile";
  if (t.includes("CONCRETE") && t.includes("TILE")) return "Concrete Tile";
  if (t.includes("NATURAL") && t.includes("SLATE")) return "Natural Slate";
  if (t.includes("SYNTHETIC") && t.includes("SLATE")) return "Synthetic Slate";
  if (t.includes("SLATE")) return "Natural Slate";
  if (t.includes("WOOD") && t.includes("SHAKE")) return "Wood Shake";
  if (t.includes("WOOD") && t.includes("SHINGLE")) return "Wood Shingle";
  if (t.includes("TPO")) return "TPO Membrane";
  if (t.includes("EPDM")) return "EPDM Membrane";
  if (t.includes("MODIFIED") && t.includes("BITUMEN")) return "Modified Bitumen";
  if (t.includes("BUILT-UP") || t.includes("BUILT UP")) return "Built-Up Roof";
  if (t.includes("GREEN") && t.includes("ROOF")) return "Green Roof System";
  if (t.includes("SOLAR") && t.includes("TILE")) return "Solar Integrated Tiles";
  return null;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function createStructureBase(buildingNumber = null, structureIndex = 1) {
  return {
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
    building_number: buildingNumber,
    structure_index: structureIndex,
  };
}

function buildStructureRecords(buildings) {
  const structures = [];
  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const rec = createStructureBase(buildingNumber, buildingNumber);
    const extTokens = building["Exterior Walls"]
      ? building["Exterior Walls"].split(";").map((s) => s.trim()).filter(Boolean)
      : [];
    const intWallTokens = building["Interior Walls"]
      ? building["Interior Walls"].split(";").map((s) => s.trim()).filter(Boolean)
      : [];
    const floorTokens = building["Floor Cover"]
      ? building["Floor Cover"].split(";").map((s) => s.trim()).filter(Boolean)
      : [];

    if (extTokens.length > 0) {
      rec.exterior_wall_material_primary = mapExteriorWallMaterialPrimary(extTokens[0]);
    }
    if (extTokens.length > 1) {
      rec.exterior_wall_material_secondary = mapExteriorWallMaterialSecondary(extTokens[1]);
    }

    if (intWallTokens.length > 0) {
      rec.interior_wall_surface_material_primary = mapInteriorWallSurfaceMaterialPrimary(intWallTokens[0]);
    }
    if (intWallTokens.length > 1) {
      rec.interior_wall_surface_material_secondary = mapInteriorWallSurfaceMaterialSecondary(intWallTokens[1]);
    }

    const floors = mapFlooring(floorTokens);
    if (floors.length) {
      rec.flooring_material_primary = floors[0] || null;
      rec.flooring_material_secondary = floors[1] || null;
    }

    const roofDesc = building["Roof Cover"] || "";
    rec.roof_covering_material = mapRoofCoveringMaterial(roofDesc);

    const frameDesc = building["Frame Type"] || "";
    rec.primary_framing_material = mapPrimaryFramingMaterial(frameDesc);

    rec.number_of_stories = parseNumber(building["Stories"]);

    const baseArea =
      parseNumber(building["Heated Area"]) ??
      parseNumber(building["Living Area"]) ??
      parseNumber(building["Total Living Area"]) ??
      parseNumber(building["Gross Area"]);
    rec.finished_base_area = baseArea;

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
  const structures = buildStructureRecords(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structures;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${structures.length} structure entries`);
}

if (require.main === module) {
  main();
}
