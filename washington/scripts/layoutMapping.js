// Layout mapping script
// Reads input.html, parses buildings, rooms, and extra features to produce layout metadata

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";
const EXTRA_FEATURE_SECTION_TITLE = "Extra Features";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function getParcelId($) {
  const parcelIdText = $(PARCEL_SELECTOR).text().trim();
  return parcelIdText || null;
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
          if (!label) label = textTrim($(tr).find("th strong").first().text());
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
          if (!label) label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length && buildings[buildingCount]) {
        buildings[buildingCount] = { ...buildings[buildingCount], ...map };
        buildingCount += 1;
      }
    });
  return buildings;
}

function toInt(val) {
  const n = Number(String(val || "").replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseLengthWidthToArea(text) {
  if (!text) return null;
  const parts = String(text)
    .split(/x/i)
    .map((segment) =>
      parseFloat(String(segment).replace(/[^0-9.]/g, "")),
    )
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length >= 2) {
    return Math.round(parts[0] * parts[1]);
  }
  return null;
}

function collectExtraFeatures($) {
  const features = [];
  $("section")
    .filter(
      (_, section) =>
        textTrim($(section).find(".module-header .title").first().text()) ===
        EXTRA_FEATURE_SECTION_TITLE,
    )
    .find("table")
    .first()
    .find("tbody tr")
    .each((_, tr) => {
      const $cells = $(tr).find("th, td");
      if ($cells.length < 2) return;
      const code = textTrim($cells.eq(0).text());
      const description = textTrim($cells.eq(1).text());
      if (!code && !description) return;
      const lengthWidth =
        $cells.length >= 3 ? textTrim($cells.eq(2).text()) : null;
      const unitsValue =
        $cells.length >= 4 ? parseNumber($cells.eq(3).text()) : null;
      features.push({
        code,
        description,
        lengthWidth,
        unitsValue,
      });
    });
  return features;
}

function normalizeFeatureText(feature) {
  return (feature && feature.description ? feature.description : "")
    .toUpperCase();
}

function mapFeatureToLayout(feature) {
  const text = normalizeFeatureText(feature);
  if (!text) return null;

  const result = {
    space_type: null,
    is_exterior: true,
    is_finished: false,
  };

  const set = (spaceType, opts = {}) => {
    result.space_type = spaceType;
    if (opts.is_exterior !== undefined) result.is_exterior = opts.is_exterior;
    if (opts.is_finished !== undefined) result.is_finished = opts.is_finished;
    return result;
  };

  if (text.includes("POOL HOUSE"))
    return set("Pool House", { is_finished: true, is_exterior: false });
  if (text.includes("POOL")) return set("Outdoor Pool");
  if (text.includes("SPA") || text.includes("HOT TUB") || text.includes("JACUZZI"))
    return set("Hot Tub / Spa Area");
  if (text.includes("SCREEN") && text.includes("PORCH"))
    return set("Screened Porch");
  if (text.includes("PORCH")) {
    if (text.includes("OPEN")) return set("Open Porch");
    return set("Porch");
  }
  if (text.includes("LANAI")) return set("Lanai");
  if (text.includes("DECK")) return set("Deck");
  if (text.includes("GAZEBO")) return set("Gazebo");
  if (text.includes("PERGOLA")) return set("Pergola");
  if (text.includes("PATIO")) return set("Patio");
  if (text.includes("COURT")) return set("Courtyard");
  if (text.includes("FENCE") || text.includes("FNC"))
    return set("Open Courtyard");
  if (text.includes("CARPORT")) {
    if (text.includes("DET") || text.includes("DT"))
      return set("Detached Carport", { is_exterior: false });
    return set("Carport", { is_exterior: false });
  }
  if (text.includes("GAR") || text.includes("DU/G"))
    return set("Detached Garage", { is_exterior: false });
  if (text.includes("SHED"))
    return set("Shed", { is_finished: false, is_exterior: true });
  if (text.includes("BARN"))
    return set("Barn", { is_finished: false, is_exterior: false });
  if (text.includes("WORKSHOP"))
    return set("Workshop", { is_finished: false, is_exterior: false });
  if (text.includes("UTILITY"))
    return set("Utility Closet", { is_exterior: false, is_finished: true });

  return null;
}

function createBaseLayout(space_type, overrides = {}) {
  return {
    space_type,
    space_index: overrides.space_index ?? null,
    space_type_index: overrides.space_type_index ?? null,
    building_number:
      typeof overrides.building_number === "number"
        ? overrides.building_number
        : null,
    flooring_material_type: overrides.flooring_material_type ?? null,
    size_square_feet: overrides.size_square_feet ?? null,
    floor_level: overrides.floor_level ?? null,
    has_windows:
      typeof overrides.has_windows === "boolean" ? overrides.has_windows : null,
    window_design_type: overrides.window_design_type ?? null,
    window_material_type: overrides.window_material_type ?? null,
    window_treatment_type: overrides.window_treatment_type ?? null,
    is_finished:
      typeof overrides.is_finished === "boolean" ? overrides.is_finished : true,
    furnished: overrides.furnished ?? null,
    paint_condition: overrides.paint_condition ?? null,
    flooring_wear: overrides.flooring_wear ?? null,
    clutter_level: overrides.clutter_level ?? null,
    visible_damage: overrides.visible_damage ?? null,
    countertop_material: overrides.countertop_material ?? null,
    cabinet_style: overrides.cabinet_style ?? null,
    fixture_finish_quality: overrides.fixture_finish_quality ?? null,
    design_style: overrides.design_style ?? null,
    natural_light_quality: overrides.natural_light_quality ?? null,
    decor_elements: overrides.decor_elements ?? null,
    pool_type: overrides.pool_type ?? null,
    pool_equipment: overrides.pool_equipment ?? null,
    spa_type: overrides.spa_type ?? null,
    safety_features: overrides.safety_features ?? null,
    view_type: overrides.view_type ?? null,
    lighting_features: overrides.lighting_features ?? null,
    condition_issues: overrides.condition_issues ?? null,
    is_exterior:
      typeof overrides.is_exterior === "boolean" ? overrides.is_exterior : false,
    pool_condition: overrides.pool_condition ?? null,
    pool_surface_type: overrides.pool_surface_type ?? null,
    pool_water_quality: overrides.pool_water_quality ?? null,
    bathroom_renovation_date: overrides.bathroom_renovation_date ?? null,
    kitchen_renovation_date: overrides.kitchen_renovation_date ?? null,
    flooring_installation_date: overrides.flooring_installation_date ?? null,
    total_area_sq_ft: overrides.total_area_sq_ft ?? null,
    livable_area_sq_ft: overrides.livable_area_sq_ft ?? null,
    area_under_air_sq_ft: overrides.area_under_air_sq_ft ?? null,
    built_year: overrides.built_year ?? null,
    layout_has_layout: [],
    layout_has_structure: [],
    layout_has_utility: [],
    extra_feature: overrides.extra_feature ?? false,
  };
}

function buildLayoutsFromBuildings(buildings, extraFeatures) {
  const layouts = [];
  let nextSpaceIndex = 1;
  const buildingLayoutIndices = [];

  buildings.forEach((building, i) => {
    const buildingNumber = i + 1;
    const totalArea =
      parseNumber(building["Total Area"]) ??
      parseNumber(building["Total Adjusted Area"]);
    const heatedArea =
      parseNumber(building["Heated Area"]) ??
      parseNumber(building["Living Area"]);
    const builtYear =
      parseInt(building["Actual Year Built"], 10) ||
      parseInt(building["Effective Year Built"], 10) ||
      null;

    const buildingLayout = createBaseLayout("Building", {
      space_index: nextSpaceIndex++,
      space_type_index: `${buildingNumber}`,
      building_number: buildingNumber,
      total_area_sq_ft: totalArea ?? null,
      livable_area_sq_ft:
        heatedArea != null ? heatedArea : totalArea != null ? totalArea : null,
      area_under_air_sq_ft: heatedArea ?? null,
      built_year: builtYear,
    });
    layouts.push(buildingLayout);
    buildingLayoutIndices.push(layouts.length - 1);

    let childCounter = 1;
    const appendChildLayout = (spaceType, overrides = {}) => {
      const child = createBaseLayout(spaceType, {
        space_index: nextSpaceIndex++,
        space_type_index:
          overrides.space_type_index ?? `${buildingNumber}.${childCounter}`,
        building_number: buildingNumber,
        size_square_feet: overrides.size_square_feet ?? null,
        is_exterior: overrides.is_exterior ?? false,
        total_area_sq_ft: overrides.total_area_sq_ft ?? null,
        livable_area_sq_ft: overrides.livable_area_sq_ft ?? null,
        area_under_air_sq_ft: overrides.area_under_air_sq_ft ?? null,
        is_finished:
          overrides.is_finished !== undefined ? overrides.is_finished : true,
        extra_feature: overrides.extra_feature ?? false,
      });
      layouts.push(child);
      buildingLayout.layout_has_layout.push(layouts.length);
      childCounter += 1;
      return child;
    };

    const bedrooms = toInt(building["Bedrooms"]);
    for (let b = 0; b < bedrooms; b += 1) {
      appendChildLayout("Bedroom");
    }

    const bathCountRaw = parseNumber(building["Bathrooms"]) ?? 0;
    const fullBaths = Math.floor(bathCountRaw);
    const fractional = bathCountRaw - fullBaths;
    for (let b = 0; b < fullBaths; b += 1) {
      appendChildLayout("Full Bathroom");
    }
    if (fractional >= 0.5) {
      appendChildLayout("Half Bathroom / Powder Room");
    }

    if (buildingLayout.layout_has_layout.length === 0) {
      appendChildLayout("Living Area", {
        total_area_sq_ft: totalArea ?? heatedArea ?? null,
        livable_area_sq_ft: heatedArea ?? null,
        area_under_air_sq_ft: heatedArea ?? null,
      });
    }
  });

  const buildingCount = buildings.length;
  const attachExtraToSingleBuilding =
    buildingCount === 1 && buildingLayoutIndices.length === 1;
  const features = Array.isArray(extraFeatures) ? extraFeatures : [];
  let standaloneFeatureCounter = 1;

  features.forEach((feature) => {
    const mapped = mapFeatureToLayout(feature);
    if (!mapped || !mapped.space_type) return;
    const featureArea =
      (feature.unitsValue && feature.unitsValue > 0
        ? feature.unitsValue
        : parseLengthWidthToArea(feature.lengthWidth)) ?? null;

    if (attachExtraToSingleBuilding) {
      const buildingLayout = layouts[buildingLayoutIndices[0]];
      if (!buildingLayout) return;
      const childIndex = buildingLayout.layout_has_layout.length + 1;
      const child = createBaseLayout(mapped.space_type, {
        space_index: nextSpaceIndex++,
        space_type_index: `${1}.${childIndex}`,
        building_number: 1,
        size_square_feet: featureArea,
        is_exterior: mapped.is_exterior,
        is_finished: mapped.is_finished,
        extra_feature: true,
      });
      layouts.push(child);
      buildingLayout.layout_has_layout.push(layouts.length);
    } else {
      const rootIndex = buildingCount + standaloneFeatureCounter;
      const layout = createBaseLayout(mapped.space_type, {
        space_index: nextSpaceIndex++,
        space_type_index: String(rootIndex),
        building_number: null,
        size_square_feet: featureArea,
        is_exterior: mapped.is_exterior,
        is_finished: mapped.is_finished,
        extra_feature: true,
      });
      layout._standalone_feature_index = standaloneFeatureCounter;
      standaloneFeatureCounter += 1;
      layouts.push(layout);
    }
  });

  return layouts;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);

  const propertySeed = readJSON("property_seed.json");
  if (
    propertySeed &&
    propertySeed.request_identifier &&
    parcelId &&
    propertySeed.request_identifier.replace(/-/g, "") !==
      parcelId.replace(/-/g, "")
  ) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.`,
      path: "property.request_identifier",
    };
  }

  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const extraFeatures = collectExtraFeatures($);
  const layouts = buildLayoutsFromBuildings(buildings, extraFeatures);

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
