// Layout mapping script
// Reads input.html, parses with cheerio, extracts layout info, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
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

function parseNumber(numStr) {
  if (numStr == null) return null;
  const s = String(numStr).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
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

function extractLayouts($) {
  const buildingsTable = parseLeonBuildings($);
  const buildingDetails = parseLeonBuildingDetails($);
  const layouts = [];
  for (let index = 0; index < buildingsTable.length; index++) {
    const building = buildingsTable[index];
    let totalArea = null;
    const additionalArea = toIntRounded(building["auxiliarySqFt"]);
    const heatedArea = toIntRounded(building["heatedCooledSqFt"]);
    if (additionalArea && heatedArea) {
      totalArea = heatedArea + additionalArea;
    }
    const builtYear = toIntRounded(building["yearBuilt"]);
    const buildIndex = index + 1;
    const buildingLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      size_square_feet: totalArea,
      heated_area_sq_ft: heatedArea,
      total_area_sq_ft: totalArea,
      built_year: builtYear,
      building_number: buildIndex,
      is_finished: true,
    });
    layouts.push(buildingLayout);
  }
  if (buildingDetails.characteristics && buildingDetails.characteristics.pool && buildingDetails.characteristics.pool.toLowerCase() === "yes") {
    const poolLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Outdoor Pool",
      space_type_index: "1.1",
      size_square_feet: null,
      heated_area_sq_ft: null,
      total_area_sq_ft: null,
      built_year: null,
      building_number: 1,
      is_finished: true,
    });
    layouts.push(poolLayout);
  }
  const spaceTypeCounter = new MultiCounter();
  if (buildingDetails.areas && buildingDetails.areas.length > 0) {
    for (let index = 0; index < buildingDetails.areas.length; index++) {
      const buildingArea = buildingDetails.areas[index];
      const description = buildingArea["description"];
      const spaceType = mapDescriptionToSpaceType(description);
      const area = toIntRounded(buildingArea["squareFeet"]);
      if (spaceType) {
        spaceTypeCounter.increment(spaceType);
        const spaceTypeIndex = spaceTypeCounter.get(spaceType);
        const featureLayout = Object.assign(baseLayoutDefaults(), {
          space_type: spaceType,
          space_type_index: `1.${spaceTypeIndex.toString()}`,
          size_square_feet: area,
          heated_area_sq_ft: null,
          total_area_sq_ft: area,
          built_year: null,
          building_number: 1,
          is_finished: true,
        });
        layouts.push(featureLayout);
      }
    }
  }

  // Create a high-level "Pool Area" layout if pool Yes in details
  // let poolYes = false;
  // const $details = $("#single-building #building-details table.details");
  // $details.find("tr").each((_, tr) => {
  //   const th = safeText($(tr).find("th").first().text());
  //   const td = safeText($(tr).find("td").first().text());
  //   if (th.toLowerCase() === "pool" && td.toLowerCase().startsWith("yes"))
  //     poolYes = true;
  // });

  // if (poolYes) {
  //   layouts.push({
  //     space_type: "Pool Area",
  //     space_index: 1,
  //     flooring_material_type: null,
  //     size_square_feet: null,
  //     floor_level: null,
  //     has_windows: null,
  //     window_design_type: null,
  //     window_material_type: null,
  //     window_treatment_type: null,
  //     is_finished: true,
  //     furnished: null,
  //     paint_condition: null,
  //     flooring_wear: null,
  //     clutter_level: null,
  //     visible_damage: null,
  //     countertop_material: null,
  //     cabinet_style: null,
  //     fixture_finish_quality: null,
  //     design_style: null,
  //     natural_light_quality: null,
  //     decor_elements: null,
  //     pool_type: "BuiltIn",
  //     pool_equipment: null,
  //     spa_type: null,
  //     safety_features: null,
  //     view_type: null,
  //     lighting_features: null,
  //     condition_issues: null,
  //     is_exterior: true,
  //     pool_condition: null,
  //     pool_surface_type: null,
  //     pool_water_quality: null,
  //     adjustable_area_sq_ft: null,
  //     area_under_air_sq_ft: null,
  //     bathroom_renovation_date: null,
  //     building_number: null,
  //     heated_area_sq_ft: null,
  //     is_finished: true,
  //     kitchen_renovation_date: null,
  //     livable_area_sq_ft: null,
  //     story_type: null,
  //     total_area_sq_ft: null,
  //     view_type: null,
  //   });
  // }

  // No per-unit room details exist, so we cannot generate bedrooms/bathrooms.
  return layouts;
}

function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) throw new Error("ParcelId not found");

  const layouts = extractLayouts($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: { layouts } };
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
