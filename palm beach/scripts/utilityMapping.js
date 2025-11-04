// utilityMapping.js
// Parses input.html with cheerio and outputs utilities data per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

function getText($, selector) {
  const el = $(selector).first();
  return el.length ? el.text().trim() : "";
}

function findValueByLabel($, scope, labelText) {
  let value = "";
  $(scope)
    .find("tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const labelTd = $tr.find("td.label").first();
      const valTd = $tr.find("td.value").first();
      if (labelTd.length && valTd.length) {
        const lbl = labelTd.text().replace(/\s+/g, " ").trim().toLowerCase();
        if (lbl.includes(labelText.toLowerCase())) {
          value = valTd.text().replace(/\s+/g, " ").trim();
          return false;
        }
      }
    });
  return value;
}

function mapCooling(raw) {
  const txt = (raw || "").toLowerCase();
  if (txt.includes("htg & ac") || txt.includes("ac") || txt.includes("air"))
    return "CentralAir";
  return null;
}

function mapHeatingType(heatType, heatFuel) {
  const ht = (heatType || "").toLowerCase();
  const fuel = (heatFuel || "").toLowerCase();
  if (ht.includes("forced") || ht.includes("duct")) {
    if (fuel.includes("electric")) return "ElectricFurnace";
    if (fuel.includes("gas")) return "GasFurnace";
    return "Central";
  }
  if (fuel.includes("electric")) return "Electric";
  if (fuel.includes("gas")) return "Gas";
  return null;
}

function run() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  // Extract property id
  let pcnText = getText($, "#MainContent_lblPCN");
  if (!pcnText) {
    pcnText = $("td.label:contains('Parcel Control Number')")
      .next(".value")
      .text()
      .trim();
  }
  const propertyId = digitsOnly(pcnText);
  const propKey = `property_${propertyId || "unknown"}`;

  // Structural Elements table
  const structHeader = $("h3:contains('Structural Element')").first();
  const structScope = structHeader.length
    ? structHeader.next(".building_col")
    : null;

  const airCond = structScope
    ? findValueByLabel($, structScope, "Air Condition Desc.")
    : "";
  const heatType = structScope
    ? findValueByLabel($, structScope, "Heat Type")
    : "";
  const heatFuel = structScope
    ? findValueByLabel($, structScope, "Heat Fuel")
    : "";

  const data = {
    cooling_system_type: mapCooling(airCond),
    heating_system_type: mapHeatingType(heatType, heatFuel),
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
  };

  const outObj = {};
  outObj[propKey] = data;

  const ownersDir = path.resolve("owners");
  const dataDir = path.resolve("data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(ownersDir, "utilities_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(dataDir, "utilities_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );

  console.log("utilities_data.json written for", propKey);
}

if (require.main === module) {
  run();
}
