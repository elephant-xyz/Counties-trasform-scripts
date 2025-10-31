const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseIntSafe(txt) {
  if (txt == null) return null;
  const m = String(txt).replace(/[^0-9\-]/g, "");
  if (!m) return null;
  const v = parseInt(m, 10);
  return isNaN(v) ? null : v;
}

function extractStrap($, rawHtml) {
  let strap = null;
  const scriptsText = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scriptsText.match(/var\s+g_strap\s*=\s*"(\d+)"/);
  if (m) strap = m[1];
  if (!strap) {
    const pn = $("#pacel_no").text().trim();
    if (pn) strap = pn.replace(/\D/g, "");
  }
  return strap || "unknown_id";
}

/**
 * Extracts key-value pairs from a specific "Structural Elements" table.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @param {string} panelId - The ID of the structural panel (e.g., 'structural_1').
 * @returns {Object} A map of structural elements.
 */
function extractStructuralKeyValues($, panelId) {
  const map = {};
  const $panel = $(`#${panelId}`);
  const $structTable = $panel.find("table.table-bordered").filter((i, tbl) => {
    return $(tbl).find("thead th").first().text().trim().toLowerCase().includes("structural elements");
  }).first();

  if ($structTable.length > 0) {
    $structTable.find("tbody tr").each((i, tr) => {
      const k = $(tr).find("td").eq(0).text().trim().replace(/:$/, "");
      const v = $(tr).find("td").eq(1).text().trim();
      if (k) map[k] = v;
    });
  }
  return map;
}

/**
 * Aggregates finished and unfinished base areas from all "Sub Area" tables.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @returns {{finishedArea: number, unFinishedArea: number}}
 */
function aggregateBaseAreas($) {
  let totalFinishedArea = 0;
  let totalUnFinishedArea = 0;

  // Iterate through all "Structural Elements and Sub Area Information" panels
  $("#divStructuralElementContainer .panel.panel-default.col-Area-Information").each((buildingIdx, buildingEl) => {
    const $buildingEl = $(buildingEl);
    const $subAreaTable = $buildingEl.find("table.table-bordered").filter((i, table) => {
      return $(table).find("thead th").first().text().trim() === "Sub Area";
    }).first();

    if ($subAreaTable.length > 0) {
      $subAreaTable.find('tbody tr').each((i, row) => {
        const $row = $(row);
        const subAreaText = $row.find('td').eq(0).text().trim();

        // Skip the "Total Area SF" summary row
        if (subAreaText.toLowerCase().includes("total area sf")) {
          return;
        }

        const heatedAreaSfText = $row.find('td').eq(1).text().trim();
        const grossAreaSfText = $row.find('td').eq(2).text().trim();
        const sizeSqFt = parseIntSafe(grossAreaSfText) || parseIntSafe(heatedAreaSfText);

        if (sizeSqFt === null || sizeSqFt === 0) {
          return;
        }

        const unfinished_regex = /SEMI-FINISHED|UNFINISHED|SEMIFINISHED/i;
        const is_finished = !unfinished_regex.test(subAreaText);
        const base_regex = /BASE/i; // Assuming 'Base' refers to the primary ground floor area

        if (base_regex.test(subAreaText)) {
          if (is_finished) {
            totalFinishedArea += sizeSqFt;
          } else {
            totalUnFinishedArea += sizeSqFt;
          }
        }
      });
    }
  });
  return { finishedArea: totalFinishedArea, unFinishedArea: totalUnFinishedArea };
}

function getCurrentYear($) {
  const updated = $("#lblUpdatedAt").text(); // e.g., (as of 27-Aug-2025)
  const m = updated.match(/(19|20)\d{2}/);
  if (m) return parseInt(m[0], 10);
  return new Date().getFullYear();
}

function extractRoofYear($) {
  let year = null;
  $("#tblPermit tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const desc = (tds.eq(1).text() || "").trim();
    if (/roof/i.test(desc)) {
      const dateStr = (tds.eq(2).text() || "").trim(); // e.g., 09/10/2021
      const ym = dateStr.match(/(19|20)\d{2}/);
      if (ym) {
        year = parseInt(ym[0], 10);
        return false; // Stop after finding the first roof permit
      }
    }
  });
  return year;
}

// --- MAPPING FUNCTIONS TO SCHEMA ENUMS ---

function mapFoundationType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("slab on grade") || val.includes("slab")) return "Slab on Grade";
  if (val.includes("crawl")) return "Crawl Space";
  if (val.includes("full basement")) return "Full Basement";
  if (val.includes("partial basement")) return "Partial Basement";
  if (val.includes("pier") || val.includes("beam")) return "Pier and Beam";
  if (val.includes("walkout")) return "Basement with Walkout";
  if (val.includes("stem wall")) return "Stem Wall";
  if (val.includes("spread/mono footing")) return "Slab on Grade";
  return null;
}

function mapFoundationMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("poured concrete") || val.includes("concrete")) return "Poured Concrete";
  if (val.includes("concrete block") || val.includes("block")) return "Concrete Block";
  if (val.includes("stone")) return "Stone";
  if (val.includes("brick")) return "Brick";
  if (val.includes("treated wood") || val.includes("wood posts")) return "Treated Wood Posts";
  if (val.includes("steel pier")) return "Steel Piers";
  if (val.includes("precast")) return "Precast Concrete";
  if (val.includes("icf") || val.includes("insulated concrete")) return "Insulated Concrete Forms";
  return null;
}

function mapExteriorWallMaterialPrimary(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("brick")) return "Brick";
  if (val.includes("natural stone")) return "Natural Stone";
  if (val.includes("manufactured stone")) return "Manufactured Stone";
  if (val.includes("stucco")) return "Stucco";
  if (val.includes("vinyl siding")) return "Vinyl Siding";
  if (val.includes("wood siding")) return "Wood Siding";
  if (val.includes("fiber cement")) return "Fiber Cement Siding";
  if (val.includes("metal siding")) return "Metal Siding";
  if (val.includes("concrete block") || val.includes("concrete blk")) return "Concrete Block";
  if (val.includes("eifs")) return "EIFS";
  if (val.includes("log")) return "Log";
  if (val.includes("adobe")) return "Adobe";
  if (val.includes("precast concrete")) return "Precast Concrete";
  if (val.includes("curtain wall")) return "Curtain Wall";
  return null;
}

function mapExteriorWallMaterialSecondary(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("brick accent")) return "Brick Accent";
  if (val.includes("stone accent")) return "Stone Accent";
  if (val.includes("wood trim")) return "Wood Trim";
  if (val.includes("metal trim")) return "Metal Trim";
  if (val.includes("stucco accent")) return "Stucco Accent";
  if (val.includes("vinyl accent")) return "Vinyl Accent";
  if (val.includes("decorative block")) return "Decorative Block";
  if (val.includes("concrete blk/stucco")) return "Stucco Accent";
  return null;
}

function mapFlooringMaterialPrimary(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("solid hardwood")) return "Solid Hardwood";
  if (val.includes("engineered hardwood")) return "Engineered Hardwood";
  if (val.includes("laminate")) return "Laminate";
  if (val.includes("luxury vinyl plank") || val.includes("lvp")) return "Luxury Vinyl Plank";
  if (val.includes("sheet vinyl")) return "Sheet Vinyl";
  if (val.includes("ceramic tile") || val.includes("hard tile")) return "Ceramic Tile";
  if (val.includes("porcelain tile")) return "Porcelain Tile";
  if (val.includes("natural stone tile")) return "Natural Stone Tile";
  if (val.includes("carpet")) return "Carpet";
  if (val.includes("area rugs")) return "Area Rugs";
  if (val.includes("polished concrete") || val.includes("concrete finish")) return "Polished Concrete";
  if (val.includes("bamboo")) return "Bamboo";
  if (val.includes("cork")) return "Cork";
  if (val.includes("linoleum")) return "Linoleum";
  if (val.includes("terrazzo")) return "Terrazzo";
  if (val.includes("epoxy")) return "Epoxy Coating";
  return null;
}

function mapFlooringMaterialSecondary(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("carpet combination")) return "Ceramic Tile";
  if (val.includes("transition strips")) return "Transition Strips";
  return null;
}

function mapInteriorWallSurfaceMaterialPrimary(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("drywall") || val.includes("dry wall")) return "Drywall";
  if (val.includes("plaster")) return "Plaster";
  if (val.includes("wood paneling")) return "Wood Paneling";
  if (val.includes("exposed brick")) return "Exposed Brick";
  if (val.includes("exposed block") || val.includes("masonry")) return "Exposed Block";
  if (val.includes("wainscoting")) return "Wainscoting";
  if (val.includes("shiplap")) return "Shiplap";
  if (val.includes("board and batten")) return "Board and Batten";
  if (val.includes("tile")) return "Tile";
  if (val.includes("stone veneer")) return "Stone Veneer";
  if (val.includes("metal panels")) return "Metal Panels";
  if (val.includes("glass panels")) return "Glass Panels";
  if (val.includes("concrete")) return "Concrete";
  return null;
}

function mapCeilingSurfaceMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("drywall") || val.includes("dry wall")) return "Drywall";
  if (val.includes("plaster")) return "Plaster";
  if (val.includes("wood planks")) return "Wood Planks";
  if (val.includes("acoustic tile")) return "Acoustic Tile";
  if (val.includes("metal panels")) return "Metal Panels";
  if (val.includes("suspended grid")) return "Suspended Grid";
  if (val.includes("coffered")) return "Coffered";
  if (val.includes("tray")) return "Tray";
  if (val.includes("exposed structure")) return "Exposed Structure";
  return null; // Default
}

function mapRoofCoveringMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("3-tab asphalt")) return "3-Tab Asphalt Shingle";
  if (val.includes("architectural asphalt")) return "Architectural Asphalt Shingle";
  if (val.includes("metal standing seam")) return "Metal Standing Seam";
  if (val.includes("metal corrugated")) return "Metal Corrugated";
  if (val.includes("clay tile")) return "Clay Tile";
  if (val.includes("concrete tile")) return "Concrete Tile";
  if (val.includes("natural slate")) return "Natural Slate";
  if (val.includes("synthetic slate")) return "Synthetic Slate";
  if (val.includes("wood shake")) return "Wood Shake";
  if (val.includes("wood shingle")) return "Wood Shingle";
  if (val.includes("tpo")) return "TPO Membrane";
  if (val.includes("epdm")) return "EPDM Membrane";
  if (val.includes("modified bitumen")) return "Modified Bitumen";
  if (val.includes("built-up") || val.includes("built up")) return "Built-Up Roof";
  if (val.includes("green roof")) return "Green Roof System";
  if (val.includes("solar")) return "Solar Integrated Tiles";
  if (val.includes("blt up metal/gypsum")) return "Built-Up Roof";
  return null;
}

function mapRoofDesignType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("gable")) return "Gable";
  if (val.includes("hip")) return "Hip";
  if (val.includes("flat") || val.includes("bar joint") || val.includes("rigid frame")) return "Flat";
  if (val.includes("mansard")) return "Mansard";
  if (val.includes("gambrel")) return "Gambrel";
  if (val.includes("shed")) return "Shed";
  if (val.includes("saltbox")) return "Saltbox";
  if (val.includes("butterfly")) return "Butterfly";
  if (val.includes("bonnet")) return "Bonnet";
  if (val.includes("clerestory")) return "Clerestory";
  if (val.includes("dome")) return "Dome";
  if (val.includes("barrel")) return "Barrel";
  if (val.includes("combination")) return "Combination";
  return null;
}

function mapRoofMaterialType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("manufactured")) return "Manufactured";
  if (val.includes("engineered wood")) return "EngineeredWood";
  if (val.includes("terrazzo")) return "Terazzo";
  if (val.includes("brick")) return "Brick";
  if (val.includes("wood")) return "Wood";
  if (val.includes("cinder block")) return "CinderBlock";
  if (val.includes("concrete")) return "Concrete";
  if (val.includes("shingle")) return "Shingle";
  if (val.includes("composition") || val.includes("built up/composition")) return "Composition";
  if (val.includes("linoleum")) return "Linoleum";
  if (val.includes("stone")) return "Stone";
  if (val.includes("ceramic tile")) return "CeramicTile";
  if (val.includes("block")) return "Block";
  if (val.includes("wood siding")) return "WoodSiding";
  if (val.includes("impact glass")) return "ImpactGlass";
  if (val.includes("carpet")) return "Carpet";
  if (val.includes("marble")) return "Marble";
  if (val.includes("vinyl")) return "Vinyl";
  if (val.includes("tile")) return "Tile";
  if (val.includes("poured concrete")) return "PouredConcrete";
  if (val.includes("metal") || val.includes("blt up metal")) return "Metal";
  if (val.includes("glass")) return "Glass";
  if (val.includes("laminate")) return "Laminate";
  return null;
}

function mapArchitecturalStyleType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("mid century") || val.includes("midcentury")) return "MidCenturyModern";
  if (val.includes("contemporary")) return "Contemporary";
  if (val.includes("victorian")) return "Victorian";
  if (val.includes("ranch")) return "Ranch";
  if (val.includes("craftsman")) return "Craftsman";
  if (val.includes("tudor")) return "Tudor";
  if (val.includes("minimalist")) return "Minimalist";
  if (val.includes("colonial")) return "Colonial";
  if (val.includes("farmhouse")) return "Farmhouse";
  return null;
}

function mapAttachmentType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("attached")) return "Attached";
  if (val.includes("semi") || val.includes("duplex")) return "SemiDetached";
  if (val.includes("detached")) return "Detached";
  return null;
}

function mapCondition(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("new")) return "New";
  if (val.includes("excellent")) return "Excellent";
  if (val.includes("good")) return "Good";
  if (val.includes("fair")) return "Fair";
  if (val.includes("poor")) return "Poor";
  if (val.includes("damaged")) return "Damaged";
  if (val.includes("leaking")) return "Leaking";
  return null; // Default
}

function mapInsulationType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("fiberglass batt") || val.includes("fiberglass")) return "Fiberglass Batt";
  if (val.includes("blown cellulose") || val.includes("blown")) return "Blown Cellulose";
  if (val.includes("spray foam")) return "Spray Foam";
  if (val.includes("rigid foam") || val.includes("rigid")) return "Rigid Foam Board";
  if (val.includes("reflective")) return "Reflective Barrier";
  if (val.includes("rock wool")) return "Rock Wool";
  if (val.includes("natural fiber")) return "Natural Fiber";
  return "Unknown";
}

function mapDoorMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("solid wood")) return "Solid Wood";
  if (val.includes("hollow core")) return "Hollow Core";
  if (val.includes("solid core")) return "Solid Core";
  if (val.includes("glass panel")) return "Glass Panel";
  if (val.includes("metal") || val.includes("steel")) return "Metal";
  if (val.includes("composite")) return "Composite";
  if (val.includes("molded")) return "Molded";
  if (val.includes("bifold")) return "Bifold";
  if (val.includes("pocket")) return "Pocket Door";
  if (val.includes("barn")) return "Barn Door";
  if (val.includes("wood")) return "Solid Wood";
  if (val.includes("fiberglass")) return "Fiberglass";
  if (val.includes("aluminum")) return "Aluminum";
  if (val.includes("glass")) return "Glass";
  if (val.includes("vinyl")) return "Vinyl";
  if (val.includes("wrought iron")) return "Wrought Iron";
  if (val.includes("security")) return "Security Door";
  return null;
}

function mapWindowMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("vinyl")) return "Vinyl";
  if (val.includes("wood")) return "Wood";
  if (val.includes("aluminum")) return "Aluminum";
  if (val.includes("fiberglass")) return "Fiberglass";
  if (val.includes("steel")) return "Steel";
  if (val.includes("composite")) return "Composite";
  if (val.includes("aluminum clad wood")) return "Aluminum Clad Wood";
  if (val.includes("vinyl clad wood")) return "Vinyl Clad Wood";
  return null;
}

function mapGlazingType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("single pane") || val.includes("single")) return "Single Pane";
  if (val.includes("double pane") || val.includes("double")) return "Double Pane";
  if (val.includes("triple pane") || val.includes("triple")) return "Triple Pane";
  if (val.includes("low-e")) return "Low-E Coated";
  if (val.includes("tempered")) return "Tempered";
  if (val.includes("laminated")) return "Laminated";
  if (val.includes("impact resistant") || val.includes("impact")) return "Impact Resistant";
  if (val.includes("argon")) return "Argon Filled";
  if (val.includes("tinted")) return "Tinted";
  if (val.includes("smart glass")) return "Smart Glass";
  return null; // Default
}

function mapFramingMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("wood frame") || val.includes("wood")) return "Wood Frame";
  if (val.includes("steel frame") || val.includes("steel")) return "Steel Frame";
  if (val.includes("concrete block")) return "Concrete Block";
  if (val.includes("poured concrete")) return "Poured Concrete";
  if (val.includes("masonry")) return "Masonry";
  if (val.includes("engineered lumber")) return "Engineered Lumber";
  if (val.includes("post and beam")) return "Post and Beam";
  if (val.includes("log")) return "Log Construction";
  return null;
}

function mapInteriorWallStructureMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("wood frame") || val.includes("wood")) return "Wood Frame";
  if (val.includes("steel frame") || val.includes("steel")) return "Steel Frame";
  if (val.includes("concrete block")) return "Concrete Block";
  if (val.includes("brick")) return "Brick";
  if (val.includes("load bearing")) return "Load Bearing";
  if (val.includes("non-load bearing") || val.includes("non load bearing")) return "Non-Load Bearing";
  return null;
}

function mapSubfloorMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("plywood")) return "Plywood";
  if (val.includes("osb")) return "OSB";
  if (val.includes("concrete slab") || val.includes("slab")) return "Concrete Slab";
  if (val.includes("engineered wood")) return "Engineered Wood";
  if (val.includes("particle board")) return "Particle Board";
  return "Unknown";
}

function mapWindowOperationType(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("double hung")) return "Double Hung";
  if (val.includes("single hung")) return "Single Hung";
  if (val.includes("casement")) return "Casement";
  if (val.includes("sliding")) return "Sliding";
  if (val.includes("awning")) return "Awning";
  if (val.includes("picture")) return "Picture";
  if (val.includes("bay")) return "Bay";
  if (val.includes("bow")) return "Bow";
  if (val.includes("garden")) return "Garden";
  if (val.includes("skylights")) return "Skylights";
  if (val.includes("jalousie")) return "Jalousie";
  if (val.includes("fixed")) return "Fixed";
  return null;
}

function mapGuttersMaterial(htmlValue) {
  const val = (htmlValue || "").toLowerCase();
  if (val.includes("aluminum")) return "Aluminum";
  if (val.includes("vinyl")) return "Vinyl";
  if (val.includes("steel")) return "Steel";
  if (val.includes("copper")) return "Copper";
  if (val.includes("galvanized")) return "Galvanized Steel";
  return null;
}

// --- MAIN BUILD FUNCTION ---

function buildStructure($, rawHtml) {
  const strap = extractStrap($, rawHtml);
  // Extract structural elements for Building 1 (as the primary structure)
  const kv = extractStructuralKeyValues($, 'structural_1');

  // Aggregate finished and unfinished base areas from all buildings
  const aggregatedAreas = aggregateBaseAreas($);

  const currentYear = getCurrentYear($);
  const roofYear = extractRoofYear($);
  const roofAgeYears = roofYear ? Math.max(1, currentYear - roofYear) : null;

  // Define request_identifier and source_http_request (placeholders)
  const requestIdentifier = strap;
  const sourceHttpRequest = {
    method: "GET",
    url: `https://www.pcpao.gov/property-details?s=${strap}`, // Example URL
  };

  const structure = {
    source_http_request: sourceHttpRequest,
    request_identifier: requestIdentifier,
    architectural_style_type: mapArchitecturalStyleType(kv["Building Type"]),
    attachment_type: mapAttachmentType(kv["Building Type"]),
    exterior_wall_material_primary: mapExteriorWallMaterialPrimary(kv["Exterior Walls"]),
    exterior_wall_material_secondary: mapExteriorWallMaterialSecondary(kv["Exterior Walls"]),
    exterior_wall_condition: mapCondition(kv["Exterior Walls"]),
    exterior_wall_insulation_type: mapInsulationType(kv["Insulation"]),
    flooring_material_primary: mapFlooringMaterialPrimary(kv["Floor Finish"]),
    flooring_material_secondary: mapFlooringMaterialSecondary(kv["Floor Finish"]),
    subfloor_material: mapSubfloorMaterial(kv["Floor System"]) || (mapFoundationType(kv["Floor System"]) === "Slab on Grade" ? "Concrete Slab" : "Plywood"),
    flooring_condition: mapCondition(kv["Floor Finish"]),
    interior_wall_structure_material: mapInteriorWallStructureMaterial(kv["Interior Finish"]),
    interior_wall_surface_material_primary: mapInteriorWallSurfaceMaterialPrimary(kv["Interior Finish"]),
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: kv["Interior Finish"] ? "Paint" : null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: mapCondition(kv["Interior Finish"]),
    roof_covering_material: mapRoofCoveringMaterial(kv["Roof Cover"]),
    roof_underlayment_type: kv["Roof Cover"] ? "Felt Paper" : null,
    roof_structure_material: kv["Roof Frame"] && kv["Roof Frame"].toLowerCase().includes("wood") ? "Wood Truss" : "Steel Truss",
    roof_design_type: mapRoofDesignType(kv["Roof Frame"]),
    roof_condition: mapCondition(kv["Roof Cover"]),
    roof_age_years: roofAgeYears,
    gutters_material: mapGuttersMaterial(kv["Gutters"]),
    gutters_condition: mapCondition(kv["Gutters"]),
    roof_material_type: mapRoofMaterialType(kv["Roof Cover"]),
    foundation_type: mapFoundationType(kv["Floor System"]),
    foundation_material: mapFoundationMaterial(kv["Foundation"]),
    foundation_waterproofing: kv["Foundation"] ? "Unknown" : null,
    foundation_condition: mapCondition(kv["Foundation"]),
    ceiling_structure_material: kv["Roof Frame"] && kv["Roof Frame"].toLowerCase().includes("wood") ? "Wood Joists" : "Steel Joists",
    ceiling_surface_material: mapCeilingSurfaceMaterial(kv["Interior Finish"]),
    ceiling_insulation_type: mapInsulationType(kv["Insulation"]),
    ceiling_height_average: parseIntSafe(kv["Ceiling Height"]) || null,
    ceiling_condition: mapCondition(kv["Interior Finish"]),
    exterior_door_material: mapDoorMaterial(kv["Exterior Doors"]),
    interior_door_material: mapDoorMaterial(kv["Interior Doors"]),
    window_frame_material: mapWindowMaterial(kv["Windows"]),
    window_glazing_type: mapGlazingType(kv["Windows"]),
    window_operation_type: mapWindowOperationType(kv["Windows"]),
    window_screen_material: kv["Windows"] ? "Aluminum" : null,
    primary_framing_material: mapFramingMaterial(kv["Roof Frame"]),
    secondary_framing_material: null,
    structural_damage_indicators: "None Observed",
    finished_base_area: aggregatedAreas.finishedArea || null,
    finished_basement_area: parseIntSafe(kv["Basement Area"]) || null,
    finished_upper_story_area: parseIntSafe(kv["Upper Story Area"]) || null,
    unfinished_base_area: aggregatedAreas.unFinishedArea || null,
    unfinished_basement_area: parseIntSafe(kv["Unfinished Basement"]) || null,
    unfinished_upper_story_area: parseIntSafe(kv["Unfinished Upper"]) || null,
    number_of_stories: parseIntSafe(kv["Unit Stories"]) || null,
    exterior_wall_condition_primary: mapCondition(kv["Exterior Walls"]),
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: mapInsulationType(kv["Insulation"]),
    exterior_wall_insulation_type_secondary: null,
    interior_wall_structure_material_primary: mapInteriorWallStructureMaterial(kv["Interior Finish"]) || "Wood Frame",
    interior_wall_structure_material_secondary: null
  };

  return { strap, structure };
}

(function main() {
  try {
    const rawHtml = fs.readFileSync("input.html", "utf8");
    const $ = cheerio.load(rawHtml);

    const { strap, structure } = buildStructure($, rawHtml);

    const outDir = path.join("owners");
    ensureDir(outDir);

    const outPath = path.join(outDir, "structure_data.json");

    // The schema expects a single structure object, not nested under a property ID key.
    // If the intention is to have a file per property, the outer structure should be:
    // { "property_ID": { "structure": { ... } } }
    // But the schema provided is for the 'structure' object itself.
    // So, we write the 'structure' object directly.
    fs.writeFileSync(outPath, JSON.stringify(structure, null, 2), "utf8");
    console.log(`Wrote structure data for property_${strap} to ${outPath}`);
  } catch (err) {
    console.error("Error building structure data:", err);
    process.exit(1);
  }
})();
