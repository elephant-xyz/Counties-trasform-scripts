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

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseUSD(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? null : num;
}

function toISODate(mdY) {
  if (!mdY) return null;
  const parts = mdY.split("/");
  if (parts.length !== 3) return null;
  const m = parts[0].padStart(2, "0");
  const d = parts[1].padStart(2, "0");
  const y = parts[2];
  return `${y}-${m}-${d}`;
}

function errorUnknownEnum(value, pathStr) {
  const errObj = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  throw new Error(JSON.stringify(errObj));
}

function firstSpanValueAfterHeaderPrecise($, sectionId, headerText) {
  const $section = $(sectionId);
  let out = null;
  $section.find("table.tabular-data-two-column tr").each((_, tr) => {
    const $tr = $(tr);
    const label = $tr.find("td strong").first().text().trim();
    if (label.toLowerCase() === headerText.toLowerCase()) {
      const $div = $tr.find('td div[id*="pnlSingleValue"]').first();
      const spanTxt = $div.find("span").first().text().trim();
      out = spanTxt || null;
    }
  });
  return out;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir("data");
  cleanDir("data");

  // Read inputs
  const html = fs.readFileSync("input.html", "utf8");
  const unnormalized = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners/utilities/layout from owners/ JSONs
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownerData = readJSON(ownersPath);
  const utilitiesData = readJSON(utilitiesPath);
  const layoutData = readJSON(layoutPath);

  const $ = cheerio.load(html);

  // Extract Parcel Summary values
  const parcelId =
    firstSpanValueAfterHeaderPrecise(
      $,
      "#ctlBodyPane_ctl02_mSection",
      "Parcel ID",
    ) ||
    seed.request_identifier ||
    seed.parcel_id;
  const propIdStr = firstSpanValueAfterHeaderPrecise(
    $,
    "#ctlBodyPane_ctl02_mSection",
    "Prop ID",
  );
  const propId = propIdStr ? parseInt(propIdStr.trim(), 10) : null;
  const locationAddressHtml = firstSpanValueAfterHeaderPrecise(
    $,
    "#ctlBodyPane_ctl02_mSection",
    "Location Address",
  );
  const locationAddress = locationAddressHtml
    ? locationAddressHtml
        .replace(/<br\s*\/?>(\s)*/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
  const briefDesc = firstSpanValueAfterHeaderPrecise(
    $,
    "#ctlBodyPane_ctl02_mSection",
    "Brief Tax Description*",
  );
  const useCode = firstSpanValueAfterHeaderPrecise(
    $,
    "#ctlBodyPane_ctl02_mSection",
    "Property Use Code",
  );

  // Extract Residential Buildings
  const resSection = "#ctlBodyPane_ctl10_mSection";
  const totalArea = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Total Area",
  );
  const heatedArea = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Heated Area",
  );
  const exteriorWalls = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Exterior Walls",
  );
  const roofCover = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Roof Cover",
  );
  const interiorWalls = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Interior Walls",
  );
  const frameType = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Frame Type",
  );
  const actualYearBuiltStr = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Actual Year Built",
  );
  const effectiveYearBuiltStr = firstSpanValueAfterHeaderPrecise(
    $,
    resSection,
    "Effective Year Built",
  );

  const property_structure_built_year = actualYearBuiltStr
    ? parseInt(actualYearBuiltStr, 10)
    : null;
  const property_effective_built_year = effectiveYearBuiltStr
    ? parseInt(effectiveYearBuiltStr, 10)
    : null;

  // Building Area Types for base area
  let finished_base_area = null;
  $(
    "#ctlBodyPane_ctl13_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail tbody tr",
  ).each((_, tr) => {
    const tds = $(tr).find("td, th");
    if (tds.length >= 4) {
      const type = $(tds[0]).text().trim();
      const desc = $(tds[1]).text().trim();
      const sqft = $(tds[2]).text().trim();
      if (/^BAS$/i.test(type) || /BASE AREA/i.test(desc)) {
        finished_base_area = parseIntSafe(sqft);
      }
    }
  });

  // Extra Features for driveway material
  let driveway_material_from_features = null;
  $("#ctlBodyPane_ctl14_ctl01_gvwExtraFeatures tbody tr").each((_, tr) => {
    const tds = $(tr).find("td, th");
    if (tds.length >= 4) {
      const desc = $(tds[1]).text().trim();
      if (/CONC\s*DRWAY/i.test(desc)) {
        driveway_material_from_features = "Concrete";
      }
    }
  });

  // GIS sqft for lot area
  const gisSqftRaw = firstSpanValueAfterHeaderPrecise(
    $,
    "#ctlBodyPane_ctl02_mSection",
    "GIS sqft",
  );
  let lot_area_sqft = null;
  if (gisSqftRaw) {
    const f = parseFloat(gisSqftRaw.replace(/,/g, ""));
    if (!Number.isNaN(f)) lot_area_sqft = Math.round(f);
  }

  // Map property use to property_type enum
  function mapPropertyType(useCodeStr) {
    if (!useCodeStr) return null;
    const up = useCodeStr.toUpperCase();
    const label = up.split("(")[0].trim();
    if (label === "SINGLE FAMILY") return "SingleFamily";
    if (/SINGLE\s*FAM/.test(label)) return "SingleFamily";
    errorUnknownEnum(useCodeStr, "property.property_type");
  }
  const property_type = mapPropertyType(useCode || "");

  function mapUnitsType(pt) {
    if (!pt) return null;
    const map = {
      SingleFamily: "One",
      Duplex: "Two",
      "3Units": "Three",
      "4Units": "Four",
    };
    return map[pt] || null;
  }
  const number_of_units_type = mapUnitsType(property_type);

  // Subdivision attempt from legal description
  let subdivision = null;
  if (briefDesc) {
    const m = briefDesc.match(/^(.*?)(SECTION\s*\d+\b)/i);
    if (m) {
      subdivision = m[1].trim();
    } else {
      const n = briefDesc.match(/^(PALM COAST)/i);
      if (n) subdivision = n[1];
    }
  }

  // Address parsing from unnormalized_address
  const fullAddr =
    unnormalized && unnormalized.full_address
      ? unnormalized.full_address.trim()
      : locationAddress || "";
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null;
  if (fullAddr) {
    const parts = fullAddr.split(",");
    const part1 = (parts[0] || "").trim();
    const city = (parts[1] || "").trim();
    const stateZip = (parts[2] || "").trim();
    if (part1) {
      const p1 = part1.split(/\s+/);
      street_number = p1.shift() || null;
      const suffixRaw = p1.pop() || null;
      street_suffix_type = suffixRaw || null;
      street_name = p1.join(" ").trim() || null;
      const suffixMap = {
        LN: "Ln",
        LANE: "Ln",
        ST: "St",
        RD: "Rd",
        "RD.": "Rd",
        AVE: "Ave",
        AV: "Ave",
        BLVD: "Blvd",
        DR: "Dr",
        CT: "Ct",
        TER: "Ter",
        HWY: "Hwy",
        PKWY: "Pkwy",
        WAY: "Way",
        CIR: "Cir",
      };
      if (street_suffix_type) {
        const up = street_suffix_type.toUpperCase().replace(/\./g, "");
        if (suffixMap[up]) street_suffix_type = suffixMap[up];
        else errorUnknownEnum(street_suffix_type, "address.street_suffix_type");
      }
    }
    if (city) city_name = city.toUpperCase();
    if (stateZip) {
      const rs = stateZip.split(/\s+/);
      state_code = rs[0] || null;
      postal_code = rs[1] || null;
    }
  }

  const county_name = "Flagler";
  const country_code = "US";

  // Legal description parsing
  let section = null,
    block = null,
    lot = null;
  if (briefDesc) {
    const sm = briefDesc.match(/SECTION\s*(\d+)/i);
    if (sm) section = sm[1];
    const bm = briefDesc.match(/BLOCK\s*([0-9A-Z]+)/i);
    if (bm) block = bm[1];
    const lm = briefDesc.match(/LOT\s*([0-9A-Z]+)/i);
    if (lm) lot = lm[1];
  }

  let lot_type = null;
  if (lot_area_sqft != null) {
    lot_type =
      lot_area_sqft <= 10890
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  // Historical Assessment -> tax files per year
  const historyTable = $("#ctlBodyPane_ctl06_ctl01_grdHistory");
  const taxRows = [];
  historyTable.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td, th");
    if (tds.length >= 10) {
      const year = parseInt($(tds[0]).text().trim(), 10);
      const bldg = parseUSD($(tds[1]).text().trim());
      const land = parseUSD($(tds[3]).text().trim());
      const market = parseUSD($(tds[5]).text().trim());
      const assessed = parseUSD($(tds[6]).text().trim());
      const taxable = parseUSD($(tds[8]).text().trim());
      if (year && market != null)
        taxRows.push({ year, bldg, land, market, assessed, taxable });
    }
  });

  // Outputs
  const propertyOut = {
    parcel_identifier: parcelId,
    property_type: property_type,
    number_of_units_type: number_of_units_type,
    property_structure_built_year: property_structure_built_year,
    property_effective_built_year: property_effective_built_year,
    property_legal_description_text: briefDesc || null,
    livable_floor_area: heatedArea
      ? heatedArea.replace(/,/g, "")
      : finished_base_area != null
        ? String(finished_base_area)
        : null,
    total_area: totalArea ? totalArea.replace(/,/g, "") : null,
    area_under_air: heatedArea ? heatedArea.replace(/,/g, "") : null,
    number_of_units: number_of_units_type ? 1 : null,
    subdivision: subdivision || null,
    zoning: null,
    historic_designation: undefined,
  };
  writeJSON(path.join(dataDir, "property.json"), propertyOut);

  const addressOut = {
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
    plus_four_postal_code: null,
    county_name: county_name,
    country_code: country_code,
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: section || null,
    block: block || null,
    lot: lot || null,
  };
  writeJSON(path.join(dataDir, "address.json"), addressOut);

  const lotOut = {
    lot_type: lot_type || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft != null ? lot_area_sqft : null,
    lot_size_acre:
      lot_area_sqft != null
        ? Math.round((lot_area_sqft / 43560) * 100000) / 100000
        : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: driveway_material_from_features || null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lotOut);

  taxRows.forEach((tr) => {
    const taxOut = {
      tax_year: tr.year,
      property_assessed_value_amount: tr.assessed != null ? tr.assessed : null,
      property_market_value_amount: tr.market != null ? tr.market : null,
      property_building_amount: tr.bldg != null ? tr.bldg : null,
      property_land_amount: tr.land != null ? tr.land : null,
      property_taxable_value_amount: tr.taxable != null ? tr.taxable : null,
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${tr.year}.json`), taxOut);
  });

  function mapExteriorWallMaterial(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (up.includes("STUCCO")) return "Stucco";
    if (up.includes("BRICK")) return "Brick";
    if (up.includes("CONCRETE BLOCK") || up.includes("CONC. BLOCK"))
      return "Concrete Block";
    return null;
  }
  function mapInteriorWallSurface(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (up.includes("DRYWALL")) return "Drywall";
    if (up.includes("PLASTER")) return "Plaster";
    return null;
  }
  function mapFraming(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (up.includes("MASONRY")) return "Masonry";
    if (up.includes("WOOD")) return "Wood Frame";
    if (up.includes("STEEL")) return "Steel Frame";
    return null;
  }
  function mapFlooringPrimary(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (up.includes("CARPET")) return "Carpet";
    if (up.includes("CERA") || up.includes("CERAMIC")) return "Ceramic Tile";
    return null;
  }
  function mapFlooringSecondary(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (
      (up.includes("CER") || up.includes("TILE")) &&
      mapFlooringPrimary(str) === "Carpet"
    )
      return "Ceramic Tile";
    return null;
  }
  function mapRoofMaterialType(str) {
    if (!str) return null;
    const up = str.toUpperCase();
    if (up.includes("SH")) return "Shingle";
    if (up.includes("METAL")) return "Metal";
    return null;
  }

  const structureOut = {
    architectural_style_type: null,
    attachment_type: "Detached",
    exterior_wall_material_primary: mapExteriorWallMaterial(exteriorWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: mapFlooringPrimary(
      firstSpanValueAfterHeaderPrecise($, resSection, "Floor Cover"),
    ),
    flooring_material_secondary: mapFlooringSecondary(
      firstSpanValueAfterHeaderPrecise($, resSection, "Floor Cover"),
    ),
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      mapInteriorWallSurface(interiorWalls),
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
    roof_material_type: mapRoofMaterialType(roofCover),
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
    primary_framing_material: mapFraming(frameType),
    secondary_framing_material: null,
    structural_damage_indicators: null,
    finished_base_area:
      finished_base_area != null
        ? finished_base_area
        : heatedArea
          ? parseIntSafe(heatedArea)
          : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_door_installation_date: null,
    foundation_repair_date: null,
    roof_date: null,
    siding_installation_date: null,
    window_installation_date: null,
    number_of_stories: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structureOut);

  // utility.json from owners/utilities_data.json using Prop ID
  if (propId != null) {
    const utilKey = `property_${propId}`;
    const u = utilitiesData[utilKey] || null;
    if (u) {
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
        sewer_connection_date: u.sewer_connection_date ?? null,
        solar_installation_date: u.solar_installation_date ?? null,
        solar_inverter_installation_date:
          u.solar_inverter_installation_date ?? null,
        solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
        solar_inverter_model: u.solar_inverter_model ?? null,
        water_connection_date: u.water_connection_date ?? null,
        water_heater_installation_date:
          u.water_heater_installation_date ?? null,
        water_heater_manufacturer: u.water_heater_manufacturer ?? null,
        water_heater_model: u.water_heater_model ?? null,
        well_installation_date: u.well_installation_date ?? null,
      };
      writeJSON(path.join(dataDir, "utility.json"), utilityOut);
    }
  }

  // layout_*.json from owners/layout_data.json
  if (propId != null) {
    const layoutKey = `property_${propId}`;
    const ld = layoutData[layoutKey];
    if (ld && Array.isArray(ld.layouts)) {
      ld.layouts.forEach((lay, i) => {
        const layoutOut = {
          space_type: lay.space_type ?? null,
          space_index: lay.space_index,
          flooring_material_type: lay.flooring_material_type ?? null,
          size_square_feet: lay.size_square_feet ?? null,
          floor_level: lay.floor_level ?? null,
          has_windows: lay.has_windows ?? null,
          window_design_type: lay.window_design_type ?? null,
          window_material_type: lay.window_material_type ?? null,
          window_treatment_type: lay.window_treatment_type ?? null,
          is_finished: lay.is_finished,
          furnished: lay.furnished ?? null,
          paint_condition: lay.paint_condition ?? null,
          flooring_wear: lay.flooring_wear ?? null,
          clutter_level: lay.clutter_level ?? null,
          visible_damage: lay.visible_damage ?? null,
          countertop_material: lay.countertop_material ?? null,
          cabinet_style: lay.cabinet_style ?? null,
          fixture_finish_quality: lay.fixture_finish_quality ?? null,
          design_style: lay.design_style ?? null,
          natural_light_quality: lay.natural_light_quality ?? null,
          decor_elements: lay.decor_elements ?? null,
          pool_type: lay.pool_type ?? null,
          pool_equipment: lay.pool_equipment ?? null,
          spa_type: lay.spa_type ?? null,
          safety_features: lay.safety_features ?? null,
          view_type: lay.view_type ?? null,
          lighting_features: lay.lighting_features ?? null,
          condition_issues: lay.condition_issues ?? null,
          is_exterior: lay.is_exterior,
          pool_condition: lay.pool_condition ?? null,
          pool_surface_type: lay.pool_surface_type ?? null,
          pool_water_quality: lay.pool_water_quality ?? null,
          bathroom_renovation_date: lay.bathroom_renovation_date ?? null,
          kitchen_renovation_date: lay.kitchen_renovation_date ?? null,
          flooring_installation_date: lay.flooring_installation_date ?? null,
          spa_installation_date: lay.spa_installation_date ?? null,
          pool_installation_date: lay.pool_installation_date ?? null,
        };
        writeJSON(path.join(dataDir, `layout_${i + 1}.json`), layoutOut);
      });
    }
  }

  // sales extraction
  const sales = [];
  $("#ctlBodyPane_ctl15_ctl01_grdSales tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("th, td");
    if (cells.length >= 9) {
      const saleDate = $(cells[0]).text().trim();
      const price = $(cells[1]).text().trim();
      const book = $(cells[3]).text().trim();
      const page = $(cells[4]).text().trim();
      const btn = $(cells[8]).find('input[type="button"]');
      let recordUrl = null;
      if (btn.length) {
        const onclick = btn.attr("onclick") || "";
        const m = onclick.match(/window\.open\('([^']+)'\)/);
        if (m) recordUrl = m[1];
      }
      sales.push({
        dateIso: toISODate(saleDate),
        price: parseUSD(price),
        book: book || null,
        page: page || null,
        recordUrl,
      });
    }
  });

  // Write sales, deeds, files, relationships deeds/files
  const salesFiles = [];
  sales.forEach((s, i) => {
    const saleOut = {
      ownership_transfer_date: s.dateIso || null,
      purchase_price_amount: s.price != null ? s.price : null,
      sale_type: undefined,
    };
    const saleName = `sales_${i + 1}.json`;
    writeJSON(path.join(dataDir, saleName), saleOut);
    salesFiles.push({ name: saleName, date: s.dateIso });

    const deedOut = {};
    const deedName = `deed_${i + 1}.json`;
    writeJSON(path.join(dataDir, deedName), deedOut);

    const fileOut = {
      file_format: s.recordUrl ? "txt" : null,
      name:
        s.book && s.page
          ? `OR ${s.book}/${s.page}`
          : s.recordUrl
            ? "Official Record Link"
            : null,
      original_url: s.recordUrl || null,
      ipfs_url: null,
      document_type: null,
    };
    const fileName = `file_${i + 1}.json`;
    writeJSON(path.join(dataDir, fileName), fileOut);

    writeJSON(path.join(dataDir, `relationship_deed_file_${i + 1}.json`), {
      to: { "/": `./${deedName}` },
      from: { "/": `./${fileName}` },
    });
    writeJSON(path.join(dataDir, `relationship_sales_deed_${i + 1}.json`), {
      to: { "/": `./${saleName}` },
      from: { "/": `./${deedName}` },
    });
  });

  // Build persons and companies from owner_data
  const persons = [];
  const personIndex = new Map();
  function addPerson(first, middle, last) {
    const key = `${first}|${middle || ""}|${last}`;
    if (personIndex.has(key)) return personIndex.get(key);
    const idx =
      persons.push({
        first_name: first,
        middle_name: middle ?? null,
        last_name: last,
      }) - 1;
    personIndex.set(key, idx);
    return idx;
  }

  const companies = [];
  const companyIndex = new Map();
  function addCompany(name) {
    const key = name.trim();
    if (companyIndex.has(key)) return companyIndex.get(key);
    const idx = companies.push({ name }) - 1;
    companyIndex.set(key, idx);
    return idx;
  }

  if (propId != null) {
    const ownKey = `property_${propId}`;
    const od = ownerData[ownKey];
    if (od && od.owners_by_date) {
      Object.values(od.owners_by_date).forEach((v) => {
        if (Array.isArray(v)) {
          v.forEach((entry) => {
            if (entry.type === "person")
              addPerson(
                entry.first_name,
                entry.middle_name ?? null,
                entry.last_name,
              );
            if (entry.type === "company" && entry.name) addCompany(entry.name);
          });
        }
      });
    }
  }

  const personFiles = [];
  persons.forEach((p, i) => {
    const personOut = {
      birth_date: null,
      first_name: p.first_name,
      last_name: p.last_name,
      middle_name: p.middle_name ?? null,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const fname = `person_${i + 1}.json`;
    writeJSON(path.join(dataDir, fname), personOut);
    personFiles.push({ name: fname, ...p });
  });

  const companyFiles = [];
  companies.forEach((c, i) => {
    const compOut = { name: c.name || null };
    const fname = `company_${i + 1}.json`;
    writeJSON(path.join(dataDir, fname), compOut);
    companyFiles.push({ name: fname, ...c });
  });

  // Buyer relationships: for each sale, link to the earliest owners_by_date strictly after the sale date;
  // if none exists, link to current owners.
  if (propId != null) {
    const ownKey = `property_${propId}`;
    const od = ownerData[ownKey];
    if (od && od.owners_by_date) {
      const ownersByDate = od.owners_by_date;
      const ownerDateKeys = Object.keys(ownersByDate).filter(
        (k) => k !== "current",
      );
      const sortedOwnerDates = ownerDateKeys
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort();
      // sort sales by date
      const datedSales = salesFiles
        .filter((s) => s.date)
        .sort((a, b) => a.date.localeCompare(b.date));
      datedSales.forEach((s) => {
        // find earliest owner date > sale date
        const nextOwnerDate = sortedOwnerDates.find((d) => d > s.date);
        let buyers = null;
        if (nextOwnerDate) buyers = ownersByDate[nextOwnerDate];
        else if (ownersByDate["current"]) buyers = ownersByDate["current"];
        if (Array.isArray(buyers)) {
          buyers.forEach((b) => {
            if (b.type === "person") {
              const idx = personFiles.findIndex(
                (pp) =>
                  pp.first_name === b.first_name &&
                  pp.last_name === b.last_name &&
                  (pp.middle_name || null) === (b.middle_name || null),
              );
              if (idx >= 0) {
                const rel = {
                  to: { "/": `./person_${idx + 1}.json` },
                  from: { "/": `./${s.name}` },
                };
                writeJSON(
                  path.join(
                    dataDir,
                    `relationship_sales_person_${s.name.replace("sales_", "").replace(".json", "")}_${idx + 1}.json`,
                  ),
                  rel,
                );
              }
            } else if (b.type === "company" && b.name) {
              const cidx = companyFiles.findIndex(
                (cf) => (cf.name || "").toUpperCase() === b.name.toUpperCase(),
              );
              if (cidx >= 0) {
                const rel = {
                  to: { "/": `./company_${cidx + 1}.json` },
                  from: { "/": `./${s.name}` },
                };
                writeJSON(
                  path.join(
                    dataDir,
                    `relationship_sales_company_${s.name.replace("sales_", "").replace(".json", "")}_${cidx + 1}.json`,
                  ),
                  rel,
                );
              }
            }
          });
        }
      });
    }
  }
}

try {
  main();
  console.log("Extraction completed.");
} catch (e) {
  try {
    const obj = JSON.parse(String(e.message || e));
    if (obj && obj.type === "error") {
      console.error(JSON.stringify(obj));
      process.exit(1);
    } else {
      console.error(e);
      process.exit(1);
    }
  } catch (e2) {
    console.error(e);
    process.exit(1);
  }
}
