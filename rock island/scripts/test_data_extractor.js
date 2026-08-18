"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  assertNoPiiFields,
  buildAppraisalEntities,
} = require("./data_extractor.js");
const {
  PROPERTY_CLASS_DEFINITIONS,
  PROPERTY_CLASS_MAPPING_SOURCE_URL,
  PROPERTY_CLASS_MAPPING_VERSION,
  mapPropertyClass,
} = require("./propertyClassMapping.js");

/**
 * @typedef {object} TestFeature
 * @property {Record<string, unknown>} properties - Synthetic ArcGIS attributes.
 * @property {Record<string, unknown> | null} geometry - Synthetic GeoJSON geometry.
 */

/**
 * Build a synthetic prepared capture without using county records or private
 * addresses.
 *
 * @param {readonly TestFeature[]} features - Synthetic ArcGIS features.
 * @returns {Record<string, unknown>} Multi-request transform input.
 */
function preparedPayload(features) {
  return {
    ParcelFeature: {
      source_http_request: {
        method: "GET",
        url: "https://example.invalid/FeatureServer/0/query",
        multiValueQueryString: {
          where: ["PIN='0012345678'"],
          outFields: ["PIN,class,EAV,EMV"],
        },
      },
      response: {
        type: "FeatureCollection",
        features: features.map((feature, index) => ({
          type: "Feature",
          id: index + 1,
          properties: feature.properties,
          geometry: feature.geometry,
        })),
      },
    },
  };
}

test("maps the official 22-code class dictionary exactly", () => {
  const expectedDefinitions = [
    ["0010", "Rural Non-Farmland with Improvements", "Residential"],
    ["0011", "Farm Land with Improvements", "Agricultural"],
    ["0020", "Rural Non-Farmland Vacant", "Unknown"],
    ["0021", "Farm Land Vacant", "Agricultural"],
    ["0028", "Conservation Stewardship", "Conservation"],
    ["0029", "Wooded Acreage Transition", "TimberLand"],
    ["0030", "Residential Vacant Land", "Residential"],
    ["0032", "10-30 Residential Vacant Land", "Residential"],
    ["0040", "Residential with Improvements", "Residential"],
    ["0041", "Residential Model Home", "Residential"],
    ["0050", "Commercial Vacant Land", "Commercial"],
    ["0052", "10-30 Commercial Vacant Land", "Commercial"],
    ["0060", "Commercial with Improvements", "Commercial"],
    ["0062", "10-30 Commercial Vacant Land", "Commercial"],
    ["0065", "Commercial with Farm Land", "Commercial"],
    ["0070", "Commercial Office with Improvements", "Commercial"],
    ["0072", "10-30 Commercial Vacant Land Office", "Commercial"],
    ["0080", "Industrial with Improvements", "Industrial"],
    ["0081", "Industrial Vacant Land", "Industrial"],
    ["0082", "10-30 Industrial Vacant Land", "Industrial"],
    ["0085", "Industrial with Farm Land", "Industrial"],
    ["0090", "Tax Exempt", "Unknown"],
  ];

  assert.deepEqual(
    Object.entries(PROPERTY_CLASS_DEFINITIONS).map(([code, definition]) => [
      code,
      definition.officialLabel,
      definition.propertyUsageType,
    ]),
    expectedDefinitions,
  );

  for (const [
    rawCode,
    officialLabel,
    propertyUsageType,
  ] of expectedDefinitions) {
    assert.deepEqual(mapPropertyClass(rawCode), {
      rawCode,
      officialLabel,
      propertyUsageType,
      dictionaryStatus: "authoritative_definition",
      mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
      sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
      normalizationBasis:
        PROPERTY_CLASS_DEFINITIONS[rawCode].normalizationBasis,
    });
  }
});

test("keeps missing and undocumented class codes conservatively unknown", () => {
  assert.deepEqual(mapPropertyClass(" 04600 "), {
    rawCode: "04600",
    officialLabel: null,
    propertyUsageType: "Unknown",
    dictionaryStatus: "unmapped_source_code",
    mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
    sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
    normalizationBasis:
      "The source code is absent from the county's published complete list and is not inferred.",
  });
  assert.deepEqual(mapPropertyClass(null), {
    rawCode: null,
    officialLabel: null,
    propertyUsageType: "Unknown",
    dictionaryStatus: "missing_source_code",
    mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
    sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
    normalizationBasis: "The source parcel has no assessment class code.",
  });
});

test("maps parcel facts while preserving the complete PII-free source response", () => {
  const payload = preparedPayload([
    {
      properties: {
        OBJECTID: 1,
        PIN: "0012345678",
        site_address: "123 EXAMPLE ST",
        Site_City: "MOLINE",
        Site_State: "IL",
        Site_Zip: "61265",
        X_longitude: -90.5,
        Y_latitude: 41.5,
        GIS_acres_num: 0.5,
        class: "0081",
        Zoning: "I2",
        EAV: 100000,
        EMV: 300000,
        YRBuilt: 1980,
        TOTSQFT: 2000,
        extra_public_fact: "preserve exactly",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-90.5, 41.5],
            [-90.4, 41.5],
            [-90.4, 41.6],
            [-90.5, 41.5],
          ],
        ],
      },
    },
  ]);

  const entities = buildAppraisalEntities(payload);
  const sourceResponse = payload.ParcelFeature.response;

  assert.deepEqual(entities.parcel, {
    source_http_request: payload.ParcelFeature.source_http_request,
    request_identifier: "0012345678",
    parcel_identifier: "0012345678",
  });
  assert.deepEqual(entities.address, {
    source_http_request: payload.ParcelFeature.source_http_request,
    unnormalized_address: "123 EXAMPLE ST, MOLINE IL 61265",
    city_name: "MOLINE",
    country_code: "US",
    latitude: 41.5,
    longitude: -90.5,
  });
  assert.equal(entities.property.property_type, "Building");
  assert.equal(entities.property.property_usage_type, "Industrial");
  assert.equal(entities.geometries.length, 1);
  assert.deepEqual(entities.sourcePayload.response, sourceResponse);
  assert.deepEqual(entities.sourcePayload.classification, {
    rawCode: "0081",
    officialLabel: "Industrial Vacant Land",
    propertyUsageType: "Industrial",
    dictionaryStatus: "authoritative_definition",
    mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
    sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
    normalizationBasis: PROPERTY_CLASS_DEFINITIONS["0081"].normalizationBasis,
  });
});

test("rejects owner and tax-bill identity fields before sidecar preservation", () => {
  for (const fieldName of [
    "owner1_name",
    "owner2_address",
    "Owner_Name",
    "Owner_City",
    "taxbill_name",
    "taxbill_addr",
    "taxbill_city",
  ]) {
    assert.throws(
      () =>
        assertNoPiiFields([
          {
            properties: {
              PIN: "0012345678",
              [fieldName]: "DO NOT RETAIN",
            },
            geometry: null,
          },
        ]),
      /Prohibited PII field/,
    );
  }
});
