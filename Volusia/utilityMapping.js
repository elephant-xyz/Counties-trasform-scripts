// Utility mapping script
// Reads input.html, extracts utility attributes using cheerio, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function getTextAfterStrong($, label) {
  const el = $("strong").filter((i, e) => $(e).text().trim() === label);
  if (el.length) {
    const val = el.first().parent().next().text().trim();
    return val.replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

function main() {
  const inputPath = "input.html";
  const html = readHtml(inputPath);
  const $ = cheerio.load(html);

  const altkey = ($("#altkey").attr("value") || "").trim();
  const propertyId = `property_${altkey || "unknown"}`;

  const data = {
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

  // HVAC present and types
  const hvac = getTextAfterStrong($, "HVAC:");
  if (hvac && /AIR CONDITIONING/i.test(hvac)) {
    data.cooling_system_type = "CentralAir";
    data.hvac_condensing_unit_present = "Yes";
  } else {
    data.hvac_condensing_unit_present = "No";
  }

  const heatMethod = getTextAfterStrong($, "Heat Method:");
  const heatSource = getTextAfterStrong($, "Heat Source:");
  if (heatSource && /ELECTRIC/i.test(heatSource)) {
    data.heating_system_type = "Electric";
  }

  // Utilities: not explicitly specified; infer public services available in urban area -> set enums minimally
  // Sewer and water unknown in page; set nulls to satisfy schema with null allowed; but required fields must exist (can be null per schema)

  // Plumbing type not given
  data.plumbing_system_type = null;

  // Electrical wiring type not given
  data.electrical_wiring_type = null;

  // Public utility type not given
  data.public_utility_type = null;

  // Sewer and water unknown
  data.sewer_type = null;
  data.water_source_type = null;

  // smart_home_features array per schema; set null as allowed
  data.smart_home_features = null;

  const output = {};
  output[propertyId] = data;

  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Utilities data written to ${outPath} for ${propertyId}`);
}

main();
