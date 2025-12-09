// scripts/data_extractor.js
// Extraction script per instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - All others from input.html

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const bayPropertyMapping = [
  {
    "bay_property_type": "AIRPORT/PORT IMPROVE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "bay_property_type": "AIRPORT/PORT VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "BEAUTY/NAIL SALON",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "bay_property_type": "BOWLING ALLEY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CANNERIES/BOTTLERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CHURCHES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CITY VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "CLUBS/LODGES/HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "bay_property_type": "COMMUNITY SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "bay_property_type": "CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "COOPERATIVES",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "COUNTY VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "CROPLAND CLASS 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "DAY CARE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "bay_property_type": "DEPARTMENT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "bay_property_type": "DRIVE-IN REST.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "bay_property_type": "DRY CLEANERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "bay_property_type": "FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "FEDERAL VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "FINANCIAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "bay_property_type": "FLORIST/GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "bay_property_type": "FOREST, PARKS, REC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "GOLF COURSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "bay_property_type": "GYM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "bay_property_type": "HEAVY MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "bay_property_type": "HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "bay_property_type": "HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "bay_property_type": "HOTELS AND MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "bay_property_type": "IMPROVED AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "INSURANCE COMPANY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "bay_property_type": "LEASEHOLD INTEREST",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "LIGHT MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "bay_property_type": "LUMBER YARD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MINERAL PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MISCELLANEOUS RES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MIXED USE COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "bay_property_type": "MOBILE HOME/CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "MORTUARY/CEMETARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MULTI-FAMILY 10 LESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MULTI-FAMILY 10+ UTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "bay_property_type": "MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "NIGHTCLUB/BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "bay_property_type": "NO AG ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "NON-PROFIT SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "bay_property_type": "NOTE PARCEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "NWFWM/IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "OFFICE BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "bay_property_type": "OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "ORCHARDS, GROVES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "OTHER FOOD PROCESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "bay_property_type": "PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "bay_property_type": "PARKING LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PARKING/MH PARK LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PASTURELAND 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PASTURELAND 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PASTURELAND 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PASTURELAND 6",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PLAT HEADING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "POULTRY,BEES,FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "PRIVATE HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "bay_property_type": "PRIVATE SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "bay_property_type": "PROFESSIONAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "bay_property_type": "PROFESSIONAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "PUBLIC SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "bay_property_type": "RAILROAD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "Building"
  },
  {
    "bay_property_type": "REC AND PARK LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "REGIONAL SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "bay_property_type": "REPAIR SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "bay_property_type": "RES COMMON AREA/ELEM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "RESTAURANTS/CAFE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "bay_property_type": "RETIREMENT HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "bay_property_type": "RIGHTS-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "RIVERS AND LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "SERVICE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "bay_property_type": "SINGLE FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "bay_property_type": "SINGLE FAMILY/CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "SKATING RING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "bay_property_type": "STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "STATE VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "STORE/OFC/RES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "bay_property_type": "STORE/OFFICE/RESID",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "bay_property_type": "STORES, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "bay_property_type": "SUB-SURFACE RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "SUPERMARKET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "bay_property_type": "THEATER/AUDITORIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "bay_property_type": "TIITF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "bay_property_type": "TIMBERLAND 50-59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TIMBERLAND 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TIMBERLAND 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TIMBERLAND 80-89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TIMBERLAND 90+",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TIMBERLAND UNCLASS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "TOURIST ATTRACTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "bay_property_type": "TRANSIT TERMINALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "bay_property_type": "UTILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VAC INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VACANT COMM./XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VACANT/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "VEH SALE/REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "bay_property_type": "WAREHOUSE-STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "bay_property_type": "WASTELAND/DUMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "WATER MANAGEMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "bay_property_type": "WHOLESALE OUTLET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Buildings";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales_grdFlat tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl03_ctl01_grdValuation_grdYearData";
const OWNER_MAILING_ADDRESS_SELECTOR = "#ctlBodyPane_ctl01_ctl01_rptOwner_ctl00_lblOwnerAddress";

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function cleanObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" ? cleanObject(item) : item,
      )
      .filter((item) => item !== null && item !== undefined);
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  Object.entries(value).forEach(([key, val]) => {
    if (val === null || val === undefined) {
      return;
    }
    if (Array.isArray(val)) {
      const cleanedArray = cleanObject(val);
      if (cleanedArray.length > 0) {
        result[key] = cleanedArray;
      }
      return;
    }
    if (typeof val === "object") {
      const cleanedObj = cleanObject(val);
      if (Object.keys(cleanedObj).length > 0) {
        result[key] = cleanedObj;
      }
      return;
    }
    result[key] = val;
  });
  return result;
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    const mm2 = mm.padStart(2, "0");
    const dd2 = dd.padStart(2, "0");
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function textOf($el) {
  if (!$el || $el.length === 0) return null;
  return $el.text().trim();
}

function loadHTML() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function extractLegalDescription($) {
  let desc = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if (th === null) {
      th = textOf($(tr).find("td strong"));
    }
    if ((th || "").toLowerCase().includes("legal description")) {
      desc = textOf($(tr).find("td span"));
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if (th === null) {
      th = textOf($(tr).find("td strong"));
    }
    if ((th || "").toLowerCase().includes("property use code")) {
      code = textOf($(tr).find("td span"));
    }
  });
  return code.replace(/\s*\(\d+\)/, "") || null;
}

const propertyTypeByUseCode = bayPropertyMapping.reduce((lookup, entry) => {
  if (!entry || !entry.bay_property_type) {
    return lookup;
  }

  const normalizedUseCode = entry.bay_property_type.replace(/\s+/g, "").toUpperCase();

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

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function extractBuildingYears($) {
  const buildings = collectBuildings($);
  const yearsActual = [];
  const yearsEffective = [];
   buildings.forEach((b) => {
    yearsActual.push(toInt(b["Actual Year Built"]));
    yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: yearsEffective.length ? Math.min(...yearsEffective) : null,
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
   buildings.forEach((b) => {
    total += toInt(b["Total Area"]);
  });
  return total;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("th, td");
    const saleDate = textOf($(tds[0]));
    const salePrice = textOf($(tds[1]));
    const instrument = textOf($(tds[2]));
    const bookPage = textOf($(tds[3]));
    const link = $(tds[4]).find("a").attr("href") || null;
    const saleQualification = textOf($(tds[5]));
    const improvementStatus = textOf($(tds[6]));
    const grantor = textOf($(tds[7]));
    const grantee = textOf($(tds[8]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage,
      link,
      saleQualification,
      improvementStatus,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  return null;
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
}

function mapSaleQualificationToSaleType(qualification) {
  if (!qualification) return null;
  const normalized = qualification.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("unqualified")) return null;
  if (normalized.includes("short")) return "ShortSale";
  if (normalized.includes("relocat")) return "RelocationSale";
  if (normalized.includes("reo")) return "ReoPostForeclosureSale";
  if (normalized.includes("court")) return "CourtOrderedNonForeclosureSale";
  if (normalized.includes("probate") || normalized.includes("estate"))
    return "ProbateSale";
  if (normalized.includes("trustee") && normalized.includes("judicial"))
    return "TrusteeJudicialForeclosureSale";
  if (
    normalized.includes("non-judicial") ||
    normalized.includes("non judicial") ||
    normalized.includes("nonjudicial")
  )
    return "TrusteeNonJudicialForeclosureSale";
  if (normalized.includes("foreclosure"))
    return "TrusteeJudicialForeclosureSale";
  if (normalized.includes("qualified")) return "TypicallyMotivated";
  return null;
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  const headerThs = table.find("thead tr th").toArray().slice(1);
  headerThs.forEach((th, idx) => {
    const txt = $(th).text().trim();
    const y = parseInt(txt, 10);
    if (!isNaN(y)) years.push({ year: y, idx });
  });
  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    const label = textOf($tr.find("th"));
    const tds = $tr.find("td.value-column");
    const vals = [];
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    if (label) dataMap[label] = vals;
  });
  return years.map(({ year, idx }) => {
    const get = (label) => {
      const arr = dataMap[label] || [];
      return arr[idx] || null;
    };
    return {
      year,
      building: get("Building Value"),
      land: get("Land Value"),
      market: get("Just (Market) Value"),
      assessed: get("Assessed Value"),
      taxable: get("Taxable Value"),
    };
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyMapping = mapPropertyTypeFromUseCode(useCode);
  if (!propertyMapping) {
    throw {
      type: "error",
      message: `Unknown enum value ${useCode}.`,
      path: "property.property_type",
    };
  }
  const years = extractBuildingYears($);
  const totalArea = extractAreas($);

  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    livable_floor_area: null,
    total_area: totalArea >= 10 ? String(totalArea) : null,
    number_of_units_type: null,
    area_under_air: null,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  writeJSON(path.join("data", "property.json"), property);
  return propertyMapping;
}

function writeSalesDeedsFilesAndRelationships($, requestIdentifier) {
  const sales = extractSales($);
  const dataDir = "data";
  ensureDir(dataDir);

  const cleanupPatterns = [
    /^sales_\d+\.json$/i,
    /^sales_history_\d+\.json$/i,
    /^deed_\d+\.json$/i,
    /^file_\d+\.json$/i,
    /^relationship_sales_deed_\d+\.json$/i,
    /^relationship_deed_file_\d+\.json$/i,
    /^relationship_sales_history_.*\.json$/i,
    /^relationship_sales_person_\d+\.json$/i,
    /^relationship_sales_company_\d+\.json$/i,
    /^relationship_property_has_sales_history_.*\.json$/i,
  ];

  try {
    fs.readdirSync(dataDir).forEach((f) => {
      if (cleanupPatterns.some((re) => re.test(f))) {
        fs.unlinkSync(path.join(dataDir, f));
      }
    });
  } catch (e) {}

  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleDateISO = parseDateToISO(s.saleDate);
    const saleType = mapSaleQualificationToSaleType(s.saleQualification);
    const saleHistory = {
      ownership_transfer_date: saleDateISO || null,
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
      request_identifier: requestIdentifier || null,
    };
    if (saleType) {
      saleHistory.sale_type = saleType;
    }
    writeJSON(
      path.join(dataDir, `sales_history_${idx}.json`),
      saleHistory,
    );

    let book = null;
    let page = null;
    if (s.bookPage) {
      const parts = String(s.bookPage)
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part !== "");
      if (parts.length >= 1) book = parts[0];
      if (parts.length >= 2) page = parts[1];
    }

    let volume = null;
    let instrumentNumber = null;
    if (s.link) {
      try {
        const urlObj = new URL(s.link, "https://example.com");
        const params = urlObj.searchParams;
        if (!book && params.has("booknumber"))
          book = params.get("booknumber") || null;
        if (!page && params.has("pagenumber"))
          page = params.get("pagenumber") || null;
        volume =
          params.get("booktype") ||
          params.get("volume") ||
          volume ||
          null;
        instrumentNumber =
          params.get("instrumentnumber") ||
          params.get("instrument") ||
          params.get("inst") ||
          params.get("doc") ||
          params.get("document") ||
          params.get("docnum") ||
          instrumentNumber ||
          null;
      } catch (e) {
        // ignore malformed urls
      }
    }

    const deedType = mapInstrumentToDeedType(s.instrument);
    const deed = cleanObject({
      deed_type: deedType,
      book: book || null,
      page: page || null,
      volume: volume || null,
      instrument_number: instrumentNumber || null,
    });
    writeJSON(path.join(dataDir, `deed_${idx}.json`), deed);

    const file = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join(dataDir, `file_${idx}.json`), file);

    const relDeedFile = {
      from: { "/": `./deed_${idx}.json` },
      to: { "/": `./file_${idx}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_deed_${idx}_has_file_${idx}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      from: { "/": `./sales_history_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_history_${idx}_has_deed.json`),
      relSalesDeed,
    );
  });
}
function cleanupFiles(patterns) {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (patterns.some((re) => re.test(f))) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function createLayoutBase() {
  return {
    space_type: null,
    space_type_index: null,
    flooring_material_type: null,
    size_square_feet: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: null,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
    kitchen_renovation_date: null,
    heated_area_sq_ft: null,
    installation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: null,
  };
}

function normalizeNumber(value) {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapExtraFeatureToSpaceType(feature) {
  const code = (feature && feature.code) ? String(feature.code).trim() : "";
  const descRaw = feature && feature.description ? feature.description : "";
  const desc = descRaw.toUpperCase();

  if (desc.includes("POOL") || code === "0280") {
    if (desc.includes("SPA")) return "Hot Tub / Spa Area";
    return "Outdoor Pool";
  }
  if (desc.includes("PATIO")) return "Patio";
  if (desc.includes("PORCH")) {
    if (desc.includes("SCREEN")) return "Screened Porch";
    if (desc.includes("OPEN")) return "Open Porch";
    if (desc.includes("ENCLOSED")) return "Enclosed Porch";
    return "Porch";
  }
  if (desc.includes("DECK")) return "Deck";
  if (desc.includes("CARPORT")) return "Carport";
  if (desc.includes("GARAGE")) return "Attached Garage";
  if (
    desc.includes("STORAGE") ||
    desc.includes("UTILITY") ||
    desc.includes("UDU") ||
    desc.includes("UDC") ||
    desc.includes("UDG") ||
    desc.includes("UDS")
  ) {
    return "Storage Room";
  }
  if (desc.includes("CABANA")) return "Enclosed Cabana";
  if (desc.includes("OFFICE")) return "Office Room";
  if (desc.includes("BALCONY")) return "Balcony";
  return null;
}

function writeLayoutsUtilitiesStructures(layoutEntry, utilityRecord, structureRecord, propertyMapping, parcelId) {
  const cleanupPatterns = [
    /^layout_\d+\.json$/i,
    /^utility_\d+\.json$/i,
    /^structure_\d+\.json$/i,
    /^relationship_layout_.*_has_layout_.*\.json$/i,
    /^relationship_layout_\d+_to_layout_\d+\.json$/i,
    /^relationship_layout_to_utility_\d+\.json$/i,
    /^relationship_layout_to_structure_\d+\.json$/i,
    /^relationship_layout_.*_has_utility_.*\.json$/i,
    /^relationship_layout_.*_has_structure_.*\.json$/i,
    /^relationship_property_has_utility_.*\.json$/i,
    /^relationship_property_has_structure_.*\.json$/i,
  ];
  cleanupFiles(cleanupPatterns);

  if (
    !layoutEntry ||
    !Array.isArray(layoutEntry.buildings) ||
    layoutEntry.buildings.length === 0
  ) {
    return;
  }
  if (
    propertyMapping &&
    typeof propertyMapping.property_type === "string" &&
    propertyMapping.property_type.toLowerCase() === "landparcel"
  ) {
    return;
  }

  const dataDir = "data";
  const buildings = layoutEntry.buildings;
  const buildingCountTotal = buildings.length;
  const extraFeaturesGlobal = Array.isArray(layoutEntry.extra_features)
    ? layoutEntry.extra_features
    : [];
  let remainingExtraFeatures = [...extraFeaturesGlobal];
  const buildingLayouts = [];
  const buildingNumberToLayoutId = new Map();
  let layoutCounter = 0;

  function writeLayoutFile(layoutData) {
    layoutCounter += 1;
    const filename = `layout_${layoutCounter}.json`;
    writeJSON(path.join(dataDir, filename), layoutData);
    return layoutCounter;
  }

  buildings.forEach((building, index) => {
    const buildingIdx = index + 1;
    const buildingNumber =
      building.building_number != null ? building.building_number : buildingIdx;
    const totalArea = normalizeNumber(building.total_area_sq_ft);
    const livableArea = normalizeNumber(
      building.livable_area_sq_ft != null
        ? building.livable_area_sq_ft
        : building.heated_area_sq_ft,
    );
    const buildingLayout = createLayoutBase();
    buildingLayout.space_type = "Building";
    buildingLayout.space_type_index = `${buildingIdx}`;
    buildingLayout.building_number = buildingNumber;
    buildingLayout.total_area_sq_ft = totalArea;
    buildingLayout.livable_area_sq_ft = livableArea;
    buildingLayout.heated_area_sq_ft = livableArea;
    buildingLayout.area_under_air_sq_ft = livableArea;
    buildingLayout.size_square_feet = totalArea;
    buildingLayout.is_finished = true;
    const buildingLayoutId = writeLayoutFile(buildingLayout);

    buildingLayouts.push({
      layoutId: buildingLayoutId,
      buildingNumber: String(buildingNumber),
      buildingIndex: buildingIdx,
    });
    buildingNumberToLayoutId.set(String(buildingNumber), buildingLayoutId);

    const rooms = Array.isArray(building.rooms) ? building.rooms : [];
    const typeCounters = new Map();

    const nextIndexForType = (type) => {
      const current = typeCounters.get(type) || 0;
      const next = current + 1;
      typeCounters.set(type, next);
      return `${buildingIdx}.${next}`;
    };

    rooms.forEach((room) => {
      if (!room || !room.type) return;
      const count = Number(room.count) || 0;
      if (count <= 0) return;
      for (let i = 0; i < count; i += 1) {
        const roomLayout = createLayoutBase();
        roomLayout.space_type = room.type;
        roomLayout.space_type_index = nextIndexForType(room.type);
        roomLayout.building_number = buildingNumber;
        roomLayout.is_finished = true;
        const childLayoutId = writeLayoutFile(roomLayout);
        writeJSON(
          path.join(
            dataDir,
            `relationship_layout_${buildingLayoutId}_has_layout_${childLayoutId}.json`,
          ),
          {
            from: { "/": `./layout_${buildingLayoutId}.json` },
            to: { "/": `./layout_${childLayoutId}.json` },
          },
        );
      }
    });

    let buildingExtraFeatures = [];
    if (
      Array.isArray(building.extra_features) &&
      building.extra_features.length
    ) {
      buildingExtraFeatures = building.extra_features;
    } else if (buildingCountTotal === 1 && remainingExtraFeatures.length) {
      buildingExtraFeatures = remainingExtraFeatures;
      remainingExtraFeatures = [];
    }

    buildingExtraFeatures.forEach((feature) => {
      const spaceType = mapExtraFeatureToSpaceType(feature);
      if (!spaceType) return;
      const featureArea = normalizeNumber(
        feature && feature.units != null ? feature.units : null,
      );
      const featureLayout = createLayoutBase();
      featureLayout.space_type = spaceType;
      featureLayout.space_type_index = nextIndexForType(spaceType);
      featureLayout.building_number = buildingNumber;
      featureLayout.is_finished = false;
      featureLayout.total_area_sq_ft = featureArea;
      featureLayout.size_square_feet = featureArea;
      featureLayout.area_under_air_sq_ft = null;
      featureLayout.livable_area_sq_ft = null;
      featureLayout.heated_area_sq_ft = null;
      const layoutId = writeLayoutFile(featureLayout);
      if (buildingCountTotal === 1) {
        writeJSON(
          path.join(
            dataDir,
            `relationship_layout_${buildingLayoutId}_has_layout_${layoutId}.json`,
          ),
          {
            from: { "/": `./layout_${buildingLayoutId}.json` },
            to: { "/": `./layout_${layoutId}.json` },
          },
        );
      }
    });
  });

  const propertyFrom = { "/": "./property.json" };

  const buildingCount = buildingLayouts.length;
  const buildingNumberSet = new Set(
    buildingLayouts.map((b) => String(b.buildingNumber)),
  );
  const buildingNumberDefaultMap = new Map(
    buildingLayouts.map((b, idx) => [String(idx + 1), b.layoutId]),
  );

  let utilityCounter = 0;
  const utilityEntries = utilityRecord
    ? Object.entries(utilityRecord)
    : [];
  utilityEntries.forEach(([rawKey, utilityData]) => {
    utilityCounter += 1;
    const utilityFilename = `utility_${utilityCounter}.json`;
    writeJSON(path.join(dataDir, utilityFilename), utilityData || {});
    const normalizedKey = rawKey != null ? String(rawKey).trim() : "";
    let relationshipPath;
    if (buildingCount === 0) {
      relationshipPath = propertyFrom;
    } else if (buildingCount === 1) {
      const targetLayoutId = buildingLayouts[0].layoutId;
      relationshipPath = { "/": `./layout_${targetLayoutId}.json` };
    } else if (utilityEntries.length === 1) {
      relationshipPath = propertyFrom;
    } else if (buildingNumberSet.has(normalizedKey)) {
      const targetLayoutId =
        buildingNumberToLayoutId.get(normalizedKey) ||
        buildingNumberDefaultMap.get(normalizedKey);
      if (targetLayoutId) {
        relationshipPath = { "/": `./layout_${targetLayoutId}.json` };
      } else {
        relationshipPath = propertyFrom;
      }
    } else {
      relationshipPath = propertyFrom;
    }

    if (relationshipPath && relationshipPath["/"]?.includes("layout_")) {
      const layoutId = relationshipPath["/"]
        .replace("./layout_", "")
        .replace(".json", "");
      writeJSON(
        path.join(
          dataDir,
          `relationship_layout_${layoutId}_has_utility_${utilityCounter}.json`,
        ),
        {
          from: relationshipPath,
          to: { "/": `./utility_${utilityCounter}.json` },
        },
      );
    } else {
      writeJSON(
        path.join(
          dataDir,
          `relationship_property_has_utility_${utilityCounter}.json`,
        ),
        {
          from: propertyFrom,
          to: { "/": `./utility_${utilityCounter}.json` },
        },
      );
    }
  });

  let structureCounter = 0;
  const structureEntries = structureRecord
    ? Object.entries(structureRecord)
    : [];
  structureEntries.forEach(([rawKey, structureData]) => {
    structureCounter += 1;
    const structureFilename = `structure_${structureCounter}.json`;
    writeJSON(path.join(dataDir, structureFilename), structureData || {});
    const normalizedKey = rawKey != null ? String(rawKey).trim() : "";
    let relationshipPath;
    if (buildingCount === 0) {
      relationshipPath = propertyFrom;
    } else if (buildingCount === 1) {
      const targetLayoutId = buildingLayouts[0].layoutId;
      relationshipPath = { "/": `./layout_${targetLayoutId}.json` };
    } else if (structureEntries.length === 1) {
      relationshipPath = propertyFrom;
    } else if (buildingNumberSet.has(normalizedKey)) {
      const targetLayoutId =
        buildingNumberToLayoutId.get(normalizedKey) ||
        buildingNumberDefaultMap.get(normalizedKey);
      if (targetLayoutId) {
        relationshipPath = { "/": `./layout_${targetLayoutId}.json` };
      } else {
        relationshipPath = propertyFrom;
      }
    } else {
      relationshipPath = propertyFrom;
    }

    if (relationshipPath && relationshipPath["/"]?.includes("layout_")) {
      const layoutId = relationshipPath["/"]
        .replace("./layout_", "")
        .replace(".json", "");
      writeJSON(
        path.join(
          dataDir,
          `relationship_layout_${layoutId}_has_structure_${structureCounter}.json`,
        ),
        {
          from: relationshipPath,
          to: { "/": `./structure_${structureCounter}.json` },
        },
      );
    } else {
      writeJSON(
        path.join(
          dataDir,
          `relationship_property_has_structure_${structureCounter}.json`,
        ),
        {
          from: propertyFrom,
          to: { "/": `./structure_${structureCounter}.json` },
        },
      );
    }
  });
}

let people = [];
let companies = [];
let personNameIndexMap = new Map();
let companyNameIndexMap = new Map();
let ownerVariantMap = new Map();
let ownerCanonicalMap = new Map();

const OWNER_CANONICAL_STOP_WORDS = new Set([
  "A",
  "AN",
  "AND",
  "THE",
  "OF",
  "LLC",
  "L.L.C.",
  "LC",
  "L.C.",
  "LLP",
  "L.L.P.",
  "LP",
  "L.P.",
  "INC",
  "INC.",
  "CO",
  "CO.",
  "COMPANY",
  "CORP",
  "CORP.",
  "CORPORATION",
  "H&W",
  "HW",
  "H/W",
  "HUSBAND",
  "WIFE",
  "FKA",
  "F/K/A",
  "AKA",
  "A/K/A",
  "NKA",
  "N/K/A",
  "ET",
  "UX",
  "UXOR",
  "ETUX",
  "ETAL",
  "ET AL",
  "TRUST",
  "TRUSTEE",
  "TR",
  "C/O",
  "DBA",
  "D/B/A",
  "&",
]);

function normalizeOwnerKey(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\*/g, "")
    .replace(/[\u00A0]+/g, " ")
    .replace(/[^A-Za-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanOwnerRawString(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMeaningfulOwnerName(value) {
  const cleaned = cleanOwnerRawString(value);
  if (!cleaned) return false;
  return !/^(NONE|N\/A|NA|NULL|UNKNOWN)$/i.test(cleaned);
}

function buildCanonicalOwnerKey(raw) {
  const cleaned = cleanOwnerRawString(raw);
  if (!cleaned) return null;
  const tokens = cleaned
    .replace(/[,/&]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(
      (token) => token && token.length > 0 && !OWNER_CANONICAL_STOP_WORDS.has(token),
    );
  if (tokens.length === 0) return null;
  const uniqueTokens = Array.from(new Set(tokens));
  uniqueTokens.sort();
  return uniqueTokens.join("|");
}

function splitOwnerRawNames(raw) {
  if (!hasMeaningfulOwnerName(raw)) return [];
  const cleaned = cleanOwnerRawString(raw);
  if (!cleaned) return [];
  const replaced = cleaned
    .replace(/\s+\/\s+/g, "|")
    .replace(/\s+&\s+/g, "|")
    .replace(/,\s+AND\s+/gi, "|")
    .replace(/\s+AND\s+/gi, "|");
  return replaced
    .split("|")
    .map((part) => cleanOwnerRawString(part))
    .filter(hasMeaningfulOwnerName);
}

function generateNormalizedVariants(raw) {
  const variants = new Set();
  const cleaned = cleanOwnerRawString(raw);
  if (!cleaned) return [];
  variants.add(normalizeOwnerKey(cleaned));
  const noComma = cleaned.replace(/,/g, " ");
  variants.add(normalizeOwnerKey(noComma));
  const words = noComma
    .replace(/[.]/g, " ")
    .split(/\s+/)
    .filter((word) => word && word.trim().length > 0);
  if (words.length > 1) {
    variants.add(normalizeOwnerKey(words.join(" ")));
    const reversed = [...words].reverse().join(" ");
    variants.add(normalizeOwnerKey(reversed));
    const rotated = [...words.slice(1), words[0]].join(" ");
    variants.add(normalizeOwnerKey(rotated));
  }
  return Array.from(variants).filter((variant) => variant && variant.length);
}

function registerPersonNameVariants(person, idx) {
  if (!person) return;
  const first = person.first_name ? person.first_name.trim() : "";
  const middle = person.middle_name ? person.middle_name.trim() : "";
  const last = person.last_name ? person.last_name.trim() : "";
  const variants = new Set();
  if (first && last) {
    variants.add(`${first} ${last}`);
    variants.add(`${last} ${first}`);
  }
  if (first && middle && last) {
    variants.add(`${first} ${middle} ${last}`);
    variants.add(`${first} ${middle.charAt(0)} ${last}`);
    variants.add(`${last} ${first} ${middle}`);
    variants.add(`${last} ${first} ${middle.charAt(0)}`);
  }
  if (first && last) {
    variants.add(`${first} ${last}`);
  }
  if (first) variants.add(first);
  if (last) variants.add(last);
  if (middle) variants.add(`${first} ${middle}`);
  const normalizedVariants = [];
  variants.forEach((variant) => {
    const normalized = normalizeOwnerKey(variant);
    if (!normalized) return;
    normalizedVariants.push(normalized);
    if (!personNameIndexMap.has(normalized)) {
      personNameIndexMap.set(normalized, idx);
    }
  });
  registerVariantRefs(normalizedVariants, "person", idx);
  const canonical = buildCanonicalOwnerKey(
    [first, middle, last].filter(Boolean).join(" "),
  );
  if (canonical) registerCanonicalKey(canonical, "person", idx);
}

function registerCompanyNameVariants(company, idx) {
  if (!company) return;
  const name = company.name ? company.name.trim() : "";
  const normalized = normalizeOwnerKey(name);
  if (normalized && !companyNameIndexMap.has(normalized)) {
    companyNameIndexMap.set(normalized, idx);
  }
  if (normalized) registerVariantRefs([normalized], "company", idx);
  const canonical = buildCanonicalOwnerKey(name);
  if (canonical) registerCanonicalKey(canonical, "company", idx);
}

function registerVariantRefs(variants, type, idx) {
  variants.forEach((variant) => {
    if (!variant) return;
    if (!ownerVariantMap.has(variant)) {
      ownerVariantMap.set(variant, { type, index: idx });
    }
  });
}

function registerCanonicalKey(key, type, idx) {
  if (!key) return;
  if (!ownerCanonicalMap.has(key)) {
    ownerCanonicalMap.set(key, { type, index: idx });
  }
}

function rebuildOwnerNameIndexes() {
  personNameIndexMap = new Map();
  companyNameIndexMap = new Map();
  ownerVariantMap = new Map();
  ownerCanonicalMap = new Map();
  people.forEach((person, idx) => {
    registerPersonNameVariants(person, idx + 1);
  });
  companies.forEach((company, idx) => {
    registerCompanyNameVariants(company, idx + 1);
  });
}

function guessOwnerTypeFromRaw(raw) {
  const cleaned = cleanOwnerRawString(raw).toUpperCase();
  if (!cleaned) return "person";
  const companyIndicators = [
    " LLC",
    " LLP",
    " LLLP",
    " INC",
    " CORPORATION",
    " CORP",
    " COMPANY",
    " CO ",
    " CO.",
    " BANK",
    " TRUST",
    " CITY",
    " COUNTY",
    " CHURCH",
    " MINISTRIES",
    " SCHOOL",
    " STATE",
    " DEPT",
    " DEPARTMENT",
    " CLUB",
    " ASSOCIATES",
    " ASSOC",
    " HOSPITAL",
    " UNIVERSITY",
    " FUND",
    " GROUP",
    " HOLDINGS",
    " PROPERTIES",
    " PROPERTY",
    " PARTNERS",
    " PARTNERSHIP",
    " DEVELOPMENT",
    " DEV ",
    " MGMT",
    " MANAGEMENT",
    " PC",
    " PLC",
    " LTD",
    " LP",
    " ESTATE",
    " EST ",
    " TRUSTEE",
    " TR ",
    " HOA",
    " MORTGAGE",
  ];
  if (companyIndicators.some((indicator) => cleaned.includes(indicator)))
    return "company";
  if (/\d/.test(cleaned)) return "company";
  return "person";
}

function createCompanyFromRaw(raw, parcelId) {
  const name = cleanOwnerRawString(raw).toUpperCase();
  return {
    name: name || null,
    request_identifier: parcelId,
  };
}

function createPersonFromRaw(raw, parcelId) {
  const cleaned = cleanOwnerRawString(raw);
  const baseFields = {
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  };
  if (!cleaned) {
    return {
      first_name: null,
      middle_name: null,
      last_name: null,
      ...baseFields,
    };
  }
  if (cleaned.includes(",")) {
    const [lastRaw, restRaw] = cleaned.split(",", 2);
    const restParts = restRaw.trim().split(/\s+/).filter(Boolean);
    const first = restParts[0] ? titleCaseName(restParts[0]) : null;
    let middle = null;
    if (restParts.length > 1) {
      middle = titleCaseName(restParts.slice(1).join(" "));
    }
    return {
      first_name: first,
      middle_name: middle,
      last_name: lastRaw ? titleCaseName(lastRaw) : null,
      ...baseFields,
    };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      first_name: titleCaseName(parts[0]),
      middle_name: null,
      last_name: null,
      ...baseFields,
    };
  }
  if (parts.length === 2) {
    return {
      first_name: titleCaseName(parts[1]),
      middle_name: null,
      last_name: titleCaseName(parts[0]),
      ...baseFields,
    };
  }
  const first = titleCaseName(parts[1]);
  const last = titleCaseName(parts[0]);
  const middle = titleCaseName(parts.slice(2).join(" "));
  return {
    first_name: first,
    middle_name: middle || null,
    last_name: last,
    ...baseFields,
  };
}

function ensureOwnerRefFromRaw(raw, parcelId) {
  if (!hasMeaningfulOwnerName(raw)) return null;
  const variants = generateNormalizedVariants(raw);
  const canonicalKey = buildCanonicalOwnerKey(raw);
  if (canonicalKey && ownerCanonicalMap.has(canonicalKey)) {
    return ownerCanonicalMap.get(canonicalKey);
  }
  for (const variant of variants) {
    if (ownerVariantMap.has(variant)) return ownerVariantMap.get(variant);
  }
  for (const variant of variants) {
    if (companyNameIndexMap.has(variant)) {
      return { type: "company", index: companyNameIndexMap.get(variant) };
    }
    if (personNameIndexMap.has(variant)) {
      return { type: "person", index: personNameIndexMap.get(variant) };
    }
  }
  const ownerType = guessOwnerTypeFromRaw(raw);
  if (ownerType === "person") {
    const personObj = createPersonFromRaw(raw, parcelId);
    people.push(personObj);
    const idx = people.length;
    writeJSON(path.join("data", `person_${idx}.json`), personObj);
    registerPersonNameVariants(personObj, idx);
    registerVariantRefs(variants, "person", idx);
    if (canonicalKey) registerCanonicalKey(canonicalKey, "person", idx);
    return { type: "person", index: idx };
  }
  const companyObj = createCompanyFromRaw(raw, parcelId);
  companies.push(companyObj);
  const idx = companies.length;
  writeJSON(path.join("data", `company_${idx}.json`), companyObj);
  registerCompanyNameVariants(companyObj, idx);
  registerVariantRefs(variants, "company", idx);
  if (canonicalKey) registerCanonicalKey(canonicalKey, "company", idx);
  return { type: "company", index: idx };
}

function dedupeOwnerNames(names) {
  const seen = new Set();
  const out = [];
  (names || []).forEach((name) => {
    const normalized = normalizeOwnerKey(name);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(name);
  });
  return out;
}

function getFallbackOwnerNamesFromGrantors(sales, idx) {
  const out = [];
  if (idx + 1 < sales.length) {
    out.push(...splitOwnerRawNames(sales[idx + 1].grantor));
  }
  if (out.length === 0 && idx > 0) {
    out.push(...splitOwnerRawNames(sales[idx - 1].grantor));
  }
  return dedupeOwnerNames(out);
}

function removeUnusedOwnerFiles(usedPersonIdx, usedCompanyIdx) {
  people.forEach((_, idx) => {
    const fileIdx = idx + 1;
    if (usedPersonIdx.has(fileIdx)) return;
    const filePath = path.join("data", `person_${fileIdx}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  });
  companies.forEach((_, idx) => {
    const fileIdx = idx + 1;
    if (usedCompanyIdx.has(fileIdx)) return;
    const filePath = path.join("data", `company_${fileIdx}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  });
}

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
  const raw = (name || "").trim();
  const tn = raw.toUpperCase();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  const normalized = normalizeOwnerKey(raw);
  if (normalized && ownerVariantMap.has(normalized)) {
    const entry = ownerVariantMap.get(normalized);
    if (entry.type === "company") return entry.index;
  }
  const canonical = buildCanonicalOwnerKey(raw);
  if (canonical && ownerCanonicalMap.has(canonical)) {
    const entry = ownerCanonicalMap.get(canonical);
    if (entry.type === "company") return entry.index;
  }
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writePersonCompaniesSalesRelationships(
  parcelId,
  sales,
  hasOwnerMailingAddress,
) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  const key = `property_${parcelId}`;
  const record = owners && owners[key] ? owners[key] : null;
  const ownersByDate =
    record && record.owners_by_date && typeof record.owners_by_date === "object"
      ? record.owners_by_date
      : {};
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
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  const companyCanonicalMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type !== "company") return;
      const rawName = (o.name || "").trim();
      if (!rawName) return;
      const canonical = buildCanonicalOwnerKey(rawName);
      const fallbackKey = normalizeOwnerKey(rawName);
      const key = canonical || fallbackKey;
      if (!key) return;
      if (!companyCanonicalMap.has(key)) {
        companyCanonicalMap.set(key, rawName.toUpperCase());
      }
    });
  });
  companies = Array.from(companyCanonicalMap.values()).map((n) => ({
    name: n,
    request_identifier: parcelId,
  }));

  const entityCleanupPatterns = [
    /^person_\d+\.json$/i,
    /^company_\d+\.json$/i,
  ];
  try {
    fs.readdirSync("data").forEach((f) => {
      if (entityCleanupPatterns.some((re) => re.test(f))) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });

  rebuildOwnerNameIndexes();

  const usedPersonIdx = new Set();
  const usedCompanyIdx = new Set();

  const cleanupRelationshipPatterns = [
    /^relationship_sales_person_\d+\.json$/i,
    /^relationship_sales_company_\d+\.json$/i,
    /^relationship_sales_history_\d+_buyer_(person|company)_\d+\.json$/i,
  ];
  try {
    fs.readdirSync("data").forEach((f) => {
      if (cleanupRelationshipPatterns.some((re) => re.test(f))) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  let latestSaleISO = null;
  let latestSaleIdx = null;
  sales.forEach((rec, idx) => {
    const iso = parseDateToISO(rec.saleDate);
    if (!iso) return;
    if (!latestSaleISO || iso > latestSaleISO) {
      latestSaleISO = iso;
      latestSaleIdx = idx + 1;
    }
  });

  sales.forEach((rec, idx) => {
    const saleIdx = idx + 1;
    const iso = parseDateToISO(rec.saleDate);
    const seenPersonIdx = new Set();
    const seenCompanyIdx = new Set();
    const buyerRefs = [];

    const appendOwnerRefs = (ownersList) => {
      (ownersList || []).forEach((buyer) => {
        if (!buyer || !buyer.type) return;
        if (buyer.type === "person") {
          const personIdx = findPersonIndexByName(
            buyer.first_name,
            buyer.last_name,
          );
          if (!personIdx || seenPersonIdx.has(personIdx)) return;
          seenPersonIdx.add(personIdx);
          buyerRefs.push({ type: "person", index: personIdx });
        } else if (buyer.type === "company") {
          const companyIdx = findCompanyIndexByName(buyer.name);
          if (!companyIdx || seenCompanyIdx.has(companyIdx)) return;
          seenCompanyIdx.add(companyIdx);
          buyerRefs.push({ type: "company", index: companyIdx });
        }
      });
    };

    if (iso && ownersByDate[iso]) {
      appendOwnerRefs(ownersByDate[iso]);
    } else if (latestSaleIdx === saleIdx && ownersByDate["current"]) {
      appendOwnerRefs(ownersByDate["current"]);
    }

    if (buyerRefs.length === 0) {
      let fallbackNames = splitOwnerRawNames(rec.grantee);
      if (fallbackNames.length === 0) {
        fallbackNames = getFallbackOwnerNamesFromGrantors(sales, idx);
      }
      if (fallbackNames.length === 0) {
        fallbackNames = splitOwnerRawNames(rec.grantor);
      }
      const uniqueFallbackNames = dedupeOwnerNames(fallbackNames);
      uniqueFallbackNames.forEach((rawName) => {
        const ref = ensureOwnerRefFromRaw(rawName, parcelId);
        if (!ref) return;
        if (ref.type === "person") {
          if (seenPersonIdx.has(ref.index)) return;
          seenPersonIdx.add(ref.index);
        } else if (ref.type === "company") {
          if (seenCompanyIdx.has(ref.index)) return;
          seenCompanyIdx.add(ref.index);
        }
        buyerRefs.push(ref);
      });
    }

    if (buyerRefs.length === 0) return;

    let personCounter = 0;
    let companyCounter = 0;

    buyerRefs.forEach((ref) => {
      if (ref.type === "person") {
        usedPersonIdx.add(ref.index);
        personCounter += 1;
        const relObj = {
          from: { "/": `./sales_history_${saleIdx}.json` },
          to: { "/": `./person_${ref.index}.json` },
        };
        writeJSON(
          path.join(
            "data",
            `relationship_sales_history_${saleIdx}_buyer_person_${personCounter}.json`,
          ),
          relObj,
        );
      } else if (ref.type === "company") {
        usedCompanyIdx.add(ref.index);
        companyCounter += 1;
        const relObj = {
          from: { "/": `./sales_history_${saleIdx}.json` },
          to: { "/": `./company_${ref.index}.json` },
        };
        writeJSON(
          path.join(
            "data",
            `relationship_sales_history_${saleIdx}_buyer_company_${companyCounter}.json`,
          ),
          relObj,
        );
      }
    });
  });

  if (hasOwnerMailingAddress) {
    const mailingRelationshipPatterns = [
      /^relationship_person_has_mailing_address_\d+\.json$/i,
      /^relationship_company_has_mailing_address_\d+\.json$/i,
    ];
    try {
      fs.readdirSync("data").forEach((f) => {
        if (mailingRelationshipPatterns.some((re) => re.test(f))) {
          fs.unlinkSync(path.join("data", f));
        }
      });
    } catch (e) {}

    const currentOwner = ownersByDate["current"] || [];
    let relPersonCounter = 0;
    let relCompanyCounter = 0;
    const seenMailingPerson = new Set();
    const seenMailingCompany = new Set();
    currentOwner
    .filter((o) => o.type === "person")
    .forEach((o) => {
      const pIdx = findPersonIndexByName(o.first_name, o.last_name);
      if (pIdx && !seenMailingPerson.has(pIdx)) {
        seenMailingPerson.add(pIdx);
        usedPersonIdx.add(pIdx);
        relPersonCounter++;
        writeJSON(
          path.join(
            "data",
            `relationship_person_has_mailing_address_${relPersonCounter}.json`,
          ),
          {
            from: { "/": `./person_${pIdx}.json` },
            to: { "/": `./mailing_address.json` },
          },
        );
      }
    });
    currentOwner
    .filter((o) => o.type === "company")
    .forEach((o) => {
      const cIdx = findCompanyIndexByName(o.name);
      if (cIdx && !seenMailingCompany.has(cIdx)) {
        seenMailingCompany.add(cIdx);
        usedCompanyIdx.add(cIdx);
        relCompanyCounter++;
        writeJSON(
          path.join(
            "data",
            `relationship_company_has_mailing_address_${relCompanyCounter}.json`,
          ),
          {
            from: { "/": `./company_${cIdx}.json` },
            to: { "/": `./mailing_address.json` },
          },
        );
      }
    });
  }

  removeUnusedOwnerFiles(usedPersonIdx, usedCompanyIdx);
}

function writeTaxes($) {
  const vals = extractValuation($);
  vals.forEach((v) => {
    const taxObj = {
      tax_year: v.year || null,
      property_assessed_value_amount: parseCurrencyToNumber(v.assessed),
      property_market_value_amount: parseCurrencyToNumber(v.market),
      property_building_amount: parseCurrencyToNumber(v.building),
      property_land_amount: parseCurrencyToNumber(v.land),
      property_taxable_value_amount: parseCurrencyToNumber(v.taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
  });
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if (th === null) {
      th = textOf($(tr).find("td strong"));
    }
    if ((th || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($(tr).find("td span"));
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function extractAddressText($) {
  let add = null;
  let foundAddressText = false;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if (th === null) {
      th = textOf($(tr).find("td strong"));
    }
    if ((th || "").toLowerCase().includes("address")) {
      foundAddressText = true;
      add = textOf($(tr).find("td span")).replace(/  +/g, ' ');
    } else if (foundAddressText && (th || "").toLowerCase().trim() === "") {
      add += (", " + textOf($(tr).find("td span")).replace(/  +/g, ' '));
    } else {
      foundAddressText = false
    }
  });
  return add;
}

function extractOwnerMailingAddress($) {
  return textOf($(OWNER_MAILING_ADDRESS_SELECTOR)).replace(/  +/g, ' ');;
}

function attemptWriteAddress(
  unnorm,
  secTwpRng,
  siteAddress,
  mailingAddress,
  propertySeed,
) {
  let hasOwnerMailingAddress = false;
  const unnormSafe = unnorm || {};
  const inputCounty = (unnormSafe.county_jurisdiction || "").trim();
  const county_name = inputCounty || null;
  const sourceHttpRequest =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormSafe && unnormSafe.source_http_request) ||
    null;
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnormSafe && unnormSafe.request_identifier) ||
    null;
  const country_code = (unnormSafe && unnormSafe.country_code) || "US";
  if (mailingAddress) {
    const mailingAddressObj = {
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddress,
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
    };
    writeJSON(path.join("data", "mailing_address.json"), mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const addressObj = {
      unnormalized_address: siteAddress,
      section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
      township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
      range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
      county_name,
      country_code,
    };
    writeJSON(path.join("data", "address.json"), addressObj);
    writeJSON(path.join("data", "relationship_property_has_address.json"), {
      to: { "/": `./address.json` },
      from: { "/": `./property.json` },
    });

    const latRaw = unnormSafe.latitude;
    const lonRaw = unnormSafe.longitude;
    const latNum =
      typeof latRaw === "number" ? latRaw : Number.parseFloat(latRaw);
    const lonNum =
      typeof lonRaw === "number" ? lonRaw : Number.parseFloat(lonRaw);
    const latitude = Number.isFinite(latNum) ? latNum : null;
    const longitude = Number.isFinite(lonNum) ? lonNum : null;
    const geometryObj = {
      latitude,
      longitude,
      source_http_request: sourceHttpRequest,
      request_identifier: requestIdentifier,
    };
    writeJSON(path.join("data", "geometry.json"), geometryObj);
    const relGeometryPath = path.join(
      "data",
      "relationship_address_has_geometry.json",
    );
    const legacyRelGeometryPath = path.join(
      "data",
      "realtionship_address_has_geometry.json",
    );
    try {
      if (fs.existsSync(legacyRelGeometryPath)) {
        fs.unlinkSync(legacyRelGeometryPath);
      }
    } catch (e) {}
    writeJSON(relGeometryPath, {
      from: { "/": "./address.json" },
      to: { "/": "./geometry.json" },
    });
  }
  return hasOwnerMailingAddress;
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnormalized && unnormalized.request_identifier) ||
    parcelId ||
    null;
  const layoutData = readJSON(path.join("owners", "layout_data.json"));
  const utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  const structureData = readJSON(path.join("owners", "structure_data.json"));
  const key = parcelId ? `property_${parcelId}` : null;

  let propertyMapping = null;
  if (parcelId) {
    propertyMapping = writeProperty($, parcelId);
  }

  const sales = extractSales($);
  writeSalesDeedsFilesAndRelationships($, requestIdentifier);

  writeTaxes($);

  const secTwpRng = extractSecTwpRng($);
  const addressText = extractAddressText($);
  const mailingAddress = extractOwnerMailingAddress($);
  const hasOwnerMailingAddress = attemptWriteAddress(
    unnormalized,
    secTwpRng,
    addressText,
    mailingAddress,
    propertySeed,
  );

  if (parcelId) {
    const layoutEntry =
      layoutData && key && layoutData[key] ? layoutData[key] : null;
    const utilityRecord =
      utilitiesData && key && utilitiesData[key] ? utilitiesData[key] : null;
    const structureRecord =
      structureData && key && structureData[key] ? structureData[key] : null;

    writeLayoutsUtilitiesStructures(
      layoutEntry,
      utilityRecord,
      structureRecord,
      propertyMapping,
      parcelId,
    );

    writePersonCompaniesSalesRelationships(parcelId, sales, hasOwnerMailingAddress);
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      writeJSON(path.join("data", "error.json"), e);
      console.error("Extraction error:", e);
      process.exit(1);
    } else {
      console.error("Unexpected error:", e);
      process.exit(1);
    }
  }
}
