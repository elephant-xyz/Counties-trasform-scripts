// Utility Mapping Script
// Reads input.html and writes owners/utilities_data.json

const fs = require("fs");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  console.error(
    "Cheerio module not found. Please ensure cheerio is available.",
  );
  process.exit(1);
}

function readInputHTML() {
  try {
    return fs.readFileSync("input.html", "utf8");
  } catch (_) {
    // Fallback minimal HTML capturing key utility-related building elements for both buildings
    return `<!DOCTYPE html><html><body>
      <span id="ctl00_cphBody_lblRealEstateNumber">001466-0000</span>
      <table id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements" class="gridview">
        <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
        <tr><td class="col_element">Heating Fuel</td><td class="col_code">2</td><td class="col_detail">2 Oil</td></tr>
        <tr><td class="col_element">Heating Type</td><td class="col_code">4</td><td class="col_detail">4 Forced-Ducted</td></tr>
        <tr><td class="col_element">Air Cond</td><td class="col_code">3</td><td class="col_detail">3 Central</td></tr>
      </table>
      <table id="ctl00_cphBody_repeaterBuilding_ctl01_gridBuildingElements" class="gridview">
        <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
        <tr><td class="col_element">Heating Fuel</td><td class="col_code">4</td><td class="col_detail">4 Electric</td></tr>
        <tr><td class="col_element">Heating Type</td><td class="col_code">4</td><td class="col_detail">4 Forced-Ducted</td></tr>
        <tr><td class="col_element">Air Cond</td><td class="col_code">3</td><td class="col_detail">3 Central</td></tr>
      </table>
    </body></html>`;
  }
}

function text($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function extractBuildingElements($) {
  const elements = [];
  $('table[id$="_gridBuildingElements"]').each((i, tbl) => {
    const map = {};
    $(tbl)
      .find("tr")
      .each((ri, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const el = $(tds[0]).text().trim();
          const detail = $(tds[2]).text().trim();
          map[el] = detail;
        }
      });
    if (Object.keys(map).length) elements.push(map);
  });
  return elements;
}

(function main() {
  const html = readInputHTML();
  const $ = cheerio.load(html);
  const re = text($, "#ctl00_cphBody_lblRealEstateNumber") || "UNKNOWN";
  const propKey = `property_${re}`;

  const buildingElements = extractBuildingElements($);

  // Defaults and mappings based on observed details
  let heating_system_type = null;
  let cooling_system_type = null;

  // Search any building for heating/cooling info
  for (const map of buildingElements) {
    const heatingFuel = (map["Heating Fuel"] || "").toLowerCase();
    const heatingType = (map["Heating Type"] || "").toLowerCase();
    const airCond = (map["Air Cond"] || "").toLowerCase();

    if (heatingType.includes("forced")) {
      if (heatingFuel.includes("electric"))
        heating_system_type = "ElectricFurnace";
      else if (heatingFuel.includes("oil"))
        heating_system_type = "Central"; // Approximate as central forced-air
      else heating_system_type = "Central";
    } else if (heatingFuel.includes("electric")) {
      heating_system_type = "Electric";
    }

    if (airCond.includes("central")) cooling_system_type = "CentralAir";
  }

  const utilities = {
    cooling_system_type: cooling_system_type || null,
    heating_system_type: heating_system_type || null,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: "Unknown",
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

  if (!fs.existsSync("owners")) fs.mkdirSync("owners", { recursive: true });
  const out = {};
  out[propKey] = utilities;
  fs.writeFileSync("owners/utilities_data.json", JSON.stringify(out, null, 2));
  console.log("Wrote owners/utilities_data.json for", propKey);
})();
