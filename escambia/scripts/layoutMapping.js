// Layout data extractor using Cheerio
// Reads input.html, identifies buildings and room layouts, and writes JSON to data/ and owners/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textNorm(t) {
  return (t || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function toInt(value) {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function getParcelId($) {
  let id = null;
  $("#ctl00_MasterPlaceHolder_GenCell table tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    const label = textNorm($tds.eq(0).text());
    if (/^Parcel ID:/i.test(label)) id = textNorm($tds.eq(1).text());
  });
  return id;
}

function extractBuildings($) {
  const tables = $("#ctl00_MasterPlaceHolder_tblBldgs > tbody > tr > td > table");
  const buildings = [];

  tables.each((idx, table) => {
    const $tbl = $(table);
    const headerText = textNorm($tbl.find("th").first().text());

    const improvementMatch = headerText.match(/Improvement Type:\s*([^,]+)/i);
    const yearBuiltMatch = headerText.match(/Year Built:\s*(\d{4})/i);
    const effectiveYearMatch = headerText.match(/Effective Year:\s*(\d{4})/i);
    const buildingIdMatch = headerText.match(/PA Building ID#:\s*([0-9A-Za-z]+)/i);

    const structuralElements = {};
    $tbl.find("span").each((_, span) => {
      const txt = textNorm($(span).text());
      if (/^Structural Elements$/i.test(txt)) {
        const container = $(span).parent();
        container.find("b").each((__, bold) => {
          const key = textNorm($(bold).text()).toUpperCase();
          const val = textNorm($(bold).next("i").text());
          if (key) structuralElements[key] = val || null;
        });
      }
    });

    const areas = {};
    let totalArea = null;
    const areaSpan = $tbl
      .find("span")
      .filter((_, span) => /Areas\s*-\s*\d+\s*Total\s*SF/i.test(textNorm($(span).text())))
      .first();
    if (areaSpan.length) {
      const header = textNorm(areaSpan.text());
      const totalMatch = header.match(/Areas\s*-\s*(\d+)\s*Total\s*SF/i);
      if (totalMatch) totalArea = parseInt(totalMatch[1], 10);

      const container = areaSpan.parent();
      container.find("b").each((__, bold) => {
        const key = textNorm($(bold).text()).toUpperCase();
        const val = toInt($(bold).next("i").text());
        if (key && val != null) areas[key] = val;
      });
    }

    const baseArea = areas["BASE AREA"] ?? null;
    const carportArea =
      areas["CARPORT FIN"] ??
      areas["CARPORT UNF"] ??
      areas["CARPORT"] ??
      null;
    const utilityArea =
      areas["UTILITY UNF"] ?? areas["UTILITY FIN"] ?? areas["UTILITY"] ?? null;

    buildings.push({
      index: idx + 1,
      improvementType: improvementMatch ? textNorm(improvementMatch[1]) : null,
      yearBuilt: yearBuiltMatch ? parseInt(yearBuiltMatch[1], 10) : null,
      effectiveYear: effectiveYearMatch ? parseInt(effectiveYearMatch[1], 10) : null,
      buildingId: buildingIdMatch ? textNorm(buildingIdMatch[1]) : null,
      structuralElements,
      areas,
      totalArea: totalArea != null ? totalArea : null,
      baseArea: baseArea != null ? baseArea : null,
      carportArea: carportArea != null ? carportArea : null,
      utilityArea: utilityArea != null ? utilityArea : null,
      dwellingUnits: toInt(structuralElements["DWELLING UNITS"]),
      numberOfStories: toInt(structuralElements["NO. STORIES"]),
    });
  });

  return buildings;
}

function defaultLayout(space_type, index, overrides = {}) {
  return {
    space_type,
    space_index: index,
    space_type_index: null,
    flooring_material_type: null, // Required by schema, but often not in HTML
    size_square_feet: null,
    floor_level: null,
    has_windows: null, // Required by schema
    window_design_type: null, // Required by schema
    window_material_type: null, // Required by schema
    window_treatment_type: null, // Required by schema
    is_finished: true, // Required by schema
    furnished: null, // Required by schema
    paint_condition: null, // Required by schema
    flooring_wear: null, // Required by schema
    clutter_level: null, // Required by schema
    visible_damage: null, // Required by schema
    countertop_material: null, // Required by schema
    cabinet_style: null, // Required by schema
    fixture_finish_quality: null, // Required by schema
    design_style: null, // Required by schema
    natural_light_quality: null, // Required by schema
    decor_elements: null, // Required by schema
    pool_type: null, // Required by schema
    pool_equipment: null, // Required by schema
    spa_type: null, // Required by schema
    safety_features: null, // Required by schema
    view_type: null, // Required by schema
    lighting_features: null, // Required by schema
    condition_issues: null, // Required by schema
    is_exterior: false, // Required by schema
    pool_condition: null, // Required by schema
    pool_surface_type: null, // Required by schema
    pool_water_quality: null, // Required by schema
    // Add other required fields from schema with null or default values
    request_identifier: null, // Required by schema
    source_http_request: null, // Required by schema
    ...overrides,
  };
}

// --- START SCHEMA COMPATIBILITY CHANGES ---

// 1. Define the exact enum values from your schema
const VALID_SPACE_TYPES_ENUM = new Set([
  "Building", "Living Room", "Family Room", "Great Room", "Dining Room", "Office Room",
  "Conference Room", "Class Room", "Plant Floor", "Kitchen", "Breakfast Nook", "Pantry",
  "Primary Bedroom", "Secondary Bedroom", "Guest Bedroom", "Children’s Bedroom", "Nursery",
  "Full Bathroom", "Three-Quarter Bathroom", "Half Bathroom / Powder Room", "En-Suite Bathroom",
  "Jack-and-Jill Bathroom", "Primary Bathroom", "Laundry Room", "Mudroom", "Closet", "Bedroom",
  "Walk-in Closet", "Mechanical Room", "Storage Room", "Server/IT Closet", "Home Office",
  "Library", "Den", "Study", "Media Room / Home Theater", "Game Room", "Home Gym", "Music Room",
  "Craft Room / Hobby Room", "Prayer Room / Meditation Room", "Safe Room / Panic Room",
  "Wine Cellar", "Bar Area", "Greenhouse", "Attached Garage", "Detached Garage", "Carport",
  "Workshop", "Storage Loft", "Porch", "Screened Porch", "Sunroom", "Deck", "Patio", "Pergola",
  "Balcony", "Terrace", "Gazebo", "Pool House", "Outdoor Kitchen", "Lobby / Entry Hall",
  "Common Room", "Utility Closet", "Elevator Lobby", "Mail Room", "Janitor’s Closet",
  "Pool Area", "Indoor Pool", "Outdoor Pool", "Hot Tub / Spa Area", "Shed", "Lanai",
  "Open Porch", "Enclosed Porch", "Attic", "Enclosed Cabana", "Carport", "Attached Carport",
  "Detached Carport", "Detached Utility Closet", "Jacuzzi", "Courtyard", "Open Courtyard",
  "Screen Porch (1-Story)", "Screen Enclosure (2-Story)", "Screen Enclosure (3-Story)",
  "Screen Enclosure (Custom)", "Lower Garage", "Lower Screened Porch", "Screened Porch",
  "Stoop", "First Floor", "Second Floor", "Third Floor", "Fourth Floor", "Floor", "Basement",
  "Sub-Basement", "Living Area"
]);

// 2. Map HTML area keys to the *exact* enum values
const areaKeyToSpaceTypeMap = {
  "BASE AREA": "Living Area",
  "CARPORT FIN": "Carport", // Assuming "Carport" covers both finished/unfinished for schema
  "CARPORT UNF": "Carport",
  "CARPORT": "Carport",
  "UTILITY UNF": "Utility Closet", // Mapping to "Utility Closet"
  "UTILITY FIN": "Utility Closet",
  "UTILITY": "Utility Closet",
  "PORCH FIN": "Porch", // Assuming "Porch" covers finished/unfinished for schema
  "PORCH UNF": "Porch",
  "PORCH": "Porch",
  "DECK": "Deck",
  "PATIO": "Patio",
  "GARAGE": "Attached Garage", // Or "Detached Garage" if context allows, defaulting to Attached
  "STORAGE": "Storage Room",
  "ATTIC": "Attic",
  "BASEMENT": "Basement",
  "BALCONY": "Balcony",
  "SCREENED PORCH": "Screened Porch",
  "ENCLOSED PORCH": "Enclosed Porch",
  "LANAI": "Lanai",
  "SHED": "Shed",
  "POOL": "Pool Area", // If "POOL" appears as an area key
  "SPA": "Hot Tub / Spa Area", // If "SPA" appears as an area key
  // Add more mappings as needed, ensuring the value is in VALID_SPACE_TYPES_ENUM
};

// 3. Refine getSpaceTypeFromAreaKey to ensure schema compatibility
function getSpaceTypeFromAreaKey(key) {
  const normalizedKey = key.toUpperCase().trim();

  // 1. Check direct map
  if (areaKeyToSpaceTypeMap[normalizedKey]) {
    return areaKeyToSpaceTypeMap[normalizedKey];
  }

  // 2. Try to normalize and match against enum
  // Convert "FOO_BAR" to "Foo Bar"
  const titleCaseKey = normalizedKey
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (VALID_SPACE_TYPES_ENUM.has(titleCaseKey)) {
    return titleCaseKey;
  }

  // 3. Handle specific common cases that might not be direct matches but are in enum
  if (normalizedKey.includes("BEDROOM") && VALID_SPACE_TYPES_ENUM.has("Bedroom")) {
    return "Bedroom";
  }
  if (normalizedKey.includes("BATH") && VALID_SPACE_TYPES_ENUM.has("Full Bathroom")) { // Default to Full Bathroom
    return "Full Bathroom";
  }
  if (normalizedKey.includes("KITCHEN") && VALID_SPACE_TYPES_ENUM.has("Kitchen")) {
    return "Kitchen";
  }
  if (normalizedKey.includes("LIVING") && VALID_SPACE_TYPES_ENUM.has("Living Area")) {
    return "Living Area";
  }
  if (normalizedKey.includes("DINING") && VALID_SPACE_TYPES_ENUM.has("Dining Room")) {
    return "Dining Room";
  }
  if (normalizedKey.includes("OFFICE") && VALID_SPACE_TYPES_ENUM.has("Home Office")) {
    return "Home Office";
  }
  if (normalizedKey.includes("FLOOR") && VALID_SPACE_TYPES_ENUM.has("Floor")) {
    return "Floor"; // Generic floor type
  }


  // 4. If still not found, default to a generic type from the enum or null
  console.warn(`Warning: Area key "${key}" could not be mapped to a valid space_type enum. Defaulting to "Storage Room".`);
  return "Storage Room"; // Or "Utility Closet", or "null" if you prefer to omit
}

// --- END SCHEMA COMPATIBILITY CHANGES ---


function main() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");

  const buildings = extractBuildings($);
  const layouts = [];
  const relationships = [];

  let layoutIdx = 1;
  const buildingLayoutIndices = [];

  if (buildings.length > 0) {
    buildings.forEach((building) => {
      const buildingLayoutIndex = layoutIdx++;
      buildingLayoutIndices.push(buildingLayoutIndex);

      const typeCounters = {};

      const buildingLayout = defaultLayout("Building", buildingLayoutIndex, {
        space_type_index: String(building.index),
        floor_level: null,
        is_finished: true,
        size_square_feet: building.totalArea ?? null,
        total_area_sq_ft: building.totalArea ?? null,
        livable_area_sq_ft: building.baseArea ?? null,
        building_number: building.index,
        // Required fields from schema, set to null or default if not derivable
        flooring_material_type: null,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
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
        pool_type: null,
        pool_equipment: null,
        spa_type: null,
        safety_features: null,
        view_type: null,
        lighting_features: null,
        condition_issues: null,
        pool_condition: null,
        pool_surface_type: null,
        pool_water_quality: null,
        request_identifier: parcelId, // Use parcelId as a simple identifier
        source_http_request: null, // No source HTTP request for the building itself
      });
      layouts.push(buildingLayout);

      const getIndexForType = (spaceType) => {
        typeCounters[spaceType] = (typeCounters[spaceType] || 0) + 1;
        return `${building.index}.${typeCounters[spaceType]}`;
      };

      for (const areaKey in building.areas) {
        const areaSize = building.areas[areaKey];
        if (areaSize != null && areaSize > 0) {
          const spaceType = getSpaceTypeFromAreaKey(areaKey);
          const idx = layoutIdx++;
          const childLayout = defaultLayout(spaceType, idx, {
            size_square_feet: areaSize,
            is_exterior: areaKey.includes("CARPORT") || areaKey.includes("PORCH") || areaKey.includes("DECK") || areaKey.includes("PATIO") || areaKey.includes("BALCONY"),
            is_finished: !(areaKey.includes("UNF") || areaKey.includes("STORAGE") || areaKey.includes("ATTIC") || areaKey.includes("BASEMENT")),
            // Set required fields to null or default if not derivable from HTML
            flooring_material_type: null,
            has_windows: null, // Cannot infer from area key alone
            window_design_type: null,
            window_material_type: null,
            window_treatment_type: null,
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
            pool_type: null,
            pool_equipment: null,
            spa_type: null,
            safety_features: null,
            view_type: null,
            lighting_features: null,
            condition_issues: null,
            pool_condition: null,
            pool_surface_type: null,
            pool_water_quality: null,
            request_identifier: parcelId,
            source_http_request: null,
          });
          childLayout.space_type_index = getIndexForType(spaceType);
          layouts.push(childLayout);
          relationships.push({
            parent: buildingLayoutIndex,
            child: idx,
          });
        }
      }
    });
  }

  const propertyKey = `property_${parcelId}`;
  const output = {};
  output[propertyKey] = {
    layouts,
    layout_relationships: relationships,
    building_layout_indices: buildingLayoutIndices,
  };

  ensureDir(path.resolve("data"));
  ensureDir(path.resolve("owners"));

  const outDataPath = path.resolve("data/layout_data.json");
  const outOwnersPath = path.resolve("owners/layout_data.json");

  // fs.writeFileSync(outDataPath, JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(outOwnersPath, JSON.stringify(output, null, 2), "utf8");

  console.log("Layout mapping complete:", outDataPath, outOwnersPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error in layoutMapping:", e.message);
    process.exit(1);
  }
}