const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  const s = fs.readFileSync(p, "utf8");
  return JSON.parse(s);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listFiles(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
}

function removeIfExists(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (e) {}
}

function parseCurrencyToNumber(str) {
  if (!str && str !== 0) return null;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

function parseISOFromMDY(str) {
  if (!str) return null;
  const m = String(str)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function suffixToEnum(sfx) {
  if (!sfx) return null;
  const map = {
    LN: "Ln",
    RD: "Rd",
    ST: "St",
    AVE: "Ave",
    AV: "Ave",
    BLVD: "Blvd",
    DR: "Dr",
    HWY: "Hwy",
    TER: "Ter",
    PL: "Pl",
    CT: "Ct",
    WAY: "Way",
    PKWY: "Pkwy",
  };
  const up = sfx.toUpperCase();
  return map[up] || (up[0] ? up[0] + up.slice(1).toLowerCase() : null);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function normalizeName(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .replace(/^\*/, "")
    .replace(/\s+&$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function joinPersonName(p) {
  const parts = [];
  if (p.first_name) parts.push(p.first_name);
  if (p.middle_name) parts.push(p.middle_name);
  if (p.last_name) parts.push(p.last_name);
  return normalizeName(parts.join(" "));
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);
  // Clean generated files to avoid stale
  listFiles(dataDir).forEach((f) => {
    if (
      /^relationship_.*\.json$/.test(f) ||
      /^sales_\d+\.json$/.test(f) ||
      /^deed_\d+\.json$/.test(f) ||
      /^file_\d+\.json$/.test(f) ||
      /^tax_\d+\.json$/.test(f) ||
      /^person_\d+\.json$/.test(f) ||
      /^company_\d+\.json$/.test(f)
    )
      removeIfExists(path.join(dataDir, f));
  });

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const unaddr = readJSON("unnormalized_address.json");
  const propertySeed = readJSON("property_seed.json");

  let ownersData = null,
    utilitiesData = null,
    layoutData = null;
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch {}
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch {}
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch {}

  // Address
  const fullAddr = unaddr && unaddr.full_address ? unaddr.full_address : null;
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null;
  if (fullAddr) {
    const parts = fullAddr.split(",");
    const line1 = (parts[0] || "").trim();
    const city = (parts[1] || "").trim();
    const stateZip = (parts[2] || "").trim();
    const toks1 = line1.split(/\s+/);
    if (toks1.length >= 2) {
      street_number = toks1[0];
      const suffixCandidate = toks1[toks1.length - 1];
      street_suffix_type = suffixToEnum(suffixCandidate);
      street_name = toks1
        .slice(1, street_suffix_type ? toks1.length - 1 : toks1.length)
        .join(" ");
    }
    city_name = city ? city.toUpperCase() : null;
    const m = stateZip.match(/^([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/);
    if (m) {
      state_code = m[1];
      postal_code = m[2];
      plus4 = m[3] || null;
    }
  }
  // Parse section/block/lot from legal description
  const legalDesc =
    $(
      'section#ctlBodyPane_ctl02_mSection .module-content table.tabular-data-two-column tr:contains("Brief Tax Description") td',
    )
      .eq(1)
      .find("span")
      .first()
      .text()
      .trim() || null;
  let sectionVal = null,
    blockVal = null,
    lotVal = null;
  if (legalDesc) {
    const mSec = legalDesc.match(/SECTION\s+(\d+)/i);
    if (mSec) sectionVal = mSec[1];
    const mBlk = legalDesc.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (mBlk) blockVal = mBlk[1];
    const mLot = legalDesc.match(/LOT\s+([A-Z0-9]+)/i);
    if (mLot) lotVal = mLot[1];
  }

  const address = {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: null,
    county_name: "Flagler",
    state_code: state_code || "FL",
    country_code: "US",
    postal_code: postal_code || null,
    plus_four_postal_code: plus4 || null,
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: sectionVal,
    block: blockVal,
    lot: lotVal,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // Property
  const parcelId =
    $(
      'section#ctlBodyPane_ctl02_mSection .module-content table.tabular-data-two-column tr:contains("Parcel ID") td',
    )
      .eq(1)
      .text()
      .trim() || null;
  const heatedAreaStr = $(
    'section#ctlBodyPane_ctl10_mSection .module-content #ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Heated Area") td',
  )
    .eq(1)
    .text()
    .trim();
  const totalAreaStr = $(
    'section#ctlBodyPane_ctl10_mSection .module-content #ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Total Area") td',
  )
    .eq(1)
    .text()
    .trim();
  const yearBuiltStr = $(
    'section#ctlBodyPane_ctl10_mSection .module-content #ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary tr:contains("Actual Year Built") td',
  )
    .eq(1)
    .text()
    .trim();
  const effYearBuiltStr = $(
    'section#ctlBodyPane_ctl10_mSection .module-content #ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary tr:contains("Effective Year Built") td',
  )
    .eq(1)
    .text()
    .trim();
  const useCodeText = $(
    'section#ctlBodyPane_ctl02_mSection .module-content table.tabular-data-two-column tr:contains("Property Use Code") td',
  )
    .eq(1)
    .text()
    .trim();
  const property = {
    parcel_identifier:
      parcelId || (propertySeed && propertySeed.parcel_id) || null,
    property_legal_description_text: legalDesc || null,
    livable_floor_area: heatedAreaStr
      ? heatedAreaStr.replace(/[^0-9]/g, "")
      : null,
    total_area: totalAreaStr ? totalAreaStr.replace(/[^0-9]/g, "") : null,
    area_under_air: heatedAreaStr ? heatedAreaStr.replace(/[^0-9]/g, "") : null,
    property_structure_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr, 10)
      : null,
    property_effective_built_year: effYearBuiltStr
      ? parseInt(effYearBuiltStr, 10)
      : null,
    property_type:
      useCodeText && /SINGLE\s*FAMILY/i.test(useCodeText)
        ? "SingleFamily"
        : "SingleFamily",
    number_of_units: 1,
    number_of_units_type: "One",
    subdivision:
      legalDesc && legalDesc.split(" BLOCK ")[0]
        ? legalDesc.split(" BLOCK ")[0]
        : null,
    zoning: null,
    historic_designation: false,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Lot (GIS sqft + driveway)
  const gisSqftStr = $(
    'section#ctlBodyPane_ctl02_mSection .module-content table.tabular-data-two-column tr:contains("GIS sqft") td',
  )
    .eq(1)
    .text()
    .trim();
  let lot_area_sqft = null;
  if (gisSqftStr) {
    const num = parseFloat(gisSqftStr.replace(/,/g, ""));
    if (!Number.isNaN(num)) lot_area_sqft = Math.floor(num);
  }
  let driveway_material = null;
  $("#ctlBodyPane_ctl14_ctl01_gvwExtraFeatures tbody tr").each((i, row) => {
    const tds = $(row).find("td");
    if (tds.length > 0) {
      const desc = tds.eq(0).text().trim();
      if (/CONC\s*DRWAY/i.test(desc)) driveway_material = "Concrete";
    }
  });
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft,
    lot_size_acre: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // Tax history
  const histTable = $("#ctlBodyPane_ctl06_ctl01_grdHistory");
  if (histTable.length) {
    histTable.find("tbody tr").each((i, row) => {
      const $row = $(row);
      const year = parseIntSafe($row.find("th").first().text().trim());
      if (!year) return;
      const tds = $row.find("td");
      const building = parseCurrencyToNumber(tds.eq(0).text().trim());
      const land = parseCurrencyToNumber(tds.eq(2).text().trim());
      const market = parseCurrencyToNumber(tds.eq(4).text().trim());
      const assessed = parseCurrencyToNumber(tds.eq(5).text().trim());
      const taxable = parseCurrencyToNumber(tds.eq(7).text().trim());
      const tax = {
        tax_year: year,
        property_building_amount: building != null ? +building : null,
        property_land_amount: land != null ? +land : null,
        property_market_value_amount: market != null ? +market : null,
        property_assessed_value_amount: assessed != null ? +assessed : null,
        property_taxable_value_amount: taxable != null ? +taxable : null,
        monthly_tax_amount: null,
        yearly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        first_year_on_tax_roll: null,
        first_year_building_on_tax_roll: null,
      };
      writeJSON(path.join(dataDir, `tax_${year}.json`), tax);
    });
  }

  // Sales extraction: exclude rows with book/page 0 (e.g., CONVERSION)
  const salesRows = [];
  $("#ctlBodyPane_ctl15_ctl01_grdSales tbody tr").each((i, row) => {
    const $row = $(row);
    const dateISO = parseISOFromMDY($row.find("th").first().text().trim());
    const price = parseCurrencyToNumber($row.find("td").eq(0).text().trim());
    const tds = $row.find("td");
    const book = tds.eq(2).text().trim() || "";
    const page = tds.eq(3).text().trim() || "";
    let clerkUrl = null;
    const onclick = tds.eq(7).find('input[type="button"]').attr("onclick");
    if (onclick) {
      const m = onclick.match(/window\.open\('(.*?)'\)/);
      if (m) clerkUrl = m[1];
    }
    if (!dateISO) return;
    if (book === "0" && page === "0") return; // exclude conversion/no-record row
    salesRows.push({
      dateISO,
      price: price == null ? 0 : price,
      book,
      page,
      clerkUrl,
    });
  });

  // Create sales files (sorted ascending)
  salesRows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const saleDateToIndex = new Map();
  const saleBookPageToIndex = new Map();
  salesRows.forEach((r, idx) => {
    const s = {
      ownership_transfer_date: r.dateISO,
      purchase_price_amount: +r.price,
    };
    const fname = `sales_${idx + 1}.json`;
    writeJSON(path.join(dataDir, fname), s);
    saleDateToIndex.set(r.dateISO, idx + 1);
    if (r.book && r.page)
      saleBookPageToIndex.set(`${r.book}|${r.page}`, idx + 1);
  });

  // Structure (incl. flooring)
  const extWalls = $(
    '#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Exterior Walls") td',
  )
    .eq(1)
    .text()
    .trim();
  const roofCover = $(
    '#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Roof Cover") td',
  )
    .eq(1)
    .text()
    .trim();
  const intWalls = $(
    '#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Interior Walls") td',
  )
    .eq(1)
    .text()
    .trim();
  const frameType = $(
    '#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary tr:contains("Frame Type") td',
  )
    .eq(1)
    .text()
    .trim();
  const floorCover = $(
    '#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary tr:contains("Floor Cover") td',
  )
    .eq(1)
    .text()
    .trim();
  function mapExteriorWallPrimary(v) {
    if (!v) return null;
    if (/STUCCO/i.test(v)) return "Stucco";
    if (/BRICK/i.test(v)) return "Brick";
    if (/CONCRETE BLOCK|CON\.BLOCK|BLOCK/i.test(v)) return "Concrete Block";
    return null;
  }
  function mapRoofMaterialType(v) {
    if (!v) return null;
    if (/ASP|COM/i.test(v)) return "Shingle";
    if (/METAL/i.test(v)) return "Metal";
    if (/TILE/i.test(v)) return "Tile";
    return null;
  }
  function mapRoofCoveringMaterial(v) {
    if (!v) return null;
    if (/ASP|COM/i.test(v)) return "3-Tab Asphalt Shingle";
    return null;
  }
  function mapInteriorWallSurfacePrimary(v) {
    if (!v) return null;
    if (/DRYWALL/i.test(v)) return "Drywall";
    if (/PLASTER/i.test(v)) return "Plaster";
    return null;
  }
  function mapPrimaryFraming(v) {
    if (!v) return null;
    if (/MASONRY/i.test(v)) return "Masonry";
    if (/WOOD/i.test(v)) return "Wood Frame";
    if (/STEEL/i.test(v)) return "Steel Frame";
    return null;
  }
  function mapFlooring(v) {
    if (!v) return { primary: null, secondary: null };
    const hasCarpet = /CARPET/i.test(v);
    const hasCeramic = /(CERA|CERAM|TILE)/i.test(v);
    return {
      primary: hasCarpet ? "Carpet" : hasCeramic ? "Ceramic Tile" : null,
      secondary: hasCarpet && hasCeramic ? "Ceramic Tile" : null,
    };
  }
  const floorMap = mapFlooring(floorCover);
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: mapExteriorWallPrimary(extWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: floorMap.primary,
    flooring_material_secondary: floorMap.secondary,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      mapInteriorWallSurfacePrimary(intWalls),
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: mapRoofCoveringMaterial(roofCover),
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
    primary_framing_material: mapPrimaryFraming(frameType),
    secondary_framing_material: null,
    structural_damage_indicators: null,
    finished_base_area: heatedAreaStr
      ? parseInt(heatedAreaStr.replace(/[^0-9]/g, ""), 10)
      : null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    finished_basement_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_door_installation_date: null,
    siding_installation_date: null,
    window_installation_date: null,
    roof_date: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utilities
  if (utilitiesData && utilitiesData.property_30708) {
    const u = utilitiesData.property_30708;
    const utility = {
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
      water_heater_installation_date: u.water_heater_installation_date ?? null,
      water_heater_manufacturer: u.water_heater_manufacturer ?? null,
      water_heater_model: u.water_heater_model ?? null,
    };
    writeJSON(path.join(dataDir, "utility.json"), utility);
  }

  // Layouts
  if (
    layoutData &&
    layoutData.property_30708 &&
    Array.isArray(layoutData.property_30708.layouts)
  ) {
    layoutData.property_30708.layouts.forEach((L, i) => {
      const layout = {
        space_type: L.space_type ?? null,
        space_index: L.space_index,
        flooring_material_type: L.flooring_material_type ?? null,
        size_square_feet: L.size_square_feet ?? null,
        floor_level: L.floor_level ?? null,
        has_windows: L.has_windows ?? null,
        window_design_type: L.window_design_type ?? null,
        window_material_type: L.window_material_type ?? null,
        window_treatment_type: L.window_treatment_type ?? null,
        is_finished: L.is_finished ?? null,
        furnished: L.furnished ?? null,
        paint_condition: L.paint_condition ?? null,
        flooring_wear: L.flooring_wear ?? null,
        clutter_level: L.clutter_level ?? null,
        visible_damage: L.visible_damage ?? null,
        countertop_material: L.countertop_material ?? null,
        cabinet_style: L.cabinet_style ?? null,
        fixture_finish_quality: L.fixture_finish_quality ?? null,
        design_style: L.design_style ?? null,
        natural_light_quality: L.natural_light_quality ?? null,
        decor_elements: L.decor_elements ?? null,
        pool_type: L.pool_type ?? null,
        pool_equipment: L.pool_equipment ?? null,
        spa_type: L.spa_type ?? null,
        safety_features: L.safety_features ?? null,
        view_type: L.view_type ?? null,
        lighting_features: L.lighting_features ?? null,
        condition_issues: L.condition_issues ?? null,
        is_exterior: L.is_exterior ?? false,
        pool_condition: L.pool_condition ?? null,
        pool_surface_type: L.pool_surface_type ?? null,
        pool_water_quality: L.pool_water_quality ?? null,
        bathroom_renovation_date: L.bathroom_renovation_date ?? null,
        kitchen_renovation_date: L.kitchen_renovation_date ?? null,
        flooring_installation_date: L.flooring_installation_date ?? null,
        pool_installation_date: L.pool_installation_date ?? null,
        spa_installation_date: L.spa_installation_date ?? null,
      };
      writeJSON(path.join(dataDir, `layout_${i + 1}.json`), layout);
    });
  }

  // Owners and buyer relationships for latest sale only
  let ownersByDate = {},
    currentOwners = [];
  if (
    ownersData &&
    ownersData.property_30708 &&
    ownersData.property_30708.owners_by_date
  ) {
    ownersByDate = ownersData.property_30708.owners_by_date;
    currentOwners = Array.isArray(ownersByDate.current)
      ? ownersByDate.current
      : [];
  }
  const personIndexMap = new Map();
  const companyIndexMap = new Map();
  let personCounter = 0,
    companyCounter = 0;
  function addPerson(p) {
    const key = `${(p.first_name || "").trim().toUpperCase()}|${(p.middle_name || "").trim().toUpperCase()}|${(p.last_name || "").trim().toUpperCase()}`;
    if (personIndexMap.has(key)) return personIndexMap.get(key);
    personCounter++;
    const out = {
      first_name: p.first_name,
      middle_name: p.middle_name ?? null,
      last_name: p.last_name,
      prefix_name: null,
      suffix_name: null,
      birth_date: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const fname = `person_${personCounter}.json`;
    writeJSON(path.join(dataDir, fname), out);
    personIndexMap.set(key, fname);
    return fname;
  }
  function addCompany(c) {
    const key = (c.name || "").trim().toUpperCase();
    if (companyIndexMap.has(key)) return companyIndexMap.get(key);
    companyCounter++;
    const out = { name: c.name ?? null };
    const fname = `company_${companyCounter}.json`;
    writeJSON(path.join(dataDir, fname), out);
    companyIndexMap.set(key, fname);
    return fname;
  }
  // Pre-create current owners only (ensures single file per owner)
  currentOwners.forEach((o) => {
    if (o.type === "person") addPerson(o);
    else if (o.type === "company") addCompany(o);
  });
  // Link latest sale (last in sorted) to current owners
  if (salesRows.length) {
    const latest = salesRows[salesRows.length - 1];
    const idx = saleDateToIndex.get(latest.dateISO);
    if (idx) {
      let relP = 0,
        relC = 0;
      currentOwners.forEach((o) => {
        if (o.type === "person") {
          const pf = addPerson(o);
          relP++;
          writeJSON(
            path.join(dataDir, `relationship_sales_person_${relP}.json`),
            {
              to: { "/": `./${path.basename(pf)}` },
              from: { "/": `./sales_${idx}.json` },
            },
          );
        } else if (o.type === "company") {
          const cf = addCompany(o);
          relC++;
          writeJSON(
            path.join(dataDir, `relationship_sales_company_${relC}.json`),
            {
              to: { "/": `./${path.basename(cf)}` },
              from: { "/": `./sales_${idx}.json` },
            },
          );
        }
      });
    }
  }

  // Deeds and files
  let deedCounter = 0,
    fileCounter = 0,
    relDeedFileCounter = 0,
    relSalesDeedCounter = 0;
  const seenDeedKey = new Set();
  // From sales rows first
  salesRows.forEach((r) => {
    const key = `OR ${r.book} PG ${r.page}`;
    if (seenDeedKey.has(key)) return;
    seenDeedKey.add(key);
    deedCounter++;
    const deedName = `deed_${deedCounter}.json`;
    writeJSON(path.join(dataDir, deedName), {});
    if (r.clerkUrl) {
      fileCounter++;
      const fileName = `file_${fileCounter}.json`;
      writeJSON(path.join(dataDir, fileName), {
        file_format: "txt",
        name: key,
        original_url: r.clerkUrl,
        ipfs_url: null,
        document_type: "ConveyanceDeed",
      });
      relDeedFileCounter++;
      writeJSON(
        path.join(dataDir, `relationship_deed_file_${relDeedFileCounter}.json`),
        { to: { "/": `./${deedName}` }, from: { "/": `./${fileName}` } },
      );
    }
    const sIdx =
      saleBookPageToIndex.get(`${r.book}|${r.page}`) ||
      saleDateToIndex.get(r.dateISO);
    if (sIdx) {
      relSalesDeedCounter++;
      writeJSON(
        path.join(
          dataDir,
          `relationship_sales_deed_${relSalesDeedCounter}.json`,
        ),
        { to: { "/": `./sales_${sIdx}.json` }, from: { "/": `./${deedName}` } },
      );
    }
  });
  // From legal description refs
  if (legalDesc) {
    const re = /OR\s+(\d+)\s+PG\s+(\d+)/gi;
    let m;
    while ((m = re.exec(legalDesc))) {
      const book = m[1],
        page = m[2];
      const key = `OR ${book} PG ${page}`;
      if (seenDeedKey.has(key)) continue;
      seenDeedKey.add(key);
      deedCounter++;
      const deedName = `deed_${deedCounter}.json`;
      writeJSON(path.join(dataDir, deedName), {});
      fileCounter++;
      const synthUrl = `https://records.flaglerclerk.com/Document/GetDocumentByBookPage/?booktype=OR&booknumber=${book}&pagenumber=${page}`;
      const fileName = `file_${fileCounter}.json`;
      writeJSON(path.join(dataDir, fileName), {
        file_format: "txt",
        name: key,
        original_url: synthUrl,
        ipfs_url: null,
        document_type: "ConveyanceDeed",
      });
      relDeedFileCounter++;
      writeJSON(
        path.join(dataDir, `relationship_deed_file_${relDeedFileCounter}.json`),
        { to: { "/": `./${deedName}` }, from: { "/": `./${fileName}` } },
      );
      const sIdx = saleBookPageToIndex.get(`${book}|${page}`);
      if (sIdx) {
        relSalesDeedCounter++;
        writeJSON(
          path.join(
            dataDir,
            `relationship_sales_deed_${relSalesDeedCounter}.json`,
          ),
          {
            to: { "/": `./sales_${sIdx}.json` },
            from: { "/": `./${deedName}` },
          },
        );
      }
    }
  }

  // Files for TRIM Notice and Sketch
  const trimLink = $(
    "#ctlBodyPane_ctl08_ctl01_prtrFiles_ctl00_prtrFiles_Inner_ctl00_hlkName",
  ).attr("href");
  if (trimLink) {
    fileCounter++;
    const fileName = `file_${fileCounter}.json`;
    writeJSON(path.join(dataDir, fileName), {
      file_format: "txt",
      name: "2025 TRIM Notice (PDF)",
      original_url: trimLink,
      ipfs_url: null,
      document_type: "PropertyImage",
    });
  }
  const sketchImg = $("#sketchgrid img.rsImg").attr("src");
  if (sketchImg) {
    fileCounter++;
    const fileName = `file_${fileCounter}.json`;
    writeJSON(path.join(dataDir, fileName), {
      file_format: "png",
      name: "Building Sketch 1",
      original_url: sketchImg,
      ipfs_url: null,
      document_type: "PropertyImage",
    });
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete");
  } catch (e) {
    console.error("Extraction failed:", e.message);
    process.exit(1);
  }
}
