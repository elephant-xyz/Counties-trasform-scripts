// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated CSS Selectors
const PARCEL_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const BUILDING_SECTION_TITLE = "Buildings"; // This title is not present in the provided HTML, so this section will likely not be found.
                                            // If "Buildings" section exists in other HTML files, this selector might need adjustment.
                                            // For the provided HTML, there is no "Buildings" section.
                                            // I've kept the logic for it, assuming it might appear in other similar HTML structures.

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  // In the provided HTML, there is no explicit "Buildings" section with a header.
  // The closest relevant information might be in "Valuation" or "Land Information"
  // or "Extra Features" if they contain building-like data.
  // For the current HTML, I'll assume we're looking for a section that *might* contain building details
  // if it were present. The original code was looking for a section with a specific title.
  // Since "Buildings" is not found, this function will return an empty array for the given HTML.
  // If you have a different HTML where "Buildings" section exists, the original logic might work.

  // The original selector for buildings was looking for specific divs within a section titled "Buildings".
  // Since that section is not present, this part of the code will not find any buildings.
  // If building information is located elsewhere in the HTML, this function needs to be re-written
  // to target those specific elements.

  // Example: If building details were under "Valuation" and had specific labels like "Building Value"
  // you would parse that table. But that's not a "building" in the sense of multiple units.

  // For the provided HTML, there are no distinct "buildings" sections with bedroom/bathroom counts.
  // Therefore, this function will return an empty array.
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function defaultLayout(space_type, idx) {
  return {
    space_type,
    space_index: idx,
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
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
  };
}

function buildLayoutsFromBuildings(buildings) {
  // Since collectBuildings will return an empty array for the provided HTML,
  // totalBeds and totalBaths will be 0, and layouts will be an empty array.
  let totalBeds = 0;
  let totalBaths = 0;
  buildings.forEach((b) => {
    totalBeds += toInt(b["Bedrooms"]);
    totalBaths += toInt(b["Bathrooms"]);
  });

  const layouts = [];
  let idx = 1;
  for (let i = 0; i < totalBeds; i++) {
    layouts.push(defaultLayout("Bedroom", idx++));
  }
  for (let i = 0; i < totalBaths; i++) {
    layouts.push(defaultLayout("Full Bathroom", idx++));
  }
  return layouts;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($); // This will be empty for the provided HTML
  const layouts = buildLayoutsFromBuildings(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}