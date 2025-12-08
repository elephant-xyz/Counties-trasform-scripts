// Structure mapping script
// Generates owners/structure_data.json with a structure record per building.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  const parcelIdText = $(PARCEL_SELECTOR).text().trim();
  return parcelIdText || null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label) label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let index = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label) label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length && buildings[index]) {
        buildings[index] = { ...buildings[index], ...map };
        index += 1;
      }
    });
  return buildings;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function tokenize(value) {
  return (value || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("STONE")) out.push("Natural Stone");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
    if (t.includes("EIFS")) out.push("EIFS");
    if (t.includes("WOOD") || t.includes("CEDAR")) out.push("Wood Siding");
    if (t.includes("METAL") || t.includes("ALUM")) out.push("Metal Siding");
  });
  return Array.from(new Set(out));
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase();
    if (!t) return;
    if (t.includes("DRYWALL") || t.includes("SHEETROCK")) out.push("Drywall");
    if (t.includes("PLASTER")) out.push("Plaster");
    if (t.includes("WOOD") || t.includes("PANEL")) out.push("Wood Paneling");
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Exposed Brick");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Exposed Block");
    if (t.includes("STONE")) out.push("Stone Veneer");
  });
  return Array.from(new Set(out));
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase();
    if (!t) return;
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
    if (t.includes("CERAMIC") || t.includes("TILE")) out.push("Ceramic Tile");
    if (t.includes("WOOD")) out.push("Hardwood");
  });
  return Array.from(new Set(out));
}

function createStructureFromBuilding(building, buildingNumber) {
  const record = {
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
    building_number: buildingNumber,
  };

  const extMaterials = mapExteriorMaterials(
    tokenize(building["Exterior Walls"]),
  );
  if (extMaterials.length) {
    record.exterior_wall_material_primary = extMaterials[0];
    if (extMaterials.length > 1)
      record.exterior_wall_material_secondary = extMaterials[1];
  }

  const interiorSurfaces = mapInteriorSurface(
    tokenize(building["Interior Walls"]),
  );
  if (interiorSurfaces.length) {
    record.interior_wall_surface_material_primary = interiorSurfaces[0];
    if (interiorSurfaces.length > 1)
      record.interior_wall_surface_material_secondary = interiorSurfaces[1];
  }

  const flooring = mapFlooring(tokenize(building["Floor Cover"]));
  if (flooring.length) {
    record.flooring_material_primary = flooring[0];
    if (flooring.length > 1)
      record.flooring_material_secondary = flooring[1];
  }

  const roofTokens = tokenize(building["Roof Cover"]);
  if (roofTokens.length) {
    const roofText = roofTokens.join(" ").toUpperCase();
    if (
      roofText.includes("ENG SHINGL") ||
      roofText.includes("ARCH") ||
      roofText.includes("ARCHITECT") ||
      roofText.includes("SHINGLE")
    ) {
      record.roof_covering_material = "Architectural Asphalt Shingle";
    }
  }

  const frameTokens = tokenize(building["Frame Type"]);
  const frameText = frameTokens.join(" ").toUpperCase();
  if (frameText.includes("WOOD")) record.primary_framing_material = "Wood Frame";
  else if (frameText.includes("STEEL"))
    record.primary_framing_material = "Steel Frame";

  const stories = parseNumber(building["Stories"]);
  if (stories != null) record.number_of_stories = stories;

  const finishedArea =
    parseNumber(building["Heated Area"]) ||
    parseNumber(building["Living Area"]) ||
    parseNumber(building["Total Area"]);
  if (finishedArea != null) record.finished_base_area = finishedArea;

  const roofYear = parseNumber(building["Actual Year Built"]);
  if (roofYear) record.roof_date = String(roofYear);

  return record;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");

  const buildings = collectBuildings($);
  const structures = buildings.map((building, idx) =>
    createStructureFromBuilding(building, idx + 1),
  );

  if (!structures.length) {
    console.log("No structures found.");
    return;
  }

  const filteredStructures = structures.filter((record) => {
    const keys = Object.keys(record);
    return keys.some((key) => {
      if (key === "building_number") return true;
      const value = record[key];
      return value !== null && value !== undefined && value !== "";
    });
  });

  if (!filteredStructures.length) {
    console.log("No populated structures found.");
    return;
  }

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  if (filteredStructures.length === 1)
    outObj[`property_${parcelId}`] = filteredStructures[0];
  else outObj[`property_${parcelId}`] = { structures: filteredStructures };

  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
