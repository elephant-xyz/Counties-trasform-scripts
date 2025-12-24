const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping = [
  {
    "property_usecode": "FEDERAL (008800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "MOBILE HOMES (000200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "MobileHome"
  },
  {
    "property_usecode": "SINGLE FAMILY (000100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "MOBILE HOMES (000220)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "MobileHome"
  },
  {
    "property_usecode": "VACANT - RESIDENTIAL (000000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SINGLE FAMILY - STORAGE/BARN (000184)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "VACANT - EXTRA FEATURES (000070)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "TIMBERLAND - SITE INDEX 80 - 89 (005500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "GRAZING LAND 1 (006000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MINING (009200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SINGLE FAMILY - COMMERCIAL (000110)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Commercial",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "CHURCHES (007100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT - COMMERCIAL/EXTRA FEATURES (001010)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STORES - 1 STORY (001100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT - COMMERCIAL (001000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STATE (008700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE - MINI/SELF STORAGE (004883)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE - STORAGE (004800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "LUMBER YARDS (004300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT IND/XFOB (004110)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "GAS SYSTEM (009150)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - 1 STORY (001700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "VEHICLE SALES/REPAIR (002700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "PRIVATE SCHOOLS AND COLLEGES (007200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "COUNTY (008600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "MORTUARIES/CEMETERIES (007600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "NON-AGRICULTURAL ACREAGE (009900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CROPLAND CLASS 2 (005200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "HOLDING POND (009706)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "COMMON AREA (009705)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "ResidentialCommonElementsAreas"
  },
  {
    "property_usecode": "UTILITY (009100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "RIGHTS-OF-WAY (009400)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "VACANT - GOVERNMENTAL/WATER MANAGEMENT (008000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "WASTE LAND, DUMP, PITS, SWAMPS, MARSH (009600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SINGLE FAMILY - MODULAR HOME (000105)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "TIMBERLAND - SITE INDEX 70 - 79 (005600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SINGLE FAMILY - BAYOU (000120)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "SINGLE FAMILY - BAYFRONT (000130)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "TIMBERLAND - SITE INDEX 90 AND ABOVE (005400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CROPLAND CLASS 3 (005300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "FOREST, PARKS, TIITF (008200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "VACANT - INDUSTRIAL (004000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MULTI-FAMILY - LESS THAN 10 UNITS (000800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyLessThan10"
  },
  {
    "property_usecode": "SUB-SURFACE RIGHTS (009300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MINERAL RIGHT (009700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STORES - CONVENIENCE (001101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "PARKING LOTS/MOBILE HOME PARKS (002800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SINGLE FAMILY - SOUND (000133)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "SINGLE FAMILY - SUPER STRUCTURE (000107)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "SINGLE FAMILY - CANAL (000131)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "SINGLE FAMILY - TOWNHOUSE (000109)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Townhouse"
  },
  {
    "property_usecode": "MIXED GROVE (006640)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CROPLAND CLASS 1 (005100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CAR WASH (002585)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "SINGLE FAMILY - RIVER (000132)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "PUBLIC SCHOOLS (008300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "VOLUNTEER FIRE DEPARTMENT (007704)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - MODULAR (001702)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "RETAIL - MULTI-TENANT (001611)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "LIGHT MANUFACTURING (004100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "COMM / XFOB (001199)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "WATER SYSTEM (009140)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CLUBS/LODGES/UNION HALLS (007700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "SINGLE FAMILY - LAKE (000134)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "RIVERS, LAKES (009500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SINGLE FAMILY - GOLF (000140)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "GOLF COURSES (003800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL (008900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "CELL TOWERS (004199)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CULTURAL ORGANIZATIONS (007900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "SUPERMARKETS (001400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STORES - OFFICE/RESIDENTIAL (001200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SERVICE/REPAIR SHOPS (002500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "FINANCIAL INSTITUTIONS (002300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESSIONAL SERVICE BUILDINGS (001900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "BEAUTY/BARBER SHOPS (002525)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "RESTAURANTS/CAFETERIAS (002100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "RESTAURANTS - FAST FOOD (002157)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - INSURANCE COMPANY (002400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - MEDICAL (001952)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL - SPORTS/RECREATIONAL (008910)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "RETIREMENT HOMES (000600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTI-FAMILY - 10 UNITS OR MORE (000300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "NIGHTCLUBS/BARS (003300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - MULTI STORY (001800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "TOURIST ATTRACTIONS (003500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT - INSTITUTIONAL (007000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "OFFICES - MULTI-TENANT (001711)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT - INSTITUTIONAL/EXTRA FEATURES (007010)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "NON-PROFIT SERVICES (007500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "STORES - DISCOUNT (001136)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "OTHER FOOD PROCESSING (004600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "GRAZING LAND 2 (006100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CAMPS (003600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SHOPPING CENTERS - COMMUNITY (001600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "HOTELS/MOTELS (003900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "POST OFFICE (008879)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "SHOPPING CENTERS - NEIGHBORHOOD (001638)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "DEPARTMENT STORES (001300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "ORNAMENTALS, MISCELLANEOUS (006900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "NURSERY (006930)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CONSERVATION PARCEL (009703)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "GYM/FITNESS CENTERS (003435)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "WHOLESALE OUTLETS (002900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "PRIVATE HOSPITALS (007300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "CONDOMINIUM - OFFICE (000417)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Condominium"
  },
  {
    "property_usecode": "TIMBERLAND - SITE INDEX 60 - 69 (005700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "COE WETLANDS (009620)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MILITARY (008100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "FLORISTS/GREENHOUSES (003000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CONDOMINIUMS (000400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Condominium"
  },
  {
    "property_usecode": "INDUSTRIAL - OFFICES (004177)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "BLUEBERRIES (006614)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "COUNTY - SPORTS/RECREATIONAL (008610)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL - ADMINISTRATION (008920)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "AQUACULTURE (006720)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "RESTAURANTS - DRIVE-IN (002200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "COLLEGES (008400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "LAUNDRY/DRYCLEANERS (002534)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "POULTRY, BEES, FISH (006700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "ORCHARD GORVES, CITRUS, ETC (006600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STATE - SPORTS/RECREATIONAL (008710)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE - BOAT STORAGE (004805)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "OPEN STORAGE (004900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "WETLANDS (009610)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "FLEA MARKET (001111)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CELL SITE (001099)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STORES - SUPER DISCOUNT (001137)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "ROAD (009707)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "THEATERS/AUDITORIUMS (003200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "RACE TRACKS (003700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "HEAVY INDUSTRIAL (004200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "PARKING/MH PARK (002802)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "CHURCHES - SINGLE-FAMILY RESIDENTIAL (007101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE - COMPLEX (004809)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "RV PARKS (002825)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "COUNTY - ADMINISTRATION (008620)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "CANNERIES/BOTTLERS (004500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "TELECOMMUNICATION (009110)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "GRAZING LAND 3 (006200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "ZOO (003510)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "SWINE (006820)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MUNICIPAL - PUBLIC WORKS (008930)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "SANITARIUMS, CONVALESCENT, AND REST HOMES (007800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "SEWAGE SYSTEM (009120)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "SERVICE STATIONS (002600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "BOWLING/RECREATION (003400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "MINERAL PROCESSING (004700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "GRAZING LAND 4 (006300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "STATE - PRISON (008787)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "CONDOMINIUM PARKING SPACE (000004)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Condominium"
  },
  {
    "property_usecode": "HOMES FOR THE AGED (007400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "HOSPITALS (008500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": null,
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICES - COMPLEX (001709)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "AIRPORTS/TRANSIT TERMINALS/MARINAS (002000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "CENTERALLY ASSESSED (009800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  }
];

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function emptyDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.rmSync(path.join(p, f), { recursive: true, force: true });
  }
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const seed = readJSON("property_seed.json");
const appendSourceInfo = (seed) => ({
  source_http_request: {
    method: "GET",
    url: seed?.source_http_request?.url || null,
    multiValueQueryString: seed?.source_http_request?.multiValueQueryString || null,
  },
  request_identifier: seed?.request_identifier || seed?.parcel_id || "",
  });

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function titleCaseName(s) {
  if (!s) return s;

  // First, aggressively normalize consecutive special characters
  // Replace any sequence of 2+ same special characters with single occurrence
  let normalized = s
    .replace(/[-]{2,}/g, "-")  // Replace multiple hyphens with single hyphen
    .replace(/\s{2,}/g, " ")   // Replace multiple spaces with single space
    .replace(/[.]{2,}/g, ".")  // Replace multiple periods with single period
    .replace(/[\']{2,}/g, "'")  // Replace multiple apostrophes with single apostrophe
    .replace(/[,]{2,}/g, ",")  // Replace multiple commas with single comma
    .trim();

  // Remove any mixed consecutive special characters (e.g., "- -" or " -")
  // This ensures only single special character separators remain
  normalized = normalized.replace(/([ \-',.])+([ \-',.]+)/g, "$1");

  // Split on delimiters but keep them in the result
  // This handles spaces, hyphens, apostrophes, commas, and periods
  return normalized
    .toLowerCase()
    .split(/([ \-',.])/)  // Split but keep delimiters
    .map((part, idx, arr) => {
      // If this is a delimiter, keep it as is
      if (/^[ \-',.]$/.test(part)) return part;
      // If empty, skip
      if (!part) return part;
      // Capitalize first letter of each word part
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function parseRemixContext(html) {
  const m = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

function parseSitusParts(situs) {
  if (!situs) return {};
  let situs_parts =  situs.split(",").map((s) => s.trim());
  let addr = situs_parts[0];
  let city = null;
  let zip = null;
  for (var i=2; i < situs_parts.length; i++) {
      if (situs_parts[i] && situs_parts[i].match(/^\d{5}$/)) {
        zip = situs_parts[i];
        city = situs_parts[i - 1];
        break;
      }
  }
  // const [addr, city, zip] = situs.split(",").map((s) => s.trim());
  const parts = (addr || "").split(/\s+/);
  let street_number = null;
  if (parts && parts.length > 1) {
    street_number_candidate = parts[0];
    if ((street_number_candidate || "") && isNumeric(street_number_candidate)) {
      street_number = parts.shift() || null;
    }
  }
  let suffix = null;
  if (parts && parts.length > 1) {
    suffix_candidate = parts[parts.length - 1];
    if (normalizeSuffix(suffix_candidate)) {
      suffix = parts.pop() || null;
    }
  }
  let street_name = parts.join(" ") || null;
  if (street_name) {
    street_name = street_name.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/g, "");
  }
  return {
    street_number,
    street_name,
    street_suffix: suffix,
    city_name: city || null,
    postal_code: zip || null,
  };
}

function normalizeSuffix(s) {
  if (!s) return null;
  const map = {
    ALY: "Aly",
    AVE: "Ave",
    AV: "Ave",
    BLVD: "Blvd",
    BND: "Bnd",
    CIR: "Cir",
    CIRS: "Cirs",
    CRK: "Crk",
    CT: "Ct",
    CTR: "Ctr",
    CTRS: "Ctrs",
    CV: "Cv",
    CYN: "Cyn",
    DR: "Dr",
    DRS: "Drs",
    EXPY: "Expy",
    FWY: "Fwy",
    GRN: "Grn",
    GRNS: "Grns",
    GRV: "Grv",
    GRVS: "Grvs",
    HWY: "Hwy",
    HL: "Hl",
    HLS: "Hls",
    HOLW: "Holw",
    JCT: "Jct",
    JCTS: "Jcts",
    LN: "Ln",
    LOOP: "Loop",
    MALL: "Mall",
    MDW: "Mdw",
    MDWS: "Mdws",
    MEWS: "Mews",
    ML: "Ml",
    MNRS: "Mnrs",
    MT: "Mt",
    MTN: "Mtn",
    MTNS: "Mtns",
    OPAS: "Opas",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PATH: "Path",
    PIKE: "Pike",
    PL: "Pl",
    PLN: "Pln",
    PLNS: "Plns",
    PLZ: "Plz",
    PT: "Pt",
    PTS: "Pts",
    PNE: "Pne",
    PNES: "Pnes",
    RADL: "Radl",
    RD: "Rd",
    RDG: "Rdg",
    RDGS: "Rdgs",
    RIV: "Riv",
    ROW: "Row",
    RTE: "Rte",
    RUN: "Run",
    SHL: "Shl",
    SHLS: "Shls",
    SHR: "Shr",
    SHRS: "Shrs",
    SMT: "Smt",
    SQ: "Sq",
    SQS: "Sqs",
    ST: "St",
    STA: "Sta",
    STRA: "Stra",
    STRM: "Strm",
    TER: "Ter",
    TPKE: "Tpke",
    TRL: "Trl",
    TRCE: "Trce",
    UN: "Un",
    VIS: "Vis",
    VLY: "Vly",
    VLYS: "Vlys",
    VIA: "Via",
    VL: "Vl",
    VLGS: "Vlgs",
    VWS: "Vws",
    WALK: "Walk",
    WALL: "Wall",
    WAY: "Way",
  };
  const key = s.toUpperCase().trim();
  if (map[key]) return map[key];
  return null;
}

function extractBookPageLinks($) {
  const map = {};
  $("#salesContainer table tbody tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length === 9) {
      const $bookCell = $($tds.get(4));
      const a = $bookCell.find("a");
      if (a && a.attr("href")) {
        const text = a.text().replace(/\s+/g, "");
        const m = text.match(/(\d+)\/(\d+)/);
        if (m) map[`${m[1]}/${m[2]}`] = a.attr("href");
      } else {
        const spanText = $bookCell.text().trim().replace(/\s+/g, "");
        const m = spanText.match(/(\d+)\/(\d+)/);
        if (m) map[`${m[1]}/${m[2]}`] = null;
      }
    }
  });
  return map;
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function parseValuationTable($) {
  // Return { [year]: { [label]: number } }
  const out = {};
  const $table = $("#valuationContainer table").first();
  if (!$table.length) return out;
  const $rows = $table.find("tbody > tr");
  if (!$rows.length) return out;
  // First row: headers containing years
  const $headerRow = $rows.eq(0);
  const years = [];
  $headerRow.find("th").each((i, th) => {
    const t = $(th).text().trim();
    const m = t.match(/(\d{4})/);
    if (m) years.push(parseInt(m[1], 10));
  });
  // For each subsequent row, map label -> values
  $rows.slice(1).each((ri, tr) => {
    const $tr = $(tr);
    const label = $tr.find("th").first().text().trim();
    if (!label) return;
    const $cells = $tr.find("td");
    $cells.each((ci, td) => {
      const year = years[ci];
      if (!year) return;
      const raw = $(td).text().trim();
      const num = raw ? Number(raw.replace(/[$,]/g, "")) : 0;
      if (!out[year]) out[year] = {};
      out[year][label] = isNaN(num) ? null : num;
    });
  });
  return out;
}

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }

  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();

  if (!normalizedUseCode) {
    return lookup;
  }

  lookup[normalizedUseCode] = entry;
  return lookup;
}, {});

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;

  const normalizedInput = String(code).replace(/\s+/g, "").toUpperCase();
  if (!normalizedInput) return null;

  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
  }

  return null;
}

function mapPropertyType(parcelInfo) {
  if (parcelInfo && parcelInfo.propertyUsage) {
    return mapPropertyTypeFromUseCode(parcelInfo.propertyUsage);
  }
  throw null;
}

function buildProperty(parcelId, propertyMapping, parcelInfo, remixData, buildings, sourceHttpRequest) {
  const units = (buildings.units && buildings.units.length ? buildings.units : []) || [];
  const firstUnit = (buildings.units && buildings.units.length ? buildings.units[0] : {}) || {};
  
  let totalAreaSum = 0;
  let hasValidArea = false;
  
  units.forEach(unit => {
    if (unit.squareFeet && unit.squareFeet.actual != null) {
      totalAreaSum += unit.squareFeet.actual;
      hasValidArea = true;
    }
  });
  
  let structureBuiltYear = firstUnit.yearBuilt && firstUnit.yearBuilt.actual
        ? firstUnit.yearBuilt.actual
        : null;
  let effectiveBuiltYear = firstUnit.yearBuilt && firstUnit.yearBuilt.effective
        ? firstUnit.yearBuilt.effective
        : null;
        
  const condoInfo = remixData.condoInfo || null;
  if (condoInfo) {
    let squareFootage = condoInfo.squareFootage ? condoInfo.squareFootage : 0;
    totalAreaSum += squareFootage;
    hasValidArea = true;
    structureBuiltYear = condoInfo.yearBuilt && condoInfo.yearBuilt.actual
      ? condoInfo.yearBuilt.actual
      : null;
    effectiveBuiltYear = condoInfo.yearBuilt && condoInfo.yearBuilt.effective
      ? condoInfo.yearBuilt.effective
      : null;
  }
  
  return {
    parcel_identifier: parcelId,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    property_structure_built_year: structureBuiltYear,
    property_legal_description_text: parcelInfo.legalDescription || null,
    subdivision: null,
    zoning:
      remixData.zonings && remixData.zonings.length
        ? remixData.zonings[0].code
        : null,
    number_of_units: units.length || 1,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
}

function buildAddressAndGeometry(parcelId, parcelInfo, remixData, unnormalized, $, sourceHttpRequest, dataDir) {
  // Try to get address from multiple sources in priority order:
  // 1. unnormalized.full_address from input file (most reliable)
  // 2. parcelInfo.situs from remix data
  // 3. Scraped from HTML

  // Start with full_address from input file if available
  let situs = null;
  if (unnormalized && unnormalized.full_address && unnormalized.full_address.trim()) {
    situs = unnormalized.full_address.trim();
  } else {
    // Fall back to parcelInfo.situs or HTML scraping
    situs = parcelInfo.situs || $('td[data-cell="Situs/Physical Address"]').text().trim();
    // Ensure situs is not just whitespace
    if (situs && !situs.trim()) {
      situs = null;
    }
  }

  const sectionTownRange = (
    parcelInfo.sectionTownshipRange ||
    $('td[data-cell="Section-Township-Range"]').text().trim() ||
    ""
  ).trim();
  let section = null,
    township = null,
    range = null;
  if (sectionTownRange) {
    const parts = sectionTownRange.split("-");
    if (parts.length === 3) {
      section = parts[0];
      township = parts[1];
      range = parts[2];
    }
  }

  // Extract county_name from unnormalized input or remix data
  let county_name = null;
  if (unnormalized && unnormalized.county_jurisdiction) {
    county_name = unnormalized.county_jurisdiction.trim() || null;
  } else if (unnormalized && unnormalized.county_name) {
    county_name = unnormalized.county_name.trim() || null;
  }

  // Check if we have a valid address for unnormalized format
  // CRITICAL: unnormalized_address must satisfy minLength: 1 constraint (never empty string)
  // Ensure trimmedSitus is never an empty string - use null instead
  let trimmedSitus = null;
  if (situs) {
    const trimmed = situs.trim();
    // Only set trimmedSitus if it's a non-empty string after trimming
    if (trimmed && trimmed.length > 0) {
      trimmedSitus = trimmed;
    }
  }

  let hasValidSitus = false;

  if (trimmedSitus && trimmedSitus.length > 0) {
    // Clean up the situs string - remove excessive punctuation and whitespace
    const cleanedSitus = trimmedSitus.replace(/[,\s]+/g, ' ').trim();

    // Check if we have a meaningful address (not just punctuation or state code)
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(cleanedSitus);
    const withoutPunctuation = cleanedSitus.replace(/[,\s]/g, ''); // Remove all commas and spaces
    const hasMoreThanStateCode = withoutPunctuation.length > 2; // More than just state abbreviation
    const hasActualAddressContent = /\d/.test(cleanedSitus) || withoutPunctuation.length > 10; // Has numbers or substantial text

    // CRITICAL: Reject addresses that are just state codes (e.g., "FL", "CA") or minimal content
    // Check if it's just a 2-letter state code or similar minimal content
    const isJustStateCode = /^[A-Z]{2}$/i.test(withoutPunctuation);

    hasValidSitus = hasAlphanumeric && hasMoreThanStateCode && hasActualAddressContent && !isJustStateCode;

    // Double-check: if after all validation cleanedSitus is effectively empty, mark as invalid
    if (!cleanedSitus || cleanedSitus.length === 0) {
      hasValidSitus = false;
    }

    // CRITICAL: Additional check - if validation failed, reset trimmedSitus to null
    // This ensures we never try to use an invalid address string in unnormalized format
    if (!hasValidSitus) {
      trimmedSitus = null;
    }
  }

  let address;

  // CRITICAL: Address must use either unnormalized OR normalized format (oneOf constraint)
  // - Unnormalized format: unnormalized_address (minLength: 1) + optional fields
  // - Normalized format: all required normalized fields + NO unnormalized_address
  // NEVER set unnormalized_address to empty string or include it in normalized format
  // TRIPLE CHECK: Ensure trimmedSitus is valid, non-empty, and meaningful before using unnormalized format
  const finalTrimmedAddress = trimmedSitus ? String(trimmedSitus).trim() : "";
  const canUseUnnormalized = hasValidSitus &&
                              finalTrimmedAddress &&
                              typeof finalTrimmedAddress === 'string' &&
                              finalTrimmedAddress.length > 0;

  if (canUseUnnormalized) {
    // Use unnormalized format when we have a valid address string
    // CRITICAL: Ensure unnormalized_address is NEVER an empty string (minLength: 1)
    // Final defensive check: verify address is not empty after all validation
    address = {
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
      unnormalized_address: finalTrimmedAddress
    };

    // Add optional location fields if available
    if (county_name) address.county_name = county_name;
    if (section) address.section = section;
    if (township) address.township = township;
    if (range) address.range = range;
  } else {
    // Use normalized format when we don't have a valid street address
    // CRITICAL: DO NOT include unnormalized_address in normalized format
    // Include all required normalized fields (even if null) per schema
    address = {
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
      street_number: null,
      street_name: null,
      street_pre_directional_text: null,
      street_post_directional_text: null,
      street_suffix_type: null,
      unit_identifier: null,
      city_name: null,
      state_code: "FL",
      postal_code: null,
      plus_four_postal_code: null,
      country_code: "US",
      route_number: null,
      block: null
    };

    // Add optional location fields if available
    if (county_name) address.county_name = county_name;
    if (section) address.section = section;
    if (township) address.township = township;
    if (range) address.range = range;
  }

  writeJSON(path.join(dataDir, "address.json"), address);

  // Create relationship between property and address
  const relPropertyAddress = {
    from: { "/": "./property.json" },
    to: { "/": "./address.json" }
  };
  writeJSON(path.join(dataDir, "relationship_property_has_address.json"), relPropertyAddress);

  //Geometry creation
  const geometry = {
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
    latitude: unnormalized && unnormalized.latitude ? unnormalized.latitude : null,
    longitude: unnormalized && unnormalized.longitude ? unnormalized.longitude : null
  };
  writeJSON(path.join(dataDir, "geometry.json"), geometry);
  
  // Create relationship between address and geometry
  const relAddressGeometry = {
    from: { "/": "./address.json" },
    to: { "/": "./geometry.json" }
  };
  writeJSON(path.join(dataDir, "relationship_address_has_geometry.json"), relAddressGeometry);
  
}

function buildTaxes(parcelId, remixData, $, sourceHttpRequest, dataDir) {
  const valuationValues = (remixData.valuation && remixData.valuation.values) || [];
  const valuationTable = parseValuationTable($);
  
  function valFor(year, desc) {
    const v = valuationValues.find(
      (v) => v.taxYear === year && v.valueType && v.valueType.description === desc,
    );
    if (v) return v.amount;
    const rowMap = valuationTable[year] || {};
    if (rowMap[desc] !== undefined) return rowMap[desc];
    return null;
  }
  
  function writeTax(year) {
    const assessed = valFor(year, "Co. Assessed Value");
    const market = valFor(year, "Just (Market) Value");
    const building = valFor(year, "Building Value");
    const landVal = valFor(year, "Land Value");
    const exempt = valFor(year, "Exempt Value");
    const agricultural = valFor(year, "Agricultural (Market) Value");
    let taxable = valFor(year, "Co. Taxable Value");
    if (taxable === null || taxable === undefined) {
      if (
        valuationTable[year] &&
        valuationTable[year]["Co. Taxable Value"] !== undefined
      )
        taxable = valuationTable[year]["Co. Taxable Value"] || 0;
    }
    const taxOut = {
      tax_year: year,
      property_assessed_value_amount: assessed,
      property_market_value_amount: market,
      property_building_amount: building,
      property_land_amount: landVal,
      property_taxable_value_amount: taxable,
      property_exemption_amount: exempt,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };

    // CRITICAL: Only include agricultural_valuation_amount if it's a valid number
    // Schema requires type: "number" (not nullable), so never include null/undefined
    // The field must be omitted entirely if not a valid number
    // Add multiple defensive checks to ensure null/undefined is never set
    if (agricultural !== null && agricultural !== undefined &&
        typeof agricultural === 'number' && Number.isFinite(agricultural)) {
      taxOut.agricultural_valuation_amount = agricultural;
    }
    // Note: If agricultural is null/undefined/NaN/invalid, the field is completely omitted from taxOut

    writeJSON(path.join(dataDir, `tax_${year}.json`), taxOut);
  }
  
  [2023, 2024, 2025].forEach(writeTax);
}

let people = [];
let companies = [];

function findPersonIndexByName(first, last) {
  const tf = titleCaseName(first);
  const tl = titleCaseName(last);
  for (let i = 0; i < people.length; i++) {
    if (people[i].first_name === tf && people[i].last_name === tl)
      return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  // console.log(companies)
  const tn = (name || "").trim();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  return null;
}

function buildSalesDeedFileOwnersAndRelationships(parcelId, remixData, $, ownersData, sourceHttpRequest, dataDir) {
  const sales = (remixData.sales || []).map((s) => s.record);
  // console.log("sales",sales)
  const bookPageLinks = extractBookPageLinks($);

  let ownersByDate = {};
  if (ownersData) {
    const key = `property_${parcelId}`;
    const od = ownersData[key] || {};
    ownersByDate = od.owners_by_date || {};
  }
  // console.log("ownersByDate/n",ownersByDate)

  // Remove records with keys starting with 'unknown_date_'
  Object.keys(ownersByDate).forEach(key => {
    if (key.startsWith('unknown_date_')) {
      console.log("removing unknown date owner",key)
      delete ownersByDate[key];
    }
  });


  //Person creation
  const personMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (!personMap.has(k))
          personMap.set(k, {
            first_name: o.first_name,
            middle_name: o.middle_name,
            last_name: o.last_name,
            prefix_name: o.prefix_name || null,
            suffix_name: o.suffix_name || null
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && o.middle_name)
            existing.middle_name = o.middle_name;
        }
      }
    });
  });
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: p.prefix_name,
    suffix_name: p.suffix_name,
    us_citizenship_status: null,
    veteran_status: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const personPaths = [];
  // console.log("People",people)
  people.forEach((p, idx) => {
    writeJSON(path.join(dataDir, `person_${idx + 1}.json`), p);
    personPaths.push(`./person_${idx + 1}.json`);
  });

  //Company creation
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  companies = Array.from(companyNames).map((n) => ({ 
    name: n,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const companyPaths = [];
  companies.forEach((c, idx) => {
    writeJSON(path.join(dataDir, `company_${idx + 1}.json`), c);
    companyPaths.push(`./company_${idx + 1}.json`);
  });
  console.log("Companies",companies)
  // function findPersonIndexByName(first, last) {
  //   const tf = titleCaseName(first);
  //   const tl = titleCaseName(last);
  //   for (let i = 0; i < people.length; i++) {
  //     if (people[i].first_name === tf && people[i].last_name === tl)
  //       return i + 1;
  //   }
  //   return null;
  // }
  // function findCompanyIndexByName(name) {
  //   const tn = (name || "").trim();
  //   for (let i = 0; i < companies.length; i++) {
  //     if ((companies[i].name || "").trim() === tn) return i + 1;
  //   }
  //   return null;
  // }

  const salesPaths = [];
  const deedPaths = [];
  const filePaths = [];

  //Sales,Deed,Files file creations.
  sales.forEach((rec, idx) => {
    const sIndex = idx + 1;
    const saleOut = {
      ownership_transfer_date: toISODate(rec.date),
      purchase_price_amount:
        typeof rec.price === "number"
          ? rec.price
          : rec.price
            ? Number(String(rec.price).replace(/[$,]/g, ""))
            : null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `sales_${sIndex}.json`), saleOut);
    salesPaths.push(`./sales_${sIndex}.json`);

    let deedType = null;
    const inst = (rec.instrument || "").toUpperCase();
    if (inst === "N/A") deedType = null;
    else if (inst === "WD") deedType = "Warranty Deed";
    else if (inst === "SWD" || inst === "SW") deedType = "Special Warranty Deed";
    else if (inst === "QCD" || inst === "QD") deedType = "Quitclaim Deed";
    else if (inst === "GD") deedType = "Grant Deed";
    else if (inst === "BSD") deedType = "Bargain and Sale Deed";
    else if (inst === "LBD") deedType = "Lady Bird Deed";
    else if (inst === "TOD") deedType = "Transfer on Death Deed";
    else if (inst === "SD") deedType = "Sheriff's Deed";
    else if (inst === "TX") deedType = "Tax Deed";
    else if (inst === "TD") deedType = "Trustee's Deed";
    else if (inst === "PRD") deedType = "Personal Representative Deed";
    else if (inst === "CD") deedType = "Correction Deed";
    else if (inst === "DILF") deedType = "Deed in Lieu of Foreclosure";
    else if (inst === "LED") deedType = "Life Estate Deed";
    else if (inst === "JTD") deedType = "Joint Tenancy Deed";
    else if (inst === "TCD") deedType = "Tenancy in Common Deed";
    else if (inst === "CPD") deedType = "Community Property Deed";
    else if (inst === "GIFT") deedType = "Gift Deed";
    else if (inst === "ITD") deedType = "Interspousal Transfer Deed";
    else if (inst === "WLD") deedType = "Wild Deed";
    else if (inst === "SMD") deedType = "Special Master's Deed";
    else if (inst === "COD") deedType = "Court Order Deed";
    else if (inst === "CFD") deedType = "Contract for Deed";
    else if (inst === "QTD") deedType = "Quiet Title Deed";
    else if (inst === "AD") deedType = "Administrator's Deed";
    else if (inst === "GUD") deedType = "Guardian's Deed";
    else if (inst === "RD") deedType = "Receiver's Deed";
    else if (inst === "ROW") deedType = "Right of Way Deed";
    else if (inst === "VPD") deedType = "Vacation of Plat Deed";
    else if (inst === "AOC") deedType = "Assignment of Contract";
    else if (inst === "ROC") deedType = "Release of Contract";
    else if (inst) deedType = "Miscellaneous";
    
    if (rec.book || rec.page || deedType) {
      const deedOut = {
        source_http_request: sourceHttpRequest,
        request_identifier: parcelId,
        book: rec.book || null,
        page: rec.page || null
      };
      
      if (deedType) {
        deedOut.deed_type = deedType;
      }
      
      writeJSON(path.join(dataDir, `deed_${sIndex}.json`), deedOut);
      deedPaths.push(`./deed_${sIndex}.json`);
    }

    const key = `${rec.book}/${rec.page}`;
    const original_url = bookPageLinks[key] || null;
    
    if (original_url) {
      let document_type = null;
      if (inst === "WD") document_type = "ConveyanceDeedWarrantyDeed";
      else if (inst === "TX") document_type = "ConveyanceDeed";
      
      const fileOut = {
        file_format: null,
        name:
          rec.book && rec.page
            ? `OR ${rec.book}/${rec.page}`
            : path.basename(original_url),
        original_url: original_url,
        ipfs_url: null,
        document_type: "Title",
        source_http_request: sourceHttpRequest,
        request_identifier: parcelId,
      };
      writeJSON(path.join(dataDir, `file_${sIndex}.json`), fileOut);
      filePaths.push(`./file_${sIndex}.json`);
    }
  });


  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = toISODate(rec.date);
    console.log(d)
    const ownersOnDate = ownersByDate[d] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_person_${relPersonCounter}.json`,
            ),
            {
              from: { "/": `./sales_${idx + 1}.json` },
              to: { "/": `./person_${pIdx}.json` }
            },
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx) {
          relCompanyCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_company_${relCompanyCounter}.json`,
            ),
            {
              from: { "/": `./sales_${idx + 1}.json` },
              to: { "/": `./company_${cIdx}.json` }
            },
          );
        }
      });
  });
  
  // Create relationship between current owner and first sale (sales_1) if not already created
  if (sales.length > 0) {
    const firstSaleDate = toISODate(sales[0].date);
    const ownersOnFirstSale = ownersByDate[firstSaleDate] || [];
    const currentOwners = ownersByDate["current"] || [];
    
    currentOwners.forEach((owner) => {
      // Check if this owner already has a relationship with sales_1
      const alreadyLinked = ownersOnFirstSale.some(existingOwner => {
        if (owner.type === "person" && existingOwner.type === "person") {
          return owner.first_name === existingOwner.first_name && owner.last_name === existingOwner.last_name;
        }
        if (owner.type === "company" && existingOwner.type === "company") {
          return owner.name === existingOwner.name;
        }
        return false;
      });
      
      if (!alreadyLinked) {
        if (owner.type === "person") {
          const pIdx = findPersonIndexByName(owner.first_name, owner.last_name);
          if (pIdx) {
            relPersonCounter++;
            writeJSON(
              path.join(
                "data",
                `relationship_sales_person_${relPersonCounter}.json`,
              ),
              {
                from: { "/": "./sales_1.json" },
                to: { "/": `./person_${pIdx}.json` }
              },
            );
          }
        } else if (owner.type === "company") {
          const cIdx = findCompanyIndexByName(owner.name);
          if (cIdx) {
            relCompanyCounter++;
            writeJSON(
              path.join(
                "data",
                `relationship_sales_company_${relCompanyCounter}.json`,
              ),
              {
                from: { "/": "./sales_1.json" },
                to: { "/": `./company_${cIdx}.json` }
              },
            );
          }
        }
      }
    });
  }  

  // //Sales-->Owners mapping creation
  // let relPersonCounter = 0;
  // let relCompanyCounter = 0;
  // // console.log(":SALES",sales)
  // sales.forEach((rec, idx) => {
  //   const d = toISODate(rec.date);
  //   const ownersOnDate = ownersByDate[d] || [];
  //   console.log("DATE",d,"ownersOnDate", ownersOnDate);
  //   ownersOnDate
  //     .filter((o) => o.type === "person")
  //     .forEach((o) => {
  //       const pIdx = findPersonIndexByName(o.first_name, o.last_name);
  //       if (pIdx) {
  //         relPersonCounter++;
  //         writeJSON(
  //           path.join(
  //             dataDir,
  //             `relationship_sales_person_${relPersonCounter}.json`,
  //           ),
  //           {
  //             from: { "/": `./sales_${idx + 1}.json` },
  //             to: { "/": `./person_${pIdx}.json` }
  //           },
  //         );
  //       }
  //     });
  //   ownersOnDate
  //     .filter((o) => o.type === "company")
  //     .forEach((o) => {
  //       const cIdx = findCompanyIndexByName(o.name);
  //       if (cIdx) {
  //         relCompanyCounter++;
  //         writeJSON(
  //           path.join(
  //             dataDir,
  //             `relationship_sales_company_${relCompanyCounter}.json`,
  //           ),
  //           {
  //             from: { "/": `./sales_${idx + 1}.json` },
  //             to: { "/": `./company_${cIdx}.json` }
  //           },
  //         );
  //       }
  //     });
  // });

  // Create deed-to-file relationships only when both deed and file exist
  let deedFileCounter = 0;
  sales.forEach((rec, idx) => {
    const sIndex = idx + 1;
    const deedExists = deedPaths.some(path => path === `./deed_${sIndex}.json`);
    const fileExists = filePaths.some(path => path === `./file_${sIndex}.json`);
    if (deedExists && fileExists) {
      deedFileCounter++;
      writeJSON(path.join(dataDir, `relationship_deed_file_${deedFileCounter}.json`), {
        from: { "/": `./deed_${sIndex}.json` },
        to: { "/": `./file_${sIndex}.json` },
      });
    }
  });
  
  // Create sales-to-deed relationships only for deeds that were created
  let salesDeedCounter = 0;
  sales.forEach((rec, idx) => {
    const sIndex = idx + 1;
    const deedExists = deedPaths.some(path => path === `./deed_${sIndex}.json`);
    if (deedExists) {
      salesDeedCounter++;
      writeJSON(path.join(dataDir, `relationship_sales_deed_${salesDeedCounter}.json`), {
        from: { "/": `./sales_${sIndex}.json` },
        to: { "/": `./deed_${sIndex}.json` },
      });
    }
  });
}

function extractMailingAddress($) {
  const addressParts = [];
  
  // Look for ownerInfoContainer
  const ownerContainer = $('#ownerInfoContainer');
  if (ownerContainer.length) {
    // Extract Street address
    const street = ownerContainer.find('td[data-cell="Street"]').text().trim();
    if (street) addressParts.push(street);
    
    // Extract Unit/Suite
    const unit = ownerContainer.find('td[data-cell="Unit"]').text().trim();
    if (unit) addressParts.push(unit);
    
    // Extract City, State, Zip
    const cityStateZip = ownerContainer.find('td[data-cell="City, State, Zip & Country"]').text().trim();
    if (cityStateZip) addressParts.push(cityStateZip);
  }
  
  return addressParts.length > 0 ? addressParts.join('\n') : null;
}

function buildLot(parcelId, parcelInfo, remixData, sourceHttpRequest, dataDir) {
  const land = remixData.land || {};
  const segments = land.segments || [];
  const maxFrontage = segments.reduce(
    (m, s) => (typeof s.frontage === "number" ? Math.max(m, s.frontage) : m),
    0,
  );
  const maxDepth = segments.reduce(
    (m, s) =>
      typeof s.depthAmount === "number" ? Math.max(m, s.depthAmount) : m,
    0,
  );
  const acreage =
    typeof parcelInfo.acreage === "number" ? parcelInfo.acreage : null;
  const sqft = acreage != null ? Math.round(acreage * 43560) : null;
  const lot = {
    lot_type:
      acreage != null
        ? acreage > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre"
        : null,
    lot_length_feet: maxDepth || null,
    lot_width_feet: maxFrontage || null,
    lot_area_sqft: sqft || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);
}



function createStructureFiles(seed,parcelIdentifier) {
  // Create structures for each building
  let structuresData = null;
  let layoutsData = null;
  try {
    structuresData = readJSON(path.join("owners", "structure_data.json"));
  } catch (e) {}
  try {
    layoutsData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) {}
  
  if (structuresData && parcelIdentifier) {
    // console.log("INSIDE")
    const key = `property_${parcelIdentifier}`;
    const structures = structuresData[key]?.structures || [];
    structures.forEach((struct, idx) => {
      const structureOut = {
        ...appendSourceInfo(seed),
        architectural_style_type: struct?.architectural_style_type ?? null,
        attachment_type: struct?.attachment_type ?? null,
        exterior_wall_material_primary: struct?.exterior_wall_material_primary ?? null,
        exterior_wall_material_secondary: struct?.exterior_wall_material_secondary ?? null,
        exterior_wall_condition: struct?.exterior_wall_condition ?? null,
        exterior_wall_insulation_type: struct?.exterior_wall_insulation_type ?? null,
        flooring_material_primary: struct?.flooring_material_primary ?? null,
        flooring_material_secondary: struct?.flooring_material_secondary ?? null,
        subfloor_material: struct?.subfloor_material ?? null,
        flooring_condition: struct?.flooring_condition ?? null,
        interior_wall_structure_material: struct?.interior_wall_structure_material ?? null,
        interior_wall_surface_material_primary: struct?.interior_wall_surface_material_primary ?? null,
        interior_wall_surface_material_secondary: struct?.interior_wall_surface_material_secondary ?? null,
        interior_wall_finish_primary: struct?.interior_wall_finish_primary ?? null,
        interior_wall_finish_secondary: struct?.interior_wall_finish_secondary ?? null,
        interior_wall_condition: struct?.interior_wall_condition ?? null,
        roof_covering_material: struct?.roof_covering_material ?? null,
        roof_underlayment_type: struct?.roof_underlayment_type ?? null,
        roof_structure_material: struct?.roof_structure_material ?? null,
        roof_design_type: struct?.roof_design_type ?? null,
        roof_condition: struct?.roof_condition ?? null,
        roof_age_years: struct?.roof_age_years ?? null,
        gutters_material: struct?.gutters_material ?? null,
        gutters_condition: struct?.gutters_condition ?? null,
        roof_material_type: struct?.roof_material_type ?? null,
        foundation_type: struct?.foundation_type ?? null,
        foundation_material: struct?.foundation_material ?? null,
        foundation_waterproofing: struct?.foundation_waterproofing ?? null,
        foundation_condition: struct?.foundation_condition ?? null,
        ceiling_structure_material: struct?.ceiling_structure_material ?? null,
        ceiling_surface_material: struct?.ceiling_surface_material ?? null,
        ceiling_insulation_type: struct?.ceiling_insulation_type ?? null,
        ceiling_height_average: struct?.ceiling_height_average ?? null,
        ceiling_condition: struct?.ceiling_condition ?? null,
        exterior_door_material: struct?.exterior_door_material ?? null,
        interior_door_material: struct?.interior_door_material ?? null,
        window_frame_material: struct?.window_frame_material ?? null,
        window_glazing_type: struct?.window_glazing_type ?? null,
        window_operation_type: struct?.window_operation_type ?? null,
        window_screen_material: struct?.window_screen_material ?? null,
        primary_framing_material: struct?.primary_framing_material ?? null,
        secondary_framing_material: struct?.secondary_framing_material ?? null,
        structural_damage_indicators: struct?.structural_damage_indicators ?? null,
        finished_base_area: struct?.finished_base_area ?? null,
        finished_basement_area: struct?.finished_basement_area ?? null,
        finished_upper_story_area: struct?.finished_upper_story_area ?? null,
        number_of_stories: struct?.number_of_stories ?? null,
        roof_date: struct?.roof_date ?? null,
        siding_installation_date: struct?.siding_installation_date ?? null,
        exterior_door_installation_date: struct?.exterior_door_installation_date ?? null,
        foundation_repair_date: struct?.foundation_repair_date ?? null,
        window_installation_date: struct?.window_installation_date ?? null
      };
      writeJSON(path.join("data", `structure_${struct.structure_index || idx + 1}.json`), structureOut);
      
      // Create relationship between building layout and structure
      const buildingNumber = struct.building_number || idx + 1;
      const structureIndex = struct.structure_index || idx + 1;
      
      // Find the correct building layout file index
      let buildingLayoutIndex = buildingNumber;
      // console.log("BUILDING_NUMBER",buildingNumber)
      if (layoutsData && parcelIdentifier) {
        // console.log(layoutsData)
        const key = `property_${parcelIdentifier}`;
        const layouts = layoutsData[key]?.layouts || [];
        // console.log(layouts)
        const buildingLayout = layouts.find((layout, layoutIdx) => 
          layout.space_type === "Building" && layout.building_number === buildingNumber
        );
        // console.log("BUILDING_LAYOUT", buildingLayout)
        if (buildingLayout) {
          buildingLayoutIndex = layouts.indexOf(buildingLayout) + 1;
        }
      }
      
      const relationship = {
        from: { "/": `./layout_${buildingLayoutIndex}.json` },
        to: { "/": `./structure_${structureIndex}.json` }
      };
      writeJSON(
        path.join("data", `relationship_layout_${buildingNumber}_has_structure_${structureIndex}.json`),
        relationship
      );
    });
  }


}

function createUtilitiesFiles(seed,parcelIdentifier){
  let utilitiesData = null;
  let layoutsData = null;
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch (e) {}
  try {
    layoutsData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) {}
  
  
  if (utilitiesData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const utilities = utilitiesData[key]?.utilities || [];
    utilities.forEach((util, idx) => {
      const utilityOut = {
        ...appendSourceInfo(seed),
        cooling_system_type: util?.cooling_system_type ?? null,
        heating_system_type: util?.heating_system_type ?? null,
        public_utility_type: util?.public_utility_type ?? null,
        sewer_type: util?.sewer_type ?? null,
        water_source_type: util?.water_source_type ?? null,
        plumbing_system_type: util?.plumbing_system_type ?? null,
        plumbing_system_type_other_description: util?.plumbing_system_type_other_description ?? null,
        electrical_panel_capacity: util?.electrical_panel_capacity ?? null,
        electrical_wiring_type: util?.electrical_wiring_type ?? null,
        hvac_condensing_unit_present: util?.hvac_condensing_unit_present ?? null,
        electrical_wiring_type_other_description: util?.electrical_wiring_type_other_description ?? null,
        solar_panel_present: util?.solar_panel_present ? true : false,
        solar_panel_type: util?.solar_panel_type ?? null,
        solar_panel_type_other_description: util?.solar_panel_type_other_description ?? null,
        smart_home_features: util?.smart_home_features ?? null,
        smart_home_features_other_description: util?.smart_home_features_other_description ?? null,
        hvac_unit_condition: util?.hvac_unit_condition ?? null,
        solar_inverter_visible: util?.solar_inverter_visible ? true : false,
        hvac_unit_issues: util?.hvac_unit_issues ?? null
      };
      writeJSON(path.join("data", `utility_${util.utility_index || idx + 1}.json`), utilityOut);
      
      // Create relationship between building layout and utility
      const buildingNumber = util.building_number || idx + 1;
      const utilityIndex = util.utility_index || idx + 1;
      
      // Find the correct building layout file index
      let buildingLayoutIndex = buildingNumber;
      if (layoutsData && parcelIdentifier) {
        const key = `property_${parcelIdentifier}`;
        const layouts = layoutsData[key]?.layouts || [];
        const buildingLayout = layouts.find((layout, layoutIdx) => 
          layout.space_type === "Building" && layout.building_number === buildingNumber
        );
        if (buildingLayout) {
          buildingLayoutIndex = layouts.indexOf(buildingLayout) + 1;
        }
      }
      
      const relationship = {
        from: { "/": `./layout_${buildingLayoutIndex}.json` },
        to: { "/": `./utility_${utilityIndex}.json` }
      };
      writeJSON(
        path.join("data", `relationship_layout_${buildingNumber}_has_utility_${utilityIndex}.json`),
        relationship
      );
    });
  }

}


function createLayoutFiles(seed,parcelIdentifier){
  let layoutsData = null;
  try {
    layoutsData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) {}

  if (layoutsData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const layouts = layoutsData[key]?.layouts || [];
    layouts.forEach((layout, idx) => {
      const out = {
        ...appendSourceInfo(seed),
        space_type: layout.space_type ?? null,
        built_year: layout.built_year ?? null,
        total_area_sq_ft: layout.total_area_sq_ft ?? null,
        livable_area_sq_ft: layout.livable_area_sq_ft ?? null,
        heated_area_sq_ft:   layout.heated_area_sq_ft ?? null,
        area_under_air_sq_ft: layout.area_under_air_sq_ft ?? null,
        space_type_index: String(layout.space_type_index || (idx + 1)),
        flooring_material_type: layout.flooring_material_type ?? null,
        size_square_feet: layout.size_square_feet ?? null,
        // floor_level: layout.floor_level ?? null,
        has_windows: layout.has_windows ?? null,
        window_design_type: layout.window_design_type ?? null,
        window_material_type: layout.window_material_type ?? null,
        window_treatment_type: layout.window_treatment_type ?? null,
        is_finished: !!layout.is_finished,
        furnished: layout.furnished ?? null,
        paint_condition: layout.paint_condition ?? null,
        flooring_wear: layout.flooring_wear ?? null,
        clutter_level: layout.clutter_level ?? null,
        visible_damage: layout.visible_damage ?? null,
        countertop_material: layout.countertop_material ?? null,
        cabinet_style: layout.cabinet_style ?? null,
        fixture_finish_quality: layout.fixture_finish_quality ?? null,
        design_style: layout.design_style ?? null,
        natural_light_quality: layout.natural_light_quality ?? null,
        decor_elements: layout.decor_elements ?? null,
        pool_type: layout.pool_type ?? null,
        pool_equipment: layout.pool_equipment ?? null,
        spa_type: layout.spa_type ?? null,
        safety_features: layout.safety_features ?? null,
        view_type: layout.view_type ?? null,
        lighting_features: layout.lighting_features ?? null,
        condition_issues: layout.condition_issues ?? null,
        is_exterior: !!layout.is_exterior,
        pool_condition: layout.pool_condition ?? null,
        pool_surface_type: layout.pool_surface_type ?? null,
        pool_water_quality: layout.pool_water_quality ?? null,
        bathroom_renovation_date: layout.bathroom_renovation_date ?? null,
        kitchen_renovation_date: layout.kitchen_renovation_date ?? null,
        flooring_installation_date: layout.flooring_installation_date ?? null,
        building_number: layout.building_number ?? null
      };
      writeJSON(path.join("data", `layout_${idx + 1}.json`), out);
    });
    
    // Create layout relationships
    layouts.forEach((layout, idx) => {
      if (layout.space_type === "Building") {
        const buildingLayoutIndex = idx + 1; // Use actual file index
        const buildingNumber = layout.building_number;
        
        // Find sub-layouts for this building
        layouts.forEach((subLayout, subIdx) => {
          if (subLayout.building_number === buildingNumber && subLayout.space_type !== "Building") {
            const subLayoutIndex = subIdx + 1; // Use actual file index
            const relationship = {
              from: { "/": `./layout_${buildingLayoutIndex}.json` },
              to: { "/": `./layout_${subLayoutIndex}.json` }
            };
            writeJSON(
              path.join("data", `relationship_layout_${buildingNumber}_has_layout_${subLayoutIndex}.json`),
              relationship
            );
          }
        });
      }
    });
  }


}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);
  emptyDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const remix = parseRemixContext(html);

  const unnormalized = readJSON("unnormalized_address.json");
  const propertySeed = readJSON("property_seed.json");

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;
  const structureData = fs.existsSync(structurePath)
    ? readJSON(structurePath)
    : null;

  const parcelId = propertySeed["parcel_id"];
  // let propertyType = "ManufacturedHousing";
  // if (parcelId && parcelId.trim().endsWith("M")) {
  //   propertyType = "VacantLand";
  // }

  let remixData =
    remix &&
    remix.state &&
    remix.state.loaderData &&
    remix.state.loaderData["routes/_index"]
      ? remix.state.loaderData["routes/_index"]
      : {};
  if (Object.keys(remixData).length === 0) {
    remixData =
    remix &&
    remix.state &&
    remix.state.loaderData &&
    remix.state.loaderData["routes/mineral"]
      ? remix.state.loaderData["routes/mineral"] : {};
  }
  const parcelInfo = remixData.parcelInformation || {};
  const propertyMapping = mapPropertyType(parcelInfo);
  if (!propertyMapping) {
    throw new Error("Property type not found");
  }
  const buildings = remixData.buildings || {};
  // console.log('Number of buildings:', remixData.buildings?.units?.length || 0);
  // console.log('***********************************');
  // console.log('Number of building:', buildings );
  // console.log('***********************************');
  const firstUnit =
    (buildings.units && buildings.units.length ? buildings.units[0] : {}) || {};

  // Create common source_http_request object
  const sourceHttpRequest = {
    method: "GET",
    url: "https://parcelview.srcpa.gov",
    multiValueQueryString: {
      parcel: [parcelId]
    }
  };

  // PROPERTY
  const property = buildProperty(parcelId, propertyMapping, parcelInfo, remixData, buildings, sourceHttpRequest);
  writeJSON(path.join(dataDir, "property.json"), property);
  
  // ADDRESS
  buildAddressAndGeometry(parcelId, parcelInfo, remixData, unnormalized, $, sourceHttpRequest, dataDir);

  //-------Structure (owners/structures_data.json)--------------
  createStructureFiles(propertySeed,parcelId);

  // ---------- Utilities (owners/utilities_data.json) ----------
  createUtilitiesFiles(propertySeed,parcelId);

  // ---------- Layouts (owners/layout_data.json) ----------
  createLayoutFiles(propertySeed,parcelId);  


  // // STRUCTURE
  // if (structureData) {
  //   const key = `property_${parcelId}`;
  //   const s = structureData[key] || {};
  //   s["source_http_request"] = sourceHttpRequest;
  //   s["request_identifier"] = parcelId,
  //   writeJSON(path.join(dataDir, "structure.json"), s);
  // }

  // LOT
  buildLot(parcelId, parcelInfo, remixData, sourceHttpRequest, dataDir);

  // TAXES for 2023-2025
  buildTaxes(parcelId, remixData, $, sourceHttpRequest, dataDir);

  // SALES, DEEDS, FILES
  buildSalesDeedFileOwnersAndRelationships(parcelId, remixData, $, ownersData, sourceHttpRequest, dataDir);

  //Mailing Address
  const mailingAddressRaw = extractMailingAddress($)
  console.log("MAILING--",mailingAddressRaw);
  const mailingAddressProcessed = mailingAddressRaw?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Only create mailing_address if we have a valid non-empty address AND we have current owners to link it to
  // CRITICAL: Validate mailing address is meaningful (not just punctuation or empty)
  // Same validation as main address to prevent empty string violation (minLength: 1)
  let hasValidMailingAddress = false;
  if (mailingAddressProcessed && mailingAddressProcessed.length > 0) {
    const cleanedMailing = mailingAddressProcessed.replace(/[,\s]+/g, ' ').trim();
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(cleanedMailing);
    const withoutPunctuation = cleanedMailing.replace(/[,\s]/g, '');
    const hasMoreThanStateCode = withoutPunctuation.length > 2;
    const hasActualContent = /\d/.test(cleanedMailing) || withoutPunctuation.length > 10;
    const isJustStateCode = /^[A-Z]{2}$/i.test(withoutPunctuation);
    hasValidMailingAddress = hasAlphanumeric && hasMoreThanStateCode && hasActualContent && !isJustStateCode;
  }

  if (hasValidMailingAddress) {
    const ownersFilePath = path.join("owners", "owner_data.json");
    const owners = fs.existsSync(ownersFilePath) ? readJSON(ownersFilePath) : null;

    // Only create mailing address file if we have owners to create relationships with
    if (owners) {
      const key = `property_${parcelId}`;
      const record = owners[key];
      if (record && record.owners_by_date && record.owners_by_date['current']) {
        const currentOwners = record.owners_by_date['current'];

        // Only create mailing address if there are current owners
        if (currentOwners && currentOwners.length > 0) {
          console.log("CURRENT-",currentOwners)

          // Create the mailing address file
          const mailingAddressOutput = {
            ...appendSourceInfo(propertySeed),
            unnormalized_address: mailingAddressProcessed,
          };
          writeJSON(path.join("data", "mailing_address.json"), mailingAddressOutput);

          // Create relationships with current owners
          let relCounter = 0;
          currentOwners.forEach((owner) => {
            if (owner.type === "person") {
              const pIdx = findPersonIndexByName(owner.first_name, owner.last_name);
              if (pIdx) {
                relCounter++;
                writeJSON(
                  path.join("data", `relationship_person_has_mailing_address_${relCounter}.json`),
                  {
                    from: { "/": `./person_${pIdx}.json` },
                    to: { "/": "./mailing_address.json" },
                  }
                );
              }
            } else if (owner.type === "company") {
              const cIdx = findCompanyIndexByName(owner.name);
              if (cIdx) {
                relCounter++;
                writeJSON(
                  path.join("data", `relationship_company_has_mailing_address_${relCounter}.json`),
                  {
                    from: { "/": `./company_${cIdx}.json` },
                    to: { "/": "./mailing_address.json" }
                  }
                );
              }
            }
          });
        }
      }
    }
  }


  // FLOOD placeholder
  // const flood = {
  //   community_id: null,
  //   panel_number: null,
  //   map_version: null,
  //   effective_date: null,
  //   evacuation_zone: null,
  //   flood_zone: null,
  //   flood_insurance_required: false,
  //   fema_search_url: null,
  //   source_http_request: sourceHttpRequest,
  //   request_identifier: parcelId,
  // };
  // writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
}

main();