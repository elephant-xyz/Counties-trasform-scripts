// Utility mapping script
// Reads input.html, extracts utility-related hints if available, writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractPropertyId($) {
  const id = $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text().trim();
  if (id) return id;
  const resultsId = $(
    "#MainContent_gvParcelResults tr:nth-child(2) td:first-child",
  )
    .text()
    .trim();
  return resultsId || "unknown";
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);

  // The input HTML does not explicitly provide utility system details; set required fields with nulls or defaults where schema allows
  const utility = {
    cooling_system_type: null,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: null,
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
  };

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = utility;
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

if (require.main === module) {
  main();
}
