// Structure mapping script
// Reads input.html, extracts parcel and building info, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");



/**
 * Extracts the `model` object literal from the onClickTaxCalculator function in palmbeach.html
 * and returns it as a plain JavaScript object.
 *
 * @param {string} $ - The HTML content of palmbeach.html parsed using cheerio.
 * @returns {object|null} Parsed model object if found, otherwise null.
 */
function parsePalmBeachModel($) {
  let targetScript = null;

  $('script').each((_, element) => {
    const scriptBody = $(element).html();
    if (scriptBody && scriptBody.includes('function onClickTaxCalculator')) {
      targetScript = scriptBody;
      return false; // Break out early once we find the function definition
    }
    return undefined;
  });

  if (!targetScript) {
    return null;
  }

  const modelIndex = targetScript.indexOf('var model');
  if (modelIndex === -1) {
    return null;
  }

  const objectStart = targetScript.indexOf('{', modelIndex);
  if (objectStart === -1) {
    return null;
  }

  const objectLiteral = extractObjectLiteral(targetScript, objectStart);
  if (!objectLiteral) {
    return null;
  }

  try {
    const parsedModel = JSON.parse(objectLiteral);
    parsedModel.structuralDetails = enhanceStructuralDetails(parsedModel.structuralDetails);
    return parsedModel;
  } catch (error) {
    throw new Error(`Failed to parse Palm Beach model JSON: ${error.message}`);
  }
}

/**
 * Walks the script content starting at the first opening brace and returns the
 * full object literal including nested objects.
 *
 * @param {string} script - JavaScript source that contains the object literal.
 * @param {number} startIndex - Index of the first `{` character.
 * @returns {string|null} Raw object literal text or null if it cannot be isolated.
 */
function extractObjectLiteral(script, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = startIndex; i < script.length; i += 1) {
    const char = script[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return script.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function enhanceStructuralDetails(structuralDetails) {
  if (!structuralDetails || typeof structuralDetails !== 'object') {
    return structuralDetails || null;
  }

  const combinedBuildings = combineStructuralElements(structuralDetails.StructuralElements);
  return {
    ...structuralDetails,
    combinedBuildings,
  };
}

function combineStructuralElements(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }

  const grouped = elements.reduce((acc, element) => {
    const buildingNumber = element?.BuildingNumber || 'Unknown';
    if (!acc[buildingNumber]) {
      acc[buildingNumber] = {
        buildingNumber,
        sections: {},
      };
    }

    const section = element?.DetailsSection || 'General';
    const name = element?.ElementName || `element${element?.ElementNumber || ''}`;
    const value = element?.ElementValue ?? null;

    if (!acc[buildingNumber].sections[section]) {
      acc[buildingNumber].sections[section] = {};
    }

    const sectionEntries = acc[buildingNumber].sections[section];
    if (!(name in sectionEntries)) {
      sectionEntries[name] = value;
    } else if (Array.isArray(sectionEntries[name])) {
      sectionEntries[name].push(value);
    } else {
      sectionEntries[name] = [sectionEntries[name], value];
    }

    return acc;
  }, {});

  return Object.values(grouped);
}

function mapExteriorWallPrimary(raw) {
  const text = (raw || "").toLowerCase();
  if (!text || text.includes("none") || text.includes("n/a")) return null;
  if (text.includes("stucco")) return "Stucco";
  if (text.includes("brick")) return "Brick";
  if (text.includes("stone")) return "Natural Stone";
  if (text.includes("vinyl")) return "Vinyl Siding";
  if (text.includes("wood")) return "Wood Siding";
  if (text.includes("fiber")) return "Fiber Cement Siding";
  if (text.includes("metal")) return "Metal Siding";
  if (text.includes("block") || text.includes("cb")) return "Concrete Block";
  return null;
}

function mapRoofCover(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  if (txt.includes("asphalt") || txt.includes("composition")) {
    return "3-Tab Asphalt Shingle";
  }
  if (txt.includes("architectural")) return "Architectural Asphalt Shingle";
  if (txt.includes("metal")) return "Metal Standing Seam";
  if (txt.includes("concrete")) return "Concrete Tile";
  if (txt.includes("clay") || txt.includes("tile")) return "Clay Tile";
  if (txt.includes("tpo")) return "TPO Membrane";
  if (txt.includes("epdm")) return "EPDM Membrane";
  if (txt.includes("modified")) return "Modified Bitumen";
  if (txt.includes("slate")) return "Natural Slate";
  if (txt.includes("shake")) return "Wood Shake";
  return null;
}

function mapRoofStruct(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  if (txt.includes("concrete")) return "Concrete Beam";
  if (txt.includes("engineered") || txt.includes("lumber")) return "Engineered Lumber";
  if (txt.includes("steel")) return "Steel Truss";
  if (txt.includes("rafter")) return "Wood Rafter";
  if (txt.includes("wood")) return "Wood Truss";
  
  return null;
}

function mapRoofDesign(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  const hasGable = txt.includes("gable");
  const hasHip = txt.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (txt.includes("flat")) return "Flat";
  if (txt.includes("shed")) return "Shed";
  return null;
}

function mapFlooring(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt || txt.includes("n/a")) return null;
  if (txt.includes("carpet")) return "Carpet";
  if (txt.includes("tile")) return "Ceramic Tile";
  if (txt.includes("vinyl plank")) return "Luxury Vinyl Plank";
  if (txt.includes("vinyl")) return "Sheet Vinyl";
  if (txt.includes("hardwood")) return "Solid Hardwood";
  if (txt.includes("laminate")) return "Laminate";
  if (txt.includes("concrete")) return "Polished Concrete";
  return null;
}

function mapPrimaryFraming(rawExterior) {
  const txt = (rawExterior || "").toLowerCase();
  if (
    txt.includes("cb") ||
    txt.includes("concrete block") ||
    txt.includes("block")
  )
    return "Concrete Block";
  return null;
}

// Mapping table for Palm Beach structural labels → exterior + framing per guideline
function mapWallAndFrameGuideline(raw) {
  const key = (raw || "").toUpperCase().trim();
  const MAP = {
    "NONE": { exterior: null, framing: null },
    "MSY: CONC. SIP FORMING": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "MSY: PRECAST PNL/REIN. CONC": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "WSF/MSY: CEMENT FIBER SIDING": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "WSF/MSY: WOOD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: PREFAB PNL": { exterior: "Metal Siding", framing: "Wood Frame" },
    "WSF: ASPHALT SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: STONE": { exterior: "Natural Stone", framing: "Wood Frame" },
    "MSY: STONE": { exterior: "Natural Stone", framing: "Concrete Block" },
    "WSF/MSY: VINYL/STL/ALUM": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "WSF: PLYWD/STL/ALUM SHTH": { exterior: "Wood Siding", framing: "Wood Frame" },
    "ADOBE/HOLLOW CLAY BLK": { exterior: "Adobe", framing: "Masonry" },
    "MSY: CONC. BLOCK": { exterior: "Concrete Block", framing: "Concrete Block" },
    "WSF: STUCCO": { exterior: "Stucco", framing: "Wood Frame" },
    "MSY: CB STUCCO": { exterior: "Stucco", framing: "Concrete Block" },
    "WSF: BRICK": { exterior: "Brick", framing: "Wood Frame" },
    "MSY: BRICK": { exterior: "Brick", framing: "Concrete Block" },
    "WSF: WOOD SHINGLE": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: COMP OR HARD BD": { exterior: "Wood Siding", framing: "Wood Frame" },
    "LOG": { exterior: "Log", framing: "Log Construction" },
    "WSF LOG VENEER": { exterior: "Log", framing: "Wood Frame" },
    "MSY LOG VENEER": { exterior: "Log", framing: "Concrete Block" },
    "GLASS": { exterior: "Curtain Wall", framing: "Steel Frame" },
    "BARN/HANGAR: HOLLOW CLAY BLOCK": { exterior: "Adobe", framing: "Masonry" },
    "BARN/HANGAR: CONCRETE BLOCK": { exterior: "Concrete Block", framing: "Concrete Block" },
    "BARN/HANGAR: CONCRETE BLOCK STUCCO": { exterior: "Stucco", framing: "Concrete Block" },
    "BARN/HANGAR: REINFORCED CONCRETE": { exterior: "Precast Concrete", framing: "Poured Concrete" },
    "BARN/HANGAR: PRECAST PANELS": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "BARN/HANGAR: STONE": { exterior: "Natural Stone", framing: "Masonry" },
    "BARN/HANGAR: METAL PANELS (ALUM/STEEL)": { exterior: "Metal Siding", framing: "Steel Frame" },
    "BARN/HANGAR: CEMENT FIBER SIDING/SHINGLES": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "BARN/HANGAR: PLYWOOD / WOOD FRAME STUCCO / WOOD SIDING / CEDAR/REDWOOD": { exterior: "Wood Siding", framing: "Wood Frame" },
    "BARN/HANGAR: VINYL SIDING": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "BARN/HANGAR: BRICK VENEER": { exterior: "Brick", framing: "Wood Frame" },
    "BARN/HANGAR: STONE VENEER": { exterior: "Manufactured Stone", framing: "Wood Frame" },
    "MFG HOME: ALUMINUM": { exterior: "Metal Siding", framing: "Wood Frame" },
    "MFG HOME: CEMENT FIBER SIDING": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "MFG HOME: HARD-BOARD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: LOG SIDING": { exterior: "Log", framing: "Wood Frame" },
    "MFG HOME: PLYWOOD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: STUCCO SIDING": { exterior: "Stucco", framing: "Wood Frame" },
    "MFG HOME: WOOD SHINGLE/SHAKE": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: VINYL SIDING": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "MFG HOME: MASONRY VENEER": { exterior: "Brick", framing: "Wood Frame" },
  };
  return MAP[key] || null;
}

function buildStructureRecord(buildings) {
  let structures = {};
  buildings.forEach((building, bIdx) => {
    const exteriorWall1 = building?.sections?.Top?.["Exterior Wall 1"];
    const exteriorWall2 = building?.sections?.Top?.["Exterior Wall 2"];
    const roofStructure = building?.sections?.Top?.["Roof Structure "];
    const roofCover = building?.sections?.Top?.["Roof Cover "];
    const interiorWall1 = building?.sections?.Top?.["Interior Wall 1"];
    const interiorWall2 = building?.sections?.Top?.["Interior Wall 2"];
    const floorType1 = building?.sections?.Top?.["Floor Type 1"];
    const floorType2 = building?.sections?.Top?.["Floor Type 2"];
    const storiesRaw = building?.sections?.Top?.["Stories"];
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
      exterior_wall_material_primary: (function () {
        const m1 = mapWallAndFrameGuideline(exteriorWall1);
        const m2 = mapWallAndFrameGuideline(exteriorWall2);
        if (m1 && m1.exterior !== undefined) return m1.exterior;
        if (m2 && m2.exterior !== undefined) return m2.exterior;
        return mapExteriorWallPrimary(exteriorWall1);
      })(),
      exterior_wall_material_secondary: null,
      finished_base_area: null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      flooring_condition: null,
      flooring_material_primary: mapFlooring(floorType1),
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
      interior_wall_structure_material: (function () {
        const m1 = mapWallAndFrameGuideline(exteriorWall1);
        if (m1 && m1.framing) return m1.framing;
      })(),
      interior_wall_structure_material_primary: (function () {
        const m1 = mapWallAndFrameGuideline(exteriorWall1);
        if (m1 && m1.framing) return m1.framing;
      })(),
      interior_wall_structure_material_secondary: null,
      interior_wall_surface_material_primary: null,
      interior_wall_surface_material_secondary: null,
      number_of_stories: Number.parseInt(storiesRaw, 10) || null,
      primary_framing_material: (function () {
        const m1 = mapWallAndFrameGuideline(exteriorWall1);
        const m2 = mapWallAndFrameGuideline(exteriorWall2);
        if (m1 && m1.framing !== undefined) return m1.framing;
        if (m2 && m2.framing !== undefined) return m2.framing;
        return mapPrimaryFraming(exteriorWall1);
      })(),
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: mapRoofCover(roofCover),
      roof_date: null,
      roof_design_type: null,
      roof_material_type: null,
      roof_structure_material: mapRoofStruct(roofStructure),
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
    structures[(bIdx + 1).toString()] = structure;
  });

  return structures;
}


(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parsed = parsePalmBeachModel($);

  const parcelId = parsed.propertyDetail.PCN;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const output = {};
  output[propertyKey] = buildStructureRecord((parsed.structuralDetails && parsed.structuralDetails.combinedBuildings) ? parsed.structuralDetails.combinedBuildings : []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data to ${outPath}`);
})();
