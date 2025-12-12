// scripts/data_extractor.js
// Extraction script per evaluator workflow
// Reads: input.html, unnormalized_address.json, property_seed.json, owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// Writes: JSON outputs to ./data

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(text) {
  if (!text) return null;
  // Remove all non-digit and non-decimal point characters.
  // Crucially, the '-' is removed from the allowed characters.
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Take the absolute value to ensure it's non-negative,
  // then round to at most 2 decimal places.
  return parseFloat(Math.abs(n).toFixed(2));
}

// CORRECTED HELPER FUNCTION: Extracts only digits (removing commas) and returns as a string
function extractNumberAsString(text) {
  if (!text) return null;
  // Remove all non-digit characters (including commas, spaces, letters)
  const cleaned = String(text).replace(/\D/g, '');
  return cleaned || null; // Return null if no digits are found after cleaning
}

// Helper function to capitalize the first letter of each word
function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseCharlotteProperty($) {
  return {
    accountNumber: parseAccountNumber($),
    owner: parseOwnerInformation($),
    propertyLocation: parsePropertyLocation($),
    generalParcelInformation: parseGeneralParcelInformation($),
    femaFloodZone: parseCaptionedTable($, 'FEMA Flood Zone'),
    certifiedTaxRollValues: parseCertifiedTaxRollValues($),
    salesInformation: parseSalesInformation($),
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

function parseSalesInformation($) {
  const heading = findHeadingByText($, 'Sales Information');
  if (!heading.length) {
    return { heading: null, rows: [] };
  }

  const responsiveWrapper = heading.nextAll('.w3-responsive').first();
  const table = responsiveWrapper.length ? responsiveWrapper.find('table').first() : $();
  if (!table.length) {
    return { heading: cleanText(heading.text()), rows: [] };
  }

  const headerRow = table.find('thead tr').first().length
    ? table.find('thead tr').first()
    : table.find('tr').first();
  if (!headerRow.length) {
    return { heading: cleanText(heading.text()), rows: [] };
  }

  const headers = headerRow
    .find('th, td')
    .map((idx, cell) => {
      const text = cleanLabel($(cell).text());
      return toCamelCase(text) || `column${idx + 1}`;
    })
    .get();

  let dataRows = table.find('tbody tr');
  if (!dataRows.length) {
    const allRows = table.find('tr');
    dataRows = allRows.slice(1);
  }

  const rows = [];
  dataRows.each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) {
      return;
    }
    const record = {};
    headers.forEach((header, idx) => {
      const cell = cells.eq(idx);
      record[header] = extractSingleLine(cell);
      const link = cell.find('a[href]').first();
      if (link.length) {
        record[`${header}Url`] = link.attr('href') || null;
      }
    });
    const hasData = Object.values(record).some((value) => value !== null && value !== '');
    if (hasData) {
      rows.push(record);
    }
  });

  return {
    heading: cleanText(heading.text()),
    rows,
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

const propertyTypeMapping = [
  {
    "property_usecode": "0100 - Single Family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101 - Single Family Determined Damaged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0102 - Single Family/Cluster Home",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0105 - Residential with office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0106 - Modular Home/Single Family Use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0108 - Single Family Residence with Guest/Separate Living Unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - Mobile Homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0201 - Mobile Home Determined Damaged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0204 - Mobile Homes on a Land Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0205 - Travel Trailer",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingSingleWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0300 - Multi-family 10 units or more",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0400 - Residential Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0401 - Residential Condominium Determined Damaged",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0403 - Zero Lot Lines",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0404 - Garage Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0405 - Boat Slip Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0600 - Retirement Homes (not eligible for exemption under 196.192)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0601 - Residential ACLF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0700 - Miscellaneous Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0701 - Miscellaneous Building Determined Damaged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 - Duplex 2 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801 - Triplex 3 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0802 - Quadraplex 4 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0803 - Pentaplex 5 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0804 - Sexaplex 6 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0805 - Septaplex 7 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0806 - Octaplex 8 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0807 - Nonaplex 9 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0810 - Multi-family Determined Damaged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0813 - Split Duplex",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0814 - Multi-End Unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0815 - Multi-Interior Unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0902 - Residential Subdivision Common Element/Area",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0908 - Residential Condominium Common Element",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 - Stores, one story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1101 - Retail Store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1102 - Retail Store mixed business",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1103 - Multi Story Retail M",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 - Retail Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1105 - Commercial Building on Land Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1110 - Any Commercial Building Determined Damaged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1170 - Miscellaneous Commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1178 - Commercial Common Element",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1198 - Convenient store with gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1199 - Convenient store without gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1200 - Mixed use store and office or store and residential or residential combination",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1201 - Mixed Store and Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1202 - Commercial Condominium Determined Damaged",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1203 - Shell Commercial Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1300 - Department Stores",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1301 - Department Store with Separate Account",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1302 - Discount Store with Separate Account",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1400 - Supermarkets",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1401 - Free Standing Drug Store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1402 - Free Standing Supermarket",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500 - Regional Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 - Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1601 - Community Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1602 - Neighborhood Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 - Office Buildings non-professional services buildings, one story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1701 - Office Building 100%",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1702 - Office BuildingWarehouse",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1800 - Office Buildings non-professional services buildings, multi-story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1801 - Multi-Story Professional",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1802 - Multi-Story Medical",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1803 - Multi-Story with Bank 1st Floor",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900 - Professional services buildings",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1901 - Medical Service Offices",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1902 - Professional Service Offices",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1903 - Mixed Medical / Professional Offices",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1904 - Animal Hospital",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1905 - Animal Kennel",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1906 - Professional Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1907 - Medical Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2000 - Airports (private or commercial) bus terminals, marine terminals, piers, marinas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2001 - Dry Boat Storage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2002 - Boat House",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2003 - Condo Airport Hangar",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2100 - Restaurants, cafeterias",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200 - Drive-in restaurants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 - Financial institutions (banks, savings and loan companies, mortgage companies, credit services)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2400 - Insurance company offices",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 - Repair service shops (excluding automotive), radio and T. V. repair, refrigeration service, electric repair, laundries, laundromats",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2501 - Work Shops",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 - Service Stations",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2601 - Gas Island Canopies",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 - Auto sales, auto repair and storage, auto service shop, body and fender shops, commercial garages, farm and machinery sales and services, auto rental, marine equipment, mobile home sales, motorcycles, construction vehicle sales",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 - Mobile Home Parks/RV Parks",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2801 - Parking lots (commercial or patron)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2802 - Mobile Home Park Recreation Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2803 - Mobile Home Park Laundry Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2804 - Mobile Home Park Rest Room Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2805 - Mobile Home Park Shuffle Board Canopies",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2806 - Mobile Home Park Pump House",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2807 - Mobile Home Park Gazebo s",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2808 - Mobile Home / RV Park Amenities included in the per site valu",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2900 - Wholesale outlets, produce houses, manufacturing outlets",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 - Florist, greenhouses",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3100 - Drive-in theaters, open stadiums",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 - Enclosed theaters, enclosed stadiums",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 - Nightclubs, cocktail lounges, bars",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 - Bowling alleys, skating rinks, pool halls, enclosed arenas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3409 - Modular Office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "3410 - Modular Classroom",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "3500 - Tourist attractions, permanent exhibits, other entertainment facilities, fairgrounds (privately owned)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3501 - Concession Stands",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3502 - Dugout",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3503 - Press Boxes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3504 - Picnic Shelters",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3505 - Health Club/Tennis Courts",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 - Camps",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3700 - Race tracks: horse, auto, or dog",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3800 - Golf courses, driving ranges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3801 - Golf Pro Shop",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3802 - Golf Country Club Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3803 - Golf Carts Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3804 - Storage Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3805 - Maintenance Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3900 - Hotels, motels",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3901 - Timesharing",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4100 - Light manufacturing, small equipment, manufacturing plants, small machine shops, instrument manufacturing printing plants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4200 - Heavy industrial, heavy equipment manufacturing, large machine shops, foundries, steel fabricating plants, auto or aircraft plants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 - Lumber yards, sawmills, planing mills",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400 - Packing plants, fruit and vegetable packing plants, meat packing plants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "4500 - Canneries, fruit and vegetable, bottlers and brewers distilleries, wineries",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4600 - Other food processing, candy factories, bakeries, potato chip factories",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700 - Mineral processing, phosphate processing, cement plants, refineries, clay plants, rock and gravel plants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 - Warehousing, distribution terminals, trucking terminals, van and storage warehousing",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801 - Warehouse Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4802 - Flex Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4810 - Mini Storage / Warehouse",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900 - Open storage, new and used building supplies, junk yards, auto wrecking, fuel storage, equipment and material storage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4901 - Bridges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4902 - Water Towers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "4903 - Tunnels",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4904 - Water Tank, Steel",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "4905 - Water Tank, Conc",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "5000 - Improved Farm",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5001 - Agricultural Pole Barn-1 enclosed side",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5002 - Agricultural Pole Barn-2 enclosed sides",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5003 - Agricultural Pole Barn-3 enclosed sides",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5004 - Agricultural Pole Barn-no enclosed sides",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "7100 - Churches",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 - Private schools and colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300 - Privately owned hospitals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 - Homes for the aged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500 - Orphanages, other non-profit or charitable services",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600 - Mortuaries, cemeteries, crematoriums",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7601 - Mausoleums, Crypts, Niches Conveyed",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700 - Clubs, lodges, union halls",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800 - Sanitariums, convalescent and rest homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "7900 - Cultural organizations, facilities",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8100 - Military",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "8200 - Forest, parks, recreational areas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8300 - Public county schools - include all property of Board of Public",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8301 - Covered Walkway",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8302 - Covered Canopies",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8305 - Public Educational Support Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 - Colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8405 - Private Educational Support Building",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500 - Hospitals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600 - Counties (other than public schools, colleges, hospitals) including non-municipal local governments",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8700 - State other than military, forests, parks, recreational areas, hospitals, colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8800 - Federal other than military, forests, parks, recreational areas, hospitals, colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8900 - Municipal other than parks, recreational areas, colleges, hospitals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9100 - Utility, gas and electricity, telephone and telegraph, locally assessed railroads, water and sewer service, pipelines, canals, radio/television communication",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  }
]

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }

  const normalizedUseCode = entry.property_usecode.match(/\d{4}/)[0];

  if (!normalizedUseCode) {
    return lookup;
  }

  lookup[normalizedUseCode] = entry;
  return lookup;
}, {});

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;

  const normalizedInput = String(code).match(/\d{4}/)[0];
  if (!normalizedInput) return null;

  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
  }

  return null;
}

function extractProperty(parsed, seed) {

  // ATTEMPT 1: Map from "Property (DOR) Use Code" using the provided PDF logic
  let dorUseCode = null;
  if (parsed.landInformation && parsed.landInformation.rows && parsed.landInformation.rows[0]) {
    dorUseCode = parsed.landInformation.rows[0].landUse;
  }
  const propertyMapping = mapPropertyTypeFromUseCode(dorUseCode);
  if (!propertyMapping) {
    throw {
      type: "error",
      message: `Unknown enum value ${dorUseCode}.`,
      path: "property.property_type",
    };
  }
  let legalDescriptionText = null;
  if (parsed.legalDescription && parsed.legalDescription.longLegal) {
    legalDescriptionText = parsed.legalDescription.longLegal;
  }

  // Parcel identifier
  const parcel_identifier =
    seed && (seed.parcel_id || seed.request_identifier)
      ? String(seed.parcel_id || seed.request_identifier)
      : null;
  const property = {
    parcel_identifier,
    property_legal_description_text: legalDescriptionText,
    property_structure_built_year: null,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    number_of_units: null,
    subdivision: null,
    zoning: parsed.generalParcelInformation?.zoningCode ?? null,
  };
  return property;
}

function extractTaxCurrent(parsed) {
  if (!parsed.valueInformation) {
    return null;
  }
  const tax_year = parsed.valueInformation.applicableYear ?? null;

  const property_market_value_amount = parsed.valueInformation.totalJustValue ?? null;
  const property_assessed_value_amount = parsed.valueInformation.assessedValueNonSchool ?? null;
  const property_building_amount = parsed.valueInformation.buildingValue ?? null;
  const property_land_amount = parsed.valueInformation.landValue ?? null;
  const county_taxable_value_amount = parsed.valueInformation.taxableValueCounty ?? null;
  const school_taxable_value_amount = parsed.valueInformation.taxableValueSchool ?? null;
  const property_exemption_amount = parsed.valueInformation.exemptionValueCounty ?? null;

  return {
    tax_year,
    property_market_value_amount,
    property_assessed_value_amount,
    property_building_amount,
    property_land_amount,
    county_taxable_value_amount,
    school_taxable_value_amount,
    property_exemption_amount,
    monthly_tax_amount: null,
    period_end_date: null,
    period_start_date: null,
  };
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "A") return "Miscellaneous";
  if (u === "AS") return "Assignment of Contract";
  if (u === "CT") return "Miscellaneous";
  if (u === "C") return "Correction Deed";
  if (u === "F") return "Miscellaneous";
  if (u === "L") return "Life Estate Deed";
  if (u === "M") return "Miscellaneous";
  if (u === "X") return "Miscellaneous";
  if (u === "Q") return "Quitclaim Deed";
  if (u === "R") return "Miscellaneous";
  if (u === "RF") return "Miscellaneous";
  if (u === "T") return "Tax Deed";
  if (u === "TQ") return "Trustee's Deed";
  if (u === "W") return "Warranty Deed";
  if (u === "CT") return "Contract for Deed";
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "TAX DEED") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u == "QUIT CLAIM") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return "Miscellaneous";
}

function buildPersonsAndCompanies(ownerJSON, parcelId) {
  const res = {
    persons: [],
    companies: [],
    personIndexByKey: new Map(),
    companyIndexByName: new Map(),
    personCurrentOwners: [],
    companyCurrentOwners: []
  };
  if (!ownerJSON) return res;
  const key = `property_${parcelId}`;
  const obj = ownerJSON[key];
  if (!obj || !obj.owners_by_date) return res;

  // Current owners first
  const current = obj.owners_by_date["current"] || [];
  current.forEach((o) => {
    if (o.type === "person") {
      const firstName = toTitleCase(o.first_name); // Apply title case
      const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
      const lastName = toTitleCase(o.last_name); // Apply title case
      const personKey = `${firstName}|${middleName || ""}|${lastName}`;
      if (!res.personIndexByKey.has(personKey)) {
        res.persons.push({
          birth_date: null,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        });
        res.personCurrentOwners.push(res.persons.length); // 1-based
        res.personIndexByKey.set(personKey, res.persons.length); // 1-based
      }
    } else if (o.type === "company") {
      const name = (o.name || "").trim();
      if (name && !res.companyIndexByName.has(name)) {
        res.companies.push({ name });
        res.companyCurrentOwners.push(res.companies.length); // 1-based
        res.companyIndexByName.set(name, res.companies.length);
      }
    }
  });

  // Historical owners
  Object.entries(obj.owners_by_date).forEach(([dt, owners]) => {
    if (dt === "current") return;
    (owners || []).forEach((o) => {
      if (o.type === "person") {
        const firstName = toTitleCase(o.first_name); // Apply title case
        const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
        const lastName = toTitleCase(o.last_name); // Apply title case
        const personKey = `${firstName}|${middleName || ""}|${lastName}`;
        if (!res.personIndexByKey.has(personKey)) {
          res.persons.push({
            birth_date: null,
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
          res.personIndexByKey.set(personKey, res.persons.length);
        }
      } else if (o.type === "company") {
        const name = (o.name || "").trim();
        if (name && !res.companyIndexByName.has(name)) {
          res.companies.push({ name });
          res.companyIndexByName.set(name, res.companies.length);
        }
      }
    });
  });

  return res;
}

function normalizeNameForMatch(str) {
  return (str || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function extractLot(parsed) {
  let acreage = 0;
  if (parsed.landInformation && parsed.landInformation.rows) {
    parsed.landInformation.rows.forEach((landInfo, index) => {
      acreage += parseNumber(landInfo.acreage);
    });
  }
  if (acreage === 0) {
    acreage = null;
  }
  if (acreage === null) {
    return null;
  }
  let lot_type = null;
  if (acreage && acreage > 0.25) {
    lot_type = "GreaterThanOneQuarterAcre";
  } else {
    lot_type = "LessThanOrEqualToOneQuarterAcre";
  }
  return {
    lot_type: lot_type ?? null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: Math.round(acreage * 43560),
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
}

function extractAddressText(parsed) {
  if (parsed.propertyLocation?.propertyAddress?.lines && parsed.propertyLocation?.propertyAddress?.lines[0]) {
    return parsed.propertyLocation?.propertyAddress?.lines[0];
  }
  return null;
}

function extractOwnerMailingAddress(parsed) {
  if (parsed.owner?.addressLines) {
    return parsed.owner?.addressLines.join(", ");
  }
  return null;
}

function extractSecTwpRng(parsed) {
  let value = parsed.generalParcelInformation?.sectionTownshipRange;
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function attemptWriteAddress(unnorm, siteAddress, mailingAddress, secTwpRng) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  if (mailingAddress) {
    const mailingAddressObj = {
      unnormalized_address: mailingAddress,
    };
    writeJSON(path.join("data", "mailing_address.json"), mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const addressObj = {
      county_name,
    // latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
    // longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
      township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
      range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
      section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
      unnormalized_address: siteAddress,
    };
    writeJSON(path.join("data", "address.json"), addressObj);
    writeJSON(path.join("data", "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  }
  return hasOwnerMailingAddress;
}
/**
 * Minimal Geometry model that mirrors the Elephant Geometry class.
 */
class Geometry {
  constructor({ latitude, longitude, polygon }) {
    this.latitude = latitude ?? null;
    this.longitude = longitude ?? null;
    this.polygon = polygon ?? null;
  }

  /**
   * Build a Geometry instance from a CSV record.
   */
  static fromRecord(record) {
    return new Geometry({
      latitude: toNumber(record.latitude),
      longitude: toNumber(record.longitude),
      polygon: parsePolygon(
        record.parcel_polygon
      )
    });
  }
}

const NORMALIZE_EOL_REGEX = /\r\n/g;

function parseCsv(content) {
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === '"') {
      if (insideQuotes && content[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parsePolygon(value) {
  if (!value) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (isGeoJsonGeometry(parsed)) {
    return parsed;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const depth = coordinatesDepth(parsed);
  if (depth === 4) {
    return { type: 'MultiPolygon', coordinates: parsed };
  }

  if (depth === 3) {
    return { type: 'Polygon', coordinates: parsed };
  }

  if (depth === 2) {
    return { type: 'Polygon', coordinates: [parsed] };
  }

  return null;
}

function coordinatesDepth(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return 0;
  }

  return 1 + coordinatesDepth(value[0]);
}

function isGeoJsonGeometry(value) {
  return (
    value &&
    typeof value === 'object' &&
    (value.type === 'Polygon' || value.type === 'MultiPolygon') &&
    Array.isArray(value.coordinates)
  );
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function splitGeometry(record) {
  const baseGeometry = Geometry.fromRecord(record);
  const { polygon } = baseGeometry;

  if (!polygon || polygon.type !== 'MultiPolygon') {
    return [baseGeometry];
  }

  return polygon.coordinates.map((coords, index) => {
    const identifier = baseGeometry.request_identifier
      ? `${baseGeometry.request_identifier}#${index + 1}`
      : null;

    return new Geometry({
      latitude: baseGeometry.latitude,
      longitude: baseGeometry.longitude,
      polygon: {
        type: 'Polygon',
        coordinates: coords,
      },
      request_identifier: identifier,
    });
  });
}

/**
 * Read the provided CSV file (defaults to ./input.csv) and return Geometry instances.
 */
function createGeometryInstances(csvContent) {

  const rows = parseCsv(csvContent.replace(NORMALIZE_EOL_REGEX, '\n'));

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((values) =>
    headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {})
  );

  return records.flatMap((record) => splitGeometry(record));
}

function createGeometryClass(geometryInstances) {
  let geomIndex = 1;
  for(let geom of geometryInstances) {
    let polygon = [];
    let geometry = {
      "latitude": geom.latitude,
      "longitude": geom.longitude,
    }
    if (geom && geom.polygon) {
      for (const coordinate of geom.polygon.coordinates[0]) {
        polygon.push({"longitude": coordinate[0], "latitude": coordinate[1]})
      }
      geometry.polygon = polygon;
    }
    writeJSON(path.join("data", `geometry_${geomIndex}.json`), geometry);
    writeJSON(path.join("data", `relationship_parcel_to_geometry_${geomIndex}.json`), {
        from: { "/": `./parcel.json` },
        to: { "/": `./geometry_${geomIndex}.json` },
    });
    geomIndex++;
  }
}

function convertDateFormat(dateString) {
  // Split the date string by the '/' delimiter
  const parts = dateString.split('/');

  // Check if the date string has the expected format (MM/DD/YYYY)
  if (parts.length === 3) {
    const month = parts[0];
    const day = parts[1];
    const year = parts[2];

    // Return the date in YYYY-MM-DD format
    return `${year}-${month}-${day}`;
  } else {
    // Handle invalid date format or return null/throw an error
    console.error("Invalid date format. Expected 'MM/DD/YYYY'.");
    return null; // Or throw new Error("Invalid date format");
  }
}

function convertBookPage(bookPageString) {
  let bookPage = {
    book: null,
    page: null,
  };
  if (!bookPageString) {
    return bookPage;
  }
  const parts = bookPageString.split('/');
  return {
    book: parts[0],
    page: parts[1],
  };
}

function main() {
  const inputHtmlPath = path.join("input.html");
  const unaddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unaddr = readJSON(unaddrPath) || {};
  const seed = readJSON(seedPath) || {};
  const ownerJSON = readJSON(ownerPath) || {};
  const utilitiesData = readJSON(utilitiesPath) || {};
  const layoutData = readJSON(layoutPath) || {};
  const structureData = readJSON(structurePath) || {};

  ensureDir("data");

  const parcelId =
    seed.request_identifier ||
    seed.parcel_id ||
    unaddr.request_identifier ||
    "";
  const key = `property_${parcelId}`;
  try {
    const seedCsvPath = path.join(".", "input.csv");
    const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
    createGeometryClass(createGeometryInstances(seedCsv));
  } catch (e) {
    const latitude = unaddr && unaddr.latitude ? unaddr.latitude : null;
    const longitude = unaddr && unaddr.longitude ? unaddr.longitude : null;
    if (latitude && longitude) {
      const coordinate = new Geometry({
        latitude: latitude,
        longitude: longitude
      });
      createGeometryClass([coordinate]);
    }
  }
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  let util = null;
  if (utilitiesData) {
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }
  const parsed = parseCharlotteProperty($);

  // Property
  const property = extractProperty(parsed, seed);
  writeJSON(path.join("data", "property.json"), property);
  writeJSON(path.join("data", "parcel.json"), {parcel_identifier: parcelId || ""});

  const addressText = extractAddressText(parsed);
  const mailingAddress = extractOwnerMailingAddress(parsed);
  const sectionTownshipRange = extractSecTwpRng(parsed);
  const hasOwnerMailingAddress = attemptWriteAddress(unaddr, addressText, mailingAddress, sectionTownshipRange);

  // Lot
  const lot = extractLot(parsed);
  if (lot) {
    writeJSON(path.join("data", "lot.json"), lot);
  }
  // Tax current year (from Value Summary)
  // const taxCurrent = extractTaxCurrent(parsed);
  // if (taxCurrent && taxCurrent.tax_year) {
  //   writeJSON(path.join("data", `tax_${taxCurrent.tax_year}.json`), taxCurrent);
  // }

  // Sales
  const sales = parsed.salesInformation?.rows;
  if (sales) {
    //   "recentSalesAndTransactions": [
    //   {
    //     "number": "1",
    //     "dateOfSale": "1980-02-01",
    //     "instrumentType": "WD",
    //     "qualificationCode": null,
    //     "vacImp": "V",
    //     "orBook": "60",
    //     "orPage": "143",
    //     "price": "$60,000",
    //     "documentUrl": "https://recording.bakerclerk.com/DuProcesswebinquiry?book=60&page=143&"
    //   }
    // ]
    // {
    //     "date": "12/15/2021",
    //     "bookPage": "4899/177",
    //     "bookPageUrl": "https://recording.charlotteclerk.com/Render/ViewPADocument?inApp=PA&inDocumentId=q69aixxKFQCBs+UXdVlZqg==",
    //     "instrumentNumber": "3038073",
    //     "instrumentNumberUrl": "https://recording.charlotteclerk.com/Render/ViewPADocument?inApp=PA&inDocumentId=q69aixxKFQCBs+UXdVlZqg==",
    //     "sellingPrice": "$3,300,000",
    //     "salesCode": "VACANT",
    //     "qualificationDisqualificationCode": "01",
    //     "qualificationDisqualificationCodeUrl": "javascript:popUpSmall('RPSearchQualCodeDesc.asp?saleyear=2021&code=01  ')"
    //   }
    sales.forEach((s, idx) => {
      const saleOut = {
        ownership_transfer_date: convertDateFormat(s.date) || null,
        purchase_price_amount: parseCurrencyToNumber(s.sellingPrice) ?? null,
      };
      writeJSON(path.join("data", `sales_${idx + 1}.json`), saleOut);
      let deed = { deed_type: "Miscellaneous" };
      if (s.bookPage) {
        const bookPage = convertBookPage(s.bookPage);
        deed.book = bookPage.book;
        deed.page = bookPage.page;
      }
      if (s.instrumentNumber) {
        deed.instrument_number = s.instrumentNumber;
      }
      writeJSON(path.join("data", `deed_${idx + 1}.json`), deed);
      
      let fileName = deed.book && deed.page ? `${deed.book}/${deed.page}` : null;
      let link = s.bookPageUrl ? s.bookPageUrl : (s.instrumentNumberUrl ? s.instrumentNumberUrl : null);
      const file = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name: fileName ? `Deed ${fileName}` : "Deed Document",
        original_url: link || null,
      };
      writeJSON(path.join("data", `file_${idx + 1}.json`), file);
      const relDeedFile = {
        from: { "/": `./deed_${idx + 1}.json` },
        to: { "/": `./file_${idx + 1}.json` },
      };
      writeJSON(
        path.join("data", `relationship_deed_file_${idx + 1}.json`),
        relDeedFile,
      );

      const relSalesDeed = {
        from: { "/": `./sales_${idx + 1}.json` },
        to: { "/": `./deed_${idx + 1}.json` },
      };
      writeJSON(
        path.join("data", `relationship_sales_deed_${idx + 1}.json`),
        relSalesDeed,
      );
    });
  }

  // Owners (persons/companies)
  const pc = buildPersonsAndCompanies(ownerJSON, parcelId);
  pc.persons.forEach((p, i) =>
    writeJSON(path.join("data", `person_${i + 1}.json`), p),
  );
  pc.companies.forEach((c, i) =>
    writeJSON(path.join("data", `company_${i + 1}.json`), c),
  );
  if (hasOwnerMailingAddress) {
    pc.personCurrentOwners.forEach((idx, i) =>
      writeJSON(
        path.join(
          "data",
          `relationship_person_has_mailing_address_${idx}.json`,
        ),
        {
          from: { "/": `./person_${idx}.json` },
          to: { "/": `./mailing_address.json` },
        }
      )
    );
    pc.companyCurrentOwners.forEach((idx, i) =>
      writeJSON(
        path.join(
          "data",
          `relationship_company_has_mailing_address_${idx}.json`,
        ),
        {
          from: { "/": `./company_${idx}.json` },
          to: { "/": `./mailing_address.json` },
        }
      )
    );
  }
  if (sales && sales.length > 0) {
    pc.personCurrentOwners.forEach((idx, i) =>
      writeJSON(
        path.join(
          "data",
          `relationship_sales_person_${idx}.json`,
        ),
        {
          to: { "/": `./person_${idx}.json` },
          from: { "/": `./sales_1.json` },
        }
      )
    );
    pc.companyCurrentOwners.forEach((idx, i) =>
      writeJSON(
        path.join(
          "data",
          `relationship_sales_company_${idx}.json`,
        ),
        {
          to: { "/": `./company_${idx}.json` },
          from: { "/": `./sales_1.json` },
        }
      )
    );
  }
  // Layout extraction from owners/layout_data.json
  if (layoutData) {
    const lset =
      key && layoutData[key] && Array.isArray(layoutData[key].layouts)
        ? layoutData[key].layouts
        : [];
    let layoutBuildingMap = {};
    let idx = 1;
    for (const l of lset) {
      const layoutOut = {
        space_type: l.space_type ?? null,
        space_type_index: l.space_type_index ?? null,
        flooring_material_type: l.flooring_material_type ?? null,
        size_square_feet: l.size_square_feet ?? null,
        has_windows: l.has_windows ?? null,
        window_design_type: l.window_design_type ?? null,
        window_material_type: l.window_material_type ?? null,
        window_treatment_type: l.window_treatment_type ?? null,
        is_finished: l.is_finished ?? null,
        furnished: l.furnished ?? null,
        paint_condition: l.paint_condition ?? null,
        flooring_wear: l.flooring_wear ?? null,
        clutter_level: l.clutter_level ?? null,
        visible_damage: l.visible_damage ?? null,
        countertop_material: l.countertop_material ?? null,
        cabinet_style: l.cabinet_style ?? null,
        fixture_finish_quality: l.fixture_finish_quality ?? null,
        design_style: l.design_style ?? null,
        natural_light_quality: l.natural_light_quality ?? null,
        decor_elements: l.decor_elements ?? null,
        pool_type: l.pool_type ?? null,
        pool_equipment: l.pool_equipment ?? null,
        spa_type: l.spa_type ?? null,
        safety_features: l.safety_features ?? null,
        view_type: l.view_type ?? null,
        lighting_features: l.lighting_features ?? null,
        condition_issues: l.condition_issues ?? null,
        is_exterior: l.is_exterior ?? false,
        pool_condition: l.pool_condition ?? null,
        pool_surface_type: l.pool_surface_type ?? null,
        pool_water_quality: l.pool_water_quality ?? null,

        adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
        area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
        bathroom_renovation_date: l.bathroom_renovation_date ?? null,
        building_number: l.building_number ?? null,
        kitchen_renovation_date: l.kitchen_renovation_date ?? null,
        heated_area_sq_ft: l.heated_area_sq_ft ?? null,
        installation_date: l.installation_date ?? null,
        livable_area_sq_ft: l.livable_area_sq_ft ?? null,
        pool_installation_date: l.pool_installation_date ?? null,
        spa_installation_date: l.spa_installation_date ?? null,
        story_type: l.story_type ?? null,
        total_area_sq_ft: l.total_area_sq_ft ?? null,
      };
      writeJSON(path.join("data", `layout_${idx}.json`), layoutOut);
      if (l.space_type === "Building") {
        const building_number = l.building_number;
        layoutBuildingMap[building_number.toString()] = idx;
      }
      if (l.space_type !== "Building") {
        const building_number = l.building_number;
        if (building_number) {
          const building_layout_number = layoutBuildingMap[building_number.toString()];
          writeJSON(path.join("data", `relationship_layout_${building_layout_number}_to_layout_${idx}.json`), {
            to: { "/": `./layout_${idx}.json` },
            from: { "/": `./layout_${building_layout_number}.json` },
          },);
        }
      }
      if (util && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in util) {
          writeJSON(path.join("data", `utility_${idx}.json`), util[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_utility_${idx}.json`), {
                    to: { "/": `./utility_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      if (struct && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in struct) {
          writeJSON(path.join("data", `structure_${idx}.json`), struct[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_structure_${idx}.json`), {
                    to: { "/": `./structure_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      idx++;
    }
  }
  
}

if (require.main === module) {
  main();
}