// Layout mapping script
// Reads input.html, extracts building rows and creates layout entries, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

class MultiCounter {
  constructor() {
    // Use a Map to store counts for different keys.
    // Map keys can be any data type (strings, numbers, objects).
    this.counts = new Map();
  }

  /**
   * Increments the count for a given key.
   * If the key doesn't exist, it initializes its count to 0 before incrementing.
   * @param {any} key - The key whose count should be incremented.
   * @param {number} [step=1] - The amount to increment by.
   */
  increment(key, step = 1) {
    if (typeof step !== 'number' || step <= 0) {
      throw new Error("Increment step must be a positive number.");
    }
    const currentCount = this.counts.get(key) || 0;
    this.counts.set(key, currentCount + step);
  }

  /**
   * Decrements the count for a given key.
   * If the key doesn't exist, it initializes its count to 0 before decrementing.
   * @param {any} key - The key whose count should be decremented.
   * @param {number} [step=1] - The amount to decrement by.
   */
  decrement(key, step = 1) {
    if (typeof step !== 'number' || step <= 0) {
      throw new Error("Decrement step must be a positive number.");
    }
    const currentCount = this.counts.get(key) || 0;
    this.counts.set(key, currentCount - step);
  }

  /**
   * Sets the count for a given key to a specific value.
   * @param {any} key - The key whose count should be set.
   * @param {number} value - The new count value.
   */
  set(key, value) {
    if (typeof value !== 'number') {
      throw new Error("Count value must be a number.");
    }
    this.counts.set(key, value);
  }

  /**
   * Gets the current count for a given key.
   * Returns 0 if the key does not exist.
   * @param {any} key - The key to retrieve the count for.
   * @returns {number} The count for the key, or 0 if not found.
   */
  get(key) {
    return this.counts.get(key) || 0;
  }
}
/**
 * Extracts the `model` object literal from the onClickTaxCalculator function in palmbeach.html
 * and returns it as a plain JavaScript object.
 *
 * @param {string} $ - The HTML content of palmbeach.html parsed using cheerio.
 * @returns {object|null} Parsed model object if found, otherwise null.
 */
function parsePalmBeachModel($) {
  let targetScript = null;

  $('script').each((_, element) => {
    const scriptBody = $(element).html();
    if (scriptBody && scriptBody.includes('function onClickTaxCalculator')) {
      targetScript = scriptBody;
      return false; // Break out early once we find the function definition
    }
    return undefined;
  });

  if (!targetScript) {
    return null;
  }

  const modelIndex = targetScript.indexOf('var model');
  if (modelIndex === -1) {
    return null;
  }

  const objectStart = targetScript.indexOf('{', modelIndex);
  if (objectStart === -1) {
    return null;
  }

  const objectLiteral = extractObjectLiteral(targetScript, objectStart);
  if (!objectLiteral) {
    return null;
  }

  try {
    const parsedModel = JSON.parse(objectLiteral);
    parsedModel.structuralDetails = enhanceStructuralDetails(parsedModel.structuralDetails);
    return parsedModel;
  } catch (error) {
    throw new Error(`Failed to parse Palm Beach model JSON: ${error.message}`);
  }
}

/**
 * Walks the script content starting at the first opening brace and returns the
 * full object literal including nested objects.
 *
 * @param {string} script - JavaScript source that contains the object literal.
 * @param {number} startIndex - Index of the first `{` character.
 * @returns {string|null} Raw object literal text or null if it cannot be isolated.
 */
function extractObjectLiteral(script, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = startIndex; i < script.length; i += 1) {
    const char = script[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return script.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function enhanceStructuralDetails(structuralDetails) {
  if (!structuralDetails || typeof structuralDetails !== 'object') {
    return structuralDetails || null;
  }

  const combinedBuildings = combineStructuralElements(structuralDetails.StructuralElements);
  return {
    ...structuralDetails,
    combinedBuildings,
  };
}

function combineStructuralElements(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }

  const grouped = elements.reduce((acc, element) => {
    const buildingNumber = element?.BuildingNumber || 'Unknown';
    if (!acc[buildingNumber]) {
      acc[buildingNumber] = {
        buildingNumber,
        sections: {},
      };
    }

    const section = element?.DetailsSection || 'General';
    const name = element?.ElementName || `element${element?.ElementNumber || ''}`;
    const value = element?.ElementValue ?? null;

    if (!acc[buildingNumber].sections[section]) {
      acc[buildingNumber].sections[section] = {};
    }

    const sectionEntries = acc[buildingNumber].sections[section];
    if (!(name in sectionEntries)) {
      sectionEntries[name] = value;
    } else if (Array.isArray(sectionEntries[name])) {
      sectionEntries[name].push(value);
    } else {
      sectionEntries[name] = [sectionEntries[name], value];
    }

    return acc;
  }, {});

  return Object.values(grouped);
}

function baseLayoutDefaults() {
  return {
    // Required fields per schema (allowing null where permitted)
    flooring_material_type: null,
    size_square_feet: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    size_square_feet: null,
  };
}

function parseIntOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseInt(normalized, 10);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function mapDescriptionToSpaceType(description) {
  if (!description || !description.trim()) {
    return null;
  }
  let featureType = description.trim().toUpperCase();
  let spaceType = null;
  if (featureType.includes("POOL") && featureType.includes("HOUSE")) {
    spaceType = "Pool House";
  } else if(featureType.includes("POOL")) {
    spaceType = "Outdoor Pool";
  } else if(featureType.includes("GARAGE")) {
    spaceType = "Attached Garage";
  } else if(featureType.includes(" SHED")) {
    spaceType = "Shed";
  } else if(featureType.includes("GREENHOUSE")) {
    spaceType = "Greenhouse";
  } else if(featureType.includes("PORCH") && featureType.includes("ENCLOSED") ) {
    spaceType = "Enclosed Porch";
  } else if(featureType.includes("PORCH") && featureType.includes("OPEN") ) {
    spaceType = "Open Porch";
  } else if(featureType.includes("PORCH") && featureType.includes("SCREEN") ) {
    spaceType = "Screened Porch";
  } else if(featureType.includes("PORCH") ) {
    spaceType = "Porch";
  } else if(featureType.includes("PATIO") ) {
    spaceType = "Patio";
  } else if(featureType.includes("BARN") ) {
    spaceType = "Barn";
  } else if(featureType.includes("SPA") ) {
    spaceType = "Hot Tub / Spa Area";
  } else if(featureType.includes("SUMMER KITCHEN") ) {
    spaceType = "Outdoor Kitchen";
  }
  return spaceType;
}

function extractLayouts(parsed) {
  let buildings = (parsed.structuralDetails && parsed.structuralDetails.combinedBuildings) ? parsed.structuralDetails.combinedBuildings : [];
  let layouts = [];
  // let buildingMapping = {};
  // let buildingCounter = {};
  buildings.forEach((building, index) => {
    const buildIndex = index + 1;
    let spaceTypeCounter = new MultiCounter();
    // if (parseIntOrNull(building.buildingNumber)) {
    //   buildingMapping[parseIntOrNull(building.buildingNumber)] = buildIndex;
    //   buildingCounter[parseIntOrNull(building.buildingNumber)] = spaceTypeCounter;
    // }
    layouts.push(Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      total_area_sq_ft: parseIntOrNull(building?.sections?.Bottom?.["Total Square Footage"]),
      area_under_air_sq_ft: parseIntOrNull(building?.sections?.Bottom?.["Area Under Air"]),
      built_year: parseIntOrNull(building?.sections?.Top?.["Year Built"]),
      building_number: buildIndex,
      is_finished: true,
    }));
    const number_of_stories = parseIntOrNull(building?.sections?.Top?.["Stories"]);
    const bathrooms = parseIntOrNull(building?.sections?.Top?.["Full Baths"]);
    const bedrooms = parseIntOrNull(building?.sections?.Top?.["Bed Rooms"]);
    const half_bathrooms = parseIntOrNull(building?.sections?.Top?.["Half Baths"]);
    if (number_of_stories) {
      for (let roomIndex = 0; roomIndex < number_of_stories; roomIndex++) {
        const roomLayout = Object.assign(baseLayoutDefaults(), {
          space_type: "Floor",
          space_type_index: `${buildIndex.toString()}.${roomIndex+1}`,
          size_square_feet: null,
          heated_area_sq_ft: null,
          total_area_sq_ft: null,
          built_year: null,
          building_number: buildIndex,
          is_finished: true,
        });
        layouts.push(roomLayout);
      }
    }
    if (bathrooms) {
      for (let roomIndex = 0; roomIndex < bathrooms; roomIndex++) {
        const roomLayout = Object.assign(baseLayoutDefaults(), {
          space_type: "Full Bathroom",
          space_type_index: `${buildIndex.toString()}.${roomIndex+1}`,
          size_square_feet: null,
          heated_area_sq_ft: null,
          total_area_sq_ft: null,
          built_year: null,
          building_number: buildIndex,
          is_finished: true,
        });
        layouts.push(roomLayout);
      }
    }
    if (bedrooms) {
      for (let roomIndex = 0; roomIndex < bedrooms; roomIndex++) {
        const roomLayout = Object.assign(baseLayoutDefaults(), {
          space_type: "Bedroom",
          space_type_index: `${buildIndex.toString()}.${roomIndex+1}`,
          size_square_feet: null,
          heated_area_sq_ft: null,
          total_area_sq_ft: null,
          built_year: null,
          building_number: buildIndex,
          is_finished: true,
        });
        layouts.push(roomLayout);
      }
    }
    if (half_bathrooms) {
      for (let roomIndex = 0; roomIndex < half_bathrooms; roomIndex++) {
        const roomLayout = Object.assign(baseLayoutDefaults(), {
          space_type: "Half Bathroom / Powder Room",
          space_type_index: `${buildIndex.toString()}.${roomIndex+1}`,
          size_square_feet: null,
          heated_area_sq_ft: null,
          total_area_sq_ft: null,
          built_year: null,
          building_number: buildIndex,
          is_finished: true,
        });
        layouts.push(roomLayout);
      }
    }
    let buildingComponents = building?.sections?.Bottom ? building?.sections?.Bottom : {};
    for (const [key, value] of Object.entries(buildingComponents)) {
      const space_type = mapDescriptionToSpaceType(key);
      if (space_type) {
        if (value instanceof Array) {
          value.forEach((area, i) => {
            spaceTypeCounter.increment(space_type);
            const spaceTypeIndex = spaceTypeCounter.get(space_type);
            layouts.push(Object.assign(baseLayoutDefaults(), {
              space_type: space_type,
              space_type_index: `${(buildIndex.toString())}.${(spaceTypeIndex)}`,
              total_area_sq_ft: parseIntOrNull(area),
              building_number: buildIndex,
              is_finished: !key.toLowerCase().includes("unfinished"),
            }));
          });
        } else {
          spaceTypeCounter.increment(space_type);
          const spaceTypeIndex = spaceTypeCounter.get(space_type);
          layouts.push(Object.assign(baseLayoutDefaults(), {
            space_type: space_type,
            space_type_index: `${(buildIndex.toString())}.${(spaceTypeIndex)}`,
            total_area_sq_ft: parseIntOrNull(value),
            building_number: buildIndex,
            is_finished: !key.toLowerCase().includes("unfinished"),
          }));
        }
      }
    }
  });
  let landImprovements = parsed.extraDetails ?? [];
  let improvementsSpaceTypeCounter = new MultiCounter();
  landImprovements.forEach((landImprovement, index) => {
    const space_type = mapDescriptionToSpaceType(landImprovement.Description);
    if (space_type) {
      improvementsSpaceTypeCounter.increment(space_type);
      const spaceTypeIndex = improvementsSpaceTypeCounter.get(space_type);
      layouts.push(Object.assign(baseLayoutDefaults(), {
        space_type: space_type,
        space_type_index: spaceTypeIndex.toString(),
        total_area_sq_ft: parseIntOrNull(landImprovement.FeatureUnits),
        built_year: parseIntOrNull(landImprovement.YrBuilt),
        is_finished: true,
      }));
    }
  });
  return layouts;
}


(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parsed = parsePalmBeachModel($);

  const parcelId = parsed.propertyDetail.PCN;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const layouts = extractLayouts(parsed);

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const output = {};
  output[propertyKey] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data to ${outPath}`);
})();
