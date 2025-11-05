const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping =[
  {
    "property_usecode": "0000 VACANT RESIDENTIAL < 20 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0006 VACANT TOWNHOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0008 VACANT MH/CONDO COOP",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0029 PUBLIC LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0040 VACANT CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0044 CONDO GARAGE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0045 CONDO CABANA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0100 SINGLE FAMILY R",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0102 SFR BLD ARND MH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0106 TOWNHOUSE/VILLA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0111 NEW RES PERMIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "UnderConstruction",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 MH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0300 MFR >9 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0309 MFR- Live Local Act",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0310 MFR CLASS A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0320 MFR CLASS B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0330 MFR CLASS C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0340 MFR CLASS D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0350 MFR CLASS E",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0396 STUDENT HOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0397 RURAL DEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0398 HUD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0399 LIHTC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0400 CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0403 CONDO APARTMENT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0408 MH CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0500 COOPERATIVE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0501 FLORIDA'S LIGHT AND LIFE PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0508 MH CO-OP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0600 RETIREMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0610 ALF A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0611 ILF A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0620 ALF B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0621 ILF B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0630 ALF C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0631 ILF C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0640 ALF D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0641 ILF D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0650 NURSING A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0660 NURSING B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0670 NURSING C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0680 NURSING D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "0700 MISC RESIDENTIA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 MFR <10 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801 MULTI RES DWELLINGS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0901 RESIDENTIAL HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0902 CONDO HOA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0903 TOWNHOUSE HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0910 HOA ROW",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1000 VACANT COMM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1003 VACANT MULTI FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1005 Vacant ProPark Pad",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1040 VACANT COMM HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1050 VACANT PRO-PARK COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1099 VACANT COMM CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 STORE, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1105 DRUGSTORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1110 1 STY STORE A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1120 1STY STORE B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1130 1 STY STORE C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1140 RETAIL SERVICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1199 1 STY RETAIL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1200 MIXED USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1201 MIXED USE RES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1203 MIXED USE MULTI FAM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1211 MIXED USE RETAIL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1217 MIXED USE OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1227 MIXED USE AUTO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1228 MIXED USE MH PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "1239 MIXED USE MOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "1248 MIXED USE WAREHSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 DEPT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1305 MALL ANCHORS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1310 BIG-BOX STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1320 WAREHSE DEPT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
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
    "property_usecode": "1410 CONV STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1420 CONV STORE/GAS A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1421 Conv Store /Gas B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1422 Conv Store /Gas C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1423 Conv Store /Gas D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1510 REGIONAL MALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 SH CTR CMMITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1610 SH CTR CMMITY A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1620 SH CTR CMMITY B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1630 STRIP CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 OFFICE 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1710 OFFICE 1 STY A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1720 OFFICE 1 STY B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1730 OFFICE 1 STY C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1740 OFFICE 1 STY D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1750 PRO-PARK OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1751 PRO-PARK MEDICAL OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1799 OFFICE 1 STY CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1800 OFF MULTISTORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1810 OFF MULT-STY A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1820 OFF MULT-STY B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1830 OFF MULT-STY C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1840 OFF MULT-STY D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1850 BROADCASTING FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1851 ProPark Off Multistory",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1899 OFF MULTI-STY CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1900 MEDICAL OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1910 MEDICAL OFF A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1920 MEDICAL OFF B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1930 MEDICAL OFF C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1940 MEDICAL OFF D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1999 MEDICAL OFF CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "MedicalOffice",
    "property_type": "Unit"
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
    "property_usecode": "2010 MARINAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "2020 BOAT SLIPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2101 RESTAURANT A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2102 RESTAURANT B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2103 RESTAURANT C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2104 RESTAURANT D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200 Quick Service Restaurant",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2201 Quick Service Restaurant A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2202 Quick Service Restaurant B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2203 Quick Service Restaurant C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 FINANCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 REPAIR SER SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2501 SERV SHOP A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2502 SERV SHOP B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2503 SERV SHOP C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2504 SERV SHOP D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 AUTOMOTIVE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2701 AUTO DEALERSHIP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2702 AUTO SALES B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2703 AUTO SALES C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2704 AUTO SALES D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2710 FULL SERVICE CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "2720 SELF SERVICE CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2751 AUTO REPAIR A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2752 AUTO REPAIR B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2753 AUTO REPAIR C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2754 AUTO REPAIR D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2755 VEHICLE SALVAGE/STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2756 FUELING STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2757 MINI-LUBE GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2799 Garage Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2800 Parking Lot (surface lot)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "2805 Parking Garage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2810 MOBILE HOME PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2811 MHP A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2812 MHP B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2813 MHP C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2814 MHP D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2815 MIGRANT HOUSING > 9 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "2820 RV PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2899 COMMERCIAL CONDO PARKING",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3100 DRV-IN THEATER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 THEATER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 NIGHT CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 BOWLING ALLEY/SKATE RINK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3500 TOURIST ATTRAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3700 RACETRACK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "3800 REG GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3810 PRIVATE GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3820 SEMI-PRIVATE GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3830 DAILY FEE/MUNI GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3840 EXEC/PRACTICE GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3900 HOTELS/MOTELS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3911 FULL SERV A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3912 FULL SERV B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3913 FULL SERV C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3914 FULL SERV D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3921 LMTD SERV A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3922 LMTD SERV B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3923 LMTD SERV C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3924 LMTD SERV D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3931 EXTEND STAY A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3932 EXTEND STAY B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3933 EXTEND STAY C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3934 EXTEND STAY D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "4000 VACANT INDUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100 LIGHT MFG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4101 LIGHT MFG A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4102 LIGHT MFG B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4103 LIGHT MFG C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4104 LIGHT MFG D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 LUMBER YD/MILL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
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
    "property_usecode": "4500 BOTTLER/CANNERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4600 FOOD PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700 MIN PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 WAREH/DIST TERM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801 Storage Warehouse A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4802 Storage Warehouse B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4803 Storage Warehouse C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804 Storage Warehouse D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4810 WAREHOUSE A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4811 TRKG TERM A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4812 TRKG TERM B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4813 TRKG TERM C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4814 TRKG TERM D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4820 WAREHOUSE B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4830 WAREHOUSE C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4840 WAREHOUSE D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4850 FLEX SERV A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4860 FLEX SERV B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4870 FLEX SERV C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4880 FLEX SERV D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4891 MINI WARE A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4892 MINI WARE B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4893 MINI WARE C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4894 MINI WARE D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4899 INDUSTRIAL CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4900 OPEN STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "4901 BUILDING MATERIALS STORAGE - NEW AND USED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "4902 GAS & OIL STORAGE AND DISTRIBUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "4903 SCRAP METAL/MATERIALS RECYCLING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "4904 OUTDOOR PUBLIC STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "4905 EQUIPMENT STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "5100 CROPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5900 TIMBER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 ORCHARD/CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 POUL/BEES/FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6800 DAIRIES/FEEDLTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 PLANT NURSERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6910 MISC AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
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
    "property_usecode": "7101 CHURCH PARSONAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7150 Church ProPark Office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 PRIVATE SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7210 DAY CARE CENTER A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7220 DAY CARE CENTER B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7230 DAY CARE CENTER C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7240 DAYCARE CENTER D",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7250 PRIVATE COLLEGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300 HOSPITAL/PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7301 Emergency Only Hospital",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7302 Surgery Center",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "7310 REHAB HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 HOME FOR AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7406 HOME FOR AGED UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7408 CCRC UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500 NON-PROFIT SERV",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7501 Non-Profit Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7503 NON-PROFIT APTS.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7506 NON-PROFIT RETIREMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7517 NON-PROFIT OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7519 NON-PROFIT MEDICAL OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "7525 NON-PROFIT SERVICE SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7548 NON-PROFIT WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7550 Non-Profit ProPark",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600 FUNERAL HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7610 CEMETERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700 CLB/LDG/UN HALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7704 HOA COMMERCIAL CLUBHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7710 FITNESS CENTER - A",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "7720 FITNESS CENTER - B",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "7730 FITNESS CENTER - C",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "8000 VACANT GOVERNMENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
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
    "property_usecode": "8200 PARKS AND RECREATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8300 PUBLIC SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 COLLEGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8510 HOSPITAL GOVT OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600 COUNTY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8610 COUNTY ROW",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8660 TRANSIT AUTHORITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "8670 PORT AUTHORITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "8680 AVIATION AUTH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "8690 SPORTS AUTH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
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
    "property_usecode": "8703 STATE - APTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8710 STATE ROW",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8717 STATE - OFFICE 1 STY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "8718 STATE - OFFICE MULTISTORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "8739 STATE  - HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "8748 STATE - WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
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
    "property_usecode": "8810 FEDERAL ROW",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
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
    "property_usecode": "8910 MUNICPAL ROW",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9011 LEASEHOLD - RETAIL",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "9013 LEASEHOLD - DEPT STORE",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "9015 LEASEHOLD - REGIONAL MALL",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "9016 Leasehold - Multi-tenant Retail",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "9018 LEASEHOLD - OFFICE MULTISTORY",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "9020 LEASED/STATE",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9021 LEASEHOLD - RESTAURANT",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "9025 LEASED/FAIR AUTHORITY",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9030 LEASED/COUNTY",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9039 LEASEHOLD - HOTEL",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "9040 LEASED/TPA",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9048 LEASEHOLD - WAREHOUSE",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "9050 LEASED/PC",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9060 LEASED/TT",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9070 LEASED/PORT",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9080 LEASED/AVIATION",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9085 LEASEHOLD - HOSPITAL",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "9090 LEASED/SPORTS",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "9100 UTILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9200 MING/PET/GASLND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9300 SUBSURF RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9400 RIGHT-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9600 WETLANDS/LOWLANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800 CENTRALLY ASSD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9900 VACANT ACREAGE > 20 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9929 PUBLIC LANDS > 20 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  }
]

const propertyTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }
  const normalizedUseCode = entry.property_usecode.replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedUseCode) {
    return lookup;
    }
  lookup[normalizedUseCode] = entry.property_type ?? null;
  return lookup;
}, {});

const ownershipEstateTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.ownership_estate_type ?? null;
  return lookup;
}, {});

const buildStatusByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.build_status ?? null;
  return lookup;
}, {});

const structureFormByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.structure_form ?? null;
  return lookup;
}, {});

const propertyUsageTypeByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) return lookup;
  const normalizedUseCode = entry.property_usecode.replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedUseCode) return lookup;
  lookup[normalizedUseCode] = entry.property_usage_type ?? null;
  return lookup;
}, {});


function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        emptyDir(fp);
        fs.rmdirSync(fp);
      } else {
        fs.unlinkSync(fp);
      }
    } catch (e) {
      /* ignore */
    }
  });
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}


function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  
  // Try exact match first
  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
  }
  
  // Try partial match on numeric code
  const numericMatch = normalizedInput.match(/^\d{4}/);
  if (numericMatch) {
    const numericCode = numericMatch[0];
    for (const key in propertyTypeByUseCode) {
      if (key.startsWith(numericCode)) {
        return propertyTypeByUseCode[key];
      }
    }
  }
  return null;
}



function mapOwnershipEstateTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  
  if (Object.prototype.hasOwnProperty.call(ownershipEstateTypeByUseCode, normalizedInput)) {
    return ownershipEstateTypeByUseCode[normalizedInput];
  }
  
  const numericMatch = normalizedInput.match(/^\d{4}/);
  if (numericMatch) {
    const numericCode = numericMatch[0];
    for (const key in ownershipEstateTypeByUseCode) {
      if (key.startsWith(numericCode)) {
        return ownershipEstateTypeByUseCode[key];
      }
    }
  }
  return null;
}

function mapBuildStatusFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  
  if (Object.prototype.hasOwnProperty.call(buildStatusByUseCode, normalizedInput)) {
    return buildStatusByUseCode[normalizedInput];
  }
  
  const numericMatch = normalizedInput.match(/^\d{4}/);
  if (numericMatch) {
    const numericCode = numericMatch[0];
    for (const key in buildStatusByUseCode) {
      if (key.startsWith(numericCode)) {
        return buildStatusByUseCode[key];
      }
    }
  }
  return null;
}

function mapStructureFormFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  
  if (Object.prototype.hasOwnProperty.call(structureFormByUseCode, normalizedInput)) {
    return structureFormByUseCode[normalizedInput];
  }
  
  const numericMatch = normalizedInput.match(/^\d{4}/);
  if (numericMatch) {
    const numericCode = numericMatch[0];
    for (const key in structureFormByUseCode) {
      if (key.startsWith(numericCode)) {
        return structureFormByUseCode[key];
      }
    }
  }
  return null;
}

function mapPropertyUsageTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  
  if (Object.prototype.hasOwnProperty.call(propertyUsageTypeByUseCode, normalizedInput)) {
    return propertyUsageTypeByUseCode[normalizedInput];
  }
  
  const numericMatch = normalizedInput.match(/^\d{4}/);
  if (numericMatch) {
    const numericCode = numericMatch[0];
    for (const key in propertyUsageTypeByUseCode) {
      if (key.startsWith(numericCode)) {
        return propertyUsageTypeByUseCode[key];
      }
    }
  }
  return null;
}

function cleanText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCurrency(value) {
  if (!value) return null;
  const normalized = cleanText(value).replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseNumeric(value) {
  if (value == null) return null;
  const normalized = cleanText(value).replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function extractTaxYear($) {
  const yearText = cleanText(
    $("div.value-summary-years span[data-bind*='displayedTaxYear']").text(),
  );
  const match = yearText.match(/(20\d{2})/);
  return match ? match[1] : null;
}

function extractTaxTableRow($) {
  const rows = $("h4.section-header")
    .filter((_, el) => /value summary/i.test($(el).text()))
    .nextAll("div")
    .first()
    .find("tbody tr");
  let countyRow = null;
  rows.each((_, tr) => {
    const $tr = $(tr);
    const district = cleanText($tr.find("td").first().text());
    if (/county/i.test(district)) {
      countyRow = $tr;
      return false;
    }
  });
  return countyRow;
}

function extractTaxes($) {
  const taxRow = extractTaxTableRow($);
  if (!taxRow || !taxRow.length) return null;

  const cells = taxRow.find("td");
  if (cells.length < 5) return null;

  return {
    tax_year: extractTaxYear($),
    property_market_value_amount: parseCurrency($(cells[1]).text()),
    property_assessed_value_amount: parseCurrency($(cells[2]).text()),
    property_taxable_value_amount: parseCurrency($(cells[4]).text()),
    property_land_amount: null,
    property_building_amount: null,
    monthly_tax_amount: null,
    period_end_date: null,
    period_start_date: null,
    yearly_tax_amount: null,
  };
}

function formatSaleDate(monthText, yearText) {
  const year = cleanText(yearText);
  if (!year) return null;
  const month = cleanText(monthText);
  const monthNumber =
    month && /\d+/.test(month) ? String(parseInt(month, 10)).padStart(2, "0") : "01";
  return `${year}-${monthNumber}-01`;
}

function extractSalesHistoryEntries($) {
  const container = $("h4")
    .filter((_, el) => /sales history/i.test($(el).text()))
    .nextAll("div")
    .first();
  if (!container.length) return [];

  const rows = container.find("tbody tr");
  const entries = [];

  rows.each((index, row) => {
    const $row = $(row);
    const cells = $row.find("td");
    if (!cells.length) return;

    const bookLink = cells.eq(0).find("a").attr("href") || null;
    let bookPageText = cleanText(cells.eq(0).text().replace(/Confidential$/i, ""));
    bookPageText = bookPageText.replace(/\s*Confidential$/i, "").trim();
    let book = null;
    let page = null;
    const bookMatch = bookPageText.match(/(\d+)\s*\/\s*(\d+)/);
    if (bookMatch) {
      book = String(bookMatch[1]);
      page = String(bookMatch[2]);
    }

    const instrumentLink = cells.eq(1).find("a").attr("href") || null;
    let instrumentNumber = cleanText(
      cells.eq(1).text().replace(/Confidential$/i, ""),
    );
    if (!instrumentNumber) instrumentNumber = null;

    const monthText = cells.eq(2).text();
    const yearText = cells.eq(3).text();
    const deedTypeRaw = cleanText(cells.eq(4).text());
    const priceAmount = parseCurrency(cells.eq(7).text());

    entries.push({
      sale: {
        ownership_transfer_date: formatSaleDate(monthText, yearText),
        purchase_price_amount: priceAmount
      },
      deed: {
        deed_type: mapDeedType(deedTypeRaw),
        book: book,
        page: page,
        instrument_number: instrumentNumber,
      },
      file: {
        original_url: instrumentLink || bookLink || null,
        book,
        page,
      },
    });
  });

  return entries;
}

function writeSalesHistoryArtifacts($, seed, dataDir, appendSourceInfo) {
  const entries = extractSalesHistoryEntries($);

  entries.forEach((entry, idx) => {
    const index = idx + 1;
    const saleFile = `sales_history_${index}.json`;
    const deedFile = `deed_${index}.json`;
    const fileFile = `file_${index}.json`;

    const saleObj = {
      ...appendSourceInfo(seed),
      ownership_transfer_date: entry.sale.ownership_transfer_date ?? null,
      purchase_price_amount: entry.sale.purchase_price_amount ?? null,
    };
    writeJson(path.join(dataDir, saleFile), saleObj);

    const deedObj = {
      ...appendSourceInfo(seed),
      ...(entry.deed.deed_type && { deed_type: entry.deed.deed_type }),
      ...(entry.deed.book && { book: String(entry.deed.book) }),
      ...(entry.deed.page && { page: String(entry.deed.page) }),
      ...(entry.deed.instrument_number && { instrument_number: entry.deed.instrument_number }),
    };
    writeJson(path.join(dataDir, deedFile), deedObj);

    const relSD = {
      from: { "/": `./${saleFile}` },
      to: { "/": `./${deedFile}` }
    };
    writeJson(
      path.join(dataDir, `relationship_sales_history_has_deed_${index}.json`),
      relSD,
    );

    const fileObj = {
      ...appendSourceInfo(seed),
      document_type: "Title",
      original_url: entry.file.original_url ?? null,
    };
    writeJson(path.join(dataDir, fileFile), fileObj);

    const relDF = {
      from: { "/": `./${deedFile}` },
      to: { "/": `./${fileFile}` }
    };
    writeJson(
      path.join(dataDir, `relationship_deed_has_file_${index}.json`),
      relDF,
    );
  });

  return entries;
}

function mapImprovementType(description) {
  const text = cleanText(description).toLowerCase();
  if (!text) return "GeneralBuilding";

  if (/pool|spa/.test(text)) return "PoolSpaInstallation";
  if (/roof/.test(text)) return "Roofing";
  if (/demolition|demo/.test(text)) return "Demolition";
  if (/fence/.test(text)) return "Fencing";
  if (/dock|seawall|shore|pier/.test(text)) return "DockAndShore";
  if (/hvac|mechanical/.test(text)) return "MechanicalHVAC";
  if (/electric/.test(text)) return "Electrical";
  if (/plumb/.test(text)) return "Plumbing";
  if (/gas/.test(text)) return "GasInstallation";
  if (/irrigation/.test(text)) return "LandscapeIrrigation";
  if (/screen/.test(text)) return "ScreenEnclosure";
  if (/shutter|awning/.test(text)) return "ShutterAwning";
  if (/addition|renovation|remodel|alteration|improv/.test(text))
    return "BuildingAddition";
  if (/construct|build/.test(text)) return "ResidentialConstruction";
  if (/window|door|exterior/.test(text)) return "ExteriorOpeningsAndFinishes";
  if (/site|grading|driveway/.test(text)) return "SiteDevelopment";
  if (/well/.test(text)) return "WellPermit";

  return "GeneralBuilding";
}

function extractPropertyImprovements($, seed, dataDir, appendSourceInfo) {
  const rows = $("table.permitinfo tbody tr");
  rows.each((idx, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("td");
    if (!cells.length) return;

    const permitNumber = cleanText(cells.eq(1).text());
    if (!permitNumber) return;

    const description = cleanText(cells.eq(2).text());
    const issueDate = cleanText(cells.eq(3).text());
    const permitUrl = cells.eq(1).find("a").attr("href") || null;

    const improvementObj = {
      ...appendSourceInfo(seed),
      improvement_type: mapImprovementType(description),
      improvement_status: "Permitted",
      completion_date: toISODate(issueDate) || null,
      contractor_type: "Unknown",
      permit_required: true,
      permit_number: permitNumber,
      permit_issue_date: toISODate(issueDate) || null,
    };

    const improvementFileName = `property_improvement_${idx + 1}.json`;
    writeJson(path.join(dataDir, improvementFileName), improvementObj);

    // if (permitUrl) {
    //   const fileFileName = `property_improvement_file_${idx + 1}.json`;
    //   const fileObj = {
    //     ...appendSourceInfo(seed),
    //     document_type: "Title",
    //     file_format: null,
    //     ipfs_url: null,
    //     name: `Permit ${permitNumber}`,
    //     original_url: permitUrl,
    //   };
    //   writeJson(path.join(dataDir, fileFileName), fileObj);

    //   const relationship = {
    //     from: { "/": `./${improvementFileName}` },
    //     to: { "/": `./${fileFileName}` },
    //   };
    //   writeJson(
    //     path.join(dataDir, `relationship_property_improvement_file_${idx + 1}.json`),
    //     relationship,
    //   );
    // }
  });
}

function extractLot($, seed, dataDir, appendSourceInfo) {
  const rows = $(
    "div[data-bind='visible: landLines().length > 0'] tbody tr",
  );
  if (!rows.length) return;

  let totalAcres = 0;
  let totalSquareFeet = 0;
  let lotFrontage = null;
  let lotDepth = null;

  rows.each((idx, tr) => {
    const $tr = $(tr);
    const unitType = cleanText(
      $tr.find("[data-bind='text: publicLandType']").text(),
    );
    const units = parseNumeric(
      $tr.find("[data-bind='text: publicUnits']").text(),
    );
    const frontage = parseNumeric(
      $tr.find("[data-bind='text: frontage']").text(),
    );
    const depth = parseNumeric(
      $tr.find("[data-bind='text: depth']").text(),
    );

    if (idx === 0) {
      lotFrontage = frontage;
      lotDepth = depth;
    }

    if (unitType && /ac/i.test(unitType)) {
      if (units != null) totalAcres += units;
    } else if (units != null && /sq|sf|square/i.test(unitType)) {
      totalSquareFeet += units;
    }
  });

  if (totalAcres === 0 && totalSquareFeet === 0) return;

  let lotSizeAcre = null;
  if (totalAcres > 0) {
    lotSizeAcre = totalAcres;
  } else if (totalSquareFeet > 0) {
    lotSizeAcre = totalSquareFeet / 43560;
  }

  const lotAreaSqft =
    lotSizeAcre != null ? Math.round(lotSizeAcre * 43560) : null;

  let lotType = null;
  if (lotSizeAcre != null) {
    lotType =
      lotSizeAcre > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre";
  }

  const lotObj = {
    ...appendSourceInfo(seed),
    lot_type: lotType,
    lot_size_acre:
      lotSizeAcre != null ? Number(lotSizeAcre.toFixed(4)) : null,
    lot_area_sqft: lotAreaSqft,
    lot_length_feet:
      lotFrontage != null && lotFrontage > 0 ? Math.round(lotFrontage) : null,
    lot_width_feet:
      lotDepth != null && lotDepth > 0 ? Math.round(lotDepth) : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    paving_area_sqft: null,
    paving_installation_date: null,
    paving_type: "None",
    site_lighting_fixture_count: null,
    site_lighting_installation_date: null,
    site_lighting_type: "None",

  };

  writeJson(path.join(dataDir, "lot.json"), lotObj);
}

function extractSectionTownshipRange(propertyIdentifier) {
  const result = { section: null, township: null, range: null };
  if (!propertyIdentifier) return result;

  const normalized = String(propertyIdentifier).toUpperCase().replace(/\s+/g, "");

  const match = normalized.match(/^[A-Z]?[-]?(\d{2})-(\d{2})-(\d{2})/);
  if (match) {
    result.section = match[1];
    result.township = match[2];
    result.range = match[3];
    return result;
  }

  const digitsOnly = normalized.replace(/[^0-9]/g, "");
  if (digitsOnly.length >= 6) {
    result.section = digitsOnly.slice(0, 2);
    result.township = digitsOnly.slice(2, 4);
    result.range = digitsOnly.slice(4, 6);
  }
  return result;
}

function toISODate(mmddyyyy) {
  if (!mmddyyyy) return null;
  const m = mmddyyyy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}


const layoutsPath = path.join("owners", "layout_data.json");
const seed = readJSON("property_seed.json");
const appendSourceInfo = (seed) => ({
  source_http_request: {
    method: "GET",
    url: seed?.source_http_request?.url || null,
  },
  request_identifier: seed?.request_identifier || seed?.parcel_id || "",
  });

try {
  layoutsData = readJSON(layoutsPath);
} catch (e) {}


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
    console.log("INSIDE")
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
      writeJson(path.join("data", `structure_${struct.structure_index || idx + 1}.json`), structureOut);
      
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
      writeJson(
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
      writeJson(path.join("data", `utility_${util.utility_index || idx + 1}.json`), utilityOut);
      
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
      writeJson(
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
      writeJson(path.join("data", `layout_${idx + 1}.json`), out);
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
            writeJson(
              path.join("data", `relationship_layout_${buildingNumber}_has_layout_${subLayoutIndex}.json`),
              relationship
            );
          }
        });
      }
    });
  }


}

function normalizeOwnerKey(o) {
  if (!o) return null;
  const fn = (o.first_name || "").trim().toLowerCase();
  const mn = (o.middle_name || "").trim().toLowerCase();
  const ln = (o.last_name || "").trim().toLowerCase();
  return [fn, mn, ln].filter(Boolean).join("|");
}

function normalizeCompanyKey(o) {
  if (!o) return null;
  const name = (o.name || "").trim().toLowerCase();
  return name || null;
}


// function parseFullAddress(full) {
//   // Example: "7405 MIRACLE LN ODESSA, FL 33556-4117"
//   if (!full) return {};

//   // Clean up the input
//   let raw = full.replace(/\r/g, "").trim();
//   raw = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();

//   let street_number = null;
//   let street_name = null;
//   let street_suffix_type = null;
//   let city_name = null;
//   let state_code = null;
//   let postal_code = null;
//   let plus_four_postal_code = null;

//   // Try multiple regex patterns to match different formats
//   const m =
//       raw.match(
//           /^(\d+)\s+([^,]+?)\s+([A-Za-z]+)\s*,\s*([A-Z\s\-']+)\s*,?\s*([A-Z]{2})\s*,?\s*(\d{5})(?:-?(\d{4}))?$/i,
//       ) ||
//       raw.match(
//           /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*,\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?$/i,
//       ) ||
//       raw.match(
//           /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*([A-Z]{2})\s*,\s*(\d{5})(?:-?(\d{4}))?$/i,
//       );

//   if (m) {
//     street_number = m[1];
//     street_name = (m[2] || "").trim().replace(/\s+/g, " ").toUpperCase();
//     street_suffix_type = (m[3] || "").trim();
//     city_name = (m[4] || "").trim().toUpperCase();
//     state_code = (m[5] || "").trim().toUpperCase();
//     postal_code = (m[6] || "").trim();
//     plus_four_postal_code = (m[7] || "").trim() || null;
//   } else {
//     // Fallback: try to parse by splitting on commas
//     const parts = raw.split(",");
//     if (parts.length >= 2) {
//       const street = parts[0].trim();
//       const cityStateZip = parts.slice(1).join(",").trim();

//       // Parse street
//       const streetParts = street.split(/\s+/);
//       if (streetParts.length > 0) {
//         street_number = streetParts[0];
//         if (streetParts.length > 1) {
//           street_suffix_type = streetParts[streetParts.length - 1];
//           street_name = streetParts.slice(1, -1).join(" ").toUpperCase();
//         }
//       }

//       // Parse city, state, zip
//       const stateZipMatch = cityStateZip.match(/([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?/i);
//       if (stateZipMatch) {
//         state_code = stateZipMatch[1].toUpperCase();
//         postal_code = stateZipMatch[2];
//         plus_four_postal_code = stateZipMatch[3] || null;
//         // Extract city (everything before state/zip)
//         city_name = cityStateZip.replace(stateZipMatch[0], "").trim().toUpperCase();
//       }
//     }
//   }

//   // Comprehensive suffix mapping (use the same as Lake County script)
//   const suffixMap = {
//     STREET: "St",
//     ST: "St",
//     AVENUE: "Ave",
//     AVE: "Ave",
//     BOULEVARD: "Blvd",
//     BLVD: "Blvd",
//     ROAD: "Rd",
//     RD: "Rd",
//     LANE: "Ln",
//     LN: "Ln",
//     DRIVE: "Dr",
//     DR: "Dr",
//     COURT: "Ct",
//     CT: "Ct",
//     PLACE: "Pl",
//     PL: "Pl",
//     TERRACE: "Ter",
//     TER: "Ter",
//     CIRCLE: "Cir",
//     CIR: "Cir",
//     WAY: "Way",
//     LOOP: "Loop",
//     PARKWAY: "Pkwy",
//     PKWY: "Pkwy",
//     PLAZA: "Plz",
//     PLZ: "Plz",
//     TRAIL: "Trl",
//     TRL: "Trl",
//     BEND: "Bnd",
//     BND: "Bnd",
//     CRESCENT: "Cres",
//     CRES: "Cres",
//     MANOR: "Mnr",
//     MNR: "Mnr",
//     SQUARE: "Sq",
//     SQ: "Sq",
//     CROSSING: "Xing",
//     XING: "Xing",
//     PATH: "Path",
//     RUN: "Run",
//     WALK: "Walk",
//     ROW: "Row",
//     ALLEY: "Aly",
//     ALY: "Aly",
//     BEACH: "Bch",
//     BCH: "Bch",
//     BRIDGE: "Br",
//     BRG: "Br",
//     BROOK: "Brk",
//     BRK: "Brk",
//     BROOKS: "Brks",
//     BRKS: "Brks",
//     BUG: "Bg",
//     BG: "Bg",
//     BUGS: "Bgs",
//     BGS: "Bgs",
//     CLUB: "Clb",
//     CLB: "Clb",
//     CLIFF: "Clf",
//     CLF: "Clf",
//     CLIFFS: "Clfs",
//     CLFS: "Clfs",
//     COMMON: "Cmn",
//     CMN: "Cmn",
//     COMMONS: "Cmns",
//     CMNS: "Cmns",
//     CORNER: "Cor",
//     COR: "Cor",
//     CORNERS: "Cors",
//     CORS: "Cors",
//     CREEK: "Crk",
//     CRK: "Crk",
//     COURSE: "Crse",
//     CRSE: "Crse",
//     CREST: "Crst",
//     CRST: "Crst",
//     CAUSEWAY: "Cswy",
//     CSWY: "Cswy",
//     COVE: "Cv",
//     CV: "Cv",
//     CANYON: "Cyn",
//     CYN: "Cyn",
//     DALE: "Dl",
//     DL: "Dl",
//     DAM: "Dm",
//     DM: "Dm",
//     DRIVES: "Drs",
//     DRS: "Drs",
//     DIVIDE: "Dv",
//     DV: "Dv",
//     ESTATE: "Est",
//     EST: "Est",
//     ESTATES: "Ests",
//     ESTS: "Ests",
//     EXPRESSWAY: "Expy",
//     EXPY: "Expy",
//     EXTENSION: "Ext",
//     EXT: "Ext",
//     EXTENSIONS: "Exts",
//     EXTS: "Exts",
//     FALL: "Fall",
//     FALL: "Fall",
//     FALLS: "Fls",
//     FLS: "Fls",
//     FLAT: "Flt",
//     FLT: "Flt",
//     FLATS: "Flts",
//     FLTS: "Flts",
//     FORD: "Frd",
//     FRD: "Frd",
//     FORDS: "Frds",
//     FRDS: "Frds",
//     FORGE: "Frg",
//     FRG: "Frg",
//     FORGES: "Frgs",
//     FRGS: "Frgs",
//     FORK: "Frk",
//     FRK: "Frk",
//     FORKS: "Frks",
//     FRKS: "Frks",
//     FOREST: "Frst",
//     FRST: "Frst",
//     FREEWAY: "Fwy",
//     FWY: "Fwy",
//     FIELD: "Fld",
//     FLD: "Fld",
//     FIELDS: "Flds",
//     FLDS: "Flds",
//     GARDEN: "Gdn",
//     GDN: "Gdn",
//     GARDENS: "Gdns",
//     GDNS: "Gdns",
//     GLEN: "Gln",
//     GLN: "Gln",
//     GLENS: "Glns",
//     GLNS: "Glns",
//     GREEN: "Grn",
//     GRN: "Grn",
//     GREENS: "Grns",
//     GRNS: "Grns",
//     GROVE: "Grv",
//     GRV: "Grv",
//     GROVES: "Grvs",
//     GRVS: "Grvs",
//     GATEWAY: "Gtwy",
//     GTWY: "Gtwy",
//     HARBOR: "Hbr",
//     HBR: "Hbr",
//     HARBORS: "Hbrs",
//     HBRS: "Hbrs",
//     HILL: "Hl",
//     HL: "Hl",
//     HILLS: "Hls",
//     HLS: "Hls",
//     HOLLOW: "Holw",
//     HOLW: "Holw",
//     HEIGHTS: "Hts",
//     HTS: "Hts",
//     HAVEN: "Hvn",
//     HVN: "Hvn",
//     HIGHWAY: "Hwy",
//     HWY: "Hwy",
//     INLET: "Inlt",
//     INLT: "Inlt",
//     ISLAND: "Is",
//     IS: "Is",
//     ISLANDS: "Iss",
//     ISS: "Iss",
//     ISLE: "Isle",
//     SPUR: "Spur",
//     JUNCTION: "Jct",
//     JCT: "Jct",
//     JUNCTIONS: "Jcts",
//     JCTS: "Jcts",
//     KNOLL: "Knl",
//     KNL: "Knl",
//     KNOLLS: "Knls",
//     KNLS: "Knls",
//     LOCK: "Lck",
//     LCK: "Lck",
//     LOCKS: "Lcks",
//     LCKS: "Lcks",
//     LODGE: "Ldg",
//     LDG: "Ldg",
//     LIGHT: "Lgt",
//     LGT: "Lgt",
//     LIGHTS: "Lgts",
//     LGTS: "Lgts",
//     LAKE: "Lk",
//     LK: "Lk",
//     LAKES: "Lks",
//     LKS: "Lks",
//     LANDING: "Lndg",
//     LNDG: "Lndg",
//     MALL: "Mall",
//     MEWS: "Mews",
//     MEADOW: "Mdw",
//     MDW: "Mdw",
//     MEADOWS: "Mdws",
//     MDWS: "Mdws",
//     MILL: "Ml",
//     ML: "Ml",
//     MILLS: "Mls",
//     MLS: "Mls",
//     MANORS: "Mnrs",
//     MNRS: "Mnrs",
//     MOUNT: "Mt",
//     MT: "Mt",
//     MOUNTAIN: "Mtn",
//     MTN: "Mtn",
//     MOUNTAINS: "Mtns",
//     MTNS: "Mtns",
//     OVERPASS: "Opas",
//     OPAS: "Opas",
//     ORCHARD: "Orch",
//     ORCH: "Orch",
//     OVAL: "Oval",
//     PARK: "Park",
//     PASS: "Pass",
//     PIKE: "Pike",
//     PLAIN: "Pln",
//     PLN: "Pln",
//     PLAINS: "Plns",
//     PLNS: "Plns",
//     PINE: "Pne",
//     PNE: "Pne",
//     PINES: "Pnes",
//     PNES: "Pnes",
//     PRAIRIE: "Pr",
//     PR: "Pr",
//     PORT: "Prt",
//     PRT: "Prt",
//     PORTS: "Prts",
//     PRTS: "Prts",
//     PASSAGE: "Psge",
//     PSGE: "Psge",
//     POINT: "Pt",
//     PT: "Pt",
//     POINTS: "Pts",
//     PTS: "Pts",
//     RADIAL: "Radl",
//     RADL: "Radl",
//     RAMP: "Ramp",
//     REST: "Rst",
//     RIDGE: "Rdg",
//     RDG: "Rdg",
//     RIDGES: "Rdgs",
//     RDGS: "Rdgs",
//     ROADS: "Rds",
//     RDS: "Rds",
//     RANCH: "Rnch",
//     RNCH: "Rnch",
//     RAPID: "Rpd",
//     RPD: "Rpd",
//     RAPIDS: "Rpds",
//     RPDS: "Rpds",
//     ROUTE: "Rte",
//     RTE: "Rte",
//     SHOAL: "Shl",
//     SHL: "Shl",
//     SHOALS: "Shls",
//     SHLS: "Shls",
//     SHORE: "Shr",
//     SHR: "Shr",
//     SHORES: "Shrs",
//     SHRS: "Shrs",
//     SKYWAY: "Skwy",
//     SKWY: "Skwy",
//     SUMMIT: "Smt",
//     SMT: "Smt",
//     SPRING: "Spg",
//     SPG: "Spg",
//     SPRINGS: "Spgs",
//     SPGS: "Spgs",
//     SQUARES: "Sqs",
//     SQS: "Sqs",
//     STATION: "Sta",
//     STA: "Sta",
//     STRAVENUE: "Stra",
//     STRA: "Stra",
//     STREAM: "Strm",
//     STRM: "Strm",
//     STREETS: "Sts",
//     STS: "Sts",
//     THROUGHWAY: "Trwy",
//     TRWY: "Trwy",
//     TRACE: "Trce",
//     TRCE: "Trce",
//     TRAFFICWAY: "Trfy",
//     TRFY: "Trfy",
//     TRAILER: "Trlr",
//     TRLR: "Trlr",
//     TUNNEL: "Tunl",
//     TUNL: "Tunl",
//     UNION: "Un",
//     UN: "Un",
//     UNIONS: "Uns",
//     UNS: "Uns",
//     UNDERPASS: "Upas",
//     UPAS: "Upas",
//     VIEW: "Vw",
//     VIEWS: "Vws",
//     VILLAGE: "Vlg",
//     VLG: "Vlg",
//     VILLAGES: "Vlgs",
//     VLGS: "Vlgs",
//     VALLEY: "Vl",
//     VLY: "Vl",
//     VALLEYS: "Vlys",
//     VLYS: "Vlys",
//     WAYS: "Ways",
//     VIA: "Via",
//     WELL: "Wl",
//     WL: "Wl",
//     WELLS: "Wls",
//     WLS: "Wls",
//     CROSSROAD: "Xrd",
//     XRD: "Xrd",
//     CROSSROADS: "Xrds",
//     XRDS: "Xrds",
//   };

//   if (street_suffix_type) {
//     const key = street_suffix_type.toUpperCase();
//     if (suffixMap[key]) {
//       street_suffix_type = suffixMap[key];
//     }
//   }

//   return {
//     street_number,
//     street_name,
//     street_suffix_type,
//     city_name,
//     state_code,
//     postal_code,
//     plus_four_postal_code,
//   };
// }

// function mapPropertyType(building, landUse) {
//   // First try to map from building type code
//   const buildingCode = building && building.type && building.type.code
//       ? building.type.code.trim()
//       : null;

//   if (buildingCode) {
//     const mapped = mapBuildingTypeCode(buildingCode);
//     if (mapped) return mapped;
//   }

//   // Fallback to land use code
//   const landUseCode = landUse && landUse.code
//       ? landUse.code.trim()
//       : null;

//   if (landUseCode) {
//     const mapped = mapLandUseCode(landUseCode);
//     if (mapped) return mapped;
//   }

//   // Final fallback: return description as-is
//   return building && building.type && building.type.description
//       ? building.type.description
//       : null;
// }

// function mapBuildingTypeCode(code) {
//   const mappings = {
//     '01': 'SingleFamily',
//     '02': 'ManufacturedHousing',  // Manufactured Home (AYB > 1976)
//     '03': 'Modular',
//     '08': 'MobileHome',  // Mobile Home (AYB < 1977)
//     '22': 'Apartment',
//     '23': 'Apartment',
//     '24': 'Townhouse',
//     '25': 'Condominium',
//     '27': 'Duplex',  // Duplex/Triplex/Quadplex
//     'NC01': 'SingleFamily',
//     'NC02': 'ManufacturedHousing',
//     'NC08': 'MobileHome',
//     'NC27': 'Duplex',
//   };

//   return mappings[code] || null;
// }

// function mapLandUseCode(code) {
//   const mappings = {
//     '0100': 'SingleFamily',  // SINGLE FAMILY R
//     '0102': 'SingleFamily',  // SFR BLD ARND MH
//     '0106': 'Townhouse',     // TOWNHOUSE/VILLA
//     '0200': 'MobileHome',    // MH
//     '0300': 'MultiFamilyMoreThan10',  // MFR >9 UNITS
//     '0310': 'MultiFamilyMoreThan10',  // MFR CLASS A
//     '0320': 'MultiFamilyMoreThan10',  // MFR CLASS B
//     '0330': 'MultiFamilyMoreThan10',  // MFR CLASS C
//     '0340': 'MultiFamilyMoreThan10',  // MFR CLASS D
//     '0350': 'MultiFamilyMoreThan10',  // MFR CLASS E
//     '0400': 'Condominium',
//     '0403': 'Condominium',   // CONDO APARTMENT
//     '0408': 'Condominium',   // MH CONDOMINIUM
//     '0500': 'Cooperative',
//     '0508': 'Cooperative',   // MH CO-OP
//     '0600': 'Retirement',
//     '0610': 'Retirement',    // ALF A
//     '0620': 'Retirement',    // ALF B
//     '0630': 'Retirement',    // ALF C
//     '0640': 'Retirement',    // ALF D
//     '0700': 'MiscellaneousResidential',
//     '0800': 'MultiFamilyLessThan10',  // MFR <10 UNITS
//     '0801': 'MultiFamilyLessThan10',  // MULTI RES DWELLINGS
//     '0901': 'ResidentialCommonElementsAreas',  // RESIDENTIAL HOA
//     '0902': 'ResidentialCommonElementsAreas',  // CONDO HOA
//     '0903': 'ResidentialCommonElementsAreas',  // TOWNHOUSE HOA
//     '1000': 'VacantLand',    // VACANT COMM
//     '0000': 'VacantLand',    // VACANT RESIDENTIAL < 20 AC
//     '9900': 'VacantLand',    // VACANT ACREAGE > 20 AC
//   };

//   return mappings[code] || null;
// }

function extractYearYYYY(dateStr) {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-/);
  if (iso) return Number(iso[1]);
  const us = dateStr.match(/\b(\d{4})\b$/);
  if (us) return Number(us[1]);
  return null;
}

function mapDeedType(code) {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  const lookup = {
    AA: "Assignment of Contract", // Assignment of Agreement
    AD: "Administrator's Deed",
    AG: "Contract for Deed",
    CD: "Correction Deed",
    CT: "Court Order Deed",
    DD: "Miscellaneous",
    FD: "Warranty Deed",
    GD: "Guardian's Deed",
    MD: "Special Master’s Deed",
    PR: "Personal Representative Deed",
    QC: "Quitclaim Deed",
    SD: "Sheriff's Deed",
    TD: "Tax Deed",
    TR: "Trustee's Deed",
    WD: "Warranty Deed",
  };
  if (lookup[c]) return lookup[c];
  return null;
}

function buildStructureFromInput(input) {
  const b =
    Array.isArray(input.buildings) && input.buildings.length
      ? input.buildings[0]
      : null;
  const ci = b && Array.isArray(b.constructionInfo) ? b.constructionInfo : [];
  const byElem = (code) =>
    ci.find(
      (x) => x.element && x.element.code && x.element.code.trim() === code,
    );
  const allByElem = (code) =>
    ci.filter(
      (x) => x.element && x.element.code && x.element.code.trim() === code,
    );

  const ar = byElem("AR");
  const ew = byElem("EW");
  const rs = byElem("RS");
  const rc = byElem("RC");
  const iw = byElem("IW");
  const ifs = allByElem("IF");
  const cls = byElem("01");

  // Architectural style
  let architectural_style_type = null;
  if (ar && ar.constructionDetail && ar.constructionDetail.description) {
    const d = ar.constructionDetail.description.toUpperCase();
    if (d.includes("CONTEMPORARY")) architectural_style_type = "Contemporary";
  }

  // Exterior wall material
  let exterior_wall_material_primary = null;
  if (ew && ew.constructionDetail && ew.constructionDetail.description) {
    const d = ew.constructionDetail.description.toUpperCase();
    if (d.includes("STUCCO")) exterior_wall_material_primary = "Stucco";
    else if (d.includes("BRICK")) exterior_wall_material_primary = "Brick";
    else if (d.includes("VINYL"))
      exterior_wall_material_primary = "Vinyl Siding";
    else if (d.includes("CONCRETE BLOCK"))
      exterior_wall_material_primary = "Concrete Block";
  }

  // Roof design type
  let roof_design_type = null;
  if (rs && rs.constructionDetail && rs.constructionDetail.description) {
    const d = rs.constructionDetail.description.toUpperCase();
    if (d.includes("GABLE") && d.includes("HIP"))
      roof_design_type = "Combination";
    else if (d.includes("GABLE")) roof_design_type = "Gable";
    else if (d.includes("HIP")) roof_design_type = "Hip";
  }

  // Roof covering material (enum list includes Architectural Asphalt Shingle)
  let roof_covering_material = null;
  if (rc && rc.constructionDetail && rc.constructionDetail.description) {
    const d = rc.constructionDetail.description.toUpperCase();
    if (d.includes("SHINGLE")) {
      // Prefer Architectural Asphalt Shingle as most common composition shingles
      roof_covering_material = "Architectural Asphalt Shingle";
    } else if (d.includes("METAL")) {
      roof_covering_material = "Metal Standing Seam";
    } else if (d.includes("TILE")) {
      roof_covering_material = "Concrete Tile";
    }
  }

  // Interior wall surface material primary
  let interior_wall_surface_material_primary = null;
  if (iw && iw.constructionDetail && iw.constructionDetail.description) {
    const d = iw.constructionDetail.description.toUpperCase();
    if (d.includes("DRYWALL"))
      interior_wall_surface_material_primary = "Drywall";
    else if (d.includes("PLASTER"))
      interior_wall_surface_material_primary = "Plaster";
  }

  // Flooring materials
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  if (ifs && ifs.length) {
    // If any 'Tile' present, map to Ceramic Tile as primary
    const hasTile = ifs.some(
      (x) =>
        x.constructionDetail &&
        String(x.constructionDetail.description || "")
          .toUpperCase()
          .includes("TILE"),
    );
    const hasCarpet = ifs.some(
      (x) =>
        x.constructionDetail &&
        String(x.constructionDetail.description || "")
          .toUpperCase()
          .includes("CARPET"),
    );
    if (hasTile) flooring_material_primary = "Ceramic Tile";
    if (hasCarpet) flooring_material_secondary = "Carpet";
  }

  // Roof material type (broad category)
  let roof_material_type = null;
  if (roof_covering_material && roof_covering_material.includes("Shingle"))
    roof_material_type = "Shingle";

  // Primary framing material (Class Concrete Block)
  let primary_framing_material = null;
  if (cls && cls.constructionDetail && cls.constructionDetail.description) {
    const d = cls.constructionDetail.description.toUpperCase();
    if (d.includes("CONCRETE BLOCK"))
      primary_framing_material = "Concrete Block";
  }

  // Build structure object ensuring all required fields exist
  const obj = {
    architectural_style_type: architectural_style_type,
    attachment_type: "Detached",
    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: flooring_material_primary,
    flooring_material_secondary: flooring_material_secondary,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: roof_covering_material,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: roof_design_type,
    roof_condition: null,
    roof_age_years:
      b && b.yearBuilt ? new Date().getFullYear() - Number(b.yearBuilt) : null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roof_material_type,
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
    primary_framing_material: primary_framing_material,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  return obj;
}

function extractLegalDescription($) {
  const legalLines = [];
  $("tbody[data-bind*='fullLegal'] tr").each((i, row) => {
    const text = $(row).find("td").last().text().trim();
    if (text) legalLines.push(text);
  });
  return legalLines.length > 0 ? legalLines.join(" ") : null;
}

function extractPropertyData($) {
  let propertyUse = null;
  let subdivision = null;
  let pin = null;
  let siteAddress = null;
  let mailingAddress = null;
  $("td").each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes("Property Use:")) {
      propertyUse = $(el).next().text().trim();
    } else if (text.includes("Subdivision:")) {
      subdivision = $(el).next().text().trim();
    } else if (text === "PIN:") {
      pin = $(el).next().text().trim();
    }
  });
  // Extract site address from specific element
  const siteAddressEl = $("h5:contains('Site Address')").next("p");
  if (siteAddressEl.length) {
    siteAddress = siteAddressEl.text().trim().replace(/\n/g, ' ');
  }
  // Extract mailing address from specific element
  const mailingAddressEl = $("h5:contains('Mailing Address')").next("p");
  if (mailingAddressEl.length) {
    mailingAddress = mailingAddressEl.text().trim().replace(/\n/g, ' ');
  }
  return { propertyUse, subdivision, pin, siteAddress, mailingAddress };
}

function extractSuffixFromOwnerString(ownerString, person) {
  if (!ownerString || !person) return null;
  // Look for a segment matching last + first, then detect JR/SR/II/III/IV
  const segments = ownerString
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const target = `${person.last_name} ${person.first_name}`
    .trim()
    .toUpperCase();
  const match = segments.find((seg) => seg.toUpperCase().startsWith(target));
  if (!match) return null;
  const up = match.toUpperCase();
  if (/(\s|^)JR\.?($|\s)/.test(up)) return "Jr.";
  if (/(\s|^)SR\.?($|\s)/.test(up)) return "Sr.";
  if (/(\s|^)II($|\s)/.test(up)) return "II";
  if (/(\s|^)III($|\s)/.test(up)) return "III";
  if (/(\s|^)IV($|\s)/.test(up)) return "IV";
  return null;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  // Clean output dir to avoid duplicate stale files
  emptyDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners, Utilities, Layout
  const ownersJsonPath = path.join("owners", "owner_data.json");
  const utilitiesJsonPath = path.join("owners", "utilities_data.json");
  const layoutsJsonPath = path.join("owners", "layout_data.json");
  const ownersData = fs.existsSync(ownersJsonPath)
    ? readJSON(ownersJsonPath)
    : {};
  const utilsData = fs.existsSync(utilitiesJsonPath)
    ? readJSON(utilitiesJsonPath)
    : {};
  const layoutsData = fs.existsSync(layoutsJsonPath)
    ? readJSON(layoutsJsonPath)
    : {};

  const appendSourceInfo = (seed) => ({
  source_http_request: {
    method: "GET",
    url: seed?.source_http_request?.url || null,
  },
  request_identifier: seed?.request_identifier || seed?.parcel_id || "",
  });

  // PROPERTY JSON
  const building =  null;
  const legalDesc = extractLegalDescription($) || null;
  const { propertyUse, subdivision, pin, siteAddress, mailingAddress } = extractPropertyData($);
  console.log("PIN>>",pin)
  const propertyIdentifier = pin || cleanText($("td[data-bind*='displayStrap']").text());
  console.log(propertyIdentifier);

  const property_type = mapPropertyTypeFromUseCode(propertyUse || "");
  // console.log("property_type>>",property_type);
  const ownership_estate_type=mapOwnershipEstateTypeFromUseCode(propertyUse || "");
  const build_status= mapBuildStatusFromUseCode(propertyUse || "");
  const structure_form = mapStructureFormFromUseCode(propertyUse || "");
  const property_usage_type = mapPropertyUsageTypeFromUseCode(propertyUse || "");
  console.log(propertyUse,property_type,ownership_estate_type,build_status,structure_form,property_usage_type)

  const { section, township, range } =
    extractSectionTownshipRange(propertyIdentifier);
  
  if (!property_type) {
    const error = {
      type: "error",
      message: `Unable to map property type from property use code.`,
      path: "property.property_type",
    };
    writeJson(path.join(dataDir, "error_property_type.json"), error);
  }

  const propertyObj = {
    ...appendSourceInfo(seed),
    parcel_identifier: propertyIdentifier,
    property_type: property_type,
    property_legal_description_text: legalDesc || "",
    subdivision: subdivision,
    ownership_estate_type: ownership_estate_type,
    build_status: build_status,
    structure_form:structure_form,
    property_usage_type:property_usage_type

  };
  console.log(propertyObj);
  writeJson(path.join(dataDir, "property.json"), propertyObj);

  // ADDRESS
  const addressToUse = siteAddress || unAddr.full_address;
  if (!addressToUse) {
    throw new Error("No address found in site address or unnormalized address");
  }
  // const parsed = parseFullAddress(addressToUse);
  const addressObj = {
    ...appendSourceInfo(seed),
    county_name: unAddr.county_jurisdiction || "Hillsborough",
    latitude: unAddr.latitude ?? null,
    longitude: unAddr.longitude ?? null,
    section: section,
    township: township,
    range: range,
    unnormalized_address: addressToUse
  };
  writeJson(path.join(dataDir, "address.json"), addressObj);


  //Mailing address file creation
  const mailingAddressOutput = {
    ...appendSourceInfo(seed),
    latitude: null,
    longitude: null,
    unnormalized_address: mailingAddress
  };
  writeJson(path.join(dataDir, "mailing_address.json"), mailingAddressOutput);


  //TAX FILES CREATION
  const taxData = extractTaxes($);
  if (taxData) {
    const taxObj = {
      ...appendSourceInfo(seed),
      ...taxData,
    };
    writeJson(path.join(dataDir, "tax_1.json"), taxObj);
  }

  //OWNERS CREATION
  console.log(ownersData)
  const ownersKey = `property_${propertyIdentifier}`;
  console.log(ownersKey)
  
  const ownersByDate = ownersData[ownersKey]?.owners_by_date || {};
  console.log(ownersByDate)
  const currentOwners = ownersByDate["current"] || [];
  console.log("Current",currentOwners);
  const combined = [...currentOwners];
  const uniquePersons = [];
  const uniqueCompanies = [];
  const seenPersons = new Set();
  const seenCompanies = new Set();
  let personFilesByKey = {};
  let companyFilesByKey = {};

  // console.log(combined)
  combined.forEach((o) => {
    if (o && o.type === "person") {
      const key = normalizeOwnerKey(o);
      if (key && !seenPersons.has(key)) {
        seenPersons.add(key);
        uniquePersons.push({ o, key });
      }
    } else if (o && o.type === "company") {
      const key = normalizeCompanyKey(o);
      if (key && !seenCompanies.has(key)) {
        seenCompanies.add(key);
        uniqueCompanies.push({ o, key });
      }
    }
  });
  // console.log(uniquePersons,uniqueCompanies)
  // Create person files
  uniquePersons.forEach((entry, idx) => {
    const o = entry.o;
    const person = {
      ...appendSourceInfo(seed),
      birth_date: null,
      first_name: o.first_name || "",
      last_name: o.last_name || "",
      middle_name: o.middle_name || null,
      prefix_name: o.prefix_name,
      suffix_name: o.suffix_name,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const pFile = `person_${idx + 1}.json`;
    writeJson(path.join(dataDir, pFile), person);
    personFilesByKey[entry.key] = pFile;
  });

  // Create company files
  uniqueCompanies.forEach((entry, idx) => {
    const o = entry.o;
    const company = {
      ...appendSourceInfo(seed),
      name: o.name || "",
    };
    const cFile = `company_${idx + 1}.json`;
    writeJson(path.join(dataDir, cFile), company);
    companyFilesByKey[entry.key] = cFile;
  });

  //OWNERS TO MAILING ADDRESS RELATIONSHIP FILE.
  let relIdx=0
  currentOwners.forEach((o) => {
    // console.log("relIdx",relIdx);
    if (o && o.type === "person") {
      const key = normalizeOwnerKey(o);
      const pf = personFilesByKey[key];
      if (pf) {
        relIdx += 1;
        const rel = {
          from: { "/": `./${pf}` },
          to: { "/": "./mailing_address.json" },
        };
        writeJson(
          path.join(dataDir, `relationship_person_has_mailing_address_${relIdx}.json`),
          rel,
        );
      }
    } else if (o && o.type === "company") {
      const key = normalizeCompanyKey(o);
      const cf = companyFilesByKey[key];
      if (cf) {
        relIdx += 1;
        const rel = {
          from: { "/": `./${cf}` },
          to: { "/": "./mailing_address.json" },
        };
        writeJson(
          path.join(dataDir, `relationship_company_has_mailing_address${relIdx}.json`),
          rel,
        );
      }
    }
  });  

  //------Structure (owners/structures_data.json)---------------
  createStructureFiles(seed,propertyIdentifier);

  // ---------- Utilities (owners/utilities_data.json) ----------
  createUtilitiesFiles(seed,propertyIdentifier);

  // ---------- Layouts (owners/layout_data.json) ----------
  createLayoutFiles(seed,propertyIdentifier);

  //--------Sales,deed,files file--------
  const salesEntries = writeSalesHistoryArtifacts(
    $,
    seed,
    dataDir,
    appendSourceInfo,
  );

  //--------Latest Sales to owners file--------------- 
  const latestSaleIdx = salesEntries.length > 0 ? 1 : null;
  if (latestSaleIdx && currentOwners.length > 0) {
    let relIdx = 0;
    currentOwners.forEach((o) => {
      if (o && o.type === "person") {
        const key = normalizeOwnerKey(o);
        const personFile = personFilesByKey[key];
        if (personFile) {
          relIdx += 1;
          const rel = {
            from: { "/": `./sales_history_${latestSaleIdx}.json` },
            to: { "/": `./${personFile}` }
          };
          writeJson(
            path.join(dataDir, `relationship_sales_history_has_person_${relIdx}.json`),
            rel,
          );
        }
      }else if (o && o.type === "company") {
          const key = normalizeCompanyKey(o);
          const companyFile = companyFilesByKey[key];
          if (companyFile) {
            relIdx += 1;
            const rel = {
              from: { "/": `./sales_history_${latestSaleIdx}.json` },
              to: { "/": `./${companyFile}` }
            };
            writeJson(
              path.join(dataDir, `relationship_sales_history_has_company_${relIdx}.json`),
              rel,
            );
          }
        }
    });
  }
 
 
  // Building permits -> property improvements
  extractPropertyImprovements($, seed, dataDir, appendSourceInfo);

  //Lot File creation
  extractLot($, seed, dataDir, appendSourceInfo);



}

main();
