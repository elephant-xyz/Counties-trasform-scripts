"use strict";

const fs = require("fs");
const path = require("path");
const { mapPropertyClass } = require("./propertyClassMapping.js");

const INPUT_PATH = path.join(process.cwd(), "input.json");
const OUTPUT_DIRECTORY = path.join(process.cwd(), "data");
const FORBIDDEN_SOURCE_FIELD_PATTERN =
  /^(?:owner(?:\d+)?_|taxbill_(?:name|addr|first|last|zip|city|state|cs|csz))/i;

/**
 * USPS abbreviations mapped to the address lexicon's street-suffix enum.
 *
 * @type {Readonly<Record<string, string>>}
 */
const STREET_SUFFIXES = Object.freeze({
  ALY: "Aly",
  AVE: "Ave",
  BLVD: "Blvd",
  CIR: "Cir",
  CT: "Ct",
  DR: "Dr",
  HWY: "Hwy",
  LN: "Ln",
  PKWY: "Pkwy",
  PL: "Pl",
  RD: "Rd",
  RTE: "Rte",
  ST: "St",
  TER: "Ter",
  TRL: "Trl",
  WAY: "Way",
});

/**
 * @typedef {object} ArcGisFeature
 * @property {Record<string, unknown>} properties - ArcGIS source attributes.
 * @property {Record<string, unknown> | null | undefined} [geometry] - GeoJSON geometry.
 *
 * @typedef {object} SourceCapture
 * @property {Record<string, unknown>} source_http_request - Resolved ArcGIS request.
 * @property {unknown} response - ArcGIS GeoJSON response.
 *
 * @typedef {object} AppraisalEntities
 * @property {Record<string, unknown>} property - Lexicon property entity.
 * @property {Record<string, unknown>} parcel - Lexicon parcel entity.
 * @property {Record<string, unknown> | null} address - Lexicon site address entity.
 * @property {Record<string, unknown> | null} lot - Lexicon lot entity.
 * @property {Record<string, unknown> | null} tax - Lexicon tax entity.
 * @property {Record<string, unknown> | null} sale - Lexicon sales-history entity.
 * @property {Record<string, unknown>[]} geometries - One lexicon geometry per GeoJSON polygon component.
 * @property {Record<string, unknown>} sourcePayload - Complete PII-free ArcGIS response retained for query loading.
 */

/**
 * Return true for a non-array object.
 *
 * @param {unknown} value - Candidate value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalize an unknown source value to trimmed text.
 *
 * @param {unknown} value - Source value.
 * @returns {string | null} Trimmed text or null.
 */
function readText(value) {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

/**
 * Parse a finite source number.
 *
 * @param {unknown} value - Source numeric value.
 * @returns {number | null} Finite number or null.
 */
function readNumber(value) {
  const text = readText(value);
  if (text === null) return null;
  const result = Number(text.replaceAll(",", "").replaceAll("$", ""));
  return Number.isFinite(result) ? result : null;
}

/**
 * Parse a positive integer.
 *
 * @param {unknown} value - Source integer value.
 * @returns {number | null} Positive integer or null.
 */
function readPositiveInteger(value) {
  const parsed = readNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

/**
 * Convert an ArcGIS epoch or ISO-compatible source value to YYYY-MM-DD.
 *
 * @param {unknown} value - Source date value.
 * @returns {string | null} ISO date or null.
 */
function readDate(value) {
  const text = readText(value);
  if (text === null) return null;
  const numeric = Number(text);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1800 || year > 2200) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Remove null properties so optional lexicon fields are absent rather than
 * serialized with an unsupported null in schemas that require scalars.
 *
 * @param {Record<string, unknown>} value - Entity candidate.
 * @returns {Record<string, unknown>} Entity containing only non-null fields.
 */
function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, fieldValue]) => fieldValue !== null && fieldValue !== undefined,
    ),
  );
}

/**
 * Reject any prepared payload that contains prohibited owner or tax-bill
 * identity fields. This is a fail-closed defense in addition to the request
 * allow-list.
 *
 * @param {readonly ArcGisFeature[]} features - Captured ArcGIS features.
 * @returns {void}
 */
function assertNoPiiFields(features) {
  for (const feature of features) {
    for (const fieldName of Object.keys(feature.properties)) {
      if (FORBIDDEN_SOURCE_FIELD_PATTERN.test(fieldName)) {
        throw new Error(
          `Prohibited PII field present in Rock Island capture: ${fieldName}`,
        );
      }
    }
  }
}

/**
 * Extract and validate the single Rock Island ArcGIS capture.
 *
 * @param {unknown} payload - Parsed multi-request-flow output.
 * @returns {{ sourceRequest: Record<string, unknown>, response: Record<string, unknown>, features: ArcGisFeature[] }} Validated capture.
 */
function extractParcelCapture(payload) {
  if (!isRecord(payload) || !isRecord(payload.ParcelFeature)) {
    throw new Error("Rock Island input is missing ParcelFeature");
  }
  const capture = /** @type {SourceCapture} */ (payload.ParcelFeature);
  if (!isRecord(capture.source_http_request)) {
    throw new Error("ParcelFeature is missing source_http_request");
  }
  if (
    !isRecord(capture.response) ||
    !Array.isArray(capture.response.features)
  ) {
    throw new Error(
      "ParcelFeature response is not a GeoJSON FeatureCollection",
    );
  }
  /** @type {ArcGisFeature[]} */
  const features = capture.response.features
    .filter(
      (feature) =>
        isRecord(feature) &&
        isRecord(feature.properties) &&
        (feature.geometry === null || isRecord(feature.geometry)),
    )
    .map((feature) => /** @type {ArcGisFeature} */ (feature));
  if (features.length === 0) {
    throw new Error("ParcelFeature response contains no parcel records");
  }
  assertNoPiiFields(features);
  return {
    sourceRequest: capture.source_http_request,
    response: capture.response,
    features,
  };
}

/**
 * Parse a county site-address line into address lexicon fields without
 * guessing unknown suffixes or directional values.
 *
 * @param {unknown} value - Source site address such as `100 MAIN ST N`.
 * @returns {Record<string, unknown>} Parsed street fields.
 */
function parseSiteAddress(value) {
  const text = readText(value);
  if (text === null) return {};
  const tokens = text.toUpperCase().split(/\s+/).filter(Boolean);
  const streetNumber =
    tokens.length > 0 && /^[0-9]+[A-Z0-9-]*$/.test(tokens[0])
      ? tokens.shift()
      : null;
  const directions = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  const preDirectional =
    tokens.length > 0 && directions.has(tokens[0]) ? tokens.shift() : null;
  const postDirectional =
    tokens.length > 0 && directions.has(tokens[tokens.length - 1])
      ? tokens.pop()
      : null;
  const suffixKey =
    tokens.length > 0 && STREET_SUFFIXES[tokens[tokens.length - 1]]
      ? tokens.pop()
      : null;
  const streetName = tokens.join(" ") || null;
  return compact({
    street_number: streetNumber,
    street_pre_directional_text: preDirectional,
    street_name: streetName,
    street_suffix_type: suffixKey === null ? null : STREET_SUFFIXES[suffixKey],
    street_post_directional_text: postDirectional,
  });
}

/**
 * Return the canonical ten-digit PIN shared by every captured feature.
 *
 * @param {readonly ArcGisFeature[]} features - Captured parcel records.
 * @returns {string} Canonical parcel identifier.
 */
function readCanonicalPin(features) {
  const pins = new Set(
    features
      .map((feature) => readText(feature.properties.PIN))
      .filter((value) => value !== null),
  );
  if (pins.size !== 1) {
    throw new Error("ParcelFeature records do not share exactly one PIN");
  }
  const [pin] = pins;
  if (!/^[0-9]{10}$/.test(pin)) {
    throw new Error(`Invalid Rock Island PIN: ${pin}`);
  }
  return pin;
}

/**
 * Select the lowest-OBJECTID source record for scalar fields. All duplicate
 * geometries remain available in the raw capture, while scalar precedence
 * matches the seed builder.
 *
 * @param {readonly ArcGisFeature[]} features - One or more records for a PIN.
 * @returns {ArcGisFeature} Deterministic primary feature.
 */
function selectPrimaryFeature(features) {
  return [...features].sort((left, right) => {
    const leftId =
      readNumber(left.properties.OBJECTID) ?? Number.MAX_SAFE_INTEGER;
    const rightId =
      readNumber(right.properties.OBJECTID) ?? Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  })[0];
}

/**
 * Convert every GeoJSON Polygon or MultiPolygon component to a separate
 * lexicon geometry entity. The complete GeoJSON, including interior rings, is
 * also retained in the transform sidecar so the query DB never loses topology
 * that the current flat-polygon lexicon cannot represent.
 *
 * @param {readonly ArcGisFeature[]} features - PII-free ArcGIS parcel features.
 * @param {Record<string, unknown>} sourceRequest - Resolved ArcGIS request.
 * @returns {Record<string, unknown>[]} Geometry entities in deterministic source order.
 */
function buildGeometryEntities(features, sourceRequest) {
  /** @type {Record<string, unknown>[]} */
  const result = [];
  const orderedFeatures = [...features].sort((left, right) => {
    const leftId =
      readNumber(left.properties.OBJECTID) ?? Number.MAX_SAFE_INTEGER;
    const rightId =
      readNumber(right.properties.OBJECTID) ?? Number.MAX_SAFE_INTEGER;
    return leftId - rightId;
  });

  for (const feature of orderedFeatures) {
    if (!isRecord(feature.geometry)) continue;
    const geometryType = readText(feature.geometry.type);
    const coordinates = feature.geometry.coordinates;
    /** @type {unknown[]} */
    let polygonComponents;
    if (geometryType === "Polygon" && Array.isArray(coordinates)) {
      polygonComponents = [coordinates];
    } else if (geometryType === "MultiPolygon" && Array.isArray(coordinates)) {
      polygonComponents = coordinates;
    } else {
      throw new Error(
        `Unsupported Rock Island geometry type: ${geometryType ?? "missing"}`,
      );
    }

    for (const component of polygonComponents) {
      if (!Array.isArray(component) || !Array.isArray(component[0])) {
        throw new Error("Rock Island polygon component has no exterior ring");
      }
      const exteriorRing = component[0];
      const polygon = exteriorRing.map((coordinate) => {
        if (
          !Array.isArray(coordinate) ||
          coordinate.length < 2 ||
          !Number.isFinite(Number(coordinate[0])) ||
          !Number.isFinite(Number(coordinate[1]))
        ) {
          throw new Error("Rock Island polygon contains an invalid coordinate");
        }
        const longitude = Number(coordinate[0]);
        const latitude = Number(coordinate[1]);
        if (
          longitude < -180 ||
          longitude > 180 ||
          latitude < -90 ||
          latitude > 90
        ) {
          throw new Error("Rock Island polygon coordinate is out of range");
        }
        return { latitude, longitude };
      });
      if (polygon.length < 4) {
        throw new Error("Rock Island polygon exterior ring is not closed");
      }
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (
        first.latitude !== last.latitude ||
        first.longitude !== last.longitude
      ) {
        throw new Error("Rock Island polygon exterior ring is not closed");
      }
      result.push({
        source_http_request: sourceRequest,
        polygon,
      });
    }
  }
  return result;
}

/**
 * Build lexicon-compatible entities from a captured Rock Island parcel. The
 * county-authored class dictionary drives conservative usage normalization,
 * while the raw code and complete mapping provenance remain in the source
 * sidecar. Undocumented and semantically ambiguous classes remain `Unknown`.
 *
 * @param {unknown} payload - Parsed multi-request-flow output.
 * @returns {AppraisalEntities} Appraisal entities ready for JSON output.
 */
function buildAppraisalEntities(payload) {
  const { sourceRequest, response, features } = extractParcelCapture(payload);
  const pin = readCanonicalPin(features);
  const attributes = selectPrimaryFeature(features).properties;
  const classMapping = mapPropertyClass(attributes.class);
  const totalSquareFeet = readNumber(attributes.TOTSQFT);
  const builtYear = readPositiveInteger(attributes.YRBuilt);
  const hasStructure =
    (totalSquareFeet !== null && totalSquareFeet > 0) || builtYear !== null;
  const property = {
    ...compact({
      source_http_request: sourceRequest,
      parcel_identifier: pin,
      property_structure_built_year:
        builtYear !== null &&
        builtYear >= 1800 &&
        builtYear <= new Date().getUTCFullYear() + 1
          ? builtYear
          : null,
      property_type: hasStructure ? "Building" : "LandParcel",
      property_usage_type: classMapping.propertyUsageType,
      zoning: readText(attributes.Zoning),
    }),
    property_legal_description_text: readText(attributes.legal),
  };
  const parcel = {
    source_http_request: sourceRequest,
    request_identifier: pin,
    parcel_identifier: pin,
  };

  const siteAddress = readText(attributes.site_address);
  const siteCityStateZip =
    readText(attributes.site_csz) ??
    [
      readText(attributes.Site_City),
      readText(attributes.Site_State),
      readText(attributes.Site_Zip),
    ]
      .filter((value) => value !== null)
      .join(" ");
  const unnormalizedAddress = [siteAddress, siteCityStateZip]
    .filter((value) => value !== null && value.length > 0)
    .join(", ");
  const city = readText(attributes.Site_City)?.toUpperCase() ?? null;
  const latitude = readNumber(attributes.Y_latitude);
  const longitude = readNumber(attributes.X_longitude);
  const address =
    unnormalizedAddress.length > 0
      ? compact({
          source_http_request: sourceRequest,
          unnormalized_address: unnormalizedAddress,
          city_name: city,
          country_code: "US",
          latitude:
            latitude !== null && latitude >= -90 && latitude <= 90
              ? latitude
              : null,
          longitude:
            longitude !== null && longitude >= -180 && longitude <= 180
              ? longitude
              : null,
        })
      : null;

  const acres =
    readNumber(attributes.GIS_acres_num) ?? readNumber(attributes.gross_acres);
  const lot =
    acres !== null && acres > 0
      ? {
          source_http_request: sourceRequest,
          lot_type:
            acres > 0.25
              ? "GreaterThanOneQuarterAcre"
              : "LessThanOrEqualToOneQuarterAcre",
          lot_length_feet: null,
          lot_width_feet: null,
          lot_size_acre: acres,
          lot_area_sqft: Math.max(1, Math.round(acres * 43_560)),
          landscaping_features: null,
          view: null,
          fencing_type: null,
          fence_height: null,
          fence_length: null,
          driveway_material: null,
          driveway_condition: null,
          lot_condition_issues: null,
        }
      : null;

  const taxYear = readPositiveInteger(attributes.taxbill_year);
  const assessedValue = readNumber(attributes.EAV);
  const marketValue = readNumber(attributes.EMV);
  const farmLand = readNumber(attributes.farm_land);
  const nonFarmLand = readNumber(attributes.non_farm_land);
  const farmBuilding = readNumber(attributes.farm_building);
  const nonFarmBuilding = readNumber(attributes.non_farm_building);
  const landValue =
    farmLand === null && nonFarmLand === null
      ? null
      : (farmLand ?? 0) + (nonFarmLand ?? 0);
  const buildingValue =
    farmBuilding === null && nonFarmBuilding === null
      ? null
      : (farmBuilding ?? 0) + (nonFarmBuilding ?? 0);
  const tax =
    taxYear !== null ||
    assessedValue !== null ||
    marketValue !== null ||
    landValue !== null ||
    buildingValue !== null
      ? {
          ...compact({
            source_http_request: sourceRequest,
            tax_year:
              taxYear !== null && taxYear >= 1800 && taxYear <= 2200
                ? taxYear
                : null,
            property_assessed_value_amount: assessedValue,
            property_market_value_amount: marketValue,
            property_land_amount: landValue,
          }),
          property_building_amount: buildingValue,
          monthly_tax_amount: null,
          period_end_date: null,
          period_start_date: null,
        }
      : null;

  const saleDate =
    readDate(attributes.date_of_sale) ?? readDate(attributes.date_last_sale);
  const salePrice =
    readNumber(attributes.net_sale_price) ??
    readNumber(attributes.gross_sale_price);
  const sale =
    saleDate === null
      ? null
      : compact({
          source_http_request: sourceRequest,
          ownership_transfer_date: saleDate,
          purchase_price_amount:
            salePrice !== null && salePrice > 0 ? salePrice : null,
        });

  return {
    property,
    parcel,
    address,
    lot,
    tax,
    sale,
    geometries: buildGeometryEntities(features, sourceRequest),
    sourcePayload: {
      request_identifier: pin,
      source_http_request: sourceRequest,
      classification: classMapping,
      response,
    },
  };
}

/**
 * Write one JSON entity to the transform output directory.
 *
 * @param {string} name - Filename without directory.
 * @param {Record<string, unknown>} value - Entity payload.
 * @returns {void}
 */
function writeJson(name, value) {
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, name),
    JSON.stringify(value, null, 2),
    "utf8",
  );
}

/**
 * Write an IPLD relationship between two output files.
 *
 * @param {string} name - Relationship filename.
 * @param {string} from - Source entity filename.
 * @param {string} to - Target entity filename.
 * @returns {void}
 */
function writeRelationship(name, from, to) {
  writeJson(name, {
    from: { "/": `./${from}` },
    to: { "/": `./${to}` },
  });
}

/**
 * Write the complete PII-free source response as a non-lexicon sidecar.
 *
 * The `.ndjson` extension keeps the sidecar outside Elephant schema validation
 * while allowing the query loader to retain all source facts and exact GeoJSON
 * in its `source_payload` column.
 *
 * @param {Record<string, unknown>} sourcePayload - Validated ArcGIS source response.
 * @returns {void}
 */
function writeSourcePayload(sourcePayload) {
  fs.writeFileSync(
    path.join(OUTPUT_DIRECTORY, "source_payload.ndjson"),
    `${JSON.stringify(sourcePayload)}\n`,
    "utf8",
  );
}

/**
 * Execute the legacy scripts-package adapter required by the currently
 * deployed oracle-node transform worker.
 *
 * @returns {void}
 */
function main() {
  const payload = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  const entities = buildAppraisalEntities(payload);
  fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeJson("property.json", entities.property);
  writeJson("parcel.json", entities.parcel);
  writeSourcePayload(entities.sourcePayload);
  if (entities.address !== null) {
    writeJson("address.json", entities.address);
    writeRelationship(
      "relationship_property_address.json",
      "property.json",
      "address.json",
    );
  }
  if (entities.lot !== null) {
    writeJson("lot.json", entities.lot);
    writeRelationship(
      "relationship_property_lot.json",
      "property.json",
      "lot.json",
    );
  }
  if (entities.tax !== null) {
    writeJson("tax_1.json", entities.tax);
    writeRelationship(
      "relationship_property_tax_1.json",
      "property.json",
      "tax_1.json",
    );
  }
  if (entities.sale !== null) {
    writeJson("sales_history_1.json", entities.sale);
    writeRelationship(
      "relationship_property_sales_history_1.json",
      "property.json",
      "sales_history_1.json",
    );
  }
  entities.geometries.forEach((geometry, index) => {
    const ordinal = index + 1;
    const geometryFile = `geometry_${ordinal}.json`;
    writeJson(geometryFile, geometry);
    writeRelationship(
      `relationship_parcel_geometry_${ordinal}.json`,
      "parcel.json",
      geometryFile,
    );
  });
}

module.exports = {
  assertNoPiiFields,
  buildAppraisalEntities,
  buildGeometryEntities,
  extractParcelCapture,
  parseSiteAddress,
  readDate,
  selectPrimaryFeature,
};

if (require.main === module) {
  main();
}
