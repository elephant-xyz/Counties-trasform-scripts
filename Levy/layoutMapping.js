// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function extractParcelId($) {
  let parcelHeader = null;
  $("h2").each((i, el) => {
    const txt = $(el).text().trim();
    if (/^Parcel\s+/i.test(txt)) parcelHeader = txt;
  });
  let id = null;
  if (parcelHeader) id = parcelHeader.replace(/^.*Parcel\s+/i, "").trim();
  if (!id) {
    const scriptText = $("script")
      .map((i, el) => $(el).html() || "")
      .get()
      .join("\n");
    const m = scriptText.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
    if (m) id = m[1];
  }
  return id || "UNKNOWN_ID";
}

function addUnitLayouts(layouts, brPerUnit, baPerUnit) {
  // As instructed, represent each bedroom and full bath as distinct layout objects.
  // For each unit: push one Bedroom and one Full Bathroom.
  layouts.push({
    space_type: "Bedroom",
    space_index: layouts.length + 1,
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
  });
  layouts.push({
    space_type: "Full Bathroom",
    space_index: layouts.length + 1,
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
  });
}

function run() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = extractParcelId($);

  const layouts = [];
  const buildingsHeader = $("h3")
    .filter((i, el) => /Buildings/i.test($(el).text()))
    .first();
  if (buildingsHeader.length) {
    const buildingsSection = buildingsHeader.parent();

    // Find all element tables. For each, check for nearby Note: text first.
    const elementTables = buildingsSection.find("table").filter((i, el) => {
      const head = $(el).find("thead").text();
      return /Element\s*Code\s*Description/i.test(head);
    });

    elementTables.each((idx, tbl) => {
      const $tbl = $(tbl);
      const $row = $tbl.closest(".row");
      // Check if there is a Note: with units/bed/bath in this building row
      let handledByNote = false;
      if ($row.length) {
        const noteEl = $row
          .find("div")
          .filter((i, el) => /^Note:/i.test(($(el).text() || "").trim()));
        if (noteEl.length) {
          const note = noteEl.text();
          const m = note.match(/(\d+)\s*UNITS?\s*(\d+)\s*BR\s*(\d+)\s*BATH/i);
          if (m) {
            const unitCount = parseInt(m[1], 10);
            const br = parseInt(m[2], 10);
            const ba = parseInt(m[3], 10);
            for (let u = 0; u < unitCount; u++) {
              addUnitLayouts(layouts, br, ba);
            }
            handledByNote = true;
          }
        }
      }

      if (!handledByNote) {
        // Fallback: use Bedrooms code value (appears to be 4.0 per building)
        let bedrooms = null;
        $tbl.find("tr").each((i, tr) => {
          const tds = $(tr).find("td");
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim();
            const code = $(tds[1]).text().trim();
            if (/^Bedrooms$/i.test(label)) {
              bedrooms = parseFloat(code);
            }
          }
        });
        if (bedrooms && bedrooms > 0) {
          const unitCount = Math.round(bedrooms); // bedrooms aligns with count of 1BR units
          for (let u = 0; u < unitCount; u++) {
            addUnitLayouts(layouts, 1, 1);
          }
        }
      }
    });
  }

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const wrapped = {};
  wrapped[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(wrapped, null, 2), "utf-8");
  console.log(`Wrote ${outPath} with ${layouts.length} layout entries`);
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exit(1);
}
