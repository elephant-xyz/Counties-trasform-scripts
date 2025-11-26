// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue";
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

function createDefaultUtilityRecord() {
  return {
    cooling_system_type: null,
    heating_system_type: null,
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

function mapCoolingSystem(value) {
  const text = (value || "").trim().toUpperCase();
  if (!text || text === "NONE" || text === "NO") return null;
  if (text.includes("CENTRAL")) return "CentralAir";
  if (text.includes("WINDOW")) return "WindowAirConditioner";
  if (text.includes("WHOLE HOUSE")) return "WholeHouseFan";
  if (text.includes("DUCTLESS") || text.includes("MINI")) return "Ductless";
  if (text.includes("GEOTHERM")) return "GeothermalCooling";
  if (text.includes("HYBRID")) return "Hybrid";
  if (text.includes("ZONE")) return "Zoned";
  if (text.includes("CEILING FAN")) return "CeilingFans";
  if (text.includes("FAN")) return "CeilingFans";
  if (text.includes("ELECTRIC")) return "Electric";
  return null;
}

function mapHeatingSystem(value) {
  const text = (value || "").trim().toUpperCase();
  if (!text || text === "NONE" || text === "NO") return null;
  if (text.includes("HEAT PUMP")) return "HeatPump";
  if (text.includes("DUCTLESS") || text.includes("MINI")) return "Ductless";
  if (text.includes("RADIANT")) return "Radiant";
  if (text.includes("SOLAR")) return "Solar";
  if (text.includes("BASEBOARD")) return "Baseboard";
  if (text.includes("GAS FURNACE")) return "GasFurnace";
  if (text.includes("ELECTRIC FURNACE")) return "ElectricFurnace";
  if (text.includes("GAS")) return "Gas";
  if (text.includes("ELECTRIC")) return "Electric";
  if (text.includes("CENTRAL")) return "Central";
  return null;
}

function buildUtilityRecords(buildings) {
  return buildings.map((building, idx) => {
    const rec = createDefaultUtilityRecord();
    const rawCooling = building["Air Conditioning"] || "";
    const rawHeating = building["Heat"] || "";
    rec.cooling_system_type = mapCoolingSystem(rawCooling);
    rec.heating_system_type = mapHeatingSystem(rawHeating);

    if (rec.cooling_system_type === "CentralAir") {
      rec.hvac_system_configuration = "SplitSystem";
      rec.hvac_equipment_component = "CondenserAndAirHandler";
      rec.hvac_condensing_unit_present = "Yes";
    }
    rec._building_index = idx + 1;
    return rec;
  });
}

function buildUtilityRecord($, buildings) {
  if (!buildings || buildings.length === 0) {
    return [];
  }
  return buildUtilityRecords(buildings);
}

function buildUtilityContext($, buildings) {
  return {
    utilities: buildUtilityRecord($, buildings),
  };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const utilityContext = buildUtilityContext($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = utilityContext;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
