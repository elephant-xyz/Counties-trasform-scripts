// Layout mapping script
// Reads input.html, parses with cheerio, creates layout entries for bedrooms and bathrooms, writes JSON to owners/ and data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error("Error reading input.html:", e.message);
    process.exit(1);
  }
}

function ensureDirs() {
  const dirs = ["owners", "data"];
  dirs.forEach((d) => {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch (e) {}
  });
}

function text(val) {
  return (val || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let pid = null;
  $("#ctlBodyPane_ctl00_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const k = text($(tr).find("th strong").text());
      const v = text($(tr).find("td span").text());
      if (k === "Parcel ID") pid = v;
    },
  );
  if (!pid) {
    const t = text($("title").text());
    const m = t.match(/Report:\s*([\w-]+)/);
    if (m) pid = m[1];
  }
  return pid;
}

function parseBuildingInfo($) {
  const data = {};
  $("#ctlBodyPane_ctl07_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const key = text($(tr).find("th strong").text());
      const val = text($(tr).find("td span").text());
      if (key) data[key] = val || null;
    },
  );
  return data;
}

function toInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function buildLayoutSkeleton() {
  return {
    space_type: null,
    space_index: 1,
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
  };
}

function main() {
  const html = safeRead("input.html");
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  if (!parcelId) {
    console.error("Parcel ID not found.");
    process.exit(1);
  }
  const binfo = parseBuildingInfo($);

  const bedrooms = toInt(binfo["Bedrooms"]) || 0;
  const bathrooms = toInt(binfo["Bathrooms"]) || 0; // treat as full baths count
  const floorCover = text(binfo["Floor Cover"] || "");
  const hasCarpet = /CARPET/i.test(floorCover);
  const hasVinyl = /VINYL/i.test(floorCover);

  let idx = 1;
  const layouts = [];

  // Create bedroom layouts
  for (let i = 0; i < bedrooms; i++) {
    const l = buildLayoutSkeleton();
    l.space_type = "Bedroom";
    l.space_index = idx++;
    l.flooring_material_type = hasCarpet ? "Carpet" : hasVinyl ? "Vinyl" : null;
    layouts.push(l);
  }

  // Create bathroom layouts (assume full bathrooms)
  for (let i = 0; i < bathrooms; i++) {
    const l = buildLayoutSkeleton();
    l.space_type = "Full Bathroom";
    l.space_index = idx++;
    l.flooring_material_type = hasVinyl ? "Vinyl" : hasCarpet ? "Carpet" : null;
    layouts.push(l);
  }

  // If no layouts inferred, create a generic Living Room to ensure presence (optional)
  if (layouts.length === 0) {
    const l = buildLayoutSkeleton();
    l.space_type = "Living Room";
    l.space_index = idx++;
    l.flooring_material_type = hasCarpet ? "Carpet" : hasVinyl ? "Vinyl" : null;
    layouts.push(l);
  }

  const wrapper = {};
  wrapper[`property_${parcelId}`] = { layouts };

  ensureDirs();
  const json = JSON.stringify(wrapper, null, 2);
  fs.writeFileSync(path.join("owners", "layout_data.json"), json, "utf8");
  fs.writeFileSync(path.join("data", "layout_data.json"), json, "utf8");
  console.log(
    "Wrote layout data for",
    parcelId,
    "with",
    layouts.length,
    "layouts",
  );
}

main();
