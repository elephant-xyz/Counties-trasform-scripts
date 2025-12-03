// Layout mapping script
// Reads input.html, extracts layout-related data and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractPropertyId($) {
  const id = $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text().trim();
  if (id) return id;
  const resultsId = $(
    "#MainContent_gvParcelResults tr:nth-child(2) td:first-child",
  )
    .text()
    .trim();
  return resultsId || "unknown";
}

function getBedsBaths($) {
  let beds = null;
  let baths = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 5) {
      const bedbath = $(tds[4]).text().trim();
      if (bedbath && /\d+\s*\/\s*\d+/.test(bedbath)) {
        const parts = bedbath.split("/");
        beds = parseInt(parts[0], 10);
        baths = parseInt(parts[1], 10);
      }
    }
  });
  return { beds, baths };
}

function getBaseArea($) {
  let base = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 4) {
      const areaText = $(tds[3]).text().trim();
      if (areaText && /\d+\s*\/\s*\d+/.test(areaText)) {
        const parts = areaText.split("/");
        base = parseInt(parts[0].replace(/[^0-9]/g, ""), 10);
      }
    }
  });
  return base;
}

function makeDefaultLayout(spaceType, index, size) {
  // Fill required fields with nulls/defaults when not known
  return {
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: size == null ? null : size,
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
    cabinet_style: null,
    countertop_material: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    size_square_feet: size == null ? null : size,
  };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);

  const { beds, baths } = getBedsBaths($);
  const baseArea = getBaseArea($);

  const layouts = [];
  if (beds != null) {
    for (let i = 1; i <= beds; i++) {
      layouts.push(makeDefaultLayout("Bedroom", i, null));
    }
  }
  if (baths != null) {
    for (let i = 1; i <= baths; i++) {
      layouts.push(
        makeDefaultLayout("Full Bathroom", layouts.length + 1, null),
      );
    }
  }
  
  // Add a Living Room with base area as an approximation if available
  layouts.push(makeDefaultLayout("Living Room", layouts.length + 1, baseArea));

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

if (require.main === module) {
  main();
}
