// Utility mapping script
// Reads input.json, extracts utility-related fields, and writes owners/utilities_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    const fallback = {
      PropertyInfo: {
      },
    };
    fs.writeFileSync(inputPath, JSON.stringify(fallback, null, 2), "utf8");
  }
  return inputPath;
}

function loadInput() {
  const inputPath = ensureInput();
  const raw = fs.readFileSync(inputPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const $ = cheerio.load(raw);
    const text = $("body").text().trim();
    data = JSON.parse(text);
  }
  return data;
}

function mapUtility(data) {
  // No explicit utility info provided; populate required keys with null or sensible defaults where boolean is required.
  const utility = {
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

    // Optional fields per schema
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

  return utility;
}

function run() {
  const data = loadInput();
  const utility = mapUtility(data);
  const id =
    (data && data.PropertyInfo && data.PropertyInfo.FolioNumber) || "unknown";
  const output = {};
  output[`property_${id}`] = utility;

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

run();
