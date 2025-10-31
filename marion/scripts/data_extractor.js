const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function emptyDir(p) {
  if (fs.existsSync(p)) {
    fs.readdirSync(p).forEach((f) => {
      fs.rmSync(path.join(p, f), { recursive: true, force: true });
    });
  } else {
    fs.mkdirSync(p, { recursive: true });
  }
}
function writeJSON(fp, obj) {
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), "utf8");
}
function readJSON(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
function readText(fp) {
  return fs.readFileSync(fp, "utf8");
}
function parseCurrency(str) {
  if (str == null) return null;
  const m = String(str).replace(/[^0-9.\-]/g, "");
  if (m === "" || m === "-") return null;
  const num = parseFloat(m);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function extractParcelId($, html) {
  // Flexible regex: matches any dash-separated numeric pattern with at least two groups
  const regex = /\b\d+(?:-\d+)+\b/;

  // Check all <h1> tags first
  const h1s = $("h1").toArray().map(el => $(el).text().trim());
  for (const t of h1s) {
    const m = t.match(regex);
    if (m) return m[0];
  }

  // Fallback: search entire HTML
  const m = html.match(regex);
  return m ? m[0] : null;
}

function extractPC($) {
  const bodyText = $("body").text();
  const m = bodyText.match(/PC:\s*(\d{2})/);
  return m ? m[1] : null;
}

const PROPERTY_CLASS_MAP = {
  "00": {
    property_type: "VacantLand",
    property_usage_type: "Residential",
    build_status: "VacantLand",
  },
  "01": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
    number_of_units_type: "One",
    build_status: "Improved",
  },
  "02": {
    property_type: "MobileHome",
    property_usage_type: "Residential",
    number_of_units_type: "One",
    build_status: "Improved",
  },
  "03": {
    property_type: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyMoreThan10",
    build_status: "Improved",
  },
  "04": {
    property_type: "Condominium",
    property_usage_type: "Residential",
    structure_form: "ApartmentUnit",
    build_status: "Improved",
  },
  "05": {
    property_type: "Cooperative",
    property_usage_type: "Residential",
    build_status: "Improved",
  },
  "06": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
  },
  "07": {
    property_type: "MiscellaneousResidential",
    property_usage_type: "Residential",
    build_status: "Improved",
  },
  "08": {
    property_type: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
    build_status: "Improved",
  },
  "09": {
    property_type: "ResidentialCommonElementsAreas",
    property_usage_type: "ResidentialCommonElementsAreas",
    build_status: "Improved",
  },
  "10": {
    property_type: "VacantLand",
    property_usage_type: "Commercial",
    build_status: "VacantLand",
  },
  "11": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
  },
  "12": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
  },
  "13": {
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    build_status: "Improved",
  },
  "14": {
    property_type: "Building",
    property_usage_type: "Supermarket",
    build_status: "Improved",
  },
  "15": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    build_status: "Improved",
  },
  "16": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    build_status: "Improved",
  },
  "17": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
  },
  "18": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
  },
  "19": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
  },
  "20": {
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
  },
  "21": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
  },
  "22": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
  },
  "23": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
  },
  "24": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
  },
  "25": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
  },
  "26": {
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
  },
  "27": {
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
  },
  "28": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
  },
  "29": {
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
    build_status: "Improved",
  },
  "30": {
    property_type: "Building",
    property_usage_type: "NurseryGreenhouse",
    build_status: "Improved",
  },
  "31": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
  },
  "32": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
  },
  "33": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
  },
  "34": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
  },
  "35": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
  },
  "36": {
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    build_status: "Improved",
  },
  "37": {
    property_type: "LandParcel",
    property_usage_type: "RaceTrack",
    build_status: "Improved",
  },
  "38": {
    property_type: "LandParcel",
    property_usage_type: "GolfCourse",
    build_status: "Improved",
  },
  "39": {
    property_type: "Building",
    property_usage_type: "Hotel",
    build_status: "Improved",
  },
  "40": {
    property_type: "VacantLand",
    property_usage_type: "Industrial",
    build_status: "VacantLand",
  },
  "41": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
  },
  "42": {
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    build_status: "Improved",
  },
  "43": {
    property_type: "Building",
    property_usage_type: "LumberYard",
    build_status: "Improved",
  },
  "44": {
    property_type: "Building",
    property_usage_type: "PackingPlant",
    build_status: "Improved",
  },
  "45": {
    property_type: "Building",
    property_usage_type: "Cannery",
    build_status: "Improved",
  },
  "46": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
  },
  "47": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
  },
  "48": {
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
  },
  "49": {
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    build_status: "Improved",
  },
  "50": {
    property_type: "LandParcel",
    property_usage_type: "Agricultural",
    build_status: "Improved",
  },
  "51": {
    property_type: "LandParcel",
    property_usage_type: "DrylandCropland",
    build_status: "Improved",
  },
  "52": {
    property_type: "LandParcel",
    property_usage_type: "CroplandClass2",
    build_status: "Improved",
  },
  "53": {
    property_type: "LandParcel",
    property_usage_type: "CroplandClass3",
    build_status: "Improved",
  },
  "54": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "55": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "56": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "57": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "58": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "59": {
    property_type: "LandParcel",
    property_usage_type: "TimberLand",
    build_status: "Improved",
  },
  "60": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "61": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "62": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "63": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "64": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "65": {
    property_type: "LandParcel",
    property_usage_type: "GrazingLand",
    build_status: "Improved",
  },
  "66": {
    property_type: "LandParcel",
    property_usage_type: "OrchardGroves",
    build_status: "Improved",
  },
  "67": {
    property_type: "LandParcel",
    property_usage_type: "Poultry",
    build_status: "Improved",
  },
  "68": {
    property_type: "LandParcel",
    property_usage_type: "LivestockFacility",
    build_status: "Improved",
  },
  "69": {
    property_type: "LandParcel",
    property_usage_type: "Ornamentals",
    build_status: "Improved",
  },
  "70": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
  },
  "71": {
    property_type: "Building",
    property_usage_type: "Church",
    build_status: "Improved",
  },
  "72": {
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
  },
  "73": {
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    build_status: "Improved",
  },
  "74": {
    property_type: "Building",
    property_usage_type: "HomesForAged",
    build_status: "Improved",
  },
  "75": {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    build_status: "Improved",
  },
  "76": {
    property_type: "Building",
    property_usage_type: "MortuaryCemetery",
    build_status: "Improved",
  },
  "77": {
    property_type: "Building",
    property_usage_type: "ClubsLodges",
    build_status: "Improved",
  },
  "78": {
    property_type: "Building",
    property_usage_type: "SanitariumConvalescentHome",
    build_status: "Improved",
  },
  "79": {
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    build_status: "Improved",
  },
  "81": {
    property_type: "Building",
    property_usage_type: "Military",
    build_status: "Improved",
  },
  "82": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
  },
  "83": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
  },
  "84": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
  },
  "85": {
    property_type: "Building",
    property_usage_type: "PublicHospital",
    build_status: "Improved",
  },
  "86": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
  },
  "87": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
  },
  "88": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
  },
  "89": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
  },
  "90": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
  },
  "91": {
    property_type: "Building",
    property_usage_type: "Utility",
    build_status: "Improved",
  },
  "92": {
    property_type: "LandParcel",
    property_usage_type: "Industrial",
    build_status: "Improved",
  },
  "93": {
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    build_status: "Improved",
  },
  "94": {
    property_type: "LandParcel",
    property_usage_type: "ReferenceParcel",
    build_status: "Improved",
  },
  "95": {
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    build_status: "Improved",
  },
  "96": {
    property_type: "LandParcel",
    property_usage_type: "SewageDisposal",
    build_status: "Improved",
  },
  "97": {
    property_type: "LandParcel",
    property_usage_type: "Recreational",
    build_status: "Improved",
  },
  "98": {
    property_type: "Building",
    property_usage_type: "Railroad",
    build_status: "Improved",
  },
  "99": {
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "Improved",
  },
};

const DEFAULT_PROPERTY_CLASS = {
  property_type: "Building",
  property_usage_type: "Unknown",
  structure_form: null,
  number_of_units_type: null,
  build_status: null,
};

function mapPropertyClass(pc) {
  if (!pc) return DEFAULT_PROPERTY_CLASS;
  const mapping = PROPERTY_CLASS_MAP[pc];
  if (!mapping) return DEFAULT_PROPERTY_CLASS;
  return { ...DEFAULT_PROPERTY_CLASS, ...mapping };
}


function extractYearBuiltCheerio($) {
  let year = null;
  $("b").each((i, el) => {
    const t = $(el).text().trim();
    if (/^Year Built$/i.test(t)) {
      const parentText = $(el).parent().text();
      const m = parentText.match(/Year Built\s*(\d{4})/i);
      if (m) {
        year = parseInt(m[1], 10);
        return false;
      }
    }
  });
  if (year == null) {
    const allText = $("body").text();
    const m = allText.match(/Year Built\s*(\d{4})/i);
    if (m) year = parseInt(m[1], 10);
  }
  return year;
}

function extractZoning($) {
  let zoning = null;
  $("table").each((i, tbl) => {
    const header = $(tbl).find("tr").first().text();
    if (/Use\s*CUse[\s\S]*Zoning/i.test(header)) {
      const rows = $(tbl).find("tr");
      if (rows.length > 1) {
        const firstRowTds = $(rows[1]).find("td");
        if (firstRowTds.length >= 5) {
          const z = $(firstRowTds[4]).text().trim();
          if (z) zoning = z;
        }
      }
    }
  });
  return zoning;
}

function extractCurrentValue($) {
  let result = {};
  $("table").each((i, tbl) => {
    const txt = $(tbl).text();
    if (
      /Land Just Value/i.test(txt) &&
      /Total Just Value/i.test(txt) &&
      /School Taxable/i.test(txt)
    ) {
      const rightNums = $(tbl)
        .find('td[align="right"]')
        .map((k, td) => $(td).text().trim())
        .get();
      if (rightNums.length >= 7) {
        result.landJust = parseCurrency(rightNums[0]);
        result.buildings = parseCurrency(rightNums[1]);
        result.misc = parseCurrency(rightNums[2]);
        result.totalJust = parseCurrency(rightNums[3]);
        result.totalAssessed = parseCurrency(rightNums[4]);
        result.totalTaxable = parseCurrency(rightNums[6]);
      }
      return false;
    }
  });
  return result;
}

function extractTaxesAssessments($) {
  let amt = null;
  $("td").each((i, td) => {
    const txt = $(td).text();
    if (/Taxes\s*\/\s*Assessments:/i.test(txt)) {
      const m = txt.match(
        /Taxes\s*\/\s*Assessments:\s*\$?([0-9,]+\.?\d{0,2})/i,
      );
      if (m) amt = parseCurrency(m[1]);
    }
  });
  return amt;
}

function extractHistoryTaxes($) {
  const a = $("a").filter((i, el) =>
    /History of Assessed Values/i.test($(el).text())
  );
  if (!a.length) return [];

  const table = a.closest("center").nextAll("table.mGrid").first();
  const results = [];
  const rows = table.find("tr");

  rows.each((rIdx, tr) => {
    if (rIdx === 0) return; // skip header
    const tds = $(tr).find("td");
    if (tds.length >= 8) {
      const year = parseInt($(tds[0]).text().trim(), 10);
      const land = parseCurrency($(tds[1]).text());
      const building = parseCurrency($(tds[2]).text());
      const mkt = parseCurrency($(tds[4]).text());
      const assessed = parseCurrency($(tds[5]).text());
      const taxable = parseCurrency($(tds[7]).text());

      if (year) {
        results.push({ year, land, building, mkt, assessed, taxable });
      }
    }
  });

  // Add tax roll years
  const earliestYear = results.length ? results[results.length - 1].year : null;
  results.forEach(r => {
    r.first_year_on_tax_roll = earliestYear;
    r.first_year_building_on_tax_roll = r.year;
  });

  return results;
}

function extractSalesPrecise($) {
  const a = $("a").filter((i, el) =>
    /Property Transfer History/i.test($(el).text())
  );
  if (!a.length) return [];

  const table = a.closest("center").nextAll("table.mGrid").first();
  const rows = table.find("tr");
  const sales = [];

  rows.each((idx, tr) => {
    if (idx === 0) return; // skip header
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      const bookLink = $(tds[0]).find("a").attr("href") || null;
      const rawDate = $(tds[1]).text().trim();

      // Match MM/YYYY or M/YYYY format dynamically
      const dateParts = rawDate.match(/(\d{1,2})\/(\d{4})/);
      let dateText = null;
      if (dateParts) {
        const [, month, year] = dateParts;
        dateText = `${year}-${month.padStart(2, '0')}-01`; // ISO format
      }

      const instrument = $(tds[2]).text().trim();
      const price = parseCurrency($(tds[6]).text());
      const bookPage = $(tds[0]).text().trim();

      sales.push({ bookPage, url: bookLink, dateText, instrument, price });
    }
  });

  return sales;
}

function extractLegalDescription($) {
  let desc = null;
  const a = $("a").filter((i, el) =>
    /Property Description/i.test($(el).text()),
  );
  if (a.length) {
    const center = a.closest("center");
    const parts = [];
    let el = center.next();
    while (el && el.length) {
      const tag = (el[0].tagName || "").toLowerCase();
      if (tag === "hr") break;
      const txt = el.text().trim();
      if (txt) parts.push(txt);
      el = el.next();
    }
    if (parts.length) {
      desc = parts.join("\n");
    }
  }
  if (!desc) {
    const html = $.html();
    const m = html.match(/Property Description[\s\S]*?<br\/?>([\s\S]*?)<hr>/i);
    if (m) {
      desc = cheerio
        .load("<div>" + m[1] + "</div>")("div")
        .text()
        .replace(/\s+$/, "")
        .trim()
        .replace(/\n{2,}/g, "\n");
    }
  }
  return desc || null;
}

function parseAddress(full) {
  if (!full) return null;
  const m = full.match(
    /^(\d+)\s+([NSEW]{1,2})\s+(.+?)\s*,\s*([A-Z .'-]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
  );
  if (!m) return null;
  const streetNumber = m[1];
  const preDir = m[2];
  const streetFull = m[3];
  const parts = streetFull.split(/\s+/);
  let streetSuffix = null;
  let streetNameParts = parts;
  if (parts.length > 1) {
    streetSuffix = parts[parts.length - 1];
    streetNameParts = parts.slice(0, parts.length - 1);
  }
  const streetName = streetNameParts.join(" ");
  const city = m[4].trim().toUpperCase();
  const state = m[5];
  const zip = m[6];
  const plus4 = m[7] || null;
  const suffixMap = {
    ST: "St",
    RD: "Rd",
    AVE: "Ave",
    AV: "Ave",
    DR: "Dr",
    LN: "Ln",
    BLVD: "Blvd",
    HWY: "Hwy",
    CT: "Ct",
    TER: "Ter",
    PL: "Pl",
    CIR: "Cir",
    PKWY: "Pkwy",
    WAY: "Way",
    TRL: "Trl",
    XING: "Xing",
    SQ: "Sq",
    RDG: "Rdg",
    MALL: "Mall",
    RUN: "Run",
    WALK: "Walk",
    PATH: "Path",
    RTE: "Rte",
  };
  const street_suffix_type =
    suffixMap[(streetSuffix || "").toUpperCase()] || null;
  return {
    streetNumber,
    preDir,
    streetName,
    street_suffix_type,
    city,
    state,
    zip,
    plus4,
  };
}

function parseSTRB(legal) {
  if (!legal)
    return { section: null, township: null, range: null, block: null };
  let section = null,
    township = null,
    range = null,
    block = null;
  const secM = legal.match(/SEC\s*(\d{1,2})/i);
  if (secM) section = secM[1];
  const twpM = legal.match(/TWP\s*(\d{1,2})/i);
  if (twpM) township = twpM[1];
  const rgeM = legal.match(/RGE\s*(\d{1,2})/i);
  if (rgeM) range = rgeM[1];
  const blkM = legal.match(/BLK\s*(\w+)/i);
  if (blkM) block = blkM[1];
  return { section, township, range, block };
}

function main() {
  const dataDir = path.join("data");
  emptyDir(dataDir);

  const inputHtml = readText("input.html");
  const $ = cheerio.load(inputHtml);
  const unaddr = fs.existsSync("unnormalized_address.json")
    ? readJSON("unnormalized_address.json")
    : {};
  const seed = fs.existsSync("property_seed.json")
    ? readJSON("property_seed.json")
    : null;
  const parcelSeed = fs.existsSync("parcel.json") ? readJSON("parcel.json") : null;

  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilsData = fs.existsSync(utilsPath) ? readJSON(utilsPath) : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const parcelIdFromPage = extractParcelId($, inputHtml);
  const pc = extractPC($);
  const classDetails = mapPropertyClass(pc);
  const propertyType = classDetails.property_type;
  const propertyUsageType = classDetails.property_usage_type ?? null;
  const structureForm = classDetails.structure_form ?? null;
  const numberOfUnitsType = classDetails.number_of_units_type ?? null;
  const buildStatus = classDetails.build_status ?? null;
  const yearBuilt = extractYearBuiltCheerio($);
  const zoning = extractZoning($) || null;
  const legalDescription = extractLegalDescription($);
  const taxesAssess = extractTaxesAssessments($);
  const history = extractHistoryTaxes($);
  const sales = extractSalesPrecise($);
  const addrParsed = parseAddress(unaddr.full_address || "");
  const strb = parseSTRB(legalDescription || "");
  const parcelIdentifier =
    (seed && (seed.parcel_id || seed.parcel_identifier)) ||
    (parcelSeed && parcelSeed.parcel_identifier) ||
    parcelIdFromPage;
  const requestIdentifier =
    (seed && seed.request_identifier != null ? seed.request_identifier : null) ??
    (parcelSeed && parcelSeed.request_identifier != null
      ? parcelSeed.request_identifier
      : null);
  let sourceHttpRequest =
    (seed && (seed.source_http_request || seed.entry_http_request)) || null;
  if (!sourceHttpRequest && parcelSeed && parcelSeed.source_http_request) {
    sourceHttpRequest = parcelSeed.source_http_request;
  }
  if (!sourceHttpRequest && seed && seed.url) {
    sourceHttpRequest = {
      method: seed.method || "GET",
      url: seed.url,
    };
    if (seed.multiValueQueryString && typeof seed.multiValueQueryString === "object") {
      sourceHttpRequest.multiValueQueryString = seed.multiValueQueryString;
    }
  }

  // property.json
  const property = {
      area_under_air: null,
      build_status: buildStatus,
      livable_floor_area: null,
      number_of_units: null,
      number_of_units_type: numberOfUnitsType,
      parcel_identifier: parcelIdentifier || null,
      property_effective_built_year: null,
      property_legal_description_text: legalDescription || null,
      property_structure_built_year: yearBuilt || null,
      property_type: propertyType,
      property_usage_type: propertyUsageType,
      request_identifier: requestIdentifier,
      source_http_request: sourceHttpRequest,
      structure_form: structureForm,
      subdivision: null,
      total_area: null,
      zoning: zoning,
    };
    writeJSON(path.join(dataDir, "property.json"), property);
  

  // address.json
  if (addrParsed) {
    const address = {
      block: strb.block || null,
      city_name: addrParsed.city || null,
      country_code: null,
      county_name: "Marion",
      latitude: null,
      longitude: null,
      lot: null,
      municipality_name: null,
      plus_four_postal_code: addrParsed.plus4 || null,
      postal_code: addrParsed.zip || null,
      range: strb.range || null,
      route_number: null,
      section: strb.section || null,
      state_code: addrParsed.state || null,
      street_name: addrParsed.streetName || null,
      street_post_directional_text: null,
      street_pre_directional_text: addrParsed.preDir || null,
      street_number: addrParsed.streetNumber || null,
      street_suffix_type: addrParsed.street_suffix_type || null,
      township: strb.township || null,
      unit_identifier: null,
    };
    writeJSON(path.join(dataDir, "address.json"), address);
  }

  // tax_*.json from history
  history.forEach((h) => {
    const tax = {
      first_year_building_on_tax_roll: h.first_year_building_on_tax_roll ?? null,
      first_year_on_tax_roll: h.first_year_on_tax_roll ?? null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      property_assessed_value_amount: h.assessed ?? null,
      property_building_amount: h.building ?? null,
      property_land_amount: h.land ?? null,
      property_market_value_amount: h.mkt ?? null,
      property_taxable_value_amount: h.taxable ?? null,
      tax_year: h.year,
      yearly_tax_amount: h.year === 2025 ? taxesAssess : null
    };
    if (taxesAssess != null && h.year === 2025) {
      tax.yearly_tax_amount = taxesAssess;
    }
    writeJSON(path.join(dataDir, `tax_${h.year}.json`), tax);
  });

  // sales_*.json and deeds + files + relationships
  let deedIdx = 0;
  let fileIdx = 0;
  const saleToDeed = [];
  sales.forEach((s, idx) => {
    const salesObj = {
      ownership_transfer_date: null,
      purchase_price_amount: s.price != null ? s.price : null,
    };
    const salePath = path.join(dataDir, `sales_${idx + 1}.json`);
    writeJSON(salePath, salesObj);

    // Deed mapping
    let deed_type = null;
    const inst = (s.instrument || "").toUpperCase();
    if (inst.includes("SPECIAL WARRANTY")) deed_type = "Special Warranty Deed";
    else if (inst.includes("WARRANTY")) deed_type = "Warranty Deed";
    else if (inst.includes("QUIT")) deed_type = "Quitclaim Deed";

    if (deed_type) {
      deedIdx += 1;
      const deedPath = path.join(dataDir, `deed_${deedIdx}.json`);
      writeJSON(deedPath, { deed_type });
      saleToDeed.push({ saleIndex: idx + 1, deedIndex: deedIdx });

      if (s.url) {
        fileIdx += 1;
        let document_type = null;
        if (deed_type === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deed_type === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else if (deed_type === "Special Warranty Deed")
          document_type = "ConveyanceDeed";
        const fileObj = {
          document_type: document_type,
          file_format: null,
          ipfs_url: null,
          name: s.bookPage || null,
          original_url: encodeURI(s.url) || null,
          source_http_request: sourceHttpRequest,
          request_identifier: requestIdentifier,
        };
        const filePath = path.join(dataDir, `file_${fileIdx}.json`);
        writeJSON(filePath, fileObj);
        const relDF = {
          from: { "/": `./deed_${deedIdx}.json` },
          to: { "/": `./file_${fileIdx}.json` },
        };
        writeJSON(
          path.join(dataDir, `relationship_deed_file_${fileIdx}.json`),
          relDF,
        );
      }
    }
  });

  // relationship_sales_deed (numbered only to avoid duplicates)
  saleToDeed.forEach((m, i) => {
    const rel = {
      from: { "/": `./sales_${m.saleIndex}.json` },
      to: { "/": `./deed_${m.deedIndex}.json` },
    };
    writeJSON(path.join(dataDir, `relationship_sales_deed_${i + 1}.json`), rel);
  });

  // owners → link to best sale (highest price)
  let bestSaleIndex = null;
  let bestPrice = -1;
  sales.forEach((s, idx) => {
    if (typeof s.price === "number" && s.price > bestPrice) {
      bestPrice = s.price;
      bestSaleIndex = idx + 1;
    }
  });

  if (ownersData && parcelIdentifier) {
    const ownerKey = `property_${parcelIdentifier}`;
    const rec = ownersData[ownerKey];
    if (
      rec &&
      rec.owners_by_date &&
      Array.isArray(rec.owners_by_date.current)
    ) {
      const owners = rec.owners_by_date.current;
      let companyIdx = 0,
        relIdx = 0;
      owners.forEach((o) => {
        if (o.type === "company") {
          companyIdx += 1;
          writeJSON(path.join(dataDir, `company_${companyIdx}.json`), {
            name: o.name || null,
          });
          if (bestSaleIndex != null) {
            relIdx += 1;
            const rel = {
              from: { "/": `./sales_${bestSaleIndex}.json` },
              to: { "/": `./company_${companyIdx}.json` },
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

  // lot.json (acres)
  const acresMatch = $("td")
    .filter((i, el) => /Acres:/i.test($(el).text()))
    .first()
    .text()
    .match(/Acres:\s*([0-9.]+)/i);
  let acres = acresMatch ? parseFloat(acresMatch[1]) : null;
  const lot = {
    driveway_condition: null,
    driveway_material: null,
    fence_height: null,
    fence_length: null,
    fencing_type: null,
    landscaping_features: null,
    lot_area_sqft: acres != null && acres > 0 ? Math.round(acres * 43560) : null,
    lot_condition_issues: null,
    lot_length_feet: null,
    lot_size_acre: acres != null ? acres : null,
    lot_type:
      acres != null
        ? acres > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre"
        : null,
    lot_width_feet: null,
    view: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // structure.json (minimal)
  const struct = {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: "Fair",
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: "Unknown",
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: 1,
    number_of_stories: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), struct);

  // utility.json from utilities_data.json
  if (utilsData) {
    const utilIdentifier =
      requestIdentifier ?? parcelIdentifier ?? parcelIdFromPage ?? null;
    if (utilIdentifier) {
      const utilKey = `property_${utilIdentifier}`;
      const util = utilsData[utilKey] || null;
      if (util) {
        writeJSON(path.join(dataDir, "utility.json"), util);
      }
    }
  }

  // layout_*.json from layout_data.json
  if (layoutData) {
    const layoutIdentifier =
      requestIdentifier ?? parcelIdentifier ?? parcelIdFromPage ?? null;
    if (layoutIdentifier) {
      const layKey = `property_${layoutIdentifier}`;
      const ld = layoutData[layKey];
      if (ld && Array.isArray(ld.layouts)) {
        ld.layouts.forEach((l, idx) => {
          writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), l);
        });
      }
    }
  }
}

main();
