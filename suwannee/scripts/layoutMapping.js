// Layout mapping script
// Reads input.html, parses with cheerio, outputs owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
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

function parseSuwanneeTables($) {

  const buildingsTable = $('#parcelDetails_BldgTable')
    .find('table.parcelDetails_insideTable')
    .first();
  const extraFeaturesTable = $('#parcelDetails_XFOBTable')
    .find('table.parcelDetails_insideTable')
    .first();

  return {
    buildings: parseDataTable($, buildingsTable),
    extraFeatures: parseDataTable($, extraFeaturesTable),
  };
}

function parseDataTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return [];
  }

  const headerCells = rows.first().find('td, th');
  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, cell) => {
      const headerText = $(cell).text().replace(/\*/g, '');
      return normalizeKey(headerText) || `column${idx + 1}`;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < headers.length) {
        return null;
      }

      const record = {};
      let hasValue = false;

      headers.forEach((header, idx) => {
        const cell = cells.eq(idx);
        const value = formatCellValue(cell);
        if (value !== null) {
          hasValue = true;
        }
        record[header] = value;
      });

      return hasValue ? record : null;
    })
    .get()
    .filter(Boolean);
}

function formatCellValue(cell) {
  if (!cell || !cell.length) {
    return null;
  }

  const text = cell
    .text()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    return text;
  }

  const link = cell.find('a').attr('href');
  if (link) {
    return link;
  }

  return null;
}

function normalizeKey(text) {
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

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
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
  };
}

function toIntRounded(val) {
  if (!val && val !== 0 && val !== "0") {
    return null;
  }
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
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

function buildLayouts($) {
  const suwanneLayouts = parseSuwanneeTables($);
  const buildingsTable = suwanneLayouts["buildings"];
  const extraFeaturesTable = suwanneLayouts["extraFeatures"];
  const layouts = [];
  for (let index = 0; index < buildingsTable.length; index++) {
    const building = buildingsTable[index];
    const baseArea = toIntRounded(building["actualSf"]);
    const heatedArea = toIntRounded(building["htdBaseSf"]);
    const builtYear = toIntRounded(building["yearBlt"]);
    const buildIndex = index + 1;
    const buildingLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      size_square_feet: baseArea,
      heated_area_sq_ft: heatedArea,
      total_area_sq_ft: baseArea,
      built_year: builtYear,
      building_number: buildIndex,
      is_finished: true,
    });
    layouts.push(buildingLayout);
  }
  const spaceTypeCounter = new MultiCounter();
  for (let index = 0; index < extraFeaturesTable.length; index++) {
    const extraFeature = extraFeaturesTable[index];
    const description = extraFeature["desc"];
    const spaceType = mapDescriptionToSpaceType(description);
    const builtYear = toIntRounded(extraFeature["yearBlt"]);
    if (spaceType) {
      spaceTypeCounter.increment(spaceType);
      const spaceTypeIndex = spaceTypeCounter.get(spaceType);
      const featureLayout = Object.assign(baseLayoutDefaults(), {
        space_type: spaceType,
        space_type_index: spaceTypeIndex.toString(),
        size_square_feet: null,
        heated_area_sq_ft: null,
        total_area_sq_ft: null,
        built_year: builtYear,
        building_number: null,
        is_finished: true,
      });
      layouts.push(featureLayout);
    }
  }
  return layouts;
}

function main() {
  const $ = loadHtml();
  const parcelId = extractParcelId($);
  const layouts = buildLayouts($);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating layout data:", e.message);
    process.exit(1);
  }
}
