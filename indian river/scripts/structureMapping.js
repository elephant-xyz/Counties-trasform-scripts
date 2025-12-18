const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BUILDING_SECTION_TITLE = "Building Information";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
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
  section
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  section
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined = { ...buildings[buildingCount], ...map };
        buildings[buildingCount++] = combined;
      }
    });
  return buildings;
}

function parseNumber(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function mapRoofDesign(value) {
  if (!value) return null;
  const v = value.toUpperCase();
  if (v.includes("HIP")) return "Hip";
  if (v.includes("GABLE")) return "Gable";
  if (v.includes("FLAT")) return "Flat";
  if (v.includes("MANSARD")) return "Mansard";
  if (v.includes("GAMBREL")) return "Gambrel";
  if (v.includes("SHED")) return "Shed";
  if (v.includes("BUTTERFLY")) return "Butterfly";
  if (v.includes("BONNET")) return "Bonnet";
  if (v.includes("DOME")) return "Dome";
  if (v.includes("BARREL")) return "Barrel";
  return null;
}

function mapRoofCovering(value) {
  if (!value) return null;
  const v = value.toUpperCase();
  if (v.includes("METAL")) return "Metal Standing Seam";
  if (v.includes("SLATE")) return "Natural Slate";
  if (v.includes("CLAY") && v.includes("TILE")) return "Clay Tile";
  if (v.includes("CONCRETE") && v.includes("TILE")) return "Concrete Tile";
  if (v.includes("COMPOSITION") || v.includes("SHINGLE"))
    return "Architectural Asphalt Shingle";
  if (v.includes("3-TAB")) return "3-Tab Asphalt Shingle";
  return null;
}

function mapPrimaryFrame(value) {
  if (!value) return null;
  const v = value.toUpperCase();
  if (v.includes("WOOD")) return "Wood Frame";
  if (v.includes("STEEL")) return "Steel Frame";
  if (v.includes("CONCRETE")) return "Concrete Block";
  if (v.includes("MASONRY")) return "Masonry";
  return null;
}

function createBaseStructureRecord() {
  return {
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
}

function buildStructureRecords(buildings) {
  const structures = [];
  buildings.forEach((building, idx) => {
    const structure = createBaseStructureRecord();
    structure.number_of_stories = parseNumber(building["Stories"]);
    structure.roof_design_type = mapRoofDesign(building["Roof Type"]);
    structure.roof_covering_material = mapRoofCovering(building["Roofing"]);
    structure.primary_framing_material = mapPrimaryFrame(building["Frame"]);
    const totalArea = parseNumber(
      building["Total Area"] || building["Total Adjusted Area"],
    );
    if (totalArea != null) structure.finished_base_area = totalArea;
    structure.building_number = idx + 1;
    structures.push(structure);
  });
  return structures;
}

const seedPath = path.join(process.cwd(), "property_seed.json");
const seedData = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = seedData.parcel_id;
  const buildings = collectBuildings($);
  const structureRecords = buildStructureRecords(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    structures: structureRecords,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}

