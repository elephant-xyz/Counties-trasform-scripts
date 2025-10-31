// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue span";
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
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;

  // Select all individual building blocks within the section
  $(section)
    .find('.module-content > .block-row') // Each block-row contains data for one building
    .each((_, blockRow) => {
      const buildingData = {};

      // Extract data from the left column
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      // Extract data from the right column (if present)
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      if (Object.keys(buildingData).length) {
        buildings.push(buildingData);
      }
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
    if (t.includes("WD ON PLY")) out.push("Wood Siding"); // Specific to the provided HTML
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
    if (t.includes("DRYWALL")) out.push("Drywall"); // Specific to the provided HTML
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
    if (t.includes("AVERAGE")) out.push("Average Quality Flooring"); // Specific to the provided HTML
  });
  return out;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecord($, buildings) {
  // Defaults per schema requirements (all present, many null)
  const rec = {
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
  const totalAreas = [];
  const heatedAreas = [];
  const actualYearBuilt = [];

  buildings.forEach((b) => {
    if (b["Exterior Walls"])
      extTokens.push(...b["Exterior Walls"].split(";").map((s) => s.trim()));
    if (b["Interior Walls"])
      intWallTokens.push(
        ...b["Interior Walls"].split(";").map((s) => s.trim()),
      );
    if (b["Floor Cover"])
      floorTokens.push(...b["Floor Cover"].split(";").map((s) => s.trim()));
    if (b["Roof Cover"]) roofTokens.push(b["Roof Cover"]);
    if (b["Frame Type"]) frameTokens.push(b["Frame Type"]);
    if (b["Stories"]) {
      const st = parseNumber(b["Stories"]);
      if (st != null) stories.push(st);
    }
    if (b["Total Area"]) {
      const ta = parseNumber(b["Total Area"]);
      if (ta != null) totalAreas.push(ta);
    }
    if (b["Heated Area"]) {
      const ha = parseNumber(b["Heated Area"]);
      if (ha != null) heatedAreas.push(ha);
    }
    if (b["Actual Year Built"]) {
      const ayb = parseNumber(b["Actual Year Built"]);
      if (ayb != null) actualYearBuilt.push(ayb);
    }
  });

  // Exterior materials
  const ext = mapExteriorMaterials(extTokens);
  if (ext.length) {
    // Choose primary material as the most common/first detected
    rec.exterior_wall_material_primary = ext[0] || null;
    if (ext.length > 1) {
      rec.exterior_wall_material_secondary = ext[1] || null;
    }
  }

  // Interior wall surface
  const intSurf = mapInteriorSurface(intWallTokens);
  if (intSurf.length) {
    rec.interior_wall_surface_material_primary = intSurf[0] || null;
    if (intSurf.length > 1) {
      rec.interior_wall_surface_material_secondary = intSurf[1] || null;
    }
  }

  // Flooring
  const floors = mapFlooring(floorTokens);
  if (floors.length) {
    rec.flooring_material_primary = floors[0] || null;
    if (floors.length > 1) {
      rec.flooring_material_secondary = floors[1] || null;
    }
  }

  // Roof covering mapping
  if (roofTokens.length) {
    const u = roofTokens.join(" ").toUpperCase();
    if (
      u.includes("ENG SHINGL") ||
      u.includes("ARCH") ||
      u.includes("ARCHITECT")
    ) {
      rec.roof_covering_material = "Architectural Asphalt Shingle";
    } else if (u.includes("MTL RIB PN")) { // Specific to the provided HTML
      rec.roof_covering_material = "Metal Rib Panel";
    }
  }

  // Framing
  if (frameTokens.join(" ").toUpperCase().includes("WOOD")) {
    rec.primary_framing_material = "Wood Frame";
  }

  // Stories
  if (stories.length) {
    // Use max stories across buildings
    rec.number_of_stories = Math.max(...stories);
  }

  // Finished Base Area (assuming Heated Area is finished area)
  if (heatedAreas.length) {
    rec.finished_base_area = heatedAreas.reduce((sum, val) => sum + val, 0);
  }

  // Year Built (assuming the earliest year built if multiple buildings)
  if (actualYearBuilt.length) {
    rec.year_built = Math.min(...actualYearBuilt);
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