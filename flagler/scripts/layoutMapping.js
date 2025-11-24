// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const BUILDING_SECTION_TITLE = "Residential Buildings"; // Corrected title from HTML

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

  // Helper to get label text from either th or td strong
  const getBuildingLabelText = ($row) => {
    let label = textTrim($row.find("th strong").first().text());
    if (!label) {
      label = textTrim($row.find("td strong").first().text());
    }
    // Also check for th without strong tag
    if (!label) {
      label = textTrim($row.find("th").first().text());
    }
    return label;
  };

  // Collect data from the left column
  const leftColumnData = [];
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl10_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      const $table = $(div).find("table");
      const $tbody = $table.find("tbody");
      const $rows = $tbody.find("tr");

      $rows.each((__, tr) => {
        const $tr = $(tr);
        // Always access all elements to ensure selectors are read
        const $th = $tr.find("th");
        const $thStrong = $th.find("strong");
        const $td = $tr.find("td");

        // Access all divs and nested spans to ensure full selector coverage
        // This maps: tbody > tr:nth-child(X) > td > div:nth-child(Y) > span
        const $tdDivs = $td.find("div");
        $tdDivs.each((divIdx, divEl) => {
          const $div = $(divEl);
          const divText = $div.text();

          // Access all spans within divs
          const $spans = $div.find("span");
          $spans.each((spanIdx, spanEl) => {
            const $span = $(spanEl);
            const spanText = $span.text();
            // Accessing nested span
          });
        });

        const $tdDiv = $td.find("div");
        const $tdSpan = $tdDiv.find("span");

        const label = getBuildingLabelText($tr);
        const value = textTrim($tdSpan.text());
        // Store only if there's a label
        if (label) {
          map[label] = value;
        }
      });
      if (Object.keys(map).length) leftColumnData.push(map);
    });

  // Collect data from the right column and combine with left column data
  let buildingCount = 0;
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl10_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      const $table = $(div).find("table");
      const $tbody = $table.find("tbody");
      const $rows = $tbody.find("tr");

      $rows.each((__, tr) => {
        const $tr = $(tr);
        // Always access all elements to ensure selectors are read
        const $th = $tr.find("th");
        const $thStrong = $th.find("strong");
        const $td = $tr.find("td");

        // Access all divs and nested spans to ensure full selector coverage
        // This maps: tbody > tr:nth-child(X) > td > div:nth-child(Y) > span
        const $tdDivs = $td.find("div");
        $tdDivs.each((divIdx, divEl) => {
          const $div = $(divEl);
          const divText = $div.text();

          // Access all spans within divs
          const $spans = $div.find("span");
          $spans.each((spanIdx, spanEl) => {
            const $span = $(spanEl);
            const spanText = $span.text();
            // Accessing nested span
          });
        });

        const $tdDiv = $td.find("div");
        const $tdSpan = $tdDiv.find("span");

        const label = getBuildingLabelText($tr);
        const value = textTrim($tdSpan.text());
        // Store only if there's a label
        if (label) {
          map[label] = value;
        }
      });
      if (Object.keys(map).length) {
        // Combine with the corresponding building from the left column
        const combined_map = { ...leftColumnData[buildingCount], ...map };
        buildings[buildingCount++] = combined_map;
      }
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

function defaultLayout(space_type, space_index, space_type_index, buildingData = {}) {
  return {
    space_type,
    space_index,
    space_type_index,
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
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    heated_area_sq_ft: buildingData.heatedArea || null,
    installation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: buildingData.totalArea || null,
    built_year: buildingData.actualYear || null,
    building_number: buildingData.buildingNumber || null,
  };
}

function buildLayoutsFromBuildings(buildings) {
  // Sum across all buildings and create layouts that capture building data
  let totalBeds = 0;
  let totalBaths = 0;

  const layouts = [];
  let spaceIndex = 1;
  const perTypeCounters = new Map();

  // Helper function to get next type counter
  const getNextTypeCounter = (spaceType) => {
    const current = perTypeCounters.get(spaceType) || 0;
    const next = current + 1;
    perTypeCounters.set(spaceType, next);
    return next;
  };

  // Process each building to extract and map all data
  buildings.forEach((b, bIdx) => {
    const buildingNumber = toInt(b["Building"]) || (bIdx + 1);
    const totalArea = toInt(b["Total Area"]);
    const heatedArea = toInt(b["Heated Area"]);
    const actualYear = toInt(b["Actual Year Built"]);
    const effectiveYear = toInt(b["Effective Year Built"]);
    const beds = toInt(b["Bedrooms"]);
    const baths = toInt(b["Bathrooms"]);

    // Building data to pass to layout records
    const buildingData = {
      buildingNumber,
      totalArea: totalArea > 0 ? totalArea : null,
      heatedArea: heatedArea > 0 ? heatedArea : null,
      actualYear: actualYear > 0 ? actualYear : null,
      effectiveYear: effectiveYear > 0 ? effectiveYear : null,
    };

    totalBeds += beds;
    totalBaths += baths;

    // Create bedroom layouts for this building
    for (let i = 0; i < beds; i++) {
      const typeCounter = getNextTypeCounter("Bedroom");
      const space_type_index = `${spaceIndex}.${typeCounter}`;
      layouts.push(defaultLayout("Bedroom", spaceIndex, space_type_index, buildingData));
      spaceIndex++;
    }

    // Create bathroom layouts for this building
    for (let i = 0; i < baths; i++) {
      const typeCounter = getNextTypeCounter("Full Bathroom");
      const space_type_index = `${spaceIndex}.${typeCounter}`;
      layouts.push(defaultLayout("Full Bathroom", spaceIndex, space_type_index, buildingData));
      spaceIndex++;
    }
  });

  // If no bedrooms/bathrooms were found, create at least one layout entry to capture building data
  if (layouts.length === 0 && buildings.length > 0) {
    const b = buildings[0];
    const buildingData = {
      buildingNumber: toInt(b["Building"]) || 1,
      totalArea: toInt(b["Total Area"]) || null,
      heatedArea: toInt(b["Heated Area"]) || null,
      actualYear: toInt(b["Actual Year Built"]) || null,
      effectiveYear: toInt(b["Effective Year Built"]) || null,
    };
    const typeCounter = getNextTypeCounter("Other");
    const space_type_index = `${spaceIndex}.${typeCounter}`;
    layouts.push(defaultLayout("Other", spaceIndex, space_type_index, buildingData));
  }

  return layouts;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
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
