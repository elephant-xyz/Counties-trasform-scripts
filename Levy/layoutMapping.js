// Layout mapping script
// Reads input.html, extracts layout and room counts using cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textOf($, el) {
  return ($(el).text() || "").trim();
}

function safeInt(val) {
  if (val == null) return null;
  const n = parseInt(String(val).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  if (!fs.existsSync(inputPath)) {
    console.error("input.html not found");
    process.exit(1);
  }
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId =
    textOf($, $("#ctlBodyPane_ctl02_ctl01_lblParcelID")) || "unknown";
  const propertyKey = `property_${parcelId}`;

  const layouts = [];
  let spaceIndex = 1;

  // Extract GLA/base area from Building Information sub-area table
  const subAreaTable = $("#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_subArea");
  let baseSize = null;
  if (subAreaTable && subAreaTable.length) {
    subAreaTable.find("tbody > tr").each((_, tr) => {
      const desc = textOf($, $(tr).find("th"));
      if (/^BASE$/i.test(desc)) {
        const actual = textOf($, $(tr).find("td").eq(1));
        baseSize = safeInt(actual);
      }
    });
  }

  // Baths count from Building Information
  const bathsRow = $("#ctlBodyPane_ctl08_mSection table")
    .filter((_, t) => {
      return (
        $(t)
          .find("th strong")
          .filter((__, s) => /Baths/i.test($(s).text())).length > 0
      );
    })
    .first();
  let numBaths = 0;
  if (bathsRow.length) {
    // find the row labeled Baths
    let found = false;
    bathsRow.find("tr").each((_, tr) => {
      const th = $(tr).find("th strong").first();
      if (/Baths/i.test(textOf($, th))) {
        const td = $(tr).find("td").first();
        numBaths = safeInt(textOf($, td)) || 0;
        found = true;
      }
    });
  }

  // Create layout entries: 1 Living Room, 1 Kitchen, 2 Full Bathrooms (if baths>=2)
  const defaultLayout = (space_type, size) => ({
    space_type,
    space_index: spaceIndex++,
    flooring_material_type: null,
    size_square_feet: size || null,
    floor_level: "1st Floor",
    has_windows: true,
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
  });

  layouts.push(defaultLayout("Living Room", null));
  layouts.push(defaultLayout("Kitchen", null));

  for (let i = 0; i < numBaths; i++) {
    layouts.push(defaultLayout("Full Bathroom", null));
  }

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const out = {};
  out[propertyKey] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
