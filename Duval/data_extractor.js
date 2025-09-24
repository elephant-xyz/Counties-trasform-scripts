const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrency(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[$,]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const n = parseInt(String(str).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function parseFloatSafe(str) {
  if (str == null) return null;
  const n = parseFloat(String(str).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDateToISO(mdy) {
  if (!mdy) return null;
  const m = mdy.trim();
  const match = m.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [_, mm, dd, yyyy] = match;
  const m2 = mm.padStart(2, "0");
  const d2 = dd.padStart(2, "0");
  return `${yyyy}-${m2}-${d2}`;
}

function extractFromHTML(html) {
  const $ = cheerio.load(html);

  // Property basics
  const parcelIdentifier =
    $("#ctl00_cphBody_lblRealEstateNumber").text().trim() || null;

  const propertyUse = $("#ctl00_cphBody_lblPropertyUse").text().trim();
  let propertyType = "SingleFamily";
  if (!/Single\s*Family/i.test(propertyUse)) {
    propertyType = "SingleFamily";
  }

  // Year built - take earliest across buildings
  const yearBuiltSpans = $('[id$="_lblYearBuilt"]')
    .toArray()
    .map((el) => parseIntSafe($(el).text()))
    .filter((v) => Number.isFinite(v));
  const propertyStructureBuiltYear = yearBuiltSpans.length
    ? Math.min(...yearBuiltSpans)
    : null;

  // Legal description text
  let legalRows = [];
  $("#ctl00_cphBody_gridLegal tr").each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const txt = $(tds[1]).text().trim();
      if (txt) legalRows.push(txt);
    }
  });
  const propertyLegalDescription = legalRows.length
    ? legalRows.join(" ")
    : null;

  // Livable floor area: sum heated area from all buildings' Total rows
  let livableFloorArea = null;
  const heatedTotals = [];
  $('[id$="_gridBuildingArea"]').each((i, tbl) => {
    $(tbl)
      .find("tr")
      .each((j, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 4) {
          const label = $(tds[0]).text().trim();
          if (/^Total$/i.test(label)) {
            const heated = parseIntSafe($(tds[2]).text().trim());
            if (Number.isFinite(heated)) heatedTotals.push(heated);
          }
        }
      });
  });
  if (heatedTotals.length)
    livableFloorArea = String(heatedTotals.reduce((a, b) => a + b, 0));

  const totalAreaStr = $("#ctl00_cphBody_lblTotalArea1").text().trim() || null;
  const subdivision = $("#ctl00_cphBody_lblSubdivision").text().trim() || null;

  // Zoning Assessment from first row of Land table
  let zoning = null;
  const landTableFirstRow = $("#ctl00_cphBody_gridLand tr").eq(1); // after header
  if (landTableFirstRow && landTableFirstRow.length) {
    const tds = landTableFirstRow.find("td");
    if (tds.length >= 4) zoning = $(tds[3]).text().trim() || null;
  }

  // Land Units (acres)
  let lot_size_acre = null;
  if (landTableFirstRow && landTableFirstRow.length) {
    const tds = landTableFirstRow.find("td");
    if (tds.length >= 8) lot_size_acre = parseFloatSafe($(tds[7]).text());
  }

  // Address pieces for site address
  const siteLine1 = $("#ctl00_cphBody_lblPrimarySiteAddressLine1")
    .text()
    .trim();
  const siteLine2 = $("#ctl00_cphBody_lblPrimarySiteAddressLine2")
    .text()
    .trim();

  // Sales history - take rows
  const sales = [];
  $("#ctl00_cphBody_gridSalesHistory tr").each((i, tr) => {
    if (i === 0) return; // header
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const bookPageA = $(tds[0]).find("a");
      const bookPageText = bookPageA.text().trim();
      const link = bookPageA.attr("href") || null;
      const dateText = $(tds[1]).text().trim();
      const priceText = $(tds[2]).text().trim();
      const deedInstr = tds.length >= 4 ? $(tds[3]).text().trim() : null;
      sales.push({ bookPageText, link, dateText, priceText, deedInstr });
    }
  });

  // Value Summary
  const buildingValueCertified = parseCurrency(
    $("#ctl00_cphBody_lblBuildingValueCertified").text(),
  );
  const buildingValueInProgress = parseCurrency(
    $("#ctl00_cphBody_lblBuildingValueInProgress").text(),
  );
  const landValueMarketCertified = parseCurrency(
    $("#ctl00_cphBody_lblLandValueMarketCertified").text(),
  );
  const landValueMarketInProgress = parseCurrency(
    $("#ctl00_cphBody_lblLandValueMarketInProgress").text(),
  );
  const justMarketCertified = parseCurrency(
    $("#ctl00_cphBody_lblJustMarketValueCertified").text(),
  );
  const justMarketInProgress = parseCurrency(
    $("#ctl00_cphBody_lblJustMarketValueInProgress").text(),
  );
  const assessedCertified = parseCurrency(
    $("#ctl00_cphBody_lblAssessedValueA10Certified").text(),
  );
  const assessedInProgress = parseCurrency(
    $("#ctl00_cphBody_lblAssessedValueA10InProgress").text(),
  );
  const taxableCertified = parseCurrency(
    $("#ctl00_cphBody_lblTaxableValueCertified").text(),
  );
  // TRIM - totals
  const trimTotalsRow = $("#ctl00_cphBody_gridTaxDetails tr.trimTotals");
  let lastYearTotal = null; // yearly for 2024
  let proposedTotal = null; // proposed for 2025
  if (trimTotalsRow && trimTotalsRow.length) {
    const tds = trimTotalsRow.find("td");
    if (tds.length >= 6) {
      lastYearTotal = parseCurrency($(tds[4]).text());
      proposedTotal = parseCurrency($(tds[5]).text());
    }
  }
  // Extended block
  const taxLastYearJust = parseCurrency(
    $("#ctl00_cphBody_lblTaxLastYearJustValue").text(),
  );
  const taxLastYearAssessed = parseCurrency(
    $("#ctl00_cphBody_lblTaxLastYearAssessedValue").text(),
  );
  const taxLastYearExempt = parseCurrency(
    $("#ctl00_cphBody_lblTaxLastYearExemptions").text(),
  );
  const taxLastYearTaxable = parseCurrency(
    $("#ctl00_cphBody_lblTaxLastYearTaxableValue").text(),
  );
  const taxCurrentYearJust = parseCurrency(
    $("#ctl00_cphBody_lblTaxCurrentYearJustValue").text(),
  );
  const taxCurrentYearAssessed = parseCurrency(
    $("#ctl00_cphBody_lblTaxCurrentYearAssessedValue").text(),
  );
  const taxCurrentYearTaxable = parseCurrency(
    $("#ctl00_cphBody_lblTaxCurrentYearTaxableValue").text(),
  );

  return {
    parcelIdentifier,
    propertyType,
    propertyStructureBuiltYear,
    propertyLegalDescription,
    livableFloorArea,
    totalAreaStr,
    subdivision,
    zoning,
    lot_size_acre,
    siteLine1,
    siteLine2,
    sales,
    values: {
      buildingValueCertified,
      buildingValueInProgress,
      landValueMarketCertified,
      landValueMarketInProgress,
      justMarketCertified,
      justMarketInProgress,
      assessedCertified,
      assessedInProgress,
      taxableCertified,
      lastYearTotal,
      proposedTotal,
      taxLastYearJust,
      taxLastYearAssessed,
      taxLastYearExempt,
      taxLastYearTaxable,
      taxCurrentYearJust,
      taxCurrentYearAssessed,
      taxCurrentYearTaxable,
    },
  };
}

function buildAddress(unnormalized, htmlData) {
  const full =
    unnormalized && unnormalized.full_address
      ? unnormalized.full_address
      : null;
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null;
  if (full) {
    const parts = full.split(",");
    if (parts.length >= 3) {
      const line1 = parts[0].trim();
      const lineCity = parts[1].trim();
      const lineStateZip = parts[2].trim();
      const line1Parts = line1.split(/\s+/);
      street_number = line1Parts.shift() || null;
      const maybeSuffix = line1Parts.pop() || null; // RD
      street_suffix_type = maybeSuffix ? maybeSuffix.toUpperCase() : null;
      if (street_suffix_type) {
        const map = {
          RD: "Rd",
          ROAD: "Rd",
          ST: "St",
          STREET: "St",
          AVE: "Ave",
          AVENUE: "Ave",
          BLVD: "Blvd",
          LANE: "Ln",
          LN: "Ln",
          DR: "Dr",
        };
        street_suffix_type =
          map[street_suffix_type] ||
          street_suffix_type[0] + street_suffix_type.slice(1).toLowerCase();
      }
      street_name = line1Parts.join(" ") || null;
      city_name = lineCity.toUpperCase();
      const sz = lineStateZip.split(/\s+/);
      if (sz.length >= 2) {
        state_code = sz[0];
        postal_code = sz[1].replace(/[^0-9]/g, "").slice(0, 5) || null;
      }
    }
  }

  let plus_four_postal_code = null;
  if (htmlData && htmlData.siteLine2) {
    const match = htmlData.siteLine2.match(/\b\d{5}-(\d{4})\b/);
    if (match) plus_four_postal_code = match[1];
  }

  let township = null,
    range = null,
    section = null;
  if (htmlData && htmlData.propertyLegalDescription) {
    const m = htmlData.propertyLegalDescription.match(
      /(\d{1,2})-(\d{1,2})S-(\d{1,2})E/,
    );
    if (m) {
      section = m[1];
      township = m[2] + "S";
      range = m[3] + "E";
    }
  }

  return {
    block: null,
    city_name,
    country_code: "US",
    county_name: (unnormalized && unnormalized.county_jurisdiction) || "Duval",
    latitude: null,
    longitude: null,
    lot: null,
    municipality_name: null,
    plus_four_postal_code,
    postal_code,
    range,
    route_number: null,
    section,
    state_code,
    street_name,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_number,
    street_suffix_type,
    unit_identifier: null,
    township,
  };
}

function buildProperty(htmlData) {
  return {
    area_under_air: null,
    livable_floor_area: htmlData.livableFloorArea || "0",
    number_of_units: null,
    number_of_units_type: "One",
    parcel_identifier: htmlData.parcelIdentifier || "",
    property_effective_built_year: null,
    property_legal_description_text: htmlData.propertyLegalDescription || null,
    property_structure_built_year: htmlData.propertyStructureBuiltYear,
    property_type: "SingleFamily",
    subdivision: htmlData.subdivision || null,
    total_area: htmlData.totalAreaStr || null,
    zoning: htmlData.zoning || null,
  };
}

function buildLot(htmlData) {
  const lot_area_sqft = htmlData.totalAreaStr
    ? parseIntSafe(htmlData.totalAreaStr)
    : null;
  const lot_size_acre =
    htmlData.lot_size_acre == null ? null : htmlData.lot_size_acre;
  let lot_type = null;
  if (typeof lot_size_acre === "number") {
    lot_type =
      lot_size_acre > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre";
  }
  return {
    driveway_condition: null,
    driveway_material: null,
    fence_height: null,
    fence_length: null,
    fencing_type: null,
    landscaping_features: null,
    lot_area_sqft,
    lot_condition_issues: null,
    lot_length_feet: null,
    lot_size_acre,
    lot_type,
    lot_width_feet: null,
    view: null,
  };
}

function buildTaxFiles(htmlData) {
  const out = [];
  if (htmlData.values.justMarketCertified != null) {
    out.push({
      filename: "tax_2024.json",
      data: {
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        property_assessed_value_amount:
          htmlData.values.assessedCertified ?? null,
        property_building_amount:
          htmlData.values.buildingValueCertified ?? null,
        property_land_amount: htmlData.values.landValueMarketCertified ?? null,
        property_market_value_amount:
          htmlData.values.justMarketCertified ?? null,
        property_taxable_value_amount: htmlData.values.taxableCertified ?? null,
        tax_year: 2024,
        yearly_tax_amount: htmlData.values.lastYearTotal ?? null,
      },
    });
  }
  if (htmlData.values.taxCurrentYearJust != null) {
    out.push({
      filename: "tax_2025.json",
      data: {
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        property_assessed_value_amount:
          htmlData.values.taxCurrentYearAssessed ?? null,
        property_building_amount:
          htmlData.values.buildingValueInProgress ?? null,
        property_land_amount: htmlData.values.landValueMarketInProgress ?? null,
        property_market_value_amount:
          htmlData.values.taxCurrentYearJust ?? null,
        property_taxable_value_amount:
          htmlData.values.taxCurrentYearTaxable ?? null,
        tax_year: 2025,
        yearly_tax_amount: null,
      },
    });
  }
  return out;
}

function buildSalesFiles(htmlData) {
  const out = [];
  htmlData.sales.forEach((s, idx) => {
    const dateISO = parseDateToISO(s.dateText);
    const price = parseCurrency(s.priceText);
    if (dateISO && price != null) {
      out.push({
        filename: `sales_${idx + 1}.json`,
        data: {
          ownership_transfer_date: dateISO,
          purchase_price_amount: price,
          sale_type: undefined,
        },
        deedLink: s.link || null,
        bookPageText: s.bookPageText || null,
      });
    }
  });
  return out;
}

function mapRoofDesign(detail) {
  if (!detail) return null;
  const d = detail.toLowerCase();
  if (d.includes("gable or hip")) return "Combination";
  if (d.includes("gable")) return "Gable";
  if (d.includes("hip")) return "Hip";
  if (d.includes("flat")) return "Flat";
  return null;
}

function mapRoofCover(detail) {
  if (!detail) return null;
  const d = detail.toLowerCase();
  if (d.includes("asph") || d.includes("comp shng") || d.includes("shng"))
    return "3-Tab Asphalt Shingle";
  if (d.includes("metal")) return "Metal Standing Seam";
  if (d.includes("slate")) return "Natural Slate";
  if (d.includes("tile")) return "Clay Tile";
  return null;
}

function buildStructure(html) {
  const $ = cheerio.load(html);
  let number_of_stories = null;
  const storiesRow = $(
    "#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes tr",
  ).eq(1);
  if (storiesRow && storiesRow.length) {
    const tds = storiesRow.find("td");
    if (tds.length >= 2) {
      const val = parseFloatSafe($(tds[1]).text());
      if (Number.isFinite(val)) number_of_stories = Math.round(val);
    }
  }

  const elTbl1 = $(
    "#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements",
  );
  let exterior_wall_material_primary = null;
  let roof_design_type = null;
  let roof_covering_material = null;
  elTbl1.find("tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const elem = $(tds[0]).text().trim();
      const detail = $(tds[2]).text().trim();
      if (/^Exterior Wall$/i.test(elem)) {
        if (/Brick/i.test(detail)) exterior_wall_material_primary = "Brick";
      } else if (/^Roof Struct$/i.test(elem)) {
        roof_design_type = mapRoofDesign(detail) || roof_design_type;
      } else if (/^Roofing Cover$/i.test(elem)) {
        roof_covering_material = mapRoofCover(detail) || roof_covering_material;
      }
    }
  });

  let hasCarpet = false;
  let hasSheetVinyl = false;
  [
    $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements"),
    $("#ctl00_cphBody_repeaterBuilding_ctl01_gridBuildingElements"),
  ].forEach((tbl) => {
    tbl.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 3) {
        const elem = $(tds[0]).text().trim();
        const detail = $(tds[2]).text().trim();
        if (/Int Flooring/i.test(elem)) {
          if (/Carpet/i.test(detail)) hasCarpet = true;
          if (/Sheet\s*Vinyl/i.test(detail)) hasSheetVinyl = true;
        }
      }
    });
  });
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  if (hasCarpet && hasSheetVinyl) {
    flooring_material_primary = "Sheet Vinyl";
    flooring_material_secondary = "Carpet";
  } else if (hasCarpet) {
    flooring_material_primary = "Carpet";
  } else if (hasSheetVinyl) {
    flooring_material_primary = "Sheet Vinyl";
  }

  return {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: exterior_wall_material_primary || null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooring_material_primary || null,
    flooring_material_secondary: flooring_material_secondary || null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: number_of_stories,
    primary_framing_material: null,
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roof_covering_material || null,
    roof_date: null,
    roof_design_type: roof_design_type || null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    structural_damage_indicators: null,
    subfloor_material: "Unknown",
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };
}

function buildUtilities(utilitiesData, key) {
  const u = utilitiesData[key] || {};
  return {
    cooling_system_type: u.cooling_system_type ?? null,
    heating_system_type: u.heating_system_type ?? null,
    public_utility_type: u.public_utility_type ?? null,
    sewer_type: u.sewer_type ?? null,
    water_source_type: u.water_source_type ?? null,
    plumbing_system_type: u.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      u.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: u.electrical_panel_capacity ?? null,
    electrical_wiring_type: u.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: u.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      u.electrical_wiring_type_other_description ?? null,
    solar_panel_present: u.solar_panel_present ?? null,
    solar_panel_type: u.solar_panel_type ?? null,
    solar_panel_type_other_description:
      u.solar_panel_type_other_description ?? null,
    smart_home_features: u.smart_home_features ?? null,
    smart_home_features_other_description:
      u.smart_home_features_other_description ?? null,
    hvac_unit_condition: u.hvac_unit_condition ?? null,
    solar_inverter_visible: u.solar_inverter_visible ?? null,
    hvac_unit_issues: u.hvac_unit_issues ?? null,
  };
}

function buildLayouts(layoutData, key) {
  const out = [];
  const entry = layoutData[key];
  if (!entry || !Array.isArray(entry.layouts)) return out;
  entry.layouts.forEach((l, i) => {
    const data = {
      space_type: l.space_type ?? null,
      space_index: l.space_index,
      flooring_material_type: l.flooring_material_type ?? null,
      size_square_feet: l.size_square_feet ?? null,
      floor_level: l.floor_level ?? null,
      has_windows: l.has_windows ?? null,
      window_design_type: l.window_design_type ?? null,
      window_material_type: l.window_material_type ?? null,
      window_treatment_type: l.window_treatment_type ?? null,
      is_finished: l.is_finished,
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
      is_exterior: l.is_exterior,
      pool_condition: l.pool_condition ?? null,
      pool_surface_type: l.pool_surface_type ?? null,
      pool_water_quality: l.pool_water_quality ?? null,
    };
    out.push({ filename: `layout_${i + 1}.json`, data });
  });
  return out;
}

function splitSuffix(lastName) {
  if (!lastName) return { base: lastName, suffix: null };
  const parts = lastName.trim().split(/\s+/);
  if (parts.length <= 1) return { base: lastName, suffix: null };
  const lastToken = parts[parts.length - 1];
  const map = {
    SR: "Sr.",
    "SR.": "Sr.",
    JR: "Jr.",
    "JR.": "Jr.",
    II: "II",
    III: "III",
    IV: "IV",
  };
  const key = lastToken.toUpperCase();
  if (map[key]) {
    const base = parts.slice(0, -1).join(" ");
    return { base, suffix: map[key] };
  }
  return { base: lastName, suffix: null };
}

function buildPersons(ownerData, key, saleDateISO) {
  const out = [];
  const ownersByDate = ownerData[key] && ownerData[key].owners_by_date;
  if (!ownersByDate) return out;
  const owners = ownersByDate[saleDateISO] || ownersByDate["current"] || [];
  let idx = 1;
  owners.forEach((o) => {
    if (o.type === "person") {
      const { base, suffix } = splitSuffix(o.last_name || "");
      out.push({
        filename: `person_${idx}.json`,
        data: {
          birth_date: null,
          first_name: o.first_name || "",
          last_name: base || "",
          middle_name: o.middle_name ?? null,
          prefix_name: null,
          suffix_name: suffix ?? null,
          us_citizenship_status: null,
          veteran_status: null,
        },
      });
      idx++;
    }
  });
  return out;
}

function buildDeedAndFile(salesItem, index) {
  const deed = {};
  const file = {
    document_type: null,
    file_format: null,
    ipfs_url: null,
    name: salesItem.bookPageText
      ? `Official Records ${salesItem.bookPageText}`
      : null,
    original_url: salesItem.deedLink || null,
  };
  return {
    deedFilename: `deed_${index}.json`,
    fileFilename: `file_${index}.json`,
    deed,
    file,
  };
}

function main() {
  const inputHtmlPath = path.join("input.html");
  const unnormalizedPath = path.join("unnormalized_address.json");
  const propertySeedPath = path.join("property_seed.json");
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const outDir = path.join("data");
  ensureDir(outDir);

  const html = fs.readFileSync(inputHtmlPath, "utf-8");
  const htmlData = extractFromHTML(html);
  const unnormalized = readJSON(unnormalizedPath);
  const propertySeed = readJSON(propertySeedPath);
  const ownerData = readJSON(ownerPath);
  const utilitiesData = readJSON(utilitiesPath);
  const layoutData = readJSON(layoutPath);

  const ownersKey = `property_${(htmlData.parcelIdentifier || "").trim()}`;
  const utilitiesKey = ownersKey;

  const property = buildProperty(htmlData);
  writeJSON(path.join(outDir, "property.json"), property);

  const address = buildAddress(unnormalized, htmlData);
  writeJSON(path.join(outDir, "address.json"), address);

  const lot = buildLot(htmlData);
  writeJSON(path.join(outDir, "lot.json"), lot);

  const structure = buildStructure(html);
  writeJSON(path.join(outDir, "structure.json"), structure);

  const utility = buildUtilities(utilitiesData, utilitiesKey);
  writeJSON(path.join(outDir, "utility.json"), utility);

  const layouts = buildLayouts(layoutData, utilitiesKey);
  layouts.forEach((l) => writeJSON(path.join(outDir, l.filename), l.data));

  const taxFiles = buildTaxFiles(htmlData);
  taxFiles.forEach((t) => writeJSON(path.join(outDir, t.filename), t.data));

  const salesFiles = buildSalesFiles(htmlData);
  salesFiles.forEach((s) => writeJSON(path.join(outDir, s.filename), s.data));

  if (salesFiles.length > 0) {
    const deedFile = buildDeedAndFile(salesFiles[0], 1);
    writeJSON(path.join(outDir, deedFile.deedFilename), deedFile.deed);
    writeJSON(path.join(outDir, deedFile.fileFilename), deedFile.file);

    const relDeedFile = {
      to: { "/": `./${deedFile.deedFilename}` },
      from: { "/": `./${deedFile.fileFilename}` },
    };
    writeJSON(path.join(outDir, "relationship_deed_file.json"), relDeedFile);

    const relSalesDeed = {
      to: { "/": `./${salesFiles[0].filename}` },
      from: { "/": `./${deedFile.deedFilename}` },
    };
    writeJSON(path.join(outDir, "relationship_sales_deed.json"), relSalesDeed);
  }

  let saleDateISO = null;
  if (salesFiles.length > 0) {
    const salesJson = readJSON(path.join(outDir, salesFiles[0].filename));
    saleDateISO = salesJson.ownership_transfer_date;
  }
  const persons = buildPersons(ownerData, ownersKey, saleDateISO);
  persons.forEach((p) => writeJSON(path.join(outDir, p.filename), p.data));

  if (salesFiles.length > 0 && persons.length > 0) {
    persons.forEach((p, i) => {
      const rel = {
        to: { "/": `./${p.filename}` },
        from: { "/": `./${salesFiles[0].filename}` },
      };
      writeJSON(
        path.join(outDir, `relationship_sales_person_${i + 1}.json`),
        rel,
      );
    });
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Data extraction completed.");
  } catch (e) {
    console.error("Extraction failed:", e);
    process.exit(1);
  }
}
