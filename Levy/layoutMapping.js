// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractText($, selector) {
  const el = $(selector);
  if (!el || el.length === 0) return null;
  const t = el.text().trim();
  return t || null;
}

function safeNumber(x) {
  const n = parseFloat(String(x).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function createDefaultLayout(
  space_type,
  space_index,
  size_square_feet,
  floor_level,
) {
  return {
    space_type: space_type,
    space_index: space_index,
    flooring_material_type: null,
    size_square_feet: size_square_feet,
    floor_level: floor_level,
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

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId =
    extractText($, "#ctlBodyPane_ctl02_ctl01_lblParcelID") ||
    extractText($, 'th:contains("Parcel ID") + td span');
  const propKey = parcelId ? `property_${parcelId}` : "property_unknown";

  // From Building Information subArea table derive base area and exterior spaces
  let totalSqft = null;
  let baseSqft = null;
  const layouts = [];

  $("#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_subArea tbody tr").each(
    (i, el) => {
      const desc = $(el).find("th").text().trim().toUpperCase();
      const cond = $(el).find("td").eq(0).text().trim();
      const actual = $(el).find("td").eq(1).text().trim();
      if (desc === "TOTAL SQFT") {
        totalSqft = safeNumber(actual);
      }
      if (desc === "BASE") {
        baseSqft = safeNumber(actual);
      }
      if (desc.includes("GARAGE")) {
        const size = safeNumber(actual);
        const layout = createDefaultLayout(
          "Attached Garage",
          layouts.length + 1,
          size,
          "1st Floor",
        );
        layout.is_finished = true;
        layout.is_exterior = false;
        layouts.push(layout);
      }
      if (desc.includes("SCREEN PORCH")) {
        const size = safeNumber(actual);
        const layout = createDefaultLayout(
          "Screened Porch",
          layouts.length + 1,
          size,
          "1st Floor",
        );
        layout.is_finished = true;
        layout.is_exterior = true;
        layouts.push(layout);
      }
      if (desc === "PATIO") {
        const size = safeNumber(actual);
        const layout = createDefaultLayout(
          "Patio",
          layouts.length + 1,
          size,
          "1st Floor",
        );
        layout.is_finished = true;
        layout.is_exterior = true;
        layouts.push(layout);
      }
      if (desc.includes("OPEN PORCH")) {
        const size = safeNumber(actual);
        const layout = createDefaultLayout(
          "Open Porch",
          layouts.length + 1,
          size,
          "1st Floor",
        );
        layout.is_finished = true;
        layout.is_exterior = true;
        layouts.push(layout);
      }
    },
  );

  // Bathrooms count
  let bathsCount = null;
  $(
    "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
  ).each((i, el) => {
    const header = $(el).find("th").text().trim().toLowerCase();
    if (header === "baths") {
      bathsCount = safeNumber($(el).find("td").text().trim());
    }
  });

  // Create a generic layout for main conditioned base
  if (baseSqft) {
    const mainLayout = createDefaultLayout(
      "Great Room",
      layouts.length + 1,
      baseSqft,
      "1st Floor",
    );
    layouts.push(mainLayout);
  }

  // Create bathroom entries per count
  if (bathsCount && bathsCount > 0) {
    for (let i = 0; i < bathsCount; i++) {
      const bath = createDefaultLayout(
        "Full Bathroom",
        layouts.length + 1,
        null,
        "1st Floor",
      );
      layouts.push(bath);
    }
  }

  const output = {};
  output[propKey] = { layouts };

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log("Layout mapping complete");
}

try {
  main();
} catch (e) {
  console.error("Layout mapping failed:", e.message);
  process.exit(1);
}
