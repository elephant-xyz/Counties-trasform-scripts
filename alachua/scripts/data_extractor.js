// Data extraction script per instructions
// Reads: input.html, unnormalized_address.json, property_seed.json, owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
// Writes: JSON outputs under ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf-8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function clone(obj) {
  if (obj == null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

function moneyToNumber(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "" || n === ".") return null;
  const v = Number(n);
  return isNaN(v) ? null : v;
}

function parseIntSafe(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9]/g, "");
  if (!n) return null;
  return parseInt(n, 10);
}

function parseFloatSafe(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeId(value) {
  if (value == null) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length ? normalized : null;
}

function relationshipBaseName(filePath) {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/^\.\/+/, "").trim();
  if (!normalized) return null;
  return normalized.toLowerCase().endsWith(".json")
    ? normalized.slice(0, -5)
    : normalized;
}

function makeRelationshipFilename(fromPath, toPath) {
  const fromBase = relationshipBaseName(fromPath);
  const toBase = relationshipBaseName(toPath);
  if (!fromBase || !toBase) return null;
  return `relationship_${fromBase}_has_${toBase}.json`;
}

function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function titleCase(str) {
  return (str || "").replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const COMPANY_KEYWORDS =
  /(\b|\s)(inc\.?|l\.l\.c\.|llc|ltd\.?|foundation|alliance|solutions|corp\.?|co\.?|services|trust\b|trustee\b|trustees\b|tr\b|associates|partners|partnership|investment|investments|lp\b|llp\b|bank\b|n\.a\.|na\b|pllc\b|company|enterprises|properties|holdings|estate)(\b|\s)/i;
const SUFFIXES_IGNORE =
  /^(jr|sr|ii|iii|iv|v|vi|vii|viii|ix|x|md|phd|esq|esquire)$/i;

function isCompanyName(txt) {
  if (!txt) return false;
  return COMPANY_KEYWORDS.test(txt);
}

function tokenizeNamePart(part) {
  return cleanText(part)
    .replace(/^\*+/, "")
    .replace(/[^A-Za-z&'\-\s\.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function isValidMiddleName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  // Must match pattern: ^[A-Z][a-zA-Z\s\-',.]*$
  return /^[A-Z][a-zA-Z\s\-',.]*$/.test(trimmed);
}

function isValidFirstOrLastName(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  // Must match pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  return /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(trimmed);
}

function buildPersonFromTokens(tokens, fallbackLastName) {
  if (!tokens || !tokens.length) return null;
  if (tokens.length === 1) return null;

  let last = tokens[0];
  let first = tokens[1] || null;
  let middle = tokens.length > 2 ? tokens.slice(2).join(" ") : null;

  if (
    fallbackLastName &&
    tokens.length <= 2 &&
    tokens[0] &&
    tokens[0] === tokens[0].toUpperCase() &&
    tokens[1]
  ) {
    first = tokens[0];
    middle = tokens[1] || null;
    last = fallbackLastName;
  }

  if (middle) {
    const mids = middle.split(" ").filter((t) => !SUFFIXES_IGNORE.test(t));
    middle = mids.join(" ") || null;
  }

  const middleNameValue = middle ? titleCase(middle) : null;

  return {
    type: "person",
    first_name: titleCase(first || ""),
    last_name: titleCase(last || ""),
    middle_name: middleNameValue && isValidMiddleName(middleNameValue) ? middleNameValue : null,
  };
}

function splitMultiplePersonsWithSharedLast(tokens) {
  const owners = [];
  if (!tokens || tokens.length < 4) return owners;
  const lastTok = tokens[0];
  const rem = tokens.slice(1);
  for (let i = 0; i < rem.length; ) {
    const first = rem[i];
    const possibleMiddle = rem[i + 1] || null;
    if (possibleMiddle) {
      const p = buildPersonFromTokens([lastTok, first, possibleMiddle], null);
      if (p) owners.push(p);
      i += 2;
    } else {
      const p = buildPersonFromTokens([lastTok, first], null);
      if (p) owners.push(p);
      i += 1;
    }
  }
  return owners;
}

function parseOwnersFromText(rawText) {
  const invalids = [];
  const owners = [];
  if (!rawText) return { owners, invalids };
  let text = cleanText(rawText)
    .replace(/^\*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const commaSegments = text.split(/\s*,\s*/).filter(Boolean);
  let lastSurname = null;

  const pushOwnerOrInvalid = (segment) => {
    const seg = cleanText(segment).replace(/^\*/, "").trim();
    if (!seg) return;

    if (isCompanyName(seg)) {
      owners.push({ type: "company", name: titleCase(seg) });
      return;
    }

    const andParts = seg.split(/\s*(?:&|\band\b)\s*/i).filter(Boolean);
    let localLastSurname = null;

    andParts.forEach((part, idx) => {
      const tokens = tokenizeNamePart(part);
      if (!tokens.length) return;

      if (andParts.length === 1 && tokens.length >= 4) {
        const multi = splitMultiplePersonsWithSharedLast(tokens);
        if (multi.length >= 2) {
          multi.forEach((p) => owners.push(p));
          lastSurname = tokens[0].toUpperCase();
          return;
        }
      }

      if (idx === 0) {
        localLastSurname = tokens[0];
      }

      let person = buildPersonFromTokens(
        tokens,
        idx > 0 ? localLastSurname || lastSurname : null,
      );

      if (!person && tokens.length >= 4) {
        const lastTok = tokens[0];
        const first1 = tokens[1];
        const mid1 = tokens[2];
        const rem = tokens.slice(3);
        const p1 = buildPersonFromTokens([lastTok, first1, mid1], null);
        const p2 = buildPersonFromTokens(rem, lastTok);
        if (p1 && p2) {
          owners.push(p1);
          owners.push(p2);
          if (lastTok) lastSurname = lastTok.toUpperCase();
          return;
        }
      }

      if (person) {
        owners.push(person);
        if (person.last_name) {
          lastSurname = person.last_name.toUpperCase();
        }
      } else {
        invalids.push({
          raw: part,
          reason: "ambiguous_or_incomplete_person_name",
        });
      }
    });
  };

  commaSegments.forEach((seg) => pushOwnerOrInvalid(seg));

  const seen = new Set();
  const deduped = [];
  owners.forEach((o) => {
    const key =
      o.type === "company"
        ? cleanText(o.name || "").toLowerCase()
        : [
            (o.first_name || "").toLowerCase(),
            (o.middle_name || "").toLowerCase(),
            (o.last_name || "").toLowerCase(),
          ]
            .filter(Boolean)
            .join("|");
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (o.type === "person" && (!o.middle_name || !o.middle_name.trim())) {
      o.middle_name = null;
    }
    deduped.push(o);
  });

  return { owners: deduped, invalids };
}

function mapFileDocumentType() {
  return "Title";
}

const DEED_TYPE_MAP = Object.freeze({
  WD: "Warranty Deed",
  WARRANTY_DEED: "Warranty Deed",
  WARRANTY: "Warranty Deed",
  QD: "Quitclaim Deed",
  QUIT_CLAIM_DEED: "Quitclaim Deed",
  QUITCLAIM_DEED: "Quitclaim Deed",
  SWD: "Special Warranty Deed",
  SPECIAL_WARRANTY_DEED: "Special Warranty Deed",
  PRD: "Personal Representative Deed",
  PERSONAL_REPRESENTATIVE_DEED: "Personal Representative Deed",
  TD: "Trustee's Deed",
  TRUST_DEED: "Trustee's Deed",
  TRUSTEES_DEED: "Trustee's Deed",
  SHD: "Sheriff's Deed",
  SHERIFF_DEED: "Sheriff's Deed",
  TAX: "Tax Deed",
  TAX_DEED: "Tax Deed",
  GR: "Grant Deed",
  GRANT_DEED: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  BARGAIN_AND_SALE_DEED: "Bargain and Sale Deed",
  LADY_BIRD: "Lady Bird Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TRANSFER_ON_DEATH_DEED: "Transfer on Death Deed",
  DEED_IN_LIEU: "Deed in Lieu of Foreclosure",
  DIL: "Deed in Lieu of Foreclosure",
  LIFE_ESTATE_DEED: "Life Estate Deed",
  LED: "Life Estate Deed",
});

function mapDeedType(instr) {
  if (!instr) return "Miscellaneous";
  const normalized = instr.toUpperCase().replace(/\s+/g, "_");
  if (DEED_TYPE_MAP[normalized]) return DEED_TYPE_MAP[normalized];
  const noSpaces = instr.toUpperCase().replace(/\s+/g, "");
  if (DEED_TYPE_MAP[noSpaces]) return DEED_TYPE_MAP[noSpaces];
  return "Miscellaneous";
}

const PROPERTY_USE_CODE_DEFAULTS = {
  ownership_estate_type: "FeeSimple",
  build_status: "Improved",
  structure_form: null,
  property_usage_type: "Unknown",
  property_type: "Building",
};

const PROPERTY_USE_CODE_MAP = Object.create(null);
const PROPERTY_USE_CODES = [
  "00000","00100","00101","00102","00200","00201","00202","00300","00400","00600",
  "00700","00800","00802","00900","01000","01100","01200","01300","01400","01600",
  "01601","01700","01701","01800","01900","01901","02000","02100","02200","02300",
  "02400","02500","02600","02700","02800","02900","03000","03200","03300","03400",
  "03500","03600","03700","03800","03900","04000","04100","04200","04300","04500",
  "04600","04700","04800","04801","04803","04900","05000","05100","05200","05300",
  "05400","05500","05600","05700","05900","06000","06100","06200","06500","06600",
  "06700","06800","06900","07000","07100","07200","07300","07400","07500","07600",
  "07700","07800","07900","08000","08010","08011","08020","08030","08040","08050",
  "08090","08200","08300","08400","08500","08600","08700","08701","08710","08800",
  "08900","09000","09100","09110","09200","09300","09400","09500","09600","09601",
  "09700","09800","09900"
];

function addPropertyUseMapping(codes, overrides) {
  for (const code of codes) {
    PROPERTY_USE_CODE_MAP[code] = {
      ...PROPERTY_USE_CODE_DEFAULTS,
      ...overrides,
    };
  }
}

addPropertyUseMapping(["00000"], {
  build_status: "VacantLand",
  property_usage_type: "Unknown",
  property_type: "LandParcel",
});

addPropertyUseMapping(["00100", "00101", "00102"], {
  property_usage_type: "Residential",
  structure_form: "SingleFamilyDetached",
});

addPropertyUseMapping(["00200", "00201", "00202"], {
  property_usage_type: "Residential",
  property_type: "ManufacturedHome",
  structure_form: "ManufacturedHousing",
});

addPropertyUseMapping(["00300"], {
  property_usage_type: "Residential",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["00400"], {
  ownership_estate_type: "Condominium",
  property_usage_type: "Residential",
  property_type: "Unit",
  structure_form: "ApartmentUnit",
});

addPropertyUseMapping(["00600"], {
  property_usage_type: "Retirement",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["00700"], {
  property_usage_type: "Residential",
  structure_form: "SingleFamilyDetached",
});

addPropertyUseMapping(["00800", "00802"], {
  property_usage_type: "Residential",
  structure_form: "MultiFamilyLessThan10",
});

addPropertyUseMapping(["00900"], {
  build_status: "VacantLand",
  property_usage_type: "ResidentialCommonElementsAreas",
  property_type: "LandParcel",
});

addPropertyUseMapping(["01000"], {
  build_status: "VacantLand",
  property_usage_type: "Commercial",
  property_type: "LandParcel",
});

addPropertyUseMapping(["01100", "01200", "02500", "03000"], {
  property_usage_type: "RetailStore",
});

addPropertyUseMapping(["01300"], {
  property_usage_type: "DepartmentStore",
});

addPropertyUseMapping(["01400"], {
  property_usage_type: "Supermarket",
});

addPropertyUseMapping(["01600", "01601"], {
  property_usage_type: "ShoppingCenterCommunity",
});

addPropertyUseMapping(["01700", "01800", "01900"], {
  property_usage_type: "OfficeBuilding",
});

addPropertyUseMapping(["01701"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["01901"], {
  property_usage_type: "MedicalOffice",
});

addPropertyUseMapping(["02000"], {
  property_usage_type: "TransportationTerminal",
});

addPropertyUseMapping(["02800"], {
  property_usage_type: "TransportationTerminal",
  property_type: "LandParcel",
});

addPropertyUseMapping(["02100", "02200"], {
  property_usage_type: "Restaurant",
});

addPropertyUseMapping(["02300", "02400"], {
  property_usage_type: "FinancialInstitution",
});

addPropertyUseMapping(["02600"], {
  property_usage_type: "ServiceStation",
});

addPropertyUseMapping(["02700"], {
  property_usage_type: "AutoSalesRepair",
});

addPropertyUseMapping(["02900"], {
  property_usage_type: "WholesaleOutlet",
});

addPropertyUseMapping(["03200"], {
  property_usage_type: "Theater",
});

addPropertyUseMapping(["03300", "03400", "03500"], {
  property_usage_type: "Entertainment",
});

addPropertyUseMapping(["03600"], {
  property_usage_type: "Recreational",
});

addPropertyUseMapping(["03700"], {
  property_usage_type: "RaceTrack",
});

addPropertyUseMapping(["03800"], {
  property_usage_type: "GolfCourse",
  property_type: "LandParcel",
});

addPropertyUseMapping(["03900"], {
  property_usage_type: "Hotel",
});

addPropertyUseMapping(["04000"], {
  build_status: "VacantLand",
  property_usage_type: "Industrial",
  property_type: "LandParcel",
});

addPropertyUseMapping(["04100"], {
  property_usage_type: "LightManufacturing",
});

addPropertyUseMapping(["04200"], {
  property_usage_type: "HeavyManufacturing",
});

addPropertyUseMapping(["04300"], {
  property_usage_type: "LumberYard",
});

addPropertyUseMapping(["04500"], {
  property_usage_type: "Cannery",
});

addPropertyUseMapping(["04600"], {
  property_usage_type: "PackingPlant",
});

addPropertyUseMapping(["04700"], {
  property_usage_type: "MineralProcessing",
});

addPropertyUseMapping(["04800", "04801"], {
  property_usage_type: "Warehouse",
});

addPropertyUseMapping(["04803"], {
  property_usage_type: "Warehouse",
});

addPropertyUseMapping(["04900"], {
  property_usage_type: "OpenStorage",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05000"], {
  property_usage_type: "Agricultural",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05100"], {
  property_usage_type: "DrylandCropland",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05200"], {
  property_usage_type: "CroplandClass2",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05300"], {
  property_usage_type: "CroplandClass3",
  property_type: "LandParcel",
});

addPropertyUseMapping(["05400", "05500", "05600", "05700", "05900"], {
  property_usage_type: "TimberLand",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06000", "06100", "06200", "06500"], {
  property_usage_type: "GrazingLand",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06600"], {
  property_usage_type: "OrchardGroves",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06700"], {
  property_usage_type: "LivestockFacility",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06800"], {
  property_usage_type: "LivestockFacility",
  property_type: "LandParcel",
});

addPropertyUseMapping(["06900"], {
  property_usage_type: "Ornamentals",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07000"], {
  build_status: "VacantLand",
  property_usage_type: "GovernmentProperty",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07100"], {
  property_usage_type: "Church",
});

addPropertyUseMapping(["07200"], {
  property_usage_type: "PrivateSchool",
});

addPropertyUseMapping(["07300"], {
  property_usage_type: "PrivateHospital",
});

addPropertyUseMapping(["07400"], {
  property_usage_type: "HomesForAged",
  structure_form: "MultiFamily5Plus",
});

addPropertyUseMapping(["07500"], {
  property_usage_type: "NonProfitCharity",
});

addPropertyUseMapping(["07600"], {
  property_usage_type: "MortuaryCemetery",
  property_type: "LandParcel",
});

addPropertyUseMapping(["07700"], {
  property_usage_type: "ClubsLodges",
});

addPropertyUseMapping(["07800"], {
  property_usage_type: "SanitariumConvalescentHome",
});

addPropertyUseMapping(["07900"], {
  property_usage_type: "CulturalOrganization",
});

addPropertyUseMapping(["08000"], {
  build_status: "VacantLand",
  property_usage_type: "Conservation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08010", "08011", "08020", "08030", "08040", "08050", "08090"], {
  build_status: "VacantLand",
  property_usage_type: "GovernmentProperty",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08200"], {
  property_usage_type: "ForestParkRecreation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08300"], {
  property_usage_type: "PublicSchool",
});

addPropertyUseMapping(["08400"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08500"], {
  property_usage_type: "PublicHospital",
});

addPropertyUseMapping(["08600"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08700", "08701"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["08710"], {
  property_usage_type: "Conservation",
  property_type: "LandParcel",
});

addPropertyUseMapping(["08800", "08900"], {
  property_usage_type: "GovernmentProperty",
});

addPropertyUseMapping(["09000"], {
  ownership_estate_type: "Leasehold",
  property_usage_type: "Unknown",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09100"], {
  property_usage_type: "Utility",
});

addPropertyUseMapping(["09110"], {
  property_usage_type: "Railroad",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09200"], {
  property_usage_type: "MineralProcessing",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09300"], {
  ownership_estate_type: "SubsurfaceRights",
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09400"], {
  ownership_estate_type: "RightOfWay",
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09500"], {
  build_status: "VacantLand",
  property_usage_type: "RiversLakes",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09600", "09601"], {
  property_usage_type: "SewageDisposal",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09700"], {
  property_usage_type: "Recreational",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09800"], {
  build_status: "VacantLand",
  property_usage_type: "ReferenceParcel",
  property_type: "LandParcel",
});

addPropertyUseMapping(["09900"], {
  build_status: "VacantLand",
  property_usage_type: "TransitionalProperty",
  property_type: "LandParcel",
});

(function validatePropertyUseMappings() {
  const missing = PROPERTY_USE_CODES.filter(
    (code) => !Object.prototype.hasOwnProperty.call(PROPERTY_USE_CODE_MAP, code),
  );
  if (missing.length) {
    throw new Error(
      `Missing property use code mappings for: ${missing.join(", ")}`,
    );
  }
})();

function textOf($, el) {
  return $(el).text().trim();
}

function findRowValueByTh($, moduleSelector, thTextStartsWith) {
  const rows = $(`${moduleSelector} table.tabular-data-two-column tbody tr`);
  for (let i = 0; i < rows.length; i++) {
    const th = $(rows[i]).find("th strong").first();
    const thTxt = textOf($, th);
    if (
      thTxt &&
      thTxt.toLowerCase().startsWith(thTextStartsWith.toLowerCase())
    ) {
      const valSpan = $(rows[i]).find("td div span").first();
      return textOf($, valSpan) || null;
    }
  }
  return null;
}

function parseLocationAddressFromHTML($) {
  const addrLine1 = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl02_pnlSingleValue span",
  )
    .text()
    .trim();
  const addrLine2 = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl03_pnlSingleValue span",
  )
    .text()
    .trim();
  return { addrLine1, addrLine2 };
}

function parseOwnerMailingAddresses($) {
  const rawAddresses = [];
  $("span[id$='lblOwnerAddress']").each((_, el) => {
    const text = $(el).text();
    if (!text) return;
    const parts = text
      .split(/\n/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!parts.length) return;
    rawAddresses.push(parts.join(", "));
  });
  const uniqueAddresses = [];
  rawAddresses.forEach((addr) => {
    if (addr && !uniqueAddresses.includes(addr)) {
      uniqueAddresses.push(addr);
    }
  });
  return { rawAddresses, uniqueAddresses };
}

function parseStreetLine(line) {
  // Parses a line like "20346 NW 262ND AVE" or "22982 NW COUNTY RD 236"
  let street_number = null,
    street_pre_directional_text = null,
    street_name = null,
    street_suffix_type = null;

  // Helper function to capitalize street suffix (first letter uppercase, rest lowercase)
  const capitalizeSuffix = (suffix) => {
    if (!suffix) return null;
    const cleaned = suffix.replace(".", "").replace(/\,/, "").replace(/\s+/g, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  };

  if (line) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      street_number = parts[0];
      let startIdx = 1;

      // Check for directional prefix
      const dirToken = parts[1].toUpperCase();
      const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
      if (dirs.has(dirToken)) {
        street_pre_directional_text = dirToken;
        startIdx = 2;
      }

      // Check for special road types that include numbers (e.g., "COUNTY RD 236", "STATE ROAD 100")
      const remainingParts = parts.slice(startIdx);
      const joinedRemaining = remainingParts.join(" ").toUpperCase();

      // Pattern for County Road, State Road, Highway, etc. followed by a number
      if (joinedRemaining.match(/^(COUNTY\s+(RD|ROAD)|STATE\s+(RD|ROAD)|HIGHWAY|HWY|US|SR|CR)\s+\d+/i)) {
        // This is a special case - the entire thing is the street name, no suffix
        street_name = remainingParts.join(" ");
        street_suffix_type = null;
      } else if (remainingParts.length > 0) {
        // Standard parsing - last part is suffix
        const lastPart = remainingParts[remainingParts.length - 1];
        // Check if last part looks like a typical street suffix
        const suffixes = new Set(["ST", "STREET", "AVE", "AVENUE", "RD", "ROAD", "DR", "DRIVE",
                                 "CT", "COURT", "PL", "PLACE", "LN", "LANE", "BLVD", "BOULEVARD",
                                 "WAY", "TER", "TERRACE", "CIR", "CIRCLE", "TRL", "TRAIL", "PKWY", "PARKWAY"]);

        if (suffixes.has(lastPart.toUpperCase().replace(".", ""))) {
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        } else if (!isNaN(lastPart)) {
          // If last part is a number, it's likely part of the street name
          street_name = remainingParts.join(" ");
          street_suffix_type = null;
        } else {
          // Default behavior - treat last part as suffix
          street_suffix_type = capitalizeSuffix(lastPart);
          street_name = remainingParts.slice(0, -1).join(" ");
        }
      }
    }
  }
  return {
    street_number,
    street_pre_directional_text,
    street_name,
    street_suffix_type,
  };
}

function parseCityStateZip(line) {
  // HIGH SPRINGS, FL 32643
  if (!line) return { city_name: null, state_code: null, postal_code: null };
  const m = line.match(/^(.*?),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/);
  if (m) {
    return {
      city_name: m[1].trim().toUpperCase(),
      state_code: m[2],
      postal_code: m[3],
    };
  }
  return { city_name: null, state_code: null, postal_code: null };
}

function parseSecTwpRng($) {
  const secTwpRng = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl09_pnlSingleValue span",
  )
    .text()
    .trim();
  if (!secTwpRng) return { section: null, township: null, range: null };
  const parts = secTwpRng.split("-").map((s) => s.trim());
  return {
    section: parts[0] || null,
    township: parts[1] || null,
    range: parts[2] || null,
  };
}

function parseAcres($) {
  const acresStr = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl11_pnlSingleValue span",
  )
    .text()
    .trim();
  const acres = Number(acresStr.replace(/[^0-9.]/g, ""));
  return isNaN(acres) ? null : acres;
}

function parsePropertyUseCode($) {
  let raw = findRowValueByTh(
    $,
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary",
    "Property Use Code",
  );
  if (!raw) {
    raw = findRowValueByTh(
      $,
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_divSummary",
      "Property Use",
    );
  }
  return raw || null;
}

function mapPropertyUseCode(rawValue) {
  const defaults = PROPERTY_USE_CODE_DEFAULTS;
  if (!rawValue) {
    return {
      code: null,
      description: null,
      ...defaults,
    };
  }
  const match = rawValue.match(/\((\d{5})\)/);
  const code = match ? match[1] : null;
  const description = rawValue.replace(/\(\d{5}\)\s*$/, "").trim() || null;
  const mapping =
    (code && PROPERTY_USE_CODE_MAP[code]) || { ...defaults };
  return {
    code,
    description,
    ...mapping,
  };
}

function parseZoning($) {
  const zs = new Set();
  $("#ctlBodyPane_ctl09_ctl01_gvwLand tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const z = textOf($, tds.eq(6));
    if (z) zs.add(z);
  });
  if (zs.size > 0) return Array.from(zs)[0];
  return null;
}

function parseBuildingInfo($) {
  const baseSelectorLeft =
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary";
  const baseSelectorRight =
    "#ctlBodyPane_ctl10_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_divSummary";

  const type = findRowValueByTh($, baseSelectorLeft, "Type") || null;
  const totalArea = findRowValueByTh($, baseSelectorLeft, "Total Area") || null;
  const heatedArea =
    findRowValueByTh($, baseSelectorLeft, "Heated Area") || null;
  const exteriorWalls =
    findRowValueByTh($, baseSelectorLeft, "Exterior Walls") || null;
  const interiorWalls =
    findRowValueByTh($, baseSelectorLeft, "Interior Walls") || null;
  const roofing = findRowValueByTh($, baseSelectorLeft, "Roofing") || null;
  const roofType = findRowValueByTh($, baseSelectorLeft, "Roof Type") || null;
  const floorCover =
    findRowValueByTh($, baseSelectorLeft, "Floor Cover") || null;

  const heat = findRowValueByTh($, baseSelectorRight, "Heat") || null;
  const hvac = findRowValueByTh($, baseSelectorRight, "HVAC") || null;
  const stories = findRowValueByTh($, baseSelectorRight, "Stories") || null;
  const actYear =
    findRowValueByTh($, baseSelectorRight, "Actual Year Built") || null;
  const effYear =
    findRowValueByTh($, baseSelectorRight, "Effective Year Built") || null;
  const bathrooms = findRowValueByTh($, baseSelectorRight, "Bathrooms") || null;
  const bedrooms = findRowValueByTh($, baseSelectorRight, "Bedrooms") || null;

  return {
    type,
    totalArea,
    heatedArea,
    exteriorWalls,
    interiorWalls,
    roofing,
    roofType,
    floorCover,
    heat,
    hvac,
    stories,
    actYear,
    effYear,
    bathrooms,
    bedrooms,
  };
}

function findSectionByTitle($, title) {
  const target = title ? String(title).toLowerCase() : null;
  if (!target) return null;
  let found = null;
  $("section[id^='ctlBodyPane_']").each((_, section) => {
    if (found) return;
    const $section = $(section);
    const headerTitle = cleanText(
      $section.find("> header .title, > header div.title").first().text(),
    );
    if (headerTitle && headerTitle.toLowerCase() === target) {
      found = $section;
    }
  });
  return found;
}

function mapPermitImprovementType(typeText) {
  const txt = (typeText || "").toUpperCase();
  if (!txt) return null;
  if (txt.includes("ROOF")) return "Roof";
  if (txt.includes("POOL")) return "Pool";
  if (txt.includes("SCREEN")) return "ScreenEnclosure";
  if (txt.includes("FENCE")) return "Fence";
  if (txt.includes("REMODEL") || txt.includes("RENOV")) {
    return "InteriorRenovation";
  }
  if (txt.includes("WINDOW") || txt.includes("DOOR")) return "WindowsDoors";
  if (txt.includes("HVAC") || txt.includes("A/C") || txt.includes("AIR")) {
    return "HVAC";
  }
  if (txt.includes("ELECTR")) return "Electrical";
  if (txt.includes("PLUMB")) return "Plumbing";
  if (txt.includes("PAVE")) return "Paving";
  if (txt.includes("DOCK") || txt.includes("SHORE")) return "DockAndShore";
  if (txt.includes("DECK")) return "Deck";
  if (txt.includes("SIGN")) return "Signage";
  if (txt.includes("DEMOL")) return "Demolition";
  if (txt.includes("IRRIG")) return "Irrigation";
  if (txt.includes("SOLAR")) return "Solar";
  return "Other";
}

function mapPermitImprovementStatus(activeText) {
  const normalized = (activeText || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "yes" || normalized === "y") return "Active";
  if (normalized === "no" || normalized === "n") return "Completed";
  return null;
}

function parsePermitTable($) {
  const section = findSectionByTitle($, "Permits");
  if (!section) return [];
  let table = section.find("table[id*='grdPermit']").first();
  if (!table || !table.length) {
    table = section.find("table").first();
  }
  if (!table || !table.length) return [];

  const rows = [];
  table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const permitNumber = cleanText($tr.find("th").first().text());
    const cells = [];
    $tr.find("td").each((idx, td) => {
      cells.push(cleanText($(td).text()));
    });
    const hasContent =
      permitNumber ||
      cells.some((val) => val && val.length > 0);
    if (!hasContent) return;
    rows.push({
      permitNumber: permitNumber || null,
      type: cells[0] || null,
      primary: cells[1] || null,
      active: cells[2] || null,
      issueDate: cells[3] || null,
      value: cells[4] || null,
    });
  });
  return rows;
}

function parseSales($) {
  let salesTable = null;
  $("section").each((_, section) => {
    if (salesTable) return;
    const title = $(section).find("div.title").first().text().trim().toLowerCase();
    if (title === "sales") {
      const candidate = $(section).find("table").first();
      if (candidate && candidate.length) {
        salesTable = candidate;
      }
    }
  });
  if (!salesTable || !salesTable.length) return [];

  const rows = salesTable.find("tbody tr");
  const sales = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (!tds || !tds.length) return;
    const date = textOf($, tds.eq(0));
    const priceStr = textOf($, tds.eq(1));
    const instr = textOf($, tds.eq(2));
    const book = cleanText(textOf($, tds.eq(3)) || "");
    const page = cleanText(textOf($, tds.eq(4)) || "");
    const qualification = textOf($, tds.eq(5));
    const vacantImproved = textOf($, tds.eq(6));
    const grantor = textOf($, tds.eq(7));
    const grantee = textOf($, tds.eq(8));
    let clerkUrl = null;
    const linkTd = tds.eq(9);
    if (linkTd && linkTd.find("input").length) {
      const onclick = linkTd.find("input").attr("onclick") || "";
      const m = onclick.match(/window\.open\('([^']+)'\)/);
      if (m) clerkUrl = m[1];
    }
    let instrumentNumber = null;
    if (clerkUrl) {
      const docMatch = clerkUrl.match(/[?&](?:docid|instrument|inst|instrumentnumber)=(\d+)/i);
      if (docMatch) {
        instrumentNumber = docMatch[1];
      }
    }

    if (date && priceStr) {
      sales.push({
        date,
        price: moneyToNumber(priceStr),
        instrument: instr || null,
        book: book || null,
        page: page || null,
        qualification: qualification || null,
        vacantImproved: vacantImproved || null,
        grantor: grantor || null,
        grantee: grantee || null,
        clerkUrl: clerkUrl || null,
        instrumentNumber: instrumentNumber || null,
      });
    }
  });
  return sales;
}

function parseValuationsWorking($) {
  const rows = $("#ctlBodyPane_ctl06_ctl01_grdValuation tbody tr");
  const map = {};
  rows.each((i, tr) => {
    const th = $(tr).find("th").first();
    const label = textOf($, th);
    const td = $(tr).find("td").first();
    const val = textOf($, td);
    map[label] = val;
  });
  if (Object.keys(map).length === 0) return null;
  return {
    year: 2025,
    improvement: moneyToNumber(map["Improvement Value"]) || null,
    land: moneyToNumber(map["Land Value"]) || null,
    justMarket: moneyToNumber(map["Just (Market) Value"]) || null,
    assessed: moneyToNumber(map["Assessed Value"]) || null,
    taxable: moneyToNumber(map["Taxable Value"]) || null,
  };
}

function parseValuationsCertified($) {
  const table = $("#ctlBodyPane_ctl07_ctl01_grdValuation_grdYearData");
  if (!table || table.length === 0) return [];
  const years = [];
  table.find("thead th.value-column").each((i, th) => {
    const y = parseIntSafe($(th).text());
    if (y) years.push(y);
  });
  const rowMap = {}; // label -> array of column strings
  table.find("tbody tr").each((i, tr) => {
    const label = $(tr).find("th").first().text().trim();
    const vals = [];
    $(tr)
      .find("td.value-column")
      .each((j, td) => vals.push($(td).text().trim()));
    rowMap[label] = vals;
  });
  const labelFor = (primary, fallback) => {
    if (rowMap.hasOwnProperty(primary)) return primary;
    if (fallback && rowMap.hasOwnProperty(fallback)) return fallback;
    return null;
  };
  const lblJust = labelFor("Just Market Value");
  const lblLand = labelFor("Land Value");
  const lblImpr = labelFor("Improvement Value");
  const lblAssessed = labelFor(
    "School Assessed Value",
    "Non School Assessed Value",
  );
  const lblTaxable = labelFor(
    "School Taxable Value",
    "Non School Taxable Value",
  );

  const out = [];
  years.forEach((year, colIdx) => {
    const rec = {
      year,
      improvement: lblImpr
        ? moneyToNumber((rowMap[lblImpr] || [])[colIdx])
        : null,
      land: lblLand ? moneyToNumber((rowMap[lblLand] || [])[colIdx]) : null,
      justMarket: lblJust
        ? moneyToNumber((rowMap[lblJust] || [])[colIdx])
        : null,
      assessed: lblAssessed
        ? moneyToNumber((rowMap[lblAssessed] || [])[colIdx])
        : null,
      taxable: lblTaxable
        ? moneyToNumber((rowMap[lblTaxable] || [])[colIdx])
        : null,
    };
    out.push(rec);
  });
  return out;
}

function toISOFromMDY(mdy) {
  if (!mdy) return null;
  const m = mdy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

// Exterior Wall Material mapping
function mapExteriorWallMaterial(material) {
  if (!material) return null;

  const exteriorWallMap = {
    "ABOVE AVERAGE": "Wood Siding",
    "ALUMINUM SIDNG": "Metal Siding",
    "ASBESTOS": "Fiber Cement Siding",
    "AVERAGE": "Wood Siding",
    "BD AND BAT AAV": "Wood Siding",
    "BELOW AVERAGE": "Wood Siding",
    "BOARD & BATTEN": "Wood Siding",
    "CB STUCCO": "Stucco",
    "CEDAR/REDWOOD": "Wood Siding",
    "CEMENT BRICK": "Brick",
    "COMMON BRICK": "Brick",
    "CONCRETE BLOCK": "Concrete Block",
    "CORR ASBESTOS": "Fiber Cement Siding",
    "CORR METAL": "Metal Siding",
    "FACE BRICK": "Brick",
    "GLASS/THERMO.": "Curtain Wall",
    "HARDIBOARD": "Fiber Cement Siding",
    "MINIMUM": "Wood Siding",
    "MODULAR METAL": "Metal Siding",
    "N/A": "Wood Siding",
    "NONE": "Wood Siding",
    "PRECAST PANEL": "Precast Concrete",
    "PRE-FAB PANEL": "Precast Concrete",
    "PRE-FINSH METL": "Metal Siding",
    "REINF CONCRETE": "Precast Concrete",
    "SINGLE SIDING": "Wood Siding",
    "STONE": "Natural Stone",
    "TILE/WD STUCCO": "Stucco",
    "WALL BOARD": "EIFS",
    "WOOD SHEATH": "Wood Siding",
    "WOOD SHINGLE": "Wood Siding"
  };

  const upperMaterial = material.toUpperCase();
  return exteriorWallMap[upperMaterial] || null;
}

function normalizeOwner(owner, ownersByDate) {
  try {
    const current = ownersByDate && ownersByDate.current;
    if (!current || !Array.isArray(current)) return owner;
    const matches = current.filter(
      (c) =>
        c.type === "person" &&
        c.last_name &&
        owner.last_name &&
        c.last_name.toLowerCase() === owner.last_name.toLowerCase(),
    );
    for (const c of matches) {
      if (!owner.first_name) continue;
      if (
        c.first_name &&
        c.first_name.toLowerCase().startsWith(owner.first_name.toLowerCase())
      ) {
        return {
          ...owner,
          first_name: c.first_name || owner.first_name,
          middle_name:
            c.middle_name != null ? c.middle_name : owner.middle_name,
        };
      }
    }
  } catch {}
  return owner;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = readText("input.html");
  const $ = cheerio.load(html);

  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");
  const defaultSourceHttpRequest =
    (unaddr && unaddr.source_http_request) ||
    (seed && seed.source_http_request) || {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/Application.aspx",
    };

  let ownersData = null,
    utilsData = null,
    layoutData = null,
    structureData = null;
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch {}
  try {
    utilsData = readJSON(path.join("owners", "utilities_data.json"));
  } catch {}
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch {}
  try {
    structureData = readJSON(path.join("owners", "structure_data.json"));
  } catch {}

  const parcelId =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue span",
    )
      .text()
      .trim() ||
    (seed && seed.parcel_id) ||
    null;
  const propIdStr = $(
    "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl01_pnlSingleValue span",
  )
    .text()
    .trim();
  const propId =
    normalizeId(propIdStr) ||
    normalizeId(seed && (seed.prop_id || seed.property_id || seed.parcel_id)) ||
    null;
  const propIdNumeric = propId != null ? parseIntSafe(propId) : null;
  const parcelIdNumeric = parcelId != null ? parseIntSafe(parcelId) : null;

  const candidateIdSet = new Set();
  const propertyIdCandidates = [];
  const addCandidateId = (value) => {
    const normalized = normalizeId(value);
    if (!normalized) return;
    if (candidateIdSet.has(normalized)) return;
    candidateIdSet.add(normalized);
    propertyIdCandidates.push(normalized);
  };
  addCandidateId(propId);
  if (propIdNumeric != null) addCandidateId(String(propIdNumeric));
  addCandidateId(parcelId);
  if (parcelIdNumeric != null) addCandidateId(String(parcelIdNumeric));

  const resolvePropertyEntry = (dataObj) => {
    if (!dataObj) return null;
    for (const id of propertyIdCandidates) {
      const key = `property_${id}`;
      if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
        return dataObj[key];
      }
    }
    return null;
  };

  const ownersEntry = resolvePropertyEntry(ownersData);
  const utilitiesEntry = resolvePropertyEntry(utilsData);
  const layoutEntry = resolvePropertyEntry(layoutData);
  const structureEntry = resolvePropertyEntry(structureData);
  const binfo = parseBuildingInfo($);
  const legalDesc =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl07_pnlSingleValue span",
    )
      .text()
      .trim() || null;
  const subdivision =
    $(
      "#ctlBodyPane_ctl03_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl06_pnlSingleValue span",
    )
      .text()
      .trim() || null;
  const zoning = parseZoning($);
  const acres = parseAcres($);
  const propertyUseRaw = parsePropertyUseCode($);
  const propertyUse = mapPropertyUseCode(propertyUseRaw);
  const requestIdentifier =
    (unaddr && unaddr.request_identifier) ||
    (seed && seed.request_identifier) ||
    parcelId ||
    null;

  let personIndex = 0;
  let companyIndex = 0;
  const personLookup = new Map();
  const companyLookup = new Map();

  function createPersonRecord(personData) {
    if (!personData) return null;
    const firstName =
      personData.first_name != null
        ? String(personData.first_name).trim()
        : "";
    const lastName =
      personData.last_name != null ? String(personData.last_name).trim() : "";
    const middleRaw =
      personData.middle_name != null
        ? String(personData.middle_name).trim()
        : "";

    // Validate first_name and last_name match required pattern
    if (!isValidFirstOrLastName(firstName) || !isValidFirstOrLastName(lastName)) {
      return null;
    }

    const middleName = middleRaw && isValidMiddleName(middleRaw) ? middleRaw : null;
    const key =
      firstName || lastName
        ? `${firstName.toLowerCase()}|${middleRaw.toLowerCase()}|${lastName.toLowerCase()}`
        : null;

    if (key && personLookup.has(key)) {
      return personLookup.get(key);
    }

    personIndex += 1;
    const filename = `person_${personIndex}.json`;
    const personObj = {
      birth_date: personData.birth_date || null,
      first_name: firstName || "",
      last_name: lastName || "",
      middle_name: middleName,
      prefix_name:
        personData && personData.prefix_name != null
          ? personData.prefix_name
          : null,
      suffix_name:
        personData && personData.suffix_name != null
          ? personData.suffix_name
          : null,
      us_citizenship_status:
        personData && personData.us_citizenship_status != null
          ? personData.us_citizenship_status
          : null,
      veteran_status:
        personData && personData.veteran_status != null
          ? personData.veteran_status
          : null,
    };
    writeJSON(path.join(dataDir, filename), personObj);
    const relPath = `./${filename}`;
    if (key) personLookup.set(key, relPath);
    return relPath;
  }

  function createCompanyRecord(name) {
    const cleanName = name != null ? String(name).trim() : "";
    const key = cleanName ? cleanName.toLowerCase() : null;
    if (key && companyLookup.has(key)) {
      return companyLookup.get(key);
    }
    companyIndex += 1;
    const filename = `company_${companyIndex}.json`;
    const companyObj = {
      name: cleanName,
    };
    if (requestIdentifier) {
      companyObj.request_identifier = requestIdentifier;
    }
    writeJSON(path.join(dataDir, filename), companyObj);
    const relPath = `./${filename}`;
    if (key) companyLookup.set(key, relPath);
    return relPath;
  }

  const property = {
    parcel_identifier: parcelId || "",
    ownership_estate_type: propertyUse.ownership_estate_type || null,
    build_status: propertyUse.build_status || null,
    structure_form: propertyUse.structure_form || null,
    property_usage_type: propertyUse.property_usage_type || null,
    property_type: propertyUse.property_type,
    number_of_units_type: binfo.type === "DUPLEX" ? "Two" :
                          binfo.type === "TRI/QUADRAPLEX" ? "TwoToFour" : "One",
    property_structure_built_year: parseIntSafe(binfo.actYear),
    property_effective_built_year: parseIntSafe(binfo.effYear),
    livable_floor_area: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    total_area: binfo.totalArea ? `${parseIntSafe(binfo.totalArea).toLocaleString()} sq ft` : null,
    area_under_air: binfo.heatedArea ? `${parseIntSafe(binfo.heatedArea).toLocaleString()} sq ft` : null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision && subdivision.length ? subdivision : null,
    zoning: zoning || null,
    number_of_units: binfo.type === "DUPLEX" ? 2 :
                     binfo.type === "TRI/QUADRAPLEX" ? 3 : 1,
    historic_designation: false,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
  };
  if (property.property_type === "LandParcel") {
    property.number_of_units = null;
    property.number_of_units_type = null;
  }
  const propertyFilename = "property.json";
  const propertyPath = `./${propertyFilename}`;
  writeJSON(path.join(dataDir, propertyFilename), property);

  // Structure records (from structure data when available; fallback to parsed building info)
  const baseStructure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: mapExteriorWallMaterial(binfo.exteriorWalls),
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary:
      binfo.interiorWalls === "DRYWALL" ? "Drywall" : null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material:
      binfo.roofing === "ASPHALT" ? "Architectural Asphalt Shingle" : null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: binfo.roofType === "GABLE/HIP" ? "Gable" : null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: binfo.roofing === "ASPHALT" ? "Shingle" : null,
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
    number_of_stories: parseFloatSafe(binfo.stories),
    finished_base_area: parseIntSafe(binfo.heatedArea),
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
  };

  const structureItems = (() => {
    const wrap = (entry, buildingIndex = null) => ({
      data: {
        ...baseStructure,
        ...entry,
        source_http_request:
          entry && entry.source_http_request != null
            ? entry.source_http_request
            : clone(defaultSourceHttpRequest),
        request_identifier:
          entry && entry.request_identifier != null
            ? entry.request_identifier
            : requestIdentifier,
      },
      buildingIndex:
        Number.isFinite(parseIntSafe(buildingIndex)) ?
          parseIntSafe(buildingIndex) :
          null,
    });

    if (
      structureEntry &&
      typeof structureEntry === "object" &&
      structureEntry !== null &&
      Array.isArray(structureEntry.buildings) &&
      structureEntry.buildings.length
    ) {
      return structureEntry.buildings.map((rec) => {
        const entry =
          rec && typeof rec === "object" && rec.structure
            ? rec.structure
            : rec;
        const buildingIndex =
          rec && rec.building_index != null ? rec.building_index : null;
        return wrap(entry || {}, buildingIndex);
      });
    }

    if (Array.isArray(structureEntry)) {
      if (!structureEntry.length) return [wrap({}, null)];
      return structureEntry.map((entry) => wrap(entry || {}, null));
    }

    if (
      structureEntry &&
      typeof structureEntry === "object" &&
      Array.isArray(structureEntry.structures)
    ) {
      const arr = structureEntry.structures;
      if (!arr.length) return [wrap({}, null)];
      return arr.map((entry) => wrap(entry || {}, null));
    }

    if (structureEntry && typeof structureEntry === "object") {
      return [wrap(structureEntry, null)];
    }

    return [wrap({}, null)];
  })();

  const structureOutputs = [];
  const structurePaths = [];
  structureItems.forEach((item) => {
    const filename = `structure_${structureOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    structureOutputs.push({
      filename,
      data: item.data,
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
    structurePaths.push({
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
  });
  structureOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  const utilityItems = (() => {
    const wrap = (entry, buildingIndex = null) => ({
      data: {
        ...entry,
        source_http_request:
          entry && entry.source_http_request != null
            ? entry.source_http_request
            : clone(defaultSourceHttpRequest),
        request_identifier:
          entry && entry.request_identifier != null
            ? entry.request_identifier
            : requestIdentifier,
      },
      buildingIndex:
        Number.isFinite(parseIntSafe(buildingIndex)) ?
          parseIntSafe(buildingIndex) :
          null,
    });

    if (
      utilitiesEntry &&
      typeof utilitiesEntry === "object" &&
      utilitiesEntry !== null &&
      Array.isArray(utilitiesEntry.buildings) &&
      utilitiesEntry.buildings.length
    ) {
      return utilitiesEntry.buildings.map((rec) => {
        const entry =
          rec && typeof rec === "object" && rec.utility
            ? rec.utility
            : rec;
        const buildingIndex =
          rec && rec.building_index != null ? rec.building_index : null;
        return wrap(entry || {}, buildingIndex);
      });
    }

    if (Array.isArray(utilitiesEntry)) {
      return utilitiesEntry.map((entry) => wrap(entry || {}, null));
    }

    if (
      utilitiesEntry &&
      typeof utilitiesEntry === "object" &&
      Array.isArray(utilitiesEntry.utilities)
    ) {
      return utilitiesEntry.utilities.map((entry) => wrap(entry || {}, null));
    }

    if (utilitiesEntry && typeof utilitiesEntry === "object") {
      return [wrap(utilitiesEntry, null)];
    }

    return [];
  })();

  const utilityOutputs = [];
  const utilityPaths = [];
  utilityItems.forEach((item) => {
    const filename = `utility_${utilityOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    utilityOutputs.push({
      filename,
      data: item.data,
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
    utilityPaths.push({
      path: relPath,
      buildingIndex: item.buildingIndex,
    });
  });
  utilityOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  const propertyImprovementOutputs = [];
  const permitEntries = parsePermitTable($);
  permitEntries.forEach((permit, idx) => {
    const improvementType = mapPermitImprovementType(permit.type);
    const improvementStatus = mapPermitImprovementStatus(permit.active);
    const permitIssueDate = toISOFromMDY(permit.issueDate);
    const estimatedCostAmount = moneyToNumber(permit.value);
    const permitNumber =
      permit.permitNumber && permit.permitNumber.length
        ? permit.permitNumber
        : null;
    const improvementAction =
      permit.type && permit.type.length ? permit.type : null;

    const baseRequestId =
      requestIdentifier || permitNumber || parcelId || propId || "permit";
    const improvementRequestId = permitNumber
      ? `${baseRequestId}-${permitNumber}`
      : `${baseRequestId}-permit-${idx + 1}`;

    const improvement = {
      improvement_type: improvementType || "Other",
      improvement_status: improvementStatus || null,
      improvement_action: improvementAction,
      permit_number: permitNumber,
      permit_issue_date: permitIssueDate,
      completion_date: null,
      permit_required: permitNumber ? true : null,
      estimated_cost_amount:
        typeof estimatedCostAmount === "number" ? estimatedCostAmount : null,
      request_identifier: improvementRequestId,
    };

    const cleanedImprovement = {};
    Object.keys(improvement).forEach((key) => {
      const value = improvement[key];
      if (value === null || value === undefined) return;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) cleanedImprovement[key] = trimmed;
      } else {
        cleanedImprovement[key] = value;
      }
    });

    if (!cleanedImprovement.improvement_type && !cleanedImprovement.permit_number) {
      return;
    }
    if (!cleanedImprovement.improvement_type) {
      cleanedImprovement.improvement_type = "Other";
    }

    const filename = `property_improvement_${propertyImprovementOutputs.length + 1}.json`;
    writeJSON(path.join(dataDir, filename), cleanedImprovement);
    propertyImprovementOutputs.push({ filename, path: `./${filename}` });
  });

  const createLayoutRecord = (spaceType, overrides = {}) => {
    const base = {
      space_type: spaceType,
      space_index: null,
      space_type_index: null,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
      is_finished: true,
      furnished: null,
      paint_condition: null,
      flooring_wear: null,
      clutter_level: null,
      visible_damage: null,
      countertop_material: null,
      cabinet_style: null,
      fixture_finish_quality: null,
      design_style: null,
      natural_light_quality: null,
      decor_elements: null,
      pool_type: null,
      pool_equipment: null,
      spa_type: null,
      safety_features: null,
      view_type: null,
      lighting_features: null,
      condition_issues: null,
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
      source_http_request: clone(defaultSourceHttpRequest),
      request_identifier: requestIdentifier,
    };
    return { ...base, ...overrides };
  };

  const rawLayouts =
    layoutEntry && Array.isArray(layoutEntry.layouts) ? layoutEntry.layouts : [];
  const layoutBuildings =
    layoutEntry && Array.isArray(layoutEntry.buildings)
      ? layoutEntry.buildings
      : [];

  const layoutOutputs = [];
  const addLayoutRecord = (layoutDataObj) => {
    const filename = `layout_${layoutOutputs.length + 1}.json`;
    const relPath = `./${filename}`;
    layoutOutputs.push({ filename, data: layoutDataObj, path: relPath });
    return relPath;
  };

  const buildingLayoutsInfo = [];
  const propertyIsLand = property.property_type === "LandParcel";
  const totalAreaSqFt = parseIntSafe(binfo.totalArea);
  const heatedAreaSqFt = parseIntSafe(binfo.heatedArea);

  const normalizedBuildings = Array.isArray(layoutBuildings)
    ? layoutBuildings.map((building, idx) => {
        const subAreas = Array.isArray(building && building.sub_areas)
          ? building.sub_areas.map((entry) => ({
              description:
                entry && entry.description != null
                  ? String(entry.description)
                  : null,
              type:
                entry && entry.type != null ? String(entry.type) : null,
              square_feet: parseIntSafe(entry && entry.square_feet),
            }))
          : [];
        return {
          index: idx + 1,
          type:
            building && building.building_type != null
              ? String(building.building_type)
              : null,
          totalArea:
            parseIntSafe(
              building && building.total_area_sq_ft != null
                ? building.total_area_sq_ft
                : null,
            ) || null,
          heatedArea:
            parseIntSafe(
              building && building.heated_area_sq_ft != null
                ? building.heated_area_sq_ft
                : null,
            ) || null,
          bedrooms:
            parseIntSafe(
              building && building.bedrooms != null
                ? building.bedrooms
                : null,
            ) || 0,
          fullBaths:
            parseIntSafe(
              building && building.full_bathrooms != null
                ? building.full_bathrooms
                : null,
            ) || 0,
          halfBaths:
            parseIntSafe(
              building && building.half_bathrooms != null
                ? building.half_bathrooms
                : null,
            ) || 0,
          stories:
            parseFloatSafe(
              building && building.stories != null
                ? building.stories
                : null,
            ) || null,
          subAreas,
        };
      })
    : [];

  const buildingChildrenMap = new Map();
  const getChildLayouts = (buildingIndex) => {
    if (!buildingChildrenMap.has(buildingIndex)) {
      buildingChildrenMap.set(buildingIndex, []);
    }
    return buildingChildrenMap.get(buildingIndex);
  };
  const standaloneLayouts = [];

  const attachLayoutToBuilding = (buildingIndex, layoutObj) => {
    const list = getChildLayouts(buildingIndex);
    list.push(layoutObj);
  };
  const queueStandaloneLayout = (layoutObj) => {
    standaloneLayouts.push(layoutObj);
  };

  if (normalizedBuildings.length) {
    normalizedBuildings.forEach((building) => {
      const buildingIndex = building.index;
      const sizeSqFt =
        building.totalArea != null
          ? building.totalArea
          : building.heatedArea != null
          ? building.heatedArea
          : null;
      const buildingLayout = createLayoutRecord("Building", {
        space_index: buildingIndex,
        space_type_index: `${buildingIndex}`,
        size_square_feet:
          sizeSqFt != null
            ? sizeSqFt
            : totalAreaSqFt != null
            ? totalAreaSqFt
            : heatedAreaSqFt != null
            ? heatedAreaSqFt
            : null,
        floor_level: "1st Floor",
        is_exterior: false,
      });
      const path = addLayoutRecord(buildingLayout);
      buildingLayoutsInfo.push({
        index: buildingIndex,
        path,
        childPaths: [],
        childCount: 0,
      });
    });
  } else if (!propertyIsLand) {
    const fallbackBuildingCount =
      structurePaths.length > 0 ? structurePaths.length : 1;
    for (let i = 0; i < fallbackBuildingCount; i += 1) {
      const buildingIndex = i + 1;
      const buildingLayout = createLayoutRecord("Building", {
        space_index: buildingIndex,
        space_type_index: `${buildingIndex}`,
        size_square_feet:
          totalAreaSqFt != null
            ? totalAreaSqFt
            : heatedAreaSqFt != null
            ? heatedAreaSqFt
            : null,
        floor_level: "1st Floor",
        is_exterior: false,
      });
      const path = addLayoutRecord(buildingLayout);
      buildingLayoutsInfo.push({
        index: buildingIndex,
        path,
        childPaths: [],
        childCount: 0,
      });
    }
  }

  if (Array.isArray(rawLayouts) && rawLayouts.length) {
    rawLayouts.forEach((layout) => {
      const source = layout || {};
      const { parent_building_index, ...overrides } = source;
      const spaceType =
        overrides && overrides.space_type ? overrides.space_type : "Living Area";
      const normalized = createLayoutRecord(spaceType, overrides);
      if (normalized.space_type === "Interior Space") {
        normalized.space_type = "Living Area";
      }
      if (!normalized.floor_level) {
        normalized.floor_level = "1st Floor";
      }
      const parentIndex = parent_building_index != null
        ? parseIntSafe(parent_building_index)
        : null;
      if (
        Number.isFinite(parentIndex) &&
        buildingLayoutsInfo.some((info) => info.index === parentIndex)
      ) {
        attachLayoutToBuilding(parentIndex, normalized);
      } else if (buildingLayoutsInfo.length) {
        attachLayoutToBuilding(buildingLayoutsInfo[0].index, normalized);
      } else {
        queueStandaloneLayout(normalized);
      }
    });
  }

  const mapSubAreaSpaceType = (subArea) => {
    if (!subArea) return null;
    const typeCode = subArea.type ? String(subArea.type).toUpperCase() : "";
    const desc = subArea.description ? String(subArea.description).toUpperCase() : "";

    if (typeCode === "BAS" || desc.includes("BASE AREA")) return "Living Area";
    if (typeCode === "FOP" || desc.includes("OPEN PORCH")) return "Open Porch";
    if (desc.includes("SCREEN") && desc.includes("PORCH")) return "Screened Porch";
    if (desc.includes("PORCH")) return "Porch";
    if (desc.includes("BALCONY")) return "Balcony";
    if (desc.includes("DECK")) return "Deck";
    if (desc.includes("PATIO")) return "Patio";
    if (desc.includes("GAZEBO")) return "Gazebo";
    if (desc.includes("STORAGE")) return "Storage Room";
    if (desc.includes("GARAGE")) return desc.includes("DET") ? "Detached Garage" : "Attached Garage";
    if (desc.includes("CARPORT")) return "Carport";
    if (desc.includes("POOL")) return "Pool Area";
    if (desc.includes("LANAI")) return "Lanai";
    if (desc.includes("SUN ROOM") || desc.includes("SUNROOM")) return "Sunroom";
    if (desc.includes("ENCLOSED PORCH")) return "Enclosed Porch";
    if (desc.includes("OPEN PORCH")) return "Open Porch";
    if (desc.includes("PAVILION")) return "Gazebo";
    if (desc.includes("CABANA")) return "Enclosed Cabana";
    if (desc.includes("BARN")) return "Barn";
    if (desc.includes("STAIR") || desc.includes("STAIRWELL")) return null;

    // If type/description is purely numeric (like "6100"), skip it
    if (/^\d+$/.test(typeCode) || /^\d+$/.test(desc)) return null;

    return null;
  };

  const ensureFallbackRooms = () => {
    if (buildingLayoutsInfo.length) {
      buildingLayoutsInfo.forEach((info) => {
        const existingChildren = buildingChildrenMap.get(info.index) || [];
        if (existingChildren.length) return;

        const meta =
          normalizedBuildings.find((b) => b.index === info.index) || null;
        if (meta) {
          for (let i = 0; i < meta.bedrooms; i += 1) {
            attachLayoutToBuilding(
              info.index,
              createLayoutRecord("Bedroom", { floor_level: "1st Floor" }),
            );
          }
          for (let i = 0; i < meta.fullBaths; i += 1) {
            attachLayoutToBuilding(
              info.index,
              createLayoutRecord("Full Bathroom", { floor_level: "1st Floor" }),
            );
          }
          for (let i = 0; i < meta.halfBaths; i += 1) {
            attachLayoutToBuilding(
              info.index,
              createLayoutRecord("Half Bathroom / Powder Room", {
                floor_level: "1st Floor",
              }),
            );
          }
          meta.subAreas.forEach((subArea) => {
            const mapped = mapSubAreaSpaceType(subArea);
            if (!mapped) return;
            attachLayoutToBuilding(
              info.index,
              createLayoutRecord(mapped, {
                floor_level: "1st Floor",
                size_square_feet:
                  subArea.square_feet != null ? subArea.square_feet : null,
              }),
            );
          });
        }
      });

      const hasChildLayouts = buildingLayoutsInfo.some((info) => {
        const childLayouts = buildingChildrenMap.get(info.index) || [];
        return childLayouts.length > 0;
      });
      if (hasChildLayouts) return;

      const primary = buildingLayoutsInfo[0];
      if (!primary) return;
      const targetIndex = primary.index;

      const fallbackLayouts = [];
      const bedroomCount = parseIntSafe(binfo.bedrooms) || 0;
      for (let i = 0; i < bedroomCount; i += 1) {
        fallbackLayouts.push(
          createLayoutRecord("Bedroom", { floor_level: "1st Floor" }),
        );
      }
      const bathroomsCount = parseFloatSafe(binfo.bathrooms);
      if (bathroomsCount != null) {
        const fullBaths = Math.floor(bathroomsCount);
        const fractional = bathroomsCount - fullBaths;
        const halfBaths =
          fractional >= 0.5 ? Math.round(fractional * 2) : 0;
        for (let i = 0; i < fullBaths; i += 1) {
          fallbackLayouts.push(
            createLayoutRecord("Full Bathroom", {
              floor_level: "1st Floor",
            }),
          );
        }
        for (let i = 0; i < halfBaths; i += 1) {
          fallbackLayouts.push(
            createLayoutRecord("Half Bathroom / Powder Room", {
              floor_level: "1st Floor",
            }),
          );
        }
      }
      if (!fallbackLayouts.length) {
        fallbackLayouts.push(
          createLayoutRecord("Living Area", { floor_level: "1st Floor" }),
        );
      }
      fallbackLayouts.forEach((layout) =>
        attachLayoutToBuilding(targetIndex, layout),
      );
      return;
    }

    if (standaloneLayouts.length) return;
    if (propertyIsLand) return;

    const fallbackLayouts = [];
    const bedroomCount = parseIntSafe(binfo.bedrooms) || 0;
    for (let i = 0; i < bedroomCount; i += 1) {
      fallbackLayouts.push(
        createLayoutRecord("Bedroom", { floor_level: "1st Floor" }),
      );
    }
    const bathroomsCount = parseFloatSafe(binfo.bathrooms);
    if (bathroomsCount != null) {
      const fullBaths = Math.floor(bathroomsCount);
      const fractional = bathroomsCount - fullBaths;
      const halfBaths =
        fractional >= 0.5 ? Math.round(fractional * 2) : 0;
      for (let i = 0; i < fullBaths; i += 1) {
        fallbackLayouts.push(
          createLayoutRecord("Full Bathroom", { floor_level: "1st Floor" }),
        );
      }
      for (let i = 0; i < halfBaths; i += 1) {
        fallbackLayouts.push(
          createLayoutRecord("Half Bathroom / Powder Room", {
            floor_level: "1st Floor",
          }),
        );
      }
    }
    if (!fallbackLayouts.length) {
      fallbackLayouts.push(
        createLayoutRecord("Living Area", { floor_level: "1st Floor" }),
      );
    }
    fallbackLayouts.forEach((layout) => queueStandaloneLayout(layout));
  };

  ensureFallbackRooms();

  if (buildingLayoutsInfo.length) {
    buildingLayoutsInfo.forEach((info) => {
      const childLayouts = buildingChildrenMap.get(info.index) || [];
      const perTypeCounters = new Map();
      childLayouts.forEach((layout) => {
        info.childCount += 1;
        layout.space_index = info.childCount;

        const typeKey =
          layout.space_type != null ? String(layout.space_type) : "Unknown";
        const current = perTypeCounters.get(typeKey) || 0;
        const next = current + 1;
        perTypeCounters.set(typeKey, next);
        layout.space_type_index = `${info.index}.${next}`;

        if (!layout.floor_level) {
          layout.floor_level = "1st Floor";
        }
        const path = addLayoutRecord(layout);
        info.childPaths.push(path);
      });
    });
  } else if (standaloneLayouts.length) {
    const perTypeCounters = new Map();
    standaloneLayouts.forEach((layout, idx) => {
      const index = idx + 1;
      layout.space_index = index;
      const typeKey =
        layout.space_type != null ? String(layout.space_type) : "Unknown";
      const current = perTypeCounters.get(typeKey) || 0;
      const next = current + 1;
      perTypeCounters.set(typeKey, next);
      layout.space_type_index = `${index}.${next}`;
      if (!layout.floor_level) {
        layout.floor_level = "1st Floor";
      }
      addLayoutRecord(layout);
    });
  }

  layoutOutputs.forEach(({ filename, data }) => {
    writeJSON(path.join(dataDir, filename), data);
  });

  const writeRelationshipUnique = (() => {
    const seen = new Set();
    return (fromPath, toPath) => {
      const relFilename = makeRelationshipFilename(fromPath, toPath);
      if (!relFilename || seen.has(relFilename)) return;
      seen.add(relFilename);
      writeJSON(path.join(dataDir, relFilename), {
        from: { "/": fromPath },
        to: { "/": toPath },
      });
    };
  })();

  // Property relationships to structures (leftovers handled later)
  const propertyStructureFallback = (structurePath) => {
    writeRelationshipUnique(propertyPath, structurePath);
  };

  const propertyUtilityFallback = (utilityPath) => {
    writeRelationshipUnique(propertyPath, utilityPath);
  };

  // Property to layout relationships
  if (buildingLayoutsInfo.length) {
    buildingLayoutsInfo.forEach((info) => {
      writeRelationshipUnique(propertyPath, info.path);
    });
  } else if (layoutOutputs.length) {
    layoutOutputs.forEach(({ path }) => {
      writeRelationshipUnique(propertyPath, path);
    });
  }

  propertyImprovementOutputs.forEach(({ path }) => {
    writeRelationshipUnique(propertyPath, path);
  });

  // Layout hierarchy relationships (building -> rooms)
  buildingLayoutsInfo.forEach((info) => {
    info.childPaths.forEach((childPath) => {
      writeRelationshipUnique(info.path, childPath);
    });
  });

  // Structure relationships to layouts or property
  if (structurePaths.length) {
    const structures = structurePaths.map((meta) => ({ ...meta, _matched: false }));

    if (buildingLayoutsInfo.length) {
      buildingLayoutsInfo.forEach((info) => {
        const matches = structures.filter(
          (meta) => meta.buildingIndex === info.index,
        );
        matches.forEach((meta) => {
          writeRelationshipUnique(info.path, meta.path);
          meta._matched = true;
        });
      });

      const unmatchedStructures = structures.filter((meta) => !meta._matched);
      if (unmatchedStructures.length) {
        const buildingsNeedingStructure = buildingLayoutsInfo.filter(
          (info) =>
            !structures.some(
              (meta) => meta._matched && meta.buildingIndex === info.index,
            ),
        );
        let idx = 0;
        buildingsNeedingStructure.forEach((info) => {
          if (idx < unmatchedStructures.length) {
            const meta = unmatchedStructures[idx];
            writeRelationshipUnique(info.path, meta.path);
            meta._matched = true;
            idx += 1;
          }
        });
      }

      structures
        .filter((meta) => !meta._matched)
        .forEach((meta) => propertyStructureFallback(meta.path));
    } else {
      structures.forEach((meta) => propertyStructureFallback(meta.path));
    }
  }

  // Utility relationships to layouts or property
  if (utilityPaths.length) {
    const utilities = utilityPaths.map((meta) => ({ ...meta, _matched: false }));

    if (buildingLayoutsInfo.length) {
      buildingLayoutsInfo.forEach((info) => {
        const matches = utilities.filter(
          (meta) => meta.buildingIndex === info.index,
        );
        matches.forEach((meta) => {
          writeRelationshipUnique(info.path, meta.path);
          meta._matched = true;
        });
      });

      const unmatchedUtilities = utilities.filter((meta) => !meta._matched);
      if (unmatchedUtilities.length) {
        const buildingsNeedingUtility = buildingLayoutsInfo.filter(
          (info) =>
            !utilities.some(
              (meta) => meta._matched && meta.buildingIndex === info.index,
            ),
        );
        let idx = 0;
        buildingsNeedingUtility.forEach((info) => {
          if (idx < unmatchedUtilities.length) {
            const meta = unmatchedUtilities[idx];
            writeRelationshipUnique(info.path, meta.path);
            meta._matched = true;
            idx += 1;
          }
        });
      }

      utilities
        .filter((meta) => !meta._matched)
        .forEach((meta) => propertyUtilityFallback(meta.path));
    } else {
      utilities.forEach((meta) => propertyUtilityFallback(meta.path));
    }
  }

  // Address: capture full address without splitting components
  const addrFromHTML = parseLocationAddressFromHTML($);
  const htmlAddressParts = [
    addrFromHTML.addrLine1 ? addrFromHTML.addrLine1.trim() : null,
    addrFromHTML.addrLine2 ? addrFromHTML.addrLine2.trim() : null,
  ].filter(Boolean);
  const htmlFullAddress =
    htmlAddressParts.length > 0 ? htmlAddressParts.join(", ") : null;
  const fallbackAddress =
    unaddr && unaddr.full_address ? String(unaddr.full_address).trim() : null;
  const unnormalizedAddress = htmlFullAddress || fallbackAddress || null;

  const address = {
    unnormalized_address: unnormalizedAddress,
    latitude:
      unaddr && typeof unaddr.latitude === "number" ? unaddr.latitude : null,
    longitude:
      unaddr && typeof unaddr.longitude === "number" ? unaddr.longitude : null,
    source_http_request: clone(defaultSourceHttpRequest),
    request_identifier: requestIdentifier,
    county_name:
      (unaddr &&
        (unaddr.county_jurisdiction || unaddr.county_name || unaddr.county)) ||
      "Alachua",
    country_code: "US",
  };
  if (!address.unnormalized_address && addrFromHTML.addrLine1) {
    address.unnormalized_address = addrFromHTML.addrLine1;
  }
  const addressFilename = "address.json";
  const addressPath = `./${addressFilename}`;
  writeJSON(path.join(dataDir, addressFilename), address);

  const lot = {
    lot_type:
      acres != null && acres > 0.25
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre",
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: acres != null && acres > 0 ? Math.round(acres * 43560) : null,
    lot_size_acre: acres,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  const lotFilename = "lot.json";
  const lotPath = `./${lotFilename}`;
  writeJSON(path.join(dataDir, lotFilename), lot);

  // Create property relationships
  const relPropertyAddress = makeRelationshipFilename(propertyPath, addressPath);
  if (relPropertyAddress) {
    writeJSON(path.join(dataDir, relPropertyAddress), {
      from: { "/": propertyPath },
      to: { "/": addressPath },
    });
  }

  const relPropertyLot = makeRelationshipFilename(propertyPath, lotPath);
  if (relPropertyLot) {
    writeJSON(path.join(dataDir, relPropertyLot), {
      from: { "/": propertyPath },
      to: { "/": lotPath },
    });
  }

  const ownerMailingInfo = parseOwnerMailingAddresses($);

  const ownersByDate =
    ownersEntry && ownersEntry.owners_by_date
      ? ownersEntry.owners_by_date
      : {};
  let currentOwners = Array.isArray(ownersByDate.current)
    ? ownersByDate.current
    : [];
  if (!currentOwners.length) {
    const historicalDates = Object.keys(ownersByDate)
      .filter((key) => key !== "current")
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort((a, b) => a.localeCompare(b));
    if (historicalDates.length) {
      const latestKey = historicalDates[historicalDates.length - 1];
      const latestOwners = ownersByDate[latestKey];
      if (Array.isArray(latestOwners) && latestOwners.length) {
        currentOwners = latestOwners;
      }
    }
  }

  const mailingAddressFiles = [];
  if (currentOwners.length > 0) {
    ownerMailingInfo.uniqueAddresses.forEach((addr, idx) => {
      if (!addr) return;
      const fileName = `mailing_address_${idx + 1}.json`;
      const mailingObj = {
        unnormalized_address: addr,
        latitude: null,
        longitude: null,
        source_http_request: clone(defaultSourceHttpRequest),
        request_identifier: requestIdentifier,
      };
      writeJSON(path.join(dataDir, fileName), mailingObj);
      mailingAddressFiles.push({ path: `./${fileName}` });
    });
  }

  const currentOwnerEntities = [];
  currentOwners.forEach((owner, idx) => {
    if (!owner || !owner.type) return;
    let mailingIdx = null;
    if (
      ownerMailingInfo.rawAddresses[idx] != null &&
      mailingAddressFiles.length
    ) {
      const rawAddr = ownerMailingInfo.rawAddresses[idx];
      const uniqueIdx = ownerMailingInfo.uniqueAddresses.indexOf(rawAddr);
      if (uniqueIdx >= 0) mailingIdx = uniqueIdx;
    }
    if (mailingIdx == null && mailingAddressFiles.length) {
      mailingIdx = Math.min(idx, mailingAddressFiles.length - 1);
    }
    const mailingRecord =
      mailingIdx != null && mailingIdx >= 0
        ? mailingAddressFiles[mailingIdx]
        : null;

    if (owner.type === "person") {
      const normalizedPerson = normalizeOwner(owner, ownersByDate);
      const personPath = createPersonRecord(normalizedPerson);
      if (personPath) {
        currentOwnerEntities.push({
          type: "person",
          path: personPath,
          mailingPath: mailingRecord ? mailingRecord.path : null,
        });
      }
    } else if (owner.type === "company") {
      const companyPath = createCompanyRecord(owner.name || "");
      if (companyPath) {
        currentOwnerEntities.push({
          type: "company",
          path: companyPath,
          mailingPath: mailingRecord ? mailingRecord.path : null,
        });
      }
    }
  });

  const mailingRelationshipKeys = new Set();
  currentOwnerEntities.forEach((entity) => {
    if (!entity.path || !entity.mailingPath) return;
    const relKey = `${entity.path}|${entity.mailingPath}`;
    if (mailingRelationshipKeys.has(relKey)) return;
    mailingRelationshipKeys.add(relKey);
    const relFilename = makeRelationshipFilename(entity.path, entity.mailingPath);
    if (!relFilename) return;
    const relObj = {
      from: { "/": entity.path },
      to: { "/": entity.mailingPath },
    };
    writeJSON(path.join(dataDir, relFilename), relObj);
  });

  const work = parseValuationsWorking($);
  if (work) {
    const tax = {
      tax_year: work.year,
      property_assessed_value_amount: work.assessed || null,
      property_market_value_amount: work.justMarket || null,
      property_building_amount: work.improvement || null,
      property_land_amount: work.land || null,
      property_taxable_value_amount: work.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${work.year}.json`), tax);
  }

  const certs = parseValuationsCertified($);
  certs.forEach((rec) => {
    const tax = {
      tax_year: rec.year,
      property_assessed_value_amount: rec.assessed || null,
      property_market_value_amount: rec.justMarket || null,
      property_building_amount: rec.improvement || null,
      property_land_amount: rec.land || null,
      property_taxable_value_amount: rec.taxable || 0.0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${rec.year}.json`), tax);
  });

  const sales = parseSales($);
  const salesSorted = sales.sort(
    (a, b) => new Date(toISOFromMDY(b.date)) - new Date(toISOFromMDY(a.date)),
  );

  const saleFileRefs = [];
  const saleOwnerRelations = [];
  const saleBuyerStatus = new Map();

  salesSorted.forEach((s, idx) => {
    const iso = toISOFromMDY(s.date) || null;
    const saleIdx = idx + 1;
    const salesFilename = `sales_history_${saleIdx}.json`;
    const salesPath = `./${salesFilename}`;
    const saleObj = {
      ownership_transfer_date: iso,
      purchase_price_amount: s.price || 0,
    };
    writeJSON(path.join(dataDir, salesFilename), saleObj);
    saleBuyerStatus.set(salesPath, false);

    let deedPath = null;
    const hasDeedInfo =
      (s.instrument && s.instrument.trim()) ||
      (s.book && s.book.trim()) ||
      (s.page && s.page.trim()) ||
      (s.instrumentNumber && s.instrumentNumber.trim()) ||
      (s.clerkUrl && s.clerkUrl.trim());

    if (hasDeedInfo) {
      const deedFilename = `deed_${saleIdx}.json`;
      deedPath = `./${deedFilename}`;
      const deedObj = {
        deed_type: mapDeedType(s.instrument),
      };
      if (s.book) deedObj.book = String(s.book);
      if (s.page) deedObj.page = String(s.page);
      if (s.instrumentNumber) {
        deedObj.instrument_number = String(s.instrumentNumber);
      }
      writeJSON(path.join(dataDir, deedFilename), deedObj);

      if (s.clerkUrl) {
        const fileFilename = `file_${saleIdx}.json`;
        const filePath = `./${fileFilename}`;
        const fileObj = {
          file_format: "txt",
          name: `${(iso || "").slice(0, 4)} Clerk Link`,
          original_url: s.clerkUrl,
          ipfs_url: null,
          document_type: mapFileDocumentType(),
        };
        writeJSON(path.join(dataDir, fileFilename), fileObj);

        const relDeedFile = makeRelationshipFilename(deedPath, filePath);
        if (relDeedFile) {
          const relDF = {
            to: { "/": filePath },
            from: { "/": deedPath },
          };
          writeJSON(path.join(dataDir, relDeedFile), relDF);
        }
      }

      const relSalesDeed = makeRelationshipFilename(salesPath, deedPath);
      if (relSalesDeed) {
        const relSD = {
          to: { "/": deedPath },
          from: { "/": salesPath },
        };
        writeJSON(path.join(dataDir, relSalesDeed), relSD);
      }
    }

    const granteeParsed = parseOwnersFromText(s.grantee || "");
    granteeParsed.owners.forEach((owner) => {
      if (!owner || !owner.type) return;
      if (owner.type === "person") {
        const personPath = createPersonRecord(owner);
        if (personPath) {
          saleOwnerRelations.push({
            fromPath: salesPath,
            toPath: personPath,
          });
          saleBuyerStatus.set(salesPath, true);
        }
      } else if (owner.type === "company") {
        const companyPath = createCompanyRecord(owner.name || "");
        if (companyPath) {
          saleOwnerRelations.push({
            fromPath: salesPath,
            toPath: companyPath,
          });
          saleBuyerStatus.set(salesPath, true);
        }
      }
    });

    if (iso) {
      saleFileRefs.push({ saleIdx, dateISO: iso, salesPath });
    } else {
      saleFileRefs.push({ saleIdx, dateISO: null, salesPath });
    }
  });

  if (ownersEntry && ownersByDate && saleFileRefs.length) {
    const saleDatesISO = new Map(
      saleFileRefs
        .filter((ref) => ref.dateISO)
        .map((ref) => [ref.dateISO, ref]),
    );
    Object.keys(ownersByDate).forEach((dateKey) => {
      if (!saleDatesISO.has(dateKey)) return;
      const ref = saleDatesISO.get(dateKey);
      if (!ref || !ref.salesPath) return;
      if (saleBuyerStatus.get(ref.salesPath)) return;
      const ownersArr = ownersByDate[dateKey] || [];
      ownersArr.forEach((owner) => {
        if (!owner || !owner.type) return;
        if (owner.type === "person") {
          const normalized = normalizeOwner(owner, ownersByDate);
          const personPath = createPersonRecord(normalized);
          if (personPath) {
            saleOwnerRelations.push({
              fromPath: ref.salesPath,
              toPath: personPath,
            });
            saleBuyerStatus.set(ref.salesPath, true);
          }
        } else if (owner.type === "company") {
          const companyPath = createCompanyRecord(owner.name || "");
          if (companyPath) {
            saleOwnerRelations.push({
              fromPath: ref.salesPath,
              toPath: companyPath,
            });
            saleBuyerStatus.set(ref.salesPath, true);
          }
        }
      });
    });
  }

  const latestSaleRef = saleFileRefs.length ? saleFileRefs[0] : null;
  if (
    latestSaleRef &&
    latestSaleRef.salesPath &&
    !saleBuyerStatus.get(latestSaleRef.salesPath)
  ) {
    currentOwnerEntities.forEach((entity) => {
      if (!entity.path) return;
      saleOwnerRelations.push({
        fromPath: latestSaleRef.salesPath,
        toPath: entity.path,
      });
    });
    saleBuyerStatus.set(latestSaleRef.salesPath, true);
  }

  const saleOwnerRelationshipKeys = new Set();
  saleOwnerRelations.forEach((entry) => {
    if (!entry.fromPath || !entry.toPath) return;
    const relKey = `${entry.fromPath}|${entry.toPath}`;
    if (saleOwnerRelationshipKeys.has(relKey)) return;
    saleOwnerRelationshipKeys.add(relKey);
    const relFilename = makeRelationshipFilename(entry.fromPath, entry.toPath);
    if (!relFilename) return;
    const rel = {
      to: { "/": entry.toPath },
      from: { "/": entry.fromPath },
    };
    writeJSON(path.join(dataDir, relFilename), rel);
  });
}

main();
