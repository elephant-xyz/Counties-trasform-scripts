// Structure Mapping Script
// Reads input.html, parses with cheerio, extracts structure fields per schema, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function parseNumber(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^0-9.\-]/g, "");
  if (!n) return null;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function getParcelId($) {
  // Prefer data-parcelid
  const dataId = $("script#display\\.js").attr("data-parcelid");
  if (dataId && /\d{6,}/.test(dataId)) return dataId.trim();
  // Try comment pattern "DB: <id>"
  const html = $.html();
  const m = html.match(/DB:\s*(\d{12,})/);
  if (m) return m[1];
  // Try query params like strap=
  const m2 = html.match(/strap=(\d{12,})/);
  if (m2) return m2[1];
  return "unknown_property_id";
}

function extractBuildings($) {
  const result = [];
  $("#bldngs h4").each((i, el) => {
    const h4 = $(el);
    if (!/BUILDING\s+\d+/i.test(h4.text())) return;
    const container = h4.nextAll("table").first();
    if (container.length === 0) return;

    let livingArea = null;
    let yearBuilt = null;
    let buildingValue = null; // Added buildingValue
    const charBlockText = container.text();
    const laMatch = charBlockText.match(/Living\s*Area:\s*([0-9,]+)/i);
    if (laMatch) livingArea = parseNumber(laMatch[1]);
    const ybMatch = charBlockText.match(/Actual\s*Year\s*Built:\s*(\d{4})/i);
    if (ybMatch) yearBuilt = parseNumber(ybMatch[1]);
    const bvMatch = charBlockText.match(/Building\s*Value:\s*\$([0-9,]+)/i); // Extract Building Value
    if (bvMatch) buildingValue = parseNumber(bvMatch[1]);

    // Element table
    const elementTable = container
      .find("table")
      .filter((_, t) =>
        $(t)
          .find("tr.header td")
          .first()
          .text()
          .toUpperCase()
          .includes("ELEMENT"),
      )
      .first();
    let substruct = null;
    let frameType = null;
    let exteriorWall = null;
    let roofStructure = null;
    let bedrooms = null; // Added bedrooms
    let fullBaths = null; // Added fullBaths
    let halfBaths = null; // Added halfBaths
    let fireplace = null; // Added fireplace
    let centralHeatingAc = null; // Added centralHeatingAc
    let style = null; // Added style
    let units = null; // Added units
    let storyHeightInfo = null; // Added storyHeightInfo

    if (elementTable.length) {
      elementTable.find("tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const label = $(tds[0]).text().trim().toUpperCase();
          const info = $(tds[2]).text().trim().toUpperCase();
          const unitsVal = $(tds[1]).text().trim(); // Get units value

          if (label.includes("SUBSTRUCT")) substruct = info;
          if (label.includes("FRAME") || label.includes("CONST TYPE"))
            frameType = info;
          if (label.includes("EXTERIOR WALL")) exteriorWall = info;
          if (label.includes("ROOF STRUCTURE")) roofStructure = info;
          if (label.includes("BEDROOM")) bedrooms = parseNumber(unitsVal);
          if (label.includes("FULL BATH")) fullBaths = parseNumber(unitsVal);
          if (label.includes("HALF BATH")) halfBaths = parseNumber(unitsVal);
          if (label.includes("FIREPLACE")) fireplace = unitsVal === 'Y';
          if (label.includes("CNTRL HEATING / AC")) centralHeatingAc = unitsVal === 'Y';
          if (label.includes("STYLE")) style = info;
          if (label.includes("UNITS")) units = parseNumber(unitsVal);
          if (label.includes("STORY HEIGHT INFO ONLY")) storyHeightInfo = info;
        }
      });
    }

    // Subareas table to compute base and upper story
    let baseArea = null;
    let upperArea = 0;
    let totalUnderRoof = null; // Added totalUnderRoof
    let totalLivingArea = null; // Added totalLivingArea

    const subareasTable = container
      .find("table.center")
      .filter((_, t) =>
        $(t)
          .find("tr.header td")
          .first()
          .text()
          .toUpperCase()
          .includes("CODE/DESCRIPTION"),
      )
      .first();
    if (subareasTable.length) {
      subareasTable.find("tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const name = $(tds[0]).text().trim().toUpperCase();
          const totalTxt = $(tds[2]).text();
          const total = parseNumber(totalTxt) || 0;
          if (name.startsWith("BASE AREA")) baseArea = total;
          if (name.startsWith("TWO")) upperArea = total;
        }
      });
      // Extract Total Under Roof and Total Living Area from the footer of the subareas table
      const footerRows = subareasTable.find('tr.header');
      footerRows.each((_, row) => {
        const rowText = $(row).text().trim().toUpperCase();
        const turMatch = rowText.match(/TOTAL UNDER ROOF\s*([0-9,]+)\s*SQ FT/);
        if (turMatch) totalUnderRoof = parseNumber(turMatch[1]);
        const tlaMatch = rowText.match(/TOTAL LIVING AREA\s*([0-9,]+)\s*SQ FT/);
        if (tlaMatch) totalLivingArea = parseNumber(tlaMatch[1]);
      });
    }

    result.push({
      idx: i + 1,
      title: h4.text().trim(),
      livingArea,
      yearBuilt,
      buildingValue, // Added
      substruct,
      frameType,
      exteriorWall,
      roofStructure,
      bedrooms, // Added
      fullBaths, // Added
      halfBaths, // Added
      fireplace, // Added
      centralHeatingAc, // Added
      style, // Added
      units, // Added
      storyHeightInfo, // Added
      baseArea,
      upperArea,
      totalUnderRoof, // Added
      totalLivingArea, // Added
    });
  });
  return result;
}

function mapExteriorWallToEnum(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("HARDY") || v.includes("HARDIE") || v.includes("FIBER"))
    return "Fiber Cement Siding";
  if (v === "WOOD" || v.includes("WOOD")) return "Wood Siding";
  if (v.includes("BRICK")) return "Brick";
  if (v.includes("STUCCO")) return "Stucco";
  if (v.includes("VINYL")) return "Vinyl Siding";
  if (v.includes("STONE")) return "Manufactured Stone";
  if (v.includes("METAL")) return "Metal Siding";
  return null;
}

function mapFrameToEnum(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("MASONRY") || v.includes("BLOCK")) return "Concrete Block";
  if (v.includes("WOOD")) return "Wood Frame";
  if (v.includes("STEEL")) return "Steel Frame";
  return null;
}

function mapRoofDesign(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("GABLE")) return "Gable";
  if (v.includes("HIP")) return "Hip";
  if (v.includes("FLAT")) return "Flat";
  if (v.includes("SHED")) return "Shed";
  return null;
}

function mapRoofMaterialType(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("METAL")) return "Metal";
  if (v.includes("SHINGLE")) return "Shingle";
  if (v.includes("TILE")) return "Tile";
  if (v.includes("CONCRETE")) return "PouredConcrete";
  if (v.includes("WOOD")) return "Wood";
  return null;
}

function mapFoundationType(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("CONTINUOUS WALL")) return "Stem Wall";
  return null;
}

// Function to extract roof age from the HTML
function getRoofAgeYears($) {
  const effectiveYearText = $('span:contains("Effective Year:")').text();
  const match = effectiveYearText.match(/Effective Year:\s*(\d{4})/);
  if (match) {
    const effectiveYear = parseInt(match[1], 10);
    const currentYear = new Date().getFullYear();
    return currentYear - effectiveYear;
  }
  return null;
}

// Function to determine roof covering material
function getRoofCoveringMaterial(roofStructure) {
  if (!roofStructure) return null;
  const v = roofStructure.toUpperCase();
  if (v.includes("SHINGLE")) return "Architectural Asphalt Shingle"; // Assuming architectural for modern homes
  if (v.includes("METAL")) return "Metal Standing Seam"; // Assuming standing seam for modern homes
  if (v.includes("TILE")) return "Clay Tile"; // Or Concrete Tile, depending on context
  return null;
}

// Function to determine ceiling height (placeholder, as it's not directly in HTML)
function getCeilingHeightAverage($) {
  // This information is not directly available in the provided HTML.
  // You might need to infer it from other data or leave it as null.
  return null;
}

function buildStructureObject(primaryBuilding, $) {
  const exteriorPrimary = mapExteriorWallToEnum(primaryBuilding.exteriorWall);
  const primaryFrame = mapFrameToEnum(primaryBuilding.frameType);
  const roofDesign = mapRoofDesign(primaryBuilding.roofStructure);
  const roofMaterialType = mapRoofMaterialType(primaryBuilding.roofStructure);
  const foundationType = mapFoundationType(primaryBuilding.substruct);
  const roofAgeYears = getRoofAgeYears($); // Fetch roof age

  const upperVal =
    Number.isFinite(primaryBuilding.upperArea) && primaryBuilding.upperArea > 0
      ? Math.round(primaryBuilding.upperArea)
      : null;

  const roofCoveringMaterial = getRoofCoveringMaterial(primaryBuilding.roofStructure);

  const obj = {
    architectural_style_type: null, // Not directly available, could be inferred from 'style'
    attachment_type: "Detached", // Assumed from "Single Family"
    ceiling_condition: null, // Not available
    ceiling_height_average: getCeilingHeightAverage($), // Not directly available
    ceiling_insulation_type: null, // Not available
    ceiling_structure_material: null, // Not available
    ceiling_surface_material: null, // Not available
    exterior_door_material: null, // Not available
    exterior_wall_condition: null, // Not available
    exterior_wall_condition_primary: null, // Not available
    exterior_wall_condition_secondary: null, // Not available
    exterior_wall_insulation_type: null, // Not available
    exterior_wall_insulation_type_primary: null, // Not available
    exterior_wall_insulation_type_secondary: null, // Not available
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: null, // Not available
    finished_base_area: Number.isFinite(primaryBuilding.baseArea)
      ? Math.round(primaryBuilding.baseArea)
      : null,
    finished_basement_area: null, // Not available
    finished_upper_story_area: upperVal,
    flooring_condition: null, // Not available
    flooring_material_primary: null, // Not available
    flooring_material_secondary: null, // Not available
    foundation_condition: null, // Not available
    foundation_material: null, // Not available
    foundation_type: foundationType,
    foundation_waterproofing: null, // Not available
    gutters_condition: null, // Not available
    gutters_material: null, // Not available
    interior_door_material: null, // Not available
    interior_wall_condition: null, // Not available
    interior_wall_finish_primary: null, // Not available
    interior_wall_finish_secondary: null, // Not available
    interior_wall_structure_material: null, // Not available
    interior_wall_structure_material_primary: null, // Not available
    interior_wall_structure_material_secondary: null, // Not available
    interior_wall_surface_material_primary: null, // Not available
    interior_wall_surface_material_secondary: null, // Not available
    primary_framing_material: primaryFrame,
    roof_age_years: roofAgeYears, // Added
    roof_condition: null, // Not available
    roof_covering_material: roofCoveringMaterial, // Added
    roof_design_type: roofDesign,
    roof_material_type: roofMaterialType,
    roof_structure_material: null, // Not available
    roof_underlayment_type: null, // Not available
    secondary_framing_material: null, // Not available
    structural_damage_indicators: null, // Not available
    subfloor_material: null, // Not available
    unfinished_base_area: null, // Not available
    unfinished_basement_area: null, // Not available
    unfinished_upper_story_area: null, // Not available
    window_frame_material: null, // Not available
    window_glazing_type: null, // Not available
    window_operation_type: null, // Not available
    window_screen_material: null, // Not available
  };
  return obj;
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  const buildings = extractBuildings($);
  // Choose largest living area as primary
  let primary = null;
  buildings.forEach((b) => {
    if (!primary || (b.livingArea || 0) > (primary.livingArea || 0))
      primary = b;
  });
  if (!primary && buildings.length) primary = buildings[0];
  const structureObj = buildStructureObject(primary || {}, $); // Pass $ to access other parts of the HTML

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = structureObj;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in structureMapping:", err.message);
    process.exit(1);
  }
}