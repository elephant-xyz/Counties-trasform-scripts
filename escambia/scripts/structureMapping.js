// Structure data extractor using Cheerio
// Reads input.html, extracts structural details for each building, and writes JSON to data/ and owners/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textNorm(t) {
  return (t || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function toInt(value) {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

function getParcelId($) {
  let id = null;
  $("#ctl00_MasterPlaceHolder_GenCell table tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    const label = textNorm($tds.eq(0).text());
    if (/^Parcel ID:/i.test(label)) id = textNorm($tds.eq(1).text());
  });
  return id;
}

function extractBuildings($) {
  const tables = $("#ctl00_MasterPlaceHolder_tblBldgs > tbody > tr > td > table");
  const buildings = [];

  tables.each((idx, table) => {
    const $tbl = $(table);
    const structuralElements = {};
    $tbl.find("span").each((_, span) => {
      const txt = textNorm($(span).text());
      if (/^Structural Elements$/i.test(txt)) {
        const container = $(span).parent();
        container.find("b").each((__, bold) => {
          const key = textNorm($(bold).text()).toUpperCase();
          const val = textNorm($(bold).next("i").text());
          if (key) structuralElements[key] = val || null;
        });
      }
    });

    const areas = {};
    const areaSpan = $tbl
      .find("span")
      .filter((_, span) => /Areas\s*-\s*\d+\s*Total\s*SF/i.test(textNorm($(span).text())))
      .first();
    if (areaSpan.length) {
      const container = areaSpan.parent();
      container.find("b").each((__, bold) => {
        const key = textNorm($(bold).text()).toUpperCase();
        const val = toInt($(bold).next("i").text());
        if (key && val != null) areas[key] = val;
      });
    }

    buildings.push({
      index: idx + 1,
      structuralElements,
      areas,
      finishedBaseArea: areas["BASE AREA"] ?? null,
      numberOfStories: toInt(structuralElements["NO. STORIES"]),
    });
  });

  return buildings;
}

const ALLOWED_ATTACHMENT_TYPES = ["Detached", "Attached", "SemiDetached"];
const ALLOWED_EXTERIOR_WALL_MATERIALS = [
  "Wood Siding",
  "Brick",
  "Stucco",
  "Vinyl Siding",
  "Aluminum Siding",
];
const ALLOWED_FLOORING_MATERIALS = [
  "Carpet",
  "Hardwood",
  "Tile",
  "Laminate",
  "Vinyl",
];
const ALLOWED_SUBFLOOR_MATERIALS = ["Concrete Slab", "Wood", "Plywood"];
const ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS = [
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
];
const ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS = [
  "Drywall",
  "Plaster",
  "Paneling",
];
const ALLOWED_ROOF_COVERING_MATERIALS = [
  "Architectural Asphalt Shingle",
  "Asphalt Shingle",
  "Metal",
  "Tile",
  "Wood Shake",
];
const ALLOWED_ROOF_DESIGN_TYPES = [
  "Gable",
  "Hip",
  "Mansard",
  "Flat",
  "Gambrel",
];
const ALLOWED_ROOF_MATERIAL_TYPES = ["Shingle", "Tile", "Metal", "Wood"];
const ALLOWED_FOUNDATION_TYPES = [
  "Slab on Grade",
  "Crawl Space",
  "Basement",
  "Pier and Beam",
];
const ALLOWED_FRAMING_MATERIALS = ["Wood Frame", "Steel Frame", "Concrete"];

function validateEnum(value, allowed, className, propertyName) {
  if (value === null || value === undefined) return null;
  if (!allowed.includes(value)) {
    throw new Error(
      JSON.stringify({
        type: "error",
        message: `Unknown enum value ${value}.`,
        path: `${className}.${propertyName}`,
      }),
    );
  }
  return value;
}

function createStructureRecord(building) {
  const map = building.structuralElements || {};
  const areas = building.areas || {};

  const exteriorWall = (map["EXTERIOR WALL"] || "").toUpperCase();
  const floorCover = (map["FLOOR COVER"] || "").toUpperCase();
  const foundation = (map["FOUNDATION"] || "").toUpperCase();
  const interiorWall = (map["INTERIOR WALL"] || "").toUpperCase();
  const roofCover = (map["ROOF COVER"] || "").toUpperCase();
  const roofFraming = (map["ROOF FRAMING"] || "").toUpperCase();
  const structuralFrame = (map["STRUCTURAL FRAME"] || "").toUpperCase();

  const structure = {
    architectural_style_type: null,
    attachment_type: validateEnum(
      "Detached",
      ALLOWED_ATTACHMENT_TYPES,
      "Structure",
      "attachment_type",
    ),
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary:
      /SIDING/.test(exteriorWall)
        ? validateEnum(
            "Wood Siding",
            ALLOWED_EXTERIOR_WALL_MATERIALS,
            "Structure",
            "exterior_wall_material_primary",
          )
        : /BRICK/.test(exteriorWall)
          ? validateEnum(
              "Brick",
              ALLOWED_EXTERIOR_WALL_MATERIALS,
              "Structure",
              "exterior_wall_material_primary",
            )
          : /STUCCO/.test(exteriorWall)
            ? validateEnum(
                "Stucco",
                ALLOWED_EXTERIOR_WALL_MATERIALS,
                "Structure",
                "exterior_wall_material_primary",
              )
            : null,
    exterior_wall_material_secondary: null,
    finished_base_area:
      typeof building.finishedBaseArea === "number"
        ? building.finishedBaseArea
        : areas["BASE AREA"] ?? null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: /CARPET/.test(floorCover)
      ? validateEnum(
          "Carpet",
          ALLOWED_FLOORING_MATERIALS,
          "Structure",
          "flooring_material_primary",
        )
      : /WOOD/.test(floorCover)
        ? validateEnum(
            "Hardwood",
            ALLOWED_FLOORING_MATERIALS,
            "Structure",
            "flooring_material_primary",
          )
        : /TILE/.test(floorCover)
          ? validateEnum(
              "Tile",
              ALLOWED_FLOORING_MATERIALS,
              "Structure",
              "flooring_material_primary",
            )
          : null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: /SLAB/.test(foundation)
      ? validateEnum(
          "Slab on Grade",
          ALLOWED_FOUNDATION_TYPES,
          "Structure",
          "foundation_type",
        )
      : /PIER|BEAM/.test(foundation)
        ? validateEnum(
            "Pier and Beam",
            ALLOWED_FOUNDATION_TYPES,
            "Structure",
            "foundation_type",
          )
        : null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: /WOOD/.test(structuralFrame)
      ? validateEnum(
          "Wood Frame",
          ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS,
          "Structure",
          "interior_wall_structure_material",
        )
      : null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: /DRYWALL/.test(interiorWall)
      ? validateEnum(
          "Drywall",
          ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS,
          "Structure",
          "interior_wall_surface_material_primary",
        )
      : /PLASTER/.test(interiorWall)
        ? validateEnum(
            "Plaster",
            ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS,
            "Structure",
            "interior_wall_surface_material_primary",
          )
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories:
      typeof building.numberOfStories === "number"
        ? building.numberOfStories
        : null,
    primary_framing_material: /WOOD/.test(structuralFrame)
      ? validateEnum(
          "Wood Frame",
          ALLOWED_FRAMING_MATERIALS,
          "Structure",
          "primary_framing_material",
        )
      : /STEEL/.test(structuralFrame)
        ? validateEnum(
            "Steel Frame",
            ALLOWED_FRAMING_MATERIALS,
            "Structure",
            "primary_framing_material",
          )
        : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: /ARCH|DIMEN/.test(roofCover)
      ? validateEnum(
          "Architectural Asphalt Shingle",
          ALLOWED_ROOF_COVERING_MATERIALS,
          "Structure",
          "roof_covering_material",
        )
      : /SHINGLE/.test(roofCover)
        ? validateEnum(
            "Asphalt Shingle",
            ALLOWED_ROOF_COVERING_MATERIALS,
            "Structure",
            "roof_covering_material",
          )
        : /METAL/.test(roofCover)
          ? validateEnum(
              "Metal",
              ALLOWED_ROOF_COVERING_MATERIALS,
              "Structure",
              "roof_covering_material",
            )
          : null,
    roof_date: null,
    roof_design_type: /GABLE/.test(roofFraming)
      ? validateEnum(
          "Gable",
          ALLOWED_ROOF_DESIGN_TYPES,
          "Structure",
          "roof_design_type",
        )
      : /HIP/.test(roofFraming)
        ? validateEnum(
            "Hip",
            ALLOWED_ROOF_DESIGN_TYPES,
            "Structure",
            "roof_design_type",
          )
        : null,
    roof_material_type: /SHING/.test(roofCover)
      ? validateEnum(
          "Shingle",
          ALLOWED_ROOF_MATERIAL_TYPES,
          "Structure",
          "roof_material_type",
        )
      : /METAL/.test(roofCover)
        ? validateEnum(
            "Metal",
            ALLOWED_ROOF_MATERIAL_TYPES,
            "Structure",
            "roof_material_type",
          )
        : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: /SLAB/.test(foundation)
      ? validateEnum(
          "Concrete Slab",
          ALLOWED_SUBFLOOR_MATERIALS,
          "Structure",
          "subfloor_material",
        )
      : null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  return structure;
}

function main() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found in input.html");
  }

  const buildings = extractBuildings($);
  const structures = buildings.map((building) => createStructureRecord(building));

  const propertyKey = `property_${parcelId}`;
  const output = {};
  output[propertyKey] = {
    structures,
    structure: structures[0] || null,
  };

  ensureDir(path.resolve("data"));
  ensureDir(path.resolve("owners"));

  const outDataPath = path.resolve("data/structure_data.json");
  const outOwnersPath = path.resolve("owners/structure_data.json");

  // fs.writeFileSync(outDataPath, JSON.stringify(output, null, 2), "utf8");
  fs.writeFileSync(outOwnersPath, JSON.stringify(output, null, 2), "utf8");

  console.log("Structure mapping complete:", outDataPath, outOwnersPath);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error in structureMapping:", e.message);
    process.exit(1);
  }
}
