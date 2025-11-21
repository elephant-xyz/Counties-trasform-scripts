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

function buildStructureData($) {
  const structures = {};
  
  const parsed = parseSarasotaTables($);
  const parsedBuildings = parsed.buildings;
  parsedBuildings.forEach((parsedBuilding, index) => {
    const buildIndex = index + 1;
    const stories = parseIntOrNull(parsedBuilding.stories);
    structures[buildIndex.toString()] = {
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
        number_of_buildings: null,
        number_of_stories: stories,
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
  });
  
  return structures;
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    // const vacant = isVacantLand($); // not used but extracted if needed

    const structureData = buildStructureData($);

    const outDir = path.resolve("owners");
    ensureDir(outDir);

    const outPath = path.join(outDir, "structure_data.json");
    const payload = {};
    payload[`property_${propId}`] = structureData;

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote structure data for property_${propId} to ${outPath}`);
  } catch (err) {
    console.error("Error in structureMapping:", err.message);
    process.exit(1);
  }
})();
