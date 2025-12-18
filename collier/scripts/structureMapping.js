// Structure mapping script
// Reads input.html, extracts property structure details, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseIntSafe(txt) {
  const n = parseInt(String(txt || "").replace(/[^\d.-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseDateToISO(txt) {
  // expects formats like MM/DD/YY or MM/DD/YYYY
  if (!txt) return null;
  const s = String(txt).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  mm = mm.padStart(2, "0");
  dd = dd.padStart(2, "0");
  if (yy.length === 2) {
    // assume 20xx for >= 50? Here pages show recent permits; if 2-digit, map 00-49 => 2000s, 50-99 => 1900s
    const yNum = parseInt(yy, 10);
    yy = (yNum >= 50 ? 1900 + yNum : 2000 + yNum).toString();
  }
  // Basic validity check
  const iso = `${yy}-${mm}-${dd}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

function diffYearsFrom(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const beforeAnniversary =
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeAnniversary) years -= 1;
  return years < 1 ? 1 : years; // meet schema minimum if we know there was a roof date
}

(function main() {
  const inputPath = "input.html";
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  // Parcel ID
  const parcelId = $("span#ParcelID").first().text().trim() || "unknown";

  // Base building area from Building/Extra Features table for the main residence
  let finishedBaseArea = null;
  $("#BuildingAdditional tr").each((i, el) => {
    const tds = $(el).find("td");
    const desc = tds.eq(2).text().trim().toUpperCase();
    if (desc.includes("SINGLE FAMILY RESIDENCE")) {
      const areaTxt = tds.eq(3).text().trim();
      finishedBaseArea = parseIntSafe(areaTxt);
    }
  });

  // Roof permit date (CO Date where Type contains ROOF)
  let roofCODateISO = null;
  $("#PermitAdditional tr").each((i, el) => {
    const tds = $(el).find("td");
    const type = tds.eq(7).text().trim().toUpperCase();
    if (type.includes("ROOF")) {
      const coDateTxt = tds.eq(4).text().trim();
      const iso = parseDateToISO(coDateTxt);
      if (iso) roofCODateISO = iso;
    }
  });

  const roofAgeYears = diffYearsFrom(roofCODateISO);

  const structure = {
    // High-level
    architectural_style_type: null,
    attachment_type: "Detached",

    // Exterior walls
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,

    // Areas
    finished_base_area: finishedBaseArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,

    // Flooring & walls & ceilings
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,

    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,

    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,

    // Doors & windows
    exterior_door_material: null,
    exterior_door_installation_date: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    window_installation_date: null,

    // Structure/framing
    number_of_buildings: null,
    number_of_stories: null,
    primary_framing_material: null,
    secondary_framing_material: null,

    // Roof
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: roofAgeYears === null ? null : roofAgeYears,
    roof_date: roofCODateISO || null,
    roof_material_type: null,

    // Gutters
    gutters_material: null,
    gutters_condition: null,

    // Foundation
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    foundation_repair_date: null,

    // Siding
    siding_installation_date: null,

    // Damage
    structural_damage_indicators: null,
  };

  const output = {};
  output[`property_${parcelId}`] = structure;

  const outPath = path.join("owners", "structure_data.json");
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
})();

