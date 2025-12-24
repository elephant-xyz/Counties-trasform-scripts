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

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function getParcelId($) {
  const dataId = $("script#display\\.js").attr("data-parcelid");
  if (dataId && /\d{6,}/.test(dataId)) return dataId.trim();
  const html = $.html();
  const m = html.match(/DB:\s*(\d{12,})/);
  if (m) return m[1];
  const m2 = html.match(/strap=(\d{12,})/);
  if (m2) return m2[1];
  return "unknown_property_id";
}

function parseNumber(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^0-9.\-]/g, "");
  if (!n) return null;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function parsePolkHtml($) {
  return {
    parcelInformation: parseParcelInformation($),
    buildings: parseBuildings($),
    extraFeatures: parseExtraFeatures($),
    valueSummary: parseValueSummary($),
    priorYearFinalValues: parsePriorYearValues($),
  };
}

function parseParcelInformation($) {
  const infoHeading = $("h4")
    .filter((_, el) => cleanText($(el).text()) === "Parcel Information")
    .first();
  if (!infoHeading.length) {
    return {};
  }

  const table = infoHeading.nextAll("table").first();
  if (!table.length) {
    return {};
  }

  const data = {};
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) {
      return;
    }
    const key = toCamelCase(getCellText(cells.eq(0)));
    if (!key) {
      return;
    }
    const value = getCellText(cells.eq(1));
    data[key] = value || null;
  });

  return data;
}

function parseBuildings($) {
  const buildingSections = $("#bldngs .pagebreak").filter((_, section) => {
    const header = $(section).children("h4").first();
    return header.length && /building/i.test(header.text());
  });

  return buildingSections
    .map((_, section) => parseBuildingSection($, $(section)))
    .get()
    .filter(Boolean);
}

function parseBuildingSection($, section) {
  const heading = section.children("h4").first();
  if (!heading.length) {
    return null;
  }

  const label = cleanText(heading.clone().children().remove().end().text());
  const type = cleanText(heading.find("a").text());
  const characteristicsHeading = section
    .find("h4")
    .filter((_, el) => cleanText($(el).text()) === "Building Characteristics")
    .first();
  const charContainer = characteristicsHeading.length ? characteristicsHeading.parent() : $();
  const characteristics = charContainer.length ? extractCharacteristicPairs($, charContainer) : {};
  const elementsTable = charContainer.length ? charContainer.find("table").first() : $();
  const elements = parseStandardTable($, elementsTable);

  const subareaHeading = section
    .find("h4")
    .filter((_, el) => cleanText($(el).text()) === "Building Subareas")
    .first();
  const subareaTable = subareaHeading.length ? subareaHeading.nextAll("table").first() : $();
  const { rows: subareas, totals: subareaTotals } = parseSubareaTable($, subareaTable);

  const situsAddress = cleanText(
    section.find("td").eq(1).find("h4").first().text()
  );

  return {
    label: label || null,
    type: type || null,
    situsAddress: situsAddress || null,
    characteristics,
    elements,
    subareas,
    subareaTotals,
  };
}

function extractCharacteristicPairs($, container) {
  if (!container || !container.length) {
    return {};
  }
  const result = {};

  container.find("b").each((_, bold) => {
    const label = cleanText($(bold).text()).replace(/:$/, "");
    const key = toCamelCase(label);
    if (!key) {
      return;
    }

    const value = cleanText(readSiblingText(bold));
    if (!value) {
      return;
    }
    result[key] = value;
  });

  return result;
}

function readSiblingText(node) {
  let text = "";
  let current = node.nextSibling;
  while (current) {
    if (current.type === "text") {
      text += current.data;
      current = current.nextSibling;
      continue;
    }

    if (current.type === "tag") {
      const tagName = current.name ? current.name.toLowerCase() : "";
      if (tagName === "br") {
        break;
      }
      if (/^h\d$/.test(tagName) || tagName === "b" || tagName === "table" || tagName === "div") {
        break;
      }
    }
    current = current.nextSibling;
  }
  return text;
}

function parseStandardTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find("tr");
  if (!rows.length) {
    return [];
  }

  const headerCells = rows.first().find("th, td");
  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, cell) => {
      const headerText = getCellText($(cell));
      const key = toCamelCase(headerText) || `column${idx + 1}`;
      return key;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find("td");
      if (cells.length !== headers.length) {
        return null;
      }

      const record = {};
      headers.forEach((header, idx) => {
        const value = getCellText(cells.eq(idx));
        record[header] = value || null;
      });
      return record;
    })
    .get()
    .filter(Boolean);
}

function parseSubareaTable($, table) {
  if (!table || !table.length) {
    return { rows: [], totals: {} };
  }

  const rows = table.find("tr");
  if (!rows.length) {
    return { rows: [], totals: {} };
  }

  const headerCells = rows.first().find("th, td");
  const headers = headerCells
    .map((idx, cell) => {
      const headerText = getCellText($(cell));
      return toCamelCase(headerText) || `column${idx + 1}`;
    })
    .get();

  const data = [];
  const totals = {};

  rows.slice(1).each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) {
      return;
    }

    const hasColspan = cells.filter((_, cell) => $(cell).attr("colspan")).length > 0;
    if (hasColspan) {
      const label = getCellText(cells.first());
      const key = toCamelCase(label);
      if (key) {
        totals[key] = getCellText(cells.last()) || null;
      }
      return;
    }

    if (cells.length !== headers.length) {
      return;
    }

    const record = {};
    headers.forEach((header, idx) => {
      record[header] = getCellText(cells.eq(idx)) || null;
    });
    data.push(record);
  });

  return { rows: data, totals };
}

function parseExtraFeatures($) {
  const heading = $("h3")
    .filter((_, el) => cleanText($(el).text()).startsWith("Extra Features"))
    .first();
  if (!heading.length) {
    return [];
  }
  const table = heading.nextAll("table").first();
  return parseStandardTable($, table);
}

function parseValueSummary($) {
  const table = $("#valueSummary table").first();
  if (!table.length) {
    return { rows: [], note: null };
  }

  const rows = parseStandardTable($, table);
  const noteRow = table.find("tr").filter((_, row) => $(row).find("td[colspan]").length).first();

  return {
    rows,
    note: noteRow.length ? cleanText(noteRow.text()) || null : null,
  };
}

function parsePriorYearValues($) {
  const table = $("#priorValues table").first();
  return parseStandardTable($, table);
}

function getCellText(cell) {
  if (!cell || !cell.length) {
    return "";
  }
  const clone = cell.clone();
  clone.find("br").replaceWith(" ");
  return cleanText(clone.text());
}

function cleanText(value) {
  if (!value) {
    return "";
  }
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function toCamelCase(text) {
  if (!text) {
    return "";
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(" ")
    .map((part, idx) => {
      if (!part) {
        return "";
      }
      return idx === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function mapPolkBuildings(parsedBuildings = []) {
  return parsedBuildings
    .map((building, idx) => convertParsedBuilding(building, idx))
    .filter(Boolean);
}

function convertParsedBuilding(building, index) {
  if (!building) {
    return null;
  }

  const layoutBuilding = {
    index: index + 1,
    beds: 0,
    full: 0,
    half: 0,
    livingArea: null,
    totalUnderRoof: null,
    yearBuilt: null,
    style: null,
    storyHeightInfo: null,
    substructure: null,
    frameConstType: null,
    exteriorWall: null,
    roofStructure: null,
    subareas: [],
  };

  const characteristics = building.characteristics || {};
  layoutBuilding.livingArea = parseNumber(characteristics.livingArea);
  layoutBuilding.totalUnderRoof = parseNumber(characteristics.totalUnderRoof);
  layoutBuilding.yearBuilt = parseNumber(characteristics.actualYearBuilt);

  (building.elements || []).forEach(element => {
    const label = cleanText(element.element || "").toUpperCase();
    if (!label) {
      return;
    }
    const unitValue = parseNumber(element.units);
    const infoValue = cleanText(element.information || "") || null;

    if (label === "BEDROOM") {
      layoutBuilding.beds = unitValue ?? layoutBuilding.beds;
    } else if (label === "FULL BATH") {
      layoutBuilding.full = unitValue ?? layoutBuilding.full;
    } else if (label === "HALF BATH") {
      layoutBuilding.half = unitValue ?? layoutBuilding.half;
    } else if (label === "STYLE") {
      layoutBuilding.style = infoValue;
    } else if (label === "SUBSTRUCT") {
      layoutBuilding.substructure = infoValue;
    } else if (label === "FRAME / CONST TYPE") {
      layoutBuilding.frameConstType = infoValue;
    } else if (label === "EXTERIOR WALL") {
      layoutBuilding.exteriorWall = infoValue;
    } else if (label === "ROOF STRUCTURE") {
      layoutBuilding.roofStructure = infoValue;
    } else if (label === "STORY HEIGHT INFO ONLY") {
      layoutBuilding.storyHeightInfo = infoValue;
    }
  });

  layoutBuilding.subareas = (building.subareas || [])
    .map(sub => {
      const codeDesc = cleanText(sub.codeDescription || "").toUpperCase();
      if (!codeDesc) {
        return null;
      }
      const heatedValue =
        typeof sub.heated === "string"
          ? sub.heated.trim().toUpperCase() === "Y"
          : Boolean(sub.heated);
      const total = parseNumber(sub.total);
      if (total == null) {
        return null;
      }
      return {
        codeDesc,
        heated: heatedValue,
        total,
      };
    })
    .filter(Boolean);

  return layoutBuilding;
}

function defaultLayout(space_type, building_number, space_type_index, heated_area_sq_ft, livable_area_sq_ft, total_area_sq_ft, is_finished) {
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
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    heated_area_sq_ft: heated_area_sq_ft,
    installation_date: null,
    livable_area_sq_ft: livable_area_sq_ft,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: total_area_sq_ft,
  };
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

function inferFloorLevel(building) {
  if (!building) {
    return null;
  }

  const source = [building.storyHeightInfo].find(
    value => typeof value === "string" && value.trim()
  );

  if (!source) {
    return null;
  }
  const match = source.match(/^\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return null;
}

function makeLayoutEntries(building, bIdx) {
  const layouts = [];
  let noOfFloors = inferFloorLevel(building);

  layouts.push(defaultLayout("Building", (bIdx + 1), `${(bIdx + 1)}`, null, toInt(building.livingArea), toInt(building.totalUnderRoof), true));
  // Bedrooms
  for (let i = 0; i < (building.beds || 0); i++) {
    layouts.push(defaultLayout("Bedroom", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, null, true));
  }
  // Full Bathrooms
  for (let i = 0; i < (building.full || 0); i++) {
    layouts.push(defaultLayout("Full Bathroom", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, null, true));
  }
  // Half Bathrooms
  for (let i = 0; i < (building.half || 0); i++) {
    layouts.push(defaultLayout("Half Bathroom / Powder Room", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, null, true));
  }
  // Half Bathrooms
  for (let i = 0; i < (noOfFloors || 0); i++) {
    layouts.push(defaultLayout("Floor", (bIdx + 1), `${(bIdx + 1)}.${(i + 1)}`, null, null, null, true));
  }
  let spaceTypeCounter = new MultiCounter();

  // Process subareas for additional spaces
  (building.subareas || []).forEach(sub => {
    const area = toInt(sub.total);
    // const heated = Boolean(sub.heated);
    const code = sub.codeDesc ? sub.codeDesc.trim().toUpperCase() : "";
    let spaceType = null;
    let isFinished = true;
    if (code.includes("POOL") && code.includes("HOUSE")) {
      spaceType = "Pool House";
    } else if(code.includes("POOL")) {
      spaceType = "Outdoor Pool";
    } else if(code.includes("GARAGE")) {
      spaceType = "Attached Garage";
    } else if(code.includes(" SHED")) {
      spaceType = "Shed";
    } else if(code.includes("GREENHOUSE")) {
      spaceType = "Greenhouse";
    } else if(code.includes("PORCH") && code.includes("ENCLOSED") ) {
      spaceType = "Enclosed Porch";
    } else if(code.includes("PORCH") && code.includes("SCREEN") ) {
      spaceType = "Screened Porch";
    } else if(code.includes("PORCH") ) {
      spaceType = "Porch";
    } else if(code.includes("SPA") ) {
      spaceType = "Hot Tub / Spa Area";
    } else if(code.includes("SUMMER KITCHEN") ) {
      spaceType = "Outdoor Kitchen";
    }
    if (code.includes("UNFINISHED") || code.includes("SEMIFINISHED") || code.includes("SEMI-FINISHED")) {
      isFinished = false;
    }
    if (spaceType) {
      spaceTypeCounter.increment(spaceType);
      const spaceTypeIndex = spaceTypeCounter.get(spaceType);
      layouts.push(defaultLayout(spaceType, null, `${(bIdx + 1)}.${(spaceTypeIndex)}`, null, null, area, isFinished));
    }
    // Add more conditions for other subarea types if identifiable from the code/description
  });

  return layouts;
}

function makeExtraFeaturesLayoutEntries(extraFeatures) {
  const layouts = [];
  let spaceTypeCounter = new MultiCounter();

  // Process subareas for additional spaces
  (extraFeatures || []).forEach(sub => {
    // const heated = Boolean(sub.heated);
    const code = sub.description ? sub.description.trim().toUpperCase() : "";
    let spaceType = null;
    let isFinished = true;
    if (code.includes("POOL") && code.includes("HOUSE")) {
      spaceType = "Pool House";
    } else if(code.includes("POOL")) {
      spaceType = "Outdoor Pool";
    } else if(code.includes("GARAGE")) {
      spaceType = "Attached Garage";
    } else if(code.includes(" SHED")) {
      spaceType = "Shed";
    } else if(code.includes("GREENHOUSE")) {
      spaceType = "Greenhouse";
    } else if(code.includes("PORCH") && code.includes("ENCLOSED") ) {
      spaceType = "Enclosed Porch";
    } else if(code.includes("PORCH") && code.includes("SCREEN") ) {
      spaceType = "Screened Porch";
    } else if(code.includes("PORCH") ) {
      spaceType = "Porch";
    } else if(code.includes("SPA") ) {
      spaceType = "Hot Tub / Spa Area";
    } else if(code.includes("SUMMER KITCHEN") ) {
      spaceType = "Outdoor Kitchen";
    }
    if (code.includes("UNFINISHED") || code.includes("SEMIFINISHED") || code.includes("SEMI-FINISHED")) {
      isFinished = false;
    }
    if (spaceType) {
      spaceTypeCounter.increment(spaceType);
      const spaceTypeIndex = spaceTypeCounter.get(spaceType);
      layouts.push(defaultLayout(spaceType, null, `${(spaceTypeIndex)}`, null, null, null, isFinished));
    }
    // Add more conditions for other subarea types if identifiable from the code/description
  });

  return layouts;
}

// function normalizeSpaceType(type) {
//   const mapping = {
//     "BEDROOM": "Bedroom",
//     "FULL BATHROOM": "Full Bathroom", // Changed from "FULL BATH"
//     "HALF BATHROOM": "Half Bathroom / Powder Room", // Changed from "HALF BATH"
//     "GARAGE": "Attached Garage",
//     "PORCH": "Porch",
//     "SCREENED PORCH": "Screened Porch",
//     "LIVING ROOM": "Living Room",
//   };
//   // Ensure the input 'type' is converted to uppercase for lookup
//   return mapping[type.toUpperCase()] || null;
// }

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  console.log(`Detected Parcel ID: ${parcelId}`);

  const parsedData = parsePolkHtml($);
  const buildings = mapPolkBuildings(parsedData.buildings || []);

  let layouts = [];
  buildings.forEach((b, i) => {
    const buildLayouts = makeLayoutEntries(b, i);
    layouts = layouts.concat(buildLayouts);
  });
  const featureLayouts = makeExtraFeaturesLayoutEntries(parsedData.extraFeatures || []);
  layouts = layouts.concat(featureLayouts);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
  console.log("Script finished successfully.");
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in layoutMapping:", err.message);
    console.error(err.stack); // Log the full stack trace for better debugging
    process.exit(1);
  }
}
