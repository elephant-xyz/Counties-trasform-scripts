// Layout mapping script
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
      finishedArea = null,
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
      if (/^Finished Area$/i.test(label))
        finishedArea = parseNumberFromText(val);
    });

    // Dwell area from legend for precise size
    let dwellArea = null;
    $("div.table-section.features-yard-items").each((i, sect) => {
      const heading = $(sect).find("h2.table-heading").text().trim();
      if (/Sketched Area Legend/i.test(heading)) {
        $(sect)
          .find("table tr")
          .each((j, tr) => {
            const tds = $(tr).find("td");
            const code = $(tds.get(0)).text().trim();
            const areaText = $(tds.get(2)).text().trim();
            if (code === "DWELL") {
              dwellArea = parseNumberFromText(areaText);
            }
          });
      }
    });

    const totalSF = dwellArea || finishedArea || null;

    // Build layout objects: one per bedroom and per bathroom (full and half), as requested.
    const layouts = [];
    let spaceIndex = 1;

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

    // Optionally include a general living area if finished area is present
    if (totalSF) {
      layouts.unshift({
        space_type: "Living Room",
        space_index: 1,
        flooring_material_type: null,
        size_square_feet: totalSF,
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
      // Reindex the rest
      for (let i = 1; i < layouts.length; i++) {
        layouts[i].space_index = i + 1;
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
