// Utility data extractor using cheerio
// Reads input.html and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadInput() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getValueFromSection($, sectionSelector, label) {
  let val = null;
  const $section =
    typeof sectionSelector === "string" ? $(sectionSelector) : sectionSelector;
  $section.find("tr").each((_, tr) => {
    const th = $(tr).find("th strong").first().text().trim();
    if (th === label) {
      const tdText = $(tr)
        .find("td")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();
      if (tdText) val = tdText;
    }
  });
  return val;
}

function extractParcelId($) {
  let pid = getValueFromSection($, "#ctlBodyPane_ctl00_mSection", "Parcel ID");
  if (pid) pid = pid.replace(/\s+/g, "").trim();
  return pid || "unknown_id";
}

function extractUtilities($) {
  const sectionSel = "#ctlBodyPane_ctl05_mSection";
  const heatingType =
    getValueFromSection($, sectionSel, "Heating Type") ||
    getValueFromSection($, sectionSel, "Heat");

  let heating = null;
  if (heatingType) {
    const s = heatingType.toLowerCase();
    if (s.includes("air") && s.includes("duct")) heating = "Central";
  }

  const util = {
    cooling_system_type: null,
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

    hvac_system_configuration: null,
    hvac_equipment_component: null,
    hvac_unit_issues_other: null,
  };

  return util;
}

(function main() {
  const $ = loadInput();
  const parcelId = extractParcelId($);
  const utilities = extractUtilities($);

  const data = {};
  data[`property_${parcelId}`] = utilities;

  fs.mkdirSync(path.dirname("owners/utilities_data.json"), { recursive: true });
  fs.writeFileSync("owners/utilities_data.json", JSON.stringify(data, null, 2));
  console.log("Wrote owners/utilities_data.json for", `property_${parcelId}`);
})();
