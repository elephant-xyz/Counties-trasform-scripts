"use strict";

/**
 * Versioned Rock Island County assessment-class dictionary.
 *
 * The official labels come from the county's “2026 Annual Instructional
 * Assembly,” whose complete class list says it was updated in 2021. The
 * normalized Elephant usage value is a transform decision, not a
 * county-authored label. Codes that do not establish one safe Lexicon usage
 * remain `Unknown`.
 *
 * @see https://rockislandcountyil.gov/DocumentCenter/View/204
 */
const PROPERTY_CLASS_MAPPING_VERSION =
  "rock-island-assessors-instructions-2021-v1";
const PROPERTY_CLASS_MAPPING_SOURCE_URL =
  "https://rockislandcountyil.gov/DocumentCenter/View/204";

/**
 * @typedef {
 *   | "Residential"
 *   | "Commercial"
 *   | "Industrial"
 *   | "Agricultural"
 *   | "Conservation"
 *   | "TimberLand"
 *   | "Unknown"
 * } RockIslandPropertyUsageType
 *
 * @typedef {object} AuthoritativePropertyClassDefinition
 * @property {string} officialLabel - Exact county dictionary label.
 * @property {RockIslandPropertyUsageType} propertyUsageType - Safe Elephant normalization.
 * @property {string} normalizationBasis - Why the county label can or cannot be normalized.
 *
 * @typedef {object} PropertyClassMappingResult
 * @property {string | null} rawCode - Trimmed source class code, preserving leading zeroes.
 * @property {string | null} officialLabel - County-authored label when the code is documented.
 * @property {RockIslandPropertyUsageType} propertyUsageType - Lexicon-compatible usage value.
 * @property {"authoritative_definition" | "unmapped_source_code" | "missing_source_code"} dictionaryStatus - Documentation status.
 * @property {string} mappingVersion - Versioned transform mapping identifier.
 * @property {string} sourceUrl - Official county dictionary URL.
 * @property {string} normalizationBasis - Transform normalization rationale.
 */

/**
 * County-authored definitions paired with conservative Lexicon normalizations.
 *
 * @type {Readonly<Record<string, Readonly<AuthoritativePropertyClassDefinition>>>}
 */
const PROPERTY_CLASS_DEFINITIONS = Object.freeze({
  "0010": Object.freeze({
    officialLabel: "Rural Non-Farmland with Improvements",
    propertyUsageType: "Residential",
    normalizationBasis:
      "County instructions require a residential home-site value when this class is improved.",
  }),
  "0011": Object.freeze({
    officialLabel: "Farm Land with Improvements",
    propertyUsageType: "Agricultural",
    normalizationBasis:
      "The county definition explicitly identifies farm land.",
  }),
  "0020": Object.freeze({
    officialLabel: "Rural Non-Farmland Vacant",
    propertyUsageType: "Unknown",
    normalizationBasis:
      "The county says this idle-land class is not necessarily residential, commercial, industrial, or agricultural.",
  }),
  "0021": Object.freeze({
    officialLabel: "Farm Land Vacant",
    propertyUsageType: "Agricultural",
    normalizationBasis:
      "The county definition explicitly identifies farm land.",
  }),
  "0028": Object.freeze({
    officialLabel: "Conservation Stewardship",
    propertyUsageType: "Conservation",
    normalizationBasis:
      "The county definition requires an approved conservation management plan.",
  }),
  "0029": Object.freeze({
    officialLabel: "Wooded Acreage Transition",
    propertyUsageType: "TimberLand",
    normalizationBasis:
      "The county definition explicitly identifies qualifying wooded acreage.",
  }),
  "0030": Object.freeze({
    officialLabel: "Residential Vacant Land",
    propertyUsageType: "Residential",
    normalizationBasis:
      "The county definition explicitly identifies residential use.",
  }),
  "0032": Object.freeze({
    officialLabel: "10-30 Residential Vacant Land",
    propertyUsageType: "Residential",
    normalizationBasis:
      "The county definition explicitly identifies residential use.",
  }),
  "0040": Object.freeze({
    officialLabel: "Residential with Improvements",
    propertyUsageType: "Residential",
    normalizationBasis:
      "The county definition explicitly identifies residential use.",
  }),
  "0041": Object.freeze({
    officialLabel: "Residential Model Home",
    propertyUsageType: "Residential",
    normalizationBasis:
      "The county definition explicitly identifies residential use.",
  }),
  "0050": Object.freeze({
    officialLabel: "Commercial Vacant Land",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0052": Object.freeze({
    officialLabel: "10-30 Commercial Vacant Land",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0060": Object.freeze({
    officialLabel: "Commercial with Improvements",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0062": Object.freeze({
    officialLabel: "10-30 Commercial Vacant Land",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0065": Object.freeze({
    officialLabel: "Commercial with Farm Land",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county's primary class is commercial even though farm land is also present.",
  }),
  "0070": Object.freeze({
    officialLabel: "Commercial Office with Improvements",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0072": Object.freeze({
    officialLabel: "10-30 Commercial Vacant Land Office",
    propertyUsageType: "Commercial",
    normalizationBasis:
      "The county definition explicitly identifies commercial use.",
  }),
  "0080": Object.freeze({
    officialLabel: "Industrial with Improvements",
    propertyUsageType: "Industrial",
    normalizationBasis:
      "The county definition explicitly identifies industrial use.",
  }),
  "0081": Object.freeze({
    officialLabel: "Industrial Vacant Land",
    propertyUsageType: "Industrial",
    normalizationBasis:
      "The county definition explicitly identifies industrial use.",
  }),
  "0082": Object.freeze({
    officialLabel: "10-30 Industrial Vacant Land",
    propertyUsageType: "Industrial",
    normalizationBasis:
      "The county definition explicitly identifies industrial use.",
  }),
  "0085": Object.freeze({
    officialLabel: "Industrial with Farm Land",
    propertyUsageType: "Industrial",
    normalizationBasis:
      "The county's primary class is industrial even though farm land is also present.",
  }),
  "0090": Object.freeze({
    officialLabel: "Tax Exempt",
    propertyUsageType: "Unknown",
    normalizationBasis:
      "Tax-exempt status does not distinguish government, religious, educational, charitable, or other use.",
  }),
});

/**
 * Normalize a source class value without discarding leading zeroes.
 *
 * @param {unknown} value - Raw ArcGIS `class` attribute.
 * @returns {string | null} Trimmed class code or null.
 */
function readPropertyClassCode(value) {
  if (value === null || value === undefined) return null;
  const code = String(value).trim();
  return code.length > 0 ? code : null;
}

/**
 * Resolve a Rock Island source class to its authoritative county definition and
 * a conservative Elephant usage value.
 *
 * @param {unknown} value - Raw ArcGIS `class` attribute.
 * @returns {Readonly<PropertyClassMappingResult>} Provenance-rich mapping result.
 */
function mapPropertyClass(value) {
  const rawCode = readPropertyClassCode(value);
  if (rawCode === null) {
    return Object.freeze({
      rawCode: null,
      officialLabel: null,
      propertyUsageType: "Unknown",
      dictionaryStatus: "missing_source_code",
      mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
      sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
      normalizationBasis: "The source parcel has no assessment class code.",
    });
  }
  const definition = PROPERTY_CLASS_DEFINITIONS[rawCode];
  if (definition === undefined) {
    return Object.freeze({
      rawCode,
      officialLabel: null,
      propertyUsageType: "Unknown",
      dictionaryStatus: "unmapped_source_code",
      mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
      sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
      normalizationBasis:
        "The source code is absent from the county's published complete list and is not inferred.",
    });
  }
  return Object.freeze({
    rawCode,
    officialLabel: definition.officialLabel,
    propertyUsageType: definition.propertyUsageType,
    dictionaryStatus: "authoritative_definition",
    mappingVersion: PROPERTY_CLASS_MAPPING_VERSION,
    sourceUrl: PROPERTY_CLASS_MAPPING_SOURCE_URL,
    normalizationBasis: definition.normalizationBasis,
  });
}

module.exports = {
  PROPERTY_CLASS_DEFINITIONS,
  PROPERTY_CLASS_MAPPING_SOURCE_URL,
  PROPERTY_CLASS_MAPPING_VERSION,
  mapPropertyClass,
  readPropertyClassCode,
};
