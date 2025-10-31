// structureMapping.js
// Parses input.html with cheerio and outputs structure data per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function digitsOnly(str) {
  return (str || "").replace(/\D+/g, "");
}

function getText($, selector) {
  const el = $(selector).first();
  return el.length ? el.text().trim() : "";
}

function findValueByLabel($, scope, labelText) {
  let value = "";
  $(scope)
    .find("tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const labelTd = $tr.find("td.label").first();
      const valTd = $tr.find("td.value").first();
      if (labelTd.length && valTd.length) {
        const lbl = labelTd.text().replace(/\s+/g, " ").trim().toLowerCase();
        if (lbl.includes(labelText.toLowerCase())) {
          value = valTd.text().replace(/\s+/g, " ").trim();
          return false; // break loop
        }
      }
    });
  return value;
}

function mapExteriorWallPrimary(raw) {
  const text = (raw || "").toLowerCase();
  if (!text || text.includes("none") || text.includes("n/a")) return null;
  if (text.includes("stucco")) return "Stucco";
  if (text.includes("brick")) return "Brick";
  if (text.includes("stone")) return "Natural Stone";
  if (text.includes("vinyl")) return "Vinyl Siding";
  if (text.includes("wood")) return "Wood Siding";
  if (text.includes("fiber")) return "Fiber Cement Siding";
  if (text.includes("metal")) return "Metal Siding";
  if (text.includes("block") || text.includes("cb")) return "Concrete Block";
  return null;
}

function mapRoofCover(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  if (txt.includes("asphalt") || txt.includes("composition")) {
    return "3-Tab Asphalt Shingle";
  }
  if (txt.includes("architectural")) return "Architectural Asphalt Shingle";
  if (txt.includes("metal")) return "Metal Standing Seam";
  if (txt.includes("concrete")) return "Concrete Tile";
  if (txt.includes("clay") || txt.includes("tile")) return "Clay Tile";
  if (txt.includes("tpo")) return "TPO Membrane";
  if (txt.includes("epdm")) return "EPDM Membrane";
  if (txt.includes("modified")) return "Modified Bitumen";
  if (txt.includes("slate")) return "Natural Slate";
  if (txt.includes("shake")) return "Wood Shake";
  return null;
}

function mapRoofStruct(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  if (txt.includes("concrete")) return "Concrete Beam";
  if (txt.includes("engineered") || txt.includes("lumber")) return "Engineered Lumber";
  if (txt.includes("steel")) return "Steel Truss";
  if (txt.includes("rafter")) return "Wood Rafter";
  if (txt.includes("wood")) return "Wood Truss";
  
  return null;
}

function mapRoofDesign(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt) return null;
  const hasGable = txt.includes("gable");
  const hasHip = txt.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (txt.includes("flat")) return "Flat";
  if (txt.includes("shed")) return "Shed";
  return null;
}

function mapFlooring(raw) {
  const txt = (raw || "").toLowerCase();
  if (!txt || txt.includes("n/a")) return null;
  if (txt.includes("carpet")) return "Carpet";
  if (txt.includes("tile")) return "Ceramic Tile";
  if (txt.includes("vinyl plank")) return "Luxury Vinyl Plank";
  if (txt.includes("vinyl")) return "Sheet Vinyl";
  if (txt.includes("hardwood")) return "Solid Hardwood";
  if (txt.includes("laminate")) return "Laminate";
  if (txt.includes("concrete")) return "Polished Concrete";
  return null;
}

function mapPrimaryFraming(rawExterior) {
  const txt = (rawExterior || "").toLowerCase();
  if (
    txt.includes("cb") ||
    txt.includes("concrete block") ||
    txt.includes("block")
  )
    return "Concrete Block";
  return null;
}

// Mapping table for Palm Beach structural labels → exterior + framing per guideline
function mapWallAndFrameGuideline(raw) {
  const key = (raw || "").toUpperCase().trim();
  const MAP = {
    "NONE": { exterior: null, framing: null },
    "MSY: CONC. SIP FORMING": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "MSY: PRECAST PNL/REIN. CONC": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "WSF/MSY: CEMENT FIBER SIDING": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "WSF/MSY: WOOD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: PREFAB PNL": { exterior: "Metal Siding", framing: "Wood Frame" },
    "WSF: ASPHALT SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: STONE": { exterior: "Natural Stone", framing: "Wood Frame" },
    "MSY: STONE": { exterior: "Natural Stone", framing: "Concrete Block" },
    "WSF/MSY: VINYL/STL/ALUM": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "WSF: PLYWD/STL/ALUM SHTH": { exterior: "Wood Siding", framing: "Wood Frame" },
    "ADOBE/HOLLOW CLAY BLK": { exterior: "Adobe", framing: "Masonry" },
    "MSY: CONC. BLOCK": { exterior: "Concrete Block", framing: "Concrete Block" },
    "WSF: STUCCO": { exterior: "Stucco", framing: "Wood Frame" },
    "MSY: CB STUCCO": { exterior: "Stucco", framing: "Concrete Block" },
    "WSF: BRICK": { exterior: "Brick", framing: "Wood Frame" },
    "MSY: BRICK": { exterior: "Brick", framing: "Concrete Block" },
    "WSF: WOOD SHINGLE": { exterior: "Wood Siding", framing: "Wood Frame" },
    "WSF: COMP OR HARD BD": { exterior: "Wood Siding", framing: "Wood Frame" },
    "LOG": { exterior: "Log", framing: "Log Construction" },
    "WSF LOG VENEER": { exterior: "Log", framing: "Wood Frame" },
    "MSY LOG VENEER": { exterior: "Log", framing: "Concrete Block" },
    "GLASS": { exterior: "Curtain Wall", framing: "Steel Frame" },
    "BARN/HANGAR: HOLLOW CLAY BLOCK": { exterior: "Adobe", framing: "Masonry" },
    "BARN/HANGAR: CONCRETE BLOCK": { exterior: "Concrete Block", framing: "Concrete Block" },
    "BARN/HANGAR: CONCRETE BLOCK STUCCO": { exterior: "Stucco", framing: "Concrete Block" },
    "BARN/HANGAR: REINFORCED CONCRETE": { exterior: "Precast Concrete", framing: "Poured Concrete" },
    "BARN/HANGAR: PRECAST PANELS": { exterior: "Precast Concrete", framing: "Concrete Block" },
    "BARN/HANGAR: STONE": { exterior: "Natural Stone", framing: "Masonry" },
    "BARN/HANGAR: METAL PANELS (ALUM/STEEL)": { exterior: "Metal Siding", framing: "Steel Frame" },
    "BARN/HANGAR: CEMENT FIBER SIDING/SHINGLES": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "BARN/HANGAR: PLYWOOD / WOOD FRAME STUCCO / WOOD SIDING / CEDAR/REDWOOD": { exterior: "Wood Siding", framing: "Wood Frame" },
    "BARN/HANGAR: VINYL SIDING": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "BARN/HANGAR: BRICK VENEER": { exterior: "Brick", framing: "Wood Frame" },
    "BARN/HANGAR: STONE VENEER": { exterior: "Manufactured Stone", framing: "Wood Frame" },
    "MFG HOME: ALUMINUM": { exterior: "Metal Siding", framing: "Wood Frame" },
    "MFG HOME: CEMENT FIBER SIDING": { exterior: "Fiber Cement Siding", framing: "Wood Frame" },
    "MFG HOME: HARD-BOARD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: LOG SIDING": { exterior: "Log", framing: "Wood Frame" },
    "MFG HOME: PLYWOOD SIDING": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: STUCCO SIDING": { exterior: "Stucco", framing: "Wood Frame" },
    "MFG HOME: WOOD SHINGLE/SHAKE": { exterior: "Wood Siding", framing: "Wood Frame" },
    "MFG HOME: VINYL SIDING": { exterior: "Vinyl Siding", framing: "Wood Frame" },
    "MFG HOME: MASONRY VENEER": { exterior: "Brick", framing: "Wood Frame" },
  };
  return MAP[key] || null;
}

function run() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  // Extract PCN (parcel control number) digits
  let pcnText = getText($, "#MainContent_lblPCN");
  if (!pcnText) {
    pcnText = $("td.label:contains('Parcel Control Number')")
      .next(".value")
      .text()
      .trim();
  }
  const propertyId =
    digitsOnly(pcnText) ||
    digitsOnly(
      getText($, "span:contains('Parcel Control Number')")
        .parent()
        .next()
        .text(),
    );
  const propKey = `property_${propertyId || "unknown"}`;

  // Structural Elements block
  const structHeader = $("h3:contains('Structural Element')").first();
  const structScope = structHeader.length
    ? structHeader.next(".building_col")
    : null;

  const exteriorWall1 = structScope
    ? findValueByLabel($, structScope, "Exterior Wall 1")
    : "";
  const exteriorWall2 = structScope
    ? findValueByLabel($, structScope, "Exterior Wall 2")
    : "";
  const roofStructure = structScope
    ? findValueByLabel($, structScope, "Roof Structure")
    : "";
  const roofCover = structScope
    ? findValueByLabel($, structScope, "Roof Cover")
    : "";
  const interiorWall1 = structScope
    ? findValueByLabel($, structScope, "Interior Wall 1")
    : "";
  const interiorWall2 = structScope
    ? findValueByLabel($, structScope, "Interior Wall 2")
    : "";
  const floorType1 = structScope
    ? findValueByLabel($, structScope, "Floor Type 1")
    : "";
  const floorType2 = structScope
    ? findValueByLabel($, structScope, "Floor Type 2")
    : "";
  const storiesRaw = structScope
    ? findValueByLabel($, structScope, "Stories")
    : "";

  // SUBAREA block
  const subareaHeader = $("h3:contains('SUBAREA AND SQUARE FOOTAGE')").first();
  const subareaScope = subareaHeader.length
    ? subareaHeader.next(".building_col")
    : null;

  let finishedBaseArea = null;
  if (subareaScope) {
    $(subareaScope)
      .find("tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds[0]).text().replace(/\s+/g, " ").trim();
          const val = parseInt(
            $(tds[1])
              .text()
              .replace(/[^0-9]/g, ""),
            10,
          );
          if (/BAS\s+Base Area/i.test(label) && Number.isInteger(val))
            finishedBaseArea = val;
        }
      });
  }

  // Property Use Code within same block for attachment inference
  const useCodeText = subareaScope
    ? findValueByLabel($, subareaScope, "Property Use Code")
    : "";
  let attachment_type = null;
  if ((useCodeText || "").toUpperCase().includes("TOWNHOUSE"))
    attachment_type = "Attached";

  const data = {
    architectural_style_type: null,
    attachment_type: attachment_type,
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
    // Apply guideline mapping first; fallback to generic mappers
    exterior_wall_material_primary: (function () {
      const m1 = mapWallAndFrameGuideline(exteriorWall1);
      const m2 = mapWallAndFrameGuideline(exteriorWall2);
      if (m1 && m1.exterior !== undefined) return m1.exterior;
      if (m2 && m2.exterior !== undefined) return m2.exterior;
      return mapExteriorWallPrimary(exteriorWall1);
    })(),
    exterior_wall_material_secondary: mapExteriorWallPrimary(exteriorWall2),
    finished_base_area: finishedBaseArea || null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: mapFlooring(floorType1),
    flooring_material_secondary: mapFlooring(floorType2),
    foundation_condition: "Unknown",
    foundation_material: null,
    foundation_type: null,
    foundation_waterproofing: "Unknown",
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: (function () {
      const m1 = mapWallAndFrameGuideline(exteriorWall1);
      if (m1 && m1.framing) return m1.framing === "Concrete Block" ? "Concrete Block" : m1.framing;
      return "Wood Frame";
    })(),
    interior_wall_structure_material_primary: (function () {
      const m1 = mapWallAndFrameGuideline(exteriorWall1);
      if (m1 && m1.framing) return m1.framing;
      return "Wood Frame";
    })(),
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: (interiorWall1 || "")
      .toLowerCase()
      .includes("drywall")
      ? "Drywall"
      : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: Number.parseInt(storiesRaw, 10) || null,
    primary_framing_material: (function () {
      const m1 = mapWallAndFrameGuideline(exteriorWall1);
      const m2 = mapWallAndFrameGuideline(exteriorWall2);
      if (m1 && m1.framing !== undefined) return m1.framing;
      if (m2 && m2.framing !== undefined) return m2.framing;
      return mapPrimaryFraming(exteriorWall1);
    })(),
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCover(roofCover),
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: mapRoofStruct(roofStructure),
    roof_underlayment_type: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    // Schema-required identifiers
    request_identifier: propertyId || "unknown",
    source_http_request: {
      method: "GET",
      url: propertyId
        ? `https://www.pbcgov.org/papa/Asps/PropertyDetail.aspx?pcn=${propertyId}`
        : "https://www.pbcgov.org/papa/",
    },
  };

  const outObj = {};
  outObj[propKey] = data;

  const ownersDir = path.resolve("owners");
  const dataDir = path.resolve("data");
  fs.mkdirSync(ownersDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(ownersDir, "structure_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(dataDir, "structure_data.json"),
    JSON.stringify(outObj, null, 2),
    "utf8",
  );

  console.log("structure_data.json written for", propKey);
}

if (require.main === module) {
  run();
}
