// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractPropertyId($) {
  const h1Text = $("h1").first().text() || "";
  const match = h1Text.match(/Property Record Information for\s*(\d+)/i);
  return match ? match[1] : "unknown";
}

function buildUtilityObject() {
  // No explicit utility information is present in the provided HTML.
  return {
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
  };
}

(function main() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);
  const utility = buildUtilityObject($);

  const outDir = path.resolve("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");

  const payload = {};
  payload[`property_${propertyId}`] = utility;

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath} for property_${propertyId}`);
})();
