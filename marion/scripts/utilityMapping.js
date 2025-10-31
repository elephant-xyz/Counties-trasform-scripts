// Utility mapping script
// Reads input.html, parses with cheerio, outputs utilities JSON per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getPrimeKey($, html) {
  const m = html.match(/Prime Key:\s*(\d+)/i);
  if (m) return m[1].trim();
  let key = null;
  $("*").each((i, el) => {
    const t = $(el).text();
    const mm = t && t.match(/Prime Key:\s*(\d+)/i);
    if (mm) {
      key = mm[1].trim();
      return false;
    }
  });
  return key || "unknown";
}

function parseUtilities($) {
  // Use 'Miscellaneous Improvements' table to infer water/sewer type (well, septic)
  let hasWell = false;
  let hasSeptic = false;
  $("table.mGrid tr.RowStyle").each((i, tr) => {
    const txt = $(tr).text().toLowerCase();
    if (txt.includes("well")) hasWell = true;
    if (txt.includes("septic")) hasSeptic = true;
  });

  // HVAC presence indicated as N in characteristics table for A/C; assume minimal cooling via CeilingFans
  let acFlag = null;
  const charTable = $("table")
    .filter((i, el) => {
      const ths = $(el).find("th");
      return ths.filter((j, th) => /A\/C/i.test($(th).text())).length > 0;
    })
    .first();
  if (charTable.length) {
    const firstRow = charTable.find("tr.RowStyle").first();
    const tds = firstRow.find("td");
    if (tds.length) {
      const acText = $(tds.get(10)).text().trim();
      acFlag = acText === "Y";
    }
  }

  // Build defaults according to schema
  const data = {
    cooling_system_type: acFlag ? "CentralAir" : "CeilingFans",
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: null,
    heating_system_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: acFlag === true ? "Yes" : "No",
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
    sewer_type: hasSeptic ? "Septic" : null,
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
    water_source_type: hasWell ? "Well" : null,
    well_installation_date: null,
  };
  return data;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const id = getPrimeKey($, html);
  const data = parseUtilities($);

  const outObj = {};
  outObj[`property_${id}`] = data;

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(ownersDir);
  ensureDir(dataDir);

  const ownersOut = path.join(ownersDir, "utilities_data.json");
  const dataOut = path.join(dataDir, "utilities_data.json");
  const json = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(ownersOut, json);
  fs.writeFileSync(dataOut, json);
  console.log(`Wrote utility data for property_${id} to owners/ and data/`);
})();
