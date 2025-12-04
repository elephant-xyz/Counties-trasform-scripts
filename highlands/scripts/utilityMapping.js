// Utility extractor: reads input.html, parses with cheerio, writes owners/utilities_data.json
// Uses only cheerio for HTML parsing. Maps limited utilities from provided property HTML.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Add the ensureDir function here
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  return { $, html };
}

function extractPropertyId($) {
  const scripts = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scripts.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
  if (m) return m[1].trim();
  const h = $('h2:contains("Parcel")').first().text();
  const m2 = h.match(/Parcel\s+([^\s]+)/i);
  if (m2) return m2[1].trim();
  return "unknown_id";
}

function findNextTableWithHeader($, startElement, headerText) {
  let current = $(startElement);
  while (current.length) {
    current = current.next();
    if (!current.length) break;
    if (current.is("table")) {
      const firstHeader = current.find("thead th").first();
      if (firstHeader && firstHeader.text().trim() === headerText) return current;
    }
    const nested = current
      .find("table")
      .filter((__, tbl) => {
        const firstHeader = $(tbl).find("thead th").first();
        return firstHeader && firstHeader.text().trim() === headerText;
      })
      .first();
    if (nested.length) return nested;
  }
  return $();
}

function getBuildingElementsMaps($) {
  const results = [];
  $("b").each((_, el) => {
    const label = $(el).text().trim();
    const match = label.match(/^Building\s+(\d+)/i);
    if (!match) return;
    const buildingIndex = String(match[1]);
    const elementTable = findNextTableWithHeader($, el, "Element");
    const map = {};
    if (elementTable && elementTable.length) {
      $(elementTable)
        .find("tr")
        .each((__, tr) => {
          const tds = $(tr).find("td");
          if (tds.length >= 3) {
            const key = $(tds[0]).text().trim();
            const desc = $(tds[2]).text().trim();
            if (key) map[key] = desc;
          }
        });
    }
    results.push({ buildingIndex, elements: map });
  });
  return results;
}

function mapHeating(elements) {
  const fuel = (elements["Heating Fuel"] || "").toLowerCase();
  const type = (elements["Heating Type"] || "").toLowerCase();
  // Prioritize fuel mapping
  if (fuel.includes("electric")) return "Electric";
  if (fuel.includes("gas")) return "Gas";
  // Fallback on type
  if (type.includes("duct")) return "Central";
  return null;
}

function mapCooling(elements) {
  const cool = (elements["Air Cond. Type"] || "").toLowerCase();
  if (cool.includes("central")) return "CentralAir";
  if (cool.includes("window")) return "WindowAirConditioner";
  if (cool.includes("ductless") || cool.includes("mini")) return "Ductless";
  return null;
}

function buildUtilities($) {
  const id = extractPropertyId($);
  const buildingElements = getBuildingElementsMaps($);
  const buildings = buildingElements.map(({ buildingIndex, elements }) => {
    const heating = mapHeating(elements);
    const cooling = mapCooling(elements);
    return {
      building_index: buildingIndex,
      utility: {
        cooling_system_type: cooling || null,
        electrical_panel_capacity: null,
        electrical_wiring_type: null,
        electrical_wiring_type_other_description: null,
        heating_system_type: heating || null,
        hvac_condensing_unit_present: "Unknown", // Default to "Unknown" as per schema if not found
        hvac_unit_condition: null,
        hvac_unit_issues: null,
        plumbing_system_type: null,
        plumbing_system_type_other_description: null,
        public_utility_type: null,
        sewer_type: null,
        smart_home_features: null,
        smart_home_features_other_description: null,
        solar_inverter_visible: false,
        solar_panel_present: false,
        solar_panel_type: null,
        solar_panel_type_other_description: null,
        water_source_type: null,
      },
    };
  });
  if (!buildings.length) {
    buildings.push({
      building_index: "1",
      utility: {
        cooling_system_type: null,
        electrical_panel_capacity: null,
        electrical_wiring_type: null,
        electrical_wiring_type_other_description: null,
        heating_system_type: null,
        hvac_condensing_unit_present: "Unknown",
        hvac_unit_condition: null,
        hvac_unit_issues: null,
        plumbing_system_type: null,
        plumbing_system_type_other_description: null,
        public_utility_type: null,
        sewer_type: null,
        smart_home_features: null,
        smart_home_features_other_description: null,
        solar_inverter_visible: false,
        solar_panel_present: false,
        solar_panel_type: null,
        solar_panel_type_other_description: null,
        water_source_type: null,
      },
    });
  }
  return { id, buildings };
}

function main() {
  const { $ } = loadHtml();
  const { id, buildings } = buildUtilities($);
  const out = {};
  out[`property_${id}`] = { buildings };

  // Ensure the 'owners' directory exists before writing the file
  const ownersDirPath = path.resolve("owners");
  ensureDir(ownersDirPath);

  const outPath = path.resolve(ownersDirPath, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}
