// Layout data extractor and mapper
// Builds hierarchical layout graph for Seminole County parcels.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const VACANT_DOR_CODES = new Set([
  "00",
  "10",
  "80",
  "90",
  "93",
  "94",
  "96",
  "97",
]);

const FLOOR_LEVEL_ENUM = new Set(["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"]);

const SPACE_TYPE_ENUM = new Set([
  "Attached Garage",
  "Bedroom",
  "Building",
  "Carport",
  "Enclosed Porch",
  "Floor",
  "Full Bathroom",
  "Half Bathroom / Powder Room",
  "Kitchen",
  "Living Room",
  "Patio",
  "Porch",
  "Storage Room",
  "Utility Closet",
]);

const SPACE_TYPE_ALIAS_MAP = new Map([
  ["attached garage", "Attached Garage"],
  ["bedroom", "Bedroom"],
  ["building", "Building"],
  ["carport", "Carport"],
  ["enclosed porch", "Enclosed Porch"],
  ["floor", "Floor"],
  ["full bathroom", "Full Bathroom"],
  ["garage", "Attached Garage"],
  ["half bathroom", "Half Bathroom / Powder Room"],
  ["half bathroom / powder room", "Half Bathroom / Powder Room"],
  ["kitchen", "Kitchen"],
  ["living room", "Living Room"],
  ["patio", "Patio"],
  ["porch", "Porch"],
  ["storage room", "Storage Room"],
  ["utility closet", "Utility Closet"],
  ["utility room", "Utility Closet"],
]);

function sanitizeSpaceType(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized =
    SPACE_TYPE_ALIAS_MAP.get(raw.toLowerCase()) ?? raw;
  return SPACE_TYPE_ENUM.has(normalized) ? normalized : null;
}

function sanitizeFloorLevel(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return formatFloorLabel(value);
  const raw = String(value).trim();
  if (!raw) return null;
  if (FLOOR_LEVEL_ENUM.has(raw)) return raw;
  const upper = raw.toUpperCase();
  if (upper === "FIRST FLOOR") return "1st Floor";
  if (upper === "SECOND FLOOR") return "2nd Floor";
  if (upper === "THIRD FLOOR") return "3rd Floor";
  if (upper === "FOURTH FLOOR") return "4th Floor";
  const match = upper.match(/^(\d)(?:ST|ND|RD|TH)?\s+FLOOR$/);
  if (match) {
    const asNumber = Number(match[1]);
    return formatFloorLabel(asNumber);
  }
  return null;
}

function coerceBoolean(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

const SUBAREA_TYPE_MAP = {
  GAR: { space_type: "Attached Garage", is_exterior: false, is_finished: false },
  GAF: { space_type: "Attached Garage", is_exterior: false, is_finished: true },
  OPF: { space_type: "Porch", is_exterior: true, is_finished: false },
  EPF: { space_type: "Enclosed Porch", is_exterior: false, is_finished: true },
  FOP: { space_type: "Porch", is_exterior: true, is_finished: false },
  UTL: { space_type: "Storage Room", is_exterior: false, is_finished: true },
  UTF: { space_type: "Storage Room", is_exterior: false, is_finished: true },
  CAR: { space_type: "Carport", is_exterior: true, is_finished: false },
  PAT: { space_type: "Patio", is_exterior: true, is_finished: false },
};

function parseInput() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  const preText = $("pre").first().text().trim();
  if (!preText) throw new Error("No JSON found in <pre> tag.");
  return JSON.parse(preText);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeId(base) {
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseYearTokens(raw) {
  const str = String(raw || "").trim();
  if (!str) return { built: null, effective: null };
  const matches = str.match(/\d{4}/g);
  if (!matches) return { built: null, effective: null };
  const built = Number.parseInt(matches[0], 10);
  const effective =
    matches.length > 1 ? Number.parseInt(matches[1], 10) : null;
  return {
    built: Number.isFinite(built) ? built : null,
    effective: Number.isFinite(effective) ? effective : null,
  };
}

function formatFloorLabel(floorNumber) {
  if (!Number.isFinite(floorNumber)) return null;
  // Adjust to match schema enum values
  switch (floorNumber) {
    case 1:
      return "1st Floor";
    case 2:
      return "2nd Floor";
    case 3:
      return "3rd Floor";
    case 4:
      return "4th Floor";
    default:
      // If floorNumber is outside 1-4, return null or a generic "Floor" if schema allows
      // For now, returning null to strictly adhere to the enum
      return null;
  }
}

function inferSubareaType(description) {
  const desc = String(description || "").toUpperCase();
  if (!desc) return null;
  if (desc.includes("GARAGE"))
    return {
      space_type: "Attached Garage",
      is_exterior: false,
      is_finished: /FIN/.test(desc),
    };
  if (desc.includes("PORCH")) {
    const exterior = !desc.includes("ENCLOSED");
    return {
      space_type: exterior ? "Porch" : "Enclosed Porch",
      is_exterior: exterior,
      is_finished: desc.includes("FIN"),
    };
  }
  if (desc.includes("UTILITY"))
    return { space_type: "Storage Room", is_exterior: false, is_finished: true };
  if (desc.includes("PATIO"))
    return { space_type: "Patio", is_exterior: true, is_finished: false };
  if (desc.includes("CARPORT"))
    return { space_type: "Carport", is_exterior: true, is_finished: false };
  return null;
}

function buildFallbackBuilding(src) {
  return {
    bldgNo: 1,
    livingArea: toNumber(src.livingAreaCalc),
    grossArea: toNumber(src.grossAreaCalc),
    baseFloors: toNumber(src.baseFloors) || null,
    bedrooms: toNumber(src.bedrooms),
    bathrooms: toNumber(src.bathrooms),
    yearBlt: src.yearBuilt || null,
    bldgType: src.dorDescription || null,
    buildingSubAreas: [],
  };
}

function isLandOnly(src) {
  if (Array.isArray(src.buildingDetails) && src.buildingDetails.length > 0)
    return false;
  const dor = String(src.dor || "").padStart(2, "0");
  return VACANT_DOR_CODES.has(dor);
}

// Function to create a layout object with all required schema properties,
// setting them to null if no value is available.
function createLayoutObject(
  id,
  space_type,
  space_index,
  space_type_index,
  request_identifier,
  building_number,
  is_exterior,
  is_finished,
  overrides = {},
) {
  // Default values for all required schema properties
  const sanitizedSpaceType = sanitizeSpaceType(space_type);
  const sanitizedIsExterior = coerceBoolean(is_exterior, false);
  const sanitizedIsFinished = coerceBoolean(is_finished, false);
  if (!sanitizedSpaceType) return null;
  const baseLayout = {
    id,
    space_type: sanitizedSpaceType,
    space_index,
    space_type_index,
    request_identifier,
    building_number,
    is_exterior: sanitizedIsExterior,
    is_finished: sanitizedIsFinished,
    // Required properties from schema, initialized to null
    flooring_material_type: null,
    size_square_feet: null,
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
    // Optional properties that might be present, initialized to null
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    built_year: null,
    // effective_built_year is not in the schema, so it's removed here.
    // If it should be in the schema, add it to the schema definition.
    floor_level: null,
    flooring_installation_date: null,
    heated_area_sq_ft: null,
    installation_date: null,
    kitchen_renovation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: null,
  };

  const layout = { ...baseLayout, ...overrides };
  layout.floor_level = sanitizeFloorLevel(layout.floor_level);
  layout.is_exterior = coerceBoolean(layout.is_exterior, false);
  layout.is_finished = coerceBoolean(layout.is_finished, false);
  layout.space_type = sanitizeSpaceType(layout.space_type);
  return layout;
}

function createLayoutGraph(src) {
  const requestIdentifier =
    String(
      src.parcelNumber ||
        src.apprId ||
        src.masterId ||
        (src.parcelNumberFormatted || ""),
    ) || "unknown";

  const counters = Object.create(null);
  const nextIndex = (type) => {
    counters[type] = (counters[type] || 0) + 1;
    return counters[type];
  };

  const layouts = [];
  const relationships = [];
  const layoutStructureLinks = [];
  const layoutUtilityLinks = [];

  if (isLandOnly(src)) {
    return {
      request_identifier: requestIdentifier,
      layouts,
      layout_relationships: relationships,
      layout_structure_links: layoutStructureLinks,
      layout_utility_links: layoutUtilityLinks,
    };
  }

  const buildingRecords =
    Array.isArray(src.buildingDetails) && src.buildingDetails.length
      ? src.buildingDetails
      : [buildFallbackBuilding(src)];

  buildingRecords.forEach((bldg, index) => {
    const livingArea =
      toNumber(bldg.livingArea) ??
      toNumber(src.livingAreaCalc) ??
      toNumber(bldg.baseArea);
    const grossArea =
      toNumber(bldg.grossArea) ??
      toNumber(src.grossAreaCalc) ??
      toNumber(bldg.baseArea);
    const yearTokens = parseYearTokens(bldg.yearBlt);
    const buildingNumber =
      toNumber(bldg.bldgNo) ?? Number(index + 1) ?? Number(nextIndex("Building"));
    const buildingId = `layout_building_${normalizeId(
      buildingNumber || index + 1,
    )}`;
    const buildingSpaceIndex = nextIndex("Building");
    const buildSpaceTypeIndex = (floorIdx, spaceIdx) => {
      const parts = [String(buildingSpaceIndex)];
      if (Number.isFinite(floorIdx)) parts.push(String(floorIdx));
      if (Number.isFinite(spaceIdx)) parts.push(String(spaceIdx));
      return parts.join(".");
    };
    const floorIndexById = new Map();

    layouts.push(
      createLayoutObject(
        buildingId,
        "Building",
        buildingSpaceIndex,
        buildSpaceTypeIndex(),
        requestIdentifier,
        buildingNumber,
        false, // is_exterior
        true, // is_finished
        {
          total_area_sq_ft: grossArea,
          livable_area_sq_ft: livingArea,
          size_square_feet: grossArea,
          built_year: yearTokens.built,
          // effective_built_year: yearTokens.effective, // Removed as per schema
          floor_level: null,
        },
      ),
    );
    layoutStructureLinks.push({ layout_id: buildingId });
    layoutUtilityLinks.push({ layout_id: buildingId });

    const floorCount = Number.isFinite(toNumber(bldg.baseFloors))
      ? Number(toNumber(bldg.baseFloors))
      : null;
    const floorNodes = [];
    if (floorCount && floorCount > 0) { // Changed to > 0 to handle single floor buildings explicitly
      const perFloorArea =
        grossArea && floorCount ? Math.round(grossArea / floorCount) : null;
      for (let floor = 1; floor <= floorCount; floor += 1) {
        const floorId = `${buildingId}_floor_${floor}`;
        const floorSpaceIndex = nextIndex("Floor");
        floorIndexById.set(floorId, floorSpaceIndex);
        const floorNode = createLayoutObject(
          floorId,
          "Floor",
          floorSpaceIndex,
          buildSpaceTypeIndex(floorSpaceIndex),
          requestIdentifier,
          buildingNumber,
          false, // is_exterior
          true, // is_finished
          {
            size_square_feet: perFloorArea,
            floor_level: formatFloorLabel(floor), // Use updated formatFloorLabel
          },
        );
        layouts.push(floorNode);
        floorNodes.push(floorNode);
        relationships.push({
          type: "layout_has_layout",
          from: buildingId,
          to: floorId,
        });
      }
    }

    const defaultParentId =
      floorNodes.length > 0 ? floorNodes[0].id : buildingId;
    const defaultFloorLabel =
      floorNodes.length > 0 ? floorNodes[0].floor_level : formatFloorLabel(1); // Use updated formatFloorLabel
    const defaultParentFloorIndex =
      floorNodes.length > 0
        ? floorIndexById.get(defaultParentId) ?? null
        : null;

    const bedroomCount =
      Number.isFinite(toNumber(bldg.bedrooms))
        ? Number(toNumber(bldg.bedrooms))
        : Number(toNumber(src.bedrooms)) || 0;
    const bathroomCount =
      Number.isFinite(toNumber(bldg.bathrooms))
        ? Number(toNumber(bldg.bathrooms))
        : Number(toNumber(src.bathrooms)) || 0;

    const bedroomAreaEstimate =
      bedroomCount && livingArea
        ? Math.max(Math.round((livingArea * 0.4) / bedroomCount), 80)
        : null;

    for (let i = 1; i <= bedroomCount; i += 1) {
      const bedId = `${buildingId}_bedroom_${i}`;
      const bedSpaceIndex = nextIndex("Bedroom");
      layouts.push(
        createLayoutObject(
          bedId,
          "Bedroom",
          bedSpaceIndex,
          buildSpaceTypeIndex(defaultParentFloorIndex, bedSpaceIndex),
          requestIdentifier,
          buildingNumber,
          false, // is_exterior
          true, // is_finished
          {
            size_square_feet: bedroomAreaEstimate,
            floor_level: defaultFloorLabel,
            has_windows: true,
          },
        ),
      );
      relationships.push({
        type: "layout_has_layout",
        from: defaultParentId,
        to: bedId,
      });
    }

    const fullBathCount = Math.floor(bathroomCount);
    for (let i = 1; i <= fullBathCount; i += 1) {
      const bathId = `${buildingId}_bathroom_full_${i}`;
      const bathSpaceIndex = nextIndex("Full Bathroom");
      layouts.push(
        createLayoutObject(
          bathId,
          "Full Bathroom",
          bathSpaceIndex,
          buildSpaceTypeIndex(defaultParentFloorIndex, bathSpaceIndex),
          requestIdentifier,
          buildingNumber,
          false, // is_exterior
          true, // is_finished
          {
            floor_level: defaultFloorLabel,
          },
        ),
      );
      relationships.push({
        type: "layout_has_layout",
        from: defaultParentId,
        to: bathId,
      });
    }
    if (bathroomCount - fullBathCount >= 0.5) {
      const halfBathId = `${buildingId}_bathroom_half_${fullBathCount + 1}`;
      const halfBathSpaceIndex = nextIndex("Half Bathroom / Powder Room");
      const halfBathLayout = createLayoutObject(
        halfBathId,
        "Half Bathroom / Powder Room",
        halfBathSpaceIndex,
        buildSpaceTypeIndex(defaultParentFloorIndex, halfBathSpaceIndex),
        requestIdentifier,
        buildingNumber,
        false, // is_exterior
        true, // is_finished
        {
          floor_level: defaultFloorLabel,
        },
      );
      if (halfBathLayout) {
        layouts.push(halfBathLayout);
        relationships.push({
          type: "layout_has_layout",
          from: defaultParentId,
          to: halfBathId,
        });
      }
    }

    if (livingArea) {
      const livingId = `${buildingId}_living_room_1`;
      const livingSpaceIndex = nextIndex("Living Room");
      layouts.push(
        createLayoutObject(
          livingId,
          "Living Room",
          livingSpaceIndex,
          buildSpaceTypeIndex(defaultParentFloorIndex, livingSpaceIndex),
          requestIdentifier,
          buildingNumber,
          false, // is_exterior
          true, // is_finished
          {
            floor_level: defaultFloorLabel,
            has_windows: true,
          },
        ),
      );
      relationships.push({
        type: "layout_has_layout",
        from: defaultParentId,
        to: livingId,
      });

      const kitchenId = `${buildingId}_kitchen_1`;
      const kitchenSpaceIndex = nextIndex("Kitchen");
      layouts.push(
        createLayoutObject(
          kitchenId,
          "Kitchen",
          kitchenSpaceIndex,
          buildSpaceTypeIndex(defaultParentFloorIndex, kitchenSpaceIndex),
          requestIdentifier,
          buildingNumber,
          false, // is_exterior
          true, // is_finished
          {
            floor_level: defaultFloorLabel,
            has_windows: true,
          },
        ),
      );
      relationships.push({
        type: "layout_has_layout",
        from: defaultParentId,
        to: kitchenId,
      });
    }

    const subAreas = Array.isArray(bldg.buildingSubAreas)
      ? bldg.buildingSubAreas
      : [];
    subAreas.forEach((sub, idx) => {
      const code = String(sub.apdgCode || "").trim().toUpperCase();
      const config =
        SUBAREA_TYPE_MAP[code] || inferSubareaType(sub.areaDescription);
      const spaceTypeCandidate = config ? config.space_type : null;
      const sanitizedSpaceType = sanitizeSpaceType(spaceTypeCandidate);
      if (!sanitizedSpaceType) return;
      const layoutId = `${buildingId}_subarea_${normalizeId(
        code || idx + 1,
      )}_${idx + 1}`;
      const parentId =
        config && config.is_exterior ? buildingId : defaultParentId;
      const parentFloorIndex =
        floorIndexById.get(parentId) ??
        (parentId === defaultParentId ? defaultParentFloorIndex : null);
      const spaceIndex = nextIndex(sanitizedSpaceType);
      const subLayout = createLayoutObject(
        layoutId,
        sanitizedSpaceType,
        spaceIndex,
        buildSpaceTypeIndex(parentFloorIndex, spaceIndex),
        requestIdentifier,
        buildingNumber,
        config ? Boolean(config.is_exterior) : false,
        config && typeof config.is_finished === "boolean"
          ? config.is_finished
          : false,
        {
          size_square_feet: toNumber(sub.apdgActualArea),
          floor_level:
            config && !config.is_exterior ? defaultFloorLabel : null,
        },
      );
      if (!subLayout) return;
      layouts.push(subLayout);
      relationships.push({
        type: "layout_has_layout",
        from: parentId,
        to: layoutId,
      });
    });

    const extraFeatures = Array.isArray(src.extraFeatureDetails)
      ? src.extraFeatureDetails
      : [];
    extraFeatures
      .filter((feature) => feature && feature.exftBldg === bldg.bldgNo)
      .forEach((feature, idx) => {
        const description = String(
          feature.exFtDescription || feature.exftNotes || "",
        ).trim();
        const inferred = inferSubareaType(description);
        const spaceTypeCandidate = inferred ? inferred.space_type : null;
        const sanitizedSpaceType = sanitizeSpaceType(spaceTypeCandidate);
        if (!sanitizedSpaceType) return;
        const layoutId = `${buildingId}_feature_${normalizeId(
          description || idx + 1,
        )}_${idx + 1}`;
        const parentId =
          inferred && inferred.is_exterior ? buildingId : defaultParentId;
        const parentFloorIndex =
          floorIndexById.get(parentId) ??
          (parentId === defaultParentId ? defaultParentFloorIndex : null);
        const spaceIndex = nextIndex(sanitizedSpaceType);
        const featureLayout = createLayoutObject(
          layoutId,
          sanitizedSpaceType,
          spaceIndex,
          buildSpaceTypeIndex(parentFloorIndex, spaceIndex),
          requestIdentifier,
          buildingNumber,
          inferred ? inferred.is_exterior : true,
          inferred ? inferred.is_finished : false,
          {
            floor_level:
              inferred && !inferred.is_exterior ? defaultFloorLabel : null,
          },
        );
        if (!featureLayout) return;
        layouts.push(featureLayout);
        relationships.push({
          type: "layout_has_layout",
          from: parentId,
          to: layoutId,
        });
      });
  });

  return {
    request_identifier: requestIdentifier,
    layouts,
    layout_relationships: relationships,
    layout_structure_links: layoutStructureLinks,
    layout_utility_links: layoutUtilityLinks,
  };
}

function main() {
  const src = parseInput();
  const id = src && src.apprId ? String(src.apprId) : "unknown";
  const graph = createLayoutGraph(src);
  const outObj = {};
  outObj[`property_${id}`] = graph;

  const ownersDir = path.join(process.cwd(), "owners");
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const ownersOut = path.join(ownersDir, "layout_data.json");
  const dataOut = path.join(dataDir, "layout_data.json");
  const json = JSON.stringify(outObj, null, 2);
  fs.writeFileSync(ownersOut, json, "utf8");
  fs.writeFileSync(dataOut, json, "utf8");
  console.log("Layout mapping complete:", ownersOut);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in layoutMapping:", err.message);
    process.exit(1);
  }
}
