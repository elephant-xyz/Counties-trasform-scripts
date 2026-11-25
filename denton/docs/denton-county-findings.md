# Denton County, TX (FIPS 48121) — county findings

Discovery and transform record for Oracle onboarding. Snapshot: 2026-11-25 (Pacific). Machine-readable catalog:
`denton-sources.yaml` (readiness validator: PASS, 46/46 permit jurisdictions classified).

## 1. Appraiser

- Denton Central Appraisal District (DCAD), True Prodigy public portal at `www.dentoncad.com` (React SPA; per-parcel
  detail `https://denton.prodigycad.com/property-detail/<pID>`). No CAPTCHA observed. Not scraped: the district
  publishes official bulk exports, which are the source of record.
- Source of record: 2026 certified Prodigy JSON export
  `https://dentoncad.net/data/_uploaded/files/datafiles/2026/CertifiedDataJSON/2026%20CERTIFIED%20DATA%20-%20JSON.zip`
  (2,458,367,178 bytes; one 21.2 GB JSON array `Denton-protaxExport-20260727.json`; layout
  `2026/AppraisalExportLayout/PublicJSON_FileLayout_20250124.xlsx`). Same family as the Travis CAD export already in Atlas.
- Other DCAD exports: certified Legacy 8.0.32 fixed-width (REAL / ALL / BPP / MH / Mineral), weekly file geodatabase,
  nightly appraisal CSV (2027 preliminary year), shapefiles, code tables (StateCodeDesc.pdf, LandTypeCodes.pdf,
  entity_codes.xlsx).

## 2. Parcel identifier

- DCAD property ID `pID` (integer string, unpadded) is the folio. `geoID` (e.g. `SL0100A-00000A-0000-0004-0000`) is
  the map/legal reference. City of Denton permits carry `SITE_APN` = pID (exact join, no normalization).
- Certified 2026 roll: 481,986 accounts; 379,902 real (`propType` R), 24,303 BPP, 6,381 mobile home, 71,400 mineral.
  County GIS parcels: 385,908 features (1.58% above real accounts; below the 2% threshold).

## 3. Permits

46 jurisdictions catalogued (unincorporated county + 44 municipalities wholly or partly in the county + Lincoln Park,
excluded/disestablished): 18 supported (anonymous record search or bulk open data), 23 custodian-only (records request
prepared, not sent), 4 unavailable (no portal and no request contact found), 1 excluded. Built this run: City of Denton
only, from CKAN open data `building-safety-yearly-permits` (2020–2026, 67,542 permits; `CONTRACTOR_NAME`, no license
number). Vendor families still to build: Tyler EnerGov Civic Access (county, Corinth, Prosper, Southlake, Coppell),
CentralSquare eTRAKiT (Flower Mound, Frisco, The Colony), MyGov lookup (Little Elm, Pilot Point, Celina, Double Oak,
Grapevine, Westlake), CityView (Carrollton), Socrata (Dallas), ArcGIS (Fort Worth).

## 4. Official identity (Texas)

- Corporate registry: Texas Comptroller Active Franchise Taxpayers (data.texas.gov `9cir-efmm`, official, anonymous bulk)
  with per-entity detail `GET https://comptroller.texas.gov/data-search/franchise-tax/<taxpayerId>` (JSON).
  Texas SOS SOSDirect is paid/login-only and is not used.
- Licensing: TDLR All Licenses (data.texas.gov `7358-krk7`) for electrical and A/C contractors. Texas issues no
  general-contractor license; plumbing is TSBPE (not wired).
- No Florida Sunbiz/DBPR equivalent is wired into the lexicon: `company` carries only `sunbiz_document_number`, and
  the live manifest has no `license` class or `contractor_has_license` edge (gap recorded; nothing substituted).

## 5. Usage vocabulary (DCAD state codes → lexicon)

A1/A3/A6/E1/OA2/OA3/OA6 SingleFamily·Residential; A2 ManufacturedHome; A4/OA4 Condominium; A5/OA5 Townhouse;
B1 MultipleFamily (by unit count); B2/OB2 Duplex; C1/C5/OA1/OC1/OC5 VacantLand·Residential; C2/OC2 VacantLand·Commercial;
C3/OC3/E4 VacantLand·Unknown; D1/D3/OD1 LandParcel·Agricultural; D2 Building·Agricultural; D4 LandParcel·Unknown;
D5 Conservation; E3/M1 MobileHome; F1 Commercial; F2 Industrial; F3 MobileHomePark; F4 Unit·OfficeBuilding (condo);
J* Utility/Telecommunications/Railroad. `PLAN` and `A0xx/B0xx/F0xx` builder-plan reference accounts are excluded
(DCAD: "reference only").

## 6. Transform and coverage

- Custom code: `scripts/denton-dcad-transform.py` (version `denton-dcad-certified-json-v0.4.0`) and
  `scripts/denton-city-permit-transform.py` (`denton-city-permits-ckan-v0.1.0`). Every entity's `source_http_request` is a
  GET of the official file that carried the record; `request_identifier` = pID (permits: PERMIT_NO).
- Emitted: property, address (unnormalized), parcel, geometry (point), lot, structure (stories), tax (primary
  valuation; appraised = owner appraised sum), tax_jurisdiction (taxing units except the CAD), sales_history + deed
  (from deeds; price only from a non-confidential sale on the same deed), person/company (current owners linked to the
  latest conveyance; names that do not parse cleanly are not emitted).
- Lexicon gaps kept out of records: `address.county_name` enum has no "Denton" (field omitted); exemption codes
  (HS, OV65, DV) not mapped to tax_exemption yet; improvement detail (exterior wall, class, quality), land segments,
  owner mailing addresses, appeals, and tags not mapped in v0.4.0.
- Validation: Elephant CLI 1.58.1 (github main) against the live manifest; see run evidence in the job directory.
