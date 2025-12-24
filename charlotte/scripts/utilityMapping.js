// Utility mapping script
// Reads input.html, extracts available utility info (none present), and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function parseCharlotteProperty($) {
  return {
    accountNumber: parseAccountNumber($),
    owner: parseOwnerInformation($),
    propertyLocation: parsePropertyLocation($),
    generalParcelInformation: parseGeneralParcelInformation($),
    femaFloodZone: parseCaptionedTable($, 'FEMA Flood Zone'),
    certifiedTaxRollValues: parseCertifiedTaxRollValues($),
    landInformation: parseCaptionedTable($, 'Land Information'),
    landImprovementInformation: parseCaptionedTable($, 'Land Improvement Information'),
    buildingInformation: parseCaptionedTable($, 'Building Information'),
    buildingComponentInformation: parseCaptionedTable($, 'Building Component Information'),
    legalDescription: parseLegalDescription($),
  };
}

function parseOwnerInformation($) {
  const defaultOwner = {
    name: null,
    addressLines: [],
    formattedAddress: null,
    footnote: null,
  };

  const heading = findHeadingByText($, 'Owner:');
  if (!heading.length) {
    return defaultOwner;
  }

  const container = heading.closest('.w3-cell');
  const addressBlock = container.find('.w3-border').first();
  const lines = extractLines(addressBlock);
  const footnote = cleanText(container.find('.prcfootnote').first().text());

  return {
    name: lines[0] || null,
    addressLines: lines.slice(1),
    formattedAddress: lines.length ? lines.join(', ') : null,
    footnote: footnote || null,
  };
}

function parsePropertyLocation($) {
  const defaultLocation = {
    propertyAddress: { lines: [], formatted: null },
    propertyCityZip: null,
    businessName: null,
  };

  const heading = findHeadingByText($, 'Property Location:');
  if (!heading.length) {
    return defaultLocation;
  }

  const container = heading.closest('.w3-cell');
  const rows = container.children('.w3-row');
  if (!rows.length) {
    return defaultLocation;
  }

  const location = { ...defaultLocation };

  rows.each((_, row) => {
    const cells = $(row).find('.w3-cell');
    if (cells.length < 2) {
      return;
    }
    const label = cleanLabel(cells.eq(0).text());
    const valueCell = cells.eq(1);
    if (/property address/i.test(label)) {
      const lines = extractLines(valueCell);
      location.propertyAddress = {
        lines,
        formatted: lines.length ? lines.join(', ') : null,
      };
      return;
    }

    const value = extractSingleLine(valueCell);
    if (/property city/i.test(label)) {
      location.propertyCityZip = value;
    } else if (/business name/i.test(label)) {
      location.businessName = value;
    } else {
      const key = toCamelCase(label);
      if (key) {
        location[key] = value;
      }
    }
  });

  return location;
}

function parseGeneralParcelInformation($) {
  const heading = findHeadingByText($, 'General Parcel Information');
  if (!heading.length) {
    return {};
  }

  const container = heading.nextAll('.w3-border').first();
  if (!container.length) {
    return {};
  }

  const result = {};
  container.find('.w3-row').each((_, row) => {
    const cells = $(row).find('.w3-cell');
    if (cells.length < 2) {
      return;
    }
    const label = cleanLabel(cells.eq(0).text());
    const key = toCamelCase(label);
    if (!key) {
      return;
    }
    const value = extractSingleLine(cells.eq(1));
    result[key] = value;
  });

  return result;
}

function parseLegalDescription($) {
  const heading = findHeadingByText($, 'Legal Description:');
  if (!heading.length) {
    return { shortLegal: null, longLegal: null };
  }

  const row = heading.nextAll('.w3-cell-row').first();
  if (!row.length) {
    return { shortLegal: null, longLegal: null };
  }

  const result = { shortLegal: null, longLegal: null };
  row.find('.w3-container').each((_, column) => {
    const col = $(column);
    const strong = col.find('strong').first();
    const label = cleanLabel(strong.text());
    strong.remove();
    const value = extractSingleLine(col);
    if (/short legal/i.test(label)) {
      result.shortLegal = value;
    } else if (/long legal/i.test(label)) {
      result.longLegal = value;
    }
  });

  return result;
}

function parseCertifiedTaxRollValues($) {
  const parsed = parseCaptionedTable($, 'Certified Tax Roll Values');
  const taxYear = extractYearFromText(parsed.caption);
  return {
    ...parsed,
    taxYear,
  };
}

function parseCaptionedTable($, keyword) {
  if (!keyword) {
    return { caption: null, rows: [] };
  }

  const caption = findCaptionByKeyword($, keyword);
  if (!caption.length) {
    return { caption: null, rows: [] };
  }

  const table = caption.closest('table');
  if (!table.length) {
    return { caption: cleanText(caption.text()), rows: [] };
  }

  const rows = table.find('tr');
  if (!rows.length) {
    return { caption: cleanText(caption.text()), rows: [] };
  }

  const headerRow = rows.first();
  const headerCells = headerRow.find('th').length ? headerRow.find('th') : headerRow.find('td');
  const headers = headerCells
    .map((idx, cell) => {
      const text = cleanLabel($(cell).text());
      const key = toCamelCase(text);
      return key || `column${idx + 1}`;
    })
    .get();

  const dataRows = rows.slice(1);
  const parsedRows = [];
  dataRows.each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) {
      return;
    }
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = extractSingleLine(cells.eq(idx));
    });
    const hasValue = Object.values(record).some((value) => value !== null && value !== '');
    if (hasValue) {
      parsedRows.push(record);
    }
  });

  return {
    caption: cleanText(caption.text()),
    rows: parsedRows,
  };
}

function findHeadingByText($, headingText) {
  if (!headingText) {
    return $();
  }
  const target = headingText.trim().toLowerCase();
  return $('h2')
    .filter((_, el) => cleanText($(el).text()).toLowerCase() === target)
    .first();
}

function findCaptionByKeyword($, keyword) {
  const normalized = keyword.trim().toLowerCase();
  return $('caption.blockcaption')
    .filter((_, el) => cleanText($(el).text()).toLowerCase().includes(normalized))
    .first();
}

function extractLines(element) {
  if (!element || !element.length) {
    return [];
  }

  const clone = element.clone();
  clone.find('br').replaceWith('\n');
  return clone
    .text()
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractSingleLine(element) {
  const lines = extractLines(element);
  if (!lines.length) {
    return null;
  }
  return lines.join(' ').trim() || null;
}

function cleanLabel(text) {
  return cleanText(text).replace(/[:]/g, '').trim();
}

function cleanText(text) {
  if (!text) {
    return '';
  }
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function toCamelCase(text) {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  return cleaned
    .split(' ')
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function extractYearFromText(text) {
  if (!text) {
    return null;
  }
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function parseAccountNumber($) {
  const heading = $('h1')
    .filter((_, el) => /property record information for/i.test($(el).text()))
    .first();
  if (!heading.length) {
    return null;
  }
  const text = cleanText(heading.text());
  const match = text.match(/for\s+([A-Za-z0-9-]+)/i);
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
  const parsed = parseCharlotteProperty($);

  const parcelId = parsed.accountNumber;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");

  const output = {};
  output[propertyKey] = buildUtilityRecord((parsed.buildingInformation && parsed.buildingInformation.rows) ? parsed.buildingInformation.rows : []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data to ${outPath}`);
})();
