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
/**
 * Extracts the `model` object literal from the onClickTaxCalculator function in palmbeach.html
 * and returns it as a plain JavaScript object.
 *
 * @param {string} $ - The HTML content of palmbeach.html parsed using cheerio.
 * @returns {object|null} Parsed model object if found, otherwise null.
 */
function parsePalmBeachModel($) {
  let targetScript = null;

  $('script').each((_, element) => {
    const scriptBody = $(element).html();
    if (scriptBody && scriptBody.includes('function onClickTaxCalculator')) {
      targetScript = scriptBody;
      return false; // Break out early once we find the function definition
    }
    return undefined;
  });

  if (!targetScript) {
    return null;
  }

  const modelIndex = targetScript.indexOf('var model');
  if (modelIndex === -1) {
    return null;
  }

  const objectStart = targetScript.indexOf('{', modelIndex);
  if (objectStart === -1) {
    return null;
  }

  const objectLiteral = extractObjectLiteral(targetScript, objectStart);
  if (!objectLiteral) {
    return null;
  }

  try {
    const parsedModel = JSON.parse(objectLiteral);
    parsedModel.structuralDetails = enhanceStructuralDetails(parsedModel.structuralDetails);
    return parsedModel;
  } catch (error) {
    throw new Error(`Failed to parse Palm Beach model JSON: ${error.message}`);
  }
}

/**
 * Walks the script content starting at the first opening brace and returns the
 * full object literal including nested objects.
 *
 * @param {string} script - JavaScript source that contains the object literal.
 * @param {number} startIndex - Index of the first `{` character.
 * @returns {string|null} Raw object literal text or null if it cannot be isolated.
 */
function extractObjectLiteral(script, startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let isEscaped = false;

  for (let i = startIndex; i < script.length; i += 1) {
    const char = script[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return script.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

function enhanceStructuralDetails(structuralDetails) {
  if (!structuralDetails || typeof structuralDetails !== 'object') {
    return structuralDetails || null;
  }

  const combinedBuildings = combineStructuralElements(structuralDetails.StructuralElements);
  return {
    ...structuralDetails,
    combinedBuildings,
  };
}

function combineStructuralElements(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }

  const grouped = elements.reduce((acc, element) => {
    const buildingNumber = element?.BuildingNumber || 'Unknown';
    if (!acc[buildingNumber]) {
      acc[buildingNumber] = {
        buildingNumber,
        sections: {},
      };
    }

    const section = element?.DetailsSection || 'General';
    const name = element?.ElementName || `element${element?.ElementNumber || ''}`;
    const value = element?.ElementValue ?? null;

    if (!acc[buildingNumber].sections[section]) {
      acc[buildingNumber].sections[section] = {};
    }

    const sectionEntries = acc[buildingNumber].sections[section];
    if (!(name in sectionEntries)) {
      sectionEntries[name] = value;
    } else if (Array.isArray(sectionEntries[name])) {
      sectionEntries[name].push(value);
    } else {
      sectionEntries[name] = [sectionEntries[name], value];
    }

    return acc;
  }, {});

  return Object.values(grouped);
}

const propertyTypeMapping = [
  {
    "property_usecode": "5100 - AG Classification CROP SOIL CLASS 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5200 - AG Classification CROP SOIL CLASS 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5300 - AG Classification CROP SOIL CLASS 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6800 - AG Classification EQUESTRIAN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6804 - AG Classification EQUESTRIAN CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 - AG Classification GRAGSOIL CLASS 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6100 - AG Classification GRZGSOIL CLASS2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6200 - AG Classification GRZGSOIL CLASS3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6300 - AG Classification GRZGSOIL CLASS4",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6400 - AG Classification GRZGSOIL CLASS5",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6500 - AG Classification GRZGSOIL CLASS6",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5000 - AG Classification IMPROVED AGRI",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 - AG Classification ORCHARD GROVES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 - AG Classification ORN/MISC AGRI",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 - AG Classification POUL/BEES/FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5900 - AG Classification TIMBER NOT CLASSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5800 - AG Classification TIMBER SI 50-59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5700 - AG Classification TIMBER SI 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600 - AG Classification TIMBER SI 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5500 - AG Classification TIMBER SI 80-89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 - AG Classification TIMBER SI 90+",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2000 - AIRPORT/MARINA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2004 - AIRPORT/MARINA CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2700 - AUTO SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2704 - AUTO SALES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4500 - BOTTLER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 - BOWLING ALLEY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 - CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800 - CENTRALLY ASSESSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8600 - CITY INC NONMUNI",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7700 - CLB/LDG/UN HALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 - COLLEGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "4969 - COMMERCIAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4960 - CONDO COMMERCIAL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0400 - CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0510 - COOPERATIVE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "7900 - CULTURAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 - DEPARTMENT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1304 - DEPT STORE CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "8000 - DISTRICTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3100 - DRV-IN THEATER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "9999 - EXEMPT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8800 - FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2300 - FINANCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2304 - FINANCIAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3000 - FLORIST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "4600 - FOOD PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "8200 - FOREST/PK/REC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3800 - GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4200 - HEAVY MFG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500 - HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "3904 - HOTEL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2400 - INSURANCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "9000 - LEASEHOLD INT",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9010 - LEASEHOLD INT/WORKING WATERFRONT",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "0620 - LIFE CARE HX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "4100 - LIGHT MFG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4104 - LIGHT MFG CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4300 - LUMBER YARD/MILL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "0805 - MFR-IMP NON CONTRIBUTING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0500 - MHT COOP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0501 - MHT COOP REAL PROP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "8100 - MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700 - MIN PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9200 - MING/PETRO/GASLND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0700 - MISC RESIDENCE SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0201 - MOBILE HOME REAL PROP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "7600 - MORT/CEMETERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "3900 - MOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "0300 - MULTIFAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 - MULTIFAMILY &lt; 10 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801 - MULTIFAMILY &lt; 10 UNITS-COMM ZONING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0804 - MULTIFAMILY &lt; 10 UNITS-IND ZONING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0305 - MULTIFAMILY &gt; 10 units Income Restricted",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0304 - MULTIFAMILY CONDO CONVERSION",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "8900 - MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0810 - N/A (OLD CODE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0840 - N/A (OLD CODE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3300 - NIGHT CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "9900 - NON AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7400 - NURSING HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "1804 - OFF MULTISTORY CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1704 - OFFICE 1 STORY CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1800 - OFFICE MULTISTORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 - OFFICE ONE STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900 - OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7500 - ORPHNG/NON-PROF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "9700 - OUTDR REC/PARK LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4400 - PACKING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 - PKG LT / MH PK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1900 - PROF OFFICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1904 - PROF OFFICES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "7300 - PRV HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 - PRV SCHL/COLL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8300 - PUB CTY SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "9400 - R/W - BUFFER",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3700 - RACETRACK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 - RELIGIOUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "0900 - RESIDENTIAL COMMON AREA/ELEMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2204 - REST, DRIVE-IN CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2100 - RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2104 - RESTAURANT CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2200 - RESTAURANT, DRIVE IN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "0600 - RETIREMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0605 - RETIREMENT Income Restricted",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "9500 - RIVER/LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7800 - SANI/ REST HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 - SERVICE SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 - SERVICE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9600 - SEWG/WASTE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0150 - SFR-C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1604 - SH CTR CMMITY CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1600 - SHOPPING CENTER CMMITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500 - SHOPPING CENTER REGIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "0100 - SINGLE FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101 - SINGLE FAMILY-COMM ZONING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0105 - SINGLE FAMILY-IMP NONE CONTRIBUTING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0104 - SINGLE FAMILY-IND ZONING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1404 - SPRMKT/DRUG STR CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Unit"
  },
  {
    "property_usecode": "8700 - STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1204 - STORE/OFF/RES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1200 - STORE/OFFICE/RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1100 - STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 - STORES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "9300 - SUBSURF RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1400 - SUPERMARKET/DRUG STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "0210 - TANGIBLE MOBILE HOME",
    "ownership_estate_type": "OtherEstate",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingSingleWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "3200 - THTR/AUD/CLBHS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "0420 - TIMESHARE",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3500 - TOURIST ATTRAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "0110 - TOWNHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "8205 - TRANSFER DEVELOPMENT RIGHTS",
    "ownership_estate_type": "OtherEstate",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9100 - UTILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "0000 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1004 - VACANT COMM CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1000 - VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0040 - VACANT CONDO LAND",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1049 - VACANT CONDO LAND COMMERCIAL",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4004 - VACANT INDUS CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4000 - VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7000 - VACANT INSTIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0050 - VACANT SFR CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0010 - VACANT TOWNHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0030 - VACANT ZERO LOT LINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4800 - WAREH/DIST TERM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804 - WAREH/DIST TERM CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2900 - WHOLESALER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "2010 - WORKING WATERFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2014 - WORKING WATERFRONT CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0130 - ZERO LOT LINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  }
];

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

  let dorUseCode = null;
  if (parsed.propertyDetail && parsed.propertyDetail.UseCode) {
    dorUseCode = parsed.propertyDetail.UseCode;
  }
  const propertyMapping = mapPropertyTypeFromUseCode(dorUseCode);
  if (!propertyMapping) {
    throw {
      type: "error",
      message: `Unknown enum value ${dorUseCode}.`,
      path: "property.property_type",
    };
  }
  let legalDescriptionText = parsed?.propertyDetail?.LegalDesc || null;

  // Parcel identifier
  const parcel_identifier = parsed.propertyDetail.PCN;
  const property = {
    parcel_identifier,
    property_legal_description_text: legalDescriptionText,
    property_structure_built_year: null,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    number_of_units: parseIntOrNull(parsed?.propertyDetail?.Units),
    subdivision: parsed?.propertyDetail?.Subdivision ?? null,
    zoning: parsed?.propertyDetail?.Zoning ?? null,
  };
  return property;
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

function extractTaxPriorYears(parsed) {
  const result = [];
  const assessmentInfo = parsed?.assessmentInfo || [];
  const appraisalInfo = parsed?.appraisalInfo || [];
  const taxInfo = parsed?.taxInfo || [];
  let flattenedTaxObj = {}
  assessmentInfo.forEach((assessment, idx) => {
    let taxYear = assessment?.TaxYear;
    if (taxYear) {
      if (!(taxYear in flattenedTaxObj)) {
        flattenedTaxObj[taxYear] = {};
      }
      for (const [key, value] of Object.entries(assessment)) {
        if (key !== "TaxYear") {
          flattenedTaxObj[taxYear][key] = value;
        }
      }
    }
  });
  appraisalInfo.forEach((appraisal, idx) => {
    let taxYear = appraisal?.TaxYear;
    if (taxYear) {
      if (!(taxYear in flattenedTaxObj)) {
        flattenedTaxObj[taxYear] = {};
      }
      for (const [key, value] of Object.entries(appraisal)) {
        if (key !== "TaxYear") {
          flattenedTaxObj[taxYear][key] = value;
        }
      }
    }
  });
  taxInfo.forEach((tax, idx) => {
    let taxYear = tax?.TaxYear;
    if (taxYear) {
      if (!(taxYear in flattenedTaxObj)) {
        flattenedTaxObj[taxYear] = {};
      }
      for (const [key, value] of Object.entries(tax)) {
        if (key !== "TaxYear") {
          flattenedTaxObj[taxYear][key] = value;
        }
      }
    }
  });
  for (const [year, taxObj] of Object.entries(flattenedTaxObj)) {
    const tax = {
      tax_year: parseIntOrNull(year),
      property_assessed_value_amount: parseNumber(taxObj.AssessedValue),
      property_market_value_amount: parseNumber(taxObj.TotalMarketValue),
      property_building_amount: parseNumber(taxObj.ImprovementValue),
      property_land_amount: parseNumber(taxObj.LandValue),
      property_taxable_value_amount: parseNumber(taxObj.TaxableValue),
      property_exemption_amount: parseNumber(taxObj.ExemptionAmount),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    result.push(tax);
  }
  return result;
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
  if (val == null || val === undefined) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function extractLot(parsed) {
  let acreage = parseNumber(parsed?.propertyDetail?.Acres || null);
  if (acreage === 0) {
    acreage = null;
  }
  let lot_type = null;
  if (acreage && acreage > 0.25) {
    lot_type = "GreaterThanOneQuarterAcre";
  } else {
    lot_type = "LessThanOrEqualToOneQuarterAcre";
  }
  let sqFeet = parseIntOrNull(parsed?.propertyDetail?.SqFt);
  if (sqFeet < 1) {
    sqFeet = null;
  }
  return {
    lot_type: lot_type ?? null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: sqFeet,
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
  const siteAddress = parsed?.propertyDetail?.Location;
  if (siteAddress && siteAddress.trim()) {
    return siteAddress;
  }
  return null;
}

function extractOwnerMailingAddress(parsed) {
  let addressLines = [];
  if (parsed?.propertyDetail?.AddressLine1 && parsed?.propertyDetail?.AddressLine1.trim()) {
    addressLines.push(parsed?.propertyDetail?.AddressLine1.trim());
  }
  if (parsed?.propertyDetail?.AddressLine2 && parsed?.propertyDetail?.AddressLine2.trim()) {
    addressLines.push(parsed?.propertyDetail?.AddressLine2.trim());
  }
  if (parsed?.propertyDetail?.AddressLine3 && parsed?.propertyDetail?.AddressLine3.trim()) {
    addressLines.push(parsed?.propertyDetail?.AddressLine3.trim());
  }
  if (addressLines.length > 0) {
    return addressLines.join(", ");
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
  const parsed = parsePalmBeachModel($);

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
  
  // // Tax current year (from Value Summary)
  // const taxCurrent = extractTaxCurrent($);
  // if (taxCurrent.tax_year) {
  //   writeJSON(path.join("data", `tax_${taxCurrent.tax_year}.json`), taxCurrent);
  // }

  // Tax prior years (from Prior Year Final Values)
  const taxPrior = extractTaxPriorYears(parsed);
  taxPrior.forEach((t) => {
    if (t.tax_year) {
      writeJSON(path.join("data", `tax_${t.tax_year}.json`), t);
    }
  });

  // Sales
  const sales = parsed?.salesInfo;
  if (sales) {
    // {
    //         "SaleDate": "05/04/2023",
    //         "Price": "7500000",
    //         "Book": "34304",
    //         "Page": " 01188",
    //         "SaleType": "WARRANTY DEED",
    //         "OwnerName": "812 CENTER STREET LLC",
    //         "ConfidentialFlag": "N",
    //         "NoSalesInfo": null
    //     }
    sales.forEach((s, idx) => {
      const saleOut = {
        ownership_transfer_date: convertDateFormat(s.SaleDate) || null,
        purchase_price_amount: parseNumber(s.Price) ?? null,
      };
      writeJSON(path.join("data", `sales_${idx + 1}.json`), saleOut);
      let deed = { deed_type: mapInstrumentToDeedType(s.SaleType) };
      let link = null;
      if (s.Book && s.Page && s.Book.trim() && s.Page.trim()) {
        deed.book = s.Book.trim();
        deed.page = s.Page.trim();
        link = `https://erec.mypalmbeachclerk.com/Search/DocumentAndInfoByBookPage?Key=Assessor&booktype=O&booknumber=${deed.book}&pagenumber=${deed.page}`;
      }
      // if (s.instrumentNumber) {
      //   deed.instrument_number = s.instrumentNumber;
      // }
      writeJSON(path.join("data", `deed_${idx + 1}.json`), deed);
      
      let fileName = deed.book && deed.page ? `${deed.book}/${deed.page}` : null;
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

  // Relationships person/company -> sales
  const personNameToPath = new Map();
  pc.persons.forEach((p, i) => {
    const nameVariants = [];
    const f = (p.first_name || "").trim();
    const m = (p.middle_name || "").trim();
    const l = (p.last_name || "").trim();
    if (f && l) {
      // Use the capitalized names for matching
      nameVariants.push(`${l} ${f}${m ? " " + m : ""}`.toUpperCase());
      nameVariants.push(`${f} ${m ? m + " " : ""}${l}`.toUpperCase());
      nameVariants.push(`${l} ${f}`.toUpperCase());
    }
    const pth = `./person_${i + 1}.json`;
    nameVariants.forEach((v) => personNameToPath.set(v, pth));
  });
  const companyNameToPath = new Map();
  pc.companies.forEach((c, i) => {
    const nm = (c.name || "").trim().toUpperCase();
    if (nm) companyNameToPath.set(nm, `./company_${i + 1}.json`);
  });
  sales.forEach((s, idx) => {
    const g = normalizeNameForMatch(s.OwnerName);
    if (!g) return;
    if (companyNameToPath.has(g)) {
      const rel = {
        to: { "/": companyNameToPath.get(g) },
        from: { "/": `./sales_${idx + 1}.json` },
      };
      writeJSON(
        path.join("data", `relationship_sales_company_${idx + 1}.json`),
        rel,
      );
    } else {
      // try direct or swapped person match
      let toPath = null;
      if (personNameToPath.has(g)) {
        toPath = personNameToPath.get(g);
      } else {
        const parts = g.split(/\s+/);
        if (parts.length >= 2) {
          const swapped = `${parts.slice(1).join(" ")} ${parts[0]}`
            .toUpperCase()
            .trim();
          if (personNameToPath.has(swapped))
            toPath = personNameToPath.get(swapped);
        }
      }
      if (toPath) {
        const rel = {
          to: { "/": toPath },
          from: { "/": `./sales_${idx + 1}.json` },
        };
        writeJSON(
          path.join("data", `relationship_sales_person_${idx + 1}.json`),
          rel,
        );
      }
    }
  });
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