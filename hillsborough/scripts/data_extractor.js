const fs = require("fs");
const path = require("path");

function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function parseFullAddress(full) {
  // Example: "7405 MIRACLE LN ODESSA, FL 33556-4117"
  if (!full) return {};

  // Clean up the input
  let raw = full.replace(/\r/g, "").trim();
  raw = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();

  let street_number = null;
  let street_name = null;
  let street_suffix_type = null;
  let city_name = null;
  let state_code = null;
  let postal_code = null;
  let plus_four_postal_code = null;

  // Try multiple regex patterns to match different formats
  const m =
      raw.match(
          /^(\d+)\s+([^,]+?)\s+([A-Za-z]+)\s*,\s*([A-Z\s\-']+)\s*,?\s*([A-Z]{2})\s*,?\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
          /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*,\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
          /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*([A-Z]{2})\s*,\s*(\d{5})(?:-?(\d{4}))?$/i,
      );

  if (m) {
    street_number = m[1];
    street_name = (m[2] || "").trim().replace(/\s+/g, " ").toUpperCase();
    street_suffix_type = (m[3] || "").trim();
    city_name = (m[4] || "").trim().toUpperCase();
    state_code = (m[5] || "").trim().toUpperCase();
    postal_code = (m[6] || "").trim();
    plus_four_postal_code = (m[7] || "").trim() || null;
  } else {
    // Fallback: try to parse by splitting on commas
    const parts = raw.split(",");
    if (parts.length >= 2) {
      const street = parts[0].trim();
      const cityStateZip = parts.slice(1).join(",").trim();

      // Parse street
      const streetParts = street.split(/\s+/);
      if (streetParts.length > 0) {
        street_number = streetParts[0];
        if (streetParts.length > 1) {
          street_suffix_type = streetParts[streetParts.length - 1];
          street_name = streetParts.slice(1, -1).join(" ").toUpperCase();
        }
      }

      // Parse city, state, zip
      const stateZipMatch = cityStateZip.match(/([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?/i);
      if (stateZipMatch) {
        state_code = stateZipMatch[1].toUpperCase();
        postal_code = stateZipMatch[2];
        plus_four_postal_code = stateZipMatch[3] || null;
        // Extract city (everything before state/zip)
        city_name = cityStateZip.replace(stateZipMatch[0], "").trim().toUpperCase();
      }
    }
  }

  // Comprehensive suffix mapping (use the same as Lake County script)
  const suffixMap = {
    STREET: "St",
    ST: "St",
    AVENUE: "Ave",
    AVE: "Ave",
    BOULEVARD: "Blvd",
    BLVD: "Blvd",
    ROAD: "Rd",
    RD: "Rd",
    LANE: "Ln",
    LN: "Ln",
    DRIVE: "Dr",
    DR: "Dr",
    COURT: "Ct",
    CT: "Ct",
    PLACE: "Pl",
    PL: "Pl",
    TERRACE: "Ter",
    TER: "Ter",
    CIRCLE: "Cir",
    CIR: "Cir",
    WAY: "Way",
    LOOP: "Loop",
    PARKWAY: "Pkwy",
    PKWY: "Pkwy",
    PLAZA: "Plz",
    PLZ: "Plz",
    TRAIL: "Trl",
    TRL: "Trl",
    BEND: "Bnd",
    BND: "Bnd",
    CRESCENT: "Cres",
    CRES: "Cres",
    MANOR: "Mnr",
    MNR: "Mnr",
    SQUARE: "Sq",
    SQ: "Sq",
    CROSSING: "Xing",
    XING: "Xing",
    PATH: "Path",
    RUN: "Run",
    WALK: "Walk",
    ROW: "Row",
    ALLEY: "Aly",
    ALY: "Aly",
    BEACH: "Bch",
    BCH: "Bch",
    BRIDGE: "Br",
    BRG: "Br",
    BROOK: "Brk",
    BRK: "Brk",
    BROOKS: "Brks",
    BRKS: "Brks",
    BUG: "Bg",
    BG: "Bg",
    BUGS: "Bgs",
    BGS: "Bgs",
    CLUB: "Clb",
    CLB: "Clb",
    CLIFF: "Clf",
    CLF: "Clf",
    CLIFFS: "Clfs",
    CLFS: "Clfs",
    COMMON: "Cmn",
    CMN: "Cmn",
    COMMONS: "Cmns",
    CMNS: "Cmns",
    CORNER: "Cor",
    COR: "Cor",
    CORNERS: "Cors",
    CORS: "Cors",
    CREEK: "Crk",
    CRK: "Crk",
    COURSE: "Crse",
    CRSE: "Crse",
    CREST: "Crst",
    CRST: "Crst",
    CAUSEWAY: "Cswy",
    CSWY: "Cswy",
    COVE: "Cv",
    CV: "Cv",
    CANYON: "Cyn",
    CYN: "Cyn",
    DALE: "Dl",
    DL: "Dl",
    DAM: "Dm",
    DM: "Dm",
    DRIVES: "Drs",
    DRS: "Drs",
    DIVIDE: "Dv",
    DV: "Dv",
    ESTATE: "Est",
    EST: "Est",
    ESTATES: "Ests",
    ESTS: "Ests",
    EXPRESSWAY: "Expy",
    EXPY: "Expy",
    EXTENSION: "Ext",
    EXT: "Ext",
    EXTENSIONS: "Exts",
    EXTS: "Exts",
    FALL: "Fall",
    FALL: "Fall",
    FALLS: "Fls",
    FLS: "Fls",
    FLAT: "Flt",
    FLT: "Flt",
    FLATS: "Flts",
    FLTS: "Flts",
    FORD: "Frd",
    FRD: "Frd",
    FORDS: "Frds",
    FRDS: "Frds",
    FORGE: "Frg",
    FRG: "Frg",
    FORGES: "Frgs",
    FRGS: "Frgs",
    FORK: "Frk",
    FRK: "Frk",
    FORKS: "Frks",
    FRKS: "Frks",
    FOREST: "Frst",
    FRST: "Frst",
    FREEWAY: "Fwy",
    FWY: "Fwy",
    FIELD: "Fld",
    FLD: "Fld",
    FIELDS: "Flds",
    FLDS: "Flds",
    GARDEN: "Gdn",
    GDN: "Gdn",
    GARDENS: "Gdns",
    GDNS: "Gdns",
    GLEN: "Gln",
    GLN: "Gln",
    GLENS: "Glns",
    GLNS: "Glns",
    GREEN: "Grn",
    GRN: "Grn",
    GREENS: "Grns",
    GRNS: "Grns",
    GROVE: "Grv",
    GRV: "Grv",
    GROVES: "Grvs",
    GRVS: "Grvs",
    GATEWAY: "Gtwy",
    GTWY: "Gtwy",
    HARBOR: "Hbr",
    HBR: "Hbr",
    HARBORS: "Hbrs",
    HBRS: "Hbrs",
    HILL: "Hl",
    HL: "Hl",
    HILLS: "Hls",
    HLS: "Hls",
    HOLLOW: "Holw",
    HOLW: "Holw",
    HEIGHTS: "Hts",
    HTS: "Hts",
    HAVEN: "Hvn",
    HVN: "Hvn",
    HIGHWAY: "Hwy",
    HWY: "Hwy",
    INLET: "Inlt",
    INLT: "Inlt",
    ISLAND: "Is",
    IS: "Is",
    ISLANDS: "Iss",
    ISS: "Iss",
    ISLE: "Isle",
    SPUR: "Spur",
    JUNCTION: "Jct",
    JCT: "Jct",
    JUNCTIONS: "Jcts",
    JCTS: "Jcts",
    KNOLL: "Knl",
    KNL: "Knl",
    KNOLLS: "Knls",
    KNLS: "Knls",
    LOCK: "Lck",
    LCK: "Lck",
    LOCKS: "Lcks",
    LCKS: "Lcks",
    LODGE: "Ldg",
    LDG: "Ldg",
    LIGHT: "Lgt",
    LGT: "Lgt",
    LIGHTS: "Lgts",
    LGTS: "Lgts",
    LAKE: "Lk",
    LK: "Lk",
    LAKES: "Lks",
    LKS: "Lks",
    LANDING: "Lndg",
    LNDG: "Lndg",
    MALL: "Mall",
    MEWS: "Mews",
    MEADOW: "Mdw",
    MDW: "Mdw",
    MEADOWS: "Mdws",
    MDWS: "Mdws",
    MILL: "Ml",
    ML: "Ml",
    MILLS: "Mls",
    MLS: "Mls",
    MANORS: "Mnrs",
    MNRS: "Mnrs",
    MOUNT: "Mt",
    MT: "Mt",
    MOUNTAIN: "Mtn",
    MTN: "Mtn",
    MOUNTAINS: "Mtns",
    MTNS: "Mtns",
    OVERPASS: "Opas",
    OPAS: "Opas",
    ORCHARD: "Orch",
    ORCH: "Orch",
    OVAL: "Oval",
    PARK: "Park",
    PASS: "Pass",
    PIKE: "Pike",
    PLAIN: "Pln",
    PLN: "Pln",
    PLAINS: "Plns",
    PLNS: "Plns",
    PINE: "Pne",
    PNE: "Pne",
    PINES: "Pnes",
    PNES: "Pnes",
    PRAIRIE: "Pr",
    PR: "Pr",
    PORT: "Prt",
    PRT: "Prt",
    PORTS: "Prts",
    PRTS: "Prts",
    PASSAGE: "Psge",
    PSGE: "Psge",
    POINT: "Pt",
    PT: "Pt",
    POINTS: "Pts",
    PTS: "Pts",
    RADIAL: "Radl",
    RADL: "Radl",
    RAMP: "Ramp",
    REST: "Rst",
    RIDGE: "Rdg",
    RDG: "Rdg",
    RIDGES: "Rdgs",
    RDGS: "Rdgs",
    ROADS: "Rds",
    RDS: "Rds",
    RANCH: "Rnch",
    RNCH: "Rnch",
    RAPID: "Rpd",
    RPD: "Rpd",
    RAPIDS: "Rpds",
    RPDS: "Rpds",
    ROUTE: "Rte",
    RTE: "Rte",
    SHOAL: "Shl",
    SHL: "Shl",
    SHOALS: "Shls",
    SHLS: "Shls",
    SHORE: "Shr",
    SHR: "Shr",
    SHORES: "Shrs",
    SHRS: "Shrs",
    SKYWAY: "Skwy",
    SKWY: "Skwy",
    SUMMIT: "Smt",
    SMT: "Smt",
    SPRING: "Spg",
    SPG: "Spg",
    SPRINGS: "Spgs",
    SPGS: "Spgs",
    SQUARES: "Sqs",
    SQS: "Sqs",
    STATION: "Sta",
    STA: "Sta",
    STRAVENUE: "Stra",
    STRA: "Stra",
    STREAM: "Strm",
    STRM: "Strm",
    STREETS: "Sts",
    STS: "Sts",
    THROUGHWAY: "Trwy",
    TRWY: "Trwy",
    TRACE: "Trce",
    TRCE: "Trce",
    TRAFFICWAY: "Trfy",
    TRFY: "Trfy",
    TRAILER: "Trlr",
    TRLR: "Trlr",
    TUNNEL: "Tunl",
    TUNL: "Tunl",
    UNION: "Un",
    UN: "Un",
    UNIONS: "Uns",
    UNS: "Uns",
    UNDERPASS: "Upas",
    UPAS: "Upas",
    VIEW: "Vw",
    VIEWS: "Vws",
    VILLAGE: "Vlg",
    VLG: "Vlg",
    VILLAGES: "Vlgs",
    VLGS: "Vlgs",
    VALLEY: "Vl",
    VLY: "Vl",
    VALLEYS: "Vlys",
    VLYS: "Vlys",
    WAYS: "Ways",
    VIA: "Via",
    WELL: "Wl",
    WL: "Wl",
    WELLS: "Wls",
    WLS: "Wls",
    CROSSROAD: "Xrd",
    XRD: "Xrd",
    CROSSROADS: "Xrds",
    XRDS: "Xrds",
  };

  if (street_suffix_type) {
    const key = street_suffix_type.toUpperCase();
    if (suffixMap[key]) {
      street_suffix_type = suffixMap[key];
    }
  }

  return {
    street_number,
    street_name,
    street_suffix_type,
    city_name,
    state_code,
    postal_code,
    plus_four_postal_code,
  };
}

function mapPropertyType(building, landUse) {
  // First try to map from building type code
  const buildingCode = building && building.type && building.type.code
      ? building.type.code.trim()
      : null;

  if (buildingCode) {
    const mapped = mapBuildingTypeCode(buildingCode);
    if (mapped) return mapped;
  }

  // Fallback to land use code
  const landUseCode = landUse && landUse.code
      ? landUse.code.trim()
      : null;

  if (landUseCode) {
    const mapped = mapLandUseCode(landUseCode);
    if (mapped) return mapped;
  }

  // Final fallback: return description as-is
  return building && building.type && building.type.description
      ? building.type.description
      : null;
}

function mapBuildingTypeCode(code) {
  const mappings = {
    '01': 'SingleFamily',
    '02': 'ManufacturedHousing',  // Manufactured Home (AYB > 1976)
    '03': 'Modular',
    '08': 'MobileHome',  // Mobile Home (AYB < 1977)
    '22': 'Apartment',
    '23': 'Apartment',
    '24': 'Townhouse',
    '25': 'Condominium',
    '27': 'Duplex',  // Duplex/Triplex/Quadplex
    'NC01': 'SingleFamily',
    'NC02': 'ManufacturedHousing',
    'NC08': 'MobileHome',
    'NC27': 'Duplex',
  };

  return mappings[code] || null;
}

function mapLandUseCode(code) {
  const mappings = {
    '0100': 'SingleFamily',  // SINGLE FAMILY R
    '0102': 'SingleFamily',  // SFR BLD ARND MH
    '0106': 'Townhouse',     // TOWNHOUSE/VILLA
    '0200': 'MobileHome',    // MH
    '0300': 'MultiFamilyMoreThan10',  // MFR >9 UNITS
    '0310': 'MultiFamilyMoreThan10',  // MFR CLASS A
    '0320': 'MultiFamilyMoreThan10',  // MFR CLASS B
    '0330': 'MultiFamilyMoreThan10',  // MFR CLASS C
    '0340': 'MultiFamilyMoreThan10',  // MFR CLASS D
    '0350': 'MultiFamilyMoreThan10',  // MFR CLASS E
    '0400': 'Condominium',
    '0403': 'Condominium',   // CONDO APARTMENT
    '0408': 'Condominium',   // MH CONDOMINIUM
    '0500': 'Cooperative',
    '0508': 'Cooperative',   // MH CO-OP
    '0600': 'Retirement',
    '0610': 'Retirement',    // ALF A
    '0620': 'Retirement',    // ALF B
    '0630': 'Retirement',    // ALF C
    '0640': 'Retirement',    // ALF D
    '0700': 'MiscellaneousResidential',
    '0800': 'MultiFamilyLessThan10',  // MFR <10 UNITS
    '0801': 'MultiFamilyLessThan10',  // MULTI RES DWELLINGS
    '0901': 'ResidentialCommonElementsAreas',  // RESIDENTIAL HOA
    '0902': 'ResidentialCommonElementsAreas',  // CONDO HOA
    '0903': 'ResidentialCommonElementsAreas',  // TOWNHOUSE HOA
    '1000': 'VacantLand',    // VACANT COMM
    '0000': 'VacantLand',    // VACANT RESIDENTIAL < 20 AC
    '9900': 'VacantLand',    // VACANT ACREAGE > 20 AC
  };

  return mappings[code] || null;
}

function extractYearYYYY(dateStr) {
  if (!dateStr) return null;
  const iso = dateStr.match(/^(\d{4})-/);
  if (iso) return Number(iso[1]);
  const us = dateStr.match(/\b(\d{4})\b$/);
  if (us) return Number(us[1]);
  return null;
}

function mapDeedType(code) {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  if (c === "WD") return "Warranty Deed";
  if (c === "QC") return "Quitclaim Deed";
  if (c === "CT") return "Court Order Deed"; // Certificate of Title => court ordered conveyance
  return null;
}

function buildStructureFromInput(input) {
  const b =
    Array.isArray(input.buildings) && input.buildings.length
      ? input.buildings[0]
      : null;
  const ci = b && Array.isArray(b.constructionInfo) ? b.constructionInfo : [];
  const byElem = (code) =>
    ci.find(
      (x) => x.element && x.element.code && x.element.code.trim() === code,
    );
  const allByElem = (code) =>
    ci.filter(
      (x) => x.element && x.element.code && x.element.code.trim() === code,
    );

  const ar = byElem("AR");
  const ew = byElem("EW");
  const rs = byElem("RS");
  const rc = byElem("RC");
  const iw = byElem("IW");
  const ifs = allByElem("IF");
  const cls = byElem("01");

  // Architectural style
  let architectural_style_type = null;
  if (ar && ar.constructionDetail && ar.constructionDetail.description) {
    const d = ar.constructionDetail.description.toUpperCase();
    if (d.includes("CONTEMPORARY")) architectural_style_type = "Contemporary";
  }

  // Exterior wall material
  let exterior_wall_material_primary = null;
  if (ew && ew.constructionDetail && ew.constructionDetail.description) {
    const d = ew.constructionDetail.description.toUpperCase();
    if (d.includes("STUCCO")) exterior_wall_material_primary = "Stucco";
    else if (d.includes("BRICK")) exterior_wall_material_primary = "Brick";
    else if (d.includes("VINYL"))
      exterior_wall_material_primary = "Vinyl Siding";
    else if (d.includes("CONCRETE BLOCK"))
      exterior_wall_material_primary = "Concrete Block";
  }

  // Roof design type
  let roof_design_type = null;
  if (rs && rs.constructionDetail && rs.constructionDetail.description) {
    const d = rs.constructionDetail.description.toUpperCase();
    if (d.includes("GABLE") && d.includes("HIP"))
      roof_design_type = "Combination";
    else if (d.includes("GABLE")) roof_design_type = "Gable";
    else if (d.includes("HIP")) roof_design_type = "Hip";
  }

  // Roof covering material (enum list includes Architectural Asphalt Shingle)
  let roof_covering_material = null;
  if (rc && rc.constructionDetail && rc.constructionDetail.description) {
    const d = rc.constructionDetail.description.toUpperCase();
    if (d.includes("SHINGLE")) {
      // Prefer Architectural Asphalt Shingle as most common composition shingles
      roof_covering_material = "Architectural Asphalt Shingle";
    } else if (d.includes("METAL")) {
      roof_covering_material = "Metal Standing Seam";
    } else if (d.includes("TILE")) {
      roof_covering_material = "Concrete Tile";
    }
  }

  // Interior wall surface material primary
  let interior_wall_surface_material_primary = null;
  if (iw && iw.constructionDetail && iw.constructionDetail.description) {
    const d = iw.constructionDetail.description.toUpperCase();
    if (d.includes("DRYWALL"))
      interior_wall_surface_material_primary = "Drywall";
    else if (d.includes("PLASTER"))
      interior_wall_surface_material_primary = "Plaster";
  }

  // Flooring materials
  let flooring_material_primary = null;
  let flooring_material_secondary = null;
  if (ifs && ifs.length) {
    // If any 'Tile' present, map to Ceramic Tile as primary
    const hasTile = ifs.some(
      (x) =>
        x.constructionDetail &&
        String(x.constructionDetail.description || "")
          .toUpperCase()
          .includes("TILE"),
    );
    const hasCarpet = ifs.some(
      (x) =>
        x.constructionDetail &&
        String(x.constructionDetail.description || "")
          .toUpperCase()
          .includes("CARPET"),
    );
    if (hasTile) flooring_material_primary = "Ceramic Tile";
    if (hasCarpet) flooring_material_secondary = "Carpet";
  }

  // Roof material type (broad category)
  let roof_material_type = null;
  if (roof_covering_material && roof_covering_material.includes("Shingle"))
    roof_material_type = "Shingle";

  // Primary framing material (Class Concrete Block)
  let primary_framing_material = null;
  if (cls && cls.constructionDetail && cls.constructionDetail.description) {
    const d = cls.constructionDetail.description.toUpperCase();
    if (d.includes("CONCRETE BLOCK"))
      primary_framing_material = "Concrete Block";
  }

  // Build structure object ensuring all required fields exist
  const obj = {
    architectural_style_type: architectural_style_type,
    attachment_type: "Detached",
    exterior_wall_material_primary: exterior_wall_material_primary,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: flooring_material_primary,
    flooring_material_secondary: flooring_material_secondary,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      interior_wall_surface_material_primary,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: roof_covering_material,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: roof_design_type,
    roof_condition: null,
    roof_age_years:
      b && b.yearBuilt ? new Date().getFullYear() - Number(b.yearBuilt) : null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: roof_material_type,
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
    primary_framing_material: primary_framing_material,
    secondary_framing_material: null,
    structural_damage_indicators: null,
  };
  return obj;
}

function extractSuffixFromOwnerString(ownerString, person) {
  if (!ownerString || !person) return null;
  // Look for a segment matching last + first, then detect JR/SR/II/III/IV
  const segments = ownerString
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const target = `${person.last_name} ${person.first_name}`
    .trim()
    .toUpperCase();
  const match = segments.find((seg) => seg.toUpperCase().startsWith(target));
  if (!match) return null;
  const up = match.toUpperCase();
  if (/(\s|^)JR\.?($|\s)/.test(up)) return "Jr.";
  if (/(\s|^)SR\.?($|\s)/.test(up)) return "Sr.";
  if (/(\s|^)II($|\s)/.test(up)) return "II";
  if (/(\s|^)III($|\s)/.test(up)) return "III";
  if (/(\s|^)IV($|\s)/.test(up)) return "IV";
  return null;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const input = readJson("input.json");
  const addrSrc = readJson("unnormalized_address.json");
  const seed = readJson("property_seed.json");

  // Owners/utilities/layout
  const ownersData = readJson(path.join("owners", "owner_data.json"));
  const utilsData = readJson(path.join("owners", "utilities_data.json"));
  const layoutData = readJson(path.join("owners", "layout_data.json"));

  const pin = input.pin || seed.request_identifier;

  // Build property.json
  const building = (input.buildings && input.buildings[0]) || null;
  const legalDesc =
    (input.propertyCard && input.propertyCard.legalDescription) ||
    input.shortLegal ||
    null;
  const heatedArea =
    building && typeof building.heatedArea === "number"
      ? String(building.heatedArea)
      : null;
  const grossArea =
    building && typeof building.grossArea === "number"
      ? String(building.grossArea)
      : null;

  const mappedPropType = mapPropertyType(building, input.landUse);

  if (!mappedPropType) {
    const error = {
      type: "error",
      message: `Unable to map property type from building code or land use code.`,
      path: "property.property_type",
    };
    writeJson(path.join(dataDir, "error_property_type.json"), error);
  }

  const propertyObj = {
    parcel_identifier: input.pin || "",
    property_type: mappedPropType,
    property_structure_built_year:
      building && building.yearBuilt ? Number(building.yearBuilt) : null,
    property_legal_description_text: legalDesc || "",
    livable_floor_area: heatedArea,
    total_area: grossArea,
    subdivision:
      (input.propertyCard &&
        input.propertyCard.subdivision &&
        input.propertyCard.subdivision.description) ||
      (input.subdivision && input.subdivision.description) ||
      null,
    zoning:
      (input.landLines && input.landLines[0] && input.landLines[0].zone) ||
      null,
    number_of_units_type:
      building && typeof building.units === "number"
        ? building.units === 1
          ? "One"
          : building.units === 2
            ? "Two"
            : building.units === 3
              ? "Three"
              : building.units === 4
                ? "Four"
                : "OneToFour"
        : null,
    number_of_units:
      building && typeof building.units === "number" ? building.units : null,
    area_under_air: heatedArea,
  };
  writeJson(path.join(dataDir, "property.json"), propertyObj);

  // Address
  const parsed = parseFullAddress(addrSrc.full_address);
  const addressObj = {
    street_number: parsed.street_number || null,
    street_name: parsed.street_name || null,
    street_suffix_type: parsed.street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: parsed.city_name ? parsed.city_name.toUpperCase() : null,
    municipality_name: null,
    state_code: parsed.state_code || null,
    postal_code: parsed.postal_code || null,
    plus_four_postal_code: parsed.plus_four_postal_code || null,
    country_code: null,
    county_name: addrSrc.county_jurisdiction || "Hillsborough",
    latitude: null,
    longitude: null,
    route_number: null,
    township: (input.propertyCard && input.propertyCard.township) || null,
    range: (input.propertyCard && input.propertyCard.range) || null,
    section: (input.propertyCard && input.propertyCard.section) || null,
    block: (input.propertyCard && input.propertyCard.blockCode) || null,
    lot: (input.propertyCard && input.propertyCard.lotCode) || null,
  };
  writeJson(path.join(dataDir, "address.json"), addressObj);

  // Tax (single record from latest/current)
  const vs = Array.isArray(input.valueSummary) ? input.valueSummary : [];
  let vsCounty = vs.find((v) => v.sequence === 1) || vs[0] || null;
  const curr = (input.propertyCard && input.propertyCard.current) || {};
  const currDate =
    (input.propertyCard &&
      input.propertyCard.current &&
      input.propertyCard.current._date) ||
    null;
  const taxYear = extractYearYYYY(currDate);
  if (vsCounty) {
    const taxObj = {
      tax_year: taxYear,
      property_assessed_value_amount:
        typeof vsCounty.assessedVal === "number" ? vsCounty.assessedVal : null,
      property_market_value_amount:
        typeof vsCounty.marketVal === "number" ? vsCounty.marketVal : null,
      property_building_amount:
        typeof curr.buildings === "number" ? curr.buildings : null,
      property_land_amount: typeof curr.land === "number" ? curr.land : null,
      property_taxable_value_amount:
        typeof vsCounty.taxableVal === "number" ? vsCounty.taxableVal : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
    };
    writeJson(path.join(dataDir, "tax_1.json"), taxObj);
  }

  // Owners (from owners/owner_data.json only). Enrich suffix from input.owner string if recognizable.
  const ownersKey = `property_${pin}`;
  const ownersEntry = ownersData[ownersKey] || {};
  const currentOwners =
    (ownersEntry.owners_by_date && ownersEntry.owners_by_date.current) || [];
  let personIndex = 0;
  currentOwners.forEach((o) => {
    if (o.type === "person") {
      personIndex += 1;
      let suffix_name = null;
      const tempPerson = {
        first_name: o.first_name || "",
        last_name: o.last_name || "",
      };
      const detected = extractSuffixFromOwnerString(
        input.owner || "",
        tempPerson,
      );
      if (detected) suffix_name = detected;
      const person = {
        birth_date: null,
        first_name: o.first_name || "",
        last_name: o.last_name || "",
        middle_name: o.middle_name || null,
        prefix_name: null,
        suffix_name: suffix_name,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJson(path.join(dataDir, `person_${personIndex}.json`), person);
    }
  });

  // Utilities
  const utilEntry = utilsData[ownersKey] || null;
  if (utilEntry) {
    const utilityObj = {
      cooling_system_type: utilEntry.cooling_system_type ?? null,
      heating_system_type: utilEntry.heating_system_type ?? null,
      public_utility_type: utilEntry.public_utility_type ?? null,
      sewer_type: utilEntry.sewer_type ?? null,
      water_source_type: utilEntry.water_source_type ?? null,
      plumbing_system_type: utilEntry.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utilEntry.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utilEntry.electrical_panel_capacity ?? null,
      electrical_wiring_type: utilEntry.electrical_wiring_type ?? null,
      hvac_condensing_unit_present:
        utilEntry.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        utilEntry.electrical_wiring_type_other_description ?? null,
      solar_panel_present: utilEntry.solar_panel_present ?? false,
      solar_panel_type: utilEntry.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utilEntry.solar_panel_type_other_description ?? null,
      smart_home_features: utilEntry.smart_home_features ?? null,
      smart_home_features_other_description:
        utilEntry.smart_home_features_other_description ?? null,
      hvac_unit_condition: utilEntry.hvac_unit_condition ?? null,
      solar_inverter_visible: utilEntry.solar_inverter_visible ?? false,
      hvac_unit_issues: utilEntry.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        utilEntry.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilEntry.electrical_rewire_date ?? null,
      hvac_capacity_kw: utilEntry.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilEntry.hvac_capacity_tons ?? null,
      hvac_equipment_component: utilEntry.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer:
        utilEntry.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilEntry.hvac_equipment_model ?? null,
      hvac_installation_date: utilEntry.hvac_installation_date ?? null,
      hvac_seer_rating: utilEntry.hvac_seer_rating ?? null,
      hvac_system_configuration: utilEntry.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
        utilEntry.plumbing_system_installation_date ?? null,
      sewer_connection_date: utilEntry.sewer_connection_date ?? null,
      solar_installation_date: utilEntry.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utilEntry.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer:
        utilEntry.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilEntry.solar_inverter_model ?? null,
      water_connection_date: utilEntry.water_connection_date ?? null,
      water_heater_installation_date:
        utilEntry.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilEntry.water_heater_manufacturer ?? null,
      water_heater_model: utilEntry.water_heater_model ?? null,
      well_installation_date: utilEntry.well_installation_date ?? null,
    };
    writeJson(path.join(dataDir, "utility.json"), utilityObj);
  }

  // Layouts
  const layoutEntry = layoutData[ownersKey] || {};
  const layouts = layoutEntry.layouts || [];
  layouts.forEach((lo, idx) => {
    const layoutObj = {
      space_type: lo.space_type ?? null,
      space_index: lo.space_index ?? null,
      flooring_material_type: lo.flooring_material_type ?? null,
      size_square_feet: lo.size_square_feet ?? null,
      floor_level: lo.floor_level ?? null,
      has_windows: lo.has_windows ?? null,
      window_design_type: lo.window_design_type ?? null,
      window_material_type: lo.window_material_type ?? null,
      window_treatment_type: lo.window_treatment_type ?? null,
      is_finished: lo.is_finished ?? false,
      furnished: lo.furnished ?? null,
      paint_condition: lo.paint_condition ?? null,
      flooring_wear: lo.flooring_wear ?? null,
      clutter_level: lo.clutter_level ?? null,
      visible_damage: lo.visible_damage ?? null,
      countertop_material: lo.countertop_material ?? null,
      cabinet_style: lo.cabinet_style ?? null,
      fixture_finish_quality: lo.fixture_finish_quality ?? null,
      design_style: lo.design_style ?? null,
      natural_light_quality: lo.natural_light_quality ?? null,
      decor_elements: lo.decor_elements ?? null,
      pool_type: lo.pool_type ?? null,
      pool_equipment: lo.pool_equipment ?? null,
      spa_type: lo.spa_type ?? null,
      safety_features: lo.safety_features ?? null,
      view_type: lo.view_type ?? null,
      lighting_features: lo.lighting_features ?? null,
      condition_issues: lo.condition_issues ?? null,
      is_exterior: lo.is_exterior,
      pool_condition: lo.pool_condition ?? null,
      pool_surface_type: lo.pool_surface_type ?? null,
      pool_water_quality: lo.pool_water_quality ?? null,
      bathroom_renovation_date: lo.bathroom_renovation_date ?? null,
      kitchen_renovation_date: lo.kitchen_renovation_date ?? null,
      flooring_installation_date: lo.flooring_installation_date ?? null,
    };
    writeJson(path.join(dataDir, `layout_${idx + 1}.json`), layoutObj);
  });

  // Sales and Deeds
  const sales = Array.isArray(input.salesHistory) ? input.salesHistory : [];
  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleObj = {
      ownership_transfer_date: s.saleDate || null,
      purchase_price_amount:
        typeof s.salePrice === "number" ? s.salePrice : null,
    };
    writeJson(path.join(dataDir, `sales_${idx}.json`), saleObj);

    const deedType = mapDeedType(s.deedType);
    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    writeJson(path.join(dataDir, `deed_${idx}.json`), deedObj);

    const relSD = {
      to: { "/": `./sales_${idx}.json` },
      from: { "/": `./deed_${idx}.json` },
    };
    writeJson(path.join(dataDir, `relationship_sales_deed_${idx}.json`), relSD);
  });

  // Relationships: sales → person (link current owners to latest sale)
  const latestSaleIdx = sales.length > 0 ? 1 : null; // assumes latest sale is first
  if (latestSaleIdx && currentOwners.length > 0) {
    let relIdx = 0;
    currentOwners.forEach((o) => {
      if (o.type === "person") {
        relIdx += 1;
        const rel = {
          to: { "/": `./person_${relIdx}.json` },
          from: { "/": `./sales_${latestSaleIdx}.json` },
        };
        writeJson(
          path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
          rel,
        );
      }
    });
  }

  // Lot
  const acreage = input.acreage;
  const lot_area_sqft =
    typeof acreage === "number" ? Math.round(acreage * 43560) : null;
  const lotObj = {
    lot_type:
      typeof acreage === "number"
        ? acreage > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre"
        : null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: acreage ?? null,
  };
  writeJson(path.join(dataDir, "lot.json"), lotObj);

  // Structure (from input.json)
  const structure = buildStructureFromInput(input);
  writeJson(path.join(dataDir, "structure.json"), structure);

  // Files: Building permits and property image
  let fileIdx = 0;
  // Permits
  if (Array.isArray(input.permitInfo)) {
    input.permitInfo.forEach((p) => {
      if (p && p.permitUrl) {
        fileIdx += 1;
        const f = {
          document_type: "BuildingPermit",
          file_format: "txt",
          name: p.permitNum
            ? `Permit ${p.permitNum}`
            : `Permit ${p.id || fileIdx}`,
          original_url: p.permitUrl,
          ipfs_url: null,
        };
        writeJson(path.join(dataDir, `file_${fileIdx}.json`), f);
      }
    });
  }
  // Street-level property image
  if (input.streetLevelURL) {
    fileIdx += 1;
    const f = {
      document_type: "PropertyImage",
      file_format: "jpeg",
      name: "Street View",
      original_url: input.streetLevelURL,
      ipfs_url: null,
    };
    writeJson(path.join(dataDir, `file_${fileIdx}.json`), f);
  }
}

main();
