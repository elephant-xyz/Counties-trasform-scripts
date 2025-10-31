// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textNorm(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}

function getKV($, tableSelector, headingText) {
  let val = null;
  $(tableSelector)
    .find("tr")
    .each((i, tr) => {
      const th = textNorm($(tr).find("td.DataletSideHeading").first().text());
      if (th === headingText) {
        val = textNorm($(tr).find("td.DataletData").first().text());
      }
    });
  return val;
}

function extractPropertyId($) {
  const hdPin = $("input#hdPin").attr("value") || $("input#hdPin").val();
  if (hdPin) return textNorm(hdPin);
  let id = null;
  $("#datalet_header_row")
    .find("td")
    .each((i, td) => {
      const t = $(td).text();
      const m = t.match(/Altkey:\s*(\d+)/i);
      if (m) id = m[1];
    });
  return id || "unknown";
}

function parseDateMDY(s) {
  // Converts m/d/yyyy or mm/dd/yyyy to yyyy-mm-dd
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const propId = extractPropertyId($);

  const residentialTable = "table#Residential";

  const hvacRaw = getKV($, residentialTable, "HVAC");
  const fuelRaw = getKV($, residentialTable, "Fuel");

  // Infer cooling system
  let cooling_system_type = null;
  if ((hvacRaw || "").toUpperCase().includes("DUCT")) {
    cooling_system_type = "CentralAir";
  }

  // Infer heating
  let heating_fuel_type = null;
  if ((fuelRaw || "").toUpperCase().includes("ELECTRIC"))
    heating_fuel_type = "Electric";

  let heating_system_type = null;
  if ((hvacRaw || "").toUpperCase().includes("DUCT")) {
    // forced air ducted typically central system
    heating_system_type = "Central";
  }

  // Permits table may include AC changeout; use for install date
  let hvac_installation_date = null;
  $("div#datalet_div_12 table#Permit\\ Summary tr").each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("td.DataletData");
    if (tds.length >= 3) {
      const date = textNorm($(tds[0]).text());
      const desc = textNorm($(tds[2]).text()).toUpperCase();
      if (desc.includes("AC CHANGE")) {
        hvac_installation_date = parseDateMDY(date) || hvac_installation_date;
      }
    }
  });

  const util = {
    cooling_system_type: cooling_system_type,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: heating_fuel_type,
    heating_system_type: heating_system_type,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: "Unknown",
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: hvac_installation_date,
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

  const out = {};
  out[`property_${propId}`] = util;

  ensureDirSync(path.join(process.cwd(), "owners"));
  fs.writeFileSync(
    path.join("owners", "utilities_data.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("Wrote owners/utilities_data.json for property_" + propId);
}

try {
  main();
} catch (err) {
  console.error("Error generating utilities data:", err.message);
  process.exit(1);
}
