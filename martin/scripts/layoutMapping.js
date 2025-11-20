// Layout mapping script - UPDATED
// Reads input.html, parses with cheerio, maps to layout schema, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textAfterStrong($el) {
  const html = $el.html() || "";
  const noStrong = html
      .replace(/<strong>[^<]*<\/strong>/i, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  return cheerio.load(`<div>${noStrong}</div>`)("div").text().trim();
}

function parseNumberFromText(txt) {
  if (!txt) return null;
  const m = (txt + "").replace(/[,\s]/g, "").match(/(-?\d+\.?\d*)/);
  return m ? Number(m[1]) : null;
}

// Map county area codes to space_type
function mapAreaCodeToSpaceType(code, description) {
  const c = code.toUpperCase();
  const d = (description || "").toLowerCase();

  // Dwelling areas
  if (c === "DWELL" || c === "DWELL_U" || c === "DWELL_L") return "Living Area";
  if (c === "ADDN" || c === "ADDN_U") return "Living Area";

  // Garages
  if (c === "ATTGAR") return "Attached Garage";
  if (c === "DETGAR") return "Detached Garage";
  if (c === "ICP") return "Attached Carport";
  if (c === "FLATCP") return "Carport";

  // Porches and outdoor living
  if (c.startsWith("OMP")) return c.includes("_S") ? "Screened Porch" : "Open Porch";
  if (c.startsWith("OFP")) return c.includes("_S") ? "Screened Porch" : "Open Porch";
  if (c.startsWith("EMP")) return "Enclosed Porch";
  if (c.startsWith("EFP")) return "Enclosed Porch";
  if (c === "LANAI") return "Lanai";
  if (c === "SUNROOM" || c === "SOL") return "Sunroom";

  // Decks and patios
  if (c.startsWith("WDDK")) return "Deck";
  if (c.startsWith("COMPDK")) return "Deck";
  if (c === "BRP" || c === "CONCP" || c === "FSP") return "Patio";

  // Balconies
  if (c.startsWith("BALC")) return "Balcony";

  // Utility spaces
  if (c.startsWith("UTILROOM")) return "Laundry Room";
  if (c === "SHED" || c === "UTLSHED") return "Shed";
  if (c === "STGMAINT") return "Storage Room";

  // Pool and spa
  if (c === "POOL") return "Pool Area";
  if (c === "JACUZZI") return "Hot Tub / Spa Area";
  if (c === "SCREENENC") return "Screen Enclosure (Custom)";

  // Outdoor structures
  if (c === "GAZEBO") return "Gazebo";
  if (c === "PERGOLA" || c === "PORTEC") return "Pergola";
  if (c === "TIKIHUT" || c === "COMTIKI") return "Gazebo";
  if (c === "SUMKITCH") return "Outdoor Kitchen";

  // Attic
  if (c.startsWith("A_") || c === "A") return "Attic";

  // Storage
  if (c === "MISC") return "Storage Room";

  // Default to null if not mappable
  return null;
}

// Determine if space is exterior
function isExteriorSpace(code) {
  const c = code.toUpperCase();
  const exteriorCodes = [
    "OMP", "OFP", "BALC", "WDDK", "COMPDK", "BRP", "CONCP", "FSP",
    "POOL", "SCREENENC", "GAZEBO", "PERGOLA", "PORTEC", "TIKIHUT",
    "COMTIKI", "SUMKITCH", "PAV", "PAVING", "LANAI"
  ];
  return exteriorCodes.some(prefix => c.startsWith(prefix));
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    // Extract AIN as property id
    let ain = null;
    $("div.table-section.building-table table tr td").each((i, el) => {
      const td = $(el);
      const strong = td.find("strong").first().text().trim();
      if (/^AIN$/i.test(strong)) {
        ain = textAfterStrong(td);
      }
    });
    if (!ain) {
      $("div.table-section.general-info table tr td table tr td").each(
          (i, el) => {
            const td = $(el);
            const strong = td.find("strong").first().text().trim();
            if (/^Account Number$/i.test(strong)) ain = textAfterStrong(td);
          },
      );
    }
    const propertyId = ain
        ? `property_${String(ain).trim()}`
        : "property_unknown";

    // Bedrooms and bathrooms from Building Information
    let bedrooms = null,
        fullBaths = null,
        halfBaths = null,
        maxStories = 1;

    $("div.table-section.building-table").each((i, sect) => {
      const sectionText = $(sect).text();
      if (sectionText && sectionText.includes("Max Stories")) {
        $(sect)
            .find("td")
            .each((j, td) => {
              const s = $(td).find("strong").first().text().trim();
              const val = textAfterStrong($(td));
              if (/Max Stories/i.test(s))
                maxStories = parseNumberFromText(val) || 1;
            });
      }
    });

    $("div.table-section.building-information td").each((i, el) => {
      const td = $(el);
      const label = td.find("strong").first().text().trim();
      const val = textAfterStrong(td);
      if (/^Bedrooms$/i.test(label)) bedrooms = parseNumberFromText(val);
      if (/^Full Baths$/i.test(label)) fullBaths = parseNumberFromText(val);
      if (/^Half Baths$/i.test(label)) halfBaths = parseNumberFromText(val);
    });

    const layouts = [];
    let spaceIndex = 1;

    // Parse Sketched Area Legend
    const sketchedAreas = [];
    $("div.table-section.features-yard-items").each((i, sect) => {
      const heading = $(sect).find("h2.table-heading").text().trim();
      if (/Sketched Area Legend/i.test(heading)) {
        $(sect)
            .find("table tr")
            .each((j, tr) => {
              if (j === 0) return; // skip header
              const tds = $(tr).find("td");
              if (tds.length >= 4) {
                const code = $(tds.get(0)).text().trim();
                const description = $(tds.get(1)).text().trim();
                const area = parseNumberFromText($(tds.get(2)).text().trim());
                const finishedArea = parseNumberFromText($(tds.get(3)).text().trim());

                if (code && area) {
                  sketchedAreas.push({ code, description, area, finishedArea });
                }
              }
            });
      }
    });

    // Map sketched areas to layout spaces
    sketchedAreas.forEach(area => {
      const spaceType = mapAreaCodeToSpaceType(area.code, area.description);
      if (!spaceType) return; // Skip unmappable codes

      const isExterior = isExteriorSpace(area.code);
      const isFinished = area.finishedArea > 0;

      // Determine floor level from code suffix
      let floorLevel = "1st Floor";
      if (area.code.includes("_U")) floorLevel = "2nd Floor";
      else if (area.code.includes("_L")) floorLevel = "Basement";

      layouts.push({
        space_type: spaceType,
        space_index: spaceIndex++,
        flooring_material_type: null,
        size_square_feet: area.area,
        floor_level: floorLevel,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
        is_finished: isFinished,
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
        pool_type: spaceType === "Pool Area" ? "BuiltIn" : null,
        pool_equipment: null,
        spa_type: spaceType === "Hot Tub / Spa Area" ? "Jacuzzi" : null,
        safety_features: null,
        view_type: null,
        lighting_features: null,
        condition_issues: null,
        is_exterior: isExterior,
        bathroom_renovation_date: null,
        kitchen_renovation_date: null,
        flooring_installation_date: null,
        pool_condition: null,
        pool_surface_type: null,
        pool_water_quality: null,
      });
    });

    // Add bedrooms
    if (bedrooms && bedrooms > 0) {
      for (let i = 1; i <= bedrooms; i++) {
        layouts.push({
          space_type: "Bedroom",
          space_index: spaceIndex++,
          flooring_material_type: null,
          size_square_feet: null,
          floor_level: maxStories > 1 ? "1st Floor" : "1st Floor",
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
          bathroom_renovation_date: null,
          kitchen_renovation_date: null,
          flooring_installation_date: null,
          pool_condition: null,
          pool_surface_type: null,
          pool_water_quality: null,
        });
      }
    }

    // Add bathrooms
    if (fullBaths && fullBaths > 0) {
      for (let i = 1; i <= fullBaths; i++) {
        layouts.push({
          space_type: "Full Bathroom",
          space_index: spaceIndex++,
          flooring_material_type: null,
          size_square_feet: null,
          floor_level: "1st Floor",
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
          bathroom_renovation_date: null,
          kitchen_renovation_date: null,
          flooring_installation_date: null,
          pool_condition: null,
          pool_surface_type: null,
          pool_water_quality: null,
        });
      }
    }

    if (halfBaths && halfBaths > 0) {
      for (let i = 1; i <= halfBaths; i++) {
        layouts.push({
          space_type: "Half Bathroom / Powder Room",
          space_index: spaceIndex++,
          flooring_material_type: null,
          size_square_feet: null,
          floor_level: "1st Floor",
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
          bathroom_renovation_date: null,
          kitchen_renovation_date: null,
          flooring_installation_date: null,
          pool_condition: null,
          pool_surface_type: null,
          pool_water_quality: null,
        });
      }
    }

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "layout_data.json");
    const payload = {};
    payload[propertyId] = { layouts };
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote layout data to ${outPath}`);
  } catch (err) {
    console.error("Error generating layout data:", err.message);
    process.exit(1);
  }
})();