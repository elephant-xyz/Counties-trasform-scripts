// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl01_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("STONE")) out.push("Natural Stone");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("EIFS")) out.push("EIFS");
    if (t.includes("BLOCK") || t.includes("CONCRETE") || t.includes("CMU"))
      out.push("Concrete Block");
    if (
      t.includes("WOOD") ||
      t.includes("CEDAR") ||
      t.includes("PLYWOOD") ||
      t.includes("SID")
    )
      out.push("Wood Siding");
    if (t.includes("METAL") || t.includes("ALUM"))
      out.push("Metal Siding");
    if (t.includes("FIBER"))
      out.push("Fiber Cement Siding");
  });
  return Array.from(new Set(out));
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("DRYWALL") || t.includes("SHEETROCK")) out.push("Drywall");
    if (t.includes("PLASTER")) out.push("Plaster");
    if (t.includes("PLY") || t.includes("PANEL")) out.push("Wood Paneling");
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Exposed Brick");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Exposed Block");
    if (t.includes("STONE")) out.push("Stone Veneer");
    if (t.includes("TILE")) out.push("Tile");
    if (t.includes("WOOD")) out.push("Wood Paneling");
  });
  return Array.from(new Set(out));
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
    if (t.includes("CERAMIC") || t.includes("TILE")) out.push("Ceramic Tile");
    if (t.includes("ASPH")) out.push("Sheet Vinyl");
    if (t.includes("CONCRETE")) out.push("Polished Concrete");
  });
  return Array.from(new Set(out));
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function createDefaultStructureRecord() {
  return {
    architectural_style_type: null,
    attachment_type: null,
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
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
}

function buildStructureRecords(buildings) {
  return buildings.map((b, idx) => {
    const rec = createDefaultStructureRecord();
    const extTokens = [];
    const intWallTokens = [];
    const floorTokens = [];
    const frameTokens = [];

    if (b["Exterior Walls"]) {
      extTokens.push(...b["Exterior Walls"].split(";").map((s) => s.trim()));
    }
    if (b["Interior Walls"]) {
      intWallTokens.push(...b["Interior Walls"].split(";").map((s) => s.trim()));
    }
    if (b["Floor Cover"]) {
      floorTokens.push(...b["Floor Cover"].split(";").map((s) => s.trim()));
    }
    if (b["Frame Type"]) {
      frameTokens.push(b["Frame Type"]);
    }

    const ext = mapExteriorMaterials(extTokens);
    if (ext.length) {
      rec.exterior_wall_material_primary = ext[0] || null;
    }

    const intSurf = mapInteriorSurface(intWallTokens);
    if (intSurf.length) {
      rec.interior_wall_surface_material_primary = intSurf[0] || null;
    }

    const floors = mapFlooring(floorTokens);
    if (floors.length) {
      rec.flooring_material_primary = floors[0] || null;
    }

    const roofTokens = [];
    if (b["Roof Cover"]) roofTokens.push(b["Roof Cover"]);
    if (roofTokens.length) {
      const u = roofTokens.join(" ").toUpperCase();
    if (
      u.includes("ENG SHINGL") ||
      u.includes("ARCH") ||
      u.includes("ARCHITECT") ||
      u.includes("COMP") ||
      u.includes("COMPOSITION") ||
      u.includes("SHINGL")
    ) {
      rec.roof_covering_material = "Architectural Asphalt Shingle";
    } else if (u.includes("3 TAB") || u.includes("3-TAB")) {
      rec.roof_covering_material = "3-Tab Asphalt Shingle";
    } else if (u.includes("MET") || u.includes("TIN") || u.includes("STEEL")) {
      rec.roof_covering_material = "Metal Corrugated";
    } else if (u.includes("STANDING")) {
      rec.roof_covering_material = "Metal Standing Seam";
    } else if (u.includes("TPO")) {
      rec.roof_covering_material = "TPO Membrane";
    } else if (u.includes("EPDM")) {
      rec.roof_covering_material = "EPDM Membrane";
    }
  }

    if (frameTokens.join(" ").toUpperCase().includes("WOOD")) {
      rec.primary_framing_material = "Wood Frame";
    }

    if (b["Stories"]) {
      const st = parseNumber(b["Stories"]);
      if (st != null) {
        rec.number_of_stories = st;
      }
    }

    rec._building_index = idx + 1;
    return rec;
  });
}

function buildStructureContext($, buildings) {
  if (!buildings || buildings.length === 0) {
    return { structures: [] };
  }
  return { structures: buildStructureRecords(buildings) };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($);
  const structureContext = buildStructureContext($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structureContext;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
