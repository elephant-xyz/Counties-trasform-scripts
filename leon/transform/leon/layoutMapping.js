// Layout mapping script
// Reads input.html, parses with cheerio, extracts layout info, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText(txt) {
  if (!txt) return "";
  return String(txt).replace(/\s+/g, " ").trim();
}

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getParcelId() {
  const seedPath = path.join("property_seed.json");
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  return parcelId;
}

function parseNumber(numStr) {
  if (numStr == null) return null;
  const s = String(numStr).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function extractLayouts($) {
  // From Buildings table and Building Details we can infer presence of multiple residential low-rise structures and pool.
  const layouts = [];

  // Create a high-level "Pool Area" layout if pool Yes in details
  let poolYes = false;
  const $details = $("#single-building #building-details table.details");
  $details.find("tr").each((_, tr) => {
    const th = safeText($(tr).find("th").first().text());
    const td = safeText($(tr).find("td").first().text());
    if (th.toLowerCase() === "pool" && td.toLowerCase().startsWith("yes"))
      poolYes = true;
  });

  if (poolYes) {
    layouts.push({
      space_type: "Pool Area",
      space_index: 1,
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
      pool_type: "BuiltIn",
      pool_equipment: null,
      spa_type: null,
      safety_features: null,
      view_type: null,
      lighting_features: null,
      condition_issues: null,
      is_exterior: true,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
      adjustable_area_sq_ft: null,
      area_under_air_sq_ft: null,
      bathroom_renovation_date: null,
      building_number: null,
      heated_area_sq_ft: null,
      is_finished: true,
      kitchen_renovation_date: null,
      livable_area_sq_ft: null,
      story_type: null,
      total_area_sq_ft: null,
      view_type: null,
    });
  }

  // No per-unit room details exist, so we cannot generate bedrooms/bathrooms.
  return layouts;
}

function main() {
  const inputPath = path.join("input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId();
  if (!parcelId) throw new Error("ParcelId not found");

  const layouts = extractLayouts($);
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const key = `property_${parcelId}`;
  const payload = { [key]: { layouts } };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
}
