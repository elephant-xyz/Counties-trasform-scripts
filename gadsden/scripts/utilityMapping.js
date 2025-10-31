// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue span";
const BUILDING_SECTION_TITLE = "Buildings";
const EXTRA_FEATURES_SECTION_TITLE = "Extra Features"; // Selector for the Extra Features section

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

  // Select all individual building blocks within the section
  $(section)
    .find('.module-content > .block-row') // Each block-row contains data for one building
    .each((_, blockRow) => {
      const buildingData = {};

      // Extract data from the left column
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      // Extract data from the right column (if present)
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      if (Object.keys(buildingData).length) {
        buildings.push(buildingData);
      }
    });
  return buildings;
}

function collectExtraFeatures($) {
  const features = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        EXTRA_FEATURES_SECTION_TITLE,
    )
    .first();
  if (!section.length) return features;

  $(section).find('#ctlBodyPane_ctl10_ctl01_gvwList tbody tr').each((_, tr) => {
    const description = textTrim($(tr).find('th[scope="row"]').text());
    const yearBuilt = textTrim($(tr).find('td').eq(0).text());
    const quantity = textTrim($(tr).find('td').eq(1).text());
    const units = textTrim($(tr).find('td').eq(2).text());
    if (description) {
      features.push({ description, yearBuilt, quantity, units });
    }
  });
  return features;
}

function inferHVAC(buildings) {
  let cooling_system_type = null;
  let heating_system_type = null;
  let hvac_system_configuration = null;
  let hvac_equipment_component = null;
  let hvac_condensing_unit_present = null;

  // Schema allowed values for heating_system_type:
  const HEATING_TYPES = [
    "ElectricFurnace", "Electric", "GasFurnace", "Ductless",
    "Radiant", "Solar", "HeatPump", "Central", "Baseboard", "Gas"
  ];

  // Schema allowed values for cooling_system_type:
  const COOLING_TYPES = [
    "CeilingFans", "Electric", "Ductless", "Hybrid", "CentralAir",
    "WindowAirConditioner", "WholeHouseFan", "CeilingFan",
    "GeothermalCooling", "Zoned"
  ];

  buildings.forEach((b) => {
    const ac = (b["Air Conditioning"] || "").toUpperCase();
    const heat = (b["Heat"] || "").toUpperCase(); // This field might contain general heating info
    const heatType = (b["Heat Type"] || "").toUpperCase(); // This field seems more specific in your HTML

    // --- Infer Cooling System Type ---
    if (ac.includes("CENTRAL") || heatType.includes("CENTRAL AIR")) {
      cooling_system_type = "CentralAir";
    } else if (ac.includes("WINDOW") || ac.includes("WALL UNIT")) {
      cooling_system_type = "WindowAirConditioner";
    } else if (ac.includes("DUCTLESS") || heatType.includes("MINI-SPLIT")) {
      cooling_system_type = "Ductless";
    } else if (ac.includes("GEOTHERMAL")) {
      cooling_system_type = "GeothermalCooling";
    } else if (ac.includes("ELECTRIC")) {
      // This is a bit vague, could be CentralAir (electric), WindowAC (electric), etc.
      // Prioritize more specific types first.
      cooling_system_type = cooling_system_type || "Electric";
    }
    // Add more conditions for other cooling types if found in data
    // For example, if "Ceiling Fan" is explicitly mentioned:
    // if (ac.includes("CEILING FAN")) cooling_system_type = "CeilingFan";


    // --- Infer Heating System Type ---
    if (heatType.includes("GAS FURNACE") || heat.includes("GAS FURNACE")) {
      heating_system_type = "GasFurnace";
    } else if (heatType.includes("ELECTRIC FURNACE") || heat.includes("ELECTRIC FURNACE")) {
      heating_system_type = "ElectricFurnace";
    } else if (heatType.includes("HEAT PUMP") || heat.includes("HEAT PUMP")) {
      heating_system_type = "HeatPump";
    } else if (heatType.includes("RADIANT") || heat.includes("RADIANT")) {
      heating_system_type = "Radiant";
    } else if (heatType.includes("BASEBOARD") || heat.includes("BASEBOARD")) {
      heating_system_type = "Baseboard";
    } else if (heatType.includes("DUCTLESS") || heatType.includes("MINI-SPLIT")) {
      heating_system_type = "Ductless";
    } else if (heatType.includes("SOLAR") || heat.includes("SOLAR")) {
      heating_system_type = "Solar";
    } else if (heatType.includes("CENTRAL") || heat.includes("CENTRAL")) {
      // "Central" heating is often a furnace (gas/electric) or heat pump.
      // If more specific info isn't available, "Central" is a valid schema type.
      heating_system_type = "Central";
    } else if (heatType.includes("GAS") || heat.includes("GAS")) {
      // If just "Gas" is mentioned, it's likely a GasFurnace, but "Gas" is also a schema type.
      // Use "Gas" if no "Furnace" keyword is present.
      heating_system_type = heating_system_type || "Gas";
    } else if (heatType.includes("ELECTRIC") || heat.includes("ELECTRIC")) {
      // Similar to "Gas", if just "Electric" is mentioned.
      heating_system_type = heating_system_type || "Electric";
    } else if (heatType.includes("CONVECTION")) {
      // "Convection" is a method of heat transfer, not a specific system type.
      // It often implies a forced-air furnace (gas or electric).
      // Without more info, we can try to infer based on common systems.
      // For now, let's assume it implies a "Central" system if no other type is found.
      // Or, if it's known to be a gas convection system, "GasFurnace".
      // Given the schema, "Central" is a reasonable fallback if it's a whole-house system.
      heating_system_type = heating_system_type || "Central";
    }

    // If a CentralAir cooling system is identified, it strongly suggests a split system HVAC.
    if (cooling_system_type === "CentralAir") {
      hvac_system_configuration = "SplitSystem";
      hvac_equipment_component = "CondenserAndAirHandler";
      hvac_condensing_unit_present = "Yes";
    }
    // If a HeatPump is identified for heating, it also implies a specific configuration.
    if (heating_system_type === "HeatPump") {
      hvac_system_configuration = "HeatPumpSplit"; // Or "PackagedUnit" if it's a single unit
      hvac_equipment_component = "HeatPump";
      hvac_condensing_unit_present = "Yes"; // Heat pumps have an outdoor unit
    }
    // If Ductless is identified for either, it's likely a MiniSplit
    if (cooling_system_type === "Ductless" || heating_system_type === "Ductless") {
      hvac_system_configuration = "MiniSplit";
      hvac_equipment_component = "CondenserAndAirHandler"; // Mini-splits have indoor and outdoor units
      hvac_condensing_unit_present = "Yes";
    }
  });

  return {
    cooling_system_type,
    heating_system_type,
    hvac_system_configuration,
    hvac_equipment_component,
    hvac_condensing_unit_present,
  };
}

function buildUtilityRecord($, buildings, extraFeatures) {
  const hvac = inferHVAC(buildings);
  const rec = {
    cooling_system_type: hvac.cooling_system_type,
    heating_system_type: hvac.heating_system_type,
    public_utility_type: null,
    sewer_type: null,
    water_source_type: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    electrical_panel_capacity: null,
    electrical_wiring_type: null,
    hvac_condensing_unit_present: hvac.hvac_condensing_unit_present,
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
    hvac_equipment_component: hvac.hvac_equipment_component,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: hvac.hvac_system_configuration,
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
    // Add required fields that are not inferred or are static
    request_identifier: "property_" + getParcelId($), // Assuming this is derived from parcelId
    source_http_request: { // Placeholder, adjust as needed
      method: "GET",
      url: "https://example.com/api/property/" + getParcelId($),
    },
  };

  // Check extra features for sewer and water information
  extraFeatures.forEach(feature => {
    const desc = feature.description.toUpperCase();
    if (desc.includes("SEPTIC TANK") || desc.includes("SEPTIC SYSTEM")) {
      rec.sewer_type = "Septic"; // Changed from "Septic Tank" to "Septic" to match schema enum
      // Assuming installation date from year built if available
      if (feature.yearBuilt && feature.yearBuilt !== "N/A") {
        rec.sewer_connection_date = `${feature.yearBuilt}-01-01`; // Approximate date
      }
    }
    // Add more conditions for water source if found in other samples
    if (desc.includes("WELL")) {
      rec.water_source_type = "Well";
      if (feature.yearBuilt && feature.yearBuilt !== "N/A") {
        rec.well_installation_date = `${feature.yearBuilt}-01-01`;
      }
    }
    if (desc.includes("PUBLIC WATER") || desc.includes("CITY WATER")) {
      rec.water_source_type = "Public";
      if (feature.yearBuilt && feature.yearBuilt !== "N/A") {
        rec.water_connection_date = `${feature.yearBuilt}-01-01`;
      }
    }
    // Infer public utility types based on presence of certain features
    if (rec.sewer_type === "Septic") {
      // If septic, then public sewer is likely not available
    } else {
      rec.public_utility_type = rec.public_utility_type || "SewerAvailable";
    }
    if (rec.water_source_type === "Public") {
      rec.public_utility_type = rec.public_utility_type || "WaterAvailable";
    }
    // These are just examples, you'd need more data to accurately infer all public_utility_type
  });

  // Ensure all required fields are set, even if null
  // This is crucial for schema validation if fields are required but not inferred.
  // The schema provided has many required fields, so we need to ensure they are present.
  // For fields like smart_home_features, it expects an array or null.
  if (rec.smart_home_features === null) rec.smart_home_features = [];
  // Other required fields are already initialized to null.

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const extraFeatures = collectExtraFeatures($); // Collect extra features
  const utilitiesRecord = buildUtilityRecord($, buildings, extraFeatures);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = utilitiesRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}