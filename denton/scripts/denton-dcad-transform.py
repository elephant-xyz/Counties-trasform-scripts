#!/usr/bin/env python3
"""Denton County, TX appraisal transform (job-local custom code; build-county-transform output contract).

Source of record: Denton Central Appraisal District 2026 certified Prodigy JSON export
  GET https://dentoncad.net/data/_uploaded/files/datafiles/2026/CertifiedDataJSON/2026%20CERTIFIED%20DATA%20-%20JSON.zip
(one 21 GB JSON array; probes/extract_real.py streams the real-property records verbatim into a JSONL.gz).

Writes one ZIP per property (data/<files>) into <out>/group/<pID>.zip, plus results.jsonl
(receipt per pID: success/excluded/error, warnings, source line sha256) and summary.json.
Data-group roots are named by the live lexicon manifest CIDs (fetched at run time).

Usage: denton-dcad-transform.py <extract.jsonl.gz> <out-dir> [--pids file] [--limit N]
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter

TRANSFORM_VERSION = "denton-dcad-certified-json-v0.4.0"
COUNTY_NAME = "Denton"
SOURCE_URL = "https://dentoncad.net/data/_uploaded/files/datafiles/2026/CertifiedDataJSON/2026%20CERTIFIED%20DATA%20-%20JSON.zip"
MANIFEST_URL = "https://lexicon.elephant.xyz/api/manifest"
REQ = {"method": "GET", "url": SOURCE_URL}

NAME_RE = re.compile(r"^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$")
MIDDLE_RE = re.compile(r"^[A-Z][a-zA-Z\s\-',.]*$")
BUSINESS_RE = re.compile(
    r"\b(LLC|L\.L\.C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|L\.P|LTD|LLP|PLLC|PC|TRUST|TRS|TRSTS|TRTS|TRUSTEE|TRUSTEES|"
    r"ESTATE|EST|BANK|CHURCH|MINISTRIES|ISD|SCHOOL|DISTRICT|CITY|COUNTY|STATE|TEXAS|AUTHORITY|ASSOCIATION|ASSN|HOA|"
    r"PARTNERS|PARTNERSHIP|HOLDINGS|PROPERTIES|INVESTMENTS|VENTURES|GROUP|FUND|FOUNDATION|UNIVERSITY|COLLEGE|"
    r"HOMES|HOMEBUILDERS|BUILDERS|DEVELOPMENT|REALTY|RENTALS?|CAPITAL|MANAGEMENT|SERVICES|ENTERPRISES|AMERICAN|"
    r"NATIONAL|FEDERAL|UNITED|DEPT|DEPARTMENT|SOCIETY|CLUB|LEAGUE|MUD|FWSD|SUD|WSC|UTILITY|UTILITIES|RAILROAD|"
    r"PIPELINE|ELECTRIC|ENERGY|OIL|GAS|BORROWER|SERIES|REIT|ACQUISITIONS?|OWNER|LENDING|MORTGAGE|SFR|"
    r"COMMUNITY|DBA|ET\s+AL|ETAL|ATTN|C/O|LIVING|REVOCABLE|IRREVOCABLE|FAMILY)\b"
)
SUFFIXES = {"JR": "Jr.", "SR": "Sr.", "II": "II", "III": "III", "IV": "IV"}

DEED_TYPES = {
    "WD": "Warranty Deed", "WDVL": "Warranty Deed", "SW": "Special Warranty Deed", "SWD": "Special Warranty Deed",
    "QD": "Quitclaim Deed", "QCD": "Quitclaim Deed", "TD": "Trustee's Deed", "SD": "Sheriff's Deed",
    "CD": "Correction Deed",
}

# DCAD state code -> (property_type, property_usage_type, build_status, structure_form, ownership_estate_type)
# Source: https://dentoncad.net/data/_uploaded/files/datafiles/gis/StateCodeDesc.pdf
STATE_CODE_MAP = {
    "A1": ("SingleFamily", "Residential", "Improved", None, None),
    "A2": ("ManufacturedHome", "Residential", "Improved", "ManufacturedHomeOnLand", None),
    "A3": ("SingleFamily", "Residential", "Improved", None, None),
    "A4": ("Condominium", "Residential", "Improved", None, "Condominium"),
    "A5": ("Townhouse", "Residential", "Improved", "TownhouseRowhouse", None),
    "A6": ("SingleFamily", "Residential", "Improved", None, None),
    "B1": ("MultipleFamily", "Residential", "Improved", None, None),
    "B2": ("Duplex", "Residential", "Improved", "Duplex", None),
    "C1": ("VacantLand", "Residential", "VacantLand", None, None),
    "C2": ("VacantLand", "Commercial", "VacantLand", None, None),
    "C3": ("VacantLand", "Unknown", "VacantLand", None, None),
    "C5": ("VacantLand", "Residential", "VacantLand", None, None),
    "D1": ("LandParcel", "Agricultural", None, None, None),
    "D2": ("Building", "Agricultural", "Improved", None, None),
    "D3": ("LandParcel", "Agricultural", None, None, None),
    "D4": ("LandParcel", "Unknown", None, None, None),
    "D5": ("LandParcel", "Conservation", None, None, None),
    "E1": ("SingleFamily", "Residential", "Improved", None, None),
    "E3": ("MobileHome", "Residential", "Improved", "ManufacturedHomeOnLand", None),
    "E4": ("VacantLand", "Unknown", "VacantLand", None, None),
    "F1": ("Building", "Commercial", "Improved", None, None),
    "F2": ("Building", "Industrial", "Improved", None, None),
    "F3": ("LandParcel", "MobileHomePark", "Improved", None, None),
    "F4": ("Unit", "OfficeBuilding", "Improved", None, "Condominium"),
    "J1": ("LandParcel", "Utility", None, None, None), "J2": ("LandParcel", "Utility", None, None, None),
    "J3": ("LandParcel", "Utility", None, None, None), "J4": ("LandParcel", "TelecommunicationsFacility", None, None, None),
    "J5": ("LandParcel", "Railroad", None, None, None), "J6": ("LandParcel", "Utility", None, None, None),
    "J7": ("LandParcel", "TelecommunicationsFacility", None, None, None), "J8": ("LandParcel", "Utility", None, None, None),
    "OA1": ("VacantLand", "Residential", "VacantLand", None, None),
    "OA2": ("SingleFamily", "Residential", "Improved", None, None),
    "OA3": ("SingleFamily", "Residential", "Improved", None, None),
    "OA4": ("Condominium", "Residential", "Improved", None, "Condominium"),
    "OA5": ("Townhouse", "Residential", "Improved", "TownhouseRowhouse", None),
    "OB2": ("Duplex", "Residential", "Improved", "Duplex", None),
    "OC1": ("VacantLand", "Residential", "VacantLand", None, None),
    "OC2": ("VacantLand", "Commercial", "VacantLand", None, None),
    "OC3": ("VacantLand", "Unknown", "VacantLand", None, None),
    "OC5": ("VacantLand", "Residential", "VacantLand", None, None),
    "OD1": ("LandParcel", "Agricultural", None, None, None),
    "OA6": ("SingleFamily", "Residential", "Improved", None, None),
    "M1": ("MobileHome", "Residential", "Improved", "MobileHome", None),
    "J3A": ("LandParcel", "Utility", None, None, None),
}
REFERENCE_PLAN_RE = re.compile(r"^(PLAN|[AB]0\d+|F0\d+)$")
JURISDICTION_TYPES = {"City": "Municipal", "County": "County", "School": "Independent School District",
                      "College": "Community College District", "Hospital": "Hospital District",
                      "Water": "Water District", "TIF Zone": "Improvement District", "Emergency": "Special District",
                      "Other": "Special District", "MUD": "Utility District",
                      "Public Improvement District": "Improvement District", "Road": "Special District"}


def s(v):
    return "" if v is None else str(v).strip()


def num(v):
    try:
        if v is None or s(v) == "":
            return None
        x = float(v)
        return x
    except (TypeError, ValueError):
        return None


def intval(v):
    x = num(v)
    return int(x) if x is not None else None


def yearval(v):
    x = intval(v)
    return x if x is not None and 1700 <= x <= 2030 else None


def first(lst):
    return (lst or [{}])[0] or {}


def date10(v):
    v = s(v)
    return v[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", v) else None


def title_token(t):
    return "-".join("'".join(p[:1].upper() + p[1:].lower() for p in seg.split("'")) for seg in t.split("-"))


def person_from(last, given, warnings):
    toks = [t for t in re.split(r"\s+", given.strip()) if t]
    suffix = None
    if toks and toks[-1].rstrip(".") in SUFFIXES:
        suffix = SUFFIXES[toks.pop().rstrip(".")]
    if not toks or not last.strip():
        return None
    first_name = title_token(toks[0])
    middle = " ".join(title_token(t) for t in toks[1:]) or None
    last_name = " ".join(title_token(t) for t in last.strip().split())
    if not NAME_RE.match(first_name) or not NAME_RE.match(last_name) or (middle and not MIDDLE_RE.match(middle)):
        warnings.append(f"owner name part did not fit lexicon name pattern; not emitted as person")
        return None
    return {"first_name": first_name, "last_name": last_name, "middle_name": middle, "suffix_name": suffix}


def parse_owner(name, warnings):
    """Return ('company', name) | ('persons', [..]) | (None, None). Conservative: anything unclear is not emitted."""
    n = re.sub(r"\s+", " ", s(name).upper())
    if not n:
        return None, None
    if BUSINESS_RE.search(n) or "," not in n:
        return "company", re.sub(r"\s+", " ", s(name))
    people = []
    last = None
    for seg in [x.strip() for x in n.split("&") if x.strip()]:
        if "," in seg:
            if seg.count(",") != 1:
                warnings.append("owner name segment with multiple commas; owner not emitted")
                return None, None
            last, given = [x.strip() for x in seg.split(",")]
        else:
            given = seg
            if last is None or len(given.split()) > 3:
                warnings.append("owner name segment without a clear surname; owner not emitted")
                return None, None
        p = person_from(last, given, warnings)
        if p is None:
            return None, None
        people.append(p)
    return ("persons", people) if people else (None, None)


def map_use(state_cd, prof, warnings):
    codes = [c.strip() for c in s(prof.get("stateCodes") or state_cd).split(",") if c.strip()]
    primary = s(state_cd) or (codes[0] if codes else "")
    m = STATE_CODE_MAP.get(primary) or STATE_CODE_MAP.get(primary[:2])
    improved = (num(prof.get("imprvMainArea")) or 0) > 0
    if m is None:
        warnings.append(f"unmapped state code {primary or '<empty>'} -> property_usage_type Unknown")
        m = ("Building" if improved else "LandParcel", "Unknown", "Improved" if improved else None, None, None)
    ptype, usage, build, form, estate = m
    if build == "VacantLand" and improved:
        warnings.append(f"state code {primary} says vacant but improvement area recorded; build_status Improved")
        build = "Improved"
    if build is None:
        build = "Improved" if improved else "VacantLand"
    if build == "Improved" and ptype == "VacantLand":
        ptype = "Building"
    if ptype == "MultipleFamily":
        units = intval(prof.get("imprvUnits")) or 0
        if units > 10:
            ptype, form = "MultiFamilyMoreThan10", "MultiFamilyMoreThan10"
        elif units >= 5:
            ptype, form = "MultiFamilyLessThan10", "MultiFamily5Plus"
    if ptype == "SingleFamily" and (intval(prof.get("imprvUnits")) or 1) == 1 and improved:
        form = "SingleFamilyDetached"
    return ptype, usage, build, form, estate, primary


def link(name):
    return {"/": f"./{name}"}


def transform(rec, manifest):
    pid = s(rec.get("pID"))
    if not re.fullmatch(r"\d+", pid):
        raise ValueError("invalid pID")
    warnings = []
    base = {"source_http_request": REQ, "request_identifier": pid}
    legal = first(rec.get("propertyLegalDescription"))
    ident = first(rec.get("propertyIdentification"))
    chars = first(rec.get("propertyCharacteristics"))
    prof = first(rec.get("propertyProfile"))
    situs = next((x for x in rec.get("situses") or [] if x.get("primarySitus")), first(rec.get("situses")))
    street = " ".join(x for x in [s(situs.get("streetNum")), s(situs.get("streetPrefix")), s(situs.get("streetName")),
                                  s(situs.get("streetSuffix"))] if x)
    if not s(situs.get("streetName")) and not s(situs.get("city")):
        return None, ["no situs street or city"], "excluded:no_situs"
    unit = s(situs.get("streetSecondary"))
    city, zipc = s(situs.get("city")), s(situs.get("zip"))
    unnorm = ", ".join(x for x in [street + (f" {unit}" if unit else ""), city, " ".join(x for x in [s(situs.get("state")) or "TX", zipc] if x)] if x)

    if REFERENCE_PLAN_RE.match(s(prof.get("stateCd")).upper()):
        return None, ["builder home plan reference account (DCAD: reference only)"], "excluded:reference_plan"
    ptype, usage, build, form, estate, state_cd = map_use(prof.get("stateCd"), prof, warnings)
    files = {}
    rel = {}
    lat = lon = None
    try:
        g = json.loads(rec.get("geometry") or "null")
        if isinstance(g, list) and len(g) == 2:
            lat, lon = float(g[0]), float(g[1])
            if not (32.5 < lat < 33.7 and -97.7 < lon < -96.6):
                warnings.append("geometry point outside Denton County bounds; omitted")
                lat = lon = None
    except (ValueError, TypeError):
        warnings.append("no geometry point in source")
    area = num(prof.get("imprvMainArea"))
    total_area = num(prof.get("imprvTotalArea"))
    units = intval(prof.get("imprvUnits"))
    files["property.json"] = {
        **base,
        "parcel_identifier": pid,
        "property_legal_description_text": s(legal.get("legalDescription")) or None,
        "property_type": ptype,
        "property_usage_type": usage,
        "build_status": build,
        "structure_form": form,
        "ownership_estate_type": estate,
        "number_of_units": units if units and units > 0 else None,
        "property_structure_built_year": yearval(prof.get("imprvActualYearBuilt")),
        "property_effective_built_year": yearval(prof.get("imprvEffYearBuilt")),
        "livable_floor_area": str(int(area)) if area and area >= 10 else None,
        "total_area": str(int(total_area)) if total_area and total_area >= 10 else None,
        "zoning": s(chars.get("zoning")) or None,
    }
    files["address.json"] = {**base, "unnormalized_address": unnorm,
                             "latitude": lat, "longitude": lon}
    files["parcel.json"] = {**base, "parcel_identifier": pid}
    files["relationship_property_has_address.json"] = {"from": link("property.json"), "to": link("address.json")}
    files["relationship_property_has_parcel.json"] = {"from": link("property.json"), "to": link("parcel.json")}
    rel["property_has_address"] = link("relationship_property_has_address.json")
    rel["property_has_parcel"] = [link("relationship_property_has_parcel.json")]
    if lat is not None:
        files["geometry.json"] = {**base, "latitude": lat, "longitude": lon}
        files["relationship_parcel_has_geometry.json"] = {"from": link("parcel.json"), "to": link("geometry.json")}
        rel["parcel_has_geometry"] = [link("relationship_parcel_has_geometry.json")]

    acres = num(prof.get("landTotalAcres"))
    sqft = intval(prof.get("landTotalSqft"))
    width = intval(prof.get("landSizeEffectiveFront"))
    depth = intval(prof.get("landSizeEffectiveDepth"))
    files["lot.json"] = {
        **base,
        "lot_type": None if acres is None or acres <= 0 else ("GreaterThanOneQuarterAcre" if acres > 0.25 else "LessThanOrEqualToOneQuarterAcre"),
        "lot_length_feet": depth if depth and depth > 0 else None,
        "lot_width_feet": width if width and width > 0 else None,
        "lot_area_sqft": sqft if sqft and sqft > 0 else None,
        "lot_size_acre": acres if acres and acres > 0 else None,
        "landscaping_features": None, "view": None, "fencing_type": None, "fence_height": None, "fence_length": None,
        "driveway_material": None, "driveway_condition": None, "lot_condition_issues": None,
    }
    files["relationship_property_has_lot.json"] = {"from": link("property.json"), "to": link("lot.json")}
    rel["property_has_lot"] = link("relationship_property_has_lot.json")

    stories = num(prof.get("imprvStories"))
    if build == "Improved":
        st = {k: None for k in STRUCTURE_REQUIRED}
        st.update(base)
        st["number_of_stories"] = stories if stories and stories > 0 else None
        files["structure.json"] = st
        files["relationship_property_has_structure.json"] = {"from": link("property.json"), "to": link("structure.json")}
        rel["property_has_structure"] = link("relationship_property_has_structure.json")

    # Tax: primary valuation + owner-level appraised/net appraised totals.
    val = next((v for v in rec.get("valuations") or [] if v.get("isPrimary") == 1), None)
    tax_year = yearval(rec.get("pYear"))
    if val and tax_year:
        owners = rec.get("owners") or []
        ov = [x for o in owners for x in (o.get("ownerValue") or [])]
        appraised = sum(num(x.get("ownerAppraisedValue")) or 0 for x in ov) if ov else None
        name = f"tax_{tax_year}.json"
        t = {**base, "tax_year": tax_year,
             "property_land_amount": num(val.get("landValue")),
             "property_building_amount": num(val.get("structureValue")),
             "property_market_value_amount": num(val.get("value")),
             "monthly_tax_amount": None, "period_start_date": None, "period_end_date": None}
        if appraised is not None:
            t["property_assessed_value_amount"] = appraised
        files[name] = {k: v for k, v in t.items() if not (k in ("property_market_value_amount",) and v is None)}
        files[f"relationship_property_has_tax_{tax_year}.json"] = {"from": link("property.json"), "to": link(name)}
        rel["property_has_tax"] = [link(f"relationship_property_has_tax_{tax_year}.json")]
        tj_links = []
        for i, tu in enumerate(rec.get("taxingunits") or [], start=1):
            jt = JURISDICTION_TYPES.get(s(tu.get("taxingUnitType")))
            if s(tu.get("taxingUnitType")) == "Appraisal District":
                continue
            jn = f"tax_jurisdiction_{i}.json"
            files[jn] = {**base, "jurisdiction_name": s(tu.get("taxingUnitName")) or None, "jurisdiction_type": jt}
            if jt is None:
                warnings.append(f"taxing unit type {s(tu.get('taxingUnitType'))} not mapped; jurisdiction_type null")
            rn = f"relationship_tax_{tax_year}_has_tax_jurisdiction_{i}.json"
            files[rn] = {"from": link(name), "to": link(jn)}
            tj_links.append(link(rn))
        if tj_links:
            rel["tax_has_tax_jurisdiction"] = tj_links
    else:
        warnings.append("no primary valuation; tax entity omitted")

    # Sales history from deeds (one per deed with a date); price only from a non-confidential sale on that deed.
    sales_by_deed = {}
    for sale in rec.get("sales") or []:
        if sale.get("deedID") is not None:
            sales_by_deed[sale["deedID"]] = sale
    sh_links, deed_links = [], []
    latest = None
    deeds = sorted([d for d in rec.get("deeds") or [] if date10(d.get("deedDt"))], key=lambda d: (date10(d["deedDt"]), d.get("deedID") or 0))
    for i, d in enumerate(deeds, start=1):
        shn = f"sales_history_{i}.json"
        sh = {**base, "ownership_transfer_date": date10(d["deedDt"])}
        sale = sales_by_deed.get(d.get("deedID"))
        price = num(sale.get("salePrice")) if sale else None
        if sale and not sale.get("confidentialSale") and price and price > 0:
            sh["purchase_price_amount"] = price
        files[shn] = sh
        files[f"relationship_property_has_sales_history_{i}.json"] = {"from": link("property.json"), "to": link(shn)}
        sh_links.append(link(f"relationship_property_has_sales_history_{i}.json"))
        dt = DEED_TYPES.get(s(d.get("deedType")).upper())
        dn = f"deed_{i}.json"
        dd = {**base}
        if dt:
            dd["deed_type"] = dt
        for src, dst in (("book", "book"), ("page", "page"), ("volume", "volume"), ("instrumentNum", "instrument_number")):
            if s(d.get(src)):
                dd[dst] = s(d.get(src))
        files[dn] = dd
        files[f"relationship_sales_history_{i}_has_deed.json"] = {"from": link(shn), "to": link(dn)}
        deed_links.append(link(f"relationship_sales_history_{i}_has_deed.json"))
        latest = shn
    if sh_links:
        rel["property_has_sales_history"] = sh_links
        rel["sales_history_has_deed"] = deed_links

    # Current owners -> person/company linked to the most recent conveyance (lexicon has no non-deprecated owner edge).
    if latest:
        p_links, c_links = [], []
        pi = ci = 0
        for o in rec.get("owners") or []:
            kind, val_ = parse_owner(o.get("name"), warnings)
            if kind == "company":
                ci += 1
                cn = f"company_{ci}.json"
                files[cn] = {**base, "name": val_, "sunbiz_document_number": None}
                files[f"relationship_{latest[:-5]}_has_company_{ci}.json"] = {"from": link(latest), "to": link(cn)}
                c_links.append(link(f"relationship_{latest[:-5]}_has_company_{ci}.json"))
            elif kind == "persons":
                for p in val_:
                    pi += 1
                    pn = f"person_{pi}.json"
                    files[pn] = {**base, "birth_date": None, "first_name": p["first_name"], "last_name": p["last_name"],
                                 "middle_name": p["middle_name"], "prefix_name": None, "suffix_name": p["suffix_name"],
                                 "us_citizenship_status": None, "veteran_status": None}
                    files[f"relationship_{latest[:-5]}_has_person_{pi}.json"] = {"from": link(latest), "to": link(pn)}
                    p_links.append(link(f"relationship_{latest[:-5]}_has_person_{pi}.json"))
        if p_links:
            rel["sales_history_has_person"] = p_links
        if c_links:
            rel["sales_history_has_company"] = c_links

    files[f"{manifest['County']['ipfsCid']}.json"] = {"label": "County", "relationships": rel}
    files["address_has_parcel.json"] = {"from": link("address.json"), "to": link("parcel.json")}
    files[f"{manifest['Seed']['ipfsCid']}.json"] = {"label": "Seed", "relationships": {"address_has_parcel": link("address_has_parcel.json")}}
    meta = {"state_code": state_cd, "usage": usage, "property_type": ptype, "geoID": s(ident.get("geoID")),
            "situs": unnorm, "has_tax": "property_has_tax" in rel, "sales": len(sh_links),
            "priced_sales": sum(1 for k, v in files.items() if k.startswith("sales_history_") and "purchase_price_amount" in v)}
    return files, warnings, meta


STRUCTURE_REQUIRED = [
    "architectural_style_type", "attachment_type", "exterior_wall_material_primary", "exterior_wall_material_secondary",
    "exterior_wall_condition", "exterior_wall_insulation_type", "flooring_material_primary", "flooring_material_secondary",
    "subfloor_material", "flooring_condition", "interior_wall_structure_material", "interior_wall_surface_material_primary",
    "interior_wall_surface_material_secondary", "interior_wall_finish_primary", "interior_wall_finish_secondary",
    "interior_wall_condition", "roof_covering_material", "roof_underlayment_type", "roof_structure_material",
    "roof_design_type", "roof_condition", "roof_age_years", "gutters_material", "gutters_condition", "roof_material_type",
    "foundation_type", "foundation_material", "foundation_waterproofing", "foundation_condition",
    "ceiling_structure_material", "ceiling_surface_material", "ceiling_insulation_type", "ceiling_height_average",
    "ceiling_condition", "exterior_door_material", "interior_door_material", "window_frame_material",
    "window_glazing_type", "window_operation_type", "window_screen_material", "primary_framing_material",
    "secondary_framing_material", "structural_damage_indicators",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("extract")
    ap.add_argument("out")
    ap.add_argument("--pids")
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()
    want = set(open(a.pids).read().split()) if a.pids else None
    with urllib.request.urlopen(MANIFEST_URL, timeout=60) as r:
        if "json" not in (r.headers.get("content-type") or ""):
            sys.exit("lexicon manifest unavailable")
        manifest = json.load(r)
    for k in ("County", "Seed"):
        if not manifest.get(k, {}).get("ipfsCid"):
            sys.exit(f"manifest lacks {k}")
    os.makedirs(os.path.join(a.out, "group"), exist_ok=True)
    stats = Counter()
    seen = set()
    with gzip.open(a.extract, "rt") as fin, open(os.path.join(a.out, "results.jsonl"), "w") as res:
        for line in fin:
            rec = json.loads(line)
            pid = s(rec.get("pID"))
            if want is not None and pid not in want:
                continue
            stats["read"] += 1
            digest = hashlib.sha256(line.encode()).hexdigest()
            row = {"pID": pid, "sourceSha256": digest, "transformVersion": TRANSFORM_VERSION}
            try:
                if pid in seen:
                    raise ValueError("duplicate pID row in export")
                seen.add(pid)
                if rec.get("pRollCorr"):
                    raise ValueError("roll-correction row (not certified)")
                files, warnings, meta = transform(rec, manifest)
                if files is None:
                    row.update({"status": meta, "warnings": warnings})
                    stats[meta] += 1
                else:
                    buf = io.BytesIO()
                    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
                        for name in sorted(files):
                            z.writestr(f"data/{name}", json.dumps(files[name], indent=2) + "\n")
                    path = os.path.join(a.out, "group", f"{pid}.zip")
                    with open(path, "wb") as f:
                        f.write(buf.getvalue())
                    row.update({"status": "transformed", "warnings": sorted(set(warnings)), "zipSha256": hashlib.sha256(buf.getvalue()).hexdigest(), **meta})
                    stats["transformed"] += 1
                    stats["usage_" + meta["usage"]] += 1
                    if warnings:
                        stats["with_warnings"] += 1
            except Exception as e:  # noqa: BLE001 - recorded per parcel, never aborts the run
                row.update({"status": "error", "error": str(e)})
                stats["error"] += 1
            res.write(json.dumps(row) + "\n")
            if a.limit and stats["read"] >= a.limit:
                break
    json.dump({"transformVersion": TRANSFORM_VERSION, "countyCid": manifest["County"]["ipfsCid"], "seedCid": manifest["Seed"]["ipfsCid"], **stats},
              open(os.path.join(a.out, "summary.json"), "w"), indent=1)
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
