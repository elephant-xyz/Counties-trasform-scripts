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

const propertyTypeMapping = [
  {
    "property_usecode": "AG LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "BARN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "BEAUTY PARLOR/BARBER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "BOWLING/RECREATIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "CAMPGROUND/STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "CENTRALLY ASSESSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CHURCHES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "CLUBS/LODGES/HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "COMMERCIAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "COMMUNITY SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "CONDO BOAT DOCKS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CONDO-HOTEL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "CONDO-TIMESHARE",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "CONSERVATION PARCEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CONV STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "CONV STORE/GAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "COOPERATIVES",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND CLASS 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND CLASS 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND CLASS 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CULTRAL GROUPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "DEPARTMENT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "DRIVE-IN REST.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FINANCIAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "FIRE DEPT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "FLORIST/GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FOREST, PARKS, REC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FOREST,PRKS,REC-CNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FOREST,PRKS,REC-MUNI",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GOLF COURSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GYM/FITNESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "HEADER RECORD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "HEAVY MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOLDING POND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOTELS AND MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOTELS/MTL/SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "IMP AG/BARN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "IMP AG/COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "IMP AG/STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "IMPROVED AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LIGHT MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "LUMBER YARD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "MARSH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MFR HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MINERAL",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MINERAL PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "MORTUARY/CEMETERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTI STORY OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTI-FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NIGHTCLUB/BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "NO AG ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NON-PROFIT SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICE BUILDINGS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICE COMPLEX UNIT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "OFFICE/MULTI FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "ORNAMENTALS,MISC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PARKING LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NativePasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PastureWithTimber",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PECAN GROVES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PRIVATE HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESSIONAL BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "PRVT SCHL/DAY CARE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "PUBLIC SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "R/O/W DOT",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RACE TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "REGIONAL SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "REPAIR SERVICE/MH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "REPAIR SERVICE/SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "RES COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RESTAURANT/CAFE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "RIGHTS-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RIVERS AND LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RV PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SERVICE SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "SERVICE SHOP COMPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "SERVICE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFR BAY FT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFR BAYOU",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFR/GOV LEASE",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFR/TOWNHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/ACLF HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SFRES/OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/RENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/STORE/SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/WAREHOUSE/STRG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "SHOP COMPLEX UNIT TH",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Unit"
  },
  {
    "property_usecode": "SINGLE FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STATE TIITF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STORAGE/OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORE,MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORE/OFFICE/RESID",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORE/SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORES, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUPERMARKET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "THEATER/AUDITORIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBER 2 - NATURAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBER 2 - PLANTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBER 3 - NATURAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBER 3 - PLANTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBER 4 - NATURAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBER 4 - PLANTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 1-PLANTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 3",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 4",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND UNCLASS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TOURIST ATTRACTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "TRAILER PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TRANSIT TERMINALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "UTILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VAC INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VAC TWNHSE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT/COMM/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT/INST/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT/RESD/XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VEH SALE/REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "VEH SALE/REPAIR &amp; MH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE BOAT CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "WAREHOUSE COMPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE/STOR/SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE-STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "WASTELAND/DUMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "WATER MNGT/STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "YACHT CLUB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "ZOO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  }
]

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_divSummary > table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl10_ctl01_grdSales_grdFlat tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl03_ctl01_grdValuation";
// const HISTORICAL_VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl13_ctl01_grdLand_grdFlat";
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
    let th = textOf($(tr).find("th"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("description")) {
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
    let th = textOf($(tr).find("th"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("property use code")) {
      code = textOf($(tr).find("td span"));
    }
  });
  return code || null;
}

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }

  const normalizedUseCode = entry.property_usecode;

  if (!normalizedUseCode) {
    return lookup;
    }

  lookup[normalizedUseCode] = entry;
  return lookup;
}, {});

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;

  const normalizedInput = String(code);
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
  // const yearsEffective = [];
   buildings.forEach((b) => {
    yearsActual.push(toInt(b["Year Built"]));
    // yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    // effective: yearsEffective.length ? Math.min(...yearsEffective) : null,
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
   buildings.forEach((b) => {
    total += toInt(b["Actual Area"]);
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
    const instrumentNumber = textOf($(tds[3]));
    const bookPageRaw = textOf($(tds[4]));
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
    const link = $(tds[4]).find("a").last().attr("href") || null;
    const grantor = textOf($(tds[8]));
    const grantee = textOf($(tds[9]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      instrumentNumber,
      bookPage,
      link,
      grantor,
      grantee,
      book,
      page
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "TAX DEED") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return "Miscellaneous";
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  const headerThs = table.find("thead tr th").toArray();
  headerThs.forEach((th, idx) => {
    const txt = $(th).text().trim();
    const m = txt.match(/(\d{4})/);
    if (m && m.length > 1) {
      let y = parseInt(m[1], 10);
      if (!isNaN(y)) {
        years.push({ year: y, idx });
      }
    }
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
      exemption: get("Exempt Value"),
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
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  writeJSON(path.join("data", "property.json"), property);
}

function writeSalesDeedsFilesAndRelationships($) {
  const sales = extractSales($);
  // Remove old deed/file and sales_deed relationships if present to avoid duplicates
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^relationship_(deed_file|sales_deed)(?:_\d+)?\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleObj = {
      ownership_transfer_date: parseDateToISO(s.saleDate),
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
    };
    writeJSON(path.join("data", `sales_${idx}.json`), saleObj);

    const deedType = mapInstrumentToDeedType(s.instrument);
    let deed = { deed_type: deedType };
    if (s.book) {
      deed.book = s.book.split("\n")[0];
    }
    if (s.page) {
      deed.page = s.page.split("\n")[0];
    }
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    let fileName = deed.book && deed.page ? `${deed.book}/${deed.page}` : null;
    const file = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: fileName ? `Deed ${fileName}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", `file_${idx}.json`), file);

    const relDeedFile = {
      from: { "/": `./deed_${idx}.json` },
      to: { "/": `./file_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${idx}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      from: { "/": `./sales_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_sales_deed_${idx}.json`),
      relSalesDeed,
    );
  });
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
  const tn = (name || "").trim().toUpperCase();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
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

function writePersonCompaniesSalesRelationships(parcelId, sales, hasOwnerMailingAddress) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
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
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim().toUpperCase());
    });
  });
  companies = Array.from(companyNames).map((n) => ({ 
    name: n,
    request_identifier: parcelId,
  }));
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = parseDateToISO(rec.saleDate);
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
              "data",
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
  if (hasOwnerMailingAddress) {
    const currentOwner = ownersByDate["current"] || [];
    relPersonCounter = 0;
    relCompanyCounter = 0;
    currentOwner
    .filter((o) => o.type === "person")
    .forEach((o) => {
      const pIdx = findPersonIndexByName(o.first_name, o.last_name);
      if (pIdx) {
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
      if (cIdx) {
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
}

function extractHistoricalValuation($) {
  const table = $(HISTORICAL_VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  // const years = [];
  // const headerThs = table.find("tbody tr th").toArray();
  // headerThs.forEach((th, idx) => {
  //   const txt = $(th).text().trim();
  //   const m = txt.match(/(\d{4})/);
  //   if (m && m.length > 1) {
  //     let y = parseInt(m[1], 10);
  //     if (!isNaN(y)) {
  //       years.push({ year: y, idx });
  //     }
  //   }
  // });
  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    const label = textOf($tr.find("th"));
    const tds = $tr.find("td");
    const vals = [];
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    if (label) dataMap[label] = vals;
  });
  let mapped_values = [];
  for (const [key, values] of Object.entries(dataMap)) {
    mapped_values.push({
        year: parseInt(key, 10),
        building: values[0],
        land: values[2],
        market: values[5],
        assessed: values[6],
        exemption: values[7],
        taxable: values[8],
    });
  }
  return mapped_values;
  // return years.map(({ year, idx }) => {
  //   const get = (label) => {
  //     const arr = dataMap[label] || [];
  //     return arr[idx] || null;
  //   };
  //   return {
  //     year,
  //     building: get("Building Value"),
  //     land: get("Total Land Value"),
  //     market: get("Just Market"),
  //     assessed: get("Assessed Value"),
  //     taxable: get("Taxable Value"),
  //   };
  // });
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
      property_exemption_amount: parseCurrencyToNumber(v.exemption),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
  });
  // if (HISTORICAL_VALUATION_TABLE_SELECTOR) {
  //   const historicalVals = extractHistoricalValuation($);
  //   historicalVals.forEach((v) => {
  //   const taxObj = {
  //       tax_year: v.year || null,
  //       property_assessed_value_amount: parseCurrencyToNumber(v.assessed),
  //       property_market_value_amount: parseCurrencyToNumber(v.market),
  //       property_building_amount: parseCurrencyToNumber(v.building),
  //       property_land_amount: parseCurrencyToNumber(v.land),
  //       property_taxable_value_amount: parseCurrencyToNumber(v.taxable),
  //       property_exemption_amount: parseCurrencyToNumber(v.exemption),
  //       monthly_tax_amount: null,
  //       period_end_date: null,
  //       period_start_date: null,
  //     };
  //     writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
  //   });
  // }
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("sec-twp-rng")) {
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
    let th = textOf($(tr).find("th"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
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

  // const full =
  //   unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  // let desc = null;
  
  // if (!full) return;
  // let city = null;
  // let zip = null;
  // const fullAddressParts = (full || "").split(",");
  // if (fullAddressParts.length >= 3 && fullAddressParts[2]) {
  //   state_and_pin = fullAddressParts[2].split(/\s+/);
  //   if (state_and_pin.length >= 1 && state_and_pin[state_and_pin.length - 1] && state_and_pin[state_and_pin.length - 1].trim().match(/^\d{5}$/)) {
  //     zip = state_and_pin[state_and_pin.length - 1].trim();
  //     city = fullAddressParts[1].trim();
  //   }
  // }
  // const parts = (fullAddressParts[0] || "").split(/\s+/);
  // let street_number = null;
  // if (parts && parts.length > 1) {
  //   street_number_candidate = parts[0];
  //   if ((street_number_candidate || "") && isNumeric(street_number_candidate)) {
  //     street_number = parts.shift() || null;
  //   }
  // }
  // let suffix = null;
  // if (parts && parts.length > 1) {
  //   suffix_candidate = parts[parts.length - 1];
  //   if (normalizeSuffix(suffix_candidate)) {
  //     suffix = parts.pop() || null;
  //   }
  // }
  // let street_name = parts.join(" ") || null;
  // if (street_name) {
  //   street_name = street_name.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/g, "");
  // }
  // // const m = full.match(
  // //   /^(\d+)\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i,
  // // );
  // // if (!m) return;
  // // const [, streetNumber, streetRest, city, state, zip, plus4] = m;

  // // let street_name = streetRest.trim();
  // // let route_number = null;
  // // let street_suffix_type = null;
  // // const m2 = streetRest.trim().match(/^([A-Za-z]+)\s+(\d+)$/);
  // // if (m2) {
  // //   street_name = m2[1].toUpperCase();
  // //   route_number = m2[2];
  // //   if (street_name === "HWY" || street_name === "HIGHWAY")
  // //     street_suffix_type = "Hwy";
  // // }
  // const city_name = city ? city.toUpperCase() : null;
  // // const state_code = state.toUpperCase();
  // const postal_code = zip;
  // // const plus_four_postal_code = plus4 || null;

  // // Per evaluator expectation, set county_name from input jurisdiction
  // const inputCounty = (unnorm.county_jurisdiction || "").trim();
  // const county_name = inputCounty || null;

  // const address = {
  //   city_name,
  //   country_code: "US",
  //   county_name,
  //   latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
  //   longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
  //   plus_four_postal_code: null,
  //   postal_code,
  //   state_code: "FL",
  //   street_name: street_name,
  //   street_post_directional_text: null,
  //   street_pre_directional_text: null,
  //   street_number: street_number,
  //   street_suffix_type: normalizeSuffix(suffix),
  //   unit_identifier: null,
  //   route_number: null,
  //   township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
  //   range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
  //   section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
  //   block: null,
  //   lot: null,
  //   municipality_name: null,
  // };
  // writeJSON(path.join("data", "address.json"), address);
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
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;
  const layoutData = readJSON(path.join("owners", "layout_data.json"));
  const utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  const structureData = readJSON(path.join("owners", "structure_data.json"));
  const key = `property_${parcelId}`;
  const seedCsvPath = path.join(".", "input.csv");
  
  const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
  createGeometryClass(createGeometryInstances(seedCsv));
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  let util = null;
  if (utilitiesData) {
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }

  writeProperty($, parcelId);
  writeJSON(path.join("data", "parcel.json"), {parcel_identifier: parcelId || ""});
  const sales = extractSales($);
  writeSalesDeedsFilesAndRelationships($);

  writeTaxes($);

  const secTwpRng = extractSecTwpRng($);
  const addressText = extractAddressText($);
  const mailingAddress = extractOwnerMailingAddress($);
  const hasOwnerMailingAddress = attemptWriteAddress(unnormalized, secTwpRng, addressText, mailingAddress);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(parcelId, sales, hasOwnerMailingAddress);
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
