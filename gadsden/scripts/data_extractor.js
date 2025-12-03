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
  if (!str) return "";

  // Handle abbreviations with periods (e.g., "D.O.T." -> "Dot")
  // Pattern: Single letters separated by periods
  if (/^([A-Z]\.)+[A-Z]?\.?$/i.test(str.trim())) {
    // Remove all periods and title case the result
    const withoutPeriods = str.replace(/\./g, '');
    return withoutPeriods.charAt(0).toUpperCase() + withoutPeriods.slice(1).toLowerCase();
  }

  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normalizeLayoutSpaceType(rawValue, fallbackValue) {
  const candidates = [rawValue, fallbackValue, "Living Area"];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const trimmed = String(candidate).trim();
    if (trimmed) return trimmed;
  }
  return "Living Area";
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

  // Strip trailing periods before processing
  const stripTrailingPeriod = (str) => {
    if (!str) return str;
    const stripped = str.replace(/\.$/, '');
    // If the result is empty or contains no letters, return null
    if (!stripped || !/[a-zA-Z]/.test(stripped)) return null;
    return stripped;
  };

  // Extract suffix from tokens - check last token(s)
  const suffixMap = {
    'jr': 'Jr.',
    'sr': 'Sr.',
    'ii': 'II',
    'iii': 'III',
    'iv': 'IV',
    'v': 'V',
    'vi': 'VI',
    'vii': 'VII',
    'viii': 'VIII',
    'ix': 'IX',
    'x': 'X',
    'md': 'MD',
    'phd': 'PhD',
    'esq': 'Esq.',
    'esquire': 'Esq.',
    'jd': 'JD',
    'llm': 'LLM',
    'mba': 'MBA',
    'rn': 'RN',
    'dds': 'DDS',
    'dvm': 'DVM',
    'cfa': 'CFA',
    'cpa': 'CPA',
    'pe': 'PE',
    'pmp': 'PMP',
    'emeritus': 'Emeritus',
    'ret': 'Ret.'
  };

  let suffix = null;
  let workingTokens = [...tokens];

  // Check last token for suffix
  if (workingTokens.length > 2) {
    const lastToken = workingTokens[workingTokens.length - 1];
    const stripped = stripTrailingPeriod(lastToken);
    if (stripped && suffixMap[stripped.toLowerCase()]) {
      suffix = suffixMap[stripped.toLowerCase()];
      workingTokens.pop();
    }
  }

  if (workingTokens.length < 2) return null;

  // Determine if name is in "FIRST MIDDLE LAST" or "LAST FIRST MIDDLE" format
  // Heuristic: If last token is longest or first token is short (1-2 chars), likely FIRST MIDDLE LAST
  // Example: "W C DAWKINS" -> FIRST=W, MIDDLE=C, LAST=DAWKINS (first token short)
  // Example: "MARY WELLS DAWKINS" -> FIRST=MARY, MIDDLE=WELLS, LAST=DAWKINS (last token longest)
  // Example: "DAWKINS WILLIAM" -> LAST=DAWKINS, FIRST=WILLIAM (first token longest)
  const firstTokenLen = workingTokens[0].length;
  const lastTokenLen = workingTokens[workingTokens.length - 1].length;
  const firstTokenShort = firstTokenLen <= 2;
  const lastTokenLongest = lastTokenLen >= firstTokenLen;
  const useFirstMiddleLast = firstTokenShort || lastTokenLongest;

  let last, first, middle;

  if (useFirstMiddleLast) {
    // Format: FIRST MIDDLE LAST
    first = workingTokens[0];
    if (workingTokens.length === 2) {
      last = workingTokens[1];
      middle = null;
    } else {
      // Multiple tokens after first
      last = workingTokens[workingTokens.length - 1];
      middle = workingTokens.slice(1, -1).join(" ") || null;
    }
  } else {
    // Format: LAST FIRST MIDDLE (default)
    last = workingTokens[0];
    first = workingTokens[1] || null;
    middle = workingTokens.length > 2 ? workingTokens.slice(2).join(" ") : null;
  }

  if (
    fallbackLastName &&
    workingTokens.length <= 2 &&
    workingTokens[0] &&
    workingTokens[0] === workingTokens[0].toUpperCase() &&
    workingTokens[1]
  ) {
    first = workingTokens[0];
    middle = workingTokens[1] || null;
    last = fallbackLastName;
  }

  first = stripTrailingPeriod(first);
  last = stripTrailingPeriod(last);
  middle = middle ? stripTrailingPeriod(middle) : null;

  const titleCasedFirst = titleCase(first || "");
  const titleCasedLast = titleCase(last || "");
  const titleCasedMiddleRaw = middle ? titleCase(middle) : null;

  // Validate names match the schema pattern: ^[A-Z][a-zA-Z\s\-',.]*$
  const namePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  const isValidName = (name) => name && /[a-zA-Z]/.test(name) && namePattern.test(name);

  if (!isValidName(titleCasedFirst) || !isValidName(titleCasedLast)) {
    return null;
  }

  // Validate middle_name if present - set to null if it doesn't match pattern
  const titleCasedMiddle = titleCasedMiddleRaw && isValidName(titleCasedMiddleRaw) ? titleCasedMiddleRaw : null;

  return {
    type: "person",
    first_name: titleCasedFirst,
    last_name: titleCasedLast,
    middle_name: titleCasedMiddle,
    suffix_name: suffix,
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

      // Check if last token is a suffix before trying to split multiple persons
      const stripTrailingPeriod = (str) => {
        if (!str) return str;
        const stripped = str.replace(/\.$/, '');
        // If the result is empty or contains no letters, return null
        if (!stripped || !/[a-zA-Z]/.test(stripped)) return null;
        return stripped;
      };
      const lastToken = tokens[tokens.length - 1];
      const lastTokenStripped = stripTrailingPeriod(lastToken);
      const isLastTokenSuffix = lastTokenStripped && SUFFIXES_IGNORE.test(lastTokenStripped.toLowerCase());

      if (andParts.length === 1 && tokens.length >= 4 && !isLastTokenSuffix) {
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
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
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
    // Nullify empty or invalid middle_name
    if (o.type === "person") {
      if (!o.middle_name || !o.middle_name.trim() || !namePattern.test(o.middle_name)) {
        o.middle_name = null;
      }
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

const PROPERTY_USE_CODE_DEFAULTS = {
  ownership_estate_type: "FeeSimple",
  build_status: "Improved",
  structure_form: null,
  property_usage_type: "Unknown",
  property_type: "Building",
};

const PROPERTY_USE_CODE_MAP = Object.create(null);
const PROPERTY_USE_CODES = [
  "00000","00100","00101","00102","00200","00201","00202","00300","0300","00400","00600",
  "00700","00800","00802","00900","01000","01100","01200","01300","01400","01600",
  "01601","01700","01701","01800","01900","01901","02000","02100","02200","02300",
  "02400","02500","02600","02700","02800","02900","03000","03200","03300","03400",
  "03500","03600","03700","03800","03900","04000","04100","04200","04300","04500",
  "04600","04700","04800","04801","04803","04900","05000","05100","05200","05300",
  "05400","05500","05600","05700","05900","06000","06100","06200","06500","06600",
  "06700","06800","06900","07000","07100","07200","07300","07400","07500","07600",
  "07700","07800","07900","08000","08010","08011","08020","08030","08040","08050",
  "08090","08200","08300","08400","08500","08600","08700","08701","08710","08800",
  "08900","09000","09100","09110","09200","09300","09400","09500","09600","09601",
  "09700","09800","09900"
];

function collectPropertyUseCodeVariants(code) {
  if (code == null) return [];
  const digits = String(code)
    .trim()
    .replace(/\D+/g, "");
  if (!digits) return [];
  const variants = new Set();
  variants.add(digits);
  variants.add(digits.padStart(4, "0"));
  variants.add(digits.padStart(5, "0"));
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed) {
    variants.add(trimmed);
    if (trimmed.length >= 4) {
      variants.add(trimmed.slice(-4));
      variants.add(trimmed.padStart(5, "0"));
    } else {
      variants.add(trimmed.padStart(4, "0"));
      variants.add(trimmed.padStart(5, "0"));
    }
  } else {
    variants.add("0000");
    variants.add("00000");
  }
  return Array.from(variants);
}

function addPropertyUseMapping(codes, overrides) {
  for (const code of codes) {
    const variants = collectPropertyUseCodeVariants(code);
    if (!variants.length) continue;
    const value = {
      ...PROPERTY_USE_CODE_DEFAULTS,
      ...overrides,
    };
    for (const variant of variants) {
      PROPERTY_USE_CODE_MAP[variant] = {
        ...value,
      };
    }
  }
}

addPropertyUseMapping(["00000"], {
  build_status: "VacantLand",
  property_usage_type: "Unknown",
  property_type: "LandParcel",
});

addPropertyUseMapping(["00100", "00101", "00102"], {
  property_usage_type: "Residential",
  structure_form: "SingleFamilyDetached",
});

addPropertyUseMapping(["00200", "00201", "00202"], {
  property_usage_type: "Residential",
  property_type: "ManufacturedHome",
  structure_form: "ManufacturedHousing",
});

addPropertyUseMapping(["00300", "0300"], {
  property_usage_type: "Residential",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["00400"], {
  ownership_estate_type: "Condominium",
  property_usage_type: "Residential",
  property_type: "Unit",
  structure_form: "ApartmentUnit",
});

addPropertyUseMapping(["00600"], {
  property_usage_type: "Retirement",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["00700"], {
  property_usage_type: "Residential",
  structure_form: "SingleFamilyDetached",
});

addPropertyUseMapping(["00800", "00802"], {
  property_usage_type: "Residential",
  structure_form: "MultiFamilyLessThan10",
});

addPropertyUseMapping(["00900"], {
  build_status: "VacantLand",
  property_usage_type: "ResidentialCommonElementsAreas",
  property_type: "LandParcel",
});

addPropertyUseMapping(["01000"], {
  build_status: "VacantLand",
  property_usage_type: "Commercial",
  property_type: "LandParcel",
});

addPropertyUseMapping(["01100", "01200", "02500", "03000"], {
  property_usage_type: "RetailStore",
});

addPropertyUseMapping(["01300"], {
  property_usage_type: "DepartmentStore",
});

addPropertyUseMapping(["01400"], {
  property_usage_type: "Supermarket",
});

addPropertyUseMapping(["01600", "01601"], {
  property_usage_type: "ShoppingCenterCommunity",
});

addPropertyUseMapping(["01700", "01800", "01900"], {
  property_usage_type: "OfficeBuilding",
});

addPropertyUseMapping(["01701"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["01901"], {
  property_usage_type: "MedicalOffice",
});

addPropertyUseMapping(["02000"], {
  property_usage_type: "TransportationTerminal",
});

addPropertyUseMapping(["02800"], {
  property_usage_type: "TransportationTerminal",
  property_type: "LandParcel",
});

addPropertyUseMapping(["02100", "02200"], {
  property_usage_type: "Restaurant",
});

addPropertyUseMapping(["02300", "02400"], {
  property_usage_type: "FinancialInstitution",
});

addPropertyUseMapping(["02600"], {
  property_usage_type: "ServiceStation",
});

addPropertyUseMapping(["02700"], {
  property_usage_type: "AutoSalesRepair",
});

addPropertyUseMapping(["02900"], {
  property_usage_type: "WholesaleOutlet",
});

addPropertyUseMapping(["03200"], {
  property_usage_type: "Theater",
});

addPropertyUseMapping(["03300", "03400", "03500"], {
  property_usage_type: "Entertainment",
});

addPropertyUseMapping(["03600"], {
  property_usage_type: "Recreational",
});

addPropertyUseMapping(["03700"], {
  property_usage_type: "RaceTrack",
});

addPropertyUseMapping(["03800"], {
  property_usage_type: "GolfCourse",
  property_type: "LandParcel",
});

addPropertyUseMapping(["03900"], {
  property_usage_type: "Hotel",
});

addPropertyUseMapping(["04000"], {
  build_status: "VacantLand",
  property_usage_type: "Industrial",
  property_type: "LandParcel",
});

addPropertyUseMapping(["04100"], {
  property_usage_type: "LightManufacturing",
});

addPropertyUseMapping(["04200"], {
  property_usage_type: "HeavyManufacturing",
});

addPropertyUseMapping(["04300"], {
  property_usage_type: "LumberYard",
});

addPropertyUseMapping(["04500"], {
  property_usage_type: "Cannery",
});

addPropertyUseMapping(["04600"], {
  property_usage_type: "PackingPlant",
});

addPropertyUseMapping(["04700"], {
  property_usage_type: "MineralProcessing",
});

addPropertyUseMapping(["04800", "04801"], {
  property_usage_type: "Warehouse",
});

addPropertyUseMapping(["04803"], {
  property_usage_type: "Warehouse",
});

addPropertyUseMapping(["04900"], {
  property_usage_type: "OpenStorage",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05000"], {
  property_usage_type: "Agricultural",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05100"], {
  property_usage_type: "DrylandCropland",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05200"], {
  property_usage_type: "CroplandClass2",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05300"], {
  property_usage_type: "CroplandClass3",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05400", "05500", "05600", "05700", "05900"], {
  property_usage_type: "TimberLand",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06000", "06100", "06200", "06500"], {
  property_usage_type: "GrazingLand",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06600"], {
  property_usage_type: "OrchardGroves",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06700"], {
  property_usage_type: "LivestockFacility",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06800"], {
  property_usage_type: "LivestockFacility",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06900"], {
  property_usage_type: "Ornamentals",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07000"], {
  build_status: "VacantLand",
  property_usage_type: "GovernmentProperty",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07100"], {
  property_usage_type: "Church",
});

addPropertyUseMapping(["07200"], {
  property_usage_type: "PrivateSchool",
});

addPropertyUseMapping(["07300"], {
  property_usage_type: "PrivateHospital",
});

addPropertyUseMapping(["07400"], {
  property_usage_type: "HomesForAged",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["07500"], {
  property_usage_type: "NonProfitCharity",
});

addPropertyUseMapping(["07600"], {
  property_usage_type: "MortuaryCemetery",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07700"], {
  property_usage_type: "ClubsLodges",
});

addPropertyUseMapping(["07800"], {
  property_usage_type: "SanitariumConvalescentHome",
});

addPropertyUseMapping(["07900"], {
  property_usage_type: "CulturalOrganization",
});

addPropertyUseMapping(["08000"], {
  build_status: "VacantLand",
  property_usage_type: "Conservation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08010", "08011", "08020", "08030", "08040", "08050", "08090"], {
  build_status: "VacantLand",
  property_usage_type: "GovernmentProperty",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08200"], {
  property_usage_type: "ForestParkRecreation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08300"], {
  property_usage_type: "PublicSchool",
});

addPropertyUseMapping(["08400"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08500"], {
  property_usage_type: "PublicHospital",
});

addPropertyUseMapping(["08600"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08700", "08701"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08710"], {
  property_usage_type: "Conservation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08800", "08900"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["09000"], {
  ownership_estate_type: "Leasehold",
  property_usage_type: "Unknown",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09100"], {
  property_usage_type: "Utility",
});

addPropertyUseMapping(["09110"], {
  property_usage_type: "Railroad",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09200"], {
  property_usage_type: "MineralProcessing",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09300"], {
  ownership_estate_type: "SubsurfaceRights",
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09400"], {
  ownership_estate_type: "RightOfWay",
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09500"], {
  build_status: "VacantLand",
  property_usage_type: "RiversLakes",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09600", "09601"], {
  property_usage_type: "SewageDisposal",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09700"], {
  property_usage_type: "Recreational",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09800"], {
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09900"], {
  build_status: "VacantLand",
  property_usage_type: "TransitionalProperty",
  property_type: "LandParcel",
});

(function validatePropertyUseMappings() {
  const missing = PROPERTY_USE_CODES.filter(
    (code) => !Object.prototype.hasOwnProperty.call(PROPERTY_USE_CODE_MAP, code),
  );
  if (missing.length) {
    throw new Error(
      `Missing property use code mappings for: ${missing.join(", ")}`,
    );
  }
})();

function textOf($, el) {
  return $(el).text().trim();
}

const SUMMARY_SELECTOR =
  "div[id$='_dynamicSummaryData_divSummary'], div[id$='_dynamicSummary_divSummary']";
const LAND_TABLE_SELECTOR = "#ctlBodyPane_ctl05_ctl01_gvwList";
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl04_ctl01_grdValuation";

function findRowValueByTh($, moduleSelector, thTextStartsWith) {
  const rows = $(moduleSelector)
    .find("table.tabular-data-two-column tbody tr")
    .toArray();
  const normalizedTarget = thTextStartsWith
    ? thTextStartsWith.toLowerCase()
    : "";
  for (const row of rows) {
    const $row = $(row);
    const headerCell = $row
      .find("th strong, th")
      .filter((_, el) => Boolean(textOf($, el)))
      .first();
    const headerText = textOf($, headerCell);
    if (
      headerText &&
      normalizedTarget &&
      headerText.toLowerCase().startsWith(normalizedTarget)
    ) {
      const valueCell =
        $row.find("td div span").first() ||
        $row.find("td span").first() ||
        $row.find("td").first();
      const valueText = textOf($, valueCell);
      if (valueText) {
        return valueText;
      }
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
  const raw =
    getSummaryValue($, "Location Address") ||
    getSummaryValue($, "Location Addr");
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
  const candidates = ["Property Use Code", "Property Use", "Property Class"];
  for (const label of candidates) {
    const value = getSummaryValue($, label);
    if (value) return value;
  }
  return null;
}
function mapPropertyUseCode(rawValue) {
  const defaults = PROPERTY_USE_CODE_DEFAULTS;
  if (!rawValue) {
    return {
      code: null,
      description: null,
      ...defaults,
    };
  }
  const match = rawValue.match(/\((\d{4,5})\)/);
  const rawCode = match ? match[1] : null;
  const code =
    rawCode != null && rawCode.length >= 4
      ? rawCode
      : rawCode != null
        ? rawCode.padStart(4, "0")
        : null;
  const description = rawValue
    .replace(/\(\d{4,5}\)\s*$/, "")
    .trim() || null;
  const candidates = code ? collectPropertyUseCodeVariants(code) : [];
  let mapping = null;
  for (const candidate of candidates) {
    if (
      candidate &&
      Object.prototype.hasOwnProperty.call(
        PROPERTY_USE_CODE_MAP,
        candidate,
      )
    ) {
      mapping = PROPERTY_USE_CODE_MAP[candidate];
      break;
    }
  }
  return {
    code,
    description,
    ...(mapping ? mapping : { ...defaults }),
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
    const book = cleanText(textOf($, tds.eq(2)) || "");
    const page = cleanText(textOf($, tds.eq(3)) || "");
    const qualification = textOf($, tds.eq(4));
    const vacantImproved = textOf($, tds.eq(5));
    const grantor = textOf($, tds.eq(6));
    const grantee = textOf($, tds.eq(7));
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
    const entries = Object.entries(dataObj).filter(
      ([, value]) => value && typeof value === "object",
    );
    if (entries.length === 1) {
      return entries[0][1];
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

    // Strip trailing periods before processing (handles abbreviations like "C.")
    const stripTrailingPeriod = (str) => {
      if (!str) return str;
      const stripped = str.replace(/\.$/, '');
      // If the result is empty or contains no letters, return null
      if (!stripped || !/[a-zA-Z]/.test(stripped)) return null;
      return stripped;
    };

    const firstNameRaw =
      personData.first_name != null
        ? String(personData.first_name).trim()
        : "";
    const lastNameRaw =
      personData.last_name != null ? String(personData.last_name).trim() : "";
    const middleRaw =
      personData.middle_name != null
        ? String(personData.middle_name).trim()
        : "";

    // Strip trailing periods from all name parts, then apply titleCase
    const firstNameStripped = stripTrailingPeriod(firstNameRaw);
    const lastNameStripped = stripTrailingPeriod(lastNameRaw);
    const middleStripped = middleRaw ? stripTrailingPeriod(middleRaw) : null;

    // Apply titleCase to ensure proper formatting (handles cases like "I.a" -> "Ia")
    const firstName = firstNameStripped ? titleCase(firstNameStripped) : "";
    const lastName = lastNameStripped ? titleCase(lastNameStripped) : "";
    const middleNameRaw = middleStripped ? titleCase(middleStripped) : null;

    // Validate names match the schema pattern: ^[A-Z][a-zA-Z\s\-',.]*$
    const namePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
    const isValidName = (name) => name && namePattern.test(name);

    // Both first_name and last_name are required and must match pattern
    if (!isValidName(firstName) || !isValidName(lastName)) {
      return null;
    }

    // Validate middle_name if present - set to null if it doesn't match pattern
    const middleName = middleNameRaw && isValidName(middleNameRaw) ? middleNameRaw : null;

    const key =
      firstName || lastName
        ? `${firstName.toLowerCase()}|${(middleRaw || "").toLowerCase()}|${lastName.toLowerCase()}`
        : null;

    if (key && personLookup.has(key)) {
      return personLookup.get(key);
    }

    personIndex += 1;
    const filename = `person_${personIndex}.json`;
    const personObj = {
      birth_date: personData.birth_date || null,
      first_name: firstName,
      last_name: lastName,
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
    property_type: propertyUse.property_type || null,
    // property_use_code: propertyUse.code || null,
    // property_use_description: propertyUse.description || null,
    number_of_units_type:
      binfo.type === "DUPLEX"
        ? "Two"
        : binfo.type === "TRI/QUADRAPLEX"
          ? "TwoToFour"
          : "One",
    property_structure_built_year: parseIntSafe(binfo.actYear),
    property_effective_built_year: parseIntSafe(binfo.effYear),
    livable_floor_area: binfo.heatedArea
      ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft`
      : null,
    total_area: binfo.totalArea
      ? `${parseIntSafe(binfo.totalArea).toLocaleString()} sq ft`
      : null,
    area_under_air: binfo.heatedArea
      ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft`
      : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision && subdivision.length ? subdivision : null,
    zoning: zoning || null,
    number_of_units:
      binfo.type === "DUPLEX" ? 2 : binfo.type === "TRI/QUADRAPLEX" ? 3 : 1,
    historic_designation: false,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
    // ownership_transfer_date: null,
    // purchase_price_amount: null,
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
    const overrideCopy = { ...overrides };
    const normalizedSpaceType = normalizeLayoutSpaceType(
      overrideCopy.space_type || spaceType,
      spaceType,
    );
    delete overrideCopy.space_type;

    const base = {
      space_type: normalizedSpaceType,
      space_index: null,
      space_type_index: null,
      building_number: null,
      flooring_material_type: null,
      size_square_feet: null,
      total_area_sq_ft: null,
      livable_area_sq_ft: null,
      heated_area_sq_ft: null,
      area_under_air_sq_ft: null,
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
    const layout = { ...base, ...overrideCopy };
    layout.space_type = normalizedSpaceType;

    [
      "size_square_feet",
      "total_area_sq_ft",
      "livable_area_sq_ft",
      "heated_area_sq_ft",
      "area_under_air_sq_ft",
    ].forEach((field) => {
      if (layout[field] != null) {
        const numeric = parseFloatSafe(layout[field]);
        layout[field] = numeric != null ? numeric : null;
      }
    });

    if (layout.building_number != null) {
      layout.building_number = String(layout.building_number);
    }

    return layout;
  };

  const planBuildings =
    layoutEntry && Array.isArray(layoutEntry.buildings)
      ? layoutEntry.buildings
      : [];
  const planLayouts =
    layoutEntry && Array.isArray(layoutEntry.layouts)
      ? layoutEntry.layouts
      : [];
  const propertyLayoutSummary =
    layoutEntry && layoutEntry.property_summary
      ? layoutEntry.property_summary
      : null;

  const layoutOutputs = [];
  const sanitizeLayoutForOutput = (layout) => {
    const sanitized = {};
    Object.entries(layout || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key.startsWith("_")) return;
      if (key === "parent_building_index" || key === "parent_floor_number") {
        return;
      }
      if (key === "floor_number") {
        return;
      }
      if (key === "building_number") {
        const numeric = parseIntSafe(value);
        sanitized[key] = numeric != null ? numeric : null;
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

  const propertyIsLand = property.property_type === "LandParcel";
  const totalAreaSqFt = parseIntSafe(binfo.totalArea);
  const heatedAreaSqFt = parseIntSafe(binfo.heatedArea);

  const normalizedBuildings = Array.isArray(planBuildings)
    ? planBuildings.map((building, idx) => {
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
          index:
            parseIntSafe(building && building.building_index) || idx + 1,
          type:
            building && building.building_type != null
              ? String(building.building_type)
              : null,
          totalArea:
            parseIntSafe(
              building && building.total_area_sq_ft != null
                ? building.total_area_sq_ft
                : building && building.total_area != null
                  ? building.total_area
                  : null,
            ) || null,
          heatedArea:
            parseIntSafe(
              building && building.heated_area_sq_ft != null
                ? building.heated_area_sq_ft
                : building && building.heated_area != null
                  ? building.heated_area
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
                : building && building.full_baths != null
                  ? building.full_baths
                  : null,
            ) || 0,
          halfBaths:
            parseIntSafe(
              building && building.half_bathrooms != null
                ? building.half_bathrooms
                : building && building.half_baths != null
                  ? building.half_baths
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

  const buildingInfoByIndex = new Map();
  const buildingMetaByIndex = new Map();
  normalizedBuildings.forEach((meta) => {
    buildingMetaByIndex.set(meta.index, meta);
  });

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
    const heatedSqFt =
      meta && meta.heatedArea != null
        ? meta.heatedArea
        : heatedAreaSqFt != null
        ? heatedAreaSqFt
        : null;
    const livableSqFt =
      heatedSqFt != null
        ? heatedSqFt
        : sizeSqFt != null
        ? sizeSqFt
        : null;
    const buildingLayout = createLayoutRecord("Building", {
      space_index: buildingIndex,
      space_type_index: `${buildingIndex}`,
      size_square_feet: sizeSqFt,
      total_area_sq_ft: sizeSqFt,
      livable_area_sq_ft: livableSqFt,
      heated_area_sq_ft: heatedSqFt,
      area_under_air_sq_ft: livableSqFt,
      building_number: String(buildingIndex),
      is_exterior: false,
    });
    const path = addLayoutRecord(buildingLayout);
    const info = {
      index: buildingIndex,
      path,
      childPaths: [],
      directChildLayouts: [],
      structurePaths: [],
      utilityPaths: [],
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

  const addRoomLayout = (buildingIndex, overrides = {}) => {
    const info = getOrCreateBuildingInfo(buildingIndex);
    const { space_type: rawSpaceType, ...rest } = overrides || {};
    const normalizedSpaceType = normalizeLayoutSpaceType(
      rawSpaceType,
      rawSpaceType || "Living Area",
    );
    const finalOverrides = { ...rest, building_number: String(info.index) };

    if (typeof finalOverrides.is_exterior !== "boolean") {
      delete finalOverrides.is_exterior;
    }

    finalOverrides.floor_number = null;
    finalOverrides.floor_level = null;
    const roomLayout = createLayoutRecord(normalizedSpaceType, finalOverrides);
    info.directChildLayouts.push(roomLayout);
    return roomLayout;
  };

  if (normalizedBuildings.length) {
    normalizedBuildings.forEach((meta) => {
      ensureBuildingLayout(meta, meta.index);
    });
  }

  planLayouts.forEach((layoutRecord) => {
    if (!layoutRecord) return;
    const buildingIndexRaw =
      layoutRecord.building_index != null
        ? layoutRecord.building_index
        : layoutRecord.parent_building_index;
    const buildingIndex =
      parseIntSafe(buildingIndexRaw) ||
      (buildingLayoutsInfo[0] ? buildingLayoutsInfo[0].index : 1);
    if (!buildingIndex) return;
    const overrides = {
      space_type: layoutRecord.space_type || null,
      size_square_feet:
        layoutRecord.size_square_feet != null
          ? parseFloatSafe(layoutRecord.size_square_feet)
          : null,
      is_exterior:
        typeof layoutRecord.is_exterior === "boolean"
          ? layoutRecord.is_exterior
          : undefined,
    };
    addRoomLayout(buildingIndex, overrides);
  });

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

  const propertyLevelBedrooms =
    (propertyLayoutSummary &&
      parseIntSafe(propertyLayoutSummary.bedrooms)) ||
    parseIntSafe(binfo.bedrooms) ||
    0;
  const propertyLevelBathroomCounts = propertyLayoutSummary
    ? {
        full: parseIntSafe(propertyLayoutSummary.full_bathrooms) || 0,
        half: parseIntSafe(propertyLayoutSummary.half_bathrooms) || 0,
      }
    : parseBathroomsValue(binfo.bathrooms);

  if (
    buildingLayoutsInfo.length === 1 &&
    buildingLayoutsInfo[0] &&
    buildingMetaByIndex.has(buildingLayoutsInfo[0].index)
  ) {
    const soleInfo = buildingLayoutsInfo[0];
    const meta = { ...(buildingMetaByIndex.get(soleInfo.index) || {}) };
    if ((meta.bedrooms || 0) < propertyLevelBedrooms) {
      meta.bedrooms = propertyLevelBedrooms;
    }
    if ((meta.fullBaths || 0) < propertyLevelBathroomCounts.full) {
      meta.fullBaths = propertyLevelBathroomCounts.full;
    }
    if ((meta.halfBaths || 0) < propertyLevelBathroomCounts.half) {
      meta.halfBaths = propertyLevelBathroomCounts.half;
    }
    buildingMetaByIndex.set(soleInfo.index, meta);
  }

  const SUB_AREA_TYPE_TO_SPACE_TYPE = {
    BAS: "Living Area",
    BSM: "Basement",
    CAR: "Carport",
    CPU: "Carport",
    DGA: "Detached Garage",
    FCP: "Carport",
    FLA: "Living Area",
    FOP: "Open Porch",
    FPR: "Open Porch",
    FSP: "Screened Porch",
    FST: "Storage Room",
    FUS: "Living Area",
    GAR: "Attached Garage",
    JCR: "Courtyard",
    LAN: "Lanai",
    OPR: "Open Porch",
    PAT: "Patio",
    PTO: "Patio",
    SCR: "Screened Porch",
    SGR: "Sunroom",
    STG: "Storage Room",
    STP: "Stoop",
    UGA: "Attached Garage",
    UOP: "Open Porch",
    UPR: "Open Porch",
  };

  const mapSubAreaLayoutType = (subArea) => {
    if (!subArea) return null;
    const typeCode = subArea.type ? subArea.type.toUpperCase() : "";
    const desc = subArea.description ? subArea.description.toUpperCase() : "";
    if (SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode]) {
      return normalizeLayoutSpaceType(
        SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode],
        SUB_AREA_TYPE_TO_SPACE_TYPE[typeCode],
      );
    }
    if (typeCode.startsWith("GAR")) {
      return normalizeLayoutSpaceType("Attached Garage", "Attached Garage");
    }
    if (typeCode.startsWith("DGA")) {
      return normalizeLayoutSpaceType("Detached Garage", "Detached Garage");
    }
    if (typeCode === "HAF" || typeCode === "HBA" || desc.includes("HALF") || desc.includes("1/2")) {
      return normalizeLayoutSpaceType("Half Bathroom / Powder Room", "Half Bathroom / Powder Room");
    }
    if (
      typeCode === "TQB" ||
      desc.includes("THREE QUARTER") ||
      desc.includes("3/4")
    ) {
      return normalizeLayoutSpaceType("Three-Quarter Bathroom", "Three-Quarter Bathroom");
    }
    if (typeCode === "EUF" || (desc.includes("ELEV") && desc.includes("UNFIN")))
      return normalizeLayoutSpaceType("Storage Room", "Storage Room");
    if (typeCode === "FLA" || desc.includes("FLOOR LIV") || typeCode === "BAS")
      return normalizeLayoutSpaceType("Living Area", "Living Area");
    if (desc.includes("PRIMARY BED"))
      return normalizeLayoutSpaceType("Primary Bedroom", "Primary Bedroom");
    if (desc.includes("SECONDARY BED"))
      return normalizeLayoutSpaceType("Secondary Bedroom", "Secondary Bedroom");
    if (desc.includes("BED"))
      return normalizeLayoutSpaceType("Bedroom", "Bedroom");
    if (desc.includes("FULL") && desc.includes("BATH"))
      return normalizeLayoutSpaceType("Full Bathroom", "Full Bathroom");
    if (desc.includes("BATH"))
      return normalizeLayoutSpaceType("Full Bathroom", "Full Bathroom");
    if (desc.includes("KITCH"))
      return normalizeLayoutSpaceType("Kitchen", "Kitchen");
    if (desc.includes("DET") && desc.includes("GAR"))
      return normalizeLayoutSpaceType("Detached Garage", "Detached Garage");
    if (desc.includes("GARAGE"))
      return normalizeLayoutSpaceType("Attached Garage", "Attached Garage");
    if (desc.includes("CARPORT"))
      return normalizeLayoutSpaceType("Carport", "Carport");
    if (desc.includes("PORCH") && desc.includes("SCREEN"))
      return normalizeLayoutSpaceType("Screened Porch", "Screened Porch");
    if (desc.includes("OP PR") || desc.includes("PRCH") || desc.includes("PORCH"))
      return normalizeLayoutSpaceType("Open Porch", "Open Porch");
    if (desc.includes("BALCONY"))
      return normalizeLayoutSpaceType("Balcony", "Balcony");
    if (desc.includes("DECK")) return normalizeLayoutSpaceType("Deck", "Deck");
    if (desc.includes("PATIO"))
      return normalizeLayoutSpaceType("Patio", "Patio");
    if (desc.includes("STORAGE"))
      return normalizeLayoutSpaceType("Storage Room", "Storage Room");
    if (desc.includes("UP STORY") || desc.includes("UPPER STORY"))
      return normalizeLayoutSpaceType("Living Area", "Living Area");
    return normalizeLayoutSpaceType(subArea.description || subArea.type, "Living Area");
  };

  const ensureFallbackRooms = () => {
    buildingLayoutsInfo.forEach((info) => {
      const meta = buildingMetaByIndex.get(info.index) || null;
      const hasAnyRooms =
        Array.isArray(info.directChildLayouts) &&
        info.directChildLayouts.length > 0;

      if (!hasAnyRooms && meta) {
        const addFallbackRooms = (count, spaceType) => {
          for (let i = 0; i < (count || 0); i += 1) {
            addRoomLayout(info.index, {
              space_type: spaceType,
            });
          }
        };

        addFallbackRooms(meta.bedrooms, "Bedroom");
        addFallbackRooms(meta.fullBaths, "Full Bathroom");
        addFallbackRooms(
          meta.halfBaths,
          "Half Bathroom / Powder Room",
        );

        (meta.subAreas || []).forEach((subArea) => {
          const label =
            mapSubAreaLayoutType(subArea) ||
            titleCase(subArea.description || subArea.type || "Sub Area");
          const alreadyExists = info.directChildLayouts.some(
            (layout) =>
              layout.space_type &&
              layout.space_type.toLowerCase() === label.toLowerCase(),
          );
          if (alreadyExists) return;
          addRoomLayout(info.index, {
            space_type: label,
            size_square_feet:
              subArea.square_feet != null ? subArea.square_feet : null,
          });
        });
      }

      if (
        !Array.isArray(info.directChildLayouts) ||
        info.directChildLayouts.length === 0
      ) {
        addRoomLayout(info.index, {
          space_type: "Living Area",
        });
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
      if (roomLayout.building_number == null) {
        roomLayout.building_number = String(info.index);
      }
      if (!roomLayout.floor_level) {
        roomLayout.floor_level = null;
      }
      if (roomLayout.floor_number == null) {
        roomLayout.floor_number = null;
      }
      const roomPath = addLayoutRecord(roomLayout);
      info.childPaths.push(roomPath);
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

  const attachStructureToLayout = (layoutInfo, structurePath) => {
    if (!layoutInfo || !structurePath) return false;
    writeRelationshipUnique(layoutInfo.path, structurePath);
    if (!layoutInfo.structurePaths) layoutInfo.structurePaths = [];
    if (!layoutInfo.structurePaths.includes(structurePath)) {
      layoutInfo.structurePaths.push(structurePath);
    }
    return true;
  };

  const attachUtilityToLayout = (layoutInfo, utilityPath) => {
    if (!layoutInfo || !utilityPath) return false;
    writeRelationshipUnique(layoutInfo.path, utilityPath);
    if (!layoutInfo.utilityPaths) layoutInfo.utilityPaths = [];
    if (!layoutInfo.utilityPaths.includes(utilityPath)) {
      layoutInfo.utilityPaths.push(utilityPath);
    }
    return true;
  };

  const selectLayoutForStructure = () => {
    if (propertyIsLand || !buildingLayoutsInfo.length) return null;
    return buildingLayoutsInfo.reduce((best, info) => {
      const count = (info.structurePaths && info.structurePaths.length) || 0;
      if (!best) return info;
      const bestCount =
        (best.structurePaths && best.structurePaths.length) || 0;
      if (count < bestCount) return info;
      if (count === bestCount && info.index < best.index) return info;
      return best;
    }, null);
  };

  const selectLayoutForUtility = () => {
    if (propertyIsLand || !buildingLayoutsInfo.length) return null;
    return buildingLayoutsInfo.reduce((best, info) => {
      const count = (info.utilityPaths && info.utilityPaths.length) || 0;
      if (!best) return info;
      const bestCount =
        (best.utilityPaths && best.utilityPaths.length) || 0;
      if (count < bestCount) return info;
      if (count === bestCount && info.index < best.index) return info;
      return best;
    }, null);
  };

  // Property relationships to structures (leftovers handled later)
  const propertyStructureFallback = (structurePath) => {
    const target = selectLayoutForStructure();
    if (target) {
      attachStructureToLayout(target, structurePath);
    } else {
      writeRelationshipUnique(propertyPath, structurePath);
    }
  };

  const propertyUtilityFallback = (utilityPath) => {
    const target = selectLayoutForUtility();
    if (target) {
      attachUtilityToLayout(target, utilityPath);
    } else {
      writeRelationshipUnique(propertyPath, utilityPath);
    }
  };



  propertyImprovementOutputs.forEach(({ path }) => {
    writeRelationshipUnique(propertyPath, path);
  });

  // Layout hierarchy relationships (building -> rooms)
  buildingLayoutsInfo.forEach((info) => {
    info.childPaths.forEach((childPath) => {
      writeRelationshipUnique(info.path, childPath);
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
          attachStructureToLayout(info, meta.path);
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
            attachStructureToLayout(info, meta.path);
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
          attachUtilityToLayout(info, meta.path);
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
            attachUtilityToLayout(info, meta.path);
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
      "Gadsden",
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


  const ownerMailingInfo = parseOwnerMailingAddresses($);
  const mailingAddressFiles = [];
  ownerMailingInfo.uniqueAddresses.forEach((addr, idx) => {
    if (!addr) return;
    const fileName = `mailing_address_${idx + 1}.json`;
    const mailingObj = {
      unnormalized_address: addr,
      latitude: null,
      longitude: null,
      source_http_request: clone(defaultSourceHttpRequest),
      request_identifier: requestIdentifier,
    };
    writeJSON(path.join(dataDir, fileName), mailingObj);
    mailingAddressFiles.push({ path: `./${fileName}` });
  });

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

  const currentOwnerEntities = [];
  currentOwners.forEach((owner, idx) => {
    if (!owner || !owner.type) return;
    let mailingIdx = null;
    if (
      ownerMailingInfo.rawAddresses[idx] != null &&
      mailingAddressFiles.length
    ) {
      const rawAddr = ownerMailingInfo.rawAddresses[idx];
      const uniqueIdx = ownerMailingInfo.uniqueAddresses.indexOf(rawAddr);
      if (uniqueIdx >= 0) mailingIdx = uniqueIdx;
    }
    if (mailingIdx == null && mailingAddressFiles.length) {
      mailingIdx = Math.min(idx, mailingAddressFiles.length - 1);
    }
    const mailingRecord =
      mailingIdx != null && mailingIdx >= 0
        ? mailingAddressFiles[mailingIdx]
        : null;

    if (owner.type === "person") {
      const normalizedPerson = normalizeOwner(owner, ownersByDate);
      const personPath = createPersonRecord(normalizedPerson);
      if (personPath) {
        currentOwnerEntities.push({
          type: "person",
          path: personPath,
          mailingPath: mailingRecord ? mailingRecord.path : null,
        });
      }
    } else if (owner.type === "company") {
      const companyPath = createCompanyRecord(owner.name || "");
      if (companyPath) {
        currentOwnerEntities.push({
          type: "company",
          path: companyPath,
          mailingPath: mailingRecord ? mailingRecord.path : null,
        });
      }
    }
  });

  const mailingRelationshipKeys = new Set();
  currentOwnerEntities.forEach((entity) => {
    if (!entity.path || !entity.mailingPath) return;
    const relKey = `${entity.path}|${entity.mailingPath}`;
    if (mailingRelationshipKeys.has(relKey)) return;
    mailingRelationshipKeys.add(relKey);
    const relFilename = makeRelationshipFilename(entity.path, entity.mailingPath);
    if (!relFilename) return;
    const relObj = {
      from: { "/": entity.path },
      to: { "/": entity.mailingPath },
    };
    writeJSON(path.join(dataDir, relFilename), relObj);
  });

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
