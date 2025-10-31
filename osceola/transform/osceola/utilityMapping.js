// Utility mapping script
// Reads input.html, extracts utility details using cheerio, outputs owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($el) {
  if (!$el || $el.length === 0) return "";
  return $el.first().text().trim();
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Parcel ID
  let parcelId = ($("#stu").attr("value") || $("#stu").val() || "").trim();
  // if (!parcelId) {
  //   const parcelText =
  //     safeText($(".parcelResultFistParcel")) || safeText($(".rParcel"));
  //   parcelId = (parcelText.match(/\d{17,}/) || [null])[0] || "unknown";
  // }

  // This dataset has no explicit utilities info. We'll set conservative nulls and booleans where possible.

  const utility = {
    cooling_system_type: null,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: null,
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

  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);
  const outPath = path.join(ownersDir, "utilities_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = utility;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

main();
