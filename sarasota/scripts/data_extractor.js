const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const propertyTypeMapping = [
  {
    "property_usecode": "0000 - Residential vacant site",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0001 - Res-New Construction Not Substantially Complete",
    "ownership_estate_type": "FeeSimple",
    "build_status": "UnderConstruction",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0002 - MH Rental Space",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0004 - Vacant Condo Lot/Unbuilt Unit",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0005 - Vacant After Calamity",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0010 - Vacant Multi-family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0100 - Single Family Detached",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0101 - Single Family Attached - End Unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0102 - Single Family Attached - Inside Unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0105 - Single Family & Other Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - Manufactured 1-Fam Res",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0304 - Multifamily Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0310 - Multi-family 10 - 19 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0315 - Multi-family 10 - 19 units - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0320 - Multi-family 20 - 49 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0325 - Multi-family 20 - 49 units - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0350 - Multi-family 50 - 99 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0355 - Multi-family 50 - 99 units - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0380 - Govt.-subsidized Multifamily Complex",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0390 - Multi-family 100 or more units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0395 - Multi-family => 100 units, mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0399 - Multi-family => 100 units, LIHTC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0401 - CONDO - Det Single Family",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0402 - CONDO - Duplex or Villa",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0403 - CONDO - Low-Rise 2-3 Stories",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0404 - CONDO - Mid-Rise 4-6 Stories",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0405 - CONDO - Hi-Rise 7+ Stories",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0406 - CONDO - Leased Land",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0407 - CONDO - Row House",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0408 - CONDO - Cluster Villa",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0430 - CONDO - Time Share/Interval Ownership",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0501 - CO-OP - Detached Units",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0502 - CO-OP - Duplex or Villa",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0503 - CO-OP - Low-Rise 2-3 Stories",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0504 - CO-OP - Mid-Rise 4-6 Stories",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0505 - CO-OP - Hi-Rise 7+ Stories",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0506 - CO-OP - Leased Land",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0507 - CO-OP - Row House",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0508 - CO-OP - Cluster Villa",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0600 - Independent Living",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0610 - CCRC - IL, AL/MC and/or SN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0700 - Misc. Res - no living unit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0704 - Misc. Condo - no living unit",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0710 - Res Use in Transition",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0739 - Subsidized Single Family Residence - LIHTC",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0810 - Multiple Single Fam Dwellings",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0815 - Multiple Single Fam Mixed",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0820 - 2-Family Dwelling",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0825 - 2-Family & Other Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0826 - Multiple 2 Family Bldgs",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0830 - 3-Family Dwelling",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0835 - 3 Family & Other Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0836 - Multiple Triplexes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Triplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0840 - 4-Family Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0845 - 4-Family & Other Bldg",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0846 - Multiple Quadplexes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Quadplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0850 - Multi-Family 5 to 9 Units, Duplex to Quad",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Duplex",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0880 - Govt.-subsidized Multi-family rental < 10 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0890 - Multi-family apts 5-9 units",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0895 - Multi-family apts 5-9 units-mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0900 - Residential Common Areas/Elements",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1000 - Vacant commercial land",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1001 - Vacant Commercial land (Billboard)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1004 - Vacant condo land commercial/industrial",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1009 - Commercial Common Areas/Elements",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "1100 - Store -one story (freestanding)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1101 - Store - one story (attached)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1102 - Store-1 store - Automotive Retail",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1103 - Store- 1 story - Discount Retail",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1104 - Retail condo unit",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1105 - Store-1 story - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1110 - Strip store-1 story < 10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1115 - Strip store-1 story < 10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1120 - Strip store-1 story/=>10,000 and <30,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1125 - Strip store-1 story/=>10,000 and <30,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1130 - Store-1/story/ convenience-without gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1135 - Store-1/story/convenience-without gas-mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1140 - Store-1/story/ convenience-with gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1145 - Store-1/story/convenience-with gas - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "1150 - Store-1 story freestanding w/drivethrough",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 - Department store - Home Center",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1310 - Department store - Discount",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1360 - Department Store - Furniture",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1370 - Department Store - Warehouse Club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "1410 - Supermarket-freestanding",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1420 - Supermarket-attached to other retail",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500 - Regional shopping center - 300k-850k sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1520 - Regional Shopping Center - Department Store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1560 - Lifestyle Center/150-500k sf/upscale specialty entertainment",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 - Community shopping ctr/100k-450k sf/suprmkt-dept store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1610 - Community outlet shp ctr/ < 300k sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1620 - Community neighborhood ctr/30k-100k sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1630 - Community multi story ctr/single tenant",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1635 - Community multi story ctr/single tenant/mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1640 - Community multi story strip store <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1645 - Community multi story strip store <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1650 - Community multi story strip ctr=>10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1655 - Community multi story strip ctr=>10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1660 - Power center - Category dominant anchors >250k sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 - Office - 1 story/single tenant <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1705 - Office - 1 story/single tenant <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1710 - Office - 1 story/single tenant =>10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1720 - Office - 1 story/multi tenant <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1725 - Office - 1 story/multi tenant <10,000 sf - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1726 - Office - 1 story/multi tenant <10,000 sf - multi-use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1730 - Office - 1 story/multi tenant =>10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1800 - Office /multi story-1 tenant <10,000",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1804 - Office condo unit",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1805 - Office /multi story-1 tenant <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1810 - Office /multi story-=>2 tenants <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1815 - Office /multi story-=>2 tenants <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1816 - Office /multi story-=>2 tenants <10,000 sf multi use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1820 - Office /multi story-1 tenant=>10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1830 - Office /multi story-=>2 tenants=>10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1835 - Office /multi story-=>2 tenants=>10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1840 - Office /multi story-1 tenant=> 5 stories",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1850 - Office /multi story-=>2 tenants =>5 stories",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1904 - Medical office condo unit",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "1910 - Medical profess/1 story-1 tenant <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1915 - Medical profess/1 story-1 tenant <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1920 - Medical profess/1 story-multi tenant <10,000 sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1925 - Medical profess/1 sty-multi tenant <10,000 sf mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1930 - Medical profess/1 story-single or multi tenant =>10k sf",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1935 - Medical profess/1 story-single or multi tenant>10k-mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1940 - Medical profess/multi story-single or multi tenant",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1945 - Medical profess/multi story-single or multi tenant-mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1950 - Medical, veterinary-related",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1973 - Medical, surgery center",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000 - Airport-private or commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2010 - Bus terminal",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2020 - Boat Basin",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2030 - Pier",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2040 - Marina",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 - Restaurant -Full service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2104 - Restaurant condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2105 - Restaurant -Full service  - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2210 - Restaurant - quick service with drive-through window",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2220 - Restaurant- quick service without drive thru window",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 - Financial institutions (Banks, S&L, Mtg co, Credit svcs)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2304 - Bank condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "2305 - Financial institutions mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2350 - Financial institutions (Retail w/drive-through)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2510 - Laundry self service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2520 - Drycleaner",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 - Service stations/without gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2610 - Service stations/with gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2620 - Self service gasoline-no convenience store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2630 - Car wash - Express service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2640 - Car wash - Self-service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 - Auto sales (new)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2710 - Auto sales (used)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2715 - Auto sales (used) mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2720 - Auto repair/svc & body shps/garage",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2725 - Auto repair/svc & body shps/garage mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2730 - Heavy const/farm vehicles/trailer sales & service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2735 - Heavy const/farm vehicles/trailer sales & service mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2740 - Manufactured home sales & service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Commercial",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "2750 - Motorcycles sales and service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2760 - Recreational vehicle sales and service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2770 - Auto rental",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2775 - Auto rental  mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2780 - Marine equipment/sales and service",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2785 - Marine equipment/sales and service mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 - Parking lots (commercial or patron)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2804 - Marina slip - dry rack",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2805 - Marina wet slip",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2810 - Use In Transition",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2827 - Automotive/vehicular sales/svc extended use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2840 - Industrial Use In Transition",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2841 - Light industrial manufacturing extended use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "2842 - Heavy industrial manufacturing extended use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "2847 - Mineral/gravel process extended use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "2848 - Warehouse extended use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "2860 - Manufactured Home Sites as TPP",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHousing",
    "property_usage_type": "Commercial",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "2870 - Recreational vehicle park",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2900 - Wholesale outlets, produce houses, manufacturing outlets",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 - Florist",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3010 - Florist-greenhouses/plant nurseries",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3110 - Open stadiums",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 - Enclosed theatres",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 - Nightclubs/cocktail lounges/bars",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "3305 - Nightclubs/cocktail lounges/bars - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 - Bowling alleys",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3430 - Enclosed arenas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3500 - Tourist attractions/permanent exhibits",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3600 - Camps",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3720 - Race track",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "3750 - Dog and cat kennel",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3755 - Dog and cat kennel - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3760 - Horse stable",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3770 - Circus animals-breed/board",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "3810 - Golf course/private",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3820 - Golf course/semi-private",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3830 - Golf course/daily-fee",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3840 - Golf course/municipal",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3850 - Golf course/executive",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3890 - Golf course/driving range",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3904 - Hotel condo unit",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "3910 - Hotels/motels/lodging (2-40 units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3915 - Hotels/motels/lodging (2-40 units) - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "3940 - Hotels/motels/lodging (41 or more units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "4000 - Vacant industrial land",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4009 - Industrial Common Area/Element",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Building"
  },
  {
    "property_usecode": "4100 - Manufacturing - light",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4105 - Manufacturing - light - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4110 - Manufacturing/engineering or scientific",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4200 - Manufacturing - heavy",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4300 - Lumber yard",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "property_usecode": "4400 - Packing plants (fruit/vegetables/meat)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "property_usecode": "4700 - Mineral and gravel processing/cement plant",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 - Warehouse",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4804 - Flex Office Warehouse Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4805 - Warehouse  - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4810 - Warehouse and sales",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4815 - Warehouse and sales - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4820 - Warehouse and office",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4825 - Warehouse and office - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4840 - Terminal/distribution or trucking",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "4860 - Mini-storage warehousing",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4865 - Mini-storage  warehousing - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4870 - Flex space/overhead door front",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4875 - Flex space/overhead door front - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4880 - Flex space/office front",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "4885 - Flex space/office front - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900 - Open storage/materials/equipment/building supplies",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4909 - Industrial condo common element/parking",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "Unit"
  },
  {
    "property_usecode": "4910 - Open junk yard or recycling (non auto)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "4920 - Open auto wrecking and auto junk yard",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "Building"
  },
  {
    "property_usecode": "5100 - AGI-Cropland Soil Capability Class 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5200 - AG - Cropland Soil Capability Class 2",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "Building"
  },
  {
    "property_usecode": "5700 - AG - Timberland- Site Index 60 to 69",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5800 - AG - Timberland- Site Index 50 to 59",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "5900 - AG - Timberland- not Index - Pine",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6000 - AG - Grazing Land Soil Capability Class 1",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6200 - AG- Grazing Land Soil Capability Class",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "Building"
  },
  {
    "property_usecode": "6610 - AG- Citrus Grove",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "Building"
  },
  {
    "property_usecode": "6700 - AG - Poultry",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "Building"
  },
  {
    "property_usecode": "6710 - AG - Bees / Apiary",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6720 - AG - Aquaculture",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Aquaculture",
    "property_type": "Building"
  },
  {
    "property_usecode": "6800 - AG - Dairy",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "6900 - AG - Ornamentals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "Building"
  },
  {
    "property_usecode": "6930 - AG - Horse Breeding",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "7000 - Vacant Institutional Land",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 - Church",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 - School (private)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7205 - School (private) - mixed use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7210 - College (private)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7310 - Community hospital",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7320 - Specialty hospital",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 - Assisted Living",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "7410 - Memory Care",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "7420 - Assisted Living & Memory Care",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "7430 - AL and/or MC, & SN",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500 - Orphanages/non-profit/charitable services",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600 - Mortuary",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7610 - Cemetery",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700 - Service club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7710 - Beach club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7720 - Community center",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7730 - Tennis club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7740 - Yacht club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7750 - Union hall, Other club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7760 - Boat Club",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800 - Nursing home",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "7900 - Cultural organizations, facilities",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8000 - Vacant government land",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8010 - Vacant government use in transition",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8100 - Military",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "property_usecode": "8200 - Parks - Natural Areas, Preserves",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8210 - Parks - Community",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8220 - Parks - Recreational area",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8230 - Parks - Linear",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8240 - Parks - Athletic Complex",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8250 - Parks - Neighborhood",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "Building"
  },
  {
    "property_usecode": "8300 - Public school (Board of Public Instruction)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 - College (public)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500 - Hospital (public)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8600 - County government - Administration",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8610 - County government - Public Works",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8620 - County government - Police protection",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8640 - County government - Transportation",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "8650 - County government - Libraries and archives",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8660 - County government - Fire protection",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8680 - County government - Professional services",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8700 - State government use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8800 - Federal government use",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8900 - Municipal government - Administration",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8910 - Municipal government - Public Works",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8920 - Municipal government - Police protection",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "8960 - Municipal government - Fire protection",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9000 - Leasehold interest (government owned leases)",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9016 - Shopping center related long term leasehold",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "9039 - Lodging related long term leasehold",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "9042 - Industrial long term leasehold",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9047 - Rock plant long term leasehold",
    "ownership_estate_type": "Leasehold",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9100 - Gas Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9110 - Electric Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9120 - Telephone Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9130 - Cellular Tower -Telephone Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9140 - Railroad Utility (locally assessed)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9150 - Water and sewer Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9160 - Cable TV Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9170 - Radio/Television Utility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TelecommunicationsFacility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9300 - Misc/ Subsurface Rights",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9400 - Right-of-way (Streets and roads, etc.)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9410 - Right-of-way (Canals, Waterways, etc.)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9500 - River or lake",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "Building"
  },
  {
    "property_usecode": "9600 - Solid waste",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9610 - Borrow pit",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9620 - Drainage reservoir",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9625 - Drainage reservoir - Myakkahatchee Creek Corridor",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9630 - Drainage Canals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9640 - Marsh or Swamp",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9650 - Sand dunes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9800 - Private car lines (centrally assessed)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "Building"
  },
  {
    "property_usecode": "9810 - Railroad property (centrally assessed)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "Building"
  },
  {
    "property_usecode": "9900 - Acreage Not Ag",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9904 - Vacant Land /Intended Condo Project",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  }
]

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function writeOut(filePath, obj) {
  const outPath = path.join("data", filePath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(str) {
  if (!str) return null;
  const num = str.replace(/[^0-9.\-]/g, "");
  if (num === "") return null;
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

function extractTextAfterColon($el) {
  const text = $el.clone().children("strong").remove().end().text().trim();
  return text.replace(/^:\s*/, "").trim();
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

function parseSarasotaTables($) {
  const emptyResult = {
    buildings: [],
    extraFeatures: [],
    values: [],
    salesAndTransfers: [],
    propertyAttributes: {},
    owner: null,
    mailingAddress: null,
    situsAddress: null,
  };
  const buildingsTable = $('#Buildings').first();
  const extraFeaturesTable = findTableByHeading($, 'Extra Features');
  const valuesTable = findTableByHeading($, 'Values');
  const salesTable = findTableByHeading($, 'Sales & Transfers');
  const basicInfo = extractOwnershipAndSitus($);

  return {
    buildings: parseHeaderTable($, buildingsTable),
    extraFeatures: parseHeaderTable($, extraFeaturesTable),
    values: parseHeaderTable($, valuesTable),
    salesAndTransfers: parseHeaderTable($, salesTable),
    propertyAttributes: extractPropertyAttributes($),
    owner: basicInfo.owner || null,
    mailingAddress: basicInfo.mailingAddress || null,
    situsAddress: basicInfo.situsAddress || null,
  };
}

function findTableByHeading($, headingText) {
  if (!headingText) {
    return $();
  }
  const heading = $('span.h2')
    .filter((_, el) => $(el).text().trim().startsWith(headingText))
    .first();

  if (!heading.length) {
    return $();
  }
  return heading.nextAll('table').first();
}

function parseHeaderTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const headerRow = table.find('tr').first();
  const headerCells = headerRow.find('th');

  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, th) => {
      const text = $(th).text().replace(/\s+/g, ' ').trim();
      return normalizeHeaderKey(text) || `column${idx + 1}`;
    })
    .get();

  const bodyRows = table.find('tbody tr');
  const rows = bodyRows.length ? bodyRows : table.find('tr').slice(1);
  return rows
    .map((_, row) => {
      const cells = $(row).find('td');
      const record = {};
      headers.forEach((header, idx) => {
        const cellText = cells
          .eq(idx)
          .text()
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        record[header] = cellText || null;
      });
      return record;
    })
    .get();
}

function extractPropertyAttributes($) {
  const result = {};
  const detailsList = $('ul.resultr.spaced').first();

  if (!detailsList.length) {
    return result;
  }

  detailsList.find('li').each((_, item) => {
    const strong = $(item).find('strong').first();
    if (!strong.length) {
      return;
    }
    const label = strong.text().replace(/[:]/g, '').trim();
    const key = normalizeHeaderKey(label);
    if (!key) {
      return;
    }

    const clone = $(item).clone();
    clone.find('strong').first().remove();
    const value = clone
      .text()
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    result[key] = value || null;
  });

  return result;
}

function extractOwnershipAndSitus($) {
  const infoList = $('ul.resultl.spaced').first();
  if (!infoList.length) {
    return {};
  }

  const labeledValues = collectLabeledList($, infoList);
  const ownershipLines = labeledValues['Ownership'] || [];
  const situsLines = labeledValues['Situs Address'] || [];

  const owner = ownershipLines.length ? ownershipLines[0] : null;
  const mailingAddress =
    ownershipLines.length > 1 ? ownershipLines.slice(1).join(' ') || null : null;
  const situsAddress = situsLines.length ? situsLines.join(' ') : null;

  return { owner, mailingAddress, situsAddress };
}

function collectLabeledList($, listEl) {
  const result = {};
  let currentLabel = null;

  listEl.children('li').each((_, item) => {
    const el = $(item);
    const classAttr = el.attr('class') || '';
    if (classAttr.includes('app-links')) {
      return;
    }
    const text = el
      .text()
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      return;
    }

    const isLabel = (el.attr('class') || '').includes('med') && text.endsWith(':');
    if (isLabel) {
      currentLabel = text.replace(/:$/, '').trim();
      if (!(currentLabel in result)) {
        result[currentLabel] = [];
      }
      return;
    }

    if (currentLabel) {
      result[currentLabel].push(text);
    }
  });

  return result;
}

function normalizeHeaderKey(text) {
  if (!text) {
    return '';
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }
  return cleaned
    .split(' ')
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
}

function parseIntOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseInt(normalized, 10);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function parseFloatOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseFloat(normalized);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function extractSecTwpRng(value) {
  const m = value.trim().match(/^(\d+)-(\w+)-(\w+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}


function extractAddress(overallDetails, unnorm, siteAddress, mailingAddress) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  const secTwpRngRawValue = overallDetails["secTwpRge"];
  let secTwpRng = null;
  if (secTwpRngRawValue) {
    secTwpRng = extractSecTwpRng(secTwpRngRawValue);
  }
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

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const inputHtmlPath = path.join(".", "input.html");
  const addrPath = path.join(".", "unnormalized_address.json");
  const seedPath = path.join(".", "property_seed.json");
  const ownerDataPath = path.join(".", "owners", "owner_data.json");
  const utilDataPath = path.join(".", "owners", "utilities_data.json");
  const structureDataPath = path.join(".", "owners", "structure_data.json");
  const layoutDataPath = path.join(".", "owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(addrPath) || {};
  const seed = readJSON(seedPath) || {};
  const parcelId = seed.parcel_id || seed.parcelId || seed.parcel || null;
  const parsed = parseSarasotaTables($);
  const layoutData = readJSON(layoutDataPath);
  const utilData = readJSON(utilDataPath);
  const structData = readJSON(structureDataPath);
  const parsedBuildings = parsed.buildings;
  const parsedExtraFeatures = parsed.extraFeatures;
  const parsedValues = parsed.values;
  const parsedSalesAndTransfers = parsed.salesAndTransfers;
  const parsedPropertyAttributes = parsed.propertyAttributes;
  const hasOwnerMailingAddress = extractAddress(parsedPropertyAttributes, unAddr, parsed.situsAddress, parsed.mailingAddress);
  // Build property.json
  let property = {
    area_under_air: null,
    livable_floor_area: null,
    number_of_units: parseIntOrNull(parsedPropertyAttributes.totalLivingUnits),
    number_of_units_type: null,
    parcel_identifier: parcelId || "",
    property_effective_built_year: null,
    property_legal_description_text: parsedPropertyAttributes.parcelDescription ?? null,
    property_structure_built_year: null,
    subdivision: parsedPropertyAttributes.subdivision ?? null,
    zoning: parsedPropertyAttributes.zoning ?? null,
    historic_designation: false
  };
  if (!parsedPropertyAttributes.propertyUse)  {
    throw new Error("Property type not found");
  }
  // console.log(overallDetails);
  const propertyMapping = mapPropertyTypeFromUseCode(parsedPropertyAttributes.propertyUse);
  if (!propertyMapping) {
    throw new Error("Property type not found");
  }
  property.property_type = propertyMapping.property_type,
  property.ownership_estate_type = propertyMapping.ownership_estate_type,
  property.build_status = propertyMapping.build_status,
  property.structure_form = propertyMapping.structure_form,
  property.property_usage_type = propertyMapping.property_usage_type,
  writeJSON(path.join(dataDir, "property.json"), property);

  // Build lot.json
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: parsedPropertyAttributes.landArea && parseIntOrNull(parsedPropertyAttributes.landArea) >= 1 ? parseIntOrNull(parsedPropertyAttributes.landArea) : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);
  writeJSON(path.join(dataDir, "relationship_property_lot.json"), {
    from: "./property.json",
    to: "./lot.json"
  });

  // Build tax files for each year present in the Values table (even if $0)
  const headersMatch = (table) => {
    const headText = $(table).find("thead").text();
    return (
      /Year/i.test(headText) &&
      /Land/i.test(headText) &&
      /Building/i.test(headText)
    );
  };

  $("table.grid").each((i, table) => {
    if (!headersMatch(table)) return;
    $(table)
      .find("tbody tr")
      .each((ri, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 9) return;
        const yearText = $(tds[0])
          .text()
          .replace(/[^0-9]/g, "");
        const year = Number(yearText);
        if (!year) return;
        const land = parseCurrencyToNumber($(tds[1]).text()) ?? null;
        const building = parseCurrencyToNumber($(tds[2]).text()) ?? null;
        const just = parseCurrencyToNumber($(tds[4]).text()) ?? null;
        const assessed = parseCurrencyToNumber($(tds[5]).text()) ?? null;
        const taxable = parseCurrencyToNumber($(tds[7]).text()) ?? null;

        // Skip creating tax file if any required field is null or zero
        // Required fields: assessed, market (just), and taxable amounts
        if (!assessed || assessed <= 0 || 
            !just || just <= 0 || 
            !taxable || taxable <= 0) {
          return; // Skip this tax year
        }
        
        const tax = {
          first_year_building_on_tax_roll: null,
          first_year_on_tax_roll: null,
          monthly_tax_amount: null,
          period_end_date: null,
          period_start_date: null,
          property_assessed_value_amount: assessed,
          property_building_amount: building,
          property_land_amount: land,
          property_market_value_amount: just,
          property_taxable_value_amount: taxable,
          tax_year: year,
          yearly_tax_amount: null,
        };
        const fname = path.join(dataDir, `tax_${year}.json`);
        writeJSON(fname, tax);
      });
  });

  // Build flood_storm_information.json
  const floodRows = [];
  $("#FloodDatas tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      floodRows.push({
        panel: $(tds[0]).text().trim() || null,
        floodway: $(tds[1]).text().trim() || null,
        sfha: $(tds[2]).text().trim() || null,
        zone: $(tds[3]).text().trim() || null,
        community: $(tds[4]).text().trim() || null,
        bfe: $(tds[5]).text().trim() || null,
        cfha: $(tds[6]).text().trim() || null,
      });
    }
  });
  if (floodRows.length > 0) {
    const zones = Array.from(
      new Set(floodRows.map((r) => r.zone).filter(Boolean)),
    );
    const anyInSfha = floodRows.some(
      (r) => (r.sfha || "").toUpperCase() === "IN",
    );
    const flood = {
      community_id: floodRows[0].community || null,
      panel_number: floodRows[0].panel || null,
      map_version: null,
      effective_date: null,
      evacuation_zone: null,
      flood_zone: zones.length ? zones.join(", ") : null,
      flood_insurance_required: anyInSfha,
      fema_search_url: null,
    };
    writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
  }

  // Qualification Code to sale_type and deed_type mapping
  const qualificationCodeMapping = {
    "0": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "01": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "02": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "03": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "04": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "05": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "06": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "1": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "11": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "12": { sale_type: "ReoPostForeclosureSale", deed_type: "Special Warranty Deed" },
    "13": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "14": { sale_type: "TypicallyMotivated", deed_type: "Life Estate Deed" },
    "15": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "16": { sale_type: "TypicallyMotivated", deed_type: "Tenancy in Common Deed" },
    "17": { sale_type: "TypicallyMotivated", deed_type: "Gift Deed" },
    "18": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "19": { sale_type: "ProbateSale", deed_type: "Personal Representative Deed" },
    "20": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "21": { sale_type: "TypicallyMotivated", deed_type: "Contract for Deed" },
    "30": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "31": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "32": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "33": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "34": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "35": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "36": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "37": { sale_type: "RelocationSale", deed_type: "Special Warranty Deed" },
    "38": { sale_type: "CourtOrderedNonForeclosureSale", deed_type: "Court Order Deed" },
    "39": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "40": { sale_type: "ShortSale", deed_type: "Warranty Deed" },
    "41": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "43": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "98": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "99": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "HX": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "NA": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "X2": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "X3": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" }
  };

  // Parse sales history from HTML
  const salesHistory = [];
  const deeds = [];
  const files = [];
  let salesOwnerMapping = {};
  
  // Look for the sales table after "Sales & Transfers" heading
  $("span.h2").each((i, span) => {
    const text = $(span).text().trim();
    if (/Sales\s*&\s*Transfers/i.test(text)) {
      // Find the table following this heading
      const table = $(span).nextAll("table.grid").first();
      if (table.length > 0) {
        const headerText = table.find("thead").text();
        // Check if this is the sales table by looking for expected column headers
        if (/Transfer Date/i.test(headerText) && /Recorded Consideration/i.test(headerText)) {
          table.find("tbody tr").each((rowIndex, tr) => {
            const tds = $(tr).find("td");
            if (tds.length >= 6) {
              const transferDateText = $(tds[0]).text().trim();
              const considerationText = $(tds[1]).text().trim();
              const instrumentNumber = $(tds[2]).text().trim();
              const fileLink = $(tds[2]).find("a").last().attr("href");
              const qualificationCode = $(tds[3]).text().trim(); // Qualification Code column
              
              // Parse transfer date (MM/DD/YYYY format to YYYY-MM-DD)
              let transferDate = null;
              if (transferDateText) {
                const dateParts = transferDateText.split('/');
                if (dateParts.length === 3) {
                  const month = dateParts[0].padStart(2, '0');
                  const day = dateParts[1].padStart(2, '0');
                  const year = dateParts[2];
                  transferDate = `${year}-${month}-${day}`;
                }
              }
              
              // Parse consideration amount (remove $ and commas)
              let purchasePrice = null;
              if (considerationText) {
                const cleanedAmount = considerationText.replace(/[$,]/g, '');
                const parsedAmount = parseFloat(cleanedAmount);
                if (!isNaN(parsedAmount)) {
                  purchasePrice = parsedAmount;
                }
              }
              
              // Get sale_type and deed_type from qualification code
              const mapping = qualificationCodeMapping[qualificationCode] || 
                            { sale_type: "TypicallyMotivated", deed_type: "Miscellaneous" };
              
              // Only add if we have both required fields
              if (transferDate && purchasePrice !== null && purchasePrice > 0) {
                if (transferDate) {
                  salesOwnerMapping[transferDate] = "";
                }
                salesHistory.push({
                  ownership_transfer_date: transferDate,
                  purchase_price_amount: purchasePrice,
                  sale_type: mapping.sale_type,
                });
                
                // Create corresponding deed object
                let deed = {
                  deed_type: mapping.deed_type,
                };
                if (instrumentNumber) {
                  const instrumentNumberSplit = instrumentNumber.split("/");
                  if (instrumentNumberSplit.length == 2) {
                    deed.book = instrumentNumberSplit[0];
                    deed.page = instrumentNumberSplit[1];
                  } else {
                    deed.instrument_number = instrumentNumber;
                  }
                }
                deeds.push(deed);
                
                // Create corresponding file object
                files.push({
                  document_type: null,
                  file_format: null,
                  ipfs_url: null,
                  name: "Deed Document",
                  original_url: fileLink,
                });
              }
            }
          });
        }
      }
    }
  });
  
  // Write sales history and deed files
  salesHistory.forEach((sale, index) => {
    const saleFileName = path.join(dataDir, `sales_${index + 1}.json`);
    writeJSON(saleFileName, sale);
  });
  
  deeds.forEach((deed, index) => {
    const deedFileName = path.join(dataDir, `deed_${index + 1}.json`);
    writeJSON(deedFileName, deed);
  });
  
  files.forEach((file, index) => {
    const fileFileName = path.join(dataDir, `file_${index + 1}.json`);
    writeJSON(fileFileName, file);
  });

  // Owners (person/company) from owners/owner_data.json
  const ownerData = readJSON(ownerDataPath) || {};
  const key = parcelId ? `property_${parcelId}` : null;
  let ownersByDate = null;
  if (
    key &&
    ownerData[key] &&
    ownerData[key].owners_by_date
  ) {
    ownersByDate = ownerData[key].owners_by_date;
  }
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


  // Parse exemptions
  const exemptionsDiv = $("#exemptions");
  const exemptions = [];
  if (exemptionsDiv.length > 0) {
    // Check if it's a homestead property
    const homesteadText = exemptionsDiv.find("span:contains('Homestead Property')").text();
    const isHomestead = homesteadText.includes("Yes");
    
    // Parse exemption table
    exemptionsDiv.find("table tbody tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const grantYear = parseInt($(cells[0]).text().trim()) || null;
        const value = parseCurrencyToNumber($(cells[1]).text());
        const description = cells.length >= 3 ? $(cells[2]).text().trim() : "";
        
        if (grantYear && value) {
          exemptions.push({
            exemption_type: value === 25000 ? "Homestead" : "Additional Homestead",
            exemption_amount: value,
            grant_year: grantYear,
            is_active: !description.includes("not renew")
          });
        }
      }
    });
  }
  
  // Write exemptions
  exemptions.forEach((exemption, idx) => {
    writeJSON(path.join(dataDir, `exemption_${idx + 1}.json`), exemption);
  });
  
  if (floodRows.length > 0) {
    writeJSON(path.join(dataDir, "relationship_property_flood_storm_information.json"), {
      from: "./property.json",
      to: "./flood_storm_information.json"
    });
  }
  
  // Tax relationships
  fs.readdirSync(dataDir).forEach(file => {
    const match = file.match(/^tax_(\d{4})\.json$/);
    if (match) {
      const year = match[1];
      writeJSON(path.join(dataDir, `relationship_property_tax_${year}.json`), {
        from: "./property.json",
        to: `./tax_${year}.json`
      });
    }
  });
  
  // Exemption relationships
  exemptions.forEach((exemption, index) => {
    writeJSON(path.join(dataDir, `relationship_property_exemption_${index + 1}.json`), {
      from: "./property.json",
      to: `./exemption_${index + 1}.json`
    });
  });

  // Sales history relationships
  salesHistory.forEach((sale, index) => {
    writeJSON(path.join(dataDir, `relationship_property_sales_${index + 1}.json`), {
      from: "./property.json",
      to: `./sales_${index + 1}.json`
    });
    
    // Sales history to deed relationship
    writeJSON(path.join(dataDir, `relationship_sales_${index + 1}_deed_${index + 1}.json`), {
      from: {"/": `./sales_${index + 1}.json`},
      to: {"/": `./deed_${index + 1}.json`}
    });
    
    // Deed to file relationship
    writeJSON(path.join(dataDir, `relationship_deed_${index + 1}_file_${index + 1}.json`), {
      to: {"/": `./file_${index + 1}.json`},
      from: {"/": `./deed_${index + 1}.json`}
    });
  });
  let util = {};
  let struct = {};
  if(utilData && utilData[key]) {
    util = utilData[key];
  }
  if(structData && structData[key]) {
    struct = structData[key];
  }
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

  // Sales/Deed/Files/Relationships: not created unless discoverable data present
}

main();
