// Layout mapping script
// Reads input.json, extracts layout-related fields, and writes owners/layout_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

function loadInput() {
  const jsonFilePath = path.join(process.cwd(), 'input.json');
  const htmlFilePath = path.join(process.cwd(), 'input.html');

  try {
    // 1. Try to read input.json synchronously
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    return JSON.parse(jsonData);
  } catch (jsonError) {
    // If input.json doesn't exist or is unreadable, try input.html
    if (jsonError.code === 'ENOENT' || jsonError instanceof SyntaxError) {
      console.warn(`Could not read or parse input.json: ${jsonError.message}. Attempting to read from input.html.`);
      try {
        // 2. Read input.html synchronously
        const htmlData = fs.readFileSync(htmlFilePath, 'utf8');

        // Parse the HTML using Cheerio
        const $ = cheerio.load(htmlData);
        const preTagContent = $('pre').text(); // Get the text content of the <pre> tag

        if (preTagContent) {
          return JSON.parse(preTagContent);
        } else {
          throw new Error('No <pre> tag found or <pre> tag is empty in input.html');
        }
      } catch (htmlError) {
        throw new Error(`Failed to read or parse JSON from input.html: ${htmlError.message}`);
      }
    } else {
      // Re-throw other errors from input.json
      throw new Error(`An unexpected error occurred while processing input.json: ${jsonError.message}`);
    }
  }
}

function defaultLayout(spaceType, index, floorLevel) {
  return {
    space_type: spaceType,
    space_type_index: String(index),
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: floorLevel,
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
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    story_type: null,
    building_number: null,
    request_identifier: null,
    source_http_request: null,
    area_under_air_sq_ft: null,
    total_area_sq_ft: null,
    heated_area_sq_ft: null,
    adjustable_area_sq_ft: null,
  };
}

function mapLayouts(data) {
  const pi = (data && data.PropertyInfo) || {};
  const id = pi.FolioNumber || "unknown";
  const bedroomCount =
    typeof pi.BedroomCount === "number" ? pi.BedroomCount : 0;
  const bathroomCount =
    typeof pi.BathroomCount === "number" ? pi.BathroomCount : 0;
  const floorLevel = typeof pi.FloorCount === "number" ? pi.FloorCount : 0;
  //   pi.FloorCount === 1
  //     ? "1st Floor"
  //     : pi.FloorCount === 2
  //       ? "2nd Floor"
  //       : null;

  const layouts = [];
  for (let i = 1; i <= bedroomCount; i++) {
    layouts.push(defaultLayout("Bedroom", i, null));
  }
  for (let j = 1; j <= bathroomCount; j++) {
    layouts.push(
      defaultLayout("Full Bathroom", j, null),
    );
  }
  for (let k = 1; k <= floorLevel; k++) {
    layouts.push(
      defaultLayout("Floor", k, null),
    );
  }

  function parseIntLike(v) {
    if (v == null) return null;
    const n = Number(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  // Extra features → layouts
  const efi = data && data.ExtraFeature && Array.isArray(data.ExtraFeature.ExtraFeatureInfos)
    ? data.ExtraFeature.ExtraFeatureInfos
    : [];
  function extractSpaData(description) {
    if (!description) return {};
    const d = String(description).toUpperCase();
    
    // Extract spa type from description
    let spaType = null;
    if (/\bJACUZZI\b/.test(d)) spaType = "Jacuzzi";
    else if (/\bIN\s*GROUND\b/.test(d)) spaType = "InGround";
    else if (/\bROOFTOP\b/.test(d)) spaType = "Rooftop";
    else if (/\bWOOD\s*FIRED\b/.test(d)) spaType = "WoodFiredHotTub";
    else if (/\bJAPANESE\s*SOAKING\b/.test(d)) spaType = "JapaneseSoakingTub";
    else if (/\bSALT\s*WATER\b/.test(d)) spaType = "Saltwater";
    else if (/\bHEATED\b/.test(d)) spaType = "Heated";
    else spaType = "Jacuzzi"; // Default for residential spas
    
    return {
      spa_type: spaType
    };
  }

  function extractPoolData(description) {
    if (!description) return {};
    const d = String(description).toUpperCase();
    
    // Extract pool type from description
    let poolType = null;
    if (/\bINDOOR\b/.test(d)) poolType = "IndoorPool";
    else if (/\bOUTDOOR\b/.test(d)) poolType = "OutdoorPool";
    else if (/\bHEATED\b/.test(d)) poolType = "Heated";
    else if (/\bSALT\s*WATER\b/.test(d)) poolType = "SaltWater";
    else if (/\bABOVE\s*GROUND\b/.test(d)) poolType = "AboveGround";
    else if (/\bCONCRETE\b/.test(d)) poolType = "Concrete";
    else if (/\bFIBERGLASS\b/.test(d)) poolType = "Fiberglass";
    else if (/\bVINYL\b/.test(d)) poolType = "Vinyl";
    else if (/\bNATURAL\b/.test(d)) poolType = "Natural";
    else poolType = "BuiltIn"; // Default for residential pools
    
    // Extract surface type
    let surfaceType = null;
    if (/\bTILE\b/.test(d)) surfaceType = "Tile";
    else if (/\bCONCRETE\b/.test(d)) surfaceType = "Concrete";
    else if (/\bVINYL\s*LINER\b/.test(d)) surfaceType = "Vinyl Liner";
    else if (/\bFIBERGLASS\b/.test(d)) surfaceType = "Fiberglass";
    else if (/\bPAINTED\b/.test(d)) surfaceType = "Painted";
    else if (/\bNATURAL\s*STONE\b/.test(d)) surfaceType = "Natural Stone";
    else surfaceType = "Unknown";
    
    // Extract condition from description keywords
    let condition = null;
    if (/\bNEW\b/.test(d)) condition = "New";
    else if (/\bGOOD\b/.test(d)) condition = "Good";
    else if (/\bWORN\b/.test(d)) condition = "Worn";
    else if (/\bNEEDS?\s*REPAIR\b/.test(d)) condition = "Needs Repair";
    else if (/\bDAMAGED\b/.test(d)) condition = "Damaged";
    else condition = "Unknown";
    
    // Extract water quality (default to clear for residential pools)
    const waterQuality = "Clear";
    
    // Extract equipment (basic detection)
    let equipment = null;
    if (/\bHEATED\b/.test(d)) equipment = "Heater";
    else if (/\bFILTER\b/.test(d)) equipment = "Filter";
    else equipment = "Unknown";
    
    return {
      pool_type: poolType,
      pool_surface_type: surfaceType,
      pool_condition: condition,
      pool_water_quality: waterQuality,
      pool_equipment: equipment
    };
  }

  function mapExtraFeatureToLayout(description) {
    if (!description) return null;
    const d = String(description).toUpperCase();
    // Check for spa/whirlpool first (more specific)
    if (/\bSPA\b|\bHOT TUB\b|\bJACUZZI\b|\bWHIRLPOOL\b/.test(d)) return { 
      spaceType: "Hot Tub / Spa Area", 
      isExterior: true,
      spaData: extractSpaData(description)
    };
    // Then check for pool (less specific)
    if (/\bPOOL\b/.test(d)) return { 
      spaceType: "Pool Area", 
      isExterior: true,
      poolData: extractPoolData(description)
    };
    if (/\bENCLOSED\s*PORCH\b/.test(d)) return { spaceType: "Enclosed Porch", isExterior: true };
    if (/\bSCREEN(ED)?\s*PORCH\b|\bSCREEN\s*ROOM\b/.test(d)) return { spaceType: "Screened Porch", isExterior: true };
    if (/\bOPEN\s*PORCH\b|\bPORCH\b/.test(d)) return { spaceType: "Open Porch", isExterior: true };
    if (/\bLANAI\b/.test(d)) return { spaceType: "Lanai", isExterior: true };
    if (/\bPATIO\b/.test(d)) return { spaceType: "Patio", isExterior: true };
    if (/\bBALCONY\b/.test(d)) return { spaceType: "Balcony", isExterior: true };
    if (/\bTERRACE\b/.test(d)) return { spaceType: "Terrace", isExterior: true };
    if (/\bDECK\b/.test(d)) return { spaceType: "Deck", isExterior: true };
    if (/\bGAZEBO\b/.test(d)) return { spaceType: "Gazebo", isExterior: true };
    if (/\bSUN\s*ROOM\b|\bSUNROOM\b|\bFLORIDA\s*ROOM\b/.test(d)) return { spaceType: "Sunroom", isExterior: false };
    if (/\bSCREEN\s*ENCLOSURE\b/.test(d)) return { spaceType: "Screen Enclosure (Custom)", isExterior: true };
    if (/\bCOURTYARD\b/.test(d)) return { spaceType: "Open Courtyard", isExterior: true };
    if (/\bSTOOP\b/.test(d)) return { spaceType: "Stoop", isExterior: true };
    if (/\bDET(ACHED)?\s*GARAGE\b/.test(d)) return { spaceType: "Detached Garage", isExterior: false };
    if (/\bATT(ACHED)?\s*GARAGE\b|\bGARAGE\b/.test(d)) return { spaceType: "Attached Garage", isExterior: false };
    if (/\bCARPORT\b/.test(d)) return { spaceType: "Carport", isExterior: true };
    if (/\bUTILITY\s*CLOSET\b|\bUTILITY\s*ROOM\b/.test(d)) return { spaceType: "Utility Closet", isExterior: false };
    if (/\bSHED\b/.test(d)) return { spaceType: "Shed", isExterior: true };
    if (/\bFENCE\b|\bCHAIN\s*LINK\b/.test(d)) return null; // Skip fences - handle in structure/lot instead
    return null;
  }
  // Deduplicate ExtraFeatureInfos by description to avoid multiple years creating duplicate layouts
  const spaceTypeCounter = new MultiCounter();
  const seenDescriptions = new Set();
  for (const ef of efi) {
    const desc = ef && ef.Description ? String(ef.Description).trim() : null;
    if (!desc) {
      throw new Error("ExtraFeatureInfos item is missing Description");
    }
    
    // Skip if we've already processed this description (deduplicate by year)
    if (seenDescriptions.has(desc)) {
      continue;
    }
    seenDescriptions.add(desc);
    
    const m = mapExtraFeatureToLayout(desc);
    if (!m) {
      // Skip unmapped features (like fences) instead of throwing error
      continue;
    }
    spaceTypeCounter.increment(m.spaceType);
    const spaceTypeIndex = spaceTypeCounter.get(m.spaceType);
    const size = parseIntLike(ef && (ef.Units || ef.SquareFeet || ef.Size));
    const idx = spaceTypeIndex;
    const lay = defaultLayout(m.spaceType, idx, null);
    lay.is_exterior = m.isExterior;
    lay.size_square_feet = size;
    
    // Add pool-specific data if available
    if (m.poolData) {
      Object.assign(lay, m.poolData);
    }
    
    // Add spa-specific data if available
    if (m.spaData) {
      Object.assign(lay, m.spaData);
    }
    
    layouts.push(lay);
  }

  const buildings = data && data.Building && Array.isArray(data.Building.BuildingInfos)
    ? data.Building.BuildingInfos
    : [];
  let buildIndex = 1;
  for (const building of buildings) {
    layouts.push(
      defaultLayout("Building", buildIndex, null),
    );
    buildIndex++;
  }
  

  // Living Area summary from PropertyInfo
  // const heated = parseIntLike(pi.BuildingHeatedArea);
  // const total = parseIntLike(pi.BuildingGrossArea);
  // const adjusted = parseIntLike(pi.BuildingEffectiveArea);
  // if (heated != null || total != null || adjusted != null) {
  //   const idx = layouts.length + 1;
  //   const lay = defaultLayout("Living Area", idx, null);
  //   lay.is_exterior = false;
  //   lay.size_square_feet = heated != null ? heated : null;
  //   lay.heated_area_sq_ft = heated;
  //   lay.total_area_sq_ft = total;
  //   lay.adjustable_area_sq_ft = adjusted;
  //   layouts.push(lay);
  // }

  return { [`property_${id}`]: { layouts } };
}

function run() {
  const data = loadInput();
  const output = mapLayouts(data);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

run();
