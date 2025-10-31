// Structure mapping script
// Reads input.html, extracts property details, and writes owners/structure_data.json per schema

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
  throw new Error(
    `Feature code ${code} is not categorized for structure mapping.`,
  );
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

const BUILDING_LIKE_STRUCTURE_CODES = new Set([
  "AGC",
  "AGU",
  "BN1",
  "BN2",
  "BN3",
  "BN4",
  "BH1",
  "BH2",
  "BSD",
  "CAB",
  "CGE",
  "DUC",
  "DUU",
  "DUW",
  "GR1",
  "GR2",
  "GAZ",
  "GH1",
  "GH2",
  "GH3",
  "GH4",
  "GH5",
  "GH6",
  "GH7",
  "GH8",
  "GH9",
  "MHA",
  "MHG",
  "MHL",
  "MHF",
  "OS1",
  "OS2",
  "PB1",
  "PB2",
  "PH1",
  "PVC",
  "PVS",
  "PVW",
  "SSC",
  "SH1",
  "SL1",
  "STA",
  "UTW",
  "UTC",
  "UTU",
  "XFT",
]);

function isBuildingLikeStructure(code) {
  return BUILDING_LIKE_STRUCTURE_CODES.has(code);
}

function toIsoDateFromYear(year) {
  if (!year || Number.isNaN(year)) return null;
  const yr = Number(year);
  if (!Number.isInteger(yr) || yr < 1700 || yr > 2100) return null;
  return `${yr}-01-01`;
}

function parseIntSafe(val) {
  try {
    if (val == null) return null;
    const n = parseInt(String(val).replace(/[^0-9.-]/g, ""), 10);
    return isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
}

function parseFloatSafe(val) {
  try {
    if (val == null) return null;
    const n = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
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

function extractBaseAux($) {
  // Look in Building Characteristics table for Area (Base/Aux) and Bed/Bath
  let base = null;
  let aux = null;
  let beds = null;
  let baths = null;
  $("#MainContent_frmParcelDetail_gvBldgs tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const areaText = $(tds[3]).text().trim();
      const bedbath = $(tds[4]).text().trim();
      if (areaText && /\d+\s*\/\s*\d+/.test(areaText)) {
        const parts = areaText.split("/");
        base = parseIntSafe(parts[0]);
        aux = parseIntSafe(parts[1]);
      }
      if (bedbath && /\d+\s*\/\s*\d+/.test(bedbath)) {
        const parts = bedbath.split("/");
        beds = parseIntSafe(parts[0]);
        baths = parseIntSafe(parts[1]);
      }
    }
  });
  return { base, aux, beds, baths };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const propertyId = extractPropertyId($);
  const { base } = extractBaseAux($);

  // Build structure object complying with schema; unknowns as null
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
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: base === null ? null : base,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
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
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
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

  const { structure: structureFeatures } = groupFeaturesByCategory($);
  const buildingFeatureCount = structureFeatures.filter((feature) =>
    isBuildingLikeStructure(feature.code),
  ).length;
  if (buildingFeatureCount > 0) {
    structure.number_of_buildings = 1 + buildingFeatureCount;
  } else if (structure.number_of_buildings == null) {
    structure.number_of_buildings = 1;
  }
  const siteImprovementArea = structureFeatures
    .filter((feature) => !isBuildingLikeStructure(feature.code))
    .reduce((acc, feature) => acc + (feature.dimensionValue || 0), 0);
  if (siteImprovementArea > 0) {
    structure.unfinished_base_area =
      (structure.unfinished_base_area || 0) + siteImprovementArea;
  }

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = structure;
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  if (structureFeatures.length) {
    const templateKeys = Object.keys(structure);
    const extraStructures = structureFeatures.map((feature, idx) => {
      const obj = {};
      templateKeys.forEach((k) => {
        obj[k] = null;
      });
      obj.request_identifier = `${propertyId}::STRUCTURE_FEATURE::${
        feature.code
      }::${idx + 1}`;
      const asIsoDate = toIsoDateFromYear(feature.actualYear);
      if (asIsoDate) obj.roof_date = asIsoDate;
      const areaValue = feature.dimensionValue || null;
      if (areaValue != null) {
        if (isBuildingLikeStructure(feature.code)) {
          obj.attachment_type = "Detached";
          obj.finished_base_area = areaValue;
        } else {
          obj.unfinished_base_area = areaValue;
        }
      }
      return obj;
    });
    const featurePath = path.join(outDir, "structure_feature_data.json");
    const structureFeatureOutput = {};
    structureFeatureOutput[key] = extraStructures;
    fs.writeFileSync(
      featurePath,
      JSON.stringify(structureFeatureOutput, null, 2),
      "utf8",
    );
  }
}

if (require.main === module) {
  main();
}
