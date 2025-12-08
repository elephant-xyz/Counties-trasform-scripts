// Layout extractor: reads input.html, parses with cheerio, writes owners/layout_data.json
// Uses only cheerio for HTML parsing. Creates per-room layout objects when identifiable; otherwise returns empty layouts array.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Add the ensureDir function here
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  return { $, html };
}

function extractPropertyId($) {
  const scripts = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scripts.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
  if (m) return m[1].trim();
  const h = $('h2:contains("Parcel")').first().text();
  const m2 = h.match(/Parcel\s+([^\s]+)/i);
  if (m2) return m2[1].trim();
  return "unknown_id";
}

const LAND_DOR_CODES = new Set([
  "00",
  "10",
  "40",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "70",
  "80",
  "90",
  "93",
  "94",
  "95",
  "96",
  "97",
  "99",
]);

const LIVABLE_SUBAREA_CODES = new Set([
  "BAS",
  "APT",
  "FUS",
  "FHS",
  "FBM",
  "LFA",
  "LBG",
  "LBA",
  "MEF",
  "MEZ",
  "OHA",
  "OHB",
  "GOF",
  "FOF",
]);

const SUBAREA_LAYOUT_MAP = {
  FGR: { space_type: "Attached Garage", is_exterior: true },
  GAR: { space_type: "Attached Garage", is_exterior: true },
  FEP: { space_type: "Enclosed Porch", is_exterior: true },
  FSP: { space_type: "Screened Porch", is_exterior: true },
  FOP: { space_type: "Open Porch", is_exterior: true },
  FCP: { space_type: "Carport", is_exterior: true },
  FDC: { space_type: "Detached Carport", is_exterior: true },
  FDU: { space_type: "Detached Utility Closet", is_exterior: true },
  FDS: { space_type: "Screened Porch", is_exterior: true },
  FHO: { space_type: "Hot Tub / Spa Area", is_exterior: true },
  FSO: { space_type: "Sunroom", is_exterior: true },
};

const EXTRA_FEATURE_LAYOUT_MAP = {
  "0020": { space_type: "Courtyard", is_exterior: true },
  "0031": { space_type: "Open Courtyard", is_exterior: true },
  "0032": { space_type: "Patio", is_exterior: true },
  "0034": { space_type: "Courtyard", is_exterior: true },
  "0050": { space_type: "Open Courtyard", is_exterior: true },
  "0061": { space_type: "Deck", is_exterior: true },
  "0062": { space_type: "Deck", is_exterior: true },
  "0071": { space_type: "Deck", is_exterior: true },
  "0075": { space_type: "Deck", is_exterior: true },
  "0076": { space_type: "Gazebo", is_exterior: true },
  "0077": { space_type: "Gazebo", is_exterior: true },
  "0079": { space_type: "Gazebo", is_exterior: true },
  "0081": { space_type: "Screened Porch", is_exterior: true },
  "0201": { space_type: "Open Porch", is_exterior: true },
  "0202": { space_type: "Screened Porch", is_exterior: true },
  "0203": { space_type: "Screened Porch", is_exterior: true },
  "0212": { space_type: "Screened Porch", is_exterior: true },
  "0213": { space_type: "Screened Porch", is_exterior: true },
  "0222": { space_type: "Screened Porch", is_exterior: true },
  "0223": { space_type: "Screened Porch", is_exterior: true },
  "0232": { space_type: "Enclosed Cabana", is_exterior: true },
  "0233": { space_type: "Enclosed Cabana", is_exterior: true },
  "0242": { space_type: "Detached Utility Closet", is_exterior: true },
  "0252": { space_type: "Enclosed Cabana", is_exterior: true },
  "0253": { space_type: "Enclosed Cabana", is_exterior: true },
  "0262": { space_type: "Sunroom", is_exterior: true },
  "0263": { space_type: "Sunroom", is_exterior: true },
  "0312": { space_type: "Outdoor Pool", is_exterior: true },
  "0314": { space_type: "Hot Tub / Spa Area", is_exterior: true },
  "0315": { space_type: "Hot Tub / Spa Area", is_exterior: true },
  "0330": { space_type: "Pergola", is_exterior: true },
  "0331": { space_type: "Pergola", is_exterior: true },
  "0332": { space_type: "Pergola", is_exterior: true },
  "0336": { space_type: "Pergola", is_exterior: true },
  "0341": { space_type: "Shed", is_exterior: true },
  "0342": { space_type: "Shed", is_exterior: true },
  "0343": { space_type: "Shed", is_exterior: true },
  "0352": { space_type: "Shed", is_exterior: true },
  "0353": { space_type: "Shed", is_exterior: true },
  "0354": { space_type: "Detached Garage", is_exterior: true },
  "0357": { space_type: "Shed", is_exterior: true },
  "0392": { space_type: "Barn", is_exterior: true },
  "0399": { space_type: "Detached Garage", is_exterior: true },
  "0430": { space_type: "Courtyard", is_exterior: true },
  "0431": { space_type: "Courtyard", is_exterior: true },
};

function findNextTableWithHeader($, startElement, headerText) {
  let current = $(startElement);
  while (current.length) {
    current = current.next();
    if (!current.length) break;
    if (current.is("table")) {
      const firstHeader = current.find("thead th").first();
      if (firstHeader && firstHeader.text().trim() === headerText) return current;
    }
    const nested = current
      .find("table")
      .filter((__, tbl) => {
        const firstHeader = $(tbl).find("thead th").first();
        return firstHeader && firstHeader.text().trim() === headerText;
      })
      .first();
    if (nested.length) return nested;
  }
  return $();
}

function getElementsMap($, root) {
  let table;
  const scope = root || $;
  scope("table").each((i, el) => {
    const ths = $(el).find("thead th");
    if (ths.length && $(ths[0]).text().trim() === "Element") {
      table = el;
      return false;
    }
  });
  const map = {};
  if (!table) return map;
  $(table)
    .find("tbody tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 3) {
        const key = $(tds[0]).text().trim();
        const codeVal = tds.eq(1).text().trim();
        const descVal = tds.eq(2).text().trim();
        map[key] = codeVal || descVal;
      }
    });
  return map;
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractDorCode($) {
  let code = null;
  $('b:contains("DOR Code:")').each((_, el) => {
    if (code) return;
    const anchor = $(el).nextAll("a").first();
    if (anchor && anchor.length) {
      const text = anchor.text().trim();
      const match = text.match(/^(\d{2,4})/);
      if (match) code = match[1];
    }
  });
  return code;
}

function extractBuildingSections($) {
  const sections = [];
  $("b").each((_, el) => {
    const label = $(el).text().trim();
    const match = label.match(/^Building\s+(\d+)/i);
    if (!match) return;
    const buildingNumber = parseInt(match[1], 10);

    const summaryTable = $(el)
      .nextAll(".table-responsive")
      .first()
      .find("table")
      .first();
    const elementTable = findNextTableWithHeader($, el, "Element");

    let effectiveArea = null;
    let builtYear = null;
    if (summaryTable && summaryTable.length) {
      const dataRow = summaryTable.find("tr").eq(1);
      const cells = dataRow.find("td");
      if (cells.length) {
        effectiveArea = parseNumber(cells.eq(2).text());
        builtYear = parseNumber(cells.eq(6).text());
      }
    }

    const subareasHeader = $(el)
      .nextAll("b")
      .filter((i, b) => $(b).text().trim().toLowerCase() === "subareas")
      .first();

    const subareas = [];
    let totalGrossArea = null;
    let totalAdjustedArea = null;
    const elements = {};
    if (elementTable && elementTable.length) {
      elementTable.find("tr").each((__, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const key = $(tds[0]).text().trim();
          const codeVal = tds.eq(1).text().trim();
          const descVal = tds.eq(2).text().trim();
          if (key) elements[key] = codeVal || descVal;
        }
      });
    }
    if (subareasHeader && subareasHeader.length) {
      const subareaTable = subareasHeader
        .nextAll(".table-responsive")
        .first()
        .find("table")
        .first();
      if (subareaTable && subareaTable.length) {
        subareaTable.find("tbody tr").each((__, tr) => {
          const tds = $(tr).find("td");
          if (!tds.length) return;
          const code = $(tds[0]).text().trim();
          const grossArea = parseNumber($(tds[1]).text());
          const adjustedArea = parseNumber($(tds[3]).text());
          subareas.push({
            code,
            gross_area: grossArea,
            adjusted_area: adjustedArea,
          });
        });
        const tfootCells = subareaTable.find("tfoot td");
        if (tfootCells.length >= 4) {
          totalGrossArea = parseNumber(tfootCells.eq(1).text());
          totalAdjustedArea = parseNumber(tfootCells.eq(3).text());
        }
      }
    }

    sections.push({
      building_number: Number.isFinite(buildingNumber)
        ? buildingNumber
        : sections.length + 1,
      effective_area: effectiveArea,
      built_year: builtYear,
      subareas,
      total_gross_area: totalGrossArea,
      total_adjusted_area: totalAdjustedArea,
      elements,
    });
  });
  return sections;
}

function sumLivableArea(subareas, fallback) {
  let total = 0;
  subareas.forEach((sa) => {
    if (!sa || !sa.code) return;
    if (LIVABLE_SUBAREA_CODES.has(sa.code)) {
      total += sa.gross_area || 0;
    }
  });
  if (total === 0) return fallback || null;
  return total;
}

function extractElementCodeValue($, label) {
  let value = null;
  $("table").each((_, el) => {
    if (value != null) return;
    const ths = $(el).find("thead th");
    if (!(ths.length && $(ths[0]).text().trim() === "Element")) return;
    $(el)
      .find("tbody tr")
      .each((__, tr) => {
        if (value != null) return;
        const tds = $(tr).find("td");
        if (tds.length < 2) return;
        const key = $(tds[0]).text().trim();
        if (key === label) {
          value = parseNumber($(tds[1]).text());
        }
      });
  });
  return value;
}

function extractExtraFeatures($) {
  const header = $('h3:contains("Extra Features")').first();
  if (!header.length) return [];
  const table = header
    .nextAll(".table-responsive")
    .first()
    .find("table")
    .first();
  if (!table.length) return [];
  const features = [];
  table.find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const code = tds.eq(0).text().trim();
    const description = tds.eq(1).text().trim();
    const buildingRef = tds.eq(2).text().trim();
    const length = parseNumber(tds.eq(3).text());
    const width = parseNumber(tds.eq(4).text());
    const units = parseNumber(tds.eq(5).text());
    features.push({
      code,
      description,
      buildingRef,
      length,
      width,
      units,
    });
  });
  return features;
}

function buildLayouts($) {
  const dorCode = extractDorCode($);
  const isLand = dorCode ? LAND_DOR_CODES.has(dorCode) : false;
  const buildingSections = extractBuildingSections($);
  if (isLand && buildingSections.length === 0) return [];

  const globalElements = getElementsMap($);
  const defaultBedroomsRaw =
    extractElementCodeValue($, "Bedrooms") ||
    parseNumber(globalElements["Bedrooms"]) ||
    0;
  const defaultBedrooms = Math.max(0, Math.round(defaultBedroomsRaw));
  const defaultBathFixturesRaw =
    extractElementCodeValue($, "Bath Fixtures") ||
    parseNumber(globalElements["Bath Fixtures"]) ||
    0;
  const defaultBathrooms = Math.max(
    defaultBedrooms > 0 ? 1 : 0,
    Math.round(defaultBathFixturesRaw) || 0,
  );
  const defaultRoomsRaw =
    extractElementCodeValue($, "Rooms / Floor") ||
    parseNumber(globalElements["Rooms / Floor"]) ||
    0;
  const defaultRooms = Math.max(0, Math.round(defaultRoomsRaw));

  const sectionsToUse =
    buildingSections.length > 0
      ? buildingSections
      : isLand
        ? []
        : [
            {
              building_number: 1,
              effective_area: null,
              built_year: null,
              subareas: [],
              total_gross_area: null,
              total_adjusted_area: null,
              elements: globalElements,
            },
          ];

const layouts = [];
let globalSpaceIndex = 1;
const buildingTypeCounters = new Map();
const extraFeatures = extractExtraFeatures($);
const buildingIndices = [];
const sectionByBuildingIndex = new Map();
const featureBuildingRefsRaw = Array.from(
  new Set(
    extraFeatures
      .map((feature) => (feature.buildingRef || "").trim())
      .filter((ref) => ref),
  ),
);
const featureBuildingRefs = featureBuildingRefsRaw
  .map((ref) => {
    const digits = ref.replace(/\D/g, "");
    const num = digits ? Number.parseInt(digits, 10) : Number.NaN;
    return { raw: ref, digits, num };
  })
  .filter((item) => Number.isFinite(item.num))
  .sort((a, b) => a.num - b.num);

  const pushChildLayout = (buildingIndex, section, config = {}) => {
    let typeMap = buildingTypeCounters.get(buildingIndex);
    if (!typeMap) {
      typeMap = new Map();
      buildingTypeCounters.set(buildingIndex, typeMap);
    }
    const nextIndex = typeMap.get(config.space_type) || 1;
    typeMap.set(config.space_type, nextIndex + 1);
    const childIndex = `${buildingIndex}.${nextIndex}`;
    layouts.push({
      space_type: config.space_type,
      space_index: globalSpaceIndex++,
      space_type_index: childIndex,
      parent_space_index: buildingIndex,
      size_square_feet: config.size_square_feet ?? null,
      is_exterior: config.is_exterior ?? false,
      is_finished: config.is_finished ?? true,
      livable_area_sq_ft: config.livable_area_sq_ft ?? null,
      total_area_sq_ft: config.total_area_sq_ft ?? null,
      area_under_air_sq_ft: config.area_under_air_sq_ft ?? null,
      heated_area_sq_ft: config.heated_area_sq_ft ?? null,
      building_number: section.building_number || Number(buildingIndex),
      floor_level: config.floor_level ?? null,
      has_windows: config.has_windows ?? null,
    });
  };

  sectionsToUse.forEach((section, idx) => {
    const buildingPosition = idx + 1;
    const buildingIndex = String(buildingPosition);
    buildingIndices.push(buildingIndex);
    buildingTypeCounters.set(buildingIndex, new Map());
    sectionByBuildingIndex.set(buildingIndex, section);

    const totalArea =
      section.total_gross_area != null
        ? section.total_gross_area
        : section.effective_area;
    const adjustedArea =
      section.total_adjusted_area != null
        ? section.total_adjusted_area
        : section.effective_area;
    const livableArea = sumLivableArea(section.subareas, adjustedArea);

    layouts.push({
      space_type: "Building",
      space_index: globalSpaceIndex++,
      space_type_index: buildingIndex,
      parent_space_index: null,
      total_area_sq_ft: totalArea ?? null,
      size_square_feet: adjustedArea ?? null,
      livable_area_sq_ft: livableArea ?? null,
      area_under_air_sq_ft: livableArea ?? null,
      heated_area_sq_ft: livableArea ?? null,
      building_number: section.building_number || buildingPosition,
      built_year: section.built_year ?? null,
      is_finished: true,
    });

    const elementMap =
      (section && section.elements && Object.keys(section.elements).length
        ? section.elements
        : null) || null;
    const buildingBedroomsRaw =
      elementMap && elementMap["Bedrooms"] != null
        ? parseNumber(elementMap["Bedrooms"])
        : null;
    let buildingBedrooms = 0;
    if (buildingBedroomsRaw != null) {
      buildingBedrooms = Math.max(0, Math.round(buildingBedroomsRaw));
    } else if (idx === 0) {
      buildingBedrooms = defaultBedrooms;
    }

    const buildingBathFixturesRaw =
      elementMap && elementMap["Bath Fixtures"] != null
        ? parseNumber(elementMap["Bath Fixtures"])
        : null;
    let buildingBathrooms = 0;
    if (buildingBathFixturesRaw != null) {
      const rounded = Math.round(buildingBathFixturesRaw);
      buildingBathrooms = Number.isFinite(rounded) ? Math.max(0, rounded) : 0;
    } else if (idx === 0) {
      buildingBathrooms = defaultBathrooms;
    }
    if (buildingBathrooms <= 0 && buildingBedrooms > 0) {
      buildingBathrooms = 1;
    }

    const buildingRoomsRaw =
      elementMap && elementMap["Rooms / Floor"] != null
        ? parseNumber(elementMap["Rooms / Floor"])
        : null;
    let buildingRooms = 0;
    if (buildingRoomsRaw != null) {
      buildingRooms = Math.max(0, Math.round(buildingRoomsRaw));
    } else if (idx === 0) {
      buildingRooms = defaultRooms;
    }

    const roomSpaceType = determineRoomSpaceType(dorCode);

    for (let i = 0; i < buildingBedrooms; i++) {
      pushChildLayout(buildingIndex, section, {
        space_type: "Bedroom",
        is_finished: true,
      });
    }

    for (let i = 0; i < buildingBathrooms; i++) {
      pushChildLayout(buildingIndex, section, {
        space_type: "Full Bathroom",
        is_finished: true,
      });
    }

    for (let i = 0; i < buildingRooms; i++) {
      pushChildLayout(buildingIndex, section, {
        space_type: roomSpaceType,
        is_finished: true,
      });
    }

    if (idx === 0 || buildingBedrooms > 0 || buildingBathrooms > 0) {
      pushChildLayout(buildingIndex, section, {
        space_type: "Kitchen",
        is_finished: true,
      });
    }

    section.subareas.forEach((subarea) => {
      if (!subarea || !subarea.code) return;
      const mapping = SUBAREA_LAYOUT_MAP[subarea.code];
      if (!mapping || !mapping.space_type) return;
      const size = subarea.gross_area || subarea.adjusted_area || null;
      pushChildLayout(buildingIndex, section, {
        space_type: mapping.space_type,
        size_square_feet: size,
        is_exterior: mapping.is_exterior ?? false,
        is_finished: true,
      });
    });
  });

  const featureBuildingMap = new Map();
  featureBuildingRefs.forEach((item, idx) => {
    const targetIndex =
      buildingIndices[idx] ||
      buildingIndices[buildingIndices.length - 1] ||
      "1";
    featureBuildingMap.set(item.raw, targetIndex);
    if (item.digits) featureBuildingMap.set(item.digits, targetIndex);
  });

  const defaultBuildingIndex = buildingIndices[0] || null;
  extraFeatures.forEach((feature) => {
    if (!feature || !feature.code) return;
    const mapping = EXTRA_FEATURE_LAYOUT_MAP[feature.code];
    if (!mapping) return;
    const rawRef = (feature.buildingRef || "").trim();
    const digitsRef = rawRef.replace(/\D/g, "");
    const targetBuildingIndex =
      featureBuildingMap.get(rawRef) ||
      (digitsRef ? featureBuildingMap.get(digitsRef) : null) ||
      defaultBuildingIndex;
    if (!targetBuildingIndex) return;
    const section =
      sectionByBuildingIndex.get(targetBuildingIndex) ||
      sectionByBuildingIndex.get(defaultBuildingIndex) || {
        building_number: Number.parseInt(targetBuildingIndex, 10),
      };
    let area = feature.units ?? null;
    if ((area == null || area === 0) && feature.length != null && feature.width != null) {
      area = Math.round(feature.length * feature.width);
    }
    pushChildLayout(targetBuildingIndex, section, {
      space_type: mapping.space_type,
      size_square_feet: area ?? null,
      is_exterior: mapping.is_exterior ?? true,
      is_finished: true,
    });
  });

  return layouts;
}

function main() {
  const { $ } = loadHtml();
  const id = extractPropertyId($);
  const layouts = buildLayouts($);
  const out = {};
  out[`property_${id}`] = { layouts };

  // Ensure the 'owners' directory exists before writing the file
  const ownersDirPath = path.resolve("owners");
  ensureDir(ownersDirPath);

  const outPath = path.resolve(ownersDirPath, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}
  function determineRoomSpaceType(code) {
    if (!code) return "Common Room";
    const normalized = String(code).padStart(2, "0");
    if (["17", "18", "19"].includes(normalized)) return "Office Room";
    return "Common Room";
  }
