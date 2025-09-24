// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelId = null;
  $("table.tabular-data-two-column tbody tr").each((_, tr) => {
    const th = textTrim($(tr).find("th,strong").first().text());
    if (/Parcel ID/i.test(th)) {
      const tdText = textTrim($(tr).find("td span").first().text());
      if (tdText) parcelId = tdText;
    }
  });
  return parcelId;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        "Buildings",
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  return buildings;
}

function inferHVAC(buildings) {
  let cooling_system_type = null;
  let heating_system_type = null;
  let hvac_system_configuration = null;
  let hvac_equipment_component = null;
  let hvac_unit_condition = null;
  let hvac_unit_issues = null;
  let hvac_condensing_unit_present = null;

  buildings.forEach((b) => {
    const ac = (b["Air Conditioning"] || "").toUpperCase();
    const heat = (b["Heat"] || "").toUpperCase();
    if (ac.includes("CENTRAL")) cooling_system_type = "CentralAir";
    if (heat.includes("AIR DUCTED") || heat.includes("CENTRAL"))
      heating_system_type = "Central";
  });

  if (cooling_system_type === "CentralAir") {
    hvac_system_configuration = "SplitSystem";
    hvac_equipment_component = "CondenserAndAirHandler";
    hvac_condensing_unit_present = "Yes";
  }

  return {
    cooling_system_type,
    heating_system_type,
    hvac_system_configuration,
    hvac_equipment_component,
    hvac_unit_condition,
    hvac_unit_issues,
    hvac_condensing_unit_present,
  };
}

function buildUtilityRecord($, buildings) {
  const hvac = inferHVAC(buildings);
  const rec = {
    cooling_system_type: hvac.cooling_system_type,
    heating_system_type: hvac.heating_system_type,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: hvac.hvac_condensing_unit_present,
    electrical_wiring_type_other_description: null,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    hvac_unit_condition: hvac.hvac_unit_condition,
    solar_inverter_visible: false,
    hvac_unit_issues: hvac.hvac_unit_issues,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: hvac.hvac_equipment_component,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: hvac.hvac_system_configuration,
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

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const utilitiesRecord = buildUtilityRecord($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = utilitiesRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
