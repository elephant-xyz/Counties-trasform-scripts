// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Data";

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
          const label = textTrim($(tr).find("th strong").first().text());
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
          const label = textTrim($(tr).find("th strong").first().text());
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

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function defaultLayout(space_type, space_type_index, building_number = null) {
  return {
    space_type,
    space_type_index,
    building_number,
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
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
  };
}

function buildLayoutsFromBuildings(buildings) {
  const layouts = [];
  buildings.forEach((building, index) => {
    const buildingNumber = index + 1;
    const typeCounters = {};
    // Maintain independent counters per space type so Bedroom/Bathroom numbering
    // follows the `buildingIndex.counter` convention for each category.
    const incrementCounter = (spaceType) => {
      typeCounters[spaceType] = (typeCounters[spaceType] || 0) + 1;
      return `${buildingNumber}.${typeCounters[spaceType]}`;
    };

    // Root layout for the building itself
    layouts.push(
      defaultLayout("Building", buildingNumber, buildingNumber),
    );

    const bathrooms = toInt(building["Bathrooms"]);
    for (let i = 0; i < bathrooms; i++) {
      layouts.push(
        defaultLayout(
          "Full Bathroom",
          incrementCounter("Full Bathroom"),
          buildingNumber,
        ),
      );
    }

    const bedrooms = toInt(building["Bedrooms"]);
    for (let i = 0; i < bedrooms; i++) {
      layouts.push(
        defaultLayout("Bedroom", incrementCounter("Bedroom"), buildingNumber),
      );
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

  //CHECK if the prepared site was for the correct seed parcelid.
  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.Prepared Site is wrong.`,
      path: "property.request_identifier",
    };
  }  

  // if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const layouts = buildLayoutsFromBuildings(buildings);

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
