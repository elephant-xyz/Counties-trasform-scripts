// Layout extractor: reads input.html, parses with cheerio, writes owners/layout_data.json
// Uses only cheerio for HTML parsing. Creates per-room layout objects when identifiable; otherwise returns empty layouts array.

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

function parseNumber(val) {
  if (val == null) return null;
  const v = String(val).replace(/,/g, "").trim();
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function extractBasSqft($) {
  const header = $('b:contains("Subareas")').first();
  if (!header.length) return null;
  const table = header
    .nextAll(".table-responsive")
    .first()
    .find("table")
    .first();
  if (!table.length) return null;
  let bas = null;
  table.find("tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const type = $(tds[0]).text().trim();
    if (type.includes("BAS")) {
      const gross = parseNumber($(tds[1]).text());
      if (gross != null) bas = gross;
    }
  });
  return bas;
}

function buildLayouts($) {
  const elements = getElementsMap($);
  const bedrooms = parseNumber(elements["Bedrooms"]);
  const bas = extractBasSqft($);
  const layouts = [];

  // If bedrooms > 0, add individual Bedroom layouts
  if (bedrooms && bedrooms > 0) {
    for (let i = 1; i <= bedrooms; i++) {
      layouts.push({
        space_type: "Bedroom",
        space_index: i,
        flooring_material_type: null,
        size_square_feet: null,
        floor_level: null,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        is_finished: true,
        furnished: null,
        paint_condition: null,
        flooring_wear: null,
        clutter_level: null,
        visible_damage: null,
        countertop_material: null,
        cabinet_style: null,
        fixture_finish_quality: null,
        design_style: null,
        natural_light_quality: null,
        decor_elements: null,
        pool_type: null,
        pool_equipment: null,
        spa_type: null,
        safety_features: null,
        view_type: null,
        lighting_features: null,
        condition_issues: null,
        is_exterior: false,
        pool_condition: null,
        pool_surface_type: null,
        pool_water_quality: null,
      });
    }
  }

  // If no identifiable rooms, leave layouts empty; creating generic rooms risks schema inaccuracies.
  return layouts;
}

function main() {
  const { $ } = loadHtml();
  const id = extractPropertyId($);
  const layouts = buildLayouts($);
  const out = {};
  out[`property_${id}`] = { layouts };

  // Ensure the 'owners' directory exists before writing the file
  const ownersDirPath = path.resolve("owners");
  ensureDir(ownersDirPath);

  const outPath = path.resolve(ownersDirPath, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}