// Structure mapping script
// Reads input.html, extracts parcel and building info, and writes owners/structure_data.json

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
  const parsed = parseCharlotteProperty($);

  const parcelId = parsed.accountNumber;
  const propertyKey = parcelId ? `property_${parcelId}` : "property_unknown";

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const output = {};
  output[propertyKey] = buildStructureRecord((parsed.buildingInformation && parsed.buildingInformation.rows) ? parsed.buildingInformation.rows : []);

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data to ${outPath}`);
})();
