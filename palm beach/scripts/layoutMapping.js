// layoutMapping.js
// Parses input.html with cheerio and outputs layout data per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

function getText($, selector) {
  const el = $(selector).first();
  return el.length ? el.text().trim() : "";
}

function findValueByLabel($, scope, labelText) {
  let value = "";
  $(scope)
    .find("tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const labelTd = $tr.find("td.label").first();
      const valTd = $tr.find("td.value").first();
      if (labelTd.length && valTd.length) {
        const lbl = labelTd.text().replace(/\s+/g, " ").trim().toLowerCase();
        if (lbl.includes(labelText.toLowerCase())) {
          value = valTd.text().replace(/\s+/g, " ").trim();
          return false;
        }
      }
    });
  return value;
}

function toInt(val) {
  const n = parseInt((val || "").toString().replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function defaultLayout(space_index, overrides = {}) {
  return Object.assign(
    {
      space_type: null,
      space_index,
      story_type: null,
      flooring_material_type: null,
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
      building_number: null,
      request_identifier: null,
      source_http_request: { method: "GET", url: "https://www.pbcgov.org/papa/" },
    },
    overrides,
  );
}

function run() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  // Extract property id
  let pcnText = getText($, "#MainContent_lblPCN");
  if (!pcnText) {
    pcnText = $("td.label:contains('Parcel Control Number')")
      .next(".value")
      .text()
      .trim();
  }
  const propertyId = digitsOnly(pcnText);
  const propKey = `property_${propertyId || "unknown"}`;

  // Structural counts for bedrooms/baths
  // Initialize layouts array
  const layouts = [];
  let space_index = 1;

  // Extract bedroom/bathroom counts from embedded model
  let bedCount = 0;
  let fullBaths = 0;
  let halfBaths = 0;

  // Read HTML file
  const inputHTML = fs.readFileSync("input.html", "utf8");

  // Helper function to map element names to space types
  function mapElementNameToSpaceType(elementName) {
    if (!elementName) return null;
    const name = elementName.toUpperCase();

    // Skip summary elements that shouldn't be individual spaces
    if (name.includes("TOTAL SQUARE FOOTAGE") || name.includes("AREA UNDER AIR")) {
      return null; // Don't create layout items for these summary elements
    }

    if (name.includes("FOP") || name.includes("FINISHED OPEN PORCH")) return "Open Porch";
    if (name.includes("BAS") || name.includes("BASE AREA")) return "Living Area";
    if (name.includes("FGR") || name.includes("FINISHED GARAGE")) return "Attached Garage";
    if (name.includes("GARAGE")) return "Attached Garage";
    if (name.includes("PORCH")) return "Open Porch";
    if (name.includes("DECK")) return "Deck";
    if (name.includes("PATIO")) return "Patio";
    if (name.includes("BALCONY")) return "Balcony";
    if (name.includes("LIVING")) return "Living Area";
    if (name.includes("BEDROOM")) return "Bedroom";
    if (name.includes("BATH")) return "Bathroom";
    if (name.includes("KITCHEN")) return "Kitchen";

    return null;
  }

  // Parse embedded model from HTML (use greedy match to capture entire model)
  const modelMatch = inputHTML.match(/var model = ({.+});/);
  if (modelMatch) {
    try {
      const model = JSON.parse(modelMatch[1]);
      if (model.structuralDetails && Array.isArray(model.structuralDetails.StructuralElements)) {
        // Extract bedroom/bathroom counts
        for (const el of model.structuralDetails.StructuralElements) {
          const name = (el.ElementName || "").trim();
          const val = (el.ElementValue || "").toString().trim();
          if (/Bedroom|Bed Rooms/i.test(name)) bedCount = parseInt(val) || 0;
          if (/Bath\(s\)|Full Baths/i.test(name) && !/Half/i.test(name)) fullBaths = parseInt(val) || 0;
          if (/Half Bath|Half Baths/i.test(name)) halfBaths = parseInt(val) || 0;
        }

        // Extract area-based layout elements (living area, porches, garage, etc.)
        for (const el of model.structuralDetails.StructuralElements) {
          if (el.DetailsSection === "Bottom" && el.BuildingNumber) {
            const buildingNum = parseInt(el.BuildingNumber);
            const spaceType = mapElementNameToSpaceType(el.ElementName);

            // Skip elements that shouldn't be individual spaces
            if (!spaceType) {
              continue;
            }

            const layoutItem = {
              space_type: spaceType,
              space_index: layouts.length + 1,
              size_square_feet: parseInt(el.ElementValue) || null,
              building_number: buildingNum,
              floor_level: null,
              is_exterior: el.ElementName.includes("FOP") || el.ElementName.includes("Porch"),
              is_finished: !el.ElementName.includes("Unfinished"),
              story_type: null,
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
              request_identifier: propertyId || "unknown",
              source_http_request: {
                url: "https://pbcpao.gov/Property/Details",
                method: "GET",
                multiValueQueryString: { parcelId: [propertyId || "unknown"] }
              }
            };

            layouts.push(layoutItem);
          }
        }
      }
    } catch (e) {
      console.log("Error parsing model for layout data:", e.message);
    }
  }

  console.log(`Extracted bedroom/bathroom counts: ${bedCount} bedrooms, ${fullBaths} full baths, ${halfBaths} half baths`);

  // Skip subarea processing to avoid duplication - we're using embedded model data instead

  // Bedrooms
  for (let i = 0; i < bedCount; i++) {
    layouts.push(
      defaultLayout(layouts.length + 1, {
        space_type: "Bedroom",
        size_square_feet: null,
      }),
    );
  }

  // Full bathrooms
  for (let i = 0; i < fullBaths; i++) {
    layouts.push(
      defaultLayout(layouts.length + 1, {
        space_type: "Full Bathroom",
      }),
    );
  }

  // Half bathrooms
  for (let i = 0; i < halfBaths; i++) {
    layouts.push(
      defaultLayout(layouts.length + 1, {
        space_type: "Half Bathroom / Powder Room",
      }),
    );
  }

  // Removed default Living Room and Kitchen additions; keep only detected spaces

  const ownersDir = path.resolve("owners");
  const dataDir = path.resolve("data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Create individual layout files (layout_1.json, layout_2.json, etc.)
  layouts.forEach((layout, index) => {
    const layoutIndex = index + 1;
    const layoutFileName = `layout_${layoutIndex}.json`;

    // Write individual layout file to data directory only
    fs.writeFileSync(
      path.join(dataDir, layoutFileName),
      JSON.stringify(layout, null, 2),
      "utf8",
    );

    // Create relationship file for each layout
    const layoutRel = {
      from: { "/": "./property.json" },
      to: { "/": `./${layoutFileName}` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_property_layout_${layoutIndex}.json`),
      JSON.stringify(layoutRel, null, 2),
      "utf8",
    );
  });

  console.log(
    "Individual layout files written for",
    propKey,
    "with",
    layouts.length,
    "layouts",
  );
}

// Always run when required or executed directly
run();
