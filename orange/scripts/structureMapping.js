// structureMapping.js
// Reads input.json, extracts structural attributes, and writes owners/structure_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio"); // For any HTML parsing needs (not used here, but available per requirements)

const embeddedInput = {};

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function tokenizeMaterials(value) {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : [String(value)];
  const tokens = [];
  const seen = new Set();

  raw.forEach((item) => {
    const base = String(item || "").trim();
    if (!base) return;
    if (!seen.has(base)) {
      tokens.push(base);
      seen.add(base);
    }
    base
      .split(/[/,&+]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        if (!seen.has(part)) {
          tokens.push(part);
          seen.add(part);
        }
      });
  });

  return tokens;
}

function mapByKeyword(source, rules) {
  const text = String(source || "");
  for (const rule of rules) {
    if (rule.regex.test(text)) return rule.enumValue;
  }
  return null;
}

function loadCodeTable(filePath) {
  const tables = {
    byCode: new Map(),
    byDesc: new Map(),
  };

  try {
    if (!fs.existsSync(filePath)) return tables;
    const raw = fs.readFileSync(filePath, "utf-8");
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^code\s+/i.test(line))
      .forEach((line) => {
        const parts = line.split(/\t+/);
        if (parts.length < 2) return;
        const code = parts[0].trim();
        const desc = parts[1].trim();
        if (!code || !desc) return;
        const canonicalCode = code.padStart(2, "0");
        tables.byCode.set(canonicalCode, desc);
        const normalizedDesc = normalizeKey(desc);
        if (normalizedDesc && !tables.byDesc.has(normalizedDesc)) {
          tables.byDesc.set(normalizedDesc, canonicalCode);
        }
      });
  } catch (err) {
    // If the lookup table is missing or unreadable fall back to empty maps.
    return tables;
  }

  return tables;
}

function buildCodeToEnumMap(codeTable, enumByDesc) {
  const map = new Map();
  enumByDesc.forEach((enumValue, descKey) => {
    const code = codeTable.byDesc.get(descKey);
    if (code && enumValue && !map.has(code)) {
      map.set(code, enumValue);
    }
  });
  return map;
}

function toNumber(value) {
  if (value == null) return null;
  const num = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) ? num : null;
}

const EXTERIOR_WALL_CODES = loadCodeTable(
  path.resolve(__dirname, "..", "ext_wall.txt"),
);
const INTERIOR_WALL_CODES = loadCodeTable(
  path.resolve(__dirname, "..", "int_wall.txt"),
);

const EXTERIOR_WALL_ENUM_BY_DESC = new Map(
  Object.entries({
    cmpwalbd: "Fiber Cement Siding",
    sngsidew: "Wood Siding",
    brdbtnav: "Wood Siding",
    cmtfbrsh: "Fiber Cement Siding",
    woodshthn: "Wood Siding",
    corrugfib: "Metal Siding",
    brdbtnab: "Wood Siding",
    cedarredw: "Wood Siding",
    pfwdplmte: "Wood Siding",
    woodshing: "Wood Siding",
    conccindr: "Concrete Block",
    woodfrst: "Stucco",
    cbstucco: "Stucco",
    cmtbrick: "Brick",
    combrick: "Brick",
    facebrick: "Brick",
    stone: "Natural Stone",
    precpanel: "Precast Concrete",
    renfconcr: "Precast Concrete",
    corgmetal: "Metal Siding",
    modlmetal: "Metal Siding",
    alumvylsd: "Vinyl Siding",
    prefinmtl: "Metal Siding",
    glassthrm: "Curtain Wall",
    orncplst: "Stucco",
    airsupper: "Curtain Wall",
    airsuppor: "Curtain Wall",
    logwalls: "Log",
    hardiebrd: "Fiber Cement Siding",
    hardybd: "Fiber Cement Siding",
    hardybrd: "Fiber Cement Siding",
    mtlfrst: "Metal Siding",
    tileclad: "Manufactured Stone",
    fauxstone: "Manufactured Stone",
    fauxwood: "Wood Siding",
  }),
);

const INTERIOR_WALL_ENUM_BY_DESC = new Map(
  Object.entries({
    wallbdwd: "Drywall",
    wallbd: "Drywall",
    plstered: "Plaster",
    plastered: "Plaster",
    plywoodpn: "Wood Paneling",
    drywall: "Drywall",
    woodpanel: "Wood Paneling",
    decwallc: "Wainscoting",
    ceramtile: "Tile",
    chinesedw: "Drywall",
    sculpceil: "Plaster",
    boardbatten: "Board and Batten",
  }),
);

const EXTERIOR_WALL_CODE_TO_ENUM = buildCodeToEnumMap(
  EXTERIOR_WALL_CODES,
  EXTERIOR_WALL_ENUM_BY_DESC,
);
const INTERIOR_WALL_CODE_TO_ENUM = buildCodeToEnumMap(
  INTERIOR_WALL_CODES,
  INTERIOR_WALL_ENUM_BY_DESC,
);

const EXTERIOR_WALL_KEYWORD_RULES = [
  { regex: /faux\s*stone/i, enumValue: "Manufactured Stone" },
  { regex: /\bmanufactured stone\b/i, enumValue: "Manufactured Stone" },
  { regex: /\bstone\b/i, enumValue: "Natural Stone" },
  { regex: /\bstucco\b/i, enumValue: "Stucco" },
  {
    regex: /\bhardie|hardy|fiber\s*cement|cement\s*board/i,
    enumValue: "Fiber Cement Siding",
  },
  { regex: /\bbrick\b/i, enumValue: "Brick" },
  { regex: /\blog\b/i, enumValue: "Log" },
  { regex: /\badobe\b/i, enumValue: "Adobe" },
  { regex: /\bvinyl\b/i, enumValue: "Vinyl Siding" },
  { regex: /metal|steel|alum/i, enumValue: "Metal Siding" },
  { regex: /\bconcrete|cinder|block|masonry/i, enumValue: "Concrete Block" },
  { regex: /\bprecast|panel/i, enumValue: "Precast Concrete" },
  { regex: /\bcurtain|glass/i, enumValue: "Curtain Wall" },
  { regex: /\bwood|cedar|redw|plywood/i, enumValue: "Wood Siding" },
];

const INTERIOR_WALL_KEYWORD_RULES = [
  { regex: /drywall|wall\s*board|gypsum/i, enumValue: "Drywall" },
  { regex: /plaster|sculp/i, enumValue: "Plaster" },
  { regex: /wood\s*panel|paneling|plywood/i, enumValue: "Wood Paneling" },
  { regex: /tile/i, enumValue: "Tile" },
  { regex: /wains/i, enumValue: "Wainscoting" },
  { regex: /shiplap/i, enumValue: "Shiplap" },
  { regex: /batten/i, enumValue: "Board and Batten" },
  { regex: /brick/i, enumValue: "Exposed Brick" },
  { regex: /block|concrete/i, enumValue: "Concrete" },
  { regex: /stone veneer|stone/i, enumValue: "Stone Veneer" },
  { regex: /metal/i, enumValue: "Metal Panels" },
  { regex: /glass|fiberglass/i, enumValue: "Glass Panels" },
];


function ensureInputFile() {
  const inputPath = path.resolve("input.json");
  try {
    if (!fs.existsSync(inputPath)) {
      fs.writeFileSync(
        inputPath,
        JSON.stringify(embeddedInput, null, 2),
        "utf-8",
      );
    }
  } catch (e) {
    // If any error writing, attempt to continue using embedded data directly
  }
}

function loadInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    ensureInputFile();
  }
  try {
    const raw = fs.readFileSync(inputPath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    // Fallback to embedded
    return embeddedInput;
  }
}

function mapExteriorWallMaterials(raw) {
  const tokens = tokenizeMaterials(raw);
  const matches = [];

  tokens.forEach((token) => {
    const normalized = normalizeKey(token);
    let code =
      (normalized && EXTERIOR_WALL_CODES.byDesc.get(normalized)) || null;
    if (!code) {
      const numericCandidate = token && token.trim();
      if (numericCandidate && /^[0-9]+$/.test(numericCandidate)) {
        code = numericCandidate.padStart(2, "0");
      }
    }

    let mapped =
      (code && EXTERIOR_WALL_CODE_TO_ENUM.get(code)) ||
      (normalized && EXTERIOR_WALL_ENUM_BY_DESC.get(normalized)) ||
      null;

    if (!mapped && code) {
      const desc = EXTERIOR_WALL_CODES.byCode.get(code);
      if (desc) {
        mapped = EXTERIOR_WALL_ENUM_BY_DESC.get(normalizeKey(desc)) || null;
      }
    }

    if (!mapped) {
      mapped = mapByKeyword(token, EXTERIOR_WALL_KEYWORD_RULES);
    }

    if (mapped && !matches.includes(mapped)) {
      matches.push(mapped);
    }
  });

  if (matches.length === 0) {
    const fallback = mapByKeyword(raw, EXTERIOR_WALL_KEYWORD_RULES);
    if (fallback) matches.push(fallback);
  }

  return {
    primary: matches[0] || null,
    secondary: matches[1] || null,
  };
}

function mapInteriorWallMaterials(raw) {
  const tokens = tokenizeMaterials(raw);
  const matches = [];

  tokens.forEach((token) => {
    const normalized = normalizeKey(token);
    let code =
      (normalized && INTERIOR_WALL_CODES.byDesc.get(normalized)) || null;
    if (!code) {
      const numericCandidate = token && token.trim();
      if (numericCandidate && /^[0-9]+$/.test(numericCandidate)) {
        code = numericCandidate.padStart(2, "0");
      }
    }

    let mapped =
      (code && INTERIOR_WALL_CODE_TO_ENUM.get(code)) ||
      (normalized && INTERIOR_WALL_ENUM_BY_DESC.get(normalized)) ||
      null;

    if (!mapped && code) {
      const desc = INTERIOR_WALL_CODES.byCode.get(code);
      if (desc) {
        mapped = INTERIOR_WALL_ENUM_BY_DESC.get(normalizeKey(desc)) || null;
      }
    }

    if (!mapped) {
      mapped = mapByKeyword(token, INTERIOR_WALL_KEYWORD_RULES);
    }

    if (mapped && !matches.includes(mapped)) {
      matches.push(mapped);
    }
  });

  if (matches.length === 0) {
    const fallback = mapByKeyword(raw, INTERIOR_WALL_KEYWORD_RULES);
    if (fallback) matches.push(fallback);
  }

  return {
    primary: matches[0] || null,
    secondary: matches[1] || null,
  };
}

function buildStructure(input) {
  const parcel = input.parcelGeneralProfile || {};
  const bldg =
    (input.parcelBuildingFeatures && input.parcelBuildingFeatures[0]) || {};

  const exteriorWalls = mapExteriorWallMaterials(bldg.extWall);
  const interiorWalls = mapInteriorWallMaterials(bldg.intWall);
  const livingArea = toNumber(bldg.livingArea);
  const floors = toNumber(bldg.floors);
  let roofDate = null;
  if (bldg.dateBuilt) {
    const dateString = String(bldg.dateBuilt).trim();
    roofDate = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString || null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: exteriorWalls.primary,
    exterior_wall_material_secondary: exteriorWalls.secondary,
    finished_base_area: livingArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: "Unknown",
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: "Pier and Beam",
    foundation_waterproofing: "Unknown",
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: "Paint",
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: "Wood Frame",
    interior_wall_structure_material_primary: "Wood Frame",
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: interiorWalls.primary,
    interior_wall_surface_material_secondary: interiorWalls.secondary,
    number_of_stories: floors != null ? floors : bldg.floors || null,
    primary_framing_material: "Wood Frame",
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: roofDate,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: "Unknown",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  return structure;
}

function main() {
  ensureInputFile();
  const input = loadInput();
  const parcelId =
    (input.parcelGeneralProfile && input.parcelGeneralProfile.parcelId) ||
    (input.parcelQuickSearchSummary &&
      input.parcelQuickSearchSummary[0] &&
      input.parcelQuickSearchSummary[0].parcelId) ||
    "unknown";

  const structure = buildStructure(input);

  const ownersDir = path.resolve("owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });

  const outPath = path.join(ownersDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");
}

if (require.main === module) {
  main();
}
