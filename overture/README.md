# Overture places

This folder preserves the reviewable rules and provenance for county-scoped
Overture Maps places publications. It contains metadata, configuration, and run
evidence only.

Extracted JSONL and source GeoParquet remain in object storage. Published
county parquet remains in IPFS. No extracted place records, business contact
records, credentials, or environment configuration belong in this repository.

## Files

- [`sources.yaml`](sources.yaml) records the approved Overture source datasets,
  licences, attribution requirements, and publication hard stops.
- [`config/hosted-service-categories.txt`](config/hosted-service-categories.txt)
  is the release-scoped advisory taxonomy rule used to flag hosted services
  without excluding them.
- [`NOTICE.template.txt`](NOTICE.template.txt) is the publication notice
  template.
- [`runs/lee/2026-07-22.0/report.md`](runs/lee/2026-07-22.0/report.md) records
  the Lee County pilot extraction, validation, load, and publication.
- [`runs/lee/2026-07-22.0/NOTICE.txt`](runs/lee/2026-07-22.0/NOTICE.txt) is the
  rendered notice shipped with that public artifact.

## Hosted-service scope

The committed taxonomy rule contains five Lee-verified, full
`taxonomy.hierarchy` paths and flagged 956 rows in the Lee pilot. It is an
evidence-based seed scope for Overture release `2026-07-22.0`; it is not a
claimed or inferred 250-entry list. Any expansion requires observed full paths,
review, and a release-scoped rule update.

## Published Lee artifact

The public Lee places parquet is:

<https://ipfs.filebase.io/ipns/k51qzi5uqu5djfa3kbhcxedqlh7kiuyi22bd60he1nsa0wr2jrseo6vvxvwke5/lee/places-table.parquet>

Its IPNS family includes the rendered `NOTICE.txt` and machine-readable
`lee/index.json`. See the run report for the CID, gates, counts, and operator
decisions.
