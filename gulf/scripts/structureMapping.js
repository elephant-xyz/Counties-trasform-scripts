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

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Frame");
    if (t.includes("STEEL")) out.push("Steel Frame");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
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

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecord($, buildings) {
  let structures = {};
  buildings.forEach((b, bIdx) => {
    let exterior_wall_material_primary = null;
    let interior_wall_structure_material_primary = null;
    let roof_covering_material = null;
    let flooring_material_primary = null;
    let primary_framing_material = null;
    if (b["Exterior Walls"]) {
      const exteriorWallTokens = b["Exterior Walls"].split(/[,;]/);
      const exterior_wall_material_primary_arr = mapExteriorMaterials(exteriorWallTokens);
      if (exterior_wall_material_primary_arr && exterior_wall_material_primary_arr.length > 0) {
        exterior_wall_material_primary = exterior_wall_material_primary_arr[0];
      }
    }
    if (b["Interior Walls"]) {
      const interiorWallTokens = b["Interior Walls"].split(/[,;]/);
      const interior_wall_structure_material_primary_arr = mapInteriorSurface(interiorWallTokens);
      if (interior_wall_structure_material_primary_arr && interior_wall_structure_material_primary_arr.length > 0) {
        interior_wall_structure_material_primary = interior_wall_structure_material_primary_arr[0];
      }
    }
    if (b["Frame Type"]) {
      const frameTokens = b["Frame Type"].split(/[,;]/);
      if (frameTokens.join(" ").toUpperCase().includes("WOOD")) {
        primary_framing_material = "Wood Frame";
      }
    }
    if (b["Roof Cover"]) {
      const roofCoverTokens = b["Roof Cover"].split(/[,;]/);
      for(let roofCoverToken of roofCoverTokens) {
       if (
      roofCoverToken.includes("ENG SHINGL") ||
      roofCoverToken.includes("ARCH") ||
      roofCoverToken.includes("ARCHITECT")
        ) {
          roof_covering_material = "Architectural Asphalt Shingle";
        }
      }
    }
    if (b["Floor Cover"]) {
      const floorTokens = b["Floor Cover"].split(/[,;]/);
      const flooring_material_primary_arr = mapFlooring(floorTokens);
      if (flooring_material_primary_arr && flooring_material_primary_arr.length > 0) {
        flooring_material_primary = flooring_material_primary_arr[0];
      }
    }
    const structure = {
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
      exterior_wall_material_primary: exterior_wall_material_primary,
      exterior_wall_material_secondary: null,
      finished_base_area: null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      flooring_condition: null,
      flooring_material_primary: flooring_material_primary,
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
      interior_wall_structure_material_primary: interior_wall_structure_material_primary,
      interior_wall_structure_material_secondary: null,
      interior_wall_surface_material_primary: null,
      interior_wall_surface_material_secondary: null,
      number_of_stories: null,
      primary_framing_material: primary_framing_material,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: roof_covering_material,
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
    structures[(bIdx + 1).toString()] = structure;
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
  const structureRecord = buildStructureRecord($, buildings);

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
