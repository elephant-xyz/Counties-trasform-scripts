// utilityMapping.js
// Reads input from input.json and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");

function ensureFile(fp, dataObj) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(dataObj, null, 2), "utf-8");
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  } catch (e) {
    console.error(
      "Failed to read input.json. Ensure structureMapping.js created it.",
    );
    process.exit(1);
  }

  const parcel =
    (data &&
      data.d &&
      Array.isArray(data.d.parcelInfok__BackingField) &&
      data.d.parcelInfok__BackingField[0]) ||
    {};
  const folio = parcel.folioNumber || "unknown";

  const utilities = {
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

  const output = {};
  output[`property_${folio}`] = utilities;

  const outPath = path.join(process.cwd(), "owners", "utilities_data.json");
  ensureFile(outPath, output);
  console.log(`Wrote utilities data for property_${folio} to ${outPath}`);
})();
