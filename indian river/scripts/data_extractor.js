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

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR =
  "#ctlBodyPane_ctl12_ctl01_grdSales tbody tr";
const VALUATION_TABLE_SELECTOR =
  "#ctlBodyPane_ctl06_ctl01_grdValuation_grdYearData";
const PERMITS_TABLE_SELECTOR =
  "#ctlBodyPane_ctl14_ctl01_grdPermits tbody tr";

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

function parseCurrencyToNumber(txt) {
  if (txt == null) return 0;
  const s = String(txt).trim();
  if (s === "") return 0;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return 0;
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
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th strong"));
    if ((th || "").toLowerCase().includes("legal description")) {
      desc = textOf($(tr).find("td span"));
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th strong"));
    if ((th || "").toLowerCase().includes("property use code")) {
      code = textOf($(tr).find("td span"));
    }
  });
  return code || null;
}

const PROPERTY_USE_CODE_MAPPINGS = {
  "0000": {
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "0100": {
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0200": {
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    structure_form: "ManufacturedHomeOnLand",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0300": {
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0400": {
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0401": {
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0403": {
    property_type: "Unit",
    property_usage_type: "Hotel",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0404": {
    property_type: "Unit",
    property_usage_type: "Recreational",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Timeshare",
    build_status: "Improved",
  },
  "0405": {
    property_type: "Unit",
    property_usage_type: "Recreational",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Timeshare",
    build_status: "UnderConstruction",
  },
  "0411": {
    property_type: "Unit",
    property_usage_type: "ResidentialCommonElementsAreas",
    structure_form: null,
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0412": {
    property_type: "Unit",
    property_usage_type: "ResidentialCommonElementsAreas",
    structure_form: null,
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0416": {
    property_type: "Unit",
    property_usage_type: "Warehouse",
    structure_form: null,
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0417": {
    property_type: "Unit",
    property_usage_type: "OfficeBuilding",
    structure_form: null,
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0419": {
    property_type: "Unit",
    property_usage_type: "MedicalOffice",
    structure_form: null,
    ownership_estate_type: "Condominium",
    build_status: "Improved",
  },
  "0500": {
    property_type: "Unit",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    ownership_estate_type: "Cooperative",
    build_status: "Improved",
  },
  "0700": {
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0800": {
    property_type: "Building",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "0900": {
    property_type: "Building",
    property_usage_type: "Unknown",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1000": {
    property_type: "LandParcel",
    property_usage_type: "Commercial",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "1100": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1200": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1300": {
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1400": {
    property_type: "Building",
    property_usage_type: "Supermarket",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1500": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1600": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1700": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1800": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "1900": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2000": {
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2100": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2200": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2300": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2400": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2500": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2600": {
    property_type: "Building",
    property_usage_type: "ServiceStation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2700": {
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2800": {
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "2900": {
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3000": {
    property_type: "Building",
    property_usage_type: "NurseryGreenhouse",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3200": {
    property_type: "Building",
    property_usage_type: "Theater",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3300": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3400": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3500": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3800": {
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "3900": {
    property_type: "Building",
    property_usage_type: "Hotel",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4000": {
    property_type: "LandParcel",
    property_usage_type: "Industrial",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "4100": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4200": {
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4300": {
    property_type: "Building",
    property_usage_type: "LumberYard",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4400": {
    property_type: "Building",
    property_usage_type: "PackingPlant",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4600": {
    property_type: "Building",
    property_usage_type: "Cannery",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4700": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4800": {
    property_type: "Building",
    property_usage_type: "Warehouse",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "4900": {
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "5000": {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "5100": {
    property_type: "LandParcel",
    property_usage_type: "DrylandCropland",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "5300": {
    property_type: "LandParcel",
    property_usage_type: "CroplandClass2",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6000": {
    property_type: "LandParcel",
    property_usage_type: "ImprovedPasture",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6100": {
    property_type: "LandParcel",
    property_usage_type: "Rangeland",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6200": {
    property_type: "LandParcel",
    property_usage_type: "NativePasture",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "6300": {
    property_type: "LandParcel",
    property_usage_type: "Conservation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "6600": {
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6700": {
    property_type: "LandParcel",
    property_usage_type: "Poultry",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6800": {
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "6900": {
    property_type: "LandParcel",
    property_usage_type: "Ornamentals",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7000": {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7100": {
    property_type: "Building",
    property_usage_type: "Church",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7200": {
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7300": {
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7400": {
    property_type: "Building",
    property_usage_type: "HomesForAged",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7500": {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7600": {
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7700": {
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7800": {
    property_type: "Building",
    property_usage_type: "SanitariumConvalescentHome",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "7900": {
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8200": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8201": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8202": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8300": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8400": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8500": {
    property_type: "Building",
    property_usage_type: "PublicHospital",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8600": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8700": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8701": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8702": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8800": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8900": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8901": {
    property_type: "LandParcel",
    property_usage_type: "MortuaryCemetery",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "8902": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "9000": {
    property_type: "LandParcel",
    property_usage_type: "GovernmentProperty",
    structure_form: null,
    ownership_estate_type: "Leasehold",
    build_status: "Improved",
  },
  "9100": {
    property_type: "Building",
    property_usage_type: "Utility",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "9101": {
    property_type: "LandParcel",
    property_usage_type: "SewageDisposal",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "9300": {
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    structure_form: null,
    ownership_estate_type: "SubsurfaceRights",
    build_status: "VacantLand",
  },
  "9400": {
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    structure_form: null,
    ownership_estate_type: "RightOfWay",
    build_status: "VacantLand",
  },
  "9500": {
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "9600": {
    property_type: "LandParcel",
    property_usage_type: "Conservation",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
  "9700": {
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "9800": {
    property_type: "Building",
    property_usage_type: "Utility",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "Improved",
  },
  "9900": {
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    structure_form: null,
    ownership_estate_type: "FeeSimple",
    build_status: "VacantLand",
  },
};

function normalizeUseCode(code) {
  if (!code) return null;
  const match = /(\d{4})/.exec(code);
  if (match) return match[1];
  return code.trim();
}

function mapPropertyAttributesFromUseCode(rawCode) {
  const code = normalizeUseCode(rawCode);
  if (!code) return null;
  const mapping = PROPERTY_USE_CODE_MAPPINGS[code];
  if (!mapping) {
    throw {
      type: "error",
      message: `Unhandled property use code ${rawCode}.`,
      path: "property.property_type",
    };
  }
  return { ...mapping };
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
        const combined_map = { ...buildings[buildingCount], ...map };
        buildings[buildingCount++] = combined_map;
      }
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
    const tds = $(tr).find("td");
    if (tds.length < 9) return; // skip header or invalid rows
    const saleDate = textOf($(tds[0]));
    const salePrice = textOf($(tds[1]));
    const instrument = textOf($(tds[2]));
    const book = textOf($(tds[4]));
    const page = textOf($(tds[5]));
    const bookPage = book && page ? `${book} ${page}` : null;
    let link = $(tds[8]).find("input").attr("onclick") || null;
    if (link) {
      const m = link.match(/window\.open\('([^']+)'/);
      if (m) link = m[1];
    }
    const grantor = textOf($(tds[7]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage,
      link,
      grantor,
      grantee: null, // no grantee column
    });
  });
  return out;
}

function mapPermitTypeAttributes(typeText) {
  const type = (typeText || "").toLowerCase();
  const normalized = type.replace(/\s+/g, " ").trim();
  if (!normalized) return { improvement_type: null, improvement_action: null };
  const matchers = [
    {
      includes: ["addition"],
      improvement_type: "BuildingAddition",
      improvement_action: "Addition",
    },
    {
      includes: ["alter"],
      improvement_type: "GeneralBuilding",
      improvement_action: "Alteration",
    },
    {
      includes: ["pool", "spa"],
      improvement_type: "PoolSpaInstallation",
      improvement_action: "New",
    },
    {
      includes: ["apartment", "multifamily"],
      improvement_type: "ResidentialConstruction",
      improvement_action: "New",
    },
    {
      includes: ["residential"],
      improvement_type: "ResidentialConstruction",
      improvement_action: "New",
    },
    {
      includes: ["commercial"],
      improvement_type: "CommercialConstruction",
      improvement_action: "New",
    },
    {
      includes: ["clubhouse"],
      improvement_type: "CommercialConstruction",
      improvement_action: "New",
    },
    {
      includes: ["roof"],
      improvement_type: "Roofing",
      improvement_action: "Replacement",
    },
    {
      includes: ["demolition", "demo"],
      improvement_type: "Demolition",
      improvement_action: "Remove",
    },
    {
      includes: ["fence"],
      improvement_type: "Fencing",
      improvement_action: "New",
    },
    {
      includes: ["elect"],
      improvement_type: "Electrical",
      improvement_action: null,
    },
    {
      includes: ["hvac", "mechanical"],
      improvement_type: "MechanicalHVAC",
      improvement_action: null,
    },
    {
      includes: ["plumb"],
      improvement_type: "Plumbing",
      improvement_action: null,
    },
    {
      includes: ["irrig"],
      improvement_type: "LandscapeIrrigation",
      improvement_action: null,
    },
    {
      includes: ["solar"],
      improvement_type: "Solar",
      improvement_action: "New",
    },
    {
      includes: ["dock", "shore"],
      improvement_type: "DockAndShore",
      improvement_action: "New",
    },
  ];
  for (const rule of matchers) {
    if (rule.includes.some((frag) => normalized.includes(frag))) {
      return {
        improvement_type: rule.improvement_type,
        improvement_action: rule.improvement_action,
      };
    }
  }
  return { improvement_type: null, improvement_action: null };
}

function mapPermitStatus(activeText, completionDateISO) {
  const activeNormalized = (activeText || "").toLowerCase();
  if (activeNormalized === "yes") return "InProgress";
  if (completionDateISO) return "Completed";
  if (activeNormalized === "no") return "Permitted";
  return null;
}

function extractPermits($) {
  const permits = [];
  $(PERMITS_TABLE_SELECTOR).each((_, tr) => {
    const $tr = $(tr);
    const permitNumber = textOf($tr.find("th").first());
    if (!permitNumber) return;
    const tds = $tr.find("td");
    if (tds.length === 0) return;
    const typeText = textOf($(tds[0]));
    const primaryText = tds[1] ? textOf($(tds[1])) : null;
    const activeText = tds[2] ? textOf($(tds[2])) : null;
    const issueDateText = tds[3] ? textOf($(tds[3])) : null;
    const completionDateText = tds[4] ? textOf($(tds[4])) : null;
    const valueText = tds[5] ? textOf($(tds[5])) : null;
    const issueDateISO = parseDateToISO(issueDateText);
    const completionDateISO = parseDateToISO(completionDateText);
    const { improvement_type, improvement_action } =
      mapPermitTypeAttributes(typeText);
    const improvement_status = mapPermitStatus(activeText, completionDateISO);
    const fee =
      valueText && valueText.trim()
        ? parseCurrencyToNumber(valueText)
        : null;
    permits.push({
      permit_number: permitNumber,
      permit_type_text: typeText || null,
      improvement_type,
      improvement_action,
      improvement_status,
      permit_issue_date: issueDateISO,
      completion_date: completionDateISO,
      fee,
      is_primary_permit:
        (primaryText || "").toLowerCase() === "yes" ? true : null,
    });
  });
  return permits;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u === "TD") return "Tax Deed";
  if (u === "QC") return "Quitclaim Deed";
  if (u === "SW") return "Special Warranty Deed";
  return "Miscellaneous";
  // throw {
  //   type: "error",
  //   message: `Unknown enum value ${instr}.`,
  //   path: "deed.deed_type",
  // };
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  const headerThs = table.find("thead tr th").toArray().slice(1);
  headerThs.forEach((th, idx) => {
    const txt = $(th).text().trim();
    const y = parseInt(txt, 10);
    if (!isNaN(y)) years.push({ year: y, idx });
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
      building: get("Improvement Value"),
      land: get("Land Value"),
      market: get("Just (Market) Value"),
      assessed: get("Assessed Value"),
      taxable: get("TaxableValue"),
    };
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const mapping = mapPropertyAttributesFromUseCode(useCode);
  if (!mapping) {
    throw {
      type: "error",
      message: `Missing property use code value.`,
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
    property_type: mapping.property_type,
    property_usage_type: mapping.property_usage_type,
    structure_form: mapping.structure_form,
    ownership_estate_type: mapping.ownership_estate_type,
    build_status: mapping.build_status,
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

function clearExistingSalesHistoryFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^sales_history_\d+\.json$/.test(f) ||
        /^sales_\d+\.json$/.test(f) ||
        /^relationship_deed_file_\d+\.json$/.test(f) ||
        /^relationship_sales_deed_\d+\.json$/.test(f) ||
        /^relationship_sales_person_\d+\.json$/.test(f) ||
        /^relationship_sales_company_\d+\.json$/.test(f) ||
        /^relationship_sales_history_deed_\d+\.json$/.test(f) ||
        /^relationship_sales_history_\d+_person_\d+\.json$/.test(f) ||
        /^relationship_sales_history_\d+_company_\d+\.json$/.test(f) ||
        /^person_\d+\.json$/.test(f) ||
        /^company_\d+\.json$/.test(f) ||
        /^mailing_address_\d+\.json$/.test(f) ||
        /^relationship_person_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f) ||
        /^relationship_company_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeSalesDeedsFilesAndRelationships($, parcelId, propertySeed) {
  const sales = extractSales($);
  clearExistingSalesHistoryFiles();
  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleObj = {
      ownership_transfer_date: parseDateToISO(s.saleDate),
    };
    if (parcelId) saleObj.request_identifier = parcelId;
    if (propertySeed && propertySeed.source_http_request) {
      saleObj.source_http_request = propertySeed.source_http_request;
    }
    const salePriceText = (s.salePrice || "").trim();
    if (salePriceText) {
      const parsedPrice = parseCurrencyToNumber(s.salePrice);
      if (parsedPrice != null && !Number.isNaN(parsedPrice)) {
        saleObj.purchase_price_amount = parsedPrice;
      }
    }
    writeJSON(path.join("data", `sales_history_${idx}.json`), saleObj);

    const deedType = mapInstrumentToDeedType(s.instrument);
    const deed = { deed_type: deedType };
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    const file = {
      document_type: null,
      file_format: null,
      ipfs_url: null,
      name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", `file_${idx}.json`), file);

    const relDeedFile = {
      from: { "/": `./deed_${idx}.json` },
      to: { "/": `./file_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${idx}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      from: { "/": `./sales_history_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_sales_history_deed_${idx}.json`),
      relSalesDeed,
    );
  });
}

function clearExistingPropertyImprovementFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^property_improvement_\d+\.json$/.test(f) ||
        /^relationship_property_property_improvement_\d+\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writePropertyImprovements(parcelId, $) {
  clearExistingPropertyImprovementFiles();
  const permits = extractPermits($);
  if (!permits.length) return;
  permits.forEach((permit, idx) => {
    const improvement = {
      permit_number: permit.permit_number || null,
      improvement_type: permit.improvement_type,
      improvement_action: permit.improvement_action,
      improvement_status: permit.improvement_status,
      permit_issue_date: permit.permit_issue_date || null,
      permit_close_date: null,
      completion_date: permit.completion_date || null,
      final_inspection_date: null,
      application_received_date: null,
      contractor_type: null,
      fee: permit.fee,
      is_disaster_recovery: null,
      is_owner_builder: null,
      permit_required: true,
      private_provider_inspections: null,
      private_provider_plan_review: null,
      request_identifier: parcelId || null,
    };
    writeJSON(
      path.join("data", `property_improvement_${idx + 1}.json`),
      improvement,
    );
    const relationship = {
      to: { "/": "./property.json" },
      from: { "/": `./property_improvement_${idx + 1}.json` },
    };
    writeJSON(
      path.join(
        "data",
        `relationship_property_property_improvement_${idx + 1}.json`,
      ),
      relationship,
    );
  });
}

function clearExistingMailingAddressFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^mailing_address_\d+\.json$/.test(f) ||
        /^relationship_person_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f) ||
        /^relationship_company_\d+_has_mailing_address(?:_\d+)?\.json$/.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

function writeMailingAddresses(parcelId, ownerMailingData, sourceHttpRequest) {
  clearExistingMailingAddressFiles();
  if (!ownerMailingData || !ownerMailingData.length) return;

  const normalizeAddress = (addr) =>
    (addr || "")
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ")
      .trim();

  // First pass: identify which addresses will have valid relationships
  const addressesToCreate = new Map(); // Map<normalized_address, Set<{type, index}>>

  ownerMailingData.forEach((info) => {
    const addresses = (info.addresses || [])
      .map((a) => normalizeAddress(a))
      .filter((addr) => addr && addr.length);

    if (!addresses.length) return;

    if (info.type === "person") {
      const personIdx = findPersonIndexByName(
        info.first_name,
        info.last_name,
        info.suffix_name,
      );
      if (!personIdx) return; // Skip if person not found

      addresses.forEach((addr) => {
        if (!addressesToCreate.has(addr)) {
          addressesToCreate.set(addr, new Set());
        }
        addressesToCreate.get(addr).add({ type: "person", index: personIdx });
      });
    } else if (info.type === "company") {
      const companyIdx = findCompanyIndexByName(info.name);
      if (!companyIdx) return; // Skip if company not found

      addresses.forEach((addr) => {
        if (!addressesToCreate.has(addr)) {
          addressesToCreate.set(addr, new Set());
        }
        addressesToCreate.get(addr).add({ type: "company", index: companyIdx });
      });
    }
  });

  if (addressesToCreate.size === 0) return;

  // Second pass: create mailing_address files only for addresses with valid relationships
  const uniqueAddressMap = new Map();
  let addressCounter = 0;

  addressesToCreate.forEach((owners, addr) => {
    addressCounter++;
    uniqueAddressMap.set(addr, {
      index: addressCounter,
      raw: addr,
    });
    const mailingAddress = {
      unnormalized_address: addr,
      latitude: null,
      longitude: null,
      source_http_request: sourceHttpRequest || null,
      request_identifier: parcelId || null,
    };
    writeJSON(
      path.join("data", `mailing_address_${addressCounter}.json`),
      mailingAddress,
    );
  });

  // Third pass: create relationships
  const personMailRelCount = new Map();
  const companyMailRelCount = new Map();

  addressesToCreate.forEach((owners, addr) => {
    const { index } = uniqueAddressMap.get(addr);

    owners.forEach((owner) => {
      if (owner.type === "person") {
        const personIdx = owner.index;
        const count = (personMailRelCount.get(personIdx) || 0) + 1;
        personMailRelCount.set(personIdx, count);
        const suffix = count > 1 ? `_${count}` : "";
        const relName = `relationship_person_${personIdx}_has_mailing_address${suffix}.json`;
        writeJSON(path.join("data", relName), {
          to: { "/": `./mailing_address_${index}.json` },
          from: { "/": `./person_${personIdx}.json` },
        });
      } else if (owner.type === "company") {
        const companyIdx = owner.index;
        const count = (companyMailRelCount.get(companyIdx) || 0) + 1;
        companyMailRelCount.set(companyIdx, count);
        const suffix = count > 1 ? `_${count}` : "";
        const relName = `relationship_company_${companyIdx}_has_mailing_address${suffix}.json`;
        writeJSON(path.join("data", relName), {
          to: { "/": `./mailing_address_${index}.json` },
          from: { "/": `./company_${companyIdx}.json` },
        });
      }
    });
  });
}

function clearExistingUtilityFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^utility_\d+\.json$/.test(f) ||
        /^utility\.json$/.test(f) ||
        /^relationship_layout_\d+_has_utility(_\d+)?\.json$/.test(f) ||
        /^relationship_property_has_utility_\d+\.json$/.test(f) ||
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
  let utilities = [];
  if (Array.isArray(record)) {
    utilities = record;
  } else if (record && Array.isArray(record.utilities)) {
    utilities = record.utilities;
  } else if (record) {
    utilities = [record];
  }
  if (!utilities.length) return [];
  const info = [];
  utilities.forEach((u, idx) => {
    const index = idx + 1;
    const out = {
      cooling_system_type: u.cooling_system_type ?? null,
      heating_system_type: u.heating_system_type ?? null,
      public_utility_type: u.public_utility_type ?? null,
      sewer_type: u.sewer_type ?? null,
      water_source_type: u.water_source_type ?? null,
      plumbing_system_type: u.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        u.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: u.electrical_panel_capacity ?? null,
      electrical_wiring_type: u.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: u.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        u.electrical_wiring_type_other_description ?? null,
      solar_panel_present: u.solar_panel_present ?? false,
      solar_panel_type: u.solar_panel_type ?? null,
      solar_panel_type_other_description:
        u.solar_panel_type_other_description ?? null,
      smart_home_features: u.smart_home_features ?? null,
      smart_home_features_other_description:
        u.smart_home_features_other_description ?? null,
      hvac_unit_condition: u.hvac_unit_condition ?? null,
      solar_inverter_visible: u.solar_inverter_visible ?? false,
      hvac_unit_issues: u.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        u.electrical_panel_installation_date ?? null,
      electrical_rewire_date: u.electrical_rewire_date ?? null,
      hvac_capacity_kw: u.hvac_capacity_kw ?? null,
      hvac_capacity_tons: u.hvac_capacity_tons ?? null,
      hvac_equipment_component: u.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: u.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: u.hvac_equipment_model ?? null,
      hvac_installation_date: u.hvac_installation_date ?? null,
      hvac_seer_rating: u.hvac_seer_rating ?? null,
      hvac_system_configuration: u.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
        u.plumbing_system_installation_date ?? null,
      sewer_connection_date: u.sewer_connection_date ?? null,
      solar_installation_date: u.solar_installation_date ?? null,
      solar_inverter_installation_date:
        u.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
      solar_inverter_model: u.solar_inverter_model ?? null,
      water_connection_date: u.water_connection_date ?? null,
      water_heater_installation_date: u.water_heater_installation_date ?? null,
      water_heater_manufacturer: u.water_heater_manufacturer ?? null,
      water_heater_model: u.water_heater_model ?? null,
      well_installation_date: u.well_installation_date ?? null,
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", `utility_${index}.json`), out);
    info.push({
      index,
      fileName: `utility_${index}.json`,
      building_number:
        typeof u.building_number === "number" ? u.building_number : null,
    });
  });
  return info;
}

function clearExistingStructureFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^structure_\d+\.json$/.test(f) ||
        /^structure\.json$/.test(f) ||
        /^relationship_layout_\d+_has_structure_\d+\.json$/.test(f) ||
        /^relationship_property_has_structure_\d+\.json$/.test(f) ||
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
  let structures = [];
  if (Array.isArray(record)) {
    structures = record;
  } else if (record && Array.isArray(record.structures)) {
    structures = record.structures;
  } else if (record) {
    structures = [record];
  }
  if (!structures.length) return [];
  const info = [];
  structures.forEach((s, idx) => {
    const index = idx + 1;
    const out = { ...s };
    delete out.building_number;
    out.request_identifier = parcelId;
    writeJSON(path.join("data", `structure_${index}.json`), out);
    info.push({
      index,
      fileName: `structure_${index}.json`,
      building_number:
        typeof s.building_number === "number" ? s.building_number : null,
    });
  });
  return info;
}

function clearExistingLayoutFiles() {
  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^layout_\d+\.json$/.test(f) ||
        /^relationship_layout_\d+_has_layout_\d+\.json$/.test(f) ||
        /^relationship_layout_\d+_has_structure_\d+\.json$/.test(f) ||
        /^relationship_layout_\d+_has_utility(?:_\d+)?\.json$/.test(f) ||
        /^relationship_layout_has_layout_\d*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}
}

let people = [];
let companies = [];

function isRomanNumeral(val) {
  if (!val) return false;
  const trimmed = val.trim().toUpperCase();
  // Only treat common generational suffixes as Roman numerals, not all combinations
  const validGenerationalSuffixes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return validGenerationalSuffixes.includes(trimmed);
}

function validateSuffixName(suffix) {
  if (!suffix) return null;
  const trimmed = suffix.trim();
  if (!trimmed) return null;
  const validSuffixes = [
    "Jr.",
    "Sr.",
    "II",
    "III",
    "IV",
    "PhD",
    "MD",
    "Esq.",
    "JD",
    "LLM",
    "MBA",
    "RN",
    "DDS",
    "DVM",
    "CFA",
    "CPA",
    "PE",
    "PMP",
    "Emeritus",
    "Ret.",
  ];

  // Check exact match
  if (validSuffixes.includes(trimmed)) return trimmed;

  // Check case-insensitive match
  const upperTrimmed = trimmed.toUpperCase();
  for (const valid of validSuffixes) {
    if (valid.toUpperCase() === upperTrimmed) return valid;
  }

  // Check for common variations
  const normalized = trimmed.replace(/\./g, "").toUpperCase();
  const suffixMap = {
    "JR": "Jr.",
    "SR": "Sr.",
    "II": "II",
    "III": "III",
    "IV": "IV",
    "PHD": "PhD",
    "MD": "MD",
    "ESQ": "Esq.",
    "JD": "JD",
    "LLM": "LLM",
    "MBA": "MBA",
    "RN": "RN",
    "DDS": "DDS",
    "DVM": "DVM",
    "CFA": "CFA",
    "CPA": "CPA",
    "PE": "PE",
    "PMP": "PMP",
    "EMERITUS": "Emeritus",
    "RET": "Ret.",
  };

  if (suffixMap[normalized]) return suffixMap[normalized];

  // Invalid suffix - return null
  return null;
}

function normalizePersonNameForCompare(val) {
  return (val || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function normalizeSuffixForCompare(val) {
  const validated = validateSuffixName(val);
  if (!validated) return "";
  if (/^[IVXLCDM]+$/i.test(validated)) return validated.toUpperCase();
  return validated.toUpperCase();
}

function findPersonIndexByName(first, last, suffix) {
  const tf = normalizePersonNameForCompare(first);
  const tl = normalizePersonNameForCompare(last);
  const ts = normalizeSuffixForCompare(suffix);
  for (let i = 0; i < people.length; i++) {
    const pf = normalizePersonNameForCompare(people[i].first_name);
    const pl = normalizePersonNameForCompare(people[i].last_name);
    const ps = normalizeSuffixForCompare(people[i].suffix_name);
    if (pf === tf && pl === tl && ps === ts) return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  const tn = (name || "").trim();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  const trimmed = s.trim();
  if (isRomanNumeral(trimmed)) return trimmed.toUpperCase();
  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((part) =>
      part.replace(/(^|[-'])[a-z]/g, (m) => m.toUpperCase()),
    )
    .join(" ");
}

function cleanNameForValidation(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Remove invalid characters: keep only letters, spaces, hyphens, apostrophes, commas, periods
  // Split on semicolon and take only the first part (handles cases like "M;swearingen")
  let cleaned = trimmed.split(';')[0].trim();

  // Remove any other invalid characters
  cleaned = cleaned.replace(/[^a-zA-Z\s\-',.]/g, '');

  if (!cleaned) return null;
  return cleaned;
}

function validateNamePattern(name) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  // Pattern: Must start with uppercase letter, followed by letters, spaces, hyphens, apostrophes, commas, periods
  const pattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  if (pattern.test(trimmed)) return trimmed;
  return null;
}

function writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;

  // Helper function to check if a key is a valid ISO date
  const isISODateKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);

  // Filter ownersByDate to only include valid ISO date entries (exclude unknown_prior_sale_* entries)
  const validDateEntries = Object.entries(ownersByDate).filter(([k]) => isISODateKey(k));

  // Step 1: Determine which persons will be referenced
  // Collect all sale dates that have sales_history records
  const saleDates = new Set();
  sales.forEach((s) => {
    const saleDateISO = parseDateToISO(s.saleDate);
    if (saleDateISO) saleDates.add(saleDateISO);
  });

  // Collect persons that will be referenced (on sale dates or current owners with mailing addresses)
  const referencedPersonKeys = new Set();
  const mailingAddresses = record.owner_mailing_addresses || [];
  const hasMailingAddresses = mailingAddresses && mailingAddresses.length > 0;

  // Add persons from sale dates
  validDateEntries.forEach(([dateKey, arr]) => {
    if (saleDates.has(dateKey)) {
      (arr || []).forEach((o) => {
        if (o.type === "person") {
          const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
          referencedPersonKeys.add(k);
        }
      });
    }
  });

  // Add current owners if there are mailing addresses
  if (hasMailingAddresses && mailingAddresses.some(info => info.type === "person")) {
    mailingAddresses.forEach((info) => {
      if (info.type === "person") {
        const k = `${(info.first_name || "").trim().toUpperCase()}|${(info.last_name || "").trim().toUpperCase()}`;
        referencedPersonKeys.add(k);
      }
    });
  }

  // Step 2: Build unique person map (only for referenced persons)
  const personMap = new Map();
  validDateEntries.forEach(([, arr]) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (referencedPersonKeys.has(k)) {
          if (!personMap.has(k)) {
            personMap.set(k, {
              first_name: o.first_name,
              middle_name: o.middle_name,
              last_name: o.last_name,
              prefix_name: o.prefix_name,
              suffix_name: o.suffix_name,
            });
          } else {
            const existing = personMap.get(k);
            if (!existing.middle_name && o.middle_name)
              existing.middle_name = o.middle_name;
            if (!existing.prefix_name && o.prefix_name)
              existing.prefix_name = o.prefix_name;
            if (!existing.suffix_name && o.suffix_name)
              existing.suffix_name = o.suffix_name;
          }
        }
      }
    });
  });

  // Also add mailing address persons if they're not already in the map
  if (hasMailingAddresses) {
    mailingAddresses.forEach((info) => {
      if (info.type === "person") {
        const k = `${(info.first_name || "").trim().toUpperCase()}|${(info.last_name || "").trim().toUpperCase()}`;
        if (referencedPersonKeys.has(k) && !personMap.has(k)) {
          personMap.set(k, {
            first_name: info.first_name,
            middle_name: info.middle_name,
            last_name: info.last_name,
            prefix_name: info.prefix_name,
            suffix_name: info.suffix_name,
          });
        }
      }
    });
  }

  // Create person entities with validation
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? validateNamePattern(titleCaseName(cleanNameForValidation(p.first_name))) : null,
    middle_name: p.middle_name ? validateNamePattern(titleCaseName(cleanNameForValidation(p.middle_name))) : null,
    last_name: p.last_name ? validateNamePattern(titleCaseName(cleanNameForValidation(p.last_name))) : null,
    birth_date: null,
    prefix_name: p.prefix_name,
    suffix_name: validateSuffixName(p.suffix_name), // Validate suffix
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));

  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });

  // Create company entities (only from valid ISO date entries that will be referenced)
  const referencedCompanyNames = new Set();

  // Add companies from sale dates ONLY (companies that will have sales_history relationships)
  validDateEntries.forEach(([dateKey, arr]) => {
    if (saleDates.has(dateKey)) {
      (arr || []).forEach((o) => {
        if (o.type === "company" && (o.name || "").trim()) {
          referencedCompanyNames.add((o.name || "").trim());
        }
      });
    }
  });

  // Add companies from mailing addresses ONLY if they have valid addresses
  if (hasMailingAddresses) {
    mailingAddresses.forEach((info) => {
      if (info.type === "company" && (info.name || "").trim()) {
        // Check if this company has valid addresses before adding
        const addresses = (info.addresses || [])
          .map((a) => (a || "").split(/\r?\n/).map((part) => part.trim()).filter(Boolean).join(", ").trim())
          .filter((addr) => addr && addr.length);
        if (addresses.length > 0) {
          referencedCompanyNames.add((info.name || "").trim());
        }
      }
    });
  }

  companies = Array.from(referencedCompanyNames).map((n) => ({
    name: n,
    request_identifier: parcelId,
  }));

  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });

  // Create relationships between sales_history and persons/companies
  sales.forEach((s, idx) => {
    const saleIdx = idx + 1;
    const saleDateISO = parseDateToISO(s.saleDate);
    const ownersOnDate = (saleDateISO && ownersByDate[saleDateISO]) || [];

    const linked = new Set();

    // Link persons to sales_history
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name, o.suffix_name);
        if (pIdx && !linked.has(`person:${pIdx}`)) {
          linked.add(`person:${pIdx}`);
          writeJSON(
            path.join("data", `relationship_sales_history_${saleIdx}_person_${pIdx}.json`),
            {
              from: { "/": `./sales_history_${saleIdx}.json` },
              to: { "/": `./person_${pIdx}.json` },
            }
          );
        }
      });

    // Link companies to sales_history
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx && !linked.has(`company:${cIdx}`)) {
          linked.add(`company:${cIdx}`);
          writeJSON(
            path.join("data", `relationship_sales_history_${saleIdx}_company_${cIdx}.json`),
            {
              from: { "/": `./sales_history_${saleIdx}.json` },
              to: { "/": `./company_${cIdx}.json` },
            }
          );
        }
      });
  });

  // Write mailing addresses for current owners
  writeMailingAddresses(parcelId, mailingAddresses, propertySeed?.source_http_request);
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

function writeLayout(
  parcelId,
  propertyType,
  structuresInfo,
  utilitiesInfo,
) {
  clearExistingLayoutFiles();
  if (!parcelId) return;
  if (propertyType === "LandParcel") return;
  const layoutsData = readJSON(path.join("owners", "layout_data.json"));
  if (!layoutsData) return;
  const key = `property_${parcelId}`;
  const entry = layoutsData[key];
  if (!entry || !Array.isArray(entry.layouts) || !entry.layouts.length) return;

  const layoutOutputs = entry.layouts.map((lay, idx) => {
    const index = idx + 1;
    const childIndices = Array.isArray(lay.layout_has_layout)
      ? lay.layout_has_layout
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n))
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
      has_windows: lay.has_windows ?? null,
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
      is_exterior: lay.is_exterior ?? false,
      pool_condition: lay.pool_condition ?? null,
      pool_surface_type: lay.pool_surface_type ?? null,
      pool_water_quality: lay.pool_water_quality ?? null,
      total_area_sq_ft: lay.total_area_sq_ft ?? null,
      livable_area_sq_ft: lay.livable_area_sq_ft ?? null,
      area_under_air_sq_ft: lay.area_under_air_sq_ft ?? null,
      built_year: lay.built_year ?? null,
      request_identifier: parcelId,
    };
    return {
      index,
      building_number:
        typeof lay.building_number === "number" ? lay.building_number : null,
      space_type: lay.space_type ?? null,
      child_indices: childIndices,
      data,
    };
  });

  const layoutIndexMap = new Map(
    layoutOutputs.map((layout) => [layout.index, layout]),
  );
  const buildingLayouts = layoutOutputs.filter(
    (layout) =>
      (layout.space_type || "").toLowerCase() === "building" ||
      layout.space_type === "Building",
  );

  const assignStructures = () => {
    const layoutToStructures = new Map();
    const propertyStructures = [];
    if (!structuresInfo.length) return { layoutToStructures, propertyStructures };
    if (!buildingLayouts.length) {
      structuresInfo.forEach((s) => propertyStructures.push(s.index));
      return { layoutToStructures, propertyStructures };
    }
    if (structuresInfo.length === 1 && buildingLayouts.length > 1) {
      propertyStructures.push(structuresInfo[0].index);
      return { layoutToStructures, propertyStructures };
    }
    const unused = new Set(structuresInfo.map((s) => s.index));
    const structuresByBuilding = new Map();
    structuresInfo.forEach((s) => {
      if (typeof s.building_number === "number") {
        if (!structuresByBuilding.has(s.building_number)) {
          structuresByBuilding.set(s.building_number, []);
        }
        structuresByBuilding.get(s.building_number).push(s);
      }
    });
    buildingLayouts.forEach((layout) => {
      let match = null;
      if (
        typeof layout.building_number === "number" &&
        structuresByBuilding.has(layout.building_number)
      ) {
        match = structuresByBuilding
          .get(layout.building_number)
          .find((s) => unused.has(s.index));
      }
      if (!match) {
        const nextIdx = [...unused][0];
        if (nextIdx != null) {
          match = structuresInfo.find((s) => s.index === nextIdx);
        }
      }
      if (match) {
        unused.delete(match.index);
        if (!layoutToStructures.has(layout.index)) {
          layoutToStructures.set(layout.index, []);
        }
        layoutToStructures.get(layout.index).push(match.index);
      }
    });
    unused.forEach((idx) => propertyStructures.push(idx));
    return { layoutToStructures, propertyStructures };
  };

  const assignUtilities = () => {
    const layoutToUtilities = new Map();
    const propertyUtilities = [];
    if (!utilitiesInfo.length) return { layoutToUtilities, propertyUtilities };
    if (!buildingLayouts.length) {
      utilitiesInfo.forEach((u) => propertyUtilities.push(u.index));
      return { layoutToUtilities, propertyUtilities };
    }
    if (utilitiesInfo.length === 1 && buildingLayouts.length > 1) {
      propertyUtilities.push(utilitiesInfo[0].index);
      return { layoutToUtilities, propertyUtilities };
    }
    const unused = new Set(utilitiesInfo.map((u) => u.index));
    const utilitiesByBuilding = new Map();
    utilitiesInfo.forEach((u) => {
      if (typeof u.building_number === "number") {
        if (!utilitiesByBuilding.has(u.building_number)) {
          utilitiesByBuilding.set(u.building_number, []);
        }
        utilitiesByBuilding.get(u.building_number).push(u);
      }
    });
    buildingLayouts.forEach((layout) => {
      let match = null;
      if (
        typeof layout.building_number === "number" &&
        utilitiesByBuilding.has(layout.building_number)
      ) {
        match = utilitiesByBuilding
          .get(layout.building_number)
          .find((u) => unused.has(u.index));
      }
      if (!match) {
        const nextIdx = [...unused][0];
        if (nextIdx != null) {
          match = utilitiesInfo.find((u) => u.index === nextIdx);
        }
      }
      if (match) {
        unused.delete(match.index);
        if (!layoutToUtilities.has(layout.index)) {
          layoutToUtilities.set(layout.index, []);
        }
        layoutToUtilities.get(layout.index).push(match.index);
      }
    });
    unused.forEach((idx) => propertyUtilities.push(idx));
    return { layoutToUtilities, propertyUtilities };
  };

  const { layoutToStructures, propertyStructures } = assignStructures();

  const { layoutToUtilities, propertyUtilities } = assignUtilities();

  layoutOutputs.forEach((layout) => {
    writeJSON(path.join("data", `layout_${layout.index}.json`), layout.data);
  });

  layoutOutputs.forEach((layout) => {
    layout.child_indices.forEach((childIdx) => {
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
      path.join("data", `relationship_property_has_utility_${utilityIdx}.json`),
      {
        from: { "/": "./property.json" },
        to: { "/": `./utility_${utilityIdx}.json` },
      },
    );
  });
}

function extractSecTwpRng($) {
  let value = null;
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const th = textOf($(tr).find("th strong"));
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

function isNumeric(value) {
  return /^-?\d+$/.test(value);
}

function attemptWriteAddress(unnorm, secTwpRng) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return;
  let city = null;
  let zip = null;
  const fullAddressParts = (full || "").split(",");
  if (fullAddressParts.length >= 3 && fullAddressParts[2]) {
    state_and_pin = fullAddressParts[2].split(/\s+/);
    if (
      state_and_pin.length >= 1 &&
      state_and_pin[state_and_pin.length - 1] &&
      state_and_pin[state_and_pin.length - 1].trim().match(/^\d{5}$/)
    ) {
      zip = state_and_pin[state_and_pin.length - 1].trim();
      city = fullAddressParts[1].trim();
    }
  }
  const parts = (fullAddressParts[0] || "").split(/\s+/);
  let street_number = null;
  if (parts && parts.length > 1) {
    street_number_candidate = parts[0];
    if ((street_number_candidate || "") && isNumeric(street_number_candidate)) {
      street_number = parts.shift() || null;
    }
  }
  let suffix = null;
  if (parts && parts.length > 1) {
    suffix_candidate = parts[parts.length - 1];
    if (normalizeSuffix(suffix_candidate)) {
      suffix = parts.pop() || null;
    }
  }
  let street_name = parts.join(" ") || null;
  if (street_name) {
    street_name = street_name.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/g, "");
  }
  // const m = full.match(
  //   /^(\d+)\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i,
  // );
  // if (!m) return;
  // const [, streetNumber, streetRest, city, state, zip, plus4] = m;

  // let street_name = streetRest.trim();
  // let route_number = null;
  // let street_suffix_type = null;
  // const m2 = streetRest.trim().match(/^([A-Za-z]+)\s+(\d+)$/);
  // if (m2) {
  //   street_name = m2[1].toUpperCase();
  //   route_number = m2[2];
  //   if (street_name === "HWY" || street_name === "HIGHWAY")
  //     street_suffix_type = "Hwy";
  // }
  const city_name = city ? city.toUpperCase() : null;
  // const state_code = state.toUpperCase();
  const postal_code = zip;
  // const plus_four_postal_code = plus4 || null;

  // Per evaluator expectation, set county_name from input jurisdiction
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  const county_name = inputCounty || null;

  const address = {
    city_name,
    country_code: "US",
    county_name,
    latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
    longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
    plus_four_postal_code: null,
    postal_code,
    state_code: "FL",
    street_name: street_name,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_number: street_number,
    street_suffix_type: normalizeSuffix(suffix),
    unit_identifier: null,
    route_number: null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    block: null,
    lot: null,
    municipality_name: null,
  };
  writeJSON(path.join("data", "address.json"), address);
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
  if (parcelId) propertyRecord = writeProperty($, parcelId);
  const propertyType = propertyRecord ? propertyRecord.property_type : null;

  const sales = extractSales($);
  writeSalesDeedsFilesAndRelationships($, parcelId, propertySeed);

  writeTaxes($);

  let utilityInfo = [];
  let structureInfo = [];

  if (parcelId) {
    writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed);
    utilityInfo = writeUtility(parcelId);
    structureInfo = writeStructures(parcelId);
    writeLayout(parcelId, propertyType, structureInfo, utilityInfo);
    writePropertyImprovements(parcelId, $);
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  attemptWriteAddress(unnormalized, secTwpRng);
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
