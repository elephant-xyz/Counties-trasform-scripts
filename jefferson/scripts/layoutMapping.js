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
const EXTRA_FEATURE_SECTION_TITLE = "Extra Features";

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

function parseCount(raw) {
  const n = toInt(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractRoomsFromBuilding(buildingMap) {
  const rooms = [];
  const bedrooms = parseCount(
    buildingMap["Bedrooms"] ||
      buildingMap["Bedroom"] ||
      buildingMap["Beds"] ||
      buildingMap["Bed Rooms"],
  );
  const fullBaths = parseCount(
    buildingMap["Bathrooms"] ||
      buildingMap["Baths"] ||
      buildingMap["Full Bathrooms"] ||
      buildingMap["Full Baths"],
  );
  const halfBaths = parseCount(
    buildingMap["Half Bathrooms"] || buildingMap["Half Baths"],
  );
  if (bedrooms > 0) {
    rooms.push({ space_type: "Bedroom", count: bedrooms });
  }
  if (fullBaths > 0) {
    rooms.push({ space_type: "Full Bathroom", count: fullBaths });
  }
  if (halfBaths > 0) {
    rooms.push({ space_type: "Half Bathroom / Powder Room", count: halfBaths });
  }
  return rooms;
}

function collectExtraFeatures($) {
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        EXTRA_FEATURE_SECTION_TITLE,
    )
    .first();
  if (!section.length) return [];
  const rows = section.find("table tbody tr");
  const features = [];
  rows.each((_, tr) => {
    const $tr = $(tr);
    const code = textTrim($tr.find("th").first().text());
    const tds = $tr.find("td");
    if (!tds.length) return;
    const description = textTrim($(tds[0]).text());
    const sizeText = textTrim($(tds[2]).text());
    const units = parseNumber(sizeText);
    const unitType = textTrim($(tds[3]).text()) || null;
    const yearBuilt = textTrim($(tds[4]).text()) || null;
    features.push({
      code: code || null,
      description: description || null,
      units,
      raw_units_text: sizeText || null,
      unit_type: unitType,
      year_built: yearBuilt,
    });
  });
  return features;
}

function mapExtraFeatureToLayout(feature) {
  const desc = (feature.description || "").toUpperCase();
  let spaceType = null;
  if (/PAV|PAVE|ASPHALT/.test(desc)) spaceType = "Patio";
  else if (/SLB|SLAB|CONC/.test(desc)) spaceType = "Patio";
  else if (/FENCE|CHAIN/.test(desc)) spaceType = "Courtyard";
  else if (/SHED/.test(desc)) spaceType = "Shed";
  else if (/BARN/.test(desc)) spaceType = "Barn";
  else if (/CARPORT/.test(desc)) spaceType = "Carport";
  else if (/GARAGE/.test(desc)) spaceType = "Detached Garage";
  else if (/DECK/.test(desc)) spaceType = "Deck";
  else if (/PORCH/.test(desc)) spaceType = "Porch";
  else if (/PATIO/.test(desc)) spaceType = "Patio";
  else if (/GAZEBO/.test(desc)) spaceType = "Gazebo";
  else if (/POOL/.test(desc)) spaceType = "Pool Area";
  else if (/DOCK/.test(desc)) spaceType = "Deck";
  else if (/COURT/.test(desc)) spaceType = "Courtyard";
  if (!spaceType) return null;
  const size_square_feet =
    feature.unit_type && feature.unit_type.toUpperCase() === "SF"
      ? feature.units
      : null;
  return {
    space_type: spaceType,
    size_square_feet,
    is_exterior: true,
  };
}

function buildBuildingLayouts(buildings) {
  return buildings.map((b, idx) => {
    const rawType = (b["Type"] || "").toUpperCase();
    const isExtra = rawType.includes("EXTRA");
    const totalArea = toInt(
      b["Total Area"] || b["Total Sq Ft"] || b["Total Living Area"],
    );
    const heatedArea = toInt(
      b["Heated Area"] ||
        b["Heated"] ||
        b["Living Area"] ||
        b["Liv Area"] ||
        b["Heated Living Area"],
    );
    return {
      building_id: `building_${idx + 1}`,
      building_number: idx + 1,
      total_area_sq_ft: totalArea > 0 ? totalArea : null,
      livable_area_sq_ft: heatedArea > 0 ? heatedArea : null,
      source_building_type: b["Type"] || null,
      is_extra: isExtra,
      rooms: extractRoomsFromBuilding(b),
      floors: [],
    };
  });
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const buildingLayouts = buildBuildingLayouts(buildings);
  const extraFeatures = collectExtraFeatures($).map((feature) => {
    const layoutHint = mapExtraFeatureToLayout(feature);
    return { ...feature, layout_hint: layoutHint };
  });

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    buildings: buildingLayouts,
    extra_features: extraFeatures,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
