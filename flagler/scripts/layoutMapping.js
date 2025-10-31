// Layout extractor: reads input.html and writes owners/layout_data.json per schema
// Uses cheerio for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function text($el) {
  if (!$el || $el.length === 0) return "";
  return $el.text().trim();
}

function loadHtml() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getPropId($) {
  const propId = text(
    $(
      "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue span",
    ),
  );
  return propId || "unknown";
}

function extractResidentialCounts($) {
  const facts = {};
  const section = $("#ctlBodyPane_ctl10_mSection");
  section.find(".tabular-data-two-column tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const key = text($(tds[0])).replace(/\s+/g, " ").trim();
      const val = text($(tds[1]));
      if (key) facts[key] = val;
    }
  });
  return facts;
}

function defaultLayout(spaceType, index) {
  return {
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: "1st Floor",
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

    // Optional dates
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    spa_installation_date: null,
    pool_installation_date: null,
  };
}

function mapLayouts($) {
  const propId = getPropId($);
  const facts = extractResidentialCounts($);
  const bedrooms = parseInt((facts["Bedrooms"] || "").replace(/\D/g, "")) || 0;
  const bathrooms =
    parseInt((facts["Bathrooms"] || "").replace(/\D/g, "")) || 0;

  const layouts = [];
  // Create a layout per bedroom
  for (let i = 1; i <= bedrooms; i++) {
    const l = defaultLayout("Bedroom", i);
    layouts.push(l);
  }
  // Create a layout per bathroom (assume full baths as we don't have half counts)
  for (let i = 1; i <= bathrooms; i++) {
    const l = defaultLayout("Full Bathroom", bedrooms + i);
    layouts.push(l);
  }

  // Use BAS area as gross living area for size hint if only one great room exists; keep sizes null to respect unknowns

  return { propId, layouts };
}

function writeOutput(propId, layouts) {
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${propId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return outPath;
}

(function main() {
  const $ = loadHtml();
  const { propId, layouts } = mapLayouts($);
  const outPath = writeOutput(propId, layouts);
  console.log(`Layout data written to: ${outPath}`);
})();
