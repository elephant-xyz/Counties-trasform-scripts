/**
 * Layout mapping script
 * -----------------------------------------
 * Reads input.html, parses sub-area codes, maps them to valid layout space types,
 * and writes owners/layout_data.json. Mapping rules are derived from
 * subarea_codes.txt with heuristic fallbacks to ensure every code resolves to a
 * permitted enum value.
 */

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const LAYOUT_FIELDS = [
  "adjustable_area_sq_ft",
  "area_under_air_sq_ft",
  "bathroom_renovation_date",
  "building_number",
  "built_year",
  "cabinet_style",
  "clutter_level",
  "condition_issues",
  "countertop_material",
  "decor_elements",
  "design_style",
  "fixture_finish_quality",
  "flooring_installation_date",
  "flooring_material_type",
  "flooring_wear",
  "furnished",
  "has_windows",
  "heated_area_sq_ft",
  "installation_date",
  "is_exterior",
  "is_finished",
  "kitchen_renovation_date",
  "lighting_features",
  "livable_area_sq_ft",
  "natural_light_quality",
  "paint_condition",
  "pool_condition",
  "pool_equipment",
  "pool_installation_date",
  "pool_surface_type",
  "pool_type",
  "pool_water_quality",
  "request_identifier",
  "safety_features",
  "size_square_feet",
  "spa_installation_date",
  "spa_type",
  "space_type",
  "space_type_index",
  "story_type",
  "total_area_sq_ft",
  "view_type",
  "visible_damage",
  "window_design_type",
  "window_material_type",
  "window_treatment_type",
];

function createEmptyObject(fields) {
  return fields.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createEmptyLayout() {
  const obj = createEmptyObject(LAYOUT_FIELDS);
  obj.is_exterior = null;
  obj.is_finished = null;
  obj.space_type = null;
  obj.space_type_index = null;
  return obj;
}

const SPACE_TYPE_ENUMS = new Set([
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
  "Attached Carport",
  "Detached Carport",
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
  "Screen Porch (1-Story)",
  "Screen Enclosure (2-Story)",
  "Screen Enclosure (3-Story)",
  "Screen Enclosure (Custom)",
  "Lower Garage",
  "Lower Screened Porch",
  "Stoop",
  "Basement",
  "Sub-Basement",
  "Living Area",
  "Barn",
]);

const EXTERIOR_TYPES = new Set([
  "Attached Garage",
  "Detached Garage",
  "Carport",
  "Attached Carport",
  "Detached Carport",
  "Porch",
  "Open Porch",
  "Screened Porch",
  "Screen Porch (1-Story)",
  "Screen Enclosure (2-Story)",
  "Screen Enclosure (3-Story)",
  "Screen Enclosure (Custom)",
  "Sunroom",
  "Deck",
  "Patio",
  "Pergola",
  "Balcony",
  "Terrace",
  "Gazebo",
  "Pool House",
  "Outdoor Kitchen",
  "Pool Area",
  "Outdoor Pool",
  "Indoor Pool",
  "Hot Tub / Spa Area",
  "Lanai",
  "Courtyard",
  "Stoop",
  "Shed",
  "Barn",
  "Greenhouse",
  "Jacuzzi",
]);

const LIVABLE_TYPES = new Set([
  "Living Room",
  "Family Room",
  "Great Room",
  "Dining Room",
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
  "Walk-in Closet",
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
  "Living Area",
  "Common Room",
]);

const SUBAREA_CODES_PATH = path.resolve(__dirname, "../subarea_codes.txt");

function parseNumberFromText(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function textAfterStrong($el) {
  const html = $el.html() || "";
  const noStrong = html
    .replace(/<strong>[^<]*<\/strong>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cheerio.load(`<div>${noStrong}</div>`)("div").text().trim();
}

function getValueByStrong(context, label, lookupFn) {
  let result = null;
  if (typeof context === "function") {
    context("td > strong").each((_, el) => {
      const text = context(el).text().trim();
      if (text.toLowerCase() === String(label).toLowerCase()) {
        const td = context(el).parent();
        const clone = td.clone();
        clone.children("strong").remove();
        result = clone.text().replace(/\s+/g, " ").trim();
        return false;
      }
      return undefined;
    });
    return result;
  }

  const lookup = typeof lookupFn === "function" ? lookupFn : cheerio;
  context.find("td > strong").each((_, el) => {
    const text = lookup(el).text().trim();
    if (text.toLowerCase() === String(label).toLowerCase()) {
      const td = lookup(el).parent();
      const clone = td.clone();
      clone.children("strong").remove();
      result = clone.text().replace(/\s+/g, " ").trim();
      return false;
    }
    return undefined;
  });
  return result;
}

function yearToISO(year) {
  const numeric = parseInt(year, 10);
  if (!Number.isFinite(numeric)) return null;
  return `${numeric}-01-01`;
}

function mapPoolTypeFromFeature(text) {
  const raw = String(text || "").toLowerCase();
  if (!raw) return null;
  if (raw.includes("above")) return "AboveGround";
  if (raw.includes("salt")) return "SaltWater";
  if (raw.includes("fiberglass")) return "Fiberglass";
  if (raw.includes("vinyl")) return "Vinyl";
  if (raw.includes("lap")) return "Lap";
  if (raw.includes("infinity")) return "Infinity";
  if (raw.includes("plunge")) return "Plunge";
  if (raw.includes("natural")) return "Natural";
  return "BuiltIn";
}

function parseCountValue(text) {
  if (!text) return 0;
  if (/not applicable|n\/a|na|--/i.test(text)) return 0;
  const num = parseNumberFromText(text);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function getSpaceTypePriorityValue(type) {
  const normalized = String(type || "").toLowerCase();
  if (!normalized) return 50;
  if (normalized.includes("living") || normalized.includes("great room") || normalized.includes("family")) return 0;
  if (normalized.includes("primary bedroom")) return 1;
  if (normalized.includes("bedroom")) return 2;
  if (normalized.includes("primary bath")) return 3;
  if (normalized.includes("bath")) return 4;
  if (normalized.includes("kitchen")) return 5;
  if (normalized.includes("dining") || normalized.includes("nook")) return 6;
  if (normalized.includes("office") || normalized.includes("study") || normalized.includes("den")) return 7;
  if (normalized.includes("laundry") || normalized.includes("mudroom")) return 8;
  if (normalized.includes("closet") || normalized.includes("storage") || normalized.includes("utility")) return 9;
  if (normalized.includes("garage")) return 20;
  if (
    normalized.includes("porch") ||
    normalized.includes("patio") ||
    normalized.includes("deck") ||
    normalized.includes("balcony") ||
    normalized.includes("terrace") ||
    normalized.includes("gazebo") ||
    normalized.includes("lanai")
  ) {
    return 30;
  }
  if (normalized.includes("pool")) return 40;
  if (
    normalized.includes("spa") ||
    normalized.includes("jacuzzi") ||
    normalized.includes("hot tub")
  ) {
    return 41;
  }
  return 60;
}

const buildingEntries = new Map();
let globalLayoutOrderCounter = 0;

function ensureBuildingEntry(buildingNumber) {
  if (!buildingEntries.has(buildingNumber)) {
    buildingEntries.set(buildingNumber, {
      number: buildingNumber,
      buildingLayout: null,
      layouts: [],
      totals: { total: 0, livable: 0 },
    });
  }
  return buildingEntries.get(buildingNumber);
}

function registerInteriorTotals(entry, layout) {
  if (layout.is_exterior === false) {
    const area =
      layout.size_square_feet ??
      layout.total_area_sq_ft ??
      null;
    if (area) entry.totals.total += area;
    const livable =
      layout.livable_area_sq_ft ??
      layout.area_under_air_sq_ft ??
      (layout.is_finished ? area : null) ??
      null;
    if (livable) entry.totals.livable += livable;
  }
}

function pushLayoutToBuilding(buildingNumber, layout) {
  const entry = ensureBuildingEntry(buildingNumber);
  layout.building_number = buildingNumber;
  globalLayoutOrderCounter += 1;
  Object.defineProperty(layout, "__order", {
    value: globalLayoutOrderCounter,
    configurable: true,
    enumerable: false,
  });
  entry.layouts.push(layout);
  registerInteriorTotals(entry, layout);
}

function layoutPriorityKey(layout) {
  const isExterior = layout.is_exterior === true ? 1 : 0;
  const base = getSpaceTypePriorityValue(layout.space_type);
  const order = layout.__order || 0;
  return [isExterior, base, order];
}

function compareLayouts(a, b) {
  const keyA = layoutPriorityKey(a);
  const keyB = layoutPriorityKey(b);
  for (let i = 0; i < keyA.length; i += 1) {
    if (keyA[i] < keyB[i]) return -1;
    if (keyA[i] > keyB[i]) return 1;
  }
  return 0;
}

function cleanupLayout(layout) {
  if (layout && typeof layout === "object" && "__order" in layout) {
    try {
      delete layout.__order;
    } catch (_) {}
  }
}

const DIRECT_CODE_OVERRIDES = new Map([
  ["DWELL", { spaceType: "Living Area", exterior: false, livable: true }],
  ["BEDROOM", { spaceType: "Bedroom", exterior: false, livable: true }],
  ["BEDRM", { spaceType: "Bedroom", exterior: false, livable: true }],
  ["MASTER", { spaceType: "Primary Bedroom", exterior: false, livable: true }],
  ["MBED", { spaceType: "Primary Bedroom", exterior: false, livable: true }],
  ["GAR", { spaceType: "Attached Garage", exterior: true, livable: false }],
  ["GARAGE", { spaceType: "Attached Garage", exterior: true, livable: false }],
  ["GAR_D", { spaceType: "Detached Garage", exterior: true, livable: false }],
  ["ATTGAR", { spaceType: "Attached Garage", exterior: true, livable: false }],
  ["DETGAR", { spaceType: "Detached Garage", exterior: true, livable: false }],
  ["CARPORT", { spaceType: "Carport", exterior: true, livable: false }],
  ["PORCH", { spaceType: "Porch", exterior: true, livable: false }],
  ["PORCH_S", { spaceType: "Screened Porch", exterior: true, livable: false }],
  ["BALC", { spaceType: "Balcony", exterior: true, livable: false }],
  ["PATIO", { spaceType: "Patio", exterior: true, livable: false }],
  ["DECK", { spaceType: "Deck", exterior: true, livable: false }],
  ["LANAI", { spaceType: "Lanai", exterior: true, livable: false }],
  ["SHED", { spaceType: "Shed", exterior: true, livable: false }],
  ["BARN", { spaceType: "Barn", exterior: true, livable: false }],
  ["POOL", { spaceType: "Outdoor Pool", exterior: true, livable: false }],
  ["SPA", { spaceType: "Hot Tub / Spa Area", exterior: true, livable: false }],
  ["TIKIHUT", { spaceType: "Gazebo", exterior: true, livable: false }],
  ["UTILITY", { spaceType: "Utility Closet", exterior: false, livable: false }],
  ["PANTRY", { spaceType: "Pantry", exterior: false, livable: true }],
  ["LAUNDRY", { spaceType: "Laundry Room", exterior: false, livable: true }],
  ["LIVING", { spaceType: "Living Room", exterior: false, livable: true }],
  ["FAMROOM", { spaceType: "Family Room", exterior: false, livable: true }],
  ["DINING", { spaceType: "Dining Room", exterior: false, livable: true }],
  ["KITCHEN", { spaceType: "Kitchen", exterior: false, livable: true }],
  ["MECH", { spaceType: "Mechanical Room", exterior: false, livable: false }],
  ["STORAGE", { spaceType: "Storage Room", exterior: false, livable: false }],
]);

const SUBAREA_MAPPING_CACHE = new Map();

function resolveEnum(candidate) {
  if (SPACE_TYPE_ENUMS.has(candidate)) return candidate;
  return "Common Room";
}

function deriveMappingForCode(code, description) {
  const upperCode = (code || "").trim().toUpperCase();
  if (SUBAREA_MAPPING_CACHE.has(upperCode)) {
    return SUBAREA_MAPPING_CACHE.get(upperCode);
  }

  const override = DIRECT_CODE_OVERRIDES.get(upperCode);
  let mapping;
  if (override) {
    mapping = {
      spaceType: resolveEnum(override.spaceType),
      isExterior:
        typeof override.exterior === "boolean"
          ? override.exterior
          : EXTERIOR_TYPES.has(override.spaceType),
      isLivable:
        typeof override.livable === "boolean"
          ? override.livable
          : LIVABLE_TYPES.has(override.spaceType),
    };
  } else {
    const text = `${upperCode} ${(description || "").toLowerCase()}`;
    const rules = [
      { regex: /(primary|master).*bed/, type: "Primary Bedroom", livable: true },
      { regex: /guest.*bed/, type: "Guest Bedroom", livable: true },
      { regex: /bed/, type: "Bedroom", livable: true },
      { regex: /(three.*quarter|3\/4).*bath/, type: "Three-Quarter Bathroom", livable: true },
      { regex: /(half.*bath|powder)/, type: "Half Bathroom / Powder Room", livable: true },
      { regex: /bath/, type: "Full Bathroom", livable: true },
      { regex: /(summer|outdoor).*kitchen/, type: "Outdoor Kitchen", exterior: true, livable: false },
      { regex: /kitchen/, type: "Kitchen", livable: true },
      { regex: /laundry|utility room/, type: "Laundry Room", livable: true },
      { regex: /mud ?room/, type: "Mudroom", livable: true },
      { regex: /pantry/, type: "Pantry", livable: true },
      { regex: /walk.*closet/, type: "Walk-in Closet", livable: false },
      { regex: /closet/, type: "Closet", livable: false },
      { regex: /living|great room/, type: text.includes("great") ? "Great Room" : "Living Room", livable: true },
      { regex: /family/, type: "Family Room", livable: true },
      { regex: /dining/, type: "Dining Room", livable: true },
      { regex: /office|conference/, type: "Office Room", livable: false },
      { regex: /study|library/, type: "Study", livable: true },
      { regex: /den/, type: "Den", livable: true },
      { regex: /theater|theatre|media/, type: "Media Room / Home Theater", livable: true },
      { regex: /game|play room|recreation/, type: "Game Room", livable: true },
      { regex: /gym|exercise/, type: "Home Gym", livable: true },
      { regex: /music/, type: "Music Room", livable: true },
      { regex: /craft|hobby/, type: "Craft Room / Hobby Room", livable: true },
      { regex: /prayer|meditation/, type: "Prayer Room / Meditation Room", livable: true },
      { regex: /safe|panic/, type: "Safe Room / Panic Room", livable: true },
      { regex: /wine/, type: "Wine Cellar", livable: false },
      { regex: /\bbar\b/, type: "Bar Area", livable: true },
      { regex: /attic/, type: "Attic", livable: false },
      { regex: /mechanical|boiler|hvac/, type: "Mechanical Room", livable: false },
      { regex: /storage|warehouse|stock/, type: "Storage Room", livable: false },
      { regex: /utility/, type: "Utility Closet", livable: false },
      { regex: /garage/, type: upperCode.includes("DET") || text.includes("det") ? "Detached Garage" : "Attached Garage", exterior: true, livable: false },
      { regex: /carport/, type: upperCode.includes("DET") || text.includes("det") ? "Detached Carport" : "Attached Carport", exterior: true, livable: false },
      { regex: /balcony/, type: "Balcony", exterior: true, livable: false },
      { regex: /screen.*porch/, type: "Screened Porch", exterior: true, livable: false },
      { regex: /porch/, type: "Porch", exterior: true, livable: false },
      { regex: /deck/, type: "Deck", exterior: true, livable: false },
      { regex: /patio/, type: "Patio", exterior: true, livable: false },
      { regex: /lanai/, type: "Lanai", exterior: true, livable: false },
      { regex: /gazebo|tiki/, type: "Gazebo", exterior: true, livable: false },
      { regex: /pool house/, type: "Pool House", exterior: true, livable: false },
      { regex: /indoor pool/, type: "Indoor Pool", exterior: true, livable: false },
      { regex: /pool/, type: "Outdoor Pool", exterior: true, livable: false },
      { regex: /spa|hot tub|jacuzzi/, type: "Hot Tub / Spa Area", exterior: true, livable: false },
      { regex: /shed/, type: "Shed", exterior: true, livable: false },
      { regex: /barn|stable/, type: "Barn", exterior: true, livable: false },
      { regex: /greenhouse/, type: "Greenhouse", exterior: true, livable: false },
      { regex: /workshop/, type: "Workshop", livable: false },
      { regex: /entry|lobby/, type: "Lobby / Entry Hall", livable: false },
      { regex: /mail room/, type: "Mail Room", livable: false },
      { regex: /janitor/, type: "Janitor’s Closet", livable: false },
      { regex: /courtyard/, type: "Courtyard", exterior: true, livable: false },
      { regex: /terrace/, type: "Terrace", exterior: true, livable: false },
    ];

    let resolved = { spaceType: "Common Room", isExterior: false, isLivable: false };
    for (const rule of rules) {
      if (rule.regex.test(text)) {
        const type = resolveEnum(rule.type);
        resolved = {
          spaceType: type,
          isExterior:
            typeof rule.exterior === "boolean"
              ? rule.exterior
              : EXTERIOR_TYPES.has(type),
          isLivable:
            typeof rule.livable === "boolean"
              ? rule.livable
              : LIVABLE_TYPES.has(type),
        };
        break;
      }
    }
    mapping = resolved;
  }

  SUBAREA_MAPPING_CACHE.set(upperCode, mapping);
  return mapping;
}

if (fs.existsSync(SUBAREA_CODES_PATH)) {
  const raw = fs.readFileSync(SUBAREA_CODES_PATH, "utf8");
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^code\b/i.test(line))
    .forEach((line) => {
      const parts = line.split(/\t+|\s{2,}/);
      const code = parts[0] ? parts[0].trim() : null;
      const description = parts[1] ? parts[1].trim() : "";
      if (!code) return;
      deriveMappingForCode(code, description);
    });
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    let ain = null;
    $("div.table-section.building-table table tr td").each((i, el) => {
      const td = $(el);
      const strong = td.find("strong").first().text().trim();
      if (/^AIN$/i.test(strong)) ain = textAfterStrong(td);
    });
    if (!ain) {
      $("div.table-section.general-info table tr td table tr td").each(
        (i, el) => {
          const td = $(el);
          const strong = td.find("strong").first().text().trim();
          if (/^Account Number$/i.test(strong)) ain = textAfterStrong(td);
        },
      );
    }
    const propertyId = ain ? `property_${String(ain).trim()}` : "property_unknown";

    buildingEntries.clear();
    globalLayoutOrderCounter = 0;

    const propertyFeatureItems = [];
    const buildingFeatureSections = new Set();

    function processSketchedAreaTable($table, buildingNumber) {
      $table.find("tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 3) return;
        const code = $(tds.get(0)).text().trim();
        const description = $(tds.get(1)).text().trim();
        const areaText = $(tds.get(2)).text().trim();
        const finishedAreaText =
          tds.length > 3 ? $(tds.get(3)).text().trim() : null;
        if (
          !code ||
          /^sub\s*area$/i.test(code) ||
          /^code$/i.test(code) ||
          /^description$/i.test(description)
        ) {
          return;
        }
        const mapping = deriveMappingForCode(code, description);
        const areaSqFt = parseNumberFromText(areaText);
        const finishedSqFt = parseNumberFromText(finishedAreaText);

        const layout = createEmptyLayout();
        layout.space_type = mapping.spaceType;
        layout.size_square_feet = areaSqFt;
        layout.total_area_sq_ft = areaSqFt;
        layout.is_exterior = mapping.isExterior;
        layout.is_finished = !mapping.isExterior;

        if (!mapping.isExterior) {
          const livableCandidate =
            finishedSqFt != null ? finishedSqFt : areaSqFt;
          if (mapping.isLivable) {
            layout.livable_area_sq_ft = livableCandidate;
            layout.area_under_air_sq_ft = livableCandidate;
            layout.heated_area_sq_ft = livableCandidate;
          }
        }

        pushLayoutToBuilding(buildingNumber, layout);
      });
    }

    function addBedroomLayouts(buildingNumber, count) {
      if (!count || count <= 0) return;
      const primary = createEmptyLayout();
      primary.space_type = count > 1 ? "Primary Bedroom" : "Bedroom";
      primary.is_exterior = false;
      primary.is_finished = true;
      pushLayoutToBuilding(buildingNumber, primary);
      for (let i = 1; i < count; i += 1) {
        const bedroom = createEmptyLayout();
        bedroom.space_type = "Bedroom";
        bedroom.is_exterior = false;
        bedroom.is_finished = true;
        pushLayoutToBuilding(buildingNumber, bedroom);
      }
    }

    function addFullBathroomLayouts(buildingNumber, count) {
      if (!count || count <= 0) return;
      const primary = createEmptyLayout();
      primary.space_type = count > 1 ? "Primary Bathroom" : "Full Bathroom";
      primary.is_exterior = false;
      primary.is_finished = true;
      pushLayoutToBuilding(buildingNumber, primary);
      for (let i = 1; i < count; i += 1) {
        const bath = createEmptyLayout();
        bath.space_type = "Full Bathroom";
        bath.is_exterior = false;
        bath.is_finished = true;
        pushLayoutToBuilding(buildingNumber, bath);
      }
    }

    function addHalfBathroomLayouts(buildingNumber, count) {
      if (!count || count <= 0) return;
      for (let i = 0; i < count; i += 1) {
        const halfBath = createEmptyLayout();
        halfBath.space_type = "Half Bathroom / Powder Room";
        halfBath.is_exterior = false;
        halfBath.is_finished = true;
        pushLayoutToBuilding(buildingNumber, halfBath);
      }
    }

    function processGeneralFeatureItems(buildingNumber, items) {
      items.forEach((item) => {
        const typeLower = item.type.toLowerCase();
        const unitLower = String(item.unit || "").toLowerCase();
        if (/pool/i.test(typeLower)) {
          const layout = createEmptyLayout();
          layout.space_type = "Outdoor Pool";
          layout.is_exterior = true;
          layout.is_finished = false;
          const isSquareFeet = /square|sq\.?\s*ft/i.test(unitLower);
          const area = isSquareFeet ? item.size : null;
          layout.size_square_feet = area;
          layout.total_area_sq_ft = area;
          layout.pool_type = mapPoolTypeFromFeature(item.type);
          layout.pool_installation_date = yearToISO(item.year);
          pushLayoutToBuilding(buildingNumber, layout);
          return;
        }
        if (/jacuzzi|spa/i.test(typeLower)) {
          const layout = createEmptyLayout();
          layout.space_type = "Hot Tub / Spa Area";
          layout.is_exterior = true;
          layout.is_finished = false;
          layout.spa_type = "Jacuzzi";
          layout.spa_installation_date = yearToISO(item.year);
          pushLayoutToBuilding(buildingNumber, layout);
        }
      });
    }

    const buildingItems = $("#improvements-detail-slider .item");

    if (buildingItems.length) {
      buildingItems.each((idx, item) => {
        const buildingNumber = idx + 1;
        const $item = $(item);
        const entry = ensureBuildingEntry(buildingNumber);

        const finishedAreaText = getValueByStrong($item, "Finished Area", $);
        const finishedArea = parseNumberFromText(finishedAreaText);

        const buildingLayout = entry.buildingLayout ?? createEmptyLayout();
        buildingLayout.space_type = "Building";
        buildingLayout.is_exterior = false;
        buildingLayout.is_finished = true;
        buildingLayout.building_number = buildingNumber;
        if (finishedArea != null) {
          buildingLayout.size_square_feet = finishedArea;
          buildingLayout.total_area_sq_ft = finishedArea;
          buildingLayout.livable_area_sq_ft = finishedArea;
          buildingLayout.area_under_air_sq_ft = finishedArea;
          buildingLayout.heated_area_sq_ft = finishedArea;
        }
        entry.buildingLayout = buildingLayout;

        const bedroomsCount = parseCountValue(
          getValueByStrong($item, "Bedrooms", $),
        );
        const fullBathCount = parseCountValue(
          getValueByStrong($item, "Full Baths", $),
        );
        const halfBathCount = parseCountValue(
          getValueByStrong($item, "Half Baths", $),
        );

        addBedroomLayouts(buildingNumber, bedroomsCount);
        addFullBathroomLayouts(buildingNumber, fullBathCount);
        addHalfBathroomLayouts(buildingNumber, halfBathCount);

        $item.find("div.table-section.features-yard-items").each((_, sect) => {
          buildingFeatureSections.add(sect);
          const heading = $(sect).find("h2.table-heading").text().trim();
          if (/Sketched Area Legend/i.test(heading)) {
            const $table = $(sect).find("table").first();
            processSketchedAreaTable($table, buildingNumber);
          } else if (/Features\/Yard Items/i.test(heading)) {
            $(sect)
              .find("table tr")
              .each((__, tr) => {
                const tds = $(tr).find("td");
                if (tds.length < 5) return;
                const type = $(tds.get(0)).text().trim();
                if (!type || /^type$/i.test(type)) return;
                const quantity = parseNumberFromText($(tds.get(1)).text().trim());
                const size = parseNumberFromText($(tds.get(2)).text().trim());
                const unit = $(tds.get(3)).text().trim();
                const year = $(tds.get(4)).text().trim();
                propertyFeatureItems.push({
                  type,
                  quantity,
                  size,
                  unit,
                  year,
                  buildingNumber,
                });
              });
          }
        });
      });
    } else {
      const fallbackBuildingNumber = 1;
      const entry = ensureBuildingEntry(fallbackBuildingNumber);
      const buildingLayout = entry.buildingLayout ?? createEmptyLayout();
      buildingLayout.space_type = "Building";
      buildingLayout.is_exterior = false;
      buildingLayout.is_finished = true;
      buildingLayout.building_number = fallbackBuildingNumber;
      const finishedAreaText = getValueByStrong($, "Finished Area");
      const finishedArea = parseNumberFromText(finishedAreaText);
      if (finishedArea != null) {
        buildingLayout.size_square_feet = finishedArea;
        buildingLayout.total_area_sq_ft = finishedArea;
        buildingLayout.livable_area_sq_ft = finishedArea;
        buildingLayout.area_under_air_sq_ft = finishedArea;
        buildingLayout.heated_area_sq_ft = finishedArea;
      }
      entry.buildingLayout = buildingLayout;

      const bedroomsCount = parseCountValue(getValueByStrong($, "Bedrooms"));
      const fullBathCount = parseCountValue(getValueByStrong($, "Full Baths"));
      const halfBathCount = parseCountValue(getValueByStrong($, "Half Baths"));

      addBedroomLayouts(fallbackBuildingNumber, bedroomsCount);
      addFullBathroomLayouts(fallbackBuildingNumber, fullBathCount);
      addHalfBathroomLayouts(fallbackBuildingNumber, halfBathCount);

      $("div.table-section.features-yard-items").each((_, sect) => {
        const heading = $(sect).find("h2.table-heading").text().trim();
        if (/Sketched Area Legend/i.test(heading)) {
          const $table = $(sect).find("table").first();
          processSketchedAreaTable($table, fallbackBuildingNumber);
        } else if (/Features\/Yard Items/i.test(heading)) {
          $(sect)
            .find("table tr")
            .each((__, tr) => {
              const tds = $(tr).find("td");
              if (tds.length < 5) return;
              const type = $(tds.get(0)).text().trim();
              if (!type || /^type$/i.test(type)) return;
              const quantity = parseNumberFromText($(tds.get(1)).text().trim());
              const size = parseNumberFromText($(tds.get(2)).text().trim());
              const unit = $(tds.get(3)).text().trim();
              const year = $(tds.get(4)).text().trim();
              propertyFeatureItems.push({
                type,
                quantity,
                size,
                unit,
                year,
                buildingNumber: fallbackBuildingNumber,
              });
            });
        }
      });
    }

    const buildingNumbers = Array.from(buildingEntries.keys()).sort((a, b) => a - b);
    const defaultBuildingNumber = buildingNumbers.length > 0 ? buildingNumbers[0] : 1;

    const generalFeatureSections = $("div.table-section.features-yard-items").filter((_, sect) => !buildingFeatureSections.has(sect));

    generalFeatureSections.each((_, sect) => {
      const heading = $(sect).find("h2.table-heading").text().trim();
      if (/Sketched Area Legend/i.test(heading)) {
        const targetBuilding = buildingNumbers.length > 0 ? buildingNumbers[0] : 1;
        const $table = $(sect).find("table").first();
        processSketchedAreaTable($table, targetBuilding);
      } else if (/Features\/Yard Items/i.test(heading)) {
        $(sect)
          .find("table tr")
          .each((__, tr) => {
            const tds = $(tr).find("td");
            if (tds.length < 5) return;
            const type = $(tds.get(0)).text().trim();
            if (!type || /^type$/i.test(type)) return;
            const quantity = parseNumberFromText($(tds.get(1)).text().trim());
            const size = parseNumberFromText($(tds.get(2)).text().trim());
            const unit = $(tds.get(3)).text().trim();
            const year = $(tds.get(4)).text().trim();
            propertyFeatureItems.push({
              type,
              quantity,
              size,
              unit,
              year,
              buildingNumber: buildingNumbers.length > 0 ? buildingNumbers[0] : defaultBuildingNumber,
            });
          });
      }
    });

    propertyFeatureItems.forEach((item) => {
      const buildingNumber = item.buildingNumber ?? defaultBuildingNumber;
      processGeneralFeatureItems(buildingNumber, [item]);
    });

    let propertyTotalArea = 0;
    let propertyLivableArea = 0;
    const combinedLayouts = [];

    if (buildingEntries.size === 0) {
      const entry = ensureBuildingEntry(1);
      if (!entry.buildingLayout) {
        const placeholder = createEmptyLayout();
        placeholder.space_type = "Building";
        placeholder.is_exterior = false;
        placeholder.is_finished = true;
        placeholder.building_number = 1;
        entry.buildingLayout = placeholder;
      }
    }

    Array.from(buildingEntries.values())
      .sort((a, b) => a.number - b.number)
      .forEach((entry) => {
        const buildingLayout = entry.buildingLayout || (() => {
          const layout = createEmptyLayout();
          layout.space_type = "Building";
          layout.is_exterior = false;
          layout.is_finished = true;
          layout.building_number = entry.number;
          return layout;
        })();

        const buildingTotal =
          entry.totals.total ||
          buildingLayout.total_area_sq_ft ||
          buildingLayout.size_square_feet ||
          0;
        const buildingLivable =
          entry.totals.livable ||
          buildingLayout.livable_area_sq_ft ||
          buildingLayout.area_under_air_sq_ft ||
          0;

        if (buildingTotal) {
          buildingLayout.size_square_feet =
            buildingLayout.size_square_feet ?? buildingTotal;
          buildingLayout.total_area_sq_ft =
            buildingLayout.total_area_sq_ft ?? buildingTotal;
        }
        if (buildingLivable) {
          buildingLayout.livable_area_sq_ft =
            buildingLayout.livable_area_sq_ft ?? buildingLivable;
          buildingLayout.area_under_air_sq_ft =
            buildingLayout.area_under_air_sq_ft ?? buildingLivable;
          buildingLayout.heated_area_sq_ft =
            buildingLayout.heated_area_sq_ft ?? buildingLivable;
        }

        buildingLayout.space_type_index = String(entry.number);
        buildingLayout.building_number = entry.number;
        cleanupLayout(buildingLayout);
        combinedLayouts.push(buildingLayout);

        const typeCounters = new Map();
        entry.layouts
          .slice()
          .sort(compareLayouts)
          .forEach((layout) => {
            const typeKey = String(layout.space_type || "").toLowerCase();
            const count = (typeCounters.get(typeKey) || 0) + 1;
            typeCounters.set(typeKey, count);
            layout.space_type_index = `${entry.number}.${count}`;
            layout.building_number = entry.number;
            cleanupLayout(layout);
            combinedLayouts.push(layout);
          });

        propertyTotalArea += buildingTotal || 0;
        propertyLivableArea += buildingLivable || 0;
      });

    const payload = {};
    payload[propertyId] = {
      total_area: propertyTotalArea || null,
      livable_area: propertyLivableArea || null,
      layouts: combinedLayouts,
    };

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "layout_data.json");
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote layout data to ${outPath}`);
  } catch (err) {
    console.error("Error generating layout data:", err.message);
    process.exit(1);
  }
})();
