// Structure mapping script
// Reads input.html, parses with cheerio, builds per-building structure records,
// writes owners/structure_data.json

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

function parseIntSafe(str) {
  if (!str) return null;
  const num = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(num) ? num : null;
}

function parseFloatSafe(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function getPropId($) {
  let propId = null;
  $("#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table tr").each(
    (_, el) => {
      const label = text($(el).find("th strong").first().text());
      if (!label) return;
      const lowered = label.toLowerCase();
      if (lowered.includes("prop id") || lowered.includes("parcel id")) {
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

function splitTokens(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[;\/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapExteriorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("ALUMIN")) return "Aluminum Siding";
  if (upper.includes("BRICK")) return "Brick";
  if (upper.includes("STONE")) return "Stone";
  if (upper.includes("CONCRETE BLOCK") || upper.startsWith("CB")) {
    return "Concrete Block";
  }
  if (upper.includes("HARDI") || upper.includes("FIBER")) {
    return "Fiber Cement Siding";
  }
  if (upper.includes("STUCCO")) return "Stucco";
  if (upper.includes("WOOD") || upper.includes("SIDING")) {
    return "Wood Siding";
  }
  if (upper.includes("PRECAST")) return "Precast Concrete Panel";
  if (upper.includes("TILE")) return "Tile";
  return null;
}

function mapInteriorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("DRYWALL")) return "Drywall";
  if (upper.includes("PLASTER")) return "Plaster";
  if (upper.includes("MASON")) return "Exposed Block";
  if (upper.includes("N/A") || upper.includes("NONE")) return null;
  return null;
}

function mapRoofCover(token) {
  if (!token) return null;
  const upper = token.toUpperCase();
  if (upper.includes("ASPHALT")) return "Architectural Asphalt Shingle";
  if (upper.includes("TAR") && upper.includes("GRAVEL")) return "Built-Up";
  if (upper.includes("MINIMUM") || upper.includes("N/A")) return null;
  return null;
}

function mapRoofDesign(val) {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (upper.includes("FLAT")) return "Flat";
  if (upper.includes("GABLE") && upper.includes("HIP")) return "Combination";
  if (upper.includes("GABLE")) return "Gable";
  if (upper.includes("HIP")) return "Hip";
  if (upper.includes("REINF")) return "Flat";
  if (upper.includes("RIGID")) return "Other";
  if (upper.includes("N/A")) return null;
  return null;
}

function mapFrameMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("WOOD")) return "Wood Frame";
  if (upper.includes("MASONRY")) return "Masonry";
  if (upper.includes("REINFORCED")) return "Reinforced Concrete";
  if (upper.includes("PRECAST")) return "Precast Concrete";
  return null;
}

function mapFloorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("CARPET")) return "Carpet";
  if (upper.includes("HARDWOOD") || upper.includes("PINE") || upper.includes("SOFT WOOD")) {
    return "Solid Hardwood";
  }
  if (upper.includes("VINYL")) return "Vinyl Sheet";
  if (upper.includes("TERRAZZO")) return "Terrazzo";
  if (upper.includes("CONCRETE")) return "Concrete";
  if (upper.includes("CLAY") || upper.includes("TILE")) return "Ceramic Tile";
  return null;
}

function dedupe(values) {
  const out = [];
  values.forEach((val) => {
    if (val && !out.includes(val)) out.push(val);
  });
  return out;
}

function parseBuildingSummaries($) {
  const module = findModuleByTitle($, [
    "Buildings",
    "Building Information",
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

    const leftMap = extractTableMap($left);
    const rightMap = extractTableMap($right);

    const identifierMatch = prefix.match(/lstBuildings_(ctl\d+)/i);
    results.push({
      building_index: idx + 1,
      building_identifier: identifierMatch ? identifierMatch[1] : null,
      left: leftMap,
      right: rightMap,
    });
  });

  return results;
}

function buildStructureForBuilding(building, requestIdentifier) {
  const { left, right } = building;

  const exteriorVals = dedupe(
    splitTokens(left["exterior walls"]).map(mapExteriorMaterial),
  );
  const interiorVals = dedupe(
    splitTokens(left["interior walls"]).map(mapInteriorMaterial),
  );
  const floorVals = dedupe(
    splitTokens(left["floor cover"]).map(mapFloorMaterial),
  );
  const frameVals = dedupe(
    splitTokens(left["frame"]).map(mapFrameMaterial),
  );
  const roofCover = mapRoofCover(left["roofing"]);
  let roofMaterialType = null;
  if (roofCover === "Architectural Asphalt Shingle") {
    roofMaterialType = "Shingle";
  } else if (roofCover === "Built-Up") {
    roofMaterialType = "Built-Up";
  }
  const roofDesign = mapRoofDesign(left["roof type"]);

  const heatedArea = parseIntSafe(left["heated area"]);
  const stories =
    parseFloatSafe(right["stories"]) ||
    parseFloatSafe(left["stories"]) ||
    null;

  return {
    exterior_wall_material_primary: exteriorVals[0] || null,
    exterior_wall_material_secondary: exteriorVals[1] || null,
    interior_wall_surface_material_primary: interiorVals[0] || null,
    interior_wall_surface_material_secondary: interiorVals[1] || null,
    flooring_material_primary: floorVals[0] || null,
    flooring_material_secondary: floorVals[1] || null,
    roof_covering_material: roofCover,
    roof_material_type: roofMaterialType,
    roof_design_type: roofDesign,
    primary_framing_material: frameVals[0] || null,
    secondary_framing_material: frameVals[1] || null,
    number_of_stories: stories != null ? stories : null,
    finished_base_area: heatedArea,
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/Application.aspx",
    },
    request_identifier: requestIdentifier || null,
  };
}

function buildStructureData($, requestIdentifier) {
  const buildings = parseBuildingSummaries($);
  return buildings.map((building) => ({
    building_index: building.building_index,
    building_identifier: building.building_identifier,
    structure: buildStructureForBuilding(building, requestIdentifier),
  }));
}

function main() {
  const html = readHtml();
  const $ = cheerio.load(html);
  const propId = getPropId($);
  const requestIdentifier = propId || null;
  const structures = buildStructureData($, requestIdentifier);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const data = {};
  data[`property_${propId}`] = { buildings: structures };
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
