// Structure mapping script
// Extracts building materials and accessory feature hints for downstream structure generation

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl07_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function asNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeExteriorWall(value) {
  const raw = (value || "").toUpperCase();
  if (!raw) return null;
  if (raw.includes("BRICK")) return "Brick";
  if (raw.includes("STONE"))
    return raw.includes("MANUF") ? "Manufactured Stone" : "Natural Stone";
  if (raw.includes("STUCCO")) return "Stucco";
  if (raw.includes("VINYL")) return "Vinyl Siding";
  if (raw.includes("WOOD")) return "Wood Siding";
  if (raw.includes("FIBER")) return "Fiber Cement Siding";
  if (raw.includes("METAL")) return "Metal Siding";
  if (raw.includes("BLOCK")) return "Concrete Block";
  if (raw.includes("EIFS")) return "EIFS";
  if (raw.includes("LOG")) return "Log";
  if (raw.includes("ADOBE")) return "Adobe";
  if (raw.includes("PRECAST")) return "Precast Concrete";
  if (raw.includes("CURTAIN")) return "Curtain Wall";
  return null;
}

function normalizeFloorCover(value) {
  const raw = (value || "").toUpperCase();
  if (!raw) return null;
  if (raw.includes("HARDWOOD")) return "Solid Hardwood";
  if (raw.includes("VINYL")) {
    if (raw.includes("PLANK") || raw.includes("PLAN"))
      return "Luxury Vinyl Plank";
    return "Sheet Vinyl";
  }
  if (raw.includes("LAMINATE")) return "Laminate";
  if (raw.includes("PORCELAIN")) return "Porcelain Tile";
  if (raw.includes("CERAMIC") || raw.includes("TILE")) return "Ceramic Tile";
  if (raw.includes("STONE")) return "Natural Stone Tile";
  if (raw.includes("CARPET")) return "Carpet";
  if (raw.includes("RUG")) return "Area Rugs";
  if (raw.includes("CONCRETE")) return "Polished Concrete";
  if (raw.includes("BAMBOO")) return "Bamboo";
  if (raw.includes("CORK")) return "Cork";
  if (raw.includes("LINOLEUM")) return "Linoleum";
  if (raw.includes("TERRAZZO")) return "Terrazzo";
  if (raw.includes("EPOXY")) return "Epoxy Coating";
  return null;
}

function normalizeInteriorWall(value) {
  const raw = (value || "").toUpperCase();
  if (!raw) return null;
  if (raw.includes("DRYWALL") || raw.includes("GYPSUM")) return "Drywall";
  if (raw.includes("PLASTER")) return "Plaster";
  if (raw.includes("WOOD")) return "Wood Paneling";
  if (raw.includes("BRICK")) return "Exposed Brick";
  if (raw.includes("BLOCK")) return "Exposed Block";
  if (raw.includes("WAINSCOT")) return "Wainscoting";
  if (raw.includes("SHIPLAP")) return "Shiplap";
  if (raw.includes("BOARD") && raw.includes("BATTEN"))
    return "Board and Batten";
  if (raw.includes("TILE")) return "Tile";
  if (raw.includes("STONE")) return "Stone Veneer";
  if (raw.includes("METAL")) return "Metal Panels";
  if (raw.includes("GLASS")) return "Glass Panels";
  if (raw.includes("CONCRETE")) return "Concrete";
  return null;
}

function normalizeRoofCover(value) {
  const raw = (value || "").toUpperCase();
  if (!raw) return null;
  if (raw.includes("ARCHITECT")) return "Architectural Asphalt Shingle";
  if (raw.includes("3-TAB") || raw.includes("3 TAB"))
    return "3-Tab Asphalt Shingle";
  if (raw.includes("METAL") && raw.includes("SEAM")) return "Metal Standing Seam";
  if (raw.includes("METAL")) return "Metal Corrugated";
  if (raw.includes("CLAY")) return "Clay Tile";
  if (raw.includes("CONCRETE")) return "Concrete Tile";
  if (raw.includes("SYNTH") && raw.includes("SLATE")) return "Synthetic Slate";
  if (raw.includes("SLATE")) return "Natural Slate";
  if (raw.includes("WOOD") && raw.includes("SHAKE")) return "Wood Shake";
  if (raw.includes("WOOD") && raw.includes("SHINGLE")) return "Wood Shingle";
  if (raw.includes("TPO")) return "TPO Membrane";
  if (raw.includes("EPDM")) return "EPDM Membrane";
  if (raw.includes("MODIFIED")) return "Modified Bitumen";
  if (raw.includes("BUILT")) return "Built-Up Roof";
  if (raw.includes("GREEN")) return "Green Roof System";
  if (raw.includes("SOLAR")) return "Solar Integrated Tiles";
  return null;
}

function normalizePrimaryFraming(value) {
  const raw = (value || "").toUpperCase();
  if (!raw) return null;
  if (raw.includes("WOOD")) return "Wood Frame";
  if (raw.includes("STEEL")) return "Steel Frame";
  if (raw.includes("CONCRETE") && raw.includes("BLOCK")) return "Concrete Block";
  if (raw.includes("POURED") || (raw.includes("CONCRETE") && !raw.includes("BLOCK"))) return "Poured Concrete";
  if (raw.includes("MASON")) return "Masonry";
  if (raw.includes("ENGINEER")) return "Engineered Lumber";
  if (raw.includes("POST") && raw.includes("BEAM")) return "Post and Beam";
  if (raw.includes("LOG")) return "Log Construction";
  return null;
}

function getParcelId($) {
  const parcel = textTrim($(PARCEL_SELECTOR).text());
  return parcel || null;
}

function extractBuildingAttributes($, $section) {
  const raw = {};
  $section.find("tr").each((_, tr) => {
    const $tr = $(tr);
    const label =
      textTrim($tr.find("th strong").text()) || textTrim($tr.find("th").text());
    const value =
      textTrim($tr.find("td span").text()) || textTrim($tr.find("td").text());
    if (label) raw[label.toLowerCase()] = value || null;
  });
  return raw;
}

function parseBuildings($) {
  const buildings = [];
  const rows = $(
    "#ctlBodyPane_ctl11_mSection .module-content > .block-row",
  ).toArray();

  rows.forEach((row) => {
    const $row = $(row);
    const left = $row.find(
      "[id$='dynamicBuildingDataLeftColumn_divSummary']",
    );
    const right = $row.find(
      "[id$='dynamicBuildingDataRightColumn_divSummary']",
    );
    if (!left.length && !right.length) return;

    const raw = {};
    if (left.length) Object.assign(raw, extractBuildingAttributes($, left));
    if (right.length) Object.assign(raw, extractBuildingAttributes($, right));
    if (Object.keys(raw).length === 0) return;

    const building = {
      structure_index: buildings.length + 1,
      building_index: buildings.length + 1,
      raw,
    };

    const exteriorRaw = raw["exterior walls"] || null;
    const interiorRaw = raw["interior walls"] || null;
    const floorRaw = raw["floor cover"] || null;
    const roofRaw = raw["roof cover"] || null;
    building.exterior_wall_material_primary = normalizeExteriorWall(
      exteriorRaw,
    );
    building.interior_wall_surface_material_primary = normalizeInteriorWall(
      interiorRaw,
    );
    building.flooring_material_primary = normalizeFloorCover(floorRaw);
    building.roof_covering_material = normalizeRoofCover(roofRaw);
    building.primary_framing_material = normalizePrimaryFraming(raw["frame type"]);
    building.number_of_stories = asNumber(raw["stories"]) || null;
    building.finished_base_area =
      asNumber(raw["heated area"]) || asNumber(raw["total area"]);
    building.actual_year_built = asNumber(raw["actual year built"]);
    building.effective_year_built = asNumber(raw["effective year built"]);

    buildings.push(building);
  });

  return buildings;
}

function parseExtraFeatures($) {
  const features = [];
  const table = $("#ctlBodyPane_ctl12_ctl01_grdSales_grdFlat tbody");
  table.find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td");
    if (!cells.length) return;
    const description = textTrim(cells.eq(1).text()) || null;
    if (!description) return;
    const feature = {
      code: textTrim(cells.eq(0).text()) || null,
      description,
      area_sq_ft: asNumber(cells.eq(3).text()),
      year_built: asNumber(cells.eq(4).text()),
      value: asNumber(cells.eq(5).text()),
    };
    features.push(feature);
  });
  return features;
}

function featureLooksLikeStructure(description) {
  const text = (description || "").toUpperCase();
  return [
    "SHED",
    "BARN",
    "CARPORT",
    "GARAGE",
    "WORKSHOP",
    "CABIN",
    "GAZEBO",
    "BUNK",
  ].some((keyword) => text.includes(keyword));
}

function buildStructureData($) {
  const structures = [];
  const buildings = parseBuildings($);
  const extraFeatures = parseExtraFeatures($);

  buildings.forEach((building, idx) => {
    structures.push({
      source: "building",
      structure_index: idx + 1,
      building_index: idx + 1,
      exterior_wall_material_primary: building.exterior_wall_material_primary,
      interior_wall_surface_material_primary:
        building.interior_wall_surface_material_primary,
      flooring_material_primary: building.flooring_material_primary,
      roof_covering_material: building.roof_covering_material,
      primary_framing_material: building.primary_framing_material,
      number_of_stories: building.number_of_stories,
      finished_base_area: building.finished_base_area,
      actual_year_built: building.actual_year_built,
      effective_year_built: building.effective_year_built,
    });
  });

  extraFeatures.forEach((feature) => {
    if (!featureLooksLikeStructure(feature.description)) return;
    structures.push({
      source: "extra_feature",
      structure_index: structures.length + 1,
      building_index: null,
      description: feature.description,
      finished_base_area: feature.area_sq_ft || null,
      actual_year_built: feature.year_built || null,
      value: feature.value || null,
    });
  });

  return { structures };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }

  const data = buildStructureData($);
  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = data;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
