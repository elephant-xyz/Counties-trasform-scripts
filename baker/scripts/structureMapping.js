// Structure mapping script
// Reads input.html, extracts parcel and building info, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseBakerDetails($) {

  const ownerPropertyInformation = parseLabelValueSection($, '#ownerinfo .mailingadd', '.subhead');
  const valueInformation = parseLabelValueSection($, '#valuedata .mailingadd', '.subhead_val');
  valueInformation.applicableYear = extractValueYear($);
  const buildingTable = findTableByHeading($, 'Building Information');
  const extraFeaturesTable = findTableByHeading($, 'Extra Features');
  const salesTable = findTableByHeading($, 'Recents Sales and Transactions');

  return {
    ownerPropertyInformation,
    valueInformation,
    buildingInformation: parseTable($, buildingTable),
    extraFeatures: parseTable($, extraFeaturesTable),
    recentSalesAndTransactions: parseTable($, salesTable, { includeRowLink: true }),
  };
}

function parseLabelValueSection($, rowSelector, labelSelector) {
  const rows = $(rowSelector);
  if (!rows.length) {
    return {};
  }

  const data = {};
  rows.each((_, row) => {
    const label = cleanLabel($(row).find(labelSelector).first().text());
    if (!label) {
      return;
    }

    const value = extractText($(row).find('.mailwrapper').first());
    data[normalizeKey(label)] = value;
  });

  return data;
}

function parseTable($, table, options = {}) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return [];
  }

  const headers = rows
    .first()
    .find('th, td')
    .map((idx, cell) => {
      const headerText = cleanLabel($(cell).text());
      if (headerText === '#') {
        return 'number';
      }
      return normalizeKey(headerText) || `column${idx + 1}`;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      if (!cells.length) {
        return null;
      }

      const record = {};
      headers.forEach((header, idx) => {
        if (!header) {
          return;
        }
        record[header] = formatCellValue(cells.eq(idx));
      });

      if (options.includeRowLink) {
        const link = extractLink($(row).attr('onclick'));
        if (link) {
          record.documentUrl = link;
        }
      }

      return Object.values(record).some((value) => value !== null && value !== '')
        ? record
        : null;
    })
    .get()
    .filter(Boolean);
}

function findTableByHeading($, headingText) {
  if (!headingText) {
    return null;
  }

  const normalizedHeading = headingText.trim().toLowerCase();
  const heading = $('h4.subhead2')
    .filter((_, el) => $(el).text().trim().toLowerCase() === normalizedHeading)
    .first();

  if (!heading.length) {
    return null;
  }

  const responsiveWrapper = heading.nextAll('div.table-responsive').first();
  if (!responsiveWrapper.length) {
    return null;
  }

  const table = responsiveWrapper.find('table').first();
  return table.length ? table : null;
}

function cleanLabel(text) {
  if (!text) {
    return '';
  }
  return text.replace(/\u00A0/g, ' ').replace(/[:]/g, '').replace(/\s+/g, ' ').trim();
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
    .map((part, idx) => {
      const lower = part.toLowerCase();
      if (idx === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function extractText(element) {
  if (!element || !element.length) {
    return null;
  }

  const clone = element.clone();
  clone.find('br').replaceWith('\n');

  const rawText = clone
    .text()
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return rawText || null;
}

function formatCellValue(cell) {
  if (!cell || !cell.length) {
    return null;
  }
  const text = cell.text().replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

function extractValueYear($) {
  const disclaimer = $('#valueinfo')
    .nextAll('span')
    .filter((_, el) => $(el).text().trim())
    .first();
  if (!disclaimer.length) {
    return null;
  }

  const text = disclaimer.text();
  const match = text.match(/(\d{4})/);
  return match ? match[1] : null;
}

function extractLink(onClickValue) {
  if (!onClickValue) {
    return null;
  }

  const match = onClickValue.match(/['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function buildStructureRecord(buildings) {
  let structures = {};
  buildings.forEach((b, bIdx) => {
    const structure = {
      architectural_style_type: null,
      attachment_type: null,
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
      exterior_wall_material_primary: null,
      exterior_wall_material_secondary: null,
      finished_base_area: null,
      finished_basement_area: null,
      finished_upper_story_area: null,
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
      number_of_stories: null,
      primary_framing_material: null,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: null,
      roof_date: null,
      roof_design_type: null,
      roof_material_type: null,
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
    structures[(bIdx + 1).toString()] = structure;
  });

  return structures;
}


(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parsed = parseBakerDetails($);

  const parcelId =
    $("h4#detailsnum .colorparcel").first().text().trim() || null;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const output = {};
  output[propertyKey] = buildStructureRecord(parsed.buildingInformation || []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data to ${outPath}`);
})();
