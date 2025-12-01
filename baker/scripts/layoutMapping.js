// Layout mapping script
// Reads input.html, extracts building rows and creates layout entries, writes owners/layout_data.json

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

function baseLayoutDefaults() {
  return {
    // Required fields per schema (allowing null where permitted)
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
    size_square_feet: null,
  };
}

function parseIntOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseInt(normalized, 10);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function makeLayoutEntries(building, bIdx) {
  const layouts = [];
  let noOfFloors = inferFloorLevel(building);

  return layouts;
}

function extractLayouts(parsed) {
  let buildings = parsed.buildingInformation || [];
  let layouts = [];
  buildings.forEach((building, index) => {
    const buildIndex = index + 1;
    layouts.push(Object.assign(baseLayoutDefaults(), {
      space_type: "Building",
      space_type_index: buildIndex.toString(),
      total_area_sq_ft: parseIntOrNull(building.effectiveArea),
      heated_area_sq_ft: parseIntOrNull(building.heatedArea),
      built_year: parseIntOrNull(building.yrBuilt),
      building_number: buildIndex,
      is_finished: true,
    }));
  });

  return layouts;
}


(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const parsed = parseBakerDetails($);

  const parcelId =
    $("h4#detailsnum .colorparcel").first().text().trim() || null;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const layouts = extractLayouts(parsed);

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");

  const output = {};
  output[propertyKey] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data to ${outPath}`);
})();
