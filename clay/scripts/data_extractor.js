// scripts/data_extractor.js
// Extracts property, address, sales, tax, owners (person/company), utilities, layout,
// structure, lot, deeds, files, and relationships.
// Inputs:
//  - input.html
//  - unnormalized_address.json
//  - property_seed.json
//  - owners/owner_data.json
//  - owners/utilities_data.json
//  - owners/layout_data.json
// Outputs (in ./data):
//  - property.json
//  - address.json
//  - sales_*.json
//  - tax_*.json
//  - person_*.json and/or company_*.json
//  - relationship_sales_person_*.json and relationship_sales_company_*.json
//  - utility.json
//  - layout_*.json
//  - structure.json
//  - lot.json
//  - deed_*.json
//  - file_*.json
//  - relationship_sales_deed_*.json
//  - relationship_deed_file_*.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadHTML(p) {
  const html = fs.readFileSync(p, "utf8");
  return cheerio.load(html);
}

function textTrim($el) {
  return ($el.text() || "").trim();
}

function getValueByLabel($, sectionDivSelector, labelText) {
  const rows = $(`${sectionDivSelector} table tbody tr`);
  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const th = row.find("th strong");
    if (
      th.length &&
      th.text().trim().toLowerCase() === labelText.trim().toLowerCase()
    ) {
      const singleSpan = row.find('td div[id$="_pnlSingleValue"] span').first();
      if (singleSpan && singleSpan.length) {
        return singleSpan.text().trim();
      }
      const val = row.find("td").text().replace(/\s+/g, " ").trim();
      return val || null;
    }
  }
  return null;
}

function getValueByLabelInContainer($, $container, labelText) {
  const rows = $container.find("table tbody tr");
  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const th = row.find("th strong");
    if (
      th.length &&
      th.text().trim().toLowerCase() === labelText.trim().toLowerCase()
    ) {
      const singleSpan = row.find('td div[id$="_pnlSingleValue"] span').first();
      if (singleSpan && singleSpan.length) {
        return singleSpan.text().trim();
      }
      const val = row.find("td").text().replace(/\s+/g, " ").trim();
      return val || null;
    }
  }
  return null;
}

function parseMoneyToNumber(val) {
  if (val == null) return null;
  let s = String(val).trim();
  if (!s) return null;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/\$/g, "").replace(/,/g, "").trim();
  if (s === "") return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

function parseNumber(val) {
  if (val == null) return null;
  const s = String(val).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseSecTwpRng(str) {
  if (!str) return { section: null, township: null, range: null };
  const parts = str.split("/").map((s) => s.trim());
  const [sec, twp, rng] = [
    parts[0] || null,
    parts[1] || null,
    parts[2] || null,
  ];
  const pad2 = (v) =>
    v == null ? null : String(v).length === 1 ? `0${v}` : String(v);
  return {
    section: sec ? pad2(sec) : null,
    township: twp ? pad2(twp) : null,
    range: rng || null,
  };
}

function toISODate(mdY) {
  if (!mdY) return null;
  const m = mdY.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const MM = mm.padStart(2, "0");
  const DD = dd.padStart(2, "0");
  return `${yyyy}-${MM}-${DD}`;
}

function mapPropertyTypeFromUseDesc(desc) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes("single family")) return "SingleFamily";
  if (d.includes("townhouse")) return "Townhouse";
  if (d.includes("condominium")) return "Condominium";
  if (d.includes("cooperative")) return "Cooperative";
  if (d.includes("duplex")) return "Duplex";
  if (d.includes("apartment")) return "Apartment";
  if (d.includes("mobile home")) return "MobileHome";
  throw new Error(
    JSON.stringify({
      type: "error",
      message: `Unknown enum value ${desc}.`,
      path: "property.property_type",
    }),
  );
}

function parseLocationAddressBlock($, sectionSelector) {
  const row = $(`${sectionSelector} tr`)
    .filter((i, el) => {
      return $(el).find("th strong").text().trim() === "Location Address";
    })
    .first();
  if (!row || !row.length) return { line1: null, cityZip: null };
  const span = row.find("td span").first();
  let html = span && span.html() ? span.html() : "";
  html = html.replace(/\r?\n/g, "").trim();
  const parts = html
    .split(/<br\s*\/?>(\s*)?/i)
    .map((s) => s.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { line1: parts[0], cityZip: parts[1] };
  }
  const val = row.find("td").text().replace(/\s+/g, " ").trim();
  return { line1: val || null, cityZip: null };
}

function buildStructure($, buildingsSelector) {
  const left = $(`${buildingsSelector} .two-column-blocks`).eq(0);
  const right = $(`${buildingsSelector} .two-column-blocks`).eq(1);
  const exteriorWalls = getValueByLabelInContainer($, left, "Exterior Walls");
  const roofType = getValueByLabelInContainer($, right, "Roof Type");
  const roofCoverage = getValueByLabelInContainer($, right, "Roof Coverage");
  const flooringType = getValueByLabelInContainer($, right, "Flooring Type");
  const interiorWalls = getValueByLabelInContainer($, left, "Interior Walls");
  const stories = getValueByLabelInContainer($, left, "Stories");

  let exterior_wall_material_primary = null;
  let primary_framing_material = null;
  if (exteriorWalls) {
    const s = exteriorWalls.toLowerCase();
    if (s.includes("stucco")) exterior_wall_material_primary = "Stucco";
    if (s.includes("wood")) primary_framing_material = "Wood Frame";
    if (!primary_framing_material && s.includes("block"))
      primary_framing_material = "Concrete Block";
  }

  let roof_design_type = null;
  if (roofType) {
    const t = roofType.toUpperCase();
    if (t.includes("GABLE") && t.includes("HIP"))
      roof_design_type = "Combination";
    else if (t.includes("GABLE")) roof_design_type = "Gable";
    else if (t.includes("HIP")) roof_design_type = "Hip";
  }

  let roof_material_type = null;
  if (roofCoverage) {
    const rc = roofCoverage.toUpperCase();
    if (rc.includes("SHINGLE")) roof_material_type = "Shingle";
    else if (rc.includes("METAL")) roof_material_type = "Metal";
    else if (rc.includes("TILE")) roof_material_type = "Tile";
  }

  let flooring_material_primary = null;
  if (flooringType) {
    const ft = flooringType.toUpperCase();
    if (ft.includes("CARPET")) flooring_material_primary = "Carpet";
    else if (ft.includes("TILE")) flooring_material_primary = "Ceramic Tile";
    else if (ft.includes("WOOD")) flooring_material_primary = "Solid Hardwood";
  }

  let interior_wall_surface_material_primary = null;
  if (interiorWalls) {
    const iw = interiorWalls.toUpperCase();
    if (iw.includes("DRYWALL"))
      interior_wall_surface_material_primary = "Drywall";
    else if (iw.includes("PLASTER"))
      interior_wall_surface_material_primary = "Plaster";
  }

  let number_of_stories = null;
  if (stories) {
    const m = stories.match(/([0-9]+(?:\.[0-9])?)/);
    if (m) number_of_stories = parseFloat(m[1]);
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exterior_wall_material_primary || null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: flooring_material_primary || null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary || null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: roof_design_type || null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roof_material_type || null,
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
    primary_framing_material: primary_framing_material || null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: number_of_stories,
  };

  return structure;
}

function buildLot($, parcelSummarySelector, landInfoSelector, yardSelector) {
  const acreageStr = getValueByLabel($, parcelSummarySelector, "Acreage");
  const acreage = acreageStr ? parseFloat(acreageStr) : null;
  const lot_area_sqft =
    acreage != null && !isNaN(acreage) ? Math.round(acreage * 43560) : null;
  let lot_type = null;
  if (acreage != null && !isNaN(acreage)) {
    lot_type =
      acreage <= 0.25
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  let driveway_material = null;
  const yardRows = $(`${yardSelector} table tbody tr`);
  yardRows.each((i, tr) => {
    const $tr = $(tr);
    const desc =
      textTrim($tr.find("th")) + " " + textTrim($tr.find("td").eq(0));
    const s = desc.toUpperCase();
    if (s.includes("DRIVEWAY")) {
      if (s.includes("CONCRETE")) driveway_material = "Concrete";
      else if (s.includes("ASPHALT")) driveway_material = "Asphalt";
      else if (s.includes("PAVER")) driveway_material = "Pavers";
      else if (s.includes("GRAVEL")) driveway_material = "Gravel";
    }
  });

  return {
    lot_type: lot_type || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft || null,
    lot_size_acre: acreage != null ? acreage : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: driveway_material || null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const inputHtmlPath = path.join(".", "input.html");
  const addrPath = path.join(".", "unnormalized_address.json");
  const seedPath = path.join(".", "property_seed.json");
  const ownerDataPath = path.join(".", "owners", "owner_data.json");
  const utilitiesDataPath = path.join(".", "owners", "utilities_data.json");
  const layoutDataPath = path.join(".", "owners", "layout_data.json");

  const $ = loadHTML(inputHtmlPath);
  const unAddr = readJSON(addrPath);
  const seed = readJSON(seedPath);
  const ownerData = readJSON(ownerDataPath);
  const utilitiesData = readJSON(utilitiesDataPath);
  const layoutData = readJSON(layoutDataPath);

  const parcelSummarySelector = "#ctlBodyPane_ctl00_mSection .module-content";
  const buildingsSelector = "#ctlBodyPane_ctl05_mSection .module-content";
  const valuationSelector = "#ctlBodyPane_ctl10_mSection .module-content";
  const salesSelector = "#ctlBodyPane_ctl07_mSection .module-content";
  const yardSelector = "#ctlBodyPane_ctl06_mSection .module-content";
  const trimSelector = "#ctlBodyPane_ctl09_mSection .module-content";
  const prcSelector = "#ctlBodyPane_ctl12_mSection .module-content";
  const sketchesSelector = "#ctlBodyPane_ctl14_mSection .module-content";

  const parcelId = getValueByLabel($, parcelSummarySelector, "Parcel ID");

  const secTwpRngRaw = getValueByLabel($, parcelSummarySelector, "Sec/Twp/Rng");
  const { section, township, range } = parseSecTwpRng(secTwpRngRaw);

  let legalDesc = getValueByLabel(
    $,
    parcelSummarySelector,
    "Brief Tax Description*",
  );
  if (legalDesc && legalDesc.includes("(Note:")) {
    legalDesc = legalDesc.split("(Note:")[0].trim();
  }

  const propUse = getValueByLabel(
    $,
    parcelSummarySelector,
    "Property Use Code",
  );
  let propType = null;
  if (propUse) {
    const m = propUse.match(/^([^()]+)\s*(\(([^)]+)\))?/);
    const desc = m ? m[1].trim() : propUse.trim();
    propType = mapPropertyTypeFromUseDesc(desc);
  }

  const left = $(`${buildingsSelector} .two-column-blocks`).eq(0);
  const right = $(`${buildingsSelector} .two-column-blocks`).eq(1);
  const grossSqFt = getValueByLabelInContainer($, left, "Gross Sq Ft");
  const finishedSqFt = getValueByLabelInContainer($, left, "Finished Sq Ft");
  const yearBuiltStr = getValueByLabelInContainer($, left, "Year Built");
  const effYearBuiltStr = getValueByLabelInContainer(
    $,
    right,
    "Effective Year Built",
  );

  const yearBuilt = yearBuiltStr ? parseInt(yearBuiltStr, 10) : null;
  const effYearBuilt = effYearBuiltStr ? parseInt(effYearBuiltStr, 10) : null;

  const property = {
    parcel_identifier: parcelId || seed.parcel_id || "",
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: effYearBuilt || null,
    livable_floor_area: finishedSqFt || null,
    total_area: grossSqFt || null,
    number_of_units: 1,
    number_of_units_type: "One",
    property_type: propType,
    area_under_air: finishedSqFt || null,
    subdivision: null,
    zoning: null,
  };
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  const loc = parseLocationAddressBlock($, parcelSummarySelector);
  const fullAddr =
    unAddr && unAddr.full_address
      ? unAddr.full_address
      : loc.line1
        ? `${loc.line1}, ${loc.cityZip || ""}`
        : null;
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null;
  if (fullAddr) {
    const m = fullAddr.match(
      /^(\d+)\s+([^,]+?)\s+([A-Za-z.]+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/,
    );
    if (m) {
      street_number = m[1];
      street_name = m[2].trim().toUpperCase();
      street_suffix_type = m[3].replace(/\./g, "");
      city_name = m[4].trim().toUpperCase();
      state_code = m[5];
      postal_code = m[6];
      plus4 = m[7] || null;
    } else if (loc.line1 && loc.cityZip) {
      const m1 = loc.line1.match(/^(\d+)\s+(.+?)\s+([A-Za-z.]+)$/);
      if (m1) {
        street_number = m1[1];
        street_name = m1[2].trim().toUpperCase();
        street_suffix_type = m1[3].replace(/\./g, "");
      }
      const m2 = loc.cityZip.match(/^(.+?)\s+(\d{5})(?:-(\d{4}))?$/);
      if (m2) {
        city_name = m2[1].trim().toUpperCase();
        state_code =
          unAddr &&
          unAddr.full_address &&
          unAddr.full_address.match(/,\s*([A-Z]{2})\s+\d{5}/)
            ? unAddr.full_address.match(/,\s*([A-Z]{2})\s+\d{5}/)[1]
            : "FL";
        postal_code = m2[2];
        plus4 = m2[3] || null;
      }
    }
  }

  const county_name = "Clay";
  const country_code = "US";

  const addrObj = {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: plus4 || null,
    county_name,
    country_code,
    latitude: null,
    longitude: null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    block: null,
    lot: null,
  };
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addrObj, null, 2),
  );

  const salesRows = $(`${salesSelector} table tbody tr`);
  const sales = [];
  salesRows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("th, td");
    const saleDate = textTrim(tds.eq(0));
    const salePrice = textTrim(tds.eq(1));
    const inst = textTrim(tds.eq(2));
    const bookLink = $(tds.eq(3)).find("a").attr("href") || null;
    const pageLink = $(tds.eq(4)).find("a").attr("href") || null;
    const grantor = textTrim(tds.eq(9));
    const grantee = textTrim(tds.eq(10));
    if (!saleDate) return;
    const iso = toISODate(saleDate);
    const priceNum = parseMoneyToNumber(salePrice);
    if (!iso) return;
    sales.push({
      date: iso,
      price: priceNum == null ? null : priceNum,
      instrument: inst,
      bookLink,
      pageLink,
      grantor,
      grantee,
    });
  });

  const salesIndexMap = new Map();
  sales.forEach((s, idx) => {
    const out = {
      ownership_transfer_date: s.date,
      purchase_price_amount: s.price == null ? null : s.price,
    };
    const fname = `sales_${idx + 1}.json`;
    salesIndexMap.set(s.date, idx + 1);
    fs.writeFileSync(path.join(dataDir, fname), JSON.stringify(out, null, 2));
  });

  const valTable = $(`${valuationSelector} table`);
  const headers = [];
  valTable.find("thead th.value-column").each((i, th) => {
    headers.push(textTrim($(th)));
  });
  const rowsVal = {};
  valTable.find("tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const label = textTrim($tr.find("th").first());
    const cells = [];
    $tr.find("td.value-column").each((j, td) => cells.push(textTrim($(td))));
    if (label) rowsVal[label] = cells;
  });
  for (let ci = 0; ci < headers.length; ci++) {
    const hdr = headers[ci];
    const yearMatch = hdr.match(/(\d{4})/);
    const tax_year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const building = rowsVal["Building Value"]
      ? parseMoneyToNumber(rowsVal["Building Value"][ci])
      : null;
    const land = rowsVal["Land Value"]
      ? parseMoneyToNumber(rowsVal["Land Value"][ci])
      : null;
    const just = rowsVal["Just Market Value"]
      ? parseMoneyToNumber(rowsVal["Just Market Value"][ci])
      : null;
    const assessed = rowsVal["Total Assessed Value"]
      ? parseMoneyToNumber(rowsVal["Total Assessed Value"][ci])
      : null;
    const taxable = rowsVal["Total Taxable Value"]
      ? parseMoneyToNumber(rowsVal["Total Taxable Value"][ci])
      : null;
    const taxObj = {
      tax_year: tax_year,
      property_assessed_value_amount: assessed,
      property_market_value_amount: just,
      property_building_amount: building,
      property_land_amount: land,
      property_taxable_value_amount: taxable,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    };
    const fname = `tax_${ci + 1}.json`;
    fs.writeFileSync(
      path.join(dataDir, fname),
      JSON.stringify(taxObj, null, 2),
    );
  }

  const utilKey = `property_${parcelId || seed.KeyValue || seed.request_identifier || ""}`;
  const utilRecAny = utilitiesData[utilKey] || null;
  if (utilRecAny) {
    const allowedUtilKeys = new Set([
      "cooling_system_type",
      "heating_system_type",
      "public_utility_type",
      "sewer_type",
      "water_source_type",
      "plumbing_system_type",
      "plumbing_system_type_other_description",
      "electrical_panel_capacity",
      "electrical_wiring_type",
      "hvac_condensing_unit_present",
      "electrical_wiring_type_other_description",
      "solar_panel_present",
      "solar_panel_type",
      "solar_panel_type_other_description",
      "smart_home_features",
      "smart_home_features_other_description",
      "hvac_unit_condition",
      "solar_inverter_visible",
      "hvac_unit_issues",
      "electrical_panel_installation_date",
      "electrical_rewire_date",
      "hvac_capacity_kw",
      "hvac_capacity_tons",
      "hvac_equipment_component",
      "hvac_equipment_manufacturer",
      "hvac_equipment_model",
      "hvac_installation_date",
      "hvac_seer_rating",
      "hvac_system_configuration",
      "plumbing_system_installation_date",
      "sewer_connection_date",
      "solar_installation_date",
      "solar_inverter_installation_date",
      "solar_inverter_manufacturer",
      "solar_inverter_model",
      "water_connection_date",
      "water_heater_installation_date",
      "water_heater_manufacturer",
      "water_heater_model",
      "well_installation_date",
    ]);
    const utilOut = {};
    Object.keys(utilRecAny).forEach((k) => {
      if (allowedUtilKeys.has(k)) utilOut[k] = utilRecAny[k];
    });
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilOut, null, 2),
    );
  }

  const layoutKey = utilKey;
  const layoutRec =
    layoutData[layoutKey] && Array.isArray(layoutData[layoutKey].layouts)
      ? layoutData[layoutKey].layouts
      : [];
  layoutRec.forEach((lay, i) => {
    const fname = `layout_${i + 1}.json`;
    fs.writeFileSync(path.join(dataDir, fname), JSON.stringify(lay, null, 2));
  });

  const structureObj = buildStructure($, buildingsSelector);
  fs.writeFileSync(
    path.join(dataDir, "structure.json"),
    JSON.stringify(structureObj, null, 2),
  );

  const lotObj = buildLot(
    $,
    parcelSummarySelector,
    "#ctlBodyPane_ctl04_mSection .module-content",
    yardSelector,
  );
  fs.writeFileSync(
    path.join(dataDir, "lot.json"),
    JSON.stringify(lotObj, null, 2),
  );

  let deedCount = 0;
  let fileCount = 0;
  let relSalesDeedCount = 0;
  let relDeedFileCount = 0;

  function writeFileRecord(
    name,
    original_url,
    document_type = null,
    file_format = null,
  ) {
    fileCount += 1;
    const fileObj = {
      file_format: file_format,
      name: name || null,
      original_url: original_url || null,
      ipfs_url: null,
      document_type: document_type,
    };
    const fname = `file_${fileCount}.json`;
    fs.writeFileSync(
      path.join(dataDir, fname),
      JSON.stringify(fileObj, null, 2),
    );
    return fileCount;
  }

  const trimLink = $(`${trimSelector} a[target="_blank"]`).first();
  if (trimLink && trimLink.length) {
    const name = textTrim(trimLink);
    const href = trimLink.attr("href");
    if (href) writeFileRecord(name, href, null, null);
  }
  const prcLink = $(`${prcSelector} a[target="_blank"]`).first();
  if (prcLink && prcLink.length) {
    const name = textTrim(prcLink);
    const href = prcLink.attr("href");
    if (href) writeFileRecord(name, href, null, null);
  }
  const sketchImg = $(`${sketchesSelector} img.rsImg`).first();
  if (sketchImg && sketchImg.length) {
    const name = sketchImg.attr("alt") || "Sketch Image";
    const src = sketchImg.attr("src");
    if (src) writeFileRecord(name, src, "PropertyImage", null);
  }

  const seenDocUrls = new Set();
  sales.forEach((s, idx) => {
    deedCount += 1;
    let deedType = null;
    if (s.instrument) {
      const inst = s.instrument.toLowerCase();
      if (inst.includes("warranty deed")) deedType = "Warranty Deed";
      else if (inst.includes("quitclaim")) deedType = "Quitclaim Deed";
      else if (inst.includes("grant deed")) deedType = "Grant Deed";
      else if (
        (inst.includes("final") &&
          (inst.includes("judgement") || inst.includes("judgment"))) ||
        inst.includes("court order")
      )
        deedType = "Court Order Deed";
    }
    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    const deedFname = `deed_${deedCount}.json`;
    fs.writeFileSync(
      path.join(dataDir, deedFname),
      JSON.stringify(deedObj, null, 2),
    );

    relSalesDeedCount += 1;
    const relSD = {
      to: { "/": `./sales_${idx + 1}.json` },
      from: { "/": `./deed_${deedCount}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_sales_deed_${relSalesDeedCount}.json`),
      JSON.stringify(relSD, null, 2),
    );

    const docUrl = s.bookLink || s.pageLink || null;
    if (docUrl && !seenDocUrls.has(docUrl)) {
      seenDocUrls.add(docUrl);
      const fIdx = writeFileRecord("Deed Document", docUrl, null, null);
      relDeedFileCount += 1;
      const relDF = {
        to: { "/": `./deed_${deedCount}.json` },
        from: { "/": `./file_${fIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_deed_file_${relDeedFileCount}.json`),
        JSON.stringify(relDF, null, 2),
      );
    }
  });
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  try {
    const parsed = JSON.parse(e.message);
    console.error(JSON.stringify(parsed));
  } catch (_) {
    console.error(e.stack || String(e));
  }
  process.exit(1);
}
