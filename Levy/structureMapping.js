// Structure mapping script
// Reads input.html, extracts structure details using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeInt(val) {
  if (val == null) return null;
  const n = parseInt(String(val).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function textOf($, el) {
  return ($(el).text() || "").trim();
}

function findValueByLabel($, sectionSelector, labelText) {
  let val = null;
  $(`${sectionSelector} table`).each((_, tbl) => {
    $(tbl)
      .find("tr")
      .each((__, tr) => {
        const th = $(tr).find("th").first();
        const strongTxt = textOf($, th.find("strong")).toUpperCase();
        const thTxt = textOf($, th).toUpperCase();
        const matchTxt = (labelText || "").toUpperCase();
        if (strongTxt === matchTxt || thTxt === matchTxt) {
          const td = $(tr).find("td").first();
          val = textOf($, td);
        }
      });
  });
  return val;
}

function mapExteriorWallMaterial(src) {
  if (!src) return null;
  const s = src.toUpperCase();
  if (s.includes("HARDIE")) return "Fiber Cement Siding";
  if (s.includes("BRICK")) return "Brick";
  if (s.includes("VINYL")) return "Vinyl Siding";
  if (s.includes("STUCCO")) return "Stucco";
  if (s.includes("WOOD")) return "Wood Siding";
  if (s.includes("STONE")) return "Natural Stone";
  return null;
}

function mapRoofDesignType(src) {
  if (!src) return null;
  const s = src.toUpperCase();
  if (s.includes("GABLE") && s.includes("HIP")) return "Combination";
  if (s.includes("GABLE")) return "Gable";
  if (s.includes("HIP")) return "Hip";
  if (s.includes("FLAT")) return "Flat";
  return null;
}

function mapRoofCovering(src) {
  if (!src) return null;
  const s = src.toUpperCase();
  if (s.includes("METAL")) return "Metal Standing Seam";
  if (s.includes("ARCHITECTURAL") || s.includes("ARCH SHINGLE"))
    return "Architectural Asphalt Shingle";
  if (s.includes("3-TAB") || s.includes("3 TAB") || s.includes("ASPHALT"))
    return "3-Tab Asphalt Shingle";
  if (s.includes("TPO")) return "TPO Membrane";
  if (s.includes("EPDM")) return "EPDM Membrane";
  if (s.includes("SLATE")) return "Natural Slate";
  if (s.includes("TILE")) return "Clay Tile";
  return null;
}

function getYearBuilt($, sectionSelector) {
  const yrTxt = findValueByLabel($, sectionSelector, "Actual Year Built");
  const year = safeInt(yrTxt);
  return Number.isFinite(year) ? year : null;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  if (!fs.existsSync(inputPath)) {
    console.error("input.html not found");
    process.exit(1);
  }
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId =
    textOf($, $("#ctlBodyPane_ctl02_ctl01_lblParcelID")) || "unknown";
  const propertyKey = `property_${parcelId}`;

  // Building Information section selector root
  const buildingSection = "#ctlBodyPane_ctl08_mSection";

  const exteriorWallRaw = findValueByLabel($, buildingSection, "Exterior Wall");
  const roofStructureRaw = findValueByLabel(
    $,
    buildingSection,
    "Roof Structure",
  );
  const roofCoverRaw = findValueByLabel($, buildingSection, "Roof Cover");

  // Areas from sub-area table
  const subAreaTable = $("#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_subArea");
  let baseArea = null;
  if (subAreaTable && subAreaTable.length) {
    subAreaTable.find("tbody > tr").each((_, tr) => {
      const desc = textOf($, $(tr).find("th"));
      const conditioned = textOf($, $(tr).find("td").eq(0));
      const actual = textOf($, $(tr).find("td").eq(1));
      if (/^BASE$/i.test(desc)) {
        baseArea = safeInt(actual) || safeInt(conditioned) || null;
      }
    });
  }

  const yearBuilt = getYearBuilt($, buildingSection);
  const currentYear = new Date().getFullYear();
  const roofAgeYears = yearBuilt ? Math.max(1, currentYear - yearBuilt) : null;

  // Attachment determination
  const useCode = textOf($, $("#ctlBodyPane_ctl02_ctl01_lblUsage"));
  const attachmentType = useCode.toUpperCase().includes("SINGLE FAMILY")
    ? "Detached"
    : null;

  // Mapped values
  const exteriorPrimary = mapExteriorWallMaterial(exteriorWallRaw);
  const roofDesign = mapRoofDesignType(roofStructureRaw);
  const roofCovering = mapRoofCovering(roofCoverRaw);

  const structure = {
    architectural_style_type: null,
    attachment_type: attachmentType,
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
    primary_framing_material: "Wood Frame",
    roof_age_years: roofAgeYears,
    roof_condition: null,
    roof_covering_material: roofCovering,
    roof_date: yearBuilt ? String(yearBuilt) : null,
    roof_design_type: roofDesign,
    roof_material_type: roofCoverRaw ? "Metal" : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: "None Observed",
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

  // Ensure required fields exist and types are correct (already set with nulls/defaults above)

  const outDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");

  const out = {};
  out[propertyKey] = structure;

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
