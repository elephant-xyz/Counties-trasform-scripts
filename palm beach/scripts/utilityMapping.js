// Utility mapping script
// Reads input.html, extracts available utility info (none present), and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");



/**
 * Extracts the `model` object literal from the onClickTaxCalculator function in palmbeach.html
 * and returns it as a plain JavaScript object.
 *
 * @param {string} $ - The HTML content of palmbeach.html parsed using cheerio.
 * @returns {object|null} Parsed model object if found, otherwise null.
 */
function parsePalmBeachModel($) {
  let targetScript = null;

  $('script').each((_, element) => {
    const scriptBody = $(element).html();
    if (scriptBody && scriptBody.includes('function onClickTaxCalculator')) {
      targetScript = scriptBody;
      return false; // Break out early once we find the function definition
    }
    return undefined;
  });

  if (!targetScript) {
    return null;
  }

  const modelIndex = targetScript.indexOf('var model');
  if (modelIndex === -1) {
    return null;
  }

  const objectStart = targetScript.indexOf('{', modelIndex);
  if (objectStart === -1) {
    return null;
  }

  const objectLiteral = extractObjectLiteral(targetScript, objectStart);
  if (!objectLiteral) {
    return null;
  }

  try {
    const parsedModel = JSON.parse(objectLiteral);
    parsedModel.structuralDetails = enhanceStructuralDetails(parsedModel.structuralDetails);
    return parsedModel;
  } catch (error) {
    throw new Error(`Failed to parse Palm Beach model JSON: ${error.message}`);
  }
}

/**
 * Walks the script content starting at the first opening brace and returns the
 * full object literal including nested objects.
 *
 * @param {string} script - JavaScript source that contains the object literal.
 * @param {number} startIndex - Index of the first `{` character.
 * @returns {string|null} Raw object literal text or null if it cannot be isolated.
 */
function extractObjectLiteral(script, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = startIndex; i < script.length; i += 1) {
    const char = script[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return script.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function enhanceStructuralDetails(structuralDetails) {
  if (!structuralDetails || typeof structuralDetails !== 'object') {
    return structuralDetails || null;
  }

  const combinedBuildings = combineStructuralElements(structuralDetails.StructuralElements);
  return {
    ...structuralDetails,
    combinedBuildings,
  };
}

function combineStructuralElements(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }

  const grouped = elements.reduce((acc, element) => {
    const buildingNumber = element?.BuildingNumber || 'Unknown';
    if (!acc[buildingNumber]) {
      acc[buildingNumber] = {
        buildingNumber,
        sections: {},
      };
    }

    const section = element?.DetailsSection || 'General';
    const name = element?.ElementName || `element${element?.ElementNumber || ''}`;
    const value = element?.ElementValue ?? null;

    if (!acc[buildingNumber].sections[section]) {
      acc[buildingNumber].sections[section] = {};
    }

    const sectionEntries = acc[buildingNumber].sections[section];
    if (!(name in sectionEntries)) {
      sectionEntries[name] = value;
    } else if (Array.isArray(sectionEntries[name])) {
      sectionEntries[name].push(value);
    } else {
      sectionEntries[name] = [sectionEntries[name], value];
    }

    return acc;
  }, {});

  return Object.values(grouped);
}

function mapCooling(raw) {
  const txt = (raw || "").toLowerCase();
  if (txt.includes("htg & ac") || txt.includes("ac") || txt.includes("air"))
    return "CentralAir";
  return null;
}

function mapHeatingType(heatType, heatFuel) {
  const ht = (heatType || "").toLowerCase();
  const fuel = (heatFuel || "").toLowerCase();
  if (ht.includes("forced") || ht.includes("duct")) {
    if (fuel.includes("electric")) return "ElectricFurnace";
    if (fuel.includes("gas")) return "GasFurnace";
    return "Central";
  }
  if (fuel.includes("electric")) return "Electric";
  if (fuel.includes("gas")) return "Gas";
  return null;
}

function buildUtilityRecord(buildings) {
  let utilities = {};
  buildings.forEach((building, bIdx) => {
    const airCond = building?.sections?.Top?.["Air Condition Desc."];
    const heatType = building?.sections?.Top?.["Heat Type"];
    const heatFuel = building?.sections?.Top?.["Heat Fuel"];
    const util = {
      cooling_system_type: mapCooling(airCond),
      heating_system_type: mapHeatingType(heatType, heatFuel),
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
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

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parsed = parsePalmBeachModel($);

  const parcelId = parsed.propertyDetail.PCN;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");

  const output = {};
  output[propertyKey] = buildUtilityRecord((parsed.structuralDetails && parsed.structuralDetails.combinedBuildings) ? parsed.structuralDetails.combinedBuildings : []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data to ${outPath}`);
})();
