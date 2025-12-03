const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const DEED_TYPE_MAP = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  QCD: "Quitclaim Deed",
  QC: "Quitclaim Deed",
  QUITCLAIM: "Quitclaim Deed",
  "QUITCLAIM DEED": "Quitclaim Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TODD: "Transfer on Death Deed",
  SD: "Sheriff's Deed",
  "SHRF'S DEED": "Sheriff's Deed",
  TD: "Tax Deed",
  TRD: "Trustee's Deed",
  "TRUSTEE DEED": "Trustee's Deed",
  PRD: "Personal Representative Deed",
  "PERS REP DEED": "Personal Representative Deed",
  CD: "Correction Deed",
  "CORR DEED": "Correction Deed",
  DIL: "Deed in Lieu of Foreclosure",
  DILF: "Deed in Lieu of Foreclosure",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  "GIFT DEED": "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  "WILD D": "Wild Deed",
  SMD: "Special Master’s Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  RD: "Receiver's Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ROC: "Release of Contract",
  LC: "Land Contract",
  MTG: "Mortgage",
  LIS: "Lis Pendens",
  EASE: "Easement",
  AGMT: "Agreement",
  AFF: "Affidavit",
  ORD: "Order",
  CERT: "Certificate",
  RES: "Resolution",
  DECL: "Declaration",
  COV: "Covenant",
  SUB: "Subordination",
  MOD: "Modification",
  REL: "Release",
  ASSG: "Assignment",
  LEAS: "Lease",
  TR: "Trust",
  WILL: "Will",
  PROB: "Probate",
  JUDG: "Judgment",
  LIEN: "Lien",
  SAT: "Satisfaction",
  PART: "Partition",
  EXCH: "Exchange",
  CONV: "Conveyance",
  OTH: "Other",
};

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

function writeRelationshipFile(filename, fromPath, toPath) {
  writeJson(path.join("data", filename), {
    from: { "/": fromPath },
    to: { "/": toPath },
  });
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : null;
}

function findCurrencyByAllKeywords(map, keywords) {
  if (!map) return null;
  const normalizedKeywords = keywords.map((kw) => String(kw).toLowerCase());
  for (const [label, rawValue] of Object.entries(map)) {
    const normalizedLabel = label.replace(/\s+/g, " ").toLowerCase();
    const matches = normalizedKeywords.every((kw) =>
      normalizedLabel.includes(kw),
    );
    if (matches) {
      const parsed = parseCurrencyToNumber(rawValue);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

function findCurrencyWithCandidates(map, candidateKeywordSets) {
  if (!map) return null;
  for (const keywords of candidateKeywordSets) {
    const val = findCurrencyByAllKeywords(map, keywords);
    if (val != null) return val;
  }
  return null;
}

function assignIfNumber(target, key, value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

function mapExteriorAccentMaterial(desc) {
  if (!desc || typeof desc !== "string") return null;
  const d = desc.toLowerCase();
  if (d.includes("brick")) return "Brick Accent";
  if (d.includes("stone")) return "Stone Accent";
  if (d.includes("stucco")) return "Stucco Accent";
  if (d.includes("vinyl") || d.includes("siding")) return "Vinyl Accent";
  if (d.includes("wood") || d.includes("trim")) return "Wood Trim";
  if (d.includes("decor")) return "Decorative Block";
  if (d.includes("block") && d.includes("decorative")) return "Decorative Block";
  if (d.includes("metal") || d.includes("alum")) return "Metal Trim";
  return null;
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
      property_type: "LandParcel",
      property_usage_type: "TransitionalProperty",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "01": {
      property_type: "Building",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "SingleFamilyDetached",
    },
    "02": {
      property_type: "ManufacturedHome",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MobileHome",
    },
    "03": {
      property_type: "Building",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MultiFamilyMoreThan10",
    },
    "04": {
      property_type: "Unit",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "Condominium",
      structure_form: "ApartmentUnit",
    },
    "05": {
      property_type: "Unit",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "Cooperative",
      structure_form: "ApartmentUnit",
    },
    "06": {
      property_type: "Building",
      property_usage_type: "Retirement",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "07": {
      property_type: "Building",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "08": {
      property_type: "Building",
      property_usage_type: "Residential",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: "MultiFamilyLessThan10",
    },
    "09": {
      property_type: "LandParcel",
      property_usage_type: "ResidentialCommonElementsAreas",
      build_status: "Improved",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "10": {
      property_type: "LandParcel",
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
      property_type: "LandParcel",
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
      property_type: "LandParcel",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "52": {
      property_type: "LandParcel",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "53": {
      property_type: "LandParcel",
      property_usage_type: "DrylandCropland",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "54": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "55": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "56": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "57": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "58": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "59": {
      property_type: "LandParcel",
      property_usage_type: "TimberLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "60": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "61": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "62": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "63": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "64": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "65": {
      property_type: "LandParcel",
      property_usage_type: "GrazingLand",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "66": {
      property_type: "LandParcel",
      property_usage_type: "OrchardGroves",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "67": {
      property_type: "LandParcel",
      property_usage_type: "Poultry",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "68": {
      property_type: "LandParcel",
      property_usage_type: "Agricultural",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "69": {
      property_type: "LandParcel",
      property_usage_type: "Ornamentals",
      build_status: "VacantLand",
      ownership_estate_type: "FeeSimple",
      structure_form: null,
    },
    "70": {
      property_type: "LandParcel",
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
      property_type: "Building",
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
      property_type: "Building",
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
      property_type: "LandParcel",
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
      property_type: "LandParcel",
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
      property_type: "LandParcel",
      property_usage_type: "Unknown",
      build_status: "VacantLand",
      ownership_estate_type: "SubsurfaceRights",
      structure_form: null,
    },
    "94": {
      property_type: "LandParcel",
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
      property_type: "LandParcel",
      property_usage_type: "TransportationTerminal",
      build_status: "VacantLand",
      ownership_estate_type: "RightOfWay",
      structure_form: null,
    },
    "99": {
      property_type: "LandParcel",
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

function extractOwnerMailingAddressLines($) {
  const mailingLabel = $('b')
    .filter((_, el) => $(el).text().trim().toLowerCase() === "mailing address")
    .first();
  if (!mailingLabel.length) return [];
  const lines = [];
  let current = "";
  let node = mailingLabel[0].nextSibling;
  while (node) {
    if (node.type === "tag") {
      const name = node.name ? node.name.toLowerCase() : "";
      if (name === "b" || name === "hr") break;
      if (name === "br") {
        const text = current.trim();
        if (text) lines.push(text);
        current = "";
      } else {
        const text = $(node).text().replace(/\s+/g, " ").trim();
        if (text) current += (current ? " " : "") + text;
      }
    } else if (node.type === "text") {
      const text = (node.data || "").replace(/\s+/g, " ").trim();
      if (text) current += (current ? " " : "") + text;
    }
    node = node.nextSibling;
  }
  const tail = current.trim();
  if (tail) lines.push(tail);
  return lines.filter((line) => line && line.trim());
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
  const structureData = readJson(path.join("owners", "structure_data.json"));
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
    unnormalized_address: null,
    section: null,
    township: null,
    range: null,
    source_http_request: {
      method: "GET",
      url:
        (seed && (seed.url || (seed.source_http_request && seed.source_http_request.url))) ||
        "http://example.com/address_data",
    },
    request_identifier:
      (seed && seed.request_identifier) ||
      (unnormalized && unnormalized.request_identifier) ||
      null,
    county_name:
      (unnormalized && unnormalized.county_jurisdiction) || null,
    country_code:
      (unnormalized && unnormalized.country_code) || "US",
  };

  const addressLines = extractTopAddressBlock($).filter((line) => line);
  if (addressLines.length) {
    address.unnormalized_address = addressLines.join(", ").replace(/\s{2,}/g, " ").trim();
  }

  if (!address.unnormalized_address) {
    const rawFullAddress =
      (unnormalized && (unnormalized.unnormalized_address || unnormalized.full_address)) ||
      null;
    if (rawFullAddress) {
      address.unnormalized_address = String(rawFullAddress).trim() || null;
    }
  }
  if (address.unnormalized_address) {
    const trimmed = address.unnormalized_address.trim();
    address.unnormalized_address = trimmed.length ? trimmed : null;
  }

  const applySectionTownshipRange = (identifier) => {
    if (!identifier) return;
    if (!address.section || !address.township || !address.range) {
      const match = identifier.match(/^[A-Z]-?(\d{2})-(\d{2})-(\d{2})/i);
      if (match) {
        address.section = address.section || match[1];
        address.township = address.township || match[2];
        address.range = address.range || match[3];
        return;
      }
      const digits = identifier.replace(/[^0-9]/g, "");
      if (digits.length >= 6) {
        const rng = digits.slice(0, 2);
        const twp = digits.slice(2, 4);
        const sec = digits.slice(4, 6);
        address.range = address.range || rng;
        address.township = address.township || twp;
        address.section = address.section || sec;
      }
    }
  };
  applySectionTownshipRange(parcelIdentifier);
  if (seed && seed.parcel_id) applySectionTownshipRange(seed.parcel_id);
  if (dor && dor.label) applySectionTownshipRange(dor.label);
  // Requirement: keep section/township/range unset in the exported address payload.
  address.section = null;
  address.township = null;
  address.range = null;
  writeJson(path.join("data", "address.json"), address);

  const normalizeCoordinate = (value) => {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  };

  const geometry = {
    latitude: normalizeCoordinate(unnormalized && unnormalized.latitude),
    longitude: normalizeCoordinate(unnormalized && unnormalized.longitude),
    request_identifier:
      (seed && seed.request_identifier) ||
      (unnormalized && unnormalized.request_identifier) ||
      null,
    source_http_request: {
      method: "GET",
      url: (seed && seed.url) || "http://example.com/geometry_data",
    },
  };
  writeJson(path.join("data", "geometry.json"), geometry);
  writeRelationshipFile(
    "relationship_address_has_geometry.json",
    "./address.json",
    "./geometry.json",
  );

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
  const countyTaxableVal = findCurrencyWithCandidates(taxableSummary, [
    ["county", "taxable"],
  ]);
  const cityTaxableVal = findCurrencyWithCandidates(taxableSummary, [
    ["city", "taxable"],
    ["municipal", "taxable"],
  ]);
  const schoolTaxableVal = findCurrencyWithCandidates(taxableSummary, [
    ["school", "taxable"],
    ["school", "board", "taxable"],
  ]);
  const specialDistrictTaxableVal = findCurrencyWithCandidates(
    taxableSummary,
    [
      ["special", "taxable"],
      ["special", "district", "taxable"],
    ],
  );
  const hospitalTaxableVal = findCurrencyWithCandidates(taxableSummary, [
    ["hospital", "taxable"],
  ]);
  const collegeTaxableVal = findCurrencyWithCandidates(taxableSummary, [
    ["college", "taxable"],
  ]);
  const buildingDepreciatedVal = findCurrencyWithCandidates(valueSummary, [
    ["building", "depreciated"],
    ["building", "depr"],
  ]);
  const buildingReplacementVal = findCurrencyWithCandidates(valueSummary, [
    ["building", "replacement"],
    ["replacement", "cost"],
  ]);
  const homesteadCapLoss = findCurrencyWithCandidates(valueSummary, [
    ["homestead", "cap"],
    ["cap", "loss"],
    ["cap", "differential"],
    ["save", "our", "homes"],
  ]);
  const tax = {
    tax_year: new Date().getFullYear(),
    monthly_tax_amount: null,
    period_end_date: null,
    period_start_date: null,
    yearly_tax_amount: null,
    first_year_building_on_tax_roll: null,
    first_year_on_tax_roll: null,
    request_identifier:
      (seed && seed.request_identifier) ||
      (unnormalized && unnormalized.request_identifier) ||
      null,
    source_http_request: {
      method: "GET",
      url:
        (seed &&
          (seed.url ||
            (seed.source_http_request && seed.source_http_request.url))) ||
        "http://example.com/tax_data",
    },
  };
  assignIfNumber(
    tax,
    "property_assessed_value_amount",
    totalAssessed,
  );
  assignIfNumber(
    tax,
    "property_market_value_amount",
    totalJustVal,
  );
  assignIfNumber(
    tax,
    "property_building_amount",
    totalBuildingVal,
  );
  assignIfNumber(
    tax,
    "property_land_amount",
    totalLandVal,
  );
  assignIfNumber(
    tax,
    "property_taxable_value_amount",
    totalTaxable,
  );
  assignIfNumber(
    tax,
    "property_exemption_amount",
    totalExemptions,
  );
  assignIfNumber(
    tax,
    "agricultural_valuation_amount",
    totalLandAgriVal,
  );
  assignIfNumber(
    tax,
    "building_depreciated_value_amount",
    buildingDepreciatedVal,
  );
  assignIfNumber(
    tax,
    "building_replacement_cost_amount",
    buildingReplacementVal,
  );
  assignIfNumber(
    tax,
    "county_taxable_value_amount",
    countyTaxableVal,
  );
  assignIfNumber(
    tax,
    "city_taxable_value_amount",
    cityTaxableVal,
  );
  assignIfNumber(
    tax,
    "college_taxable_value_amount",
    collegeTaxableVal,
  );
  assignIfNumber(
    tax,
    "hospital_taxable_value_amount",
    hospitalTaxableVal,
  );
  assignIfNumber(
    tax,
    "school_taxable_value_amount",
    schoolTaxableVal,
  );
  assignIfNumber(
    tax,
    "special_district_taxable_value_amount",
    specialDistrictTaxableVal,
  );
  assignIfNumber(
    tax,
    "homestead_cap_loss_amount",
    homesteadCapLoss,
  );
  writeJson(path.join("data", "tax_1.json"), tax);

  // Sales
  const salesRows = (() => {
    const extractVolumeFromLink = (href) => {
      if (!href) return { volume: null };
      try {
        const url = new URL(href, "https://placeholder.local");
        const segments = url.pathname.split("/").filter(Boolean);
        const idx = segments.findIndex(
          (seg) => seg.toLowerCase() === "getdocumentbybookpage",
        );
        if (idx >= 0 && segments.length >= idx + 3) {
          return {
            volume: segments[idx + 1] || null,
            linkBook: segments[idx + 2] || null,
            linkPage: segments[idx + 3] || null,
          };
        }
      } catch (_) {
        // ignore malformed URLs
      }
      return { volume: null, linkBook: null, linkPage: null };
    };

    const rows = [];
    const table = $('h3:contains("Sales History")')
      .parent()
      .find("table")
      .first();
    if (!table || !table.length) return rows;
    table.find("tr").each((i, tr) => {
      if (i === 0 || i === 1) return;
      const tds = $(tr).find("td");
      if (tds.length < 9) return;
      const book = tds.eq(0).text().trim() || null;
      const page = tds.eq(1).text().trim() || null;
      const month = tds.eq(2).text().trim() || null;
      const year = tds.eq(3).text().trim() || null;
      const inst = tds.eq(4).text().trim() || null;
      const priceTxt = tds.eq(8).text().trim();
      const orLink = tds.eq(0).find("a").attr("href") || null;
      if (!year) return;
      const mm = month && /^\d+$/.test(month) ? month.padStart(2, "0") : "01";
      const dateStr = `${year}-${mm}-01`;
      const price = parseCurrencyToNumber(priceTxt);
      const { volume, linkBook, linkPage } = extractVolumeFromLink(orLink);
      rows.push({
        book,
        page,
        month,
        year,
        inst,
        price,
        dateStr,
        orLink,
        volume: volume || null,
        linkBook: linkBook || null,
        linkPage: linkPage || null,
      });
    });
    return rows;
  })();

  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    writeJson(path.join("data", `sales_history_${saleIdx}.json`), {
      ownership_transfer_date: row.dateStr,
      purchase_price_amount: row.price,
    });
  });

  // Deeds, Files, Relationships
  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    const deedIdx = saleIdx;
    const fileIdx = saleIdx;
    const instRaw = row.inst || "";
    const instNormalized = instRaw
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
    const instKey = instNormalized.replace(/\.+/g, "").trim();
    let deedType =
      DEED_TYPE_MAP[instNormalized] ||
      DEED_TYPE_MAP[instKey] ||
      DEED_TYPE_MAP[instKey.replace(/[^A-Z0-9' ]/g, "")] ||
      null;

    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    if (row.book || row.linkBook) deedObj.book = row.book || row.linkBook;
    if (row.page || row.linkPage) deedObj.page = row.page || row.linkPage;
    writeJson(path.join("data", `deed_${deedIdx}.json`), deedObj);

    if (row.orLink) {
      writeJson(path.join("data", `file_${fileIdx}.json`), {
        file_format: null,
        name: row.book && row.page ? `OR ${row.book}/${row.page}` : null,
        original_url: row.orLink,
        ipfs_url: null,
        document_type: "Title",
      });
      writeJson(
        path.join(
          "data",
          `relationship_deed_${deedIdx}_has_file_${fileIdx}.json`,
        ),
        {
          from: { "/": `./deed_${deedIdx}.json` },
          to: { "/": `./file_${fileIdx}.json` },
        },
      );
    }

    writeJson(
      path.join(
        "data",
        `relationship_sales_history_${saleIdx}_has_deed.json`,
      ),
      {
        from: { "/": `./sales_history_${saleIdx}.json` },
        to: { "/": `./deed_${deedIdx}.json` },
      },
    );
  });

  // Owners and relationship to most recent sale
  const ownerKey = `property_${parcelIdentifier}`;
  const fallbackOwnerKey = Object.keys(ownersData).find((k) =>
    k.endsWith(parcelIdentifier),
  );
  const ownerEntry = ownersData[ownerKey] || ownersData[fallbackOwnerKey];
  const currentOwners =
    (ownerEntry &&
      ownerEntry.owners_by_date &&
      ownerEntry.owners_by_date.current) ||
    [];
  const personRecords = [];
  const companyRecords = [];
  currentOwners.forEach((owner) => {
    if (!owner || !owner.type) return;
    if (owner.type === "company") {
      const fileName = `company_${companyRecords.length + 1}.json`;
      writeJson(path.join("data", fileName), {
        name: owner.name || null,
      });
      companyRecords.push({ fileName, owner });
    } else if (owner.type === "person") {
      const fileName = `person_${personRecords.length + 1}.json`;
      writeJson(path.join("data", fileName), {
        birth_date: null,
        first_name: owner.first_name || null,
        last_name: owner.last_name || null,
        middle_name: owner.middle_name || null,
        prefix_name: owner.prefix_name || null,
        suffix_name: owner.suffix_name || null,
        us_citizenship_status: null,
        veteran_status: null,
      });
      personRecords.push({ fileName, owner });
    }
  });

  if (salesRows.length > 0) {
    const latestSaleIdx = 1;
    const latestSalePath = `./sales_history_${latestSaleIdx}.json`;
    personRecords.forEach((record, idx) => {
      writeJson(
        path.join(
          "data",
          `relationship_sales_history_${latestSaleIdx}_buyer_person_${idx + 1}.json`,
        ),
        {
          from: { "/": latestSalePath },
          to: { "/": `./${record.fileName}` },
        },
      );
    });
    companyRecords.forEach((record, idx) => {
      writeJson(
        path.join(
          "data",
          `relationship_sales_history_${latestSaleIdx}_buyer_company_${idx + 1}.json`,
        ),
        {
          from: { "/": latestSalePath },
          to: { "/": `./${record.fileName}` },
        },
      );
    });
  }

  const ownerMailingLines = extractOwnerMailingAddressLines($);
  const ownerMailingAddress = ownerMailingLines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
  const mailingAddressValue = ownerMailingAddress || null;
  const mailingRequestIdentifier =
    (seed && seed.request_identifier) ||
    (unnormalized && unnormalized.request_identifier) ||
    null;
  const mailingSourceUrl =
    (seed && (seed.url || (seed.source_http_request && seed.source_http_request.url))) ||
    "http://example.com/mailing_address";

  const hasOwners = personRecords.length + companyRecords.length > 0;
  if (hasOwners) {
    const mailingFileName = "mailing_address.json";
    writeJson(path.join("data", mailingFileName), {
      unnormalized_address: mailingAddressValue,
      latitude: null,
      longitude: null,
      request_identifier: mailingRequestIdentifier,
      source_http_request: {
        method: "GET",
        url: mailingSourceUrl,
      },
    });
    personRecords.forEach((record, idx) => {
      const match = record.fileName.match(/_(\d+)\.json$/);
      const ownerIndex = match ? match[1] : String(idx + 1);
      const relName = `relationship_person_${ownerIndex}_mailing_address.json`;
      writeRelationshipFile(relName, `./${record.fileName}`, `./${mailingFileName}`);
    });
    companyRecords.forEach((record, idx) => {
      const match = record.fileName.match(/_(\d+)\.json$/);
      const ownerIndex = match ? match[1] : String(idx + 1);
      const relName = `relationship_company_${ownerIndex}_mailing_address.json`;
      writeRelationshipFile(relName, `./${record.fileName}`, `./${mailingFileName}`);
    });
  }

  const structureHints = extractStructureHints($);

  // Utilities normalization (respect owners/utilities_data.json but adjust ElectricFurnace to Central if HTML shows Force Air)
  const candidateUtilityKeys = [];
  if (ownerKey) candidateUtilityKeys.push(ownerKey);
  if (fallbackOwnerKey) candidateUtilityKeys.push(fallbackOwnerKey);
  let layoutResolvedKey = null;
  const utilIdentifierSet = new Set();
  if (parcelIdentifier) {
    utilIdentifierSet.add(
      parcelIdentifier.replace(/[^a-z0-9]/gi, "").toLowerCase(),
    );
  }
  if (seed && seed.parcel_id) {
    utilIdentifierSet.add(
      String(seed.parcel_id).replace(/[^a-z0-9]/gi, "").toLowerCase(),
    );
  }
  if (seed && seed.request_identifier) {
    utilIdentifierSet.add(
      String(seed.request_identifier).replace(/[^a-z0-9]/gi, "").toLowerCase(),
    );
  }
  let utilEntryRaw = null;
  const utilityRecords = [];
  const normalizeBuildingEntries = (entry, nestedKey) => {
    if (!entry) return [];
    const results = [];
    const candidateArray = Array.isArray(entry)
      ? entry
      : Array.isArray(entry.buildings)
        ? entry.buildings
        : Array.isArray(entry[nestedKey])
          ? entry[nestedKey]
          : null;
    if (candidateArray) {
      candidateArray.forEach((item, idx) => {
        if (!item) return;
        const buildingIndex =
          item.building_index != null
            ? String(item.building_index)
            : String(idx + 1);
        const data =
          item[nestedKey] && typeof item[nestedKey] === "object"
            ? item[nestedKey]
            : item.data && typeof item.data === "object"
              ? item.data
              : item;
        results.push({ building_index: buildingIndex, data });
      });
      return results;
    }
    results.push({
      building_index: "1",
      data:
        entry[nestedKey] && typeof entry[nestedKey] === "object"
          ? entry[nestedKey]
          : entry,
    });
    return results;
  };
  const resolveUtilityEntry = () => {
    for (const key of candidateUtilityKeys) {
      if (key && utilitiesData[key]) {
        utilEntryRaw = utilitiesData[key];
        return;
      }
    }
    Object.entries(utilitiesData).some(([key, val]) => {
      const sanitizedKey = key
        .replace(/^property_/i, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      if (utilIdentifierSet.has(sanitizedKey)) {
        utilEntryRaw = val;
        return true;
      }
      return false;
    });
  };

  resolveUtilityEntry();

  // Layouts
  let layoutOwnerKey = `property_${parcelIdentifier}`;
  let layoutEntry = layoutData[layoutOwnerKey];
  if (!layoutEntry) {
    const k = Object.keys(layoutData).find((k) => k.endsWith(parcelIdentifier));
    if (k) {
      layoutEntry = layoutData[k];
      layoutResolvedKey = k;
      candidateUtilityKeys.push(k);
      utilIdentifierSet.add(
        k.replace(/^property_/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase(),
      );
    }
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
    if (bestKey) {
      layoutEntry = layoutData[bestKey];
      layoutResolvedKey = bestKey;
      candidateUtilityKeys.push(bestKey);
      utilIdentifierSet.add(
        bestKey
          .replace(/^property_/i, "")
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase(),
      );
    }
  } else {
    layoutResolvedKey = layoutOwnerKey;
    utilIdentifierSet.add(
      layoutOwnerKey
        .replace(/^property_/i, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase(),
    );
  }
  if (layoutResolvedKey) candidateUtilityKeys.push(layoutResolvedKey);
  if (!utilEntryRaw) resolveUtilityEntry();
  if (utilEntryRaw) {
    const utilitiesByBuilding = normalizeBuildingEntries(
      utilEntryRaw,
      "utility",
    ).sort((a, b) => {
      const aIdx = Number.parseFloat(a.building_index);
      const bIdx = Number.parseFloat(b.building_index);
      if (Number.isFinite(aIdx) && Number.isFinite(bIdx)) return aIdx - bIdx;
      return String(a.building_index || "").localeCompare(
        String(b.building_index || ""),
      );
    });
    utilitiesByBuilding.forEach(({ building_index, data }) => {
      const utilOut = { ...data };
      if (
        (utilOut.heating_system_type == null ||
          utilOut.heating_system_type === "ElectricFurnace") &&
        structureHints.heatingTypeDesc &&
        /Force\s*Air/i.test(structureHints.heatingTypeDesc)
      ) {
        utilOut.heating_system_type = "Central";
      }
      if (
        utilOut.cooling_system_type == null &&
        structureHints.coolingTypeDesc &&
        /Central/i.test(structureHints.coolingTypeDesc)
      ) {
        utilOut.cooling_system_type = "CentralAir";
      }
      const utilityFileName = `utility_${utilityRecords.length + 1}.json`;
      const utilityPayload = {
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
        hvac_equipment_manufacturer:
          utilOut.hvac_equipment_manufacturer ?? null,
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
        solar_inverter_manufacturer:
          utilOut.solar_inverter_manufacturer ?? null,
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
      };
      writeJson(path.join("data", utilityFileName), utilityPayload);
      utilityRecords.push({
        fileName: utilityFileName,
        building_space_type_index: building_index || null,
        data: utilityPayload,
      });
    });
  }
  const layoutRecords = [];
  const buildingLayoutRecords = [];
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    const layoutIndexMap = new Map();
    layoutEntry.layouts.forEach((lay, idx) => {
      const fileName = `layout_${idx + 1}.json`;
      const spaceIndex = lay.space_index ?? idx + 1;
      const spaceTypeIndex =
        lay.space_type_index ??
        (typeof spaceIndex === "number" ? String(spaceIndex) : spaceIndex);
      const parentSpaceIndex = lay.parent_space_index ?? null;
      const areaUnderAir =
        lay.area_under_air_sq_ft ??
        lay.heated_area_sq_ft ??
        lay.livable_area_sq_ft ??
        null;
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
        space_index: spaceIndex,
        space_type: lay.space_type ?? null,
        space_type_index: spaceTypeIndex ?? null,
        view_type: lay.view_type ?? null,
        visible_damage: lay.visible_damage ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
        livable_area_sq_ft: lay.livable_area_sq_ft ?? null,
        total_area_sq_ft: lay.total_area_sq_ft ?? null,
        area_under_air_sq_ft: areaUnderAir,
        heated_area_sq_ft: lay.heated_area_sq_ft ?? areaUnderAir,
        building_number: lay.building_number ?? null,
        story_type: lay.story_type ?? null,
      };
      writeJson(path.join("data", fileName), layout);
      const record = { fileName, data: layout, parent_space_index: parentSpaceIndex };
      layoutRecords.push(record);
      if (
        layout.space_type &&
        layout.space_type.toLowerCase() === "building"
      ) {
        buildingLayoutRecords.push(record);
      }
      if (layout.space_type_index) {
        layoutIndexMap.set(layout.space_type_index, record);
      }
    });

    layoutRecords.forEach((record, idx) => {
      const original = layoutEntry.layouts[idx];
      const parent =
        record.parent_space_index ??
        original.parent_space_index ??
        null;
      record.parent_space_index = parent ?? null;
      if (
        parent &&
        layoutIndexMap.has(parent) &&
        layoutIndexMap.get(parent) !== record
      ) {
        const parentRecord = layoutIndexMap.get(parent);
        const relName = `relationship_${parentRecord.fileName.replace(".json", "")}_has_${record.fileName.replace(".json", "")}.json`;
        writeRelationshipFile(
          relName,
          `./${parentRecord.fileName}`,
          `./${record.fileName}`,
        );
      }
    });
  }

  // Structure mapping
  let structureEntryRaw = null;
  const resolveStructureEntry = () => {
    for (const key of candidateUtilityKeys) {
      if (key && structureData[key]) {
        structureEntryRaw = structureData[key];
        return;
      }
    }
    Object.entries(structureData).some(([key, val]) => {
      const sanitizedKey = key
        .replace(/^property_/i, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
      if (utilIdentifierSet.has(sanitizedKey)) {
        structureEntryRaw = val;
        return true;
      }
      return false;
    });
  };
  resolveStructureEntry();

  const createFallbackStructure = () => {
    let roof_design_type = null;
    if (structureHints.roofDesign) {
      if (/Gable/i.test(structureHints.roofDesign)) roof_design_type = "Gable";
      else if (/Hip/i.test(structureHints.roofDesign)) roof_design_type = "Hip";
    }
    let roof_covering_material = null;
    if (
      structureHints.roofCoverDesc &&
      /Metal/i.test(structureHints.roofCoverDesc)
    ) {
      roof_covering_material = "Metal Standing Seam";
    }
    let flooring_material_primary = null;
    if (structureHints.interiorFloorDesc) {
      if (/Cork/i.test(structureHints.interiorFloorDesc))
        flooring_material_primary = "Cork";
      else if (/Vinyl/i.test(structureHints.interiorFloorDesc))
        flooring_material_primary = "Sheet Vinyl";
    }
    const fallbackStructure = {
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
    $("table").each((i, tbl) => {
      const rows = $(tbl).find("tr");
      rows.each((ri, tr) => {
        const tds = $(tr).find("td");
        if (tds.length === 3) {
          const elem = tds.eq(0).text().trim();
          const desc = tds.eq(2).text().trim();
          if (elem === "Exterior Wall" && desc === "Concrete Block")
            fallbackStructure.exterior_wall_material_primary = "Concrete Block";
          if (elem === "Exterior Wall 2") {
            const accent = mapExteriorAccentMaterial(desc);
            if (accent) fallbackStructure.exterior_wall_material_secondary = accent;
          }
          if (elem === "Interior Wall" && desc === "Drywall")
            fallbackStructure.interior_wall_surface_material_primary = "Drywall";
        }
      });
    });
    return fallbackStructure;
  };

  const structuresByBuilding = normalizeBuildingEntries(
    structureEntryRaw,
    "structure",
  ).sort((a, b) => {
    const aIdx = Number.parseFloat(a.building_index);
    const bIdx = Number.parseFloat(b.building_index);
    if (Number.isFinite(aIdx) && Number.isFinite(bIdx)) return aIdx - bIdx;
    return String(a.building_index || "").localeCompare(
      String(b.building_index || ""),
    );
  });

  if (!structuresByBuilding.length) {
    const fallbackBuildingIndex =
      buildingLayoutRecords.length &&
      buildingLayoutRecords[0].data &&
      buildingLayoutRecords[0].data.space_type_index
        ? String(buildingLayoutRecords[0].data.space_type_index)
        : "1";
    structuresByBuilding.push({
      building_index: fallbackBuildingIndex,
      data: createFallbackStructure(),
    });
  }

  const structureRecords = [];
  structuresByBuilding.forEach(({ building_index, data }) => {
    const structureFileName = `structure_${structureRecords.length + 1}.json`;
    writeJson(path.join("data", structureFileName), data);
    structureRecords.push({
      fileName: structureFileName,
      building_space_type_index: building_index || null,
      data,
    });
  });

  // Link layouts with utilities and structures
  const propertyPath = "./property.json";
  let propertyUtilityRelCounter = 0;
  let propertyStructureRelCounter = 0;

  const addLayoutHasUtility = (layoutRecord, utilityRecord) => {
    const relName = `relationship_${layoutRecord.fileName.replace(".json", "")}_has_${utilityRecord.fileName.replace(".json", "")}.json`;
    writeRelationshipFile(
      relName,
      `./${layoutRecord.fileName}`,
      `./${utilityRecord.fileName}`,
    );
  };

  const addLayoutHasStructure = (layoutRecord, structureRecord) => {
    const relName = `relationship_${layoutRecord.fileName.replace(".json", "")}_has_${structureRecord.fileName.replace(".json", "")}.json`;
    writeRelationshipFile(
      relName,
      `./${layoutRecord.fileName}`,
      `./${structureRecord.fileName}`,
    );
  };

  const addPropertyHasUtility = (utilityRecord) => {
    propertyUtilityRelCounter += 1;
    const relName = `relationship_property_has_utility_${propertyUtilityRelCounter}.json`;
    writeRelationshipFile(relName, propertyPath, `./${utilityRecord.fileName}`);
  };

  const addPropertyHasStructure = (structureRecord) => {
    propertyStructureRelCounter += 1;
    const relName = `relationship_property_has_structure_${propertyStructureRelCounter}.json`;
    writeRelationshipFile(relName, propertyPath, `./${structureRecord.fileName}`);
  };

  const mapResourcesToLayouts = (resourceRecords, addLayoutFn, addPropertyFn) => {
    if (!resourceRecords.length) return;
    if (!buildingLayoutRecords.length) {
      resourceRecords.forEach((rec) => addPropertyFn(rec));
      return;
    }
    const layoutByIndex = new Map();
    buildingLayoutRecords.forEach((layout) => {
      const idx =
        layout.data && layout.data.space_type_index
          ? String(layout.data.space_type_index)
          : null;
      if (idx) layoutByIndex.set(idx, layout);
    });

    const matchedLayouts = new Set();
    const unmatchedResources = [];
    resourceRecords.forEach((rec) => {
      const idx =
        rec.building_space_type_index != null
          ? String(rec.building_space_type_index)
          : null;
      if (idx && layoutByIndex.has(idx)) {
        const layout = layoutByIndex.get(idx);
        addLayoutFn(layout, rec);
        matchedLayouts.add(layout);
      } else {
        unmatchedResources.push(rec);
      }
    });

    if (!unmatchedResources.length) return;

    const remainingLayouts = buildingLayoutRecords.filter(
      (layout) => !matchedLayouts.has(layout),
    );

    if (!remainingLayouts.length) {
      unmatchedResources.forEach((rec) => addPropertyFn(rec));
      return;
    }
    if (remainingLayouts.length === 1) {
      unmatchedResources.forEach((rec) =>
        addLayoutFn(remainingLayouts[0], rec),
      );
      return;
    }
    if (unmatchedResources.length === remainingLayouts.length) {
      unmatchedResources.forEach((rec, idx) =>
        addLayoutFn(remainingLayouts[idx], rec),
      );
      return;
    }
    if (unmatchedResources.length === remainingLayouts.length + 1) {
      remainingLayouts.forEach((layout, idx) =>
        addLayoutFn(layout, unmatchedResources[idx]),
      );
      unmatchedResources
        .slice(remainingLayouts.length)
        .forEach((rec) => addPropertyFn(rec));
      return;
    }
    if (unmatchedResources.length === 1) {
      addPropertyFn(unmatchedResources[0]);
      return;
    }
    unmatchedResources.forEach((rec) => addPropertyFn(rec));
  };

  mapResourcesToLayouts(
    utilityRecords,
    addLayoutHasUtility,
    addPropertyHasUtility,
  );
  mapResourcesToLayouts(
    structureRecords,
    addLayoutHasStructure,
    addPropertyHasStructure,
  );

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
