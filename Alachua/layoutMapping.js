// Layout mapping script
// Reads input.html, parses with cheerio, maps to layout schema, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const p = path.resolve("input.html");
  if (!fs.existsSync(p)) {
    throw new Error("input.html not found");
  }
  return fs.readFileSync(p, "utf8");
}

function text(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t.length ? t : null;
}

function getPropId($) {
  let parcelId = null;
  $("#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary table tr").each(
    (i, el) => {
      const label = text($(el).find("th strong").first().text());
      // Look for "Parcel ID" not "Prop ID" to match data_extractor.js
      if (label && label.toLowerCase().includes("parcel id")) {
        const val = text($(el).find("td span").first().text());
        if (val) parcelId = val;
      }
    },
  );
  return parcelId || "unknown";
}

function parseIntSafe(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function getBedroomsAndBaths($) {
  const right = $("#ctlBodyPane_ctl10_mSection").find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary",
  );
  const rows = right.find("tr");
  let beds = 0;
  let baths = 0;
  let halfBaths = 0;

  rows.each((_, tr) => {
    const label = text(cheerio.load(tr)("th strong").first().text());
    const val = text(cheerio.load(tr)("td span").first().text());
    if (!label || !val) return;

    // Parse bedrooms: "3 BEDROOMS" -> 3
    if (/Bedrooms/i.test(label)) {
      const bedMatch = val.match(/(\d+)/);
      if (bedMatch) {
        beds = parseInt(bedMatch[1], 10) || 0;
      }
    }

    // Parse bathrooms: "2.0-Baths" -> 2 full baths, "2.5-Baths" -> 2 full + 1 half
    if (/Bathrooms/i.test(label)) {
      const bathMatch = val.match(/(\d+)\.?(\d*)/);
      if (bathMatch) {
        const wholeBaths = parseInt(bathMatch[1], 10) || 0;
        const decimal = bathMatch[2] ? parseFloat(`0.${bathMatch[2]}`) : 0;

        if (decimal >= 0.5) {
          baths = wholeBaths;
          halfBaths = 1;
        } else {
          baths = wholeBaths;
          halfBaths = 0;
        }
      }
    }
  });

  return { beds, baths, halfBaths };
}

function defaultRoom(space_type, index, parcelId) {
  return {
    space_type,
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
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/Application.aspx"
    },
    request_identifier: parcelId || null
  };
}

function buildLayouts($, parcelId) {
  const { beds, baths, halfBaths } = getBedroomsAndBaths($);
  const layouts = [];
  let idx = 1;
  // Create Bedroom entries
  for (let i = 0; i < (beds || 0); i++) {
    layouts.push(defaultRoom("Bedroom", idx++, parcelId));
  }
  // Create Full Bathroom entries
  for (let i = 0; i < (baths || 0); i++) {
    layouts.push(defaultRoom("Full Bathroom", idx++, parcelId));
  }
  // Create Half Bathroom entries
  for (let i = 0; i < (halfBaths || 0); i++) {
    layouts.push(defaultRoom("Half Bathroom / Powder Room", idx++, parcelId));
  }
  // Add Living Room and Kitchen as common spaces if heated area exists
  const heatedAreaText = $("#ctlBodyPane_ctl10_mSection")
    .find(
      "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr",
    )
    .filter((i, el) =>
      /Heated Area/i.test(cheerio.load(el)("th strong").text()),
    )
    .find("td span")
    .text();
  const heatedArea = parseIntSafe(heatedAreaText);
  if (heatedArea) {
    layouts.push(defaultRoom("Living Room", idx++, parcelId));
    layouts.push(defaultRoom("Kitchen", idx++, parcelId));
  }
  return layouts;
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const parcelId = getPropId($); // This now gets parcel ID, not prop ID
  const layouts = buildLayouts($, parcelId);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const data = {};
  data[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath} for property_${parcelId}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
