// Utility extractor per Elephant Lexicon schema
// - Reads input.html
// - Iterates per building to emit utility entries
// - Writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractRemixContext($) {
  let json = null;
  $("script").each((i, el) => {
    const txt = $(el).html() || "";
    const match = txt.match(/window\.__remixContext\s*=\s*(\{[\s\S]*\});?/);
    if (match && !json) {
      const candidate = match[1];
      try {
        json = JSON.parse(candidate);
      } catch (err) {
        // Retry without trailing semicolon if present
        try {
          const trimmed = candidate.trim().replace(/;$/, "");
          json = JSON.parse(trimmed);
        } catch {
          json = null;
        }
      }
    }
  });
  return json;
}

function getLoaderData(remix) {
  if (!remix || !remix.state || !remix.state.loaderData) return {};
  const data = remix.state.loaderData;
  return data["routes/_index"] || data["routes/mineral"] || {};
}

function getPropertyId($, remix, propertySeed) {
  if (propertySeed && propertySeed.parcel_id) return propertySeed.parcel_id;
  try {
    const id = remix.state.loaderData["routes/_index"].parcelInformation.number;
    if (id) return id.trim();
  } catch {}
  const h1 = $("h1").first().text();
  const m = h1.match(
    /[0-9]{2}-[0-9A-Z]{1,2}-[0-9]{2}-[0-9]{4}-[0-9]{5}-[0-9]{4}/i,
  );
  return m ? m[0] : "unknown_id";
}

function clone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : null;
}

function mapCooling(description) {
  const text = (description || "").toUpperCase();
  if (!text) return null;
  if (/GEOTHERM/.test(text)) return "GeothermalCooling";
  if (/DUCTLESS|MINI SPLIT/.test(text)) return "Ductless";
  if (/WHOLE HOUSE/.test(text)) return "WholeHouseFan";
  if (/CEILING FANS?/.test(text)) return text.includes("FANS")
    ? "CeilingFans"
    : "CeilingFan";
  if (/WINDOW|WALL UNIT/.test(text)) return "WindowAirConditioner";
  if (/ZONED|ZONE/.test(text)) return "Zoned";
  if (/HYBRID/.test(text)) return "Hybrid";
  if (/ELECTRIC/.test(text)) return "Electric";
  if (/CENTRAL/.test(text)) return "CentralAir";
  return null;
}

function mapHeating(description) {
  const text = (description || "").toUpperCase();
  if (!text) return null;
  if (/ELECTRIC FURNACE/.test(text)) return "ElectricFurnace";
  if (/GAS FURNACE/.test(text)) return "GasFurnace";
  if (/HEAT PUMP/.test(text)) return "HeatPump";
  if (/DUCTLESS|MINI SPLIT/.test(text)) return "Ductless";
  if (/RADIANT/.test(text)) return "Radiant";
  if (/SOLAR/.test(text)) return "Solar";
  if (/BASEBOARD/.test(text)) return "Baseboard";
  if (/FORCED AIR|CENTRAL/.test(text)) return "Central";
  if (/GAS/.test(text)) return "Gas";
  if (/ELECTRIC/.test(text)) return "Electric";
  return null;
}

function findComponent(components, buildingKey, categoryText) {
  const target = (categoryText || "").toUpperCase();
  return components.find((comp) => {
    const matchesBuilding =
      buildingKey == null ||
      comp.buildingKey === buildingKey ||
      comp.uniqueKey === buildingKey;
    const matchesCategory = (comp.category?.description || "")
      .toUpperCase()
      .includes(target);
    return matchesBuilding && matchesCategory;
  });
}

function buildUtilities(remixData, propertySeed) {
  const buildings = remixData?.buildings || {};
  const units = Array.isArray(buildings.units) ? buildings.units : [];
  const components = Array.isArray(buildings.components)
    ? buildings.components
    : [];

  if (!units.length) {
    return [];
  }

  const baseRequest = clone(propertySeed?.source_http_request);
  const baseIdentifier = propertySeed?.request_identifier || propertySeed?.parcel_id || null;

  return units.map((unit, idx) => {
    const buildingKey = unit.buildingKey || unit.uniqueKey || null;
    const heatComp = findComponent(components, buildingKey, "HEATING");
    const acComp = findComponent(components, buildingKey, "AIR CONDITIONING");

    return {
      source_http_request: clone(baseRequest),
      request_identifier: baseIdentifier
        ? `${baseIdentifier}__utility_${idx + 1}`
        : null,
      cooling_system_type: mapCooling(acComp?.description),
      heating_system_type: mapHeating(heatComp?.description),
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
      building_number: idx + 1,
      utility_index: idx + 1,
    };
  });
}

(function main() {
  try {
    const $ = loadHtml();
    const remix = extractRemixContext($) || {};
    const loaderData = getLoaderData(remix);
    const propertySeed = readJSON("property_seed.json");
    const parcelId = getPropertyId($, remix, propertySeed);
    const utilities = buildUtilities(loaderData, propertySeed);

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "utilities_data.json");

    const payload = {};
    payload[`property_${parcelId}`] = { utilities };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(
      `Wrote ${utilities.length} utilit${
        utilities.length === 1 ? "y" : "ies"
      } for ${parcelId} -> ${outPath}`,
    );
  } catch (err) {
    console.error("Utility mapping failed:", err.message);
    process.exitCode = 1;
  }
})();
