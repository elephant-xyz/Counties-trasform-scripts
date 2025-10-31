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

function getElementsMap($) {
  let table;
  $("table").each((i, el) => {
    const ths = $(el).find("thead th");
    // Check for "Element" in the first header cell
    if (ths.length && $(ths[0]).text().trim() === "Element") {
      table = el;
      return false; // Stop iterating once the table is found
    }
  });
  const map = {};
  if (!table) return map;
  $(table)
    .find("tbody tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 3) {
        const key = $(tds[0]).text().trim();
        const desc = $(tds[2]).text().trim();
        map[key] = desc;
      }
    });
  return map;
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

function buildUtility($) {
  const id = extractPropertyId($);
  const elements = getElementsMap($);
  const heating = mapHeating(elements);
  const cooling = mapCooling(elements);

  const utility = {
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
  };

  return { id, utility };
}

function main() {
  const { $ } = loadHtml();
  const { id, utility } = buildUtility($);
  const out = {};
  out[`property_${id}`] = utility;

  // Ensure the 'owners' directory exists before writing the file
  const ownersDirPath = path.resolve("owners");
  ensureDir(ownersDirPath);

  const outPath = path.resolve(ownersDirPath, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}