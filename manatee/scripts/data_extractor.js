#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping = [
  {
    "property_usecode": "0000-VACANT RESIDENTIAL PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0001-VACANT RESIDENTIAL W\\/SITE AMEN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0002-VACANT MOBILE HOME LOT PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0003-MH LOT\\/VALUED VACANT\\/HAS IMPR.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0008-FUTURE DEVELOPMENT SITE-PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0009-VACANT RESIDENTIAL TRACT\\/UNUSABLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0010-VAC UNPLATTED <10 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0040-CONDO-VACANT LOT-UNBUILT UNITS",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0041-VACANT RES.LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0050-CO-OP:VALUED VACANT\\/HAS IMPR.",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0055-CO-OP-VACANT LOT",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0100-SINGLE FAMILY RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101-SFR-MODEL HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0105-SINGLE FAM RES\\/10+AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0108-HALF DUPLEX\\/PAIRED VILLA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0110-TOWNHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0164-UNINHABITABLE RES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0201-SINGLE WIDE MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingSingleWide",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0202-DOUBLE WIDE MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0203-TRIPLE WIDE+MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0210-MOBILE HOME ON 10+ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0264-UNINHABITABLE MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0300-GARDEN APTS.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0301-APARTMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0302-INCOME RESTRICTED APT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0400-CONDOMINIA IMPROVED",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0408-SINGLE FAMILY HOMES\\/CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0409-ATTACHED UNIT\\/LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0410-SINGLE FAMILY HOMES\\/LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0411-SINGLE WIDE MH\\/CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0412-DOUBLE WIDE MH\\/CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0413-TRIPLE WIDE MH\\/CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0464-CONDOMINIA UNINHABITABLE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0501-SINGLE WIDE MH\\/CO-OP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0502-DOUBLE WIDE MH\\/CO-OP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0503-TRIPLE WIDE MH\\/CO-OP",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0600-RETIREMENT HOMES NOT ELIGIBLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0700-MIGRANT CAMPS,BOARDING HOMES,MISC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0710-BED AND BREAKFAST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "0720-LAND CONDO RV PARK",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "0725-RES RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0730-RES AMENITIES ON 10+AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800-DUPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0801-TWO OR MORE HOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0803-MULTI-FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0805-HOUSE PLUS DUPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0864-UNINHABITABLE MULTI-FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0900-VACANT RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0901-IMPROVED RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0910-LIMITED COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "0938-GOLF COURSE&CLUB COMMON AR.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "0940-VACANT CONDO COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0941-IMPROVED CONDO COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1000-VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1001-VACANT COMMERCIAL W\\/IMPV",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1004-VACANT CONDOMINIA COMMERCIAL",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1009-VACANT NON-RESIDENTIAL\\/UNUSABLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1033-VAC COMMERCIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1040-VAC COMM.CONDO COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1041-VACANT COM.LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100-STORES,ONE UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1101-MULTIPLE UNIT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1102-RETAIL DRUGSTORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1103-RETAIL TIRE STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104-CONVENIENCE STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1105-CONVENIENCE STORE W\\/GAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1110-WAREHOUSE DISCOUNT STORES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1114-CONDOMINIA RETAIL STORE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1200-MIXED USE COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1205-MIXED USE COMM\\/RES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1230-COMMERCIAL RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1233-IMPROVED COMMERCIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1240-IMPROVED COMM.CONDO COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1264-UNINHABITABLE COMMERCIAL\\/INDUST.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300-DEPARTMENT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1400-SUPERMARKETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500-REGIONAL SHOPPING CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600-COMMUNITY SHOPPING CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1604-COMMUNITY CENTERS\\/CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700-OFFICE BUILDINGS-ONE STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1704-OFFICE CONDOMINIA UNIT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1710-OFFICE BUILDING\\/LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1800-OFFICE BUILDINGS-MULTI STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900-PROFESSIONAL SERVICE&MEDICAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "1904-OFFICE CONDOMINIA\\/MEDICAL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1910-PROFESSIONAL OFFICE\\/LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000-AIRPORTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2003-MARINAS\\/PIERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "2005-NON COMMERCIAL BOAT SLIPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "2010-CONDO DOCKS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100-RESTAURANTS,CAFETERIAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200-FAST FOOD\\/DRIVE IN RESTAURANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300-FINANCIAL INSTITUTIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500-REPAIR SERVICE SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600-SERVICE STATIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700-DEALERSHIP SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2710-USED CAR LOTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2720-REC VEHICLE\\/MH SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "2730-GARAGE\\/AUTO BODY\\/PAINT SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2740-MINI LUBE SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "2750-CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800-PARKING LOTS,COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2802-MOBILE HOME PARKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2805-RV PARKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2832-RENTAL PP MOBILE HOME ATTACHMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "2900-PRODUCE AND FISHHOUSES WHOLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000-FLORISTS,GREENHOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3100-DRIVE IN THEATRES,OPEN STAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200-ENCLOSED THEATRES\\/AUDITORIUMS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300-NIGHT CLUBS,LOUNGES,BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400-BOWLING,SKATING,POOL ENCLOSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3410-FITNESS CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3500-TOURIST ATTRACTION,EXHIBITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3510-ATHLETIC CENTERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600-CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3700-RACE TRACKS,HORSE\\/AUTO\\/DOG",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "3800-GOLF COURSES,DRIVING RANGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3810-GOLF COURSE SUPPORT FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3901-MOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3902-BUDGET\\/LIMITED SERVICE HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3903-MID-RANGE SERVICE HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3910-TIMESHARE",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "4000-VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4001-VACANT INDUSTRIAL W\\/IMPV",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100-LIGHT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4104-CONDO LIGHT INDUSTRIAL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "4200-HEAVY INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300-LUMBERYARDS,SAWMILLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400-PACKING FRUIT\\/VEGI\\/MEATS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "4500-CANNERIES FRUIT\\/VEGI\\/BOTTLERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "4600-OTHER FOOD PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700-MINERAL PROCESSING PHOSPHATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800-WAREHOUSING,DISTRIBUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4801-WAREHOUSING-MINISTORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4803-WAREHOUSING,FLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804-WAREHOUSING CONDOMINIA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4805-WAREHOUSING CONDO FLEX",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4810-WAREHOUSING\\/LAND CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900-OPEN STORAGE,SUPPLY\\/JUNKYARDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "5000-AG.LAND\\/IMP.W\\/SINGLE FAMILY RES.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "5010-AG.LAND\\/IMP.W\\/NON RES.BLDGS.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5020-AG.LAND\\/IMP.W\\/OBY 'S ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5030-AG.LAND\\/IMP. W\\/SFR & COMM.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "5040-AG.LAND\\/IMP. W\\/SOLAR FIELDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SolarFarm",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5100-CROPLAND, CLASS I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5350-SOD FARM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600-TIMBERLAND, INDEX 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000-GRAZING, CLASS I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600-ORCHARD, GROVES, CITRUS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6610-ORCHARD GROVES-ABANDONED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700-POULTRY, BEES, FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900-ORNAMENTALS, MISC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7000-VACANT INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100-CHURCH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7101-CHURCH RESIDENCES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200-PRIVATE SCHOOLS\\/COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7210-DAY CARE FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300-PRIVATELY OWNED HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400-HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500-ORPHANAGES, OTHER SERVICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600-CEMETERIES-NO VALUE REMAINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7601-CEMETERIES-VALUE REMAINING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7602-FUNERAL HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700-CLUBS, LODGES, UNION HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800-SANITARY, CONVALESCENT HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "7900-CULTURAL ORGANIZATION FACIL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8081-GOVT OWNED VACANT MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8082-GOVT OWNED VAC FOREST,PRKS,RECAREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8083-GOVT OWNED VAC PUBLIC CNTY SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8084-GOVT OWNED VACANT COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8085-GOVT OWNED VACANT HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8086-GOVT OWNED VACANT COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8087-GOVT OWNED VACANT STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8088-GOVT OWNED VACANT FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8089-GOVT OWNED VACANT MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8100-GOVT OWNED MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "8200-GOVT OWNED FOREST,PARKS,REC AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8300-GOVT OWNED PUBLIC COUNTY SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400-GOVT OWNED COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500-GOVT OWNED HOSPITALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600-COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8700-STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8800-FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8900-MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8901-SRQ AIRPORT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9000-LEASEHOLD INTERESTS, GOVT OWND",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9002-LEASEHOLD INT,GOVT OWND-LAND ONLY",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9100-UTILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9200-MINING, PETROLIUM\\/GAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9300-SUBSURFACE RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9400-PUBLIC RIGHT-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9401-PRIVATE RIGHT-OF-WAY",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9500-RIVERS, LAKES, SUBMERGED LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9501-SUBMERGED LAND-BOAT SLIP NO IMPR.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9600-SEWAGE DISPOSAL, SOLID WASTE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9700-OUTDOOR RECREATIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800-CENTRALLY ASSESSED\\/RAILROADS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9900-VACANT ACREAGE, NOT AG 10+ ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9901-VAC. ACR.,NOT AG 10+ AC. W\\/IMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9902-ACREAGE IMPROVED FOR CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "9908-FUTURE DEV. SITE-PLATTED 10+ AC.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9909-VACANT RES. TRACT\\/UNUSABLE 10+ AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  }
]

const permitTypeMapping = {
"MECHANICAL A/C CHANGE-OUT": "MechanicalHVAC",
"REROOF/ROOFING MEMBRANE": "Roofing",
"RESIDENTIAL (1 & 2) SINGLE DET": "ResidentialConstruction",
"RENOVATION PERMIT ADMIN (1&2)": "ResidentialConstruction",
"SWIMMING POOL": "PoolSpaInstallation",
"ALUMINUM SCREEN ROOM": "ScreenEnclosure",
"ALUMINUM POOL CAGE": "ScreenEnclosure",
"ROOFING SHINGLE": "Roofing",
"ZONING/FENCING/MISCELLANEOUS": "Fencing",
"ELECTRICAL RES ALTERATION": "Electrical",
"MECHANICAL": "MechanicalHVAC",
"NEW ADDITION (RESIDENTIAL)": "BuildingAddition",
"SEWER, INSTALL NEW/CHG SEPTIC": "UtilitiesConnection",
"BUILDING": "GeneralBuilding",
"MISCELLANEOUS": null,
"RES ALTERATION OR EXTENTION": "ResidentialConstruction",
"DOCK": "DockAndShore",
"PLUMBING": "Plumbing",
"ROOF RESIDENTIAL": "Roofing",
"NEW ADDITION (COMMERCIAL)": "BuildingAddition",
"RESIDENTIAL (1 & 2) SINGLE ATT": "ResidentialConstruction",
"MECHANICAL RESIDENTIAL": "MechanicalHVAC",
"MECHANICAL COMMERCIAL": "MechanicalHVAC",
"SOLAR HOT WATER SYSTEM": "Electrical",
"SIGN": null,
"SCREEN RM/PORCH/PATIO/GARAGE": "ScreenEnclosure",
"GENERATOR": "Electrical",
"DEMOLISH": "Demolition",
"RESIDENTIAL": "ResidentialConstruction",
"ACCESSORY BLD (COMM) CANOPY": "CommercialConstruction",
"REROOF": "Roofing",
"ELECTRICAL": "Electrical",
"WINDOW/DOOR UNDER 3 STORY": "ExteriorOpeningsAndFinishes",
"MOBILE HOME SET-UP": "MobileHomeRV",
"FENCE": "Fencing",
"PLUMBING RESIDENTIAL": "Plumbing",
"ALUMINUM ROOFOVER W/O GAS VENT": "Roofing",
"WINDOW/DOOR REPLACEMENT": "ExteriorOpeningsAndFinishes",
"RENOVATION BLD (1 & 2 FAMILY)": "ResidentialConstruction",
"SIGN ON SITE": null,
"RENOVATION PLB (1 & 2 FAMILY)": "Plumbing",
"SIGN BILLBOARD": null,
"MECHANICAL A/C CHANGE OUT": "MechanicalHVAC",
"NEW SINGLE FAMILY": "ResidentialConstruction",
"CONCRETE FOUNDATION": "GeneralBuilding",
"RENOVATION ELE (1 & 2 FAMILY)": "Electrical",
"MECHANICAL COMM DUCT SYS": "MechanicalHVAC",
"CONCRETE STRUCT SLAB/DRIVEWAY": "GeneralBuilding",
"ELECTRICAL SERVICE CHANGE": "Electrical",
"ROOF COMMERICIAL": "Roofing",
"RESIDENTIAL ALT ADD": "ResidentialConstruction",
"ALUMINUM SIDING/VINYL WINDOWS": "ExteriorOpeningsAndFinishes",
"ACCESSORY BLD(RES)UTL/BARN/SHD": "ResidentialConstruction",
"ALUMINUM CARPORT W/U-BLD": "GeneralBuilding",
"COMMERCIAL ALT ADD": "CommercialConstruction",
"NEW 1&2 FAMILY & TOWNHOUSE": "ResidentialConstruction",
"WINDOWS": "ExteriorOpeningsAndFinishes",
"ALUMINUM GLASS ROOM": "ScreenEnclosure",
"SPECIAL USE": null,
"SIDING, FASCIA, SOFFIT": "ExteriorOpeningsAndFinishes",
"RESIDENTIAL STRUCTURE": "ResidentialConstruction",
"ALUMINUM STRUCTURE": "GeneralBuilding",
"TREE REMOVAL RESIDENTIAL": "VegetationRemoval",
"AMENDMENT": null,
"ALUMINUM CARPORT/CANOPY": "GeneralBuilding",
"COMM ALTERATION OR EXTENTION": "CommercialConstruction",
"ACCESSORY BLD (RES) GARAGE": "ResidentialConstruction",
"PLUMBING COMMERCIAL": "Plumbing",
"RESIDENTIAL (MULTI) APARTMENT": "ResidentialConstruction",
"CONCRETE RETAINING/SEA WALL": "GeneralBuilding",
"POOL/SPA RESIDENTIAL": "PoolSpaInstallation",
"ELECTRICAL SERVICE CHG (RES)": "Electrical",
"SOLAR RESIDENTIAL": "Electrical",
"COMMERCIAL STRUCTURE": "CommercialConstruction",
"FENCE RESIDENTIAL": "Fencing",
"ANTENNA RADIO/TELEVISION": "GeneralBuilding",
"FIRE ALARM": "FireProtectionSystem",
"MECHANICAL RES NEW/REMODEL": "MechanicalHVAC",
"COMMERCIAL BLD (SHELL ONLY)": "CommercialConstruction",
"DRIVEWAY OR PATIO": "DrivewayPermit",
"FIRE SPRINKLER SYSTEM": "FireProtectionSystem",
"WATERFRONT STRUCTURE": "DockAndShore",
"ELECTRICAL RESIDENTIAL": "Electrical",
"ROOF": "Roofing",
"SITE IMPROVEMENTS": "SiteDevelopment",
"PRE APPLICATION MEETING": "InformalMeeting",
"INTERIOR COMPLETION (COMM)": "CommercialConstruction",
"ELECTRICAL COMMERCIAL": "Electrical",
"STORAGE AUTO PARKING STRUCT": "CommercialConstruction",
"DEMOLITION": "Demolition",
"MULTI FAMILY": "ResidentialConstruction",
"INGROUND SPA": "PoolSpaInstallation",
"STAIR/MISC": "GeneralBuilding",
"RESIDENTIAL (1 & 2) DUPLEX": "ResidentialConstruction",
"ACCESSORY STRUCTURE RES": "ResidentialConstruction",
"DOCK/SEAWALL": "DockAndShore",
"FENCE COMMERCIAL": "Fencing",
"MECHANICAL GAS VENT ALTER/EXTN": "MechanicalHVAC",
"DECK": "GeneralBuilding",
"CHANGE OF USE": null,
"ACCESSORY BLD (RES) CANOPY": "ResidentialConstruction",
"ACCESSORY BLD (COMM) PAVILIAN": "CommercialConstruction",
"COMMERCIAL OFFICE BLD": "CommercialConstruction",
"ACCESSORY BLD (RES) CARPORT": "ResidentialConstruction",
"COMMERCIAL MODULAR BLD": "CommercialConstruction",
"STORAGE BLDG": "GeneralBuilding",
"MULTIFAMILY": "ResidentialConstruction",
"MOBILE HOME": "MobileHomeRV",
"INDUSTRIAL FACTORY": "CommercialConstruction",
"DRIVEWAY-NON PAVER": "DrivewayPermit",
"ASSEMBLY CONST AUDITORIUM": "CommercialConstruction",
"VENDING": null,
"COMMERCIAL RETAIL STORE": "CommercialConstruction",
"COMMERCIAL NEW": "CommercialConstruction",
"TENT": "GeneralBuilding",
"TENT SETUP": "GeneralBuilding",
"TREE REMOVAL NON RESIDENTIAL": "VegetationRemoval",
"ACESSORY STRUCTURE COMMERCIAL": "CommercialConstruction",
"CONCRETE PAD W/FOOTING": "GeneralBuilding",
"MECHANICAL COMM NEW/REMODEL": "MechanicalHVAC",
"VARIANCE": "Variance",
"ALUMINUM/VINYL SOFFIT & FASCIA": "ExteriorOpeningsAndFinishes",
"FORM-BASED CODE ADJUSTMENT": null,
"ACCESSORY BLD (RES) GAZEBO": "ResidentialConstruction",
"DUMPSTER": null,
"CONCRETE POOL CAGE -- AUTO CLOSE": "ScreenEnclosure",
"FIRE SYSTEM UNDERGROUND": "FireProtectionSystem",
"ACCESSORY BLD (COMM) CARPORT": "CommercialConstruction",
"RENOVATION BLD (MULTI FAMILY)": "ResidentialConstruction",
"PRELIMINARY": null,
"PARKING LOT": "SiteDevelopment",
"ANTENNA": "GeneralBuilding",
"MODULAR BLD": "GeneralBuilding",
"DAMAGE": null,
"SPECIAL USE AMENDMENT": null,
"STRUCTURE RELOCATION (RES)": "StructureMove",
"FIRE SUPPRESSION SYSTEM": "FireProtectionSystem",
"TBD": null,
"BACKFLOW DEVICE INSTALL": "Plumbing",
"POOL/SPA COMMERCIAL": "PoolSpaInstallation",
"CONVERTED FROM EDEN": null,
"FIRE HOOD SUPPRESSION SYSTEM": "FireProtectionSystem",
"Agricultural Exemption": null,
"MECHANICAL COMM RANGE HOOD": "MechanicalHVAC",
"ELECTRICAL SERVICE INTERRUPT": "Electrical",
"MECHANICAL GAS PIPING/RES": "GasInstallation",
"INTERIOR COMPLETION (RES)": "ResidentialConstruction",
"NEW WATER SERVICE": "UtilitiesConnection",
"STORAGE TANK FUEL": "GeneralBuilding",
"ANTENNA SATELLITE DISH": "GeneralBuilding",
"ELECTRICAL COMM ALTER>3 SP CIR": "Electrical",
"LAND USE ATLAS AMENDMENT": "ComprehensivePlanAmendment",
"FLOW/FIRE HYDRANT": "FireProtectionSystem",
"ALCOHOL BEVERAGE LICENSE": null,
"PLANNED DEV MINOR AMENDMENT": "PlannedDevelopment",
"UNDERGROUND PIPING": "Plumbing",
"ELECTRICAL POLE MOUNTED SER": "Electrical",
"EASEMENT VACATION": "Vacation",
"CAP": null,
"RES IRRIGATION SYS": "LandscapeIrrigation",
"CHANGE OF OCCUPANCY": null,
"DAMAGE ASSESSMENT": null,
"ABOVE GROUND SPA": "PoolSpaInstallation",
"MODULAR BUILDING COMMERCIAL": "CommercialConstruction",
"RENOVATION MECH (1 & 2 FAMILY)": "MechanicalHVAC",
"SIP WITH LA": null,
"RENOVATION PLB (MULTI FAMILY)": "Plumbing",
"ROW/VACATION": "RightOfWayPermit",
"PLANNED DEV MAJOR AMENDMENT": "PlannedDevelopment",
"KITCHEN HOOD": "MechanicalHVAC",
"EDUCATIONAL BLD PRIVATE": "CommercialConstruction",
"RENOVATION PERMIT ADMIN (MULT)": "ResidentialConstruction",
"CERTIFICATE OF APPROPRIATNESS": "SpecialCertificateOfAppropriateness",
"MECHANICAL REFRIGERATION/COMM": "MechanicalHVAC",
"MINOR PDP AMENDMENT": "PlannedDevelopment",
"PLANNED DEV PRELIMINARY": "PlannedDevelopment",
"ALUMINUM ROOFOVER W/GAS VENT": "Roofing",
"ELECTRICAL SERVICE CHG (COMM)": "Electrical",
"COMP PLAN CHANGE": "ComprehensivePlanAmendment",
"ADMINISTRATIVE VARIANCE": "AdministrativeApproval",
"RENOVATION MECH (MULTI FAMILY)": "MechanicalHVAC",
"FIRE HYDRANT FLOW DATA REQ": "FireProtectionSystem",
"TANKS": "GeneralBuilding",
"GREENHOUSE (COMM)": "CommercialConstruction",
"SOLAR COMMERCIAL": "Electrical",
"ASSEMBLY CONST CHURCH": "CommercialConstruction",
"STRUCTURE RELOCATION (COMM)": "StructureMove",
"SIGN DIRECTIONAL": null,
"RESIDENTIAL (MULTI) CONVENT": "ResidentialConstruction",
"REPLACE EXISTING FIXTURES": "Electrical",
"ALTER DRAIN, WASTE PIPE": "Plumbing",
"FIRE PUMP": "FireProtectionSystem",
"FIRE STANDPIPE SYSTEM": "FireProtectionSystem",
"ANNEXATION": null,
"GREENHOUSE (RES)": "ResidentialConstruction",
"SPECIAL USE DOCK": "DockAndShore",
"STORAGE WAREHOUSE": "CommercialConstruction",
"SITE IMPROVEMENT PLAN": "SiteDevelopment",
"COMM IRRIGATION SYS": "LandscapeIrrigation",
"ASSEMBLY CONST RECREATION BLD": "CommercialConstruction",
"EASEMENT": null,
"RESIDENTIAL (MULTI)HOTEL/MOTEL": "ResidentialConstruction",
"EXTENSION OF TIME": "ZoningExtension",
"ZONING MAP AMENDMENT": "Rezoning",
"APPEALS OTHER": "AdministrativeAppeal",
"MECHANICAL POOL HEATER": "MechanicalHVAC",
"STORAGE GARAGE": "GeneralBuilding",
"ASSEMBLY CONST RESTAURANT": "CommercialConstruction",
"ALTER WATER DIST PIPE": "Plumbing",
"RENOVATION ELE (MULTI FAMILY)": "Electrical",
"SUBDIVISION FINAL": "SiteDevelopment",
"SPECIAL USE WITH PREAPP": null,
"FLUM AMEND-SMALL SCALE": "ComprehensivePlanAmendment",
"SITE IMP PLAN LANDSCAPE ONLY": "LandscapeIrrigation",
"MECHANICAL GAS PIPING/COMM": "GasInstallation",
"MOVING PERMIT": "StructureMove",
"SUB PRELIM PLAT W/PREAPP": "SiteDevelopment",
"ASSEMBLY CONST HOUSE OF WORSHP": "CommercialConstruction",
"STORAGE AIRCRAFT HANGER": "CommercialConstruction",
"SIGN IN R.O.W.": null,
"COMMERCIAL SHOPPING MALL": "CommercialConstruction",
"SUBDIVISION PRELIMINARY": "SiteDevelopment",
"MAJOR PDP AMENDMENT": "PlannedDevelopment",
"FLUM AMEND-LARGE SCALE": "ComprehensivePlanAmendment",
"SPECIAL CITY COUNCIL APPROVAL": null,
"RESIDENTIAL (MULTI) DORMITORY": "ResidentialConstruction",
"INDUSTRIAL MANUFACTURING PLANT": "CommercialConstruction",
"ELECTRICAL COMM REPLACE MOTORS": "Electrical",
"STORAGE FREIGHT DEPOT": "CommercialConstruction",
"PLANNED DEV FINAL": "PlannedDevelopment",
"PLANNED RE-DEVELOPMENT PROJECT": "PlannedDevelopment",
"INDUSTRIAL ASSEMBLY PLANT": "CommercialConstruction",
"BUILDING RELOCATION": "StructureMove",
"PYROTECHNICS": null,
"REVIEWING STAND & BLEACHER": "GeneralBuilding",
"RESIDENTIAL (MULTI) MONASTERY": "ResidentialConstruction",
"TREE REMOVAL": "VegetationRemoval",
"INSTITUTIONAL MENTAL & CORRECT": "CommercialConstruction"
}

const permitActionMapping = {"MECHANICAL A/C CHANGE-OUT": "Replacement",
"REROOF/ROOFING MEMBRANE": "Replacement",
"RESIDENTIAL (1 & 2) SINGLE DET": "New",
"RENOVATION PERMIT ADMIN (1&2)": "Alteration",
"SWIMMING POOL": "New",
"ALUMINUM SCREEN ROOM": "New",
"ALUMINUM POOL CAGE": "New",
"ROOFING SHINGLE": "Replacement",
"ZONING/FENCING/MISCELLANEOUS": "Other",
"ELECTRICAL RES ALTERATION": "Alteration",
"MECHANICAL": "Other",
"NEW ADDITION (RESIDENTIAL)": "Addition",
"SEWER, INSTALL NEW/CHG SEPTIC": "New",
"BUILDING": "Other",
"MISCELLANEOUS": "Other",
"RES ALTERATION OR EXTENTION": "Alteration",
"DOCK": "New",
"PLUMBING": "Other",
"ROOF RESIDENTIAL": "Replacement",
"NEW ADDITION (COMMERCIAL)": "Addition",
"RESIDENTIAL (1 & 2) SINGLE ATT": "New",
"MECHANICAL RESIDENTIAL": "Other",
"MECHANICAL COMMERCIAL": "Other",
"SOLAR HOT WATER SYSTEM": "New",
"SIGN": "New",
"SCREEN RM/PORCH/PATIO/GARAGE": "New",
"GENERATOR": "New",
"DEMOLISH": "Remove",
"RESIDENTIAL": "New",
"ACCESSORY BLD (COMM) CANOPY": "New",
"REROOF": "Replacement",
"ELECTRICAL": "Other",
"WINDOW/DOOR UNDER 3 STORY": "New",
"MOBILE HOME SET-UP": "New",
"FENCE": "New",
"PLUMBING RESIDENTIAL": "Other",
"ALUMINUM ROOFOVER W/O GAS VENT": "New",
"WINDOW/DOOR REPLACEMENT": "Replacement",
"RENOVATION BLD (1 & 2 FAMILY)": "Alteration",
"SIGN ON SITE": "New",
"RENOVATION PLB (1 & 2 FAMILY)": "Alteration",
"SIGN BILLBOARD": "New",
"MECHANICAL A/C CHANGE OUT": "Replacement",
"NEW SINGLE FAMILY": "New",
"CONCRETE FOUNDATION": "New",
"RENOVATION ELE (1 & 2 FAMILY)": "Alteration",
"MECHANICAL COMM DUCT SYS": "New",
"CONCRETE STRUCT SLAB/DRIVEWAY": "New",
"ELECTRICAL SERVICE CHANGE": "Replacement",
"ROOF COMMERICIAL": "Replacement",
"RESIDENTIAL ALT ADD": "Alteration",
"ALUMINUM SIDING/VINYL WINDOWS": "New",
"ACCESSORY BLD(RES)UTL/BARN/SHD": "New",
"ALUMINUM CARPORT W/U-BLD": "New",
"COMMERCIAL ALT ADD": "Alteration",
"NEW 1&2 FAMILY & TOWNHOUSE": "New",
"WINDOWS": "Replacement",
"ALUMINUM GLASS ROOM": "New",
"SPECIAL USE": "Other",
"SIDING, FASCIA, SOFFIT": "New",
"RESIDENTIAL STRUCTURE": "New",
"ALUMINUM STRUCTURE": "New",
"TREE REMOVAL RESIDENTIAL": "Remove",
"AMENDMENT": "Other",
"ALUMINUM CARPORT/CANOPY": "New",
"COMM ALTERATION OR EXTENTION": "Alteration",
"ACCESSORY BLD (RES) GARAGE": "New",
"PLUMBING COMMERCIAL": "Other",
"RESIDENTIAL (MULTI) APARTMENT": "New",
"CONCRETE RETAINING/SEA WALL": "New",
"POOL/SPA RESIDENTIAL": "New",
"ELECTRICAL SERVICE CHG (RES)": "Replacement",
"SOLAR RESIDENTIAL": "New",
"COMMERCIAL STRUCTURE": "New",
"FENCE RESIDENTIAL": "New",
"ANTENNA RADIO/TELEVISION": "New",
"FIRE ALARM": "New",
"MECHANICAL RES NEW/REMODEL": "New",
"COMMERCIAL BLD (SHELL ONLY)": "New",
"DRIVEWAY OR PATIO": "New",
"FIRE SPRINKLER SYSTEM": "New",
"WATERFRONT STRUCTURE": "New",
"ELECTRICAL RESIDENTIAL": "Other",
"ROOF": "Replacement",
"SITE IMPROVEMENTS": "Other",
"PRE APPLICATION MEETING": "Other",
"INTERIOR COMPLETION (COMM)": "Other",
"ELECTRICAL COMMERCIAL": "Other",
"STORAGE AUTO PARKING STRUCT": "New",
"DEMOLITION": "Remove",
"MULTI FAMILY": "New",
"INGROUND SPA": "New",
"STAIR/MISC": "New",
"RESIDENTIAL (1 & 2) DUPLEX": "New",
"ACCESSORY STRUCTURE RES": "New",
"DOCK/SEAWALL": "New",
"FENCE COMMERCIAL": "New",
"MECHANICAL GAS VENT ALTER/EXTN": "Alteration",
"DECK": "New",
"CHANGE OF USE": "Other",
"ACCESSORY BLD (RES) CANOPY": "New",
"ACCESSORY BLD (COMM) PAVILIAN": "New",
"COMMERCIAL OFFICE BLD": "New",
"ACCESSORY BLD (RES) CARPORT": "New",
"COMMERCIAL MODULAR BLD": "New",
"STORAGE BLDG": "New",
"MULTIFAMILY": "New",
"MOBILE HOME": "New",
"INDUSTRIAL FACTORY": "New",
"DRIVEWAY-NON PAVER": "New",
"ASSEMBLY CONST AUDITORIUM": "New",
"VENDING": "Other",
"COMMERCIAL RETAIL STORE": "New",
"COMMERCIAL NEW": "New",
"TENT": "New",
"TENT SETUP": "New",
"TREE REMOVAL NON RESIDENTIAL": "Remove",
"ACESSORY STRUCTURE COMMERCIAL": "New",
"CONCRETE PAD W/FOOTING": "New",
"MECHANICAL COMM NEW/REMODEL": "New",
"VARIANCE": "Other",
"ALUMINUM/VINYL SOFFIT & FASCIA": "New",
"FORM-BASED CODE ADJUSTMENT": "Other",
"ACCESSORY BLD (RES) GAZEBO": "New",
"DUMPSTER": "New",
"CONCRETE POOL CAGE -- AUTO CLOSE": "New",
"FIRE SYSTEM UNDERGROUND": "New",
"ACCESSORY BLD (COMM) CARPORT": "New",
"RENOVATION BLD (MULTI FAMILY)": "Alteration",
"PRELIMINARY": "Other",
"PARKING LOT": "New",
"ANTENNA": "New",
"MODULAR BLD": "New",
"DAMAGE": "Repair",
"SPECIAL USE AMENDMENT": "Other",
"STRUCTURE RELOCATION (RES)": "Other",
"FIRE SUPPRESSION SYSTEM": "New",
"TBD": "Other",
"BACKFLOW DEVICE INSTALL": "New",
"POOL/SPA COMMERCIAL": "New",
"CONVERTED FROM EDEN": "Other",
"FIRE HOOD SUPPRESSION SYSTEM": "New",
"Agricultural Exemption": "Other",
"MECHANICAL COMM RANGE HOOD": "New",
"ELECTRICAL SERVICE INTERRUPT": "Other",
"MECHANICAL GAS PIPING/RES": "New",
"INTERIOR COMPLETION (RES)": "Other",
"NEW WATER SERVICE": "New",
"STORAGE TANK FUEL": "New",
"ANTENNA SATELLITE DISH": "New",
"ELECTRICAL COMM ALTER>3 SP CIR": "Alteration",
"LAND USE ATLAS AMENDMENT": "Other",
"FLOW/FIRE HYDRANT": "New",
"ALCOHOL BEVERAGE LICENSE": "Other",
"PLANNED DEV MINOR AMENDMENT": "Other",
"UNDERGROUND PIPING": "New",
"ELECTRICAL POLE MOUNTED SER": "New",
"EASEMENT VACATION": "Other",
"CAP": "Other",
"RES IRRIGATION SYS": "New",
"CHANGE OF OCCUPANCY": "Other",
"DAMAGE ASSESSMENT": "Other",
"ABOVE GROUND SPA": "New",
"MODULAR BUILDING COMMERCIAL": "New",
"RENOVATION MECH (1 & 2 FAMILY)": "Alteration",
"SIP WITH LA": "Other",
"RENOVATION PLB (MULTI FAMILY)": "Alteration",
"ROW/VACATION": "Other",
"PLANNED DEV MAJOR AMENDMENT": "Other",
"KITCHEN HOOD": "New",
"EDUCATIONAL BLD PRIVATE": "New",
"RENOVATION PERMIT ADMIN (MULT)": "Alteration",
"CERTIFICATE OF APPROPRIATNESS": "Other",
"MECHANICAL REFRIGERATION/COMM": "New",
"MINOR PDP AMENDMENT": "Other",
"PLANNED DEV PRELIMINARY": "Other",
"ALUMINUM ROOFOVER W/GAS VENT": "New",
"ELECTRICAL SERVICE CHG (COMM)": "Replacement",
"COMP PLAN CHANGE": "Other",
"ADMINISTRATIVE VARIANCE": "Other",
"RENOVATION MECH (MULTI FAMILY)": "Alteration",
"FIRE HYDRANT FLOW DATA REQ": "Other",
"TANKS": "New",
"GREENHOUSE (COMM)": "New",
"SOLAR COMMERCIAL": "New",
"ASSEMBLY CONST CHURCH": "New",
"STRUCTURE RELOCATION (COMM)": "Other",
"SIGN DIRECTIONAL": "New",
"RESIDENTIAL (MULTI) CONVENT": "New",
"REPLACE EXISTING FIXTURES": "Replacement",
"ALTER DRAIN, WASTE PIPE": "Alteration",
"FIRE PUMP": "New",
"FIRE STANDPIPE SYSTEM": "New",
"ANNEXATION": "Other",
"GREENHOUSE (RES)": "New",
"SPECIAL USE DOCK": "New",
"STORAGE WAREHOUSE": "New",
"SITE IMPROVEMENT PLAN": "Other",
"COMM IRRIGATION SYS": "New",
"ASSEMBLY CONST RECREATION BLD": "New",
"EASEMENT": "Other",
"RESIDENTIAL (MULTI)HOTEL/MOTEL": "New",
"EXTENSION OF TIME": "Other",
"ZONING MAP AMENDMENT": "Other",
"APPEALS OTHER": "Other",
"MECHANICAL POOL HEATER": "New",
"STORAGE GARAGE": "New",
"ASSEMBLY CONST RESTAURANT": "New",
"ALTER WATER DIST PIPE": "Alteration",
"RENOVATION ELE (MULTI FAMILY)": "Alteration",
"SUBDIVISION FINAL": "Other",
"SPECIAL USE WITH PREAPP": "Other",
"FLUM AMEND-SMALL SCALE": "Other",
"SITE IMP PLAN LANDSCAPE ONLY": "New",
"MECHANICAL GAS PIPING/COMM": "New",
"MOVING PERMIT": "Other",
"SUB PRELIM PLAT W/PREAPP": "Other",
"ASSEMBLY CONST HOUSE OF WORSHP": "New",
"STORAGE AIRCRAFT HANGER": "New",
"SIGN IN R.O.W.": "New",
"COMMERCIAL SHOPPING MALL": "New",
"SUBDIVISION PRELIMINARY": "Other",
"MAJOR PDP AMENDMENT": "Other",
"FLUM AMEND-LARGE SCALE": "Other",
"SPECIAL CITY COUNCIL APPROVAL": "Other",
"RESIDENTIAL (MULTI) DORMITORY": "New",
"INDUSTRIAL MANUFACTURING PLANT": "New",
"ELECTRICAL COMM REPLACE MOTORS": "Replacement",
"STORAGE FREIGHT DEPOT": "New",
"PLANNED DEV FINAL": "Other",
"PLANNED RE-DEVELOPMENT PROJECT": "Other",
"INDUSTRIAL ASSEMBLY PLANT": "New",
"BUILDING RELOCATION": "Other",
"PYROTECHNICS": "Other",
"REVIEWING STAND & BLEACHER": "New",
"RESIDENTIAL (MULTI) MONASTERY": "New",
"TREE REMOVAL": "Remove",
"INSTITUTIONAL MENTAL & CORRECT": "New"}

const permitStatusMapping = {
"ACTIVE": "InProgress",
"INITIAL": "Planned",
"PENDING": "InProgress",
"EXTENDED": "InProgress",
"APPROVED": "Permitted",
"CANCELED": "Cancelled",
"CANCELLED": "Cancelled",
"SUSPENDED": "OnHold",
"FINALED": "Completed",
"ABANDONED": "Cancelled",
"CLOSED": "Completed",
"COMPLETE": "Completed",
"TRANSFER": "InProgress",
"DENIED": "Cancelled",
"REJECTED": "Cancelled",
"WITHDRAWN": "Cancelled",
"EXPIRED": "Completed",
"CLO": "Completed",
"PERMIT ISSUED": "Permitted",
"CLOS": "Completed",
"ISSU": "Permitted",
"COMP": "Completed",
"ISSUED": "Permitted",
"OPEN": "InProgress",
"INSPECTION PASSED": "Permitted",
"EXPI": "Completed",
"VOID": "Cancelled",
"APP": "Permitted",
"MORE INFO REQUIRED": "OnHold",
"PENDING CLOSURE": "InProgress",
"WITH": "Cancelled",
"CO ISSUED": "Permitted",
"CC ISSUED": "Permitted",
"CANC": "Cancelled",
"ABAN": "Cancelled",
"COFC ISSUED": "Permitted",
"APPROVED": "Permitted",
"WD": "Cancelled",
"WITHDRAWN": "Cancelled",
"PERMIT EXTENSION APP": "Permitted",
"EXPIRED CTB": "Completed",
"DATA ENTRY ERROR": null
}

function parseAndFormatDate(dateString) {
  if (!dateString) {
    return null;
  }
  const formats = [
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'MM-DD-YYYY',
    'DD-MMM-YY HH:mm:ss'
  ];

  let parsedDate = null;

  for (const format of formats) {
    parsedDate = tryParseDate(dateString, format);
    if (parsedDate) {
      break; // Found a successful parse
    }
  }

  if (parsedDate) {
    // Format the date to YYYY-MM-DD
    const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = parsedDate.getDate().toString().padStart(2, '0');
    const year = parsedDate.getFullYear();
    return `${year}-${month}-${day}`;
  } else {
    // If no format matched, return null or throw an error, depending on your desired behavior
    return null;
  }
}

function tryParseDate(dateString, format) {
  let year, month, day, hour, minute, second;
  let dateParts;

  switch (format) {
    case 'YYYY-MM-DD HH:mm:ss':
      dateParts = dateString.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (dateParts) {
        year = parseInt(dateParts[1], 10);
        month = parseInt(dateParts[2], 10) - 1; // Month is 0-indexed
        day = parseInt(dateParts[3], 10);
        hour = parseInt(dateParts[4], 10);
        minute = parseInt(dateParts[5], 10);
        second = parseInt(dateParts[6], 10);
        return new Date(year, month, day, hour, minute, second);
      }
      break;

    case 'YYYY-MM-DD':
      dateParts = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateParts) {
        year = parseInt(dateParts[1], 10);
        month = parseInt(dateParts[2], 10) - 1;
        day = parseInt(dateParts[3], 10);
        return new Date(year, month, day);
      }
      break;

    case 'MM/DD/YYYY':
      dateParts = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (dateParts) {
        month = parseInt(dateParts[1], 10) - 1;
        day = parseInt(dateParts[2], 10);
        year = parseInt(dateParts[3], 10);
        return new Date(year, month, day);
      }
      break;

    case 'MM-DD-YYYY':
      dateParts = dateString.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (dateParts) {
        month = parseInt(dateParts[1], 10) - 1;
        day = parseInt(dateParts[2], 10);
        year = parseInt(dateParts[3], 10);
        return new Date(year, month, day);
      }
      break;

    case 'DD-MMM-YY HH:mm:ss':
      const monthMap = {
        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
      };
      dateParts = dateString.match(/^(\d{2})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (dateParts) {
        day = parseInt(dateParts[1], 10);
        month = monthMap[dateParts[2].toUpperCase()];
        year = parseInt(dateParts[3], 10);
        // Handle 2-digit year: assume 20xx for years <= current year's last two digits, else 19xx
        const currentYear = new Date().getFullYear();
        const currentTwoDigitYear = currentYear % 100;
        year = (year <= currentTwoDigitYear) ? 2000 + year : 1900 + year;

        hour = parseInt(dateParts[4], 10);
        minute = parseInt(dateParts[5], 10);
        second = parseInt(dateParts[6], 10);
        return new Date(year, month, day, hour, minute, second);
      }
      break;

    default:
      // Fallback for formats not explicitly handled, or if Date.parse can handle it
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
      break;
  }
  return null; // Parsing failed for this format
}

function readJsonSafe(p) {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}



function toInt(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toIntRounded(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}


function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeOut(filePath, obj) {
  const outPath = path.join("data", filePath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
}

function isMultiRequest(input) {
  if (!input || typeof input !== "object") return false;
  const keys = Object.keys(input);
  return keys.some(
    (k) =>
      input[k] &&
      typeof input[k] === "object" &&
      "source_http_request" in input[k] &&
      "response" in input[k],
  );
}

function sumNumbers(arr) {
  return arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function extractSecTwpRng(value) {
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function extractAddress(overallDetails, unnorm) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  const secTwpRngRawValue = overallDetails["Sec/Twp/Rge"];
  let secTwpRng = null;
  if (secTwpRngRawValue) {
    secTwpRng = extractSecTwpRng(secTwpRngRawValue);
  }
  const mailingAddress = overallDetails["Mailing Address"];
  const siteAddress = overallDetails["Situs Address"];
  if (mailingAddress) {
    const mailingAddressObj = {
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddress,
    };
    writeOut("mailing_address.json", mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const addressObj = {
      county_name,
      latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
      longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
      township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
      range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
      section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
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

function parseOverallDetails($) {
  const parcelData = {};
  $('.row.no-gutters.m-0.p-0').each((i, row) => {
        const labelDiv = $(row).find('.col-sm-2.m-0.p-0.text-sm-right');
        const valueDiv = $(row).find('.col-sm.m-0.p-0.ml-2');

        if (labelDiv.length > 0 && valueDiv.length > 0) {
            let label = labelDiv.text().trim();
            // Remove the colon from the label
            if (label.endsWith(':')) {
                label = label.slice(0, -1);
            }

            // Clean up the value text
            let value = valueDiv.text().trim();
            // Remove script tags
            valueDiv.find('script').remove();
            // If there's an anchor tag with popover or modal, try to get its text content
            const anchorText = valueDiv.find('a[data-toggle="popover"], a[data-toggle="modal"]').first().text().trim();
            if (anchorText) {
                value = anchorText;
            } else {
                // Otherwise, get the text content of the div itself
                value = valueDiv.text().trim();
            }
            // Further clean up by removing multiple spaces and newlines
            value = value.replace(/\s+/g, ' ').trim();

            // Handle specific cases where the value might be inside a <b> tag or a specific element
            if (label === 'Parcel ID') {
                const parcelIdBold = valueDiv.find('b').first().text().trim();
                if (parcelIdBold) {
                    value = parcelIdBold;
                }
            } else if (label === 'FEMA Value') {
                const femaValueFont = valueDiv.find('font').first().text().trim();
                if (femaValueFont) {
                    value = femaValueFont;
                }
            }

            // Only add if the label is not empty and not just whitespace
            if (label && label !== '') {
                parcelData[label] = value;
            }
        }
    });
    return parcelData;
}

function extractLegalDescription(htmlContent) {
    const scriptRegex = /<textarea id='modalText_2'[^>]*>([^<]*)<\/textarea>"\);/s;
    const match = htmlContent.match(scriptRegex);

    if (match && match[1]) {
        // The captured group [1] contains the content of the textarea
        return match[1].trim();
    }
    return null;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "CD") return "Correction Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  return "Miscellaneous";
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
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

function processPermits(input) {
  const permits = input && input.Permits && input.Permits.response;
  if (permits && Array.isArray(permits.rows) && permits.rows.length > 0) {
    // Determine indexes from cols
    const cols = permits.cols || [];
    let idx = {};
    cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    permits.rows.forEach((permit, pIdx) => {
      const permitPurpose = permit[idx["Purpose"]];
      const permitStatus = permit[idx["Bldg Dept Status"]] ? permit[idx["Bldg Dept Status"]].trim().toUpperCase() : null;
      const permit_number = permit[idx["Permit"]] ? permit[idx["Permit"]] : null;
      const permit_issue_date = parseAndFormatDate(permit[idx["Issued"]]);
      const permit_close_date = parseAndFormatDate(permit[idx["Final Date"]]);
      // const occDate = parseAndFormatDate(permit[idx["Cert Occ Date"]]);
      let improvement_type = null;
      let improvement_action = null;
      let improvement_status = null;
      if (permitPurpose && permitPurpose in permitTypeMapping) {
        improvement_type = permitTypeMapping[permitPurpose];
      }
      if (permitPurpose && permitPurpose in permitActionMapping) {
        improvement_action = permitActionMapping[permitPurpose];
      }
      if (permitStatus && permitStatus in permitStatusMapping) {
        improvement_status = permitStatusMapping[permitStatus];
      }
      const property_improvement = {
        improvement_type: improvement_type,
        improvement_status: improvement_status,
        completion_date: null,
        contractor_type: null,
        permit_required: true,
        permit_number: permit_number,
        application_received_date: null,
        permit_issue_date: permit_issue_date,
        final_inspection_date: null,
        permit_close_date: permit_close_date,
        improvement_action: improvement_action,
        is_owner_builder: null,
        is_disaster_recovery: null,
        private_provider_plan_review: null,
        private_provider_inspections: null
      }
      writeOut(`property_improvement_${(pIdx + 1)}.json`, property_improvement);
      // writeOut(`relationship_property_to_property_improvement_${(pIdx + 1)}.json`, {
      //     from: { "/": `./property.json` },
      //     to: { "/": `./property_improvement_${(pIdx + 1)}.json` },
      //   });
    });
  }
}

function writeTaxes(input) {
  const valuation = input && input.Tax && input.Tax.response;
  const cols = valuation.cols || [];
  let idx = {};
  valuation.cols.forEach((c, i) => {
    idx[c.title] = i;
  });
  if ((!idx.hasOwnProperty("Tax Year") && !idx.hasOwnProperty("January 1 Tax Year")) || !idx.hasOwnProperty("Non-School Assessed Value") || !idx.hasOwnProperty("County Taxable Value")) {
    return; // Check for Mandatory properties
  }
  valuation.rows.forEach((v, i) => {
    let taxYear = null;
    if ("Tax Year" in idx) {
      taxYear = parseInt(v[idx["Tax Year"]], 10);
    } else {
      taxYear = parseInt(v[idx["January 1 Tax Year"]], 10);
    }
    const assessedValue = parseCurrencyToNumber(v[idx["Non-School Assessed Value"]]);
    const taxableValue = parseCurrencyToNumber(v[idx["County Taxable Value"]]);
    let marketValue = null;
    let landValue = null;
    if (taxYear === null || assessedValue === null || taxableValue === null) {
      return;
    }
    if (idx.hasOwnProperty("Just/Market Value")) {
      marketValue = parseCurrencyToNumber(v[idx["Just/Market Value"]]);
    }
    if (idx.hasOwnProperty("Land Value")) {
      landValue = parseCurrencyToNumber(v[idx["Land Value"]]);
    }
    const taxObj = {
      tax_year: taxYear,
      property_assessed_value_amount: assessedValue,
      property_market_value_amount: marketValue,
      property_building_amount: null,
      property_land_amount: landValue,
      property_taxable_value_amount: taxableValue,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${taxYear}.json`), taxObj);
  });
}

function closestFenceEnumValue(length) {
  const fenceLengthEnum = [25,
            50,
            75,
            100,
            150,
            200,
            300,
            500,
            1000]
  let lowestDiff = Math.abs(length-25);
  let curr = 25;
  for (let val of fenceLengthEnum) {
    if(Math.abs(length - val) < lowestDiff) {
      lowestDiff = Math.abs(length - val);
      curr = val;
    }
  }
  return `${curr}ft`
}

function buildLot(input) {
  const land = input && input.Land && input.Land.response;
  let totalLandAreaAcres = 0;
  let totalLandAreaSqFt = 0;
  let fenceLength = null;
  if (land && Array.isArray(land.rows) && land.rows.length > 0) {
    // Determine indexes from cols
    const cols = land.cols || [];
    let idx = {};
    cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    land.rows.forEach((lrow, bIdx) => {
      if (lrow[idx["Acreage"]]) {
        const landAcres = toInt(lrow[idx["Acreage"]]);
        if (landAcres) {
          totalLandAreaAcres += landAcres;
        }
      }
      if (lrow[idx["SqFootage"]]) {
        const landSqFt = toInt(lrow[idx["SqFootage"]]);
        if (landSqFt) {
          totalLandAreaSqFt += landSqFt;
        }
      }
    });
  }
  const features = input && input.Features && input.Features.response;
  if (features && Array.isArray(features.rows) && features.rows.length > 0) {
    // Determine indexes from cols
    const cols = features.cols || [];
    let idx = {};
    cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    let fenceAlreadyFound = false;
    features.rows.forEach((feature, bIdx) => {
      if (fenceAlreadyFound || !feature[idx["Description"]]) {
        return;
      }
      const featureType = feature[idx["Description"]].toUpperCase();
      if (featureType.includes("FENCE")) {
        if (feature[idx["Length"]]) {
          const length = toInt(feature[idx["Length"]]);
          if (length) {
            fenceLength = closestFenceEnumValue(length);
            fenceAlreadyFound = true;
          }
        }
        if (!fenceAlreadyFound && feature[idx["Width"]]) {
          const length = toInt(feature[idx["Width"]]);
          if (length) {
            fenceLength = closestFenceEnumValue(length);
            fenceAlreadyFound = true;
          }
        }
      }
    });
  }

  const lot = {
    lot_type:
      totalLandAreaAcres != null
        ? totalLandAreaAcres > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre"
        : null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: totalLandAreaSqFt > 0 ? totalLandAreaSqFt : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: fenceLength,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeOut(`lot.json`, lot);
}

function main() {
  const input = readJsonSafe("input.json");
  let unnorm = readJsonSafe("address.json");
  if (!unnorm) {
    unnorm = readJsonSafe("unnormalized_address.json");
  }
  let parcel = readJsonSafe("parcel.json");
  if (!parcel) {
    parcel = readJsonSafe("property_seed.json");
    parcel.parcel_identifier = parcel.parcel_id;
  }
  const ownersData = readJsonSafe(path.join("owners", "owner_data.json"));
  const utilitiesData = readJsonSafe(
    path.join("owners", "utilities_data.json"),
  );
  const layoutData = readJsonSafe(
    path.join("owners", "layout_data.json"),
  );
  const structureData = readJsonSafe(
    path.join("owners", "structure_data.json"),
  );
  const html = input?.OwnersAndGeneralInformation?.response || "";
  const $ = cheerio.load(html);
  const overallDetails = parseOverallDetails($);
  ensureDir("data");
  let hasOwnerMailingAddress = extractAddress(overallDetails, unnorm);

  const multi = isMultiRequest(input);

  // Extract Address: use unnormalized variant if available; per schema, address supports source_http_request
  // if (address) {
  //   const secTwpRngValue = overallDetails["Sec/Twp/Rge"];
  //   let secTwpRng = null;
  //   if (secTwpRngValue) {
  //     secTwpRng = extractSecTwpRng(secTwpRngValue);
  //   }
  //   attemptWriteAddress(address, secTwpRng);
  //   // writeOut("address.json", addrOut);
  // } else if (unnorm) {
  //   const secTwpRngValue = overallDetails["Sec/Twp/Rge"];
  //   let secTwpRng = null;
  //   if (secTwpRngValue) {
  //     secTwpRng = extractSecTwpRng(secTwpRngValue);
  //   }
  //   attemptWriteAddress(unnorm, secTwpRng);
  // }
  // Property extraction from Buildings (and parcel)
  const buildings = input && input.Buildings && input.Buildings.response;
  // NOTE: property schema does NOT allow source_http_request field, so we will not include it here

  let propertyOut = null;
  // if (parcel) {
  propertyOut = {
    parcel_identifier: parcel.parcel_identifier,
  };
  // } else {
  //   propertyOut = {
  //     parcel_identifier: null,
  //   };
  // }

  if (buildings && Array.isArray(buildings.rows) && buildings.rows.length > 0) {
    // Determine indexes from cols
    const cols = buildings.cols || [];
    let idx = {};
    buildings.cols.forEach((c, i) => {
      idx[c.title] = i;
    });
    // const idx = {
    //   Classification: cols.indexOf("Classification"),
    //   Yrblt: cols.indexOf("Yrblt"),
    //   Effyr: cols.indexOf("Effyr"),
    //   Stories: cols.indexOf("Stories"),
    //   UnRoof: cols.indexOf("UnRoof"),
    //   LivBus: cols.indexOf("LivBus"),
    //   Bldg: cols.indexOf("Bldg"),
    // };

    // classification - take first non-null as representative
    // const classes = buildings.rows
    //   .map((r) => (idx.Classification >= 0 ? r[idx.Classification] : null))
    //   .filter((v) => v);
    // const classification = classes.length ? classes[0] : null;
    // if (classification) {
    //   propertyOut.property_type =
    //     mapClassificationToPropertyType(classification);
    // } else {
    //   const err = {
    //     type: "error",
    //     message: "Unknown enum value null.",
    //     path: "property.property_type",
    //   };
    //   throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
    // }
    const yrblts = buildings.rows
      .map((r) =>
        idx.Yrblt >= 0 ? (r[idx.Yrblt] ? Number(r[idx.Yrblt]) : null) : null,
      )
      .filter((v) => Number.isFinite(v));
    const effyrs = buildings.rows
      .map((r) =>
        idx.Effyr >= 0 ? (r[idx.Effyr] ? Number(r[idx.Effyr]) : null) : null,
      )
      .filter((v) => Number.isFinite(v));
    const unroof = buildings.rows.map((r) =>
      idx.UnRoof >= 0 ? (r[idx.UnRoof] ? Number(r[idx.UnRoof]) : 0) : 0,
    );
    const livbus = buildings.rows.map((r) =>
      idx.LivBus >= 0 ? (r[idx.LivBus] ? Number(r[idx.LivBus]) : 0) : 0,
    );

    propertyOut.property_structure_built_year = yrblts.length
      ? Math.min(...yrblts)
      : null;
    // propertyOut.property_effective_built_year = effyrs.length
    //   ? Math.max(...effyrs)
    //   : null;

    const totalArea = sumNumbers(unroof);
    const living = sumNumbers(livbus);

    // propertyOut.total_area = totalArea ? String(totalArea) : null;
    // propertyOut.livable_floor_area = living ? String(living) : null;
    // propertyOut.area_under_air = living ? String(living) : null;

    // Optional/unknown fields
    propertyOut.property_legal_description_text = extractLegalDescription(html);
    propertyOut.number_of_units = null;
    propertyOut.subdivision = null; //
    propertyOut.zoning = null; //
  } else {
    propertyOut.property_structure_built_year = null;
    // propertyOut.property_effective_built_year = null;
    // propertyOut.total_area = null;
    // propertyOut.livable_floor_area = null;
    // propertyOut.area_under_air = null;
    propertyOut.property_legal_description_text = extractLegalDescription(html);
    propertyOut.number_of_units = null;
    propertyOut.subdivision = null; //
    propertyOut.zoning = null; //
  }
  if (!overallDetails || !overallDetails["Land Use"])  {
    throw new Error("Property type not found");
  }
  // console.log(overallDetails);
  const propertyMapping = mapPropertyTypeFromUseCode(overallDetails["Land Use"]);
  if (!propertyMapping) {
    throw new Error("Property type not found");
  }
  propertyOut.property_type = propertyMapping.property_type,
  propertyOut.ownership_estate_type = propertyMapping.ownership_estate_type,
  propertyOut.build_status = propertyMapping.build_status,
  propertyOut.structure_form = propertyMapping.structure_form,
  propertyOut.property_usage_type = propertyMapping.property_usage_type,

  writeOut("property.json", propertyOut);

  const key =
      parcel && parcel.parcel_identifier
        ? `property_${parcel.parcel_identifier}`
        : null;
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  // if (!s) return;
  // writeOut("structure.json", s);

  // Sales extraction (none if no rows)
  const sales = input && input.Sales && input.Sales.response;
  const salesReq = input && input.Sales && input.Sales.source_http_request;
  let salesOwnerMapping = {};
  if (sales && Array.isArray(sales.rows) && sales.rows.length > 0) {
    // If rows exist, create sales_*.json and include source_http_request (sales schema supports additionalProperties? Not specified, but instruction requires including it)
    const cols = sales.cols || [];
    const dateIdx = cols.findIndex((c) => /sale(\s)*date/i.test(c.title));
    const priceIdx = cols.findIndex((c) => /sale(\s)*price/i.test(c.title));
    const bookIdx = cols.findIndex((c) => /book/i.test(c.title));
    const pageIdx = cols.findIndex((c) => /page/i.test(c.title));
    const instrTypeIdx = cols.findIndex((c) => /instrument(\s)*type/i.test(c.title));
    const granteeIdx = cols.findIndex((c) => /grantee/i.test(c.title));
    const instrNumberIdx = cols.findIndex((c) => /instrNo/i.test(c.title));
    let i = 1;
    for (const row of sales.rows) {
      const ownership_transfer_date =
        dateIdx >= 0 ? row[dateIdx].slice(0, 10) || null : null;
      const purchase_price_amount =
        priceIdx >= 0
          ? row[priceIdx] != null
            ? Number(row[priceIdx])
            : null
          : null;
      const out = {
        ownership_transfer_date,
        purchase_price_amount,
      };
      if (multi && salesReq) out.source_http_request = salesReq;
      if (purchase_price_amount !== 0 && !purchase_price_amount) {
        i++;
        continue;
      }
      writeOut(`sales_${i}.json`, out);
      let book = bookIdx >= 0 ? row[bookIdx] || null : null;
      let page = pageIdx >= 0 ? row[pageIdx] || null : null;
      let instrType = instrTypeIdx >= 0 ? row[instrTypeIdx] || null : null;
      let grantee = granteeIdx >= 0 ? row[granteeIdx] || null : null;
      let instrNumber = instrNumberIdx >= 0 ? row[instrNumberIdx] || null : null;
      let deedType = mapInstrumentToDeedType(instrType);
      let deed = { deed_type: deedType };
      if (book) {
        deed.book = book;
      }
      if (page) {
        deed.page = page;
      }
      if (instrNumber) {
        deed.instrument_number = instrNumber;
      }
      writeOut(`deed_${i}.json`, deed);
      const relSalesDeed = {
        from: { "/": `./sales_${i}.json` },
        to: { "/": `./deed_${i}.json` },
      };
      writeOut(`relationship_sales_deed_${i}.json`, relSalesDeed);
      let link = null;
      if(instrNumber) {
        link = `https://records.manateeclerk.com/OfficialRecords/Search/InstrumentNumber?instrumentNumber=${instrNumber}`;
        const file = {
          document_type: "Title",
          file_format: null,
          ipfs_url: null,
          name: `Deed ${instrNumber}`,
          original_url: link,
        };
        writeOut(`file_${i}.json`, file);
        const relDeedFile = {
          from: { "/": `./deed_${i}.json` },
          to: { "/": `./file_${i}.json` },
        };
        writeOut(`relationship_deed_file_${i}.json`, relDeedFile);
      } else if(book && page) {
        link = `https://records.manateeclerk.com/OfficialRecords/Search/InstrumentBookPage/${book}/${page}`;
        const file = {
          document_type: "Title",
          file_format: null,
          ipfs_url: null,
          name: `Deed ${book}/${page}`,
          original_url: link,
        };
        writeOut(`file_${i}.json`, file);
        const relDeedFile = {
          from: { "/": `./deed_${i}.json` },
          to: { "/": `./file_${i}.json` },
        };
        writeOut(`relationship_deed_file_${i}.json`, relDeedFile);
      }
      if (grantee && ownership_transfer_date) {
        salesOwnerMapping[ownership_transfer_date] = grantee;
      }
      i++;
    }
  }
  writeTaxes(input);
  processPermits(input);
  buildLot(input);

  // Utilities extraction from owners/utilities_data.json
  let util = null;
  if (utilitiesData) {
    
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }

  // Layout extraction from owners/layout_data.json
  if (layoutData) {
    let layoutBuildingMap = {};
    const key =
      parcel && parcel.parcel_identifier
        ? `property_${parcel.parcel_identifier}`
        : null;
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

  // Owners: from owners/owner_data.json (create none if unavailable/empty)
  if (ownersData) {
    // Determine current owners for this parcel
    const key =
      parcel && parcel.parcel_identifier
        ? `property_${parcel.parcel_identifier}`
        : null;
    const ownersKey = ownersData[key] ? key : "property_unknown_id";
    const ownersByDate =
      ownersData[ownersKey] && ownersData[ownersKey].owners_by_date
        ? ownersData[ownersKey].owners_by_date || []
        : [];
    if (ownersByDate) {
      // Relationships: link sale to owners present on that date (both persons and companies)
        let relPersonCounter = 0;
        let relCompanyCounter = 0;
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
          request_identifier: parcel.parcel_identifier,
        }));
        people.forEach((p, idx) => {
          
        });
        let loopIdx = 1;
        for (const p of people) {
          writeOut(`person_${loopIdx++}.json`, p);
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
          request_identifier: parcel.parcel_identifier,
        }));
        loopIdx = 1;
        for (const c of companies) {
          writeOut(`company_${loopIdx++}.json`, c);
        }
        loopIdx = 1;
        for (const [date, owner] of Object.entries(salesOwnerMapping)) {
          const ownersOnDate = ownersByDate[date] || [];
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
                    from: { "/": `./sales_${loopIdx}.json` },
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
                    from: { "/": `./sales_${loopIdx}.json` },
                  },
                );
              }
            });
          loopIdx++;
        };
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
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      console.error(JSON.stringify(e._structured));
    } else {
      console.error(e && e.message ? e.message : String(e));
    }
    process.exit(1);
  }
}
