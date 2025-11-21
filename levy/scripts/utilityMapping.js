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

const SUMMARY_SELECTOR =
  "#ctlBodyPane_ctl02_ctl01_dynamicSummaryData_divSummary";

function getPropId($) {
  let propId = null;
  $(`${SUMMARY_SELECTOR} table tr`).each(
    (_, el) => {
      const label = text($(el).find("th strong").first().text());
      if (!label) return;
      const lowered = label.toLowerCase();
      const compressed = lowered.replace(/\s+/g, "");
      if (
        lowered.includes("prop id") ||
        lowered.includes("parcel id") ||
        lowered.includes("property id") ||
        compressed.includes("propid") ||
        compressed.includes("parcelid") ||
        compressed.includes("propertyid")
      ) {
        const val = text($(el).find("td span").first().text());
        if (val) propId = val;
      }
    },
  );
  return propId || "unknown";
}

function normalizeTitle(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findModuleByTitle($, titles) {
  const list = Array.isArray(titles) ? titles : [titles];
  const targets = list
    .map((t) => normalizeTitle(t))
    .filter(Boolean);
  if (!targets.length) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = text(
      $section.find("> header .title, > header div.title").first().text(),
    );
    const normalizedHeader = normalizeTitle(headerTitle);
    if (
      normalizedHeader &&
      targets.some(
        (target) =>
          target === normalizedHeader ||
          normalizedHeader.includes(target) ||
          target.includes(normalizedHeader),
      )
    ) {
      found = $section;
    }
  });
  return found;
}

function extractTableMap($, $container) {
  const map = {};
  if (!$container || !$container.length) return map;
  const table = $container.is("table")
    ? $container
    : $container.find("table").first();
  const rows = table && table.length ? table.find("tr") : $container.find("tr");
  rows.each((_, tr) => {
    const $tr = $(tr);
    const label = text($tr.find("th").first().text());
    if (!label) return;
    let value = text($tr.find("td").first().text());
    if (!value) {
      value = text($tr.find("td span").first().text());
    }
    if (!value) {
      value = text($tr.find("td div").first().text());
    }
    if (value != null && value !== "") {
      map[label.toLowerCase()] = value;
    }
  });
  return map;
}

function isLikelyBuildingMap(map) {
  const keys = Object.keys(map);
  if (!keys.length) return false;
  const indicators = [
    "building type",
    "type",
    "total area",
    "heated area",
    "bedrooms",
    "bathrooms",
    "stories",
    "heat",
    "heating",
    "hvac",
    "air conditioning",
  ];
  const score = indicators.reduce(
    (count, indicator) =>
      count +
      (keys.some((key) => key.includes(indicator)) ? 1 : 0),
    0,
  );
  return score >= 2 || keys.some((key) => key.includes("hvac") || key.includes("heat"));
}

function collectBuildingEntries($, module) {
  const buckets = new Map();

  module.find("[id*='lstBuildings_']").each((_, element) => {
    const $el = $(element);
    const id = $el.attr("id") || "";
    const match = id.match(/lstBuildings_[^_]+/i);
    if (!match) return;
    const key = match[0];
    const bucket =
      buckets.get(key) || {
        identifier: key.replace(/^lstBuildings_/i, ""),
        left: null,
        right: null,
        extras: [],
      };
    const map = extractTableMap($, $el);
    if (!Object.keys(map).length) {
      return;
    }
    const loweredId = id.toLowerCase();
    if (!bucket.left && loweredId.includes("left")) {
      bucket.left = map;
    } else if (!bucket.right && loweredId.includes("right")) {
      bucket.right = map;
    } else {
      bucket.extras.push(map);
    }
    buckets.set(key, bucket);
  });

  const entries = [];
  if (buckets.size) {
    Array.from(buckets.values()).forEach((bucket, idx) => {
      const leftMap = bucket.left || bucket.extras.shift() || {};
      const rightMap = bucket.right || bucket.extras.shift() || {};
      entries.push({
        building_index: idx + 1,
        building_identifier: bucket.identifier || null,
        leftMap,
        rightMap,
      });
    });
    return entries;
  }

  const candidateMaps = [];
  module.find("table").each((_, table) => {
    const $table = $(table);
    const map = extractTableMap($, $table);
    if (!Object.keys(map).length) return;
    if (isLikelyBuildingMap(map)) {
      candidateMaps.push(map);
    }
  });

  if (!candidateMaps.length) return [];

  for (let i = 0; i < candidateMaps.length; i += 2) {
    const leftMap = candidateMaps[i];
    const rightMap = candidateMaps[i + 1] || {};
    entries.push({
      building_index: entries.length + 1,
      building_identifier: null,
      leftMap,
      rightMap,
    });
  }

  return entries;
}

function mapHeatingType(heat, hcv) {
  if (!heat && !hcv) return null;
  const heatUpper = (heat || "").toUpperCase();
  const hcvUpper = (hcv || "").toUpperCase();

  if (heatUpper.includes("NONE") || hcvUpper.includes("NONE")) return null;
  if (heatUpper.includes("GAS")) return "Gas";
  if (heatUpper.includes("ELECTRIC")) return "Electric";
  if (hcvUpper.includes("FORCED AIR") || hcvUpper.includes("CENTRAL")) {
    return "Central";
  }
  return null;
}

function mapCoolingType(hvac) {
  if (!hvac) return null;
  const upper = hvac.toUpperCase();
  if (upper.includes("NONE") || upper.includes("N/A")) return null;
  if (upper.includes("ROOF TOP")) return "RooftopUnit";
  if (upper.includes("CENTRAL")) return "CentralAir";
  return null;
}

function buildUtilityData($, requestIdentifier) {
  const module = findModuleByTitle($, [
    "Buildings",
    "Building Information",
    "Structure Information",
    "Improvement Information",
  ]);
  if (!module) return [];
  const results = [];

  const entries = collectBuildingEntries($, module);
  if (!entries.length) return results;

  entries.forEach((entry) => {
    const rightMap = entry.rightMap || entry.leftMap || {};
    const heat = rightMap["heat"] || rightMap["heating"] || null;
    const hcv =
      rightMap["hc&v"] ||
      rightMap["hc & v"] ||
      rightMap["hc v"] ||
      rightMap["heating/cooling"] ||
      null;
    const hvac =
      rightMap["hvac"] ||
      rightMap["cooling"] ||
      rightMap["air conditioning"] ||
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
      building_index: entry.building_index,
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
