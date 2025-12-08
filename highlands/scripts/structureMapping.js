const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Add the ensureDir function here if it's not already in this file
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);
  return { $, html };
}

function extractPropertyId($, html) {
  // Prefer GLOBAL_Strap from inline script if present
  const scripts = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scripts.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
  if (m) return m[1].trim();
  // Fallback: from heading text "Parcel <id>"
  const h = $('h2:contains("Parcel")').first().text();
  const m2 = h.match(/Parcel\s+([^\s]+)/i);
  if (m2) return m2[1].trim();
  // Last resort: a stable default
  return "unknown_id";
}

function findNextTableWithHeader($, startElement, headerText) {
  let current = $(startElement);
  while (current.length) {
    current = current.next();
    if (!current.length) break;
    if (current.is("table")) {
      const firstHeader = current.find("thead th").first();
      if (firstHeader && firstHeader.text().trim() === headerText) return current;
    }
    const nested = current
      .find("table")
      .filter((__, tbl) => {
        const firstHeader = $(tbl).find("thead th").first();
        return firstHeader && firstHeader.text().trim() === headerText;
      })
      .first();
    if (nested.length) return nested;
  }
  return $();
}

function extractBuildingDetails($) {
  const details = [];
  $("b").each((_, el) => {
    const label = $(el).text().trim();
    const match = label.match(/^Building\s+(\d+)/i);
    if (!match) return;
    const buildingIndex = String(match[1]);

    const elementTable = findNextTableWithHeader($, el, "Element");

    const elements = {};
    if (elementTable && elementTable.length) {
      $(elementTable)
        .find("tr")
        .each((__, tr) => {
          const tds = $(tr).find("td");
          if (tds.length >= 3) {
            const key = $(tds[0]).text().trim();
            const desc = $(tds[2]).text().trim();
            if (key) elements[key] = desc;
          }
        });
    }

    let basArea = null;
    const subareasHeader = $(el)
      .nextAll("b")
      .filter((__, b) => $(b).text().trim().toLowerCase() === "subareas")
      .first();
    if (subareasHeader && subareasHeader.length) {
      const subareaTable = findNextTableWithHeader($, subareasHeader[0], "Type");
      if (subareaTable && subareaTable.length) {
        $(subareaTable)
          .find("tr")
          .each((__, tr) => {
            const tds = $(tr).find("td");
            if (tds.length >= 2) {
              const code = $(tds[0]).text().trim().toUpperCase();
              if (!code || $(tr).find("th").length) return;
              if (code === "BAS") {
                const gross = parseInt($(tds[1]).text().replace(/[,]/g, ""), 10);
                if (Number.isFinite(gross)) basArea = gross;
              }
            }
          });
      }
    }

    details.push({ buildingIndex, elements, basArea });
  });
  return details;
}

function mapExteriorWallMaterial(desc) {
  if (!desc || /none/i.test(desc)) return null;
  if (/concrete\s*block/i.test(desc)) return "Concrete Block";
  if (/brick/i.test(desc)) return "Brick";
  if (/stucco/i.test(desc)) return "Stucco";
  if (/vinyl/i.test(desc)) return "Vinyl Siding";
  if (/wood/i.test(desc)) return "Wood Siding";
  if (/metal/i.test(desc)) return "Metal Siding";
  return null;
}

function mapExteriorAccentMaterial(desc) {
  if (!desc || /none/i.test(desc)) return null;
  const d = desc.toLowerCase();
  if (d.includes("brick")) return "Brick Accent";
  if (d.includes("stone")) return "Stone Accent";
  if (d.includes("stucco")) return "Stucco Accent";
  if (d.includes("vinyl") || d.includes("siding")) return "Vinyl Accent";
  if (d.includes("wood") || d.includes("trim")) return "Wood Trim";
  if (d.includes("decor")) return "Decorative Block";
  if (d.includes("block") && d.includes("decorative")) return "Decorative Block";
  if (d.includes("metal") || d.includes("alum")) return "Metal Trim";
  return null;
}

function mapRoofDesign(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("gable") && d.includes("hip")) return "Combination";
  if (d.includes("gable")) return "Gable";
  if (d.includes("hip")) return "Hip";
  if (d.includes("flat")) return "Flat";
  if (d.includes("mansard")) return "Mansard";
  if (d.includes("shed")) return "Shed";
  return null;
}

function mapRoofCovering(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("metal")) {
    // Unknown subtype; leave specific covering null to avoid incorrect assumption
    return null; // choose to set roof_material_type as 'Metal' separately
  }
  if (d.includes("shingle")) return "Architectural Asphalt Shingle";
  if (d.includes("tile")) return "Clay Tile";
  if (d.includes("tpo")) return "TPO Membrane";
  if (d.includes("epdm")) return "EPDM Membrane";
  return null;
}

function mapInteriorWallSurface(desc) {
  if (!desc) return null;
  if (/plaster/i.test(desc) || /plastered/i.test(desc)) return "Plaster";
  if (/drywall/i.test(desc) || /gypsum/i.test(desc)) return "Drywall";
  if (/wood/i.test(desc)) return "Wood Paneling";
  return null;
}

function mapFlooring(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("carpet")) return "Carpet";
  if (d.includes("asphalt")) return "Linoleum"; // best-effort mapping for asphalt tile
  if (d.includes("tile")) {
    if (d.includes("ceramic")) return "Ceramic Tile";
    return "Ceramic Tile";
  }
  if (d.includes("vinyl")) return "Sheet Vinyl";
  if (d.includes("hardwood")) return "Solid Hardwood";
  if (d.includes("laminate")) return "Laminate";
  if (d.includes("concrete")) return "Polished Concrete";
  return null;
}

function buildStructures($, html) {
  const id = extractPropertyId($, html);
  const buildingDetails = extractBuildingDetails($);
  const buildings = buildingDetails.map(({ buildingIndex, elements, basArea }) => {
    const exterior1 = mapExteriorWallMaterial(elements["Exterior Wall"]);
    const exterior2 = mapExteriorAccentMaterial(elements["Exterior Wall 2"]);
    const roofDesign = mapRoofDesign(elements["Roof Structure"]);
    const roofCover = mapRoofCovering(elements["Roof Cover"]);
    const interiorWallSurf = mapInteriorWallSurface(elements["Interior Wall"]);
    const interiorFloor = mapFlooring(elements["Interior Flooring"]);

    const structure = {
      architectural_style_type: null,
      attachment_type: "Detached",
      ceiling_condition: null,
      ceiling_height_average: null,
      ceiling_insulation_type: "Unknown",
      ceiling_structure_material: null,
      ceiling_surface_material: null,
      exterior_door_material: null,
      exterior_wall_condition: null,
      exterior_wall_condition_primary: null,
      exterior_wall_condition_secondary: null,
      exterior_wall_insulation_type: "Unknown",
      exterior_wall_insulation_type_primary: "Unknown",
      exterior_wall_insulation_type_secondary: "Unknown",
      exterior_wall_material_primary: exterior1 || null,
      exterior_wall_material_secondary: exterior2 || null,
      finished_base_area: basArea != null ? basArea : null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      flooring_condition: null,
      flooring_material_primary: interiorFloor || null,
      flooring_material_secondary: null,
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
      interior_wall_structure_material: null,
      interior_wall_structure_material_primary: null,
      interior_wall_structure_material_secondary: null,
      interior_wall_surface_material_primary: interiorWallSurf || null,
      interior_wall_surface_material_secondary: null,
      number_of_stories: null,
      primary_framing_material:
        exterior1 === "Concrete Block" ? "Concrete Block" : null,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: roofCover,
      roof_date: null,
      roof_design_type: roofDesign,
      roof_material_type: "Metal",
      roof_structure_material: null,
      roof_underlayment_type: "Unknown",
      secondary_framing_material: null,
      structural_damage_indicators: null,
      subfloor_material: "Concrete Slab",
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      window_frame_material: null,
      window_glazing_type: null,
      window_operation_type: null,
      window_screen_material: null,
    };

    return { building_index: buildingIndex, structure };
  });

  if (!buildings.length) {
    buildings.push({
      building_index: "1",
      structure: {
        architectural_style_type: null,
        attachment_type: "Detached",
        ceiling_condition: null,
        ceiling_height_average: null,
        ceiling_insulation_type: "Unknown",
        ceiling_structure_material: null,
        ceiling_surface_material: null,
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
        roof_material_type: "Metal",
        roof_structure_material: null,
        roof_underlayment_type: "Unknown",
        secondary_framing_material: null,
        structural_damage_indicators: null,
        subfloor_material: "Concrete Slab",
        unfinished_base_area: null,
        unfinished_basement_area: null,
        unfinished_upper_story_area: null,
        window_frame_material: null,
        window_glazing_type: null,
        window_operation_type: null,
        window_screen_material: null,
      },
    });
  }

  return { id, buildings };
}

function main() {
  const { $, html } = loadHtml();
  const { id, buildings } = buildStructures($, html);
  const out = {};
  out[`property_${id}`] = { buildings };

  // Ensure the 'owners' directory exists before writing the file
  const ownersDirPath = path.resolve("owners");
  ensureDir(ownersDirPath);

  const outPath = path.resolve(ownersDirPath, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
}

if (require.main === module) {
  main();
}
