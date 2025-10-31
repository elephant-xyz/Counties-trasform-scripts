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

function baseLayout(spaceType, index) {
  return {
    space_type: spaceType,
    space_index: index,
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

function extractLayouts($, remix) {
  const layouts = [];
  let space_index = 1;
  
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
      let bathrooms = condoInfo.bathrooms ? condoInfo.bathrooms : 0;
      let bedrooms = condoInfo.bedrooms ? condoInfo.bedrooms : 0;
      let floorLevel = condoInfo.floor ? mapFloorLevel(condoInfo.floor) : null;
      // Add bathrooms for this building
      for (let i = 0; i < bathrooms; i++) {
        let l = baseLayout("Full Bathroom", space_index++);
        l.floor_level = floorLevel;
        layouts.push(l);
      }
      
      // Add bedrooms for this building
      for (let i = 0; i < bedrooms; i++) {
        let l = baseLayout("Bedroom", space_index++);
        l.floor_level = floorLevel;
        layouts.push(l);
      }
    }
    return layouts;
  }

  // Process each building table
  buildingTables.forEach((table, buildingIndex) => {
    const $table = $(table);
    const rows = $table.find("tbody > tr");
    const bathroomText = textOfCell(rows, "Bathrooms");
    const bedroomText = textOfCell(rows, "Bedrooms");
    
    let bathrooms = 0;
    let bedrooms = 0;
    
    if (bathroomText && /^\d+$/.test(bathroomText)) {
      bathrooms = parseInt(bathroomText, 10);
    }
    if (bedroomText && /^\d+$/.test(bedroomText)) {
      bedrooms = parseInt(bedroomText, 10);
    }

    // console.log(`Building ${buildingIndex + 1}: ${bedrooms} bedrooms, ${bathrooms} bathrooms`);

    // Add bathrooms for this building
    for (let i = 0; i < bathrooms; i++) {
      const l = baseLayout("Full Bathroom", space_index++);
      layouts.push(l);
    }
    
    // Add bedrooms for this building
    for (let i = 0; i < bedrooms; i++) {
      const l = baseLayout("Bedroom", space_index++);
      layouts.push(l);
    }
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