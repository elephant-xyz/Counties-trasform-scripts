const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseIntSafe(txt) {
  if (txt == null) return null;
  const m = String(txt).replace(/[^0-9\-]/g, "");
  if (!m) return null;
  const v = parseInt(m, 10);
  return isNaN(v) ? null : v;
}

function extractStrap($, rawHtml) {
  let strap = null;
  const scriptsText = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const m = scriptsText.match(/var\s+g_strap\s*=\s*"(\d+)"/);
  if (m) strap = m[1];
  if (!strap) {
    const pn = $("#pacel_no").text().trim();
    if (pn) strap = pn.replace(/\D/g, "");
  }
  return strap || "unknown_id";
}

/**
 * Maps a sub-area code/description from the HTML to a schema-defined space_type.
 * This mapping is crucial and might need refinement based on specific property types (residential vs. commercial).
 * @param {string} subAreaText - e.g., "Base (BAS):", "Office Good (OFG):", "Canopy(only or loading platform) (CAW):"
 * @returns {string | null} The corresponding space_type from the schema enum.
 */
function mapSubAreaToSpaceType(subAreaText) {
  const text = subAreaText.toLowerCase();

  // Extract code if present (e.g., "BAS", "OFG", "CAW")
  const codeMatch = text.match(/\(([^)]+)\)/);
  const code = codeMatch ? codeMatch[1].toUpperCase() : null;

  switch (code) {
    case 'OFG': // Office Good
    case 'OFA': // Office Average
      return "Home Office"; // Closest in schema, assuming it's an office within the property.
    case 'OPF': // Open Porch
    case 'OPU': // Open Porch
      return "Porch";
    case 'CAW': // Canopy (only or loading platform)
      // "Carport" or "Shed" could fit. "Shed" is in the enum.
      return "Shed";
    // Add more mappings as needed based on observed codes
    default:
      // Fallback based on keywords if no code or code not mapped
      if (text.includes("office")) return "Home Office";
      if (text.includes("porch")) return "Porch";
      if (text.includes("canopy")) return "Shed";
      if (text.includes("wasteland") || text.includes("marsh")) return "VacantLand"; // Not a space_type, but might appear in sub-areas
      return null; // No direct mapping found in schema
  }
}

/**
 * Determines if a space is exterior based on its type.
 * @param {string | null} spaceType
 * @returns {boolean}
 */
function isExteriorSpace(spaceType) {
  if (!spaceType) return false;
  const exteriorTypes = ["Porch", "Screened Porch", "Sunroom", "Deck", "Patio", "Pergola", "Balcony", "Terrace", "Gazebo", "Pool House", "Outdoor Kitchen", "Attached Garage", "Detached Garage", "Carport", "Shed", "Pool Area", "Outdoor Pool", "Hot Tub / Spa Area"];
  return exteriorTypes.includes(spaceType);
}

/**
 * Determines if a space is finished based on its sub-area text.
 * @param {string} subAreaText
 * @returns {boolean}
 */
function isFinishedSpace(subAreaText) {
  const unfinished_regex = /SEMI-FINISHED|UNFINISHED|SEMIFINISHED/i;
  return !unfinished_regex.test(subAreaText);
}

function defaultRoom(space_type, index, is_finished, sizeSqFt, is_exterior) {
  return {
    space_type: space_type,
    space_index: index,
    flooring_material_type: null, // Not in HTML
    size_square_feet: sizeSqFt,
    floor_level: null, // Not in HTML, assuming 1st floor for all if not specified
    has_windows: null, // Not in HTML
    window_design_type: null, // Not in HTML
    window_material_type: null, // Not in HTML
    window_treatment_type: null, // Not in HTML
    is_finished: is_finished,
    furnished: null, // Not in HTML
    paint_condition: null, // Not in HTML
    flooring_wear: null, // Not in HTML
    clutter_level: null, // Not in HTML
    visible_damage: null, // Not in HTML
    countertop_material: null, // Not in HTML
    cabinet_style: null, // Not in HTML
    fixture_finish_quality: null, // Not in HTML
    design_style: null, // Not in HTML
    natural_light_quality: null, // Not in HTML
    decor_elements: null, // Not in HTML
    pool_type: null, // Not in HTML
    pool_equipment: null, // Not in HTML
    spa_type: null, // Not in HTML
    safety_features: null, // Not in HTML
    view_type: null, // Not in HTML
    lighting_features: null, // Not in HTML
    condition_issues: null, // Not in HTML
    is_exterior: is_exterior,
    pool_condition: null, // Not in HTML
    pool_surface_type: null, // Not in HTML
    pool_water_quality: null, // Not in HTML
  };
}

(function main() {
  try {
    const rawHtml = fs.readFileSync("input.html", "utf8");
    const $ = cheerio.load(rawHtml);

    const strap = extractStrap($, rawHtml);
    const allLayouts = [];
    let globalSpaceIndex = 1; // To ensure unique space_index across all buildings
    // Iterate through each "Structural Elements and Sub Area Information" panel
    const $buildingEl = $("#divStructuralElementContainer .panel.panel-default.col-Area-Information").first();
    const buildingTitle = $buildingEl.find(".panel-heading .detail-title").text().trim();
    // console.log(`Processing: ${buildingTitle}`);

    // Find the "Sub Area" table within this building's panel
    const $subAreaTable = $buildingEl.find("table.table-bordered").filter((i, table) => {
      return $(table).find("th").first().text().trim() === "Sub Area";
    });

    if ($subAreaTable.length === 0) {
      console.warn(`No "Sub Area" table found for ${buildingTitle}.`);
      return; // Skip to next building
    }

    $subAreaTable.find('tbody tr').each((i, row) => {
      const $row = $(row);
      const subAreaText = $row.find('td').eq(0).text().trim();

      // Skip the "Total Area SF" summary row
      if (subAreaText.toLowerCase().includes("total area sf")) {
        return;
      }

      const heatedAreaSfText = $row.find('td').eq(1).text().trim();
      const grossAreaSfText = $row.find('td').eq(2).text().trim();

      const sizeSqFt = parseIntSafe(heatedAreaSfText) || parseIntSafe(grossAreaSfText);
      // console.log(globalSpaceIndex + " " + subAreaText + " " + sizeSqFt);

      if (sizeSqFt === null || sizeSqFt === 0) {
        console.warn(`Skipping sub-area "${subAreaText}" due to invalid size.`);
        return;
      }

      const space_type = mapSubAreaToSpaceType(subAreaText);
      const is_finished = isFinishedSpace(subAreaText);
      const is_exterior = isExteriorSpace(space_type); // Infer from mapped space_type

      // Create a layout object for this sub-area
      const layout = defaultRoom(space_type, globalSpaceIndex++, is_finished, sizeSqFt, is_exterior);
      allLayouts.push(layout);
    });

    const outDir = path.join("owners");
    ensureDir(outDir);
    const outPath = path.join(outDir, "layout_data.json");

    const key = `property_${strap}`;
    const payload = {};
    payload[key] = { layouts: allLayouts };

    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`Wrote layout data for ${key} to ${outPath}`);
  } catch (err) {
    console.error("Error building layout data:", err);
    process.exit(1);
  }
})();
