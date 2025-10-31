// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  const h1 = $("section.title h1").first().text().trim();
  const m = h1.match(/Parcel\s+([0-9\-]+)/i);
  if (m) return m[1];
  const title = $("title").text();
  const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
  if (m2) return m2[1];
  return "unknown";
}

function parseNumber(val) {
  if (!val) return null;
  const num = String(val).replace(/[^0-9.\-]/g, "");
  if (!num) return null;
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

function mapFlooringMaterial(details) {
  if (!details) return null;
  const u = details.toUpperCase();
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("CLAY TILE") || u.includes("CERAMIC")) return "CeramicTile";
  if (u.includes("WOOD")) return "Wood";
  if (u.includes("VINYL")) return "Vinyl";
  if (u.includes("TILE")) return "Tile";
  if (u.includes("CONCRETE")) return "Concrete";
  if (u.includes("LAMINATE")) return "Laminate";
  return null;
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propId = extractPropertyId($);

  // Extract structural elements data - Description maps to schema keys, Details contain values
  const structuralData = {};
  $("div.se table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const description = $(tds[1]).text().trim(); // Schema key
    const details = $(tds[3]).text().trim(); // Value to be mapped
    
    if (description && details) {
      // Map common descriptions to schema fields
      if (description === "Interior Flooring") {
        structuralData.flooring_material_type = mapFlooringMaterial(details);
      }
      // Add more mappings as needed based on actual HTML content
    }
  });

  // Create a single basic layout since we don't have room-specific data
  const layouts = [{
    space_type: null, // No room type info available from structural elements
    space_index: 1,
    flooring_material_type: structuralData.flooring_material_type || null,
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
    flooring_installation_date: null
  }];

  const outObj = {};
  outObj[`property_${propId}`] = { layouts };

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/layout_data.json"),
    JSON.stringify(outObj, null, 2),
  );
  console.log(
    "Wrote owners/layout_data.json for",
    propId,
    "with",
    layouts.length,
    "layout",
  );
}

run();
