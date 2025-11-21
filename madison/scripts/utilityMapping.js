// Utility mapping script
// Extracts HVAC, water, and sewer hints to build utility metadata for downstream processing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function asNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractBuildingAttributes($, $section) {
  const raw = {};
  $section.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const label =
      textTrim($tr.find("th strong").text()) || textTrim($tr.find("th").text());
    const value =
      textTrim($tr.find("td span").text()) || textTrim($tr.find("td").text());
    if (label) raw[label.toLowerCase()] = value || null;
  });
  return raw;
}

function parseBuildings($) {
  const buildings = [];
  const rows = $(
    "#ctlBodyPane_ctl11_mSection .module-content > .block-row",
  ).toArray();

  rows.forEach((row) => {
    const $row = $(row);
    const right = $row.find(
      "[id$='dynamicBuildingDataRightColumn_divSummary']",
    );
    if (!right.length) return;

    const raw = extractBuildingAttributes($, right);
    if (Object.keys(raw).length === 0) return;

    const building = {
      building_index: buildings.length + 1,
      raw,
    };
    Object.entries(raw).forEach(([key, value]) => {
      building[key] = value;
    });

    buildings.push(building);
  });

  return buildings;
}

function parseExtraFeatures($) {
  const features = [];
  const table = $("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
  table.find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td");
    if (!cells.length) return;
    const feature = {
      code: textTrim(cells.eq(0).text()) || null,
      description: textTrim(cells.eq(1).text()) || null,
      area_sq_ft: asNumber(cells.eq(3).text()),
    };
    if (feature.description) features.push(feature);
  });
  return features;
}

function getParcelId($) {
  const parcel = textTrim($(PARCEL_SELECTOR).text());
  return parcel || null;
}

function normalizeCoolingSystem(value) {
  if (!value) return null;
  const raw = value.toUpperCase();
  if (raw.includes("NONE")) return null;
  if (raw.includes("CENTRAL") || raw.includes("F AIR") || raw.includes("DUCT"))
    return "CentralAir";
  if (raw.includes("DUCTLESS")) return "Ductless";
  if (raw.includes("WINDOW")) return "WindowAirConditioner";
  if (raw.includes("GEOTHERM")) return "GeothermalCooling";
  if (raw.includes("FAN"))
    return raw.includes("WHOLE") ? "WholeHouseFan" : "CeilingFan";
  if (raw.includes("ZON")) return "Zoned";
  if (raw.includes("HYBRID")) return "Hybrid";
  if (raw.includes("ELECT")) return "Electric";
  return null;
}

function normalizeHeatingSystem(value) {
  if (!value) return null;
  const raw = value.toUpperCase();
  if (raw.includes("NONE")) return null;
  if (raw.includes("FORCED AIR") || raw.includes("F AIR")) return "Central";
  if (raw.includes("HEAT PUMP")) return "HeatPump";
  if (raw.includes("DUCTLESS")) return "Ductless";
  if (raw.includes("BASEBOARD")) return "Baseboard";
  if (raw.includes("RADIANT")) return "Radiant";
  if (raw.includes("SOLAR")) return "Solar";
  if (raw.includes("GAS"))
    return raw.includes("FURNACE") ? "GasFurnace" : "Gas";
  if (raw.includes("ELECTRIC FURNACE")) return "ElectricFurnace";
  if (raw.includes("ELECT"))
    return raw.includes("FURNACE") ? "ElectricFurnace" : "Electric";
  if (raw.includes("CENTRAL")) return "Central";
  return null;
}

function buildUtilityData($) {
  const utilities = [];
  const buildings = parseBuildings($);
  const extraFeatures = parseExtraFeatures($);

  if (buildings.length) {
    buildings.forEach((building) => {
      const cooling = normalizeCoolingSystem(building["air conditioning"]);
      const heating = normalizeHeatingSystem(building.heat);
      if (cooling || heating) {
        utilities.push({
          source: "building",
          building_index: building.building_index,
          cooling_system_type: cooling || null,
          heating_system_type: heating || null,
        });
      }
    });
  }

  const featureUtility = {
    source: "extra_feature",
    building_index: null,
    water_source_type: null,
    sewer_type: null,
  };

  extraFeatures.forEach((feature) => {
    const description = (feature.description || "").toUpperCase();
    if (description.includes("SEPTIC")) featureUtility.sewer_type = "Septic";
    if (description.includes("WELL")) featureUtility.water_source_type = "Well";
  });

  if (featureUtility.water_source_type || featureUtility.sewer_type) {
    utilities.push(featureUtility);
  }

  return { utilities };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }

  const data = buildUtilityData($);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = data;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
