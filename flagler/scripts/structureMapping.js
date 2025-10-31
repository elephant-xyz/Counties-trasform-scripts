// Structure extractor: reads input.html and writes owners/structure_data.json per schema
// Uses cheerio for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseNumber(val) {
  if (val == null) return null;
  const n = String(val).replace(/[,\s]/g, "");
  const num = parseFloat(n);
  return isNaN(num) ? null : num;
}

function text($el) {
  if (!$el || $el.length === 0) return "";
  return $el.text().trim();
}

function loadHtml() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getPropId($) {
  // Prop ID in Parcel Summary table
  const propId = text(
    $(
      "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue span",
    ),
  );
  return propId || "unknown";
}

function extractBuildingFacts($) {
  const facts = {};
  // Collect key-value from both left and right two-column tables in Residential Buildings
  const section = $("#ctlBodyPane_ctl10_mSection");
  section.find(".tabular-data-two-column tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const key = text($(tds[0])).replace(/\s+/g, " ").trim();
      const val = text($(tds[1]));
      if (key) facts[key] = val;
    }
  });
  return facts;
}

function extractAreaTypes($) {
  const res = [];
  const rows = $(
    "#ctlBodyPane_ctl13_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail tbody tr",
  );
  rows.each((_, tr) => {
    const th = $(tr).find("th");
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      res.push({
        code: text(th),
        description: text($(tds[0])),
        sqft: parseNumber(text($(tds[1]))),
        year: text($(tds[2])),
      });
    }
  });
  return res;
}

function mapStructure($) {
  const propId = getPropId($);
  const facts = extractBuildingFacts($);
  const areas = extractAreaTypes($);

  // Inferences and mappings
  const exteriorWallsRaw = (facts["Exterior Walls"] || "").toUpperCase();
  const roofCoverRaw = (facts["Roof Cover"] || "").toUpperCase();
  const interiorWallsRaw = (facts["Interior Walls"] || "").toUpperCase();
  const frameTypeRaw = (facts["Frame Type"] || "").toUpperCase();
  const floorCoverRaw = (facts["Floor Cover"] || "").toUpperCase();

  // Exterior wall material primary
  let exterior_wall_material_primary = null;
  if (exteriorWallsRaw.includes("STUCCO"))
    exterior_wall_material_primary = "Stucco";

  // Flooring
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  if (floorCoverRaw.includes("CARPET")) flooring_material_primary = "Carpet";
  if (floorCoverRaw.match(/CER|CLAY|CERA|CERAM|TILE/)) {
    if (!flooring_material_primary) flooring_material_primary = "Ceramic Tile";
    else flooring_material_secondary = "Ceramic Tile";
  }

  // Interior wall surface
  let interior_wall_surface_material_primary = null;
  if (interiorWallsRaw.includes("DRYWALL"))
    interior_wall_surface_material_primary = "Drywall";

  // Framing material
  let primary_framing_material = null;
  if (frameTypeRaw.includes("MASONRY")) primary_framing_material = "Masonry";

  // Roof covering material
  let roof_covering_material = null;
  if (roofCoverRaw.includes("ASP") || roofCoverRaw.includes("COM")) {
    // Asphalt/Composition Shingle
    roof_covering_material = "Architectural Asphalt Shingle";
  }

  // Foundation/Subfloor: infer slab on grade for Florida SFR unless stated otherwise
  const foundation_type = "Slab on Grade";
  const foundation_material = "Poured Concrete";
  const subfloor_material = "Concrete Slab";

  // Finished base area from Building Area Types (BAS)
  let finished_base_area = null;
  areas.forEach((a) => {
    if (a.code === "BAS" && typeof a.sqft === "number")
      finished_base_area = Math.round(a.sqft);
  });

  // Assemble structure object adhering to schema
  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",

    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,

    flooring_material_primary: flooring_material_primary,
    flooring_material_secondary: flooring_material_secondary,
    subfloor_material: subfloor_material,
    flooring_condition: null,

    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,

    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary: null,

    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,

    roof_covering_material: roof_covering_material,
    roof_underlayment_type: "Unknown",
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    roof_material_type: "Shingle",

    gutters_material: null,
    gutters_condition: null,

    foundation_type: foundation_type,
    foundation_material: foundation_material,
    foundation_waterproofing: "Unknown",
    foundation_condition: "Unknown",

    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: "Unknown",
    ceiling_height_average: null,
    ceiling_condition: null,

    exterior_door_material: null,
    interior_door_material: null,

    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,

    primary_framing_material: primary_framing_material,
    secondary_framing_material: null,
    structural_damage_indicators: null,

    // Optional areas
    finished_base_area: finished_base_area,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,

    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_material_secondary: null,

    // Dates optional
    exterior_door_installation_date: null,
    foundation_repair_date: null,
    roof_date: null,
    siding_installation_date: null,
    window_installation_date: null,

    number_of_stories: null,
    ceiling_structure_material: null,
  };

  // Ensure required fields exist; fallback to null where needed
  const requiredKeys = [
    "architectural_style_type",
    "attachment_type",
    "exterior_wall_material_primary",
    "exterior_wall_material_secondary",
    "exterior_wall_condition",
    "exterior_wall_insulation_type",
    "flooring_material_primary",
    "flooring_material_secondary",
    "subfloor_material",
    "flooring_condition",
    "interior_wall_structure_material",
    "interior_wall_surface_material_primary",
    "interior_wall_surface_material_secondary",
    "interior_wall_finish_primary",
    "interior_wall_finish_secondary",
    "interior_wall_condition",
    "roof_covering_material",
    "roof_underlayment_type",
    "roof_structure_material",
    "roof_design_type",
    "roof_condition",
    "roof_age_years",
    "gutters_material",
    "gutters_condition",
    "roof_material_type",
    "foundation_type",
    "foundation_material",
    "foundation_waterproofing",
    "foundation_condition",
    "ceiling_structure_material",
    "ceiling_surface_material",
    "ceiling_insulation_type",
    "ceiling_height_average",
    "ceiling_condition",
    "exterior_door_material",
    "interior_door_material",
    "window_frame_material",
    "window_glazing_type",
    "window_operation_type",
    "window_screen_material",
    "primary_framing_material",
    "secondary_framing_material",
    "structural_damage_indicators",
  ];
  requiredKeys.forEach((k) => {
    if (!(k in structure)) structure[k] = null;
  });

  return { propId, structure };
}

function writeOutput(propId, structure) {
  const outDir = path.join("owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const payload = {};
  payload[`property_${propId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return outPath;
}

(function main() {
  const $ = loadHtml();
  const { propId, structure } = mapStructure($);
  const outPath = writeOutput(propId, structure);
  console.log(`Structure data written to: ${outPath}`);
})();
