// Layout mapping script
// Reads input.html, parses with cheerio, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function safeText($, sel) {
  const t = $(sel).first().text();
  return t ? t.trim() : "";
}

function normalizeSpace(value) {
  return value ? value.replace(/\s+/g, " ").trim() : value;
}

function toInt(value) {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractTwoDigitCode(value) {
  if (!value) return null;
  const match = String(value).match(/\b(\d{1,2})\b/);
  if (!match) return null;
  return match[1].padStart(2, "0");
}

const SUBAREA_CODE_ALIASES = {
  RPG: "BAS",
  RPT: "APT",
  RGR: "FGR",
  ROP: "FOP",
  RSA: "FSA",
  RUS: "FUS",
  RUP: "UOP",
};

const SUBAREA_CODE_MAP = {
  BAS: { spaceType: "Living Area", isLivable: true, isFinished: true },
  APT: { spaceType: "Living Area", isLivable: true, isFinished: true },
  FUS: { spaceType: "Living Area", isLivable: true, isFinished: true },
  FHS: { spaceType: "Living Area", isLivable: true, isFinished: true },
  FAT: { spaceType: "Attic", isFinished: true },
  FBM: { spaceType: "Basement", isFinished: true },
  FGR: { spaceType: "Attached Garage", isFinished: true, isExterior: false },
  FDG: { spaceType: "Detached Garage", isFinished: true, isExterior: false },
  UGR: { spaceType: "Attached Garage", isFinished: false, isExterior: false },
  UDG: { spaceType: "Detached Garage", isFinished: false, isExterior: false },
  FSP: { spaceType: "Screened Porch", isFinished: true, isExterior: true },
  FSA: { spaceType: "Screened Porch", isFinished: true, isExterior: true },
  UEA: { spaceType: "Enclosed Porch", isFinished: false, isExterior: true },
  FEA: { spaceType: "Enclosed Porch", isFinished: true, isExterior: true },
  FEP: { spaceType: "Enclosed Porch", isFinished: true, isExterior: true },
  UEP: { spaceType: "Enclosed Porch", isFinished: false, isExterior: true },
  FOP: { spaceType: "Open Porch", isFinished: true, isExterior: true },
  UOP: { spaceType: "Open Porch", isFinished: false, isExterior: true },
  CAN: { spaceType: "Porch", isExterior: true },
  CDN: { spaceType: "Porch", isExterior: true },
  CLP: { spaceType: "Workshop", isExterior: true },
  FCA: { spaceType: "Carport", isExterior: true, isFinished: true },
  FCP: { spaceType: "Carport", isExterior: true, isFinished: true },
  FDC: { spaceType: "Carport", isExterior: true, isFinished: true },
  UCA: { spaceType: "Carport", isExterior: true, isFinished: false },
  UCB: { spaceType: "Enclosed Cabana", isExterior: true, isFinished: false },
  UCP: { spaceType: "Carport", isExterior: true, isFinished: false },
  UDC: { spaceType: "Carport", isExterior: true, isFinished: false },
  FDS: { spaceType: "Screened Porch", isExterior: true, isFinished: true },
  FDU: { spaceType: "Storage Room", isExterior: false, isFinished: true },
  UDU: { spaceType: "Storage Room", isExterior: false, isFinished: false },
  FST: { spaceType: "Storage Room", isExterior: false, isFinished: true },
  UST: { spaceType: "Storage Room", isExterior: false, isFinished: false },
  STP: { spaceType: "Stoop", isExterior: true, isFinished: false },
  PTO: { spaceType: "Patio", isExterior: true, isFinished: false },
  SPA: { spaceType: "Workshop", isExterior: true, isFinished: true },
};

const EXTRA_FEATURE_CODE_MAP = {};

function registerExtraFeature(codes, values) {
  for (const code of codes) {
    const normalized = code.replace(/\s+/g, "").toUpperCase();
    EXTRA_FEATURE_CODE_MAP[normalized] = values;
  }
}

const EXTRA_FEATURE_DEFINITIONS = [
  {
    codes: ["RPOOL-6", "POOL-6", "POOL-6V", "POOL-9", "POOL-9V", "POOLCON", "POOLGUN"],
    spaceType: "Outdoor Pool",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["JACUZZI", "SPA", "STEAMBA", "SAUNA"],
    spaceType: "Hot Tub / Spa Area",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: false,
  },
  {
    codes: ["RCOOLDK", "COOLDK", "SUNDECK", "PLATFRM", "WDDECK", "BLEACHR", "CONCST", "BRIDGE", "BRDWALK"],
    spaceType: "Deck",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["DOCKLD", "DOCKF", "DOCKS", "BOATSLP"],
    spaceType: "Deck",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["DAVITSE", "DAVITSM"],
    spaceType: "Deck",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: false,
  },
  {
    codes: ["RSCRN-AF", "SCRN-AF", "SCRN-FF"],
    spaceType: "Screen Enclosure (Custom)",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: [
      "RDWSWC",
      "DWSWC",
      "DWSWA",
      "DWA",
      "DWC",
      "PAVASP",
      "PAVCON",
      "PARKSP",
      "BSKTCRT",
      "SHUFFLE",
      "HDBCTFP",
      "HNDBLCT",
      "TENNSCT",
      "SKATRNK",
      "RUNWAY",
      "BOATRMP",
      "JOY-LAN",
      "STADIUM",
      "ELPRKG",
      "SWWD",
      "SWA",
      "SWB",
      "SWC",
      "BRKSAN",
      "DUGOUT",
      "CLP",
      "ULP",
      "DRIVEIN",
    ],
    spaceType: "Open Courtyard",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: [
      "RCLFENCE",
      "CLFENCE",
      "DCFENCE",
      "PVCFLF",
      "PVCFSF",
      "PVCFENC",
      "WDFENCE",
      "WIFENCE",
      "RETWALL",
      "12BW",
      "4CBW",
      "4CBWS",
      "8BW",
      "8CBW",
      "8CBWS",
      "GATE",
      "GATEWI",
      "SEAWALB",
      "SEAWALC",
      "SEAWALM",
      "FOUNTIN",
      "FOUNTAIN",
      "GARDEN",
      "LIGHTDC",
      "LIGHTDM",
      "LIGHTFC",
      "LIGHTFM",
      "LIGHTSA",
      "LIGHTSC",
      "LIGHTSM",
      "LIGHTTC",
      "LIGHTTM",
    ],
    spaceType: "Courtyard",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: false,
  },
  {
    codes: ["FOA", "FOP", "UOP", "UOA"],
    spaceType: "Open Porch",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["FSP", "FSA", "FDS", "UDS", "USA", "USP"],
    spaceType: "Screened Porch",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["FEA", "FEP", "UEA", "UEP"],
    spaceType: "Enclosed Porch",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["LANAI"],
    spaceType: "Lanai",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["PATIO", "CONPTO", "BRKPTO", "FLGPTO", "TILPTO"],
    spaceType: "Patio",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["SUNROOF", "SUNROOM"],
    spaceType: "Sunroom",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["CANOPY", "PAVILLN", "SHELTER"],
    spaceType: "Pergola",
    isExterior: true,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["GAZEBO", "SHADEHS"],
    spaceType: "Gazebo",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["RFIREPL", "FIREPL", "GRILL", "SNAKBAR"],
    spaceType: "Outdoor Kitchen",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: false,
  },
  {
    codes: ["RUDU-M", "UDU-M", "UDU", "UTILITY", "PUMPHSE"],
    spaceType: "Detached Utility Closet",
    isExterior: true,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["FDU"],
    spaceType: "Detached Utility Closet",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["BOATHSE", "KENNEL", "STABLE", "STALLS", "POULTRY", "BARN", "SHOP", "SERVSHP", "TRUSSPT", "FARROW"],
    spaceType: "Workshop",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["SHED"],
    spaceType: "Shed",
    isExterior: false,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["CLDSTOR", "COOLER", "FRUITST", "FST", "UST"],
    spaceType: "Storage Room",
    isExterior: false,
    isFinished: null,
    sizeFromUnits: true,
  },
  {
    codes: ["APT", "CONDO", "MHROOF", "OLDMH", "OLDHS"],
    spaceType: "Living Area",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["FUS", "MHFUS"],
    spaceType: "Living Area",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UUS"],
    spaceType: "Living Area",
    isExterior: false,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["BEACHHS", "BATHHS"],
    spaceType: "Pool House",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["RESTRM", "RESTROOM"],
    spaceType: "Full Bathroom",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["FAT"],
    spaceType: "Attic",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["FBM"],
    spaceType: "Basement",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UBM"],
    spaceType: "Basement",
    isExterior: false,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["BAS", "BASE"],
    spaceType: "Floor",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["RFOV"],
    spaceType: "Living Area",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["CATHCE"],
    spaceType: "Living Area",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["FCA", "FCP"],
    spaceType: "Attached Carport",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["CARPORT"],
    spaceType: "Carport",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UCP"],
    spaceType: "Carport",
    isExterior: true,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["UCA"],
    spaceType: "Attached Carport",
    isExterior: true,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["FCB"],
    spaceType: "Enclosed Cabana",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UCB"],
    spaceType: "Enclosed Cabana",
    isExterior: true,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["FDA", "FDC"],
    spaceType: "Detached Carport",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UDA", "UDC"],
    spaceType: "Detached Carport",
    isExterior: true,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["FGR", "GARAGE"],
    spaceType: "Attached Garage",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UGR"],
    spaceType: "Attached Garage",
    isExterior: false,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["FDG", "HANGAR"],
    spaceType: "Detached Garage",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["UDG"],
    spaceType: "Detached Garage",
    isExterior: false,
    isFinished: false,
    sizeFromUnits: true,
  },
  {
    codes: ["ATRIUM"],
    spaceType: "Lobby / Entry Hall",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["ALRMSYS", "SPRNKFP", "PNEUTUB", "WDSTOVE"],
    spaceType: "Mechanical Room",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: false,
  },
  {
    codes: ["A/C-1", "A/C-2", "A/C-3", "A/C-4", "CAC-1", "CAC-2", "CAC-3", "CAC-4"],
    spaceType: "Mechanical Room",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: false,
  },
  {
    codes: ["AOF", "GOF", "PABOOTH", "GUARDHS"],
    spaceType: "Office Room",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["CLASSRM"],
    spaceType: "Class Room",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["COMBLDG", "MALL", "MALLXF", "PRISON", "RECBLDG", "RRCAR"],
    spaceType: "Building",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["CLUBHS", "NICHES", "MAUSUT", "SDA"],
    spaceType: "Common Room",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["GREENHS"],
    spaceType: "Greenhouse",
    isExterior: true,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["DOOR", "WALKWIN", "NITEDEP", "DRINWIN"],
    spaceType: "Lobby / Entry Hall",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["ELEVATR"],
    spaceType: "Elevator Lobby",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: true,
  },
  {
    codes: ["VAULT", "VAULTDR"],
    spaceType: "Utility Closet",
    isExterior: false,
    isFinished: true,
    sizeFromUnits: false,
  },
];

for (const def of EXTRA_FEATURE_DEFINITIONS) {
  registerExtraFeature(def.codes, {
    spaceType: def.spaceType,
    isExterior: def.isExterior,
    isFinished: def.isFinished,
    sizeFromUnits: def.sizeFromUnits,
  });
}

const AREA_SPACE_TYPES = new Set([
  "Attached Garage",
  "Detached Garage",
  "Carport",
  "Attached Carport",
  "Detached Carport",
  "Deck",
  "Patio",
  "Courtyard",
  "Open Courtyard",
  "Outdoor Pool",
  "Indoor Pool",
  "Pool Area",
  "Screen Enclosure (Custom)",
  "Screen Enclosure (2-Story)",
  "Screen Enclosure (3-Story)",
  "Screen Porch (1-Story)",
  "Screened Porch",
  "Lower Screened Porch",
  "Lanai",
  "Open Porch",
  "Enclosed Porch",
  "Terrace",
  "Balcony",
  "Pergola",
  "Gazebo",
  "Hot Tub / Spa Area",
  "Pool House",
  "Sunroom",
  "Shed",
  "Workshop",
  "Storage Room",
  "Living Area",
  "Building",
  "Basement",
  "Attic",
  "Floor",
  "Detached Utility Closet",
]);

const LAYOUT_REQUIRED_DEFAULTS = {
  flooring_material_type: null,
  size_square_feet: null,
  floor_level: null,
  has_windows: null,
  window_design_type: null,
  window_material_type: null,
  window_treatment_type: null,
  is_finished: false,
  furnished: null,
  paint_condition: null,
  flooring_wear: null,
  clutter_level: null,
  visible_damage: null,
  countertop_material: null,
  cabinet_style: null,
  fixture_finish_quality: null,
  design_style: null,
  natural_light_quality: null,
  decor_elements: null,
  pool_type: null,
  pool_equipment: null,
  spa_type: null,
  safety_features: null,
  view_type: null,
  lighting_features: null,
  condition_issues: null,
  is_exterior: false,
  pool_condition: null,
  pool_surface_type: null,
  pool_water_quality: null,
};

function createLayout(values) {
  return { ...LAYOUT_REQUIRED_DEFAULTS, ...values };
}

function normalizeSubareaCode(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (!cleaned) return null;
  return SUBAREA_CODE_ALIASES[cleaned] || cleaned;
}

function normalizeFeatureCode(raw) {
  if (!raw) return null;
  return raw.replace(/\s+/g, "").toUpperCase();
}

function inferSpaceType(description) {
  const upper = description.toUpperCase();
  if (upper.includes("GARAGE")) {
    return upper.includes("DET") ? "Detached Garage" : "Attached Garage";
  }
  if (upper.includes("APARTMENT")) return "Living Area";
  if (upper.includes("LIVING")) return "Living Area";
  if (upper.includes("SCREEN") && upper.includes("ENCL"))
    return "Screen Enclosure (Custom)";
  if (upper.includes("PORCH") && upper.includes("SCREEN"))
    return "Screened Porch";
  if (upper.includes("PORCH") && upper.includes("ENC"))
    return "Enclosed Porch";
  if (upper.includes("PORCH")) return "Open Porch";
  if (upper.includes("CARPORT")) return "Carport";
  if (upper.includes("PATIO")) return "Patio";
  if (upper.includes("WORKSHOP")) return "Workshop";
  if (upper.includes("STORAGE")) return "Storage Room";
  if (upper.includes("BATH")) return "Full Bathroom";
  return null;
}

function inferFeatureSpaceType(description) {
  if (!description) return null;
  const upper = description.toUpperCase();
  if (upper.includes("POOL")) {
    if (upper.includes("INDOOR")) return "Indoor Pool";
    if (upper.includes("SPA")) return "Hot Tub / Spa Area";
    return "Outdoor Pool";
  }
  if (upper.includes("SPA") || upper.includes("HOT TUB") || upper.includes("JACUZZI"))
    return "Hot Tub / Spa Area";
  if (upper.includes("DECK")) return "Deck";
  if (upper.includes("LANAI")) return "Lanai";
  if (upper.includes("GAZEBO")) return "Gazebo";
  if (upper.includes("PATIO")) return "Patio";
  if (upper.includes("SCREEN") && upper.includes("ENCL"))
    return "Screen Enclosure (Custom)";
  if (upper.includes("SCREEN") && upper.includes("PORCH"))
    return "Screened Porch";
  if (upper.includes("PORCH")) return "Open Porch";
  if (upper.includes("FENCE") || upper.includes("WALL")) return "Courtyard";
  if (upper.includes("DRIVE") || upper.includes("SIDEWALK"))
    return "Open Courtyard";
  if (upper.includes("FIREPLACE") || upper.includes("GRILL") || upper.includes("BBQ"))
    return "Outdoor Kitchen";
  if (upper.includes("UTILITY")) return "Detached Utility Closet";
  if (upper.includes("SHED")) return "Shed";
  if (upper.includes("WORKSHOP")) return "Workshop";
  if (upper.includes("CARPORT")) return "Carport";
  return null;
}

function inferIsExterior(code, description) {
  if (!description) return null;
  const upper = description.toUpperCase();
  if (
    ["FGR", "UGR", "FDG", "UDG", "APT", "BAS", "FUS", "FHS"].includes(code || "")
  )
    return false;
  if (
    ["FSP", "FSA", "FOP", "UOP", "UEA", "FEP", "UEP", "CAN", "CDN", "PTO", "STP"].includes(
      code || "",
    )
  )
    return true;
  if (upper.includes("PORCH") || upper.includes("PATIO")) return true;
  if (upper.includes("CARPORT") || upper.includes("CANOPY")) return true;
  if (upper.includes("GARAGE")) return !upper.includes("ATTACHED");
  return null;
}

function inferIsFinished(code, description) {
  if (!description) return null;
  const upper = description.toUpperCase();
  if (upper.includes("UNFINISH")) return false;
  if (upper.includes("FINISH")) return true;
  if (code && code.startsWith("U")) return false;
  if (code && code.startsWith("F")) return true;
  return null;
}

function expandBathroomRooms(totalBaths) {
  if (!Number.isFinite(totalBaths) || totalBaths <= 0) return [];
  const rounded = Math.round(totalBaths * 4) / 4;
  const rooms = [];
  const fullCount = Math.floor(rounded);
  for (let i = 0; i < fullCount; i += 1) {
    rooms.push({
      spaceType: "Full Bathroom",
      squareFeet: null,
      isFinished: true,
      isExterior: false,
    });
  }
  const fractional = rounded - fullCount;
  const fractionalQuarter = Math.round(fractional * 4);
  if (fractionalQuarter >= 3) {
    rooms.push({
      spaceType: "Three-Quarter Bathroom",
      squareFeet: null,
      isFinished: true,
      isExterior: false,
    });
  } else if (fractionalQuarter >= 1) {
    rooms.push({
      spaceType: "Half Bathroom / Powder Room",
      squareFeet: null,
      isFinished: true,
      isExterior: false,
    });
  }
  return rooms;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const propertySeed = readJSON(path.join(process.cwd(), "property_seed.json"));
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = safeText($, "#lblParcelID") || "unknown";
  const requestIdentifier =
    (propertySeed && propertySeed.request_identifier) || parcelId;

  const subAreaRows = [];
  $("#tblSubLines tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (tds.length < 4) return;
    const code = normalizeSubareaCode($(tds[1]).text().trim());
    const description = normalizeSpace($(tds[2]).text().trim() || "");
    const squareFeet = toInt($(tds[3]).text());
    if (!code && !description) return;
    subAreaRows.push({ code, description, squareFeet });
  });

  const extraFeatureRows = [];
  $("#tblXFLines tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (tds.length < 5) return;
    const code = normalizeFeatureCode($(tds[1]).text().trim());
    const description = normalizeSpace($(tds[2]).text().trim() || "");
    const units = toInt($(tds[4]).text());
    if (!code && !description) return;
    extraFeatureRows.push({ code, description, units });
  });

  const totalBathsValue = toFloat(safeText($, "#lblBuildingBaths"));

  const layouts = [];
  let layoutIndex = 1;

  function addLayout(data, parentFile) {
    const file = `layout_${layoutIndex}.json`;
    layouts.push({ file, parent: parentFile, data });
    layoutIndex += 1;
    return file;
  }

  if (
    subAreaRows.length > 0 ||
    extraFeatureRows.length > 0 ||
    (typeof totalBathsValue === "number" && totalBathsValue > 0)
  ) {
    let totalArea = 0;
    let livableArea = 0;
    const rooms = [];

    for (const row of subAreaRows) {
      const def = SUBAREA_CODE_MAP[row.code] || {};
      const spaceType =
        def.spaceType || inferSpaceType(row.description || "") || "Living Area";
      const isFinished = def.isFinished ?? inferIsFinished(row.code, row.description || "");
      const isExterior = def.isExterior ?? inferIsExterior(row.code, row.description || "");
      if (typeof row.squareFeet === "number") {
        totalArea += row.squareFeet;
        if (def.isLivable) livableArea += row.squareFeet;
      }
      rooms.push({
        spaceType,
        squareFeet: row.squareFeet ?? null,
        isFinished,
        isExterior,
      });
    }
    for (const row of extraFeatureRows) {
      const def = row.code ? EXTRA_FEATURE_CODE_MAP[row.code] || {} : {};
      const spaceType =
        def.spaceType ||
        inferFeatureSpaceType(row.description || "") ||
        inferSpaceType(row.description || "");
      if (!spaceType) continue;
      let sizeSquareFeet = null;
      if (def.sizeFromUnits === true && typeof row.units === "number") {
        sizeSquareFeet = row.units;
      } else if (def.sizeFromUnits !== false) {
        if (typeof row.units === "number" && AREA_SPACE_TYPES.has(spaceType)) {
          sizeSquareFeet = row.units;
        }
      }
      rooms.push({
        spaceType,
        squareFeet: sizeSquareFeet,
        isFinished:
          typeof def.isFinished === "boolean" ? def.isFinished : null,
        isExterior:
          typeof def.isExterior === "boolean" ? def.isExterior : true,
      });
    }
    const bathroomRooms = expandBathroomRooms(totalBathsValue || null);
    if (bathroomRooms.length > 0) rooms.push(...bathroomRooms);

    if (rooms.length === 0) {
      const existingOut = path.join(process.cwd(), "owners", "layout_data.json");
      if (fs.existsSync(existingOut)) fs.unlinkSync(existingOut);
      return;
    }

    const buildingNumber = 1;
    const buildingFile = addLayout(
      createLayout({
        space_type: "Building",
        space_type_index: "1",
        total_area_sq_ft: totalArea || null,
        livable_area_sq_ft: livableArea || null,
        size_square_feet: totalArea || null,
        request_identifier: requestIdentifier,
        building_number: buildingNumber,
        is_exterior: false,
      }),
      null,
    );

    let roomIndex = 1;
    const typeCounters = new Map();
    for (const room of rooms) {
      const type = room.spaceType || "Living Area";
      const typeCount = (typeCounters.get(type) || 0) + 1;
      typeCounters.set(type, typeCount);
      const spaceTypeIndex = `${buildingNumber}.${typeCount}`;
      addLayout(
        createLayout({
          space_type: room.spaceType,
          space_type_index: spaceTypeIndex,
          size_square_feet: room.squareFeet,
          is_finished:
            typeof room.isFinished === "boolean" ? room.isFinished : false,
          is_exterior:
            typeof room.isExterior === "boolean" ? room.isExterior : false,
          space_index: roomIndex,
          request_identifier: requestIdentifier,
        }),
        buildingFile,
      );
      roomIndex += 1;
    }
  }

  const ownersDir = path.join(process.cwd(), "owners");
  const outPath = path.join(ownersDir, "layout_data.json");

  if (layouts.length === 0) {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    return;
  }

  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });
  const out = {};
  out[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf-8");
})();
