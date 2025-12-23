// Layout extractor per Elephant Lexicon schema
// - Reads input.html
// - Uses embedded Remix context and visible building details to create layout entries
// - Writes owners/layout_data.json with array of room-like spaces (bed/baths as distinct)

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function parseRemixContext() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const m = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

function getPropertyId($, remix) {
  try {
    const id = remix.state.loaderData["routes/_index"].parcelInformation.number;
    if (id) return id.trim();
  } catch {}
  const h1 = $("h1").first().text();
  const m = h1.match(
    /[0-9]{2}-[0-9A-Z]{1,2}-[0-9]{2}-[0-9]{4}-[0-9]{5}-[0-9]{4}/i,
  );
  return m ? m[0] : "unknown_id";
}

function baseLayout(spaceType, index, buildingNumber = null, overrides = {}) {
  return {
    space_type: spaceType,
    // space_index: index,
    space_type_index: index,
    building_number: buildingNumber,
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
    total_area_sq_ft: null,
    heated_area_sq_ft: null,
    built_year: null,
    ...overrides,
  };
}

function textOfCell(rows, label) {
  const row = rows.filter((i, el) =>
    cheerio
      .load(el)('th,td[role="cell"]')
      .first()
      .text()
      .trim()
      .toLowerCase()
      .startsWith(label.toLowerCase()),
  );
  if (!row.length) return null;
  const td = cheerio.load(row[0])('td[role="cell"]');
  return (td.text() || "").trim() || null;
}

function mapFloorLevel(floor) {
  if (floor) {
    switch (floor) {
      case 1:
        return "1st Floor";
      case 2:
        return "2nd Floor";
      case 3:
        return "3rd Floor";
      case 4:
        return "4th Floor";
    }
  }
}

function toNumber(val) {
  if (val === null || val === undefined) return null;
  const num = parseFloat(String(val).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

function computeBathroomBreakdown(bathroomCount) {
  const n = toNumber(bathroomCount);
  const result = { full: 0, half: 0, threeQuarter: 0 };

  if (!Number.isFinite(n) || n <= 0) return result;

  const full = Math.floor(n);
  const fractional = n - full;
  result.full = full;
  const roundedFraction = Math.round(fractional * 4) / 4;
  if (roundedFraction >= 0.75) {
    result.threeQuarter = 1;
  } else if (roundedFraction >= 0.5) {
    result.half = 1;
  }
  return result;
}

function addBuildingLayouts(layouts, buildingNumber, opts) {
  const {
    bathroomsCount = 0,
    bedroomCount = 0,
    totalArea = null,
    heatedArea = null,
    effectiveYearBuilt = null,
    floorLevel = null,
  } = opts || {};

  const { full, half, threeQuarter } = computeBathroomBreakdown(bathroomsCount);
  const baseOverrides = {
    built_year: effectiveYearBuilt,
    floor_level: floorLevel,
  };

  layouts.push(
    baseLayout("Building", String(buildingNumber), buildingNumber, {
      ...baseOverrides,
      total_area_sq_ft: totalArea,
      heated_area_sq_ft: heatedArea,
      size_square_feet: totalArea,
    }),
  );

  for (let i = 1; i <= full; i++) {
    layouts.push(
      baseLayout(
        "Full Bathroom",
        `${buildingNumber}.${i}`,
        buildingNumber,
        baseOverrides,
      ),
    );
  }

  for (let i = 1; i <= half; i++) {
    layouts.push(
      baseLayout(
        "Half Bathroom / Powder Room",
        `${buildingNumber}.${i}`,
        buildingNumber,
        baseOverrides,
      ),
    );
  }

  for (let i = 1; i <= threeQuarter; i++) {
    layouts.push(
      baseLayout(
        "Three-Quarter Bathroom",
        `${buildingNumber}.${i}`,
        buildingNumber,
        baseOverrides,
      ),
    );
  }

  for (let i = 1; i <= bedroomCount; i++) {
    layouts.push(
      baseLayout("Bedroom", `${buildingNumber}.${i}`, buildingNumber, baseOverrides),
    );
  }
}

function extractLayouts($, remix) {
  const layouts = [];
  
  // Find ALL building tables, not just the first one
  const buildingTables = $("caption")
    .filter((i, el) => $(el).text().trim().toUpperCase().startsWith("BUILDING"))
    .map((i, el) => $(el).closest("table"))
    .get();

  // console.log(`Found ${buildingTables.length} building tables`);

  // If no building tables found, return empty array
  if (!buildingTables.length) {
    console.log("No building tables found");
    const remixData =
    remix &&
    remix.state &&
    remix.state.loaderData &&
    remix.state.loaderData["routes/_index"]
      ? remix.state.loaderData["routes/_index"]
      : {};
    const condoInfo = remixData.condoInfo || null;
    if (condoInfo) {
      const bathrooms = condoInfo.bathrooms ? toNumber(condoInfo.bathrooms) : 0;
      const bedrooms = condoInfo.bedrooms ? toNumber(condoInfo.bedrooms) : 0;
      const floorLevel = condoInfo.floor ? mapFloorLevel(condoInfo.floor) : null;

      addBuildingLayouts(layouts, 1, {
        bathroomsCount: bathrooms || 0,
        bedroomCount: bedrooms ? Math.round(bedrooms) : 0,
        effectiveYearBuilt: condoInfo.effectiveYearBuilt
          ? toNumber(condoInfo.effectiveYearBuilt)
          : null,
        floorLevel,
      });
    }
    return layouts;
  }

  // Process each building table
  buildingTables.forEach((table, buildingIndex) => {
    const $table = $(table);
    const rows = $table.find("tbody > tr");
    const bathroomText = textOfCell(rows, "Bathrooms");
    const bedroomText = textOfCell(rows, "Bedrooms");
    const totalAreaText = textOfCell(rows, "Total Area");
    const heatedAreaText = textOfCell(rows, "Heated Area");
    const effectiveYearBuiltText = textOfCell(rows, "Actual Year Built");
    
    const bathrooms = toNumber(bathroomText) || 0;
    const bedrooms = toNumber(bedroomText) || 0;
    const totalArea = toNumber(totalAreaText);
    const heatedArea = toNumber(heatedAreaText);
    const effectiveYearBuilt = toNumber(effectiveYearBuiltText);

    addBuildingLayouts(layouts, buildingIndex + 1, {
      bathroomsCount: bathrooms,
      bedroomCount: bedrooms ? Math.round(bedrooms) : 0,
      totalArea,
      heatedArea,
      effectiveYearBuilt,
    });
  });

  // console.log(`Total layouts created: ${layouts.length}`);
  return layouts;
}

function main() {
  try {
    const $ = loadHtml();
    const remix = parseRemixContext();
    const propertySeed = readJSON("property_seed.json");
    const id = propertySeed["parcel_id"];
    const layouts = extractLayouts($, remix);

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "layout_data.json");

    const payload = {};
    payload[`property_${id}`] = { layouts };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote layout data for ${id} -> ${outPath}`);
    // console.log(`Total layouts written: ${layouts.length}`);
  } catch (err) {
    console.error("Layout mapping failed:", err.message);
    process.exitCode = 1;
  }
}

main();
