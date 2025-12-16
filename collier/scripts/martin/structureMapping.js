// Structure mapping script
// Reads input.html, parses with cheerio, maps to structure schema, writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const MATERIAL_ENUMS = {
  exteriorWall: {
    map: new Map([
      [/stucco/i, "Stucco"],
      [/concrete\s*block|block/i, "Concrete Block"],
      [/stone/i, "Natural Stone"],
      [/manufactured stone|synthetic masonry/i, "Manufactured Stone"],
      [/vinyl/i, "Vinyl Siding"],
      [/wood siding|clapboard|log/i, "Wood Siding"],
      [/fiber\s*cemen/i, "Fiber Cement Siding"],
      [/metal/i, "Metal Siding"],
      [/brick/i, "Brick"],
      [/curtain/i, "Curtain Wall"],
      [/precast/i, "Precast Concrete"],
      [/eifs/i, "EIFS"],
      [/adobe/i, "Adobe"],
      [/log/i, "Log"],
    ]),
  },
  roofCover: {
    map: new Map([
      [/metal\s*stand/i, "Metal Standing Seam"],
      [/metal\s*corr|corrugated/i, "Metal Corrugated"],
      [/metal/i, "Metal Standing Seam"],
      [/cement\s*tile|concrete\s*tile/i, "Concrete Tile"],
      [/clay\s*tile/i, "Clay Tile"],
      [/slate/i, "Natural Slate"],
      [/synthetic\s*slate/i, "Synthetic Slate"],
      [/shake/i, "Wood Shake"],
      [/(architect|comp\s*sh\s*240|comp\s*sh\s*heavy)/i, "Architectural Asphalt Shingle"],
      [/(asphalt\s*shingle|comp\s*sh\s*to\s*235|composition\s*shingle)/i, "3-Tab Asphalt Shingle"],
      [/shingle/i, "Architectural Asphalt Shingle"],
      [/(built[-\s]?up|composition\s*roll)/i, "Built-Up Roof"],
      [/tpo/i, "TPO Membrane"],
      [/epdm/i, "EPDM Membrane"],
      [/modified/i, "Modified Bitumen"],
      [/green/i, "Green Roof System"],
      [/solar/i, "Solar Integrated Tiles"],
    ]),
  },
};

const STRUCTURE_FIELDS = [
  "architectural_style_type",
  "attachment_type",
  "ceiling_condition",
  "ceiling_height_average",
  "ceiling_insulation_type",
  "ceiling_structure_material",
  "ceiling_surface_material",
  "exterior_door_installation_date",
  "exterior_door_material",
  "exterior_wall_condition",
  "exterior_wall_condition_primary",
  "exterior_wall_condition_secondary",
  "exterior_wall_insulation_type",
  "exterior_wall_insulation_type_primary",
  "exterior_wall_insulation_type_secondary",
  "exterior_wall_material_primary",
  "exterior_wall_material_secondary",
  "finished_base_area",
  "finished_basement_area",
  "finished_upper_story_area",
  "flooring_condition",
  "flooring_material_primary",
  "flooring_material_secondary",
  "foundation_condition",
  "foundation_material",
  "foundation_repair_date",
  "foundation_type",
  "foundation_waterproofing",
  "gutters_condition",
  "gutters_material",
  "interior_door_material",
  "interior_wall_condition",
  "interior_wall_finish_primary",
  "interior_wall_finish_secondary",
  "interior_wall_structure_material",
  "interior_wall_structure_material_primary",
  "interior_wall_structure_material_secondary",
  "interior_wall_surface_material_primary",
  "interior_wall_surface_material_secondary",
  "number_of_buildings",
  "number_of_stories",
  "primary_framing_material",
  "roof_age_years",
  "roof_condition",
  "roof_covering_material",
  "roof_date",
  "roof_design_type",
  "roof_material_type",
  "roof_structure_material",
  "roof_underlayment_type",
  "secondary_framing_material",
  "siding_installation_date",
  "structural_damage_indicators",
  "subfloor_material",
  "unfinished_base_area",
  "unfinished_basement_area",
  "unfinished_upper_story_area",
  "window_frame_material",
  "window_glazing_type",
  "window_installation_date",
  "window_operation_type",
  "window_screen_material",
];

function createEmptyObject(fields) {
  return fields.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {});
}

function createEmptyStructure() {
  return createEmptyObject(STRUCTURE_FIELDS);
}

function normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

function applyRegexMap(value, mapEntries) {
  if (!value) return null;
  const raw = normalize(value);
  for (const [pattern, mapped] of mapEntries) {
    if (pattern.test(raw)) return mapped;
  }
  return null;
}

function mapAttachmentType(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("attached")) return "Attached";
  if (raw.includes("semi") || raw.includes("duplex")) return "SemiDetached";
  if (raw.includes("detached") || raw.includes("stand alone")) return "Detached";
  return null;
}

function mapExteriorWallMaterial(value) {
  if (!value) return null;
  return applyRegexMap(value, MATERIAL_ENUMS.exteriorWall.map);
}

function mapExteriorWallAccent(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("brick")) return "Brick Accent";
  if (raw.includes("stone") || raw.includes("veneer")) return "Stone Accent";
  if (raw.includes("manufactured stone") || raw.includes("synthetic")) {
    return "Stone Accent";
  }
  if (raw.includes("wood")) return "Wood Trim";
  if (raw.includes("metal") || raw.includes("aluminum")) return "Metal Trim";
  if (raw.includes("stucco")) return "Stucco Accent";
  if (raw.includes("vinyl")) return "Vinyl Accent";
  if (raw.includes("block")) return "Decorative Block";
  return null;
}

function mapPrimaryFramingMaterial(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.includes("concrete block") || raw.includes("block")) return "Concrete Block";
  if (raw.includes("poured")) return "Poured Concrete";
  if (raw.includes("masonry")) return "Masonry";
  if (raw.includes("steel")) return "Steel Frame";
  if (raw.includes("engineered")) return "Engineered Lumber";
  if (raw.includes("post") || raw.includes("beam")) return "Post and Beam";
  if (raw.includes("log")) return "Log Construction";
  if (raw.includes("wood") || raw.includes("stud")) return "Wood Frame";
  return null;
}

function mapRoofCovering(value) {
  if (!value) return null;
  return applyRegexMap(value, MATERIAL_ENUMS.roofCover.map);
}

function mapRoofMaterialTypeFromCovering(coveringEnum) {
  if (!coveringEnum) return null;
  const mapping = {
    "3-Tab Asphalt Shingle": "Shingle",
    "Architectural Asphalt Shingle": "Shingle",
    "Metal Standing Seam": "Metal",
    "Metal Corrugated": "Metal",
    "Clay Tile": "Tile",
    "Concrete Tile": "Tile",
    "Natural Slate": "Stone",
    "Synthetic Slate": "Stone",
    "Wood Shake": "Wood",
    "Wood Shingle": "Wood",
    "TPO Membrane": "Composition",
    "EPDM Membrane": "Composition",
    "Modified Bitumen": "Composition",
    "Built-Up Roof": "Composition",
    "Green Roof System": "Shingle",
    "Solar Integrated Tiles": "Tile",
  };
  return mapping[coveringEnum] || null;
}

function textAfterStrong($el) {
  const html = $el.html() || "";
  const noStrong = html
    .replace(/<strong>[^<]*<\/strong>/i, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cheerio.load(`<div>${noStrong}</div>`)("div").text().trim();
}

function parseNumberFromText(txt) {
  if (!txt) return null;
  const match = String(txt).replace(/[,\s]/g, "").match(/(-?\d+\.?\d*)/);
  return match ? Number(match[1]) : null;
}

function toInt(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return null;
  return Math.round(Number(num));
}

(function main() {
  try {
    const inputPath = path.resolve("input.html");
    const html = fs.readFileSync(inputPath, "utf8");
    const $ = cheerio.load(html);

    let ain = null;
    $("div.table-section.building-table table tr td").each((_, el) => {
      const td = $(el);
      const strong = td.find("strong").first().text().trim();
      if (/^AIN$/i.test(strong)) ain = textAfterStrong(td);
    });

    if (!ain) {
      $("div.table-section.general-info table tr td table tr td").each(
        (_, el) => {
          const td = $(el);
          const strong = td.find("strong").first().text().trim();
          if (/^Account Number$/i.test(strong)) ain = textAfterStrong(td);
        },
      );
    }

    const propertyId = ain
      ? `property_${String(ain).trim()}`
      : "property_unknown";

    let useCodeText = null;
    $("div.table-section.building-table td").each((_, td) => {
      const strong = $(td).find("strong").first().text().trim();
      if (/Use Code\/Property Class/i.test(strong)) {
        useCodeText = textAfterStrong($(td));
      }
    });

    let number_of_stories = null;
    $("div.table-section.building-table td").each((_, td) => {
      const strong = $(td).find("strong").first().text().trim();
      if (/Max Stories/i.test(strong)) {
        number_of_stories = parseNumberFromText(textAfterStrong($(td)));
      }
    });

    let wall = null;
    let exteriorCover = null;
    let roofCover = null;
    let finishedArea = null;
    $("div.table-section.building-information td").each((_, el) => {
      const td = $(el);
      const label = td.find("strong").first().text().trim();
      const val = textAfterStrong(td);
      if (/^Wall$/i.test(label)) wall = val;
      else if (/^Exterior Cover$/i.test(label)) exteriorCover = val;
      else if (/^Roof Cover$/i.test(label)) roofCover = val;
      else if (/^Finished Area$/i.test(label))
        finishedArea = parseNumberFromText(val);
    });

    let dwellArea = null;
    $("div.table-section.features-yard-items")
      .find("table tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 3) return;
        const code = $(tds.get(0)).text().trim();
        const areaText = $(tds.get(2)).text().trim();
        if (code === "DWELL") dwellArea = parseNumberFromText(areaText);
      });

    const finished_base_area = toInt(dwellArea || finishedArea);

    const structure = createEmptyStructure();
    structure.attachment_type = mapAttachmentType(useCodeText);
    structure.exterior_wall_material_primary =
      mapExteriorWallMaterial(wall) || null;
    structure.exterior_wall_material_secondary =
      mapExteriorWallAccent(exteriorCover) || null;
    structure.primary_framing_material =
      mapPrimaryFramingMaterial(wall) || null;
    structure.roof_covering_material = mapRoofCovering(roofCover) || null;
    structure.roof_material_type = mapRoofMaterialTypeFromCovering(
      structure.roof_covering_material,
    );
    structure.finished_base_area = finished_base_area ?? null;
    structure.number_of_stories = number_of_stories ?? null;

    const outDir = path.resolve("owners");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "structure_data.json");

    const payload = {};
    payload[propertyId] = structure;
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote structure data to ${outPath}`);
  } catch (err) {
    console.error("Error generating structure data:", err.message);
    process.exit(1);
  }
})();
