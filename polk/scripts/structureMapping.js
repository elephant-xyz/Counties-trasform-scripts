// Structure Mapping Script
// Reads input.html, parses with cheerio, extracts structure fields per schema, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function parseNumber(val) {
  if (val == null) return null;
  const n = String(val).replace(/[^0-9.\-]/g, "");
  if (!n) return null;
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

function getParcelId($) {
  // Prefer data-parcelid
  const dataId = $("script#display\\.js").attr("data-parcelid");
  if (dataId && /\d{6,}/.test(dataId)) return dataId.trim();
  // Try comment pattern "DB: <id>"
  const html = $.html();
  const m = html.match(/DB:\s*(\d{12,})/);
  if (m) return m[1];
  // Try query params like strap=
  const m2 = html.match(/strap=(\d{12,})/);
  if (m2) return m2[1];
  return "unknown_property_id";
}

function parsePolkHtml($) {
  return {
    parcelInformation: parseParcelInformation($),
    buildings: parseBuildings($),
    extraFeatures: parseExtraFeatures($),
    valueSummary: parseValueSummary($),
    priorYearFinalValues: parsePriorYearValues($),
  };
}

function parseParcelInformation($) {
  const infoHeading = $("h4")
    .filter((_, el) => cleanText($(el).text()) === "Parcel Information")
    .first();
  if (!infoHeading.length) {
    return {};
  }

  const table = infoHeading.nextAll("table").first();
  if (!table.length) {
    return {};
  }

  const data = {};
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) {
      return;
    }
    const key = toCamelCase(getCellText(cells.eq(0)));
    if (!key) {
      return;
    }
    const value = getCellText(cells.eq(1));
    data[key] = value || null;
  });

  return data;
}

function parseBuildings($) {
  const buildingSections = $("#bldngs .pagebreak").filter((_, section) => {
    const header = $(section).children("h4").first();
    return header.length && /building/i.test(header.text());
  });

  return buildingSections
    .map((_, section) => parseBuildingSection($, $(section)))
    .get()
    .filter(Boolean);
}

function parseBuildingSection($, section) {
  const heading = section.children("h4").first();
  if (!heading.length) {
    return null;
  }

  const label = cleanText(heading.clone().children().remove().end().text());
  const type = cleanText(heading.find("a").text());
  const characteristicsHeading = section
    .find("h4")
    .filter((_, el) => cleanText($(el).text()) === "Building Characteristics")
    .first();
  const charContainer = characteristicsHeading.length ? characteristicsHeading.parent() : $();
  const characteristics = charContainer.length ? extractCharacteristicPairs($, charContainer) : {};
  const elementsTable = charContainer.length ? charContainer.find("table").first() : $();
  const elements = parseStandardTable($, elementsTable);

  const subareaHeading = section
    .find("h4")
    .filter((_, el) => cleanText($(el).text()) === "Building Subareas")
    .first();
  const subareaTable = subareaHeading.length ? subareaHeading.nextAll("table").first() : $();
  const { rows: subareas, totals: subareaTotals } = parseSubareaTable($, subareaTable);

  const situsAddress = cleanText(
    section.find("td").eq(1).find("h4").first().text()
  );

  return {
    label: label || null,
    type: type || null,
    situsAddress: situsAddress || null,
    characteristics,
    elements,
    subareas,
    subareaTotals,
  };
}

function extractCharacteristicPairs($, container) {
  if (!container || !container.length) {
    return {};
  }
  const result = {};

  container.find("b").each((_, bold) => {
    const label = cleanText($(bold).text()).replace(/:$/, "");
    const key = toCamelCase(label);
    if (!key) {
      return;
    }

    const value = cleanText(readSiblingText(bold));
    if (!value) {
      return;
    }
    result[key] = value;
  });

  return result;
}

function readSiblingText(node) {
  let text = "";
  let current = node.nextSibling;
  while (current) {
    if (current.type === "text") {
      text += current.data;
      current = current.nextSibling;
      continue;
    }

    if (current.type === "tag") {
      const tagName = current.name ? current.name.toLowerCase() : "";
      if (tagName === "br") {
        break;
      }
      if (/^h\d$/.test(tagName) || tagName === "b" || tagName === "table" || tagName === "div") {
        break;
      }
    }
    current = current.nextSibling;
  }
  return text;
}

function parseStandardTable($, table) {
  if (!table || !table.length) {
    return [];
  }

  const rows = table.find("tr");
  if (!rows.length) {
    return [];
  }

  const headerCells = rows.first().find("th, td");
  if (!headerCells.length) {
    return [];
  }

  const headers = headerCells
    .map((idx, cell) => {
      const headerText = getCellText($(cell));
      const key = toCamelCase(headerText) || `column${idx + 1}`;
      return key;
    })
    .get();

  return rows
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find("td");
      if (cells.length !== headers.length) {
        return null;
      }

      const record = {};
      headers.forEach((header, idx) => {
        const value = getCellText(cells.eq(idx));
        record[header] = value || null;
      });
      return record;
    })
    .get()
    .filter(Boolean);
}

function parseSubareaTable($, table) {
  if (!table || !table.length) {
    return { rows: [], totals: {} };
  }

  const rows = table.find("tr");
  if (!rows.length) {
    return { rows: [], totals: {} };
  }

  const headerCells = rows.first().find("th, td");
  const headers = headerCells
    .map((idx, cell) => {
      const headerText = getCellText($(cell));
      return toCamelCase(headerText) || `column${idx + 1}`;
    })
    .get();

  const data = [];
  const totals = {};

  rows.slice(1).each((_, row) => {
    const cells = $(row).find("td");
    if (!cells.length) {
      return;
    }

    const hasColspan = cells.filter((_, cell) => $(cell).attr("colspan")).length > 0;
    if (hasColspan) {
      const label = getCellText(cells.first());
      const key = toCamelCase(label);
      if (key) {
        totals[key] = getCellText(cells.last()) || null;
      }
      return;
    }

    if (cells.length !== headers.length) {
      return;
    }

    const record = {};
    headers.forEach((header, idx) => {
      record[header] = getCellText(cells.eq(idx)) || null;
    });
    data.push(record);
  });

  return { rows: data, totals };
}

function parseExtraFeatures($) {
  const heading = $("h3")
    .filter((_, el) => cleanText($(el).text()).startsWith("Extra Features"))
    .first();
  if (!heading.length) {
    return [];
  }
  const table = heading.nextAll("table").first();
  return parseStandardTable($, table);
}

function parseValueSummary($) {
  const table = $("#valueSummary table").first();
  if (!table.length) {
    return { rows: [], note: null };
  }

  const rows = parseStandardTable($, table);
  const noteRow = table.find("tr").filter((_, row) => $(row).find("td[colspan]").length).first();

  return {
    rows,
    note: noteRow.length ? cleanText(noteRow.text()) || null : null,
  };
}

function parsePriorYearValues($) {
  const table = $("#priorValues table").first();
  return parseStandardTable($, table);
}

function getCellText(cell) {
  if (!cell || !cell.length) {
    return "";
  }
  const clone = cell.clone();
  clone.find("br").replaceWith(" ");
  return cleanText(clone.text());
}

function cleanText(value) {
  if (!value) {
    return "";
  }
  return value.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

function toCamelCase(text) {
  if (!text) {
    return "";
  }
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(" ")
    .map((part, idx) => {
      if (!part) {
        return "";
      }
      return idx === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function mapPolkBuildings(parsedBuildings = []) {
  return parsedBuildings
    .map((building, idx) => convertParsedBuilding(building, idx))
    .filter(Boolean);
}

function convertParsedBuilding(building, index) {
  if (!building) {
    return null;
  }

  const layoutBuilding = {
    index: index + 1,
    beds: 0,
    full: 0,
    half: 0,
    livingArea: null,
    totalUnderRoof: null,
    yearBuilt: null,
    style: null,
    storyHeightInfo: null,
    substructure: null,
    frameConstType: null,
    exteriorWall: null,
    roofStructure: null,
    subareas: [],
  };

  const characteristics = building.characteristics || {};
  layoutBuilding.livingArea = parseNumber(characteristics.livingArea);
  layoutBuilding.totalUnderRoof = parseNumber(characteristics.totalUnderRoof);
  layoutBuilding.yearBuilt = parseNumber(characteristics.actualYearBuilt);

  (building.elements || []).forEach(element => {
    const label = cleanText(element.element || "").toUpperCase();
    if (!label) {
      return;
    }
    const unitValue = parseNumber(element.units);
    const infoValue = cleanText(element.information || "") || null;

    if (label === "BEDROOM") {
      layoutBuilding.beds = unitValue ?? layoutBuilding.beds;
    } else if (label === "FULL BATH") {
      layoutBuilding.full = unitValue ?? layoutBuilding.full;
    } else if (label === "HALF BATH") {
      layoutBuilding.half = unitValue ?? layoutBuilding.half;
    } else if (label === "STYLE") {
      layoutBuilding.style = infoValue;
    } else if (label === "SUBSTRUCT") {
      layoutBuilding.substructure = infoValue;
    } else if (label === "FRAME / CONST TYPE") {
      layoutBuilding.frameConstType = infoValue;
    } else if (label === "EXTERIOR WALL") {
      layoutBuilding.exteriorWall = infoValue;
    } else if (label === "ROOF STRUCTURE") {
      layoutBuilding.roofStructure = infoValue;
    } else if (label === "STORY HEIGHT INFO ONLY") {
      layoutBuilding.storyHeightInfo = infoValue;
    }
  });

  layoutBuilding.subareas = (building.subareas || [])
    .map(sub => {
      const codeDesc = cleanText(sub.codeDescription || "").toUpperCase();
      if (!codeDesc) {
        return null;
      }
      const heatedValue =
        typeof sub.heated === "string"
          ? sub.heated.trim().toUpperCase() === "Y"
          : Boolean(sub.heated);
      const total = parseNumber(sub.total);
      if (total == null) {
        return null;
      }
      return {
        codeDesc,
        heated: heatedValue,
        total,
      };
    })
    .filter(Boolean);

  return layoutBuilding;
}

function mapExteriorWallToEnum(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("HARDY") || v.includes("HARDIE") || v.includes("FIBER"))
    return "Fiber Cement Siding";
  if (v === "WOOD" || v.includes("WOOD")) return "Wood Siding";
  if (v.includes("BRICK")) return "Brick";
  if (v.includes("STUCCO")) return "Stucco";
  if (v.includes("VINYL")) return "Vinyl Siding";
  if (v.includes("STONE")) return "Manufactured Stone";
  if (v.includes("METAL")) return "Metal Siding";
  return null;
}

function mapFrameToEnum(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("MASONRY") || v.includes("BLOCK")) return "Concrete Block";
  if (v.includes("WOOD")) return "Wood Frame";
  if (v.includes("STEEL")) return "Steel Frame";
  return null;
}

function mapRoofDesign(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("GABLE")) return "Gable";
  if (v.includes("HIP")) return "Hip";
  if (v.includes("FLAT")) return "Flat";
  if (v.includes("SHED")) return "Shed";
  return null;
}

function mapRoofMaterialType(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("METAL")) return "Metal";
  if (v.includes("SHINGLE")) return "Shingle";
  if (v.includes("TILE")) return "Tile";
  if (v.includes("CONCRETE")) return "PouredConcrete";
  if (v.includes("WOOD")) return "Wood";
  return null;
}

function mapFoundationType(val) {
  if (!val) return null;
  const v = val.toUpperCase();
  if (v.includes("CONTINUOUS WALL")) return "Stem Wall";
  return null;
}

// Function to determine roof covering material
function getRoofCoveringMaterial(roofStructure) {
  if (!roofStructure) return null;
  const v = roofStructure.toUpperCase();
  if (v.includes("SHINGLE")) return "Architectural Asphalt Shingle"; // Assuming architectural for modern homes
  if (v.includes("METAL")) return "Metal Standing Seam"; // Assuming standing seam for modern homes
  if (v.includes("TILE")) return "Clay Tile"; // Or Concrete Tile, depending on context
  return null;
}

function buildStructureRecord(buildings) {
  let structures = {};
  buildings.forEach((b, bIdx) => {
    const exteriorPrimary = mapExteriorWallToEnum(b.exteriorWall);
    const primaryFrame = mapFrameToEnum(b.frameType);
    const roofDesign = mapRoofDesign(b.roofStructure);
    const roofMaterialType = mapRoofMaterialType(b.roofStructure);
    const foundationType = mapFoundationType(b.substruct);
    const roofCoveringMaterial = getRoofCoveringMaterial(b.roofStructure);
    const structure = {
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
      exterior_wall_material_primary: exteriorPrimary,
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
      foundation_type: foundationType,
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
      primary_framing_material: primaryFrame,
      roof_age_years: null,
      roof_condition: null,
      roof_covering_material: roofCoveringMaterial,
      roof_date: null,
      roof_design_type: roofDesign,
      roof_material_type: roofMaterialType,
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
    structures[(bIdx + 1).toString()] = structure;
  });

  return structures;
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);
  const parcelId = getParcelId($);

  const parsedData = parsePolkHtml($);
  const buildings = mapPolkBuildings(parsedData.buildings || []);
  const structureObj = buildStructureRecord(buildings || []);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "structure_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = structureObj;
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error("Error in structureMapping:", err.message);
    process.exit(1);
  }
}