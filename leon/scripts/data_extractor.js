const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const propertyTypeMapping = [
  {
    "property_usecode": "0000 - Vacant Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0004 - Vacant Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0100 - Single Family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0107 - Townhomes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0200 - Mobile Homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeOnLand",
    "property_usage_type": "Residential",
    "property_type": "ManufacturedHome"
  },
  {
    "property_usecode": "0300 - Multi-Family(10 or more Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyMoreThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0400 - Condominium",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Unit"
  },
  {
    "property_usecode": "0600 - Retirement Homes Not Eligible",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Retirement",
    "property_type": "Building"
  },
  {
    "property_usecode": "0700 - Miscellaneous Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0800 - Multi-Family(Less than 10 Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "Building"
  },
  {
    "property_usecode": "0805 - MFR &lt; 10 Units - Commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "0900 - Residential Common Elements/Areas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "0905 - Commercial Common Area/Elements",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1000 - Vacant Commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "1100 - Stores, One Story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1200 - Mixed Use, Store/Office/Resi",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "1300 - Department Store",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "property_usecode": "1400 - Supermarkets",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "property_usecode": "1500 - Regional Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterRegional",
    "property_type": "Building"
  },
  {
    "property_usecode": "1600 - Community Shopping Centers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "property_usecode": "1700 - Office Buildings One Story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1800 - Office Buildings Multi-Story",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "property_usecode": "1900 - Office Buildings Medical",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Building"
  },
  {
    "property_usecode": "2000 - Airports, Terminals, Piers",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "property_usecode": "2100 - Restaurants, Cafeterias",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2200 - Drive In Restaurants",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "property_usecode": "2300 - Financial Institutions",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "property_usecode": "2500 - Repair Service Shops",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "2600 - Service Stations",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "property_usecode": "2700 - Auto Sales, Repair &amp; Related",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "property_usecode": "2800 - Parking Lots, Commercial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2801 - Parking Lots (Surface)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "2802 - Parking Garages",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "property_usecode": "3000 - Florists, Greenhouses",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "3200 - Enclosed Theatres/Auditoriums",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "property_usecode": "3300 - Night Clubs, Lounges, Bars",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3400 - Bowling, Skating, Pool Enclose",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3500 - Tourist Attraction, Exhibits",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "property_usecode": "3800 - Golf Courses, Driving Ranges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "3900 - Hotels, Motels",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "property_usecode": "4000 - Vacant Industrial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "4100 - Light Industrial",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "property_usecode": "4800 - Warehousing, Distribution",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "property_usecode": "4900 - Open Storage, Supply/Junkyards",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5001 - Improved Cropland",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5002 - Improved Timber",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5003 - Improved Grazing Land",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5006 - Improved Orchard Groves, Citrus, Etc",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5007 - Improved Poultry, Bees, Equestrian, Etc",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Poultry",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5008 - Improved Diaries, Feed Lots",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5009 - Improved Ornamentals and Misc Ag",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5100 - Cropland, Class I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5400 - Timberland, Index 90+",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5500 - Timberland, Index 80-90",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5600 - Timberland, Index 70-79",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "5900 - Timberland, Not Classed",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6000 - Grazing, Class I",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6600 - Orchard, Groves, Citrus",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6700 - Poultry, Bees, Fish",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6800 - Dairy, Feed Lots",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LivestockFacility",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "6900 - Ornamentals, Misc",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Ornamentals",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7000 - Vacant Institutional",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "7100 - Churches",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "property_usecode": "7200 - Private Schools/Colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "7300 - Privately Owned Hospitals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "7400 - Homes for the Aged",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "property_usecode": "7500 - Orphanages, Other Services",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "property_usecode": "7600 - Mortuaries, Cemeteries",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "property_usecode": "7700 - Clubs, Lodges, Union Halls",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "property_usecode": "7800 - Sanitary, Convalescent Homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SanitariumConvalescentHome",
    "property_type": "Building"
  },
  {
    "property_usecode": "7900 - Cultural Organization Facil",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "property_usecode": "8000 - Vacant Governmental",
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
    "property_usecode": "8200 - Forest, Parks, Recreation Area",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "8300 - Public County School",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8400 - Colleges",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "property_usecode": "8500 - Hospitals",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "property_usecode": "8900 - Municipal",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "property_usecode": "9100 - Utilities",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "Building"
  },
  {
    "property_usecode": "9200 - Mining, Petrolium/Gas",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "property_usecode": "9400 - Rights-of-Way",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9500 - Rivers, Lakes, Submerged Lands",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9600 - Sewage Disposal, Solid Waste",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "SewageDisposal",
    "property_type": "Building"
  },
  {
    "property_usecode": "9700 - Outdoor Recreational",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9800 - Centrally Assessed/Railroads",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Railroad",
    "property_type": "Building"
  },
  {
    "property_usecode": "9900 - Vacant Acreage, Not Agri",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "property_usecode": "9901 - Imp acre, Not Agri",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  }
];

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (isNaN(n)) return null;
  return n;
}

function parseIntStrict(s) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseUSDateToISO(s) {
  if (!s) return null;
  const m = String(s)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const pad = (x) => String(x).padStart(2, "0");
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

function isNumeric(value) {
    return /^-?\d+$/.test(value);
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

function extractProperty($, parcelId) {
  // const parcelId =
  //   $("input#ParcelId").val() ||
  //   $('label:contains("Parcel ID:")').next().text().trim();

  let legalBlocks = [];
  $("#legalModal .modal-body .row div").each((i, el) => {
    const t = $(el).text().trim();
    if (t) legalBlocks.push(t);
  });
  if (legalBlocks.length === 0) {
    const legalLabel = $('label:contains("Legal Desc:")');
    legalLabel
      .parent()
      .parent()
      .find("div")
      .each((i, el) => {
        const t = $(el).text().trim();
        if (t && !t.includes("View All Legal")) legalBlocks.push(t);
      });
  }
  const property_legal_description_text = legalBlocks.join(" | ") || null;

  let propertyUse = null;
  $("label").each((i, el) => {
    const t = $(el).text().trim();
    if (t.startsWith("Property Use")) {
      const val = $(el).parent().find("div").first().text().trim();
      if (val) propertyUse = val;
    }
  });
  const propertyMapping = mapPropertyTypeFromUseCode(propertyUse);
  if (!propertyMapping) {
    const msg = {
      type: "error",
      message: `Unknown enum value ${propertyUse}.`,
      path: "property.property_type",
    };
    throw new Error(JSON.stringify(msg));
  }

  let subdivision = null;
  $("label").each((i, el) => {
    const t = $(el).text().trim();
    if (t.startsWith("Subdivision Name")) {
      const val = $(el).parent().find("div").first().text().trim();
      if (val) subdivision = val;
    }
  });

  let builtYears = [];
  $("table.table.table-striped.table-hover.details tbody tr").each((i, el) => {
    const tds = $(el).find("td, th");
    if (tds.length >= 6) {
      const yrTxt = $(tds[3]).text().trim();
      const y = parseIntStrict(yrTxt);
      if (y) builtYears.push(y);
    }
  });
  const property_structure_built_year = builtYears.length
    ? Math.min(...builtYears)
    : null;

  return {
    parcel_identifier: parcelId ? String(parcelId) : null,
    property_legal_description_text,
    property_structure_built_year,
    property_type: propertyMapping.property_type,
    ownership_estate_type: propertyMapping.ownership_estate_type,
    build_status: propertyMapping.build_status,
    structure_form: propertyMapping.structure_form,
    property_usage_type: propertyMapping.property_usage_type,
    subdivision: subdivision || null,
    zoning: null,
    historic_designation: false,
  };
}

function parseLeonSummary($) {
  const summaryCard = $('#summaryCard');
  if (!summaryCard.length) {
    return {};
  }

  const parcelId = $('#ParcelId').val() || extractFieldValue($, summaryCard, 'Parcel ID');
  const location = extractFieldLines($, summaryCard, 'Location')[0] || null;
  const subdivisionName = extractFieldLines($, summaryCard, 'Subdivision Name')[0] || null;
  const propertyUse = extractFieldLines($, summaryCard, 'Property Use')[0] || null;
  const taxDistrict = extractFieldLines($, summaryCard, 'Tax District')[0] || null;
  const mailingAddress = extractFieldLines($, summaryCard, 'Mailing Address');
  const legalDescription = extractFieldLines($, summaryCard, 'Legal Desc');

  return {
    parcelId,
    location,
    allAddresses: extractModalList($, '#addressModal'),
    subdivisionName,
    owners: extractOwners($, summaryCard),
    propertyUse,
    taxDistrict,
    mailingAddress,
    legalDescription,
  };
}

function extractFieldValue($, $root, target) {
  return extractFieldLines($, $root, target)[0] || null;
}

function extractFieldLines($, $root, target) {
  const container = findLabelContainer($, $root, target);
  if (!container) {
    return [];
  }

  const lines = [];
  container
    .children('div')
    .each((_, div) => {
      const $div = $(div);
      if ($div.hasClass('modal')) {
        return false;
      }
      const text = cleanNodeText($, $div);
      if (text) {
        lines.push(text);
      }
      return undefined;
    });

  if (!lines.length) {
    const fallback = cleanNodeText(
      $,
      container
        .clone()
        .find('label, a, .modal, button')
        .remove()
        .end(),
    );
    if (fallback) {
      lines.push(fallback);
    }
  }

  return lines;
}

function findLabelContainer($, $root, target) {
  const normalizedTarget = normalizeLabel(target);
  const label = $root
    .find('label')
    .filter((i, el) => normalizeLabel($(el).text()).startsWith(normalizedTarget))
    .first();

  if (!label.length) {
    return null;
  }

  const container = label.closest('.mb-1');
  return container.length ? container : label.parent();
}

function normalizeLabel(text) {
  return text.replace(/[:\s]+/g, ' ').trim().toLowerCase();
}

function cleanNodeText($, $node) {
  if (!$node || !$node.length) {
    return '';
  }
  return $node
    .clone()
    .find('a, .modal, button, script, style')
    .remove()
    .end()
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOwners($, $root) {
  const container = findLabelContainer($, $root, 'Owner');
  if (!container) {
    return [];
  }

  const valueBlock = container.children('div').first().clone();
  valueBlock.find('a, .modal, button').remove();
  const html = valueBlock.html() || '';

  return html
    .split(/<br\s*\/?>/i)
    .map((chunk) =>
      cheerio
        .load(`<span>${chunk}</span>`)('span')
        .text()
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function extractModalList($, modalSelector) {
  const modal = $(modalSelector);
  if (!modal.length) {
    return [];
  }
  return modal
    .find('.modal-body .col-md-3')
    .map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);
}

function extractAddressText(leonSummary) {
  if (leonSummary && leonSummary.location) {
    return leonSummary.location;
  }
  return null;
}


function extractOwnerMailingAddress(leonSummary) {
  if (leonSummary && leonSummary.mailingAddress) {
    return leonSummary.mailingAddress.join(", ");
  }
  return null;
}

function attemptWriteAddress(unnorm, siteAddress, mailingAddress) {
  let hasOwnerMailingAddress = false;
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  if (mailingAddress) {
    const mailingAddressObj = {
      unnormalized_address: mailingAddress,
    };
    writeJSON(path.join("data", "mailing_address.json"), mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const addressObj = {
      county_name,
      // latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
      // longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
      // township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
      // range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
      // section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
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

function mapDeedCode(code) {
  if (!code) return {};
  const u = code.trim().toUpperCase();
  if (u === "CT") return "Contract for Deed";
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "TAX DEED") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u == "QUIT CLAIM") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return "Miscellaneous";
}

function extractSalesAndDeeds($, outDir) {
  const sales = [];
  const deeds = [];
  const files = [];

  const salesTable = $('h5:contains("Sales Information")')
    .closest(".card")
    .find("table");
  salesTable.find("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 5) {
      const dateTxt = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const bookPage = $(tds[2]).text().trim();
      const bookPageLink = $(tds[2]).find("a");
      const instrumentTxt = $(tds[3]).text().trim();
      let book = null;
      let page = null;
      if (bookPage) {
        const bookPageParts = bookPage.split('/');
        if (bookPageParts.length == 2) {
          if (bookPageParts[0].trim() && isNumeric(bookPageParts[0].trim()) && bookPageParts[1].trim() && isNumeric(bookPageParts[1].trim())) {
            book = bookPageParts[0].trim();
            page = bookPageParts[1].trim();
          }
        }
      }

      const ownership_transfer_date = parseUSDateToISO(dateTxt);
      const purchase_price_amount = parseCurrencyToNumber(priceTxt);

      const saleObj = { ownership_transfer_date, purchase_price_amount };
      sales.push(saleObj);

      let deed_type = null;
      const instUp = instrumentTxt.toUpperCase();
      deed_type = mapDeedCode(instUp);
      const deedObj = {};
      if (deed_type) deedObj.deed_type = deed_type;
      if (book && page) {
        deedObj.book = book;
        deedObj.page = page;
      }
      deeds.push(deedObj);

      let original_url = null;
      if (bookPageLink && bookPageLink.attr("href")) {
        const href = bookPageLink.attr("href");
        original_url = href.startsWith("http") ? href : null;
      }
      const name =
        bookPageLink && bookPageLink.text()
          ? `Book/Page ${bookPageLink.text().trim()}`
          : null;
      files.push({
        document_type: null,
        file_format: null,
        ipfs_url: null,
        name: name || null,
        original_url: original_url || null,
      });
    }
  });
  const rels = { deed_file: [], sales_deed: [] };
  sales.forEach((s, idx) => {
    const sName = path.join(outDir, `sales_${idx + 1}.json`);
    writeJSON(sName, s);
    const dName = path.join(outDir, `deed_${idx + 1}.json`);
    writeJSON(dName, deeds[idx]);
    const fName = path.join(outDir, `file_${idx + 1}.json`);
    writeJSON(fName, files[idx]);
    rels.sales_deed.push({
      from: { "/": `./sales_${idx + 1}.json` },
      to: { "/": `./deed_${idx + 1}.json` },
    });
    rels.deed_file.push({
      from: { "/": `./deed_${idx + 1}.json` },
      to: { "/": `./file_${idx + 1}.json` },
    });
  });

  rels.sales_deed.forEach((r, idx) =>
    writeJSON(path.join(outDir, `relationship_sales_deed_${idx + 1}.json`), r),
  );
  rels.deed_file.forEach((r, idx) =>
    writeJSON(path.join(outDir, `relationship_deed_file_${idx + 1}.json`), r),
  );

  return sales.length;
}

function extractTax($, outDir) {
  const histRows = [];
  const cvhCard = $('h5:contains("Certified Value History")').closest(".card");
  cvhCard.find("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const year = parseIntStrict($(tds[0]).text());
      const land = parseCurrencyToNumber($(tds[1]).text());
      const building = parseCurrencyToNumber($(tds[2]).text());
      const market = parseCurrencyToNumber($(tds[3]).text());
      if (year && land != null && building != null && market != null) {
        histRows.push({ year, land, building, market });
      }
    }
  });
  if (!histRows.length) return;

  let assessed2025 = null,
    taxable2025 = null;
  const ctv = $('h5:contains("2025 Certified Taxable Values")').closest(
    ".card",
  );
  const row = ctv.find("tbody tr").first();
  if (row && row.length) {
    const tds = row.find("td");
    if (tds.length >= 6) {
      assessed2025 = parseCurrencyToNumber($(tds[3]).text());
      taxable2025 = parseCurrencyToNumber($(tds[5]).text());
    }
  }

  histRows.sort((a, b) => b.year - a.year);
  let taxIdx = 1;
  histRows.forEach((r) => {
    let assessed = null,
      taxable = null;
    if (r.year === 2025 && assessed2025 != null && taxable2025 != null) {
      assessed = assessed2025;
      taxable = taxable2025;
    } else {
      return; // assessed and taxable are mandatory fields
    }
    const tax = {
      tax_year: r.year,
      property_assessed_value_amount: assessed,
      property_market_value_amount: r.market,
      property_building_amount: r.building,
      property_land_amount: r.land,
      property_taxable_value_amount: taxable,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(outDir, `tax_${r.year}.json`), tax);
  });
}

function extractOwners(ownerData, outDir, parcelId, salesCount, hasOwnerMailingAddress) {
  const key = `property_${parcelId}`;
  const result = { owners: [] };
  if (!ownerData[key] || !ownerData[key].owners_by_date) return result;
  const obyd = ownerData[key].owners_by_date;
  const current = obyd.current || [];
  // const historical = obyd.unknown_date_1 || [];
  // const invalids = Array.isArray(ownerData.invalid_owners)
  //   ? ownerData.invalid_owners
  //   : [];

  const ownersAll = [];
  current.forEach((o) => ownersAll.push(o));
  // historical.forEach((o) => ownersAll.push(o));
  // invalids.forEach((inv) => ownersAll.push({ type: "company", name: inv.raw }));

  const seenKey = new Set();
  const finalOwners = [];
  ownersAll.forEach((o) => {
    let k;
    if (o.type === "company") k = `C|${(o.name || "").trim()}`;
    else
      k = `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`;
    if (!seenKey.has(k)) {
      seenKey.add(k);
      finalOwners.push(o);
    }
  });

  let cIdx = 1,
    pIdx = 1;
  const fileMap = new Map();
  finalOwners.forEach((o) => {
    if (o.type === "company") {
      const fname = `company_${cIdx++}.json`;
      writeJSON(path.join(outDir, fname), { name: o.name || null });
      fileMap.set(`C|${(o.name || "").trim()}`, fname);
    } else {
      const obj = {
        birth_date: null,
        first_name: o.first_name
          ? o.first_name.charAt(0).toUpperCase() +
            o.first_name.slice(1).toLowerCase()
          : "",
        last_name: o.last_name
          ? o.last_name.charAt(0).toUpperCase() +
            o.last_name.slice(1).toLowerCase()
          : "",
        middle_name: o.middle_name ? o.middle_name.toUpperCase() : null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      const fname = `person_${pIdx++}.json`;
      writeJSON(path.join(outDir, fname), obj);
      fileMap.set(
        `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
        fname,
      );
    }
  });

  const currentFiles = current
    .map((o) =>
      o.type === "company"
        ? fileMap.get(`C|${(o.name || "").trim()}`)
        : fileMap.get(
            `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
          ),
    )
    .filter(Boolean);
  // const historicalFiles = historical
  //   .map((o) =>
  //     o.type === "company"
  //       ? fileMap.get(`C|${(o.name || "").trim()}`)
  //       : fileMap.get(
  //           `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
  //         ),
  //   )
  //   .filter(Boolean);
  // const invalidFiles = invalids
  //   .map((inv) => fileMap.get(`C|${(inv.raw || "").trim()}`))
  //   .filter(Boolean);

  let relIdxCompany = 1;
  let relIdxPerson = 1;
  function writeRel(toFile, saleIdx) {
    if (!toFile) return;
    if (toFile.startsWith("company_")) {
      writeJSON(
        path.join(outDir, `relationship_sales_company_${relIdxCompany++}.json`),
        {
          to: { "/": `./${toFile}` },
          from: { "/": `./sales_${saleIdx}.json` },
        },
      );
    } else if (toFile.startsWith("person_")) {
      writeJSON(
        path.join(outDir, `relationship_sales_person_${relIdxPerson++}.json`),
        {
          to: { "/": `./${toFile}` },
          from: { "/": `./sales_${saleIdx}.json` },
        },
      );
    }
  }
  function writeMailingAddressRel(toFile) {
    if (!toFile) return;
    if (toFile.startsWith("company_")) {
      writeJSON(
        path.join(outDir, `relationship_company_${relIdxCompany++}_has_mailing_address.json`),
        {
          from: { "/": `./${toFile}` },
          to: { "/": `./mailing_address.json` },
        },
      );
    } else if (toFile.startsWith("person_")) {
      writeJSON(
        path.join(outDir, `relationship_person_${relIdxPerson++}_has_mailing_address.json`),
        {
          from: { "/": `./${toFile}` },
          to: { "/": `./mailing_address.json` },
        },
      );
    }
  }

  if (salesCount > 0) {
    currentFiles.forEach((f) => writeRel(f, 1));
  }
  relIdxCompany = 1;
  relIdxPerson = 1;
  if (hasOwnerMailingAddress) {
    currentFiles.forEach((f) => writeMailingAddressRel(f, 1));
  }
  // invalidFiles.forEach((f) => writeRel(f, 1));
  // for (let s = 2; s <= salesCount; s++) {
  //   const group = [...invalidFiles];
  //   if (group.length === 0) {
  //     currentFiles.forEach((f) => writeRel(f, s));
  //   } else {
  //     group.forEach((f) => writeRel(f, s));
  //   }
  // }

  return result;
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
    let geometry = {
      "latitude": geom.latitude,
      "longitude": geom.longitude,
    }
    if (geom && geom.polygon) {
      for (const coordinate of geom.polygon.coordinates[0]) {
        polygon.push({"longitude": coordinate[0], "latitude": coordinate[1]})
      }
      geometry.polygon = polygon;
    }
    writeJSON(path.join("data", `geometry_${geomIndex}.json`), geometry);
    writeJSON(path.join("data", `relationship_parcel_to_geometry_${geomIndex}.json`), {
        from: { "/": `./parcel.json` },
        to: { "/": `./geometry_${geomIndex}.json` },
    });
    geomIndex++;
  }
}

function extractLot($, outDir) {
  let acreage = null;
  $("label").each((i, el) => {
    const $el = $(el);
    const t = $el.text().trim();
    if (t.startsWith("Acreage")) {
      const v = $el.parent().children("div").first().text().trim();
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
      if (!isNaN(n)) acreage = n;
    }
  });
  if (acreage == null || Math.round(acreage * 43560) < 1 ) return;

  const lot = {
    lot_type:
      acreage > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre",
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: Math.round(acreage * 43560),
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: acreage,
  };
  writeJSON(path.join(outDir, "lot.json"), lot);
}

function main() {
  const inputHtmlPath = path.join("input.html");
  const unAddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownerPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");

  const outDir = path.join("data");
  ensureDir(outDir);

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const leonSummary = parseLeonSummary($);
  const unAddr = readJSON(unAddrPath);
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  try {
    const seedCsvPath = path.join(".", "input.csv");
    const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
    createGeometryClass(createGeometryInstances(seedCsv));
  } catch (e) {
    const latitude = unAddr && unAddr.latitude ? unAddr.latitude : null;
    const longitude = unAddr && unAddr.longitude ? unAddr.longitude : null;
    if (latitude && longitude) {
      const coordinate = new Geometry({
        latitude: latitude,
        longitude: longitude
      });
      createGeometryClass([coordinate]);
    }
  }
  let propertyObj;
  try {
    propertyObj = extractProperty($, parcelId);
  } catch (e) {
    try {
      const parsed = JSON.parse(e.message);
      console.error(JSON.stringify(parsed));
      process.exit(1);
    } catch {
      throw e;
    }
  }
  writeJSON(path.join(outDir, "property.json"), propertyObj);

    // Address
  const addressText = extractAddressText(leonSummary);
  const mailingAddress = extractOwnerMailingAddress(leonSummary);
  const hasOwnerMailingAddress = attemptWriteAddress(unAddr, addressText, mailingAddress);
  // writeJSON(path.join(outDir, "address.json"), addressObj);

  const salesCount = extractSalesAndDeeds($, outDir);

  extractTax($, outDir);

  const ownerData = readJSON(ownerPath);
  extractOwners(ownerData, outDir, parcelId, salesCount, hasOwnerMailingAddress);

  const utilsData = readJSON(utilsPath);
  const layoutData = readJSON(layoutPath);
  const structureData = readJSON(structurePath);
  let layoutEntry = null;
  let utilEntry = null;
  let structureEntry = null;
  const key = `property_${parcelId}`;
  if (layoutData) {
    layoutEntry = layoutData[key];
  }
  if (utilsData) {
    utilEntry = utilsData[key];
  }
  if (structureData) {
    structureEntry = structureData[key];
  }
  // extractUtility(utilsData, outDir, parcelId);
  // extractLayout(layoutData, outDir, parcelId);
  // extractStructure(structureData, outDir, parcelId);
  if (layoutEntry && layoutEntry["layouts"]) {
    let idx = 1;
    let layoutBuildingMap = {};
    for (const l of layoutEntry["layouts"]) {
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
          });
        }
      }
      if (utilEntry && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in utilEntry) {
          writeJSON(path.join("data", `utility_${idx}.json`), utilEntry[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_utility_${idx}.json`), {
                    to: { "/": `./utility_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      if (structureEntry && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in structureEntry) {
          writeJSON(path.join("data", `structure_${idx}.json`), structureEntry[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_structure_${idx}.json`), {
                    to: { "/": `./structure_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      idx++;
    }
  }
  extractLot($, outDir);
}

if (require.main === module) {
  main();
}
