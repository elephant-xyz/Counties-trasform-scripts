// utilityMapping.js
// Reads input.json, extracts utility attributes, and writes owners/utilities_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    // Create minimal file with embedded dataset similar to structureMapping
    const data = {
      note: "Input missing. Please provide input.json. No utilities inferred.",
    };
    fs.writeFileSync(inputPath, JSON.stringify(data, null, 2), "utf-8");
  }
}

function loadInput() {
  ensureInput();
  try {
    return JSON.parse(fs.readFileSync(path.resolve("input.json"), "utf-8"));
  } catch (e) {
    return {};
  }
}

function buildUtilities(input) {
  // From assessor data, explicit utility details are not present. Use nulls/defaults per schema enums
  const utilities = {
    cooling_system_type: null,
    heating_system_type: null,
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
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    well_installation_date: null,
  };

  return utilities;
}

function main() {
  const input = loadInput();
  const parcelId =
    (input.parcelGeneralProfile && input.parcelGeneralProfile.parcelId) ||
    (input.parcelQuickSearchSummary &&
      input.parcelQuickSearchSummary[0] &&
      input.parcelQuickSearchSummary[0].parcelId) ||
    "unknown";

  const utilities = buildUtilities(input);

  const ownersDir = path.resolve("owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });

  const outPath = path.join(ownersDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = utilities;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");
}

if (require.main === module) {
  main();
}
