// layoutMapping.js
// Parses input.html with cheerio and outputs layout data per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

function getText($, selector) {
  const el = $(selector).first();
  return el.length ? el.text().trim() : "";
}

function findValueByLabel($, scope, labelText) {
  let value = "";
  $(scope)
    .find("tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const labelTd = $tr.find("td.label").first();
      const valTd = $tr.find("td.value").first();
      if (labelTd.length && valTd.length) {
        const lbl = labelTd.text().replace(/\s+/g, " ").trim().toLowerCase();
        if (lbl.includes(labelText.toLowerCase())) {
          value = valTd.text().replace(/\s+/g, " ").trim();
          return false;
        }
      }
    });
  return value;
}

function toInt(val) {
  const n = parseInt((val || "").toString().replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function defaultLayout(space_index, overrides = {}) {
  return Object.assign(
    {
      space_type: null,
      space_index,
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
    },
    overrides,
  );
}

function run() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  // Extract property id
  let pcnText = getText($, "#MainContent_lblPCN");
  if (!pcnText) {
    pcnText = $("td.label:contains('Parcel Control Number')")
      .next(".value")
      .text()
      .trim();
  }
  const propertyId = digitsOnly(pcnText);
  const propKey = `property_${propertyId || "unknown"}`;

  // Structural counts for bedrooms/baths
  const structHeader = $("h3:contains('Structural Element')").first();
  const structScope = structHeader.length
    ? structHeader.next(".building_col")
    : null;

  const bedCount =
    toInt(structScope ? findValueByLabel($, structScope, "Bed Rooms") : "") ||
    0;
  const fullBaths =
    toInt(structScope ? findValueByLabel($, structScope, "Full Baths") : "") ||
    0;
  const halfBaths =
    toInt(structScope ? findValueByLabel($, structScope, "Half Baths") : "") ||
    0;

  const subareaHeader = $("h3:contains('SUBAREA AND SQUARE FOOTAGE')").first();
  const subareaScope = subareaHeader.length
    ? subareaHeader.next(".building_col")
    : null;
  let baseArea = null;
  if (subareaScope) {
    $(subareaScope)
      .find("tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().replace(/\s+/g, " ").trim();
          const val = toInt($(tds[1]).text());
          if (/BAS\s+Base Area/i.test(label) && val) baseArea = val;
        }
      });
  }

  let space_index = 1;
  const layouts = [];

  // Bedrooms
  for (let i = 0; i < bedCount; i++) {
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Bedroom",
        size_square_feet: null,
        floor_level: "1st Floor",
      }),
    );
  }

  // Full bathrooms
  for (let i = 0; i < fullBaths; i++) {
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Full Bathroom",
        floor_level: "1st Floor",
      }),
    );
  }

  // Half bathrooms
  for (let i = 0; i < halfBaths; i++) {
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Half Bathroom / Powder Room",
        floor_level: "1st Floor",
      }),
    );
  }

  // Generic Living Room and Kitchen
  if (baseArea) {
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Living Room",
        floor_level: "1st Floor",
      }),
    );
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Kitchen",
        floor_level: "1st Floor",
      }),
    );
  }

  if (layouts.length === 0) {
    layouts.push(
      defaultLayout(space_index++, {
        space_type: "Living Room",
        floor_level: "1st Floor",
      }),
    );
  }

  const outObj = {};
  outObj[propKey] = { layouts };

  const ownersDir = path.resolve("owners");
  const dataDir = path.resolve("data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(ownersDir, "layout_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(dataDir, "layout_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );

  console.log(
    "layout_data.json written for",
    propKey,
    "with",
    layouts.length,
    "layouts",
  );
}

if (require.main === module) {
  run();
}
