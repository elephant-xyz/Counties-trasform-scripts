// Utility mapping script
// Reads input.json, extracts utility-related fields, and writes owners/utilities_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadInput() {
  const jsonFilePath = path.join(process.cwd(), 'input.json');
  const htmlFilePath = path.join(process.cwd(), 'input.html');

  try {
    // 1. Try to read input.json synchronously
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    return JSON.parse(jsonData);
  } catch (jsonError) {
    // If input.json doesn't exist or is unreadable, try input.html
    if (jsonError.code === 'ENOENT' || jsonError instanceof SyntaxError) {
      console.warn(`Could not read or parse input.json: ${jsonError.message}. Attempting to read from input.html.`);
      try {
        // 2. Read input.html synchronously
        const htmlData = fs.readFileSync(htmlFilePath, 'utf8');

        // Parse the HTML using Cheerio
        const $ = cheerio.load(htmlData);
        const preTagContent = $('pre').text(); // Get the text content of the <pre> tag

        if (preTagContent) {
          return JSON.parse(preTagContent);
        } else {
          throw new Error('No <pre> tag found or <pre> tag is empty in input.html');
        }
      } catch (htmlError) {
        throw new Error(`Failed to read or parse JSON from input.html: ${htmlError.message}`);
      }
    } else {
      // Re-throw other errors from input.json
      throw new Error(`An unexpected error occurred while processing input.json: ${jsonError.message}`);
    }
  }
}

function mapUtility(data) {
  // No explicit utility info provided; populate required keys with null or sensible defaults where boolean is required.
  const utility = {
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

    // Optional fields per schema
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

  return utility;
}

function run() {
  const data = loadInput();
  const utility = mapUtility(data);
  const id =
    (data && data.PropertyInfo && data.PropertyInfo.FolioNumber) || "unknown";
  const output = {};
  output[`property_${id}`] = utility;

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

run();
