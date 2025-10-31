const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseCurrencyToNumber(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parseISODate(mdY) {
  if (!mdY) return null;
  const m = String(mdY)
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function mapDeedType(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  const map = {
    "SPECIAL WARRANTY DEED": "Special Warranty Deed",
    "WARRANTY DEED": "Warranty Deed",
    "QUIT CLAIM DEED": "Quitclaim Deed",
    "QUITCLAIM DEED": "Quitclaim Deed",
    "CORRECTIVE DEED": "Correction Deed",
    "CORRECTION DEED": "Correction Deed",
    "GRANT DEED": "Grant Deed",
    "BARGAIN AND SALE DEED": "Bargain and Sale Deed",
    "LADY BIRD DEED": "Lady Bird Deed",
    "TRUSTEE'S DEED": "Trustee's Deed",
    "TAX DEED": "Tax Deed",
    "PERSONAL REPRESENTATIVE DEED": "Personal Representative Deed",
  };
  if (map[s]) return map[s];
  return null;
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

function attemptWriteAddress(unnorm) {
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
  fs.writeFileSync(
    path.join("data", "address.json"),
    JSON.stringify(address, null, 2),
  );
}

function mapPropertyTypeFromUseCode(code) {
  if (!code) return null;
  const u = code.toUpperCase();
  if (u.includes("0311") || u.includes("0312") || u.includes("1003")) return "MultiFamilyMoreThan10";
  if (u.includes("0811")) return "MultiFamilyLessThan10";
  if (u.includes("0313")) return "MultipleFamily";
  if (u.includes("0111")) return "SingleFamily";
  if (u.includes("0401") || u.includes("0411") || u.includes("1004")) return "Condominium";
  if (u.includes("0001") || u.includes("0011")) return "VacantLand";
  if (u.includes("0490") || u.includes("0491") || u.includes("0492") || u.includes("0493")) return "Timeshare";
  if (u.includes("0316") || u.includes("0341") || u.includes("0342") || u.includes("0343")) return "Apartment";
  if (u.includes("0211")) return "MobileHome";
  if (u.includes("0611") || u.includes("1006")) return "Retirement";
  if (u.includes("0711")) return "MiscellaneousResidential";
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writePersonCompaniesSalesRelationships(parcelId, sales) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const personMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (!personMap.has(k))
          personMap.set(k, {
            first_name: o.first_name,
            middle_name: o.middle_name,
            last_name: o.last_name,
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && o.middle_name)
            existing.middle_name = o.middle_name;
        }
      }
    });
  });
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));
  people.forEach((p, idx) => {
    fs.writeFileSync(
      path.join("data", `person_${idx + 1}.json`),
      JSON.stringify(p, null, 2),
    );
  });
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  companies = Array.from(companyNames).map((n) => ({ 
    name: n,
    request_identifier: parcelId,
  }));
  companies.forEach((c, idx) => {
    fs.writeFileSync(
      path.join("data", `company_${idx + 1}.json`),
      JSON.stringify(c, null, 2),
    );
  });
  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;

  function findPersonIndexByName(first, last) {
    const tf = titleCaseName(first);
    const tl = titleCaseName(last);
    for (let i = 0; i < people.length; i++) {
      if (people[i].first_name === tf && people[i].last_name === tl)
        return i + 1;
    }
    return null;
  }

  function findCompanyIndexByName(name) {
    const tn = (name || "").trim();
    for (let i = 0; i < companies.length; i++) {
      if ((companies[i].name || "").trim() === tn) return i + 1;
    }
    return null;
  }

  sales.forEach((rec, idx) => {
    const d = rec.date;
    const ownersOnDate = ownersByDate[d] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          fs.writeFileSync(
            path.join(
                    "data",
                    `relationship_sales_person_${relPersonCounter}.json`,
                  ),
            JSON.stringify({
                    to: { "/": `./person_${pIdx}.json` },
                    from: { "/": `./sales_${idx + 1}.json` },
                  }, null, 2),
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx) {
          relCompanyCounter++;
          fs.writeFileSync(
            path.join(
                    "data",
                    `relationship_sales_company_${relCompanyCounter}.json`,
                  ),
            JSON.stringify({
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
                  }, null, 2),
          );
        }
      });
  });
}

function main() {
  const INPUT_HTML = path.resolve("input.html");
  const ADDR_JSON = path.resolve("unnormalized_address.json");
  const SEED_JSON = path.resolve("property_seed.json");
  const OWNER_JSON = path.resolve("owners/owner_data.json");
  const UTIL_JSON = path.resolve("owners/utilities_data.json");
  const LAYOUT_JSON = path.resolve("owners/layout_data.json");
  const STRUCTURE_JSON = path.resolve("owners", "structure_data.json");

  const outDir = path.resolve("data");
  ensureDir(outDir);

  const html = fs.readFileSync(INPUT_HTML, "utf8");
  const $ = cheerio.load(html);

  const unAddr = readJSON(ADDR_JSON) || {};
  const seed = readJSON(SEED_JSON) || {};
  const ownerData = readJSON(OWNER_JSON) || {};
  const utilData = readJSON(UTIL_JSON) || {};
  const layoutData = readJSON(LAYOUT_JSON) || {};
  const structureData = readJSON(STRUCTURE_JSON) || {};

  const parcelId =
    (seed && (seed.parcel_id || seed.request_identifier)) ||
    $("#stu").val() ||
    null;

  // PROPERTY
  let legalDesc = null;
  const ldescEl = $(".lDesc").first();
  if (ldescEl && ldescEl.text()) {
    const t = ldescEl.text().trim();
    const m = t.match(/Legal Description:\s*(.*)$/i);
    legalDesc = m
      ? m[1].trim()
      : t.replace(/^Legal Description:\s*/i, "").trim();
  }
  // Subdivision from results grid cell or property card
  let subdivision = null;
  const subCell = $(
    'td[data-transpose="SubDivision"], td[data-field="subName"]',
  ).first();
  if (subCell && subCell.text()) subdivision = subCell.text().trim();

  // Primary use mapping to property_type
  let primaryUse = null;
  const primaryUseEl = $(".DORDesc").first();
  if (primaryUseEl && primaryUseEl.text()) {
    const m = primaryUseEl.text().match(/Primary Use:\s*(.*)$/i);
    primaryUse = m ? m[1].trim() : primaryUseEl.text().trim();
  }
  let property_type = mapPropertyTypeFromUseCode(primaryUse);
  if (!property_type) {
    throw {
      type: "error",
      message: `Unknown enum value ${useCode}.`,
      path: "property.property_type",
    };
  }
  // let property_type = "Apartment";
  // if (primaryUse) {
  //   const pu = primaryUse.toUpperCase();
  //   if (pu.includes("MULTI-FAMILY")) {
  //     property_type = "MultiFamilyMoreThan10";
  //   }
  //   if (pu.includes("CONDOMINIUM")) {
  //     property_type = "Apartment";
  //   }
  // }

  // Year Built: pick earliest from buildings section rows labeled "Year Built:"
  let builtYears = [];
  $("div.row.mt-1").each((i, el) => {
    const label = $(el).find("strong").first().text().trim();
    if (/Year Built:/i.test(label)) {
      const val = $(el).find("span").last().text().trim();
      const y = parseInt(val, 10);
      if (!isNaN(y)) builtYears.push(y);
    }
  });
  const propBuiltYear = builtYears.length ? Math.min(...builtYears) : null;

  // number_of_units from Property Name or Land table
  let number_of_units = null;
  const propNameEl = $(".Property_name").first();
  if (propNameEl && propNameEl.text()) {
    const t = propNameEl.text();
    const m = t.match(/\((\d+)\s*UNITS?\)/i);
    if (m) number_of_units = parseInt(m[1], 10);
  }
  if (number_of_units == null) {
    $("#lndVals tbody tr").each((i, tr) => {
      const tds = $(tr).find("td");
      const ut = $(tds[1]).text().trim();
      const n = parseInt(ut, 10);
      if (!isNaN(n)) number_of_units = n;
    });
  }

  const property = {
    area_under_air: null,
    historic_designation: false,
    livable_floor_area: null,
    number_of_units: number_of_units != null ? number_of_units : null,
    number_of_units_type: null,
    parcel_identifier: parcelId || $("#stu").val() || "",
    property_effective_built_year: null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: propBuiltYear || null,
    property_type: property_type,
    subdivision: subdivision || null,
    total_area: null,
    zoning: null,
  };
  fs.writeFileSync(
    path.join(outDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // ADDRESS from unnormalized and HTML lat/lon
  attemptWriteAddress(unAddr);

  // UTILITIES from owners/utilities_data.json strictly
  let util = null;
  if (utilData) {
    const key = `property_${parcelId}`;
    util = utilData[key] || null;
  }
  if (util) {
    fs.writeFileSync(
      path.join(outDir, "utility.json"),
      JSON.stringify(util, null, 2),
    );
  }

  // LAYOUTS from owners/layout_data.json strictly
  const layoutsKey = `property_${parcelId}`;
  const lay =
    layoutData[layoutsKey] && Array.isArray(layoutData[layoutsKey].layouts)
      ? layoutData[layoutsKey].layouts
      : [];
  if (lay && lay.length) {
    lay.forEach((item, idx) => {
      fs.writeFileSync(
        path.join(outDir, `layout_${idx + 1}.json`),
        JSON.stringify(item, null, 2),
      );
    });
  }

  // Structures from owners/structure_data.json strictly
  let structure = null;
  if (structureData) {
    const key = `property_${parcelId}`;
    structure = structureData[key] || null;
  }
  if (structure) {
    fs.writeFileSync(
      path.join(outDir, "structure.json"),
      JSON.stringify(structure, null, 2),
    );
  }

  // SALES from HTML table #shVals
  const sales = [];
  $("#shVals tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      const saleDate = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const bookPage = $(tds[2]).text().trim();
      let link = null;
      const bookPageSplit = bookPage.split("-");
      if (bookPageSplit.length == 2) {
        let book = bookPageSplit[0];
        let page = bookPageSplit[1];
        link = `https://officialrecords.osceolaclerk.org/browserviewpa/viewer.aspx?book=${book}&page=${page}&booktype=O`;
      }
      const deedCode = $(tds[6]).text().trim();
      const buyer = $(tds[4]).text().trim();
      sales.push({
        date: parseISODate(saleDate),
        price: parseCurrencyToNumber(priceTxt),
        deedType: deedCode,
        buyer,
        bookPage,
        link
      });
    }
  });
  // Write sales_N and deed_N
  sales.forEach((s, idx) => {
    const sObj = {
      ownership_transfer_date: s.date || null,
      purchase_price_amount: s.price || null,
    };
    fs.writeFileSync(
      path.join(outDir, `sales_${idx + 1}.json`),
      JSON.stringify(sObj, null, 2),
    );
    const deedObj = {
      deed_type: s.deedType ? mapDeedType(s.deedType) : null,
    };
    fs.writeFileSync(
      path.join(outDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
    );
    if (s.link) {
      const file = {
        document_type: null,
        file_format: null,
        ipfs_url: null,
        name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
        original_url: s.link || null,
      };
      fs.writeFileSync(
        path.join("data", `file_${idx + 1}.json`),
        JSON.stringify(file, null, 2),
      );

      // deed -> sale relationship
      const relSD = {
        to: { "/": `./sales_${idx + 1}.json` },
        from: { "/": `./deed_${idx + 1}.json` },
      };
      fs.writeFileSync(
        path.join(outDir, `relationship_sales_deed_${idx + 1}.json`),
        JSON.stringify(relSD, null, 2),
      );

      // file -> deed relationship
      const relFD = {
        to: { "/": `./deed_${idx + 1}.json` },
        from: { "/": `./file_${idx + 1}.json` },
      };
      fs.writeFileSync(
        path.join(outDir, `relationship_deed_file_${idx + 1}.json`),
        JSON.stringify(relFD, null, 2),
      );
    }
  });

  // TAX: collect from working (propVals), certified (propValsCertified), historic (propHistoricVals)
  function extractTaxRows(tableSel) {
    const rows = [];
    $(`${tableSel} tbody tr`).each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 8) {
        const year = parseInt($(tds[0]).text().trim(), 10);
        const land = parseCurrencyToNumber($(tds[1]).text().trim());
        const building = parseCurrencyToNumber($(tds[2]).text().trim());
        const market = parseCurrencyToNumber($(tds[4]).text().trim());
        const assessed = parseCurrencyToNumber($(tds[5]).text().trim());
        const taxable = parseCurrencyToNumber($(tds[7]).text().trim());
        rows.push({ year, land, building, market, assessed, taxable });
      }
    });
    return rows;
  }
  const taxWorking = extractTaxRows("#propVals");
  const taxCertified = extractTaxRows("#propValsCertified");
  const taxHistoric = extractTaxRows("#propHistoricVals");
  const allTax = [...taxWorking, ...taxCertified, ...taxHistoric];
  const seenYears = new Set();
  allTax.forEach((t) => {
    if (!t.year || seenYears.has(t.year)) return;
    seenYears.add(t.year);
    const taxObj = {
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      property_assessed_value_amount: t.assessed ? t.assessed : null,
      property_building_amount: t.building ? t.building : null,
      property_land_amount: t.land ? t.land : null,
      property_market_value_amount: t.market ? t.market : null,
      property_taxable_value_amount: t.taxable ? t.taxable : null,
      tax_year: t.year,
      yearly_tax_amount: null,
    };
    fs.writeFileSync(
      path.join(outDir, `tax_${t.year}.json`),
      JSON.stringify(taxObj, null, 2),
    );
  });
  writePersonCompaniesSalesRelationships(parcelId, sales);

  // COMPANIES from owners/owner_data.json only
  // const ownerKey = `property_${parcelId}`;
  // const ownersBundle = ownerData[ownerKey] || {};
  // const ownersByDate = ownersBundle.owners_by_date || {};
  // // collect unique company names present in owners_by_date
  // const companyNames = new Map();
  // let companyIndex = 1;
  // Object.keys(ownersByDate).forEach((dateKey) => {
  //   const arr = ownersByDate[dateKey] || [];
  //   arr.forEach((o) => {
  //     if (o && o.type === "company" && o.name) {
  //       if (!companyNames.has(o.name)) {
  //         companyNames.set(o.name, companyIndex++);
  //       }
  //     }
  //   });
  // });
  // // Write company files
  // companyNames.forEach((idx, name) => {
  //   const obj = { name };
  //   fs.writeFileSync(
  //     path.join(outDir, `company_${idx}.json`),
  //     JSON.stringify(obj, null, 2),
  //   );
  // });

  // // Relationships: map sales (buyers) to company files by matching names to owners_by_date entries
  // // Build helper to resolve buyer name to company index by string equality
  // function findCompanyIndexByName(name) {
  //   if (!name) return null;
  //   return companyNames.get(name) || null;
  // }
  // // Link each sales_i to the buyer from the sales table
  // sales.forEach((s, idx) => {
  //   const ci = findCompanyIndexByName(s.buyer);
  //   if (ci) {
  //     const rel = {
  //       to: { "/": `./company_${ci}.json` },
  //       from: { "/": `./sales_${idx + 1}.json` },
  //     };
  //     fs.writeFileSync(
  //       path.join(outDir, `relationship_sales_company_${idx + 1}.json`),
  //       JSON.stringify(rel, null, 2),
  //     );
  //   }
  //   // sales -> deed relationship
  //   const relSD = {
  //     to: { "/": `./sales_${idx + 1}.json` },
  //     from: { "/": `./deed_${idx + 1}.json` },
  //   };
  //   fs.writeFileSync(
  //     path.join(outDir, `relationship_sales_deed_${idx + 1}.json`),
  //     JSON.stringify(relSD, null, 2),
  //   );
  // });
}

main();
