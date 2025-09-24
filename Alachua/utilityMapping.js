// Utility mapping script
// Reads input.html, parses with cheerio, maps to utility schema, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const p = path.resolve("input.html");
  if (!fs.existsSync(p)) {
    throw new Error("input.html not found");
  }
  return fs.readFileSync(p, "utf8");
}

function text(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t.length ? t : null;
}

function getPropId($) {
  let propId = null;
  $("#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary table tr").each(
    (i, el) => {
      const label = text($(el).find("th strong").first().text());
      if (label && label.toLowerCase().includes("prop id")) {
        const val = text($(el).find("td span").first().text());
        if (val) propId = val;
      }
    },
  );
  return propId || "unknown";
}

function getValueByLabel($scope, labelWanted) {
  let found = null;
  $scope.find("tr").each((_, tr) => {
    const $tr = cheerio.load(tr);
    const label = text($tr("th strong").first().text());
    if (!label) return;
    if (label.toLowerCase() === labelWanted.toLowerCase()) {
      const spanVal = text($tr("td span").first().text());
      const tdVal = spanVal || text($tr("td").first().text());
      found = tdVal;
    }
  });
  return found;
}

function buildUtility($) {
  const section = $("#ctlBodyPane_ctl10_mSection");
  const right = section.find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary",
  );

  const heat = getValueByLabel(right, "Heat"); // ELECTRIC
  const hcv = getValueByLabel(right, "HC&V"); // FORCED AIR
  const hvac = getValueByLabel(right, "HVAC"); // CENTRAL

  let heating_system_type = null;
  if (/ELECTRIC/i.test(heat || "")) heating_system_type = "Electric";

  let cooling_system_type = null;
  if (/CENTRAL/i.test(hvac || "")) cooling_system_type = "CentralAir";

  const utility = {
    cooling_system_type: cooling_system_type,
    heating_system_type: heating_system_type,
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

  return utility;
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const propId = getPropId($);
  const utility = buildUtility($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");

  const data = {};
  data[`property_${propId}`] = utility;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
