const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
}

const propertyTypeMapping = [
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel",
    "property_usecode": "00000 - Vacant"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "00100 - Single Family"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome",
    "property_usecode": "00200 - Mobile Home"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "00300 - Multifamily"
  },
  {
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit",
    "property_usecode": "00400 - Condominium"
  },
  {
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit",
    "property_usecode": "00500 - Cooperative"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building",
    "property_usecode": "00600 - Retirement"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "00700 - Misc. Residence"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "00800 - Mfr &lt;10 Units"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel",
    "property_usecode": "00900 - Common Area"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel",
    "property_usecode": "01000 - Vacant Comm"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building",
    "property_usecode": "01100 - Stores"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building",
    "property_usecode": "01200 - Store/off/res"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building",
    "property_usecode": "01300 - Dept Store"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building",
    "property_usecode": "01400 - Supermarket"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building",
    "property_usecode": "01500 - Sh Ctr Regional"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building",
    "property_usecode": "01600 - Sh Ctr Cmmity"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building",
    "property_usecode": "01601 - Sh Ctr Nbhd"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building",
    "property_usecode": "01700 - Office 1 Story"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building",
    "property_usecode": "01701 - Post Office"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building",
    "property_usecode": "01800 - Off Multistory"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building",
    "property_usecode": "01900 - Prof Offices"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building",
    "property_usecode": "02000 - Airport"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building",
    "property_usecode": "02100 - Restaurant"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building",
    "property_usecode": "02200 - Rest Drive-in"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building",
    "property_usecode": "02300 - Financial"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building",
    "property_usecode": "02400 - Insurance"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building",
    "property_usecode": "02500 - Service Shops"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building",
    "property_usecode": "02600 - Serv Stations"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building",
    "property_usecode": "02700 - Auto Sales"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel",
    "property_usecode": "02800 - Pkg Lot (comm)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building",
    "property_usecode": "02900 - Wholesaler"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building",
    "property_usecode": "03000 - Florist"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building",
    "property_usecode": "03100 - Drv-in Theater"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building",
    "property_usecode": "03200 - Theater"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building",
    "property_usecode": "03300 - Night Clubs"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building",
    "property_usecode": "03400 - Bowling Alley"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building",
    "property_usecode": "03500 - Tourist Attraction"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel",
    "property_usecode": "03600 - Camps"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel",
    "property_usecode": "03700 - Racetrack"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel",
    "property_usecode": "03800 - Golf Course"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building",
    "property_usecode": "03900 - Motel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel",
    "property_usecode": "04000 - Vacant Industrial"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building",
    "property_usecode": "04100 - Light Mfg"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building",
    "property_usecode": "04200 - Heavy Mfg"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building",
    "property_usecode": "04300 - Lumber Yd/mill"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building",
    "property_usecode": "04400 - Packing"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building",
    "property_usecode": "04500 - Bottler"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building",
    "property_usecode": "04600 - Food Processing"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building",
    "property_usecode": "04700 - Min Processing"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building",
    "property_usecode": "04800 - Wareh/dist Term"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel",
    "property_usecode": "04900 - Open Storage"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel",
    "property_usecode": "05000 - Improved Agri"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel",
    "property_usecode": "05100 - Cropsoil Class1"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel",
    "property_usecode": "05200 - Cropsoil Class2"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel",
    "property_usecode": "05300 - Cropsoil Class3"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05400 - Tmbr Si 90+"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05500 - Tmbr Si 80-89"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05600 - Tmbr Si 70-79"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05700 - Tmbr Si 60-69"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05800 - Tmbr Si 50-59"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "05900 - Tmbr Not Clssfd"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06000 - Grzgsoil Class1"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06100 - Grzgsoil Class2"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06200 - Grzgsoil Class3"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06300 - Grzgsoil Class4"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06400 - Grzgsoil Class5"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "06500 - Grzgsoil Class6"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel",
    "property_usecode": "06600 - Orchard Groves"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel",
    "property_usecode": "06700 - Poul/bees/fish"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel",
    "property_usecode": "06800 - Dairies/feedlts"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel",
    "property_usecode": "06900 - Orn/misc Agri"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "07000 - Vacant Institutional"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building",
    "property_usecode": "07100 - Churches"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building",
    "property_usecode": "07200 - Prv Schl/coll"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building",
    "property_usecode": "07300 - Prv Hospital"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building",
    "property_usecode": "07400 - Nursing Home"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building",
    "property_usecode": "07500 - Orphng/non-prof"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel",
    "property_usecode": "07600 - Mort/cemetery"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building",
    "property_usecode": "07700 - Clb/ldg/un Hall"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building",
    "property_usecode": "07800 - Sani/ Rest Home"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building",
    "property_usecode": "07900 - Cultural"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel",
    "property_usecode": "08000 - Water Mgt Dist Vac/xfeat"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08010 - County Vacant/xfeatures"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "LandParcel",
    "property_usecode": "08011 - County-sch Brd Vacant/xf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08020 - State(not Tiitf)vac/xf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08030 - State(tiitf) Vacant/xf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08040 - Federal Vacant/xfeatures"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08050 - Municipal Vacant/xfeature"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08090 - Other Public Vac/xfeature"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building",
    "property_usecode": "08100 - Military"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08200 - Forest/pk/rec-wtr Mgt Dst"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08210 - Forest/pk/rec-county"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08220 - Forest/pk/rec-st No Tiitf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08230 - Forest/pk/rec-state Tiitf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08240 - Forest/pk/rec-federal"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08250 - Forest/pk/rec-municipal"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel",
    "property_usecode": "08290 - Forest/pk/rec-otherpublic"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08300 - Pub Cty School"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08400 - College-wtr Mgt Dist"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08410 - College-county"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08420 - College-state(not Tiitf)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08430 - College-state(tiitf)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08440 - College-federal"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08450 - College-municipal/city/tw"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "08490 - College-other Public"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building",
    "property_usecode": "08500 - Hospital"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08600 - Cty Inc Nonmuni"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08700 - State-not Tiitf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08701 - State Of Fla - Tiitf"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08710 - Water Management Dist"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08800 - Federal"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "08900 - Municipal"
  },
  {
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel",
    "property_usecode": "09000 - Leasehold Int"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel",
    "property_usecode": "09100 - Utility"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel",
    "property_usecode": "09110 - Railroad Owned-local Assd"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel",
    "property_usecode": "09200 - Ming/pet/gaslnd"
  },
  {
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel",
    "property_usecode": "09300 - Subsurf Rights"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel",
    "property_usecode": "09400 - Right-of-way"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel",
    "property_usecode": "09500 - Rivers/lakes"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel",
    "property_usecode": "09600 - Sewg/waste Land"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel",
    "property_usecode": "09700 - Outdr Rec/pk Ld"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel",
    "property_usecode": "09800 - Centrally Assd"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel",
    "property_usecode": "09900 - Acrg Not Znd Ag"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "09999 - Exempt"
  }
]

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }

  const normalizedUseCode = entry.property_usecode.match(/\d{5}/)[0];

  if (!normalizedUseCode) {
    return lookup;
  }

  lookup[normalizedUseCode] = entry;
  return lookup;
}, {});

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;

  const normalizedInput = String(code).match(/\d{5}/)[0];
  if (!normalizedInput) return null;

  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
  }

  return null;
}

function getPropertyId($) {
  let vid = null;
  $(".summary-card .row").each((i, row) => {
    const label = $(row).find(".col-4").first().text().trim();
    const val = $(row).find(".col-8").first().text().trim();
    if (label === "VID:") vid = val;
  });
  if (!vid) {
    const res = $(".result-card").attr("data-parcel-pid");
    if (res) vid = res.trim();
  }
  return vid || "unknown";
}

function parseNumber(n) {
  if (n == null) return null;
  const s = String(n).replace(/[$,\s]/g, "");
  if (s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "nan")
    return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

function textClean(t) {
  return t == null ? "" : String(t).replace(/\s+/g, " ").trim();
}

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeOut(filePath, obj) {
  const outPath = path.join("data", filePath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
}

const normSpace = (s) => (s || "").replace(/\s+/g, " ").trim();

function getAddreses($) {
  let siteAddress = null;
  let mailingAddress = null;
  $(".parcelDetails .summary-card .row .col-4").each((i, el) => {
    const label = normSpace($(el).text());
    if (/^911 address:?$/i.test(label)) {
      const value = normSpace($(el).siblings(".col-8").first().text());
      siteAddress = value;
    }
    if (/^mailing address:?$/i.test(label)) {
      const value = normSpace($(el).siblings(".col-8").first().text());
      mailingAddress = value;
    }
  });
  return {
    siteAddress,
    mailingAddress
  }
}



function extractAddress(addressDetails, unnorm) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty || inputCounty === "") {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  const mailingAddress = addressDetails.mailingAddress;
  const siteAddress = addressDetails.siteAddress;
  if (mailingAddress) {
    const mailingAddressObj = {
      unnormalized_address: mailingAddress,
    };
    writeOut("mailing_address.json", mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const addressObj = {
      county_name,
      township: null,
      range: null,
      section: null,
      unnormalized_address: siteAddress,
    };
    writeOut("address.json", addressObj);
    writeOut("relationship_property_has_address.json", {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  }
  return hasOwnerMailingAddress;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u === "TD") return "Tax Deed";
  if (u === "TAX DEED") return "Tax Deed";
  if (u === "QC") return "Quitclaim Deed";
  if (u === "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u === "SW") return "Special Warranty Deed";
  if (u === "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return "Miscellaneous";
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
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
    if (!geom || !geom.polygon) {
      continue;
    }
    for (const coordinate of geom.polygon.coordinates[0]) {
      polygon.push({"longitude": coordinate[0], "latitude": coordinate[1]})
    }
    const geometry = {
      "latitude": geom.latitude,
      "longitude": geom.longitude,
      "polygon": polygon,
    }
    writeOut(`geometry_${geomIndex}.json`, geometry);
    writeOut(`relationship_parcel_to_geometry_${geomIndex}.json`, {
        from: { "/": `./parcel.json` },
        to: { "/": `./geometry_${geomIndex}.json` },
    });
    geomIndex++;
  }
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  // Load inputs
  const htmlPath = path.join(".", "input.html");

  const html = fs.readFileSync(htmlPath, "utf8");
  const seedCsvPath = path.join(".", "input.csv");

  const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
  createGeometryClass(createGeometryInstances(seedCsv));
  let unnorm = readJson("address.json");
  if (!unnorm) {
    unnorm = readJson("unnormalized_address.json");
  }
  let parcel = readJson("parcel.json");
  if (!parcel) {
    parcel = readJson("property_seed.json");
    parcel.parcel_identifier = parcel.parcel_id;
  }
  const ownersData = readJson(path.join("owners", "owner_data.json"));
  const utilitiesData = readJson(
    path.join("owners", "utilities_data.json"),
  );
  const layoutData = readJson(
    path.join("owners", "layout_data.json"),
  );
  const structureData = readJson(
    path.join("owners", "structure_data.json"),
  );
  const $ = cheerio.load(html);
  const pid = getPropertyId($);
  const key = `property_${pid}`
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  let util = null;
  if (utilitiesData) {
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }

  const addressDetails = getAddreses($);
  const hasOwnerMailingAddress = extractAddress(addressDetails, unnorm);

  // PROPERTY
  const parcelId = parcel.parcel_identifier;

  let legalDescription = "";
  $(".summary-card .row").each((i, el) => {
    const heading = textClean($(el).find(".col-md-2").text());
    if (/^Description:/i.test(heading)) {
      legalDescription = textClean($(el).find(".col-md-10").text());
    }
  });
  if (!legalDescription) {
    const descRow = $(".summary-card .card-body .row")
      .filter((i, r) => /Description:/i.test($(r).text()))
      .first();
    legalDescription = textClean(descRow.find(".col-md-10").text());
  }


  let yearBuilt = null;
  let yearEffective = null;
  const impSection = $("#improvements-accordion .card.wrapper-card").first();
  impSection.find("table tbody tr").each((i, tr) => {
    const k = textClean($(tr).find("td").eq(0).text());
    const v = textClean($(tr).find("td").eq(1).text());
    if (/Actual Year Built/i.test(k)) yearBuilt = parseNumber(v);
    if (/Effective Year Built/i.test(k)) yearEffective = parseNumber(v);
  });

  let zoning = null;
  const zoningRow = $(
    '#details-Land .card:contains("Zoning") table tbody tr',
  ).first();
  if (zoningRow && zoningRow.length) {
    const code = textClean(zoningRow.find("td").eq(1).text());
    const desc = textClean(zoningRow.find("td").eq(2).text());
    if (code || desc) zoning = [code, desc].filter(Boolean).join(" ");
  }

  const propertyOut = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legalDescription || null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: yearEffective || null,
    zoning: zoning || null,
  };
  const landuse = $(
    '.details-card:contains("Summary") table tbody tr',
  )
    .filter((i, el) => /Property Use:/i.test($(el).text()))
    .find("td")
    .eq(1)
    .text();
  if (!landuse) {
    throw new Error("Property type not found");
  }
  const propertyMapping = mapPropertyTypeFromUseCode(landuse);
  if (!propertyMapping) {
    throw new Error("Property type not found");
  }
  propertyOut.property_type = propertyMapping.property_type,
  propertyOut.ownership_estate_type = propertyMapping.ownership_estate_type,
  propertyOut.build_status = propertyMapping.build_status,
  propertyOut.structure_form = propertyMapping.structure_form,
  propertyOut.property_usage_type = propertyMapping.property_usage_type,
  writeOut("property.json", propertyOut);
  writeOut("parcel.json", {parcel_identifier: parcelId || ""});
  writeOut(`relationship_property_to_parcel.json`, {
        from: { "/": `./property.json` },
        to: { "/": `./parcel.json` },
    });

  // SALES + DEEDS
  const salesRows = $("#details-Sales table tbody tr");
  let saleIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;
  let latestSaleIndex = null;
  let latestSaleDate = null;

  for (let i = 0; i < salesRows.length; i++) {
    const tr = salesRows[i];
    const tds = $(tr).find("td");
    if (tds.length < 5) continue;
    const link = $(tds[0]).find("a");
    const book = textClean(link.attr("data-book")) || null;
    const page = textClean(link.attr("data-page")) || null;
    const instrument = textClean($(tds[1]).text());
    const saleDate = textClean($(tds[2]).text());
    const priceText = textClean($(tds[4]).text());
    const price = parseNumber(priceText);

    saleIndex += 1;
    const saleObj = { ownership_transfer_date: saleDate || null };
    if (!latestSaleIndex) {
      latestSaleIndex = saleIndex;
      latestSaleDate = saleDate;
    } else if(!latestSaleDate && saleDate) {
      latestSaleIndex = saleIndex;
      latestSaleDate = saleDate;
    } else if(saleDate) {
      const latestSaleDateParsed = Date.parse(latestSaleDate);
      const saleDateParsed = Date.parse(saleDate);
      if (saleDateParsed && latestSaleDateParsed && saleDateParsed > latestSaleDateParsed) {
        latestSaleIndex = saleIndex;
        latestSaleDate = saleDate;
      }
    }
    if (price && price > 0) saleObj.purchase_price_amount = price;
    const saleName = `sales_${saleIndex}.json`;
    // saleFiles.push({ name: saleName, date: saleDate, instrument, book, page });
    writeOut(saleName, saleObj);

    let deedType = mapInstrumentToDeedType(instrument);

    if (deedType) {
      deedIndex += 1;
      let deedObj = { deed_type: deedType };
      if (book) deedObj.book = book;
      if (page) deedObj.page = page;
      const deedName = `deed_${deedIndex}.json`;
      writeOut(deedName, deedObj);

      const relSaleDeed = {
        from: { "/": `./sales_${saleIndex}.json` },
        to: { "/": `./deed_${deedIndex}.json` },
      };
      writeOut(`relationship_sales_deed_${deedIndex}.json`, relSaleDeed);
    }
    if (deedType && book && page) {
      fileIndex += 1;
      const fileLink = `https://apps.putnam-fl.com/pa/property/?Xaction=print&report=OfficialRecord&book=${book}&page=${page}`;
      const file = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name: `Deed ${book}/${page}`,
        original_url: fileLink,
      };
      writeOut(`file_${fileIndex}.json`, file);
      const relDeedFile = {
        from: { "/": `./deed_${deedIndex}.json` },
        to: { "/": `./file_${fileIndex}.json` },
      };
      writeOut(`relationship_deed_file_${fileIndex}.json`, relDeedFile);
    }
  }
  // TAX: from Comparison table for multiple years
  const compTable = $('#details-Value .card:contains("Comparison") table');
  const years = [];
  const colIndexByYear = {};
  compTable.find("thead tr th").each((i, th) => {
    const year = parseNumber(textClean($(th).text()));
    if (year && year >= 1900) {
      years.push(year);
      colIndexByYear[year] = i; // column index in tbody rows
    }
  });
  const rows = {};
  compTable.find("tbody tr").each((_, tr) => {
    const label = textClean($(tr).find("td").eq(0).text());
    rows[label] = tr;
  });

  for (const year of years) {
    const col = colIndexByYear[year];
    function getVal(labelRegex) {
      const rowEntry = Object.keys(rows).find((k) => labelRegex.test(k));
      if (!rowEntry) return null;
      const tr = rows[rowEntry];
      const td = $(tr).find("td").eq(col);
      return parseNumber(textClean(td.text()));
    }
    const landVal = getVal(/Just Value of Land/i);
    const impVal = getVal(/Improvement Value/i);
    const marketVal = getVal(/Market Value/i);

    const taxObj = {
      tax_year: year,
      property_assessed_value_amount: marketVal || null,
      property_market_value_amount: marketVal || null,
      property_building_amount: impVal || null,
      property_land_amount: landVal || null,
      property_taxable_value_amount: marketVal || null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeOut(`tax_${year}.json`, taxObj);
  }

  // LOT from Land
  let lotAcres = null;
  const landRow = $(
    '#details-Land .card:contains("Land") table tbody tr',
  ).first();
  if (landRow && landRow.length) {
    const unitsText = textClean(landRow.find("td").eq(9).text());
    const units = parseNumber(unitsText);
    if (units != null) lotAcres = units;
  }
  const lotObj = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: (lotAcres != null && lotAcres > 0) ? Math.round(lotAcres * 43560) : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: (lotAcres != null && lotAcres > 0) ? lotAcres : null,
    paving_area_sqft: null,
    paving_installation_date: null,
    site_lighting_fixture_count: null,
    site_lighting_installation_date: null,
  };
  writeOut("lot.json", lotObj);
  // Layout extraction from owners/layout_data.json
  if (layoutData) {
    let layoutBuildingMap = {};
    const lset =
      key && layoutData[key] && Array.isArray(layoutData[key].layouts)
        ? layoutData[key].layouts
        : [];
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
      writeOut(`layout_${idx}.json`, layoutOut);
      if (l.space_type === "Building") {
        const building_number = l.building_number;
        layoutBuildingMap[building_number.toString()] = idx;
      } else {
        const building_number = l.building_number;
        if (building_number) {
          const building_layout_number = layoutBuildingMap[building_number.toString()];
          if (building_layout_number) {
            writeOut(`relationship_layout_${building_layout_number}_to_layout_${idx}.json`, {
                      to: { "/": `./layout_${idx}.json` },
                      from: { "/": `./layout_${building_layout_number}.json` },
            });
          }
        }
      }
      if (util && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in util) {
          writeOut(`utility_${idx}.json`, util[l.building_number.toString()]);
          writeOut(`relationship_layout_to_utility_${idx}.json`, {
                    to: { "/": `./utility_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      if (struct && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in struct) {
          writeOut(`structure_${idx}.json`, struct[l.building_number.toString()]);
          writeOut(`relationship_layout_to_structure_${idx}.json`, {
                    to: { "/": `./structure_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      idx++;
    }
  }
  if (ownersData) {
    const ownersKey = ownersData[key] ? key : "property_unknown_id";
    const ownersByDate =
      ownersData[ownersKey] && ownersData[ownersKey].owners_by_date
        ? ownersData[ownersKey].owners_by_date || []
        : [];
    if (ownersByDate) {
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
        }));
        let loopIdx = 1;
        for (const p of people) {
          writeOut(`person_${loopIdx}.json`, p);
          if (latestSaleIndex) {
            writeOut(
              `relationship_sales_person_${loopIdx}.json`,
              {
                to: { "/": `./person_${loopIdx}.json` },
                from: { "/": `./sales_${latestSaleIndex}.json` },
              },
            );
          }
          if (hasOwnerMailingAddress) {
            writeOut(
                `relationship_person_has_mailing_address_${loopIdx}.json`,
              {
                from: { "/": `./person_${loopIdx}.json` },
                to: { "/": `./mailing_address.json` },
              },
            );
          }
          loopIdx++;
        }
        const companyNames = new Set();
        Object.values(ownersByDate).forEach((arr) => {
          (arr || []).forEach((o) => {
            if (o.type === "company" && (o.name || "").trim())
              companyNames.add((o.name || "").trim().toUpperCase());
          });
        });
        companies = Array.from(companyNames).map((n) => ({ 
          name: n,
        }));
        loopIdx = 1;
        for (const c of companies) {
          writeOut(`company_${loopIdx}.json`, c);
          if (latestSaleIndex) {
            writeOut(
              `relationship_sales_company_${loopIdx}.json`,
              {
                to: { "/": `./company_${loopIdx}.json` },
                from: { "/": `./sales_${latestSaleIndex}.json` },
              },
            );
          }
          if (hasOwnerMailingAddress) {
            writeOut(
                `relationship_company_has_mailing_address_${loopIdx}.json`,
              {
                from: { "/": `./company_${loopIdx}.json` },
                to: { "/": `./mailing_address.json` },
              },
            );
          }
          loopIdx++;
        }
    }
  }
}

if (require.main === module) {
  main();
  console.log("Extraction complete.");
}
