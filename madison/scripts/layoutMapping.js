// Layout mapping script
// Parses the building information module and extra features to build layout metadata

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function asNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractBuildingAttributes($, $section) {
  const raw = {};
  $section.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const label =
      textTrim($tr.find("th strong").text()) || textTrim($tr.find("th").text());
    const value =
      textTrim($tr.find("td span").text()) || textTrim($tr.find("td").text());
    if (label) raw[label.toLowerCase()] = value || null;
  });
  return raw;
}

function parseBuildings($) {
  const buildings = [];
  const rows = $(
    "#ctlBodyPane_ctl11_mSection .module-content > .block-row",
  ).toArray();

  rows.forEach((row) => {
    const $row = $(row);
    const left = $row.find(
      "[id$='dynamicBuildingDataLeftColumn_divSummary']",
    );
    const right = $row.find(
      "[id$='dynamicBuildingDataRightColumn_divSummary']",
    );
    if (!left.length && !right.length) return;

    const raw = {};
    if (left.length) Object.assign(raw, extractBuildingAttributes($, left));
    if (right.length) Object.assign(raw, extractBuildingAttributes($, right));
    if (Object.keys(raw).length === 0) return;

    const building = {
      building_index: buildings.length + 1,
      raw,
    };

    building.type = raw["type"] || null;
    building.total_area_sq_ft = asNumber(raw["total area"]);
    building.livable_area_sq_ft =
      asNumber(raw["heated area"]) || asNumber(raw["livable area"]);
    building.bedrooms = asNumber(raw["bedrooms"]) || 0;
    building.bathrooms = asNumber(raw["bathrooms"]) || 0;
    building.stories = asNumber(raw["stories"]) || null;
    building.heat = raw["heat"] || null;
    building.air_conditioning = raw["air conditioning"] || null;
    building.exterior_walls = raw["exterior walls"] || null;
    building.interior_walls = raw["interior walls"] || null;
    building.floor_cover = raw["floor cover"] || null;
    building.roof_cover = raw["roof cover"] || null;
    building.frame_type = raw["frame type"] || null;
    building.actual_year_built = asNumber(raw["actual year built"]);
    building.effective_year_built = asNumber(raw["effective year built"]);
    building.value = asNumber(raw["value"]);

    const rooms = [];
    if (building.bedrooms > 0)
      rooms.push({ space_type: "Bedroom", count: building.bedrooms });
    if (building.bathrooms > 0)
      rooms.push({ space_type: "Full Bathroom", count: building.bathrooms });
    building.rooms = rooms;

    buildings.push(building);
  });

  return buildings;
}

function parseExtraFeatures($) {
  const features = [];
  const table = $("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
  table.find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td");
    if (!cells.length) return;
    const feature = {
      code: textTrim(cells.eq(0).text()) || null,
      description: textTrim(cells.eq(1).text()) || null,
      length_width: textTrim(cells.eq(2).text()) || null,
      area_sq_ft: asNumber(cells.eq(3).text()),
      year_built: asNumber(cells.eq(4).text()),
      value: asNumber(cells.eq(5).text()),
    };
    if (feature.description) features.push(feature);
  });
  return features;
}

function mapFeatureToLayout(feature) {
  const description = (feature.description || "").toUpperCase();
  const map = [
    { keywords: ["PORCH"], space_type: "Porch" },
    { keywords: ["DECK"], space_type: "Deck" },
    { keywords: ["PATIO"], space_type: "Patio" },
    { keywords: ["CARPORT"], space_type: "Carport" },
    { keywords: ["GARAGE"], space_type: "Garage" },
  ];
  for (const entry of map) {
    if (entry.keywords.some((keyword) => description.includes(keyword))) {
      return {
        space_type: entry.space_type,
        description: feature.description,
        area_sq_ft: feature.area_sq_ft,
        year_built: feature.year_built,
        source: "extra_feature",
      };
    }
  }
  return null;
}

function buildLayoutData($) {
  const buildings = parseBuildings($);
  const features = parseExtraFeatures($);
  const extraLayouts = [];

  features.forEach((feature) => {
    const layout = mapFeatureToLayout(feature);
    if (layout) extraLayouts.push(layout);
  });

  return { buildings, extra_layouts: extraLayouts };
}

function getParcelId($) {
  const parcel = textTrim($(PARCEL_SELECTOR).text());
  return parcel || null;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");

  const layoutData = buildLayoutData($);
  const outObj = {};
  outObj[`property_${parcelId}`] = layoutData;

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
