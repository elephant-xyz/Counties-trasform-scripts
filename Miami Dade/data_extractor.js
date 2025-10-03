const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toTitleCase(name) {
  if (name == null) return null;
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])[a-z]/g, (s) => s.toUpperCase());
}

function parseISODate(mdy) {
  if (!mdy) return null;
  // supports MM/DD/YYYY or M/D/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function mapDorToPropertyType(dorCode) {
  if (!dorCode || typeof dorCode !== "string" || dorCode.length < 2)
    return null;
  const prefix = dorCode.slice(0, 2);
  switch (prefix) {
    case "00":
      return "VacantLand";
    case "01":
      return "SingleFamily";
    case "02":
      return "MobileHome";
    case "03":
      return "MultiFamilyMoreThan10";
    case "04":
      return "Condominium";
    case "05":
      return "Cooperative";
    case "08":
      return "MultiFamilyLessThan10";
    case "09":
      return "ResidentialCommonElementsAreas";
    default:
      return { error: true, value: prefix };
  }
}

function mapUnitsType(n) {
  if (n == null) return null;
  const i = Number(n);
  if (i === 1) return "One";
  if (i === 2) return "Two";
  if (i === 3) return "Three";
  if (i === 4) return "Four";
  return null; // unknown
}

function normalizeSuffix(suf) {
  if (!suf) return null;
  const map = {
    ST: "St",
    STREET: "St",
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    RD: "Rd",
    ROAD: "Rd",
    DR: "Dr",
    DRIVE: "Dr",
    LN: "Ln",
    LANE: "Ln",
    CT: "Ct",
    COURT: "Ct",
    PL: "Pl",
    PLACE: "Pl",
    TER: "Ter",
    TERRACE: "Ter",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
  };
  const key = String(suf).toUpperCase();
  return map[key] || suf; // best effort
}

function extractLotSizeFromLegal(desc) {
  if (!desc) return { width: null, length: null };
  // Expect pattern like "LOT SIZE     50.000 X   150"
  const m = /LOT SIZE\s+([\d.]+)\s*X\s*([\d.]+)/i.exec(desc);
  if (!m) return { width: null, length: null };
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  if (isNaN(a) || isNaN(b)) return { width: null, length: null };
  // Convention: width along street (smaller), depth is larger
  const width = Math.round(Math.min(a, b));
  const length = Math.round(Math.max(a, b));
  return { width, length };
}

function lotTypeFromSqft(sf) {
  if (sf == null) return null;
  const acres = Number(sf) / 43560;
  if (!isFinite(acres)) return null;
  return acres <= 0.25
    ? "LessThanOrEqualToOneQuarterAcre"
    : "GreaterThanOneQuarterAcre";
}

// Returns null or a non-empty string representation
function nonEmptyStringOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

// For fields requiring at least two digits in the string (e.g., property.total_area)
function areaStringOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  return /\d{2,}/.test(s) ? s : null;
}

function main() {
  const inputPath = path.join("input.json");
  const addrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const input = readJson(inputPath);
  const unAddr = readJson(addrPath);
  // seed not strictly needed for extraction by rules, but read to satisfy spec availability
  const seed = readJson(seedPath);
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  ensureDir("data");

  // PROPERTY
  const pInfo = input.PropertyInfo || {};
  const legal = input.LegalDescription || {};
  const building = input.Building || {};
  const siteAddr =
    Array.isArray(input.SiteAddress) && input.SiteAddress.length
      ? input.SiteAddress[0]
      : {};

  const dorCode = pInfo.DORCode || null;
  const mappedType = mapDorToPropertyType(dorCode);
  if (mappedType && mappedType.error) {
    const err = {
      type: "error",
      message: `Unknown enum value ${mappedType.value}.`,
      path: "property.property_type",
    };
    console.error(JSON.stringify(err));
    process.exit(1);
  }

  // Determine built years from BuildingInfos
  let builtYear = null;
  let effYear = null;
  if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
    const mainSegs = input.Building.BuildingInfos.filter(
      (b) => b && b.BuildingNo === 1 && b.SegNo === 1,
    );
    if (mainSegs.length) {
      const actuals = mainSegs.map((x) => x.Actual).filter((x) => x);
      const effs = mainSegs.map((x) => x.Effective).filter((x) => x);
      if (actuals.length) builtYear = Math.min(...actuals);
      if (effs.length) effYear = Math.min(...effs);
    }
  }
  if (!builtYear && Number.isInteger(pInfo.YearBuilt)) {
    builtYear = pInfo.YearBuilt;
  }

  const unitsType = mapUnitsType(pInfo.UnitCount);
  if (pInfo.UnitCount != null && unitsType == null) {
    const err = {
      type: "error",
      message: `Unknown enum value ${pInfo.UnitCount}.`,
      path: "property.number_of_units_type",
    };
    console.error(JSON.stringify(err));
    process.exit(1);
  }

  const property = {
    parcel_identifier: pInfo.FolioNumber || null,
    property_legal_description_text: legal.Description || null,
    property_structure_built_year: builtYear || null,
    property_effective_built_year: effYear || null,
    property_type: mappedType || null,
    number_of_units_type: unitsType || null,
    number_of_units: pInfo.UnitCount != null ? Number(pInfo.UnitCount) : null,
    livable_floor_area: nonEmptyStringOrNull(pInfo.BuildingHeatedArea),
    area_under_air: nonEmptyStringOrNull(pInfo.BuildingHeatedArea),
    total_area: areaStringOrNull(pInfo.BuildingGrossArea),
    subdivision: pInfo.SubdivisionDescription || null,
    zoning: pInfo.PrimaryZoneDescription || null,
  };

  writeJson(path.join("data", "property.json"), property);

  // ADDRESS
  const mailing = input.MailingAddress || {};
  let postal = null,
    plus4 = null;
  if (mailing.ZipCode && mailing.ZipCode.includes("-")) {
    const parts = mailing.ZipCode.split("-");
    postal = parts[0];
    plus4 = parts[1];
  } else if (unAddr.full_address && /\d{5}-\d{4}/.test(unAddr.full_address)) {
    const m = /(\d{5})-(\d{4})/.exec(unAddr.full_address);
    if (m) {
      postal = m[1];
      plus4 = m[2];
    }
  } else if (siteAddr.Zip && siteAddr.Zip.includes("-")) {
    const parts = siteAddr.Zip.split("-");
    postal = parts[0];
    plus4 = parts[1];
  } else if (unAddr.full_address && /(\d{5})/.test(unAddr.full_address)) {
    postal = /(\d{5})/.exec(unAddr.full_address)[1];
  }

  const address = {
    street_number:
      siteAddr.StreetNumber != null ? String(siteAddr.StreetNumber) : null,
    street_pre_directional_text: siteAddr.StreetPrefix || null,
    street_name:
      siteAddr.StreetName != null ? String(siteAddr.StreetName) : null,
    street_suffix_type: normalizeSuffix(siteAddr.StreetSuffix) || null,
    street_post_directional_text: siteAddr.StreetSuffixDirection
      ? siteAddr.StreetSuffixDirection
      : null,
    unit_identifier: siteAddr.Unit ? String(siteAddr.Unit) : null,
    city_name:
      (
        siteAddr.City ||
        pInfo.Municipality ||
        (unAddr.full_address ? unAddr.full_address.split(",")[1] : null) ||
        ""
      )
        .toString()
        .trim()
        .toUpperCase() || null,
    state_code: mailing.State || "FL",
    postal_code: postal || null,
    plus_four_postal_code: plus4 || null,
    country_code: "US",
    county_name: unAddr.county_jurisdiction || "Miami Dade",
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    municipality_name: pInfo.Municipality || null,
  };
  writeJson(path.join("data", "address.json"), address);

  // LOT
  const lotSizeRaw = pInfo.LotSize;
  let lotSize = null;
  if (lotSizeRaw != null && String(lotSizeRaw).trim() !== "") {
    const n = Number(lotSizeRaw);
    lotSize = isFinite(n) && n >= 1 ? Math.round(n) : null;
  }

  const { width: lotWidth, length: lotLength } = extractLotSizeFromLegal(
    legal.Description || "",
  );

  // Fencing detection
  let fencingType = null;
  let fenceLengthStr = null;
  if (
    input.ExtraFeature &&
    Array.isArray(input.ExtraFeature.ExtraFeatureInfos)
  ) {
    for (const ef of input.ExtraFeature.ExtraFeatureInfos) {
      if (
        ef &&
        typeof ef.Description === "string" &&
        /wood fence/i.test(ef.Description)
      ) {
        fencingType = "Wood";
        if (ef.Units != null) {
          const l = Math.round(Number(ef.Units));
          fenceLengthStr = isFinite(l) ? `${l}ft` : null;
        }
        break;
      }
    }
  }

  const lot = {
    lot_type: lotTypeFromSqft(lotSize),
    lot_length_feet: lotLength != null ? lotLength : null,
    lot_width_feet: lotWidth != null ? lotWidth : null,
    lot_area_sqft: lotSize,
    landscaping_features: null,
    view: null,
    fencing_type: fencingType,
    fence_height: null,
    fence_length: fenceLengthStr,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotSize != null ? lotSize / 43560 : null,
  };
  writeJson(path.join("data", "lot.json"), lot);

  // TAX
  if (input.Assessment && Array.isArray(input.Assessment.AssessmentInfos)) {
    const assessedByYear = new Map();
    for (const ai of input.Assessment.AssessmentInfos) {
      assessedByYear.set(ai.Year, ai);
    }
    const taxableByYear = new Map();
    if (input.Taxable && Array.isArray(input.Taxable.TaxableInfos)) {
      for (const ti of input.Taxable.TaxableInfos) {
        taxableByYear.set(ti.Year, ti);
      }
    }

    for (const [year, ai] of assessedByYear.entries()) {
      const ti = taxableByYear.get(year) || {};
      const tax = {
        tax_year: year != null ? Number(year) : null,
        property_assessed_value_amount:
          ai.AssessedValue != null ? Number(ai.AssessedValue) : null,
        property_market_value_amount:
          ai.TotalValue != null ? Number(ai.TotalValue) : null,
        property_building_amount:
          ai.BuildingOnlyValue != null ? Number(ai.BuildingOnlyValue) : null,
        property_land_amount:
          ai.LandValue != null ? Number(ai.LandValue) : null,
        property_taxable_value_amount:
          ti.SchoolTaxableValue != null ? Number(ti.SchoolTaxableValue) : null,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: null,
        first_year_on_tax_roll: null,
        first_year_building_on_tax_roll: null,
      };
      writeJson(path.join("data", `tax_${year}.json`), tax);
    }
  }

  // SALES
  if (Array.isArray(input.SalesInfos) && input.SalesInfos.length) {
    let saleIndex = 1;
    for (const s of input.SalesInfos) {
      const sales = {
        ownership_transfer_date: parseISODate(s.DateOfSale) || null,
        purchase_price_amount: s.SalePrice != null ? Number(s.SalePrice) : null,
      };
      writeJson(path.join("data", `sales_${saleIndex}.json`), sales);
      saleIndex++;
    }
  }

  // PERSON/COMPANY (owners)
  const ownersKey = `property_${(pInfo.FolioNumber || "").replace(/[^0-9\-]/g, "")}`; // expect 01-4103-033-0491
  const ownersPkg =
    owners[ownersKey] ||
    owners[
      `property_${(seed.parcel_id || "").replace(/(.{2})(.{4})(.{3})(.{4})/, "$1-$2-$3-$4")}`
    ] ||
    null;
  if (
    ownersPkg &&
    ownersPkg.owners_by_date &&
    Array.isArray(ownersPkg.owners_by_date.current)
  ) {
    const currentOwners = ownersPkg.owners_by_date.current;
    // choose person or company uniformly; here entries specify type
    let personCount = 0;
    let companyCount = 0;
    for (const o of currentOwners) {
      if (o.type === "person") personCount++;
      else if (o.type === "company") companyCount++;
    }

    let personIdx = 1;
    let companyIdx = 1;
    for (const o of currentOwners) {
      if (o.type === "person") {
        const person = {
          birth_date: null,
          first_name: toTitleCase(o.first_name || ""),
          last_name: toTitleCase(o.last_name || ""),
          middle_name: o.middle_name != null ? o.middle_name : null,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        writeJson(path.join("data", `person_${personIdx}.json`), person);
        personIdx++;
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        writeJson(path.join("data", `company_${companyIdx}.json`), company);
        companyIdx++;
      }
    }

    // relationships for sales → owners (use latest sales_1.json if exists)
    const salesFiles = fs
      .readdirSync("data")
      .filter((f) => /^sales_\d+\.json$/.test(f))
      .sort((a, b) => {
        const ai = parseInt(a.match(/(\d+)/)[1], 10);
        const bi = parseInt(b.match(/(\d+)/)[1], 10);
        return ai - bi;
      });
    if (salesFiles.length) {
      const lastSales = salesFiles[0]; // if only last is desired; spec does not define matching by date; link available sale
      let relIdx = 1;
      let p = 1;
      while (fs.existsSync(path.join("data", `person_${p}.json`))) {
        const rel = {
          to: { "/": `./person_${p}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_person${p > 1 ? `_${p}` : ""}.json`,
          ),
          rel,
        );
        p++;
        relIdx++;
      }
      let c = 1;
      while (fs.existsSync(path.join("data", `company_${c}.json`))) {
        const rel = {
          to: { "/": `./company_${c}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_company${c > 1 ? `_${c}` : ""}.json`,
          ),
          rel,
        );
        c++;
        relIdx++;
      }
    }
  }

  // UTILITY
  const utilsKey = ownersKey; // same pattern
  const utilPkg = utils[utilsKey] || null;
  if (utilPkg) {
    const utility = {
      cooling_system_type: utilPkg.cooling_system_type,
      heating_system_type: utilPkg.heating_system_type,
      public_utility_type: utilPkg.public_utility_type,
      sewer_type: utilPkg.sewer_type,
      water_source_type: utilPkg.water_source_type,
      plumbing_system_type: utilPkg.plumbing_system_type,
      plumbing_system_type_other_description:
        utilPkg.plumbing_system_type_other_description,
      electrical_panel_capacity: utilPkg.electrical_panel_capacity,
      electrical_wiring_type: utilPkg.electrical_wiring_type,
      hvac_condensing_unit_present: utilPkg.hvac_condensing_unit_present,
      electrical_wiring_type_other_description:
        utilPkg.electrical_wiring_type_other_description,
      solar_panel_present: utilPkg.solar_panel_present,
      solar_panel_type: utilPkg.solar_panel_type,
      solar_panel_type_other_description:
        utilPkg.solar_panel_type_other_description,
      smart_home_features: utilPkg.smart_home_features,
      smart_home_features_other_description:
        utilPkg.smart_home_features_other_description,
      hvac_unit_condition: utilPkg.hvac_unit_condition,
      solar_inverter_visible: utilPkg.solar_inverter_visible,
      hvac_unit_issues: utilPkg.hvac_unit_issues,
      electrical_panel_installation_date:
        utilPkg.electrical_panel_installation_date,
      electrical_rewire_date: utilPkg.electrical_rewire_date,
      hvac_capacity_kw: utilPkg.hvac_capacity_kw,
      hvac_capacity_tons: utilPkg.hvac_capacity_tons,
      hvac_equipment_component: utilPkg.hvac_equipment_component,
      hvac_equipment_manufacturer: utilPkg.hvac_equipment_manufacturer,
      hvac_equipment_model: utilPkg.hvac_equipment_model,
      hvac_installation_date: utilPkg.hvac_installation_date,
      hvac_seer_rating: utilPkg.hvac_seer_rating,
      hvac_system_configuration: utilPkg.hvac_system_configuration,
      plumbing_system_installation_date:
        utilPkg.plumbing_system_installation_date,
      sewer_connection_date: utilPkg.sewer_connection_date,
      solar_installation_date: utilPkg.solar_installation_date,
      solar_inverter_installation_date:
        utilPkg.solar_inverter_installation_date,
      solar_inverter_manufacturer: utilPkg.solar_inverter_manufacturer,
      solar_inverter_model: utilPkg.solar_inverter_model,
      water_connection_date: utilPkg.water_connection_date,
      water_heater_installation_date: utilPkg.water_heater_installation_date,
      water_heater_manufacturer: utilPkg.water_heater_manufacturer,
      water_heater_model: utilPkg.water_heater_model,
      well_installation_date: utilPkg.well_installation_date,
    };
    writeJson(path.join("data", "utility.json"), utility);
  }

  // LAYOUTS
  const layoutPkg = layouts[ownersKey] || null;
  if (layoutPkg && Array.isArray(layoutPkg.layouts)) {
    let idx = 1;
    for (const l of layoutPkg.layouts) {
      const layoutObj = {
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
        bathroom_renovation_date: l.bathroom_renovation_date ?? null,
        kitchen_renovation_date: l.kitchen_renovation_date ?? null,
        flooring_installation_date: l.flooring_installation_date ?? null,
      };
      writeJson(path.join("data", `layout_${idx}.json`), layoutObj);
      idx++;
    }
  }

  // STRUCTURE from input (set required to null where not provided)
  const structure = {
    architectural_style_type: null,
    attachment_type: pInfo && pInfo.UnitCount === 1 ? "Detached" : null,
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
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories:
      pInfo && pInfo.FloorCount != null ? Number(pInfo.FloorCount) : null,
  };
  writeJson(path.join("data", "structure.json"), structure);
}

try {
  main();
  console.log("Extraction complete.");
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
}
