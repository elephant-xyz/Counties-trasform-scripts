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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl03_ctl01_grdValuation";

const propertyTypeMapping = [
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel",
    "property_usecode": "VACANT (0000)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome",
    "property_usecode": "MOBILE HOME (0200)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "SINGLE FAMILY (0100)"
  },
  {
    "property_usecode": "RETIRED MOBILE HOME (0220)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "MISC RESIDENTIAL (0070)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel",
    "property_usecode": "NON AG ACREAGE (9900)"
  },
  {
    "property_usecode": "NO AG AC W/EF (9970)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 5 W/MH (5802)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "TIMBERLAND 5 (5800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "PASTURELAND 4 W/SFR (6301)"
  },
  {
    "property_usecode": "TIMBERLAND W/MH (5702)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "TIMBERLAND 5 W/SFR (5801)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "MODULAR HOME (0150)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "Modular",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building",
    "property_usecode": "COUNTY (8600)"
  },
  {
    "property_usecode": "RIGHTS-OF-WAY/DITCH (9400)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building",
    "property_usecode": "CHURCHES (7100)"
  },
  {
    "property_usecode": "PLNTD PINE 5 (5810)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "WATER MGMT (8001)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 4 W/MH (6302)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "PASTURE CLS2 (6100)"
  },
  {
    "property_usecode": "CRPLND CLASS 2 W/SFR (5201)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 3 W/SFR (5601)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "TIMBERLAND 3 (5600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "PASTURELAND 2 W/SFR (6101)"
  },
  {
    "property_usecode": "PLANTED PINE 3 (5610)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel",
    "property_usecode": "PASTURE CLS4 (6300)"
  },
  {
    "property_usecode": "CRPLND CLASS 2 W/EF (5270)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND CLS2 (5200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 3 W/MH (5602)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "PLNTD PINE 4 (5710)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 3 W/MH (6202)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SWAMP (5900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 5 W/EF (5870)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PLNTD PINE W/EF (5670)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel",
    "property_usecode": "TIMBERLAND 60-69 (5700)"
  },
  {
    "property_usecode": "PASTURE CLS 3 (6200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROP III/SFR (5301)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROPLAND W/ MH (5202)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SWAMP W/EF (5970)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Conservation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "PASTURELAND 4 W/MISC (6377)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building",
    "property_usecode": "MORTUARY/CEMETARY/CREMATORY (7600)"
  },
  {
    "property_usecode": "CROPLAND CLASS 4 (5310)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SWAMP W/MH (5902)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building",
    "property_usecode": "MUNICIPAL (8900)"
  },
  {
    "property_usecode": "CRPLND CLASS 4 W/MH (5312)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "TIMBERLAND W/EF (5777)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MH/ADDITION (0210)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "PASTURELAND 2 W/EF (6170)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building",
    "property_usecode": "REPAIR SERVICE (NON AUTOMOTIVE) (2500)"
  },
  {
    "property_usecode": "PASTURELAND 2 W/MH (6102)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "SWAMP W/SFR (5911)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "PLNTD PINE 2 (5510)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 3 W/EF (5677)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "LAKE BOTTOM (5901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel",
    "property_usecode": "TOWER SITE (9100)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel",
    "property_usecode": "GOVT VAC (8000)"
  },
  {
    "property_usecode": "COMMON AREA (0049)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIITF (8701)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "REC AND PARK LAND (9700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "COMMON AREA RESIDENTIAL (0900)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "TIMBERLAND W/SFR (5701)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "PASTURELAND 3 W/SFR (6201)"
  },
  {
    "property_usecode": "RELIGIOUS/VACANT (7000)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SFR TD 07 (0120)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "SFRES/CUSTOM (0101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building",
    "property_usecode": "PUB SCHL IMP (8300)"
  },
  {
    "property_usecode": "TIMBERLAND 2 (5500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "UTILITIES (9199)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CROP III (5300)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "CRPLND CLASS W/SFR (5101)"
  },
  {
    "property_usecode": "VAC COM W/MISC IMP (1077)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "SOCIAL HALL/WEDDING VENUE (7710)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "Building",
    "property_usecode": "RV/MH,PK LOT (2800)"
  },
  {
    "property_usecode": "CRPLND CLASS 4 W/SFR (5311)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel",
    "property_usecode": "BORROW PITS (9600)"
  },
  {
    "property_usecode": "ENCLOSED ARENAS (3403)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building",
    "property_usecode": "STORES/1 STORY (1100)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building",
    "property_usecode": "VEH SALE/REPAIR (2700)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building",
    "property_usecode": "OFFICE BLD 1STY (1700)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel",
    "property_usecode": "VACANT COMMERCIAL (1000)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel",
    "property_usecode": "MXD USE STORE (1200)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building",
    "property_usecode": "WAREHOUSE (4800)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building",
    "property_usecode": "FINANCIAL BLDG (2300)"
  },
  {
    "property_usecode": "AUTO SALES (2701)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building",
    "property_usecode": "RESTAURANT/CAFE (2100)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building",
    "property_usecode": "HOTELS/MOTELS (3900)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building",
    "property_usecode": "CHARITABLE SERVICES (7500)"
  },
  {
    "property_usecode": "BEAUTY SHOP (1901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building",
    "property_usecode": "MULTI LIVING UNITS <10 (0800)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building",
    "property_usecode": "FEDERAL (8800)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building",
    "property_usecode": "CLUBS/LODGES/HALLS (7700)"
  },
  {
    "property_usecode": "SUPERMARKET/NEIGHBOR (1401)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "POST OFFICE (1701)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "THEATER/AUDITORIUM (3200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "STORE (1101)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building",
    "property_usecode": "PROFESS SVC/MEDICAL BLD (1900)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building",
    "property_usecode": "SERVICE STATION (2600)"
  },
  {
    "property_usecode": "CONV STORE/GAS (1102)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building",
    "property_usecode": "WAREHOUSE/STORAGE (4801)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building",
    "property_usecode": "PRVT SCHL/DAY CARE (7200)"
  },
  {
    "property_usecode": "FOREST, PARKS, REC (8200)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "MINI WAREHOUSE (4802)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "FUNERAL HOME (7699)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "MED SUPPLY (1902)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building",
    "property_usecode": "LIGHT MANUFACTURE (4100)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building",
    "property_usecode": "DRIVE-IN REST. (2200)"
  },
  {
    "property_usecode": "HOSPITALS (8500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "REST HOMES (7800)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building",
    "property_usecode": "COMMUNITY SHOPPING (1600)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building",
    "property_usecode": "LUMBER YARD (4300)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel",
    "property_usecode": "VACANT INDUSTRIAL (4000)"
  },
  {
    "property_usecode": "REGIONAL SHOPPING (1500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOTELS/MTL/SFR (3901)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "RIVERS AND LAKES (9500)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "CRPLND CLASS 3 W/EF (5370)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "TIMBERLAND 2 W/SFR (5501)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "PASTURELAND 3 W/EF (6270)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "SFRES PILING (0102)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building",
    "property_usecode": "STATE (8700)"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building",
    "property_usecode": "HOMES FOR THE AGED (7400)"
  },
  {
    "property_usecode": "CRPLND CLASS W/EF (5170)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RECREATION BUILDING (3599)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Building"
  },
  {
    "property_usecode": "CROP III MISC/IMP (5307)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "RACE TRACKS (3700)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RaceTrack",
    "property_type": "Building"
  },
  {
    "property_usecode": "HOTEL/MOTEL/LOW RISE (3902)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "RETIREMENT HOMES (0600)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel",
    "property_usecode": "CENTRALLY ASSED (9800)"
  },
  {
    "property_usecode": "SFR TD 07 CUSTOM (0121)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel",
    "property_usecode": "GOLF COURSE (3800)"
  },
  {
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel",
    "property_usecode": "SUBSURFACE RGHTS (9300)"
  }
]

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

function writeRelationshipFile(p, fromPath, toPath) {
  writeJSON(p, {
    from: { "/": fromPath },
    to: { "/": toPath },
  });
}

function normalizeCoordinate(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
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
    let th = textOf($(tr).find("th strong"));
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
    let th = textOf($(tr).find("th strong"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("property use code")) {
      code = textOf($(tr).find("td span"));
    }
  });
  return code || null;
}

const propertyAttributesByUseCode = propertyTypeMapping.reduce((lookup, entry) => {
  if (!entry || !entry.property_usecode) {
    return lookup;
  }

  const normalizedUseCode = entry.property_usecode.replace(/\s+/g, "").toUpperCase();

  if (!normalizedUseCode) {
    return lookup;
  }

  const { property_usecode, ...rest } = entry;
  lookup[normalizedUseCode] = { ...rest };
  return lookup;
}, {});

function mapPropertyAttributesFromUseCode(code) {
  if (!code && code !== 0) return null;

  const normalizedInput = String(code).replace(/\s+/g, "").toUpperCase();
  if (!normalizedInput) return null;

  if (
    Object.prototype.hasOwnProperty.call(
      propertyAttributesByUseCode,
      normalizedInput,
    )
  ) {
    return { ...propertyAttributesByUseCode[normalizedInput] };
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

function containsManufacturedHome(buildings) {
  if (!Array.isArray(buildings)) return false;
  return buildings.some((building) => {
    if (!building) return false;
    const rawType =
      (typeof building.Type === "string" && building.Type) ||
      (typeof building["Building Type"] === "string" &&
        building["Building Type"]) ||
      (typeof building.Description === "string" && building.Description) ||
      "";
    const normalized = textTrim(rawType).toUpperCase();
    if (!normalized) return false;
    if (normalized.includes("MOBILE")) return true;
    if (normalized.includes("MANUFACT")) return true;
    if (/\bMH\b/.test(normalized)) return true;
    return false;
  });
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function extractBuildingYears($, buildingsArg) {
  const buildings = Array.isArray(buildingsArg)
    ? buildingsArg
    : collectBuildings($);
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

function extractAreas($, buildingsArg) {
  let total = 0;
  const buildings = Array.isArray(buildingsArg)
    ? buildingsArg
    : collectBuildings($);
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
    if (!tds.length) return;
    const multiParcel = textOf($(tds[0]));
    const saleDate = textOf($(tds[1]));
    const salePrice = textOf($(tds[2]));
    const instrument = textOf($(tds[3]));
    const bookPage = textOf($(tds[4]));
    const saleType = textOf($(tds[5]));
    const link = $(tds[4]).find("a").last().attr("href") || null;
    const grantor = textOf($(tds[6]));
    const grantee = textOf($(tds[7]));
    out.push({
      multiParcel,
      saleDate,
      salePrice,
      instrument,
      bookPage,
      saleType,
      link,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  return null;
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
}

function mapFileDocumentTypeForDeed() {
  return "Title";
}

function mapSaleType(raw) {
  if (!raw) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("probate")) return "ProbateSale";
  if (normalized.includes("short")) return "ShortSale";
  if (normalized.includes("reo") || normalized.includes("bank owned"))
    return "ReoPostForeclosureSale";
  if (normalized.includes("relocation")) return "RelocationSale";
  if (normalized.includes("trustee") && normalized.includes("judicial"))
    return "TrusteeJudicialForeclosureSale";
  if (normalized.includes("trustee") && normalized.includes("non"))
    return "TrusteeNonJudicialForeclosureSale";
  if (normalized.includes("court"))
    return "CourtOrderedNonForeclosureSale";
  if (normalized.includes("qualified") && !normalized.includes("unqual"))
    return "TypicallyMotivated";
  return null;
}

function inferFileFormatFromUrl(link) {
  if (!link) return null;
  const lower = String(link).split(/[?#]/)[0].toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "tiff";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  if (lower.endsWith(".png")) return "png";
  return null;
}

function parseBookPage(value) {
  if (!value) return { book: null, page: null };
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  const match = cleaned.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return { book: null, page: null };
  return { book: match[1], page: match[2] };
}

function parseDeedLinkDetails(link) {
  if (!link) return { volume: null, instrumentNumber: null };
  try {
    const url = new URL(link);
    const segments = url.pathname.split("/").filter(Boolean);
    const extIdx = segments.indexOf("ext");
    const instrumentNumber =
      extIdx !== -1 && segments[extIdx + 1] ? segments[extIdx + 1] : null;
    const remainder =
      extIdx !== -1 ? segments.slice(extIdx + 2).filter(Boolean) : [];
    let volume = null;
    if (remainder.length >= 2) {
      const [first, second] = remainder;
      if (/[A-Za-z]/.test(first || "")) volume = first;
      else if (/[A-Za-z]/.test(second || "")) volume = second;
    }
    return { volume: volume || null, instrumentNumber: instrumentNumber || null };
  } catch (e) {
    return { volume: null, instrumentNumber: null };
  }
}

function clearExistingSalesArtifacts() {
  let files = [];
  try {
    files = fs.readdirSync("data");
  } catch (e) {
    return;
  }
  files.forEach((f) => {
    if (
      /^(sales_\d+|sales_history_\d+|deed_\d+|file_\d+)\.json$/i.test(f) ||
      /^relationship_(deed_file|sales_deed|sales_history_deed|sales_history_person|sales_history_company|sales_person|sales_company|deed_\d+_has_file_\d+)\.json$/i.test(
        f,
      )
    ) {
      try {
        fs.unlinkSync(path.join("data", f));
      } catch (e) {}
    }
  });
}

function clearExistingPersonCompanyFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^person_\d+\.json$/i.test(f) || /^company_\d+\.json$/i.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
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
    };
  });
}

function writeProperty($, parcelId, propertySeed) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const buildings = collectBuildings($);
  const propertyAttributes = mapPropertyAttributesFromUseCode(useCode);
  if (!propertyAttributes) {
    throw {
      type: "error",
      message: `Unknown enum value ${useCode}.`,
      path: "property.property_type",
    };
  }
  let propertyType = propertyAttributes.property_type ?? null;
  let structureForm = propertyAttributes.structure_form ?? null;
  const ownershipEstateType = propertyAttributes.ownership_estate_type ?? null;
  const buildStatus = propertyAttributes.build_status ?? null;
  const propertyUsageType = propertyAttributes.property_usage_type ?? null;

  if (containsManufacturedHome(buildings)) {
    propertyType = "ManufacturedHome";
    structureForm = "MobileHome";
  }
  const years = extractBuildingYears($, buildings);
  const totalArea = extractAreas($, buildings);
  const sourceHttpRequest =
    (propertySeed && propertySeed.source_http_request) || null;
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) || parcelId || null;

  const property = {
    parcel_identifier: parcelId || "",
    request_identifier: requestIdentifier,
    source_http_request: sourceHttpRequest,
    ownership_estate_type: ownershipEstateType,
    build_status: buildStatus,
    structure_form: structureForm,
    property_usage_type: propertyUsageType,
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    property_type: propertyType,
    livable_floor_area: null,
    total_area: totalArea >= 10 ? String(totalArea) : null,
    number_of_units_type: null,
    area_under_air: null,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  writeJSON(path.join("data", "property.json"), property);
  return property;
}

function writeSalesHistoryDeedsAndFiles(sales, parcelId, propertySeed) {
  const saleRecords = Array.isArray(sales) ? sales : [];
  clearExistingSalesArtifacts();
  const results = [];
  let fileCounter = 0;
  const requestIdentifier = parcelId || null;
  const sourceHttpRequest =
    (propertySeed && propertySeed.source_http_request) || null;

  saleRecords.forEach((sale, index) => {
    const idx = index + 1;
    const isoDate = parseDateToISO(sale.saleDate);
    const salesHistoryFile = `sales_history_${idx}.json`;
    const deedFile = `deed_${idx}.json`;

    const salesHistoryObj = {
      ownership_transfer_date: isoDate,
      request_identifier: requestIdentifier,
      source_http_request: sourceHttpRequest,
    };
    const purchasePrice = parseCurrencyToNumber(sale.salePrice);
    if (purchasePrice != null) salesHistoryObj.purchase_price_amount = purchasePrice;
    const saleType = mapSaleType(sale.saleType);
    if (saleType) salesHistoryObj.sale_type = saleType;
    writeJSON(path.join("data", salesHistoryFile), salesHistoryObj);

    const deedObj = {
      request_identifier: requestIdentifier,
      source_http_request: sourceHttpRequest,
    };
    const deedType = mapInstrumentToDeedType(sale.instrument);
    if (deedType) deedObj.deed_type = deedType;
    const { book, page } = parseBookPage(sale.bookPage);
    const { volume, instrumentNumber } = parseDeedLinkDetails(sale.link);
    if (book) deedObj.book = book;
    if (page) deedObj.page = page;
    if (volume) deedObj.volume = volume;
    if (instrumentNumber) deedObj.instrument_number = instrumentNumber;
    writeJSON(path.join("data", deedFile), deedObj);

    writeRelationshipFile(
      path.join("data", `relationship_sales_history_deed_${idx}.json`),
      `./${salesHistoryFile}`,
      `./${deedFile}`,
    );

    fileCounter += 1;
    const fileFile = `file_${fileCounter}.json`;
    const fileObj = {
      document_type: mapFileDocumentTypeForDeed(),
      file_format: sale.link ? inferFileFormatFromUrl(sale.link) : null,
      ipfs_url: null,
      name: sale.bookPage ? `Deed ${sale.bookPage}` : "Deed Document",
      original_url: sale.link || null,
      request_identifier: requestIdentifier,
      source_http_request: sourceHttpRequest,
    };
    writeJSON(path.join("data", fileFile), fileObj);

    writeRelationshipFile(
      path.join(
        "data",
        `relationship_deed_${idx}_has_file_${fileCounter}.json`,
      ),
      `./${deedFile}`,
      `./${fileFile}`,
    );

    results.push({
      index: idx,
      isoDate,
      salesHistoryRef: `./${salesHistoryFile}`,
      deedRef: `./${deedFile}`,
    });
  });

  return results;
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
  const tn = (name || "").replace(/\s+/g, " ").trim().toUpperCase();
  for (let i = 0; i < companies.length; i++) {
    const existing = (companies[i].name || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    if (existing === tn) return i + 1;
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

function writePersonCompaniesSalesRelationships(
  parcelId,
  sales,
  salesHistoryRecords,
  propertySeed,
) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const mailingAddressRaw = record.mailing_address || null;
  const trimmedMailingAddress = mailingAddressRaw
    ? mailingAddressRaw.replace(/\s+/g, " ").trim()
    : null;

  let existingMailingRelFiles = [];
  try {
    existingMailingRelFiles = fs.readdirSync("data");
  } catch (e) {}
  existingMailingRelFiles
    .filter((file) =>
      /^relationship_(person|company)_\d+_has_mailing_address\.json$/i.test(
        file,
      ),
    )
    .forEach((file) => {
      try {
        fs.unlinkSync(path.join("data", file));
      } catch (e) {}
    });
  if (!trimmedMailingAddress) {
    try {
      const mailingPath = path.join("data", "mailing_address.json");
      if (fs.existsSync(mailingPath)) fs.unlinkSync(mailingPath);
    } catch (e) {}
  }

  clearExistingPersonCompanyFiles();

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
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  companies = Array.from(companyNames).map((n) => ({
    name: normalizeCompanyName(n),
    request_identifier: parcelId,
  }));
  const saleRecords = Array.isArray(sales) ? sales : [];
  const saleByIndex = new Map();
  saleRecords.forEach((sale, idx) => {
    saleByIndex.set(idx + 1, sale);
  });

  const safeSalesHistory = Array.isArray(salesHistoryRecords)
    ? salesHistoryRecords
        .map((rec) => {
          if (!rec) return null;
          const index = Number(rec.index);
          if (!Number.isInteger(index) || index <= 0 || !rec.salesHistoryRef)
            return null;
          return {
            index,
            isoDate: rec.isoDate || null,
            salesHistoryRef: rec.salesHistoryRef,
          };
        })
        .filter(Boolean)
    : [];

  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  const personLinksWritten = new Set();
  const companyLinksWritten = new Set();
  const referencedPersons = new Set();
  const referencedCompanies = new Set();

  function normalizeCompanyName(name) {
    return (name || "").replace(/\s+/g, " ").trim();
  }

  const companyKeywords = [
    "LLC",
    "L.L.C",
    "INC",
    "CORP",
    "COMPANY",
    "CO",
    "BANK",
    "ASSOCIATES",
    "ASSOCIATION",
    "HOSPITAL",
    "UNIVERSITY",
    "COLLEGE",
    "SCHOOL",
    "TRUST",
    "CITY",
    "COUNTY",
    "STATE",
    "AUTHORITY",
    "FUND",
    "MINISTRIES",
    "CHURCH",
    "HOLDINGS",
    "PARTNERS",
    "LLP",
    "LP",
    "PLC",
    "PLLC",
  ];

  const suffixTokens = new Set([
    "JR",
    "SR",
    "II",
    "III",
    "IV",
    "V",
    "MD",
    "DDS",
  ]);

  function isLikelyCompany(name) {
    const upper = (name || "").toUpperCase();
    return companyKeywords.some((kw) => upper.includes(kw));
  }

  function splitPartyString(raw) {
    if (!raw) return [];
    let cleaned = String(raw)
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || /^none$/i.test(cleaned)) return [];
    cleaned = cleaned.replace(/\s+&\s+/g, "|");
    cleaned = cleaned.replace(/\s+AND\s+/gi, "|");
    cleaned = cleaned.replace(/;\s*/g, "|");
    cleaned = cleaned.replace(/\s*\/\s*/g, "|");
    const parts = cleaned
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) parts.push(cleaned);
    return parts;
  }

  function parseParty(part) {
    if (!part) return null;
    const normalized = part.replace(/\*/g, "").trim();
    if (!normalized || /^none$/i.test(normalized)) return null;
    if (isLikelyCompany(normalized)) {
      return {
        type: "company",
        name: normalizeCompanyName(normalized),
      };
    }
    let working = normalized.replace(/,/g, " ");
    working = working.replace(/\s+/g, " ").trim();
    const tokens = working.split(" ").filter(Boolean);
    if (tokens.length < 2) {
      return {
        type: "company",
        name: normalizeCompanyName(normalized),
      };
    }
    let suffix = null;
    const lastToken = tokens[tokens.length - 1].replace(/\./g, "");
    if (suffixTokens.has(lastToken.toUpperCase())) {
      suffix = titleCaseName(lastToken);
      tokens.pop();
    }
    const first = tokens.shift();
    const last = tokens.pop();
    const middle = tokens.length ? tokens.join(" ") : null;
    return {
      type: "person",
      first_name: titleCaseName(first),
      middle_name: middle ? titleCaseName(middle) : null,
      last_name: titleCaseName(last),
      prefix_name: null,
      suffix_name: suffix ? titleCaseName(suffix) : null,
    };
  }

  function collectPartiesFromString(raw) {
    return splitPartyString(raw)
      .map((segment) => parseParty(segment))
      .filter(Boolean);
  }

  function linkPersonToSale(saleRef, personIdx) {
    if (!saleRef || !personIdx) return;
    const key = `${saleRef}|person_${personIdx}`;
    if (personLinksWritten.has(key)) return;
    personLinksWritten.add(key);
    referencedPersons.add(personIdx);
    relPersonCounter += 1;
    writeRelationshipFile(
      path.join(
        "data",
        `relationship_sales_history_person_${relPersonCounter}.json`,
      ),
      saleRef,
      `./person_${personIdx}.json`,
    );
  }

  function linkCompanyToSale(saleRef, companyIdx) {
    if (!saleRef || !companyIdx) return;
    const key = `${saleRef}|company_${companyIdx}`;
    if (companyLinksWritten.has(key)) return;
    companyLinksWritten.add(key);
    referencedCompanies.add(companyIdx);
    relCompanyCounter += 1;
    writeRelationshipFile(
      path.join(
        "data",
        `relationship_sales_history_company_${relCompanyCounter}.json`,
      ),
      saleRef,
      `./company_${companyIdx}.json`,
    );
  }

  function normalizeOwnerRecord(owner) {
    if (!owner || !owner.type) return null;
    if (owner.type === "person") {
      return {
        type: "person",
        first_name: owner.first_name ? titleCaseName(owner.first_name) : null,
        middle_name: owner.middle_name ? titleCaseName(owner.middle_name) : null,
        last_name: owner.last_name ? titleCaseName(owner.last_name) : null,
        prefix_name: owner.prefix_name ? titleCaseName(owner.prefix_name) : null,
        suffix_name: owner.suffix_name ? titleCaseName(owner.suffix_name) : null,
      };
    }
    if (owner.type === "company") {
      return {
        type: "company",
        name: normalizeCompanyName(owner.name),
      };
    }
    return null;
  }

  function ensurePersonRecord(details) {
    if (!details || !details.first_name || !details.last_name) return null;
    const idx = findPersonIndexByName(details.first_name, details.last_name);
    if (idx) return idx;
    const newPerson = {
      first_name: details.first_name ? titleCaseName(details.first_name) : null,
      middle_name: details.middle_name ? titleCaseName(details.middle_name) : null,
      last_name: details.last_name ? titleCaseName(details.last_name) : null,
      birth_date: null,
      prefix_name: details.prefix_name ? titleCaseName(details.prefix_name) : null,
      suffix_name: details.suffix_name ? titleCaseName(details.suffix_name) : null,
      us_citizenship_status: null,
      veteran_status: null,
      request_identifier: parcelId,
    };
    people.push(newPerson);
    return people.length;
  }

  function ensureCompanyRecord(name) {
    if (!name) return null;
    const normalized = normalizeCompanyName(name);
    const existingIdx = findCompanyIndexByName(normalized);
    if (existingIdx) return existingIdx;
    const newCompany = {
      name: normalized,
      request_identifier: parcelId,
    };
    companies.push(newCompany);
    return companies.length;
  }

  function writePersonCompanyFiles() {
    people.forEach((p, idx) => {
      const personIdx = idx + 1;
      if (!referencedPersons.has(personIdx)) return;
      const out = {
        ...p,
        request_identifier: p.request_identifier ?? parcelId,
      };
      writeJSON(path.join("data", `person_${personIdx}.json`), out);
    });
    companies.forEach((c, idx) => {
      const companyIdx = idx + 1;
      if (!referencedCompanies.has(companyIdx)) return;
      const out = {
        ...c,
        request_identifier: c.request_identifier ?? parcelId,
      };
      writeJSON(path.join("data", `company_${companyIdx}.json`), out);
    });
  }

  safeSalesHistory.forEach((rec) => {
    const saleRef = rec.salesHistoryRef;
    let isoDate = rec.isoDate || null;
    if (!isoDate && saleByIndex.has(rec.index)) {
      const saleRecord = saleByIndex.get(rec.index);
      isoDate = saleRecord ? parseDateToISO(saleRecord.saleDate) : null;
    }
    const saleRecord = saleByIndex.get(rec.index) || null;
    let participants = [];
    const ownersOnDate =
      isoDate && ownersByDate[isoDate] ? ownersByDate[isoDate] : [];
    if (ownersOnDate.length) {
      participants = ownersOnDate
        .map((owner) => normalizeOwnerRecord(owner))
        .filter(Boolean);
    }
    if (!participants.length && saleRecord) {
      participants = collectPartiesFromString(saleRecord.grantee);
    }
    if (!participants.length) {
      const nextSale = saleByIndex.get(rec.index - 1);
      if (nextSale) {
        participants = collectPartiesFromString(nextSale.grantor);
      }
    }
    if (!participants.length && saleRecord) {
      participants = collectPartiesFromString(saleRecord.grantor);
    }
    const uniqueParticipants = [];
    const participantKeys = new Set();
    participants.forEach((party) => {
      if (!party) return;
      let key;
      if (party.type === "person") {
        key = `person:${(party.first_name || "").toUpperCase()}|${(party.middle_name || "").toUpperCase()}|${(party.last_name || "").toUpperCase()}|${(party.suffix_name || "").toUpperCase()}`;
      } else if (party.type === "company") {
        key = `company:${normalizeCompanyName(party.name).toUpperCase()}`;
      }
      if (!key || participantKeys.has(key)) return;
      participantKeys.add(key);
      uniqueParticipants.push(party);
    });

    uniqueParticipants.forEach((party) => {
      if (party.type === "person") {
        const idx = ensurePersonRecord(party);
        if (idx) linkPersonToSale(saleRef, idx);
      } else if (party.type === "company") {
        const idx = ensureCompanyRecord(party.name);
        if (idx) linkCompanyToSale(saleRef, idx);
      }
    });
  });

  const currentOwners = Array.isArray(ownersByDate.current)
    ? ownersByDate.current
    : [];
  if (currentOwners.length > 0 && safeSalesHistory.length > 0) {
    let latestSaleRecord = null;
    safeSalesHistory.forEach((rec) => {
      if (!rec) return;
      if (!latestSaleRecord) {
        latestSaleRecord = rec;
        return;
      }
      const recIso = rec.isoDate || null;
      const latestIso = latestSaleRecord.isoDate || null;
      if (recIso && !latestIso) {
        latestSaleRecord = rec;
        return;
      }
      if (recIso && latestIso && recIso > latestIso) {
        latestSaleRecord = rec;
      }
    });
    if (!latestSaleRecord) {
      latestSaleRecord = safeSalesHistory[0];
    }
    if (latestSaleRecord && latestSaleRecord.salesHistoryRef) {
      const saleRef = latestSaleRecord.salesHistoryRef;
      currentOwners.forEach((owner) => {
        if (!owner || !owner.type) return;
        if (owner.type === "person") {
          const pIdx = findPersonIndexByName(
            owner.first_name,
            owner.last_name,
          );
          if (pIdx) linkPersonToSale(saleRef, pIdx);
        } else if (owner.type === "company") {
          const cIdx = findCompanyIndexByName(owner.name);
          if (cIdx) linkCompanyToSale(saleRef, cIdx);
        }
      });
    }
  }

  if (trimmedMailingAddress) {
    const mailingAddressPath = path.join("data", "mailing_address.json");
    const mailingAddress = {
      unnormalized_address: trimmedMailingAddress,
      latitude: null,
      longitude: null,
      source_http_request:
        (propertySeed && propertySeed.source_http_request) || null,
      request_identifier:
        parcelId || (propertySeed && propertySeed.request_identifier) || null,
    };
    writeJSON(mailingAddressPath, mailingAddress);

    const currentOwners = Array.isArray(ownersByDate.current)
      ? ownersByDate.current
      : [];
    const personIndexes = new Set();
    const companyIndexes = new Set();
    currentOwners.forEach((owner) => {
      if (owner.type === "person") {
        const idx = findPersonIndexByName(owner.first_name, owner.last_name);
        if (idx) personIndexes.add(idx);
      } else if (owner.type === "company") {
        const idx = findCompanyIndexByName(owner.name);
        if (idx) companyIndexes.add(idx);
      }
    });
    Array.from(personIndexes)
      .sort((a, b) => a - b)
      .forEach((personIdx) => {
        if (!referencedPersons.has(personIdx)) return;
        writeRelationshipFile(
          path.join(
            "data",
            `relationship_person_${personIdx}_has_mailing_address.json`,
          ),
          `./person_${personIdx}.json`,
          "./mailing_address.json",
        );
      });
    Array.from(companyIndexes)
      .sort((a, b) => a - b)
      .forEach((companyIdx) => {
        if (!referencedCompanies.has(companyIdx)) return;
        writeRelationshipFile(
          path.join(
            "data",
            `relationship_company_${companyIdx}_has_mailing_address.json`,
          ),
          `./company_${companyIdx}.json`,
          "./mailing_address.json",
        );
      });
  }

  writePersonCompanyFiles();
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

function clearExistingUtilityFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^utility_\d+\.json$/i.test(f) ||
        /^utility\.json$/i.test(f) ||
        /^relationship_layout_\d+_has_utility_\d+\.json$/i.test(f) ||
        /^relationship_property_has_utility_\d+\.json$/i.test(f) ||
        /^relationship_layout_has_utility_\d*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeUtility(parcelId) {
  clearExistingUtilityFiles();
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  if (!utils) return [];
  const key = `property_${parcelId}`;
  const record = utils[key];
  if (!record) return [];
  let utilities = [];
  if (Array.isArray(record)) utilities = record;
  else if (record && Array.isArray(record.utilities)) utilities = record.utilities;
  else if (record) utilities = [record];
  if (!utilities.length) return [];
  const outInfo = [];
  utilities.forEach((utility, idx) => {
    const index = idx + 1;
    const out = {
      cooling_system_type: utility.cooling_system_type ?? null,
      heating_system_type: utility.heating_system_type ?? null,
      public_utility_type: utility.public_utility_type ?? null,
      sewer_type: utility.sewer_type ?? null,
      water_source_type: utility.water_source_type ?? null,
      plumbing_system_type: utility.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utility.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utility.electrical_panel_capacity ?? null,
      electrical_wiring_type: utility.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: utility.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        utility.electrical_wiring_type_other_description ?? null,
      solar_panel_present: utility.solar_panel_present ?? false,
      solar_panel_type: utility.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utility.solar_panel_type_other_description ?? null,
      smart_home_features: utility.smart_home_features ?? null,
      smart_home_features_other_description:
        utility.smart_home_features_other_description ?? null,
      hvac_unit_condition: utility.hvac_unit_condition ?? null,
      solar_inverter_visible: utility.solar_inverter_visible ?? false,
      hvac_unit_issues: utility.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        utility.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utility.electrical_rewire_date ?? null,
      hvac_capacity_kw: utility.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utility.hvac_capacity_tons ?? null,
      hvac_equipment_component: utility.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: utility.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utility.hvac_equipment_model ?? null,
      hvac_installation_date: utility.hvac_installation_date ?? null,
      hvac_seer_rating: utility.hvac_seer_rating ?? null,
      hvac_system_configuration: utility.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
        utility.plumbing_system_installation_date ?? null,
      sewer_connection_date: utility.sewer_connection_date ?? null,
      solar_installation_date: utility.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utility.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: utility.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utility.solar_inverter_model ?? null,
      water_connection_date: utility.water_connection_date ?? null,
      water_heater_installation_date: utility.water_heater_installation_date ?? null,
      water_heater_manufacturer: utility.water_heater_manufacturer ?? null,
      water_heater_model: utility.water_heater_model ?? null,
      well_installation_date: utility.well_installation_date ?? null,
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", `utility_${index}.json`), out);
    outInfo.push({
      index,
      fileName: `utility_${index}.json`,
      building_number:
        typeof utility.building_number === "number"
          ? utility.building_number
          : null,
      is_extra_feature: !!utility.is_extra_feature,
    });
  });
  return outInfo;
}

function clearExistingStructureFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^structure_\d+\.json$/i.test(f) ||
        /^structure\.json$/i.test(f) ||
        /^relationship_layout_\d+_has_structure_\d+\.json$/i.test(f) ||
        /^relationship_property_has_structure_\d+\.json$/i.test(f) ||
        /^relationship_layout_has_structure_\d*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeStructures(parcelId) {
  clearExistingStructureFiles();
  const structuresData = readJSON(path.join("owners", "structure_data.json"));
  if (!structuresData) return [];
  const key = `property_${parcelId}`;
  const record = structuresData[key];
  if (!record) return [];
  let structures = [];
  if (Array.isArray(record)) structures = record;
  else if (record && Array.isArray(record.structures)) structures = record.structures;
  else if (record) structures = [record];
  if (!structures.length) return [];
  const info = [];
  structures.forEach((structure, idx) => {
    const index = idx + 1;
    const out = { ...structure };
    const buildingNumber =
      typeof structure.building_number === "number"
        ? structure.building_number
        : null;
    const isExtraFeature = !!structure.is_extra_feature;
    delete out.building_number;
    delete out.is_extra_feature;
    out.request_identifier = parcelId;
    writeJSON(path.join("data", `structure_${index}.json`), out);
    info.push({
      index,
      fileName: `structure_${index}.json`,
      building_number: buildingNumber,
      is_extra_feature: isExtraFeature,
    });
  });
  return info;
}

function clearExistingLayoutFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^layout_\d+\.json$/i.test(f) ||
        /^relationship_layout_\d+_has_layout_\d+\.json$/i.test(f) ||
        /^relationship_layout_\d+_has_structure_\d+\.json$/i.test(f) ||
        /^relationship_layout_\d+_has_utility_\d+\.json$/i.test(f) ||
        /^relationship_layout_has_layout_\d*\.json$/i.test(f) ||
        /^relationship_property_has_layout_\d+\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeLayout(parcelId, propertyType, structuresInfo, utilitiesInfo) {
  clearExistingLayoutFiles();
  if (!parcelId) return;
  const isLandParcel = (propertyType || "").toLowerCase() === "landparcel";
  const layoutsData = readJSON(path.join("owners", "layout_data.json"));
  const key = `property_${parcelId}`;
  const entry = layoutsData ? layoutsData[key] : null;

  const layoutOutputs = Array.isArray(entry && entry.layouts)
    ? entry.layouts.map((lay, idx) => {
        const index = idx + 1;
        const childIndices = Array.isArray(lay.layout_has_layout)
          ? lay.layout_has_layout
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n > 0)
          : [];
        const data = {
          space_type: lay.space_type ?? null,
          space_index: lay.space_index ?? index,
          space_type_index: lay.space_type_index ?? null,
          building_number:
            typeof lay.building_number === "number" ? lay.building_number : null,
          flooring_material_type: lay.flooring_material_type ?? null,
          size_square_feet: lay.size_square_feet ?? null,
          floor_level: lay.floor_level ?? null,
          has_windows:
            typeof lay.has_windows === "boolean" ? lay.has_windows : null,
          window_design_type: lay.window_design_type ?? null,
          window_material_type: lay.window_material_type ?? null,
          window_treatment_type: lay.window_treatment_type ?? null,
          is_finished:
            typeof lay.is_finished === "boolean" ? lay.is_finished : false,
          furnished: lay.furnished ?? null,
          paint_condition: lay.paint_condition ?? null,
          flooring_wear: lay.flooring_wear ?? null,
          clutter_level: lay.clutter_level ?? null,
          visible_damage: lay.visible_damage ?? null,
          countertop_material: lay.countertop_material ?? null,
          cabinet_style: lay.cabinet_style ?? null,
          fixture_finish_quality: lay.fixture_finish_quality ?? null,
          design_style: lay.design_style ?? null,
          natural_light_quality: lay.natural_light_quality ?? null,
          decor_elements: lay.decor_elements ?? null,
          pool_type: lay.pool_type ?? null,
          pool_equipment: lay.pool_equipment ?? null,
          spa_type: lay.spa_type ?? null,
          safety_features: lay.safety_features ?? null,
          view_type: lay.view_type ?? null,
          lighting_features: lay.lighting_features ?? null,
          condition_issues: lay.condition_issues ?? null,
          is_exterior:
            typeof lay.is_exterior === "boolean" ? lay.is_exterior : false,
          pool_condition: lay.pool_condition ?? null,
          pool_surface_type: lay.pool_surface_type ?? null,
          pool_water_quality: lay.pool_water_quality ?? null,
          total_area_sq_ft: lay.total_area_sq_ft ?? null,
          livable_area_sq_ft: lay.livable_area_sq_ft ?? null,
          area_under_air_sq_ft: lay.area_under_air_sq_ft ?? null,
          built_year: lay.built_year ?? null,
          request_identifier: parcelId,
        };
        const isExtraFeature = lay.extra_feature === true;
        return {
          index,
          building_number:
            typeof lay.building_number === "number"
              ? lay.building_number
              : null,
          space_type: (lay.space_type || "").trim(),
          child_indices: childIndices,
          is_extra_feature: isExtraFeature,
          data,
        };
      })
    : [];

  const layoutIndexMap = new Map(
    layoutOutputs.map((layout) => [layout.index, layout]),
  );
  const buildingLayouts = layoutOutputs.filter(
    (layout) =>
      (layout.space_type || "").toLowerCase() === "building",
  );

  const layoutToStructures = new Map();
  const propertyStructures = [];
  const extraStructureIdxs = structuresInfo
    .filter((s) => s.is_extra_feature)
    .map((s) => s.index);
  extraStructureIdxs.forEach((idx) => propertyStructures.push(idx));
  const assignableStructures = structuresInfo.filter(
    (s) => !s.is_extra_feature,
  );

  if (!buildingLayouts.length) {
    assignableStructures.forEach((s) => propertyStructures.push(s.index));
  } else if (!assignableStructures.length) {
    // nothing to assign
  } else if (buildingLayouts.length === 1) {
    const buildingIdx = buildingLayouts[0].index;
    assignableStructures.forEach((s) => {
      if (!layoutToStructures.has(buildingIdx)) {
        layoutToStructures.set(buildingIdx, []);
      }
      layoutToStructures.get(buildingIdx).push(s.index);
    });
  } else if (assignableStructures.length === 1) {
    propertyStructures.push(assignableStructures[0].index);
  } else {
    const unused = new Set(assignableStructures.map((s) => s.index));
    const byBuilding = new Map();
    assignableStructures.forEach((s) => {
      if (typeof s.building_number === "number") {
        if (!byBuilding.has(s.building_number)) {
          byBuilding.set(s.building_number, []);
        }
        byBuilding.get(s.building_number).push(s);
      }
    });
    buildingLayouts.forEach((layout) => {
      if (!unused.size) return;
      let chosen = null;
      if (
        typeof layout.building_number === "number" &&
        byBuilding.has(layout.building_number)
      ) {
        chosen = byBuilding
          .get(layout.building_number)
          .find((s) => unused.has(s.index));
      }
      if (!chosen) {
        const iterator = unused.values().next();
        if (!iterator.done) {
          chosen = assignableStructures.find((s) => s.index === iterator.value);
        }
      }
      if (chosen) {
        unused.delete(chosen.index);
        if (!layoutToStructures.has(layout.index)) {
          layoutToStructures.set(layout.index, []);
        }
        layoutToStructures.get(layout.index).push(chosen.index);
      }
    });
    unused.forEach((idx) => propertyStructures.push(idx));
  }

  const layoutToUtilities = new Map();
  const propertyUtilities = [];
  const extraUtilityIdxs = utilitiesInfo
    .filter((u) => u.is_extra_feature)
    .map((u) => u.index);
  extraUtilityIdxs.forEach((idx) => propertyUtilities.push(idx));
  const assignableUtilities = utilitiesInfo.filter(
    (u) => !u.is_extra_feature,
  );

  if (!buildingLayouts.length) {
    assignableUtilities.forEach((u) => propertyUtilities.push(u.index));
  } else if (!assignableUtilities.length) {
    // nothing additional
  } else if (buildingLayouts.length === 1) {
    const buildingIdx = buildingLayouts[0].index;
    assignableUtilities.forEach((u) => {
      if (!layoutToUtilities.has(buildingIdx)) {
        layoutToUtilities.set(buildingIdx, []);
      }
      layoutToUtilities.get(buildingIdx).push(u.index);
    });
  } else if (assignableUtilities.length === 1) {
    propertyUtilities.push(assignableUtilities[0].index);
  } else {
    const unused = new Set(assignableUtilities.map((u) => u.index));
    const byBuilding = new Map();
    assignableUtilities.forEach((u) => {
      if (typeof u.building_number === "number") {
        if (!byBuilding.has(u.building_number)) {
          byBuilding.set(u.building_number, []);
        }
        byBuilding.get(u.building_number).push(u);
      }
    });
    buildingLayouts.forEach((layout) => {
      if (!unused.size) return;
      let chosen = null;
      if (
        typeof layout.building_number === "number" &&
        byBuilding.has(layout.building_number)
      ) {
        chosen = byBuilding
          .get(layout.building_number)
          .find((u) => unused.has(u.index));
      }
      if (!chosen) {
        const iterator = unused.values().next();
        if (!iterator.done) {
          chosen = assignableUtilities.find(
            (u) => u.index === iterator.value,
          );
        }
      }
      if (chosen) {
        unused.delete(chosen.index);
        if (!layoutToUtilities.has(layout.index)) {
          layoutToUtilities.set(layout.index, []);
        }
        layoutToUtilities.get(layout.index).push(chosen.index);
      }
    });
    unused.forEach((idx) => propertyUtilities.push(idx));
  }

  layoutOutputs.forEach((layout) => {
    writeJSON(path.join("data", `layout_${layout.index}.json`), layout.data);
  });

  const propertyLayoutExtras = new Set();

  layoutOutputs.forEach((layout) => {
    layout.child_indices.forEach((childIdx) => {
      const childMeta = layoutIndexMap.get(childIdx);
      if (!childMeta) return;
      if (
        buildingLayouts.length > 1 &&
        (layout.space_type || "").toLowerCase() === "building" &&
        childMeta.is_extra_feature
      ) {
        propertyLayoutExtras.add(childIdx);
        return;
      }
      writeJSON(
        path.join(
          "data",
          `relationship_layout_${layout.index}_has_layout_${childIdx}.json`,
        ),
        {
          from: { "/": `./layout_${layout.index}.json` },
          to: { "/": `./layout_${childIdx}.json` },
        },
      );
    });
  });

  if (buildingLayouts.length > 1) {
    layoutOutputs.forEach((layout) => {
      if (layout.is_extra_feature) {
        propertyLayoutExtras.add(layout.index);
      }
    });
  }

  propertyLayoutExtras.forEach((layoutIdx) => {
    writeJSON(
      path.join("data", `relationship_property_has_layout_${layoutIdx}.json`),
      {
        from: { "/": "./property.json" },
        to: { "/": `./layout_${layoutIdx}.json` },
      },
    );
  });

  layoutToStructures.forEach((structureIdxs, layoutIdx) => {
    structureIdxs.forEach((structureIdx) => {
      writeJSON(
        path.join(
          "data",
          `relationship_layout_${layoutIdx}_has_structure_${structureIdx}.json`,
        ),
        {
          from: { "/": `./layout_${layoutIdx}.json` },
          to: { "/": `./structure_${structureIdx}.json` },
        },
      );
    });
  });

  layoutToUtilities.forEach((utilityIdxs, layoutIdx) => {
    utilityIdxs.forEach((utilityIdx) => {
      writeJSON(
        path.join(
          "data",
          `relationship_layout_${layoutIdx}_has_utility_${utilityIdx}.json`,
        ),
        {
          from: { "/": `./layout_${layoutIdx}.json` },
          to: { "/": `./utility_${utilityIdx}.json` },
        },
      );
    });
  });

  propertyStructures.forEach((structureIdx) => {
    writeJSON(
      path.join(
        "data",
        `relationship_property_has_structure_${structureIdx}.json`,
      ),
      {
        from: { "/": "./property.json" },
        to: { "/": `./structure_${structureIdx}.json` },
      },
    );
  });

  propertyUtilities.forEach((utilityIdx) => {
    writeJSON(
      path.join(
        "data",
        `relationship_property_has_utility_${utilityIdx}.json`,
      ),
      {
        from: { "/": "./property.json" },
        to: { "/": `./utility_${utilityIdx}.json` },
      },
    );
  });

  if (isLandParcel && !layoutOutputs.length) return;
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
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

function attemptWriteAddress(unnorm, secTwpRng, propertySeed) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return false;

  const countyName = (unnorm && unnorm.county_jurisdiction
    ? unnorm.county_jurisdiction.trim()
    : "") || null;
  const sourceHttpRequest =
    (unnorm && unnorm.source_http_request) ||
    (propertySeed && propertySeed.source_http_request) ||
    null;
  const requestIdentifier =
    (unnorm && unnorm.request_identifier) ||
    (propertySeed && propertySeed.request_identifier) ||
    null;

  const address = {
    unnormalized_address: full,
    country_code: "US",
    county_name: countyName,
    source_http_request: sourceHttpRequest,
    request_identifier: requestIdentifier,
  };
  if (secTwpRng && secTwpRng.section) address.section = secTwpRng.section;
  if (secTwpRng && secTwpRng.township) address.township = secTwpRng.township;
  if (secTwpRng && secTwpRng.range) address.range = secTwpRng.range;
  writeJSON(path.join("data", "address.json"), address);
  return true;
}

function writeGeometry(unnorm, propertySeed) {
  const latitude = normalizeCoordinate(unnorm && unnorm.latitude);
  const longitude = normalizeCoordinate(unnorm && unnorm.longitude);

  if (latitude == null && longitude == null) return false;

  const sourceHttpRequest =
    (unnorm && unnorm.source_http_request) ||
    (propertySeed && propertySeed.source_http_request) ||
    null;
  const requestIdentifier =
    (unnorm && unnorm.request_identifier) ||
    (propertySeed && propertySeed.request_identifier) ||
    null;

  const geometry = {
    latitude,
    longitude,
    source_http_request: sourceHttpRequest,
    request_identifier: requestIdentifier,
  };

  writeJSON(path.join("data", "geometry.json"), geometry);
  writeRelationshipFile(
    path.join("data", "relationship_address_has_geometry.json"),
    "./address.json",
    "./geometry.json",
  );
  return true;
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;

  let propertyRecord = null;
  if (parcelId) {
    propertyRecord = writeProperty($, parcelId, propertySeed);
  }
  const propertyType =
    propertyRecord && propertyRecord.property_type
      ? propertyRecord.property_type
      : null;

  const sales = extractSales($);
  const salesHistoryRecords = writeSalesHistoryDeedsAndFiles(
    sales,
    parcelId,
    propertySeed,
  );

  writeTaxes($);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(
      parcelId,
      sales,
      salesHistoryRecords,
      propertySeed,
    );
    // writeOwnersCurrentAndRelationships(parcelId);
    // writeHistoricalBuyerPersonsAndRelationships(parcelId, sales);
    const structuresInfo = writeStructures(parcelId);
    const utilitiesInfo = writeUtility(parcelId);
    writeLayout(parcelId, propertyType, structuresInfo, utilitiesInfo);
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  const wroteAddress = attemptWriteAddress(unnormalized, secTwpRng, propertySeed);
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
