// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
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
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
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
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
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

// Map exterior wall tokens to allowed enum for exterior_wall_material_primary
function mapExteriorMaterialPrimary(tokens) {
  for (const raw of tokens) {
    const t = raw.toUpperCase().trim();
    if (!t) continue;
    if (t.includes("BRK") || t.includes("BRICK")) return "Brick";
    if (t.includes("STONE")) return "Natural Stone";
    if (t.includes("STUC")) return "Stucco";
    if (t.includes("VINYL")) return "Vinyl Siding";
    if (t.includes("CEDAR") || t.includes("WOOD")) return "Wood Siding";
    if (t.includes("HARDI") || t.includes("FIBER")) return "Fiber Cement Siding";
    if (t.includes("METAL") || t.includes("STEEL")) return "Metal Siding";
    if (t.includes("BLOCK") || t.includes("CONCRETE") || t.includes("CBS"))
      return "Concrete Block";
    if (t.includes("EIFS")) return "EIFS";
    if (t.includes("LOG")) return "Log";
    if (t.includes("ADOBE")) return "Adobe";
    if (t.includes("PRECAST")) return "Precast Concrete";
  }
  return null;
}

// Map interior wall surface tokens to allowed enum for interior_wall_surface_material_primary
function mapInteriorWallSurface(tokens) {
  for (const raw of tokens) {
    const t = raw.toUpperCase().trim();
    if (!t) continue;
    if (t.includes("DRYWALL") || t.includes("GYP")) return "Drywall";
    if (t.includes("PLASTER")) return "Plaster";
    if (t.includes("WOOD") || t.includes("PANEL")) return "Wood Paneling";
    if (t.includes("BRK") || t.includes("BRICK")) return "Exposed Brick";
    if (t.includes("BLOCK") || t.includes("CONCRETE") || t.includes("CMU"))
      return "Exposed Block";
    if (t.includes("WAIN")) return "Wainscoting";
    if (t.includes("SHIPLAP")) return "Shiplap";
    if (t.includes("BOARD") && t.includes("BATT")) return "Board and Batten";
    if (t.includes("TILE")) return "Tile";
    if (t.includes("STONE")) return "Stone Veneer";
    if (t.includes("METAL")) return "Metal Panels";
    if (t.includes("GLASS")) return "Glass Panels";
    if (t.includes("CONC")) return "Concrete";
  }
  return null;
}

// Map flooring tokens to allowed enum for flooring_material_primary
function mapFlooringMaterial(tokens) {
  for (const raw of tokens) {
    const t = raw.toUpperCase().trim();
    if (!t) continue;
    if (t.includes("CARPET")) return "Carpet";
    if (t.includes("VINYL PLANK") || t.includes("LVP"))
      return "Luxury Vinyl Plank";
    if (t.includes("VINYL")) return "Sheet Vinyl";
    if (t.includes("CERAMIC")) return "Ceramic Tile";
    if (t.includes("PORCELAIN")) return "Porcelain Tile";
    if (t.includes("LAMINATE")) return "Laminate";
    if (t.includes("STONE")) return "Natural Stone Tile";
    if (t.includes("HARDWOOD")) return "Solid Hardwood";
    if (t.includes("ENGINEERED")) return "Engineered Hardwood";
    if (t.includes("BAMBOO")) return "Bamboo";
    if (t.includes("CORK")) return "Cork";
    if (t.includes("LINO")) return "Linoleum";
    if (t.includes("TERRAZZO")) return "Terrazzo";
    if (t.includes("EPOXY")) return "Epoxy Coating";
    if (t.includes("CONCRETE")) return "Polished Concrete";
  }
  return null;
}

// Map roof cover tokens to allowed enum for roof_covering_material
function mapRoofCovering(tokens) {
  const u = tokens.join(" ").toUpperCase();
  if (!u) return null;
  if (
    u.includes("ENG SHINGL") ||
    u.includes("ARCH") ||
    u.includes("ARCHITECT") ||
    u.includes("SHINGLE")
  ) {
    return "Architectural Asphalt Shingle";
  }
  if (u.includes("3-TAB") || u.includes("3 TAB")) return "3-Tab Asphalt Shingle";
  if (u.includes("METAL") || u.includes("TIN"))
    return u.includes("CORR") ? "Metal Corrugated" : "Metal Standing Seam";
  if (u.includes("CLAY")) return "Clay Tile";
  if (u.includes("CONCRETE TILE")) return "Concrete Tile";
  if (u.includes("SLATE")) return "Natural Slate";
  if (u.includes("WOOD")) return "Wood Shingle";
  if (u.includes("SHAKE")) return "Wood Shake";
  if (u.includes("TPO")) return "TPO Membrane";
  if (u.includes("EPDM")) return "EPDM Membrane";
  if (u.includes("MOD BIT")) return "Modified Bitumen";
  if (u.includes("BUILT UP") || u.includes("BUR")) return "Built-Up Roof";
  if (u.includes("GREEN")) return "Green Roof System";
  return null;
}

// Map frame tokens to allowed enum for primary_framing_material
function mapPrimaryFraming(tokens) {
  const u = tokens.join(" ").toUpperCase();
  if (!u) return null;
  if (u.includes("WOOD")) return "Wood Frame";
  if (u.includes("STEEL") || u.includes("METAL")) return "Steel Frame";
  if (u.includes("BLOCK") || u.includes("CBS") || u.includes("CMU"))
    return "Concrete Block";
  if (u.includes("POUR")) return "Poured Concrete";
  if (u.includes("MASONRY")) return "Masonry";
  if (u.includes("ENGINEERED")) return "Engineered Lumber";
  if (u.includes("POST AND BEAM")) return "Post and Beam";
  if (u.includes("LOG")) return "Log Construction";
  return null;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecordForBuilding(building, buildingIndex) {
  // Defaults per structure schema; keep all keys present with null defaults
  const rec = {
    architectural_style_type: null,
    attachment_type: null,
    building_number: buildingIndex + 1,
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

  const extTokens = [];
  const intWallTokens = [];
  const floorTokens = [];
  const roofTokens = [];
  const frameTokens = [];

  if (building["Exterior Walls"])
    extTokens.push(...building["Exterior Walls"].split(";").map((s) => s.trim()));
  if (building["Interior Walls"])
    intWallTokens.push(
      ...building["Interior Walls"].split(";").map((s) => s.trim()),
    );
  if (building["Floor Cover"])
    floorTokens.push(...building["Floor Cover"].split(";").map((s) => s.trim()));
  if (building["Roof Cover"]) roofTokens.push(building["Roof Cover"]);
  if (building["Frame Type"]) frameTokens.push(building["Frame Type"]);

  rec.exterior_wall_material_primary = mapExteriorMaterialPrimary(extTokens);
  rec.interior_wall_surface_material_primary = mapInteriorWallSurface(
    intWallTokens,
  );
  rec.flooring_material_primary = mapFlooringMaterial(floorTokens);
  rec.roof_covering_material = mapRoofCovering(roofTokens);
  rec.primary_framing_material = mapPrimaryFraming(frameTokens);

  if (building["Stories"]) {
    const st = parseNumber(building["Stories"]);
    if (st != null) rec.number_of_stories = st;
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
  const structures = buildings.map((b, index) => buildStructureRecordForBuilding(b, index));

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structures;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
