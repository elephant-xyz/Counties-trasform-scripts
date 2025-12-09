const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getPrimeKey($, html) {
  const m = html.match(/Prime Key:\s*(\d+)/i);
  if (m) return m[1].trim();
  let key = null;
  $("*").each((i, el) => {
    const t = $(el).text();
    const mm = t && t.match(/Prime Key:\s*(\d+)/i);
    if (mm) {
      key = mm[1].trim();
      return false;
    }
  });
  return key || "unknown";
}

const BUILDING_HEADER_RE = /^Building\s+(\d+)\s+of\s+(\d+)/i;
const allowedValues = {
  heating_system_type: new Set([
    "ElectricFurnace",
    "Electric",
    "GasFurnace",
    "Ductless",
    "Radiant",
    "Solar",
    "HeatPump",
    "Central",
    "Baseboard",
    "Gas",
    null,
  ]),
  heating_fuel_type: new Set([
    "Electric",
    "NaturalGas",
    "Propane",
    "Oil",
    "Kerosene",
    "WoodPellet",
    "Wood",
    "Geothermal",
    "Solar",
    "DistrictSteam",
    "Other",
    null,
  ]),
};

const rulesByField = {
  heating_system_type: [
    { pattern: /heat pump/i, value: "HeatPump" },
    { pattern: /baseboard/i, value: "Baseboard" },
    { pattern: /nonducted/i, value: "Ductless" },
    { pattern: /ducted/i, value: "Central" },
    { pattern: /convection/i, value: "Central" },
    { pattern: /radiant/i, value: "Radiant" },
    { pattern: /(floor|wall)\s+furnace/i, value: "GasFurnace" },
    { pattern: /steam|hot water/i, value: "Central" },
  ],
  heating_fuel_type: [
    { pattern: /electric/i, value: "Electric" },
    { pattern: /wood/i, value: "Wood" },
    { pattern: /solar/i, value: "Solar" },
    { pattern: /oil/i, value: "Oil" },
    { pattern: /gas/i, value: "NaturalGas" },
  ],
};

function mapValue(label, rules, allowedSet) {
  const target = label || "";
  for (const { pattern, value } of rules) {
    if (pattern.test(target)) {
      return allowedSet.has(value) ? value : null;
    }
  }
  return null;
}

function normalizeLabel(rawValue) {
  if (!rawValue) {
    return "";
  }
  return rawValue.replace(/^\s*\d+\s*[-:]?\s*/, "").trim();
}

function mapFieldValue(fieldName, rawValue) {
  if (!rawValue) {
    return null;
  }
  const rules = rulesByField[fieldName];
  const allowed = allowedValues[fieldName];
  if (!rules || !allowed) {
    return null;
  }
  const normalized = normalizeLabel(rawValue);
  return mapValue(normalized, rules, allowed);
}

function parseBuildings($) {
  const notesByBuilding = extractBuildingNotes($);
  const headers = $('b u')
    .filter((i, el) => BUILDING_HEADER_RE.test($(el).text().trim()))
    .toArray();

  return headers
    .map((header) => parseBuildingBlock($, header, notesByBuilding))
    .filter(Boolean);
}

function parseBuildingBlock($root, headerNode, notesByBuilding) {
  const headerTag = $root(headerNode).closest('b');
  if (!headerTag.length) {
    return null;
  }

  const chunkNodes = collectChunkNodes($root, headerTag.get(0));
  if (!chunkNodes.length) {
    return null;
  }

  const chunkHtml = `<section>${chunkNodes
    .map((node) => serializeNode($root, node))
    .join('')}</section>`;
  const $ = cheerio.load(chunkHtml);
  const container = $('section').first();
  const headerText = container.find('b u').first().text().trim();
  const match = headerText.match(BUILDING_HEADER_RE);

  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  const totalBuildings = Number(match[2]);
  const traverse = extractTraverse($, container);
  // const sketchSrc = container.find('img').first().attr('src') || null;
  const sketchSrc = null;
  const characteristics = extractCharacteristics($);
  const typeRows = extractTypeRows($);
  const sectionDetails = extractSectionDetails($);

  return {
    number,
    totalBuildings,
    traverse,
    sketchSrc,
    characteristics,
    typeRows,
    sectionDetails,
    note: notesByBuilding[number] || null,
  };
}

function collectChunkNodes($, startNode) {
  const nodes = [];
  let current = startNode;
  nodes.push(current);

  while (current && current.nextSibling) {
    current = current.nextSibling;
    if (
      current.type === 'tag' &&
      current.name === 'b' &&
      BUILDING_HEADER_RE.test($(current).text().trim())
    ) {
      break;
    }
    nodes.push(current);
  }

  return nodes;
}

function serializeNode($, node) {
  return node.type === 'text' ? node.data : $.html(node);
}

function extractTraverse($, container) {
  const header = container.children('b').first().get(0);
  const nodes = container.contents().toArray();
  let seenHeader = false;

  for (const node of nodes) {
    if (node === header) {
      seenHeader = true;
      continue;
    }
    if (!seenHeader) {
      continue;
    }
    if (node.type === 'tag' && node.name === 'img') {
      break;
    }
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function extractCharacteristics($) {
  const center = $('center')
    .filter((i, el) => $(el).text().includes('Building Characteristics'))
    .first();
  const table = center.length ? center.nextAll('table').first() : $('table').first();

  if (!table.length) {
    return {};
  }

  const outerRow = table.find('tr').first();
  const outerCells = outerRow.children('td');
  const leftCell = outerCells.eq(0);
  const rightCell = outerCells.eq(1);
  const nestedTds = leftCell.find('td');
  const leftLabels = extractLines($(nestedTds.get(0)));
  const leftValues = extractLines($(nestedTds.get(1)));
  const data = {};

  leftLabels.forEach((label, idx) => {
    const key = toCamelCase(label);
    if (key) {
      data[key] = leftValues[idx] || null;
    }
  });

  Object.assign(data, extractInlinePairs($, rightCell));

  return data;
}

function extractTypeRows($) {
  let targetTable;
  $('table').each((i, el) => {
    const headers = $(el)
      .find('tr')
      .first()
      .find('th')
      .map((_, th) => $(th).text().trim())
      .get();
    if (headers.length && headers[0] === 'Type' && headers.includes('Exterior Walls')) {
      targetTable = $(el);
      return false;
    }
    return undefined;
  });

  if (!targetTable) {
    return [];
  }

  return parseHeaderTable($, targetTable);
}

function extractSectionDetails($) {
  const sectionHeader = $('b')
    .filter((i, el) => $(el).text().trim().startsWith('Section:'))
    .first();
  const table = sectionHeader.length ? sectionHeader.nextAll('table').first() : null;

  if (!table || !table.length) {
    return {};
  }

  const details = {};
  table.find('td').each((_, cell) => {
    Object.assign(details, extractInlinePairs($, $(cell)));
  });

  return details;
}

function parseHeaderTable($, table) {
  const headerCells = table.find('tr').first().find('th');
  const headers = headerCells.map((_, th) => toCamelCase($(th).text().trim())).get();

  return table
    .find('tr')
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      const rowObj = {};
      headers.forEach((header, idx) => {
        if (!header) {
          return;
        }
        rowObj[header] = cells.eq(idx).text().replace(/\s+/g, ' ').trim() || null;
      });
      return rowObj;
    })
    .get();
}

function extractLines(cell) {
  if (!cell || !cell.length) {
    return [];
  }

  const html = cell.html() || '';
  return html
    .split(/<br\s*\/?>/i)
    .map((part) => cheerio.load(`<span>${part}</span>`).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractInlinePairs($, cell) {
  if (!cell || !cell.length) {
    return {};
  }

  const result = {};
  let currentKey = null;

  cell.contents().each((_, node) => {
    if (node.type === 'tag' && node.name === 'b') {
      currentKey = toCamelCase($(node).text().replace(/:/g, '').trim()) || null;
      if (currentKey && !(currentKey in result)) {
        result[currentKey] = '';
      }
      return;
    }

    if (node.type === 'tag' && node.name === 'br') {
      currentKey = null;
      return;
    }

    if (currentKey) {
      const text = $(node).text().replace(/\s+/g, ' ').trim();
      if (text) {
        result[currentKey] = result[currentKey]
          ? `${result[currentKey]} ${text}`.trim()
          : text;
      }
    }
  });

  Object.keys(result).forEach((key) => {
    if (!result[key]) {
      result[key] = null;
    }
  });

  return result;
}

function extractBuildingNotes($) {
  const notes = {};
  const notesCenter = $('center')
    .filter((i, el) => $(el).text().trim() === 'Appraiser Notes')
    .first();

  if (!notesCenter.length) {
    return notes;
  }

  let node = notesCenter.get(0).nextSibling;
  while (node) {
    if (node.type === 'tag' && node.name === 'hr') {
      break;
    }
    if (node.type === 'text') {
      const text = node.data.trim();
      const match = /^BLDG0*([0-9]+)\s*=\s*(.+)$/i.exec(text);
      if (match) {
        notes[Number(match[1])] = match[2].trim();
      }
    }
    node = node.nextSibling;
  }

  return notes;
}

function toCamelCase(label) {
  if (!label) {
    return '';
  }

  const cleaned = label.replace(/[:]/g, ' ').trim();
  const parts = cleaned.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  return parts
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
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

function createEmptyUtilityRecord() {
  return {
      cooling_system_type: null,
      heating_system_type: null,
      heating_fuel_type: null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
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
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      plumbing_fixture_count: null,
      plumbing_fixture_quality: null,
      plumbing_fixture_type_primary: null,
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
}

function buildUtility($) {
  const parsedBuildings = parseBuildings($);
  const result = {};

  parsedBuildings.forEach((parsedBuilding, index) => {
    const typeRow = (parsedBuilding.typeRows && parsedBuilding.typeRows[0]) || {};
    const sectionDetails = parsedBuilding.sectionDetails || {};
    const characteristics = parsedBuilding.characteristics || {};
    const record = createEmptyUtilityRecord();
    record.heating_system_type = mapFieldValue(
      "heating_system_type",
      sectionDetails.heatMeth1,
    );
    record.heating_fuel_type = mapFieldValue(
      "heating_fuel_type",
      sectionDetails.heatFuel1,
    );

    const key = parsedBuilding.number
      ? parsedBuilding.number.toString()
      : (index + 1).toString();
    result[key] = record;
  });

  return result;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const id = getPrimeKey($, html);
  const data = buildUtility($);

  const outObj = {};
  outObj[`property_${id}`] = data;

  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);

  fs.writeFileSync(path.join(ownersDir, "utilities_data.json"), JSON.stringify(outObj, null, 2));
  console.log(`Wrote utilities data for property_${id} to owners/`);
})();
