// layoutMapping.js
// Reads input.html, parses with cheerio, extracts layout data, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function readJSON(p) {
  const fullPath = path.resolve(p);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function extractParcelId($) {
  const boldTxt = $("table.parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

const seed = readJSON("property_seed.json");

function getNumber(text) {
  const m = String(text || "")
    .replace(/[,\s]/g, "")
    .match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function extractBuildings($) {
  const buildings = [];
  const rows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr[bgcolor]",
  );
  rows.each((_, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const effYear = getNumber($(tds[2]).text());
      const baseSF = getNumber($(tds[3]).text());
      const actualSF = getNumber($(tds[4]).text());
      if (effYear !== null || baseSF !== null || actualSF !== null) {
        buildings.push({ effYear, baseSF, actualSF });
      }
    }
  });
  return buildings;
}

function buildBuildingLayoutEntries(buildings, appendSourceInfo) {
  if (!buildings.length) return [];

  return buildings.map((b, idx) => ({
    ...appendSourceInfo(seed),
    space_type: "Building",
    space_type_index: String(idx + 1),
    building_number: idx + 1,
    built_year: b.effYear,
    size_square_feet: b.baseSF,
    total_area_sq_ft: b.actualSF,
    flooring_material_type: null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: false,
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
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    heated_area_sq_ft: null,
    livable_area_sq_ft: null,
    story_type: null,
  }));
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const htmlparcelid = extractParcelId($);
  const parcelId = htmlparcelid;
  
  const appendSourceInfo = (seed) => ({
    source_http_request: {
      method: "GET",
      url: seed?.source_http_request?.url || null
    },
    request_identifier: htmlparcelid || seed?.request_identifier || seed?.parcel_id || "",
  });
  
  const buildings = extractBuildings($);
  const layouts = buildBuildingLayoutEntries(buildings, appendSourceInfo);
  const propertySeed = readJSON("property_seed.json");
  if (
    propertySeed.request_identifier.replaceAll("-", "") !==
    parcelId.replaceAll("-", "")
  ) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "layout_data.json");

  const out = {};
  out[`property_${parcelId}`] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}
