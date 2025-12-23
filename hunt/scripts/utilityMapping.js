// Utility data extractor using Cheerio
// Reads input.html, maps to utility schema with conservative nulls where not derivable

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getText($, el) {
  if (!el || el.length === 0) return "";
  return $(el).text().replace(/\s+/g, " ").trim();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractPropertyId($) {
  let pid = getText($, $('th:contains("Property ID:")').first().next("td"));
  if (!pid) {
    const title = getText($, $(".page-title h3").first());
    const m = title.match(/Property ID:\s*(\d+)/i);
    if (m) pid = m[1];
  }
  return pid || "unknown";
}

function mapUtilities($) {
  const propertyId = extractPropertyId($);

  const util = {
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

    // optional details per schema
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

  return { key: `property_${propertyId}`, data: util };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const { key, data } = mapUtilities($);

  const outDir = path.join(process.cwd(), "owners");
  ensureDir(outDir);
  const outPath = path.join(outDir, "utilities_data.json");

  const output = {};
  output[key] = data;

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data for ${key} -> ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error generating utilities data:", err.message);
    process.exit(1);
  }
}
