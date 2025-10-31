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

const PARCEL_SELECTOR = "#ctlBodyPane_ctl08_ctl01_lblParcelID";
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

function collectLayouts($) {
  let buildingAllLayouts = [];
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
      '.tabular-data',
    )
    .each((_, table) => {
      let buildingSpecificLayouts = [];
      $(table)
        .find("tbody tr")
        .each((__, tr) => {
          let lbl = textTrim($(tr).find("th").first().text());
          if (!lbl || !lbl.trim()) {
            lbl = textTrim($(tr).find("td").first().text());
          }
          const value = toInt(textTrim($(tr).find("td").last().text()));
          buildingSpecificLayouts.push({"label": lbl, "area": value});
        });
      buildingAllLayouts.push(buildingSpecificLayouts);
    });
  return buildingAllLayouts;
}

function toInt(val) {
  if (!val) {
    return null;
  }
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function defaultLayout(space_type, building_number, space_index, area_under_air_sq_ft, total_area_sq_ft, is_finished) {
  return {
    building_number: building_number,
    space_type: space_type,
    space_index: space_index,
    flooring_material_type: null,
    size_square_feet: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: is_finished,
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
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: area_under_air_sq_ft,
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    heated_area_sq_ft: null,
    installation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: total_area_sq_ft,
  };
}

function mapLayoutType(label) {
 const layoutMapping = {
    "BASE AREA": ["Basement",true],
    "PATIO/SLAB": ["Patio",true],
    "FINISHED GARAGE": ["Attached Garage",true],
    "FINISHED OPEN PORCH": ["Open Porch",true],
    "FINISHED UPPER STORY": [null,true],
    "FINISHED SCREEN PORCH": ["Screened Porch",true],
    "FINISHED DECK": ["Deck",true],
    "ADDITION": [null,true],
    "UNFINISHED ENCLOSED PORCH": ["Enclosed Porch", false],
    "UNFINISHED STORAGE/UTILITY": ["Storage Room", false],
    "OUTSIDE STAIRS": [null,true],
    "FINISHED ENCLOSED PORCH": ["Enclosed Porch",true],
    "FINISHED CARPORT": ["Carport",true],
    "FINISHED STORAGE/UTILITY": ["Storage Room",true],
    "BALCONY": ["Balcony",true],
    "UNFINISHED OPEN PORCH": ["Open Porch", false],
    "UNFINISHED ATTIC": ["Attic", false],
    "FINISHED CANOPY": [null,true],
    "UNFINISHED CANOPY": [null, false],
    "LOADING PLATFORM": [null,true],
    "UNFINISHED GARAGE": ["Attached Garage", false],
    "SEMI-FINISHED BASE": ["Basement", false],
    "ENCLOSED STAIRWELL": [null,true],
    "FINISHED ATTIC": ["Attic",true],
    "SEMI-FINISHED UPPER STORY": [null, false],
    "SEMI-FINISHED ATTIC": ["Attic", false],
    "UNFINISHED BASEMENT": ["Basement", false],
    "FINISHED BASEMENT": ["Basement",true],
    "UNFINISHED CARPORT": ["Carport", false],
    "WAREHOUSE": [null,true],
    "UNFINISHED UPPER STORY": [null, false],
    "UNFINISHED BASE": ["Basement", false],
    "AVERAGE FINISHED OFFICE": ["Home Office",true],
    "ATRIUM": [null,true],
    "FINISHED MEZZANINE": [null,true],
    "AUTO SERVICE GARAGE": ["Attached Garage",true],
    "UNFINISHED MEZZANINE": [null, false],
    "WAREHOUSE OFFICE": ["Home Office",true],
    "BAR": ["Bar Area",true],
    "COLD STORAGE AREA": ["Storage Room",true],
    "RESTAURANT": [null,true],
    "BASE - CONTROLLED CLIMATE": ["Basement",true],
    "APARTMENT": [null,true],
    "KITCHEN": ["Kitchen",true],
    "GLASS GREEN HOUSE": ["Greenhouse",true],
  }
  if (label in layoutMapping) {
    return layoutMapping[label];
  }
  return [null, null];
}

function buildLayoutsFromBuildings(buildings, buildingAllLayouts) {
  let lIdx = 1;
  const layouts = [];
  buildings.forEach((b, bIdx) => {
    const numberOfBeds = toInt(b["Bedrooms"]);
    const numberOfBaths = toInt(b["Baths"]);
    layouts.push(defaultLayout("Building", (bIdx + 1), (bIdx + 1), toInt(b["Conditioned Area"]), toInt(b["Actual Area"]), true));
    if (numberOfBeds) {
      for (let i = 0; i < numberOfBeds; i++) {
        layouts.push(defaultLayout("Bedroom", (bIdx + 1), (i + 1), null, null, true));
      }
    }
    if (numberOfBaths) {
      for (let i = 0; i < numberOfBaths; i++) {
        layouts.push(defaultLayout("Full Bathroom", (bIdx + 1), (i + 1), null, null, true));
      }
    }
    if (bIdx < buildingAllLayouts.length) {
      const buildingLevelLayouts = buildingAllLayouts[bIdx];
      let j = 1;
      buildingLevelLayouts.forEach((layout) => {
        const layoutType = mapLayoutType(layout.label);
        if (layoutType[0]) {
          layouts.push(defaultLayout(layoutType[0], (bIdx + 1), j++, null, toInt(layout.area), layoutType[1]));
        }
      });
    }
  });
  return layouts;
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
  const buildingAllLayouts = collectLayouts($);
  if (buildingAllLayouts.length !== buildings.length) {
    throw new Error("Check parsing logic for this parcel");
  }
  const layouts = buildLayoutsFromBuildings(buildings, buildingAllLayouts);

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
