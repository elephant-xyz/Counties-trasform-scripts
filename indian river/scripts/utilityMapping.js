// Utility mapping script
// Creates per-building utility records with basic HVAC inference.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BUILDING_SECTION_TITLE = "Building Information";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
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
  section
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
  section
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
        const combined = { ...buildings[buildingCount], ...map };
        buildings[buildingCount++] = combined;
      }
    });
  return buildings;
}

function inferHVACDetails(raw) {
  const value = (raw || "").toUpperCase();
  const result = {
    cooling_system_type: null,
    heating_system_type: null,
  };
  if (!value) return result;
  if (value.includes("PACKAGE") || value.includes("PACK")) {
    result.cooling_system_type = "CentralAir";
    result.heating_system_type = "Central";
  } else if (value.includes("AIR") || value.includes("AC")) {
    result.cooling_system_type = "CentralAir";
  }
  if (value.includes("HEAT PUMP")) {
    result.heating_system_type = "HeatPump";
  } else if (value.includes("HEAT")) {
    result.heating_system_type = result.heating_system_type || "Central";
  }
  return result;
}

function buildUtilityRecords(buildings) {
  return buildings.map((building, index) => {
    const hvacValue =
      building["HC&V"] ||
      building["HVAC"] ||
      building["Heating & Cooling"] ||
      "";
    const hvac = inferHVACDetails(hvacValue);
    return {
      building_number: index + 1,
      cooling_system_type: hvac.cooling_system_type,
      heating_system_type: hvac.heating_system_type,
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
  });
}

const seedPath = path.join(process.cwd(), "property_seed.json");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = seedData.parcel_id;
  const buildings = collectBuildings($);
  const utilities = buildUtilityRecords(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    utilities,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}

