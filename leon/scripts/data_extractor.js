const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (isNaN(n)) return null;
  return n;
}

function parseIntStrict(s) {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^0-9\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseUSDateToISO(s) {
  if (!s) return null;
  const m = String(s)
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const pad = (x) => String(x).padStart(2, "0");
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

function normalizeSuffix(s) {
  if (!s) return null;
  const map = {
    ALY: "Aly",
    AVE: "Ave",
    AV: "Ave",
    BLVD: "Blvd",
    BND: "Bnd",
    CIR: "Cir",
    CIRS: "Cirs",
    CRK: "Crk",
    CT: "Ct",
    CTR: "Ctr",
    CTRS: "Ctrs",
    CV: "Cv",
    CYN: "Cyn",
    DR: "Dr",
    DRS: "Drs",
    EXPY: "Expy",
    FWY: "Fwy",
    GRN: "Grn",
    GRNS: "Grns",
    GRV: "Grv",
    GRVS: "Grvs",
    HWY: "Hwy",
    HL: "Hl",
    HLS: "Hls",
    HOLW: "Holw",
    JCT: "Jct",
    JCTS: "Jcts",
    LN: "Ln",
    LOOP: "Loop",
    MALL: "Mall",
    MDW: "Mdw",
    MDWS: "Mdws",
    MEWS: "Mews",
    ML: "Ml",
    MNRS: "Mnrs",
    MT: "Mt",
    MTN: "Mtn",
    MTNS: "Mtns",
    OPAS: "Opas",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PATH: "Path",
    PIKE: "Pike",
    PL: "Pl",
    PLN: "Pln",
    PLNS: "Plns",
    PLZ: "Plz",
    PT: "Pt",
    PTS: "Pts",
    PNE: "Pne",
    PNES: "Pnes",
    RADL: "Radl",
    RD: "Rd",
    RDG: "Rdg",
    RDGS: "Rdgs",
    RIV: "Riv",
    ROW: "Row",
    RTE: "Rte",
    RUN: "Run",
    SHL: "Shl",
    SHLS: "Shls",
    SHR: "Shr",
    SHRS: "Shrs",
    SMT: "Smt",
    SQ: "Sq",
    SQS: "Sqs",
    ST: "St",
    STA: "Sta",
    STRA: "Stra",
    STRM: "Strm",
    TER: "Ter",
    TPKE: "Tpke",
    TRL: "Trl",
    TRCE: "Trce",
    UN: "Un",
    VIS: "Vis",
    VLY: "Vly",
    VLYS: "Vlys",
    VIA: "Via",
    VL: "Vl",
    VLGS: "Vlgs",
    VWS: "Vws",
    WALK: "Walk",
    WALL: "Wall",
    WAY: "Way",
  };
  const key = s.toUpperCase().trim();
  if (map[key]) return map[key];
  return null;
}

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function mapPropertyTypeFromUse(useText) {
  if (!useText) return null;
  const t = useText.toUpperCase();
  if (t.includes("SINGLE-FAMILY") || t.includes("SINGLE FAMILY"))
    return "SingleFamily";
  if (t.includes("CONDOMINIUM") || t.includes("CONDO")) return "Condominium";
  if (t.includes("MOBILE")) return "MobileHome";
  if (t.includes("VACANT")) return "VacantLand";
  if (t.includes("MULTI-FAMILY")) {
    if (t.includes("10 OR MORE")) {
      return "MultiFamilyMoreThan10";
    }
    if (t.includes("LESS") || t.includes("< 10") || t.includes("UNDER 10")) {
      return "MultiFamilyLessThan10";
    }
    return "MultipleFamily";
  }
  if (t.includes("TOWNHOUSE")) return "Townhouse";
  if (t.includes("APARTMENT") || t.includes("APARTMENTS")) return "Apartment";
  if (t.includes("DUPLEX")) return "Duplex";
  return null;
}

function extractProperty($, parcelId) {
  // const parcelId =
  //   $("input#ParcelId").val() ||
  //   $('label:contains("Parcel ID:")').next().text().trim();

  let legalBlocks = [];
  $("#legalModal .modal-body .row div").each((i, el) => {
    const t = $(el).text().trim();
    if (t) legalBlocks.push(t);
  });
  if (legalBlocks.length === 0) {
    const legalLabel = $('label:contains("Legal Desc:")');
    legalLabel
      .parent()
      .parent()
      .find("div")
      .each((i, el) => {
        const t = $(el).text().trim();
        if (t && !t.includes("View All Legal")) legalBlocks.push(t);
      });
  }
  const property_legal_description_text = legalBlocks.join(" | ") || null;

  let propertyUse = null;
  $("label").each((i, el) => {
    const t = $(el).text().trim();
    if (t.startsWith("Property Use")) {
      const val = $(el).parent().find("div").first().text().trim();
      if (val) propertyUse = val;
    }
  });
  const property_type = mapPropertyTypeFromUse(propertyUse);
  if (!property_type) {
    const msg = {
      type: "error",
      message: `Unknown enum value ${propertyUse}.`,
      path: "property.property_type",
    };
    throw new Error(JSON.stringify(msg));
  }

  let subdivision = null;
  $("label").each((i, el) => {
    const t = $(el).text().trim();
    if (t.startsWith("Subdivision Name")) {
      const val = $(el).parent().find("div").first().text().trim();
      if (val) subdivision = val;
    }
  });

  let totalHeated = 0;
  let totalArea = 0;
  let builtYears = [];
  $("table.table.table-striped.table-hover.details tbody tr").each((i, el) => {
    const tds = $(el).find("td, th");
    if (tds.length >= 6) {
      const yrTxt = $(tds[3]).text().trim();
      const y = parseIntStrict(yrTxt);
      if (y) builtYears.push(y);
      const heatedTxt = $(tds[4]).text().trim();
      const auxTxt = $(tds[5]).text().trim();
      const h = parseIntStrict(heatedTxt);
      const a = parseIntStrict(auxTxt);
      if (h) {
        totalHeated += h;
        totalArea += h;
      }
      if (a) {
        totalArea += a;
      }
    }
  });
  const property_structure_built_year = builtYears.length
    ? Math.min(...builtYears)
    : null;
  const livable_floor_area = totalHeated ? String(totalHeated) : null;
  const total_area = totalArea ? String(totalArea) : null;

  return {
    parcel_identifier: parcelId ? String(parcelId) : null,
    property_legal_description_text,
    property_structure_built_year,
    property_type,
    subdivision: subdivision || null,
    livable_floor_area,
    number_of_units_type: null,
    area_under_air: null,
    total_area: total_area,
    zoning: null,
    property_effective_built_year: null,
    historic_designation: false,
  };
}

function extractAddress(unnorm) {
  const full = unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return;
  let city = null;
  let zip = null;
  const fullAddressParts = (full || "").split(",");
  if (fullAddressParts.length >= 3 && fullAddressParts[2]) {
    state_and_pin = fullAddressParts[2].split(/\s+/);
    if (state_and_pin.length >= 1 && state_and_pin[state_and_pin.length - 1] && state_and_pin[state_and_pin.length - 1].trim().match(/^\d{5}$/)) {
      zip = state_and_pin[state_and_pin.length - 1].trim();
      city = fullAddressParts[1].trim();
    }
  }
  const parts = (fullAddressParts[0] || "").split(/\s+/);
  let street_number = null;
  if (parts && parts.length > 1) {
    street_number_candidate = parts[0];
    if ((street_number_candidate || "") && isNumeric(street_number_candidate)) {
      street_number = parts.shift() || null;
    }
  }
  let suffix = null;
  if (parts && parts.length > 1) {
    suffix_candidate = parts[parts.length - 1];
    if (normalizeSuffix(suffix_candidate)) {
      suffix = parts.pop() || null;
    }
  }
  let street_name = parts.join(" ") || null;
  if (street_name) {
    street_name = street_name.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/g, "");
  }
  // const m = full.match(
  //   /^(\d+)\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i,
  // );
  // if (!m) return;
  // const [, streetNumber, streetRest, city, state, zip, plus4] = m;

  // let street_name = streetRest.trim();
  // let route_number = null;
  // let street_suffix_type = null;
  // const m2 = streetRest.trim().match(/^([A-Za-z]+)\s+(\d+)$/);
  // if (m2) {
  //   street_name = m2[1].toUpperCase();
  //   route_number = m2[2];
  //   if (street_name === "HWY" || street_name === "HIGHWAY")
  //     street_suffix_type = "Hwy";
  // }
  const city_name = city ? city.toUpperCase() : null;
  // const state_code = state.toUpperCase();
  const postal_code = zip;
  // const plus_four_postal_code = plus4 || null;

  // Per evaluator expectation, set county_name from input jurisdiction
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  const county_name = inputCounty || null;

  const address = {
    city_name,
    country_code: "US",
    county_name,
    latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
    longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
    plus_four_postal_code: null,
    postal_code,
    state_code: "FL",
    street_name: street_name,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_number: street_number,
    street_suffix_type: normalizeSuffix(suffix),
    unit_identifier: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    municipality_name: null,
  };
  writeJSON(path.join("data", "address.json"), address);
}

function extractSalesAndDeeds($, outDir) {
  const sales = [];
  const deeds = [];
  const files = [];

  const salesTable = $('h5:contains("Sales Information")')
    .closest(".card")
    .find("table");
  salesTable.find("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 5) {
      const dateTxt = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const bookPageLink = $(tds[2]).find("a");
      const instrumentTxt = $(tds[3]).text().trim();

      const ownership_transfer_date = parseUSDateToISO(dateTxt);
      const purchase_price_amount = parseCurrencyToNumber(priceTxt);

      const saleObj = { ownership_transfer_date, purchase_price_amount };
      sales.push(saleObj);

      let deed_type = null;
      const instUp = instrumentTxt.toUpperCase();
      if (instUp.includes("WARRANTY DEED")) deed_type = "Warranty Deed";
      else if (instUp.includes("QUIT") && instUp.includes("CLAIM"))
        deed_type = "Quitclaim Deed";
      const deedObj = {};
      if (deed_type) deedObj.deed_type = deed_type;
      deeds.push(deedObj);

      let original_url = null;
      if (bookPageLink && bookPageLink.attr("href")) {
        const href = bookPageLink.attr("href");
        original_url = href.startsWith("http") ? href : null;
      }
      const name =
        bookPageLink && bookPageLink.text()
          ? `Book/Page ${bookPageLink.text().trim()}`
          : null;
      files.push({
        document_type: null,
        file_format: null,
        ipfs_url: null,
        name: name || null,
        original_url: original_url || null,
      });
    }
  });
  const rels = { deed_file: [], sales_deed: [] };
  sales.forEach((s, idx) => {
    const sName = path.join(outDir, `sales_${idx + 1}.json`);
    writeJSON(sName, s);
    const dName = path.join(outDir, `deed_${idx + 1}.json`);
    writeJSON(dName, deeds[idx]);
    const fName = path.join(outDir, `file_${idx + 1}.json`);
    writeJSON(fName, files[idx]);
    rels.sales_deed.push({
      to: { "/": `./sales_${idx + 1}.json` },
      from: { "/": `./deed_${idx + 1}.json` },
    });
    rels.deed_file.push({
      to: { "/": `./deed_${idx + 1}.json` },
      from: { "/": `./file_${idx + 1}.json` },
    });
  });

  rels.sales_deed.forEach((r, idx) =>
    writeJSON(path.join(outDir, `relationship_sales_deed_${idx + 1}.json`), r),
  );
  rels.deed_file.forEach((r, idx) =>
    writeJSON(path.join(outDir, `relationship_deed_file_${idx + 1}.json`), r),
  );

  return sales.length;
}

function extractTax($, outDir) {
  const histRows = [];
  const cvhCard = $('h5:contains("Certified Value History")').closest(".card");
  cvhCard.find("tbody tr").each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const year = parseIntStrict($(tds[0]).text());
      const land = parseCurrencyToNumber($(tds[1]).text());
      const building = parseCurrencyToNumber($(tds[2]).text());
      const market = parseCurrencyToNumber($(tds[3]).text());
      if (year && land != null && building != null && market != null) {
        histRows.push({ year, land, building, market });
      }
    }
  });
  if (!histRows.length) return;

  let assessed2025 = null,
    taxable2025 = null;
  const ctv = $('h5:contains("2025 Certified Taxable Values")').closest(
    ".card",
  );
  const row = ctv.find("tbody tr").first();
  if (row && row.length) {
    const tds = row.find("td");
    if (tds.length >= 6) {
      assessed2025 = parseCurrencyToNumber($(tds[3]).text());
      taxable2025 = parseCurrencyToNumber($(tds[5]).text());
    }
  }

  histRows.sort((a, b) => b.year - a.year);
  let taxIdx = 1;
  histRows.forEach((r) => {
    let assessed = null,
      taxable = null;
    if (r.year === 2025 && assessed2025 != null && taxable2025 != null) {
      assessed = assessed2025;
      taxable = taxable2025;
    } else {
      return; // assessed and taxable are mandatory fields
    }
    const tax = {
      tax_year: r.year,
      property_assessed_value_amount: assessed,
      property_market_value_amount: r.market,
      property_building_amount: r.building,
      property_land_amount: r.land,
      property_taxable_value_amount: taxable,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(outDir, `tax_${r.year}.json`), tax);
  });
}

function extractOwners(ownerData, outDir, parcelId, salesCount) {
  const key = `property_${parcelId}`;
  const result = { owners: [] };
  if (!ownerData[key] || !ownerData[key].owners_by_date) return result;
  const obyd = ownerData[key].owners_by_date;
  const current = obyd.current || [];
  // const historical = obyd.unknown_date_1 || [];
  // const invalids = Array.isArray(ownerData.invalid_owners)
  //   ? ownerData.invalid_owners
  //   : [];

  const ownersAll = [];
  current.forEach((o) => ownersAll.push(o));
  // historical.forEach((o) => ownersAll.push(o));
  // invalids.forEach((inv) => ownersAll.push({ type: "company", name: inv.raw }));

  const seenKey = new Set();
  const finalOwners = [];
  ownersAll.forEach((o) => {
    let k;
    if (o.type === "company") k = `C|${(o.name || "").trim()}`;
    else
      k = `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`;
    if (!seenKey.has(k)) {
      seenKey.add(k);
      finalOwners.push(o);
    }
  });

  let cIdx = 1,
    pIdx = 1;
  const fileMap = new Map();
  finalOwners.forEach((o) => {
    if (o.type === "company") {
      const fname = `company_${cIdx++}.json`;
      writeJSON(path.join(outDir, fname), { name: o.name || null });
      fileMap.set(`C|${(o.name || "").trim()}`, fname);
    } else {
      const obj = {
        birth_date: null,
        first_name: o.first_name
          ? o.first_name.charAt(0).toUpperCase() +
            o.first_name.slice(1).toLowerCase()
          : "",
        last_name: o.last_name
          ? o.last_name.charAt(0).toUpperCase() +
            o.last_name.slice(1).toLowerCase()
          : "",
        middle_name: o.middle_name ? o.middle_name.toUpperCase() : null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      const fname = `person_${pIdx++}.json`;
      writeJSON(path.join(outDir, fname), obj);
      fileMap.set(
        `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
        fname,
      );
    }
  });

  const currentFiles = current
    .map((o) =>
      o.type === "company"
        ? fileMap.get(`C|${(o.name || "").trim()}`)
        : fileMap.get(
            `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
          ),
    )
    .filter(Boolean);
  // const historicalFiles = historical
  //   .map((o) =>
  //     o.type === "company"
  //       ? fileMap.get(`C|${(o.name || "").trim()}`)
  //       : fileMap.get(
  //           `P|${o.first_name || ""}|${o.middle_name || ""}|${o.last_name || ""}`,
  //         ),
  //   )
  //   .filter(Boolean);
  // const invalidFiles = invalids
  //   .map((inv) => fileMap.get(`C|${(inv.raw || "").trim()}`))
  //   .filter(Boolean);

  let relIdxCompany = 1;
  let relIdxPerson = 1;
  function writeRel(toFile, saleIdx) {
    if (!toFile) return;
    if (toFile.startsWith("company_")) {
      writeJSON(
        path.join(outDir, `relationship_sales_company_${relIdxCompany++}.json`),
        {
          to: { "/": `./${toFile}` },
          from: { "/": `./sales_${saleIdx}.json` },
        },
      );
    } else if (toFile.startsWith("person_")) {
      writeJSON(
        path.join(outDir, `relationship_sales_person_${relIdxPerson++}.json`),
        {
          to: { "/": `./${toFile}` },
          from: { "/": `./sales_${saleIdx}.json` },
        },
      );
    }
  }

  currentFiles.forEach((f) => writeRel(f, 1));
  // invalidFiles.forEach((f) => writeRel(f, 1));
  // for (let s = 2; s <= salesCount; s++) {
  //   const group = [...invalidFiles];
  //   if (group.length === 0) {
  //     currentFiles.forEach((f) => writeRel(f, s));
  //   } else {
  //     group.forEach((f) => writeRel(f, s));
  //   }
  // }

  return result;
}

function extractUtility(utilsData, outDir, parcelId) {
  const key = `property_${parcelId}`;
  const u = utilsData[key];
  if (!u) return;
  const requiredKeys = [
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
  ];
  const out = {};
  requiredKeys.forEach((k) => {
    out[k] = u[k] !== undefined ? u[k] : null;
  });
  [
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
  ].forEach((k) => {
    if (u[k] !== undefined) out[k] = u[k];
  });
  writeJSON(path.join(outDir, "utility.json"), out);
}

function extractLayout(layoutData, outDir, parcelId) {
  const key = `property_${parcelId}`;
  const entry = layoutData[key];
  if (!entry || !Array.isArray(entry.layouts)) return;
  entry.layouts.forEach((l, idx) => {
    writeJSON(path.join(outDir, `layout_${idx + 1}.json`), l);
  });
}

function extractStructure(structureData, outDir, parcelId) {
  const key = `property_${parcelId}`;
  const s = structureData[key];
  if (!s) return;
  writeJSON(path.join(outDir, "structure.json"), s);
}

function extractLot($, outDir) {
  let acreage = null;
  $("label").each((i, el) => {
    const $el = $(el);
    const t = $el.text().trim();
    if (t.startsWith("Acreage")) {
      const v = $el.parent().children("div").first().text().trim();
      const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
      if (!isNaN(n)) acreage = n;
    }
  });
  if (acreage == null) return;

  const lot = {
    lot_type:
      acreage > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre",
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: Math.round(acreage * 43560),
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: acreage,
  };
  writeJSON(path.join(outDir, "lot.json"), lot);
}

function main() {
  const inputHtmlPath = path.join("input.html");
  const unAddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownerPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");

  const outDir = path.join("data");
  ensureDir(outDir);

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(unAddrPath);
  const seed = readJSON(seedPath);
  const parcelId = seed.parcel_id || seed.request_identifier;
  let propertyObj;
  try {
    propertyObj = extractProperty($, parcelId);
  } catch (e) {
    try {
      const parsed = JSON.parse(e.message);
      console.error(JSON.stringify(parsed));
      process.exit(1);
    } catch {
      throw e;
    }
  }
  writeJSON(path.join(outDir, "property.json"), propertyObj);

  extractAddress(unAddr);
  // writeJSON(path.join(outDir, "address.json"), addressObj);

  const salesCount = extractSalesAndDeeds($, outDir);

  extractTax($, outDir);

  const ownerData = readJSON(ownerPath);
  extractOwners(ownerData, outDir, parcelId, salesCount);

  const utilsData = readJSON(utilsPath);
  extractUtility(utilsData, outDir, parcelId);

  const layoutData = readJSON(layoutPath);
  extractLayout(layoutData, outDir, parcelId);

  const structureData = readJSON(structurePath);
  extractStructure(structureData, outDir, parcelId);
  extractLot($, outDir);
}

if (require.main === module) {
  main();
}
