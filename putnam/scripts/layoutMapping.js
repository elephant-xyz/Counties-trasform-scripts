// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf-8");
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

function getPropertyId($) {
  let vid = null;
  $(".summary-card .row").each((i, row) => {
    const label = $(row).find(".col-4").first().text().trim();
    const val = $(row).find(".col-8").first().text().trim();
    if (label === "VID:") vid = val;
  });
  if (!vid) {
    const res = $(".result-card").attr("data-parcel-pid");
    if (res) vid = res.trim();
  }
  return vid || "unknown";
}

function parseImprovements($) {
  const wrappers = $('#improvements-accordion > .card.wrapper-card');

  const overallDetails = [];
  const gradingDetails = [];
  const areasAndAdditions = [];

  wrappers.each((_, wrapperEl) => {
    const wrapper = $(wrapperEl);
    const improvementBody = wrapper.find('.improvement-card-body').first();
    if (!improvementBody.length) {
      return;
    }

    const id = improvementBody.attr('id') || '';
    const heading = cleanText(wrapper.find('.accordion-header').first().text());
    const firstDetailsCard = improvementBody.find('.details-card').first();
    const improvementName = cleanText(
      firstDetailsCard.find('.card-header').first().text()
    );

    let overallFields = null;
    let gradingFields = null;
    let areaRows = null;

    improvementBody.find('.details-card').each((_, cardEl) => {
      const card = $(cardEl);
      const cardTitle = cleanText(card.find('.card-header').first().text());
      if (!cardTitle) {
        return;
      }

      if (cardTitle === 'Grading') {
        gradingFields = extractKeyValueTable($, card);
      } else if (cardTitle === 'Area and Additions') {
        areaRows = extractAreaTable($, card);
      } else if (!overallFields) {
        overallFields = extractKeyValueTable($, card);
      }
    });

    const meta = {
      id: id || null,
      heading,
      improvement: improvementName || null,
    };

    if (overallFields) {
      overallDetails.push({
        ...meta,
        fields: overallFields,
      });
    }

    if (gradingFields) {
      gradingDetails.push({
        ...meta,
        fields: gradingFields,
      });
    }

    if (areaRows) {
      areasAndAdditions.push({
        ...meta,
        rows: areaRows,
      });
    }
  });

  return {
    overallDetails,
    gradingDetails,
    areasAndAdditions,
  };
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

function extractKeyValueTable($, container) {
  const data = {};

  container.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (cells.length < 2) {
      return;
    }

    const key = cleanKey($(cells[0]).text());
    if (!key) {
      return;
    }

    const value = cleanText($(cells[1]).text());
    data[key] = value;
  });

  return data;
}

function cleanKey(value) {
  return cleanText(value).replace(/:\s*$/, '');
}

function toIntRounded(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function extractAreaTable($, container) {
  const rows = [];

  container.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (!cells.length) {
      return;
    }

    rows.push({
      description: cleanText($(cells[0]).text()),
      percentRate: cleanText($(cells[1]).text()),
      rate: cleanText($(cells[2]).text()),
      squareFeet: cleanText($(cells[3]).text()),
      cost: cleanText($(cells[4]).text()),
    });
  });

  return rows;
}

function toKey(label) {
  const parts = cleanText(label)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (!parts.length) {
    return '';
  }

  const [first, ...rest] = parts;
  const tail = rest
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join('');

  const key = first.toLowerCase() + tail;
  if (/^\d/.test(key)) {
    return `value${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  }

  return key;
}

function parseFeatures($) {
  const featuresTab = $('#details-Features');
  if (!featuresTab.length) {
    return [];
  }

  const table = featuresTab.find('table').first();
  if (!table.length) {
    return [];
  }

  const headers = [];
  table.find('thead th').each((_, headerEl) => {
    const headerText = cleanText($(headerEl).text());
    if (headerText) {
      headers.push({
        label: headerText,
        key: toKey(headerText),
      });
    }
  });

  const rows = [];

  table.find('tbody tr').each((_, rowEl) => {
    const cells = $(rowEl).find('td');
    if (!cells.length) {
      return;
    }

    const row = {};
    cells.each((index, cellEl) => {
      const header = headers[index];
      if (!header) {
        return;
      }

      row[header.key] = cleanText($(cellEl).text());
    });

    if (Object.keys(row).length) {
      rows.push(row);
    }
  });

  return rows;
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

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function buildLayouts($) {
  const imps = parseImprovements($);
  const overallDetails = imps["overallDetails"];
  const areasAndAdditions = imps["areasAndAdditions"];
  const layouts = [];

  for (let index = 0; index < overallDetails.length; index++) {
    const details = overallDetails[index];
    const areas = areasAndAdditions[index];
    let baseArea = null;
    if (areas["rows"]) {
      for (const area of areas["rows"]) {
        if (area && area["description"] && area["description"] === "base") {
          baseArea = toIntRounded(area["squareFeet"]);
          break;
        }
      }
    }
    let builtYear = null;
    let bedrooms = null;
    let bathrooms = null;
    if (details["fields"]
      && "Effective Year Built" in details["fields"]
      && /^\d{4}$/.test(cleanKey(details["fields"]["Effective Year Built"]))) {
        builtYear = toIntRounded(details["fields"]["Effective Year Built"]);
    }
    if (details["fields"]
      && "Bed / Bath" in details["fields"]) {
        let bedBathSplit = details["fields"]["Bed / Bath"].split("/");
        if (bedBathSplit.length == 2) {
          bedrooms = toIntRounded(bedBathSplit[0]);
          bathrooms = toIntRounded(bedBathSplit[1]);
        }
    }
    const buildIndex = index + 1;
    const buildingLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      size_square_feet: baseArea,
      heated_area_sq_ft: null,
      total_area_sq_ft: baseArea,
      built_year: builtYear,
      building_number: buildIndex,
      is_finished: true,
    });
    layouts.push(buildingLayout);
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
    const spaceTypeCounter = new MultiCounter();
    for (const area of areas["rows"]) {
      if (area && area["description"]) {
        const featureType =  area["description"].toUpperCase();
        const subArea = toIntRounded(area["squareFeet"]);
        let spaceType = null;
        let isFinished = true;
        if (featureType.includes("UNFINISHED")) {
          isFinished = false;
        }
        if (featureType.includes("DECK")) {
          spaceType = "Deck";
        } else if(featureType.includes("POOL")) {
          spaceType = "Outdoor Pool";
        } else if(featureType.includes("BASEMENT")) {
          spaceType = "Basement";
        } else if(featureType.includes("GARAGE")) {
          spaceType = "Attached Garage";
        } else if(featureType.includes("GREENHOUSE")) {
          spaceType = "Greenhouse";
        } else if(featureType.includes("PORCH") && featureType.includes("OPEN") ) {
          spaceType = "Open Porch";
        } else if(featureType.includes("PORCH") && featureType.includes("ENCLOSED") ) {
          spaceType = "Enclosed Porch";
        } else if(featureType.includes("PORCH") && featureType.includes("SCREENED") ) {
          spaceType = "Screened Porch";
        } else if(featureType.includes("PORCH") ) {
          spaceType = "Porch";
        } else if(featureType.includes("SUMMER KITCHEN") ) {
          spaceType = "Outdoor Kitchen";
        } else if(featureType.includes("OFFICE") ) {
          spaceType = "Office Room";
        }
        if (spaceType) {
          spaceTypeCounter.increment(spaceType);
          const spaceTypeIndex = spaceTypeCounter.get(spaceType);
          const l = Object.assign(baseLayoutDefaults(), {
            space_type: spaceType,
            space_type_index: `${buildIndex.toString()}.${spaceTypeIndex}`,
            is_finished: isFinished,
            size_square_feet: subArea,
            heated_area_sq_ft: null,
            total_area_sq_ft: subArea,
            building_number: buildIndex,
            built_year: null,
          });
          layouts.push(l);
        }
      }
    }
  }
  const spaceTypeCounter = new MultiCounter();
  const features = parseFeatures($);
  for(const feature of features) {
    if (feature && feature["description"]) {
      const featureType =  feature["description"].toUpperCase();
      const subArea = toIntRounded(feature["sqFootage"]);
      let spaceType = null;
      let isFinished = true;
      if (featureType.includes("UNFIN")) {
        isFinished = false;
      }
      if(featureType.includes("BASEMENT")) {
        spaceType = "Basement";
      } else if(featureType.includes("GARAGE")) {
        spaceType = "Attached Garage";
      } else if(featureType.includes("GREEN HOUSE")) {
        spaceType = "Greenhouse";
      } else if(featureType.includes("PORCH") && featureType.includes("OPEN") ) {
        spaceType = "Open Porch";
      } else if(featureType.includes("PORCH") && featureType.includes("ENCLOSED") ) {
        spaceType = "Enclosed Porch";
      } else if(featureType.includes("PORCH") && (featureType.includes("SCREENED") ||  featureType.includes("Scrn"))) {
        spaceType = "Screened Porch";
      } else if(featureType.includes("PORCH") ) {
        spaceType = "Porch";
      } else if(featureType.includes("SUMMER KITCHEN") ) {
        spaceType = "Outdoor Kitchen";
      } else if(featureType.includes("OFFICE") ) {
        spaceType = "Office Room";
      } else if(featureType.includes("JACUZZI") ) {
        spaceType = "Jacuzzi";
      } else if(featureType.includes("GAZEBO") ) {
        spaceType = "Gazebo";
      } else if (featureType.includes("POOL") && featureType.includes("PATIO")) {
        spaceType = "Pool Area";
      } else if(featureType.includes("POOL")) {
        spaceType = "Outdoor Pool";
      } 
      if (spaceType) {
        spaceTypeCounter.increment(spaceType);
        const spaceTypeIndex = spaceTypeCounter.get(spaceType);
        const l = Object.assign(baseLayoutDefaults(), {
          space_type: spaceType,
          space_type_index: `${spaceTypeIndex}`,
          is_finished: isFinished,
          size_square_feet: subArea,
          heated_area_sq_ft: null,
          total_area_sq_ft: subArea,
          building_number: null,
          built_year: null,
        });
        layouts.push(l);
      }
    }
  }

  return layouts;
}

function main() {
  const $ = readHtml();
  const pid = getPropertyId($);
  const layouts = buildLayouts($);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const payload = {};
  payload[`property_${pid}`] = { layouts };

  fs.writeFileSync(
    path.join(outDir, "layout_data.json"),
    JSON.stringify(payload, null, 2),
  );
}

main();
