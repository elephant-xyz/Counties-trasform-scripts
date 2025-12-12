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
  build_status: "Improved",
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
  const anchor = $('a[href*="LEGAHELP"]');
  if (!anchor.length) {
    return null;
  }

  const center = anchor.closest("center");
  const startNode = center.length ? center[0] : anchor[0];
  const lines = [];
  let node = startNode.nextSibling;

  // Walk siblings after the Property Description header until the next section starts.
  while (node) {
    if (node.type === "tag") {
      if (["hr", "center", "table", "b"].includes(node.name)) {
        break;
      }
      if (node.name === "br") {
        node = node.nextSibling;
        continue;
      }
    }

    if (node.type === "text") {
      const normalized = node.data.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      if (normalized) {
        lines.push(normalized);
      }
    }

    node = node.nextSibling;
  }

  return lines.length ? lines.join("\n") : null;
}

function parseLegalDescriptionDetails(description) {
  if (!description) {
    return null;
  }

  const text = description.replace(/\s+/g, " ").toUpperCase();
  const extract = (pattern) => {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  };

  const details = {
    section: extract(/\bSEC(?:TION)?\s*([0-9A-Z]+)/i),
    township: extract(/\bTWP(?:SHIP)?\s*([0-9A-Z]+)/i),
    range: extract(/\bR(?:GE|NG|ANGE)\s*([0-9A-Z]+)/i),
    block: extract(/\bBLK(?:OCK)?\s*([0-9A-Z-]+)/i),
    lot: extract(/\bLOT\s*([0-9A-Z-]+)/i),
  };

  return Object.values(details).some(Boolean) ? details : null;
}

function parsePropertyAddress(html) {
  if (!html) {
    return null;
  }
  const match = html.match(/Situs:\s*([^<]+)<br\s*\/?>/i);
  if (!match) {
    return null;
  }
  return match[1].replace(/\s+/g, " ").trim() || null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writeOut(filePath, obj) {
  const outPath = path.join("data", filePath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
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

function main() {
  const dataDir = path.join("data");
  emptyDir(dataDir);

  const inputHtml = readText("input.html");
  const $ = cheerio.load(inputHtml);
  const unnorm = fs.existsSync("unnormalized_address.json")
    ? readJSON("unnormalized_address.json")
    : {};
  const address = parsePropertyAddress(inputHtml);
  const seed = fs.existsSync("property_seed.json")
    ? readJSON("property_seed.json")
    : null;
  const parcelSeed = fs.existsSync("parcel.json") ? readJSON("parcel.json") : null;

  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const structuresPath = path.join("owners", "structure_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilsData = fs.existsSync(utilsPath) ? readJSON(utilsPath) : null;
  const structuresData = fs.existsSync(structuresPath) ? readJSON(structuresPath) : null;
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
  const legalDescriptionParsedInfo = parseLegalDescriptionDetails(legalDescription);
  const taxesAssess = extractTaxesAssessments($);
  const history = extractHistoryTaxes($);
  const sales = extractSalesPrecise($);
  // const addrParsed = parseAddress(unaddr.full_address || "");
  const parcelIdentifier =
    (seed && (seed.parcel_id || seed.parcel_identifier)) ||
    (parcelSeed && parcelSeed.parcel_identifier) ||
    parcelIdFromPage;
  const requestIdentifier =
    (seed && seed.request_identifier != null ? seed.request_identifier : null) ??
    (parcelSeed && parcelSeed.request_identifier != null
      ? parcelSeed.request_identifier
      : null);
  const key_part = requestIdentifier ?? parcelIdentifier ?? parcelIdFromPage ?? null;
  const key = `property_${key_part}`;
  const util = utilsData ? utilsData[key] : null;
  const struct = structuresData ? structuresData[key] : null;
  
  try {
    const seedCsvPath = path.join(".", "input.csv");
    const seedCsv = fs.readFileSync(seedCsvPath, "utf8");
    createGeometryClass(createGeometryInstances(seedCsv));
  } catch (e) {
    const latitude = unnorm && unnorm.latitude ? unnorm.latitude : null;
    const longitude = unnorm && unnorm.longitude ? unnorm.longitude : null;
    if (latitude && longitude) {
      const coordinate = new Geometry({
        latitude: latitude,
        longitude: longitude
      });
      createGeometryClass([coordinate]);
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
      structure_form: structureForm,
      subdivision: null,
      total_area: null,
      zoning: zoning,
    };
    writeJSON(path.join(dataDir, "property.json"), property);
    writeJSON(path.join(dataDir, "parcel.json"), {parcel_identifier: parcelIdentifier || ""});

    // Create property -> parcel relationship
    writeJSON(path.join(dataDir, "relationship_property_has_parcel.json"), {
      from: { "/": "./property.json" },
      to: { "/": "./parcel.json" },
    });
  

  // address.json
  if (address) {
    const addressObj = {
      county_name: "Marion",
      // latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
      // longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
      unnormalized_address: address,
    };
    writeJSON(path.join(dataDir, "address.json"), addressObj);
    writeJSON(path.join(dataDir, "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  } else if (legalDescriptionParsedInfo) {
    const addressObj = {
      county_name: "Marion",
      // latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
      // longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
      // unnormalized_address: address,
      section: legalDescriptionParsedInfo.section,
      township: legalDescriptionParsedInfo.township,
      range: legalDescriptionParsedInfo.range,
      block: legalDescriptionParsedInfo.block,
      lot: legalDescriptionParsedInfo.lot,
      city_name: null,
      country_code: "US",
      postal_code: null,
      state_code: "FL",
      street_name: null,
      street_number: null,
      street_suffix_type: null,
      plus_four_postal_code: null,
      street_post_directional_text: null,
      street_pre_directional_text: null,
      unit_identifier: null,
      route_number: null,
    };
    writeJSON(path.join(dataDir, "address.json"), addressObj);
    writeJSON(path.join(dataDir, "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
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
    // Create property -> tax relationship
    writeJSON(path.join(dataDir, `relationship_property_has_tax_${h.year}.json`), {
      from: { "/": "./property.json" },
      to: { "/": `./tax_${h.year}.json` },
    });
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

    // Create property -> sales relationship
    writeJSON(path.join(dataDir, `relationship_property_has_sales_${idx + 1}.json`), {
      from: { "/": "./property.json" },
      to: { "/": `./sales_${idx + 1}.json` },
    });

    // Deed mapping
    let deed_type = null;
    const inst = (s.instrument || "").toUpperCase();
    if (inst.includes("SPECIAL WARRANTY")) deed_type = "Special Warranty Deed";
    else if (inst.includes("WARRANTY")) deed_type = "Warranty Deed";
    else if (inst.includes("QUIT")) deed_type = "Quitclaim Deed";
    else deed_type = "Miscellaneous";

    // if (deed_type) {
    deedIdx += 1;
    const deedPath = path.join(dataDir, `deed_${deedIdx}.json`);
    let deed = { deed_type }
    if (s.bookPage && s.bookPage.split("/").length === 2) {
      deed.book = s.bookPage.split("/")[0];
      deed.page = s.bookPage.split("/")[1];
    }
    writeJSON(deedPath, deed);
    saleToDeed.push({ saleIndex: idx + 1, deedIndex: deedIdx });

    if (s.url) {
      fileIdx += 1;
      let document_type = null;
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
        from: { "/": `./deed_${deedIdx}.json` },
        to: { "/": `./file_${fileIdx}.json` },
      };
      writeJSON(
        path.join(dataDir, `relationship_deed_file_${fileIdx}.json`),
        relDF,
      );
    }
    // }
  });

  // relationship_sales_deed (numbered only to avoid duplicates)
  saleToDeed.forEach((m, i) => {
    const rel = {
      from: { "/": `./sales_${m.saleIndex}.json` },
      to: { "/": `./deed_${m.deedIndex}.json` },
    };
    writeJSON(path.join(dataDir, `relationship_sales_deed_${i + 1}.json`), rel);
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
      let companyIdx = 0;
      let personIdx = 0
      owners.forEach((o) => {
        if (o.type === "company") {
          companyIdx += 1;
          writeJSON(path.join(dataDir, `company_${companyIdx}.json`), {
            name: o.name || null,
          });
        }
        if (o.type === "person") {
          personIdx += 1;
          writeJSON(path.join(dataDir, `person_${personIdx}.json`), {
            first_name: o.first_name ? titleCaseName(o.first_name) : null,
            middle_name: o.middle_name ? titleCaseName(o.middle_name) : null,
            last_name: o.last_name ? titleCaseName(o.last_name) : null,
            birth_date: null,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
        }
      });

      // Create relationships between current owners and the most recent sale
      if (sales.length > 0) {
        const mostRecentSaleIdx = sales.length;
        let relPersonCounter = 0;
        let relCompanyCounter = 0;

        owners.forEach((o) => {
          if (o.type === "person") {
            relPersonCounter += 1;
            writeJSON(
              path.join(dataDir, `relationship_sales_person_${relPersonCounter}.json`),
              {
                from: { "/": `./sales_${mostRecentSaleIdx}.json` },
                to: { "/": `./person_${relPersonCounter}.json` },
              }
            );
          }
          if (o.type === "company") {
            relCompanyCounter += 1;
            writeJSON(
              path.join(dataDir, `relationship_sales_company_${relCompanyCounter}.json`),
              {
                from: { "/": `./sales_${mostRecentSaleIdx}.json` },
                to: { "/": `./company_${relCompanyCounter}.json` },
              }
            );
          }
        });
      }
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

  // property_has_lot relationship
  writeJSON(path.join(dataDir, "relationship_property_has_lot.json"), {
    from: { "/": "./property.json" },
    to: { "/": "./lot.json" },
  });

  // // structure.json (minimal)
  // const struct = {
  //   architectural_style_type: null,
  //   attachment_type: null,
  //   ceiling_condition: null,
  //   ceiling_height_average: null,
  //   ceiling_insulation_type: null,
  //   ceiling_structure_material: null,
  //   ceiling_surface_material: null,
  //   exterior_door_installation_date: null,
  //   exterior_door_material: null,
  //   exterior_wall_condition: "Fair",
  //   exterior_wall_condition_primary: null,
  //   exterior_wall_condition_secondary: null,
  //   exterior_wall_insulation_type: null,
  //   exterior_wall_insulation_type_primary: null,
  //   exterior_wall_insulation_type_secondary: null,
  //   exterior_wall_material_primary: null,
  //   exterior_wall_material_secondary: null,
  //   finished_base_area: null,
  //   finished_basement_area: null,
  //   finished_upper_story_area: null,
  //   flooring_condition: null,
  //   flooring_material_primary: null,
  //   flooring_material_secondary: null,
  //   foundation_condition: "Unknown",
  //   foundation_material: null,
  //   foundation_repair_date: null,
  //   foundation_type: null,
  //   foundation_waterproofing: null,
  //   gutters_condition: null,
  //   gutters_material: null,
  //   interior_door_material: null,
  //   interior_wall_condition: null,
  //   interior_wall_finish_primary: null,
  //   interior_wall_finish_secondary: null,
  //   interior_wall_structure_material: null,
  //   interior_wall_structure_material_primary: null,
  //   interior_wall_structure_material_secondary: null,
  //   interior_wall_surface_material_primary: null,
  //   interior_wall_surface_material_secondary: null,
  //   number_of_buildings: 1,
  //   number_of_stories: null,
  //   primary_framing_material: null,
  //   secondary_framing_material: null,
  //   roof_age_years: null,
  //   roof_condition: null,
  //   roof_covering_material: null,
  //   roof_date: null,
  //   roof_design_type: null,
  //   roof_material_type: null,
  //   roof_structure_material: null,
  //   roof_underlayment_type: null,
  //   siding_installation_date: null,
  //   structural_damage_indicators: null,
  //   subfloor_material: null,
  //   unfinished_base_area: null,
  //   unfinished_basement_area: null,
  //   unfinished_upper_story_area: null,
  //   window_frame_material: null,
  //   window_glazing_type: null,
  //   window_installation_date: null,
  //   window_operation_type: null,
  //   window_screen_material: null,
  // };
  // writeJSON(path.join(dataDir, "structure.json"), struct);

  // // utility.json from utilities_data.json
  // if (utilsData) {
  //   const utilIdentifier =
  //     requestIdentifier ?? parcelIdentifier ?? parcelIdFromPage ?? null;
  //   if (utilIdentifier) {
  //     const utilKey = `property_${utilIdentifier}`;
  //     const util = utilsData[utilKey] || null;
  //     if (util) {
  //       writeJSON(path.join(dataDir, "utility.json"), util);
  //     }
  //   }
  // }

  // // layout_*.json from layout_data.json
  // if (layoutData) {
  //   const layoutIdentifier =
  //     requestIdentifier ?? parcelIdentifier ?? parcelIdFromPage ?? null;
  //   if (layoutIdentifier) {
  //     const layKey = `property_${layoutIdentifier}`;
  //     const ld = layoutData[layKey];
  //     if (ld && Array.isArray(ld.layouts)) {
  //       ld.layouts.forEach((l, idx) => {
  //         writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), l);
  //       });
  //     }
  //   }
  // }
    // Layout extraction from owners/layout_data.json
  if (layoutData) {
    let layoutBuildingMap = {};
    const lset =
      key && layoutData[key] && Array.isArray(layoutData[key])
        ? layoutData[key]
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
}

main();
