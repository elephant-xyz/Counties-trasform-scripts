// layoutMapping.js
// Generates layout objects and hierarchy for each property, wiring building layouts
// so downstream ingestion can relate structures and utilities via layout relationships.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function ensureInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    fs.writeFileSync(
      inputPath,
      JSON.stringify({ note: "missing input.json" }, null, 2),
      "utf-8",
    );
  }
}

function loadInput() {
  ensureInput();
  try {
    return JSON.parse(fs.readFileSync(path.resolve("input.json"), "utf-8"));
  } catch (err) {
    return {};
  }
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

function parseInteger(value) {
  const num = parseNumber(value);
  if (num === null) return null;
  const int = Math.floor(num);
  return Number.isFinite(int) ? int : null;
}

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseYear(value) {
  const date = parseDate(value);
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function sanitizeLocalId(base) {
  const cleaned = String(base || "layout")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "layout";
}

function loadBuildingAreaDefinitions() {
  const definitions = new Map();
  const filePath = path.resolve(__dirname, "..", "building_areas.txt");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^code\s+/i.test(line))
      .forEach((line) => {
        const parts = line.split(/\t+/);
        if (parts.length < 2) return;
        const code = parts[0].trim().toUpperCase();
        const desc = parts[1].trim();
        if (!code || !desc) return;
        if (!definitions.has(code)) definitions.set(code, desc);
      });
  } catch (err) {
    // Missing lookup file is acceptable; fall back to overrides.
  }
  return definitions;
}

function loadDorCodeMap() {
  const targetPath = path.resolve(__dirname, "data_extractor.js");
  try {
    const source = fs.readFileSync(targetPath, "utf-8");
    const match = source.match(
      /const DOR_CODE_MAP = (\{[\s\S]*?\n\});\n\nfunction mapDorCodeToEnums/,
    );
    if (!match) return null;
    const dorMap = vm.runInNewContext(`(${match[1]})`, {});
    return dorMap && typeof dorMap === "object" ? dorMap : null;
  } catch (err) {
    return null;
  }
}

const BUILDING_AREA_DEFINITIONS = loadBuildingAreaDefinitions();
const DOR_CODE_MAP = loadDorCodeMap();

const EXTRA_FEATURE_OVERRIDES = {
  CPT: { space_type: "Carport", is_exterior: true },
  CPT2: { space_type: "Carport", is_exterior: true },
  FPL: { space_type: "Fireplace", is_exterior: false },
  FPL2: { space_type: "Fireplace", is_exterior: false },
  FPL3: { space_type: "Fireplace", is_exterior: false },
  GRNH: { space_type: "Greenhouse", is_exterior: true },
  PL: { space_type: "Pool", is_exterior: true, size_from_quantity: true },
  PL2: { space_type: "Pool", is_exterior: true, size_from_quantity: true },
  PT: { space_type: "Patio", is_exterior: true },
  PT1: { space_type: "Patio", is_exterior: true },
  PT2: { space_type: "Patio", is_exterior: true },
  SKT: { space_type: "Outdoor Kitchen", is_exterior: true },
  SKT2: { space_type: "Outdoor Kitchen", is_exterior: true },
  WLDC: { space_type: "Deck", is_exterior: true, size_from_quantity: true },
};

function mapDorCode(rawCode) {
  if (!rawCode || !DOR_CODE_MAP) return null;
  const digits = String(rawCode).replace(/[^\d]/g, "");
  if (!digits) return null;
  const attempts = [];
  for (let len = digits.length; len >= 2; len -= 1) {
    attempts.push(digits.slice(0, len));
  }
  if (!attempts.includes(digits.slice(0, 2))) {
    attempts.push(digits.slice(0, 2));
  }
  for (const key of attempts) {
    if (DOR_CODE_MAP[key]) return DOR_CODE_MAP[key];
  }
  return null;
}

function classifyProperty(input) {
  const dorCode =
    input?.parcelGeneralProfile?.dorCode ||
    input?.parcelGeneralProfile?.dorcode ||
    null;
  const dorInfo = mapDorCode(dorCode);
  const propertyType = dorInfo?.property_type || null;
  const buildStatus = dorInfo?.build_status || null;
  const isLand =
    propertyType === "LandParcel" ||
    propertyType === "VacantLand" ||
    buildStatus === "VacantLand";
  return { propertyType, buildStatus, isLand };
}

function mapBuildingAreaDescriptionToSpaceType(desc) {
  if (!desc) return null;
  const text = desc.toLowerCase();
  if (text.includes("garage")) return "Garage";
  if (text.includes("carport")) return "Carport";
  if (text.includes("porch")) return "Porch";
  if (text.includes("patio")) return "Patio";
  if (text.includes("balcony")) return "Balcony";
  if (text.includes("deck")) return "Deck";
  if (text.includes("basement")) return "Basement";
  if (text.includes("attic")) return "Attic";
  if (text.includes("office")) return "Office";
  if (text.includes("storage")) return "Storage";
  if (text.includes("shed")) return "Shed";
  if (text.includes("loft")) return "Loft";
  if (text.includes("kitchen")) return "Kitchen";
  if (text.includes("pool")) return "Pool";
  if (text.includes("spa")) return "Spa";
  if (text.includes("greenhouse")) return "Greenhouse";
  if (text.includes("screen")) return "Screen Room";
  if (text.includes("cabana")) return "Cabana";
  if (text.includes("bath")) return "Bathroom";
  if (text.includes("bed")) return "Bedroom";
  if (text.includes("living")) return "Living Area";
  const titled = desc
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return titled || "Other";
}

function inferExteriorFromDescription(desc) {
  if (!desc) return null;
  const text = desc.toLowerCase();
  if (text.includes("porch") || text.includes("patio")) return true;
  if (text.includes("deck") || text.includes("balcony")) return true;
  if (text.includes("carport") || text.includes("garage")) return true;
  if (text.includes("greenhouse")) return true;
  if (text.includes("cabana")) return true;
  if (text.includes("pool")) return true;
  return null;
}

function mapExtraFeatureToLayout(feature) {
  const rawCode = String(feature?.xfobCode || "").trim().toUpperCase();
  if (!rawCode) return null;
  const alphaCode = rawCode.replace(/[^A-Z]/g, "");

  const override =
    EXTRA_FEATURE_OVERRIDES[rawCode] || EXTRA_FEATURE_OVERRIDES[alphaCode];

  if (override) {
    const size =
      override.size_from_quantity && parseNumber(feature?.xfobQty) > 0
        ? parseNumber(feature?.xfobQty)
        : null;
    return {
      spaceType: override.space_type,
      isExterior:
        override.is_exterior === undefined ? null : override.is_exterior,
      isFinished:
        override.is_finished === undefined ? !override.is_exterior : override.is_finished,
      sizeSqFt: size,
    };
  }

  const lookupCodes = [
    rawCode,
    alphaCode,
    alphaCode.length > 3 ? alphaCode.slice(0, 3) : null,
  ].filter(Boolean);

  let description = null;
  for (const code of lookupCodes) {
    if (BUILDING_AREA_DEFINITIONS.has(code)) {
      description = BUILDING_AREA_DEFINITIONS.get(code);
      break;
    }
  }

  if (!description) return null;

  const spaceType = mapBuildingAreaDescriptionToSpaceType(description);
  const exterior = inferExteriorFromDescription(description);

  return {
    spaceType,
    isExterior: exterior === null ? null : exterior,
    isFinished: exterior === true ? false : true,
  };
}

function createLayoutFactory(layouts) {
  const usedIds = new Set();
  return function createLayout(baseId, options) {
    const sanitizedBase = sanitizeLocalId(baseId);
    let candidate = sanitizedBase;
    let counter = 2;
    while (usedIds.has(candidate)) {
      candidate = `${sanitizedBase}_${counter}`;
      counter += 1;
    }
    usedIds.add(candidate);

    const layout = {
      local_id: candidate,
      space_type: options.spaceType,
    };

    if (options.parentId) layout.parent_local_id = options.parentId;
    if (options.totalArea != null) layout.total_area_sq_ft = options.totalArea;
    if (options.livableArea != null)
      layout.livable_area_sq_ft = options.livableArea;
    if (options.sizeSqFt != null) layout.size_square_feet = options.sizeSqFt;
    layout.is_exterior =
      options.isExterior === null || options.isExterior === undefined
        ? false
        : options.isExterior;
    layout.is_finished =
      options.isFinished === null || options.isFinished === undefined
        ? !layout.is_exterior
        : options.isFinished;
    if (options.floorLevel != null) layout.floor_level = options.floorLevel;
    if (options.buildingNumber != null)
      layout.building_number = options.buildingNumber;
    if (options.builtYear != null) layout.built_year = options.builtYear;
    if (options.installationDate)
      layout.installation_date = options.installationDate;
    if (options.poolInstallationDate)
      layout.pool_installation_date = options.poolInstallationDate;
    if (options.poolType) layout.pool_type = options.poolType;
    if (options.storyType) layout.story_type = options.storyType;
    layouts.push(layout);
    return layout;
  };
}

function buildLayouts(input) {
  const { isLand } = classifyProperty(input);
  const buildingFeatures = Array.isArray(input.parcelBuildingFeatures)
    ? input.parcelBuildingFeatures.filter(Boolean)
    : [];
  const extraFeatures = Array.isArray(input.parcelExtraFeatures)
    ? input.parcelExtraFeatures.filter(Boolean)
    : [];

  const layouts = [];
  const createLayout = createLayoutFactory(layouts);

  if (isLand && buildingFeatures.length === 0) {
    return layouts;
  }

  const buildingSources =
    buildingFeatures.length > 0 ? buildingFeatures : [null];
  const buildingLayouts = [];

  buildingSources.forEach((feature, index) => {
    const buildingNumberRaw =
      feature && feature.buildingNum != null && feature.buildingNum !== ""
        ? feature.buildingNum
        : index + 1;
    const buildingNumber =
      buildingNumberRaw !== undefined && buildingNumberRaw !== null
        ? String(buildingNumberRaw).trim() || String(index + 1)
        : String(index + 1);
    const totalArea = parseNumber(feature?.grossArea);
    const livableArea = parseNumber(feature?.livingArea);
    const builtYear = parseYear(feature?.dateBuilt);

    const buildingLayout = createLayout(
      `building_${buildingNumber}`,
      {
        spaceType: "Building",
        totalArea: totalArea !== null ? totalArea : null,
        livableArea: livableArea !== null ? livableArea : null,
        sizeSqFt:
          totalArea !== null
            ? totalArea
            : livableArea !== null
            ? livableArea
            : null,
        isExterior: false,
        isFinished: true,
        buildingNumber,
        builtYear,
      },
    );

    const floorLayouts = [];
    const rawFloors = parseNumber(feature?.floors);
    const floorCount =
      rawFloors !== null && rawFloors > 0 ? Math.round(rawFloors) : 0;
    for (let floorIndex = 1; floorIndex <= floorCount; floorIndex += 1) {
      const floorLayout = createLayout(
        `${buildingLayout.local_id}_floor_${floorIndex}`,
        {
          parentId: buildingLayout.local_id,
          spaceType: "Floor",
          floorLevel: floorIndex,
          isExterior: false,
          isFinished: true,
          storyType: floorIndex === 1 ? "First" : null,
        },
      );
      floorLayouts.push(floorLayout);
    }

    const pickParentId = (sequence) => {
      if (floorLayouts.length === 0) return buildingLayout.local_id;
      const parentIndex = sequence % floorLayouts.length;
      return floorLayouts[parentIndex].local_id;
    };

    if (livableArea !== null || totalArea !== null) {
      createLayout(`${buildingLayout.local_id}_living_area`, {
        parentId: pickParentId(0),
        spaceType: "Living Area",
        livableArea: livableArea !== null ? livableArea : null,
        sizeSqFt:
          livableArea !== null
            ? livableArea
            : totalArea !== null
            ? totalArea
            : null,
        isExterior: false,
        isFinished: true,
      });
    }

    const bedroomCount = parseInteger(feature?.beds) || 0;
    for (let i = 0; i < bedroomCount; i += 1) {
      createLayout(`${buildingLayout.local_id}_bedroom_${i + 1}`, {
        parentId: pickParentId(i),
        spaceType: "Bedroom",
        isExterior: false,
        isFinished: true,
      });
    }

    const bathNumber = parseNumber(feature?.baths);
    if (bathNumber !== null) {
      const normalized = Math.round(bathNumber * 2) / 2;
      const fullBaths = Math.max(0, Math.floor(normalized));
      const hasHalfBath = normalized - fullBaths >= 0.5;
      for (let i = 0; i < fullBaths; i += 1) {
        createLayout(`${buildingLayout.local_id}_full_bath_${i + 1}`, {
          parentId: pickParentId(i),
          spaceType: "Full Bathroom",
          isExterior: false,
          isFinished: true,
        });
      }
      if (hasHalfBath) {
        createLayout(`${buildingLayout.local_id}_half_bath_1`, {
          parentId: pickParentId(fullBaths),
          spaceType: "Half Bathroom",
          isExterior: false,
          isFinished: true,
        });
      }
    }

    buildingLayouts.push(buildingLayout);
  });

  if (extraFeatures.length > 0 && buildingLayouts.length > 0) {
    const primaryBuilding = buildingLayouts[0];
    extraFeatures.forEach((feature, index) => {
      const mapped = mapExtraFeatureToLayout(feature);
      if (!mapped || !mapped.spaceType) return;
      const baseId = `${primaryBuilding.local_id}_${mapped.spaceType}_${index + 1}`;
      const installationDate = parseDate(feature?.dateBuilt);
      createLayout(baseId, {
        parentId: primaryBuilding.local_id,
        spaceType: mapped.spaceType,
        sizeSqFt:
          mapped.sizeSqFt !== undefined
            ? mapped.sizeSqFt
            : parseNumber(feature?.xfobQty) > 1
            ? parseNumber(feature?.xfobQty)
            : null,
        isExterior:
          mapped.isExterior === null ? true : mapped.isExterior,
        isFinished:
          mapped.isFinished === null
            ? !(mapped.isExterior === true)
            : mapped.isFinished,
        installationDate,
        poolType: mapped.spaceType === "Pool" ? null : undefined,
        poolInstallationDate:
          mapped.spaceType === "Pool" ? installationDate : undefined,
      });
    });
  }

  return layouts;
}

function main() {
  const input = loadInput();
  const parcelId =
    input?.parcelGeneralProfile?.parcelId ||
    input?.parcelQuickSearchSummary?.[0]?.parcelId ||
    input?.parcel_id ||
    "unknown";

  const layouts = buildLayouts(input);

  const ownersDir = path.resolve("owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });

  const outPath = path.join(ownersDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");
}

if (require.main === module) {
  main();
}
