// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const BUILDING_SECTION_TITLE = "Buildings"; // Corrected title from HTML
// frameTokens is not used in the current HTML structure for direct extraction,
// but kept for potential future use or if other HTML structures includes it.
const frameTokens = [];

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

  // Collect data from the left column
  const leftColumnData = [];
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl07_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td div span").first().text()); // Adjusted selector for value
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) leftColumnData.push(map);
    });

  // Collect data from the right column and combine with left column data
  let buildingCount = 0;
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl07_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td div span").first().text()); // Adjusted selector for value
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        // Combine with the corresponding building from the left column
        const combined_map = { ...leftColumnData[buildingCount], ...map };
        buildings[buildingCount++] = combined_map;
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
    if (t.includes("CEDAR") || t.includes("WOOD") || t.includes("T-111"))
      out.push("Wood Siding"); // Added T-111
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE") || t.includes("C.B.S."))
      out.push("Concrete Block"); // Added C.B.S.
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
    if (t.includes("DRYWALL")) out.push("Drywall"); // Added Drywall
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("CERAMIC") || t.includes("CERA/CLAY"))
      out.push("Ceramic Tile"); // Added CERA/CLAY
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
  const roofCoverTokens = [];
  const roofDesignTokens = []; // Added for Roof Type
  const foundationTokens = []; // Added for Foundation
  const stories = [];

  buildings.forEach((b) => {
    if (b["Exterior Walls"])
      extTokens.push(...b["Exterior Walls"].split(";").map((s) => s.trim()));
    if (b["Interior Walls"])
      intWallTokens.push(
        ...b["Interior Walls"].split(";").map((s) => s.trim()),
      );
    if (b["Flooring Type"])
      floorTokens.push(...b["Flooring Type"].split(";").map((s) => s.trim())); // Changed from "Floor Cover" to "Flooring Type"
    if (b["Roof Coverage"]) roofCoverTokens.push(b["Roof Coverage"]); // Changed from "Roof Cover" to "Roof Coverage"
    if (b["Roof Type"]) roofDesignTokens.push(b["Roof Type"]); // Added for Roof Type
    if (b["Foundation"]) foundationTokens.push(b["Foundation"]); // Added for Foundation
    if (b["Stories"]) stories.push(parseNumber(b["Stories"].split(" ")[0])); // Extract number from "2 Floor"
  });

  // Exterior materials
  const ext = mapExteriorMaterials(extTokens);
  if (ext.length) {
    rec.exterior_wall_material_primary = ext[0] || null;
    if (ext.length > 1) rec.exterior_wall_material_secondary = ext[1] || null;
  }

  // Interior wall surface
  const intSurf = mapInteriorSurface(intWallTokens);
  if (intSurf.length) {
    rec.interior_wall_surface_material_primary = intSurf[0] || null;
    if (intSurf.length > 1)
      rec.interior_wall_surface_material_secondary = intSurf[1] || null;
  }

  // Flooring
  const floors = mapFlooring(floorTokens);
  if (floors.length) {
    rec.flooring_material_primary = floors[0] || null;
    if (floors.length > 1) rec.flooring_material_secondary = floors[1] || null;
  }

  // Roof covering mapping
  if (roofCoverTokens.length) {
    const u = roofCoverTokens.join(" ").toUpperCase();
    if (u.includes("METAL")) {
      rec.roof_covering_material = "Metal";
    }
    // Add other roof covering types if they appear in the data
  }

  // Roof design type
  if (roofDesignTokens.length) {
    const u = roofDesignTokens.join(" ").toUpperCase();
    if (u.includes("GABLE/HIP")) {
      rec.roof_design_type = "Gable/Hip";
    }
    // Add other roof design types if they appear in the data
  }

  // Foundation type
  if (foundationTokens.length) {
    const u = foundationTokens.join(" ").toUpperCase();
    if (u.includes("CONC PILINGS")) {
      rec.foundation_type = "Piling"; // Assuming "CONC PILINGS" maps to Piling foundation
      rec.foundation_material = "Concrete";
    }
    // Add other foundation types if they appear in the data
  }

  // Stories
  if (stories.length) {
    rec.number_of_stories = Math.max(...stories);
  }

  // Year Built and Effective Year Built
  if (buildings.length > 0) {
    rec.roof_date = buildings[0]["Year Built"]
      ? `${buildings[0]["Year Built"]}-01-01`
      : null; // Assuming roof date is same as year built
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