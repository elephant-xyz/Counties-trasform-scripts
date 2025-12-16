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


const propertyTypeMapping = [
  {
    "property_usecode": "0000 - Vacant Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0080 - Vacant W/ Extra Features",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0100 - Single Family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0103 - Modular Home",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - Mobile Home",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0300 - Multi-Family (More than 10 units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 - Multi-Family (Less than 10 units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1000 - Vacant Commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 - Stores (Retail)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1101 - Stores (Discount)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1102 - Convenience Store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1103 - Retail specialty store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 - Strip/Retail Center",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1200 - Mixed Use Store/Office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
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
    "property_usecode": "1401 - Supermarkets, neighborhood/community",
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
    "property_usecode": "1501 - Super Regional Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 - Community Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1601 - Neighborhood Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 - Office Bldg/Non-professional",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1701 - Post Office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900 - Professional Service Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1901 - Police Station",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "1902 - Correctional Facility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 - Restaurants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200 - Drive-in Restaurants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 - Financial Institutions",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2301 - Branch Bank",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2400 - Insurance Company Offices",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 - Repair Service Shop",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2502 - Laundromat",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2502 - Service Stations",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2601 - Car Wash",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 - Auto(Storage)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "2701 - Auto(Sales/Repair)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 - Mobile Home Parks",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "3900 - Hotel/Motel",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "4100 - Light Manufacturing",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4102 - Heavy Manufacturing",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 - Warehousing, Distribution",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801 - Warehousing, Storage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4802 - Warehousing, Mini",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804 - Warehousing, Metal Prefab",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4805 - Warehousing, Guard House",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4806 - Warehousing, Mega Storage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4807 - Warehousing, Truck Cold Storage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4808 - Warehousing, Trucking Service Garage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "5001 - Agriculture W/ Improvements (0100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5002 - Agriculture W/ Improvements (0200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5300 - Cropland",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 - Timberland - Class 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5500 - Timberland - Class 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600 - Timberland - Class 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5700 - Timberland - Class 4",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5800 - Timberland - Class 5",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5910 - Swamp and Hardwood",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 - Improved Pasture",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6001 - Agriculture W/ Improvements (0100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6002 - Agriculture W/ Improvements (0200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 - Nurseries, Ornamentals, Misc. Ag",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
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
  let dorUseCode = parsed.ownerPropertyInformation.propertyUse;
  const propertyMapping = mapPropertyTypeFromUseCode(dorUseCode);
  if (!propertyMapping) {
    throw {
      type: "error",
      message: `Unknown enum value ${dorUseCode}.`,
      path: "property.property_type",
    };
  }
  let legalDescriptionText = null;
  if (parsed.ownerPropertyInformation.briefLegalDescription) {
    legalDescriptionText = parsed.ownerPropertyInformation.briefLegalDescription;
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
    zoning: null,
  };
  return property;
}

function parseBakerDetails($) {

  const ownerPropertyInformation = parseLabelValueSection($, '#ownerinfo .mailingadd', '.subhead');
  const valueInformation = parseLabelValueSection($, '#valuedata .mailingadd', '.subhead_val');
  valueInformation.applicableYear = extractValueYear($);
  convertCurrencyValues(valueInformation);
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

function convertCurrencyValues(valueMap) {
  if (!valueMap || typeof valueMap !== 'object') {
    return;
  }

  Object.keys(valueMap).forEach((key) => {
    const value = valueMap[key];
    if (value === null || value === undefined) {
      valueMap[key] = null;
      return;
    }

    const normalized = value.toString().replace(/\s+/g, '');
    if (!normalized) {
      valueMap[key] = null;
      return;
    }

    const cleaned = normalized.replace(/[^0-9.-]/g, '');
    if (!cleaned) {
      valueMap[key] = null;
      return;
    }

    const numeric = Number(cleaned);
    valueMap[key] = Number.isFinite(numeric) ? numeric : null;
  });
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (isNaN(n)) return null;
  return n;
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
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function extractLink(onClickValue) {
  if (!onClickValue) {
    return null;
  }

  const match = onClickValue.match(/['"]([^'"]+)['"]/);
  return match ? match[1] : null;
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

function extractLot(parsed) {
  let acreage = null;
  if (parsed.ownerPropertyInformation.landSizeAcOrLot) {
    const n = Number(parsed.ownerPropertyInformation.landSizeAcOrLot.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n)) acreage = n;
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
  if (parsed.ownerPropertyInformation.siteAddress) {
    return parsed.ownerPropertyInformation.siteAddress;
  }
  return null;
}

function extractOwnerMailingAddress(parsed) {
  if (parsed.ownerPropertyInformation.mailingAddress) {
    return parsed.ownerPropertyInformation.mailingAddress;
  }
  return null;
}

function attemptWriteAddress(unnorm, siteAddress, mailingAddress) {
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
  const parsed = parseBakerDetails($);

  // Property
  const property = extractProperty(parsed, seed);
  writeJSON(path.join("data", "property.json"), property);
  writeJSON(path.join("data", "parcel.json"), {parcel_identifier: parcelId || ""});

  const addressText = extractAddressText(parsed);
  const mailingAddress = extractOwnerMailingAddress(parsed);
  const hasOwnerMailingAddress = attemptWriteAddress(unaddr, addressText, mailingAddress);

  // Lot
  const lot = extractLot(parsed);
  if (lot) {
    writeJSON(path.join("data", "lot.json"), lot);
  }
  // Tax current year (from Value Summary)
  const taxCurrent = extractTaxCurrent(parsed);
  if (taxCurrent && taxCurrent.tax_year) {
    writeJSON(path.join("data", `tax_${taxCurrent.tax_year}.json`), taxCurrent);
  }

  // Sales
  const sales = parsed.recentSalesAndTransactions;
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
    sales.forEach((s, idx) => {
      const saleOut = {
        ownership_transfer_date: s.dateOfSale || null,
        purchase_price_amount: parseCurrencyToNumber(s.price) ?? null,
      };
      writeJSON(path.join("data", `sales_${idx + 1}.json`), saleOut);
      let deed = { deed_type: mapInstrumentToDeedType(s.instrumentType) };
      if (s.orBook) {
        deed.book = s.orBook;
      }
      if (s.orPage) {
        deed.page = s.orPage;
      }
      writeJSON(path.join("data", `deed_${idx + 1}.json`), deed);
      
      let fileName = deed.book && deed.page ? `${deed.book}/${deed.page}` : null;
      const file = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name: fileName ? `Deed ${fileName}` : "Deed Document",
        original_url: s.documentUrl || null,
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