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
  let cleaned = name.trim();

  // Replace forward slashes with hyphens to conform to the schema pattern
  // This is a logical replacement as '/' often implies a separation similar to '-'
  cleaned = cleaned.replace(/\//g, '-');

  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Split by spaces, hyphens, apostrophes, commas, periods, keeping the delimiters
  return cleaned.split(/([ \-',.])/)
    .map((part) => {
      if (!part) return ''; // Handle empty parts from splitting
      if (part.match(/[ \-',.]/)) { // If it's a delimiter, return it as is
        return part;
      }
      // For actual name parts, capitalize the first letter and lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
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
  // Updated selector for parcel ID
  const parcelText = $("table.parcelIDtable b").first().text().trim();
  const mParcel = parcelText.match(/^([^\s(]+)/); // Matches "23-4S-16-03099-117 (14877)"
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
              url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
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
  // Updated selector for sales table
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
    (idx, el) => {
      if (idx === 0) return; // Skip header row
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
          // Extract book and page from ClerkLink('book','page')
          const m1 = js.match(/ClerkLink\('([^']+)'\s*,\s*'([^']+)'\)/);
          if (m1) clerkRef = `${m1[1]}/${m1[2]}`; // Format as "book/page"
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
    "ROC": "Release of Contract",
    "LC": "Land Contract",
    "MTG": "Mortgage",
    "LIS": "Lis Pendens",
    "EASE": "Easement",
    "AGMT": "Agreement",
    "AFF": "Affidavit",
    "ORD": "Order",
    "CERT": "Certificate",
    "RES": "Resolution",
    "DECL": "Declaration",
    "COV": "Covenant",
    "SUB": "Subordination",
    "MOD": "Modification",
    "REL": "Release",
    "ASSG": "Assignment",
    "LEAS": "Lease",
    "TR": "Trust",
    "WILL": "Will",
    "PROB": "Probate",
    "JUDG": "Judgment",
    "LIEN": "Lien",
    "SAT": "Satisfaction",
    "PART": "Partition",
    "EXCH": "Exchange",
    "CONV": "Conveyance",
    "OTH": "Other",
    "PR": "Personal Representative Deed" // Added PR for the sample
  };

  // UPDATED fileDocTypeMap to match schema enum values
  const fileDocTypeMap = {
    WD: "ConveyanceDeedWarrantyDeed",
    WTY: "ConveyanceDeedWarrantyDeed",
    SWD: "ConveyanceDeedSpecialWarrantyDeed",
    SW: "ConveyanceDeedSpecialWarrantyDeed",
    "Spec WD": "ConveyanceDeedSpecialWarrantyDeed",
    QCD: "ConveyanceDeedQuitClaimDeed",
    QC: "ConveyanceDeedQuitClaimDeed",
    Quitclaim: "ConveyanceDeedQuitClaimDeed",
    GD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    BSD: "ConveyanceDeedBargainAndSaleDeed",
    LBD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    TOD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    TODD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    SD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Shrf's Deed": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    TD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    TrD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Trustee Deed": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    PRD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Pers Rep Deed": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    CD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Corr Deed": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    DIL: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    DILF: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    LED: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    JTD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    TIC: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    CPD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Gift Deed": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    ITD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "Wild D": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    SMD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    COD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    CFD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    QTD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    AD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    "GD (Guardian)": "ConveyanceDeed", // Mapped to general ConveyanceDeed
    RD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    ROW: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    VPD: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    AOC: "Assignment", // Mapped to general Assignment
    ROC: null, // No direct match in schema
    LC: null, // No direct match in schema
    MTG: null, // No direct match in schema
    LIS: null, // No direct match in schema
    EASE: null, // No direct match in schema
    AGMT: null, // No direct match in schema
    AFF: "Affidavit",
    ORD: null, // No direct match in schema
    CERT: null, // No direct match in schema
    RES: null, // No direct match in schema
    DECL: null, // No direct match in schema
    COV: null, // No direct match in schema
    SUB: null, // No direct match in schema
    MOD: null, // No direct match in schema
    REL: null, // No direct match in schema
    ASSG: "Assignment",
    LEAS: null, // No direct match in schema
    TR: null, // No direct match in schema
    WILL: null, // No direct match in schema
    PROB: null, // No direct match in schema
    JUDG: "AbstractOfJudgment", // Mapped to AbstractOfJudgment
    LIEN: null, // No direct match in schema
    SAT: null, // No direct match in schema
    PART: null, // No direct match in schema
    EXCH: null, // No direct match in schema
    CONV: "ConveyanceDeed", // Mapped to general ConveyanceDeed
    OTH: null, // No direct match in schema
    PR: "ConveyanceDeed" // Added PR for the sample
  };


  let salesFiles = [];
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
        url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
      }
    };
    const mappedDeedType = deedCodeMap[row.deedCode] || "Unknown Deed Type";
    deed.deed_type = mappedDeedType;
    writeJson(path.join("data", `deed_${deedIndex}.json`), deed);

    writeJson(path.join("data", `relationship_sales_deed_${saleIndex}.json`), {
      to: { "/": `./sales_${saleIndex}.json` },
      from: { "/": `./deed_${deedIndex}.json` },
    });

    fileIndex += 1;
    const fileRec = {
      document_type: fileDocTypeMap[row.deedCode] || null,
      file_format: null, // Schema requires this, but it's not extracted. Setting to null.
      name: row.clerkRef
        ? `Official Records ${row.clerkRef}`
        : row.bookPageTxt
          ? `Book/Page ${row.bookPageTxt}`
          : null,
      original_url: null, // Schema requires this, but it's not extracted. Setting to null.
      ipfs_url: null, // Schema requires this, but it's not extracted. Setting to null.
      request_identifier: hyphenParcel, // Schema requires this
      source_http_request: { // Schema requires this
        method: "GET",
        url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
      }
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
    // Updated selector for tax tables
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
          const htmlContent = $(tds[1]).html() || "";
          // Look for "county:$" pattern first
          const m = htmlContent.replace(/\n/g, " ").match(/county:\s*\$([0-9,\.]+)/i);
          if (m) taxable = m[1];
          else {
            // Fallback to general currency regex if "county:" not found
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
  const tax2025 = buildTaxFromSection("2025 Preliminary Values", 2025); // Updated section title to match sample HTML
  if (tax2025) writeJson(path.join("data", "tax_2025.json"), tax2025);
  const tax2024 = buildTaxFromSection("2024 Certified Values", 2024); // Added 2026 tax data from sample HTML
  if (tax2024) writeJson(path.join("data", "tax_2024.json"), tax2024);

  // 6) PROPERTY
  const parcelIdentifier =
    propertySeed && propertySeed.parcel_id
      ? propertySeed.parcel_id
      : hyphenParcel || null; // Use hyphenParcel if propertySeed is not available

  // Clean full legal text without UI anchor artifacts
  let legal = null;
  // Updated selectors for legal description
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
  // Updated selector for building table
  const bldgTable = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable",
  ).first();
  if (bldgTable && bldgTable.length) {
    const firstRow = bldgTable.find("tr").eq(1); // Assuming the first data row is the main building
    const tds = firstRow.find("td");
    if (tds.length >= 6) {
      const actualSF = tds.eq(4).text().trim(); // Actual SF is at index 4
      if (actualSF && actualSF !== "N O N E") livable = actualSF;
      const y = tds.eq(2).text().trim(); // Year Blt is at index 2
      if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
    }
  }

  // Extract Area and convert to square feet
  let totalAreaSqft = null;
  // Updated selector for Land Area
  const landAreaTd = $('td:contains("Area")').first();
  if (landAreaTd.length) {
    const areaText = landAreaTd.next('td').text().trim();
    const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
    }
  }


  // Extract Use Code and map to property_type
  // Updated selector for Use Code
  const useCodeVal = $('td')
    .filter((i, el) => $(el).text().trim().startsWith('Use'))
    .next()
    .text()
    .trim();

  const propertyTypeMapping = [
    {
      "desoto_property_type": "0000 - Vacant Residential",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "0004 - Vacant Condo",
      "ownership_estate_type": "Condominium",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "0100 - Single Family",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "SingleFamilyDetached",
      "property_usage_type": "Residential",
      "property_type": "SingleFamily"
    },
    {
      "desoto_property_type": "0107 - Townhomes",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "TownhouseRowhouse",
      "property_usage_type": "Residential",
      "property_type": "Townhouse"
    },
    {
      "desoto_property_type": "0200 - Mobile Homes",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MobileHome",
      "property_usage_type": "Residential",
      "property_type": "MobileHome"
    },
    {
      "desoto_property_type": "0300 - Multi-Family(10 or more Units)",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamily5Plus",
      "property_usage_type": "Residential",
      "property_type": "MultiFamilyMoreThan10"
    },
    {
      "desoto_property_type": "0400 - Condominium",
      "ownership_estate_type": "Condominium",
      "build_status": "Improved",
      "structure_form": "ApartmentUnit",
      "property_usage_type": "Residential",
      "property_type": "Condominium"
    },
    {
      "desoto_property_type": "0600 - Retirement Homes Not Eligible",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Retirement",
      "property_type": "Retirement"
    },
    {
      "desoto_property_type": "0700 - Miscellaneous Residential",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "MiscellaneousResidential"
    },
    {
      "desoto_property_type": "0800 - Multi-Family(Less than 10 Units)",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamilyLessThan10",
      "property_usage_type": "Residential",
      "property_type": "MultiFamilyLessThan10"
    },
    {
      "desoto_property_type": "0805 - MFR < 10 Units - Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamilyLessThan10",
      "property_usage_type": "Commercial",
      "property_type": "MultiFamilyLessThan10"
    },
    {
      "desoto_property_type": "0900 - Residential Common Elements/Areas",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ResidentialCommonElementsAreas",
      "property_type": "ResidentialCommonElementsAreas"
    },
    {
      "desoto_property_type": "1000 - Vacant Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "1100 - Stores, One Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "RetailStore",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1200 - Mixed Use, Store/Office/Resi",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1300 - Department Store",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "DepartmentStore",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1400 - Supermarkets",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Supermarket",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1500 - Regional Shopping Centers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ShoppingCenterRegional",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1600 - Community Shopping Centers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ShoppingCenterCommunity",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1700 - Office Buildings One Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OfficeBuilding",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1800 - Office Buildings Multi-Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OfficeBuilding",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1900 - Office Buildings Medical",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MedicalOffice",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2000 - Airports, Terminals, Piers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "TransportationTerminal",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2100 - Restaurants, Cafeterias",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Restaurant",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2200 - Drive In Restaurants",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Restaurant",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2300 - Financial Institutions",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "FinancialInstitution",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2500 - Repair Service Shops",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2600 - Service Stations",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ServiceStation",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2700 - Auto Sales, Repair & Related",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "AutoSalesRepair",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2800 - Parking Lots, Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "3200 - Enclosed Theatres/Auditoriums",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Theater",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3300 - Night Clubs, Lounges, Bars",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3400 - Bowling, Skating, Pool Enclose",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3500 - Tourist Attraction, Exhibits",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3800 - Golf Courses, Driving Ranges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GolfCourse",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3900 - Hotels, Motels",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Hotel",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4000 - Vacant Industrial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Industrial",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "4100 - Light Industrial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "LightManufacturing",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4800 - Warehousing, Distribution",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Warehouse",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4900 - Open Storage, Supply/Junkyards",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OpenStorage",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "5000 - Improved Agriculture",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Agricultural",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "5100 - Cropland, Class I",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "DrylandCropland",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5200 - Cropland, Class II",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "CroplandClass2",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5400 - Timberland, Index 90+",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5500 - Timberland, Index 80-90",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5600 - Timberland, Index 70-79",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5700 - Timberland, Index 60-69",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5800 - Timberland, Index 50-59",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5900 - Timberland, Not Classed",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6000 - Grazing, Class I",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6100 - Grazing, Class II",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6200 - Grazing, Class III",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6300 - Grazing, Class IV",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6600 - Orchard, Groves, Citrus",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "OrchardGroves",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6700 - Poultry, Bees, Fish",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Poultry",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6900 - Ornamentals, Misc",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Ornamentals",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "7000 - Vacant Institutional",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "7100 - Churches",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Church",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7200 - Private Schools/Colleges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PrivateSchool",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7300 - Privately Owned Hospitals",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PrivateHospital",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7400 - Homes for the Aged",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Retirement",
      "property_type": "Retirement"
    },
    {
      "desoto_property_type": "7500 - Orphanages, Other Services",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "NonProfitCharity",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7600 - Mortuaries, Cemeteries",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MortuaryCemetery",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7700 - Clubs, Lodges, Union Halls",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ClubsLodges",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7900 - Cultural Organization Facil",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "CulturalOrganization",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8000 - Vacant Governmental",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "8100 - Military",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Military",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8200 - Forest, Parks, Recreation Area",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ForestParkRecreation",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "8300 - Public County School",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PublicSchool",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8400 - Colleges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "CulturalOrganization",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8500 - Hospitals",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PublicHospital",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8600 - County",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8700 - State",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8800 - Federal",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8900 - Municipal",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "9100 - Utilities",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Utility",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9200 - Mining, Petrolium/Gas",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MineralProcessing",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "9400 - Rights-of-Way",
      "ownership_estate_type": "RightOfWay",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Unknown",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "9500 - Rivers, Lakes, Submerged Lands",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "RiversLakes",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9600 - Sewage Disposal, Solid Waste",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "SewageDisposal",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9700 - Outdoor Recreational",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Recreational",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9800 - Centrally Assessed/Railroads",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Railroad",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9900 - Vacant Acreage, Not Agri",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TransitionalProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "9901 - Imp acre, Not Agri",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "TransitionalProperty",
      "property_type": "LandParcel"
    }
  ];

  let mappedProperty = null;
  if (useCodeVal) {
    const codeMatch = useCodeVal.match(/\((\d{4})\)/);
    const code = codeMatch ? codeMatch[1] : null;

    if (code) {
      const desotoPropertyType = propertyTypeMapping.find(
        (item) => item.desoto_property_type && item.desoto_property_type.startsWith(code)
      );
      if (desotoPropertyType) {
        mappedProperty = desotoPropertyType;
      }
    }
  }

  if (!mappedProperty) {
    raiseEnumError(useCodeVal, "property.property_type");
    // Default to a generic type if not found to avoid script failure, or handle as an error
    mappedProperty = {
      property_type: "Unknown",
      ownership_estate_type: null,
      build_status: null,
      structure_form: null,
      property_usage_type: "Unknown"
    };
  }

  // Function to determine number_of_units_type based on property_type
  function getNumberOfUnitsType(propertyType) {
    switch (propertyType) {
      case "SingleFamily":
      case "Condominium":
      case "DetachedCondominium":
      case "NonWarrantableCondo":
      case "Townhouse":
      case "MobileHome":
      case "ManufacturedHousingSingleWide":
      case "ManufacturedHousingMultiWide":
      case "ManufacturedHousing":
      case "Apartment":
      case "Cooperative":
      case "Modular":
      case "Pud":
      case "Timeshare":
      case "Retirement":
      case "MiscellaneousResidential":
      case "ResidentialCommonElementsAreas":
        return "One";
      case "Duplex":
      case "TwoUnit":
        return "Two";
      case "ThreeUnit":
        return "Three";
      case "FourUnit":
        return "Four";
      case "MultiFamilyLessThan10":
      case "MultiFamilyMoreThan10":
        return "OneToFour"; // Assuming these could be 2-4 units or more, but less than 10
      default:
        return null;
    }
  }

  const number_of_units_type_mapped = getNumberOfUnitsType(mappedProperty.property_type);

  const prop = {
    source_http_request: {
      method: "GET",
      url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
    },
    request_identifier: hyphenParcel,
    livable_floor_area: livable ? String(livable) : null,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: legal || null,
    property_structure_built_year: effYear || null,
    property_effective_built_year: effYear || null,
    property_type: mappedProperty.property_type,
    ownership_estate_type: mappedProperty.ownership_estate_type,
    build_status: mappedProperty.build_status,
    structure_form: mappedProperty.structure_form,
    property_usage_type: mappedProperty.property_usage_type,
    area_under_air: livable ? String(livable) : null,
    historic_designation: false,
    number_of_units: null, // This is an integer, not the enum type
    number_of_units_type: number_of_units_type_mapped, // Added this required field
    subdivision: null,
    total_area: totalAreaSqft,
    zoning: null,
  };
  writeJson(path.join("data", "property.json"), prop);


  // 7) LOT
  try {
    // Updated selector for land table
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable tr"
    ).eq(1); // Assuming the first data row in Land Breakdown
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 6) {
      const unitsTxt = tds.eq(2).text(); // e.g., "1.070 AC"
      const mSf = unitsTxt.match(/([0-9,.]+)\s*SF/i);
      const mAc = unitsTxt.match(/([0-9,.]+)\s*AC/i); // Changed regex to directly capture AC value
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
  } catch (e) {
    console.error("Error processing lot data:", e);
  }

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
        const line1 = parts[0].trim(); // "3936 SE 20TH AVE"
        const cityPart = parts[1].trim(); // "KEYSTONE HEIGHTS"
        const stateZipPart = parts[2] ? parts[2].trim() : ""; // "FL 32656"

        // Regex to parse "3936 SE 20TH AVE"
        const m1 = line1.match(/^(\d+)\s+([NESW]{1,2})?\s*(.+?)\s+(?:(AVE|BLVD|CIR|CT|DR|HWY|LN|PKWY|PL|RD|RTE|ST|TER|TRL|WAY|AVENUE|BOULEVARD|CIRCLE|COURT|DRIVE|HIGHWAY|LANE|PARKWAY|PLACE|ROAD|ROUTE|STREET|TERRACE|TRAIL))?$/i);
        if (m1) {
          street_number = m1[1];
          pre = m1[2] ? m1[2].toUpperCase() : null;
          street_name = m1[3].trim();
          suffix = m1[4] ? m1[4].toUpperCase() : null;
        } else {
          // Fallback for simpler street names without directional or suffix
          const m1_simple = line1.match(/^(\d+)\s+(.+)$/);
          if (m1_simple) {
            street_number = m1_simple[1];
            street_name = m1_simple[2].trim();
          }
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
        RD: "Rd", ROAD: "Rd", ST: "St", STREET: "St", AVE: "Ave", AVENUE: "Ave",
        BLVD: "Blvd", BOULEVARD: "Blvd", DR: "Dr", DRIVE: "Dr", LN: "Ln", LANE: "Ln",
        CT: "Ct", COURT: "Ct", TER: "Ter", TERRACE: "Ter", HWY: "Hwy", HIGHWAY: "Hwy",
        PKWY: "Pkwy", PARKWAY: "Pkwy", PL: "Pl", PLACE: "Pl", WAY: "Way", CIR: "Cir",
        CIRCLE: "Cir", PLZ: "Plz", TRL: "Trl", TRAIL: "Trl", RTE: "Rte", ROUTE: "Rte",
      };
      const street_suffix_type = suffix
        ? suffixMap[suffix.toUpperCase()] || null
        : null;

      let section = null,
        township = null,
        range = null;
      // Updated selector for S/T/R
      const strTxt = $('td:contains("S/T/R")')
        .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
        .first()
        .next()
        .text()
        .trim(); // "10-5S-16"
      if (strTxt && /\d{1,2}-\d{1,2}[A-Z]-\d{1,2}/.test(strTxt)) { // Updated regex for "10-5S-16"
        const parts2 = strTxt.split("-");
        section = parts2[0];
        township = parts2[1]; // e.g., "5S"
        range = parts2[2]; // e.g., "16"
      }

      // Check if street_name contains directional abbreviations and adjust if necessary
      let final_street_name = street_name ? street_name.toUpperCase() : null;
      if (final_street_name && (/\bE\b|\bN\b|\bNE\b|\bNW\b|\bS\b|\bSE\b|\bSW\b|\bW\b/.test(final_street_name))) {
        // If a directional is part of the street_name, remove it and set pre-directional
        const streetNameParts = final_street_name.split(' ');
        const directional = streetNameParts.find(part => ['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W'].includes(part));
        if (directional) {
          pre = directional;
          final_street_name = streetNameParts.filter(part => part !== directional).join(' ');
        }
      }


      writeJson(path.join("data", "address.json"), {
        street_number: street_number || null,
        street_pre_directional_text: pre || null,
        street_name: final_street_name,
        street_suffix_type: street_suffix_type || null,
        street_post_directional_text: null,
        unit_identifier: null,
        city_name: city || null,
        state_code: state || null,
        postal_code: zip || null,
        plus_four_postal_code: plus4 || null,
        county_name: "DeSoto", // Hardcoded as per the HTML source
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
  } catch (e) {
    console.error("Error processing address data:", e);
  }
}

main();