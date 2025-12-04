// utilityMapping.js
// Reads input.json, extracts utility data, and writes to data/utilities_data.json and owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(fp) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function cleanText(str) {
  if (str == null) return null;
  try {
    const $ = cheerio.load(String(str));
    return $.text().trim() || null;
  } catch (e) {
    return String(str);
  }
}

function buildUtility(data) {
  const buildings = data?.Building?.response?.value || [];
  let utilities = {};
  if (buildings && buildings.length > 0) {
    buildings.forEach((building, bidx) => {
      // Defaults
      const util = {
        cooling_system_type: null,
        heating_system_type: null,
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
      utilities[(bidx + 1).toString()] = util;
    });
  }
  return utilities;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const data = readJSON(inputPath);

  const parcel = data?.ParcelInformation?.response?.value?.[0] || {};
  const strap =
    cleanText(parcel.dsp_strap) || cleanText(parcel.strap) || "unknown";
  const propertyKey = `property_${strap.trim()}`;
  
  const util = buildUtility(data);
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[propertyKey] = util;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("Utility mapping complete:", propertyKey);
})();
