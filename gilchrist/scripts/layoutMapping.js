// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
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

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";
const EXTRA_FEATURES_SELECTOR = "#ctlBodyPane_ctl04_ctl01_grdSales_grdFlat";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText.replace(/-/g, "");
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

function toInt(val) {
  if (!val) {
    return null;
  }
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function defaultLayout(space_type, building_number, space_type_index, area_under_air_sq_ft, total_area_sq_ft, is_finished) {
  return {
    building_number: building_number,
    space_type: space_type,
    space_type_index: space_type_index,
    flooring_material_type: null,
    size_square_feet: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: is_finished,
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
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: area_under_air_sq_ft,
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    heated_area_sq_ft: null,
    installation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: total_area_sq_ft,
  };
}

function buildLayoutsFromBuildings(buildings) {
  let lIdx = 1;
  let layouts = [];
  buildings.forEach((b, bIdx) => {
    let spaceTypeCounter = new MultiCounter();
    const numberOfBeds = toInt(b["Bedrooms"]);
    const numberOfBaths = toInt(b["Bathrooms"]);
    layouts.push(defaultLayout("Building", (bIdx + 1), `${(bIdx + 1)}`, toInt(b["Conditioned Area"]), toInt(b["Actual Area"]), true));
    if (numberOfBeds) {
      for (let i = 0; i < numberOfBeds; i++) {
        layouts.push(defaultLayout("Bedroom", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, true));
      }
    }
    if (numberOfBaths) {
      for (let i = 0; i < numberOfBaths; i++) {
        layouts.push(defaultLayout("Full Bathroom", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, true));
      }
    }
  });
  return layouts;
}

function buildLayoutsFromFeatures(features) {
  let lIdx = 1;
  let layouts = [];
  let spaceTypeCounter = new MultiCounter();
  features.forEach((feature, bIdx) => {
    let featureType = feature[1];
    if (featureType && featureType.trim()) {
      featureType = featureType.toUpperCase();
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
      } else if(featureType.includes("SPA") ) {
        spaceType = "Hot Tub / Spa Area";
      } else if(featureType.includes("SUMMER KITCHEN") ) {
        spaceType = "Outdoor Kitchen";
      }
      // else if(featureType.includes("FENCE")) {
      //   throw {
      //     type: "error",
      //     message: `Fence found ${featureType}`,
      //     path: "",
      //   };
      // }
      if (spaceType) {
        spaceTypeCounter.increment(spaceType);
        const spaceTypeIndex = spaceTypeCounter.get(spaceType);
        layouts.push(defaultLayout(spaceType, null, `${(spaceTypeIndex)}`, null, null, true));
      }
    }

  });
  return layouts;
}

function collectExtraFeatures($) {
  const table = $(EXTRA_FEATURES_SELECTOR);
  let table_rows = [];
  if (table.length === 0) return table_rows;
  const rows = table.find("tbody tr");
  rows.each((i, tr) => {
    const $tr = $(tr);
    let vals = [];
    let ths = $tr.find("th");
    ths.each((j, th) => {
      vals.push($(th).text().trim());
    });
    let tds = $tr.find("td");
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    table_rows.push(vals);
  });
  return table_rows;
}
function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);

  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier != parcelId) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.`,
      path: "property.request_identifier",
    };
  }
  
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const features = collectExtraFeatures($);
  const buildingLayouts = buildLayoutsFromBuildings(buildings);
  const featureLayouts = buildLayoutsFromFeatures(features);
  const layouts = buildingLayouts.concat(featureLayouts);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
