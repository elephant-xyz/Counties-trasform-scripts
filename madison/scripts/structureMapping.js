// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated CSS Selectors
const PARCEL_SELECTOR = "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
// The HTML provided does not have a section explicitly titled "Buildings".
// The closest information related to a structure is under "Valuation" and "Extra Features".
// We will adapt `collectBuildings` to extract relevant data from these sections.
// For now, keeping BUILDING_SECTION_TITLE as a placeholder, but it won't be used directly
// to find a section with that exact title in the provided HTML.

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];

  // Extract data from the "Valuation" section
  const valuationSection = $("#ctlBodyPane_ctl09_mSection");
  if (valuationSection.length) {
    const valuationTable = valuationSection.find("#ctlBodyPane_ctl09_ctl01_grdValuation tbody");
    const buildingData = {};
    valuationTable.find("tr").each((_, tr) => {
      const label = textTrim($(tr).find("th").first().text());
      const value = textTrim($(tr).find("td.value-column").first().text()); // Get the first value column (2025 Working Values)
      if (label && value) {
        buildingData[label] = value;
      }
    });
    if (Object.keys(buildingData).length > 0) {
      // This is not a "building" in the traditional sense, but aggregated valuation data.
      // We'll treat it as a single "building" entry for the purpose of structure mapping.
      buildings.push(buildingData);
    }
  }

  // Extract data from the "Extra Features" section
  const extraFeaturesSection = $("#ctlBodyPane_ctl12_mSection");
  if (extraFeaturesSection.length) {
    const extraFeaturesTable = extraFeaturesSection.find("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
    extraFeaturesTable.find("tr").each((_, tr) => {
      const featureData = {};
      const cells = $(tr).find("th, td");
      featureData["Code"] = textTrim(cells.eq(0).text());
      featureData["Description"] = textTrim(cells.eq(1).text());
      featureData["Length x Width"] = textTrim(cells.eq(2).text());
      featureData["Area"] = textTrim(cells.eq(3).text());
      featureData["Year Built"] = textTrim(cells.eq(4).text());
      featureData["Value"] = textTrim(cells.eq(5).text());
      if (Object.keys(featureData).length > 0) {
        // Add extra features as separate "building" components if needed,
        // or merge into the main building data if it makes sense.
        // For now, we'll just add them as separate entries to demonstrate extraction.
        // A more sophisticated approach would merge these into a single structure.
        buildings.push(featureData);
      }
    });
  }

  return buildings;
}


function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Frame");
    if (t.includes("STEEL")) out.push("Steel Frame");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("CERAMIC")) out.push("Ceramic Tile");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
  });
  return out;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecord($, buildings) {
  // Defaults per schema requirements (all present, many null)
  const rec = {
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
    number_of_stories: null,
    primary_framing_material: null,
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

  // Aggregate from buildings (which now includes valuation and extra features)
  const extTokens = [];
  const intWallTokens = [];
  const floorTokens = [];
  const roofTokens = [];
  const frameTokens = [];
  const stories = [];
  let totalFinishedBaseArea = 0;

  buildings.forEach((b) => {
    // For the provided HTML, we don't have direct "Exterior Walls", "Interior Walls", "Floor Cover", "Roof Cover", "Frame Type", "Stories" fields.
    // We need to infer or leave null based on available data.

    // Example: If "Valuation" section has "Building Value", we can use it.
    // If "Extra Features" has "Year Built", we can use it.
    if (b["Building Value"]) {
      // This is a value, not a material or type.
      // We can potentially use it to infer existence of a building.
    }

    if (b["Year Built"]) {
      // This could be the year built for an extra feature, not necessarily the main building.
      // For a single structure, we might assume it's the main building's year.
      // For now, we don't have a direct mapping for roof_date or siding_installation_date from this.
    }

    if (b["Description"]) {
      const desc = b["Description"].toUpperCase();
      if (desc.includes("SEPTIC")) {
        // This is an extra feature, not part of the main structure's materials.
      }
      if (desc.includes("WELL")) {
        // Another extra feature.
      }
      if (desc.includes("GEN PRP BLDG")) {
        // General purpose building, could imply a shed or outbuilding.
        // We don't have enough detail to map materials from this.
      }
    }

    if (b["Just (Market) Value"]) {
      // This is a monetary value, not a physical attribute.
    }

    if (b["Finished Area"]) { // Assuming a field like this might exist in other HTML versions
      totalFinishedBaseArea += parseNumber(b["Finished Area"]) || 0;
    }
  });

  // Since the provided HTML doesn't have direct fields for many of these,
  // most of the `rec` fields will remain null.
  // If you have other HTML examples with more detailed building information,
  // the `collectBuildings` function and this `buildStructureRecord` function
  // would need to be updated to parse those specific fields.

  // Example of how to set a field if data was available:
  // rec.finished_base_area = totalFinishedBaseArea > 0 ? totalFinishedBaseArea : null;

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($); // This will now collect data from "Valuation" and "Extra Features"
  const structureRecord = buildStructureRecord($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structureRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}