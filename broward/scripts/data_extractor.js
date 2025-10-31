const fs = require("fs");
const path = require("path");
const { mapUseCodeToPropertyFields } = require("./useCodeMapping");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(s) {
  if (s === null || s === undefined) return null;
  if (typeof s === "number") return Math.round(s * 100) / 100;
  if (typeof s !== "string") return null;
  const cleaned = s.replace(/[^0-9.-]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  return null;
}

function parseCoordinate(value) {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (!isFinite(num)) return null;
  return num;
}

function errorOut(message, pathStr) {
  const err = { type: "error", message, path: pathStr };
  console.error(JSON.stringify(err));
  process.exit(1);
}

function mapUnitsType(unitsStr) {
  if (unitsStr == null || unitsStr === "") return null;
  const n = parseInt(String(unitsStr).trim(), 10);
  if (!isFinite(n)) return null;
  switch (n) {
    case 1:
      return "One";
    case 2:
      return "Two";
    case 3:
      return "Three";
    case 4:
      return "Four";
    default:
      return null;
  }
}


function mapDeedType(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim().toLowerCase();

  const deedMap = {
    "quit claim deed": "Quitclaim Deed",
    "quitclaim deed": "Quitclaim Deed",
    "warranty deed": "Warranty Deed",
    "special warranty deed": "Special Warranty Deed",
    "grant deed": "Grant Deed",
    "bargain and sale deed": "Bargain and Sale Deed",
    "lady bird deed": "Lady Bird Deed",
    "transfer on death deed": "Transfer on Death Deed",
    "sheriff's deed": "Sheriff's Deed",
    "sheriff deed": "Sheriff's Deed",
    "tax deed": "Tax Deed",
    "trustee's deed": "Trustee's Deed",
    "trustee deed": "Trustee's Deed",
    "personal representative deed": "Personal Representative Deed",
    "correction deed": "Correction Deed",
    "deed in lieu of foreclosure": "Deed in Lieu of Foreclosure",
    "life estate deed": "Life Estate Deed",
    "joint tenancy deed": "Joint Tenancy Deed",
    "tenancy in common deed": "Tenancy in Common Deed",
    "community property deed": "Community Property Deed",
    "gift deed": "Gift Deed",
    "interspousal transfer deed": "Interspousal Transfer Deed",
    "wild deed": "Wild Deed",
    "court order deed": "Court Order Deed",
    "contract for deed": "Contract for Deed",
    "special master’s deed": "Special Master’s Deed",
    "special master deed": "Special Master’s Deed",
    "quiet title deed": "Quiet Title Deed"
  };

  return deedMap[t] || null;
}



function extractLotBlockSection(legal) {
  if (!legal || typeof legal !== "string") return { lot: null, block: null, section: null, township: null };
  const lotMatch = legal.match(/LOT\s+(\w+)/i);
  const blockMatch = legal.match(/BLK\s+(\w+)/i);
  const sectionMatch = legal.match(/SEC(?:TION)?\s+(\w+)/i);
  const townshipMatch = legal.match(/TOWNSHIP\s+(\w+)/i) || legal.match(/TWP\s+(\w+)/i);
  return {
    lot: lotMatch ? lotMatch[1] : null,
    block: blockMatch ? blockMatch[1] : null,
    section: sectionMatch ? sectionMatch[1] : null,
    township: townshipMatch ? townshipMatch[1] : null
  };
}

function parseAddressParts(situsAddress1) {
  if (!situsAddress1 || typeof situsAddress1 !== "string")
    return { number: null, name: null, suffix: null, preDir: null, postDir: null };

  // Normalize whitespace
  let raw = situsAddress1.trim().replace(/\s+/g, " ");

  // Remove trailing unit identifiers (e.g., E# A27, #123, APT 4B)
  raw = raw.replace(/\s*(?:#|APT|UNIT|BLDG|FL|STE|SUITE|RM|ROOM|E#)\s*\S+$/i, "").trim();

  if (!raw) return { number: null, name: null, suffix: null, preDir: null, postDir: null };

  const parts = raw.split(" ");
  let number = null;
  if (parts.length > 0 && /^\d+[A-Za-z]?$/.test(parts[0])) {
    number = parts.shift();
  }

  const suffixMap = {
    DR: "Dr", "DR.": "Dr", DRIVE: "Dr",
    RD: "Rd", "RD.": "Rd", ROAD: "Rd",
    ST: "St", "ST.": "St", STREET: "St",
    AVE: "Ave", "AVE.": "Ave", AVENUE: "Ave",
    BLVD: "Blvd", "BLVD.": "Blvd", BOULEVARD: "Blvd",
    LN: "Ln", LANE: "Ln", CT: "Ct", COURT: "Ct",
    PKWY: "Pkwy", PARKWAY: "Pkwy", WAY: "Way",
    HWY: "Hwy", HIGHWAY: "Hwy", TER: "Ter", TERRACE: "Ter",
    PL: "Pl", PLACE: "Pl", CIR: "Cir", CIRCLE: "Cir"
  };

  let suffix = null;
  if (parts.length) {
    const last = parts[parts.length - 1];
    const up = last.toUpperCase();
    if (suffixMap[up]) {
      suffix = suffixMap[up];
      parts.pop();
    }
  }

  const dirSet = new Set(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
  let preDir = null;
  if (parts.length && dirSet.has(parts[0].toUpperCase())) {
    preDir = parts.shift().toUpperCase();
  }

  let postDir = null;
  if (parts.length && dirSet.has(parts[parts.length - 1].toUpperCase())) {
    postDir = parts.pop().toUpperCase();
  }

  const filtered = parts.filter((tok) => !dirSet.has(tok.toUpperCase()));
  const name = filtered.length ? filtered.join(" ") : null;

  return { number, name, suffix, preDir, postDir };
}

(function main() {
  const dataDir = path.join(process.cwd(), "data");
  ensureDir(dataDir);

  const inputPath = path.join(process.cwd(), "input.json");
  const addrPath = path.join(process.cwd(), "unnormalized_address.json");
  const seedPath = path.join(process.cwd(), "property_seed.json");
  const ownerPath = path.join(process.cwd(), "owners", "owner_data.json");
  const utilitiesPath = path.join(
    process.cwd(),
    "owners",
    "utilities_data.json",
  );
  const layoutPath = path.join(process.cwd(), "owners", "layout_data.json");

  const input = readJson(inputPath);
  const unAddr = readJson(addrPath);
  const seed = readJson(seedPath);
  const ownerData = readJson(ownerPath);
  const utilitiesData = readJson(utilitiesPath);
  const layoutData = readJson(layoutPath);

  const d = input && input.d;
  const parcelInfo =
    d && Array.isArray(d.parcelInfok__BackingField)
      ? d.parcelInfok__BackingField[0]
      : null;
  if (!parcelInfo) {
    console.error("No parcel info found in input.json");
    process.exit(0);
  }

  const parcelId = parcelInfo.folioNumber || null;

  // PROPERTY
  const property = {};

  // For area_under_air: use bldgUnderAirFootage only (can be null/empty)
  const underAir =
    parcelInfo.bldgUnderAirFootage != null && String(parcelInfo.bldgUnderAirFootage).trim() !== ""
      ? String(parcelInfo.bldgUnderAirFootage).trim()
      : null;

  // For livable_floor_area: prefer bldgUnderAirFootage, fall back to bldgSqFT
  let livable = underAir;
  if (!livable && parcelInfo.bldgSqFT != null) {
    const sqft = String(parcelInfo.bldgSqFT).trim();
    if (sqft && sqft !== "") {
      livable = sqft;
    }
  }

  // Ensure livable_floor_area is null if value is 0 or non-positive (schema doesn't allow non-positive)
  if (livable != null) {
    const numVal = parseFloat(livable);
    if (!isNaN(numVal) && numVal <= 0) {
      livable = null;
    }
  }

  property.livable_floor_area = livable;
  property.parcel_identifier =
    parcelId ||
    errorOut("Missing parcel identifier.", "property.parcel_identifier");
  property.property_legal_description_text =
    (parcelInfo.legal || "").trim() || null;
  if (!property.property_legal_description_text)
    errorOut(
      "Missing legal description.",
      "property.property_legal_description_text",
    );

  const builtYear = parcelInfo.actualAge
    ? parseInt(parcelInfo.actualAge, 10)
    : null;
  property.property_structure_built_year = isFinite(builtYear)
    ? builtYear
    : null;

  // Use the new comprehensive mapping function
  const useCodeStr = parcelInfo.useCode || "";
  const propertyFields = mapUseCodeToPropertyFields(useCodeStr, useCodeStr);

  property.property_type = propertyFields.property_type;
  property.property_usage_type = propertyFields.property_usage_type;
  property.ownership_estate_type = propertyFields.ownership_estate_type;
  property.structure_form = propertyFields.structure_form;

  // Determine build_status based on property type and building value
  let build_status = null;
  const bldgVal = parseCurrencyToNumber(parcelInfo.bldgValue);
  if (propertyFields.property_type === "VacantLand" || (bldgVal != null && bldgVal === 0)) {
    build_status = "VacantLand";
  } else if (bldgVal != null && bldgVal > 0) {
    build_status = "Improved";
  }
  property.build_status = build_status;

  const unitsType = mapUnitsType(parcelInfo.units);
  property.number_of_units_type = unitsType;

  const unitsN = parcelInfo.units ? parseInt(parcelInfo.units, 10) : null;
  property.number_of_units = isFinite(unitsN) ? unitsN : null;
  property.area_under_air = underAir;

  const totRaw = parcelInfo.bldgTotSqFootage;
  let totalArea = null;
  if (totRaw != null) {
    const t = String(totRaw).trim();
    if (t && /\d{2,}/.test(t)) totalArea = t;
  }
  property.total_area = totalArea;

  const effYear = parcelInfo.effectiveAge
    ? parseInt(parcelInfo.effectiveAge, 10)
    : null;
  property.property_effective_built_year = isFinite(effYear) ? effYear : null;
  property.zoning = parcelInfo.landCalcZoning || null;

  // Add subdivision from neighborhood if available
  property.subdivision = parcelInfo.neighborhood && String(parcelInfo.neighborhood).trim() !== ""
    ? String(parcelInfo.neighborhood).trim()
    : null;

  // Add historic_designation if available
  property.historic_designation = parcelInfo.historicDistrict && String(parcelInfo.historicDistrict).trim() !== ""
    ? true
    : false;

  writeJson(path.join(dataDir, "property.json"), property);

  // ADDRESS
  const situsAddr1 =
    parcelInfo.situsAddress1 || (unAddr && unAddr.full_address) || null;
  const addrParts = parseAddressParts(situsAddr1);
  const zipStr =
    parcelInfo.situsZipCode ||
    ((unAddr &&
      unAddr.full_address &&
      String(unAddr.full_address).match(/\b\d{5}(?:-\d{4})?\b/)) ||
      [])[0] ||
    null;
  let postal = null,
    plus4 = null;
  if (zipStr) {
    const m = String(zipStr).match(/^(\d{5})(?:-(\d{4}))?$/);
    if (m) {
      postal = m[1];
      plus4 = m[2] || null;
    }
  }
  const { lot, block, section, township } = extractLotBlockSection(parcelInfo.legal);

  // Extract latitude and longitude from unnormalized_address.json if available
  const latitude = parseCoordinate(unAddr && unAddr.latitude);
  const longitude = parseCoordinate(unAddr && unAddr.longitude);

  const address = {
    street_number: addrParts.number,
    street_name: addrParts.name || null,
    street_suffix_type: addrParts.suffix || null,
    street_pre_directional_text: addrParts.preDir || null,
    street_post_directional_text: addrParts.postDir || null,
    city_name: parcelInfo.situsCity
      ? String(parcelInfo.situsCity).toUpperCase()
      : null,
    state_code: "FL",
    postal_code: postal,
    plus_four_postal_code: plus4,
    country_code: "US",
    county_name: "Broward",
    unit_identifier: null,
    municipality_name: null,
    latitude: latitude,
    longitude: longitude,
    route_number: null,
    township: township,
    range: null,
    section: section,
    block: block,
    lot: lot,
  };
  writeJson(path.join(dataDir, "address.json"), address);

  // LOT
  let lotSqft = null;
  if (parcelInfo.landCalcFact1) {
    const m = String(parcelInfo.landCalcFact1)
      .replace(/,/g, "")
      .match(/(\d{1,9})/);
    if (m) lotSqft = parseInt(m[1], 10);
  }
  // Ensure lot_area_sqft is null if value is 0 or non-positive
  if (isFinite(lotSqft) && lotSqft <= 0) {
    lotSqft = null;
  }
  const lotObj = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: isFinite(lotSqft) ? lotSqft : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: null,
  };
  writeJson(path.join(dataDir, "lot.json"), lotObj);

  // TAX
  const millage =
    Array.isArray(d.millageRatek__BackingField) &&
    d.millageRatek__BackingField[0]
      ? d.millageRatek__BackingField[0]
      : null;
  const tax = {
    tax_year:
      millage && millage.millageYear ? parseInt(millage.millageYear, 10) : null,
    property_assessed_value_amount: parseCurrencyToNumber(parcelInfo.sohValue),
    property_market_value_amount: parseCurrencyToNumber(parcelInfo.justValue),
    property_building_amount: parseCurrencyToNumber(parcelInfo.bldgValue),
    property_land_amount: parseCurrencyToNumber(parcelInfo.landValue),
    property_taxable_value_amount: parseCurrencyToNumber(
      parcelInfo.taxableAmountCounty,
    ),
    monthly_tax_amount: null,
    period_start_date: null,
    period_end_date: null,
    yearly_tax_amount: null,
    first_year_on_tax_roll: null,
    first_year_building_on_tax_roll: null,
  };
  writeJson(path.join(dataDir, "tax_1.json"), tax);

  // SALES
  function get(fieldBase, idx) {
    return parcelInfo[`${fieldBase}${idx}`];
  }
  let salesIndex = 0;
  const salesCreated = [];
  for (let i = 1; i <= 5; i++) {
    const dateStr = get("saleDate", i);
    const priceStr = get("stampAmount", i);
    if (!dateStr || !priceStr) continue;
    const iso = parseDateToISO(String(dateStr));
    const price = parseCurrencyToNumber(priceStr);
    if (!iso || price == null) continue;
    salesIndex++;
    const sales = {
      ownership_transfer_date: iso,
      purchase_price_amount: price,
    };
    const salesPath = path.join(dataDir, `sales_${salesIndex}.json`);
    writeJson(salesPath, sales);
    salesCreated.push(salesIndex);
  }

  // DEEDS
  let deedIndex = 0;
  const deedsCreated = [];
  for (let i = 1; i <= 5; i++) {
    const deedTypeRaw = get("deedType", i);
    if (!deedTypeRaw) continue;
    const deedType = mapDeedType(deedTypeRaw);
    deedIndex++;
    const deed = { deed_type: deedType };
    writeJson(path.join(dataDir, `deed_${deedIndex}.json`), deed);
    deedsCreated.push(deedIndex);
  }

  // OWNERS create entries from owners/owner_data.json
  const ownerKey = `property_${parcelId}`;
  const ownersSection = ownerData[ownerKey] || {};
  const currentOwners =
    (ownersSection.owners_by_date && ownersSection.owners_by_date.current) ||
    [];

  const companyFiles = [];
  const personFiles = [];

  const companies = currentOwners.filter((o) => o.type === "company");
  companies.forEach((c, idx) => {
    const company = { name: c.name || null };
    const f = `company_${idx + 1}.json`;
    writeJson(path.join(dataDir, f), company);
    companyFiles.push(f);
  });

  const persons = currentOwners.filter((o) => o.type === "person");
  persons.forEach((p, idx) => {
    const person = {
      birth_date: null,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      middle_name: p.middle_name || null,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const f = `person_${idx + 1}.json`;
    writeJson(path.join(dataDir, f), person);
    personFiles.push(f);
  });

  // CLEANUP: Remove any existing sales-to-owner relationships (unsupported without explicit buyer data)
  const allDataFiles = fs.readdirSync(dataDir);
  allDataFiles.forEach((f) => {
    if (/^relationship_sales_(person|company).*\.json$/.test(f)) {
      fs.unlinkSync(path.join(dataDir, f));
    }
  });

  // RELATIONSHIPS: sales-to-deed (pair by index)
  deedsCreated.forEach((di) => {
    const salesPath = path.join(dataDir, `sales_${di}.json`);
    const deedPath = path.join(dataDir, `deed_${di}.json`);
    if (fs.existsSync(salesPath) && fs.existsSync(deedPath)) {
      const relSD = {
        to: { "/": `./sales_${di}.json` },
        from: { "/": `./deed_${di}.json` },
      };
      const relName = `relationship_sales_deed_${di}.json`;
      writeJson(path.join(dataDir, relName), relSD);
    }
  });

  // FILES: create file_*.json for property images
  const urls = new Set();
  if (parcelInfo.picturePath) urls.add(parcelInfo.picturePath);
  if (Array.isArray(d.picturesListk__BackingField)) {
    d.picturesListk__BackingField.forEach((u) => {
      if (u) urls.add(u);
    });
  }
  const urlList = Array.from(urls);
  const fileNames = [];
  let fileIdx = 1;
  urlList.forEach((u) => {
    const url = String(u);

    // Skip relative URLs (only process full http/https URLs)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.log(`Skipping relative URL: "${url}"`);
      return;
    }

    const name = url.split("/").pop() || `image_${fileIdx}.jpg`;
    const ext = (name.split(".").pop() || "").toLowerCase();
    let file_format = null;
    if (ext === "jpg" || ext === "jpeg") file_format = "jpeg";
    else if (ext === "png") file_format = "png";
    else if (ext === "txt") file_format = "txt";
    else file_format = "jpeg";

    const fileObj = {
      document_type: "PropertyImage",
      file_format,
      name,
      original_url: encodeURI(url),
      ipfs_url: null,
    };
    const f = `file_${fileIdx}.json`;
    writeJson(path.join(dataDir, f), fileObj);
    fileNames.push(f);
    fileIdx++;
  });

  // RELATIONSHIPS: deed -> file (associate all files to first deed if exists)
  if (deedsCreated.length > 0 && fileNames.length > 0) {
    const deedTarget = `./deed_${deedsCreated[0]}.json`;
    fileNames.forEach((fn, idx) => {
      const rel = {
        to: { "/": deedTarget },
        from: { "/": `./${fn}` },
      };
      const relName =
        fileNames.length > 1
          ? `relationship_deed_file_${idx + 1}.json`
          : "relationship_deed_file.json";
      writeJson(path.join(dataDir, relName), rel);
    });
  }

  // UTILITIES
  const utilSection = utilitiesData[ownerKey] || null;
  if (utilSection) {
    const utility = { ...utilSection };
    writeJson(path.join(dataDir, "utility.json"), utility);
  }

  // LAYOUTS
  const layoutSection = layoutData[ownerKey] || null;
  if (layoutSection && Array.isArray(layoutSection.layouts)) {
    layoutSection.layouts.forEach((lay, idx) => {
      const layout = { ...lay };
      if (layout.space_index == null) layout.space_index = idx + 1;
      writeJson(path.join(dataDir, `layout_${idx + 1}.json`), layout);
    });
  }

  // STRUCTURE minimal file with nulls for all fields
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  writeJson(path.join(dataDir, "structure.json"), structure);
})();
