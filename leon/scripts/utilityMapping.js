// Utility mapping script
// Reads input.html, parses with cheerio, extracts utility info, writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
}

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

function parseLeonBuildings($) {
  const rows = $('tbody.building-table tr');

  return rows
    .map((_, row) => extractBuildingRow($, row))
    .get()
    .filter(Boolean);
}

function extractBuildingRow($, row) {
  const $row = $(row);
  const cells = $row.children('th, td');
  if (cells.length < 6) {
    return null;
  }

  return {
    number: parseInteger($row.attr('data-number') || cells.eq(0).text()),
    card: parseInteger($row.attr('data-card')),
    buildingUse: getCleanText(cells.eq(1)),
    buildingType: getCleanText(cells.eq(2)),
    yearBuilt: parseInteger(cells.eq(3).text()),
    heatedCooledSqFt: parseInteger(cells.eq(4).text()),
    auxiliarySqFt: parseInteger(cells.eq(5).text()),
  };
}

function getCleanText(cell) {
  const text = typeof cell.text === 'function' ? cell.text() : String(cell || '');
  const value = text.replace(/\s+/g, ' ').trim();
  return value || null;
}

function parseInteger(value) {
  if (value == null) {
    return null;
  }

  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) {
    return null;
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function buildUtilities($) {  
  const buildingsTable = parseLeonBuildings($);
  const utilities = {};
  for (let index = 0; index < buildingsTable.length; index++) {
    const building = buildingsTable[index];
    const buildIndex = index + 1;
    utilities[buildIndex.toString()] = {
      cooling_system_type: null,
      heating_system_type: null,
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
  }

  return utilities;
}



function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) throw new Error("ParcelId not found");

  const utilities = buildUtilities($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: utilities };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
