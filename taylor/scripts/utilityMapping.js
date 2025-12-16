// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_lblParcelID";
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
      '#ctlBodyPane_ctl04_mSection > div > table',
    )
    .each((_, table) => {
      const map = {};
      $(table)
        .find("tbody tr")
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
  return buildings;
}

function baseUtility() {
  return {
    building_number: null,
    request_identifier: null,
    cooling_system_type: null,
    heating_system_type: null,
    heating_fuel_type: null,
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

function mapCoolingType(val) {
  const t = (val || "").toUpperCase();
  if (!t) return null;
  if (t.includes("CENTRAL")) return "CentralAir";
  if (t.includes("DUCTLESS") || t.includes("MINI")) return "Ductless";
  if (t.includes("WINDOW")) return "WindowAirConditioner";
  if (t.includes("GEOTHERM")) return "GeothermalCooling";
  if (t.includes("ZONE")) return "Zoned";
  if (t.includes("FAN")) return "CeilingFans";
  if (t.includes("HYBRID")) return "Hybrid";
  if (t.includes("ELECT")) return "Electric";
  if (t.includes("WHOLE") && t.includes("HOUSE")) return "WholeHouseFan";
  return null;
}

function mapHeatingType(val) {
  const t = (val || "").toUpperCase();
  if (!t) return null;
  if (t.includes("HEAT PUMP")) return "HeatPump";
  if (t.includes("DUCTLESS") || t.includes("MINI")) return "Ductless";
  if (t.includes("BASEBOARD")) return "Baseboard";
  if (t.includes("RADIANT")) return "Radiant";
  if (t.includes("SOLAR")) return "Solar";
  if (t.includes("FORCED AIR DUCTED") || t.includes("CENTRAL")) return "Central";
  if (t.includes("GAS") && t.includes("FURN")) return "GasFurnace";
  if (t.includes("GAS")) return "Gas";
  if (t.includes("FURNACE")) return "ElectricFurnace";
  if (t.includes("ELECT")) return "Electric";
  return null;
}

function mapWaterSource(val) {
  const t = (val || "").toUpperCase();
  if (!t) return null;
  if (t.includes("WELL")) return "Well";
  if (t.includes("AQUIF")) return "Aquifer";
  if (t.includes("PUBLIC") || t.includes("CITY")) return "Public";
  return null;
}

function mapSewerType(val) {
  const t = (val || "").toUpperCase();
  if (!t) return null;
  if (t.includes("SEPTIC")) return "Septic";
  if (t.includes("COMBINED")) return "Combined";
  if (t.includes("SANITARY")) return "Sanitary";
  if (t.includes("PUBLIC") || t.includes("CITY")) return "Public";
  return null;
}

function buildUtilityFromBuilding(building, buildingNumber, requestId) {
  const util = baseUtility();
  util.building_number = buildingNumber;
  util.request_identifier = requestId || null;

  util.cooling_system_type = mapCoolingType(
    building["Cooling Type"] || building["Cooling"],
  );
  util.heating_system_type = mapHeatingType(
    building["Heating Type"] || building["Heating"],
  );
  util.water_source_type = mapWaterSource(
    building["Water"] || building["Water Source"],
  );
  util.sewer_type = mapSewerType(building["Sewer"]);

  return util;
}

function buildUtilities(buildings, parcelId) {
  if (!buildings.length) return [];
  return buildings.map((b, idx) =>
    buildUtilityFromBuilding(b, idx + 1, parcelId),
  );
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const propertySeed = readJSON("property_seed.json");
  // if (
  //   propertySeed &&
  //   propertySeed.request_identifier &&
  //   propertySeed.request_identifier !== parcelId
  // ) {
  //   throw {
  //     type: "error",
  //     message: "Request identifier and parcel id don't match.",
  //     path: "property.request_identifier",
  //   };
  // }
  const buildings = collectBuildings($);
  const utilities = buildUtilities(buildings, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { utilities };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
