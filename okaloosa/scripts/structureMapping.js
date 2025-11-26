// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
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

function mapExteriorWallPrimary(token) {
  if (!token) {
    return null;
  }
  const exteriorWallMapping = {
    "BRICK 2": "Brick",
    "STUCCO": "Stucco",
    "ALUMINUM VINYL": "Vinyl Siding",
    "CONCRETE SIDING": "Concrete Block",
    "WOOD": "Wood Siding",
    "CEMENT FIBER": null,
    "CONCRETE BLOCK": "Concrete Block",
    "BRICK": "Brick",
    "STONE": "Manufactured Stone",
    "HARD BOARD": null,
    "CONCRETE STUCCO": "Stucco",
    "ALUMINUM VINYL (MOBILE)": "Vinyl Siding",
    "PRECAST PANEL": "Precast Concrete",
    "JUMBO BRICK": "Brick",
    "MODULAR METAL": "Metal Siding",
    "WOOD SHINGLE": "Wood Siding",
    "LOG": "Log",
    "HARD WOOD": "Wood Siding",
    "PREFINISH METAL": "Metal Siding",
    "GLASS THERMAL": null,
    "SPLIT BLOCK": "Concrete Block",
    "REINFORCED CONCRETE": "Concrete Block",
    "ASPHALT SHINGLES": null
  }
  if (token in exteriorWallMapping) {
    return exteriorWallMapping[token];
  }
  return null;
}

function mapInteriorWallPrimary(token) {
  if (!token) {
    return null;
  }
  const interiorWallMapping = {
  "DRYWALL": "Drywall",
  "MINIMUM": null,
  "PLASTER": "Plaster",
  "WOOD PANELING": "Wood Paneling",
  "CUSTOM PANEL": null,
  "BLANK FIELD": null,
  "PANELS": null,
  "WALL BOARD": "Board and Batten",
  "NONE": null,
  "DECORATIVE": null,
  "N/A": null
  }
  if (token in interiorWallMapping) {
    return interiorWallMapping[token];
  }
  return null;
}

function mapRoofCover(token) {
  if (!token) {
    return null;
  }
  const roofCoverMapping = {
    "COMPOSITE SHINGLE": "Architectural Asphalt Shingle",
    "METAL": "Metal Corrugated",
    "BUILT UP": "Built-Up Roof",
    "CLAY TILE": "Clay Tile",
    "CONCRETE TILE": "Concrete Tile",
    "WOOD SHINGLE": "Wood Shingle",
    "MODULAR METAL": null,
    "TPO ROOFING": "TPO Membrane",
    "CEMENT FIBER SHINGLE": null,
    "ROLL COMPOSITE": null,
    "CORRUGATED STEEL": "Metal Corrugated",
    "SLATE": null,
    "CEDAR SHANKS": null,
    "COPPER": null
  }
  if (token in roofCoverMapping) {
    return roofCoverMapping[token];
  }
  return null;
}

function mapRoofStructureAndDesign(token) {
  if (!token) {
    return [null, null];
  }
  const roofMapping = {
    "GABLE HIP": [null, "Combination"],
    "MANSARD": [null, "Mansard"],
    "SHED": [null, "Shed"],
    "FLAT": [null, "Flat"],
    "WOOD TRUSS": ["Wood Truss", null],
    "RIGID FRAME": [null, null],
    "IRREGULAR": [null, null],
    "STEEL FRAME": ["Steel Truss", null],
    "SAW TOOTH": [null, null],
    "GAMBREL": [null, "Gambrel"],
    "REINFORCED CONCRETE": [null, "Concrete Beam"],
    "PRESTRESSED CONCRETE": [null, "Concrete Beam"],
    "BOW TRUST": [null, null]
  }
  if (token in roofMapping) {
    return roofMapping[token];
  }
  return [null, null];
}

function mapFloor(token) {
  if (!token) {
    return null;
  }
  const floorMapping = {
    "CARPET": "Carpet",
    "HARDWOOD": "Solid Hardwood",
    "CERAMIC TILE": "Ceramic Tile",
    "SHEET VINYL": "Sheet Vinyl",
    "CONCRETE FINISH": "Polished Concrete",
    "PINE WOOD": "Solid Hardwood",
    "VINYL TILE": null,
    "TERRAZZO": "Terrazzo",
    "WOOD LAMINATE": "Laminate",
    "ASPHALT TILE": null,
    "CLAY TILE": null,
    "MARBLE": null,
    "SATURNIA": null,
    "CONCRETE 6-8\"": "Polished Concrete",
    "MINIMUM PLYWOOD": null,
    "PARQUET": null,
    "HARDTILE": null,
    "NONE": null,
    "EPOXY STRP": "Epoxy Coating",
    "BLANK FIELD": null,
    "SLATE": null,
    "STONE": "Natural Stone Tile",
    "VINYL ASBESTOS": null,
    "PRECAST CONCRETE": null
  }
  if (token in floorMapping) {
    return floorMapping[token];
  }
  return null;
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
    let interior_wall_surface_material_primary = null;
    let roof_covering_material = null;
    let roof_structure_design = [null, null];
    let flooring_material_primary = null;
    if (b["Exterior Walls"]) {
      const exteriorWallTokens = b["Exterior Walls"].split(/[,;]/);
      for(let extToken of exteriorWallTokens) {
        exterior_wall_material_primary = mapExteriorWallPrimary(extToken);
        if (exterior_wall_material_primary) {
          break;
        }
      }
    }
    if (b["Interior Walls"]) {
      const interiorWallTokens = b["Interior Walls"].split(/[,;]/);
      for(let intToken of interiorWallTokens) {
        interior_wall_surface_material_primary = mapInteriorWallPrimary(intToken);
        if (interior_wall_surface_material_primary) {
          break;
        }
      }
    }
    if (b["Roof Cover"]) {
      const roofCoverTokens = b["Roof Cover"].split(/[,;]/);
      for(let roofCoverToken of roofCoverTokens) {
        roof_covering_material = mapRoofCover(roofCoverToken);
        if (roof_covering_material) {
          break;
        }
      }
    }
    // if (b["Roof Structure"]) {
    //   const roofTokens = b["Roof Structure"].split(/[,;]/);
    //   for(let roofToken of roofTokens) {
    //     let roof_structure_design_value = mapRoofStructureAndDesign(roofToken);
    //     if (!roof_structure_design[0]) {
    //       roof_structure_design[0] = roof_structure_design_value[0];
    //     }
    //     if (!roof_structure_design[1]) {
    //       roof_structure_design[1] = roof_structure_design_value[1];
    //     }
    //     if (roof_structure_design[0] && roof_structure_design[1]) {
    //       break;
    //     }
    //   }
    // }
    if (b["Floor Cover"]) {
      const floorTokens = b["Floor Cover"].split(/[,;]/);
      for(let floorToken of floorTokens) {
        flooring_material_primary = mapFloor(floorToken);
        if (flooring_material_primary) {
          break;
        }
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
      interior_wall_structure_material_primary: null,
      interior_wall_structure_material_secondary: null,
      interior_wall_surface_material_primary: interior_wall_surface_material_primary,
      interior_wall_surface_material_secondary: null,
      number_of_stories: null,
      primary_framing_material: null,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: roof_covering_material,
      roof_date: null,
      roof_design_type: roof_structure_design[1],
      roof_material_type: null,
      roof_structure_material: roof_structure_design[0],
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
