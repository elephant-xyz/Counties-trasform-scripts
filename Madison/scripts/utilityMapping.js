// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated CSS Selectors
const PARCEL_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
// The HTML provided does not have a section explicitly titled "Buildings" with HVAC information.
// The closest information related to utilities might be inferred from "Extra Features"
// if it mentions things like "WELL" or "SEPTIC".

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

  // In the provided HTML, there is no explicit "Buildings" section with HVAC details.
  // However, the "Extra Features" section contains entries like "SEPTIC" and "WELL/SEPTIC".
  // We can extract these to infer utility types.
  const extraFeaturesSection = $("#ctlBodyPane_ctl12_mSection");
  if (extraFeaturesSection.length) {
    const extraFeaturesTable = extraFeaturesSection.find("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
    extraFeaturesTable.find("tr").each((_, tr) => {
      const featureData = {};
      const cells = $(tr).find("th, td");
      featureData["Description"] = textTrim(cells.eq(1).text()); // Description is the second column
      if (Object.keys(featureData).length > 0) {
        buildings.push(featureData);
      }
    });
  }

  // If there were other sections with HVAC info, they would be added here.
  // For this specific HTML, we're primarily looking at "Extra Features" for utility hints.

  return buildings;
}

function inferHVAC(buildings) {
  let cooling_system_type = null;
  let heating_system_type = null;
  let hvac_system_configuration = null;
  let hvac_equipment_component = null;
  let hvac_condensing_unit_present = null;

  // For the provided HTML, there's no direct HVAC information.
  // We'll leave these as null as per the schema defaults.
  // If the HTML had fields like "Air Conditioning" or "Heat", we would process them here.

  return {
    cooling_system_type,
    heating_system_type,
    hvac_system_configuration,
    hvac_equipment_component,
    hvac_condensing_unit_present
  };
}

function buildUtilityRecord($, buildings) {
  const hvac = inferHVAC(buildings);
  const rec = {
    cooling_system_type: hvac.cooling_system_type,
    heating_system_type: hvac.heating_system_type,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: hvac.hvac_condensing_unit_present,
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
    hvac_equipment_component: hvac.hvac_equipment_component,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: hvac.hvac_system_configuration,
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

  // Infer sewer and water from "Extra Features"
  buildings.forEach(b => {
    const description = (b["Description"] || "").toUpperCase();
    if (description.includes("SEPTIC")) {
      rec.sewer_type = "Septic";
    }
    if (description.includes("WELL")) {
      rec.water_source_type = "Well";
    }
  });

  // For public utility type, we don't have direct info in this HTML.
  // It would typically be inferred from a "Public Utilities" section or similar.

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($); // This will now collect descriptions from "Extra Features"
  const utilitiesRecord = buildUtilityRecord($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = utilitiesRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}