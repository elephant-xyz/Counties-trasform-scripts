const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function parseMoney(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const num = Number(s);
  return isNaN(num)
    ? null
    : Number(Number.isInteger(num) ? num : +num.toFixed(2));
}
function getNextTextAfterStrong($, label) {
  let val = null;
  $("strong").each((i, el) => {
    const t = $(el).text().trim();
    if (val == null && t === label) {
      const row = $(el).closest(".row");
      if (row.length) {
        const labelCol = $(el).closest("div");
        const next = labelCol.next();
        if (next && next.length) {
          val = next.text().trim().replace(/\s+/g, " ");
        }
      }
    }
  });
  return val;
}
function sanitizeHttpUrl(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

function toISODate(mmddyyyy) {
  if (!mmddyyyy) return null;
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function extractLegalDescription($) {
  // Find the strong label, then take parent text minus the label
  const strong = $("strong")
    .filter((i, el) => $(el).text().trim() === "Legal Description")
    .first();
  if (strong.length) {
    const parent = strong.parent();
    if (parent && parent.length) {
      const clone = parent.clone();
      clone.find("strong").remove();
      const txt = clone
        .text()
        .trim()
        .replace(/^\s*[:\-]?\s*/, "")
        .replace(/\s+/g, " ");
      return txt || null;
    }
  }
  return null;
}

function extractPropertyValuesByYear($, year) {
  // Search within section-values for blocks containing the year
  const result = { building: null, land: null, market: null };
  $("#section-values")
    .find("*")
    .each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes(String(year))) {
        // Try labeled (mobile) pattern
        const m1 = text.match(/Improvement Value:\s*\$([0-9,]+)/i);
        const m2 = text.match(/Land Value:\s*\$([0-9,]+)/i);
        const m3 = text.match(/Just\/Market Value:\s*\$([0-9,]+)/i);
        if (m1 && m2 && m3) {
          result.building = `$${m1[1]}`;
          result.land = `$${m2[1]}`;
          result.market = `$${m3[1]}`;
          return false;
        }
        // Try unlabeled column pattern: pick first three $ amounts
        const dollars = text.match(/\$[0-9,]+/g);
        if (dollars && dollars.length >= 3) {
          // In Property Values, order is Improvement, Land, Just
          result.building = dollars[0];
          result.land = dollars[1];
          result.market = dollars[2];
          return false;
        }
      }
    });
  return result;
}

function extractWorkingTaxValues($) {
  // From Working Tax Roll Values by Taxing Authority (first ad valorem row)
  const r = { market: null, assessed: null, taxable: null };
  const rows = $("#taxAuthority .row");
  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const text = row.text();
    const dollars = text.match(/\$[0-9,]+/g);
    if (dollars && dollars.length >= 4) {
      r.market = dollars[0];
      r.assessed = dollars[1];
      // dollars[2] is Ex/10CAP
      r.taxable = dollars[3];
      break;
    }
  }
  return r;
}

/**
 * Layout payload written to the Elephant data directory.
 * Mirrors the Layout schema fields that are populated by this script.
 * @typedef {Object} LayoutPayload
 * @property {string} space_type - Semantic classification of the space (Building, Floor, Bedroom, etc.).
 * @property {number|null} space_index - Sequential index of the space within the exported layouts.
 * @property {number|null} size_square_feet - Estimated area of the space in square feet.
 * @property {number|null} total_area_sq_ft - Total enclosed area for building/floor level records.
 * @property {number|null} livable_area_sq_ft - Heated livable area for building/floor level records.
 * @property {string|null} floor_level - Textual label representing the floor level (e.g. `1st Floor`).
 * @property {boolean|null} has_windows - Whether the space contains windows.
 * @property {boolean|null} is_finished - Whether the space is finished.
 * @property {boolean|null} is_exterior - Whether the space is exterior.
 * @property {string|null} flooring_material_type - Flooring material descriptor if present.
 * @property {string|null} window_design_type - Window design descriptor if present.
 * @property {string|null} window_material_type - Window material descriptor if present.
 * @property {string|null} window_treatment_type - Window treatment descriptor if present.
 * @property {string|null} furnished - Furnishing descriptor if known.
 * @property {string|null} paint_condition - Paint condition descriptor if available.
 * @property {string|null} flooring_wear - Flooring wear descriptor if available.
 * @property {string|null} clutter_level - Clutter descriptor if available.
 * @property {string|null} visible_damage - Visible damage descriptor if available.
 * @property {string|null} countertop_material - Countertop material descriptor if present.
 * @property {string|null} cabinet_style - Cabinet style descriptor if present.
 * @property {string|null} fixture_finish_quality - Fixture quality descriptor if present.
 * @property {string|null} design_style - Design style descriptor if present.
 * @property {string|null} natural_light_quality - Natural light descriptor if present.
 * @property {string|null} decor_elements - Decor descriptor if present.
 * @property {string|null} pool_type - Pool type descriptor if applicable.
 * @property {string|null} pool_equipment - Pool equipment descriptor if applicable.
 * @property {string|null} spa_type - Spa type descriptor if applicable.
 * @property {string|null} safety_features - Safety features descriptor if applicable.
 * @property {string|null} view_type - View descriptor if present.
 * @property {string|null} lighting_features - Lighting descriptor if present.
 * @property {string|null} condition_issues - Condition issues descriptor if present.
 * @property {string|null} pool_condition - Pool condition descriptor if applicable.
 * @property {string|null} pool_surface_type - Pool surface descriptor if applicable.
 * @property {string|null} pool_water_quality - Pool water descriptor if applicable.
 */

/**
 * Classification of layout record for relationship construction.
 * @typedef {"building"|"floor"|"room"} LayoutRecordRole
 */

/**
 * Metadata describing a layout file emitted by this script.
 * @typedef {Object} LayoutRecord
 * @property {LayoutPayload} payload - The JSON payload written to disk.
 * @property {LayoutRecordRole} role - Role of the layout in the hierarchy.
 * @property {string|null} floorKey - Normalized floor key used for hierarchy grouping.
 * @property {string} fileName - Relative filename within the data directory.
 * @property {string} recordId - Unique identifier used to build layout relationship edges.
 * @property {string|null} parentId - Identifier of the parent layout record when applicable.
 */

/**
 * Identify whether a layout record represents a building-level space.
 * @param {LayoutRecord} record - Layout record to evaluate.
 * @returns {boolean} True when the record payload is a building layout.
 */
function isBuildingLayoutRecord(record) {
  if (!record || typeof record !== "object") return false;
  const payload = record.payload;
  if (!payload || typeof payload !== "object") return false;
  const type =
    typeof payload.space_type === "string" ? payload.space_type.trim() : "";
  return type.toLowerCase() === "building";
}

/**
 * Remove files whose names satisfy the provided predicate.
 * @param {string} directory - Directory that contains the relationship files.
 * @param {(fileName: string) => boolean} matcher - Predicate identifying files for removal.
 * @returns {void}
 */
function removeFilesByPredicate(directory, matcher) {
  if (!fs.existsSync(directory)) return;
  const entries = fs.readdirSync(directory, { encoding: "utf8" });
  for (const entry of entries) {
    if (matcher(entry)) {
      const target = path.join(directory, entry);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
  }
}

/** @type {Map<string, Map<string, { fileName: string, isCanonical: boolean }>>} */
const relationshipRegistry = new Map();

/**
 * Write a relationship JSON file with canonical Elephant structure while avoiding duplicate edges.
 * @param {string} directory - Directory to emit the relationship file.
 * @param {string} targetName - File name to write inside the directory.
 * @param {string} fromRef - Relative pointer to the `from` entity JSON (e.g. `./property.json`).
 * @param {string} toRef - Relative pointer to the `to` entity JSON (e.g. `./layout_1.json`).
 * @returns {void}
 */
function writeRelationshipFile(directory, targetName, fromRef, toRef) {
  const resolvedDirectory = path.resolve(directory);
  let directoryRegistry = relationshipRegistry.get(resolvedDirectory);
  if (!directoryRegistry) {
    directoryRegistry = new Map();
    relationshipRegistry.set(resolvedDirectory, directoryRegistry);
  }

  const signature = `${fromRef}->${toRef}`;
  const isCanonical = !/_\d+\.json$/.test(targetName);
  const relationshipBody = {
    from: { "/": fromRef },
    to: { "/": toRef },
  };
  const targetPath = path.join(directory, targetName);
  let existingRecord = directoryRegistry.get(signature);
  if (existingRecord) {
    const existingPath = path.join(directory, existingRecord.fileName);
    if (!fs.existsSync(existingPath)) {
      directoryRegistry.delete(signature);
      existingRecord = undefined;
    }
  }

  if (!existingRecord) {
    directoryRegistry.set(signature, { fileName: targetName, isCanonical });
    writeJSON(targetPath, relationshipBody);
    return;
  }

  if (isCanonical) {
    if (!existingRecord.isCanonical) {
      const priorPath = path.join(directory, existingRecord.fileName);
      if (fs.existsSync(priorPath)) {
        fs.unlinkSync(priorPath);
      }
    }
    directoryRegistry.set(signature, { fileName: targetName, isCanonical: true });
    writeJSON(targetPath, relationshipBody);
    return;
  }

  if (existingRecord.isCanonical) {
    return;
  }

  if (existingRecord.fileName !== targetName) {
    return;
  }

  writeJSON(targetPath, relationshipBody);
}

/**
 * Convert a numeric-like string into an integer or null when unsuitable.
 * @param {string|null|undefined} rawValue - Raw textual value that may contain digits.
 * @returns {number|null} Parsed integer or null when conversion fails.
 */
function toIntegerOrNull(rawValue) {
  if (rawValue == null) return null;
  const numericText = String(rawValue).replace(/[^0-9]/g, "");
  if (numericText.length === 0) return null;
  const parsed = Number.parseInt(numericText, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalize a floor label into a key suitable for grouping hierarchy relationships.
 * @param {string|null|undefined} floorLabel - Raw floor label (e.g. `1st Floor`).
 * @returns {string|null} Canonical key used to identify matching floors.
 */
function normalizeFloorKey(floorLabel) {
  if (floorLabel == null) return null;
  const trimmed = String(floorLabel).trim();
  if (trimmed.length === 0) return null;
  const numericMatch = trimmed.match(/(\d+)/);
  if (numericMatch) {
    return numericMatch[1];
  }
  return trimmed.toLowerCase();
}

/**
 * Determine a numeric sort key for floor ordering.
 * Floors with numeric identifiers are ordered ascending; others fall back to lexical order.
 * @param {string} floorKey - Normalized floor key generated by {@link normalizeFloorKey}.
 * @returns {number} Sort key for ordering floors.
 */
function floorSortValue(floorKey) {
  const numericMatch = floorKey.match(/^\d+$/);
  if (numericMatch) {
    return Number.parseInt(numericMatch[0], 10);
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Construct the base payload for a building-level layout entry.
 * @param {number|null} totalAreaSqFt - Total enclosed building area in square feet.
 * @param {number|null} livableAreaSqFt - Livable (heated) area in square feet.
 * @returns {LayoutPayload} Building layout payload with placeholder space index (set later).
 */
function createBuildingLayoutPayload(totalAreaSqFt, livableAreaSqFt) {
  return {
    space_type: "Building",
    space_index: null,
    size_square_feet: totalAreaSqFt,
    total_area_sq_ft: totalAreaSqFt,
    livable_area_sq_ft: livableAreaSqFt,
    floor_level: null,
    has_windows: null,
    is_finished: true,
    is_exterior: false,
    flooring_material_type: null,
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
  };
}

/**
 * Build a floor-level layout payload used when explicit floor hierarchy is available.
 * @param {string} floorLabel - Human readable floor label (e.g. `1st Floor` or `Basement`).
 * @returns {LayoutPayload} Floor layout payload with unset space index (populated later).
 */
function createFloorLayoutPayload(floorLabel) {
  return {
    space_type: "Floor",
    space_index: null,
    size_square_feet: null,
    total_area_sq_ft: null,
    livable_area_sq_ft: null,
    floor_level: floorLabel,
    has_windows: null,
    is_finished: null,
    is_exterior: null,
    flooring_material_type: null,
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
  };
}

/**
 * @typedef {"LandParcel"|"Building"|"Unit"|"ManufacturedHome"} LexiconPropertyType
 */

/**
 * @typedef {"Residential"|"Commercial"|"Industrial"|"Agricultural"|"Recreational"|"Conservation"|"Retirement"|"ResidentialCommonElementsAreas"|"DrylandCropland"|"HayMeadow"|"CroplandClass2"|"CroplandClass3"|"TimberLand"|"GrazingLand"|"OrchardGroves"|"Poultry"|"Ornamentals"|"Church"|"PrivateSchool"|"PrivateHospital"|"HomesForAged"|"NonProfitCharity"|"MortuaryCemetery"|"ClubsLodges"|"SanitariumConvalescentHome"|"CulturalOrganization"|"Military"|"ForestParkRecreation"|"PublicSchool"|"PublicHospital"|"GovernmentProperty"|"RetailStore"|"DepartmentStore"|"Supermarket"|"ShoppingCenterRegional"|"ShoppingCenterCommunity"|"OfficeBuilding"|"MedicalOffice"|"TransportationTerminal"|"Restaurant"|"FinancialInstitution"|"ServiceStation"|"AutoSalesRepair"|"MobileHomePark"|"WholesaleOutlet"|"Theater"|"Entertainment"|"Hotel"|"RaceTrack"|"GolfCourse"|"LightManufacturing"|"HeavyManufacturing"|"LumberYard"|"PackingPlant"|"Cannery"|"MineralProcessing"|"Warehouse"|"OpenStorage"|"Utility"|"RiversLakes"|"SewageDisposal"|"Railroad"|"TransitionalProperty"|"ReferenceParcel"|"NurseryGreenhouse"|"AgriculturalPackingFacility"|"LivestockFacility"|"Aquaculture"|"VineyardWinery"|"DataCenter"|"TelecommunicationsFacility"|"SolarFarm"|"WindFarm"|"NativePasture"|"ImprovedPasture"|"Rangeland"|"PastureWithTimber"|"Unknown"} LexiconPropertyUsageType
 */

/**
 * @typedef {"Condominium"|"Cooperative"|"LifeEstate"|"Timeshare"|"OtherEstate"|"FeeSimple"|"Leasehold"|"RightOfWay"|"NonWarrantableCondo"|"SubsurfaceRights"|null} LexiconOwnershipEstateType
 */

/**
 * @typedef {"SingleFamilyDetached"|"SingleFamilySemiDetached"|"TownhouseRowhouse"|"Duplex"|"Triplex"|"Quadplex"|"MultiFamily5Plus"|"ApartmentUnit"|"Loft"|"ManufacturedHomeOnLand"|"ManufacturedHomeInPark"|"MultiFamilyMoreThan10"|"MultiFamilyLessThan10"|"MobileHome"|"ManufacturedHousingMultiWide"|"ManufacturedHousing"|"ManufacturedHousingSingleWide"|"Modular"|null} LexiconStructureForm
 */

/**
 * @typedef {"VacantLand"|"Improved"|"UnderConstruction"|null} LexiconBuildStatus
 */

/**
 * @typedef {Object} PropertyUseMappingDetail
 * @property {LexiconPropertyType} propertyType
 * @property {LexiconPropertyUsageType|null} propertyUsageType
 * @property {LexiconOwnershipEstateType} ownershipEstateType
 * @property {LexiconStructureForm} structureForm
 * @property {LexiconBuildStatus} buildStatus
 * @property {readonly string[]} descriptors
 */

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePropertyUseLabel(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @type {Record<string, PropertyUseMappingDetail>} */
const PROPERTY_USE_MAPPINGS = {
  "0000": {
    descriptors: [
      "0000",
      "0000 Vacant Residential",
      "Vacant Residential",
      "Residential Vacant",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "0100": {
    descriptors: [
      "0100",
      "0100 Single Family",
      "Single Family",
      "Single-Family Residence",
      "Single Family Residence",
    ],
    propertyType: "Building",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: "SingleFamilyDetached",
    buildStatus: "Improved",
  },
  "0200": {
    descriptors: [
      "0200",
      "0200 Mobile Homes",
      "Mobile Home",
      "Mobile Homes",
      "Manufactured Home",
    ],
    propertyType: "ManufacturedHome",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: "MobileHome",
    buildStatus: "Improved",
  },
  "0300": {
    descriptors: [
      "0300",
      "0300 Multi-Family(10 or More Units)",
      "Multi-Family(10 or More Units)",
      "Multi Family 10 Or More Units",
      "MFR >10 Units",
      "MFR Greater Than 10 Units",
      "Multi Family Greater Than 10 Units",
    ],
    propertyType: "Building",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: "MultiFamilyMoreThan10",
    buildStatus: "Improved",
  },
  "0400": {
    descriptors: [
      "0400",
      "0400 Condominia",
      "Condominia",
      "Condominium",
      "Condo",
    ],
    propertyType: "Unit",
    propertyUsageType: "Residential",
    ownershipEstateType: "Condominium",
    structureForm: "ApartmentUnit",
    buildStatus: "Improved",
  },
  "0500": {
    descriptors: [
      "0500",
      "0500 Cooperatives",
      "Cooperative",
      "Cooperatives",
    ],
    propertyType: "Unit",
    propertyUsageType: "Residential",
    ownershipEstateType: "Cooperative",
    structureForm: "ApartmentUnit",
    buildStatus: "Improved",
  },
  "0600": {
    descriptors: [
      "0600",
      "0600 Retirement Homes Not Eligible",
      "Retirement Homes Not Eligible",
      "Retirement Home",
      "Retirement Facility",
    ],
    propertyType: "Building",
    propertyUsageType: "Retirement",
    ownershipEstateType: "FeeSimple",
    structureForm: "MultiFamily5Plus",
    buildStatus: "Improved",
  },
  "0700": {
    descriptors: [
      "0700",
      "0700 Miscellaneous Residential",
      "Miscellaneous Residential",
      "Misc Residential",
    ],
    propertyType: "Building",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "0800": {
    descriptors: [
      "0800",
      "0800 Multi-Family(Less than 10 Units)",
      "Multi-Family(Less than 10 Units)",
      "Multi Family Less Than 10 Units",
      "MFR <10 Units",
      "MFR Less Than 10 Units",
    ],
    propertyType: "Building",
    propertyUsageType: "Residential",
    ownershipEstateType: "FeeSimple",
    structureForm: "MultiFamilyLessThan10",
    buildStatus: "Improved",
  },
  "0900": {
    descriptors: [
      "0900",
      "0900 Residential Common Elements/Areas",
      "Residential Common Elements/Areas",
      "Residential Common Elements",
      "Res Common Elements",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "ResidentialCommonElementsAreas",
    ownershipEstateType: "Condominium",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1000": {
    descriptors: [
      "1000",
      "1000 Vacant Commercial",
      "Vacant Commercial",
      "Commercial Vacant",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Commercial",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "1100": {
    descriptors: [
      "1100",
      "1100 Stores, One Story",
      "Stores, One Story",
      "Store One Story",
      "Retail Store",
    ],
    propertyType: "Building",
    propertyUsageType: "RetailStore",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1200": {
    descriptors: [
      "1200",
      "1200 Mixed Use, Store/Office/Resi",
      "Mixed Use, Store/Office/Resi",
      "Mixed Use",
      "Mixed Use Store Office Residential",
    ],
    propertyType: "Building",
    propertyUsageType: "Commercial",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1300": {
    descriptors: [
      "1300",
      "1300 Department Store",
      "Department Store",
    ],
    propertyType: "Building",
    propertyUsageType: "DepartmentStore",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1400": {
    descriptors: [
      "1400",
      "1400 Supermarkets",
      "Supermarket",
      "Supermarkets",
    ],
    propertyType: "Building",
    propertyUsageType: "Supermarket",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1500": {
    descriptors: [
      "1500",
      "1500 Regional Shopping Centers",
      "Regional Shopping Centers",
      "Regional Shopping Center",
      "Shopping Center Regional",
    ],
    propertyType: "Building",
    propertyUsageType: "ShoppingCenterRegional",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1600": {
    descriptors: [
      "1600",
      "1600 Community Shopping Centers",
      "Community Shopping Centers",
      "Community Shopping Center",
      "Shopping Center Community",
    ],
    propertyType: "Building",
    propertyUsageType: "ShoppingCenterCommunity",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1700": {
    descriptors: [
      "1700",
      "1700 Office Buildings/Nonprof/One",
      "Office Buildings/Nonprof/One",
      "Office Building One Story",
      "Office Building",
    ],
    propertyType: "Building",
    propertyUsageType: "OfficeBuilding",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1800": {
    descriptors: [
      "1800",
      "1800 Office Buildings/Nonprof/Multi",
      "Office Buildings/Nonprof/Multi",
      "Office Building Multi Story",
    ],
    propertyType: "Building",
    propertyUsageType: "OfficeBuilding",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "1900": {
    descriptors: [
      "1900",
      "1900 Professional Office",
      "Professional Office",
      "Professional Offices",
    ],
    propertyType: "Building",
    propertyUsageType: "OfficeBuilding",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2000": {
    descriptors: [
      "2000",
      "2000 Airports, Terminals, Piers",
      "Airports, Terminals, Piers",
      "Airport",
      "Terminal",
      "Pier",
    ],
    propertyType: "Building",
    propertyUsageType: "TransportationTerminal",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2100": {
    descriptors: [
      "2100",
      "2100 Restaurants, Cafeterias",
      "Restaurants, Cafeterias",
      "Restaurant",
      "Cafeteria",
    ],
    propertyType: "Building",
    propertyUsageType: "Restaurant",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2200": {
    descriptors: [
      "2200",
      "2200 Drive In Restaurants",
      "Drive In Restaurants",
      "Drive-In Restaurant",
      "Drive Thru Restaurant",
    ],
    propertyType: "Building",
    propertyUsageType: "Restaurant",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2300": {
    descriptors: [
      "2300",
      "2300 Financial Institutions",
      "Financial Institutions",
      "Financial Institution",
      "Bank",
    ],
    propertyType: "Building",
    propertyUsageType: "FinancialInstitution",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2400": {
    descriptors: [
      "2400",
      "2400 Insurance Company Offices",
      "Insurance Company Offices",
      "Insurance Office",
    ],
    propertyType: "Building",
    propertyUsageType: "OfficeBuilding",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2500": {
    descriptors: [
      "2500",
      "2500 Repair Service Shops",
      "Repair Service Shops",
      "Repair Shop",
      "Service Shop",
    ],
    propertyType: "Building",
    propertyUsageType: "Commercial",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2600": {
    descriptors: [
      "2600",
      "2600 Service Stations",
      "Service Stations",
      "Service Station",
      "Gas Station",
    ],
    propertyType: "Building",
    propertyUsageType: "ServiceStation",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2700": {
    descriptors: [
      "2700",
      "2700 Auto Sales, Repair & Related",
      "Auto Sales, Repair & Related",
      "Auto Sales",
      "Auto Repair",
    ],
    propertyType: "Building",
    propertyUsageType: "AutoSalesRepair",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2800": {
    descriptors: [
      "2800",
      "2800 Parking Lots, Commercial, MHPs",
      "Parking Lots, Commercial, MHPs",
      "Parking Lots",
      "Commercial Parking",
      "Mobile Home Park",
      "MHP",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "MobileHomePark",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "2900": {
    descriptors: [
      "2900",
      "2900 Produce and Fishhouses Whole",
      "Produce and Fishhouses Whole",
      "Produce House",
      "Fish House",
      "Wholesale Produce",
    ],
    propertyType: "Building",
    propertyUsageType: "WholesaleOutlet",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3000": {
    descriptors: [
      "3000",
      "3000 Florists, Greenhouses",
      "Florists, Greenhouses",
      "Florist",
      "Greenhouse",
    ],
    propertyType: "Building",
    propertyUsageType: "NurseryGreenhouse",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3100": {
    descriptors: [
      "3100",
      "3100 Drive In Theatres, Open Stage",
      "Drive In Theatres, Open Stage",
      "Drive-In Theatre",
      "Open Stage",
      "Outdoor Theatre",
    ],
    propertyType: "Building",
    propertyUsageType: "Theater",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3200": {
    descriptors: [
      "3200",
      "3200 Enclosed Theatres/Auditoriums",
      "Enclosed Theatres/Auditoriums",
      "Enclosed Theatre",
      "Auditorium",
    ],
    propertyType: "Building",
    propertyUsageType: "Theater",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3300": {
    descriptors: [
      "3300",
      "3300 Night Clubs, Lounges, Bars",
      "Night Clubs, Lounges, Bars",
      "Night Club",
      "Lounge",
      "Bar",
    ],
    propertyType: "Building",
    propertyUsageType: "Entertainment",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3400": {
    descriptors: [
      "3400",
      "3400 Bowling, Skating, Pool, Arenas",
      "Bowling, Skating, Pool, Arenas",
      "Bowling Alley",
      "Skating Rink",
      "Arena",
    ],
    propertyType: "Building",
    propertyUsageType: "Entertainment",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3500": {
    descriptors: [
      "3500",
      "3500 Tourist Attraction, Exhibits",
      "Tourist Attraction, Exhibits",
      "Tourist Attraction",
      "Exhibit",
    ],
    propertyType: "Building",
    propertyUsageType: "Entertainment",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3600": {
    descriptors: [
      "3600",
      "3600 Camps",
      "Camps",
      "Campground",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Recreational",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3700": {
    descriptors: [
      "3700",
      "3700 Race Tracks, Horse/Auto/Dog",
      "Race Tracks, Horse/Auto/Dog",
      "Race Track",
      "Racetrack",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "RaceTrack",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3800": {
    descriptors: [
      "3800",
      "3800 Golf Courses, Driving Ranges",
      "Golf Courses, Driving Ranges",
      "Golf Course",
      "Driving Range",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GolfCourse",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "3900": {
    descriptors: [
      "3900",
      "3900 Hotels, Motels",
      "Hotels, Motels",
      "Hotel",
      "Motel",
    ],
    propertyType: "Building",
    propertyUsageType: "Hotel",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4000": {
    descriptors: [
      "4000",
      "4000 Vacant Industrial",
      "Vacant Industrial",
      "Industrial Vacant",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Industrial",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "4100": {
    descriptors: [
      "4100",
      "4100 Light Industrial",
      "Light Industrial",
    ],
    propertyType: "Building",
    propertyUsageType: "LightManufacturing",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4200": {
    descriptors: [
      "4200",
      "4200 Heavy Industrial",
      "Heavy Industrial",
    ],
    propertyType: "Building",
    propertyUsageType: "HeavyManufacturing",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4300": {
    descriptors: [
      "4300",
      "4300 Lumber Yd/Mill",
      "Lumber Yd/Mill",
      "Lumber Yard",
      "Lumber Mill",
    ],
    propertyType: "Building",
    propertyUsageType: "LumberYard",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4400": {
    descriptors: [
      "4400",
      "4400 Packing Fruit/Vegi/Meats",
      "Packing Fruit/Vegi/Meats",
      "Packing Plant",
      "Fruit Packing",
    ],
    propertyType: "Building",
    propertyUsageType: "PackingPlant",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4500": {
    descriptors: [
      "4500",
      "4500 Canneries Fruit/Vegi/Bottlers",
      "Canneries Fruit/Vegi/Bottlers",
      "Cannery",
      "Bottler",
    ],
    propertyType: "Building",
    propertyUsageType: "Cannery",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4600": {
    descriptors: [
      "4600",
      "4600 Other Food Processing",
      "Other Food Processing",
      "Food Processing",
    ],
    propertyType: "Building",
    propertyUsageType: "LightManufacturing",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4700": {
    descriptors: [
      "4700",
      "4700 Mineral or Phosphate Processing",
      "Mineral or Phosphate Processing",
      "Mineral Processing",
      "Phosphate Processing",
    ],
    propertyType: "Building",
    propertyUsageType: "MineralProcessing",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4800": {
    descriptors: [
      "4800",
      "4800 Warehousing, Distribution",
      "Warehousing, Distribution",
      "Warehouse",
      "Distribution Center",
    ],
    propertyType: "Building",
    propertyUsageType: "Warehouse",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "4900": {
    descriptors: [
      "4900",
      "4900 Open Storage, Supply/Junkyards",
      "Open Storage, Supply/Junkyards",
      "Open Storage",
      "Junkyard",
      "Supply Yard",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "OpenStorage",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5000": {
    descriptors: [
      "5000",
      "5000 Improved Agriculture",
      "Improved Agriculture",
      "Agriculture Improved",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Agricultural",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5100": {
    descriptors: [
      "5100",
      "5100 Cropland, Class I",
      "Cropland, Class I",
      "Cropland Class 1",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "DrylandCropland",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5200": {
    descriptors: [
      "5200",
      "5200 Cropland, Class II",
      "Cropland, Class II",
      "Cropland Class 2",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "CroplandClass2",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5300": {
    descriptors: [
      "5300",
      "5300 Cropland, Class III",
      "Cropland, Class III",
      "Cropland Class 3",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "CroplandClass3",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5400": {
    descriptors: [
      "5400",
      "5400 Timberland, Index 90+",
      "Timberland, Index 90+",
      "Timberland Index 90+",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5500": {
    descriptors: [
      "5500",
      "5500 Timberland, Index 80-89",
      "Timberland, Index 80-89",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5600": {
    descriptors: [
      "5600",
      "5600 Timberland, Index 70-79",
      "Timberland, Index 70-79",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5700": {
    descriptors: [
      "5700",
      "5700 Timberland, Index 60-69",
      "Timberland, Index 60-69",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5800": {
    descriptors: [
      "5800",
      "5800 Timberland, Index 50-59",
      "Timberland, Index 50-59",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "5900": {
    descriptors: [
      "5900",
      "5900 Timberland, Not Classed",
      "Timberland, Not Classed",
      "Timberland Not Classed",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TimberLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6000": {
    descriptors: [
      "6000",
      "6000 Grazing, Class I",
      "Grazing, Class I",
      "Grazing Class 1",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6100": {
    descriptors: [
      "6100",
      "6100 Grazing, Class II",
      "Grazing, Class II",
      "Grazing Class 2",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6200": {
    descriptors: [
      "6200",
      "6200 Grazing, Class III",
      "Grazing, Class III",
      "Grazing Class 3",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6300": {
    descriptors: [
      "6300",
      "6300 Grazing, Class IV",
      "Grazing, Class IV",
      "Grazing Class 4",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6400": {
    descriptors: [
      "6400",
      "6400 Grazing, Class V",
      "Grazing, Class V",
      "Grazing Class 5",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6500": {
    descriptors: [
      "6500",
      "6500 Grazing, Class VI",
      "Grazing, Class VI",
      "Grazing Class 6",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GrazingLand",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6600": {
    descriptors: [
      "6600",
      "6600 Orchard, Groves, Citrus",
      "Orchard, Groves, Citrus",
      "Orchard",
      "Grove",
      "Citrus Grove",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "OrchardGroves",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6700": {
    descriptors: [
      "6700",
      "6700 Poultry, Bees, Fish",
      "Poultry, Bees, Fish",
      "Poultry",
      "Bee Farm",
      "Fish Farm",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "LivestockFacility",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6800": {
    descriptors: [
      "6800",
      "6800 Dairy, Feed Lots",
      "Dairy, Feed Lots",
      "Dairy Farm",
      "Feed Lot",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "LivestockFacility",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "6900": {
    descriptors: [
      "6900",
      "6900 Ornamentals, Misc Ag",
      "Ornamentals, Misc Ag",
      "Ornamental Nursery",
      "Misc Agriculture",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Ornamentals",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7000": {
    descriptors: [
      "7000",
      "7000 Vacant Institutional",
      "Vacant Institutional",
      "Institutional Vacant",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TransitionalProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "7100": {
    descriptors: [
      "7100",
      "7100 Churches",
      "Churches",
      "Church",
    ],
    propertyType: "Building",
    propertyUsageType: "Church",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7200": {
    descriptors: [
      "7200",
      "7200 Private Schools/Colleges",
      "Private Schools/Colleges",
      "Private School",
      "Private College",
    ],
    propertyType: "Building",
    propertyUsageType: "PrivateSchool",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7300": {
    descriptors: [
      "7300",
      "7300 Privately Owned Hospitals",
      "Privately Owned Hospitals",
      "Private Hospital",
    ],
    propertyType: "Building",
    propertyUsageType: "PrivateHospital",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7400": {
    descriptors: [
      "7400",
      "7400 Homes for the Aged",
      "Homes for the Aged",
      "Home for the Aged",
    ],
    propertyType: "Building",
    propertyUsageType: "HomesForAged",
    ownershipEstateType: "FeeSimple",
    structureForm: "MultiFamily5Plus",
    buildStatus: "Improved",
  },
  "7500": {
    descriptors: [
      "7500",
      "7500 Orphanages, Other Services",
      "Orphanages, Other Services",
      "Orphanage",
      "Other Services",
    ],
    propertyType: "Building",
    propertyUsageType: "NonProfitCharity",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7600": {
    descriptors: [
      "7600",
      "7600 Mortuaries, Cemeteries",
      "Mortuaries, Cemeteries",
      "Mortuary",
      "Cemetery",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "MortuaryCemetery",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7700": {
    descriptors: [
      "7700",
      "7700 Clubs, Lodges, Union Halls",
      "Clubs, Lodges, Union Halls",
      "Club",
      "Lodge",
      "Union Hall",
    ],
    propertyType: "Building",
    propertyUsageType: "ClubsLodges",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "7800": {
    descriptors: [
      "7800",
      "7800 Sanitary, Convalescent Homes",
      "Sanitary, Convalescent Homes",
      "Convalescent Home",
      "Sanitarium",
    ],
    propertyType: "Building",
    propertyUsageType: "SanitariumConvalescentHome",
    ownershipEstateType: "FeeSimple",
    structureForm: "MultiFamily5Plus",
    buildStatus: "Improved",
  },
  "7900": {
    descriptors: [
      "7900",
      "7900 Cultural Organization Facil",
      "Cultural Organization Facil",
      "Cultural Organization Facility",
    ],
    propertyType: "Building",
    propertyUsageType: "CulturalOrganization",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8000": {
    descriptors: [
      "8000",
      "8000 Vacant Governmental",
      "Vacant Governmental",
      "Governmental Vacant",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "8100": {
    descriptors: [
      "8100",
      "8100 Military",
      "Military",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Military",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8200": {
    descriptors: [
      "8200",
      "8200 Forest, Parks, Recreation Area",
      "Forest, Parks, Recreation Area",
      "Forest",
      "Park",
      "Recreation Area",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "ForestParkRecreation",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8300": {
    descriptors: [
      "8300",
      "8300 Public County School",
      "Public County School",
      "Public School",
    ],
    propertyType: "Building",
    propertyUsageType: "PublicSchool",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8400": {
    descriptors: [
      "8400",
      "8400 Colleges",
      "Colleges",
      "College",
    ],
    propertyType: "Building",
    propertyUsageType: "PublicSchool",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8500": {
    descriptors: [
      "8500",
      "8500 Hospitals",
      "Hospitals",
      "Hospital",
    ],
    propertyType: "Building",
    propertyUsageType: "PublicHospital",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8600": {
    descriptors: [
      "8600",
      "8600 County",
      "County",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8700": {
    descriptors: [
      "8700",
      "8700 State",
      "State",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8800": {
    descriptors: [
      "8800",
      "8800 Federal",
      "Federal",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "8900": {
    descriptors: [
      "8900",
      "8900 Municipal",
      "Municipal",
      "Municipality",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9000": {
    descriptors: [
      "9000",
      "9000 Leasehold Interests, Govt Ownd",
      "Leasehold Interests, Govt Ownd",
      "Government Leasehold",
      "Leasehold Interest",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "GovernmentProperty",
    ownershipEstateType: "Leasehold",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9100": {
    descriptors: [
      "9100",
      "9100 Utilities",
      "Utilities",
      "Utility",
    ],
    propertyType: "Building",
    propertyUsageType: "Utility",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9200": {
    descriptors: [
      "9200",
      "9200 Mining, Petrolium/Gas",
      "Mining, Petrolium/Gas",
      "Mining",
      "Petroleum",
      "Gas Extraction",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "MineralProcessing",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9300": {
    descriptors: [
      "9300",
      "9300 Subsurface Rights",
      "Subsurface Rights",
      "Mineral Rights",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "ReferenceParcel",
    ownershipEstateType: "SubsurfaceRights",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "9400": {
    descriptors: [
      "9400",
      "9400 Rights-of-Way",
      "Rights-of-Way",
      "Right of Way",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "ReferenceParcel",
    ownershipEstateType: "RightOfWay",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "9500": {
    descriptors: [
      "9500",
      "9500 Rivers, Lakes, Submerged Lands",
      "Rivers, Lakes, Submerged Lands",
      "River",
      "Lake",
      "Submerged Land",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "RiversLakes",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "9600": {
    descriptors: [
      "9600",
      "9600 Waste Land, Drainage Resrvrs, Borrow Pit",
      "Waste Land, Drainage Resrvrs, Borrow Pit",
      "Waste Land",
      "Drainage Reservoir",
      "Borrow Pit",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "SewageDisposal",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
  "9700": {
    descriptors: [
      "9700",
      "9700 Outdoor Recreational",
      "Outdoor Recreational",
      "Outdoor Recreation",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Recreational",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9801": {
    descriptors: [
      "9801",
      "9801 C/A Railroad Cars",
      "C/A Railroad Cars",
      "CA Railroad Cars",
      "Railroad Cars",
    ],
    propertyType: "Unit",
    propertyUsageType: "Railroad",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9802": {
    descriptors: [
      "9802",
      "9802 C/A Railroad",
      "C/A Railroad",
      "CA Railroad",
      "Railroad",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "Railroad",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9803": {
    descriptors: [
      "9803",
      "9803 C/A TPP",
      "C/A TPP",
      "CA TPP",
      "Centrally Assessed TPP",
    ],
    propertyType: "Unit",
    propertyUsageType: "ReferenceParcel",
    ownershipEstateType: "OtherEstate",
    structureForm: null,
    buildStatus: "Improved",
  },
  "9900": {
    descriptors: [
      "9900",
      "9900 Vacant Acreage, Not Agri",
      "Vacant Acreage, Not Agri",
      "Vacant Acreage",
      "Vacant Non Agricultural",
    ],
    propertyType: "LandParcel",
    propertyUsageType: "TransitionalProperty",
    ownershipEstateType: "FeeSimple",
    structureForm: null,
    buildStatus: "VacantLand",
  },
};

/** @type {Map<string, PropertyUseMappingDetail>} */
const NORMALIZED_PROPERTY_USE_LOOKUP = new Map();
for (const detail of Object.values(PROPERTY_USE_MAPPINGS)) {
  /** @type {PropertyUseMappingDetail} */
  const mappingDetail = detail;
  for (const descriptor of mappingDetail.descriptors) {
    const normalizedDescriptor = normalizePropertyUseLabel(descriptor);
    if (
      normalizedDescriptor !== "" &&
      !NORMALIZED_PROPERTY_USE_LOOKUP.has(normalizedDescriptor)
    ) {
      NORMALIZED_PROPERTY_USE_LOOKUP.set(normalizedDescriptor, mappingDetail);
    }
  }
}

/**
 * @param {string|null|undefined} rawUse
 * @returns {PropertyUseMappingDetail|null}
 */
function mapPropertyUseToLexicon(rawUse) {
  if (!rawUse) return null;
  const codeMatch = rawUse.match(/(\d{4})/);
  if (codeMatch) {
    const mappingByCode = PROPERTY_USE_MAPPINGS[codeMatch[1]];
    if (mappingByCode) return mappingByCode;
  }
  const normalizedUse = normalizePropertyUseLabel(rawUse);
  if (normalizedUse) {
    const direct = NORMALIZED_PROPERTY_USE_LOOKUP.get(normalizedUse);
    if (direct) return direct;
    for (const [descriptorKey, detail] of NORMALIZED_PROPERTY_USE_LOOKUP.entries()) {
      if (
        normalizedUse.includes(descriptorKey) ||
        descriptorKey.includes(normalizedUse)
      ) {
        return detail;
      }
    }
  }
  return null;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const html = readText("input.html");
  const $ = cheerio.load(html);

  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners, Utilities, Layout from owners/*.json
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersData = readJSON(ownersPath);
  const utilsData = readJSON(utilsPath);
  const layoutData = readJSON(layoutPath);

  // Helper extractors from HTML
  function extractTopValue(label) {
    let out = null;
    $(".row").each((i, row) => {
      const $row = $(row);
      const strongs = $row.find("strong");
      strongs.each((j, s) => {
        if ($(s).text().trim() === label) {
          const parentCol = $(s).closest("div");
          const vcol = parentCol.next();
          if (vcol && vcol.length) {
            out = vcol.text().trim().replace(/\s+/g, " ");
          }
        }
      });
    });
    return out;
  }

  const parcelId = (
    extractTopValue("Parcel ID:") ||
    seed.parcel_id ||
    ""
  ).replace(/[^0-9]/g, "");
  const altKeyInput = $("input#altkey").attr("value");
  const altKeyFromLabel = extractTopValue("Alternate Key:");
  const altKey = (
    altKeyInput && /\d/.test(altKeyInput)
      ? altKeyInput
      : altKeyFromLabel || ""
  ).replace(/[^0-9]/g, "");

  // Address components: prefer unnormalized_address.full_address
  const fullAddr = extractTopValue("Physical Address:");
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null,
    street_pre_directional_text = null,
    street_post_directional_text = null;
  /** @type {string|null} */
  let unit_identifier = null;

  /**
   * @typedef {Object} ParsedStreetBody
   * @property {string|null} streetName
   * @property {string|null} suffix
   * @property {string|null} preDir
   * @property {string|null} postDir
   * @property {string|null} unit_identifier
   */

  /**
   * @param {string|null} streetBody
   * @returns {ParsedStreetBody}
   */
  function parseStreetBodyForComponents(streetBody) {
    if (!streetBody)
      return {
        streetName: null,
        suffix: null,
        preDir: null,
        postDir: null,
        unit_identifier: null,
      };
    const DIRS = new Set(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
    const suffixMap = {
      DR: "Dr",
      "DR.": "Dr",
      DRIVE: "Dr",
      "DRIVE.": "Dr",
      RD: "Rd",
      ROAD: "Rd",
      AVE: "Ave",
      AV: "Ave",
      AVENUE: "Ave",
      ST: "St",
      "ST.": "St",
      LN: "Ln",
      LANE: "Ln",
      BLVD: "Blvd",
      CT: "Ct",
      COURT: "Ct",
      HWY: "Hwy",
      PKWY: "Pkwy",
      PL: "Pl",
      TER: "Ter",
      TRL: "Trl",
      WAY: "Way",
      CIR: "Cir",
      PLZ: "Plz",
      SQ: "Sq",
      XING: "Xing",
      LOOP: "Loop",
      RUN: "Run",
      "RD.": "Rd",
      "AVE.": "Ave",
      "HWY.": "Hwy",
      "BLVD.": "Blvd",
    };
    const allowedSuffix = new Set([
      "Rds",
      "Blvd",
      "Lk",
      "Pike",
      "Ky",
      "Vw",
      "Curv",
      "Psge",
      "Ldg",
      "Mt",
      "Un",
      "Mdw",
      "Via",
      "Cor",
      "Kys",
      "Vl",
      "Pr",
      "Cv",
      "Isle",
      "Lgt",
      "Hbr",
      "Btm",
      "Hl",
      "Mews",
      "Hls",
      "Pnes",
      "Lgts",
      "Strm",
      "Hwy",
      "Trwy",
      "Skwy",
      "Is",
      "Est",
      "Vws",
      "Ave",
      "Exts",
      "Cvs",
      "Row",
      "Rte",
      "Fall",
      "Gtwy",
      "Wls",
      "Clb",
      "Frk",
      "Cpe",
      "Fwy",
      "Knls",
      "Rdg",
      "Jct",
      "Rst",
      "Spgs",
      "Cir",
      "Crst",
      "Expy",
      "Smt",
      "Trfy",
      "Cors",
      "Land",
      "Uns",
      "Jcts",
      "Ways",
      "Trl",
      "Way",
      "Trlr",
      "Aly",
      "Spg",
      "Pkwy",
      "Cmn",
      "Dr",
      "Grns",
      "Oval",
      "Cirs",
      "Pt",
      "Shls",
      "Vly",
      "Hts",
      "Clf",
      "Flt",
      "Mall",
      "Frds",
      "Cyn",
      "Lndg",
      "Mdws",
      "Rd",
      "Xrds",
      "Ter",
      "Prt",
      "Radl",
      "Grvs",
      "Rdgs",
      "Inlt",
      "Trak",
      "Byu",
      "Vlgs",
      "Ctr",
      "Ml",
      "Cts",
      "Arc",
      "Bnd",
      "Riv",
      "Flds",
      "Mtwy",
      "Msn",
      "Shrs",
      "Rue",
      "Crse",
      "Cres",
      "Anx",
      "Drs",
      "Sts",
      "Holw",
      "Vlg",
      "Prts",
      "Sta",
      "Fld",
      "Xrd",
      "Wall",
      "Tpke",
      "Ft",
      "Bg",
      "Knl",
      "Plz",
      "St",
      "Cswy",
      "Bgs",
      "Rnch",
      "Frks",
      "Ln",
      "Mtn",
      "Ctrs",
      "Orch",
      "Iss",
      "Brks",
      "Br",
      "Fls",
      "Trce",
      "Park",
      "Gdns",
      "Rpds",
      "Shl",
      "Lf",
      "Rpd",
      "Lcks",
      "Gln",
      "Pl",
      "Path",
      "Vis",
      "Lks",
      "Run",
      "Frg",
      "Brg",
      "Sqs",
      "Xing",
      "Pln",
      "Glns",
      "Blfs",
      "Plns",
      "Dl",
      "Clfs",
      "Ext",
      "Pass",
      "Gdn",
      "Brk",
      "Grn",
      "Mnr",
      "Cp",
      "Pne",
      "Spur",
      "Opas",
      "Upas",
      "Tunl",
      "Sq",
      "Lck",
      "Ests",
      "Shr",
      "Dm",
      "Mls",
      "Wl",
      "Mnrs",
      "Stra",
      "Frgs",
      "Frst",
      "Flts",
      "Ct",
      "Mtns",
      "Frd",
      "Nck",
      "Ramp",
      "Vlys",
      "Pts",
      "Bch",
      "Loop",
      "Byp",
      "Cmns",
      "Fry",
      "Walk",
      "Hbrs",
      "Dv",
      "Hvn",
      "Blf",
      "Grv",
      "Crk",
      null,
    ]);

    const tokens = streetBody
      .replace(/\./g, "")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return {
        streetName: null,
        suffix: null,
        preDir: null,
        postDir: null,
        unit_identifier: null,
      };
    }


    let unit_identifier = null;

    if (
      tokens.length > 0 &&
      /^[A-Z0-9\-]+$/i.test(tokens[tokens.length - 1]) &&
      !DIRS.has(tokens[tokens.length - 1].toUpperCase())
    ) {
      const lastTok = tokens[tokens.length - 1];
      const mappedSuffix =
        suffixMap[lastTok.toUpperCase()] ||
        (lastTok ? lastTok[0].toUpperCase() + lastTok.slice(1).toLowerCase() : null);

      if (!allowedSuffix.has(mappedSuffix)) {
        unit_identifier = tokens.pop();
      }
    }


    let preDir = null;
    let postDir = null;
    let suffix = null;

    // Pre-directional (first token)
    const firstTok = tokens[0].toUpperCase();
    if (DIRS.has(firstTok)) {
      preDir = firstTok;
      tokens.shift();
    }

    // Suffix (last token that matches a suffix)
    if (tokens.length > 0) {
      const lastTok = tokens[tokens.length - 1].toUpperCase();
      const mappedSuffix =
        suffixMap[lastTok] ||
        (lastTok ? lastTok[0] + lastTok.slice(1).toLowerCase() : null);
      if (mappedSuffix && allowedSuffix.has(mappedSuffix)) {
        suffix = mappedSuffix;
        tokens.pop();
      }
    }

    // Post-directional (if any remaining last token is a direction)
    if (tokens.length > 0) {
      const lastTok2 = tokens[tokens.length - 1].toUpperCase();
      if (DIRS.has(lastTok2)) {
        postDir = lastTok2;
        tokens.pop();
      }
    }

    // Remove directional tokens that are not at the start or end
    const filteredTokens = tokens.filter((tok, idx) => {
      const upperTok = tok.toUpperCase();
      const isDir = DIRS.has(upperTok);
      const isEdge = idx === 0 || idx === tokens.length - 1;
      return !(isDir && !isEdge);
    });
    const streetName = filteredTokens.join(" ").trim() || null;
    return { streetName, suffix, preDir, postDir, unit_identifier };
  }

  /**
   * @typedef {Object} CityStateZipComponents
   * @property {string|null} city - Parsed city name or null if unavailable.
   * @property {string|null} state - Two-character state code when present.
   * @property {string|null} postalCode - Five digit ZIP code if detected.
   * @property {string|null} plus4 - Optional ZIP+4 extension when supplied.
   */

  /**
   * Parse a comma-delimited address segment into city, state and postal code parts.
   *
   * @param {string} segment - Raw address text taken from the second or third comma-separated section.
   * @returns {CityStateZipComponents} Parsed city/state/ZIP components with null defaults.
   */
  const parseCityStateZipSegment = (segment) => {
    const trimmedSegment = typeof segment === "string" ? segment.trim() : "";
    if (!trimmedSegment) {
      return { city: null, state: null, postalCode: null, plus4: null };
    }

    const withStateMatch = trimmedSegment.match(
      /^([A-Z\s\-'.&]+?)\s+([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
    );
    if (withStateMatch) {
      return {
        city: withStateMatch[1].trim() || null,
        state: withStateMatch[2],
        postalCode: withStateMatch[3],
        plus4: withStateMatch[4] || null,
      };
    }

    const cityZipMatch = trimmedSegment.match(/^([A-Z\s\-'.&]+?)\s+(\d{5})(?:-(\d{4}))?$/);
    if (cityZipMatch) {
      return {
        city: cityZipMatch[1].trim() || null,
        state: null,
        postalCode: cityZipMatch[2],
        plus4: cityZipMatch[3] || null,
      };
    }

    return { city: trimmedSegment || null, state: null, postalCode: null, plus4: null };
  };

  if (fullAddr) {
    const m = fullAddr.match(
      /^(\d+)\s+(.+?)\s*,\s*([A-Z\s\-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
    );
    if (m) {
      street_number = m[1];
      const streetBody = m[2].trim();
      const parsed = parseStreetBodyForComponents(streetBody);
      street_suffix_type = parsed.suffix || null;
      street_name = parsed.streetName || null;
      street_pre_directional_text = parsed.preDir || null;
      street_post_directional_text = parsed.postDir || null;
      unit_identifier = parsed.unit_identifier || null;
      city_name = m[3].trim();
      state_code = m[4];
      postal_code = m[5];
      plus4 = m[6] || null;
    } else {
      // Fallback minimal parsing
      const segs = fullAddr.split(",").map((s) => s.trim());
      const streetPart = segs[0] || "";
      const cityPart = segs[1] || "";
      const stateZip = segs[2] || "";
      if (streetPart) {
        const p = streetPart.split(/\s+/);
        street_number = p.shift();
        const streetBody = p.join(" ");
        const parsed = parseStreetBodyForComponents(streetBody);
        street_suffix_type = parsed.suffix || null;
        street_name = parsed.streetName || null;
        street_pre_directional_text = parsed.preDir || null;
        street_post_directional_text = parsed.postDir || null;
        unit_identifier = parsed.unit_identifier || null;
      }
      const parsedCitySegment = parseCityStateZipSegment(cityPart);
      city_name = parsedCitySegment.city;
      if (parsedCitySegment.state) {
        state_code = parsedCitySegment.state;
      }
      if (parsedCitySegment.postalCode) {
        postal_code = parsedCitySegment.postalCode;
      }
      if (parsedCitySegment.plus4) {
        plus4 = parsedCitySegment.plus4;
      }
      const m2 = stateZip.match(/^([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/);
      if (m2) {
        state_code = m2[1];
        postal_code = m2[2];
        plus4 = m2[3] || plus4 || null;
      }
    }
  }

  // Lat/Long
  const lat = parseFloat($("#xcoord").attr("value")) || null; // latitude
  const lon = parseFloat($("#ycoord").attr("value")) || null; // longitude

  // Township/Range/Section & Block/Lot
  function parseTRS() {
    let trs =
      extractTopValue("Township-Range-Section:") ||
      getNextTextAfterStrong($, "Township-Range-Section:");
    if (trs) {
      const m = trs.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
      if (m) return { township: m[1], range: m[2], section: m[3] };
    }
    // fallback from Property Description panel
    let content = null;
    $("div").each((i, el) => {
      const txt = $(el).text();
      if (/Township-Range-Section/.test(txt)) {
        const m = txt.match(
          /Township-Range-Section\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/,
        );
        if (m) content = { township: m[1], range: m[2], section: m[3] };
      }
    });
    return content || { township: null, range: null, section: null };
  }
  const trs = parseTRS();

  function parseSBL() {
    const sbl = extractTopValue("Subdivision-Block-Lot:");
    if (sbl) {
      const parts = sbl.split("-").map((s) => s.trim());
      if (parts.length === 3) {
        return { subDiv: parts[0], block: parts[1], lot: parts[2] };
      }
    }
    return { subDiv: null, block: null, lot: null };
  }
  const sbl = parseSBL();

  // Subdivision name
  const subdivisionName = extractTopValue("Subdivision Name:") || null;

  // Year Built and areas
  function toInt(val) {
    if (!val) return null;
    const n = parseInt(String(val).replace(/[^0-9]/g, ""));
    return isNaN(n) ? null : n;
  }
  const yearBuilt =
    toInt(getNextTextAfterStrong($, "Year Built:")) ||
    toInt(html.match(/Year Built:\s*([0-9]{4})/)?.[1]);
  // SFLA
  const sflaTxt = getNextTextAfterStrong($, "Total SFLA:");
  const sfla = sflaTxt ? sflaTxt.replace(/,/g, "").match(/\d+/)?.[0] : null;
  // Total Building Area
  let totalArea = null;
  $("div").each((i, el) => {
    const t = $(el).text();
    if (/Total Building Area/.test(t)) {
      const m = t.match(/Total Building Area\s*([0-9,]+)/);
      if (m) {
        totalArea = m[1].replace(/,/g, "");
        return false;
      }
    }
  });

  // Legal Description
  const legalDesc = extractLegalDescription($);

  // Property Use mapping -> lexicon fields
  const propUse = extractTopValue("Property Use:");
  const propertyUseMapping = mapPropertyUseToLexicon(propUse);
  const property_type = propertyUseMapping?.propertyType ?? null;
  const property_usage_type =
    propertyUseMapping?.propertyUsageType ?? null;
  const ownership_estate_type =
    propertyUseMapping?.ownershipEstateType ?? null;
  const structure_form = propertyUseMapping?.structureForm ?? null;
  const build_status = propertyUseMapping?.buildStatus ?? null;

  function handleSFLA(sfla) {
    if (sfla == 0 || sfla == '0' || !sfla) {
      return null;
    }
    if (sfla < 10) {
      return `0${sfla} SF`;
    }
    return `${sfla} SF`;
  }
  const fixed_sfla = handleSFLA(sfla);
  // Build property.json
  const property = {
    area_under_air: fixed_sfla || null,
    livable_floor_area: fixed_sfla || null,
    number_of_units: 1,
    number_of_units_type: "One",
    parcel_identifier: parcelId,
    property_effective_built_year: null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: yearBuilt || null,
    build_status: build_status,
    ownership_estate_type: ownership_estate_type,
    property_type: property_type || null,
    property_usage_type: property_usage_type,
    structure_form: structure_form,
    subdivision: subdivisionName || null,
    total_area: totalArea ? `${totalArea} SF` : null,
    zoning: null,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Address.json
  const address = {
    block: sbl.block || null,
    city_name: city_name ? city_name.toUpperCase() : null,
    country_code: "US",
    county_name: "Volusia",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    lot: sbl.lot || null,
    municipality_name: null,
    plus_four_postal_code: plus4 || null,
    postal_code: postal_code || null,
    range: trs.range || null,
    route_number: null,
    section: trs.section || null,
    state_code: state_code || "FL",
    street_name: street_name || null,
    street_number: street_number || null,
    street_post_directional_text: street_post_directional_text || null,
    street_pre_directional_text: street_pre_directional_text || null,
    street_suffix_type: street_suffix_type || null,
    township: trs.township || null,
    unit_identifier: unit_identifier || null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // Tax: build for 2025 (Working), 2024 (Final), 2023 (Final)
  function extractPrevYearsRow(year) {
    let found = null;
    $("#previousYears .row").each((i, row) => {
      const cols = $(row).children();
      if (cols.length >= 8) {
        const y = cols.eq(0).text().trim();
        if (y === String(year)) {
          found = {
            land: cols.eq(1).text().trim(),
            impr: cols.eq(2).text().trim(),
            just: cols.eq(3).text().trim(),
            nonSchAssd: cols.eq(4).text().trim(),
            countyExempt: cols.eq(5).text().trim(),
            countyTaxable: cols.eq(6).text().trim(),
          };
        }
      }
    });
    if (!found) {
      $("#previousYears_mobile .row").each((i, row) => {
        const t = $(row).text();
        if (new RegExp(`\\b${year}\\b`).test(t)) {
          const m = t.match(/Land Value:\s*\$([0-9,]+)/);
          const mi = t.match(/Impr Value:\s*\$([0-9,]+)/);
          const mj = t.match(/Just Value:\s*\$([0-9,]+)/);
          const msa = t.match(/Non-Sch Assd:\s*\$([0-9,]+)/);
          const mct = t.match(/County Taxable:\s*\$([0-9,]+)/);
          if (m && mi && mj && msa && mct) {
            found = {
              land: `$${m[1]}`,
              impr: `$${mi[1]}`,
              just: `$${mj[1]}`,
              nonSchAssd: `$${msa[1]}`,
              countyTaxable: `$${mct[1]}`,
            };
          }
        }
      });
    }
    return found;
  }

  function writeTax(year, vals) {
    const taxObj = {
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      property_assessed_value_amount: parseMoney(vals.assessed),
      property_building_amount: parseMoney(vals.impr),
      property_land_amount: parseMoney(vals.land),
      property_market_value_amount: parseMoney(vals.market),
      property_taxable_value_amount: parseMoney(vals.taxable),
      tax_year: year,
      yearly_tax_amount: null,
    };
    writeJSON(path.join(dataDir, `tax_${year}.json`), taxObj);
  }

  // 2024
  const prev2024 = extractPrevYearsRow(2024);
  if (prev2024) {
    writeTax(2024, {
      assessed: prev2024.nonSchAssd,
      impr: prev2024.impr,
      land: prev2024.land,
      market: prev2024.just,
      taxable: prev2024.countyTaxable,
    });
  }

  // 2023
  const prev2023 = extractPrevYearsRow(2023);
  if (prev2023) {
    writeTax(2023, {
      assessed: prev2023.nonSchAssd,
      impr: prev2023.impr,
      land: prev2023.land,
      market: prev2023.just,
      taxable: prev2023.countyTaxable,
    });
  }

  // 2025 Working: combine Property Values (building/land/market) with Working Tax Roll values (assessed/taxable)
  const pv2025 = extractPropertyValuesByYear($, 2025);
  const wtv = extractWorkingTaxValues($);
  if (pv2025 && pv2025.market) {
    writeTax(2025, {
      assessed: wtv.assessed || pv2025.market,
      impr: pv2025.building,
      land: pv2025.land,
      market: pv2025.market,
      taxable: wtv.taxable || pv2025.market,
    });
  }

  // Sales and Deeds and Files
  const salesRows = [];
  $("#section-sales .row").each((i, row) => {
    const $row = $(row);
    if (
      $row.find(".col-sm-2.text-center").length &&
      $row.find(".col-sm-1.text-center").length
    ) {
      const cols = $row.children();
      const bookPage = cols.eq(0).text().trim();
      const instLinkRaw = cols.eq(1).find("a").attr("href") || null;
      const instLink = instLinkRaw ? instLinkRaw.trim() : null;
      const saleDate = cols.eq(2).text().trim();
      const deedType = cols.eq(3).text().trim();
      const priceTxt = cols.eq(6).text().trim();
      if (/\d{2}\/\d{2}\/\d{4}/.test(saleDate)) {
        salesRows.push({ bookPage, instLink, saleDate, deedType, priceTxt });
      }
    }
  });

  function mapDeedType(raw) {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes("SPECIAL WARRANTY")) return "Special Warranty Deed";
    if (r.includes("WARRANTY DEED")) return "Warranty Deed";
    if (r.includes("QUIT")) return "Quitclaim Deed";
    if (r.includes("GRANT DEED")) return "Grant Deed";
    if (r.includes("BARGAIN") && r.includes("SALE")) return "Bargain and Sale Deed";
    if (r.includes("LADY BIRD")) return "Lady Bird Deed";
    if (r.includes("TRANSFER ON DEATH")) return "Transfer on Death Deed";
    if (r.includes("SHERIFF")) return "Sheriff's Deed";
    if (r.includes("TAX DEED")) return "Tax Deed";
    if (r.includes("TRUSTEE")) return "Trustee's Deed";
    if (r.includes("PERSONAL REPRESENTATIVE")) return "Personal Representative Deed";
    if (r.includes("CORRECTION")) return "Correction Deed";
    if (r.includes("DEED IN LIEU")) return "Deed in Lieu of Foreclosure";
    if (r.includes("LIFE ESTATE")) return "Life Estate Deed";
    if (r.includes("JOINT TENANCY")) return "Joint Tenancy Deed";
    if (r.includes("TENANCY IN COMMON")) return "Tenancy in Common Deed";
    if (r.includes("COMMUNITY PROPERTY")) return "Community Property Deed";
    if (r.includes("GIFT DEED")) return "Gift Deed";
    if (r.includes("INTERSPOUSAL")) return "Interspousal Transfer Deed";
    if (r.includes("WILD DEED")) return "Wild Deed";
    if (r.includes("SPECIAL MASTER")) return "Special Master’s Deed";
    if (r.includes("COURT ORDER")) return "Court Order Deed";
    if (r.includes("CONTRACT FOR DEED")) return "Contract for Deed";
    if (r.includes("QUIET TITLE")) return "Quiet Title Deed";
    return null;
  }

  removeFilesByPredicate(dataDir, (fileName) =>
    /^relationship_sales_deed(_\d+)?\.json$/.test(fileName),
  );
  removeFilesByPredicate(dataDir, (fileName) =>
    /^relationship_deed_file(_\d+)?\.json$/.test(fileName),
  );

  salesRows.forEach((row, idx) => {
    const i = idx + 1;
    const sale = {
      ownership_transfer_date: toISODate(row.saleDate),
      purchase_price_amount: parseMoney(row.priceTxt),
    };
    writeJSON(path.join(dataDir, `sales_${i}.json`), sale);

    const deedTypeMapped = mapDeedType(row.deedType);
    const deed = {};
    if (deedTypeMapped) deed.deed_type = deedTypeMapped;
    writeJSON(path.join(dataDir, `deed_${i}.json`), deed);

    // File entry from instrument link
    let document_type = null;
    if (deedTypeMapped === "Warranty Deed") {
      document_type = "ConveyanceDeedWarrantyDeed";
    } else if (deedTypeMapped === "Quitclaim Deed") {
      document_type = "ConveyanceDeedQuitClaimDeed";
    } else {
      document_type = "ConveyanceDeed";
    }

    const nameId = row.instLink
      ? (row.instLink.split("=")[2] || `${i}`).trim()
      : `${i}`;
    const fileObj = {
      document_type: document_type,
      file_format: null,
      ipfs_url: null,
      name: `Instrument ${nameId}`,
      original_url: sanitizeHttpUrl(row.instLink),
    };
    writeJSON(path.join(dataDir, `file_${i}.json`), fileObj);

    // relationships for this triple (numbered)
    writeRelationshipFile(
      dataDir,
      `relationship_sales_deed_${i}.json`,
      `./sales_${i}.json`,
      `./deed_${i}.json`,
    );
    writeRelationshipFile(
      dataDir,
      `relationship_deed_file_${i}.json`,
      `./deed_${i}.json`,
      `./file_${i}.json`,
    );
  });

  // Structure from HTML only (limited mapping)
  const styleTxt = getNextTextAfterStrong($, "Style:") || null;
  const wallExt = getNextTextAfterStrong($, "Exterior Wall:") || "";
  const foundationTxt = getNextTextAfterStrong($, "Foundation:") || "";
  const roofCoverTxt = getNextTextAfterStrong($, "Roof Cover:") || "";
  const roofTypeTxt = getNextTextAfterStrong($, "Roof Type:") || "";

  function mapAttachmentFromStyle(style) {
    if (!style) return null;
    if (style.toUpperCase().includes("TOWNHOUSE")) return "Attached";
    return null;
  }
  function mapExteriorPrimary(s) {
    if (/CONCRETE BLOCK/i.test(s)) return "Concrete Block";
    return null;
  }
  function mapExteriorSecondary(s) {
    if (/STUCCO/i.test(s)) return "Stucco Accent";
    return null;
  }
  function mapFoundationType(s) {
    if (/SLAB/i.test(s)) return "Slab on Grade";
    return null;
  }
  function mapFoundationMaterial(s) {
    if (/CONCRETE/i.test(s)) return "Poured Concrete";
    return null;
  }
  function mapRoofDesign(s) {
    if (/HIP/i.test(s)) return "Hip";
    if (/GABLE/i.test(s)) return "Gable";
    return null;
  }
  function mapRoofCovering(s) {
    if (/ARCHITECTURAL/i.test(s)) return "Architectural Asphalt Shingle";
    if (/ASPHALT SHINGLE/i.test(s)) return "Architectural Asphalt Shingle";
    return null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: mapAttachmentFromStyle(styleTxt),
    exterior_wall_material_primary: mapExteriorPrimary(wallExt),
    exterior_wall_material_secondary: mapExteriorSecondary(wallExt),
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: mapRoofCovering(roofCoverTxt),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofTypeTxt),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: mapFoundationType(foundationTxt),
    foundation_material: mapFoundationMaterial(foundationTxt),
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utility.json from owners/utilities_data.json
  const utilsKey = `property_${seed.request_identifier || parcelId}`; // prefer altkey
  const utilsCandidate =
    utilsData[utilsKey] ||
    utilsData[`property_${parcelId}`] ||
    utilsData[`property_${seed.parcel_id}`] ||
    null;
  if (utilsCandidate) {
    writeJSON(path.join(dataDir, "utility.json"), utilsCandidate);
  }

  // Layouts from owners/layout_data.json
  /** @type {readonly string[]} */
  const layoutKeyCandidates = Array.from(
    new Set(
      [
        seed.request_identifier,
        seed.parcel_id,
        altKey,
        parcelId,
      ]
        .filter((val) => typeof val === "string" && val.length > 0)
        .map((val) => String(val)),
    ),
  );
  /** @type {{layouts?: unknown; building_layouts?: unknown}|null} */
  let layoutCandidate = null;
  for (const candidateValue of layoutKeyCandidates) {
    const candidateKey = `property_${candidateValue}`;
    if (
      Object.prototype.hasOwnProperty.call(layoutData, candidateKey) &&
      layoutData[candidateKey] &&
      typeof layoutData[candidateKey] === "object"
    ) {
      layoutCandidate = layoutData[candidateKey];
      break;
    }
  }
  const layoutArray =
    layoutCandidate &&
    "layouts" in layoutCandidate &&
    Array.isArray(layoutCandidate.layouts)
      ? layoutCandidate.layouts
      : [];
  const buildingGroupArray =
    layoutCandidate &&
    "building_layouts" in layoutCandidate &&
    Array.isArray(layoutCandidate.building_layouts)
      ? layoutCandidate.building_layouts
      : [];

  /** @type {LayoutRecord[]} */
  const layoutRecords = [];

  if (buildingGroupArray.length > 0) {
    buildingGroupArray.forEach((group, groupIdx) => {
      if (!group || typeof group !== "object") return;
      const buildingId = `building-${groupIdx + 1}`;
      /** @type {LayoutPayload} */
      const buildingPayload =
        group.building_layout && typeof group.building_layout === "object"
          ? { ...group.building_layout }
          : createBuildingLayoutPayload(
              toIntegerOrNull(totalArea),
              toIntegerOrNull(sfla),
            );
      buildingPayload.space_type = "Building";
      layoutRecords.push({
        payload: buildingPayload,
        role: "building",
        floorKey: null,
        fileName: "",
        recordId: buildingId,
        parentId: null,
      });

      if (
        group.interior_layouts &&
        Array.isArray(group.interior_layouts)
      ) {
        group.interior_layouts.forEach((layoutEntry, layoutIdx) => {
          if (!layoutEntry || typeof layoutEntry !== "object") return;
          /** @type {LayoutPayload} */
          const payload = { ...layoutEntry };
          const normalizedFloorKey =
            typeof payload.floor_level === "string"
              ? normalizeFloorKey(payload.floor_level)
              : null;
          layoutRecords.push({
            payload,
            role: "room",
            floorKey: normalizedFloorKey,
            fileName: "",
            recordId: `${buildingId}-room-${layoutIdx + 1}`,
            parentId: buildingId,
          });
        });
      }
    });
  }

  if (layoutRecords.length === 0) {
    const numericTotalArea = toIntegerOrNull(totalArea);
    const numericLivableArea = toIntegerOrNull(sfla);
    const shouldCreateBuildingLayout =
      property_type !== "LandParcel" ||
      (Array.isArray(layoutArray) && layoutArray.length > 0);

    /** @type {LayoutRecord|null} */
    let fallbackBuildingRecord = null;
    if (shouldCreateBuildingLayout) {
      fallbackBuildingRecord = {
        payload: createBuildingLayoutPayload(
          numericTotalArea,
          numericLivableArea,
        ),
        role: "building",
        floorKey: null,
        fileName: "",
        recordId: "building-1",
        parentId: null,
      };
      layoutRecords.push(fallbackBuildingRecord);
    }

    /** @type {Array<{key: string; label: string}>} */
    const detectedFloors = [];
    const seenFloorKeys = new Set();
    /** @type {Array<{payload: LayoutPayload; floorKey: string|null}>} */
    const pendingRooms = [];

    if (Array.isArray(layoutArray)) {
      layoutArray.forEach((layoutEntry) => {
        if (!layoutEntry || typeof layoutEntry !== "object") return;
        /** @type {LayoutPayload} */
        const payload = { ...layoutEntry };
        payload.space_index = null;
        const floorLevel =
          typeof payload.floor_level === "string"
            ? payload.floor_level
            : null;
        const normalizedFloorKey = normalizeFloorKey(floorLevel);
        if (normalizedFloorKey && !seenFloorKeys.has(normalizedFloorKey)) {
          seenFloorKeys.add(normalizedFloorKey);
          detectedFloors.push({
            key: normalizedFloorKey,
            label: floorLevel || normalizedFloorKey,
          });
        }
        pendingRooms.push({
          payload,
          floorKey: normalizedFloorKey,
        });
      });
    }

    /** @type {LayoutRecord[]} */
    const floorRecords = [];
    const fallbackBuildingId =
      fallbackBuildingRecord?.recordId ?? "building-1";

    if (detectedFloors.length > 1 && fallbackBuildingRecord) {
      detectedFloors
        .sort((a, b) => {
          const delta = floorSortValue(a.key) - floorSortValue(b.key);
          if (delta !== 0) return delta;
          return a.label.localeCompare(b.label);
        })
        .forEach((floorDescriptor, floorIdx) => {
          floorRecords.push({
            payload: createFloorLayoutPayload(floorDescriptor.label),
            role: "floor",
            floorKey: floorDescriptor.key,
            fileName: "",
            recordId: `${fallbackBuildingId}-floor-${floorIdx + 1}`,
            parentId: fallbackBuildingId,
          });
        });
    }

    layoutRecords.push(...floorRecords);

    const floorRecordByKey = new Map();
    floorRecords.forEach((record) => {
      if (record.floorKey) {
        floorRecordByKey.set(record.floorKey, record);
      }
    });

    let roomCounter = 1;
    pendingRooms.forEach(({ payload, floorKey }) => {
      const parentRecord =
        floorKey && floorRecordByKey.has(floorKey)
          ? floorRecordByKey.get(floorKey)
          : fallbackBuildingRecord;
      if (!parentRecord) return;
      layoutRecords.push({
        payload,
        role: "room",
        floorKey,
        fileName: "",
        recordId: `${parentRecord.recordId}-room-${roomCounter++}`,
        parentId: parentRecord.recordId,
      });
    });
  }

  removeFilesByPredicate(dataDir, (fileName) => /^layout_\d+\.json$/.test(fileName));

  let layoutFileCounter = 0;
  const layoutRecordById = new Map();
  layoutRecords.forEach((record) => {
    layoutFileCounter += 1;
    record.payload.space_index = layoutFileCounter;
    record.fileName = `layout_${layoutFileCounter}.json`;
    layoutRecordById.set(record.recordId, record);
    writeJSON(path.join(dataDir, record.fileName), record.payload);
  });

  const layoutRelationshipPrefixes = [
    /^relationship_property_layout(_\d+)?\.json$/,
    /^relationship_layout_layout(_\d+)?\.json$/,
    /^relationship_property_structure(_\d+)?\.json$/,
    /^relationship_property_utility(_\d+)?\.json$/,
    /^relationship_layout_structure(_\d+)?\.json$/,
    /^relationship_layout_utility(_\d+)?\.json$/,
  ];
  layoutRelationshipPrefixes.forEach((pattern) => {
    removeFilesByPredicate(dataDir, (fileName) => pattern.test(fileName));
  });

  const buildingRecordsWritten = layoutRecords.filter((record) =>
    isBuildingLayoutRecord(record),
  );

  const structurePath = path.join(dataDir, "structure.json");
  if (buildingRecordsWritten.length > 0) {
    buildingRecordsWritten.forEach((record, idx) => {
      const ordinal = idx + 1;
      const buildingRef = `./${record.fileName}`;
      const relationshipName = `relationship_property_layout_${ordinal}.json`;
      writeRelationshipFile(
        dataDir,
        relationshipName,
        "./property.json",
        buildingRef,
      );
    });
  }

  if (buildingRecordsWritten.length > 0 && fs.existsSync(structurePath)) {
    buildingRecordsWritten.forEach((record, idx) => {
      const ordinal = idx + 1;
      const buildingRef = `./${record.fileName}`;
      const relationshipName = `relationship_layout_structure_${ordinal}.json`;
      writeRelationshipFile(
        dataDir,
        relationshipName,
        buildingRef,
        "./structure.json",
      );
    });
  }

  const utilityPath = path.join(dataDir, "utility.json");
  if (buildingRecordsWritten.length > 0 && fs.existsSync(utilityPath)) {
    buildingRecordsWritten.forEach((record, idx) => {
      const ordinal = idx + 1;
      const buildingRef = `./${record.fileName}`;
      const relationshipName = `relationship_layout_utility_${ordinal}.json`;
      writeRelationshipFile(
        dataDir,
        relationshipName,
        buildingRef,
        "./utility.json",
      );
    });
  }

  let hierarchyCounter = 0;
  layoutRecords.forEach((record) => {
    if (!record.parentId) return;
    const parentRecord = layoutRecordById.get(record.parentId);
    if (!parentRecord) return;
    hierarchyCounter += 1;
    const relationshipName = `relationship_layout_layout_${hierarchyCounter}.json`;
    writeRelationshipFile(
      dataDir,
      relationshipName,
      `./${parentRecord.fileName}`,
      `./${record.fileName}`,
    );
  });

  const ownershipRelationshipCleanupAlways = [
    /^relationship_person_.*_property\.json$/,
    /^relationship_company_.*_property\.json$/,
    /^relationship_sales_person.*\.json$/,
    /^relationship_sales_company.*\.json$/,
    /^relationship_sales_history_person(_\d+)?\.json$/,
    /^relationship_sales_history_company(_\d+)?\.json$/,
  ];
  ownershipRelationshipCleanupAlways.forEach((pattern) => {
    removeFilesByPredicate(dataDir, (fileName) => pattern.test(fileName));
  });

  // Owners from owners/owner_data.json
  const ownersKey = `property_${seed.parcel_id}`;
  const ownerObj = ownersData[ownersKey];
  if (
    ownerObj &&
    ownerObj.owners_by_date &&
    Array.isArray(ownerObj.owners_by_date.current)
  ) {
    const currentOwners = ownerObj.owners_by_date.current;
    const name_regex = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
    for (let idx = 0; idx < currentOwners.length; idx++) {
      const o = currentOwners[idx];
      if (o.type === "person") {
        if (!name_regex.test(o.first_name) || !name_regex.test(o.last_name) || !name_regex.test(o.middle_name)) {
          continue
        }
        const person = {
          birth_date: null,
          first_name: o.first_name || null,
          last_name: o.last_name || null,
          middle_name: o.middle_name || null,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };

        writeJSON(path.join(dataDir, `person_${idx + 1}.json`), person);
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        writeJSON(path.join(dataDir, `company_${idx + 1}.json`), company);
      }
    }

    const deprecatedOwnerRelationshipPatterns = [
      /^relationship_person_.*_property\.json$/,
      /^relationship_company_.*_property\.json$/,
    ];
    deprecatedOwnerRelationshipPatterns.forEach((pattern) => {
      removeFilesByPredicate(dataDir, (fileName) => pattern.test(fileName));
    });

    const saleFilePath = path.join(dataDir, "sales_1.json");
    if (fs.existsSync(saleFilePath)) {
      const ownershipRelationshipCleanup = [
        /^relationship_sales_person.*\.json$/,
        /^relationship_sales_company.*\.json$/,
        /^relationship_sales_history_person(_\d+)?\.json$/,
        /^relationship_sales_history_company(_\d+)?\.json$/,
      ];
      ownershipRelationshipCleanup.forEach((pattern) => {
        removeFilesByPredicate(dataDir, (fileName) => pattern.test(fileName));
      });

      let personRelationshipCounter = 0;
      let companyRelationshipCounter = 0;

      currentOwners.forEach((owner, ownerIndex) => {
        if (owner.type !== "person" && owner.type !== "company") return;
        const ownerFileName =
          owner.type === "person"
            ? `person_${ownerIndex + 1}.json`
            : `company_${ownerIndex + 1}.json`;
        const ownerFilePath = path.join(dataDir, ownerFileName);
        if (!fs.existsSync(ownerFilePath)) return;

        if (owner.type === "person") {
          personRelationshipCounter += 1;
          const indexedName = `relationship_sales_history_person_${personRelationshipCounter}.json`;
          writeRelationshipFile(
            dataDir,
            indexedName,
            "./sales_1.json",
            `./${ownerFileName}`,
          );
        } else if (owner.type === "company") {
          companyRelationshipCounter += 1;
          const indexedName = `relationship_sales_history_company_${companyRelationshipCounter}.json`;
          writeRelationshipFile(
            dataDir,
            indexedName,
            "./sales_1.json",
            `./${ownerFileName}`,
          );
        }
      });
    } else {
      removeFilesByPredicate(dataDir, (fileName) =>
        /^relationship_sales_history_person(_\d+)?\.json$/.test(fileName),
      );
      removeFilesByPredicate(dataDir, (fileName) =>
        /^relationship_sales_history_company(_\d+)?\.json$/.test(fileName),
      );
    }
  }

  // Lot.json - absent data -> nulls
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // Flood storm information - absent -> nulls, boolean false
  const flood = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: null,
    flood_insurance_required: false,
    fema_search_url: null,
  };
  writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  try {
    JSON.parse(e.message);
    console.error(e.message);
  } catch {
    console.error(e.stack || String(e));
  }
  process.exit(1);
}
