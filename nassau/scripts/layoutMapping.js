// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  // Identify parcel identifier from HTML

  const parcelHeader = $("section.title h1").first().text().trim();
  // console.log("parcelHeader>>>",parcelHeader)

  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);  // Capture everything after "Parcel"
  // console.log("m>>>", m);

  if (m) parcelIdentifier = m[1];

  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  // console.log("Final parcelIdentifier>>>", parcelIdentifier);
  return parcelIdentifier;
}

function parseNumber(val) {
  if (!val) return 1;
  const num = String(val).replace(/[^0-9.\-]/g, "");
  if (!num) return 1;
  const n = Number(num);
  return Number.isFinite(n) ? n : 1;
}

function mapFlooringMaterial(details) {
  if (!details) return null;
  const u = details.toUpperCase();
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("CLAY TILE") || u.includes("CERAMIC")) return "CeramicTile";
  if (u.includes("WOOD")) return "Wood";
  if (u.includes("VINYL")) return "Vinyl";
  if (u.includes("TILE")) return "Tile";
  if (u.includes("CONCRETE")) return "Concrete";
  if (u.includes("LAMINATE")) return "Laminate";
  return null;
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propId = extractPropertyId($);



  // Create layouts based on room counts
  const layouts = [];
  let layoutIndex = 1;
  let final_built_year = null
  // Create Building layouts for each physical building
  $('section.buildings .building-data').each((buildingIndex, buildingElement) => {
    const buildingSqft = $(buildingElement).find('table.grid2 tbody tr td').first().text().replace(/[,]/g, '').trim();
    const yearBuilt = $(buildingElement).find('table.grid2 tbody tr td').eq(1).text().trim();
    const buildingLayoutIndex = layoutIndex++;
    final_built_year = yearBuilt && /^\d{4}$/.test(yearBuilt) ? parseInt(yearBuilt) : null
   
    // Extract flooring material for this building
    let buildingFlooringMaterial2 = null;
    $(buildingElement).find('.se table tbody tr').each((i, tr) => {
      const tds = $(tr).find('td');
      const description = $(tds[1]).text().trim();
      const details = $(tds[3]).text().trim();
      if (description === "Interior Flooring") buildingFlooringMaterial2 = mapFlooringMaterial(details);
    });
    
    // Create Building layout
    layouts.push({
      // source_http_request: {
      //   method: "GET",
      //   url: "https://example.com/layout-data"
      // },
      request_identifier: `${propId}_building_${buildingIndex + 1}`,
      space_type: "Building",
      space_type_index: buildingLayoutIndex.toString(),
      flooring_material_type: buildingFlooringMaterial2 || null,
      size_square_feet: buildingSqft ? Number(buildingSqft) : null,
      heated_area_sq_ft: buildingSqft ? Number(buildingSqft) : null,
      total_area_sq_ft: buildingSqft ? Number(buildingSqft) : null,
      livable_area_sq_ft: buildingSqft ? Number(buildingSqft) : null,
      area_under_air_sq_ft: null,
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
      building_number: buildingIndex + 1,
      built_year: yearBuilt && /^\d{4}$/.test(yearBuilt) ? parseInt(yearBuilt) : null
    });
    
    // Extract room counts and flooring material for this building
    let buildingBedrooms = 0, buildingBathrooms = 0, buildingHalfBathrooms = 0;
    let buildingBalcony = 0, buildingKitchen = 0, buildingOfficeRooms = 0;
    let buildingFlooringMaterial = null;
    
    $(buildingElement).find('.se table tbody tr').each((i, tr) => {
      const tds = $(tr).find('td');
      const description = $(tds[1]).text().trim();
      const count = $(tds[2]).text().trim();
      const details = $(tds[3]).text().trim();
      
      if (description === "Interior Flooring") buildingFlooringMaterial = mapFlooringMaterial(details);
      if (description === "Bedrooms") buildingBedrooms = parseNumber(count) || 0;
      if (description === "Bathrooms") {
        const bathroomCount = parseNumber(count) || 0;
        buildingBathrooms = Math.floor(bathroomCount);
        const decimal = bathroomCount - buildingBathrooms;
        if (decimal >= 0.5) buildingHalfBathrooms += 1;
      }
      if (description === "Half Bathroom") buildingHalfBathrooms += parseNumber(count) || 0;
      if (description === "Balcony") buildingBalcony = parseNumber(count) || 0;
      if (description === "Kitchen") buildingKitchen = parseNumber(count) || 0;
      if (description === "Full Bathroom") buildingBathrooms += parseNumber(count) || 0;
      if (description === "RMS") buildingOfficeRooms = parseNumber(count) || 0;
    });
    
    // Create sub-layouts for this building with building-specific counters
    let buildingBedroomCounter = 0;
    let buildingBathroomCounter = 0;
    let buildingHalfBathroomCounter = 0;
    let buildingKitchenCounter = 0;
    let buildingBalconyCounter = 0;
    let buildingOfficeRoomCounter = 0;
    
    const createSubLayout = (spaceType, count) => {
      for (let i = 0; i < count; i++) {
        let spaceIndex;
        if (spaceType === "Bedroom") {
          spaceIndex = `${buildingIndex + 1}.${++buildingBedroomCounter}`;
        } else if (spaceType === "Full Bathroom") {
          spaceIndex = `${buildingIndex + 1}.${++buildingBathroomCounter}`;
        } else if (spaceType === "Half Bathroom / Powder Room") {
          spaceIndex = `${buildingIndex + 1}.${++buildingHalfBathroomCounter}`;
        } else if (spaceType === "Kitchen") {
          spaceIndex = `${buildingIndex + 1}.${++buildingKitchenCounter}`;
        } else if (spaceType === "Balcony") {
          spaceIndex = `${buildingIndex + 1}.${++buildingBalconyCounter}`;
        } else if (spaceType === "Office Room") {
          spaceIndex = `${buildingIndex + 1}.${++buildingOfficeRoomCounter}`;
        } else {
          spaceIndex = layoutIndex++;
        }
        
        layouts.push({
          // source_http_request: {
          //   method: "GET",
          //   url: "https://example.com/layout-data"
          // },
          request_identifier: `${propId}_${spaceType.toLowerCase().replace(/\s+/g, '_')}_${spaceIndex}`,
          space_type: spaceType,
          space_type_index: spaceIndex.toString(),
          flooring_material_type: buildingFlooringMaterial || null,
          built_year: final_built_year,
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
          building_number: buildingIndex + 1
        });
      }
    };
    
    // Create sub-layouts for each room type
    createSubLayout("Bedroom", buildingBedrooms);
    createSubLayout("Full Bathroom", buildingBathrooms);
    createSubLayout("Half Bathroom / Powder Room", buildingHalfBathrooms);
    createSubLayout("Balcony", buildingBalcony);
    createSubLayout("Kitchen", buildingKitchen);
    createSubLayout("Office Room", buildingOfficeRooms);
  });

  
  // // Add default layout if no rooms were found
  // if (layouts.length === 0) {
  //   layouts.push({
  //     space_type: "Building",
  //     space_type_index: 1,
  //     flooring_material_type: null,
  //     size_square_feet: null,
  //     floor_level: null,
  //     has_windows: null,
  //     window_design_type: null,
  //     window_material_type: null,
  //     window_treatment_type: null,
  //     is_finished: true,
  //     furnished: null,
  //     paint_condition: null,
  //     flooring_wear: null,
  //     clutter_level: null,
  //     visible_damage: null,
  //     countertop_material: null,
  //     cabinet_style: null,
  //     fixture_finish_quality: null,
  //     design_style: null,
  //     natural_light_quality: null,
  //     decor_elements: null,
  //     pool_type: null,
  //     pool_equipment: null,
  //     spa_type: null,
  //     safety_features: null,
  //     view_type: null,
  //     lighting_features: null,
  //     condition_issues: null,
  //     is_exterior: false,
  //     pool_condition: null,
  //     pool_surface_type: null,
  //     pool_water_quality: null,
  //     bathroom_renovation_date: null,
  //     kitchen_renovation_date: null,
  //     flooring_installation_date: null
  //   });
  // }

  const outObj = {};
  outObj[`property_${propId}`] = { layouts };

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/layout_data.json"),
    JSON.stringify(outObj, null, 2),
  );
  console.log(
    "Wrote owners/layout_data.json for",
    propId,
    "with",
    layouts.length,
    "layout",
  );
}

run();
