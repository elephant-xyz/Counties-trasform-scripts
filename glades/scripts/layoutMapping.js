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
        BUILDING_SECTION_TITLE || textTrim($(s).find(".title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();

  if (!section.length) return buildings;
  
  $(section).find(".block-row").each((_, blockRow) => {
    const building = {};
    
    $(blockRow).find(".two-column-blocks").each((__, columnBlock) => {
      $(columnBlock).find("table tbody tr").each((___, tr) => {
        const label = textTrim($(tr).find("th strong").first().text()) || textTrim($(tr).find("td strong").first().text());
        const value = textTrim($(tr).find("td span").first().text());
        if (label) building[label] = value;
      });
    });
    
    if (Object.keys(building).length) buildings.push(building);
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

function defaultLayout(space_type, space_type_index, parcelId, overrides = {}) {
  return {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["1207"],
        LayerID: ["36374"],
        PageTypeID: ["4"],
        PageID: ["13872"],
        Q: ["47389550"],
        KeyValue: [parcelId]
      }
    },
    request_identifier: parcelId,
    space_type,
    space_type_index: space_type_index != null ? String(space_type_index) : null,
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
    installation_date: null,
    livable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    adjustable_area_sq_ft: null,
    total_area_sq_ft: null,
    heated_area_sq_ft: null,
    story_type: null,
    built_year: null,
    building_number: null,
    pool_installation_date: null,
    spa_installation_date: null,
    ...overrides
  };
}

function buildLayoutsFromBuildings(buildings, parcelId) {
  const layouts = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    const buildingIndex = String(buildingNumber);
    const bedrooms = toInt(building["Bedrooms"]);
    const bathroomsRaw = toInt(building["Bathrooms"]);
    const fullBathrooms = Math.floor(bathroomsRaw);
    const halfBathrooms = bathroomsRaw - fullBathrooms >= 0.5 ? 1 : 0;
    const heatedArea = building["Heated Area"] ? toInt(building["Heated Area"]) : null;
    const totalArea = building["Total Area"] ? toInt(building["Total Area"]) : null;
    const builtYear = toInt(building["Actual Year Built"]) || null;

    const baseOverrides = {
      built_year: builtYear,
      building_number: buildingNumber
    };

    // Building layout (carry heated area here only)
    layouts.push(
      defaultLayout("Building", buildingIndex, parcelId, {
        ...baseOverrides,
        heated_area_sq_ft: heatedArea,
        total_area_sq_ft: totalArea,
      }),
    );

    // Full bathrooms per building (e.g., 1.1, 1.2)
    for (let i = 1; i <= fullBathrooms; i++) {
      layouts.push(
        defaultLayout(
          "Full Bathroom",
          `${buildingNumber}.${i}`,
          parcelId,
          baseOverrides,
        ),
      );
    }

    // Half bathroom if present (e.g., 1.3 after two full baths)
    if (halfBathrooms) {
      const halfIndex = fullBathrooms + 1;
      layouts.push(
        defaultLayout(
          "Half Bathroom / Powder Room",
          `${buildingNumber}.${halfIndex}`,
          parcelId,
          baseOverrides,
        ),
      );
    }

    // Bedrooms per building (e.g., 1.1, 1.2, ...)
    for (let i = 1; i <= bedrooms; i++) {
      layouts.push(
        defaultLayout(
          "Bedroom",
          `${buildingNumber}.${i}`,
          parcelId,
          baseOverrides,
        ),
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
  if (!parcelId) throw new Error("Parcel ID not found");
  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }

  
  const buildings = collectBuildings($);
  const layouts = buildLayoutsFromBuildings(buildings, parcelId);
  
  console.log(`Found ${buildings.length} buildings`);
  console.log(`Generated ${layouts.length} layout entries`);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${layouts.length} layouts to ${outPath}`);
}

if (require.main === module) {
  main();
}
