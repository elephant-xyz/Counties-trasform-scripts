# Rock Island County transform

This package converts Rock Island County, Illinois, ArcGIS parcel features into
Elephant appraisal entities. It targets the legacy scripts-package transform
adapter used by `oracle-node`.

## Source and privacy boundary

The appraisal source is the county ArcGIS FeatureServer. The prepared request
must omit owner and tax-bill identity fields. The extractor also rejects
owner-prefixed and tax-bill identity attributes before it writes the complete
source response to `source_payload.ndjson`.

The sidecar preserves all other source attributes and exact GeoJSON topology for
query loading. Raw captures, downloaded county data, credentials, environment
files, and generated transform output do not belong in this repository.

## Property classes

`scripts/propertyClassMapping.js` records the complete 22-code class list in the
county’s [2026 Annual Instructional Assembly][class-source]. The county document
marks that class list as updated in 2021, which is reflected in mapping version
`rock-island-assessors-instructions-2021-v1`.

The raw, leading-zero class code, official label, mapping version, source URL,
and normalization rationale are retained in the source sidecar. The transform
uses `Unknown` for undocumented source codes and for documented classes such as
Rural Non-Farmland Vacant (`0020`) or Tax Exempt (`0090`) that do not establish
one safe Elephant usage.

[class-source]: https://rockislandcountyil.gov/DocumentCenter/View/204

## Mapping coverage

- `data_extractor.js` emits property, parcel, site address, lot, tax,
  sales-history, and polygon entities when source facts exist.
- `structureMapping.js` and `layoutMapping.js` intentionally emit nothing
  because the source has no detailed structure or room facts.
- `ownerMapping.js` intentionally emits nothing because owner identity is
  outside the approved public-data capture.
- `utilityMapping.js` intentionally emits nothing because the source has no
  utility-system facts.

## Validation

Run the synthetic, source-safe tests from the repository root:

```sh
node --test "rock island/scripts/test_data_extractor.js"
```

The tests lock the official 22-code dictionary, conservative `Unknown`
behavior, raw-code provenance, PII rejection, parcel/address extraction, and
complete source-response preservation. No county record or private address is
stored in the test.
