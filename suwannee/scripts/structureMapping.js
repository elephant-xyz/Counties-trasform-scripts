// Structure mapping script
// Reads input.html, parses with cheerio, outputs owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function parseSuwanneeTables($) {

  const buildingsTable = $('#parcelDetails_BldgTable')
    .find('table.parcelDetails_insideTable')
    .first();
  const extraFeaturesTable = $('#parcelDetails_XFOBTable')
    .find('table.parcelDetails_insideTable')
    .first();

  return {
    buildings: parseDataTable($, buildingsTable),
    extraFeatures: parseDataTable($, extraFeaturesTable),
  };
}

function parseDataTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return [];
  }

  const headerCells = rows.first().find('td, th');
  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, cell) => {
      const headerText = $(cell).text().replace(/\*/g, '');
      return normalizeKey(headerText) || `column${idx + 1}`;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < headers.length) {
        return null;
      }

      const record = {};
      let hasValue = false;

      headers.forEach((header, idx) => {
        const cell = cells.eq(idx);
        const value = formatCellValue(cell);
        if (value !== null) {
          hasValue = true;
        }
        record[header] = value;
      });

      return hasValue ? record : null;
    })
    .get()
    .filter(Boolean);
}

function formatCellValue(cell) {
  if (!cell || !cell.length) {
    return null;
  }

  const text = cell
    .text()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    return text;
  }

  const link = cell.find('a').attr('href');
  if (link) {
    return link;
  }

  return null;
}

function normalizeKey(text) {
  if (!text) {
    return '';
  }

  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }

  return cleaned
    .split(' ')
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function toIntRounded(val) {
  if (!val && val !== 0 && val !== "0") {
    return null;
  }
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function buildStructure($) {  
  const suwanneLayouts = parseSuwanneeTables($);
  const buildingsTable = suwanneLayouts["buildings"];
  const structures = {};
  for (let index = 0; index < buildingsTable.length; index++) {
    const building = buildingsTable[index];
    const baseArea = toIntRounded(building["actualSf"]);
    const buildIndex = index + 1;
    structures[buildIndex.toString()] = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: null,
      exterior_wall_material_secondary: null,
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
      roof_covering_material: null,
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: null,
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: null,
      foundation_type: null,
      foundation_material: null,
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
      finished_base_area: baseArea,
      finished_upper_story_area: null,
      roof_date: null,
      exterior_wall_condition_primary: null,
      exterior_wall_condition_secondary: null,
      exterior_wall_insulation_type_primary: null,
      exterior_wall_insulation_type_secondary: null,
      finished_basement_area: null,
      foundation_repair_date: null,
      siding_installation_date: null,
      exterior_door_installation_date: null,
      window_installation_date: null,
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      number_of_stories: null,
    };
  }

  return structures;
}

function main() {
  const $ = loadHtml();
  const parcelId = extractParcelId($);

  const structure = buildStructure($);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = structure;

  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating structure data:", e.message);
    process.exit(1);
  }
}
