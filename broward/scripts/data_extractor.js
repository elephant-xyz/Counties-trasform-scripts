const fs = require("fs");
const path = require("path");

const propertyUseCodeMappings=[
  {
    "property_usecode": "00-01 VACANT RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "00-02 VACANT RESIDENTIAL LAND - CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "00-03 VACANT RESIDENTIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "00-04 VACANT RESIDENTIAL WITH EXTRA FEATURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "01-01 SINGLE FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "01-02 HOUSE W/GUEST HOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "01-03 (EXTRA FEATURES ONLY) - MISCELLANEOUS (BARN, EXTRA FEATURES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "01-04 TOWNHOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "01-05 SINGLE FAMILY ZERO LOT LINE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "01-06 ATTACHED 1-STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "01-07 SINGLE FAMILY - GROUP HOME/ALF",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "02-01 MANUFACTURED/MODULAR HOUSING - SINGLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingSingleWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "02-02 MANUFACTURED/MODULAR HOUSING - DOUBLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "02-03 MANUFACTURED/MODULAR HOUSING - TRIPLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousingMultiWide",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "02-04 MANUFACTURED/MODULAR HOUSING - SITE IMPROVEMENTS ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "02-99 MANUFACTURED/MODULAR HOUSING NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "03-01 MULTI-FAMILY 10 TO 49 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "03-02 MULTI-FAMILY 50 TO 99 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "03-03 MULTI-FAMILY 100 UNITS +",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "03-04 MULTI-FAMILY - LOW INCOME HOUSING TAX CREDIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "03-05 LOW END HOUSING (MULTIPLE PARCELS OPERATING AS ONE INCOME PRODUCING PROPERTY)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "03-99 MULTI-FAMILY NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "04-01 CONDOMINIUM - RESIDENTIAL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "04-02 CONDOMINIUM - RESIDENTIAL SINGLE FAMILY HOME / ZERO LOT",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "04-03 CONDOMINIUM - MANUFACTURED HOME",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "MobileHomePark",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "04-04 CONDOMINIUM - TIMESHARE / INTERVAL OWNERSHIP",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "04-05 CONDOMINIUM - LIMITED COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "04-06 CONDOMINIUM - ASSOCIATION OWNED COMMON AREA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "04-28 CONDOMINIUM - PARKING SPACE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Unit"
  },
  {
    "property_usecode": "04-99 CONDOMINIUM NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-01 COOPERATIVES - RESIDENTIAL",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-02 COOPERATIVES - RESIDENTIAL SINGLE FAMILY HOME",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-03 COOPERATIVES - MANUFACTURED HOUSE - SINGLE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "MobileHomePark",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-04 COOPERATIVES - MANUFACTURED HOUSE - DOUBLE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "MobileHomePark",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-05 COOPERATIVES - MANUFACTURED HOUSE - TRIPLE",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "MobileHomePark",
    "property_type": "Unit"
  },
  {
    "property_usecode": "05-06 COOPERATIVES - MANUFACTURED HOME",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "MobileHomePark",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "05-07 COOPERATIVES - LIMITED COMMON AREA",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "05-08 COOPERATIVES - ASSOCIATION OWNED COMMON AREA",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "05-99 COOPERATIVES NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "06-01 RETIREMENT HOMES (NOT ELIGIBLE FOR EXEMPTION UNDER SECTION)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "06-99 RETIREMENT HOME FACILITY NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "07-01 MISCELLANEOUS RESIDENTIAL (MIGRANT CAMP, BOARDING HOMES, ETC,)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "07-02 MICS. VALUE ON SEPARATE FOLIO (POOL, CABANAS, REC. BLDGS. TENNIS COURTS, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "07-03 MISCELLANEOUS RESIDENTIAL AIR RIGHTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "07-99 MISCELLANEOUS RESIDENTIAL NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "08-01 DUPLEX WITH GUEST HOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-02 MULTI-FAMILY 2 UNITS - DUPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-03 MULTI-FAMILY 3 UNITS -TRIPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-04 MULTI-FAMILY 4 UNITS - QUADPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-05 MULTI-FAMILY 5 - 9 UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-06 SINGLE FAMILY HOUSE WITH 2 OR MORE RENTAL UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-07 THREE OR MORE SINGLE FAMILY HOMES WITH 3 OR MORE RENTAL UNITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-08 TWO OR MORE TOWNHOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-09 TWO OR MORE MANUFACTURED HOMES (NOT A PARK)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-10 TRANSITIONAL HOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-11 LOW END HOUSING (MULTIPLE PARCELS OPERATING AS ONE INCOME PRODUCING PROPERTY)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "08-99 MULTI-FAMILY IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "09-00 UNDEFINED - RESERVED FOR USE BY DEPARTMENT OF REVENUE ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "09-01 MISCELLANEOUS RESIDENTIAL (MIGRANT CAMP, BOARDING HOMES, ETC,)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "09-02 MICS. VALUE ON SEPARATE FOLIO (POOL, CABANAS, REC. BLDGS. TENNIS COURTS, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "09-03 MISCELLANEOUS RESIDENTIAL AIR RIGHTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "09-28 MISCELLANEOUS RESIDENTIAL PARKING GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "09-99 MISCELLANEOUS RESIDENTIAL NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-01 VACANT COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-02 VACANT COMMERCIAL WITH EXTRA FEATURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-03 VACANT COMMERCIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-04 VACANT COMMERCIAL LAND - CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-05 VACANT LAND UNDER HIGH TENSION WIRES NOT UTILITY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "10-06 VACANT LAND UNDER HIGH TENSION WIRES UTILITY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "11-01 RETAIL STORE - 1 UNIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-02 RETAIL UP TO 4,999 SQ. FT.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-03 RETAIL - 5,000 SQ. FT. TO 20,000 SQ. FT.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-04 CONDOMINIUM - COMMERCIAL RETAIL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "property_usecode": "11-05 RETAIL GREATER THAN 20,000 SQ. FT.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-06 DRUG STORE - FREE STANDING, NOT ATTACHED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-07 DISCOUNT STORE (BRANDS MART, BEST BUY, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-08 WAREHOUSE DISCOUNT STORE (COSTCO, BJ'S, SAM'S CLUB, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-09 HOME IMPROVEMENT CENTER (HOME DEPOT, LOWE'S ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-10 CONVENIENCE STORE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-11 CONVENIENCE STORE WITH GAS PUMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-12 CONVENIENCE STORE WITH DRIVE-THRU",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-13 FLEA MARKET / SWAP MEET",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-14 RETAIL - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-15 FITNESS CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "11-99 RETAIL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "12-01 MIXED STORE OR OFFICE AND RESIDENTIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-02 MIXED STORE AND OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-03 MIXED STORE AND WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-04 MISCELLANEOUS MIXED USES NOT INCLUDED IN OTHER CODES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-05 OFFICE AND RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-06 APARTMENT WITH GROUND FLOOR RETAIL (MULTIPLE TENANTS ON GROUND FLOOR)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "12-99 MIXED USE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "13-01 DEPARTMENT STORES (MACY'S, SEARS, J.C. PENNY, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "13-02 DISCOUNT DEPARTMENT STORES (WAL-MART, KMART, TARGET, ETC.) *",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "13-03 SUPER DISCOUNT DEPARTMENT STORES W/GROCERY (WAL-MART, KMART, TARGET, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "13-99 DEPARTMENT STORES NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "14-01 SUPERMARKETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "14-02 SUPERMARKETS (NOT CHAIN)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "14-99 SUPERMARKETS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "15-01 REGIONAL SHOPPING CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "15-99 REGIONAL SHOPPING CENTER NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "16-01 SHOPPING CENTER - COMMUNITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "16-02 SHOPPING CENTER - NEIGHBORHOOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "16-99 SHOPPING CENTER NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-01 OFFICE BUILDING - NON PROFESSIONAL, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-02 OFFICE - MODULAR BUILDING, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-03 OFFICE BUILDING / WAREHOUSE, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-04 CONDOMINIUM OFFICE, 1 STORY",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "17-05 OFFICE BUILDING / RETAIL, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-06 OFFICE BUILDING - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-07 OFFICE COMPLEX, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-08 POST OFFICE - NON EXEMPT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "17-99 OFFICE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-01 OFFICE BUILDING, SINGLE TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-02 OFFICE BUILDING, MULTI TENANT - 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-03 OFFICE BUILDING, MULTI STORY / TENANT WITH BANK ON 1ST FLOOR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-04 CONDOMINIUM OFFICE, MULTI STORY",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "18-05 OFFICE BUILDING, MULTI STORY / TENANT WITH RETAIL ON 1ST FLOOR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-06 OFFICE BUILDING - MULTI STORY - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-07 OFFICE BUILDING, MULTI STORY WITH WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-08 OFFICE COMPLEX, MULTI STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "18-99 OFFICE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-01 PROFESSIONAL BUILDING - SINGLE TENANT, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-02 PROFESSIONAL BUILDING - MULTI TENANT, 1 STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-03 PROFESSIONAL BUILDING - SINGLE TENANT, 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-04 CONDOMINIUM PROFESSIONAL BUILDING",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "property_usecode": "19-05 PROFESSIONAL BUILDING - MULTI TENANT, 2 OR MORE STORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-06 PROFESSIONAL BUILDING - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-07 PROFESSIONAL OFFICE COMPLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-08 DAY CARE CENTER / FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-09 DAY CARE CENTER / FACILITY - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-10 MEDICAL - DOCTOR / DENTIST OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-11 MEDICAL - DOCTOR / DENTIST OFFICE - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-12 VETERINARIAN OFFICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-13 VETERINARIAN OFFICE - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-14 ANIMAL HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-15 ANIMAL KENNEL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-16 ANIMAL HOSPITAL / KENNEL - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-17 RADIO OR TV STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "19-99 PROFESSIONAL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "20-01 AIRPORTS - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-02 AIRPORTS - COMMERCIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-03 BUS TERMINALS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-04 CONDOMINIUM MARINAS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "TransportationTerminal",
    "property_type": "Unit"
  },
  {
    "property_usecode": "20-05 CONDOMINIUM BOAT DOCKS / SLIPS",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "TransportationTerminal",
    "property_type": "Unit"
  },
  {
    "property_usecode": "20-06 DRY BOAT STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-07 MARINA - REPAIR FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-08 MARINA - BOAT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-09 MARINA - MIXED USE (RETAIL STORE/RESTAURANTS/DOCKS)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-10 MARINA - YACHT CLUB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-11 MARINA - SLIPS / RACK STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-12 MARINA - SLIPS / GROUND STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-13 MARINA - SLIPS / BOAT SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-14 PIERS - FISHING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "20-15 DEEDED BOAT SLIP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "20-16 MARINA - EXTRA FEATURES ONLY/NO BLDG SQUARE FOOTAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "20-99 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "21-01 RESTAURANTS - NON FRANCHISE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-02 RESTAURANTS - FRANCHISE SIT DOWN (OLIVE GARDEN, BENNIGANS, RED LOBSTER, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-03 RESTAURANTS - CARRYOUT / DELIVERY ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-04 RESTAURANTS - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-05 CAFETERIAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-06 RESTAURANTS - CONVERTED WAREHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "21-99 RESTAURANT IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "22-01 RESTAURANTS - FAST FOOD, FRANCHISE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "22-02 RESTAURANTS - FAST FOOD, NON-FRANCHISE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "22-03 RESTAURANTS, DRIVE IN ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "22-99 FAST FOOD / DRIVE-IN RESTAURANT IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "23-01 FINANCIAL INSTITUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "23-02 FINANCIAL INSTITUTION - BRANCH FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "23-03 FINANCIAL INSTITUTION - DRIVE-IN ONLY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "23-04 FINANCIAL INSTITUTION - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "23-99 FINANCIAL INSTITUTION IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "24-01 INSURANCE COMPANY OFFICES, SINGLE OR MULTI STORY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "24-02 INSURANCE COMPANY OFFICES, SINGLE OR MULTI STORY - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "24-99 INSURANCE COMPANY OFFICE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "25-01 REPAIR SERVICE SHOPS (EXCLUDING AUTOMOTIVE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "25-02 COMMERCIAL LAUNDRY / DRY CLEANER (NOT COIN LAUNDRY)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "25-03 LAUNDROMAT / COIN LAUNDRY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "25-99 REPAIR / LAUNDRY IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "26-01 SERVICE STATION (WITH AUTO REPAIR)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "26-02 SERVICE STATION (WITH SMALL CONVENIENCE STORE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "26-03 SERVICE STATION (WITH TENANT - SUBWAY, PIZZA HUT, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "26-04 TRUCK STOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "26-99 SERVICE FACILITY / TRUCK STOP IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-01 AUTO DEALERSHIP SALES / FULL SERVICE CENTER",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-02 AUTO DEALERSHIP SALES / FULL SERVICE CENTER WITH PARKING GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-03 USED AUTOMOBILE SALES, INDEPENDENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-04 GARAGE / AUTO BODY / AUTO PAINT SHOP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-05 TRUCK SALES / SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-06 MANUFACTURED HOME SALES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "AutoSalesRepair",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "27-07 RV SALES / SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-08 CARWASH (FULL SERVICE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-09 CARWASH ( SELF-SERVICE)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-10 QUICK LUBE FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-11 TIRE DEALER SALES / REPAIR",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-12 FARM AND MACHINERY SALES / SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-13 AUTO RENTAL / LEASING FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "27-99 AUTO / MARINE FACILITY IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "28-01 PARKING LOT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "28-02 PARKING GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "28-03 MANUFACTURED HOME PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "28-04 RV PARK",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "28-05 INDIVIDUALLY OWNED MHP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "28-99 USE CODE 28 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "29-01 WHOLESALE OUTLETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "29-02 PRODUCE HOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "29-03 MANUFACTURING OUTLETS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "Building"
  },
  {
    "property_usecode": "29-99 USE CODE 29 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "WholesaleOutlet",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "30-01 FLORIST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "30-02 GREENHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "30-03 NURSERY (NON-AGRICULTURAL CLASSIFICATION)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "30-99 USE CODE 30 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "31-01 THEATRE (DRIVE-IN)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "31-02 STADIUM (NOT ENCLOSED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "31-99 THEATRE / STADIUM IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "32-01 THEATRE (ENCLOSED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "32-02 AUDITORIUM (ENCLOSED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "32-99 THEATRE / AUDITORIUM IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-01 NIGHTCLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-02 BARS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-03 YACHT CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-04 TENNIS CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-05 CLUBHOUSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-06 SOCIAL CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "33-99 USE CODE 33 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "34-01 BOWLING ALLEYS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "34-02 SKATING RINKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "34-03 POOL / BILLIARD HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "34-04 ENCLOSED ARENAS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "34-05 ENCLOSED ENTERTAINMENT (INDOOR - ARCADE, SKATING RINK, POOL HALL, BOWLING ALLEY, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "34-99 USE CODE 34 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "35-01 TOURIST ATTRACTIONS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "35-02 PERMANENT EXHIBITS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "35-03 ENTERTAINMENT FACILITIES (MINI GOLF, GO-CARTS, ETC.)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "35-04 AMUSEMENT PARKS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "35-05 FAIRGROUNDS (PRIVATELY OWNED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "35-99 USE CODE 35 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "36-01 CAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "36-99 CAMP IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "37-01 RACE TRACK - HORSE WITH CASINO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "37-02 RACE TRACK - DOG WITH CASINO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "37-03 RACE TRACK - AUTO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "37-04 JAI-ALAI FRONTON",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "37-05 CASINO",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "37-99 USE CODE 37 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-01 GOLF COURSE - PUBLIC, PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-02 GOLF COURSE - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-03 GOLF COURSE - MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-04 GOLF COURSE - EXECUTIVE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-05 GOLF COURSE - PAR THREE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-06 GOLF DRIVING RANGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-07 GOLF COURSE - MAINT SHED / WHSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "38-99 GOLF COURSE / DRIVING RANGE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "39-01 HOTEL - LIMITED SERVICE WITH FOOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-02 HOTEL - LIMITED SERVICE WITHOUT FOOD",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-03 HOTEL - FULL SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-04 HOTEL - SUITE / EXTENDED STAY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-05 CONDOMINIUM - HOTEL / MOTEL",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "property_usecode": "39-06 HOTEL - LUXURY RESORT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-07 HOTEL - CONVENTION CENTER, RESORT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-08 MOTEL - NO RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-09 MOTEL - WITH RESTAURANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-10 BED AND BREAKFAST",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "39-99 HOTEL / MOTEL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "40-01 VACANT INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "40-02 VACANT INDUSTRIAL WITH EXTRA FEATURES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "40-03 VACANT INDUSTRIAL COMMON AREA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "40-04 VACANT INDUSTRIAL LAND - CONDOMINIUM",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "41-01 LIGHT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-02 SMALL EQUIPMENT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-03 SMALL MACHINE SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-04 INSTRUMENT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-05 PRINTING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-06 MISCELLANEOUS INDUSTRIAL FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "41-99 MANUFACTURING IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "42-01 HEAVY INDUSTRIAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-02 HEAVY EQUIPMENT MANUFACTURING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-03 LARGE MACHINE SHOPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-04 FOUNDRIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-05 STEEL FABRICATING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-06 AUTO OR AIRCRAFT PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "42-99 HEAVY INDUSTRIAL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "43-01 LUMBER YARDS, SAWMILLS, PLANING MILLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "43-99 LUMBER YARD / MILL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "44-01 PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "44-02 FRUIT AND VEGETABLE PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "44-03 MEAT PACKING PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "44-99 PACKING PLANT IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "45-01 CANNERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "45-02 FRUIT AND VEGETABLE PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "45-03 BOTTLERS AND BREWERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "45-04 DISTILLERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "property_usecode": "45-99 USE CODE 45 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "46-01 FOOD PROCESSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "46-02 BAKERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "46-03 CANDY FACTORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "46-04 POTATO CHIP FACTORIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "46-99 USE CODE 46 IMPROVEMENTS NOT SUITABLE FOR PROCESSING / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "47-01 MINERAL PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "47-02 CEMENT / ASPHALT PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "47-03 ROCK AND GRAVEL PLANTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "47-04 REFINERIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "47-99 USE CODE 47 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "48-01 WAREHOUSING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-02 WAREHOUSE - MINI STORAGE (OPEN)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-03 WAREHOUSE - MINI STORAGE ( ENCLOSED)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-04 WAREHOUSE - METAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-05 CONDOMINIUM - WAREHOUSE",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "property_usecode": "48-06 WAREHOUSE - PRE FAB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-07 WAREHOUSE - TRUCK TERMINAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-08 WAREHOUSE - DISTRIBUTION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-09 WAREHOUSE - FLEX",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-10 WAREHOUSE - RETAIL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-11 WAREHOUSE - COLD STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-12 WAREHOUSE - UTILITY BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-13 MISC. VALUE ON SEPARATE FOLIO I.E., FENCE, SLAB (NOT PAVING)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "48-14 WAREHOUSE - TELECOMMUNICATION SWITCH STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "48-99 WAREHOUSE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "49-01 OPEN STORAGE - NEW AND USED BUILDING SUPPLIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "49-02 JUNK YARDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "Building"
  },
  {
    "property_usecode": "49-03 AUTO WRECKING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "49-04 FUEL STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "49-05 EQUIPMENT AND MATERIALS STORAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "49-99 USE CODE 49 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "50-01 IMPROVED AGRICULTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "50-02 IMPROVED AGRICULTURE, CURTILAGE WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "50-03 IMPROVED AGRICULTURE, CURTILAGE WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Agricultural",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "50-04 IMPROVED AGRICULTURE, WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Agricultural",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "50-05 IMPROVED AGRICULTURE, WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "50-99 IMPROVED AGRICULTURE NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "51-01 CROPLAND SOIL CAPABILITY CLASS I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "51-02 CROPLAND SOIL CAPABILITY CLASS I WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "51-03 CROPLAND SOIL CAPABILITY CLASS I WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "DrylandCropland",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "51-04 CROPLAND SOIL CAPABILITY CLASS I WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "DrylandCropland",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "51-05 CROPLAND SOIL CAPABILITY CLASS I WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "51-99 CROPLAND SOIL CAPABILITY CLASS I IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "52-01 CROPLAND SOIL CAPABILITY CLASS II",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "Building"
  },
  {
    "property_usecode": "52-02 CROPLAND SOIL CAPABILITY CLASS II WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "CroplandClass2",
    "property_type": "Building"
  },
  {
    "property_usecode": "52-03 CROPLAND SOIL CAPABILITY CLASS II WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "CroplandClass2",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "52-04 CROPLAND SOIL CAPABILITY CLASS II WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "CroplandClass2",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "52-05 CROPLAND SOIL CAPABILITY CLASS II WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "Building"
  },
  {
    "property_usecode": "52-99 CROPLAND SOIL CAPABILITY CLASS II IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass2",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "53-01 CROPLAND SOIL CAPABILITY CLASS III",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "Building"
  },
  {
    "property_usecode": "53-02 CROPLAND SOIL CAPABILITY CLASS III WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "CroplandClass3",
    "property_type": "Building"
  },
  {
    "property_usecode": "53-03 CROPLAND SOIL CAPABILITY CLASS III WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "CroplandClass3",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "53-04 CROPLAND SOIL CAPABILITY CLASS III WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "CroplandClass3",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "53-05 CROPLAND SOIL CAPABILITY CLASS III WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "Building"
  },
  {
    "property_usecode": "53-99 CROPLAND SOIL CAPABILITY CLASS III IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CroplandClass3",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "54-01 TIMBERLAND - SITE INDEX 90 & ABOVE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "55-01 TIMBERLAND - SITE INDEX 80-89",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "56-01 TIMBERLAND - SITE INDEX 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "57-01 TIMBERLAND - SITE INDEX 60-69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "58-01 TIMBERLAND - SITE INDEX 50-59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "59-01 TIMBERLAND NOT CLASSIFIED BY SITE INDEX TO PINES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "60-01 GRAZING LAND SOIL CAPABILITY CLASS I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "60-02 GRAZING LAND SOIL CAPABILITY CLASS I WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "60-03 GRAZING LAND SOIL CAPABILITY CLASS I WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "60-04 GRAZING LAND SOIL CAPABILITY CLASS I WITH MANUFACTURED HOME ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "60-05 GRAZING LAND SOIL CAPABILITY CLASS I WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "60-99 GRAZING LAND SOIL CAPABILITY CLASS I IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "61-01 GRAZING LAND SOIL CAPABILITY CLASS II",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "61-02 GRAZING LAND SOIL CAPABILITY CLASS II WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "61-03 GRAZING LAND SOIL CAPABILITY CLASS II WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "61-04 GRAZING LAND SOIL CAPABILITY CLASS II WITH MANUFACTURED HOME ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "61-05 GRAZING LAND SOIL CAPABILITY CLASS II WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "61-99 GRAZING LAND SOIL CAPABILITY CLASS II IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "62-01 GRAZING LAND SOIL CAPABILITY CLASS III",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "62-02 GRAZING LAND SOIL CAPABILITY CLASS III WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "62-03 GRAZING LAND SOIL CAPABILITY CLASS III WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "62-04 GRAZING LAND SOIL CAPABILITY CLASS III WITH MANUFACTURED HOME ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "62-05 GRAZING LAND SOIL CAPABILITY CLASS III WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "62-99 GRAZING LAND SOIL CAPABILITY CLASS III IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "63-01 GRAZING LAND SOIL CAPABILITY CLASS IV - CATTLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-02 GRAZING LAND SOIL CAPABILITY CLASS IV - CATTLE WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-03 GRAZING LAND SOIL CAPABILITY CLASS IV - CATTLE WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "63-04 GRAZING LAND SOIL CAPABILITY CLASS IV - CATTLE WITH MH ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-05 GRAZING LAND SOIL CAPABILITY CLASS IV - CATTLE WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-06 GRAZING LAND SOIL CAPABILITY CLASS IV - HORSES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-07 GRAZING LAND SOIL CAPABILITY CLASS IV - HORSES WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-08 GRAZING LAND SOIL CAPABILITY CLASS IV - HORSES WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "63-09 GRAZING LAND SOIL CAPABILITY CLASS IV - HORSES WITH MH ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-10 GRAZING LAND SOIL CAPABILITY CLASS IV - HORSES WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-11 GRAZING LAND SOIL CAPABILITY CLASS IV - GOATS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-12 GRAZING LAND SOIL CAPABILITY CLASS IV - GOATS WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-13 GRAZING LAND SOIL CAPABILITY CLASS IV - GOATS WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "63-14 GRAZING LAND SOIL CAPABILITY CLASS IV - GOATS WITH MH ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-15 GRAZING LAND SOIL CAPABILITY CLASS IV - GOATS WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-16 GRAZING LAND SOIL CAPABILITY CLASS IV - SHEEP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-17 GRAZING LAND SOIL CAPABILITY CLASS IV - SHEEP WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-18 GRAZING LAND SOIL CAPABILITY CLASS IV - SHEEP WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "63-19 GRAZING LAND SOIL CAPABILITY CLASS IV - SHEEP WITH MH ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-20 GRAZING LAND SOIL CAPABILITY CLASS IV - SHEEP WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "63-99 GRAZING LAND SOIL CAPABILITY CLASS IV IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "64-01 GRAZING LAND SOIL CAPABILITY CLASS V",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "64-02 GRAZING LAND SOIL CAPABILITY CLASS V WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "64-03 GRAZING LAND SOIL CAPABILITY CLASS V WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "64-04 GRAZING LAND SOIL CAPABILITY CLASS V WITH MANUFACTURED HOME ON PERSONAL PROP.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "64-05 GRAZING LAND SOIL CAPABILITY CLASS V WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "64-99 GRAZING LAND SOIL CAPABILITY CLASS V IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "65-01 GRAZING LAND SOIL CAPABILITY CLASS VI",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "65-02 GRAZING LAND SOIL CAPABILITY CLASS VI WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "65-03 GRAZING LAND SOIL CAPABILITY CLASS VI WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "GrazingLand",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "65-04 GRAZING LAND SOIL CAPABILITY CLASS VI WITH MH ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "65-05 GRAZING LAND SOIL CAPABILITY CLASS VI WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "65-99 GRAZING LAND SOIL CAPABILITY CLASS VI IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "66-01 ORCHARD GROVES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "66-02 ORCHARD GROVES WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "66-03 ORCHARD GROVES WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "OrchardGroves",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "66-04 ORCHARD GROVES WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "OrchardGroves",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "66-05 ORCHARD GROVES WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "66-99 ORCHARD GROVES IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "67-01 POULTRY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-02 POULTRY WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-03 POULTRY WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Poultry",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-04 POULTRY WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Poultry",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-05 POULTRY WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-06 TROPICAL FISH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Aquaculture",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "67-07 TROPICAL FISH WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Aquaculture",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-08 TROPICAL FISH WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Aquaculture",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-09 TROPICAL FISH WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Aquaculture",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-10 TROPICAL FISH WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Aquaculture",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-11 BEES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-12 BEES WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-13 BEES WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Agricultural",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-14 BEES WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Agricultural",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-15 BEES WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-21 MISCELLANEOUS AGRICULTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "67-22 MISCELLANEOUS AGRICULTURE WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Agricultural",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-23 MISCELLANEOUS AGRICULTURE WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Poultry",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-24 MISCELLANEOUS AGRICULTURE WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Poultry",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "67-25 MISCELLANEOUS AGRICULTURE WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "67-99 USE CODE 67 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "68-01 DAIRIES, FEED LOTS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "68-02 DAIRIES, FEED LOTS WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "68-03 DAIRIES, FEED LOTS WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "68-04 DIARIES, FEED LOTS WITH MANUFACTURED HOME ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "68-05 DAIRIES, FEED LOTS WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "68-99 USE CODE 68 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "69-01 ORNAMENTALS, MISCELLANEOUS AGRICULTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "69-02 ORNAMENTALS, MISCELLANEOUS AGRICULTURE WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "property_usecode": "69-03 ORNAMENTALS, MISCELLANEOUS AGRICULTURE WITH MANUFACTURED HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Ornamentals",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "69-04 ORNAMENTALS, MISCELLANEOUS AGRICULTURE WITH MH ON PERSONAL PROPERTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "69-05 ORNAMENTALS, MISCELLANEOUS AGRICULTURE WITH BARN / GARAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "property_usecode": "69-99 USE CODE 69 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "70-01 VACANT INSTITUTIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "70-02 VACANT INSTITUTIONAL WITH EXTRA FEATURES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "71-01 CHURCHES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "71-02 CHURCH WITH RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "71-03 CHURCH WITH PARSONAGE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "71-04 CHURCH ADMINISTRATION BUILDING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "71-05 CHURCH - RECREATIONAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "71-99 CHURCH IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-01 SCHOOL - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-02 SCHOOL - PRIVATE, CHURCH OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-03 COLLEGE - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-04 DAY CARE / NURSERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-05 DAY CARE / NURSERY - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-06 PRE SCHOOL - PRIVATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-07 PRE SCHOOL - PRIVATE - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-08 FRATERNITY OR SORORITY HOME",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "72-99 SCHOOL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "73-01 HOSPITAL - PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "73-02 HOSPITAL - RE-HAB",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "73-99 HOSPITAL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-01 HOMES FOR THE AGED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-02 INDEPENDENT LIVING FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-03 ASSISTED LIVING FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-04 ASSISTED LIVING FACILITIES - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-05 ASSISTED LIVING FACILITIES - PRIOR MULTI FAMILY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-06 CONTINUING CARE RETIREMENT COMMUNITIES (CCRC'S)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "74-99 USE CODE 74 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "75-01 ORPHANAGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "75-02 ORPHANAGES - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "75-03 OTHER NON-PROFIT OR CHARITABLE SERVICES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "75-04 RESIDENTIAL HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "75-05 CONDOMINIUM HOA",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Unit"
  },
  {
    "property_usecode": "75-06 TOWNHOUSE HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "75-07 COMMERCIAL / INDUSTRIAL HOA",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "75-99 USE CODE 75 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "76-01 MORTUARIES / FUNERAL HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "76-02 CEMETERIES - PRIVATELY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "76-03 CEMETERIES - GOVERNMENT OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "76-04 CREMATORIUMS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "76-99 USE CODE 76 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "77-01 CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "77-02 LODGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "77-03 UNION HALLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "77-99 CLUBS / LODGES / UNION HALLS IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-01 SANITARIUMS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-02 CONVALESCENT & REST HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-03 CONVALESCENT & REST HOMES - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-04 NURSING HOMES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-05 NURSING HOMES - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-06 RE-HAB LIVING FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-07 RE-HAB LIVING FACILITIES - PRIOR RESIDENCE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "78-99 USE CODE 78 IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "79-01 CULTURAL ORGANIZATIONS, FACILITIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "79-99 CULTURAL ORGANIZATIONS, FACILITIES IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "80-01 VACANT GOVERNMENTAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "80-02 VACANT GOVERNMENTAL WITH EXTRA FEATURES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "81-01 MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "82-01 FOREST, PARKS, RECREATIONAL AREAS - FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "82-02 FOREST, PARKS, RECREATIONAL AREAS - STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "82-03 FOREST, PARKS, RECREATIONAL AREAS - COUNTY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "82-04 FOREST, PARKS, RECREATIONAL AREAS - MUNICIPAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "83-01 PUBLIC SCHOOLS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "83-02 PUBLIC SCHOOLS - ELEMENTARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "83-03 PUBLIC SCHOOLS - MIDDLE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "83-04 PUBLIC SCHOOLS - HIGH SCHOOL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "83-99 PUBLIC SCHOOLS IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "84-01 COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "84-99 COLLEGE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "85-01 HOSPITALS - MUNICIPAL OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "85-02 HOSPITALS - COUNTY OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "85-03 HOSPITALS - STATE OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "85-04 HOSPITALS - DISTRICT OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "85-99 HOSPITALS IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-01 COUNTY OWNED LAND - VACANT (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "86-02 COUNTY OWNED LAND - IMPROVED (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-03 COUNTY ADMINISTRATION BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-04 COUNTY PUBLIC WORKS / UTILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-05 COUNTY CORRECTIONS FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-06 COUNTY COURTHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-07 COUNTY POLICE / FIRE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "86-99 COUNTY IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "87-01 STATE OWNED LAND - VACANT (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "87-02 STATE OWNED LAND - IMPROVED (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "87-03 STATE ADMINISTRATION BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "87-04 STATE PUBLIC WORKS / UTILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "87-05 STATE CORRECTIONS FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "87-99 STATE IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "88-01 FEDERAL OWNED LAND - VACANT (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "88-02 FEDERAL OWNED LAND - IMPROVED (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "88-03 FEDERAL ADMINISTRATION BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "88-04 FEDERAL CORRECTIONS FACILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "88-05 FEDERAL COURTHOUSE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "88-06 POST OFFICE - FEDERAL OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "88-99 FEDERAL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "89-01 MUNICIPAL OWNED LAND - VACANT (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "89-02 MUNICIPAL OWNED LAND - IMPROVED (NOT INCLUDED IN OTHER CODES)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "89-03 MUNICIPAL ADMINISTRATION BLDG.",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "89-04 MUNICIPAL PUBLIC WORKS / UTILITY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "89-05 MUNICIPAL POLICE / FIRE STATION",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "89-06 POST OFFICE - MUNICIPAL OWNED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "89-99 MUNICIPAL IMPROVEMENTS NOT SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "90-01 LEASEHOLD INTEREST GOVT. PROP -VACANT (LEASED BY A NON-GOVERNMENTAL LESSEE)",
    "ownership_estate_type": "Leasehold",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "90-02 LEASEHOLD INTEREST GOVT. PROP.-IMPROVED (LEASED BY A NON-GOVERNMENTAL LESSEE)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "91-01 UTILITY, GAS COMPANIES - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-02 UTILITY, GAS COMPANIES - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "91-03 UTILITY, ELECTRIC COMPANIES - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-04 UTILITY, ELECTRIC COMPANIES - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "91-05 UTILITY, TELEPHONE AND TELEGRAPH - VACANT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-06 UTILITY, TELEPHONE AND TELEGRAPH - IMPROVED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "91-07 LOCALLY ASSESSED RAILROADS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-08 WATER AND SEWER SERVICE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-09 PIPELINES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-10 UTILITY - CANAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-11 RADIO, TELEVISION, CELLULAR PHONE COMMUNICATION TOWERS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "91-99 USE CODE 91 IMPROVEMENTS NOT FUNCTIONAL OR SUITABLE FOR OCCUPANCY / REDEVELOPMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "92-01 MINING LANDS, PETROLEUM LANDS, GAS LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "93-01 SUBSURFACE RIGHTS",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "94-01 RIGHT OF WAY - STREET, ROAD, ETC. - PUBLIC",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "94-02 RIGHT OF WAY - STREET, ROAD, ETC. - PRIVATE",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "94-03 RIGHT OF WAY - DRAINAGE / IRRIGATION, WATER RETENTION",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "94-04 CONSERVATION EASEMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "95-01 SUBMERGED LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "95-02 RIVER / CANAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "95-03 LAKES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "95-04 PONDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "95-05 BAY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-01 ENVIRONMENTALLY SENSITIVE LAND",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-02 SEWAGE DISPOSAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-03 SOLID WASTE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-04 BORROW PIT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-05 DRAINAGE RESERVOIRS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-06 WASTE LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-07 MARSH",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-08 SAND DUNES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-09 SWAMPS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "96-10 COMPOSTING",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "97-01 OUTDOOR RECREATION OR PARK LAND SUBJECT TO CLASSIFIED USE ASSESSMENT",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "98-01 CENTRALLY ASSESSED",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ReferenceParcel",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "99-01 ACREAGE NOT ZONED AGRICULTURE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  }
]

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return Math.round(s * 100) / 100;
  if (typeof s !== "string") return null;
  const cleaned = s.replace(/[^0-9.-]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  return null;
}

function parseCoordinate(value) {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (!isFinite(num)) return null;
  return num;
}

const appendSourceInfo = (seed) => ({
  source_http_request: {
    method: "GET",
    url: seed?.source_http_request?.url || null,
  },
  request_identifier: seed?.request_identifier || seed?.parcel_id || "",
});

function errorOut(message, pathStr) {
  const err = { type: "error", message, path: pathStr };
  console.error(JSON.stringify(err));
  process.exit(1);
}

function mapUnitsType(unitsStr) {
  if (unitsStr == null || unitsStr === "") return null;
  const n = parseInt(String(unitsStr).trim(), 10);
  if (!isFinite(n)) return null;
  switch (n) {
    case 1:
      return "One";
    case 2:
      return "Two";
    case 3:
      return "Three";
    case 4:
      return "Four";
    default:
      return null;
  }
}


function mapDeedType(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();

  const deedMap = {
    "quit claim deed": "Quitclaim Deed",
    "quitclaim deed": "Quitclaim Deed",
    "warranty deed": "Warranty Deed",
    "special warranty deed": "Special Warranty Deed",
    "grant deed": "Grant Deed",
    "bargain and sale deed": "Bargain and Sale Deed",
    "lady bird deed": "Lady Bird Deed",
    "transfer on death deed": "Transfer on Death Deed",
    "sheriff's deed": "Sheriff's Deed",
    "sheriff deed": "Sheriff's Deed",
    "tax deed": "Tax Deed",
    "trustee's deed": "Trustee's Deed",
    "trustee deed": "Trustee's Deed",
    "personal representative deed": "Personal Representative Deed",
    "correction deed": "Correction Deed",
    "deed in lieu of foreclosure": "Deed in Lieu of Foreclosure",
    "life estate deed": "Life Estate Deed",
    "joint tenancy deed": "Joint Tenancy Deed",
    "tenancy in common deed": "Tenancy in Common Deed",
    "community property deed": "Community Property Deed",
    "gift deed": "Gift Deed",
    "interspousal transfer deed": "Interspousal Transfer Deed",
    "wild deed": "Wild Deed",
    "court order deed": "Court Order Deed",
    "contract for deed": "Contract for Deed",
    "special master’s deed": "Special Master’s Deed",
    "special master deed": "Special Master’s Deed",
    "quiet title deed": "Quiet Title Deed",
    "administrator's deed": "Administrator's Deed",
    "administrator deed": "Administrator's Deed",
    "guardian's deed": "Guardian's Deed",
    "guardian deed": "Guardian's Deed",
    "receiver's deed": "Receiver's Deed",
    "receiver deed": "Receiver's Deed",
    "right of way deed": "Right of Way Deed",
    "vacation of plat deed": "Vacation of Plat Deed",
    "assignment of contract": "Assignment of Contract",
    "release of contract": "Release of Contract",
    "miscellaneous": "Miscellaneous"
  };

  // Try exact match first
  if (deedMap[t]) return deedMap[t];
  
  // Fallback to single word matching
  if (t.includes("warranty")) return "Warranty Deed";
  if (t.includes("quitclaim") || t.includes("quit")) return "Quitclaim Deed";
  if (t.includes("grant")) return "Grant Deed";
  if (t.includes("sheriff")) return "Sheriff's Deed";
  if (t.includes("tax")) return "Tax Deed";
  if (t.includes("trustee")) return "Trustee's Deed";
  if (t.includes("correction")) return "Correction Deed";
  if (t.includes("gift")) return "Gift Deed";
  if (t.includes("administrator")) return "Administrator's Deed";
  if (t.includes("guardian")) return "Guardian's Deed";
  if (t.includes("receiver")) return "Receiver's Deed";
  if (t.includes("foreclosure")) return "Deed in Lieu of Foreclosure";
  if (t.includes("contract")) return "Contract for Deed";
  if (t.includes("assignment")) return "Assignment of Contract";
  if (t.includes("release")) return "Release of Contract";
  
  return null;
}



function extractLotBlockSection(legal) {
  if (!legal || typeof legal !== "string") return { lot: null, block: null, section: null, township: null };
  const lotMatch = legal.match(/LOT\s+(\w+)/i);
  const blockMatch = legal.match(/BLK\s+(\w+)/i);
  const sectionMatch = legal.match(/SEC(?:TION)?\s+(\w+)/i);
  const townshipMatch = legal.match(/TOWNSHIP\s+(\w+)/i) || legal.match(/TWP\s+(\w+)/i);
  return {
    lot: lotMatch ? lotMatch[1] : null,
    block: blockMatch ? blockMatch[1] : null,
    section: sectionMatch ? sectionMatch[1] : null,
    township: townshipMatch ? townshipMatch[1] : null
  };
}

function parseAddressParts(situsAddress1) {
  if (!situsAddress1 || typeof situsAddress1 !== "string")
    return { number: null, name: null, suffix: null, preDir: null, postDir: null };

  // Normalize whitespace
  let raw = situsAddress1.trim().replace(/\s+/g, " ");

  // Remove trailing unit identifiers (e.g., E# A27, #123, APT 4B)
  raw = raw.replace(/\s*(?:#|APT|UNIT|BLDG|FL|STE|SUITE|RM|ROOM|E#)\s*\S+$/i, "").trim();

  if (!raw) return { number: null, name: null, suffix: null, preDir: null, postDir: null };

  const parts = raw.split(" ");
  let number = null;
  if (parts.length > 0 && /^\d+[A-Za-z]?$/.test(parts[0])) {
    number = parts.shift();
  }

  const suffixMap = {
    DR: "Dr", "DR.": "Dr", DRIVE: "Dr",
    RD: "Rd", "RD.": "Rd", ROAD: "Rd",
    ST: "St", "ST.": "St", STREET: "St",
    AVE: "Ave", "AVE.": "Ave", AVENUE: "Ave",
    BLVD: "Blvd", "BLVD.": "Blvd", BOULEVARD: "Blvd",
    LN: "Ln", LANE: "Ln", CT: "Ct", COURT: "Ct",
    PKWY: "Pkwy", PARKWAY: "Pkwy", WAY: "Way",
    HWY: "Hwy", HIGHWAY: "Hwy", TER: "Ter", TERRACE: "Ter",
    PL: "Pl", PLACE: "Pl", CIR: "Cir", CIRCLE: "Cir"
  };

  let suffix = null;
  if (parts.length) {
    const last = parts[parts.length - 1];
    const up = last.toUpperCase();
    if (suffixMap[up]) {
      suffix = suffixMap[up];
      parts.pop();
    }
  }

  const dirSet = new Set(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
  let preDir = null;
  if (parts.length && dirSet.has(parts[0].toUpperCase())) {
    preDir = parts.shift().toUpperCase();
  }

  let postDir = null;
  if (parts.length && dirSet.has(parts[parts.length - 1].toUpperCase())) {
    postDir = parts.pop().toUpperCase();
  }

  const filtered = parts.filter((tok) => !dirSet.has(tok.toUpperCase()));
  const name = filtered.length ? filtered.join(" ") : null;

  return { number, name, suffix, preDir, postDir };
}

function extractMailingAddress(inputObj) {
  if (!inputObj || !inputObj.d) return null;
  const parcels = Array.isArray(inputObj.d.parcelInfok__BackingField)
    ? inputObj.d.parcelInfok__BackingField
    : [];
  const parcel = parcels[0] || null;
  if (!parcel) return null;

  const parts = [
    parcel.mailingAddress1 && String(parcel.mailingAddress1).trim(),
    parcel.mailingAddress2 && String(parcel.mailingAddress2).trim(),
  ].filter(Boolean);

  if (parts.length === 0) return null;
  return parts.join(", ");
}



(function main() {
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(dataDir);

  const inputPath = path.join(process.cwd(), "input.json");
  const addrPath = path.join(process.cwd(), "unnormalized_address.json");
  const seedPath = path.join(process.cwd(), "property_seed.json");
  const ownerPath = path.join(process.cwd(), "owners", "owner_data.json");
  const utilitiesPath = path.join(
    process.cwd(),
    "owners",
    "utilities_data.json",
  );
  const layoutPath = path.join(process.cwd(), "owners", "layout_data.json");

  const input = readJson(inputPath);
  const unAddr = readJson(addrPath);
  const seed = readJson(seedPath);
  const ownerData = readJson(ownerPath);
  const utilitiesData = readJson(utilitiesPath);
  const layoutData = readJson(layoutPath);

  const d = input && input.d;
  const parcelInfo =
    d && Array.isArray(d.parcelInfok__BackingField)
      ? d.parcelInfok__BackingField[0]
      : null;
  if (!parcelInfo) {
    console.error("No parcel info found in input.json");
    process.exit(0);
  }

  const parcelId = parcelInfo.folioNumber || null;

  // PROPERTY
  const underAir = parcelInfo.bldgUnderAirFootage != null && String(parcelInfo.bldgUnderAirFootage).trim() !== "" ? String(parcelInfo.bldgUnderAirFootage).trim() : null;
  const livable = (() => { let l = underAir; if (!l && parcelInfo.bldgSqFT != null) { const s = String(parcelInfo.bldgSqFT).trim(); if (s && s !== "") l = s; } if (l != null) { const n = parseFloat(l); if (!isNaN(n) && n <= 0) l = null; } return l; })();
  // Find matching property mapping by use code
  const useCode = (parcelInfo.useCode || "").trim();
  const propertyMapping = propertyUseCodeMappings.find(mapping => {
    const mappingCode = mapping.property_usecode.split(' ')[0]; // Extract code part (e.g., "01-01")
    return mappingCode === useCode || mapping.property_usecode.startsWith(useCode);
  }) || propertyUseCodeMappings.find(mapping => 
    mapping.property_usecode.toLowerCase().includes(useCode.toLowerCase())
  );
  
  const propertyFields = {
    property_type: propertyMapping.property_type,
    property_usage_type: propertyMapping.property_usage_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    structure_form: propertyMapping.structure_form,
    build_status: propertyMapping.build_status
  };
  const bldgVal = parseCurrencyToNumber(parcelInfo.bldgValue);
  const builtYear = parcelInfo.actualAge ? (n => isFinite(n) ? n : null)(parseInt(parcelInfo.actualAge, 10)) : null;
  const unitsN = parcelInfo.units ? (n => isFinite(n) ? n : null)(parseInt(parcelInfo.units, 10)) : null;
  const totalArea = parcelInfo.bldgTotSqFootage != null ? (t => t && /\d{2,}/.test(t) ? t : null)(String(parcelInfo.bldgTotSqFootage).trim()) : null;
  const effYear = parcelInfo.effectiveAge ? (n => isFinite(n) ? n : null)(parseInt(parcelInfo.effectiveAge, 10)) : null;
  const subdivision = parcelInfo.neighborhood && String(parcelInfo.neighborhood).trim() !== "" ? String(parcelInfo.neighborhood).trim() : null;
  const legalDesc = (parcelInfo.legal || "").trim() || (() => { throw errorOut("Missing legal description.", "property.property_legal_description_text"); })();
  const buildStatus = propertyFields.build_status;
  
  const property = {
    ...appendSourceInfo(seed),
    livable_floor_area: livable,
    parcel_identifier: parcelId || errorOut("Missing parcel identifier.", "property.parcel_identifier"),
    property_legal_description_text: legalDesc,
    property_structure_built_year: builtYear,
    property_type: propertyFields.property_type,
    property_usage_type: propertyFields.property_usage_type,
    ownership_estate_type: propertyFields.ownership_estate_type,
    structure_form: propertyFields.structure_form,
    build_status: propertyFields.build_status,
    number_of_units: unitsN,
    area_under_air: underAir,
    total_area: totalArea,
    property_effective_built_year: effYear,
    subdivision: subdivision
  };
  writeJson(path.join(dataDir, "property.json"), property);

  const mailingAddressRaw =
    extractMailingAddress(input);
  if (mailingAddressRaw) {
    const mailingAddressOutput = {
      ...appendSourceInfo(seed),
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddressRaw,
    };
    writeJson(path.join(dataDir, "mailing_address.json"), mailingAddressOutput);
  }

  // ADDRESS
  const situsAddr1 = parcelInfo.situsAddress1 || null;
  const situsCity = parcelInfo.situsCity || null;
  const situsZipCode = parcelInfo.situsZipCode || null;
  
  const unnormalizedAddress = [situsAddr1, situsCity && `${situsCity}, FL`, situsZipCode].filter(Boolean).join(" ");

  // Extract latitude and longitude from unnormalized_address.json if available
  const latitude = parseCoordinate(unAddr && unAddr.latitude);
  const longitude = parseCoordinate(unAddr && unAddr.longitude);

  const address = {
    ...appendSourceInfo(seed),
    unnormalized_address: unnormalizedAddress || null,
    county_name: "Broward",
    latitude: latitude,
    longitude: longitude,
    township: null,
    range: null,
    section: null,
  };
  writeJson(path.join(dataDir, "address.json"), address);

  // LOT
  let lotSqft = null;
  if (parcelInfo.landCalcFact1 && parcelInfo.landCalcType1) {
    const value = parseFloat(String(parcelInfo.landCalcFact1).replace(/,/g, ""));
    const type = String(parcelInfo.landCalcType1).toUpperCase();
    
    if (isFinite(value) && value > 0) {
      // Convert based on land calculation type
      if (type === "SQUARE FOOT" || type === "OUTDOOR ADVERTISING") {
        lotSqft = value;
      } else if (["ACREAGE", "AGRICULTURE", "AIR RIGHTS", "BUMBLE BEES", "CATTLE", "FISH FARMING", "CITRUS", "GOLF COURSE", "GOAT FARM", "HORSE BUSINESS", "MISCELLANEOUS AGRICULTURE", "NURSERY", "POULTRY FARM", "ROW CROPS", "ROCK PIT", "SHEEP FARM"].includes(type)) {
        lotSqft = value * 43560; // Convert acres to square feet
      } else if (type === "FRONT FOOT FACTOR") {
        lotSqft = null; // Cannot convert front foot to square feet without depth
      } else if (type === "FLAT VALUE" || type === "CEMETARY LOTS") {
        lotSqft = null; // Cannot convert lot count or flat value to square feet
      }
    }
  }
  const lotObj = {
    ...appendSourceInfo(seed),
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotSqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: null,
  };

  writeJson(path.join(dataDir, "lot.json"), lotObj);

  // TAX
  const millage =
    Array.isArray(d.millageRatek__BackingField) &&
    d.millageRatek__BackingField[0]
      ? d.millageRatek__BackingField[0]
      : null;
  const tax = {
    ...appendSourceInfo(seed),
    tax_year:
      millage && millage.millageYear ? parseInt(millage.millageYear, 10) : null,
    property_assessed_value_amount: parseCurrencyToNumber(parcelInfo.sohValue),
    property_market_value_amount: parseCurrencyToNumber(parcelInfo.justValue),
    property_building_amount: parseCurrencyToNumber(parcelInfo.bldgValue),
    property_land_amount: parseCurrencyToNumber(parcelInfo.landValue),
    property_taxable_value_amount: parseCurrencyToNumber(
      parcelInfo.taxableAmountCounty,
    ),
    monthly_tax_amount: null,
    period_start_date: null,
    period_end_date: null,
    yearly_tax_amount: null,
    first_year_on_tax_roll: null,
    first_year_building_on_tax_roll: null,
  };
  writeJson(path.join(dataDir, "tax_1.json"), tax);

  function extractSales(parcelInfo, dataDir, seed) {
    function get(fieldBase, idx) {
      return parcelInfo[`${fieldBase}${idx}`];
    }
    
    // Dynamically find the maximum sales limit by checking existing saleDate fields
    let maxSales = 0;
    for (let i = 1; i <= 30; i++) {
      if (parcelInfo[`saleDate${i}`] !== undefined) {
        maxSales = i;
      }
    }
    
    const salesCreated = [];
    const deedsCreated = [];
    const filesCreated = [];
    
    for (let i = 1; i <= maxSales; i++) {
      const dateStr = get("saleDate", i);
      const priceStr = get("stampAmount", i);
      if (!dateStr || !priceStr) continue;
      
      const iso = parseDateToISO(String(dateStr));
      const price = parseCurrencyToNumber(priceStr);
      if (!iso) continue;
      
      const salesFileIndex = salesCreated.length + 1;
      
      // Create sales object
      const sales = {
        ...appendSourceInfo(seed),
        ownership_transfer_date: iso,
      };
      if (price != null) {
        sales.purchase_price_amount = price;
      }
      writeJson(path.join(dataDir, `sales_${salesFileIndex}.json`), sales);
      salesCreated.push(salesFileIndex);
      
      // Create deed object if deedType exists
      const deedCode = get("deedType", i);
      if (deedCode) {
        const deedType = mapDeedType(deedCode);
        const bookAndPageOrCin = get("bookAndPageOrCin", i);
        const deed = {...appendSourceInfo(seed)};
        if (deedType) {
          deed.deed_type = deedType;
        }
        if (bookAndPageOrCin) {
          const value = String(bookAndPageOrCin).trim();
          if (value.includes('/')) {
            const parts = value.split('/').map(p => p.trim());
            if (parts.length === 2) {
              deed.book = parts[0];
              deed.page = parts[1];
            }
          } else {
            deed.instrument_number = value;
          }
        }
        writeJson(path.join(dataDir, `deed_${salesFileIndex}.json`), deed);
        deedsCreated.push(salesFileIndex);
        
        // Create sales-to-deed relationship
        const relSalesDeed = {
          from: { "/": `./sales_${salesFileIndex}.json` },
          to: { "/": `./deed_${salesFileIndex}.json` }
        };
        writeJson(path.join(dataDir, `relationship_sales_deed_${salesFileIndex}.json`), relSalesDeed);
      }
    }
    
    return { salesCreated, deedsCreated, filesCreated };
  }

  // SALES
  const { salesCreated, deedsCreated, filesCreated } = extractSales(parcelInfo, dataDir, seed);

  // OWNERS create entries from owners/owner_data.json
  const ownerKey = `property_${parcelId}`;
  const ownersSection = ownerData[ownerKey] || {};
  const currentOwners =
    (ownersSection.owners_by_date && ownersSection.owners_by_date.current) ||
    [];

  const companyFiles = [];
  const personFiles = [];

  const companies = currentOwners.filter((o) => o.type === "company");
  companies.forEach((c, idx) => {
    const company = { ...appendSourceInfo(seed), name: c.name || null };
    const f = `company_${idx + 1}.json`;
    writeJson(path.join(dataDir, f), company);
    companyFiles.push(f);
  });

  const persons = currentOwners.filter((o) => o.type === "person");
  persons.forEach((p, idx) => {
    const person = {
      ...appendSourceInfo(seed),
      birth_date: null,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      middle_name: p.middle_name || null,
      prefix_name: p.prefix_name,
      suffix_name: p.suffix_name,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const f = `person_${idx + 1}.json`;
    writeJson(path.join(dataDir, f), person);
    personFiles.push(f);
  });

  // RELATIONSHIPS: sales-to-owners (if at least 1 sale exists)
  if (salesCreated.length > 0) {
    personFiles.forEach((personFile, idx) => {
      const rel = {
        from: { "/": "./sales_1.json" },
        to: { "/": `./${personFile}` }
      };
      writeJson(path.join(dataDir, `relationship_sales_person_${idx + 1}.json`), rel);
    });
    
    companyFiles.forEach((companyFile, idx) => {
      const rel = {
        from: { "/": "./sales_1.json" },
        to: { "/": `./${companyFile}` }
      };
      writeJson(path.join(dataDir, `relationship_sales_company_${idx + 1}.json`), rel);
    });
  }

  // RELATIONSHIPS: owners-to-mailing address (if mailing address exists)
  if (mailingAddressRaw) {
    let relIdx = 0;
    personFiles.forEach((personFile) => {
      relIdx += 1;
      const rel = {
        from: { "/": `./${personFile}` },
        to: { "/": "./mailing_address.json" }
      };
      writeJson(path.join(dataDir, `relationship_person_has_mailing_address_${relIdx}.json`), rel);
    });
    
    companyFiles.forEach((companyFile) => {
      relIdx += 1;
      const rel = {
        from: { "/": `./${companyFile}` },
        to: { "/": "./mailing_address.json" }
      };
      writeJson(path.join(dataDir, `relationship_company_has_mailing_address_${relIdx}.json`), rel);
    });
  }



  function createPropertyImageFiles(parcelInfo, d, dataDir, seed) {
    const urls = new Set();
    if (parcelInfo.picturePath) urls.add(parcelInfo.picturePath);
    if (Array.isArray(d.picturesListk__BackingField)) {
      d.picturesListk__BackingField.forEach((u) => {
        if (u) urls.add(u);
      });
    }
    const urlList = Array.from(urls);
    const fileNames = [];
    let fileIdx = 1;
    urlList.forEach((u) => {
      const url = String(u);

      // Skip relative URLs (only process full http/https URLs)
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.log(`Skipping relative URL: "${url}"`);
        return;
      }

      const name = url.split("/").pop() || `image_${fileIdx}.jpg`;
      const ext = (name.split(".").pop() || "").toLowerCase();
      let file_format = null;
      if (ext === "jpg" || ext === "jpeg") file_format = "jpeg";
      else if (ext === "png") file_format = "png";
      else if (ext === "txt") file_format = "txt";
      else file_format = "jpeg";

      const fileObj = {
        ...appendSourceInfo(seed),
        document_type: "PropertyImage",
        file_format,
        name,
        original_url: encodeURI(url),
        ipfs_url: null,
      };
      const f = `files_property_${fileIdx}.json`;
      writeJson(path.join(dataDir, f), fileObj);
      fileNames.push(f);
      fileIdx++;
    });
    return fileNames;
  }

  // FILES: create file_*.json for property images
  const fileNames = createPropertyImageFiles(parcelInfo, d, dataDir, seed);

  // UTILITIES
  const utilSection = utilitiesData[ownerKey] || null;
  if (utilSection) {
    const utility = { ...appendSourceInfo(seed), ...utilSection };
    writeJson(path.join(dataDir, "utility.json"), utility);
  }

  // LAYOUTS
  const layoutSection = layoutData[ownerKey] || null;
  if (layoutSection && Array.isArray(layoutSection.layouts)) {
    layoutSection.layouts.forEach((lay, idx) => {
      const layout = { ...appendSourceInfo(seed), ...lay };
      writeJson(path.join(dataDir, `layout_${idx + 1}.json`), layout);
    });
  }

  // STRUCTURE minimal file with nulls for all fields
  const structure = {
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
    structural_damage_indicators: null,
  };
  writeJson(path.join(dataDir, "structure.json"), structure);
})();
