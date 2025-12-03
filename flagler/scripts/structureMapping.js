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

function splitTokens(raw) {
  if (!raw) return [];
  return String(raw)
    .replace(/,/g, "/")
    .split(/[;\/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapExteriorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("ALUMIN") || upper.includes("METAL")) {
    return "Metal Siding";
  }
  if (upper.includes("BRICK")) return "Brick";
  if (upper.includes("STONE")) return "Natural Stone";
  if (
    upper.includes("CONCRETE BLOCK") ||
    upper.startsWith("CB") ||
    upper.includes("C.B.")
  ) {
    return "Concrete Block";
  }
  if (upper.includes("PRECAST")) return "Precast Concrete";
  if (upper.includes("EIFS")) return "EIFS";
  if (upper.includes("VINYL")) return "Vinyl Siding";
  if (upper.includes("HARDI") || upper.includes("HARDY") || upper.includes("FIBER")) {
    return "Fiber Cement Siding";
  }
  if (upper.includes("STUCCO")) return "Stucco";
  if (upper.includes("WOOD") || upper.includes("SIDING")) {
    return "Wood Siding";
  }
  return null;
}

function mapExteriorAccentMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("BRICK")) return "Brick Accent";
  if (upper.includes("STONE")) return "Stone Accent";
  if (upper.includes("WOOD")) return "Wood Trim";
  if (upper.includes("METAL") || upper.includes("ALUMIN")) return "Metal Trim";
  if (upper.includes("STUCCO")) return "Stucco Accent";
  if (upper.includes("VINYL")) return "Vinyl Accent";
  if (upper.includes("BLOCK") || upper.includes("DECORAT")) return "Decorative Block";
  return null;
}

function mapInteriorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("DRYWALL")) return "Drywall";
  if (upper.includes("PLASTER")) return "Plaster";
  if (upper.includes("MASON") || upper.includes("BLOCK")) {
    return "Exposed Block";
  }
  if (upper.includes("WOOD PANEL") || upper.includes("WOOD")) {
    return "Wood Paneling";
  }
  if (upper.includes("TILE")) return "Tile";
  if (upper.includes("STONE")) return "Stone Veneer";
  if (upper.includes("METAL")) return "Metal Panels";
  if (upper.includes("GLASS")) return "Glass Panels";
  if (upper.includes("CONCRETE")) return "Concrete";
  if (upper.includes("N/A") || upper.includes("NONE")) return null;
  return null;
}

function mapInteriorMaterialSecondary(token) {
  const upper = token.toUpperCase();
  if (upper.includes("WAINSCOT")) return "Wainscoting";
  if (upper.includes("CHAIR RAIL")) return "Chair Rail";
  if (upper.includes("CROWN") || upper.includes("MOLDING")) return "Crown Molding";
  if (upper.includes("BASEBOARD")) return "Baseboards";
  if (upper.includes("WOOD PANEL") || upper.includes("WOOD")) return "Wood Trim";
  if (upper.includes("STONE")) return "Stone Accent";
  if (upper.includes("TILE")) return "Tile Accent";
  if (upper.includes("METAL")) return "Metal Accent";
  if (upper.includes("GLASS")) return "Glass Insert";
  if (upper.includes("DECORAT")) return "Decorative Panels";
  if (upper.includes("FEATURE")) return "Feature Wall Material";
  if (upper.includes("N/A") || upper.includes("NONE")) return null;
  return null;
}

function mapRoofCover(token) {
  if (!token) return null;
  const upper = token.toUpperCase();
  if (upper.includes("ASPHALT") || upper.includes("ARCH")) {
    return "Architectural Asphalt Shingle";
  }
  if (upper.includes("3TAB") || upper.includes("3-TAB")) {
    return "3-Tab Asphalt Shingle";
  }
  if (upper.includes("SHINGLE")) return "3-Tab Asphalt Shingle";
  if (upper.includes("TAR") && upper.includes("GRAVEL")) return "Built-Up Roof";
  if (upper.includes("BUILT") && upper.includes("UP")) return "Built-Up Roof";
  if (upper.includes("CLAY")) return "Clay Tile";
  if (upper.includes("CONC")) return "Concrete Tile";
  if (upper.includes("SLATE")) return "Natural Slate";
  if (upper.includes("METAL") && upper.includes("STAND")) {
    return "Metal Standing Seam";
  }
  if (upper.includes("METAL")) return "Metal Corrugated";
  if (upper.includes("MODIFIED BIT")) return "Modified Bitumen";
  if (upper.includes("EPDM")) return "EPDM Membrane";
  if (upper.includes("TPO")) return "TPO Membrane";
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
  if (upper.includes("RIGID")) return null;
  if (upper.includes("N/A")) return null;
  return null;
}

function mapFrameMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("WOOD") || upper.includes("CLASS D")) return "Wood Frame";
  if (
    upper.includes("MASON") ||
    upper.includes("CMU") ||
    upper.includes("CBS") ||
    upper.includes("BLOCK")
  )
    return "Masonry";
  if (upper.includes("CONCRETE") || upper.includes("REINFORCED")) {
    return "Poured Concrete";
  }
  if (upper.includes("STEEL")) return "Steel Frame";
  if (upper.includes("PRECAST")) return "Concrete Block";
  return null;
}

function mapFloorMaterial(token) {
  const upper = token.toUpperCase();
  if (upper.includes("CARPET")) return "Carpet";
  if (upper.includes("HARDWOOD") || upper.includes("PINE") || upper.includes("SOFT WOOD")) {
    return "Solid Hardwood";
  }
  if (upper.includes("LVP") || upper.includes("LUXURY VINYL")) {
    return "Luxury Vinyl Plank";
  }
  if (upper.includes("VINYL")) return "Sheet Vinyl";
  if (upper.includes("TERRAZZO")) return "Terrazzo";
  if (upper.includes("CONCRETE")) return "Polished Concrete";
  if (upper.includes("MARBLE") || upper.includes("GRANITE")) {
    return "Natural Stone Tile";
  }
  if (upper.includes("PORCELAIN")) return "Porcelain Tile";
  if (upper.includes("CLAY") || upper.includes("TILE")) return "Ceramic Tile";
  if (upper.includes("LAMINATE")) return "Laminate";
  return null;
}

function mapRoofMaterialType(roofCover) {
  if (!roofCover) return null;
  switch (roofCover) {
    case "Architectural Asphalt Shingle":
    case "3-Tab Asphalt Shingle":
      return "Shingle";
    case "Metal Standing Seam":
    case "Metal Corrugated":
      return "Metal";
    case "Clay Tile":
    case "Concrete Tile":
      return "Tile";
    case "Natural Slate":
      return "Stone";
    case "Modified Bitumen":
    case "Built-Up Roof":
    case "EPDM Membrane":
    case "TPO Membrane":
      return "Composition";
    default:
      return null;
  }
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

  const exteriorTokens = splitTokens(left["exterior walls"]);
  const exteriorPrimary = exteriorTokens[0] ? mapExteriorMaterial(exteriorTokens[0]) : null;
  const exteriorSecondary = exteriorTokens[1] ? mapExteriorAccentMaterial(exteriorTokens[1]) : null;

  const interiorTokens = splitTokens(left["interior walls"]);
  const interiorPrimary = interiorTokens[0] ? mapInteriorMaterial(interiorTokens[0]) : null;
  const interiorSecondary = interiorTokens[1] ? mapInteriorMaterialSecondary(interiorTokens[1]) : null;

  const floorVals = dedupe(
    splitTokens(left["floor cover"]).map(mapFloorMaterial),
  );
  const frameVals = dedupe(
    splitTokens(left["frame"]).map(mapFrameMaterial),
  );
  const roofCover = mapRoofCover(left["roofing"]);
  const roofMaterialType = mapRoofMaterialType(roofCover);
  const roofDesign = mapRoofDesign(left["roof type"]);

  const heatedArea = parseIntSafe(left["heated area"]);
  const stories = parseFloatSafe(right["stories"]);

  return {
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: exteriorSecondary,
    interior_wall_surface_material_primary: interiorPrimary,
    interior_wall_surface_material_secondary: interiorSecondary,
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
