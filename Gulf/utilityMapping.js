// Utility extractor script
// Reads input.html, parses building/HVAC hints with cheerio, and writes owners/utilities_data.json following the utility schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function textNorm(s) {
  if (!s) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function getParcelId($) {
  const section = $("#ctlBodyPane_ctl01_mSection");
  let parcelId = null;
  section.find("table.tabular-data-two-column tbody tr").each((i, el) => {
    const label = textNorm($(el).find("th strong").text());
    const value = textNorm($(el).find("td span").text());
    if (label.toLowerCase() === "parcel id") parcelId = value;
  });
  return parcelId || "UNKNOWN_ID";
}

function collectUtilityHints($) {
  const hints = {};
  const section = $("#ctlBodyPane_ctl04_mSection");
  section.find("table.tabular-data-two-column tbody tr").each((i, el) => {
    const label = textNorm($(el).find("th strong").text());
    const value = textNorm($(el).find("td").text());
    if (label && value && !(label in hints)) hints[label] = value;
  });
  return hints;
}

function buildUtilityObject(hints) {
  // From Building Information: Heat: AIR DUCTED; Air Conditioning: CENTRAL
  let heating_system_type = null;
  let cooling_system_type = null;
  const heatRaw = hints["Heat"] || "";
  const acRaw = hints["Air Conditioning"] || "";
  if (/AIR DUCTED/i.test(heatRaw)) heating_system_type = "Central";
  if (/CENTRAL/i.test(acRaw)) cooling_system_type = "CentralAir";

  const obj = {
    cooling_system_type: cooling_system_type,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: heating_system_type,
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
  return obj;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  const hints = collectUtilityHints($);
  const utilities = buildUtilityObject(hints);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = utilities;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote utilities data for ${parcelId} -> ${outPath}`);
}

if (require.main === module) {
  main();
}
