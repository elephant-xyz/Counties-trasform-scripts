// Layout mapping script
// Reads input.html, extracts layout/rooms using cheerio, outputs owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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
function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  let parcelId = ($("#stu").attr("value") || $("#stu").val() || "").trim();
  // if (!parcelId) {
  //   const parcelText = (
  //     $(".parcelResultFistParcel").text() ||
  //     $(".rParcel").text() ||
  //     ""
  //   ).trim();
  //   parcelId = (parcelText.match(/\d{17,}/) || [null])[0] || "unknown";
  // }

  const layouts = [];
  let space_index = 1;
  let bedrooms = 0;
  let bathrooms = 0
  $("div.row.mt-1").each((i, el) => {
    const label = $(el).find("strong").first().text().trim();
    if (/Bedrooms:/i.test(label)) {
      const val = $(el).find("span").last().text().trim();
      const y = parseInt(val, 10);
      if (!isNaN(y)) bedrooms+=y;
    }
    if (/Bathrooms:/i.test(label)) {
      const val = $(el).find("span").last().text().trim();
      const y = parseInt(val, 10);
      if (!isNaN(y)) bathrooms+=y;
    }
  });
  for (let i = 0; i < bedrooms; i++) {
    layouts.push(defaultLayout("Bedroom", space_index++));
  }
  for (let i = 0; i < bathrooms; i++) {
    layouts.push(defaultLayout("Full Bathroom", space_index++));
  }

  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);
  const outPath = path.join(ownersDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

main();
