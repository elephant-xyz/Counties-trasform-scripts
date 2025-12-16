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

const LAYOUT_SPACE_TYPE_ENUMS = [
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
  "Children’s Bedroom",
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
  "Janitor’s Closet",
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
  "Floor",
  "Basement",
  "Sub-Basement",
  "Living Area",
  "Barn",
];

const layoutSpaceTypeMap = new Map(
  LAYOUT_SPACE_TYPE_ENUMS.map((entry) => [
    entry
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
    entry,
  ]),
);

function normalizeLayoutSpaceType(value, fallback) {
  const candidates = [];
  const push = (val) => {
    if (val == null) return;
    const trimmed = String(val).trim();
    if (!trimmed) return;
    candidates.push(trimmed);
  };
  push(value);
  push(fallback);

  const tryMatch = (candidate) => {
    const normalized = candidate
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!normalized) return null;
    if (layoutSpaceTypeMap.has(normalized)) {
      return layoutSpaceTypeMap.get(normalized);
    }
    if (/half\s*bath|powder/.test(normalized))
      return "Half Bathroom / Powder Room";
    if (/three\s*quarter/.test(normalized) || /3\/4/.test(normalized))
      return "Three-Quarter Bathroom";
    if (/full\s*bath/.test(normalized)) return "Full Bathroom";
    if (/bath/.test(normalized)) return "Full Bathroom";
    if (/primary\s*bed/.test(normalized)) return "Primary Bedroom";
    if (/secondary\s*bed/.test(normalized)) return "Secondary Bedroom";
    if (/bedroom/.test(normalized)) return "Bedroom";
    if (/kitchen/.test(normalized)) return "Kitchen";
    if (/laundry/.test(normalized)) return "Laundry Room";
    if (/garage/.test(normalized)) return "Attached Garage";
    if (/detached\s*garage/.test(normalized)) return "Detached Garage";
    if (/carport/.test(normalized)) return "Carport";
    if (/porch/.test(normalized) && /screen/.test(normalized))
      return "Screened Porch";
    if (/open\s*porch/.test(normalized)) return "Open Porch";
    if (/porch/.test(normalized)) return "Porch";
    if (/living\s*area/.test(normalized)) return "Living Area";
    if (/living\s*room/.test(normalized)) return "Living Room";
    if (/floor/.test(normalized)) return "Floor";
    if (/storage/.test(normalized)) return "Storage Room";
    if (/deck/.test(normalized)) return "Deck";
    if (/patio/.test(normalized)) return "Patio";
    if (/balcony/.test(normalized)) return "Balcony";
    if (/lanai/.test(normalized)) return "Lanai";
    if (/gazebo/.test(normalized)) return "Gazebo";
    if (/pool\s*area/.test(normalized)) return "Pool Area";
    if (/sunroom/.test(normalized)) return "Sunroom";
    if (/basement/.test(normalized)) return "Basement";
    return null;
  };

  for (const candidate of candidates) {
    const resolved = tryMatch(candidate);
    if (resolved) return resolved;
  }

  return "Living Area";
}

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const SUB_AREA_TYPE_TO_SPACE_TYPE = {
  BAS: "Living Area",
  BSM: "Basement",
  CAR: "Carport",
  CPU: "Carport",
  DGA: "Detached Garage",
  FCP: "Carport",
  FLA: "Living Area",
  FOP: "Open Porch",
  FPR: "Open Porch",
  FSP: "Screened Porch",
  FST: "Storage Room",
  FUS: "Living Area",
  GAR: "Attached Garage",
  JCR: "Courtyard",
  LAN: "Lanai",
  OPR: "Open Porch",
  PAT: "Patio",
  PTO: "Patio",
  SCR: "Screened Porch",
  SGR: "Sunroom",
  STG: "Storage Room",
  STP: "Stoop",
  UGA: "Attached Garage",
  UOP: "Open Porch",
  UPR: "Open Porch",
};

function getPropId($) {
  let parcelId = null;
  const summarySelector =
    "div[id$='_dynamicSummaryData_divSummary'], div[id$='_dynamicSummary_divSummary']";
  $(`${summarySelector} table tr`).each((_, el) => {
    const label = text($(el).find("th strong").first().text());
    if (!label) return;
    const lowered = label.toLowerCase();
    if (lowered.includes("parcel id") || lowered.includes("property id")) {
      const val = text($(el).find("td span").first().text());
      if (val) parcelId = val;
    }
  });
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
      leftMap.bedrooms ||
      leftMap["bedroom"] ||
      leftMap["bed rooms"] ||
      leftMap["bed room"] ||
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
      leftMap["full bathrooms"] ||
      leftMap["full baths"] ||
      leftMap["full bath"] ||
      null;
    const halfBathVal =
      rightMap["half bathrooms"] ||
      rightMap["half baths"] ||
      rightMap["half bath"] ||
      leftMap["half bathrooms"] ||
      leftMap["half baths"] ||
      leftMap["half bath"] ||
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

  if (SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode]) {
    return normalizeLayoutSpaceType(
      SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode],
      SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode],
    );
  }
  if (typeCode === "EUF" || (desc.includes("ELEV") && desc.includes("UNFIN")))
    return normalizeLayoutSpaceType("Storage Room", "Storage Room");
  if (typeCode === "FLA" || desc.includes("FLOOR LIV") || typeCode === "BAS")
    return normalizeLayoutSpaceType("Living Area", "Living Area");
  if (desc.includes("DET") && desc.includes("GAR"))
    return normalizeLayoutSpaceType("Detached Garage", "Detached Garage");
  if (desc.includes("GARAGE"))
    return normalizeLayoutSpaceType("Attached Garage", "Attached Garage");
  if (desc.includes("CARPORT"))
    return normalizeLayoutSpaceType("Carport", "Carport");
  if (desc.includes("SCREEN") && desc.includes("PORCH"))
    return normalizeLayoutSpaceType("Screened Porch", "Screened Porch");
  if (desc.includes("PORCH"))
    return normalizeLayoutSpaceType("Open Porch", "Open Porch");
  if (desc.includes("BALCONY"))
    return normalizeLayoutSpaceType("Balcony", "Balcony");
  if (desc.includes("DECK")) return normalizeLayoutSpaceType("Deck", "Deck");
  if (desc.includes("PATIO")) return normalizeLayoutSpaceType("Patio", "Patio");
  if (desc.includes("GAZEBO"))
    return normalizeLayoutSpaceType("Gazebo", "Gazebo");
  if (desc.includes("STORAGE"))
    return normalizeLayoutSpaceType("Storage Room", "Storage Room");
  if (desc.includes("LANAI")) return normalizeLayoutSpaceType("Lanai", "Lanai");
  if (desc.includes("SUN ROOM") || desc.includes("SUNROOM"))
    return normalizeLayoutSpaceType("Sunroom", "Sunroom");
  if (desc.includes("CABANA"))
    return normalizeLayoutSpaceType("Enclosed Cabana", "Enclosed Cabana");
  if (desc.includes("POOL"))
    return normalizeLayoutSpaceType("Pool Area", "Pool Area");
  return null;
}

function buildLayoutData($) {
  const buildings = parseBuildingSummaries($);

  const floors = [];
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

    for (let floorNumber = 1; floorNumber <= floorCount; floorNumber += 1) {
      floors.push({
        building_index: buildingIndex,
        space_type: "Floor",
        floor_number: floorNumber,
        floor_level: `${ordinalSuffix(floorNumber)} Floor`,
        is_exterior: false,
        size_square_feet: null,
      });
    }

    allocateAcrossFloors(building.bedrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          building_index: buildingIndex,
          space_type: normalizeLayoutSpaceType("Bedroom", "Bedroom"),
          floor_number: floorNumber,
          floor_level:
            floorNumber != null ? `${ordinalSuffix(floorNumber)} Floor` : null,
          is_exterior: false,
          size_square_feet: null,
        });
      },
    );

    allocateAcrossFloors(building.full_bathrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          building_index: buildingIndex,
          space_type: normalizeLayoutSpaceType(
            "Full Bathroom",
            "Full Bathroom",
          ),
          floor_number: floorNumber,
          floor_level:
            floorNumber != null ? `${ordinalSuffix(floorNumber)} Floor` : null,
          is_exterior: false,
          size_square_feet: null,
        });
      },
    );

    allocateAcrossFloors(building.half_bathrooms || 0, floorCount).forEach(
      (floorNumber) => {
        layouts.push({
          building_index: buildingIndex,
          space_type: normalizeLayoutSpaceType(
            "Half Bathroom / Powder Room",
            "Half Bathroom / Powder Room",
          ),
          floor_number: floorNumber,
          floor_level:
            floorNumber != null ? `${ordinalSuffix(floorNumber)} Floor` : null,
          is_exterior: false,
          size_square_feet: null,
        });
      },
    );

    (building.sub_areas || []).forEach((subArea) => {
      const mapped = mapSubAreaSpaceType(subArea);
      if (!mapped) return;
      const size = parseIntSafe(subArea.square_feet) || null;
      const floorNumber = floorCount === 1 ? 1 : null;
      layouts.push({
        building_index: buildingIndex,
        space_type: mapped,
        floor_number: floorNumber,
        floor_level:
          floorNumber != null ? `${ordinalSuffix(floorNumber)} Floor` : null,
        is_exterior: false,
        size_square_feet: size,
      });
    });

    const buildingHasLayouts = layouts.some(
      (layout) => layout.building_index === buildingIndex,
    );
    if (!buildingHasLayouts) {
      const floorNumber = floorCount === 1 ? 1 : null;
      layouts.push({
        building_index: buildingIndex,
        space_type: normalizeLayoutSpaceType("Living Area", "Living Area"),
        floor_number: floorNumber,
        floor_level:
          floorNumber != null ? `${ordinalSuffix(floorNumber)} Floor` : null,
        is_exterior: false,
        size_square_feet: null,
      });
    }
  });

  const propertySummary = buildings.reduce(
    (acc, building) => {
      acc.bedrooms += parseIntSafe(building.bedrooms) || 0;
      acc.full_bathrooms += parseIntSafe(building.full_bathrooms) || 0;
      acc.half_bathrooms += parseIntSafe(building.half_bathrooms) || 0;
      return acc;
    },
    { bedrooms: 0, full_bathrooms: 0, half_bathrooms: 0 },
  );

  return {
    buildings,
    floors,
    layouts,
    property_summary: propertySummary,
  };
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
