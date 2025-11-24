const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function getParcelId($) {
  const dataId = $("script#display\\.js").attr("data-parcelid");
  if (dataId && /\d{6,}/.test(dataId)) return dataId.trim();
  const html = $.html();
  const m = html.match(/DB:\s*(\d{12,})/);
  if (m) return m[1];
  const m2 = html.match(/strap=(\d{12,})/);
  if (m2) return m2[1];
  return "unknown_property_id";
}

function parseNumber(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^0-9.\-]/g, "");
  if (!n) return null;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function extractBuildings($) {
  const buildings = [];
  $("#bldngs .contentGroup").each((i, buildingGroupEl) => {
    const $buildingGroup = $(buildingGroupEl);
    const buildingH4 = $buildingGroup.find("h4").first();
    const buildingHeaderText = buildingH4.text();

    if (!/BUILDING\s+\d+/i.test(buildingHeaderText)) {
      return;
    }

    console.log(`--- Processing ${buildingHeaderText} ---`);

    const characteristics = {};

    // --- MOVE THESE DECLARATIONS HERE ---
    let beds = 0;
    let full = 0;
    let half = 0;
    let style = null;
    let substructure = null;
    let frameConstType = null;
    let exteriorWall = null;
    let roofStructure = null;
    // --- END OF MOVED DECLARATIONS ---

    const charHeading = $buildingGroup.find("h4:contains('Building Characteristics')");

    if (charHeading.length) {
      // Extract Living Area, Total Under Roof, Actual Year Built
      let currentElement = charHeading.next();
      while (currentElement.length && !currentElement.is("h4") && !currentElement.find("table").length) {
        const text = currentElement.text().trim();
        if (text.includes("Living Area:")) {
          characteristics.livingArea = parseNumber(text.replace("Living Area:", "").trim());
        } else if (text.includes("Total Under Roof:")) {
          characteristics.totalUnderRoof = parseNumber(text.replace("Total Under Roof:", "").trim());
        } else if (text.includes("Actual Year Built:")) {
          characteristics.yearBuilt = parseNumber(text.replace("Actual Year Built:", "").trim());
        }
        currentElement = currentElement.next();
      }

      const charTable = charHeading.nextAll("div").has("table").first().find("table").first();

      if (charTable.length) {
        charTable.find("tr").each((_, tr) => {
          const tds = $(tr).find("td");
          if (tds.length >= 3) {
            const label = $(tds[0]).text().trim().toUpperCase();
            console.log(`  Characteristic: ${label}`);
            const units = parseNumber($(tds[1]).text());
            const info = $(tds[2]).text().trim().toUpperCase();

            if (label === "BEDROOM") beds = units || beds;
            if (label === "FULL BATH") full = units || full;
            if (label === "HALF BATH") half = units || half;
            if (label === "STYLE") style = info;
            if (label === "SUBSTRUCT") substructure = info;
            if (label === "FRAME / CONST TYPE") frameConstType = info;
            if (label === "EXTERIOR WALL") exteriorWall = info;
            if (label === "ROOF STRUCTURE") roofStructure = info;
          }
        });
      } else {
        console.warn(`  Warning: Building Characteristics table not found for ${buildingHeaderText}`);
      }
    } else {
        console.warn(`  Warning: 'Building Characteristics' heading not found for ${buildingHeaderText}`);
    }
    console.log(full,half)

    const subareas = [];
    const subareaHeading = $buildingGroup.find("h4:contains('Building Subareas')");
    const subareaTable = subareaHeading.nextAll("table.center").first();

    if (subareaTable.length) {
      subareaTable.find("tr").each((_, tr) => {
        const tds = $(tr).find("td");
        if (!$(tr).hasClass("header") && tds.length >= 3) {
          const codeDesc = $(tds[0]).text().trim().toUpperCase();
          const heated = $(tds[1]).text().trim().toUpperCase() === "Y";
          const total = parseNumber($(tds[2]).text());
          if (codeDesc && total !== null) {
            subareas.push({ codeDesc, heated, total });
            console.log(`  Subarea: ${codeDesc}, Heated: ${heated}, Total: ${total}`);
          }
        }
      });
    } else {
      console.warn(`  Warning: Building Subareas table not found for ${buildingHeaderText}`);
    }

    buildings.push({
      index: i + 1,
      beds,
      full,
      half,
      livingArea: characteristics.livingArea || null,
      totalUnderRoof: characteristics.totalUnderRoof || null,
      yearBuilt: characteristics.yearBuilt || null,
      style: style,
      substructure: substructure,
      frameConstType: frameConstType,
      exteriorWall: exteriorWall,
      roofStructure: roofStructure,
      subareas: subareas,
    });
  });
  console.log(buildings)
  return buildings;
}
function makeLayoutEntries(building, startIndex, parcelId) {
  const layouts = [];
  let idx = startIndex;

  const createBaseLayout = (type, order, specificData = {}) => {
    const space_type = normalizeSpaceType(type);
    const layout = {
      space_type,
      space_index: order,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
      is_finished: false, // Default to false unless explicitly determined
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
      is_exterior: false, // Default to false unless explicitly determined
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
      source_http_request: {
        method: "GET",
        url: "https://www.polkpa.org/CamaDisplay.aspx",
        multiValueQueryString: {
          ParcelID: [parcelId],
          OutputMode: ["Display"],
          SearchType: ["RealEstate"],
        },
      },
      request_identifier: parcelId,
      ...specificData,
    };

    // Infer floor_level from style if available
    if (building.style) {
      if (building.style.includes("1 STORY")) {
        layout.floor_level = "1st Floor";
      } else if (building.style.includes("2 STORY")) {
        layout.floor_level = "2nd Floor";
      }
    }

    return layout;
  };

  // Bedrooms
  for (let i = 0; i < (building.beds || 0); i++) {
    layouts.push(createBaseLayout("Bedroom", idx++));
  }
  // Full Bathrooms
  for (let i = 0; i < (building.full || 0); i++) {
    layouts.push(createBaseLayout("Full Bathroom", idx++));
  }
  // Half Bathrooms
  for (let i = 0; i < (building.half || 0); i++) {
    layouts.push(createBaseLayout("Half Bathroom", idx++));
  }

  // Process subareas for additional spaces
  building.subareas.forEach(sub => {
    const area = sub.total;
    const heated = sub.heated;
    const code = sub.codeDesc;

    if (code.includes("GARAGE")) {
      layouts.push(createBaseLayout("GARAGE", idx++, {
        size_square_feet: area,
        is_finished: !code.includes("UNFINISHED"), // If it's "UNFINISHED GARAGE", then is_finished is false
        is_exterior: true,
      }));
    } else if (code.includes("PORCH")) {
      layouts.push(createBaseLayout("PORCH", idx++, {
        size_square_feet: area,
        is_finished: heated, // If heated, assume finished
        is_exterior: true,
        has_windows: code.includes("SCREEN"), // If it's a "SCREEN PORCH", assume it has windows
      }));
    } else if (code.includes("BASE AREA")) {
      // This is the main living area, often implicitly the "Living Room" or "Great Room"
      // We can infer it's finished and interior.
      layouts.push(createBaseLayout("LIVING ROOM", idx++, {
        size_square_feet: area,
        is_finished: true,
        is_exterior: false,
      }));
    } else if (code.includes("BASE ADDITION AREA")) {
        // Treat additions as part of the main living space for now
        layouts.push(createBaseLayout("LIVING ROOM", idx++, {
            size_square_feet: area,
            is_finished: true,
            is_exterior: false,
        }));
    }
    // Add more conditions for other subarea types if identifiable from the code/description
  });

  return { layouts, nextIndex: idx };
}

function normalizeSpaceType(type) {
  const mapping = {
    "BEDROOM": "Bedroom",
    "FULL BATHROOM": "Full Bathroom", // Changed from "FULL BATH"
    "HALF BATHROOM": "Half Bathroom / Powder Room", // Changed from "HALF BATH"
    "GARAGE": "Attached Garage",
    "PORCH": "Porch",
    "SCREENED PORCH": "Screened Porch",
    "LIVING ROOM": "Living Room",
  };
  // Ensure the input 'type' is converted to uppercase for lookup
  return mapping[type.toUpperCase()] || null;
}

function main() {
  console.log("Starting layout mapping script...");
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  console.log(`Detected Parcel ID: ${parcelId}`);

  const buildings = extractBuildings($);
  console.log(`Extracted ${buildings.length} building(s).`);

  let layouts = [];
  let globalIndex = 1;
  buildings.forEach((b, i) => {
    console.log(`Generating layouts for Building ${i + 1}...`);
    const res = makeLayoutEntries(b, globalIndex, parcelId);
    layouts = layouts.concat(res.layouts);
    globalIndex = res.nextIndex;
  });

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
  console.log("Script finished successfully.");
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in layoutMapping:", err.message);
    console.error(err.stack); // Log the full stack trace for better debugging
    process.exit(1);
  }
}