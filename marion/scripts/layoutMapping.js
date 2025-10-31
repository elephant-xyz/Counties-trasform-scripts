// Layout mapping script
// Reads input.html, parses with cheerio, outputs layouts JSON per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getPrimeKey($, html) {
  const m = html.match(/Prime Key:\s*(\d+)/i);
  if (m) return m[1].trim();
  let key = null;
  $("*").each((i, el) => {
    const t = $(el).text();
    const mm = t && t.match(/Prime Key:\s*(\d+)/i);
    if (mm) {
      key = mm[1].trim();
      return false;
    }
  });
  return key || "unknown";
}

function getLabelCount($, label) {
  // Find a <b> whose exact text (trimmed) equals label (with trailing colon)
  let count = 0;
  const b = $("b")
    .filter(
      (i, el) => $(el).text().trim().toLowerCase() === label.toLowerCase(),
    )
    .first();
  if (b.length) {
    // The count is the immediate text node after the <b> inside the same TD
    const node = b.get(0).nextSibling;
    if (node && node.nodeValue) {
      const num = parseInt(String(node.nodeValue).trim(), 10);
      if (!Number.isNaN(num)) count = num;
    } else {
      // Fallback: search the parent td text
      const txt = b.parent().text();
      const m = txt.match(
        new RegExp(
          label.replace(/[-/\\^$*+?.()|[\]{}]/g, (r) => r),
          "i",
        ),
      );
      if (m) {
        const numMatch = txt
          .replace(m[0], "")
          .trim()
          .match(/^(\d+)/);
        if (numMatch) {
          const n = parseInt(numMatch[1], 10);
          if (!Number.isNaN(n)) count = n;
        }
      }
    }
  }
  return count;
}

function extractBathCounts($) {
  const fourFixture = getLabelCount($, "4 Fixture Baths:");
  const threeFixture = getLabelCount($, "3 Fixture Baths:");
  const twoFixture = getLabelCount($, "2 Fixture Baths:");
  return { fourFixture, threeFixture, twoFixture };
}


function extractBedrooms($) {
  return getLabelCount($, "Bedrooms:");
}


function extractKitchens($) {
  return getLabelCount($, "Kitchens:");
}

function defaultLayout(space_index, space_type, size) {
  return {
    space_type,
    space_index,
    flooring_material_type: null,
    size_square_feet: size,
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

    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
    kitchen_renovation_date: null,
    heated_area_sq_ft: null,
    livable_area_sq_ft: null,
    story_type: null,
    total_area_sq_ft: null,
  };
}

function buildLayouts($) {
  const layouts = [];

  const { fourFixture, threeFixture, twoFixture } = extractBathCounts($);
  console.log(
    `Extracted baths -> 4fx:${fourFixture}, 3fx:${threeFixture}, 2fx:${twoFixture}`,
  );
  let idx = 1;
  for (let i = 0; i < fourFixture; i++) {
    layouts.push(defaultLayout(idx++, "Full Bathroom", null));
  }
  for (let i = 0; i < threeFixture; i++) {
    layouts.push(defaultLayout(idx++, "Three-Quarter Bathroom", null));
  }
  for (let i = 0; i < twoFixture; i++) {
    layouts.push(defaultLayout(idx++, "Half Bathroom / Powder Room", null));
  }

  const kitchens = extractKitchens($);
  console.log(`Extracted kitchens -> ${kitchens}`);
  for (let i = 0; i < kitchens; i++) {
    layouts.push(defaultLayout(idx++, "Kitchen", null));
  }

  
  const bedroomCount = extractBedrooms($);

  for (let i = 0; i < bedroomCount; i++) {
  layouts.push(defaultLayout(idx++, "Bedroom", null));
  }
  
  
  if (bedroomCount === 0 && (fourFixture + threeFixture + twoFixture) > 0) {
    console.log("No bedrooms found, but bathrooms exist. Adding placeholder bedroom.");
    layouts.push(defaultLayout(idx++, "Bedroom", null));
  }

  const hasLodge =
    $("td").filter((i, el) => /M77 CLUB\/HALL\/LODGE/i.test($(el).text()))
      .length > 0;
  if (hasLodge) {
    layouts.push(defaultLayout(idx++, "Great Room", null));
  }

  if (layouts.length === 0) {
    layouts.push(defaultLayout(idx++, "Living Area", null));
  }

  return layouts;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const id = getPrimeKey($, html);
  const layouts = buildLayouts($);

  const outObj = {};
  outObj[`property_${id}`] = { layouts };

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(ownersDir);
  ensureDir(dataDir);

  const ownersOut = path.join(ownersDir, "layout_data.json");
  const dataOut = path.join(dataDir, "layout_data.json");
  const json = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(ownersOut, json);
  fs.writeFileSync(dataOut, json);
  console.log(`Wrote layout data for property_${id} to owners/ and data/`);
})();
