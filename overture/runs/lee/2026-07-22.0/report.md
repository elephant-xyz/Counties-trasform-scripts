# Lee County Overture places pilot

This report records the metadata and operator decisions for the Lee County,
Florida pilot. It does not contain extracted place records or business contact
records.

## Run identity

- County: Lee, Florida
- County FIPS: `12071`
- Overture release: `2026-07-22.0`
- STAC latest at extraction: `2026-07-22.0`
- Boundary: Census TIGER/Line `tl_2024_us_county` (2024 vintage)
- Extraction date: `2026-08-12`
- Publication accessed/change date: `2026-08-13`
- Extraction method: bounding-box pruning followed by `ST_Within` boundary clip

## Reconciliation

- Bounding-box candidates: 40,517. This is an intermediate optimization count,
  not a publishable county count.
- Boundary-clipped places: **40,191**.
- Scoping baseline: 40,190.
- Reconciliation: the verified TIGER 2024 clip produced one more place than the
  scoping baseline. The baseline is not an `expected_count`.
- Address-versus-geometry county discrepancies: 0.
- Extraction duration: 363,985 ms, about 6.1 minutes.
- Operating status: 25,049 open; 14,698 blank; 444 permanently closed.

## Taxonomy and hosted-service rules

- Distinct `taxonomy.primary` values: 1,195.
- Distinct full `taxonomy.hierarchy` paths: 1,194.
- Hosted-service rules: five release-scoped, full hierarchy paths.
- Hosted-service flags: **956** total: ATM 323, rental kiosk 83, propane
  supplier 99, money transfer service 351, and trusts 100.

The five rules are preserved in
[`../../../config/hosted-service-categories.txt`](../../../config/hosted-service-categories.txt).
They are an evidence-based seed scope, not a claimed 250-entry list. Places
were flagged advisory-only and were not excluded.

## Source and licence gate

Observed `sources[].dataset` values were:

- `AllThePlaces`
- `BrightQuery`
- `DAC`
- `Foursquare`
- `meta`
- `Microsoft`
- `Overture`
- `Overture-signals`
- `PinMeTo`
- `RenderSEO`

The case-insensitive source gate passed for all 40,191 places:

- unknown datasets: none
- OSM present: false
- `Overture` and `Overture-signals`: allowed by human decision on `2026-08-12`
  as Overture's own lineage
- OSM or any future unknown dataset: hard stop; do not publish

The approved source and licence record is
[`../../../sources.yaml`](../../../sources.yaml).

## Neon load and coverage

- `business_locations`: **40,191**, matching the clipped extract.
- `business_location_categories`: 38,137.
- `business_location_sources`: 297,856; source gate passed.
- `overture_place_extractions`: 1 for Lee and this release.
- Geometry present: 40,191.
- Parcel links: 0; intentionally deferred.
- Company links: 0; intentionally not inferred at ingest.
- `oracle_dataset_coverage.ingested_count`: 40,191.
- `oracle_dataset_coverage.expected_count`: **NULL**. There is no authoritative
  denominator for all Lee County business locations, so completeness must not
  be reported as an artificial 100%.

## DBPR salon quality check

Florida DBPR listed 1,420 licensed salon establishments in Lee. Overture had
1,435 places whose primary taxonomy was `beauty_salon`, `hair_salon`,
`nail_salon`, or `barber` (514 + 453 + 268 + 200). The earlier scoping figure
was 1,436 before the final clip reconciliation.

The close agreement is evidence of sector coverage only. DBPR covers one
licensed sector and is not an `expected_count` for all places.

## Publication

- Human PII decision (`2026-08-12`): approved to publish public business
  emails and phones as-is.
- Filebase bucket: `elephant-oracle-open-data-lee-places`.
- IPNS label: `oracle-open-data-lee-places`.
- IPNS name:
  `k51qzi5uqu5djfa3kbhcxedqlh7kiuyi22bd60he1nsa0wr2jrseo6vvxvwke5`.
- Directory CID:
  `bafybeicfvfm5reer2ugipirxufpu6u3tmseoezsdfyhseysoo6p5r2mj4a`.
- Public parquet:
  <https://ipfs.filebase.io/ipns/k51qzi5uqu5djfa3kbhcxedqlh7kiuyi22bd60he1nsa0wr2jrseo6vvxvwke5/lee/places-table.parquet>
- Gateway verification: `2026-08-13T03:59:11Z`.
- Rendered publication notice:
  [`NOTICE.txt`](NOTICE.txt).

Pre-publication gates passed:

- parquet rows 40,191 == current Lee Neon rows for this release
- duplicate GERS IDs: 0
- null geometries: 0
- OSM present: false
- unknown source datasets: none
- `taxonomy.hierarchy` serialized as `/`-delimited scalar paths

The IPNS family contains the public parquet, `lee/index.json`, and the rendered
root `NOTICE.txt`. Extracted JSONL and source parquet are not stored in git.
