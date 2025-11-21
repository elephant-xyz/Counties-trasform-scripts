// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const BUILDING_SECTION_TITLE = "Building Information";
const SUBAREA_SECTION_TITLE = "Sub Area";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
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
        const combined_map = { ...buildings[buildingCount], ...map };
        buildings[buildingCount++] = combined_map;
      }
    });
  return buildings;
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseYear(val) {
  const num = parseNumber(val);
  if (!num) return null;
  const year = Math.round(num);
  return year > 0 ? year : null;
}

const SUBAREA_SPACE_TYPE_MAP = {
  CAN30: { space_type: "Open Porch", is_exterior: true },
  MRES: {
    space_type: "Living Area",
    set_livable: true,
    set_area_under_air: true,
  },
  SPRINKLERS: { space_type: "Mechanical Room", is_exterior: false },
  CLUBH: { space_type: "Common Room", is_exterior: false },
  STOR: { space_type: "Storage Room", is_exterior: false },
  PO: { space_type: "Office Room", is_exterior: false },
  AALTIN: { space_type: "Utility Closet", is_exterior: false },
  AALTPL: { space_type: "Deck", is_exterior: true },
  AAPVASAV: { space_type: "Patio", is_exterior: true },
  AASPCNAV: { space_type: "Outdoor Pool", is_exterior: true },
  CLF5: { space_type: "Open Courtyard", is_exterior: true },
  CONC: { space_type: "Patio", is_exterior: true },
  FCALUMN: { space_type: "Open Courtyard", is_exterior: true },
  FCPVC6PRIV: { space_type: "Open Courtyard", is_exterior: true },
  PPCK: { space_type: "Patio", is_exterior: true },
};

function collectSubAreaTables($) {
  const tables = [];
  $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        SUBAREA_SECTION_TITLE,
    )
    .find('table[id$="_gvwSubAreaSqFtDetail"]')
    .each((_, table) => {
      const rows = [];
      $(table)
        .find("tbody tr")
        .each((__, tr) => {
          const code = textTrim($(tr).find("th").first().text());
          if (!code) return;
          const tds = $(tr).find("td");
          if (tds.length < 2) return;
          const description = textTrim($(tds[0]).text());
          const squareFeet = parseNumber($(tds[1]).text());
          rows.push({
            code,
            description,
            squareFeet,
          });
        });
      tables.push(rows);
    });
  return tables;
}

function buildLayoutsFromBuildings(buildings, subAreaTables) {
  const layouts = [];
  let globalSpaceIndex = 1;

  buildings.forEach((building, i) => {
    const buildingNumber = i + 1;
    const totalArea = parseNumber(
      building["Total Area"] || building["Total Adjusted Area"],
    );
    const heatedArea = parseNumber(
      building["Heated Area"] || building["Living Area"],
    );
    const builtYear = parseYear(
      building["Actual Year Built"] || building["Effective Year Built"],
    );

    const livableArea =
      heatedArea != null ? heatedArea : totalArea != null ? totalArea : null;
    const areaUnderAir =
      heatedArea != null ? heatedArea : totalArea != null ? totalArea : null;

    const buildingLayout = {
      space_type: "Building",
      space_type_index: `${buildingNumber}`,
      space_index: globalSpaceIndex++,
      building_number: buildingNumber,
      total_area_sq_ft: totalArea,
      livable_area_sq_ft: livableArea,
      area_under_air_sq_ft: areaUnderAir,
      built_year: builtYear,
      layout_has_layout: [],
      layout_has_utility: [],
      layout_has_structure: [],
    };
    layouts.push(buildingLayout);

    let childCounter = 1;
    const appendChildLayout = (spaceType, options = {}) => {
      const child = {
        space_type: spaceType,
        space_type_index: `${buildingNumber}.${childCounter}`,
        space_index: globalSpaceIndex++,
        building_number: buildingNumber,
        flooring_material_type: null,
        size_square_feet: options.size_square_feet ?? null,
        floor_level: null,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        is_finished: options.is_finished ?? true,
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
        is_exterior: options.is_exterior ?? false,
        pool_condition: null,
        pool_surface_type: null,
        pool_water_quality: null,
        layout_has_layout: [],
        layout_has_structure: [],
        layout_has_utility: [],
      };
      if (options.set_livable_area && child.size_square_feet != null) {
        child.livable_area_sq_ft = child.size_square_feet;
      }
      if (options.set_area_under_air && child.size_square_feet != null) {
        child.area_under_air_sq_ft = child.size_square_feet;
      }
      layouts.push(child);
      buildingLayout.layout_has_layout.push(layouts.length);
      childCounter += 1;
    };

    const subAreaRows = subAreaTables[i] || [];
    const groupedByCode = new Map();
    subAreaRows.forEach((row) => {
      const mapping = SUBAREA_SPACE_TYPE_MAP[row.code];
      if (!mapping) return;
      const group = groupedByCode.get(row.code) || {
        code: row.code,
        mapping,
        totalSqft: 0,
      };
      if (row.squareFeet != null) group.totalSqft += row.squareFeet;
      groupedByCode.set(row.code, group);
    });

    groupedByCode.forEach((group) => {
      appendChildLayout(group.mapping.space_type, {
        size_square_feet:
          group.totalSqft && group.totalSqft > 0
            ? Math.round(group.totalSqft)
            : null,
        is_exterior: group.mapping.is_exterior ?? false,
        set_livable_area: group.mapping.set_livable ?? false,
        set_area_under_air: group.mapping.set_area_under_air ?? false,
      });
    });

    const bedroomCount = parseNumber(building["Bedrooms"]) || 0;
    for (let b = 0; b < bedroomCount; b += 1) {
      appendChildLayout("Bedroom");
    }

    const bathroomCount = parseNumber(building["Bathrooms"]) || 0;
    for (let b = 0; b < bathroomCount; b += 1) {
      appendChildLayout("Full Bathroom");
    }

    // Ensure at least one interior layout per building
    if (buildingLayout.layout_has_layout.length === 0) {
      appendChildLayout("Living Area", {
        size_square_feet: heatedArea ?? null,
        set_livable_area: true,
        set_area_under_air: true,
      });
    }
  });

  return layouts;
}

// Read parcel id from property_seed.json
const seedPath = path.join(process.cwd(), "property_seed.json");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = seedData.parcel_id;
  const buildings = collectBuildings($);
  const subAreaTables = collectSubAreaTables($);
  const layouts = buildLayoutsFromBuildings(buildings, subAreaTables);

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
