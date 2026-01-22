const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.unlinkSync(path.join(p, f));
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : null;
}

function extractParcelIdentifier($) {
  const h2 = $('h2:contains("Parcel")').first().text();
  const m = h2.match(/Parcel\s+([A-Z0-9\-]+)/i);
  return m ? m[1] : null;
}

function extractLegalDescription($) {
  let legal = null;
  const legalB = $("b")
    .filter((i, el) => $(el).text().trim() === "Legal Description")
    .first();
  if (legalB && legalB.length) {
    let texts = [];
    let node = legalB[0].nextSibling;
    while (node) {
      if (
        node.type === "tag" &&
        (node.name === "b" || node.name === "hr" || node.name === "h3")
      )
        break;
      if (node.type === "text") {
        const t = (node.data || "").replace(/\s+/g, " ").trim();
        if (t) texts.push(t);
      } else if (node.type === "tag") {
        const $n = $(node);
        let t = $n.text();
        t = (t || "").replace(/\s+/g, " ").trim();
        if (t) texts.push(t);
      }
      node = node.nextSibling;
    }
    legal = texts.filter(Boolean).join(" ").trim();
    if (legal) legal = legal.replace(/^Legal Description\s*/i, "").trim();
  }
  return legal || null;
}

function extractZoning($) {
  const landH3 = $('h3:contains("Land Lines")');
  let zone = null;
  landH3.each((i, el) => {
    const table = $(el).nextAll("div.table-responsive").first().find("table");
    const tr = table.find("tr").eq(1);
    const td = tr.find("td").eq(3);
    const z = td.text().trim();
    if (z) zone = z;
  });
  return zone || null;
}

function extractAYBYears($) {
  const years = [];
  $('h3:contains("Buildings")')
    .parent()
    .find("table")
    .each((i, tbl) => {
      const $tbl = $(tbl);
      const thead = $tbl.find("thead");
      if (!thead.length) return;
      const headerCells = thead.find("tr").last().find("th");
      let aybIndex = -1;
      headerCells.each((j, th) => {
        if ($(th).text().trim().toUpperCase() === "AYB") aybIndex = j;
      });
      if (aybIndex >= 0) {
        const row = $tbl.find("tr").eq(1);
        if (row && row.length) {
          const yTxt = row.find("td").eq(aybIndex).text().trim();
          const y = parseInt(yTxt, 10);
          if (!isNaN(y)) years.push(y);
        }
      }
    });
  return years;
}

function extractUnitsTotal($) {
  let txt = "";
  $("div").each((i, el) => {
    const t = $(el).text();
    if (t && /TOTAL\s*=\s*\d+\s*UNITS/i.test(t)) {
      txt = t;
      return false;
    }
  });
  if (txt) {
    const m = txt.match(/TOTAL\s*=\s*(\d+)\s*UNITS/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function extractDorCode($) {
  let code = null,
    label = null;
  $('b:contains("DOR Code:")').each((i, el) => {
    const a = $(el).nextAll("a").first();
    if (a && a.length) {
      const t = a.text().trim();
      const m = t.match(/^(\d+)\s*\-/);
      if (m) {
        code = m[1];
        label = t;
      }
    }
});
  return { code, label };
}

function mapDorToPropertyType(dorCode) {
  const map = {
    "00": {
      property_type: "VacantLand",
      property_usage_type: "TransitionalProperty",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "01": {
      property_type: "SingleFamily",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "SingleFamilyDetached",
    },
    "02": {
      property_type: "MobileHome",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MobileHome",
    },
    "03": {
      property_type: "MultiFamilyMoreThan10",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MultiFamilyMoreThan10",
    },
    "04": {
      property_type: "Condominium",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "Condominium",
      structure_form: "ApartmentUnit",
    },
    "05": {
      property_type: "Cooperative",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "Cooperative",
      structure_form: "ApartmentUnit",
    },
    "06": {
      property_type: "Retirement",
      property_usage_type: "Retirement",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "07": {
      property_type: "MiscellaneousResidential",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "08": {
      property_type: "MultiFamilyLessThan10",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MultiFamilyLessThan10",
    },
    "09": {
      property_type: "ResidentialCommonElementsAreas",
      property_usage_type: "ResidentialCommonElementsAreas",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "10": {
      property_type: "VacantLand",
      property_usage_type: "Commercial",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "11": {
      property_type: "Building",
      property_usage_type: "RetailStore",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "12": {
      property_type: "Building",
      property_usage_type: "Commercial",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "13": {
      property_type: "Building",
      property_usage_type: "DepartmentStore",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "14": {
      property_type: "Building",
      property_usage_type: "Supermarket",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "15": {
      property_type: "Building",
      property_usage_type: "ShoppingCenterRegional",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "16": {
      property_type: "Building",
      property_usage_type: "ShoppingCenterCommunity",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "17": {
      property_type: "Building",
      property_usage_type: "OfficeBuilding",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "18": {
      property_type: "Building",
      property_usage_type: "OfficeBuilding",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "19": {
      property_type: "Building",
      property_usage_type: "OfficeBuilding",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "20": {
      property_type: "Building",
      property_usage_type: "TransportationTerminal",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "21": {
      property_type: "Building",
      property_usage_type: "Restaurant",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "22": {
      property_type: "Building",
      property_usage_type: "Restaurant",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "23": {
      property_type: "Building",
      property_usage_type: "FinancialInstitution",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "24": {
      property_type: "Building",
      property_usage_type: "FinancialInstitution",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "25": {
      property_type: "Building",
      property_usage_type: "Commercial",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "26": {
      property_type: "Building",
      property_usage_type: "ServiceStation",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "27": {
      property_type: "Building",
      property_usage_type: "AutoSalesRepair",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "28": {
      property_type: "LandParcel",
      property_usage_type: "MobileHomePark",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "29": {
      property_type: "Building",
      property_usage_type: "WholesaleOutlet",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "30": {
      property_type: "Building",
      property_usage_type: "Ornamentals",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "31": {
      property_type: "Building",
      property_usage_type: "Theater",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "32": {
      property_type: "Building",
      property_usage_type: "Theater",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "33": {
      property_type: "Building",
      property_usage_type: "Entertainment",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "34": {
      property_type: "Building",
      property_usage_type: "Entertainment",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "35": {
      property_type: "Building",
      property_usage_type: "Entertainment",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "36": {
      property_type: "Building",
      property_usage_type: "Recreational",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "37": {
      property_type: "Building",
      property_usage_type: "Entertainment",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "38": {
      property_type: "Building",
      property_usage_type: "GolfCourse",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "39": {
      property_type: "Building",
      property_usage_type: "Hotel",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "40": {
      property_type: "VacantLand",
      property_usage_type: "Industrial",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "41": {
      property_type: "Building",
      property_usage_type: "LightManufacturing",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "42": {
      property_type: "Building",
      property_usage_type: "HeavyManufacturing",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "43": {
      property_type: "Building",
      property_usage_type: "LumberYard",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "44": {
      property_type: "Building",
      property_usage_type: "PackingPlant",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "45": {
      property_type: "Building",
      property_usage_type: "Cannery",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "46": {
      property_type: "Building",
      property_usage_type: "LightManufacturing",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "47": {
      property_type: "Building",
      property_usage_type: "MineralProcessing",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "48": {
      property_type: "Building",
      property_usage_type: "Warehouse",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "49": {
      property_type: "LandParcel",
      property_usage_type: "OpenStorage",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "50": {
      property_type: "Building",
      property_usage_type: "Agricultural",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "51": {
      property_type: "VacantLand",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "52": {
      property_type: "VacantLand",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "53": {
      property_type: "VacantLand",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "54": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "55": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "56": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "57": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "58": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "59": {
      property_type: "VacantLand",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "60": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "61": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "62": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "63": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "64": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "65": {
      property_type: "VacantLand",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "66": {
      property_type: "VacantLand",
      property_usage_type: "OrchardGroves",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "67": {
      property_type: "VacantLand",
      property_usage_type: "Poultry",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "68": {
      property_type: "VacantLand",
      property_usage_type: "Agricultural",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "69": {
      property_type: "VacantLand",
      property_usage_type: "Ornamentals",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "70": {
      property_type: "VacantLand",
      property_usage_type: "GovernmentProperty",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "71": {
      property_type: "Building",
      property_usage_type: "Church",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "72": {
      property_type: "Building",
      property_usage_type: "PrivateSchool",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "73": {
      property_type: "Building",
      property_usage_type: "PrivateHospital",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "74": {
      property_type: "Retirement",
      property_usage_type: "Retirement",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "75": {
      property_type: "Building",
      property_usage_type: "NonProfitCharity",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "76": {
      property_type: "Building",
      property_usage_type: "MortuaryCemetery",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "77": {
      property_type: "LandParcel",
      property_usage_type: "Unknown",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "78": {
      property_type: "Retirement",
      property_usage_type: "Retirement",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "79": {
      property_type: "Building",
      property_usage_type: "CulturalOrganization",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "80": {
      property_type: "VacantLand",
      property_usage_type: "GovernmentProperty",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "81": {
      property_type: "Building",
      property_usage_type: "Military",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "82": {
      property_type: "LandParcel",
      property_usage_type: "ForestParkRecreation",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "83": {
      property_type: "Building",
      property_usage_type: "PublicSchool",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "84": {
      property_type: "Building",
      property_usage_type: "CulturalOrganization",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "85": {
      property_type: "Building",
      property_usage_type: "PublicHospital",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "86": {
      property_type: "Building",
      property_usage_type: "GovernmentProperty",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "87": {
      property_type: "Building",
      property_usage_type: "GovernmentProperty",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "88": {
      property_type: "Building",
      property_usage_type: "GovernmentProperty",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "89": {
      property_type: "Building",
      property_usage_type: "GovernmentProperty",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "90": {
      property_type: "VacantLand",
      property_usage_type: "Unknown",
      build_status: null,
      ownership_estate_type: "Leasehold",
      structure_form: null,
    },
    "91": {
      property_type: "LandParcel",
      property_usage_type: "Utility",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "92": {
      property_type: "Building",
      property_usage_type: "MineralProcessing",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "93": {
      property_type: "VacantLand",
      property_usage_type: "Unknown",
      build_status: "VacantLand",
      ownership_estate_type: "SubsurfaceRights",
      structure_form: null,
    },
    "94": {
      property_type: "VacantLand",
      property_usage_type: "Unknown",
      build_status: "VacantLand",
      ownership_estate_type: "RightOfWay",
      structure_form: null,
    },
    "95": {
      property_type: "LandParcel",
      property_usage_type: "RiversLakes",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "96": {
      property_type: "LandParcel",
      property_usage_type: "TransitionalProperty",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "97": {
      property_type: "LandParcel",
      property_usage_type: "ForestParkRecreation",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "9801": {
      property_type: "Building",
      property_usage_type: "Utility",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "9802": {
      property_type: "VacantLand",
      property_usage_type: "TransportationTerminal",
      build_status: "VacantLand",
      ownership_estate_type: "RightOfWay",
      structure_form: null,
    },
    "99": {
      property_type: "VacantLand",
      property_usage_type: "TransitionalProperty",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
  };
  return map[dorCode] || null;
}

// Modified extractTopAddressBlock to be more specific
function extractTopAddressBlock($) {
  // Find the div.row that contains the parcel H2, then look for the next div.row
  // which should contain the address paragraph.
  const parcelH2 = $('h2:contains("Parcel")').first();
  if (!parcelH2.length) return [];

  const addressRow = parcelH2.closest('.row').nextAll('.row').first();
  if (!addressRow.length) return [];

  const p = addressRow.find("p").first();
  if (!p || !p.length) return [];

  const html = p.html() || "";
  const normalized = html.replace(/<br\s*\/?>/gi, "\n");
  const lines = normalized
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l && l !== "/>");
  return lines;
}


function parseFullAddressParts(fullAddress) {
  const s = ((full_address) =>
    (full_address || "").replace(/\s+/g, " ").trim())(fullAddress);
  const m = s.match(
    /(.+?)\s*([A-Z\s\-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
  );
  if (!m) return null;
  const streetPart = m[1].trim();
  const city = m[2].trim();
  const state = m[3];
  const zip = m[4];
  const plus4 = m[5] || null;
  return { streetPart, city, state, zip, plus4 };
}

function mapStreetSuffix(raw) {
  if (!raw) return null;
  const up = raw.toUpperCase();
  const map = {
    ST: "St",
    "ST.": "St",
    RD: "Rd",
    "RD.": "Rd",
    DR: "Dr",
    "DR.": "Dr",
    AVE: "Ave",
    "AVE.": "Ave",
    BLVD: "Blvd",
    "BLVD.": "Blvd",
    HWY: "Hwy",
    CT: "Ct",
    LN: "Ln",
    PL: "Pl",
    TER: "Ter",
    // Add more common suffixes if needed
  };
  if (map[up]) return map[up];
  return null; // Return null for unmapped suffixes instead of throwing an error
}

function parseCityStateZip(line) {
  if (!line) return null;
  const m = line
    .trim()
    .match(/^([A-Z \-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i);
  if (!m) return null;
  return {
    city: m[1].toUpperCase(),
    state: m[2].toUpperCase(),
    zip: m[3],
    plus4: m[4] || null,
  };
}

function parseStreetLine(line) {
  if (!line) return null;
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 1) return null;

  let street_number = null;
  let street_pre_directional_text = null;
  let street_name_tokens = [];
  let street_suffix_type = null;
  let street_post_directional_text = null;

  // Attempt to parse street number
  if (tokens.length > 0 && tokens[0].match(/^\d+$/)) {
    street_number = tokens.shift();
  }

  // Check for pre-directional (e.g., N, S, E, W)
  const directionalMap = {
    N: "N",
    S: "S",
    E: "E",
    W: "W",
    NE: "NE",
    NW: "NW",
    SE: "SE",
    SW: "SW",
  };
  if (tokens.length > 0 && directionalMap[tokens[0].toUpperCase()]) {
    street_pre_directional_text = directionalMap[tokens.shift().toUpperCase()];
  }

  // Check for post-directional (e.g., N, S, E, W) at the end
  if (tokens.length > 0 && directionalMap[tokens[tokens.length - 1].toUpperCase()]) {
    street_post_directional_text = directionalMap[tokens.pop().toUpperCase()];
  }

  // Attempt to parse street suffix from the end of remaining tokens
  if (tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1];
    const mappedSuffix = mapStreetSuffix(lastToken);
    if (mappedSuffix) {
      street_suffix_type = mappedSuffix;
      tokens.pop(); // Remove suffix if successfully mapped
    }
  }

  street_name_tokens = tokens; // Remaining tokens are the street name

  return {
    street_number: street_number,
    street_name: street_name_tokens.join(" ").trim() || null,
    street_suffix_type: street_suffix_type,
    street_pre_directional_text: street_pre_directional_text,
    street_post_directional_text: street_post_directional_text,
  };
}


function extractLandFrontDepth($) {
  const table = $('h3:contains("Land Lines")').parent().find("table").first();
  if (!table || !table.length) return { front: null, depth: null };
  const tr = table.find("tr").eq(1);
  const tds = tr.find("td");
  if (tds.length < 6) return { front: null, depth: null };

  const frontTxt = tds.eq(4).text().trim();
  const depthTxt = tds.eq(5).text().trim();

  let front = null;
  if (frontTxt) {
    const parsedFront = parseFloat(frontTxt.replace(/,/g, ""));
    if (Number.isFinite(parsedFront) && parsedFront >= 1) { // Check if >= 1
      front = Math.round(parsedFront);
    }
  }

  let depth = null;
  if (depthTxt) {
    const parsedDepth = parseFloat(depthTxt.replace(/,/g, ""));
    if (Number.isFinite(parsedDepth) && parsedDepth >= 1) { // Check if >= 1
      depth = Math.round(parsedDepth);
    }
  }

  return {
    front: front,
    depth: depth,
  };
}

function extractStructureHints($) {
  let roofDesign = null;
  let roofCoverDesc = null;
  let interiorFloorDesc = null;
  let heatingTypeDesc = null;
  let coolingTypeDesc = null;
  $("table").each((i, tbl) => {
    const rows = $(tbl).find("tr");
    rows.each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 3) {
        const elem = tds.eq(0).text().trim();
        const desc = tds.eq(2).text().trim();
        if (elem === "Roof Structure") roofDesign = desc;
        if (elem === "Roof Cover") roofCoverDesc = desc;
        if (elem === "Interior Flooring") interiorFloorDesc = desc;
        if (elem === "Heating Type") heatingTypeDesc = desc;
        if (elem === "Air Cond. Type") coolingTypeDesc = desc;
      }
    });
  });
  return {
    roofDesign,
    roofCoverDesc,
    interiorFloorDesc,
    heatingTypeDesc,
    coolingTypeDesc,
  };
}

function main() {
  ensureDir("data");
  clearDir("data");

  const inputHtml = fs.readFileSync("input.html", "utf8");
  const unnormalized = readJson("unnormalized_address.json");
  const seed = readJson("property_seed.json");

  const ownersData = readJson(path.join("owners", "owner_data.json"));
  const utilitiesData = readJson(path.join("owners", "utilities_data.json"));
  const layoutData = readJson(path.join("owners", "layout_data.json"));

  const $ = cheerio.load(inputHtml);

  const parcelIdentifier = extractParcelIdentifier($);
  const legalDesc = extractLegalDescription($);
  const zoning = extractZoning($);
  const aybYears = extractAYBYears($);
  const propertyBuiltYear = aybYears.length ? Math.min(...aybYears) : null;
  const unitsTotal = extractUnitsTotal($);
  const dor = extractDorCode($);
  const propertyTypeMapping = dor.code ? mapDorToPropertyType(dor.code) : null;

  if (!propertyTypeMapping)
    throw new Error(
      JSON.stringify({
        type: "error",
        message: `Unknown enum value for DOR Code ${dor.code || "N/A"}.`,
        path: "property.property_type",
      }),
    );

  const property = {
    area_under_air: null,
    historic_designation: false,
    livable_floor_area: null,
    number_of_units: unitsTotal || null,
    number_of_units_type: null,
    ownership_estate_type: propertyTypeMapping.ownership_estate_type,
    parcel_identifier: parcelIdentifier || (seed && seed.parcel_id) || "",
    property_effective_built_year: null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: propertyBuiltYear || null,
    property_type: propertyTypeMapping.property_type,
    property_usage_type: propertyTypeMapping.property_usage_type,
    build_status: propertyTypeMapping.build_status,
    structure_form: propertyTypeMapping.structure_form,
    subdivision: null,
    total_area: null,
    zoning: zoning || null,
    request_identifier: null, // Added as per schema
    source_http_request: { // Added as per schema
      method: "GET",
      url: seed.url || "http://example.com/property_data" // Use URL from seed.json
    }
  };
  writeJson(path.join("data", "property.json"), property);

  // Address
  const address = {
    block: null,
    city_name: null,
    country_code: "US",
    county_name:
      unnormalized && unnormalized.county_jurisdiction
        ? unnormalized.county_jurisdiction
        : null,
    latitude: null,
    longitude: null,
    lot: null,
    municipality_name: null,
    plus_four_postal_code: null,
    postal_code: null,
    range: null,
    request_identifier: null, // Added as per schema
    route_number: null,
    section: null,
    state_code: null,
    street_name: null,
    street_number: null,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_suffix_type: null,
    township: null,
    unit_identifier: null,
    source_http_request: { // Added as per schema
      method: "GET",
      url: seed.url || "http://example.com/address_data" // Use URL from seed.json
    }
  };

  let htmlAddressExtracted = false;

  // Attempt to extract address from the HTML first
  const lines = extractTopAddressBlock($);
  if (lines.length >= 2) {
    const street = parseStreetLine(lines[0]);
    const csz = parseCityStateZip(lines[1]);

    if (street && csz) { // Only consider HTML extraction successful if both street and csz are found
      address.street_number = street.street_number;
      address.street_name = street.street_name;
      address.street_suffix_type = street.street_suffix_type;
      address.street_pre_directional_text = street.street_pre_directional_text;
      address.street_post_directional_text = street.street_post_directional_text;

      address.city_name = csz.city;
      address.state_code = csz.state;
      address.postal_code = csz.zip;
      address.plus_four_postal_code = csz.plus4;
      htmlAddressExtracted = true;
    }
  }

  // Fallback to unnormalized_address.json if HTML extraction was not fully successful
  if (!htmlAddressExtracted) {
    const fullAddressFromUnnormalized = unnormalized.full_address || "";
    const parts = parseFullAddressParts(fullAddressFromUnnormalized);
    if (parts) {
      const { streetPart, city, state, zip, plus4 } = parts;

      // Fill in address components from unnormalized data
      address.city_name = (city || "").toUpperCase();
      address.state_code = state;
      address.postal_code = zip;
      address.plus_four_postal_code = plus4;

      const streetParsed = parseStreetLine(streetPart);
      if (streetParsed) {
        address.street_number = streetParsed.street_number;
        address.street_name = streetParsed.street_name;
        address.street_suffix_type = streetParsed.street_suffix_type;
        address.street_pre_directional_text = streetParsed.street_pre_directional_text;
        address.street_post_directional_text = streetParsed.street_post_directional_text;
      }
    }
  }

  // Further parsing for lot, block, section, township, range (these can come from other sections)
  // This part should be independent of the primary address extraction
  lines.forEach((line) => { // Re-use lines from extractTopAddressBlock for lot if it's there
    const m = line.match(/\bLT\s+(\w+)/i);
    if (m) address.lot = m[1];
  });
  if (legalDesc) {
    const mblk = legalDesc.match(/\bBLK\s+(\w+)/i);
    if (mblk) address.block = mblk[1];
  }
  if (parcelIdentifier) {
    const m = parcelIdentifier.match(/P\-(\d{2})\-(\d{2})\-(\d{2})/i);
    if (m) {
      address.section = m[1];
      address.township = m[2];
      address.range = m[3];
    }
  }

  // Trim city_name if it exists
  if (address.city_name !== null) {
    const trimmedCityName = address.city_name.trim();
    if (trimmedCityName === "") {
      address.city_name = null;
    } else {
      address.city_name = trimmedCityName;
    }
  }
  writeJson(path.join("data", "address.json"), address);

  // Taxes
  const valueSummary = (() => {
    const table = $('h3:contains("Value Summary")')
      .closest("div")
      .nextAll("table")
      .first();
    const map = {};
    table.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = tds.eq(0).text().trim();
        const val = tds.eq(1).text().trim();
        if (label) map[label] = val;
      }
    });
    return map;
  })();
  const taxableSummary = (() => {
    const table = $('h3:contains("Taxable Value Summary")')
      .closest("div")
      .nextAll("table")
      .first();
    const map = {};
    table.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = tds.eq(0).text().trim();
        const val = tds.eq(1).text().trim();
        if (label) map[label] = val;
      }
    });
    return map;
  })();
  const totalBuildingVal = parseCurrencyToNumber(
    valueSummary["Total Building Value"],
  );
  const totalXFVal = parseCurrencyToNumber(valueSummary["Total XF Value"]); // Added XF Value
  const totalLandVal = parseCurrencyToNumber(valueSummary["Total Land Value"]);
  const totalLandAgriVal = parseCurrencyToNumber(valueSummary["Total Land value - Agri."]); // Added Land value - Agri.
  const totalClassifiedUseVal = parseCurrencyToNumber(valueSummary["Total Classified Use Value"]); // Added Classified Use Value
  const totalJustVal = parseCurrencyToNumber(valueSummary["Total Just Value"]);
  const totalAssessed = parseCurrencyToNumber(
    taxableSummary["Total Assessed (Capped) Value"],
  );
  const totalExemptions = parseCurrencyToNumber(taxableSummary["Total Exemptions"]); // Added Total Exemptions
  const totalTaxable = parseCurrencyToNumber(
    taxableSummary["Total Taxable Value"],
  );
  const tax = {
    tax_year: new Date().getFullYear(),
    property_assessed_value_amount: totalAssessed,
    property_market_value_amount: totalJustVal,
    property_building_amount: totalBuildingVal,
    property_land_amount: totalLandVal,
    property_taxable_value_amount: totalTaxable,
    monthly_tax_amount: null,
    period_end_date: null,
    period_start_date: null,
    yearly_tax_amount: null,
    first_year_building_on_tax_roll: null,
    first_year_on_tax_roll: null
  };
  writeJson(path.join("data", "tax_1.json"), tax);

  // Sales
  const salesRows = (() => {
    const rows = [];
    const table = $('h3:contains("Sales History")')
      .parent()
      .find("table")
      .first();
    table.find("tr").each((i, tr) => {
      if (i === 0 || i === 1) return;
      const tds = $(tr).find("td");
      if (tds.length < 9) return;
      const book = tds.eq(0).text().trim();
      const page = tds.eq(1).text().trim();
      const month = tds.eq(2).text().trim();
      const year = tds.eq(3).text().trim();
      const inst = tds.eq(4).text().trim();
      const priceTxt = tds.eq(8).text().trim();
      const orLink = tds.eq(0).find("a").attr("href") || null;
      if (!year) return;
      const mm = (month && month.padStart(2, "0")) || "01";
      const dateStr = `${year}-${mm}-01`;
      const price = parseCurrencyToNumber(priceTxt);
      rows.push({ book, page, month, year, inst, price, dateStr, orLink });
    });
    return rows;
  })();

  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    writeJson(path.join("data", `sales_${saleIdx}.json`), {
      ownership_transfer_date: row.dateStr,
      purchase_price_amount: row.price,
    });
  });

  // Deeds, Files, Relationships
  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    const deedIdx = saleIdx;
    const fileIdx = saleIdx;
    const instUp = (row.inst || "").toUpperCase();
    let deedType = null;
    if (instUp === "WD") {
      deedType = "Warranty Deed";
    } else if (!instUp || instUp === "") {
      if (row.price === 1) deedType = "Quitclaim Deed";
      else deedType = "Warranty Deed";
    }
    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    writeJson(path.join("data", `deed_${deedIdx}.json`), deedObj);

    if (row.orLink) {
      writeJson(path.join("data", `file_${fileIdx}.json`), {
        file_format: "txt",
        name: `OR ${row.book}/${row.page}`,
        original_url: row.orLink,
        ipfs_url: null,
        document_type:
          deedType === "Warranty Deed"
            ? "ConveyanceDeedWarrantyDeed"
            : "ConveyanceDeed",
      });
      if (idx === 0) {
        writeJson(path.join("data", "relationship_deed_file.json"), {
          to: { "/": `./deed_${deedIdx}.json` },
          from: { "/": `./file_${fileIdx}.json` },
        });
      } else {
        writeJson(path.join("data", `relationship_deed_file_${saleIdx}.json`), {
          to: { "/": `./deed_${deedIdx}.json` },
          from: { "/": `./file_${fileIdx}.json` },
        });
      }
    }
    if (idx === 0) {
      writeJson(path.join("data", "relationship_sales_deed.json"), {
        to: { "/": `./sales_${saleIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      });
    } else {
      writeJson(path.join("data", `relationship_sales_deed_${saleIdx}.json`), {
        to: { "/": `./sales_${saleIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      });
    }
  });

  // Owners and relationship to most recent sale
  const ownerKey = `property_${parcelIdentifier}`;
  const fallbackOwnerKey = Object.keys(ownersData).find((k) =>
    k.endsWith(parcelIdentifier),
  );
  const ownerEntry = ownersData[ownerKey] || ownersData[fallbackOwnerKey];
  let ownerType = null;
  if (
    ownerEntry &&
    ownerEntry.owners_by_date &&
    ownerEntry.owners_by_date.current &&
    ownerEntry.owners_by_date.current.length
  ) {
    const o = ownerEntry.owners_by_date.current[0];
    if (o.type === "company") {
      ownerType = "company";
      writeJson(path.join("data", "company_1.json"), { name: o.name || null });
    } else if (o.type === "person") {
      ownerType = "person";
      writeJson(path.join("data", "person_1.json"), {
        birth_date: null,
        first_name: o.first_name || null,
        last_name: o.last_name || null,
        middle_name: null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      });
    }
  }
  if (ownerType && salesRows.length > 0) {
    if (ownerType === "company")
      writeJson(path.join("data", "relationship_sales_company.json"), {
        to: { "/": "./company_1.json" },
        from: { "/": "./sales_1.json" },
      });
    else
      writeJson(path.join("data", "relationship_sales_person.json"), {
        to: { "/": "./person_1.json" },
        from: { "/": "./sales_1.json" },
      });
  }

  // Utilities normalization (respect owners/utilities_data.json but adjust ElectricFurnace to Central if HTML shows Force Air)
  const utilEntryRaw =
    utilitiesData[ownerKey] || utilitiesData[fallbackOwnerKey] || null;
  const hints = extractStructureHints($);
  if (utilEntryRaw) {
    const utilOut = { ...utilEntryRaw };
    if (
      (utilOut.heating_system_type == null ||
        utilOut.heating_system_type === "ElectricFurnace") &&
      hints.heatingTypeDesc &&
      /Force\s*Air/i.test(hints.heatingTypeDesc)
    ) {
      utilOut.heating_system_type = "Central";
    }
    if (
      utilOut.cooling_system_type == null &&
      hints.coolingTypeDesc &&
      /Central/i.test(hints.coolingTypeDesc)
    ) {
      utilOut.cooling_system_type = "CentralAir";
    }
    writeJson(path.join("data", "utility.json"), {
      cooling_system_type: utilOut.cooling_system_type ?? null,
      electrical_panel_capacity: utilOut.electrical_panel_capacity ?? null,
      electrical_panel_installation_date:
        utilOut.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilOut.electrical_rewire_date ?? null,
      electrical_wiring_type: utilOut.electrical_wiring_type ?? null,
      electrical_wiring_type_other_description:
        utilOut.electrical_wiring_type_other_description ?? null,
      heating_system_type: utilOut.heating_system_type ?? null,
      hvac_capacity_kw: utilOut.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilOut.hvac_capacity_tons ?? null,
      hvac_condensing_unit_present:
        utilOut.hvac_condensing_unit_present ?? null,
      hvac_equipment_component: utilOut.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: utilOut.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilOut.hvac_equipment_model ?? null,
      hvac_installation_date: utilOut.hvac_installation_date ?? null,
      hvac_seer_rating: utilOut.hvac_seer_rating ?? null,
      hvac_system_configuration: utilOut.hvac_system_configuration ?? null,
      hvac_unit_condition: utilOut.hvac_unit_condition ?? null,
      hvac_unit_issues: utilOut.hvac_unit_issues ?? null,
      plumbing_system_installation_date:
        utilOut.plumbing_system_installation_date ?? null,
      plumbing_system_type: utilOut.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utilOut.plumbing_system_type_other_description ?? null,
      public_utility_type: utilOut.public_utility_type ?? null,
      sewer_connection_date: utilOut.sewer_connection_date ?? null,
      sewer_type: utilOut.sewer_type ?? null,
      smart_home_features: utilOut.smart_home_features ?? null,
      smart_home_features_other_description:
        utilOut.smart_home_features_other_description ?? null,
      solar_installation_date: utilOut.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utilOut.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: utilOut.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilOut.solar_inverter_model ?? null,
      solar_inverter_visible: utilOut.solar_inverter_visible ?? null,
      solar_panel_present: utilOut.solar_panel_present ?? null,
      solar_panel_type: utilOut.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utilOut.solar_panel_type_other_description ?? null,
      water_connection_date: utilOut.water_connection_date ?? null,
      water_heater_installation_date:
        utilOut.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilOut.water_heater_manufacturer ?? null,
      water_heater_model: utilOut.water_heater_model ?? null,
      water_source_type: utilOut.water_source_type ?? null,
      well_installation_date: utilOut.well_installation_date ?? null,
    });
  }

  // Layouts
  let layoutOwnerKey = `property_${parcelIdentifier}`;
  let layoutEntry = layoutData[layoutOwnerKey];
  if (!layoutEntry) {
    const k = Object.keys(layoutData).find((k) => k.endsWith(parcelIdentifier));
    if (k) layoutEntry = layoutData[k];
  }
  if (!layoutEntry) {
    let bestKey = null;
    let bestLen = -1;
    for (const [k, v] of Object.entries(layoutData)) {
      const len = Array.isArray(v.layouts) ? v.layouts.length : 0;
      if (len > bestLen) {
        bestLen = len;
        bestKey = k;
      }
    }
    if (bestKey) layoutEntry = layoutData[bestKey];
  }
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    layoutEntry.layouts.forEach((lay, idx) => {
      const layout = {
        bathroom_renovation_date: lay.bathroom_renovation_date ?? null,
        cabinet_style: lay.cabinet_style ?? null,
        clutter_level: lay.clutter_level ?? null,
        condition_issues: lay.condition_issues ?? null,
        countertop_material: lay.countertop_material ?? null,
        decor_elements: lay.decor_elements ?? null,
        design_style: lay.design_style ?? null,
        fixture_finish_quality: lay.fixture_finish_quality ?? null,
        floor_level: lay.floor_level ?? null,
        flooring_installation_date: lay.flooring_installation_date ?? null,
        flooring_material_type: lay.flooring_material_type ?? null,
        flooring_wear: lay.flooring_wear ?? null,
        furnished: lay.furnished ?? null,
        has_windows: lay.has_windows ?? null,
        is_exterior: lay.is_exterior ?? false,
        is_finished: lay.is_finished ?? false,
        kitchen_renovation_date: lay.kitchen_renovation_date ?? null,
        lighting_features: lay.lighting_features ?? null,
        natural_light_quality: lay.natural_light_quality ?? null,
        paint_condition: lay.paint_condition ?? null,
        pool_condition: lay.pool_condition ?? null,
        pool_equipment: lay.pool_equipment ?? null,
        pool_installation_date: lay.pool_installation_date ?? null,
        pool_surface_type: lay.pool_surface_type ?? null,
        pool_type: lay.pool_type ?? null,
        pool_water_quality: lay.pool_water_quality ?? null,
        safety_features: lay.safety_features ?? null,
        size_square_feet: lay.size_square_feet ?? null,
        spa_installation_date: lay.spa_installation_date ?? null,
        spa_type: lay.spa_type ?? null,
        space_index: lay.space_index,
        space_type: lay.space_type ?? null,
        view_type: lay.view_type ?? null,
        visible_damage: lay.visible_damage ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
      };
      writeJson(path.join("data", `layout_${idx + 1}.json`), layout);
    });
  }

  // Structure mapping
  const hints2 = extractStructureHints($);
  let roof_design_type = null;
  if (hints2.roofDesign) {
    if (/Gable/i.test(hints2.roofDesign)) roof_design_type = "Gable";
    else if (/Hip/i.test(hints2.roofDesign)) roof_design_type = "Hip";
  }
  let roof_covering_material = null;
  if (hints2.roofCoverDesc && /Metal/i.test(hints2.roofCoverDesc)) {
    roof_covering_material = "Metal Standing Seam";
  }
  let flooring_material_primary = null;
  if (hints2.interiorFloorDesc) {
    if (/Cork/i.test(hints2.interiorFloorDesc))
      flooring_material_primary = "Cork";
    else if (/Vinyl/i.test(hints2.interiorFloorDesc))
      flooring_material_primary = "Sheet Vinyl";
  }
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooring_material_primary,
    flooring_material_secondary: null,
    foundation_condition: null,
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
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roof_covering_material,
    roof_date: null,
    roof_design_type: roof_design_type,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
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
  // Set exterior wall and interior wall where found
  $("table").each((i, tbl) => {
    const rows = $(tbl).find("tr");
    rows.each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 3) {
        const elem = tds.eq(0).text().trim();
        const desc = tds.eq(2).text().trim();
        if (elem === "Exterior Wall" && desc === "Concrete Block")
          structure.exterior_wall_material_primary = "Concrete Block";
        if (elem === "Interior Wall" && desc === "Drywall")
          structure.interior_wall_surface_material_primary = "Drywall";
      }
    });
  });
  writeJson(path.join("data", "structure.json"), structure);

  // Lot
  const ld = extractLandFrontDepth($);
  const lot = {
    driveway_condition: null,
    driveway_material: null,
    fence_height: null,
    fence_length: null,
    fencing_type: null,
    landscaping_features: null,
    lot_area_sqft: null,
    lot_condition_issues: null,
    lot_length_feet: ld.front,
    lot_size_acre: null,
    lot_type: null,
    lot_width_feet: ld.depth,
    view: null,
  };
  writeJson(path.join("data", "lot.json"), lot);
}

try {
  main();
  console.log("Script executed successfully.");
} catch (err) {
  if (err && err.message) {
    try {
      const parsed = JSON.parse(err.message);
      console.error(JSON.stringify(parsed, null, 2));
      process.exit(1);
    } catch (_) {
      console.error(err.stack || String(err));
      process.exit(1);
    }
  } else {
    console.error(String(err));
    process.exit(1);
  }
}