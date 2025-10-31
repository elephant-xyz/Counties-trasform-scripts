// layoutMapping.js
// Reads input.html, parses with cheerio, extracts layout data, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function extractParcelId($) {
  // Updated selector based on the provided HTML
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function getNumber(text) {
  if (text == null) return null;
  const s = String(text).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n;
}

function extractBaseAndActualSF($) {
  let base = null;
  // In the provided HTML, there isn't a distinct "Actual SF" column for the main building.
  // "Base SF" seems to be the primary area. We'll use it for both.
  let actual = null;

  // Select the main building characteristics table
  const bldgTable = $("#parcelDetails_BldgTable table.parcelDetails_insideTable").first();

  if (bldgTable.length) {
    // Assuming the first data row (after the header) contains the main building info
    const firstDataRow = bldgTable.find("tr").eq(1); // eq(0) is header, eq(1) is first data row
    const tds = firstDataRow.find("td");

    // Check if there are enough columns
    if (tds.length >= 5) { // We need at least 5 columns for Base SF (index 4)
      const bldgDesc = $(tds[2]).text().trim(); // Bldg Desc is at index 2
      const baseSFText = $(tds[4]).text().trim(); // Base SF is at index 4

      // The sample HTML shows "SINGLE FAMILY" as Bldg Desc
      if (/SINGLE FAMILY/i.test(bldgDesc)) {
        base = getNumber(baseSFText);
        actual = base; // Use base as actual since actual SF is not explicitly given
      }
      // Fallback: if no specific description match, just take the first row's base SF
      if (base === null && firstDataRow.length > 0) {
        base = getNumber(baseSFText);
        actual = base;
      }
    }
  }
  return { base, actual };
}

function buildDefaultLayoutEntries(baseSF, actualSF) {
  // With no room-level data, create a single "Living Area" layout capturing size.
  const size = actualSF || baseSF || null;

  const layout = {
    space_type: "Living Area",
    space_index: 1,
    flooring_material_type: null,
    size_square_feet: size,
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

    // Optional fields
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: size,
    heated_area_sq_ft: size,
    livable_area_sq_ft: size,
  };

  return [layout];
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const { base, actual } = extractBaseAndActualSF($);
  const layouts = buildDefaultLayoutEntries(base, actual);

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "layout_data.json");

  const out = {};
  out[`property_${parcelId}`] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}