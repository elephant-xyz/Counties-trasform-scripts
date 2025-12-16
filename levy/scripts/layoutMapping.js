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

const SUMMARY_SELECTOR =
  "#ctlBodyPane_ctl02_ctl01_dynamicSummaryData_divSummary";

function getPropId($) {
  let parcelId = null;
  $(`${SUMMARY_SELECTOR} table tr`).each(
    (_, el) => {
      const label = text($(el).find("th strong").first().text());
      if (!label) return;
      const lowered = label.toLowerCase();
      const compressed = lowered.replace(/\s+/g, "");
      if (
        lowered.includes("parcel id") ||
        lowered.includes("property id") ||
        lowered.includes("prop id") ||
        compressed.includes("parcelid") ||
        compressed.includes("propertyid") ||
        compressed.includes("propid")
      ) {
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

function extractTableMap($, $container) {
  const map = {};
  if (!$container || !$container.length) return map;
  const table = $container.is("table")
    ? $container
    : $container.find("table").first();
  const rows = table && table.length ? table.find("tr") : $container.find("tr");
  rows.each((_, tr) => {
    const $tr = $(tr);
    const label = text($tr.find("th").first().text());
    if (!label) return;
    let value = text($tr.find("td").first().text());
    if (!value) {
      value = text($tr.find("td span").first().text());
    }
    if (!value) {
      value = text($tr.find("td div").first().text());
    }
    if (value != null && value !== "") {
      map[label.toLowerCase()] = value;
    }
  });
  return map;
}

function isLikelyBuildingMap(map) {
  const keys = Object.keys(map);
  if (!keys.length) return false;
  const indicators = [
    "building type",
    "type",
    "total area",
    "gross",
    "heated area",
    "living area",
    "bedrooms",
    "bathrooms",
    "full bathrooms",
    "half bathrooms",
    "stories",
    "story",
    "year built",
    "actual year",
    "effective year",
    "exterior walls",
    "interior walls",
    "heat",
    "heating",
    "hvac",
    "air conditioning",
    "roof",
    "roofing",
    "floor cover",
    "flooring",
    "frame",
  ];
  const score = indicators.reduce(
    (count, indicator) =>
      count +
      (keys.some((key) => key.includes(indicator)) ? 1 : 0),
    0,
  );
  return score >= 2;
}

function collectBuildingEntries($, module) {
  const buckets = new Map();

  module.find("[id*='lstBuildings_']").each((_, element) => {
    const $el = $(element);
    const id = $el.attr("id") || "";
    const match = id.match(/lstBuildings_[^_]+/i);
    if (!match) return;
    const key = match[0];
    const bucket =
      buckets.get(key) || {
        identifier: key.replace(/^lstBuildings_/i, ""),
        left: null,
        right: null,
        extras: [],
      };
    const map = extractTableMap($, $el);
    if (!Object.keys(map).length) {
      return;
    }
    const loweredId = id.toLowerCase();
    if (!bucket.left && loweredId.includes("left")) {
      bucket.left = map;
    } else if (!bucket.right && loweredId.includes("right")) {
      bucket.right = map;
    } else {
      bucket.extras.push(map);
    }
    buckets.set(key, bucket);
  });

  const entries = [];
  if (buckets.size) {
    Array.from(buckets.values()).forEach((bucket, idx) => {
      const leftMap = bucket.left || bucket.extras.shift() || {};
      const rightMap = bucket.right || bucket.extras.shift() || {};
      entries.push({
        building_index: idx + 1,
        building_identifier: bucket.identifier || null,
        leftMap,
        rightMap,
      });
    });
    return entries;
  }

  const candidateMaps = [];
  module.find("table").each((_, table) => {
    const $table = $(table);
    const map = extractTableMap($, $table);
    if (!Object.keys(map).length) return;
    if (isLikelyBuildingMap(map)) {
      candidateMaps.push(map);
    }
  });

  if (!candidateMaps.length) return [];

  for (let i = 0; i < candidateMaps.length; i += 2) {
    const leftMap = candidateMaps[i];
    const rightMap = candidateMaps[i + 1] || {};
    entries.push({
      building_index: entries.length + 1,
      building_identifier: null,
      leftMap,
      rightMap,
    });
  }

  return entries;
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
    "Structure Information",
    "Improvement Information",
  ]);
  if (!buildingModule) return [];

  const buildings = [];

  const entries = collectBuildingEntries($, buildingModule);
  if (!entries.length) return buildings;

  entries.forEach((entry) => {
    const leftMap = entry.leftMap || {};
    const rightMap = entry.rightMap || {};

    const bedroomsVal =
      rightMap.bedrooms ||
      rightMap["bedroom"] ||
      rightMap["bed rooms"] ||
      rightMap["bed room"] ||
      leftMap["bedrooms"] ||
      null;
    const combinedBathVal =
      rightMap.bathrooms ||
      rightMap.baths ||
      rightMap["bath rooms"] ||
      rightMap["bath room"] ||
      leftMap["bathrooms"] ||
      null;
    const fullBathVal =
      rightMap["full bathrooms"] ||
      rightMap["full baths"] ||
      rightMap["full bath"] ||
      leftMap["full bathrooms"] ||
      null;
    const halfBathVal =
      rightMap["half bathrooms"] ||
      rightMap["half baths"] ||
      rightMap["half bath"] ||
      leftMap["half bathrooms"] ||
      null;

    const bathrooms =
      fullBathVal != null || halfBathVal != null
        ? {
            full: fullBathVal != null ? parseIntSafe(fullBathVal) || 0 : 0,
            half: halfBathVal != null ? parseIntSafe(halfBathVal) || 0 : 0,
          }
        : parseBathroomCounts(combinedBathVal);

    const storiesVal =
      rightMap.stories ||
      rightMap["number of stories"] ||
      leftMap.stories ||
      leftMap["number of stories"] ||
      null;
    const subAreas = [];
    const seenSubAreaTableIds = new Set();
    const appendSubAreasFromTable = ($table) => {
      if (!$table || !$table.length) return;
      const tableId = $table.attr("id");
      if (tableId && seenSubAreaTableIds.has(tableId)) return;
      if (tableId) seenSubAreaTableIds.add(tableId);

      const headers = [];
      const $headerRow = $table.find("thead tr").first();
      if ($headerRow && $headerRow.length) {
        $headerRow.find("th").each((idx, th) => {
          headers[idx] = text($(th).text()).toLowerCase();
        });
      }

      $table.find("tbody tr").each((_, tr) => {
        const $tr = $(tr);
        const headerCells = $tr.find("th");
        let dataCells = $tr.find("td");
        const hasCells = headerCells.length || dataCells.length;
        if (!hasCells) return;

        let label = text(headerCells.first().text());
        let headerOffset = headerCells.length;
        let usedTdAsLabel = false;

        if (!label && dataCells.length) {
          label = text(dataCells.eq(0).text());
          dataCells = dataCells.slice(1);
          usedTdAsLabel = true;
        }

        if (usedTdAsLabel) headerOffset += 1;

        const upperLabel = (label || "").toUpperCase();
        if (upperLabel.startsWith("TOTAL")) return;

        const subArea = {
          type: label || null,
          description: label || null,
          square_feet: null,
          finished_square_feet: null,
          perimeter: null,
        };

        dataCells.each((idx, td) => {
          const headerLabel = headers[idx + headerOffset] || "";
          const headerLower = headerLabel.toLowerCase();
          const valueText = text($(td).text());
          if (!valueText) return;

          if (headerLower.includes("description")) {
            subArea.description = valueText;
            return;
          }

          if (
            headerLower.includes("condition") ||
            headerLower.includes("finish")
          ) {
            const n = parseIntSafe(valueText);
            if (n != null) subArea.finished_square_feet = n;
            return;
          }

          if (headerLower.includes("perim")) {
            const n = parseFloatSafe(valueText);
            if (n != null) subArea.perimeter = n;
            return;
          }

          if (
            headerLower.includes("actual") ||
            headerLower.includes("sketch") ||
            headerLower.includes("area")
          ) {
            const n = parseIntSafe(valueText);
            if (n != null) {
              if (
                headerLower.includes("condition") ||
                headerLower.includes("finish")
              ) {
                if (subArea.finished_square_feet == null) {
                  subArea.finished_square_feet = n;
                }
              } else if (subArea.square_feet == null) {
                subArea.square_feet = n;
              } else if (subArea.finished_square_feet == null) {
                subArea.finished_square_feet = n;
              }
            }
            return;
          }

          const numeric = parseIntSafe(valueText);
          if (numeric != null && subArea.square_feet == null) {
            subArea.square_feet = numeric;
          }
        });

        if (!subArea.description && subArea.type) {
          subArea.description = subArea.type;
        }

        if (
          subArea.description ||
          subArea.square_feet != null ||
          subArea.finished_square_feet != null
        ) {
          subAreas.push(subArea);
        }
      });
    };

    const identifierLower =
      entry.building_identifier != null
        ? entry.building_identifier.toLowerCase()
        : null;

    buildingModule.find("table").each((_, table) => {
      const $table = $(table);
      const id = ($table.attr("id") || "").toLowerCase();
      if (!id || !id.includes("subarea")) return;
      if (
        identifierLower &&
        !id.includes(`lstbuildings_${identifierLower}`)
      )
        return;
      appendSubAreasFromTable($table);
    });

    const prefix = entry.building_identifier
      ? entry.building_identifier
      : `building_${entry.building_index}`;
    const sketchTableId = `${prefix}_dgSketchDetails`;
    const $sketchTable = buildingModule.find(`#${sketchTableId}`);
    if ($sketchTable && $sketchTable.length) {
      appendSubAreasFromTable($sketchTable);
    }

    buildings.push({
      building_index: entry.building_index,
      building_identifier: entry.building_identifier || null,
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

const ALLOWED_LAYOUT_SPACE_TYPES = new Set([
  "Building",
  "Living Room",
  "Family Room",
  "Great Room",
  "Dining Room",
  "Office Room",
  "Conference Room",
  "Class Room",
  "Plant Floor",
  "Kitchen",
  "Breakfast Nook",
  "Pantry",
  "Primary Bedroom",
  "Secondary Bedroom",
  "Guest Bedroom",
  "Children's Bedroom",
  "Nursery",
  "Full Bathroom",
  "Three-Quarter Bathroom",
  "Half Bathroom / Powder Room",
  "En-Suite Bathroom",
  "Jack-and-Jill Bathroom",
  "Primary Bathroom",
  "Laundry Room",
  "Mudroom",
  "Closet",
  "Bedroom",
  "Walk-in Closet",
  "Mechanical Room",
  "Storage Room",
  "Server/IT Closet",
  "Home Office",
  "Library",
  "Den",
  "Study",
  "Media Room / Home Theater",
  "Game Room",
  "Home Gym",
  "Music Room",
  "Craft Room / Hobby Room",
  "Prayer Room / Meditation Room",
  "Safe Room / Panic Room",
  "Wine Cellar",
  "Bar Area",
  "Greenhouse",
  "Attached Garage",
  "Detached Garage",
  "Carport",
  "Workshop",
  "Storage Loft",
  "Porch",
  "Screened Porch",
  "Sunroom",
  "Deck",
  "Patio",
  "Pergola",
  "Balcony",
  "Terrace",
  "Gazebo",
  "Pool House",
  "Outdoor Kitchen",
  "Lobby / Entry Hall",
  "Common Room",
  "Utility Closet",
  "Elevator Lobby",
  "Mail Room",
  "Janitor's Closet",
  "Pool Area",
  "Indoor Pool",
  "Outdoor Pool",
  "Hot Tub / Spa Area",
  "Shed",
  "Lanai",
  "Open Porch",
  "Enclosed Porch",
  "Attic",
  "Enclosed Cabana",
  "Attached Carport",
  "Detached Carport",
  "Detached Utility Closet",
  "Jacuzzi",
  "Courtyard",
  "Open Courtyard",
  "Screen Porch (1-Story)",
  "Screen Enclosure (2-Story)",
  "Screen Enclosure (3-Story)",
  "Screen Enclosure (Custom)",
  "Lower Garage",
  "Lower Screened Porch",
  "Stoop",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Fourth Floor",
  "Floor",
  "Basement",
  "Sub-Basement",
  "Living Area",
  "Barn",
]);

function isAllowedSpaceType(name) {
  if (!name) return false;
  return ALLOWED_LAYOUT_SPACE_TYPES.has(name);
}

function mapSubAreaSpaceType(subArea) {
  if (!subArea) return null;
  const typeCode = subArea.type ? subArea.type.toUpperCase() : "";
  const desc = subArea.description ? subArea.description.toUpperCase() : "";
  const collapsedDesc = desc.replace(/[^A-Z0-9]+/g, "");

  if (collapsedDesc.includes("FINISHEDOPENPORCH")) return "Porch";
  if (typeCode === "CPU" || (desc.includes("COVERED") && desc.includes("PARK")))
    return "Carport";
  if (typeCode === "EUF" || (desc.includes("ELEV") && desc.includes("UNFIN")))
    return "Storage Room";
  if (typeCode === "FLA" || desc.includes("FLOOR LIV")) return "Living Area";
  if (
    typeCode === "BAS" ||
    desc.includes("BASE AREA") ||
    desc === "BASE" ||
    desc.startsWith("BASE ")
  )
    return "Living Area";
  if (desc.includes("OP PR") || desc.includes("PRCH")) return "Open Porch";
  if (typeCode === "FOP" || desc.includes("OPEN PORCH")) return "Open Porch";
  if (desc.includes("SCREEN") && desc.includes("PORCH")) return "Screened Porch";
  if (desc.includes("PORCH")) return "Porch";
  if (desc.includes("UPPER STORY") || desc.includes("FINISHED UPPER"))
    return "Living Area";
  if (desc.includes("CANOPY")) return "Porch";
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

  buildings.forEach((building) => {
    const buildingIndex = building.building_index;
    const floorCount = Math.max(
      1,
      Math.round(parseFloatSafe(building.stories)) || 1,
    );

    (building.sub_areas || []).forEach((subArea) => {
      const mapped = mapSubAreaSpaceType(subArea);
      const fallbackLabel = titleCase(subArea.description || subArea.type || "Sub Area");
      const label = mapped || fallbackLabel;
      if (!isAllowedSpaceType(label)) return;
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
