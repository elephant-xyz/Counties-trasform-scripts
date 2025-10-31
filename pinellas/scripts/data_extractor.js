const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function parseCurrencyToNumber(txt) {
  if (!txt) return null;
  const n = txt.replace(/[^0-9.\-]/g, "");
  if (!n) return null;
  const num = parseFloat(n);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function parseIntSafe(txt) {
  if (txt == null) return null;
  const m = String(txt).replace(/[^0-9\-]/g, "");
  if (!m) return null;
  const v = parseInt(m, 10);
  return isNaN(v) ? null : v;
}

function parseFloatSafe(txt) {
  if (txt == null) return null;
  const m = String(txt).replace(/[^0-9.\-]/g, "");
  if (!m) return null;
  const v = parseFloat(m);
  return isNaN(v) ? null : v;
}

function toISODate(dstr) {
  if (!dstr) return null;
  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };
  const m1 = dstr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const dd = m1[1].padStart(2, "0");
    const mm = months[m1[2].substr(0, 3)] || null;
    const yyyy = m1[3];
    if (mm) return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = dstr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const mm = m2[1].padStart(2, "0");
    const dd = m2[2].padStart(2, "0");
    const yyyy = m2[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const m3 = dstr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m3) return dstr;
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])(\w*)/g, (m, a, b) => a.toUpperCase() + b);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

// --- HELPER FUNCTIONS FOR HTML EXTRACTION ---

/**
 * Extracts text content from a Cheerio element, trims it, and returns null if empty.
 * @param {cheerio.Cheerio<cheerio.Element>} element
 * @returns {string | null}
 */
function getTextOrNull(element) {
  const text = element.text().trim();
  return text === "" ? null : text;
}

/**
 * Extracts the value attribute from a Cheerio element, trims it, and returns null if empty.
 * @param {cheerio.Cheerio<cheerio.Element>} element
 * @returns {string | null}
 */
function getValueOrNull(element) {
  const value = element.val();
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  }
  return null;
}

/**
 * Parses a full address string into its components.
 * @param {string | null} fullAddress
 * @returns {{street_number: string | null, street_name: string | null, street_suffix_type: string | null, city: string | null, state: string | null, zip: string | null}}
 */
function parseFullAddress(fullAddress) {
  let street_number = null;
  let street_name = null;
  let street_suffix_type = null;
  let city = null;
  let state = null;
  let zip = null;

  if (!fullAddress) {
    return { street_number, street_name, street_suffix_type, city, state, zip };
  }
  // Replace <br/> with a space for easier parsing, then split by comma
  const parts = fullAddress.replace(/<br\s*\/?>/gi, ' ').split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length > 0) {
    // First part is typically street address
    const streetPart = parts[0];
    const streetTokens = streetPart.split(/\s+/);
    if (streetTokens.length > 0) {
      street_number = streetTokens[0];
      // Attempt to identify common street suffixes
      const suffixRegex = /(RDS|BLVD|LK|PIKE|KY|VW|CURV|PSGE|LDG|MT|UN|MDW|VIA|COR|KYS|VL|PR|CV|ISLE|LGT|HBR|BTM|HL|MEWS|HLS|PNES|LGTS|STRM|HWY|TRWY|SKWY|IS|EST|VWS|AVE|EXTS|CVS|ROW|RTE|FALL|GTWY|WLS|CLB|FRK|CPE|FWY|KNLS|RDG|JCT|RST|SPGS|CIR|CRST|EXPY|SMT|TRFY|CORS|LAND|UNS|JCTS|WAYS|TRL|WAY|TRLR|ALY|SPG|PKWY|CMN|DR|GRNS|OVAL|CIRS|PT|SHLS|VLY|HTS|CLF|FLT|MALL|FRDS|CYN|LNDG|MDWS|RD|XRDS|TER|PRT|RADL|GRVS|RDGS|INLT|TRAK|BYU|VLGS|CTR|ML|CTS|ARC|BND|RIV|FLDS|MTWY|MSN|SHRS|RUE|CRSE|CRES|ANX|DRS|STS|HOLW|VLG|PRTS|STA|FLD|XRD|WALL|TPKE|FT|BG|KNL|PLZ|ST|CSWY|BGS|RNCH|FRKS|LN|MTN|CTRS|ORCH|ISS|BRKS|BR|FLS|TRCE|PARK|GDNS|RPDS|SHL|LF|RPD|LCKS|GLN|PL|PATH|VIS|LKS|RUN|FRG|BRG|SQS|XING|PLN|GLNS|BLFS|PLNS|DL|CLFS|EXT|PASS|GDN|BRK|GRN|MNR|CP|PNE|SPUR|OPAS|UPAS|TUNL|SQ|LCK|ESTS|SHR|DM|MLS|WL|MNRS|STRA|FRGS|FRST|FLTS|CT|MTNS|FRD|NCK|RAMP|VLYS|PTS|BCH|LOOP|BYP|CMNS|FRY|WALK|HBRS|DV|HVN|BLF|GRV|CR)\.?$/i;

      
      const lastToken = streetTokens[streetTokens.length - 1];
      if (suffixRegex.test(lastToken)) {
        const candidateSuffix = titleCaseName(lastToken).replace(/\./g, ''); // Remove potential dot
        // Validate against schema enum values
        const validSuffixes = ["Rds","Blvd","Lk","Pike","Ky","Vw","Curv","Psge","Ldg","Mt","Un","Mdw","Via","Cor","Kys","Vl","Pr","Cv","Isle","Lgt","Hbr","Btm","Hl","Mews","Hls","Pnes","Lgts","Strm","Hwy","Trwy","Skwy","Is","Est","Vws","Ave","Exts","Cvs","Row","Rte","Fall","Gtwy","Wls","Clb","Frk","Cpe","Fwy","Knls","Rdg","Jct","Rst","Spgs","Cir","Crst","Expy","Smt","Trfy","Cors","Land","Uns","Jcts","Ways","Trl","Way","Trlr","Aly","Spg","Pkwy","Cmn","Dr","Grns","Oval","Cirs","Pt","Shls","Vly","Hts","Clf","Flt","Mall","Frds","Cyn","Lndg","Mdws","Rd","Xrds","Ter","Prt","Radl","Grvs","Rdgs","Inlt","Trak","Byu","Vlgs","Ctr","Ml","Cts","Arc","Bnd","Riv","Flds","Mtwy","Msn","Shrs","Rue","Crse","Cres","Anx","Drs","Sts","Holw","Vlg","Prts","Sta","Fld","Xrd","Wall","Tpke","Ft","Bg","Knl","Plz","St","Cswy","Bgs","Rnch","Frks","Ln","Mtn","Ctrs","Orch","Iss","Brks","Br","Fls","Trce","Park","Gdns","Rpds","Shl","Lf","Rpd","Lcks","Gln","Pl","Path","Vis","Lks","Run","Frg","Brg","Sqs","Xing","Pln","Glns","Blfs","Plns","Dl","Clfs","Ext","Pass","Gdn","Brk","Grn","Mnr","Cp","Pne","Spur","Opas","Upas","Tunl","Sq","Lck","Ests","Shr","Dm","Mls","Wl","Mnrs","Stra","Frgs","Frst","Flts","Ct","Mtns","Frd","Nck","Ramp","Vlys","Pts","Bch","Loop","Byp","Cmns","Fry","Walk","Hbrs","Dv","Hvn","Blf","Grv","Crk"];
        street_suffix_type = validSuffixes.includes(candidateSuffix) ? candidateSuffix : null;
        street_name = streetTokens.slice(1, streetTokens.length - 1).join(' ');
      } else {
        street_name = streetTokens.slice(1).join(' ');
      }
      
      // Remove directional abbreviations from street_name
      if (street_name) {
        street_name = street_name.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/gi, '').replace(/\s+/g, ' ').trim();
        if (!street_name) street_name = null;
      }
    }
  }

  if (parts.length > 1) {
    // Extract just the city name, removing state, zip, and descriptors
    const cityPart = parts[1].replace(/\s*\(.*?\)\s*$/g, ''); // Remove (UNINCORPORATED)
    const cityTokens = cityPart.split(/\s+/).filter(token => !/^\d+$/.test(token) && !/^[A-Z]{2}$/.test(token));
    city = cityTokens.length > 0 ? cityTokens.join(' ') : null;
  }

  if (parts.length > 2) {
    const stateZip = parts[2].split(/\s+/).filter(Boolean);
    if (stateZip.length > 0) {
      state = stateZip[0];
    }
    if (stateZip.length > 1) {
      zip = stateZip[1];
    }
  }

  return { street_number, street_name, street_suffix_type, city, state, zip };
}


/**
 * Extracts section, township, and range from a parcel ID.
 * @param {string | null} parcelId
 * @returns {{section: string | null, township: string | null, range: string | null}}
 */
function parseSectionTownshipRangeFromParcel(parcelId) {
  const m = (parcelId || "").match(/^(\d{2})-(\d{2})-(\d{2})-/);
  if (m) {
    return { section: m[1], township: m[2], range: m[3] };
  }
  return { section: null, township: null, range: null };
}

/**
 * Extracts the block from a legal description text.
 * @param {string | null} legalDesc
 * @returns {string | null}
 */
function parseBlockFromLegal(legalDesc) {
  if (!legalDesc) return null;
  const m = String(legalDesc).match(/\bBLK\s+(\w+)\b/i);
  return m ? m[1] : null;
}

/**
 * Maps a raw suffix token to a standardized format (e.g., "JR" to "Jr.").
 * @param {string | null} tok
 * @returns {string | null}
 */
function mapSuffixToken(tok) {
  if (!tok) return null;
  const t = tok.replace(/\.|,/g, "").toUpperCase();
  if (t === "JR") return "Jr.";
  if (t === "SR") return "Sr.";
  if (t === "II") return "II";
  if (t === "III") return "III";
  if (t === "IV") return "IV";
  return null;
}

/**
 * Determines the number of units type based on the number of units.
 * @param {number | null} numberOfUnits
 * @returns {string | null}
 */
function getNumberOfUnitsType(numberOfUnits) {
  if (numberOfUnits === null) return null;
  if (numberOfUnits === 1) return "One";
  if (numberOfUnits === 2) return "Two";
  if (numberOfUnits === 3) return "Three";
  if (numberOfUnits === 4) return "Four";
  if (numberOfUnits >= 2 && numberOfUnits <= 4) return "TwoToFour"; // This might overlap, schema implies specific enums
  if (numberOfUnits > 4) return null; // Not in schema enum, but a common type. If strict, return null.
  return null; // For 0 or other cases not explicitly covered
}

/**
 * Extracts the first year from a string containing multiple years separated by '|'.
 * @param {string | null} yearString
 * @returns {number | null}
 */
function extractFirstYear(yearString) {
  if (!yearString) return null;
  const years = yearString.split('|').map(s => parseIntSafe(s.trim())).filter(Boolean);
  return years.length > 0 ? years[0] : null;
}

/**
 * Maps property use description or building type to a schema-defined property type.
 * Prioritizes property use, then falls back to building type.
 * @param {string | null} useDescription - Text from "Property Use" field.
 * @returns {string | null}
 */
function determinePropertyType(useDescription) {
  // const schemaEnums = [
  //   "Cooperative", "Condominium", "Modular", "ManufacturedHousingMultiWide",
  //   "Pud", "Timeshare", "2Units", "DetachedCondominium", "Duplex",
  //   "SingleFamily", "TwoToFourFamily", "MultipleFamily", "3Units",
  //   "ManufacturedHousing", "ManufacturedHousingSingleWide", "4Units",
  //   "Townhouse", "NonWarrantableCondo", "VacantLand", "Retirement",
  //   "MiscellaneousResidential", "ResidentialCommonElementsAreas", "MobileHome"
  // ];

  if (!useDescription) {
    throw new Error("No property use text");
  }

  const codeMapping = {
    "SingleFamily" : ["0110", "0810", "0830"],
    "Pud" : ["0133"],
    "Cooperative" : ["0550", "0551"],
    "Condominium" : ["0410", "0430", "0431", "0436", "0437"],
    "ManufacturedHousing" : ["0260", "0261", "0262", "0906", "0976"],
    "Timeshare" : ["0443"],
    // "TwoToFourFamily" : ["0820"],
    "Townhouse" : ["0821"],
    "MobileHome" : ["2740"],
    "ResidentialCommonElementsAreas" : ["0435", "0904", "0905", "0906", "0944", "0945", "0954", "0955", "0964", "0965", "0974", "0975", "0976"],
    "Retirement" : ["0752"],
    "MultiFamilyLessThan10" : ["0820", "0822"],
    "MultiFamilyMoreThan10" : ["0310", "0311"],
    "VacantLand" : ["0000", "0030", "0033", "0040", "0060", "0061", "0062", "0090"],
    "MiscellaneousResidential" : ["5001"]
  }
  for (const key in codeMapping) {
    if (codeMapping[key].some(code => useDescription.includes(code))) {
      return key;
    }
  }
  const miscResidentialMatch = /\b0\d\d\d\b/;
  if (miscResidentialMatch.test(useDescription)) {
    return "MiscellaneousResidential";
  }
  throw new Error("Non residential property");
}

/**
 * Extracts key-value pairs from a specific "Structural Elements" table.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance.
 * @param {string} panelId - The ID of the structural panel (e.g., 'structural_1').
 * @returns {Object} A map of structural elements.
 */
function extractStructuralKeyValues($, panelId) {
  const map = {};
  const $panel = $(`#${panelId}`);
  const $structTable = $panel.find("table.table-bordered").filter((i, tbl) => {
    return $(tbl).find("thead th").first().text().trim().toLowerCase().includes("structural elements");
  }).first();

  if ($structTable.length > 0) {
    $structTable.find("tbody tr").each((i, tr) => {
      const k = $(tr).find("td").eq(0).text().trim().replace(/:$/, "");
      const v = $(tr).find("td").eq(1).text().trim();
      if (k) map[k] = v;
    });
  }
  return map;
}

/**
 * Maps the qualification code from HTML to the sales_history schema's sale_type enum.
 * @param {string | null} qualificationCode - The code from the HTML (e.g., 'M', 'U').
 * @returns {string | null} The corresponding sale_type enum value, or null if no direct mapping.
 */
// function mapQualificationCodeToSaleType(qualificationCode) {
//   if (!qualificationCode) return null;
//   const code = qualificationCode.toUpperCase();

//   // Based on the provided HTML, 'M' is "Multiple" and 'U' is "Unknown".
//   // The schema enum values are very specific. Without more context or a
//   // mapping table, it's hard to map 'M' or 'U' to the provided enum.
//   // For now, we'll return null as there's no direct, safe mapping.
//   // If you have a specific mapping for these codes, please provide it.
//   switch (code) {
//     // Example: if 'U' meant "TypicallyMotivated" (unlikely, but for illustration)
//     // case 'U': return 'TypicallyMotivated';
//     // case 'M': return 'MultipleFamily'; // This is a property type, not a sale type.
//     default:
//       return null;
//   }
// }

/**
 * Determines the authority category based on the authority name.
 * @param {string | null} authorityName
 * @returns {string | null}
 */
function determineAuthorityCategory(authorityName) {
  if (!authorityName) return null;
  const lowerName = authorityName.toLowerCase();

  if (lowerName.includes("pinellas park")) return "Municipal";
  if (lowerName.includes("wtr mgt") || lowerName.includes("water management")) return "Water District";
  // Add more rules as needed based on common authority names and schema enums
  // "County","Municipal","School Board","School District","Independent School District","Independent","Special District","Water District","Fire District","Library District","Hospital District","Community College District","Transit Authority","Port Authority","Utility District","Improvement District","State","Federal"
  return null;
}


// --- MAIN EXTRACTION LOGIC ---

function extract() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const unAddr = readJSON("unnormalized_address.json") || {};
  const seed = readJSON("property_seed.json") || {};

  // Keys & frequently used fields
  const parcelId = getTextOrNull($("#pacel_no"));
  // Fallback to seed if HTML element is not found or empty
  const requestIdentifier =
    (seed &&
      seed.source_http_request &&
      seed.source_http_request.multiValueQueryString &&
      seed.source_http_request.multiValueQueryString.s &&
      seed.source_http_request.multiValueQueryString.s[0]) ||
    null;

  // PROPERTY
  const livableSF = getTextOrNull($("#tls"));
  const totalSF = getTextOrNull($("#tgs"));
  const yearBuiltString = getTextOrNull($("#Yrb"));
  const propertyUseText = getTextOrNull($("#property_use a"));
  const numberOfUnitsText = getTextOrNull($("#tlu"));

  const livable_floor_area = (livableSF && livableSF !== 'n/a' && /\d{2,}/.test(livableSF)) ? livableSF.replace(/,/g, '') : null;
  const total_area = (totalSF && totalSF !== 'n/a' && /\d{2,}/.test(totalSF)) ? totalSF.replace(/,/g, '') : null;
  const property_structure_built_year = extractFirstYear(yearBuiltString);
  const number_of_units = parseIntSafe(numberOfUnitsText);
  const number_of_units_type = getNumberOfUnitsType(number_of_units);

  const legalDescHidden = getValueOrNull($("#legal_full_desc"));
  const legalDescDiv = getTextOrNull($("#lLegal"));
  const property_legal_description_text = legalDescHidden || legalDescDiv;

  // Get Building Type from structural elements for fallback
  // const structuralElementsBuilding1 = extractStructuralKeyValues($, 'structural_1');
  // const buildingType = structuralElementsBuilding1["Building Type"] || null;

  // Determine property type using both sources
  let property_type = determinePropertyType(propertyUseText);
  
  // For aquaculture/submerged land, default to VacantLand if no type determined
  // if (!property_type && property_legal_description_text && 
  //     property_legal_description_text.toLowerCase().includes('aquaculture')) {
  //   property_type = 'VacantLand';
  // }
  
  // Ensure property_type is never null - default to VacantLand
  // if (!property_type) {
  //   property_type = 'VacantLand';
  // }

  // Attempt to extract subdivision from legal description
  let subdivision = null;
  if (property_legal_description_text) {
    const subdivisionMatch = property_legal_description_text.match(/^(.*?)\s+(?:PART OF PARCEL|BLK|LOT)/i);
    if (subdivisionMatch && subdivisionMatch[1]) {
      subdivision = subdivisionMatch[1].trim();
    }
  }

  // Zoning is not directly available as text, only a link to a map.
  const zoning = null;

  const property = {
    area_under_air: livable_floor_area,
    livable_floor_area: livable_floor_area,
    number_of_units: number_of_units,
    number_of_units_type: number_of_units_type,
    parcel_identifier: parcelId,
    property_legal_description_text: property_legal_description_text,
    property_structure_built_year: property_structure_built_year,
    property_type: property_type,
    request_identifier: requestIdentifier,
    subdivision: subdivision,
    total_area: total_area,
    zoning: zoning,
    property_effective_built_year: property_structure_built_year,
  };

  Object.keys(property).forEach((k) => {
    if (property[k] === undefined) delete property[k];
  });
  writeJSON(path.join(dataDir, "property.json"), property);

  // ADDRESS
  try {
    // const siteAddressHtml = $("#site_address").html();
    const { street_number, street_name, street_suffix_type, city, state, zip } =
      parseFullAddress(unAddr.full_address);

    const county_name = "Pinellas";

    // const strParts = parseSectionTownshipRangeFromParcel(parcelId);

    const legalDescForBlock = getValueOrNull($("#legal_full_desc")) || getTextOrNull($("#lLegal"));
    const block = parseBlockFromLegal(legalDescForBlock);

    const country_code = "US";

    const address = {
      source_http_request: seed.source_http_request || null,
      request_identifier: requestIdentifier,
      block: block,
      city_name: city ? city.toUpperCase() : null,
      country_code: country_code,
      county_name: county_name,
      latitude: null,
      longitude: null,
      plus_four_postal_code: null,
      postal_code: zip,
      range: null,
      route_number: null,
      section: null,
      state_code: state,
      street_name: street_name ? street_name : null,
      street_post_directional_text: null,
      street_pre_directional_text: null,
      street_number: street_number,
      street_suffix_type: street_suffix_type,
      township: null,
      unit_identifier: null,
    };

    writeJSON(path.join(dataDir, "address.json"), address);
  } catch (e) {
    console.error("Error extracting address data:", e);
  }

  // LOT
  try {
    const landAreaTxt = getTextOrNull($("#land_info #sw"));
    let lot_area_sqft = null;
    let lot_size_acre = null;

    if (landAreaTxt) {
      const mAreaSqft = landAreaTxt.replace(/,/g, "").match(/(\d+)\s*sf/i);
      if (mAreaSqft) lot_area_sqft = parseIntSafe(mAreaSqft[1]);

      const mAreaAcre = landAreaTxt.replace(/,/g, "").match(/(\d+\.?\d*)\s*acres/i);
      if (mAreaAcre) lot_size_acre = parseFloatSafe(mAreaAcre[1]);
    }

    const dimTxt = getTextOrNull($("#tblLandInformation tbody tr:first td").eq(1));
    let lot_length_feet = null;
    let lot_width_feet = null;
    if (dimTxt) {
      const mDim = dimTxt.match(/(\d+)\s*[xX]\s*(\d+)/);
      if (mDim) {
        lot_length_feet = parseIntSafe(mDim[1]);
        lot_width_feet = parseIntSafe(mDim[2]);
      }
    }

    // All new fields not found in HTML will be null
    const lot = {
      request_identifier: requestIdentifier,
      source_http_request: seed.source_http_request || null,
      lot_type: null, // Not found in HTML
      lot_length_feet: lot_length_feet && lot_length_feet > 0 ? lot_length_feet : null,
      lot_width_feet: lot_width_feet && lot_width_feet > 0 ? lot_width_feet : null,
      lot_area_sqft: lot_area_sqft && lot_area_sqft > 0 ? lot_area_sqft : null,
      lot_size_acre: lot_size_acre && lot_size_acre > 0 ? lot_size_acre : null,
      landscaping_features: null, // Not found in HTML
      view: null, // Not found in HTML
      fencing_type: null, // Not found in HTML
      fence_height: null, // Not found in HTML
      fence_length: null, // Not found in HTML
      driveway_material: null, // Not found in HTML
      driveway_condition: null, // Not found in HTML
      lot_condition_issues: null, // Not found in HTML
    };

    writeJSON(path.join(dataDir, "lot.json"), lot);
  } catch (e) {
    console.error("Error extracting lot data:", e);
  }

  // SALES and OWNERS
  try {
    const salesRows = $("#tblSalesHistory tbody tr");
    const sales = [];
    salesRows.each((i, el) => {
      const tds = $(el).find("td");
      const dateTxt = getTextOrNull($(tds[0]));
      const priceTxt = getTextOrNull($(tds[1]));
      // const qualificationCodeTxt = getTextOrNull($(tds[2]).find('span')); // Get text from span inside td[2]

      const iso = toISODate(dateTxt);
      const price = parseCurrencyToNumber(priceTxt);

      if (iso && price !== null && price > 0) {
        sales.push({
          ownership_transfer_date: iso,
          purchase_price_amount: price,
          request_identifier: requestIdentifier, // Include request_identifier for each sale
          source_http_request: seed.source_http_request || null, // Include the full source_http_request object
          _rawIndex: i, // Internal use for sorting
        });
      }
    });

    sales.sort((a, b) =>
      a.ownership_transfer_date < b.ownership_transfer_date ? 1 : -1,
    );

    sales.forEach((s, idx) => {
      const file = path.join(dataDir, `sales_${idx + 1}.json`);
      // Remove _rawIndex before writing to file
      const { _rawIndex, ...saleData } = s;
      writeJSON(file, saleData);
      s._file = `./sales_${idx + 1}.json`; // Keep _file for relationship linking
    });

    // OWNERS from owners/owner_data.json (never from HTML) but allow suffix inference if visible text indicates suffix.
    // This part assumes owner_data.json is generated by a separate owner_extractor.js
    // and is not directly extracted here.
    // If you want to integrate owner extraction here, you'd need to copy that logic.
    // For now, keeping it as a placeholder that reads from an external file.
    const ownerData = readJSON(path.join("owners", "owner_data.json")) || {};
    let ownerEntry = null;
    if (
      ownerData[`property_${parcelId}`] &&
      ownerData[`property_${parcelId}`].owners_by_date
    ) {
      const obd = ownerData[`property_${parcelId}`].owners_by_date;
      if (Array.isArray(obd.current) && obd.current.length > 0) {
        ownerEntry = obd.current[0];
      } else {
        if (sales.length > 0 && obd[sales[0].ownership_transfer_date]) {
          const arr = obd[sales[0].ownership_transfer_date];
          if (Array.isArray(arr) && arr.length > 0) ownerEntry = arr[0];
        }
      }
    }

    if (ownerEntry && ownerEntry.type === "person") {
      let suffix_name = null;
      const disp = getTextOrNull($("#first_second_owner"));
      if (disp) {
        const tokens = disp.split(/\s+/);
        const lastToken = tokens[tokens.length - 1];
        const mapped = mapSuffixToken(lastToken);
        if (mapped) suffix_name = mapped;
      }

      const firstName = titleCaseName(ownerEntry.first_name || "");
      const lastName = titleCaseName(ownerEntry.last_name || "");
      
      // Skip person creation if required names are missing (first_name and last_name are required, not nullable)
      if (!firstName || !lastName || firstName.trim().length === 0 || lastName.trim().length === 0) {
        console.warn("Skipping person creation - first_name and last_name are required fields");
      } else {
      
      const person = {
        source_http_request: seed.source_http_request || null,
        request_identifier: requestIdentifier,
        birth_date: null,
        first_name: firstName,
        last_name: lastName,
        middle_name: ownerEntry.middle_name ? titleCaseName(ownerEntry.middle_name) : null,
        prefix_name: null,
        suffix_name: suffix_name || null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(path.join(dataDir, "person_1.json"), person);

      let relSale = null;
      if (
        ownerData[`property_${parcelId}`] &&
        ownerData[`property_${parcelId}`].owners_by_date
      ) {
        const obd = ownerData[`property_${parcelId}`].owners_by_date;
        const dateKeys = Object.keys(obd).filter((k) => k !== "current");
        for (const s of sales) {
          if (dateKeys.includes(s.ownership_transfer_date)) {
            relSale = s;
            break;
          }
        }
        if (!relSale && sales[0]) relSale = sales[0];
      }
      if (relSale && relSale._file) {
        const relationship = {
          to: { "/": "./person_1.json" },
          from: { "/": relSale._file },
        };
        writeJSON(
          path.join(dataDir, "relationship_sales_person.json"),
          relationship,
        );
      }
      }
    } else if (ownerEntry && ownerEntry.type === "company") {
      const company = { name: ownerEntry.name || null };
      writeJSON(path.join(dataDir, "company_1.json"), company);
      if (sales[0]) {
        const relationship = {
          to: { "/": "./company_1.json" },
          from: { "/": `./sales_1.json` },
        };
        writeJSON(
          path.join(dataDir, "relationship_sales_company.json"),
          relationship,
        );
      }
    }
  } catch (e) {
    console.error("Error extracting sales/owner data:", e);
  }

  try {
    $("#tblValueHistory tbody tr").each((i, el) => {
      const tds = $(el).find("td");
      const taxYear = parseIntSafe(getTextOrNull($(tds[0])));
      const market = parseCurrencyToNumber(getTextOrNull($(tds[2])));
      const assessed = parseCurrencyToNumber(getTextOrNull($(tds[3])));
      const taxable = parseCurrencyToNumber(getTextOrNull($(tds[4]))); // This is County Taxable Value

      if (taxYear !== null && market !== null && assessed !== null && taxable !== null && taxYear >= 1900 && taxYear <= new Date().getFullYear()) {
        const tax = {
          source_http_request: seed.source_http_request || null,
          request_identifier: requestIdentifier,
          tax_year: taxYear,
          property_assessed_value_amount: assessed,
          property_market_value_amount: market,
          property_building_amount: null,
          property_land_amount: null,
          property_taxable_value_amount: taxable,
          monthly_tax_amount: null,
          period_end_date: null,
          period_start_date: null,
          first_year_on_tax_roll: null,
          first_year_building_on_tax_roll: null,
          yearly_tax_amount: null,
        };
        writeJSON(path.join(dataDir, `tax_${taxYear}.json`), tax);
      }
    });
  } catch (e) {
    console.error("Error extracting tax data:", e);
  }



  // STRUCTURE (limited mapping from HTML)
  try {
    // This part assumes structure_data.json is generated by a separate process.
    // If you want to extract structure details from the HTML, you'd need to
    // parse the "Structural Elements" tables for each building.
    const structure = readJSON(path.join("owners", "structure_data.json")) || {};
    writeJSON(path.join(dataDir, "structure.json"), structure);
  } catch (e) {
    console.error("Error processing structure data:", e);
  }

  // UTILITIES (owners/utilities_data.json)
  try {
    const utilData = readJSON(path.join("owners", "utilities_data.json")) || {};
    const utilKey = requestIdentifier ? `property_${requestIdentifier}` : null;
    const u = utilKey ? utilData[utilKey] : null;
    if (u) {
      const utility = {
        source_http_request: seed.source_http_request || null,
        request_identifier: requestIdentifier,
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
        solar_panel_present: u.solar_panel_present === true,
        solar_panel_type: u.solar_panel_type ?? null,
        solar_panel_type_other_description:
          u.solar_panel_type_other_description ?? null,
        smart_home_features: u.smart_home_features ?? null,
        smart_home_features_other_description:
          u.smart_home_features_other_description ?? null,
        hvac_unit_condition: u.hvac_unit_condition ?? null,
        solar_inverter_visible: !!u.solar_inverter_visible,
        hvac_unit_issues: u.hvac_unit_issues ?? null,
      };
      // Clean up nulls
      Object.keys(utility).forEach((k) => {
        if (utility[k] === undefined) delete utility[k];
      });
      writeJSON(path.join(dataDir, "utility.json"), utility);
    }
  } catch (e) {
    console.error("Error processing utility data:", e);
  }

  // LAYOUTS (owners/layout_data.json)
  try {
    const layoutData = readJSON(path.join("owners", "layout_data.json")) || {};
    const lKey = requestIdentifier ? `property_${requestIdentifier}` : null;
    const layouts =
      lKey && layoutData[lKey] && Array.isArray(layoutData[lKey].layouts)
        ? layoutData[lKey].layouts
        : [];
    layouts.forEach((lay, i) => {
      const layout = {
        space_type: lay.space_type ?? null,
        space_index: lay.space_index,
        flooring_material_type: lay.flooring_material_type ?? null,
        size_square_feet: lay.size_square_feet ?? null,
        floor_level: lay.floor_level ?? null,
        has_windows: lay.has_windows ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
        is_finished: lay.is_finished === true,
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
        is_exterior: lay.is_exterior === true,
        pool_condition: lay.pool_condition ?? null,
        pool_surface_type: lay.pool_surface_type ?? null,
        pool_water_quality: lay.pool_water_quality ?? null,
      };
      // Clean up nulls
      Object.keys(layout).forEach((k) => {
        if (layout[k] === undefined) delete layout[k];
      });
      writeJSON(path.join(dataDir, `layout_${i + 1}.json`), layout);
    });
  } catch (e) {
    console.error("Error processing layout data:", e);
  }

  // Remove relationships that should be null according to schema
  try {
    const relationshipsToRemove = [
      "relationship_property_address.json",
      "relationship_property_lot.json", 
      "relationship_property_structure.json",
      "relationship_property_utility.json"
    ];
    
    relationshipsToRemove.forEach(filename => {
      const filepath = path.join(dataDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  } catch (e) {
    console.error("Error removing null relationships:", e);
  }
}

extract();
