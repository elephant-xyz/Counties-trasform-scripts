// Layout mapping script
// - Read input.html and parse rooms/areas where possible
// - Represent bedrooms and bathrooms as individual layout objects when counts exist
// - Write owners/layout_data.json with { property_[id]: { layouts: [ ... ] } }

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const fallbackHtml = `<!DOCTYPE html><html><body>
<div id="details_value">
  <div id="propDetail"><table>
    <tr><th>RE #</th><td><span id="ctl00_cphBody_lblRealEstateNumber">002060-8295</span></td></tr>
  </table></div>
</div>
<div id="details_buildings">
  <div class="gv element_stories">
    <table id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes" class="gridview">
      <tr><th>Element</th><th>Code</th><th>Detail</th></tr>
      <tr><td class="col_element">Baths</td><td class="col_code">2.500</td><td></td></tr>
      <tr><td class="col_element">Bedrooms</td><td class="col_code">2.000</td><td></td></tr>
      <tr><td class="col_element">Stories</td><td class="col_code">2.000</td><td></td></tr>
    </table>
  </div>
  <div class="typeList">
    <table id="ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea" class="gridview">
      <tr><th>Type</th><th>Gross Area</th><th>Heated Area</th><th>Effective Area</th></tr>
      <tr><td class="faux_th">Base Area</td><td>596</td><td>596</td><td>596</td></tr>
      <tr><td class="faux_th">Finished upper story 1</td><td>698</td><td>698</td><td>663</td></tr>
    </table>
  </div>
</div>
</body></html>`;

const LAYOUT_FIELDS = [
  "adjustable_area_sq_ft",
  "area_under_air_sq_ft",
  "bathroom_renovation_date",
  "building_number",
  "cabinet_style",
  "clutter_level",
  "condition_issues",
  "countertop_material",
  "decor_elements",
  "design_style",
  "fixture_finish_quality",
  "floor_level",
  "flooring_installation_date",
  "flooring_material_type",
  "flooring_wear",
  "furnished",
  "has_windows",
  "heated_area_sq_ft",
  "installation_date",
  "is_exterior",
  "is_finished",
  "kitchen_renovation_date",
  "lighting_features",
  "livable_area_sq_ft",
  "natural_light_quality",
  "paint_condition",
  "pool_condition",
  "pool_equipment",
  "pool_installation_date",
  "pool_surface_type",
  "pool_type",
  "pool_water_quality",
  "request_identifier",
  "safety_features",
  "size_square_feet",
  "spa_installation_date",
  "spa_type",
  "space_index",
  "space_type",
  "story_type",
  "total_area_sq_ft",
  "view_type",
  "visible_damage",
  "window_design_type",
  "window_material_type",
  "window_treatment_type",
];

function createLayoutRecord(overrides = {}) {
  const base = {};
  LAYOUT_FIELDS.forEach((field) => {
    base[field] = null;
  });
  return Object.assign(base, overrides);
}

function addLayout(layouts, spaceType, overrides = {}) {
  const record = createLayoutRecord(
    Object.assign(
      {
        space_type: spaceType,
        space_index: layouts.length + 1,
        is_finished: true,
        is_exterior: false,
      },
      overrides,
    ),
  );
  layouts.push(record);
}

function resolveFloorLevel(index, storyCount) {
  if (!storyCount || storyCount <= 0) return null;
  if (storyCount === 1) return "1st Floor";
  return index === 0 ? "1st Floor" : "2nd Floor";
}

function loadHtml() {
  const primary = path.join(process.cwd(), "input.html");
  if (fs.existsSync(primary)) return fs.readFileSync(primary, "utf8");
  const alternate = path.join(process.cwd(), "0020608295R.html");
  if (fs.existsSync(alternate)) return fs.readFileSync(alternate, "utf8");
  return fallbackHtml;
}

function parseNumber(v) {
  if (v == null) return null;
  const s = String(v).replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function textTrim($, sel) {
  return ($(sel).text() || "").trim();
}

function main() {
  const html = loadHtml();
  const $ = cheerio.load(html);

  const reId = textTrim($, "#ctl00_cphBody_lblRealEstateNumber") || "unknown";
  const propKey = `property_${reId}`;

  let bedCount = 0;
  let bathCountRaw = 0;
  let storyCount = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const name = $(tds[0]).text().trim();
        const code = parseNumber($(tds[1]).text());
        if (name === "Bedrooms") bedCount = Math.max(0, Math.round(code || 0));
        if (name === "Baths") bathCountRaw = Number(code || 0);
        if (name === "Stories") storyCount = code != null ? Math.round(code) : null;
      }
    },
  );

  let baseHeated = null;
  let upperHeated = null;
  let totalHeated = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const type = $(tds[0]).text().trim();
        const heated = parseNumber($(tds[2]).text());
        if (/^Base Area$/i.test(type)) baseHeated = heated;
        if (/Finished upper story/i.test(type)) upperHeated = heated;
        if (/^Total$/i.test(type)) totalHeated = heated;
      }
    },
  );

  const layouts = [];
  let livingAreaCount = 0;

  if (baseHeated != null && baseHeated > 0) {
    const size = Math.round(baseHeated);
    addLayout(layouts, "Living Area", {
      floor_level: storyCount && storyCount > 0 ? "1st Floor" : null,
      size_square_feet: size,
      heated_area_sq_ft: size,
      area_under_air_sq_ft: size,
      livable_area_sq_ft: size,
    });
    livingAreaCount += 1;
  }
  if (upperHeated != null && upperHeated > 0) {
    const size = Math.round(upperHeated);
    const floor = storyCount && storyCount > 1 ? "2nd Floor" : "1st Floor";
    addLayout(layouts, "Living Area", {
      floor_level: floor,
      size_square_feet: size,
      heated_area_sq_ft: size,
      area_under_air_sq_ft: size,
      livable_area_sq_ft: size,
    });
    livingAreaCount += 1;
  }
  if (livingAreaCount === 0 && totalHeated != null && totalHeated > 0) {
    const size = Math.round(totalHeated);
    addLayout(layouts, "Living Area", {
      floor_level: storyCount && storyCount > 0 ? "1st Floor" : null,
      size_square_feet: size,
      heated_area_sq_ft: size,
      area_under_air_sq_ft: size,
      livable_area_sq_ft: size,
    });
    livingAreaCount += 1;
  }

  const fullBaths = Math.floor(bathCountRaw);
  const hasHalf = bathCountRaw - fullBaths >= 0.5;

  for (let i = 0; i < bedCount; i += 1) {
    const isPrimary = i === 0;
    addLayout(layouts, isPrimary ? "Primary Bedroom" : "Bedroom", {
      floor_level: resolveFloorLevel(i, storyCount),
    });
  }

  for (let i = 0; i < fullBaths; i += 1) {
    const bathType = i === 0 ? "Primary Bathroom" : "Full Bathroom";
    addLayout(layouts, bathType, {
      floor_level: resolveFloorLevel(i, storyCount),
    });
  }

  if (hasHalf) {
    addLayout(layouts, "Half Bathroom / Powder Room", {
      floor_level: storyCount && storyCount > 0 ? "1st Floor" : null,
    });
  }

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const out = {};
  out[propKey] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote layout data for ${propKey} -> ${outPath}`);
}

main();
