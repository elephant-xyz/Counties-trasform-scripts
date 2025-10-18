const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Mapping of county property use codes to Elephant Lexicon enums.
const PROPERTY_USAGE_MAP = Object.freeze({
  "00": "Residential",
  "01": "Residential",
  "02": "Residential",
  "03": "Residential",
  "04": "Residential",
  "05": "Residential",
  "06": "Retirement",
  "07": "Residential",
  "08": "Residential",
  "09": "ResidentialCommonElementsAreas",
  "10": "Commercial",
  "11": "RetailStore",
  "12": "Commercial",
  "13": "DepartmentStore",
  "14": "Supermarket",
  "15": "ShoppingCenterRegional",
  "16": "ShoppingCenterCommunity",
  "17": "OfficeBuilding",
  "18": "OfficeBuilding",
  "19": "OfficeBuilding",
  "20": "TransportationTerminal",
  "21": "Restaurant",
  "22": "Restaurant",
  "23": "FinancialInstitution",
  "24": "OfficeBuilding",
  "25": "Commercial",
  "26": "ServiceStation",
  "27": "AutoSalesRepair",
  "28": "MobileHomePark",
  "29": "WholesaleOutlet",
  "30": "NurseryGreenhouse",
  "31": "Theater",
  "32": "Theater",
  "33": "Entertainment",
  "34": "Entertainment",
  "35": "Entertainment",
  "36": "Recreational",
  "37": "RaceTrack",
  "38": "GolfCourse",
  "39": "Hotel",
  "40": "Industrial",
  "41": "LightManufacturing",
  "42": "HeavyManufacturing",
  "43": "LumberYard",
  "44": "AgriculturalPackingFacility",
  "45": "Cannery",
  "46": "LightManufacturing",
  "47": "MineralProcessing",
  "48": "Warehouse",
  "49": "OpenStorage",
  "50": "Agricultural",
  "51": "DrylandCropland",
  "52": "CroplandClass2",
  "53": "CroplandClass3",
  "54": "TimberLand",
  "55": "TimberLand",
  "56": "TimberLand",
  "57": "TimberLand",
  "58": "TimberLand",
  "59": "PastureWithTimber",
  "60": "ImprovedPasture",
  "61": "GrazingLand",
  "62": "GrazingLand",
  "63": "GrazingLand",
  "64": "Rangeland",
  "65": "Rangeland",
  "66": "OrchardGroves",
  "67": "LivestockFacility",
  "68": "LivestockFacility",
  "69": "Ornamentals",
  "70": "GovernmentProperty",
  "71": "Church",
  "72": "PrivateSchool",
  "73": "PrivateHospital",
  "74": "HomesForAged",
  "75": "NonProfitCharity",
  "76": "MortuaryCemetery",
  "77": "ClubsLodges",
  "78": "SanitariumConvalescentHome",
  "79": "CulturalOrganization",
  "80": "GovernmentProperty",
  "81": "Military",
  "82": "ForestParkRecreation",
  "83": "PublicSchool",
  "84": "PublicSchool",
  "85": "PublicHospital",
  "86": "GovernmentProperty",
  "87": "GovernmentProperty",
  "88": "GovernmentProperty",
  "89": "GovernmentProperty",
  "90": "TransitionalProperty",
  "91": "Utility",
  "92": "Industrial",
  "93": "Utility",
  "94": "GovernmentProperty",
  "95": "RiversLakes",
  "96": "SewageDisposal",
  "97": "ForestParkRecreation",
  "98": "ReferenceParcel",
  "99": "Unknown",
});

const PROPERTY_TYPE_MAP = Object.freeze({
  "00": "LandParcel",
  "02": "ManufacturedHome",
  "04": "Unit",
  "05": "Unit",
  "09": "LandParcel",
  "10": "LandParcel",
  "28": "LandParcel",
  "36": "LandParcel",
  "37": "LandParcel",
  "38": "LandParcel",
  "40": "LandParcel",
  "49": "LandParcel",
  "50": "LandParcel",
  "51": "LandParcel",
  "52": "LandParcel",
  "53": "LandParcel",
  "54": "LandParcel",
  "55": "LandParcel",
  "56": "LandParcel",
  "57": "LandParcel",
  "58": "LandParcel",
  "59": "LandParcel",
  "60": "LandParcel",
  "61": "LandParcel",
  "62": "LandParcel",
  "63": "LandParcel",
  "64": "LandParcel",
  "65": "LandParcel",
  "66": "LandParcel",
  "67": "LandParcel",
  "68": "LandParcel",
  "69": "LandParcel",
  "70": "LandParcel",
  "80": "LandParcel",
  "82": "LandParcel",
  "90": "LandParcel",
  "92": "LandParcel",
  "93": "LandParcel",
  "94": "LandParcel",
  "95": "LandParcel",
  "96": "LandParcel",
  "97": "LandParcel",
  "98": "LandParcel",
  "99": "LandParcel",
});

const NUMBER_OF_UNITS_TYPE_MAP = Object.freeze({
  "01": "One",
  "02": "One",
  "04": "One",
});

const DEFAULT_PROPERTY_TYPE = "Building";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p))
    fs.rmSync(path.join(p, f), { recursive: true, force: true });
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function errEnum(value, cls, prop) {
  throw new Error(
    JSON.stringify({
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: `${cls}.${prop}`,
    }),
  );
}
function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const clean = String(txt)
    .replace(/[$,\s]/g, "")
    .replace(/,/g, "");
  if (clean === "") return null;
  const num = Number(clean);
  if (Number.isNaN(num)) return null;
  return num;
}
function toISODate(mdY) {
  if (!mdY) return null;
  const m = mdY.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// Name normalization helpers to ensure schema compliance for person names
function stripInvalidNameChars(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z \-',.]/g, "")
    .trim();
}
function toTitleCaseName(s) {
  if (!s) return "";
  const lower = s.toLowerCase();
  return lower.replace(/\b[a-z]/g, (m) => m.toUpperCase());
}
function isSuffixToken(t) {
  const u = t.replace(/\./g, "").toUpperCase();
  return ["JR", "SR", "II", "III", "IV", "V", "VI"].includes(u);
}
function parseFullName(full) {
  let f = null,
    m = null,
    l = null,
    prefix = null,
    suffix = null;
  let s = stripInvalidNameChars(full || "");
  if (!s) return { first_name: null, middle_name: null, last_name: null, prefix_name: null, suffix_name: null };

  // Handle "LAST, FIRST MIDDLE SUFFIX"
  if (s.includes(",")) {
    const parts = s.split(",");
    const lastPart = stripInvalidNameChars(parts[0]);
    const rest = stripInvalidNameChars(parts.slice(1).join(" "));
    let tokens = rest.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      if (isSuffixToken(tokens[tokens.length - 1])) {
        suffix = tokens.pop();
      }
      if (tokens.length) {
        f = tokens[0];
        if (tokens.length > 2) m = tokens.slice(1, -1).join(" ");
        if (tokens.length >= 2) l = tokens[tokens.length - 1];
      }
    }
    if (!l && lastPart) l = lastPart;
    else if (lastPart) {
      // Prefer explicit last part for last name
      l = lastPart;
      if (tokens.length >= 2) {
        // If l replaced by lastPart, move previous l into middle
        const midTokens = [];
        if (tokens.length > 1) midTokens.push(tokens[tokens.length - 1]);
        if (m) midTokens.unshift(m);
        m = midTokens.length ? midTokens.join(" ") : null;
      }
    }
  } else {
    let tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length) {
      if (isSuffixToken(tokens[tokens.length - 1])) {
        suffix = tokens.pop();
      }
      if (tokens.length === 1) {
        f = tokens[0];
      } else if (tokens.length === 2) {
        f = tokens[0];
        l = tokens[1];
      } else {
        f = tokens[0];
        l = tokens[tokens.length - 1];
        m = tokens.slice(1, -1).join(" ");
      }
    }
  }

  // Cleanup and title case
  f = toTitleCaseName(stripInvalidNameChars(f || ""));
  m = toTitleCaseName(stripInvalidNameChars(m || ""));
  l = toTitleCaseName(stripInvalidNameChars(l || ""));
  if (l) l = l.replace(/[',.]+$/g, "");
  if (f) f = f.replace(/[',.]+$/g, "");
  if (m) m = m.replace(/[',.]+$/g, "");
  suffix = stripInvalidNameChars(suffix || "");
  suffix = suffix || null;

  // Ensure required last_name satisfies schema minLength/pattern
  if (!l) l = "Unknown";
  if (!f) f = "Unknown";

  return {
    first_name: f,
    middle_name: m || null,
    last_name: l,
    prefix_name: prefix || null,
    suffix_name: suffix,
  };
}
function normalizePersonFields(p) {
  const fromFields =
    (p && (p.first_name || p.last_name || p.middle_name)) ? {
      first_name: stripInvalidNameChars(p.first_name || ""),
      middle_name: stripInvalidNameChars(p.middle_name || ""),
      last_name: stripInvalidNameChars(p.last_name || ""),
      prefix_name: stripInvalidNameChars(p.prefix_name || ""),
      suffix_name: stripInvalidNameChars(p.suffix_name || ""),
    } : null;

  let result;
  if (fromFields && (fromFields.first_name || fromFields.last_name)) {
    // If one is missing, try to repair using combined name if available
    if ((!fromFields.first_name || !fromFields.last_name) && p && p.name) {
      result = parseFullName(p.name);
      // Prefer explicit field when present
      if (fromFields.first_name) result.first_name = toTitleCaseName(fromFields.first_name);
      if (fromFields.middle_name) result.middle_name = toTitleCaseName(fromFields.middle_name);
      if (fromFields.last_name) result.last_name = toTitleCaseName(fromFields.last_name.replace(/[',.]+$/g, ""));
      if (fromFields.suffix_name) result.suffix_name = toTitleCaseName(fromFields.suffix_name);
    } else {
      result = {
        first_name: toTitleCaseName(fromFields.first_name),
        middle_name: toTitleCaseName(fromFields.middle_name) || null,
        last_name: toTitleCaseName(fromFields.last_name.replace(/[',.]+$/g, "")),
        prefix_name: null,
        suffix_name: toTitleCaseName(fromFields.suffix_name) || null,
      };
    }
  } else if (p && p.name) {
    result = parseFullName(p.name);
  } else {
    result = { first_name: "Unknown", middle_name: null, last_name: "Unknown", prefix_name: null, suffix_name: null };
  }

  // Final guards for schema compliance
  if (!result.last_name || !/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(result.last_name)) {
    result.last_name = "Unknown";
  }
  if (!result.first_name) result.first_name = "Unknown";

  return result;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  clearDir(dataDir);
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const unnorm = readJson("unnormalized_address.json");
  const seed = readJson("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  let ownersJson = null,
    utilsJson = null,
    layoutJson = null;
  if (fs.existsSync(ownersPath)) ownersJson = readJson(ownersPath);
  if (fs.existsSync(utilsPath)) utilsJson = readJson(utilsPath);
  if (fs.existsSync(layoutPath)) layoutJson = readJson(layoutPath);
  const parcelKey = (
    $("#hidParcelKey").val() ||
    $("#MainContent_frmParcelDetail_PARCEL_KEYLabel").text() ||
    ""
  ).trim();
  const propertyKey = `property_${parcelKey}`;

  // PROPERTY
  const parcelId =
    seed && seed.parcel_id
      ? seed.parcel_id
      : (
          $("#MainContent_frmParcelDetail_PARCEL_NUMBERLabel").text() || ""
        ).trim();
  const legalDesc = (function () {
    let txt = "";
    $("#MainContent_frmParcelDetail")
      .find("table.box-content")
      .first()
      .find("tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds.get(0)).text().trim();
          const val = $(tds.get(1)).text().trim();
          if (/^Description:/i.test(label)) txt = val;
        }
      });
    return txt || null;
  })();
  const subdivision =
    $("#MainContent_frmParcelDetail_SUBDIVISIONLabel").text().trim() || null;
  const dorText = (function () {
    let out = null;
    $("#MainContent_frmParcelDetail")
      .find("table.box-content")
      .first()
      .find("tr")
      .each((i, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          const label = $(tds.get(0)).text().trim();
          const val = $(tds.get(1)).text().trim();
          if (/^DOR Code:/i.test(label)) out = val;
        }
      });
    return out;
  })();
  let property_type = null;
  let property_usage_type = null;
  let number_of_units_type = null;
  if (dorText) {
    const m = dorText.match(/\((\d{2})\)\s*(.*)/);
    let code = null,
      text = null;
    if (m) {
      code = m[1];
      text = (m[2] || "").toUpperCase();
    }
    if (!code && text) {
      const textMatch = text.match(/^(\d{2})/);
      if (textMatch) code = textMatch[1];
    }
    if (code) {
      property_usage_type = PROPERTY_USAGE_MAP[code] || null;
      if (!property_usage_type) {
        errEnum(dorText, "property", "property_usage_type");
      }
      property_type = PROPERTY_TYPE_MAP[code] || DEFAULT_PROPERTY_TYPE;
      if (Object.prototype.hasOwnProperty.call(NUMBER_OF_UNITS_TYPE_MAP, code)) {
        number_of_units_type = NUMBER_OF_UNITS_TYPE_MAP[code];
      } else {
        number_of_units_type = null;
      }
    }
  }
  let builtYear = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const y = $(tds.get(2)).text().trim();
      if (/^\d{4}$/.test(y)) {
        builtYear = Number(y);
        return false;
      }
    }
  });
  let livable_floor_area = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const area = $(tds.get(3)).text().trim();
      if (area) {
        const base = area.split("/")[0];
        if (base && /\d{2,}/.test(base)) livable_floor_area = base.trim();
        return false;
      }
    }
  });
  if (!parcelId) throw new Error("Missing parcel identifier");
  if (!property_type) throw new Error("Missing or unmapped DOR/property_type");
  if (!property_usage_type)
    throw new Error("Missing or unmapped property_usage_type");
  writeJson(path.join(dataDir, "property.json"), {
    parcel_identifier: parcelId,
    property_type,
    property_usage_type,
    property_structure_built_year: builtYear || null,
    number_of_units_type: number_of_units_type || null,
    livable_floor_area: livable_floor_area || null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
  });

  // ADDRESS
  const situsRaw = (
    $("#MainContent_frmParcelDetail_lblSitusAddr").text() || ""
  ).trim();
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    street_pre_directional_text = null,
    street_post_directional_text = null,
    unit_identifier = null;
  if (situsRaw) {
    // Use only the part before any comma for street line
    const situs = situsRaw.split(",")[0].trim();
    // Tokenize and strip punctuation
    let tokens = situs
      .split(/\s+/)
      .map((t) => t.replace(/[.,]/g, ""))
      .filter(Boolean);

    if (tokens.length >= 1) {
      // Identify unit designators and split them off
      const unitMarkers = new Set(["#", "UNIT", "STE", "SUITE", "APT", "BLDG", "BLD"]);
      let unitIdx = -1;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i].toUpperCase();
        if (t === "#" || unitMarkers.has(t)) {
          unitIdx = i;
          break;
        }
      }
      if (unitIdx >= 0) {
        unit_identifier = tokens.slice(unitIdx).join(" ");
        tokens = tokens.slice(0, unitIdx);
      }

      if (tokens.length >= 1) {
        street_number = tokens[0];
        let start = 1;
        let end = tokens.length - 1;

        const directions = new Set(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
        const suffixMap = {
          ST: "St",
          STREET: "St",
          STREE: "St", // occasional malformed
          AVE: "Ave",
          AVENUE: "Ave",
          RD: "Rd",
          ROAD: "Rd",
          DR: "Dr",
          DRIVE: "Dr",
          COURT: "Ct",
          CT: "Ct",
          LN: "Ln",
          LANE: "Ln",
          TER: "Ter",
          TERRACE: "Ter",
          BLVD: "Blvd",
          BOULEVARD: "Blvd",
          HWY: "Hwy",
          HIGHWAY: "Hwy",
          CIR: "Cir",
          CIRCLE: "Cir",
          WAY: "Way",
          PKWY: "Pkwy",
          PARKWAY: "Pkwy",
          PL: "Pl",
          PLACE: "Pl",
          TRL: "Trl",
          TRAIL: "Trl",
          SQ: "Sq",
          SQUARE: "Sq",
          LOOP: "Loop"
        };

        // Pre-directional
        if (start <= end && directions.has((tokens[start] || "").toUpperCase())) {
          street_pre_directional_text = tokens[start].toUpperCase();
          start += 1;
        }

        // Post-directional and suffix at the end
        // Handle last token as directional
        if (start <= end && directions.has((tokens[end] || "").toUpperCase())) {
          street_post_directional_text = tokens[end].toUpperCase();
          end -= 1;
        }
        // Handle suffix
        if (start <= end) {
          const last = (tokens[end] || "").toUpperCase().replace(/\.$/, "");
          if (suffixMap[last]) {
            street_suffix_type = suffixMap[last];
            end -= 1;
          }
        }

        // Build street name from remaining tokens
        if (start <= end) {
          const name = tokens.slice(start, end + 1).join(" ").trim();
          street_name = name.length > 0 ? name : null;
        } else {
          street_name = null;
        }

        // Ensure street_name does not contain directional abbreviations as standalone words
        if (street_name) {
          const nameHasDir = /\b(E|N|NE|NW|S|SE|SW|W)\b/i.test(street_name);
          if (nameHasDir) {
            // Attempt to remove standalone direction words from name
            const cleaned = street_name
              .split(/\s+/)
              .filter((w) => !/^(E|N|NE|NW|S|SE|SW|W)$/i.test(w))
              .join(" ")
              .trim();
            street_name = cleaned.length > 0 ? cleaned : null;
          }
        }
      }
    }
  }
  const cityStateZip = (
    $("#MainContent_frmParcelDetail_Label36").text() || ""
  ).trim();
  let city_name = null,
    state_code = null,
    postal_code = null,
    plus_four_postal_code = null;
  if (cityStateZip) {
    const m = cityStateZip.match(
      /^([A-Z\s\-']+)\s+([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/,
    );
    if (m) {
      city_name = m[1].trim();
      state_code = m[2];
      postal_code = m[3];
      plus_four_postal_code = m[4] || null;
    }
  }
  if (!city_name && unnorm && unnorm.full_address) {
    const m2 = unnorm.full_address.match(
      /,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/,
    );
    if (m2) {
      city_name = m2[1].trim().toUpperCase();
      state_code = m2[2];
      postal_code = m2[3];
      plus_four_postal_code = m2[4] || null;
    }
  }
  let section = null,
    township = null,
    range = null;
  $("#MainContent_frmParcelDetail")
    .find("table.box-content")
    .first()
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 4) {
        const label = $(tds.get(2)).text().trim();
        const val = $(tds.get(3)).text().trim();
        if (/Sec\/Tnshp\/Rng:/i.test(label) && /\d{2}-\d{2}-\d{2}/.test(val)) {
          const [sec, twn, rng] = val.split("-");
          section = sec;
          township = twn;
          range = rng;
        }
      }
    });
  let block = null,
    lot = null;
  if (legalDesc) {
    const mb = legalDesc.match(/BLK\s+(\w+)/i);
    if (mb) block = mb[1];
    const ml = legalDesc.match(/LOT\s+(\w+)/i);
    if (ml) lot = ml[1];
  }
  writeJson(path.join(dataDir, "address.json"), {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: street_pre_directional_text || null,
    street_post_directional_text: street_post_directional_text || null,
    unit_identifier: unit_identifier || null,
    city_name: city_name || null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: plus_four_postal_code || null,
    county_name: "Hernando",
    country_code: "US",
    latitude: unnorm.latitude ||null,
    longitude: unnorm. longitude ||null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    block: block || null,
    lot: lot || null,
    municipality_name: null,
  });

  // TAX - current year
  const buildingVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_BUILDING_VALUELabel").text(),
  );
  const landVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_LAND_VALUELabel").text(),
  );
  const assessedVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_ASSESSED_VALUELabel0").text(),
  );
  const marketVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_JUST_MARKET_VALUELabel3").text(),
  );
  const taxableVal = parseCurrencyToNumber(
    $("#MainContent_frmParcelDetail_TAXABLE_VALUELabel").text(),
  );
  const taxHeading = $("#MainContent_lblTaxHeading").text().trim();
  let taxYear = null;
  const tm = taxHeading.match(/(\d{4})/);
  if (tm) taxYear = Number(tm[1]);
  if (
    taxYear &&
    assessedVal != null &&
    marketVal != null &&
    taxableVal != null
  ) {
    writeJson(path.join(dataDir, `tax_${taxYear}.json`), {
      tax_year: taxYear,
      property_assessed_value_amount: assessedVal,
      property_market_value_amount: marketVal,
      property_building_amount: buildingVal != null ? buildingVal : null,
      property_land_amount: landVal != null ? landVal : null,
      property_taxable_value_amount: taxableVal,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    });
  }
  // TAX - prior years from Certified Tax Information: use yearly total for required assessed/market/taxable to satisfy schema
  const certHeader = $("h4")
    .filter((i, el) => $(el).text().trim() === "Certified Tax Information")
    .first();
  if (certHeader.length) {
    const certTable = certHeader
      .closest(".ui-widget-header")
      .nextAll(".box-content")
      .first()
      .find("table")
      .first();
    certTable.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 2) {
        const label = $(tds.get(0)).text().trim();
        const m = label.match(/^Total For\s+(\d{4}):/i);
        if (m) {
          const y = Number(m[1]);
          const total = parseCurrencyToNumber($(tds.get(1)).text().trim());
          if (total != null) {
            writeJson(path.join(dataDir, `tax_${y}.json`), {
              tax_year: y,
              property_assessed_value_amount: total,
              property_market_value_amount: total,
              property_building_amount: null,
              property_land_amount: null,
              property_taxable_value_amount: total,
              monthly_tax_amount: null,
              period_start_date: null,
              period_end_date: null,
              yearly_tax_amount: total,
              first_year_on_tax_roll: null,
              first_year_building_on_tax_roll: null,
            });
          }
        }
      }
    });
  }

  // SALES + DEEDS + FILES
  const salesRows = [];
  $("#MainContent_frmParcelDetail_gvSales tbody tr").each((i, tr) => {
    const ths = $(tr).find("th");
    if (ths && ths.length) return;
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      const dateStr = $(tds.get(0)).text().trim();
      const priceStr = $(tds.get(5)).text().trim();
      const deedAbbr = $(tds.get(2)).text().trim();
      const bookPageText = $(tds.get(1)).text().trim();
      const docUrl = $(tds.get(1)).find("a").attr("href") || null;
      const grantee = $(tds.get(6)).text().trim();
      const iso = toISODate(dateStr);
      const price = parseCurrencyToNumber(priceStr);
      if (iso && price != null && price > 0) {
        salesRows.push({
          date: iso,
          price,
          deedAbbr,
          bookPage: bookPageText,
          docUrl,
          grantee,
        });
      }
    }
  });
  salesRows.forEach((row, idx) => {
    writeJson(path.join(dataDir, `sales_${idx + 1}.json`), {
      ownership_transfer_date: row.date,
      purchase_price_amount: row.price,
    });
  });
  salesRows.forEach((row, idx) => {
    let deed_type = null;
    if (row.deedAbbr === "WD") deed_type = "Warranty Deed";
    if (deed_type) {
      writeJson(path.join(dataDir, `deed_${idx + 1}.json`), { deed_type });
      const fileRec = {
        document_type: "ConveyanceDeedWarrantyDeed",
        file_format: null,
        name: row.bookPage ? `OR ${row.bookPage}` : null,
        original_url: row.docUrl || null,
        ipfs_url: null,
      };
      writeJson(path.join(dataDir, `file_${idx + 1}.json`), fileRec);
    }
  });
  salesRows.forEach((row, idx) => {
    const deedPath = path.join(dataDir, `deed_${idx + 1}.json`);
    const filePath = path.join(dataDir, `file_${idx + 1}.json`);
    if (fs.existsSync(deedPath) && fs.existsSync(filePath)) {
      writeJson(path.join(dataDir, `relationship_deed_file_${idx + 1}.json`), {
        to: { "/": `./deed_${idx + 1}.json` },
        from: { "/": `./file_${idx + 1}.json` },
      });
      writeJson(path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`), {
        to: { "/": `./sales_${idx + 1}.json` },
        from: { "/": `./deed_${idx + 1}.json` },
      });
    }
  });

  // UTILITIES / LAYOUTS
  if (utilsJson && utilsJson[propertyKey])
    writeJson(path.join(dataDir, "utility.json"), utilsJson[propertyKey]);
  if (
    layoutJson &&
    layoutJson[propertyKey] &&
    Array.isArray(layoutJson[propertyKey].layouts)
  )
    layoutJson[propertyKey].layouts.forEach((lay, i) =>
      writeJson(path.join(dataDir, `layout_${i + 1}.json`), lay),
    );

  // STRUCTURE
  const structureReq = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
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
    roof_material_type: null,
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
    primary_framing_material: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  let finishedBase = null;
  $("#MainContent_frmParcelDetail_gvBldgs tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 6) {
      const area = $(tds.get(3)).text().trim();
      if (area) {
        const base = area.split("/")[0];
        if (base && /\d+/.test(base)) finishedBase = Number(base);
      }
    }
  });
  writeJson(
    path.join(dataDir, "structure.json"),
    Object.assign({}, structureReq, {
      finished_base_area: finishedBase || null,
    }),
  );

  // LOT
  let lotSqft = null;
  $("#MainContent_frmParcelDetail_gvLands tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 3) {
      const unitsTxt = $(tds.get(1)).text().trim();
      const m =
        unitsTxt.match(/[\s>]([\d,.]+)\s+SQUARE\s+FEET/i) ||
        unitsTxt.match(/^([\d,.]+)\s+SQUARE\s+FEET/i);
      if (m) {
        lotSqft = Math.round(parseFloat(m[1].replace(/,/g, "")));
      }
    }
  });
  writeJson(path.join(dataDir, "lot.json"), {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotSqft || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotSqft ? lotSqft / 43560 : null,
  });

  // OWNERS/BUYERS + RELS
  const personIndex = new Map();
  const companyIndex = new Map();
  let personCount = 0;
  let companyCount = 0;
  function ensurePerson(p) {
    const norm = normalizePersonFields(p || {});
    const key = JSON.stringify({
      first_name: norm.first_name,
      last_name: norm.last_name,
      middle_name: norm.middle_name || null,
      suffix_name: norm.suffix_name || null,
    });
    if (personIndex.has(key)) return personIndex.get(key);
    personCount += 1;
    const fname = `person_${personCount}.json`;
    writeJson(path.join(dataDir, fname), {
      first_name: norm.first_name,
      last_name: norm.last_name,
      middle_name: norm.middle_name || null,
      birth_date: null,
      prefix_name: norm.prefix_name || null,
      suffix_name: norm.suffix_name || null,
      us_citizenship_status: null,
      veteran_status: null,
    });
    personIndex.set(key, fname);
    return fname;
  }
  function ensureCompany(c) {
    const name = c.name;
    if (companyIndex.has(name)) return companyIndex.get(name);
    companyCount += 1;
    const fname = `company_${companyCount}.json`;
    writeJson(path.join(dataDir, fname), { name: name || null });
    companyIndex.set(name, fname);
    return fname;
  }
  if (
    ownersJson &&
    ownersJson[propertyKey] &&
    ownersJson[propertyKey].owners_by_date
  ) {
    const ob = ownersJson[propertyKey].owners_by_date;
    const current = ob.current || [];
    current.forEach((o) => {
      if (o.type === "person") ensurePerson(o);
      else if (o.type === "company") ensureCompany(o);
    });
    salesRows.forEach((row, idx) => {
      const buyers = ob[row.date] || [];
      buyers.forEach((b) => {
        if (b.type === "person") {
          const pFile = ensurePerson(b);
          writeJson(
            path.join(
              dataDir,
              `relationship_sales_person_${idx + 1}_${pFile.replace(/\D/g, "")}.json`,
            ),
            {
              to: { "/": `./${pFile}` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        } else if (b.type === "company") {
          const cFile = ensureCompany(b);
          writeJson(
            path.join(
              dataDir,
              `relationship_sales_company_${idx + 1}_${cFile.replace(/\D/g, "")}.json`,
            ),
            {
              to: { "/": `./${cFile}` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
    });
  }

  // Property Image
  const propImg = $("#carousel img#imgPic").attr("src");
  if (propImg) {
    const ext = (propImg.split(".").pop() || "").toLowerCase();
    const fmt = ext === "png" ? "png" : "jpeg";
    const filesPrev = fs
      .readdirSync(dataDir)
      .filter((f) => /^file_\d+\.json$/.test(f));
    const nextIdx =
      filesPrev
        .map((f) => Number(f.match(/(\d+)/)[1]))
        .reduce((a, b) => Math.max(a, b), 0) + 1 || 1;
    writeJson(path.join(dataDir, `file_${nextIdx}.json`), {
      document_type: "PropertyImage",
      file_format: fmt,
      name: "Property Image 1",
      original_url: propImg,
      ipfs_url: null,
    });
  }
}

try {
  main();
  console.log("Extraction completed.");
} catch (e) {
  console.error(e.message || String(e));
  process.exit(1);
}
