// Utility data extractor using Cheerio
// Reads: input.html
// Writes: owners/utilities_data.json and data/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textClean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function extractPropertyId($) {
  const h1 = $("h1").first().text();
  const m = h1.match(/Property Record Information for\s+(\d+)/i);
  return m ? m[1] : "unknown";
}

function findTableByCaption($, captionText) {
  let target = null;
  $("table").each((_, t) => {
    const cap = $(t).find("caption").first().text();
    if (cap && cap.toLowerCase().includes(captionText.toLowerCase())) {
      target = t;
      return false;
    }
  });
  return target;
}

function parseUtilities($) {
  const compTbl = findTableByCaption($, "Building Component Information");
  const results = [];
  if (compTbl) {
    $(compTbl)
      .find("tbody tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 3) return;
        const desc = textClean($(tds).eq(2).text());
        results.push(desc);
      });
  }
  return results;
}

function mapToUtilities($) {
  const pid = extractPropertyId($);
  const comps = parseUtilities($);

  // Defaults per schema required fields
  let cooling_system_type = null;
  let heating_system_type = null;
  let plumbing_system_type = null;
  let sewer_type = null;
  let water_source_type = null;
  let electrical_panel_capacity = null;
  let electrical_wiring_type = null;
  let hvac_condensing_unit_present = null;
  let solar_panel_present = false;
  let solar_panel_type = null;
  let smart_home_features = null;
  let hvac_unit_condition = null;
  let solar_inverter_visible = false;
  let hvac_unit_issues = null;

  // Infer from component list
  if (comps.some((d) => /Warmed & Cooled Air/i.test(d))) {
    cooling_system_type = "CentralAir";
    heating_system_type = "Central";
    hvac_condensing_unit_present = "Yes";
    hvac_unit_condition = "Good";
  }

  if (comps.some((d) => /Water & Waste Water Service/i.test(d))) {
    sewer_type = "Public";
    water_source_type = "Public";
    plumbing_system_type = "PVC";
  }

  // Construct object satisfying required fields (fill nulls where allowed)
  const out = {
    cooling_system_type: cooling_system_type,
    heating_system_type: heating_system_type,
    public_utility_type: null,
    sewer_type: sewer_type,
    water_source_type: water_source_type,
    plumbing_system_type: plumbing_system_type,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: electrical_panel_capacity,
    electrical_wiring_type: electrical_wiring_type,
    hvac_condensing_unit_present: hvac_condensing_unit_present,
    electrical_wiring_type_other_description: null,
    solar_panel_present: solar_panel_present,
    solar_panel_type: solar_panel_type,
    solar_panel_type_other_description: null,
    smart_home_features: smart_home_features,
    smart_home_features_other_description: null,
    hvac_unit_condition: hvac_unit_condition,
    solar_inverter_visible: solar_inverter_visible,
    hvac_unit_issues: hvac_unit_issues,

    // Optional known-null dates/fields
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

  const data = {};
  data[`property_${pid}`] = out;
  return data;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const result = mapToUtilities($);

  ensureDir(path.join(process.cwd(), "owners"));
  ensureDir(path.join(process.cwd(), "data"));
  fs.writeFileSync(
    path.join("owners", "utilities_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join("data", "utilities_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  console.log(
    "Utility mapping complete for keys:",
    Object.keys(result).join(","),
  );
}

if (require.main === module) {
  main();
}
