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

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Buildings";
const EXTRA_FEATURES_SECTION_TITLE = "Extra Features";

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
  if (val == null) return null;
  const num = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

function toInteger(val) {
  if (val == null) return null;
  const num = Number(String(val).replace(/[,]/g, "").trim());
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

function buildBuildingModels(buildings) {
  return buildings.map((b, idx) => {
    const bedrooms = toInteger(b["Bedrooms"]);
    const bathsRaw = b["Bathrooms"] != null ? b["Bathrooms"] : b["Baths"];
    const bathsValue = bathsRaw != null ? Number(String(bathsRaw).replace(/[,]/g, "").trim()) : null;
    const floors = toInteger(b["Stories"]);
    const rooms = [];
    if (bedrooms && bedrooms > 0) {
      rooms.push({ type: "Bedroom", count: bedrooms });
    }
    if (bathsValue && bathsValue > 0) {
      const fullBaths = Math.floor(bathsValue);
      const hasHalf = bathsValue - fullBaths >= 0.5;
      if (fullBaths > 0) {
        rooms.push({ type: "Full Bathroom", count: fullBaths });
      }
      if (hasHalf) {
        rooms.push({ type: "Half Bathroom", count: 1 });
      }
    }
    rooms.push({ type: "Kitchen", count: 1 });
    return {
      building_number: idx + 1,
      total_area_sq_ft: toNumber(b["Total Area"]),
      livable_area_sq_ft: toNumber(b["Heated Area"]),
      floor_count: floors || 0,
      rooms: rooms.filter((r) => r.count && r.count > 0),
    };
  });
}

function parseDimensions(text) {
  if (!text) return { length: null, width: null, height: null };
  const parts = text
    .split("x")
    .map((part) => {
      const cleaned = part.replace(/[^0-9.]/g, "").trim();
      if (!cleaned) return null;
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : null;
    });
  while (parts.length < 3) parts.push(null);
  return {
    length: parts[0],
    width: parts[1],
    height: parts[2],
  };
}

function collectExtraFeatures($) {
  const features = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        EXTRA_FEATURES_SECTION_TITLE,
    )
    .first();
  if (!section.length) return features;
  const table = section.find("table.tabular-data").first();
  if (!table.length) return features;
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const th = $tr.find("th").first();
    const tds = $tr.find("td");
    if (!th.length || tds.length < 4) return;
    const code = textTrim(
      th.clone().children().remove().end().text(),
    );
    const description = textTrim($(tds[0]).text());
    const dimensionsRaw = textTrim($(tds[1]).text());
    const units = toNumber($(tds[2]).text());
    const effectiveYear = textTrim($(tds[3]).text());
    const dims = parseDimensions(dimensionsRaw);
    if (!code && !description) return;
    features.push({
      code: code || null,
      description: description || null,
      units: units,
      dimensions: dims,
      effective_year_built: effectiveYear || null,
    });
  });
  return features;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);

  readJSON("property_seed.json");
  
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const buildingModels = buildBuildingModels(buildings);
  const extraFeatures = collectExtraFeatures($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    buildings: buildingModels,
    extra_features: extraFeatures,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
