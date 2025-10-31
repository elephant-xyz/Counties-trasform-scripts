// Structure mapping script
// Reads input.html, extracts structural details using cheerio, outputs owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($el) {
  if (!$el || $el.length === 0) return "";
  return $el.first().text().trim();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Parcel ID
  let parcelId = ($("#stu").attr("value") || $("#stu").val() || "").trim();
  // if (!parcelId) {
  //   // Fallback: find Parcel ID in text
  //   const parcelText =
  //     safeText($(".parcelResultFistParcel")) || safeText($(".rParcel"));
  //   parcelId = (parcelText.match(/\d{17,}/) || [null])[0] || "unknown";
  // }

  // Basic structural clues from Buildings section
  const buildingHeadings = $("h6").filter((i, el) =>
    /^(Building\s+\d+)/i.test($(el).text().trim()),
  );
  const numberOfBuildings = buildingHeadings.length || null;

  // Gather roof and wall clues
  const wallTexts = [];
  const roofTexts = [];

  // Rows with labels we saw in the HTML
  $("strong.bld_wall").each((i, el) => {
    // the value seemed to be in the next sibling span
    const val = $(el).parent().find("span").last().text().trim();
    if (val) wallTexts.push(val.toUpperCase());
  });
  $("strong.bld_roof").each((i, el) => {
    const val = $(el).parent().find("span").last().text().trim();
    if (val) roofTexts.push(val.toUpperCase());
  });

  // Additionally scan the table/value rows for explicit labels
  // $("div.row").each((i, el) => {
  //   const rowText = $(el).text().trim().toUpperCase();
  //   if (rowText.includes("EXTERIOR WALL")) {
  //     const spanVal = $(el).find("span").last().text().trim().toUpperCase();
  //     if (spanVal) wallTexts.push(spanVal);
  //   }
  //   if (rowText.includes("ROOF COVER")) {
  //     const spanVal = $(el).find("span").last().text().trim().toUpperCase();
  //     if (spanVal) roofTexts.push(spanVal);
  //   }
  // });
  // Determine exterior wall primary material
  let exterior_wall_material_primary = null;
  const wallCombined = wallTexts.join(" | ");
  if (/HARDIBOARD/.test(wallCombined)) {
    exterior_wall_material_primary = "Fiber Cement Siding";
  } else if (/BRICK/.test(wallCombined)) {
    exterior_wall_material_primary = "Brick";
  } else if (/STUCCO/.test(wallCombined)) {
    exterior_wall_material_primary = "Stucco";
  } else if (/VINYL/.test(wallCombined)) {
    exterior_wall_material_primary = "Vinyl Siding";
  } else if (/WOOD/.test(wallCombined)) {
    exterior_wall_material_primary = "Wood Siding";
  }

  // Secondary left unknown
  const exterior_wall_material_secondary = null;

  // Primary framing material (FRAME indicated)
  let primary_framing_material = null;
  if (/FRAME/.test(wallCombined)) {
    primary_framing_material = "Wood Frame";
  }

  // Roof structure material — detect wood truss if found
  let roof_structure_material = null;
  const roofCombined = roofTexts.join(" | ");
  if (/TRUSS/.test(roofCombined) || /WOOD FRAME\/TRUSS/.test(roofCombined)) {
    roof_structure_material = "Wood Truss";
  }

  // Roof design type — if GABLE/HIP present, call it Combination
  let roof_design_type = null;
  if (/GABLE/.test(roofCombined) && /HIP/.test(roofCombined)) {
    roof_design_type = "Combination";
  } else if (/GABLE/.test(roofCombined)) {
    roof_design_type = "Gable";
  } else if (/HIP/.test(roofCombined)) {
    roof_design_type = "Hip";
  }

  // Build the structure object with defaults as null
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
    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: exterior_wall_material_secondary,
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
    number_of_buildings: numberOfBuildings,
    number_of_stories: null,
    primary_framing_material: primary_framing_material,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: roof_design_type,
    roof_material_type: null,
    roof_structure_material: roof_structure_material,
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

  // Write output
  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);
  const outPath = path.join(ownersDir, "structure_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

main();
