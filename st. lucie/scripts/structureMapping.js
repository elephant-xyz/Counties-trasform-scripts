// Structure Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// --- Start of extraFeatureHelpers.js content ---

function tokenizeFeatureText(text) {
  return (text || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function parseNumeric(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseExtraFeatures($) {
  const features = [];

  const selectors = [
    "#sfyi-info .sfyi-grid table.table-striped tbody tr",
    "#extra-features table tbody tr",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const row = $(el);
      const typeCell = row.find("th, td").first();
      const type = (typeCell.text() || "").trim();
      if (!type) return;

      // Re-evaluating based on common table structures:
      // If the first cell is <th>, then data starts from <td> at index 0.
      // If the first cell is <td> and it's the 'type', then data starts from <td> at index 1.
      let quantity = null;
      let unitsValue = null;
      let yearBuilt = null;
      let unitsRaw = null;

      const allTds = row.find("td");

      // Determine if the first cell was a <th> or <td> to adjust indices
      const isTypeInTh = typeCell.is('th');

      if (isTypeInTh) {
        // If type is in <th>, then all <td>s are data cells
        if (allTds.length >= 1) {
          quantity = parseNumeric(allTds.eq(0).text().trim());
          unitsRaw = allTds.eq(0).text().trim(); // Capture raw units text
        }
        if (allTds.length >= 2) {
          unitsValue = parseNumeric(allTds.eq(1).text().trim());
        }
        if (allTds.length >= 3) {
          yearBuilt = parseNumeric(allTds.eq(2).text().trim());
        }
      } else {
        // If type is in <td>, then the first <td> is the type, and data starts from the second <td>
        if (allTds.length >= 2) { // type (0), quantity (1)
          quantity = parseNumeric(allTds.eq(1).text().trim());
          unitsRaw = allTds.eq(1).text().trim(); // Capture raw units text
        }
        if (allTds.length >= 3) { // type (0), quantity (1), units (2)
          unitsValue = parseNumeric(allTds.eq(2).text().trim());
        }
        if (allTds.length >= 4) { // type (0), quantity (1), units (2), yearBuilt (3)
          yearBuilt = parseNumeric(allTds.eq(3).text().trim());
        }
      }

      features.push({
        rawType: type,
        tokens: tokenizeFeatureText(type),
        quantity: quantity,
        unitsRaw: unitsRaw,
        unitsValue: unitsValue,
        yearBuilt: yearBuilt ? Math.round(yearBuilt) : null,
      });
    });
  });

  return features;
}

function hasToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.includes(normalized);
}

function hasApproxToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.some(
    (t) => t.startsWith(normalized) || normalized.startsWith(t),
  );
}

function hasAnyToken(feature, tokens) {
  return tokens.some((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

function hasAllTokens(feature, tokens) {
  return tokens.every((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

// --- End of extraFeatureHelpers.js content ---


function mergeUpdateValue(target, value) {
  if (value == null) return target;
  if (Array.isArray(value)) {
    const base = Array.isArray(target) ? target : target == null ? [] : [target];
    const merged = base.slice();
    value.forEach((item) => {
      if (item == null) return;
      if (!merged.includes(item)) merged.push(item);
    });
    return merged;
  }
  if (target == null) return value;
  if (Array.isArray(target)) {
    if (!target.includes(value)) target.push(value);
    return target;
  }
  if (target === value) return target;
  return [target, value];
}

function recordFeatureUsage(map, feature, updates = {}, buildingNumber = null) {
  if (!feature) return;
  const key = feature.rawType || (feature.tokens ? feature.tokens.join("|") : `feature_${map.size + 1}`);
  if (!map.has(key)) {
    map.set(key, {
      raw_type: feature.rawType || null,
      tokens: feature.tokens || null,
      building_number: buildingNumber != null ? buildingNumber : null,
      source: "extra_feature",
      mapped_fields: {},
    });
  }
  const entry = map.get(key);
  if (updates && typeof updates === "object") {
    for (const [field, value] of Object.entries(updates)) {
      if (value == null) continue;
      entry.mapped_fields[field] = mergeUpdateValue(entry.mapped_fields[field], value);
    }
  }
}

function normalizeFeatureUsageOutput(map) {
  return Array.from(map.values()).map((entry) => {
    if (entry.tokens && entry.tokens.length === 0) entry.tokens = null;
    if (entry.mapped_fields && Object.keys(entry.mapped_fields).length === 0) {
      delete entry.mapped_fields;
    }
    return entry;
  });
}

function extractTotalBuildingCount(buildingSections) {
  if (!buildingSections || buildingSections.length === 0) return null;
  const sequenceText = buildingSections.first().find(".building-sequence").text().trim();
  if (!sequenceText) return null;
  const match = sequenceText.match(/\((\d+)\s*of\s*(\d+)\)/i);
  return match ? parseInt(match[2], 10) || null : null;
}

function extractBuildingNumber($, $building, fallbackIndex) {
  if (!$building) return fallbackIndex + 1;
  const sequenceText = $building.find(".building-sequence").text().trim();
  if (sequenceText) {
    const directMatch = sequenceText.match(/Building\s*(?:No\.?|#)?\s*(\d+)/i);
    if (directMatch) {
      const n = parseInt(directMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    const ordinalMatch = sequenceText.match(/\((\d+)\s*of\s*\d+\)/i);
    if (ordinalMatch) {
      const n = parseInt(ordinalMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    const genericMatch = sequenceText.match(/\b(\d+)\b/);
    if (genericMatch) {
      const n = parseInt(genericMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  const attr = $building.attr("data-building-number");
  if (attr && !Number.isNaN(Number(attr))) return Number(attr);
  return fallbackIndex + 1;
}


function loadHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  // NEW: Strip Angular-specific attributes
  html = html.replace(/_ngcontent-[a-z0-9-]+=""/g, '');
  html = html.replace(/_nghost-[a-z0-9-]+=""/g, '');
  html = html.replace(/ng-version="[0-9.]+"/g, ''); // Also remove ng-version if present

  return cheerio.load(html);
}

function getParcelId($) {
  // Find Parcel ID within Property Identification section
  const table = $("#property-identification table.container").first();
  let parcelId = null;
  table.find("tr").each((i, el) => {
    const $row = $(el); // Use $(el) here
    const th = $row.find("th").first().text().trim();
    if (/Parcel ID/i.test(th)) {
      const td = $row.find("td").first();
      const bold = td.find("b");
      parcelId = (bold.text() || td.text() || "").trim();
      return false; // Stop iterating once found
    }
  });
  return parcelId || "unknown";
}

// This function now expects the first argument to be the *global* Cheerio object,
// and the second argument to be the Cheerio object representing the *scope* to search within.
function getTextFromTableByLabel($, $scope, containerSelector, label) {
  const container = $scope.find(containerSelector).first(); // Use $scope.find instead of $()
  let found = null;
  container.find("tr").each((i, el) => {
    const $row = $(el); // Now $ is defined here
    const th = $row.find("th").first().text().trim();
    if (th.toLowerCase().includes(label.toLowerCase())) {
      const val = $row.find("td").first().text().trim();
      found = val || null;
      return false; // Stop iterating once found
    }
  });
  return found;
}

function mapExteriorWallMaterial(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("brick")) return "Brick";
  if (t.includes("stucco")) return "Stucco";
  if (t.includes("vinyl")) return "Vinyl Siding";
  if (t.includes("wood")) return "Wood Siding";
  if (t.includes("fiber cement") || t.includes("hardie"))
    return "Fiber Cement Siding";
  if (t.includes("metal")) return "Metal Siding";
  if (t.includes("block") || t.includes("cbs") || t.includes("concrete block"))
    return "Concrete Block";
  if (t.includes("stone")) return "Natural Stone";
  if (t.includes("eifs")) return "EIFS";
  if (t.includes("log")) return "Log";
  if (t.includes("adobe")) return "Adobe";
  if (t.includes("precast")) return "Precast Concrete";
  if (t.includes("curtain")) return "Curtain Wall";
  if (t.includes("wood/sheath")) return "Wood Siding"; // Added mapping for "Wood/Sheath"
  return null;
}

function mapExteriorWallMaterialSecondary(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  // Map to accent/trim values only (valid for exterior_wall_material_secondary)
  if (t.includes("brick")) return "Brick Accent";
  if (t.includes("stone")) return "Stone Accent";
  if (t.includes("wood")) return "Wood Trim";
  if (t.includes("metal")) return "Metal Trim";
  if (t.includes("stucco")) return "Stucco Accent";
  if (t.includes("vinyl")) return "Vinyl Accent";
  if (t.includes("block")) return "Decorative Block";
  return null;
}

function mapRoofCover(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("3-tab")) return "3-Tab Asphalt Shingle";
  if (t.includes("architectural") || t.includes("dimensional") || t.includes("dim shingle"))
    return "Architectural Asphalt Shingle";
  if (t.includes("standing seam")) return "Metal Standing Seam";
  if (t.includes("metal")) return "Metal Corrugated";
  if (t.includes("clay")) return "Clay Tile";
  if (t.includes("concrete tile") || t.includes("conc tile")) return "Concrete Tile"; // Added mapping for "Conc Tile"
  if (t.includes("slate")) return "Natural Slate";
  if (t.includes("synthetic slate")) return "Synthetic Slate";
  if (t.includes("shake")) return "Wood Shake";
  if (t.includes("shingle")) return "Wood Shingle";
  if (t.includes("tpo")) return "TPO Membrane";
  if (t.includes("epdm")) return "EPDM Membrane";
  if (t.includes("modified")) return "Modified Bitumen";
  if (t.includes("built-up") || t.includes("bur")) return "Built-Up Roof";
  if (t.includes("green roof")) return "Green Roof System";
  if (t.includes("solar tiles")) return "Solar Integrated Tiles";
  return null;
}

function mapRoofStructure(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("truss") && t.includes("wood")) return "Wood Truss";
  if (t.includes("truss") && t.includes("steel")) return "Steel Truss";
  if (t.includes("rafter")) return "Wood Rafter";
  if (t.includes("concrete")) return "Concrete Beam";
  if (t.includes("engineered")) return "Engineered Lumber";
  if (t.includes("hip") || t.includes("gable") || t.includes("flat")) return "Wood Rafter"; // Assuming common residential roof structures are wood rafters if only design type is given
  return null;
}

function mapRoofDesignType(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("gable")) return "Gable";
  if (t.includes("hip")) return "Hip";
  if (t.includes("flat")) return "Flat";
  if (t.includes("mansard")) return "Mansard";
  if (t.includes("gambrel")) return "Gambrel";
  if (t.includes("shed")) return "Shed";
  if (t.includes("saltbox")) return "Saltbox";
  if (t.includes("butterfly")) return "Butterfly";
  if (t.includes("bonnet")) return "Bonnet";
  if (t.includes("clerestory")) return "Clerestory";
  if (t.includes("dome")) return "Dome";
  if (t.includes("barrel")) return "Barrel";
  if (t.includes("combination")) return "Combination";
  return null;
}

function mapFlooringMaterial(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("solid hardwood")) return "Solid Hardwood";
  if (t.includes("engineered hardwood")) return "Engineered Hardwood";
  if (t.includes("laminate")) return "Laminate";
  if (t.includes("luxury vinyl plank") || t.includes("lvp")) return "Luxury Vinyl Plank";
  if (t.includes("sheet vinyl")) return "Sheet Vinyl";
  if (t.includes("ceramic tile") || t.includes("tile-ceramic")) return "Ceramic Tile"; // Added mapping for "Tile-Ceramic"
  if (t.includes("porcelain tile")) return "Porcelain Tile";
  if (t.includes("natural stone tile") || t.includes("stone tile")) return "Natural Stone Tile";
  if (t.includes("carpet")) return "Carpet";
  if (t.includes("area rugs")) return "Area Rugs";
  if (t.includes("polished concrete") || t.includes("concrete")) return "Polished Concrete";
  if (t.includes("bamboo")) return "Bamboo";
  if (t.includes("cork")) return "Cork";
  if (t.includes("linoleum")) return "Linoleum";
  if (t.includes("terrazzo")) return "Terrazzo";
  if (t.includes("epoxy coating")) return "Epoxy Coating";
  if (t.includes("a tl/con") || (t.includes("tile") && t.includes("con"))) return "Ceramic Tile"; // Assuming TL/CON refers to Tile/Concrete
  return null;
}

function mapInteriorWallSurfaceMaterial(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("drywall")) return "Drywall";
  if (t.includes("plaster")) return "Plaster";
  if (t.includes("wood paneling")) return "Wood Paneling";
  if (t.includes("exposed brick")) return "Exposed Brick";
  if (t.includes("exposed block")) return "Exposed Block";
  if (t.includes("wainscoting")) return "Wainscoting";
  if (t.includes("shiplap")) return "Shiplap";
  if (t.includes("board and batten")) return "Board and Batten";
  if (t.includes("tile")) return "Tile";
  if (t.includes("stone veneer")) return "Stone Veneer";
  if (t.includes("metal panels")) return "Metal Panels";
  if (t.includes("glass panels")) return "Glass Panels";
  if (t.includes("concrete")) return "Concrete";
  if (t.includes("plaster masonry")) return "Plaster"; // Mapping "Plaster Masonry" to "Plaster"
  return null;
}

function extractStructure($, buildingElement, buildingNumber) {
  // Create a Cheerio object specifically for the current building element
  const $building = $(buildingElement);

  // From Building Information -> Exterior and Interior tables
  const exteriorTableSelector = ".exterior-container table.container";
  const interiorTableSelector = ".interior-container table.container";

  // Now, pass the global $ and $building as the Cheerio context to getTextFromTableByLabel
  const primaryWallRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Primary Wall",
  );
  const secondaryWallRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Secondary Wall",
  );
  const roofCoverRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Roof Cover",
  );
  const roofStructRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Roof Structure",
  );
  const storyHeightRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Story Height",
  );
  const yearBuiltRaw = getTextFromTableByLabel(
    $, $building,
    exteriorTableSelector,
    "Year Built",
  );
  const primaryFloorsRaw = getTextFromTableByLabel(
    $, $building,
    interiorTableSelector,
    "Primary Floors",
  );
  const primaryIntWallRaw = getTextFromTableByLabel(
    $, $building,
    interiorTableSelector,
    "Primary Int Wall",
  );

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
    exterior_wall_material_primary: mapExteriorWallMaterial(primaryWallRaw),
    exterior_wall_material_secondary: mapExteriorWallMaterialSecondary(secondaryWallRaw),
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: mapFlooringMaterial(primaryFloorsRaw),
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
    interior_wall_surface_material_primary: mapInteriorWallSurfaceMaterial(primaryIntWallRaw),
    interior_wall_surface_material_secondary: null,
    number_of_buildings: null, // This will be set at the property level, not per structure
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCover(roofCoverRaw),
    roof_date: null,
    roof_design_type: mapRoofDesignType(roofStructRaw), // Mapping Roof Structure to Roof Design Type
    roof_material_type: null,
    roof_structure_material: mapRoofStructure(roofStructRaw),
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
    building_number: buildingNumber != null ? buildingNumber : null,
  };

  // number_of_stories from "Story Height: 1 Story"
  if (storyHeightRaw) {
    const matchStories = storyHeightRaw.match(/(\d+)\s*Story/i);
    if (matchStories) {
      structure.number_of_stories = parseFloat(matchStories[1]) || null;
    }
  }

  // roof_date from "Year Built"
  if (yearBuiltRaw) {
    const year = parseInt(yearBuiltRaw, 10);
    if (!isNaN(year)) {
      structure.roof_date = year.toString(); // Format as YYYY
    }
  }

  // finished_base_area from "Finished Area: 1,812 SF"
  // Use $building here as well to scope the search
  const finishedAreaDiv = $building.find(".bottom-text").filter(function() {
    return $(this).text().includes("Finished Area:");
  }).first();

  const finishedAreaText = finishedAreaDiv.text().trim();
  const matchFinishedArea = finishedAreaText.match(/Finished Area:\s*([\d,]+)\s*SF/i);
  if (matchFinishedArea) {
    structure.finished_base_area = parseInt(matchFinishedArea[1].replace(/,/g, ""), 10) || null;
  }

  return structure;
}

function applyExtraFeaturesToStructure(structure, extraFeatures, buildingNumber) {
  if (!structure || !Array.isArray(extraFeatures) || extraFeatures.length === 0) {
    return [];
  }

  const usageMap = new Map();
  const registerUsage = (feature, updates) => {
    if (updates && Object.keys(updates).length > 0) {
      recordFeatureUsage(usageMap, feature, updates, buildingNumber);
    }
  };

  const slabFeature = extraFeatures.find((feature) =>
    hasAnyToken(feature, ["SLAB", "SLB"]),
  );
  if (slabFeature) {
    const updates = {};
    if (!structure.foundation_type) {
      structure.foundation_type = "Slab on Grade";
      updates.foundation_type = "Slab on Grade";
    }
    if (!structure.foundation_material) {
      structure.foundation_material = "Poured Concrete";
      updates.foundation_material = "Poured Concrete";
    }
    registerUsage(slabFeature, updates);
  }

  const concreteBlockWall = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["WALL", "BLOCK"]),
  );
  if (concreteBlockWall && !structure.exterior_wall_material_primary) {
    structure.exterior_wall_material_primary = "Concrete Block";
    registerUsage(concreteBlockWall, { exterior_wall_material_primary: "Concrete Block" });
  }

  const brickWall = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["WALL", "BRICK"]),
  );
  if (brickWall && !structure.exterior_wall_material_primary) {
    structure.exterior_wall_material_primary = "Brick";
    registerUsage(brickWall, { exterior_wall_material_primary: "Brick" });
  }

  const stoneTrim = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["STONE", "TRIM"]),
  );
  if (stoneTrim && !structure.exterior_wall_material_secondary) {
    structure.exterior_wall_material_secondary = "Stone Accent";
    registerUsage(stoneTrim, { exterior_wall_material_secondary: "Stone Accent" });
  }

  const brickTrim = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["BRICK", "TRIM"]),
  );
  if (brickTrim && !structure.exterior_wall_material_secondary) {
    structure.exterior_wall_material_secondary = "Brick Accent";
    registerUsage(brickTrim, { exterior_wall_material_secondary: "Brick Accent" });
  }

  const metalRoof = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["ROOF", "STEEL"]),
  );
  if (metalRoof) {
    const updates = {};
    if (!structure.roof_covering_material) {
      structure.roof_covering_material = "Metal Corrugated";
      updates.roof_covering_material = "Metal Corrugated";
    }
    if (!structure.roof_material_type) {
      structure.roof_material_type = "Metal";
      updates.roof_material_type = "Metal";
    }
    registerUsage(metalRoof, updates);
  }

  const roofTile = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["ROOF", "TILE"]),
  );
  if (roofTile && !structure.roof_covering_material) {
    structure.roof_covering_material = "Clay Tile";
    registerUsage(roofTile, { roof_covering_material: "Clay Tile" });
  }

  const roofShingle = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["ROOF", "SHING"]),
  );
  if (roofShingle && !structure.roof_covering_material) {
    structure.roof_covering_material = "Architectural Asphalt Shingle";
    registerUsage(roofShingle, { roof_covering_material: "Architectural Asphalt Shingle" });
  }

  const roofAluminum = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["ROOF", "ALUM"]),
  );
  if (roofAluminum && !structure.roof_covering_material) {
    structure.roof_covering_material = "Metal Standing Seam";
    registerUsage(roofAluminum, { roof_covering_material: "Metal Standing Seam" });
  }

  const mansard = extraFeatures.find((feature) =>
    hasAnyToken(feature, ["MANSARD"]),
  );
  if (mansard && structure.roof_design_type !== "Mansard") {
    structure.roof_design_type = "Mansard";
    registerUsage(mansard, { roof_design_type: "Mansard" });
  }

  return normalizeFeatureUsageOutput(usageMap);
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const extraFeatures = parseExtraFeatures($);
  const parcelId = getParcelId($);

  const allStructures = [];
  const extraFeatureUsage = [];
  // Select all 'article' elements with id 'building-info'
  const buildingInfoSections = $('article[id="building-info"]');
  const totalBuildings = extractTotalBuildingCount(buildingInfoSections);

  buildingInfoSections.each((index, element) => {
    const $building = $(element);
    const buildingNumber = extractBuildingNumber($, $building, index);
    const structure = extractStructure($, element, buildingNumber);
    if (totalBuildings !== null) {
      structure.number_of_buildings = totalBuildings;
    }
    const featureUsage = applyExtraFeaturesToStructure(structure, extraFeatures, buildingNumber);
    extraFeatureUsage.push(...featureUsage);
    allStructures.push(structure);
  });

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const propertyKey = `property_${parcelId}`;
  const propertyStructures = {
    building_structures: allStructures,
  };
  if (totalBuildings !== null) {
    propertyStructures.total_buildings = totalBuildings;
  }
  if (extraFeatureUsage.length > 0) {
    propertyStructures.extra_feature_structures = extraFeatureUsage;
  }

  const output = {
    [propertyKey]: propertyStructures,
  };

  const outPath = path.join(outputDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
