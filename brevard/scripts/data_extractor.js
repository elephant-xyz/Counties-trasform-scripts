const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping=[
  {
    "property_usecode": "0006 VACANT - LESS THAN 5 ACRES - NOT GOVERNMENT OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0007 VACANT RESIDENTIAL LAND MULTI-FAMILY, PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0008 VACANT RESIDENTIAL LAND MULTI-FAMILY, UNPLATTED - LESS THAN 5 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0009 VACANT RESIDENTIAL LAND SINGLE FAMILY, UNPLATTED - LESS THAN 5 ACRES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0010 VACANT RESIDENTIAL LAND SINGLE FAMILY, PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0020 VACANT MOBILE HOME SITE PLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0021 VACANT MOBILE HOME SITE UNPLATTED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0033 IMPROVED RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0040 CONDOMINIUM UNIT - VACANT LAND",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0041 CONDOMINIUM UNIT WITH UTILITIES",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0050 CO-OP VACANT LAND",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0051 CO-OP VACANT WITH UTILITIES",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0110 SINGLE FAMILY RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0113 SINGLE FAMILY - MODULAR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0121 HALF-DUPLEX USED AS SFR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0132 RESIDENTIAL RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0135 TOWNHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0164 RESIDENTIAL IMPROVEMENT NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0212 MANUFACTURED HOUSING - SINGLE WIDE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingSingleWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0213 MANUFACTURED HOUSING - DOUBLE WIDE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0214 MANUFACTURED HOUSING - TRIPLE WIDE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0232 RESIDENTIAL RELATED AMENITY ON MANUFACTURED HOME SITE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0237 MANUFACTURED HOUSING RENTAL LOT WITH IMPROVEMENTS WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0238 MANUFACTURED HOUSING RENTAL LOT WITH IMPROVEMENTS NO MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0239 MANUFACTURED HOUSING RENTAL LOT WITHOUT IMPROVEMENTS WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0264 MANUFACTURED HOME NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0351 GARDEN APARTMENTS - 1 STORY - 10 TO 49 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0352 GARDEN APARTMENTS - 1 STORY - 50 UNITS AND UP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0353 LOW RISE APARTMENTS - 2 OR 3 STORIES - 10 TO 49 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0354 LOW RISE APARTMENTS - 2 OR 3 STORIES - 50 UNITS AND UP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0355 HIGH RISE APARTMENTS - 4 STORIES AND UP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0356 TOWNHOUSE APARTMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0414 CONDOMINIUM UNIT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0422 CONDOMINIUM - MANUFACTURED HOME PARK",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0430 CONDOMINIUM - RESIDENTIAL UNIT USED IN CONJUNCTION WITH ANOTHER UNIT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0432 CONDOMINIUM - TRANSFERABLE LIMITED COMMON ELEMENT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0433 IMPROVED CONDOMINIUM COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0437 CONDO MANUFACTURED HOUSING RENTAL LOT W/IMPROVEMENTS WITH MANUFACTURED HOME",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0438 CONDOMINIUM - IMPROVED WITH NO MANUFACTURED HOME",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0441 CONDOMINIUM UNIT WITH SITE IMPROVEMENTS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0464 CONDOMINIUM NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0465 CONDOMINIUM - MISCELLANEOUS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0514 COOPERATIVE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0522 CO-OP MANUFACTURED HOME - IMPROVED",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0537 CO-OP MANUFACTURED HOUSING RENTAL LOT W/IMPROVEMENTS WITH MANUFACTURED HOM",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0538 CO-OP IMPROVED W/O MANUFACTURED HOME",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0541 CO-OP WITH SITE IMPROVEMENTS",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0564 CO-OP NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0616 RETIREMENT HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0700 MISC RESIDENTIAL-MIGRANT CAMPS, ETC.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0815 HOUSE AND IMPROVEMENT NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "0817 HOUSE AND MOBILE HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0818 TWO OR THREE MOBILE HOMES NOT A PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0819 TWO RESIDENTIAL UNITS - NOT ATTACHED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0820 DUPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0830 TRIPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0834 TWO OR MORE TOWNHOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0837 TWO OR MORE MANUFACTURED HOUSING RENTAL LOTS WITH MANUFACTURED HOME(S)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0838 TWO OR MORE MANUFACTURED HOUSING RENTAL LOTS WITHOUT MANUFACTURED HOME(S)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0839 THREE OR FOUR LIVING UNITS - NOT ATTACHED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0840 QUADRUPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0850 MULTIPLE LIVING UNITS - 5 TO 9 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0855 MULTIPLE LIVING UNITS - CONVERTED - 2 TO 9 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0859 MULTIPLE LIVING UNITS - 5 TO 9 UNITS NOT ATTACHED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0860 MISC RESIDENTIAL-MIGRANT CAMPS, ETC.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0864 MULTI-FAMILY IMPROVEMENT - NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0903 VACANT RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0913 IMPROVED RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0943 IMPROVED CONDOMINIUM COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0949 NON-TAXABLE CONDOMINIUM COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1000 VACANT COMMERCIAL LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1033 VACANT COMMERCIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 RETAIL STORE - 1 UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 CONDOMINIUM - STORE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1105 RETAIL DRUGSTORE - NOT ATTACHED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1110 RETAIL STORE - MULTIPLE UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1115 RETAIL TIRE STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1125 CONVENIENCE STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1130 CONVENIENCE STORE WITH GAS PUMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1138 RETAIL SHELL BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1150 WAREHOUSE DISCOUNT STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "1204 COMMERCIAL SHELL BLDG CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1210 MIXED USE - COMMERCIAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1222 COMMERCIAL RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1233 IMPROVED COMMERCIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1238 COMMERCIAL SHELL BLDG OTHER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1264 COMMERCIAL IMPROVEMENT NOT SUITABLE FOR OCCUPANCY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1300 DEPARTMENT STORE",
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
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1500 REGIONAL SHOPPING MALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 SHOPPING COMPLEX - COMMUNITY/NEIGHBORHOOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1610 SHOPPING CENTER - NEIGHBORHOOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 OFFICE BUILDING - SINGLE TENANT - 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1704 CONDOMINIUM OFFICE UNIT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1710 OFFICE BUILDING - MULTI TENANT - 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1715 OFFICE BUILDING - MODULAR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1738 OFFICE SHELL BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1800 OFFICE BUILDING - SINGLE TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1810 OFFICE BUILDING - MULTI TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900 PROFESSIONAL BUILDING - SINGLE TENANT - 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1910 PROFESSIONAL BUILDING - MULTI TENANT - 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1920 PROFESSIONAL BUILDING - SINGLE TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1930 PROFESSIONAL BUILDING - MULTI TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1940 PROFESSIONAL/OFFICE COMPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1950 DAY CARE CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1960 RADIO OR TV STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000 AIRPORT - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2010 AIRPORT - COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2015 MARINA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 RESTAURANT / CAFETERIA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2104 CONDOMINIUM - RESTAURANT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2110 FAST FOOD RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 FINANCIAL INSTITUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2310 FINANCIAL INSTITUTION - BRANCH FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2400 INSURANCE COMPANY - OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 REPAIR SVC SHOP - EXCL AUTO - RADIO, TV, ELECTRIC REPAIR, REFRIG SERVICE, PAINT SHOP, LAUNDRY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 SERVICE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 DEALERSHIP SALES / SERVICE CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2710 GARAGE / AUTO-BODY / AUTO PAINT SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2715 MINI-LUBE SERVICE SPECIALIST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2720 CAR WASH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2730 USED AUTOMOBILE SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2740 REC. VEH. OR MH SALES/NEW OR USED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2800 PARKING LOT - COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2810 PARKING LOT - PATRON",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2890 MANUF. HOUSING PARK - 4 TO 9 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2891 MANUF. HOUSING PARK - 10 TO 25 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2892 MANUF. HOUSING PARK - 26 TO 50 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2893 MANUF. HOUSING PARK - 51 TO 100 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2894 MANUF. HOUSING PARK - 101 TO 150 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2895 MANUF. HOUSING PARK - 151 TO 200 SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2896 MANUF. HOUSING PARK - 201 & MORE SPACES RENTALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2900 WHOLESALE OUTLET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2910 PRODUCE HOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 FLORIST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3010 GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "3020 NURSERY NON-AGRIC. CLASSIFICATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3030 HORSE STABLES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "3040 DOG KENNEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "3100 THEATRE DRIVE-IN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3120 STADIUM NOT ENCLOSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3200 AUDITORIUM ENCLOSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3210 THEATRE ENCLOSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3220 RECREATION HALL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3230 FITNESS CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 NIGHT CLUBS, COCKTAIL LOUNGES, BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 BOWLING ALLEYS, SKATING RINKS, AND POOL HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3430 ARENA ENCLOSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3440 ARENA OPEN AIR WITH SUPPORTING FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3450 FLEA MARKET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3500 TOURIST ATTRACTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3510 PERMANENT EXHIBIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 CAMP OTHER THAN FOR MOBILE HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3610 CAMPGROUND TRAILERS, CAMPERS & TENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3693 LABOR CAMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3700 RACE TRACK / WAGERING ATTRACTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3710 CORRECTIONAL FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3720 POSTAL FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3800 GOLF COURSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3810 DRIVING RANGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3820 COUNTRY CLUB / SUPPORT FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3900 MOTOR INN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3904 TIME SHARE CONDO",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Commercial",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3905 BED & BREAKFAST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3910 LIMITED SERVICE HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3920 FULL SERVICE HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3930 EXTENDED STAY OR SUITE HOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3940 LUXURY HOTEL/RESORT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3950 CONVENTION HOTEL/RESORT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3970 MOTEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3972 MOTEL - WITH RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4000 VACANT INDUSTRIAL LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100 LIGHT MANUFACTURING SMALL EQUIPMENT MFG PLANT, SMALL MACHINE SHOP, INSTRUMENT MFG PRINTING PLANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4200 HVY IND HVY EQUIP MFG, LG MACH SHOPS, FOUNDRIES, STEEL FAB PLANTS, AUTO/ACFT PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 LUMBER YARD, SAWMILL, PLANING MILL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400 PACKING PLANT, FRUIT & VEGETABLE PACKING PLANT, MEAT PACKING PLANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4500 CANNERIES, FRUIT & VEGETABLE, BOTTLERS & BREWERS DISTILLERIES, WINERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4600 OTHER FOOD PROCESSING, CANDY FACTORIES, BAKERIES, POTATO CHIP FACTORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4700 MINERAL PROCESSING, PHOSPHATE PROCESSING REFINERY, CLAY PLANT, ROCK/GRAVEL PLANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4710 CONCRETE / ASPHALT PLANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 WAREHOUSING, DISTRIBUTION AND TRUCKING TERMINAL, VAN & STORAGE WAREHOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804 CONDOMINIUM - WAREHOUSING",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4810 MINI-WAREHOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4830 WAREHOUSE - FLEX SPACE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "4840 COLD STORAGE AND WAREHOUSE DISTRIBUTION CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900 OPEN STOR, NEW & USED BLDG SUPP, JUNK YARDS, AUTO WRCKG, FUEL STOR, EQUIP & MAT STOR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "Building"
  },
  {
    "property_usecode": "5100 CROPLAND - SOIL CAPABILITY CLASS I - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5110 CROPLAND - SOIL CAPABILITY CLASS I - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5120 CROPLAND - SOIL CAPABILITY CLASS I - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5200 CROPLAND - SOIL CAPABILITY CLASS II - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5210 CROPLAND - SOIL CAPABILITY CLASS II - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5220 CROPLAND - SOIL CAPABILITY CLASS II - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5300 CROPLAND - SOIL CAPABILITY CLASS III - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5310 CROPLAND - SOIL CAPABILITY CLASS III - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5320 CROPLAND - SOIL CAPABILITY CLASS III - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 TIMBERLAND-SLASH PINE INDEX 90 AND ABOVE - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5410 TIMBERLAND-SLASH PINE INDEX 90 AND ABOVE - WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5500 TIMBERLAND-SLASH PINE INDEX 80 TO 89 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5510 TIMBERLAND-SLASH PINE INDEX 80 TO 89 - WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600 TIMBERLAND-SLASH PINE INDEX 70 TO 79 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5610 TIMBERLAND-SLASH PINE INDEX 70 TO 79 - WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5700 TIMBERLAND-SLASH PINE INDEX 60 TO 69 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5710 TIMBERLAND-SLASH PINE INDEX 60 TO 69 - WITH IMPROVEMENTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5800 TIMBERLAND-SLASH PINE INDEX 50 TO 59 - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5810 TIMBERLAND-SLASH PINE INDEX 50 TO 59 - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5900 TIMBERLAND- NOT CLASSIFIED BY SITE INDEX TO PINES - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5910 TIMBERLAND- NOT CLASSIFIED BY SITE INDEX - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 GRAZING LAND - SOIL CAPABILITY CLASS I - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6010 GRAZING LAND - SOIL CAPABILITY CLASS I - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6020 GRAZING LAND - SOIL CAPABILITY CLASS I - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6100 GRAZING LAND - SOIL CAPABILITY CLASS II - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6110 GRAZING LAND - SOIL CAPABILITY CLASS II - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6120 GRAZING LAND - SOIL CAPABILITY CLASS II - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6200 GRAZING LAND - SOIL CAPABILITY CLASS III - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6210 GRAZING LAND - SOIL CAPABILITY CLASS III - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6220 GRAZING LAND - SOIL CAPABILITY CLASS III - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6300 GRAZING LAND - SOIL CAPABILITY CLASS IV - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6310 GRAZING LAND - SOIL CAPABILITY CLASS IV - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6320 GRAZING LAND - SOIL CAPABILITY CLASS IV - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6400 GRAZING LAND - SOIL CAPABILITY CLASS V - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6410 GRAZING LAND - SOIL CAPABILITY CLASS V - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6420 GRAZING LAND - SOIL CAPABILITY CLASS V - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6500 GRAZING LAND - SOIL CAPABILITY CLASS VI - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6510 GRAZING LAND - SOIL CAPABILITY CLASS VI - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6520 GRAZING LAND - SOIL CAPABILITY CLASS VI - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 ORCHARD GROVES - ALL GROVES - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6610 ORCHARD GROVES - ALL GROVES - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6620 ORCHARD GROVES - ALL GROVES - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6630 ORCHARD GROVES - PART GROVE, PART NOT PLANTED - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6640 ORCHARD GROVES - PART GROVE, PART NOT PLANTED - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6650 ORCHARD GROVES - PART GROVE, PART NOT PLANTED - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6660 COMBINATION - PART ORCHARD GROVES AND PART PASTURE LAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6670 COMBINATION - PART ORCHARD GROVES AND PART PASTURE LAND - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6680 COMBINATION - PART ORCHARD GROVES AND PART PASTURE LAND - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6690 MIXED TROPICAL FRUITS - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6691 MIXED TROPICAL FRUITS - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6692 MIXED TROPICAL FRUITS - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 POULTRY FARM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "6710 RABBIT FARM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6720 FISH FARM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Aquaculture",
    "property_type": "Building"
  },
  {
    "property_usecode": "6730 BEES HONEY FARM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "6800 DAIRY - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6810 DAIRY - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6820 FEED LOT - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 NURSERY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6910 NURSERY - WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "6920 NURSERY - WITH BUILDINGS OTHER THAN RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "7000 VACANT LAND - INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 CHURCH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 SCHOOL PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7210 SCHOOL PRIVATE - CHURCH OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7211 CHURCH-OWNED EDUCATIONAL BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7220 COLLEGE PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7230 FRATERNITY OR SORORITY HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7300 HOSPITAL-GENERAL PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7310 CLINIC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 HOME FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7500 ASSISTED-CARE LIVING FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7510 CHILDRENS' HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7515 NON-PROFIT OR CHARITABLE SERVICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7600 MORTUARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7610 CEMETERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7620 CREMATORIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7700 CLUBS, LODGES, AND UNION HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800 GYMNASIUM",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "7810 FIRE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "7820 LIBRARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "7841 CONVALESCENT HOME NURSING HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8000 WATER MANAGEMENT - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8010 SCHOOL PUBLICLY OWNED - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8011 WATER MANAGEMENT - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8012 WATER MANAGEMENT - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8020 COUNTY OWNED LAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8030 BREVARD CTY OTHER THAN BOCC - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8040 HOUSING AUTHORITY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8050 CANAVERAL PORT AUTHORITY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8060 STATE OWNED LAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8070 FEDERALLY OWNED LAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8080 MUNICIPALLY OWNED LAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8090 MELBOURNE AIRPORT AUTHORITY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8100 MILITARY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8110 MILITARY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8122 MILITARY - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8200 FOREST, PARK, REC AREA - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8210 FOREST, PARK, REC AREA - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8222 FOREST, PARK, REC AREA - RELATED AMENITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8300 SCHOOL PUBLICLY OWNED - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8322 SCHOOL PUBLICALLY OWNED - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 COLLEGE - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8410 COLLEGE - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8422 COLLEGE - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8500 HOSPITAL - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8510 HOSPITAL - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8522 HOSPITAL - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8610 COUNTY OWNED LAND - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8620 UTILITY DIVISION PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8621 UTILITY DIVISION - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8622 COUNTY OWNED - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8623 UTILITY DIVISION - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8640 BREVARD CTY OTHER THAN BOCC - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8642 BREVARD CTY OTHER THAN BOCC - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8660 HOUSING AUTHORITY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8662 HOUSING AUTHORITY - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8680 CANAVERAL PORT AUTHORITY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8682 CANAVERAL PORT AUTHORITY - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8710 STATE OWNED - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8722 STATE OWNED - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8810 FEDERALLY OWNED LAND - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8822 FEDERALLY OWNED - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8910 MUNICIPALLY OWNED LAND - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8922 MUNICIPALLY OWNED - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8930 MELBOURNE AIRPORT AUTHORITY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8932 MELBOURNE AIRPORT AUTHORITY - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9000 LEASED COUNTY/CITY PROPERTY - VACANT",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9010 LEASED COUNTY/CITY PROPERTY - IMPROVED",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9100 UTILITY GAS COMPANY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9105 LOCALLY-ASSESSED RAILROAD PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9110 UTILITY GAS COMPANY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9112 UTILITY GAS - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9120 UTILITY ELECTRIC COMPANY - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9130 UTILITY ELECTRIC COMPANY - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9132 UTILITY ELECTRIC - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9140 UTILITY TELEPHONE/TELEGRAPH - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9150 UTILITY TELEPHONE/TELEGRAPH - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9152 UTILITY COMMUNICATIONS - RELATED AMENITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9170 WATER & SEWER SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9180 PIPELINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9190 CANAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9300 SUBSURFACE RIGHTS - VACANT",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9400 RIGHT OF WAY STREET, ROAD, ETC - PUBLIC",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9410 RIGHT OF WAY STREET, ROAD, ETC - PRIVATE",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9465 IMPROVEMENT NOT SUITABLE TO ANY OTHER CODE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9499 ASSESSMENT ARREARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9500 RIVERS AND LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9510 SUBMERGED LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9600 WASTE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9610 MARSH - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9620 SAND DUNE - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9630 SWAMP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9700 RECREATIONAL OR PARKLAND - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800 CENTRALLY ASSESSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9900 ACREAGE - VACANT, 5 ACRES OR MORE, NOT GOVERNMENT OWNED, NOT COVERED BY ANOTHER CODE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9908 VACANT RESIDENTIAL LAND MULTI-FAMILY, UNPLATTED - 5 ACRES OR MORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9909 VACANT RESIDENTIAL LAND SINGLE-FAMILY, UNPLATTED - 5 ACRES OR MORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9910 VACANT MULTI-FAMILY PLATTED >5 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9911 VACANT SINGLE-FAMILY PLATTED > 5 AC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  }
]


const extraFeaturesCodeListMapping=[]

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

function mapPropertyTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  // console.log("1",normalizedInput)
  // console.log(propertyTypeByUseCode)
  if (Object.prototype.hasOwnProperty.call(propertyTypeByUseCode, normalizedInput)) {
    return propertyTypeByUseCode[normalizedInput];
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
  return null;
}

function mapBuildStatusFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(buildStatusByUseCode, normalizedInput)) {
    return buildStatusByUseCode[normalizedInput];
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
  return null;
}

function mapPropertyUsageTypeFromUseCode(code) {
  if (!code && code !== 0) return null;
  const normalizedInput = String(code).replace(/[-\s:()]+/g, "").toUpperCase();
  if (!normalizedInput) return null;
  if (Object.prototype.hasOwnProperty.call(propertyUsageTypeByUseCode, normalizedInput)) {
    return propertyUsageTypeByUseCode[normalizedInput];
  }
  return null;
}



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

function parseMoney(str) {
  if (!str) return null;
  const n = Number(String(str).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function parseIntOrNull(str) {
  if (str == null) return null;
  const n = parseInt(String(str).replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function toISODate(mmddyyyy) {
  if (!mmddyyyy) return null;
  const m = mmddyyyy.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function mapUnitsType(n) {
  if (n == null) return null;
  if (n === 1) return "One";
  if (n === 2) return "Two";
  if (n === 3) return "Three";
  if (n === 4) return "Four";
  if (n >= 2 && n <= 4) return "TwoToFour";
  return null;
}

function mapStreetSuffix(usps) {
  if (!usps) return null;
  const suffixMap = {
    STREET: "St",
    ST: "St",
    AVENUE: "Ave",
    AVE: "Ave",
    BOULEVARD: "Blvd",
    BLVD: "Blvd",
    ROAD: "Rd",
    RD: "Rd",
    LANE: "Ln",
    LN: "Ln",
    DRIVE: "Dr",
    DR: "Dr",
    COURT: "Ct",
    CT: "Ct",
    PLACE: "Pl",
    PL: "Pl",
    TERRACE: "Ter",
    TER: "Ter",
    CIRCLE: "Cir",
    CIR: "Cir",
    WAY: "Way",
    LOOP: "Loop",
    PARKWAY: "Pkwy",
    PKWY: "Pkwy",
    PLAZA: "Plz",
    PLZ: "Plz",
    TRAIL: "Trl",
    TRL: "Trl",
    BEND: "Bnd",
    BND: "Bnd",
    CRESCENT: "Cres",
    CRES: "Cres",
    MANOR: "Mnr",
    MNR: "Mnr",
    SQUARE: "Sq",
    SQ: "Sq",
    CROSSING: "Xing",
    XING: "Xing",
    PATH: "Path",
    RUN: "Run",
    WALK: "Walk",
    ROW: "Row",
    ALLEY: "Aly",
    ALY: "Aly",
    BEACH: "Bch",
    BCH: "Bch",
    BRIDGE: "Br",
    BRG: "Br",
    BROOK: "Brk",
    BRK: "Brk",
    BROOKS: "Brks",
    BRKS: "Brks",
    BUG: "Bg",
    BG: "Bg",
    BUGS: "Bgs",
    BGS: "Bgs",
    CLUB: "Clb",
    CLB: "Clb",
    CLIFF: "Clf",
    CLF: "Clf",
    CLIFFS: "Clfs",
    CLFS: "Clfs",
    COMMON: "Cmn",
    CMN: "Cmn",
    COMMONS: "Cmns",
    CMNS: "Cmns",
    CORNER: "Cor",
    COR: "Cor",
    CORNERS: "Cors",
    CORS: "Cors",
    CREEK: "Crk",
    CRK: "Crk",
    COURSE: "Crse",
    CRSE: "Crse",
    CREST: "Crst",
    CRST: "Crst",
    CAUSEWAY: "Cswy",
    CSWY: "Cswy",
    COVE: "Cv",
    CV: "Cv",
    CANYON: "Cyn",
    CYN: "Cyn",
    DALE: "Dl",
    DL: "Dl",
    DAM: "Dm",
    DM: "Dm",
    DRIVES: "Drs",
    DRS: "Drs",
    DIVIDE: "Dv",
    DV: "Dv",
    ESTATE: "Est",
    EST: "Est",
    ESTATES: "Ests",
    ESTS: "Ests",
    EXPRESSWAY: "Expy",
    EXPY: "Expy",
    EXTENSION: "Ext",
    EXT: "Ext",
    EXTENSIONS: "Exts",
    EXTS: "Exts",
    FALL: "Fall",
    FALL: "Fall",
    FALLS: "Fls",
    FLS: "Fls",
    FLAT: "Flt",
    FLT: "Flt",
    FLATS: "Flts",
    FLTS: "Flts",
    FORD: "Frd",
    FRD: "Frd",
    FORDS: "Frds",
    FRDS: "Frds",
    FORGE: "Frg",
    FRG: "Frg",
    FORGES: "Frgs",
    FRGS: "Frgs",
    FORK: "Frk",
    FRK: "Frk",
    FORKS: "Frks",
    FRKS: "Frks",
    FOREST: "Frst",
    FRST: "Frst",
    FREEWAY: "Fwy",
    FWY: "Fwy",
    FIELD: "Fld",
    FLD: "Fld",
    FIELDS: "Flds",
    FLDS: "Flds",
    GARDEN: "Gdn",
    GDN: "Gdn",
    GARDENS: "Gdns",
    GDNS: "Gdns",
    GLEN: "Gln",
    GLN: "Gln",
    GLENS: "Glns",
    GLNS: "Glns",
    GREEN: "Grn",
    GRN: "Grn",
    GREENS: "Grns",
    GRNS: "Grns",
    GROVE: "Grv",
    GRV: "Grv",
    GROVES: "Grvs",
    GRVS: "Grvs",
    GATEWAY: "Gtwy",
    GTWY: "Gtwy",
    HARBOR: "Hbr",
    HBR: "Hbr",
    HARBORS: "Hbrs",
    HBRS: "Hbrs",
    HILL: "Hl",
    HL: "Hl",
    HILLS: "Hls",
    HLS: "Hls",
    HOLLOW: "Holw",
    HOLW: "Holw",
    HEIGHTS: "Hts",
    HTS: "Hts",
    HAVEN: "Hvn",
    HVN: "Hvn",
    HIGHWAY: "Hwy",
    HWY: "Hwy",
    INLET: "Inlt",
    INLT: "Inlt",
    ISLAND: "Is",
    IS: "Is",
    ISLANDS: "Iss",
    ISS: "Iss",
    ISLE: "Isle",
    SPUR: "Spur",
    JUNCTION: "Jct",
    JCT: "Jct",
    JUNCTIONS: "Jcts",
    JCTS: "Jcts",
    KNOLL: "Knl",
    KNL: "Knl",
    KNOLLS: "Knls",
    KNLS: "Knls",
    LOCK: "Lck",
    LCK: "Lck",
    LOCKS: "Lcks",
    LCKS: "Lcks",
    LODGE: "Ldg",
    LDG: "Ldg",
    LIGHT: "Lgt",
    LGT: "Lgt",
    LIGHTS: "Lgts",
    LGTS: "Lgts",
    LAKE: "Lk",
    LK: "Lk",
    LAKES: "Lks",
    LKS: "Lks",
    LANDING: "Lndg",
    LNDG: "Lndg",
    MALL: "Mall",
    MEWS: "Mews",
    MEADOW: "Mdw",
    MDW: "Mdw",
    MEADOWS: "Mdws",
    MDWS: "Mdws",
    MILL: "Ml",
    ML: "Ml",
    MILLS: "Mls",
    MLS: "Mls",
    MANORS: "Mnrs",
    MNRS: "Mnrs",
    MOUNT: "Mt",
    MT: "Mt",
    MOUNTAIN: "Mtn",
    MTN: "Mtn",
    MOUNTAINS: "Mtns",
    MTNS: "Mtns",
    OVERPASS: "Opas",
    OPAS: "Opas",
    ORCHARD: "Orch",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PIKE: "Pike",
    PLAIN: "Pln",
    PLN: "Pln",
    PLAINS: "Plns",
    PLNS: "Plns",
    PINE: "Pne",
    PNE: "Pne",
    PINES: "Pnes",
    PNES: "Pnes",
    PRAIRIE: "Pr",
    PR: "Pr",
    PORT: "Prt",
    PRT: "Prt",
    PORTS: "Prts",
    PRTS: "Prts",
    PASSAGE: "Psge",
    PSGE: "Psge",
    POINT: "Pt",
    PT: "Pt",
    POINTS: "Pts",
    PTS: "Pts",
    RADIAL: "Radl",
    RADL: "Radl",
    RAMP: "Ramp",
    REST: "Rst",
    RIDGE: "Rdg",
    RDG: "Rdg",
    RIDGES: "Rdgs",
    RDGS: "Rdgs",
    ROADS: "Rds",
    RDS: "Rds",
    RANCH: "Rnch",
    RNCH: "Rnch",
    RAPID: "Rpd",
    RPD: "Rpd",
    RAPIDS: "Rpds",
    RPDS: "Rpds",
    ROUTE: "Rte",
    RTE: "Rte",
    SHOAL: "Shl",
    SHL: "Shl",
    SHOALS: "Shls",
    SHLS: "Shls",
    SHORE: "Shr",
    SHR: "Shr",
    SHORES: "Shrs",
    SHRS: "Shrs",
    SKYWAY: "Skwy",
    SKWY: "Skwy",
    SUMMIT: "Smt",
    SMT: "Smt",
    SPRING: "Spg",
    SPG: "Spg",
    SPRINGS: "Spgs",
    SPGS: "Spgs",
    SQUARES: "Sqs",
    SQS: "Sqs",
    STATION: "Sta",
    STA: "Sta",
    STRAVENUE: "Stra",
    STRA: "Stra",
    STREAM: "Strm",
    STRM: "Strm",
    STREETS: "Sts",
    STS: "Sts",
    THROUGHWAY: "Trwy",
    TRWY: "Trwy",
    TRACE: "Trce",
    TRCE: "Trce",
    TRAFFICWAY: "Trfy",
    TRFY: "Trfy",
    TRAILER: "Trlr",
    TRLR: "Trlr",
    TUNNEL: "Tunl",
    TUNL: "Tunl",
    UNION: "Un",
    UN: "Un",
    UNIONS: "Uns",
    UNS: "Uns",
    UNDERPASS: "Upas",
    UPAS: "Upas",
    VIEW: "Vw",
    VIEWS: "Vws",
    VILLAGE: "Vlg",
    VLG: "Vlg",
    VILLAGES: "Vlgs",
    VLGS: "Vlgs",
    VALLEY: "Vl",
    VLY: "Vl",
    VALLEYS: "Vlys",
    VLYS: "Vlys",
    WAYS: "Ways",
    VIA: "Via",
    WELL: "Wl",
    WL: "Wl",
    WELLS: "Wls",
    WLS: "Wls",
    CROSSROAD: "Xrd",
    XRD: "Xrd",
    CROSSROADS: "Xrds",
    XRDS: "Xrds",
  };
  return suffixMap[usps.toUpperCase()] || null;
}

function extractMailingAddress($) {
  if (!$) return null;

  let mailRow = $("#btnDetails_MailAddress").closest(".cssDetails_Top_Row");
  if (!mailRow.length) {
    mailRow = $(".cssDetails_Top_Row")
      .filter((i, el) => {
        const labelText = $(el)
          .find(".cssDetails_Top_Cell_Label")
          .text()
          .trim();
        return /Mail Address:/i.test(labelText);
      })
      .first();
  }

  if (!mailRow.length) return null;

  const dataCell = mailRow.find(".cssDetails_Top_Cell_Data").first().clone();
  dataCell.find(".cssDetails_Top_Notice").remove();

  const mailingText = dataCell.text().replace(/\s+/g, " ").trim();
  return mailingText || null;
}

function extractLotFeaturesFromExtra($) {
  const lotFields = {
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    paving_type: "None",
    paving_area_sqft: null,
    site_lighting_type: "None",
    site_lighting_fixture_count: null,
  };

  if (!$) return lotFields;

  const fenceTypePatterns = [
    { value: "Wood", patterns: [/wood\b/i, /cedar/i, /\btimber\b/i] },
    { value: "ChainLink", patterns: [/chain\s*link/i, /\bcyclone\b/i] },
    { value: "Vinyl", patterns: [/vinyl/i, /pv\s*c/i, /pvc\b/i] },
    { value: "Aluminum", patterns: [/aluminum/i, /\bmetal\b/i, /steel\b/i] },
    { value: "WroughtIron", patterns: [/wrought/i, /iron/i] },
    { value: "Bamboo", patterns: [/bamboo/i] },
    { value: "Composite", patterns: [/composite/i, /poly\b/i, /synthetic/i] },
    { value: "Privacy", patterns: [/privacy/i, /solid panel/i] },
    { value: "Picket", patterns: [/picket/i] },
    { value: "SplitRail", patterns: [/split\s*rail/i, /split-rail/i] },
    { value: "Stockade", patterns: [/stockade/i] },
    { value: "Board", patterns: [/\bboard\b/i, /board-on-board/i] },
    {
      value: "PostAndRail",
      patterns: [/post\s*and\s*rail/i, /post-&-rail/i, /post\/rail/i],
    },
    { value: "Lattice", patterns: [/lattice/i] },
  ];

  const allowedFenceLengths = new Set([25, 50, 75, 100, 150, 200, 300, 500, 1000]);
  const pavingTypesSeen = new Set();

  $("[id='divBldg_ExtraFeatures'] table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const desc = $(tds[0]).text().trim();
    const unitsRaw = $(tds[1]).text().trim().replace(/,/g, "");
    const unitsNumber =
      unitsRaw && /^\d+(\.\d+)?$/.test(unitsRaw) ? Number(unitsRaw) : null;

    if (/Fence\s*-/i.test(desc)) {
      if (!lotFields.fencing_type) {
        const tail = desc.split("-")[1] || "";
        for (const candidate of fenceTypePatterns) {
          if (candidate.patterns.some((pattern) => pattern.test(tail))) {
            lotFields.fencing_type = candidate.value;
            break;
          }
        }
      }
      if (!lotFields.fence_height) {
        const heightMatch = desc.match(/(3|4|5|6|8|10|12)\s*'?/);
        if (heightMatch) lotFields.fence_height = `${heightMatch[1]}ft`;
      }
      if (!lotFields.fence_length && unitsNumber != null) {
        if (allowedFenceLengths.has(unitsNumber)) {
          lotFields.fence_length = `${unitsNumber}ft`;
        }
      }
      return;
    }

    if (/Paving\s*-/i.test(desc)) {
      const tail = (desc.split("-")[1] || "").trim();
      if (tail) {
        if (/asphalt/i.test(tail)) pavingTypesSeen.add("Asphalt");
        else if (/concrete/i.test(tail)) pavingTypesSeen.add("Concrete");
        else if (/gravel|shell/i.test(tail)) pavingTypesSeen.add("Gravel");
        else if (/brick/i.test(tail)) pavingTypesSeen.add("Brick");
        else if (/paver/i.test(tail)) pavingTypesSeen.add("Pavers");
        else if (/none|unpaved|dirt/i.test(tail)) pavingTypesSeen.add("None");
      }
      if (unitsNumber != null) {
        lotFields.paving_area_sqft =
          (lotFields.paving_area_sqft || 0) + unitsNumber;
      }
      return;
    }

    if (/Lighting/i.test(desc)) {
      if (!lotFields.site_lighting_type) {
        let lightingType = null;
        if (/security/i.test(desc)) lightingType = "SecurityLight";
        else if (/flood/i.test(desc)) lightingType = "FloodLight";
        else if (/path|walk/i.test(desc)) lightingType = "PathLight";
        else if (/under\s*10'?/i.test(desc) || /bollard/i.test(desc))
          lightingType = "LightStandardUnder10ft";
        else if (/over\s*30'?/i.test(desc) || /high\s*mast/i.test(desc))
          lightingType = "LightStandardOver30ft";
        else if (/outdoor/i.test(desc) || /parking/i.test(desc) || /lot/i.test(desc))
          lightingType = "LightStandard10to30ft";
        else if (/none/i.test(desc)) lightingType = "None";
        if (lightingType) lotFields.site_lighting_type = lightingType;
      }
      if (unitsNumber != null) {
        lotFields.site_lighting_fixture_count =
          (lotFields.site_lighting_fixture_count || 0) + unitsNumber;
      }
    }
  });

  if (pavingTypesSeen.size > 1 && pavingTypesSeen.has("None")) {
    pavingTypesSeen.delete("None");
  }

  if (pavingTypesSeen.size === 1) {
    lotFields.paving_type = [...pavingTypesSeen][0];
  } else if (pavingTypesSeen.size > 1) {
    lotFields.paving_type = "Composite";
  }

  if (lotFields.paving_area_sqft == null) lotFields.paving_area_sqft = null;
  if (lotFields.site_lighting_fixture_count == null)
    lotFields.site_lighting_fixture_count = null;

  return lotFields;
}

const DEED_TYPE_BY_CODE = {
  AG: "Contract for Deed",
  CA: "Court Order Deed",
  CD: "Miscellaneous",
  CE: "Miscellaneous",
  CN: "Contract for Deed",
  CO: "Miscellaneous",
  CT: "Miscellaneous",
  DB: "Miscellaneous",
  DC: "Miscellaneous",
  DR: "Miscellaneous",
  DU: "Miscellaneous",
  FJ: "Court Order Deed",
  GD: "Grant Deed",
  LS: "Miscellaneous",
  ML: "Miscellaneous",
  NN: "Miscellaneous",
  OR: "Personal Representative Deed",
  PB: "Administrator's Deed",
  PR: "Personal Representative Deed",
  PT: "Miscellaneous",
  QC: "Quitclaim Deed",
  RD: "Right of Way Deed",
  SD: "Sheriff's Deed",
  TD: "Trustee's Deed",
  UD: "Miscellaneous",
  WD: "Warranty Deed",
  XD: "Tax Deed",
};

function mapDeedType(deedCode, deedTitle) {
  const code = (deedCode || "").trim().toUpperCase();
  const title = (deedTitle || "").trim().toUpperCase();
  const combined = `${code} ${title}`.trim();
  if (!combined) return null;

  const patterns = [
    { type: "Special Warranty Deed", regex: /(SPECIAL\s+WARRANTY|\bSWD\b)/ },
    { type: "Warranty Deed", regex: /\bWARRANTY\b|\bWD\b/ },
    { type: "Quitclaim Deed", regex: /QUIT\s*CLAIM|\bQCD\b|\bQC\s*DEED\b/ },
    { type: "Grant Deed", regex: /GRANT\s+DEED|\bGR\s*DEED\b/ },
    { type: "Bargain and Sale Deed", regex: /BARGAIN\s+AND\s+SALE|\bBSD\b/ },
    {
      type: "Lady Bird Deed",
      regex: /LADY\s*BIRD|ENHANCED\s+LIFE\s+ESTATE/,
    },
    { type: "Transfer on Death Deed", regex: /TRANSFER\s+ON\s+DEATH|\bTODD?\b/ },
    { type: "Sheriff's Deed", regex: /SHERIFF/ },
    { type: "Tax Deed", regex: /TAX\s+DEED/ },
    { type: "Trustee's Deed", regex: /TRUSTEE|TR\s*DEED/ },
    {
      type: "Personal Representative Deed",
      regex: /PERSONAL\s+REP|PR\s*DEED/,
    },
    { type: "Correction Deed", regex: /CORRECTION|CORRECTIVE/ },
    {
      type: "Deed in Lieu of Foreclosure",
      regex: /DEED\s+IN\s+LIEU|\bDIL\b/,
    },
    { type: "Life Estate Deed", regex: /LIFE\s+ESTATE/ },
    { type: "Joint Tenancy Deed", regex: /JOINT\s+TENANCY|\bJT\s+TEN\b/ },
    {
      type: "Tenancy in Common Deed",
      regex: /TENANCY\s+IN\s+COMMON|\bTIC\b/,
    },
    {
      type: "Community Property Deed",
      regex: /COMMUNITY\s+PROPERTY|COMM\s+PROP/,
    },
    { type: "Gift Deed", regex: /GIFT\s+DEED|\bGIFT\b/ },
    {
      type: "Interspousal Transfer Deed",
      regex: /INTERSPOUSAL|INTER\s+SPOUSAL/,
    },
    { type: "Wild Deed", regex: /WILD\s+DEED/ },
    { type: "Special Master’s Deed", regex: /SPECIAL\s+MASTER/ },
    { type: "Court Order Deed", regex: /COURT\s+ORDER/ },
    {
      type: "Contract for Deed",
      regex: /CONTRACT\s+FOR\s+DEED|\bCFD\b|LAND\s+CONTRACT/,
    },
    { type: "Quiet Title Deed", regex: /QUIET\s+TITLE/ },
    { type: "Administrator's Deed", regex: /ADMINISTRAT/ },
    { type: "Guardian's Deed", regex: /GUARDIAN/ },
    { type: "Receiver's Deed", regex: /RECEIVER/ },
    {
      type: "Right of Way Deed",
      regex: /RIGHT\s+OF\s+WAY|\bR\/W\b|\bR\.?O\.?W\.?\b|\bROW\b/,
    },
    {
      type: "Vacation of Plat Deed",
      regex: /VACATION\s+OF\s+PLAT|PLAT\s+VACATION/,
    },
    {
      type: "Assignment of Contract",
      regex: /ASSIGNMENT\s+OF\s+CONTRACT|ASSIGN(?:MENT)?\s+CONTRACT/,
    },
    {
      type: "Release of Contract",
      regex: /RELEASE\s+OF\s+CONTRACT|RELEASE(?:D)?\s+CONTRACT/,
    },
  ];

  for (const { type, regex } of patterns) {
    if (regex.test(combined)) return type;
  }

  const directType = DEED_TYPE_BY_CODE[code];
  return directType || null;
}
function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
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


// const utilitiesPath = path.join("owners", "utilities_data.json");
const layoutsPath = path.join("owners", "layout_data.json");
// const structuresPath = path.join("owners", "structure_data.json");
// const utilitiesData = null;
// const layoutsData = null;
// const structuresData = null;
const seed = readJSON("property_seed.json");
const appendSourceInfo = (seed) => ({
  source_http_request: {
    method: "GET",
    url: seed?.source_http_request?.url || null,
  },
  request_identifier: seed?.request_identifier || seed?.parcel_id || "",
  });

// try {
//   structuresData = readJSON(structuresPath);
// } catch (e) {}
// try {
//   utilitiesData = readJSON(utilitiesPath);
// } catch (e) {}
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

  const propertyId =
    seed.request_identifier || (seed.parcel_id || "").replace(/\D/g, "");

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




  // ---------- Parse Property ----------
  const parcelId = $("#divDetails_Pid").text().trim() || null;

  // Legal description
  let legalDesc = null;
  $("#divInfo_Description .cssDetails_Top_Row").each((i, el) => {
    const label = $(el).find(".cssDetails_Top_Cell_Label").text().trim();
    if (label && label.match(/Land Description:/i)) {
      legalDesc = $(el).find(".cssDetails_Top_Cell_Data").text().trim() || null;
    }
  });

  // Subdivision name
  let subdivision = null;
  $("#divInfo_Description .cssDetails_Top_Row").each((i, el) => {
    const label = $(el).find(".cssDetails_Top_Cell_Label").text().trim();
    if (label && label.match(/Subdivision Name:/i)) {
      const t = $(el).find(".cssDetails_Top_Cell_Data").text().trim();
      subdivision = t && t !== "--" ? t : null;
    }
  });

  // Extract Property Use and map to property_type
  let units = null;
  const useText = $("#divInfo_Description .cssDetails_Top_Row")
    .filter((i, el) => {
      return /Property Use:/i.test(
        $(el).find(".cssDetails_Top_Cell_Label").text(),
      );
    })
    .first()
    .find(".cssDetails_Top_Cell_Data")
    .text()
    .trim();

  // Map use code to get all property required fields
  // console.log(useText)
  // const cleanedUseCodeText = useText.replace(/-/g, '').replace(/\s+/g, ' ').trim();
  // console.log(cleanedUseCodeText)
  
  const property_type = mapPropertyTypeFromUseCode(useText || "");
  // console.log("property_type>>",property_type);
  const ownership_estate_type=mapOwnershipEstateTypeFromUseCode(useText || "");
  const build_status= mapBuildStatusFromUseCode(useText || "");
  const structure_form = mapStructureFormFromUseCode(useText || "");
  const property_usage_type = mapPropertyUsageTypeFromUseCode(useText || "");
  console.log(useText,property_type,ownership_estate_type,build_status,structure_form,property_usage_type)

  // Acres
  const acresText = $("#divInfo_Description .cssDetails_Top_Row")
    .filter((i, el) => {
      return /Total Acres:/i.test(
        $(el).find(".cssDetails_Top_Cell_Label").text(),
      );
    })
    .first()
    .find(".cssDetails_Top_Cell_Data")
    .text()
    .trim();
  const acres = acresText ? Number(acresText.replace(/[^0-9.]/g, "")) : null;

  // Building details: year built, units, floors, story height
  const bldgDetails = {};
  let totalResidentialUnits = 0;
  let totalCommercialUnits = 0;
  $("#divBldg_Details table tbody tr").each((i, el) => {
    const label = $(el).find("td").first().text().trim();
    const val = $(el).find("td").last().text().trim();
    if (/Year Built:/i.test(label)) bldgDetails.yearBuilt = parseIntOrNull(val);
    if (/Residential Units:/i.test(label))
      totalResidentialUnits += parseIntOrNull(val) || 0;
    if (/Commercial Units:/i.test(label))
      totalCommercialUnits += parseIntOrNull(val) || 0;
    if (/Floors:/i.test(label)) bldgDetails.floors = parseIntOrNull(val);
    if (/Story Height:/i.test(label))
      bldgDetails.storyHeight = parseIntOrNull(val);
  });
  bldgDetails.numberOfUnits = totalResidentialUnits + totalCommercialUnits;



  // Sub-areas: Total Base Area, Total Sub Area

  //constructing property json
  const property = {
    ...appendSourceInfo(seed),
    number_of_units: bldgDetails.numberOfUnits ?? null,
    parcel_identifier: parcelId || "",
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: bldgDetails.yearBuilt ?? null,
    property_type: property_type || null, // Now extracted from Property Use
    subdivision: subdivision,
    zoning: null,
    ownership_estate_type: ownership_estate_type,
    build_status: build_status,
    structure_form:structure_form,
    property_usage_type:property_usage_type    
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // ---------- Address parsing and files creation logic ----------
  const siteAddr = $(
    "#divDetails_Top_SiteAddressContainer .cssDetails_Top_SiteAddress",
  )
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const mailingAddressRaw = extractMailingAddress($);
  // console.log("MAILING address",mailingAddressRaw)

  const validDirectionals = ["N", "S", "E", "W", "NE", "NW", "SE", "SW"];
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    street_pre_directional_text = null,
    street_post_directional_text = null,
    city_name = null,
    state_code = null,
    postal_code = null;

  if (siteAddr) {
    // Match pattern: "1910 N COCOA BLVD COCOA FL 32922"
    const addrMatch = siteAddr.match(
      /^(\d+)\s+(?:(N|S|E|W|NE|NW|SE|SW)\s+)?(.+?)\s+(?:(N|S|E|W|NE|NW|SE|SW)\s+)?([A-Z]+)\s+([A-Z\s]+)\s+([A-Z]{2})\s+(\d{5})$/i,
    );

    if (addrMatch) {
      street_number = addrMatch[1];
      const preDir = addrMatch[2];
      let streetPart = addrMatch[3].trim();
      const postDir = addrMatch[4];
      const suffix = addrMatch[5];
      city_name = addrMatch[6].trim();
      state_code = addrMatch[7];
      postal_code = addrMatch[8];

      // Determine if we have pre or post directional
      if (preDir && validDirectionals.includes(preDir.toUpperCase())) {
        street_pre_directional_text = preDir.toUpperCase();
        street_name = streetPart;
      } else if (postDir && validDirectionals.includes(postDir.toUpperCase())) {
        street_post_directional_text = postDir.toUpperCase();
        street_name = streetPart;
      } else {
        street_name = streetPart;
      }

      // Map suffix
      street_suffix_type = mapStreetSuffix(suffix);
    } else {
      // Fallback to simple parsing
      const parts = siteAddr.split(/\s+/);
      street_number = parts.shift() || null;
      postal_code = parts.pop() || null;
      state_code = parts.pop() || null;
      city_name = parts.pop() || null;
      const maybeSuffix = parts.length > 0 ? parts[parts.length - 1] : null;
      if (maybeSuffix && /^[A-Z]{2,}$/.test(maybeSuffix)) {
        street_suffix_type = mapStreetSuffix(maybeSuffix);
        if (street_suffix_type) parts.pop();
      }
      street_name = parts.join(" ") || null;
    }
  }

  // township-range-section-block from parcel id
  let township = null,
    range = null,
    section = null,
    blockVal = null,
    lotVal = null;
  if (parcelId) {
    const toks = parcelId.split("-");
    if (toks.length >= 5) {
      township = toks[0] || null;
      range = toks[1] || null;
      section = toks[2] || null;
      blockVal = toks[4] || null;
    }
  }
  // console.log("0000-",siteAddr)
  
  // Count total siteAddr
  const totalSiteAddr = $("#divDetails_Top_SiteAddressContainer .cssDetails_Top_SiteAddress").length;
  console.log("Total siteAddr count:", totalSiteAddr);
  
  if (totalSiteAddr > 1) {
    throw new Error(`Multiple site addresses found: ${totalSiteAddr}`);
  }

  const address = {
    ...appendSourceInfo(seed),
    county_name: unAddr.county_jurisdiction || "Brevard",
    latitude: unAddr.latitude ?? null,
    longitude: unAddr.longitude ?? null,
    range: range || null,
    section: section || null,
    township: township || null,
    unnormalized_address: siteAddr || null
  };
  writeJSON(path.join(dataDir, "address.json"), address);


  //MAILING ADDRESS FILES.
  if (mailingAddressRaw) {
    const mailingAddressOutput = {
      ...appendSourceInfo(seed),
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddressRaw,
    };
    writeJSON(path.join(dataDir, "mailing_address.json"), mailingAddressOutput);
  }
  

  // ---------- Sales, Deed, File ----------
  const salesRows = $("#tSalesTransfers tbody tr");
  let personFilesByKey = {};
  let companyFilesByKey = {};
  let saleOwnersNormKeys = [];
  let salesFileIndex = 1;

  salesRows.each((index, row) => {
    const $row = $(row);
    const dateText = $row.find("td").eq(0).text().trim();
    const priceText = $row.find("td").eq(1).text().trim();
    const typeCell = $row.find("td").eq(2);
    const deedCode = typeCell.text().trim();
    const deedTitle = typeCell.find("a").attr("title") || "";
    const instrumentCell = $row.find("td").eq(3);
    const instrumentValue = instrumentCell.text().trim() || null;
    const deedLink = instrumentCell.find("a").attr("href") || null;

    const purchasePrice = parseMoney(priceText);

  
    const sale = {
      ...appendSourceInfo(seed),
      ownership_transfer_date: toISODate(dateText),
    };
    if (purchasePrice !== null) {
      sale.purchase_price_amount = purchasePrice;
    }
    writeJSON(path.join(dataDir, `sales_${salesFileIndex}.json`), sale);

    // Map deed code/title to deed_type
    // console.log(deedCode)
    const deedType = mapDeedType(deedCode, deedTitle);

    // console.log(deedType)
    const deed = {...appendSourceInfo(seed)};
    if (deedType) {
      deed.deed_type = deedType;
    }
    if (instrumentValue) {
      deed.instrument_number = instrumentValue;
      const parts = instrumentValue.split("/");
      if (parts.length === 2) {
        deed.book = parts[0].trim();
        deed.page = parts[1].trim();
      }
    }
    writeJSON(path.join(dataDir, `deed_${salesFileIndex}.json`), deed);

    const fileObj = {
      ...appendSourceInfo(seed),
      document_type: "Title", //document_Type for deed.
      name: null,
      original_url: deedLink || null,
    };
    writeJSON(path.join(dataDir, `file_${salesFileIndex}.json`), fileObj);

    const relSalesDeed = {
      from: { "/": `./sales_${salesFileIndex}.json` },
      to: { "/": `./deed_${salesFileIndex}.json` }
    };
    writeJSON(
      path.join(dataDir, `relationship_sales_deed_${salesFileIndex}.json`),
      relSalesDeed,
    );

    const relDeedFile = {
      from: { "/": `./deed_${salesFileIndex}.json` },
      to: { "/": `./file_${salesFileIndex}.json` }
    };
    writeJSON(
      path.join(dataDir, `relationship_deed_file_${salesFileIndex}.json`),
      relDeedFile,
    );

    salesFileIndex++; // Only increment when we actually create files
  
  });
  // console.log(salesFileIndex)

  //Create Person/company files
  const ownersKey = `property_${propertyId}`;
  const ownersByDate = ownersData[ownersKey]?.owners_by_date || {};
  const currentOwners = ownersByDate["current"] || [];

  const combined = [...currentOwners];
  const uniquePersons = [];
  const uniqueCompanies = [];
  const seenPersons = new Set();
  const seenCompanies = new Set();
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
      prefix_name: o.prefix_name || null,
      suffix_name: o.suffix_name || null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const pFile = `person_${idx + 1}.json`;
    writeJSON(path.join(dataDir, pFile), person);
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
    writeJSON(path.join(dataDir, cFile), company);
    companyFilesByKey[entry.key] = cFile;
  });


  // Create sales --> owners file if there is atleast 1 sale file.
  if (salesFileIndex > 1) {
    // gFind the first row that actually has a price
    let firstSaleRow = null;
    salesRows.each((index, row) => {
      const $row = $(row);
      const priceText = $row.find("td").eq(1).text().trim();
      if (parseMoney(priceText) !== null && !firstSaleRow) {
        firstSaleRow = $row;
        return false; // break the loop
      }
    });
    // console.log(firstSaleRow)
    if (firstSaleRow) {

      // Relationships from sales to owners
      // console.log("sale owners",saleOwners);
      let relIdx = 0;
      // console.log(personFilesByKey)
      currentOwners.forEach((o) => {
        // console.log("relIdx",relIdx);
        if (o && o.type === "person") {
          const key = normalizeOwnerKey(o);
          const pf = personFilesByKey[key];
          if (pf) {
            relIdx += 1;
            const rel = {
              from: { "/": "./sales_1.json" },
              to: { "/": `./${pf}` }
            };
            writeJSON(
              path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
              rel,
            );
          }
        } else if (o && o.type === "company") {
          const key = normalizeCompanyKey(o);
          const cf = companyFilesByKey[key];
          if (cf) {
            relIdx += 1;
            const rel = {
              from: { "/": "./sales_1.json" },
              to: { "/": `./${cf}` }
            };
            writeJSON(
              path.join(dataDir, `relationship_sales_company_${relIdx}.json`),
              rel,
            );
          }
        }
      });
    }
  }

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
        writeJSON(
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
        writeJSON(
          path.join(dataDir, `relationship_company_has_mailing_address${relIdx}.json`),
          rel,
        );
      }
    }
  });  



  // ---------- Taxes (Value table) ----------
  const valuesTable = $("#tValues");
  if (valuesTable.length) {
    const headYears = [];
    valuesTable.find("thead th").each((i, th) => {
      if (i === 0) return; // skip Category
      headYears.push(parseIntOrNull($(th).text().trim()));
    });
    const rows = {};
    valuesTable.find("tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const label = $(tds[0]).text().trim();
      const vals = [];
      for (let c = 1; c < tds.length; c++) vals.push($(tds[c]).text().trim());
      rows[label] = vals;
    });

    headYears.forEach((yr, idx) => {
      if (!yr) return;
      const market = parseMoney(rows["Market Value:"]?.[idx]);
      const assessed = parseMoney(rows["Assessed Value Non-School:"]?.[idx]);
      const taxable = parseMoney(rows["Taxable Value Non-School:"]?.[idx]);
      if (market != null && assessed != null && taxable != null) {
        const tax = {
          ...appendSourceInfo(seed),
          first_year_building_on_tax_roll: null,
          first_year_on_tax_roll: null,
          monthly_tax_amount: null,
          period_end_date: null,
          period_start_date: null,
          property_assessed_value_amount: assessed,
          property_building_amount: null,
          property_land_amount: null,
          property_market_value_amount: market,
          property_taxable_value_amount: taxable,
          tax_year: yr,
          yearly_tax_amount: null,
        };
        writeJSON(path.join(dataDir, `tax_${yr}.json`), tax);
      }
    });
  }

  //------Structure (owners/structures_data.json)---------------
  createStructureFiles(seed,propertyId);

  // ---------- Utilities (owners/utilities_data.json) ----------
  createUtilitiesFiles(seed,propertyId);

  // ---------- Layouts (owners/layout_data.json) ----------

  createLayoutFiles(seed,propertyId);


  // ---------- Lot ----------
  const lotExtras = extractLotFeaturesFromExtra($);
  const lotOut = {
    ...appendSourceInfo(seed),
    driveway_condition: null,
    driveway_material: null,
    fence_height: lotExtras?.fence_height ?? null,
    fence_length: lotExtras?.fence_length ?? null,
    fencing_type: lotExtras?.fencing_type ?? null,
    landscaping_features: null,
    lot_area_sqft: acres != null ? Math.round(acres * 43560) : null,
    lot_condition_issues: null,
    lot_length_feet: null,
    lot_size_acre: acres != null ? acres : null,
    lot_type: null,
    lot_width_feet: null,
    view: null,
    paving_area_sqft: lotExtras?.paving_area_sqft ?? null,
    paving_type: lotExtras?.paving_type ?? "None",
    site_lighting_fixture_count: lotExtras?.site_lighting_fixture_count ?? null,
    site_lighting_type: lotExtras?.site_lighting_type ?? "None",
  };

  writeJSON(path.join(dataDir, "lot.json"), lotOut);
}

main();
