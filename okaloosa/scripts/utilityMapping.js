// Utility mapping script
// Reads input.html, parses with cheerio, maps to utility schema, writes JSON to owners/ and data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error("Error reading input.html:", e.message);
    process.exit(1);
  }
}

function ensureDirs() {
  const dirs = ["owners", "data"];
  dirs.forEach((d) => {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch (e) {}
  });
}

function text(val) {
  return (val || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let pid = null;
  $("#ctlBodyPane_ctl00_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const k = text($(tr).find("th strong").text());
      const v = text($(tr).find("td span").text());
      if (k === "Parcel ID") pid = v;
    },
  );
  if (!pid) {
    const t = text($("title").text());
    const m = t.match(/Report:\s*([\w-]+)/);
    if (m) pid = m[1];
  }
  return pid;
}

function parseBuildingInfo($) {
  const data = {};
  $("#ctlBodyPane_ctl07_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const key = text($(tr).find("th strong").text());
      const val = text($(tr).find("td span").text());
      if (key) data[key] = val || null;
    },
  );
  return data;
}

function mapCooling(val) {
  if (!val) return null;
  const s = val.toUpperCase();
  if (s.includes("CENTRAL")) return "CentralAir";
  if (s.includes("WINDOW")) return "WindowAirConditioner";
  if (s.includes("DUCTLESS")) return "Ductless";
  return null;
}

function mapHeating(val) {
  if (!val) return null;
  const s = val.toUpperCase();
  if (s.includes("AIR DUCTED") || s.includes("CENTRAL")) return "Central";
  if (s.includes("HEAT PUMP")) return "HeatPump";
  if (s.includes("GAS")) return "Gas";
  if (s.includes("ELECTRIC")) return "Electric";
  return null;
}

function buildUtilitySkeleton() {
  return {
    cooling_system_type: null,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
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
    water_source_type: null,
    well_installation_date: null,
  };
}

function main() {
  const html = safeRead("input.html");
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  if (!parcelId) {
    console.error("Parcel ID not found.");
    process.exit(1);
  }
  const binfo = parseBuildingInfo($);

  const out = buildUtilitySkeleton();
  out.cooling_system_type = mapCooling(binfo["Air Conditioning"]);
  out.heating_system_type = mapHeating(binfo["Heat"]);

  // Others remain null/false as unknown

  const wrapper = {};
  wrapper[`property_${parcelId}`] = out;

  ensureDirs();
  const json = JSON.stringify(wrapper, null, 2);
  fs.writeFileSync(path.join("owners", "utilities_data.json"), json, "utf8");
  fs.writeFileSync(path.join("data", "utilities_data.json"), json, "utf8");
  console.log("Wrote utilities data for", parcelId);
}

main();
