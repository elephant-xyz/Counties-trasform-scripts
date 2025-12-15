// utilityMapping.js
// Reads input.html, parses with cheerio, extracts utility data, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function extractParcelId($) {
  // Updated selector based on the provided HTML
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function buildUtilityObject() {
  // From the provided HTML, no explicit utility details are available. Populate nulls and defaults per schema.
  return {
    // Required fields (schema allows nulls/booleans as specified)
    cooling_system_type: null,
    heating_system_type: null,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: null,
    electrical_wiring_type_other_description: null,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    hvac_unit_condition: null,
    solar_inverter_visible: false,
    hvac_unit_issues: null,

    // Optional fields in schema
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    heating_fuel_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    plumbing_system_installation_date: null,
    sewer_connection_date: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    well_installation_date: null,
  };
}

function parseCurrency(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseUnits(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d.]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDimensions(text) {
  if (!text) {
    return { text: null, width: null, length: null, area: null };
  }
  const cleaned = norm(String(text).replace(/\u00a0/g, " "));
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return { text: cleaned || null, width: null, length: null, area: null };
  }
  const width = Number(match[1]);
  const length = Number(match[2]);
  const area =
    Number.isFinite(width) && Number.isFinite(length) && width > 0 && length > 0
      ? width * length
      : null;
  return {
    text: cleaned || null,
    width: Number.isFinite(width) ? width : null,
    length: Number.isFinite(length) ? length : null,
    area,
  };
}

const FEATURE_PATTERNS = {
  utility: [
    /UTILITY/i,
    /WELL/i,
    /SEPTIC/i,
    /IRRIGATION/i,
    /SPRINK/i,
    /PUMP/i,
    /POWER/i,
    /ELECTRIC/i,
    /TRANSFORMER/i,
    /GENERATOR/i,
    /WATER/i,
    /GAS/i,
  ],
  layout: [
    /PAV(E)?MENT/i,
    /PAVERS?/i,
    /PATIO/i,
    /DRIVE/i,
    /DRIVEWAY/i,
    /SIDEWALK/i,
    /SIDE WALK/i,
    /SLAB/i,
    /COURT/i,
    /TRACK/i,
    /CONCRETE/i,
    /ASPHALT/i,
    /PARKING/i,
    /APR(o)?N/i,
  ],
  structure: [
    /BUILDING/i,
    /BARN/i,
    /GARAGE/i,
    /CARPORT/i,
    /CANOPY/i,
    /SHED/i,
    /STORAGE/i,
    /PAVILION/i,
    /CABIN/i,
    /GREENHOUSE/i,
    /DOCK/i,
    /POOL/i,
    /FENCE/i,
    /HOUSE/i,
  ],
};

function classifyFeature(description) {
  const desc = description || "";
  if (!desc) return "structure";
  const isMatch = (patterns) => patterns.some((re) => re.test(desc));
  if (isMatch(FEATURE_PATTERNS.utility)) return "utility";
  if (isMatch(FEATURE_PATTERNS.layout)) return "layout";
  if (isMatch(FEATURE_PATTERNS.structure)) return "structure";
  return "structure";
}

function extractExtraFeatures($) {
  const features = [];
  const table = $("#parcelDetails_XFOBTable table.parcelDetails_insideTable").first();
  if (!table.length) return features;

  table.find("tr").each((idx, row) => {
    const tds = $(row).find("td");
    if (tds.length < 6) return;
    const codeCell = norm($(tds[0]).text());
    if (/^code$/i.test(codeCell)) return;

    const description = norm($(tds[1]).text());
    const yearBuiltRaw = norm($(tds[2]).text()).replace(/\D+/g, "");
    const value = parseCurrency($(tds[3]).text());
    const units = parseUnits($(tds[4]).text());
    const dims = parseDimensions($(tds[5]).text());

    if (!description) return;

    features.push({
      code: codeCell || null,
      description,
      year_built: yearBuiltRaw ? Number(yearBuiltRaw) : null,
      value_dollars: value,
      units: units,
      dimensions: dims.text,
      dimension_width: dims.width,
      dimension_length: dims.length,
      area_square_feet: dims.area,
      category: classifyFeature(description),
    });
  });

  return features;
}

function buildUtilityFromFeature(feature) {
  const description = feature.description || "";
  const util = {
    feature_code: feature.code,
    feature_description: description,
    feature_year_built: feature.year_built,
    feature_units: feature.units,
    feature_dimensions: feature.dimensions,
    feature_value_dollars: feature.value_dollars,
    feature_area_square_feet: feature.area_square_feet ?? null,
    public_utility_type_other_description: description || null,
  };

  if (/SEPTIC/i.test(description)) {
    util.sewer_type = "Septic";
  }
  if (/WELL/i.test(description)) {
    util.water_source_type = "Well";
  }
  if (/IRRIGATION|SPRINK/i.test(description)) {
    util.public_utility_type = "WaterAvailable";
  } else if (/ELECTRIC|POWER|TRANSFORMER|GENERATOR/i.test(description)) {
    util.public_utility_type = "ElectricityAvailable";
  } else if (/GAS/i.test(description)) {
    util.public_utility_type = "NaturalGasAvailable";
  } else if (/WATER/i.test(description)) {
    util.public_utility_type = util.public_utility_type || "WaterAvailable";
  }

  return util;
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const util = buildUtilityObject();
  const extraFeatures = extractExtraFeatures($).filter(
    (feature) => feature.category === "utility",
  );

  const extraUtilities = extraFeatures.map((feature) =>
    Object.assign({}, buildUtilityObject(), buildUtilityFromFeature(feature)),
  );

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "utilities_data.json");
  const out = {};
  out[`property_${parcelId}`] = {
    utilities: [util],
    extra_utilities: extraUtilities,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}
