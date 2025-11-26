// Layout mapping script
// Reads input.html, parses with cheerio, maps to layout schema, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const p = path.resolve("input.html");
  if (!fs.existsSync(p)) {
    throw new Error("input.html not found");
  }
  return fs.readFileSync(p, "utf8");
}

function text(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t.length ? t : null;
}

function titleCase(str) {
  if (!str) return null;
  return String(str)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseIntSafe(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatSafe(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function getPropId($) {
  let parcelId = null;
  $("#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary table tr").each(
    (_, el) => {
      const label = text($(el).find("th strong").first().text());
      if (label && label.toLowerCase().includes("parcel id")) {
        const val = text($(el).find("td span").first().text());
        if (val) parcelId = val;
      }
    },
  );
  return parcelId || "unknown";
}

function findModuleByTitle($, title) {
  const wanted = title ? String(title).toLowerCase() : null;
  if (!wanted) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = text(
      $section.find("> header .title, > header div.title").first().text(),
    );
    if (headerTitle && headerTitle.toLowerCase() === wanted) {
      found = $section;
    }
  });
  return found;
}

function extractTableKeyValueMap($container) {
  const map = {};
  if (!$container || !$container.length) return map;
  $container.find("tr").each((_, tr) => {
    const $row = cheerio.load(tr);
    const label = text($row("th strong").first().text());
    if (!label) return;
    let value = text($row("td span").first().text());
    if (value == null) {
      value = text($row("td").first().text());
    }
    map[label.toLowerCase()] = value;
  });
  return map;
}

function parseBedroomCount(value) {
  const n = parseIntSafe(value);
  return Number.isFinite(n) ? n : 0;
}

function parseBathroomCounts(value) {
  const result = { full: 0, half: 0 };
  if (!value) return result;
  const raw = String(value);

  const slashMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    result.full = parseIntSafe(slashMatch[1]) || 0;
    result.half = parseIntSafe(slashMatch[2]) || 0;
    return result;
  }

  const decimalMatch = raw.match(/(\d+)[\.,](\d+)/);
  if (decimalMatch) {
    result.full = parseIntSafe(decimalMatch[1]) || 0;
    result.half = parseIntSafe(decimalMatch[2]) || 0;
    return result;
  }

  const fullMatch = raw.match(/(\d+)\s*(?:full\b|f\b)/i);
  const halfMatch = raw.match(/(\d+)\s*(?:half\b|h\b)/i);
  if (fullMatch || halfMatch) {
    result.full = fullMatch ? parseIntSafe(fullMatch[1]) || 0 : 0;
    result.half = halfMatch ? parseIntSafe(halfMatch[1]) || 0 : 0;
    return result;
  }

  const numbers = raw.match(/\d+/g);
  if (numbers && numbers.length) {
    result.full = parseIntSafe(numbers[0]) || 0;
    if (numbers.length > 1) {
      result.half = parseIntSafe(numbers[1]) || 0;
    }
  }
  return result;
}

function parseBuildingSummaries($) {
  const buildingModule = findModuleByTitle($, "Building Information");
  if (!buildingModule) return [];

  const leftSelector =
    "div[id$='dynamicBuildingDataLeftColumn_divSummary']";
  const buildings = [];

  buildingModule.find(leftSelector).each((idx, leftEl) => {
    const $left = $(leftEl);
    const leftId = $left.attr("id") || "";
    const prefix = leftId.replace(
      "_dynamicBuildingDataLeftColumn_divSummary",
      "",
    );
    const rightId = `${prefix}_dynamicBuildingDataRightColumn_divSummary`;
    const $right = buildingModule.find(`[id='${rightId}']`);

    const leftMap = extractTableKeyValueMap($left);
    const rightMap = extractTableKeyValueMap($right);

    const bedroomsVal =
      rightMap.bedrooms ||
      rightMap["bedroom"] ||
      rightMap["bed rooms"] ||
      rightMap["bed room"] ||
      null;
    const combinedBathVal =
      rightMap.bathrooms ||
      rightMap.baths ||
      rightMap["bath rooms"] ||
      rightMap["bath room"] ||
      null;
    const fullBathVal =
      rightMap["full bathrooms"] ||
      rightMap["full baths"] ||
      rightMap["full bath"] ||
      null;
    const halfBathVal =
      rightMap["half bathrooms"] ||
      rightMap["half baths"] ||
      rightMap["half bath"] ||
      null;

    const bathrooms =
      fullBathVal != null || halfBathVal != null
        ? {
            full: fullBathVal != null ? parseIntSafe(fullBathVal) || 0 : 0,
            half: halfBathVal != null ? parseIntSafe(halfBathVal) || 0 : 0,
          }
        : parseBathroomCounts(combinedBathVal);

    const identifierMatch = prefix.match(/lstBuildings_(ctl\d+)/i);

    buildings.push({
      building_index: idx + 1,
      building_identifier: identifierMatch ? identifierMatch[1] : null,
      building_type:
        leftMap.type != null ? titleCase(leftMap.type) : null,
      total_area_sq_ft: parseIntSafe(leftMap["total area"]),
      heated_area_sq_ft: parseIntSafe(leftMap["heated area"]),
      bedrooms: parseBedroomCount(bedroomsVal),
      full_bathrooms: bathrooms.full || 0,
      half_bathrooms: bathrooms.half || 0,
      stories: parseFloatSafe(rightMap.stories),
      sub_areas: [],
    });
  });

  return buildings;
}

function parseSubAreas($) {
  const subAreaModule = findModuleByTitle($, "Sub Area");
  if (!subAreaModule) return [];
  const tables = [];
  subAreaModule
    .find("table[id*='lstSubAreaSqFt']")
    .each((_, table) => {
      const rows = [];
      const $table = $(table);
      $table.find("tbody tr").each((__, tr) => {
        const $tr = $(tr);
        const type = text($tr.find("th").first().text());
        const description = text($tr.find("td").eq(0).text());
        const squareFeet = parseIntSafe($tr.find("td").eq(1).text());
        const actYear = parseIntSafe($tr.find("td").eq(2).text());
        const effYear = parseIntSafe($tr.find("td").eq(3).text());
        const quality = text($tr.find("td").eq(4).text());
        const improvementUse = text($tr.find("td").eq(5).text());
        const improvementUseDescription = text(
          $tr.find("td").eq(6).text(),
        );
        if (!type && !description && squareFeet == null) return;
        rows.push({
          type: type || null,
          description: description || null,
          square_feet: squareFeet,
          actual_year_built: actYear,
          effective_year_built: effYear,
          quality: quality || null,
          improvement_use: improvementUse || null,
          improvement_use_description: improvementUseDescription || null,
        });
      });
      tables.push(rows);
    });
  return tables;
}

function mapSubAreaSpaceType(subArea) {
  if (!subArea) return null;
  const typeCode = subArea.type ? subArea.type.toUpperCase() : "";
  const desc = subArea.description ? subArea.description.toUpperCase() : "";

  if (typeCode === "BAS" || desc.includes("BASE AREA")) return "Living Area";
  if (typeCode === "FOP" || desc.includes("OPEN PORCH")) return "Open Porch";
  if (desc.includes("SCREEN") && desc.includes("PORCH")) return "Screened Porch";
  if (desc.includes("PORCH")) return "Porch";
  if (desc.includes("BALCONY")) return "Balcony";
  if (desc.includes("DECK")) return "Deck";
  if (desc.includes("PATIO")) return "Patio";
  if (desc.includes("GAZEBO")) return "Gazebo";
  if (desc.includes("STORAGE")) return "Storage Room";
  if (desc.includes("GARAGE")) return desc.includes("DET") ? "Detached Garage" : "Attached Garage";
  if (desc.includes("CARPORT")) return "Carport";
  if (desc.includes("POOL")) return "Pool Area";
  if (desc.includes("LANAI")) return "Lanai";
  if (desc.includes("SUN ROOM") || desc.includes("SUNROOM")) return "Sunroom";
  if (desc.includes("ENCLOSED PORCH")) return "Enclosed Porch";
  if (desc.includes("OPEN PORCH")) return "Open Porch";
  if (desc.includes("PAVILION")) return "Gazebo";
  if (desc.includes("CABANA")) return "Enclosed Cabana";
  if (desc.includes("BARN")) return "Barn";
  if (desc.includes("STAIR") || desc.includes("STAIRWELL")) return null;
  return null;
}

function buildLayoutData($) {
  const buildings = parseBuildingSummaries($);
  const subAreaSets = parseSubAreas($);

  buildings.forEach((building, idx) => {
    building.sub_areas = Array.isArray(subAreaSets[idx])
      ? subAreaSets[idx]
      : [];
  });

  const layouts = [];

  buildings.forEach((building) => {
    const buildingIndex = building.building_index;
    for (let i = 0; i < (building.bedrooms || 0); i += 1) {
      layouts.push({
        space_type: "Bedroom",
        floor_level: "1st Floor",
        parent_building_index: buildingIndex,
      });
    }
    for (let i = 0; i < (building.full_bathrooms || 0); i += 1) {
      layouts.push({
        space_type: "Full Bathroom",
        floor_level: "1st Floor",
        parent_building_index: buildingIndex,
      });
    }
    for (let i = 0; i < (building.half_bathrooms || 0); i += 1) {
      layouts.push({
        space_type: "Half Bathroom / Powder Room",
        floor_level: "1st Floor",
        parent_building_index: buildingIndex,
      });
    }
    (building.sub_areas || []).forEach((subArea) => {
      const mapped = mapSubAreaSpaceType(subArea);
      if (!mapped) return;
      layouts.push({
        space_type: mapped,
        floor_level: "1st Floor",
        size_square_feet: subArea.square_feet || null,
        parent_building_index: buildingIndex,
      });
    });
  });

  return { buildings, layouts };
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const parcelId = getPropId($);
  const layoutData = buildLayoutData($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const data = {};
  data[`property_${parcelId}`] = layoutData;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath} for property_${parcelId}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
