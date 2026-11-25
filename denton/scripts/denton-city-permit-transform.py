#!/usr/bin/env python3
"""City of Denton permits -> Property Improvement data group (job-local custom code).

Source of record: City of Denton open data (CKAN on OpenGov), dataset building-safety-yearly-permits,
one CSV per year; each record's source_http_request is a GET of that year's stable CKAN resource
download URL (the signed S3 redirect target is not recorded). request_identifier = PERMIT_NO.

Linking: SITE_APN is the DCAD property id (pID). A permit is attached only when SITE_APN exactly matches a
pID transformed in the county run (folio identity; no normalization). Others stay unmatched (internal only).

Contractors: the dataset prints CONTRACTOR_NAME but no license number. Under the official-identity rule a
permit-printed name alone is not a lookup key, so no company, person, or license is written. The raw name is
kept only in the internal reconciliation rows.

Usage: denton-city-permit-transform.py <permits-dir> <county-run-dir> <out-dir>
"""
import csv
import glob
import hashlib
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict

TRANSFORM_VERSION = "denton-city-permits-ckan-v0.1.0"
CKAN_PACKAGE = "https://data.cityofdenton.com/api/3/action/package_show?id=building-safety-yearly-permits"
MANIFEST_URL = "https://lexicon.elephant.xyz/api/manifest"

STATUS = {"FINALED": "Completed", "CLOSED": "Completed", "ISSUED": "Permitted", "ACTIVE": "Permitted",
          "APPROVED": "Permitted", "CANCELLED": "Cancelled", "REVOKED": "Cancelled", "DENIED": "Cancelled",
          "SUBMITTED": "Planned", "PENDING": "Planned", "PENDING REGISTRATION": "Planned",
          "PEND SUB ACCEPTANCE": "Planned", "PENDING REVISIONS": "Planned", "PENDING PAYMENT": "Planned",
          "PENDING INTAKE": "Planned"}


def improvement_type(cat, sub):
    c, s = cat.upper(), sub.upper()
    if "DEMOLITION" in c: return "Demolition"
    if "ROOF" in c or s == "ROOF": return "Roofing"
    if "SOLAR" in c or s == "SOLAR": return "Solar"
    if "SWIMMINGPOOL" in c: return "PoolSpaInstallation"
    if c in ("FENCE",): return "Fencing"
    if "IRRIGATION" in c or s in ("IRRIGATION", "LANDSCAPE"): return "LandscapeIrrigation"
    if "HVAC" in c or "MECHANICAL" in c or "FURNACE" in c or "AC CONDENSER" in c: return "MechanicalHVAC"
    if "GAS" in c: return "GasInstallation"
    if "ELECT" in c or c == "GENERATOR": return "Electrical"
    if "PLUMB" in c or "WATER HEATER" in c or "SEWER LINE" in c or "WATER LINE" in c: return "Plumbing"
    if c == "RIGHT OF WAY" or c == "SIDEWALK": return "RightOfWayPermit"
    if c == "CURB_CUT": return "DrivewayPermit"
    if c == "UTILITIES PERMIT" or c == "UTILITY TRANSFER": return "UtilitiesConnection"
    if c in ("CLEARGRADE", "CLEARGRUBBING", "GRUBBING", "PARKING LOT"): return "SiteDevelopment"
    if c == "TREE REMOVAL": return "VegetationRemoval"
    if c == "WATER WELL": return "WellPermit"
    if c in ("MANUFACTURED HOME MOVE IN",): return "MobileHomeRV"
    if c in ("MOVING",): return "StructureMove"
    if "ADDITION" in s: return "BuildingAddition"
    if "WINDOW" in s or "DOOR" in s or "EXTERIOR REMODEL" in s: return "ExteriorOpeningsAndFinishes"
    if c == "RESIDENTIAL" or c == "RESIDENTIALALTERATIO" or (c == "BUILDING" and s in ("RESIDENTIAL", "ACCESSORY DWELLING UNIT")):
        return "ResidentialConstruction"
    if c in ("COMMERCIAL", "COMMERCIALALTERATION") or (c == "BUILDING" and s in ("COMMERCIAL", "APARTMENT", "MULTI FAMILY")):
        return "CommercialConstruction"
    if c == "BUILDING": return "GeneralBuilding"
    return None


def action(cat, sub):
    c, s = cat.upper(), sub.upper()
    if "DEMOLITION" in c: return "Remove"
    if "ADDITION" in s: return "Addition"
    if "REPAIR" in s: return "Repair"
    if "REPLACEMENT" in s or "WATER HEATER" in c or "HVAC" in c: return "Replacement"
    if "ALTERATIO" in c or "REMODEL" in s or "FINISH OUT" in s: return "Alteration"
    if c in ("RESIDENTIAL", "BUILDING", "COMMERCIAL") and s in ("", "RESIDENTIAL", "COMMERCIAL", "TOWNHOUSE", "DUPLEX", "APARTMENT", "MULTI FAMILY"):
        return "New"
    return None


def money(v):
    try:
        x = float(str(v).replace(",", "").strip())
        return x if x >= 0 else None
    except ValueError:
        return None


def main():
    permits_dir, county_run, out = sys.argv[1:4]
    with urllib.request.urlopen(CKAN_PACKAGE, timeout=60) as r:
        pkg = json.load(r)["result"]
    url_by_file = {os.path.basename(res["url"]).lower(): res["url"] for res in pkg["resources"]}
    with urllib.request.urlopen(MANIFEST_URL, timeout=60) as r:
        manifest = json.load(r)
    pi_cid, seed_cid, county_cid = manifest["Property_Improvement"]["ipfsCid"], manifest["Seed"]["ipfsCid"], manifest["County"]["ipfsCid"]
    by_pid = defaultdict(list)
    stats = Counter()
    unmatched = []
    county_group = os.path.join(county_run, "group")
    rows_out = open(os.path.join(out, "permits-internal.jsonl"), "w") if os.makedirs(out, exist_ok=True) is None else None
    for f in sorted(glob.glob(os.path.join(permits_dir, "*.csv"))):
        src_url = url_by_file.get(os.path.basename(f).lower())
        if not src_url:
            sys.exit(f"no CKAN resource URL for {f}")
        raw = open(f, "rb").read()
        file_sha = hashlib.sha256(raw).hexdigest()
        for r in csv.DictReader(io.StringIO(raw.decode("utf-8-sig", errors="replace"))):
            stats["read"] += 1
            pno = r["PERMIT_NO"].strip()
            apn = r["SITE_APN"].strip()
            linked = bool(re.fullmatch(r"\d+", apn)) and os.path.exists(os.path.join(county_group, f"{apn}.zip"))
            rows_out.write(json.dumps({"permit_no": pno, "site_apn": apn, "linked_pid": apn if linked else None,
                                       "match_method": "exact_site_apn_pid" if linked else None,
                                       "contractor_name_raw": r["CONTRACTOR_NAME"].strip() or None,
                                       "source_url": src_url, "source_file_sha256": file_sha, "row": r}) + "\n")
            if not linked:
                stats["unmatched"] += 1
                continue
            by_pid[apn].append((r, src_url))
    rows_out.close()
    os.makedirs(os.path.join(out, "group"), exist_ok=True)
    for pid, items in by_pid.items():
        with zipfile.ZipFile(os.path.join(county_group, f"{pid}.zip")) as cz:
            seed_files = {n[5:]: cz.read(n) for n in cz.namelist()
                          if n[5:] in ("property.json", "address.json", "parcel.json", "address_has_parcel.json", f"{seed_cid}.json")}
        files = dict(seed_files)
        links = []
        for i, (r, src_url) in enumerate(sorted(items, key=lambda x: (x[0]["ISSUED_DATE"], x[0]["PERMIT_NO"])), start=1):
            cat, sub = r["PERMIT_CATEGORY"].strip(), r["PERMIT_SUBTYPE"].strip()
            it = improvement_type(cat, sub)
            if it is None:
                stats["type_unmapped"] += 1
            st = STATUS.get(r["STATUS"].strip().upper())
            rec = {"source_http_request": {"method": "GET", "url": src_url}, "request_identifier": r["PERMIT_NO"].strip(),
                   "permit_number": r["PERMIT_NO"].strip(), "improvement_type": it, "improvement_status": st,
                   "improvement_action": action(cat, sub), "completion_date": None, "contractor_type": None,
                   "permit_issue_date": r["ISSUED_DATE"].strip()[:10] or None}
            fee = money(r["FEES_CHARGED"])
            if fee is not None:
                rec["fee"] = fee
            files[f"property_improvement_{i}.json"] = json.dumps(rec, indent=2).encode() + b"\n"
            files[f"relationship_property_has_property_improvement_{i}.json"] = json.dumps(
                {"from": {"/": "./property.json"}, "to": {"/": f"./property_improvement_{i}.json"}}, indent=2).encode() + b"\n"
            links.append({"/": f"./relationship_property_has_property_improvement_{i}.json"})
            stats["written"] += 1
        files[f"{pi_cid}.json"] = json.dumps({"label": "Property Improvement", "relationships": {"property_has_property_improvement": links}}, indent=2).encode() + b"\n"
        with zipfile.ZipFile(os.path.join(out, "group", f"{pid}.zip"), "w", zipfile.ZIP_DEFLATED) as z:
            for n in sorted(files):
                z.writestr(f"data/{n}", files[n])
        stats["properties"] += 1
    json.dump({"transformVersion": TRANSFORM_VERSION, "piCid": pi_cid, **stats}, open(os.path.join(out, "summary.json"), "w"), indent=1)
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
