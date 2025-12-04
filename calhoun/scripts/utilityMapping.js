// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR = "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span"; // Corrected to target the span containing the Parcel ID
const BUILDING_SECTION_TITLE = "Building Information"; // Corrected title from HTML

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

  // Find all building blocks within the section
  const buildingBlocks = section.find(".block-row");

  buildingBlocks.each((blockIndex, blockElement) => {
    const currentBuildingData = {};

    // Collect data from the left column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    // Collect data from the right column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    if (Object.keys(currentBuildingData).length) {
      buildings.push(currentBuildingData);
    }
  });
  return buildings;
}

function inferHVACForBuilding(b) {
  let cooling_system_type = null;
  let heating_system_type = null;
  let heating_fuel_type = null;
  let hvac_system_configuration = null;
  let hvac_equipment_component = null;
  let hvac_condensing_unit_present = null;

  const ac = (b["Air Conditioning"] || "").toUpperCase();
  const heat = (b["Heat"] || "").toUpperCase();

  if (ac.includes("CENTRAL")) {
    cooling_system_type = "CentralAir";
    hvac_condensing_unit_present = "Yes";
  } else if (ac.includes("WINDOW/WALL UNIT") || ac.includes("WINDOW")) {
    cooling_system_type = "WindowAirConditioner";
    hvac_condensing_unit_present = "No";
  }

  if (heat.includes("AIR DUCTED")) {
    heating_system_type = "Central";
  } else if (heat.includes("ELECTRIC")) {
    heating_system_type = "Electric";
    heating_fuel_type = "Electric";
  } else if (heat.includes("GAS")) {
    heating_system_type = "Gas";
    heating_fuel_type = "Gas";
  } else if (heat.includes("PROPANE")) {
    heating_system_type = "Gas";
    heating_fuel_type = "Propane";
  }

  if (cooling_system_type === "CentralAir" && heating_system_type === "Central") {
    hvac_system_configuration = "SplitSystem";
    hvac_equipment_component = "CondenserAndAirHandler";
  } else if (cooling_system_type === "CentralAir") {
    hvac_equipment_component = "CondenserAndAirHandler";
  }

  return {
    cooling_system_type,
    heating_system_type,
    heating_fuel_type,
    hvac_system_configuration,
    hvac_equipment_component,
    hvac_condensing_unit_present,
  };
}

function buildUtilityRecords(parcelId, buildings) {
  return buildings.map((b, idx) => {
    const hvac = inferHVACForBuilding(b);
    const utility = {
      cooling_system_type: hvac.cooling_system_type,
      heating_system_type: hvac.heating_system_type,
      heating_fuel_type: hvac.heating_fuel_type ?? null,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      plumbing_fixture_count: null,
      plumbing_fixture_quality: null,
      plumbing_fixture_type_primary: null,
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
      request_identifier: parcelId,
    };
    return {
      building_number: idx + 1,
      utility,
    };
  });
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const utilitiesRecord = buildUtilityRecords(parcelId, buildings);

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
