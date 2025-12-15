// structureMapping.js
// Reads input.json, extracts structure data, and writes to data/structure_data.json and owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(fp) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    // Some sources may contain HTML-encoded strings inside JSON fields; cheerio can help strip tags if needed
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function cleanText(str) {
  if (str == null) return null;
  try {
    const $ = cheerio.load(String(str));
    return $.text().trim() || null;
  } catch (e) {
    return String(str);
  }
}

function mapRoofDesignType(value) {
  if(!value || !value.trim()) {
    return [null, null];
  }
  value = value.trim().toUpperCase();
  const roofDesignMap = {
    "FLAT": ["Flat", null],
    "SHED": ["Shed", null],
    "GABLE/HIP": ["Combination", null],
    "MANSFORD/GAMBLE": ["Mansard", null],
    "WOOD FRAME/TRUSS": [null, "Wood Truss"],
    "BAR JOIST/RIGID FRAME": [null, null],
    "STEEL TRUSS": [null, "Steel Truss"],
    "REINFORCED CONCRETE": [null, "Concrete Beam"],
    "PRESTRUCTURED CONCRETE": [null, "Concrete Beam"],
    "IRREGULAR": [null, null],
  }
  if (value in roofDesignMap) {
    return roofDesignMap[value];
  }
  return [null, null];
}

function parseExteriorWall(value) {
  if(!value || !value.trim()) {
    return null;
  }
  value = value.trim().toUpperCase();
  const exteriorWallMap = {
    "UNFINISHED": null,
    "CORRUGATED METAL": "Metal Siding",
    "SIDING MINIMAL": null,
    "SIDING BELOW AVERAGE": null,
    "SIDING AVERAGE": null,
    "SIDING ABOVE AVERAGE": null,
    "FRAME STUCCO": "Stucco",
    "CONCRETE BLOCK": "Concrete Block",
    "FRAME STUCCO/BRICK": "Stucco",
    "CONCRETE BLOCK STUCCO": "Concrete Block",
    "CONCRETE BLOCK SIDING": "Concrete Block",
    "CONCRETE BLOCK METAL SIDING": "Concrete Block",
    "BRICK": "Brick",
    "CONCRETE BLOCK STUCCO/BRICK": "Concrete Block",
    "POURED CONCRETE": null,
    "CEMENT BRICK": "Brick",
    "PREFINISHED METAL": "Metal Siding",
    "PRECAST CONCRETE": "Precast Concrete",
    "GLASS": null,
    "LOG": "Log",
    "STONE": "Manufactured Stone",
    "ALUMINUM SIDING": "Metal Siding",
    "VINYL SIDING": "Vinyl Siding",
    "FRAME HARDIBOARD": null,
    "CONCRETE BLOCK HARDIBOARD": "Concrete Block",
  }
  if (value in exteriorWallMap) {
    return exteriorWallMap[value];
  }
  return null;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const data = readJSON(inputPath);

  const parcel = data?.ParcelInformation?.response?.value?.[0] || {};
  const structEls = data?.StructureElements?.response?.value || [];
  const buildings = data?.Building?.response?.value || []; // Assuming a 'Building' array exists in input.json

  const strap =
    cleanText(parcel.dsp_strap) || cleanText(parcel.strap) || "unknown";
  const propertyKey = `property_${strap.trim()}`;

  const allStructures = {};
  let buildIndex = 1;
  // Iterate over each building to create a separate structure object
  for (const building of buildings) {
    const buildingNumber = building.CardNumber;

    // Filter structure elements and sub-areas relevant to the current building
    const buildingStructEls = structEls.filter(
      (e) => e.bld_num === buildingNumber,
    );

    const roofStructs = buildingStructEls
      .filter((e) => e?.tp_dscr === "ROOF STRUCTURE")
      .map((e) => cleanText(e?.cd_dscr))
      .filter(Boolean);
    const exteriorWalls = buildingStructEls
      .filter((e) => e?.tp_dscr === "EXTERIOR WALL")
      .map((e) => cleanText(e?.cd_dscr))
      .filter(Boolean);
    let roofValue = [null, null];
    let extValue = null;
    for(let roofStruct of roofStructs) {
      roofValue = mapRoofDesignType(roofStruct);
      if (roofValue[0] || roofValue[1]) {
        break;
      }
    }
    for(let exteriorWall of exteriorWalls) {
      extValue = parseExteriorWall(exteriorWall);
      if (extValue) {
        break;
      }
    }
    // Build structure object following schema with explicit keys
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
      exterior_wall_material_primary: extValue,
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
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: null,
      roof_date: null,
      roof_design_type: roofValue[0],
      roof_material_type: null,
      roof_structure_material: roofValue[1],
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

    allStructures[buildIndex.toString()] = structure;
    buildIndex++;
  }

  // Output containers
  const out = {};
  out[propertyKey] = allStructures; // Store the array of structures under the property key

  // Write to data/ and owners/
  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);

  fs.writeFileSync(
    path.join(ownersDir, "structure_data.json"),
    JSON.stringify(out, null, 2),
  );

  // Simple console confirmation
  console.log("Structure mapping complete for property:", propertyKey);
})();