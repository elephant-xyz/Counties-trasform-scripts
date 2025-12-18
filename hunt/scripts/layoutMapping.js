// Layout data extractor using Cheerio
// Reads input.html, parses improvements to infer exterior spaces like Open Porch and Sheds, maps to schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function getText($, el) {
  if (!el || el.length === 0) return "";
  return $(el).text().replace(/\s+/g, " ").trim();
}

function parseNumber(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function extractPropertyId($) {
  let pid = getText($, $('th:contains("Property ID:")').first().next("td"));
  if (!pid) {
    const title = getText($, $(".page-title h3").first());
    const m = title.match(/Property ID:\s*(\d+)/i);
    if (m) pid = m[1];
  }
  return pid || "unknown";
}

function extractLivingArea($) {
  let sqft = null;
  $('.panel .panel-heading:contains("Property Improvement - Building")').each(
    (_, heading) => {
      const panel = $(heading).closest(".panel");
      $(panel)
        .find(".panel-table-info span,strong")
        .each((__, node) => {
          const t = getText($, node);
          const m = t.match(/Living Area:\s*([0-9,.]+)\s*sqft/i);
          if (m) {
            const n = parseNumber(m[1]);
            if (Number.isFinite(n)) sqft = n;
          }
        });
    },
  );
  return sqft;
}

function extractMainBuiltYear($) {
  let year = null;
  $('.panel .panel-heading:contains("Property Improvement - Building")').each(
    (_, heading) => {
      const panel = $(heading).closest(".panel");
      const tables = $(panel).find("table");
      tables.each((__, tbl) => {
        $(tbl)
          .find("tr")
          .each((___, tr) => {
            const $cells = $(tr).find("td");
            if ($cells.length >= 5) {
              const type = getText($, $cells.eq(0));
              // Find the main area (MA) row
              if (/^MA/i.test(type)) {
                const yearBuilt = parseNumber(getText($, $cells.eq(3)));
                if (yearBuilt) year = yearBuilt;
              }
            }
          });
      });
    },
  );
  return year;
}

function makeNeutralRoom(spaceType, index, sizeSqft, isExterior, builtYear, improvementDetails) {
  return {
    space_type: spaceType,
    space_index: index,
    flooring_material_type: null,
    size_square_feet: sizeSqft || null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    // All CAD-documented building improvements are considered finished structures for tax assessment
    is_finished: true,
    furnished: null,
    paint_condition: null,
    flooring_wear: null,
    clutter_level: null,
    visible_damage: null,
    countertop_material: null,
    cabinet_style: null,
    fixture_finish_quality: null,
    design_style: null,
    natural_light_quality: null,
    decor_elements: null,
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null,
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: !!isExterior,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,

    // optional dates
    bathroom_renovation_date: null,
    flooring_installation_date: null,
    kitchen_renovation_date: null,
    spa_installation_date: null,
    pool_installation_date: null,
    built_year: builtYear || null,

    // Highlight feature details from CAD input
    feature_highlight: improvementDetails ? {
      type_code: improvementDetails.typeCode || null,
      description: improvementDetails.description || null,
      class_code: improvementDetails.classCode || null,
      year_built: improvementDetails.yearBuilt || null,
      original_sqft: improvementDetails.sqft || null,
      is_highlighted: true
    } : null,
  };
}

function mapImprovementTypeToSpaceType(type, desc) {
  // Map improvement types to lexicon-compliant space_type values

  // MAIN AREA and BARNS are handled as buildings, not layouts - skip them
  if (/^MA/i.test(type)) return null; // Main Area -> Building
  if (/BARN/i.test(desc)) return null; // Barns -> Building

  // Map based on description patterns
  if (/OPEN PORCH/i.test(desc)) return "Open Porch";
  if (/ENCLOSED PORCH/i.test(desc)) return "Enclosed Porch";
  if (/SCREEN.*PORCH/i.test(desc)) return "Screened Porch";
  if (/PORCH/i.test(desc)) return "Porch";

  if (/CARPORT.*FREESTANDING/i.test(desc)) return "Detached Carport";
  if (/CARPORT.*ATTACHED/i.test(desc)) return "Attached Carport";
  if (/CARPORT/i.test(desc)) return "Carport";

  if (/SHED|STORAGE|STG/i.test(desc)) return "Shed";
  if (/WORKSHOP/i.test(desc)) return "Workshop";

  if (/METAL BUILDING/i.test(desc)) return "Storage Room";
  if (/OUT.*BLDG/i.test(desc)) return "Storage Room";

  if (/GAZEBO/i.test(desc)) return "Gazebo";
  if (/PERGOLA/i.test(desc)) return "Pergola";
  if (/DECK/i.test(desc)) return "Deck";
  if (/PATIO/i.test(desc)) return "Patio";
  if (/POOL HOUSE/i.test(desc)) return "Pool House";
  if (/OUTDOOR KITCHEN/i.test(desc)) return "Outdoor Kitchen";
  if (/GREENHOUSE/i.test(desc)) return "Greenhouse";

  if (/SITE.*IMPROVEMENT/i.test(desc)) return "Courtyard";

  // Default fallback for unrecognized improvements
  return "Storage Room";
}

function parseImprovementsToLayouts($, startIndex) {
  const layouts = [];
  let idx = startIndex;

  // Find building improvements table: contains rows with Type / Description / Class / Year Built / SQFT
  $('.panel .panel-heading:contains("Property Improvement - Building")').each(
    (_, heading) => {
      const panel = $(heading).closest(".panel");
      const tables = $(panel).find("table");

      tables.each((__, tbl) => {
        $(tbl)
          .find("tr")
          .each((___, tr) => {
            const $cells = $(tr).find("td");
            if ($cells.length >= 5) {
              const type = getText($, $cells.eq(0));
              const desc = getText($, $cells.eq(1));
              const classCode = getText($, $cells.eq(2));
              const yearBuilt = parseNumber(getText($, $cells.eq(3)));
              const sqft = parseNumber(getText($, $cells.eq(4)));

              // Map improvement to appropriate space_type
              const spaceType = mapImprovementTypeToSpaceType(type, desc);

              // Only create layout if it's not a building (main area or barn)
              if (spaceType) {
                // Determine if it's an exterior space
                const isExterior = [
                  "Open Porch", "Enclosed Porch", "Screened Porch", "Porch",
                  "Carport", "Attached Carport", "Detached Carport",
                  "Shed", "Workshop", "Gazebo", "Pergola", "Deck", "Patio",
                  "Pool House", "Outdoor Kitchen", "Greenhouse", "Courtyard",
                  "Storage Room"
                ].includes(spaceType);

                // Create improvement details object for highlighting
                const improvementDetails = {
                  typeCode: type,
                  description: desc,
                  classCode: classCode,
                  yearBuilt: yearBuilt,
                  sqft: sqft
                };

                layouts.push(makeNeutralRoom(spaceType, idx++, sqft, isExterior, yearBuilt, improvementDetails));
              }
            }
          });
      });
    },
  );

  return { layouts, nextIndex: idx };
}

function mapLayouts($) {
  const propertyId = extractPropertyId($);

  const livingArea = extractLivingArea($);
  const mainBuiltYear = extractMainBuiltYear($);
  const layouts = [];
  let index = 1;

  // Generic interior space representing main living area footprint (no detailed rooms available)
  // Create improvement details for the main living area
  const mainAreaDetails = {
    typeCode: "MA",
    description: "MAIN AREA",
    classCode: null,
    yearBuilt: mainBuiltYear,
    sqft: livingArea
  };
  layouts.push(makeNeutralRoom("Living Room", index++, livingArea, false, mainBuiltYear, mainAreaDetails));

  // Parse improvements to add porches and sheds as highlighted features
  const { layouts: extraLayouts, nextIndex } = parseImprovementsToLayouts(
    $,
    index,
  );
  layouts.push(...extraLayouts);
  index = nextIndex;

  return { key: `property_${propertyId}`, data: { layouts } };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const { key, data } = mapLayouts($);

  const outDir = path.join(process.cwd(), "owners");
  ensureDir(outDir);
  const outPath = path.join(outDir, "layout_data.json");

  const output = {};
  output[key] = data;

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for ${key} -> ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error generating layout data:", err.message);
    process.exit(1);
  }
}
