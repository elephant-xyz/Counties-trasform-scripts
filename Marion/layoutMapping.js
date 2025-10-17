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

// ✅ New function to extract counts and calculate bathrooms
// replace your existing extractCounts with this
function extractCounts($) {
  // find candidate table(s) that contain the bedroom/bath labels
  const candidateTables = $("table").filter((i, el) => {
    const txt = $(el).text();
    // relaxed check: look for the word 'Bedrooms' and 'Fixture' somewhere in the table
    return /Bedrooms/i.test(txt) && /Fixture/i.test(txt);
  });
 
  if (!candidateTables.length) {
    console.warn("No candidate table found for bedrooms/baths");
    return { bedrooms: 0, fourFixture: 0, threeFixture: 0, twoFixture: 0, extraFixtures: 0, totalBathrooms: 0 };
  }
 
  // prefer the first matching table that actually contains <b> labels like "Bedrooms:"
  let table = candidateTables.first();
 
  // map to hold extracted values
  const values = {
    Bedrooms: 0,
    '4 Fixture Baths': 0,
    '3 Fixture Baths': 0,
    '2 Fixture Baths': 0,
    'Extra Fixtures': 0
  };
 
  // Try DOM-based extraction first: look for <b> labels and read the adjacent text/node
  table.find('b').each((i, el) => {
    const label = $(el).text().replace(/[:\u00A0]/g, '').trim(); // remove colon / NBSP
    if (!label) return;
 
    // Get the raw text AFTER this <b> inside the same parent cell
    // Strategy: look at nextSibling text node, then next element, then parent cell text minus label
    let valText = '';
 
    // 1) next text node / sibling node
    const nextNode = el.nextSibling;
    if (nextNode && nextNode.nodeType === 3) { // text node
      valText = $(nextNode).text ? $(nextNode).text().trim() : (nextNode.nodeValue || '').trim();
    }
 
    // 2) if empty, try next element sibling's text
    if (!valText) {
      const nextEl = $(el).next();
      if (nextEl && nextEl.length) valText = nextEl.text().trim();
    }
 
    // 3) if still empty, fallback to parent's text minus the label text
    if (!valText) {
      const parentText = $(el).parent().text().replace($(el).text(), '').trim();
      valText = parentText.split(/\s+/)[0] || '';
    }
 
    // 4) final cleanup: take the first number-looking token
    const m = valText.match(/(-?\d+(\.\d+)?)/);
    const num = m ? parseFloat(m[1]) : 0;
 
    // normalize some label variants
    let key = label;
    if (/^Bedrooms?/i.test(label)) key = 'Bedrooms';
    else if (/^4\s*Fixture/i.test(label)) key = '4 Fixture Baths';
    else if (/^3\s*Fixture/i.test(label)) key = '3 Fixture Baths';
    else if (/^2\s*Fixture/i.test(label)) key = '2 Fixture Baths';
    else if (/^Extra\s*Fixtures?/i.test(label)) key = 'Extra Fixtures';
 
    if (values.hasOwnProperty(key)) values[key] = num;
  });
 
  // If DOM extraction found nothing, try a forgiving regex over the table HTML/text as a fallback
  const tableText = table.text();
  if (Object.values(values).every(v => v === 0)) {
    // permissive regexes: allow optional colon, NBSP, linebreaks, etc.
    const regexes = {
      Bedrooms: /Bedrooms[:\s\u00A0]*([0-9]+)/i,
      '4 Fixture Baths': /4\s*Fixture(?:s)?\s*Baths?[:\s\u00A0]*([0-9]+)/i,
      '3 Fixture Baths': /3\s*Fixture(?:s)?\s*Baths?[:\s\u00A0]*([0-9]+)/i,
      '2 Fixture Baths': /2\s*Fixture(?:s)?\s*Baths?[:\s\u00A0]*([0-9]+)/i,
      'Extra Fixtures': /Extra\s*Fixtures?[:\s\u00A0]*([0-9]+)/i
    };
    for (const k in regexes) {
      const mm = tableText.match(regexes[k]);
      if (mm) values[k] = parseInt(mm[1], 10) || 0;
    }
  }
 
  // Final assign to variables with safe numeric values
  const bedrooms = parseInt(values['Bedrooms'] || 0, 10);
  const fourFixture = parseInt(values['4 Fixture Baths'] || 0, 10);
  const threeFixture = parseInt(values['3 Fixture Baths'] || 0, 10);
  const twoFixture = parseInt(values['2 Fixture Baths'] || 0, 10);
  const extraFixtures = parseInt(values['Extra Fixtures'] || 0, 10);
 
  // Calculation:
  // - treat 4- and 3- fixture counts as full baths (1.0 each)
  // - treat 2-fixture as half baths (0.5)
  // - extraFixtures are usually additional plumbing fixtures (leave them separate)
  const fullBaths = fourFixture + threeFixture;
  const halfBaths = twoFixture;
  const totalBathrooms = fullBaths + (halfBaths * 0.5);
 
  return { bedrooms, fourFixture, threeFixture, twoFixture, extraFixtures, totalBathrooms };
}
 

// ✅ Updated buildLayouts to include summary
function buildLayouts($) {
  const layouts = [];
  const { bedrooms, fourFixture, threeFixture, twoFixture, totalBathrooms } = extractCounts($);

  let idx = 1;

  // Add bedrooms
  for (let i = 0; i < bedrooms; i++) {
    layouts.push(defaultLayout(idx++, "Bedroom", null));
  }

  // Add bathrooms
  for (let i = 0; i < fourFixture; i++) {
    layouts.push(defaultLayout(idx++, "Full Bathroom", null));
  }
  for (let i = 0; i < threeFixture; i++) {
    layouts.push(defaultLayout(idx++, "Full Bathroom", null));
  }
  for (let i = 0; i < twoFixture; i++) {
    layouts.push(defaultLayout(idx++, "Half Bathroom / Powder Room", null));
  }

  if (layouts.length === 0) {
    layouts.push(defaultLayout(idx++, "Living Area", null));
  }

  return { layouts, summary: { number_of_bedrooms: bedrooms, number_of_bathrooms: totalBathrooms } };
}

// ✅ Main function
(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const id = getPrimeKey($, html);

  const { layouts, summary } = buildLayouts($);

  const outObj = {};
  outObj[`property_${id}`] = { layouts, summary };

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(ownersDir);
  ensureDir(dataDir);

  const json = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(path.join(ownersDir, "layout_data.json"), json);
  fs.writeFileSync(path.join(dataDir, "layout_data.json"), json);

  console.log(`Wrote layout data for property_${id} to owners/ and data/`);
})();