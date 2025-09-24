// Structure extractor per Elephant Lexicon schema
// - Reads input.html
// - Parses visible tables and embedded JSON for components
// - Maps to required enums and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHtml() {
  const htmlPath = path.resolve("input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractRemixContext($) {
  // Extract window.__remixContext JSON blob
  let json = null;
  $("script").each((i, el) => {
    const txt = $(el).html() || "";
    const m = txt.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});?/);
    if (m && !json) {
      try {
        json = JSON.parse(m[1]);
      } catch (e) {
        // Fallback: try to trim trailing semicolon if present
        let src = m[1];
        if (src.endsWith(";")) src = src.slice(0, -1);
        try {
          json = JSON.parse(src);
        } catch (e2) {
          json = null;
        }
      }
    }
  });
  return json;
}

function extractPropertyId($) {
  // Try common places
  let id = $('[data-cell="Parcel Number"]').first().text().trim();
  if (!id) {
    $("h1, h2, th, td, span, div").each((_, el) => {
      if (id) return;
      const t = $(el).text().trim();
      if (/parcel/i.test(t)) {
        const m = t.match(/[A-Za-z0-9]{2}[-A-Za-z0-9]+/);
        if (m) id = m[0];
      }
    });
  }
  if (!id) id = "unknown_id";
  return id;
}

function textOfCell(rows, label) {
  const row = rows.filter((i, el) =>
    cheerio
      .load(el)('th,td[role="cell"]')
      .first()
      .text()
      .trim()
      .toLowerCase()
      .startsWith(label.toLowerCase()),
  );
  if (!row.length) return null;
  const td = cheerio.load(row[0])('td[role="cell"]');
  return (td.text() || "").trim() || null;
}

function norm(str) {
  return (str || "").toString().trim().toUpperCase();
}

function lowerNorm(str) {
  return (str || "").toString().trim().toLowerCase();
}

function mapExteriorWallMaterial(wallValue) {
  wallValue = lowerNorm(wallValue);
  if (wallValue.includes("stucco")) {
    return "Stucco";
  }
  if (wallValue.includes("vinyl")) {
    return "Vinyl Siding";
  }
  if (wallValue.includes("adobe")) {
    return "Adobe";
  }
  if (wallValue.includes("concrete")) {
    if (wallValue.includes("precast")) {
      return "Precast Concrete";
    }
    return "Concrete Block";
  }
  if (wallValue.includes("curtain")) {
    return "Curtain";
  }
  if (wallValue.includes("fiber")) {
    return "Fiber Cement Siding";
  }
  if (wallValue.includes("stone")) {
    if (wallValue.includes("nat")) {
      return "Natural Stone";
    }
    return "Manufactured Stone";
  }
  if (wallValue.includes("metal")) {
    return "Metal Siding";
  }
  if (wallValue.includes("wood")) {
    return "Wood Siding";
  }
  if (wallValue.includes("log")) {
    return "Log";
  }
  return null;
}

function mapPrimaryFloorMaterial(floorVal) {
  floorVal = lowerNorm(floorVal);
  if (floorVal.includes("bamboo")) {
    return "Bamboo";
  }
  if (floorVal.includes("carpet")) {
    return "Carpet";
  }
  if (floorVal.includes("ceramic")) {
    return "Ceramic Tile";
  }
  if (floorVal.includes("epoxy")) {
    return "Epoxy";
  }
  if (floorVal.includes("laminate")) {
    return "Laminate";
  }
  if (floorVal.includes("linoleum")) {
    return "Linoleum";
  }
  if (floorVal.includes("vinyl")) {
    if (floorVal.includes("luxury")) {
      return "Luxury Vinyl Plank";
    }
    return "Sheet Vinyl";
  }
  if (floorVal.includes("terrazzo")) {
    return "Terrazzo";
  }
  return null;
}

function mapSecondaryFloorMaterial(floorVal) {
  floorVal = lowerNorm(floorVal);
  if (floorVal.includes("carpet")) {
    return "Carpet";
  }
  if (floorVal.includes("ceramic")) {
    return "Ceramic Tile";
  }
  if (floorVal.includes("laminate")) {
    return "Laminate";
  }
  if (floorVal.includes("vinyl")) {
    return "Luxury Vinyl Plank";
  }
  return null;
}

function mapInteriorWallSurface(wallValue) {
  wallValue = lowerNorm(wallValue);
  if (wallValue.includes("concrete")) {
    return "Concrete";
  }
  if (wallValue.includes("drywall")) {
    return "Drywall";
  }
  if (wallValue.includes("tile")) {
    return "Tile";
  }
  if (wallValue.includes("block")) {
    return "Exposed Block";
  }
  if (wallValue.includes("brick")) {
    return "Exposed Brick";
  }
  if (wallValue.includes("glass")) {
    return "Glass Panels";
  }
  if (wallValue.includes("metal")) {
    return "Metal Panels";
  }
  if (wallValue.includes("plaster")) {
    return "Plaster";
  }
  if (wallValue.includes("shiplap")) {
    return "Shiplap";
  }
  if (wallValue.includes("stone")) {
    return "Stone Veneer";
  }
  if (wallValue.includes("wood")) {
    return "Wood Paneling";
  }
  if (wallValue.includes("wainscoting")) {
    return "Wainscoting";
  }
  return null;
}

function mapFraming(frameValue) {
  frameValue = lowerNorm(frameValue);
  if (frameValue.includes("concrete")) {
    if (frameValue.includes("block")) {
      return "Concrete Block";
    }
    if (frameValue.includes("poured")) {
      return "Poured Concrete";
    }
    return null;
  }
  if (frameValue.includes("lumber")) {
    return "Engineered Lumber";
  }
  if (frameValue.includes("log")) {
    return "Log Construction";
  }
  if (frameValue.includes("masonry")) {
    return "Masonry";
  }
  if (frameValue.includes("steel")) {
    return "Steel Frame";
  }
  if (frameValue.includes("wood")) {
    return "Wood Frame";
  }
  return null;
}

// function mapRoofCover(val) {
//   switch (norm(val)) {
//     case "ASPHALT SHINGLE":
//       // Type (3-Tab vs Architectural) not specified; leave null for covering detail
//       return null;
//     case "METAL":
//       return "Metal Standing Seam";
//     case "TPO":
//       return "TPO Membrane";
//     default:
//       return null;
//   }
// }

// function mapRoofDesignFromComponents(components) {
//   if (!Array.isArray(components)) return null;
//   const item = components.find(
//     (c) =>
//       c.category &&
//       (c.category.description || "").toUpperCase().includes("ROOF STRUCTURE"),
//   );
//   const desc = item && item.description ? item.description.toUpperCase() : "";
//   if (!desc) return null;
//   if (desc.includes("GABLE") && desc.includes("HIP")) return "Combination";
//   if (desc.includes("GABLE")) return "Gable";
//   if (desc.includes("HIP")) return "Hip";
//   if (desc.includes("FLAT")) return "Flat";
//   return null;
// }

function extractStructure($) {
  // Defaults per schema (required set to null-compatible values)
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    // Optional numeric areas
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: null,
  };

  // Locate Building 1 table
  // We only use the first building for structure
  const buildingTable = $("caption")
    .filter((i, el) => $(el).text().trim().toUpperCase().startsWith("BUILDING"))
    .first()
    .closest("table");
  if (buildingTable && buildingTable.length) {
    const rows = buildingTable.find("tbody > tr");
    const exteriorWalls = textOfCell(rows, "Exterior Walls");
    // const roofCover = textOfCell(rows, "Roof Cover");
    const interiorWalls = textOfCell(rows, "Interior Walls");
    const frame = textOfCell(rows, "Frame");
    const floor = textOfCell(rows, "Floor");
    const stories = textOfCell(rows, "Stories");
    const heatedArea = textOfCell(rows, "Heated Area");
    const totalArea = textOfCell(rows, "Total Area");

    if (exteriorWalls)
      structure.exterior_wall_material_primary =
        mapExteriorWallMaterial(exteriorWalls);
    // if (roofCover) structure.roof_covering_material = mapRoofCover(roofCover);
    if (interiorWalls)
      structure.interior_wall_surface_material_primary =
        mapInteriorWallSurface(interiorWalls);
    const fr = mapFraming(frame);
    if (fr) {
      structure.primary_framing_material = fr;
    }
    if (stories && /^\d+$/.test(stories))
      structure.number_of_stories = parseInt(stories, 10);
    if (totalArea && /^\d+$/.test(totalArea))
      structure.finished_base_area = parseInt(totalArea, 10);
    // if (totalArea && /^\d+$/.test(totalArea)) {
    //   const ta = parseInt(totalArea, 10);
    //   if (structure.finished_base_area != null) {
    //     const ub = Math.max(ta - structure.finished_base_area, 0);
    //     structure.unfinished_base_area = ub;
    //   }
    // }

    // Floor materials (can be multiple, comma-separated)
    if (floor) {
      const parts = floor.split(",").map((s) => s.trim());
      // If percentages available in Remix components, choose by highest percentage\
      structure.flooring_material_primary = mapPrimaryFloorMaterial(parts[0]);
      if (parts.length > 1) {
        structure.flooring_material_secondary = mapSecondaryFloorMaterial(parts[1]);
      }
    }
  }
  return structure;
}

(function main() {
  try {
    const $ = loadHtml();
    const remix = extractRemixContext($) || {};
    const propertySeed = readJSON("property_seed.json");
    const id = propertySeed["parcel_id"];
    const structure = extractStructure($);

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "structure_data.json");

    const payload = {};
    payload[`property_${id}`] = structure;

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote structure data for ${id} -> ${outPath}`);
  } catch (err) {
    console.error("Structure mapping failed:", err.message);
    process.exitCode = 1;
  }
})();
