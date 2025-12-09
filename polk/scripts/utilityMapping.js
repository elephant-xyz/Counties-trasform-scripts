// Utility Mapping Script
// Reads input.html, parses with cheerio, extracts utility fields per schema, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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
    centralHeatingCooling: null,
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
    } else if (label === "CNTRL HEATING / AC") {
      layoutBuilding.centralHeatingCooling = element.units && element.units === "Y";
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

function inferHVAC(building) {
  if (building.centralHeatingCooling) {
    return {
      heating_system_type: "Central",
      cooling_system_type: "CentralAir"
    }
  }
  return {
    heating_system_type: null,
    cooling_system_type: null
  }
}

function buildUtilityRecord(buildings) {
  let utilities = {};
  buildings.forEach((building, bIdx) => {
    const hvac = inferHVAC(building);
    const util = {
      cooling_system_type: hvac.cooling_system_type,
      heating_system_type: hvac.heating_system_type,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      plumbing_system_installation_date: null,
      sewer_connection_date: null,
      solar_installation_date: null,
      solar_inverter_installation_date: null,
      solar_inverter_manufacturer: null,
      solar_inverter_model: null,
      water_connection_date: null,
      water_heater_installation_date: null,
      water_heater_manufacturer: null,
      water_heater_model: null,
      well_installation_date: null,
    };
    utilities[(bIdx + 1).toString()] = util;
  });
  return utilities;
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);

  const parsedData = parsePolkHtml($);
  const buildings = mapPolkBuildings(parsedData.buildings || []);
  const utilityObj = buildUtilityRecord(buildings || []);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = utilityObj;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in utilityMapping:", err.message);
    process.exit(1);
  }
}
