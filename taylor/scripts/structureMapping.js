// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_lblParcelID";
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
      '#ctlBodyPane_ctl04_mSection > div > table',
    )
    .each((_, table) => {
      const map = {};
      $(table)
        .find("tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  // let buildingCount = 0;
  // $(section)
  //   .find(
  //     '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
  //   )
  //   .each((_, div) => {
  //     const map = {};
  //     $(div)
  //       .find("table tbody tr")
  //       .each((__, tr) => {
  //         let label = textTrim($(tr).find("td strong").first().text());
  //         if (!label || !label.trim()) {
  //           label = textTrim($(tr).find("th strong").first().text());
  //         }
  //         const value = textTrim($(tr).find("td span").first().text());
  //         if (label) map[label] = value;
  //       });
  //     if (Object.keys(map).length) {
  //       const combined_map = {...buildings[buildingCount], ...map};
  //       buildings[buildingCount++] = combined_map;
  //     };
  //   });
  return buildings;
}

function numericValue(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function normalizeTokens(val) {
  const raw = String(val || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const tokens = raw.split(/[;,/]+/).map((s) => s.trim());
  tokens.push(raw);
  return tokens.filter(Boolean);
}

function firstUniqueMatch(matches) {
  const seen = new Set();
  for (const m of matches) {
    if (!seen.has(m)) {
      seen.add(m);
      return m;
    }
  }
  return null;
}

function mapExteriorMaterialPrimary(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("EIFS")) matches.push("EIFS");
    if (t.includes("BRK") || t.includes("BRICK")) matches.push("Brick");
    if (t.includes("MANUF") || (t.includes("CULT") && t.includes("STONE")))
      matches.push("Manufactured Stone");
    if (t.includes("STONE")) matches.push("Natural Stone");
    if (t.includes("STUC")) matches.push("Stucco");
    if (t.includes("VINYL")) matches.push("Vinyl Siding");
    if (t.includes("FIBER") || t.includes("HARDI"))
      matches.push("Fiber Cement Siding");
    if (t.includes("WOOD") || t.includes("CEDAR"))
      matches.push("Wood Siding");
    if (t.includes("METAL") || t.includes("ALUM") || t.includes("STEEL"))
      matches.push("Metal Siding");
    if (
      t.includes("BLOCK") ||
      t.includes("CONC") ||
      t.includes("CBS") ||
      t.includes("CB")
    )
      matches.push("Concrete Block");
    if (t.includes("LOG")) matches.push("Log");
    if (t.includes("ADOBE")) matches.push("Adobe");
    if (t.includes("PRECAST")) matches.push("Precast Concrete");
    if (t.includes("CURTAIN")) matches.push("Curtain Wall");
  });
  return firstUniqueMatch(matches);
}

function mapExteriorMaterialSecondary(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("BRICK") && t.includes("ACCENT")) matches.push("Brick Accent");
    if (t.includes("STONE") && t.includes("ACCENT")) matches.push("Stone Accent");
    if (t.includes("WOOD") && t.includes("TRIM")) matches.push("Wood Trim");
    if (t.includes("METAL") && t.includes("TRIM")) matches.push("Metal Trim");
    if (t.includes("STUCCO") && t.includes("ACCENT")) matches.push("Stucco Accent");
    if (t.includes("VINYL") && t.includes("ACCENT")) matches.push("Vinyl Accent");
    if (t.includes("DECORATIVE") && t.includes("BLOCK")) matches.push("Decorative Block");
  });
  return firstUniqueMatch(matches);
}

function mapInteriorWallSurfacePrimary(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("DRYWALL") || t.includes("GYPS") || t.includes("SHEETROCK"))
      matches.push("Drywall");
    if (t.includes("PLASTER")) matches.push("Plaster");
    if (t.includes("PANEL") || t.includes("WOOD")) matches.push("Wood Paneling");
    if (t.includes("BRK") || t.includes("BRICK")) matches.push("Exposed Brick");
    if (t.includes("BLOCK") || t.includes("CMU")) matches.push("Exposed Block");
    if (t.includes("WAIN")) matches.push("Wainscoting");
    if (t.includes("SHIPLAP")) matches.push("Shiplap");
    if (t.includes("BOARD")) matches.push("Board and Batten");
    if (t.includes("TILE")) matches.push("Tile");
    if (t.includes("STONE")) matches.push("Stone Veneer");
    if (t.includes("METAL")) matches.push("Metal Panels");
    if (t.includes("GLASS")) matches.push("Glass Panels");
    if (t.includes("CONC")) matches.push("Concrete");
  });
  return firstUniqueMatch(matches);
}

function mapInteriorWallSurfaceSecondary(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("WAINSCOTING")) matches.push("Wainscoting");
    if (t.includes("CHAIR") && t.includes("RAIL")) matches.push("Chair Rail");
    if (t.includes("CROWN") && t.includes("MOLDING")) matches.push("Crown Molding");
    if (t.includes("BASEBOARD")) matches.push("Baseboards");
    if (t.includes("WOOD") && t.includes("TRIM")) matches.push("Wood Trim");
    if (t.includes("STONE") && t.includes("ACCENT")) matches.push("Stone Accent");
    if (t.includes("TILE") && t.includes("ACCENT")) matches.push("Tile Accent");
    if (t.includes("METAL") && t.includes("ACCENT")) matches.push("Metal Accent");
    if (t.includes("GLASS") && t.includes("INSERT")) matches.push("Glass Insert");
    if (t.includes("DECORATIVE") && t.includes("PANEL")) matches.push("Decorative Panels");
    if (t.includes("FEATURE") && t.includes("WALL")) matches.push("Feature Wall Material");
  });
  return firstUniqueMatch(matches);
}

function mapFlooring(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("CARPET")) matches.push("Carpet");
    if (t.includes("LVP") || t.includes("VINYL PLANK"))
      matches.push("Luxury Vinyl Plank");
    if (t.includes("VINYL")) matches.push("Sheet Vinyl");
    if (t.includes("CERAMIC")) matches.push("Ceramic Tile");
    if (t.includes("PORCELAIN")) matches.push("Porcelain Tile");
    if (t.includes("STONE")) matches.push("Natural Stone Tile");
    if (t.includes("LAMINATE")) matches.push("Laminate");
    if (t.includes("CONCRETE")) matches.push("Polished Concrete");
    if (t.includes("LINO")) matches.push("Linoleum");
    if (t.includes("CORK")) matches.push("Cork");
  });
  return firstUniqueMatch(matches);
}

function mapRoofCover(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("3-TAB") || t.includes("3 TAB"))
      matches.push("3-Tab Asphalt Shingle");
    if (t.includes("WOOD SHINGLE")) matches.push("Wood Shingle");
    if (t.includes("SHAKE")) matches.push("Wood Shake");
    if (t.includes("ARCH") || t.includes("ARCHITECT"))
      matches.push("Architectural Asphalt Shingle");
    if (t.includes("SHINGLE") && !t.includes("WOOD"))
      matches.push("Architectural Asphalt Shingle");
    if (t.includes("METAL")) matches.push("Metal Standing Seam");
    if (t.includes("CORRUG")) matches.push("Metal Corrugated");
    if (t.includes("CLAY")) matches.push("Clay Tile");
    if (t.includes("CONCRETE")) matches.push("Concrete Tile");
    if (t.includes("SLATE") && t.includes("SYN"))
      matches.push("Synthetic Slate");
    if (t.includes("SLATE") && !t.includes("SYN")) matches.push("Natural Slate");
    if (t.includes("TPO")) matches.push("TPO Membrane");
    if (t.includes("EPDM")) matches.push("EPDM Membrane");
    if (t.includes("MOD") && t.includes("BIT")) matches.push("Modified Bitumen");
    if (t.includes("BUILT")) matches.push("Built-Up Roof");
    if (t.includes("GREEN")) matches.push("Green Roof System");
    if (t.includes("SOLAR")) matches.push("Solar Integrated Tiles");
  });
  return firstUniqueMatch(matches);
}

function mapPrimaryFraming(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("WOOD")) matches.push("Wood Frame");
    if (t.includes("STEEL")) matches.push("Steel Frame");
    if (t.includes("BLOCK") || t.includes("CONC"))
      matches.push("Concrete Block");
    if (t.includes("POURED")) matches.push("Poured Concrete");
    if (t.includes("MASON")) matches.push("Masonry");
    if (t.includes("ENGINEERED")) matches.push("Engineered Lumber");
    if (t.includes("POST") || t.includes("BEAM")) matches.push("Post and Beam");
    if (t.includes("LOG")) matches.push("Log Construction");
  });
  return firstUniqueMatch(matches);
}

function mapFoundationType(val) {
  const matches = [];
  normalizeTokens(val).forEach((tok) => {
    const t = tok.toUpperCase();
    if (t.includes("SLAB")) matches.push("Slab on Grade");
    if (t.includes("CRAWL")) matches.push("Crawl Space");
    if (t.includes("FULL") && t.includes("BASE")) matches.push("Full Basement");
    if (t.includes("PARTIAL") && t.includes("BASE"))
      matches.push("Partial Basement");
    if (t.includes("WALK") && t.includes("OUT"))
      matches.push("Basement with Walkout");
    if (t.includes("PIER") || t.includes("BEAM")) matches.push("Pier and Beam");
    if (t.includes("STEM")) matches.push("Stem Wall");
  });
  return firstUniqueMatch(matches);
}

function baseStructure() {
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
    number_of_buildings: null,
    number_of_stories: null,
    primary_framing_material: null,
    request_identifier: null,
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

function buildStructureFromBuilding(building, totalBuildings, parcelId) {
  const structure = baseStructure();
  structure.number_of_buildings = totalBuildings || null;
  structure.request_identifier = parcelId || null;

  const exteriorPrimary = mapExteriorMaterialPrimary(building["Exterior Walls"]);
  if (exteriorPrimary) structure.exterior_wall_material_primary = exteriorPrimary;
  
  const exteriorSecondary = mapExteriorMaterialSecondary(building["Exterior Walls Secondary"] || building["Exterior Accent"]);
  if (exteriorSecondary) structure.exterior_wall_material_secondary = exteriorSecondary;

  const interiorPrimary = mapInteriorWallSurfacePrimary(building["Interior Walls"]);
  if (interiorPrimary) structure.interior_wall_surface_material_primary = interiorPrimary;
  
  const interiorSecondary = mapInteriorWallSurfaceSecondary(building["Interior Walls Secondary"] || building["Interior Accent"]);
  if (interiorSecondary) structure.interior_wall_surface_material_secondary = interiorSecondary;

  const flooring = mapFlooring(building["Floor Cover"]);
  if (flooring) structure.flooring_material_primary = flooring;

  const roofCover = mapRoofCover(building["Roof Cover"]);
  if (roofCover) structure.roof_covering_material = roofCover;

  const framing = mapPrimaryFraming(building["Frame Type"]);
  if (framing) structure.primary_framing_material = framing;

  const stories = numericValue(building["Stories"]);
  if (stories != null) structure.number_of_stories = stories;

  const foundation = mapFoundationType(
    building["Foundation"] ||
      building["Foundation Type"] ||
      building["Found Type"],
  );
  if (foundation) structure.foundation_type = foundation;

  return structure;
}

function buildStructures(buildings, parcelId) {
  const total = buildings.length;
  return buildings.map((building) => buildStructureFromBuilding(building, total, parcelId));
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const propertySeed = readJSON("property_seed.json");
  // if (
  //   propertySeed &&
  //   propertySeed.request_identifier &&
  //   propertySeed.request_identifier !== parcelId
  // ) {
  //   throw {
  //     type: "error",
  //     message: "Request identifier and parcel id don't match.",
  //     path: "property.request_identifier",
  //   };
  // }
  const buildings = collectBuildings($);
  const structures = buildStructures(buildings, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { structures };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
