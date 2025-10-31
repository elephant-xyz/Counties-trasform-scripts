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
    "VINYL": "Vinyl Siding",
    "CONC BLOCK": "Concrete Block",
    "PREFAB": null,
    "AVERAGE": null,
    "CEDAR": "Wood Siding",
    "BD/BTN ABV": null,
    "AL SIDING": "Metal Siding",
    "PREFIN MTL": null,
    "WALL BOARD": null,
    "MINIMUM": null,
    "ABOVE AVG.": null,
    "COMMON BRK": "Brick",
    "WD FR STUC": null,
    "MOD METAL": "Metal Siding",
    "SINGLE SID": null,
    "WD ON PLY": null,
    "ASB SHNGLE": null,
    "LOG": "Log",
    "BD/BAT AVG": null,
    "STONE": "Manufactured Stone",
    "CB STUCCO": "Stucco",
    "BELOW AVG.": null,
    "FACE BRICK": "Brick",
    "CEMENT BRK": "Brick",
    "NONE": null,
    "CORG METAL": "Metal Siding",
    "WD SHINGLE": null,
    "PRECAST PN": "Precast Concrete",
    "REINF CONC": "Concrete Block",
    "GLASS THRM": null
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
    "PLYWOOD": null,
    "CUST PANEL": null,
    "WALL BD/WD": null,
    "MINIMUM": null,
    "PLASTER": "Plaster",
    "NONE": null,
    "DECORATIVE": null
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
    "ENG SHINGL": "3-Tab Asphalt Shingle",
    "MODULAR MT": null,
    "COMP SHNGL": "Architectural Asphalt Shingle",
    "MINIMUM": null,
    "ROLL COMP": null,
    "STAND SEAM": null,
    "BUILT-UP": "Built-Up Roof",
    "POLY TPO": "TPO Membrane",
    "CLAY TILE": "Clay Tile",
    "SYNTH METL": null,
    "CEDAR SHAK": "Wood Shake",
    "WD SHINGLE": "Wood Shingle",
    "ASB SHINGL": null,
    "CONC TILE": "Concrete Tile",
    "CORG ASB": null
  }
  if (token in roofCoverMapping) {
    return roofCoverMapping[token];
  }
  return null;
}

function mapFloor(token) {
  if (!token) {
    return null;
  }
  const floorMapping = {
    "CARPET": "Carpet",
    "SHT VINYL": "Sheet Vinyl",
    "VINYL PLNK": "Luxury Vinyl Plank",
    "CLAY TILE": null,
    "PINE WOOD": null,
    "CORK/VTILE": "Cork",
    "HARDWOOD": "Solid Hardwood",
    "PARQUET": null,
    "MIN PLYWD": null,
    "ASPH TILE": null,
    "CONC FINSH": "Polished Concrete",
    "TERRAZZO": "Terrazzo",
    "NONE": null,
    "VINYL ASB": "Sheet Vinyl",
    "C ABOVE GD": null,
    "PRECAST CN": null,
    "HARDTILE": null,
    "CUSTOM CON": null,
    "EPOXY STRP": "Epoxy Coating",
    "MARBLE": null,
    "SLATE": null
  }
  if (token in floorMapping) {
    return floorMapping[token];
  }
  return null;
}

function mapFrame(token) {
  if (!token) {
    return null;
  }
  const frameMapping = {
    "STEEL": "Steel Frame",
    "WOOD FRAME": "Wood Frame",
    "NONE": null,
    "FIREPROOF": null,
    "MASONRY": "Masonry",
    "REIN CONC": "Concrete Block",
    "N/A": null,
    "SPECIAL": null,
  }
  if (token in frameMapping) {
    return frameMapping[token];
  }
  return null;
}

function buildStructureRecord($, buildings) {
  let structures = {};
  buildings.forEach((b, bIdx) => {
    let exterior_wall_material_primary = null;
    let interior_wall_surface_material_primary = null;
    let roof_covering_material = null;
    let flooring_material_primary = null;
    let primary_framing_material = null;
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
    if (b["Floor Cover"]) {
      const floorTokens = b["Floor Cover"].split(/[,;]/);
      for(let floorToken of floorTokens) {
        flooring_material_primary = mapFloor(floorToken);
        if (flooring_material_primary) {
          break;
        }
      }
    }
    if (b["Frame Type"]) {
      const frameTokens = b["Frame Type"].split(/[,;]/);
      for(let frameToken of frameTokens) {
        primary_framing_material = mapFrame(frameToken);
        if (primary_framing_material) {
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
