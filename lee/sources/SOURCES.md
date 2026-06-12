# Lee County, FL — data source registry

`sources.json` is the machine-readable registry of the public data sources behind Lee
County's elephant-xyz ingestion: what each source is, how it is accessed, how it
refreshes, how completeness is checked, and the traps that have already bitten us.
`sources.schema.json` validates it. `last_verified` records the date of the most recent
live URL verification (set it to `null` if a change is made without re-verifying).

Last verification (2026-06-12, US egress): leepa.org, Accela LEECO, and dos.fl.gov/sunbiz
all answer 200; bbb.org answers 403 to plain curl — that is the documented bot challenge,
not an outage (the harvester retries through it).

## The four sources

**Lee County Property Appraiser** (`leepa.org`) — the appraisal backbone, ~516k parcels
scraped via browser flows (`LeeCurated.json` + `LeeCostCard.json`; referenced by skills,
not yet published in oracle-node main). Search is by STRAP, and the exact punctuation
matters — it must match the portal's format. No CAPTCHA, but the portal only tolerates
~3-4 concurrent sessions. Refresh is a repair-mode re-prepare from the seed CSV
(`s3://counties-seeds/lee.csv`), quarterly or on demand, gated by MVL mirror-validation
(global completeness >= 0.8 per prepared/transformed pair) plus seed-vs-prepared count
reconciliation.

**Accela permits** (`aca-prod.accela.com/LEECO/`) — browser-required detail pages,
harvested property-first for permit-eligible (commercial/industrial) parcels from the
seed. The big one: a detail page can display a *different parcel* than the one you
searched. Early Lee loads linked permits to the displayed parcel and were corrupted,
forcing a repair — permits must always be linked via `propertyFirstTarget` (the
requested parcel). The permit portal's parcel-id format also differs from the
appraiser's STRAP, so normalization is required. Start concurrency at 2; the portal
degrades above ~4.

**Florida Sunbiz** (`dos.fl.gov/sunbiz/`) — statewide corporate registrations, scoped to
Lee by ZIP-prefix matching (~12.6M records scanned, ~379k Lee-matched). Quarterly bulk
`cordata.zip` (~1.7 GB) plus daily `YYYYMMDDc.txt` incrementals. Two traps: the download
host is Cloudflare-challenged (plain curl fails; use a real browser — the exact bulk URL
is undocumented in the skills), and `cordata.zip` is ZIP method 9 (Deflate64), which
streaming libs cannot read in Lambda — expand locally and stage the `.txt` entries to S3
(`--source-format text`). Known gaps, deliberately left open: `corevent.zip` filing
history is not ingested, and `party_type_code` decoding is incomplete.

**BBB** (`bbb.org/us/category/<category>`) — contractor reputation, joined to permits by
contractor name. Puppeteer category crawl via `harvest-bbb-category.mjs` (referenced by
skills, not yet published), resumable and tunable (`--page-delay-ms 2000`,
`--profile-delay-ms 1500`, `--start-page`/`--max-pages`/`--max-profiles`). BBB serves
bot challenges; the script retries through them (`--challenge-attempts`,
`--challenge-check-interval-ms`), but datacenter IPs may need `--headless false`.

## Cross-cutting operational notes

- **US egress gate** — all *local* probing of these sources requires a US egress IP;
  check `curl -s ipinfo.io/country` before debugging any block. Lambda workers run from
  US AWS regions and are unaffected.
- **Budget-handler incident** — a budget alarm once silently disabled the event-source
  mappings mid-run, stalling ingestion with no errors. If ingest stalls, first confirm
  `EmergencyStopEnabled=false` and that the mappings are `Enabled`.

## How to update this registry

Open a PR against this repo. Keep `sources.json` valid against `sources.schema.json`
(`npx --yes ajv-cli validate -s sources.schema.json -d sources.json`). This is the first
instance of a per-county source-registry pattern — new counties should copy this layout
under `<county>/sources/`.
