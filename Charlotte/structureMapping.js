// Structure data extractor using Cheerio
// Reads: input.html
// Writes: owners/structure_data.json and data/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeInt(val) {
  if (!val) return null;
  const n = parseInt(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function textClean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extractPropertyId($) {
  const h1 = $("h1").first().text();
  const m = h1.match(/Property Record Information for\s+(\d+)/i);
  return m ? m[1] : "unknown";
}

function findTableByCaption($, captionText) {
  let target = null;
  $("table").each((_, t) => {
    const cap = $(t).find("caption").first().text();
    if (cap && cap.toLowerCase().includes(captionText.toLowerCase())) {
      target = t;
      return false;
    }
  });
  return target;
}

function parseBuildingInfo($) {
  const tbl = findTableByCaption($, "Building Information");
  if (!tbl) return null;
  // Expect a single data row after header
  const row = $(tbl).find("tbody tr").eq(1).length
    ? $(tbl).find("tbody tr").eq(1)
    : $(tbl).find("tr").eq(1);
  if (!row || row.length === 0) return null;
  const cells = row.find("td");
  const info = {
    buildingNumber: textClean($(cells).eq(0).text()),
    description: textClean($(cells).eq(1).text()),
    quality: textClean($(cells).eq(2).text()),
    buildingUse: textClean($(cells).eq(3).text()),
    yearBuilt: safeInt($(cells).eq(4).text()),
    yearCond: safeInt($(cells).eq(5).text()),
    floors: safeInt($(cells).eq(6).text()),
    rooms: safeInt($(cells).eq(7).text()),
    bedrooms: safeInt($(cells).eq(8).text()),
    plumbingFixtures: safeInt($(cells).eq(9).text()),
    area: safeInt($(cells).eq(10).text()),
    acArea: safeInt($(cells).eq(11).text()),
    totalArea: safeInt($(cells).eq(12).text()),
  };
  return info;
}

function parseComponents($) {
  const tbl = findTableByCaption($, "Building Component Information");
  const result = [];
  if (!tbl) return result;
  $(tbl)
    .find("tbody tr")
    .each((i, tr) => {
      // skip header
      const tds = $(tr).find("td");
      if (tds.length < 3) return;
      const obj = {
        bld: textClean($(tds).eq(0).text()),
        code: textClean($(tds).eq(1).text()),
        description: textClean($(tds).eq(2).text()),
        category: textClean($(tds).eq(3).text()),
        area: safeInt($(tds).eq(4).text()),
        percent: safeInt($(tds).eq(5).text()),
        yearBuilt: safeInt($(tds).eq(6).text()),
        yearCond: safeInt($(tds).eq(7).text()),
        type: textClean($(tds).eq(8).text()),
      };
      result.push(obj);
    });
  return result;
}

function mapToStructure($) {
  const pid = extractPropertyId($);
  const binfo = parseBuildingInfo($) || {};
  const comps = parseComponents($);
  const finishedBaseArea = binfo.area || binfo.acArea || null;

  const out = {
    architectural_style_type: null,
    attachment_type: "Detached",
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: finishedBaseArea != null ? Number(finishedBaseArea) : null,
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
    number_of_buildings: 1,
    number_of_stories: binfo.floors != null ? Number(binfo.floors) : null,
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

  const buildingUseUpper = (binfo.buildingUse || "").toUpperCase();
  if (/(DUPLEX|TOWN|CONDO|ATTACH)/.test(buildingUseUpper)) out.attachment_type = "Attached";

  comps.forEach((c) => {
    const desc = (c.description || "").toLowerCase();
    if (!desc) return;
    if (desc.includes("masonry") && desc.includes("stucco")) {
      out.exterior_wall_material_primary = "Stucco";
      out.primary_framing_material = "Concrete Block";
    }
    if (desc.includes("clay tile") || desc.includes("concrete tile")) {
      out.roof_covering_material = "Concrete Tile";
      out.roof_material_type = "Tile";
    }
    if (desc.includes("shingle")) {
      out.roof_covering_material = out.roof_covering_material || "Asphalt Shingle";
      out.roof_material_type = out.roof_material_type || "Shingle";
    }
    if (desc.includes("slab on grade")) {
      out.foundation_type = "Slab on Grade";
      out.foundation_material = "Poured Concrete";
      out.subfloor_material = "Concrete Slab";
    }
    if (desc.includes("plaster interior")) {
      out.interior_wall_surface_material_primary = "Plaster";
    }
    if (desc.includes("impact window")) {
      out.window_glazing_type = "Impact Resistant";
    }
  });

  const data = {};
  data[`property_${pid}`] = out;
  return data;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const result = mapToStructure($);

  // write outputs
  ensureDir(path.join(process.cwd(), "owners"));
  ensureDir(path.join(process.cwd(), "data"));
  fs.writeFileSync(
    path.join("owners", "structure_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join("data", "structure_data.json"),
    JSON.stringify(result, null, 2),
    "utf8",
  );
  console.log(
    "Structure mapping complete for keys:",
    Object.keys(result).join(","),
  );
}

if (require.main === module) {
  main();
}
