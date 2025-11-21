// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue";
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

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function createDefaultLayout(space_type) {
  return {
    space_type,
    space_index: null,
    space_type_index: null,
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
    livable_area_sq_ft: null,
    total_area_sq_ft: null,
    area_under_air_sq_ft: null,
  };
}

function buildLayoutContext(buildings) {
  const layouts = [];
  const layoutHasLayout = [];
  const layoutHasStructure = [];
  const layoutHasUtility = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const nextLayoutIndex = () => layouts.length;
    const registerLayout = (layout) => {
      const layoutIndex = nextLayoutIndex();
      layout.space_index = layoutIndex + 1;
      layouts.push(layout);
      return layoutIndex;
    };

    const buildingLayout = createDefaultLayout("Building");
    buildingLayout.building_number = buildingNumber;
    buildingLayout._building_number = buildingNumber;
    buildingLayout.space_type_index = `${buildingNumber}`;
    const totalArea = toInt(building["Total Area"]);
    if (totalArea > 0) {
      buildingLayout.size_square_feet = totalArea;
      buildingLayout.total_area_sq_ft = totalArea;
    }
    const heatedArea =
      toInt(building["Heated Area"]) || toInt(building["Living Area"]);
    if (heatedArea > 0) {
      buildingLayout.livable_area_sq_ft = heatedArea;
      buildingLayout.area_under_air_sq_ft = heatedArea;
    }

    const buildingLayoutIndex = registerLayout(buildingLayout);
    layoutHasStructure.push({
      layout_index: buildingLayoutIndex,
      structure_index: idx,
    });
    layoutHasUtility.push({
      layout_index: buildingLayoutIndex,
      utility_index: idx,
    });

    const typeCounters = new Map();
    const ensureCounter = (typeKey) => {
      const current = typeCounters.get(typeKey) || 0;
      const next = current + 1;
      typeCounters.set(typeKey, next);
      return next;
    };

    const addRoomLayouts = (count, spaceType) => {
      if (!count || count <= 0) return;
      for (let i = 0; i < count; i += 1) {
        const roomLayout = createDefaultLayout(spaceType);
        const counter = ensureCounter(spaceType);
        roomLayout.space_type_index = `${buildingNumber}.${counter}`;
        roomLayout._building_number = buildingNumber;
        const roomIndex = registerLayout(roomLayout);
        layoutHasLayout.push({
          parent_index: buildingLayoutIndex,
          child_index: roomIndex,
        });
      }
    };

    addRoomLayouts(toInt(building["Bedrooms"]), "Bedroom");
    addRoomLayouts(toInt(building["Bathrooms"]), "Full Bathroom");
  });

  return {
    layouts,
    layout_has_layout: layoutHasLayout,
    layout_has_structure: layoutHasStructure,
    layout_has_utility: layoutHasUtility,
  };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);

  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier != parcelId) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.`,
      path: "property.request_identifier",
    };
  }
  
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const layoutContext = buildLayoutContext(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = layoutContext;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
