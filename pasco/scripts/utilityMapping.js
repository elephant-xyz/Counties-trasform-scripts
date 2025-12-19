// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function normalize(value) {
  return value ? value.trim() : "";
}

function extractTwoDigitCode(value) {
  if (!value) return null;
  const match = String(value).match(/\b(\d{1,2})\b/);
  if (!match) return null;
  return match[1].padStart(2, "0");
}

const AC_CODE_MAP = {
  "00": null,
  "01": "WindowAirConditioner",
  "02": "CentralAir",
  "03": "CentralAir",
  "04": "CentralAir",
};

const HEATING_FUEL_CODE_MAP = {
  "00": null,
  "01": "Oil",
  "02": "NaturalGas",
  "03": "Electric",
  "04": "Solar",
};

const HEAT_TYPE_CODE_MAP = {
  "00": null,
  "01": "Radiant",
  "02": "Central",
  "03": "Central",
  "04": "Radiant",
  "05": "Radiant",
  "06": "Radiant",
  "07": "Radiant",
};

const HVAC_CODE_MAP = {
  "00": { heat: null, cool: null },
  "01": { heat: "Central", cool: "CentralAir" },
  "02": { heat: "Central", cool: "CentralAir" },
};

function mapCoolingSystem(value) {
  const raw = normalize(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && code in AC_CODE_MAP) return AC_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("WINDOW")) return "WindowAirConditioner";
  if (upper.includes("CENTRAL")) return "CentralAir";
  if (upper.includes("PACKAGED") || upper.includes("ROOF")) return "CentralAir";
  if (upper.includes("CHILLED")) return "CentralAir";
  if (upper.includes("NONE") || upper.includes("N/A")) return null;
  if (upper.includes("DUCTLESS")) return "Ductless";
  return null;
}

function mapHeatingFuel(value) {
  const raw = normalize(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && code in HEATING_FUEL_CODE_MAP) return HEATING_FUEL_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("OIL")) return "Oil";
  if (upper.includes("GAS")) return "NaturalGas";
  if (upper.includes("ELECTRIC")) return "Electric";
  if (upper.includes("SOLAR")) return "Solar";
  if (upper.includes("NONE") || upper.includes("N/A")) return null;
  return null;
}

function mapHeatingSystem(value, fuelType) {
  const raw = normalize(value);
  const code = extractTwoDigitCode(raw);
  if (code && code in HEAT_TYPE_CODE_MAP) return HEAT_TYPE_CODE_MAP[code];
  if (!raw && fuelType) {
    if (fuelType === "Electric") return "Electric";
    if (fuelType === "NaturalGas") return "Gas";
    if (fuelType === "Oil") return null;
  }
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.includes("HEAT PUMP")) return "HeatPump";
  if (upper.includes("FORCED") || upper.includes("DUCT")) return "Central";
  if (upper.includes("CENTRAL")) return "Central";
  if (upper.includes("BASEBOARD")) return "Baseboard";
  if (upper.includes("RADIANT")) return "Radiant";
  if (upper.includes("DUCTLESS")) return "Ductless";
  if (upper.includes("ELECTRIC")) return "Electric";
  if (upper.includes("GAS")) return "Gas";
  if (fuelType === "Electric") return "Electric";
  if (fuelType === "NaturalGas") return "Gas";
  if (fuelType === "Solar") return "Solar";
  return null;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";

  const heatText = safeText($, "#lblBuildingHeat");
  const acText = safeText($, "#lblBuildingAC");
  const fuelText = safeText($, "#lblBuildingFuel");

  const heating_fuel_type = mapHeatingFuel(fuelText);
  const heating_system_type = mapHeatingSystem(heatText, heating_fuel_type);
  let cooling_system_type = mapCoolingSystem(acText);
  let effective_heating_system_type = heating_system_type;

  const hvacCode =
    extractTwoDigitCode(acText) || extractTwoDigitCode(heatText) || null;
  if (hvacCode && hvacCode in HVAC_CODE_MAP) {
    const hvac = HVAC_CODE_MAP[hvacCode];
    if (!cooling_system_type && hvac.cool) cooling_system_type = hvac.cool;
    if (!effective_heating_system_type && hvac.heat)
      effective_heating_system_type = hvac.heat;
  }

  const utility = {
    cooling_system_type,
    heating_system_type: effective_heating_system_type,
    heating_fuel_type,
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
    request_identifier: parcelId,
  };

  const out = {};
  out[`property_${parcelId}`] = utility;

  const ownersDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const outPath = path.join(ownersDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
