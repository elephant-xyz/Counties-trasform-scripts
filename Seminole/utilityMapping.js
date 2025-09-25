// utilityMapping.js
// Reads input.json and produces owners/utilities_data.json matching the utility schema.
const fs = require("fs");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

try {
  const input = JSON.parse(fs.readFileSync("input.json", "utf-8"));
  const propId = input.apprId || input.parcelNumber || "unknown";

  // Infer public utilities from service areas
  const publicUtility = input.waterServiceArea ? "WaterAvailable" : null;

  // Sewer type: city service area suggests Public sewer
  const sewerType = input.sewerServiceArea ? "Public" : null;

  // Water source: assume Public if service area present
  const waterSourceType = input.waterServiceArea ? "Public" : null;

  // Plumbing permit shows REPIPE in 1999; type unknown
  const rePipe =
    Array.isArray(input.permitDetails) &&
    input.permitDetails.some((p) => /REPIPE/i.test(p.permitDesc || ""));
  const plumbingSystemType = null; // unknown from record
  const plumbingSystemInstall = rePipe
    ? input.permitDetails
        .find((p) => /REPIPE/i.test(p.permitDesc || ""))
        ?.permitDate?.slice(0, 10) || null
    : null;

  const out = {
    [`property_${propId}`]: {
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
      plumbing_system_installation_date: plumbingSystemInstall,
      plumbing_system_type: plumbingSystemType,
      plumbing_system_type_other_description: null,
      public_utility_type: publicUtility,
      sewer_connection_date: null,
      sewer_type: sewerType,
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
      water_source_type: waterSourceType,
      well_installation_date: null,
    },
  };

  ensureDir("owners");
  fs.writeFileSync("owners/utilities_data.json", JSON.stringify(out, null, 2));
  console.log("Wrote owners/utilities_data.json for", `property_${propId}`);
} catch (e) {
  console.error("Error creating utility mapping:", e.message);
  process.exit(1);
}
