// transform-santa_clara/scripts/data_extractor.js
//
// Santa Clara County (CA) — Elephant Oracle transform (prepared parcel data -> Lexicon JSON).
//
// ЗАЧЕМ ЭТОТ ФАЙЛ ОТЛИЧАЕТСЯ ОТ lee/brevard/lake:
//   Все существующие FL-графства (lee/brevard/lake) — cheerio HTML-скрейперы:
//   они делают `cheerio.load(fs.readFileSync("input.html"))` и парсят DOM
//   аппрейзер-страницы. Источник Santa Clara — Socrata JSON API (ubcd-cewv),
//   у которого НЕТ HTML-страницы паркеля. Поэтому здесь HTML НЕ читается вообще.
//
//   Вместо DOM мы читаем те же файлы, что и Lee для геометрии — они едут по
//   всему пайплайну независимо от источника:
//     - input.csv             (кладётся pre-lambda: pre/index.mjs:213 и
//                              downloader/index.mjs:1685; читается трансформом
//                              так же, как в lee/scripts/data_extractor.js:420-444)
//     - property_seed.json     (выход seed-transform; см. pre/index.mjs:208)
//     - unnormalized_address.json (выход seed-transform; county_jurisdiction —
//                              pre/index.mjs:236-238)
//
//   Из этих трёх файлов у нас есть ВСЁ, что даёт открытая Socrata:
//   apn (parcel id) + situs_* (адрес) + the_geom (геометрия) + jurisdiction.
//   Атрибутов ассессора (year_built/sqft/value/owner/structure/tax) в открытом
//   слое НЕТ (платные) — соответствующие Lexicon-классы мы НЕ эмитим (см. README).
//
// РЕФЕРЕНСЫ (file:line в ~/work/oracle/oracle-node, только-чтение):
//   - геометрия из seed CSV:  transform/lee/scripts/data_extractor.js:14-64,
//     260-505, 3673-3707 (parsePolygonFromString / createParcelGeometries /
//     relationship_parcel_has_geometry_parcel_*).
//   - плоская эмиссия property/address/relationship:
//     transform/brevard/scripts/data_extractor.js:441-688,4159 (mapStreetSuffix,
//     property.json/address.json shape, relationship {to,from}).
//
// ВХОД:  cwd содержит input.csv (+ property_seed.json, unnormalized_address.json)
// ВЫХОД: data/*.json (Lexicon-инстансы + relationship_*.json)
//
// Fail-loud конвенция: неизвестные enum -> "MAPPING NOT AVAILABLE"
//   (как в transform/lee/scripts/data_extractor.js:576,683,916-917), чтобы
//   валидатор упал, а не тихо протащил мусор.

const fs = require("fs");
const path = require("path");

const WORKING_DIR = process.cwd();
const SCRIPT_DIR = __dirname;
const NORMALIZE_EOL_REGEX = /\r\n/g;

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function emptyDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        emptyDir(fp);
        fs.rmdirSync(fp);
      } else {
        fs.unlinkSync(fp);
      }
    } catch {
      /* ignore */
    }
  });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function readJSONIfExists(p) {
  return fs.existsSync(p) ? readJSON(p) : null;
}

// ---------------------------------------------------------------------------
// CSV parsing (mirrors transform/lee/scripts/data_extractor.js:268-304)
// ---------------------------------------------------------------------------

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
    } else if (char === "\n" && !insideQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

/**
 * Load input.csv content. Same candidate search as Lee
 * (transform/lee/scripts/data_extractor.js:420-444) so it works whether the
 * CLI drops input.csv in cwd, the scripts dir, or the parent.
 */
function loadInputCsvContent() {
  const parentDir = path.dirname(SCRIPT_DIR);
  const candidates = [
    path.join(WORKING_DIR, "input.csv"),
    path.join(SCRIPT_DIR, "input.csv"),
    path.join(parentDir, "input.csv"),
    path.join(WORKING_DIR, "seed.csv"),
    path.join(SCRIPT_DIR, "seed.csv"),
    path.join(parentDir, "seed.csv"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return fs.readFileSync(candidate, "utf8");
      } catch (err) {
        console.warn(`Unable to read CSV at ${candidate}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Parse the (one-row per parcel) input.csv into a record keyed by column name.
 * enqueue writes exactly one data row per parcel
 * (see SEED_FORMAT_NOTES.md §1.1 / enqueue buildOneRowCsv). We read row[0].
 */
function loadSeedRow() {
  const csvContent = loadInputCsvContent();
  if (!csvContent) return null;
  const rows = parseCsv(csvContent.replace(NORMALIZE_EOL_REGEX, "\n")).filter(
    (r) => r.some((c) => c && c.trim() !== ""),
  );
  if (rows.length < 2) return null;
  const header = rows[0].map((h) => h.trim());
  const values = rows[1];
  const record = {};
  header.forEach((col, idx) => {
    record[col] = (values[idx] ?? "").trim();
  });
  return record;
}

// ---------------------------------------------------------------------------
// Geometry (Socrata the_geom rides in seed as parcel_polygon "old format":
//   [[[lon,lat],...]] — see SEED_FORMAT_NOTES.md §1.4 and build_seed.mjs).
//   Parsing mirrors transform/lee/scripts/data_extractor.js:14-64 (old format)
//   and the parcel-geometry emission at :471-505.
// ---------------------------------------------------------------------------

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse parcel_polygon string ([[[lon,lat],...]]) into an array of
 * {latitude, longitude} points (Elephant Geometry.polygon shape).
 * Returns null if fewer than 3 valid points.
 */
function parseParcelPolygon(polygonStr) {
  if (!polygonStr) return null;
  const cleaned = polygonStr.trim().replace(/^["']+|["']+$/g, "");
  if (!cleaned) return null;

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.warn(`parcel_polygon is not valid JSON: ${err.message}`);
    return null;
  }

  // Expected: [[[lon,lat],...]] — take the first (outer) ring.
  let ring = null;
  if (
    Array.isArray(parsed) &&
    Array.isArray(parsed[0]) &&
    Array.isArray(parsed[0][0])
  ) {
    ring = parsed[0];
  } else if (
    Array.isArray(parsed) &&
    Array.isArray(parsed[0]) &&
    parsed[0].length >= 2 &&
    typeof parsed[0][0] === "number"
  ) {
    // Tolerate a bare ring [[lon,lat],...]
    ring = parsed;
  }
  if (!Array.isArray(ring) || ring.length < 3) return null;

  const polygon = ring
    .map((coord) => {
      if (Array.isArray(coord) && coord.length >= 2) {
        const longitude = toNumber(coord[0]);
        const latitude = toNumber(coord[1]);
        if (
          latitude != null &&
          longitude != null &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        ) {
          return { latitude, longitude };
        }
      }
      return null;
    })
    .filter((c) => c !== null);

  return polygon.length >= 3 ? polygon : null;
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

// USPS suffix map (subset copied from
// transform/brevard/scripts/data_extractor.js:60-385; extend as needed).
const STREET_SUFFIX_MAP = {
  STREET: "St", ST: "St",
  AVENUE: "Ave", AVE: "Ave", AV: "Ave",
  BOULEVARD: "Blvd", BLVD: "Blvd",
  ROAD: "Rd", RD: "Rd",
  LANE: "Ln", LN: "Ln",
  DRIVE: "Dr", DR: "Dr",
  COURT: "Ct", CT: "Ct",
  PLACE: "Pl", PL: "Pl",
  TERRACE: "Ter", TER: "Ter",
  CIRCLE: "Cir", CIR: "Cir",
  WAY: "Way", WY: "Way",
  LOOP: "Loop",
  PARKWAY: "Pkwy", PKWY: "Pkwy",
  PLAZA: "Plz", PLZ: "Plz",
  TRAIL: "Trl", TRL: "Trl",
  HIGHWAY: "Hwy", HWY: "Hwy",
  SQUARE: "Sq", SQ: "Sq",
  REAL: "Real", // e.g. "EL CAMINO REAL" — keep as-is (see open questions)
};

// Socrata situs_street_direction values are single letters (e.g. "W").
const VALID_DIRECTIONALS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

function mapStreetSuffix(usps) {
  if (!usps) return null;
  return STREET_SUFFIX_MAP[usps.toUpperCase()] || null;
}

function upperOrNull(v) {
  const s = (v ?? "").trim();
  return s ? s.toUpperCase() : null;
}

/**
 * Split a Santa Clara situs_zip_code ("95120-5530") into postal_code + plus_four.
 */
function splitZip(zip) {
  const s = (zip ?? "").trim();
  if (!s) return { postal_code: null, plus_four: null };
  const m = s.match(/^(\d{5})(?:-(\d{4}))?$/);
  if (!m) return { postal_code: s, plus_four: null };
  return { postal_code: m[1], plus_four: m[2] || null };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  console.log("Santa Clara transform: start");

  const dataDir = path.join("data");
  ensureDir(dataDir);
  emptyDir(dataDir); // avoid stale duplicate files across re-runs (as Brevard does)

  // ---- Read the prepared inputs (NO input.html — JSON-source county) ----
  const seedRow = loadSeedRow(); // from input.csv (apn/situs_*/geometry/jurisdiction)
  const propSeed = readJSONIfExists("property_seed.json"); // request_identifier, source_http_request
  const unAddr = readJSONIfExists("unnormalized_address.json"); // county_jurisdiction

  if (!seedRow) {
    // Fail loud: without the seed row we cannot map anything for Santa Clara.
    throw new Error(
      "Santa Clara transform: input.csv (seed row) not found or empty; " +
        "cannot map parcel data. Expected columns: parcel_id, situs_*, parcel_polygon.",
    );
  }

  // request_identifier: prefer the seed-transform value, fall back to apn/parcel_id.
  const requestIdentifier =
    (propSeed && propSeed.request_identifier) ||
    seedRow.source_identifier ||
    seedRow.parcel_id ||
    null;

  // parcel_identifier: the APN as-is (SEED_FORMAT_NOTES.md §1.3 — raw value kept).
  const parcelIdentifier = seedRow.parcel_id || seedRow.source_identifier || null;

  if (!parcelIdentifier) {
    throw new Error(
      "Santa Clara transform: seed row has no parcel_id/source_identifier (APN).",
    );
  }

  // source_http_request: carried from the seed transform if POPULATED. The seed
  // CSV carries url/method/multiValueQueryString columns which the CLI
  // seed-transform (transform/index.js:269-293) turns into a real
  // source_http_request; we pass that through unchanged.
  //
  // Guard: the seed-transform emits an EMPTY stub {"multiValueQueryString":{}}
  // (no method/url) when those columns are missing — and the SVL schema REQUIRES
  // {method,url}. Treat a stub with no `method` as absent so the honest fallback
  // below kicks in, rather than propagating an SVL-failing value. (This is the
  // exact defect the 08.07 pilot hit: an empty stub failed 7× source_http_request.)
  const carriedShr =
    propSeed && propSeed.source_http_request && propSeed.source_http_request.method
      ? propSeed.source_http_request
      : null;
  const sourceHttpRequest = carriedShr;

  // NOTE: address.county_name is a STRICT enum of human-readable county names
  // ("Santa Clara", title case) — NOT the snake_case folder/jurisdiction key
  // ("santa_clara"). The seed `county` column already holds "Santa Clara"; use
  // it. county_jurisdiction (folder name) is deliberately NOT used here.
  const countyName = seedRow.county || "Santa Clara";

  // source_http_request is a REQUIRED field on property/parcel/geometry and the
  // Lexicon source_http_request schema requires {method,url}. For method=GET it
  // FORBIDS body/json/headers, and the url `pattern` FORBIDS a query string (no
  // `?`), so the APN filter rides in `multiValueQueryString`, NOT the url.
  // If the seed transform didn't carry a populated request, synthesize the exact
  // Socrata GET that fetched this parcel — honest provenance, and SVL-valid.
  const shr = sourceHttpRequest || {
    method: "GET",
    url: "https://data.sccgov.org/resource/ubcd-cewv.json",
    multiValueQueryString: { apn: [String(parcelIdentifier)] },
  };

  // ========================================================================
  // property.json  — MINIMAL. Open Socrata gives NO assessor attributes, but
  //   the Lexicon `property` schema is `additionalProperties:false` and REQUIRES:
  //     source_http_request, request_identifier, parcel_identifier,
  //     property_legal_description_text (nullable), property_type (non-null enum).
  //   Verified live against the Lexicon property schema
  //   (schema-cache bafkreif4lce...; property_type enum includes "LandParcel").
  //
  //   property_type: we CANNOT know the true use type from open data. We emit
  //   "LandParcel" — the enum member that accurately means "a parcel record,
  //   land classification only" — rather than fabricating SingleFamily/etc.
  //   This is the honest floor; the real use type needs the paid assessor file.
  //   All other optional keys are OMITTED (not null) because the schema forbids
  //   nulls on some (e.g. historic_designation is boolean-only) and forbids
  //   unknown/undeclared shapes (additionalProperties:false).
  // ========================================================================
  const property = {
    source_http_request: shr,
    request_identifier: requestIdentifier || parcelIdentifier,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: null, // not in open Socrata (nullable OK)
    property_type: "LandParcel", // honest floor; true type needs paid assessor
  };
  writeJSON(path.join(dataDir, "property.json"), property);
  console.log(`property.json: parcel_identifier=${parcelIdentifier} type=LandParcel`);

  // ========================================================================
  // parcel.json — the object that parcel_has_geometry.from must point to.
  //   Lexicon `parcel` schema (additionalProperties:false) REQUIRES:
  //     source_http_request, request_identifier, parcel_identifier.
  //   (Lee emits this separately too: lee/data_extractor.js:3695-3705.)
  // ========================================================================
  const parcel = {
    source_http_request: shr,
    request_identifier: requestIdentifier || parcelIdentifier,
    parcel_identifier: parcelIdentifier,
  };
  writeJSON(path.join(dataDir, "parcel.json"), parcel);

  // ========================================================================
  // address.json — from situs_* columns (SCC Socrata).
  //   Lexicon address schema is a oneOf: branch 0 = {unnormalized_address},
  //   branch 1 = the NORMALIZED form which REQUIRES the FULL key set present
  //   (nulls allowed) — verified live against the address schema
  //   (schema-cache bafkreiebz...; branch 1 required list).
  //   So we always emit the complete normalized key set, null where unknown.
  //   Constraints found empirically:
  //     - county_name: strict enum, human-readable "Santa Clara" (not snake).
  //     - street_suffix_type: strict 203-enum; UNMAPPED suffix -> null (never
  //       pass the raw SCC token like "WY"/"AV"; those aren't enum members).
  //     - street_pre_directional_text: enum N/S/E/W/NE/NW/SE/SW/null.
  //   SCC has situs_street_direction (pre-directional, e.g. "W").
  // ========================================================================
  const { postal_code, plus_four } = splitZip(seedRow.situs_zip_code);
  const suffixMapped = mapStreetSuffix(seedRow.situs_street_type || null); // null if not in enum map
  const preDirRaw = upperOrNull(seedRow.situs_street_direction);
  const preDir = preDirRaw && VALID_DIRECTIONALS.has(preDirRaw) ? preDirRaw : null;
  const orNull = (v) => {
    const s = v == null ? "" : String(v).trim();
    return s === "" ? null : s;
  };

  const address = {
    source_http_request: shr,
    request_identifier: requestIdentifier || parcelIdentifier,
    country_code: "US",
    county_name: countyName, // strict enum: "Santa Clara"
    state_code: upperOrNull(seedRow.situs_state_code), // "CA"
    city_name: upperOrNull(seedRow.situs_city_name),
    municipality_name: upperOrNull(seedRow.jurisdiction), // SCC's municipality signal
    postal_code: orNull(postal_code),
    plus_four_postal_code: orNull(plus_four),
    street_number: orNull(seedRow.situs_house_number),
    street_name: upperOrNull(seedRow.situs_street_name),
    street_suffix_type: suffixMapped, // enum member or null
    street_pre_directional_text: preDir,
    street_post_directional_text: null, // SCC has no post-directional
    unit_identifier: null, // not in open Socrata
    latitude: toNumber(seedRow.latitude),
    longitude: toNumber(seedRow.longitude),
    // township/range/section/block/lot/route: not derivable from a CA APN — null.
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    route_number: null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);
  console.log(
    `address.json: ${address.street_number || ""} ${address.street_name || ""} ${address.city_name || ""}`,
  );

  // relationship: property -> address (IPLD links; direction as in Lee :4159).
  writeJSON(path.join(dataDir, "relationship_property_address.json"), {
    from: { "/": "./property.json" },
    to: { "/": "./address.json" },
  });

  // ========================================================================
  // geometry_parcel_*.json — the parcel polygon (Socrata the_geom outer ring).
  //   Emission mirrors transform/lee/scripts/data_extractor.js:471-505.
  //   MultiPolygon collapse to first polygon already happened in build_seed.mjs
  //   (SEED_FORMAT_NOTES.md §4.4); here we read a single outer ring.
  // ========================================================================
  const polygon = parseParcelPolygon(seedRow.parcel_polygon);
  if (polygon) {
    // Lexicon `geometry` schema (additionalProperties:false) REQUIRES
    // source_http_request + request_identifier; polygon items allow only
    // {latitude, longitude}. Verified live (schema-cache bafkreibwkj4...).
    const geometry = {
      source_http_request: shr,
      request_identifier: requestIdentifier || parcelIdentifier,
      latitude: toNumber(seedRow.latitude),
      longitude: toNumber(seedRow.longitude),
      polygon,
    };

    writeJSON(path.join(dataDir, "geometry_parcel_0.json"), geometry);
    // parcel_has_geometry.from MUST resolve to a `parcel` object, not the full
    // `property` (the property schema is additionalProperties:false and would
    // reject the parcel fields). So we link from parcel.json.
    writeJSON(
      path.join(dataDir, "relationship_parcel_has_geometry_parcel_0.json"),
      {
        from: { "/": "./parcel.json" },
        to: { "/": "./geometry_parcel_0.json" },
      },
    );
    console.log(`geometry_parcel_0.json: ${polygon.length} points`);
  } else {
    // No polygon in the seed. Do NOT fabricate one; leave geometry unemitted.
    // (build_seed.mjs guarantees a polygon for the pilot, so this path means a
    //  data problem worth surfacing rather than hiding.)
    console.warn(
      "No valid parcel_polygon in seed row; geometry_parcel not emitted.",
    );
  }

  // ========================================================================
  // DELIBERATELY NOT EMITTED (open Socrata has none of these):
  //   structure.json          -> needs assessor building characteristics (paid)
  //   tax_<year>.json          -> needs assessor value roll (paid)
  //   sales_/deed_/file_       -> needs Recorder grantor/grantee (offline in CA)
  //   person_/company_/owner   -> needs ownership data (paid/offline)
  //   layout_/utility_/lot_    -> needs building interior / land attributes (paid)
  //   flood_storm_information  -> needs FEMA join (separate stage)
  // See README.md "Open data vs paid" for the full accounting.
  // ========================================================================

  console.log("Santa Clara transform: done");
}

main();
