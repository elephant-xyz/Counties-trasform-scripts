// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";

  const heatText = safeText($, "#lblBuildingHeat");
  const acText = safeText($, "#lblBuildingAC");
  const fuelText = safeText($, "#lblBuildingFuel");

  // Map heating
  let heating_system_type = null;
  if (/forced\s*air/i.test(heatText) || /ducted/i.test(heatText)) {
    heating_system_type = "Central";
  }
  if (/electric/i.test(fuelText) && !heating_system_type) {
    heating_system_type = "Electric";
  }

  // Map cooling
  let cooling_system_type = null;
  if (/central/i.test(acText)) {
    cooling_system_type = "CentralAir";
  }

  const utility = {
    cooling_system_type: cooling_system_type,
    heating_system_type: heating_system_type,
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

  const out = {};
  out[`property_${parcelId}`] = utility;

  const ownersDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const outPath = path.join(ownersDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
