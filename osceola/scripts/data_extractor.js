#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const propertyTypeMapping = [
  {
    "property_usecode": "0001 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0011 - VACANT-IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101 - SINGLE FAMILY-VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0111 - SINGLE FAMILY-IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0201 - MOBILE HME-VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0211 - MOBILE HME-IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0311 - MULTI-FAMILY - 10- 50 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0312 - MULTI-FAMILY - 51 units or more",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0313 - MULTI-FAMILY - LIHTC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0314 - DORMITORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0315 - STUDENT HOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0316 - APARTMENT CONVERSION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0341 - APARTMENT CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0342 - APARTMENT CONDO COMMON ELEMENTS IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0343 - APARTMENT CONDO COMMON ELEMENTS VAC",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0401 - CONDOMINIUM-VACANT",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0411 - CONDOMINIUM-IMPROVED",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0490 - TIMESHARE / CONDO VACAN",
    "ownership_estate_type": "Timeshare",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0491 - TIMESHARE / CONDO IMPROVED",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0492 - TIMESHARE / CONDO COMMON ELEMENTS - IMP",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0493 - TIMESHARE / CONDO COMMON ELEMENTS - VA",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0501 - COOPERATIVES-VACANT",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0511 - COOPERATIVES-IMPROVED",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0611 - RETIREMENT HOMES - SINGLE FAM CONVERSION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0701 - MISCELLANEOUS-VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0711 - MISCELLANEOUS-IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801 - MULTI-FAMILY-VACANT less than 10 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0811 - MULTI-FAMILY-IMPROVED less than 10 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0901 - RESIDENTIAL COMMON ELEMENTS/AREA VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0911 - RESIDENTIAL COMMON ELEMENTS/AREA IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1001 - VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1003 - MULTI-FAMILY-VAC 10 units or more",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1004 - VACANT COMM CONDO SITE",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1006 - RETIREMENT HOMES-VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1011 - RETAIL VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1012 - STORE W/OFFICE OR RESIDENCE-VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1013 - DEPT. STORES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1014 - SUPERMARKET-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1015 - REGINL SHOPNG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1016 - COMMUNITY SHOP-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1017 - OFFICE BLDG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1018 - MULTI-STORY OFF-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1019 - PROFESS BLDG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1020 - TRANSIT TERMINAL-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1021 - RESTAURANT/CAFE-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1022 - DRIVE-IN REST-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1023 - FINANCIAL BLDG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1024 - INSURANCE CO-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1025 - REPAIR SERV-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1026 - SERVICE STA - VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1027 - VEH SALE/REPAIR-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1028 - PARKING/MH LOT-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1029 - WHOLESALE OUTLET-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1030 - FLORIST/GREENHS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1031 - DRIVE-IN/OPEN ST-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1032 - THEATER AUDITOR-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1033 - NIGHTCLUB/BARS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1034 - BOWL/SKATE/ARENA-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1035 - TOURIST ATTRACT-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1036 - CAMPS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1037 - RACE TRACKS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1038 - GOLF COURSES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1039 - HOTELS & MOTELS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1098 - VACANT COMMERCIAL RETENTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1099 - VACANT COMMERCIAL WITH XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1111 - RETAIL FREE STANDING 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1112 - RETAIL STRIP CENTER - MULTI TENANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1113 - RETAIL CONVENIENCE STORE (7-11, WAWA)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1121 - RETAIL PHARMACY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1201 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1211 - STORE W/OFFICE OR RESIDENCE/CONVERTED RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1240 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1241 - STOR/OFC/RES/CONDO-I",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1242 - STOR/OFC/RES/CONDO COMMON ELEMENTS - IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1243 - STOR/OFC/RES/CONDO COMMON ELEMENTS - VAC",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1311 - DEPT. STORES-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1401 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1411 - SUPERMARKET-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1501 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1511 - REGIONAL SHOPPING CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1611 - COMMUNITY SHOPPING CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1701 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1711 - SINGLE STORY OFFICE BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1712 - CONVERTED RESIDENCE SINGLE STORY OFFICE BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1801 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1811 - MULTI-STORY OFFICE BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1812 - CONVERTED RESIDENCE MULTI-STORY OFFICE BLDG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1901 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1911 - PROFESSIONAL SERVICE BLDG-MEDICAL,DENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "1940 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1941 - PROF OFC CONDO-IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1942 - PROF OFC CONDO COMMON ELEMENTS - IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1943 - PROF OFC CONDO COMMON ELEMENTS - VAC",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2001 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2011 - AIRPORTS/TRANSIT TERMINAL/MARINAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2101 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2111 - RESTAURANT/CAFE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2201 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2211 - DRIVE-IN REST-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2311 - FINANCIAL BLDG-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2401 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2411 - INSURANCE CO-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2501 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2511 - REPAIR SERVICE (NOT AUTO) LAUNDROMATS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2611 - SERVICE STATION - FULL OR SELF SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2701 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2711 - AUTO DEALERSHIP-SALES & SERVICE (RV & MOTORCYCLE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2712 - USED AUTO DEALER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2713 - TIRE/AUTO SERVICE FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2714 - GENERAL AUTO REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2715 - AUTO RENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2716 - CAR WASH AUTOMATIC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2717 - CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2801 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2811 - MOBILE HOME PARKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building"
  },
  {
    "property_usecode": "2812 - PARKING GARAGES/PAID PARKING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2813 - TOLL BOOTHS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2814 - PEDESTRIAN BRIDGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2901 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2911 - WHOLESALE OUTLET-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "3001 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3011 - FLORIST/GREENHS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3101 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3111 - DRIVE-IN THEATERS/OPEN STADIUMS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3201 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3211 - THEATER/ENCLOSED AUDITORIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3311 - NIGHTCLUB/BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3401 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3411 - BOWLING/SKATING/ENCLOSED ARENAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3501 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3511 - TOURIST ATTRACTION/ENTERTAINMENT FACILITIES(DINNER THEATER)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3611 - RV PARKS & CAMPGROUNDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3701 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3711 - RACE TRACKS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3801 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3811 - GOLF COURSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3812 - MINI GOLF, GOLF SCHOOL, STAND ALONE DRIVING RANGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3901 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3911 - HOTELS & MOTELS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3921 - MOTELS-S.F/APT-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3940 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "3941 - HOTEL/MOTL CONDO-IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3942 - HOTEL/MOTL CONDO COMMON ELEMENTS - IMP",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3943 - HOTEL/MOTL CONDO COMMON ELEMENTS - VAC",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4001 - VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4011 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4041 - LIGHT MFG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4042 - HEAVY MFG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4043 - LUMBER YARD-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4044 - PACKING PLANTS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4045 - CANNERIES/BOTTLE-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4046 - OTHER FOOD PROC-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4047 - MINERAL PROC-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4048 - WAREHSE.STG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4049 - OPEN STORAGE-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4099 - VACANT INDUSTRIAL WITH XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4101 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4111 - LIGHT MFG-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4201 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4211 - HEAVY MFG-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4311 - LUMBER YARD-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "4401 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4411 - PACKING PLANTS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "4501 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4511 - CANNERIES/BOTTLE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4611 - OTHER FOOD PROC-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4701 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4711 - CEMENT PLANT,MINERAL PROCESSING,REFINERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4811 - WAREHOUSE STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4812 - WAREHOUSE GENERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4813 - WAREHOUSE DISTRIBUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4820 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4821 - WAREHOUSE FLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4830 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4831 - SELF STORAGE/MINI WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4840 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4841 - WAREHOUSE CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4842 - WAREHOUSE CONDO COMMON ELEMENTS - IM",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4843 - WAREHOUSE CONDO COMMON ELEMENTS - VA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4901 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4911 - OPEN STORAGE,NEW & USED BUILDING SUPPLIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "4912 - AUTO SALVAGE & WRECKING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "5001 - IMPROVED AG-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5011 - IMPROVED AG-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5101 - CROPLAND CLASS 1-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5111 - CROPLAND CLASS 1-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5142 - CROPLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5201 - CROPLAND CLASS 2-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5211 - CROPLAND CLASS 2-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "Building"
  },
  {
    "property_usecode": "5242 - CROPLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5301 - CROPLAND CLASS 3-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5311 - CROPLAND CLASS 3-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "Building"
  },
  {
    "property_usecode": "5342 - CROPLAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5401 - TIMBERLAND 90+ VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5411 - TIMBERLAND 90+ IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5501 - TIMBERLAND 80-90-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5511 - TIMBERLAND 80-90-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5560 - TIMBER NURSURY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5565 - TIMBER PINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5601 - TIMBERLAND 70-79-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5611 - TIMBERLAND 70-79-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5660 - TIMBER NURSURY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5665 - TIMBER PINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5701 - TIMBERLAND 60-69-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5711 - TIMBERLAND 60-69-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5760 - TIMBER NURSURY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5765 - TIMBER PINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5767 - TIMBER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5801 - TIMBERLAND 50-59-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5811 - TIMBERLAND 50-59-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5901 - TIMBERLND UNCLAS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5911 - TIMBERLND UNCLAS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6001 - PASTURELAND 1-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6011 - PASTURELAND 1-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6045 - SPECIAL PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6046 - COMMERCIAL SOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HayMeadow",
    "property_type": "Building"
  },
  {
    "property_usecode": "6047 - COMMERCIAL HAY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HayMeadow",
    "property_type": "Building"
  },
  {
    "property_usecode": "6050 - SWAMP WASTELAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "6051 - SWAMPS & MARSH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "6052 - NATIVE PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NativePasture",
    "property_type": "Building"
  },
  {
    "property_usecode": "6053 - SEMI IMPROVED PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "Building"
  },
  {
    "property_usecode": "6054 - IMPROVED PASTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ImprovedPasture",
    "property_type": "Building"
  },
  {
    "property_usecode": "6059 - REC WATER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "6100 - DO NOT USE/PASTURELAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6101 - PASTURELAND 2-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6111 - PASTURELAND 2-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6201 - PASTURELAND 3-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6211 - PASTURELAND 3-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6301 - PASTURELAND 4-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6311 - PASTURELAND 4-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6401 - PASTURELAND 5-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6411 - PASTURELAND 5-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6501 - PASTURELAND 6-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6511 - PASTURELAND 6-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6601 - ORCHARDS,GROVES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6611 - ORCHARDS,GROVES-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "6630 - ORANGE GROVE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "6631 - MIXED CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "6632 - TANGERINE - GRAPEFRUIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "6633 - GRAPEFRUIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "6634 - CITRUS ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "6701 - PLTRY,BEES,FISH-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6711 - PLTRY,BEES,FISH-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "6801 - DAIRIES,FEEDLOTS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6811 - DAIRIES,FEEDLOTS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6901 - ORNAMENTALS,MISC-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6911 - ORNAMENTALS,MISC-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "property_usecode": "6936 - NURSURY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "6938 - ORNAMENTALS, MISC AG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "property_usecode": "6944 - SERVICE ACREAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "6948 - AGRICULTURAL SPECIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "7001 - VACANT INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7011 - VAC INSTITUT-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7071 - CHURCHES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7072 - PRIVATE SCHOOLS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7073 - PRIVATE HOSP-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7074 - HOMES FOR AGED-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7075 - NON-PROFIT SERV-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7076 - MORTUARY/CEMETERY-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7077 - CLUB/LODGE/HALL-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7078 - REST HOMES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7079 - CULTURAL GROUP-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7099 - VACANT INSTITUTIONAL WITH XFOB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7101 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7111 - CHURCHES-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7120 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "7121 - CHURCH-DAYCARE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7131 - CHURCH-RESIDENTIAL-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7201 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7211 - PRIVATE SCHOOLS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7220 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "7221 - PRIV.SCH.DAYCARE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7301 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7311 - PRIVATE HOSP-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7401 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7411 - HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "7412 - ASSISTED LIVING FACILITIES (ALF)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "7501 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7511 - NON-PROFIT SERV-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7601 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7611 - MORTUARY/CEMETERY-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7701 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7711 - CLUB/LODGE/HALL-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7801 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7811 - NURSING HOMES/RE-HAB CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "7901 - LEGACY CODE - DO NOT USE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7911 - CULTURAL GROUP-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8001 - GOVERNMENTAL - VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8011 - GOVERNMENTAL - IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8101 - MILITARY-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8111 - MILITARY-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "8201 - FOREST/PARK/REC-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8211 - FOREST/PARK/REC-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8301 - PUBLIC SCH-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8311 - PUBLIC SCH-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8401 - COLLEGES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8411 - COLLEGES-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8501 - HOSPITALS-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8511 - HOSPITALS-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8601 - COUNTY-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8611 - COUNTY-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8612 - COUNTY RECREATION TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8701 - STATE-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8711 - STATE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8712 - STATE RECREATION TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8801 - FEDERAL-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8811 - FEDERAL-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8812 - FEDERAL RECREATION TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8901 - MUNICIPAL-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8911 - MUNICIPAL-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8912 - MUNICIPAL RECREATION TRACKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9001 - LEASEHOLD INT-VAC",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9011 - LEASEHOLD INT-IMP",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "9101 - UTILITIES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9111 - UTILITIES-ELECTRIC, WATER & SEWER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "9112 - GAS PIPELINES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9113 - COMMUNICATIONS - CELL TOWER/RADIO/TV",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9114 - LOCALLY ASSESSED RAILROADS (NOT CENTRAL ASSD)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "Building"
  },
  {
    "property_usecode": "9201 - MINING-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9211 - MINING-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9301 - SUB-SURFACE RTS-VAC",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9311 - SUB-SURFACE RTS-IMP",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "9401 - RIGHT OF WAY-VAC",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9411 - RIGHT OF WAY-IMP",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "Building"
  },
  {
    "property_usecode": "9501 - RIVERS/LAKES-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9511 - RIVERS/LAKES-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "Building"
  },
  {
    "property_usecode": "9601 - WASTELAND/DUMP-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9611 - WASTELAND/DUMP-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9701 - REC/PARK LAND-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9711 - REC/PARK LAND-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "9801 - CENTRAL ASSESSD-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9811 - CENTRAL ASSESSD-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9901 - NO AG ACREAGE-VAC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9902 - NO AG ACREAGE-VAC-RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9910 - NO AG ACREAGE-VAC-COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9911 - NO AG ACREAGE-IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9940 - NO AG ACREAGE-VAC-INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  }
];

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanText(str) {
  if (str == null) return null;
  try {
    const $ = cheerio.load(String(str));
    return $.text().trim() || null;
  } catch (e) {
    return String(str);
  }
}

function ensureDirSync(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function trimStr(val) {
  return typeof val === "string" ? val.trim() : val;
}

function numOrNull(n) {
  return n === null || n === undefined || Number.isNaN(Number(n))
    ? null
    : Number(n);
}

function normalizeAreaValue(value) {
  if (value === null || value === undefined) return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  if (Math.abs(numericValue) < 10) return null;
  const asString = String(value).trim();
  if (/\d{2,}/.test(asString)) return asString;
  const rounded = Math.round(numericValue);
  return rounded >= 10 ? String(rounded) : null;
}

function writeJSON(p, obj) {
  ensureDirSync(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function extractAddress(parcelInfo, unnorm) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  const mailingAddress = parcelInfo["Mailing"];
  const siteAddress = parcelInfo["Situs"];
  if (mailingAddress) {
    const mailingAddressObj = {
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddress,
    };
    writeJSON(path.join("data", "mailing_address.json"), mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const latitude = parcelInfo["lat"] ? parcelInfo["lat"] : (unnorm && unnorm.latitude ? unnorm.latitude : null);
    const longitude = parcelInfo["lon"] ? parcelInfo["lon"] : (unnorm && unnorm.longitude ? unnorm.longitude : null);
    const addressObj = {
      county_name,
      latitude: latitude,
      longitude: longitude,
      unnormalized_address: siteAddress,
    };
    writeJSON(path.join("data", "address.json"), addressObj);
    writeJSON(path.join("data", "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  }
  return hasOwnerMailingAddress;
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

function mapDeedType(trns_cd, trans_dscr) {
  const code = (trns_cd || "").toUpperCase();
  const dscr = (trans_dscr || "").toUpperCase();
  // Check more specific strings first to avoid substring collisions
  if (code === "SW" || dscr.includes("SPECIAL WARRANTY DEED"))
    return "Special Warranty Deed";
  if (
    code === "WD" ||
    (dscr.includes("WARRANTY DEED") && !dscr.includes("SPECIAL WARRANTY DEED"))
  )
    return "Warranty Deed";
  if (code === "QC" || dscr.includes("QUIT CLAIM DEED"))
    return "Quitclaim Deed";
  if (
    code === "CD" ||
    dscr.includes("CORRECTIVE DEED") ||
    dscr.includes("CORRECTION DEED")
  )
    return "Correction Deed";
  return "Miscellaneous";
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

function writePersonCompaniesSalesRelationships(record, sales, hasOwnerMailingAddress) {
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
  }));
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = toDateOnly(rec.dos);
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

function main() {
  const dataDir = path.join("data");
  ensureDirSync(dataDir);

  // Read inputs
  const inputPath = "input.json";
  const addressPath = "address.json";
  const unnormalizedPath = "unnormalized_address.json"
  const parcelPath = "parcel.json";
  const ownersDir = "owners";
  const ownerDataPath = path.join(ownersDir, "owner_data.json");
  const utilitiesDataPath = path.join(ownersDir, "utilities_data.json");
  const layoutDataPath = path.join(ownersDir, "layout_data.json");
  const structureDataPath = path.join(ownersDir, "structure_data.json");

  const input = readJson(inputPath);
  let address = readJson(addressPath);
  if (!address) {
    address = readJson(unnormalizedPath);
  }
  if (!address) {
    throw new Error("Address file not found");
  }
  const parcel = readJson(parcelPath);
  const ownerData = readJson(ownerDataPath);
  const utilitiesData = readJson(utilitiesDataPath);
  const structureData = readJson(structureDataPath);
  const layoutData = readJson(layoutDataPath);
  const parcelInfo = input.ParcelInformation || {};
  const pResp =
      (parcelInfo.response &&
        parcelInfo.response.value &&
        parcelInfo.response.value[0]) ||
      null;
  const strap = cleanText(pResp.dsp_strap) || cleanText(pResp.strap) || "unknown";
  const key = `property_${strap.trim()}`;
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  let util = null;
  if (utilitiesData) {
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }

  const isMulti = Object.values(input || {}).some(
    (v) =>
      v &&
      typeof v === "object" &&
      "source_http_request" in v &&
      "response" in v,
  );
  let ownerHasMailingAddress = false;
  // Property from ParcelInformation
  try {
    const pReq = parcelInfo.source_http_request || null;
    const pResp =
      (parcelInfo.response &&
        parcelInfo.response.value &&
        parcelInfo.response.value[0]) ||
      null;
    if (pResp) {
      ownerHasMailingAddress = extractAddress(pResp, address);
      const strap = trimStr(
        pResp.strap ||
          pResp.Strap ||
          (parcel && parcel.parcel_identifier) ||
          "",
      );
      const dorCode = pResp.dorCode || pResp.prevDorCode || null;
      const propertyMapping = mapPropertyTypeFromUseCode(dorCode);
      if (!propertyMapping) {
        throw new Error("Property type not found");
      }
      const out = {
        source_http_request: isMulti ? pReq : undefined,
        parcel_identifier: strap,
        property_legal_description_text: pResp.Legals || null,
        property_type: propertyMapping.property_type,
        ownership_estate_type: propertyMapping.ownership_estate_type,
        build_status: propertyMapping.build_status,
        structure_form: propertyMapping.structure_form,
        property_usage_type: propertyMapping.property_usage_type,
        subdivision: pResp.subName || null,
        property_structure_built_year: pResp.ayb ?? null,
        property_effective_built_year: pResp.eyb ?? null,
        area_under_air: normalizeAreaValue(pResp.HeatedArea),
        livable_floor_area: null,
        total_area: normalizeAreaValue(pResp.grossBldArea),
        number_of_units: pResp.livunits ?? null,
        number_of_units_type: null,
        zoning: null,
      };
      // Clean undefined to satisfy additionalProperties false
      Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
      fs.writeFileSync(
        path.join(dataDir, "property.json"),
        JSON.stringify(out, null, 2),
      );
    }
  } catch (err) {
    // If enum mapping fails, output the error as JSON to stdout and stop
    if (err && err.type === "error") {
      console.error(JSON.stringify(err, null, 2));
      process.exit(1);
    } else {
      throw err;
    }
  }

  // Lot from Land
  const land = input.Land || {};
  const landReq = land.source_http_request || null;
  const landRow =
    land.response && land.response.value && land.response.value[0];
  if (
    landRow ||
    (input.ParcelInformation && input.ParcelInformation.response)
  ) {
    let acres = null;
    const pResp = input.ParcelInformation?.response?.value?.[0] || {};
    if (typeof pResp.totalAcres === "number") acres = pResp.totalAcres;
    let lot_area_sqft = null;
    if (acres != null) lot_area_sqft = Math.round(acres * 43560);
    const lotOut = {
      source_http_request: isMulti ? landReq : undefined,
      lot_type: acres != null ? (acres > 0.25 ? "GreaterThanOneQuarterAcre" : "LessThanOrEqualToOneQuarterAcre") : null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_size_acre: acres,
      lot_area_sqft: lot_area_sqft && lot_area_sqft >= 1 ? lot_area_sqft : null,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null
    };
    Object.keys(lotOut).forEach(
      (k) => lotOut[k] === undefined && delete lotOut[k],
    );
    fs.writeFileSync(
      path.join(dataDir, "lot.json"),
      JSON.stringify(lotOut, null, 2),
    );
  }

  // Tax from ValuesAndTax
  const valuesAndTax = input.ValuesAndTax || {};
  const taxReq = valuesAndTax.source_http_request || null;
  const taxRows = (valuesAndTax.response && valuesAndTax.response.value) || [];
  let taxIndex = 1;
  for (const row of taxRows) {
    const taxOut = {
      source_http_request: isMulti ? taxReq : undefined,
      tax_year: row.tax_yr ?? null,
      property_assessed_value_amount: numOrNull(row.asd_val),
      property_market_value_amount: numOrNull(row.jst_val),
      property_building_amount: numOrNull(row.tot_bld_val),
      property_land_amount: numOrNull(row.tot_lnd_val),
      property_taxable_value_amount: numOrNull(row.tax_val),
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    Object.keys(taxOut).forEach(
      (k) => taxOut[k] === undefined && delete taxOut[k],
    );
    fs.writeFileSync(
      path.join(dataDir, `tax_${taxIndex}.json`),
      JSON.stringify(taxOut, null, 2),
    );
    taxIndex++;
  }

  // Sales from SalesHistory
  const sales = input.SalesHistory || {};
  const salesReq = sales.source_http_request || null;
  const salesRows = (sales.response && sales.response.value) || [];
  let saleIdx = 1;
  for (const row of salesRows) {
    const dateOnly = toDateOnly(row.dos);
    const saleOut = {
      source_http_request: isMulti ? salesReq : undefined,
      ownership_transfer_date: dateOnly,
    };
    // Include price only if > 0 to satisfy currency format
    if (row.price && Number(row.price) > 0) {
      saleOut.purchase_price_amount = Number(row.price);
    }
    Object.keys(saleOut).forEach(
      (k) => saleOut[k] === undefined && delete saleOut[k],
    );
    const salePath = path.join(dataDir, `sales_${saleIdx}.json`);
    fs.writeFileSync(salePath, JSON.stringify(saleOut, null, 2));
    saleIdx++;
  }

  // Deeds mapped from sales rows, and relationships use row index to avoid mismatches
  let deedIdx = 1;
  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    const deedType = mapDeedType(row.trns_cd, row.trans_dscr);
    const deedOut = {
      source_http_request: isMulti ? salesReq : undefined,
      deed_type: deedType,
    };
    if (row.or_bk) {
      deedOut.book = row.or_bk;
    }
    if (row.or_pg) {
      deedOut.page = row.or_pg;
    }
    const deedPath = path.join(dataDir, `deed_${deedIdx}.json`);
    fs.writeFileSync(deedPath, JSON.stringify(deedOut, null, 2));

    // Relationship sales -> deed using the sale row index
    const saleFile = `./sales_${i + 1}.json`;
    const rel = {
      from: { "/": saleFile },
      to: { "/": `./deed_${deedIdx}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_sales_deed_${deedIdx}.json`),
      JSON.stringify(rel, null, 2),
    );
    if (deedOut.book && deedOut.page) {
      const fileUrl = `https://officialrecords.osceolaclerk.org/browserviewpa/viewer.aspx?book=${deedOut.book}&page=${deedOut.page}&booktype=O`;
      const fileOut = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name: `Deed ${deedOut.book}/${deedOut.page}`,
        original_url: fileUrl,
      };
      const filePath = path.join(dataDir, `file_${deedIdx}.json`);
      fs.writeFileSync(filePath, JSON.stringify(fileOut, null, 2));
      const relDeedFile = {
        to: { "/": `./file_${deedIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_deed_file_${deedIdx}.json`),
        JSON.stringify(relDeedFile, null, 2),
      );
    }
    deedIdx++;
  }
  // Owners: create company files and relationships to sales
  if (ownerData) {
    const ownersPayload = ownerData[key];
    writePersonCompaniesSalesRelationships(ownersPayload, salesRows, ownerHasMailingAddress);
  }
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
