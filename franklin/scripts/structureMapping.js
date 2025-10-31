// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function extractPropertyId($) {
  const parcelHeader = $("section.title h1").first().text().trim();
  let parcelIdentifier = null;
  const m = parcelHeader.match(/Parcel\s+(.+)/i);
  if (m) parcelIdentifier = m[1];
  if (!parcelIdentifier) {
    const title = $("title").text();
    const m2 = title.match(/(\d{2}-\d{2}-\d{2}-\d{4}-\d{4}-\d{4})/);
    if (m2) parcelIdentifier = m2[1];
  }
  return parcelIdentifier;
}

function mapExteriorWall(details) {
  if (!details) return null;
  const u = details.toUpperCase();
  if (u.includes("BRICK") || u.includes("BRK")) return "Brick";
  if (u.includes("NATURAL STONE") || u.includes("STONE")) return "Natural Stone";
  if (u.includes("MANUFACTURED STONE")) return "Manufactured Stone";
  if (u.includes("STUCCO") || u.includes("STUC")) return "Stucco";
  if (u.includes("VINYL SIDING") || u.includes("VINYL")) return "Vinyl Siding";
  if (u.includes("WOOD SIDING") || u.includes("WOOD SID")) return "Wood Siding";
  if (u.includes("FIBER CEMENT") || u.includes("CEMENT SIDING")) return "Fiber Cement Siding";
  if (u.includes("METAL SIDING") || u.includes("METAL SID")) return "Metal Siding";
  if (u.includes("CONCRETE BLOCK") || u.includes("CONC BLOCK")) return "Concrete Block";
  if (u.includes("EIFS")) return "EIFS";
  if (u.includes("LOG")) return "Log";
  if (u.includes("ADOBE")) return "Adobe";
  if (u.includes("PRECAST CONCRETE") || u.includes("PRECAST")) return "Precast Concrete";
  if (u.includes("CURTAIN WALL")) return "Curtain Wall";
  return null;
}

function mapRoofCover(s) {
  const u = (s || "").toUpperCase();
  if (u.includes("3-TAB") || u.includes("COMP SHNGL") || u.includes("COMPOSITION")) return "3-Tab Asphalt Shingle";
  if (u.includes("ARCH SHNGL") || u.includes("ARCHITECTURAL")) return "Architectural Asphalt Shingle";
  if (u.includes("METAL STANDING SEAM") || u.includes("STANDING SEAM")) return "Metal Standing Seam";
  if (u.includes("METAL CORRUGATED") || u.includes("CORRUGATED METAL")) return "Metal Corrugated";
  if (u.includes("CLAY TILE")) return "Clay Tile";
  if (u.includes("CONCRETE TILE")) return "Concrete Tile";
  if (u.includes("NATURAL SLATE") || u.includes("SLATE")) return "Natural Slate";
  if (u.includes("SYNTHETIC SLATE")) return "Synthetic Slate";
  if (u.includes("WOOD SHAKE")) return "Wood Shake";
  if (u.includes("WOOD SHINGLE")) return "Wood Shingle";
  if (u.includes("TPO MEMBRANE") || u.includes("TPO")) return "TPO Membrane";
  if (u.includes("EPDM MEMBRANE") || u.includes("EPDM")) return "EPDM Membrane";
  if (u.includes("MODIFIED BITUMEN")) return "Modified Bitumen";
  if (u.includes("BUILT-UP ROOF") || u.includes("BUILT UP")) return "Built-Up Roof";
  if (u.includes("GREEN ROOF")) return "Green Roof System";
  if (u.includes("SOLAR INTEGRATED") || u.includes("SOLAR TILES")) return "Solar Integrated Tiles";
  if (u.includes("METAL")) return "Metal Standing Seam";
  return null;
}

function mapPrimaryFraming(s) {
  const u = (s || "").toUpperCase();
  if (u.includes("WOOD FRAME") || u.includes("WOOD")) return "Wood Frame";
  if (u.includes("STEEL FRAME") || u.includes("STEEL")) return "Steel Frame";
  if (u.includes("CONCRETE BLOCK") || u.includes("CONC BLOCK")) return "Concrete Block";
  if (u.includes("POURED CONCRETE") || u.includes("POURED CONC")) return "Poured Concrete";
  if (u.includes("MASONRY")) return "Masonry";
  if (u.includes("ENGINEERED LUMBER") || u.includes("ENG LUMBER")) return "Engineered Lumber";
  if (u.includes("POST AND BEAM") || u.includes("POST & BEAM")) return "Post and Beam";
  if (u.includes("LOG CONSTRUCTION") || u.includes("LOG")) return "Log Construction";
  return null;
}

function mapRoofDesign(s) {
  const u = (s || "").toUpperCase();
  if (u.includes("GABLE")) return "Gable";
  if (u.includes("HIP")) return "Hip";
  if (u.includes("FLAT")) return "Flat";
  if (u.includes("MANSARD")) return "Mansard";
  if (u.includes("GAMBREL")) return "Gambrel";
  if (u.includes("SHED")) return "Shed";
  if (u.includes("SALTBOX")) return "Saltbox";
  if (u.includes("BUTTERFLY")) return "Butterfly";
  if (u.includes("BONNET")) return "Bonnet";
  if (u.includes("CLERESTORY")) return "Clerestory";
  if (u.includes("DOME")) return "Dome";
  if (u.includes("BARREL")) return "Barrel";
  if (u.includes("COMBINATION") || u.includes("IRREGULAR")) return "Combination";
  return null;
}

function mapAttachmentType(s) {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes("DETACHED")) return "Detached";
  if (u.includes("ATTACHED")) return "Attached";
  if (u.includes("SEMI")) return "SemiDetached";
  return null;
}
function mapSubfloorMaterial(s) {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes("CONCRETE") || u.includes("SLAB")) return "Concrete Slab";
  if (u.includes("WOOD") || u.includes("PLYWOOD")) return "Plywood";
  if (u.includes("CRAWL")) return "Crawl Space";
  return null;
}

function mapInteriorWallSurface(details) {
  if (!details) return null;
  const u = details.toUpperCase();
  if (u.includes("DRYWALL")) return "Drywall";
  if (u.includes("PLASTER")) return "Plaster";
  if (u.includes("WOOD PANELING") || u.includes("WOOD PANEL")) return "Wood Paneling";
  if (u.includes("EXPOSED BRICK") || u.includes("EXP BRICK")) return "Exposed Brick";
  if (u.includes("EXPOSED BLOCK") || u.includes("EXP BLOCK")) return "Exposed Block";
  if (u.includes("WAINSCOTING")) return "Wainscoting";
  if (u.includes("SHIPLAP")) return "Shiplap";
  if (u.includes("BOARD AND BATTEN") || u.includes("BOARD & BATTEN")) return "Board and Batten";
  if (u.includes("TILE")) return "Tile";
  if (u.includes("STONE VENEER")) return "Stone Veneer";
  if (u.includes("METAL PANELS") || u.includes("METAL PANEL")) return "Metal Panels";
  if (u.includes("GLASS PANELS") || u.includes("GLASS PANEL")) return "Glass Panels";
  if (u.includes("CONCRETE")) return "Concrete";
  return null;
}

function mapFlooringPrimary(s) {
  const u = (s || "").toUpperCase();
  if (u.includes("SOLID HARDWOOD") || u.includes("SOLID WOOD")) return "Solid Hardwood";
  if (u.includes("ENGINEERED HARDWOOD") || u.includes("ENGINEERED WOOD")) return "Engineered Hardwood";
  if (u.includes("LAMINATE")) return "Laminate";
  if (u.includes("LUXURY VINYL PLANK") || u.includes("LVP")) return "Luxury Vinyl Plank";
  if (u.includes("SHEET VINYL")) return "Sheet Vinyl";
  if (u.includes("CERAMIC TILE") || u.includes("CERAMIC") || u.includes("CLAY TILE")) return "Ceramic Tile";
  if (u.includes("PORCELAIN TILE") || u.includes("PORCELAIN")) return "Porcelain Tile";
  if (u.includes("NATURAL STONE TILE") || u.includes("STONE TILE")) return "Natural Stone Tile";
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("AREA RUGS") || u.includes("RUGS")) return "Area Rugs";
  if (u.includes("POLISHED CONCRETE")) return "Polished Concrete";
  if (u.includes("BAMBOO")) return "Bamboo";
  if (u.includes("CORK")) return "Cork";
  if (u.includes("LINOLEUM")) return "Linoleum";
  if (u.includes("TERRAZZO")) return "Terrazzo";
  if (u.includes("EPOXY COATING") || u.includes("EPOXY")) return "Epoxy Coating";
  if (u.includes("WOOD")) return "Solid Hardwood";
  return null;
}

function mapFlooringSecondary(s) {
  const u = (s || "").toUpperCase();
  if (u.includes("SOLID HARDWOOD") || u.includes("SOLID WOOD")) return "Solid Hardwood";
  if (u.includes("ENGINEERED HARDWOOD") || u.includes("ENGINEERED WOOD")) return "Engineered Hardwood";
  if (u.includes("LAMINATE")) return "Laminate";
  if (u.includes("LUXURY VINYL PLANK") || u.includes("LVP")) return "Luxury Vinyl Plank";
  if (u.includes("CERAMIC TILE") || u.includes("CERAMIC") || u.includes("CLAY TILE")) return "Ceramic Tile";
  if (u.includes("CARPET")) return "Carpet";
  if (u.includes("AREA RUGS") || u.includes("RUGS")) return "Area Rugs";
  if (u.includes("TRANSITION STRIPS") || u.includes("TRANSITION")) return "Transition Strips";
  if (u.includes("WOOD")) return "Solid Hardwood";
  return null;
}

function mapFoundationMaterial(s) {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u.includes("POURED CONCRETE") || u.includes("POURED CONC")) return "Poured Concrete";
  if (u.includes("CONCRETE BLOCK") || u.includes("CONC BLOCK")) return "Concrete Block";
  if (u.includes("STONE")) return "Stone";
  if (u.includes("BRICK")) return "Brick";
  if (u.includes("TREATED WOOD POSTS") || u.includes("WOOD POSTS")) return "Treated Wood Posts";
  if (u.includes("STEEL PIERS") || u.includes("STEEL PIER")) return "Steel Piers";
  if (u.includes("PRECAST CONCRETE") || u.includes("PRECAST")) return "Precast Concrete";
  if (u.includes("INSULATED CONCRETE FORMS") || u.includes("ICF")) return "Insulated Concrete Forms";
  return null;
}

function parseStories(s) {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function run() {
  const inputPath = path.resolve("input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const propId = extractPropertyId($);

  const structures = [];
  let structureIndex = 1;

  // Create structure for each building
  $('section.buildings .building-data').each((buildingIndex, buildingElement) => {
    // Extract structure data from building's structural elements
    let exteriorWall = null, roofCover = null, roofStructure = null, interiorWall = null, frameDesc = null, storiesDesc = null;
    let interiorFlooring1 = null, interiorFlooring2 = null, attachmentTypeDesc = null, subfloorDesc = null;
    
    const floorings = [];
    $(buildingElement).find('.se table tbody tr').each((i, tr) => {
      const tds = $(tr).find('td');
      const desc = $(tds[1]).text().trim();
      const details = $(tds[3]).text().trim();
      
      if (/Exterior Wall/i.test(desc)) exteriorWall = details;
      if (/Roof Cover/i.test(desc)) roofCover = details;
      if (/Roof Structure/i.test(desc)) roofStructure = details;
      if (/Interior Wall/i.test(desc)) interiorWall = details;
      if (/Interior Flooring/i.test(desc)) floorings.push(details);
      if (/Frame/i.test(desc)) frameDesc = details;
      if (/Stories/i.test(desc)) storiesDesc = details;
      if (/Attachment/i.test(desc)) attachmentTypeDesc = details;
      if (/Subfloor|Foundation/i.test(desc)) subfloorDesc = details;
    });
    
    interiorFlooring1 = floorings[0] || null;
    interiorFlooring2 = floorings[1] || null;
    
    let buildingSqft = null;
    const buildingTable = $(buildingElement).find('table.grid2').first();
    if (buildingTable.length) {
      let heatedIndex = -1;
      buildingTable.find('thead th').each((idx, th) => {
        const headerText = $(th).text().replace(/\s+/g, ' ').trim();
        if (/Heated Sq Ft/i.test(headerText)) heatedIndex = idx;
      });
      if (heatedIndex !== -1) {
        const heatedCell = buildingTable.find('tbody tr').first().find('td').eq(heatedIndex);
        const heatedText = heatedCell.text().replace(/[,]/g, '').trim();
        if (heatedText) {
          const parsed = Number(heatedText);
          if (!Number.isNaN(parsed)) buildingSqft = parsed;
        }
      }
    }
    
    const structure = {
      source_http_request: {
        method: "GET",
        url: "https://example.com/structure-data"
      },
      request_identifier: `${propId}_structure_${structureIndex}`,
      architectural_style_type: null,
      attachment_type: mapAttachmentType(attachmentTypeDesc),
      exterior_wall_material_primary: mapExteriorWall(exteriorWall),
      exterior_wall_material_secondary: null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: null,
      flooring_material_primary: mapFlooringPrimary(interiorFlooring1),
      flooring_material_secondary: mapFlooringSecondary(interiorFlooring2),
      subfloor_material: null,
      flooring_condition: null,
      interior_wall_structure_material: null,
      interior_wall_surface_material_primary: mapInteriorWallSurface(interiorWall),
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: mapRoofCover(roofCover),
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: mapRoofDesign(roofStructure),
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type: roofCover && roofCover.toUpperCase().includes("COMP") ? "Composition" : null,
      foundation_type: null,
      foundation_material: mapFoundationMaterial(subfloorDesc),
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
      primary_framing_material: mapPrimaryFraming(frameDesc),
      secondary_framing_material: null,
      structural_damage_indicators: null,
      finished_base_area: buildingSqft,
      finished_basement_area: null,
      finished_upper_story_area: null,
      number_of_stories: parseStories(storiesDesc),
      roof_date: null,
      siding_installation_date: null,
      exterior_door_installation_date: null,
      foundation_repair_date: null,
      window_installation_date: null,
      building_number: buildingIndex + 1,
      structure_index: structureIndex
    };
    
    structures.push(structure);
    structureIndex++;
  });

  const outObj = {};
  outObj[`property_${propId}`] = { structures };

  ensureDir(path.resolve("owners"));
  fs.writeFileSync(
    path.resolve("owners/structure_data.json"),
    JSON.stringify(outObj, null, 2),
  );
  console.log("Wrote owners/structure_data.json for", propId, "with", structures.length, "structures");
}

run();
