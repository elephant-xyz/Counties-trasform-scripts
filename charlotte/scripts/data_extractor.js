// scripts/data_extractor.js
// Extraction script per instructions (refined per evaluator feedback)
// - Reads input.html, address.json, parcel.json
// - Reads owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// - Writes outputs into ./data/*.json
// - Uses only cheerio for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function normCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt)
    .replace(/[$,\s]/g, "")
    .trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function parseMDYToISO(txt) {
  if (!txt) return null;
  const m = String(txt)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const m2 = mm.padStart(2, "0");
  const d2 = dd.padStart(2, "0");
  return `${yyyy}-${m2}-${d2}`;
}

function titleCaseCounty(c) {
  if (!c) return null;
  const lc = String(c).toLowerCase();
  const map = {
    "miami dade": "Miami Dade",
    broward: "Broward",
    "palm beach": "Palm Beach",
    lee: "Lee",
    hillsborough: "Hillsborough",
    orange: "Orange",
    pinellas: "Pinellas",
    polk: "Polk",
    duval: "Duval",
    brevard: "Brevard",
    pasco: "Pasco",
    volusia: "Volusia",
    sarasota: "Sarasota",
    collier: "Collier",
    marion: "Marion",
    manatee: "Manatee",
    charlotte: "Charlotte",
    lake: "Lake",
    osceola: "Osceola",
    "st. lucie": "St. Lucie",
    seminole: "Seminole",
    escambia: "Escambia",
    "st. johns": "St. Johns",
    citrus: "Citrus",
    bay: "Bay",
    "santa rosa": "Santa Rosa",
    hernando: "Hernando",
    okaloosa: "Okaloosa",
    highlands: "Highlands",
    leon: "Leon",
    alachua: "Alachua",
    clay: "Clay",
    sumter: "Sumter",
    putnam: "Putnam",
    martin: "Martin",
    "indian river": "Indian River",
    walton: "Walton",
    monroe: "Monroe",
    flagler: "Flagler",
    nassau: "Nassau",
    levy: "Levy",
    washington: "Washington",
    jackson: "Jackson",
    suwannee: "Suwannee",
    columbia: "Columbia",
    hendry: "Hendry",
    okeechobee: "Okeechobee",
    gadsden: "Gadsden",
    wakulla: "Wakulla",
    desoto: "DeSoto",
    gulf: "Gulf",
    taylor: "Taylor",
    franklin: "Franklin",
    dixie: "Dixie",
    madison: "Madison",
    bradford: "Bradford",
    hardee: "Hardee",
    gilchrist: "Gilchrist",
    holmes: "Holmes",
    calhoun: "Calhoun",
    hamilton: "Hamilton",
    baker: "Baker",
    jefferson: "Jefferson",
    glades: "Glades",
    lafayette: "Lafayette",
    union: "Union",
    liberty: "Liberty",
    "fort bend": "Fort Bend",
    collin: "Collin",
    allegheny: "Allegheny",
    hunt: "Hunt",
  };
  return map[lc] || c;
}

function mapPropertyType(text) {
  if (!text) return null;
  const t = text.toUpperCase();
  if (t.includes("CONDOMINIUM")) return "Condominium";
  if (t.includes("MULTI-FAMILY")) return "MultiFamily";
  if (t.includes("TRIPLEX")) return "3Units";
  if (t.includes("QUAD") || t.includes("FOURPLEX"))
    return "4Units";
  if (t.includes("DUPLEX")) return "Duplex";
  if (t.includes("TOWNHOUSE")) return "Townhouse";
  if (t.includes("SINGLE FAMILY")) return "SingleFamily";
  if (t.includes("VACANT")) return "VacantLand";
  if (t.includes("APARTMENT")) return "Apartment";
  if (t.includes("MOBILE HOME")) return "MobileHome";
  return null;
}

function extractFromHTML(html) {
  const $ = cheerio.load(html);

  // General Parcel Information
  let currentUse = null;
  let zoning = null;
  $("h2").each((i, h2) => {
    const txt = $(h2).text().trim();
    if (/General Parcel Information/i.test(txt)) {
      let container = $(h2).nextAll("div.w3-border").first();
      if (!container || !container.length) {
        container = $(h2).parent().find("div.w3-border").first();
      }
      $(container)
        .find("div.w3-row")
        .each((j, row) => {
          const label = $(row)
            .find("div.w3-cell.w3-half strong")
            .first()
            .text()
            .trim();
          const valueCell = $(row).find("div.w3-cell.w3-half").last();
          const valText = valueCell
            .text()
            .replace(/\u00a0/g, " ")
            .trim();
          if (/Current Use/i.test(label)) currentUse = valText;
          if (/Zoning Code/i.test(label))
            zoning = valueCell.find("a").text().trim() || valText;
        });
    }
  });
  if (!currentUse || !zoning) {
    $("div.w3-row").each((j, row) => {
      const label = $(row)
        .find("div.w3-cell.w3-half strong")
        .first()
        .text()
        .trim();
      const valueCell = $(row).find("div.w3-cell.w3-half").last();
      const valText = valueCell
        .text()
        .replace(/\u00a0/g, " ")
        .trim();
      if (!currentUse && /Current Use/i.test(label)) currentUse = valText;
      if (!zoning && /Zoning Code/i.test(label))
        zoning = valueCell.find("a").text().trim() || valText;
    });
  }

  // Building Information table
  let yearBuilt = null;
  let yearCond = null;
  let acArea = null;
  let totalArea = null;
  let numberOfStories = null;
  let buildingDescription = null;
  let bldTable = null;
  $("table.prctable").each((i, t) => {
    const cap = $(t).find("caption.blockcaption").first().text().trim();
    if (/Building Information/i.test(cap)) bldTable = $(t);
  });
  if (bldTable) {
    const rows = bldTable.find("tbody > tr");
    if (rows.length > 1) {
      const firstDataRow = rows.eq(1);
      const cells = firstDataRow.find("td");
      buildingDescription = cells.eq(1).text().trim() || null;
      yearBuilt = cells.eq(4).text().trim() || null;
      yearCond = cells.eq(5).text().trim() || null;
      numberOfStories = cells.eq(6).text().trim() || null;
      acArea = cells.eq(11).text().trim() || null;
      totalArea = cells.eq(12).text().trim() || null;
    }
  }

  // Legal Description (Long Legal)
  let longLegal = null;
  $("div.w3-cell-row div.w3-container").each((i, el) => {
    const strong = $(el).find("strong").first().text().trim();
    if (/Long Legal/i.test(strong)) {
      longLegal = $(el)
        .text()
        .replace(/Long Legal:\s*/i, "")
        .trim();
    }
  });

  // Sales Information table
  const sales = [];
  let salesTable = null;
  $("h2").each((i, h2) => {
    if (/Sales Information/i.test($(h2).text())) {
      salesTable = $(h2)
        .nextAll("div.w3-responsive")
        .first()
        .find("table.prctable");
    }
  });
  if (salesTable && salesTable.length) {
    salesTable.find("tbody > tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (!tds || tds.length < 6) return;
      const dateTxt = tds.eq(0).text().trim();
      const bookLink = tds.eq(1).find("a").attr("href") || null;
      const instrumentLink = tds.eq(2).find("a").attr("href") || null;
      const instrumentNumber = tds.eq(2).text().trim();
      const priceTxt = tds.eq(3).text().trim();
      const dateISO = parseMDYToISO(dateTxt);
      const price = normCurrencyToNumber(priceTxt);
      sales.push({
        ownership_transfer_date: dateISO,
        purchase_price_amount: price,
        instrument: instrumentNumber,
        url: instrumentLink || bookLink || null,
      });
    });
  }

  // Tax Values (Preliminary)
  let taxYear = null;
  let prelimJustCounty = null;
  let prelimAssessedCounty = null;
  let prelimTaxable = { county: null, city: null, school: null, other: null };
  $("table.prctable").each((i, t) => {
    const cap = $(t).find("caption.blockcaption").first().text();
    if (cap && /Preliminary Tax Roll Values/i.test(cap)) {
      const m = cap.match(/(\d{4})\s+Preliminary/i);
      if (m) taxYear = parseInt(m[1], 10);
      $(t)
        .find("tbody > tr")
        .each((ri, r) => {
          const first = $(r).find("td").first();
          const name =
            first.find("strong").first().text().trim() || first.text().trim();
          if (/Preliminary Just Value/i.test(name)) {
            prelimJustCounty = normCurrencyToNumber(
              $(r).find("td").eq(1).text(),
            );
          } else if (/Preliminary Assessed Value/i.test(name)) {
            prelimAssessedCounty = normCurrencyToNumber(
              $(r).find("td").eq(1).text(),
            );
          } else if (/Preliminary Taxable Value/i.test(name)) {
            prelimTaxable.county = normCurrencyToNumber(
              $(r).find("td").eq(1).text(),
            );
            prelimTaxable.city = normCurrencyToNumber(
              $(r).find("td").eq(2).text(),
            );
            prelimTaxable.school = normCurrencyToNumber(
              $(r).find("td").eq(3).text(),
            );
            prelimTaxable.other = normCurrencyToNumber(
              $(r).find("td").eq(4).text(),
            );
          }
        });
    }
  });

  // Flood table
  let flood = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: null,
  };
  $("table.prctable").each((i, t) => {
    const cap = $(t).find("caption.blockcaption").first().text().trim();
    if (/FEMA Flood Zone \(Effective/i.test(cap)) {
      const m = cap.match(/Effective\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      flood.effective_date = m ? parseMDYToISO(m[1]) : null;
      const row = $(t).find("tbody > tr").eq(1);
      const tds = row.find("td");
      flood.panel_number = tds.eq(0).text().trim() || null || null;
      flood.flood_zone = tds.eq(3).text().trim() || null;
      flood.map_version = tds.eq(4).text().trim() || null; // using FIPS as proxy value present in table
      flood.community_id = tds.eq(6).text().trim() || null;
    }
  });

  return {
    currentUse,
    zoning,
    yearBuilt,
    yearCond,
    acArea,
    totalArea,
    numberOfStories,
    buildingDescription,
    longLegal,
    sales,
    tax: {
      taxYear,
      prelimJustCounty,
      prelimAssessedCounty,
      prelimTaxable,
    },
    flood,
  };
}

function run() {
  ensureDir(path.join(".", "data"));

  // Read inputs
  const html = fs.readFileSync(path.join(".", "input.html"), "utf8");
  const address = readJSON(path.join(".", "address.json")) || {};
  const parcel = readJSON(path.join(".", "parcel.json")) || {};
  const ownerData = readJSON(path.join(".", "owners", "owner_data.json")) || {};
  const utilitiesData =
    readJSON(path.join(".", "owners", "utilities_data.json")) || {};
  const layoutData =
    readJSON(path.join(".", "owners", "layout_data.json")) || {};

  const extracted = extractFromHTML(html);

  // Address output (unnormalized schema branch, now including required fields per schema)
  if (address && address.unnormalized_address) {
    const outAddr = {
      source_http_request: address.source_http_request || null,
      request_identifier: address.request_identifier || null,
      county_name: titleCaseCounty(address.county_name || ""),
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      unnormalized_address: address.unnormalized_address,
    };
    writeJSON(path.join("data", "address.json"), outAddr);
  }

  // Property output
  let propType = mapPropertyType(extracted.currentUse || "");
  if (!propType && extracted.buildingDescription)
    propType = mapPropertyType(extracted.buildingDescription);
  if (!propType && (extracted.currentUse || extracted.buildingDescription)) {
    const raw = extracted.currentUse || extracted.buildingDescription;
    console.error(
      JSON.stringify({
        type: "error",
        message: `Unknown enum value ${raw}.`,
        path: "property.property_type",
      }),
    );
  }
  const ownershipEstateType =
    extracted.longLegal && /\bL\/E\b|\bL\/E\d+/i.test(extracted.longLegal)
      ? "LifeEstate"
      : null;
  const prop = {
    parcel_identifier: String(parcel.parcel_identifier || "").trim(),
    property_type: propType,
    livable_floor_area: extracted.acArea
      ? String(extracted.acArea)
      : extracted.totalArea
        ? String(extracted.totalArea)
        : null,
    property_legal_description_text: extracted.longLegal || null,
    property_structure_built_year: extracted.yearBuilt
      ? parseInt(extracted.yearBuilt, 10)
      : null,
    property_effective_built_year: extracted.yearCond
      ? parseInt(extracted.yearCond, 10)
      : null,
    area_under_air: extracted.acArea ? String(extracted.acArea) : null,
    total_area: extracted.totalArea ? String(extracted.totalArea) : null,
    zoning: extracted.zoning || null,
    build_status: "Improved",
    ownership_estate_type: ownershipEstateType,
  };
  writeJSON(path.join("data", "property.json"), prop);

  // Owners (person or company)
  const ownerKey = `property_${parcel.parcel_identifier}`;
  const ownersForProp = ownerData[ownerKey]?.owners_by_date?.current || [];
  const people = ownersForProp.filter((o) => o.type === "person");
  const companies = ownersForProp.filter((o) => o.type === "company");
  let personIndex = 0;
  let companyIndex = 0;
  if (people.length > 0) {
    people.forEach((p) => {
      personIndex++;
      const personOut = {
        birth_date: null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        middle_name: p.middle_name || null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(path.join("data", `person_${personIndex}.json`), personOut);
    });
  } else if (companies.length > 0) {
    companies.forEach((c) => {
      companyIndex++;
      const compOut = { name: c.name || null };
      writeJSON(path.join("data", `company_${companyIndex}.json`), compOut);
    });
  }

  // Utilities
  const utilForProp = utilitiesData[ownerKey] || null;
  if (utilForProp) {
    writeJSON(path.join("data", "utility.json"), {
      cooling_system_type: utilForProp.cooling_system_type ?? null,
      heating_system_type: utilForProp.heating_system_type ?? null,
      public_utility_type: utilForProp.public_utility_type ?? null,
      sewer_type: utilForProp.sewer_type ?? null,
      water_source_type: utilForProp.water_source_type ?? null,
      plumbing_system_type: utilForProp.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utilForProp.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utilForProp.electrical_panel_capacity ?? null,
      electrical_wiring_type: utilForProp.electrical_wiring_type ?? null,
      hvac_condensing_unit_present:
        utilForProp.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        utilForProp.electrical_wiring_type_other_description ?? null,
      solar_panel_present: utilForProp.solar_panel_present ?? null,
      solar_panel_type: utilForProp.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utilForProp.solar_panel_type_other_description ?? null,
      smart_home_features: utilForProp.smart_home_features ?? null,
      smart_home_features_other_description:
        utilForProp.smart_home_features_other_description ?? null,
      hvac_unit_condition: utilForProp.hvac_unit_condition ?? null,
      solar_inverter_visible: utilForProp.solar_inverter_visible ?? null,
      hvac_unit_issues: utilForProp.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        utilForProp.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilForProp.electrical_rewire_date ?? null,
      heating_fuel_type: utilForProp.heating_fuel_type ?? null,
      hvac_capacity_kw: utilForProp.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilForProp.hvac_capacity_tons ?? null,
      hvac_equipment_component: utilForProp.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer:
        utilForProp.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilForProp.hvac_equipment_model ?? null,
      hvac_installation_date: utilForProp.hvac_installation_date ?? null,
      hvac_seer_rating: utilForProp.hvac_seer_rating ?? null,
      hvac_system_configuration: utilForProp.hvac_system_configuration ?? null,
      plumbing_fixture_count: utilForProp.plumbing_fixture_count ?? null,
      plumbing_fixture_quality: utilForProp.plumbing_fixture_quality ?? null,
      plumbing_fixture_type_primary:
        utilForProp.plumbing_fixture_type_primary ?? null,
      plumbing_system_installation_date:
        utilForProp.plumbing_system_installation_date ?? null,
      sewer_connection_date: utilForProp.sewer_connection_date ?? null,
      solar_installation_date: utilForProp.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utilForProp.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer:
        utilForProp.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilForProp.solar_inverter_model ?? null,
      water_connection_date: utilForProp.water_connection_date ?? null,
      water_heater_installation_date:
        utilForProp.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilForProp.water_heater_manufacturer ?? null,
      water_heater_model: utilForProp.water_heater_model ?? null,
      well_installation_date: utilForProp.well_installation_date ?? null,
    });
  }

  // Layouts
  const layouts = layoutData[ownerKey]?.layouts || [];
  layouts.forEach((l, idx) => {
    const out = {
      space_type: l.space_type ?? null,
      space_index: l.space_index ?? null,
      flooring_material_type: l.flooring_material_type ?? null,
      size_square_feet: l.size_square_feet ?? null,
      floor_level: l.floor_level ?? null,
      has_windows: l.has_windows ?? null,
      window_design_type: l.window_design_type ?? null,
      window_material_type: l.window_material_type ?? null,
      window_treatment_type: l.window_treatment_type ?? null,
      is_finished: l.is_finished ?? null,
      furnished: l.furnished ?? null,
      paint_condition: l.paint_condition ?? null,
      flooring_wear: l.flooring_wear ?? null,
      clutter_level: l.clutter_level ?? null,
      visible_damage: l.visible_damage ?? null,
      countertop_material: l.countertop_material ?? null,
      cabinet_style: l.cabinet_style ?? null,
      fixture_finish_quality: l.fixture_finish_quality ?? null,
      design_style: l.design_style ?? null,
      natural_light_quality: l.natural_light_quality ?? null,
      decor_elements: l.decor_elements ?? null,
      pool_type: l.pool_type ?? null,
      pool_equipment: l.pool_equipment ?? null,
      spa_type: l.spa_type ?? null,
      safety_features: l.safety_features ?? null,
      view_type: l.view_type ?? null,
      lighting_features: l.lighting_features ?? null,
      condition_issues: l.condition_issues ?? null,
      is_exterior: l.is_exterior ?? false,
      pool_condition: l.pool_condition ?? null,
      pool_surface_type: l.pool_surface_type ?? null,
      pool_water_quality: l.pool_water_quality ?? null,
      adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
      area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
      bathroom_renovation_date: l.bathroom_renovation_date ?? null,
      building_number: l.building_number ?? null,
      kitchen_renovation_date: l.kitchen_renovation_date ?? null,
      flooring_installation_date: l.flooring_installation_date ?? null,
      heated_area_sq_ft: l.heated_area_sq_ft ?? null,
      installation_date: l.installation_date ?? null,
      livable_area_sq_ft: l.livable_area_sq_ft ?? null,
      pool_installation_date: l.pool_installation_date ?? null,
      story_type: l.story_type ?? null,
      total_area_sq_ft: l.total_area_sq_ft ?? null,
    };
    writeJSON(path.join("data", `layout_${idx + 1}.json`), out);
  });

  // Sales
  const sales = extracted.sales || [];
  const saleIndexByInstrument = {};
  sales.forEach((s, idx) => {
    const out = { ownership_transfer_date: s.ownership_transfer_date || null };
    if (typeof s.purchase_price_amount === "number")
      out.purchase_price_amount = s.purchase_price_amount;
    writeJSON(path.join("data", `sales_${idx + 1}.json`), out);
    if (s.instrument) saleIndexByInstrument[s.instrument] = idx + 1;
  });

  // Relationship: sales -> owner (person/company)
  let matchedSaleIdx = null;
  if (extracted.longLegal) {
    const m = extracted.longLegal.match(/L\/E\s*(\d+)/i);
    if (m) {
      const instr = m[1];
      if (saleIndexByInstrument[instr])
        matchedSaleIdx = saleIndexByInstrument[instr];
    }
  }
  if (!matchedSaleIdx && sales.length > 0) matchedSaleIdx = 1;

  if (personIndex > 0 && matchedSaleIdx) {
    writeJSON(path.join("data", "relationship_sales_person.json"), {
      to: { "/": "./person_1.json" },
      from: { "/": `./sales_${matchedSaleIdx}.json` },
    });
  } else if (companyIndex > 0 && matchedSaleIdx) {
    writeJSON(path.join("data", "relationship_sales_company.json"), {
      to: { "/": "./company_1.json" },
      from: { "/": `./sales_${matchedSaleIdx}.json` },
    });
  }

  // Tax
  if (extracted.tax && extracted.tax.taxYear) {
    const taxableCandidates = [
      extracted.tax.prelimTaxable.county,
      extracted.tax.prelimTaxable.city,
      extracted.tax.prelimTaxable.school,
      extracted.tax.prelimTaxable.other,
    ].filter((v) => typeof v === "number" && v > 0);
    const property_taxable_value_amount = taxableCandidates.length
      ? Math.max(...taxableCandidates)
      : null;
    const taxOut = {
      tax_year: extracted.tax.taxYear,
      property_assessed_value_amount:
        extracted.tax.prelimAssessedCounty ?? null,
      property_market_value_amount: extracted.tax.prelimJustCounty ?? null,
      property_building_amount: null,
      property_land_amount: null,
      property_taxable_value_amount: property_taxable_value_amount ?? null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${extracted.tax.taxYear}.json`), taxOut);
  }

  // Flood
  if (extracted.flood) {
    const floodOut = {
      community_id: extracted.flood.community_id || null,
      panel_number: extracted.flood.panel_number || null,
      map_version: extracted.flood.map_version || null,
      effective_date: extracted.flood.effective_date || null,
      evacuation_zone: null,
      flood_zone: extracted.flood.flood_zone || null,
      flood_insurance_required: extracted.flood.flood_zone
        ? !/^X\b/i.test(extracted.flood.flood_zone)
        : false,
      fema_search_url: null,
    };
    writeJSON(path.join("data", "flood_storm_information.json"), floodOut);
  }

  // Structure
  const structureOut = {
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
    number_of_stories: extracted.numberOfStories
      ? Number(extracted.numberOfStories)
      : null,
    number_of_buildings: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    exterior_door_installation_date: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    roof_date: null,
    siding_installation_date: null,
    foundation_repair_date: null,
    window_installation_date: null,
  };
  writeJSON(path.join("data", "structure.json"), structureOut);

  // Lot
  const lotOut = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
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
  writeJSON(path.join("data", "lot.json"), lotOut);

  // Deed and file refs
  if (sales.length > 0) {
    const firstSale = sales[0];
    writeJSON(path.join("data", "deed_1.json"), {});
    const fileOut = {
      document_type: null,
      file_format: null,
      ipfs_url: null,
      name: firstSale.instrument
        ? `Instrument ${firstSale.instrument}`
        : "Document",
      original_url: firstSale.url || null,
    };
    writeJSON(path.join("data", "file_1.json"), fileOut);
    writeJSON(path.join("data", "relationship_deed_file.json"), {
      to: { "/": "./deed_1.json" },
      from: { "/": "./file_1.json" },
    });
    writeJSON(path.join("data", "relationship_sales_deed.json"), {
      to: { "/": "./sales_1.json" },
      from: { "/": "./deed_1.json" },
    });
  }
}

run();
