// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCellValueByHeader($, table, headerText) {
  let val = null;
  $(table)
    .find("tr")
    .each((i, tr) => {
      const th = $(tr).find("td strong").first();
      const label = (th.text() || "").trim();
      if (label.toLowerCase() === (headerText || "").toLowerCase()) {
        const td = $(tr).find("td").eq(1);
        val = td.text().replace(/\s+/g, " ").trim();
      }
    });
  return val;
}

function extractPropertyId($) {
  const summaryTable = $(
    "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table.tabular-data-two-column",
  );
  let propId = getCellValueByHeader($, summaryTable, "Prop ID");
  if (propId) return propId.trim();
  let parcelId = getCellValueByHeader($, summaryTable, "Parcel ID");
  if (parcelId) return parcelId.trim();
  const title = $("title").text();
  const m = title.match(/Card:\s*([\d\-]+)/);
  if (m) return m[1];
  return "unknown";
}

function extractHVAC($) {
  const rightTable = $(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary table",
  );
  const air = getCellValueByHeader($, rightTable, "Air Conditioning");
  const heat = getCellValueByHeader($, rightTable, "Heat");
  let cooling_system_type = null;
  if (/CENTRAL/i.test(air || "")) cooling_system_type = "CentralAir";

  let heating_system_type = null;
  if (/FO AIR DCT|FORCED|CENTRAL|DUCT/i.test(heat || ""))
    heating_system_type = "Central";

  return { cooling_system_type, heating_system_type };
}

(function main() {
  try {
    const inputPath = path.join(process.cwd(), "input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    const hvac = extractHVAC($);

    const utility = {
      cooling_system_type: hvac.cooling_system_type,
      heating_system_type: hvac.heating_system_type,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: "Unknown",
      electrical_wiring_type_other_description: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,

      // Optional fields
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
      public_utility_details: undefined,
      sewer_connection_date: null,
      solar_installation_date: null,
      solar_inverter_installation_date: null,
      solar_inverter_manufacturer: null,
      solar_inverter_model: null,
      water_connection_date: null,
      water_heater_installation_date: null,
      water_heater_manufacturer: null,
      water_heater_model: null,
    };

    const out = {};
    out[`property_${propId}`] = utility;

    ensureDir(path.join(process.cwd(), "owners"));
    const outPath = path.join(process.cwd(), "owners", "utilities_data.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote utilities data to", outPath);
  } catch (e) {
    console.error("Error in utilityMapping:", e.message);
    process.exit(1);
  }
})();
