// Data extraction script per instructions
// Reads: input.html, unnormalized_address.json, property_seed.json, owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// Writes: JSON outputs under ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf-8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function slugify(value) {
  const text = value == null ? "" : String(value);
  const sanitized = text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized || "unknown";
}

function parseJsonLike(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      const fn = new Function(`"use strict"; return (${text});`);
      return fn();
    } catch {
      return null;
    }
  }
}

function normalizeMultiValueQuery(raw) {
  const parsed = parseJsonLike(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const entries = Object.entries(parsed).reduce((acc, [key, value]) => {
    if (value == null) return acc;
    if (Array.isArray(value)) {
      const arr = value
        .map((v) => (v == null ? null : String(v)))
        .filter((v) => v != null);
      if (arr.length) acc[key] = arr;
      return acc;
    }
    acc[key] = [String(value)];
    return acc;
  }, {});
  return Object.keys(entries).length ? entries : null;
}

function isCoordinatePair(item) {
  return (
    Array.isArray(item) &&
    item.length === 2 &&
    item.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function extractPolygons(raw) {
  if (raw == null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const parsed = parseJsonLike(text);
  if (!parsed) return [];
  const polygons = [];
  const traverse = (node) => {
    if (!Array.isArray(node)) return;
    if (node.length && node.every(isCoordinatePair)) {
      polygons.push(node);
      return;
    }
    node.forEach((child) => traverse(child));
  };
  traverse(parsed);
  const unique = [];
  const seen = new Set();
  polygons.forEach((polygon) => {
    const converted = polygon
      .map((pair) => {
        if (!isCoordinatePair(pair)) return null;
        const [lon, lat] = pair;
        return {
          latitude: lat,
          longitude: lon,
        };
      })
      .filter(Boolean);
    if (converted.length < 3) return;
    const key = JSON.stringify(converted);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(converted);
  });
  return unique;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function readCsvRows(csvPath) {
  if (!fs.existsSync(csvPath)) return [];
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length);
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = parseCsvLine(line);
    const record = {};
    header.forEach((field, idx) => {
      record[field] = parts[idx] != null ? parts[idx] : "";
    });
    rows.push(record);
  }
  return rows;
}

function locateSeedCsv() {
  const bases = [
    process.cwd(),
    __dirname,
    path.resolve(__dirname, ".."),
  ];
  const visited = new Set();
  for (const base of bases) {
    if (!base || visited.has(base)) continue;
    visited.add(base);
    const direct = path.join(base, "seed.csv");
    if (fs.existsSync(direct)) return direct;
    let entries = [];
    try {
      entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(base, entry.name, "seed.csv");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function selectSeedRow(csvRows, candidateIds) {
  if (!csvRows.length || !candidateIds.length) return null;
  const candidateSet = new Set(
    candidateIds
      .map((value) => (value == null ? null : String(value).trim()))
      .filter(Boolean),
  );
  for (const row of csvRows) {
    const rowIds = [
      row.parcel_id,
      row.source_identifier,
      row.prop_id,
      row.property_id,
    ]
      .map((value) => (value == null ? null : String(value).trim()))
      .filter(Boolean);
    const match = rowIds.some((id) => candidateSet.has(id));
    if (match) return row;
  }
  return null;
}

function buildSourceRequestFromRow(row, fallbackRequest) {
  const safeFallback =
    fallbackRequest && typeof fallbackRequest === "object"
      ? clone(fallbackRequest)
      : {};
  const request = {
    url: row.url && row.url.trim() ? row.url.trim() : safeFallback.url || null,
    method:
      row.method && row.method.trim()
        ? row.method.trim().toUpperCase()
        : safeFallback.method || null,
  };
  const multiValue =
    row.multiValueQueryString != null
      ? normalizeMultiValueQuery(row.multiValueQueryString)
      : null;
  if (multiValue) {
    request.multiValueQueryString = multiValue;
  } else if (safeFallback.multiValueQueryString) {
    request.multiValueQueryString = safeFallback.multiValueQueryString;
  }
  Object.keys(request).forEach((key) => {
    if (request[key] == null) delete request[key];
  });
  if (!request.url && safeFallback.url) request.url = safeFallback.url;
  if (!request.method && safeFallback.method)
    request.method = safeFallback.method;
  return request;
}

function removeExistingGeometryArtifacts(dataDir, slug) {
  let entries = [];
  try {
    entries = fs.readdirSync(dataDir);
  } catch {
    entries = [];
  }
  entries.forEach((name) => {
    if (
      name.startsWith(`geometry_parcel_${slug}_`) ||
      name === `geometry_point_${slug}.json` ||
      name.startsWith(`geometry_building_${slug}_`) ||
      name.startsWith(`relationship_parcel_has_geometry_${slug}_`) ||
      name === `relationship_address_has_geometry_${slug}.json` ||
      name.startsWith(`relationship_layout_has_geometry_${slug}_`)
    ) {
      try {
        fs.unlinkSync(path.join(dataDir, name));
      } catch {}
    }
  });
}

function generateGeometryArtifacts({
  dataDir,
  candidateIds,
  requestIdentifier,
  defaultSourceRequest,
  addressPath,
  parcelPath,
  buildingLayoutPaths,
}) {
  const seedCsvPath = locateSeedCsv();
  if (!seedCsvPath) return;
  const csvRows = readCsvRows(seedCsvPath);
  if (!csvRows.length) return;
  const seedRow = selectSeedRow(csvRows, candidateIds);
  if (!seedRow) return;

  const slug = slugify(
    seedRow.parcel_id ||
      seedRow.source_identifier ||
      requestIdentifier ||
      "geometry",
  );
  removeExistingGeometryArtifacts(dataDir, slug);

  const sourceRequest = buildSourceRequestFromRow(
    seedRow,
    defaultSourceRequest,
  );
  const geometryDir = dataDir;
  const identifier =
    seedRow.source_identifier ||
    seedRow.parcel_id ||
    requestIdentifier ||
    null;

  const writeGeometryFile = (filename, payload) => {
    const target = path.join(geometryDir, filename);
    writeJSON(target, payload);
    return `./${filename}`;
  };

  const parcelPolygons = extractPolygons(seedRow.parcel_polygon);
  parcelPolygons.forEach((polygon, idx) => {
    const filename = `geometry_parcel_${slug}_${idx + 1}.json`;
    const payload = {
      polygon,
      request_identifier: identifier,
      source_http_request: clone(sourceRequest),
    };
    const geometryPath = writeGeometryFile(filename, payload);
    const relFilename = `relationship_parcel_has_geometry_${slug}_${idx + 1}.json`;
    const relObject = {
      from: { "/": parcelPath },
      to: { "/": geometryPath },
    };
    writeJSON(path.join(geometryDir, relFilename), relObject);
  });

  const lon =
    seedRow.longitude != null ? parseFloatSafe(seedRow.longitude) : null;
  const lat =
    seedRow.latitude != null ? parseFloatSafe(seedRow.latitude) : null;
  if (lat != null && lon != null) {
    const filename = `geometry_point_${slug}.json`;
    const payload = {
      latitude: lat,
      longitude: lon,
      request_identifier: identifier,
      source_http_request: clone(sourceRequest),
    };
    const geometryPath = writeGeometryFile(filename, payload);
    const relFilename = `relationship_address_has_geometry_${slug}.json`;
    const relObject = {
      from: { "/": addressPath },
      to: { "/": geometryPath },
    };
    writeJSON(path.join(geometryDir, relFilename), relObject);
  }

  const buildingPolygons = extractPolygons(seedRow.building_polygon);
  if (buildingPolygons.length) {
    const layoutTargets =
      Array.isArray(buildingLayoutPaths) && buildingLayoutPaths.length
        ? buildingLayoutPaths
        : [];
    buildingPolygons.forEach((polygon, idx) => {
      const filename = `geometry_building_${slug}_${idx + 1}.json`;
      const payload = {
        polygon,
        request_identifier: identifier,
        source_http_request: clone(sourceRequest),
      };
      const geometryPath = writeGeometryFile(filename, payload);
      const relFilename = `relationship_layout_has_geometry_${slug}_${idx + 1}.json`;
      const layoutPath =
        layoutTargets[idx] || layoutTargets[0] || "./layout_1.json";
      const relObject = {
        from: { "/": layoutPath },
        to: { "/": geometryPath },
      };
      writeJSON(path.join(geometryDir, relFilename), relObject);
    });
  }
}

function clone(obj) {
  if (obj == null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

function moneyToNumber(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "" || n === ".") return null;
  const v = Number(n);
  if (isNaN(v)) return null;
  // Validate that the value is reasonable for currency (less than 1 billion)
  if (!Number.isFinite(v) || v > 1e9 || v < -1e9) return null;
  return v;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9]/g, "");
  if (!n) return null;
  return parseInt(n, 10);
}

function parseFloatSafe(str) {
  if (str == null) return null;
  const normalized = String(str).replace(/,/g, "").trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeId(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function relationshipBaseName(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/^\.\/+/, "").trim();
  if (!normalized) return null;
  return normalized.toLowerCase().endsWith(".json")
    ? normalized.slice(0, -5)
    : normalized;
}

function makeRelationshipFilename(fromPath, toPath) {
  const fromBase = relationshipBaseName(fromPath);
  const toBase = relationshipBaseName(toPath);
  if (!fromBase || !toBase) return null;
  return `relationship_${fromBase}_has_${toBase}.json`;
}

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function titleCase(str) {
  return (str || "").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const COMPANY_KEYWORDS =
  /(\b|\s)(inc\.?|l\.l\.c\.|llc|ltd\.?|foundation|alliance|solutions|corp\.?|co\.?|services|trust\b|trustee\b|trustees\b|tr\b|associates|partners|partnership|investment|investments|lp\b|llp\b|bank\b|n\.a\.|na\b|pllc\b|company|enterprises|properties|holdings|estate)(\b|\s)/i;
const SUFFIXES_IGNORE =
  /^(jr|sr|ii|iii|iv|v|vi|vii|viii|ix|x|md|phd|esq|esquire)$/i;

function isCompanyName(txt) {
  if (!txt) return false;
  return COMPANY_KEYWORDS.test(txt);
}

function tokenizeNamePart(part) {
  return cleanText(part)
    .replace(/^\*+/, "")
    .replace(/[^A-Za-z&'\-\s\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function buildPersonFromTokens(tokens, fallbackLastName) {
  if (!tokens || !tokens.length) return null;
  if (tokens.length === 1) return null;

  let last = tokens[0];
  let first = tokens[1] || null;
  let middle = tokens.length > 2 ? tokens.slice(2).join(" ") : null;

  if (
    fallbackLastName &&
    tokens.length <= 2 &&
    tokens[0] &&
    tokens[0] === tokens[0].toUpperCase() &&
    tokens[1]
  ) {
    first = tokens[0];
    middle = tokens[1] || null;
    last = fallbackLastName;
  }

  if (middle) {
    const mids = middle.split(" ").filter((t) => !SUFFIXES_IGNORE.test(t));
    middle = mids.join(" ") || null;
  }

  return {
    type: "person",
    first_name: titleCase(first || ""),
    last_name: titleCase(last || ""),
    middle_name: middle ? titleCase(middle) : null,
  };
}

function splitMultiplePersonsWithSharedLast(tokens) {
  const owners = [];
  if (!tokens || tokens.length < 4) return owners;
  const lastTok = tokens[0];
  const rem = tokens.slice(1);
  for (let i = 0; i < rem.length; ) {
    const first = rem[i];
    const possibleMiddle = rem[i + 1] || null;
    if (possibleMiddle) {
      const p = buildPersonFromTokens([lastTok, first, possibleMiddle], null);
      if (p) owners.push(p);
      i += 2;
    } else {
      const p = buildPersonFromTokens([lastTok, first], null);
      if (p) owners.push(p);
      i += 1;
    }
  }
  return owners;
}

function parseOwnersFromText(rawText) {
  const invalids = [];
  const owners = [];
  if (!rawText) return { owners, invalids };
  let text = cleanText(rawText)
    .replace(/^\*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const commaSegments = text.split(/\s*,\s*/).filter(Boolean);
  let lastSurname = null;

  const pushOwnerOrInvalid = (segment) => {
    const seg = cleanText(segment).replace(/^\*/, "").trim();
    if (!seg) return;

    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: titleCase(seg) });
      return;
    }

    const andParts = seg.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
    let localLastSurname = null;

    andParts.forEach((part, idx) => {
      const tokens = tokenizeNamePart(part);
      if (!tokens.length) return;

      if (andParts.length === 1 && tokens.length >= 4) {
        const multi = splitMultiplePersonsWithSharedLast(tokens);
        if (multi.length >= 2) {
          multi.forEach((p) => owners.push(p));
          lastSurname = tokens[0].toUpperCase();
          return;
        }
      }

      if (idx === 0) {
        localLastSurname = tokens[0];
      }

      let person = buildPersonFromTokens(
        tokens,
        idx > 0 ? localLastSurname || lastSurname : null,
      );

      if (!person && tokens.length >= 4) {
        const lastTok = tokens[0];
        const first1 = tokens[1];
        const mid1 = tokens[2];
        const rem = tokens.slice(3);
        const p1 = buildPersonFromTokens([lastTok, first1, mid1], null);
        const p2 = buildPersonFromTokens(rem, lastTok);
        if (p1 && p2) {
          owners.push(p1);
          owners.push(p2);
          if (lastTok) lastSurname = lastTok.toUpperCase();
          return;
        }
      }

      if (person) {
        owners.push(person);
        if (person.last_name) {
          lastSurname = person.last_name.toUpperCase();
        }
      } else {
        invalids.push({
          raw: part,
          reason: "ambiguous_or_incomplete_person_name",
        });
      }
    });
  };

  commaSegments.forEach((seg) => pushOwnerOrInvalid(seg));

  const seen = new Set();
  const deduped = [];
  owners.forEach((o) => {
    const key =
      o.type === "company"
        ? cleanText(o.name || "").toLowerCase()
        : [
            (o.first_name || "").toLowerCase(),
            (o.middle_name || "").toLowerCase(),
            (o.last_name || "").toLowerCase(),
          ]
            .filter(Boolean)
            .join("|");
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (o.type === "person" && (!o.middle_name || !o.middle_name.trim())) {
      o.middle_name = null;
    }
    deduped.push(o);
  });

  return { owners: deduped, invalids };
}

function mapFileDocumentType() {
  return "Title";
}

const DEED_TYPE_MAP = Object.freeze({
  WD: "Warranty Deed",
  WARRANTY_DEED: "Warranty Deed",
  WARRANTY: "Warranty Deed",
  QD: "Quitclaim Deed",
  QUIT_CLAIM_DEED: "Quitclaim Deed",
  QUITCLAIM_DEED: "Quitclaim Deed",
  SWD: "Special Warranty Deed",
  SPECIAL_WARRANTY_DEED: "Special Warranty Deed",
  PRD: "Personal Representative Deed",
  PERSONAL_REPRESENTATIVE_DEED: "Personal Representative Deed",
  TD: "Trustee's Deed",
  TRUST_DEED: "Trustee's Deed",
  TRUSTEES_DEED: "Trustee's Deed",
  SHD: "Sheriff's Deed",
  SHERIFF_DEED: "Sheriff's Deed",
  TAX: "Tax Deed",
  TAX_DEED: "Tax Deed",
  GR: "Grant Deed",
  GRANT_DEED: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  BARGAIN_AND_SALE_DEED: "Bargain and Sale Deed",
  LADY_BIRD: "Lady Bird Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TRANSFER_ON_DEATH_DEED: "Transfer on Death Deed",
  DEED_IN_LIEU: "Deed in Lieu of Foreclosure",
  DIL: "Deed in Lieu of Foreclosure",
  LIFE_ESTATE_DEED: "Life Estate Deed",
  LED: "Life Estate Deed",
});

function mapDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const normalized = instr.toUpperCase().replace(/\s+/g, "_");
  if (DEED_TYPE_MAP[normalized]) return DEED_TYPE_MAP[normalized];
  const noSpaces = instr.toUpperCase().replace(/\s+/g, "");
  if (DEED_TYPE_MAP[noSpaces]) return DEED_TYPE_MAP[noSpaces];
  return "Miscellaneous";
}

const PROPERTY_CLASS_DEFAULTS = {
  ownership_estate_type: "FeeSimple",
  build_status: "Improved",
  structure_form: null,
  property_usage_type: "Unknown",
  property_type: "Building",
};

function normalizePropertyClassName(value) {
  return value ? value.trim().replace(/\s+/g, " ").toUpperCase() : "";
}

const PROPERTY_CLASS_OVERRIDES = {
  "AFFORDABLE MULTI-FAMILY 10 OR MORE UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamily5Plus",
  },
  "AIRPORT, MARINAS, BUS TERM": {
    property_usage_type: "TransportationTerminal",
  },
  "AIRPORT/STRIP": {
    property_usage_type: "TransportationTerminal",
    property_type: "LandParcel",
  },
  "APIARY/BEES": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
  },
  "AUTO SALES": {
    property_usage_type: "AutoSalesRepair",
  },
  "BLDG & LAND SEPARATE OWNERS": {
    ownership_estate_type: "Leasehold",
  },
  "BOAT SLIPS/RACKS": {
    property_usage_type: "TransportationTerminal",
  },
  "CAMPS": {
    property_usage_type: "Recreational",
    property_type: "LandParcel",
  },
  "CHURCHES": {
    property_usage_type: "Church",
  },
  "CLUB": {
    property_usage_type: "ClubsLodges",
  },
  "COLLEGES": {
    property_usage_type: "PrivateSchool",
  },
  "COMMERCIAL": {
    property_usage_type: "Commercial",
  },
  "COMPOUNDS": {
    property_usage_type: "Residential",
  },
  "CONDO HEADER": {
    build_status: "VacantLand",
    property_usage_type: "ResidentialCommonElementsAreas",
    property_type: "LandParcel",
  },
  "CONDOMINIUM": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Residential",
    property_type: "Unit",
    structure_form: "ApartmentUnit",
  },
  "CONVEL/REST HOMES": {
    property_usage_type: "SanitariumConvalescentHome",
    structure_form: "MultiFamily5Plus",
  },
  "COOPERATIVES": {
    property_usage_type: "Residential",
    property_type: "Unit",
    structure_form: "ApartmentUnit",
  },
  "COUNTY": {
    property_usage_type: "GovernmentProperty",
  },
  "DEPT STORE": {
    property_usage_type: "DepartmentStore",
  },
  "DRIVE-IN": {
    property_usage_type: "Entertainment",
  },
  "FEDERAL": {
    property_usage_type: "GovernmentProperty",
  },
  "FINANCIAL": {
    property_usage_type: "FinancialInstitution",
  },
  "FLORIST/GREENHOUSE": {
    property_usage_type: "Ornamentals",
    property_type: "LandParcel",
  },
  "FOOD PROC": {
    property_usage_type: "Cannery",
  },
  "FOREST/PARK/REC AREA": {
    build_status: "VacantLand",
    property_usage_type: "ForestParkRecreation",
    property_type: "LandParcel",
  },
  "GOLF COURSE": {
    property_usage_type: "GolfCourse",
    property_type: "LandParcel",
  },
  "HEAVY MANUFACTURING": {
    property_usage_type: "HeavyManufacturing",
  },
  "HOMES FOR THE AGED": {
    property_usage_type: "HomesForAged",
    structure_form: "MultiFamily5Plus",
  },
  "HOSPITAL": {
    property_usage_type: "PublicHospital",
  },
  "HOTEL - B&B (11+ ROOMS)": {
    property_usage_type: "Hotel",
  },
  "HOTEL - FLAG": {
    property_usage_type: "Hotel",
  },
  "HOTEL - GUEST HOUSE (10 ROOMS OR LESS)": {
    property_usage_type: "Hotel",
  },
  "HOTEL - LUXURY": {
    property_usage_type: "Hotel",
  },
  "HOTEL - MOTEL": {
    property_usage_type: "Hotel",
  },
  "HOTEL - PRIVATE": {
    property_usage_type: "Hotel",
  },
  "HOTEL CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Hotel",
    property_type: "Unit",
  },
  "LEASEHOLD INTEREST": {
    ownership_estate_type: "Leasehold",
    property_usage_type: "Unknown",
    property_type: "LandParcel",
  },
  "LIGHT MANUFACTURING": {
    property_usage_type: "LightManufacturing",
  },
  "LUMBER YARD": {
    property_usage_type: "LumberYard",
  },
  "MILITARY": {
    property_usage_type: "GovernmentProperty",
  },
  "MINERAL PR": {
    property_usage_type: "MineralProcessing",
    property_type: "LandParcel",
  },
  "MINING": {
    property_usage_type: "MineralProcessing",
    property_type: "LandParcel",
  },
  "MIXED USE CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Residential",
    property_type: "Unit",
  },
  "MIXED USE RETAIL/AFFORDABLE": {
    property_usage_type: "ShoppingCenterCommunity",
  },
  "MOBILE HOME SUB": {
    property_usage_type: "Residential",
    property_type: "LandParcel",
  },
  "MOBILE HOME/TRAILER": {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "ManufacturedHousing",
  },
  "MORTUARY": {
    property_usage_type: "MortuaryCemetery",
    property_type: "LandParcel",
  },
  "MULTI FAMILY 10 OR MORE UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamily5Plus",
  },
  "MULTI FAMILY LESS THAN 10 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY 5 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY 6 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY 7 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY 8 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY 9 UNITS": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY DUPLEX": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY FOURPLEX": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTI-FAMILY TRIPLEX": {
    property_usage_type: "Residential",
    structure_form: "MultiFamilyLessThan10",
  },
  "MULTISTORY": {
    property_usage_type: "OfficeBuilding",
  },
  "MUNICIPAL": {
    property_usage_type: "GovernmentProperty",
  },
  "NIGHTCLUB": {
    property_usage_type: "Entertainment",
  },
  "NON AGRICULTURE": {
    build_status: "VacantLand",
    property_usage_type: "TransitionalProperty",
    property_type: "LandParcel",
  },
  "NOTE": {
    build_status: "VacantLand",
    property_usage_type: "ReferenceParcel",
    property_type: "LandParcel",
  },
  "OFFICE CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "OfficeBuilding",
    property_type: "Unit",
  },
  "ONE STORY OFFICE": {
    property_usage_type: "OfficeBuilding",
  },
  "OPEN STORAGE": {
    property_usage_type: "OpenStorage",
    property_type: "LandParcel",
  },
  "PACKING": {
    property_usage_type: "PackingPlant",
  },
  "PARKING LOT": {
    property_usage_type: "Commercial",
    property_type: "LandParcel",
  },
  "PRIVATE HOSPITAL": {
    property_usage_type: "PrivateHospital",
  },
  "PRIVATE SCHOOL": {
    property_usage_type: "PrivateSchool",
  },
  "PROF. BLDG": {
    property_usage_type: "OfficeBuilding",
  },
  "PROFESSIONAL BLDG CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "OfficeBuilding",
    property_type: "Unit",
  },
  "PUBLIC SCHOOLS": {
    property_usage_type: "PublicSchool",
  },
  "RACE TRACK": {
    property_usage_type: "RaceTrack",
  },
  "RES WATERFRONT": {
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  },
  "RESIDENTIAL COMMON ELEMENTS": {
    build_status: "VacantLand",
    property_usage_type: "ResidentialCommonElementsAreas",
    property_type: "LandParcel",
  },
  "RESTAURANT": {
    property_usage_type: "Restaurant",
  },
  "RESTAURANT CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Restaurant",
    property_type: "Unit",
  },
  "RETAIL-BIG BOX LARGE->20K SF": {
    property_usage_type: "RetailStore",
  },
  "RETAIL-BIG BOX-10K SF TO 20K SF": {
    property_usage_type: "RetailStore",
  },
  "RETAIL-BIG BOX-SMALL-<10K SF": {
    property_usage_type: "RetailStore",
  },
  "RETAIL-CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "RetailStore",
    property_type: "Unit",
  },
  "RETAIL-CONVENIENCE STORE": {
    property_usage_type: "RetailStore",
  },
  "RETAIL-DRUG STORE": {
    property_usage_type: "RetailStore",
  },
  "RETAIL-MULTI TENANT": {
    property_usage_type: "ShoppingCenterCommunity",
  },
  "RETAIL-SINGLE TENANT": {
    property_usage_type: "RetailStore",
  },
  "RIGHT OF WAY": {
    ownership_estate_type: "RightOfWay",
    build_status: "VacantLand",
    property_usage_type: "ReferenceParcel",
    property_type: "LandParcel",
  },
  "RV PARK": {
    property_usage_type: "Recreational",
    property_type: "LandParcel",
  },
  "SERVICE SHOPS": {
    property_usage_type: "Commercial",
  },
  "SERVICE STATION": {
    property_usage_type: "ServiceStation",
  },
  "SHOPPING CENTER": {
    property_usage_type: "ShoppingCenterCommunity",
  },
  "SINGLE FAMILY RESID": {
    property_usage_type: "Residential",
    structure_form: "SingleFamilyDetached",
  },
  "STATE": {
    property_usage_type: "GovernmentProperty",
  },
  "STORE COMBO": {
    property_usage_type: "RetailStore",
  },
  "SUBMERGED": {
    build_status: "VacantLand",
    property_usage_type: "RiversLakes",
    property_type: "LandParcel",
  },
  "SUBSURFACE RIGHTS": {
    ownership_estate_type: "SubsurfaceRights",
    build_status: "VacantLand",
    property_usage_type: "ReferenceParcel",
    property_type: "LandParcel",
  },
  "SUPER MARKET": {
    property_usage_type: "Supermarket",
  },
  "THEATRE": {
    property_usage_type: "Theater",
  },
  "TIMESHARE": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Residential",
    property_type: "Unit",
    structure_form: "ApartmentUnit",
  },
  "TOURIST ATTRACTION": {
    property_usage_type: "Entertainment",
  },
  "UTILITY": {
    property_usage_type: "Utility",
  },
  "VACANT EXEMPT": {
    build_status: "VacantLand",
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
  },
  "VACANT INDUSTRIAL": {
    build_status: "VacantLand",
    property_usage_type: "Industrial",
    property_type: "LandParcel",
  },
  "VACANT INSTITUTIONAL": {
    build_status: "VacantLand",
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
  },
  "VACANT RES": {
    build_status: "VacantLand",
    property_usage_type: "Residential",
    property_type: "LandParcel",
  },
  "WAREHOUSE": {
    property_usage_type: "Warehouse",
  },
  "WAREHOUSE CONDO": {
    ownership_estate_type: "Condominium",
    property_usage_type: "Warehouse",
    property_type: "Unit",
  },
  "WASTELAND": {
    build_status: "VacantLand",
    property_usage_type: "Conservation",
    property_type: "LandParcel",
  },
};

const PROPERTY_CLASS_NAMES = [
  "AFFORDABLE MULTI-FAMILY 10 OR MORE UNITS",
  "AIRPORT, MARINAS, BUS TERM",
  "AIRPORT/STRIP",
  "APIARY/BEES",
  "AUTO SALES",
  "BLDG & LAND SEPARATE OWNERS",
  "BOAT SLIPS/RACKS",
  "CAMPS",
  "CHURCHES",
  "CLUB",
  "COLLEGES",
  "COMMERCIAL",
  "COMPOUNDS",
  "CONDO HEADER",
  "CONDOMINIUM",
  "CONVEL/REST HOMES",
  "COOPERATIVES",
  "COUNTY",
  "DEPT STORE",
  "DRIVE-IN",
  "FEDERAL",
  "FINANCIAL",
  "FLORIST/GREENHOUSE",
  "FOOD PROC",
  "FOREST/PARK/REC AREA",
  "GOLF COURSE",
  "HEAVY MANUFACTURING",
  "HOMES FOR THE AGED",
  "HOSPITAL",
  "HOTEL - B&B (11+ ROOMS)",
  "HOTEL - FLAG",
  "HOTEL - GUEST HOUSE (10 ROOMS OR LESS)",
  "HOTEL - LUXURY",
  "HOTEL - MOTEL",
  "HOTEL - PRIVATE",
  "HOTEL CONDO",
  "LEASEHOLD INTEREST",
  "LIGHT MANUFACTURING",
  "LUMBER YARD",
  "MILITARY",
  "MINERAL PR",
  "MINING",
  "MIXED USE CONDO",
  "MIXED USE RETAIL/AFFORDABLE",
  "MOBILE HOME SUB",
  "MOBILE HOME/TRAILER",
  "MORTUARY",
  "MULTI FAMILY 10 OR MORE UNITS",
  "MULTI FAMILY LESS THAN 10 UNITS",
  "MULTI-FAMILY 5 UNITS",
  "MULTI-FAMILY 6 UNITS",
  "MULTI-FAMILY 7 UNITS",
  "MULTI-FAMILY 8 UNITS",
  "MULTI-FAMILY 9 UNITS",
  "MULTI-FAMILY DUPLEX",
  "MULTI-FAMILY FOURPLEX",
  "MULTI-FAMILY TRIPLEX",
  "MULTISTORY",
  "MUNICIPAL",
  "NIGHTCLUB",
  "NON AGRICULTURE",
  "NOTE",
  "OFFICE CONDO",
  "ONE STORY OFFICE",
  "OPEN STORAGE",
  "PACKING",
  "PARKING LOT",
  "PRIVATE HOSPITAL",
  "PRIVATE SCHOOL",
  "PROF. BLDG",
  "PROFESSIONAL BLDG CONDO",
  "PUBLIC SCHOOLS",
  "RACE TRACK",
  "RES WATERFRONT",
  "RESIDENTIAL COMMON ELEMENTS",
  "RESTAURANT",
  "RESTAURANT CONDO",
  "RETAIL-BIG BOX LARGE->20K SF",
  "RETAIL-BIG BOX-10K SF TO 20K SF",
  "RETAIL-BIG BOX-SMALL-<10K SF",
  "RETAIL-CONDO",
  "RETAIL-CONVENIENCE STORE",
  "RETAIL-DRUG STORE",
  "RETAIL-MULTI TENANT",
  "RETAIL-SINGLE TENANT",
  "RIGHT OF WAY",
  "RV PARK",
  "SERVICE SHOPS",
  "SERVICE STATION",
  "SHOPPING CENTER",
  "SINGLE FAMILY RESID",
  "STATE",
  "STORE COMBO",
  "SUBMERGED",
  "SUBSURFACE RIGHTS",
  "SUPER MARKET",
  "THEATRE",
  "TIMESHARE",
  "TOURIST ATTRACTION",
  "UTILITY",
  "VACANT EXEMPT",
  "VACANT INDUSTRIAL",
  "VACANT INSTITUTIONAL",
  "VACANT RES",
  "WAREHOUSE",
  "WAREHOUSE CONDO",
  "WASTELAND",
];

const PROPERTY_CLASS_MAP = Object.create(null);
for (const [name, overrides] of Object.entries(PROPERTY_CLASS_OVERRIDES)) {
  const key = normalizePropertyClassName(name);
  PROPERTY_CLASS_MAP[key] = {
    ...PROPERTY_CLASS_DEFAULTS,
    ...overrides,
  };
}

(function validatePropertyClassMappings() {
  const missing = PROPERTY_CLASS_NAMES.filter((name) => {
    const key = normalizePropertyClassName(name);
    return !Object.prototype.hasOwnProperty.call(PROPERTY_CLASS_MAP, key);
  });
  if (missing.length) {
    throw new Error(
      `Missing property class mappings for: ${missing.join(", ")}`,
    );
  }
})();

function textOf($, el) {
  return $(el).text().trim();
}

const SUMMARY_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary";
const LAND_TABLE_SELECTOR = "#ctlBodyPane_ctl06_ctl01_gvwList";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl04_ctl01_grdValuation";

function findRowValueByTh($, moduleSelector, thTextStartsWith) {
  const rows = $(`${moduleSelector} table.tabular-data-two-column tbody tr`);
  for (let i = 0; i < rows.length; i++) {
    const th = $(rows[i]).find("th strong").first();
    const thTxt = textOf($, th);
    if (
      thTxt &&
      thTxt.toLowerCase().startsWith(thTextStartsWith.toLowerCase())
    ) {
      const valSpan = $(rows[i]).find("td div span").first();
      return textOf($, valSpan) || null;
    }
  }
  return null;
}

function getSummaryValue($, labelStartsWith) {
  return findRowValueByTh($, SUMMARY_SELECTOR, labelStartsWith);
}

function stripKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return obj;
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      delete obj[key];
    }
  });
  return obj;
}

function parseLocationAddressFromHTML($) {
  const raw = getSummaryValue($, "Location Address");
  if (!raw) {
    return { addrLine1: null, addrLine2: null };
  }
  const parts = String(raw)
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const addrLine1 = parts.length ? parts[0] : null;
  const addrLine2 =
    parts.length > 1 ? parts.slice(1).join(", ") || null : null;
  return { addrLine1, addrLine2 };
}

function parseOwnerMailingAddresses($) {
  const rawAddresses = [];
  const uniqueAddresses = [];
  const seen = new Set();

  $("span[id$='lblCityStateZip']").each((_, el) => {
    const id = (el.attribs && el.attribs.id) || "";
    if (!id) return;
    const base = id.replace(/lblCityStateZip$/i, "");
    const street1 = cleanText($(`#${base}lblAddress1`).text());
    const street2 = cleanText($(`#${base}lblAddress2`).text());
    const cityStateZip = cleanText($(el).text());
    const parts = [street1, street2, cityStateZip].filter(Boolean);
    if (!parts.length) return;
    const combined = parts.join(", ");
    rawAddresses.push(combined);
    if (!seen.has(combined)) {
      seen.add(combined);
      uniqueAddresses.push(combined);
    }
  });

  if (!rawAddresses.length) {
    $("span[id$='lblOwnerAddress']").each((_, el) => {
      const text = $(el).text();
      if (!text) return;
      const parts = text
        .split(/\n/)
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (!parts.length) return;
      const combined = parts.join(", ");
      rawAddresses.push(combined);
      if (!seen.has(combined)) {
        seen.add(combined);
        uniqueAddresses.push(combined);
      }
    });
  }

  return { rawAddresses, uniqueAddresses };
}

function parseStreetLine(line) {
  // Parses a line like "20346 NW 262ND AVE" or "22982 NW COUNTY RD 236"
  let street_number = null,
    street_pre_directional_text = null,
    street_name = null,
    street_suffix_type = null;

  // Helper function to capitalize street suffix (first letter uppercase, rest lowercase)
  const capitalizeSuffix = (suffix) => {
    if (!suffix) return null;
    const cleaned = suffix.replace(".", "").replace(/\,/, "").replace(/\s+/g, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  if (line) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      street_number = parts[0];
      let startIdx = 1;

      // Check for directional prefix
      const dirToken = parts[1].toUpperCase();
      const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
      if (dirs.has(dirToken)) {
        street_pre_directional_text = dirToken;
        startIdx = 2;
      }

      // Check for special road types that include numbers (e.g., "COUNTY RD 236", "STATE ROAD 100")
      const remainingParts = parts.slice(startIdx);
      const joinedRemaining = remainingParts.join(" ").toUpperCase();

      // Pattern for County Road, State Road, Highway, etc. followed by a number
      if (joinedRemaining.match(/^(COUNTY\s+(RD|ROAD)|STATE\s+(RD|ROAD)|HIGHWAY|HWY|US|SR|CR)\s+\d+/i)) {
        // This is a special case - the entire thing is the street name, no suffix
        street_name = remainingParts.join(" ");
        street_suffix_type = null;
      } else if (remainingParts.length > 0) {
        // Standard parsing - last part is suffix
        const lastPart = remainingParts[remainingParts.length - 1];
        // Check if last part looks like a typical street suffix
        const suffixes = new Set(["ST", "STREET", "AVE", "AVENUE", "RD", "ROAD", "DR", "DRIVE",
                                 "CT", "COURT", "PL", "PLACE", "LN", "LANE", "BLVD", "BOULEVARD",
                                 "WAY", "TER", "TERRACE", "CIR", "CIRCLE", "TRL", "TRAIL", "PKWY", "PARKWAY"]);

        if (suffixes.has(lastPart.toUpperCase().replace(".", ""))) {
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        } else if (!isNaN(lastPart)) {
          // If last part is a number, it's likely part of the street name
          street_name = remainingParts.join(" ");
          street_suffix_type = null;
        } else {
          // Default behavior - treat last part as suffix
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        }
      }
    }
  }
  return {
    street_number,
    street_pre_directional_text,
    street_name,
    street_suffix_type,
  };
}

function parseCityStateZip(line) {
  // HIGH SPRINGS, FL 32643
  if (!line) return { city_name: null, state_code: null, postal_code: null };
  const m = line.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) {
    return {
      city_name: m[1].trim().toUpperCase(),
      state_code: m[2],
      postal_code: m[3],
    };
  }
  return { city_name: null, state_code: null, postal_code: null };
}

function parseSecTwpRng($) {
  const secTwpRng = getSummaryValue($, "Sec/Twp/Rng");
  if (!secTwpRng) return { section: null, township: null, range: null };
  const parts = secTwpRng.split("-").map((s) => s.trim());
  return {
    section: parts[0] || null,
    township: parts[1] || null,
    range: parts[2] || null,
  };
}

function parseAcres($) {
  const acresStr =
    getSummaryValue($, "Acreage") || getSummaryValue($, "Acres");
  if (!acresStr) return null;
  const acres = parseFloatSafe(acresStr);
  return Number.isFinite(acres) ? acres : null;
}

function parsePropertyUseCode($) {
  const candidates = [
    "Property Use Code",
    "Property Use",
    "Property Class",
  ];
  for (const label of candidates) {
    const value = getSummaryValue($, label);
    if (value) return value;
  }
  return null;
}

function mapPropertyUseCode(rawValue) {
  const defaults = PROPERTY_CLASS_DEFAULTS;
  if (!rawValue) {
    return {
      class_name: null,
      code: null,
      description: null,
      ...defaults,
    };
  }
  const match = rawValue.match(/\((\d{4,5})\)/);
  const rawCode = match ? match[1] : null;
  const code = rawCode ? rawCode.padStart(5, "0") : null;
  const description = rawValue
    .replace(/\(\d{4,5}\)\s*$/, "")
    .trim() || null;
  const normalizedDescription = normalizePropertyClassName(description);
  const mapping =
    (normalizedDescription && PROPERTY_CLASS_MAP[normalizedDescription]) ||
    { ...defaults };
  return {
    class_name: description,
    code,
    description,
    ...mapping,
  };
}

function parseZoning($) {
  const zones = [];
  $(`${LAND_TABLE_SELECTOR} tbody tr`).each((_, tr) => {
    const landUse = textOf($, $(tr).find("th").first());
    if (landUse && !zones.includes(landUse)) {
      zones.push(landUse);
    }
  });
  return zones.length ? zones[0] : null;
}

function parseBuildingInfo($) {
  const leftContainer = $(
    "div[id$='dynamicBuildingDataLeftColumn_divSummary']",
  ).first();
  const rightContainer = $(
    "div[id$='dynamicBuildingDataRightColumn_divSummary']",
  ).first();

  const empty = () => ({
    type: null,
    totalArea: null,
    heatedArea: null,
    exteriorWalls: null,
    interiorWalls: null,
    roofing: null,
    roofType: null,
    floorCover: null,
    heat: null,
    hvac: null,
    stories: null,
    actYear: null,
    effYear: null,
    bathrooms: null,
    bedrooms: null,
  });

  if (!leftContainer.length || !rightContainer.length) {
    return empty();
  }

  const buildMap = ($container) => {
    const map = {};
    $container.find("tr").each((_, tr) => {
      const label = textOf($, $(tr).find("th strong").first());
      if (!label) return;
      const value =
        textOf($, $(tr).find("td div span").first()) ||
        textOf($, $(tr).find("td span").first()) ||
        textOf($, $(tr).find("td").first());
      if (value) {
        map[label.toLowerCase()] = value;
      }
    });
    return map;
  };

  const leftMap = buildMap(leftContainer);
  const rightMap = buildMap(rightContainer);

  const getValue = (map, labels) => {
    for (const label of labels) {
      const key = label.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        const val = map[key];
        if (val != null && String(val).trim() !== "") {
          return val;
        }
      }
    }
    return null;
  };

  const rawFullBaths = getValue(rightMap, [
    "full bathrooms",
    "full baths",
    "bathrooms",
  ]);
  const rawHalfBaths = getValue(rightMap, ["half bathrooms", "half baths"]);
  let bathrooms = getValue(rightMap, ["bathrooms"]);
  if (!bathrooms && (rawFullBaths || rawHalfBaths)) {
    const fullCount = parseIntSafe(rawFullBaths);
    const halfCount = parseIntSafe(rawHalfBaths);
    if (fullCount != null || halfCount != null) {
      const total = (fullCount || 0) + (halfCount || 0) * 0.5;
      if (Number.isFinite(total) && total > 0) {
        bathrooms = String(total);
      } else if (fullCount != null) {
        bathrooms = String(fullCount);
      }
    }
  }

  const hvac =
    getValue(rightMap, ["hvac", "cooling type", "cooling", "air conditioning"]) ||
    getValue(leftMap, ["air conditioning"]);

  return {
    type:
      getValue(leftMap, ["building type", "type", "style"]) ||
      getValue(rightMap, ["building type"]) ||
      null,
    totalArea:
      getValue(leftMap, ["total area", "gross sq ft", "gross square feet"]) ||
      null,
    heatedArea:
      getValue(leftMap, [
        "heated area",
        "finished sq ft",
        "living area",
        "heated square feet",
      ]) || null,
    exteriorWalls: getValue(rightMap, ["exterior walls"]) || null,
    interiorWalls: getValue(leftMap, ["interior walls"]) || null,
    roofing:
      getValue(rightMap, ["roofing", "roof coverage"]) ||
      getValue(leftMap, ["roofing"]) ||
      null,
    roofType: getValue(rightMap, ["roof type"]) || null,
    floorCover:
      getValue(rightMap, ["floor cover", "flooring type"]) ||
      getValue(leftMap, ["floor cover"]) ||
      null,
    heat:
      getValue(rightMap, ["heat", "heating", "heating type"]) ||
      getValue(leftMap, ["heat"]) ||
      null,
    hvac,
    stories: getValue(leftMap, ["stories"]) || null,
    actYear:
      getValue(rightMap, ["actual year built", "year built"]) ||
      getValue(leftMap, ["year built"]) ||
      null,
    effYear:
      getValue(rightMap, ["effective year built", "effectiveyearbuilt"]) ||
      getValue(leftMap, ["effective year built"]) ||
      null,
    bathrooms,
    bedrooms:
      getValue(rightMap, ["bedrooms"]) ||
      getValue(leftMap, ["bedrooms"]) ||
      null,
  };
}

function extractValuationTableData($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (!table.length) return null;

  const years = [];
  table.find("thead th.value-column").each((_, th) => {
    const year = parseIntSafe($(th).text());
    if (year) years.push(year);
  });

  const rows = {};
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    if ($tr.hasClass("footable-detail-row")) return;
    const label = textOf($, $tr.find("th").first());
    if (!label) return;
    const values = [];
    $tr.find("td.value-column").each((__, td) => {
      values.push(textOf($, td));
    });
    if (values.length) {
      rows[label] = values;
    }
  });

  if (!years.length || !Object.keys(rows).length) {
    return null;
  }
  return { years, rows };
}

function findValuationRow(rowMap, labelOptions) {
  const entries = Object.entries(rowMap);
  for (const option of labelOptions) {
    const target = option.toLowerCase();
    for (const [label, values] of entries) {
      const normalized = label.toLowerCase();
      if (
        normalized === target ||
        normalized.startsWith(target) ||
        target.startsWith(normalized)
      ) {
        return values;
      }
    }
  }
  return null;
}

function findSectionByTitle($, title) {
  const target = title ? String(title).toLowerCase() : null;
  if (!target) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = cleanText(
      $section.find("> header .title, > header div.title").first().text(),
    );
    if (headerTitle && headerTitle.toLowerCase() === target) {
      found = $section;
    }
  });
  return found;
}

function mapPermitImprovementType(typeText) {
  const txt = (typeText || "").toUpperCase();
  if (!txt) return null;
  if (txt.includes("ROOF")) return "Roofing";
  if (txt.includes("POOL")) return "PoolSpaInstallation";
  if (txt.includes("SCREEN")) return "ScreenEnclosure";
  if (txt.includes("FENCE")) return "Fencing";
  if (txt.includes("REMODEL") || txt.includes("RENOV")) {
    return "GeneralBuilding";
  }
  if (txt.includes("WINDOW") || txt.includes("DOOR")) return "ExteriorOpeningsAndFinishes";
  if (txt.includes("HVAC") || txt.includes("A/C") || txt.includes("AIR")) {
    return "MechanicalHVAC";
  }
  if (txt.includes("ELECTR")) return "Electrical";
  if (txt.includes("PLUMB")) return "Plumbing";
  if (txt.includes("PAVE")) return "SiteDevelopment";
  if (txt.includes("DOCK") || txt.includes("SHORE")) return "DockAndShore";
  if (txt.includes("DECK")) return "BuildingAddition";
  if (txt.includes("SIGN")) return "GeneralBuilding";
  if (txt.includes("DEMOL")) return "Demolition";
  if (txt.includes("IRRIG")) return "LandscapeIrrigation";
  if (txt.includes("SOLAR")) return "Solar";
  return "GeneralBuilding";
}

function mapPermitImprovementStatus(activeText) {
  const normalized = (activeText || "").trim().toLowerCase();
  if (!normalized) return "Planned";
  if (normalized === "yes" || normalized === "y") return "InProgress";
  if (normalized === "no" || normalized === "n") return "Completed";
  if (normalized.includes("hold")) return "OnHold";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("pending") || normalized.includes("plan")) {
    return "Planned";
  }
  if (normalized.includes("permit")) return "Permitted";
  return "Planned";
}

function mapPermitImprovementAction(typeText) {
  const txt = (typeText || "").toUpperCase();
  if (!txt) return null;
  if (txt.includes("NEW")) return "New";
  if (txt.includes("RE-") || txt.includes("REPLACE") || txt.includes("REROOF")) {
    return "Replacement";
  }
  if (txt.includes("REPAIR")) return "Repair";
  if (txt.includes("ALTER")) return "Alteration";
  if (txt.includes("ADD")) return "Addition";
  if (txt.includes("REMOVE") || txt.includes("DEMOL")) return "Remove";
  return "Other";
}

function mapPermitContractorType(primaryText) {
  const txt = (primaryText || "").toLowerCase();
  if (!txt) return "Unknown";
  if (txt.includes("owner")) return "DIY";
  if (txt.includes("contractor") || txt.includes("builder")) {
    return "GeneralContractor";
  }
  if (
    txt.includes("electric") ||
    txt.includes("hvac") ||
    txt.includes("plumb") ||
    txt.includes("roof") ||
    txt.includes("pool")
  ) {
    return "Specialist";
  }
  if (txt.includes("manager")) return "PropertyManager";
  return "Unknown";
}

function parsePermitTable($) {
  const section = findSectionByTitle($, "Permits");
  if (!section) return [];
  let table = section.find("table[id*='grdPermit']").first();
  if (!table || !table.length) {
    table = section.find("table").first();
  }
  if (!table || !table.length) return [];

  const rows = [];
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const permitNumber = cleanText($tr.find("th").first().text());
    const cells = [];
    $tr.find("td").each((idx, td) => {
      cells.push(cleanText($(td).text()));
    });
    const hasContent =
      permitNumber ||
      cells.some((val) => val && val.length > 0);
    if (!hasContent) return;
    rows.push({
      permitNumber: permitNumber || null,
      issueDate: cells[0] || null,
      active: cells[1] || null,
      value: cells[2] || null,
      type: cells[3] || null,
      primary: cells[4] || null,
    });
  });
  return rows;
}

function parseSales($) {
  let salesTable = null;
  $("section").each((_, section) => {
    if (salesTable) return;
    const title = $(section).find("div.title").first().text().trim().toLowerCase();
    if (title === "sales") {
      const candidate = $(section).find("table").first();
      if (candidate && candidate.length) {
        salesTable = candidate;
      }
    }
  });
  if (!salesTable || !salesTable.length) return [];

  const rows = salesTable.find("tbody tr");
  const sales = [];
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    const header = $tr.find("th").first();
    const date = textOf($, header);
    if (!tds || !tds.length) return;
    const priceStr = textOf($, tds.eq(0));
    const instr = textOf($, tds.eq(1));
    const instrumentCell = tds.eq(2);
    let instrumentNumberText = textOf($, instrumentCell);
    if (!instrumentNumberText) {
      instrumentNumberText = cleanText(instrumentCell.find("span").text());
    }
    const book = cleanText(textOf($, tds.eq(3)) || "");
    const page = cleanText(textOf($, tds.eq(4)) || "");
    const qualification = textOf($, tds.eq(5));
    const vacantImproved = textOf($, tds.eq(6));
    const grantor = textOf($, tds.eq(7));
    const grantee = textOf($, tds.eq(8));
    let clerkUrl = null;
    const linkTd = tds.length > 9 ? tds.eq(9) : null;
    if (linkTd && linkTd.find("input").length) {
      const onclick = linkTd.find("input").attr("onclick") || "";
      const m = onclick.match(/window\.open\('([^']+)'\)/);
      if (m) clerkUrl = m[1];
    }
    let instrumentNumber = null;
    if (clerkUrl) {
      const docMatch = clerkUrl.match(/[?&](?:docid|instrument|inst|instrumentnumber)=(\d+)/i);
      if (docMatch) {
        instrumentNumber = docMatch[1];
      }
    }

    if (date && priceStr) {
      sales.push({
        date,
        price: moneyToNumber(priceStr),
        instrument: instr || null,
        book: book || null,
        page: page || null,
        qualification: qualification || null,
        vacantImproved: vacantImproved || null,
        grantor: grantor || null,
        grantee: grantee || null,
        clerkUrl: clerkUrl || null,
        instrumentNumber:
          instrumentNumber || instrumentNumberText || null,
      });
    }
  });
  return sales;
}

function parseValuationsWorking($) {
  const valuation = extractValuationTableData($);
  if (!valuation) return null;
  const { years, rows } = valuation;
  if (!years.length) return null;

  const getValue = (labels) => {
    const row = findValuationRow(rows, labels);
    if (!row || !row.length) return null;
    return moneyToNumber(row[0]) || null;
  };

  return {
    year: years[0],
    improvement: getValue([
      "Market Improvement Value",
      "Improvement Value",
      "Building Value",
    ]),
    land: getValue(["Market Land Value", "Land Value"]),
    justMarket: getValue([
      "Just Market Value",
      "Just (Market) Value",
      "Total Market Value",
    ]),
    assessed: getValue([
      "Total Assessed Value",
      "Assessed Value",
      "School Assessed Value",
      "Non School Assessed Value",
    ]),
    taxable: getValue([
      "School Taxable Value",
      "Total Taxable Value",
      "Non School Taxable Value",
      "Taxable Value",
    ]),
  };
}

function parseValuationsCertified($) {
  const valuation = extractValuationTableData($);
  if (!valuation) return [];
  const { years, rows } = valuation;
  if (!years.length) return [];

  const improvementRow = findValuationRow(rows, [
    "Market Improvement Value",
    "Improvement Value",
    "Building Value",
  ]);
  const landRow = findValuationRow(rows, ["Market Land Value", "Land Value"]);
  const justRow = findValuationRow(rows, [
    "Just Market Value",
    "Just (Market) Value",
    "Total Market Value",
  ]);
  const assessedRow = findValuationRow(rows, [
    "Total Assessed Value",
    "Assessed Value",
    "School Assessed Value",
    "Non School Assessed Value",
  ]);
  const taxableRow = findValuationRow(rows, [
    "School Taxable Value",
    "Total Taxable Value",
    "Non School Taxable Value",
    "Taxable Value",
  ]);

  return years.map((year, idx) => ({
    year,
    improvement: improvementRow
      ? moneyToNumber(improvementRow[idx])
      : null,
    land: landRow ? moneyToNumber(landRow[idx]) : null,
    justMarket: justRow ? moneyToNumber(justRow[idx]) : null,
    assessed: assessedRow ? moneyToNumber(assessedRow[idx]) : null,
    taxable: taxableRow ? moneyToNumber(taxableRow[idx]) : null,
  }));
}

function toISOFromMDY(mdy) {
  if (!mdy) return null;
  const m = mdy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Exterior Wall Material mapping
function mapExteriorWallMaterial(material) {
  if (!material) return null;

  const exteriorWallMap = {
    "ABOVE AVERAGE": "Wood Siding",
    "ALUMINUM SIDNG": "Metal Siding",
    "ASBESTOS": "Fiber Cement Siding",
    "AVERAGE": "Wood Siding",
    "BD AND BAT AAV": "Wood Siding",
    "BELOW AVERAGE": "Wood Siding",
    "BOARD & BATTEN": "Wood Siding",
    "CB STUCCO": "Stucco",
    "CEDAR/REDWOOD": "Wood Siding",
    "CEMENT BRICK": "Brick",
    "COMMON BRICK": "Brick",
    "CONCRETE BLOCK": "Concrete Block",
    "CORR ASBESTOS": "Fiber Cement Siding",
    "CORR METAL": "Metal Siding",
    "FACE BRICK": "Brick",
    "GLASS/THERMO.": "Curtain Wall",
    "HARDIBOARD": "Fiber Cement Siding",
    "MINIMUM": "Wood Siding",
    "MODULAR METAL": "Metal Siding",
    "N/A": "Wood Siding",
    "NONE": "Wood Siding",
    "PRECAST PANEL": "Precast Concrete",
    "PRE-FAB PANEL": "Precast Concrete",
    "PRE-FINSH METL": "Metal Siding",
    "REINF CONCRETE": "Precast Concrete",
    "SINGLE SIDING": "Wood Siding",
    "STONE": "Natural Stone",
    "TILE/WD STUCCO": "Stucco",
    "WALL BOARD": "EIFS",
    "WOOD SHEATH": "Wood Siding",
    "WOOD SHINGLE": "Wood Siding"
  };

  const upperMaterial = material.toUpperCase();
  return exteriorWallMap[upperMaterial] || null;
}

function normalizeOwner(owner, ownersByDate) {
  try {
    const current = ownersByDate && ownersByDate.current;
    if (!current || !Array.isArray(current)) return owner;
    const matches = current.filter(
      (c) =>
        c.type === "person" &&
        c.last_name &&
        owner.last_name &&
        c.last_name.toLowerCase() === owner.last_name.toLowerCase(),
    );
    for (const c of matches) {
      if (!owner.first_name) continue;
      if (
        c.first_name &&
        c.first_name.toLowerCase().startsWith(owner.first_name.toLowerCase())
      ) {
        return {
          ...owner,
          first_name: c.first_name || owner.first_name,
          middle_name:
            c.middle_name != null ? c.middle_name : owner.middle_name,
        };
      }
    }
  } catch {}
  return owner;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = readText("input.html");
  const $ = cheerio.load(html);

  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");
  const defaultSourceHttpRequest =
    (unaddr && unaddr.source_http_request) ||
    (seed && seed.source_http_request) || {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/Application.aspx",
    };

  let ownersData = null,
    utilsData = null,
    layoutData = null,
    structureData = null;
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch {}
  try {
    utilsData = readJSON(path.join("owners", "utilities_data.json"));
  } catch {}
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch {}
  try {
    structureData = readJSON(path.join("owners", "structure_data.json"));
  } catch {}

  const parcelIdHtml = normalizeId(getSummaryValue($, "Parcel ID"));
  const propIdHtml = normalizeId(getSummaryValue($, "Property ID"));
  const accountIdHtml = normalizeId(getSummaryValue($, "Account"));

  const parcelId =
    parcelIdHtml ||
    normalizeId(seed && seed.parcel_id) ||
    null;
  const propId =
    propIdHtml ||
    accountIdHtml ||
    normalizeId(seed && (seed.prop_id || seed.property_id || seed.parcel_id)) ||
    null;
  const propIdNumeric = propId != null ? parseIntSafe(propId) : null;
  const parcelIdNumeric = parcelId != null ? parseIntSafe(parcelId) : null;

  const candidateIdSet = new Set();
  const propertyIdCandidates = [];
  const addCandidateId = (value) => {
    const normalized = normalizeId(value);
    if (!normalized) return;
    if (candidateIdSet.has(normalized)) return;
    candidateIdSet.add(normalized);
    propertyIdCandidates.push(normalized);
  };
  addCandidateId(propId);
  if (propIdNumeric != null) addCandidateId(String(propIdNumeric));
  addCandidateId(parcelId);
  if (parcelIdNumeric != null) addCandidateId(String(parcelIdNumeric));
  if (seed) {
    addCandidateId(seed.parcel_id);
    addCandidateId(seed.request_identifier);
    addCandidateId(seed.parcel_identifier);
  }

  const resolvePropertyEntry = (dataObj) => {
    if (!dataObj) return null;
    for (const id of propertyIdCandidates) {
      const key = `property_${id}`;
      if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
        return dataObj[key];
      }
    }
    return null;
  };

  const ownersEntry = resolvePropertyEntry(ownersData);
  const utilitiesEntry = resolvePropertyEntry(utilsData);
  const layoutEntry = resolvePropertyEntry(layoutData);
  const structureEntry = resolvePropertyEntry(structureData);
  const binfo = parseBuildingInfo($);
  const legalDesc = getSummaryValue($, "Legal Description") || null;
  const subdivision = getSummaryValue($, "Subdivision") || null;
  const zoning = parseZoning($);
  const acres = parseAcres($);
  const propertyUseRaw = parsePropertyUseCode($);
  const propertyUse = mapPropertyUseCode(propertyUseRaw);
  const requestIdentifier =
    (unaddr && unaddr.request_identifier) ||
    (seed && seed.request_identifier) ||
    parcelId ||
    null;

  let personIndex = 0;
  let companyIndex = 0;
  const personLookup = new Map();
  const companyLookup = new Map();

  function createPersonRecord(personData) {
    if (!personData) return null;
    const firstName =
      personData.first_name != null
        ? String(personData.first_name).trim()
        : "";
    const lastName =
      personData.last_name != null ? String(personData.last_name).trim() : "";
    const middleRaw =
      personData.middle_name != null
        ? String(personData.middle_name).trim()
        : "";
    const middleName = middleRaw ? middleRaw : null;
    const key =
      firstName || lastName
        ? `${firstName.toLowerCase()}|${middleRaw.toLowerCase()}|${lastName.toLowerCase()}`
        : null;

    if (key && personLookup.has(key)) {
      return personLookup.get(key);
    }

    personIndex += 1;
    const filename = `person_${personIndex}.json`;
    const personObj = {
      birth_date: personData.birth_date || null,
      first_name: firstName || "",
      last_name: lastName || "",
      middle_name: middleName,
      prefix_name:
        personData && personData.prefix_name != null
          ? personData.prefix_name
          : null,
      suffix_name:
        personData && personData.suffix_name != null
          ? personData.suffix_name
          : null,
      us_citizenship_status:
        personData && personData.us_citizenship_status != null
          ? personData.us_citizenship_status
          : null,
      veteran_status:
        personData && personData.veteran_status != null
          ? personData.veteran_status
          : null,
    };
    writeJSON(path.join(dataDir, filename), personObj);
    const relPath = `./${filename}`;
    if (key) personLookup.set(key, relPath);
    return relPath;
  }

  function createCompanyRecord(name) {
    const cleanName = name != null ? String(name).trim() : "";
    const key = cleanName ? cleanName.toLowerCase() : null;
    if (key && companyLookup.has(key)) {
      return companyLookup.get(key);
    }
    companyIndex += 1;
    const filename = `company_${companyIndex}.json`;
    const companyObj = {
      name: cleanName,
    };
    if (requestIdentifier) {
      companyObj.request_identifier = requestIdentifier;
    }
    writeJSON(path.join(dataDir, filename), companyObj);
    const relPath = `./${filename}`;
    if (key) companyLookup.set(key, relPath);
    return relPath;
  }

  const property = {
    parcel_identifier: parcelId || "",
    ownership_estate_type: propertyUse.ownership_estate_type || null,
    build_status: propertyUse.build_status || null,
    structure_form: propertyUse.structure_form || null,
    property_usage_type: propertyUse.property_usage_type || null,
  property_type: propertyUse.property_type,
  number_of_units_type: binfo.type === "DUPLEX" ? "Two" :
                        binfo.type === "TRI/QUADRAPLEX" ? "TwoToFour" : "One",
  property_structure_built_year: parseIntSafe(binfo.actYear),
  property_effective_built_year: parseIntSafe(binfo.effYear),
    livable_floor_area: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    total_area: binfo.totalArea ? `${parseIntSafe(binfo.totalArea).toLocaleString()} sq ft` : null,
    area_under_air: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision && subdivision.length ? subdivision : null,
    zoning: zoning || null,
  number_of_units: binfo.type === "DUPLEX" ? 2 :
                   binfo.type === "TRI/QUADRAPLEX" ? 3 : 1,
  historic_designation: false,
  source_http_request: clone(defaultSourceHttpRequest),
  request_identifier: requestIdentifier
};
  if (property.property_type === "LandParcel") {
    property.number_of_units = null;
    property.number_of_units_type = null;
  }
  const propertyFilename = "property.json";
  const propertyPath = `./${propertyFilename}`;
  writeJSON(path.join(dataDir, propertyFilename), property);

  const parcelRecord = {
    parcel_identifier: parcelId || propId || null,
    request_identifier: requestIdentifier,
  };
  writeJSON(path.join(dataDir, "parcel.json"), parcelRecord);

  // Structure records (from structure data when available; fallback to parsed building info)
  const baseStructure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: mapExteriorWallMaterial(binfo.exteriorWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      binfo.interiorWalls === "DRYWALL" ? "Drywall" : null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material:
      binfo.roofing === "ASPHALT" ? "Architectural Asphalt Shingle" : null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: binfo.roofType === "GABLE/HIP" ? "Gable" : null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: binfo.roofing === "ASPHALT" ? "Shingle" : null,
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
    number_of_stories: parseFloatSafe(binfo.stories),
    finished_base_area: parseIntSafe(binfo.heatedArea),
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };

const baseUtility = {
  heating_system_type: null,
  cooling_system_type: null,
  public_utility_type: null,
  sewer_type: null,
  water_source_type: null,
  plumbing_system_type: null,
  plumbing_system_type_other_description: null,
  electrical_panel_capacity: null,
  electrical_wiring_type: null,
  hvac_condensing_unit_present: null,
  electrical_wiring_type_other_description: null,
  solar_panel_present: false,
  solar_panel_type: null,
  solar_panel_type_other_description: null,
  smart_home_features: null,
  smart_home_features_other_description: null,
  hvac_unit_condition: null,
  solar_inverter_visible: false,
  hvac_unit_issues: null,
};

const structureItems = (() => {
  const wrap = (entry, buildingIndex = null) => {
    const cleanedEntry =
      entry && typeof entry === "object" ? { ...entry } : {};
    stripKeys(cleanedEntry, [
      "buildings",
      "structures",
      "layouts",
      "utilities",
    ]);

    const data = {
      ...baseStructure,
      ...cleanedEntry,
      source_http_request:
        entry && entry.source_http_request != null
          ? entry.source_http_request
          : clone(defaultSourceHttpRequest),
      request_identifier:
        entry && entry.request_identifier != null
          ? entry.request_identifier
          : requestIdentifier,
    };
    delete data.buildings;

    return {
      data,
      buildingIndex:
        Number.isFinite(parseIntSafe(buildingIndex))
          ? parseIntSafe(buildingIndex)
          : null,
    };
  };

  if (
    structureEntry &&
    typeof structureEntry === "object" &&
    structureEntry !== null &&
    Array.isArray(structureEntry.buildings) &&
    structureEntry.buildings.length
  ) {
    return structureEntry.buildings.map((rec) => {
      const entry =
        rec && typeof rec === "object" && rec.structure ? rec.structure : rec;
      const buildingIndex =
        rec && rec.building_index != null ? rec.building_index : null;
      return wrap(entry || {}, buildingIndex);
    });
  }

  if (Array.isArray(structureEntry)) {
    if (!structureEntry.length) return [wrap({}, null)];
    return structureEntry.map((entry) => wrap(entry || {}, null));
  }

  if (
    structureEntry &&
    typeof structureEntry === "object" &&
    Array.isArray(structureEntry.structures)
  ) {
    const arr = structureEntry.structures;
    if (!arr.length) return [wrap({}, null)];
    return arr.map((entry) => wrap(entry || {}, null));
  }

  if (structureEntry && typeof structureEntry === "object") {
    return [wrap(structureEntry, null)];
  }

  return [wrap({}, null)];
})();

  const structureOutputs = [];
  const structurePaths = [];
  structureItems.forEach((item) => {
    const filename = `structure_${structureOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    structureOutputs.push({
      filename,
      data: item.data,
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
    structurePaths.push({
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
  });
  structureOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  // Initialize buildingLayoutsInfo early for use in utilityItems
  const buildingLayoutsInfo = [];

  const utilityItems = (() => {
    const wrap = (entry, buildingIndex = null) => {
      const cleanedEntry =
        entry && typeof entry === "object" ? { ...entry } : {};
      stripKeys(cleanedEntry, [
        "buildings",
        "structures",
        "layouts",
        "utilities",
      ]);

      const data = {
        ...baseUtility,
        ...cleanedEntry,
        source_http_request:
          entry && entry.source_http_request != null
            ? entry.source_http_request
            : clone(defaultSourceHttpRequest),
        request_identifier:
          entry && entry.request_identifier != null
            ? entry.request_identifier
            : requestIdentifier,
      };
      delete data.buildings;
      Object.keys(baseUtility).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = baseUtility[key];
        }
      });

      return {
        data,
        buildingIndex:
          Number.isFinite(parseIntSafe(buildingIndex))
            ? parseIntSafe(buildingIndex)
            : null,
      };
    };

    if (
      utilitiesEntry &&
      typeof utilitiesEntry === "object" &&
      utilitiesEntry !== null &&
      Array.isArray(utilitiesEntry.buildings) &&
      utilitiesEntry.buildings.length
    ) {
      return utilitiesEntry.buildings.map((rec) => {
        const entry =
          rec && typeof rec === "object" && rec.utility ? rec.utility : rec;
        const buildingIndex =
          rec && rec.building_index != null ? rec.building_index : null;
        return wrap(entry || {}, buildingIndex);
      });
    }

    if (Array.isArray(utilitiesEntry)) {
      if (!utilitiesEntry.length) return [wrap({}, null)];
      return utilitiesEntry.map((entry) => wrap(entry || {}, null));
    }

    if (
      utilitiesEntry &&
      typeof utilitiesEntry === "object" &&
      Array.isArray(utilitiesEntry.utilities)
    ) {
      const arr = utilitiesEntry.utilities;
      if (!arr.length) return [wrap({}, null)];
      return arr.map((entry) => wrap(entry || {}, null));
    }

    if (utilitiesEntry && typeof utilitiesEntry === "object") {
      return [wrap(utilitiesEntry, null)];
    }

    if (buildingLayoutsInfo.length) {
      return buildingLayoutsInfo.map((info) => wrap({}, info.index));
    }

    return [wrap({}, null)];
  })();

  const utilityOutputs = [];
  const utilityPaths = [];
  utilityItems.forEach((item) => {
    const filename = `utility_${utilityOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    utilityOutputs.push({
      filename,
      data: item.data,
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
    utilityPaths.push({
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
  });
  utilityOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  const propertyImprovementOutputs = [];
  const permitEntries = parsePermitTable($);
  permitEntries.forEach((permit, idx) => {
    const improvementType =
      mapPermitImprovementType(permit.type) || "GeneralBuilding";
    const improvementStatus =
      mapPermitImprovementStatus(permit.active) || "Unknown";
    const permitIssueDate = toISOFromMDY(permit.issueDate);
    const estimatedCostAmount = moneyToNumber(permit.value);
    const permitNumber =
      permit.permitNumber && permit.permitNumber.length
        ? permit.permitNumber
        : null;
    const improvementAction =
      mapPermitImprovementAction(permit.type) || "Other";
    const contractorType = mapPermitContractorType(permit.primary);

    const baseRequestId =
      requestIdentifier || permitNumber || parcelId || propId || "permit";
    const improvementRequestId = permitNumber
      ? `${baseRequestId}-${permitNumber}`
      : `${baseRequestId}-permit-${idx + 1}`;

    const improvement = {
      improvement_type: improvementType,
      improvement_status: improvementStatus,
      improvement_action: improvementAction,
      permit_number: permitNumber,
      permit_issue_date: permitIssueDate,
      completion_date: null,
      contractor_type: contractorType,
      permit_required: permitNumber ? true : null,
      fee:
        typeof estimatedCostAmount === "number" && estimatedCostAmount > 0
          ? Number(estimatedCostAmount.toFixed(2))
          : null,
      request_identifier: improvementRequestId,
    };

    const requiredImprovementKeys = new Set([
      "improvement_status",
      "completion_date",
    ]);
    Object.keys(improvement).forEach((key) => {
      if (improvement[key] == null && !requiredImprovementKeys.has(key)) {
        delete improvement[key];
      }
    });

    if (!improvement.improvement_type && !improvement.permit_number) {
      return;
    }

    const filename = `property_improvement_${propertyImprovementOutputs.length + 1}.json`;
    writeJSON(path.join(dataDir, filename), improvement);
    propertyImprovementOutputs.push({ filename, path: `./${filename}` });
  });

  const createLayoutRecord = (spaceType, overrides = {}) => {
    const base = {
      space_type: spaceType,
      space_index: null,
      space_type_index: null,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      floor_number: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
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
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
      source_http_request: clone(defaultSourceHttpRequest),
      request_identifier: requestIdentifier,
    };
    return { ...base, ...overrides };
  };

  const rawLayouts =
    layoutEntry && Array.isArray(layoutEntry.layouts) ? layoutEntry.layouts : [];
  const layoutBuildings =
    layoutEntry && Array.isArray(layoutEntry.buildings)
      ? layoutEntry.buildings
      : [];

  const layoutOutputs = [];
  const sanitizeLayoutForOutput = (layout) => {
    const sanitized = {};
    Object.entries(layout || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key.startsWith("_")) return;
      if (
        key === "parent_building_index" ||
        key === "parent_floor_number" ||
        key === "floor_number" ||
        key === "floor_level"
      ) {
        return;
      }
      sanitized[key] = value;
    });
    return sanitized;
  };
  const addLayoutRecord = (layoutDataObj) => {
    const filename = `layout_${layoutOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    layoutOutputs.push({
      filename,
      data: sanitizeLayoutForOutput(layoutDataObj),
      path: relPath,
    });
    return relPath;
  };

  const ordinalSuffix = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  const propertyIsLand = property.property_type === "LandParcel";
  const totalAreaSqFt = parseIntSafe(binfo.totalArea);
  const heatedAreaSqFt = parseIntSafe(binfo.heatedArea);

  const normalizedBuildings = Array.isArray(layoutBuildings)
    ? layoutBuildings.map((building, idx) => {
        const subAreas = Array.isArray(building && building.sub_areas)
          ? building.sub_areas.map((entry) => ({
              description:
                entry && entry.description != null
                  ? String(entry.description)
                  : null,
              type:
                entry && entry.type != null ? String(entry.type) : null,
              square_feet: parseIntSafe(entry && entry.square_feet),
            }))
          : [];
        return {
          index: idx + 1,
          type:
            building && building.building_type != null
              ? String(building.building_type)
              : null,
          totalArea:
            parseIntSafe(
              building && building.total_area_sq_ft != null
                ? building.total_area_sq_ft
                : null,
            ) || null,
          heatedArea:
            parseIntSafe(
              building && building.heated_area_sq_ft != null
                ? building.heated_area_sq_ft
                : null,
            ) || null,
          bedrooms:
            parseIntSafe(
              building && building.bedrooms != null
                ? building.bedrooms
                : null,
            ) || 0,
          fullBaths:
            parseIntSafe(
              building && building.full_bathrooms != null
                ? building.full_bathrooms
                : null,
            ) || 0,
          halfBaths:
            parseIntSafe(
              building && building.half_bathrooms != null
                ? building.half_bathrooms
                : null,
            ) || 0,
          stories:
            parseFloatSafe(
              building && building.stories != null
                ? building.stories
                : null,
            ) || null,
          subAreas,
        };
      })
    : [];

  // buildingLayoutsInfo already initialized earlier
  const buildingInfoByIndex = new Map();
  const buildingMetaByIndex = new Map();
  normalizedBuildings.forEach((meta) => {
    buildingMetaByIndex.set(meta.index, meta);
  });

  const ensureFloorForBuilding = (info, floorNumber) => {
    let floorMeta = info.floors.find(
      (meta) => meta.layout.floor_number === floorNumber,
    );
    if (floorMeta) return floorMeta;
    const floorLayout = createLayoutRecord("Floor", {
      floor_level: `${ordinalSuffix(floorNumber)} Floor`,
      floor_number: floorNumber,
      is_exterior: false,
    });
    floorMeta = {
      layout: floorLayout,
      childLayouts: [],
      childPaths: [],
    };
    info.floors.push(floorMeta);
    return floorMeta;
  };

  const ensureBuildingLayout = (meta, explicitIndex) => {
    const buildingIndex =
      explicitIndex != null
        ? explicitIndex
        : meta && meta.index
        ? meta.index
        : buildingLayoutsInfo.length + 1;
    if (buildingInfoByIndex.has(buildingIndex)) {
      return buildingInfoByIndex.get(buildingIndex);
    }
    const sizeSqFt =
      meta && meta.totalArea != null
        ? meta.totalArea
        : meta && meta.heatedArea != null
        ? meta.heatedArea
        : totalAreaSqFt != null
        ? totalAreaSqFt
        : heatedAreaSqFt != null
        ? heatedAreaSqFt
        : null;
    const buildingLayout = createLayoutRecord("Building", {
      space_index: buildingIndex,
      space_type_index: `${buildingIndex}`,
      size_square_feet: sizeSqFt,
      is_exterior: false,
    });
    const path = addLayoutRecord(buildingLayout);
    const info = {
      index: buildingIndex,
      path,
      childCount: 0,
      childPaths: [],
      floors: [],
      directChildLayouts: [],
      expectedFloorCount: Math.max(
        1,
        Math.round(parseFloatSafe(meta && meta.stories)) || 1,
      ),
    };
    buildingLayoutsInfo.push(info);
    buildingInfoByIndex.set(buildingIndex, info);
    return info;
  };

  const getOrCreateBuildingInfo = (buildingIndex) => {
    if (buildingInfoByIndex.has(buildingIndex)) {
      return buildingInfoByIndex.get(buildingIndex);
    }
    const meta = buildingMetaByIndex.get(buildingIndex) || {};
    return ensureBuildingLayout(meta, buildingIndex);
  };

  const addRoomLayout = (buildingIndex, floorNumber, overrides = {}) => {
    const info = getOrCreateBuildingInfo(buildingIndex);
    const { space_type: rawSpaceType, ...rest } = overrides || {};
    const spaceType = titleCase(rawSpaceType || "Living Area");
    const finalOverrides = { ...rest };

    if (typeof finalOverrides.is_exterior !== "boolean") {
      delete finalOverrides.is_exterior;
    }

    if (floorNumber == null) {
      if (finalOverrides.floor_number == null) {
        finalOverrides.floor_number = null;
      }
      if (!finalOverrides.floor_level) {
        finalOverrides.floor_level = null;
      }
      const roomLayout = createLayoutRecord(spaceType, finalOverrides);
      info.directChildLayouts.push(roomLayout);
      return roomLayout;
    }

    const normalizedFloorNumber = floorNumber;
    const floorMeta = ensureFloorForBuilding(info, normalizedFloorNumber);
    finalOverrides.floor_number =
      finalOverrides.floor_number != null
        ? finalOverrides.floor_number
        : normalizedFloorNumber;
    if (!finalOverrides.floor_level) {
      finalOverrides.floor_level = `${ordinalSuffix(normalizedFloorNumber)} Floor`;
    }
    const roomLayout = createLayoutRecord(spaceType, finalOverrides);
    floorMeta.childLayouts.push(roomLayout);
    return roomLayout;
  };

  if (normalizedBuildings.length) {
    normalizedBuildings.forEach((meta) => {
      ensureBuildingLayout(meta, meta.index);
    });
  }

  const parseBathroomsValue = (value) => {
    const numeric = parseFloatSafe(value);
    if (numeric == null) {
      return { full: 0, half: 0 };
    }
    const full = Math.max(0, Math.floor(numeric));
    const half = Math.max(0, Math.round((numeric - full) * 2));
    return { full, half };
  };

  if (!buildingLayoutsInfo.length && !propertyIsLand) {
    const fallbackBuildingCount = Math.max(
      structurePaths.length,
      utilityPaths.length,
      1,
    );
    const fallbackBedrooms = parseIntSafe(binfo.bedrooms) || 0;
    const bathroomCounts = parseBathroomsValue(binfo.bathrooms);
    const fallbackStories = parseFloatSafe(binfo.stories) || null;
    for (let i = 1; i <= fallbackBuildingCount; i += 1) {
      const meta = {
        index: i,
        totalArea: totalAreaSqFt || null,
        heatedArea: heatedAreaSqFt || null,
        bedrooms: fallbackBedrooms,
        fullBaths: bathroomCounts.full,
        halfBaths: bathroomCounts.half,
        stories: fallbackStories,
        subAreas: [],
      };
      buildingMetaByIndex.set(i, meta);
      ensureBuildingLayout(meta, i);
    }
  }

  if (Array.isArray(rawLayouts) && rawLayouts.length) {
    rawLayouts.forEach((layout) => {
      if (!layout) return;
      const parentIndex =
        parseIntSafe(layout.parent_building_index) ||
        (buildingLayoutsInfo[0] ? buildingLayoutsInfo[0].index : 1);
      const rawFloorValue =
        layout.floor_number ?? layout.parent_floor_number ?? null;
      const parsedFloorNumber = parseIntSafe(rawFloorValue);
      const floorNumber = parsedFloorNumber != null ? parsedFloorNumber : null;
      const sizeSquareFeet =
        layout.size_square_feet != null
          ? parseIntSafe(layout.size_square_feet)
          : null;
      const spaceType = layout.space_type
        ? titleCase(layout.space_type)
        : "Living Area";
      addRoomLayout(parentIndex, floorNumber, {
        space_type: spaceType,
        size_square_feet: sizeSquareFeet,
        floor_level: layout.floor_level || null,
        ...(typeof layout.is_exterior === "boolean"
          ? { is_exterior: layout.is_exterior }
          : {}),
      });
    });
  }

  const mapSubAreaLayoutType = (subArea) => {
    if (!subArea) return null;
    const typeCode = subArea.type ? subArea.type.toUpperCase() : "";
    const desc = subArea.description ? subArea.description.toUpperCase() : "";
    if (typeCode === "CPU" || (desc.includes("COVERED") && desc.includes("PARK")))
      return "Carport";
    if (typeCode === "EUF" || (desc.includes("ELEV") && desc.includes("UNFIN")))
      return "Storage Room";
    if (desc.includes("UTIL") && desc.includes("UNFIN")) return "Storage Room";
    if (typeCode === "FLA" || desc.includes("FLOOR LIV") || typeCode === "BAS")
      return "Living Area";
    if (typeCode === "LLF" || (desc.includes("LOW") && desc.includes("LEV") && desc.includes("FIN")))
      return "Basement";
    if (typeCode.includes("GAR") && typeCode.includes("FIN")) return "Attached Garage";
    if (typeCode === "GBF" || (desc.includes("GAR") && desc.includes("FIN") && desc.includes("BLOCK"))) return "Attached Garage";
    if (desc.includes("BED")) return "Bedroom";
    if (desc.includes("BATH")) return "Full Bathroom";
    if (desc.includes("KITCH")) return "Kitchen";
    if (desc.includes("OP PR") || desc.includes("PRCH")) return "Open Porch";
    if (desc.includes("PORCH") && desc.includes("SCREEN"))
      return "Screened Porch";
    if (desc.includes("PORCH")) return "Open Porch";
    if (desc.includes("BALCONY")) return "Balcony";
    if (desc.includes("DECK")) return "Deck";
    if (desc.includes("PATIO")) return "Patio";
    if (desc.includes("GARAGE") || typeCode.includes("GAR") || desc.startsWith("GAR ")) return desc.includes("DET") ? "Detached Garage" : "Attached Garage";
    if (desc.includes("CARPORT")) return "Carport";
    if (desc.includes("STORAGE")) return "Storage Room";
    return null;
  };

  const ensureFallbackRooms = () => {
    buildingLayoutsInfo.forEach((info) => {
      const meta = buildingMetaByIndex.get(info.index) || null;
      const hasAnyRooms = info.floors.some(
        (floorMeta) => floorMeta.childLayouts.length > 0,
      ) || (info.directChildLayouts && info.directChildLayouts.length > 0);
      if (!hasAnyRooms && meta) {
        const existingFloorNumbers = info.floors
          .map((floorMeta) => floorMeta.layout.floor_number)
          .filter((value) => value != null);
        const pickFloorNumber = (idx) => {
          if (!existingFloorNumbers.length) return null;
          const num = existingFloorNumbers[idx % existingFloorNumbers.length];
          return num != null ? num : null;
        };
        const addFallbackRooms = (count, spaceType) => {
          for (let i = 0; i < count; i += 1) {
            const targetFloorNumber = pickFloorNumber(i);
            addRoomLayout(info.index, targetFloorNumber, {
              space_type: spaceType,
            });
          }
        };
        addFallbackRooms(meta.bedrooms || 0, "Bedroom");
        addFallbackRooms(meta.fullBaths || 0, "Full Bathroom");
        addFallbackRooms(
          meta.halfBaths || 0,
          "Half Bathroom / Powder Room",
        );
        (meta.subAreas || []).forEach((subArea, idx) => {
          const label =
            mapSubAreaLayoutType(subArea) || "Living Area";
          const targetFloorNumber = pickFloorNumber(idx);
          const alreadyExists = info.directChildLayouts.some(
            (layout) =>
              layout.space_type &&
              layout.space_type.toLowerCase() === label.toLowerCase(),
          );
          if (!alreadyExists && info.floors.length && targetFloorNumber != null) {
            const floorMeta = ensureFloorForBuilding(info, targetFloorNumber);
            const existsOnFloor = floorMeta.childLayouts.some(
              (layout) =>
                layout.space_type &&
                layout.space_type.toLowerCase() === label.toLowerCase(),
            );
            if (existsOnFloor) return;
            const roomLayout = createLayoutRecord(label, {
              floor_level: `${ordinalSuffix(targetFloorNumber)} Floor`,
              floor_number: targetFloorNumber,
              size_square_feet:
                subArea.square_feet != null ? subArea.square_feet : null,
            });
            floorMeta.childLayouts.push(roomLayout);
            return;
          }
          if (alreadyExists) return;
          const roomLayout = createLayoutRecord(label, {
            floor_number: null,
            floor_level: null,
            size_square_feet:
              subArea.square_feet != null ? subArea.square_feet : null,
          });
          info.directChildLayouts.push(roomLayout);
        });
      }

      const stillEmpty =
        info.floors.every(
          (floorMeta) => floorMeta.childLayouts.length === 0,
        ) && info.directChildLayouts.length === 0;
      if (stillEmpty) {
        if (info.floors.length) {
          const targetFloor =
            info.floors[0] || ensureFloorForBuilding(info, 1);
          const floorNumber = targetFloor.layout.floor_number || 1;
          targetFloor.childLayouts.push(
            createLayoutRecord("Living Area", {
              floor_level: `${ordinalSuffix(floorNumber)} Floor`,
              floor_number: floorNumber,
            }),
          );
        } else {
          info.directChildLayouts.push(
            createLayoutRecord("Living Area", {
              floor_number: null,
              floor_level: null,
            }),
          );
        }
      }
    });
  };

  ensureFallbackRooms();

  buildingLayoutsInfo.forEach((info) => {
    const directTypeCounters = new Map();
    (info.directChildLayouts || []).forEach((roomLayout) => {
      const roomTypeKey =
        roomLayout.space_type != null
          ? String(roomLayout.space_type)
          : "Unknown";
      const currentRoom = directTypeCounters.get(roomTypeKey) || 0;
      const nextRoom = currentRoom + 1;
      directTypeCounters.set(roomTypeKey, nextRoom);
      roomLayout.space_index = nextRoom;
      roomLayout.space_type_index = `${info.index}.${nextRoom}`;
      if (!roomLayout.floor_level) {
        roomLayout.floor_level = null;
      }
      if (roomLayout.floor_number == null) {
        roomLayout.floor_number = null;
      }
      const roomPath = addLayoutRecord(roomLayout);
      info.childPaths.push(roomPath);
    });

    const floorTypeCounters = new Map();
    info.floors
      .sort(
        (a, b) =>
          (a.layout.floor_number || 0) - (b.layout.floor_number || 0),
      )
      .forEach((floorMeta) => {
        info.childCount += 1;
        const floorLayout = floorMeta.layout;
        const typeKey =
          floorLayout.space_type != null
            ? String(floorLayout.space_type)
            : "Floor";
        const current = floorTypeCounters.get(typeKey) || 0;
        const next = current + 1;
        floorTypeCounters.set(typeKey, next);
        floorLayout.space_index = info.childCount;
        floorLayout.space_type_index = `${info.index}.${next}`;
        if (!floorLayout.floor_level) {
          floorLayout.floor_level = `${ordinalSuffix(
            floorLayout.floor_number || 1,
          )} Floor`;
        }
        const floorPath = addLayoutRecord(floorLayout);
        floorMeta.path = floorPath;
        info.childPaths.push(floorPath);

        const roomTypeCounters = new Map();
        floorMeta.childLayouts.forEach((roomLayout) => {
          const roomTypeKey =
            roomLayout.space_type != null
              ? String(roomLayout.space_type)
              : "Unknown";
          const currentRoom = roomTypeCounters.get(roomTypeKey) || 0;
          const nextRoom = currentRoom + 1;
          roomTypeCounters.set(roomTypeKey, nextRoom);
          roomLayout.space_index = nextRoom;
          roomLayout.space_type_index = `${info.index}.${
            floorMeta.layout.floor_number || 1
          }.${nextRoom}`;
          if (!roomLayout.floor_level) {
            roomLayout.floor_level = floorLayout.floor_level;
          }
          if (roomLayout.floor_number == null) {
            roomLayout.floor_number = floorMeta.layout.floor_number || 1;
          }
          const roomPath = addLayoutRecord(roomLayout);
          floorMeta.childPaths.push(roomPath);
        });
      });
  });

  const cleanupLayoutArtifacts = () => {
    if (!fs.existsSync(dataDir)) return;
    const entries = fs.readdirSync(dataDir);
    entries
      .filter((name) => /^layout_\d+\.json$/i.test(name))
      .forEach((name) => {
        fs.unlinkSync(path.join(dataDir, name));
      });
    entries
      .filter((name) => /^relationship_layout_.*\.json$/i.test(name))
      .forEach((name) => {
        fs.unlinkSync(path.join(dataDir, name));
      });
  };
  cleanupLayoutArtifacts();

  layoutOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  const writeRelationshipUnique = (() => {
    const seen = new Set();
    return (fromPath, toPath) => {
      const relFilename = makeRelationshipFilename(fromPath, toPath);
      if (!relFilename || seen.has(relFilename)) return;
      seen.add(relFilename);
      writeJSON(path.join(dataDir, relFilename), {
        from: { "/": fromPath },
        to: { "/": toPath },
      });
    };
  })();

  // Property relationships to structures (leftovers handled later)
  const propertyStructureFallback = (structurePath) => {
    writeRelationshipUnique(propertyPath, structurePath);
  };

  const propertyUtilityFallback = (utilityPath) => {
    writeRelationshipUnique(propertyPath, utilityPath);
  };

  // Property to layout relationships
  if (buildingLayoutsInfo.length) {
    buildingLayoutsInfo.forEach((info) => {
      writeRelationshipUnique(propertyPath, info.path);
    });
  } else if (layoutOutputs.length) {
    layoutOutputs.forEach(({ path }) => {
      writeRelationshipUnique(propertyPath, path);
    });
  }

  propertyImprovementOutputs.forEach(({ path }) => {
    writeRelationshipUnique(propertyPath, path);
  });

  // Layout hierarchy relationships (building -> floors -> rooms)
  buildingLayoutsInfo.forEach((info) => {
    info.childPaths.forEach((childPath) => {
      writeRelationshipUnique(info.path, childPath);
    });
    info.floors.forEach((floorMeta) => {
      (floorMeta.childPaths || []).forEach((roomPath) => {
        writeRelationshipUnique(floorMeta.path, roomPath);
      });
    });
  });

  // Structure relationships to layouts or property
  if (structurePaths.length) {
    const structures = structurePaths.map((meta) => ({ ...meta, _matched: false }));

    if (buildingLayoutsInfo.length) {
      buildingLayoutsInfo.forEach((info) => {
        const matches = structures.filter(
          (meta) => meta.buildingIndex === info.index,
        );
        matches.forEach((meta) => {
          writeRelationshipUnique(info.path, meta.path);
          meta._matched = true;
        });
      });

      const unmatchedStructures = structures.filter((meta) => !meta._matched);
      if (unmatchedStructures.length) {
        const buildingsNeedingStructure = buildingLayoutsInfo.filter(
          (info) =>
            !structures.some(
              (meta) => meta._matched && meta.buildingIndex === info.index,
            ),
        );
        let idx = 0;
        buildingsNeedingStructure.forEach((info) => {
          if (idx < unmatchedStructures.length) {
            const meta = unmatchedStructures[idx];
            writeRelationshipUnique(info.path, meta.path);
            meta._matched = true;
            idx += 1;
          }
        });
      }

      structures
        .filter((meta) => !meta._matched)
        .forEach((meta) => propertyStructureFallback(meta.path));
    } else {
      structures.forEach((meta) => propertyStructureFallback(meta.path));
    }
  }

  // Utility relationships to layouts or property
  if (utilityPaths.length) {
    const utilities = utilityPaths.map((meta) => ({ ...meta, _matched: false }));

    if (buildingLayoutsInfo.length) {
      buildingLayoutsInfo.forEach((info) => {
        const matches = utilities.filter(
          (meta) => meta.buildingIndex === info.index,
        );
        matches.forEach((meta) => {
          writeRelationshipUnique(info.path, meta.path);
          meta._matched = true;
        });
      });

      const unmatchedUtilities = utilities.filter((meta) => !meta._matched);
      if (unmatchedUtilities.length) {
        const buildingsNeedingUtility = buildingLayoutsInfo.filter(
          (info) =>
            !utilities.some(
              (meta) => meta._matched && meta.buildingIndex === info.index,
            ),
        );
        let idx = 0;
        buildingsNeedingUtility.forEach((info) => {
          if (idx < unmatchedUtilities.length) {
            const meta = unmatchedUtilities[idx];
            writeRelationshipUnique(info.path, meta.path);
            meta._matched = true;
            idx += 1;
          }
        });
      }

      utilities
        .filter((meta) => !meta._matched)
        .forEach((meta) => propertyUtilityFallback(meta.path));
    } else {
      utilities.forEach((meta) => propertyUtilityFallback(meta.path));
    }
  }

  // Address: capture full address without splitting components
  const addrFromHTML = parseLocationAddressFromHTML($);
  const htmlAddressParts = [
    addrFromHTML.addrLine1 ? addrFromHTML.addrLine1.trim() : null,
    addrFromHTML.addrLine2 ? addrFromHTML.addrLine2.trim() : null,
  ].filter(Boolean);
  const htmlFullAddress =
    htmlAddressParts.length > 0 ? htmlAddressParts.join(", ") : null;
  const fallbackAddress =
    unaddr && unaddr.full_address ? String(unaddr.full_address).trim() : null;
  const unnormalizedAddress = htmlFullAddress || fallbackAddress || null;

  const address = {
    unnormalized_address: unnormalizedAddress,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
    county_name:
      (unaddr &&
        (unaddr.county_jurisdiction || unaddr.county_name || unaddr.county)) ||
      "Monroe",
    country_code: "US",
  };
  if (!address.unnormalized_address && addrFromHTML.addrLine1) {
    address.unnormalized_address = addrFromHTML.addrLine1;
  }
  const addressFilename = "address.json";
  const addressPath = `./${addressFilename}`;
  writeJSON(path.join(dataDir, addressFilename), address);

  const buildingGeometryTargets =
    buildingLayoutsInfo.length
      ? buildingLayoutsInfo.map((info) => info.path)
      : layoutOutputs.map((entry) => entry.path);
  generateGeometryArtifacts({
    dataDir,
    candidateIds: propertyIdCandidates,
    requestIdentifier,
    defaultSourceRequest: defaultSourceHttpRequest,
    addressPath,
    parcelPath: "./parcel.json",
    buildingLayoutPaths: buildingGeometryTargets,
  });

  const lot = {
    lot_type:
      acres != null && acres > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre",
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: acres != null && acres > 0 ? Math.round(acres * 43560) : null,
    lot_size_acre: acres,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  const lotFilename = "lot.json";
  const lotPath = `./${lotFilename}`;
  writeJSON(path.join(dataDir, lotFilename), lot);

  // Create property relationships
  const relPropertyAddress = makeRelationshipFilename(propertyPath, addressPath);
  if (relPropertyAddress) {
    writeJSON(path.join(dataDir, relPropertyAddress), {
      from: { "/": propertyPath },
      to: { "/": addressPath },
    });
  }

  const relPropertyLot = makeRelationshipFilename(propertyPath, lotPath);
  if (relPropertyLot) {
    writeJSON(path.join(dataDir, relPropertyLot), {
      from: { "/": propertyPath },
      to: { "/": lotPath },
    });
  }

  // Mailing addresses are not part of the Elephant schema, so we don't generate them

  const ownersByDate =
    ownersEntry && ownersEntry.owners_by_date
      ? ownersEntry.owners_by_date
      : {};
  let currentOwners = Array.isArray(ownersByDate.current)
    ? ownersByDate.current
    : [];
  if (!currentOwners.length) {
    const historicalDates = Object.keys(ownersByDate)
      .filter((key) => key !== "current")
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort((a, b) => a.localeCompare(b));
    if (historicalDates.length) {
      const latestKey = historicalDates[historicalDates.length - 1];
      const latestOwners = ownersByDate[latestKey];
      if (Array.isArray(latestOwners) && latestOwners.length) {
        currentOwners = latestOwners;
      }
    }
  }

  const work = parseValuationsWorking($);
  if (work) {
    const tax = {
      tax_year: work.year,
      property_assessed_value_amount: work.assessed || null,
      property_market_value_amount: work.justMarket || null,
      property_building_amount: work.improvement || null,
      property_land_amount: work.land || null,
      property_taxable_value_amount: work.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${work.year}.json`), tax);
  }

  const certs = parseValuationsCertified($);
  certs.forEach((rec) => {
    const tax = {
      tax_year: rec.year,
      property_assessed_value_amount: rec.assessed || null,
      property_market_value_amount: rec.justMarket || null,
      property_building_amount: rec.improvement || null,
      property_land_amount: rec.land || null,
      property_taxable_value_amount: rec.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${rec.year}.json`), tax);
  });

  const sales = parseSales($);
  const salesSorted = sales.sort(
    (a, b) => new Date(toISOFromMDY(b.date)) - new Date(toISOFromMDY(a.date)),
  );

  const saleFileRefs = [];
  const saleOwnerRelations = [];
  const saleBuyerStatus = new Map();

  salesSorted.forEach((s, idx) => {
    const iso = toISOFromMDY(s.date) || null;
    const saleIdx = idx + 1;
    const salesFilename = `sales_history_${saleIdx}.json`;
    const salesPath = `./${salesFilename}`;
    const saleObj = {
      ownership_transfer_date: iso,
      purchase_price_amount: s.price || 0,
    };
    writeJSON(path.join(dataDir, salesFilename), saleObj);
    saleBuyerStatus.set(salesPath, false);

    let deedPath = null;
    const hasDeedInfo =
      (s.instrument && s.instrument.trim()) ||
      (s.book && s.book.trim()) ||
      (s.page && s.page.trim()) ||
      (s.instrumentNumber && s.instrumentNumber.trim()) ||
      (s.clerkUrl && s.clerkUrl.trim());

    if (hasDeedInfo) {
      const deedFilename = `deed_${saleIdx}.json`;
      deedPath = `./${deedFilename}`;
      const deedObj = {
        deed_type: mapDeedType(s.instrument),
      };
      if (s.book) deedObj.book = String(s.book);
      if (s.page) deedObj.page = String(s.page);
      if (s.instrumentNumber) {
        deedObj.instrument_number = String(s.instrumentNumber);
      }
      writeJSON(path.join(dataDir, deedFilename), deedObj);

      if (s.clerkUrl) {
        const fileFilename = `file_${saleIdx}.json`;
        const filePath = `./${fileFilename}`;
        const fileObj = {
          file_format: "txt",
          name: `${(iso || "").slice(0, 4)} Clerk Link`,
          original_url: s.clerkUrl,
          ipfs_url: null,
          document_type: mapFileDocumentType(),
        };
        writeJSON(path.join(dataDir, fileFilename), fileObj);

        const relDeedFile = makeRelationshipFilename(deedPath, filePath);
        if (relDeedFile) {
          const relDF = {
            to: { "/": filePath },
            from: { "/": deedPath },
          };
          writeJSON(path.join(dataDir, relDeedFile), relDF);
        }
      }

      const relSalesDeed = makeRelationshipFilename(salesPath, deedPath);
      if (relSalesDeed) {
        const relSD = {
          to: { "/": deedPath },
          from: { "/": salesPath },
        };
        writeJSON(path.join(dataDir, relSalesDeed), relSD);
      }
    }

    const granteeParsed = parseOwnersFromText(s.grantee || "");
    granteeParsed.owners.forEach((owner) => {
      if (!owner || !owner.type) return;
      if (owner.type === "person") {
        const personPath = createPersonRecord(owner);
        if (personPath) {
          saleOwnerRelations.push({
            fromPath: salesPath,
            toPath: personPath,
          });
          saleBuyerStatus.set(salesPath, true);
        }
      } else if (owner.type === "company") {
        const companyPath = createCompanyRecord(owner.name || "");
        if (companyPath) {
          saleOwnerRelations.push({
            fromPath: salesPath,
            toPath: companyPath,
          });
          saleBuyerStatus.set(salesPath, true);
        }
      }
    });

    if (iso) {
      saleFileRefs.push({ saleIdx, dateISO: iso, salesPath });
    } else {
      saleFileRefs.push({ saleIdx, dateISO: null, salesPath });
    }
  });

  if (ownersEntry && ownersByDate && saleFileRefs.length) {
    const saleDatesISO = new Map(
      saleFileRefs
        .filter((ref) => ref.dateISO)
        .map((ref) => [ref.dateISO, ref]),
    );
    Object.keys(ownersByDate).forEach((dateKey) => {
      if (!saleDatesISO.has(dateKey)) return;
      const ref = saleDatesISO.get(dateKey);
      if (!ref || !ref.salesPath) return;
      if (saleBuyerStatus.get(ref.salesPath)) return;
      const ownersArr = ownersByDate[dateKey] || [];
      ownersArr.forEach((owner) => {
        if (!owner || !owner.type) return;
        if (owner.type === "person") {
          const normalized = normalizeOwner(owner, ownersByDate);
          const personPath = createPersonRecord(normalized);
          if (personPath) {
            saleOwnerRelations.push({
              fromPath: ref.salesPath,
              toPath: personPath,
            });
            saleBuyerStatus.set(ref.salesPath, true);
          }
        } else if (owner.type === "company") {
          const companyPath = createCompanyRecord(owner.name || "");
          if (companyPath) {
            saleOwnerRelations.push({
              fromPath: ref.salesPath,
              toPath: companyPath,
            });
            saleBuyerStatus.set(ref.salesPath, true);
          }
        }
      });
    });
  }

  const latestSaleRef = saleFileRefs.length ? saleFileRefs[0] : null;

  // Only create person/company records for current owners if there are sales to link them to
  const currentOwnerEntities = [];
  if (latestSaleRef && !saleBuyerStatus.get(latestSaleRef.salesPath)) {
    currentOwners.forEach((owner, idx) => {
      if (!owner || !owner.type) return;

      if (owner.type === "person") {
        const normalizedPerson = normalizeOwner(owner, ownersByDate);
        const personPath = createPersonRecord(normalizedPerson);
        if (personPath) {
          currentOwnerEntities.push({
            type: "person",
            path: personPath,
          });
        }
      } else if (owner.type === "company") {
        const companyPath = createCompanyRecord(owner.name || "");
        if (companyPath) {
          currentOwnerEntities.push({
            type: "company",
            path: companyPath,
          });
        }
      }
    });
  }

  if (
    latestSaleRef &&
    latestSaleRef.salesPath &&
    !saleBuyerStatus.get(latestSaleRef.salesPath)
  ) {
    currentOwnerEntities.forEach((entity) => {
      if (!entity.path) return;
      saleOwnerRelations.push({
        fromPath: latestSaleRef.salesPath,
        toPath: entity.path,
      });
    });
    saleBuyerStatus.set(latestSaleRef.salesPath, true);
  }

  const saleOwnerRelationshipKeys = new Set();
  saleOwnerRelations.forEach((entry) => {
    if (!entry.fromPath || !entry.toPath) return;
    const relKey = `${entry.fromPath}|${entry.toPath}`;
    if (saleOwnerRelationshipKeys.has(relKey)) return;
    saleOwnerRelationshipKeys.add(relKey);
    const relFilename = makeRelationshipFilename(entry.fromPath, entry.toPath);
    if (!relFilename) return;
    const rel = {
      to: { "/": entry.toPath },
      from: { "/": entry.fromPath },
    };
    writeJSON(path.join(dataDir, relFilename), rel);
  });

  const latestSale = salesSorted.length ? salesSorted[0] : null;
  if (latestSale) {
    const latestSaleISO = toISOFromMDY(latestSale.date) || null;
    if (latestSaleISO) {
      // property.ownership_transfer_date = latestSaleISO;
    }
    if (latestSale.price != null && Number.isFinite(latestSale.price)) {
      // property.purchase_price_amount = Number(latestSale.price.toFixed(2));
    }
  }
  writeJSON(path.join(dataDir, propertyFilename), property);
}

main();
