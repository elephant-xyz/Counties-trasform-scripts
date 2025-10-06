const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function emptyDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.rmSync(path.join(p, f), { recursive: true, force: true });
  }
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function isNumeric(value) {
    return /^-?\d+$/.test(value);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseRemixContext(html) {
  const m = html.match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

function parseSitusParts(situs) {
  if (!situs) return {};
  let situs_parts =  situs.split(",").map((s) => s.trim());
  let addr = situs_parts[0];
  let city = null;
  let zip = null;
  for (var i=2; i < situs_parts.length; i++) {
      if (situs_parts[i] && situs_parts[i].match(/^\d{5}$/)) {
        zip = situs_parts[i];
        city = situs_parts[i - 1];
        break;
      }
  }
  // const [addr, city, zip] = situs.split(",").map((s) => s.trim());
  const parts = (addr || "").split(/\s+/);
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
  return {
    street_number,
    street_name,
    street_suffix: suffix,
    city_name: city || null,
    postal_code: zip || null,
  };
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

function extractBookPageLinks($) {
  const map = {};
  $("#salesContainer table tbody tr").each((i, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length === 9) {
      const $bookCell = $($tds.get(4));
      const a = $bookCell.find("a");
      if (a && a.attr("href")) {
        const text = a.text().replace(/\s+/g, "");
        const m = text.match(/(\d+)\/(\d+)/);
        if (m) map[`${m[1]}/${m[2]}`] = a.attr("href");
      } else {
        const spanText = $bookCell.text().trim().replace(/\s+/g, "");
        const m = spanText.match(/(\d+)\/(\d+)/);
        if (m) map[`${m[1]}/${m[2]}`] = null;
      }
    }
  });
  return map;
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function parseValuationTable($) {
  // Return { [year]: { [label]: number } }
  const out = {};
  const $table = $("#valuationContainer table").first();
  if (!$table.length) return out;
  const $rows = $table.find("tbody > tr");
  if (!$rows.length) return out;
  // First row: headers containing years
  const $headerRow = $rows.eq(0);
  const years = [];
  $headerRow.find("th").each((i, th) => {
    const t = $(th).text().trim();
    const m = t.match(/(\d{4})/);
    if (m) years.push(parseInt(m[1], 10));
  });
  // For each subsequent row, map label -> values
  $rows.slice(1).each((ri, tr) => {
    const $tr = $(tr);
    const label = $tr.find("th").first().text().trim();
    if (!label) return;
    const $cells = $tr.find("td");
    $cells.each((ci, td) => {
      const year = years[ci];
      if (!year) return;
      const raw = $(td).text().trim();
      const num = raw ? Number(raw.replace(/[$,]/g, "")) : 0;
      if (!out[year]) out[year] = {};
      out[year][label] = isNaN(num) ? null : num;
    });
  });
  return out;
}

function mapPropertyType(parcelInfo) {
  if (parcelInfo && parcelInfo.propertyUsage) {
    const propertyUsageText = parcelInfo.propertyUsage.toLowerCase();
    if (propertyUsageText.includes("vacant")) {
      if (propertyUsageText.includes("residential")) {
        return "VacantLand";
      }
    }
    if (propertyUsageText.includes("single family")) return "SingleFamily";
    if (propertyUsageText.includes("condominium")) return "Condominium";
    if (propertyUsageText.includes("mobile home")) return "MobileHome";
    if (propertyUsageText.includes("multi-family")) {
      if (propertyUsageText.includes("000300")) {
        return "MultiFamilyMoreThan10"
      }
      if (propertyUsageText.includes("000800")) {
        return "MultiFamilyLessThan10"
      }
      return "MultipleFamily";
    }
    if (propertyUsageText.includes("retirement")) return "Retirement";
  }
  throw new Error("Non residential property type");
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);
  emptyDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const remix = parseRemixContext(html);

  const unnormalized = readJSON("unnormalized_address.json");
  const propertySeed = readJSON("property_seed.json");

  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const structurePath = path.join("owners", "structure_data.json");
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;
  const structureData = fs.existsSync(structurePath)
    ? readJSON(structurePath)
    : null;

  const parcelId = propertySeed["parcel_id"];
  // let propertyType = "ManufacturedHousing";
  // if (parcelId && parcelId.trim().endsWith("M")) {
  //   propertyType = "VacantLand";
  // }

  const remixData =
    remix &&
    remix.state &&
    remix.state.loaderData &&
    remix.state.loaderData["routes/_index"]
      ? remix.state.loaderData["routes/_index"]
      : {};

  const parcelInfo = remixData.parcelInformation || {};
  let propertyType;
  if (parcelId && parcelId.trim().endsWith("M")) {
    propertyType = "Commercial";
    throw new Error("Mineral rights");
  } else {
    propertyType = mapPropertyType(parcelInfo);
  }
  if (!propertyType) {
    throw new Error("Non residential property");
  }
  const buildings = remixData.buildings || {};
  // console.log('Number of buildings:', remixData.buildings?.units?.length || 0);
  // console.log('***********************************');
  // console.log('Number of building:', buildings );
  // console.log('***********************************');
  const firstUnit =
    (buildings.units && buildings.units.length ? buildings.units[0] : {}) || {};

  // Create common source_http_request object
  const sourceHttpRequest = {
    method: "GET",
    url: "https://parcelview.srcpa.gov",
    multiValueQueryString: {
      parcel: [parcelId]
    }
  };

  // PROPERTY
  // Calculate totals from all units
  let totalAreaSum = 0;
  // let totalHeatedAreaSum = 0;
  let hasValidArea = false;
  // let hasValidHeatedArea = false;
  const units = (buildings.units && buildings.units.length ? buildings.units : []) || [];

  units.forEach(unit => {
    if (unit.squareFeet && unit.squareFeet.actual != null) {
      totalAreaSum += unit.squareFeet.actual;
      hasValidArea = true;
    }
    // if (unit.squareFeet && unit.squareFeet.heated != null && unit.squareFeet.heated >= 10) {
    //   totalHeatedAreaSum += unit.squareFeet.heated;
    //   hasValidHeatedArea = true;
    // }
  });
  let structureBuiltYear = firstUnit.yearBuilt && firstUnit.yearBuilt.actual
        ? firstUnit.yearBuilt.actual
        : null;
  let effectiveBuiltYear = firstUnit.yearBuilt && firstUnit.yearBuilt.effective
        ? firstUnit.yearBuilt.effective
        : null;
  const condoInfo = remixData.condoInfo || null;
  if (condoInfo) {
    let squareFootage = condoInfo.squareFootage ? condoInfo.squareFootage : 0;
    totalAreaSum += squareFootage;
    hasValidArea = true;
    structureBuiltYear = condoInfo.yearBuilt && condoInfo.yearBuilt.actual
      ? condoInfo.yearBuilt.actual
      : null;
    effectiveBuiltYear = condoInfo.yearBuilt && condoInfo.yearBuilt.effective
      ? condoInfo.yearBuilt.effective
      : null;
  }
  // Print the totals for debugging
  // console.log(`Total area from all units: ${totalAreaSum}`);
  // console.log(`Total heated area from all units: ${totalHeatedAreaSum}`);

  // PROPERTY
  const property = {
    parcel_identifier: parcelId,
    property_type: propertyType,
    property_structure_built_year: structureBuiltYear,
    property_effective_built_year: effectiveBuiltYear,
    property_legal_description_text: parcelInfo.legalDescription || null,
    livable_floor_area: null,
    total_area: hasValidArea ? String(totalAreaSum) : null,
    number_of_units_type: null,
    subdivision: null,
    zoning:
      remixData.zonings && remixData.zonings.length
        ? remixData.zonings[0].code
        : null,
    area_under_air: null,
    number_of_units: units.length || 1,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  // ADDRESS
  const situs =
    parcelInfo.situs ||
    $('td[data-cell="Situs/Physical Address"]').text().trim();
  const situsParts = parseSitusParts(situs);
  const sectionTownRange = (
    parcelInfo.sectionTownshipRange ||
    $('td[data-cell="Section-Township-Range"]').text().trim() ||
    ""
  ).trim();
  let section = null,
    township = null,
    range = null;
  if (sectionTownRange) {
    const parts = sectionTownRange.split("-");
    if (parts.length === 3) {
      section = parts[0];
      township = parts[1];
      range = parts[2];
    }
  }
  const ownerInfo = remixData.ownerInformation || {};
  const address = {
    street_number: situsParts.street_number || null,
    street_name: situsParts.street_name || null,
    latitude: unnormalized && unnormalized.latitude ? unnormalized.latitude : null,
    longitude: unnormalized && unnormalized.longitude ? unnormalized.longitude : null,
    street_suffix_type: normalizeSuffix(situsParts.street_suffix),
    street_pre_directional_text: null,
    street_post_directional_text: null,
    city_name:
      situsParts.city_name || ownerInfo.city || null
        ? (situsParts.city_name || ownerInfo.city || null)
            .toString()
            .toUpperCase()
        : null,
    state_code: "FL",
    postal_code: situsParts.postal_code || ownerInfo.zip5 || null || null,
    plus_four_postal_code: null,
    country_code: null,
    county_name: "Santa Rosa",
    unit_identifier: null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    block: null,
    lot: null,
    municipality_name: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // STRUCTURE
  if (structureData) {
    const key = `property_${parcelId}`;
    const s = structureData[key] || {};
    s["source_http_request"] = sourceHttpRequest;
    s["request_identifier"] = parcelId,
    writeJSON(path.join(dataDir, "structure.json"), s);
  }

  // LOT
  const land = remixData.land || {};
  const segments = land.segments || [];
  const maxFrontage = segments.reduce(
    (m, s) => (typeof s.frontage === "number" ? Math.max(m, s.frontage) : m),
    0,
  );
  const maxDepth = segments.reduce(
    (m, s) =>
      typeof s.depthAmount === "number" ? Math.max(m, s.depthAmount) : m,
    0,
  );
  const acreage =
    typeof parcelInfo.acreage === "number" ? parcelInfo.acreage : null;
  const sqft = acreage != null ? Math.round(acreage * 43560) : null;
  const lot = {
    lot_type:
      acreage != null
        ? acreage > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre"
        : null,
    lot_length_feet: maxDepth || null,
    lot_width_feet: maxFrontage || null,
    lot_area_sqft: sqft || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // TAXES for 2023-2025
  const valuationValues =
    (remixData.valuation && remixData.valuation.values) || [];
  const valuationTable = parseValuationTable($);
  function valFor(year, desc) {
    const v = valuationValues.find(
      (v) =>
        v.taxYear === year && v.valueType && v.valueType.description === desc,
    );
    if (v) return v.amount;
    // Fallback to parsed table if available
    const rowMap = valuationTable[year] || {};
    if (rowMap[desc] !== undefined) return rowMap[desc];
    return null;
  }
  function writeTax(year) {
    const assessed = valFor(year, "Co. Assessed Value");
    const market = valFor(year, "Just (Market) Value");
    const building = valFor(year, "Building Value");
    const landVal = valFor(year, "Land Value");
    let taxable = valFor(year, "Co. Taxable Value");
    if (taxable === null || taxable === undefined) {
      // If table shows columns and value is missing, treat as 0
      if (
        valuationTable[year] &&
        valuationTable[year]["Co. Taxable Value"] !== undefined
      )
        taxable = valuationTable[year]["Co. Taxable Value"] || 0;
    }
    const taxOut = {
      tax_year: year,
      property_assessed_value_amount: assessed,
      property_market_value_amount: market,
      property_building_amount: building,
      property_land_amount: landVal,
      property_taxable_value_amount: taxable,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `tax_${year}.json`), taxOut);
  }
  [2023, 2024, 2025].forEach(writeTax);

  // SALES, DEEDS, FILES
  const sales = (remixData.sales || []).map((s) => s.record);
  const bookPageLinks = extractBookPageLinks($);

  // OWNERS
  let ownersByDate = {};
  if (ownersData) {
    const key = `property_${parcelId}`;
    const od = ownersData[key] || {};
    ownersByDate = od.owners_by_date || {};
  }

  // people and companies
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
  const people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const personPaths = [];
  people.forEach((p, idx) => {
    writeJSON(path.join(dataDir, `person_${idx + 1}.json`), p);
    personPaths.push(`./person_${idx + 1}.json`);
  });

  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  const companies = Array.from(companyNames).map((n) => ({ 
    name: n,
    source_http_request: sourceHttpRequest,
    request_identifier: parcelId,
  }));
  const companyPaths = [];
  companies.forEach((c, idx) => {
    writeJSON(path.join(dataDir, `company_${idx + 1}.json`), c);
    companyPaths.push(`./company_${idx + 1}.json`);
  });

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

  const salesPaths = [];
  const deedPaths = [];
  const filePaths = [];

  sales.forEach((rec, idx) => {
    const sIndex = idx + 1;
    const saleOut = {
      ownership_transfer_date: toISODate(rec.date),
      purchase_price_amount:
        typeof rec.price === "number"
          ? rec.price
          : rec.price
            ? Number(String(rec.price).replace(/[$,]/g, ""))
            : null,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `sales_${sIndex}.json`), saleOut);
    salesPaths.push(`./sales_${sIndex}.json`);

    // Deed type from instrument
    let deedType = null;
    const inst = (rec.instrument || "").toUpperCase();
    if (inst === "WD") deedType = "Warranty Deed";
    else if (inst === "TX") deedType = "Tax Deed";
    
    // Create deed object with only allowed properties
    const deedOut = {
      source_http_request: sourceHttpRequest
    };
    
    // Only add deed_type if we have a valid value
    if (deedType) {
      deedOut.deed_type = deedType;
    }
    
    writeJSON(path.join(dataDir, `deed_${sIndex}.json`), deedOut);
    deedPaths.push(`./deed_${sIndex}.json`);

    // File entry from book/page link
    const key = `${rec.book}/${rec.page}`;
    const original_url = bookPageLinks[key] || null;
    // Map instrument to a document_type for file schema
    let document_type = null;
    if (inst === "WD") document_type = "ConveyanceDeedWarrantyDeed";
    else if (inst === "TX") document_type = "ConveyanceDeed";
    
    const fileOut = {
      file_format: "txt",
      name:
        rec.book && rec.page
          ? `OR ${rec.book}/${rec.page}`
          : original_url
            ? path.basename(original_url)
            : "Document",
      original_url: original_url,
      ipfs_url: null,
      document_type: document_type,
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, `file_${sIndex}.json`), fileOut);
    filePaths.push(`./file_${sIndex}.json`);
  });
 
  writeJSON(path.join(dataDir, "property.json"), property);

  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = toISODate(rec.date);
    const ownersOnDate = ownersByDate[d] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          writeJSON(
            path.join(
              dataDir,
              `relationship_sales_person_${relPersonCounter}.json`,
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx) {
          relCompanyCounter++;
          writeJSON(
            path.join(
              dataDir,
              `relationship_sales_company_${relCompanyCounter}.json`,
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
  });

  // Relationships: deed -> file and sales -> deed
  deedPaths.forEach((deedRef, idx) => {
    const fileRef = filePaths[idx];
    writeJSON(path.join(dataDir, `relationship_deed_file_${idx + 1}.json`), {
      to: { "/": deedRef },
      from: { "/": fileRef },
    });
    writeJSON(path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`), {
      to: { "/": salesPaths[idx] },
      from: { "/": deedRef },
    });
  });

  // UTILITY from owners/utilities_data.json only
  if (utilitiesData) {
    const key = `property_${parcelId}`;
    const u = utilitiesData[key] || {};
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
      source_http_request: sourceHttpRequest,
      request_identifier: parcelId,
    };
    writeJSON(path.join(dataDir, "utility.json"), utilityOut);
  }

  // LAYOUT from owners/layout_data.json only
  if (layoutData) {
    const key = `property_${parcelId}`;
    const layouts = (layoutData[key] && layoutData[key].layouts) || [];
    layouts.forEach((l, idx) => {
      const out = {
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
        source_http_request: sourceHttpRequest,
        request_identifier: parcelId,
      };
      writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), out);
    });
  }

  // FLOOD placeholder
  // const flood = {
  //   community_id: null,
  //   panel_number: null,
  //   map_version: null,
  //   effective_date: null,
  //   evacuation_zone: null,
  //   flood_zone: null,
  //   flood_insurance_required: false,
  //   fema_search_url: null,
  //   source_http_request: sourceHttpRequest,
  //   request_identifier: parcelId,
  // };
  // writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
}

main();