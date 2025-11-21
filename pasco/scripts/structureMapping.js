// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function normalizeSpace(value) {
  return value ? value.replace(/\s+/g, " ").trim() : value;
}

function parseNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "." || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function toInt(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function extractTwoDigitCode(value) {
  if (!value) return null;
  const match = String(value).match(/\b(\d{1,2})\b/);
  if (!match) return null;
  return match[1].padStart(2, "0");
}

const ROOF_COVER_CODE_MAP = {
  "00": { material: null, covering: null },
  "01": { material: "Metal", covering: "Metal Corrugated" },
  "02": { material: "Composition", covering: "Modified Bitumen" },
  "03": { material: "Shingle", covering: "Architectural Asphalt Shingle" },
  "04": { material: "Composition", covering: "Built-Up Roof" },
  "05": { material: null, covering: "TPO Membrane" },
  "06": { material: "Shingle", covering: "Architectural Asphalt Shingle" },
  "07": { material: "Concrete", covering: "Concrete Tile" },
  "08": { material: "CeramicTile", covering: "Clay Tile" },
  "09": { material: "Metal", covering: "Metal Standing Seam" },
  "10": { material: "Wood", covering: "Wood Shingle" },
  "11": { material: "Stone", covering: "Natural Slate" },
  "12": { material: "Metal", covering: "Metal Standing Seam" },
};

const STRUCTURAL_FRAME_CODE_MAP = {
  "00": null,
  "01": "Wood Frame",
  "02": "Masonry",
  "03": "Poured Concrete",
  "04": "Steel Frame",
  "05": "Steel Frame",
  "06": null,
};

const EXTERIOR_WALL_CODE_MAP = {
  "15": "Concrete Block",
  "16": "Stucco",
  "17": "Concrete Block",
  "18": "Brick",
  "19": "Brick",
  "20": "Brick",
  "21": "Stone",
  "22": "Concrete",
  "23": "Concrete",
  "24": "Metal Siding",
  "25": "Metal Siding",
  "26": "Metal Siding",
  "27": "Metal Siding",
  "28": "Glass",
  "29": "Wood Siding",
  "30": "Wood Siding",
  "31": "Concrete",
  "32": "Concrete",
  "33": "Stucco",
  "34": "Stucco",
};

const INTERIOR_FLOOR_CODE_MAP = {
  "01": "Sheet Vinyl",
  "02": "Concrete",
  "03": "Concrete",
  "04": "Ceramic Tile",
  "05": "Ceramic Tile",
  "06": "Ceramic Tile",
  "07": "Sheet Vinyl",
  "08": "Solid Hardwood",
  "09": "Stone",
  "10": "Ceramic Tile",
  "11": "Solid Hardwood",
  "12": "Solid Hardwood",
  "13": "Carpet",
  "14": "Ceramic Tile",
  "15": "Stone",
  "16": "Concrete",
  "17": "Stone",
  "18": "Stone",
  "19": "Ceramic Tile",
  "20": "Laminate",
};

const INTERIOR_WALL_CODE_MAP = {
  "01": "Plaster",
  "02": "Wood Paneling",
  "03": "Plaster",
  "04": "Wood Paneling",
  "05": "Drywall",
  "06": "Wood Paneling",
};

const ROOF_STRUCTURE_CODE_MAP = {
  "01": "Flat",
  "02": "Shed",
  "03": "Combination",
  "04": "Combination",
  "05": "Combination",
  "06": "Mansard",
  "07": "Gable",
  "08": "Combination",
  "09": "Gable",
  "10": "Gable",
  "11": "Gable",
  "12": "Combination",
  "13": "Combination",
};

function mapExteriorWallValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && EXTERIOR_WALL_CODE_MAP[code]) return EXTERIOR_WALL_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("CONCRETE") && upper.includes("BLOCK"))
    return "Concrete Block";
  if (upper.includes("STUCCO")) return "Stucco";
  if (upper.includes("BRICK")) return "Brick";
  if (upper.includes("STONE")) return "Stone";
  if (upper.includes("VINYL")) return "Vinyl Siding";
  if (upper.includes("METAL")) return "Metal Siding";
  if (upper.includes("WOOD")) return "Wood Siding";
  return null;
}

function mapExteriorWallAccentValue(value) {
  const raw = normalizeSpace(value);
  if (!raw || raw.toLowerCase() === "none") return null;
  const upper = raw.toUpperCase();
  if (upper.includes("BRICK")) return "Brick Accent";
  if (upper.includes("STONE")) return "Stone Accent";
  if (upper.includes("VINYL")) return "Vinyl Accent";
  if (upper.includes("STUCCO")) return "Stucco Accent";
  if (upper.includes("METAL")) return "Metal Trim";
  if (upper.includes("WOOD") || upper.includes("TRIM")) return "Wood Trim";
  if (upper.includes("BLOCK")) return "Decorative Block";
  return null;
}

function mapInteriorWallValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && INTERIOR_WALL_CODE_MAP[code]) return INTERIOR_WALL_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("PLASTER")) return "Plaster";
  if (upper.includes("DRYWALL")) return "Drywall";
  if (upper.includes("PANEL")) return "Wood Paneling";
  if (upper.includes("WOOD")) return "Wood Paneling";
  return null;
}

function mapInteriorFloorValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && INTERIOR_FLOOR_CODE_MAP[code])
    return INTERIOR_FLOOR_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("CARPET")) return "Carpet";
  if (upper.includes("HARDWOOD")) return "Solid Hardwood";
  if (upper.includes("VINYL")) return "Sheet Vinyl";
  if (upper.includes("TILE")) return "Ceramic Tile";
  if (upper.includes("LAMINATE")) return "Laminate";
  if (upper.includes("SLATE")) return "Stone";
  if (upper.includes("MARBLE")) return "Stone";
  if (upper.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapRoofStructureValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && ROOF_STRUCTURE_CODE_MAP[code])
    return ROOF_STRUCTURE_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("GABLE") && upper.includes("HIP")) return "Combination";
  if (upper.includes("GABLE")) return "Gable";
  if (upper.includes("HIP")) return "Hip";
  if (upper.includes("FLAT")) return "Flat";
  if (upper.includes("SHED")) return "Shed";
  if (upper.includes("MANSARD")) return "Mansard";
  if (upper.includes("GAMBREL")) return "Gable";
  return null;
}

function mapRoofCoverValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return { material: null, covering: null };
  const code = extractTwoDigitCode(raw);
  if (code && ROOF_COVER_CODE_MAP[code]) return ROOF_COVER_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("ASPHALT") || upper.includes("COMPOSITION"))
    return ROOF_COVER_CODE_MAP["03"];
  if (upper.includes("ROLL")) return ROOF_COVER_CODE_MAP["02"];
  if (upper.includes("BUILT") || upper.includes("GRAVEL"))
    return ROOF_COVER_CODE_MAP["04"];
  if (upper.includes("MEMBRANE")) return ROOF_COVER_CODE_MAP["05"];
  if (upper.includes("ASBESTOS")) return ROOF_COVER_CODE_MAP["06"];
  if (upper.includes("CONCRETE")) return ROOF_COVER_CODE_MAP["07"];
  if (upper.includes("CLAY") || upper.includes("BERMUDA"))
    return ROOF_COVER_CODE_MAP["08"];
  if (upper.includes("METAL")) return ROOF_COVER_CODE_MAP["12"];
  if (upper.includes("WOOD")) return ROOF_COVER_CODE_MAP["10"];
  if (upper.includes("SLATE")) return ROOF_COVER_CODE_MAP["11"];
  return { material: null, covering: null };
}

function mapStructuralFrameValue(value) {
  const raw = normalizeSpace(value);
  if (!raw) return null;
  const code = extractTwoDigitCode(raw);
  if (code && STRUCTURAL_FRAME_CODE_MAP[code])
    return STRUCTURAL_FRAME_CODE_MAP[code];
  const upper = raw.toUpperCase();
  if (upper.includes("WOOD")) return "Wood Frame";
  if (upper.includes("MASONRY")) return "Masonry";
  if (upper.includes("CONCRETE")) return "Poured Concrete";
  if (upper.includes("STEEL")) return "Steel Frame";
  if (upper.includes("BLOCK")) return "Concrete Block";
  return null;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const propertySeed = readJSON(path.join(process.cwd(), "property_seed.json"));
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) || parcelId;

  const stories = parseNumber(safeText($, "#lblBuildingStories"));
  const ext1 = safeText($, "#lblBuildingExteriorWall1");
  const ext2 = safeText($, "#lblBuildingExteriorWall2");
  const roofStruct = safeText($, "#lblBuildingRoofStructure");
  const roofCover = safeText($, "#lblBuildingRoofCover");
  const intWall1 = safeText($, "#lblBuildingInteriorWall1");
  const floor1 = safeText($, "#lblBuildingFlooring1");
  const floor2 = safeText($, "#lblBuildingFlooring2");
  const structuralFrameRaw =
    safeText($, "#lblBuildingStructureFrame") ||
    safeText($, "#lblStructuralFrame") ||
    safeText($, "#lblBuildingFrame");

  let livingArea = null;
  $("#tblSubLines tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (tds.length < 4) return;
    const description = (tds[2] && $(tds[2]).text().trim()) || "";
    if (description.toUpperCase() === "LIVING AREA") {
      livingArea = toInt($(tds[3]).text());
    }
  });

  const exteriorPrimary = mapExteriorWallValue(ext1);
  const exteriorSecondary =
    mapExteriorWallAccentValue(ext2) ||
    mapExteriorWallValue(ext2) ||
    (ext2 && ext2.toLowerCase() !== "none"
      ? mapExteriorWallAccentValue(`${ext1 || ""} ${ext2}`) ||
        mapExteriorWallValue(`${ext1 || ""} ${ext2}`)
      : null);

  const interiorSurfacePrimary = mapInteriorWallValue(intWall1);
  const flooringPrimary = mapInteriorFloorValue(floor1);
  const flooringSecondary =
    mapInteriorFloorValue(floor2) ||
    (floor2 && floor2.toLowerCase() !== "none"
      ? mapInteriorFloorValue(floor2)
      : null);

  const roofDesign = mapRoofStructureValue(roofStruct);
  const roofCoverMapping = mapRoofCoverValue(roofCover);
  let roofMaterialType = roofCoverMapping.material;
  let roofCoveringMaterial = roofCoverMapping.covering;

  if (!roofMaterialType && roofCover) {
    const lower = roofCover.toLowerCase();
    if (lower.includes("shingle")) roofMaterialType = "Shingle";
    else if (lower.includes("metal")) roofMaterialType = "Metal";
    else if (lower.includes("tile")) roofMaterialType = "Tile";
    else if (lower.includes("concrete")) roofMaterialType = "Concrete";
    else if (lower.includes("wood")) roofMaterialType = "Wood";
  }

  if (!roofCoveringMaterial && roofCover) {
    const lower = roofCover.toLowerCase();
    if (lower.includes("asphalt") || lower.includes("composition"))
      roofCoveringMaterial = "Architectural Asphalt Shingle";
    else if (lower.includes("metal"))
      roofCoveringMaterial = "Metal Standing Seam";
    else if (lower.includes("tile") && lower.includes("concrete"))
      roofCoveringMaterial = "Concrete Tile";
    else if (lower.includes("tile"))
      roofCoveringMaterial = "Clay Tile";
    else if (lower.includes("wood"))
      roofCoveringMaterial = "Wood Shingle";
    else if (lower.includes("slate"))
      roofCoveringMaterial = "Natural Slate";
    else if (lower.includes("built"))
      roofCoveringMaterial = "Built-Up Roof";
    else if (lower.includes("membrane"))
      roofCoveringMaterial = "TPO Membrane";
  }

  let primaryFraming = mapStructuralFrameValue(structuralFrameRaw);
  if (!primaryFraming && exteriorPrimary === "Concrete Block")
    primaryFraming = "Concrete Block";

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: exteriorSecondary,
    finished_base_area: livingArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooringPrimary,
    flooring_material_secondary: flooringSecondary,
    foundation_condition: null,
    foundation_material: null,
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
    interior_wall_surface_material_primary: interiorSurfacePrimary,
    interior_wall_surface_material_secondary: null,
    number_of_stories: stories ?? null,
    primary_framing_material: primaryFraming,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roofCoveringMaterial,
    roof_date: null,
    roof_design_type: roofDesign,
    roof_material_type: roofMaterialType,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    request_identifier: requestIdentifier,
  };

  const out = {};
  out[`property_${parcelId}`] = structure;

  const ownersDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const outPath = path.join(ownersDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
