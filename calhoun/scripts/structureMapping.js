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
const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span"; // Corrected to target the span containing the Parcel ID
const BUILDING_SECTION_TITLE = "Building Information"; // Corrected title from HTML

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

  // Find all building blocks within the section
  const buildingBlocks = section.find(".block-row");

  buildingBlocks.each((blockIndex, blockElement) => {
    const currentBuildingData = {};

    // Collect data from the left column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    // Collect data from the right column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    if (Object.keys(currentBuildingData).length) {
      buildings.push(currentBuildingData);
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
    if (t.includes("BLOCK") || t.includes("CONCRETE"))
      out.push("Concrete Block");
    if (t.includes("METAL")) out.push("Metal Siding");
    if (t.includes("SIDING") && !t.includes("VINYL") && !t.includes("WOOD"))
      out.push("Metal Siding");
  });
  return out;
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("DRYWALL") || t.includes("GYPSUM")) out.push("Drywall");
    else if (t.includes("PLASTER")) out.push("Plaster");
    else if (t.includes("BRK") || t.includes("BRICK")) out.push("Exposed Brick");
    else if (t.includes("BLOCK") || t.includes("CONCRETE"))
      out.push("Exposed Block");
    else if (
      t.includes("WOOD") ||
      t.includes("PLYWOOD") ||
      t.includes("PANEL") ||
      t.includes("WAIN") ||
      t.includes("BOARD")
    )
      out.push("Wood Paneling");
    else if (t.includes("STONE")) out.push("Stone Veneer");
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL") || t.includes("SHT VINYL")) out.push("Sheet Vinyl"); // Added SHT VINYL
    if (t.includes("CERAMIC")) out.push("Ceramic Tile");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
  });
  return out;
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function createEmptyStructureRecord(parcelId) {
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
    number_of_buildings: null,
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
    request_identifier: parcelId,
  };
}

function collectTokens(str) {
  if (!str) return [];
  return String(str)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapRoofCover(val) {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (upper.includes("METAL") || upper.includes("MT"))
    return "Metal Standing Seam";
  if (upper.includes("COMP") || upper.includes("SHNGL") || upper.includes("SHINGLE"))
    return "Architectural Asphalt Shingle";
  if (upper.includes("TPO")) return "TPO Membrane";
  if (upper.includes("EPDM")) return "EPDM Membrane";
  if (upper.includes("MODIFIED") || upper.includes("BITUM"))
    return "Modified Bitumen";
  if (upper.includes("BUILT"))
    return "Built-Up Roof";
  if (upper.includes("SLATE")) return "Natural Slate";
  if (upper.includes("CLAY")) return "Clay Tile";
  if (upper.includes("CONCRETE")) return "Concrete Tile";
  if (upper.includes("WOOD")) return "Wood Shake";
  return null;
}

function buildStructureRecords(parcelId, buildings) {
  const totalBuildings = buildings.length || null;
  return buildings.map((b, idx) => {
    const structure = createEmptyStructureRecord(parcelId);

    const extTokens = collectTokens(b["Exterior Walls"]);
    const intTokens = collectTokens(b["Interior Walls"]);
    const floorTokens = collectTokens(b["Floor Cover"]);

    const exteriorMaterials = mapExteriorMaterials(extTokens);
    if (exteriorMaterials.length) {
      structure.exterior_wall_material_primary = exteriorMaterials[0];
      if (exteriorMaterials.length > 1) {
        structure.exterior_wall_material_secondary = exteriorMaterials[1];
      }
    }

    const interiorSurface = mapInteriorSurface(intTokens);
    if (interiorSurface.length) {
      structure.interior_wall_surface_material_primary = interiorSurface[0];
      if (interiorSurface.length > 1) {
        structure.interior_wall_surface_material_secondary = interiorSurface[1];
      }
    }

    const flooring = mapFlooring(floorTokens);
    if (flooring.length) {
      structure.flooring_material_primary = flooring[0];
      if (flooring.length > 1) {
        structure.flooring_material_secondary = flooring[1];
      }
    }

    const roofCover = mapRoofCover(b["Roof Cover"]);
    if (roofCover) {
      structure.roof_covering_material = roofCover;
    }

    const stories = parseNumber(b["Stories"]);
    if (stories != null) {
      structure.number_of_stories = stories;
    }

    structure.number_of_buildings = totalBuildings;

    return {
      building_number: idx + 1,
      structure,
    };
  });
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  // Corrected: Call collectBuildings and store its result in a variable
  const buildings = collectBuildings($);
  const structureRecords = buildStructureRecords(parcelId, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structureRecords;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
