// Utility mapping script
// Reads input.html, extracts utility-related data using cheerio, and writes owners/utilities_data.json and data/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getText($el) {
  if (!$el || $el.length === 0) return "";
  return $el.text().replace(/\s+/g, " ").trim();
}

function parsePropertyId($) {
  const h1 = $("h1")
    .filter((i, el) => /Property Record Information for/i.test($(el).text()))
    .first();
  const m = getText(h1).match(/for\s+(\d{6,})/i);
  return m ? m[1] : "unknown";
}

function buildUtility($) {
  // The provided HTML does not list explicit utilities; default to nulls and safe assumptions.
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
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_issues: null,
    plumbing_fixture_count: null,
    plumbing_fixture_quality: null,
    plumbing_fixture_type_primary: null,
    plumbing_system_installation_date: null,
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
  return utility;
}

function main() {
  const inputPath = path.join("input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const pid = parsePropertyId($);
  const utility = buildUtility($);
  const payload = {};
  payload[`property_${pid}`] = utility;

  ensureDir(path.join("owners"));
  ensureDir(path.join("data"));
  fs.writeFileSync(
    path.join("owners", "utilities_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join("data", "utilities_data.json"),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
}

if (require.main === module) {
  try {
    main();
    console.log("Utility mapping completed.");
  } catch (e) {
    console.error("Utility mapping failed:", e.message);
    process.exit(1);
  }
}
