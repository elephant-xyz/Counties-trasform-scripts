// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
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

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("MANUFACTURED") && t.includes("STONE")) out.push("Manufactured Stone");
    else if (t.includes("STONE")) out.push("Natural Stone");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("FIBER") && t.includes("CEMENT")) out.push("Fiber Cement Siding");
    if (t.includes("METAL")) out.push("Metal Siding");
    if (t.includes("PRECAST") && t.includes("CONCRETE")) out.push("Precast Concrete");
    else if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
    if (t.includes("EIFS")) out.push("EIFS");
    if (t.includes("LOG")) out.push("Log");
    if (t.includes("ADOBE")) out.push("Adobe");
    if (t.includes("CURTAIN") && t.includes("WALL")) out.push("Curtain Wall");
  });
  return [...new Set(out)];
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

function mapFlooringMaterialPrimary(material) {
  if (!material) return null;
  const u = material.toUpperCase();
  if (u.includes("HARDWOOD") && u.includes("SOLID")) return "Solid Hardwood";
  if (u.includes("HARDWOOD") && u.includes("ENGINEERED")) return "Engineered Hardwood";
  if (u.includes("HARDWOOD")) return "Solid Hardwood";
  if (u.includes("LAMINATE")) return "Laminate";
  if (u.includes("VINYL") && u.includes("PLANK")) return "Luxury Vinyl Plank";
  if (u.includes("VINYL") && u.includes("SHEET")) return "Sheet Vinyl";
  if (u.includes("VINYL")) return "Sheet Vinyl";
  if (u.includes("CERAMIC") && u.includes("TILE")) return "Ceramic Tile";
  if (u.includes("PORCELAIN") && u.includes("TILE")) return "Porcelain Tile";
  if (u.includes("STONE") && u.includes("TILE")) return "Natural Stone Tile";
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("RUG")) return "Area Rugs";
  if (u.includes("CONCRETE") && u.includes("POLISHED")) return "Polished Concrete";
  if (u.includes("BAMBOO")) return "Bamboo";
  if (u.includes("CORK")) return "Cork";
  if (u.includes("LINOLEUM")) return "Linoleum";
  if (u.includes("TERRAZZO")) return "Terrazzo";
  if (u.includes("EPOXY")) return "Epoxy Coating";
  return null;
}

function mapFlooringMaterialSecondary(material) {
  if (!material) return null;
  const u = material.toUpperCase();
  if (u.includes("SOLID HARDWOOD")) return "Solid Hardwood";
  if (u.includes("ENGINEERED HARDWOOD")) return "Engineered Hardwood";
  if (u.includes("LAMINATE")) return "Laminate";
  if (u.includes("LUXURY VINYL PLANK")) return "Luxury Vinyl Plank";
  if (u.includes("CERAMIC TILE")) return "Ceramic Tile";
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("AREA RUGS")) return "Area Rugs";
  if (u.includes("TRANSITION")) return "Transition Strips";
  return null;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecord($, buildings, parcelId) {
  // Defaults per schema requirements (all present, many null)
  const rec = {
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
  };

  // Aggregate from buildings
  const extTokens = [];
  const intWallTokens = [];
  const floorTokens = [];
  const roofTokens = [];
  const frameTokens = [];
  const stories = [];

  buildings.forEach((b) => {
    if (b["Primary Exterior Wall"])
      extTokens.push(...b["Primary Exterior Wall"].split(";").map((s) => s.trim()));
    if (b["Second Exterior Wall"])
      extTokens.push(...b["Second Exterior Wall"].split(";").map((s) => s.trim()));
    

    if (b["Primary Interior Wall"]) {
      const primary = mapInteriorSurface([b["Primary Interior Wall"]]);
      if (primary.length) rec.interior_wall_surface_material_primary = primary[0];
    }
    
    if (b["Second Interior Wall"]) {
      const secondary = b["Second Interior Wall"].toUpperCase();
      if (secondary.includes("WAINSCOT")) rec.interior_wall_surface_material_secondary = "Wainscoting";
      else if (secondary.includes("CHAIR") && secondary.includes("RAIL")) rec.interior_wall_surface_material_secondary = "Chair Rail";
      else if (secondary.includes("CROWN") && secondary.includes("MOLDING")) rec.interior_wall_surface_material_secondary = "Crown Molding";
      else if (secondary.includes("BASEBOARD")) rec.interior_wall_surface_material_secondary = "Baseboards";
      else if (secondary.includes("WOOD") && secondary.includes("TRIM")) rec.interior_wall_surface_material_secondary = "Wood Trim";
      else if (secondary.includes("STONE")) rec.interior_wall_surface_material_secondary = "Stone Accent";
      else if (secondary.includes("TILE")) rec.interior_wall_surface_material_secondary = "Tile Accent";
      else if (secondary.includes("METAL")) rec.interior_wall_surface_material_secondary = "Metal Accent";
      else if (secondary.includes("GLASS")) rec.interior_wall_surface_material_secondary = "Glass Insert";
      else if (secondary.includes("DECORATIVE") && secondary.includes("PANEL")) rec.interior_wall_surface_material_secondary = "Decorative Panels";
      else rec.interior_wall_surface_material_secondary = "Feature Wall Material";
    }
    
    if (b["Primary Floor Cover"]) {
      rec.flooring_material_primary = mapFlooringMaterialPrimary(b["Primary Floor Cover"]);
    }
    
    if (b["Second Floor Cover"]) {
      rec.flooring_material_secondary = mapFlooringMaterialSecondary(b["Second Floor Cover"]);
    }

    if (b["Roof Structure"]) roofTokens.push(b["Roof Structure"]);
    if (b["Roof Material"]) roofTokens.push(b["Roof Material"]);
    if (b["Frame"]) frameTokens.push(b["Frame"]);
    if (b["Foundation"]) {
      const f = b["Foundation"].toUpperCase();
      if (f.includes("POURED") && f.includes("CONCRETE")) rec.foundation_material = "Poured Concrete";
      else if (f.includes("CONCRETE") && f.includes("BLOCK")) rec.foundation_material = "Concrete Block";
      else if (f.includes("STONE")) rec.foundation_material = "Stone";
      else if (f.includes("BRICK")) rec.foundation_material = "Brick";
      else if (f.includes("TREATED") && f.includes("WOOD")) rec.foundation_material = "Treated Wood Posts";
      else if (f.includes("STEEL") && f.includes("PIER")) rec.foundation_material = "Steel Piers";
      else if (f.includes("PRECAST") && f.includes("CONCRETE")) rec.foundation_material = "Precast Concrete";
      else if (f.includes("INSULATED") && f.includes("CONCRETE")) rec.foundation_material = "Insulated Concrete Forms";
      else if (f.includes("CONCRETE")) rec.foundation_material = "Poured Concrete";
    }

    if (b["Story Height"]) {
      const st = parseNumber(b["Story Height"]);
      if (st != null) stories.push(st);
    }
  });

  // Exterior materials
  const ext = mapExteriorMaterials(extTokens);
  if (ext.length) {
    rec.exterior_wall_material_primary = ext[0] || null;
    if (ext.length > 1) {
      const secondary = ext[1];
      if (secondary === "Brick") rec.exterior_wall_material_secondary = "Brick Accent";
      else if (secondary === "Natural Stone") rec.exterior_wall_material_secondary = "Stone Accent";
      else if (secondary === "Wood Siding") rec.exterior_wall_material_secondary = "Wood Trim";
      else if (secondary === "Metal Siding") rec.exterior_wall_material_secondary = "Metal Trim";
      else if (secondary === "Stucco") rec.exterior_wall_material_secondary = "Stucco Accent";
      else if (secondary === "Vinyl Siding") rec.exterior_wall_material_secondary = "Vinyl Accent";
      else if (secondary === "Concrete Block") rec.exterior_wall_material_secondary = "Decorative Block";
    }
  }





  // Roof covering and type mapping
  if (roofTokens.length) {
    const u = roofTokens.join(" ").toUpperCase();
    // Roof covering material
    if (u.includes("3-TAB") && u.includes("SHINGLE")) rec.roof_covering_material = "3-Tab Asphalt Shingle";
    else if (u.includes("SHINGLE") || u.includes("SHNGL") || u.includes("ASPHALT")) rec.roof_covering_material = "Architectural Asphalt Shingle";
    if (u.includes("METAL") && (u.includes("STANDING") || u.includes("RIB"))) rec.roof_covering_material = "Metal Standing Seam";
    else if (u.includes("METAL") && u.includes("CORRUGATED")) rec.roof_covering_material = "Metal Corrugated";
    if (u.includes("CLAY") && u.includes("TILE")) rec.roof_covering_material = "Clay Tile";
    if (u.includes("CONCRETE") && u.includes("TILE")) rec.roof_covering_material = "Concrete Tile";
    if (u.includes("SLATE")) rec.roof_covering_material = "Natural Slate";
    if (u.includes("WOOD") && u.includes("SHAKE")) rec.roof_covering_material = "Wood Shake";
    if (u.includes("WOOD") && u.includes("SHINGLE")) rec.roof_covering_material = "Wood Shingle";
    if (u.includes("TPO")) rec.roof_covering_material = "TPO Membrane";
    if (u.includes("EPDM")) rec.roof_covering_material = "EPDM Membrane";
    
    // Roof structure material
    if (u.includes("WOOD TRUSS")) rec.roof_structure_material = "Wood Truss";
    if (u.includes("WOOD RAFTER")) rec.roof_structure_material = "Wood Rafter";
    if (u.includes("STEEL TRUSS")) rec.roof_structure_material = "Steel Truss";
    if (u.includes("CONCRETE BEAM")) rec.roof_structure_material = "Concrete Beam";
    
    // Roof design type
    if (u.includes("GABLE")) rec.roof_design_type = "Gable";
    if (u.includes("HIP")) rec.roof_design_type = "Hip";
    if (u.includes("FLAT")) rec.roof_design_type = "Flat";
    if (u.includes("MANSARD")) rec.roof_design_type = "Mansard";
    if (u.includes("GAMBREL")) rec.roof_design_type = "Gambrel";
    if (u.includes("SHED")) rec.roof_design_type = "Shed";
  }

  // Framing
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

  // Stories
  if (stories.length) {
    // Use max stories across buildings
    rec.number_of_stories = Math.max(...stories);
  }



  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($);
  // console.log(buildings)
  const structureRecord = buildStructureRecord($, buildings, parcelId);
  // console.log(structureRecord);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structureRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
