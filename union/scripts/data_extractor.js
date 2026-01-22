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

function parseSectionTownshipRange(value) {
  if (!value) return { section: null, township: null, range: null };
  const trimmed = value.trim();
  if (!trimmed) return { section: null, township: null, range: null };

  let match = trimmed.match(
    /^(\d+)[-\s/]*([0-9]{2}[NS]?)[-\s/]*([0-9]{2}[EW]?)$/i,
  );
  if (!match) {
    const parts = trimmed.split(/[\/-]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 3) {
      match = [null, parts[0], parts[1], parts[2]];
    }
  }
  if (match) {
    const [, sec, twp, rng] = match;
    return {
      section: sec || null,
      township: twp ? twp.toUpperCase() : null,
      range: rng ? rng.toUpperCase() : null,
    };
  }
  return { section: null, township: null, range: null };
}

const PROPERTY_USE_CODE_MAP = {
  "0000": {
    property_usage_type: "Residential",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "0100": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: "SingleFamilyDetached",
    build_status: "Improved",
  },
  "0110": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: "SingleFamilyDetached",
    build_status: "Improved",
  },
  "0150": {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "Modular",
    build_status: "Improved",
  },
  "0200": {
    property_usage_type: "Residential",
    property_type: "ManufacturedHome",
    structure_form: "MobileHome",
    build_status: "Improved",
  },
  "0300": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: "MultiFamilyLessThan10",
    build_status: "Improved",
  },
  "0400": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: "TownhouseRowhouse",
    build_status: "Improved",
  },
  "0700": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "0800": {
    property_usage_type: "Residential",
    property_type: "Building",
    structure_form: "MultiFamilyMoreThan10",
    build_status: "Improved",
  },
  "1000": {
    property_usage_type: "Commercial",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "1100": {
    property_usage_type: "RetailStore",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1200": {
    property_usage_type: "Commercial",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1300": {
    property_usage_type: "DepartmentStore",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1400": {
    property_usage_type: "Supermarket",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1600": {
    property_usage_type: "ShoppingCenterCommunity",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1700": {
    property_usage_type: "OfficeBuilding",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "1900": {
    property_usage_type: "MedicalOffice",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2000": {
    property_usage_type: "TransportationTerminal",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2100": {
    property_usage_type: "Restaurant",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2300": {
    property_usage_type: "FinancialInstitution",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2500": {
    property_usage_type: "Commercial",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2600": {
    property_usage_type: "ServiceStation",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2700": {
    property_usage_type: "AutoSalesRepair",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "2800": {
    property_usage_type: "MobileHomePark",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "3000": {
    property_usage_type: "NurseryGreenhouse",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "3300": {
    property_usage_type: "Entertainment",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "3710": {
    property_usage_type: "RetailStore",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "4000": {
    property_usage_type: "Industrial",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "4100": {
    property_usage_type: "LightManufacturing",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "4300": {
    property_usage_type: "LumberYard",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "4600": {
    property_usage_type: "PackingPlant",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "4700": {
    property_usage_type: "MineralProcessing",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "4800": {
    property_usage_type: "Warehouse",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "5100": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "5380": {
    property_usage_type: "Agricultural",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "5400": {
    property_usage_type: "TimberLand",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "5910": {
    property_usage_type: "Conservation",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "6000": {
    property_usage_type: "GrazingLand",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "6005": {
    property_usage_type: "HayMeadow",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "6600": {
    property_usage_type: "OrchardGroves",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "6700": {
    property_usage_type: "Poultry",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "6900": {
    property_usage_type: "Ornamentals",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "7100": {
    property_usage_type: "Church",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "7200": {
    property_usage_type: "PrivateSchool",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "7300": {
    property_usage_type: "PrivateHospital",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "7500": {
    property_usage_type: "NonProfitCharity",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "7600": {
    property_usage_type: "MortuaryCemetery",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "7700": {
    property_usage_type: "ClubsLodges",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "8000": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "8200": {
    property_usage_type: "ForestParkRecreation",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "Improved",
  },
  "8300": {
    property_usage_type: "PublicSchool",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "8600": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "8700": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "8800": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "8900": {
    property_usage_type: "GovernmentProperty",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
  "9100": {
    property_usage_type: "Utility",
    property_type: "Building",
    structure_form: null,
    build_status: "Improved",
  },
  "9600": {
    property_usage_type: "SewageDisposal",
    property_type: "LandParcel",
    structure_form: null,
    build_status: "VacantLand",
  },
};

function normalizeUseCode(code) {
  if (!code) return null;
  const digits = String(code).replace(/[^0-9]/g, "");
  return digits ? digits.padStart(4, "0") : null;
}

function mapPropertyAttributesFromText(useText) {
  if (!useText) {
    return {
      property_usage_type: null,
      property_type: null,
      structure_form: null,
      build_status: null,
    };
  }
  const upper = useText.toUpperCase();
  const isVacant = upper.includes("VACANT");
  const isMobile = upper.includes("MOBILE");
  const isMulti = upper.includes("MULTI");
  const isAgricultural =
    upper.includes("AGRIC") ||
    upper.includes("PASTURE") ||
    upper.includes("CROP") ||
    upper.includes("TIMBER") ||
    upper.includes("ORCHARD") ||
    upper.includes("FARM");
  const result = {
    property_usage_type: null,
    property_type: null,
    structure_form: null,
    build_status: null,
    ownership_estate_type: "FeeSimple",
  };
  if (isVacant) {
    result.property_type = "LandParcel";
    result.build_status = "VacantLand";
  } else if (isMobile) {
    result.property_type = "ManufacturedHome";
    result.structure_form = "MobileHome";
    result.build_status = "Improved";
    result.property_usage_type = "Residential";
  } else if (isAgricultural) {
    result.property_type = "LandParcel";
    result.build_status = "Improved";
    result.property_usage_type = "Agricultural";
  } else {
    result.property_type = "Building";
    result.build_status = "Improved";
    if (upper.includes("COMMERCIAL")) result.property_usage_type = "Commercial";
    if (upper.includes("RESIDENT")) result.property_usage_type = "Residential";
    if (upper.includes("INDUST")) result.property_usage_type = "Industrial";
  }
  if (isMulti) {
    result.structure_form = upper.includes("10") || upper.includes("MORE")
      ? "MultiFamilyMoreThan10"
      : "MultiFamilyLessThan10";
    if (!result.property_usage_type)
      result.property_usage_type = "Residential";
  }
  return result;
}

function mapPropertyAttributes(useCodeRaw, useText) {
  const code = normalizeUseCode(useCodeRaw);
  if (code && PROPERTY_USE_CODE_MAP[code]) {
    const mapped = PROPERTY_USE_CODE_MAP[code];
    return {
      property_usage_type: mapped.property_usage_type ?? null,
      property_type: mapped.property_type ?? null,
      structure_form: mapped.structure_form ?? null,
      build_status: mapped.build_status ?? null,
      ownership_estate_type: mapped.ownership_estate_type ?? "FeeSimple",
    };
  }
  const fallback = mapPropertyAttributesFromText(useText);
  return fallback;
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
  const useCodeRaw = $('input[name="Land_Use"]').attr("value");
  const useAttributes = mapPropertyAttributes(useCodeRaw, useText);
  const property_type = useAttributes.property_type ?? null;
  const property_usage_type = useAttributes.property_usage_type ?? null;
  const build_status = useAttributes.build_status ?? null;
  const structure_form = useAttributes.structure_form ?? null;
  const ownership_estate_type =
    useAttributes.ownership_estate_type ?? "FeeSimple";

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
    property_usage_type: property_usage_type,
    build_status: build_status,
    structure_form: structure_form,
    ownership_estate_type: ownership_estate_type,
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

function extractAddress($, unnorm, propSeed) {
  const unnormalizedAddress =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;

  // S/T/R row for township, range, section
  let section = null;
  let township = null;
  let range = null;
  $("table.parcelDetails_insideTable tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 4) {
      const label = getText($(tds[2]));
      const val = getText($(tds[3]));
      const label0 = getText($(tds[0]));
      const val1 = getText($(tds[1]));
      if (/^S\/T\/R$/i.test(label0)) {
        const parsed = parseSectionTownshipRange(val1);
        section = section || parsed.section;
        township = township || parsed.township;
        range = range || parsed.range;
      } else if (/^S\/T\/R$/i.test(label)) {
        const parsed = parseSectionTownshipRange(val);
        section = section || parsed.section;
        township = township || parsed.township;
        range = range || parsed.range;
      }
    }
  });

  const countyName =
    unnorm && unnorm.county_jurisdiction
      ? unnorm.county_jurisdiction.trim() || null
      : null;
  const sourceRequest =
    (unnorm && unnorm.source_http_request) ||
    (propSeed && propSeed.source_http_request) ||
    null;
  const requestIdentifier =
    (unnorm && unnorm.request_identifier) ||
    (propSeed && propSeed.request_identifier) ||
    null;

  return {
    unnormalized_address: unnormalizedAddress,
    section: section || null,
    township: township || null,
    range: range || null,
    source_http_request: sourceRequest,
    request_identifier: requestIdentifier,
    county_name: countyName,
    country_code: "US",
  };
}

function extractTaxes($) {
  const taxes = [];

  function extractBlock() {
    const outer_table = $("#ownerDiv > div > table > tbody > tr > td > table").first();
    const tables = outer_table.find("table");
    const block = {};
    // if (!tables) {return null};
    tables.each((i, table) => {
      if (!$(table).length) return null;
      // Rows: find labels and values
      const rows = $(table).find("tr");
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
    });
    return block;
  }

  // const b2024 = extractBlock("2024 Certified Values");
  // if (b2024) {
  //   taxes.push({
  //     tax_year: 2024,
  //     property_assessed_value_amount: b2024.assessed ?? null,
  //     property_market_value_amount: b2024.just ?? null,
  //     property_building_amount: b2024.building ?? null,
  //     property_land_amount: b2024.land ?? null,
  //     property_taxable_value_amount: b2024.taxable ?? null,
  //     monthly_tax_amount: null,
  //     period_start_date: null,
  //     period_end_date: null,
  //   });
  // }
  const b2025 = extractBlock();
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

const deedCodeMap = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  QCD: "Quitclaim Deed",
  QC: "Quitclaim Deed",
  QUITCLAIM: "Quitclaim Deed",
  "QUITCLAIM DEED": "Quitclaim Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TODD: "Transfer on Death Deed",
  SD: "Sheriff's Deed",
  "SHRF'S DEED": "Sheriff's Deed",
  TD: "Tax Deed",
  TRD: "Trustee's Deed",
  "TRUSTEE DEED": "Trustee's Deed",
  PRD: "Personal Representative Deed",
  "PERS REP DEED": "Personal Representative Deed",
  CD: "Correction Deed",
  "CORR DEED": "Correction Deed",
  DIL: "Deed in Lieu of Foreclosure",
  DILF: "Deed in Lieu of Foreclosure",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  "GIFT DEED": "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  "WILD D": "Wild Deed",
  SMD: "Special Master's Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  RD: "Receiver's Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ROC: "Release of Contract",
  LC: "Contract for Deed",
  MTG: "Miscellaneous",
  LIS: "Miscellaneous",
  EASE: "Miscellaneous",
  AGMT: "Miscellaneous",
  AFF: "Miscellaneous",
  ORD: "Miscellaneous",
  CERT: "Miscellaneous",
  RES: "Miscellaneous",
  DECL: "Miscellaneous",
  COV: "Miscellaneous",
  SUB: "Miscellaneous",
  MOD: "Miscellaneous",
  REL: "Miscellaneous",
  ASSG: "Miscellaneous",
  LEAS: "Miscellaneous",
  TR: "Miscellaneous",
  WILL: "Miscellaneous",
  PROB: "Miscellaneous",
  JUDG: "Miscellaneous",
  LIEN: "Miscellaneous",
  SAT: "Miscellaneous",
  PART: "Miscellaneous",
  EXCH: "Miscellaneous",
  CONV: "Miscellaneous",
  OTH: "Miscellaneous",
};

function mapDeedCode(code) {
  if (!code) return null;
  const normalized = code.trim();
  const upper = normalized.toUpperCase();
  if (deedCodeMap[upper]) return deedCodeMap[upper];
  if (deedCodeMap[normalized]) return deedCodeMap[normalized];
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
      const bookPageRaw = getText($(tds[2]));
      const deedCode = getText($(tds[3]));
      const iso = toIsoDate(date);
      const amt = parseMoney(price);
      let book = null;
      let page = null;
      let link = null;
      if (bookPageRaw) {
        const match = bookPageRaw.match(/^(\d+)\s*\/\s*(\d+)/);
        if (match) {
          book = match[1].trim();
          page = match[2].trim();
        }
      }
      if (book && page) {
        link = `https://www.suwanneepa.com/gis/linkClerk/?ClerkBook=${book}&ClerkPage=${page}&autoSubmit=1`;
      }
      const saleObj = {
        ownership_transfer_date: iso,
        purchase_price_amount: amt,
        deed_type: mapDeedCode(deedCode),
        book: book ?? null,
        page: page ?? null,
        volume: null,
        instrument_number: null,
        deed_link: link,
      };
      sales.push(saleObj);
    }
  });
  return sales;
}

function cleanNameField(value) {
  if (!value) return null;

  let cleaned = String(value).trim();
  if (!cleaned) return null;

  // Remove leading special characters that don't match pattern ^[A-Z]
  while (cleaned && /^[\-', .#0-9\s]/.test(cleaned)) {
    cleaned = cleaned.slice(1).trim();
  }

  // Remove trailing special characters
  while (cleaned && /[\-', .\s]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // If empty after cleaning, return null
  if (!cleaned) return null;

  // Ensure first character is uppercase
  if (cleaned.length > 0 && cleaned[0] !== cleaned[0].toUpperCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

function normalizeSuffixName(suffix) {
  if (!suffix) return null;

  // Remove dots and commas, then trim
  const cleaned = String(suffix).replace(/\./g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;

  // Check for "et al" variations - these are not valid suffixes
  if (/^et\s*al$/i.test(cleaned)) {
    return null;
  }

  // Map to Elephant schema enum values
  const suffixMap = {
    'JR': 'Jr.',
    'Jr': 'Jr.',
    'jr': 'Jr.',
    'SR': 'Sr.',
    'Sr': 'Sr.',
    'sr': 'Sr.',
    'II': 'II',
    'III': 'III',
    'IV': 'IV',
    'PHD': 'PhD',
    'PhD': 'PhD',
    'phd': 'PhD',
    'MD': 'MD',
    'Md': 'MD',
    'md': 'MD',
    'ESQ': 'Esq.',
    'Esq': 'Esq.',
    'esq': 'Esq.',
    'ESQUIRE': 'Esq.',
    'Esquire': 'Esq.',
    'esquire': 'Esq.',
    'JD': 'JD',
    'Jd': 'JD',
    'jd': 'JD',
    'LLM': 'LLM',
    'Llm': 'LLM',
    'llm': 'LLM',
    'MBA': 'MBA',
    'Mba': 'MBA',
    'mba': 'MBA',
    'RN': 'RN',
    'Rn': 'RN',
    'rn': 'RN',
    'DDS': 'DDS',
    'Dds': 'DDS',
    'dds': 'DDS',
    'DVM': 'DVM',
    'Dvm': 'DVM',
    'dvm': 'DVM',
    'CFA': 'CFA',
    'Cfa': 'CFA',
    'cfa': 'CFA',
    'CPA': 'CPA',
    'Cpa': 'CPA',
    'cpa': 'CPA',
    'PE': 'PE',
    'Pe': 'PE',
    'pe': 'PE',
    'PMP': 'PMP',
    'Pmp': 'PMP',
    'pmp': 'PMP',
    'EMERITUS': 'Emeritus',
    'Emeritus': 'Emeritus',
    'emeritus': 'Emeritus',
    'RET': 'Ret.',
    'Ret': 'Ret.',
    'ret': 'Ret.',
    'RETIRED': 'Ret.',
    'Retired': 'Ret.',
    'retired': 'Ret.',
  };

  const upper = cleaned.toUpperCase();

  // Check uppercase version first
  if (suffixMap[upper]) {
    return suffixMap[upper];
  }

  // Check original case as fallback
  if (suffixMap[cleaned]) {
    return suffixMap[cleaned];
  }

  // Additional safety check: if the value is literally "Jr" without period, return "Jr."
  // This should never happen due to the mappings above, but acts as a failsafe
  if (cleaned === 'Jr') return 'Jr.';
  if (cleaned === 'Sr') return 'Sr.';

  // If not in map, return null
  return null;
}

function normalizePrefixName(prefix) {
  if (!prefix) return null;

  // Remove dots and commas, then trim
  const cleaned = String(prefix).replace(/\./g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;

  // Map to Elephant schema enum values
  const prefixMap = {
    'MR': 'Mr.',
    'Mr': 'Mr.',
    'mr': 'Mr.',
    'MRS': 'Mrs.',
    'Mrs': 'Mrs.',
    'mrs': 'Mrs.',
    'MS': 'Ms.',
    'Ms': 'Ms.',
    'ms': 'Ms.',
    'MISS': 'Miss',
    'Miss': 'Miss',
    'miss': 'Miss',
    'MX': 'Mx.',
    'Mx': 'Mx.',
    'mx': 'Mx.',
    'DR': 'Dr.',
    'Dr': 'Dr.',
    'dr': 'Dr.',
    'DOCTOR': 'Dr.',
    'Doctor': 'Dr.',
    'doctor': 'Dr.',
    'PROF': 'Prof.',
    'Prof': 'Prof.',
    'prof': 'Prof.',
    'PROFESSOR': 'Prof.',
    'Professor': 'Prof.',
    'professor': 'Prof.',
    'REV': 'Rev.',
    'Rev': 'Rev.',
    'rev': 'Rev.',
    'REVEREND': 'Rev.',
    'Reverend': 'Rev.',
    'reverend': 'Rev.',
    'FR': 'Fr.',
    'Fr': 'Fr.',
    'fr': 'Fr.',
    'FATHER': 'Fr.',
    'Father': 'Fr.',
    'father': 'Fr.',
    'SR': 'Sr.',
    'SISTER': 'Sr.',
    'Sister': 'Sr.',
    'sister': 'Sr.',
    'BR': 'Br.',
    'Br': 'Br.',
    'br': 'Br.',
    'BROTHER': 'Br.',
    'Brother': 'Br.',
    'brother': 'Br.',
    'CAPT': 'Capt.',
    'Capt': 'Capt.',
    'capt': 'Capt.',
    'CAPTAIN': 'Capt.',
    'Captain': 'Capt.',
    'captain': 'Capt.',
    'COL': 'Col.',
    'Col': 'Col.',
    'col': 'Col.',
    'COLONEL': 'Col.',
    'Colonel': 'Col.',
    'colonel': 'Col.',
    'MAJ': 'Maj.',
    'Maj': 'Maj.',
    'maj': 'Maj.',
    'MAJOR': 'Maj.',
    'Major': 'Maj.',
    'major': 'Maj.',
    'LT': 'Lt.',
    'Lt': 'Lt.',
    'lt': 'Lt.',
    'LIEUTENANT': 'Lt.',
    'Lieutenant': 'Lt.',
    'lieutenant': 'Lt.',
    'SGT': 'Sgt.',
    'Sgt': 'Sgt.',
    'sgt': 'Sgt.',
    'SERGEANT': 'Sgt.',
    'Sergeant': 'Sgt.',
    'sergeant': 'Sgt.',
    'HON': 'Hon.',
    'Hon': 'Hon.',
    'hon': 'Hon.',
    'HONORABLE': 'Hon.',
    'Honorable': 'Hon.',
    'honorable': 'Hon.',
    'JUDGE': 'Judge',
    'Judge': 'Judge',
    'judge': 'Judge',
    'RABBI': 'Rabbi',
    'Rabbi': 'Rabbi',
    'rabbi': 'Rabbi',
    'IMAM': 'Imam',
    'Imam': 'Imam',
    'imam': 'Imam',
    'SHEIKH': 'Sheikh',
    'Sheikh': 'Sheikh',
    'sheikh': 'Sheikh',
    'SIR': 'Sir',
    'Sir': 'Sir',
    'sir': 'Sir',
    'DAME': 'Dame',
    'Dame': 'Dame',
    'dame': 'Dame',
  };

  const upper = cleaned.toUpperCase();

  // Check uppercase version first
  if (prefixMap[upper]) {
    return prefixMap[upper];
  }

  // Check original case as fallback
  if (prefixMap[cleaned]) {
    return prefixMap[cleaned];
  }

  // If not in map (e.g., "Bishop"), return null
  return null;
}

function normalizeOwnerKeyForIndex(owner) {
  if (!owner || !owner.type) return "";
  if (owner.type === "company") {
    return (owner.name || "").toLowerCase().replace(/\s+/g, " ").trim();
  }
  if (owner.type === "person") {
    const segments = [
      owner.prefix_name || "",
      owner.first_name || "",
      owner.middle_name || "",
      owner.last_name || "",
      owner.suffix_name || "",
    ];
    return segments
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  return "";
}

function writeOwners(
  ownerData,
  dataDir,
  parcelDashed,
  parcelFlat,
  requestInfo,
) {
  // owners keyed by dashed id in provided data
  const keyVariants = [`property_${parcelDashed}`, `property_${parcelFlat}`];
  let ownersEntry = null;
  for (const k of keyVariants) {
    if (ownerData[k]) {
      ownersEntry = ownerData[k];
      break;
    }
  }
  const outputs = {
    companyFiles: [],
    personFiles: [],
    mailingFiles: [],
    byDate: {},
  };
  const requestSource =
    (requestInfo && requestInfo.source_http_request) || null;
  const requestIdentifier =
    (requestInfo && requestInfo.request_identifier) || null;
  if (ownersEntry && ownersEntry.owners_by_date) {
    let companyIdx = 0;
    let personIdx = 0;
    const ownerFileIndex = new Map();
    const normalizeMailing = (val) =>
      val == null ? null : String(val).replace(/\s+/g, " ").trim();

    const ensureMailingRecord = (record, mailingAddress) => {
      const ownerIndex = record.ownerIndex;
      if (!ownerIndex) return record;
      const mailingFilename = `mailing_address_${ownerIndex}.json`;
      const mailingPath = path.join(dataDir, mailingFilename);
      const normalizedAddress =
        mailingAddress != null
          ? normalizeMailing(mailingAddress)
          : record.mailingAddressValue || null;
      record.mailingAddressValue = normalizedAddress || null;
      writeJson(mailingPath, {
        unnormalized_address: normalizedAddress || null,
        latitude: null,
        longitude: null,
        source_http_request: requestSource,
        request_identifier: requestIdentifier,
      });
      record.mailingFilename = mailingFilename;
      const relationshipName = `relationship_${record.type}_${ownerIndex}_has_mailing_address_${ownerIndex}.json`;
      writeJson(path.join(dataDir, relationshipName), {
        from: { "/": `./${record.filename}` },
        to: { "/": `./${mailingFilename}` },
      });
      if (!outputs.mailingFiles.includes(mailingFilename)) {
        outputs.mailingFiles.push(mailingFilename);
      }
      return record;
    };

    const ensureOwnerFile = (owner) => {
      if (!owner || !owner.type) return null;
      const key = normalizeOwnerKeyForIndex(owner);
      if (!key) return null;
      if (ownerFileIndex.has(key)) {
        const record = ownerFileIndex.get(key);
        const currentAddress = record.mailingAddressValue || null;
        const newAddress =
          owner.mailing_address != null
            ? normalizeMailing(owner.mailing_address)
            : null;
        if (newAddress && newAddress !== currentAddress) {
          ensureMailingRecord(record, newAddress);
        }
        return record;
      }
      if (owner.type === "company") {
        companyIdx += 1;
        const filePath = path.join(dataDir, `company_${companyIdx}.json`);
        writeJson(filePath, { name: owner.name ?? null });
        const record = {
          filename: path.basename(filePath),
          type: "company",
          ownerIndex: companyIdx,
          mailingFilename: null,
          mailingAddressValue: null,
        };
        ownerFileIndex.set(key, record);
        outputs.companyFiles.push(record.filename);
        ensureMailingRecord(record, owner.mailing_address ?? null);
        return record;
      }
      if (owner.type === "person") {
        if (!owner.first_name || !owner.last_name) return null;
        personIdx += 1;
        const filePath = path.join(dataDir, `person_${personIdx}.json`);

        // Clean all name fields to ensure they match the schema pattern ^[A-Z][a-zA-Z\s\-',.]*$
        const cleanedFirstName = cleanNameField(owner.first_name);
        const cleanedLastName = cleanNameField(owner.last_name);
        const cleanedMiddleName = cleanNameField(owner.middle_name);

        // If first or last name becomes null after cleaning, skip this person
        if (!cleanedFirstName || !cleanedLastName) return null;

        // Validate prefix_name - ensure it's either null or a valid enum value
        let validatedPrefix = normalizePrefixName(owner.prefix_name);
        const validPrefixes = new Set([
          'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Mx.', 'Dr.', 'Prof.', 'Rev.',
          'Fr.', 'Sr.', 'Br.', 'Capt.', 'Col.', 'Maj.', 'Lt.', 'Sgt.',
          'Hon.', 'Judge', 'Rabbi', 'Imam', 'Sheikh', 'Sir', 'Dame'
        ]);
        if (validatedPrefix !== null && !validPrefixes.has(validatedPrefix)) {
          validatedPrefix = null;
        }

        // Validate suffix_name - ensure it's either null or a valid enum value
        let validatedSuffix = normalizeSuffixName(owner.suffix_name);
        const validSuffixes = new Set([
          'Jr.', 'Sr.', 'II', 'III', 'IV', 'PhD', 'MD', 'Esq.',
          'JD', 'LLM', 'MBA', 'RN', 'DDS', 'DVM', 'CFA', 'CPA',
          'PE', 'PMP', 'Emeritus', 'Ret.'
        ]);
        if (validatedSuffix !== null && !validSuffixes.has(validatedSuffix)) {
          validatedSuffix = null;
        }

        writeJson(filePath, {
          birth_date: owner.birth_date ?? null,
          first_name: cleanedFirstName,
          last_name: cleanedLastName,
          middle_name: cleanedMiddleName,
          prefix_name: validatedPrefix,
          suffix_name: validatedSuffix,
          us_citizenship_status: owner.us_citizenship_status ?? null,
          veteran_status: owner.veteran_status ?? null,
        });
        const record = {
          filename: path.basename(filePath),
          type: "person",
          ownerIndex: personIdx,
          mailingFilename: null,
          mailingAddressValue: null,
        };
        ownerFileIndex.set(key, record);
        outputs.personFiles.push(record.filename);
        ensureMailingRecord(record, owner.mailing_address ?? null);
        return record;
      }
      return null;
    };

    for (const [dateKey, owners] of Object.entries(
      ownersEntry.owners_by_date,
    )) {
      if (!Array.isArray(owners)) continue;
      for (const owner of owners) {
        const fileRecord = ensureOwnerFile(owner);
        if (!fileRecord) continue;
        if (!outputs.byDate[dateKey]) {
          outputs.byDate[dateKey] = [];
        }
        if (!outputs.byDate[dateKey].includes(fileRecord.filename)) {
          outputs.byDate[dateKey].push(fileRecord.filename);
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
    const address = extractAddress($, unAddr, propSeed);
    writeJson(path.join(dataDir, "address.json"), address);

    const geometry = {
      latitude: unAddr && typeof unAddr.latitude === "number" ? unAddr.latitude : null,
      longitude: unAddr && typeof unAddr.longitude === "number" ? unAddr.longitude : null,
      source_http_request:
        (unAddr && unAddr.source_http_request) ||
        (propSeed && propSeed.source_http_request) ||
        null,
      request_identifier:
        (unAddr && unAddr.request_identifier) ||
        (propSeed && propSeed.request_identifier) ||
        null,
    };
    writeJson(path.join(dataDir, "geometry.json"), geometry);
    writeJson(
      path.join(dataDir, "relationship_address_has_geometry.json"),
      {
        from: { "/": "./address.json" },
        to: { "/": "./geometry.json" },
      },
    );

    // Taxes
    const taxes = extractTaxes($);
    let taxIdx = 0;
    taxes.forEach((t) => {
      taxIdx += 1;
      writeJson(path.join(dataDir, `tax_${t.tax_year || taxIdx}.json`), t);
    });

    // Sales history & deeds
    const salesHistory = extractSalesAndDeeds($);
    salesHistory.forEach((sale, i) => {
      const saleIndex = i + 1;
      const saleFileName = `sales_history_${saleIndex}.json`;
      const salePayload = {
        ownership_transfer_date: sale.ownership_transfer_date,
        purchase_price_amount: sale.purchase_price_amount,
      };
      writeJson(path.join(dataDir, saleFileName), salePayload);

      const hasDeedData =
        sale.deed_type != null ||
        sale.book != null ||
        sale.page != null ||
        sale.volume != null ||
        sale.instrument_number != null ||
        sale.deed_link != null;
      if (hasDeedData) {
        const deedFileName = `deed_${saleIndex}.json`;
        const deedPayload = {};
        if (sale.deed_type) deedPayload.deed_type = sale.deed_type;
        if (sale.book) deedPayload.book = String(sale.book);
        if (sale.page) deedPayload.page = String(sale.page);
        if (sale.volume) deedPayload.volume = String(sale.volume);
        if (sale.instrument_number)
          deedPayload.instrument_number = String(sale.instrument_number);
        writeJson(path.join(dataDir, deedFileName), deedPayload);
        writeJson(
          path.join(
            dataDir,
            `relationship_sales_history_${saleIndex}_has_deed_${saleIndex}.json`,
          ),
          {
            from: { "/": `./${saleFileName}` },
            to: { "/": `./${deedFileName}` },
          },
        );

        if (sale.deed_link) {
          const fileName = `file_${saleIndex}.json`;
          writeJson(path.join(dataDir, fileName), {
            document_type: "Title",
            file_format: null,
            ipfs_url: null,
            name:
              sale.book && sale.page
                ? `Deed ${sale.book}/${sale.page}`
                : "Deed Document",
            original_url: sale.deed_link,
          });
          writeJson(
            path.join(
              dataDir,
              `relationship_deed_${saleIndex}_has_file_1.json`,
            ),
            {
              from: { "/": `./deed_${saleIndex}.json` },
              to: { "/": `./${fileName}` },
            },
          );
        }
      }
    });

    // Owners
    const parcelDashed =
      extractParcelId($) || (propSeed && propSeed.parcel_id) || "";
    const parcelFlat = parcelDashed.replace(/[-]/g, "");
    const ownerRequestInfo = {
      source_http_request:
        (unAddr && unAddr.source_http_request) ||
        (propSeed && propSeed.source_http_request) ||
        null,
      request_identifier:
        (unAddr && unAddr.request_identifier) ||
        (propSeed && propSeed.request_identifier) ||
        null,
    };
    const ownerFiles = writeOwners(
      ownerData,
      dataDir,
      parcelDashed,
      parcelFlat,
      ownerRequestInfo,
    );

    const ownersByDate = ownerFiles.byDate || {};
    if (salesHistory.length > 0) {
      let latestSaleIdx = 0;
      let latestSaleDate = salesHistory[0].ownership_transfer_date || null;
      let latestSaleTimestamp = latestSaleDate
        ? new Date(latestSaleDate).getTime()
        : -Infinity;
      salesHistory.forEach((sale, idx) => {
        if (sale.ownership_transfer_date) {
          const ts = new Date(sale.ownership_transfer_date).getTime();
          if (Number.isFinite(ts) && ts > latestSaleTimestamp) {
            latestSaleIdx = idx;
            latestSaleTimestamp = ts;
            latestSaleDate = sale.ownership_transfer_date;
          }
        }
      });
      const ownerList =
        (latestSaleDate && ownersByDate[latestSaleDate]) ||
        ownersByDate.current ||
        [];
      ownerList.forEach((ownerFilename, idx) => {
        const base = path.basename(ownerFilename, ".json");
        const typeMatch = base.match(/^(company|person)_([0-9]+)/i);
        let relName;
        if (typeMatch) {
          relName = `relationship_sales_history_${latestSaleIdx + 1}_has_${typeMatch[1].toLowerCase()}_${typeMatch[2]}.json`;
        } else {
          relName = `relationship_sales_history_${latestSaleIdx + 1}_has_buyer_${idx + 1}.json`;
        }
        writeJson(path.join(dataDir, relName), {
          from: { "/": `./sales_history_${latestSaleIdx + 1}.json` },
          to: { "/": `./${ownerFilename}` },
        });
      });
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
    // Utilities intentionally omitted per requirements

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
        const layoutFile = `layout_${i + 1}.json`;
        writeJson(path.join(dataDir, layoutFile), lay);
        writeJson(
          path.join(
            dataDir,
            `relationship_property_has_layout_${i + 1}.json`,
          ),
          {
            from: { "/": "./property.json" },
            to: { "/": `./${layoutFile}` },
          },
        );
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
