// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getAltKey($) {
  let altkey = $("input#altkey").val();
  if (!altkey) {
    $("div.col-sm-5").each((i, el) => {
      const t = $(el).text().trim();
      if (/Alternate Key/i.test(t)) {
        const v = $(el).next().text().trim();
        if (v) altkey = v.replace(/[^0-9]/g, "");
      }
    });
  }
  return altkey;
}

function findValueByLabel($, label) {
  let val = null;
  $("div.row.parcel-content").each((i, row) => {
    const strongs = $(row).find("strong");
    strongs.each((j, s) => {
      const t = $(s).text().trim().replace(/:$/, "");
      if (t.toLowerCase() === label.toLowerCase()) {
        const v = $(s).parent().next().text().trim();
        if (v && !val) val = v;
      }
    });
  });
  return val;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const altkey = getAltKey($);

  const hvac = findValueByLabel($, "HVAC") || "";
  const heatMethod = findValueByLabel($, "Heat Method") || "";
  const heatSource = findValueByLabel($, "Heat Source") || "";

  // Cooling mapping
  let cooling_system_type = null;
  if (/AIR\s*CONDITIONING/i.test(hvac)) cooling_system_type = "CentralAir";

  // Heating mapping
  let heating_system_type = null;
  if (/ELECTRIC/i.test(heatSource)) {
    // Ducted + electric -> central electric heat (generic)
    heating_system_type = "Electric";
  }

  const utilities = {
    cooling_system_type: cooling_system_type,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: heating_system_type,
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

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const payload = {};
  payload[`property_${altkey}`] = utilities;
  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
