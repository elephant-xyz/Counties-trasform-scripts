// Layout mapping script
// Reads input.html, parses with cheerio, outputs owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractPropertyId($) {
  const headerText = $("span.large.bold").first().text().trim();
  const m = headerText.match(/for\s+(\d{4,})/i);
  return m ? m[1] : "unknown";
}

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

function parseSarasotaTables($) {
  const emptyResult = {
    buildings: [],
    extraFeatures: [],
    values: [],
    salesAndTransfers: [],
    propertyAttributes: {},
  };
  const buildingsTable = $('#Buildings').first();
  const extraFeaturesTable = findTableByHeading($, 'Extra Features');
  const valuesTable = findTableByHeading($, 'Values');
  const salesTable = findTableByHeading($, 'Sales & Transfers');

  return {
    buildings: parseHeaderTable($, buildingsTable),
    extraFeatures: parseHeaderTable($, extraFeaturesTable),
    values: parseHeaderTable($, valuesTable),
    salesAndTransfers: parseHeaderTable($, salesTable),
    propertyAttributes: extractPropertyAttributes($),
  };
}

function findTableByHeading($, headingText) {
  if (!headingText) {
    return $();
  }
  const heading = $('span.h2')
    .filter((_, el) => $(el).text().trim().startsWith(headingText))
    .first();

  if (!heading.length) {
    return $();
  }
  return heading.nextAll('table').first();
}

function parseHeaderTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const headerRow = table.find('tr').first();
  const headerCells = headerRow.find('th');

  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, th) => {
      const text = $(th).text().replace(/\s+/g, ' ').trim();
      return normalizeHeaderKey(text) || `column${idx + 1}`;
    })
    .get();

  const bodyRows = table.find('tbody tr');
  const rows = bodyRows.length ? bodyRows : table.find('tr').slice(1);
  return rows
    .map((_, row) => {
      const cells = $(row).find('td');
      const record = {};
      headers.forEach((header, idx) => {
        const cellText = cells
          .eq(idx)
          .text()
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        record[header] = cellText || null;
      });
      return record;
    })
    .get();
}

function extractPropertyAttributes($) {
  const result = {};
  const detailsList = $('ul.resultr.spaced').first();

  if (!detailsList.length) {
    return result;
  }

  detailsList.find('li').each((_, item) => {
    const strong = $(item).find('strong').first();
    if (!strong.length) {
      return;
    }
    const label = strong.text().replace(/[:]/g, '').trim();
    const key = normalizeHeaderKey(label);
    if (!key) {
      return;
    }

    const clone = $(item).clone();
    clone.find('strong').first().remove();
    const value = clone
      .text()
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    result[key] = value || null;
  });

  return result;
}

function normalizeHeaderKey(text) {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  return cleaned
    .split(' ')
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
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

function parseFloatOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseFloat(normalized);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function buildLayouts($) {
  const layouts = [];
  
  const parsed = parseSarasotaTables($);
  const parsedBuildings = parsed.buildings;
  parsedBuildings.forEach((parsedBuilding, index) => {
    const buildIndex = index + 1;
    const bedrooms = parseIntOrNull(parsedBuilding.beds);
    const bathrooms = parseIntOrNull(parsedBuilding.baths);
    const halfBathrooms = parseIntOrNull(parsedBuilding.halfBaths);
    const property_structure_built_year = parseIntOrNull(parsedBuilding.yearBuilt);
    const number_of_stories = parseIntOrNull(parsedBuilding.stories);
    const total_area = parseIntOrNull(parsedBuilding.grossArea);
    const livable_area_sq_ft = parseIntOrNull(parsedBuilding.livingArea);
    // const typeRow = (parsedBuilding.typeRows && parsedBuilding.typeRows[0]) || {};
    // const sectionDetails = parsedBuilding.sectionDetails || {};
    // const characteristics = parsedBuilding.characteristics || {};
    // const property_structure_built_year = parseIntOrNull(characteristics.yearBuilt);
    // const number_of_stories = parseFloatOrNull(typeRow.stories);
    // const finished_base_area = parseIntOrNull(typeRow.groundFloorArea);
    // const total_area = parseIntOrNull(typeRow.totalFlrArea);
    // const bedrooms = parseIntOrNull(sectionDetails.bedrooms);
    // const bathrooms = (parseIntOrNull(sectionDetails["4FixtureBaths"]) ?? 0) + (parseIntOrNull(sectionDetails["3FixtureBaths"]) ?? 0) + (parseIntOrNull(sectionDetails["2FixtureBaths"]) ?? 0);
    // const hasKitchen = sectionDetails["bltInKitchen"] && sectionDetails["bltInKitchen"] === "Y";
    const buildingLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      total_area_sq_ft: total_area,
      livable_area_sq_ft: livable_area_sq_ft,
      built_year: property_structure_built_year,
      building_number: buildIndex,
      is_finished: true,
    });
    layouts.push(buildingLayout);
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
    if (halfBathrooms) {
      for (let roomIndex = 0; roomIndex < halfBathrooms; roomIndex++) {
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
  });
  let spaceTypeCounter = {};
  spaceTypeCounter["NoBuilding"] = new MultiCounter();
  const parsedFeatures = parsed.extraFeatures;
  parsedFeatures.forEach((parsedFeature, index) => {
    if (!parsedFeature.description) {
      return;
    }
    const featureType = parsedFeature.description.toUpperCase();
    const builtYear = parseIntOrNull(parsedFeature.year);
    const buildingNum = parseIntOrNull(parsedFeature.buildingNumber);
    if (buildingNum && spaceTypeCounter[buildingNum.toString()] === undefined) {
      spaceTypeCounter[buildingNum.toString()] = new MultiCounter();
    }
    let spaceType = null;
    if (featureType.includes("POOL") && featureType.includes("DECK")) {
      spaceType = "Pool Area";
    } else if(featureType.includes("POOL")) {
      spaceType = "Outdoor Pool";
    } else if(featureType.includes("SHED")) {
      spaceType = "Shed";
    } else if(featureType.includes("GARAGE")) {
      spaceType = "Attached Garage";
    } else if(featureType.includes("GREENHOUSE")) {
      spaceType = "Greenhouse";
    } else if(featureType.includes("PORCH") && featureType.includes("ENCLOSED") ) {
      spaceType = "Enclosed Porch";
    } else if(featureType.includes("PORCH") && featureType.includes("SCREENED") ) {
      spaceType = "Screened Porch";
    } else if(featureType.includes("PORCH") ) {
      spaceType = "Porch";
    } else if(featureType.includes("SPA") ) {
      spaceType = "Hot Tub / Spa Area";
    } else if(featureType.includes("SUMMER KITCHEN") ) {
      spaceType = "Outdoor Kitchen";
    }
    if (spaceType) {
      let spaceTypeIndex = null;
      if (buildingNum) {
        spaceTypeCounter[buildingNum.toString()].increment(spaceType);
        spaceTypeIndex = `${buildingNum}.${spaceTypeCounter[buildingNum.toString()].get(spaceType)}`;
      } else {
        spaceTypeCounter["NoBuilding"].increment(spaceType);
        spaceTypeIndex = `${spaceTypeCounter["NoBuilding"].get(spaceType)}`;
      }
      const featureLayout = Object.assign(baseLayoutDefaults(), {
        space_type: spaceType,
        space_type_index: spaceTypeIndex,
        built_year: builtYear,
        building_number: buildingNum ? buildingNum : null,
        is_finished: true,
      });
      layouts.push(featureLayout);
    }
  });
  
  return layouts;
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    const layouts = buildLayouts($);

    const outDir = path.resolve("owners");
    ensureDir(outDir);

    const outPath = path.join(outDir, "layout_data.json");
    const payload = {};
    payload[`property_${propId}`] = { layouts };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote layout data for property_${propId} to ${outPath}`);
  } catch (err) {
    console.error("Error in layoutMapping:", err.message);
    process.exit(1);
  }
})();
