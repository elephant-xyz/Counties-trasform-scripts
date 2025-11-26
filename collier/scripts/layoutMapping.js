// Layout mapping script
// Reads input.html, extracts room layout details, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

(function main() {
  const inputPath = "input.html";
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId = $("span#ParcelID").first().text().trim() || "unknown";

  // Extract square footage from Building/Extra Features
  // Use POSITIVE INCLUSION approach: only include known residential building types
  let totalLivableArea = 0;
  let totalUnderAir = 0;
  let hasAnyBuildings = false;

  // Positive list: These ARE residential structures that should be included
  const residentialTypes = [
    /SINGLE\s+FAMILY\s+RESIDENCE/i,
    /SINGLE\s+FAMILY/i,
    /CONDO/i,
    /CONDOMINIUM/i,
    /HOMEOWNERS/i,
    /MULTI[-\s]*FAMILY/i,
    /MOBILE\s+HOME/i,
    /MANUFACTURED\s+HOME/i,
    /DUPLEX/i,
    /TRIPLEX/i,
    /FOURPLEX/i,
    /TOWNHOUSE/i,
    /TOWNHOME/i,
    /APARTMENT/i,
    /RESIDENTIAL\s+STYLE\s+BUILDING/i,
    /RESIDENTIAL\s+BUILDING/i,
  ];

  // Find all BLDGCLASS spans and process each building
  $("span[id^=BLDGCLASS]").each((i, el) => {
    const $span = $(el);
    const buildingClass = $span.text().trim();
    const spanId = $span.attr("id");

    // Skip if no building class
    if (!buildingClass) return;

    // Extract building number from span ID (e.g., "BLDGCLASS1" -> "1", "BLDGCLASS2" -> "2")
    const buildingNumMatch = spanId.match(/BLDGCLASS(\d+)/);
    if (!buildingNumMatch) return;
    const buildingNum = buildingNumMatch[1];

    // Check if this matches any residential pattern
    const isResidential = residentialTypes.some(pattern => pattern.test(buildingClass));

    if (isResidential) {
      // This is a residential building - find corresponding BASEAREA field
      const areaSpan = $(`#BASEAREA${buildingNum}`);
      const areaText = areaSpan.text().trim();

      if (areaText) {
        const num = parseFloat(areaText.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > 0) {
          console.log(`Adding area ${num} from building ${buildingNum} (${buildingClass})`);
          totalLivableArea += num;
          totalUnderAir += num;
          hasAnyBuildings = true;
        }
      }
    }
  });

  // Only set values if we found at least one building and total >= 10 sq ft
  // (values < 10 are unrealistic and fail validation)
  const livableAreaSqFt = hasAnyBuildings && totalLivableArea >= 10 ? totalLivableArea : null;
  const areaUnderAirSqFt = hasAnyBuildings && totalUnderAir >= 10 ? totalUnderAir : null;

  // Create layouts array with Building space
  const layouts = [];

  // ALWAYS add Building layout with square footage data
  layouts.push({
    space_type: "Building",
    space_index: 1,
    space_type_index: "1",
    livable_area_sq_ft: livableAreaSqFt,
    area_under_air_sq_ft: areaUnderAirSqFt,
    total_area_sq_ft: livableAreaSqFt,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    built_year: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    request_identifier: null,
  });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join("owners", "layout_data.json");
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(
    `Wrote layout data with Building layout (${livableAreaSqFt} sq ft) for property_${parcelId} to ${outPath}`,
  );
})();
