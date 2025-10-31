// Layout mapping script
// Reads input.html, extracts layout-related data and writes owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const STRUCTURE_FEATURE_CODES = new Set([
  "BF3",
  "BF4",
  "BF5",
  "BWF",
  "BN1",
  "BN3",
  "BN2",
  "BN4",
  "B10",
  "BH2",
  "BH1",
  "BSD",
  "BTS",
  "CAB",
  "CGE",
  "CF2",
  "CF3",
  "CF1",
  "CRP",
  "DUU",
  "DUW",
  "DUC",
  "DK3",
  "DK1",
  "DV2",
  "DV1",
  "DHG",
  "DOH",
  "DIW",
  "EC1",
  "EC2",
  "EC5",
  "EC6",
  "EC7",
  "EC8",
  "EC4",
  "EC3",
  "FFN",
  "GR2",
  "GR1",
  "GAZ",
  "GH2",
  "GH3",
  "GH1",
  "GH9",
  "GH5",
  "GH6",
  "GH4",
  "LPM",
  "LPC",
  "MF1",
  "MHA",
  "MHG",
  "MHL",
  "NCF",
  "HSE",
  "MHF",
  "OS2",
  "OS1",
  "PV3",
  "PV2",
  "PV4",
  "PV1",
  "PVC",
  "PVS",
  "PVW",
  "PE1",
  "PB2",
  "PB1",
  "PH1",
  "CF4",
  "CF5",
  "CF6",
  "SF2",
  "SF3",
  "RFO",
  "SAR",
  "EC9",
  "SSC",
  "GH7",
  "SH1",
  "GH8",
  "SL1",
  "STA",
  "SF1",
  "TC3",
  "TC4",
  "TC1",
  "TC2",
  "TWR",
  "TWL",
  "TWC",
  "XFT",
  "UTW",
  "UTC",
  "UTU",
  "VF3",
  "VF4",
  "VF5",
  "SF4",
  "VW1",
  "WL5",
  "WL1",
  "WL2",
  "WL3",
]);

const UTILITY_FEATURE_CODES = new Set([
  "AC5",
  "AC4",
  "AC3",
  "AC2",
  "AC1",
  "FL2",
  "FL1",
  "ATS",
  "EV1",
  "EV4",
  "EV3",
  "EV2",
  "FDR",
  "FSS",
  "FP2",
  "FP3",
  "FP4",
  "FP0",
  "FP1",
  "NDP",
  "OJG",
  "TNK",
]);

const LAYOUT_FEATURE_CODES = new Set([
  "ABR",
  "AGC",
  "AGU",
  "AUU",
  "AUC",
  "AUW",
  "BVT",
  "WC2",
  "WC3",
  "WC4",
  "CPU",
  "CPC",
  "CSA",
  "CDK",
  "EPF",
  "EFC",
  "EFW",
  "EPW",
  "EPU",
  "EUC",
  "EUW",
  "OPU",
  "OPC",
  "OPW",
  "PT1",
  "PT2",
  "PT3",
  "SP1",
  "SP2",
  "SP3",
  "SP4",
  "SP9",
  "SP5",
  "SP6",
  "SP7",
  "SP8",
  "RRK",
  "SAU",
  "SPU",
  "SPC",
  "SPW",
  "VPU",
  "VPC",
  "VPW",
  "WTT",
  "WDK",
]);

function getFeatureCategory(code) {
  if (LAYOUT_FEATURE_CODES.has(code)) return "layout";
  if (UTILITY_FEATURE_CODES.has(code)) return "utility";
  if (STRUCTURE_FEATURE_CODES.has(code)) return "structure";
  throw new Error(`Feature code ${code} is not categorized for layout mapping.`);
}

function parseNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[^0-9.+-]/g, "")
    .trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function extractExtraFeatures($) {
  const rows = $("#MainContent_frmParcelDetail_gvFeatures tr");
  if (!rows || rows.length === 0) return [];
  const features = [];
  rows.each((i, el) => {
    if (i === 0) return;
    const tds = $(el).find("td");
    if (!tds || tds.length < 5) return;
    const descriptionText = $(tds[1]).text().trim();
    if (!descriptionText) return;
    const codeMatch = descriptionText.match(/\(([A-Z0-9]+)\)\s*$/i);
    if (!codeMatch) return;
    const code = codeMatch[1].toUpperCase();
    const featureName = descriptionText.replace(/\([A-Z0-9]+\)\s*$/i, "").trim();
    const category = getFeatureCategory(code);
    const actualYearRaw = $(tds[2]).text().trim();
    const actualYear = /^\d{4}$/.test(actualYearRaw)
      ? Number(actualYearRaw)
      : null;
    const dimensionRaw = $(tds[3]).text().trim();
    const dimensionValue = parseNumber(dimensionRaw);
    features.push({
      code,
      category,
      description: featureName,
      actualYear,
      dimensionRaw,
      dimensionValue,
    });
  });
  return features;
}

function groupFeaturesByCategory($) {
  const features = extractExtraFeatures($);
  const grouped = { structure: [], utility: [], layout: [] };
  for (const feature of features) {
    const bucket = grouped[feature.category];
    if (!bucket) {
      throw new Error(`Unexpected feature category ${feature.category}`);
    }
    bucket.push(feature);
  }
  return grouped;
}

const LAYOUT_SPACE_TYPE_BY_CODE = Object.freeze({
  ABR: "Full Bathroom",
  AGC: "Attached Garage",
  AGU: "Attached Garage",
  AUU: "Utility Closet",
  AUC: "Utility Closet",
  AUW: "Utility Closet",
  WC2: "Full Bathroom",
  WC3: "Full Bathroom",
  WC4: "Full Bathroom",
  CPU: "Carport",
  CPC: "Carport",
  CSA: "Storage Room",
  CDK: "Deck",
  EPF: "Enclosed Porch",
  EFC: "Enclosed Porch",
  EFW: "Enclosed Porch",
  EPW: "Enclosed Porch",
  EPU: "Open Porch",
  EUC: "Enclosed Porch",
  EUW: "Enclosed Porch",
  OPU: "Open Porch",
  OPC: "Open Porch",
  OPW: "Open Porch",
  PT1: "Patio",
  PT2: "Patio",
  PT3: "Patio",
  RRK: "Patio",
  SP1: "Outdoor Pool",
  SP2: "Outdoor Pool",
  SP3: "Outdoor Pool",
  SP4: "Outdoor Pool",
  SP5: "Outdoor Pool",
  SP6: "Outdoor Pool",
  SP7: "Outdoor Pool",
  SP8: "Outdoor Pool",
  SP9: "Outdoor Pool",
  SAU: "Hot Tub / Spa Area",
  SPU: "Screened Porch",
  SPC: "Screened Porch",
  SPW: "Screened Porch",
  VPU: "Enclosed Porch",
  VPC: "Enclosed Porch",
  VPW: "Enclosed Porch",
  WTT: "Hot Tub / Spa Area",
  WDK: "Deck",
  BVT: "Storage Room",
});

function getLayoutSpaceType(code) {
  return LAYOUT_SPACE_TYPE_BY_CODE[code] || null;
}

function toIsoDateFromYear(year) {
  if (!year || Number.isNaN(year)) return null;
  const yr = Number(year);
  if (!Number.isInteger(yr) || yr < 1700 || yr > 2100) return null;
  return `${yr}-01-01`;
}

function extractPropertyId($) {
  const id = $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text().trim();
  if (id) return id;
  const resultsId = $(
    "#MainContent_gvParcelResults tr:nth-child(2) td:first-child",
  )
    .text()
    .trim();
  return resultsId || "unknown";
}

function getBedsBaths($) {
  let beds = null;
  let baths = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 5) {
      const bedbath = $(tds[4]).text().trim();
      if (bedbath && /\d+\s*\/\s*\d+/.test(bedbath)) {
        const parts = bedbath.split("/");
        beds = parseInt(parts[0], 10);
        baths = parseInt(parts[1], 10);
      }
    }
  });
  return { beds, baths };
}

function getAreaBreakdown($) {
  let base = null;
  let aux = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 4) {
      const areaText = $(tds[3]).text().trim();
      if (areaText && /\d+\s*\/\s*\d+/.test(areaText)) {
        const parts = areaText.split("/");
        const basePart = parts[0] || "";
        const auxPart = parts[1] || "";
        base = parseInt(basePart.replace(/[^0-9]/g, ""), 10);
        aux = parseInt(auxPart.replace(/[^0-9]/g, ""), 10);
      }
    }
  });
  return { baseArea: isNaN(base) ? null : base, auxArea: isNaN(aux) ? null : aux };
}

function makeDefaultLayout(spaceType, index, size) {
  // Fill required fields with nulls/defaults when not known
  return {
    request_identifier: null,
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: size == null ? null : size,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: true,
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
    installation_date: null,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    bathroom_renovation_date: null,
    kitchen_renovation_date: null,
    flooring_installation_date: null,
    livable_area_sq_ft: null,
    total_area_sq_ft: null,
  };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);

  const { beds, baths } = getBedsBaths($);
  const { baseArea, auxArea } = getAreaBreakdown($);

  const layouts = [];
  const totalArea =
    baseArea == null && auxArea == null
      ? null
      : (baseArea || 0) + (auxArea || 0);

  const buildingLayout = makeDefaultLayout(
    "Building",
    layouts.length + 1,
    baseArea,
  );
  buildingLayout.livable_area_sq_ft = baseArea == null ? null : baseArea;
  buildingLayout.total_area_sq_ft = totalArea;
  layouts.push(buildingLayout);
  if (beds != null) {
    for (let i = 1; i <= beds; i++) {
      layouts.push(makeDefaultLayout("Bedroom", i, null));
    }
  }
  if (baths != null) {
    for (let i = 1; i <= baths; i++) {
      layouts.push(
        makeDefaultLayout("Full Bathroom", layouts.length + 1, null),
      );
    }
  }
  // Living room entry with no property-wide sizing assumptions
  layouts.push(makeDefaultLayout("Living Room", layouts.length + 1, null));

  const { layout: layoutFeatures } = groupFeaturesByCategory($);
  if (layoutFeatures.length) {
    const spaceIndexStart = layouts.length + 1;
    layoutFeatures.forEach((feature, featureIdx) => {
      const spaceType = getLayoutSpaceType(feature.code);
      const layout = makeDefaultLayout(
        spaceType,
        spaceIndexStart + featureIdx,
        feature.dimensionValue,
      );
      layout.request_identifier = `${propertyId}::LAYOUT_FEATURE::${feature.code}::${
        featureIdx + 1
      }`;
      layout.is_exterior = inferExteriorFlag(feature);
      layout.is_finished = inferFinishedFlag(feature);
      layout.installation_date = toIsoDateFromYear(feature.actualYear);
      if (spaceType === "Outdoor Pool") {
        populatePoolAttributes(layout, feature);
      }
      if (spaceType === "Hot Tub / Spa Area") {
        layout.spa_type = feature.code === "WTT" ? "Jacuzzi" : "Heated";
        layout.is_exterior = layout.is_exterior ?? true;
      }
      layouts.push(layout);
    });
  }

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

function inferExteriorFlag(feature) {
  const exteriorCodes = new Set([
    "CPU",
    "CPC",
    "CDK",
    "EPU",
    "EUC",
    "EUW",
    "OPU",
    "OPC",
    "OPW",
    "PT1",
    "PT2",
    "PT3",
    "RRK",
    "SP1",
    "SP2",
    "SP3",
    "SP4",
    "SP5",
    "SP6",
    "SP7",
    "SP8",
    "SP9",
    "SAU",
    "SPU",
    "SPC",
    "SPW",
    "VPU",
    "VPC",
    "VPW",
    "WTT",
    "WDK",
  ]);
  if (exteriorCodes.has(feature.code)) return true;
  if (/PORCH|PATIO|POOL|DECK/i.test(feature.description)) return true;
  return null;
}

function inferFinishedFlag(feature) {
  if (/UNFIN/i.test(feature.description)) return false;
  if (/NO CONCRETE/i.test(feature.description)) return false;
  if (/CONCRETE FLOOR/i.test(feature.description)) return true;
  if (/WOOD FLOOR/i.test(feature.description)) return true;
  return null;
}

function populatePoolAttributes(layout, feature) {
  if (/VINYL/i.test(feature.description)) {
    layout.pool_type = "Vinyl";
    layout.pool_surface_type = "Vinyl Liner";
  } else if (/CUSTOM/i.test(feature.description)) {
    layout.pool_type = "BuiltIn";
    layout.pool_surface_type = "Unknown";
  } else {
    layout.pool_type = "Concrete";
    layout.pool_surface_type = "Concrete";
  }
  layout.pool_condition = "Unknown";
  layout.pool_installation_date = toIsoDateFromYear(feature.actualYear);
  layout.pool_water_quality = null;
  layout.pool_equipment = null;
}

if (require.main === module) {
  main();
}
