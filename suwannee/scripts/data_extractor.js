const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping = [
  {
    "property_usecode": "CENTRALLY ASSESSED (9800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "IMPROVED AGRICULTURE (5000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SINGLE FAMILY (0100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "VACANT (0000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "GRAZING SOIL CAP 3 (6200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 70-79 (5600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FOREST, PARKS REC (8200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MOBILE HOME (0200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SUB-SURFACE RIGHTS (9300)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GRAZING SOIL CAP 2 (6100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MOBILE HOME (0220)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "TIMBERLAND 80-89 (5500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 60-69 (5700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NON-AG ACREAGE (9900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "COUNTY (8600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "STATE (8700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "MINING - 10 (9210)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "REPAIR SERV NON AUTO (2500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND NON-CLASS (5900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND SOIL CAP 2 (5200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GRAZING SOIL CAP 4 (6300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND SOIL CAP 3 (5300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 90+ (5400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "UTILITIES (9100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CHURCHES (7100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 80-89 (5520)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GRAZING SOIL CAP 1 (6000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MOBILE HOME - RIVER (0202)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "VAC INSTITUTIONAL (7000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "WAREHOUSE STOR/DIST (4800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORES, 1 STORY (1100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "RV PARK/SFR (3602)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Recreational",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "TIMBERLAND 70-79 (5630)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT COMMERCIAL (1000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MINING (9200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MORTUARY/CEMETERY (7600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "LIGHT MANUFACTURE (4100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "RIGHTS-OF-WAY (9400)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SINGLE FAMILY - 02 (0102)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "GROVES/ORCHARDS (6600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MULTI-FAM <10 UNITS (0800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyLessThan10"
  },
  {
    "property_usecode": "MULTI-FAM <10 UNITS - 50 (0850)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyLessThan10"
  },
  {
    "property_usecode": "CLUBS/LODGES HALLS (7700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "ORNAMENTALS/MISC (6900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 80-89 - 70 (5570)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MODULAR HOME (0201)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Modular"
  },
  {
    "property_usecode": "OFF BLDG MULTI-STORY (1800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "REC AND PARK LAND (9700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "OFF BLDG 1 STORY (1700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "SINGLE FAMILY - 05 (0105)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "PROFESSIONAL BLDG (1900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "SINGLE FAMILY (0150)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "HOMES FOR THE AGED (7400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "MH PARK (2800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "COMMUNITY SHOPPING (1600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 70-79 (5620)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MILITARY (8100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "RESTAURANTS/CAFE (2100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUB-SURFACE RIGHTS - 02 (9302)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "POULTRY/BEES/FISH (6700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SINGLE FAMILY - 01 (0101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "property_usecode": "TOUR ATTRACT-PERM (3500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "FINANCIAL INST (2300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "NON-PROFIT SERVICE (7500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUB-SURFACE RIGHTS - 01 (9301)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NIGHTCLUBS/BARS (3300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL (8900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "WASTELAND/SLOUGH (9600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "PRIVATE HOSPITALS (7300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "VEHICLE SL/SERV/RENT (2700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "DRIVE-IN REST (2200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOTELS AND MOTELS (3900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUPERMARKET (1400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE STOR/DIST - 01 (4801)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTI-FAM 10+ UNITS (0300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "MIXED USE (1200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "DRIVE-IN REST - 01 (2201)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "INS COMPANY OFF (2400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESSIONAL BLDG - 02 (1902)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "SERVICE STATIONS (2600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 70-79 (5610)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "OPEN STORAGE (4900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "JUNK YARD STORAGE (4301)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT INDUSTRIAL (4000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "PRIVATE SCHOOLS (7200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "RV PARK/CAMPS (3600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Recreational",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "WAREHOUSE STOR/DIST - 02 (4802)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "PUBLIC SCHOOLS (8300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "FEDERAL (8800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORES, 1 STORY (1101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "CAMPGROUND W/STORE (3601)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Recreational",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "property_usecode": "TIMBERLAND 50-59 (5800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND SOIL CAP 1 (5100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "ENCL THR/AUDITORIUM (3200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESSIONAL BLDG - 01 (1901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 60-69 (5720)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "OTHER FOOD PROC (4600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOSPITALS (8500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "LUMBER YARDS (4300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "MORTUARY/CEMETERY - 99 (7699)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "PRIVATE SCHOOLS - 01 (7201)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "LAUNDROMAT (2501)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT GOVERMENTAL (8000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "HOTELS AND MOTELS - 01 (3901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "BWL AL/SKT RNK/PL HL (3400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 80-89 - 30 (5530)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GRAZING SOIL CAP 3 (6280)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "UTILITIES (9180)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PROCESSING PLANT (4101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "HEAVY MANUFACTURE (4200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "NON-AG ACREAGE - 05 (9905)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "VacantLand"
  },
  {
    "property_usecode": "MISC RESIDENTIAL/CAMPS (0700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "MiscellaneousResidential"
  }
]


function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function parseMoney(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function toIsoDate(mdy) {
  if (!mdy) return null;
  const parts = String(mdy)
    .trim()
    .split(/[\/\-]/)
    .map((s) => s.trim());
  if (parts.length !== 3) return null;
  let [m, d, y] = parts;
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function htmlDecode($, text) {
  // use cheerio to decode entities by setting as html and getting text
  return $("<textarea/>").html(text).text();
}

function getText($node) {
  return $node.text().replace(/\s+/g, " ").trim();
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

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

function extractProperty($) {
  const parcel_identifier = extractParcelId($);

  // Legal description: hidden input strLegal preferred
  let legal = $('input[name="strLegal"]').attr("value");
  if (!legal) {
    const flegal = getText($("#Flegal"));
    const blegal = getText($("#Blegal"));
    legal = flegal || blegal || null;
  } else {
    legal = htmlDecode($, legal).replace(/\s+/g, " ").trim();
  }

  // Use Code row to map property type
  let useText = null;
  $("table.parcelDetails_insideTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = getText($(tds[0]));
      if (/^Use\s*Code/i.test(label)) {
        useText = getText($(tds[1]));
      }
    }
  });
  let propertyMapping = null;
  if (useText) {
    propertyMapping = mapPropertyTypeFromUseCode(useText);
  }
  if(!propertyMapping) {
    throw new Error("Property type not found");
  }

  // Building Characteristics to compute years and areas
  let builtYears = [];
  let heatedTotals = 0;
  let actualTotals = 0;
  const bldgRows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr",
  );
  bldgRows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6 && i > 0) {
      const year = Number(getText($(tds[2])).replace(/[^0-9]/g, ""));
      const htd = Number(getText($(tds[3])).replace(/[^0-9]/g, ""));
      const act = Number(getText($(tds[4])).replace(/[^0-9]/g, ""));
      if (!Number.isNaN(year)) builtYears.push(year);
      if (!Number.isNaN(htd)) heatedTotals += htd;
      if (!Number.isNaN(act)) actualTotals += act;
    }
  });
  const property_structure_built_year = builtYears.length
    ? Math.min(...builtYears)
    : null;
  const livable_floor_area = heatedTotals ? String(heatedTotals) : null;
  const total_area = actualTotals ? String(actualTotals) : null;
  const area_under_air = livable_floor_area;

  const property = {
    parcel_identifier: parcel_identifier || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: property_structure_built_year || null,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    number_of_units_type: null,
    livable_floor_area: livable_floor_area,
    area_under_air: area_under_air,
    total_area: total_area,
    property_effective_built_year: null,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  return property;
}


const collapseWs = (s) => (s || "").replace(/\s+/g, " ").trim();

function extractSecTwpRng($) {
  let section = null,
    township = null,
    range = null;
  $("table.parcelDetails_insideTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      const label = getText($(tds[2]));
      const val = getText($(tds[3]));
      const label0 = getText($(tds[0]));
      const val1 = getText($(tds[1]));
      if (/^S\/T\/R$/i.test(label0)) {
        const v = val1;
        const m = v.match(/^(\d+)-([0-9]{2}[NS])-(\d{2}[EW])$/i);
        if (m) {
          section = m[1];
          township = m[2].toUpperCase();
          range = m[3].toUpperCase();
        }
      } else if (/^S\/T\/R$/i.test(label)) {
        const v = val;
        const m = v.match(/^(\d+)-([0-9]{2}[NS])-(\d{2}[EW])$/i);
        if (m) {
          section = m[1];
          township = m[2].toUpperCase();
          range = m[3].toUpperCase();
        }
      }
    }
  });
  return { section, township, range };
}

function extractAddressText($) {
  return $('input[name="strSiteAddress"]').attr("value");
}

function extractOwnerMailingAddress($) {
  let mailingAddress = null;
  $("td").each((i, el) => {
    const txt = collapseWs($(el).text()).toLowerCase();
    if (txt === "owner") {
      const valTd = $(el).next("td");
      if (valTd && valTd.length) {
        // Prefer bold text within the value cell for owner name
        const rawCellText = collapseWs(valTd.text());
        if (rawCellText) {
          mailingAddress = rawCellText;
          return;
        }
      }
    }
  });
  return mailingAddress;
}

function attemptWriteAddress(unnorm, secTwpRng, siteAddress, mailingAddress) {
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
    writeJson(path.join("data", "mailing_address.json"), mailingAddressObj);
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
    writeJson(path.join("data", "address.json"), addressObj);
    writeJson(path.join("data", "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  }
  return hasOwnerMailingAddress;
}

function extractTaxes($) {
  const taxes = [];

  function extractBlock(titleContains) {
    const table = $("table.parcelDetails_insideTable")
      .filter((i, el) => {
        const $el = $(el);
        const txt = getText($el.find('tr td[align="center"]').first());
        return txt.includes(titleContains);
      })
      .first();

    if (!table.length) return null;
    // Rows: find labels and values
    const rows = table.find("tr");
    const block = {};
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = getText($(tds[0]));
        const val = getText($(tds[1]));
        if (/Mkt\s*Land/i.test(label)) block.land = parseMoney(val);
        if (/Building/i.test(label)) block.building = parseMoney(val);
        if (/Just$/i.test(label)) block.just = parseMoney(val);
        if (/Assessed/i.test(label)) block.assessed = parseMoney(val);
        if (/Total\s*Taxable/i.test(label)) {
          // inside this td there are multiple labels; extract first number
          const m = val.match(/\$[\d,]+(\.\d{2})?/);
          block.taxable = m ? parseMoney(m[0]) : null;
        }
      }
    });
    if (!block.taxable) {
      return null;
    }
    return block;
  }

  const b2024 = extractBlock("2024 Certified Values");
  if (b2024) {
    taxes.push({
      tax_year: 2024,
      property_assessed_value_amount: b2024.assessed ?? null,
      property_market_value_amount: b2024.just ?? null,
      property_building_amount: b2024.building ?? null,
      property_land_amount: b2024.land ?? null,
      property_taxable_value_amount: b2024.taxable ?? null,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    });
  }
  let b2025 = extractBlock("2025 Certified Values");
  if (!b2025) {
    b2025 = extractBlock("2025 Preliminary Certified");
  }
  if (b2025) {
    taxes.push({
      tax_year: 2025,
      property_assessed_value_amount: b2025.assessed ?? null,
      property_market_value_amount: b2025.just ?? null,
      property_building_amount: b2025.building ?? null,
      property_land_amount: b2025.land ?? null,
      property_taxable_value_amount: b2025.taxable ?? null,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    });
  }
  const b2026 = extractBlock("2026 Working Values");
  if (b2026) {
    taxes.push({
      tax_year: 2026,
      property_assessed_value_amount: b2026.assessed ?? null,
      property_market_value_amount: b2026.just ?? null,
      property_building_amount: b2026.building ?? null,
      property_land_amount: b2026.land ?? null,
      property_taxable_value_amount: b2026.taxable ?? null,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    });
  }
  return taxes;
}

function mapDeedCode(code) {
  if (!code) return {};
  const u = code.trim().toUpperCase();
  if (u === "CT") return "Contract for Deed";
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "TAX DEED") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return "Miscellaneous";
}

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function extractSalesAndDeeds($) {
  const sales = [];

  const salesTable = $(
    "#parcelDetails_SalesTable table.parcelDetails_insideTable",
  ).first();
  const rows = salesTable.find("tr").slice(1); // skip header
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      const date = getText($(tds[0]));
      const price = getText($(tds[1]));
      const bookPage = getText($(tds[2]));
      const deedCode = getText($(tds[3]));
      const iso = toIsoDate(date);
      const amt = parseMoney(price);
      let link = null;
      let book = null;
      let page = null;
      if (bookPage) {
        const bookPageParts = bookPage.split('/');
        if (bookPageParts.length == 2) {
          if (bookPageParts[0].trim() && isNumeric(bookPageParts[0].trim()) && bookPageParts[1].trim() && isNumeric(bookPageParts[1].trim())) {
            book = bookPageParts[0].trim();
            page = bookPageParts[1].trim();
            link = `https://www.suwanneepa.com/gis/linkClerk/?ClerkBook=${book}&ClerkPage=${page}&autoSubmit=1`;
          }
        }
      }
      const saleObj = {
        ownership_transfer_date: iso,
        purchase_price_amount: amt,
        bookPage,
        link,
        book,
        page,
        deed: mapDeedCode(deedCode)
      };
      sales.push(saleObj);
    }
  });
  return sales;
}

function writeOwners(ownerData, dataDir, parcelDashed, parcelFlat) {
  // owners keyed by dashed id in provided data
  const keyVariants = [`property_${parcelDashed}`, `property_${parcelFlat}`];
  let ownersEntry = null;
  for (const k of keyVariants) {
    if (ownerData[k]) {
      ownersEntry = ownerData[k];
      break;
    }
  }
  const outputs = { companyFiles: [], personFiles: [] };
  if (
    ownersEntry &&
    ownersEntry.owners_by_date &&
    Array.isArray(ownersEntry.owners_by_date.current)
  ) {
    let companyIdx = 0,
      personIdx = 0;
    for (const ow of ownersEntry.owners_by_date.current) {
      if (ow.type === "company") {
        companyIdx += 1;
        const file = path.join(dataDir, `company_${companyIdx}.json`);
        writeJson(file, { name: ow.name ?? null });
        outputs.companyFiles.push(path.basename(file));
      } else if (ow.type === "person") {
        // person schema requires many fields; we cannot synthesize; skip if insufficient
        if (ow.first_name && ow.last_name) {
          personIdx += 1;
          const file = path.join(dataDir, `person_${personIdx}.json`);
          writeJson(file, {
            birth_date: ow.birth_date ?? null,
            first_name: ow.first_name,
            last_name: ow.last_name,
            middle_name: ow.middle_name ?? null,
            prefix_name: ow.prefix_name ?? null,
            suffix_name: ow.suffix_name ?? null,
            us_citizenship_status: ow.us_citizenship_status ?? null,
            veteran_status: ow.veteran_status ?? null,
          });
          outputs.personFiles.push(path.basename(file));
        }
      }
    }
  }
  return outputs;
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
    writeJson(path.join("data", `geometry_${geomIndex}.json`), geometry);
    writeJson(path.join("data", `relationship_parcel_to_geometry_${geomIndex}.json`), {
        from: { "/": `./parcel.json` },
        to: { "/": `./geometry_${geomIndex}.json` },
    });
    geomIndex++;
  }
}

function main() {
  try {
    const dataDir = path.join(".", "data");
    ensureDir(dataDir);

    const html = fs.readFileSync("input.html", "utf-8");
    const $ = cheerio.load(html);

    const unAddr = readJson("unnormalized_address.json");
    const propSeed = readJson("property_seed.json");

    // Owners/utilities/layout must be built from their JSONs
    const ownerData = readJson(path.join("owners", "owner_data.json"));
    const utilitiesData = readJson(path.join("owners", "utilities_data.json"));
    const structuresData = readJson(path.join("owners", "structure_data.json"));
    const layoutData = readJson(path.join("owners", "layout_data.json"));

    try {
      const seedCsvPath = path.join(".", "input.csv");
      const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
      createGeometryClass(createGeometryInstances(seedCsv));
    } catch (e) {
      const latitude = unAddr && unAddr.latitude ? unAddr.latitude : null;
      const longitude = unAddr && unAddr.longitude ? unAddr.longitude : null;
      if (latitude && longitude) {
        const coordinate = new Geometry({
          latitude: latitude,
          longitude: longitude
        });
        createGeometryClass([coordinate]);
      }
    }

    // Property
    const property = extractProperty($);
    if (!property.property_type) {
      // mapping failure should have thrown, but guard
      throw {
        type: "error",
        message: "Unknown enum value.",
        path: "property.property_type",
      };
    }
    writeJson(path.join(dataDir, "property.json"), property);

    // Address
    const secTwpRng = extractSecTwpRng($);
    const addressText = extractAddressText($);
    const mailingAddress = extractOwnerMailingAddress($);
    const hasOwnerMailingAddress = attemptWriteAddress(unAddr, secTwpRng, addressText, mailingAddress);

    // Taxes
    const taxes = extractTaxes($);
    let taxIdx = 0;
    taxes.forEach((t) => {
      taxIdx += 1;
      writeJson(path.join(dataDir, `tax_${t.tax_year || taxIdx}.json`), t);
    });

    // Sales & Deeds
    const sales = extractSalesAndDeeds($);
    sales.forEach((s, i) => {
      const saleObj = {
        ownership_transfer_date: s.ownership_transfer_date,
        purchase_price_amount: s.purchase_price_amount,
      }
      writeJson(path.join(dataDir, `sales_${i + 1}.json`), saleObj);
      if (s.deed) {
        let deedObj = {"deed_type": s.deed};
        if (s.book && s.page) {
          deedObj.book = s.book;
          deedObj.page = s.page;
        }
        writeJson(path.join(dataDir, `deed_${i + 1}.json`), deedObj);
        const suffix = `_${i + 1}`;
        const saleDeedRelName = `relationship_sales_deed${suffix}.json`;
        const file = {
          document_type: null,
          file_format: null,
          ipfs_url: null,
          name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
          original_url: s.link || null,
        };
        writeJson(path.join("data", `file_${i + 1}.json`), file);
        const deedFileRelName = `relationship_deed_file${suffix}.json`;
        const saleDeedRel = {
          from: { "/": `./sales_${i + 1}.json` },
          to: { "/": `./deed_${i + 1}.json` },
        };
        writeJson(path.join(dataDir, saleDeedRelName), saleDeedRel);
        const deedFileRel = {
          from: { "/": `./deed_${i + 1}.json` },
          to: { "/": `./file_${i + 1}.json` },
        };
        writeJson(path.join(dataDir, deedFileRelName), deedFileRel);
      }
    });

    // Owners
    const parcelDashed =
      extractParcelId($) || (propSeed && propSeed.parcel_id) || "";
    const parcelFlat = parcelDashed.replace(/[-]/g, "");
    const ownerFiles = writeOwners(
      ownerData,
      dataDir,
      parcelDashed,
      parcelFlat,
    );
    // Relationship sales -> owner (company or person) using first sale
    if (sales.length > 0) {
      if (ownerFiles.companyFiles.length > 0) {
        writeJson(path.join(dataDir, "relationship_sales_company.json"), {
          to: { "/": `./${ownerFiles.companyFiles[0]}` },
          from: { "/": "./sales_1.json" },
        });
        if (hasOwnerMailingAddress) {
          writeJson(
            path.join(
              "data",
              `relationship_company_has_mailing_address.json`,
            ),
            {
              from: { "/": `./${ownerFiles.companyFiles[0]}` },
              to: { "/": `./mailing_address.json` },
            },
          );
        }
      } else if (ownerFiles.personFiles.length > 0) {
        writeJson(path.join(dataDir, "relationship_sales_person.json"), {
          to: { "/": `./${ownerFiles.personFiles[0]}` },
          from: { "/": "./sales_1.json" },
        });
        if (hasOwnerMailingAddress) {
          writeJson(
            path.join(
              "data",
              `relationship_person_has_mailing_address.json`,
            ),
            {
              from: { "/": `./${ownerFiles.personFiles[0]}` },
              to: { "/": `./mailing_address.json` },
            },
          );
        }
      }
    }

    // Utilities
    // utilities key is property_ + flat parcel ID (observed): 1302S13E04969001004
    let utilEntry = null;
    const utilKeyVariants = [
      `property_${parcelFlat}`,
      `property_${parcelDashed}`,
    ];
    for (const k of utilKeyVariants) {
      if (utilitiesData[k]) {
        utilEntry = utilitiesData[k];
        break;
      }
    }
    let structureEntry = null;
    for (const k of utilKeyVariants) {
      if (structuresData[k]) {
        structureEntry = structuresData[k];
        break;
      }
    }

    // Layouts
    let layoutEntry = null;
    for (const k of utilKeyVariants) {
      if (layoutData[k]) {
        layoutEntry = layoutData[k];
        break;
      }
    }
    if (layoutEntry && layoutEntry["layouts"]) {
      let idx = 1;
      let layoutBuildingMap = {};
      for (const l of layoutEntry["layouts"]) {
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
        writeJson(path.join("data", `layout_${idx}.json`), layoutOut);
        if (l.space_type === "Building") {
          const building_number = l.building_number;
          layoutBuildingMap[building_number.toString()] = idx;
        }
        if (l.space_type !== "Building") {
          const building_number = l.building_number;
          if (building_number) {
            const building_layout_number = layoutBuildingMap[building_number.toString()];
            writeJson(path.join("data", `relationship_layout_${building_layout_number}_to_layout_${idx}.json`), {
              to: { "/": `./layout_${idx}.json` },
              from: { "/": `./layout_${building_layout_number}.json` },
            });
          }
        }
        if (utilEntry && l.space_type === "Building") {
          if (l.building_number && l.building_number.toString() in utilEntry) {
            writeJson(path.join("data", `utility_${idx}.json`), utilEntry[l.building_number.toString()]);
            writeJson(path.join("data", `relationship_layout_to_utility_${idx}.json`), {
                      to: { "/": `./utility_${idx}.json` },
                      from: { "/": `./layout_${idx}.json` },
            },);
          }
        }
        if (structureEntry && l.space_type === "Building") {
          if (l.building_number && l.building_number.toString() in structureEntry) {
            writeJson(path.join("data", `structure_${idx}.json`), structureEntry[l.building_number.toString()]);
            writeJson(path.join("data", `relationship_layout_to_structure_${idx}.json`), {
                      to: { "/": `./structure_${idx}.json` },
                      from: { "/": `./layout_${idx}.json` },
            },);
          }
        }
        idx++;
      }
    }

  } catch (e) {
    // On mapping error for enums, write error to stderr and exit non-zero
    if (e && e.type === "error") {
      process.stderr.write(JSON.stringify(e));
      console.log(JSON.stringify(e));
    } else {
      process.stderr.write(String(e.stack || e));
      console.log(String(e.stack || e));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
