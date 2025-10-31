// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl08_ctl01_lblParcelID";
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
    "Brick 2": "Brick",
    "Stucco": "Stucco",
    "Aluminum Vinyl": "Vinyl Siding",
    "Concrete Siding": "Concrete Block",
    "Wood": "Wood Siding",
    "Cement Fiber": null,
    "Concrete Block": "Concrete Block",
    "Brick": "Brick",
    "Stone": "Manufactured Stone",
    "Hard Board": null,
    "Concrete Stucco": "Stucco",
    "Aluminum Vinyl (mobile)": "Vinyl Siding",
    "Precast Panel": "Precast Concrete",
    "Jumbo Brick": "Brick",
    "Modular Metal": "Metal Siding",
    "Wood Shingle": "Wood Siding",
    "Log": "Log",
    "Hard Wood": "Wood Siding",
    "Prefinish Metal": "Metal Siding",
    "Glass Thermal": null,
    "Split Block": "Concrete Block",
    "Reinforced Concrete": "Concrete Block",
    "Asphalt Shingles": null
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
  "Drywall": "Drywall",
  "Minimum": null,
  "Plaster": "Plaster",
  "Wood Paneling": "Wood Paneling",
  "Custom Panel": null,
  "Blank Field": null,
  "Panels": null,
  "Wall Board": "Board and Batten",
  "None": null,
  "Decorative": null,
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
    "Composite Shingle": "Architectural Asphalt Shingle",
    "Metal": "Metal Corrugated",
    "Built Up": "Built-Up Roof",
    "Clay Tile": "Clay Tile",
    "Concrete Tile": "Concrete Tile",
    "Wood Shingle": "Wood Shingle",
    "Modular Metal": null,
    "TPO Roofing": "TPO Membrane",
    "Cement Fiber Shingle": null,
    "Roll Composite": null,
    "Corrugated Steel": "Metal Corrugated",
    "Slate": null,
    "Cedar Shanks": null,
    "Copper": null
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
    "Gable Hip": [null, "Combination"],
    "Mansard": [null, "Mansard"],
    "Shed": [null, "Shed"],
    "Flat": [null, "Flat"],
    "Wood Truss": ["Wood Truss", null],
    "Rigid Frame": [null, null],
    "Irregular": [null, null],
    "Steel Frame": ["Steel Truss", null],
    "Saw Tooth": [null, null],
    "Gambrel": [null, "Gambrel"],
    "Reinforced Concrete": [null, "Concrete Beam"],
    "Prestressed Concrete": [null, "Concrete Beam"],
    "Bow Trust": [null, null]
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
    "Carpet": "Carpet",
    "Hardwood": "Solid Hardwood",
    "Ceramic Tile": "Ceramic Tile",
    "Sheet Vinyl": "Sheet Vinyl",
    "Concrete Finish": "Polished Concrete",
    "Pine Wood": "Solid Hardwood",
    "Vinyl Tile": null,
    "Terrazzo": "Terrazzo",
    "Wood Laminate": "Laminate",
    "Asphalt Tile": null,
    "Clay Tile": null,
    "Marble": null,
    "Saturnia": null,
    "Concrete 6-8\"": "Polished Concrete",
    "Minimum Plywood": null,
    "Parquet": null,
    "Hardtile": null,
    "None": null,
    "Epoxy Strp": "Epoxy Coating",
    "Blank Field": null,
    "Slate": null,
    "Stone": "Natural Stone Tile",
    "Vinyl Asbestos": null,
    "Precast Concrete": null
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
    if (b["Exterior Wall"]) {
      const exteriorWallTokens = b["Exterior Wall"].split(/[,;]/);
      for(let extToken of exteriorWallTokens) {
        exterior_wall_material_primary = mapExteriorWallPrimary(extToken);
        if (exterior_wall_material_primary) {
          break;
        }
      }
    }
    if (b["Interior Wall"]) {
      const interiorWallTokens = b["Interior Wall"].split(/[,;]/);
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
    if (b["Roof Structure"]) {
      const roofTokens = b["Roof Structure"].split(/[,;]/);
      for(let roofToken of roofTokens) {
        let roof_structure_design_value = mapRoofStructureAndDesign(roofToken);
        if (!roof_structure_design[0]) {
          roof_structure_design[0] = roof_structure_design_value[0];
        }
        if (!roof_structure_design[1]) {
          roof_structure_design[1] = roof_structure_design_value[1];
        }
        if (roof_structure_design[0] && roof_structure_design[1]) {
          break;
        }
      }
    }
    if (b["Interior Flooring"]) {
      const floorTokens = b["Interior Flooring"].split(/[,;]/);
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
