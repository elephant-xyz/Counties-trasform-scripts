// Utility mapping script
// Reads input.json and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

function safeParse(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function extractParcelId(input) {
  // Try Owners HTML first
  try {
    const html = input?.OwnersAndGeneralInformation?.response || "";
    if (cheerio && html) {
      const $ = cheerio.load(html);
      const text = $.text();
      const m = text.match(/\b(\d{9,12})\b/);
      if (m) return m[1];
      const ta = $("textarea").first().text().trim();
      if (/^\d{9,12}$/.test(ta)) return ta;
    }
  } catch {}
  try {
    const qs = input?.Sales?.source_http_request?.multiValueQueryString?.parid;
    if (Array.isArray(qs) && qs[0]) return String(qs[0]);
  } catch {}
  const err = {
      type: "error",
      message: "Parcel ID not found",
      path: "",
    };
  throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
}

function buildUtility(input) {
  const buildings = input && input.Buildings && input.Buildings.response;
  let utilities = {};
  if (buildings && Array.isArray(buildings.rows) && buildings.rows.length > 0) {
    buildings.rows.forEach((building, bidx) => {
      // Defaults
      const util = {
        cooling_system_type: null,
        heating_system_type: null,
        public_utility_type: null,
        sewer_type: null,
        water_source_type: null,
        plumbing_system_type: null,
        plumbing_system_type_other_description: null,
        electrical_panel_capacity: null,
        electrical_panel_installation_date: null,
        electrical_rewire_date: null,
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
        hvac_capacity_kw: null,
        hvac_capacity_tons: null,
        hvac_equipment_component: null,
        hvac_equipment_manufacturer: null,
        hvac_equipment_model: null,
        hvac_installation_date: null,
        hvac_seer_rating: null,
        hvac_system_configuration: null,
        plumbing_fixture_count: null,
        plumbing_fixture_quality: null,
        plumbing_fixture_type_primary: null,
        plumbing_system_installation_date: null,
        public_utility_type_other_description: undefined,
        sewer_connection_date: null,
        smart_home_features_list: undefined,
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
      utilities[(bidx + 1).toString()] = util;
    });
  }
  return utilities;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const input = safeParse(inputPath);
  const parcelId = extractParcelId(input);
  const util = buildUtility(input);
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = util;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
})();
