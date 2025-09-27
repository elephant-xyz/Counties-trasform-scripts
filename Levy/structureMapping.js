// Structure mapping script
// Reads input.html, parses with cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeInt(val) {
  const n = parseInt(String(val).replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function extractText($, selector) {
  const el = $(selector);
  if (!el || el.length === 0) return null;
  const t = el.text().trim();
  return t || null;
}

function mapRoofCovering(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  if (s.includes("3-tab")) return "3-Tab Asphalt Shingle";
  if (s.includes("architectural")) return "Architectural Asphalt Shingle";
  if (s.includes("slate"))
    return s.includes("synthetic") ? "Synthetic Slate" : "Natural Slate";
  if (s.includes("clay")) return "Clay Tile";
  if (s.includes("concrete")) return "Concrete Tile";
  if (s.includes("tpo")) return "TPO Membrane";
  if (s.includes("epdm")) return "EPDM Membrane";
  if (s.includes("modified")) return "Modified Bitumen";
  if (s.includes("built-up")) return "Built-Up Roof";
  if (s.includes("shake")) return "Wood Shake";
  if (s.includes("shingle") && s.includes("wood")) return "Wood Shingle";
  if (s.includes("metal")) {
    // Default to standing seam when only 'metal' is provided
    return "Metal Standing Seam";
  }
  if (s.includes("green")) return "Green Roof System";
  if (s.includes("solar")) return "Solar Integrated Tiles";
  return null;
}

function mapRoofDesign(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  const hasGable = s.includes("gable");
  const hasHip = s.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (s.includes("flat")) return "Flat";
  if (s.includes("mansard")) return "Mansard";
  if (s.includes("gambrel")) return "Gambrel";
  if (s.includes("shed")) return "Shed";
  if (s.includes("saltbox")) return "Saltbox";
  if (s.includes("butterfly")) return "Butterfly";
  return null;
}

function mapExteriorWall(str) {
  if (!str) return null;
  const s = String(str).toLowerCase();
  if (s.includes("brick")) return "Brick";
  if (s.includes("stucco")) return "Stucco";
  if (s.includes("vinyl")) return "Vinyl Siding";
  if (
    s.includes("hardie") ||
    s.includes("hardy") ||
    s.includes("fiber cement") ||
    s.includes("cement board")
  )
    return "Fiber Cement Siding";
  if (s.includes("wood")) return "Wood Siding";
  if (s.includes("stone")) return "Natural Stone";
  if (s.includes("metal")) return "Metal Siding";
  if (s.includes("block")) return "Concrete Block";
  if (s.includes("eifs")) return "EIFS";
  return null;
}

function mapRoofMaterialTypeFromCover(cover) {
  if (!cover) return null;
  const s = String(cover).toLowerCase();
  if (s.includes("metal")) return "Metal";
  if (s.includes("shingle")) return "Shingle";
  if (s.includes("tile")) return "CeramicTile";
  if (s.includes("slate")) return "Stone";
  if (
    s.includes("tpo") ||
    s.includes("epdm") ||
    s.includes("modified") ||
    s.includes("built-up")
  )
    return "Composition";
  return null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Identify property id
  const parcelId =
    extractText($, "#ctlBodyPane_ctl02_ctl01_lblParcelID") ||
    extractText($, 'th:contains("Parcel ID") + td span');
  const propKey = parcelId ? `property_${parcelId}` : "property_unknown";

  // Building Information selectors
  const extWallRaw = (() => {
    // Look for row with strong 'Exterior Wall'
    let val = null;
    $(
      "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
    ).each((i, el) => {
      const header = $(el).find("th").text().trim().toLowerCase();
      if (header.includes("exterior wall")) {
        val = $(el).find("td").text().trim();
      }
    });
    return val;
  })();

  const roofStructRaw = (() => {
    let val = null;
    $(
      "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
    ).each((i, el) => {
      const header = $(el).find("th").text().trim().toLowerCase();
      if (header.includes("roof structure")) {
        val = $(el).find("td").text().trim();
      }
    });
    return val;
  })();

  const roofCoverRaw = (() => {
    let val = null;
    $(
      "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
    ).each((i, el) => {
      const header = $(el).find("th").text().trim().toLowerCase();
      if (header.includes("roof cover")) {
        val = $(el).find("td").text().trim();
      }
    });
    return val;
  })();

  const bathsRaw = (() => {
    let val = null;
    $(
      "section#ctlBodyPane_ctl08_mSection .module-content table.tabular-data-two-column tbody tr",
    ).each((i, el) => {
      const header = $(el).find("th").text().trim().toLowerCase();
      if (header === "baths") {
        val = $(el).find("td").text().trim();
      }
    });
    return val;
  })();

  const baseArea = (() => {
    let v = null;
    $("#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_subArea tbody tr").each(
      (i, el) => {
        const desc = $(el).find("th").text().trim().toLowerCase();
        if (desc === "base") {
          const conditioned = $(el).find("td").first().text().trim();
          v = safeInt(conditioned);
        }
      },
    );
    return v;
  })();

  // Map fields per schema
  const exteriorPrimary = mapExteriorWall(extWallRaw);
  const roofDesign = mapRoofDesign(roofStructRaw);
  const roofCover = mapRoofCovering(roofCoverRaw);
  const roofMaterialType = mapRoofMaterialTypeFromCover(roofCoverRaw || "");

  // Build structure object respecting enums and nullables
  const structure = {
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
    exterior_wall_material_primary: exteriorPrimary,
    exterior_wall_material_secondary: null,
    finished_base_area: baseArea,
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
    roof_covering_material: roofCover,
    roof_date: null,
    roof_design_type: roofDesign,
    roof_material_type: roofMaterialType,
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

  // Ensure required fields exist; most are already here.
  const output = {};
  output[propKey] = structure;

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
}

try {
  main();
  console.log("Structure mapping complete");
} catch (e) {
  console.error("Structure mapping failed:", e.message);
  process.exit(1);
}
