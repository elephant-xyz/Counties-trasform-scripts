// Utility mapping script
// Reads input.html, parses with cheerio, outputs owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function parseSuwanneeTables($) {

  const buildingsTable = $('#parcelDetails_BldgTable')
    .find('table.parcelDetails_insideTable')
    .first();
  const extraFeaturesTable = $('#parcelDetails_XFOBTable')
    .find('table.parcelDetails_insideTable')
    .first();

  return {
    buildings: parseDataTable($, buildingsTable),
    extraFeatures: parseDataTable($, extraFeaturesTable),
  };
}

function parseDataTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return [];
  }

  const headerCells = rows.first().find('td, th');
  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, cell) => {
      const headerText = $(cell).text().replace(/\*/g, '');
      return normalizeKey(headerText) || `column${idx + 1}`;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < headers.length) {
        return null;
      }

      const record = {};
      let hasValue = false;

      headers.forEach((header, idx) => {
        const cell = cells.eq(idx);
        const value = formatCellValue(cell);
        if (value !== null) {
          hasValue = true;
        }
        record[header] = value;
      });

      return hasValue ? record : null;
    })
    .get()
    .filter(Boolean);
}

function formatCellValue(cell) {
  if (!cell || !cell.length) {
    return null;
  }

  const text = cell
    .text()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    return text;
  }

  const link = cell.find('a').attr('href');
  if (link) {
    return link;
  }

  return null;
}

function normalizeKey(text) {
  if (!text) {
    return '';
  }

  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }

  return cleaned
    .split(' ')
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function toIntRounded(val) {
  if (!val && val !== 0 && val !== "0") {
    return null;
  }
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function buildUtilities($) {  
  const suwanneLayouts = parseSuwanneeTables($);
  const buildingsTable = suwanneLayouts["buildings"];
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
  const $ = loadHtml();
  const parcelId = extractParcelId($);
  const utilities = buildUtilities($);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = utilities;

  const outPath = path.join(outDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating utilities data:", e.message);
    process.exit(1);
  }
}
