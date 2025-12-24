// Layout mapping script: parses input.html and outputs owners/layout_data.json per schema
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml(filename) {
  const html = fs.readFileSync(filename, "utf8");
  return cheerio.load(html);
}

function cleanText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(label) {
  return cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseNumber(value) {
  if (value == null) return null;
  const normalized = cleanText(value).replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseBuildingNumber(headerText, index) {
  const match = (headerText || "").match(/building\s+(\d+)/i);
  if (match) return Number(match[1]);
  return index + 1;
}

function extractCharacteristics($, section) {
  const characteristics = {};
  $(section)
    .find("table.report-table tbody > tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 2) return;
      const label = cleanText($(cells[0]).text());
      if (!label) return;
      const code = cleanText($(cells[1]).text());
      const description =
        cells[2] !== undefined ? cleanText($(cells[2]).text()) : "";
      const key = normalizeKey(label);
      if (!characteristics[key]) characteristics[key] = [];
      characteristics[key].push({ label, code, description });
    });
  return characteristics;
}


function extractBuildingAreas($, section) {
  const header = section
    .find("h5")
    .filter((_, el) => /building sub areas/i.test(cleanText($(el).text())))
    .first();
  if (!header.length) return { grossArea: null, heatedArea: null };

  const totalsRow = header
    .nextAll("div.table-container")
    .first()
    .find("table tfoot tr")
    .first();
  if (!totalsRow.length) return { grossArea: null, heatedArea: null };

  const cells = totalsRow.find("th");
  if (cells.length < 3) return { grossArea: null, heatedArea: null };

  const grossArea = parseNumber(cells.eq(1).text());
  const heatedArea = parseNumber(cells.eq(2).text());
  return { grossArea, heatedArea };
}

function getCountFromCharacteristics(raw, label) {
  const entries = raw.characteristics[normalizeKey(label)] || [];
  if (!entries.length) return 0;
  const value = entries[0].description || entries[0].code;
  const number = parseNumber(value);
  return number != null ? number : 0;
}

function createLayout(spaceType, spaceTypeIndex, buildingNumber) {
  return {
    space_type: spaceType,
    space_type_index: spaceTypeIndex,
    building_number: buildingNumber,
    area_under_air_sq_ft: null,
    heated_area_sq_ft: null,
    total_area_sq_ft: null,
    flooring_material_type: null,
    size_square_feet: null,
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

function extractLayouts($) {
  const propertyIdentifier =
    cleanText($("td[data-bind*='displayStrap']").text())
  const propertyKey = propertyIdentifier
    ? `property_${propertyIdentifier}`
    : "property_unknown";

  const container = $("div[data-bind='foreach: buildings()']");
  const layouts = [];

  container.find("h4.section-header").each((index, header) => {
    const buildingHeader = cleanText($(header).text());
    const buildingNumber = parseBuildingNumber(buildingHeader, index);
    const buildingContent = $(header).nextUntil("h4.section-header");
    const sectionWrap = buildingContent.filter("div.section-wrap").first();
    if (!sectionWrap.length) return;

    const characteristics = extractCharacteristics($, sectionWrap);
    const buildingAreas = extractBuildingAreas($, sectionWrap);
    const raw = { buildingNumber, characteristics };

    const bedroomCount = getCountFromCharacteristics(raw, "Bedrooms");
    const bathroomCount = getCountFromCharacteristics(raw, "Bathrooms");

    const buildingLayout = createLayout("Building", String(buildingNumber), buildingNumber);
    if (buildingAreas.grossArea != null) {
      buildingLayout.size_square_feet = buildingAreas.grossArea;
      buildingLayout.total_area_sq_ft = buildingAreas.grossArea;
    }
    if (buildingAreas.heatedArea != null) {
      buildingLayout.heated_area_sq_ft = buildingAreas.heatedArea;
      buildingLayout.area_under_air_sq_ft = buildingAreas.heatedArea;
    }
    layouts.push(buildingLayout);

    // Bedrooms number sequentially (1.1, 1.2, ...)
    for (let i = 1; i <= bedroomCount; i++) {
      const bedroomIndex = `${buildingNumber}.${i}`;
      layouts.push(createLayout("Bedroom", bedroomIndex, buildingNumber));
    }

    const fullBathroomCount = Math.floor(bathroomCount);
    const hasHalfBath = bathroomCount - fullBathroomCount >= 0.5;

    // Full bathrooms share numbering sequence with bedrooms
    for (let i = 1; i <= fullBathroomCount; i++) {
      const bathroomIndex = `${buildingNumber}.${i}`;
      layouts.push(
        createLayout("Full Bathroom", bathroomIndex, buildingNumber),
      );
    }

    if (hasHalfBath) {
      const halfIndex = `${buildingNumber}.1`;
      layouts.push(
        createLayout("Half Bathroom / Powder Room", halfIndex, buildingNumber),
      );
    }
  });

  return { propertyKey, layouts };
}

(function main() {
  const $ = loadHtml("input.html");
  const { propertyKey, layouts } = extractLayouts($);
  const payload = { [propertyKey]: { layouts } };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "layout_data.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  console.log("owners/layout_data.json written");
})();
