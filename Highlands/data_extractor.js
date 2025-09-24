const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function cleanDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.unlinkSync(path.join(p, f));
  }
}

function readJSON(p, optional = false) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrency(str) {
  if (str == null) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function toISODate(year, month, day = 1) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseAddress(full) {
  if (!full) return null;
  // Examples: "2200 N AVON BLVD, AVON PARK, FL 33825"
  const parts = full.split(/\s*,\s*/);
  const line1 = parts[0] || null;
  const cityPart = parts[1] || null;
  const stateZipPart = parts.slice(2).join(", ");

  let street_number = null,
    preDir = null,
    street_name = null,
    suffix = null,
    postDir = null;
  if (line1) {
    const tokens = line1.trim().split(/\s+/);
    if (tokens.length >= 2) {
      street_number = tokens.shift();
      // Check for pre-direction
      const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
      if (dirs.has(tokens[0])) preDir = tokens.shift();
      // Last token may be suffix
      const rawSuffix = (tokens[tokens.length - 1] || "").toUpperCase();
      const suffixMap = {
        ALY: "Aly",
        AVE: "Ave",
        AV: "Ave",
        BLVD: "Blvd",
        BLV: "Blvd",
        CIR: "Cir",
        CT: "Ct",
        DR: "Dr",
        FWY: "Fwy",
        LN: "Ln",
        PL: "Pl",
        PKWY: "Pkwy",
        RD: "Rd",
        RTE: "Rte",
        SQ: "Sq",
        ST: "St",
        TER: "Ter",
        TRCE: "Trce",
        TRL: "Trl",
        WAY: "Way",
        HWY: "Hwy",
        PIKE: "Pike",
        PLZ: "Plz",
        WALK: "Walk",
        XING: "Xing",
      };
      if (suffixMap[rawSuffix]) {
        suffix = suffixMap[rawSuffix];
        tokens.pop();
      }
      street_name = tokens.join(" ");
    }
  }

  const city = cityPart ? cityPart.toUpperCase() : null;
  let state = null,
    zip = null;
  const sz = stateZipPart || "";
  const m = sz.match(/\b([A-Z]{2})\s+(\d{5})(?:-?(\d{4}))?\b/i);
  if (m) {
    state = m[1].toUpperCase();
    zip = m[2];
  }
  return {
    street_number: street_number || null,
    street_pre_directional_text: preDir || null,
    street_name: street_name || null,
    street_suffix_type: suffix || null,
    street_post_directional_text: postDir || null,
    city_name: city || null,
    state_code: state || null,
    postal_code: zip || null,
  };
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);
  cleanDir(dataDir); // idempotent outputs

  const inputHtmlPath = "input.html";
  const addrPath = "unnormalized_address.json";
  const seedPath = "property_seed.json";
  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);

  const unnormalizedAddress = readJSON(addrPath, true);
  const seed = readJSON(seedPath, true) || {};

  // Parcel Identifier
  let parcelIdentifier = null;
  const parcelHeader = $("h2")
    .filter((i, el) => $(el).text().trim().startsWith("Parcel "))
    .first()
    .text()
    .trim();
  const parcelMatch = parcelHeader.match(/Parcel\s+(.+)/i);
  if (parcelMatch) parcelIdentifier = parcelMatch[1].trim();

  // STRAP
  let strap = null;
  const scriptText = $("script")
    .map((i, el) => $(el).html() || "")
    .get()
    .join("\n");
  const strapMatch = scriptText.match(/GLOBAL_Strap\s*=\s*'([^']+)'/);
  if (strapMatch) strap = strapMatch[1];

  // External JSON sources
  let ownerData = readJSON(ownerDataPath, true);
  let utilitiesData = readJSON(utilitiesDataPath, true);
  let layoutData = readJSON(layoutDataPath, true);

  const ownerKey = parcelIdentifier ? `property_${parcelIdentifier}` : null;
  const utilKey = strap ? `property_${strap}` : null;

  // COMPANY/PERSON
  if (
    ownerData &&
    ownerKey &&
    ownerData[ownerKey] &&
    ownerData[ownerKey].owners_by_date &&
    Array.isArray(ownerData[ownerKey].owners_by_date.current)
  ) {
    const curOwners = ownerData[ownerKey].owners_by_date.current;
    let personIdx = 0,
      companyIdx = 0;
    curOwners.forEach((o) => {
      if (o.type === "person") {
        personIdx += 1;
        const out = {
          birth_date: null,
          first_name: o.first_name || null,
          last_name: o.last_name || null,
          middle_name: null,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        writeJSON(path.join(dataDir, `person_${personIdx}.json`), out);
      } else if (o.type === "company") {
        companyIdx += 1;
        const out = { name: o.name || null };
        writeJSON(path.join(dataDir, `company_${companyIdx}.json`), out);
      }
    });
  }

  // UTILITIES
  if (utilitiesData && utilKey && utilitiesData[utilKey]) {
    const u = utilitiesData[utilKey];
    const utilityOut = {
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
      solar_panel_present:
        typeof u.solar_panel_present === "boolean"
          ? u.solar_panel_present
          : null,
      solar_panel_type: u.solar_panel_type ?? null,
      solar_panel_type_other_description:
        u.solar_panel_type_other_description ?? null,
      smart_home_features: u.smart_home_features ?? null,
      smart_home_features_other_description:
        u.smart_home_features_other_description ?? null,
      hvac_unit_condition: u.hvac_unit_condition ?? null,
      solar_inverter_visible:
        typeof u.solar_inverter_visible === "boolean"
          ? u.solar_inverter_visible
          : null,
      hvac_unit_issues: u.hvac_unit_issues ?? null,
    };
    writeJSON(path.join(dataDir, "utility.json"), utilityOut);
  }

  // LAYOUTS (none provided)
  if (
    layoutData &&
    utilKey &&
    layoutData[utilKey] &&
    Array.isArray(layoutData[utilKey].layouts)
  ) {
    const layouts = layoutData[utilKey].layouts;
    layouts.forEach((lay, idx) => {
      try {
        writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), lay);
      } catch (e) {}
    });
  }

  // PROPERTY
  if (parcelIdentifier) {
    let legalDesc = null;
    const legalHeader = $('b:contains("Legal Description")');
    if (legalHeader && legalHeader.length) {
      const htmlBlock = legalHeader.parent().html() || "";
      const after = htmlBlock.split(/<b>Legal Description<\/b>/i)[1] || "";
      const tmp = cheerio.load(`<div>${after}</div>`);
      legalDesc = tmp("div").text().replace(/\s+/g, " ").trim() || null;
    }

    let builtYear = null;
    $('h3:contains("Buildings")')
      .parent()
      .find("table")
      .first()
      .find("tbody tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 7) {
          const ayb = $(tds[6]).text().trim();
          const y = parseInt(ayb, 10);
          if (!isNaN(y)) builtYear = y;
        }
      });

    let effectiveArea = null;
    const bldRow = $('h3:contains("Buildings")')
      .parent()
      .find("table")
      .first()
      .find("tbody tr")
      .first();
    if (bldRow && bldRow.length) {
      const eff = bldRow.find("td").eq(2).text().replace(/[,]/g, "").trim();
      if (eff) effectiveArea = eff;
    }

    let grossArea = null;
    const subareasFoot = $('b:contains("Subareas")')
      .parent()
      .find("tfoot tr")
      .first();
    if (subareasFoot && subareasFoot.length) {
      const tds = subareasFoot.find("td");
      if (tds.length >= 5) {
        const gross = $(tds[1]).text().replace(/[,]/g, "").trim();
        if (gross) grossArea = gross;
      }
    }

    let zoning = null;
    $('h3:contains("Land Lines")')
      .parent()
      .find("table tbody tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 4) {
          const z = $(tds[3]).text().trim();
          if (z) zoning = z;
        }
      });

    let subdivision = null;
    if (legalDesc) {
      const parts = legalDesc.split(/PB\s|\bA\sTRIANGULAR|\+/i);
      if (parts.length > 0) subdivision = parts[0].trim();
    }

    let propertyType = null;
    const dorText = $('b:contains("DOR Code:")').parent().text();
    if (/CHURCHES/i.test(dorText)) {
      propertyType = "MiscellaneousResidential";
    }
    if (!propertyType) {
      throw new Error(
        JSON.stringify({
          type: "error",
          message:
            "Unknown enum value (property_type could not be determined from DOR Code).",
          path: "property.property_type",
        }),
      );
    }

    const propertyOut = {
      livable_floor_area: effectiveArea ? String(effectiveArea) : null,
      number_of_units_type: null,
      parcel_identifier: parcelIdentifier,
      property_legal_description_text: legalDesc || null,
      property_structure_built_year: builtYear || null,
      property_type: propertyType,
      area_under_air: null,
      property_effective_built_year: null,
      subdivision: subdivision || null,
      total_area: grossArea ? String(grossArea) : null,
      zoning: zoning || null,
      number_of_units: null,
    };

    writeJSON(path.join(dataDir, "property.json"), propertyOut);
  }

  // ADDRESS from unnormalized_address
  if (unnormalizedAddress && unnormalizedAddress.full_address) {
    const parsed = parseAddress(unnormalizedAddress.full_address);
    const addrOut = {
      city_name: parsed.city_name || null,
      country_code: "US",
      county_name: unnormalizedAddress.county_jurisdiction || null,
      latitude: null,
      longitude: null,
      plus_four_postal_code: null,
      postal_code: parsed.postal_code || null,
      state_code: parsed.state_code || null,
      street_name: parsed.street_name || null,
      street_post_directional_text: parsed.street_post_directional_text || null,
      street_pre_directional_text: parsed.street_pre_directional_text || null,
      street_number: parsed.street_number || null,
      street_suffix_type: parsed.street_suffix_type || null,
      unit_identifier: null,
      route_number: null,
      township: null,
      range: null,
      section: null,
      block: null,
      lot: null,
      municipality_name: null,
    };
    writeJSON(path.join(dataDir, "address.json"), addrOut);
  }

  // STRUCTURE from HTML Elements table
  let extWallPrimary = null;
  let roofDesign = null;
  let roofMaterialType = null;
  let interiorWallSurfacePrimary = null;
  const elementsTable = $('h3:contains("Buildings")')
    .parent()
    .find("table")
    .eq(1); // second table (Elements)
  if (elementsTable && elementsTable.length) {
    elementsTable.find("tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const label =
        (tds[0] && tds[0].children && tds[0].children.length
          ? cheerio.load(tds[0]).text().trim()
          : tds[0]
            ? cheerio.load(tds[0]).text().trim()
            : "") || "";
      const labelText = (label || $(tds[0]).text() || "").trim();
      const desc = $(tds[2]).text().trim();
      const lbl = labelText;
      if (/Exterior Wall$/i.test(lbl)) {
        if (/Concrete Block/i.test(desc)) extWallPrimary = "Concrete Block";
      } else if (/Roof Structure/i.test(lbl)) {
        if (/Gable/i.test(desc) && /Hip/i.test(desc))
          roofDesign = "Combination";
        else if (/Gable/i.test(desc)) roofDesign = "Gable";
        else if (/Hip/i.test(desc)) roofDesign = "Hip";
      } else if (/Roof Cover/i.test(lbl)) {
        if (/Metal/i.test(desc)) roofMaterialType = "Metal";
      } else if (/Interior Wall$/i.test(lbl)) {
        if (/Plaster/i.test(desc) || /Plastered/i.test(desc))
          interiorWallSurfacePrimary = "Plaster";
      }
    });
  }
  const structureOut = {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: extWallPrimary || null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
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
    interior_wall_surface_material_primary: interiorWallSurfacePrimary || null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: roofDesign || null,
    roof_material_type: roofMaterialType || null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structureOut);

  // LOT from Land Lines
  let lotAreaSqft = null;
  let lotLen = null,
    lotWid = null;
  $('h3:contains("Land Lines")')
    .parent()
    .find("table tbody tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 8) {
        const front = parseFloat($(tds[4]).text().replace(/,/g, ""));
        const depth = parseFloat($(tds[5]).text().replace(/,/g, ""));
        if (!isNaN(front) && front > 0) lotLen = Math.round(front);
        if (!isNaN(depth) && depth > 0) lotWid = Math.round(depth);
        const units = parseFloat($(tds[6]).text().replace(/,/g, ""));
        const unitType = $(tds[7]).text().trim();
        if (!isNaN(units)) {
          if (/AC/i.test(unitType)) lotAreaSqft = Math.round(units * 43560);
          else if (/SF|SQ ?FT/i.test(unitType)) lotAreaSqft = Math.round(units);
        }
      }
    });
  const lotType =
    typeof lotAreaSqft === "number" && lotAreaSqft > Math.round(0.25 * 43560)
      ? "GreaterThanOneQuarterAcre"
      : typeof lotAreaSqft === "number"
        ? "LessThanOrEqualToOneQuarterAcre"
        : null;
  const lotOut = {
    lot_type: lotType || null,
    lot_length_feet: typeof lotLen === "number" ? lotLen : null,
    lot_width_feet: typeof lotWid === "number" ? lotWid : null,
    lot_area_sqft: typeof lotAreaSqft === "number" ? lotAreaSqft : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lotOut);

  // SALES
  const salesRows = $('h3:contains("Sales History")')
    .parent()
    .find("table tbody tr");
  let salesIndex = 0;
  const salesMeta = [];

  salesRows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 9) {
      const bookHref = $(tds[0]).find("a").attr("href") || null;
      const pageHref = $(tds[1]).find("a").attr("href") || null;
      const monthStr = $(tds[2]).text().trim();
      const yearStr = $(tds[3]).text().trim();
      const inst = $(tds[4]).text().trim();
      const priceStr = $(tds[8]).text().trim();
      const price = parseCurrency(priceStr);

      const m = parseInt(monthStr, 10) || 1;
      const y = parseInt(yearStr, 10) || null;
      salesIndex += 1;
      const saleOut = {
        ownership_transfer_date: y ? toISODate(y, m, 1) : null,
        purchase_price_amount: price,
      };
      const salePath = path.join(dataDir, `sales_${salesIndex}.json`);
      writeJSON(salePath, saleOut);

      salesMeta.push({
        idx: salesIndex,
        month: m,
        year: y || 0,
        inst,
        bookHref,
        pageHref,
      });
    }
  });

  // Determine latest sale overall
  let latestSale = null;
  for (const s of salesMeta) {
    if (!latestSale) latestSale = s;
    else if (
      s.year > latestSale.year ||
      (s.year === latestSale.year && s.month > latestSale.month)
    )
      latestSale = s;
  }

  // Determine latest WD sale
  let latestWDSale = null;
  for (const s of salesMeta) {
    if (/^WD$/i.test(s.inst)) {
      if (!latestWDSale) latestWDSale = s;
      else if (
        s.year > latestWDSale.year ||
        (s.year === latestWDSale.year && s.month > latestWDSale.month)
      )
        latestWDSale = s;
    }
  }

  // Deed & File for latest WD
  if (latestWDSale) {
    writeJSON(path.join(dataDir, "deed_1.json"), {
      deed_type: "Warranty Deed",
    });
    const originalUrl = latestWDSale.bookHref || latestWDSale.pageHref || null;
    if (originalUrl) {
      const fileOut = {
        file_format: null,
        name: "Official Record",
        original_url: originalUrl,
        ipfs_url: null,
        document_type: "ConveyanceDeedWarrantyDeed",
      };
      writeJSON(path.join(dataDir, "file_1.json"), fileOut);
      const relDeedFile = {
        to: { "/": "./deed_1.json" },
        from: { "/": "./file_1.json" },
      };
      writeJSON(path.join(dataDir, "relationship_deed_file.json"), relDeedFile);
    }
    const relSalesDeed = {
      to: { "/": `./sales_${latestWDSale.idx}.json` },
      from: { "/": "./deed_1.json" },
    };
    writeJSON(path.join(dataDir, "relationship_sales_deed.json"), relSalesDeed);
  }

  // Relationship: latest sale -> owner entity
  if (latestSale) {
    const latestSaleFile = `./sales_${latestSale.idx}.json`;
    if (fs.existsSync(path.join(dataDir, "company_1.json"))) {
      const rel = {
        to: { "/": "./company_1.json" },
        from: { "/": latestSaleFile },
      };
      writeJSON(path.join(dataDir, "relationship_sales_company.json"), rel);
    } else if (fs.existsSync(path.join(dataDir, "person_1.json"))) {
      const rel = {
        to: { "/": "./person_1.json" },
        from: { "/": latestSaleFile },
      };
      writeJSON(path.join(dataDir, "relationship_sales_person.json"), rel);
    }
  }

  // TAX
  let valueSummaryTable = null;
  const vsH3 = $('h3:contains("Value Summary")').first();
  if (vsH3.length) {
    const container = vsH3.parent().parent();
    valueSummaryTable = container.find("table").first();
  }
  let taxableSummaryTable = null;
  const tsH3 = $('h3:contains("Taxable Value Summary")').first();
  if (tsH3.length) {
    const container2 = tsH3.parent().parent();
    taxableSummaryTable = container2.find("table").first();
  }

  if (
    valueSummaryTable &&
    valueSummaryTable.length &&
    taxableSummaryTable &&
    taxableSummaryTable.length
  ) {
    let building = null,
      land = null,
      just = null,
      assessed = null,
      taxable = null;
    valueSummaryTable.find("tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const label = $(tds[0]).text().trim();
      const value = $(tds[1]).text().trim();
      if (/Total Building Value/i.test(label)) building = parseCurrency(value);
      if (/Total Land Value$/i.test(label)) land = parseCurrency(value);
      if (/Total Just Value/i.test(label)) just = parseCurrency(value);
    });
    taxableSummaryTable.find("tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const label = $(tds[0]).text().trim();
      const value = $(tds[1]).text().trim();
      if (/Total Assessed/i.test(label)) assessed = parseCurrency(value);
      if (/Total Taxable Value/i.test(label)) taxable = parseCurrency(value);
    });

    const taxOut = {
      tax_year: null,
      property_assessed_value_amount: assessed,
      property_market_value_amount: just,
      property_building_amount: building,
      property_land_amount: land,
      property_taxable_value_amount:
        typeof taxable === "number" ? taxable : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join(dataDir, "tax_1.json"), taxOut);
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction completed.");
  } catch (e) {
    try {
      const maybe = JSON.parse(e.message);
      console.error(JSON.stringify(maybe));
    } catch (_) {
      console.error(e && e.message ? e.message : e);
    }
    process.exit(1);
  }
}
