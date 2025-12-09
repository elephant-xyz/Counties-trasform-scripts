// Utility mapping script: reads input.html and outputs owners/utilities_data.json per schema
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml(filename) {
  const html = fs.readFileSync(filename, "utf8");
  return cheerio.load(html);
}

function cleanText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(label) {
  return cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function normalizeValue(value) {
  return cleanText(value).toLowerCase();
}

function combinedLowerText(raw, ...parts) {
  const values = [];
  if (raw.sectionText) values.push(raw.sectionText);
  if (raw.buildingText) values.push(raw.buildingText);
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      for (const p of part) if (p) values.push(p);
    } else {
      values.push(part);
    }
  }
  return values.join(" ").toLowerCase();
}

function parseBuildingNumber(headerText, index) {
  const match = (headerText || "").match(/building\s+(\d+)/i);
  if (match) return Number(match[1]);
  return index + 1;
}

function extractCharacteristics($, section) {
  const characteristics = {};
  $(section)
    .find("table.report-table tbody > tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 2) return;
      const label = cleanText($(cells[0]).text());
      if (!label) return;
      const code = cleanText($(cells[1]).text());
      const description =
        cells[2] !== undefined ? cleanText($(cells[2]).text()) : "";
      characteristics[normalizeKey(label)] = {
        label,
        code,
        description,
      };
    });
  return characteristics;
}

function getCharacteristic(raw, label) {
  if (!raw || !raw.characteristics) return null;
  return raw.characteristics[normalizeKey(label)] || null;
}

function getCharacteristicValue(raw, label) {
  const entry = getCharacteristic(raw, label);
  if (!entry) return null;
  return entry.description || entry.code || null;
}

function mapBuildingNumber(raw) {
  return raw.buildingNumber ?? null;
}

function mapCoolingSystemType(raw) {
  const entry = getCharacteristic(raw, "Heat/Ac");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;

  const code = entry && entry.code ? entry.code.trim() : "";
  if (code === "2") return "CentralAir";
  if (code === "3") return "WindowAirConditioner";

  if (/\bmini\s*split\b/.test(text) || /\bductless\b/.test(text)) {
    return "Ductless";
  }
  if (/\bzoned\b/.test(text)) return "Zoned";
  if (/\bgeothermal\b/.test(text)) return "GeothermalCooling";
  if (/\bhybrid\b/.test(text)) return "Hybrid";
  if (/\bwhole\s*house\s*fan\b/.test(text)) return "WholeHouseFan";
  if (/\bceiling fans?\b/.test(text)) {
    return /\bceiling fans\b/.test(text) ? "CeilingFans" : "CeilingFan";
  }
  if (/\bwindow\b/.test(text) || /\bwall unit\b/.test(text)) {
    return "WindowAirConditioner";
  }
  if (/\bcentral\b/.test(text)) return "CentralAir";
  if (/\belectric\b/.test(text)) return "Electric";
  return null;
}

function mapElectricalPanelCapacity(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(\d{2,3})\s*amp/);
  if (match) return `${match[1]} Amp`;
  return null;
}

function mapElectricalPanelInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/panel installed(?: on)? (\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (match) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

function mapElectricalRewireDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/rewire[ds]? (?:in )?(\d{4})/i);
  if (match) return `${match[1]}-01-01`;
  return null;
}

function mapElectricalWiringType(raw) {
  const text = combinedLowerText(raw);
  if (/\bknob and tube\b/.test(text)) return "KnobAndTube";
  if (/\baluminum\b/.test(text)) return "Aluminum";
  if (/\bcopper\b/.test(text) || /\bromex\b/.test(text)) return "Copper";
  return null;
}

function mapElectricalWiringTypeOtherDescription() {
  return null;
}

function mapHeatingFuelType(raw) {
  const entry = getCharacteristic(raw, "Heat/Ac");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;

  if (/\bpropane\b/.test(text)) return "Propane";
  if (/\bnatural\s*gas\b/.test(text) || /\bcity gas\b/.test(text)) {
    return "NaturalGas";
  }
  if (/\bgas\b/.test(text)) return "NaturalGas";
  if (/\boil\b/.test(text)) return "Oil";
  if (/\bkerosene\b/.test(text)) return "Kerosene";
  if (/\bwood pellet\b/.test(text)) return "WoodPellet";
  if (/\bwood\b/.test(text)) return "Wood";
  if (/\bgeothermal\b/.test(text)) return "Geothermal";
  if (/\bsolar\b/.test(text)) return "Solar";
  if (/\bdistrict\s*steam\b/.test(text) || /\bsteam heat\b/.test(text)) {
    return "DistrictSteam";
  }
  if (/\bother fuel\b/.test(text) || /\bfuel: other\b/.test(text)) {
    return "Other";
  }
  if (/\belectric\b/.test(text)) return "Electric";
  return null;
}

function mapHeatingSystemType(raw) {
  const entry = getCharacteristic(raw, "Heat/Ac");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;

  const code = entry && entry.code ? entry.code.trim() : "";
  if (code === "2") return "Central";

  if (/\bheat pump\b/.test(text)) return "HeatPump";
  if (/\bductless\b/.test(text) || /\bmini\s*split\b/.test(text)) {
    return "Ductless";
  }
  if (/\bradiant\b/.test(text) || /\bradiator\b/.test(text)) return "Radiant";
  if (/\bbaseboard\b/.test(text)) return "Baseboard";
  if (/\bgas furnace\b/.test(text)) return "GasFurnace";
  if (/\belectric furnace\b/.test(text)) return "ElectricFurnace";
  if (/\bfurnace\b/.test(text) && /\bgas\b/.test(text)) return "GasFurnace";
  if (/\bfurnace\b/.test(text) && /\belectric\b/.test(text)) {
    return "ElectricFurnace";
  }
  if (/\bgas\b/.test(text)) return "Gas";
  if (/\belectric\b/.test(text)) return "Electric";
  if (/\bsolar\b/.test(text)) return "Solar";
  if (/\bcentral\b/.test(text)) return "Central";
  return null;
}

function mapHvacCapacityKw(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(\d+(?:\.\d+)?)\s*kw\b/i);
  if (match) return Number(match[1]);
  return null;
}

function mapHvacCapacityTons(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(\d+(?:\.\d+)?)\s*tons?\b/i);
  if (match) return Number(match[1]);
  return null;
}

function mapHvacCondensingUnitPresent(raw, coolingType) {
  const type = coolingType ?? mapCoolingSystemType(raw);
  if (!type) return null;
  if (
    ["CentralAir", "Ductless", "Hybrid", "GeothermalCooling", "Zoned"].includes(type)
  ) {
    return "Yes";
  }
  if (
    ["WindowAirConditioner", "CeilingFans", "CeilingFan", "WholeHouseFan"].includes(
      type,
    )
  ) {
    return "No";
  }
  return null;
}

function mapHvacEquipmentComponent(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/hvac component:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapHvacEquipmentManufacturer(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(?:hvac|system) manufacturer:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapHvacEquipmentModel(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(?:hvac|system) model:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapHvacInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match =
    text.match(/hvac installed(?: on)? (\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
    text.match(/hvac installed(?: in)? (\d{4})/i);
  if (!match) return null;
  if (match[1].includes("/")) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return null;
  }
  return `${match[1]}-01-01`;
}

function mapHvacSeerRating(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(\d+(?:\.\d+)?)\s*seer\b/i);
  if (match) return Number(match[1]);
  return null;
}

function mapHvacSystemConfiguration(raw) {
  const entry = getCharacteristic(raw, "Heat/Ac");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;

  if (/\bvrf\b/.test(text) || /\bvariable refrigerant\b/.test(text)) {
    return "VRF";
  }
  if (/\bheat pump\b/.test(text) && /\bsplit\b/.test(text)) {
    return "HeatPumpSplit";
  }
  if (/\bmini\s*split\b/.test(text) || /\bductless\b/.test(text)) {
    return "MiniSplit";
  }
  if (/\bpackaged\b/.test(text) || /\bpackage unit\b/.test(text)) {
    return "PackagedUnit";
  }
  if (/\bsplit\b/.test(text)) return "SplitSystem";
  if (entry && (entry.description || entry.code)) return "Other";
  return null;
}

function mapHvacUnitCondition(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bbrand new\b/.test(text) || /\bunit is new\b/.test(text)) return "New";
  if (/\bgood\b/.test(text)) return "Good";
  if (/\brust/.test(text)) return "Rusty";
  if (/\bleak/.test(text)) return "Leaking";
  if (/\bdamage|broken|needs repair\b/.test(text)) return "Damaged";
  return null;
}

function mapHvacUnitIssues(raw) {
  const text = combinedLowerText(raw);
  const issues = [];
  if (/\bleak/.test(text)) issues.push("Leak");
  if (/\brust/.test(text)) issues.push("Rust");
  if (/\bnoise\b/.test(text)) issues.push("Noise");
  if (/\bdamage|broken/.test(text)) issues.push("Damage");
  return issues.length ? issues.join(", ") : null;
}

function mapPlumbingFixtureCount(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/(\d+)\s+plumbing fixtures?/i);
  if (match) return Number(match[1]);
  return null;
}

function mapPlumbingFixtureQuality(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/plumbing quality:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapPlumbingFixtureTypePrimary(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/primary plumbing fixture:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapPlumbingSystemInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/plumbing installed(?: in)? (\d{4})/i);
  return match ? `${match[1]}-01-01` : null;
}

function mapPlumbingSystemType(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bpex\b/.test(text)) return "PEX";
  if (/\bpvc\b/.test(text)) return "PVC";
  if (/\bcopper\b/.test(text)) return "Copper";
  if (/\bgalvanized\b/.test(text)) return "GalvanizedSteel";
  if (/\bcast\s*iron\b/.test(text)) return "CastIron";
  return null;
}

function mapPlumbingSystemTypeOtherDescription(raw) {
  const type = mapPlumbingSystemType(raw);
  if (type) return null;
  const text = combinedLowerText(raw);
  const match = text.match(/plumbing type:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapPublicUtilityType(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bunderground util/i.test(text)) return "UndergroundUtilities";
  if (/\bcable\b/.test(text)) return "CableAvailable";
  if (/\bnatural\s*gas\b/.test(text) || /\bgas service\b/.test(text)) {
    return "NaturalGasAvailable";
  }
  if (/\bsewer\b/.test(text)) return "SewerAvailable";
  if (/\bwater\b/.test(text)) return "WaterAvailable";
  if (/\belectric\b/.test(text)) return "ElectricityAvailable";
  return null;
}

function mapSewerConnectionDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/sewer connected(?: in)? (\d{4})/i);
  return match ? `${match[1]}-01-01` : null;
}

function mapSewerType(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bseptic\b/.test(text)) return "Septic";
  if (/\bcombined sewer\b/.test(text)) return "Combined";
  if (/\bsanitary sewer\b/.test(text)) return "Sanitary";
  if (/\bpublic sewer\b/.test(text) || /\bcity sewer\b/.test(text)) {
    return "Public";
  }
  return null;
}

function mapSmartHomeFeatures(raw) {
  const text = combinedLowerText(raw);
  const features = [];
  if (/\bsmart thermostat\b/.test(text)) features.push("SmartThermostat");
  if (/\bsmart lighting\b/.test(text)) features.push("SmartLighting");
  if (/\bsmart security\b/.test(text) || /\bsmart alarm\b/.test(text)) {
    features.push("SmartSecurity");
  }
  if (/\bsmart lock\b/.test(text)) features.push("SmartLock");
  if (/\bsmart irrigation\b/.test(text)) features.push("SmartIrrigation");
  return features.length ? features : null;
}

function mapSmartHomeFeaturesOtherDescription(raw) {
  const features = mapSmartHomeFeatures(raw);
  if (!features) return null;
  const recognized = new Set([
    "SmartThermostat",
    "SmartLighting",
    "SmartSecurity",
    "SmartLock",
    "SmartIrrigation",
  ]);
  const unknown = features.filter((f) => !recognized.has(f));
  return unknown.length ? unknown.join(", ") : null;
}

function mapSolarInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/solar (?:system )?installed(?: in)? (\d{4})/i);
  return match ? `${match[1]}-01-01` : null;
}

function mapSolarInverterInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/inverter installed(?: on)? (\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (match) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function mapSolarInverterManufacturer(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/inverter manufacturer:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapSolarInverterModel(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/inverter model:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapSolarInverterVisible(raw) {
  const text = combinedLowerText(raw);
  if (!text || !/\binverter\b/.test(text)) return null;
  if (/\bnot visible\b/.test(text) || /\bhidden\b/.test(text)) return false;
  if (/\bvisible\b/.test(text)) return true;
  return true;
}

function mapSolarPanelPresent(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bno solar\b/.test(text) || /\bwithout solar\b/.test(text)) return false;
  if (/\bsolar panel\b/.test(text) || /\bphotovoltaic\b/.test(text)) return true;
  return null;
}

function mapSolarPanelType(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\bphotovoltaic\b/.test(text) || /\bpv\b/.test(text)) return "Photovoltaic";
  if (/\bsolar thermal\b/.test(text) || /\bthermal panel\b/.test(text)) {
    return "SolarThermal";
  }
  if (/\bhybrid\b/.test(text)) return "Hybrid";
  return null;
}

function mapSolarPanelTypeOtherDescription(raw) {
  const type = mapSolarPanelType(raw);
  if (type) return null;
  const text = combinedLowerText(raw);
  const match = text.match(/solar panel type:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapWaterConnectionDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/water connected(?: in)? (\d{4})/i);
  return match ? `${match[1]}-01-01` : null;
}

function mapWaterHeaterInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match =
    text.match(/water heater installed(?: on)? (\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
    text.match(/water heater installed(?: in)? (\d{4})/i);
  if (!match) return null;
  if (match[1].includes("/")) {
    const date = new Date(match[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return null;
  }
  return `${match[1]}-01-01`;
}

function mapWaterHeaterManufacturer(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/water heater manufacturer:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapWaterHeaterModel(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/water heater model:? ([^.;]+)/i);
  return match ? cleanText(match[1]) : null;
}

function mapWaterSourceType(raw) {
  const text = combinedLowerText(raw);
  if (!text) return null;
  if (/\baquifer\b/.test(text)) return "Aquifer";
  if (/\bwell\b/.test(text)) return "Well";
  if (/\bpublic water\b/.test(text) || /\bcity water\b/.test(text)) {
    return "Public";
  }
  return null;
}

function mapWellInstallationDate(raw) {
  const text = combinedLowerText(raw);
  const match = text.match(/well installed(?: in)? (\d{4})/i);
  return match ? `${match[1]}-01-01` : null;
}

function buildUtility(raw) {
  const coolingSystemType = mapCoolingSystemType(raw);
  const heatingFuelType = mapHeatingFuelType(raw);
  const heatingSystemType = mapHeatingSystemType(raw);
  const hvacSystemConfiguration = mapHvacSystemConfiguration(raw);
  const hvacCondensingUnitPresent = mapHvacCondensingUnitPresent(
    raw,
    coolingSystemType,
  );

  return {
    building_number: mapBuildingNumber(raw),
    cooling_system_type: coolingSystemType,
    electrical_panel_capacity: mapElectricalPanelCapacity(raw),
    electrical_panel_installation_date: mapElectricalPanelInstallationDate(raw),
    electrical_rewire_date: mapElectricalRewireDate(raw),
    electrical_wiring_type: mapElectricalWiringType(raw),
    electrical_wiring_type_other_description:
      mapElectricalWiringTypeOtherDescription(raw),
    heating_fuel_type: heatingFuelType,
    heating_system_type: heatingSystemType,
    hvac_capacity_kw: mapHvacCapacityKw(raw),
    hvac_capacity_tons: mapHvacCapacityTons(raw),
    hvac_condensing_unit_present: hvacCondensingUnitPresent,
    hvac_equipment_component: mapHvacEquipmentComponent(raw),
    hvac_equipment_manufacturer: mapHvacEquipmentManufacturer(raw),
    hvac_equipment_model: mapHvacEquipmentModel(raw),
    hvac_installation_date: mapHvacInstallationDate(raw),
    hvac_seer_rating: mapHvacSeerRating(raw),
    hvac_system_configuration: hvacSystemConfiguration,
    hvac_unit_condition: mapHvacUnitCondition(raw),
    hvac_unit_issues: mapHvacUnitIssues(raw),
    plumbing_fixture_count: mapPlumbingFixtureCount(raw),
    plumbing_fixture_quality: mapPlumbingFixtureQuality(raw),
    plumbing_fixture_type_primary: mapPlumbingFixtureTypePrimary(raw),
    plumbing_system_installation_date: mapPlumbingSystemInstallationDate(raw),
    plumbing_system_type: mapPlumbingSystemType(raw),
    plumbing_system_type_other_description:
      mapPlumbingSystemTypeOtherDescription(raw),
    public_utility_type: mapPublicUtilityType(raw),
    sewer_connection_date: mapSewerConnectionDate(raw),
    sewer_type: mapSewerType(raw),
    smart_home_features: mapSmartHomeFeatures(raw),
    smart_home_features_other_description:
      mapSmartHomeFeaturesOtherDescription(raw),
    solar_installation_date: mapSolarInstallationDate(raw),
    solar_inverter_installation_date: mapSolarInverterInstallationDate(raw),
    solar_inverter_manufacturer: mapSolarInverterManufacturer(raw),
    solar_inverter_model: mapSolarInverterModel(raw),
    solar_inverter_visible: mapSolarInverterVisible(raw),
    solar_panel_present: mapSolarPanelPresent(raw),
    solar_panel_type: mapSolarPanelType(raw),
    solar_panel_type_other_description:
      mapSolarPanelTypeOtherDescription(raw),
    water_connection_date: mapWaterConnectionDate(raw),
    water_heater_installation_date: mapWaterHeaterInstallationDate(raw),
    water_heater_manufacturer: mapWaterHeaterManufacturer(raw),
    water_heater_model: mapWaterHeaterModel(raw),
    water_source_type: mapWaterSourceType(raw),
    well_installation_date: mapWellInstallationDate(raw),
  };
}

function extractUtilitiesData($) {
  const propertyIdentifier =
    cleanText($("td[data-bind*='displayStrap']").text()) ||
    "17270100100000000002BU";
  const propertyKey = propertyIdentifier
    ? `property_${propertyIdentifier}`
    : "property_unknown";

  const container = $("div[data-bind='foreach: buildings()']");
  const utilities = [];

  container.find("h4.section-header").each((index, header) => {
    const buildingHeader = cleanText($(header).text());
    const buildingNumber = parseBuildingNumber(buildingHeader, index);
    const buildingContent = $(header).nextUntil("h4.section-header");
    const sectionWrap = buildingContent.filter("div.section-wrap").first();
    if (!sectionWrap.length) return;

    const sectionText = cleanText(sectionWrap.text());
    const buildingText = cleanText(buildingContent.text());
    const characteristics = extractCharacteristics($, sectionWrap);
    const raw = {
      buildingNumber,
      buildingName: buildingHeader,
      characteristics,
      sectionText,
      buildingText,
    };
    utilities.push(buildUtility(raw));
  });

  return { propertyKey, utilities };
}

(function main() {
  const $ = loadHtml("input.html");
  const { propertyKey, utilities } = extractUtilitiesData($);
  const payload = { [propertyKey]: { utilities } };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "utilities_data.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  console.log("owners/utilities_data.json written");
})();
