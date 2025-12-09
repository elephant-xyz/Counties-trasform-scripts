// Utility mapping script
// Reads input.html, parses building hints for HVAC, and writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";
const EXTRA_FEATURES_SELECTOR="#ctlBodyPane_ctl05_ctl01_grdSales_grdFlat";

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
        BUILDING_SECTION_TITLE || textTrim($(s).find(".title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();

  if (!section.length) return buildings;
  
  $(section).find(".block-row").each((_, blockRow) => {
    const building = {};
    
    $(blockRow).find(".two-column-blocks").each((__, columnBlock) => {
      $(columnBlock).find("table tbody tr").each((___, tr) => {
        const label = textTrim($(tr).find("th strong").first().text()) || textTrim($(tr).find("td strong").first().text());
        const value = textTrim($(tr).find("td span").first().text());
        if (label) building[label] = value;
      });
    });
    
    if (Object.keys(building).length) buildings.push(building);
  });
  
  return buildings;
}

function mapCoolingSystem(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("CENTRAL") || v.includes("DUCTED")) return "CentralAir";
  if (v.includes("WINDOW")) return "WindowAirConditioner";
  if (v.includes("DUCTLESS") || v.includes("MINI SPLIT")) return "Ductless";
  if (v.includes("ELECTRIC") && !v.includes("CENTRAL")) return "Electric";
  if (v.includes("CEILING FAN")) return "CeilingFan";
  if (v.includes("WHOLE HOUSE FAN")) return "WholeHouseFan";
  if (v.includes("GEOTHERMAL")) return "GeothermalCooling";
  if (v.includes("HYBRID")) return "Hybrid";
  if (v.includes("ZONED")) return "Zoned";
  if (v.includes("NONE") || !v) return null;
  return null;
}

function mapHeatingSystem(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("ELECTRIC FURNACE")) return "ElectricFurnace";
  if (v.includes("GAS FURNACE")) return "GasFurnace";
  if (v.includes("HEAT PUMP")) return "HeatPump";
  if (v.includes("AIR DUCTED") || v.includes("CENTRAL")) return "Central";
  if (v.includes("DUCTLESS")) return "Ductless";
  if (v.includes("RADIANT")) return "Radiant";
  if (v.includes("SOLAR")) return "Solar";
  if (v.includes("BASEBOARD")) return "Baseboard";
  if (v.includes("ELECTRIC") && !v.includes("FURNACE")) return "Electric";
  if (v.includes("GAS") && !v.includes("FURNACE")) return "Gas";
  return null;
}

function mapSewerType(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("SEPTIC")) return "Septic";
  if (v.includes("PUBLIC") || v.includes("MUNICIPAL")) return "Public";
  if (v.includes("SANITARY")) return "Sanitary";
  if (v.includes("COMBINED")) return "Combined";
  return null;
}

function mapWaterSource(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("WELL")) return "Well";
  if (v.includes("AQUIFER")) return "Aquifer";
  if (v.includes("PUBLIC") || v.includes("MUNICIPAL")) return "Public";
  return null;
}

function mapPlumbingSystem(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("COPPER")) return "Copper";
  if (v.includes("PEX")) return "PEX";
  if (v.includes("PVC")) return "PVC";
  if (v.includes("GALVANIZED")) return "GalvanizedSteel";
  if (v.includes("CAST IRON")) return "CastIron";
  return null;
}

function mapElectricalWiring(value) {
  const v = (value || "").toUpperCase();
  if (v.includes("COPPER")) return "Copper";
  if (v.includes("ALUMINUM")) return "Aluminum";
  if (v.includes("KNOB") && v.includes("TUBE")) return "KnobAndTube";
  return null;
}

function collectExtraFeatures($) {
  const features = [];
  $(EXTRA_FEATURES_SELECTOR).find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("th, td");
    if (cells.length >= 2) {
      const code = textTrim($(cells[0]).text());
      const desc = textTrim($(cells[1]).text());
      if (code && desc) {
        features.push({ Code: code, Description: desc });
      }
    }
  });
  return features;
}

function createUtilityBase(parcelId) {
  return {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["851"],
        LayerID: ["15884"],
        PageTypeID: ["4"],
        PageID: ["13353"],
        Q: ["2129946726"],
        KeyValue: [parcelId]
      }
    },
    request_identifier: parcelId,
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
    heating_fuel_type: null,
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    plumbing_fixture_count: null,
    plumbing_fixture_quality: null,
    plumbing_fixture_type_primary: null,
    plumbing_system_installation_date: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    sewer_connection_date: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    well_installation_date: null,
    building_number: null,
    utility_index: null
  };
}

function deriveSiteUtilities($) {
  const site = {
    sewer_type: null,
    water_source_type: null
  };
  collectExtraFeatures($).forEach((feature) => {
    const desc = feature.Description || "";
    if (!site.sewer_type) site.sewer_type = mapSewerType(desc);
    if (!site.water_source_type) site.water_source_type = mapWaterSource(desc);
  });
  return site;
}

function buildUtilityForBuilding(building, parcelId, buildingNumber, utilityIndex, siteUtilities) {
  const utility = createUtilityBase(parcelId);
  utility.building_number = buildingNumber;
  utility.utility_index = utilityIndex;

  const cooling = mapCoolingSystem(building["Air Conditioning"]);
  utility.cooling_system_type = cooling;
  if (cooling === "CentralAir") {
    utility.hvac_condensing_unit_present = "Yes";
  }

  utility.heating_system_type = mapHeatingSystem(building["Heat"]);
  utility.plumbing_system_type = mapPlumbingSystem(building["Plumbing"]);
  utility.electrical_wiring_type = mapElectricalWiring(building["Electrical"]);

  if (!utility.sewer_type && siteUtilities.sewer_type) {
    utility.sewer_type = siteUtilities.sewer_type;
  }
  if (!utility.water_source_type && siteUtilities.water_source_type) {
    utility.water_source_type = siteUtilities.water_source_type;
  }

  return utility;
}

function buildUtilities($, parcelId, buildings) {
  const siteUtilities = deriveSiteUtilities($);
  if (!buildings.length) {
    const defaultUtility = createUtilityBase(parcelId);
    defaultUtility.utility_index = 1;
    defaultUtility.building_number = 1;
    if (siteUtilities.sewer_type) defaultUtility.sewer_type = siteUtilities.sewer_type;
    if (siteUtilities.water_source_type) defaultUtility.water_source_type = siteUtilities.water_source_type;
    return [defaultUtility];
  }

  return buildings.map((building, idx) =>
    buildUtilityForBuilding(building, parcelId, idx + 1, idx + 1, siteUtilities),
  );
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const utilities = buildUtilities($, parcelId, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { utilities };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath} with ${utilities.length} utilities`);
}

if (require.main === module) {
  main();
}
