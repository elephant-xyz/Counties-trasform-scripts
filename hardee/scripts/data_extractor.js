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

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Building Information";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl11_ctl01_grdSales tbody tr";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl05_ctl01_grdValuation";
const HISTORICAL_VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl06_ctl01_grdValuation";

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

function sanitizeForRelationship(filename) {
  let base = String(filename || "");
  base = base.replace(/^\.\/+/g, "");
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex > 0) {
    base = base.slice(0, dotIndex);
  }
  return base.replace(/[\\/]/g, "_");
}

function writeRelationshipFile(fromFile, toFile, options) {
  let cache = null;

  const isSet = (candidate) =>
    candidate && typeof candidate.add === "function" && typeof candidate.has === "function";

  if (isSet(options)) {
    cache = options;
  } else if (options && typeof options === "object" && isSet(options.cache)) {
    cache = options.cache;
  }

  const relFile = `relationship_${sanitizeForRelationship(fromFile)}_${sanitizeForRelationship(toFile)}.json`;
  if (cache && cache.has(relFile)) return relFile;

  const relationship = {
    from: { "/": `./${fromFile}` },
    to: { "/": `./${toFile}` },
  };

  writeJSON(path.join("data", relFile), relationship);
  if (cache) cache.add(relFile);
  return relFile;
}

function removeMatchingDataFiles(pattern) {
  const dataDir = path.resolve("data");
  try {
    fs.readdirSync(dataDir).forEach((file) => {
      if (pattern.test(file)) {
        fs.unlinkSync(path.join(dataDir, file));
      }
    });
  } catch (e) {}
}

function isExtraFeatureRecord(record) {
  if (!record || typeof record !== "object") return false;
  if (record._extra_feature === true) return true;
  if (record.extra_feature === true) return true;
  const keys = [
    "source_category",
    "source_type",
    "origin",
    "feature_source",
    "feature_category",
  ];
  return keys.some((key) => {
    const value = record[key];
    return (
      typeof value === "string" &&
      value.toLowerCase().includes("extra")
    );
  });
}

function mapImprovementType(typeCode, description) {
  const combined = `${typeCode || ""} ${description || ""}`.toUpperCase();
  if (/ELECTR/.test(combined)) return "Electrical";
  if (/MECH/.test(combined)) return "MechanicalHVAC";
  if (/PLUMB/.test(combined)) return "Plumbing";
  if (/ROOF/.test(combined) || /REROOF/.test(combined)) return "Roofing";
  if (/POOL|SPA/.test(combined)) return "PoolSpaInstallation";
  if (/FENCE/.test(combined)) return "Fencing";
  if (/SOLAR/.test(combined)) return "Solar";
  if (/DEMOL/.test(combined)) return "Demolition";
  if (/ALTER/.test(combined)) {
    if (/RESIDENT/.test(combined)) return "ResidentialConstruction";
    if (/COMM/.test(combined)) return "CommercialConstruction";
    return "BuildingAddition";
  }
  if (/REPAIR/.test(combined)) return "GeneralBuilding";
  if (/COMM/.test(combined)) return "CommercialConstruction";
  if (/RESIDENT/.test(combined)) return "ResidentialConstruction";
  return "GeneralBuilding";
}

function mapImprovementAction(typeCode, description) {
  const combined = `${typeCode || ""} ${description || ""}`.toUpperCase();
  if (/NEW/.test(combined)) return "New";
  if (/REPL|REROOF|RE-ROOF|RE ROOF|REPLACE/.test(combined)) return "Replacement";
  if (/REPAIR/.test(combined)) return "Repair";
  if (/ALTER/.test(combined)) return "Alteration";
  if (/ADDIT/.test(combined) || /EXTENSION/.test(combined)) return "Addition";
  if (/REMOVE|DEMOL/.test(combined)) return "Remove";
  return "Other";
}

function extractPermits($) {
  const permits = [];
  const table = $("#ctlBodyPane_ctl12_ctl01_grdPermits");
  if (!table.length) return permits;
  const seen = new Set();
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length < 5) return;
    const permitNumber = textTrim($(tds[0]).text()).split(/\s+/)[0];
    if (!permitNumber || !/\d/.test(permitNumber)) return;
    if (seen.has(permitNumber)) return;
    seen.add(permitNumber);
    const type = textTrim($(tds[1]).text());
    const description = textTrim($(tds[2]).text());
    const issued = textTrim($(tds[3]).text());
    const amount = textTrim($(tds[4]).text());
    permits.push({
      permit_number: permitNumber,
      type,
      description,
      issued,
      amount,
    });
  });
  return permits;
}

const DEFAULT_PROPERTY_MAPPING = Object.freeze({
  property_type: "LandParcel",
  property_usage_type: "Unknown",
  build_status: null,
  structure_form: null,
  ownership_estate_type: null,
});

const FEE_SIMPLE = "FeeSimple";

function normalizeUseCodeKey(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toUpperCase();
  const replacements = {
    "<": "LT",
    ">": "GT",
    "+": "PLUS",
    "&": "AND",
    "@": "AT",
    "%": "PCT",
    "$": "USD",
  };
  Object.entries(replacements).forEach(([from, to]) => {
    if (s.includes(from)) s = s.split(from).join(to);
  });
  s = s.replace(/[^A-Z0-9]/g, "");
  return s || null;
}

function createMapping(overrides) {
  return Object.freeze({ ...DEFAULT_PROPERTY_MAPPING, ...overrides });
}

const PROPERTY_USE_MAPPINGS = (() => {
  const map = {};

  const register = (label, overrides) => {
    const key = normalizeUseCodeKey(label);
    if (!key) return;
    map[key] = createMapping(overrides);
  };

  const registerGroup = (labels, overrides) => {
    labels.forEach((label) => register(label, overrides));
  };

  registerGroup(
    ["BEAUTY PARLOR", "MISC IMPROVED", "MXD RES/OFF/STO", "REPAIR SERVICE"],
    {
      property_type: "Building",
      property_usage_type: "Commercial",
      build_status: "Improved",
      ownership_estate_type: FEE_SIMPLE,
    },
  );

  registerGroup(["BOWL,RINKS,POOL", "NIGHTCLUB/BARS", "TOURIST ATTRACTION"], {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["CENTRALLY ASSED"], {
    property_usage_type: "Unknown",
    build_status: "VacantLand",
  });

  registerGroup(["CHURCHES", "PRVT OWNED CHURCHES"], {
    property_type: "Building",
    property_usage_type: "Church",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["CLUBS/LODGES/HALLS"], {
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["COLLEGES", "PUB SCHL IMP"], {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["PRVT SCHL/DAY CARE"], {
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["NON-PROFIT / ORPHANA"], {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["COMMUNITY SHOPPING"], {
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["REGIONAL SHOPPING"], {
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["SUPERMARKET"], {
    property_type: "Building",
    property_usage_type: "Supermarket",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["STORES/1 STORY"], {
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["GOLF COURSES"], {
    property_usage_type: "GolfCourse",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["GOVT VAC", "MUNICIPAL VAC", "STATE TIITF"], {
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(
    ["COUNTY IMP", "FEDERAL IMP", "MUNICIPAL IMP", "STATE FLA IMP", "TIITF IMP", "IDA"],
    {
      property_type: "Building",
      property_usage_type: "GovernmentProperty",
      build_status: "Improved",
      ownership_estate_type: FEE_SIMPLE,
    },
  );

  registerGroup(["NOTE RECORD"], {
    property_usage_type: "ReferenceParcel",
    build_status: "VacantLand",
  });

  registerGroup(["SUBSURFACE RGHT"], {
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
  });

  registerGroup(["NON AG ACREAGE"], {
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["VACANT"], {
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["VACANT COMMERCIAL"], {
    property_usage_type: "Commercial",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["VACANT INDUSTRIAL"], {
    property_usage_type: "Industrial",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["PARKING LOT", "OPEN STORAGE"], {
    property_usage_type: "OpenStorage",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["POULT,BEES,FISH, ETC", "IMP POULT,BEES,FISH, SFR"], {
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["IMP CROPLAND COM", "IMP CROPLAND SFR", "CROPLAND CLS1"], {
    property_usage_type: "DrylandCropland",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(
    [
      "IMP GROVE COM",
      "IMP GROVE SFR",
      "GROVES,ORCHRD",
    ],
    {
      property_usage_type: "OrchardGroves",
      build_status: "Improved",
      ownership_estate_type: FEE_SIMPLE,
    },
  );

  registerGroup(["IMP DAIRIES COM", "IMP DAIRIES SFR"], {
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["IMP MISC AG COM", "IMP MISC AG SFR", "MISC AG"], {
    property_usage_type: "Agricultural",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(
    [
      "IMP PASTURE CLS1 COM",
      "IMP PASTURE CLS1 SFR",
      "IMP PASTURE CLS2 COM",
      "IMP PASTURE CLS2 SFR",
    ],
    {
      property_usage_type: "ImprovedPasture",
      build_status: "Improved",
      ownership_estate_type: FEE_SIMPLE,
    },
  );

  registerGroup(["IMP PASTURE CLS33 SFR", "IMP PASTURE CLS4 SFR"], {
    property_usage_type: "PastureWithTimber",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["PASTURE CLS1", "PASTURE CLS2", "PASTURE CLS4"], {
    property_usage_type: "GrazingLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["TIMBERLAND 60-69", "IMP TIMERBLAND SFR"], {
    property_usage_type: "TimberLand",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["OTHER FOOD PROCESS"], {
    property_type: "Building",
    property_usage_type: "AgriculturalPackingFacility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["PACKING PLANTS"], {
    property_type: "Building",
    property_usage_type: "PackingPlant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MOBILE HOME"], {
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "ManufacturedHomeOnLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["RV/MH,PK LOT"], {
    property_usage_type: "MobileHomePark",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MORTUARY/CEMETARY"], {
    property_type: "Building",
    property_usage_type: "MortuaryCemetery",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MULTI-FAM <10"], {
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "MultiFamilyLessThan10",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MULTI-FAM 10+"], {
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "MultiFamilyMoreThan10",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["SINGLE FAMILY"], {
    property_type: "Building",
    property_usage_type: "Residential",
    build_status: "Improved",
    structure_form: "SingleFamilyDetached",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["RETIREMENT HOMES"], {
    property_type: "Building",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["HOMES FOR THE AGED"], {
    property_type: "Building",
    property_usage_type: "HomesForAged",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["PRIVATE HOSPITALS"], {
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["HOTELS/MOTELS"], {
    property_type: "Building",
    property_usage_type: "Hotel",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["FINANCIAL BLDG"], {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["INSURANCE COMP", "OFFCE BLD M/STY", "OFFICE BLD 1STY", "PROFESS SVC/BLD"], {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["RESTAURANT/CAFE", "DRIVE-IN REST."], {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["SERVICE STATION"], {
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["VEH SALE/REPAIR"], {
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["LUMBER YARD"], {
    property_type: "Building",
    property_usage_type: "LumberYard",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["LIGHT MANUFACTURE"], {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["HEAVY INDUSTRL"], {
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MINERAL PROCESSING", "MINING"], {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["UTILITIES"], {
    property_type: "Building",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["MILITARY"], {
    property_type: "Building",
    property_usage_type: "Military",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["WAREHOSE/DISTRB", "WAREHOUSE/STOR/SFR"], {
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
    ownership_estate_type: FEE_SIMPLE,
  });

  registerGroup(["WASTELAND/DUMPS"], {
    property_usage_type: "SewageDisposal",
    build_status: "VacantLand",
    ownership_estate_type: FEE_SIMPLE,
  });

  return Object.freeze(map);
})();
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

function extractLocationAddress($) {
  let location = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    let th = textOf($(tr).find("th strong"));
    if(!th || !th.trim()) {
      th = textOf($(tr).find("td").first());
    }
    if ((th || "").toLowerCase().includes("location address")) {
      const spanText = textOf($(tr).find("td span"));
      if (spanText) {
        location = spanText.replace(/\s+/g, " ").trim();
      }
    }
  });
  return location || null;
}

function mapPropertyAttributesFromUseCode(raw) {
  if (!raw) return null;
  const labelPart =
    raw.indexOf("(") >= 0 ? raw.slice(0, raw.indexOf("(")).trim() : raw.trim();
  const labelKey = normalizeUseCodeKey(labelPart);
  if (labelKey && PROPERTY_USE_MAPPINGS[labelKey]) {
    return PROPERTY_USE_MAPPINGS[labelKey];
  }
  const codeMatch = raw.match(/\(([^)]+)\)/);
  if (codeMatch) {
    const codeKey = normalizeUseCodeKey(codeMatch[1]);
    if (codeKey && PROPERTY_USE_MAPPINGS[codeKey]) {
      return PROPERTY_USE_MAPPINGS[codeKey];
    }
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
    if (!tds.length) return;
    const saleDate = textOf($(tds[1]));
    const salePrice = textOf($(tds[2]));
    const instrument = textOf($(tds[3]));
    const bookPageCell = $(tds[4]);
    const bookPage = textOf(bookPageCell);
    const link = bookPageCell.find("a").last().attr("href") || null;
    const instrumentNumber = textOf($(tds[5]));
    const qualification = textOf($(tds[6]));
    const reason = textOf($(tds[7]));
    const vacantImproved = textOf($(tds[8]));
    const grantor = textOf($(tds[9]));
    const grantee = textOf($(tds[10]));
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage,
      link,
      instrumentNumber,
      qualification,
      reason,
      vacantImproved,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  const mapping = {
    WD: "Warranty Deed",
    WDT: "Warranty Deed",
    WARRANTY: "Warranty Deed",
    WARRANTYDEED: "Warranty Deed",
    SWD: "Special Warranty Deed",
    SW: "Special Warranty Deed",
    SPECIAL: "Special Warranty Deed",
    QCD: "Quitclaim Deed",
    QC: "Quitclaim Deed",
    QUITCLAIM: "Quitclaim Deed",
    GD: "Grant Deed",
    GRANT: "Grant Deed",
    BARGAINSALE: "Bargain and Sale Deed",
    BSD: "Bargain and Sale Deed",
    LADYBIRD: "Lady Bird Deed",
    LBD: "Lady Bird Deed",
    TOD: "Transfer on Death Deed",
    TL: "Transfer on Death Deed",
    SD: "Sheriff's Deed",
    SHD: "Sheriff's Deed",
    TD: "Tax Deed",
    TAX: "Tax Deed",
    TRD: "Trustee's Deed",
    TR: "Trustee's Deed",
    PRD: "Personal Representative Deed",
    PR: "Personal Representative Deed",
    CD: "Correction Deed",
    CORR: "Correction Deed",
    DIL: "Deed in Lieu of Foreclosure",
    LIF: "Life Estate Deed",
    JTD: "Joint Tenancy Deed",
    JT: "Joint Tenancy Deed",
    TIC: "Tenancy in Common Deed",
    CPD: "Community Property Deed",
    GIFTD: "Gift Deed",
    GIFT: "Gift Deed",
    ITD: "Interspousal Transfer Deed",
    INTERSPOUSAL: "Interspousal Transfer Deed",
    WILD: "Wild Deed",
    SMD: "Special Master’s Deed",
    COURT: "Court Order Deed",
    CFD: "Contract for Deed",
    QUIET: "Quiet Title Deed",
    ADM: "Administrator's Deed",
    GDNS: "Guardian's Deed",
    RCV: "Receiver's Deed",
    ROW: "Right of Way Deed",
    VAC: "Vacation of Plat Deed",
    ASSIGN: "Assignment of Contract",
    RELEASE: "Release of Contract",
  };
  if (mapping[u]) return mapping[u];
  return "Miscellaneous";
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

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyAttributes = mapPropertyAttributesFromUseCode(useCode);
  if (!propertyAttributes) {
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
    property_type: propertyAttributes.property_type || "LandParcel",
    property_usage_type: propertyAttributes.property_usage_type || null,
    build_status: propertyAttributes.build_status || null,
    structure_form: propertyAttributes.structure_form || null,
    ownership_estate_type: propertyAttributes.ownership_estate_type || null,
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

function parseBookPageParts(text) {
  if (!text) return { book: null, page: null, volume: null };
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return { book: null, page: null, volume: null };
  const slashMatch = cleaned.match(/([\w-]+)\s*\/\s*([\w-]+)/);
  if (slashMatch) {
    return {
      book: slashMatch[1] || null,
      page: slashMatch[2] || null,
      volume: null,
    };
  }
  const bookMatch = cleaned.match(/\bBOOK\s*(\w+)/i);
  const pageMatch = cleaned.match(/\bPAGE\s*(\w+)/i);
  const volumeMatch = cleaned.match(/\bVOL(?:UME)?\s*(\w+)/i);
  if (bookMatch || pageMatch || volumeMatch) {
    return {
      book: bookMatch ? bookMatch[1] : null,
      page: pageMatch ? pageMatch[1] : null,
      volume: volumeMatch ? volumeMatch[1] : null,
    };
  }
  return { book: cleaned || null, page: null, volume: null };
}

function mapSaleQualificationToType(qualification) {
  if (!qualification) return null;
  const normalized = String(qualification).trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.includes("QUALIFIED")) return "TypicallyMotivated";
  if (normalized.includes("UNQUALIFIED")) return null;
  return null;
}

let salesHistoryRecords = [];

function writeSalesDeedsFilesAndRelationships($, propertySeed) {
  const sales = extractSales($);
  salesHistoryRecords = [];

  try {
    fs.readdirSync("data").forEach((f) => {
      if (
        /^sales_(history_)?\d+\.json$/i.test(f) ||
        /^deed_\d+\.json$/i.test(f) ||
        /^file_\d+\.json$/i.test(f) ||
        /^relationship_.*\.json$/i.test(f)
      ) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  const relationshipCache = new Set();
  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleHistoryFile = `sales_history_${idx}.json`;
    const saleDateIso = parseDateToISO(s.saleDate);
    const saleHistory = {
      ownership_transfer_date: saleDateIso,
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
      request_identifier:
        (propertySeed && propertySeed.request_identifier) || null,
    };
    const saleType = mapSaleQualificationToType(s.qualification);
    if (saleType) saleHistory.sale_type = saleType;
    writeJSON(path.join("data", saleHistoryFile), saleHistory);

    const { book, page, volume } = parseBookPageParts(s.bookPage || "");
    const deedType = mapInstrumentToDeedType(s.instrument);
    const deedFile = `deed_${idx}.json`;
    const deed = {};
    if (deedType) deed.deed_type = deedType;
    const bookStr = book ? String(book).trim() : "";
    if (bookStr) deed.book = bookStr;
    const pageStr = page ? String(page).trim() : "";
    if (pageStr) deed.page = pageStr;
    const volumeStr = volume ? String(volume).trim() : "";
    if (volumeStr) deed.volume = volumeStr;
    const instrumentNumber = s.instrumentNumber
      ? String(s.instrumentNumber).trim()
      : "";
    if (instrumentNumber) deed.instrument_number = instrumentNumber;
    writeJSON(path.join("data", deedFile), deed);

    const deedFileName = `file_${idx}.json`;
    let fileLabel = null;
    if (s.bookPage) {
      const parts = s.bookPage.split("\n")[0];
      fileLabel = parts ? parts.trim() : null;
    }
    const file = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: fileLabel ? `Deed ${fileLabel}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", deedFileName), file);

    writeRelationshipFile(deedFile, deedFileName, relationshipCache);
    writeRelationshipFile(saleHistoryFile, deedFile, relationshipCache);

    salesHistoryRecords.push({
      file: saleHistoryFile,
      dateIso: saleDateIso,
      ownersDateKey: saleDateIso,
    });
  });

  return sales;
}
let people = [];
let companies = [];

function buildPersonKey(first, middle, last) {
  const f = (first || "").trim().toUpperCase();
  const m = (middle || "").trim().toUpperCase();
  const l = (last || "").trim().toUpperCase();
  if (!f || !l) return null;
  return `PERSON:${f}|${m}|${l}`;
}

function buildCompanyKey(name) {
  const n = (name || "").trim().toUpperCase();
  return n ? `COMPANY:${n}` : null;
}

function buildOwnerKeyForRecord(owner) {
  if (!owner) return null;
  if (owner.type === "person") {
    return buildPersonKey(owner.first_name, owner.middle_name, owner.last_name);
  }
  if (owner.type === "company") {
    return buildCompanyKey(owner.name);
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

function writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const personMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const k = buildPersonKey(o.first_name, o.middle_name, o.last_name);
        if (!k) return;
        if (!personMap.has(k)) {
          personMap.set(k, {
            first_name: o.first_name,
            middle_name: o.middle_name,
            last_name: o.last_name,
            prefix_name: o.prefix_name || null,
            suffix_name: o.suffix_name || null,
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
    });
  });
  const personKeyToIndex = new Map();
  const personEntries = Array.from(personMap.entries());
  people = personEntries.map(([ownerKey, p], idx) => {
    personKeyToIndex.set(ownerKey, idx + 1);
    return {
      first_name: p.first_name ? titleCaseName(p.first_name) : null,
      middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
      last_name: p.last_name ? titleCaseName(p.last_name) : null,
      birth_date: null,
      prefix_name: p.prefix_name || null,
      suffix_name: p.suffix_name || null,
      us_citizenship_status: null,
      veteran_status: null,
      request_identifier: parcelId,
    };
  });
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  const companyMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim()) {
        const key = buildCompanyKey(o.name);
        if (key && !companyMap.has(key)) {
          companyMap.set(key, { name: o.name });
        }
      }
    });
  });
  const companyKeyToIndex = new Map();
  const companyEntries = Array.from(companyMap.entries());
  companies = companyEntries.map(([ownerKey, value], idx) => {
    companyKeyToIndex.set(ownerKey, idx + 1);
    return {
      name: value.name ? value.name.trim() : null,
      request_identifier: parcelId,
    };
  });
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  const relationshipCache = new Set();
  const saleOwnerLinks = new Map();
  sales.forEach((rec, idx) => {
    const saleRecord = salesHistoryRecords[idx];
    if (!saleRecord) return;
    const saleHistoryFile = saleRecord.file;
    const d =
      saleRecord.dateIso ||
      parseDateToISO(rec.saleDate) ||
      saleRecord.ownersDateKey;
    const ownersOnDate = d ? ownersByDate[d] || [] : [];
    const uniqueOwnerKeys = new Set();
    ownersOnDate.forEach((o) => {
      const ownerKey = buildOwnerKeyForRecord(o);
      if (!ownerKey || uniqueOwnerKeys.has(ownerKey)) return;
      uniqueOwnerKeys.add(ownerKey);
      if (o.type === "person") {
        const pIdx = personKeyToIndex.get(ownerKey);
        if (pIdx) {
          writeRelationshipFile(
            saleHistoryFile,
            `person_${pIdx}.json`,
            relationshipCache,
          );
          if (!saleOwnerLinks.has(saleHistoryFile))
            saleOwnerLinks.set(saleHistoryFile, new Set());
          saleOwnerLinks.get(saleHistoryFile).add(ownerKey);
        }
      } else if (o.type === "company") {
        const cIdx = companyKeyToIndex.get(ownerKey);
        if (cIdx) {
          writeRelationshipFile(
            saleHistoryFile,
            `company_${cIdx}.json`,
            relationshipCache,
          );
          if (!saleOwnerLinks.has(saleHistoryFile))
            saleOwnerLinks.set(saleHistoryFile, new Set());
          saleOwnerLinks.get(saleHistoryFile).add(ownerKey);
        }
      }
    });
  });

  let latestSaleRecord = null;
  salesHistoryRecords.forEach((record) => {
    if (!record || !record.file) return;
    if (
      !latestSaleRecord ||
      (!latestSaleRecord.dateIso && record.dateIso) ||
      (record.dateIso &&
        latestSaleRecord.dateIso &&
        record.dateIso > latestSaleRecord.dateIso)
    ) {
      latestSaleRecord = record;
    }
  });

  const getOwnerKeyFromStructured = (owner) => {
    if (!owner || !owner.type) return null;
    if (owner.type === "person") {
      return buildPersonKey(
        owner.first_name,
        owner.middle_name,
        owner.last_name,
      );
    }
    if (owner.type === "company") {
      return buildCompanyKey(owner.name);
    }
    return null;
  };

  if (latestSaleRecord) {
    const saleFile = latestSaleRecord.file;
    let linkedKeys = saleOwnerLinks.get(saleFile);
    if (!linkedKeys) {
      linkedKeys = new Set();
      saleOwnerLinks.set(saleFile, linkedKeys);
    }
    const currentOwners = ownersByDate.current || [];
    currentOwners.forEach((owner) => {
      const ownerKey = getOwnerKeyFromStructured(owner);
      if (!ownerKey || linkedKeys.has(ownerKey)) return;
      if (owner.type === "person") {
        const pIdx = personKeyToIndex.get(ownerKey);
        if (pIdx) {
          writeRelationshipFile(
            saleFile,
            `person_${pIdx}.json`,
            relationshipCache,
          );
          linkedKeys.add(ownerKey);
        }
      } else if (owner.type === "company") {
        const cIdx = companyKeyToIndex.get(ownerKey);
        if (cIdx) {
          writeRelationshipFile(
            saleFile,
            `company_${cIdx}.json`,
            relationshipCache,
          );
          linkedKeys.add(ownerKey);
        }
      }
    });
  }

  const mailingAddresses = Array.isArray(record.mailing_addresses)
    ? record.mailing_addresses
    : [];
  const primaryMailing = mailingAddresses.find(
    (entry) =>
      entry &&
      typeof entry.unnormalized_address === "string" &&
      entry.unnormalized_address.trim(),
  );
  if (primaryMailing) {
    const mailingFile = "mailing_address.json";
    const mailingObj = {
      unnormalized_address: primaryMailing.unnormalized_address.trim(),
      latitude: null,
      longitude: null,
      source_http_request:
        (propertySeed && propertySeed.source_http_request) || null,
      request_identifier:
        (propertySeed && propertySeed.request_identifier) || null,
    };
    writeJSON(path.join("data", mailingFile), mailingObj);

    const currentOwners = ownersByDate.current || [];
    const linkedKeys = new Set();
    currentOwners.forEach((owner) => {
      const ownerKey = buildOwnerKeyForRecord(owner);
      if (!ownerKey || linkedKeys.has(ownerKey)) return;
      linkedKeys.add(ownerKey);
      if (owner.type === "person") {
        const idx = personKeyToIndex.get(ownerKey);
        if (idx)
          writeRelationshipFile(
            `person_${idx}.json`,
            mailingFile,
            relationshipCache,
          );
      } else if (owner.type === "company") {
        const idx = companyKeyToIndex.get(ownerKey);
        if (idx)
          writeRelationshipFile(
            `company_${idx}.json`,
            mailingFile,
            relationshipCache,
          );
      }
    });
  } else {
    const mailingPath = path.join("data", "mailing_address.json");
    try {
      if (fs.existsSync(mailingPath)) fs.unlinkSync(mailingPath);
    } catch (e) {}
  }
}

function writePropertyImprovements($, parcelId) {
  removeMatchingDataFiles(/^property_improvement_\d+\.json$/i);
  removeMatchingDataFiles(/^relationship_property_property_improvement_\d+\.json$/i);
  const permits = extractPermits($);
  if (!permits.length) return;
  const relCache = new Set();
  permits.forEach((permit, idx) => {
    const improvement = {
      permit_number: permit.permit_number || null,
      improvement_type: mapImprovementType(permit.type, permit.description),
      improvement_action: mapImprovementAction(permit.type, permit.description),
      permit_issue_date: parseDateToISO(permit.issued),
      fee: parseCurrencyToNumber(permit.amount),
      completion_date: null,
      contractor_type: "Unknown",
      improvement_status: "Permitted",
      permit_required: true,
      request_identifier: parcelId,
    };
    const fileName = `property_improvement_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), improvement);
    writeRelationshipFile("property.json", fileName, relCache);
  });
}

function extractHistoricalValuation($) {
  const table = $(HISTORICAL_VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  // const years = [];
  // const headerThs = table.find("tbody tr th").toArray();
  // headerThs.forEach((th, idx) => {
  //   const txt = $(th).text().trim();
  //   const m = txt.match(/(\d{4})/);
  //   if (m && m.length > 1) {
  //     let y = parseInt(m[1], 10);
  //     if (!isNaN(y)) {
  //       years.push({ year: y, idx });
  //     }
  //   }
  // });
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
  // return years.map(({ year, idx }) => {
  //   const get = (label) => {
  //     const arr = dataMap[label] || [];
  //     return arr[idx] || null;
  //   };
  //   return {
  //     year,
  //     building: get("Building Value"),
  //     land: get("Total Land Value"),
  //     market: get("Just Market"),
  //     assessed: get("Assessed Value"),
  //     taxable: get("Taxable Value"),
  //   };
  // });
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
  if (HISTORICAL_VALUATION_TABLE_SELECTOR) {
    const historicalVals = extractHistoricalValuation($);
    historicalVals.forEach((v) => {
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
}

function writeStructures(parcelId) {
  removeMatchingDataFiles(/^structure(_\d+)?\.json$/i);
  const structuresData = readJSON(path.join("owners", "structure_data.json"));
  const key = `property_${parcelId}`;
  const structures =
    structuresData && structuresData[key] && Array.isArray(structuresData[key].structures)
      ? structuresData[key].structures
      : [];

  const fileRefs = [];
  const buildingIndexMap = new Map();
  const meta = [];

  structures.forEach((entry, idx) => {
    const out = { ...(entry || {}) };
    const buildingIndex = out._building_index ?? idx + 1;
    const isExtra = isExtraFeatureRecord(entry);
    if (isExtra) {
      delete out.extra_feature;
    }
    delete out._building_index;
    delete out._extra_feature;
    out.request_identifier = parcelId;
    const fileName = `structure_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), out);
    fileRefs.push(fileName);
    buildingIndexMap.set(buildingIndex, fileName);
    meta.push({
      fileName,
      buildingIndex,
      isExtraFeature: isExtra,
    });
  });

  return { files: fileRefs, buildingIndexMap, meta };
}

function writeUtilities(parcelId) {
  removeMatchingDataFiles(/^utility(_\d+)?\.json$/i);
  const utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  const key = `property_${parcelId}`;
  const utilities =
    utilitiesData && utilitiesData[key] && Array.isArray(utilitiesData[key].utilities)
      ? utilitiesData[key].utilities
      : [];

  const fileRefs = [];
  const buildingIndexMap = new Map();
  const meta = [];

  utilities.forEach((entry, idx) => {
    const out = { ...(entry || {}) };
    const buildingIndex = out._building_index ?? idx + 1;
    const isExtra = isExtraFeatureRecord(entry);
    if (isExtra) {
      delete out.extra_feature;
    }
    delete out._building_index;
    delete out._extra_feature;
    out.request_identifier = parcelId;
    const fileName = `utility_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), out);
    fileRefs.push(fileName);
    buildingIndexMap.set(buildingIndex, fileName);
    meta.push({
      fileName,
      buildingIndex,
      isExtraFeature: isExtra,
    });
  });

  // Maintain backwards compatibility by writing utility.json when only one record exists.
  if (utilities.length === 1 && fileRefs[0]) {
    const single = readJSON(path.join("data", fileRefs[0])) || {};
    writeJSON(path.join("data", "utility.json"), single);
  }

  return { files: fileRefs, buildingIndexMap, meta };
}

function writeLayout(parcelId, structureCtx, utilityCtx) {
  removeMatchingDataFiles(/^layout_\d+\.json$/i);
  removeMatchingDataFiles(/^relationship_layout_.*\.json$/i);
  removeMatchingDataFiles(/^relationship_property_(layout|structure|utility).*\.json$/i);

  const layoutsData = readJSON(path.join("owners", "layout_data.json"));
  if (!layoutsData) return;
  const key = `property_${parcelId}`;
  const record = layoutsData[key] || {};
  const layoutRecords = Array.isArray(record.layouts) ? record.layouts : [];

  const layoutFiles = [];
  const layoutMeta = [];

  layoutRecords.forEach((layout, idx) => {
    const out = { ...(layout || {}) };
    const isExtra = isExtraFeatureRecord(layout);
    const buildingNumber =
      layout._building_number ??
      layout.building_number ??
      (typeof layout.building_number === "number" ? layout.building_number : null);

    Object.keys(out).forEach((prop) => {
      if (prop.startsWith("_")) delete out[prop];
    });
    if (isExtra) {
      delete out.extra_feature;
    }
    if (!("is_exterior" in out) || out.is_exterior == null) {
      out.is_exterior = false;
    }
    if (!("is_finished" in out) || out.is_finished == null) {
      out.is_finished = true;
    }
    out.request_identifier = parcelId;
    const fileName = `layout_${idx + 1}.json`;
    writeJSON(path.join("data", fileName), out);
    layoutFiles.push(fileName);
    layoutMeta.push({
      fileName,
      index: idx,
      space_type: out.space_type ?? null,
      building_number: buildingNumber,
      is_building:
        typeof out.space_type === "string" &&
        out.space_type.toLowerCase() === "building",
      is_extra_feature: isExtra,
    });
  });

  const relCache = new Set();
  const propertyFile = "property.json";

  const buildingLayouts = [];
  const buildingLayoutByNumber = new Map();
  layoutMeta.forEach((meta) => {
    if (!meta.is_building) return;
    const order = buildingLayouts.length;
    const numeric = Number(meta.building_number);
    const buildingNumber = Number.isFinite(numeric) ? numeric : order + 1;
    const enriched = { ...meta, buildingNumber, order };
    buildingLayouts.push(enriched);
    if (!buildingLayoutByNumber.has(buildingNumber)) {
      buildingLayoutByNumber.set(buildingNumber, enriched);
    }
  });
  const buildingCount = buildingLayouts.length;
  const singleBuilding = buildingCount <= 1;

  const layoutHasLayout = Array.isArray(record.layout_has_layout)
    ? record.layout_has_layout
    : [];
  layoutHasLayout.forEach((rel) => {
    const parentIdx =
      rel && Number.isInteger(rel.parent_index) ? rel.parent_index : null;
    const childIdx =
      rel && Number.isInteger(rel.child_index) ? rel.child_index : null;
    if (
      parentIdx == null ||
      childIdx == null ||
      !layoutFiles[parentIdx] ||
      !layoutFiles[childIdx]
    ) {
      return;
    }
    const parentMeta = layoutMeta[parentIdx];
    const childMeta = layoutMeta[childIdx];
    if (!parentMeta || !childMeta) return;
    if (
      buildingCount > 1 &&
      childMeta.is_extra_feature &&
      parentMeta.is_building
    ) {
      writeRelationshipFile(propertyFile, layoutFiles[childIdx], {
        cache: relCache,
      });
      return;
    }
    writeRelationshipFile(layoutFiles[parentIdx], layoutFiles[childIdx], {
      cache: relCache,
    });
  });

  if (buildingCount > 1) {
    layoutMeta.forEach((meta) => {
      if (meta.is_building) return;
      if (!meta.is_extra_feature) return;
      writeRelationshipFile(propertyFile, meta.fileName, {
        cache: relCache,
      });
    });
  }

  const structureMetaList = Array.isArray(structureCtx?.meta)
    ? structureCtx.meta
    : [];
  const utilityMetaList = Array.isArray(utilityCtx?.meta)
    ? utilityCtx.meta
    : [];
  const hasAnyImprovements =
    structureMetaList.length + utilityMetaList.length > 0;
  const propertyOnlyForSingle =
    buildingCount > 1 &&
    structureMetaList.length <= 1 &&
    utilityMetaList.length <= 1 &&
    hasAnyImprovements;

  const getLayoutForBuildingIndex = (buildingIndex, fallbackIdx) => {
    if (
      Number.isFinite(buildingIndex) &&
      buildingLayoutByNumber.has(buildingIndex)
    ) {
      return buildingLayoutByNumber.get(buildingIndex);
    }
    if (Number.isFinite(fallbackIdx) && fallbackIdx < buildingLayouts.length) {
      return buildingLayouts[fallbackIdx];
    }
    return null;
  };

  structureMetaList.forEach((meta, idx) => {
    if (!meta || !meta.fileName) return;
    const targetFile = meta.fileName;
    if (singleBuilding && buildingLayouts[0]) {
      writeRelationshipFile(buildingLayouts[0].fileName, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (singleBuilding && !buildingLayouts[0]) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (!singleBuilding && meta.isExtraFeature) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (propertyOnlyForSingle) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    const buildingIndex = Number(meta.buildingIndex);
    const layoutTarget = getLayoutForBuildingIndex(buildingIndex, idx);
    if (layoutTarget) {
      writeRelationshipFile(layoutTarget.fileName, targetFile, {
        cache: relCache,
      });
    } else {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
    }
  });

  utilityMetaList.forEach((meta, idx) => {
    if (!meta || !meta.fileName) return;
    const targetFile = meta.fileName;
    if (singleBuilding && buildingLayouts[0]) {
      writeRelationshipFile(buildingLayouts[0].fileName, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (singleBuilding && !buildingLayouts[0]) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (!singleBuilding && meta.isExtraFeature) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    if (propertyOnlyForSingle) {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
      return;
    }
    const buildingIndex = Number(meta.buildingIndex);
    const layoutTarget = getLayoutForBuildingIndex(buildingIndex, idx);
    if (layoutTarget) {
      writeRelationshipFile(layoutTarget.fileName, targetFile, {
        cache: relCache,
      });
    } else {
      writeRelationshipFile(propertyFile, targetFile, {
        cache: relCache,
      });
    }
  });
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

function attemptWriteAddress(unnorm, propertySeed, secTwpRng, siteAddress) {
  const fullAddress =
    (siteAddress && siteAddress.trim()) ||
    (unnorm && unnorm.full_address ? unnorm.full_address.trim() : null);
  const sourceHttpRequest =
    (unnorm && unnorm.source_http_request) ||
    (propertySeed && propertySeed.source_http_request) ||
    null;
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) ||
    (unnorm && unnorm.request_identifier) ||
    null;
  const countyName =
    (unnorm && unnorm.county_jurisdiction) ||
    (propertySeed && propertySeed.county_name) ||
    null;

  const address = {
    unnormalized_address: fullAddress || null,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    source_http_request: sourceHttpRequest || null,
    request_identifier: requestIdentifier || null,
    county_name: countyName || null,
    country_code: "US",
  };
  writeJSON(path.join("data", "address.json"), address);

  const geometry = {
    latitude:
      unnorm && typeof unnorm.latitude === "number" ? unnorm.latitude : null,
    longitude:
      unnorm && typeof unnorm.longitude === "number" ? unnorm.longitude : null,
    source_http_request: sourceHttpRequest || null,
    request_identifier: requestIdentifier || null,
  };
  writeJSON(path.join("data", "geometry.json"), geometry);

  const legacyPath = path.join("data", "relationship_address_geometry.json");
  try {
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
  } catch (e) {}
  const oldPath = path.join("data", "relationship_address_json_geometry_json.json");
  try {
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  } catch (e) {}
  writeRelationshipFile("address.json", "geometry.json");
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

  const sales = writeSalesDeedsFilesAndRelationships($, propertySeed);

  writeTaxes($);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed);
    // writeOwnersCurrentAndRelationships(parcelId);
    // writeHistoricalBuyerPersonsAndRelationships(parcelId, sales);
    writePropertyImprovements($, parcelId);
    const structureCtx = writeStructures(parcelId);
    const utilityCtx = writeUtilities(parcelId);
    writeLayout(parcelId, structureCtx, utilityCtx);
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  const locationAddress = extractLocationAddress($);
  attemptWriteAddress(unnormalized, propertySeed, secTwpRng, locationAddress);
}

module.exports = {
  normalizeUseCodeKey,
  PROPERTY_USE_MAPPINGS,
};

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
