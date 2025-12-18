// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl04_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
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
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function mapCoolingSystem(detail) {
  const d = (detail || "").toUpperCase();
  if (d.includes("CENTRAL")) return "CentralAir";
  if (d.includes("PACKAGE") || d.includes("PACKAGED")) return "PackagedSystem";
  if (d.includes("WINDOW")) return "WindowAirConditioner";
  if (d.includes("FAN")) return "CeilingFan";
  if (d.includes("DUCTLESS") || d.includes("MINI SPLIT")) return "Ductless";
  if (d.includes("GEOTHERMAL")) return "GeothermalCooling";
  if (d.includes("WALL")) return "WallUnit";
  return null;
}

function mapHeatingSystem(detail) {
  const d = (detail || "").toUpperCase();
  if (d.includes("CENTRAL") || d.includes("AIR DUCTED")) return "Central";
  if (d.includes("HEAT PUMP") || d.includes("HP")) return "HeatPump";
  if (d.includes("ELECTRIC")) return "Electric";
  if (d.includes("GAS")) return "Gas";
  if (d.includes("OIL")) return "Oil";
  if (d.includes("RADIANT")) return "Radiant";
  if (d.includes("FURNACE")) return "GasFurnace";
  if (d.includes("BASEBOARD")) return "Baseboard";
  return null;
}

function defaultUtility({
  building_number = null,
  utility_index = 1,
  cooling_system_type = null,
  heating_system_type = null,
  request_identifier = null,
}) {
  return {
    request_identifier,
    building_number,
    utility_index,
    cooling_system_type,
    heating_system_type,
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
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
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
}

function buildUtilityRecords(parcelId, buildings) {
  const utilities = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const cooling_system_type = mapCoolingSystem(building["Air Conditioning"]);
    const heating_system_type = mapHeatingSystem(building["Heat"]);
    utilities.push(
      defaultUtility({
        building_number: buildingNumber,
        utility_index: buildingNumber,
        cooling_system_type,
        heating_system_type,
        request_identifier: parcelId
          ? `${parcelId}_utility_${buildingNumber}`
          : null,
      }),
    );
  });

  if (!utilities.length) {
    utilities.push(
      defaultUtility({
        utility_index: 1,
        request_identifier: parcelId ? `${parcelId}_utility_1` : null,
      }),
    );
  }

  return utilities;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    console.log("Parcel ID not found");
    return;
  }
  const buildings = collectBuildings($);
  const utilities = buildUtilityRecords(parcelId, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { utilities };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${utilities.length} utility entries`);
}

if (require.main === module) {
  main();
}
