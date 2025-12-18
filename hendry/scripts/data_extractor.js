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

const deedCodeMap = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  QCD: "Quitclaim Deed",
  QC: "Quitclaim Deed",
  QUITCLAIM: "Quitclaim Deed",
  "QUITCLAIM DEED": "Quitclaim Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TODD: "Transfer on Death Deed",
  SD: "Sheriff's Deed",
  "SHRF'S DEED": "Sheriff's Deed",
  TD: "Tax Deed",
  TRD: "Trustee's Deed",
  "TRUSTEE DEED": "Trustee's Deed",
  PRD: "Personal Representative Deed",
  "PERS REP DEED": "Personal Representative Deed",
  CD: "Correction Deed",
  "CORR DEED": "Correction Deed",
  DIL: "Deed in Lieu of Foreclosure",
  DILF: "Deed in Lieu of Foreclosure",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  "GIFT DEED": "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  "WILD D": "Wild Deed",
  SMD: "Special Master\u2019s Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  RD: "Receiver's Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ROC: "Release of Contract",
  LC: "Land Contract",
  MTG: "Mortgage",
  LIS: "Lis Pendens",
  EASE: "Easement",
  AGMT: "Agreement",
  AFF: "Affidavit",
  ORD: "Order",
  CERT: "Certificate",
  RES: "Resolution",
  DECL: "Declaration",
  COV: "Covenant",
  SUB: "Subordination",
  MOD: "Modification",
  REL: "Release",
  ASSG: "Assignment",
  LEAS: "Lease",
  TR: "Trust",
  WILL: "Will",
  PROB: "Probate",
  JUDG: "Judgment",
  LIEN: "Lien",
  SAT: "Satisfaction",
  PART: "Partition",
  EXCH: "Exchange",
  CONV: "Conveyance",
  OTH: "Other",
};

const propertyTypeMapping = [
  {
    "property_usecode": "VACANT RESIDENTIAL (0000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT RES W MISC XF's (0070)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SINGLE FAMILY (0100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "COACH HOUSE (0140)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "MOBILE HOME (0200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "MULTI-FAMILY 10+ UNITS (0300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "CONDOMINIUM (0400)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "COMMON AREAS W/IMPROVE (0407)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "COMMON AREAS (0410)",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TOWNHOUSE OR VILLAS (0430)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "RETIREMENT HOMES (0600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "MISC RES - MIGRANT CAMPS, BOARDING H (0700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "DWELLINGS 9 UNITS or Less (0800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTIPLE SFR's (0801)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "MULTIPLE MH's (0802)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SFR & MH ONE OR MORE EACH (0808)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "APPARTMENTS 5 OR MORE (0822)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "DUPLEX ONE OR MORE (0827)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "TRIPLEX OR QUAD 1 OR MORE (0828)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "RES COMM AREA (0900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT COMMERCIAL (1000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT COMM W MISC XF's (1070)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STORES ONE STORY (1100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORE/OFF/RES (1200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "BUSINESS & MH (1202)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "STORE DEPARTMT (1300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
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
    "property_usecode": "SHOP CTR COMMTY (1600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICE 1 STORY (1700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "OFFICE 2+ STY (1800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "PROFESSIONAL (1900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "Day Care (1901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "TRANSIT TERM (2000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "RESTAURANT (2100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "REST FAST FOOD (2200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "FINANCIAL INSTITUIONS (2300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "SERVICE SHOP (2500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "SERVICE STATION (2600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "AUTO SALES/SERV (2700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "PARKING LOT (2800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MOBILE HOME & or RV PARK (2810)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "NIGHT CLUB/BAR (3300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "CAMPGROUND (3600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RACETRACK (3700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MOTEL/HOTEL (3900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "VACANT INDUS (4000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT INDUS W MISC XF's (4070)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MANUFACT LIGHT (4100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "MANUFACT HEAVY (4200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "LUMBER YD/MILL (4300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "PACKING (4400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "FOOD PROCESSING (4600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "MINERAL PROC (4700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "WAREHOUSE (4800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "AIRCRAFT HANGER (4810)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
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
    "property_usecode": "MARINA (4910)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "FARMING (5300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SUGAR CANE (5320)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FARMING CONS EAS (5396)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND (5800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURE (6100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "HAY (6140)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HayMeadow",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SEMI IMPROVED PASTURE (6200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "NATIVE PASTURE (6300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NativePasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURE CONS EAS (6396)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CITRUS (6600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "POUL/BEES/FISH (6700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SWINE (6720)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "ORN/MISC AGRI (6900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SOD FARMS (6951)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "VACANT INSTIT (7000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CHURCH (7100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "PVT SCH/COLL (7200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "PVT HOSP/NUR HM (7300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "NON-PROF/ORPHNG (7500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "MORT/CEMETERY (7600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CLB/LDG/UN HALL (7700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "CULTURAL (7900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "WATER MGMT DIST (8000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PARK/REC (8200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PUBLIC SCHOOL (8300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "PUBLIC COLLEGE (8400)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "PUBLIC HOSPITAL (8500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "COUNTY (8600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "INDEPENDANT SPEC DISTR (8610)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "DRAINAGE DISTRICT (8620)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STATE (8700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "STATE of FL TIITF (8710)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FEDERAL (8800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "FEDERAL TENANTS ASSOCATION (8810)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MUNICIPAL (8900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LEASEHOLD INT (9000)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LEASEHOLD INT FOOD PROCES (9046)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "LEASEHOLD INT AG CANE (9052)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LEASEHOLD INT FARMING (9053)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LEASEHOLD INT NATIVE PAST (9063)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NativePasture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "UTILITY (9100)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "SUBSURFACE RTS (9300)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RIGHT-OF-WAY (9400)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SUBMERGED LAND (9500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "WASTE LAND (9600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "Conservation Easement (9610)",
    "ownership_estate_type": "OtherEstate",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CENTRALLY ASSD (9800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "ACRG NOT CLASSED AG (9900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  }
]

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_mSection > div > table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl11_ctl01_grdSales tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl03_ctl01_grdValuation";

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

function removeMatchingDataFiles(pattern) {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (pattern.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function baseLayoutPayload(parcelId, sourceHttp) {
  return {
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: null,
    cabinet_style: null,
    clutter_level: null,
    condition_issues: null,
    countertop_material: null,
    decor_elements: null,
    design_style: null,
    fixture_finish_quality: null,
    floor_level: null,
    flooring_installation_date: null,
    flooring_material_type: null,
    flooring_wear: null,
    furnished: null,
    has_windows: null,
    heated_area_sq_ft: null,
    is_exterior: false,
    is_finished: null,
    kitchen_renovation_date: null,
    lighting_features: null,
    livable_area_sq_ft: null,
    natural_light_quality: null,
    paint_condition: null,
    pool_condition: null,
    pool_equipment: null,
    pool_surface_type: null,
    pool_type: null,
    pool_water_quality: null,
    request_identifier: parcelId,
    safety_features: null,
    size_square_feet: null,
    space_index: null,
    space_type: null,
    space_type_index: null,
    spa_installation_date: null,
    spa_type: null,
    story_type: null,
    total_area_sq_ft: null,
    view_type: null,
    visible_damage: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    source_http_request: sourceHttp || null,
  };
}

function mapPermitImprovementType(typeText) {
  const s = (typeText || "").toUpperCase().trim();
  if (!s) return null;
  if (s.includes("ROOF")) return "Roofing";
  if (s.includes("DEMOL")) return "Demolition";
  if (s.includes("POOL") || s.includes("SPA")) return "PoolSpaInstallation";
  if (s.includes("MECHAN") || s.includes("HVAC")) return "MechanicalHVAC";
  if (s.includes("PLUMB")) return "Plumbing";
  if (s.includes("ELECT")) return "Electrical";
  if (s.includes("GAS")) return "GasInstallation";
  if (s.includes("FENCE")) return "Fencing";
  if (s.includes("SCREEN")) return "ScreenEnclosure";
  if (s.includes("IRRIG")) return "LandscapeIrrigation";
  if (s.includes("SOLAR")) return "Solar";
  if (s.includes("ADDITION")) return "BuildingAddition";
  if (s.includes("RESIDENTIAL")) return "ResidentialConstruction";
  if (s.includes("COMMERCIAL")) return "CommercialConstruction";
  if (s.includes("SITE")) return "SiteDevelopment";
  if (s.includes("STRUCTURE MOVE")) return "StructureMove";
  if (s.includes("REMOV") || s.includes("TEAR DOWN")) return "Demolition";
  return "GeneralBuilding";
}

function mapPermitImprovementAction(typeText) {
  const s = (typeText || "").toUpperCase().trim();
  if (!s) return null;
  if (s.includes("NEW") || s.includes("BUILD") || s.includes("CONST"))
    return "New";
  if (s.includes("REPLACE") || s.includes("ROOF")) return "Replacement";
  if (s.includes("REMODEL") || s.includes("RENOV") || s.includes("ALTER"))
    return "Alteration";
  if (s.includes("ADDITION") || s.includes("ADD")) return "Addition";
  if (s.includes("DEMOL") || s.includes("REMOVE")) return "Remove";
  return "Other";
}

function mapPermitStatus(activeText) {
  const s = (activeText || "").toUpperCase().trim();
  if (!s) return null;
  if (s === "YES" || s === "ACTIVE" || s === "OPEN") return "InProgress";
  if (s === "NO" || s === "CLOSED" || s === "COMPLETE" || s === "COMPLETED")
    return "Completed";
  return null;
}

function cleanRelationshipComponent(name) {
  return name.replace(/^\.\//, "").replace(/\.json$/i, "");
}

function relationshipFileName(fromFile, toFile) {
  return `relationship_${cleanRelationshipComponent(fromFile)}_${cleanRelationshipComponent(toFile)}.json`;
}

function writeRelationship(fromFile, toFile) {
  const fileName = relationshipFileName(fromFile, toFile);
  writeJSON(path.join("data", fileName), {
    from: { "/": `./${fromFile}` },
    to: { "/": `./${toFile}` },
  });
  return fileName;
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function normalizeWhitespace(str) {
  return (str || "")
    .replace(/\s+/g, " ")
    .replace(/[\u00A0\s]+/g, " ")
    .trim();
}

function cleanInvalidCharsFromName(raw) {
  let parsedName = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, "")
    .replace(/[^A-Za-z\-', .]/g, "")
    .trim();
  while (/^[\-', .]/i.test(parsedName)) {
    parsedName = parsedName.slice(1);
  }
  while (/[\-', .]$/i.test(parsedName)) {
    parsedName = parsedName.slice(0, parsedName.length - 1);
  }
  return parsedName;
}

function cleanRawName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/\*\*?\s*none\s*\*\*/i.test(s)) return "";
  const noisePatterns = [
    /\bET\s*AL\b/gi,
    /\bETAL\b/gi,
    /\bET\s*UX\b/gi,
    /\bET\s*VIR\b/gi,
    /\bET\s+UXOR\b/gi,
    /\bTRUSTEE[S]?\b/gi,
    /\bTTEE[S]?\b/gi,
    /\bU\/A\b/gi,
    /\bU\/D\/T\b/gi,
    /\bAKA\b/gi,
    /\bA\/K\/A\b/gi,
    /\bFBO\b/gi,
    /\bC\/O\b/gi,
    /\b%\s*INTEREST\b/gi,
    /\b\d{1,3}%\b/gi,
    /\b\d{1,3}%\s*INTEREST\b/gi,
  ];
  noisePatterns.forEach((re) => {
    s = s.replace(re, " ");
  });
  s = s.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  s = s
    .replace(/^(&|and)\s+/i, "")
    .replace(/\s+(&|and)$/i, "")
    .trim();
  const companySuffix =
    "(?:LLC|L\\.L\\.C|INC|CORP|CO|COMPANY|LTD|TRUST|LP|LLP|PLC|PLLC|PARTNERSHIP|PARTNERS)";
  const trailingNumAfterCo = new RegExp(
    `^(.*?\\b${companySuffix}\\b)\\s+\\d{1,3}$`,
    "i",
  );
  const m = s.match(trailingNumAfterCo);
  if (m) {
    s = m[1].trim();
  }
  return s;
}

const COMPANY_KEYWORDS = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "cor",
  "co",
  "company",
  "services",
  "trust",
  "tr",
  "associates",
  "association",
  "holdings",
  "group",
  "partners",
  "partnership",
  "lp",
  "llp",
  "plc",
  "pllc",
  "bank",
  "church",
  "school",
  "university",
  "authority",
];

const NAME_PREFIX_MAP = new Map([
  ["mr", "Mr"],
  ["mister", "Mr"],
  ["mrs", "Mrs"],
  ["ms", "Ms"],
  ["miss", "Miss"],
  ["dr", "Dr"],
  ["doctor", "Dr"],
  ["prof", "Prof"],
  ["professor", "Prof"],
  ["rev", "Rev"],
  ["reverend", "Rev"],
  ["pastor", "Pastor"],
  ["hon", "Hon"],
  ["honorable", "Hon"],
  ["sir", "Sir"],
  ["madam", "Madam"],
  ["capt", "Capt"],
  ["captain", "Capt"],
  ["lt", "Lt"],
  ["lieutenant", "Lt"],
  ["sgt", "Sgt"],
  ["sergeant", "Sgt"],
  ["col", "Col"],
  ["colonel", "Col"],
  ["judge", "Judge"],
]);

const NAME_SUFFIX_MAP = new Map([
  ["jr", "Jr"],
  ["sr", "Sr"],
  ["ii", "II"],
  ["iii", "III"],
  ["iv", "IV"],
  ["v", "V"],
  ["vi", "VI"],
  ["md", "MD"],
  ["phd", "PhD"],
  ["dds", "DDS"],
  ["dvm", "DVM"],
  ["cpa", "CPA"],
  ["pe", "PE"],
  ["esq", "Esq"],
  ["esquire", "Esq"],
  ["ret", "Ret"],
]);

const SURNAME_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "del",
  "dela",
  "de la",
  "de las",
  "de los",
  "der",
  "di",
  "dos",
  "du",
  "la",
  "las",
  "le",
  "los",
  "mac",
  "mc",
  "san",
  "santa",
  "santo",
  "saint",
  "st",
  "st.",
  "van",
  "van der",
  "vander",
  "ver",
  "von",
  "von der",
]);

function normalizeTokenForLookup(token) {
  return (token || "").replace(/\./g, "").toLowerCase();
}

function aggregateParticles(tokens) {
  const out = [];
  while (tokens.length > 0) {
    const token = tokens[0];
    const norm = normalizeTokenForLookup(token);
    out.push(token);
    tokens.shift();
    if (!SURNAME_PARTICLES.has(norm)) {
      break;
    }
  }
  return out;
}

function aggregateSurnameFromEnd(tokens) {
  const out = [];
  let capturedBase = false;
  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1];
    const norm = normalizeTokenForLookup(token);
    if (!capturedBase) {
      out.unshift(token);
      tokens.pop();
      capturedBase = true;
      continue;
    }
    if (!SURNAME_PARTICLES.has(norm)) {
      break;
    }
    out.unshift(token);
    tokens.pop();
  }
  return out;
}

function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  return COMPANY_KEYWORDS.some((kw) =>
    new RegExp(`(^|\\b)${kw}(\\b|\\.$|$)`, "i").test(n),
  );
}

function splitCompositeNames(name) {
  const cleaned = cleanRawName(name);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+|\s*\/\s*|\s*;\s*|\s*\+\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const norm = normalizeTokenForLookup(part);
    if (NAME_PREFIX_MAP.has(norm) && i + 1 < parts.length) {
      const nextPart = parts[i + 1];
      const firstToken = nextPart.split(/\s+/).find(Boolean) || "";
      const nextNorm = normalizeTokenForLookup(firstToken);
      if (!NAME_PREFIX_MAP.has(nextNorm)) {
        parts[i + 1] = `${part} ${parts[i + 1]}`;
      }
      continue;
    }
    merged.push(part);
  }
  return merged.length ? merged : [cleaned];
}

function classifyOwner(raw) {
  const hasComma = /,/.test(raw || "");
  const hasLowercase = /[a-z]/.test(raw || "");
  const cleaned = cleanRawName(raw);
  if (!cleaned) {
    return { valid: false, reason: "empty_after_clean", raw };
  }
  if (isCompanyName(cleaned)) {
    return { valid: true, owner: { type: "company", name: cleaned } };
  }
  let tokens = cleaned
    .split(/\s+/)
    .map((tok) => cleanInvalidCharsFromName(tok))
    .filter(Boolean);
  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  let prefix = null;
  let hadPrefix = false;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[0]);
    const canonical = NAME_PREFIX_MAP.get(lookup);
    if (!canonical) break;
    prefix = prefix ? `${prefix} ${canonical}` : canonical;
    tokens.shift();
    hadPrefix = true;
  }

  let suffix = null;
  while (tokens.length > 0) {
    const lookup = normalizeTokenForLookup(tokens[tokens.length - 1]);
    const canonical = NAME_SUFFIX_MAP.get(lookup);
    if (!canonical) break;
    suffix = suffix ? `${canonical} ${suffix}` : canonical;
    tokens.pop();
  }

  if (tokens.length < 2) {
    return { valid: false, reason: "person_missing_last_name", raw: cleaned };
  }

  let useLastFirst = !(hadPrefix || hasComma || hasLowercase);
  let lastTokens;
  if (useLastFirst) {
    lastTokens = aggregateParticles(tokens);
    if (tokens.length < 1) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
  } else {
    lastTokens = aggregateSurnameFromEnd(tokens);
    if (tokens.length < 1) {
      return {
        valid: false,
        reason: "person_missing_first_name",
        raw: cleaned,
      };
    }
  }

  const first = tokens.shift();
  const middleTokens = tokens;

  const last = lastTokens.join(" ").trim();
  const middle = middleTokens.join(" ").trim();

  if (!first || !last) {
    return {
      valid: false,
      reason: "person_missing_first_or_last",
      raw: cleaned,
    };
  }

  const person = {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle ? middle : null,
    prefix_name: prefix || null,
    suffix_name: suffix || null,
  };
  return { valid: true, owner: person };
}

function dedupeOwners(owners) {
  const seen = new Map();
  const out = [];
  for (const o of owners) {
    let norm;
    if (o.type === "company") {
      norm = `company:${normalizeWhitespace(o.name || "").toLowerCase()}`;
    } else {
      const middle = o.middle_name ? normalizeWhitespace(o.middle_name).toLowerCase() : "";
      const suffix = o.suffix_name ? normalizeWhitespace(o.suffix_name).toLowerCase() : "";
      norm = `person:${normalizeWhitespace(o.first_name || "").toLowerCase()}|${middle}|${normalizeWhitespace(o.last_name || "").toLowerCase()}|${suffix}`;
    }
    if (!seen.has(norm)) {
      seen.set(norm, { ...o });
      out.push(o);
    }
  }
  return out;
}

function parseSaleParties(raw) {
  if (!raw) return [];
  if (/\*\*?\s*none\s*\*\*/i.test(raw)) return [];
  const parts = splitCompositeNames(raw);
  const parties = [];
  parts.forEach((part) => {
    const result = classifyOwner(part);
    if (result.valid) {
      parties.push(result.owner);
    } else {
      const fallback = cleanRawName(part);
      if (fallback) {
        parties.push({ type: "company", name: fallback });
      }
    }
  });
  return dedupeOwners(parties);
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
    const link = $(tds[3]).find("a").last().attr("href") || null;
    const grantor = textOf($(tds[6]));
    const grantee = textOf($(tds[7]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage,
      link,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const key = instr.trim().toUpperCase();
  return deedCodeMap[key] || null;
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
      market: get("Just Market Value"),
      assessed: get("School Assessed Value"),
      taxable: get("School Taxable Value"),
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
}

function writeSalesDeedsFilesAndRelationships(
  sales,
  parcelId,
  propertySeed,
  unnormalized,
) {
  removeMatchingDataFiles(/^sales_history_\d+\.json$/);
  removeMatchingDataFiles(/^sales_\d+\.json$/);
  removeMatchingDataFiles(/^deed_\d+\.json$/);
  removeMatchingDataFiles(/^file_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_(?:sales|sales_history|deed|file)_.*\.json$/);

  const saleFiles = [];
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;
  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleFile = `sales_history_${idx}.json`;
    const saleObj = {
      ownership_transfer_date: parseDateToISO(s.saleDate),
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
    };
    if (parcelId) saleObj.request_identifier = parcelId;
    if (sourceHttp) saleObj.source_http_request = sourceHttp;
    writeJSON(path.join("data", saleFile), saleObj);
    saleFiles.push(saleFile);

    const deedFile = `deed_${idx}.json`;
    const deedType = mapInstrumentToDeedType(s.instrument);
    const deed = {};
    if (parcelId) deed.request_identifier = parcelId;
    if (deedType) deed.deed_type = deedType;
    if (sourceHttp) deed.source_http_request = sourceHttp;
    const bookPageText = s.bookPage
      ? s.bookPage.split("\n")[0].trim()
      : null;
    if (bookPageText) {
      const bookPageMatch = bookPageText.match(/(\d+)\s*\/\s*(\d+)/);
      if (bookPageMatch) {
        deed.book = bookPageMatch[1];
        deed.page = bookPageMatch[2];
      }
    }
    writeJSON(path.join("data", deedFile), deed);

    const fileFile = `file_${idx}.json`;
    let fileName = s.bookPage ? s.bookPage.split("\n")[0] : null;
    const file = {
      document_type: null,
      file_format: null,
      ipfs_url: null,
      name: fileName ? `Deed ${fileName}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", fileFile), file);

    writeRelationship(fileFile, deedFile);
    writeRelationship(saleFile, deedFile);
    writeRelationship(saleFile, fileFile);
  });
  return saleFiles;
}
let people = [];
let companies = [];
let personIndexByKey = new Map();
let companyIndexByName = new Map();

function buildPersonKey(first, middle, last, suffix) {
  return [
    (first || "").trim().toUpperCase(),
    (middle || "").trim().toUpperCase(),
    (last || "").trim().toUpperCase(),
    (suffix || "").trim().toUpperCase(),
  ].join("|");
}

function buildCompanyKey(name) {
  return (name || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function findPersonIndexByName(first, last, middle = null, suffix = null) {
  const key = buildPersonKey(first, middle, last, suffix);
  return personIndexByKey.get(key) || null;
}

function findPersonIndexForOwner(owner) {
  if (!owner || owner.type !== "person") return null;
  return findPersonIndexByName(
    owner.first_name,
    owner.last_name,
    owner.middle_name || null,
    owner.suffix_name || null,
  );
}

function findCompanyIndexByName(name) {
  const key = buildCompanyKey(name);
  return companyIndexByName.get(key) || null;
}

function findCompanyIndexForOwner(owner) {
  if (!owner || owner.type !== "company") return null;
  return findCompanyIndexByName(owner.name);
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
  saleFiles,
  propertySeed,
  unnormalized,
) {
  removeMatchingDataFiles(/^person_\d+\.json$/);
  removeMatchingDataFiles(/^company_\d+\.json$/);
  removeMatchingDataFiles(/^mailing_address_person_\d+\.json$/);
  removeMatchingDataFiles(/^mailing_address_company_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_sales_history_\d+_person_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_sales_history_\d+_company_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_sales_person_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_sales_company_\d+\.json$/);

  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;
  const baseRequestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnormalized && unnormalized.request_identifier) ||
    parcelId ||
    null;

  removeMatchingDataFiles(/^relationship_person_\d+_has_mailing_address\.json$/);
  removeMatchingDataFiles(/^relationship_company_\d+_has_mailing_address\.json$/);
  removeMatchingDataFiles(/^relationship_person_\d+_mailing_address_person_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_company_\d+_mailing_address_company_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_person_\d+_mailing_address\.json$/);
  removeMatchingDataFiles(/^relationship_company_\d+_mailing_address\.json$/);

  const currentOwners = Array.isArray(ownersByDate.current)
    ? ownersByDate.current
    : [];
  const mailingPath = path.join("data", "mailing_address.json");
  if (fs.existsSync(mailingPath)) fs.unlinkSync(mailingPath);

  let mailingPayload = null;
  let mailingOwners = [];
  if (currentOwners.length) {
    const primaryOwner = currentOwners.find(
      (o) => o && o.mailing_address && o.type === "person",
    ) ||
      currentOwners.find((o) => o && o.mailing_address && o.type === "company");

    if (primaryOwner && primaryOwner.mailing_address) {
      mailingPayload = {
        unnormalized_address: primaryOwner.mailing_address,
        latitude: null,
        longitude: null,
        request_identifier: baseRequestIdentifier,
      };
      if (sourceHttp) mailingPayload.source_http_request = sourceHttp;
      mailingOwners = currentOwners.filter(
        (owner) => owner && owner.mailing_address,
      );
    }
  }
  const personMap = new Map();
  const companyMap = new Map();

  const addPersonOwner = (owner) => {
    if (!owner || !owner.first_name || !owner.last_name) return;
    const key = buildPersonKey(
      owner.first_name,
      owner.middle_name || null,
      owner.last_name,
      owner.suffix_name || null,
    );
    const existing = personMap.get(key);
    if (existing) {
      if (!existing.middle_name && owner.middle_name)
        existing.middle_name = owner.middle_name;
      if (!existing.prefix_name && owner.prefix_name)
        existing.prefix_name = owner.prefix_name;
      if (!existing.suffix_name && owner.suffix_name)
        existing.suffix_name = owner.suffix_name;
      if (
        (!existing.mailing_address || !existing.mailing_address.trim()) &&
        owner.mailing_address
      ) {
        existing.mailing_address = owner.mailing_address;
      }
      return;
    }
    personMap.set(key, {
      first_name: owner.first_name,
      middle_name: owner.middle_name || null,
      last_name: owner.last_name,
      prefix_name: owner.prefix_name || null,
      suffix_name: owner.suffix_name || null,
      mailing_address: owner.mailing_address || null,
    });
  };

  const addCompanyOwner = (owner) => {
    if (!owner) return;
    const rawName =
      typeof owner === "string" ? owner : (owner.name || "").trim();
    if (!rawName) return;
    const key = buildCompanyKey(rawName);
    const existing = companyMap.get(key);
    const mailing = typeof owner === "string" ? null : owner.mailing_address || null;
    if (existing) {
      if ((!existing.mailing_address || !existing.mailing_address.trim()) && mailing) {
        existing.mailing_address = mailing;
      }
      return;
    }
    companyMap.set(key, {
      name: rawName.trim(),
      mailing_address: mailing,
    });
  };

  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        addPersonOwner(o);
      } else if (o.type === "company") {
        addCompanyOwner(o);
      }
    });
  });

  const salePartyCache = sales.map((rec) => {
    const grantors = parseSaleParties(rec.grantor || "");
    const grantees = parseSaleParties(rec.grantee || "");
    grantors.forEach((party) => {
      if (party.type === "person") addPersonOwner(party);
      else if (party.type === "company") addCompanyOwner(party);
    });
    grantees.forEach((party) => {
      if (party.type === "person") addPersonOwner(party);
      else if (party.type === "company") addCompanyOwner(party);
    });
    return { grantors, grantees };
  });

  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    prefix_name: p.prefix_name ? titleCaseName(p.prefix_name) : null,
    suffix_name: p.suffix_name || null,
    mailing_address: p.mailing_address || null,
    birth_date: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));
  personIndexByKey = new Map();
  people.forEach((p, idx) => {
    const idxOneBased = idx + 1;
    const key = buildPersonKey(
      p.first_name,
      p.middle_name,
      p.last_name,
      p.suffix_name,
    );
    personIndexByKey.set(key, idxOneBased);
    const { mailing_address: _mailingAddress, ...personRecord } = p;
    writeJSON(path.join("data", `person_${idxOneBased}.json`), personRecord);
  });

  companies = Array.from(companyMap.values()).map((entry) => ({
    name: entry.name,
    mailing_address: entry.mailing_address || null,
    request_identifier: parcelId,
  }));
  companyIndexByName = new Map();
  companies.forEach((c, idx) => {
    const idxOneBased = idx + 1;
    const key = buildCompanyKey(c.name);
    companyIndexByName.set(key, idxOneBased);
    const { mailing_address: _mailingAddress, ...companyRecord } = c;
    writeJSON(path.join("data", `company_${idxOneBased}.json`), companyRecord);
  });

  const linkedPersonIds = new Set();
  const linkedCompanyIds = new Set();
  // Relationships: ensure each sale links to grantee (or fallback grantor) and any recorded owners for that date
  sales.forEach((rec, idx) => {
    const saleFile = saleFiles ? saleFiles[idx] : null;
    if (!saleFile) return;
    const linkedTargets = new Set();
    const addRelationshipForOwner = (owner) => {
      if (!owner) return;
      if (owner.type === "person") {
        const key = buildPersonKey(
          owner.first_name,
          owner.middle_name || null,
          owner.last_name,
          owner.suffix_name || null,
        );
        const pIdx = personIndexByKey.get(key);
        if (pIdx) {
          const relKey = `person_${pIdx}`;
          if (!linkedTargets.has(relKey)) {
            linkedTargets.add(relKey);
            writeRelationship(saleFile, `person_${pIdx}.json`);
            linkedPersonIds.add(pIdx);
          }
        }
      } else if (owner.type === "company") {
        const key = buildCompanyKey(owner.name);
        const cIdx = companyIndexByName.get(key);
        if (cIdx) {
          const relKey = `company_${cIdx}`;
          if (!linkedTargets.has(relKey)) {
            linkedTargets.add(relKey);
            writeRelationship(saleFile, `company_${cIdx}.json`);
            linkedCompanyIds.add(cIdx);
          }
        }
      }
    };

    const dateKey = parseDateToISO(rec.saleDate);
    const ownersOnDate = (dateKey && ownersByDate[dateKey]) || [];
    ownersOnDate.forEach((o) => {
      if (o.type === "person") {
        addRelationshipForOwner({
          type: "person",
          first_name: o.first_name,
          middle_name: o.middle_name || null,
          last_name: o.last_name,
          suffix_name: o.suffix_name || null,
        });
      } else if (o.type === "company") {
        addRelationshipForOwner({ type: "company", name: o.name });
      }
    });

    const saleParties = salePartyCache[idx] || { grantors: [], grantees: [] };
    let targetParties = saleParties.grantees;
    if (!targetParties || targetParties.length === 0) {
      for (let prev = idx - 1; prev >= 0; prev--) {
        const prevGrantors = (salePartyCache[prev] || {}).grantors || [];
        if (prevGrantors.length) {
          targetParties = prevGrantors;
          break;
        }
      }
    }
    (targetParties || []).forEach(addRelationshipForOwner);
  });

  const prunePerson = (id) => {
    const filePath = path.join("data", `person_${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    for (const [key, value] of personIndexByKey.entries()) {
      if (value === id) personIndexByKey.delete(key);
    }
  };

  const pruneCompany = (id) => {
    const filePath = path.join("data", `company_${id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    for (const [key, value] of companyIndexByName.entries()) {
      if (value === id) companyIndexByName.delete(key);
    }
  };

  people.forEach((_, idx) => {
    const personId = idx + 1;
    if (!linkedPersonIds.has(personId)) prunePerson(personId);
  });

  companies.forEach((_, idx) => {
    const companyId = idx + 1;
    if (!linkedCompanyIds.has(companyId)) pruneCompany(companyId);
  });

  if (mailingPayload) {
    writeJSON(mailingPath, mailingPayload);
    mailingOwners.forEach((owner) => {
      if (owner.type === "person") {
        const pIdx = findPersonIndexByName(
          owner.first_name,
          owner.last_name,
          owner.middle_name || null,
          owner.suffix_name || null,
        );
        if (pIdx && linkedPersonIds.has(pIdx))
          writeRelationship(
            `person_${pIdx}.json`,
            path.basename(mailingPath),
          );
      } else if (owner.type === "company") {
        const cIdx = findCompanyIndexByName(owner.name);
        if (cIdx && linkedCompanyIds.has(cIdx))
          writeRelationship(
            `company_${cIdx}.json`,
            path.basename(mailingPath),
          );
      }
    });
  }
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

function writeUtility(parcelId, buildingLayouts, propertySeed, unnormalized) {
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  if (!utils) return;
  const key = `property_${parcelId}`;
  const record = utils[key];
  if (!record) return;

  removeMatchingDataFiles(/^utility_\d+\.json$/);
  removeMatchingDataFiles(/^utility\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_has_utility_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_utility_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_property_has_utility_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_property_utility_\d+\.json$/);

  const buildingMap = new Map();
  (buildingLayouts || []).forEach((b) => {
    buildingMap.set(b.building_index, b);
  });
  const totalBuildings = buildingMap.size;

  const buildingEntries = Array.isArray(record.buildings)
    ? record.buildings
    : [];
  const propertyEntries = Array.isArray(record.property_utilities)
    ? record.property_utilities
    : [];
  const extraEntries = Array.isArray(record.extra_feature_utilities)
    ? record.extra_feature_utilities
    : [];

  let utilityCounter = 0;
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;

  const toUtilityPayload = (entry) => ({
    cooling_system_type: entry.cooling_system_type ?? null,
    heating_system_type: entry.heating_system_type ?? null,
    public_utility_type: entry.public_utility_type ?? null,
    sewer_type: entry.sewer_type ?? null,
    water_source_type: entry.water_source_type ?? null,
    plumbing_system_type: entry.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      entry.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: entry.electrical_panel_capacity ?? null,
    electrical_wiring_type: entry.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: entry.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      entry.electrical_wiring_type_other_description ?? null,
    solar_panel_present:
      entry.solar_panel_present != null ? entry.solar_panel_present : false,
    solar_panel_type: entry.solar_panel_type ?? null,
    solar_panel_type_other_description:
      entry.solar_panel_type_other_description ?? null,
    smart_home_features: entry.smart_home_features ?? null,
    smart_home_features_other_description:
      entry.smart_home_features_other_description ?? null,
    hvac_unit_condition: entry.hvac_unit_condition ?? null,
    solar_inverter_visible:
      entry.solar_inverter_visible != null ? entry.solar_inverter_visible : false,
    hvac_unit_issues: entry.hvac_unit_issues ?? null,
    electrical_panel_installation_date:
      entry.electrical_panel_installation_date ?? null,
    electrical_rewire_date: entry.electrical_rewire_date ?? null,
    hvac_capacity_kw: entry.hvac_capacity_kw ?? null,
    hvac_capacity_tons: entry.hvac_capacity_tons ?? null,
    hvac_equipment_component: entry.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: entry.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: entry.hvac_equipment_model ?? null,
    hvac_installation_date: entry.hvac_installation_date ?? null,
    hvac_seer_rating: entry.hvac_seer_rating ?? null,
    hvac_system_configuration: entry.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      entry.plumbing_system_installation_date ?? null,
    sewer_connection_date: entry.sewer_connection_date ?? null,
    solar_installation_date: entry.solar_installation_date ?? null,
    solar_inverter_installation_date:
      entry.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: entry.solar_inverter_manufacturer ?? null,
    solar_inverter_model: entry.solar_inverter_model ?? null,
    water_connection_date: entry.water_connection_date ?? null,
    water_heater_installation_date: entry.water_heater_installation_date ?? null,
    water_heater_manufacturer: entry.water_heater_manufacturer ?? null,
    water_heater_model: entry.water_heater_model ?? null,
    well_installation_date: entry.well_installation_date ?? null,
    request_identifier: parcelId,
    source_http_request: sourceHttp,
  });

  const createUtility = (entry) => {
    utilityCounter++;
    const payload = toUtilityPayload(entry || {});
    const file = `utility_${utilityCounter}.json`;
    writeJSON(path.join("data", file), payload);
    return { id: utilityCounter, file };
  };

  const linkUtilityToLayout = (layoutId, utilityId) => {
    writeRelationship(`layout_${layoutId}.json`, `utility_${utilityId}.json`);
  };

  const linkUtilityToProperty = (utilityId) => {
    writeRelationship("property.json", `utility_${utilityId}.json`);
  };

  buildingEntries.forEach((entry) => {
    const utility = createUtility(entry);
    const buildingIndex =
      entry && entry.building_index ? entry.building_index : null;
    const layoutRef = buildingIndex ? buildingMap.get(buildingIndex) : null;
    if (layoutRef && layoutRef.layout_id) {
      linkUtilityToLayout(layoutRef.layout_id, utility.id);
    } else if (
      buildingEntries.length === 1 &&
      totalBuildings > 1 &&
      !buildingIndex
    ) {
      linkUtilityToProperty(utility.id);
    } else if (totalBuildings === 1 && buildingMap.size === 1) {
      const onlyLayout = Array.from(buildingMap.values())[0];
      if (onlyLayout && onlyLayout.layout_id) {
        linkUtilityToLayout(onlyLayout.layout_id, utility.id);
      } else {
        linkUtilityToProperty(utility.id);
      }
    } else {
      linkUtilityToProperty(utility.id);
    }
  });

  propertyEntries.forEach((entry) => {
    const utility = createUtility(entry);
    linkUtilityToProperty(utility.id);
  });

  extraEntries.forEach((entry) => {
    const utility = createUtility(entry);
    linkUtilityToProperty(utility.id);
  });
}

function writeLayout(parcelId, propertySeed, unnormalized) {
  const layouts = readJSON(path.join("owners", "layout_data.json"));
  const key = `property_${parcelId}`;
  const record = layouts && layouts[key] ? layouts[key] : null;
  let buildingEntries = [];
  if (record && Array.isArray(record.buildings)) {
    buildingEntries = record.buildings;
  } else if (record && Array.isArray(record.layouts)) {
    buildingEntries = [
      {
        building_index: 1,
        total_area_sq_ft: null,
        livable_area_sq_ft: null,
        heated_area_sq_ft: null,
        rooms: record.layouts.map((l) => ({
          space_type: l.space_type ?? "Room",
          count: 1,
        })),
        floors: [],
      },
    ];
  }

  const property = readJSON(path.join("data", "property.json")) || {};
  const propertyType = property.property_type || null;

  removeMatchingDataFiles(/^layout_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_has_layout_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_layout_\d+\.json$/);

  if (propertyType === "LandParcel" || buildingEntries.length === 0) {
    return { buildingLayouts: [] };
  }

  let layoutCounter = 0;
  const buildingLayouts = [];
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;

  const writeLayoutFile = (payload) => {
    layoutCounter++;
    const record = { ...payload, space_index: layoutCounter };
    const file = `layout_${layoutCounter}.json`;
    writeJSON(path.join("data", file), record);
    return { id: layoutCounter, file };
  };

  const writeLayoutRelationship = (parentId, childId) => {
    writeRelationship(`layout_${parentId}.json`, `layout_${childId}.json`);
  };

  buildingEntries.forEach((entry, idx) => {
    const buildingIndex =
      entry && entry.building_index ? entry.building_index : idx + 1;
    const base = baseLayoutPayload(parcelId, sourceHttp);
    base.space_type = entry && entry.space_type ? entry.space_type : "Building";
    base.space_type_index = String(buildingIndex);
    base.is_finished = true;
    base.is_exterior =
      entry && entry.is_exterior != null ? Boolean(entry.is_exterior) : false;
    base.building_number = buildingIndex;
    const totalArea =
      entry && entry.total_area_sq_ft != null
        ? entry.total_area_sq_ft
        : entry && entry.heated_area_sq_ft != null
          ? entry.heated_area_sq_ft
          : null;
    const livableArea =
      entry && entry.livable_area_sq_ft != null
        ? entry.livable_area_sq_ft
        : entry && entry.heated_area_sq_ft != null
          ? entry.heated_area_sq_ft
          : null;
    base.total_area_sq_ft = totalArea;
    base.livable_area_sq_ft = livableArea;
    base.heated_area_sq_ft =
      entry && entry.heated_area_sq_ft != null ? entry.heated_area_sq_ft : null;
    base.size_square_feet = totalArea;

    const buildingLayout = writeLayoutFile(base);
    buildingLayouts.push({
      building_index: buildingIndex,
      layout_id: buildingLayout.id,
      layout_file: buildingLayout.file,
    });

    const floors = Array.isArray(entry.floors) ? entry.floors : [];
    const rooms = Array.isArray(entry.rooms) ? entry.rooms : [];

    if (floors.length) {
      floors.forEach((floor, floorIdx) => {
        const floorIndexSegment = `${buildingIndex}.${floorIdx + 1}`;
        const floorPayload = baseLayoutPayload(parcelId, sourceHttp);
        floorPayload.space_type = "Floor";
        floorPayload.space_type_index = floorIndexSegment;
        floorPayload.floor_level =
          floor && floor.floor_number != null
            ? floor.floor_number
            : floorIdx + 1;
        floorPayload.size_square_feet =
          floor && floor.size_square_feet != null
            ? floor.size_square_feet
            : null;
        floorPayload.is_finished = true;
        floorPayload.is_exterior = false;
        floorPayload.building_number = buildingIndex;
        const floorLayout = writeLayoutFile(floorPayload);
        writeLayoutRelationship(buildingLayout.id, floorLayout.id);

        const floorRooms = Array.isArray(floor.rooms) ? floor.rooms : [];
        let roomCounter = 0;
        floorRooms.forEach((room) => {
          const roomCount =
            room && room.count != null ? Number(room.count) : 1;
          const spaceType =
            room && room.space_type ? room.space_type : "Room";
          for (let i = 0; i < roomCount; i++) {
            roomCounter++;
            const roomIndex = `${floorIndexSegment}.${roomCounter}`;
            const roomPayload = baseLayoutPayload(parcelId, sourceHttp);
            roomPayload.space_type = spaceType;
            roomPayload.space_type_index = roomIndex;
            roomPayload.size_square_feet =
              room && room.size_square_feet != null
                ? room.size_square_feet
                : null;
            roomPayload.is_finished =
              room && room.is_finished != null ? Boolean(room.is_finished) : true;
            roomPayload.is_exterior =
              room && room.is_exterior != null
                ? Boolean(room.is_exterior)
                : false;
            roomPayload.building_number = buildingIndex;
            const roomLayout = writeLayoutFile(roomPayload);
            writeLayoutRelationship(floorLayout.id, roomLayout.id);
          }
        });
      });

      if (rooms.length) {
        let roomCounter = 0;
        rooms.forEach((room) => {
          const roomCount =
            room && room.count != null ? Number(room.count) : 1;
          const spaceType =
            room && room.space_type ? room.space_type : "Room";
          for (let i = 0; i < roomCount; i++) {
            roomCounter++;
            const subIndex = `${buildingIndex}.${roomCounter}`;
            const roomPayload = baseLayoutPayload(parcelId, sourceHttp);
            roomPayload.space_type = spaceType;
            roomPayload.space_type_index = subIndex;
            roomPayload.size_square_feet =
              room && room.size_square_feet != null
                ? room.size_square_feet
                : null;
            roomPayload.is_finished =
              room && room.is_finished != null ? Boolean(room.is_finished) : true;
            roomPayload.is_exterior =
              room && room.is_exterior != null
                ? Boolean(room.is_exterior)
                : false;
            roomPayload.building_number = buildingIndex;
            const roomLayout = writeLayoutFile(roomPayload);
            writeLayoutRelationship(buildingLayout.id, roomLayout.id);
          }
        });
      }
    } else {
      const typeCounters = new Map();
      rooms.forEach((room) => {
        const roomCount = room && room.count != null ? Number(room.count) : 1;
        const spaceType =
          room && room.space_type ? room.space_type : "Room";
        for (let i = 0; i < roomCount; i++) {
          const current = typeCounters.get(spaceType) || 0;
          const next = current + 1;
          typeCounters.set(spaceType, next);
          const subIndex = `${buildingIndex}.${next}`;
          const roomPayload = baseLayoutPayload(parcelId, sourceHttp);
          roomPayload.space_type = spaceType;
          roomPayload.space_type_index = subIndex;
          roomPayload.size_square_feet =
            room && room.size_square_feet != null
              ? room.size_square_feet
              : null;
          roomPayload.is_finished =
            room && room.is_finished != null ? Boolean(room.is_finished) : true;
          roomPayload.is_exterior =
            room && room.is_exterior != null ? Boolean(room.is_exterior) : false;
          roomPayload.building_number = buildingIndex;
          const roomLayout = writeLayoutFile(roomPayload);
          writeLayoutRelationship(buildingLayout.id, roomLayout.id);
        }
      });
    }
  });

  return { buildingLayouts };
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
    if ((th || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($(tr).find("td span"));
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
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

function attemptWriteAddress(unnorm, secTwpRng, propertySeed) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return false;

  const countyName = (unnorm && unnorm.county_jurisdiction
    ? unnorm.county_jurisdiction.trim()
    : "") || null;
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnorm && unnorm.source_http_request) ||
    null;
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnorm && unnorm.request_identifier) ||
    null;

  const address = {
    unnormalized_address: full,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    source_http_request: sourceHttp,
    request_identifier: requestIdentifier,
    county_name: countyName,
    country_code: "US",
  };

  writeJSON(path.join("data", "address.json"), address);
  return true;
}

function writeGeometry(unnorm, propertySeed) {
  if (!unnorm) return false;
  const hasLat = Object.prototype.hasOwnProperty.call(unnorm, "latitude");
  const hasLon = Object.prototype.hasOwnProperty.call(unnorm, "longitude");
  if (!hasLat || !hasLon) return false;

  const lat = Number(unnorm.latitude);
  const lon = Number(unnorm.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnorm && unnorm.source_http_request) ||
    null;
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnorm && unnorm.request_identifier) ||
    null;

  const geometry = {
    latitude: lat,
    longitude: lon,
    source_http_request: sourceHttp,
    request_identifier: requestIdentifier,
  };
  writeJSON(path.join("data", "geometry.json"), geometry);

  removeMatchingDataFiles(/^relationship_address_has_geometry\.json$/);
  removeMatchingDataFiles(/^relationship_address_geometry\.json$/);
  writeRelationship("address.json", "geometry.json");
  return true;
}

function writeStructures(parcelId, buildingLayouts, propertySeed, unnormalized) {
  const structures = readJSON(path.join("owners", "structure_data.json"));
  if (!structures) return;
  const key = `property_${parcelId}`;
  const record = structures[key];
  if (!record) return;

  removeMatchingDataFiles(/^structure_\d+\.json$/);
  removeMatchingDataFiles(/^structure\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_has_structure_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_layout_\d+_structure_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_property_has_structure_\d+\.json$/);
  removeMatchingDataFiles(/^relationship_property_structure_\d+\.json$/);

  const buildingMap = new Map();
  (buildingLayouts || []).forEach((b) => {
    buildingMap.set(b.building_index, b);
  });
  const totalBuildings = buildingMap.size;

  const buildingEntries = Array.isArray(record.buildings)
    ? record.buildings
    : [];
  const propertyEntries = Array.isArray(record.property_structures)
    ? record.property_structures
    : [];
  const extraEntries = Array.isArray(record.extra_feature_structures)
    ? record.extra_feature_structures
    : [];

  let structureCounter = 0;
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;

  const createStructure = (entry) => {
    structureCounter++;
    const { building_index, ...rest } = entry || {};
    const payload = {
      ...rest,
      request_identifier: parcelId,
      source_http_request: sourceHttp,
    };
    const file = `structure_${structureCounter}.json`;
    writeJSON(path.join("data", file), payload);
    return { id: structureCounter, file, building_index };
  };

  const linkStructureToLayout = (layoutId, structureId) => {
    writeRelationship(`layout_${layoutId}.json`, `structure_${structureId}.json`);
  };

  const linkStructureToProperty = (structureId) => {
    writeRelationship("property.json", `structure_${structureId}.json`);
  };

  buildingEntries.forEach((entry) => {
    const structure = createStructure(entry);
    const buildingIndex =
      entry && entry.building_index ? entry.building_index : null;
    const layoutRef = buildingIndex ? buildingMap.get(buildingIndex) : null;
    if (layoutRef && layoutRef.layout_id) {
      linkStructureToLayout(layoutRef.layout_id, structure.id);
    } else if (
      buildingEntries.length === 1 &&
      totalBuildings > 1 &&
      !buildingIndex
    ) {
      linkStructureToProperty(structure.id);
    } else if (totalBuildings === 1 && buildingMap.size === 1) {
      const onlyLayout = Array.from(buildingMap.values())[0];
      if (onlyLayout && onlyLayout.layout_id) {
        linkStructureToLayout(onlyLayout.layout_id, structure.id);
      } else {
        linkStructureToProperty(structure.id);
      }
    } else {
      linkStructureToProperty(structure.id);
    }
  });

  propertyEntries.forEach((entry) => {
    const structure = createStructure(entry);
    linkStructureToProperty(structure.id);
  });

  extraEntries.forEach((entry) => {
    const structure = createStructure(entry);
    linkStructureToProperty(structure.id);
  });
}

function writePropertyImprovements($, parcelId, propertySeed, unnormalized) {
  const table = $("#ctlBodyPane_ctl13_ctl01_grdPermits");
  if (!table.length) return;
  const rows = table.find("tbody tr");
  if (!rows.length) return;

  const improvements = [];
  const sourceHttp =
    (propertySeed && propertySeed.source_http_request) ||
    (unnormalized && unnormalized.source_http_request) ||
    null;

  rows.each((_, tr) => {
    const $tr = $(tr);
    if ($tr.hasClass("footable-detail-row")) return;
    const cells = $tr.find("th, td");
    if (!cells.length) return;
    const permitNumber = textOf($(cells[0]));
    if (!permitNumber) return;
    const typeText = textOf($(cells[1]));
    const activeText = textOf($(cells[3]));
    const issueDateText = textOf($(cells[4]));
    const valueText = textOf($(cells[5]));

    improvements.push({
      permit_number: permitNumber || null,
      improvement_type: mapPermitImprovementType(typeText),
      improvement_action: mapPermitImprovementAction(typeText),
      improvement_status: mapPermitStatus(activeText),
      permit_issue_date: parseDateToISO(issueDateText),
      fee: parseCurrencyToNumber(valueText),
      request_identifier: parcelId,
      contractor_type: null,
      completion_date: null,
      application_received_date: null,
      permit_required: true,
      source_http_request: sourceHttp,
    });
  });

  if (!improvements.length) return;

  removeMatchingDataFiles(/^property_improvement_\d+\.json$/);
  removeMatchingDataFiles(
    /^relationship_property_has_property_improvement_\d+\.json$/,
  );
  removeMatchingDataFiles(
    /^relationship_property_property_improvement_\d+\.json$/,
  );

  improvements.forEach((imp, idx) => {
    const fileName = `property_improvement_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), imp);
    writeRelationship("property.json", fileName);
  });
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
  if (parcelId) writeProperty($, parcelId);

  const sales = extractSales($);
  const saleFiles = writeSalesDeedsFilesAndRelationships(
    sales,
    parcelId,
    propertySeed,
    unnormalized,
  );

  writeTaxes($);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(
      parcelId,
      sales,
      saleFiles,
      propertySeed,
      unnormalized,
    );
    const layoutContext = writeLayout(parcelId, propertySeed, unnormalized);
    writeUtility(
      parcelId,
      layoutContext.buildingLayouts,
      propertySeed,
      unnormalized,
    );
    writeStructures(
      parcelId,
      layoutContext.buildingLayouts,
      propertySeed,
      unnormalized,
    );
    writePropertyImprovements($, parcelId, propertySeed, unnormalized);
    // writeOwnersCurrentAndRelationships(parcelId);
    // writeHistoricalBuyerPersonsAndRelationships(parcelId, sales);
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  const wroteAddress = attemptWriteAddress(
    unnormalized,
    secTwpRng,
    propertySeed,
  );
  if (wroteAddress) {
    writeGeometry(unnormalized, propertySeed);
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
