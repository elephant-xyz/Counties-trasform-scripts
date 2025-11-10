// Structure mapping script (multi-building aware)
// Reads input.html, extracts per-building structure data, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textClean(t) {
  if (!t) return "";
  return String(t).replace(/\s+/g, " ").trim();
}

function numFromText(t) {
  if (!t) return null;
  const normalized = String(t).replace(/[^0-9.\-]/g, "");
  if (!normalized) return null;
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function intFromText(t) {
  if (!t) return null;
  const normalized = String(t).replace(/[^0-9\-]/g, "");
  if (!normalized) return null;
  const parsed = parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function ensureDir(folderPath) {
  fs.mkdirSync(folderPath, { recursive: true });
}

function loadHtml(filePath) {
  return cheerio.load(fs.readFileSync(filePath, "utf8"));
}

const EXTERIOR_WALL_MATERIAL_MAP = {
  Brick: [
    /BRICK/i,
    /\bBRK\b/i,
    /BRK\s*VEN/i,
    /BRICK\s*VEN/i,
    /BRICK\s*FACE/i,
  ],
  "Natural Stone": [
    /NAT(?:URAL)?\s*STONE/i,
    /\bFIELD\s*STONE\b/i,
    /\bSTONE\b/i,
    /FLAGSTONE/i,
    /RIVER\s*ROCK/i,
    /SLATE\s*FACE/i,
    /ROCK\s*(?:FACE|VENEER)/i,
  ],
  "Manufactured Stone": [
    /MAN(?:UF|UFACTURED)\s*STONE/i,
    /CULT(?:URED)?\s*STONE/i,
    /STONE\s*VEN(?:EER)?/i,
    /FAUX\s*STONE/i,
    /CAST\s*STONE/i,
  ],
  Stucco: [/STUCCO/i, /\bSTUC\b/i, /CEMENT\s*PLASTER/i],
  "Vinyl Siding": [
    /VINYL/i,
    /\bPVC\b/i,
    /POLY\s*CLAD/i,
    /VIN\s*SID/i,
  ],
  "Wood Siding": [
    /WOOD/i,
    /\bWD\b/i,
    /CEDAR/i,
    /PINE/i,
    /REDWOOD/i,
    /BOARD\s*&\s*BATTEN/i,
    /BOARD\s*AND\s*BATTEN/i,
    /T-?1-?1?1/i,
    /WOOD\s*SHAKE/i,
    /WOOD\s*PANEL/i,
  ],
  "Fiber Cement Siding": [
    /FIBER\s*CEMENT/i,
    /HARDI(E|E)?\s*PLANK/i,
    /HARDI/i,
    /HARDY/i,
    /HARDIE/i,
    /FCB/i,
    /CEM\s*BOARD/i,
    /CEMENTITIOUS/i,
  ],
  "Metal Siding": [
    /METAL/i,
    /STEEL/i,
    /ALUM/i,
    /ALUMINUM/i,
    /TIN/i,
    /RIBBED\s*PANEL/i,
  ],
  "Concrete Block": [
    /CONC(?:RETE)?\s*BLOCK/i,
    /\bCBS\b/i,
    /\bC\.?B\.?S\b/i,
    /\bCMU\b/i,
    /BLOCK/i,
    /CONC\s*MASON/i,
    /MASN\s*CONC/i,
    /(?:MASN|MASON)\w*CONC/i,
    /CONC\w*(?:MASN|MASON)/i,
  ],
  EIFS: [/EIFS/i, /SYNTHETIC\s*STUCCO/i, /DR[YV]IT/i],
  Log: [/LOG/i, /D-?\s*LOG/i, /LOG\s*WALL/i, /LOG\s*HOME/i],
  Adobe: [/ADOBE/i, /EARTHEN\s*BLOCK/i],
  "Precast Concrete": [
    /PRE-?\s*CAST/i,
    /PRECAST/i,
    /PRE\s*FAB/i,
    /PRE\s*MOLD/i,
  ],
  "Curtain Wall": [
    /CURTAIN\s*WALL/i,
    /GLASS\s*CURTAIN/i,
    /CURTAIN\s*SYS/i,
  ],
};

const PRIMARY_FRAMING_MATERIAL_MAP = {
  "Wood Frame": [
    /WOOD/i,
    /\bWD\b/i,
    /TIMBER/i,
    /STUD/i,
    /2x/i,
    /TRUSS/i,
  ],
  "Steel Frame": [
    /STEEL/i,
    /\bSTL\b/i,
    /METAL\s*FRAME/i,
    /RED\s*IRON/i,
    /STRUCTURAL\s*STEEL/i,
  ],
  "Concrete Block": [
    /CONC(?:RETE)?\s*BLOCK/i,
    /\bCBS\b/i,
    /\bC\.?B\.?S\b/i,
    /\bCMU\b/i,
    /BLOCK/i,
    /CONC\s*MASON/i,
    /MASN\s*CONC/i,
    /(?:MASN|MASON)\w*CONC/i,
    /CONC\w*(?:MASN|MASON)/i,
  ],
  "Poured Concrete": [
    /POURED/i,
    /CAST\s*IN\s*PLACE/i,
    /\bC\.?I\.?P\b/i,
    /POUR\s*CONC/i,
    /MONO(?:LITHIC)?/i,
    /\bICF\b/i,
  ],
  Masonry: [/MASONRY/i, /MASON/i, /BRICK/i, /STONE/i, /CMU\s*WALL/i],
  "Engineered Lumber": [
    /ENGINEERED/i,
    /LVL/i,
    /GLU.?LAM/i,
    /MICRO.?LAM/i,
    /ENG\s*LUM/i,
    /I[-\s]?JOIST/i,
  ],
  "Post and Beam": [
    /POST/i,
    /POST\s*&\s*BEAM/i,
    /POST\s*AND\s*BEAM/i,
    /POST\s*BEAM/i,
    /POLE\s*BARN/i,
    /TIMBER\s*FRAME/i,
    /POST\s*FRAME/i,
  ],
  "Log Construction": [/LOG/i, /LOG\s*WALL/i, /LOG\s*HOME/i],
};

const ROOF_COVERING_MAP = {
  "3-Tab Asphalt Shingle": [
    /3\s*-?\s*TAB/i,
    /THREE\s*TAB/i,
    /3TAB/i,
    /3\s*T/i,
    /ASPH(?:ALT)?\s*SHING/i,
  ],
  "Architectural Asphalt Shingle": [
    /ARCH(?:ITECTURAL)?\s*SHING/i,
    /LAMINATED\s*SHING/i,
    /DIMENSIONAL\s*SHING/i,
    /ARCH\s*SHG/i,
  ],
  "Metal Standing Seam": [
    /STANDING\s*SEAM/i,
    /STAND\s*SEAM/i,
    /SS\s*METAL/i,
    /ST\s*SEAM/i,
  ],
  "Metal Corrugated": [
    /CORRUG/i,
    /CORR/i,
    /R[-\s]?PANEL/i,
    /AG[-\s]?PANEL/i,
    /CORR\s*METAL/i,
  ],
  "Clay Tile": [
    /CLAY/i,
    /SPANISH\s*TILE/i,
    /MISSION\s*TILE/i,
    /TERRA\s*COTTA/i,
    /BARREL\s*TILE/i,
  ],
  "Concrete Tile": [
    /CONC(?:RETE)?\s*TILE/i,
    /CEMENT\s*TILE/i,
    /CONC\s*BARREL/i,
    /FLAT\s*TILE/i,
  ],
  "Natural Slate": [
    /NAT(?:URAL)?\s*SLATE/i,
    /\bSLATE\b/i,
    /STONE\s*SLATE/i,
  ],
  "Synthetic Slate": [
    /SYNTH(?:ETIC)?\s*SLATE/i,
    /COMPOSITE\s*SLATE/i,
    /FAUX\s*SLATE/i,
    /RUBBER\s*SLATE/i,
    /POLYMER\s*SLATE/i,
  ],
  "Wood Shake": [
    /SHAKE/i,
    /CEDAR\s*SHAKE/i,
    /HAND\s*SPLIT/i,
  ],
  "Wood Shingle": [
    /WOOD\s*SHING/i,
    /CEDAR\s*SHING/i,
    /REDWOOD\s*SHING/i,
  ],
  "TPO Membrane": [/TPO/i],
  "EPDM Membrane": [/EPDM/i],
  "Modified Bitumen": [
    /MOD(?:IFIED)?\s*BIT/i,
    /MBR/i,
    /MOD\s*BIT/i,
    /MMBRN/i,
    /MOD\.\s*BIT/i,
    /MODIFIED\s*BITUMEN/i,
  ],
  "Built-Up Roof": [
    /BUILT\s*-?\s*UP/i,
    /\bBUR\b/i,
    /BU\s*TG/i,
    /HOT\s*MOP/i,
    /MULTI\s*PLY/i,
    /BU\s*ROOF/i,
  ],
  "Green Roof System": [
    /GREEN\s*ROOF/i,
    /VEGETATIVE\s*ROOF/i,
    /VEGETATED\s*ROOF/i,
    /ECO\s*ROOF/i,
  ],
  "Solar Integrated Tiles": [
    /SOLAR\s*TILE/i,
    /SOLAR\s*SHING/i,
    /PV\s*TILE/i,
    /PHOTOVOLTAIC/i,
    /PV\s*SHINGLE/i,
    /SOLAR\s*PV/i,
  ],
};

const ROOF_DESIGN_PATTERNS = {
  Gable: [/GABLE/],
  Hip: [/HIP/],
  Flat: [/FLAT/],
  Mansard: [/MANSARD/],
  Gambrel: [/GAMBREL/, /BARN/],
  Shed: [/SHED/],
  Saltbox: [/SALTB/, /SALT\s*BOX/i],
  Butterfly: [/BUTTERFLY/],
  Bonnet: [/BONNET/],
  Clerestory: [/CLERESTORY/, /CLEARSTORY/],
  Dome: [/DOME/],
  Barrel: [/BARREL/],
};

function matchPatterns(value, patternMap) {
  if (!value) return null;
  const cleaned = textClean(value);
  if (!cleaned) return null;
  const upperValue = cleaned.toUpperCase();
  for (const enumValue of Object.keys(patternMap)) {
    if (upperValue === enumValue.toUpperCase()) return enumValue;
  }
  for (const [enumValue, patterns] of Object.entries(patternMap)) {
    if (patterns.some((regex) => regex.test(upperValue))) {
      return enumValue;
    }
  }
  return null;
}

function normalizeEnumValue(desc, patternMap, preferredOrder = []) {
  if (!desc) return null;
  const cleaned = textClean(desc);
  if (!cleaned) return null;

  const separators = /[/,;|+&]+/;
  const tokens = cleaned
    .split(separators)
    .map((token) => textClean(token))
    .filter(Boolean);

  const matches = [];

  const registerMatch = (candidate) => {
    if (candidate && !matches.includes(candidate)) matches.push(candidate);
  };

  tokens.forEach((token) => {
    registerMatch(matchPatterns(token, patternMap));
  });

  registerMatch(matchPatterns(cleaned, patternMap));

  if (matches.length === 0) return null;
  if (preferredOrder.length > 0) {
    for (const preferred of preferredOrder) {
      if (matches.includes(preferred)) return preferred;
    }
  }
  return matches[0];
}

function normalizeExteriorWall(desc) {
  return normalizeEnumValue(desc, EXTERIOR_WALL_MATERIAL_MAP);
}

function normalizePrimaryFraming(desc) {
  return normalizeEnumValue(desc, PRIMARY_FRAMING_MATERIAL_MAP);
}

function normalizeRoofCovering(desc) {
  const preferred = [
    "Modified Bitumen",
    "Built-Up Roof",
    "Metal Standing Seam",
    "Metal Corrugated",
    "Concrete Tile",
    "Clay Tile",
  ];
  return normalizeEnumValue(desc, ROOF_COVERING_MAP, preferred);
}

function normalizeRoofDesign(desc) {
  if (!desc) return null;
  const cleaned = textClean(desc);
  if (!cleaned) return null;
  const tokens = cleaned
    .split(/[/,;|+]+/)
    .map((token) => textClean(token))
    .filter(Boolean);
  const matches = new Set();

  tokens.forEach((token) => {
    const match = matchPatterns(token, ROOF_DESIGN_PATTERNS);
    if (match) matches.add(match);
  });

  if (matches.size === 0) {
    const single = matchPatterns(cleaned, ROOF_DESIGN_PATTERNS);
    return single;
  }
  if (matches.size === 1) {
    return [...matches][0];
  }
  return "Combination";
}

function getBuildingPanels($) {
  return $("#divSearchDetails_Building .cssSearchDetails_Panels_Inner").filter(
    (_, el) => textClean($(el).text()).length > 0,
  );
}

function getMaterialsMap($, panel) {
  const map = {};
  panel.find("#divBldg_Materials table tbody tr").each((_, tr) => {
    const row = $(tr);
    const cells = row.find("td");
    if (cells.length < 2) return;
    const label = textClean($(cells[0]).text()).replace(/:$/, "");
    const value = textClean($(cells[1]).text());
    if (label) map[label] = value;
  });
  return map;
}

function getDetailsMap($, panel) {
  const map = {};
  panel.find("#divBldg_Details table.cssWidth100 tbody tr").each((_, tr) => {
    const row = $(tr);
    const cells = row.find("td");
    if (cells.length < 2) return;
    const label = textClean($(cells[0]).text()).replace(/:$/, "");
    const value = textClean($(cells[1]).text());
    if (label) map[label] = value;
  });
  return map;
}

function getSubAreaEntries($, panel) {
  const entries = [];
  panel
    .find("#divBldg_SubAreas table.report-table.left-table tbody tr")
    .each((_, tr) => {
      const row = $(tr);
      const cells = row.find("td");
      if (cells.length < 2) return;
      const description = textClean($(cells[0]).text());
      const squareFeet = intFromText($(cells[1]).text());
      if (!description) return;
      entries.push({ description, squareFeet });
    });
  return entries;
}

function getExteriorWallMaterial(materials) {
  return normalizeExteriorWall(materials["Exterior Wall"] || null);
}

function getPrimaryFramingMaterial(materials) {
  return normalizePrimaryFraming(materials["Frame"] || null);
}

function getRoofCoveringMaterial(materials) {
  return normalizeRoofCovering(materials["Roof"] || null);
}

function getRoofDesignType(materials) {
  return normalizeRoofDesign(materials["Roof Structure"] || null);
}

function getCeilingHeightAverage(details) {
  return numFromText(details["Story Height"]);
}

function getNumberOfStories(details) {
  return intFromText(details["Floors"]);
}

function getAttachmentType(details) {
  const useText = textClean(details["Bldg. Use"]);
  if (!useText) return null;
  const upper = useText.toUpperCase();
  if (upper.includes("DUPLEX") || upper.includes("TWO FAMILY")) {
    return "SemiDetached";
  }
  if (
    upper.includes("TOWN") ||
    upper.includes("ROW") ||
    upper.includes("CONDO") ||
    upper.includes("ATTACHED")
  ) {
    return "Attached";
  }
  if (upper.includes("SINGLE FAMILY") || upper.includes("SF")) {
    return "Detached";
  }
  return null;
}

function getFinishedBaseArea(subAreas) {
  let totalRow = null;
  let sum = 0;
  let hasBaseRows = false;
  subAreas.forEach(({ description, squareFeet }) => {
    if (squareFeet === null) return;
    if (/^Total Base Area$/i.test(description)) {
      totalRow = squareFeet;
      return;
    }
    const upper = description.toUpperCase();
    if (/BASE\s*AREA/.test(upper) && !/2(ND|ND\.)|SECOND|UPPER/.test(upper)) {
      sum += squareFeet;
      hasBaseRows = true;
    }
  });
  if (totalRow !== null) return totalRow;
  if (hasBaseRows) return sum;
  return null;
}

function getFinishedUpperStoryArea(subAreas) {
  let sum = 0;
  subAreas.forEach(({ description, squareFeet }) => {
    if (squareFeet === null) return;
    const upper = description.toUpperCase();
    if (/BASE\s*AREA/.test(upper) && (/2ND|SECOND|UPPER/.test(upper))) {
      sum += squareFeet;
    }
  });
  return sum > 0 ? sum : null;
}

function getUnfinishedBaseArea(subAreas) {
  let total = 0;
  subAreas.forEach(({ description, squareFeet }) => {
    if (squareFeet === null) return;
    const upper = description.toUpperCase();
    if (/GARAGE/.test(upper) || /PORCH/.test(upper)) {
      total += squareFeet;
    }
  });
  return total > 0 ? total : null;
}

function getUnfinishedUpperStoryArea(subAreas) {
  let total = 0;
  subAreas.forEach(({ description, squareFeet }) => {
    if (squareFeet === null) return;
    const upper = description.toUpperCase();
    if (/BALCON/.test(upper)) {
      total += squareFeet;
    }
  });
  return total > 0 ? total : null;
}

function createStructureTemplate() {
  return {
    building_number: null,
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: null,
    number_of_stories: null,
    primary_framing_material: null,
    request_identifier: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
}

function buildStructure($, panel, index, totalBuildings) {
  const materials = getMaterialsMap($, panel);
  const details = getDetailsMap($, panel);
  const subAreas = getSubAreaEntries($, panel);

  const structure = createStructureTemplate();
  structure.building_number = index + 1;
  structure.number_of_buildings = totalBuildings || null;

  const exteriorWall = getExteriorWallMaterial(materials);
  const primaryFrame = getPrimaryFramingMaterial(materials);
  const roofCovering = getRoofCoveringMaterial(materials);
  const roofDesign = getRoofDesignType(materials);

  structure.exterior_wall_material_primary = exteriorWall;
  structure.primary_framing_material = primaryFrame;
  structure.roof_covering_material = roofCovering;
  structure.roof_design_type = roofDesign;

  const storyHeight = getCeilingHeightAverage(details);
  const stories = getNumberOfStories(details);
  const attachmentType = getAttachmentType(details);
  const finishedBaseArea = getFinishedBaseArea(subAreas);
  const finishedUpperArea = getFinishedUpperStoryArea(subAreas);
  const unfinishedBase = getUnfinishedBaseArea(subAreas);
  const unfinishedUpper = getUnfinishedUpperStoryArea(subAreas);

  structure.ceiling_height_average = storyHeight;
  structure.number_of_stories = stories;
  structure.attachment_type = attachmentType;
  structure.finished_base_area = finishedBaseArea;
  structure.finished_upper_story_area = finishedUpperArea;
  structure.unfinished_base_area = unfinishedBase;
  structure.unfinished_upper_story_area = unfinishedUpper;

  return structure;
}

function extract() {
  const $ = loadHtml("input.html");

  const account = textClean($("#hfAccount").attr("value")) || null;
  const propertyKey = account ? `property_${account}` : "property_unknown";

  const structures = [];
  const panels = getBuildingPanels($);
  panels.each((index, panelElement) => {
    const panel = $(panelElement);
    const structure = buildStructure($, panel, index, panels.length);
    structures.push(structure);
  });

  const payload = {};
  payload[propertyKey] = { structures };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "structure_data.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

extract();
