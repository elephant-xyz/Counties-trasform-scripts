// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Buildings";
const INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED = new Set([
  "Drywall",
  "Plaster",
  "Wood Paneling",
  "Exposed Brick",
  "Exposed Block",
  "Wainscoting",
  "Shiplap",
  "Board and Batten",
  "Tile",
  "Stone Veneer",
  "Metal Panels",
  "Glass Panels",
  "Concrete",
  null
]);
const INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED = new Set([
  "Wainscoting",
  "Chair Rail",
  "Crown Molding",
  "Baseboards",
  "Wood Trim",
  "Stone Accent",
  "Tile Accent",
  "Metal Accent",
  "Glass Insert",
  "Decorative Panels",
  "Feature Wall Material",
  null
]);

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

function mapExteriorWallMaterialPrimary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("BRK") || t.includes("BRICK")) return "Brick";
  if (t.includes("NATURAL") && t.includes("STONE")) return "Natural Stone";
  if (t.includes("MANUFACTURED") && t.includes("STONE")) return "Manufactured Stone";
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
  if (t.includes("PRECAST")) return "Precast Concrete";
  if (t.includes("CURTAIN")) return "Curtain Wall";
  if (t.includes("BD/BATTEN")) return "Wood Siding";
  if (t.includes("CONC BLOCK")) return "Concrete Block";
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

function addIfAllowed(out, value, allowedSet) {
  if (!value || !allowedSet.has(value)) return;
  if (!out.includes(value)) out.push(value);
}

function mapInteriorWallSurfacePrimary(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = (tok || "").toUpperCase().trim();
    if (!t) return;
    if (t.includes("DRYWALL") || t.includes("SHEETROCK"))
      addIfAllowed(out, "Drywall", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("PLASTER"))
      addIfAllowed(out, "Plaster", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("WOOD") || t.includes("PANEL"))
      addIfAllowed(out, "Wood Paneling", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("BRICK"))
      addIfAllowed(out, "Exposed Brick", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("BLOCK"))
      addIfAllowed(out, "Exposed Block", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("WAINSCOT"))
      addIfAllowed(out, "Wainscoting", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("SHIPLAP"))
      addIfAllowed(out, "Shiplap", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("BOARD") && t.includes("BATTEN"))
      addIfAllowed(out, "Board and Batten", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("TILE"))
      addIfAllowed(out, "Tile", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("STONE"))
      addIfAllowed(out, "Stone Veneer", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("METAL"))
      addIfAllowed(out, "Metal Panels", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("GLASS"))
      addIfAllowed(out, "Glass Panels", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
    if (t.includes("CONCRETE"))
      addIfAllowed(out, "Concrete", INTERIOR_WALL_SURFACE_PRIMARY_ALLOWED);
  });
  return out;
}

function mapInteriorWallSurfaceSecondary(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = (tok || "").toUpperCase().trim();
    if (!t) return;
    if (t.includes("WAINSCOT"))
      addIfAllowed(out, "Wainscoting", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("CHAIR") && t.includes("RAIL"))
      addIfAllowed(out, "Chair Rail", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("CROWN"))
      addIfAllowed(out, "Crown Molding", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("BASE"))
      addIfAllowed(out, "Baseboards", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("WOOD") && t.includes("TRIM"))
      addIfAllowed(out, "Wood Trim", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("STONE"))
      addIfAllowed(out, "Stone Accent", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("TILE"))
      addIfAllowed(out, "Tile Accent", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("METAL"))
      addIfAllowed(out, "Metal Accent", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("GLASS"))
      addIfAllowed(out, "Glass Insert", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("PANEL"))
      addIfAllowed(out, "Decorative Panels", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
    if (t.includes("FEATURE"))
      addIfAllowed(out, "Feature Wall Material", INTERIOR_WALL_SURFACE_SECONDARY_ALLOWED);
  });
  return out;
}

function mapFlooringMaterialPrimary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("SOLID") && t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("ENGINEERED") && t.includes("HARDWOOD")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) return "Luxury Vinyl Plank";
  if (t.includes("SHEET") && t.includes("VINYL")) return "Sheet Vinyl";
  if (t.includes("VINYL") && !t.includes("LUXURY")) return "Sheet Vinyl";
  if (t.includes("CERAMIC") && t.includes("TILE")) return "Ceramic Tile";
  if (t.includes("PORCELAIN") && t.includes("TILE")) return "Porcelain Tile";
  if (t.includes("NATURAL") && t.includes("STONE")) return "Natural Stone Tile";
  if (t.includes("STONE") && t.includes("TILE")) return "Natural Stone Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUG")) return "Area Rugs";
  if (t.includes("POLISHED") && t.includes("CONCRETE")) return "Polished Concrete";
  if (t.includes("CONCRETE")) return "Polished Concrete";
  if (t.includes("BAMBOO")) return "Bamboo";
  if (t.includes("CORK")) return "Cork";
  if (t.includes("LINOLEUM")) return "Linoleum";
  if (t.includes("TERRAZZO")) return "Terrazzo";
  if (t.includes("EPOXY")) return "Epoxy Coating";
  if (t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("CERAMIC")) return "Ceramic Tile";
  if (t.includes("STONE")) return "Natural Stone Tile";
  if (t.includes("V C TILE")) return "Sheet Vinyl";
  return null;
}

function mapFlooringMaterialSecondary(token) {
  const t = (token || "").toUpperCase().trim();
  if (!t) return null;
  if (t.includes("SOLID") && t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("ENGINEERED") && t.includes("HARDWOOD")) return "Engineered Hardwood";
  if (t.includes("LAMINATE")) return "Laminate";
  if (t.includes("LVP") || (t.includes("LUXURY") && t.includes("VINYL"))) return "Luxury Vinyl Plank";
  if (t.includes("CERAMIC") && t.includes("TILE")) return "Ceramic Tile";
  if (t.includes("CARPET")) return "Carpet";
  if (t.includes("AREA") && t.includes("RUG")) return "Area Rugs";
  if (t.includes("TRANSITION") && t.includes("STRIP")) return "Transition Strips";
  if (t.includes("HARDWOOD")) return "Solid Hardwood";
  if (t.includes("CERAMIC")) return "Ceramic Tile";
  return null;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecords(buildings, parcelId) {
  function createStructureBase(buildingNumber = null) {
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
          KeyValue: [parcelId],
        },
      },
      request_identifier: buildingNumber
        ? `${parcelId}_structure_${buildingNumber}`
        : parcelId,
      building_number: buildingNumber,
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
    };
  }

  const structures = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const rec = createStructureBase(buildingNumber);

    const extTokens = building["Exterior Walls"]
      ? building["Exterior Walls"].split(";").map((s) => s.trim())
      : [];
    const intWallTokens = building["Interior Walls"]
      ? building["Interior Walls"].split(";").map((s) => s.trim())
      : [];
    const floorTokens = building["Floor Cover"]
      ? building["Floor Cover"].split(";").map((s) => s.trim())
      : [];
    const roofTokens = [];
    if (building["Roof Cover"]) roofTokens.push(building["Roof Cover"]);
    if (building["Roof Type"]) roofTokens.push(building["Roof Type"]);
    const frameTokens = building["Frame Type"] ? [building["Frame Type"]] : [];

    if (extTokens.length > 0) {
      rec.exterior_wall_material_primary = mapExteriorWallMaterialPrimary(extTokens[0]);
      rec.exterior_wall_material_secondary = extTokens.length > 1 ? mapExteriorWallMaterialSecondary(extTokens[1]) : null;
    }

    const primarySurfaces = mapInteriorWallSurfacePrimary(intWallTokens);
    const secondarySurfaces = mapInteriorWallSurfaceSecondary(intWallTokens);
    if (primarySurfaces.length) {
      rec.interior_wall_surface_material_primary = primarySurfaces[0] || null;
    }
    if (secondarySurfaces.length) {
      rec.interior_wall_surface_material_secondary = secondarySurfaces[0] || null;
    }

    if (floorTokens.length > 0) {
      rec.flooring_material_primary = mapFlooringMaterialPrimary(floorTokens[0]);
      rec.flooring_material_secondary = floorTokens.length > 1 ? mapFlooringMaterialSecondary(floorTokens[1]) : null;
    }

    if (roofTokens.length) {
      const u = roofTokens.join(" ").toUpperCase();
      if (u.includes("3-TAB") && u.includes("SHINGLE"))
        rec.roof_covering_material = "3-Tab Asphalt Shingle";
      else if (u.includes("SHINGLE") || u.includes("SHNGL"))
        rec.roof_covering_material = "Architectural Asphalt Shingle";
      if (u.includes("METAL") && (u.includes("STANDING") || u.includes("RIB")))
        rec.roof_covering_material = "Metal Standing Seam";
      else if (u.includes("METAL") && u.includes("CORRUGATED"))
        rec.roof_covering_material = "Metal Corrugated";
      if (u.includes("CLAY") && u.includes("TILE"))
        rec.roof_covering_material = "Clay Tile";
      if (u.includes("CONCRETE") && u.includes("TILE"))
        rec.roof_covering_material = "Concrete Tile";
      if (u.includes("SLATE")) rec.roof_covering_material = "Natural Slate";
      if (u.includes("WOOD") && u.includes("SHAKE"))
        rec.roof_covering_material = "Wood Shake";
      if (u.includes("WOOD") && u.includes("SHINGLE"))
        rec.roof_covering_material = "Wood Shingle";
      if (u.includes("TPO")) rec.roof_covering_material = "TPO Membrane";
      if (u.includes("EPDM")) rec.roof_covering_material = "EPDM Membrane";

      if (u.includes("WOOD TRUSS")) rec.roof_structure_material = "Wood Truss";
      if (u.includes("WOOD RAFTER")) rec.roof_structure_material = "Wood Rafter";
      if (u.includes("STEEL TRUSS")) rec.roof_structure_material = "Steel Truss";
      if (u.includes("CONCRETE BEAM"))
        rec.roof_structure_material = "Concrete Beam";

      if (u.includes("GABLE")) rec.roof_design_type = "Gable";
      if (u.includes("HIP")) rec.roof_design_type = "Hip";
      if (u.includes("FLAT")) rec.roof_design_type = "Flat";
      if (u.includes("MANSARD")) rec.roof_design_type = "Mansard";
      if (u.includes("GAMBREL")) rec.roof_design_type = "Gambrel";
      if (u.includes("SHED")) rec.roof_design_type = "Shed";
    }

    const frameStr = frameTokens.join(" ").toUpperCase();
    if (frameStr.includes("WOOD")) {
      rec.primary_framing_material = "Wood Frame";
      rec.interior_wall_structure_material = "Wood Frame";
      rec.interior_wall_structure_material_primary = "Wood Frame";
    }
    if (frameStr.includes("STEEL")) {
      rec.primary_framing_material = "Steel Frame";
      rec.interior_wall_structure_material = "Steel Frame";
      rec.interior_wall_structure_material_primary = "Steel Frame";
    }
    if (frameStr.includes("MASONRY")) {
      rec.primary_framing_material = "Masonry";
      rec.interior_wall_structure_material = "Concrete Block";
      rec.interior_wall_structure_material_primary = "Concrete Block";
    }
    if (frameStr.includes("CONCRETE")) {
      rec.primary_framing_material = "Poured Concrete";
      rec.interior_wall_structure_material = "Concrete Block";
      rec.interior_wall_structure_material_primary = "Concrete Block";
    }

    rec.number_of_stories = parseNumber(building["Stories"]);

    const baseArea =
      parseNumber(building["Heated Area"]) ??
      parseNumber(building["Living Area"]) ??
      parseNumber(building["Total Living Area"]) ??
      parseNumber(building["Gross Area"]);
    rec.finished_base_area = baseArea;

    structures.push(rec);
  });

  if (!structures.length) {
    structures.push(createStructureBase(null));
  }

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
  // console.log(buildings)
  const structures = buildStructureRecords(buildings, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { structures };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${structures.length} structure entries`);
}

if (require.main === module) {
  main();
}
