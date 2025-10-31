// Structure mapping script
// Reads input.html, parses with cheerio, maps to structure schema, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textAfterStrong($el) {
  // Given a <td><strong>Label</strong>Value</td>, return 'Value'
  const html = $el.html() || "";
  // Remove strong tag with its content
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

function toInt(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return null;
  return Math.round(Number(num));
}

function mapRoofCover(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  if (s.includes("metal")) return "Metal Standing Seam";
  if (s.includes("tile")) return "Clay Tile";
  if (s.includes("slate")) return "Natural Slate";
  if (s.includes("tpo")) return "TPO Membrane";
  if (s.includes("epdm")) return "EPDM Membrane";
  if (s.includes("modified")) return "Modified Bitumen";
  if (s.includes("built")) return "Built-Up Roof";
  if (s.includes("wood")) return "Wood Shingle";
  if (s.includes("comp") || s.includes("composition") || s.includes("shingle"))
    return "3-Tab Asphalt Shingle";
  return null;
}

function normalizeCase(val) {
  return val ? String(val).trim() : null;
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

    // Fallback parse from General Information if not found
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

    // Use Code/Property Class -> attachment type
    let useCodeText = null;
    $("div.table-section.building-table").each((i, sect) => {
      const sectionText = $(sect).text();
      if (sectionText && sectionText.includes("Use Code/Property Class")) {
        $(sect)
          .find("td")
          .each((j, td) => {
            const s = $(td).find("strong").first().text().trim();
            if (/Use Code\/Property Class/i.test(s)) {
              useCodeText = textAfterStrong($(td));
            }
          });
      }
    });

    let attachment_type = null;
    if (useCodeText) {
      const lc = useCodeText.toLowerCase();
      if (lc.includes("attached")) attachment_type = "Attached";
      else if (lc.includes("semi") || lc.includes("duplex"))
        attachment_type = "SemiDetached";
      else if (lc.includes("detached")) attachment_type = "Detached";
    }

    // Number of stories
    let number_of_stories = null;
    $("div.table-section.building-table").each((i, sect) => {
      const sectionText = $(sect).text();
      if (sectionText && sectionText.includes("Max Stories")) {
        $(sect)
          .find("td")
          .each((j, td) => {
            const s = $(td).find("strong").first().text().trim();
            if (/Max Stories/i.test(s)) {
              number_of_stories = parseNumberFromText(textAfterStrong($(td)));
            }
          });
      }
    });

    // Building Information fields
    let wall = null,
      exteriorCover = null,
      roofCover = null,
      finishedArea = null;
    $("div.table-section.building-information td").each((i, el) => {
      const td = $(el);
      const label = td.find("strong").first().text().trim();
      const val = textAfterStrong(td);
      if (/^Wall$/i.test(label)) wall = val;
      if (/^Exterior Cover$/i.test(label)) exteriorCover = val;
      if (/^Roof Cover$/i.test(label)) roofCover = val;
      if (/^Finished Area$/i.test(label))
        finishedArea = parseNumberFromText(val);
    });

    // Areas from sketched legend if needed
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

    const finished_base_area = toInt(dwellArea || finishedArea);

    // Map materials
    let exterior_wall_material_primary = null;
    let exterior_wall_material_secondary = null;
    if (wall && /concrete\s*block/i.test(wall)) {
      exterior_wall_material_primary = "Concrete Block";
    }
    if (exteriorCover && /stucco/i.test(exteriorCover)) {
      exterior_wall_material_secondary = "Stucco Accent";
    }

    const roof_covering_material = mapRoofCover(roofCover);

    // Primary framing material (infer from wall)
    let primary_framing_material = null;
    if (wall && /concrete\s*block/i.test(wall))
      primary_framing_material = "Concrete Block";

    // Compose structure object with required fields, defaulting to null
    const structure = {
      architectural_style_type: null,
      attachment_type: attachment_type || null,
      ceiling_condition: null,
      ceiling_height_average: null,
      ceiling_insulation_type: null,
      ceiling_structure_material: null,
      ceiling_surface_material: null,
      exterior_door_installation_date: null,
      exterior_door_material: null,
      exterior_wall_condition: null,
      exterior_wall_condition_primary: null,
      exterior_wall_condition_secondary: null,
      exterior_wall_insulation_type: null,
      exterior_wall_insulation_type_primary: null,
      exterior_wall_insulation_type_secondary: null,
      exterior_wall_material_primary: exterior_wall_material_primary,
      exterior_wall_material_secondary: exterior_wall_material_secondary,
      finished_base_area: finished_base_area ?? null,
      finished_basement_area: null,
      finished_upper_story_area: number_of_stories === 1 ? 0 : null,
      flooring_condition: null,
      flooring_material_primary: null,
      flooring_material_secondary: null,
      foundation_condition: null,
      foundation_material: null,
      foundation_repair_date: null,
      foundation_type: null,
      foundation_waterproofing: null,
      gutters_condition: null,
      gutters_material: null,
      interior_door_material: null,
      interior_wall_condition: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_structure_material: null,
      interior_wall_structure_material_primary: null,
      interior_wall_structure_material_secondary: null,
      interior_wall_surface_material_primary: null,
      interior_wall_surface_material_secondary: null,
      number_of_stories: number_of_stories ?? null,
      primary_framing_material: primary_framing_material,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: roof_covering_material,
      roof_date: null,
      roof_design_type: null,
      roof_material_type: roof_covering_material ? "Shingle" : null,
      roof_structure_material: null,
      roof_underlayment_type: null,
      secondary_framing_material: null,
      siding_installation_date: null,
      structural_damage_indicators: null,
      subfloor_material: null,
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      window_frame_material: null,
      window_glazing_type: null,
      window_installation_date: null,
      window_operation_type: null,
      window_screen_material: null,
    };

    // Ensure all required fields exist; they are set to null where unknown.

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "structure_data.json");

    const payload = {};
    payload[propertyId] = structure;
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote structure data to ${outPath}`);
  } catch (err) {
    console.error("Error generating structure data:", err.message);
    process.exit(1);
  }
})();
