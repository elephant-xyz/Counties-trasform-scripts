// Utility extractor: reads input.html and writes owners/utilities_data.json per schema
// Uses cheerio for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function text($el) {
  if (!$el || $el.length === 0) return "";
  return $el.text().trim();
}

function loadHtml() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getPropId($) {
  const propId = text(
    $(
      "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue span",
    ),
  );
  return propId || "unknown";
}

function extractHVAC($) {
  const facts = {};
  const section = $("#ctlBodyPane_ctl10_mSection");
  section.find(".tabular-data-two-column tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const key = text($(tds[0])).replace(/\s+/g, " ").trim();
      const val = text($(tds[1]));
      if (key) facts[key] = val;
    }
  });
  return facts;
}

function mapUtilities($) {
  const propId = getPropId($);
  const hvacFacts = extractHVAC($);

  const heatRaw = (hvacFacts["Heat"] || "").toUpperCase();
  const acRaw = (hvacFacts["Air Conditioning"] || "").toUpperCase();

  let heating_system_type = null;
  if (heatRaw) heating_system_type = "Central";

  let cooling_system_type = null;
  if (acRaw.includes("CENTRAL")) cooling_system_type = "CentralAir";

  const utilities = {
    cooling_system_type,
    heating_system_type,

    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,

    plumbing_system_type: null,
    plumbing_system_type_other_description: null,

    electrical_panel_capacity: "Unknown",
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,

    hvac_condensing_unit_present: "Unknown",
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,

    hvac_capacity_kw: null,
    hvac_capacity_tons: null,

    plumbing_system_installation_date: null,

    public_utility_type_other_description: undefined, // not in schema, avoid

    sewer_connection_date: null,

    smart_home_features: null,
    smart_home_features_other_description: null,

    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    solar_installation_date: null,

    solar_inverter_visible: false,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,

    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    well_installation_date: null,
  };

  // Ensure required keys exist per schema
  const required = [
    "cooling_system_type",
    "heating_system_type",
    "public_utility_type",
    "sewer_type",
    "water_source_type",
    "plumbing_system_type",
    "plumbing_system_type_other_description",
    "electrical_panel_capacity",
    "electrical_wiring_type",
    "hvac_condensing_unit_present",
    "electrical_wiring_type_other_description",
    "solar_panel_present",
    "solar_panel_type",
    "solar_panel_type_other_description",
    "smart_home_features",
    "smart_home_features_other_description",
    "hvac_unit_condition",
    "solar_inverter_visible",
    "hvac_unit_issues",
  ];
  required.forEach((k) => {
    if (!(k in utilities)) utilities[k] = null;
  });

  return { propId, utilities };
}

function writeOutput(propId, utilities) {
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[`property_${propId}`] = utilities;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return outPath;
}

(function main() {
  const $ = loadHtml();
  const { propId, utilities } = mapUtilities($);
  const outPath = writeOutput(propId, utilities);
  console.log(`Utilities data written to: ${outPath}`);
})();
