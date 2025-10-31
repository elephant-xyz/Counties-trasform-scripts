// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  // Identify parcel identifier from HTML

  const parcelHeader = $("section.title h1").first().text().trim();
  // console.log("parcelHeader>>>",parcelHeader)

  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);  // Capture everything after "Parcel"
  // console.log("m>>>", m);

  if (m) parcelIdentifier = m[1];

  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  // console.log("Final parcelIdentifier>>>", parcelIdentifier);
  return parcelIdentifier;
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propId = extractPropertyId($);

  function mapCooling(detail) {
    const d = (detail || "").toUpperCase();
    if (d.includes("CEILING FAN")) return "CeilingFan";
    if (d.includes("CEILING FANS")) return "CeilingFans";
    if (d.includes("ELECTRIC")) return "Electric";
    if (d.includes("DUCTLESS")) return "Ductless";
    if (d.includes("HYBRID")) return "Hybrid";
    if (d.includes("CENTRAL") || d.includes("CENTRAL AIR") || d.includes("ROOF TOP")) return "CentralAir";
    if (d.includes("WINDOW") || d.includes("WINDOW AC")) return "WindowAirConditioner";
    if (d.includes("WHOLE HOUSE FAN")) return "WholeHouseFan";
    if (d.includes("GEOTHERMAL")) return "GeothermalCooling";
    if (d.includes("ZONED") || d.includes("ZONE")) return "Zoned";
    return null;
  }
  function mapHeating(detail) {
    const d = (detail || "").toUpperCase();
    if (d.includes("ELECTRIC FURNACE") || d.includes("ELEC FURNACE")) return "ElectricFurnace";
    if (d.includes("ELECTRIC") || d.includes("ELEC")) return "Electric";
    if (d.includes("GAS FURNACE") || d.includes("FURNACE")) return "GasFurnace";
    if (d.includes("DUCTLESS")) return "Ductless";
    if (d.includes("RADIANT") || d.includes("FLOOR HEAT")) return "Radiant";
    if (d.includes("SOLAR")) return "Solar";
    if (d.includes("HEAT PUMP") || d.includes("HP")) return "HeatPump";
    if (d.includes("AIR DUCTED") || d.includes("CENTRAL")) return "Central";
    if (d.includes("BASEBOARD")) return "Baseboard";
    if (d.includes("GAS") || d.includes("NATURAL GAS")) return "Gas";
    return null;
  }

  const utilities = [];
  let utilityIndex = 1;

  $("section.buildings .building-data").each((buildingIndex, buildingElement) => {
    let ac = "";
    let ht = "";
    $(buildingElement)
      .find("div.se table tbody tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        const type = $(tds[1]).text().trim();
        const details = $(tds[3]).text().trim();
        if (type.toLowerCase() === "air conditioning") ac = details;
        if (type.toLowerCase() === "heating type") ht = details;
      });

    const utility = {
      source_http_request: {
        method: "GET",
        url: "https://example.com/utility-data",
      },
      request_identifier: `${propId}_utility_${utilityIndex}`,
      cooling_system_type: mapCooling(ac),
      heating_system_type: mapHeating(ht),
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
      building_number: buildingIndex + 1,
      utility_index: utilityIndex,
    };

    utilities.push(utility);
    utilityIndex++;
  });

  const outObj = {};
  outObj[`property_${propId}`] = { utilities };

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/utilities_data.json"),
    JSON.stringify(outObj, null, 2)
  );
  console.log(
    "Wrote owners/utilities_data.json for",
    propId,
    "with",
    utilities.length,
    "utilities"
  );
}

run();
