// Layout Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/layout_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// --- Start of extraFeatureHelpers.js content ---

function tokenizeFeatureText(text) {
  return (text || "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

function parseNumeric(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function formatYearToISODate(year) {
  if (!year) return null;
  const yearNum = parseInt(year, 10);
  // Only accept years between 1800 and current year + 10 for property data
  // This prevents values like 290 (which are measurements, not years) from being treated as dates
  if (isNaN(yearNum) || yearNum < 1800 || yearNum > new Date().getFullYear() + 10) {
    return null;
  }
  return `${yearNum}-01-01`;
}

function parseExtraFeatures($) {
  const features = [];

  const selectors = [
    "#sfyi-info .sfyi-grid table.table-striped tbody tr",
    "#extra-features table tbody tr",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const row = $(el);
      const typeCell = row.find("th, td").first();
      const type = (typeCell.text() || "").trim();
      if (!type) return;

      let quantity = null;
      let unitsValue = null;
      let yearBuilt = null;
      let unitsRaw = null;

      const allTds = row.find("td");

      // Determine if the first cell was a <th> or <td> to adjust indices
      const isTypeInTh = typeCell.is('th');

      if (isTypeInTh) {
        // If type is in <th>, then all <td>s are data cells
        if (allTds.length >= 1) {
          quantity = parseNumeric(allTds.eq(0).text().trim());
          unitsRaw = allTds.eq(0).text().trim(); // Capture raw units text
        }
        if (allTds.length >= 2) {
          unitsValue = parseNumeric(allTds.eq(1).text().trim());
        }
        if (allTds.length >= 3) {
          yearBuilt = parseNumeric(allTds.eq(2).text().trim());
        }
      } else {
        // If type is in <td>, then the first <td> is the type, and data starts from the second <td>
        if (allTds.length >= 2) { // type (0), quantity (1)
          quantity = parseNumeric(allTds.eq(1).text().trim());
          unitsRaw = allTds.eq(1).text().trim(); // Capture raw units text
        }
        if (allTds.length >= 3) { // type (0), quantity (1), units (2)
          unitsValue = parseNumeric(allTds.eq(2).text().trim());
        }
        if (allTds.length >= 4) { // type (0), quantity (1), units (2), yearBuilt (3)
          yearBuilt = parseNumeric(allTds.eq(3).text().trim());
        }
      }

      features.push({
        rawType: type,
        tokens: tokenizeFeatureText(type),
        quantity: quantity,
        unitsRaw: unitsRaw,
        unitsValue: unitsValue,
        yearBuilt: yearBuilt ? Math.round(yearBuilt) : null,
      });
    });
  });

  return features;
}

function hasToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.includes(normalized);
}

function hasApproxToken(feature, token) {
  if (!feature || !feature.tokens) return false;
  const normalized = token.toUpperCase();
  return feature.tokens.some(
    (t) => t.startsWith(normalized) || normalized.startsWith(t),
  );
}

function hasAnyToken(feature, tokens) {
  return tokens.some((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

function hasAllTokens(feature, tokens) {
  return tokens.every((token) => hasToken(feature, token) || hasApproxToken(feature, token));
}

// --- End of extraFeatureHelpers.js content ---


function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  // Find Parcel ID within Property Identification section
  const table = $("#property-identification table.container").first();
  let parcelId = null;
  table.find("tr").each((i, el) => {
    const th = $(el).find("th").first().text().trim(); // Use $(el) here
    if (/Parcel ID/i.test(th)) {
      const td = $(el).find("td").first(); // Use $(el) here
      const bold = td.find("b");
      parcelId = (bold.text() || td.text() || "").trim();
      return false; // Stop iterating once found
    }
  });
  return parcelId || "unknown";
}

// Helper function to extract text from a table cell based on a label in the header
function getTextFromTableByLabel($, containerSelector, label) {
  const container = $(containerSelector).first();
  let found = null;

  if (container.length === 0) {
    return null;
  }

  container.find("tr").each((i, el) => {
    const th = $(el).find("th").first();
    const thText = th.text().trim();

    if (thText.toLowerCase().includes(label.toLowerCase())) {
      const td = $(el).find("td").first();
      found = td.text().trim() || null;
      return false; // Stop iterating once found
    }
  });
  return found;
}

// Helper to map extracted text to schema enum values
function mapToSchemaEnum(value, enumValues) {
  if (!value || typeof value !== 'string') return null;

  const normalizedInput = value.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const enumVal of enumValues) {
    if (enumVal && typeof enumVal === 'string') {
      const normalizedEnum = enumVal.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedInput === normalizedEnum) {
        return enumVal;
      }
      // More flexible matching for partial words or common abbreviations
      if (normalizedInput.includes(normalizedEnum) || normalizedEnum.includes(normalizedInput)) {
        return enumVal;
      }
    }
  }
  return null;
}

function formatFeatureLabel(feature, prefix = null) {
  const raw = (feature && feature.rawType ? feature.rawType : "").trim();
  if (!raw) return null;
  return prefix ? `${prefix}: ${raw}` : raw;
}

function inferFlooringMaterialFromFeature(feature, flooringEnum, mapEnumFn) {
  if (!feature) return null;

  if (hasAnyToken(feature, ["CONCRETE", "CONC", "SLAB", "PAVER", "PAVING"])) {
    return (
      mapEnumFn("PouredConcrete", flooringEnum) ||
      mapEnumFn("Concrete", flooringEnum)
    );
  }

  if (hasAnyToken(feature, ["ASPH"])) {
    return (
      mapEnumFn("Composition", flooringEnum) ||
      mapEnumFn("PouredConcrete", flooringEnum)
    );
  }

  if (hasAnyToken(feature, ["WOOD", "LUMBER"])) {
    return mapEnumFn("Wood", flooringEnum);
  }

  if (hasAnyToken(feature, ["BRICK"])) {
    return mapEnumFn("Brick", flooringEnum);
  }

  if (hasAnyToken(feature, ["STONE", "ROCK", "QUARRY"])) {
    return mapEnumFn("Stone", flooringEnum);
  }

  if (hasAnyToken(feature, ["VINYL"])) {
    return mapEnumFn("Vinyl", flooringEnum);
  }

  if (hasAnyToken(feature, ["TILE"])) {
    return (
      mapEnumFn("CeramicTile", flooringEnum) ||
      mapEnumFn("Tile", flooringEnum)
    );
  }

  if (hasAnyToken(feature, ["METAL", "ALUM", "STEEL"])) {
    return mapEnumFn("Metal", flooringEnum);
  }

  return null;
}

// Modified dedupeLayoutArrays to return single string or null
function dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) {
  if (layout.decor_elements && layout.decor_elements.length > 0) {
    const uniqueDecor = Array.from(new Set(layout.decor_elements));
    // Filter to valid enum values only - exact matches
    const validDecor = uniqueDecor.filter(element =>
      DECOR_ELEMENTS_ENUM.includes(element)
    );
    layout.decor_elements = validDecor.length > 0 ? validDecor[0] : null; // Pick first valid or null
  } else {
    layout.decor_elements = null;
  }

  if (layout.safety_features && layout.safety_features.length > 0) {
    const uniqueSafety = Array.from(new Set(layout.safety_features));
    // Filter to valid enum values only - exact matches
    const validSafety = uniqueSafety.filter(element =>
      SAFETY_FEATURES_ENUM.includes(element)
    );
    layout.safety_features = validSafety.length > 0 ? validSafety[0] : null; // Pick first valid or null
  } else {
    layout.safety_features = null;
  }
  return layout;
}


function mapFreeformFeatureToLayout(feature, enums, mapEnumFn) {
  if (!feature) return null;

  const {
    SPACE_TYPE_ENUM,
    FLOORING_MATERIAL_TYPE_ENUM,
    POOL_TYPE_ENUM,
    SPA_TYPE_ENUM,
    DECOR_ELEMENTS_ENUM,
    SAFETY_FEATURES_ENUM,
  } = enums;

  const layout = {
    space_type: null,
    is_exterior: true,
    flooring_material_type: inferFlooringMaterialFromFeature(
      feature,
      FLOORING_MATERIAL_TYPE_ENUM,
      mapEnumFn,
    ),
    pool_type: null,
    spa_type: null,
    safety_features: [], // Temporarily an array for collection
    decor_elements: [], // Temporarily an array for collection
    view_type: null,
  };

  const label = formatFeatureLabel(feature);
  const hasAll = (tokens) => hasAllTokens(feature, tokens);
  const hasAny = (tokens) => hasAnyToken(feature, tokens);

  if (hasAll(["POOL", "DK"]) || hasAll(["POOL", "DECK"])) {
    layout.space_type = mapEnumFn("Pool Area", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Pool Deck (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["POOL", "ENC"])) {
    layout.space_type = mapEnumFn("Pool Area", SPACE_TYPE_ENUM);
    layout.safety_features.push("Screen Enclosure"); // This will be filtered by dedupeLayoutArrays
    if (label) layout.decor_elements.push(`Pool Enclosure (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["POOL", "VINYL"])) {
    layout.space_type = mapEnumFn("Outdoor Pool", SPACE_TYPE_ENUM);
    layout.pool_type = mapEnumFn("Vinyl", POOL_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["POOL", "FIBER"])) {
    layout.space_type = mapEnumFn("Outdoor Pool", SPACE_TYPE_ENUM);
    layout.pool_type = mapEnumFn("Fiberglass", POOL_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["POOL", "MASONRY"]) || hasAll(["POOL", "CONC"])) {
    layout.space_type = mapEnumFn("Outdoor Pool", SPACE_TYPE_ENUM);
    layout.pool_type = mapEnumFn("Concrete", POOL_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["POOL", "COMMERCIAL"])) {
    layout.space_type = mapEnumFn("Outdoor Pool", SPACE_TYPE_ENUM);
    layout.pool_type = mapEnumFn("Concrete", POOL_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Commercial Pool (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["POOL"]) && !hasAny(["SPA"])) {
    layout.space_type =
      mapEnumFn("Outdoor Pool", SPACE_TYPE_ENUM) ||
      mapEnumFn("Pool Area", SPACE_TYPE_ENUM);
    layout.pool_type =
      layout.pool_type || mapEnumFn("BuiltIn", POOL_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Pool Feature (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["SPAS", "SPA", "JACUZZI"]) || hasAll(["HOT", "TUB"])) {
    layout.space_type = mapEnumFn("Hot Tub / Spa Area", SPACE_TYPE_ENUM);
    layout.spa_type =
      mapEnumFn("Jacuzzi", SPA_TYPE_ENUM) ||
      mapEnumFn("Heated", SPA_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["SAUNA"])) {
    layout.space_type = mapEnumFn("Hot Tub / Spa Area", SPACE_TYPE_ENUM);
    layout.spa_type = mapEnumFn("Heated", SPA_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["GAZEBO"])) {
    layout.space_type = mapEnumFn("Gazebo", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    if (hasAny(["SCREEN"])) {
      layout.safety_features.push("Screen Panels"); // This will be filtered by dedupeLayoutArrays
    }
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["BOAT", "HOUSE"])) {
    layout.space_type = mapEnumFn("Shed", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Boat House (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["DOCK"])) {
    layout.space_type = mapEnumFn("Deck", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Dock (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["DECK"]) || hasAny(["DK"])) {
    layout.space_type = mapEnumFn("Deck", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["CARPORT"])) {
    const isDetached = hasAny(["DET"]) || hasAll(["CARPORT", "TRLR"]);
    const carportType = isDetached
      ? "Detached Carport"
      : hasAny(["ATT", "ATTACH"]) || hasAny(["PORCH"])
        ? "Attached Carport"
        : "Carport";
    layout.space_type =
      mapEnumFn(carportType, SPACE_TYPE_ENUM) ||
      mapEnumFn("Carport", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["PORCH", "SCREEN"])) {
    layout.space_type = mapEnumFn("Screened Porch", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["PORCH", "ENC"])) {
    layout.space_type = mapEnumFn("Enclosed Porch", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    layout.is_exterior = false;
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["PORCH", "OPEN"])) {
    layout.space_type = mapEnumFn("Open Porch", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["PORCH"])) {
    layout.space_type = mapEnumFn("Porch", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["ENCLOSURE", "GLASS"])) {
    layout.space_type = mapEnumFn("Sunroom", SPACE_TYPE_ENUM);
    layout.is_exterior = false;
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["ENCLOSURE", "SCREEN"])) {
    layout.space_type = mapEnumFn("Screened Porch", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["CABANA"])) {
    layout.space_type = mapEnumFn("Enclosed Cabana", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["UTILITY", "STORAGE"]) || hasAll(["STORAGE", "UTILITY"])) {
    layout.space_type = mapEnumFn("Detached Utility Closet", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["STORAGE"]) && hasAny(["SHED"])) {
    layout.space_type = mapEnumFn("Shed", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["SHED"])) {
    layout.space_type = mapEnumFn("Shed", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["BARN"])) {
    layout.space_type = mapEnumFn("Shed", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Barn (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["PUMP", "HOUSE"])) {
    layout.space_type = mapEnumFn("Utility Closet", SPACE_TYPE_ENUM);
    layout.is_exterior = false;
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["GREENHOUSE"]) || hasAny(["SHADEHOUSE"])) {
    layout.space_type = mapEnumFn("Greenhouse", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["DRIV", "DRIVE"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Driveway (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["WALK"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Walkway (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["STAIR", "STEP"])) {
    layout.space_type = mapEnumFn("Stoop", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["PATIO"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["SHUFFLEBOARD"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push("Shuffleboard");
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["TENNIS"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push("Tennis Court");
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["FENCE"])) {
    layout.space_type = mapEnumFn("Courtyard", SPACE_TYPE_ENUM);
    if (label) {
      const fenceLabel = `Fencing`; // Map to "Fencing" enum - only valid for safety_features
      layout.safety_features.push(fenceLabel);
    }
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["SEA", "WALL"])) {
    layout.space_type = mapEnumFn("Courtyard", SPACE_TYPE_ENUM);
    layout.view_type = "Waterfront";
    if (label) layout.decor_elements.push(`Seawall (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["WALL"])) {
    layout.space_type = mapEnumFn("Courtyard", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Wall (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["CANOPY"])) {
    layout.space_type = mapEnumFn("Pergola", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Canopy (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["MEZZANINE"])) {
    layout.space_type = mapEnumFn("Storage Loft", SPACE_TYPE_ENUM);
    layout.is_exterior = false;
    if (label) layout.decor_elements.push(label);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["BLEACHER"])) {
    layout.space_type = mapEnumFn("Deck", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Bleachers (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["BRIDGE"])) {
    layout.space_type = mapEnumFn("Deck", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Bridge (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["RACE", "TRACK"]) || hasAll(["RUNWAY", "TAXIWAY"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Paved Surface (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["TRUCK", "SCALE"])) {
    layout.space_type = mapEnumFn("Patio", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Truck Scale (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["SERVICE", "PIT"])) {
    layout.space_type = mapEnumFn("Utility Closet", SPACE_TYPE_ENUM);
    layout.is_exterior = false;
    if (label) layout.decor_elements.push(`Service Pit (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["VAULT"])) {
    layout.space_type = mapEnumFn("Utility Closet", SPACE_TYPE_ENUM);
    layout.is_exterior = false;
    if (label) layout.decor_elements.push(`Vault (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["TOWER"])) {
    layout.space_type = mapEnumFn("Deck", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Tower (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAny(["SILO"])) {
    layout.space_type = mapEnumFn("Shed", SPACE_TYPE_ENUM);
    if (label) layout.decor_elements.push(`Silo (${label})`);
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  if (hasAll(["GATE", "MECHANICAL"]) || hasAll(["GATE", "AUTO"])) {
    layout.space_type = mapEnumFn("Courtyard", SPACE_TYPE_ENUM);
    if (label) {
      const gateLabel = `SelfClosingGate`; // Map to "SelfClosingGate" enum - only valid for safety_features
      layout.safety_features.push(gateLabel);
    }
    return layout.space_type ? dedupeLayoutArrays(layout, DECOR_ELEMENTS_ENUM, SAFETY_FEATURES_ENUM) : null;
  }

  return null;
}

// Helper to create a default layout object with all required fields as null
// Modified to accept spaceTypeCounters for space_index
function createDefaultLayout(
  parcelId,
  spaceType,
  spaceTypeCounters,
  buildingNumber = null,
  floorLevel = null,
  spaceTypeIndex = null,
) {
  // Increment the counter for this spaceType
  spaceTypeCounters[spaceType] = (spaceTypeCounters[spaceType] || 0) + 1;
  const spaceIndex = spaceTypeCounters[spaceType];

  return {
    source_http_request: {
      method: "GET",
      url: `https://apps.paslc.gov/rerecordcard, '')}`
    },
    request_identifier: `${parcelId}_${spaceType.toLowerCase().replace(/\s/g, '')}_${spaceIndex}`,
    space_type: spaceType,
    space_index: spaceIndex, // Now uses the type-specific index
    space_type_index: spaceTypeIndex,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: floorLevel, // Stored as schema-compliant string when available
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: false, // Default to false, explicitly set to true for finished rooms
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
    decor_elements: null, // Changed to single string or null
    pool_type: null,
    pool_equipment: null,
    spa_type: null,
    safety_features: null, // Changed to single string or null
    view_type: null,
    lighting_features: null,
    condition_issues: null,
    is_exterior: false, // Default to false, set true for exterior spaces
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    adjustable_area_sq_ft: null,
    area_under_air_sq_ft: null,
    bathroom_renovation_date: null,
    building_number: buildingNumber,
    built_year: null, // Added built_year
    heated_area_sq_ft: null,
    kitchen_renovation_date: null,
    livable_area_sq_ft: null,
    pool_installation_date: null,
    spa_installation_date: null,
    story_type: null,
    total_area_sq_ft: null,
    flooring_installation_date: null,
  };
}


function extractLayouts($, parcelId) {
  const allLayouts = [];
  const spaceTypeCounters = {}; // Counter for each space_type across the property
  const buildingTypeIndexCounters = {};
  const floorTypeIndexCounters = {};
  const standaloneTypeIndexCounters = {};

  function getBuildingIndex(buildingNumber) {
    return buildingNumber != null ? String(buildingNumber) : null;
  }

  function nextBuildingTypeIndex(buildingNumber, spaceType) {
    const buildingIndex = getBuildingIndex(buildingNumber);
    if (!buildingIndex) {
      return nextStandaloneTypeIndex(spaceType);
    }
    const key = `${buildingIndex}|${spaceType}`;
    buildingTypeIndexCounters[key] =
      (buildingTypeIndexCounters[key] || 0) + 1;
    return `${buildingIndex}.${buildingTypeIndexCounters[key]}`;
  }

  function nextFloorTypeIndex(buildingNumber, floorNumber, spaceType) {
    const buildingIndex = getBuildingIndex(buildingNumber);
    if (!buildingIndex || floorNumber == null) {
      return nextBuildingTypeIndex(buildingNumber, spaceType);
    }
    const floorSegment = String(floorNumber);
    const key = `${buildingIndex}-${floorSegment}|${spaceType}`;
    floorTypeIndexCounters[key] =
      (floorTypeIndexCounters[key] || 0) + 1;
    return `${buildingIndex}.${floorSegment}.${floorTypeIndexCounters[key]}`;
  }

  function nextStandaloneTypeIndex(spaceType) {
    standaloneTypeIndexCounters[spaceType] =
      (standaloneTypeIndexCounters[spaceType] || 0) + 1;
    return String(standaloneTypeIndexCounters[spaceType]);
  }

  // --- Schema Enum Definitions (for validation and mapping) ---
  const SPACE_TYPE_ENUM = [
    "Living Room", "Family Room", "Great Room", "Dining Room", "Kitchen", "Breakfast Nook", "Pantry",
    "Primary Bedroom", "Secondary Bedroom", "Guest Bedroom", "Children’s Bedroom", "Nursery",
    "Full Bathroom", "Three-Quarter Bathroom", "Half Bathroom / Powder Room", "En-Suite Bathroom",
    "Jack-and-Jill Bathroom", "Primary Bathroom", "Laundry Room", "Mudroom", "Closet", "Bedroom",
    "Walk-in Closet", "Mechanical Room", "Storage Room", "Server/IT Closet", "Home Office", "Library",
    "Den", "Study", "Media Room / Home Theater", "Game Room", "Home Gym", "Music Room", "Craft Room / Hobby Room",
    "Prayer Room / Meditation Room", "Safe Room / Panic Room", "Wine Cellar", "Bar Area", "Greenhouse",
    "Attached Garage", "Detached Garage", "Carport", "Workshop", "Storage Loft", "Porch", "Screened Porch",
    "Sunroom", "Deck", "Patio", "Pergola", "Balcony", "Terrace", "Gazebo", "Pool House", "Outdoor Kitchen",
    "Lobby / Entry Hall", "Common Room", "Utility Closet", "Elevator Lobby", "Mail Room", "Janitor’s Closet",
    "Pool Area", "Indoor Pool", "Outdoor Pool", "Hot Tub / Spa Area", "Shed", "Lanai", "Open Porch",
    "Enclosed Porch", "Attic", "Enclosed Cabana", "Attached Carport", "Detached Carport",
    "Detached Utility Closet", "Jacuzzi", "Courtyard", "Open Courtyard", "Screen Porch (1-Story)",
    "Screen Enclosure (2-Story)", "Screen Enclosure (3-Story)", "Screen Enclosure (Custom)",
    "Lower Garage", "Lower Screened Porch", "Screened Porch", "Stoop", "First Floor", "Second Floor",
    "Third Floor", "Fourth Floor", "Basement", "Sub-Basement", "Living Area", "Building", "Floor"
  ];

  const FLOORING_MATERIAL_TYPE_ENUM = [
    "Manufactured", "EngineeredWood", "Terazzo", "Brick", "Wood", "CinderBlock", "Concrete", "Shingle",
    "Composition", "Linoleum", "Stone", "CeramicTile", "Block", "WoodSiding", "ImpactGlass", "Carpet",
    "Marble", "Vinyl", "Tile", "PouredConcrete", "Metal", "Glass", "Laminate"
  ];

  const FLOOR_LEVEL_ENUM = ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor"];

  const STORY_TYPE_ENUM = ["Full", "Half Story", "Three-Quarter Story"];

  const POOL_TYPE_ENUM = [
    "SaltWater", "AboveGround", "Concrete", "Heated", "BuiltIn", "Plunge", "Lap", "Infinity",
    "Fiberglass", "Vinyl", "Natural"
  ];

  const SPA_TYPE_ENUM = [
    "Jacuzzi", "InGround", "Rooftop", "WoodFiredHotTub", "JapaneseSoakingTub", "Saltwater", "Heated"
  ];

  const DECOR_ELEMENTS_ENUM = [
    "Vaulted Ceiling", "Coffered Ceiling", "Beamed Ceiling", "Tray Ceiling", "Accent Wall", "Exposed Brick",
    "Crown Molding", "Wainscoting", "Built-In Shelving", "Wall Paneling"
  ];

  const SAFETY_FEATURES_ENUM = [
    "Fencing", "PoolCover", "Alarm", "SelfClosingGate", "SlipResistantSurface", "Lifebuoy",
    "WarningSignage", "SurveillanceCamera", "Lighting" // Removed "Screen Enclosure", "Screen Panels"
  ];

  function mapFloorNumberToEnum(floorNumber) {
    if (typeof floorNumber !== "number" || floorNumber < 1) {
      return null;
    }
    const ordinalMap = {
      1: "1st Floor",
      2: "2nd Floor",
      3: "3rd Floor",
      4: "4th Floor",
    };
    const label = ordinalMap[floorNumber];
    return label ? mapToSchemaEnum(label, FLOOR_LEVEL_ENUM) : null;
  }


  // --- Extract Building Information ---
  const buildingInfoSection = $("#building-info");
  const buildingSequenceText = buildingInfoSection.find(".building-sequence").text().trim();
  const finishedAreaText = buildingInfoSection.find("div:contains('Finished Area:')").text().replace('Finished Area:', '').replace('SF', '').trim();
  const grossAreaText = buildingInfoSection.find("div:contains('Gross Area:')").text().replace('Gross Area:', '').replace('SF', '').trim();
  const yearBuiltText = getTextFromTableByLabel($, "#building-info .exterior-container table.container", "Year Built");
  const storyHeightText = getTextFromTableByLabel($, "#building-info .exterior-container table.container", "Story Height");
  const numberOfUnitsText = getTextFromTableByLabel($, "#building-info .exterior-container table.container", "Number of Units");

  const finishedArea = parseInt(finishedAreaText.replace(/,/g, ''), 10) || null;
  const grossArea = parseInt(grossAreaText.replace(/,/g, ''), 10) || null;
  const yearBuilt = parseInt(yearBuiltText, 10) || null;
  const numberOfUnits = parseInt(numberOfUnitsText, 10) || 1;

  // Extract interior details once for the main building
  const interiorTableSelector = "#building-info .interior-container table.container";
  const bedroomCountText = getTextFromTableByLabel($, interiorTableSelector, "Bedrooms");
  const fullBathCountText = getTextFromTableByLabel($, interiorTableSelector, "Full Baths");
  const halfBathCountText = getTextFromTableByLabel($, interiorTableSelector, "Half Baths");
  const primaryFloorsText = getTextFromTableByLabel($, interiorTableSelector, "Primary Floors");

  const bedrooms = parseInt(bedroomCountText || "0", 10) || 0;
  const fullBaths = parseInt(fullBathCountText || "0", 10) || 0;
  const halfBaths = parseInt(halfBathCountText || "0", 10) || 0;

  let interiorFlooring = null;
  if (primaryFloorsText) {
    if (primaryFloorsText.includes("TL")) {
      interiorFlooring = mapToSchemaEnum("Tile", FLOORING_MATERIAL_TYPE_ENUM);
    } else if (primaryFloorsText.includes("CON")) {
      interiorFlooring = mapToSchemaEnum("Concrete", FLOORING_MATERIAL_TYPE_ENUM);
    }
  }

  const fullStoryTypeEnumValue = mapToSchemaEnum("Full", STORY_TYPE_ENUM);

  // Determine floor information
  let hasFloorInformation = false;
  let totalStories = 1;
  if (storyHeightText && storyHeightText.toLowerCase().includes("story")) {
    const match = storyHeightText.match(/(\d+)\s*Story/i);
    if (match && parseInt(match[1], 10) > 1) {
      totalStories = parseInt(match[1], 10);
      hasFloorInformation = true;
    }
  }

  // Handle multiple buildings if indicated (e.g., "1 of 1", "1 of 2")
  const buildingCountMatch = buildingSequenceText.match(/\((\d+)\s+of\s+(\d+)\)/);
  let totalBuildings = 1;
  if (buildingCountMatch) {
    totalBuildings = parseInt(buildingCountMatch[2], 10);
  }

  for (let b = 1; b <= totalBuildings; b++) {
    const buildingSpaceTypeIndex = getBuildingIndex(b);
    const buildingLayout = createDefaultLayout(
      parcelId,
      "Building",
      spaceTypeCounters,
      b,
      null,
      buildingSpaceTypeIndex,
    );
    buildingLayout.total_area_sq_ft = grossArea;
    buildingLayout.livable_area_sq_ft = finishedArea;
    buildingLayout.built_year = yearBuilt;
    buildingLayout.installation_date = formatYearToISODate(yearBuilt);
    buildingLayout.is_finished = true; // Buildings are generally considered "finished"
    allLayouts.push(buildingLayout);

    if (hasFloorInformation) {
      for (let floorNum = 1; floorNum <= totalStories; floorNum++) {
        const floorSpaceTypeIndex = `${buildingSpaceTypeIndex}.${floorNum}`;
        const floorLevelValue = mapFloorNumberToEnum(floorNum);
        const floorLayout = createDefaultLayout(
          parcelId,
          "Floor",
          spaceTypeCounters,
          b,
          floorLevelValue,
          floorSpaceTypeIndex,
        );
        if (fullStoryTypeEnumValue) {
          floorLayout.story_type = fullStoryTypeEnumValue;
        }
        floorLayout.is_finished = true; // Floors are generally considered "finished"
        allLayouts.push(floorLayout);

        // Add rooms to the current floor
        for (let i = 0; i < bedrooms; i++) {
          const roomSpaceTypeIndex = nextFloorTypeIndex(b, floorNum, "Bedroom");
          const roomLayout = createDefaultLayout(
            parcelId,
            "Bedroom",
            spaceTypeCounters,
            b,
            floorLevelValue,
            roomSpaceTypeIndex,
          );
          roomLayout.flooring_material_type = interiorFlooring;
          roomLayout.is_finished = true;
          allLayouts.push(roomLayout);
        }
        for (let i = 0; i < fullBaths; i++) {
          const roomSpaceTypeIndex = nextFloorTypeIndex(b, floorNum, "Full Bathroom");
          const roomLayout = createDefaultLayout(
            parcelId,
            "Full Bathroom",
            spaceTypeCounters,
            b,
            floorLevelValue,
            roomSpaceTypeIndex,
          );
          roomLayout.flooring_material_type = interiorFlooring;
          roomLayout.is_finished = true;
          allLayouts.push(roomLayout);
        }
        for (let i = 0; i < halfBaths; i++) {
          const roomSpaceTypeIndex = nextFloorTypeIndex(b, floorNum, "Half Bathroom / Powder Room");
          const roomLayout = createDefaultLayout(
            parcelId,
            "Half Bathroom / Powder Room",
            spaceTypeCounters,
            b,
            floorLevelValue,
            roomSpaceTypeIndex,
          );
          roomLayout.flooring_material_type = interiorFlooring;
          roomLayout.is_finished = true;
          allLayouts.push(roomLayout);
        }
      }
    } else {
      // No explicit floor information, link rooms directly to the building
      for (let i = 0; i < bedrooms; i++) {
        const roomSpaceTypeIndex = nextBuildingTypeIndex(b, "Bedroom");
        const roomLayout = createDefaultLayout(
          parcelId,
          "Bedroom",
          spaceTypeCounters,
          b,
          null,
          roomSpaceTypeIndex,
        );
        roomLayout.flooring_material_type = interiorFlooring;
        roomLayout.is_finished = true;
        allLayouts.push(roomLayout);
      }
      for (let i = 0; i < fullBaths; i++) {
        const roomSpaceTypeIndex = nextBuildingTypeIndex(b, "Full Bathroom");
        const roomLayout = createDefaultLayout(
          parcelId,
          "Full Bathroom",
          spaceTypeCounters,
          b,
          null,
          roomSpaceTypeIndex,
        );
        roomLayout.flooring_material_type = interiorFlooring;
        roomLayout.is_finished = true;
        allLayouts.push(roomLayout);
      }
      for (let i = 0; i < halfBaths; i++) {
        const roomSpaceTypeIndex = nextBuildingTypeIndex(b, "Half Bathroom / Powder Room");
        const roomLayout = createDefaultLayout(
          parcelId,
          "Half Bathroom / Powder Room",
          spaceTypeCounters,
          b,
          null,
          roomSpaceTypeIndex,
        );
        roomLayout.flooring_material_type = interiorFlooring;
        roomLayout.is_finished = true;
        allLayouts.push(roomLayout);
      }
    }
  }


  // --- Extracting from Special Features and Yard Items (SFYI) ---
  const sfyiTable = $("#sfyi-info .sfyi-grid table.table-striped tbody");
  sfyiTable.find("tr").each((i, el) => {
    const row = $(el);
    const type = row.find("th").first().text().trim();
    const qty = parseInt(row.find("td").eq(0).text().trim() || "1", 10);
    const units = row.find("td").eq(1).text().trim();
    const yearBuiltSFYI = parseInt(row.find("td").eq(2).text().trim(), 10) || null;

    if (type) {
      let spaceType = null;
      let isExterior = false;
      let poolType = null;
      let spaType = null;
      let flooringMaterial = null;
      let decorElements = []; // Temporarily an array
      let safetyFeatures = []; // Temporarily an array
      let viewType = null;
      let sizeSquareFeet = null;
      let installationDate = formatYearToISODate(yearBuiltSFYI);

      if (!isNaN(units) && units !== "") {
        sizeSquareFeet = parseInt(units, 10);
      }

      const featureInfo = {
        rawType: type,
        tokens: tokenizeFeatureText(type),
      };

      // Mapping SFYI types to schema space_type and other fields
      switch (type.toUpperCase()) {
        // --- Carports ---
        case "ACPA": case "ACPH": case "ACPL": // Aluminium Carport
        case "CPAA": case "CPAH": case "CPAL": // Carport Attached
        case "CPDA": case "CPDH": case "CPDL": // Carport Detached
        case "PC1": case "PC2": case "PC3": case "PC4": case "PC5": // Carport numerical
        case "PCA": case "PCG": case "PCL": // Mobile Home Carport
        case "CPT": case "CRP": case "TVCP": case "XCAR":
          spaceType = mapToSchemaEnum(type.includes("DET") || type.includes("CPD") ? "Detached Carport" : "Carport", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Patios ---
        case "APOA": case "APOH": case "APOL": // Aluminium Patio (Open)
        case "PATA": case "PATH": // Patio (Plain Slab/Flooring)
        case "PA1": case "PA2": case "PA3": case "PA4": // Patio numerical
        case "TVP": case "XOPT":
          spaceType = mapToSchemaEnum("Patio", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Screened Porches / Enclosures ---
        case "APSA": case "APSH": case "APSL": // Aluminium Patio (Screen)
        case "ASEA": case "ASEH": case "ASEL": // Aluminum Screen Enclosure
        case "ISPA": // Island Screen Porch
        case "NVSE": // Screen Enclosure for Sketch Only
        case "SE1": case "SE2": case "SE3": case "SE4": // Screen Enc Flat
        case "SE5": case "SE6": case "SE7": case "SE8": // Screen Enc High
        case "SP2": case "SP3": case "SP4": case "SP5": case "SP6": // Screened Porch numerical
        case "SPA": case "SPAE": case "SPAH": case "SPAL": case "SPG": case "SPL": // Mobile Home Screen Porch
        case "SRA": case "SRG": // Mobile Home Screen Room
        case "TVSE": case "XSEC": case "XSPN": case "XSPR":
        case "SCREEN PORCH (1-STORY)": case "SCREEN ENCLOSURE (2-STORY)":
        case "SCREEN ENCLOSURE (3-STORY)": case "SCREEN ENCLOSURE (CUSTOM)":
        case "LOWER SCREENED PORCH": case "SCR": case "SCV":
          spaceType = mapToSchemaEnum("Screened Porch", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Garages ---
        case "CGAR": // Condo Garage
        case "GA1": case "GA2": case "GA3": case "GA4": case "GA5": case "GA6": case "GA7": case "GA8": case "GA9": // Detached Garage numerical
        case "GAA": case "GAH": case "GAL": // Garage Attached
        case "GAR": // Base Area Garage
        case "GDA": case "GDH": case "GDL": // Garage Detached
        case "GR3": case "GR4": case "GR5": case "GR6": case "GR7": case "GR8": // Garage numerical
        case "GMA": // Garage Manufactured House Attached
        case "TVGA": case "XGA2": case "XGAR":
        case "LOWER GARAGE":
          spaceType = mapToSchemaEnum(type.includes("DET") || type.includes("GDA") ? "Detached Garage" : "Attached Garage", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Cabanas ---
        case "CBA": case "CBAS": case "CBG": case "CBL": case "CBNA": case "CBNB": case "ENCLOSED CABANA":
          spaceType = mapToSchemaEnum("Enclosed Cabana", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Enclosed Porches ---
        case "CEPR": // Condo Enclosed Porch
        case "CLPA": case "CLPH": case "CLPL": // Closed Porch
        case "CP3": case "CP4": case "CP5": case "CP6": case "CP7": case "CP8": case "CP9": // Closed Porch numerical
        case "TVEP": case "XEPR": case "XEPV":
          spaceType = mapToSchemaEnum("Enclosed Porch", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Lofts ---
        case "CLFT": case "LOF2": case "LOF3": case "LT1": case "TVLT": case "XLFT":
          spaceType = mapToSchemaEnum("Storage Loft", SPACE_TYPE_ENUM);
          isExterior = false;
          break;

        // --- Open Porches ---
        case "COPR": // Condominium Open Porch
        case "ISOP": // Island Open Porch
        case "OP1": case "OP2": case "OP3": case "OP4": case "OP5": case "OP6": // Open Porch numerical
        case "OPA": case "OPAA": case "OPAE": case "OPAH": case "OPAL": case "OPG": case "OPL": // Mobile Home Open Porch
        case "UO3": // Upper Open Porch
        case "TVOP": case "XOPR":
          spaceType = mapToSchemaEnum("Open Porch", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Docks / Decks ---
        case "DKC": // Concrete Dock
          spaceType = mapToSchemaEnum("Deck", SPACE_TYPE_ENUM);
          flooringMaterial = mapToSchemaEnum("Concrete", FLOORING_MATERIAL_TYPE_ENUM);
          isExterior = true;
          break;
        case "DKW": // Wood Dock
        case "RDL": // Raised Deck
        case "WDK": case "TVW…": case "XWD…":
          spaceType = mapToSchemaEnum("Deck", SPACE_TYPE_ENUM);
          flooringMaterial = mapToSchemaEnum("Wood", FLOORING_MATERIAL_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Greenhouses ---
        case "GHSA": // Green House Air Conditioned
        case "GNH": // Base Area Greenhouse
          spaceType = mapToSchemaEnum("Greenhouse", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Offices ---
        case "IOFA": case "IOFH": case "IOFL": // Interior Office
        case "MDH": // Module Office Bldg (could be a commercial office space)
        case "OFF": case "OFG":
          spaceType = mapToSchemaEnum("Home Office", SPACE_TYPE_ENUM);
          isExterior = false;
          break;

        // --- PUMPHOUSE / SHED / UTILITY ---
        case "PHS": // Pumphouse
        case "SHD": // Base Area/Shed
        case "USA": case "USH": case "USL": // Utility Shed
          spaceType = mapToSchemaEnum("Shed", SPACE_TYPE_ENUM);
          isExterior = true;
          break;
        case "CUTL": // Condo Utility Room
        case "UMA": // Utility Room for MHA
        case "URAA": case "URAH": case "URAL": // Utility Room Attached
        case "UT1": case "UT2": case "UT3": case "UT4": case "UT5": case "UT6": case "UT7": case "UT8": case "UT9": // Utility numerical
        case "UTL": case "UTR": case "UTS": case "TVUT": case "XUTL":
        case "UL1": case "UL2": case "UL3": case "UL4": // Detached Utility
          spaceType = mapToSchemaEnum(type.includes("DET") || type.includes("UL") ? "Detached Utility Closet" : "Utility Closet", SPACE_TYPE_ENUM);
          isExterior = type.includes("DET") || type.includes("UL");
          break;

        // --- Pools ---
        case "PD1": case "PD2": case "PD3": case "PD4": case "PD5": // Pool Deck
          spaceType = mapToSchemaEnum("Pool Area", SPACE_TYPE_ENUM);
          isExterior = true;
          break;
        case "SPS": // Swimming Pool Standard
        case "SW1": case "SW2": case "SW3": case "SW4": case "SW5": // SP Concrete/Gunite
        case "TVPL":
          spaceType = mapToSchemaEnum("Pool Area", SPACE_TYPE_ENUM);
          isExterior = true;
          poolType = mapToSchemaEnum("Concrete", POOL_TYPE_ENUM);
          break;

        // --- Spas / Hot Tubs ---
        case "SWS": // SPA/WHIRLPOOL/HOT TUB
        case "TVHT":
        case "JACUZZI":
          spaceType = mapToSchemaEnum("Hot Tub / Spa Area", SPACE_TYPE_ENUM);
          isExterior = true;
          spaType = mapToSchemaEnum("Jacuzzi", SPA_TYPE_ENUM);
          break;

        // --- Sunrooms ---
        case "SLRM": // Solar Glass Room (Residential)
          spaceType = mapToSchemaEnum("Sunroom", SPACE_TYPE_ENUM);
          isExterior = false;
          break;

        // --- Balconies ---
        case "XBAL":
          spaceType = mapToSchemaEnum("Balcony", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Courtyards ---
        case "COURTYARD":
          spaceType = mapToSchemaEnum("Courtyard", SPACE_TYPE_ENUM);
          isExterior = true;
          break;
        case "OPEN COURTYARD":
          spaceType = mapToSchemaEnum("Open Courtyard", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Generic Floor Levels / Living Areas ---
        case "CB2F": // Condo Base 2nd Floor Living Area
        case "XBS1": case "XBS2": case "XBS3": // Condo Living Area
        case "TVB1": case "TVB2": // Total Value Base (Residential)
        case "LIVING AREA":
          spaceType = mapToSchemaEnum("Living Area", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "FIRST FLOOR":
          spaceType = mapToSchemaEnum("First Floor", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "SECOND FLOOR":
          spaceType = mapToSchemaEnum("Second Floor", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "THIRD FLOOR":
          spaceType = mapToSchemaEnum("Third Floor", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "FOURTH FLOOR":
          spaceType = mapToSchemaEnum("Fourth Floor", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "BASEMENT":
          spaceType = mapToSchemaEnum("Basement", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "SUB-BASEMENT":
          spaceType = mapToSchemaEnum("Sub-Basement", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "STOOP":
          spaceType = mapToSchemaEnum("Stoop", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        // --- Other specific mappings ---
        case "IOFA": case "IOFH": case "IOFL":
          spaceType = mapToSchemaEnum("Home Office", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "ISRA": case "ISRH": case "ISRL":
          spaceType = mapToSchemaEnum("Living Room", SPACE_TYPE_ENUM);
          isExterior = false;
          break;
        case "CN1": case "CN2": case "CN3": case "CN4": case "CN5": case "CN6": case "CN7": case "CN8":
          spaceType = mapToSchemaEnum("Pergola", SPACE_TYPE_ENUM);
          isExterior = true;
          break;

        default:
          const mappedSpaceType = mapToSchemaEnum(type, SPACE_TYPE_ENUM);
          if (mappedSpaceType) {
            spaceType = mappedSpaceType;
            isExterior = (spaceType.includes("Porch") || spaceType.includes("Deck") || spaceType.includes("Patio") ||
                          spaceType.includes("Carport") || spaceType.includes("Garage") || spaceType.includes("Shed") ||
                          spaceType.includes("Pool") || spaceType.includes("Spa") || spaceType.includes("Balcony") ||
                          spaceType.includes("Terrace") || spaceType.includes("Gazebo") || spaceType.includes("Courtyard") ||
                          spaceType.includes("Greenhouse") || spaceType.includes("Lanai"));
          }
          break;
      }

      const freeformMapped = mapFreeformFeatureToLayout(
        featureInfo,
        {
          SPACE_TYPE_ENUM,
          FLOORING_MATERIAL_TYPE_ENUM,
          POOL_TYPE_ENUM,
          SPA_TYPE_ENUM,
          DECOR_ELEMENTS_ENUM,
          SAFETY_FEATURES_ENUM,
        },
        mapToSchemaEnum,
      );

      if (freeformMapped) {
        if (!spaceType && freeformMapped.space_type) {
          spaceType = freeformMapped.space_type;
        }
        if (typeof freeformMapped.is_exterior === "boolean") {
          isExterior = freeformMapped.is_exterior;
        }
        if (!poolType && freeformMapped.pool_type) {
          poolType = freeformMapped.pool_type;
        }
        if (!spaType && freeformMapped.spa_type) {
          spaType = freeformMapped.spa_type;
        }
        if (!flooringMaterial && freeformMapped.flooring_material_type) {
          flooringMaterial = freeformMapped.flooring_material_type;
        }
        // freeformMapped.decor_elements and safety_features are single strings or null after dedupeLayoutArrays
        if (freeformMapped.decor_elements && typeof freeformMapped.decor_elements === 'string') {
          decorElements.push(freeformMapped.decor_elements);
        }
        if (freeformMapped.safety_features && typeof freeformMapped.safety_features === 'string') {
          safetyFeatures.push(freeformMapped.safety_features);
        }
        if (!viewType && freeformMapped.view_type) {
          viewType = freeformMapped.view_type;
        }
      }

      if (spaceType) {
        for (let j = 0; j < qty; j++) {
          const sfyiSpaceTypeIndex = nextStandaloneTypeIndex(spaceType);
          const sfyiLayout = createDefaultLayout(
            parcelId,
            spaceType,
            spaceTypeCounters,
            null,
            null,
            sfyiSpaceTypeIndex,
          ); // Pass spaceTypeCounters
          sfyiLayout.flooring_material_type = flooringMaterial;
          sfyiLayout.size_square_feet = sizeSquareFeet;
          sfyiLayout.pool_type = poolType;
          sfyiLayout.spa_type = spaType;
          sfyiLayout.is_exterior = isExterior;
          sfyiLayout.installation_date = installationDate;
          sfyiLayout.built_year = yearBuiltSFYI;
          sfyiLayout.is_finished = !isExterior; // Explicitly set is_finished based on is_exterior

          // Process decor_elements and safety_features to be single string or null
          const uniqueDecor = Array.from(new Set(decorElements));
          const validDecor = uniqueDecor.filter(element =>
            DECOR_ELEMENTS_ENUM.includes(element)
          );
          sfyiLayout.decor_elements = validDecor.length > 0 ? validDecor[0] : null;

          const uniqueSafety = Array.from(new Set(safetyFeatures));
          const validSafety = uniqueSafety.filter(element =>
            SAFETY_FEATURES_ENUM.includes(element)
          );
          sfyiLayout.safety_features = validSafety.length > 0 ? validSafety[0] : null;

          if (viewType) {
            sfyiLayout.view_type = viewType;
          }
          allLayouts.push(sfyiLayout);
        }
      }
    }
  });

  return { layouts: allLayouts };
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId($);
  const { layouts } = extractLayouts($, parcelId);

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join(outputDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
