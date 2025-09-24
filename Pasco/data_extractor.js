/*
  Data extraction script per evaluator spec.
  - Reads: input.html, unnormalized_address.json, property_seed.json
  - Owners from owners/owner_data.json
  - Utilities from owners/utilities_data.json
  - Layout from owners/layout_data.json
  - All other data from input.html
  - Outputs JSON files to ./data

  Notes:
  - No schema validation, but adhere to schemas as much as possible.
  - Enums: If mapped value unknown, throw error in specified JSON format.
*/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const DATA_DIR = path.join(".", "data");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJSON(filePath) {
  return JSON.parse(readFile(filePath));
}

function writeJSON(filename, obj) {
  ensureDir(DATA_DIR);
  const full = path.join(DATA_DIR, filename);
  fs.writeFileSync(full, JSON.stringify(obj, null, 2), "utf8");
}

function throwEnumError(value, className, propName) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: `${className}.${propName}`,
  };
  throw new Error(JSON.stringify(err));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const clean = String(txt).replace(/[$,\s]/g, "");
  if (clean === "") return null;
  const n = Number(clean);
  if (Number.isNaN(n)) return null;
  return n;
}

function textOrNull(el) {
  if (!el || el.length === 0) return null;
  const t = el.text().trim();
  return t === "" ? null : t;
}

function normalizeSpace(s) {
  return s ? s.replace(/\s+/g, " ").trim() : s;
}

function parsePhysicalAddress(addrRaw) {
  if (!addrRaw) return null;
  let a = addrRaw.replace(/\u00A0/g, " "); // nbsp
  a = a
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
  // Expect format: "3310 WINDFIELD DRIVE, HOLIDAY, FL 34691"
  const parts = a
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const streetPart = parts[0];
  const city = parts[1].toUpperCase();
  const stateZip = parts[2].split(/\s+/);
  const state = stateZip[0].toUpperCase();
  const zip = (stateZip[1] || "").replace(/[^0-9]/g, "");

  const streetTokens = streetPart.split(/\s+/);
  const streetNumber = streetTokens.shift();
  const suffixWord =
    streetTokens.length > 0
      ? streetTokens[streetTokens.length - 1].toUpperCase()
      : null;
  let nameTokens = streetTokens.slice(0, -1);

  // If we cannot detect suffix word (e.g., unnormalized has no suffix), try to keep name intact
  let suffix = null;
  const suffixMap = {
    ST: "St",
    STREET: "St",
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    RD: "Rd",
    ROAD: "Rd",
    LN: "Ln",
    LANE: "Ln",
    DR: "Dr",
    DRIVE: "Dr",
    CT: "Ct",
    COURT: "Ct",
    PL: "Pl",
    PLACE: "Pl",
    TER: "Ter",
    TERRACE: "Ter",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    PKWY: "Pkwy",
    PARKWAY: "Pkwy",
    CIR: "Cir",
    CIRCLE: "Cir",
    WAY: "Way",
    LOOP: "Loop",
  };
  if (suffixWord && suffixMap[suffixWord]) {
    suffix = suffixMap[suffixWord];
  } else {
    // No recognizable suffix; all tokens are name
    nameTokens = streetTokens;
  }

  const streetName =
    nameTokens && nameTokens.length > 0 ? nameTokens.join(" ") : null;

  return {
    street_number: streetNumber || null,
    street_name: streetName || null,
    street_suffix_type: suffix || null,
    city_name: city || null,
    state_code: state || null,
    postal_code: zip || null,
  };
}

function mapPropertyTypeFromText(txt) {
  if (!txt) return null;
  const t = txt.toLowerCase();
  if (t.includes("single family")) return "SingleFamily";
  if (t.includes("duplex")) return "Duplex";
  if (t.includes("triplex") || t.includes("3 units")) return "3Units";
  if (t.includes("4 units")) return "4Units";
  if (t.includes("apartment")) return "Apartment";
  return null;
}

function extractSubdivision(legalDesc) {
  if (!legalDesc) return null;
  const pbIdx = legalDesc.indexOf(" PB ");
  if (pbIdx > 0) return legalDesc.substring(0, pbIdx).trim();
  const pbIdx2 = legalDesc.indexOf(" PLAT BOOK ");
  if (pbIdx2 > 0) return legalDesc.substring(0, pbIdx2).trim();
  return null;
}

function toIntOrNull(s) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^0-9.-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function toNumOrNull(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function upperFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizeMiddleName(m) {
  if (!m) return null;
  // Ensure pattern ^[A-Z][a-zA-Z\s\-',.]*$
  // Convert to uppercase initials/roman numerals common case
  return m.toString().trim().replace(/\s+/g, " ").toUpperCase();
}

function main() {
  ensureDir(DATA_DIR);

  const html = readFile("input.html");
  const $ = cheerio.load(html);
  const addrSeed = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const parcelId = textOrNull($("#lblParcelID"));
  if (!parcelId) {
    throw new Error("Parcel ID not found in input.html");
  }

  const ownersKey = `property_${parcelId}`;

  // PROPERTY
  const classification =
    textOrNull($("#lblDORClass")) || textOrNull($("#lblBuildingUse"));
  let property_type = mapPropertyTypeFromText(classification);
  if (!property_type) {
    // fallback to building use
    const useTxt = textOrNull($("#lblBuildingUse"));
    property_type = mapPropertyTypeFromText(useTxt);
  }
  if (!property_type) {
    // We require property_type; if not mappable, throw per enum rule
    throwEnumError(classification || "UNKNOWN", "property", "property_type");
  }

  let number_of_units_type = null;
  if (property_type === "SingleFamily") number_of_units_type = "One";
  else if (property_type === "Duplex") number_of_units_type = "Two";
  else if (property_type === "3Units") number_of_units_type = "Three";
  else if (property_type === "4Units") number_of_units_type = "Four";
  else number_of_units_type = "OneToFour";

  const yearBuilt = toIntOrNull(textOrNull($("#lblBuildingYearBuilt")));

  // Livable floor area: find LIVING AREA row in #tblSubLines
  let livableSqft = null;
  $("#tblSubLines tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 5) {
      const desc = $(tds[2]).text().trim().toUpperCase();
      if (desc.includes("LIVING AREA")) {
        livableSqft = $(tds[3]).text().trim();
      }
    }
  });
  if (livableSqft) livableSqft = livableSqft.replace(/[^0-9]/g, "");

  const legalDesc = textOrNull($("#lblLegalDescription"));
  const subdivision = extractSubdivision(legalDesc || undefined);

  // Zoning from Land Detail first row, 5th column
  let zoning = null;
  const landFirstRow = $("#tblLandLines tr").eq(1);
  if (landFirstRow && landFirstRow.length) {
    const tds = landFirstRow.find("td");
    if (tds.length >= 5) zoning = $(tds[4]).text().trim() || null;
  }

  const property = {
    parcel_identifier: parcelId,
    property_type,
    property_structure_built_year: yearBuilt || null,
    number_of_units_type,
    livable_floor_area: livableSqft ? String(livableSqft) : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
    zoning: zoning || null,
    number_of_units: number_of_units_type ? 1 : null,
    area_under_air: null,
    property_effective_built_year: null,
    total_area: null,
    historic_designation: undefined, // omit
  };
  writeJSON("property.json", property);

  // ADDRESS
  const physicalAddrRaw = textOrNull($("#lblPhysicalAddress"));
  const parsedAddr =
    parsePhysicalAddress(
      physicalAddrRaw || (addrSeed && addrSeed.full_address) || null,
    ) || {};

  // county from seed if present
  const county =
    addrSeed && addrSeed.county_jurisdiction
      ? addrSeed.county_jurisdiction
      : null;

  // Validate suffix enum if provided; if not mappable, leave null (allowed)
  const street_suffix_type = parsedAddr.street_suffix_type || null;
  if (street_suffix_type) {
    const allowed = new Set([
      "Rds",
      "Blvd",
      "Lk",
      "Pike",
      "Ky",
      "Vw",
      "Curv",
      "Psge",
      "Ldg",
      "Mt",
      "Un",
      "Mdw",
      "Via",
      "Cor",
      "Kys",
      "Vl",
      "Pr",
      "Cv",
      "Isle",
      "Lgt",
      "Hbr",
      "Btm",
      "Hl",
      "Mews",
      "Hls",
      "Pnes",
      "Lgts",
      "Strm",
      "Hwy",
      "Trwy",
      "Skwy",
      "Is",
      "Est",
      "Vws",
      "Ave",
      "Exts",
      "Cvs",
      "Row",
      "Rte",
      "Fall",
      "Gtwy",
      "Wls",
      "Clb",
      "Frk",
      "Cpe",
      "Fwy",
      "Knls",
      "Rdg",
      "Jct",
      "Rst",
      "Spgs",
      "Cir",
      "Crst",
      "Expy",
      "Smt",
      "Trfy",
      "Cors",
      "Land",
      "Uns",
      "Jcts",
      "Ways",
      "Trl",
      "Way",
      "Trlr",
      "Aly",
      "Spg",
      "Pkwy",
      "Cmn",
      "Dr",
      "Grns",
      "Oval",
      "Cirs",
      "Pt",
      "Shls",
      "Vly",
      "Hts",
      "Clf",
      "Flt",
      "Mall",
      "Frds",
      "Cyn",
      "Lndg",
      "Mdws",
      "Rd",
      "Xrds",
      "Ter",
      "Prt",
      "Radl",
      "Grvs",
      "Rdgs",
      "Inlt",
      "Trak",
      "Byu",
      "Vlgs",
      "Ctr",
      "Ml",
      "Cts",
      "Arc",
      "Bnd",
      "Riv",
      "Flds",
      "Mtwy",
      "Msn",
      "Shrs",
      "Rue",
      "Crse",
      "Cres",
      "Anx",
      "Drs",
      "Sts",
      "Holw",
      "Vlg",
      "Prts",
      "Sta",
      "Fld",
      "Xrd",
      "Wall",
      "Tpke",
      "Ft",
      "Bg",
      "Knl",
      "Plz",
      "St",
      "Cswy",
      "Bgs",
      "Rnch",
      "Frks",
      "Ln",
      "Mtn",
      "Ctrs",
      "Orch",
      "Iss",
      "Brks",
      "Br",
      "Fls",
      "Trce",
      "Park",
      "Gdns",
      "Rpds",
      "Shl",
      "Lf",
      "Rpd",
      "Lcks",
      "Gln",
      "Pl",
      "Path",
      "Vis",
      "Lks",
      "Run",
      "Frg",
      "Brg",
      "Sqs",
      "Xing",
      "Pln",
      "Glns",
      "Blfs",
      "Plns",
      "Dl",
      "Clfs",
      "Ext",
      "Pass",
      "Gdn",
      "Brk",
      "Grn",
      "Mnr",
      "Cp",
      "Pne",
      "Spur",
      "Opas",
      "Upas",
      "Tunl",
      "Sq",
      "Lck",
      "Ests",
      "Shr",
      "Dm",
      "Mls",
      "Wl",
      "Mnrs",
      "Stra",
      "Frgs",
      "Frst",
      "Flts",
      "Ct",
      "Mtns",
      "Frd",
      "Nck",
      "Ramp",
      "Vlys",
      "Pts",
      "Bch",
      "Loop",
      "Byp",
      "Cmns",
      "Fry",
      "Walk",
      "Hbrs",
      "Dv",
      "Hvn",
      "Blf",
      "Grv",
      "Crk",
      null,
    ]);
    if (!allowed.has(street_suffix_type)) {
      throwEnumError(street_suffix_type, "address", "street_suffix_type");
    }
  }

  const address = {
    street_number: parsedAddr.street_number || null,
    street_name: parsedAddr.street_name || null,
    street_suffix_type: street_suffix_type,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: parsedAddr.city_name || null,
    state_code: parsedAddr.state_code || null,
    postal_code: parsedAddr.postal_code || null,
    plus_four_postal_code: null,
    latitude: null,
    longitude: null,
    country_code: null,
    county_name: county || null,
    municipality_name: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
  };
  writeJSON("address.json", address);

  // LOT
  let lot_area_sqft = null;
  let lot_unitsType = null;
  if (landFirstRow && landFirstRow.length) {
    const tds = landFirstRow.find("td");
    if (tds.length >= 10) {
      const units = $(tds[5]).text().trim();
      lot_area_sqft = toIntOrNull(units);
      lot_unitsType = $(tds[6]).text().trim();
    }
  }
  const acres = toNumOrNull(textOrNull($("#lblAcres")));
  let lot_type = null;
  if (typeof acres === "number") {
    lot_type =
      acres <= 0.25
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  // Extra Features table to infer driveway material and fence type
  let driveway_material = null;
  let fencing_type = null;
  $("#tblXFLines tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const desc = $(tds[2]).text().trim().toUpperCase();
      if (desc.includes("DRVWAY") || desc.includes("SIDEWALK")) {
        driveway_material = "Concrete";
      }
      if (desc.includes("CHAIN LINK FENCE")) {
        fencing_type = "ChainLink";
      }
    }
  });

  const lot = {
    lot_type: lot_type || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft || null,
    lot_size_acre: acres || null,
    landscaping_features: null,
    view: null,
    fencing_type: fencing_type || null,
    fence_height: null,
    fence_length: null,
    driveway_material: driveway_material || null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON("lot.json", lot);

  // TAX (single year 2025)
  const valueJust = parseCurrencyToNumber($("#lblValueJust").text());
  const valueLand = parseCurrencyToNumber($("#lblValueLand").text());
  const valueBuilding = parseCurrencyToNumber($("#lblValueBuilding").text());
  const valueCountyAssessed = parseCurrencyToNumber(
    $("#lblCountyValueAssessed").text(),
  );
  const valueCountyTaxable = parseCurrencyToNumber(
    $("#lblValueCountyTaxable").text(),
  );
  // Determine tax year from the header note
  let taxYear = null;
  const valuesHeaderTxt = $("#parcelValueTable tr").first().text();
  const yearMatch =
    valuesHeaderTxt && valuesHeaderTxt.match(/for the\s+(\d{4})\s+tax year/i);
  if (yearMatch) taxYear = parseInt(yearMatch[1], 10);

  if (taxYear != null) {
    const tax = {
      tax_year: taxYear,
      property_assessed_value_amount:
        valueCountyAssessed != null ? valueCountyAssessed : null,
      property_market_value_amount: valueJust != null ? valueJust : null,
      property_building_amount: valueBuilding != null ? valueBuilding : null,
      property_land_amount: valueLand != null ? valueLand : null,
      property_taxable_value_amount:
        valueCountyTaxable != null ? valueCountyTaxable : null,
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(`tax_${taxYear}.json`, tax);
  }

  // STRUCTURE
  const stories = toNumOrNull(textOrNull($("#lblBuildingStories")));
  const ext1 = textOrNull($("#lblBuildingExteriorWall1"));
  const ext2 = textOrNull($("#lblBuildingExteriorWall2"));
  const roofStruct = textOrNull($("#lblBuildingRoofStructure"));
  const roofCover = textOrNull($("#lblBuildingRoofCover"));
  const intWall1 = textOrNull($("#lblBuildingInteriorWall1"));
  const floor1 = textOrNull($("#lblBuildingFlooring1"));

  let exterior_wall_material_primary = null;
  let exterior_wall_material_secondary = null;
  if (ext1) {
    const e = ext1.toLowerCase();
    if (e.includes("concrete block"))
      exterior_wall_material_primary = "Concrete Block";
    if (e.includes("stucco"))
      exterior_wall_material_secondary = "Stucco Accent";
    if (!exterior_wall_material_primary && e.includes("stucco"))
      exterior_wall_material_primary = "Stucco";
  }
  if (ext2 && ext2.toLowerCase() !== "none") {
    const e2 = ext2.toLowerCase();
    if (e2.includes("brick")) exterior_wall_material_secondary = "Brick Accent";
    if (e2.includes("stucco"))
      exterior_wall_material_secondary = "Stucco Accent";
    if (e2.includes("vinyl")) exterior_wall_material_secondary = "Vinyl Accent";
    if (e2.includes("wood")) exterior_wall_material_secondary = "Wood Trim";
    if (e2.includes("metal")) exterior_wall_material_secondary = "Metal Trim";
  }

  let interior_wall_surface_material_primary = null;
  if (intWall1) {
    const iw = intWall1.toLowerCase();
    if (iw.includes("plaster"))
      interior_wall_surface_material_primary = "Plaster";
    else if (iw.includes("drywall"))
      interior_wall_surface_material_primary = "Drywall";
  }

  let flooring_material_primary = null;
  if (floor1) {
    const f = floor1.toLowerCase();
    if (f.includes("carpet")) flooring_material_primary = "Carpet";
    else if (f.includes("tile")) flooring_material_primary = "Ceramic Tile";
    else if (f.includes("vinyl")) flooring_material_primary = "Sheet Vinyl";
    else if (f.includes("hardwood"))
      flooring_material_primary = "Solid Hardwood";
  }

  let roof_design_type = null;
  if (roofStruct) {
    const r = roofStruct.toLowerCase();
    if (r.includes("gable") && r.includes("hip"))
      roof_design_type = "Combination";
    else if (r.includes("gable")) roof_design_type = "Gable";
    else if (r.includes("hip")) roof_design_type = "Hip";
  }

  let roof_material_type = null;
  if (roofCover) {
    const rc = roofCover.toLowerCase();
    if (rc.includes("shingle")) roof_material_type = "Shingle";
    else if (rc.includes("metal")) roof_material_type = "Metal";
    else if (rc.includes("tile")) roof_material_type = "Tile";
  }

  let roof_covering_material = null; // unknown specificity

  const finished_base_area = livableSqft ? toIntOrNull(livableSqft) : null;

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exterior_wall_material_primary || null,
    exterior_wall_material_secondary: exterior_wall_material_secondary || null,
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
    roof_covering_material: roof_covering_material,
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
    primary_framing_material:
      exterior_wall_material_primary === "Concrete Block"
        ? "Concrete Block"
        : null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: stories || null,
    finished_base_area: finished_base_area || null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON("structure.json", structure);

  // UTILITIES from owners/utilities_data.json
  if (utilitiesData && utilitiesData[ownersKey]) {
    const u = utilitiesData[ownersKey];
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
    writeJSON("utility.json", utility);
  }

  // LAYOUT from owners/layout_data.json
  if (
    layoutData &&
    layoutData[ownersKey] &&
    Array.isArray(layoutData[ownersKey].layouts)
  ) {
    let li = 1;
    for (const lay of layoutData[ownersKey].layouts) {
      const layout = {
        space_type: lay.space_type ?? null,
        space_index: lay.space_index ?? null,
        flooring_material_type: lay.flooring_material_type ?? null,
        size_square_feet: lay.size_square_feet ?? null,
        floor_level: lay.floor_level ?? null,
        has_windows: lay.has_windows ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
        is_finished:
          typeof lay.is_finished === "boolean" ? lay.is_finished : null,
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
        is_exterior:
          typeof lay.is_exterior === "boolean" ? lay.is_exterior : null,
        pool_condition: lay.pool_condition ?? null,
        pool_surface_type: lay.pool_surface_type ?? null,
        pool_water_quality: lay.pool_water_quality ?? null,
      };
      writeJSON(`layout_${li}.json`, layout);
      li++;
    }
  }

  // OWNERS (persons only in this dataset). Build person files & relationships.
  const persons = [];
  const relationshipsSalesPersons = [];
  if (ownersData && ownersData[ownersKey]) {
    const ownersByDate = ownersData[ownersKey].owners_by_date || {};
    const currentOwners = Array.isArray(ownersByDate.current)
      ? ownersByDate.current
      : [];
    const historicalKeys = Object.keys(ownersByDate).filter(
      (k) => k !== "current",
    );

    // Build person objects
    let personIndex = 1;
    function addPerson(owner) {
      const p = {
        birth_date: null,
        first_name: owner.first_name ? upperFirst(owner.first_name) : null,
        last_name: owner.last_name ? upperFirst(owner.last_name) : null,
        middle_name: normalizeMiddleName(owner.middle_name || null),
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      const fname = `person_${personIndex}.json`;
      writeJSON(fname, p);
      persons.push({ file: fname, data: p });
      personIndex++;
      return fname;
    }

    const personFileByOwner = new Map();
    for (const o of currentOwners) {
      if (o.type === "person") {
        personFileByOwner.set(o, addPerson(o));
      }
    }
    for (const d of historicalKeys) {
      const ownersArr = ownersByDate[d] || [];
      for (const o of ownersArr) {
        if (o.type === "person") {
          personFileByOwner.set(o, addPerson(o));
        }
      }
    }

    // SALES extraction to construct relationships later
    const salesRows = [];
    $("#tblSaleLines tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length >= 6) {
        const monthYear = $(tds[0]).text().trim();
        const linkEl = $(tds[1]).find("a");
        const deedUrl =
          linkEl && linkEl.attr("href") ? linkEl.attr("href") : null;
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount });
      }
    });

    // Build sales, deed, file, and relationships
    let saleIdx = 1;
    let deedIdx = 1;
    let fileIdx = 1;

    const saleFileByYear = new Map();

    for (const row of salesRows) {
      // Create deed + file for any recognizable deed types
      let deedType = null;
      const dtype = row.deedTypeTxt ? row.deedTypeTxt.toLowerCase() : "";
      if (dtype.includes("warranty deed")) deedType = "Warranty Deed";
      else if (dtype.includes("quit")) deedType = "Quitclaim Deed";
      else if (dtype.includes("personal representative"))
        deedType = "Personal Representative Deed";
      else if (dtype.includes("grant deed")) deedType = "Grant Deed";
      // Build deed if we recognized the type
      let deedFileName = null;
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        writeJSON(deedFileName, { deed_type: deedType });
        deedIdx++;
      }

      // File reference
      if (deedType && row.deedUrl) {
        // Map document type enum for file
        let document_type = null;
        if (deedType === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deedType === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else document_type = "ConveyanceDeed";

        const fileObj = {
          document_type,
          file_format: null,
          name: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };
        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);
        // relationship: deed <- file
        if (deedFileName) {
          writeJSON(`relationship_deed_file_${fileIdx}.json`, {
            to: { "/": `./${deedFileName}` },
            from: { "/": `./${fileName}` },
          });
        }
        fileIdx++;
      }

      // SALES: only create sales when amount is a positive currency (>0)
      if (typeof row.amount === "number" && row.amount > 0) {
        const sale = {
          ownership_transfer_date: null, // month/year only; keep null
          purchase_price_amount: row.amount,
        };
        const saleName = `sales_${saleIdx}.json`;
        writeJSON(saleName, sale);
        // link sales -> deed if we created a deed for this row
        if (deedFileName) {
          writeJSON(`relationship_sales_deed_${saleIdx}.json`, {
            to: { "/": `./${saleName}` },
            from: { "/": `./${deedFileName}` },
          });
        }
        // Save by year for relationships to owners_by_date
        const yMatch =
          row.monthYear && row.monthYear.match(/(\d{1,2})\/(\d{4})/);
        if (yMatch) {
          const yr = yMatch[2];
          const key = `${yr}`;
          if (!saleFileByYear.has(key)) saleFileByYear.set(key, []);
          saleFileByYear.get(key).push(saleName);
        }
        saleIdx++;
      }
    }

    // Relationships: map current owners -> latest sale year (2020 pref if exists)
    function salesForYear(y) {
      return saleFileByYear.get(String(y)) || [];
    }

    // Current owners: assume they correspond to the most recent sale year present
    let availableYears = Array.from(saleFileByYear.keys())
      .map((s) => parseInt(s, 10))
      .sort((a, b) => b - a);
    if (currentOwners.length > 0 && availableYears.length > 0) {
      const latestYear = availableYears[0];
      const latestSales = salesForYear(latestYear);
      // link each current person to each sale in that year
      // Typically one sale, link both owners to that sale
      const targetSale = latestSales[0];
      if (targetSale) {
        let relIdx = 1;
        for (const o of currentOwners) {
          if (o.type === "person") {
            const pf = persons.find(
              (pp) =>
                pp.data.first_name === upperFirst(o.first_name) &&
                pp.data.last_name === upperFirst(o.last_name),
            );
            if (pf) {
              writeJSON(
                `relationship_sales_person_${relationshipsSalesPersons.length + 1}.json`,
                {
                  to: { "/": `./${pf.file}` },
                  from: { "/": `./${targetSale}` },
                },
              );
              relationshipsSalesPersons.push(1);
              relIdx++;
            }
          }
        }
      }
    }

    // Historical mapping for 2018 example
    for (const d of historicalKeys) {
      const year = d.split("-")[0];
      const salesInYear = salesForYear(year);
      if (salesInYear.length > 0) {
        const targetSale = salesInYear[0];
        const ownersArr = ownersByDate[d] || [];
        for (const o of ownersArr) {
          if (o.type === "person") {
            const pf = persons.find(
              (pp) =>
                pp.data.first_name === upperFirst(o.first_name) &&
                pp.data.last_name === upperFirst(o.last_name),
            );
            if (pf) {
              writeJSON(
                `relationship_sales_person_${relationshipsSalesPersons.length + 1}.json`,
                {
                  to: { "/": `./${pf.file}` },
                  from: { "/": `./${targetSale}` },
                },
              );
              relationshipsSalesPersons.push(1);
            }
          }
        }
      }
    }
  }

  // SALES without owner relationships already handled above. If no ownersData, still produce sales/deeds/files
  if (!(ownersData && ownersData[ownersKey])) {
    // Build sales basic if not already: extract and write
    const salesRows = [];
    $("#tblSaleLines tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length >= 6) {
        const monthYear = $(tds[0]).text().trim();
        const linkEl = $(tds[1]).find("a");
        const deedUrl =
          linkEl && linkEl.attr("href") ? linkEl.attr("href") : null;
        const deedTypeTxt = $(tds[2]).text().trim();
        const amount = parseCurrencyToNumber($(tds[5]).text());
        salesRows.push({ monthYear, deedUrl, deedTypeTxt, amount });
      }
    });

    let saleIdx = 1;
    let deedIdx = 1;
    let fileIdx = 1;
    for (const row of salesRows) {
      let deedType = null;
      const dtype = row.deedTypeTxt ? row.deedTypeTxt.toLowerCase() : "";
      if (dtype.includes("warranty deed")) deedType = "Warranty Deed";
      else if (dtype.includes("quit")) deedType = "Quitclaim Deed";
      else if (dtype.includes("personal representative"))
        deedType = "Personal Representative Deed";
      else if (dtype.includes("grant deed")) deedType = "Grant Deed";
      let deedFileName = null;
      if (deedType) {
        deedFileName = `deed_${deedIdx}.json`;
        writeJSON(deedFileName, { deed_type: deedType });
        deedIdx++;
      }
      if (deedType && row.deedUrl) {
        let document_type = null;
        if (deedType === "Warranty Deed")
          document_type = "ConveyanceDeedWarrantyDeed";
        else if (deedType === "Quitclaim Deed")
          document_type = "ConveyanceDeedQuitClaimDeed";
        else document_type = "ConveyanceDeed";
        const fileObj = {
          document_type,
          file_format: null,
          name: null,
          original_url: row.deedUrl,
          ipfs_url: null,
        };
        const fileName = `file_${fileIdx}.json`;
        writeJSON(fileName, fileObj);
        if (deedFileName) {
          writeJSON(`relationship_deed_file_${fileIdx}.json`, {
            to: { "/": `./${deedFileName}` },
            from: { "/": `./${fileName}` },
          });
        }
        fileIdx++;
      }
      if (typeof row.amount === "number" && row.amount > 0) {
        const sale = {
          ownership_transfer_date: null,
          purchase_price_amount: row.amount,
        };
        const saleName = `sales_${saleIdx}.json`;
        writeJSON(saleName, sale);
        if (deedFileName) {
          writeJSON(`relationship_sales_deed_${saleIdx}.json`, {
            to: { "/": `./${saleName}` },
            from: { "/": `./${deedFileName}` },
          });
        }
        saleIdx++;
      }
    }
  }
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  console.error(e.message || e.toString());
  process.exit(1);
}
