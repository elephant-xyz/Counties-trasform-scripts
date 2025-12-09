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
  return isNaN(v) ? null : v;
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
    .filter(Boolean)
    .map(token => {
      // Remove continuation markers from tokens (e.g., "GERARDO-CONT" -> "GERARDO")
      return token.replace(/[\-]*(cont|continued)[\-]*$/i, '').trim();
    })
    .filter(token => {
      if (!token) return false;
      // Filter out standalone continuation markers
      const upperToken = token.toUpperCase();
      if (upperToken === 'CONT' || upperToken === '-CONT-' || upperToken === 'CONTINUED') {
        return false;
      }
      // Filter out tokens that are only hyphens or special characters
      if (/^[\-]+$/.test(token)) {
        return false;
      }
      return true;
    });
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

const FILE_DOCUMENT_TYPE_ENUM = new Set([
  "Title",
  "ConveyanceDeed",
  "ConveyanceDeedWarrantyDeed",
  "ConveyanceDeedQuitClaimDeed",
  "ConveyanceDeedBargainAndSaleDeed",
]);

const FILE_DOCUMENT_TYPE_BY_DEED_TYPE = Object.freeze({
  "Warranty Deed": "ConveyanceDeedWarrantyDeed",
  "Special Warranty Deed": "ConveyanceDeedWarrantyDeed",
  "Quitclaim Deed": "ConveyanceDeedQuitClaimDeed",
  "Bargain and Sale Deed": "ConveyanceDeedBargainAndSaleDeed",
  "Grant Deed": "ConveyanceDeedBargainAndSaleDeed",
  "Trustee's Deed": "ConveyanceDeed",
  "Personal Representative Deed": "ConveyanceDeed",
  "Sheriff's Deed": "ConveyanceDeed",
  "Tax Deed": "ConveyanceDeed",
  "Lady Bird Deed": "ConveyanceDeed",
  "Transfer on Death Deed": "ConveyanceDeed",
  "Deed in Lieu of Foreclosure": "ConveyanceDeed",
  "Life Estate Deed": "ConveyanceDeed",
  "Miscellaneous": "Title",
});

function coerceFileDocumentType(value) {
  if (value && FILE_DOCUMENT_TYPE_ENUM.has(value)) return value;
  return "Title";
}

function mapFileDocumentType(rawInstrument) {
  const deedType = mapDeedType(rawInstrument);
  if (FILE_DOCUMENT_TYPE_BY_DEED_TYPE[deedType]) {
    return FILE_DOCUMENT_TYPE_BY_DEED_TYPE[deedType];
  }
  if (deedType && deedType.toUpperCase().includes("DEED")) {
    return "ConveyanceDeed";
  }
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

function normalizePropertyClassName(value) {
  return value ? value.trim().replace(/\s+/g, " ").toUpperCase() : "";
}

const PROPERTY_USE_DEFAULT = {
  ownership_estate_type: "FeeSimple",
  build_status: "Improved",
  structure_form: null,
  property_usage_type: "Unknown",
  property_type: "Building",
};

const PROPERTY_USE_MAPPINGS = {
  '0000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'Residential',
    property_type: 'LandParcel',
  },
  '0041': {
    ownership_estate_type: 'Condominium',
    build_status: 'VacantLand',
    structure_form: 'ApartmentUnit',
    property_usage_type: 'Residential',
    property_type: 'Unit',
  },
  '0100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    structure_form: 'SingleFamilyDetached',
    property_usage_type: 'Residential',
    property_type: 'Building',
  },
  '0101': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '0102': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '0200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    structure_form: 'ManufacturedHousing',
    property_usage_type: 'Residential',
    property_type: 'ManufacturedHome',
  },
  '0201': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '0202': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '0300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    structure_form: 'MultiFamily5Plus',
    property_usage_type: 'Residential',
    property_type: 'Building',
  },
  '0400': {
    ownership_estate_type: 'Condominium',
    build_status: 'Improved',
    structure_form: 'ApartmentUnit',
    property_usage_type: 'Residential',
    property_type: 'Unit',
  },
  '0500': {
    ownership_estate_type: 'Cooperative',
    build_status: 'Improved',
    structure_form: 'ApartmentUnit',
    property_usage_type: 'Residential',
    property_type: 'Unit',
  },
  '0600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'HomesForAged',
    property_type: 'Building',
  },
  '0691': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'HomesForAged',
    property_type: 'Building',
  },
  '0700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Residential',
    property_type: 'Building',
  },
  '0800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    structure_form: 'MultiFamilyLessThan10',
    property_usage_type: 'Residential',
    property_type: 'Building',
  },
  '0802': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '0900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'ResidentialCommonElementsAreas',
    property_type: 'LandParcel',
  },
  '1000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '1100': {
    ownership_estate_type: 'Condominium',
    build_status: 'Improved',
    property_usage_type: 'RetailStore',
    property_type: 'Unit',
  },
  '1200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'RetailStore',
    property_type: 'Building',
  },
  '1300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'DepartmentStore',
    property_type: 'Building',
  },
  '1400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Supermarket',
    property_type: 'Building',
  },
  '1600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'ShoppingCenterCommunity',
    property_type: 'Building',
  },
  '1601': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'RetailStore',
    property_type: 'Building',
  },
  '1700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'OfficeBuilding',
    property_type: 'Building',
  },
  '1701': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '1800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'OfficeBuilding',
    property_type: 'Building',
  },
  '1900': {
    ownership_estate_type: 'Condominium',
    build_status: 'Improved',
    property_usage_type: 'OfficeBuilding',
    property_type: 'Unit',
  },
  '1901': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '2000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'TransportationTerminal',
    property_type: 'LandParcel',
  },
  '2100': {
    ownership_estate_type: 'Condominium',
    build_status: 'Improved',
    property_usage_type: 'Restaurant',
    property_type: 'Unit',
  },
  '2200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Entertainment',
    property_type: 'Building',
  },
  '2300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'FinancialInstitution',
    property_type: 'Building',
  },
  '2400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '2500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Commercial',
    property_type: 'Building',
  },
  '2600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'ServiceStation',
    property_type: 'Building',
  },
  '2700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'AutoSalesRepair',
    property_type: 'Building',
  },
  '2800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Commercial',
    property_type: 'LandParcel',
  },
  '2900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '3000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Ornamentals',
    property_type: 'LandParcel',
  },
  '3200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Theater',
    property_type: 'Building',
  },
  '3300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Entertainment',
    property_type: 'Building',
  },
  '3400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '3500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Entertainment',
    property_type: 'Building',
  },
  '3600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Recreational',
    property_type: 'LandParcel',
  },
  '3700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'RaceTrack',
    property_type: 'Building',
  },
  '3800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GolfCourse',
    property_type: 'LandParcel',
  },
  '3900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Hotel',
    property_type: 'Building',
  },
  '4000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'Industrial',
    property_type: 'LandParcel',
  },
  '4100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'LightManufacturing',
    property_type: 'Building',
  },
  '4200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'HeavyManufacturing',
    property_type: 'Building',
  },
  '4300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'LumberYard',
    property_type: 'Building',
  },
  '4500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '4600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Cannery',
    property_type: 'Building',
  },
  '4700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '4800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Warehouse',
    property_type: 'Building',
  },
  '4801': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '4803': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '4900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'OpenStorage',
    property_type: 'LandParcel',
  },
  '5000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '5900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '6700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '6800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '6900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '7000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'GovernmentProperty',
    property_type: 'LandParcel',
  },
  '7100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Church',
    property_type: 'Building',
  },
  '7200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'PrivateSchool',
    property_type: 'Building',
  },
  '7300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'PrivateHospital',
    property_type: 'Building',
  },
  '7400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'HomesForAged',
    property_type: 'Building',
  },
  '7500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '7600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'MortuaryCemetery',
    property_type: 'LandParcel',
  },
  '7700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'ClubsLodges',
    property_type: 'Building',
  },
  '7800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'SanitariumConvalescentHome',
    property_type: 'Building',
  },
  '7900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8000': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8010': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GovernmentProperty',
    property_type: 'Building',
  },
  '8011': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8020': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8030': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8040': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8050': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GovernmentProperty',
    property_type: 'Building',
  },
  '8090': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'ForestParkRecreation',
    property_type: 'LandParcel',
  },
  '8300': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'PublicSchool',
    property_type: 'Building',
  },
  '8400': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'PublicHospital',
    property_type: 'Building',
  },
  '8600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GovernmentProperty',
    property_type: 'Building',
  },
  '8701': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8710': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '8800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GovernmentProperty',
    property_type: 'Building',
  },
  '8900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'GovernmentProperty',
    property_type: 'Building',
  },
  '9000': {
    ownership_estate_type: 'Leasehold',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'LandParcel',
  },
  '9100': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Utility',
    property_type: 'Building',
  },
  '9110': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '9200': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'MineralProcessing',
    property_type: 'LandParcel',
  },
  '9300': {
    ownership_estate_type: 'SubsurfaceRights',
    build_status: 'VacantLand',
    property_usage_type: 'ReferenceParcel',
    property_type: 'LandParcel',
  },
  '9400': {
    ownership_estate_type: 'RightOfWay',
    build_status: 'VacantLand',
    property_usage_type: 'ReferenceParcel',
    property_type: 'LandParcel',
  },
  '9500': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'RiversLakes',
    property_type: 'LandParcel',
  },
  '9600': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'VacantLand',
    property_usage_type: 'Conservation',
    property_type: 'LandParcel',
  },
  '9601': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '9700': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'TransportationTerminal',
    property_type: 'Building',
  },
  '9800': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
  '9900': {
    ownership_estate_type: 'FeeSimple',
    build_status: 'Improved',
    property_usage_type: 'Unknown',
    property_type: 'Building',
  },
};

const PROPERTY_USE_DESCRIPTION_INDEX = {
  'ACRG NOT AG': '9900',
  'ACRGNOTAG': '9900',
  'AIRPORT': '2000',
  'AUTO SALES': '2700',
  'AUTOSALES': '2700',
  'BOTTLER': '4500',
  'BOWLING ALLEY': '3400',
  'BOWLINGALLEY': '3400',
  'CAMPS': '3600',
  'CENTRALLY ASSD': '9800',
  'CENTRALLYASSD': '9800',
  'CHURCHES': '7100',
  'CLB/LDG/UN HALL': '7700',
  'CLB/LDG/UNHALL': '7700',
  'CLBLDGUNHALL': '7700',
  'COLLEGE-WTR MGT DIST': '8400',
  'COLLEGE-WTRMGTDIST': '8400',
  'COLLEGEWTRMGTDIST': '8400',
  'COMMERCIAL RET. POND': '9601',
  'COMMERCIALRET.POND': '9601',
  'COMMERCIALRETPOND': '9601',
  'COMMON AREA': '0900',
  'COMMONAREA': '0900',
  'CONDOMINIUM': '0400',
  'COUNTY VACANT/XFEATURES': '8010',
  'COUNTY-SCH BRD VACANT/XF': '8011',
  'COUNTY-SCHBRDVACANT/XF': '8011',
  'COUNTYSCHBRDVACANTXF': '8011',
  'COUNTYVACANT/XFEATURES': '8010',
  'COUNTYVACANTXFEATURES': '8010',
  'CROPSOIL CLASS1': '5100',
  'CROPSOIL CLASS2': '5200',
  'CROPSOIL CLASS3': '5300',
  'CROPSOILCLASS1': '5100',
  'CROPSOILCLASS2': '5200',
  'CROPSOILCLASS3': '5300',
  'CTY INC NONMUNI': '8600',
  'CTYINCNONMUNI': '8600',
  'CULTURAL': '7900',
  'DAIRIES/FEEDLTS': '6800',
  'DAIRIESFEEDLTS': '6800',
  'DEPT STORE': '1300',
  'DEPTSTORE': '1300',
  'FEDERAL': '8800',
  'FEDERAL VACANT/XFEATURES': '8040',
  'FEDERALVACANT/XFEATURES': '8040',
  'FEDERALVACANTXFEATURES': '8040',
  'FINANCIAL': '2300',
  'FLEX SPACE': '4801',
  'FLEXSPACE': '4801',
  'FLORIST': '3000',
  'FOOD PROCESSING': '4600',
  'FOODPROCESSING': '4600',
  'FOREST/PK/REC-WTR MGT DST': '8200',
  'FOREST/PK/REC-WTRMGTDST': '8200',
  'FORESTPKRECWTRMGTDST': '8200',
  'GOLF COURSE': '3800',
  'GOLFCOURSE': '3800',
  'GRZGSOIL CLASS1': '6000',
  'GRZGSOIL CLASS2': '6100',
  'GRZGSOIL CLASS3': '6200',
  'GRZGSOIL CLASS6': '6500',
  'GRZGSOILCLASS1': '6000',
  'GRZGSOILCLASS2': '6100',
  'GRZGSOILCLASS3': '6200',
  'GRZGSOILCLASS6': '6500',
  'HEAVY MFG': '4200',
  'HEAVYMFG': '4200',
  'HOSPITAL': '8500',
  'IMPROVED AGRI': '5000',
  'IMPROVEDAGRI': '5000',
  'INSURANCE': '2400',
  'LEASEHOLD INT': '9000',
  'LEASEHOLDINT': '9000',
  'LIGHT MFG': '4100',
  'LIGHTMFG': '4100',
  'LUMBER YD/MILL': '4300',
  'LUMBERYD/MILL': '4300',
  'LUMBERYDMILL': '4300',
  'MFR <10 UNITS': '0800',
  'MFR <10 UNITS WITH ADU': '0802',
  'MFR10UNITS': '0800',
  'MFR10UNITSWITHADU': '0802',
  'MFR<10UNITS': '0800',
  'MFR<10UNITSWITHADU': '0802',
  'MIN PROCESSING': '4700',
  'MING/PET/GASLND': '9200',
  'MINGPETGASLND': '9200',
  'MINI STORAGE WH': '4803',
  'MINISTORAGEWH': '4803',
  'MINPROCESSING': '4700',
  'MISC. RESIDENCE': '0700',
  'MISC.RESIDENCE': '0700',
  'MISCRESIDENCE': '0700',
  'MOBILE HOME': '0200',
  'MOBILE HOME SINKHOLE': '0201',
  'MOBILE HOME WITH ADU': '0202',
  'MOBILEHOME': '0200',
  'MOBILEHOMESINKHOLE': '0201',
  'MOBILEHOMEWITHADU': '0202',
  'MORT/CEMETERY': '7600',
  'MORTCEMETERY': '7600',
  'MOTEL': '3900',
  'MULTIFAMILY': '0300',
  'MUNICIPAL': '8900',
  'MUNICIPAL VACANT/XFEATURE': '8050',
  'MUNICIPALVACANT/XFEATURE': '8050',
  'MUNICIPALVACANTXFEATURE': '8050',
  'NIGHT CLUBS': '3300',
  'NIGHTCLUBS': '3300',
  'NURSING HOME': '7400',
  'NURSINGHOME': '7400',
  'OFF MULTISTORY': '1800',
  'OFFICE 1 STORY': '1700',
  'OFFICE1STORY': '1700',
  'OFFMULTISTORY': '1800',
  'OPEN STORAGE': '4900',
  'OPENSTORAGE': '4900',
  'ORCHARD GROVES': '6600',
  'ORCHARDGROVES': '6600',
  'ORN/MISC AGRI': '6900',
  'ORN/MISCAGRI': '6900',
  'ORNMISCAGRI': '6900',
  'ORPHNG/NON-PROF': '7500',
  'ORPHNGNONPROF': '7500',
  'OTHER PUBLIC VAC/XFEATURE': '8090',
  'OTHERPUBLICVAC/XFEATURE': '8090',
  'OTHERPUBLICVACXFEATURE': '8090',
  'OUTDR REC/PK LD': '9700',
  'OUTDR REC PK LD': '9700',
  'OUTDR REC PKLD': '9700',
  'OUTDRREC/PKLD': '9700',
  'OUTDRRECPKLD': '9700',
  'PKG LOT (COMM)': '2800',
  'PKGLOT(COMM)': '2800',
  'PKGLOTCOMM': '2800',
  'POST OFFICE': '1701',
  'POSTOFFICE': '1701',
  'POUL/BEES/FISH': '6700',
  'POULBEESFISH': '6700',
  'PROF OFFICES': '1900',
  'PROFOFFICES': '1900',
  'PRV HOSPITAL': '7300',
  'PRV SCHL/COLL': '7200',
  'PRVHOSPITAL': '7300',
  'PRVSCHL/COLL': '7200',
  'PRVSCHLCOLL': '7200',
  'PUB CTY SCHOOL': '8300',
  'PUBCTYSCHOOL': '8300',
  'RACETRACK': '3700',
  'RAILROAD OWNED-LOCAL ASSD': '9110',
  'RAILROADOWNED-LOCALASSD': '9110',
  'RAILROADOWNEDLOCALASSD': '9110',
  'REST DRIVE-IN': '2200',
  'RESTDRIVE-IN': '2200',
  'RESTDRIVEIN': '2200',
  'RESTAURANT': '2100',
  'RETIREMENT': '0600',
  'RIGHT-OF-WAY': '9400',
  'RIGHTOFWAY': '9400',
  'RIVERS/LAKES': '9500',
  'RIVERSLAKES': '9500',
  'SANI/ REST HOME': '7800',
  'SANI/RESTHOME': '7800',
  'SANIRESTHOME': '7800',
  'SERV STATIONS': '2600',
  'SERVICESHOPS': '2500',
  'SERVSTATIONS': '2600',
  'SERVICE SHOPS': '2500',
  'SEWG/WASTE LAND': '9600',
  'SEWG/WASTELAND': '9600',
  'SEWGWASTELAND': '9600',
  'SH CTR CMMITY': '1600',
  'SH CTR NBHD': '1601',
  'SHCTRCMMITY': '1600',
  'SHCTRNBHD': '1601',
  'SINGLE FAMILY': '0100',
  'SINGLE FAMILY SINKHOLE': '0101',
  'SINGLE FAMILY WITH ADU': '0102',
  'SINGLEFAMILY': '0100',
  'SINGLEFAMILYSINKHOLE': '0101',
  'SINGLEFAMILYWITHADU': '0102',
  'STATE OF FLA - TIITF': '8701',
  'STATE(NOT TIITF)VAC/XF': '8020',
  'STATE(NOTTIITF)VAC/XF': '8020',
  'STATE(TIITF) VACANT/XF': '8030',
  'STATE(TIITF)VACANT/XF': '8030',
  'STATE-NOT TIITF': '8700',
  'STATE-NOTTIITF': '8700',
  'STATENOTTIITF': '8700',
  'STATENOTTIITFVACXF': '8020',
  'STATEOFFLA-TIITF': '8701',
  'STATEOFFLATIITF': '8701',
  'STATETIITFVACANTXF': '8030',
  'STORE/OFF/RES': '1200',
  'STOREOFFRES': '1200',
  'STORES': '1100',
  'SUBSURF RIGHTS': '9300',
  'SUBSURFRIGHTS': '9300',
  'SUPERMARKET': '1400',
  'THEATER': '3200',
  'TMBR NOT CLSSFD': '5900',
  'TMBR SI 60-69': '5700',
  'TMBR SI 70-79': '5600',
  'TMBR SI 80-89': '5500',
  'TMBR SI 90+': '5400',
  'TMBRNOTCLSSFD': '5900',
  'TMBRSI60-69': '5700',
  'TMBRSI6069': '5700',
  'TMBRSI70-79': '5600',
  'TMBRSI7079': '5600',
  'TMBRSI80-89': '5500',
  'TMBRSI8089': '5500',
  'TMBRSI90': '5400',
  'TMBRSI90+': '5400',
  'TOURIST ATTRACTION': '3500',
  'TOURISTATTRACTION': '3500',
  'UTILITY': '9100',
  'VACANT': '0000',
  'VACANT COMM': '1000',
  'VACANT INDUSTRIAL': '4000',
  'VACANT INSTITUTIONAL': '7000',
  'VACANTCOMM': '1000',
  'VACANTINDUSTRIAL': '4000',
  'VACANTINSTITUTIONAL': '7000',
  'VET OFFICES': '1901',
  'VETOFFICES': '1901',
  'WAREH/DIST TERM': '4800',
  'WAREH/DISTTERM': '4800',
  'WAREHDISTTERM': '4800',
  'WATER MANAGEMENT DIST': '8710',
  'WATER MGT DIST VAC/XFEAT': '8000',
  'WATERMANAGEMENTDIST': '8710',
  'WATERMGTDISTVAC/XFEAT': '8000',
  'WATERMGTDISTVACXFEAT': '8000',
  'WHOLESALER': '2900',
};

function textOf($, el) {
  return $(el).text().trim();
}

const SUMMARY_SELECTOR =
  "#ctlBodyPane_ctl02_ctl01_dynamicSummaryData_divSummary";
const LAND_TABLE_SELECTOR = "#ctlBodyPane_ctl10_ctl01_gvwLandLine";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl06_ctl01_grdValuation";

function normalizeLabelKey(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function findRowValueByTh($, moduleSelector, thTextStartsWith) {
  const rows = $(`${moduleSelector} table.tabular-data-two-column tbody tr`);
  const normalizedTarget = normalizeLabelKey(thTextStartsWith);
  for (let i = 0; i < rows.length; i++) {
    const th = $(rows[i]).find("th strong").first();
    const thTxt = textOf($, th);
    if (
      thTxt &&
      (thTxt.toLowerCase().startsWith(thTextStartsWith.toLowerCase()) ||
        normalizeLabelKey(thTxt).startsWith(normalizedTarget))
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
    "Land Use",
    "LandUse",
  ];
  for (const label of candidates) {
    const value = getSummaryValue($, label);
    if (value) return value;
  }
  return null;
}

function mapPropertyUseCode(rawValue) {
  const defaults = PROPERTY_USE_DEFAULT;
  if (!rawValue) {
    return {
      class_name: null,
      code: null,
      description: null,
      ...defaults,
    };
  }
  const match = rawValue.match(/\((\d{4})\)\s*$/);
  let rawCode = match ? match[1] : null;
  if (!rawCode) {
    const generalMatch = rawValue.match(/(\d{4})/);
    rawCode = generalMatch ? generalMatch[1] : null;
  }
  const normalizedCode = rawCode ? rawCode.padStart(4, "0") : null;
  const description = rawValue
    .replace(/\(\d{4}\)\s*$/, "")
    .replace(/\s*=>\s*/g, " => ")
    .trim() || null;
  const normalizedDescription = normalizePropertyClassName(description);
  const compressedDescription = normalizedDescription
    ? normalizedDescription.replace(/\s+/g, "")
    : null;
  const sanitizedDescription = normalizedDescription
    ? normalizedDescription.replace(/[^A-Z0-9]+/g, "")
    : null;
  const resolvedCode =
    (normalizedCode && PROPERTY_USE_MAPPINGS[normalizedCode] ? normalizedCode : null) ||
    (normalizedDescription && PROPERTY_USE_DESCRIPTION_INDEX[normalizedDescription]) ||
    (compressedDescription && PROPERTY_USE_DESCRIPTION_INDEX[compressedDescription]) ||
    (sanitizedDescription && PROPERTY_USE_DESCRIPTION_INDEX[sanitizedDescription]) ||
    normalizedCode;
  const mapping =
    (resolvedCode && PROPERTY_USE_MAPPINGS[resolvedCode]) || defaults;
  return {
    class_name: description,
    code: resolvedCode,
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
      type: cells[0] || null,
      primary: cells[1] || null,
      active: cells[2] || null,
      issueDate: cells[3] || null,
      value: cells[4] || null,
    });
  });
  return rows;
}

function parseSales($) {
  let salesTable = $("#ctlBodyPane_ctl11_ctl01_grdSales");
  if (!salesTable || !salesTable.length) {
    $("section").each((_, section) => {
      if (salesTable && salesTable.length) return false;
      const title = cleanText($(section).find("div.title").first().text()).toLowerCase();
      if (title === "sales" || title.includes("sales history") || title.includes("recent sales")) {
        const candidate = $(section).find("table").first();
        if (candidate && candidate.length) {
          salesTable = candidate;
          return false;
        }
      }
      return undefined;
    });
  }
  if (!salesTable || !salesTable.length) return [];

  const headerCells = salesTable
    .find("thead tr")
    .first()
    .children("th, td");
  const headerLabels = headerCells
    .map((_, cell) => cleanText($(cell).text()).toLowerCase())
    .get();
  if (!headerLabels.length) return [];

  const findHeaderIndex = (keywords) => {
    if (!keywords || !keywords.length) return -1;
    return headerLabels.findIndex((label) =>
      keywords.some((kw) => label.includes(kw)),
    );
  };

  const columnIndex = {
    date: findHeaderIndex(["sale date", "date"]),
    price: findHeaderIndex(["sale price", "price"]),
    instrument: findHeaderIndex(["instrument", "deed"]),
    book: findHeaderIndex(["book"]),
    page: findHeaderIndex(["page"]),
    volume: findHeaderIndex(["volume"]),
    qualification: findHeaderIndex(["qualification"]),
    vacantImproved: findHeaderIndex(["vacant", "improved"]),
    grantor: findHeaderIndex(["grantor", "seller"]),
    grantee: findHeaderIndex(["grantee", "buyer", "purchaser", "owner"]),
  };

  const extractCellText = ($cell) => {
    if (!$cell || !$cell.length) return null;
    const clone = $cell.clone();
    clone.find("script, style").remove();
    clone.find(".sr-only").remove();
    clone.find("br").replaceWith(" ");
    const text = cleanText(clone.text());
    return text || null;
  };

  const getCell = (cells, idx) =>
    idx >= 0 && idx < cells.length ? cells.eq(idx) : null;

  const rows = salesTable.find("tbody tr");
  const sales = [];
  rows.each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.children("th, td");
    if (!cells.length) return;

    const dateText =
      columnIndex.date >= 0
        ? extractCellText(getCell(cells, columnIndex.date))
        : null;
    const priceCell =
      columnIndex.price >= 0
        ? getCell(cells, columnIndex.price)
        : null;
    const priceText = priceCell ? extractCellText(priceCell) : null;
    if (!dateText) return;

    const instrumentText =
      columnIndex.instrument >= 0
        ? extractCellText(getCell(cells, columnIndex.instrument))
        : null;
    const bookCell = getCell(cells, columnIndex.book);
    const pageCell = getCell(cells, columnIndex.page);
    const bookText =
      columnIndex.book >= 0 ? extractCellText(bookCell) : null;
    const pageText =
      columnIndex.page >= 0 ? extractCellText(pageCell) : null;
    const qualificationText =
      columnIndex.qualification >= 0
        ? extractCellText(getCell(cells, columnIndex.qualification))
        : null;
    const vacantImprovedText =
      columnIndex.vacantImproved >= 0
        ? extractCellText(getCell(cells, columnIndex.vacantImproved))
        : null;
    const grantorText =
      columnIndex.grantor >= 0
        ? extractCellText(getCell(cells, columnIndex.grantor))
        : null;
    const granteeText =
      columnIndex.grantee >= 0
        ? extractCellText(getCell(cells, columnIndex.grantee))
        : null;

    let volumeText =
      columnIndex.volume >= 0
        ? extractCellText(getCell(cells, columnIndex.volume))
        : null;

    const docLinkMap = new Map();
    const registerDocLink = (href, overrides = {}) => {
      if (!href) return;
      const trimmed = String(href).trim();
      if (!trimmed) return;
      const existing =
        docLinkMap.get(trimmed) || {
          url: trimmed,
          book: null,
          page: null,
          volume: null,
          instrument_number: null,
        };
      const parsed = parseDeedLink(trimmed);
      const merged = {
        url: trimmed,
        book:
          existing.book ||
          overrides.book ||
          parsed.book ||
          null,
        page:
          existing.page ||
          overrides.page ||
          parsed.page ||
          null,
        volume:
          existing.volume ||
          overrides.volume ||
          parsed.volume ||
          null,
        instrument_number:
          existing.instrument_number ||
          overrides.instrument_number ||
          parsed.instrument_number ||
          null,
      };
      docLinkMap.set(trimmed, merged);
    };

    if (bookCell && bookCell.length) {
      const override = { book: bookText || null };
      bookCell.find("a[href]").each((_, anchor) => {
        registerDocLink($(anchor).attr("href"), override);
      });
    }

    if (pageCell && pageCell.length) {
      const override = {
        book: bookText || null,
        page: pageText || null,
      };
      pageCell.find("a[href]").each((_, anchor) => {
        registerDocLink($(anchor).attr("href"), override);
      });
    }

    const documents = Array.from(docLinkMap.values()).map((doc) => {
      const docBook = normalizeId(doc.book);
      const docPage = normalizeId(doc.page);
      const docVolume = normalizeId(doc.volume);
      const docInstrument = normalizeId(doc.instrument_number);
      if (!volumeText && docVolume) {
        volumeText = docVolume;
      }
      return {
        url: doc.url,
        book: docBook,
        page: docPage,
        volume: docVolume,
        instrument_number: docInstrument,
      };
    });

    let clerkUrl = documents.length ? documents[0].url : null;
    let instrumentNumber = null;
    documents.some((doc) => {
      if (!instrumentNumber && doc.instrument_number) {
        instrumentNumber = doc.instrument_number;
      }
      return instrumentNumber != null;
    });
    if (!instrumentNumber) {
      const match =
        instrumentText &&
        instrumentText.match(/\b\d{5,}\b/);
      if (match) {
        instrumentNumber = match[0];
      }
    }

    const firstDocWithBook = documents.find((doc) => doc.book);
    const firstDocWithPage = documents.find((doc) => doc.page);
    const firstDocWithVolume = documents.find((doc) => doc.volume);
    const bookValue = normalizeId(bookText) || (firstDocWithBook ? firstDocWithBook.book : null);
    const pageValue = normalizeId(pageText) || (firstDocWithPage ? firstDocWithPage.page : null);
    const volumeValue = normalizeId(volumeText) || (firstDocWithVolume ? firstDocWithVolume.volume : null);
    const instrumentValue = normalizeId(instrumentNumber);

    const priceValue = moneyToNumber(priceText);
    sales.push({
      date: dateText,
      price: priceValue,
      instrument: instrumentText || null,
      book: bookValue,
      page: pageValue,
      volume: volumeValue,
      qualification: qualificationText || null,
      vacantImproved: vacantImprovedText || null,
      grantor: grantorText || null,
      grantee: granteeText || null,
      clerkUrl: clerkUrl || null,
      instrument_number: instrumentValue,
      documents,
    });
  });
  return sales;
}

function parseDeedLink(href) {
  if (!href) return {};
  try {
    const url = new URL(href, "https://example.com/");
    const lowered = {};
    url.searchParams.forEach((value, key) => {
      if (value == null || value === "") return;
      const normalizedKey = key.toLowerCase();
      if (lowered[normalizedKey] != null) return;
      lowered[normalizedKey] = value;
    });
    const book =
      lowered.booknumber ||
      lowered.book ||
      null;
    const page =
      lowered.pagenumber ||
      lowered.page ||
      null;
    const volume =
      lowered.volume ||
      lowered.vol ||
      lowered.booktype ||
      null;
    const instrument =
      lowered.docid ||
      lowered.instrument ||
      lowered.inst ||
      lowered.instrumentnumber ||
      lowered.docnumber ||
      null;
    return {
      book: book || null,
      page: page || null,
      volume: volume || null,
      instrument_number: instrument || null,
    };
  } catch {
    const match = String(href).match(
      /[?&](?:docid|instrument|inst|instrumentnumber|docnumber)=([A-Za-z0-9]+)/i,
    );
    return {
      book: null,
      page: null,
      volume: null,
      instrument_number: match ? match[1] : null,
    };
  }
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

  // Remove mailing_address.json if it exists from previous runs
  // (not part of the County data group schema)
  const mailingAddressPath = path.join(dataDir, "mailing_address.json");
  if (fs.existsSync(mailingAddressPath)) {
    try {
      fs.unlinkSync(mailingAddressPath);
    } catch {}
  }

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
  const propertySeed = readJSON("property_seed.json");
  if (propertySeed.request_identifier.replaceAll("-","") != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: "Request identifier and parcel id don't match.",
      path: "property.request_identifier",
    };
  }
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
    // Validate names against the pattern: must start with uppercase letter
    const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

    // Validate and clean first_name
    let validFirstName = firstName;
    if (validFirstName && !namePattern.test(validFirstName)) {
      // Try to clean it by removing leading/trailing hyphens and special chars
      validFirstName = validFirstName.replace(/^[\-]+|[\-]+$/g, '').trim();
      // If still invalid after cleaning, set to null
      if (!validFirstName || !namePattern.test(validFirstName)) {
        validFirstName = null;
      }
    }

    // Validate and clean last_name
    let validLastName = lastName;
    if (validLastName && !namePattern.test(validLastName)) {
      // Try to clean it by removing leading/trailing hyphens and special chars
      validLastName = validLastName.replace(/^[\-]+|[\-]+$/g, '').trim();
      // If still invalid after cleaning, set to null
      if (!validLastName || !namePattern.test(validLastName)) {
        validLastName = null;
      }
    }

    // Skip if both first and last names are invalid
    if (!validFirstName && !validLastName) {
      return null;
    }

    // Set default empty string if name is null but we have at least one valid name
    const finalFirstName = validFirstName || "";
    const finalLastName = validLastName || "";

    // Validate middle_name against the pattern
    const middleName = middleRaw && namePattern.test(middleRaw) ? middleRaw : null;

    const key =
      finalFirstName || finalLastName
        ? `${finalFirstName.toLowerCase()}|${middleRaw.toLowerCase()}|${finalLastName.toLowerCase()}`
        : null;

    if (key && personLookup.has(key)) {
      return personLookup.get(key);
    }

    personIndex += 1;
    const filename = `person_${personIndex}.json`;
    const personObj = {
      birth_date: personData.birth_date || null,
      first_name: finalFirstName,
      last_name: finalLastName,
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

  const buildingLayoutsInfo = [];
  const buildingInfoByIndex = new Map();
  const buildingMetaByIndex = new Map();

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
      mapPermitImprovementType(permit.type) || "Other";
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
    if (typeCode === "FLA" || desc.includes("FLOOR LIV") || typeCode === "BAS")
      return "Living Area";
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
    if (desc.includes("GARAGE")) return "Garage";
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
            mapSubAreaLayoutType(subArea) ||
            titleCase(subArea.description || subArea.type || "Sub Area");
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
      "Levy",
    country_code: "US",
  };
  if (!address.unnormalized_address && addrFromHTML.addrLine1) {
    address.unnormalized_address = addrFromHTML.addrLine1;
  }
  delete address.latitude;
  delete address.longitude;
  const addressFilename = "address.json";
  const addressPath = `./${addressFilename}`;
  writeJSON(path.join(dataDir, addressFilename), address);

  const geomLatitude =
    unaddr && unaddr.latitude != null ? parseFloatSafe(unaddr.latitude) : null;
  const geomLongitude =
    unaddr && unaddr.longitude != null ? parseFloatSafe(unaddr.longitude) : null;
  const geometryObject = {
    latitude: geomLatitude,
    longitude: geomLongitude,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
  };
  const geometryFilename = "geometry.json";
  const geometryPath = `./${geometryFilename}`;
  writeJSON(path.join(dataDir, geometryFilename), geometryObject);

  const relAddressGeometry = makeRelationshipFilename(addressPath, geometryPath);
  if (relAddressGeometry) {
    writeJSON(path.join(dataDir, relAddressGeometry), {
      from: { "/": addressPath },
      to: { "/": geometryPath },
    });
  }

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

  const ownerMailingInfo = parseOwnerMailingAddresses($);
  const primaryMailingAddress =
    (ownerMailingInfo &&
      ((ownerMailingInfo.uniqueAddresses &&
        ownerMailingInfo.uniqueAddresses[0]) ||
        (ownerMailingInfo.rawAddresses &&
          ownerMailingInfo.rawAddresses[0]))) ||
    null;

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

  // Note: mailing_address.json creation removed as it's not part of the expected schema for this data group

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

  // Parse sales first to determine if we should create current owner entities
  const sales = parseSales($);

  // Note: currentOwnerEntities will be created later, only if we have a valid sale to link them to
  const salesSorted = sales.sort(
    (a, b) => new Date(toISOFromMDY(b.date)) - new Date(toISOFromMDY(a.date)),
  );

  const saleFileRefs = [];
  const saleOwnerRelations = [];
  const saleBuyerTargets = new Map();

  const addSaleOwnerRelation = (fromPath, toPath) => {
    if (!fromPath || !toPath) return;
    let buyerSet = saleBuyerTargets.get(fromPath);
    if (!buyerSet) {
      buyerSet = new Set();
      saleBuyerTargets.set(fromPath, buyerSet);
    }
    if (buyerSet.has(toPath)) return;
    buyerSet.add(toPath);
    saleOwnerRelations.push({
      fromPath,
      toPath,
    });
  };

  let deedDocumentFileCounter = 0;

  salesSorted.forEach((s, idx) => {
    const iso = toISOFromMDY(s.date) || null;
    const saleIdx = idx + 1;
    const salesFilename = `sales_history_${saleIdx}.json`;
    const salesPath = `./${salesFilename}`;
    const purchasePrice =
      typeof s.price === "number" && Number.isFinite(s.price)
        ? s.price
        : null;
    const saleObj = {
      ownership_transfer_date: iso,
      purchase_price_amount: purchasePrice,
    };
    writeJSON(path.join(dataDir, salesFilename), saleObj);

    const deedTypeLabel = mapDeedType(s.instrument);
    const rawDocRecords = Array.isArray(s.documents)
      ? s.documents.filter((doc) => doc && doc.url)
      : [];
    const normalizedDocRecords = [];
    const seenDocUrls = new Set();
    rawDocRecords.forEach((doc) => {
      const url = doc.url ? String(doc.url).trim() : "";
      if (!url) return;
      const urlKey = url.toLowerCase();
      if (seenDocUrls.has(urlKey)) return;
      seenDocUrls.add(urlKey);
      normalizedDocRecords.push({
        url,
        book: normalizeId(doc.book),
        page: normalizeId(doc.page),
        volume: normalizeId(doc.volume),
        instrument_number: normalizeId(doc.instrument_number),
      });
    });
    if (!normalizedDocRecords.length && s.clerkUrl) {
      const fallbackUrl = String(s.clerkUrl).trim();
      if (fallbackUrl) {
        normalizedDocRecords.push({
          url: fallbackUrl,
          book: normalizeId(s.book),
          page: normalizeId(s.page),
          volume: normalizeId(s.volume),
          instrument_number: normalizeId(s.instrument_number),
        });
      }
    }

    const findDocFieldValue = (field) => {
      for (const doc of normalizedDocRecords) {
        if (doc && doc[field]) return doc[field];
      }
      return null;
    };

    const bookVal = normalizeId(s.book) || findDocFieldValue("book");
    const pageVal = normalizeId(s.page) || findDocFieldValue("page");
    const volumeVal = normalizeId(s.volume) || findDocFieldValue("volume");
    const instrumentVal =
      normalizeId(s.instrument_number) || findDocFieldValue("instrument_number");

    let deedPath = null;
    const hasDeedInfo =
      normalizeId(s.instrument) ||
      bookVal ||
      pageVal ||
      volumeVal ||
      instrumentVal ||
      normalizedDocRecords.length;

    if (hasDeedInfo) {
      const deedFilename = `deed_${saleIdx}.json`;
      deedPath = `./${deedFilename}`;
      const deedObj = {
        deed_type: deedTypeLabel,
      };
      if (bookVal) deedObj.book = bookVal;
      if (pageVal) deedObj.page = pageVal;
      if (volumeVal) deedObj.volume = volumeVal;
      if (instrumentVal) {
        deedObj.instrument_number = instrumentVal;
      }
      writeJSON(path.join(dataDir, deedFilename), deedObj);

      const documentType = coerceFileDocumentType(
        mapFileDocumentType(s.instrument),
      );
      normalizedDocRecords.forEach((docMeta) => {
        if (!docMeta || !docMeta.url) return;
        deedDocumentFileCounter += 1;
        const fileFilename = `file_${deedDocumentFileCounter}.json`;
        const filePath = `./${fileFilename}`;
        const nameParts = [];
        if (deedTypeLabel && deedTypeLabel !== "Miscellaneous") {
          nameParts.push(deedTypeLabel);
        } else if (s.instrument) {
          nameParts.push(String(s.instrument).trim());
        }
        if (docMeta.volume) nameParts.push(`Vol ${docMeta.volume}`);
        if (docMeta.book) nameParts.push(`Book ${docMeta.book}`);
        if (docMeta.page) nameParts.push(`Page ${docMeta.page}`);
        const docInstrument =
          docMeta.instrument_number || instrumentVal || null;
        if (docInstrument) {
          nameParts.push(`Instrument #${docInstrument}`);
        }
        if (!nameParts.length && iso) {
          nameParts.push(`Recorded ${iso}`);
        }
        const fileObj = {
          file_format: null,
          name: nameParts.length
            ? nameParts.join(" - ")
            : `Deed Document ${saleIdx}`,
          original_url: docMeta.url,
          ipfs_url: null,
          document_type: documentType,
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
      });

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
        addSaleOwnerRelation(salesPath, personPath);
      } else if (owner.type === "company") {
        const companyPath = createCompanyRecord(owner.name || "");
        addSaleOwnerRelation(salesPath, companyPath);
      }
    });

    saleFileRefs.push({ saleIdx, dateISO: iso, salesPath });
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
      const existingBuyers = saleBuyerTargets.get(ref.salesPath);
      if (existingBuyers && existingBuyers.size) return;
      const ownersArr = ownersByDate[dateKey] || [];
      ownersArr.forEach((owner) => {
        if (!owner || !owner.type) return;
        if (owner.type === "person") {
          const normalized = normalizeOwner(owner, ownersByDate);
          const personPath = createPersonRecord(normalized);
          addSaleOwnerRelation(ref.salesPath, personPath);
        } else if (owner.type === "company") {
          const companyPath = createCompanyRecord(owner.name || "");
          addSaleOwnerRelation(ref.salesPath, companyPath);
        }
      });
    });
  }

  const latestSaleRef = saleFileRefs.length ? saleFileRefs[0] : null;

  // Only create current owner entities if we have a valid sale to link them to
  const currentOwnerEntities = [];
  if (latestSaleRef && latestSaleRef.salesPath) {
    // Create person/company records for current owners
    currentOwners.forEach((owner) => {
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

    // Link current owner entities to the latest sale
    currentOwnerEntities.forEach((entity) => {
      if (!entity.path) return;
      addSaleOwnerRelation(latestSaleRef.salesPath, entity.path);
    });
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
