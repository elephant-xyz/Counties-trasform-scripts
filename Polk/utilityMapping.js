// Utility Mapping Script
// Reads input.html, parses with cheerio, extracts utility fields per schema, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function getParcelId($) {
  const dataId = $("script#display\\.js").attr("data-parcelid");
  if (dataId && /\d{6,}/.test(dataId)) return dataId.trim();
  const html = $.html();
  const m = html.match(/DB:\s*(\d{12,})/);
  if (m) return m[1];
  const m2 = html.match(/strap=(\d{12,})/);
  if (m2) return m2[1];
  return "unknown_property_id";
}

function detectHVAC($) {
  // Look for CNTRL HEATING / AC row; value often in the second TD
  let hvac = null;
  $("#bldngs table").each((_, t) => {
    $(t)
      .find("tr")
      .each((__, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().trim().toUpperCase();
          const val2 = $(tds[1]).text().trim().toUpperCase();
          const val3 =
            tds.length >= 3 ? $(tds[2]).text().trim().toUpperCase() : "";
          if (label.includes("CNTRL HEATING")) {
            const v = val2 || val3;
            if (v === "Y" || v === "N") hvac = v;
          }
        }
      });
  });
  return hvac;
}

function ensureEnum(value, allowed) {
  if (value == null) return null;
  return allowed.includes(value) ? value : null;
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  const hvacFlag = detectHVAC($);

  const cooling_system_type = ensureEnum(
    hvacFlag === "Y" ? "CentralAir" : null,
    [
      "CeilingFans",
      "Electric",
      "Ductless",
      "Hybrid",
      "CentralAir",
      "WindowAirConditioner",
      "WholeHouseFan",
      "CeilingFan",
      "GeothermalCooling",
      "Zoned",
      null,
    ],
  );
  const heating_system_type = ensureEnum(hvacFlag === "Y" ? "Central" : null, [
    "ElectricFurnace",
    "Electric",
    "GasFurnace",
    "Ductless",
    "Radiant",
    "Solar",
    "HeatPump",
    "Central",
    "Baseboard",
    "Gas",
    null,
  ]);

  const obj = {
    cooling_system_type,
    heating_system_type,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present:
      hvacFlag === "Y" ? "Yes" : hvacFlag === "N" ? "No" : null,
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

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = obj;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in utilityMapping:", err.message);
    process.exit(1);
  }
}
