const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { buildStructure } = require("./structureMapping");

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

// Maps Marion County PC codes (marion_property_type.txt) to Elephant property schema enums
const PROPERTY_CLASSIFICATION_MAP = {
  "00": {
    property_type: "VacantLand",
    structure_form: null,
    property_usage_type: "Residential",
  },
  "01": {
    property_type: "SingleFamily",
    structure_form: "SingleFamilyDetached",
    property_usage_type: "Residential",
  },
  "02": {
    property_type: "MobileHome",
    structure_form: "ManufacturedHomeInPark",
    property_usage_type: "Residential",
  },
  "03": {
    property_type: "MultiFamilyMoreThan10",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
  },
  "04": {
    property_type: "Condominium",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
  },
  "05": {
    property_type: "Cooperative",
    structure_form: "ApartmentUnit",
    property_usage_type: "Residential",
  },
  "06": {
    property_type: "Retirement",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Retirement",
  },
  "07": {
    property_type: "MiscellaneousResidential",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
  },
  "08": {
    property_type: "MultiFamilyLessThan10",
    structure_form: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
  },
  "09": {
    property_type: "ResidentialCommonElementsAreas",
    structure_form: null,
    property_usage_type: "ResidentialCommonElementsAreas",
  },
  "10": {
    property_type: "VacantLand",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "11": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "RetailStore",
  },
  "12": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "13": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "DepartmentStore",
  },
  "14": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Supermarket",
  },
  "15": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "ShoppingCenterRegional",
  },
  "16": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "ShoppingCenterCommunity",
  },
  "17": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
  },
  "18": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
  },
  "19": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
  },
  "20": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "TransportationTerminal",
  },
  "21": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Restaurant",
  },
  "22": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Restaurant",
  },
  "23": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "FinancialInstitution",
  },
  "24": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "OfficeBuilding",
  },
  "25": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "26": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "ServiceStation",
  },
  "27": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "AutoSalesRepair",
  },
  "28": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "29": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "WholesaleOutlet",
  },
  "30": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "31": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Theater",
  },
  "32": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Theater",
  },
  "33": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Entertainment",
  },
  "34": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Entertainment",
  },
  "35": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Entertainment",
  },
  "36": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Recreational",
  },
  "37": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "RaceTrack",
  },
  "38": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GolfCourse",
  },
  "39": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Hotel",
  },
  "40": {
    property_type: "VacantLand",
    structure_form: null,
    property_usage_type: "Industrial",
  },
  "41": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "LightManufacturing",
  },
  "42": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "HeavyManufacturing",
  },
  "43": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "LumberYard",
  },
  "44": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "PackingPlant",
  },
  "45": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Cannery",
  },
  "46": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "LightManufacturing",
  },
  "47": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "MineralProcessing",
  },
  "48": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Warehouse",
  },
  "49": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "OpenStorage",
  },
  "50": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Agricultural",
  },
  "51": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "DrylandCropland",
  },
  "52": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "CroplandClass2",
  },
  "53": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "CroplandClass3",
  },
  "54": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "55": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "56": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "57": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "58": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "59": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TimberLand",
  },
  "60": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "61": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "62": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "63": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "64": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "65": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "GrazingLand",
  },
  "66": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "OrchardGroves",
  },
  "67": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Poultry",
  },
  "68": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Agricultural",
  },
  "69": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Ornamentals",
  },
  "70": {
    property_type: "VacantLand",
    structure_form: null,
    property_usage_type: "Unknown",
  },
  "71": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Church",
  },
  "72": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "PrivateSchool",
  },
  "73": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "PrivateHospital",
  },
  "74": {
    property_type: "Retirement",
    structure_form: "MultiFamilyMoreThan10",
    property_usage_type: "HomesForAged",
  },
  "75": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "NonProfitCharity",
  },
  "76": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "MortuaryCemetery",
  },
  "77": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "ClubsLodges",
  },
  "78": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "SanitariumConvalescentHome",
  },
  "79": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "CulturalOrganization",
  },
  "81": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Military",
  },
  "82": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "ForestParkRecreation",
  },
  "83": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "PublicSchool",
  },
  "84": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
  },
  "85": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "PublicHospital",
  },
  "86": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
  },
  "87": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
  },
  "88": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
  },
  "89": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "GovernmentProperty",
  },
  "90": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Commercial",
  },
  "91": {
    property_type: "Building",
    structure_form: null,
    property_usage_type: "Utility",
  },
  "92": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Industrial",
  },
  "93": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Unknown",
  },
  "94": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Unknown",
  },
  "95": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "RiversLakes",
  },
  "96": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "SewageDisposal",
  },
  "97": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Recreational",
  },
  "98": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "Railroad",
  },
  "99": {
    property_type: "LandParcel",
    structure_form: null,
    property_usage_type: "TransitionalProperty",
  },
};

function mapPropertyClassification(pc) {
  if (pc == null) {
    return {
      property_type: null,
      structure_form: null,
      property_usage_type: null,
    };
  }
  const key = String(pc).padStart(2, "0");
  const mapped = PROPERTY_CLASSIFICATION_MAP[key];
  return mapped
    ? { ...mapped }
    : { property_type: null, structure_form: null, property_usage_type: null };
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

function extractSubdivision($) {
  const bodyText = $("body").text();

  // Match common subdivision patterns
  const subdivisionRegex = /\b(?:PLAT BOOK.*?\n)?([A-Z][A-Z\s&]+(?:SUBDIVISION|UNIT|PHASE|VILLAGE)[^\n]*)/i;

  const match = bodyText.match(subdivisionRegex);
  return match ? match[1].trim() : null;
}


function extractTotalArea($) {
  let total = 0;
  $("table").each((i, tbl) => {
    const headers = $(tbl).find("th").map((i, el) => $(el).text().trim()).get();
    if (headers.includes("Total Flr Area")) {
      $(tbl).find("tr").each((rIdx, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 10) {
          const areaText = $(tds[9]).text().trim().replace(/,/g, "");
          const area = parseFloat(areaText);
          if (!isNaN(area)) total += area;
        }
      });
    }
  });
  return total > 0 ? total : null;
}

function main() {
  const dataDir = path.join("data");
  emptyDir(dataDir);

  const inputHtml = readText("input.html");
  const $ = cheerio.load(inputHtml);
  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilsData = fs.existsSync(utilsPath) ? readJSON(utilsPath) : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const parcelId = extractParcelId($, inputHtml);
  const pc = extractPC($);
  const classification = mapPropertyClassification(pc);
  const yearBuilt = extractYearBuiltCheerio($);
  const zoning = extractZoning($) || null;
  const legalDescription = extractLegalDescription($);
  const taxesAssess = extractTaxesAssessments($);
  const history = extractHistoryTaxes($);
  const sales = extractSalesPrecise($);
  const subdivision = extractSubdivision($);
  const totalArea = extractTotalArea($);
  const addrParsed = parseAddress(unaddr.full_address || "");
  const strb = parseSTRB(legalDescription || "");
  const { data: extractedStructure } = buildStructure($, inputHtml);
  // property.json
  const property = {
    area_under_air: null,
    livable_floor_area: null,
    number_of_units: null,
    number_of_units_type: null,
    parcel_identifier: parcelId,
    property_effective_built_year: null,
    property_legal_description_text: legalDescription || null,
    property_structure_built_year: yearBuilt || null,
    property_type: classification.property_type ?? null,
    structure_form: classification.structure_form ?? null,
    property_usage_type: classification.property_usage_type ?? null,
    subdivision: subdivision,
    total_area: totalArea,
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
    ownership_transfer_date: s.dateText ?? null,
    purchase_price_amount: s.price ?? null
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
        };
        const filePath = path.join(dataDir, `file_${fileIdx}.json`);
        writeJSON(filePath, fileObj);
        const relDF = {
          to: { "/": `./deed_${deedIdx}.json` },
          from: { "/": `./file_${fileIdx}.json` },
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
      to: { "/": `./sales_${m.saleIndex}.json` },
      from: { "/": `./deed_${m.deedIndex}.json` },
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

  if (ownersData && parcelId) {
    const ownerKey = `property_${parcelId}`;
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
              to: { "/": `./company_${companyIdx}.json` },
              from: { "/": `./sales_${bestSaleIndex}.json` },
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
    exterior_wall_condition: extractedStructure.exterior_wall_condition ?? "Fair",
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: extractedStructure.exterior_wall_material_primary ?? null,
    exterior_wall_material_secondary: extractedStructure.exterior_wall_material_secondary ?? null,
    finished_base_area: extractedStructure.finished_base_area ?? null,
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
    number_of_stories: extractedStructure.number_of_stories ?? null,
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
    const utilKey = `property_${seed.request_identifier}`;
    const util = utilsData[utilKey] || null;
    if (util) {
      writeJSON(path.join(dataDir, "utility.json"), util);
    }
  }

  // layout_*.json from layout_data.json
  if (layoutData) {
    const layKey = `property_${seed.request_identifier}`;
    const ld = layoutData[layKey];
    if (ld && Array.isArray(ld.layouts)) {
      ld.layouts.forEach((l, idx) => {
        writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), l);
      });
    }
  }
}

main();

