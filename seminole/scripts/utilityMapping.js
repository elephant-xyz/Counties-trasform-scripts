// Utility data extractor and mapper
// Reads input.html, parses JSON within <pre>, maps to utility schema, writes owners/utilities_data.json (and mirrors to data/utilities_data.json)

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseInput() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  const preText = $("pre").first().text().trim();
  if (!preText) throw new Error("No JSON found in <pre> tag.");
  const data = JSON.parse(preText);
  return data;
}

function buildUtilityRecord(src) {
  // Utilities mostly unknown from assessor; infer some public utilities by service names present.
  const waterService = (src.waterServiceArea || "").toUpperCase();
  const sewerService = (src.sewerServiceArea || "").toUpperCase();

  const publicUtilityType = (() => {
    const hasWater = Boolean(waterService);
    const hasSewer = Boolean(sewerService);
    const hasElectric = Boolean((src.powerCompanyName || "").trim());
    if (hasWater && hasSewer) return "WaterAndSewer";
    if (hasWater) return "WaterAvailable";
    if (hasSewer) return "SewerAvailable";
    if (hasElectric) return "ElectricAvailable";
    return null;
  })();

  const record = {
    cooling_system_type: null,
    heating_system_type: null,
    public_utility_type: publicUtilityType,
    sewer_type: sewerService ? "Public" : null,
    water_source_type: waterService ? "Public" : null,
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

    // Optional date/manufacturer fields
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
    request_identifier:
      String(
        src.parcelNumber ||
          src.apprId ||
          src.masterId ||
          (src.parcelNumberFormatted || ""),
      ) || "unknown",
  };

  return record;
}

function main() {
  const src = parseInput();
  const id = src && src.apprId ? String(src.apprId) : "unknown";
  const outObj = {};
  outObj[`property_${id}`] = buildUtilityRecord(src);

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const ownersOut = path.join(ownersDir, "utilities_data.json");
  const dataOut = path.join(dataDir, "utilities_data.json");
  const json = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(ownersOut, json, "utf8");
  fs.writeFileSync(dataOut, json, "utf8");
  console.log("Utility mapping complete:", ownersOut);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in utilityMapping:", err.message);
    process.exit(1);
  }
}
