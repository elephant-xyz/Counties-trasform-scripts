// Data extraction script per evaluator instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - Sales/Tax/Deed from input.html
// - Writes outputs to ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping=[
  {
    "property_usecode": "VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
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
    "property_usecode": "MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "MULTI-FAM ",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
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
    "property_usecode": "RES COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
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
    "property_usecode": "STORES/1 STORY",
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
    "property_usecode": "MXD RES/OFF/STO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "DEPARTMNT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
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
    "property_usecode": "REGIONAL SHOPPING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
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
    "property_usecode": "OFFICE BLD 1STY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFCE BLD M/STY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESS OFF/BLD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "TRANSIT TERMINL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
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
    "property_usecode": "DRIVE-IN REST.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
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
    "property_usecode": "INSURANCE COMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "REPAIR SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "BEAUTY PARLOR",
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
    "property_usecode": "VEH SALE/REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "RV/MH PK ,PK/LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "WHOLESALE OUTLET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "FLORIST/GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "DRIVE-IN/OPEN STAD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
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
    "property_usecode": "NIGHTCLUB/BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "BOWL,RINKS,POOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
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
    "property_usecode": "CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "RACE TRACKS,ALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
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
    "property_usecode": "HOTELS/MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
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
    "property_usecode": "LIGHT MANUFACTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "HEAVY INDUSTRL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
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
    "property_usecode": "PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "CANNERIES/BOTTLERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "OTHER FOOD PROCESS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
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
    "property_usecode": "WAREHOSE/DISTRB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
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
    "property_usecode": "CROPLAND ",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND CLS1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "IMP PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "S/IMP PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NAT PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NativePasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LOW PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Rangeland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURE CLS6",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Rangeland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "GROVES,ORCHRD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "POULT,BEES,FISH, ETC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "DAIRIES,FEEDLOTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MISC AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VAC INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
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
    "property_usecode": "PRVT SCHL/DAY CARE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
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
    "property_usecode": "HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "NON-PROFIT / ORPHANA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "MORTUARY/CEMETARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
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
    "property_usecode": "REST HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "CULTERAL GROUPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "FOREST, PARKS, REC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
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
    "property_usecode": "COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
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
    "property_usecode": "COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "COUNTY RV PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "WATER MG DIST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "SPECIAL TAXING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "O U A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIITF SFWMD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "LEASEHOLD INTEREST",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "UTILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "MINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUBSURFACE RGHT",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RIGHTS-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
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
    "property_usecode": "WASTELAND/DUMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "REC AND PARK LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CENTRALLY ASSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "NON AG ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  }
]


// EXTRA FEATURES MAPPINGS and file creation
const extraFeaturesCodeListMapping = [
  {
    "code": "ADA N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADA W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADI N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADR N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADY N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ADY N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFA W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFI W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFI W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFO N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFO W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFS W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFY W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "AFY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ASPH 1",
    "class": "Lot",
    "property": "paving_type",
    "value": "Asphalt"
  },
  {
    "code": "ASPH 2",
    "class": "Lot",
    "property": "paving_type",
    "value": "Asphalt"
  },
  {
    "code": "ASPH 4",
    "class": "Lot",
    "property": "paving_type",
    "value": "Asphalt"
  },
  {
    "code": "ASPH 8",
    "class": "Lot",
    "property": "paving_type",
    "value": "Asphalt"
  },
  {
    "code": "B21-1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B22",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B23",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B23-1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B25-1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B27",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B28",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B28-1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B31",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B41 W",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "B41-1M",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "B41-1W",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "B42-1C",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "B43-1M",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "BANK A",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BANK B",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BANK D",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BANK E",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BANK Q",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BDY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFA W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFC N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFC N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFC W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFR N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFR W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFS W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BFY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "BOAT A",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BOAT B",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BOAT D",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BOAT H",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BOAT L",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "BOAT N",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "CANPY1",
    "class": "Structure",
    "property": "roof_covering_material",
    "value": "Metal Corrugated"
  },
  {
    "code": "CANPY3",
    "class": "Structure",
    "property": "roof_covering_material",
    "value": "Metal Corrugated"
  },
  {
    "code": "CDR W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFC N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFR N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CFY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Concrete Block"
  },
  {
    "code": "CONC 1",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC 2",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC B",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC E",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC F",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC G",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC H",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC N",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC P",
    "class": "Lot",
    "property": "paving_type",
    "value": "Pavers"
  },
  {
    "code": "CONC Q",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC U",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "CONC X",
    "class": "Lot",
    "property": "paving_type",
    "value": "Concrete"
  },
  {
    "code": "COOLER",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "DECK 1",
    "class": "Lot",
    "property": "paving_type",
    "value": "Composite"
  },
  {
    "code": "DECK 2",
    "class": "Lot",
    "property": "paving_type",
    "value": "Composite"
  },
  {
    "code": "DOCK 1",
    "class": "Lot",
    "property": "paving_type",
    "value": "Composite"
  },
  {
    "code": "DOCK 3",
    "class": "Lot",
    "property": "paving_type",
    "value": "Composite"
  },
  {
    "code": "DOCK 5",
    "class": "Lot",
    "property": "paving_type",
    "value": "Composite"
  },
  {
    "code": "EFA N3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "EFS W4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "ELEV",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "ENCLR1",
    "class": "Structure",
    "property": "roof_design_type",
    "value": "Flat"
  },
  {
    "code": "ENCLR5",
    "class": "Structure",
    "property": "roof_design_type",
    "value": "Dome"
  },
  {
    "code": "FENC 3",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC 4",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC 5",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC 6",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC 7",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC A",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC B",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC F",
    "class": "Lot",
    "property": "fencing_type",
    "value": "ChainLink"
  },
  {
    "code": "FENC I",
    "class": "Lot",
    "property": "fencing_type",
    "value": null
  },
  {
    "code": "FENC J",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Vinyl"
  },
  {
    "code": "FENC K",
    "class": "Lot",
    "property": "fencing_type",
    "value": "WroughtIron"
  },
  {
    "code": "FENC L",
    "class": "Lot",
    "property": "fencing_type",
    "value": "WroughtIron"
  },
  {
    "code": "FENC O",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Picket"
  },
  {
    "code": "FENC P",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Wood"
  },
  {
    "code": "FENC R",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Wood"
  },
  {
    "code": "FENC V",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Wood"
  },
  {
    "code": "FENC X",
    "class": "Lot",
    "property": "fencing_type",
    "value": "SplitRail"
  },
  {
    "code": "FENC Y",
    "class": "Lot",
    "property": "fencing_type",
    "value": "SplitRail"
  },
  {
    "code": "FENC Z",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Board"
  },
  {
    "code": "FENC12",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Aluminum"
  },
  {
    "code": "FENC14",
    "class": "Lot",
    "property": "fencing_type",
    "value": "Vinyl"
  },
  {
    "code": "FIRE 1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE 3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE 5",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE 8",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE 9",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE D",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FIRE M",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "FISH",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB5",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GAZEB6",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GREEN2",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GREEN3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "GREEN4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "HK/UP2",
    "class": "Utility",
    "property": "electrical_panel_capacity",
    "value": "150 Amp"
  },
  {
    "code": "HK/UP3",
    "class": "Utility",
    "property": "plumbing_fixture_type_primary",
    "value": "WashingMachine"
  },
  {
    "code": "HK/UP4",
    "class": "Utility",
    "property": "plumbing_fixture_type_primary",
    "value": "Other"
  },
  {
    "code": "HK/UP8",
    "class": "Utility",
    "property": "electrical_panel_capacity",
    "value": "3 Phase 110"
  },
  {
    "code": "JACUZI",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "LCI1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCM1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCM2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCM4",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCM5",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCM6",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LCQ2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LNI1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LNM1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LNM2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LNQ1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LNQ2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LPI1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LPM1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LPQ2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LSI1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LSI2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LSM1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LSM4",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LSQ1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWI1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWI2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWI5",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWM1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWM2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWQ1",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "LWQ2",
    "class": "Lot",
    "property": "site_lighting_type",
    "value": "SecurityLight"
  },
  {
    "code": "MFA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFI W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFI W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFR N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFS W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "MFY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "ODA",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "ODI",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "ODR",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "ODY",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "OFA",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "OFI",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "OFR",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "OFS",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "OFY",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "PFA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "PFI W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "PFI W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "PFY W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "PLUMB1",
    "class": "Utility",
    "property": "plumbing_fixture_count",
    "value": 1
  },
  {
    "code": "PLUMB2",
    "class": "Utility",
    "property": "plumbing_fixture_count",
    "value": 2
  },
  {
    "code": "POOL1",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL2",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL5",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL6",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL7",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "POOL8",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "RR",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "RRST",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "S-65E",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SDA N3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SDA N4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SEA 1A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "SEA 3A",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "SEA 4A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Poured Concrete"
  },
  {
    "code": "SEA 5A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Treated Wood Posts"
  },
  {
    "code": "SEA 6A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Treated Wood Posts"
  },
  {
    "code": "SEA 7A",
    "class": "Structure",
    "property": null,
    "value": null
  },
  {
    "code": "SFA N2",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFA N3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFA N4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFA W3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFA W4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFI W3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFO W4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFR N4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFR W4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFY N3",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SFY W4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "SOLAR",
    "class": "Utility",
    "property": "solar_panel_present",
    "value": true
  },
  {
    "code": "SPRINK",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKD4",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKD7",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKD8",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKDA",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKDB",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TANKDC",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TIKI",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "TPP 02",
    "class": null,
    "property": null,
    "value": null
  },
  {
    "code": "UTIL E",
    "class": "Utility",
    "property": "water_source_type",
    "value": "Well"
  },
  {
    "code": "UTIL G",
    "class": "Utility",
    "property": "sewer_type",
    "value": "Public"
  },
  {
    "code": "UTIL J",
    "class": "Utility",
    "property": "public_utility_type",
    "value": "WaterAvailable"
  },
  {
    "code": "UTIL K",
    "class": "Utility",
    "property": "sewer_type",
    "value": "Public"
  },
  {
    "code": "UTIL M",
    "class": "Utility",
    "property": "public_utility_type",
    "value": "WaterAvailable"
  },
  {
    "code": "UTIL Q",
    "class": "Utility",
    "property": "water_source_type",
    "value": "Public"
  },
  {
    "code": "WAL1 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL1 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL1 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 1",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 2",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 3",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL2 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL3 1",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL3 2",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL3 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL3 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL3 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL4 2",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL4 3",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL4 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL4 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL4 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL5 2",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL5 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL5 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL5 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL6 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL6 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL6 C",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Concrete Block"
  },
  {
    "code": "WAL7 A",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Precast Concrete"
  },
  {
    "code": "WAL7 B",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Precast Concrete"
  },
  {
    "code": "WAL7 D",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Precast Concrete"
  },
  {
    "code": "WAL7 E",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Precast Concrete"
  },
  {
    "code": "WAL7 F",
    "class": "Structure",
    "property": "foundation_material",
    "value": "Precast Concrete"
  },
  {
    "code": "WALL 1",
    "class": "Structure",
    "property": "exterior_wall_material_primary",
    "value": "Concrete Block"
  },
  {
    "code": "WALL 2",
    "class": "Structure",
    "property": "exterior_wall_material_primary",
    "value": "Concrete Block"
  },
  {
    "code": "WALL 3",
    "class": "Structure",
    "property": "exterior_wall_material_primary",
    "value": "Brick"
  },
  {
    "code": "WALL 4",
    "class": "Structure",
    "property": "exterior_wall_material_primary",
    "value": "Brick"
  },
  {
    "code": "WALL 5",
    "class": "Structure",
    "property": "exterior_wall_material_primary",
    "value": "Poured Concrete"
  },
  {
    "code": "WDA N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDA W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WDR N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDR N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDR N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDR W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WDY W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFA N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFA N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFA N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFA W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFA W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFA W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Steel Frame"
  },
  {
    "code": "WFD W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFI N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFI N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFI W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFO N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFO W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFR W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFS N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFS N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFS W4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFY N2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFY N3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFY N4",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFY W2",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  },
  {
    "code": "WFY W3",
    "class": "Structure",
    "property": "primary_framing_material",
    "value": "Wood Frame"
  }
]

const extraFeaturesCodeLookup = extraFeaturesCodeListMapping.reduce((lookup, entry) => {
  if (!entry || !entry.code) return lookup;
  lookup[entry.code.trim().toUpperCase()] = entry;
  return lookup;
}, {});



function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function raiseEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
}

function formatNameToPattern(name) {
  if (!name) return null;
  // Remove any remaining parentheses, brackets, or invalid characters
  let cleaned = name.trim().replace(/[\(\)\[\]\{\}]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  // Remove estate/trust designations
  cleaned = cleaned.replace(/\b(ESTATE|TRUST|TRUSTEE|DECEASED|DEC'D|DEC|ET AL|ETAL)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  // Format to proper case
  const formatted = cleaned.split(' ').map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
  // Validate against the required pattern
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (!namePattern.test(formatted)) {
    return null;
  }
  return formatted;
}

// function mapPrefixName(name) {
//   const prefixes = {
//     'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
//     'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
//     'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
//     'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
//     'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
//   };
//   return prefixes[name?.toUpperCase()] || null;
// }

// function mapSuffixName(name) {
//   const suffixes = {
//     'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
//     'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
//     'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
//     'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
//   };
//   return suffixes[name?.toUpperCase()] || null;
// }

// function mapPropertyType(useCode) {
//   if (!useCode) return null;
//   const code = useCode.toUpperCase();
//   if (/VACANT|0000/.test(code)) return "VacantLand";
//   if (/SINGLE|SFR|0100/.test(code)) return "SingleFamily";
//   if (/DUPLEX|0200/.test(code)) return "Duplex";
//   if (/2\s*UNIT|TWO.UNIT/.test(code)) return "2Units";
//   if (/3\s*UNIT|THREE.UNIT|TRIPLEX/.test(code)) return "3Units";
//   if (/4\s*UNIT|FOUR.UNIT|FOURPLEX/.test(code)) return "4Units";
//   if (/MULTI.FAM\s*10\+|MULTI.FAMILY\s*10\+|0300/.test(code)) return "MultiFamilyMoreThan10";
//   if (/MULTI.FAM|MULTI.FAMILY|MULTIPLE.FAMILY/.test(code) && !/10\+/.test(code)) return "MultiFamilyLessThan10";
//   if (/CONDO|CONDOMINIUM|0500/.test(code)) return "Condominium";
//   if (/DETACHED.CONDO/.test(code)) return "DetachedCondominium";
//   if (/NON.WARRANTABLE.CONDO/.test(code)) return "NonWarrantableCondo";
//   if (/TOWNHOUSE|TOWN.HOUSE|0600/.test(code)) return "Townhouse";
//   if (/MOBILE|0700/.test(code)) return "MobileHome";
//   if (/MANUFACTURED.HOUSING.SINGLE/.test(code)) return "ManufacturedHousingSingleWide";
//   if (/MANUFACTURED.HOUSING.MULTI/.test(code)) return "ManufacturedHousingMultiWide";
//   if (/MANUFACTURED.HOUSING|MANUFACTURED/.test(code)) return "ManufacturedHousing";
//   if (/APARTMENT|0800/.test(code)) return "Apartment";
//   if (/COOPERATIVE|COOP|0900/.test(code)) return "Cooperative";
//   if (/MODULAR|1000/.test(code)) return "Modular";
//   if (/PUD|1100/.test(code)) return "Pud";
//   if (/TIMESHARE|1200/.test(code)) return "Timeshare";
//   if (/RETIREMENT|1300/.test(code)) return "Retirement";
//   if (/RESIDENTIAL.COMMON/.test(code)) return "ResidentialCommonElementsAreas";
//   raiseEnumError(useCode, "property.property_type");
//   return null;
// }

function extractExtraFeatures($, parcelIdentifier, seed, appendSourceInfo) {
  const rows = $("#parcelDetails_XFOBTable table.parcelDetails_insideTable tr[bgcolor='#FFFFFF']");
  if (!rows.length) return;

  const structureData = {
    ...appendSourceInfo(seed),
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null
  };
  const utilityData = {
    ...appendSourceInfo(seed),
    cooling_system_type: null,
    heating_system_type: null,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: null,
    electrical_wiring_type_other_description: null,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null
  };
  const lotData = {
    ...appendSourceInfo(seed),
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
    lot_condition_issues: null
  };

  let hasStructureData = false;
  let hasUtilityData = false;
  let hasLotData = false;

  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 7) return;

    let codeText = $(tds[0]).text().trim();
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
    } else if (mapping.class === "Lot") {
      lotData[mapping.property] = mapping.value;
      hasLotData = true;
    }
  });

  if (hasStructureData) {
    writeJson(path.join("data", "structure.json"), structureData);
    writeJson(
      path.join("data", "relationship_property_has_structure.json"),
      {
        from: { "/": "./property.json" },
        to: { "/": "./structure.json" },
      }
    );
    console.log("Created structure.json and relationship_property_has_structure.json");
  }

  if (hasUtilityData) {
    writeJson(path.join("data", "utility.json"), utilityData);
    writeJson(
      path.join("data", "relationship_property_has_utility.json"),
      {
        from: { "/": "./property.json" },
        to: { "/": "./utility.json" },
      }
    );
    console.log("Created utility.json and relationship_property_has_utility.json");
  }

  if (hasLotData) {
    writeJson(path.join("data", "lot.json"), lotData);
    // writeJson(
    //   path.join("data", "relationship_property_has_lot.json"),
    //   {
    //     from: { "/": "./property.json" },
    //     to: { "/": "./lot.json" },
    //   }
    // );
    console.log("Created lot.json and relationship_property_has_lot.json");
  }
  //Lot modifications
  // 7) LOT
  try {
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable tr",
    ).eq(1);
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 3) {
      const unitsTxt = tds.eq(2).text().trim();
      console.log(`Land units text: "${unitsTxt}"`);
      // Look for acres in format "6.451 AC"
      const mAc = unitsTxt.match(/([0-9,.]+)\s*AC/i);
      if (mAc) {
        lotSizeAcre = parseFloat(mAc[1].replace(/[,]/g, ""));
        // Convert acres to square feet (1 acre = 43,560 sq ft)
        lotAreaSqft = Math.round(lotSizeAcre * 43560);
      }
    }
    let lot_type = null;
    if (typeof lotSizeAcre === "number")
      lot_type =
        lotSizeAcre > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
    
    // Read existing lot data if it exists
    let existingLotData = {};
    const lotPath = path.join("data", "lot.json");
    if (fs.existsSync(lotPath)) {
      existingLotData = readJson(lotPath);
    }
    
    // Merge with new data, keeping only the three specified fields
    const finalLotData = {
      ...existingLotData,
      lot_area_sqft: lotAreaSqft || existingLotData.lot_area_sqft || null,
      lot_type: lot_type || existingLotData.lot_type || null,
      lot_size_acre: lotSizeAcre || existingLotData.lot_size_acre || null,
    };
    
    writeJson(lotPath, finalLotData);
  } catch (e) {}

}

function extractAddressFromHTML($) {
  const siteCell = $('td:contains("Site")').filter((i, el) => $(el).text().trim() === 'Site');
  if (!siteCell.length) return null;
  
  const addressCell = siteCell.next('td');
  if (!addressCell.length) return null;
  
  return addressCell.text().replace(/\s+/g, ' ').trim() || null;
}

function attemptWriteAddressAndGeometry(unnorm, secTwpRng, seed, appendSourceInfo, $) {
  let full = unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  // If no address from unnorm, try to extract from HTML
  if (!full) {
    full = extractAddressFromHTML($);
    // console.log("---",full)
  }

  // Per evaluator expectation, set county_name from input jurisdiction
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  const county_name = inputCounty || "Okeechobee" || null;
  const address = {
      ...appendSourceInfo(seed),
      county_name,
      unnormalized_address: full,
      township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
      range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
      section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    };
  writeJson(path.join("data", "address.json"), address);
  // console.log("----ADDRESS--",address);
  //Geometry creation
  const geometry = {
    ...appendSourceInfo(seed),
    latitude: unnorm.latitude || null,
    longitude: unnorm.longitude || null
  };
  writeJson(path.join("data", "geometry.json"), geometry);
  
  // Create relationship between address and geometry
  const relAddressGeometry = {
    from: { "/": "./address.json" },
    to: { "/": "./geometry.json" }
  };
  writeJson(path.join("data", "relationship_address_has_geometry.json"), relAddressGeometry);
}

function extractMailingAddress($, ownerData, hyphenParcel) {
  // Get owner names from owner_data.json
  const ownerNames = [];
  if (ownerData && hyphenParcel) {
    const key = `property_${hyphenParcel}`;
    const ownersScope = ownerData[key];
    if (ownersScope && ownersScope.owners_by_date && Array.isArray(ownersScope.owners_by_date.current)) {
      ownersScope.owners_by_date.current.forEach(owner => {
        if (owner.name) {
          ownerNames.push(owner.name.toUpperCase().trim());
        }
      });
    }
  }
  
  // console.log("Owner names from JSON:", ownerNames)

  // Look for owner table with mailing address
  const ownerCell = $('td[bgcolor="#DCD9CC"]:contains("Owner")');
  if (!ownerCell.length) return null;
  
  const ownerRow = ownerCell.closest('tr');
  const addressCell = ownerRow.find('td[bgcolor="#FFFFFF"]');
  if (!addressCell.length) return null;
  
  // Find the table with owner name and address
  const ownerTable = addressCell.find('table');
  if (!ownerTable.length) return null;
  
  const ownerNameCell = ownerTable.find('tr.ownerNameTable td').first();
  if (!ownerNameCell.length) return null;
  
  const addressHtml = ownerNameCell.html();
  if (!addressHtml) return null;
  
  // Get the full text and normalize whitespace
  const fullText = ownerNameCell.text().replace(/\s+/g, ' ').trim();
  
  // Split by <br> tags and clean up each line
  const lines = addressHtml
    .split(/<br\s*\/?>/i)
    .map(line => line.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0);
  
  // console.log("Lines:", lines);
  // console.log("Full text:", fullText);
  
  // Check if any owner name matches the full text or individual lines
  let filteredText = fullText;
  ownerNames.forEach(ownerName => {
    const regex = new RegExp(ownerName.replace(/\s+/g, '\\s+'), 'gi');
    filteredText = filteredText.replace(regex, '').trim();
  });
  
  // Clean up any remaining extra spaces and commas
  filteredText = filteredText.replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*/g, ', ');
  
  console.log("Filtered text:", filteredText);
  return filteredText || null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJson(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJson(utilitiesDataPath)
    : null;
  const layoutData = fs.existsSync(layoutDataPath)
    ? readJson(layoutDataPath)
    : null;

  const propertySeed = fs.existsSync("property_seed.json")
    ? readJson("property_seed.json")
    : null;
  const unnormalizedAddress = fs.existsSync("unnormalized_address.json")
    ? readJson("unnormalized_address.json")
    : null;
    
  const seed = readJson("property_seed.json");

  // Determine hyphenated parcel id from HTML
  let hyphenParcel = null;
  const parcelText = $("table.parcelIDtable b").first().text().trim();
  const mParcel = parcelText.match(
    /^(\d-\d{2}-\d{2}-\d{2}-[A-Z0-9]{3,}\-\d{5}\-\d{4})/,
  );
  if (mParcel) hyphenParcel = mParcel[1];
  if (!hyphenParcel) {
    const fmt = $('input[name="formatPIN"]').attr("value");
    if (fmt) hyphenParcel = fmt.trim();
  }
  const appendSourceInfo = (seed) => ({
    source_http_request: {
      method: "GET",
      url: seed?.source_http_request?.url || null
    },
    request_identifier: hyphenParcel || seed?.request_identifier || seed?.parcel_id || "",
    });

  // 1) OWNERS
  if (ownerData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const ownersScope = key && ownerData[key] ? ownerData[key] : null;
    if (
      ownersScope &&
      ownersScope.owners_by_date &&
      Array.isArray(ownersScope.owners_by_date.current)
    ) {
      const currentOwners = ownersScope.owners_by_date.current;
      let companyIndex = 0;
      let personIndex = 0;
      const companyFiles = [];
      const personFiles = [];
      for (const ow of currentOwners) {
        if (ow.type === "company") {
          companyIndex += 1;
          const company = { ...appendSourceInfo(seed),name: ow.name || null };
          writeJson(path.join("data", `company_${companyIndex}.json`), company);
          companyFiles.push(`./company_${companyIndex}.json`);
        } else if (ow.type === "person") {
          // Format and validate name parts
          const formattedFirst = formatNameToPattern(ow.first_name);
          const formattedLast = formatNameToPattern(ow.last_name);
          const formattedMiddle = ow.middle_name ? formatNameToPattern(ow.middle_name) : null;

          // Only create person if first_name and last_name are valid
          if (!formattedFirst || !formattedLast) {
            console.error(`Skipping invalid person name: first_name="${ow.first_name}", last_name="${ow.last_name}"`);
            continue;
          }

          personIndex += 1;
          const person = {
            ...appendSourceInfo(seed),
            birth_date: null,
            first_name: formattedFirst,
            last_name: formattedLast,
            middle_name: formattedMiddle,
            prefix_name: ow.prefix_name,
            suffix_name: ow.suffix_name,
            us_citizenship_status: null,
            veteran_status: null,
          };
          writeJson(path.join("data", `person_${personIndex}.json`), person);
          personFiles.push(`./person_${personIndex}.json`);
        }
      }
      globalThis.__ownerCompanyFiles = companyFiles;
      globalThis.__ownerPersonFiles = personFiles;
    }
  }
  // console.log("companyfiles",globalThis.__ownerCompanyFiles)
  // console.log("personFiles",globalThis.__ownerPersonFiles)

  // 2) UTILITIES
  if (utilitiesData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    // console.log(key)
    const utilScope = key && utilitiesData[key] ? utilitiesData[key] : null;
    // console.log(utilScope);
    // console.log(Object.keys(utilScope).length)
    if (utilScope && Object.keys(utilScope).length > 0) {
      writeJson(path.join("data", "utility.json"), { ...utilScope });
    }
  }

  // 3) LAYOUT
  if (layoutData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const layScope = key && layoutData[key] ? layoutData[key] : null;
    if (layScope && Array.isArray(layScope.layouts)) {
      let i = 0;
      for (const layout of layScope.layouts) {
        i += 1;
        writeJson(path.join("data", `layout_${i}.json`), layout);
      }
    }
  }

  function extractSalesDeedsFilesAndRelationshipSalesOwner() {
    const salesRows = [];
    $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
      (idx, el) => {
        if (idx === 0) return;
        const tds = $(el).find("td");
        if (tds.length >= 4) {
          const dateTxt = $(tds[0]).text().trim();
          const priceTxt = $(tds[1]).text().trim();
          const bookPageTxt = $(tds[2]).text().trim();
          const deedCode = $(tds[3]).text().trim();
          if (dateTxt && /\d/.test(dateTxt)) {
            const linkEl = $(tds[2]).find("a");
            let clerkRef = null;
            const href = linkEl.attr("href") || "";
            const onClick = linkEl.attr("onclick") || "";
            const js = href || onClick;
            const m1 = js.match(/ClerkLink\('([^']+)'/);
            if (m1) clerkRef = m1[1];
            salesRows.push({
              dateTxt,
              priceTxt,
              deedCode,
              bookPageTxt,
              clerkRef,
            });
          }
        }
      },
    );

    const deedCodeMap = {
      "N/A": null,
      "WD": "Warranty Deed",
      "WTY": "Warranty Deed",
      "WARRANTY": "Warranty Deed",
      "SWD": "Special Warranty Deed",
      "SW": "Special Warranty Deed",
      "SPEC WD": "Special Warranty Deed",
      "SPECIAL WARRANTY": "Special Warranty Deed",
      "QCD": "Quitclaim Deed",
      "QC": "Quitclaim Deed",
      "QUITCLAIM": "Quitclaim Deed",
      "QUIT CLAIM": "Quitclaim Deed",
      "GD": "Grant Deed",
      "GRANT": "Grant Deed",
      "BSD": "Bargain and Sale Deed",
      "BARGAIN SALE": "Bargain and Sale Deed",
      "LBD": "Lady Bird Deed",
      "LADY BIRD": "Lady Bird Deed",
      "TOD": "Transfer on Death Deed",
      "TODD": "Transfer on Death Deed",
      "TRANSFER ON DEATH": "Transfer on Death Deed",
      "SD": "Sheriff's Deed",
      "SHERIFF": "Sheriff's Deed",
      "SHRF'S DEED": "Sheriff's Deed",
      "TD": "Tax Deed",
      "TAX": "Tax Deed",
      "TRD": "Trustee's Deed",
      "TRUSTEE": "Trustee's Deed",
      "TRUSTEE DEED": "Trustee's Deed",
      "PRD": "Personal Representative Deed",
      "PERS REP": "Personal Representative Deed",
      "PERSONAL REP": "Personal Representative Deed",
      "CD": "Correction Deed",
      "CORRECTION": "Correction Deed",
      "CORR DEED": "Correction Deed",
      "DIL": "Deed in Lieu of Foreclosure",
      "DILF": "Deed in Lieu of Foreclosure",
      "DEED IN LIEU": "Deed in Lieu of Foreclosure",
      "LED": "Life Estate Deed",
      "LIFE ESTATE": "Life Estate Deed",
      "JTD": "Joint Tenancy Deed",
      "JOINT TENANCY": "Joint Tenancy Deed",
      "TIC": "Tenancy in Common Deed",
      "TENANCY COMMON": "Tenancy in Common Deed",
      "CPD": "Community Property Deed",
      "COMMUNITY PROPERTY": "Community Property Deed",
      "GIFT": "Gift Deed",
      "GIFT DEED": "Gift Deed",
      "ITD": "Interspousal Transfer Deed",
      "INTERSPOUSAL": "Interspousal Transfer Deed",
      "WILD": "Wild Deed",
      "WILD D": "Wild Deed",
      "SMD": "Special Master's Deed",
      "SPECIAL MASTER": "Special Master's Deed",
      "COD": "Court Order Deed",
      "COURT ORDER": "Court Order Deed",
      "CFD": "Contract for Deed",
      "CONTRACT DEED": "Contract for Deed",
      "QTD": "Quiet Title Deed",
      "QUIET TITLE": "Quiet Title Deed",
      "AD": "Administrator's Deed",
      "ADMINISTRATOR": "Administrator's Deed",
      "GD (GUARDIAN)": "Guardian's Deed",
      "GUARDIAN": "Guardian's Deed",
      "RD": "Receiver's Deed",
      "RECEIVER": "Receiver's Deed",
      "ROW": "Right of Way Deed",
      "RIGHT OF WAY": "Right of Way Deed",
      "VPD": "Vacation of Plat Deed",
      "VACATION PLAT": "Vacation of Plat Deed",
      "AOC": "Assignment of Contract",
      "ASSIGNMENT CONTRACT": "Assignment of Contract",
      "ROC": "Release of Contract",
      "RELEASE CONTRACT": "Release of Contract"
    };

    const salesFiles = [];
    let saleIndex = 0,
      deedIndex = 0,
      fileIndex = 0;
    for (const row of salesRows) {
      // console.log("ROW",row)
      saleIndex += 1;
      const sale = {
        ...appendSourceInfo(seed),
        ownership_transfer_date: parseDateToISO(row.dateTxt),
        purchase_price_amount: parseCurrencyToNumber(row.priceTxt),
      };
      writeJson(path.join("data", `sales_${saleIndex}.json`), sale);
      salesFiles.push(`./sales_${saleIndex}.json`);
      // Extract book and page from bookPageTxt
      let book = null, page = null;
      if (row.bookPageTxt) {
        const bookPageMatch = row.bookPageTxt.match(/(\d+)\s*\/\s*(\d+)/);
        if (bookPageMatch) {
          book = bookPageMatch[1];
          page = bookPageMatch[2];
        }
      }

      // Only create deed if book, page, or deed type exists (but not N/A)
      if (book || page || (row.deedCode && row.deedCode !== "N/A")) {
        deedIndex += 1;
        const deed = {
          ...appendSourceInfo(seed),
          book: book,
          page: page
        };
        
        if (row.deedCode !== "N/A") {
          const mapped = deedCodeMap[row.deedCode];
          deed.deed_type = mapped || "Miscellaneous";
        }
        writeJson(path.join("data", `deed_${deedIndex}.json`), deed);

        writeJson(path.join("data", `relationship_sales_deed_${saleIndex}.json`), {
          from: { "/": `./sales_${saleIndex}.json` },
          to: { "/": `./deed_${deedIndex}.json` }
        });
      }

      // Extract book and page from bookPageTxt (format: "Book/Page")
      let filelink = null;
      if (row.bookPageTxt) {
        const bookPageMatch = row.bookPageTxt.match(/(\d+)\s*\/\s*(\d+)/);
        if (bookPageMatch) {
          const book = bookPageMatch[1];
          const page = bookPageMatch[2];
          filelink = `https://www.okeechobeepa.com/gis/linkClerk/?ClerkBook=${book}&ClerkPage=${page}&autoSubmit=1`;
        }
      }

      // Only create file if filelink exists and is not null/empty
      if (filelink) {
        fileIndex += 1;
        const fileRec = {
          ...appendSourceInfo(seed),
          document_type: "Title",
          file_format: null,
          name: row.clerkRef
            ? `Official Records ${row.clerkRef}`
            : row.bookPageTxt
              ? `Book/Page ${row.bookPageTxt}`
              : null,
          original_url: filelink,
          ipfs_url: null,
        };
        writeJson(path.join("data", `file_${fileIndex}.json`), fileRec);
        writeJson(path.join("data", `relationship_deed_file_${fileIndex}.json`), {
          from: { "/": `./deed_${deedIndex}.json` },
          to: { "/": `./file_${fileIndex}.json` }
        });
      }
    }


    //Relationship between latest sales and current owner.SInce there is no owner for each sale. we create atleast latest sale -->current owner mapping.
    if (salesFiles.length > 0) {
      const mostRecentSale = salesFiles[0];
      const companies = globalThis.__ownerCompanyFiles || [];
      const persons = globalThis.__ownerPersonFiles || [];
      if (companies.length > 0) {
        companies.forEach((companyPath, idx) =>
          writeJson(
            path.join(
              "data",
              idx === 0
                ? "relationship_sales_company.json"
                : `relationship_sales_company_${idx + 1}.json`,
            ),
            {  from: { "/": mostRecentSale },to: { "/": companyPath } },
          ),
        );
      } else if (persons.length > 0) {
        persons.forEach((personPath, idx) =>
          writeJson(
            path.join(
              "data",
              idx === 0
                ? "relationship_sales_person.json"
                : `relationship_sales_person_${idx + 1}.json`,
            ),
            {  from: { "/": mostRecentSale },to: { "/": personPath }},
          ),
        );
      }
    }
  }

  // 4) SALES + DEEDS + FILES
  extractSalesDeedsFilesAndRelationshipSalesOwner();

  // 5) TAX
  function buildTaxFromSection(sectionTitleContains, taxYear) {
    // console.log(`Looking for section: ${sectionTitleContains}`);
    // console.log(`HTML length: ${html.length}`);
    // console.log(`jQuery loaded: ${typeof $ !== 'undefined'}`);
    
    let table = null;
    const tables = $("table.parcelDetails_insideTable");
    // console.log(`Total tables with class parcelDetails_insideTable: ${tables.length}`);
    
    tables.each((i, el) => {
      const head = $(el).find("tr").first().text().replace(/\s+/g, ' ').trim();
      // console.log(`Table ${i} header: "${head}"`);
      if (head && head.includes(sectionTitleContains)) {
        table = $(el);
        // console.log(`Found matching table for: ${sectionTitleContains}`);
        return false;
      }
      return true;
    });
    
    if (!table) {
      // console.log(`No table found for: ${sectionTitleContains}`);
      return null;
    }
    function findRow(label) {
      let out = null;
      table.find("tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 2) {
          const lab = $(tds[0]).text().trim();
          const val = $(tds[1]).text().trim();
          if (lab.startsWith(label)) {
            out = val;
            // console.log(`Found ${label}: ${val}`);
            return false;
          }
        }
        return true;
      });
      // if (!out) console.log(`Not found: ${label}`);
      return out;
    }
    const land = findRow("Mkt Land");
    const bldg = findRow("Building");
    const just = findRow("Just");
    const assessed = findRow("Assessed");
    let taxable = null;
    table.find("tr").each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (label.includes("Total") && label.includes("Taxable")) {
          const html = $(tds[1]).html() || "";
          const text = $(tds[1]).text().trim();
          // console.log(`Total row - Label: ${label}, HTML: ${html}, Text: ${text}`);
          const m = html.match(/county:<\/b>\$([0-9,\.]+)/i);
          if (m) {
            taxable = m[1];
            // console.log(`Found taxable from HTML regex: ${taxable}`);
          } else {
            const m2 = text.match(/\$[0-9,\.]+/);
            if (m2) {
              taxable = m2[0];
              // console.log(`Found taxable from text regex: ${taxable}`);
            }
          }
        }
      }
    });
    // console.log(`Final values - Land: ${land}, Building: ${bldg}, Just: ${just}, Assessed: ${assessed}, Taxable: ${taxable}`);
    if (!land || !bldg || !just || !assessed || !taxable) {
      // console.log(`Missing required values for ${sectionTitleContains}`);
      return null;
    }
    return {
      ...appendSourceInfo(seed),
      tax_year: taxYear,
      property_assessed_value_amount: parseCurrencyToNumber(assessed),
      property_market_value_amount: parseCurrencyToNumber(just),
      property_building_amount: parseCurrencyToNumber(bldg),
      property_land_amount: parseCurrencyToNumber(land),
      property_taxable_value_amount: parseCurrencyToNumber(taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
  }
  const tax2024 = buildTaxFromSection("2024 Certified Values", 2024);
  // console.log("tax2024", tax2024);
  if (tax2024) writeJson(path.join("data", "tax_2024.json"), tax2024);
  const tax2025 = buildTaxFromSection("2025 Certified Values", 2025);
  if (tax2025) writeJson(path.join("data", "tax_2025.json"), tax2025);



  // 6) PROPERTY
  function extractPropertyData() {
    try {
      const parcelIdentifier =
        propertySeed && propertySeed.parcel_id
          ? propertySeed.parcel_id
          : $('input[name="PARCELID_Buffer"]').attr("value") || null;

      // Clean full legal text without UI anchor artifacts
      let legal = null;
      if ($("#Flegal").length) {
        const f = $("#Flegal").clone();
        f.find("a").remove();
        legal = f.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
      } else if ($("#Blegal").length) {
        const b = $("#Blegal").clone();
        b.find("a").remove();
        legal = b.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
      }

      // livable and effective year
      let livable = null,
        effYear = null;
      const bldgTable = $(
        "#parcelDetails_BldgTable table.parcelDetails_insideTable",
      ).first();
      if (bldgTable && bldgTable.length) {
        const firstRow = bldgTable.find("tr").eq(1);
        const tds = firstRow.find("td");
        if (tds.length >= 6) {
          const actualSF = tds.eq(4).text().trim();
          if (actualSF) livable = actualSF;
          const y = tds.eq(2).text().trim();
          if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
        }
      }

      // Extract Area and convert to square feet
      let totalAreaSqft = null;
      const areaText = $('td:contains("Area")')
        .filter((i, el) => $(el).text().trim() === "Area")
        .next()
        .text()
        .trim();
      if (areaText) {
        const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
        if (acreMatch) {
          const acres = parseFloat(acreMatch[1]);
          totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
        }
      }

      // Extract Use Code and map to property_type
      const useCode = $('td')
        .filter((i, el) => $(el).text().trim().startsWith('Use'))
        .next()
        .text()
        .replace(/\n/g, '')
        .trim();

      console.log("USECODE--",useCode);
      // const property_type_mapped = mapPropertyType(useCode);
      const propertyMapping = propertyTypeMapping.find(mapping => {
        if (!mapping.property_usecode || !useCode) return false;
        
        const mappingCode = mapping.property_usecode.replace(/\s+/g, '').toUpperCase();
        const cleanUseCode = useCode.replace(/\s+/g, '').toUpperCase();
        
        // 1. Exact match (highest priority)
        if (mappingCode === cleanUseCode) return true;
        
        // 2. Numeric code matching (second priority)
        const mappingNumMatch = mappingCode.match(/\((\d+)\)/);
        const useCodeNumMatch = cleanUseCode.match(/\((\d+)\)/);
        
        if (mappingNumMatch && useCodeNumMatch && mappingNumMatch[1] === useCodeNumMatch[1]) {
          return true;
        }
        
        // 3. Extract main part before first parentheses for both
        const mappingMain = mappingCode.split('(')[0];
        const useCodeMain = cleanUseCode.split('(')[0];
        
        // 4. Main part exact match
        if (mappingMain === useCodeMain) return true;
        
        // 5. Partial matches
        if (useCodeMain.startsWith(mappingMain) || mappingMain.startsWith(useCodeMain)) return true;
        
        return false;
      });
      console.log(">>>",propertyMapping)
      
      const propertyFields = {
        property_type: propertyMapping?.property_type || null,
        property_usage_type: propertyMapping?.property_usage_type || null,
        ownership_estate_type: propertyMapping?.ownership_estate_type || null,
        structure_form: propertyMapping?.structure_form || null,
        build_status: propertyMapping?.build_status || null
      };

      const prop = {
        ...appendSourceInfo(seed),
        parcel_identifier: parcelIdentifier || null,
        property_legal_description_text: legal || null,
        property_structure_built_year: effYear || null,
        // property_effective_built_year: effYear || null,
        // property_type: property_type_mapped || "MiscellaneousResidential",
        number_of_units: null,
        subdivision: null,
        zoning: null,
        property_type: propertyFields.property_type,
        property_usage_type: propertyFields.property_usage_type,
        ownership_estate_type: propertyFields.ownership_estate_type,
        structure_form: propertyFields.structure_form,
        build_status: propertyFields.build_status,

      };
      writeJson(path.join("data", "property.json"), prop);
    } catch (e) {}
  }  
  extractPropertyData();



  // 8) ADDRESS
  function extractAddressData() {
    try {
      if (unnormalizedAddress && unnormalizedAddress.full_address) {
        const full = unnormalizedAddress.full_address.trim();
        let street_number = null,
          pre = null,
          street_name = null,
          suffix = null,
          city = null,
          state = null,
          zip = null,
          plus4 = null;
        const parts = full.split(",");
        if (parts.length >= 2) {
          const line1 = parts[0].trim();
          const cityPart = parts[1].trim();
          const stateZipPart = parts[2] ? parts[2].trim() : "";
          const m1 = line1.match(/^(\d+)\s+([NESW]{1,2})\s+(.+?)\s+([A-Z]+)$/);
          if (m1) {
            street_number = m1[1];
            pre = m1[2];
            street_name = m1[3].trim();
            suffix = m1[4];
          }
          city = cityPart.toUpperCase();
          const m3 = stateZipPart.match(/^([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/);
          if (m3) {
            state = m3[1];
            zip = m3[2];
            plus4 = m3[3] || null;
          }
        }
        const suffixMap = {
          RD: "Rd",
          ROAD: "Rd",
          ST: "St",
          STREET: "St",
          AVE: "Ave",
          AVENUE: "Ave",
          BLVD: "Blvd",
          DR: "Dr",
          DRIVE: "Dr",
          LN: "Ln",
          LANE: "Ln",
          CT: "Ct",
          COURT: "Ct",
          TER: "Ter",
          TERRACE: "Ter",
          HWY: "Hwy",
          PKWY: "Pkwy",
          PL: "Pl",
          WAY: "Way",
          CIR: "Cir",
          PLZ: "Plz",
          TRL: "Trl",
          RTE: "Rte",
        };
        const street_suffix_type = suffix
          ? suffixMap[suffix.toUpperCase()] || null
          : null;
        let section = null,
          township = null,
          range = null;
        const strTxt = $('td:contains("S/T/R")')
          .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
          .first()
          .next()
          .text()
          .trim();
        if (strTxt && /\d{2}-\d{2}-\d{2}/.test(strTxt)) {
          const parts2 = strTxt.split("-");
          section = parts2[0];
          township = parts2[1];
          range = parts2[2];
        }
        
        const secTwpRng = { section, township, range };
        // console.log("SECCC",secTwpRng)
        attemptWriteAddressAndGeometry(unnormalizedAddress, secTwpRng, seed, appendSourceInfo, $)
        // writeJson(path.join("data", "address.json"), {
        //   street_number: street_number || null,
        //   street_pre_directional_text: pre || null,
        //   street_name: street_name ? street_name.toUpperCase() : null,
        //   street_suffix_type: street_suffix_type || null,
        //   street_post_directional_text: null,
        //   unit_identifier: null,
        //   city_name: city || null,
        //   state_code: state || null,
        //   postal_code: zip || null,
        //   plus_four_postal_code: plus4 || null,
        //   county_name: "Okeechobee",
        //   country_code: "US",
        //   latitude:
        //     typeof unnormalizedAddress.latitude === "number"
        //       ? unnormalizedAddress.latitude
        //       : null,
        //   longitude:
        //     typeof unnormalizedAddress.longitude === "number"
        //       ? unnormalizedAddress.longitude
        //       : null,
        //   route_number: null,
        //   township: township || null,
        //   range: range || null,
        //   section: section || null,
        //   lot: null,
        //   block: null,
        //   municipality_name: null,
        // });
      
      }
    } catch (e) {}
  }
  extractAddressData();
  //add fallback address extraction from property site.

  //Mailing Address
  const mailingAddressRaw = extractMailingAddress($, ownerData, hyphenParcel)
  console.log("MAILING--",mailingAddressRaw);
  const mailingAddressOutput = {
    ...appendSourceInfo(seed),
    unnormalized_address: mailingAddressRaw?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim(),
  };
  writeJson(path.join("data", "mailing_address.json"), mailingAddressOutput);

  // Create mailing address relationships with current owners
  const companies = globalThis.__ownerCompanyFiles || [];
  const persons = globalThis.__ownerPersonFiles || [];
  
  companies.forEach((companyPath, idx) => {
    writeJson(
      path.join("data", `relationship_company_has_mailing_address_${idx + 1}.json`),
      {
        from: { "/": companyPath },
        to: { "/": "./mailing_address.json" }
      }
    );
  });
  
  persons.forEach((personPath, idx) => {
    writeJson(
      path.join("data", `relationship_person_has_mailing_address_${idx + 1}.json`),
      {
        from: { "/": personPath },
        to: { "/": "./mailing_address.json" }
      }
    );
  });


  //Extra Features Extraction.Adds lot area as well.
  extractExtraFeatures($, hyphenParcel, seed,appendSourceInfo);
  
}

main();
