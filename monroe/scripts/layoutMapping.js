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
  $("#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table tr").each(
    (_, el) => {
      const label = text($(el).find("th strong").first().text());
      if (!label) return;
      const lowered = label.toLowerCase();
      if (lowered.includes("parcel id") || lowered.includes("property id")) {
        const val = text($(el).find("td span").first().text());
        if (val) parcelId = val;
      }
    },
  );
  return parcelId || "unknown";
}

function normalizeTitle(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findModuleByTitle($, titles) {
  const list = Array.isArray(titles) ? titles : [titles];
  const targets = list
    .map((t) => normalizeTitle(t))
    .filter(Boolean);
  if (!targets.length) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = text(
      $section.find("> header .title, > header div.title").first().text(),
    );
    const normalizedHeader = normalizeTitle(headerTitle);
    if (
      normalizedHeader &&
      targets.some(
        (target) =>
          target === normalizedHeader ||
          normalizedHeader.includes(target) ||
          target.includes(normalizedHeader),
      )
    ) {
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
  const buildingModule = findModuleByTitle($, [
    "Buildings",
    "Building Information",
  ]);
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
    const storiesVal =
      rightMap.stories ||
      rightMap["number of stories"] ||
      leftMap.stories ||
      leftMap["number of stories"] ||
      null;
    const subAreas = [];
    const sketchTableId = `${prefix}_dgSketchDetails`;
    const $sketchTable = buildingModule.find(`#${sketchTableId}`);
    if ($sketchTable && $sketchTable.length) {
      $sketchTable.find("tbody tr").each((_, tr) => {
        const $tr = $(tr);
        const code = text($tr.find("th").first().text());
        if (code && code.toUpperCase() === "TOTAL") return;
        const tds = $tr.find("td");
        if (!tds || !tds.length) return;
        const description = text(tds.eq(0).text());
        const sketchArea = parseIntSafe(tds.eq(1).text());
        const finishedArea = parseIntSafe(tds.eq(2).text());
        const perimeter = parseFloatSafe(tds.eq(3).text());
        if (!code && !description && sketchArea == null) return;
        subAreas.push({
          type: code || null,
          description: description || null,
          square_feet: sketchArea,
          finished_square_feet: finishedArea,
          perimeter: perimeter != null ? perimeter : null,
        });
      });
    }

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
      stories: parseFloatSafe(storiesVal),
      sub_areas: subAreas,
    });
  });

  return buildings;
}

function mapSubAreaSpaceType(subArea) {
  if (!subArea) return null;
  const typeCode = subArea.type ? subArea.type.toUpperCase() : "";
  const desc = subArea.description ? subArea.description.toUpperCase() : "";

  if (typeCode === "CPU" || (desc.includes("COVERED") && desc.includes("PARK")))
    return "Carport";
  if (typeCode === "EUF" || (desc.includes("ELEV") && desc.includes("UNFIN")))
    return "Storage Room";
  if (typeCode === "FLA" || desc.includes("FLOOR LIV")) return "Living Area";
  if (typeCode === "BAS" || desc.includes("BASE AREA")) return "Living Area";
  if (desc.includes("OP PR") || desc.includes("PRCH")) return "Open Porch";
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
  if (desc.includes("STAIR") || desc.includes("STAIRWELL")) return null;
  return null;
}

function buildLayoutData($) {
  const buildings = parseBuildingSummaries($);

  const layouts = [];

  const allocateAcrossFloors = (count, floorCount) => {
    const assignments = [];
    if (!count) return assignments;
    const totalFloors = Math.max(1, floorCount || 1);
    const canAssignFloors = totalFloors === 1;
    for (let i = 0; i < count; i += 1) {
      assignments.push(canAssignFloors ? 1 : null);
    }
    return assignments;
  };

  buildings.forEach((building) => {
    const buildingIndex = building.building_index;
    const floorCount = Math.max(
      1,
      Math.round(parseFloatSafe(building.stories)) || 1,
    );

    allocateAcrossFloors(building.bedrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          space_type: "Bedroom",
          floor_number: floorNumber,
          floor_level: null,
          parent_building_index: buildingIndex,
        });
      },
    );

    allocateAcrossFloors(building.full_bathrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          space_type: "Full Bathroom",
          floor_number: floorNumber,
          floor_level: null,
          parent_building_index: buildingIndex,
        });
      },
    );

    allocateAcrossFloors(building.half_bathrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          space_type: "Half Bathroom / Powder Room",
          floor_number: floorNumber,
          floor_level: null,
          parent_building_index: buildingIndex,
        });
      },
    );

    (building.sub_areas || []).forEach((subArea) => {
      const mapped = mapSubAreaSpaceType(subArea);
      const label =
        mapped ||
        titleCase(subArea.description || subArea.type || "Sub Area");
      layouts.push({
        space_type: label,
        floor_number: floorCount === 1 ? 1 : null,
        floor_level: null,
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
