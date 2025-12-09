// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function toNumber(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function defaultLayout(space_type, building_number, space_type_index) {
  return {
    space_type,
    building_number: building_number,
    space_type_index: space_type_index,
    flooring_material_type: null,
    size_square_feet: null,
    // floor_level: null,
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
    flooring_installation_date: null,
  };
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

function buildLayoutsFromBuildings(buildings) {
  const layouts = [];
  buildings.forEach((building, index) => {
    const buildingNumber = index + 1;
    const buildingIndex = `${buildingNumber}`;

    const buildingLayout = defaultLayout("Building", buildingNumber, buildingIndex);
    buildingLayout.total_area_sq_ft = toNumber(building["Total Area"]) || null;
    buildingLayout.built_year = toNumber(building["Actual Year Built"]) || null;
    layouts.push(buildingLayout);

    const builtYear = toNumber(building["Actual Year Built"]) || null;
    
    const bedroomCount = toNumber(building["Bedrooms"]);
    for (let i = 1; i <= bedroomCount; i += 1) {
      const bedroomLayout = defaultLayout("Bedroom", buildingNumber, `${buildingNumber}.${i}`);
      bedroomLayout.built_year = builtYear;
      layouts.push(bedroomLayout);
    }

    const bathroomCounts = computeBathroomBreakdown(building["Bathrooms"]);
    for (let i = 1; i <= bathroomCounts.full; i += 1) {
      const fullBathLayout = defaultLayout(
        "Full Bathroom",
        buildingNumber,
        `${buildingNumber}.${i}`,
      );
      fullBathLayout.built_year = builtYear;
      layouts.push(fullBathLayout);
    }
    for (let i = 1; i <= bathroomCounts.half; i += 1) {
      const halfBathLayout = defaultLayout(
        "Half Bathroom / Powder Room",
        buildingNumber,
        `${buildingNumber}.${i}`,
      );
      halfBathLayout.built_year = builtYear;
      layouts.push(halfBathLayout);
    }
    for (let i = 1; i <= bathroomCounts.threeQuarter; i += 1) {
      const threeQuarterBathLayout = defaultLayout(
        "Three-Quarter Bathroom",
        buildingNumber,
        `${buildingNumber}.${i}`,
      );
      threeQuarterBathLayout.built_year = builtYear;
      layouts.push(threeQuarterBathLayout);
    }
  });
  return layouts;
}
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}
function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const layouts = buildLayoutsFromBuildings(buildings);
  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
