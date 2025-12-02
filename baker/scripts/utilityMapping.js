// Utility mapping script
// Reads input.html, extracts available utility info (none present), and writes owners/utilities_data.json

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

function buildUtilityRecord(buildings) {
  let utilities = {};
  buildings.forEach((building, bIdx) => {
    const util = {
      cooling_system_type: null,
      heating_system_type: null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      hvac_unit_issues: null,
      electrical_panel_installation_date: null,
      electrical_rewire_date: null,
      hvac_capacity_kw: null,
      hvac_capacity_tons: null,
      hvac_equipment_component: null,
      hvac_equipment_manufacturer: null,
      hvac_equipment_model: null,
      hvac_installation_date: null,
      hvac_seer_rating: null,
      hvac_system_configuration: null,
      plumbing_system_installation_date: null,
      sewer_connection_date: null,
      solar_installation_date: null,
      solar_inverter_installation_date: null,
      solar_inverter_manufacturer: null,
      solar_inverter_model: null,
      water_connection_date: null,
      water_heater_installation_date: null,
      water_heater_manufacturer: null,
      water_heater_model: null,
      well_installation_date: null,
    };
    utilities[(bIdx + 1).toString()] = util;
  });
  return utilities;
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
  const outPath = path.join(outDir, "utilities_data.json");

  const output = {};
  output[propertyKey] = buildUtilityRecord(parsed.buildingInformation || []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data to ${outPath}`);
})();
