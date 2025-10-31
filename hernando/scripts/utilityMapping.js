// Utility mapping script
// Reads input.html, extracts utility-related hints if available, writes owners/utilities_data.json per schema

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
    `Feature code ${code} is not categorized for utility mapping.`,
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

function btusToTons(btuValue) {
  if (!btuValue) return null;
  const tons = Number(btuValue) / 12000;
  if (!Number.isFinite(tons)) return null;
  return Math.round(tons * 100) / 100;
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

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propertyId = extractPropertyId($);

  // The input HTML does not explicitly provide utility system details; set required fields with nulls or defaults where schema allows
  const utility = {
    cooling_system_type: null,
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: null,
    electrical_wiring_type_other_description: null,
    heating_system_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_inverter_visible: false,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    water_source_type: null,
    well_installation_date: null,
  };

  const { utility: utilityFeatures } = groupFeaturesByCategory($);
  if (utilityFeatures.length) {
    const acFeatures = utilityFeatures.filter((feature) =>
      /^AC\d$/i.test(feature.code),
    );
    if (acFeatures.length) {
      const totalTons = acFeatures.reduce((acc, feature) => {
        const match = feature.description.match(/(\d[\d,\.]*)\s*BTU/i);
        const btuRaw =
          match && match[1] ? parseNumber(match[1].replace(/,/g, "")) : null;
        const tons = btusToTons(btuRaw);
        return tons ? acc + tons : acc;
      }, 0);
      if (totalTons > 0) {
        utility.cooling_system_type = "CentralAir";
        utility.hvac_equipment_component = "CondenserAndAirHandler";
        utility.hvac_condensing_unit_present = true;
        utility.hvac_capacity_tons = Math.round(totalTons * 100) / 100;
      }
      const unitDescriptions = acFeatures
        .map((feature) => `${feature.code} ${feature.description}`)
        .join("; ");
      if (unitDescriptions) {
        utility.hvac_equipment_model = unitDescriptions;
      }
      const installYear = acFeatures.find((feature) => feature.actualYear);
      if (installYear && installYear.actualYear) {
        utility.hvac_installation_date = toIsoDateFromYear(
          installYear.actualYear,
        );
      }
    }

    const otherUtilities = utilityFeatures
      .filter((feature) => !/^AC\d$/i.test(feature.code))
      .map((feature) => `${feature.description} (${feature.code})`);
    if (otherUtilities.length) {
      const detailText = `Additional utility features: ${otherUtilities.join(
        "; ",
      )}`;
      if (utility.smart_home_features_other_description) {
        utility.smart_home_features_other_description += `; ${detailText}`;
      } else {
        utility.smart_home_features_other_description = detailText;
      }
    }
  }

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const key = `property_${propertyId}`;
  const output = {};
  output[key] = utility;
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

if (require.main === module) {
  main();
}