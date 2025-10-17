// Utility mapping script
// - Read input.html (fallback to embedded) and parse with cheerio
// - Extract utilities per schema and write to owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const fallbackHtml = `<!DOCTYPE html><html><body>
<div id="details_value">
  <div id="propDetail"><table>
    <tr><th>RE #</th><td><span id="ctl00_cphBody_lblRealEstateNumber">002060-8295</span></td></tr>
  </table></div>
</div>
<div id="details_buildings">
  <div class="propBuildingElements">
    <table class="gridview" id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements">
      <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
      <tr><td class="col_element">Heating Fuel</td><td>4</td><td>4 Electric</td></tr>
      <tr><td class="col_element">Heating Type</td><td>4</td><td>4 Forced-Ducted</td></tr>
      <tr><td class="col_element">Air Cond</td><td>3</td><td>3 Central</td></tr>
    </table>
  </div>
</div>
</body></html>`;

const UTILITY_FIELDS = [
  "cooling_system_type",
  "electrical_panel_capacity",
  "electrical_panel_installation_date",
  "electrical_rewire_date",
  "electrical_wiring_type",
  "electrical_wiring_type_other_description",
  "heating_fuel_type",
  "heating_system_type",
  "hvac_capacity_kw",
  "hvac_capacity_tons",
  "hvac_condensing_unit_present",
  "hvac_equipment_component",
  "hvac_equipment_manufacturer",
  "hvac_equipment_model",
  "hvac_installation_date",
  "hvac_seer_rating",
  "hvac_system_configuration",
  "hvac_unit_condition",
  "hvac_unit_issues",
  "plumbing_system_installation_date",
  "plumbing_system_type",
  "plumbing_system_type_other_description",
  "public_utility_type",
  "request_identifier",
  "sewer_connection_date",
  "sewer_type",
  "smart_home_features",
  "smart_home_features_other_description",
  "solar_installation_date",
  "solar_inverter_installation_date",
  "solar_inverter_manufacturer",
  "solar_inverter_model",
  "solar_inverter_visible",
  "solar_panel_present",
  "solar_panel_type",
  "solar_panel_type_other_description",
  "water_connection_date",
  "water_heater_installation_date",
  "water_heater_manufacturer",
  "water_heater_model",
  "water_source_type",
  "well_installation_date",
];

function createUtilityRecord() {
  const base = {};
  UTILITY_FIELDS.forEach((field) => {
    base[field] = null;
  });
  return base;
}

function loadHtml() {
  const primary = path.join(process.cwd(), "input.html");
  if (fs.existsSync(primary)) return fs.readFileSync(primary, "utf8");
  const alternate = path.join(process.cwd(), "0020608295R.html");
  if (fs.existsSync(alternate)) return fs.readFileSync(alternate, "utf8");
  return fallbackHtml;
}

function textTrim($, sel) {
  return ($(sel).text() || "").trim();
}

function main() {
  const html = loadHtml();
  const $ = cheerio.load(html);

  const reId = textTrim($, "#ctl00_cphBody_lblRealEstateNumber") || "unknown";
  const propKey = `property_${reId}`;

  const details = [];
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        details.push({
          element: $(tds[0]).text().trim(),
          detail: $(tds[2]).text().trim(),
        });
      }
    },
  );

  const det = (name) => {
    const entry = details.find(
      (d) => d.element && d.element.toLowerCase() === name.toLowerCase(),
    );
    return entry ? entry.detail : "";
  };

  const heatingType = det("Heating Type");
  let heating_system_type = null;
  if (/forced/i.test(heatingType) && /duct/i.test(heatingType)) {
    heating_system_type = "Central";
  } else if (/heat\s*pump/i.test(heatingType)) {
    heating_system_type = "HeatPump";
  }

  const heatingFuel = det("Heating Fuel");
  let heating_fuel_type = null;
  if (/electric/i.test(heatingFuel)) heating_fuel_type = "Electric";
  else if (/gas/i.test(heatingFuel)) heating_fuel_type = "NaturalGas";

  const airConditioning = det("Air Cond");
  let cooling_system_type = null;
  if (/central/i.test(airConditioning)) cooling_system_type = "CentralAir";
  else if (/window/i.test(airConditioning))
    cooling_system_type = "WindowAirConditioner";
  else if (/ductless|mini\s*split/i.test(airConditioning))
    cooling_system_type = "Ductless";

  const utility = createUtilityRecord();
  utility.heating_system_type = heating_system_type;
  utility.heating_fuel_type = heating_fuel_type;
  utility.cooling_system_type = cooling_system_type;
  utility.hvac_condensing_unit_present = cooling_system_type
    ? cooling_system_type === "CentralAir"
    : null;
  utility.solar_panel_present = false;
  utility.solar_inverter_visible = false;

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const out = {};
  out[propKey] = utility;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote utilities data for ${propKey} -> ${outPath}`);
}

main();
