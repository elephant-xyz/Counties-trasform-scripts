// Utility mapping script
// Reads input.html, parses with cheerio, extracts utility info, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
}

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

function extractUtilities($) {
  // Limited explicit utility info is present in the HTML. We'll set nulls per schema when unknown.
  // Pool presence can imply some utilities but does not map to the utility schema directly.

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

  return utilities;
}

function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) throw new Error("ParcelId not found");

  const utilities = extractUtilities($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: utilities };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
