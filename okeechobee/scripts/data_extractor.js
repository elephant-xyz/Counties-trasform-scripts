// Data extraction script per evaluator instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - Sales/Tax/Deed from input.html
// - Writes outputs to ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function raiseEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.split(' ').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join(' ');
}

function mapPrefixName(name) {
  const prefixes = {
    'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
    'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
    'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
    'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
    'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
  };
  return prefixes[name?.toUpperCase()] || null;
}

function mapSuffixName(name) {
  const suffixes = {
    'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
    'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
    'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
    'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
  };
  return suffixes[name?.toUpperCase()] || null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJson(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJson(utilitiesDataPath)
    : null;
  const layoutData = fs.existsSync(layoutDataPath)
    ? readJson(layoutDataPath)
    : null;

  const propertySeed = fs.existsSync("property_seed.json")
    ? readJson("property_seed.json")
    : null;
  const unnormalizedAddress = fs.existsSync("unnormalized_address.json")
    ? readJson("unnormalized_address.json")
    : null;

  // Determine hyphenated parcel id from HTML
  let hyphenParcel = null;
  const parcelText = $("table.parcelIDtable b").first().text().trim();
  const mParcel = parcelText.match(
    /^(\d-\d{2}-\d{2}-\d{2}-[A-Z0-9]{3,}\-\d{5}\-\d{4})/,
  );
  if (mParcel) hyphenParcel = mParcel[1];
  if (!hyphenParcel) {
    const fmt = $('input[name="formatPIN"]').attr("value");
    if (fmt) hyphenParcel = fmt.trim();
  }

  // 1) OWNERS
  if (ownerData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const ownersScope = key && ownerData[key] ? ownerData[key] : null;
    if (
      ownersScope &&
      ownersScope.owners_by_date &&
      Array.isArray(ownersScope.owners_by_date.current)
    ) {
      const currentOwners = ownersScope.owners_by_date.current;
      let companyIndex = 0;
      let personIndex = 0;
      const companyFiles = [];
      const personFiles = [];
      for (const ow of currentOwners) {
        if (ow.type === "company") {
          companyIndex += 1;
          const company = { name: ow.name || null };
          writeJson(path.join("data", `company_${companyIndex}.json`), company);
          companyFiles.push(`./company_${companyIndex}.json`);
        } else if (ow.type === "person") {
          personIndex += 1;
          const person = {
            source_http_request: {
              method: "GET",
              url: "https://www.okeechobeepa.com/parcel-details"
            },
            request_identifier: hyphenParcel,
            birth_date: null,
            first_name: formatNameToPattern(ow.first_name),
            last_name: formatNameToPattern(ow.last_name),
            middle_name: ow.middle_name ? formatNameToPattern(ow.middle_name) : null,
            prefix_name: mapPrefixName(ow.prefix_name),
            suffix_name: mapSuffixName(ow.suffix_name),
            us_citizenship_status: null,
            veteran_status: null,
          };
          writeJson(path.join("data", `person_${personIndex}.json`), person);
          personFiles.push(`./person_${personIndex}.json`);
        }
      }
      globalThis.__ownerCompanyFiles = companyFiles;
      globalThis.__ownerPersonFiles = personFiles;
    }
  }

  // 2) UTILITIES
  if (utilitiesData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const utilScope = key && utilitiesData[key] ? utilitiesData[key] : null;
    if (utilScope) {
      writeJson(path.join("data", "utility.json"), { ...utilScope });
    }
  }

  // 3) LAYOUT
  if (layoutData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const layScope = key && layoutData[key] ? layoutData[key] : null;
    if (layScope && Array.isArray(layScope.layouts)) {
      let i = 0;
      for (const layout of layScope.layouts) {
        i += 1;
        writeJson(path.join("data", `layout_${i}.json`), layout);
      }
    }
  }

  // 4) SALES + DEEDS + FILES
  const salesRows = [];
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
    (idx, el) => {
      if (idx === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const dateTxt = $(tds[0]).text().trim();
        const priceTxt = $(tds[1]).text().trim();
        const bookPageTxt = $(tds[2]).text().trim();
        const deedCode = $(tds[3]).text().trim();
        if (dateTxt && /\d/.test(dateTxt)) {
          const linkEl = $(tds[2]).find("a");
          let clerkRef = null;
          const href = linkEl.attr("href") || "";
          const onClick = linkEl.attr("onclick") || "";
          const js = href || onClick;
          const m1 = js.match(/ClerkLink\('([^']+)'/);
          if (m1) clerkRef = m1[1];
          salesRows.push({
            dateTxt,
            priceTxt,
            deedCode,
            bookPageTxt,
            clerkRef,
          });
        }
      }
    },
  );

  const deedCodeMap = {
    "WD": "Warranty Deed",
    "WTY": "Warranty Deed",
    "SWD": "Special Warranty Deed",
    "SW": "Special Warranty Deed",
    "Spec WD": "Special Warranty Deed",
    "QCD": "Quitclaim Deed",
    "QC": "Quitclaim Deed",
    "Quitclaim": "Quitclaim Deed",
    "GD": "Grant Deed",
    "BSD": "Bargain and Sale Deed",
    "LBD": "Lady Bird Deed",
    "TOD": "Transfer on Death Deed",
    "TODD": "Transfer on Death Deed",
    "SD": "Sheriff's Deed",
    "Shrf's Deed": "Sheriff's Deed",
    "TD": "Tax Deed",
    "TrD": "Trustee's Deed",
    "Trustee Deed": "Trustee's Deed",
    "PRD": "Personal Representative Deed",
    "Pers Rep Deed": "Personal Representative Deed",
    "CD": "Correction Deed",
    "Corr Deed": "Correction Deed",
    "DIL": "Deed in Lieu of Foreclosure",
    "DILF": "Deed in Lieu of Foreclosure",
    "LED": "Life Estate Deed",
    "JTD": "Joint Tenancy Deed",
    "TIC": "Tenancy in Common Deed",
    "CPD": "Community Property Deed",
    "Gift Deed": "Gift Deed",
    "ITD": "Interspousal Transfer Deed",
    "Wild D": "Wild Deed",
    "SMD": "Special Master's Deed",
    "COD": "Court Order Deed",
    "CFD": "Contract for Deed",
    "QTD": "Quiet Title Deed",
    "AD": "Administrator's Deed",
    "GD (Guardian)": "Guardian's Deed",
    "RD": "Receiver's Deed",
    "ROW": "Right of Way Deed",
    "VPD": "Vacation of Plat Deed",
    "AOC": "Assignment of Contract",
    "ROC": "Release of Contract"
  };
  const fileDocTypeMap = {
    WD: "ConveyanceDeedWarrantyDeed",
    SW: "ConveyanceDeed",
  };

  const salesFiles = [];
  let saleIndex = 0,
    deedIndex = 0,
    fileIndex = 0;
  for (const row of salesRows) {
    saleIndex += 1;
    const sale = {
      ownership_transfer_date: parseDateToISO(row.dateTxt),
      purchase_price_amount: parseCurrencyToNumber(row.priceTxt),
    };
    writeJson(path.join("data", `sales_${saleIndex}.json`), sale);
    salesFiles.push(`./sales_${saleIndex}.json`);

    deedIndex += 1;
    const deed = {
      source_http_request: {
        method: "GET",
        url: "https://www.okeechobeepa.com/parcel-details"
      }
    };
    const mapped = deedCodeMap[row.deedCode];
    deed.deed_type = mapped || "Unknown Deed Type";
    writeJson(path.join("data", `deed_${deedIndex}.json`), deed);

    writeJson(path.join("data", `relationship_sales_deed_${saleIndex}.json`), {
      to: { "/": `./sales_${saleIndex}.json` },
      from: { "/": `./deed_${deedIndex}.json` },
    });

    fileIndex += 1;
    const fileRec = {
      document_type: fileDocTypeMap[row.deedCode] || null,
      file_format: null,
      name: row.clerkRef
        ? `Official Records ${row.clerkRef}`
        : row.bookPageTxt
          ? `Book/Page ${row.bookPageTxt}`
          : null,
      original_url: null,
      ipfs_url: null,
    };
    writeJson(path.join("data", `file_${fileIndex}.json`), fileRec);
    writeJson(path.join("data", `relationship_deed_file_${fileIndex}.json`), {
      to: { "/": `./deed_${deedIndex}.json` },
      from: { "/": `./file_${fileIndex}.json` },
    });
  }

  if (salesFiles.length > 0) {
    const mostRecentSale = salesFiles[0];
    const companies = globalThis.__ownerCompanyFiles || [];
    const persons = globalThis.__ownerPersonFiles || [];
    if (companies.length > 0) {
      companies.forEach((companyPath, idx) =>
        writeJson(
          path.join(
            "data",
            idx === 0
              ? "relationship_sales_company.json"
              : `relationship_sales_company_${idx + 1}.json`,
          ),
          { to: { "/": companyPath }, from: { "/": mostRecentSale } },
        ),
      );
    } else if (persons.length > 0) {
      persons.forEach((personPath, idx) =>
        writeJson(
          path.join(
            "data",
            idx === 0
              ? "relationship_sales_person.json"
              : `relationship_sales_person_${idx + 1}.json`,
          ),
          { to: { "/": personPath }, from: { "/": mostRecentSale } },
        ),
      );
    }
  }

  // 5) TAX
  function buildTaxFromSection(sectionTitleContains, taxYear) {
    let table = null;
    $("table.parcelDetails_insideTable").each((i, el) => {
      const head = $(el).find("tr").first().text();
      if (head && head.includes(sectionTitleContains)) {
        table = $(el);
        return false;
      }
      return true;
    });
    if (!table) return null;
    function findRow(label) {
      let out = null;
      table.find("tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 2) {
          const lab = $(tds[0]).text().trim();
          if (lab.startsWith(label)) {
            out = $(tds[1]).text().trim();
            return false;
          }
        }
        return true;
      });
      return out;
    }
    const land = findRow("Mkt Land");
    const bldg = findRow("Building");
    const just = findRow("Just");
    const assessed = findRow("Assessed");
    let taxable = null;
    table.find("tr").each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (label.startsWith("Total")) {
          const html = $(tds[1]).html() || "";
          const m = html.replace(/\n/g, " ").match(/county:\s*\$([0-9,\.]+)/i);
          if (m) taxable = m[1];
          else {
            const text = $(tds[1]).text();
            const m2 = text.match(/\$[0-9,\.]+/);
            if (m2) taxable = m2[0];
          }
        }
      }
    });
    if (!land || !bldg || !just || !assessed || !taxable) return null;
    return {
      tax_year: taxYear,
      property_assessed_value_amount: parseCurrencyToNumber(assessed),
      property_market_value_amount: parseCurrencyToNumber(just),
      property_building_amount: parseCurrencyToNumber(bldg),
      property_land_amount: parseCurrencyToNumber(land),
      property_taxable_value_amount: parseCurrencyToNumber(taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
  }
  const tax2024 = buildTaxFromSection("2024 Certified Values", 2024);
  if (tax2024) writeJson(path.join("data", "tax_2024.json"), tax2024);
  const tax2025 = buildTaxFromSection("2025 Preliminary Values", 2025);
  if (tax2025) writeJson(path.join("data", "tax_2025.json"), tax2025);

  // 6) PROPERTY
  try {
    const parcelIdentifier =
      propertySeed && propertySeed.parcel_id
        ? propertySeed.parcel_id
        : $('input[name="PARCELID_Buffer"]').attr("value") || null;

    // Clean full legal text without UI anchor artifacts
    let legal = null;
    if ($("#Flegal").length) {
      const f = $("#Flegal").clone();
      f.find("a").remove();
      legal = f.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
    } else if ($("#Blegal").length) {
      const b = $("#Blegal").clone();
      b.find("a").remove();
      legal = b.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
    }

    // livable and effective year
    let livable = null,
      effYear = null;
    const bldgTable = $(
      "#parcelDetails_BldgTable table.parcelDetails_insideTable",
    ).first();
    if (bldgTable && bldgTable.length) {
      const firstRow = bldgTable.find("tr").eq(1);
      const tds = firstRow.find("td");
      if (tds.length >= 6) {
        const actualSF = tds.eq(4).text().trim();
        if (actualSF) livable = actualSF;
        const y = tds.eq(2).text().trim();
        if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
      }
    }

    // Extract Area and convert to square feet
    let totalAreaSqft = null;
    const areaText = $('td:contains("Area")')
      .filter((i, el) => $(el).text().trim() === "Area")
      .next()
      .text()
      .trim();
    if (areaText) {
      const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
      if (acreMatch) {
        const acres = parseFloat(acreMatch[1]);
        totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
      }
    }

    // Extract Use Code and map to property_type
    const useCodeVal = $('td')
      .filter((i, el) => $(el).text().trim().startsWith('Use'))
      .next()
      .text()
      .trim();
    
    function mapPropertyType(useCode) {
      if (!useCode) return null;
      const code = useCode.toUpperCase();
      if (/VACANT|0000/.test(code)) return "VacantLand";
      if (/SINGLE|SFR|0100/.test(code)) return "SingleFamily";
      if (/DUPLEX|0200/.test(code)) return "Duplex";
      if (/2\s*UNIT|TWO.UNIT/.test(code)) return "2Units";
      if (/3\s*UNIT|THREE.UNIT|TRIPLEX/.test(code)) return "3Units";
      if (/4\s*UNIT|FOUR.UNIT|FOURPLEX/.test(code)) return "4Units";
      if (/MULTI.FAM\s*10\+|MULTI.FAMILY\s*10\+|0300/.test(code)) return "MultiFamilyMoreThan10";
      if (/MULTI.FAM|MULTI.FAMILY|MULTIPLE.FAMILY/.test(code) && !/10\+/.test(code)) return "MultiFamilyLessThan10";
      if (/CONDO|CONDOMINIUM|0500/.test(code)) return "Condominium";
      if (/DETACHED.CONDO/.test(code)) return "DetachedCondominium";
      if (/NON.WARRANTABLE.CONDO/.test(code)) return "NonWarrantableCondo";
      if (/TOWNHOUSE|TOWN.HOUSE|0600/.test(code)) return "Townhouse";
      if (/MOBILE|0700/.test(code)) return "MobileHome";
      if (/MANUFACTURED.HOUSING.SINGLE/.test(code)) return "ManufacturedHousingSingleWide";
      if (/MANUFACTURED.HOUSING.MULTI/.test(code)) return "ManufacturedHousingMultiWide";
      if (/MANUFACTURED.HOUSING|MANUFACTURED/.test(code)) return "ManufacturedHousing";
      if (/APARTMENT|0800/.test(code)) return "Apartment";
      if (/COOPERATIVE|COOP|0900/.test(code)) return "Cooperative";
      if (/MODULAR|1000/.test(code)) return "Modular";
      if (/PUD|1100/.test(code)) return "Pud";
      if (/TIMESHARE|1200/.test(code)) return "Timeshare";
      if (/RETIREMENT|1300/.test(code)) return "Retirement";
      if (/RESIDENTIAL.COMMON/.test(code)) return "ResidentialCommonElementsAreas";
      raiseEnumError(useCode, "property.property_type");
      return null;
    }
    
    const property_type_mapped = mapPropertyType(useCodeVal);

    const prop = {
      source_http_request: {
        method: "GET",
        url: "https://www.okeechobeepa.com/parcel-details"
      },
      request_identifier: hyphenParcel,
      livable_floor_area: livable ? String(livable) : null,
      parcel_identifier: parcelIdentifier || null,
      property_legal_description_text: legal || null,
      property_structure_built_year: effYear || null,
      property_effective_built_year: effYear || null,
      property_type: property_type_mapped || "MiscellaneousResidential",
      area_under_air: livable ? String(livable) : null,
      historic_designation: false,
      number_of_units: null,
      number_of_units_type: null,
      subdivision: null,
      total_area: totalAreaSqft,
      zoning: null,
    };
    writeJson(path.join("data", "property.json"), prop);
  } catch (e) {}

  // 7) LOT
  try {
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable tr",
    ).eq(1);
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 6) {
      const unitsTxt = tds.eq(2).text();
      const mSf = unitsTxt.match(/([0-9,.]+)\s*SF/i);
      const mAc = unitsTxt.match(/\(([^)]+)\s*AC\)/i);
      if (mSf) lotAreaSqft = Math.round(parseFloat(mSf[1].replace(/[,]/g, "")));
      if (mAc) lotSizeAcre = parseFloat(mAc[1].replace(/[,]/g, ""));
    }
    let lot_type = null;
    if (typeof lotSizeAcre === "number")
      lot_type =
        lotSizeAcre > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
    writeJson(path.join("data", "lot.json"), {
      lot_type: lot_type || null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_area_sqft: lotAreaSqft || null,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null,
      lot_size_acre: lotSizeAcre || null,
    });
  } catch (e) {}

  // 8) ADDRESS
  try {
    if (unnormalizedAddress && unnormalizedAddress.full_address) {
      const full = unnormalizedAddress.full_address.trim();
      let street_number = null,
        pre = null,
        street_name = null,
        suffix = null,
        city = null,
        state = null,
        zip = null,
        plus4 = null;
      const parts = full.split(",");
      if (parts.length >= 2) {
        const line1 = parts[0].trim();
        const cityPart = parts[1].trim();
        const stateZipPart = parts[2] ? parts[2].trim() : "";
        const m1 = line1.match(/^(\d+)\s+([NESW]{1,2})\s+(.+?)\s+([A-Z]+)$/);
        if (m1) {
          street_number = m1[1];
          pre = m1[2];
          street_name = m1[3].trim();
          suffix = m1[4];
        }
        city = cityPart.toUpperCase();
        const m3 = stateZipPart.match(/^([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/);
        if (m3) {
          state = m3[1];
          zip = m3[2];
          plus4 = m3[3] || null;
        }
      }
      const suffixMap = {
        RD: "Rd",
        ROAD: "Rd",
        ST: "St",
        STREET: "St",
        AVE: "Ave",
        AVENUE: "Ave",
        BLVD: "Blvd",
        DR: "Dr",
        DRIVE: "Dr",
        LN: "Ln",
        LANE: "Ln",
        CT: "Ct",
        COURT: "Ct",
        TER: "Ter",
        TERRACE: "Ter",
        HWY: "Hwy",
        PKWY: "Pkwy",
        PL: "Pl",
        WAY: "Way",
        CIR: "Cir",
        PLZ: "Plz",
        TRL: "Trl",
        RTE: "Rte",
      };
      const street_suffix_type = suffix
        ? suffixMap[suffix.toUpperCase()] || null
        : null;
      let section = null,
        township = null,
        range = null;
      const strTxt = $('td:contains("S/T/R")')
        .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
        .first()
        .next()
        .text()
        .trim();
      if (strTxt && /\d{2}-\d{2}-\d{2}/.test(strTxt)) {
        const parts2 = strTxt.split("-");
        section = parts2[0];
        township = parts2[1];
        range = parts2[2];
      }
      writeJson(path.join("data", "address.json"), {
        street_number: street_number || null,
        street_pre_directional_text: pre || null,
        street_name: street_name ? street_name.toUpperCase() : null,
        street_suffix_type: street_suffix_type || null,
        street_post_directional_text: null,
        unit_identifier: null,
        city_name: city || null,
        state_code: state || null,
        postal_code: zip || null,
        plus_four_postal_code: plus4 || null,
        county_name: "Okeechobee",
        country_code: "US",
        latitude:
          typeof unnormalizedAddress.latitude === "number"
            ? unnormalizedAddress.latitude
            : null,
        longitude:
          typeof unnormalizedAddress.longitude === "number"
            ? unnormalizedAddress.longitude
            : null,
        route_number: null,
        township: township || null,
        range: range || null,
        section: section || null,
        lot: null,
        block: null,
        municipality_name: null,
      });
    }
  } catch (e) {}
}

main();
