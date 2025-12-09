// Utility mapping script
// Generates owners/utilities_data.json with one utility record per building.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  const parcelIdText = $(PARCEL_SELECTOR).text().trim();
  return parcelIdText || null;
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
          if (!label) label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let index = 0;
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
          if (!label) label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length && buildings[index]) {
        buildings[index] = { ...buildings[index], ...map };
        index += 1;
      }
    });
  return buildings;
}

function mapCoolingSystem(acValue) {
  const value = (acValue || "").toUpperCase();
  if (!value) return null;
  if (value.includes("CENTRAL")) return "CentralAir";
  if (value.includes("WINDOW")) return "WindowUnits";
  if (value.includes("WALL")) return "WallUnit";
  if (value.includes("NONE")) return "None";
  return null;
}

function mapHeatingSystem(heatValue) {
  const value = (heatValue || "").toUpperCase();
  if (!value) return null;
  if (value.includes("FORCED") || value.includes("DUCT"))
    return "Central";
  if (value.includes("HEAT PUMP")) return "HeatPump";
  if (value.includes("NONE")) return "None";
  return null;
}

function buildUtilityFromBuilding(building, buildingNumber) {
  const cooling = mapCoolingSystem(building["Air Conditioning"]);
  const heating = mapHeatingSystem(building["Heat"]);
  return {
    cooling_system_type: cooling,
    heating_system_type: heating,
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
    building_number: buildingNumber,
    is_extra_feature: false,
  };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");

  const buildings = collectBuildings($);
  const utilities = buildings.map((building, idx) =>
    buildUtilityFromBuilding(building, idx + 1),
  );

  if (!utilities.length) {
    console.log("No utilities found.");
    return;
  }

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload =
    utilities.length === 1
      ? utilities[0]
      : { utilities };
  const outObj = {};
  outObj[`property_${parcelId}`] = payload;

  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
