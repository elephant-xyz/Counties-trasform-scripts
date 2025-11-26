// Utility mapping script
// Reads input.html, parses with cheerio, maps to utility schema, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const UTILITY_FIELDS = [
  "cooling_system_type",
  "electrical_panel_capacity",
  "electrical_panel_installation_date",
  "electrical_rewire_date",
  "electrical_wiring_type",
  "electrical_wiring_type_other_description",
  "heating_fuel_type",
  "heating_system_type",
  "hvac_capacity_kw",
  "hvac_capacity_tons",
  "hvac_condensing_unit_present",
  "hvac_equipment_component",
  "hvac_equipment_manufacturer",
  "hvac_equipment_model",
  "hvac_installation_date",
  "hvac_seer_rating",
  "hvac_system_configuration",
  "hvac_unit_condition",
  "hvac_unit_issues",
  "plumbing_fixture_count",
  "plumbing_fixture_quality",
  "plumbing_fixture_type_primary",
  "plumbing_system_installation_date",
  "plumbing_system_type",
  "plumbing_system_type_other_description",
  "public_utility_type",
  "sewer_connection_date",
  "sewer_type",
  "smart_home_features",
  "smart_home_features_other_description",
  "solar_installation_date",
  "solar_inverter_installation_date",
  "solar_inverter_manufacturer",
  "solar_inverter_model",
  "solar_inverter_visible",
  "solar_panel_present",
  "solar_panel_type",
  "solar_panel_type_other_description",
  "water_connection_date",
  "water_heater_installation_date",
  "water_heater_manufacturer",
  "water_heater_model",
  "water_source_type",
  "well_installation_date",
];

function createEmptyObject(fields) {
  return fields.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createEmptyUtility() {
  const obj = createEmptyObject(UTILITY_FIELDS);
  obj.solar_panel_present = false;
  obj.solar_inverter_visible = false;
  return obj;
}

function normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

function mapCoolingSystem(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("central")) return "CentralAir";
  if (raw.includes("heat pump")) return "Hybrid";
  if (raw.includes("fan")) return "CeilingFan";
  if (raw.includes("ductless") || raw.includes("mini-split")) return "Ductless";
  if (raw.includes("window")) return "WindowAirConditioner";
  if (raw.includes("geothermal")) return "GeothermalCooling";
  if (raw.includes("zoned")) return "Zoned";
  return null;
}

function mapHeatingSystem(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("electric furnace")) return "ElectricFurnace";
  if (raw.includes("gas furnace")) return "GasFurnace";
  if (raw.includes("heat pump")) return "HeatPump";
  if (raw.includes("radiant")) return "Radiant";
  if (raw.includes("baseboard")) return "Baseboard";
  if (raw.includes("central")) return "Central";
  if (raw.includes("solar")) return "Solar";
  if (raw.includes("ductless") || raw.includes("mini-split")) return "Ductless";
  if (raw.includes("gas")) return "Gas";
  if (raw.includes("electric")) return "Electric";
  return null;
}

function mapHeatingFuel(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("electric")) return "Electric";
  if (raw.includes("natural")) return "NaturalGas";
  if (raw.includes("propane")) return "Propane";
  if (raw.includes("oil")) return "Oil";
  if (raw.includes("kerosene")) return "Kerosene";
  if (raw.includes("wood pellet")) return "WoodPellet";
  if (raw.includes("wood")) return "Wood";
  if (raw.includes("geothermal")) return "Geothermal";
  if (raw.includes("solar")) return "Solar";
  if (raw.includes("steam")) return "DistrictSteam";
  return "Other";
}

function mapPublicUtility(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("water")) return "WaterAvailable";
  if (raw.includes("electric")) return "ElectricityAvailable";
  if (raw.includes("sewer")) return "SewerAvailable";
  if (raw.includes("gas")) return "NaturalGasAvailable";
  if (raw.includes("cable")) return "CableAvailable";
  if (raw.includes("underground")) return "UndergroundUtilities";
  return null;
}

function mapSewerType(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("septic")) return "Septic";
  if (raw.includes("combined")) return "Combined";
  if (raw.includes("sanitary")) return "Sanitary";
  if (raw.includes("public") || raw.includes("city")) return "Public";
  return null;
}

function mapWaterSource(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("well")) return "Well";
  if (raw.includes("aquifer")) return "Aquifer";
  if (raw.includes("public") || raw.includes("city")) return "Public";
  return null;
}

function mapPlumbingSystem(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("copper")) return "Copper";
  if (raw.includes("pex")) return "PEX";
  if (raw.includes("pvc")) return "PVC";
  if (raw.includes("galvanized")) return "GalvanizedSteel";
  if (raw.includes("cast")) return "CastIron";
  return null;
}

function textAfterStrong($el) {
  const html = $el.html() || "";
  const noStrong = html
    .replace(/<strong>[^<]*<\/strong>/i, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cheerio.load(`<div>${noStrong}</div>`)("div").text().trim();
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    // Extract AIN as property id
    let ain = null;
    $("div.table-section.building-table table tr td").each((i, el) => {
      const td = $(el);
      const strong = td.find("strong").first().text().trim();
      if (/^AIN$/i.test(strong)) {
        ain = textAfterStrong(td);
      }
    });
    if (!ain) {
      $("div.table-section.general-info table tr td table tr td").each(
        (i, el) => {
          const td = $(el);
          const strong = td.find("strong").first().text().trim();
          if (/^Account Number$/i.test(strong)) ain = textAfterStrong(td);
        },
      );
    }
    const propertyId = ain
      ? `property_${String(ain).trim()}`
      : "property_unknown";

    // Utilities not explicitly listed in this input; set nulls or defaults per schema types
    const utilities = createEmptyUtility();

    // Example hooks for future parsing if data is available in other HTML variants.
    // const coolingText = getValueByStrong($, "Cooling");
    // utilities.cooling_system_type = mapCoolingSystem(coolingText);
    // utilities.heating_system_type = mapHeatingSystem(
    //   getValueByStrong($, "Heating"),
    // );
    // utilities.heating_fuel_type = mapHeatingFuel(
    //   getValueByStrong($, "Heating Fuel"),
    // );
    // utilities.public_utility_type = mapPublicUtility(
    //   getValueByStrong($, "Utilities"),
    // );
    // utilities.sewer_type = mapSewerType(getValueByStrong($, "Sewer"));
    // utilities.water_source_type = mapWaterSource(
    //   getValueByStrong($, "Water"),
    // );
    // utilities.plumbing_system_type = mapPlumbingSystem(
    //   getValueByStrong($, "Plumbing"),
    // );

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "utilities_data.json");
    const payload = {};
    payload[propertyId] = utilities;
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote utilities data to ${outPath}`);
  } catch (err) {
    console.error("Error generating utilities data:", err.message);
    process.exit(1);
  }
})();
