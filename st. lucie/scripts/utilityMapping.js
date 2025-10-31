// Utility Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// --- Start of extraFeatureHelpers.js content ---

function tokenizeFeatureText(text) {
  return (text || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function parseNumeric(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseExtraFeatures($) {
  const features = [];

  const selectors = [
    "#sfyi-info .sfyi-grid table.table-striped tbody tr",
    "#extra-features table tbody tr",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const row = $(el);
      const typeCell = row.find("th, td").first();
      const type = (typeCell.text() || "").trim();
      if (!type) return;

      // Adjusting indices based on the provided HTML structure for extra features
      // Assuming the structure is: Type | Quantity | Units | Year Built
      const qtyText = row.find("td").eq(0).text().trim(); // This might be incorrect if Type is in <th>
      const unitsText = row.find("td").eq(1).text().trim(); // This might be incorrect
      const yearBuiltText = row.find("td").eq(2).text().trim(); // This might be incorrect

      // Re-evaluating based on common table structures:
      // If 'type' is from <th>, then <td>s start from index 0 for Quantity, Units, Year Built
      // If 'type' is from <td>, then <td>s start from index 1 for Quantity, Units, Year Built
      let quantity, unitsValue, yearBuilt;

      // Let's assume the common case where the first cell is the label (type)
      // and subsequent cells are data.
      // If the first cell is <th>, then data starts from <td> at index 0.
      // If the first cell is <td> and it's the 'type', then data starts from <td> at index 1.
      // To be safe, let's try to find cells by their content or position relative to the type.

      const allTds = row.find("td");
      if (allTds.length >= 3) { // Assuming at least 3 data columns after the type
        quantity = parseNumeric(allTds.eq(0).text().trim());
        unitsValue = parseNumeric(allTds.eq(1).text().trim());
        yearBuilt = parseNumeric(allTds.eq(2).text().trim());
      } else if (allTds.length === 2) { // Maybe Quantity and Units, or Quantity and Year
        quantity = parseNumeric(allTds.eq(0).text().trim());
        unitsValue = parseNumeric(allTds.eq(1).text().trim());
      } else if (allTds.length === 1) { // Only Quantity or Units
        quantity = parseNumeric(allTds.eq(0).text().trim());
      }


      features.push({
        rawType: type,
        tokens: tokenizeFeatureText(type),
        quantity: quantity,
        unitsRaw: unitsText || null, // Keep raw text for units if needed
        unitsValue: unitsValue,
        yearBuilt: yearBuilt ? Math.round(yearBuilt) : null,
      });
    });
  });

  return features;
}

function hasToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.includes(normalized);
}

function hasApproxToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.some(
    (t) => t.startsWith(normalized) || normalized.startsWith(t),
  );
}

function hasAnyToken(feature, tokens) {
  return tokens.some((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

function hasAllTokens(feature, tokens) {
  return tokens.every((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

// --- End of extraFeatureHelpers.js content ---


function mergeUpdateValue(target, value) {
  if (value == null) return target;
  if (Array.isArray(value)) {
    const base = Array.isArray(target) ? target : target == null ? [] : [target];
    const merged = base.slice();
    value.forEach((item) => {
      if (item == null) return;
      if (!merged.includes(item)) merged.push(item);
    });
    return merged;
  }
  if (target == null) return value;
  if (Array.isArray(target)) {
    if (!target.includes(value)) target.push(value);
    return target;
  }
  if (target === value) return target;
  return [target, value];
}

function recordFeatureUsage(map, feature, updates = {}, buildingNumber = null) {
  if (!feature) return;
  const key = feature.rawType || (feature.tokens ? feature.tokens.join("|") : `feature_${map.size + 1}`);
  if (!map.has(key)) {
    map.set(key, {
      raw_type: feature.rawType || null,
      tokens: feature.tokens || null,
      building_number: buildingNumber != null ? buildingNumber : null,
      source: "extra_feature",
      mapped_fields: {},
    });
  }
  const entry = map.get(key);
  if (updates && typeof updates === "object") {
    for (const [field, value] of Object.entries(updates)) {
      if (value == null) continue;
      entry.mapped_fields[field] = mergeUpdateValue(entry.mapped_fields[field], value);
    }
  }
}

function normalizeFeatureUsageOutput(map) {
  return Array.from(map.values()).map((entry) => {
    if (entry.tokens && entry.tokens.length === 0) entry.tokens = null;
    if (entry.mapped_fields && Object.keys(entry.mapped_fields).length === 0) {
      delete entry.mapped_fields;
    }
    return entry;
  });
}

function extractTotalBuildingCount(buildingSections) {
  if (!buildingSections || buildingSections.length === 0) return null;
  const sequenceText = buildingSections.first().find(".building-sequence").text().trim();
  if (!sequenceText) return null;
  const match = sequenceText.match(/\((\d+)\s*of\s*(\d+)\)/i);
  return match ? parseInt(match[2], 10) || null : null;
}

function extractBuildingNumber($, $building, fallbackIndex) {
  if (!$building) return fallbackIndex + 1;
  const sequenceText = $building.find(".building-sequence").text().trim();
  if (sequenceText) {
    const directMatch = sequenceText.match(/Building\s*(?:No\.?|#)?\s*(\d+)/i);
    if (directMatch) {
      const n = parseInt(directMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    const ordinalMatch = sequenceText.match(/\((\d+)\s*of\s*\d+\)/i);
    if (ordinalMatch) {
      const n = parseInt(ordinalMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
    const genericMatch = sequenceText.match(/\b(\d+)\b/);
    if (genericMatch) {
      const n = parseInt(genericMatch[1], 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  const attr = $building.attr("data-building-number");
  if (attr && !Number.isNaN(Number(attr))) return Number(attr);
  return fallbackIndex + 1;
}


function loadHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  // Strip Angular-specific attributes
  html = html.replace(/_ngcontent-[a-z0-9-]+=""/g, '');
  html = html.replace(/_nghost-[a-z0-9-]+=""/g, '');
  html = html.replace(/ng-version="[0-9.]+"/g, '');

  return cheerio.load(html);
}

function getParcelId($) {
  const table = $("#property-identification table.container").first();
  let parcelId = null;
  table.find("tr").each((i, el) => {
    const $row = $(el); // Use $(el) here
    const th = $row.find("th").first().text().trim();
    if (/Parcel ID/i.test(th)) {
      const td = $row.find("td").first();
      const bold = td.find("b");
      parcelId = (bold.text() || td.text() || "").trim();
      return false; // Stop iterating once found
    }
  });
  return parcelId || "unknown";
}

// This function now expects the first argument to be the *global* Cheerio object,
// and the second argument to be the Cheerio object representing the *scope* to search within.
function getTextFromTableByLabel($, $scope, containerSelector, label) {
  const container = $scope.find(containerSelector).first();
  let found = null;
  container.find("tr").each((i, el) => {
    const $row = $(el); // Use $(el) here
    const th = $row.find("th").first().text().trim();
    if (th.toLowerCase().includes(label.toLowerCase())) {
      const val = $row.find("td").first().text().trim();
      found = val || null;
      return false; // Stop iterating once found
    }
  });
  return found;
}

function mapCooling(acPercentText) {
  if (!acPercentText) return null;
  const pct = parseFloat(acPercentText.replace(/[^0-9.]/g, ""));
  if (isNaN(pct) || pct === 0) return null;
  // No specific system indicated; default to CentralAir if cooled
  return "CentralAir";
}

function mapHeatingType(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("heat pump")) return "HeatPump";
  if (t.includes("gas furnace")) return "GasFurnace";
  if (t.includes("electric furnace")) return "ElectricFurnace";
  if (t.includes("electric")) return "Electric"; // Catch-all for electric if not furnace
  if (t.includes("radiant")) return "Radiant";
  if (t.includes("baseboard")) return "Baseboard";
  if (t.includes("central")) return "Central";
  if (t.includes("frcdhotair")) return "Central"; // Assuming FrcdHotAir implies a central system
  return null;
}

function mapHeatingFuel(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("natural gas")) return "NaturalGas";
  if (t.includes("propane") || t.includes("lp")) return "Propane";
  if (t.includes("oil")) return "Oil";
  if (t.includes("kerosene")) return "Kerosene";
  if (t.includes("wood pellet")) return "WoodPellet";
  if (t.includes("wood")) return "Wood";
  if (t.includes("electric")) return "Electric";
  if (t.includes("geothermal")) return "Geothermal";
  if (t.includes("solar")) return "Solar";
  return null;
}

function extractUtility($, buildingElement, extraFeatures, buildingNumber) {
  // Create a Cheerio object specifically for the current building element
  const $building = $(buildingElement);

  const interiorTableSelector = ".interior-container table.container";
  const acPct = getTextFromTableByLabel($, $building, interiorTableSelector, "A/C %");
  const heatTypeRaw = getTextFromTableByLabel(
    $, $building,
    interiorTableSelector,
    "Heat Type",
  );
  const heatFuelRaw = getTextFromTableByLabel(
    $, $building,
    interiorTableSelector,
    "Heat Fuel",
  );
  const electricRaw = getTextFromTableByLabel(
    $, $building,
    interiorTableSelector,
    "Electric",
  );

  let electricalWiringType = null;
  // If electricRaw contained something like "Copper Wiring", we could map it.
  // Example: if (electricRaw && electricRaw.toLowerCase().includes("copper")) electricalWiringType = "Copper";

  const utilities = {
    cooling_system_type: mapCooling(acPct),
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: electricalWiringType,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: mapHeatingFuel(heatFuelRaw),
    heating_system_type: mapHeatingType(heatTypeRaw),
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_fixture_count: null,
    plumbing_fixture_quality: null,
    plumbing_fixture_type_primary: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_inverter_visible: false,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    water_source_type: null,
    well_installation_date: null,
    request_identifier: null,
    building_number: buildingNumber != null ? buildingNumber : null,
    source_http_request: {
      method: "GET",
      url: "https://apps.paslc.gov/rerecordcard", // Placeholder, replace with actual source URL if available
    },
  };

  // Attempt to infer public_utility_type from available data
  if (electricRaw) {
    utilities.public_utility_type = "ElectricityAvailable";
  }
  // If there were fields for water or sewer, we would add them here.
  // Example: if (getTextFromTableByLabel($, someSelector, "Water Type")) utilities.public_utility_type = "WaterAvailable";

  const featureUsage = applyExtraFeaturesToUtility(utilities, extraFeatures, buildingNumber);

  return { utility: utilities, featureUsage };
}

function applyExtraFeaturesToUtility(utilities, extraFeatures, buildingNumber) {
  if (!utilities || !Array.isArray(extraFeatures) || extraFeatures.length === 0) {
    return [];
  }

  const usageMap = new Map();
  const registerUsage = (feature, updates) =>
    recordFeatureUsage(usageMap, feature, updates, buildingNumber);

  const smartFeatures = new Set(
    Array.isArray(utilities.smart_home_features)
      ? utilities.smart_home_features.filter(Boolean)
      : [],
  );
  const addSmartFeature = (label) => {
    if (label) smartFeatures.add(label);
  };

  const centralAC = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["AIR", "CONDITIONER", "CENTRAL"]),
  );
  if (centralAC) {
    const updates = {};
    if (!utilities.cooling_system_type) {
      utilities.cooling_system_type = "CentralAir";
      updates.cooling_system_type = "CentralAir";
    }
    utilities.hvac_condensing_unit_present = true;
    updates.hvac_condensing_unit_present = true;
    if (centralAC.yearBuilt && !utilities.hvac_installation_date) {
      const installDate = `${centralAC.yearBuilt}-01-01`;
      utilities.hvac_installation_date = installDate;
      updates.hvac_installation_date = installDate;
    }
    registerUsage(centralAC, updates);
  }

  const commercialAC = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["AIR", "CONDITIONER", "COMMERCIAL"]),
  );
  if (commercialAC && !centralAC) {
    const updates = {};
    if (!utilities.cooling_system_type) {
      utilities.cooling_system_type = "CentralAir";
      updates.cooling_system_type = "CentralAir";
    }
    utilities.hvac_condensing_unit_present = true;
    updates.hvac_condensing_unit_present = true;
    if (commercialAC.yearBuilt && !utilities.hvac_installation_date) {
      const installDate = `${commercialAC.yearBuilt}-01-01`;
      utilities.hvac_installation_date = installDate;
      updates.hvac_installation_date = installDate;
    }
    registerUsage(commercialAC, updates);
  }

  const wallAC = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["AIR", "CONDITIONER", "WALL"]),
  );
  if (wallAC && !utilities.cooling_system_type) {
    const updates = {
      cooling_system_type: "WindowAirConditioner",
      hvac_condensing_unit_present: true,
    };
    utilities.cooling_system_type = "WindowAirConditioner";
    utilities.hvac_condensing_unit_present = true;
    if (wallAC.yearBuilt && !utilities.hvac_installation_date) {
      const installDate = `${wallAC.yearBuilt}-01-01`;
      utilities.hvac_installation_date = installDate;
      updates.hvac_installation_date = installDate;
    }
    registerUsage(wallAC, updates);
  }

  const washerHookup = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["HOOKUP", "WASHER"]),
  );
  if (washerHookup) {
    addSmartFeature("Washer Hookup");
    registerUsage(washerHookup, { smart_home_features_added: ["Washer Hookup"] });
  }

  const dryerHookup = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["HOOKUP", "DRYER"]),
  );
  if (dryerHookup) {
    addSmartFeature("Dryer Hookup");
    registerUsage(dryerHookup, { smart_home_features_added: ["Dryer Hookup"] });
  }

  const fireSprinkler = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["FIRE", "SPRINKLER"]),
  );
  if (fireSprinkler) {
    addSmartFeature("Fire Sprinkler");
    registerUsage(fireSprinkler, { smart_home_features_added: ["Fire Sprinkler"] });
  }

  const elevator = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["ELEVATOR"]),
  );
  if (elevator) {
    addSmartFeature("Residential Elevator");
    registerUsage(elevator, { smart_home_features_added: ["Residential Elevator"] });
  }

  const plumbingResidential = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["PLUMBING", "FIXTURES", "RES"]),
  );
  if (plumbingResidential) {
    const count =
      plumbingResidential.unitsValue || plumbingResidential.quantity;
    const updates = {};
    if (count && (!utilities.plumbing_fixture_count || count > utilities.plumbing_fixture_count)) {
      utilities.plumbing_fixture_count = count;
      updates.plumbing_fixture_count = count;
    }
    if (
      plumbingResidential.yearBuilt &&
      !utilities.plumbing_system_installation_date
    ) {
      const installDate = `${plumbingResidential.yearBuilt}-01-01`;
      utilities.plumbing_system_installation_date = installDate;
      updates.plumbing_system_installation_date = installDate;
    }
    registerUsage(plumbingResidential, updates);
  }

  const plumbingCommercial = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["PLUMBING", "FIXTURES", "COM"]),
  );
  if (plumbingCommercial) {
    const count =
      plumbingCommercial.unitsValue || plumbingCommercial.quantity;
    const updates = {};
    if (count && (!utilities.plumbing_fixture_count || count > utilities.plumbing_fixture_count)) {
      utilities.plumbing_fixture_count = count;
      updates.plumbing_fixture_count = count;
    }
    if (
      plumbingCommercial.yearBuilt &&
      !utilities.plumbing_system_installation_date
    ) {
      const installDate = `${plumbingCommercial.yearBuilt}-01-01`;
      utilities.plumbing_system_installation_date = installDate;
      updates.plumbing_system_installation_date = installDate;
    }
    registerUsage(plumbingCommercial, updates);
  }

  const publicWaterFeature = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["PLANT", "WATER"]),
  );
  if (publicWaterFeature && !utilities.water_source_type) {
    const updates = {};
    utilities.water_source_type = "Public";
    updates.water_source_type = "Public";
    if (!utilities.public_utility_type) {
      utilities.public_utility_type = "WaterAvailable";
      updates.public_utility_type = "WaterAvailable";
    }
    registerUsage(publicWaterFeature, updates);
  }

  const publicSewerFeature = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["PLANT", "SEWER"]),
  );
  if (publicSewerFeature && !utilities.sewer_type) {
    const updates = {};
    utilities.sewer_type = "Public";
    updates.sewer_type = "Public";
    if (!utilities.public_utility_type) {
      utilities.public_utility_type = "SewerAvailable";
      updates.public_utility_type = "SewerAvailable";
    }
    registerUsage(publicSewerFeature, updates);
  }

  const waterTankFeature = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["TANK", "WATER"]),
  );
  if (waterTankFeature && !utilities.water_source_type) {
    utilities.water_source_type = "Well";
    registerUsage(waterTankFeature, { water_source_type: "Well" });
  }

  const gasTankFeature = extraFeatures.find((feature) =>
    hasAllTokens(feature, ["TANK", "GAS"]),
  );
  if (gasTankFeature) {
    const updates = {};
    if (!utilities.heating_fuel_type) {
      utilities.heating_fuel_type = "Propane";
      updates.heating_fuel_type = "Propane";
    }
    if (!utilities.public_utility_type) {
      utilities.public_utility_type = "NaturalGasAvailable";
      updates.public_utility_type = "NaturalGasAvailable";
    }
    registerUsage(gasTankFeature, updates);
  }

  utilities.smart_home_features = smartFeatures.size
    ? Array.from(smartFeatures)
    : null;

  return normalizeFeatureUsageOutput(usageMap);
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const extraFeatures = parseExtraFeatures($);
  const parcelId = getParcelId($);

  const allUtilities = [];
  const extraFeatureUsage = [];
  const buildingInfoSections = $('article[id="building-info"]');
  const totalBuildings = extractTotalBuildingCount(buildingInfoSections);

  buildingInfoSections.each((index, element) => {
    const $building = $(element);
    const buildingNumber = extractBuildingNumber($, $building, index);
    const { utility, featureUsage } = extractUtility($, element, extraFeatures, buildingNumber);
    if (totalBuildings !== null) {
      utility.number_of_buildings = totalBuildings;
    }
    allUtilities.push(utility);
    extraFeatureUsage.push(...featureUsage);
  });

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const propertyKey = `property_${parcelId}`;
  const propertyUtilities = {
    building_utilities: allUtilities,
  };
  if (totalBuildings !== null) {
    propertyUtilities.total_buildings = totalBuildings;
  }
  if (extraFeatureUsage.length > 0) {
    propertyUtilities.extra_feature_utilities = extraFeatureUsage;
  }

  const output = {
    [propertyKey]: propertyUtilities,
  };

  const outPath = path.join(outputDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
