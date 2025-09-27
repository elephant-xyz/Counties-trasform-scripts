// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractText($, selector) {
  const el = $(selector);
  if (!el || el.length === 0) return null;
  const t = el.text().trim();
  return t || null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Identify property id
  const parcelId =
    extractText($, "#ctlBodyPane_ctl02_ctl01_lblParcelID") ||
    extractText($, 'th:contains("Parcel ID") + td span');
  const propKey = parcelId ? `property_${parcelId}` : "property_unknown";

  // From Building Information section
  let heatingRaw = null;
  let coolingRaw = null;
  $(
    "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
  ).each((i, el) => {
    const header = $(el).find("th").text().trim().toLowerCase();
    const val = $(el).find("td").text().trim();
    if (header.includes("heating type")) heatingRaw = val;
    if (header.includes("air conditioning")) coolingRaw = val;
  });

  function mapHeating(str) {
    if (!str) return null;
    const s = str.toLowerCase();
    if (s.includes("heat pump")) return "HeatPump";
    if (s.includes("forced air")) return "Central";
    if (s.includes("central")) return "Central";
    if (s.includes("radiant")) return "Radiant";
    if (s.includes("gas")) return "GasFurnace";
    if (s.includes("electric")) return "Electric";
    return null;
  }

  function mapCooling(str) {
    if (!str) return null;
    const s = str.toLowerCase();
    if (s.includes("central")) return "CentralAir";
    if (s.includes("ductless") || s.includes("mini split")) return "Ductless";
    if (s.includes("window")) return "WindowAirConditioner";
    if (s.includes("fan")) return "CeilingFans";
    return null;
  }

  const utility = {
    cooling_system_type: mapCooling(coolingRaw),
    heating_system_type: mapHeating(heatingRaw),
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
    plumbing_system_type_other_description: null,
    public_utility_type_other_description: undefined,
    sewer_connection_date: null,
    smart_home_features_notes: undefined,
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

  // Clean unsupported fields (ensure additionalProperties false)
  // Remove any undefined keys
  Object.keys(utility).forEach((k) => {
    if (utility[k] === undefined) delete utility[k];
  });

  const output = {};
  output[propKey] = utility;

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log("Utility mapping complete");
}

try {
  main();
} catch (e) {
  console.error("Utility mapping failed:", e.message);
  process.exit(1);
}
