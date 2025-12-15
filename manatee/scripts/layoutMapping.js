// Layout mapping script
// Reads input.json and writes owners/layout_data.json with layouts array per schema

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

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

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function safeParse(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function extractParcelId(input) {
  // Try Owners HTML first
  try {
    const html = input?.OwnersAndGeneralInformation?.response || "";
    if (cheerio && html) {
      const $ = cheerio.load(html);
      const text = $.text();
      const m = text.match(/\b(\d{9,12})\b/);
      if (m) return m[1];
      const ta = $("textarea").first().text().trim();
      if (/^\d{9,12}$/.test(ta)) return ta;
    }
  } catch {}
  try {
    const qs = input?.Sales?.source_http_request?.multiValueQueryString?.parid;
    if (Array.isArray(qs) && qs[0]) return String(qs[0]);
  } catch {}
  const err = {
      type: "error",
      message: "Parcel ID not found",
      path: "",
    };
  throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
}

function toInt(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toIntRounded(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function sumFromBuildings(input) {
  const rows = input?.Buildings?.response?.rows || [];
  let underRoof = 0;
  let livBus = 0;
  let any = false;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const u = toInt(r[6]);
    const l = toInt(r[7]);
    if (u != null) {
      underRoof += u;
      any = true;
    }
    if (l != null) {
      livBus += l;
      any = true;
    }
  }
  return any ? { underRoof, livBus } : { underRoof: null, livBus: null };
}

function buildLayouts(input) {
  const buildings = input && input.Buildings && input.Buildings.response;
  let layouts = [];
  if (buildings && Array.isArray(buildings.rows) && buildings.rows.length > 0) {
    // Determine indexes from cols
    const cols = buildings.cols || [];
    let idx = {};
    buildings.cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    buildings.rows.forEach((building, bIdx) => {
      const builtYear = toIntRounded(building[idx["YrBlt"]]);
      layouts.push({
        building_number: (bIdx + 1),
        space_type: "Building",
        space_type_index: (bIdx + 1).toString(),
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
        adjustable_area_sq_ft: null,
        area_under_air_sq_ft: null,
        bathroom_renovation_date: null,
        kitchen_renovation_date: null,
        heated_area_sq_ft: null,
        installation_date: null,
        livable_area_sq_ft: (building[idx.LivBus] ? Number(building[idx.LivBus]) : null),
        pool_installation_date: null,
        spa_installation_date: null,
        story_type: null,
        total_area_sq_ft: (building[idx.UnRoof] ? Number(building[idx.UnRoof]) : null),
        built_year: builtYear && builtYear >= 1000 && builtYear <= 3000 ? builtYear : null
      });
      const numberOfFloors = (building[idx.Stories] ? Number(building[idx.Stories]) : null);
      if (numberOfFloors) {
        for (let floorIdx = 0; floorIdx < numberOfFloors; floorIdx++) {
          layouts.push({
            building_number: (bIdx + 1),
            space_type: "Floor",
            space_type_index: `${(bIdx + 1)}.${(floorIdx + 1)}`,
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
            adjustable_area_sq_ft: null,
            area_under_air_sq_ft: null,
            bathroom_renovation_date: null,
            kitchen_renovation_date: null,
            heated_area_sq_ft: null,
            installation_date: null,
            livable_area_sq_ft: null,
            pool_installation_date: null,
            spa_installation_date: null,
            story_type: null,
            total_area_sq_ft: null,
          });
        }
      }
      const roomString = (building[idx.Rooms] ? building[idx.Rooms] : null);
      if (roomString) {
        const roomSplit = roomString.split("/");
        if (roomSplit.length == 3) {
          const noOfBedrooms = toIntRounded(roomSplit[0]);
          if(noOfBedrooms) {
            for (let idx = 0; idx < noOfBedrooms; idx++) {
              layouts.push({
                building_number: (bIdx + 1),
                space_type: "Bedroom",
                space_type_index: `${(bIdx + 1)}.${(idx + 1)}`,
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
                adjustable_area_sq_ft: null,
                area_under_air_sq_ft: null,
                bathroom_renovation_date: null,
                kitchen_renovation_date: null,
                heated_area_sq_ft: null,
                installation_date: null,
                livable_area_sq_ft: null,
                pool_installation_date: null,
                spa_installation_date: null,
                story_type: null,
                total_area_sq_ft: null,
              });
            }
          }
          const noOfFullBathrooms = toIntRounded(roomSplit[1]);
          if(noOfFullBathrooms) {
            for (let idx = 0; idx < noOfFullBathrooms; idx++) {
              layouts.push({
                building_number: (bIdx + 1),
                space_type: "Full Bathroom",
                space_type_index: `${(bIdx + 1)}.${(idx + 1)}`,
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
                adjustable_area_sq_ft: null,
                area_under_air_sq_ft: null,
                bathroom_renovation_date: null,
                kitchen_renovation_date: null,
                heated_area_sq_ft: null,
                installation_date: null,
                livable_area_sq_ft: null,
                pool_installation_date: null,
                spa_installation_date: null,
                story_type: null,
                total_area_sq_ft: null,
              });
            }

          }
          const noOfHalfBathrooms = toIntRounded(roomSplit[2]);
          if(noOfHalfBathrooms) {
            for (let idx = 0; idx < noOfHalfBathrooms; idx++) {
              layouts.push({
                building_number: (bIdx + 1),
                space_type: "Half Bathroom / Powder Room",
                space_type_index: `${(bIdx + 1)}.${(idx + 1)}`,
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
                adjustable_area_sq_ft: null,
                area_under_air_sq_ft: null,
                bathroom_renovation_date: null,
                kitchen_renovation_date: null,
                heated_area_sq_ft: null,
                installation_date: null,
                livable_area_sq_ft: null,
                pool_installation_date: null,
                spa_installation_date: null,
                story_type: null,
                total_area_sq_ft: null,
              });
            }
          }
        }
      }
    });
  }

  return layouts;
}

function buildFeatureLayouts(input) {
  const features = input && input.Features && input.Features.response;
  let layouts = [];
  let spaceTypeCounter = {};
  spaceTypeCounter["NoBuilding"] = new MultiCounter();
  if (features && Array.isArray(features.rows) && features.rows.length > 0) {
    // Determine indexes from cols
    const cols = features.cols || [];
    let idx = {};
    cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    features.rows.forEach((feature, bIdx) => {
      if (!feature[idx["Description"]]) {
        return;
      }
      const featureType = feature[idx["Description"]].toUpperCase();
      const area = toInt(feature[idx["Area"]]);
      const builtYear = toIntRounded(feature[idx["YrBlt"]]);
      const buildingNum = toIntRounded(feature[idx["Bldg"]]);
      if (buildingNum && spaceTypeCounter[buildingNum.toString()] === undefined) {
        spaceTypeCounter[buildingNum.toString()] = new MultiCounter();
      }
      let spaceType = null;
      if (featureType.includes("POOL") && featureType.includes("DECK")) {
        spaceType = "Pool Area";
      } else if(featureType.includes("POOL")) {
        spaceType = "Outdoor Pool";
      } else if(featureType.includes("SHED")) {
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
      } else if(featureType.includes("SPA") ) {
        spaceType = "Hot Tub / Spa Area";
      } else if(featureType.includes("SUMMER KITCHEN") ) {
        spaceType = "Outdoor Kitchen";
      }
      // else if(featureType.includes("FENCE")) {
      //   throw {
      //     type: "error",
      //     message: `Fence found ${featureType}`,
      //     path: "",
      //   };
      // }
      if (spaceType) {
        let spaceTypeIndex = null;
        if (buildingNum) {
          spaceTypeCounter[buildingNum.toString()].increment(spaceType);
          spaceTypeIndex = `${buildingNum}.${spaceTypeCounter[buildingNum.toString()].get(spaceType)}`;
        } else {
          spaceTypeCounter["NoBuilding"].increment(spaceType);
          spaceTypeIndex = `${spaceTypeCounter["NoBuilding"].get(spaceType)}`;
        }
        layouts.push({
          building_number: buildingNum ? buildingNum : null,
          space_type: spaceType,
          space_type_index: spaceTypeIndex,
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
          adjustable_area_sq_ft: null,
          area_under_air_sq_ft: null,
          bathroom_renovation_date: null,
          kitchen_renovation_date: null,
          heated_area_sq_ft: null,
          installation_date: null,
          livable_area_sq_ft: null,
          pool_installation_date: null,
          spa_installation_date: null,
          story_type: null,
          total_area_sq_ft: area,
          built_year: builtYear && builtYear >= 1000 && builtYear <= 3000 ? builtYear : null
        });
      }
    });
  }

  return layouts;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const input = safeParse(inputPath);
  const parcelId = extractParcelId(input);  
  let parcel = readJSON("parcel.json");
  if (!parcel) {
    parcel = readJSON("property_seed.json");
  }
  if (parcel.request_identifier != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.`,
      path: "property.request_identifier",
    };
  }
  const buildingLayouts = buildLayouts(input);
  const featureLayouts = buildFeatureLayouts(input);
  const layouts = buildingLayouts.concat(featureLayouts);
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
})();
