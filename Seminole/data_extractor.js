const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function titleCaseName(name) {
  if (!name || typeof name !== "string") return name;
  return name
    .split(/\s+/)
    .map((part) =>
      part
        .toLowerCase()
        .replace(/(^[a-z])|(['-][a-z])/g, (s) => s.toUpperCase()),
    )
    .join(" ");
}

function mapPropertyType(input) {
  const dorDesc = (input.dorDescription || "").toUpperCase().trim();
  const bldgType = (
    (input.buildingDetails &&
      input.buildingDetails[0] &&
      input.buildingDetails[0].bldgType) ||
    ""
  )
    .toUpperCase()
    .trim();
  if (dorDesc === "TOWNHOME" || dorDesc === "TOWNHOUSE") return "Townhouse";
  if (bldgType === "SINGLE FAMILY" || bldgType === "SINGLE-FAMILY")
    return "SingleFamily";
  if (bldgType === "DUPLEX") return "Duplex";
  // Unknown
  throw {
    type: "error",
    message: `Unknown enum value ${dorDesc || bldgType}.`,
    path: "property.property_type",
  };
}

function mapUnitsType(input) {
  const dorDesc = (input.dorDescription || "").toUpperCase().trim();
  const bldgType = (
    (input.buildingDetails &&
      input.buildingDetails[0] &&
      input.buildingDetails[0].bldgType) ||
    ""
  )
    .toUpperCase()
    .trim();
  // Single family or townhome are one unit
  if (
    dorDesc === "TOWNHOME" ||
    dorDesc === "TOWNHOUSE" ||
    bldgType === "SINGLE FAMILY" ||
    bldgType === "SINGLE-FAMILY"
  )
    return "One";
  if (bldgType === "DUPLEX") return "Two";
  // If unknown, raise error to comply with enum handling rule
  throw {
    type: "error",
    message: `Unknown enum value for number_of_units_type from ${dorDesc || bldgType}.`,
    path: "property.number_of_units_type",
  };
}

function parseSitusAddress(situs) {
  if (!situs) return null;
  const lines = situs
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const line1 = lines[0];
  const cityStateZip = lines[1] || "";
  const m1 = line1.match(/^(\d+)\s+(.+)$/);
  let street_number = null,
    street_name = null,
    street_suffix_type = null;
  if (m1) {
    street_number = m1[1];
    const parts = m1[2].split(/\s+/);
    if (parts.length > 1) {
      street_suffix_type = parts.pop().toUpperCase();
      street_name = parts.join(" ");
    } else {
      street_name = parts[0];
    }
  }
  const m2 = cityStateZip.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/);
  let city_name = null,
    state_code = null,
    postal_code = null;
  if (m2) {
    city_name = m2[1].trim().toUpperCase();
    state_code = m2[2];
    postal_code = m2[3];
  }
  // Map common suffixes to enum values casing
  const suffixMap = {
    RD: "Rd",
    ROAD: "Rd",
    DR: "Dr",
    DRIVE: "Dr",
    ST: "St",
    STREET: "St",
    AVE: "Ave",
    AVENUE: "Ave",
    LN: "Ln",
    LANE: "Ln",
    CT: "Ct",
    COURT: "Ct",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    CIR: "Cir",
    CIRCLE: "Cir",
    TER: "Ter",
    TERRACE: "Ter",
    WAY: "Way",
    HWY: "Hwy",
    PKWY: "Pkwy",
    PL: "Pl",
    PLACE: "Pl",
    LOOP: "Loop",
    XING: "Xing",
    TRAIL: "Trl",
    TRL: "Trl",
    PATH: "Path",
    PASS: "Pass",
    RUN: "Run",
    MALL: "Mall",
    WALK: "Walk",
    RDG: "Rdg",
    RIDGE: "Rdg",
  };
  if (street_suffix_type) {
    street_suffix_type = suffixMap[street_suffix_type] || street_suffix_type;
  }
  return {
    street_number,
    street_name,
    street_suffix_type,
    city_name,
    state_code,
    postal_code,
  };
}

function extractZipFromFullAddress(full) {
  if (!full || typeof full !== "string") return null;
  const m = full.trim().match(/(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

function parseLotFromLegal(legal) {
  if (!legal || typeof legal !== "string") return null;
  const m = legal.match(/\bLOT\s+(\w+)\b/i);
  return m ? m[1] : null;
}

function writeJSON(relPath, obj) {
  const outPath = path.join("data", relPath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2), "utf8");
}

function buildProperty(input) {
  const parcel_identifier = input.parcelNumber;
  const bldg = (input.buildingDetails && input.buildingDetails[0]) || {};
  const property = {
    parcel_identifier,
    property_legal_description_text: input.legal || null,
    property_structure_built_year: bldg.yearBlt
      ? parseInt(String(bldg.yearBlt).slice(0, 4), 10)
      : null,
    property_effective_built_year: null,
    property_type: mapPropertyType(input),
    livable_floor_area:
      input.livingAreaCalc != null ? String(input.livingAreaCalc) : null,
    total_area:
      input.grossAreaCalc != null ? String(input.grossAreaCalc) : null,
    area_under_air:
      input.livingAreaCalc != null ? String(input.livingAreaCalc) : null,
    number_of_units_type: mapUnitsType(input),
    number_of_units: 1,
    subdivision: input.subName || input.platName || null,
    zoning: input.zoning || null,
  };
  writeJSON("property.json", property);
}

function buildAddress(input, uaddr) {
  const situs = parseSitusAddress(input.situsAddress || "");
  const lot = parseLotFromLegal(input.legal || null);
  // Prefer unnormalized zip if present and use it to satisfy validation requirement
  const zipFromUnnormalized = extractZipFromFullAddress(
    uaddr && uaddr.full_address,
  );
  const postal_code = zipFromUnnormalized || (situs ? situs.postal_code : null);
  const address = {
    street_number: situs ? situs.street_number : null,
    street_name: situs ? situs.street_name || null : null,
    street_suffix_type: situs ? situs.street_suffix_type || null : null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    city_name: situs ? situs.city_name || null : null,
    state_code: situs ? situs.state_code || null : null,
    postal_code,
    plus_four_postal_code: null,
    country_code: "US",
    county_name:
      uaddr && uaddr.county_jurisdiction ? uaddr.county_jurisdiction : null,
    latitude: null,
    longitude: null,
    unit_identifier: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: lot,
    municipality_name: null,
  };
  writeJSON("address.json", address);
}

function buildTaxForYear(input, year) {
  const bldg = (input.buildingDetails && input.buildingDetails[0]) || {};
  const land = (input.landDetails && input.landDetails[0]) || {};
  const tax = {
    tax_year: year || null,
    property_assessed_value_amount:
      input.totalAssessedValue != null
        ? Number(input.totalAssessedValue)
        : null,
    property_market_value_amount:
      input.totalJustValue != null ? Number(input.totalJustValue) : null,
    property_building_amount:
      bldg.baseAdjVal != null ? Number(bldg.baseAdjVal) : null,
    property_land_amount:
      land.landApprValue != null ? Number(land.landApprValue) : null,
    property_taxable_value_amount:
      input.totalAssessedValue != null
        ? Number(input.totalAssessedValue)
        : null,
    monthly_tax_amount: null,
    yearly_tax_amount:
      input.lastTaxBillAmount != null ? Number(input.lastTaxBillAmount) : null,
    period_start_date: null,
    period_end_date: null,
    first_year_on_tax_roll: null,
    first_year_building_on_tax_roll: null,
  };
  writeJSON(`tax_${tax.tax_year || "unknown"}.json`, tax);
}

function buildFlood(input) {
  const flood = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: input.floodZone || null,
    flood_insurance_required:
      (input.floodZone || "").toUpperCase() === "NO" ? false : false,
    fema_search_url: null,
  };
  writeJSON("flood_storm_information.json", flood);
}

function buildStructure(input) {
  const bldg = (input.buildingDetails && input.buildingDetails[0]) || {};
  const subAreas = bldg.buildingSubAreas || [];
  let unfinished_base_area = null;
  for (const sa of subAreas) {
    if (sa.apdgCode === "UTU") {
      unfinished_base_area = sa.apdgActualArea;
      break;
    }
  }
  const extWall = (bldg.extWall || "").toUpperCase();
  let exterior_primary = null;
  let exterior_secondary = null;
  if (extWall.includes("CB")) exterior_primary = "Concrete Block";
  if (extWall.includes("STUCCO")) exterior_secondary = "Stucco Accent";
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: exterior_primary,
    exterior_wall_material_secondary: exterior_secondary,
    finished_base_area: bldg.baseArea != null ? Number(bldg.baseArea) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
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
    number_of_stories: bldg.baseFloors != null ? Number(bldg.baseFloors) : null,
    primary_framing_material: exterior_primary ? "Concrete Block" : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area:
      unfinished_base_area != null ? Number(unfinished_base_area) : null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  writeJSON("structure.json", structure);
}

function buildLot(input) {
  const acres = input.gisAcres != null ? Number(input.gisAcres) : null;
  const sqft = acres != null ? Math.round(acres * 43560) : null;
  const lot = {
    lot_type:
      acres != null
        ? acres <= 0.25
          ? "LessThanOrEqualToOneQuarterAcre"
          : "GreaterThanOneQuarterAcre"
        : null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: sqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: acres,
  };
  writeJSON("lot.json", lot);
}

function buildOwners(ownerData, parcelNumber) {
  const key = `property_${parcelNumber}`;
  const container = ownerData[key];
  if (
    !container ||
    !container.owners_by_date ||
    !Array.isArray(container.owners_by_date.current)
  )
    return [];
  const owners = container.owners_by_date.current;
  let idx = 1;
  const created = [];
  for (const o of owners) {
    if (o.type === "person") {
      const person = {
        birth_date: null,
        first_name: titleCaseName(o.first_name || ""),
        last_name: titleCaseName(o.last_name || ""),
        middle_name: null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(`person_${idx}.json`, person);
      created.push(`person_${idx}.json`);
      idx++;
    }
  }
  return created;
}

function buildUtility(utilitiesData, apprId) {
  const key = `property_${apprId}`;
  const u = utilitiesData[key];
  if (!u) return;
  const out = {
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
    solar_panel_present: !!u.solar_panel_present,
    solar_panel_type: u.solar_panel_type ?? null,
    solar_panel_type_other_description:
      u.solar_panel_type_other_description ?? null,
    smart_home_features: u.smart_home_features ?? null,
    smart_home_features_other_description:
      u.smart_home_features_other_description ?? null,
    hvac_unit_condition: u.hvac_unit_condition ?? null,
    solar_inverter_visible: !!u.solar_inverter_visible,
    hvac_unit_issues: u.hvac_unit_issues ?? null,

    electrical_panel_installation_date:
      u.electrical_panel_installation_date ?? null,
    electrical_rewire_date: u.electrical_rewire_date ?? null,
    hvac_capacity_kw: u.hvac_capacity_kw ?? null,
    hvac_capacity_tons: u.hvac_capacity_tons ?? null,
    hvac_equipment_component: u.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: u.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: u.hvac_equipment_model ?? null,
    hvac_installation_date: u.hvac_installation_date ?? null,
    hvac_seer_rating: u.hvac_seer_rating ?? null,
    hvac_system_configuration: u.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      u.plumbing_system_installation_date ?? null,
    public_utility_type_other_description: undefined, // not in schema, ignore
    sewer_connection_date: u.sewer_connection_date ?? null,
    solar_installation_date: u.solar_installation_date ?? null,
    solar_inverter_installation_date:
      u.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
    solar_inverter_model: u.solar_inverter_model ?? null,
    water_connection_date: u.water_connection_date ?? null,
    water_heater_installation_date: u.water_heater_installation_date ?? null,
    water_heater_manufacturer: u.water_heater_manufacturer ?? null,
    water_heater_model: u.water_heater_model ?? null,
    well_installation_date: u.well_installation_date ?? null,
  };
  writeJSON("utility.json", out);
}

function buildLayouts(layoutData, apprId) {
  const key = `property_${apprId}`;
  const container = layoutData[key];
  if (!container || !Array.isArray(container.layouts)) return [];
  let i = 1;
  const files = [];
  for (const l of container.layouts) {
    const out = { ...l };
    // Ensure all required keys exist even if null
    const requiredKeys = [
      "space_type",
      "space_index",
      "flooring_material_type",
      "size_square_feet",
      "floor_level",
      "has_windows",
      "window_design_type",
      "window_material_type",
      "window_treatment_type",
      "is_finished",
      "furnished",
      "paint_condition",
      "flooring_wear",
      "clutter_level",
      "visible_damage",
      "countertop_material",
      "cabinet_style",
      "fixture_finish_quality",
      "design_style",
      "natural_light_quality",
      "decor_elements",
      "pool_type",
      "pool_equipment",
      "spa_type",
      "safety_features",
      "view_type",
      "lighting_features",
      "condition_issues",
      "is_exterior",
      "pool_condition",
      "pool_surface_type",
      "pool_water_quality",
      "bathroom_renovation_date",
      "kitchen_renovation_date",
      "flooring_installation_date",
    ];
    for (const k of requiredKeys) {
      if (!(k in out)) out[k] = null;
    }
    const fname = `layout_${i}.json`;
    writeJSON(fname, out);
    files.push(fname);
    i++;
  }
  return files;
}

function detectFileFormatFromUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  return null;
}

function buildFiles(input) {
  const files = [];
  const urls = [
    { url: input.primaryParcelImageUrl, name: "PrimaryParcelImage" },
    { url: input.footprintImageUrl, name: "FootprintImage" },
    { url: input.mapImageUrl, name: "ParcelMapImage" },
  ];
  let idx = 1;
  for (const item of urls) {
    if (!item.url) continue;
    const fmt = detectFileFormatFromUrl(item.url);
    const doc = {
      file_format: fmt,
      name: item.name,
      original_url: item.url,
      ipfs_url: null,
      document_type: "PropertyImage",
    };
    const fname = `file_${idx}.json`;
    writeJSON(fname, doc);
    files.push(fname);
    idx++;
  }
  return files;
}

function main() {
  try {
    ensureDir("data");
    const input = readJSON("input.json");
    const uaddr = readJSON("unnormalized_address.json");
    const seed = readJSON("property_seed.json");

    const ownerData = readJSON(path.join("owners", "owner_data.json"));
    const utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
    const layoutData = readJSON(path.join("owners", "layout_data.json"));

    // Build items
    buildProperty(input);
    buildAddress(input, uaddr);

    // Tax current and previous if available
    if (input.taxYear) buildTaxForYear(input, input.taxYear);
    if (input.previousTaxYear) buildTaxForYear(input, input.previousTaxYear);

    buildFlood(input);
    buildStructure(input);
    buildLot(input);

    // Owners from owners/owner_data.json using parcelNumber
    buildOwners(ownerData, input.parcelNumber);

    // Utilities from utilities_data.json using apprId
    buildUtility(utilitiesData, input.apprId);

    // Layouts from layout_data.json using apprId
    buildLayouts(layoutData, input.apprId);

    // Files from image/map URLs in input.json
    buildFiles(input);
  } catch (e) {
    if (e && e.type === "error") {
      console.error(JSON.stringify(e));
      process.exit(1);
    } else {
      console.error(e);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}
