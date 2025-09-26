// Layout extractor script
// Reads input.html, parses unit counts and creates representative layout entries per the layout schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function textNorm(s) {
  if (!s) return "";
  return s
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function getParcelId($) {
  const section = $("#ctlBodyPane_ctl01_mSection");
  let parcelId = null;
  section.find("table.tabular-data-two-column tbody tr").each((i, el) => {
    const label = textNorm($(el).find("th strong").text());
    const value = textNorm($(el).find("td span").text());
    if (label.toLowerCase() === "parcel id") parcelId = value;
  });
  return parcelId || "UNKNOWN_ID";
}

function collectUnitSummaries($) {
  // From Building Information we have several repeated blocks; take the first occurrence for unit mix.
  const units = [];
  $("#ctlBodyPane_ctl04_mSection")
    .find("div.two-column-blocks")
    .each((i, blk) => {
      const facts = {};
      $(blk)
        .find("table.tabular-data-two-column tbody tr")
        .each((j, row) => {
          const label = textNorm($(row).find("th strong").text());
          const value = textNorm($(row).find("td").text());
          if (label && value && !(label in facts)) facts[label] = value;
        });
      if (facts["Bedrooms"] || facts["Bathrooms"] || facts["Total Area"]) {
        units.push(facts);
      }
    });
  return units;
}

function makeDefaultLayout(space_type, idx) {
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

function buildLayouts(units) {
  const layouts = [];
  let idx = 1;
  // Create a layout per bedroom and per bathroom indicated by counts across all unit blocks.
  let totalBeds = 0;
  let totalBaths = 0;
  units.forEach((u) => {
    const beds = parseInt((u["Bedrooms"] || "0").replace(/[^0-9]/g, "")) || 0;
    const baths = parseInt((u["Bathrooms"] || "0").replace(/[^0-9]/g, "")) || 0;
    totalBeds += beds;
    totalBaths += baths;
  });
  // Create minimal bedroom layouts
  for (let i = 0; i < totalBeds; i++) {
    const l = makeDefaultLayout("Bedroom", idx++);
    layouts.push(l);
  }
  for (let i = 0; i < totalBaths; i++) {
    const l = makeDefaultLayout("Full Bathroom", idx++);
    layouts.push(l);
  }
  return layouts;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  const units = collectUnitSummaries($);
  const layouts = buildLayouts(units);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Wrote layout data for ${parcelId} -> ${outPath}, layouts: ${layouts.length}`,
  );
}

if (require.main === module) {
  main();
}
