// Structure mapping script
// Reads input.html, parses with cheerio, maps to structure schema, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const p = path.resolve("input.html");
  if (!fs.existsSync(p)) {
    throw new Error("input.html not found");
  }
  return fs.readFileSync(p, "utf8");
}

function text(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t.length ? t : null;
}

function getPropId($) {
  // Prop ID appears in Parcel Summary table under label 'Prop ID'
  let propId = null;
  $("#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary table tr").each(
    (i, el) => {
      const label = text($(el).find("th strong").first().text());
      if (label && label.toLowerCase().includes("prop id")) {
        const val = text($(el).find("td span").first().text());
        if (val) propId = val;
      }
    },
  );
  return propId || "unknown";
}

function getValueByLabel($scope, labelWanted) {
  let found = null;
  $scope.find("tr").each((_, tr) => {
    const $tr = cheerio.load(tr);
    const label = text($tr("th strong").first().text());
    if (!label) return;
    if (label.toLowerCase() === labelWanted.toLowerCase()) {
      const spanVal = text($tr("td span").first().text());
      const tdVal = spanVal || text($tr("td").first().text());
      found = tdVal;
    }
  });
  return found;
}

function mapExteriorWallMaterial(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("HARDI")) return "Fiber Cement Siding";
  if (v.includes("BRICK")) return "Brick";
  if (v.includes("STUCCO")) return "Stucco";
  if (v.includes("VINYL")) return "Vinyl Siding";
  if (v.includes("WOOD")) return "Wood Siding";
  return null;
}

function mapRoofDesign(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("GABLE") && v.includes("HIP")) return "Combination";
  if (v.includes("GABLE")) return "Gable";
  if (v.includes("HIP")) return "Hip";
  if (v.includes("FLAT")) return "Flat";
  return null;
}

function mapFlooringPrimary(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("CARPET")) return "Carpet";
  if (v.includes("CLAY") || v.includes("CERAMIC")) return "Ceramic Tile";
  if (v.includes("TILE")) return "Ceramic Tile";
  if (v.includes("VINYL")) return "Luxury Vinyl Plank";
  if (v.includes("WOOD")) return "Solid Hardwood";
  return null;
}

function mapFlooringSecondary(val) {
  if (!val) return null;
  const options = [];
  if (/CARPET/i.test(val)) options.push("Carpet");
  if (/(CLAY|CERAMIC|TILE)/i.test(val)) options.push("Ceramic Tile");
  if (/VINYL/i.test(val)) options.push("Luxury Vinyl Plank");
  if (/WOOD/i.test(val)) options.push("Solid Hardwood");
  const uniq = Array.from(new Set(options));
  if (uniq.length > 1) return uniq[1];
  return null;
}

function parseIntSafe(str) {
  if (!str) return null;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function buildStructure($) {
  const section = $("#ctlBodyPane_ctl10_mSection");
  const left = section.find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary",
  );
  const right = section.find(
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary",
  );

  const exteriorWalls = getValueByLabel(left, "Exterior Walls");
  const interiorWalls = getValueByLabel(left, "Interior Walls");
  const roofing = getValueByLabel(left, "Roofing");
  const roofType = getValueByLabel(left, "Roof Type");
  const floorCover = getValueByLabel(left, "Floor Cover");
  const stories = getValueByLabel(right, "Stories");

  // Debug log
  console.error("DEBUG structure:", {
    exteriorWalls,
    interiorWalls,
    roofing,
    roofType,
    floorCover,
    stories,
  });

  let baseArea = null;
  $(
    "#ctlBodyPane_ctl11_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail tbody tr",
  ).each((_, tr) => {
    const $tr = $(tr);
    const type = text($tr.find("th").first().text());
    const desc = text($tr.find("td").eq(0).text());
    if (
      (type && type.toUpperCase() === "BAS") ||
      (desc && desc.toUpperCase().includes("BASE AREA"))
    ) {
      baseArea = parseIntSafe($tr.find("td").eq(1).text());
    }
  });

  const numberOfStories = stories ? Math.round(parseFloat(stories)) : null;

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: mapExteriorWallMaterial(exteriorWalls),
    exterior_wall_material_secondary: null,
    finished_base_area: baseArea,
    finished_basement_area: 0,
    finished_upper_story_area: 0,
    flooring_condition: null,
    flooring_material_primary: mapFlooringPrimary(floorCover),
    flooring_material_secondary: mapFlooringSecondary(floorCover),
    foundation_condition: "Unknown",
    foundation_material: "Poured Concrete",
    foundation_type: "Slab on Grade",
    foundation_waterproofing: "Unknown",
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary:
      interiorWalls && interiorWalls.toUpperCase().includes("DRYWALL")
        ? "Drywall"
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: numberOfStories,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material:
      roofing && /ASPHALT/i.test(roofing)
        ? "Architectural Asphalt Shingle"
        : null,
    roof_date: null,
    roof_design_type: mapRoofDesign(roofType),
    roof_material_type: roofing && /ASPHALT/i.test(roofing) ? "Shingle" : null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: "Concrete Slab",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  return structure;
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const propId = getPropId($);
  const structure = buildStructure($);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const data = {};
  data[`property_${propId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
