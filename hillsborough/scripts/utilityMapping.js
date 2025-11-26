// Utility mapping script: reads input.json and outputs owners/utilities_data.json per schema
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function mapUtility(input) {
  const b = (input.buildings && input.buildings[0]) || {};
  const ci = b.constructionInfo || [];
  const getDetailByElement = (code) => {
    const item = ci.find(
      (x) => ((x.element && x.element.code) || "").trim() === code.trim(),
    );
    return item
      ? item.constructionDetail && item.constructionDetail.description
      : null;
  };

  const hvac = getDetailByElement("AC");

  // HVAC mapping
  let cooling_system_type = null;
  let heating_system_type = null;
  if (hvac && /central/i.test(hvac)) {
    cooling_system_type = "CentralAir";
    heating_system_type = "Central";
  }

  // Permits for HVAC SEER and tons
  const permits = input.permitInfo || [];
  const hvacPermit = permits.find((p) => /HVAC/i.test(p.descr || "")) || null;
  let hvac_capacity_tons = null;
  let hvac_seer_rating = null;
  let hvac_installation_date = null;
  if (hvacPermit) {
    const m = (hvacPermit.descr || "").match(/(\d+)TON\s+(\d+)SEER/i);
    if (m) {
      hvac_capacity_tons = Number(m[1]);
      hvac_seer_rating = Number(m[2]);
    }
    hvac_installation_date = new Date(hvacPermit.issueDate)
      .toISOString()
      .slice(0, 10);
  }

  const out = {
    cooling_system_type,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type,
    hvac_capacity_kw: null,
    hvac_capacity_tons,
    hvac_condensing_unit_present: "Yes",
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date,
    hvac_seer_rating,
    hvac_system_configuration: "SplitSystem",
    hvac_unit_condition: "Good",
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: "WaterAvailable",
    sewer_connection_date: null,
    sewer_type: "Public",
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
    water_source_type: "Public",
    well_installation_date: null,
  };
  return out;
}

(function main() {
  const inputPath = path.resolve("input.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse input.json");
    process.exit(1);
  }
  const pin =
    data.pin || (data.propertyCard && data.propertyCard.folio) || "unknown";
  const outObj = {};
  outObj[`property_${pin}`] = mapUtility(data);
  ensureDir("owners");
  ensureDir("data");
  fs.writeFileSync(
    "owners/utilities_data.json",
    JSON.stringify(outObj, null, 2),
  );
  fs.writeFileSync("data/utilities_data.json", JSON.stringify(outObj, null, 2));
  console.log("owners/utilities_data.json written");
})();
