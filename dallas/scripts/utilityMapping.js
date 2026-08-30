// Utility mapping script
// Reads input.json, parses DCAD HTML with cheerio, and outputs owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, selector) {
  const el = $(selector);
  return el && el.length ? el.first().text().trim() : "";
}

function getPropertyId(input, $) {
  const id1 =
    input?.OwnersAndGeneralInformation?.source_http_request
      ?.multiValueQueryString?.ID?.[0];
  if (id1) return id1;
  const title = $("span#lblPageTitle").text() || $("span.PageTitle").text();
  const m = title.match(/#([0-9]{8,})/);
  if (m) return m[1];
  const hid = $("input#txtAccountNumber").val();
  if (hid) return hid.trim();
  return "unknown";
}

function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error("Failed to read input.json:", e.message);
    raw = "{}";
  }
  let input;
  try {
    input = JSON.parse(raw);
  } catch (e) {
    console.error("Invalid JSON in input.json, proceeding with empty object");
    input = {};
  }

  const html = input?.OwnersAndGeneralInformation?.response || "";
  const $ = cheerio.load(html || "<html></html>");
  const propertyId = getPropertyId(input, $);

  // DCAD Main Improvement shows Heating and Air Condition types in text like 'CENTRAL FULL'
  const heatingTxt = safeText($, "#MainImpRes1_lblHeatType");
  const coolingTxt = safeText($, "#MainImpRes1_lblAC");

  function mapHeating(txt) {
    if (!txt) return null;
    const t = txt.toUpperCase();
    if (t.includes("HEAT PUMP")) return "Heat Pump";
    if (t.includes("CENTRAL")) return "Central";
    if (t.includes("GAS")) return "Gas";
    if (t.includes("ELECTRIC")) return "Electric";
    return null;
  }
  function mapCooling(txt) {
    if (!txt) return null;
    const t = txt.toUpperCase();
    if (t.includes("CENTRAL")) return "CentralAir";
    if (t.includes("WINDOW")) return "WindowAirConditioner";
    if (t.includes("DUCTLESS") || t.includes("MINI SPLIT")) return "Ductless";
    return null;
  }

  const data = {
    cooling_system_type: mapCooling(coolingTxt),
    heating_system_type: mapHeating(heatingTxt),
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
    heating_fuel_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    plumbing_fixture_count: null,
    plumbing_fixture_quality: null,
    plumbing_fixture_type_primary: null,
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

  const out = {};
  out[`property_${propertyId}`] = data;

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Utilities data written to", outPath);
}

if (require.main === module) {
  main();
}
