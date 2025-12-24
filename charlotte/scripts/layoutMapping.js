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

function parseCharlotteProperty($) {
  return {
    accountNumber: parseAccountNumber($),
    owner: parseOwnerInformation($),
    propertyLocation: parsePropertyLocation($),
    generalParcelInformation: parseGeneralParcelInformation($),
    femaFloodZone: parseCaptionedTable($, 'FEMA Flood Zone'),
    certifiedTaxRollValues: parseCertifiedTaxRollValues($),
    landInformation: parseCaptionedTable($, 'Land Information'),
    landImprovementInformation: parseCaptionedTable($, 'Land Improvement Information'),
    buildingInformation: parseCaptionedTable($, 'Building Information'),
    buildingComponentInformation: parseCaptionedTable($, 'Building Component Information'),
    legalDescription: parseLegalDescription($),
  };
}

function parseOwnerInformation($) {
  const defaultOwner = {
    name: null,
    addressLines: [],
    formattedAddress: null,
    footnote: null,
  };

  const heading = findHeadingByText($, 'Owner:');
  if (!heading.length) {
    return defaultOwner;
  }

  const container = heading.closest('.w3-cell');
  const addressBlock = container.find('.w3-border').first();
  const lines = extractLines(addressBlock);
  const footnote = cleanText(container.find('.prcfootnote').first().text());

  return {
    name: lines[0] || null,
    addressLines: lines.slice(1),
    formattedAddress: lines.length ? lines.join(', ') : null,
    footnote: footnote || null,
  };
}

function parsePropertyLocation($) {
  const defaultLocation = {
    propertyAddress: { lines: [], formatted: null },
    propertyCityZip: null,
    businessName: null,
  };

  const heading = findHeadingByText($, 'Property Location:');
  if (!heading.length) {
    return defaultLocation;
  }

  const container = heading.closest('.w3-cell');
  const rows = container.children('.w3-row');
  if (!rows.length) {
    return defaultLocation;
  }

  const location = { ...defaultLocation };

  rows.each((_, row) => {
    const cells = $(row).find('.w3-cell');
    if (cells.length < 2) {
      return;
    }
    const label = cleanLabel(cells.eq(0).text());
    const valueCell = cells.eq(1);
    if (/property address/i.test(label)) {
      const lines = extractLines(valueCell);
      location.propertyAddress = {
        lines,
        formatted: lines.length ? lines.join(', ') : null,
      };
      return;
    }

    const value = extractSingleLine(valueCell);
    if (/property city/i.test(label)) {
      location.propertyCityZip = value;
    } else if (/business name/i.test(label)) {
      location.businessName = value;
    } else {
      const key = toCamelCase(label);
      if (key) {
        location[key] = value;
      }
    }
  });

  return location;
}

function parseGeneralParcelInformation($) {
  const heading = findHeadingByText($, 'General Parcel Information');
  if (!heading.length) {
    return {};
  }

  const container = heading.nextAll('.w3-border').first();
  if (!container.length) {
    return {};
  }

  const result = {};
  container.find('.w3-row').each((_, row) => {
    const cells = $(row).find('.w3-cell');
    if (cells.length < 2) {
      return;
    }
    const label = cleanLabel(cells.eq(0).text());
    const key = toCamelCase(label);
    if (!key) {
      return;
    }
    const value = extractSingleLine(cells.eq(1));
    result[key] = value;
  });

  return result;
}

function parseLegalDescription($) {
  const heading = findHeadingByText($, 'Legal Description:');
  if (!heading.length) {
    return { shortLegal: null, longLegal: null };
  }

  const row = heading.nextAll('.w3-cell-row').first();
  if (!row.length) {
    return { shortLegal: null, longLegal: null };
  }

  const result = { shortLegal: null, longLegal: null };
  row.find('.w3-container').each((_, column) => {
    const col = $(column);
    const strong = col.find('strong').first();
    const label = cleanLabel(strong.text());
    strong.remove();
    const value = extractSingleLine(col);
    if (/short legal/i.test(label)) {
      result.shortLegal = value;
    } else if (/long legal/i.test(label)) {
      result.longLegal = value;
    }
  });

  return result;
}

function parseCertifiedTaxRollValues($) {
  const parsed = parseCaptionedTable($, 'Certified Tax Roll Values');
  const taxYear = extractYearFromText(parsed.caption);
  return {
    ...parsed,
    taxYear,
  };
}

function parseCaptionedTable($, keyword) {
  if (!keyword) {
    return { caption: null, rows: [] };
  }

  const caption = findCaptionByKeyword($, keyword);
  if (!caption.length) {
    return { caption: null, rows: [] };
  }

  const table = caption.closest('table');
  if (!table.length) {
    return { caption: cleanText(caption.text()), rows: [] };
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return { caption: cleanText(caption.text()), rows: [] };
  }

  const headerRow = rows.first();
  const headerCells = headerRow.find('th').length ? headerRow.find('th') : headerRow.find('td');
  const headers = headerCells
    .map((idx, cell) => {
      const text = cleanLabel($(cell).text());
      const key = toCamelCase(text);
      return key || `column${idx + 1}`;
    })
    .get();

  const dataRows = rows.slice(1);
  const parsedRows = [];
  dataRows.each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) {
      return;
    }
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = extractSingleLine(cells.eq(idx));
    });
    const hasValue = Object.values(record).some((value) => value !== null && value !== '');
    if (hasValue) {
      parsedRows.push(record);
    }
  });

  return {
    caption: cleanText(caption.text()),
    rows: parsedRows,
  };
}

function findHeadingByText($, headingText) {
  if (!headingText) {
    return $();
  }
  const target = headingText.trim().toLowerCase();
  return $('h2')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === target)
    .first();
}

function findCaptionByKeyword($, keyword) {
  const normalized = keyword.trim().toLowerCase();
  return $('caption.blockcaption')
    .filter((_, el) => cleanText($(el).text()).toLowerCase().includes(normalized))
    .first();
}

function extractLines(element) {
  if (!element || !element.length) {
    return [];
  }

  const clone = element.clone();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractSingleLine(element) {
  const lines = extractLines(element);
  if (!lines.length) {
    return null;
  }
  return lines.join(' ').trim() || null;
}

function cleanLabel(text) {
  return cleanText(text).replace(/[:]/g, '').trim();
}

function cleanText(text) {
  if (!text) {
    return '';
  }
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function toCamelCase(text) {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  return cleaned
    .split(' ')
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function extractYearFromText(text) {
  if (!text) {
    return null;
  }
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function parseAccountNumber($) {
  const heading = $('h1')
    .filter((_, el) => /property record information for/i.test($(el).text()))
    .first();
  if (!heading.length) {
    return null;
  }
  const text = cleanText(heading.text());
  const match = text.match(/for\s+([A-Za-z0-9-]+)/i);
  return match ? match[1] : null;
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
  let buildings = (parsed.buildingInformation && parsed.buildingInformation.rows) ? parsed.buildingInformation.rows : [];
  let layouts = [];
  let buildingMapping = {};
  let buildingCounter = {};
  buildings.forEach((building, index) => {
    const buildIndex = index + 1;
    let spaceTypeCounter = new MultiCounter();
    if (parseIntOrNull(building.buildingNumber)) {
      buildingMapping[parseIntOrNull(building.buildingNumber)] = buildIndex;
      buildingCounter[parseIntOrNull(building.buildingNumber)] = spaceTypeCounter;
    }
    layouts.push(Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      total_area_sq_ft: parseIntOrNull(building.totalArea),
      area_under_air_sq_ft: parseIntOrNull(building.aCArea),
      built_year: parseIntOrNull(building.yearBuilt),
      building_number: buildIndex,
      is_finished: true,
    }));
    const number_of_stories = parseIntOrNull(building.floors);
    const bedrooms = parseIntOrNull(building.bedrooms);
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
  });
  let buildingComponents = (parsed.buildingComponentInformation && parsed.buildingComponentInformation.rows) ? parsed.buildingComponentInformation.rows : [];
  buildingComponents.forEach((buildingComponent, index) => {
    if (parseIntOrNull(buildingComponent.bld)) {
      const buildIndex =  buildingMapping[parseIntOrNull(buildingComponent.bld)];
      const spaceTypeCounter =  buildingCounter[parseIntOrNull(buildingComponent.bld)];
      const space_type = mapDescriptionToSpaceType(buildingComponent.description);
      if (buildIndex && spaceTypeCounter && space_type) {
        spaceTypeCounter.increment(space_type);
        const spaceTypeIndex = spaceTypeCounter.get(space_type);
        layouts.push(Object.assign(baseLayoutDefaults(), {
          space_type: space_type,
          space_type_index: `${(buildIndex.toString())}.${(spaceTypeIndex)}`,
          total_area_sq_ft: parseIntOrNull(buildingComponent.area),
          built_year: parseIntOrNull(buildingComponent.yearBuilt),
          building_number: buildIndex,
          is_finished: true,
        }));
      }
    }
  });
  let landImprovements = (parsed.landImprovementInformation && parsed.landImprovementInformation.rows) ? parsed.landImprovementInformation.rows : [];
  let improvementsSpaceTypeCounter = new MultiCounter();
  landImprovements.forEach((landImprovement, index) => {
    const space_type = mapDescriptionToSpaceType(landImprovement.description);
    if (space_type) {
      improvementsSpaceTypeCounter.increment(space_type);
      const spaceTypeIndex = improvementsSpaceTypeCounter.get(space_type);
      layouts.push(Object.assign(baseLayoutDefaults(), {
        space_type: space_type,
        space_type_index: spaceTypeIndex.toString(),
        total_area_sq_ft: parseIntOrNull(landImprovement.size),
        built_year: parseIntOrNull(landImprovement.yearBuilt),
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
  const parsed = parseCharlotteProperty($);

  const parcelId = parsed.accountNumber;
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
