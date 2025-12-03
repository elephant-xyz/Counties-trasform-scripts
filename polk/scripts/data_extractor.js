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
    "property_usecode": "0001 - VAC.RES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0002 - VAC. MH - PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0003 - VAC. CONDO SITE - PLATTED",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0004 - VAC. RES. W/MISC IMPR @ ZERO VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0006 - RESIDENTIAL IMPROVEMENTS CARRIED ON OTHER PCL'S",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0007 - RES. OR MH LOT W/ MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0008 - LOT W/ MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0009 - VACANT RV LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0024 - VAC. MH LOT W/ MISC IMPR @ 0 VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0028 - VAC. MH WATERFRONT LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0044 - VAC. CONDO/RV LOT",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0064 - VAC. RESIDENTIAL, UNBUILDABLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0080 - VAC. LAKEFRONT.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0082 - VAC. OTHER WATERFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0084 - VAC. LAKEFRONT W/ MISC IMPR @ ZERO VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0085 - VAC. LAKEFRONT W/MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0086 - VAC. GOLF COURSE FRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0088 - VAC. AIRSTRIP FRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0100 - SFR UP TO 2.49 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101 - SFR 2.5 TO 9.99AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0102 - SFR 10+ AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0140 - ATTACHED HOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0150 - MODULAR HOME UP TO 2.49 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0151 - MODULAR HOME 2.50 - 9.99 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0152 - MODULAR HOME 10+ ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0160 - SFR - RENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0180 - RES. LAKEFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0182 - SFR OTHER WATERFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0183 - MODULAR HOME LAKEFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0185 - MODULAR HOME OTHER WATERFRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0186 - SFR GOLF COURSE FRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0188 - SFR AIRSTRIP FRONT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - M.H. (RP) UP TO 2.49 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0201 - M.H. (RP) 2.5 - 9.99 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0202 - M.H. (RP) 10+ ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0280 - M.H. LAKEFRONT (RP TAG)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0282 - M.H. OTHER WATERFRONT W/ VALUE(RP)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0286 - M.H. GOLF COURSE FRONT (RP)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GolfCourse",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0301 - MULTI-FAMILY 10+ (INDIV UNITS)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0310 - MULTI-FAMILY - 10 - 49 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0315 - MULTI-FAMILY 50-119 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0320 - MULTI-FAMILY 120+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0330 - MULTI FAMILY - LIHTC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0331 - MULTI-FAMILY LOW INCOME (USDA, SECT. 8, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0350 - DUPLEXES, TRI'S, QUAD'S IN THE GREATER LAKELAND AREA 10+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0351 - DUPLEXES, TRI'S, QUAD'S IN HIGHLANDS CITY, MULBERRY, BARTOW, FORT MEADE, EAGLE LAKE AREA 10+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0352 - DUPLEXES, TRI'S, QUAD'S IN POLK CITY, AUBURNDALE, LAKE ALFRED, WINTER HAVEN AREA 10+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0353 - DUPLEXES, TRI'S, QUAD'S ALONG HWY 27, EAST PART OF THE COUNTY FROM DAVENPORT TO FROSTPROOF 10+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0360 - MIGRANT CAMPS 10+ UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0400 - CONDOMINIUMS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0401 - CONDOMINIUMS - M.H. (INDIV UNIT)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0441 - CONDOMINIUMS - R.V. (INDIV UNIT)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0500 - CO-OP APARTMENTS",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0650 - ASSISTED LIVING FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0651 - SKILLED NURSING HOMES (PRIVATE-MEDICAL)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "0652 - RETIREMENT FACILITY (MIXED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801 - MULTIPLE SFR RESIDENCES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0802 - MULTIPLE MH RESIDENCES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0803 - MULTIPLE RESIDENCES SFR & MH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0811 - MULTI-FAMILY W/SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0850 - DUPLEXES, TRI'S, QUAD'S IN THE GREATER LAKELAND AREA 9 UNITS OR LESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0851 - DUPLEXES, TRI'S, QUAD'S IN HIGHLANDS CITY, MULBERRY, BARTOW, FORT MEADE, EAGLE LAKE AREA 9 UNITS OR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0852 - DUPLEXES, TRI'S, QUAD'S IN POLK CITY, AUBURNDALE, LAKE ALFRED, WINTER HAVEN AREA 9 UNITS OR LESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0853 - DUPLEXES, TRI'S, QUAD'S ALONG HWY 27, EAST PART OF THE COUNTY FROM DAVENPORT TO FROSTPROOF 9 UNITS O",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0860 - MIGRANT CAMPS 9 UNITS OR LESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0900 - VAC. RESIDENTIAL / OR MISC IMP. COMMON ELEMENTS/AREAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0901 - IMP. RESIDENTIAL COMMON ELEMENTS/AREAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0989 - SPLIT AND/OR COMBINE IN PROGRESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "UnderConstruction",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
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
    "property_usecode": "1004 - VAC COMM MISC IMPR @ ZERO VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1005 - VAC. COM./IMPS ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1006 - COMM. IMPROVEMENTS CARRIED ON OTHER PCL'S",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1007 - COMM. MISC IMPS OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1038 - VAC. COMMERCIAL GOLF COURSE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1040 - COMM. COMMON ELEMENTS/AREAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1064 - VACANT COMMERCIAL, UNBUILDABLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 - COM. MISC.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 - STRUCTURE(S) OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1110 - RETAIL UP TO 4999 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1120 - RETAIL 5000SF TO 20000SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1130 - RETAIL OVER 20000 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1140 - DRUG STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1150 - DISCOUNT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1160 - POST OFFICE (NOT GOV. OWNED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1170 - HOME IMPROVEMENT CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1171 - FURNITURE STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1172 - DOLLAR STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1174 - CONVENIENCE STORES W/GAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1175 - CONVENIENCE STORES ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1179 - BEAUTY SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1180 - DRY CLEANERS-LAUNDROMAT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1190 - DAY CARE CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1203 - COM. LAND & NON-CONFORMING STRUCTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1204 - STORE/OFFICE W/RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1211 - DOWNTOWN CORE AREA MISC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 - DEPARTMENT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1400 - SUPERMARKETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500 - REGIONAL SHOPPING CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 - MINI PLAZA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1610 - NEIGHBORHOOD PLAZA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1620 - NEIGHBORHOOD SHOPPING CNTR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1671 - COMMUNITY SHOPPING CNTR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1711 - ONE-STORY, CLASS A OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1721 - ONE-STORY, CLASS B OFFICE 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1730 - ONE-STORY, CLASS C, OFFICE, 1 - 9,999 SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1731 - ONE-STORY, CLASS C, OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1740 - ONE-STORY, CLASS D OFFICE, 1 - 9,999 SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1741 - ONE-STORY, CLASS D OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1811 - MULTI-STORY, CLASS A OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1821 - MULTI-STORY, CLASS B OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1830 - MULTI-STORY, CLASS C OFFICE, 1 - 9999 SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1831 - MULTI-STORY, CLASS C OFFICE, 10,000 & LARGER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1840 - MULTI-STORY, CLASS D OFFICE, 1 - 9999 SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1841 - MULTI-STORY, CLASS D OFFICE, 10,000 & LARGER SQFT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1906 - COMMERCIAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1940 - HOSPITALS (TAXABLE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "1942 - PROFESSIONAL BLDGS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1943 - MEDICAL COMPLEX/DRS. OFFICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1944 - ANIMAL CLINICS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1945 - FUNERAL HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1946 - SCHOOLS AND COLLEGES (TAXABLE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000 - AIRPORTS (PRIVATE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2020 - MARINAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2101 - LOCAL RESTAURANTS/EATERIES UPSCALE DINING, HIGH LEVEL OF DECOR.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2102 - LOCAL RESTAURANTS/EATERIES CASUAL DINING.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2103 - LOCAL RESTAURANTS/EATERIES FAST CASUAL, MINIMUM DECOR.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2104 - LOCAL RESTAURANTS/EATERIES MINIMUM TYPE STRUCTURES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2150 - NATIONAL/CHAIN RESTAURANTS CASUAL DINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2151 - NATIONAL/CHAIN RESTAURANTS FAST CASUAL DINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2201 - LOCAL FAST FOOD RESTAURANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2250 - NATIONAL/CHAIN FAST FOOD RESTAURANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 - BANKS (S&L, FINANCIAL INSTS.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2310 - BANK BRANCH OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2400 - INSURANCE CO. (NATIONAL & REGIONAL)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 - SVC & REPAIR SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 - SERVICE STATIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2610 - TRUCK STOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 - AUTO SALES/SVC (DEALERSHIPS)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2701 - RV SALES/SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2702 - MOTORCYCLE/REC. VEHICLES SALES/SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2710 - FARM MACHINERY SALES/SVC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2720 - MARINE SALES/SVC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2730 - MOBILE HOME SALES/SVC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Commercial",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "2740 - AUTO PARTS SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2750 - AUTO REPAIR / COMMERCIAL SERVICE GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2760 - USED SALES & RENTAL/LEASING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2770 - QUICK LUBE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2780 - CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2805 - COMMERCIAL PARKING LOTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2850 - MHP - 55+ PARK; LOT ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2851 - MHP - 55+ PARK; MH LOT AND UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2852 - MHP - 55+ PARK; MH LOT AND RECREATIONAL VEHICLE (RV)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2853 - RVP - 55+ PARK; RECREATIONAL VEHICLE (RV)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2854 - MHP - FAMILY PARK; LOT ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2855 - MHP - FAMILY PARK; MH LOT AND UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2856 - MHP - FAMILY PARK; MH LOT AND RECREATIONAL VEHICLE (RV)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2857 - RVP - FAMILY PARK; RECREATIONAL VEHICLE (RV)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2900 - WHOLESALE OUTLETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 - FLORISTS & GREENHOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3100 - THEATERS (DRIVE-INS)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 - THEATERS (ENCLOSED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 - BARS & LOUNGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 - BOWLINGALLEYS,SKATING RINKS&POOL HAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3410 - FITNESS CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3420 - RADIO/TV STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3536 - TOURIST ATTRACTIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3537 - ENTERT FACIL.( GOLF, GO CARTS, EVENT VENUES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3538 - CLUBHOUSE/COUNTRY CLUB/CULTURAL ORG. (TAXABLE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 - FISH CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3700 - RACE TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3800 - GOLF COURSES & DR. RANGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3900 - FRANCHISE OR CHAIN HOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3901 - INDEPENDENTLY OWNED MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3910 - BED & BREAKFAST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3950 - TIMESHARE PROPERTIES",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4001 - VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4004 - VAC INDUST W/MISC IMP@ 0 VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4005 - VAC IND/IMPS ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4006 - INDUSTRIAL IMPROVEMENTS CARRIED ON OTHER PARCELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4007 - INDUSTRIAL W/ IMPR OF SOME VALUE (XFOB)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4040 - IND. COMMON ELEMENTS/AREAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4064 - VACANT INDUSTRIAL, UNBUILDABLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100 - LIGHT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4105 - MISC. INDUSTRIAL FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4202 - HEAVY INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4216 - HEAVY IND-POLLUTION CONT.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 - LUMBER YDS, SAWMILLS, PLAINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400 - CITRUS PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "4500 - CITRUS CANNING, BOTTLERS, BREWERS, DISTILLERIES AND WINERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4600 - OTHER FOOD PROCESSING, BAKERIES, CANDY FACTORIES, POTATO CHIP FACTORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 - ALL WH, DISTRIB, TERM, STORAGE UNDER 19,999 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801 - ALL WH, DISTRIB, TERM, STORAGE 20,000 TO 99,999 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4805 - WH, DISTRIB, TERM, STORAGE STEEL CONSTR 100,000 TO 399,999 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4806 - WH, DISTRIB, TERM, STORAGE CONCRETE CONSTR 100,000 TO 399,999 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4810 - ALL WH, DISTRIB, TERM, STORAGE OVER 400,000 SF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4814 - INDUSTRIAL SELF STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4815 - SELF STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4816 - FLEX BUILDINGS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4830 - COLD STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4915 - OPEN STORAGE-NEW&USED BLDG SUPPLIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4924 - GAS & OIL STORAGE & DISTRIBUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4925 - AUTO WRECKING & JUNKYARDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "5100 - CROPLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5101 - CROPLAND W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5102 - CROPLAND W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5103 - CROPLAND W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5104 - CROPLAND W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5110 - CROPLAND W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5111 - CROPLAND W/UNDEV. W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5112 - CROPLAND W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5113 - CROPLAND W/UNDEV. W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5120 - CROPLAND W/COM. LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5121 - CROPLAND W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5150 - CROPLAND W/CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5151 - CROPLAND W/CITRUS/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5152 - CROPLAND W/CITRUS/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5160 - CROPLAND W/PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5161 - CROPLAND W/PASTURE/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5162 - CROPLAND W/PASTURE/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5163 - CROPLAND W/PASTURE/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5164 - CROPLAND W/PASTURE W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5170 - CROPLAND W/FARMLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5171 - CROPLAND W/FARMLAND/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 - TIMBER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5401 - TIMBER W/MISC.IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5402 - TIMBER W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5403 - TIMBER W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5410 - TIMBER W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5411 - TIMBER W/UNDEV. W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5412 - TIMBER W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5413 - TIMBER W/UNDEV. W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5420 - TIMBER W/COM. LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5421 - TIMBER W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5450 - TIMBER W/CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5460 - TIMBER W/PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5461 - TIMBER W/PASTURE/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5462 - TIMBER W/PASTURE/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5470 - TIMBER W/FARMLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5471 - TIMBER W/FARMLAND/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5472 - TIMBER W/FARMLAND/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 - PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6001 - PASTURE W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6002 - PASTURE W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6003 - PASTURE W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6004 - PASTURE W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6010 - PASTURE W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6011 - PASTURE W/UNDEV. W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6012 - PASTURE W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6013 - PASTURE W/UNDEV. W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6014 - PASTURE W/UNDEV. W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6020 - PASTURE W/COM. LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6021 - PASTURE W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6022 - PASTURE W/M.H. PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6023 - PASTURE W/GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6050 - PASTURE W/CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6051 - PASTURE W/CITRUS/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6052 - PASTURE W/CITRUS/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6053 - PASTURE W/CITRUS/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6070 - PASTURE W/FARMLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6071 - PASTURE W/FARMLAND/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6072 - PASTURE W/FARMLAND/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6073 - PASTURE W/FARMLAND/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 - CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6601 - CITRUS W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6602 - CITRUS W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6603 - CITRUS W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6610 - CITRUS W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6611 - CITRUS W/UNDEV. W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6612 - CITRUS W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6613 - CITRUS W/UNDEV. W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6620 - CITRUS W/COM. LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6621 - CITRUS W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6660 - CITRUS W/PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6661 - CITRUS W/PASTURE/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6662 - CITRUS W/PASTURE/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6670 - CITRUS W/FARMLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6671 - CITRUS W/FARMLAND/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6672 - CITRUS W/FARMLAND/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 - POULTRY, BEES, FISH, RABBITS...",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6701 - POULTRY, BEES, FISH, RABBITS... W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6702 - POULTRY, BEES, FISH, RABBITS... W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6703 - POULTRY, BEES, FISH, RABBITS... W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6704 - POULTRY, BEES, FISH, RABBITS...W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6712 - POULTRY, BEES, FISH, RABBITS... W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6721 - POULTRY, BEES, FISH, RABBITS... W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6761 - POULTRY, BEES, FISH, & RABBITS...W/PASTURE/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6800 - DAIRY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6801 - DAIRY W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6802 - DAIRY W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6810 - DAIRY W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 - NURSERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6901 - NURSERY W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6902 - NURSERY W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6903 - NURSERY W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6904 - NURSERY W/MH ON TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6910 - NURSERY W/UNDEV. LND.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6911 - NURSERY W/UNDEV. W/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6912 - NURSERY W/UNDEV. W/RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6913 - NURSERY W/UNDEV. W/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6921 - NURSERY W/COM. BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6961 - NURSERY W/PASTURE/MISC. IMP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6963 - NURSERY W/PASTURE/M.H.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7000 - VACANT INSTITUTIONAL - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7050 - VACANT NON-APPURTENANT COMMON ELEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7070 - VACANT CDD PARCEL - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7071 - CHURCHES- VACANT LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7072 - SCHOOLS & COLLEGES (PRIVATE) - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7073 - HOSPITALS (PRIVATELY OWNED) - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7074 - HOMES FOR THE AGED - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7075 - CHARITABLE INCLUDING ORPHANAGES - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7076 - CEMETERIES - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7077 - CLUBS & LODGES - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7078 - NURSING HOMES (MEDICAL FACILITIES) - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7079 - CULTURAL ORGANIZATIONS - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 - CHURCHES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7101 - CHURCHES (TAXABLE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 - SCHOOLS & COLLEGES (PRIVATE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300 - HOSPITALS (PRIVATELY OWNED) & MEDICAL FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 - HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500 - CHARITABLE INCLUDING ORPHANAGES-IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600 - CEMETERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7728 - CLUBS & LODGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7750 - NON-APPURTENANT COMMON ELEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "7770 - CDD PARCEL IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7800 - NURSING HOMES (MEDICAL FACILITIES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "7900 - CULTURAL ORGANIZATIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8050 - VACANT MINERAL RIGHTS (100% GOV EX)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8076 - VACANT CEMETERY (100% GOV EX)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8081 - VACANT MILITARY - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8082 - VACANT FOREST, PARKS - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8083 - VACANT PUBLIC COUNTY SCHOOLS - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8084 - VACANT COLLEGES - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8086 - VACANT COUNTY - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8087 - VACANT STATE - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8088 - VACANT FEDERAL - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8089 - VACANT MUNICIPAL - VAC LAND OR MISC IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8095 - VACANT SUBMRGD LAND (100% GOV EX)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8200 - FORESTS, PARKS, REC. AREAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8300 - SCHOOLS,PUBLIC-COUNTY (OWNED BY SCH BRD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 - COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600 - COUNTIES (OTHER THAN PUB SCHOOLS,COLLEGES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8700 - STATE (OTHER THAN MILITARY,FORESTS,P",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8800 - FEDERAL (OTHER THAN MILITARY, FORESTS,P",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8900 - MUNICIPAL (OTHER THAN COLLEGES,PARKS&RE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8930 - MUNICIPAL GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9130 - RAILROAD LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9140 - RAILROAD LAND W/MISC. IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9190 - UTILITIES (GAS, ELECTRIC, PHONE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "9200 - PHOSPHATE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9207 - PHOSPHATE PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9208 - SAND MINES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9209 - SAND MINES WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9210 - PHOSPHATE LAND WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9350 - MINERAL RIGHTS (NOT PHOS.)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9360 - PHOS. MINERAL RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9400 - STREETS, R/W & RETENTION (PRIVATE)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9500 - SUBMRGD LAND/LK BOTTOM/PERC POND)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9670 - SEWAGE/BORROW PITS/SPRAY FIELDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9681 - WASTE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9741 - RECREATION LAND (COVENANT)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9744 - RECREATION LAND W/MISC.IMP.(COVENANT)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800 - CENTRALLY ASSESSED RAILROAD LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9801 - CENTRALLY ASSESSED RAILROAD VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9900 - UNPLATTED UP TO 10 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9904 - UNPLATTED UP TO 10AC W/ IMPR @ ZERO VAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9905 - UNPLATTED UP TO 10AC W/IMPR OF SOME VALUE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9910 - INACCESSIBLE TRACTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9920 - UNPLATTED TRACTS 10 - 29.99 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9924 - TRACTS 10AC+ W/MISC.IMP. @ 0",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9925 - UNPLATTED TRACTS 30 TO 59.99 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9930 - UNPLATTED TRACTS 60 - 99.99 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9935 - UNPLATTED TRACTS 100+ ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9940 - RECREATIONAL LAND (PRIVATE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9980 - UNPLATTED TRACTS W/ LAKE FRONTAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
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

function extractProperty($, seed) {

  // ATTEMPT 1: Map from "Property (DOR) Use Code" using the provided PDF logic
  let dorUseCode = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.eq(0).text().trim().toLowerCase().includes("property (dor) use code")) {
        dorUseCode = tds.eq(1).text().trim();
      }
    });
  const propertyMapping = mapPropertyTypeFromUseCode(dorUseCode);
  if (!propertyMapping) {
    throw {
      type: "error",
      message: `Unknown enum value ${dorUseCode}.`,
      path: "property.property_type",
    };
  }
  

  // Year built(s)
  let years = [];
  $('h4:contains("Building Characteristics")').each((i, el) => {
    const section = $(el).parent();
    const text = section.text();
    const m = text.match(/Actual\s+Year\s+Built:\s*(\d{4})/i);
    if (m) years.push(parseInt(m[1], 10));
  });
  let property_structure_built_year = years.length ? Math.max(...years) : null;

  // Subdivision
  let subdivision = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.eq(0).text().trim().toLowerCase().includes("subdivision")) {
        const val = tds.eq(1).text().trim();
        subdivision = val || null;
      }
    });

  // Extract total living and total under roof for each building cleanly from subarea summary tables
  const livingAreas = [];
  const underRoofAreas = [];
  $("table.center tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const rowLabel = tds.eq(0).text().trim().toUpperCase();
      const lastCell = tds.last().text().trim();
      if (/^TOTAL\s+LIVING\s+AREA$/i.test(rowLabel)) {
        livingAreas.push(lastCell.toUpperCase());
      }
      if (/^TOTAL\s+UNDER\s+ROOF$/i.test(rowLabel)) {
        underRoofAreas.push(lastCell.toUpperCase());
      }
    }
  });

  // Parcel identifier
  const parcel_identifier =
    seed && (seed.parcel_id || seed.request_identifier)
      ? String(seed.parcel_id || seed.request_identifier)
      : null;
  const property = {
    parcel_identifier,
    property_legal_description_text: null,
    property_structure_built_year,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    number_of_units: null,
    subdivision: subdivision || "",
    zoning: null,
  };
  return property;
}

function extractTaxCurrent($) {
  // Current year from Value Summary header
  const yearMatch = $("#valueSummary h3")
    .text()
    .match(/\((\d{4})\)/);
  const tax_year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  let property_market_value_amount = 0; // Initialize to 0
  let property_assessed_value_amount = 0; // Initialize to 0
  let property_taxable_value_amount = 0; // Initialize to 0
  let property_building_amount = 0; // Initialize to 0
  let property_land_amount = 0; // Initialize to 0
  let property_exemption_amount = 0; // Initialize to 0

  $("#valueSummary table tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = tds.eq(0).text().trim().toUpperCase();
      const valueText = tds.eq(1).text().trim();
      if (label === "JUST MARKET VALUE")
        property_market_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "ASSESSED VALUE")
        property_assessed_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label.includes("TAXABLE VALUE") && label.includes("(COUNTY)"))
        property_taxable_value_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "BUILDING VALUE")
        property_building_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label === "LAND VALUE")
        property_land_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
      if (label.includes("EXEMPTION VALUE") && label.includes("(COUNTY)"))
        property_exemption_amount = parseCurrencyToNumber(valueText) ?? 0; // Default to 0
    }
  });

  return {
    tax_year,
    property_assessed_value_amount,
    property_market_value_amount,
    property_building_amount,
    property_land_amount,
    property_taxable_value_amount,
    property_exemption_amount,
    monthly_tax_amount: null, // Default to null as not extracted
    period_end_date: null, // Default to null as not extracted
    period_start_date: null, // Default to null as not extracted
  };
}

function extractTaxPriorYears($) {
  const results = [];
  const table = $("#priorValues table.left");
  if (table.length === 0) return results;

  // header row contains DESCRIPTION | 2024 | 2023 | 2022 | 2021
  const headerTds = table.find("tr").first().find("td");
  const yearCols = [];
  headerTds.each((i, td) => {
    const txt = $(td).text().trim();
    if (/^\d{4}$/.test(txt)) {
      yearCols.push({ year: parseInt(txt, 10), index: i });
    }
  });

  if (yearCols.length === 0) return results;

  // Build maps per year
  const dataByYear = new Map();
  yearCols.forEach((yc) =>
    dataByYear.set(yc.year, {
      tax_year: yc.year,
      property_assessed_value_amount: 0, // Initialize to 0
      property_market_value_amount: 0, // Initialize to 0
      property_building_amount: 0, // Initialize to 0
      property_land_amount: 0, // Initialize to 0
      property_taxable_value_amount: 0, // Initialize to 0
      property_exemption_amount: 0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    }),
  );

  // iterate rows
  table
    .find("tr")
    .slice(1)
    .each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;
      const desc = tds.eq(0).text().trim().toUpperCase();
      yearCols.forEach((yc) => {
        const valText = tds.eq(yc.index).text().trim();
        const num = parseCurrencyToNumber(valText);
        // Ensure num is a number, not null, to satisfy schema
        // If parsing fails, default to 0 for schema compliance
        const value = num ?? 0;

        const obj = dataByYear.get(yc.year);
        switch (desc) {
          case "JUST MARKET VALUE":
            obj.property_market_value_amount = value;
            break;
          case "ASSESSED VALUE":
            obj.property_assessed_value_amount = value;
            break;
          case "LAND VALUE":
            obj.property_land_amount = value;
            break;
          case "BUILDING VALUE":
            obj.property_building_amount = value;
            break;
          case "TAXABLE VALUE (COUNTY)":
            obj.property_taxable_value_amount = value;
            break;
          case "EXEMPTION VALUE (COUNTY)":
            obj.property_exemption_amount = value;
            break;
          default:
            break;
        }
      });
    });

  dataByYear.forEach((v) => results.push(v));
  return results;
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
  return "Miscellaneous";
}

function extractSales($) {
  const sales = [];
  const rows = $("#saleHist table.center tr");
  rows.each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const dateText = tds.eq(1).text().trim(); // e.g., 11/2021
      const bookPageRaw = tds.eq(0).text().trim();
      let bookPage = null;
      if (bookPageRaw) {
        bookPage = bookPageRaw.split("\n")[0];
      }
      let book = null;
      let page = null;
      if (bookPage && bookPage.split("/").length == 2) {
        book = bookPage.split("/")[0];
        page = bookPage.split("/")[1];
      }
      const link = $(tds[0]).find("a").last().attr("href") || null;
      const instTypeRaw = tds.eq(2).text().trim();
      const instrumentType = mapInstrumentToDeedType(instTypeRaw);
      const grantee = tds.eq(4).text().trim();
      const priceText = tds.eq(5).text().trim();
      const price = parseCurrencyToNumber(priceText);
      let isoDate = null;
      const dm = dateText.match(/^(\d{1,2})\/(\d{4})$/);
      if (dm) {
        const mm = dm[1].padStart(2, "0");
        const yyyy = dm[2];
        isoDate = `${yyyy}-${mm}-01`;
      }
      if (price !== null || grantee || dateText) {
        sales.push({
          grantee,
          dateText,
          ownership_transfer_date: isoDate,
          purchase_price_amount: price,
          book,
          page,
          link,
          instrumentType
        });
      }
    }
  });
  return sales;
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

function extractLot($) {
  let acreage = null;
  $("h4:contains('Parcel Information')")
    .next("table")
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      const key = tds.eq(0).text().trim().toUpperCase();
      if (key === "ACREAGE") {
        const val = tds.eq(1).text().trim();
        const n = Number(val.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n)) acreage = n;
      }
    });
  let lot_type = null;
  if (acreage != null && acreage > 0.25) {
    lot_type = "GreaterThanOneQuarterAcre";
  } else {
    lot_type = "LessThanOrEqualToOneQuarterAcre";
  }
  return {
    lot_type: lot_type ?? null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
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

function extractAddressText($) {
  const line1 = parseAddressSection($, 'Physical Street Address');
  const line2 = parseAddressSection($, 'Postal City and Zip');
  if (line1 && line2) {
    return `${line1.formatted}, ${line2.formatted}`;
  } else if (line1) {
    return line1.formatted;
  } else if (line2) {
    return line2.formatted;
  }
  return null;
}

function extractOwnerMailingAddress($) {
  const lines = parseAddressSection($, 'Mailing Address');
  if (lines) {
    return lines.formatted;
  }
  return null;
}

function getCellText(cell) {
  if (!cell || !cell.length) {
    return '';
  }
  const clone = cell.clone();
  clone.find('br').replaceWith(' ');
  return cleanText(clone.text());
}

function cleanText(value) {
  if (!value) {
    return '';
  }
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseAddressSection($, headingText) {
  if (!headingText) {
    return null;
  }

  const heading = $('h4')
    .filter((_, el) => cleanText($(el).text()).startsWith(headingText))
    .first();
  if (!heading.length) {
    return null;
  }

  const table = heading.nextAll('table').first();
  if (!table.length) {
    return null;
  }

  const lines = table
    .find('tr')
    .map((_, row) => {
      const cell = $(row).find('td').last();
      const text = getCellText(cell);
      return text || null;
    })
    .get()
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  return {
    lines,
    formatted: lines.join(', '),
  };
}

function attemptWriteAddress(unnorm, siteAddress, mailingAddress) {
  let hasOwnerMailingAddress = false;
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
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

  // Property
  const property = extractProperty($, seed);
  writeJSON(path.join("data", "property.json"), property);
  writeJSON(path.join("data", "parcel.json"), {parcel_identifier: parcelId || ""});

  const addressText = extractAddressText($);
  const mailingAddress = extractOwnerMailingAddress($);
  const hasOwnerMailingAddress = attemptWriteAddress(unaddr, addressText, mailingAddress);

  // Lot
  const lot = extractLot($);
  writeJSON(path.join("data", "lot.json"), lot);

  // Tax current year (from Value Summary)
  const taxCurrent = extractTaxCurrent($);
  if (taxCurrent.tax_year) {
    writeJSON(path.join("data", `tax_${taxCurrent.tax_year}.json`), taxCurrent);
  }

  // Tax prior years (from Prior Year Final Values)
  const taxPrior = extractTaxPriorYears($);
  taxPrior.forEach((t) => {
    if (t.tax_year) {
      writeJSON(path.join("data", `tax_${t.tax_year}.json`), t);
    }
  });

  // Sales
  const sales = extractSales($);
  sales.forEach((s, idx) => {
    const saleOut = {
      ownership_transfer_date: s.ownership_transfer_date || null,
      purchase_price_amount: s.purchase_price_amount ?? null,
    };
    writeJSON(path.join("data", `sales_${idx + 1}.json`), saleOut);
    let deed = { deed_type: s.instrumentType };
    if (s.book) {
      deed.book = s.book;
    }
    if (s.page) {
      deed.page = s.page;
    }
    writeJSON(path.join("data", `deed_${idx + 1}.json`), deed);
    
    let fileName = deed.book && deed.page ? `${deed.book}/${deed.page}` : null;
    const file = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: fileName ? `Deed ${fileName}` : "Deed Document",
      original_url: s.link || null,
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
    const g = normalizeNameForMatch(s.grantee);
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