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
      const container = areaSpan.find("~ table > tbody > tr"); // Adjusted selector to find sibling table rows
      container.each((_, tr) => {
        const $tds = $(tr).find("td");
        if ($tds.length >= 2) {
          const key = textNorm($tds.eq(0).text()).toUpperCase();
          const val = toInt($tds.eq(1).text());
          if (key && val != null) areas[key] = val;
        }
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

const ALLOWED_ATTACHMENT_TYPES = ["Attached", "SemiDetached", "Detached", null];
const ALLOWED_EXTERIOR_WALL_MATERIALS = [
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
];
const ALLOWED_FLOORING_MATERIALS = [
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
];
const ALLOWED_SUBFLOOR_MATERIALS = [
  "Plywood",
  "OSB",
  "Concrete Slab",
  "Engineered Wood",
  "Particle Board",
  "Unknown",
  null,
];
const ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS = [
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
  "Brick",
  "Load Bearing",
  "Non-Load Bearing",
  null,
];
const ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS = [
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
];
const ALLOWED_ROOF_COVERING_MATERIALS = [
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
];
const ALLOWED_ROOF_DESIGN_TYPES = [
  "Gable",
  "Hip",
  "Flat",
  "Mansard",
  "Gambrel",
  "Shed",
  "Saltbox",
  "Butterfly",
  "Bonnet",
  "Clerestory",
  "Dome",
  "Barrel",
  "Combination",
  null,
];
const ALLOWED_ROOF_MATERIAL_TYPES = [
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
];
const ALLOWED_FOUNDATION_TYPES = [
  "Slab on Grade",
  "Crawl Space",
  "Full Basement",
  "Partial Basement",
  "Pier and Beam",
  "Basement with Walkout",
  "Stem Wall",
  null,
];
const ALLOWED_FRAMING_MATERIALS = [
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
  "Poured Concrete",
  "Masonry",
  "Engineered Lumber",
  "Post and Beam",
  "Log Construction",
  null,
];

function validateEnum(value, allowed) {
  if (value === null || value === undefined) return null;
  if (!allowed.includes(value)) {
    return null;
  }
  return value;
}

function createStructureRecord(building) {
  const map = building.structuralElements || {};
  const areas = building.finishedBaseArea !== null ? { "BASE AREA": building.finishedBaseArea } : building.areas || {};

  const exteriorWall = (map["EXTERIOR WALL"] || "").toUpperCase();
  const floorCover = (map["FLOOR COVER"] || "").toUpperCase();
  const foundation = (map["FOUNDATION"] || "").toUpperCase();
  const interiorWall = (map["INTERIOR WALL"] || "").toUpperCase();
  const roofCover = (map["ROOF COVER"] || "").toUpperCase();
  const roofFraming = (map["ROOF FRAMING"] || "").toUpperCase();
  const structuralFrame = (map["STRUCTURAL FRAME"] || "").toUpperCase();

  const structure = {
    architectural_style_type: null,
    attachment_type: validateEnum("Detached", ALLOWED_ATTACHMENT_TYPES),
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: /WOOD SIDING/.test(exteriorWall)
      ? validateEnum("Wood Siding", ALLOWED_EXTERIOR_WALL_MATERIALS)
      : /BRICK/.test(exteriorWall)
        ? validateEnum("Brick", ALLOWED_EXTERIOR_WALL_MATERIALS)
        : /STUCCO/.test(exteriorWall)
          ? validateEnum("Stucco", ALLOWED_EXTERIOR_WALL_MATERIALS)
          : /VINYL SIDING/.test(exteriorWall)
            ? validateEnum("Vinyl Siding", ALLOWED_EXTERIOR_WALL_MATERIALS)
            : /ALUMINUM SIDING/.test(exteriorWall)
              ? validateEnum("Metal Siding", ALLOWED_EXTERIOR_WALL_MATERIALS) // Mapping Aluminum Siding to Metal Siding
              : null,
    exterior_wall_material_secondary: null,
    finished_base_area:
      typeof building.finishedBaseArea === "number"
        ? building.finishedBaseArea
        : areas["BASE AREA"] ?? null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: /SOLID HARDWOOD/.test(floorCover)
      ? validateEnum("Solid Hardwood", ALLOWED_FLOORING_MATERIALS)
      : /ENGINEERED HARDWOOD/.test(floorCover)
        ? validateEnum("Engineered Hardwood", ALLOWED_FLOORING_MATERIALS)
        : /LAMINATE/.test(floorCover)
          ? validateEnum("Laminate", ALLOWED_FLOORING_MATERIALS)
          : /LUXURY VINYL PLANK|LVP/.test(floorCover)
            ? validateEnum("Luxury Vinyl Plank", ALLOWED_FLOORING_MATERIALS)
            : /SHEET VINYL/.test(floorCover)
              ? validateEnum("Sheet Vinyl", ALLOWED_FLOORING_MATERIALS)
              : /CERAMIC TILE/.test(floorCover)
                ? validateEnum("Ceramic Tile", ALLOWED_FLOORING_MATERIALS)
                : /PORCELAIN TILE/.test(floorCover)
                  ? validateEnum("Porcelain Tile", ALLOWED_FLOORING_MATERIALS)
                  : /NATURAL STONE TILE|STONE TILE/.test(floorCover)
                    ? validateEnum("Natural Stone Tile", ALLOWED_FLOORING_MATERIALS)
                    : /CARPET/.test(floorCover)
                      ? validateEnum("Carpet", ALLOWED_FLOORING_MATERIALS)
                      : /AREA RUGS/.test(floorCover)
                        ? validateEnum("Area Rugs", ALLOWED_FLOORING_MATERIALS)
                        : /POLISHED CONCRETE|CONCRETE FLOOR/.test(floorCover)
                          ? validateEnum("Polished Concrete", ALLOWED_FLOORING_MATERIALS)
                          : /BAMBOO/.test(floorCover)
                            ? validateEnum("Bamboo", ALLOWED_FLOORING_MATERIALS)
                            : /CORK/.test(floorCover)
                              ? validateEnum("Cork", ALLOWED_FLOORING_MATERIALS)
                              : /LINOLEUM/.test(floorCover)
                                ? validateEnum("Linoleum", ALLOWED_FLOORING_MATERIALS)
                                : /TERRAZZO/.test(floorCover)
                                  ? validateEnum("Terrazzo", ALLOWED_FLOORING_MATERIALS)
                                  : /EPOXY COATING|EPOXY FLOOR/.test(floorCover)
                                    ? validateEnum("Epoxy Coating", ALLOWED_FLOORING_MATERIALS)
                                    : null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: /SLAB/.test(foundation)
      ? validateEnum("Slab on Grade", ALLOWED_FOUNDATION_TYPES)
      : /PIER|BEAM/.test(foundation)
        ? validateEnum("Pier and Beam", ALLOWED_FOUNDATION_TYPES)
        : null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: /WOOD/.test(structuralFrame)
      ? validateEnum("Wood Frame", ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS)
      : null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: /DRYWALL/.test(interiorWall)
      ? validateEnum("Drywall", ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS)
      : /PLASTER/.test(interiorWall)
        ? validateEnum("Plaster", ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS)
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: null,
    number_of_stories:
      typeof building.numberOfStories === "number"
        ? building.numberOfStories
        : null,
    primary_framing_material: /WOOD/.test(structuralFrame)
      ? validateEnum("Wood Frame", ALLOWED_FRAMING_MATERIALS)
      : /STEEL/.test(structuralFrame)
        ? validateEnum("Steel Frame", ALLOWED_FRAMING_MATERIALS)
        : null,
    request_identifier: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: /ARCHITECTURAL ASPHALT SHINGLE|DIMENSIONAL SHINGLE/.test(roofCover)
      ? validateEnum("Architectural Asphalt Shingle", ALLOWED_ROOF_COVERING_MATERIALS)
      : /3-TAB ASPHALT SHINGLE/.test(roofCover)
        ? validateEnum("3-Tab Asphalt Shingle", ALLOWED_ROOF_COVERING_MATERIALS)
        : /METAL STANDING SEAM/.test(roofCover)
          ? validateEnum("Metal Standing Seam", ALLOWED_ROOF_COVERING_MATERIALS)
          : /METAL CORRUGATED/.test(roofCover)
            ? validateEnum("Metal Corrugated", ALLOWED_ROOF_COVERING_MATERIALS)
            : /CLAY TILE/.test(roofCover)
              ? validateEnum("Clay Tile", ALLOWED_ROOF_COVERING_MATERIALS)
              : /CONCRETE TILE/.test(roofCover)
                ? validateEnum("Concrete Tile", ALLOWED_ROOF_COVERING_MATERIALS)
                : /NATURAL SLATE/.test(roofCover)
                  ? validateEnum("Natural Slate", ALLOWED_ROOF_COVERING_MATERIALS)
                  : /SYNTHETIC SLATE/.test(roofCover)
                    ? validateEnum("Synthetic Slate", ALLOWED_ROOF_COVERING_MATERIALS)
                    : /WOOD SHAKE/.test(roofCover)
                      ? validateEnum("Wood Shake", ALLOWED_ROOF_COVERING_MATERIALS)
                      : /WOOD SHINGLE/.test(roofCover)
                        ? validateEnum("Wood Shingle", ALLOWED_ROOF_COVERING_MATERIALS)
                        : /TPO MEMBRANE/.test(roofCover)
                          ? validateEnum("TPO Membrane", ALLOWED_ROOF_COVERING_MATERIALS)
                          : /EPDM MEMBRANE/.test(roofCover)
                            ? validateEnum("EPDM Membrane", ALLOWED_ROOF_COVERING_MATERIALS)
                            : /MODIFIED BITUMEN/.test(roofCover)
                              ? validateEnum("Modified Bitumen", ALLOWED_ROOF_COVERING_MATERIALS)
                              : /BUILT-UP ROOF/.test(roofCover)
                                ? validateEnum("Built-Up Roof", ALLOWED_ROOF_COVERING_MATERIALS)
                                : /GREEN ROOF SYSTEM/.test(roofCover)
                                  ? validateEnum("Green Roof System", ALLOWED_ROOF_COVERING_MATERIALS)
                                  : /SOLAR INTEGRATED TILES/.test(roofCover)
                                    ? validateEnum("Solar Integrated Tiles", ALLOWED_ROOF_COVERING_MATERIALS)
                                    : null,
    roof_date: null,
    roof_design_type: /GABLE/.test(roofFraming)
      ? validateEnum("Gable", ALLOWED_ROOF_DESIGN_TYPES)
      : /HIP/.test(roofFraming)
        ? validateEnum("Hip", ALLOWED_ROOF_DESIGN_TYPES)
        : /FLAT/.test(roofFraming)
          ? validateEnum("Flat", ALLOWED_ROOF_DESIGN_TYPES)
          : /MANSARD/.test(roofFraming)
            ? validateEnum("Mansard", ALLOWED_ROOF_DESIGN_TYPES)
            : /GAMBREL/.test(roofFraming)
              ? validateEnum("Gambrel", ALLOWED_ROOF_DESIGN_TYPES)
              : /SHED/.test(roofFraming)
                ? validateEnum("Shed", ALLOWED_ROOF_DESIGN_TYPES)
                : /SALTBOX/.test(roofFraming)
                  ? validateEnum("Saltbox", ALLOWED_ROOF_DESIGN_TYPES)
                  : /BUTTERFLY/.test(roofFraming)
                    ? validateEnum("Butterfly", ALLOWED_ROOF_DESIGN_TYPES)
                    : /BONNET/.test(roofFraming)
                      ? validateEnum("Bonnet", ALLOWED_ROOF_DESIGN_TYPES)
                      : /CLERESTORY/.test(roofFraming)
                        ? validateEnum("Clerestory", ALLOWED_ROOF_DESIGN_TYPES)
                        : /DOME/.test(roofFraming)
                          ? validateEnum("Dome", ALLOWED_ROOF_DESIGN_TYPES)
                          : /BARREL/.test(roofFraming)
                            ? validateEnum("Barrel", ALLOWED_ROOF_DESIGN_TYPES)
                            : /COMBINATION/.test(roofFraming)
                              ? validateEnum("Combination", ALLOWED_ROOF_DESIGN_TYPES)
                              : null,
    roof_material_type: /SHINGLE/.test(roofCover)
      ? validateEnum("Shingle", ALLOWED_ROOF_MATERIAL_TYPES)
      : /TILE/.test(roofCover)
        ? validateEnum("Tile", ALLOWED_ROOF_MATERIAL_TYPES)
        : /METAL/.test(roofCover)
          ? validateEnum("Metal", ALLOWED_ROOF_MATERIAL_TYPES)
          : /WOOD/.test(roofCover)
            ? validateEnum("Wood", ALLOWED_ROOF_MATERIAL_TYPES)
            : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    source_http_request: null,
    structural_damage_indicators: null,
    subfloor_material: /CONCRETE SLAB/.test(foundation)
      ? validateEnum("Concrete Slab", ALLOWED_SUBFLOOR_MATERIALS)
      : /PLYWOOD/.test(foundation)
        ? validateEnum("Plywood", ALLOWED_SUBFLOOR_MATERIALS)
        : /OSB/.test(foundation)
          ? validateEnum("OSB", ALLOWED_SUBFLOOR_MATERIALS)
          : /ENGINEERED WOOD/.test(foundation)
            ? validateEnum("Engineered Wood", ALLOWED_SUBFLOOR_MATERIALS)
            : /PARTICLE BOARD/.test(foundation)
              ? validateEnum("Particle Board", ALLOWED_SUBFLOOR_MATERIALS)
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

  fs.writeFileSync(outDataPath, JSON.stringify(output, null, 2), "utf8");
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