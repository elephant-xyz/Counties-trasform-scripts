// Layout mapping script
// Reads input.html, parses with cheerio, outputs owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function extractPropertyId($) {
  const headerText = $("span.large.bold").first().text().trim();
  const m = headerText.match(/for\s+(\d{4,})/i);
  return m ? m[1] : "unknown";
}

function buildLayouts($) {
  const layouts = [];
  let layoutIndex = 1;
  
  // Parse building information from the Buildings table
  const buildingsTable = $("#Buildings");
  if (buildingsTable.length > 0) {
    buildingsTable.find("tbody tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 10) {
        const beds = parseInt($(cells[2]).text().trim()) || 0;
        const baths = parseInt($(cells[3]).text().trim()) || 0;
        const halfBaths = parseInt($(cells[4]).text().trim()) || 0;
        const yearBuilt = parseInt($(cells[5]).text().trim()) || null;
        const livingArea = parseInt($(cells[8]).text().replace(/,/g, '').trim()) || null;
        
        // Create bedroom layouts
        for (let b = 0; b < beds; b++) {
          layouts.push(createLayout("Bedroom", layoutIndex++, null, yearBuilt));
        }
        
        // Create full bathroom layouts
        for (let b = 0; b < baths; b++) {
          layouts.push(createLayout("Full Bathroom", layoutIndex++, null, yearBuilt));
        }
        
        // Create half bathroom layouts
        for (let b = 0; b < halfBaths; b++) {
          layouts.push(createLayout("Half Bathroom / Powder Room", layoutIndex++, null, yearBuilt));
        }
        
        // Add standard rooms if we have living area
        if (livingArea > 0) {
          layouts.push(createLayout("Living Room", layoutIndex++, null, yearBuilt));
          layouts.push(createLayout("Kitchen", layoutIndex++, null, yearBuilt));
        }
      }
    });
  }
  
  // Parse extra features (pool, spa, patio, etc.)
  const extraFeaturesTable = $("span.h2").filter((i, el) => 
    $(el).text().trim().includes("Extra Features")
  ).next("table");
  
  if (extraFeaturesTable.length > 0) {
    extraFeaturesTable.find("tbody tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 6) {
        const description = $(cells[2]).text().trim().toLowerCase();
        const units = parseInt($(cells[3]).text().replace(/,/g, '').trim()) || null;
        const unitType = $(cells[4]).text().trim();
        const year = parseInt($(cells[5]).text().trim()) || null;
        
        if (description.includes("pool")) {
          layouts.push(createLayout("Outdoor Pool", layoutIndex++, units, year, true));
        } else if (description.includes("spa") || description.includes("whirlpool")) {
          layouts.push(createLayout("Hot Tub / Spa Area", layoutIndex++, units, year, true));
        } else if (description.includes("patio")) {
          layouts.push(createLayout("Patio", layoutIndex++, units, year, true));
        } else if (description.includes("screened") && description.includes("enclosure")) {
          layouts.push(createLayout("Screened Porch", layoutIndex++, units, year, true));
        } else if (description.includes("screened")) {
          layouts.push(createLayout("Screened Porch", layoutIndex++, units, year, true));
        } else if (description.includes("garage")) {
          layouts.push(createLayout("Attached Garage", layoutIndex++, units, year, true));
        } else if (description.includes("carport")) {
          layouts.push(createLayout("Carport", layoutIndex++, units, year, true));
        }
      }
    });
  }
  
  return layouts;
}

function createLayout(spaceType, index, size, yearBuilt, isExterior = false) {
  return {
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: size,
    floor_level: isExterior ? null : "1st Floor",
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: spaceType !== "Attached Garage" && spaceType !== "Detached Garage" && spaceType !== "Carport",
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: spaceType === "Kitchen" ? null : null,
    cabinet_style: spaceType === "Kitchen" ? null : null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: (spaceType === "Outdoor Pool" || spaceType === "Indoor Pool" || spaceType === "Pool Area") ? null : null,
    pool_equipment: null,
    spa_type: spaceType === "Hot Tub / Spa Area" ? null : null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: isExterior,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    source_http_request: {
      method: "GET",
      url: "https://www.sc-pa.com/propertysearch"
    },
    request_identifier: null
  };
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    const propId = extractPropertyId($);
    const layouts = buildLayouts($);

    const outDir = path.resolve("owners");
    ensureDir(outDir);

    const outPath = path.join(outDir, "layout_data.json");
    const payload = {};
    payload[`property_${propId}`] = { layouts };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote layout data for property_${propId} to ${outPath}`);
  } catch (err) {
    console.error("Error in layoutMapping:", err.message);
    process.exit(1);
  }
})();
