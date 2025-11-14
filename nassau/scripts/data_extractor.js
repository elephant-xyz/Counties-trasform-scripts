const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping = [
  {
    "property_usecode": "3400 BOWLING ALLEY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "4500 CANNERIES/BOTTLERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "2610 CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9800 CENTRALLY ASSESSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 CHURCHES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700 CLUBS/LODGES/HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "1610 CMNTY SHOPPING CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Unit"
  },
  {
    "property_usecode": "8400 COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "2850 COMM PARKING LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0900 COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0005 COMMON S/D LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1600 COMMUNITY SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "0401 CONDO  BOAT SLIPS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0416 CONDO CMNTY SHOPPING",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0428 CONDO COM AREA/PRKNG",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0496 CONDO COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0403 CONDO GRG/PRK SPACES",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0439 CONDO HOTELS/MOTELS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0419 CONDO MEDICAL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0417 CONDO OFFICE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0402 CONDO STORAGE SPACES",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0412 CONDO STORE/OFFICE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0499 CONDO/VACANT LAND",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0400 CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9606 CONSERVATION ESMT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1410 CONVENIENCE STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "0500 COOPERATIVES",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600 COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8601 COUNTY VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5100 CROPLAND CLASS 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5200 CROPLAND CLASS 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5300 CROPLAND CLASS 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7900 CULTURAL GROUPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "6800 DAIRIES,FEEDLOTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 DEPARTMENT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200 DRIVE-IN REST.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "3100 DRIVE-IN/OPEN STAD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "8800 FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8801 FEDERAL VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2300 FINANCIAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 FLORIST/GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "8200 FOREST, PARKS, REC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3800 GOLF COURSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5902 HARDWOOD SI 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5901 HARDWOOD SI 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4200 HEAVY MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500 HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "3900 HOTELS AND MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3910 HOTELS/MOTELS CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "5000 IMPROVED AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2400 INSURANCE COMPANY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "0490 LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9000 LEASEHOLD INTEREST",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100 LIGHT MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 LUMBER YARD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "1720 MEDICAL OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "8100 MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700 MINERAL PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4840 MINI STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "9200 MINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0700 MISC RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "7600 MORTUARY/CEMETERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1800 MULTI STORY OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "0300 MULTI-FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 MULTI-FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "8900 MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8901 MUNICIPAL  VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3300 NIGHTCLUB/BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "9900 NO AG ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7500 NON-PROFIT SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1701 OFFICE BLDINGS CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1700 OFFICE BUILDINGS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "0010 OPEN SPACE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4900 OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 ORCHARDS, GROVES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 ORNAMENTALS,MISC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4600 OTHER FOOD PROCESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AgriculturalPackingFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400 PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 PARKING/MH LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 PASTURELAND 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6100 PASTURELAND 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6200 PASTURELAND 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6300 PASTURELAND 4",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6400 PASTURELAND 5",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6500 PASTURELAND 6",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 POULTRY,BEES,FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4870 PREFAB WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300 PRIVATE HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 PRIVATE SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "1901 PROF BLDG CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1920 PROF DAYCARE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900 PROFESSIONAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "8300 PUBLIC SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "3700 RACE TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9700 REC AND PARK LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1500 REGIONAL SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 REPAIR SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800 REST HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 RESTAURANTS/CAFE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "9602 RETENTION POND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0600 RETIREMENT HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "9400 RIGHTS-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9500 RIVERS AND LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2600 SERVICE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "0100 SINGLE FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "8700 STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8701 STATE  VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4830 STORAGE WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "1201 STORE/OFC/RES CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1200 STORE/OFFICE/RESID",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1100 STORES, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "9300 SUB-SURFACE RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1400 SUPERMARKET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 THEATER/AUDITORIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "5401 TIMBER 2-1 SI 90+",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5501 TIMBER 2-2 SI 80-89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5601 TIMBER 2-3 SI 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5701 TIMBER 2-4 SI 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5801 TIMBER 2-5 SI 50-59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5850 TIMBER 6",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5800 TIMBERLAND 50-59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5700 TIMBERLAND 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600 TIMBERLAND 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5500 TIMBERLAND 80-89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 TIMBERLAND 90+",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5900 TIMBERLAND UNCLASS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3500 TOURIST ATTRACTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000 TRANSIT TERMINALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9100 UTILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1001 V C W/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8001 V GV W/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4001 V IN W/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7001 V INS W/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8000 VAC GOVERNMENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7000 VAC INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0001 VAC W/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0000 VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1000 VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4000 VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2700 VEH SALE/REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 WAREHOUSE-STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "9600 WASTELAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2900 WHOLESALE OUTLET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "4950 Working Waterfront",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  }
]

const extraFeaturesCodeListMapping=[
  {
    "code": "0200",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0201",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0202",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0203",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "0204",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "0205",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "0350",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0351",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "0530",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0531",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "0532",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0533",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "0680",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "0681",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "0936",
    "class": "Utility",
    "property": "sewer_type",
    "value": "Septic"
  },
  {
    "code": "0937",
    "class": "Utility",
    "property": "water_source_type",
    "value": "Well"
  },
  {
    "code": "0963",
    "class": "Utility",
    "property": "public_utility_type",
    "value": "WaterAvailable"
  },
  {
    "code": "1049",
    "class": "Utility",
    "property": "public_utility_type",
    "value": "WaterAvailable"
  },
  {
    "code": "2700",
    "class": "Structure",
    "property": "roof_design_type",
    "value": "Barrel"
  },
  {
    "code": "2701",
    "class": "Structure",
    "property": "roof_design_type",
    "value": "Barrel"
  },
  {
    "code": "2703",
    "class": "Structure",
    "property": "roof_design_type",
    "value": "Barrel"
  },
  {
    "code": "3600",
    "class": "Utility",
    "property": "heating_fuel_type",
    "value": "Propane"
  },
  {
    "code": "5000",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Treated Wood Posts"
  },
  {
    "code": "5001",
    "class": "Utility",
    "property": "public_utility_type",
    "value": "ElectricityAvailable"
  }
]

const extraFeaturesCodeLookup = extraFeaturesCodeListMapping.reduce((lookup, entry) => {
  if (!entry || !entry.code) return lookup;
  lookup[entry.code.trim().toUpperCase()] = entry;
  return lookup;
}, {});

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }
  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();
  if (!normalizedUseCode) {
    return lookup;
    }
  lookup[normalizedUseCode] = entry.property_type ?? null;
  return lookup;
}, {});

const ownershipEstateTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.ownership_estate_type ?? null;
  return lookup;
}, {});

const buildStatusByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.build_status ?? null;
  return lookup;
}, {});

const structureFormByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.structure_form ?? null;
  return lookup;
}, {});

const propertyUsageTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.property_usage_type ?? null;
  return lookup;
}, {});


function readJSON(p) {
  const s = fs.readFileSync(p, "utf8");
  return JSON.parse(s);
}

// function extractStructure(parcelId) {
//   const structureData = readJSON(path.join("owners", "structure_data.json"));
//   const key = `property_${parcelId}`;
//   const s = structureData[key];
//   if (!s) return;
//   writeJSON(path.join("data", "structure.json"), s);
// }


function writeJSON(p, data) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  const rounded = Math.round(num * 100) / 100;
  if (Object.is(rounded, -0) || rounded === 0) return 0;
  return rounded;
}

function logEnumError(value, pathStr) {
  console.log(`Warning: Unknown enum value ${value} at path ${pathStr}`);
}

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[\s:]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
  }
  return null;
}

function mapOwnershipEstateTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[\s:]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(ownershipEstateTypeByUseCode, normalizedInput)) {
    return ownershipEstateTypeByUseCode[normalizedInput];
  }
  return null;
}

function mapBuildStatusFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[\s:]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(buildStatusByUseCode, normalizedInput)) {
    return buildStatusByUseCode[normalizedInput];
  }
  return null;
}

function mapStructureFormFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[\s:]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(structureFormByUseCode, normalizedInput)) {
    return structureFormByUseCode[normalizedInput];
  }
  return null;
}

function mapPropertyUsageTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[\s:]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(propertyUsageTypeByUseCode, normalizedInput)) {
    return propertyUsageTypeByUseCode[normalizedInput];
  }
  return null;
}

function extractMailingAddress(ownershipHtml) {
  const addressMatch = ownershipHtml.match(/<p>(.*?)<\/p>/s);
  if (!addressMatch) return null;
  
  return addressMatch[1]
    .replace(/<br>/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PERSON_NAME_PATTERN = /^[A-Z][a-z]*(?:[ \-',.][A-Za-z][a-z]*)*$/;

function validateNotNull(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    console.log(`Warning: ${fieldName} cannot be null or empty`);
    return value;
  }
  return value;
}

function validateStringNotNull(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    console.log(`Warning: ${fieldName} cannot be null or empty`);
    return value;
  }
  if (typeof value !== "string") {
    console.log(`Warning: ${fieldName} must be a string`);
    return value;
  }
  return value;
}

function validatePersonName(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    console.log(`Warning: ${fieldName} cannot be null or empty`);
    return value;
  }
  if (typeof value !== "string") {
    console.log(`Warning: ${fieldName} must be a string`);
    return value;
  }
  if (fieldName !== 'first_name' && fieldName !== 'last_name' && fieldName !== 'middle_name') {
    if (!PERSON_NAME_PATTERN.test(value)) {
      console.log(`Warning: ${fieldName} must match pattern ${PERSON_NAME_PATTERN.source}`);
    }
  }
  return value;
}

function formatName(name) {
  if (!name || name.trim() === "") return null;
  const normalizedSpacing = name.trim().toLowerCase().replace(/\s+/g, " ");
  const capitalized = normalizedSpacing.replace(/\b([a-z])/g, (_, ch) => ch.toUpperCase());
  const sanitized = capitalized.replace(/\. (?=[A-Za-z])/g, " ");
  return sanitized;
}

// Validate prefix/suffix against schema
function validatePrefix(prefix) {
  const validPrefixes = ["Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof.", "Rev.", "Fr.", "Sr.", "Br.", "Capt.", "Col.", "Maj.", "Lt.", "Sgt.", "Hon.", "Judge", "Rabbi", "Imam", "Sheikh", "Sir", "Dame"];
  return validPrefixes.find(p => p.toLowerCase() === prefix.toLowerCase()) || null;
}

function validateSuffix(suffix) {
  const validSuffixes = ["Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM", "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."];
  return validSuffixes.find(s => s.toLowerCase() === suffix.toLowerCase()) || null;
}

function parsePerson(name) {
  if (!name) return { firstName: null, lastName: null, middleName: null, prefix: null, suffix: null };
  
  let tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { firstName: null, lastName: null, middleName: null, prefix: null, suffix: null };

  // Extract prefix
  const prefixes = ["Mr.", "Mrs.", "Ms.", "Miss", "Mx.", "Dr.", "Prof.", "Rev.", "Fr.", "Sr.", "Br.", "Capt.", "Col.", "Maj.", "Lt.", "Sgt.", "Hon.", "Judge", "Rabbi", "Imam", "Sheikh", "Sir", "Dame"];
  let prefix = null;
  if (tokens.length > 0) {
    const foundPrefix = prefixes.find(p => tokens[0].toLowerCase() === p.toLowerCase());
    if (foundPrefix) {
      prefix = foundPrefix;
      tokens.shift();
    }
  }

  // Extract suffix (check all positions)
  const suffixes = ["Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM", "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."];
  let suffix = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const foundSuffix = suffixes.find(s => tokens[i].toLowerCase() === s.toLowerCase() || (s === "Jr." && tokens[i].toLowerCase() === "jr") || (s === "Sr." && tokens[i].toLowerCase() === "sr"));
    if (foundSuffix) {
      suffix = foundSuffix;
      tokens.splice(i, 1);
      break;
    }
  }

  if (tokens.length < 2) return { firstName: null, lastName: null, middleName: null, prefix, suffix };

  const firstName = tokens[0];
  const lastName = tokens[tokens.length - 1];
  const middleName = tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null;

  return { firstName, lastName, middleName, prefix, suffix };
}

function extractOwnerInfo(ownershipHtml) {
  if (!ownershipHtml) return [];
  
  // Remove content within <p></p> tags (addresses)
  const htmlWithoutAddresses = ownershipHtml.replace(/<p>.*?<\/p>/gs, '');
  
  // Split by <br> tags to get individual owner lines
  const ownerLines = htmlWithoutAddresses.split(/<br\s*\/?>/i)
    .map(line => line.replace(/<[^>]*>/g, '').trim())
    .filter(line => line.length > 0);
  
  const owners = [];
  const companyIndicators = /\b(LLC|INC|CORP|CORPORATION|LTD|LIMITED|LP|COMPANY|CO\.|TRUST|TRUSTEE|ESTATE|BANK|ASSOCIATION|ASSOC|PARTNERSHIP)\b/i;
  
  for (const line of ownerLines) {
    let cleanName = line.trim();
    if (cleanName && cleanName.length > 2) {
      // Decode HTML entities like &amp; to &
      cleanName = cleanName.replace(/&amp;/g, '&');
      
      // Split by & to handle multiple owners on same line
      const namesParts = cleanName.split(/\s*&\s*/);
      
      for (const namePart of namesParts) {
        const trimmedName = namePart.trim();
        if (trimmedName && trimmedName.length > 2) {
          const ownerType = companyIndicators.test(trimmedName) ? 'Company' : 'Person';
          owners.push({ name: trimmedName, type: ownerType });
        }
      }
    }
  }
  
  return owners;
}

function checkOwnerInfoVsCurrentOwners(ownerInfo, ownersByDateCurrent) {
  function normalizeSpace(str) {
    return (str || "").replace(/\s+/g, " ").trim();
  }
  
  function titleCase(str) {
    return (str || "")
      .toLowerCase()
      .replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
  }
  
  function buildPersonFromOwnerMapping(first, last, middle) {
    return {
      type: "person",
      first_name: titleCase(first),
      last_name: titleCase(last),
      middle_name: middle ? titleCase(middle) : null,
    };
  }
  
  function parsePersonOwnerMapping(name) {
    const s = normalizeSpace(name).replace(/\s+,\s+/g, ", ");
    const upper = s === s.toUpperCase();
    let tokens = s.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;

    if (upper) {
      // Assume LAST FIRST [MIDDLE] for uppercase names
      const last = tokens[0];
      const first = tokens[1] || null;
      const middle = tokens.length >= 3 ? tokens.slice(2).join(" ") : null;
      if (!first || !last) return null;
      return buildPersonFromOwnerMapping(first, last, middle);
    } else {
      // Assume FIRST [MIDDLE] LAST for mixed case names
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      const middle = tokens.length > 2 ? tokens.slice(1, -1).join(" ") : null;
      if (!first || !last) return null;
      return buildPersonFromOwnerMapping(first, last, middle);
    }
  }
  
  const normalizeOwner = (owner) => {
    if (owner.type === 'Company' || owner.type === 'company') {
      return `company:${(owner.name || '').toLowerCase().trim()}`;
    } else {
      const parsed = owner.type === 'Person' ? parsePersonOwnerMapping(owner.name) : owner;
      if (!parsed) return null;
      const firstName = (parsed.first_name || '').toLowerCase().trim();
      const lastName = (parsed.last_name || '').toLowerCase().trim();
      const middleName = (parsed.middle_name || '').toLowerCase().trim();
      return `person:${firstName}|${middleName}|${lastName}`;
    }
  };
  
  const currentOwnersSet = new Set();
  ownersByDateCurrent.forEach(owner => {
    const normalized = normalizeOwner(owner);
    if (normalized) currentOwnersSet.add(normalized);
  });
  
  const missingOwners = ownerInfo.filter(owner => {
    const normalized = normalizeOwner(owner);
    return normalized && !currentOwnersSet.has(normalized);
  });
  
  return { missingOwners, hasDifferences: missingOwners.length > 0 };
}

function createSalesHistoryMissingOwnersRelationship(missingOwners, baseIdentifier) {
  if (!missingOwners || missingOwners.length === 0) return;
  
  missingOwners.forEach((owner, index) => {
    const ownerFileName = `missingOwner_${index + 1}.json`;
    const relationshipFileName = `relationship_sales_history_missing_owner_${index + 1}.json`;
    
    // Create missing owner file
    const ownerData = {
      name: owner.name,
      type: owner.type,
      source_identifier: `${baseIdentifier}_missing_owner_${index + 1}`
    };
    
    writeJSON(path.join("data", ownerFileName), ownerData);
    
    // Create relationship file
    writeJSON(path.join("data", relationshipFileName), {
      from: { "/": "./salesHistory_1.json" },
      to: { "/": `./${ownerFileName}` }
    });
  });
}



function extractExtraFeatures($, parcelIdentifier, seed) {
  const rows = $("section.xf table tbody tr");
  if (!rows.length) return;

  const baseIdentifier = parcelIdentifier || seed?.parcel_id || "";
  const sourceRequest = {
    method: "GET",
    url: seed?.source_http_request?.url || ""
  };

  const structureData = {
    source_http_request: sourceRequest,
    request_identifier: `${baseIdentifier}_property_structure`
  };
  const utilityData = {
    source_http_request: sourceRequest,
    request_identifier: `${baseIdentifier}_property_utility`
  };

  let hasStructureData = false;
  let hasUtilityData = false;

  rows.each((_, tr) => {
    const firstCell = $(tr).find("td").first();
    if (!firstCell.length) return;

    let codeText = firstCell.text().trim();
    if (!codeText && firstCell.find("a").length) {
      codeText = firstCell.find("a").text().trim();
    }

    if (!codeText) return;
    const normalizedCode = codeText.trim().toUpperCase();
    const mapping = extraFeaturesCodeLookup[normalizedCode];
    if (!mapping) return;

    if (mapping.class === "Structure") {
      structureData[mapping.property] = mapping.value;
      hasStructureData = true;
    } else if (mapping.class === "Utility") {
      utilityData[mapping.property] = mapping.value;
      hasUtilityData = true;
    }
  });

  if (hasStructureData) {
    writeJSON(path.join("data", "propertyStructure.json"), structureData);
    writeJSON(
      path.join("data", "relationship_property_has_structure.json"),
      {
        from: { "/": "./property.json" },
        to: { "/": "./propertyStructure.json" },
      }
    );
  }

  if (hasUtilityData) {
    writeJSON(path.join("data", "propertyUtility.json"), utilityData);
    writeJSON(
      path.join("data", "relationship_property_has_utility.json"),
      {
        from: { "/": "./property.json" },
        to: { "/": "./propertyUtility.json" },
      }
    );
  }
}

function main() {
  // Clean output directory for idempotency
  try {
    fs.rmSync("data", { recursive: true, force: true });
  } catch (e) {}

  const inputHtmlPath = path.join("input.html");
  const unAddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutsPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(unAddrPath);
  const seed = readJSON(seedPath);

  // Optional data sets
  let ownersData = null;
  let utilitiesData = null;
  let layoutsData = null;
  try {
    ownersData = readJSON(ownersPath);
  } catch (e) {}
  try {
    utilitiesData = readJSON(utilitiesPath);
  } catch (e) {}
  try {
    layoutsData = readJSON(layoutsPath);
  } catch (e) {}

  // Identify parcel identifier from HTML

  const parcelHeader = $("section.title h1").first().text().trim();
  // console.log("parcelHeader>>>",parcelHeader)

  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);  // Capture everything after "Parcel"
  // console.log("m>>>", m);

  if (m) parcelIdentifier = m[1];

  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  
  // Clean parcelIdentifier by removing dashes
  // if (parcelIdentifier) {
  //   parcelIdentifier = parcelIdentifier.replace(/-/g, "");
  // }
  
  console.log("Final parcelIdentifier>>>", parcelIdentifier);



  // Property extraction
  const summaryRows = $("section.parcel-info table.grid.grid-1d tr");
  let useCodeText = null;
  let situsAddress = null;
  let subdivisionText = null;
  let sectionText = null,
    townshipText = null,
    rangeText = null;
  let acreageText = null;
  summaryRows.each((i, tr) => {
    const th = $(tr).find("th").text().trim();
    const td = $(tr).find("td").first().text().trim();
    if (/Situs Address/i.test(th)) situsAddress = td;
    if (/Use Code/i.test(th)) useCodeText = td;
    if (/Subdivision/i.test(th)) subdivisionText = td;
    if (/Section/i.test(th)) sectionText = td;
    if (/Township/i.test(th)) townshipText = td;
    if (/Range/i.test(th)) rangeText = td;
    if (/Acreage/i.test(th)) acreageText = td;
  });


  // console.log("usecode",useCodeText);
  const property_type = mapPropertyTypeFromUseCode(useCodeText || "");
  // console.log("property_type>>",property_type);
  const ownership_estate_type=mapOwnershipEstateTypeFromUseCode(useCodeText || "");
  const build_status= mapBuildStatusFromUseCode(useCodeText || "");
  const structure_form = mapStructureFormFromUseCode(useCodeText || "");
  const property_usage_type = mapPropertyUsageTypeFromUseCode(useCodeText || "");
  // console.log(ownership_estate_type, build_status, structure_form, property_usage_type);

  // Buildings: Sum all heated sq ft and get earliest year built
  let totalHeatedSqft = 0;
  let yearBuilt = null;
  let unitCount = 0;
  $("section.buildings .building-data table.grid2 tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const sqft = parseInt(tds.eq(0).text().replace(/[,]/g, "").trim() || "0", 10);
    const yb = tds.eq(1).text().trim();
    if (sqft > 0) {
      totalHeatedSqft += sqft;
      unitCount++;
    }
    if (/^\d{4}$/.test(yb)) {
      const year = parseInt(yb, 10);
      if (!yearBuilt || year < yearBuilt) yearBuilt = year;
    }
  });
  const heatedSqft = totalHeatedSqft > 0 ? totalHeatedSqft.toString() : null;
  
  // Count actual buildings in HTML
  const actualBuildingCount = $("section.buildings .building-data").length;
  const buildingsToCreate = Math.max(actualBuildingCount, 1); // At least 1

  // Legal Description
  let property_legal_description_text = null;
  let lotNumber = null;
  const legalSec = $("section.legal");
  if (legalSec.length) {
    const rawText = legalSec.text();
    const tx = rawText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    property_legal_description_text = tx
      .filter((l) => !/^Short Legal/i.test(l))
      .join(" ");
    // Parse lot number from any line like LOT 25
    for (const line of tx) {
      const mm = line.match(/\bLOT\s+(\w+)/i);
      if (mm) {
        lotNumber = mm[1];
        break;
      }
    }
  }

  const property = {
    source_http_request: {
      method: "GET",
      url: seed.source_http_request.url
    },
    request_identifier: parcelIdentifier || seed.parcel_id || "" ,
    parcel_identifier: parcelIdentifier || seed.parcel_id || "",
    property_type: property_type,
    // livable_floor_area: heatedSqft ? String(heatedSqft) : null,
    // area_under_air: heatedSqft ? String(heatedSqft) : null,
    // property_structure_built_year: yearBuilt || null,
    property_effective_built_year: null,
    // number_of_units_type: unitCount <= 1 ? "One" : unitCount === 2 ? "Two" : unitCount === 3 ? "Three" : unitCount === 4 ? "Four" : "TwoToFour",
    number_of_units: unitCount || 1,
    property_legal_description_text: property_legal_description_text || null,
    subdivision: subdivisionText || null,
    // total_area: null,
    zoning: null,
    historic_designation: false,
    ownership_estate_type: ownership_estate_type,
    build_status: build_status,
    structure_form:structure_form,
    property_usage_type:property_usage_type
  };
  writeJSON(path.join("data", "property.json"), property);
  // console.log("finalPropertyy>>>>>>>>",property);

  //Extra Features Extraction
  extractExtraFeatures($, parcelIdentifier, seed);

  // Address extraction
  const fullAddress = unAddr.full_address || "";
  const cityPart = (unAddr.full_address || "").split(",")[1]?.trim() || "";
  const cityUpper = cityPart.toUpperCase();
  const postalMatch = fullAddress.match(/(\d{5})(?:-(\d{4}))?$/);
  const postal_code = postalMatch ? postalMatch[1] : null;
  const plus_four_postal_code = postalMatch ? postalMatch[2] || null : null;

  // parse street components from situsAddress if available, else from full_address prefix
  const situs = situsAddress || (fullAddress.split(",")[0] || "").trim();
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    pre_dir = null,
    post_dir = null;
  if (situs) {
    const parts = situs.split(/\s+/);
    if (parts.length >= 2) {
      street_number = parts.shift();
      const last = parts.pop();
      street_suffix_type = last || null;
      street_name = parts.join(" ").toUpperCase() || null;
      const dirs = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
      const nameTokens = street_name ? street_name.split(" ") : [];
      if (nameTokens.length > 1 && dirs.includes(nameTokens[0])) {
        pre_dir = nameTokens.shift();
      }
      if (
        nameTokens.length > 1 &&
        dirs.includes(nameTokens[nameTokens.length - 1])
      ) {
        post_dir = nameTokens.pop();
      }
      street_name = nameTokens.join(" ");
      if (street_suffix_type) {
        const up = street_suffix_type.toUpperCase();
        const validSuffixes = {
          ALLEY: "Aly", ALY: "Aly",
          ANNEX: "Anx", ANX: "Anx",
          ARCADE: "Arc", ARC: "Arc",
          AVENUE: "Ave", AVE: "Ave",
          BAYOU: "Byu", BYU: "Byu",
          BEACH: "Bch", BCH: "Bch",
          BEND: "Bnd", BND: "Bnd",
          BLUFF: "Blf", BLF: "Blf",
          BLUFFS: "Blfs", BLFS: "Blfs",
          BOTTOM: "Btm", BTM: "Btm",
          BOULEVARD: "Blvd", BLVD: "Blvd",
          BRANCH: "Br", BR: "Br",
          BRIDGE: "Brg", BRG: "Brg",
          BROOK: "Brk", BRK: "Brk",
          BROOKS: "Brks", BRKS: "Brks",
          BURG: "Bg", BG: "Bg",
          BURGS: "Bgs", BGS: "Bgs",
          BYPASS: "Byp", BYP: "Byp",
          CAMP: "Cp", CP: "Cp",
          CANYON: "Cyn", CYN: "Cyn",
          CAPE: "Cpe", CPE: "Cpe",
          CAUSEWAY: "Cswy", CSWY: "Cswy",
          CENTER: "Ctr", CTR: "Ctr",
          CENTERS: "Ctrs", CTRS: "Ctrs",
          CIRCLE: "Cir", CIR: "Cir",
          CIRCLES: "Cirs", CIRS: "Cirs",
          CLIFF: "Clf", CLF: "Clf",
          CLIFFS: "Clfs", CLFS: "Clfs",
          CLUB: "Clb", CLB: "Clb",
          COMMON: "Cmn", CMN: "Cmn",
          COMMONS: "Cmns", CMNS: "Cmns",
          CORNER: "Cor", COR: "Cor",
          CORNERS: "Cors", CORS: "Cors",
          COURSE: "Crse", CRSE: "Crse",
          COURT: "Ct", CT: "Ct",
          COURTS: "Cts", CTS: "Cts",
          COVE: "Cv", CV: "Cv",
          COVES: "Cvs", CVS: "Cvs",
          CREEK: "Crk", CRK: "Crk",
          CRESCENT: "Cres", CRES: "Cres",
          CREST: "Crst", CRST: "Crst",
          CROSSING: "Xing", XING: "Xing",
          CROSSROAD: "Xrd", XRD: "Xrd",
          CROSSROADS: "Xrds", XRDS: "Xrds",
          CURVE: "Curv", CURV: "Curv",
          DALE: "Dl", DL: "Dl",
          DAM: "Dm", DM: "Dm",
          DIVIDE: "Dv", DV: "Dv",
          DRIVE: "Dr", DR: "Dr",
          DRIVES: "Drs", DRS: "Drs",
          ESTATE: "Est", EST: "Est",
          ESTATES: "Ests", ESTS: "Ests",
          EXPRESSWAY: "Expy", EXPY: "Expy",
          EXTENSION: "Ext", EXT: "Ext",
          EXTENSIONS: "Exts", EXTS: "Exts",
          FALL: "Fall", FALL: "Fall",
          FALLS: "Fls", FLS: "Fls",
          FERRY: "Fry", FRY: "Fry",
          FIELD: "Fld", FLD: "Fld",
          FIELDS: "Flds", FLDS: "Flds",
          FLAT: "Flt", FLT: "Flt",
          FLATS: "Flts", FLTS: "Flts",
          FORD: "Frd", FRD: "Frd",
          FORDS: "Frds", FRDS: "Frds",
          FOREST: "Frst", FRST: "Frst",
          FORGE: "Frg", FRG: "Frg",
          FORGES: "Frgs", FRGS: "Frgs",
          FORK: "Frk", FRK: "Frk",
          FORKS: "Frks", FRKS: "Frks",
          FORT: "Ft", FT: "Ft",
          FREEWAY: "Fwy", FWY: "Fwy",
          GARDEN: "Gdn", GDN: "Gdn",
          GARDENS: "Gdns", GDNS: "Gdns",
          GATEWAY: "Gtwy", GTWY: "Gtwy",
          GLEN: "Gln", GLN: "Gln",
          GLENS: "Glns", GLNS: "Glns",
          GREEN: "Grn", GRN: "Grn",
          GREENS: "Grns", GRNS: "Grns",
          GROVE: "Grv", GRV: "Grv",
          GROVES: "Grvs", GRVS: "Grvs",
          HARBOR: "Hbr", HBR: "Hbr",
          HARBORS: "Hbrs", HBRS: "Hbrs",
          HAVEN: "Hvn", HVN: "Hvn",
          HEIGHTS: "Hts", HTS: "Hts",
          HIGHWAY: "Hwy", HWY: "Hwy",
          HILL: "Hl", HL: "Hl",
          HILLS: "Hls", HLS: "Hls",
          HOLLOW: "Holw", HOLW: "Holw",
          INLET: "Inlt", INLT: "Inlt",
          ISLAND: "Is", IS: "Is",
          ISLANDS: "Iss", ISS: "Iss",
          ISLE: "Isle", ISLE: "Isle",
          JUNCTION: "Jct", JCT: "Jct",
          JUNCTIONS: "Jcts", JCTS: "Jcts",
          KEY: "Ky", KY: "Ky",
          KEYS: "Kys", KYS: "Kys",
          KNOLL: "Knl", KNL: "Knl",
          KNOLLS: "Knls", KNLS: "Knls",
          LAKE: "Lk", LK: "Lk",
          LAKES: "Lks", LKS: "Lks",
          LAND: "Land", LAND: "Land",
          LANDING: "Lndg", LNDG: "Lndg",
          LANE: "Ln", LN: "Ln",
          LIGHT: "Lgt", LGT: "Lgt",
          LIGHTS: "Lgts", LGTS: "Lgts",
          LOAF: "Lf", LF: "Lf",
          LOCK: "Lck", LCK: "Lck",
          LOCKS: "Lcks", LCKS: "Lcks",
          LODGE: "Ldg", LDG: "Ldg",
          LOOP: "Loop", LOOP: "Loop",
          MALL: "Mall", MALL: "Mall",
          MANOR: "Mnr", MNR: "Mnr",
          MANORS: "Mnrs", MNRS: "Mnrs",
          MEADOW: "Mdw", MDW: "Mdw",
          MEADOWS: "Mdws", MDWS: "Mdws",
          MEWS: "Mews", MEWS: "Mews",
          MILL: "Ml", ML: "Ml",
          MILLS: "Mls", MLS: "Mls",
          MISSION: "Msn", MSN: "Msn",
          MOTORWAY: "Mtwy", MTWY: "Mtwy",
          MOUNT: "Mt", MT: "Mt",
          MOUNTAIN: "Mtn", MTN: "Mtn",
          MOUNTAINS: "Mtns", MTNS: "Mtns",
          NECK: "Nck", NCK: "Nck",
          ORCHARD: "Orch", ORCH: "Orch",
          OVAL: "Oval", OVAL: "Oval",
          OVERPASS: "Opas", OPAS: "Opas",
          PARK: "Park", PARK: "Park",
          PARKWAY: "Pkwy", PKWY: "Pkwy",
          PASS: "Pass", PASS: "Pass",
          PASSAGE: "Psge", PSGE: "Psge",
          PATH: "Path", PATH: "Path",
          PIKE: "Pike", PIKE: "Pike",
          PINE: "Pne", PNE: "Pne",
          PINES: "Pnes", PNES: "Pnes",
          PLACE: "Pl", PL: "Pl",
          PLAIN: "Pln", PLN: "Pln",
          PLAINS: "Plns", PLNS: "Plns",
          PLAZA: "Plz", PLZ: "Plz",
          POINT: "Pt", PT: "Pt",
          POINTS: "Pts", PTS: "Pts",
          PORT: "Prt", PRT: "Prt",
          PORTS: "Prts", PRTS: "Prts",
          PRAIRIE: "Pr", PR: "Pr",
          RADIAL: "Radl", RADL: "Radl",
          RAMP: "Ramp", RAMP: "Ramp",
          RANCH: "Rnch", RNCH: "Rnch",
          RAPID: "Rpd", RPD: "Rpd",
          RAPIDS: "Rpds", RPDS: "Rpds",
          REST: "Rst", RST: "Rst",
          RIDGE: "Rdg", RDG: "Rdg",
          RIDGES: "Rdgs", RDGS: "Rdgs",
          RIVER: "Riv", RIV: "Riv",
          ROAD: "Rd", RD: "Rd",
          ROADS: "Rds", RDS: "Rds",
          ROUTE: "Rte", RTE: "Rte",
          ROW: "Row", ROW: "Row",
          RUE: "Rue", RUE: "Rue",
          RUN: "Run", RUN: "Run",
          SHOAL: "Shl", SHL: "Shl",
          SHOALS: "Shls", SHLS: "Shls",
          SHORE: "Shr", SHR: "Shr",
          SHORES: "Shrs", SHRS: "Shrs",
          SKYWAY: "Skwy", SKWY: "Skwy",
          SPRING: "Spg", SPG: "Spg",
          SPRINGS: "Spgs", SPGS: "Spgs",
          SPUR: "Spur", SPUR: "Spur",
          SQUARE: "Sq", SQ: "Sq",
          SQUARES: "Sqs", SQS: "Sqs",
          STATION: "Sta", STA: "Sta",
          STRAVENUE: "Stra", STRA: "Stra",
          STREAM: "Strm", STRM: "Strm",
          STREET: "St", ST: "St",
          STREETS: "Sts", STS: "Sts",
          SUMMIT: "Smt", SMT: "Smt",
          TERRACE: "Ter", TER: "Ter",
          THROUGHWAY: "Trwy", TRWY: "Trwy",
          TRACE: "Trce", TRCE: "Trce",
          TRACK: "Trak", TRAK: "Trak",
          TRAFFICWAY: "Trfy", TRFY: "Trfy",
          TRAIL: "Trl", TRL: "Trl",
          TRAILER: "Trlr", TRLR: "Trlr",
          TUNNEL: "Tunl", TUNL: "Tunl",
          TURNPIKE: "Tpke", TPKE: "Tpke",
          UNDERPASS: "Upas", UPAS: "Upas",
          UNION: "Un", UN: "Un",
          UNIONS: "Uns", UNS: "Uns",
          VALLEY: "Vly", VLY: "Vly",
          VALLEYS: "Vlys", VLYS: "Vlys",
          VIA: "Via", VIA: "Via",
          VIADUCT: "Vl", VL: "Vl",
          VIEW: "Vw", VW: "Vw",
          VIEWS: "Vws", VWS: "Vws",
          VILLAGE: "Vlg", VLG: "Vlg",
          VILLAGES: "Vlgs", VLGS: "Vlgs",
          VILLE: "Vl", VL: "Vl",
          VISTA: "Vis", VIS: "Vis",
          WALK: "Walk", WALK: "Walk",
          WALL: "Wall", WALL: "Wall",
          WAY: "Way", WAY: "Way",
          WAYS: "Ways", WAYS: "Ways",
          WELL: "Wl", WL: "Wl",
          WELLS: "Wls", WLS: "Wls"
        };
        street_suffix_type = validSuffixes[up] || null;
      }
    }
  }

  const address = {
    source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },    
    // street_number: street_number || null,
    // street_name: street_name || null,
    // street_suffix_type: street_suffix_type || null,
    // street_pre_directional_text: pre_dir || null,
    // street_post_directional_text: post_dir || null,
    // unit_identifier: null,
    // city_name: (cityUpper || "").toUpperCase() || null,
    // state_code: "FL",
    // postal_code: postal_code || null,
    // plus_four_postal_code: plus_four_postal_code || null,
    // country_code: "US",
    county_name: "Nassau",
    latitude: unAddr.latitude ?? null,
    longitude: unAddr.longitude ?? null,
    // route_number: null,
    township: townshipText || null,
    range: rangeText || null,
    section: sectionText || null,
    // block: null,
    // lot: lotNumber || null,
    // municipality_name: null,
    unnormalized_address: situsAddress
  };
  writeJSON(path.join("data", "address.json"), address);
  // console.log(address)
  
  // Extract mailing address and owner info from ownership section
  const ownershipHtml = $(".ownership").html();
  const mailingAddr = ownershipHtml ? extractMailingAddress(ownershipHtml) : null;
  const ownerInfo = extractOwnerInfo(ownershipHtml);
  // console.log("Ownerinfo",ownerInfo);

  // Initialize counters for person/company files
  let personCounter = 0;
  let companyCounter = 0;
  const initialPersonFiles = [];
  const initialCompanyFiles = [];
  
  // Create owner objects for each owner
  ownerInfo.forEach((owner, index) => {
    if (owner.type === 'Company') {
      const company = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },
        request_identifier: parcelIdentifier || seed.parcel_id || "",
        name: owner.name
      };
      companyCounter++;
      const companyFileName = `company_${companyCounter}.json`;
      writeJSON(path.join("data", companyFileName), company);
      initialCompanyFiles.push(companyFileName);
    } else {
      // Parse person name with prefix/suffix extraction
      const parsed = parsePerson(owner.name);
      const firstNameRaw = formatName(parsed.firstName);
      const lastNameRaw = formatName(parsed.lastName);
      let middleName = formatName(parsed.middleName);
      const firstName = validatePersonName(firstNameRaw, 'first_name');
      const lastName = validatePersonName(lastNameRaw, 'last_name');
      if (middleName != null) {
        middleName = validatePersonName(middleName, 'middle_name');
      }
      
      const person = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },
        request_identifier: parcelIdentifier || seed.parcel_id || "",
        birth_date: null,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        prefix_name: parsed.prefix ? validatePrefix(parsed.prefix) : null,
        suffix_name: parsed.suffix ? validateSuffix(parsed.suffix) : null,
        us_citizenship_status: null,
        veteran_status: null
      };
      personCounter++;
      const personFileName = `person_${personCounter}.json`;
      writeJSON(path.join("data", personFileName), person);
      initialPersonFiles.push(personFileName);
    }
  });
  
  const mailingAddress = {
    source_http_request: {
      method: "GET",
      url: seed.source_http_request.url
    },
    request_identifier: parcelIdentifier || seed.parcel_id || "",
    // county_name: null,
    unnormalized_address: mailingAddr,
    longitude: null,
    latitude: null
  };
  writeJSON(path.join("data", "mailing_address.json"), mailingAddress);
  
  // Track if relationships were created for initial owners
  let initialRelationshipsCreated = false;
  
  // Create relationships between owners and mailing address
  if (personCounter > 0 || companyCounter > 0) {
    initialRelationshipsCreated = true;
    
    for (let i = 1; i <= personCounter; i++) {
      const rel = {
        from: { "/": `./person_${i}.json` },
        to: { "/": `./mailing_address.json` },
      };
      writeJSON(
        path.join("data", `relationship_person_${i}_has_mailing_address.json`),
        rel,
      );
    }
    
    for (let i = 1; i <= companyCounter; i++) {
      const rel = {
        from: { "/": `./company_${i}.json` },
        to: { "/": `./mailing_address.json` },
      };
      writeJSON(
        path.join("data", `relationship_company_${i}_has_mailing_address.json`),
        rel,
      );
    }
  }
  
  // Lot: add lot_size_acre from Acreage
  let lotSizeAcre = null;
  if (acreageText != null) {
    const cleaned = String(acreageText).replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isNaN(n)) lotSizeAcre = n;
  }
  const lot = {
    source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },    
    request_identifier: parcelIdentifier || seed.parcel_id || "",
    lot_type: null,
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
    lot_size_acre: lotSizeAcre,
  };
  writeJSON(path.join("data", "lot.json"), lot);

  // Tax values from Values table
  const valuesTable = $("div.values table.grid-transposed");
  if (valuesTable.length) {
    const headerCells = valuesTable.find("thead th");
    const years = [];
    headerCells.each((i, th) => {
      const text = $(th).text().trim();
      const yearMatch = text.match(/(\d{4})/);
      if (yearMatch) years.push(parseInt(yearMatch[1]));
    });
    
    const rows = valuesTable.find("tbody > tr");
    const getVal = (idx) =>
      rows
        .eq(idx)
        .find("td")
        .map((i, td) => $(td).text().trim())
        .get();
    const land = getVal(0);
    const improved = getVal(1);
    const market = getVal(2);
    const assessed = getVal(6);
    const countyTaxable = getVal(10);
    
    years.forEach((year, index) => {
      if (land.length > index) {
        const taxObj = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },    
          request_identifier: parcelIdentifier || seed.parcel_id || "",
          tax_year: year,
          property_land_amount: parseCurrencyToNumber(land[index]),
          property_building_amount: parseCurrencyToNumber(improved[index]),
          property_market_value_amount: parseCurrencyToNumber(market[index]),
          property_assessed_value_amount: parseCurrencyToNumber(assessed[index]),
          property_taxable_value_amount: parseCurrencyToNumber(countyTaxable[index]),
          monthly_tax_amount: null,
          yearly_tax_amount: null,
          period_start_date: null,
          period_end_date: null,
        };
        writeJSON(path.join("data", `tax_${year}.json`), taxObj);
      }
    });
  }

  // Sales/Deeds/Files
  const salesRows = $("section.sale table.grid2 tbody tr");
  const deedTypeMap = {
    WD: "Warranty Deed",
    QC: "Quitclaim Deed",
    SW: "Special Warranty Deed",
    GD: "Grant Deed",
    BSD: "Bargain and Sale Deed",
    LBD: "Lady Bird Deed",
    TOD: "Transfer on Death Deed",
    SD: "Sheriff's Deed",
    TD: "Tax Deed",
    TRD: "Trustee's Deed",
    PRD: "Personal Representative Deed",
    CD: "Correction Deed",
    DILF: "Deed in Lieu of Foreclosure",
    LED: "Life Estate Deed",
    JTD: "Joint Tenancy Deed",
    TCD: "Tenancy in Common Deed",
    CPD: "Community Property Deed",
    GFD: "Gift Deed",
    ITD: "Interspousal Transfer Deed",
    WLD: "Wild Deed",
    SMD: "Special Master's Deed",
    COD: "Court Order Deed",
    CFD: "Contract for Deed",
    QTD: "Quiet Title Deed",
    AD: "Administrator's Deed",
    GUD: "Guardian's Deed",
    RD: "Receiver's Deed",
    ROW: "Right of Way Deed",
    VPD: "Vacation of Plat Deed",
    AOC: "Assignment of Contract",
    ROC: "Release of Contract",
    MISC: "Miscellaneous"
  };

  function mapDocumentType(deedType) {
    if (!deedType) return null;
    const typeMap = {
      "Quitclaim Deed": "ConveyanceDeedQuitClaimDeed",
      "Bargain and Sale Deed": "ConveyanceDeedBargainAndSaleDeed",
      "Warranty Deed": "ConveyanceDeedWarrantyDeed",
      "Special Warranty Deed": "ConveyanceDeedWarrantyDeed",
      "Grant Deed": "ConveyanceDeed",
      "Assignment of Contract": "Assignment",
      "Release of Contract": "Assignment",
      "Sheriff's Deed": "ConveyanceDeed",
      "Tax Deed": "ConveyanceDeed",
      "Trustee's Deed": "ConveyanceDeed",
      "Personal Representative Deed": "ConveyanceDeed",
      "Administrator's Deed": "ConveyanceDeed",
      "Guardian's Deed": "ConveyanceDeed",
      "Receiver's Deed": "ConveyanceDeed",
      "Court Order Deed": "ConveyanceDeed",
      "Special Master's Deed": "ConveyanceDeed",
      "Correction Deed": "ConveyanceDeed",
      "Transfer on Death Deed": "ConveyanceDeed",
      "Lady Bird Deed": "ConveyanceDeed",
      "Life Estate Deed": "ConveyanceDeed",
      "Joint Tenancy Deed": "ConveyanceDeed",
      "Tenancy in Common Deed": "ConveyanceDeed",
      "Community Property Deed": "ConveyanceDeed",
      "Gift Deed": "ConveyanceDeed",
      "Interspousal Transfer Deed": "ConveyanceDeed",
      "Wild Deed": "ConveyanceDeed",
      "Contract for Deed": "ConveyanceDeed",
      "Quiet Title Deed": "ConveyanceDeed",
      "Right of Way Deed": "ConveyanceDeed",
      "Vacation of Plat Deed": "ConveyanceDeed",
      "Deed in Lieu of Foreclosure": "ConveyanceDeed"
    };
    return typeMap[deedType] || "ConveyanceDeed";
  }

  let salesIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;
  const salesFileRefs = [];

  salesRows.each((i, tr) => {
    const tds = $(tr).find("td");
    const instCell = tds.eq(0);
    const instAbbr = instCell.find("abbr").first().text().trim();
    const deedUrl = instCell.find("a").attr("href") || null;
    const bookPage = instCell.find("a").text().trim();
    const dateStr = tds.eq(1).text().trim();
    const priceStr = tds.eq(4).text().trim();
    const deedType = deedTypeMap[instAbbr] || "Miscellaneous";

    const purchase_price_amount = parseCurrencyToNumber(priceStr);

    salesIndex += 1;
    deedIndex += 1;
    fileIndex += 1;

    const salesObj = {
      source_http_request: {
        method: "GET",
        url: seed.source_http_request.url
      },
      request_identifier: parcelIdentifier || seed.parcel_id || "",
      ownership_transfer_date: dateStr || null,
      purchase_price_amount,

    };
    const salesFileName = `sales_history_${salesIndex}.json`;
    writeJSON(path.join("data", salesFileName), salesObj);

    const deedObj = {
      source_http_request: {
        method: "GET",
        url: seed.source_http_request.url
      },
      request_identifier: parcelIdentifier || seed.parcel_id || "",
      deed_type: deedType };
    const deedFileName = `deed_${deedIndex}.json`;
    writeJSON(path.join("data", deedFileName), deedObj);

    const fileObj = {
      file_format: null,
      name: (instAbbr ? instAbbr + " " : "") + (bookPage || ""),
      original_url: deedUrl,
      ipfs_url: null,
      document_type: mapDocumentType(deedType),
      request_identifier: parcelIdentifier || seed.parcel_id || "",
      source_http_request: {
        method: "GET",
        url: seed.source_http_request.url
      }
    };
    const fileFileName = `file_${fileIndex}.json`;
    writeJSON(path.join("data", fileFileName), fileObj);

    const relDeedFile = {
      from: { "/": `./${deedFileName}` },
      to: { "/": `./${fileFileName}` },
    };
    writeJSON(
      path.join("data", `relationship_deed_${deedIndex}_has_file_${fileIndex}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      from: { "/": `./${salesFileName}` },
      to: { "/": `./${deedFileName}` },
    };
    writeJSON(
      path.join("data", `relationship_sales_history_${salesIndex}_has_deed_${deedIndex}.json`),
      relSalesDeed,
    );

    salesFileRefs.push({ date: dateStr, salesFileName, index: salesIndex });
  });

  // Owners from owners/owner_data.json: create both person and company as needed, and link by sale date
  if (ownersData && parcelIdentifier) {
    const propertyKey = `property_${parcelIdentifier}`;
    const ownersByDate = ownersData[propertyKey]?.owners_by_date || {};


    const personIndexByKey = new Map();
    const companyIndexByKey = new Map();



    function ensurePerson(owner) {
      const key = `${owner.first_name}|${owner.middle_name || ""}|${owner.last_name}`;
      if (!personIndexByKey.has(key)) {
        const firstNameRaw = formatName(owner.first_name);
        const lastNameRaw = formatName(owner.last_name);
        let middleName = formatName(owner.middle_name);
        const firstName = validatePersonName(firstNameRaw, 'first_name');
        const lastName = validatePersonName(lastNameRaw, 'last_name');
        if (middleName != null) {
          middleName = validatePersonName(middleName, 'middle_name');
        }
        const personObj = {
          source_http_request: {
            method: "GET",
            url: seed.source_http_request.url
          },
          request_identifier: parcelIdentifier || seed.parcel_id || "",
          birth_date: null,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
          prefix_name: owner.prefix_name ? validatePrefix(owner.prefix_name) : null,
          suffix_name: owner.suffix_name ? validateSuffix(owner.suffix_name) : null,
          us_citizenship_status: null,
          veteran_status: null
        };
        personCounter += 1;
        const fileName = `person_${personCounter}.json`;
        writeJSON(path.join("data", fileName), personObj);
        personIndexByKey.set(key, fileName);
      }
      return personIndexByKey.get(key);
    }

    function ensureCompany(owner) {
      const key = owner.name;
      if (!companyIndexByKey.has(key)) {
        const companyObj = {
            source_http_request: {
            method: "GET",
            url: seed.source_http_request.url
          },
          request_identifier: parcelIdentifier || seed.parcel_id || "",          
           name: owner.name
          };
        companyCounter += 1;
        const fileName = `company_${companyCounter}.json`;
        writeJSON(path.join("data", fileName), companyObj);
        companyIndexByKey.set(key, fileName);
      }
      return companyIndexByKey.get(key);
    }
    console.log(salesFileRefs)
    // Create relationships for each sale date using ensured owners
    salesFileRefs.forEach((sref) => {
      const ownersForDate = ownersByDate[sref.date] || [];
      console.log("ownersForDate", ownersForDate);
      ownersForDate.forEach((owner, j) => {
        if (owner.type === "person") {
          const personFile = ensurePerson(owner);
          const rel = {
            from: { "/": `./${sref.salesFileName}` },
            to: { "/": `./${personFile}` },
          };
          writeJSON(
            path.join(
              "data",
              `relationship_sales_history_${sref.index}_has_person_${j + 1}.json`,
            ),
            rel,
          );
        } else if (owner.type === "company") {
          const companyFile = ensureCompany(owner);
          const rel = {
            from: { "/": `./${sref.salesFileName}` },
            to: { "/": `./${companyFile}` },
          };
          writeJSON(
            path.join(
              "data",
              `relationship_sales_history_${sref.index}_has_company_${j + 1}.json`,
            ),
            rel,
          );
        }
      });
    });

    // Additionally link the first sale to the owner files created from the ownership section
    const firstSaleRef = salesFileRefs[0];
    if (firstSaleRef) {
      initialPersonFiles.forEach((personFile, idx) => {
        const rel = {
          from: { "/": `./${firstSaleRef.salesFileName}` },
          to: { "/": `./${personFile}` },
        };
        writeJSON(
          path.join(
            "data",
            `relationship_sales_history_${firstSaleRef.index}_has_initial_person_${idx + 1}.json`,
          ),
          rel,
        );
      });

      initialCompanyFiles.forEach((companyFile, idx) => {
        const rel = {
          from: { "/": `./${firstSaleRef.salesFileName}` },
          to: { "/": `./${companyFile}` },
        };
        writeJSON(
          path.join(
            "data",
            `relationship_sales_history_${firstSaleRef.index}_has_initial_company_${idx + 1}.json`,
          ),
          rel,
        );
      });
    }
    

    
    // Create person-mailing address relationships for current owners only if not already created
    if (!initialRelationshipsCreated) {
      const currentOwners = ownersByDate["current"] || [];

      currentOwners.forEach((owner, j) => {
        if (owner.type === "person") {
          const personFile = ensurePerson(owner);
          const rel = {
            from: { "/": `./${personFile}` },
            to: { "/": `./mailing_address.json` },
          };
          writeJSON(
            path.join("data", `relationship_person_${j + 1}_has_mailing_address.json`),
            rel,
          );
        } else if (owner.type === "company") {
          const companyFile = ensureCompany(owner);
          const rel = {
            from: { "/": `./${companyFile}` },
            to: { "/": `./mailing_address.json` },
          };
          writeJSON(
            path.join("data", `relationship_company_${j + 1}_has_mailing_address.json`),
            rel,
          );
        }
      });
    }
  }

  // Structure (best-effort mapping)
  const seRows = $("div.se table.grid2 tbody tr");
  let exteriorWall = null;
  let roofStructure = null;
  let roofCover = null;
  let interiorWall = null;
  let interiorFloorings = [];
  let frameDesc = null;
  let storiesDesc = null;
  let attachmentTypeDesc = null;
  let subfloorDesc = null;
  seRows.each((i, tr) => {
    const tds = $(tr).find("td");
    const desc = tds.eq(1).text().trim();
    const details = tds.eq(3).text().trim();
    if (/Exterior Wall/i.test(desc)) exteriorWall = details;
    if (/Roof Structure/i.test(desc)) roofStructure = details;
    if (/Roof Cover/i.test(desc)) roofCover = details;
    if (/Interior Wall/i.test(desc)) interiorWall = details;
    if (/Interior Flooring/i.test(desc)) interiorFloorings.push(details);
    if (/Frame/i.test(desc)) frameDesc = details;
    if (/Stories/i.test(desc)) storiesDesc = details;
    if (/Attachment/i.test(desc)) attachmentTypeDesc = details;
    if (/Subfloor|Foundation/i.test(desc)) subfloorDesc = details;
  });


  // const flooringPrimary = interiorFloorings.length
  //   ? mapFlooring(interiorFloorings[0])
  //   : null;
  // const flooringSecondary =
  //   interiorFloorings.length > 1 ? mapFlooringSecondary(interiorFloorings[1]) : null;

  // Create structures for each building
  let structuresData = null;
  try {
    structuresData = readJSON(path.join("owners", "structure_data.json"));
  } catch (e) {}
  
  if (structuresData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const structures = structuresData[key]?.structures || [];
    structures.forEach((struct, idx) => {
      const structureOut = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },
        request_identifier: struct.request_identifier || parcelIdentifier || seed.parcel_id || "",
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
        to: { "/": `./structure_${structureIndex}.json` }
      };
      writeJSON(
        path.join("data", `relationship_layout_${buildingNumber}_has_structure_${structureIndex}.json`),
        relationship
      );
    });
  }

  // Create utilities for each building
  if (utilitiesData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const utilities = utilitiesData[key]?.utilities || [];
    utilities.forEach((util, idx) => {
      const utilityOut = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },
        request_identifier: util.request_identifier || parcelIdentifier || seed.parcel_id || "",
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

  // Layouts from owners/layout_data.json or create basic layouts for each building
  if (layoutsData && parcelIdentifier) {
    const key = `property_${parcelIdentifier}`;
    const layouts = layoutsData[key]?.layouts || [];
    layouts.forEach((layout, idx) => {
      const out = {
        source_http_request: {
          method: "GET",
          url: seed.source_http_request.url
        },
        request_identifier: parcelIdentifier || seed.parcel_id || "",
        space_type: layout.space_type ?? null,
        built_year: layout.built_year ?? null,
        total_area_sq_ft: layout.total_area_sq_ft ?? null,
        livable_area_sq_ft: layout.livable_area_sq_ft ?? null,
        heated_area_sq_ft:   layout.heated_area_sq_ft ?? null,
        area_under_air_sq_ft: layout.area_under_air_sq_ft ?? null,
        space_type_index: String(layout.space_type_index || (idx + 1)),
        flooring_material_type: layout.flooring_material_type ?? null,
        size_square_feet: layout.size_square_feet ?? null,
        floor_level: layout.floor_level ?? null,
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
  
  // Check owner comparison
  // if (ownersData && parcelIdentifier) {
  //   const propertyKey = `property_${parcelIdentifier}`;
  //   const ownersByDate = ownersData[propertyKey]?.owners_by_date || {};
  //   const currentOwners = ownersByDate["current"] || [];
    
  //   const result = checkOwnerInfoVsCurrentOwners(ownerInfo, currentOwners);
  //   console.log("Owner comparison result:", result);

  // }
}

try {
  main();
  console.log("Script executed successfully");
} catch (e) {
  if (e && e.message) {
    console.error(e.message);
  } else {
    console.error(e);
  }
  process.exit(1);
}
