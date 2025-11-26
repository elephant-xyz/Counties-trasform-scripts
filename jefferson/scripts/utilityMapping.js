// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";
const EXTRA_FEATURE_SECTION_TITLE = "Extra Features";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function parseNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function collectExtraFeatures($) {
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        EXTRA_FEATURE_SECTION_TITLE,
    )
    .first();
  if (!section.length) return [];
  const rows = section.find("table tbody tr");
  const features = [];
  rows.each((_, tr) => {
    const $tr = $(tr);
    const code = textTrim($tr.find("th").first().text());
    const tds = $tr.find("td");
    if (!tds.length) return;
    const description = textTrim($(tds[0]).text());
    const unitsText = textTrim($(tds[2]).text());
    const unitType = textTrim($(tds[3]).text()) || null;
    const yearBuilt = textTrim($(tds[4]).text()) || null;
    features.push({
      code: code || null,
      description: description || null,
      units: parseNumber(unitsText),
      raw_units_text: unitsText || null,
      unit_type: unitType,
      year_built: yearBuilt,
    });
  });
  return features;
}

function inferHVAC(buildings) {
  let cooling_system_type = null;
  let heating_system_type = null;

  buildings.forEach((b) => {
    const ac = (b["Air Conditioning"] || "").toUpperCase();
    const heat = (b["Heat"] || "").toUpperCase();
    if (ac.includes("CENTRAL")) cooling_system_type = "CentralAir";
    if (heat.includes("AIR DUCTED") || heat.includes("CENTRAL"))
      heating_system_type = "Central";
  });

  const result = {
    cooling_system_type,
    heating_system_type,
    hvac_system_configuration: null,
    hvac_equipment_component: null,
    hvac_condensing_unit_present: null,
  };
  if (cooling_system_type === "CentralAir") {
    result.hvac_system_configuration = "SplitSystem";
    result.hvac_equipment_component = "CondenserAndAirHandler";
    result.hvac_condensing_unit_present = "Yes";
  }
  return result;
}

function deriveUtilityHints(extraFeatures) {
  const hints = {
    water_source_type: null,
    sewer_type: null,
    public_utility_type: null,
  };
  extraFeatures.forEach((feature) => {
    const desc = (feature.description || "").toUpperCase();
    if (!hints.water_source_type && /WELL/.test(desc))
      hints.water_source_type = "Well";
    if (!hints.sewer_type && /SEPTIC/.test(desc))
      hints.sewer_type = "Septic";
    if (!hints.public_utility_type) {
      if (/UNDERGROUND/.test(desc)) hints.public_utility_type = "UndergroundUtilities";
      else if (/SEWER/.test(desc)) hints.public_utility_type = "SewerAvailable";
      else if (/WATER/.test(desc)) hints.public_utility_type = "WaterAvailable";
      else if (/ELECT/.test(desc)) hints.public_utility_type = "ElectricityAvailable";
      else if (/GAS/.test(desc)) hints.public_utility_type = "NaturalGasAvailable";
      else if (/CABLE/.test(desc)) hints.public_utility_type = "CableAvailable";
    }
  });
  return hints;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const hvac = inferHVAC(buildings);
  const extraFeatures = collectExtraFeatures($);
  const utilityHints = deriveUtilityHints(extraFeatures);
  const buildingUtilities = buildings.map((b, idx) => {
    const rawType = (b["Type"] || "").toUpperCase();
    const isExtra = rawType.includes("EXTRA");
    return {
      building_id: `building_${idx + 1}`,
      is_extra: isExtra,
      source_building_type: b["Type"] || null,
      utility: {
        cooling_system_type: hvac.cooling_system_type,
        heating_system_type: hvac.heating_system_type,
        hvac_system_configuration: hvac.hvac_system_configuration,
        hvac_equipment_component: hvac.hvac_equipment_component,
        hvac_condensing_unit_present: hvac.hvac_condensing_unit_present,
        public_utility_type: utilityHints.public_utility_type,
        sewer_type: utilityHints.sewer_type,
        water_source_type: utilityHints.water_source_type,
        plumbing_system_type: null,
        plumbing_system_type_other_description: null,
        electrical_panel_capacity: null,
        electrical_wiring_type: null,
        electrical_wiring_type_other_description: null,
        solar_panel_present: false,
        solar_panel_type: null,
        solar_panel_type_other_description: null,
        smart_home_features: null,
        smart_home_features_other_description: null,
        hvac_unit_condition: null,
        solar_inverter_visible: false,
        hvac_unit_issues: null,
        electrical_panel_installation_date: null,
        electrical_rewire_date: null,
        hvac_capacity_kw: null,
        hvac_capacity_tons: null,
        hvac_equipment_manufacturer: null,
        hvac_equipment_model: null,
        hvac_installation_date: null,
        hvac_seer_rating: null,
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
      },
    };
  });

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    buildings: buildingUtilities,
    extra_features: extraFeatures,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
