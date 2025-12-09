// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Data";

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
          const label = textTrim($(tr).find("th strong").first().text());
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
          const label = textTrim($(tr).find("th strong").first().text());
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

function createUtilityBase(building_number = null) {
  return {
    building_number,
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

function mapCoolingType(acDesc) {
  const ac = (acDesc || "").toUpperCase();
  if (!ac) return null;
  if (ac.includes("CENTRAL") || ac.includes("DUCTED")) return "CentralAir";
  if (ac.includes("DUCTLESS") || ac.includes("MINI SPLIT")) return "Ductless";
  if (ac.includes("WALL") || ac.includes("WINDOW")) return "WindowAirConditioner";
  if (ac.includes("GEOTHERM")) return "GeothermalCooling";
  if (ac.includes("FAN")) return "WholeHouseFan";
  return null;
}

function mapHeatingType(heatDesc) {
  const heat = (heatDesc || "").toUpperCase();
  if (!heat) return null;
  if (heat.includes("HEAT PUMP")) return "HeatPump";
  if (heat.includes("CENTRAL")) return "Central";
  if (heat.includes("DUCTLESS") || heat.includes("MINI SPLIT")) return "Ductless";
  if (heat.includes("ELECT")) return "Electric";
  if (heat.includes("GAS")) return "Gas";
  if (heat.includes("RADIANT")) return "Radiant";
  if (heat.includes("BASEBOARD")) return "Baseboard";
  return null;
}

function buildUtilitiesForBuildings(buildings) {
  return buildings.map((building, idx) => {
    const rec = createUtilityBase(idx + 1);
    rec.cooling_system_type = mapCoolingType(building["Air Conditioning"]);
    rec.heating_system_type = mapHeatingType(building["Heat"]);
    if (rec.cooling_system_type === "CentralAir") {
      rec.hvac_system_configuration = "SplitSystem";
      rec.hvac_equipment_component = "CondenserAndAirHandler";
      rec.hvac_condensing_unit_present = "Yes";
    } else if (rec.cooling_system_type === "Ductless") {
      rec.hvac_system_configuration = "MiniSplit";
    }
    return rec;
  });
}

function aggregateUtilities(utilities) {
  const base = createUtilityBase(null);
  const booleanDefaults = {
    solar_panel_present: false,
    solar_inverter_visible: false,
  };
  const fields = Object.keys(base).filter((key) => key !== "building_number");
  fields.forEach((field) => {
    base[field] = null;
  });
  utilities.forEach((entry) => {
    fields.forEach((field) => {
      if (base[field] == null && entry[field] != null) {
        base[field] = entry[field];
      }
    });
  });
  Object.entries(booleanDefaults).forEach(([field, defaultVal]) => {
    if (base[field] == null) {
      base[field] = defaultVal;
    }
  });
  return base;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  // if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const utilities = buildUtilitiesForBuildings(buildings);
  const aggregate = aggregateUtilities(utilities);
  aggregate.utilities = utilities;

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = aggregate;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
