// Structure mapping script: parses input.html, extracts per-building structure data, and
// writes owners/structure_data.json in Elephant schema format.
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadHtml(filename) {
  const html = fs.readFileSync(filename, "utf8");
  return cheerio.load(html);
}

function cleanText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(label) {
  return cleanText(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function parseNumber(value) {
  if (value == null) return null;
  const normalized = cleanText(value).replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseInteger(value) {
  if (value == null) return null;
  const normalized = cleanText(value).replace(/[^0-9]/g, "");
  if (!normalized) return null;
  const num = parseInt(normalized, 10);
  return Number.isFinite(num) ? num : null;
}

function parseBuildingNumber(headerText, index) {
  const match = (headerText || "").match(/building\s+(\d+)/i);
  if (match) return Number(match[1]);
  return index + 1;
}

function extractCharacteristics($, section) {
  const characteristics = {};
  $(section)
    .find("table.report-table tbody > tr")
    .each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find("td");
      if (cells.length < 2) return;
      const label = cleanText($(cells[0]).text());
      if (!label) return;
      const code = cleanText($(cells[1]).text());
      const description =
        cells[2] !== undefined ? cleanText($(cells[2]).text()) : "";
      const key = normalizeKey(label);
      if (!characteristics[key]) characteristics[key] = [];
      characteristics[key].push({ label, code, description });
    });
  return characteristics;
}

function getCharacteristic(raw, label) {
  if (!raw || !raw.characteristics) return null;
  const list = raw.characteristics[normalizeKey(label)] || [];
  return list.length ? list[0] : null;
}

function getCharacteristicValues(raw, label) {
  if (!raw || !raw.characteristics) return [];
  return raw.characteristics[normalizeKey(label)] || [];
}

function extractSubAreaTotals($, section) {
  const totals = {
    grossArea: null,
    heatedArea: null,
    depreciatedValue: null,
  };
  const footerRow = $(section)
    .find("table.data-table tfoot > tr")
    .first();
  if (!footerRow.length) return totals;
  const cells = footerRow.find("th");
  if (!cells.length) return totals;
  const values = [];
  cells.each((_, cell) => values.push(cleanText($(cell).text())));
  if (values.length >= 2) totals.grossArea = parseNumber(values[1]);
  if (values.length >= 3) totals.heatedArea = parseNumber(values[2]);
  if (values.length >= 4) totals.depreciatedValue = parseNumber(values[3]);
  return totals;
}

function combinedLowerText(raw, ...parts) {
  const values = [];
  if (raw.sectionText) values.push(raw.sectionText);
  if (raw.buildingText) values.push(raw.buildingText);
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      for (const p of part) if (p) values.push(p);
    } else {
      values.push(part);
    }
  }
  return values.join(" ").toLowerCase();
}

function mapBuildingNumber(raw) {
  return raw.buildingNumber ?? null;
}

function mapArchitecturalStyleType(raw) {
  const entry = getCharacteristic(raw, "Architectural Style");
  const text = entry
    ? `${entry.description || ""} ${entry.code || ""}`.toLowerCase()
    : "";
  if (!text) return null;
  if (/(mid\\s*century|mid-century|mcmod)/.test(text)) return "MidCenturyModern";
  if (
    text.includes("contemporary") ||
    text.includes("modern") ||
    text.includes("current")
  )
    return "Contemporary";
  if (text.includes("victorian")) return "Victorian";
  if (text.includes("ranch")) return "Ranch";
  if (text.includes("craftsman")) return "Craftsman";
  if (text.includes("tudor")) return "Tudor";
  if (text.includes("minimal") || text.includes("minimalist"))
    return "Minimalist";
  if (text.includes("colonial")) return "Colonial";
  if (text.includes("farmhouse") || text.includes("farm house"))
    return "Farmhouse";
  return null;
}

function mapAttachmentType(raw) {
  const entry = getCharacteristic(raw, "Type");
  const text = combinedLowerText(raw, entry && entry.description);
  if (!text) return null;
  if (/\btown\s*house|\btownhome|\brow\s*house|\browhome|\browhouse/.test(text))
    return "Attached";
  if (/\bduplex\b|\bsemi[- ]?detached\b/.test(text)) return "SemiDetached";
  if (
    /\bquad\b|\bfourplex\b|\btriplex\b|\bcondo\b|\bapartment\b|\bmulti\b|\bmfr\b/.test(
      text,
    )
  )
    return "Attached";
  return "Detached";
}

function normalizeCondition(value) {
  const text = (value || "").toLowerCase();
  if (!text) return null;
  if (text.includes("new")) return "New";
  if (text.includes("excellent")) return "Excellent";
  if (text.includes("good")) return "Good";
  if (text.includes("average") || text.includes("typical")) return "Good";
  if (text.includes("fair")) return "Fair";
  if (text.includes("poor")) return "Poor";
  if (text.includes("damag")) return "Damaged";
  return null;
}

function mapExteriorWallCondition(raw) {
  const entry = getCharacteristic(raw, "Condition");
  const mapped = normalizeCondition(entry && (entry.description || entry.code));
  return mapped;
}

function mapExteriorWallMaterialPrimary(raw) {
  const entry = getCharacteristic(raw, "Exterior Wall");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;
  if (text.includes("stucco")) return "Stucco";
  if (text.includes("brick")) return "Brick";
  if (text.includes("stone")) return "Natural Stone";
  if (text.includes("vinyl")) return "Vinyl Siding";
  if (text.includes("wood")) return "Wood Siding";
  if (text.includes("fiber cement") || text.includes("hardie"))
    return "Fiber Cement Siding";
  if (text.includes("metal")) return "Metal Siding";
  if (text.includes("concrete block") || text.includes("masonry"))
    return "Concrete Block";
  if (text.includes("eifs")) return "EIFS";
  if (text.includes("log")) return "Log";
  if (text.includes("adobe")) return "Adobe";
  if (text.includes("precast")) return "Precast Concrete";
  if (text.includes("curtain")) return "Curtain Wall";
  return null;
}

function mapInteriorWallSurfaceMaterialPrimary(raw) {
  const entry = getCharacteristic(raw, "Interior Walls");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;
  if (text.includes("drywall") || text.includes("gypsum")) return "Drywall";
  if (text.includes("plaster")) return "Plaster";
  if (text.includes("panel")) return "Wood Paneling";
  if (text.includes("brick")) return "Exposed Brick";
  if (text.includes("block")) return "Exposed Block";
  if (text.includes("wainscot")) return "Wainscoting";
  if (text.includes("shiplap")) return "Shiplap";
  if (text.includes("board") && text.includes("batten"))
    return "Board and Batten";
  if (text.includes("tile")) return "Tile";
  if (text.includes("stone")) return "Stone Veneer";
  if (text.includes("metal")) return "Metal Panels";
  if (text.includes("glass")) return "Glass Panels";
  if (text.includes("concrete")) return "Concrete";
  return null;
}

const SECONDARY_FLOORING_ALLOWED = new Set([
  "Solid Hardwood",
  "Engineered Hardwood",
  "Laminate",
  "Luxury Vinyl Plank",
  "Ceramic Tile",
  "Carpet",
  "Area Rugs",
  "Transition Strips",
]);

const SECONDARY_FLOORING_FALLBACK = {
  "Porcelain Tile": "Ceramic Tile",
};

function mapFlooringMaterials(raw) {
  const entries = getCharacteristicValues(raw, "Interior Flooring");
  if (!entries.length) return { primary: null, secondary: null };
  const materials = entries
    .map((entry) => (entry.description || entry.code || "").toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(materials)];
  let primary = null;
  let secondary = null;
  for (const text of unique) {
    const material = detectFlooringMaterial(text);
    if (!material) continue;
    if (!primary) {
      primary = material;
      continue;
    }
    if (secondary) continue;
    let normalized = null;
    if (SECONDARY_FLOORING_ALLOWED.has(material)) {
      normalized = material;
    } else if (SECONDARY_FLOORING_FALLBACK[material]) {
      const fallback = SECONDARY_FLOORING_FALLBACK[material];
      if (SECONDARY_FLOORING_ALLOWED.has(fallback)) normalized = fallback;
    }
    if (normalized && normalized !== primary) secondary = normalized;
  }
  return { primary: primary || null, secondary: secondary || null };
}

function detectFlooringMaterial(text) {
  if (!text) return null;
  if (text.includes("tile")) {
    if (text.includes("ceramic")) return "Ceramic Tile";
    if (text.includes("porcelain")) return "Porcelain Tile";
    if (text.includes("stone")) return "Natural Stone Tile";
    return "Ceramic Tile";
  }
  if (text.includes("carpet")) return "Carpet";
  if (text.includes("vinyl plank")) return "Luxury Vinyl Plank";
  if (text.includes("vinyl")) return "Sheet Vinyl";
  if (text.includes("laminate")) return "Laminate";
  if (text.includes("hardwood")) return "Solid Hardwood";
  if (text.includes("engineered")) return "Engineered Hardwood";
  if (text.includes("bamboo")) return "Bamboo";
  if (text.includes("cork")) return "Cork";
  if (text.includes("linoleum")) return "Linoleum";
  if (text.includes("terrazzo")) return "Terrazzo";
  if (text.includes("concrete")) return "Polished Concrete";
  if (text.includes("epoxy")) return "Epoxy Coating";
  if (text.includes("marble")) return "Natural Stone Tile";
  return null;
}

function mapNumberOfStories(raw) {
  const entry = getCharacteristic(raw, "Stories");
  if (!entry) return null;
  const value = parseNumber(entry.description || entry.code);
  return value != null ? value : null;
}

function mapFinishedBaseArea(raw) {
  if (raw.subAreaTotals && raw.subAreaTotals.grossArea)
    return raw.subAreaTotals.grossArea;
  const entry = getCharacteristic(raw, "Heated Area");
  return entry ? parseNumber(entry.description || entry.code) : null;
}

function mapRoofDesignType(raw) {
  const entry = getCharacteristic(raw, "Roof Structure");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;
  const hasGable = text.includes("gable");
  const hasHip = text.includes("hip");
  if (hasGable && hasHip) return "Combination";
  if (hasGable) return "Gable";
  if (hasHip) return "Hip";
  if (text.includes("flat")) return "Flat";
  if (text.includes("mansard")) return "Mansard";
  if (text.includes("gambrel")) return "Gambrel";
  if (text.includes("shed")) return "Shed";
  if (text.includes("saltbox")) return "Saltbox";
  if (text.includes("butterfly")) return "Butterfly";
  if (text.includes("bonnet")) return "Bonnet";
  if (text.includes("clerestory")) return "Clerestory";
  if (text.includes("dome")) return "Dome";
  if (text.includes("barrel")) return "Barrel";
  return null;
}

function mapRoofCoveringMaterial(raw) {
  const entry = getCharacteristic(raw, "Roof Cover");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;
  if (text.includes("architectural")) return "Architectural Asphalt Shingle";
  if (text.includes("asphalt") || text.includes("comp shingle"))
    return "Architectural Asphalt Shingle";
  if (text.includes("3-tab")) return "3-Tab Asphalt Shingle";
  if (text.includes("metal") && text.includes("standing"))
    return "Metal Standing Seam";
  if (text.includes("metal")) return "Metal Corrugated";
  if (text.includes("clay")) return "Clay Tile";
  if (text.includes("concrete")) return "Concrete Tile";
  if (text.includes("slate") && text.includes("synthetic"))
    return "Synthetic Slate";
  if (text.includes("slate")) return "Natural Slate";
  if (text.includes("wood shake")) return "Wood Shake";
  if (text.includes("wood shingle")) return "Wood Shingle";
  if (text.includes("tpo")) return "TPO Membrane";
  if (text.includes("epdm")) return "EPDM Membrane";
  if (text.includes("modified bitumen")) return "Modified Bitumen";
  if (text.includes("built-up")) return "Built-Up Roof";
  if (text.includes("green roof")) return "Green Roof System";
  if (text.includes("solar")) return "Solar Integrated Tiles";
  return null;
}

function mapRoofMaterialType(raw, roofCovering) {
  const value = roofCovering || mapRoofCoveringMaterial(raw);
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("shingle")) return "Shingle";
  if (text.includes("metal")) return "Metal";
  if (text.includes("tile")) return "CeramicTile";
  if (text.includes("slate")) return "Stone";
  if (text.includes("wood")) return "Wood";
  if (text.includes("membrane") || text.includes("tpo") || text.includes("epdm"))
    return "Composition";
  if (text.includes("bitumen") || text.includes("built-up")) return "Composition";
  if (text.includes("green roof")) return "Manufactured";
  if (text.includes("solar")) return "Glass";
  if (text.includes("concrete")) return "Concrete";
  return null;
}

function mapPrimaryFramingMaterial(raw) {
  const entry = getCharacteristic(raw, "Class");
  const text = combinedLowerText(raw, [
    entry && entry.description,
    entry && entry.code,
  ]);
  if (!text) return null;
  if (/post\s*[- ]*and\s*[- ]*beam/.test(text)) return "Post and Beam";
  if (text.includes("log")) return "Log Construction";
  if (text.includes("engineered") || text.includes("lvl"))
    return "Engineered Lumber";
  if (text.includes("poured") || text.includes("cast-in-place"))
    return "Poured Concrete";
  if (text.includes("concrete block") || text.includes("cmu") || /\bblock\b/.test(text))
    return "Concrete Block";
  if (text.includes("masonry") || text.includes("brick") || text.includes("stone"))
    return "Masonry";
  if (text.includes("steel")) return "Steel Frame";
  if (text.includes("wood")) return "Wood Frame";
  return null;
}

function mapStructure(raw) {
  const roofCoveringMaterial = mapRoofCoveringMaterial(raw);
  const flooringMaterials = mapFlooringMaterials(raw);

  return {
    building_number: mapBuildingNumber(raw),
    architectural_style_type: mapArchitecturalStyleType(raw),
    attachment_type: mapAttachmentType(raw),
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: mapExteriorWallCondition(raw),
    exterior_wall_condition_primary: mapExteriorWallCondition(raw),
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: mapExteriorWallMaterialPrimary(raw),
    exterior_wall_material_secondary: null,
    finished_base_area: mapFinishedBaseArea(raw),
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: mapExteriorWallCondition(raw),
    flooring_material_primary: flooringMaterials.primary,
    flooring_material_secondary: flooringMaterials.secondary,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: mapExteriorWallCondition(raw),
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: mapInteriorWallSurfaceMaterialPrimary(
      raw,
    ),
    interior_wall_surface_material_secondary: null,
    number_of_stories: mapNumberOfStories(raw),
    primary_framing_material: mapPrimaryFramingMaterial(raw),
    roof_age_years: null,
    roof_condition: mapExteriorWallCondition(raw),
    roof_covering_material: roofCoveringMaterial,
    roof_date: null,
    roof_design_type: mapRoofDesignType(raw),
    roof_material_type: mapRoofMaterialType(raw, roofCoveringMaterial),
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

function extractStructuresData($) {
  const propertyIdentifier =
    cleanText($("td[data-bind*='displayStrap']").text())
  const propertyKey = propertyIdentifier
    ? `property_${propertyIdentifier}`
    : "property_unknown";

  const container = $("div[data-bind='foreach: buildings()']");
  const structures = [];

  container.find("h4.section-header").each((index, header) => {
    const buildingHeader = cleanText($(header).text());
    const buildingNumber = parseBuildingNumber(buildingHeader, index);
    const buildingContent = $(header).nextUntil("h4.section-header");
    const sectionWrap = buildingContent.filter("div.section-wrap").first();
    if (!sectionWrap.length) return;

    const sectionText = cleanText(sectionWrap.text());
    const buildingText = cleanText(buildingContent.text());
    const characteristics = extractCharacteristics($, sectionWrap);
    const subAreaTotals = extractSubAreaTotals($, sectionWrap);

    const raw = {
      buildingNumber,
      buildingName: buildingHeader,
      characteristics,
      subAreaTotals,
      sectionText,
      buildingText,
    };
    structures.push(mapStructure(raw));
  });

  return { propertyKey, structures };
}

(function main() {
  const $ = loadHtml("input.html");
  const { propertyKey, structures } = extractStructuresData($);
  const payload = { [propertyKey]: { structures } };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "structure_data.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  console.log("owners/structure_data.json written");
})();
