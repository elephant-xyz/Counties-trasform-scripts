// Utility mapping script
// Reads input.html, parses with cheerio, builds per-building utility records,
// writes owners/utilities_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml() {
  const p = path.resolve("input.html");
  if (!fs.existsSync(p)) {
    throw new Error("input.html not found");
  }
  return fs.readFileSync(p, "utf8");
}

function text(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t.length ? t : null;
}

function getPropId($) {
  const candidates = [];
  $("section table tr").each((_, el) => {
    const $row = $(el);
    const label = text(
      $row.find("th strong, th").first().text(),
    );
    if (!label) return;
    const value = text(
      $row.find("td span, td").first().text(),
    );
    if (!value) return;
    const lower = label.toLowerCase();
    if (lower.includes("parcel id")) {
      candidates.push({ priority: 0, value });
    } else if (lower.includes("prop id")) {
      candidates.push({ priority: 1, value });
    } else if (lower.includes("property id")) {
      candidates.push({ priority: 2, value });
    }
  });
  if (!candidates.length) return "unknown";
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0].value;
}

function findModuleByTitle($, titles) {
  if (!titles) return null;
  const list = Array.isArray(titles) ? titles : [titles];
  const targets = list
    .map((item) => {
      if (item instanceof RegExp) return item;
      if (item == null) return null;
      const str = String(item).trim().toLowerCase();
      return str.length ? str : null;
    })
    .filter(Boolean);
  if (!targets.length) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = text(
      $section.find("> header .title, > header div.title").first().text(),
    );
    if (!headerTitle) return;
    const normalized = headerTitle.trim().toLowerCase();
    const matches = targets.some((target) => {
      if (target instanceof RegExp) return target.test(normalized);
      return normalized === target || normalized.includes(target);
    });
    if (matches) {
      found = $section;
    }
  });
  return found;
}

function extractTableMap($container) {
  const map = {};
  if (!$container || !$container.length) return map;
  $container.find("tr").each((_, tr) => {
    const $row = cheerio.load(tr);
    const label = text($row("th strong").first().text());
    if (!label) return;
    let value = text($row("td span").first().text());
    if (value == null) {
      value = text($row("td").first().text());
    }
    map[label.toLowerCase()] = value;
  });
  return map;
}

function mapHeatingType(heat, hcv) {
  if (!heat && !hcv) return null;
  const heatUpper = (heat || "").toUpperCase();
  const hcvUpper = (hcv || "").toUpperCase();

  if (heatUpper.includes("NONE") || hcvUpper.includes("NONE")) return null;
  if (heatUpper.includes("HEAT PUMP") || hcvUpper.includes("HEAT PUMP")) {
    return "HeatPump";
  }
  if (heatUpper.includes("CENTRAL") || hcvUpper.includes("CENTRAL")) {
    return "Central";
  }
  if (heatUpper.includes("GAS")) return "Gas";
  if (heatUpper.includes("ELECTRIC")) return "Electric";
  if (heatUpper.includes("FORCED AIR") || hcvUpper.includes("FORCED AIR")) {
    return "Central";
  }
  return null;
}

function mapCoolingType(hvac) {
  if (!hvac) return null;
  const upper = hvac.toUpperCase();
  if (upper.includes("NONE") || upper.includes("N/A")) return null;
  if (upper.includes("HEAT PUMP")) return "CentralAir";
  if (upper.includes("ROOF TOP")) return "CentralAir";
  if (upper.includes("H/A") || upper.includes("CENTRAL") || upper.includes("A/C")) {
    return "CentralAir";
  }
  if (upper.includes("WINDOW")) return "WindowAirConditioner";
  if (upper.includes("DUCTLESS") || upper.includes("MINI SPLIT")) {
    return "Ductless";
  }
  if (upper.includes("FAN")) return "CeilingFans";
  return null;
}

function buildUtilityData($, requestIdentifier) {
  const module = findModuleByTitle($, [
    "Building Information",
    "Building Information Summary",
    "Residential Buildings",
    "Commercial Buildings",
    "Buildings",
  ]);
  if (!module) return [];
  const leftSelector =
    "div[id$='dynamicBuildingDataLeftColumn_divSummary']";
  const results = [];

  module.find(leftSelector).each((idx, leftEl) => {
    const $left = $(leftEl);
    const leftId = $left.attr("id") || "";
    const prefix = leftId.replace(
      "_dynamicBuildingDataLeftColumn_divSummary",
      "",
    );
    const rightId = `${prefix}_dynamicBuildingDataRightColumn_divSummary`;
    const $right = module.find(`[id='${rightId}']`);

    const rightMap = extractTableMap($right);
    const heat =
      rightMap["heat"] ||
      rightMap["heating"] ||
      rightMap["heating type"] ||
      null;
    const hcv =
      rightMap["hc&v"] ||
      rightMap["hvac"] ||
      rightMap["heating / cooling"] ||
      null;
    const hvac =
      rightMap["air conditioning"] ||
      rightMap["ac"] ||
      rightMap["cooling"] ||
      rightMap["hvac"] ||
      null;

    const heatingType = mapHeatingType(heat, hcv);
    const coolingType = mapCoolingType(hvac);

    const baseUtility = {
      heating_system_type: null,
      cooling_system_type: null,
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
    };

    results.push({
      building_index: idx + 1,
      utility: {
        ...baseUtility,
        heating_system_type: heatingType,
        cooling_system_type: coolingType,
        source_http_request: {
          method: "GET",
          url: "https://qpublic.schneidercorp.com/Application.aspx",
        },
        request_identifier: requestIdentifier || null,
      },
    });
  });

  return results;
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const propId = getPropId($);
  const requestIdentifier = propId || null;
  const utilities = buildUtilityData($, requestIdentifier);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "utilities_data.json");

  const data = {};
  data[`property_${propId}`] = { buildings: utilities };
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
