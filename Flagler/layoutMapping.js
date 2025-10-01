// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCellValueByHeader($, table, headerText) {
  let val = null;
  $(table)
    .find("tr")
    .each((i, tr) => {
      const th = $(tr).find("td strong").first();
      const label = (th.text() || "").trim();
      if (label.toLowerCase() === (headerText || "").toLowerCase()) {
        const td = $(tr).find("td").eq(1);
        val = td.text().replace(/\s+/g, " ").trim();
      }
    });
  return val;
}

function extractPropertyId($) {
  const summaryTable = $(
    "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table.tabular-data-two-column",
  );
  let propId = getCellValueByHeader($, summaryTable, "Prop ID");
  if (propId) return propId.trim();
  let parcelId = getCellValueByHeader($, summaryTable, "Parcel ID");
  if (parcelId) return parcelId.trim();
  const title = $("title").text();
  const m = title.match(/Card:\s*([\d\-]+)/);
  if (m) return m[1];
  return "unknown";
}

function extractCounts($) {
  const rightTable = $(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary table",
  );
  const bedrooms =
    parseInt(
      (getCellValueByHeader($, rightTable, "Bedrooms") || "").replace(
        /[^0-9]/g,
        "",
      ),
      10,
    ) || 0;
  const bathrooms =
    parseInt(
      (getCellValueByHeader($, rightTable, "Bathrooms") || "").replace(
        /[^0-9]/g,
        "",
      ),
      10,
    ) || 0;
  return { bedrooms, bathrooms };
}

function extractBaseArea($) {
  const table = $(
    "#ctlBodyPane_ctl13_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail",
  );
  let base = null;
  table.find("tbody tr").each((_, tr) => {
    const code = $(tr).find("th").first().text().trim();
    const desc = $(tr).find("td").eq(0).text().trim();
    if (code === "BAS" || /BASE AREA/i.test(desc)) {
      const sqft = $(tr).find("td").eq(1).text().trim();
      base = parseInt(sqft.replace(/[^0-9]/g, ""), 10);
    }
  });
  return base;
}

function baseLayoutDefaults() {
  return {
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

    // optional dates
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    pool_installation_date: null,
    spa_installation_date: null,
  };
}

(function main() {
  try {
    const inputPath = path.join(process.cwd(), "input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    const counts = extractCounts($);
    const baseArea = extractBaseArea($);

    const layouts = [];
    // Create one Primary Bedroom + Secondary bedrooms based on count, sizes unknown
    if (counts.bedrooms > 0) {
      for (let i = 1; i <= counts.bedrooms; i++) {
        const layout = Object.assign({}, baseLayoutDefaults(), {
          space_type: i === 1 ? "Primary Bedroom" : "Secondary Bedroom",
          space_index: i,
          flooring_material_type: null,
          size_square_feet: null,
          has_windows: null,
          window_design_type: null,
          window_material_type: null,
          window_treatment_type: null,
        });
        layouts.push(layout);
      }
    }
    // Bathrooms: assume first is Primary Bathroom if bedrooms>0
    if (counts.bathrooms > 0) {
      for (let b = 1; b <= counts.bathrooms; b++) {
        const layout = Object.assign({}, baseLayoutDefaults(), {
          space_type: b === 1 ? "Primary Bathroom" : "Full Bathroom",
          space_index: (counts.bedrooms || 0) + b,
          size_square_feet: null,
        });
        layouts.push(layout);
      }
    }

    // Add generic Living Room and Kitchen if base area exists
    const nextIndex = layouts.length + 1;
    layouts.push(
      Object.assign({}, baseLayoutDefaults(), {
        space_type: "Living Room",
        space_index: nextIndex,
        size_square_feet: null,
      }),
    );
    layouts.push(
      Object.assign({}, baseLayoutDefaults(), {
        space_type: "Kitchen",
        space_index: nextIndex + 1,
        size_square_feet: null,
      }),
    );

    const out = {};
    out[`property_${propId}`] = { layouts };

    ensureDir(path.join(process.cwd(), "owners"));
    const outPath = path.join(process.cwd(), "owners", "layout_data.json");
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote layout data to", outPath);
  } catch (e) {
    console.error("Error in layoutMapping:", e.message);
    process.exit(1);
  }
})();
