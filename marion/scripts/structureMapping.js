const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getPrimeKey($, html) {
  const m = html.match(/Prime Key:\s*(\d+)/i);
  if (m) return m[1].trim();
  let key = null;
  $("*").each((i, el) => {
    const t = $(el).text();
    const mm = t && t.match(/Prime Key:\s*(\d+)/i);
    if (mm) {
      key = mm[1].trim();
      return false;
    }
  });
  return key || "unknown";
}

const BUILDING_HEADER_RE = /^Building\s+(\d+)\s+of\s+(\d+)/i;
const allowedValues = {
  exterior_wall_material_primary: new Set([
    "Brick",
    "Natural Stone",
    "Manufactured Stone",
    "Stucco",
    "Vinyl Siding",
    "Wood Siding",
    "Fiber Cement Siding",
    "Metal Siding",
    "Concrete Block",
    "EIFS",
    "Log",
    "Adobe",
    "Precast Concrete",
    "Curtain Wall",
    null,
  ]),
  exterior_wall_material_secondary: new Set([
    "Brick Accent",
    "Stone Accent",
    "Wood Trim",
    "Metal Trim",
    "Stucco Accent",
    "Vinyl Accent",
    "Decorative Block",
    null,
  ]),
  roof_covering_material: new Set([
    "3-Tab Asphalt Shingle",
    "Architectural Asphalt Shingle",
    "Metal Standing Seam",
    "Metal Corrugated",
    "Clay Tile",
    "Concrete Tile",
    "Natural Slate",
    "Synthetic Slate",
    "Wood Shake",
    "Wood Shingle",
    "TPO Membrane",
    "EPDM Membrane",
    "Modified Bitumen",
    "Built-Up Roof",
    "Green Roof System",
    "Solar Integrated Tiles",
    null,
  ]),
  roof_design_type: new Set([
    "Gable",
    "Hip",
    "Flat",
    "Mansard",
    "Gambrel",
    "Shed",
    "Saltbox",
    "Butterfly",
    "Bonnet",
    "Clerestory",
    "Dome",
    "Barrel",
    "Combination",
    null,
  ]),
  flooring_material_primary: new Set([
    "Solid Hardwood",
    "Engineered Hardwood",
    "Laminate",
    "Luxury Vinyl Plank",
    "Sheet Vinyl",
    "Ceramic Tile",
    "Porcelain Tile",
    "Natural Stone Tile",
    "Carpet",
    "Area Rugs",
    "Polished Concrete",
    "Bamboo",
    "Cork",
    "Linoleum",
    "Terrazzo",
    "Epoxy Coating",
    null,
  ]),
  flooring_material_secondary: new Set([
    "Solid Hardwood",
    "Engineered Hardwood",
    "Laminate",
    "Luxury Vinyl Plank",
    "Ceramic Tile",
    "Carpet",
    "Area Rugs",
    "Transition Strips",
    null,
  ]),
  interior_wall_surface_material_primary: new Set([
    "Drywall",
    "Plaster",
    "Wood Paneling",
    "Exposed Brick",
    "Exposed Block",
    "Wainscoting",
    "Shiplap",
    "Board and Batten",
    "Tile",
    "Stone Veneer",
    "Metal Panels",
    "Glass Panels",
    "Concrete",
    null,
  ]),
  interior_wall_surface_material_secondary: new Set([
    "Wainscoting",
    "Chair Rail",
    "Crown Molding",
    "Baseboards",
    "Wood Trim",
    "Stone Accent",
    "Tile Accent",
    "Metal Accent",
    "Glass Insert",
    "Decorative Panels",
    "Feature Wall Material",
    null,
  ]),
};

const rulesByField = {
  exterior_wall_material_primary: [
    { pattern: /log/i, value: "Log" },
    { pattern: /stone/i, value: "Natural Stone" },
    { pattern: /brick|brk/i, value: "Brick" },
    { pattern: /stucco/i, value: "Stucco" },
    { pattern: /insulatn fin|eifs/i, value: "EIFS" },
    { pattern: /vinyl/i, value: "Vinyl Siding" },
    { pattern: /precast/i, value: "Precast Concrete" },
    { pattern: /masonite|composition|wallboard|asbestos|asb|hardee/i, value: "Fiber Cement Siding" },
    { pattern: /metal|mtl|alum|steel|galvanized|porcelain/i, value: "Metal Siding" },
    { pattern: /conc|concrete|blk|block|ocala/i, value: "Concrete Block" },
    { pattern: /wood shingles|cedar|redwood|batten|wood|siding|panel/i, value: "Wood Siding" },
    { pattern: /adobe/i, value: "Adobe" },
    { pattern: /curtain/i, value: "Curtain Wall" },
  ],
  exterior_wall_material_secondary: [
    { pattern: /brick/i, value: "Brick Accent" },
    { pattern: /stone/i, value: "Stone Accent" },
    { pattern: /wood|batten|cedar|redwood|panel|trim/i, value: "Wood Trim" },
    { pattern: /metal|alum|steel|galvanized/i, value: "Metal Trim" },
    { pattern: /stucco|insulatn fin/i, value: "Stucco Accent" },
    { pattern: /vinyl/i, value: "Vinyl Accent" },
    { pattern: /block|veneer/i, value: "Decorative Block" },
  ],
  roof_covering_material: [
    { pattern: /composition|tar & gravel|built-up/i, value: "Built-Up Roof" },
    { pattern: /rolled roofing/i, value: "Modified Bitumen" },
    { pattern: /compston shngl|asphalt shngl/i, value: "3-Tab Asphalt Shingle" },
    { pattern: /fbrglass shngl/i, value: "Architectural Asphalt Shingle" },
    { pattern: /asbestos shngl/i, value: "Synthetic Slate" },
    { pattern: /wood shngl/i, value: "Wood Shingle" },
    { pattern: /shake shngl/i, value: "Wood Shake" },
    { pattern: /metal shingle/i, value: "Metal Standing Seam" },
    { pattern: /kool seal|mh pan|corrugated mtl|galvanized mtl/i, value: "Metal Corrugated" },
    { pattern: /copper/i, value: "Metal Standing Seam" },
    { pattern: /concrete tile/i, value: "Concrete Tile" },
    { pattern: /clay tile/i, value: "Clay Tile" },
    { pattern: /slate/i, value: "Natural Slate" },
  ],
  roof_design_type: [
    { pattern: /flat/i, value: "Flat" },
    { pattern: /shed/i, value: "Shed" },
    { pattern: /gable/i, value: "Gable" },
    { pattern: /hip/i, value: "Hip" },
    { pattern: /mansard/i, value: "Mansard" },
    { pattern: /gambrel/i, value: "Gambrel" },
    { pattern: /saltbox/i, value: "Saltbox" },
    { pattern: /butterfly/i, value: "Butterfly" },
    { pattern: /bonnet/i, value: "Bonnet" },
    { pattern: /clerestory/i, value: "Clerestory" },
    { pattern: /dome/i, value: "Dome" },
    { pattern: /barrel/i, value: "Barrel" },
    { pattern: /mixed|comb/i, value: "Combination" },
  ],
  flooring_material_primary: [
    { pattern: /carpet/i, value: "Carpet" },
    { pattern: /area rug/i, value: "Area Rugs" },
    { pattern: /linoleum/i, value: "Linoleum" },
    { pattern: /sheet vinyl/i, value: "Sheet Vinyl" },
    { pattern: /vinyl tile/i, value: "Luxury Vinyl Plank" },
    { pattern: /asphalt tile|sheet rubber|rubber tile/i, value: "Laminate" },
    { pattern: /cork/i, value: "Cork" },
    { pattern: /hardwood|hardwd/i, value: "Solid Hardwood" },
    { pattern: /softwood/i, value: "Solid Hardwood" },
    { pattern: /parquet/i, value: "Engineered Hardwood" },
    { pattern: /concrete slab/i, value: "Polished Concrete" },
    { pattern: /ceramic tile/i, value: "Ceramic Tile" },
    { pattern: /porcelain tile/i, value: "Porcelain Tile" },
    { pattern: /clay tile|quarry tile/i, value: "Ceramic Tile" },
    { pattern: /brick|flagstone|stone|slate|marble/i, value: "Natural Stone Tile" },
    { pattern: /terrazzo/i, value: "Terrazzo" },
    { pattern: /epoxy/i, value: "Epoxy Coating" },
    { pattern: /bamboo/i, value: "Bamboo" },
  ],
  flooring_material_secondary: [
    { pattern: /carpet/i, value: "Carpet" },
    { pattern: /area rug/i, value: "Area Rugs" },
    { pattern: /vinyl/i, value: "Luxury Vinyl Plank" },
    { pattern: /hardwood|hardwd|softwood/i, value: "Solid Hardwood" },
    { pattern: /parquet/i, value: "Engineered Hardwood" },
  ],
  interior_wall_surface_material_primary: [
    { pattern: /drywall|wall board/i, value: "Drywall" },
    { pattern: /plaster/i, value: "Plaster" },
    { pattern: /masonry|brick/i, value: "Exposed Brick" },
    { pattern: /block|concrete/i, value: "Exposed Block" },
    { pattern: /wood panel|wood panl|plywood/i, value: "Wood Paneling" },
    { pattern: /wainscot/i, value: "Wainscoting" },
    { pattern: /board & batten/i, value: "Board and Batten" },
    { pattern: /stone/i, value: "Stone Veneer" },
    { pattern: /tile/i, value: "Tile" },
    { pattern: /metal/i, value: "Metal Panels" },
    { pattern: /glass/i, value: "Glass Panels" },
    { pattern: /concrete/i, value: "Concrete" },
  ],
  interior_wall_surface_material_secondary: [
    { pattern: /wainscot/i, value: "Wainscoting" },
    { pattern: /chair rail/i, value: "Chair Rail" },
    { pattern: /crown/i, value: "Crown Molding" },
    { pattern: /base/i, value: "Baseboards" },
    { pattern: /wood/i, value: "Wood Trim" },
    { pattern: /stone/i, value: "Stone Accent" },
    { pattern: /tile/i, value: "Tile Accent" },
    { pattern: /metal/i, value: "Metal Accent" },
    { pattern: /glass/i, value: "Glass Insert" },
    { pattern: /panel/i, value: "Decorative Panels" },
    { pattern: /feature/i, value: "Feature Wall Material" },
  ],
};

function mapValue(label, rules, allowedSet) {
  const target = label || "";
  for (const { pattern, value } of rules) {
    if (pattern.test(target)) {
      return allowedSet.has(value) ? value : null;
    }
  }
  return null;
}

function normalizeLabel(rawValue) {
  if (!rawValue) {
    return "";
  }
  return rawValue.replace(/^\s*\d+\s*[-:]?\s*/, "").trim();
}

function mapFieldValue(fieldName, rawValue) {
  if (!rawValue) {
    return null;
  }
  const rules = rulesByField[fieldName];
  const allowed = allowedValues[fieldName];
  if (!rules || !allowed) {
    return null;
  }
  const normalized = normalizeLabel(rawValue);
  return mapValue(normalized, rules, allowed);
}

function parseBuildings($) {
  const notesByBuilding = extractBuildingNotes($);
  const headers = $('b u')
    .filter((i, el) => BUILDING_HEADER_RE.test($(el).text().trim()))
    .toArray();

  return headers
    .map((header) => parseBuildingBlock($, header, notesByBuilding))
    .filter(Boolean);
}

function parseBuildingBlock($root, headerNode, notesByBuilding) {
  const headerTag = $root(headerNode).closest('b');
  if (!headerTag.length) {
    return null;
  }

  const chunkNodes = collectChunkNodes($root, headerTag.get(0));
  if (!chunkNodes.length) {
    return null;
  }

  const chunkHtml = `<section>${chunkNodes
    .map((node) => serializeNode($root, node))
    .join('')}</section>`;
  const $ = cheerio.load(chunkHtml);
  const container = $('section').first();
  const headerText = container.find('b u').first().text().trim();
  const match = headerText.match(BUILDING_HEADER_RE);

  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  const totalBuildings = Number(match[2]);
  const traverse = extractTraverse($, container);
  // const sketchSrc = container.find('img').first().attr('src') || null;
  const sketchSrc = null;
  const characteristics = extractCharacteristics($);
  const typeRows = extractTypeRows($);
  const sectionDetails = extractSectionDetails($);

  return {
    number,
    totalBuildings,
    traverse,
    sketchSrc,
    characteristics,
    typeRows,
    sectionDetails,
    note: notesByBuilding[number] || null,
  };
}

function collectChunkNodes($, startNode) {
  const nodes = [];
  let current = startNode;
  nodes.push(current);

  while (current && current.nextSibling) {
    current = current.nextSibling;
    if (
      current.type === 'tag' &&
      current.name === 'b' &&
      BUILDING_HEADER_RE.test($(current).text().trim())
    ) {
      break;
    }
    nodes.push(current);
  }

  return nodes;
}

function serializeNode($, node) {
  return node.type === 'text' ? node.data : $.html(node);
}

function extractTraverse($, container) {
  const header = container.children('b').first().get(0);
  const nodes = container.contents().toArray();
  let seenHeader = false;

  for (const node of nodes) {
    if (node === header) {
      seenHeader = true;
      continue;
    }
    if (!seenHeader) {
      continue;
    }
    if (node.type === 'tag' && node.name === 'img') {
      break;
    }
    const text = $(node).text().replace(/\s+/g, ' ').trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function extractCharacteristics($) {
  const center = $('center')
    .filter((i, el) => $(el).text().includes('Building Characteristics'))
    .first();
  const table = center.length ? center.nextAll('table').first() : $('table').first();

  if (!table.length) {
    return {};
  }

  const outerRow = table.find('tr').first();
  const outerCells = outerRow.children('td');
  const leftCell = outerCells.eq(0);
  const rightCell = outerCells.eq(1);
  const nestedTds = leftCell.find('td');
  const leftLabels = extractLines($(nestedTds.get(0)));
  const leftValues = extractLines($(nestedTds.get(1)));
  const data = {};

  leftLabels.forEach((label, idx) => {
    const key = toCamelCase(label);
    if (key) {
      data[key] = leftValues[idx] || null;
    }
  });

  Object.assign(data, extractInlinePairs($, rightCell));

  return data;
}

function extractTypeRows($) {
  let targetTable;
  $('table').each((i, el) => {
    const headers = $(el)
      .find('tr')
      .first()
      .find('th')
      .map((_, th) => $(th).text().trim())
      .get();
    if (headers.length && headers[0] === 'Type' && headers.includes('Exterior Walls')) {
      targetTable = $(el);
      return false;
    }
    return undefined;
  });

  if (!targetTable) {
    return [];
  }

  return parseHeaderTable($, targetTable);
}

function extractSectionDetails($) {
  const sectionHeader = $('b')
    .filter((i, el) => $(el).text().trim().startsWith('Section:'))
    .first();
  const table = sectionHeader.length ? sectionHeader.nextAll('table').first() : null;

  if (!table || !table.length) {
    return {};
  }

  const details = {};
  table.find('td').each((_, cell) => {
    Object.assign(details, extractInlinePairs($, $(cell)));
  });

  return details;
}

function parseHeaderTable($, table) {
  const headerCells = table.find('tr').first().find('th');
  const headers = headerCells.map((_, th) => toCamelCase($(th).text().trim())).get();

  return table
    .find('tr')
    .slice(1)
    .map((_, row) => {
      const cells = $(row).find('td');
      const rowObj = {};
      headers.forEach((header, idx) => {
        if (!header) {
          return;
        }
        rowObj[header] = cells.eq(idx).text().replace(/\s+/g, ' ').trim() || null;
      });
      return rowObj;
    })
    .get();
}

function extractLines(cell) {
  if (!cell || !cell.length) {
    return [];
  }

  const html = cell.html() || '';
  return html
    .split(/<br\s*\/?>/i)
    .map((part) => cheerio.load(`<span>${part}</span>`).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractInlinePairs($, cell) {
  if (!cell || !cell.length) {
    return {};
  }

  const result = {};
  let currentKey = null;

  cell.contents().each((_, node) => {
    if (node.type === 'tag' && node.name === 'b') {
      currentKey = toCamelCase($(node).text().replace(/:/g, '').trim()) || null;
      if (currentKey && !(currentKey in result)) {
        result[currentKey] = '';
      }
      return;
    }

    if (node.type === 'tag' && node.name === 'br') {
      currentKey = null;
      return;
    }

    if (currentKey) {
      const text = $(node).text().replace(/\s+/g, ' ').trim();
      if (text) {
        result[currentKey] = result[currentKey]
          ? `${result[currentKey]} ${text}`.trim()
          : text;
      }
    }
  });

  Object.keys(result).forEach((key) => {
    if (!result[key]) {
      result[key] = null;
    }
  });

  return result;
}

function extractBuildingNotes($) {
  const notes = {};
  const notesCenter = $('center')
    .filter((i, el) => $(el).text().trim() === 'Appraiser Notes')
    .first();

  if (!notesCenter.length) {
    return notes;
  }

  let node = notesCenter.get(0).nextSibling;
  while (node) {
    if (node.type === 'tag' && node.name === 'hr') {
      break;
    }
    if (node.type === 'text') {
      const text = node.data.trim();
      const match = /^BLDG0*([0-9]+)\s*=\s*(.+)$/i.exec(text);
      if (match) {
        notes[Number(match[1])] = match[2].trim();
      }
    }
    node = node.nextSibling;
  }

  return notes;
}

function toCamelCase(label) {
  if (!label) {
    return '';
  }

  const cleaned = label.replace(/[:]/g, ' ').trim();
  const parts = cleaned.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  return parts
    .map((part, idx) =>
      idx === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join('');
}

function parseIntOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseInt(normalized, 10);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function parseFloatOrNull(val) {
  if (!val) {
    return null;
  }
  const normalized = val.replace(/,/gi, '').trim();
  if (!normalized) {
    return null;
  }
  const parsedVal = parseFloat(normalized);
  return Number.isNaN(parsedVal) ? null : parsedVal;
}

function createEmptyStructureRecord() {
  return {
    number_of_stories: null,
    finished_base_area: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
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
    number_of_buildings: null,
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
}

function buildStructure($) {
  const parsedBuildings = parseBuildings($);
  const totalBuildings = parsedBuildings.length;
  const result = {};

  parsedBuildings.forEach((parsedBuilding, index) => {
    const typeRow = (parsedBuilding.typeRows && parsedBuilding.typeRows[0]) || {};
    const sectionDetails = parsedBuilding.sectionDetails || {};
    const characteristics = parsedBuilding.characteristics || {};
    const record = createEmptyStructureRecord();

    record.number_of_stories = parseFloatOrNull(typeRow.stories);
    record.finished_base_area = parseIntOrNull(typeRow.groundFloorArea);
    record.exterior_wall_material_primary = mapFieldValue(
      "exterior_wall_material_primary",
      typeRow.exteriorWalls,
    );
    record.exterior_wall_material_secondary = mapFieldValue(
      "exterior_wall_material_secondary",
      typeRow.exteriorWalls,
    );
    record.flooring_material_primary = mapFieldValue(
      "flooring_material_primary",
      sectionDetails.floorFinish,
    );
    record.flooring_material_secondary = mapFieldValue(
      "flooring_material_secondary",
      sectionDetails.floorFinish,
    );
    record.interior_wall_surface_material_primary = mapFieldValue(
      "interior_wall_surface_material_primary",
      sectionDetails.wallFinish,
    );
    record.interior_wall_surface_material_secondary = mapFieldValue(
      "interior_wall_surface_material_secondary",
      sectionDetails.wallFinish,
    );
    record.roof_covering_material = mapFieldValue(
      "roof_covering_material",
      sectionDetails.roofCover,
    );
    record.roof_design_type = mapFieldValue("roof_design_type", sectionDetails.roofStyle);
    record.number_of_buildings = totalBuildings || null;

    const key = parsedBuilding.number
      ? parsedBuilding.number.toString()
      : (index + 1).toString();
    result[key] = record;
  });

  return result;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);
  const id = getPrimeKey($, html);
  const data = buildStructure($);

  const outObj = {};
  outObj[`property_${id}`] = data;

  const ownersDir = path.join(process.cwd(), "owners");
  ensureDir(ownersDir);

  fs.writeFileSync(path.join(ownersDir, "structure_data.json"), JSON.stringify(outObj, null, 2));
  console.log(`Wrote structure data for property_${id} to owners/`);
})();
