// layoutMapping.js
// Reads input.json, extracts layout data, and writes to data/layout_data.json and owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const spaceTypeMapping = {
  "OPF": ["Open Porch", true],
  "OPU": ["Open Porch", false],
  "SPF": ["Screened Porch", true],
  "SPU": ["Screened Porch", false],
  "GRF": ["Attached Garage", true],
  "GRU": ["Attached Garage", false],
  "ATF": ["Attic", true],
  "ATU": ["Attic", false],
  "BMF": ["Basement", true],
  "BMU": ["Basement", false],
  "CPF": ["Carport", true],
  "CPU": ["Carport", false],
  "DCF": ["Detached Carport", true],
  "DCU": ["Detached Carport", false],
  "DGF": ["Detached Garage", true],
  "DGU": ["Detached Garage", false],
  "DSF": ["Screened Porch", true],
  "DSU": ["Screened Porch", false],
  "EPF": ["Enclosed Porch", true],
  "EPU": ["Enclosed Porch", false],
  "LFA": ["Storage Loft", true],
  "LFF": ["Storage Loft", true],
  "LFG": ["Storage Loft", true],
  "MCF": ["Carport", true],
  "MCU": ["Carport", false],
  "MPF": ["Porch", true],
  "MPU": ["Porch", false],
  "MSF": ["Screened Porch", true],
  "MSU": ["Screened Porch", false],
  "OFA": ["Office Room", true],
  "OFF": ["Office Room", true],
  "OFG": ["Office Room", true],
  "OFL": ["Office Room", true],
  "OFM": ["Office Room", true],
  "SSA": ["Storage Room", true],
  "SSM": ["Storage Room", true],
  "SSU": ["Storage Room", false],
  "STA": ["Storage Room", true],
  "VPF": ["Porch", true],
  "VPU": ["Porch", false],
};

class MultiCounter {
  constructor() {
    // Use a Map to store counts for different keys.
    // Map keys can be any data type (strings, numbers, objects).
    this.counts = new Map();
  }

  /**
   * Increments the count for a given key.
   * If the key doesn't exist, it initializes its count to 0 before incrementing.
   * @param {any} key - The key whose count should be incremented.
   * @param {number} [step=1] - The amount to increment by.
   */
  increment(key, step = 1) {
    if (typeof step !== 'number' || step <= 0) {
      throw new Error("Increment step must be a positive number.");
    }
    const currentCount = this.counts.get(key) || 0;
    this.counts.set(key, currentCount + step);
  }

  /**
   * Decrements the count for a given key.
   * If the key doesn't exist, it initializes its count to 0 before decrementing.
   * @param {any} key - The key whose count should be decremented.
   * @param {number} [step=1] - The amount to decrement by.
   */
  decrement(key, step = 1) {
    if (typeof step !== 'number' || step <= 0) {
      throw new Error("Decrement step must be a positive number.");
    }
    const currentCount = this.counts.get(key) || 0;
    this.counts.set(key, currentCount - step);
  }

  /**
   * Sets the count for a given key to a specific value.
   * @param {any} key - The key whose count should be set.
   * @param {number} value - The new count value.
   */
  set(key, value) {
    if (typeof value !== 'number') {
      throw new Error("Count value must be a number.");
    }
    this.counts.set(key, value);
  }

  /**
   * Gets the current count for a given key.
   * Returns 0 if the key does not exist.
   * @param {any} key - The key to retrieve the count for.
   * @returns {number} The count for the key, or 0 if not found.
   */
  get(key) {
    return this.counts.get(key) || 0;
  }
}

function readJSON(fp) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function cleanText(str) {
  if (str == null) return null;
  try {
    const $ = cheerio.load(String(str));
    return $.text().trim() || null;
  } catch (e) {
    return String(str);
  }
}

function baseLayoutDefaults() {
  return {
    // Required fields per schema (allowing null where permitted)
    flooring_material_type: null,
    size_square_feet: null,
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
  };
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const data = readJSON(inputPath);

  const parcel = data?.ParcelInformation?.response?.value?.[0] || {};
  const buildings = data?.Building?.response?.value || [];
  const subAreas = data?.BuildingSubAreas?.response?.value || [];
  const features = data?.ExtraFeatures?.response?.value || [];

  const strap =
    cleanText(parcel.dsp_strap) || cleanText(parcel.strap) || "unknown";
  const propertyKey = `property_${strap.trim()}`;

  const layouts = [];
  let spaceTypeCounter = {};
  buildings.forEach((building, buildIndex) => {
    spaceTypeCounter[(buildIndex + 1).toString()] = new MultiCounter();
    // Primary building summary layout
    const buildingLayout = Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: (buildIndex + 1).toString(),
      size_square_feet: building?.BuildingSqFeet || null,
      heated_area_sq_ft: building?.HeatedSqFeet || null,
      total_area_sq_ft: building?.BuildingSqFeet || null,
      built_year: building?.YearBuilt || null,
      building_number: (buildIndex + 1),
      is_finished: true,
    });
    layouts.push(buildingLayout);
    const numberOfBedrooms = building?.Bedrooms || 0;
    const numberOfBathrooms = building?.Bathrooms || 0;
    const numberOfHalfbathrooms = building?.HalfBathrooms || 0;
    for (let index = 0; index < numberOfBedrooms; index++) {
      const roomLayout = Object.assign(baseLayoutDefaults(), {
        space_type: "Bedroom",
        space_type_index: `${(buildIndex + 1).toString()}.${index+1}`,
        size_square_feet: null,
        heated_area_sq_ft: null,
        total_area_sq_ft: null,
        built_year: null,
        building_number: (buildIndex + 1),
        is_finished: true,
      });
      layouts.push(roomLayout);
    }
    for (let index = 0; index < numberOfBathrooms; index++) {
      const roomLayout = Object.assign(baseLayoutDefaults(), {
        space_type: "Full Bathroom",
        space_type_index: `${(buildIndex + 1).toString()}.${index+1}`,
        size_square_feet: null,
        heated_area_sq_ft: null,
        total_area_sq_ft: null,
        built_year: null,
        building_number: (buildIndex + 1),
        is_finished: true,
      });
      layouts.push(roomLayout);
    }
    for (let index = 0; index < numberOfHalfbathrooms; index++) {
      const roomLayout = Object.assign(baseLayoutDefaults(), {
        space_type: "Half Bathroom / Powder Room",
        space_type_index: `${(buildIndex + 1).toString()}.${index+1}`,
        size_square_feet: null,
        heated_area_sq_ft: null,
        total_area_sq_ft: null,
        built_year: null,
        building_number: (buildIndex + 1),
        is_finished: true,
      });
      layouts.push(roomLayout);
    }
  });

  // Sub-area derived layouts
  for (const s of subAreas) {
    if (!s || !s.Code || !s.CardNumber) continue;
    let spaceTypeMappingValue = [null, null];
    if (s.Code in spaceTypeMapping) {
      spaceTypeMappingValue = spaceTypeMapping[s.Code];
    } else {
      continue;
    }
    if (spaceTypeMappingValue[0]) {
      const buildNumber = s.CardNumber;
      spaceTypeCounter[buildNumber.toString()].increment(spaceTypeMappingValue[0]);
      const spaceTypeIndex = spaceTypeCounter[buildNumber.toString()].get(spaceTypeMappingValue[0]);
      const l = Object.assign(baseLayoutDefaults(), {
        building_number: buildNumber,
        space_type: spaceTypeMappingValue[0],
        space_type_index: `${buildNumber}.${spaceTypeIndex}`,
        size_square_feet: s.TotalSketchedArea || null,
        is_finished: spaceTypeMappingValue[1],
        built_year: s.YearBuilt ? s.YearBuilt : null,
      });
      layouts.push(l);
    }
  }
  spaceTypeCounter["Features"] = new MultiCounter();
  for (const f of features) {
    if (!f || !f.l_dscr) continue;
    const featureType = f.l_dscr.trim().toUpperCase();
    let spaceType = null;
    let isFinished = true;
    if (featureType.includes("UNFINISHED")) {
      isFinished = false;
    }
    if (featureType.includes("POOL") && featureType.includes("DECK")) {
      spaceType = "Pool Area";
    } else if(featureType.includes("POOL")) {
      spaceType = "Outdoor Pool";
    } else if(featureType.includes(" SHED")) {
      spaceType = "Shed";
    } else if(featureType.includes("GARAGE")) {
      spaceType = "Attached Garage";
    } else if(featureType.includes("GREENHOUSE")) {
      spaceType = "Greenhouse";
    } else if(featureType.includes("PORCH") && featureType.includes("ENCLOSED") ) {
      spaceType = "Enclosed Porch";
    } else if(featureType.includes("PORCH") && featureType.includes("SCREENED") ) {
      spaceType = "Screened Porch";
    } else if(featureType.includes("PORCH") ) {
      spaceType = "Porch";
    } else if(featureType.includes("SPA/HOT") ) {
      spaceType = "Hot Tub / Spa Area";
    } else if(featureType.includes("SUMMER KITCHEN") ) {
      spaceType = "Outdoor Kitchen";
    }
    if (spaceType) {
      spaceTypeCounter["Features"].increment(spaceType);
      const spaceTypeIndex = spaceTypeCounter["Features"].get(spaceType);
      const l = Object.assign(baseLayoutDefaults(), {
        space_type: spaceType,
        space_type_index: `${spaceTypeIndex}`,
        is_finished: isFinished,
        built_year: f.yr_blt ? f.yr_blt : null,
      });
      layouts.push(l);
    }
  }

  const out = {};
  out[propertyKey] = { layouts };

  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);

  fs.writeFileSync(
    path.join(ownersDir, "layout_data.json"),
    JSON.stringify(out, null, 2),
  );

  console.log(
    "Layout mapping complete:",
    propertyKey,
  );
})();
