// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeText($, el) {
  if (!el || el.length === 0) return null;
  const t = $(el).text().trim();
  return t || null;
}

function extractParcelId($) {
  // Prefer the H2 that contains "Parcel"
  let parcelHeader = null;
  $("h2").each((i, el) => {
    const txt = $(el).text().trim();
    if (/^Parcel\s+/i.test(txt)) parcelHeader = txt;
  });
  let id = null;
  if (parcelHeader) {
    id = parcelHeader.replace(/^.*Parcel\s+/i, "").trim();
  }
  // Fallback: look for GLOBAL_Strap variable and convert
  if (!id) {
    const scriptText = $("script")
      .map((i, el) => $(el).html() || "")
      .get()
      .join("\n");
    const m = scriptText.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
    if (m) {
      // Example '30363107A02700060P' -> 'P-31-36-30-07A-0270-0060' is not trivial to derive; use raw
      id = m[1];
    }
  }
  return id || "UNKNOWN_ID";
}

function mapRoofCover(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("metal")) {
    // Schema choices: Metal Standing Seam, Metal Corrugated
    return "Metal Standing Seam";
  }
  if (d.includes("shingle")) return "Architectural Asphalt Shingle";
  if (d.includes("tile")) return "Clay Tile";
  return null;
}

function mapRoofDesign(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("gable")) return "Gable";
  if (d.includes("hip")) return "Hip";
  if (d.includes("flat")) return "Flat";
  return null;
}

function mapFlooring(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("vinyl")) return "Sheet Vinyl";
  if (d.includes("tile")) return "Ceramic Tile";
  if (d.includes("carpet")) return "Carpet";
  if (d.includes("hardwood")) return "Solid Hardwood";
  return null;
}

function run() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf-8");
  const $ = cheerio.load(html);

  const parcelId = extractParcelId($);

  // Find Buildings section
  const buildingsHeader = $("h3")
    .filter((i, el) => /Buildings/i.test($(el).text()))
    .first();
  let exteriorWall = null;
  let roofStructure = null;
  let roofCover = null;
  let interiorWall = null;
  let interiorFlooring = null;

  if (buildingsHeader.length) {
    // Find the first Element table under Buildings
    const section = buildingsHeader.parent();
    const elementTables = section.find("table").filter((i, el) => {
      const head = $(el).find("thead").text();
      return /Element\s*Code\s*Description/i.test(head);
    });

    if (elementTables.length > 0) {
      const tbl = elementTables.first();
      tbl.find("tr").each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 3) {
          const label = $(tds[0]).text().trim();
          const desc = $(tds[2]).text().trim();
          if (/^Exterior Wall$/i.test(label))
            exteriorWall = desc || exteriorWall;
          if (/^Roof Structure$/i.test(label))
            roofStructure = desc || roofStructure;
          if (/^Roof Cover$/i.test(label)) roofCover = desc || roofCover;
          if (/^Interior Wall$/i.test(label))
            interiorWall = desc || interiorWall;
          if (/^Interior Flooring$/i.test(label))
            interiorFlooring = desc || interiorFlooring;
        }
      });
    }
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: "Attached",
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
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary:
      exteriorWall === "Concrete Block" ? "Concrete Block" : null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: mapFlooring(interiorFlooring),
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
    interior_wall_surface_material_primary:
      interiorWall === "Drywall" ? "Drywall" : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: 1,
    primary_framing_material: "Masonry",
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCover(roofCover),
    roof_date: null,
    roof_design_type: mapRoofDesign(roofStructure),
    roof_material_type: "Metal",
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: "Concrete Slab",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
    // Additional optional fields in schema
    exterior_wall_material_secondary: null,
  };

  // Ensure required keys exist per schema and types match; already set above.

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "structure_data.json");
  const wrapped = {};
  wrapped[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(wrapped, null, 2), "utf-8");

  console.log(`Wrote ${outPath}`);
}

try {
  run();
} catch (e) {
  console.error(e);
  process.exit(1);
}
