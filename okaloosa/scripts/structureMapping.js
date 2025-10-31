// Structure mapping script
// Reads input.html, parses with cheerio, maps to structure schema, writes JSON to owners/ and data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.error("Error reading input.html:", e.message);
    process.exit(1);
  }
}

function ensureDirs() {
  const dirs = ["owners", "data"];
  dirs.forEach((d) => {
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch (e) {}
  });
}

function text(val) {
  return (val || "").replace(/\s+/g, " ").trim();
}

function buildStructureSkeleton(parcelId) {
  return {
    source_http_request: {
      method: "GET",
      url: `https://example.com/property/${parcelId}`
    },
    request_identifier: parcelId,
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: "Unknown",
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: "Unknown",
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
    roof_underlayment_type: "Unknown",
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: "Unknown",
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

function parseBuildingInfo($) {
  const data = {};
  $("#ctlBodyPane_ctl07_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const key = text($(tr).find("th strong").text());
      const val = text($(tr).find("td span").text());
      if (key) data[key] = val || null;
    },
  );
  return data;
}

function parseAreaTypes($) {
  let baseArea = null;
  $(
    "#ctlBodyPane_ctl09_mSection table#ctlBodyPane_ctl09_ctl01_grdTableViewer tbody tr",
  ).each((i, tr) => {
    const desc = text($(tr).find("td").eq(0).text()); // Description is first td
    const sqft = text($(tr).find("td").eq(1).text()); // Sq. Footage is second td
    // However table has th Type, td Description, td Sq. Footage, td Year
    const tds = $(tr).find("td");
    const description = text($(tds).eq(0).text());
    const sq = text($(tds).eq(1).text());
    const thType = text($(tr).find("th").first().text());
    // Prefer description match
    if (description.toUpperCase().includes("BASE AREA") || thType === "BAS") {
      const n = parseInt(sq, 10);
      if (!isNaN(n)) baseArea = n;
    }
  });
  return { baseArea };
}

function getParcelId($) {
  let pid = null;
  $("#ctlBodyPane_ctl00_mSection .tabular-data-two-column tbody tr").each(
    (i, tr) => {
      const k = text($(tr).find("th strong").text());
      const v = text($(tr).find("td span").text());
      if (k === "Parcel ID") pid = v;
    },
  );
  // Fallback: parse from title
  if (!pid) {
    const t = text($("title").text());
    const m = t.match(/Report:\s*([\w-]+)/);
    if (m) pid = m[1];
  }
  return pid;
}

function mapExteriorMaterial(val) {
  if (!val) return null;
  const s = val.toUpperCase();
  if (s.includes("VINYL")) return "Vinyl Siding";
  if (s.includes("WOOD")) return "Wood Siding";
  if (s.includes("STUCCO")) return "Stucco";
  if (s.includes("BRICK")) return "Brick";
  return null;
}

function mapRoofMaterialType(val) {
  if (!val) return null;
  const s = val.toUpperCase();
  if (s.includes("METAL")) return "Metal";
  if (s.includes("SHINGLE")) return "Shingle";
  if (s.includes("CONCRETE")) return "Concrete";
  if (s.includes("SLATE")) return "Stone";
  return null;
}

function mapRoofCovering(val) {
  if (!val) return null;
  const s = val.toUpperCase();
  if (s.includes("3-TAB")) return "3-Tab Asphalt Shingle";
  if (s.includes("ARCH")) return "Architectural Asphalt Shingle";
  if (s.includes("METAL")) return null; // unknown profile
  if (s.includes("TPO")) return "TPO Membrane";
  if (s.includes("EPDM")) return "EPDM Membrane";
  return null;
}

function mapFlooringTypes(val) {
  if (!val) return { primary: null, secondary: null };
  const parts = val
    .split(/;|,|\//)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  let hasCarpet = parts.some((p) => p.includes("CARPET"));
  let hasSheetVinyl = parts.some(
    (p) =>
      p.includes("SHT") ||
      p.includes("SHEET") ||
      (p.includes("VINYL") && !p.includes("LVP")),
  );
  // Choose primary as Sheet Vinyl if present, secondary as Carpet if present
  const primary = hasSheetVinyl ? "Sheet Vinyl" : hasCarpet ? "Carpet" : null;
  // Ensure secondary value is from allowed enum values
  const secondary = hasSheetVinyl && hasCarpet ? "Carpet" : null;
  return { primary, secondary };
}

function validateEnumValue(value, allowedValues) {
  if (value === null || value === undefined) return null;
  return allowedValues.includes(value) ? value : null;
}

function main() {
  const html = safeRead("input.html");
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);
  if (!parcelId) {
    console.error("Parcel ID not found.");
    process.exit(1);
  }
  const binfo = parseBuildingInfo($);
  const areas = parseAreaTypes($);

  const out = buildStructureSkeleton(parcelId);

  // Fill straightforward mappings
  out.number_of_stories = binfo["Stories"] ? Number(binfo["Stories"]) : null;
  out.exterior_wall_material_primary = mapExteriorMaterial(
    binfo["Exterior Walls"],
  );
  out.interior_wall_surface_material_primary = binfo["Interior Walls"]
    ? "Drywall"
    : null;

  const fl = mapFlooringTypes(binfo["Floor Cover"]);
  out.flooring_material_primary = fl.primary;
  out.flooring_material_secondary = fl.secondary;

  out.roof_material_type = mapRoofMaterialType(binfo["Roof Cover"]);
  out.roof_covering_material = mapRoofCovering(binfo["Roof Cover"]);

  out.finished_base_area = areas.baseArea || null;

  // Windows/doors unknown
  out.exterior_door_material = null;
  out.interior_door_material = null;
  out.window_frame_material = null;
  out.window_glazing_type = null;
  out.window_operation_type = null;
  out.window_screen_material = null;

  // Gutters unknown
  out.gutters_material = null;
  out.gutters_condition = null;

  // Foundation unknown, keep Unknown/ null as set in skeleton

  // Roof condition, age unknown

  // Framing unknown

  // Structural damage indicators unknown
  out.structural_damage_indicators = null;

  // Attachment type for manufactured home unknown

  // Build output wrapper
  const wrapper = {};
  wrapper[`property_${parcelId}`] = out;

  ensureDirs();
  const json = JSON.stringify(wrapper, null, 2);
  fs.writeFileSync(path.join("owners", "structure_data.json"), json, "utf8");
  fs.writeFileSync(path.join("data", "structure_data.json"), json, "utf8");
  console.log("Wrote structure data for", parcelId);
}

main();
