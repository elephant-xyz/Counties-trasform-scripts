// Structure mapping script
// Reads input.html, parses building and summary data using cheerio, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
const BUILDING_SECTION_TITLE = "Building Information";
const EXTRA_FEATURE_SECTION_TITLE = "Extra Features";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function parseNumber(val) {
  if (val == null) return null;
  const n = Number(String(val).replace(/[,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function collectExtraFeatures($) {
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        EXTRA_FEATURE_SECTION_TITLE,
    )
    .first();
  if (!section.length) return [];
  const rows = section.find("table tbody tr");
  const features = [];
  rows.each((_, tr) => {
    const $tr = $(tr);
    const code = textTrim($tr.find("th").first().text());
    const tds = $tr.find("td");
    if (!tds.length) return;
    const description = textTrim($(tds[0]).text());
    const unitsText = textTrim($(tds[2]).text());
    const unitType = textTrim($(tds[3]).text()) || null;
    const yearBuilt = textTrim($(tds[4]).text()) || null;
    const units = parseNumber(unitsText);
    features.push({
      code: code || null,
      description: description || null,
      units,
      unit_type: unitType,
      raw_units_text: unitsText || null,
      year_built: yearBuilt,
    });
  });
  return features;
}

function hasConcreteSurface(extraFeatures) {
  return extraFeatures.some((feature) =>
    /SLB|SLAB|CONC|PAV/i.test(feature.description || ""),
  );
}

function mapExteriorMaterials(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (!t) return;
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Siding");
    if (t.includes("STUC")) out.push("Stucco");
    if (t.includes("VINYL")) out.push("Vinyl Siding");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
}

function mapInteriorSurface(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("BRK") || t.includes("BRICK")) out.push("Brick");
    if (t.includes("CEDAR") || t.includes("WOOD")) out.push("Wood Frame");
    if (t.includes("STEEL")) out.push("Steel Frame");
    if (t.includes("BLOCK") || t.includes("CONCRETE")) out.push("Concrete Block");
  });
  return out;
}

function mapFlooring(tokens) {
  const out = [];
  tokens.forEach((tok) => {
    const t = tok.toUpperCase().trim();
    if (t.includes("CARPET")) out.push("Carpet");
    if (t.includes("VINYL")) out.push("Sheet Vinyl");
    if (t.includes("CERAMIC")) out.push("Ceramic Tile");
    if (t.includes("LVP")) out.push("Luxury Vinyl Plank");
    if (t.includes("LAMINATE")) out.push("Laminate");
    if (t.includes("STONE")) out.push("Natural Stone Tile");
  });
  return out;
}

function buildStructureRecord(building, extraFeatures, totalBuildings) {
  // Defaults per schema requirements (all present, many null)
  const rec = {
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
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
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

  const buildingData = building || {};

  const extVals = (buildingData["Exterior Walls"] || buildingData["Exterior Wall"] || "")
    .split(/[;&/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const intVals = (buildingData["Interior Walls"] || buildingData["Interior Wall"] || "")
    .split(/[;&/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const floorVals = (buildingData["Floor Cover"] || "")
    .split(/[;&/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const roofVals = (buildingData["Roof Cover"] || "")
    .split(/[;&/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const frameVals = (buildingData["Frame Type"] || buildingData["Wall Type"] || "")
    .split(/[;&/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const ext = mapExteriorMaterials(extVals);
  if (ext.length) {
    rec.exterior_wall_material_primary = ext[0] || null;
    if (ext.length > 1) rec.exterior_wall_material_secondary = ext[1] || null;
  }

  const intSurf = mapInteriorSurface(intVals);
  if (intSurf.length) {
    rec.interior_wall_structure_material = intSurf[0] || null;
  }

  const floors = mapFlooring(floorVals);
  if (floors.length) {
    rec.flooring_material_primary = floors[0] || null;
  }

  if (roofVals.length) {
    const roofText = roofVals.join(" ").toUpperCase();
    if (roofText.includes("METAL")) rec.roof_covering_material = "Metal";
    else if (roofText.includes("SHING")) rec.roof_covering_material = "Architectural Asphalt Shingle";
  }

  if (frameVals.length) {
    const frameText = frameVals.join(" ").toUpperCase();
    if (frameText.includes("WOOD")) rec.primary_framing_material = "Wood Frame";
    if (frameText.includes("STEEL")) rec.primary_framing_material = "Steel Frame";
    if (frameText.includes("BLOCK")) rec.primary_framing_material = "Concrete Block";
  }

  const stories = parseNumber(buildingData["Stories"]);
  if (stories) rec.number_of_stories = stories;

  const totalArea = parseNumber(
    buildingData["Total Area"] || buildingData["Total Sq Ft"] || buildingData["Total Living Area"],
  );
  const heatedArea = parseNumber(
    buildingData["Heated Area"] ||
      buildingData["Heated"] ||
      buildingData["Living Area"] ||
      buildingData["Liv Area"] ||
      buildingData["Heated Living Area"],
  );
  if (Number.isFinite(totalArea)) rec.finished_base_area = totalArea;
  if (Number.isFinite(heatedArea)) rec.finished_upper_story_area = heatedArea;

  if (Number.isFinite(totalBuildings)) rec.number_of_buildings = totalBuildings;
  if (hasConcreteSurface(extraFeatures || [])) {
    if (!rec.foundation_type) rec.foundation_type = "Slab on Grade";
    if (!rec.foundation_material) rec.foundation_material = "Poured Concrete";
  }

  return rec;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) {
    throw new Error("Parcel ID not found");
  }
  const buildings = collectBuildings($);
  const extraFeatures = collectExtraFeatures($);
  const totalBuildings = buildings.length;
  const structures = buildings.map((b, idx) => {
    const rawType = (b["Type"] || "").toUpperCase();
    const isExtra = rawType.includes("EXTRA");
    return {
      building_id: `building_${idx + 1}`,
      is_extra: isExtra,
      source_building_type: b["Type"] || null,
      structure: buildStructureRecord(b, extraFeatures, totalBuildings),
    };
  });

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = {
    buildings: structures,
    extra_features: extraFeatures,
  };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
