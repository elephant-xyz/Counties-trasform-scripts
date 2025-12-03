// Structure extractor per Elephant Lexicon schema
// - Reads input.html
// - Parses visible tables and embedded JSON for components
// - Maps to required enums and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const EXTERIOR_PRIMARY_ALLOWED = new Set([
  "Brick",
  "Natural Stone",
  "Manufactured Stone",
  "Stucco",
  "Vinyl Siding",
  "Wood Siding",
  "Fiber Cement Siding",
  "Metal Siding",
  "Concrete Block",
  "EIFS",
  "Log",
  "Adobe",
  "Precast Concrete",
  "Curtain Wall",
  null,
]);

const INTERIOR_SURFACE_ALLOWED = new Set([
  "Drywall",
  "Plaster",
  "Wood Paneling",
  "Exposed Brick",
  "Exposed Block",
  "Wainscoting",
  "Shiplap",
  "Board and Batten",
  "Tile",
  "Stone Veneer",
  "Metal Panels",
  "Glass Panels",
  "Concrete",
  null,
]);

const FRAMING_ALLOWED = new Set([
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
  "Poured Concrete",
  "Masonry",
  "Engineered Lumber",
  "Post and Beam",
  "Log Construction",
  null,
]);

const FLOOR_PRIMARY_ALLOWED = new Set([
  "Solid Hardwood",
  "Engineered Hardwood",
  "Laminate",
  "Luxury Vinyl Plank",
  "Sheet Vinyl",
  "Ceramic Tile",
  "Porcelain Tile",
  "Natural Stone Tile",
  "Carpet",
  "Area Rugs",
  "Polished Concrete",
  "Bamboo",
  "Cork",
  "Linoleum",
  "Terrazzo",
  "Epoxy Coating",
  null,
]);

const FLOOR_SECONDARY_ALLOWED = new Set([
  "Solid Hardwood",
  "Engineered Hardwood",
  "Laminate",
  "Luxury Vinyl Plank",
  "Ceramic Tile",
  "Carpet",
  "Area Rugs",
  "Transition Strips",
  null,
]);

const ROOF_COVER_ALLOWED = new Set([
  "3-Tab Asphalt Shingle",
  "Architectural Asphalt Shingle",
  "Metal Standing Seam",
  "Metal Corrugated",
  "Clay Tile",
  "Concrete Tile",
  "Natural Slate",
  "Synthetic Slate",
  "Wood Shake",
  "Wood Shingle",
  "TPO Membrane",
  "EPDM Membrane",
  "Modified Bitumen",
  "Built-Up Roof",
  "Green Roof System",
  "Solar Integrated Tiles",
  null,
]);

const ROOF_MATERIAL_ALLOWED = new Set([
  "Manufactured",
  "EngineeredWood",
  "Terazzo",
  "Brick",
  "Wood",
  "CinderBlock",
  "Concrete",
  "Shingle",
  "Composition",
  "Linoleum",
  "Stone",
  "CeramicTile",
  "Block",
  "WoodSiding",
  "ImpactGlass",
  "Carpet",
  "Marble",
  "Vinyl",
  "Tile",
  "PouredConcrete",
  "Metal",
  "Glass",
  "Laminate",
  null,
]);

const FOUNDATION_TYPE_ALLOWED = new Set([
  "Slab on Grade",
  "Crawl Space",
  "Full Basement",
  "Partial Basement",
  "Pier and Beam",
  "Basement with Walkout",
  "Stem Wall",
  null,
]);

const FOUNDATION_MATERIAL_ALLOWED = new Set([
  "Poured Concrete",
  "Concrete Block",
  "Stone",
  "Brick",
  "Treated Wood Posts",
  "Steel Piers",
  "Precast Concrete",
  "Insulated Concrete Forms",
  null,
]);

const EXTERIOR_SECONDARY_ALLOWED = new Set([
  "Brick Accent",
  "Stone Accent",
  "Wood Trim",
  "Metal Trim",
  "Stucco Accent",
  "Vinyl Accent",
  "Decorative Block",
  null,
]);

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractRemixContext($) {
  // Extract window.__remixContext JSON blob
  let json = null;
  $("script").each((i, el) => {
    const txt = $(el).html() || "";
    const m = txt.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});?/);
    if (m && !json) {
      try {
        json = JSON.parse(m[1]);
      } catch (e) {
        // Fallback: try to trim trailing semicolon if present
        let src = m[1];
        if (src.endsWith(";")) src = src.slice(0, -1);
        try {
          json = JSON.parse(src);
        } catch (e2) {
          json = null;
        }
      }
    }
  });
  if (!json) {
    try {
      const rawHtml = fs.readFileSync(path.resolve("input.html"), "utf8");
      const m = rawHtml.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});?/);
      if (m) {
        let src = m[1];
        if (src.endsWith(";")) src = src.slice(0, -1);
        json = JSON.parse(src);
      }
    } catch (e) {
      json = null;
    }
  }
  return json;
}

function extractPropertyId($) {
  // Try common places
  let id = $('[data-cell="Parcel Number"]').first().text().trim();
  if (!id) {
    $("h1, h2, th, td, span, div").each((_, el) => {
      if (id) return;
      const t = $(el).text().trim();
      if (/parcel/i.test(t)) {
        const m = t.match(/[A-Za-z0-9]{2}[-A-Za-z0-9]+/);
        if (m) id = m[0];
      }
    });
  }
  if (!id) id = "unknown_id";
  return id;
}

function textOfCell(rows, label) {
  const row = rows.filter((i, el) =>
    cheerio
      .load(el)('th,td[role="cell"]')
      .first()
      .text()
      .trim()
      .toLowerCase()
      .startsWith(label.toLowerCase()),
  );
  if (!row.length) return null;
  const td = cheerio.load(row[0])('td[role="cell"]');
  return (td.text() || "").trim() || null;
}

function norm(str) {
  return (str || "").toString().trim().toUpperCase();
}

function lowerNorm(str) {
  return (str || "").toString().trim().toLowerCase();
}

function mapExteriorWallMaterial(wallValue) {
  wallValue = lowerNorm(wallValue);
  if (wallValue.includes("hardi")) {
    return "Fiber Cement Siding";
  }
  if (wallValue.includes("prefab") || wallValue.includes("panel")) {
    return "Precast Concrete";
  }
  if (wallValue.includes("stucco")) {
    return "Stucco";
  }
  if (wallValue.includes("vinyl")) {
    return "Vinyl Siding";
  }
  if (wallValue.includes("adobe")) {
    return "Adobe";
  }
  if (wallValue.includes("concrete")) {
    if (wallValue.includes("precast")) {
      return "Precast Concrete";
    }
    return "Concrete Block";
  }
  if (wallValue.includes("curtain")) {
    return "Curtain";
  }
  if (wallValue.includes("fiber")) {
    return "Fiber Cement Siding";
  }
  if (wallValue.includes("stone")) {
    if (wallValue.includes("nat")) {
      return "Natural Stone";
    }
    return "Manufactured Stone";
  }
  if (wallValue.includes("metal")) {
    return "Metal Siding";
  }
  if (wallValue.includes("wood")) {
    return "Wood Siding";
  }
  if (wallValue.includes("log")) {
    return "Log";
  }
  return null;
}

function mapExteriorWallMaterialSecondary(wallValue) {
  wallValue = lowerNorm(wallValue);
  if (wallValue.includes("brick")) return "Brick Accent";
  if (wallValue.includes("stone")) return "Stone Accent";
  if (wallValue.includes("wood")) return "Wood Trim";
  if (wallValue.includes("metal") || wallValue.includes("alum"))
    return "Metal Trim";
  if (wallValue.includes("stucco")) return "Stucco Accent";
  if (wallValue.includes("vinyl")) return "Vinyl Accent";
  if (wallValue.includes("decorative") || wallValue.includes("deco"))
    return "Decorative Block";
  return null;
}

function mapPrimaryFloorMaterial(floorVal) {
  floorVal = lowerNorm(floorVal);
  if (floorVal.includes("porcelain")) {
    return "Porcelain Tile";
  }
  if (floorVal.includes("hardwood")) {
    if (floorVal.includes("engineered")) return "Engineered Hardwood";
    return "Solid Hardwood";
  }
  if (floorVal.includes("cork")) {
    return "Cork";
  }
  if (floorVal.includes("polished") && floorVal.includes("concrete")) {
    return "Polished Concrete";
  }
  if (floorVal.includes("stone")) {
    return "Natural Stone Tile";
  }
  if (floorVal.includes("bamboo")) {
    return "Bamboo";
  }
  if (floorVal.includes("carpet")) {
    return "Carpet";
  }
  if (floorVal.includes("ceramic")) {
    return "Ceramic Tile";
  }
  if (floorVal.includes("epoxy")) {
    return "Epoxy Coating";
  }
  if (floorVal.includes("laminate")) {
    return "Laminate";
  }
  if (floorVal.includes("linoleum")) {
    return "Linoleum";
  }
  if (floorVal.includes("vinyl")) {
    if (floorVal.includes("luxury")) {
      return "Luxury Vinyl Plank";
    }
    return "Sheet Vinyl";
  }
  if (floorVal.includes("terrazzo")) {
    return "Terrazzo";
  }
  return null;
}

function mapSecondaryFloorMaterial(floorVal) {
  floorVal = lowerNorm(floorVal);
  if (floorVal.includes("hardwood")) {
    if (floorVal.includes("engineered")) return "Engineered Hardwood";
    return "Solid Hardwood";
  }
  if (floorVal.includes("carpet")) {
    return "Carpet";
  }
  if (floorVal.includes("ceramic")) {
    return "Ceramic Tile";
  }
  if (floorVal.includes("laminate")) {
    return "Laminate";
  }
  if (floorVal.includes("vinyl")) {
    return "Luxury Vinyl Plank";
  }
  return null;
}

function mapInteriorWallSurface(wallValue) {
  wallValue = lowerNorm(wallValue);
  if (wallValue.includes("concrete")) {
    return "Concrete";
  }
  if (wallValue.includes("drywall")) {
    return "Drywall";
  }
  if (wallValue.includes("board") && wallValue.includes("batten")) {
    return "Board and Batten";
  }
  if (wallValue.includes("tile")) {
    return "Tile";
  }
  if (wallValue.includes("block")) {
    return "Exposed Block";
  }
  if (wallValue.includes("brick")) {
    return "Exposed Brick";
  }
  if (wallValue.includes("glass")) {
    return "Glass Panels";
  }
  if (wallValue.includes("metal")) {
    return "Metal Panels";
  }
  if (wallValue.includes("plaster")) {
    return "Plaster";
  }
  if (wallValue.includes("shiplap")) {
    return "Shiplap";
  }
  if (wallValue.includes("stone")) {
    return "Stone Veneer";
  }
  if (wallValue.includes("wood")) {
    return "Wood Paneling";
  }
  if (wallValue.includes("wainscoting")) {
    return "Wainscoting";
  }
  return null;
}

function mapFraming(frameValue) {
  frameValue = lowerNorm(frameValue);
  if (frameValue.includes("concrete")) {
    if (frameValue.includes("block")) {
      return "Concrete Block";
    }
    if (frameValue.includes("poured")) {
      return "Poured Concrete";
    }
    return null;
  }
  if (frameValue.includes("lumber")) {
    return "Engineered Lumber";
  }
  if (frameValue.includes("log")) {
    return "Log Construction";
  }
  if (frameValue.includes("masonry")) {
    return "Masonry";
  }
  if (frameValue.includes("beam") || frameValue.includes("post")) {
    return "Post and Beam";
  }
  if (frameValue.includes("steel")) {
    return "Steel Frame";
  }
  if (frameValue.includes("wood")) {
    return "Wood Frame";
  }
  return null;
}

function mapRoofCover(val) {
  const t = lowerNorm(val);
  if (!t) return null;
  if (t.includes("timberline") || t.includes("shingle")) {
    return "Architectural Asphalt Shingle";
  }
  if (t.includes("3-tab") || t.includes("3 tab")) {
    return "3-Tab Asphalt Shingle";
  }
  if (t.includes("metal")) {
    return "Metal Standing Seam";
  }
  if (t.includes("tpo")) {
    return "TPO Membrane";
  }
  if (t.includes("tile")) {
    return "Clay Tile";
  }
  return null;
}

function mapRoofMaterialType(val) {
  const t = lowerNorm(val);
  if (!t) return null;
  if (t.includes("shingle")) return "Shingle";
  if (t.includes("metal")) return "Metal";
  if (t.includes("tile")) return "Tile";
  if (t.includes("concrete")) return "Concrete";
  if (t.includes("poured")) return "PouredConcrete";
  if (t.includes("stone") || t.includes("slate")) return "Stone";
  if (t.includes("wood")) return "Wood";
  if (t.includes("vinyl")) return "Vinyl";
  if (
    t.includes("tpo") ||
    t.includes("epdm") ||
    t.includes("bitumen") ||
    t.includes("built-up") ||
    t.includes("built up") ||
    t.includes("membrane")
  )
    return "Composition";
  return null;
}

function mapRoofDesignFromDesc(desc) {
  const t = lowerNorm(desc);
  if (!t) return null;
  if (t.includes("gable") && t.includes("hip")) return "Combination";
  if (t.includes("gable")) return "Gable";
  if (t.includes("hip")) return "Hip";
  if (t.includes("flat")) return "Flat";
  return null;
}

function mapFoundationType(desc) {
  const t = lowerNorm(desc);
  if (!t) return null;
  if (t.includes("walkout")) return "Basement with Walkout";
  if (t.includes("partial") && t.includes("basement"))
    return "Partial Basement";
  if (t.includes("slab")) return "Slab on Grade";
  if (t.includes("crawl")) return "Crawl Space";
  if (t.includes("basement")) return "Full Basement";
  if (t.includes("pier") || t.includes("beam") || t.includes("off grade")) {
    return "Pier and Beam";
  }
  if (t.includes("stem")) return "Stem Wall";
  return null;
}

function mapFoundationMaterial(desc) {
  const t = lowerNorm(desc);
  if (!t) return null;
  if (t.includes("icf") || t.includes("insulated concrete"))
    return "Insulated Concrete Forms";
  if (t.includes("precast")) return "Precast Concrete";
  if (t.includes("poured")) return "Poured Concrete";
  if (t.includes("block")) return "Concrete Block";
  if (t.includes("concrete")) return "Poured Concrete";
  if (t.includes("stone")) return "Stone";
  if (t.includes("brick")) return "Brick";
  if (t.includes("wood")) return "Treated Wood Posts";
  if (t.includes("steel")) return "Steel Piers";
  return null;
}

function toNumber(val) {
  if (val === null || val === undefined) return null;
  const num = Number(String(val).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : null;
}

function parseBuildingTable($table) {
  const rows = $table.find("tbody > tr");
  const val = (label) => textOfCell(rows, label);
  return {
    type: val("Type"),
    totalArea: val("Total Area"),
    heatedArea: val("Heated Area"),
    exteriorWalls: val("Exterior Walls"),
    roofCover: val("Roof Cover"),
    interiorWalls: val("Interior Walls"),
    foundation: val("Foundation"),
    frame: val("Frame"),
    floor: val("Floor"),
    heatType: val("Heat Type"),
    acType: val("A/C Type"),
    bathrooms: val("Bathrooms"),
    bedrooms: val("Bedrooms"),
    stories: val("Stories"),
    actualYearBuilt: val("Actual Year Built"),
    effectiveYearBuilt: val("Effective Year Built"),
  };
}

function buildEmptyStructure() {
  return {
    architectural_style_type: null,
    attachment_type: null,
    building_number: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: null
  };
}

function pickMaterialsFromComponents(components, categoryFragment, mapper) {
  const items = components
    .filter(
      (c) =>
        c.category &&
        lowerNorm(c.category.description).includes(lowerNorm(categoryFragment)),
    )
    .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));

  let primary = null;
  let secondary = null;
  for (const item of items) {
    const mapped = mapper(item.description || item.code || "");
    if (mapped && !primary) {
      primary = mapped;
      continue;
    }
    if (mapped && !secondary) {
      secondary = mapped;
      break;
    }
  }
  return { primary, secondary };
}

function extractStructure($) {
  const remixContext = extractRemixContext($) || {};
  const remixData =
    remixContext &&
    remixContext.state &&
    remixContext.state.loaderData &&
    remixContext.state.loaderData["routes/_index"]
      ? remixContext.state.loaderData["routes/_index"]
      : {};
  const buildingTables = $("caption")
    .filter((i, el) => $(el).text().trim().toUpperCase().startsWith("BUILDING"))
    .map((i, el) => $(el).closest("table"))
    .get();
  const buildingUnits =
    remixData.buildings && Array.isArray(remixData.buildings.units)
      ? remixData.buildings.units
      : [];
  const components =
    remixData.buildings && Array.isArray(remixData.buildings.components)
      ? remixData.buildings.components
      : [];

  const buildingCount = Math.max(
    buildingTables.length,
    buildingUnits.length,
    components.length ? new Set(components.map((c) => c.buildingKey)).size : 0,
  );

  if (!buildingCount) return [];

  const structures = [];
  for (let i = 0; i < buildingCount; i++) {
    const table = buildingTables[i];
    const tableData = table ? parseBuildingTable($(table)) : {};
    const unit = buildingUnits[i] || {};
    const buildingKey =
      unit.buildingKey || unit.uniqueKey || (table ? i + 1 : null);
    const buildingNumber = i + 1;
    const componentSlice = buildingKey
      ? components.filter((c) => c.buildingKey === buildingKey)
      : [];

    const s = buildEmptyStructure();
    s.building_number = buildingNumber;

    // Exterior walls
    const { primary: extPrimary, secondary: extSecondary } =
      pickMaterialsFromComponents(
        componentSlice,
        "EXTERIOR WALL",
        mapExteriorWallMaterial,
      );
    if (extPrimary) s.exterior_wall_material_primary = extPrimary;
    if (extSecondary) s.exterior_wall_material_secondary = extSecondary;
    if (!s.exterior_wall_material_primary && tableData.exteriorWalls) {
      const parts = tableData.exteriorWalls.split(",").map((p) => p.trim());
      // console.log("PARTS",parts)
      s.exterior_wall_material_primary = mapExteriorWallMaterial(parts[0]);
      if (parts.length > 1) {
        s.exterior_wall_material_secondary = mapExteriorWallMaterialSecondary(
          parts[1],
        );
      }
    }
    if (
      !EXTERIOR_PRIMARY_ALLOWED.has(s.exterior_wall_material_primary || null)
    ) {
      s.exterior_wall_material_primary = null;
    }
    if (
      !EXTERIOR_SECONDARY_ALLOWED.has(s.exterior_wall_material_secondary || null)
    ) {
      s.exterior_wall_material_secondary = null;
    }

    // Interior walls
    const { primary: intPrimary } = pickMaterialsFromComponents(
      componentSlice,
      "INTERIOR WALL",
      mapInteriorWallSurface,
    );
    if (intPrimary) s.interior_wall_surface_material_primary = intPrimary;
    if (!s.interior_wall_surface_material_primary && tableData.interiorWalls) {
      s.interior_wall_surface_material_primary = mapInteriorWallSurface(
        tableData.interiorWalls,
      );
    }
    if (
      !INTERIOR_SURFACE_ALLOWED.has(
        s.interior_wall_surface_material_primary || null,
      )
    ) {
      s.interior_wall_surface_material_primary = null;
    }

    // Framing
    const { primary: framePrimary } = pickMaterialsFromComponents(
      componentSlice,
      "FRAME",
      mapFraming,
    );
    if (framePrimary) s.primary_framing_material = framePrimary;
    if (!s.primary_framing_material && tableData.frame) {
      s.primary_framing_material = mapFraming(tableData.frame);
    }
    if (
      !FRAMING_ALLOWED.has(s.primary_framing_material || null)
    ) {
      s.primary_framing_material = null;
    }

    // Floors
    const floorComponents = componentSlice
      .filter(
        (c) =>
          c.category &&
          lowerNorm(c.category.description).includes("floor") &&
          c.description,
      )
      .sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    for (const fc of floorComponents) {
      if (!s.flooring_material_primary) {
        s.flooring_material_primary = mapPrimaryFloorMaterial(fc.description);
      } else if (!s.flooring_material_secondary) {
        s.flooring_material_secondary = mapSecondaryFloorMaterial(
          fc.description,
        );
      }
    }
    if (!s.flooring_material_primary && tableData.floor) {
      const parts = tableData.floor.split(",").map((p) => p.trim());
      s.flooring_material_primary = mapPrimaryFloorMaterial(parts[0]);
      if (parts.length > 1) {
        s.flooring_material_secondary = mapSecondaryFloorMaterial(parts[1]);
      }
    }
    if (
      !FLOOR_PRIMARY_ALLOWED.has(s.flooring_material_primary || null)
    ) {
      s.flooring_material_primary = null;
    }
    if (
      !FLOOR_SECONDARY_ALLOWED.has(s.flooring_material_secondary || null)
    ) {
      s.flooring_material_secondary = null;
    }

    // Roof
    const roofCoverComp = componentSlice.find(
      (c) =>
        c.category &&
        lowerNorm(c.category.description).includes("roof cover") &&
        (c.description || c.code),
    );
    if (roofCoverComp) {
      const src = roofCoverComp.description || roofCoverComp.code;
      s.roof_covering_material = mapRoofCover(src);
      s.roof_material_type = mapRoofMaterialType(src);
    }
    if (!s.roof_covering_material && tableData.roofCover) {
      s.roof_covering_material = mapRoofCover(tableData.roofCover);
      s.roof_material_type = mapRoofMaterialType(tableData.roofCover);
    }
    if (!ROOF_COVER_ALLOWED.has(s.roof_covering_material || null)) {
      s.roof_covering_material = null;
    }
    if (!ROOF_MATERIAL_ALLOWED.has(s.roof_material_type || null)) {
      s.roof_material_type = null;
    }
    const roofDesignComp = componentSlice.find(
      (c) =>
        c.category &&
        lowerNorm(c.category.description).includes("roof structure") &&
        (c.description || c.code),
    );
    if (roofDesignComp) {
      s.roof_design_type = mapRoofDesignFromDesc(
        roofDesignComp.description || roofDesignComp.code,
      );
    }

    // Foundation
    const foundationComp = componentSlice.find(
      (c) =>
        c.category &&
        lowerNorm(c.category.description).includes("foundation") &&
        (c.description || c.code),
    );
    if (foundationComp) {
      s.foundation_type = mapFoundationType(
        foundationComp.description || foundationComp.code,
      );
      s.foundation_material = mapFoundationMaterial(
        foundationComp.description || foundationComp.code,
      );
    }
    if (!s.foundation_type && tableData.foundation) {
      s.foundation_type = mapFoundationType(tableData.foundation);
      s.foundation_material = mapFoundationMaterial(tableData.foundation);
    }
    if (!FOUNDATION_TYPE_ALLOWED.has(s.foundation_type || null)) {
      s.foundation_type = null;
    }
    if (!FOUNDATION_MATERIAL_ALLOWED.has(s.foundation_material || null)) {
      s.foundation_material = null;
    }

    // Stories / area
    s.number_of_stories =
      toNumber(tableData.stories) ||
      toNumber(unit.stories) ||
      s.number_of_stories;
    s.finished_base_area =
      toNumber(unit.squareFeet && unit.squareFeet.actual) ||
      toNumber(tableData.totalArea) ||
      null;

    structures.push(s);
  }
  return structures;
}

(function main() {
  try {
    const $ = loadHtml();
    const propertySeed = readJSON("property_seed.json");
    const id = propertySeed["parcel_id"];
    const structures = extractStructure($);

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "structure_data.json");

    const payload = {};
    payload[`property_${id}`] = { structures };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(
      `Wrote structure data for ${id} (${structures.length} building entries) -> ${outPath}`,
    );
  } catch (err) {
    console.error("Structure mapping failed:", err.message);
    process.exitCode = 1;
  }
})();
