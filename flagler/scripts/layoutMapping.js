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
  const candidates = [];
  $("section table tr").each((_, el) => {
    const $row = $(el);
    const label = text(
      $row.find("th strong, th").first().text(),
    );
    if (!label) return;
    const value = text(
      $row.find("td span, td").first().text(),
    );
    if (!value) return;
    const lower = label.toLowerCase();
    if (lower.includes("parcel id")) {
      candidates.push({ priority: 0, value });
    } else if (lower.includes("prop id")) {
      candidates.push({ priority: 1, value });
    } else if (lower.includes("property id")) {
      candidates.push({ priority: 2, value });
    }
  });
  if (!candidates.length) return "unknown";
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].value;
}

function findModuleByTitle($, titles) {
  if (!titles) return null;
  const list = Array.isArray(titles) ? titles : [titles];
  const targets = list
    .map((item) => {
      if (item instanceof RegExp) return item;
      if (item == null) return null;
      const str = String(item).trim().toLowerCase();
      return str.length ? str : null;
    })
    .filter(Boolean);
  if (!targets.length) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = text(
      $section.find("> header .title, > header div.title").first().text(),
    );
    if (!headerTitle) return;
    const normalized = headerTitle.trim().toLowerCase();
    const matches = targets.some((target) => {
      if (target instanceof RegExp) return target.test(normalized);
      return normalized === target || normalized.includes(target);
    });
    if (matches) {
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
    "Building Information",
    "Building Information Summary",
    "Residential Buildings",
    "Commercial Buildings",
    "Buildings",
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
  const subAreaModule = findModuleByTitle($, [
    "Sub Area",
    "Building Area Types",
  ]);
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

const VALID_LAYOUT_SPACE_TYPES = new Set([
  "Bedroom",
  "Full Bathroom",
  "Half Bathroom / Powder Room",
  "Attached Garage",
  "Detached Garage",
  "Carport",
  "Living Area",
  "Storage Room",
  "Open Porch",
  "Screened Porch",
  "Porch",
  "Sunroom",
  "Deck",
  "Patio",
  "Pergola",
  "Balcony",
  "Terrace",
  "Gazebo",
  "Pool Area",
  "Lanai",
  "Enclosed Porch",
  "Enclosed Cabana",
  "Outdoor Kitchen",
  "Workshop",
  "Shed",
  "Courtyard",
  "Open Courtyard",
  "Basement",
  "Sub-Basement",
  "Floor",
  "Building",
]);

const SUBAREA_TYPE_MAP = new Map(
  Object.entries({
    BAS: "Living Area",
    FBA: "Full Bathroom",
    HBA: "Half Bathroom / Powder Room",
    BED: "Bedroom",
    GAR: "Attached Garage",
    FGR: "Attached Garage",
    GAR1: "Attached Garage",
    GAR2: "Detached Garage",
    DGA: "Detached Garage",
    UGR: "Detached Garage",
    AGR: "Attached Garage",
    POOL: "Pool Area",
    POL: "Pool Area",
    FOP: "Open Porch",
    OPR: "Open Porch",
    UOP: "Open Porch",
    SOP: "Open Porch",
    ENC: "Enclosed Porch",
    EPO: "Enclosed Porch",
    SPR: "Screened Porch",
    LPO: "Lanai",
    LAN: "Lanai",
    PAT: "Patio",
    ATP: "Patio",
    BAL: "Balcony",
    DEC: "Deck",
    DCK: "Deck",
    TRR: "Terrace",
    GAZ: "Gazebo",
    CAR: "Carport",
    CPR: "Carport",
    UCP: "Carport",
    SHD: "Shed",
    WSH: "Workshop",
    STG: "Storage Room",
    STR: "Storage Room",
    MSP: "Outdoor Kitchen",
    ODK: "Outdoor Kitchen",
    CAB: "Enclosed Cabana",
    CBN: "Enclosed Cabana",
    BSM: "Basement",
    SBA: "Sub-Basement",
    FLR: "Floor",
    CYN: "Courtyard",
    OCY: "Open Courtyard",
  }),
);

const SUBAREA_DESCRIPTION_PATTERNS = [
  { pattern: /BASE\s+AREA/i, value: "Living Area" },
  { pattern: /\bBED\b|\bBEDROOM/i, value: "Bedroom" },
  { pattern: /\bFULL BATH|FULL\s+BATHROOM/i, value: "Full Bathroom" },
  { pattern: /\bHALF BATH|\bHALF\s+BATHROOM|\bPOWDER/i, value: "Half Bathroom / Powder Room" },
  { pattern: /GARAGE/i, value: "Attached Garage" },
  { pattern: /DET\s+GARAGE|DETACHED\s+GAR/i, value: "Detached Garage" },
  { pattern: /CARPORT/i, value: "Carport" },
  { pattern: /POOL\s+AREA|POOL/i, value: "Pool Area" },
  { pattern: /LANAI/i, value: "Lanai" },
  { pattern: /SUN\s*ROOM|SUNROOM/i, value: "Sunroom" },
  { pattern: /SCREEN/i, value: "Screened Porch" },
  { pattern: /OPEN\s+PORCH/i, value: "Open Porch" },
  { pattern: /PORCH/i, value: "Porch" },
  { pattern: /BALCONY/i, value: "Balcony" },
  { pattern: /DECK/i, value: "Deck" },
  { pattern: /PATIO/i, value: "Patio" },
  { pattern: /PERGOLA/i, value: "Pergola" },
  { pattern: /GAZEBO|PAVILION/i, value: "Gazebo" },
  { pattern: /CABANA/i, value: "Enclosed Cabana" },
  { pattern: /STORAGE|STOR/i, value: "Storage Room" },
  { pattern: /WORKSHOP/i, value: "Workshop" },
  { pattern: /SHED/i, value: "Shed" },
  { pattern: /COURTYARD/i, value: "Courtyard" },
];

function normalizeLayoutSpaceType(candidate) {
  if (!candidate) return null;
  if (VALID_LAYOUT_SPACE_TYPES.has(candidate)) return candidate;
  return null;
}

function mapSubAreaSpaceType(subArea) {
  if (!subArea) return null;
  const typeCode = subArea.type ? subArea.type.trim().toUpperCase() : "";
  const desc = subArea.description ? subArea.description.trim() : "";

  const directMapped = typeCode ? SUBAREA_TYPE_MAP.get(typeCode) : null;
  const normalizedDirect = normalizeLayoutSpaceType(directMapped);
  if (normalizedDirect) return normalizedDirect;

  if (desc) {
    for (const { pattern, value } of SUBAREA_DESCRIPTION_PATTERNS) {
      if (pattern.test(desc)) {
        const normalizedValue = normalizeLayoutSpaceType(value);
        if (normalizedValue) return normalizedValue;
      }
    }
  }

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
      const spaceType = normalizeLayoutSpaceType(mapped) || "Living Area";
      layouts.push({
        space_type: spaceType,
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
