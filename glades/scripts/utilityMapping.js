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
const EXTRA_FEATURES_SELECTOR="#ctlBodyPane_ctl04_ctl01_grdSales_grdFlat";

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

function mapUtilityValues(building, extraSewer, extraWater) {
  const cooling_system_type = mapCoolingSystem(building["Air Conditioning"]);
  const heating_system_type = mapHeatingSystem(building["Heat"]);
  const plumbing_system_type = mapPlumbingSystem(building["Plumbing"]);
  const electrical_wiring_type = mapElectricalWiring(building["Electrical"]);
  const hvac_condensing_unit_present =
    cooling_system_type === "CentralAir" ? "Yes" : null;

  return {
    cooling_system_type,
    heating_system_type,
    hvac_condensing_unit_present,
    sewer_type: extraSewer ?? null,
    water_source_type: extraWater ?? null,
    plumbing_system_type,
    electrical_wiring_type
  };
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

function baseUtility(parcelId, buildingNumber, totalBuildings) {
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
    building_number: buildingNumber,
    number_of_buildings: totalBuildings ?? null,
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
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
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

function buildUtilityRecord(building, parcelId, buildingNumber, totalBuildings, extraSewer, extraWater) {
  const mapped = mapUtilityValues(building, extraSewer, extraWater);
  
  return {
    ...baseUtility(parcelId, buildingNumber, totalBuildings),
    cooling_system_type: mapped.cooling_system_type,
    heating_system_type: mapped.heating_system_type,
    sewer_type: mapped.sewer_type,
    water_source_type: mapped.water_source_type,
    plumbing_system_type: mapped.plumbing_system_type,
    electrical_wiring_type: mapped.electrical_wiring_type,
    hvac_condensing_unit_present: mapped.hvac_condensing_unit_present,
  };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const extraFeatures = collectExtraFeatures($);
  let sewer_type = null;
  let water_source_type = null;
  extraFeatures.forEach((feature) => {
    const desc = feature.Description || "";
    if (!sewer_type) sewer_type = mapSewerType(desc);
    if (!water_source_type) water_source_type = mapWaterSource(desc);
  });

  if (buildings.length === 0) {
    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "utilities_data.json");
    fs.writeFileSync(outPath, JSON.stringify([], null, 2), "utf8");
    console.log(`No buildings found. Wrote empty array to ${outPath}`);
    return;
  }

  const totalBuildings = buildings.length;
  const utilities = buildings.map((building, idx) =>
    buildUtilityRecord(
      building,
      parcelId,
      idx + 1,
      totalBuildings,
      sewer_type,
      water_source_type,
    ),
  );

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { utilities };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
