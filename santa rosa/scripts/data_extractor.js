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

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  // Calculate totals from all units
  let totalAreaSum = 0;
  // let totalHeatedAreaSum = 0;
  let hasValidArea = false;
  // let hasValidHeatedArea = false;
  const units = (buildings.units && buildings.units.length ? buildings.units : []) || [];

  units.forEach(unit => {
    if (unit.squareFeet && unit.squareFeet.actual != null) {
      totalAreaSum += unit.squareFeet.actual;
      hasValidArea = true;
    }
    // if (unit.squareFeet && unit.squareFeet.heated != null && unit.squareFeet.heated >= 10) {
    //   totalHeatedAreaSum += unit.squareFeet.heated;
    //   hasValidHeatedArea = true;
    // }
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
  // Print the totals for debugging
  // console.log(`Total area from all units: ${totalAreaSum}`);
  // console.log(`Total heated area from all units: ${totalHeatedAreaSum}`);

  // PROPERTY
  const property = {
    parcel_identifier: parcelId,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    property_structure_built_year: structureBuiltYear,
    property_effective_built_year: effectiveBuiltYear,
    property_legal_description_text: parcelInfo.legalDescription || null,
    livable_floor_area: null,
    total_area: hasValidArea ? String(totalAreaSum) : null,
    number_of_units_type: null,
    subdivision: null,
    zoning:
      remixData.zonings && remixData.zonings.length
        ? remixData.zonings[0].code
        : null,
    area_under_air: null,
    number_of_units: units.length || 1,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  // ADDRESS
  const situs =
    parcelInfo.situs ||
    $('td[data-cell="Situs/Physical Address"]').text().trim();
  const situsParts = parseSitusParts(situs);
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
  const ownerInfo = remixData.ownerInformation || {};
  const address = {
    street_number: situsParts.street_number || null,
    street_name: situsParts.street_name || null,
    latitude: unnormalized && unnormalized.latitude ? unnormalized.latitude : null,
    longitude: unnormalized && unnormalized.longitude ? unnormalized.longitude : null,
    street_suffix_type: normalizeSuffix(situsParts.street_suffix),
    street_pre_directional_text: null,
    street_post_directional_text: null,
    city_name:
      situsParts.city_name || ownerInfo.city || null
        ? (situsParts.city_name || ownerInfo.city || null)
            .toString()
            .toUpperCase()
        : null,
    state_code: "FL",
    postal_code: situsParts.postal_code || ownerInfo.zip5 || null || null,
    plus_four_postal_code: null,
    country_code: null,
    county_name: "Santa Rosa",
    unit_identifier: null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    block: null,
    lot: null,
    municipality_name: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // STRUCTURE
  if (structureData) {
    const key = `property_${parcelId}`;
    const s = structureData[key] || {};
    s["source_http_request"] = sourceHttpRequest;
    s["request_identifier"] = parcelId,
    writeJSON(path.join(dataDir, "structure.json"), s);
  }

  // LOT
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

  // TAXES for 2023-2025
  const valuationValues =
    (remixData.valuation && remixData.valuation.values) || [];
  const valuationTable = parseValuationTable($);
  function valFor(year, desc) {
    const v = valuationValues.find(
      (v) =>
        v.taxYear === year && v.valueType && v.valueType.description === desc,
    );
    if (v) return v.amount;
    // Fallback to parsed table if available
    const rowMap = valuationTable[year] || {};
    if (rowMap[desc] !== undefined) return rowMap[desc];
    return null;
  }
  function writeTax(year) {
    const assessed = valFor(year, "Co. Assessed Value");
    const market = valFor(year, "Just (Market) Value");
    const building = valFor(year, "Building Value");
    const landVal = valFor(year, "Land Value");
    let taxable = valFor(year, "Co. Taxable Value");
    if (taxable === null || taxable === undefined) {
      // If table shows columns and value is missing, treat as 0
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
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `tax_${year}.json`), taxOut);
  }
  [2023, 2024, 2025].forEach(writeTax);

  // SALES, DEEDS, FILES
  const sales = (remixData.sales || []).map((s) => s.record);
  const bookPageLinks = extractBookPageLinks($);

  // OWNERS
  let ownersByDate = {};
  if (ownersData) {
    const key = `property_${parcelId}`;
    const od = ownersData[key] || {};
    ownersByDate = od.owners_by_date || {};
  }

  // people and companies
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
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && o.middle_name)
            existing.middle_name = o.middle_name;
        }
      }
    });
  });
  const people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const personPaths = [];
  people.forEach((p, idx) => {
    writeJSON(path.join(dataDir, `person_${idx + 1}.json`), p);
    personPaths.push(`./person_${idx + 1}.json`);
  });

  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  const companies = Array.from(companyNames).map((n) => ({ 
    name: n,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const companyPaths = [];
  companies.forEach((c, idx) => {
    writeJSON(path.join(dataDir, `company_${idx + 1}.json`), c);
    companyPaths.push(`./company_${idx + 1}.json`);
  });

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
    const tn = (name || "").trim();
    for (let i = 0; i < companies.length; i++) {
      if ((companies[i].name || "").trim() === tn) return i + 1;
    }
    return null;
  }

  const salesPaths = [];
  const deedPaths = [];
  const filePaths = [];

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

    // Deed type from instrument
    let deedType = null;
    const inst = (rec.instrument || "").toUpperCase();
    if (inst === "WD") deedType = "Warranty Deed";
    else if (inst === "TX") deedType = "Tax Deed";
    
    // Create deed object with only allowed properties
    const deedOut = {
      source_http_request: sourceHttpRequest
    };
    
    // Only add deed_type if we have a valid value
    if (deedType) {
      deedOut.deed_type = deedType;
    }
    
    writeJSON(path.join(dataDir, `deed_${sIndex}.json`), deedOut);
    deedPaths.push(`./deed_${sIndex}.json`);

    // File entry from book/page link
    const key = `${rec.book}/${rec.page}`;
    const original_url = bookPageLinks[key] || null;
    // Map instrument to a document_type for file schema
    let document_type = null;
    if (inst === "WD") document_type = "ConveyanceDeedWarrantyDeed";
    else if (inst === "TX") document_type = "ConveyanceDeed";
    
    const fileOut = {
      file_format: "txt",
      name:
        rec.book && rec.page
          ? `OR ${rec.book}/${rec.page}`
          : original_url
            ? path.basename(original_url)
            : "Document",
      original_url: original_url,
      ipfs_url: null,
      document_type: document_type,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `file_${sIndex}.json`), fileOut);
    filePaths.push(`./file_${sIndex}.json`);
  });
 
  writeJSON(path.join(dataDir, "property.json"), property);

  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = toISODate(rec.date);
    const ownersOnDate = ownersByDate[d] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          writeJSON(
            path.join(
              dataDir,
              `relationship_sales_person_${relPersonCounter}.json`,
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
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
              dataDir,
              `relationship_sales_company_${relCompanyCounter}.json`,
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
  });

  // Relationships: deed -> file and sales -> deed
  deedPaths.forEach((deedRef, idx) => {
    const fileRef = filePaths[idx];
    writeJSON(path.join(dataDir, `relationship_deed_file_${idx + 1}.json`), {
      to: { "/": deedRef },
      from: { "/": fileRef },
    });
    writeJSON(path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`), {
      to: { "/": salesPaths[idx] },
      from: { "/": deedRef },
    });
  });

  // UTILITY from owners/utilities_data.json only
  if (utilitiesData) {
    const key = `property_${parcelId}`;
    const u = utilitiesData[key] || {};
    const utilityOut = {
      cooling_system_type: u.cooling_system_type ?? null,
      heating_system_type: u.heating_system_type ?? null,
      public_utility_type: u.public_utility_type ?? null,
      sewer_type: u.sewer_type ?? null,
      water_source_type: u.water_source_type ?? null,
      plumbing_system_type: u.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        u.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: u.electrical_panel_capacity ?? null,
      electrical_wiring_type: u.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: u.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        u.electrical_wiring_type_other_description ?? null,
      solar_panel_present: u.solar_panel_present ?? null,
      solar_panel_type: u.solar_panel_type ?? null,
      solar_panel_type_other_description:
        u.solar_panel_type_other_description ?? null,
      smart_home_features: u.smart_home_features ?? null,
      smart_home_features_other_description:
        u.smart_home_features_other_description ?? null,
      hvac_unit_condition: u.hvac_unit_condition ?? null,
      solar_inverter_visible: u.solar_inverter_visible ?? null,
      hvac_unit_issues: u.hvac_unit_issues ?? null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, "utility.json"), utilityOut);
  }

  // LAYOUT from owners/layout_data.json only
  if (layoutData) {
    const key = `property_${parcelId}`;
    const layouts = (layoutData[key] && layoutData[key].layouts) || [];
    layouts.forEach((l, idx) => {
      const out = {
        space_type: l.space_type ?? null,
        space_index: l.space_index ?? null,
        flooring_material_type: l.flooring_material_type ?? null,
        size_square_feet: l.size_square_feet ?? null,
        floor_level: l.floor_level ?? null,
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
        source_http_request: sourceHttpRequest,
        request_identifier: parcelId,
      };
      writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), out);
    });
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