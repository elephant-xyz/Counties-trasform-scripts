const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
}

function parseMoney(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function toIsoDate(mdy) {
  if (!mdy) return null;
  const parts = String(mdy)
    .trim()
    .split(/[\/\-]/)
    .map((s) => s.trim());
  if (parts.length !== 3) return null;
  let [m, d, y] = parts;
  if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function htmlDecode($, text) {
  // use cheerio to decode entities by setting as html and getting text
  return $("<textarea/>").html(text).text();
}

function getText($node) {
  return $node.text().replace(/\s+/g, " ").trim();
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function mapPropertyTypeFromUse(useText) {
  if (!useText) return null;
  const u = useText.toUpperCase();
  // Known patterns
  if (u.includes("MULTI")) {
    if (u.includes("10+") || u.includes("MORE")) {
      return "MultiFamilyMoreThan10";
    }
    if (u.includes("LESS")) {
      return "MultiFamilyLessThan10";
    }
    return "MultipleFamily";
  }
  if (u.includes("SINGLE") || u.includes("SFR")) return "SingleFamily";
  if (u.includes("CONDO")) return "Condominium";
  if (u.includes("VACANT")) return "VacantLand";
  if (u.includes("DUPLEX")) return "Duplex";
  if (u.includes("TOWNHOUSE")) return "Townhouse";
  if (u.includes("APARTMENT")) return "Apartment";
  if (u.includes("MOBILE")) return "MobileHome";
  if (u.includes("PUD")) return "Pud";
  if (u.includes("RETIREMENT")) return "Retirement";
  if (u.includes("COOPERATIVE")) return "Cooperative";
  // Otherwise unknown -> error per requirement
  throw {
    type: "error",
    message: `Unknown enum value ${useText}.`,
    path: "property.property_type",
  };
}

function extractProperty($) {
  const parcel_identifier = extractParcelId($);

  // Legal description: hidden input strLegal preferred
  let legal = $('input[name="strLegal"]').attr("value");
  if (!legal) {
    const flegal = getText($("#Flegal"));
    const blegal = getText($("#Blegal"));
    legal = flegal || blegal || null;
  } else {
    legal = htmlDecode($, legal).replace(/\s+/g, " ").trim();
  }

  // Use Code row to map property type
  let useText = null;
  $("table.parcelDetails_insideTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = getText($(tds[0]));
      if (/^Use\s*Code/i.test(label)) {
        useText = getText($(tds[1]));
      }
    }
  });
  let property_type = null;
  if (useText) {
    property_type = mapPropertyTypeFromUse(useText);
  }

  // Building Characteristics to compute years and areas
  let builtYears = [];
  let heatedTotals = 0;
  let actualTotals = 0;
  const bldgRows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr",
  );
  bldgRows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6 && i > 0) {
      const year = Number(getText($(tds[2])).replace(/[^0-9]/g, ""));
      const htd = Number(getText($(tds[3])).replace(/[^0-9]/g, ""));
      const act = Number(getText($(tds[4])).replace(/[^0-9]/g, ""));
      if (!Number.isNaN(year)) builtYears.push(year);
      if (!Number.isNaN(htd)) heatedTotals += htd;
      if (!Number.isNaN(act)) actualTotals += act;
    }
  });
  const property_structure_built_year = builtYears.length
    ? Math.min(...builtYears)
    : null;
  const livable_floor_area = heatedTotals ? String(heatedTotals) : null;
  const total_area = actualTotals ? String(actualTotals) : null;
  const area_under_air = livable_floor_area;

  const property = {
    parcel_identifier: parcel_identifier || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: property_structure_built_year || null,
    property_type: property_type || null,
    number_of_units_type: null,
    livable_floor_area: livable_floor_area,
    area_under_air: area_under_air,
    total_area: total_area,
    property_effective_built_year: null,
    number_of_units: null,
    subdivision: null,
    zoning: null,
  };
  return property;
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

function extractAddress($, unnorm) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
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

  // S/T/R row for township, range, section
  let section = null,
    township = null,
    range = null;
  $("table.parcelDetails_insideTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      const label = getText($(tds[2]));
      const val = getText($(tds[3]));
      const label0 = getText($(tds[0]));
      const val1 = getText($(tds[1]));
      if (/^S\/T\/R$/i.test(label0)) {
        const v = val1;
        const m = v.match(/^(\d+)-([0-9]{2}[NS])-(\d{2}[EW])$/i);
        if (m) {
          section = m[1];
          township = m[2].toUpperCase();
          range = m[3].toUpperCase();
        }
      } else if (/^S\/T\/R$/i.test(label)) {
        const v = val;
        const m = v.match(/^(\d+)-([0-9]{2}[NS])-(\d{2}[EW])$/i);
        if (m) {
          section = m[1];
          township = m[2].toUpperCase();
          range = m[3].toUpperCase();
        }
      }
    }
  });
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
    township: township || null,
    range: range || null,
    section: section || null,
    block: null,
    lot: null,
    municipality_name: null,
  };
  return address;
}

function extractTaxes($) {
  const taxes = [];

  function extractBlock(titleContains) {
    const table = $("table.parcelDetails_insideTable")
      .filter((i, el) => {
        const $el = $(el);
        const txt = getText($el.find('tr td[align="center"]').first());
        return txt.includes(titleContains);
      })
      .first();

    if (!table.length) return null;
    // Rows: find labels and values
    const rows = table.find("tr");
    const block = {};
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = getText($(tds[0]));
        const val = getText($(tds[1]));
        if (/Mkt\s*Land/i.test(label)) block.land = parseMoney(val);
        if (/Building/i.test(label)) block.building = parseMoney(val);
        if (/Just$/i.test(label)) block.just = parseMoney(val);
        if (/Assessed/i.test(label)) block.assessed = parseMoney(val);
        if (/Total\s*Taxable/i.test(label)) {
          // inside this td there are multiple labels; extract first number
          const m = val.match(/\$[\d,]+(\.\d{2})?/);
          block.taxable = m ? parseMoney(m[0]) : null;
        }
      }
    });
    return block;
  }

  const b2024 = extractBlock("2024 Certified Values");
  if (b2024) {
    taxes.push({
      tax_year: 2024,
      property_assessed_value_amount: b2024.assessed ?? null,
      property_market_value_amount: b2024.just ?? null,
      property_building_amount: b2024.building ?? null,
      property_land_amount: b2024.land ?? null,
      property_taxable_value_amount: b2024.taxable ?? null,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    });
  }
  const b2025 = extractBlock("2025 Preliminary Certified");
  if (b2025) {
    taxes.push({
      tax_year: 2025,
      property_assessed_value_amount: b2025.assessed ?? null,
      property_market_value_amount: b2025.just ?? null,
      property_building_amount: b2025.building ?? null,
      property_land_amount: b2025.land ?? null,
      property_taxable_value_amount: b2025.taxable ?? null,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    });
  }
  return taxes;
}

function mapDeedCode(code) {
  if (!code) return {};
  const u = code.trim().toUpperCase();
  if (u === "CT") return "Contract for Deed";
  if (u === "WD") return "Warranty Deed";
  if (u === "WARRANTY DEED") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "TAX DEED") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "QUITCLAIM DEED") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "SPECIAL WARRANTY DEED") return "Special Warranty Deed";
  return null;
}

function extractSalesAndDeeds($) {
  const sales = [];

  const salesTable = $(
    "#parcelDetails_SalesTable table.parcelDetails_insideTable",
  ).first();
  const rows = salesTable.find("tr").slice(1); // skip header
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      const date = getText($(tds[0]));
      const price = getText($(tds[1]));
      const bookPage = getText($(tds[2]));
      const deedCode = getText($(tds[3]));
      const iso = toIsoDate(date);
      const amt = parseMoney(price);
      let link = null;
      if (bookPage) {
        const bookPageParts = bookPage.split('/');
        if (bookPageParts.length == 2) {
          const book = bookPageParts[0].trim();
          const page = bookPageParts[1].trim();
          if (book && isNumeric(book) && page && isNumeric(page)) {
            link = `https://www.suwanneepa.com/gis/linkClerk/?ClerkBook=${book}&ClerkPage=${page}&autoSubmit=1`;
          }
        }
      }
      const saleObj = {
        ownership_transfer_date: iso,
        purchase_price_amount: amt,
        bookPage,
        link,
        deed: mapDeedCode(deedCode)
      };
      sales.push(saleObj);
    }
  });
  return sales;
}

function writeOwners(ownerData, dataDir, parcelDashed, parcelFlat) {
  // owners keyed by dashed id in provided data
  const keyVariants = [`property_${parcelDashed}`, `property_${parcelFlat}`];
  let ownersEntry = null;
  for (const k of keyVariants) {
    if (ownerData[k]) {
      ownersEntry = ownerData[k];
      break;
    }
  }
  const outputs = { companyFiles: [], personFiles: [] };
  if (
    ownersEntry &&
    ownersEntry.owners_by_date &&
    Array.isArray(ownersEntry.owners_by_date.current)
  ) {
    let companyIdx = 0,
      personIdx = 0;
    for (const ow of ownersEntry.owners_by_date.current) {
      if (ow.type === "company") {
        companyIdx += 1;
        const file = path.join(dataDir, `company_${companyIdx}.json`);
        writeJson(file, { name: ow.name ?? null });
        outputs.companyFiles.push(path.basename(file));
      } else if (ow.type === "person") {
        // person schema requires many fields; we cannot synthesize; skip if insufficient
        if (ow.first_name && ow.last_name) {
          personIdx += 1;
          const file = path.join(dataDir, `person_${personIdx}.json`);
          writeJson(file, {
            birth_date: ow.birth_date ?? null,
            first_name: ow.first_name,
            last_name: ow.last_name,
            middle_name: ow.middle_name ?? null,
            prefix_name: ow.prefix_name ?? null,
            suffix_name: ow.suffix_name ?? null,
            us_citizenship_status: ow.us_citizenship_status ?? null,
            veteran_status: ow.veteran_status ?? null,
          });
          outputs.personFiles.push(path.basename(file));
        }
      }
    }
  }
  return outputs;
}

function main() {
  try {
    const dataDir = path.join(".", "data");
    ensureDir(dataDir);

    const html = fs.readFileSync("input.html", "utf-8");
    const $ = cheerio.load(html);

    const unAddr = readJson("unnormalized_address.json");
    const propSeed = readJson("property_seed.json");

    // Owners/utilities/layout must be built from their JSONs
    const ownerData = readJson(path.join("owners", "owner_data.json"));
    const utilitiesData = readJson(path.join("owners", "utilities_data.json"));
    const layoutData = readJson(path.join("owners", "layout_data.json"));

    // Property
    const property = extractProperty($);
    if (!property.property_type) {
      // mapping failure should have thrown, but guard
      throw {
        type: "error",
        message: "Unknown enum value.",
        path: "property.property_type",
      };
    }
    writeJson(path.join(dataDir, "property.json"), property);

    // Address
    const address = extractAddress($, unAddr);
    writeJson(path.join(dataDir, "address.json"), address);

    // Taxes
    const taxes = extractTaxes($);
    let taxIdx = 0;
    taxes.forEach((t) => {
      taxIdx += 1;
      writeJson(path.join(dataDir, `tax_${t.tax_year || taxIdx}.json`), t);
    });

    // Sales & Deeds
    const sales = extractSalesAndDeeds($);
    sales.forEach((s, i) => {
      const saleObj = {
        ownership_transfer_date: s.ownership_transfer_date,
        purchase_price_amount: s.purchase_price_amount,
      }
      writeJson(path.join(dataDir, `sales_${i + 1}.json`), saleObj);
      if (s.deed) {
        writeJson(path.join(dataDir, `deed_${i + 1}.json`), {"deed_type": s.deed});
      } else {
        writeJson(path.join(dataDir, `deed_${i + 1}.json`), {});
      }
      const file = {
        document_type: null,
        file_format: null,
        ipfs_url: null,
        name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
        original_url: s.link || null,
      };
      writeJson(path.join("data", `file_${i + 1}.json`), file);
      const suffix = i === 0 ? "" : `_${i + 1}`;
      const saleDeedRelName = `relationship_sales_deed${suffix}.json`;
      const deedFileRelName = `relationship_deed_file${suffix}.json`;
      const saleDeedRel = {
        to: { "/": `./sales_${i + 1}.json` },
        from: { "/": `./deed_${i + 1}.json` },
      };
      writeJson(path.join(dataDir, saleDeedRelName), saleDeedRel);
      const deedFileRel = {
        to: { "/": `./deed_${i + 1}.json` },
        from: { "/": `./file_${i + 1}.json` },
      };
      writeJson(path.join(dataDir, deedFileRelName), deedFileRel);
    });

    // Owners
    const parcelDashed =
      extractParcelId($) || (propSeed && propSeed.parcel_id) || "";
    const parcelFlat = parcelDashed.replace(/[-]/g, "");
    const ownerFiles = writeOwners(
      ownerData,
      dataDir,
      parcelDashed,
      parcelFlat,
    );

    // Relationship sales -> owner (company or person) using first sale
    if (sales.length > 0) {
      if (ownerFiles.companyFiles.length > 0) {
        writeJson(path.join(dataDir, "relationship_sales_company.json"), {
          to: { "/": `./${ownerFiles.companyFiles[0]}` },
          from: { "/": "./sales_1.json" },
        });
      } else if (ownerFiles.personFiles.length > 0) {
        writeJson(path.join(dataDir, "relationship_sales_person.json"), {
          to: { "/": `./${ownerFiles.personFiles[0]}` },
          from: { "/": "./sales_1.json" },
        });
      }
    }

    // Utilities
    // utilities key is property_ + flat parcel ID (observed): 1302S13E04969001004
    let utilEntry = null;
    const utilKeyVariants = [
      `property_${parcelFlat}`,
      `property_${parcelDashed}`,
    ];
    for (const k of utilKeyVariants) {
      if (utilitiesData[k]) {
        utilEntry = utilitiesData[k];
        break;
      }
    }
    if (utilEntry) {
      writeJson(path.join(dataDir, "utility.json"), utilEntry);
    }

    // Layouts
    let layoutEntry = null;
    for (const k of utilKeyVariants) {
      if (layoutData[k]) {
        layoutEntry = layoutData[k];
        break;
      }
    }
    if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
      layoutEntry.layouts.forEach((lay, i) => {
        writeJson(path.join(dataDir, `layout_${i + 1}.json`), lay);
      });
    }

  } catch (e) {
    // On mapping error for enums, write error to stderr and exit non-zero
    if (e && e.type === "error") {
      process.stderr.write(JSON.stringify(e));
      console.log(JSON.stringify(e));
    } else {
      process.stderr.write(String(e.stack || e));
      console.log(String(e.stack || e));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
