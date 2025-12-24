// Utility mapping script (per-building extraction)
// Reads input.html, extracts per-building utility data, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textClean(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function intFromText(value) {
  if (!value) return null;
  const numeric = String(value).replace(/[^0-9\-]/g, "");
  if (!numeric) return null;
  const parsed = parseInt(numeric, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function floatFromText(value) {
  if (!value) return null;
  const numeric = String(value).replace(/[^0-9.\-]/g, "");
  if (!numeric) return null;
  const parsed = parseFloat(numeric);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeDateText(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const match = cleaned.match(
    /(\d{4})(?:[\/\-](\d{1,2})(?:[\/\-](\d{1,2}))?)?/,
  );
  if (!match) return cleaned;
  const year = match[1];
  const month = match[2] ? match[2].padStart(2, "0") : null;
  const day = match[3] ? match[3].padStart(2, "0") : null;
  if (year && month && day) return `${year}-${month}-${day}`;
  if (year && month) return `${year}-${month}`;
  if (year) return year;
  return cleaned;
}

function ensureDir(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function loadHtml(filePath) {
  return cheerio.load(fs.readFileSync(filePath, "utf8"));
}

function collectLabelValuePairs($, $panel) {
  const map = {};
  $panel.find("table tbody tr").each((_, tr) => {
    const $row = $(tr);
    const cells = $row.find("td");
    if (cells.length < 2) return;
    const label = textClean($(cells[0]).text()).replace(/:$/, "");
    const value = textClean($(cells[1]).text());
    if (!label || !value) return;
    if (!map[label]) map[label] = [];
    map[label].push(value);
  });
  return map;
}

function findValueByLabel(map, patterns) {
  for (const [label, values] of Object.entries(map)) {
    if (patterns.some((regex) => regex.test(label))) {
      return values[0];
    }
  }
  return null;
}

function normalizeCoolingSystemType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("CENTRAL")) return "CentralAir";
  if (val.includes("DUCTLESS") || val.includes("MINI SPLIT")) return "Ductless";
  if (val.includes("WINDOW")) return "WindowAirConditioner";
  if (val.includes("WHOLE") && val.includes("FAN")) return "WholeHouseFan";
  if (val.includes("CEILING") && val.includes("FAN"))
    return "CeilingFans";
  if (val.includes("CEILING FAN")) return "CeilingFan";
  if (val.includes("GEOTHERM")) return "GeothermalCooling";
  if (val.includes("ZONE")) return "Zoned";
  if (val.includes("HYBRID")) return "Hybrid";
  if (val.includes("ELECTRIC")) return "Electric";
  return null;
}

function normalizeHeatingSystemType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("HEAT PUMP")) return "HeatPump";
  if (val.includes("DUCTLESS") || val.includes("MINI SPLIT"))
    return "Ductless";
  if (val.includes("BASEBOARD")) return "Baseboard";
  if (val.includes("RADIANT")) return "Radiant";
  if (val.includes("FURNACE") && val.includes("GAS")) return "GasFurnace";
  if (val.includes("FURNACE") && val.includes("ELECT")) return "ElectricFurnace";
  if (val.includes("FURNACE")) return "Central";
  if (val.includes("GAS")) return "Gas";
  if (val.includes("ELECT")) return "Electric";
  if (val.includes("SOLAR")) return "Solar";
  if (val.includes("CENTRAL")) return "Central";
  return null;
}

function normalizeHeatingFuelType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("ELECT")) return "Electric";
  if (val.includes("NAT") && val.includes("GAS")) return "NaturalGas";
  if (val.includes("PROPANE") || val.includes("LP")) return "Propane";
  if (val.includes("OIL")) return "Oil";
  if (val.includes("KEROSENE")) return "Kerosene";
  if (val.includes("WOOD") && val.includes("PELLET")) return "WoodPellet";
  if (val.includes("WOOD")) return "Wood";
  if (val.includes("GEOTHERM")) return "Geothermal";
  if (val.includes("SOLAR")) return "Solar";
  if (val.includes("STEAM")) return "DistrictSteam";
  if (val.includes("OTHER")) return "Other";
  return null;
}

function normalizeElectricalWiringType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("COPPER")) return "Copper";
  if (val.includes("ALUM")) return "Aluminum";
  if (val.includes("KNOB") || val.includes("TUBE")) return "KnobAndTube";
  return null;
}

function normalizePlumbingSystemType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("PEX")) return "PEX";
  if (val.includes("COPPER")) return "Copper";
  if (val.includes("PVC")) return "PVC";
  if (val.includes("GALV")) return "GalvanizedSteel";
  if (val.includes("CAST")) return "CastIron";
  return null;
}

function normalizePublicUtilityType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("UNDERGROUND")) return "UndergroundUtilities";
  if (val.includes("SEWER")) return "SewerAvailable";
  if (val.includes("ELECT")) return "ElectricityAvailable";
  if (val.includes("GAS")) return "NaturalGasAvailable";
  if (val.includes("CABLE")) return "CableAvailable";
  if (val.includes("WATER")) return "WaterAvailable";
  return null;
}

function normalizeSewerType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("SEPTIC")) return "Septic";
  if (val.includes("COMBINED")) return "Combined";
  if (val.includes("SANITARY")) return "Sanitary";
  if (val.includes("PUBLIC") || val.includes("CITY")) return "Public";
  return null;
}

function normalizeSolarPanelType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("HYBRID")) return "Hybrid";
  if (val.includes("THERM")) return "SolarThermal";
  if (val.includes("PV") || val.includes("PHOTOVOLTAIC"))
    return "Photovoltaic";
  return null;
}

function normalizeWaterSourceType(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("WELL")) return "Well";
  if (val.includes("AQUIFER")) return "Aquifer";
  if (val.includes("PUBLIC") || val.includes("CITY") || val.includes("MUNIC"))
    return "Public";
  return null;
}

function normalizeHvacUnitCondition(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (val.includes("NEW")) return "New";
  if (val.includes("GOOD") || val.includes("WORKING")) return "Good";
  if (val.includes("RUST")) return "Rusty";
  if (val.includes("LEAK")) return "Leaking";
  if (val.includes("DAMAGE") || val.includes("BROKEN")) return "Damaged";
  return null;
}

function normalizePanelCapacity(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const amps = intFromText(cleaned);
  if (amps !== null) return `${amps} Amp`;
  return cleaned;
}

function interpretBooleanFromValue(value) {
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const val = cleaned.toUpperCase();
  if (/(YES|PRESENT|Y)/.test(val)) return true;
  if (/(NO|NONE|N)/.test(val)) return false;
  return null;
}

function interpretHvacPresenceValue(value) {
  const bool = interpretBooleanFromValue(value);
  if (bool === null) return null;
  return bool ? "Yes" : "No";
}

function interpretSolarPresence(value) {
  const bool = interpretBooleanFromValue(value);
  if (bool === null) return false;
  return bool;
}

function extractCoolingSystem(map) {
  const raw = findValueByLabel(map, [
    /Cooling System/i,
    /Cooling/i,
    /AC Type/i,
    /Air Conditioning/i,
  ]);
  return normalizeCoolingSystemType(raw);
}

function extractElectricalPanelCapacity(map) {
  const raw = findValueByLabel(map, [
    /Electrical Panel/i,
    /Panel Amp/i,
    /Service Amp/i,
    /Electrical Capacity/i,
  ]);
  return normalizePanelCapacity(raw);
}

function extractElectricalPanelInstallationDate(map) {
  const raw = findValueByLabel(map, [/Panel Install/i, /Electrical Install/i]);
  return normalizeDateText(raw);
}

function extractElectricalRewireDate(map) {
  const raw = findValueByLabel(map, [/Rewire/i, /Electrical Upgrade/i]);
  return normalizeDateText(raw);
}

function extractElectricalWiring(map) {
  const raw = findValueByLabel(map, [/Wiring/i, /Electrical Type/i]);
  const normalized = normalizeElectricalWiringType(raw);
  const other = normalized ? null : textClean(raw) || null;
  return { type: normalized, other };
}

function extractHeatingFuelType(map) {
  const raw = findValueByLabel(map, [/Heating Fuel/i, /Fuel Type/i]);
  return normalizeHeatingFuelType(raw);
}

function extractHeatingSystemType(map) {
  const raw = findValueByLabel(map, [
    /Heating System/i,
    /Heat Type/i,
    /Heat System/i,
  ]);
  return normalizeHeatingSystemType(raw);
}

function extractHvacCapacityKw(map) {
  const raw = findValueByLabel(map, [/HVAC Capacity.*kW/i, /Capacity \(kW\)/i]);
  return floatFromText(raw);
}

function extractHvacCapacityTons(map) {
  const raw = findValueByLabel(map, [/HVAC Capacity/i, /Tonnage/i]);
  return floatFromText(raw);
}

function extractHvacCondensingUnitPresent(map) {
  const raw = findValueByLabel(map, [/Condensing Unit/i, /HVAC Unit Present/i]);
  return interpretHvacPresenceValue(raw);
}

function extractHvacEquipmentComponent(map) {
  return findValueByLabel(map, [/HVAC Component/i, /Equipment Component/i]);
}

function extractHvacEquipmentManufacturer(map) {
  return findValueByLabel(map, [/HVAC Manufacturer/i, /Equipment Mfr/i]);
}

function extractHvacEquipmentModel(map) {
  return findValueByLabel(map, [/HVAC Model/i, /Equipment Model/i]);
}

function extractHvacInstallationDate(map) {
  const raw = findValueByLabel(map, [/HVAC Install/i, /Install Date/i]);
  return normalizeDateText(raw);
}

function extractHvacSeerRating(map) {
  const raw = findValueByLabel(map, [/SEER/i]);
  return floatFromText(raw);
}

function extractHvacSystemConfiguration(map) {
  return findValueByLabel(map, [/System Config/i, /HVAC Config/i]);
}

function extractHvacUnitCondition(map) {
  const raw = findValueByLabel(map, [/HVAC Condition/i, /Unit Condition/i]);
  return normalizeHvacUnitCondition(raw);
}

function extractHvacUnitIssues(map) {
  return findValueByLabel(map, [/HVAC Issues/i, /Unit Issues/i]);
}

function extractPlumbingFixtureCount(map) {
  const raw = findValueByLabel(map, [/Fixture Count/i, /Plumbing Fixtures/i]);
  return intFromText(raw);
}

function extractPlumbingFixtureQuality(map) {
  return findValueByLabel(map, [/Fixture Quality/i]);
}

function extractPlumbingFixtureTypePrimary(map) {
  return findValueByLabel(map, [/Primary Fixture/i]);
}

function extractPlumbingSystemInstallationDate(map) {
  const raw = findValueByLabel(map, [/Plumbing Install/i]);
  return normalizeDateText(raw);
}

function extractPlumbingSystemType(map) {
  const raw = findValueByLabel(map, [
    /Plumbing Type/i,
    /Plumbing System/i,
  ]);
  const normalized = normalizePlumbingSystemType(raw);
  const other = normalized ? null : textClean(raw) || null;
  return { type: normalized, other };
}

function extractPublicUtilityType(map) {
  const raw = findValueByLabel(map, [/Utility Type/i, /Utilities/i]);
  return normalizePublicUtilityType(raw);
}

function extractSewerConnectionDate(map) {
  const raw = findValueByLabel(map, [/Sewer Connection/i]);
  return normalizeDateText(raw);
}

function extractSewerType(map) {
  const raw = findValueByLabel(map, [/Sewer/i]);
  return normalizeSewerType(raw);
}

function extractSmartHomeFeatures(map) {
  const raw = findValueByLabel(map, [/Smart Home/i, /Automation/i]);
  const cleaned = textClean(raw);
  if (!cleaned) return { features: null, other: null };
  const parts = cleaned
    .split(/[;,\/]/)
    .map((item) => textClean(item))
    .filter(Boolean);
  if (parts.length === 0) return { features: null, other: null };
  return { features: parts, other: null };
}

function extractSolarInstallationDate(map) {
  const raw = findValueByLabel(map, [/Solar Install/i]);
  return normalizeDateText(raw);
}

function extractSolarInverterInstallationDate(map) {
  const raw = findValueByLabel(map, [/Inverter Install/i]);
  return normalizeDateText(raw);
}

function extractSolarInverterManufacturer(map) {
  return findValueByLabel(map, [/Inverter Manufacturer/i]);
}

function extractSolarInverterModel(map) {
  return findValueByLabel(map, [/Inverter Model/i]);
}

function extractSolarInverterVisible(map) {
  const raw = findValueByLabel(map, [/Inverter Visible/i]);
  const bool = interpretBooleanFromValue(raw);
  if (bool === null) return false;
  return bool;
}

function extractSolarPanelPresent(map) {
  const raw = findValueByLabel(map, [/Solar Panel/i, /Solar Present/i]);
  return interpretSolarPresence(raw);
}

function extractSolarPanelType(map) {
  const raw = findValueByLabel(map, [/Solar Type/i]);
  const normalized = normalizeSolarPanelType(raw);
  const other = normalized ? null : textClean(raw) || null;
  return { type: normalized, other };
}

function extractWaterConnectionDate(map) {
  const raw = findValueByLabel(map, [/Water Connection/i]);
  return normalizeDateText(raw);
}

function extractWaterHeaterInstallationDate(map) {
  const raw = findValueByLabel(map, [/Water Heater Install/i]);
  return normalizeDateText(raw);
}

function extractWaterHeaterManufacturer(map) {
  return findValueByLabel(map, [/Water Heater Manufacturer/i]);
}

function extractWaterHeaterModel(map) {
  return findValueByLabel(map, [/Water Heater Model/i]);
}

function extractWaterSourceType(map) {
  const raw = findValueByLabel(map, [/Water Source/i]);
  return normalizeWaterSourceType(raw);
}

function extractWellInstallationDate(map) {
  const raw = findValueByLabel(map, [/Well Install/i]);
  return normalizeDateText(raw);
}

function getBuildingPanels($) {
  return $("#divSearchDetails_Building .cssSearchDetails_Panels_Inner").filter(
    (_, el) => textClean($(el).text()).length > 0,
  );
}

function buildUtility($, panel) {
  const map = collectLabelValuePairs($, panel);

  const electricalWiring = extractElectricalWiring(map);
  const plumbingSystem = extractPlumbingSystemType(map);
  const smartHome = extractSmartHomeFeatures(map);
  const solarPanelType = extractSolarPanelType(map);

  return {
    cooling_system_type: extractCoolingSystem(map),
    electrical_panel_capacity: extractElectricalPanelCapacity(map),
    electrical_panel_installation_date: extractElectricalPanelInstallationDate(
      map,
    ),
    electrical_rewire_date: extractElectricalRewireDate(map),
    electrical_wiring_type: electricalWiring.type,
    electrical_wiring_type_other_description: electricalWiring.other,
    heating_fuel_type: extractHeatingFuelType(map),
    heating_system_type: extractHeatingSystemType(map),
    hvac_capacity_kw: extractHvacCapacityKw(map),
    hvac_capacity_tons: extractHvacCapacityTons(map),
    hvac_condensing_unit_present: extractHvacCondensingUnitPresent(map),
    hvac_equipment_component: extractHvacEquipmentComponent(map),
    hvac_equipment_manufacturer: extractHvacEquipmentManufacturer(map),
    hvac_equipment_model: extractHvacEquipmentModel(map),
    hvac_installation_date: extractHvacInstallationDate(map),
    hvac_seer_rating: extractHvacSeerRating(map),
    hvac_system_configuration: extractHvacSystemConfiguration(map),
    hvac_unit_condition: extractHvacUnitCondition(map),
    hvac_unit_issues: extractHvacUnitIssues(map),
    plumbing_fixture_count: extractPlumbingFixtureCount(map),
    plumbing_fixture_quality: extractPlumbingFixtureQuality(map),
    plumbing_fixture_type_primary: extractPlumbingFixtureTypePrimary(map),
    plumbing_system_installation_date: extractPlumbingSystemInstallationDate(
      map,
    ),
    plumbing_system_type: plumbingSystem.type,
    plumbing_system_type_other_description: plumbingSystem.other,
    public_utility_type: extractPublicUtilityType(map),
    request_identifier: null,
    sewer_connection_date: extractSewerConnectionDate(map),
    sewer_type: extractSewerType(map),
    smart_home_features: smartHome.features,
    smart_home_features_other_description: smartHome.other,
    solar_installation_date: extractSolarInstallationDate(map),
    solar_inverter_installation_date: extractSolarInverterInstallationDate(map),
    solar_inverter_manufacturer: extractSolarInverterManufacturer(map),
    solar_inverter_model: extractSolarInverterModel(map),
    solar_inverter_visible: extractSolarInverterVisible(map),
    solar_panel_present: extractSolarPanelPresent(map),
    solar_panel_type: solarPanelType.type,
    solar_panel_type_other_description: solarPanelType.other,
    water_connection_date: extractWaterConnectionDate(map),
    water_heater_installation_date: extractWaterHeaterInstallationDate(map),
    water_heater_manufacturer: extractWaterHeaterManufacturer(map),
    water_heater_model: extractWaterHeaterModel(map),
    water_source_type: extractWaterSourceType(map),
    well_installation_date: extractWellInstallationDate(map),
  };
}

function extract() {
  const $ = loadHtml("input.html");
  const account = textClean($("#hfAccount").attr("value")) || null;
  const propertyKey = account ? `property_${account}` : "property_unknown";

  const utilities = [];
  const panels = getBuildingPanels($);

  panels.each((index, panelElement) => {
    const panel = $(panelElement);
    const utility = buildUtility($, panel);
    utility.building_number = index + 1;
    utilities.push(utility);
  });

  // if (utilities.length === 0) {
  //   utilities.push({
  //     building_number: null,
  //     cooling_system_type: null,
  //     electrical_panel_capacity: null,
  //     electrical_panel_installation_date: null,
  //     electrical_rewire_date: null,
  //     electrical_wiring_type: null,
  //     electrical_wiring_type_other_description: null,
  //     heating_fuel_type: null,
  //     heating_system_type: null,
  //     hvac_capacity_kw: null,
  //     hvac_capacity_tons: null,
  //     hvac_condensing_unit_present: null,
  //     hvac_equipment_component: null,
  //     hvac_equipment_manufacturer: null,
  //     hvac_equipment_model: null,
  //     hvac_installation_date: null,
  //     hvac_seer_rating: null,
  //     hvac_system_configuration: null,
  //     hvac_unit_condition: null,
  //     hvac_unit_issues: null,
  //     plumbing_fixture_count: null,
  //     plumbing_fixture_quality: null,
  //     plumbing_fixture_type_primary: null,
  //     plumbing_system_installation_date: null,
  //     plumbing_system_type: null,
  //     plumbing_system_type_other_description: null,
  //     public_utility_type: null,
  //     request_identifier: null,
  //     sewer_connection_date: null,
  //     sewer_type: null,
  //     smart_home_features: null,
  //     smart_home_features_other_description: null,
  //     solar_installation_date: null,
  //     solar_inverter_installation_date: null,
  //     solar_inverter_manufacturer: null,
  //     solar_inverter_model: null,
  //     solar_inverter_visible: false,
  //     solar_panel_present: false,
  //     solar_panel_type: null,
  //     solar_panel_type_other_description: null,
  //     water_connection_date: null,
  //     water_heater_installation_date: null,
  //     water_heater_manufacturer: null,
  //     water_heater_model: null,
  //     water_source_type: null,
  //     well_installation_date: null,
  //   });
  // }

  const payload = {};
  payload[propertyKey] = { utilities };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "utilities_data.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

extract();
