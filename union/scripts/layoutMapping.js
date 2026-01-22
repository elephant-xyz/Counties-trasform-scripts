// Layout mapping script
// Reads input.html, parses with cheerio, outputs owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function toTitleCase(str) {
  return (str || "")
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseInteger(val) {
  const num = parseNumber(val);
  if (num == null) return null;
  return Math.round(num);
}

function parseYear(val) {
  // Check if the original value is negative before parseNumber strips the sign
  if (val != null && String(val).trim().startsWith('-')) return null;

  const year = parseNumber(val);
  // built_year must be >= 1 according to schema, or null
  if (year == null) return null;
  if (typeof year !== 'number') return null;
  if (!Number.isFinite(year)) return null;
  // Explicit check for 0 (which violates minimum: 1 constraint)
  if (year === 0) return null;
  // Ensure year is at least 1 (schema requires minimum: 1)
  if (year < 1) return null;
  const intYear = Math.floor(year);
  // Explicit check for 0 after flooring
  if (intYear === 0) return null;
  // Double-check after flooring that we still have >= 1
  if (intYear < 1) return null;
  return intYear;
}

function loadJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (_) {
    // ignore malformed json
  }
  return null;
}

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function mapOutbuildingSpaceType(desc) {
  const normalized = (desc || "").toLowerCase();
  if (normalized.includes("garage")) return "Detached Garage";
  if (normalized.includes("carport")) return "Detached Carport";
  if (normalized.includes("shed")) return "Shed";
  if (normalized.includes("storage")) return "Storage Room";
  if (normalized.includes("work")) return "Workshop";
  if (normalized.includes("patio") || normalized.includes("misc conc"))
    return "Patio";
  if (normalized.includes("porch")) return "Porch";
  if (normalized.includes("deck")) return "Deck";
  if (normalized.includes("gazebo")) return "Gazebo";
  if (normalized.includes("pool")) return "Pool Area";
  if (normalized.includes("barn")) return "Barn";
  return null;
}

function buildBaseLayout(spaceType, spaceTypeIndex, requestMeta) {
  return {
    space_type: spaceType,
    space_type_index: String(spaceTypeIndex),
    building_number: null,
    built_year: null,
    size_square_feet: null,
    total_area_sq_ft: null,
    heated_area_sq_ft: null,
    story_type: null,
    is_exterior: null,
    is_finished: null,
    flooring_material_type: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
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
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    source_http_request: requestMeta.source_http_request || null,
    request_identifier: requestMeta.request_identifier || null,
  };
}

function buildLayouts($, requestMeta) {
  const layouts = [];
  let spaceTypeIndex = 0;

  const buildingRows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr",
  );
  buildingRows.each((i, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length < 6) return;
    if (/bldg item/i.test(cells[0])) return;

    const buildingNumber = parseNumber(cells[0]);
    const builtYear = parseYear(cells[2]);
    const baseSf = parseInteger(cells[3]);
    const actualSf = parseInteger(cells[4]);

    spaceTypeIndex += 1;
    const layout = buildBaseLayout("Building", spaceTypeIndex, requestMeta);
    layout.building_number = buildingNumber;
    // Ensure built_year is only set if it's a valid year (>= 1), otherwise null
    layout.built_year = (builtYear != null && builtYear >= 1) ? builtYear : null;
    layout.size_square_feet = actualSf;
    layout.total_area_sq_ft = actualSf;
    layout.heated_area_sq_ft = baseSf;
    layout.is_exterior = false;
    layout.is_finished = true;
    layouts.push(layout);
  });

  const outbuildingRows = $(
    "#parcelDetails_XFOBTable table.parcelDetails_insideTable tr",
  );
  outbuildingRows.each((i, tr) => {
    const cells = $(tr)
      .find("td")
      .map((_, td) => $(td).text().trim())
      .get();
    if (cells.length < 6) return;
    if (/^code$/i.test(cells[0])) return;

    const code = parseNumber(cells[0]);
    const descRaw = cells[1] || null;
    const builtYear = parseYear(cells[2]);
    const units = parseInteger(cells[4]);

    const mappedSpaceType = mapOutbuildingSpaceType(descRaw);
    if (!mappedSpaceType) return;

    spaceTypeIndex += 1;
    const layout = buildBaseLayout(
      mappedSpaceType,
      spaceTypeIndex,
      requestMeta,
    );
    layout.building_number = code;
    // Ensure built_year is only set if it's a valid year (>= 1), otherwise null
    layout.built_year = (builtYear != null && builtYear >= 1) ? builtYear : null;
    layout.size_square_feet = units;
    layout.total_area_sq_ft = units;
    layout.is_exterior = true;
    layout.is_finished = false;
    layouts.push(layout);
  });

  return layouts;
}

function main() {
  const $ = loadHtml();
  const parcelId = extractParcelId($);
  const propSeed = loadJsonSafe(path.join(process.cwd(), "property_seed.json"));
  const requestMeta = {
    source_http_request: propSeed ? propSeed.source_http_request || null : null,
    request_identifier: propSeed ? propSeed.request_identifier || null : null,
  };
  const layouts = buildLayouts($, requestMeta);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating layout data:", e.message);
    process.exit(1);
  }
}
