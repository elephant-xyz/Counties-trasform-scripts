// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  const h1 = $("section.title h1").first().text().trim();
  const m = h1.match(/Parcel\s+([0-9\-]+)/i);
  if (m) return m[1];
  const title = $("title").text();
  const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
  if (m2) return m2[1];
  return "unknown";
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propId = extractPropertyId($);

  // From Structural Elements: AC CENTRAL, Heating AIR DUCTED (assume Central)
  const seRows = [];
  $("div.se table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const type = $(tds[1]).text().trim();
    const details = $(tds[3]).text().trim();
    seRows.push({ type, details });
  });
  const ac =
    seRows.find((r) => r.type.toLowerCase() === "air conditioning")?.details ||
    "";
  const ht =
    seRows.find((r) => r.type.toLowerCase() === "heating type")?.details || "";

  function mapCooling(detail) {
    const d = (detail || "").toUpperCase();
    if (d.includes("CENTRAL")) return "CentralAir";
    if (d.includes("DUCTLESS")) return "Ductless";
    return null;
  }
  function mapHeating(detail) {
    const d = (detail || "").toUpperCase();
    if (d.includes("AIR DUCTED") || d.includes("CENTRAL")) return "Central";
    return null;
  }

  const utility = {
    cooling_system_type: mapCooling(ac),
    heating_system_type: mapHeating(ht),
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

    // Optional fields default to null
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
    hvac_unit_issues_desc: null,
    plumbing_system_installation_date: null,
    public_utility_type_desc: null,
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

  const outObj = {};
  outObj[`property_${propId}`] = utility;

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/utilities_data.json"),
    JSON.stringify(outObj, null, 2),
  );
  console.log("Wrote owners/utilities_data.json for", propId);
}

run();
