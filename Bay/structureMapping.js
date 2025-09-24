// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelId = null;
  $("table.tabular-data-two-column tbody tr").each((_, tr) => {
    const th = textTrim($(tr).find("th,strong").first().text());
    if (/Parcel ID/i.test(th)) {
      const tdText = textTrim($(tr).find("td span").first().text());
      if (tdText) parcelId = tdText;
    }
  });
  return parcelId;
}

function collectBuildings($) {
  // Find the Buildings section by the header title text "Buildings"
  const buildings = [];
  const header = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        "Buildings",
    )
    .first();
  if (!header.length) return buildings;
  // Within this section, find all two-column blocks with left column summary tables
  $(header)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          const label = textTrim($(tr).find("th strong").first().text());
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  return buildings;
}

function mapExteriorMaterials(tokens) {
  const out = new Set();
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.add("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.add("Wood Siding");
    if (t.includes("STUC")) out.add("Stucco");
    if (t.includes("VINYL")) out.add("Vinyl Siding");
    if (t.includes("BLOCK")) out.add("Concrete Block");
  });
  return Array.from(out);
}

function mapInteriorSurface(tokens) {
  const out = new Set();
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("DRYWALL")) out.add("Drywall");
    if (t.includes("PLASTER")) out.add("Plaster");
    if (t.includes("PLYWOOD") || t.includes("WOOD PANEL"))
      out.add("Wood Paneling");
  });
  return Array.from(out);
}

function mapFlooring(tokens) {
  const out = new Set();
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.add("Carpet");
    if (t.includes("VINYL")) out.add("Sheet Vinyl");
    if (t.includes("CLAY") || t.includes("CERAMIC")) out.add("Ceramic Tile");
    if (t.includes("LVP")) out.add("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.add("Laminate");
    if (t.includes("STONE")) out.add("Natural Stone Tile");
  });
  return Array.from(out);
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function buildStructureRecord($, buildings) {
  // Defaults per schema requirements (all present, many null)
  const rec = {
    architectural_style_type: null,
    attachment_type: "Detached",
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

  // Aggregate from buildings
  const extTokens = [];
  const intWallTokens = [];
  const floorTokens = [];
  const roofTokens = [];
  const frameTokens = [];
  const stories = [];

  buildings.forEach((b) => {
    if (b["Exterior Walls"])
      extTokens.push(...b["Exterior Walls"].split(";").map((s) => s.trim()));
    if (b["Interior Walls"])
      intWallTokens.push(
        ...b["Interior Walls"].split(";").map((s) => s.trim()),
      );
    if (b["Floor Cover"])
      floorTokens.push(...b["Floor Cover"].split(";").map((s) => s.trim()));
    if (b["Roof Cover"]) roofTokens.push(b["Roof Cover"]);
    if (b["Frame Type"]) frameTokens.push(b["Frame Type"]);
    if (b["Stories"]) {
      const st = parseNumber(b["Stories"]);
      if (st != null) stories.push(st);
    }
  });

  // Exterior materials
  const ext = mapExteriorMaterials(extTokens);
  if (ext.length) {
    // Choose primary material as the most common/first detected
    rec.exterior_wall_material_primary = ext[0] || null;
    // Secondary is not necessarily an accent; leave null to avoid schema mismatch
    rec.exterior_wall_material_secondary = null;
  }

  // Interior wall surface
  const intSurf = mapInteriorSurface(intWallTokens);
  if (intSurf.length) {
    rec.interior_wall_surface_material_primary = intSurf[0] || null;
    rec.interior_wall_surface_material_secondary = intSurf[1] || null;
  }

  // Flooring
  const floors = mapFlooring(floorTokens);
  if (floors.length) {
    rec.flooring_material_primary = floors[0] || null;
    rec.flooring_material_secondary = floors[1] || null;
  }

  // Roof covering mapping
  if (roofTokens.length) {
    const u = roofTokens.join(" ").toUpperCase();
    if (
      u.includes("ENG SHINGL") ||
      u.includes("ARCH") ||
      u.includes("ARCHITECT")
    ) {
      rec.roof_covering_material = "Architectural Asphalt Shingle";
    }
  }

  // Framing
  if (frameTokens.join(" ").toUpperCase().includes("WOOD")) {
    rec.primary_framing_material = "Wood Frame";
    rec.interior_wall_structure_material = "Wood Frame";
    rec.interior_wall_structure_material_primary = "Wood Frame";
  }

  // Stories
  if (stories.length) {
    // Use max stories across buildings
    rec.number_of_stories = Math.max(...stories);
  }

  // Subfloor unknown; if any heated area present and FL likely slab, but leave null to avoid assumption
  rec.subfloor_material = null;

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($);
  const structureRecord = buildStructureRecord($, buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structureRecord;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
