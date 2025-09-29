// Utility mapping script
// Reads input.html, extracts utility details using cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textOf($, el) {
  return ($(el).text() || "").trim();
}

function findValueByLabel($, sectionSelector, labelText) {
  let val = null;
  $(`${sectionSelector} table`).each((_, tbl) => {
    $(tbl)
      .find("tr")
      .each((__, tr) => {
        const th = $(tr).find("th").first();
        const strongTxt = (th.find("strong").text() || "").trim().toUpperCase();
        const thTxt = (th.text() || "").trim().toUpperCase();
        const matchTxt = (labelText || "").toUpperCase();
        if (strongTxt === matchTxt || thTxt === matchTxt) {
          const td = $(tr).find("td").first();
          val = (td.text() || "").trim();
        }
      });
  });
  return val;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  if (!fs.existsSync(inputPath)) {
    console.error("input.html not found");
    process.exit(1);
  }
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId =
    textOf($, $("#ctlBodyPane_ctl02_ctl01_lblParcelID")) || "unknown";
  const propertyKey = `property_${parcelId}`;

  const buildingSection = "#ctlBodyPane_ctl08_mSection";
  const heatingRaw = findValueByLabel($, buildingSection, "Heating Type") || "";
  const coolingRaw =
    findValueByLabel($, buildingSection, "Air Conditioning") || "";

  // Map to schema enums
  let heating_system_type = null;
  const h = heatingRaw.toUpperCase();
  if (h.includes("FORCED")) heating_system_type = "Central";

  let cooling_system_type = null;
  const c = coolingRaw.toUpperCase();
  if (c.includes("CENTRAL")) cooling_system_type = "CentralAir";

  // Public utilities likely available in this area; cannot confirm specifics from document
  const utility = {
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
  const outPath = path.join(outDir, "utilities_data.json");
  const out = {};
  out[propertyKey] = utility;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
