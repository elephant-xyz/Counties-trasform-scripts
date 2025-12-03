// Structure mapping script
// Reads input.html, parses with cheerio, extracts structure info, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
}

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

function toIntRounded(val) {
  if (!val && val !== 0 && val !== "0") {
    return null;
  }
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseLeonBuildings($) {
  const rows = $('tbody.building-table tr');

  return rows
    .map((_, row) => extractBuildingRow($, row))
    .get()
    .filter(Boolean);
}

function extractBuildingRow($, row) {
  const $row = $(row);
  const cells = $row.children('th, td');
  if (cells.length < 6) {
    return null;
  }

  return {
    number: parseInteger($row.attr('data-number') || cells.eq(0).text()),
    card: parseInteger($row.attr('data-card')),
    buildingUse: getCleanText(cells.eq(1)),
    buildingType: getCleanText(cells.eq(2)),
    yearBuilt: parseInteger(cells.eq(3).text()),
    heatedCooledSqFt: parseInteger(cells.eq(4).text()),
    auxiliarySqFt: parseInteger(cells.eq(5).text()),
  };
}

function getCleanText(cell) {
  const text = typeof cell.text === 'function' ? cell.text() : String(cell || '');
  const value = text.replace(/\s+/g, ' ').trim();
  return value || null;
}

function parseInteger(value) {
  if (value == null) {
    return null;
  }

  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) {
    return null;
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toCamelCase(label) {
  if (!label) {
    return '';
  }
  return label
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
}

function parseLeonBuildingDetails($) {
  const characteristics = extractCharacteristicsTable($);
  const areas = extractAreaRows($);

  return {
    characteristics,
    areas,
  };
}

function extractCharacteristicsTable($) {
  const rows = $('#building-details')
    .first()
    .find('table tbody tr');
  const data = {};

  rows.each((_, row) => {
    const label = $(row).find('th').text().replace(/\s+/g, ' ').trim();
    const value = $(row).find('td').text().replace(/\s+/g, ' ').trim();
    if (!label) {
      return;
    }
    const key = toCamelCase(label);
    data[key] = value || null;
  });

  return data;
}

function extractAreaRows($) {
  const rows = $('#building-cards')
    .first()
    .find('table tbody tr');
  return rows
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 3) {
        return null;
      }
      return {
        areaNumber: getCleanText(cells.eq(0)),
        description: getCleanText(cells.eq(1)),
        squareFeet: parseInteger(cells.eq(2).text()),
      };
    })
    .get()
    .filter(Boolean);
}

function extractStructures($) {
  const buildingsTable = parseLeonBuildings($);
  const buildingDetails = parseLeonBuildingDetails($);
  const structures = {};
  for (let index = 1; index < buildingsTable.length; index++) {
    const building = buildingsTable[index];
    let totalArea = null;
    const additionalArea = toIntRounded(building["auxiliarySqFt"]);
    const heatedArea = toIntRounded(building["heatedCooledSqFt"]);
    if (additionalArea && heatedArea) {
      totalArea = heatedArea + additionalArea;
    }
    const buildIndex = index + 1;
    structures[buildIndex.toString()] = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: null,
      exterior_wall_material_secondary: null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: null,
      flooring_material_primary: null,
      flooring_material_secondary: null,
      subfloor_material: null,
      flooring_condition: null,
      interior_wall_structure_material: null,
      interior_wall_surface_material_primary: null,
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: null,
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: null,
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: null,
      foundation_type: null,
      foundation_material: null,
      foundation_waterproofing: null,
      foundation_condition: null,
      ceiling_structure_material: null,
      ceiling_surface_material: null,
      ceiling_insulation_type: null,
      ceiling_height_average: null,
      ceiling_condition: null,
      exterior_door_material: null,
      interior_door_material: null,
      window_frame_material: null,
      window_glazing_type: null,
      window_operation_type: null,
      window_screen_material: null,
      primary_framing_material: null,
      secondary_framing_material: null,
      structural_damage_indicators: null,
      finished_base_area: totalArea,
      finished_upper_story_area: null,
      roof_date: null,
      exterior_wall_condition_primary: null,
      exterior_wall_condition_secondary: null,
      exterior_wall_insulation_type_primary: null,
      exterior_wall_insulation_type_secondary: null,
      finished_basement_area: null,
      foundation_repair_date: null,
      siding_installation_date: null,
      exterior_door_installation_date: null,
      window_installation_date: null,
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      number_of_stories: null,
    };
  }
  if (buildingDetails.characteristics) {
    const roofDesignType = mapRoofDesignType(buildingDetails.characteristics["roofFrame"]);
    const roofMaterialType = mapRoofMaterialType(buildingDetails.characteristics["roofCoverDeck"]);
    const framing = mapFraming(buildingDetails.characteristics["frame"]);
    const o = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: null,
      exterior_wall_material_secondary: null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: null,
      flooring_material_primary: null,
      flooring_material_secondary: null,
      subfloor_material: null,
      flooring_condition: null,
      interior_wall_structure_material: null,
      interior_wall_surface_material_primary: null,
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: null,
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: roofDesignType,
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: roofMaterialType,
      foundation_type: null,
      foundation_material: null,
      foundation_waterproofing: null,
      foundation_condition: null,
      ceiling_structure_material: null,
      ceiling_surface_material: null,
      ceiling_insulation_type: null,
      ceiling_height_average: null,
      ceiling_condition: null,
      exterior_door_material: null,
      interior_door_material: null,
      window_frame_material: null,
      window_glazing_type: null,
      window_operation_type: null,
      window_screen_material: null,
      primary_framing_material: framing.primary,
      secondary_framing_material: framing.secondary,
      structural_damage_indicators: null,

      // Optional/extra fields from schema
      exterior_door_installation_date: null,
      exterior_wall_condition_primary: null,
      exterior_wall_condition_secondary: null,
      exterior_wall_insulation_type_primary: null,
      exterior_wall_insulation_type_secondary: null,
      finished_base_area: null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      foundation_repair_date: null,
      number_of_buildings: null,
      number_of_stories: null,
      roof_date: null,
      siding_installation_date: null,
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      window_installation_date: null,
    };
    // Attempt a minimal mapping for exterior wall material if explicitly recognizable
    const extWall = (buildingDetails.characteristics["exteriorWall"] || "").toLowerCase();
    if (extWall) {
      if (extWall.includes("brick")) o.exterior_wall_material_primary = "Brick";
      else if (extWall.includes("stucco"))
        o.exterior_wall_material_primary = "Stucco";
      else if (extWall.includes("vinyl"))
        o.exterior_wall_material_primary = "Vinyl Siding";
      else if (extWall.includes("wood"))
        o.exterior_wall_material_primary = "Wood Siding";
      else if (extWall.includes("siding"))
        o.exterior_wall_material_primary = null; // ambiguous
    }
    structures["1"] = o;
  }

  return structures;
}

function mapRoofDesignType(roofFrameStr) {
  if (!roofFrameStr) return null;
  const s = roofFrameStr.toLowerCase();
  const hasGable = s.includes("gable");
  const hasHip = s.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (s.includes("flat")) return "Flat";
  return null;
}

function mapRoofMaterialType(roofCoverStr) {
  if (!roofCoverStr) return null;
  const s = roofCoverStr.toLowerCase();
  // Source shows "Composition Shingle"
  if (s.includes("composition")) return "Composition";
  if (s.includes("shingle")) return "Shingle";
  if (s.includes("metal")) return "Metal";
  if (s.includes("tile")) return "Tile";
  if (s.includes("concrete")) return "Concrete";
  if (s.includes("slate")) return "Stone";
  return null;
}

function mapFraming(detailsFrame) {
  // "Wood Beam & Col." -> primary wood frame, secondary wood beams
  if (!detailsFrame) return { primary: null, secondary: null };
  const s = detailsFrame.toLowerCase();
  let primary = null;
  let secondary = null;
  if (s.includes("wood")) primary = "Wood Frame";
  return { primary, secondary };
}

function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) {
    throw new Error("ParcelId not found in input.html");
  }

  const structure = extractStructures($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: structure };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
