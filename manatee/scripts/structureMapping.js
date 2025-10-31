// Structure mapping script
// Reads input.json and writes owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

function safeParse(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function parseExteriorWall(value) {
  if(!value || !value.trim()) {
    return [null, null];
  }
  value = value.trim();
  const exteriorWallMap = {
    "CONC BLOCK STUCCO": ["Concrete Block", "Stucco Accent"],
    "WOOD FRAME/ASBESTOS": ["Wood Siding", null],
    "MASONRY/STUCCO": ["Stucco", null],
    "CORRUGATED METAL": ["Metal Siding", null],
    "WOOD FRAME/WOOD NO SHEATHING": ["Wood Siding", null],
    "WOOD & SHEATHING": ["Wood Siding", null],
    "WOOD NO SHEATHING": ["Wood Siding", null],
    "WOOD FRAME/ALUM SIDING": ["Metal Siding", "Wood Trim"],
    "ENAMEL METAL": ["Metal Siding", null],
    "ALUM SIDING": ["Metal Siding", null],
    "MASONRY": [null, null],
    "MASONRY/WOOD/STUCCO": ["Wood Siding", "Stucco Accent"],
    "STONE ON MASONRY": ["Manufactured Stone", null],
    "CONC BLOCK PLAIN": ["Concrete Block", null],
    "MASONRY/WOOD/WOOD NO SHEATHING": ["Wood Siding", null],
    "MASONRY/PLAIN-PAINTED": [null, null],
    "WOOD FRAME/VINYL SIDING": ["Vinyl Siding", "Wood Trim"],
    "MASONRY/BRICK": ["Brick", null],
    "WOOD FRAME/STUCCO": ["Wood Siding", "Stucco Accent"],
    "WOOD FRAME/WOOD SHEATHING": ["Wood Siding", null],
    "WOOD FRAME/REDWOOD": ["Wood Siding", null],
    "MASONRY/HARDYBOARD": [null, null],
    "MASONRY/VINYL SIDING": ["Vinyl Siding", null],
    "WOOD FRAME/UNDETERMINED": ["Wood Siding", null],
    "WOOD FRAME/HARDYBOARD": [null, null],
    "MASONRY/STONE": ["Manufactured Stone", null],
    "WOOD FRAME": ["Wood Siding", null],
    "UNDETERMINED/STUCCO": ["Stucco", null],
    "MASONRY/TILT-UP": [null, null],
    "MASONRY/WOOD/BRICK": ["Brick", "Wood Trim"],
    "MASONRY/BEVELLED CEDAR": ["Wood Siding", null],
    "VINY SIDING": [null, null],
    "STUCCO SHEATHING": ["Stucco", null],
    "FRAME STUCCO": ["Stucco", null],
    "WOOD FRAME/LOGS": ["Log", "Wood Trim"],
    "MASONRY/WOOD/CEDAR BB": ["Wood Siding", null],
    "REINFORCED CONC": ["Concrete Block", null],
    "TILT-UP": [null, null],
    "BRICK ON MASONRY": ["Brick", null],
    "WOOD/MASONRY/STUCCO": ["Wood Siding", "Stucco Accent"],
    "STUCCO": ["Stucco", null],
    "BRICK WOOD FRAME": ["Brick", "Wood Trim"],
    "MASONRY/WOOD/VINYL SIDING": ["Vinyl Siding", "Wood Trim"],
    "WOOD FRAME/CEDAR BB": ["Wood Siding", null],
    "STEEL FRAME/CORRUGATED METAL": ["Metal Siding", null],
    "LOGS": ["Log", null],
    "MASONRY/CEDAR BB": ["Wood Siding", null],
    "MASONRY/WOOD/HARDYBOARD": ["Wood Siding", null],
    "MASONRY/12\" CONC BLOCK": ["Concrete Block", null],
    "WOOD FRAME/REDWOOD SHAKES": ["Wood Siding", null],
    "MASONRY/WOOD SHEATHING": ["Wood Siding", null],
    "STEEL FRAME/ALUM SIDING": ["Metal Siding", null],
    "MASONRY/WOOD/PLAIN-PAINTED": ["Wood Siding", null],
    "STEEL FRAME": ["Metal Siding", null],
    "WOOD FRAME/PLAIN-PAINTED": ["Wood Siding", null],
    "MASONRY/WOOD NO SHEATHING": ["Wood Siding", null],
    "REINFORCED CONCRETE/PRECAST PANELS": ["Concrete Block", null],
    "REDWOOD SHAKES": ["Wood Siding", null],
    "WOOD FRAME/WALL BOARD": ["Wood Siding", null],
    "MASONRY/ALUM SIDING": ["Metal Siding", null],
    "STEEL FRAME/HARDYBOARD": ["Metal Siding", null],
    "MASONRY/ASBESTOS": [null, null],
    "WOOD FRAME/BRICK": ["Brick", "Wood Trim"],
    "MASONRY/WOOD/STONE": ["Manufactured Stone", "Wood Trim"],
    "FRAME ASBESTOS": [null, null],
    "WOOD FRAME/STONE": ["Manufactured Stone", "Wood Trim"],
    "MASONRY/WOOD/WOOD SHEATHING": ["Wood Siding", null],
    "CEDAR B&B": ["Wood Siding", null],
    "NONE": [null, null],
    "WOOD FRAME/PRECAST PANELS": ["Wood Siding", null],
    "ROUGH STONE": ["Natural Stone", null],
    "MASONRY/WOOD/ALUM SIDING": ["Metal Siding", "Wood Trim"],
    "WALL BOARD": [null, null],
    "REINFORCED CONCRETE/STUCCO": ["Concrete Block", "Stucco Accent"],
    "MASONRY/COMPOSITION SHINGLE": [null, null],
    "WOOD FRAME/CYPRESS B B": ["Wood Siding", null],
    "UNDETERMINED/VINYL SIDING": ["Vinyl Siding", null],
    "STEEL FRAME/VINYL SIDING": ["Vinyl Siding", null],
    "MASONRY/UNDETERMINED": [null, null],
    "STEEL FRAME/ENAMEL METAL": ["Metal Siding", null],
    "UNDETERMINED/PLAIN-PAINTED": [null, null],
    "WOOD FRAME/BEVELLED CEDAR": ["Wood Siding", null],
    "WOOD/MASONRY/WOOD SHEATHING": ["Wood Siding", null],
    "WOOD/MASONRY/VINYL SIDING": ["Vinyl Siding", "Wood Trim"],
    "WOOD FRAME/CORRUGATED METAL": ["Wood Siding", "Metal Trim"],
    "UNDETERMINED/UNDETERMINED": [null, null],
    "WOOD FRAME/ENAMEL METAL": ["Wood Siding", null],
    "MASONRY/CORRUGATED METAL": ["Metal Siding", null],
    "WOOD/MASONRY/STONE": ["Wood Siding", null],
    "FIREPROOF STEEL/CORRUGATED METAL": ["Metal Siding", null],
    "MASONRY/LOGS": ["Log", null],
    "CONC & GLASS PANEL": ["Concrete Block", null],
    "PC PANLS": [null, null],
    "REINFORCED CONCRETE/VINYL SIDING": ["Vinyl Siding", null],
    "REINFORCED CONCRETE/WOOD NO SHEATHING": ["Concrete Block", "Wood Trim"],
    "WOOD FRAME/ROUGH CEDAR": ["Wood Siding", null],
    "MASONRY/PRECAST PANELS": [null, null],
    "MASONRY/WINDOW WALL": [null, null],
    "BRICK": ["Brick", null],
    "WOOD/MASONRY/PLAIN-PAINTED": ["Wood Siding", null],
    "REINFORCED CONCRETE/HARDYBOARD": ["Concrete Block", null],
    "MASONRY/WOOD/PRECAST PANELS": ["Wood Siding", null],
    "WOOD FRAME/TILT-UP": ["Wood Siding", null],
    "MASONRY/REINFORCED CONC": ["Concrete Block", null],
    "STEEL FRAME/STUCCO": ["Metal Siding", "Stucco Accent"],
    "STEEL FRAME/WOOD SHEATHING": ["Wood Siding", "Metal Trim"],
    "MASONRY/ENAMEL METAL": ["Metal Siding", null],
    "PLATE GLASS": [null, null],
    "12\" CONC BLOCK": ["Concrete Block", null],
    "WOOD FRAME/COMPOSITION SHINGLE": ["Wood Siding", null],
    "MASONRY/WOOD/TILT-UP": ["Wood Siding", null],
    "COMPOSITION SHINGLES": [null, null],
    "STEEL FRAME/UNDETERMINED": ["Metal Siding", null],
    "ROUGH CEDAR": ["Wood Siding", null],
    "WOOD/MASONRY/HARDYBOARD": ["Wood Siding", null],
    "MASONRY/ROUGH CEDAR": ["Wood Siding", null],
    "MASONRY/REDWOOD SHAKES": ["Wood Siding", null],
    "MASONRY/WALL BOARD": [null, null],
    "MASONRY/WOOD/WALL BOARD": ["Wood Siding", null],
    "WOOD/MASONRY/WALL BOARD": ["Wood Siding", null],
    "WOOD/MASONRY/PRECAST PANELS": ["Wood Siding", null],
    "WOOD FRAME/CONC & GLASS PANEL": ["Wood Siding", null]
  }
  if (value in exteriorWallMap) {
    return exteriorWallMap[value];
  }
  return [null, null];
}

function parseRoofMaterial(value) {
  if(!value || !value.trim()) {
    return [null, null];
  }
  value = value.trim();
  const roofMaterialMap = {
    "SHINGLES COMPOSITION": ["Composition", null],
    "SHINGLES COMP": ["Composition", null],
    "BUILTUP TAR & GRAVEL": [null, null],
    "SHEET METAL": ["Metal", null],
    "ALUMINUM": ["Metal", null],
    "CRIMPED METAL": ["Metal", null],
    "ENAMEL METAL": ["Metal", null],
    "CLAY TILE": ["Tile", "Clay Tile"],
    "CONCRETE TILE": ["Tile", "Concrete Tile"],
    "MEMBRANE": [null, null],
    "ROLL COMPOSITION": ["Composition", null],
    "BUILT UP TAR & GRAVEL": [null, null],
    "ENAMEL METAL SHING": ["Shingle", null],
    "ALUMINUM": ["Metal", null],
    "TILE ON CONC": ["Tile", "Concrete Tile"],
    "ASBESTOS SHINGLES": ["Shingle", null],
    "BITUMEN": [null, null],
    "WOOD SHINGLES": ["Shingle", "Wood Shingle"],
    "VINYL": ["Vinyl", null],
    "HYPALON": [null, null],
    "BERMUDA.": [null, null],
    "BERMUDA": [null, null],
    "SYNTHETIC/PLASTIC": ["Synthetic Slate", null],
    "SLATE": [null, null],
    "COPPER": ["Metal", null],
    "SOLAR ROOF": [null, "Solar Integrated Tiles"],
  }
  if (value in roofMaterialMap) {
    return roofMaterialMap[value];
  }
  return [null, null];
}

function parseRoofType(value) {
  if(!value || !value.trim()) {
    return [null, null];
  }
  value = value.trim();
  const roofTypeMap = {
    "HIP AND/OR GABLE": [null, "Combination"],
    "WOOD TRUSS": ["Wood Truss", null],
    "STEEL TRUSS": ["Steel Truss", null],
    "FLAT SHED": [null, "Flat"],
    "GAMBERL MANSARD": [null, "Mansard"],
    "PRESTRESSED CONC": [null, null],
    "BAR JOIST RIGID": [null, null],
    "GAMBREL MANSARD": [null, "Mansard"],
    "STEEL CONC": [null, null],
    "SAWTOOTH": [null, null],
    "BOWSTRING": [null, null],
    "STEEL TRUSS RIGID": ["Steel Truss", null],
    "STEEL , CONC": [null, null],
    "BAR JOIST WOOD DECK": [null, null],
    "MONITOR": [null, null]
  }
  if (value in roofTypeMap) {
    return roofTypeMap[value];
  }
  return [null, null];
}

function extractParcelId(input) {
  // Try Owners HTML first
  try {
    const html = input?.OwnersAndGeneralInformation?.response || "";
    if (cheerio && html) {
      const $ = cheerio.load(html);
      const text = $.text();
      const m = text.match(/\b(\d{9,12})\b/);
      if (m) return m[1];
      const ta = $("textarea").first().text().trim();
      if (/^\d{9,12}$/.test(ta)) return ta;
    }
  } catch {}
  try {
    const qs = input?.Sales?.source_http_request?.multiValueQueryString?.parid;
    if (Array.isArray(qs) && qs[0]) return String(qs[0]);
  } catch {}
  const err = {
      type: "error",
      message: "Parcel ID not found",
      path: "",
    };
  throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildStructure(input) {
  const buildings = input && input.Buildings && input.Buildings.response;
  let structures = {};
  if (buildings && Array.isArray(buildings.rows) && buildings.rows.length > 0) {
    // Determine indexes from cols
    const cols = buildings.cols || [];
    let idx = {};
    buildings.cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    buildings.rows.forEach((building, bidx) => {
      const stories = numberOrNull(building[idx.Stories]);
      const extValues = parseExteriorWall(building[idx["Const/ExtWall"]]);
      const roofMaterialValues = parseRoofMaterial(building[idx["RoofMaterial"]]);
      const roofTypeValues = parseRoofType(building[idx["RoofType"]]);
      const structure = {
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
        exterior_wall_material_primary: extValues[0],
        exterior_wall_material_secondary: extValues[1],
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
        number_of_stories: stories,
        primary_framing_material: null,
        roof_age_years: null,
        roof_condition: null,
        roof_covering_material: roofMaterialValues[1],
        roof_date: null,
        roof_design_type: roofTypeValues[1],
        roof_material_type: roofMaterialValues[0],
        roof_structure_material: roofTypeValues[0],
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
      structures[(bidx + 1).toString()] = structure;
    });
  }
  return structures;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const input = safeParse(inputPath);
  const parcelId = extractParcelId(input);
  const structure = buildStructure(input);
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
})();
