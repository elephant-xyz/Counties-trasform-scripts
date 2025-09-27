// Utility mapping script
// Reads input.html, parses with cheerio, and writes owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractParcelId($) {
  let parcelHeader = null;
  $("h2").each((i, el) => {
    const txt = $(el).text().trim();
    if (/^Parcel\s+/i.test(txt)) parcelHeader = txt;
  });
  let id = null;
  if (parcelHeader) id = parcelHeader.replace(/^.*Parcel\s+/i, "").trim();
  if (!id) {
    const scriptText = $("script")
      .map((i, el) => $(el).html() || "")
      .get()
      .join("\n");
    const m = scriptText.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
    if (m) id = m[1];
  }
  return id || "UNKNOWN_ID";
}

function run() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = extractParcelId($);

  // Inspect Buildings -> Element table for HVAC hints
  let heatingFuel = null;
  let heatingType = null;
  let acType = null;

  const elementTables = $("h3")
    .filter((i, el) => /Buildings/i.test($(el).text()))
    .first()
    .parent()
    .find("table")
    .filter((i, el) =>
      /Element\s*Code\s*Description/i.test($(el).find("thead").text()),
    );

  if (elementTables.length > 0) {
    const tbl = elementTables.first();
    tbl.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 3) {
        const label = $(tds[0]).text().trim();
        const desc = $(tds[2]).text().trim();
        if (/^Heating Fuel$/i.test(label)) heatingFuel = desc || heatingFuel;
        if (/^Heating Type$/i.test(label)) heatingType = desc || heatingType;
        if (/^Air Cond\. Type$/i.test(label)) acType = desc || acType;
      }
    });
  }

  function mapCooling(acType) {
    if (!acType) return null;
    const d = acType.toLowerCase();
    if (d.includes("central")) return "CentralAir";
    if (d.includes("window")) return "WindowAirConditioner";
    if (d.includes("ductless") || d.includes("mini")) return "Ductless";
    return null;
  }

  function mapHeating(heatType, fuel) {
    const ht = (heatType || "").toLowerCase();
    const f = (fuel || "").toLowerCase();
    if (ht.includes("force air") || ht.includes("duct")) {
      if (f.includes("gas")) return "GasFurnace";
      if (f.includes("electric")) return "ElectricFurnace";
      return "Central";
    }
    if (f.includes("electric")) return "Electric";
    if (f.includes("gas")) return "Gas";
    return null;
  }

  const utilities = {
    cooling_system_type: mapCooling(acType),
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: mapHeating(heatingType, heatingFuel),
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: acType ? "Yes" : null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_inverter_visible: false,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    water_source_type: null,
    well_installation_date: null,
  };

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const wrapped = {};
  wrapped[`property_${parcelId}`] = utilities;
  fs.writeFileSync(outPath, JSON.stringify(wrapped, null, 2), "utf-8");
  console.log(`Wrote ${outPath}`);
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exit(1);
}
